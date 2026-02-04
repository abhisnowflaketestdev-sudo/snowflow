from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import uvicorn
import json
import os
import uuid
from datetime import datetime
import asyncio
from fastapi import Query

from graph_builder import execute_workflow, execute_workflow_streaming
from snowflake_client import snowflake_client
from api import translation_router
from demo_assets_installer import install_demo_assets, demo_assets_status
from flow_validator import validate_flow, FlowValidator
from flow_generator import generate_flow_from_prompt, generate_flow_quick, edit_flow, is_edit_request

app = FastAPI(title="SnowFlow API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    # Dev-friendly: Vite may jump ports (5174 → 5175/5176) if something is already bound.
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:5176",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5175",
        "http://127.0.0.1:5176",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Directory for saved workflows
WORKFLOWS_DIR = "saved_workflows"
os.makedirs(WORKFLOWS_DIR, exist_ok=True)

# Directory for governance data
GOVERNANCE_DIR = "governance_data"
os.makedirs(GOVERNANCE_DIR, exist_ok=True)


class WorkflowRequest(BaseModel):
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]
    prompt: Optional[str] = None


class SaveWorkflowRequest(BaseModel):
    name: str
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]


class DemoAssetsInstallRequest(BaseModel):
    demo_database: str = "SNOWFLOW_DEMO"
    overwrite_tables: bool = False
    upload_yaml: bool = True
    fallback_database: Optional[str] = None


class RoleSwitchRequest(BaseModel):
    role: str


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "SnowFlow Intelligence Engine"}


@app.get("/snowflake/connection")
async def check_snowflake_connection(force: bool = Query(default=False)):
    """Check Snowflake connection status. Use force=true to bypass cache and test connection."""
    try:
        if force:
            snowflake_client.reset_availability_cache()
        
        available = snowflake_client.is_snowflake_available(force_check=force)
        
        # If available, get some basic info
        info = {}
        if available:
            try:
                result = snowflake_client.execute_sql("SELECT CURRENT_ACCOUNT(), CURRENT_USER(), CURRENT_ROLE(), CURRENT_WAREHOUSE()")
                if result.get('success') and result.get('data'):
                    row = result['data'][0]
                    info = {
                        "account": row.get('CURRENT_ACCOUNT()'),
                        "user": row.get('CURRENT_USER()'),
                        "role": row.get('CURRENT_ROLE()'),
                        "warehouse": row.get('CURRENT_WAREHOUSE()'),
                    }
            except Exception:
                pass
        
        return {
            "connected": available,
            "info": info,
            "message": "Connected to Snowflake" if available else "Snowflake not reachable - check network/VPN/IP allowlist",
        }
    except Exception as e:
        return {"connected": False, "error": str(e)}


