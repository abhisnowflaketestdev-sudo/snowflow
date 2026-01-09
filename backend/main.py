from fastapi import FastAPI, HTTPException
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

from graph_builder import execute_workflow, execute_workflow_streaming
from snowflake_client import snowflake_client
from api import translation_router

app = FastAPI(title="SnowFlow API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Directory for saved workflows
WORKFLOWS_DIR = "saved_workflows"
os.makedirs(WORKFLOWS_DIR, exist_ok=True)


class WorkflowRequest(BaseModel):
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]
    prompt: Optional[str] = None


class SaveWorkflowRequest(BaseModel):
    name: str
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "SnowFlow Intelligence Engine"}


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
    try:
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
        
        if not result:
            return {"sources": [], "warning": "No tables found or connection issue"}
        
        sources = []
        for row in result:
            status = 'ready'
            sources.append({
                'id': f"{row['DATABASE_NAME']}.{row['SCHEMA_NAME']}.{row['OBJECT_NAME']}",
                'database': row['DATABASE_NAME'],
                'schema': row['SCHEMA_NAME'],
                'name': row['OBJECT_NAME'],
                'type': row['OBJECT_TYPE'].lower().replace(' ', '_'),
                'rowCount': row['ROW_COUNT'],
                'status': status,
                'description': row['DESCRIPTION'] or '',
                'createdAt': row['CREATED_AT'].isoformat() if row['CREATED_AT'] else None,
                'lastUpdated': row['LAST_UPDATED'].isoformat() if row['LAST_UPDATED'] else None,
                'hasSemanticModel': False
            })
        
        return {"sources": sources}
    except Exception as e:
        print(f"Catalog error: {e}")
        return {"sources": [], "error": str(e)}


@app.get("/catalog/databases")
async def get_databases():
    """Get list of accessible databases"""
    try:
        query = "SHOW DATABASES"
        result = snowflake_client.execute_sql(query)
        if result.get('success') and result.get('data'):
            databases = [row.get('name', '') for row in result['data'] if row.get('name')]
            return {"databases": databases}
        return {"databases": ["SNOWFLOW_DEV", "SNOWFLOW_PROD", "DEMO_DB"]}  # Fallback
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
        return {"schemas": ["PUBLIC", "DEMO", "SEMANTIC_MODELS"]}  # Fallback
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


# ============================================================
# SEMANTIC MODELS - Snowflake Stage Integration
# ============================================================

@app.get("/catalog/semantic-models")
async def get_semantic_models():
    """Get all semantic model YAML files from Snowflake stages."""
    try:
        semantic_models = []
        
        stage_locations = [
            ("SNOWFLOW_PROD", "SEMANTIC_MODELS", "CORTEX_STAGE"),
            ("SNOWFLOW_DEV", "SEMANTIC_MODELS", "CORTEX_STAGE"),
            ("SNOWFLOW_PROD", "RETAIL_ANALYTICS", "SEMANTIC_MODELS"),
            ("SNOWFLOW_DEV", "DEMO", "SEMANTIC_MODELS"),
        ]
        
        for database, schema, stage in stage_locations:
            try:
                query = f"LIST @{database}.{schema}.{stage} PATTERN='.*\\.yaml'"
                result = snowflake_client.execute_sql(query)
                
                if result:
                    for row in result:
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
        
        return {"semanticModels": semantic_models}
    except Exception as e:
        print(f"Error fetching semantic models: {e}")
        return {"semanticModels": [], "error": str(e)}


@app.get("/catalog/semantic-models/{database}/{schema}/{stage}")
async def get_semantic_models_from_stage(database: str, schema: str, stage: str):
    """Get semantic model YAML files from a specific stage"""
    try:
        query = f"LIST @{database}.{schema}.{stage} PATTERN='.*\\.yaml'"
        result = snowflake_client.execute_sql(query)
        
        semantic_models = []
        if result:
            for row in result:
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
        
        return {"semanticModels": semantic_models}
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
async def get_audit_logs(limit: int = 100):
    """Get recent audit logs"""
    try:
        query = f"""
        SELECT * FROM SNOWFLOW_DEV.DEMO.SNOWFLOW_AUDIT_LOG
        ORDER BY created_at DESC
        LIMIT {limit}
        """
        result = snowflake_client.execute_sql(query)
        return {"logs": result or []}
    except Exception as e:
        print(f"Audit logs error: {e}")
        return {"logs": [], "warning": str(e)}


# Mount DAX Translation API
app.include_router(translation_router)


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
