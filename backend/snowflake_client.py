import os
import time
from dotenv import load_dotenv
import snowflake.connector
from typing import Optional, List, Dict, Any
import pandas as pd
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import serialization
import concurrent.futures

load_dotenv()

class SnowflakeClient:
    _instance: Optional['SnowflakeClient'] = None
    _conn: Optional[snowflake.connector.SnowflakeConnection] = None
    
    # Cache for Snowflake availability - avoid repeated failed connection attempts
    _snowflake_available: Optional[bool] = None
    _last_check_time: float = 0
    _check_interval: int = 300  # Re-check every 5 minutes

    # Cache for Cortex model probe results
    _cortex_models_cache: Optional[List[Dict[str, Any]]] = None
    _cortex_models_cache_time: float = 0
    _cortex_models_cache_ttl: int = 3600  # 1 hour

    # Optional runtime role override (for UI-driven role switching)
    _role_override: Optional[str] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def reset_availability_cache(self):
        """Reset the cached Snowflake availability status to force a fresh check"""
        self._snowflake_available = None
        self._last_check_time = 0
        print("Snowflake availability cache reset")

    def is_snowflake_available(self, force_check: bool = False) -> bool:
        """Fast check if Snowflake is available - uses cached result"""
        current_time = time.time()
        
        # Use cached result if within check interval (unless force_check is True)
        if not force_check and self._snowflake_available is not None and (current_time - self._last_check_time) < self._check_interval:
            return self._snowflake_available
        
        # Otherwise, do a quick check
        try:
            conn = self.connect()
            cursor = conn.cursor()
            cursor.execute("SELECT 1")
            cursor.close()
            self._snowflake_available = True
            print("Snowflake connection check: AVAILABLE")
        except Exception as e:
            print(f"Snowflake unavailable (cached for {self._check_interval}s): {str(e)[:100]}")
            self._snowflake_available = False
        
        self._last_check_time = current_time
        return self._snowflake_available

    def _get_private_key(self):
        """Load private key from file for key-pair authentication"""
        private_key_path = os.getenv('SNOWFLAKE_PRIVATE_KEY_PATH')
        if not private_key_path:
            return None
        
        # Handle relative paths
        if not os.path.isabs(private_key_path):
            private_key_path = os.path.join(os.path.dirname(__file__), private_key_path)
        
        if not os.path.exists(private_key_path):
            print(f"Private key file not found: {private_key_path}")
            return None
        
        with open(private_key_path, "rb") as key_file:
            p_key = serialization.load_pem_private_key(
                key_file.read(),
                password=None,  # No passphrase since we used -nocrypt
                backend=default_backend()
            )
        
        return p_key.private_bytes(
            encoding=serialization.Encoding.DER,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption()
        )

    def connect(self) -> snowflake.connector.SnowflakeConnection:
        if self._conn is None or self._conn.is_closed():
            private_key = self._get_private_key()
            
            connect_params = {
                'account': os.getenv('SNOWFLAKE_ACCOUNT'),
                'user': os.getenv('SNOWFLAKE_USER'),
                'warehouse': os.getenv('SNOWFLAKE_WAREHOUSE'),
                'database': os.getenv('SNOWFLAKE_DATABASE'),
                'schema': os.getenv('SNOWFLAKE_SCHEMA'),
                'role': self._role_override or os.getenv('SNOWFLAKE_ROLE'),
            }
            
            # Use key-pair auth if private key is available, otherwise fall back to password
            if private_key:
                connect_params['private_key'] = private_key
                print("Using key-pair authentication")
            else:
                connect_params['password'] = os.getenv('SNOWFLAKE_PASSWORD')
                print("Using password authentication")
            
            self._conn = snowflake.connector.connect(**connect_params)
        return self._conn

    def get_current_role(self) -> Optional[str]:
        """Return CURRENT_ROLE() for the active session (best-effort)."""
        try:
            df = self.execute_query("SELECT CURRENT_ROLE() as role")
            if df.empty:
                return None
            # Column name can vary by connector; take first value.
            return str(df.iloc[0][df.columns[0]])
        except Exception:
            return None

    def get_granted_roles(self) -> Dict[str, Any]:
        """List roles granted (USAGE) to the configured Snowflake user."""
        user = os.getenv("SNOWFLAKE_USER") or ""
        if not user:
            return {"roles": [], "error": "SNOWFLAKE_USER is not set"}

        safe_user = user.replace('"', '""')
        try:
            res = self.execute_sql(f'SHOW GRANTS TO USER "{safe_user}"')
            roles: List[str] = []
            seen = set()
            if res.get("success") and res.get("data"):
                for row in res.get("data", []):
                    if not isinstance(row, dict):
                        continue
                    if (row.get("granted_on") or "").upper() != "ROLE":
                        continue
                    if (row.get("privilege") or "").upper() != "USAGE":
                        continue
                    name = row.get("name") or row.get("role")
                    if name and name not in seen:
                        seen.add(name)
                        roles.append(str(name))
            roles.sort(key=lambda r: r.upper())
            return {"roles": roles}
        except Exception as e:
            return {"roles": [], "error": str(e)}

    def set_role(self, role: str) -> Dict[str, Any]:
        """Set role override for subsequent connections (closes existing connection)."""
        role = (role or "").strip()
        if not role:
            return {"success": False, "error": "Role is required"}

        # Close existing session so next connect uses the new role.
        try:
            self.close()
        except Exception:
            pass

        self._role_override = role
        # Force re-check availability on next call
        self._snowflake_available = None
        self._last_check_time = 0

        # Warm connection and return current role if possible
        current = self.get_current_role()
        return {"success": True, "requested_role": role, "current_role": current}

    def execute_query(self, query: str) -> pd.DataFrame:
        conn = self.connect()
        cursor = conn.cursor()
        try:
            cursor.execute(query)
            columns = [desc[0] for desc in cursor.description] if cursor.description else []
            rows = cursor.fetchall()
            return pd.DataFrame(rows, columns=columns)
        finally:
            cursor.close()

    def get_tables(self, database: str = None, schema: str = None) -> List[Dict[str, Any]]:
        db = database or os.getenv('SNOWFLAKE_DATABASE')
        sch = schema or os.getenv('SNOWFLAKE_SCHEMA')
        query = f"SHOW TABLES IN {db}.{sch}"
        df = self.execute_query(query)
        return df.to_dict('records') if not df.empty else []

    def get_views(self, database: str = None, schema: str = None) -> List[Dict[str, Any]]:
        db = database or os.getenv('SNOWFLAKE_DATABASE')
        sch = schema or os.getenv('SNOWFLAKE_SCHEMA')
        query = f"SHOW VIEWS IN {db}.{sch}"
        df = self.execute_query(query)
        return df.to_dict('records') if not df.empty else []

    def get_columns(self, table: str, database: str = None, schema: str = None) -> List[Dict[str, Any]]:
        db = database or os.getenv('SNOWFLAKE_DATABASE')
        sch = schema or os.getenv('SNOWFLAKE_SCHEMA')
        query = f"DESCRIBE TABLE {db}.{sch}.{table}"
        df = self.execute_query(query)
        return df.to_dict('records') if not df.empty else []

    def preview_table(self, table: str, database: str = None, schema: str = None, limit: int = 100) -> pd.DataFrame:
        db = database or os.getenv('SNOWFLAKE_DATABASE')
        sch = schema or os.getenv('SNOWFLAKE_SCHEMA')
        query = f"SELECT * FROM {db}.{sch}.{table} LIMIT {limit}"
        return self.execute_query(query)

    def cortex_complete(self, model: str, prompt: str, options: Dict = None, timeout: int = 60) -> str:
        """Call Snowflake Cortex COMPLETE function
        
        1:1 mapping to SNOWFLAKE.CORTEX.COMPLETE()
        Supports: model, prompt, and options (temperature, max_tokens, top_p)
        """
        import concurrent.futures
        
        # Escape single quotes in prompt
        safe_prompt = prompt.replace("'", "''")
        
        # Truncate prompt if too long (Snowflake has limits)
        if len(safe_prompt) > 50000:
            safe_prompt = safe_prompt[:50000] + "..."
        
        # Build query - use simple format for now (options can cause issues)
        query = f"""
        SELECT SNOWFLAKE.CORTEX.COMPLETE(
            '{model}',
            '{safe_prompt}'
        ) as response
        """
        
        # Execute with timeout to prevent hanging on Snowflake rate limits
        def run_query():
            df = self.execute_query(query)
            return df['RESPONSE'].iloc[0] if not df.empty else ""
        
        try:
            with concurrent.futures.ThreadPoolExecutor() as executor:
                future = executor.submit(run_query)
                return future.result(timeout=timeout)
        except concurrent.futures.TimeoutError:
            print(f"   ⚠️ Cortex call timed out after {timeout}s - returning fallback")
            return f"Analysis timed out. The {model} model was unable to respond within {timeout} seconds. This may be due to high load. Please try again."

    def list_cortex_models(self, probe: bool = False, force_refresh: bool = False, include_experimental: bool = False) -> Dict[str, Any]:
        """Return a list of known Cortex LLM models.
        
        Today, Snowflake doesn't always expose a reliable "list models" SQL in every account/role.
        We therefore provide:
        - a curated model list (static) for UX
        - an optional probe mode that attempts a tiny COMPLETE() call per model to determine availability
          (cached to avoid repeated costs).
        """
        now = time.time()
        if not force_refresh and self._cortex_models_cache and (now - self._cortex_models_cache_time) < self._cortex_models_cache_ttl:
            return {"models": self._cortex_models_cache, "source": "cache"}

        # Curated candidates (UI-safe defaults). Availability depends on account/region/entitlements.
        # Keep this list reasonably current; probing determines availability.
        candidates: List[Dict[str, str]] = [
            {"id": "mistral-large2", "label": "Mistral Large 2", "provider": "Mistral"},
            {"id": "mistral-large", "label": "Mistral Large", "provider": "Mistral"},
            {"id": "mixtral-8x7b", "label": "Mixtral 8x7B", "provider": "Mistral"},
            {"id": "mistral-7b", "label": "Mistral 7B", "provider": "Mistral"},
            {"id": "pixtral-large", "label": "Pixtral Large", "provider": "Mistral"},
            {"id": "llama3.1-405b", "label": "Llama 3.1 405B", "provider": "Meta"},
            {"id": "llama3.1-70b", "label": "Llama 3.1 70B", "provider": "Meta"},
            {"id": "llama3.1-8b", "label": "Llama 3.1 8B", "provider": "Meta"},
            {"id": "llama3.3-70b", "label": "Llama 3.3 70B", "provider": "Meta"},
            {"id": "llama3-70b", "label": "Llama 3 70B", "provider": "Meta"},
            {"id": "llama3-8b", "label": "Llama 3 8B", "provider": "Meta"},
            {"id": "llama4-maverick", "label": "Llama 4 Maverick", "provider": "Meta"},
            {"id": "llama4-scout", "label": "Llama 4 Scout", "provider": "Meta"},
            {"id": "snowflake-arctic", "label": "Snowflake Arctic", "provider": "Snowflake"},
            {"id": "snowflake-llama-3.1-405b", "label": "Snowflake Llama 3.1 405B", "provider": "Snowflake"},
            {"id": "snowflake-llama-3.3-70b", "label": "Snowflake Llama 3.3 70B", "provider": "Snowflake"},
            {"id": "reka-flash", "label": "Reka Flash", "provider": "Reka"},
            {"id": "reka-core", "label": "Reka Core", "provider": "Reka"},
            {"id": "jamba-instruct", "label": "Jamba Instruct", "provider": "AI21"},
            {"id": "jamba-1.5-mini", "label": "Jamba 1.5 Mini", "provider": "AI21"},
            {"id": "jamba-1.5-large", "label": "Jamba 1.5 Large", "provider": "AI21"},
            {"id": "gemma-7b", "label": "Gemma 7B", "provider": "Google"},
            {"id": "claude-3-5-sonnet", "label": "Claude 3.5 Sonnet", "provider": "Anthropic"},
            {"id": "claude-3-7-sonnet", "label": "Claude 3.7 Sonnet", "provider": "Anthropic"},
            {"id": "claude-4-sonnet", "label": "Claude 4 Sonnet", "provider": "Anthropic"},
            {"id": "claude-4-opus", "label": "Claude 4 Opus", "provider": "Anthropic"},
        ]

        extra: List[Dict[str, str]] = []
        if include_experimental:
            # "Cross-region" / experimental candidates: these may not be enabled in the current region/role.
            extra = [
                {"id": "deepseek-r1", "label": "DeepSeek R1", "provider": "DeepSeek"},
                {"id": "openai-gpt-4.1", "label": "OpenAI GPT-4.1", "provider": "OpenAI"},
                {"id": "openai-o4-mini", "label": "OpenAI o4-mini", "provider": "OpenAI"},
            ]

        # De-dupe by id (preserve order)
        seen_ids = set()
        combined: List[Dict[str, str]] = []
        for item in [*candidates, *extra]:
            mid = item.get("id")
            if not mid or mid in seen_ids:
                continue
            seen_ids.add(mid)
            combined.append(item)

        models: List[Dict[str, Any]] = [dict(c) for c in combined]

        if probe:
            # If Snowflake is down, probing is impossible.
            if not self.is_snowflake_available():
                for m in models:
                    m["available"] = None
                self._cortex_models_cache = models
                self._cortex_models_cache_time = now
                return {"models": models, "source": "static", "warning": "Snowflake unavailable; returning known models without probing."}

            # Probe models with small, cached, bounded-cost calls.
            probe_prompt = "ping"

            def probe_one(model_id: str) -> bool:
                # Use a very small query; invalid model names typically raise an exception.
                safe_prompt = probe_prompt.replace("'", "''")
                q = f"SELECT SNOWFLAKE.CORTEX.COMPLETE('{model_id}', '{safe_prompt}') as response"
                df = self.execute_query(q)
                return not df.empty

            results: Dict[str, bool] = {}
            with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:
                futures = {ex.submit(probe_one, m["id"]): m["id"] for m in models}
                for fut in concurrent.futures.as_completed(futures):
                    mid = futures[fut]
                    try:
                        results[mid] = bool(fut.result(timeout=20))
                    except Exception:
                        results[mid] = False

            for m in models:
                m["available"] = results.get(m["id"], False)

            self._cortex_models_cache = models
            self._cortex_models_cache_time = now
            return {"models": models, "source": "probe"}

        # Default: static list (no probing)
        for m in models:
            m["available"] = None

        self._cortex_models_cache = models
        self._cortex_models_cache_time = now
        return {"models": models, "source": "static", "warning": "Model availability varies by account/region; enable probe to verify."}

    def cortex_search(self, service_name: str, query: str, database: str = None, 
                      schema: str = None, columns: List[str] = None, limit: int = 10) -> List[Dict]:
        """Call Snowflake Cortex Search service
        
        Uses CORTEX.SEARCH_PREVIEW() for vector similarity search
        Requires a pre-created Cortex Search Service
        """
        db = database or os.getenv('SNOWFLAKE_DATABASE')
        sch = schema or os.getenv('SNOWFLAKE_SCHEMA')
        
        safe_query = query.replace("'", "''")
        cols = ", ".join(columns) if columns else "*"
        
        # Cortex Search query syntax
        search_query = f"""
        SELECT {cols}
        FROM TABLE(
            {db}.{sch}.{service_name}!SEARCH(
                QUERY => '{safe_query}',
                LIMIT => {limit}
            )
        )
        """
        try:
            df = self.execute_query(search_query)
            return df.to_dict('records') if not df.empty else []
        except Exception as e:
            # If search service doesn't exist, return helpful error
            return [{"error": f"Search service '{service_name}' not found or not accessible: {str(e)}"}]

    def cortex_analyst(self, semantic_model_path: str, question: str, warehouse: str = None) -> Dict:
        """Call Snowflake Cortex Analyst via REST API
        
        Uses the Cortex Analyst API to convert natural language to SQL
        semantic_model_path: @database.schema.stage/file.yaml
        """
        wh = warehouse or os.getenv('SNOWFLAKE_WAREHOUSE')
        safe_question = question.replace("'", "''")
        
        # Use ANALYST function (if available) or fall back to COMPLETE with context
        # Note: Cortex Analyst API may require different invocation
        try:
            # Try using the Analyst API pattern
            query = f"""
            SELECT SNOWFLAKE.CORTEX.ANALYST(
                MODEL => '{semantic_model_path}',
                QUESTION => '{safe_question}'
            ) as result
            """
            df = self.execute_query(query)
            if not df.empty:
                return {"sql": df['RESULT'].iloc[0], "success": True}
        except Exception as e:
            # Analyst API might not be available, return error info
            return {
                "error": f"Cortex Analyst not available: {str(e)}",
                "hint": "Ensure semantic model exists and Cortex Analyst is enabled",
                "success": False
            }
        
        return {"error": "No result from Analyst", "success": False}

    def execute_sql(self, sql: str) -> Dict:
        """Execute arbitrary SQL and return results
        
        Used by SQL Executor tool
        """
        try:
            df = self.execute_query(sql)
            return {
                "success": True,
                "rows": len(df),
                "columns": list(df.columns),
                "data": df.to_dict('records')[:100]  # Limit to 100 rows
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    def write_to_stage(self, content: str, database: str, schema: str, stage: str, 
                       filename: str, overwrite: bool = True) -> Dict:
        """Write content to a Snowflake stage
        
        Creates a temp file locally and PUTs it to the specified stage.
        
        Args:
            content: The content to write
            database: Target database
            schema: Target schema  
            stage: Target stage name
            filename: Name of the file to create in stage
            overwrite: Whether to overwrite existing file
        
        Returns:
            Dict with success status and details
        """
        import tempfile
        import os as local_os
        
        try:
            conn = self.connect()
            cursor = conn.cursor()
            
            # Create temp file with content
            with tempfile.NamedTemporaryFile(mode='w', suffix=f'_{filename}', delete=False) as f:
                f.write(content)
                temp_path = f.name
            
            try:
                # Build PUT command
                stage_path = f"@{database}.{schema}.{stage}"
                put_cmd = f"PUT 'file://{temp_path}' '{stage_path}/' OVERWRITE={str(overwrite).upper()} AUTO_COMPRESS=FALSE"
                
                print(f"   📤 Uploading to {stage_path}/{filename}")
                cursor.execute(put_cmd)
                result = cursor.fetchone()
                
                # Rename if needed (PUT uses temp filename)
                temp_basename = local_os.path.basename(temp_path)
                if temp_basename != filename:
                    # Copy to final name and remove temp
                    copy_cmd = f"COPY INTO @{database}.{schema}.{stage}/{filename} FROM @{database}.{schema}.{stage}/{temp_basename}"
                    try:
                        cursor.execute(copy_cmd)
                    except:
                        pass  # File may already have correct name
                
                return {
                    "success": True,
                    "stage_path": f"{stage_path}/{filename}",
                    "size": len(content),
                    "message": f"Successfully uploaded {filename} to {stage_path}"
                }
            finally:
                # Clean up temp file
                local_os.unlink(temp_path)
                cursor.close()
                
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "message": f"Failed to upload to stage: {str(e)}"
            }

    def list_stage_files(self, database: str, schema: str, stage: str, pattern: str = None) -> List[Dict]:
        """List files in a Snowflake stage
        
        Args:
            database: Database name
            schema: Schema name
            stage: Stage name
            pattern: Optional regex pattern to filter files
        
        Returns:
            List of file info dicts
        """
        try:
            query = f"LIST @{database}.{schema}.{stage}"
            if pattern:
                query += f" PATTERN='{pattern}'"
            
            df = self.execute_query(query)
            if df.empty:
                return []
            
            files = []
            for _, row in df.iterrows():
                file_info = {
                    'name': row.get('name', ''),
                    'size': row.get('size', 0),
                    'md5': row.get('md5', ''),
                    'last_modified': row.get('last_modified', '')
                }
                files.append(file_info)
            
            return files
        except Exception as e:
            print(f"   ⚠️ Error listing stage: {e}")
            return []

    def close(self):
        if self._conn and not self._conn.is_closed():
            self._conn.close()
            self._conn = None


    # ═══════════════════════════════════════════════════════════════════════════════
    # SNOWFLAKE GOVERNANCE - Agent Approval & Audit
    # Uses native Snowflake tables for enterprise governance
    # Falls back to local JSON storage when Snowflake is unavailable
    # ═══════════════════════════════════════════════════════════════════════════════

    # Local fallback storage paths
    GOVERNANCE_DIR = os.path.join(os.path.dirname(__file__), 'governance_data')
    AGENTS_FILE = os.path.join(GOVERNANCE_DIR, 'agent_registry.json')
    AUDIT_FILE = os.path.join(GOVERNANCE_DIR, 'audit_log.json')
    SETTINGS_FILE = os.path.join(GOVERNANCE_DIR, 'settings.json')

    def _ensure_local_storage(self):
        """Ensure local governance directory and files exist"""
        import json
        if not os.path.exists(self.GOVERNANCE_DIR):
            os.makedirs(self.GOVERNANCE_DIR)
        
        if not os.path.exists(self.AGENTS_FILE):
            with open(self.AGENTS_FILE, 'w') as f:
                json.dump([], f)
        
        if not os.path.exists(self.AUDIT_FILE):
            with open(self.AUDIT_FILE, 'w') as f:
                json.dump([], f)
        
        if not os.path.exists(self.SETTINGS_FILE):
            default_settings = {
                "agent_approval_required": True,
                "cortex_agents_auto_approved": True,
                "max_external_endpoints": 10,
                "audit_retention_days": 365,
                "require_mfa_for_approval": False
            }
            with open(self.SETTINGS_FILE, 'w') as f:
                json.dump(default_settings, f, indent=2)

    def _load_local_agents(self) -> List[Dict]:
        """Load agents from local JSON file"""
        import json
        self._ensure_local_storage()
        try:
            with open(self.AGENTS_FILE, 'r') as f:
                return json.load(f)
        except:
            return []

    def _save_local_agents(self, agents: List[Dict]):
        """Save agents to local JSON file"""
        import json
        self._ensure_local_storage()
        with open(self.AGENTS_FILE, 'w') as f:
            json.dump(agents, f, indent=2)

    def _load_local_audit(self) -> List[Dict]:
        """Load audit logs from local JSON file"""
        import json
        self._ensure_local_storage()
        try:
            with open(self.AUDIT_FILE, 'r') as f:
                return json.load(f)
        except:
            return []

    def _save_local_audit(self, logs: List[Dict]):
        """Save audit logs to local JSON file"""
        import json
        self._ensure_local_storage()
        with open(self.AUDIT_FILE, 'w') as f:
            json.dump(logs, f, indent=2)

    def _is_snowflake_available(self) -> bool:
        """Check if Snowflake connection is available"""
        try:
            conn = self.connect()
            cursor = conn.cursor()
            cursor.execute("SELECT 1")
            cursor.close()
            return True
        except Exception as e:
            print(f"Snowflake unavailable: {e}")
            return False

    def ensure_governance_schema(self) -> Dict:
        """Create SNOWFLOW_GOVERNANCE schema and tables if they don't exist
        
        Creates:
        - SNOWFLOW_GOVERNANCE.AGENT_REGISTRY: Tracks all agents and their approval status
        - SNOWFLOW_GOVERNANCE.AUDIT_LOG: Immutable audit trail of all actions
        - SNOWFLOW_GOVERNANCE.GOVERNANCE_SETTINGS: Configurable governance policies
        """
        # Fast path: if Snowflake unavailable, use local storage immediately
        if not self.is_snowflake_available():
            self._ensure_local_storage()
            return {"success": True, "message": "Using local governance storage", "storage": "local"}
        
        db = os.getenv('SNOWFLAKE_DATABASE', 'SNOWFLOW_DEV')
        
        try:
            conn = self.connect()
            cursor = conn.cursor()
            
            # Create governance schema
            cursor.execute(f"CREATE SCHEMA IF NOT EXISTS {db}.SNOWFLOW_GOVERNANCE")
            
            # Agent Registry table - tracks all agents across workflows
            cursor.execute(f"""
                CREATE TABLE IF NOT EXISTS {db}.SNOWFLOW_GOVERNANCE.AGENT_REGISTRY (
                    agent_id VARCHAR(100) PRIMARY KEY,
                    agent_name VARCHAR(255) NOT NULL,
                    agent_type VARCHAR(50) NOT NULL,  -- 'cortex', 'external', 'supervisor'
                    workflow_name VARCHAR(255),
                    endpoint_url VARCHAR(1000),
                    model VARCHAR(100),
                    tools ARRAY,
                    status VARCHAR(50) DEFAULT 'pending_approval',  -- 'pending_approval', 'active', 'disabled', 'revoked'
                    risk_level VARCHAR(20) DEFAULT 'medium',  -- 'low', 'medium', 'high', 'critical'
                    created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
                    created_by VARCHAR(255) DEFAULT CURRENT_USER(),
                    approved_at TIMESTAMP_NTZ,
                    approved_by VARCHAR(255),
                    revoked_at TIMESTAMP_NTZ,
                    revoked_by VARCHAR(255),
                    last_execution TIMESTAMP_NTZ,
                    execution_count INTEGER DEFAULT 0,
                    metadata VARIANT
                )
            """)
            
            # Audit Log table - immutable record of all governance events
            cursor.execute(f"""
                CREATE TABLE IF NOT EXISTS {db}.SNOWFLOW_GOVERNANCE.AUDIT_LOG (
                    log_id VARCHAR(100) PRIMARY KEY,
                    action_type VARCHAR(100) NOT NULL,  -- 'agent_registered', 'agent_approved', 'agent_revoked', 'workflow_executed', 'access_denied'
                    entity_type VARCHAR(50),  -- 'agent', 'workflow', 'tool'
                    entity_id VARCHAR(100),
                    entity_name VARCHAR(255),
                    actor VARCHAR(255) DEFAULT CURRENT_USER(),
                    actor_role VARCHAR(255) DEFAULT CURRENT_ROLE(),
                    status VARCHAR(50),  -- 'success', 'denied', 'error'
                    details VARIANT,
                    ip_address VARCHAR(50),
                    session_id VARCHAR(100),
                    created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
                )
            """)
            
            # Governance Settings table - configurable policies
            cursor.execute(f"""
                CREATE TABLE IF NOT EXISTS {db}.SNOWFLOW_GOVERNANCE.GOVERNANCE_SETTINGS (
                    setting_key VARCHAR(100) PRIMARY KEY,
                    setting_value VARIANT,
                    description VARCHAR(500),
                    updated_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
                    updated_by VARCHAR(255) DEFAULT CURRENT_USER()
                )
            """)
            
            # Insert default settings if not exists
            default_settings = [
                ("agent_approval_required", "true", "Require admin approval for external agents"),
                ("cortex_agents_auto_approved", "true", "Auto-approve Cortex (native Snowflake) agents"),
                ("max_external_endpoints", "10", "Maximum number of external agent endpoints allowed"),
                ("audit_retention_days", "365", "Days to retain audit logs"),
                ("require_mfa_for_approval", "false", "Require MFA for agent approvals"),
            ]
            
            for key, value, desc in default_settings:
                cursor.execute(f"""
                    MERGE INTO {db}.SNOWFLOW_GOVERNANCE.GOVERNANCE_SETTINGS t
                    USING (SELECT '{key}' as setting_key) s
                    ON t.setting_key = s.setting_key
                    WHEN NOT MATCHED THEN
                        INSERT (setting_key, setting_value, description)
                        VALUES ('{key}', PARSE_JSON('"{value}"'), '{desc}')
                """)
            
            cursor.close()
            return {"success": True, "message": "Governance schema initialized"}
            
        except Exception as e:
            # Fallback to local storage
            self._ensure_local_storage()
            return {"success": True, "message": "Using local governance storage (Snowflake unavailable)", "storage": "local"}

    def _register_agent_local(self, agent_id: str, agent_name: str, agent_type: str,
                               status: str, risk_level: str, workflow_name: str = None,
                               endpoint_url: str = None, model: str = None,
                               tools: List[str] = None, metadata: Dict = None) -> Dict:
        """Register agent in local storage (fast path when Snowflake unavailable)"""
        import uuid
        from datetime import datetime
        
        agents = self._load_local_agents()
        existing = next((a for a in agents if a.get('id') == agent_id), None)
        now = datetime.now().isoformat()
        
        if existing:
            existing.update({
                'name': agent_name, 'workflow': workflow_name, 'endpoint': endpoint_url,
                'model': model, 'tools': tools or [], 'metadata': metadata or {}
            })
        else:
            agents.append({
                'id': agent_id, 'name': agent_name, 'type': agent_type,
                'workflow': workflow_name, 'endpoint': endpoint_url, 'model': model,
                'tools': tools or [], 'status': status, 'risk_level': risk_level,
                'is_approved': status == 'active', 'created_at': now, 'created_by': 'LOCAL_USER',
                'approved_at': now if status == 'active' else None,
                'approved_by': 'AUTO' if status == 'active' else None,
                'execution_count': 0, 'metadata': metadata or {}
            })
        
        self._save_local_agents(agents)
        self.log_audit_event(log_id=str(uuid.uuid4()), action_type='agent_registered',
            entity_type='agent', entity_id=agent_id, entity_name=agent_name,
            status='success', details={'agent_type': agent_type, 'initial_status': status, 'storage': 'local'})
        
        return {"success": True, "agent_id": agent_id, "status": status,
                "message": f"Agent registered locally", "storage": "local"}

    def register_agent(self, agent_id: str, agent_name: str, agent_type: str, 
                       workflow_name: str = None, endpoint_url: str = None,
                       model: str = None, tools: List[str] = None,
                       metadata: Dict = None) -> Dict:
        """Register an agent in the governance registry
        
        Cortex agents are auto-approved, external agents require approval.
        Falls back to local JSON storage if Snowflake unavailable.
        """
        import json
        import uuid
        from datetime import datetime
        
        # Determine initial status and risk level
        if agent_type == 'cortex':
            status = 'active'  # Cortex agents are trusted (native Snowflake)
            risk_level = 'low'
        elif agent_type == 'external':
            status = 'pending_approval'  # External agents need approval
            risk_level = 'high' if endpoint_url else 'medium'
        else:
            status = 'pending_approval'
            risk_level = 'medium'
        
        # Fast path: skip Snowflake if unavailable
        if not self.is_snowflake_available():
            return self._register_agent_local(agent_id, agent_name, agent_type, status, risk_level,
                                              workflow_name, endpoint_url, model, tools, metadata)
        
        # Try Snowflake
        db = os.getenv('SNOWFLAKE_DATABASE', 'SNOWFLOW_DEV')
        try:
            conn = self.connect()
            cursor = conn.cursor()
            self.ensure_governance_schema()
            
            tools_json = json.dumps(tools or [])
            metadata_json = json.dumps(metadata or {})
            safe_name = agent_name.replace("'", "''")
            safe_workflow = (workflow_name or '').replace("'", "''")
            safe_endpoint = (endpoint_url or '').replace("'", "''")
            safe_model = (model or '').replace("'", "''")
            
            cursor.execute(f"""
                MERGE INTO {db}.SNOWFLOW_GOVERNANCE.AGENT_REGISTRY t
                USING (SELECT '{agent_id}' as agent_id) s
                ON t.agent_id = s.agent_id
                WHEN MATCHED THEN
                    UPDATE SET 
                        agent_name = '{safe_name}',
                        workflow_name = '{safe_workflow}',
                        endpoint_url = NULLIF('{safe_endpoint}', ''),
                        model = NULLIF('{safe_model}', ''),
                        tools = PARSE_JSON('{tools_json}'),
                        metadata = PARSE_JSON('{metadata_json}')
                WHEN NOT MATCHED THEN
                    INSERT (agent_id, agent_name, agent_type, workflow_name, endpoint_url, 
                            model, tools, status, risk_level, metadata)
                    VALUES ('{agent_id}', '{safe_name}', '{agent_type}', '{safe_workflow}',
                            NULLIF('{safe_endpoint}', ''), NULLIF('{safe_model}', ''),
                            PARSE_JSON('{tools_json}'), '{status}', '{risk_level}',
                            PARSE_JSON('{metadata_json}'))
            """)
            
            log_id = str(uuid.uuid4())
            self.log_audit_event(log_id=log_id, action_type='agent_registered',
                entity_type='agent', entity_id=agent_id, entity_name=agent_name,
                status='success', details={'agent_type': agent_type, 'initial_status': status})
            
            cursor.close()
            return {"success": True, "agent_id": agent_id, "status": status, 
                    "message": f"Agent registered with status: {status}", "storage": "snowflake"}
            
        except Exception as e:
            # LOCAL FALLBACK
            print(f"Using local storage for agent registration: {e}")
            agents = self._load_local_agents()
            
            # Check if agent exists
            existing = next((a for a in agents if a.get('id') == agent_id), None)
            now = datetime.now().isoformat()
            
            if existing:
                # Update existing
                existing.update({
                    'name': agent_name,
                    'workflow': workflow_name,
                    'endpoint': endpoint_url,
                    'model': model,
                    'tools': tools or [],
                    'metadata': metadata or {}
                })
            else:
                # Add new
                agents.append({
                    'id': agent_id,
                    'name': agent_name,
                    'type': agent_type,
                    'workflow': workflow_name,
                    'endpoint': endpoint_url,
                    'model': model,
                    'tools': tools or [],
                    'status': status,
                    'risk_level': risk_level,
                    'is_approved': status == 'active',
                    'created_at': now,
                    'created_by': 'LOCAL_USER',
                    'approved_at': now if status == 'active' else None,
                    'approved_by': 'AUTO' if status == 'active' else None,
                    'execution_count': 0,
                    'metadata': metadata or {}
                })
            
            self._save_local_agents(agents)
            self.log_audit_event(log_id=str(uuid.uuid4()), action_type='agent_registered',
                entity_type='agent', entity_id=agent_id, entity_name=agent_name,
                status='success', details={'agent_type': agent_type, 'initial_status': status, 'storage': 'local'})
            
            return {"success": True, "agent_id": agent_id, "status": status,
                    "message": f"Agent registered locally with status: {status}", "storage": "local"}

    def approve_agent(self, agent_id: str, approved_by: str = None) -> Dict:
        """Approve an agent for execution
        
        Updates status to 'active' and records approval metadata.
        """
        import uuid
        from datetime import datetime
        
        approver = approved_by or 'SYSTEM'
        
        # Fast path: use local storage if Snowflake unavailable
        if not self.is_snowflake_available():
            agents = self._load_local_agents()
            agent = next((a for a in agents if a.get('id') == agent_id), None)
            if not agent:
                return {"success": False, "error": "Agent not found"}
            if agent.get('status') == 'active':
                return {"success": True, "message": "Agent already approved", "status": "active"}
            
            now = datetime.now().isoformat()
            agent['status'] = 'active'
            agent['is_approved'] = True
            agent['approved_at'] = now
            agent['approved_by'] = approver
            self._save_local_agents(agents)
            self.log_audit_event(log_id=str(uuid.uuid4()), action_type='agent_approved',
                entity_type='agent', entity_id=agent_id, entity_name=agent.get('name'),
                status='success', details={'approved_by': approver, 'storage': 'local'})
            return {"success": True, "agent_id": agent_id, "status": "active",
                    "approved_by": approver, "approved_at": now, "storage": "local"}
        
        db = os.getenv('SNOWFLAKE_DATABASE', 'SNOWFLOW_DEV')
        
        try:
            conn = self.connect()
            cursor = conn.cursor()
            
            # Get current agent info
            cursor.execute(f"""
                SELECT agent_name, agent_type, status 
                FROM {db}.SNOWFLOW_GOVERNANCE.AGENT_REGISTRY 
                WHERE agent_id = '{agent_id}'
            """)
            row = cursor.fetchone()
            
            if not row:
                return {"success": False, "error": "Agent not found"}
            
            agent_name, agent_type, current_status = row
            
            if current_status == 'active':
                return {"success": True, "message": "Agent already approved", "status": "active"}
            
            # Update to approved
            cursor.execute(f"""
                UPDATE {db}.SNOWFLOW_GOVERNANCE.AGENT_REGISTRY
                SET status = 'active',
                    approved_at = CURRENT_TIMESTAMP(),
                    approved_by = '{approver}'
                WHERE agent_id = '{agent_id}'
            """)
            
            # Log approval
            self.log_audit_event(
                log_id=str(uuid.uuid4()),
                action_type='agent_approved',
                entity_type='agent',
                entity_id=agent_id,
                entity_name=agent_name,
                status='success',
                details={'approved_by': approver, 'previous_status': current_status}
            )
            
            cursor.close()
            return {
                "success": True,
                "agent_id": agent_id,
                "status": "active",
                "approved_by": approver,
                "approved_at": "now",
                "storage": "snowflake"
            }
            
        except Exception as e:
            # LOCAL FALLBACK
            print(f"Using local storage for agent approval: {e}")
            from datetime import datetime
            agents = self._load_local_agents()
            
            agent = next((a for a in agents if a.get('id') == agent_id), None)
            if not agent:
                return {"success": False, "error": "Agent not found"}
            
            if agent.get('status') == 'active':
                return {"success": True, "message": "Agent already approved", "status": "active"}
            
            now = datetime.now().isoformat()
            agent['status'] = 'active'
            agent['is_approved'] = True
            agent['approved_at'] = now
            agent['approved_by'] = approver
            
            self._save_local_agents(agents)
            self.log_audit_event(log_id=str(uuid.uuid4()), action_type='agent_approved',
                entity_type='agent', entity_id=agent_id, entity_name=agent.get('name'),
                status='success', details={'approved_by': approver, 'storage': 'local'})
            
            return {
                "success": True,
                "agent_id": agent_id,
                "status": "active",
                "approved_by": approver,
                "approved_at": now,
                "storage": "local"
            }

    def revoke_agent(self, agent_id: str, revoked_by: str = None, reason: str = None) -> Dict:
        """Revoke an agent's approval
        
        Sets status to 'revoked' - agent can no longer execute.
        """
        import uuid
        from datetime import datetime
        
        revoker = revoked_by or 'SYSTEM'
        
        # Fast path: use local storage if Snowflake unavailable
        if not self.is_snowflake_available():
            agents = self._load_local_agents()
            agent = next((a for a in agents if a.get('id') == agent_id), None)
            if not agent:
                return {"success": False, "error": "Agent not found"}
            
            now = datetime.now().isoformat()
            agent['status'] = 'revoked'
            agent['is_approved'] = False
            agent['revoked_at'] = now
            agent['revoked_by'] = revoker
            self._save_local_agents(agents)
            self.log_audit_event(log_id=str(uuid.uuid4()), action_type='agent_revoked',
                entity_type='agent', entity_id=agent_id, entity_name=agent.get('name'),
                status='success', details={'revoked_by': revoker, 'reason': reason, 'storage': 'local'})
            return {"success": True, "agent_id": agent_id, "status": "revoked",
                    "revoked_by": revoker, "storage": "local"}
        
        db = os.getenv('SNOWFLAKE_DATABASE', 'SNOWFLOW_DEV')
        
        try:
            conn = self.connect()
            cursor = conn.cursor()
            
            # Get current agent info
            cursor.execute(f"""
                SELECT agent_name, status 
                FROM {db}.SNOWFLOW_GOVERNANCE.AGENT_REGISTRY 
                WHERE agent_id = '{agent_id}'
            """)
            row = cursor.fetchone()
            
            if not row:
                return {"success": False, "error": "Agent not found"}
            
            agent_name, current_status = row
            
            # Update to revoked
            cursor.execute(f"""
                UPDATE {db}.SNOWFLOW_GOVERNANCE.AGENT_REGISTRY
                SET status = 'revoked',
                    revoked_at = CURRENT_TIMESTAMP(),
                    revoked_by = '{revoker}'
                WHERE agent_id = '{agent_id}'
            """)
            
            # Log revocation
            self.log_audit_event(
                log_id=str(uuid.uuid4()),
                action_type='agent_revoked',
                entity_type='agent',
                entity_id=agent_id,
                entity_name=agent_name,
                status='success',
                details={'revoked_by': revoker, 'reason': reason, 'previous_status': current_status}
            )
            
            cursor.close()
            return {
                "success": True,
                "agent_id": agent_id,
                "status": "revoked",
                "revoked_by": revoker,
                "storage": "snowflake"
            }
            
        except Exception as e:
            # LOCAL FALLBACK
            print(f"Using local storage for agent revocation: {e}")
            from datetime import datetime
            agents = self._load_local_agents()
            
            agent = next((a for a in agents if a.get('id') == agent_id), None)
            if not agent:
                return {"success": False, "error": "Agent not found"}
            
            now = datetime.now().isoformat()
            agent['status'] = 'revoked'
            agent['is_approved'] = False
            agent['revoked_at'] = now
            agent['revoked_by'] = revoker
            
            self._save_local_agents(agents)
            self.log_audit_event(log_id=str(uuid.uuid4()), action_type='agent_revoked',
                entity_type='agent', entity_id=agent_id, entity_name=agent.get('name'),
                status='success', details={'revoked_by': revoker, 'reason': reason, 'storage': 'local'})
            
            return {
                "success": True,
                "agent_id": agent_id,
                "status": "revoked",
                "revoked_by": revoker,
                "storage": "local"
            }

    def check_agent_approved(self, agent_id: str) -> Dict:
        """Check if an agent is approved for execution
        
        Returns approval status and details. Used at execution time.
        """
        # Fast path: use local storage if Snowflake unavailable
        if not self.is_snowflake_available():
            agents = self._load_local_agents()
            agent = next((a for a in agents if a.get('id') == agent_id), None)
            if not agent:
                return {"approved": False, "registered": False, "status": "unregistered",
                        "message": "Agent not found", "storage": "local"}
            return {
                "approved": agent.get('status') == 'active',
                "registered": True, "status": agent.get('status'),
                "agent_name": agent.get('name'), "agent_type": agent.get('type'),
                "approved_by": agent.get('approved_by'), "approved_at": agent.get('approved_at'),
                "message": f"Agent status: {agent.get('status')}", "storage": "local"
            }
        
        db = os.getenv('SNOWFLAKE_DATABASE', 'SNOWFLOW_DEV')
        
        try:
            conn = self.connect()
            cursor = conn.cursor()
            
            cursor.execute(f"""
                SELECT agent_name, agent_type, status, approved_by, approved_at
                FROM {db}.SNOWFLOW_GOVERNANCE.AGENT_REGISTRY 
                WHERE agent_id = '{agent_id}'
            """)
            row = cursor.fetchone()
            cursor.close()
            
            if not row:
                # Agent not registered - may need registration
                return {
                    "approved": False,
                    "registered": False,
                    "status": "unregistered",
                    "message": "Agent not found in registry"
                }
            
            agent_name, agent_type, status, approved_by, approved_at = row
            
            return {
                "approved": status == 'active',
                "registered": True,
                "status": status,
                "agent_name": agent_name,
                "agent_type": agent_type,
                "approved_by": approved_by,
                "approved_at": str(approved_at) if approved_at else None,
                "message": f"Agent status: {status}"
            }
            
        except Exception as e:
            # LOCAL FALLBACK - check local storage instead of failing
            print(f"Using local storage for approval check: {e}")
            agents = self._load_local_agents()
            agent = next((a for a in agents if a.get('id') == agent_id), None)
            
            if not agent:
                return {
                    "approved": False,
                    "registered": False,
                    "status": "unregistered",
                    "message": "Agent not found in local registry"
                }
            
            return {
                "approved": agent.get('status') == 'active',
                "registered": True,
                "status": agent.get('status'),
                "agent_name": agent.get('name'),
                "agent_type": agent.get('type'),
                "approved_by": agent.get('approved_by'),
                "approved_at": agent.get('approved_at'),
                "message": f"Agent status: {agent.get('status')} (local)",
                "storage": "local"
            }

    def get_registered_agents(self) -> List[Dict]:
        """Get all registered agents from the governance registry"""
        # Fast path: use local storage if Snowflake unavailable
        if not self.is_snowflake_available():
            return self._load_local_agents()
        
        db = os.getenv('SNOWFLAKE_DATABASE', 'SNOWFLOW_DEV')
        
        try:
            self.ensure_governance_schema()
            
            query = f"""
                SELECT 
                    agent_id, agent_name, agent_type, workflow_name,
                    endpoint_url, model, tools, status, risk_level,
                    created_at, created_by, approved_at, approved_by,
                    revoked_at, revoked_by, last_execution, execution_count
                FROM {db}.SNOWFLOW_GOVERNANCE.AGENT_REGISTRY
                ORDER BY created_at DESC
            """
            df = self.execute_query(query)
            
            if df.empty:
                return []
            
            agents = []
            for _, row in df.iterrows():
                agents.append({
                    'id': row.get('AGENT_ID'),
                    'name': row.get('AGENT_NAME'),
                    'type': row.get('AGENT_TYPE'),
                    'workflow': row.get('WORKFLOW_NAME'),
                    'endpoint': row.get('ENDPOINT_URL'),
                    'model': row.get('MODEL'),
                    'tools': row.get('TOOLS') or [],
                    'status': row.get('STATUS'),
                    'risk_level': row.get('RISK_LEVEL'),
                    'created_at': str(row.get('CREATED_AT')) if row.get('CREATED_AT') else None,
                    'created_by': row.get('CREATED_BY'),
                    'approved_at': str(row.get('APPROVED_AT')) if row.get('APPROVED_AT') else None,
                    'approved_by': row.get('APPROVED_BY'),
                    'execution_count': row.get('EXECUTION_COUNT', 0),
                    'is_approved': row.get('STATUS') == 'active'
                })
            
            return agents
            
        except Exception as e:
            # LOCAL FALLBACK
            print(f"Using local agent storage: {e}")
            return self._load_local_agents()

    def log_audit_event(self, log_id: str, action_type: str, entity_type: str = None,
                        entity_id: str = None, entity_name: str = None,
                        status: str = 'success', details: Dict = None) -> Dict:
        """Log an event to the audit trail
        
        Creates an immutable record in SNOWFLOW_GOVERNANCE.AUDIT_LOG
        Falls back to local JSON storage if Snowflake unavailable.
        """
        from datetime import datetime
        
        # Fast path: use local storage if Snowflake unavailable
        if not self.is_snowflake_available():
            logs = self._load_local_audit()
            logs.append({
                'log_id': log_id, 'action_type': action_type, 'entity_type': entity_type,
                'entity_id': entity_id, 'entity_name': entity_name, 'actor': 'LOCAL_USER',
                'actor_role': 'ADMIN', 'status': status, 'details': details or {},
                'created_at': datetime.now().isoformat()
            })
            if len(logs) > 1000:
                logs = logs[-1000:]
            self._save_local_audit(logs)
            return {"success": True, "log_id": log_id, "storage": "local"}
        
        import json
        db = os.getenv('SNOWFLAKE_DATABASE', 'SNOWFLOW_DEV')
        details_json = json.dumps(details or {})
        safe_name = (entity_name or '').replace("'", "''")
        
        try:
            conn = self.connect()
            cursor = conn.cursor()
            
            cursor.execute(f"""
                INSERT INTO {db}.SNOWFLOW_GOVERNANCE.AUDIT_LOG 
                (log_id, action_type, entity_type, entity_id, entity_name, status, details)
                VALUES ('{log_id}', '{action_type}', '{entity_type or ''}', 
                        '{entity_id or ''}', '{safe_name}', '{status}',
                        PARSE_JSON('{details_json}'))
            """)
            
            cursor.close()
            return {"success": True, "log_id": log_id, "storage": "snowflake"}
            
        except Exception as e:
            # LOCAL FALLBACK
            logs = self._load_local_audit()
            logs.append({
                'log_id': log_id,
                'action_type': action_type,
                'entity_type': entity_type,
                'entity_id': entity_id,
                'entity_name': entity_name,
                'actor': 'LOCAL_USER',
                'actor_role': 'ADMIN',
                'status': status,
                'details': details or {},
                'created_at': datetime.now().isoformat()
            })
            # Keep only last 1000 logs
            if len(logs) > 1000:
                logs = logs[-1000:]
            self._save_local_audit(logs)
            return {"success": True, "log_id": log_id, "storage": "local"}

    def get_audit_logs(self, limit: int = 100, action_type: str = None, 
                       entity_type: str = None) -> List[Dict]:
        """Get audit logs with optional filtering"""
        # Fast path: use local storage if Snowflake unavailable
        if not self.is_snowflake_available():
            logs = self._load_local_audit()
            if action_type:
                logs = [l for l in logs if l.get('action_type') == action_type]
            if entity_type:
                logs = [l for l in logs if l.get('entity_type') == entity_type]
            return sorted(logs, key=lambda x: x.get('created_at', ''), reverse=True)[:limit]
        
        db = os.getenv('SNOWFLAKE_DATABASE', 'SNOWFLOW_DEV')
        
        try:
            self.ensure_governance_schema()
            
            query = f"""
                SELECT log_id, action_type, entity_type, entity_id, entity_name,
                       actor, actor_role, status, details, created_at
                FROM {db}.SNOWFLOW_GOVERNANCE.AUDIT_LOG
                WHERE 1=1
            """
            
            if action_type:
                query += f" AND action_type = '{action_type}'"
            if entity_type:
                query += f" AND entity_type = '{entity_type}'"
            
            query += f" ORDER BY created_at DESC LIMIT {limit}"
            
            df = self.execute_query(query)
            
            if df.empty:
                return []
            
            logs = []
            for _, row in df.iterrows():
                logs.append({
                    'log_id': row.get('LOG_ID'),
                    'action_type': row.get('ACTION_TYPE'),
                    'entity_type': row.get('ENTITY_TYPE'),
                    'entity_id': row.get('ENTITY_ID'),
                    'entity_name': row.get('ENTITY_NAME'),
                    'actor': row.get('ACTOR'),
                    'actor_role': row.get('ACTOR_ROLE'),
                    'status': row.get('STATUS'),
                    'details': row.get('DETAILS'),
                    'created_at': str(row.get('CREATED_AT')) if row.get('CREATED_AT') else None
                })
            
            return logs
            
        except Exception as e:
            # LOCAL FALLBACK
            print(f"Using local audit logs: {e}")
            logs = self._load_local_audit()
            
            # Apply filters
            if action_type:
                logs = [l for l in logs if l.get('action_type') == action_type]
            if entity_type:
                logs = [l for l in logs if l.get('entity_type') == entity_type]
            
            # Sort by created_at descending and limit
            logs = sorted(logs, key=lambda x: x.get('created_at', ''), reverse=True)[:limit]
            return logs

    def get_governance_settings(self) -> Dict:
        """Get all governance settings"""
        import json
        db = os.getenv('SNOWFLAKE_DATABASE', 'SNOWFLOW_DEV')
        
        try:
            self.ensure_governance_schema()
            
            query = f"""
                SELECT setting_key, setting_value, description
                FROM {db}.SNOWFLOW_GOVERNANCE.GOVERNANCE_SETTINGS
            """
            df = self.execute_query(query)
            
            settings = {}
            for _, row in df.iterrows():
                key = row.get('SETTING_KEY')
                value = row.get('SETTING_VALUE')
                # Parse JSON string values
                if isinstance(value, str):
                    if value.lower() == 'true':
                        value = True
                    elif value.lower() == 'false':
                        value = False
                    elif value.isdigit():
                        value = int(value)
                settings[key] = value
            
            return settings
            
        except Exception as e:
            # LOCAL FALLBACK
            print(f"Using local governance settings: {e}")
            self._ensure_local_storage()
            try:
                with open(self.SETTINGS_FILE, 'r') as f:
                    return json.load(f)
            except:
                return {
                    "agent_approval_required": True,
                    "cortex_agents_auto_approved": True,
                    "max_external_endpoints": 10,
                    "audit_retention_days": 365
                }

    def update_agent_execution(self, agent_id: str) -> Dict:
        """Update agent's last execution time and increment counter"""
        from datetime import datetime
        db = os.getenv('SNOWFLAKE_DATABASE', 'SNOWFLOW_DEV')
        
        try:
            conn = self.connect()
            cursor = conn.cursor()
            
            cursor.execute(f"""
                UPDATE {db}.SNOWFLOW_GOVERNANCE.AGENT_REGISTRY
                SET last_execution = CURRENT_TIMESTAMP(),
                    execution_count = execution_count + 1
                WHERE agent_id = '{agent_id}'
            """)
            
            cursor.close()
            return {"success": True, "storage": "snowflake"}
            
        except Exception as e:
            # LOCAL FALLBACK
            agents = self._load_local_agents()
            agent = next((a for a in agents if a.get('id') == agent_id), None)
            if agent:
                agent['last_execution'] = datetime.now().isoformat()
                agent['execution_count'] = agent.get('execution_count', 0) + 1
                self._save_local_agents(agents)
            return {"success": True, "storage": "local"}


# Singleton instance
snowflake_client = SnowflakeClient()