@app.post("/snowflake/reconnect")
async def reconnect_snowflake():
    """Force reconnect to Snowflake by resetting connection and cache"""
    try:
        # Reset the cached availability status
        snowflake_client.reset_availability_cache()
        
        # Close existing connection if any
        if snowflake_client._conn is not None:
            try:
                snowflake_client._conn.close()
            except Exception:
                pass
            snowflake_client._conn = None
        
        # Try to reconnect
        available = snowflake_client.is_snowflake_available(force_check=True)
        
        return {
            "success": available,
            "message": "Reconnected to Snowflake" if available else "Failed to connect to Snowflake",
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.get("/snowflake/roles")
async def list_snowflake_roles():
    """List roles granted to the backend Snowflake user + current session role."""
    try:
        granted = snowflake_client.get_granted_roles()
        current = snowflake_client.get_current_role()
        return {
            "roles": granted.get("roles", []),
            "current_role": current,
            "default_role": os.getenv("SNOWFLAKE_ROLE"),
            "error": granted.get("error"),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/snowflake/role")
async def set_snowflake_role(req: RoleSwitchRequest):
    """Switch Snowflake role for subsequent backend calls (must be granted to the user)."""
    try:
        granted = snowflake_client.get_granted_roles()
        roles = granted.get("roles", []) or []
        wanted = (req.role or "").strip()
        if not wanted:
            raise HTTPException(status_code=400, detail="role is required")
        role_set = {r.upper() for r in roles}
        if wanted.upper() not in role_set:
            raise HTTPException(status_code=403, detail=f"Role '{wanted}' is not granted to this user")
        return snowflake_client.set_role(wanted)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/cortex/models")
def list_cortex_models(
    probe: bool = Query(default=False),
    force_refresh: bool = Query(default=False),
    cross_region: bool = Query(default=False),
):
    """List Cortex LLM models for the current environment.
    
    Notes:
    - Default response is a curated list (static) because not all accounts expose a reliable listing API.
    - `probe=true` will attempt a tiny COMPLETE() call per model to verify availability (cached; higher cost).
    """
    try:
        return snowflake_client.list_cortex_models(probe=probe, force_refresh=force_refresh, include_experimental=cross_region)
    except Exception as e:
        # Always return something usable for the UI
        return {
            "models": [],
            "source": "error",
            "warning": f"Failed to list models: {str(e)[:120]}",
        }


@app.post("/run")
async def run_workflow(workflow: WorkflowRequest):
    """Execute a workflow"""
    prompt_info = f" with prompt: '{workflow.prompt[:50]}...'" if workflow.prompt else ""
    print(f"Executing workflow with {len(workflow.nodes)} nodes and {len(workflow.edges)} edges{prompt_info}")
    
    result = execute_workflow(workflow.nodes, workflow.edges, workflow.prompt)
    
    return {
        "status": "completed" if result['success'] else "failed",
        "job_id": f"job_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
        "prompt": workflow.prompt,
        **result
    }


@app.post("/workflow/validate")
async def validate_workflow_endpoint(workflow: WorkflowRequest):
    """
    Comprehensive pre-flight validation before running a workflow.
    
    Validates:
    1. Snowflake connectivity
    2. Graph structure (connected nodes, valid paths)
    3. Required nodes (data source, agent, output)
    4. Data source accessibility (table exists, permissions)
    5. Semantic model configuration
    6. Agent configuration
    7. Prompt validity
    
    Returns:
    - valid: bool - True if no blocking errors
    - errors: list - Blocking errors that prevent execution
    - warnings: list - Non-blocking issues to be aware of
    - info: list - Informational messages
    
    Each error/warning includes:
    - code: Machine-readable error code
    - message: User-friendly description
    - suggestion: How to fix the issue
    - node_id: (optional) Which node has the issue
    - details: (optional) Additional context
    """
    try:
        result = validate_flow(
            snowflake_client,
            workflow.nodes,
            workflow.edges,
            workflow.prompt
        )
        
        # Add summary for UI convenience
        node_types = {n.get('type') for n in workflow.nodes}
        result["summary"] = {
            "snowflake_connected": snowflake_client.is_snowflake_available(),
            "has_data_source": 'snowflakeSource' in node_types,
            "has_agent": 'agent' in node_types or 'cortexAgent' in node_types,
            "has_output": 'output' in node_types,
            "has_prompt": bool(workflow.prompt and workflow.prompt.strip()),
            "node_count": len(workflow.nodes),
            "edge_count": len(workflow.edges)
        }
        
        return result
        
    except Exception as e:
        # Even validation shouldn't crash - return error gracefully
        return {
            "valid": False,
            "errors": [{
                "code": "VALIDATION_ERROR",
                "severity": "error",
                "message": f"Validation failed: {str(e)[:200]}",
                "suggestion": "Try again. If the issue persists, check backend logs."
            }],
            "warnings": [],
            "info": [],
            "error_count": 1,
            "warning_count": 0
        }


class FlowGenerateRequest(BaseModel):
    prompt: str
    use_llm: bool = False  # If True, use LLM for more intelligent generation


@app.post("/flow/generate")
async def generate_flow_endpoint(request: FlowGenerateRequest):
    """
    Generate a workflow from natural language description.
    
    Example prompts:
    - "Create a retail sales analytics agent"
    - "Build a multi-agent system with supervisor for ad campaign analysis"
    - "Set up an intent router with sales and margin agents"
    
    Args:
        prompt: Natural language description of the workflow
        use_llm: If True, uses Cortex LLM for intelligent generation (slower but smarter)
                 If False, uses pattern matching (faster but more limited)
    
    Returns:
        - nodes: List of node definitions ready to render
        - edges: List of edge definitions
        - name: Suggested workflow name
        - description: Workflow description
    """
    try:
        if request.use_llm:
            # Use LLM for intelligent generation
            result = generate_flow_from_prompt(request.prompt)
        else:
            # Use quick pattern matching
            result = generate_flow_quick(request.prompt)
        
        if not result.get("success"):
            return {
                "success": False,
                "error": result.get("error", "Generation failed"),
                "raw_response": result.get("raw_response")
            }
        
        return {
            "success": True,
            "name": result["name"],
            "description": result["description"],
            "nodes": result["nodes"],
            "edges": result["edges"],
            "flow_type": result["flow_type"],
            "node_count": len(result["nodes"]),
            "edge_count": len(result["edges"])
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


class FlowEditRequest(BaseModel):
    prompt: str
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]


@app.post("/flow/edit")
async def edit_flow_endpoint(request: FlowEditRequest):
    """
    Edit an existing workflow using natural language.
    
    Example prompts:
    - "Add an inventory agent"
    - "Remove the margin agent"
    - "Change agent temperature to 0.5"
    - "Add a supervisor to orchestrate the agents"
    - "Switch agent model to mistral-large"
    
    Args:
        prompt: Natural language edit instruction
        nodes: Existing nodes in the workflow
        edges: Existing edges in the workflow
    
    Returns:
        Updated nodes and edges
    """
    try:
        result = edit_flow(request.prompt, request.nodes, request.edges)
        
        if not result.get("success"):
            return {
                "success": False,
                "error": result.get("error", "Edit failed")
            }
        
        return {
            "success": True,
            "action": result.get("action"),
            "target": result.get("target"),
            "changes": result.get("changes", []),
            "nodes": result["nodes"],
            "edges": result["edges"],
            "node_count": result["node_count"],
            "edge_count": result["edge_count"]
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


@app.get("/flow/is-edit")
async def check_if_edit(prompt: str = Query(...)):
    """
    Check if a prompt is an edit request or a new flow creation.
    
    Returns:
        is_edit: True if this should edit existing flow, False if creating new
    """
    return {
        "is_edit": is_edit_request(prompt),
        "prompt": prompt
    }


@app.post("/run/stream")
async def run_workflow_stream(workflow: WorkflowRequest):
    """Execute a workflow with real-time streaming updates"""
    async def event_generator():
        try:
            async for event in execute_workflow_streaming(workflow.nodes, workflow.edges, workflow.prompt):
                yield f"data: {json.dumps(event)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"
    
    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.post("/workflow/save")
async def save_workflow(request: SaveWorkflowRequest):
    """Save a workflow to disk"""
    filename = f"{request.name.replace(' ', '_').lower()}.json"
    filepath = os.path.join(WORKFLOWS_DIR, filename)
    
    workflow_data = {
        "name": request.name,
        "nodes": request.nodes,
        "edges": request.edges,
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat()
    }
    
    with open(filepath, 'w') as f:
        json.dump(workflow_data, f, indent=2)
    
    return {"status": "saved", "filename": filename}


@app.get("/workflow/list")
async def list_workflows():
    """List all saved workflows"""
    workflows = []
    for filename in os.listdir(WORKFLOWS_DIR):
        if filename.endswith('.json'):
            filepath = os.path.join(WORKFLOWS_DIR, filename)
            with open(filepath, 'r') as f:
                data = json.load(f)
                workflows.append({
                    "filename": filename,
                    "name": data.get("name", filename),
                    "created_at": data.get("created_at"),
                    "node_count": len(data.get("nodes", []))
                })
    return {"workflows": workflows}


@app.get("/workflow/load/{filename}")
async def load_workflow(filename: str):
    """Load a saved workflow"""
    filepath = os.path.join(WORKFLOWS_DIR, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    with open(filepath, 'r') as f:
        data = json.load(f)
    
    return data


@app.delete("/workflow/{filename}")
async def delete_workflow(filename: str):
    """Delete a saved workflow"""
    filepath = os.path.join(WORKFLOWS_DIR, filename)
    if os.path.exists(filepath):
        os.remove(filepath)
    return {"status": "deleted"}


@app.get("/snowflake/tables")
async def get_tables(database: Optional[str] = None, schema: Optional[str] = None):
    """Get list of tables from Snowflake"""
    try:
        tables = snowflake_client.get_tables(database, schema)
        return {"tables": tables}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/snowflake/views")
async def get_views(database: Optional[str] = None, schema: Optional[str] = None):
    """Get list of views from Snowflake"""
    try:
        views = snowflake_client.get_views(database, schema)
        return {"views": views}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/snowflake/columns/{table}")
async def get_columns(table: str, database: Optional[str] = None, schema: Optional[str] = None):
    """Get columns for a table"""
    try:
        columns = snowflake_client.get_columns(table, database, schema)
        return {"columns": columns}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/snowflake/preview/{table}")
async def preview_table(table: str, database: Optional[str] = None, schema: Optional[str] = None, limit: int = 100):
    """Preview data from a table"""
    try:
        df = snowflake_client.preview_table(table, database, schema, limit)
        return {"data": df.to_dict('records'), "columns": list(df.columns)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/snowflake/test")
async def test_connection():
    """Test Snowflake connection"""
    try:
        snowflake_client.connect()
        return {"status": "connected", "message": "Successfully connected to Snowflake"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Connection failed: {str(e)}")


# ============================================================
# DATA CATALOG - Real Snowflake Integration
# ============================================================

@app.get("/catalog/sources")
async def get_catalog_sources():
    """Get all data sources from Snowflake with metadata"""
    demo_sources = [
        {
            'id': 'SNOWFLOW_DEV.DEMO.SALES_DATA',
            'database': 'SNOWFLOW_DEV',
            'schema': 'DEMO',
            'name': 'SALES_DATA',
            'type': 'table',
            'rowCount': 150000,
            'status': 'ready',
            'description': 'Sales transactions data for analytics',
            'createdAt': None,
            'lastUpdated': None,
            'hasSemanticModel': True
        },
        {
            'id': 'SNOWFLOW_DEV.DEMO.CUSTOMERS',
            'database': 'SNOWFLOW_DEV',
            'schema': 'DEMO',
            'name': 'CUSTOMERS',
            'type': 'table',
            'rowCount': 50000,
            'status': 'ready',
            'description': 'Customer master data',
            'createdAt': None,
            'lastUpdated': None,
            'hasSemanticModel': False
        },
        {
            'id': 'SNOWFLOW_DEV.DEMO.PRODUCTS',
            'database': 'SNOWFLOW_DEV',
            'schema': 'DEMO',
            'name': 'PRODUCTS',
            'type': 'table',
            'rowCount': 5000,
            'status': 'ready',
            'description': 'Product catalog',
            'createdAt': None,
            'lastUpdated': None,
            'hasSemanticModel': False
        },
        {
            'id': 'SNOWFLOW_DEV.DEMO.ORDERS',
            'database': 'SNOWFLOW_DEV',
            'schema': 'DEMO',
            'name': 'ORDERS',
            'type': 'table',
            'rowCount': 200000,
            'status': 'ready',
            'description': 'Order history',
            'createdAt': None,
            'lastUpdated': None,
            'hasSemanticModel': True
        },
    ]
    try:
        # If Snowflake is unreachable (e.g. network policy / IP allowlist), return demo data so UI still works.
        if hasattr(snowflake_client, "is_snowflake_available") and not snowflake_client.is_snowflake_available():
            return {"sources": demo_sources, "demo_mode": True, "warning": "Snowflake not reachable (network policy/IP allowlist). Showing demo catalog."}

        query = """
        SELECT 
            t.TABLE_CATALOG as database_name,
            t.TABLE_SCHEMA as schema_name,
            t.TABLE_NAME as object_name,
            t.TABLE_TYPE as object_type,
            t.ROW_COUNT as row_count,
            t.CREATED as created_at,
            t.LAST_ALTERED as last_updated,
            t.COMMENT as description
        FROM INFORMATION_SCHEMA.TABLES t
        WHERE t.TABLE_SCHEMA NOT IN ('INFORMATION_SCHEMA')
        ORDER BY t.TABLE_CATALOG, t.TABLE_SCHEMA, t.TABLE_NAME
        LIMIT 50
        """
        
        result = snowflake_client.execute_sql(query)
        
        if not result or not result.get('success') or not result.get('data'):
            return {"sources": demo_sources, "demo_mode": True, "warning": "No tables found or connection issue (showing demo catalog)."}
        
        sources = []
        for row in result.get('data', []):
            status = 'ready'
            # Safe timestamp conversion
            created_at = row.get('CREATED_AT')
            last_updated = row.get('LAST_UPDATED')
            row_count = row.get('ROW_COUNT')
            
            # Handle NaN values for row_count
            import math
            safe_row_count = None
            if row_count is not None:
                try:
                    if not math.isnan(row_count):
                        safe_row_count = int(row_count)
                except (TypeError, ValueError):
                    safe_row_count = None
            
            sources.append({
                'id': f"{row.get('DATABASE_NAME', '')}.{row.get('SCHEMA_NAME', '')}.{row.get('OBJECT_NAME', '')}",
                'database': row.get('DATABASE_NAME', ''),
                'schema': row.get('SCHEMA_NAME', ''),
                'name': row.get('OBJECT_NAME', ''),
                'type': (row.get('OBJECT_TYPE', '') or '').lower().replace(' ', '_'),
                'rowCount': safe_row_count,
                'status': status,
                'description': row.get('DESCRIPTION') or '',
                'createdAt': str(created_at) if created_at is not None else None,
                'lastUpdated': str(last_updated) if last_updated is not None else None,
                'hasSemanticModel': False
            })
        
        return {"sources": sources}
    except Exception as e:
        print(f"Catalog error: {e}")
        return {"sources": demo_sources, "demo_mode": True, "warning": str(e)}


@app.get("/catalog/databases")
async def get_databases():
    """Get list of accessible databases"""
    try:
        query = "SHOW DATABASES"
        result = snowflake_client.execute_sql(query)
        if result.get('success') and result.get('data'):
            databases = [row.get('name', '') for row in result['data'] if row.get('name')]
        return {"databases": databases}
        # Fallback if no data
        return {"databases": ["SNOWFLOW_DEV", "SNOWFLOW_PROD", "DEMO_DB"]}
    except Exception as e:
        # Return fallback on error
        return {"databases": ["SNOWFLOW_DEV", "SNOWFLOW_PROD", "DEMO_DB"]}


@app.get("/catalog/schemas/{database}")
async def get_schemas(database: str):
    """Get schemas in a database"""
    try:
        query = f"SHOW SCHEMAS IN DATABASE {database}"
        result = snowflake_client.execute_sql(query)
        if result.get('success') and result.get('data'):
            schemas = [row.get('name', '') for row in result['data'] if row.get('name')]
        return {"schemas": schemas}
        # Fallback if no data
        return {"schemas": ["PUBLIC", "DEMO", "SEMANTIC_MODELS"]}
    except Exception as e:
        return {"schemas": ["PUBLIC", "DEMO", "SEMANTIC_MODELS"]}


@app.get("/catalog/stages/{database}/{schema}")
async def get_stages(database: str, schema: str):
    """Get stages in a schema"""
    try:
        query = f"SHOW STAGES IN {database}.{schema}"
        result = snowflake_client.execute_sql(query)
        if result.get('success') and result.get('data'):
            stages = [row.get('name', '') for row in result['data'] if row.get('name')]
            return {"stages": stages}
        return {"stages": ["SEMANTIC_MODELS", "CORTEX_STAGE", "DATA_STAGE"]}  # Fallback
    except Exception as e:
        return {"stages": ["SEMANTIC_MODELS", "CORTEX_STAGE", "DATA_STAGE"]}


@app.get("/catalog/objects/{database}/{schema}")
async def get_objects(database: str, schema: str, type: str = Query(default="table")):
    """Get object names in a schema, filtered by type (table/view/dynamic_table/stream)."""
    try:
        t = (type or "table").lower().strip()
        if t == "view":
            query = f"SHOW VIEWS IN SCHEMA {database}.{schema}"
        elif t == "dynamic_table":
            query = f"SHOW DYNAMIC TABLES IN SCHEMA {database}.{schema}"
        elif t == "stream":
            query = f"SHOW STREAMS IN SCHEMA {database}.{schema}"
        else:
            query = f"SHOW TABLES IN SCHEMA {database}.{schema}"

        result = snowflake_client.execute_sql(query)
        names: List[str] = []
        if result.get("success") and result.get("data"):
            for row in result.get("data", []):
                nm = row.get("name") or row.get("NAME")
                if nm:
                    names.append(str(nm))
        # stable sort for UX
        names = sorted(list(dict.fromkeys(names)), key=lambda s: s.upper())
        return {"objects": names, "type": t, "database": database, "schema": schema}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# SEMANTIC MODELS - Snowflake Stage Integration
# ============================================================

@app.get("/catalog/semantic-models")
async def get_semantic_models():
    """Get all semantic model YAML files from Snowflake stages."""
    demo_models = [
        {
            'id': 'SNOWFLOW_DEV.DEMO.SEMANTIC_MODELS/sales_model.yaml',
            'name': 'Sales Model',
            'fileName': 'sales_model.yaml',
            'database': 'SNOWFLOW_DEV',
            'schema': 'DEMO',
            'stage': 'SEMANTIC_MODELS',
            'stagePath': '@SNOWFLOW_DEV.DEMO.SEMANTIC_MODELS/sales_model.yaml',
            'size': 4096,
            'lastModified': None,
            'status': 'ready'
        },
        {
            'id': 'SNOWFLOW_DEV.DEMO.SEMANTIC_MODELS/revenue_metrics.yaml',
            'name': 'Revenue Metrics',
            'fileName': 'revenue_metrics.yaml',
            'database': 'SNOWFLOW_DEV',
            'schema': 'DEMO',
            'stage': 'SEMANTIC_MODELS',
            'stagePath': '@SNOWFLOW_DEV.DEMO.SEMANTIC_MODELS/revenue_metrics.yaml',
            'size': 2048,
            'lastModified': None,
            'status': 'ready'
        }
    ]
    try:
        if hasattr(snowflake_client, "is_snowflake_available") and not snowflake_client.is_snowflake_available():
            return {"semantic_models": demo_models, "demo_mode": True, "warning": "Snowflake not reachable (network policy/IP allowlist). Showing demo semantic models."}

        semantic_models = []
        
        stage_locations = [
            ("SNOWFLOW_PROD", "SEMANTIC_MODELS", "CORTEX_STAGE"),
            ("SNOWFLOW_DEV", "SEMANTIC_MODELS", "CORTEX_STAGE"),
            ("SNOWFLOW_PROD", "RETAIL_ANALYTICS", "SEMANTIC_MODELS"),
            ("SNOWFLOW_DEV", "DEMO", "SEMANTIC_MODELS"),
            # SnowFlow demo assets (dedicated DB install, if permitted)
            ("SNOWFLOW_DEMO", "RETAIL", "SEMANTIC_MODELS"),
            ("SNOWFLOW_DEMO", "AD_MEDIA", "SEMANTIC_MODELS"),
        ]

        # SnowFlow demo assets (fallback install into existing DB)
        env_db = os.getenv("SNOWFLAKE_DATABASE") or ""
        if env_db:
            stage_locations.extend([
                (env_db, "SNOWFLOW_RETAIL", "SEMANTIC_MODELS"),
                (env_db, "SNOWFLOW_AD_MEDIA", "SEMANTIC_MODELS"),
            ])
        
        for database, schema, stage in stage_locations:
            try:
                query = f"LIST @{database}.{schema}.{stage} PATTERN='.*\\.yaml'"
                result = snowflake_client.execute_sql(query)
                
                if result and result.get('success') and result.get('data'):
                    for row in result.get('data', []):
                        file_path = row.get('name', '')
                        file_name = file_path.split('/')[-1] if '/' in file_path else file_path
                        
                        semantic_models.append({
                            'id': f"{database}.{schema}.{stage}/{file_name}",
                            'name': file_name.replace('.yaml', '').replace('_', ' ').title(),
                            'fileName': file_name,
                            'database': database,
                            'schema': schema,
                            'stage': stage,
                            'stagePath': f"@{database}.{schema}.{stage}/{file_name}",
                            'size': row.get('size', 0),
                            'lastModified': row.get('last_modified'),
                            'status': 'ready'
                        })
            except Exception as stage_error:
                print(f"Stage {database}.{schema}.{stage} not accessible: {stage_error}")
                continue

        # If hardcoded locations returned nothing, do a bounded discovery pass so SnowFlow works in any account.
        # Strategy: look for stages with "semantic" in the name (or common stage names) and list YAMLs.
        if not semantic_models:
            try:
                stage_name_allow = set(
                    (os.getenv("SNOWFLOW_SEMANTIC_STAGE_NAMES") or "SEMANTIC_MODELS,CORTEX_STAGE").split(",")
                )
                stage_name_allow = {s.strip().upper() for s in stage_name_allow if s.strip()}

                db_limit = int(os.getenv("SNOWFLOW_SEMANTIC_DISCOVERY_DB_LIMIT") or "25")
                schema_limit = int(os.getenv("SNOWFLOW_SEMANTIC_DISCOVERY_SCHEMA_LIMIT") or "50")

                # Discover databases
                dbs_res = snowflake_client.execute_sql("SHOW DATABASES")
                dbs = []
                if dbs_res and dbs_res.get("success") and dbs_res.get("data"):
                    for row in dbs_res.get("data", []):
                        name = row.get("name") or row.get("NAME")
                        if name:
                            dbs.append(str(name))
                dbs = dbs[:db_limit]

                for db in dbs:
                    # Discover schemas
                    sch_res = snowflake_client.execute_sql(f"SHOW SCHEMAS IN DATABASE {db}")
                    schemas = []
                    if sch_res and sch_res.get("success") and sch_res.get("data"):
                        for row in sch_res.get("data", []):
                            nm = row.get("name") or row.get("NAME")
                            if nm and str(nm).upper() != "INFORMATION_SCHEMA":
                                schemas.append(str(nm))
                    schemas = schemas[:schema_limit]

                    for sch in schemas:
                        # Find candidate stages in this schema
                        st_res = snowflake_client.execute_sql(f"SHOW STAGES IN {db}.{sch}")
                        if not (st_res and st_res.get("success") and st_res.get("data")):
                            continue

                        stages = []
                        for row in st_res.get("data", []):
                            st = row.get("name") or row.get("NAME")
                            if st:
                                stages.append(str(st))

                        for st in stages:
                            st_u = st.upper()
                            if st_u not in stage_name_allow and "SEMANTIC" not in st_u:
                                continue

                            # List YAML/YML
                            for pattern in (".*\\.yaml", ".*\\.yml"):
                                try:
                                    q = f"LIST @{db}.{sch}.{st} PATTERN='{pattern}'"
                                    res = snowflake_client.execute_sql(q)
                                    if not (res and res.get("success") and res.get("data")):
                                        continue
                                    for row in res.get("data", []):
                                        file_path = row.get("name", "") or row.get("NAME", "")
                                        file_name = file_path.split("/")[-1] if "/" in file_path else file_path
                                        if not file_name:
                                            continue
                                        semantic_models.append({
                                            "id": f"{db}.{sch}.{st}/{file_name}",
                                            "name": file_name.replace(".yaml", "").replace(".yml", "").replace("_", " ").title(),
                                            "fileName": file_name,
                                            "database": db,
                                            "schema": sch,
                                            "stage": st,
                                            "stagePath": f"@{db}.{sch}.{st}/{file_name}",
                                            "size": row.get("size", 0),
                                            "lastModified": row.get("last_modified"),
                                            "status": "ready",
                                        })
                                except Exception:
                                    continue

                if semantic_models:
                    return {"semantic_models": semantic_models}
            except Exception as discovery_error:
                print(f"Semantic model discovery failed: {discovery_error}")

        return {"semantic_models": semantic_models}
    except Exception as e:
        print(f"Error fetching semantic models: {e}")
        return {"semantic_models": demo_models, "demo_mode": True}


@app.get("/catalog/semantic-models/{database}/{schema}/{stage}")
async def get_semantic_models_from_stage(database: str, schema: str, stage: str):
    """Get semantic model YAML files from a specific stage"""
    try:
        query = f"LIST @{database}.{schema}.{stage} PATTERN='.*\\.yaml'"
        result = snowflake_client.execute_sql(query)
        
        semantic_models = []
        if result and result.get('success') and result.get('data'):
            for row in result.get('data', []):
                file_path = row.get('name', '')
                file_name = file_path.split('/')[-1] if '/' in file_path else file_path
                
                semantic_models.append({
                    'id': f"{database}.{schema}.{stage}/{file_name}",
                    'name': file_name.replace('.yaml', '').replace('_', ' ').title(),
                    'fileName': file_name,
                    'database': database,
                    'schema': schema,
                    'stage': stage,
                    'stagePath': f"@{database}.{schema}.{stage}/{file_name}",
                    'size': row.get('size', 0),
                    'lastModified': row.get('last_modified'),
                    'status': 'ready'
                })
        
        return {"semantic_models": semantic_models}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# DEMO ASSETS - Programmatic installer for showcase data + semantic models
# ============================================================

@app.get("/demo-assets/status")
async def get_demo_assets_status(
    demo_database: str = "SNOWFLOW_DEMO",
    retail_schema: str = "RETAIL",
    ad_schema: str = "AD_MEDIA",
):
    try:
        return demo_assets_status(demo_database=demo_database, retail_schema=retail_schema, ad_schema=ad_schema)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/demo-assets/install")
async def install_demo_assets_endpoint(req: DemoAssetsInstallRequest):
    """
    Programmatically creates demo DB/schemas/tables/views and uploads semantic model YAMLs
    into the connected Snowflake account. Intended for showcase + repeatable testing.
    """
    try:
        return install_demo_assets(
            demo_database=req.demo_database,
            overwrite_tables=req.overwrite_tables,
            upload_yaml=req.upload_yaml,
            fallback_database=req.fallback_database,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# CUSTOM TOOLS - Snowflake Persistence
# ============================================================

class ToolRequest(BaseModel):
    id: Optional[str] = None
    name: str
    description: str
    type: str
    parameters: List[Dict[str, Any]]
    implementation: Optional[str] = None
    apiEndpoint: Optional[str] = None
    apiMethod: Optional[str] = None


@app.get("/tools")
async def get_tools():
    """Get all custom tools from Snowflake"""
    try:
        query = """
        SELECT 
            tool_id, name, description, tool_type, parameters, 
            implementation, api_endpoint, api_method, 
            created_at, created_by, is_approved
        FROM SNOWFLOW_DEV.DEMO.SNOWFLOW_TOOLS
        ORDER BY created_at DESC
        """
        result = snowflake_client.execute_sql(query)
        
        if not result or not isinstance(result, list):
            return {"tools": []}
        
        tools = []
        for row in result:
            if not isinstance(row, dict):
                continue
            tools.append({
                'id': row.get('TOOL_ID', ''),
                'name': row.get('NAME', ''),
                'description': row.get('DESCRIPTION', ''),
                'type': row.get('TOOL_TYPE', ''),
                'parameters': json.loads(row['PARAMETERS']) if row.get('PARAMETERS') else [],
                'implementation': row.get('IMPLEMENTATION'),
                'apiEndpoint': row.get('API_ENDPOINT'),
                'apiMethod': row.get('API_METHOD'),
                'createdAt': row['CREATED_AT'].isoformat() if row.get('CREATED_AT') else None,
                'createdBy': row.get('CREATED_BY'),
                'isApproved': row.get('IS_APPROVED', False)
            })
        
        return {"tools": tools}
    except Exception as e:
        print(f"Tools error: {e}")
        return {"tools": []}


@app.post("/tools")
async def save_tool(tool: ToolRequest):
    """Save a custom tool to Snowflake"""
    try:
        tool_id = tool.id or f"tool-{uuid.uuid4().hex[:8]}"
        
        query = f"""
        MERGE INTO SNOWFLOW_DEV.DEMO.SNOWFLOW_TOOLS t
        USING (SELECT '{tool_id}' as tool_id) s
        ON t.tool_id = s.tool_id
        WHEN MATCHED THEN UPDATE SET
            name = '{tool.name}',
            description = '{tool.description.replace("'", "''")}',
            tool_type = '{tool.type}',
            parameters = PARSE_JSON('{json.dumps(tool.parameters)}'),
            implementation = '{(tool.implementation or "").replace("'", "''")}',
            api_endpoint = {f"'{tool.apiEndpoint}'" if tool.apiEndpoint else 'NULL'},
            api_method = {f"'{tool.apiMethod}'" if tool.apiMethod else 'NULL'},
            updated_at = CURRENT_TIMESTAMP()
        WHEN NOT MATCHED THEN INSERT (
            tool_id, name, description, tool_type, parameters, 
            implementation, api_endpoint, api_method, created_by
        ) VALUES (
            '{tool_id}', '{tool.name}', '{tool.description.replace("'", "''")}', 
            '{tool.type}', PARSE_JSON('{json.dumps(tool.parameters)}'),
            '{(tool.implementation or "").replace("'", "''")}',
            {f"'{tool.apiEndpoint}'" if tool.apiEndpoint else 'NULL'},
            {f"'{tool.apiMethod}'" if tool.apiMethod else 'NULL'},
            CURRENT_USER()
        )
        """
        
        snowflake_client.execute_sql(query)
        log_audit('tool_saved', 'tool', tool_id, tool.name, {'type': tool.type})
        
        return {"status": "saved", "id": tool_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/tools/{tool_id}")
async def delete_tool(tool_id: str):
    """Delete a custom tool"""
    try:
        query = f"DELETE FROM SNOWFLOW_DEV.DEMO.SNOWFLOW_TOOLS WHERE tool_id = '{tool_id}'"
        snowflake_client.execute_sql(query)
        return {"status": "deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# TEMPLATES - Snowflake Persistence
# ============================================================

class TemplateRequest(BaseModel):
    id: Optional[str] = None
    name: str
    description: str
    category: Optional[str] = 'custom'
    complexity: Optional[str] = 'medium'
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]


@app.get("/templates")
async def get_templates():
    """Get all workflow templates from Snowflake"""
    try:
        query = """
        SELECT 
            template_id, name, description, category, complexity, icon,
            nodes, edges, created_at, created_by, is_public, usage_count
        FROM SNOWFLOW_DEV.DEMO.SNOWFLOW_TEMPLATES
        ORDER BY usage_count DESC, created_at DESC
        """
        result = snowflake_client.execute_sql(query)
        
        if not result or not isinstance(result, list):
            return {"templates": []}
        
        templates = []
        for row in result:
            if not isinstance(row, dict):
                continue
            templates.append({
                'id': row.get('TEMPLATE_ID', ''),
                'name': row.get('NAME', ''),
                'description': row.get('DESCRIPTION', ''),
                'category': row.get('CATEGORY', 'custom'),
                'complexity': row.get('COMPLEXITY', 'medium'),
                'icon': row.get('ICON'),
                'nodes': json.loads(row['NODES']) if isinstance(row.get('NODES'), str) else row.get('NODES', []),
                'edges': json.loads(row['EDGES']) if isinstance(row.get('EDGES'), str) else row.get('EDGES', []),
                'createdAt': row['CREATED_AT'].isoformat() if row.get('CREATED_AT') else None,
                'createdBy': row.get('CREATED_BY'),
                'isPublic': row.get('IS_PUBLIC', False),
                'usageCount': row.get('USAGE_COUNT', 0)
            })
        
        return {"templates": templates}
    except Exception as e:
        print(f"Templates error: {e}")
        return {"templates": []}


@app.post("/templates")
async def save_template(template: TemplateRequest):
    """Save current workflow as a template"""
    try:
        template_id = template.id or f"tpl-{uuid.uuid4().hex[:8]}"
        
        nodes_json = json.dumps(template.nodes).replace("'", "''")
        edges_json = json.dumps(template.edges).replace("'", "''")
        
        query = f"""
        MERGE INTO SNOWFLOW_DEV.DEMO.SNOWFLOW_TEMPLATES t
        USING (SELECT '{template_id}' as template_id) s
        ON t.template_id = s.template_id
        WHEN MATCHED THEN UPDATE SET
            name = '{template.name}',
            description = '{template.description.replace("'", "''")}',
            category = '{template.category}',
            complexity = '{template.complexity}',
            nodes = PARSE_JSON('{nodes_json}'),
            edges = PARSE_JSON('{edges_json}'),
            updated_at = CURRENT_TIMESTAMP()
        WHEN NOT MATCHED THEN INSERT (
            template_id, name, description, category, complexity, nodes, edges, created_by, is_public
        ) VALUES (
            '{template_id}', '{template.name}', '{template.description.replace("'", "''")}',
            '{template.category}', '{template.complexity}',
            PARSE_JSON('{nodes_json}'), PARSE_JSON('{edges_json}'),
            CURRENT_USER(), FALSE
        )
        """
        
        snowflake_client.execute_sql(query)
        log_audit('template_saved', 'template', template_id, template.name, {'category': template.category})
        
        return {"status": "saved", "id": template_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/templates/{template_id}/use")
async def use_template(template_id: str):
    """Track template usage"""
    try:
        query = f"""
        UPDATE SNOWFLOW_DEV.DEMO.SNOWFLOW_TEMPLATES 
        SET usage_count = usage_count + 1 
        WHERE template_id = '{template_id}'
        """
        snowflake_client.execute_sql(query)
        return {"status": "tracked"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# AUDIT LOGGING
# ============================================================

def log_audit(action_type: str, entity_type: str, entity_id: str, entity_name: str, details: dict = None):
    """Log an action to the audit table"""
    try:
        log_id = f"log-{uuid.uuid4().hex[:12]}"
        details_json = json.dumps(details or {}).replace("'", "''")
        
        query = f"""
        INSERT INTO SNOWFLOW_DEV.DEMO.SNOWFLOW_AUDIT_LOG 
        (log_id, action_type, entity_type, entity_id, entity_name, user_id, details)
        VALUES (
            '{log_id}', '{action_type}', '{entity_type}', '{entity_id}', 
            '{entity_name}', CURRENT_USER(), PARSE_JSON('{details_json}')
        )
        """
        snowflake_client.execute_sql(query)
    except Exception as e:
        print(f"Audit log error: {e}")


@app.get("/audit/logs")
async def get_audit_logs(limit: int = 100, action_type: str = None, entity_type: str = None):
    """Get audit logs from Snowflake Governance
    
    Retrieves logs from SNOWFLOW_GOVERNANCE.AUDIT_LOG table.
    Supports filtering by action_type and entity_type.
    """
    try:
        # Use governance audit log
        logs = snowflake_client.get_audit_logs(limit=limit, action_type=action_type, entity_type=entity_type)
        
        if logs:
            return {"logs": logs, "source": "snowflake_governance"}
        
        # Fallback to legacy audit log if governance logs empty
        query = f"""
        SELECT * FROM SNOWFLOW_DEV.DEMO.SNOWFLOW_AUDIT_LOG
        ORDER BY created_at DESC
        LIMIT {limit}
        """
        result = snowflake_client.execute_sql(query)
        legacy_logs = result.get('data', []) if isinstance(result, dict) else (result or [])
        return {"logs": legacy_logs, "source": "legacy"}
        
    except Exception as e:
        print(f"Audit logs error: {e}")
        return {"logs": [], "warning": str(e)}


# ═══════════════════════════════════════════════════════════════════════════════
# CONTROL TOWER API - Governance & Monitoring Layer over Snowflake Intelligence
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/control-tower/overview")
async def get_control_tower_overview():
    """Get Control Tower overview stats - fast local-first approach"""
    stats = {
        "workflows": {"total": 0, "active": 0},
        "agents": {"total": 0, "cortex": 0, "external": 0, "pending_approval": 0},
        "tools": {"total": 0, "approved": 0},
        "executions": {"today": 12, "week": 87, "success_rate": 96.5},
        "cortex_usage": {"complete_calls": 127, "analyst_calls": 43, "search_calls": 18},
    }
    
    # Count workflows (local - fast)
    try:
        workflows = os.listdir(WORKFLOWS_DIR)
        stats["workflows"]["total"] = len([f for f in workflows if f.endswith('.json')])
    except Exception as e:
        print(f"Error counting workflows: {e}")
    
    # Get agent stats from local governance (fast)
    try:
        agents = snowflake_client.get_registered_agents()
        stats["agents"]["total"] = len(agents)
        stats["agents"]["cortex"] = len([a for a in agents if a.get('type') == 'cortex'])
        stats["agents"]["external"] = len([a for a in agents if a.get('type') == 'external'])
        stats["agents"]["pending_approval"] = len([a for a in agents if a.get('status') == 'pending_approval'])
    except Exception as e:
        print(f"Error counting agents: {e}")
    
    # Get execution stats from local audit logs (fast)
    try:
        logs = snowflake_client.get_audit_logs(limit=100)
        from datetime import datetime, timedelta
        today = datetime.now().date().isoformat()
        week_ago = (datetime.now() - timedelta(days=7)).isoformat()
        
        today_count = len([l for l in logs if l.get('created_at', '').startswith(today)])
        week_count = len([l for l in logs if l.get('created_at', '') >= week_ago])
        stats["executions"]["today"] = today_count
        stats["executions"]["week"] = week_count
    except Exception as e:
        print(f"Error getting execution stats: {e}")
    
    # Skip slow Snowflake queries when unavailable (tools, cortex usage)
    # Use cached/demo values instead
    
    return stats


@app.get("/control-tower/agents")
async def get_agents_registry():
    """Get all agents from Snowflake Governance Registry
    
    Returns agents stored in SNOWFLOW_GOVERNANCE.AGENT_REGISTRY table.
    This provides a single source of truth for agent governance.
    """
    try:
        # Get agents from Snowflake governance table
        registered_agents = snowflake_client.get_registered_agents()
        
        if registered_agents:
            return {"agents": registered_agents, "total": len(registered_agents), "source": "snowflake_governance"}
        
        # Fallback: If no agents in registry, scan workflows and register them
        agents = []
        agent_count = 0
        
        # Register system agents (built-in Cortex) - these are auto-approved
        system_agents = [
            {"agent_id": "cortex_complete", "name": "Cortex Complete", "type": "cortex", "model": "mistral-large2", "workflow": "System", "tools": []},
            {"agent_id": "cortex_analyst", "name": "Cortex Analyst", "type": "cortex", "model": "analyst", "workflow": "System", "tools": ["sql_generation"]},
            {"agent_id": "cortex_search", "name": "Cortex Search", "type": "cortex", "model": "search", "workflow": "System", "tools": ["vector_search"]},
        ]
        
        for sys_agent in system_agents:
            result = snowflake_client.register_agent(
                agent_id=sys_agent["agent_id"],
                agent_name=sys_agent["name"],
                agent_type=sys_agent["type"],
                workflow_name=sys_agent["workflow"],
                model=sys_agent["model"],
                tools=sys_agent["tools"]
            )
            if result.get("success"):
                agent_count += 1
        
        # Scan workflows and register any found agents
        if os.path.exists(WORKFLOWS_DIR):
            try:
                workflow_files = os.listdir(WORKFLOWS_DIR)
                for filename in workflow_files:
                    if not filename.endswith('.json'):
                        continue
                    filepath = os.path.join(WORKFLOWS_DIR, filename)
                    try:
                        with open(filepath, 'r') as f:
                            workflow = json.load(f)

                        workflow_name = workflow.get('name', filename.replace('.json', ''))

                        for node in workflow.get('nodes', []):
                            node_type = node.get('type', '')
                            data = node.get('data', {})
                            node_id = node.get('id', '')

                            if node_type in ['agent', 'cortexAgent', 'supervisor', 'router', 'externalAgent']:
                                agent_id = f"{workflow_name}_{node_id}".replace(' ', '_').lower()
                                agent_name = data.get('label', data.get('name', 'Agent'))
                                agent_type = get_agent_type(node_type, data)

                                result = snowflake_client.register_agent(
                                    agent_id=agent_id,
                                    agent_name=agent_name,
                                    agent_type=agent_type,
                                    workflow_name=workflow_name,
                                    endpoint_url=data.get('endpoint'),
                                    model=data.get('model', 'mistral-large2'),
                                    tools=get_agent_tools(data),
                                    metadata={"node_id": node_id, "node_type": node_type}
                                )
                                if result.get("success"):
                                    agent_count += 1
                    except Exception as e:
                        print(f"Error processing workflow {filename}: {e}")
            except Exception as e:
                print(f"Error scanning workflows: {e}")
        
        # Re-fetch from registry after registration
        registered_agents = snowflake_client.get_registered_agents()
        return {"agents": registered_agents, "total": len(registered_agents), "source": "snowflake_governance", "newly_registered": agent_count}
        
    except Exception as e:
        print(f"Error in get_agents_registry: {e}")
        # Return empty list on error
        return {"agents": [], "total": 0, "error": str(e)}


def get_agent_type(node_type: str, data: dict) -> str:
    """Map node type to agent type for display"""
    type_map = {
        'agent': 'cortex',
        'cortexAgent': 'cortex',
        'supervisor': 'supervisor',
        'router': 'router',
        'externalAgent': 'external',
    }
    return type_map.get(node_type, 'cortex')


def get_agent_tools(data: dict) -> list:
    """Extract tools from agent data"""
    tools = []
    tool_config = data.get('tools', {})
    if isinstance(tool_config, dict):
        if tool_config.get('analyst'): tools.append('analyst')
        if tool_config.get('search'): tools.append('search')
        if tool_config.get('sql'): tools.append('sql')
        if tool_config.get('mcp'): tools.append('mcp')
    elif isinstance(tool_config, list):
        tools = tool_config
    return tools


@app.get("/control-tower/executions")
async def get_execution_history(limit: int = 50):
    """Get recent workflow executions"""
    executions = []
    
    try:
        # Get from audit log
        result = snowflake_client.execute_sql(f"""
        SELECT 
                log_id,
                action_type,
                entity_type,
                entity_name,
                user_id,
                details,
                created_at
            FROM SNOWFLOW_DEV.DEMO.SNOWFLOW_AUDIT_LOG
            WHERE action_type IN ('workflow_run', 'workflow_complete', 'agent_execution')
        ORDER BY created_at DESC
            LIMIT {limit}
        """)
        
        if result and result.get('data'):
            for row in result['data']:
                executions.append({
                    "id": row.get('LOG_ID', ''),
                    "type": row.get('ACTION_TYPE', ''),
                    "workflow": row.get('ENTITY_NAME', 'Unknown'),
                    "user": row.get('USER_ID', 'system'),
                    "status": "success" if 'success' in str(row.get('DETAILS', '')).lower() else "completed",
                    "timestamp": row.get('CREATED_AT', ''),
                    "details": row.get('DETAILS', ''),
                })
    except Exception as e:
        print(f"Execution history error: {e}")
        # Return demo data
        executions = [
            {"id": "exec_1", "type": "workflow_run", "workflow": "Sales Analytics", "user": "demo", "status": "success", "timestamp": datetime.now().isoformat(), "details": "Completed in 2.3s"},
            {"id": "exec_2", "type": "agent_execution", "workflow": "Customer Support Router", "user": "demo", "status": "success", "timestamp": datetime.now().isoformat(), "details": "Routed to Support Agent"},
        ]
    
    return {"executions": executions}


@app.get("/control-tower/cortex-usage")
async def get_cortex_usage():
    """Get Cortex AI usage statistics - ties into Snowflake metering"""
    usage = {
        "summary": {
            "total_calls_7d": 0,
            "total_tokens_7d": 0,
            "estimated_credits": 0,
        },
        "by_model": [],
        "by_function": [],
        "daily_trend": [],
    }
    
    try:
        # Try to get from ACCOUNT_USAGE.METERING_HISTORY
        result = snowflake_client.execute_sql("""
        SELECT 
                SERVICE_TYPE,
                SUM(CREDITS_USED) as credits
            FROM SNOWFLAKE.ACCOUNT_USAGE.METERING_HISTORY
            WHERE START_TIME >= DATEADD(day, -7, CURRENT_TIMESTAMP())
            AND SERVICE_TYPE ILIKE '%CORTEX%'
            GROUP BY SERVICE_TYPE
        """)
        
        if result and result.get('data'):
            for row in result['data']:
                usage["by_function"].append({
                    "function": row.get('SERVICE_TYPE', 'Unknown'),
                    "credits": row.get('CREDITS', 0),
                })
                usage["summary"]["estimated_credits"] += row.get('CREDITS', 0)
                
    except Exception as e:
        # ACCOUNT_USAGE may not be accessible - provide demo data
        usage = {
            "summary": {
                "total_calls_7d": 1247,
                "total_tokens_7d": 892340,
                "estimated_credits": 4.73,
            },
            "by_model": [
                {"model": "mistral-large2", "calls": 847, "tokens": 612000, "credits": 3.2},
                {"model": "llama3.1-70b", "calls": 234, "tokens": 180000, "credits": 0.95},
                {"model": "snowflake-arctic", "calls": 166, "tokens": 100340, "credits": 0.58},
            ],
            "by_function": [
                {"function": "COMPLETE", "calls": 1089, "credits": 4.1},
                {"function": "ANALYST", "calls": 98, "credits": 0.45},
                {"function": "SEARCH", "calls": 43, "credits": 0.12},
                {"function": "SUMMARIZE", "calls": 17, "credits": 0.06},
            ],
            "daily_trend": [
                {"date": "Mon", "calls": 156},
                {"date": "Tue", "calls": 203},
                {"date": "Wed", "calls": 178},
                {"date": "Thu", "calls": 245},
                {"date": "Fri", "calls": 312},
                {"date": "Sat", "calls": 89},
                {"date": "Sun", "calls": 64},
            ]
        }
    
    return usage


@app.post("/control-tower/agents/{agent_id}/approve")
async def approve_agent(agent_id: str, approved_by: str = None):
    """Approve an external agent for production use
    
    Updates the agent status in SNOWFLOW_GOVERNANCE.AGENT_REGISTRY to 'active'.
    Records approval metadata and creates an audit log entry.
    """
    result = snowflake_client.approve_agent(agent_id, approved_by)
    
    if result.get("success"):
        return {
            "status": "approved",
            "agent_id": agent_id,
            "approved_at": datetime.now().isoformat(),
            "approved_by": result.get("approved_by"),
            "message": "Agent approved and can now execute workflows"
        }
    else:
        return {
            "status": "error",
            "agent_id": agent_id,
            "error": result.get("error", "Failed to approve agent")
        }


@app.post("/control-tower/agents/{agent_id}/revoke")
async def revoke_agent(agent_id: str, revoked_by: str = None, reason: str = None):
    """Revoke an agent's approval
    
    Sets the agent status to 'revoked' in SNOWFLOW_GOVERNANCE.AGENT_REGISTRY.
    Revoked agents cannot execute in workflows.
    """
    result = snowflake_client.revoke_agent(agent_id, revoked_by, reason)
    
    if result.get("success"):
        return {
            "status": "revoked",
            "agent_id": agent_id,
            "revoked_at": datetime.now().isoformat(),
            "revoked_by": result.get("revoked_by"),
            "message": "Agent revoked and can no longer execute"
        }
    else:
        return {
            "status": "error",
            "agent_id": agent_id,
            "error": result.get("error", "Failed to revoke agent")
        }


@app.post("/control-tower/agents/register")
async def register_agent(
    agent_id: str,
    agent_name: str,
    agent_type: str,
    workflow_name: str = None,
    endpoint_url: str = None,
    model: str = None,
    tools: List[str] = None
):
    """Register a new agent in the governance registry
    
    Cortex agents are auto-approved (native Snowflake).
    External agents require approval before they can execute.
    """
    result = snowflake_client.register_agent(
        agent_id=agent_id,
        agent_name=agent_name,
        agent_type=agent_type,
        workflow_name=workflow_name,
        endpoint_url=endpoint_url,
        model=model,
        tools=tools
    )
    
    return result


@app.get("/control-tower/agents/{agent_id}/check")
async def check_agent_approval(agent_id: str):
    """Check if an agent is approved for execution
    
    Used at workflow execution time to verify agent can run.
    """
    return snowflake_client.check_agent_approved(agent_id)


@app.get("/control-tower/governance/policies")
async def get_governance_policies():
    """Get Snowflake governance policies that apply to SnowFlow"""
    policies = {
        "data_access": [],
        "masking": [],
        "row_access": [],
        "tags": [],
    }
    
    try:
        # Get masking policies
        masking_result = snowflake_client.execute_sql("""
            SELECT policy_name, policy_schema, policy_database
            FROM SNOWFLAKE.ACCOUNT_USAGE.MASKING_POLICIES
            WHERE deleted IS NULL
            LIMIT 20
        """)
        if masking_result and masking_result.get('data'):
            policies["masking"] = [{"name": r.get('POLICY_NAME'), "schema": f"{r.get('POLICY_DATABASE')}.{r.get('POLICY_SCHEMA')}"} for r in masking_result['data']]
        
        # Get row access policies
        rap_result = snowflake_client.execute_sql("""
            SELECT policy_name, policy_schema, policy_database
            FROM SNOWFLAKE.ACCOUNT_USAGE.ROW_ACCESS_POLICIES
            WHERE deleted IS NULL
            LIMIT 20
        """)
        if rap_result and rap_result.get('data'):
            policies["row_access"] = [{"name": r.get('POLICY_NAME'), "schema": f"{r.get('POLICY_DATABASE')}.{r.get('POLICY_SCHEMA')}"} for r in rap_result['data']]
            
        # Get object tags
        tags_result = snowflake_client.execute_sql("""
            SELECT tag_name, tag_schema, tag_database
            FROM SNOWFLAKE.ACCOUNT_USAGE.TAGS
            WHERE deleted IS NULL
            LIMIT 20
        """)
        if tags_result and tags_result.get('data'):
            policies["tags"] = [{"name": r.get('TAG_NAME'), "schema": f"{r.get('TAG_DATABASE')}.{r.get('TAG_SCHEMA')}"} for r in tags_result['data']]
            
    except Exception as e:
        # Provide demo policies if ACCOUNT_USAGE not accessible
        policies = {
            "data_access": [
                {"name": "SNOWFLOW_DATA_ACCESS", "description": "Controls access to SnowFlow data"},
            ],
            "masking": [
                {"name": "PII_MASK", "schema": "SNOWFLOW_DEV.DEMO", "description": "Masks PII data"},
                {"name": "EMAIL_MASK", "schema": "SNOWFLOW_DEV.DEMO", "description": "Masks email addresses"},
            ],
            "row_access": [
                {"name": "DEPARTMENT_ACCESS", "schema": "SNOWFLOW_DEV.DEMO", "description": "Row-level access by department"},
            ],
            "tags": [
                {"name": "PII", "schema": "SNOWFLOW_DEV.DEMO", "description": "Personally Identifiable Information"},
                {"name": "CONFIDENTIAL", "schema": "SNOWFLOW_DEV.DEMO", "description": "Confidential data"},
                {"name": "SEMANTIC_MODEL", "schema": "SNOWFLOW_DEV.DEMO", "description": "Cortex Semantic Model"},
            ],
        }
    
    return policies


@app.get("/control-tower/settings")
async def get_control_tower_settings():
    """Get Control Tower configuration settings - fast local-first approach"""
    # Try to load from local settings file first (fast)
    settings_file = os.path.join(GOVERNANCE_DIR, "settings.json")
    
    default_settings = {
        "agent_approval_required": True,
        "cortex_agents_auto_approved": True,
        "external_agents_allowed": True,
        "require_mfa_for_approval": False,
        "default_model": "mistral-large-2",
        "max_tokens_per_request": 4096,
        "rate_limits": {
            "requests_per_minute": 60,
            "tokens_per_minute": 100000,
        },
        "audit_retention_days": 365,
        "allowed_models": ["mistral-large-2", "llama3.1-70b", "llama3.1-8b", "snowflake-arctic"],
        "mcp_enabled": True,
        "router_enabled": True,
        "supervisor_enabled": True,
    }
    
    # Load from local file if exists
    if os.path.exists(settings_file):
        try:
            with open(settings_file, 'r') as f:
                saved_settings = json.load(f)
                # Merge saved with defaults
                default_settings.update(saved_settings)
        except Exception as e:
            print(f"Error loading settings: {e}")
    
    return default_settings


@app.post("/control-tower/settings")
async def save_control_tower_settings(request: Request):
    """Save Control Tower configuration settings to local governance storage
    
    Handles comprehensive settings including:
    - Security settings (agent approval, MFA, sessions)
    - Governance settings (audit, data protection, workflows)
    - Model settings (defaults, rate limits, allowed models)
    - Integration settings (MCP, external APIs, router, supervisor)
    """
    try:
        data = await request.json()
        
        # Save to local settings file
        settings_file = os.path.join(GOVERNANCE_DIR, "settings.json")
        os.makedirs(GOVERNANCE_DIR, exist_ok=True)
        
        # Load existing settings to merge
        existing = {}
        if os.path.exists(settings_file):
            try:
                with open(settings_file, 'r') as f:
                    existing = json.load(f)
            except:
                pass
        
        # Merge new settings with existing
        existing.update(data)
        
        with open(settings_file, 'w') as f:
            json.dump(existing, f, indent=2)
        
        # Log the settings change
        snowflake_client.log_audit_event(
            log_id=str(uuid.uuid4()),
            action_type='settings_updated',
            entity_type='governance',
            entity_id='settings',
            entity_name='SnowFlow Settings',
            status='success',
            details={
                'updated_fields': list(data.keys()),
                'settings_count': len(data)
            }
        )
        
        return {"success": True, "message": "Settings saved successfully", "fields_updated": len(data)}
    except Exception as e:
        print(f"Settings save error: {e}")
        return {"success": False, "error": str(e)}


@app.post("/control-tower/governance/init")
async def initialize_governance():
    """Initialize Snowflake Governance schema and tables
    
    Creates:
    - SNOWFLOW_GOVERNANCE schema
    - AGENT_REGISTRY table
    - AUDIT_LOG table  
    - GOVERNANCE_SETTINGS table with defaults
    """
    result = snowflake_client.ensure_governance_schema()
    return result


# Mount DAX Translation API
app.include_router(translation_router)


# =============================================================================
# CONNECTION HEALTH MONITOR - Background thread to maintain Snowflake connection
# =============================================================================

import threading
import time

class ConnectionHealthMonitor:
    """
    Background monitor that:
    1. Periodically checks Snowflake connection
    2. Retries on failure
    3. Tracks consecutive failures for frontend warning
    """
    
    def __init__(self):
        self.is_connected = False
        self.last_check_time = None
        self.consecutive_failures = 0
        self.max_failures_before_warning = 3
        self.check_interval_seconds = 30  # Check every 30 seconds
        self.retry_interval_seconds = 10  # Retry every 10 seconds on failure
        self.last_error = None
        self._running = False
        self._thread = None
    
    def start(self):
        """Start the background monitor thread"""
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._monitor_loop, daemon=True)
        self._thread.start()
        print("[CONNECTION MONITOR] Started background health monitor")
    
    def stop(self):
        """Stop the background monitor thread"""
        self._running = False
        if self._thread:
            self._thread.join(timeout=5)
        print("[CONNECTION MONITOR] Stopped background health monitor")
    
    def _monitor_loop(self):
        """Main monitoring loop"""
        while self._running:
            try:
                # Check connection
                self.is_connected = snowflake_client.is_snowflake_available(force_check=True)
                self.last_check_time = datetime.now().isoformat()
                
                if self.is_connected:
                    if self.consecutive_failures > 0:
                        print(f"[CONNECTION MONITOR] Connection restored after {self.consecutive_failures} failures")
                    self.consecutive_failures = 0
                    self.last_error = None
                    # Sleep longer when connected
                    time.sleep(self.check_interval_seconds)
                else:
                    self.consecutive_failures += 1
                    self.last_error = "Connection check failed"
                    print(f"[CONNECTION MONITOR] Connection failed (attempt {self.consecutive_failures})")
                    # Sleep shorter when failing to retry sooner
                    time.sleep(self.retry_interval_seconds)
                    
            except Exception as e:
                self.consecutive_failures += 1
                self.last_error = str(e)
                print(f"[CONNECTION MONITOR] Error: {e}")
                time.sleep(self.retry_interval_seconds)
    
    def get_status(self) -> dict:
        """Get current connection status for API"""
        return {
            "connected": self.is_connected,
            "last_check": self.last_check_time,
            "consecutive_failures": self.consecutive_failures,
            "warning": self.consecutive_failures >= self.max_failures_before_warning,
            "last_error": self.last_error,
            "troubleshooting": self._get_troubleshooting_steps() if not self.is_connected else None
        }
    
    def _get_troubleshooting_steps(self) -> list:
        """Return troubleshooting steps when connection fails"""
        return [
            "1. Check if you're connected to VPN (if required)",
            "2. Verify your IP is allowlisted in Snowflake network policy",
            "3. Check if Snowflake account is accessible: https://app.snowflake.com",
            "4. Verify credentials in backend/.env file",
            "5. Ensure private key file exists: backend/snowflake_key.p8",
            "6. Try restarting the backend server",
            "7. Check Snowflake status page: https://status.snowflake.com"
        ]

# Global instance
connection_monitor = ConnectionHealthMonitor()


@app.on_event("startup")
async def startup_event():
    """Start the connection monitor on app startup"""
    connection_monitor.start()
    # Do initial check
    try:
        snowflake_client.is_snowflake_available(force_check=True)
    except:
        pass


@app.on_event("shutdown")
async def shutdown_event():
    """Stop the connection monitor on app shutdown"""
    connection_monitor.stop()


@app.get("/connection/status")
async def get_connection_status():
    """
    Get current Snowflake connection status.
    Frontend can poll this to show warnings.
    
    Returns:
    - connected: bool - whether Snowflake is reachable
    - warning: bool - true if multiple consecutive failures
    - troubleshooting: list - steps to fix if not connected
    """
    return connection_monitor.get_status()


@app.post("/connection/retry")
async def retry_connection():
    """
    Force a connection retry.
    Resets the availability cache and attempts fresh connection.
    """
    try:
        snowflake_client.reset_availability_cache()
        is_available = snowflake_client.is_snowflake_available(force_check=True)
        connection_monitor.is_connected = is_available
        connection_monitor.last_check_time = datetime.now().isoformat()
        
        if is_available:
            connection_monitor.consecutive_failures = 0
            connection_monitor.last_error = None
            return {"success": True, "message": "Connection restored"}
        else:
            return {"success": False, "message": "Connection still unavailable", "troubleshooting": connection_monitor._get_troubleshooting_steps()}
    except Exception as e:
        return {"success": False, "message": str(e), "troubleshooting": connection_monitor._get_troubleshooting_steps()}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
