"""
Flow Validator - Pre-flight validation for SnowFlow workflows

Provides comprehensive validation before execution:
1. Snowflake connectivity
2. Graph integrity (connected nodes, valid paths)
3. Data source accessibility
4. Semantic model validation
5. Agent configuration checks

All errors include:
- User-friendly message
- Suggested fix action
- Severity (error = blocks execution, warning = proceed with caution)
"""

from typing import Dict, List, Any, Tuple, Optional
import yaml
import re


class ValidationResult:
    """Structured validation result with errors, warnings, and suggestions"""
    
    def __init__(self):
        self.errors: List[Dict[str, Any]] = []
        self.warnings: List[Dict[str, Any]] = []
        self.info: List[Dict[str, Any]] = []
    
    def add_error(self, code: str, message: str, suggestion: str, node_id: Optional[str] = None, details: Optional[Dict] = None):
        """Add a blocking error - prevents execution"""
        self.errors.append({
            "code": code,
            "severity": "error",
            "message": message,
            "suggestion": suggestion,
            "node_id": node_id,
            "details": details or {}
        })
    
    def add_warning(self, code: str, message: str, suggestion: str, node_id: Optional[str] = None, details: Optional[Dict] = None):
        """Add a warning - execution allowed but may have issues"""
        self.warnings.append({
            "code": code,
            "severity": "warning",
            "message": message,
            "suggestion": suggestion,
            "node_id": node_id,
            "details": details or {}
        })
    
    def add_info(self, code: str, message: str, node_id: Optional[str] = None):
        """Add informational message"""
        self.info.append({
            "code": code,
            "severity": "info",
            "message": message,
            "node_id": node_id
        })
    
    @property
    def is_valid(self) -> bool:
        """True if no blocking errors"""
        return len(self.errors) == 0
    
    @property
    def has_warnings(self) -> bool:
        return len(self.warnings) > 0
    
    def to_dict(self) -> Dict:
        return {
            "valid": self.is_valid,
            "errors": self.errors,
            "warnings": self.warnings,
            "info": self.info,
            "error_count": len(self.errors),
            "warning_count": len(self.warnings)
        }


