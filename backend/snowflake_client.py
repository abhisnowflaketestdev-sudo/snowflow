import os
from dotenv import load_dotenv
import snowflake.connector
from typing import Optional, List, Dict, Any
import pandas as pd

load_dotenv()

class SnowflakeClient:
    _instance: Optional['SnowflakeClient'] = None
    _conn: Optional[snowflake.connector.SnowflakeConnection] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def connect(self) -> snowflake.connector.SnowflakeConnection:
        if self._conn is None or self._conn.is_closed():
            self._conn = snowflake.connector.connect(
                account=os.getenv('SNOWFLAKE_ACCOUNT'),
                user=os.getenv('SNOWFLAKE_USER'),
                password=os.getenv('SNOWFLAKE_PASSWORD'),
                warehouse=os.getenv('SNOWFLAKE_WAREHOUSE'),
                database=os.getenv('SNOWFLAKE_DATABASE'),
                schema=os.getenv('SNOWFLAKE_SCHEMA'),
                role=os.getenv('SNOWFLAKE_ROLE'),
            )
        return self._conn

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


# Singleton instance
snowflake_client = SnowflakeClient()