class FlowValidator:
    """
    Comprehensive flow validator for SnowFlow workflows.
    
    Validates:
    - Graph structure (connectivity, required nodes)
    - Data sources (existence, permissions)
    - Semantic models (syntax, references)
    - Agent configuration
    """
    
    def __init__(self, snowflake_client):
        self.sf = snowflake_client
    
    def validate(self, nodes: List[Dict], edges: List[Dict], prompt: Optional[str] = None) -> ValidationResult:
        """
        Run all validations and return comprehensive result.
        
        Args:
            nodes: List of workflow nodes
            edges: List of workflow edges
            prompt: User's query (optional for pre-run validation)
        
        Returns:
            ValidationResult with errors, warnings, and suggestions
        """
        result = ValidationResult()
        
        # Build helper structures
        node_map = {n.get('id'): n for n in nodes}
        node_types = {n.get('type') for n in nodes}
        
        # 1. Check Snowflake connectivity first
        self._validate_snowflake_connection(result)
        
        # 2. Validate graph structure
        self._validate_graph_structure(nodes, edges, node_map, result)
        
        # 3. Validate required nodes
        self._validate_required_nodes(nodes, node_types, result)
        
        # 4. Validate data sources (if SF connected)
        if result.is_valid or not any(e['code'] == 'SNOWFLAKE_UNAVAILABLE' for e in result.errors):
            self._validate_data_sources(nodes, result)
        
        # 5. Validate semantic models
        self._validate_semantic_models(nodes, result)
        
        # 6. Validate agent configuration
        self._validate_agent_config(nodes, edges, node_map, result)
        
        # 7. Validate prompt (if provided)
        if prompt is not None:
            self._validate_prompt(prompt, result)
        
        # 8. Validate output node connections
        self._validate_output_connections(nodes, edges, result)
        
        return result
    
    def _validate_snowflake_connection(self, result: ValidationResult):
        """Check Snowflake is reachable"""
        try:
            available = self.sf.is_snowflake_available()
            if not available:
                result.add_error(
                    code="SNOWFLAKE_UNAVAILABLE",
                    message="Cannot connect to Snowflake",
                    suggestion="Check your VPN connection, or verify Snowflake credentials in .env file. You may need to restart the backend after fixing.",
                    details={"troubleshooting": [
                        "1. Ensure VPN is connected (if required)",
                        "2. Check SNOWFLAKE_ACCOUNT in backend/.env",
                        "3. Verify your Snowflake private key is valid",
                        "4. Try: curl http://localhost:8000/snowflake/reconnect"
                    ]}
                )
        except Exception as e:
            result.add_error(
                code="SNOWFLAKE_ERROR",
                message=f"Snowflake connection error: {str(e)[:100]}",
                suggestion="Check backend logs for details. You may need to restart the backend.",
                details={"error": str(e)}
            )
    
    def _validate_graph_structure(self, nodes: List[Dict], edges: List[Dict], node_map: Dict, result: ValidationResult):
        """Validate graph connectivity and structure"""
        if not nodes:
            result.add_error(
                code="EMPTY_GRAPH",
                message="No nodes in the workflow",
                suggestion="Add nodes to your workflow. Start with a Data Source, then add an Agent and Output."
            )
            return
        
        # Check for orphan nodes (nodes with no connections)
        connected_nodes = set()
        for edge in edges:
            connected_nodes.add(edge.get('source'))
            connected_nodes.add(edge.get('target'))
        
        for node in nodes:
            node_id = node.get('id')
            node_type = node.get('type')
            node_label = node.get('data', {}).get('label') or node.get('data', {}).get('name') or node_type
            
            # Skip input nodes (they don't need incoming connections)
            # Skip if only 1 node (single agent scenario)
            if len(nodes) > 1 and node_id not in connected_nodes:
                # Config holder nodes are internal, don't warn
                if node_type in ('configHolder', 'input'):
                    continue
                    
                result.add_warning(
                    code="ORPHAN_NODE",
                    message=f"'{node_label}' is not connected to any other node",
                    suggestion=f"Connect '{node_label}' to other nodes using edges, or remove it if not needed.",
                    node_id=node_id
                )
        
        # Check for valid flow path: Should have path from data source to output
        # This is a simplified check - could be enhanced with graph traversal
        has_source = any(n.get('type') == 'snowflakeSource' for n in nodes)
        has_output = any(n.get('type') == 'output' for n in nodes)
        
        if has_source and has_output and len(edges) == 0:
            result.add_error(
                code="NO_EDGES",
                message="Nodes are not connected",
                suggestion="Connect your nodes with edges. Data flows from Data Source → Agent → Output."
            )
    
    def _validate_required_nodes(self, nodes: List[Dict], node_types: set, result: ValidationResult):
        """Check that required node types exist"""
        # Check for data source
        has_data = 'snowflakeSource' in node_types
        if not has_data:
            result.add_error(
                code="NO_DATA_SOURCE",
                message="No data source configured",
                suggestion="Click on the Data Source layer and select a Table or View from your Snowflake catalog."
            )
        
        # Check for agent
        has_agent = 'agent' in node_types or 'cortexAgent' in node_types
        if not has_agent:
            result.add_error(
                code="NO_AGENT",
                message="No Cortex Agent configured",
                suggestion="Add a Cortex Agent node to process natural language queries against your data."
            )
        
        # Check for output
        has_output = 'output' in node_types
        if not has_output:
            result.add_error(
                code="NO_OUTPUT",
                message="No output node configured",
                suggestion="Click 'Complete Setup' to add an output node, or manually add one in Graph view."
            )
    
    def _validate_data_sources(self, nodes: List[Dict], result: ValidationResult):
        """Validate data source nodes - check tables exist and are accessible"""
        for node in nodes:
            if node.get('type') != 'snowflakeSource':
                continue
            
            node_id = node.get('id')
            data = node.get('data', {})
            
            db = data.get('database')
            schema = data.get('schema')
            obj_name = data.get('objectName') or data.get('table') or data.get('name')
            
            if not all([db, schema, obj_name]):
                result.add_error(
                    code="INCOMPLETE_DATA_SOURCE",
                    message="Data source is missing database, schema, or table name",
                    suggestion="Select a complete data source from the Snowflake catalog.",
                    node_id=node_id,
                    details={"database": db, "schema": schema, "object": obj_name}
                )
                continue
            
            full_name = f"{db}.{schema}.{obj_name}"
            
            # Try to access the table
            try:
                # Simple existence check
                check_result = self.sf.execute_sql(f"SELECT 1 FROM {full_name} LIMIT 1")
                
                if not check_result or check_result.get('error'):
                    error_msg = check_result.get('error', 'Unknown error') if check_result else 'No response'
                    
                    # Parse common errors
                    if 'does not exist' in str(error_msg).lower():
                        result.add_error(
                            code="TABLE_NOT_FOUND",
                            message=f"Table '{full_name}' does not exist",
                            suggestion=f"Verify the table name is correct. Check if it exists in Snowflake: SHOW TABLES LIKE '{obj_name}' IN {db}.{schema}",
                            node_id=node_id
                        )
                    elif 'insufficient privileges' in str(error_msg).lower() or 'access' in str(error_msg).lower():
                        result.add_error(
                            code="TABLE_NO_ACCESS",
                            message=f"No permission to access '{full_name}'",
                            suggestion=f"Ask your Snowflake admin to grant SELECT on {full_name} to your role.",
                            node_id=node_id
                        )
                    else:
                        result.add_warning(
                            code="TABLE_ACCESS_WARNING",
                            message=f"Could not verify access to '{full_name}'",
                            suggestion="The table may still work. Try running your query.",
                            node_id=node_id,
                            details={"error": str(error_msg)[:200]}
                        )
                else:
                    # Table accessible - check if empty
                    count_result = self.sf.execute_sql(f"SELECT COUNT(*) as cnt FROM {full_name}")
                    if count_result and count_result.get('data'):
                        row_count = count_result['data'][0].get('CNT', 0)
                        if row_count == 0:
                            result.add_warning(
                                code="TABLE_EMPTY",
                                message=f"Table '{full_name}' has no data",
                                suggestion="Queries will return empty results. Load data into the table first.",
                                node_id=node_id
                            )
                        else:
                            result.add_info(
                                code="TABLE_OK",
                                message=f"Data source '{obj_name}' verified ({row_count:,} rows)",
                                node_id=node_id
                            )
                            
            except Exception as e:
                error_str = str(e).lower()
                if 'token' in error_str and 'expired' in error_str:
                    result.add_error(
                        code="TOKEN_EXPIRED",
                        message="Snowflake authentication token has expired",
                        suggestion="Restart the backend to refresh the connection: pkill -f uvicorn && cd backend && uvicorn main:app --reload",
                        details={"error": str(e)[:200]}
                    )
                else:
                    result.add_warning(
                        code="DATA_SOURCE_CHECK_FAILED",
                        message=f"Could not validate data source: {str(e)[:100]}",
                        suggestion="The data source may still work. Try running your query.",
                        node_id=node_id
                    )
    
    def _validate_semantic_models(self, nodes: List[Dict], result: ValidationResult):
        """Validate semantic model nodes"""
        for node in nodes:
            if node.get('type') != 'semanticModel':
                continue
            
            node_id = node.get('id')
            data = node.get('data', {})
            
            semantic_path = data.get('semanticPath') or data.get('path')
            name = data.get('name') or data.get('label') or 'Semantic Model'
            
            if not semantic_path:
                result.add_error(
                    code="NO_SEMANTIC_PATH",
                    message=f"Semantic model '{name}' has no file path configured",
                    suggestion="Select a semantic model YAML file from the catalog, or specify the stage path.",
                    node_id=node_id
                )
                continue
            
            # Check path format
            if not semantic_path.endswith('.yaml') and not semantic_path.endswith('.yml'):
                result.add_warning(
                    code="INVALID_SEMANTIC_EXTENSION",
                    message=f"Semantic model path should end with .yaml or .yml",
                    suggestion=f"Check the file path: {semantic_path}",
                    node_id=node_id
                )
            
            # Check if path looks like a stage path
            if not semantic_path.startswith('@'):
                result.add_warning(
                    code="SEMANTIC_PATH_FORMAT",
                    message=f"Semantic model path should reference a Snowflake stage",
                    suggestion=f"Expected format: @DATABASE.SCHEMA.STAGE_NAME/file.yaml",
                    node_id=node_id,
                    details={"current_path": semantic_path}
                )
            
            # Try to fetch and validate the YAML content
            if semantic_path.startswith('@'):
                self._validate_semantic_yaml_content(semantic_path, node_id, result)
    
    def _validate_semantic_yaml_content(self, stage_path: str, node_id: str, result: ValidationResult):
        """Fetch and validate semantic model YAML content"""
        try:
            # Try to get the file content from the stage
            # This is a simplified check - full validation would parse the YAML
            list_result = self.sf.execute_sql(f"LIST {stage_path}")
            
            if not list_result or list_result.get('error') or not list_result.get('data'):
                result.add_warning(
                    code="SEMANTIC_FILE_NOT_FOUND",
                    message=f"Could not find semantic model file at {stage_path}",
                    suggestion="Verify the file exists in the Snowflake stage. You may need to upload it first.",
                    node_id=node_id
                )
        except Exception as e:
            # Don't block on semantic validation failures
            result.add_warning(
                code="SEMANTIC_VALIDATION_SKIPPED",
                message=f"Could not validate semantic model: {str(e)[:100]}",
                suggestion="The semantic model may still work. Verify the path is correct.",
                node_id=node_id
            )
    
    def _validate_agent_config(self, nodes: List[Dict], edges: List[Dict], node_map: Dict, result: ValidationResult):
        """Validate agent node configuration"""
        for node in nodes:
            if node.get('type') not in ('agent', 'cortexAgent'):
                continue
            
            node_id = node.get('id')
            data = node.get('data', {})
            name = data.get('name') or data.get('label') or 'Agent'
            
            # Check for model selection
            model = data.get('model') or data.get('cortexModel')
            if not model:
                result.add_warning(
                    code="NO_MODEL_SELECTED",
                    message=f"Agent '{name}' has no Cortex model selected",
                    suggestion="A default model will be used. For better results, select a specific model like 'llama3.1-70b'.",
                    node_id=node_id
                )
            
            # Check if agent has data source connection
            has_data_input = any(
                edge.get('target') == node_id and 
                node_map.get(edge.get('source'), {}).get('type') in ('snowflakeSource', 'semanticModel')
                for edge in edges
            )
            
            if not has_data_input:
                # Check if there's any upstream connection
                has_any_input = any(edge.get('target') == node_id for edge in edges)
                if not has_any_input and len(nodes) > 1:
                    result.add_warning(
                        code="AGENT_NO_DATA_INPUT",
                        message=f"Agent '{name}' is not connected to a data source",
                        suggestion="Connect a Data Source or Semantic Model to the agent for data-grounded responses.",
                        node_id=node_id
                    )
    
    def _validate_prompt(self, prompt: str, result: ValidationResult):
        """Validate the user's prompt"""
        if not prompt or not prompt.strip():
            result.add_error(
                code="NO_PROMPT",
                message="No question provided",
                suggestion="Enter a question in the chat input to ask your agent."
            )
            return
        
        prompt = prompt.strip()
        
        # Check for extremely short prompts
        if len(prompt) < 5:
            result.add_warning(
                code="PROMPT_TOO_SHORT",
                message="Your question is very short",
                suggestion="Try asking a more detailed question for better results. Example: 'What are total sales by region?'"
            )
        
        # Check for potential garbage/test input
        garbage_patterns = [
            r'^test+$',
            r'^asdf',
            r'^[a-z]{1,3}$',
            r'^hello+$',
            r'^hi+$',
        ]
        
        for pattern in garbage_patterns:
            if re.match(pattern, prompt.lower()):
                result.add_warning(
                    code="PROMPT_MAY_BE_TEST",
                    message="This looks like a test query",
                    suggestion="For meaningful results, ask a business question about your data."
                )
                break
    
    def _validate_output_connections(self, nodes: List[Dict], edges: List[Dict], result: ValidationResult):
        """Validate output nodes have proper input connections"""
        output_nodes = [n for n in nodes if n.get('type') == 'output']
        
        for node in output_nodes:
            node_id = node.get('id')
            label = node.get('data', {}).get('label') or 'Output'
            
            # Check if output has incoming edge
            has_input = any(edge.get('target') == node_id for edge in edges)
            
            if not has_input:
                result.add_error(
                    code="OUTPUT_DISCONNECTED",
                    message=f"Output '{label}' has no input connection",
                    suggestion="Connect an Agent to the Output node, or click 'Complete Setup' to auto-configure.",
                    node_id=node_id
                )


def validate_flow(snowflake_client, nodes: List[Dict], edges: List[Dict], prompt: Optional[str] = None) -> Dict:
    """
    Convenience function for flow validation.
    
    Returns dict with:
    - valid: bool
    - errors: list of blocking errors
    - warnings: list of warnings
    - info: list of informational messages
    """
    validator = FlowValidator(snowflake_client)
    result = validator.validate(nodes, edges, prompt)
    return result.to_dict()
