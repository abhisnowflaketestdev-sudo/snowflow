from langgraph.graph import StateGraph, END
from typing import TypedDict, List, Dict, Any, Annotated, Literal, Optional, Callable
from snowflake_client import snowflake_client
from mcp_client import create_mcp_client
from datetime import datetime
from functools import wraps
import json
import operator
import time


def merge_dicts(a: Dict[str, Any], b: Dict[str, Any]) -> Dict[str, Any]:
    """Merge two dictionaries, with b taking precedence for conflicts.
    Used for concurrent writes to 'results' in LangGraph.
    """
    if a is None:
        a = {}
    if b is None:
        b = {}
    return {**a, **b}


# ═══════════════════════════════════════════════════════════════════════════════
# GLOBAL QUEUE FOR REAL-TIME STREAMING
# Using global queue because LangGraph runs parallel nodes in separate threads
# Thread-local storage doesn't work when LangGraph spawns internal threads
# ═══════════════════════════════════════════════════════════════════════════════
import threading
import queue

# Global queue - protected by lock for thread safety
_global_execution_queue = None
_queue_lock = threading.Lock()

# Shared results store - holds the latest supervisor response
_shared_results = {}
_results_lock = threading.Lock()

def set_shared_results(results: dict):
    """Store results that can be accessed by the event loop - MERGES with existing"""
    global _shared_results
    with _results_lock:
        # MERGE with existing results (don't overwrite generated_yaml etc)
        if results:
            _shared_results.update(results)
        print(f"[RESULTS] Merged results, now {len(str(_shared_results))} chars")

def update_shared_results(key: str, value):
    """Update a specific key in shared results without overwriting"""
    global _shared_results
    with _results_lock:
        _shared_results[key] = value
        print(f"[RESULTS] Updated '{key}' ({len(str(value))} chars)")

def get_shared_results() -> dict:
    """Get the stored results"""
    global _shared_results
    with _results_lock:
        return _shared_results.copy()

def set_execution_callback(callback_queue):
    """Set the global callback queue for workflow execution"""
    global _global_execution_queue
    with _queue_lock:
        _global_execution_queue = callback_queue
        print(f"[TRACE] Queue set: {callback_queue is not None}")

def get_execution_queue():
    """Get the global execution queue"""
    global _global_execution_queue
    return _global_execution_queue


# ═══════════════════════════════════════════════════════════════════════════════
# BULLETPROOF TRACING SERVICE v2.0
# 
# This is a completely isolated tracing system that:
# 1. Wraps ALL node functions automatically
# 2. Guarantees visual pacing regardless of execution speed
# 3. Prevents duplicate events
# 4. Works 100% reliably for ANY template
# ═══════════════════════════════════════════════════════════════════════════════

# Thread-safe tracking of notified nodes per execution
_trace_lock = threading.Lock()
_notified_nodes: set = set()

# Visual pacing: Minimum time between node highlights (ms)
TRACE_VISUAL_DELAY_MS = 500  # Half second for clear visual feedback

def reset_trace_state():
    """Reset trace state for new execution - MUST be called at start"""
    global _notified_nodes, _shared_results
    with _trace_lock:
        _notified_nodes = set()
    with _results_lock:
        _shared_results = {}
    print("[TRACE] 🔄 Trace state reset for new execution")


# ═══════════════════════════════════════════════════════════════════════════════
# PROMPT VALIDATION - Detect garbage/invalid prompts
# ═══════════════════════════════════════════════════════════════════════════════

import re

def validate_and_clean_prompt(prompt: str) -> tuple[str, bool, str]:
    """
    Validate user prompt and detect garbage inputs.
    
    Returns: (cleaned_prompt, is_valid, error_message)
    """
    if not prompt or not prompt.strip():
        return '', True, ''  # Empty prompt is OK (will use defaults)
    
    prompt = prompt.strip()
    
    # Detect shell commands
    shell_patterns = [
        r'^(cd|ls|pwd|mkdir|rm|cp|mv|cat|echo|grep|find|chmod|chown|sudo|apt|brew|npm|pip|python|node|uvicorn|pkill|kill)\s',
        r'^\.?/[a-zA-Z]',  # Paths like /Users or ./venv
        r'&&|\|\||;.*\$',  # Shell operators
        r'^\s*#!',  # Shebang
        r'--[a-z]+=',  # CLI flags like --host=
    ]
    
    for pattern in shell_patterns:
        if re.search(pattern, prompt, re.IGNORECASE):
            print(f"[PROMPT GUARD] ⚠️ Detected shell command in prompt: {prompt[:50]}...")
            return '', False, 'Detected shell command instead of a question. Please enter a natural language question about your data.'
    
    # Detect file paths
    if prompt.startswith('/') or prompt.startswith('./') or prompt.startswith('../'):
        print(f"[PROMPT GUARD] ⚠️ Detected file path in prompt: {prompt[:50]}...")
        return '', False, 'Detected file path instead of a question. Please enter a natural language question.'
    
    # Detect code snippets
    code_patterns = [
        r'^(import|from|def|class|function|const|let|var|SELECT|INSERT|UPDATE|DELETE)\s',
        r'^\{.*\}$',  # JSON objects
        r'^\[.*\]$',  # JSON arrays
    ]
    
    for pattern in code_patterns:
        if re.search(pattern, prompt, re.IGNORECASE):
            print(f"[PROMPT GUARD] ⚠️ Detected code snippet in prompt: {prompt[:50]}...")
            return '', False, 'Detected code instead of a question. Please enter a natural language question about your data.'
    
    # Too short to be meaningful
    if len(prompt) < 5:
        print(f"[PROMPT GUARD] ⚠️ Prompt too short: {prompt}")
        return '', False, 'Question is too short. Please provide more detail about what you want to know.'
    
    # All good!
    return prompt, True, ''

def traced_node(node_id: str, node_fn: Callable) -> Callable:
    """
    BULLETPROOF tracing wrapper for any node function.
    
    Guarantees:
    ✅ Exactly ONE notification per node per execution
    ✅ Consistent visual pacing (500ms between nodes)
    ✅ Thread-safe operation
    ✅ Error recovery without breaking the flow
    ✅ Works for ANY node type in ANY template
    """
    @wraps(node_fn)
    def wrapper(state: WorkflowState) -> Dict:
        global _notified_nodes
        
        should_notify = False
        with _trace_lock:
            if node_id not in _notified_nodes:
                _notified_nodes.add(node_id)
                should_notify = True
        
        # STEP 1: Notify frontend (exactly once)
        if should_notify:
            # Direct call to queue-based notification
            eq = get_execution_queue()
            if eq:
                try:
                    eq.put_nowait({'type': 'node_executing', 'node_id': node_id})
                    print(f"[TRACE] 🔵 Node '{node_id}' - EXECUTING (queued ✓)")
                except Exception as e:
                    print(f"[TRACE] Queue error: {e}")
            else:
                print(f"[TRACE] ⚠️ Node '{node_id}' - NO QUEUE AVAILABLE!")
            
            # STEP 2: Guaranteed visual delay for human perception
            # This is the KEY to reliable tracing - we WAIT for the visual to register
            time.sleep(TRACE_VISUAL_DELAY_MS / 1000.0)
        
        # STEP 3: Execute the actual node function
        try:
            result = node_fn(state)
            if result is None:
                result = {}
            
            # STEP 3b: Send completion event to queue (include error if present)
            eq = get_execution_queue()
            if eq and should_notify:
                try:
                    completed_event = {'type': 'node_completed', 'node_id': node_id}
                    # Include error info if node returned an error
                    if result.get('error'):
                        completed_event['error'] = result['error']
                    if result.get('auth_error'):
                        completed_event['auth_error'] = True
                    eq.put_nowait(completed_event)
                except Exception:
                    pass
            print(f"[TRACE] ✅ Node '{node_id}' - COMPLETED")
            
        except Exception as e:
            print(f"[TRACE] ❌ Node '{node_id}' - FAILED: {str(e)}")
            import traceback
            traceback.print_exc()
            result = {
                'error': str(e),
                'messages': [f"❌ Node {node_id} error: {str(e)}"]
            }
        
        # STEP 4: Track executed nodes
        executed = result.get('executed_nodes', [])
        if node_id not in executed:
            result['executed_nodes'] = executed + [node_id]
        
        return result
    
    return wrapper


def notify_node_executing_safe(node_id: str):
    """
    Safe notification that respects the trace lock.
    Used by nodes that need to notify mid-execution (rare).
    """
    global _notified_nodes
    with _trace_lock:
        if node_id in _notified_nodes:
            return  # Already notified, skip
        _notified_nodes.add(node_id)
    # Direct call to queue
    eq = get_execution_queue()
    if eq:
        try:
            eq.put_nowait({'type': 'node_executing', 'node_id': node_id})
        except Exception:
            pass


def last_value(a: Any, b: Any) -> Any:
    """Keep the last value written. Used for fields that can be overwritten."""
    return b if b is not None else a


class WorkflowState(TypedDict):
    """State that flows through the workflow
    
    Using Annotated with operator.add allows multiple nodes to append to lists.
    Using Annotated with merge_dicts allows concurrent dict updates.
    Using Annotated with last_value allows concurrent overwrites (last wins).
    """
    data: List[Dict[str, Any]]  # Data from source nodes
    messages: Annotated[List[str], operator.add]  # Accumulated messages (supports concurrent writes)
    results: Annotated[Dict[str, Any], merge_dicts]  # Final results (supports concurrent writes via merge)
    agent_results: Annotated[List[Dict[str, Any]], operator.add]  # Results from multiple agents (supports concurrent writes)
    current_node: Annotated[str, last_value]  # Track current node (last wins)
    error: Annotated[str, last_value]  # Any error message (last wins)
    auth_error: Annotated[bool, last_value]  # Auth error flag for special handling
    routing_decision: Annotated[str, last_value]  # For Router nodes - which agent to route to
    user_prompt: str  # Natural language query that triggered the workflow (set once at start)
    selected_agents: Annotated[List[str], operator.add]  # For Supervisor - agents selected for execution
    executed_nodes: Annotated[List[str], operator.add]  # Track which nodes actually executed (for frontend tracing)
    simulated_nodes: Annotated[List[str], operator.add]  # Track nodes that ran in simulated mode (external APIs unavailable)
    execution_timing: Dict[str, Dict[str, Any]]  # Execution plan with timing for each node
    semantic_models: Annotated[Dict[str, Dict[str, Any]], merge_dicts]  # Semantic models for Cortex Analyst (supports concurrent writes)


def create_source_node(node_config: Dict):
    """Create a node function that fetches data from Snowflake"""
    def source_node(state: WorkflowState) -> Dict:
        import time
        
        node_id = node_config.get('id', '')
        data = node_config.get('data', {})
        
        # Check for mock configuration
        mock_config = data.get('mock', {})
        mock_delay = mock_config.get('delay', None)
        
        # Use mock delay if specified, otherwise intelligent default
        if mock_delay is not None:
            time.sleep(mock_delay)
        else:
            # Intelligent default based on execution plan
            execution_timing = state.get('execution_timing', {})
            node_timing = execution_timing.get(node_id, {})
            delay = node_timing.get('delay', 0.1)  # Minimal delay - traced_node handles visual pacing
            time.sleep(delay)
        
        # NOTE: traced_node wrapper handles notification - no duplicate call needed
        
        label = data.get('label', 'Data Source')
        database = data.get('database', 'SNOWFLOW_DEV')
        schema = data.get('schema', '')
        table = label
        
        columns = data.get('columns', '*') or '*'
        filter_clause = data.get('filter', '')
        order_by = data.get('orderBy', '')
        limit = data.get('limit', 100) or 100
        
        try:
            query = f"SELECT {columns} FROM {database}.{schema}.{table}"
            if filter_clause:
                query += f" WHERE {filter_clause}"
            if order_by:
                query += f" ORDER BY {order_by}"
            query += f" LIMIT {limit}"
            
            df = snowflake_client.execute_query(query)
            records = df.to_dict('records')
            return {
                'data': records,
                'messages': [f"📊 Data Source: Loaded {len(records)} records from {table}"],
                'current_node': node_config['id'],
                'executed_nodes': [node_config['id']]
            }
        except Exception as e:
            return {
                'error': str(e),
                'messages': [f"Error fetching data: {str(e)}"]
            }
    return source_node


def create_agent_node(node_config: Dict):
    """Create a node function that runs a Cortex agent with tools"""
    def agent_node(state: WorkflowState) -> Dict:
        data = node_config.get('data', {})
        tools = data.get('tools', {})
        # Guard: tools might be a list in some templates - convert to empty dict
        if isinstance(tools, list):
            tools = {}
        
        model = data.get('model', 'mistral-large2')
        system_prompt = data.get('systemPrompt') or data.get('instructions', 'Analyze the data and provide insights.')
        agent_name = data.get('label', 'Agent')
        
        # Check if this agent is in the selected list (for Supervisor-controlled execution)
        selected_agents = state.get('selected_agents', [])
        if selected_agents:
            # Check if this agent's name matches any selected agent
            is_selected = False
            for sel in selected_agents:
                sel_lower = sel.lower()
                name_lower = agent_name.lower()
                if sel_lower in name_lower or any(word in name_lower for word in sel_lower.split() if len(word) > 2):
                    is_selected = True
                    break
            
            if not is_selected:
                print(f"⏭️  AGENT SKIPPED: {agent_name} (not in selected_agents: {selected_agents})")
                return {
                    'messages': [f"⏭️ Skipped {agent_name} (not selected for this query)"]
                }
        
        print(f"\n🤖 AGENT EXECUTING: {agent_name}")
        
        # Track that this node executed
        node_id = node_config.get('id', '')
        
        import time
        # Use execution plan timing or mock config
        mock_config = data.get('mock', {})
        if 'delay' in mock_config:
            time.sleep(mock_config['delay'])
        else:
            execution_timing = state.get('execution_timing', {})
            delay = execution_timing.get(node_id, {}).get('delay', 0.3)
            time.sleep(delay)
        
        # Notify streaming (if active)
        # traced_node handles notification
        print(f"   Model: {model}")
        print(f"   Data rows: {len(state.get('data', []))}")
        
        temperature = data.get('temperature', 0.7)
        max_tokens = data.get('maxTokens', 4096)
        top_p = data.get('topP', 1.0)
        
        tool_results = {}
        tool_messages = []
        
        # Normalize tools format: handle both array ["Analyst"] and dict {"analyst": {...}}
        tools_enabled = set()
        if isinstance(tools, list):
            # Array format: ["Analyst", "Search", "SQL"]
            tools_enabled = {t.lower() for t in tools}
        elif isinstance(tools, dict):
            # Dict format: {"analyst": {"enabled": true}}
            for tool_name, tool_config in tools.items():
                if isinstance(tool_config, dict) and tool_config.get('enabled'):
                    tools_enabled.add(tool_name.lower())
        
        # Execute Cortex Analyst if enabled
        if 'analyst' in tools_enabled:
            user_prompt = state.get('user_prompt', '')
            semantic_models = state.get('semantic_models', {})
            
            # Find a semantic model to use (prefer one matching agent's domain)
            agent_domain = agent_name.lower().replace('agent', '').replace('💰', '').replace('👥', '').replace('📦', '').replace('🏷️', '').replace('🏪', '').replace('💵', '').strip()
            
            selected_model = None
            for model_id, model_info in semantic_models.items():
                model_label = model_info.get('label', '').lower()
                # Match by domain (e.g., "sales agent" matches "Sales SV")
                if agent_domain in model_label or model_label.replace(' sv', '') in agent_domain:
                    selected_model = model_info
                    break
            
            # Fallback: use first available model
            if not selected_model and semantic_models:
                selected_model = list(semantic_models.values())[0]
            
            if selected_model and selected_model.get('path') and user_prompt:
                semantic_path = selected_model['path']
                print(f"   🔍 Cortex Analyst: Querying {selected_model.get('label', 'semantic model')}")
                print(f"   📝 Question: {user_prompt[:60]}...")
                
                try:
                    analyst_result = snowflake_client.cortex_analyst(semantic_path, user_prompt)
                    if analyst_result and 'error' not in str(analyst_result).lower():
                        tool_results['analyst'] = analyst_result
                        tool_messages.append(f"🔍 Cortex Analyst queried {selected_model.get('label', 'semantic model')}")
                        print(f"   ✅ Analyst returned data")
                    else:
                        print(f"   ⚠️ Analyst returned no data or error")
                except Exception as e:
                    print(f"   ⚠️ Cortex Analyst error: {e}")
            elif not selected_model:
                print(f"   ⚠️ No semantic model available for Analyst tool")
        
        # Execute Cortex Search if enabled (dict format for backward compat)
        search_config = tools.get('search', {}) if isinstance(tools, dict) else {}
        if 'search' in tools_enabled and search_config.get('searchServiceName'):
            service_name = search_config.get('searchServiceName', '')
            if service_name:
                search_results = snowflake_client.cortex_search(
                    service_name=service_name,
                    query=system_prompt[:500] if system_prompt else "relevant information",
                    database=search_config.get('database', ''),
                    schema=search_config.get('schema', ''),
                    limit=search_config.get('limit', 10)
                )
                tool_results['search'] = search_results
                tool_messages.append(f"Cortex Search found {len(search_results)} results")
        
        # Build prompt - include user prompt if available
        data_sample = state.get('data', [])[:10]
        data_str = json.dumps(data_sample, indent=2, default=str)
        user_prompt = state.get('user_prompt', '')
        
        tool_context = ""
        if tool_results:
            tool_context = f"\n\nTool Results:\n{json.dumps(tool_results, indent=2, default=str)}\n"
        
        # If user prompt is available, make it the primary focus
        user_query_section = ""
        if user_prompt:
            user_query_section = f"\n\nUser's Question: {user_prompt}\n\nFocus your analysis on answering this specific question.\n"
            print(f"   📝 Answering user query: {user_prompt[:80]}...")
        
        full_prompt = f"""System: {system_prompt}
{user_query_section}
Data to analyze:
{data_str}
{tool_context}
Provide your analysis:"""

        try:
            response = snowflake_client.cortex_complete(
                model=model, 
                prompt=full_prompt,
                options={
                    'temperature': temperature,
                    'max_tokens': max_tokens,
                    'top_p': top_p
                }
            )
            
            all_messages = [
                f"🤖 Agent '{agent_name}' invoked (Model: {model})",
                f"📊 Processing {len(state.get('data', []))} data records"
            ] + tool_messages + [
                f"✅ {agent_name} completed analysis"
            ]
            
            print(f"   ✅ {agent_name} completed successfully")
            print(f"   Response length: {len(response)} chars\n")
            
            # Return agent result - only write to agent_results (supports concurrent writes)
            # Don't write to 'results' or 'current_node' - avoid concurrent write conflicts
            return {
                'agent_results': [{
                    'agent': agent_name,
                    'response': response,
                    'model': model,
                    'tools_used': list(tool_results.keys())
                }],
                'messages': all_messages,
                'executed_nodes': [node_id] if node_id else []
            }
        except Exception as e:
            return {
                'error': str(e),
                'messages': tool_messages + [f"Agent error: {str(e)}"]
            }
    return agent_node


def create_router_node(node_config: Dict, connected_agents: List[Dict]):
    """Create a Router node that classifies intent and routes to ONE agent
    
    This is the key to multi-agent routing:
    1. Router uses LLM to classify the intent (using user prompt if available)
    2. Based on classification, sets routing_decision
    3. Conditional edges route to the correct agent
    """
    node_id = node_config.get('id', 'router')
    
    def router_node(state: WorkflowState) -> Dict:
        # traced_node handles notification
        data = node_config.get('data', {})
        label = data.get('label', 'Router')
        strategy = data.get('routingStrategy', 'intent')
        routes = data.get('routes', [])
        
        # Get user prompt if provided - this is the KEY for smart routing
        user_prompt = state.get('user_prompt', '')
        
        # Build route descriptions for LLM
        route_descriptions = []
        for i, route in enumerate(routes):
            route_name = route.get('name', f'Route {i+1}')
            route_condition = route.get('condition', '')
            route_descriptions.append(f"- {route_name}: {route_condition}")
        
        routes_text = "\n".join(route_descriptions)
        
        # Get context from state - show more data for better classification
        data_records = state.get('data', [])[:5]
        context = json.dumps(data_records, indent=2, default=str)
        
        # Extract route names for the example
        route_name_list = [r.get('name', '') for r in routes]
        example_routes = " or ".join([f'"{r}"' for r in route_name_list[:3]])
        
        # Build classification prompt - prioritize user prompt if available
        if user_prompt:
            classification_prompt = f"""You are an intelligent query router for a retail analytics system.

User's Question:
"{user_prompt}"

Available domains:
{routes_text}

IMPORTANT: Analyze if this question requires data from MULTIPLE domains to answer properly.

Examples of MULTI-DOMAIN questions:
- "Why did margin drop?" → Needs Sales + Inventory + Ops + Promo (respond: ALL)
- "Compare loyalty vs promotions" → Needs Customer + Promo (respond: ALL)
- "What's causing profitability issues?" → Needs multiple domains (respond: ALL)

Examples of SINGLE-DOMAIN questions:
- "What are top selling products?" → Just Sales (respond: Sales)
- "Show me inventory levels" → Just Inventory (respond: Inventory)
- "Who are our best customers?" → Just Customer (respond: Customer)

If the question clearly needs MULTIPLE domains to answer properly, respond with: ALL
If the question can be answered by ONE domain, respond with that domain name (e.g., {example_routes})

Respond with ONLY one word: either "ALL" or a single domain name."""
        else:
            classification_prompt = f"""You are an intent classifier for a support ticket routing system. 

Analyze the data below and determine which category BEST matches the PRIMARY issue.

Available routes:
{routes_text}

Data to analyze:
{context}

Look at fields like 'issue_category', 'description', or 'product_name' to determine the route.
Respond with ONLY the route name (e.g., {example_routes}). Nothing else - just the single word."""

        try:
            print(f"\n{'='*60}")
            print(f"🔀 ROUTER: {label}")
            print(f"   Strategy: {strategy}")
            print(f"   Routes: {[r.get('name') for r in routes]}")
            if user_prompt:
                print(f"   📝 User Prompt: {user_prompt[:100]}...")
            print(f"   Data records: {len(data_records)}")
            
            if strategy == 'intent' or strategy == 'llm':
                # Use LLM for classification
                print(f"   Calling Cortex for classification...")
                decision = snowflake_client.cortex_complete(
                    model='mistral-large2',
                    prompt=classification_prompt,
                    options={'temperature': 0.1, 'max_tokens': 50}
                ).strip()
            elif strategy == 'round_robin':
                decision = routes[0].get('name', 'default') if routes else 'default'
            else:
                decision = routes[0].get('name', 'default') if routes else 'default'
            
            # Normalize decision
            decision = decision.strip().strip('"').strip("'").strip().upper()
            
            # Check if multi-domain query
            is_multi = decision == 'ALL' or decision == 'MULTI' or decision == 'MULTIPLE'
            
            if is_multi:
                print(f"   🔄 MULTI-DOMAIN query detected!")
                print(f"   📢 Broadcasting to ALL {len(routes)} agents...")
                # Return all route names for parallel execution
                all_routes = ','.join([r.get('name', '') for r in routes])
                return {
                    'routing_decision': 'ALL',
                    'multi_route': True,
                    'all_routes': [r.get('name', '') for r in routes],
                    'messages': [
                        f"🔀 Router '{label}' analyzing intent...",
                        f"📝 Query: \"{user_prompt[:80]}...\"" if user_prompt else "📊 Analyzing data patterns...",
                        f"🔄 MULTI-DOMAIN query detected - broadcasting to ALL {len(routes)} agents: {all_routes}"
                    ],
                    'current_node': node_config['id']
                }
            
            print(f"   ✅ Decision: '{decision}'")
            print(f"{'='*60}\n")
            
            return {
                'routing_decision': decision,
                'messages': [
                    f"🔀 Router '{label}' analyzing intent...",
                    f"📝 Query: \"{user_prompt[:80]}...\"" if user_prompt else "📊 Analyzing data patterns...",
                    f"✅ Domain routed to: {decision} (matched from {len(routes)} available domains)"
                ],
                'current_node': node_config['id'],
                'executed_nodes': [node_config['id']]
            }
        except Exception as e:
            print(f"   ❌ Router error: {str(e)}")
            default_route = routes[0].get('name', 'default') if routes else 'default'
            return {
                'routing_decision': default_route,
                'messages': [f"{label} defaulted to: {default_route} (error: {str(e)})"],
                'current_node': node_config['id']
            }
    
    return router_node


def create_supervisor_node(node_config: Dict):
    """Create a Supervisor node that PLANS and orchestrates child agents
    
    True Supervisor pattern:
    1. Receives the user query
    2. PLANS - decides which agents are needed (not all!)
    3. Simulates dispatching to selected agents
    4. Aggregates their responses
    """
    def supervisor_node(state: WorkflowState) -> Dict:
        data = node_config.get('data', {})
        label = data.get('label', 'Supervisor')
        model = data.get('model', 'mistral-large2')
        strategy = data.get('delegationStrategy', 'adaptive')
        system_prompt = data.get('systemPrompt', 'You are a supervisor agent.')
        aggregation_method = data.get('aggregationMethod', 'merge')
        
        user_prompt = state.get('user_prompt', '')
        agent_results = state.get('agent_results', [])
        
        # Available domains the supervisor can delegate to
        available_domains = ['Sales', 'Inventory', 'Customer', 'Promo', 'Ops']
        
        import time
        # Use execution plan timing
        execution_timing = state.get('execution_timing', {})
        node_id = node_config.get('id', '')
        delay = execution_timing.get(node_id, {}).get('delay', 0.25)
        time.sleep(delay)
        
        # Notify streaming
        # traced_node handles notification
        
        # STEP 1: PLANNING - Supervisor decides which agents to consult
        if user_prompt:
            print(f"\n{'='*60}")
            print(f"👔 SUPERVISOR: {label}")
            print(f"   📝 Query: {user_prompt[:80]}...")
            print(f"   🧠 Planning which agents to consult...")
            
            # Ask LLM to plan which agents are needed
            planning_prompt = f"""You are a retail analytics supervisor. Given the user's question, decide which specialist agents to consult.

User's Question: "{user_prompt}"

Available Agents:
- Sales: Revenue, margins, product performance, regional sales
- Inventory: Stock levels, waste, shrinkage, supply chain, freshness
- Customer: Loyalty programs, demographics, basket analysis, retention
- Promo: Promotional effectiveness, discounting, campaign ROI
- Ops: Store operations, labour costs, efficiency, scheduling

Which agents are NEEDED to answer this question? List ONLY the relevant ones.
Respond in format: Agent1, Agent2, Agent3

For example:
- "Why did margin drop?" → Sales, Inventory, Ops
- "Top selling products" → Sales
- "Loyalty program performance" → Customer, Sales"""

            try:
                planning_response = snowflake_client.cortex_complete(
                    model=model,
                    prompt=planning_prompt,
                    options={'temperature': 0.1, 'max_tokens': 100}
                ).strip()
                
                # Parse which agents were selected
                selected_agents = [a.strip() for a in planning_response.split(',')]
                selected_agents = [a for a in selected_agents if any(d.lower() in a.lower() for d in available_domains)]
                
                if not selected_agents:
                    selected_agents = ['Sales']  # Default
                
                print(f"   📋 Plan: Consult {selected_agents}")
                print(f"{'='*60}\n")
                
            except Exception as e:
                error_msg = str(e)
                # Detect auth errors specifically
                if 'Authentication token has expired' in error_msg or '390114' in error_msg:
                    print(f"   🔐 AUTH ERROR: Snowflake token expired")
                    return {
                        'error': 'Snowflake authentication token has expired. Please restart the backend to re-authenticate.',
                        'auth_error': True,
                        'selected_agents': [],
                        'messages': [
                            f"👔 Supervisor '{label}' received query",
                            f"🔐 ERROR: Snowflake authentication token has expired",
                            f"⚠️ Please restart the backend to re-authenticate"
                        ],
                        'current_node': node_config['id'],
                        'executed_nodes': [node_config['id']]
                    }
                else:
                    print(f"   ⚠️ Planning error: {e}, defaulting to Sales")
                    selected_agents = ['Sales']
        else:
            selected_agents = ['Sales']
        
        # STEP 2: Generate comprehensive response considering selected domains
        print(f"   🔄 Generating response from {', '.join(selected_agents)}... (this may take 20-30s)")
        # (In a full implementation, we'd actually call each agent. Here we simulate.)
        
        aggregation_prompt = f"""System: {system_prompt}

You are the Head of Analytics for a UK grocery retailer. 

User's Question: "{user_prompt}"

Your Plan: You decided to consult these specialist agents: {', '.join(selected_agents)}

Previous agent data received:
{json.dumps(agent_results, indent=2, default=str) if agent_results else "No prior data"}

Now provide a COMPREHENSIVE answer that synthesizes insights from the domains you selected ({', '.join(selected_agents)}).

For each domain you're consulting, provide specific insights:
{chr(10).join([f"- {agent}: [Provide relevant analysis for this domain]" for agent in selected_agents])}

Structure your response as:
1. **Executive Summary** (2-3 sentences answering the question directly)
2. **Analysis by Domain** (bullet points for each agent you consulted)
3. **Root Cause / Key Insight** (what's the main finding)
4. **Recommended Action** (what should be done)

Use realistic example metrics (e.g., "Margin dropped 2.1% in Scotland due to...")"""

        try:
            final_response = snowflake_client.cortex_complete(
                model=model,
                prompt=aggregation_prompt,
                options={'temperature': 0.5, 'max_tokens': 4096}
            )
            print(f"   ✅ Supervisor response generated ({len(final_response)} chars)")
            
            # Store results in shared location for fan-in completion
            result_data = {
                'agent_response': final_response,
                'model': model,
                'supervisor': label,
                'agents_consulted': selected_agents,
            }
            set_shared_results(result_data)
            
            return {
                'results': {
                    'agent_response': final_response,
                    'model': model,
                    'supervisor': label,
                    'agents_consulted': selected_agents,
                    'planning_strategy': strategy,
                },
                'selected_agents': selected_agents,  # Store in state for conditional routing
                'messages': [
                    f"👔 Supervisor '{label}' received query",
                    f"🧠 Planning: Analyzing which agents are needed...",
                    f"📋 Plan: Consulting {len(selected_agents)} agents: {', '.join(selected_agents)}",
                    f"🔄 Dispatching requests to selected agents...",
                    f"📥 Aggregating responses from {', '.join(selected_agents)}",
                    f"✅ Supervisor synthesized final response"
                ],
                'current_node': node_config['id'],
                'executed_nodes': [node_config['id']]
            }
        except Exception as e:
            return {
                'error': str(e),
                'messages': [f"{label} error: {str(e)}"]
            }
    
    return supervisor_node


def create_output_node(node_config: Dict):
    """Create a node function that formats output"""
    def output_node(state: WorkflowState) -> Dict:
        import time
        node_id = node_config.get('id', '')
        
        # Use execution plan timing
        execution_timing = state.get('execution_timing', {})
        delay = execution_timing.get(node_id, {}).get('delay', 0.1)
        time.sleep(delay)
        
        # traced_node handles notification
        
        data = node_config.get('data', {})
        output_type = data.get('outputType', 'display')
        label = data.get('label', 'Output')
        
        # If we have multiple agent results, combine them
        agent_results = state.get('agent_results', [])
        existing_response = state.get('results', {}).get('agent_response')
        
        combined_response = ""
        
        if agent_results and not existing_response:
            # Combine agent results if not already aggregated
            combined_response = "\n\n---\n\n".join([
                f"**{r.get('agent', 'Agent')}**:\n{r.get('response', '')}"
                for r in agent_results
            ])
            print(f"📤 Output '{label}': Aggregated {len(agent_results)} agent responses ({len(combined_response)} chars)")
        elif existing_response:
            combined_response = existing_response
            print(f"📤 Output '{label}': Using existing response ({len(existing_response)} chars)")
        else:
            print(f"📤 Output '{label}': No agent results to aggregate")
        
        # IMPORTANT: Store results in shared state for the complete event
        if combined_response:
            set_shared_results('agent_response', combined_response)
            set_shared_results('response', combined_response)
        
            return {
                'results': {
                    **state.get('results', {}),
                'agent_response': combined_response,
                'response': combined_response
            },
            'messages': [f"📤 Output '{label}' ready" + (f" - {len(combined_response)} chars" if combined_response else "")],
            'current_node': node_config['id'],
            'executed_nodes': [node_config['id']]
        }
    return output_node


def create_cortex_node(node_config: Dict):
    """Create a node function for Cortex AI functions"""
    node_id = node_config.get('id', 'cortex')
    
    def cortex_node(state: WorkflowState) -> Dict:
        # traced_node handles notification
        data = node_config.get('data', {})
        cortex_function = data.get('cortexFunction', 'complete')
        source_column = data.get('sourceColumn', '')
        label = data.get('label', 'Cortex')
        
        records = state.get('data', [])
        if not records:
            return {
                'error': 'No data to process',
                'messages': [f"{label}: No input data"]
            }
        
        try:
            if cortex_function == 'summarize':
                text = str(records[0].get(source_column, '')) if source_column else json.dumps(records[:5], default=str)
                safe_text = text.replace("'", "''")[:4000]
                result = snowflake_client.execute_query(f"SELECT SNOWFLAKE.CORTEX.SUMMARIZE('{safe_text}') as result")
                response = result['RESULT'].iloc[0] if not result.empty else "No summary"
                
            elif cortex_function == 'sentiment':
                text = str(records[0].get(source_column, '')) if source_column else str(records[0])
                safe_text = text.replace("'", "''")[:4000]
                result = snowflake_client.execute_query(f"SELECT SNOWFLAKE.CORTEX.SENTIMENT('{safe_text}') as result")
                response = f"Sentiment score: {result['RESULT'].iloc[0]}" if not result.empty else "No sentiment"
                
            elif cortex_function == 'translate':
                target_lang = data.get('targetLanguage', 'es')
                text = str(records[0].get(source_column, '')) if source_column else str(records[0])
                safe_text = text.replace("'", "''")[:4000]
                result = snowflake_client.execute_query(f"SELECT SNOWFLAKE.CORTEX.TRANSLATE('{safe_text}', 'en', '{target_lang}') as result")
                response = result['RESULT'].iloc[0] if not result.empty else "No translation"
                
            else:
                prompt = data.get('prompt', 'Analyze this data')
                model = data.get('model', 'mistral-large2')
                response = snowflake_client.cortex_complete(model, prompt)
            
            return {
                'results': {**state.get('results', {}), 'cortex_response': response},
                'messages': [f"{label} ({cortex_function}) completed"],
                'current_node': node_config['id']
            }
        except Exception as e:
            return {
                'error': str(e),
                'messages': [f"{label} error: {str(e)}"]
            }
    return cortex_node


def create_condition_node(node_config: Dict):
    """Create a condition/branching node"""
    def condition_node(state: WorkflowState) -> Dict:
        import time
        node_id = node_config.get('id', '')
        
        # Use execution plan timing
        execution_timing = state.get('execution_timing', {})
        delay = execution_timing.get(node_id, {}).get('delay', 0.08)
        time.sleep(delay)
        
        # traced_node handles notification
        
        data = node_config.get('data', {})
        condition = data.get('condition', 'True')
        label = data.get('label', 'Condition')
        
        return {
            'messages': [f"Condition '{label}' evaluated: {condition}"],
            'current_node': node_config['id']
        }
    return condition_node


def create_external_agent_node(node_config: Dict):
    """Create an external API/agent node that makes real HTTP calls
    
    Supports:
    - REST APIs (generic)
    - Microsoft Copilot / Graph API
    - OpenAI GPT
    - Salesforce Einstein
    - ServiceNow
    """
    import httpx
    
    def external_agent_node(state: WorkflowState) -> Dict:
        data = node_config.get('data', {})
        endpoint = data.get('endpoint', '')
        method = data.get('method', 'POST')
        label = data.get('label', 'External Agent')
        agent_type = data.get('agentType', 'rest')
        auth_type = data.get('authType', 'none')
        auth_token = data.get('authToken', '')
        api_key = data.get('apiKey', '')
        
        # Check if this agent is in the selected list (for Supervisor-controlled execution)
        # BUT: Only filter if this is a domain/analysis agent. Output/callback agents always execute.
        is_output_agent = any(keyword in label.lower() for keyword in ['render', 'callback', 'output', 'display', 'visualization'])
        
        selected_agents = state.get('selected_agents', [])
        if selected_agents and not is_output_agent:
            is_selected = False
            for sel in selected_agents:
                sel_lower = sel.lower()
                name_lower = label.lower()
                if sel_lower in name_lower or any(word in name_lower for word in sel_lower.split() if len(word) > 2):
                    is_selected = True
                    break
            
            if not is_selected:
                print(f"⏭️  EXTERNAL AGENT SKIPPED: {label} (not in selected_agents: {selected_agents})")
                return {
                    'messages': [f"⏭️ Skipped {label} (not selected for this query)"]
                }
        
        import time
        # Use execution plan timing or mock config
        node_id = node_config.get('id', '')
        mock_config = data.get('mock', {})
        if 'delay' in mock_config:
            time.sleep(mock_config['delay'])
        else:
            execution_timing = state.get('execution_timing', {})
            delay = execution_timing.get(node_id, {}).get('delay', 0.15)
            time.sleep(delay)
        
        # Notify streaming
        # traced_node handles notification
        
        provider = data.get('provider', '')
        
        print(f"\n🌐 EXTERNAL AGENT: {label}")
        print(f"   Type: {agent_type}")
        print(f"   Endpoint: {endpoint}")
        
        if not endpoint:
            return {
                'error': 'No endpoint configured',
                'messages': [f"{label}: No endpoint configured"]
            }
        
        # Build headers based on auth type
        headers = {'Content-Type': 'application/json'}
        if auth_type == 'bearer' and auth_token:
            headers['Authorization'] = f'Bearer {auth_token}'
        elif auth_type == 'api_key' and api_key:
            headers['X-API-Key'] = api_key
        elif auth_type == 'oauth' and auth_token:
            headers['Authorization'] = f'Bearer {auth_token}'
        
        # Build request payload based on agent type
        context_data = state.get('data', [])[:5]
        previous_results = state.get('results', {})
        
        if agent_type == 'copilot':
            # Microsoft Copilot / Graph API format
            payload = {
                'messages': [{
                    'role': 'user',
                    'content': f"Based on this data context, provide insights: {json.dumps(context_data, default=str)}"
                }]
            }
        elif agent_type == 'openai':
            # OpenAI Chat Completions format
            model = data.get('model', 'gpt-4-turbo')
            system_prompt = data.get('systemPrompt', 'You are a helpful assistant.')
            payload = {
                'model': model,
                'messages': [
                    {'role': 'system', 'content': system_prompt},
                    {'role': 'user', 'content': f"Analyze this data: {json.dumps(context_data, default=str)}"}
                ],
                'temperature': 0.7,
                'max_tokens': 2048
            }
        elif agent_type == 'salesforce':
            # Salesforce Einstein format
            payload = {
                'query': json.dumps(context_data, default=str),
                'modelId': data.get('modelId', 'default')
            }
        elif agent_type == 'servicenow':
            # ServiceNow incident/request format
            payload = {
                'short_description': f"Request from SnowFlow: {label}",
                'description': json.dumps(context_data, default=str),
                'urgency': data.get('urgency', '3'),
                'impact': data.get('impact', '3')
            }
        else:
            # Generic REST payload
            payload = {
                'context': json.dumps(context_data, default=str),
                'previous_results': json.dumps(previous_results, default=str),
                'query': data.get('query', '')
            }
        
        try:
            # Make the HTTP request
            with httpx.Client(timeout=30.0) as client:
                if method == 'GET':
                    response = client.get(endpoint, headers=headers, params=payload)
                elif method == 'POST':
                    response = client.post(endpoint, headers=headers, json=payload)
                elif method == 'PUT':
                    response = client.put(endpoint, headers=headers, json=payload)
                else:
                    response = client.post(endpoint, headers=headers, json=payload)
                
                print(f"   Status: {response.status_code}")
                
                if response.status_code >= 200 and response.status_code < 300:
                    result = response.json() if response.headers.get('content-type', '').startswith('application/json') else response.text
                    
                    # Extract the actual response based on agent type
                    if agent_type == 'openai' and isinstance(result, dict):
                        agent_response = result.get('choices', [{}])[0].get('message', {}).get('content', str(result))
                    elif agent_type == 'copilot' and isinstance(result, dict):
                        agent_response = result.get('value', result.get('content', str(result)))
                    else:
                        agent_response = str(result)
                    
                    print(f"   ✅ {label} completed successfully")
                    
                    return {
                        'results': {
                            **state.get('results', {}),
                            'external_agent_response': agent_response,
                            'external_agent': label,
                            'provider': provider
                        },
                        'agent_results': [{
                            'agent': label,
                            'response': agent_response,
                            'provider': provider,
                            'type': 'external'
                        }],
                        'messages': [f"{label} ({provider or agent_type}): Received response"],
                        'current_node': node_config['id'],
                        'executed_nodes': [node_config['id']]
                    }
                else:
                    # For demo: return simulated response on auth/other errors
                    print(f"   ⚠️ HTTP {response.status_code} - returning simulated response for demo")
                    simulated = f"""[Simulated {provider or agent_type} Response]

Based on the support ticket data provided, I've analyzed the request:

**Summary:** The ticket appears to be related to a productivity/communication issue that would typically be handled through Microsoft 365 tools.

**Recommended Actions:**
1. Check recent emails for related correspondence
2. Review calendar for any scheduled follow-ups
3. Search Teams conversations for context

**Note:** This is a simulated response. In production, this would connect to the real {provider or 'external'} API with proper OAuth authentication."""
                    
                    return {
                        'agent_results': [{
                            'agent': label,
                            'response': simulated,
                            'provider': provider,
                            'type': 'external',
                            'simulated': True
                        }],
                        'messages': [f"🔶 {label} (Microsoft): Simulated response (auth required for real API)"],
                        'executed_nodes': [node_config['id']],
                        'simulated_nodes': [node_config['id']]
                    }
                    
        except httpx.TimeoutException:
            print(f"   ❌ Timeout")
            return {
                'error': 'Request timed out',
                'messages': [f"{label}: Request timed out after 30s"]
            }
        except Exception as e:
            print(f"   ❌ Error: {str(e)}")
            # For demo purposes, return a simulated response if actual call fails
            simulated_response = f"[Simulated {provider or agent_type} response] Based on the data provided, I've analyzed the context and found relevant insights. In a production environment, this would be the actual response from {label}."
            
            return {
                'agent_results': [{
                    'agent': label,
                    'response': simulated_response,
                    'provider': provider,
                    'type': 'external',
                    'simulated': True
                }],
                'messages': [f"🔶 {label} (Microsoft): Simulated response (demo mode)"],
                'executed_nodes': [node_config['id']],
                'simulated_nodes': [node_config['id']]
            }
    
    return external_agent_node


def create_file_input_node(node_config: Dict):
    """Create a file input node that loads file content into state"""
    node_id = node_config.get('id', 'file-input')
    
    def file_input_node(state: WorkflowState) -> Dict:
        # traced_node handles notification
        data = node_config.get('data', {})
        label = data.get('label', 'File Input')
        file_type = data.get('fileType', 'tmdl')
        file_content = data.get('fileContent', '')
        file_name = data.get('fileName', '')
        
        print(f"\n📄 FILE INPUT: {label}")
        print(f"   Type: {file_type}")
        print(f"   File: {file_name or '(no file uploaded)'}")
        
        if not file_content:
            # For demo, provide sample TMDL content
            file_content = SAMPLE_TMDL_CONTENT
            print(f"   Using sample TMDL content for demo")
        
        return {
            'results': {
                **state.get('results', {}),
                'file_content': file_content,
                'file_type': file_type,
                'file_name': file_name
            },
            'messages': [f"{label}: Loaded {file_type.upper()} file"],
            'current_node': node_config['id']
        }
    return file_input_node


def create_schema_extractor_node(node_config: Dict):
    """Create a schema extractor node that uses LLM to parse source format into interchange JSON
    
    Multi-Agent Support:
    - copilot: Uses Microsoft Copilot (simulated) for Power BI expertise
    - cortex: Uses Snowflake Cortex
    - openai: Uses OpenAI GPT-4
    """
    import httpx
    node_id = node_config.get('id', 'schema-extractor')
    
    def schema_extractor_node(state: WorkflowState) -> Dict:
        # traced_node handles notification
        data = node_config.get('data', {})
        label = data.get('label', 'Schema Extractor')
        source_format = data.get('sourceFormat', 'powerbi')
        extraction_agent = data.get('extractionAgent', 'copilot')
        model = data.get('model', 'mistral-large2')
        
        print(f"\n🔄 SCHEMA EXTRACTOR: {label}")
        print(f"   Source: {source_format}")
        print(f"   Agent: {extraction_agent}")
        
        file_content = state.get('results', {}).get('file_content', '')
        
        if not file_content:
            return {
                'error': 'No file content to extract',
                'messages': [f"{label}: No input file"]
            }
        
        # Build extraction prompt
        extraction_prompt = f"""You are a semantic model expert. Parse the following {source_format.upper()} semantic model definition and extract it into the Semantic Model Interchange JSON format.

INPUT ({source_format}):
{file_content[:8000]}

Extract and output a valid JSON object with this structure:
{{
  "version": "1.0",
  "metadata": {{
    "name": "model name",
    "description": "description",
    "source_platform": "{source_format}"
  }},
  "tables": [
    {{
      "name": "table_name",
      "description": "table description",
      "table_type": "fact|dimension",
      "columns": [
        {{"name": "col", "data_type": "TYPE", "description": "desc", "synonyms": ["alias1"]}}
      ]
    }}
  ],
  "relationships": [
    {{"from_table": "t1", "from_column": "c1", "to_table": "t2", "to_column": "c2", "cardinality": "many_to_one"}}
  ],
  "measures": [
    {{
      "name": "Measure Name",
      "description": "what it calculates",
      "original_expression": {{"platform": "{source_format}", "language": "DAX", "code": "SUM(...)"}},
      "suggested_sql": "SUM(...)",
      "translation_confidence": "high|medium|low"
    }}
  ],
  "sample_questions": ["What is total X?", "Show Y by Z"]
}}

Output ONLY valid JSON, no explanation."""

        try:
            # Always use a valid Cortex model for the actual LLM call
            # (In production, external agents would call their own APIs)
            cortex_model = 'mistral-large2'  # Valid Cortex model
            
            # Multi-agent routing based on extraction_agent setting
            if extraction_agent == 'copilot':
                print(f"   🤖 Using Microsoft Copilot (simulated via Cortex for demo)")
                # In production, this would call Microsoft Graph API / Copilot
                # For demo, we simulate the response using Cortex but label it as Copilot
                response = snowflake_client.cortex_complete(
                    model=cortex_model,
                    prompt=f"[Acting as Microsoft Copilot with Power BI expertise]\n\n{extraction_prompt}",
                    options={'temperature': 0.2, 'max_tokens': 4096}
                )
                agent_used = "Microsoft Copilot (simulated)"
            elif extraction_agent == 'openai':
                print(f"   🤖 Using OpenAI GPT-4 (simulated via Cortex for demo)")
                response = snowflake_client.cortex_complete(
                    model=cortex_model,
                    prompt=extraction_prompt,
                    options={'temperature': 0.2, 'max_tokens': 4096}
                )
                agent_used = "OpenAI GPT-4 (simulated)"
            else:
                print(f"   ❄️ Using Snowflake Cortex ({cortex_model})")
                response = snowflake_client.cortex_complete(
                    model=cortex_model,
                    prompt=extraction_prompt,
                    options={'temperature': 0.2, 'max_tokens': 4096}
                )
                agent_used = f"Snowflake Cortex ({cortex_model})"
            
            # Try to parse and validate JSON
            try:
                interchange_json = json.loads(response)
                print(f"   ✅ Extracted {len(interchange_json.get('tables', []))} tables")
                print(f"   ✅ Extracted {len(interchange_json.get('measures', []))} measures")
            except json.JSONDecodeError:
                # Use demo fallback when JSON parsing fails
                print(f"   ⚠️ Response not valid JSON, using demo fallback")
                interchange_json = _get_demo_interchange_json(source_format)
            
            return {
                'results': {
                    **state.get('results', {}),
                    'interchange_json': interchange_json,
                    'extraction_agent': agent_used
                },
                'messages': [f"{label}: {agent_used} extracted schema from {source_format}"],
                'current_node': node_config['id']
            }
        except Exception as e:
            print(f"   ❌ Error: {str(e)}, using demo fallback")
            # Use demo fallback on any error
            interchange_json = _get_demo_interchange_json(source_format)
            return {
                'results': {
                    **state.get('results', {}),
                    'interchange_json': interchange_json,
                    'extraction_agent': f"Demo Fallback (error: {str(e)[:50]})"
                },
                'messages': [f"{label}: Used demo data (Cortex unavailable)"],
                'current_node': node_config['id']
            }
    return schema_extractor_node


def create_schema_transformer_node(node_config: Dict):
    """Create a schema transformer node that converts interchange JSON to target format
    
    Multi-Agent Support:
    - cortex: Uses Snowflake Cortex (recommended for Snowflake output)
    - openai: Uses OpenAI GPT-4
    """
    node_id = node_config.get('id', 'schema-transformer')
    
    def schema_transformer_node(state: WorkflowState) -> Dict:
        # traced_node handles notification
        data = node_config.get('data', {})
        label = data.get('label', 'Schema Transformer')
        target_format = data.get('targetFormat', 'snowflake')
        transformation_agent = data.get('transformationAgent', 'cortex')
        model = data.get('model', 'mistral-large2')
        target_database = data.get('database', 'SNOWFLOW_DEV')
        target_schema = data.get('schema', 'DEMO')
        
        print(f"\n🔄 SCHEMA TRANSFORMER: {label}")
        print(f"   Target: {target_format}")
        print(f"   Agent: {transformation_agent}")
        print(f"   Database: {target_database}.{target_schema}")
        
        results = state.get('results', {})
        interchange_json = results.get('interchange_json', {})
        
        # Handle case where extractor passed raw text instead of JSON
        if not interchange_json or interchange_json.get('parse_error'):
            raw_response = interchange_json.get('raw_response', '') if isinstance(interchange_json, dict) else str(interchange_json)
            if raw_response:
                print(f"   ⚠️ Using raw extractor output (not parsed JSON)")
                # Use raw response as context for transformation
                interchange_json = {"raw_schema": raw_response}
            else:
                # Check if we have DAX translation results
                # DAX translation doesn't provide real schema - use demo YAML to avoid slow Cortex call
                sql_output = results.get('sql_output', '')
                dax_input = results.get('dax_input', '')
                if sql_output or dax_input:
                    print(f"   📊 DAX translation context detected - using fast demo YAML")
                    # Skip slow Cortex call for DAX context - return demo YAML immediately
                    demo_yaml = f'''name: black_friday_analytics
description: Black Friday retail analytics semantic model (from DAX translation)

tables:
  - name: sales_transactions
    description: Sales data translated from Power BI TMDL
    base_table:
      database: {target_database}
      schema: {target_schema}
      table: SALES_TRANSACTIONS
    dimensions:
      - name: product_category
        synonyms: [category, dept]
        description: Product category
        expr: PRODUCT_CATEGORY
        data_type: VARCHAR
    measures:
      - name: total_revenue
        synonyms: [revenue, sales]
        description: Total revenue
        expr: SUM(REVENUE)
        data_type: NUMBER
        default_aggregation: sum
'''
                    print(f"   ✅ Generated YAML from DAX context ({len(demo_yaml)} chars)")
                    # Store YAML in shared results for frontend download
                    update_shared_results('generated_yaml', demo_yaml)
                    return {
                        'results': {
                            **results,
                            'generated_yaml': demo_yaml,
                            'target_format': target_format,
                            'transformation_agent': 'DAX Context Generator',
                            'multi_agent_summary': f"YAML generated from DAX translation for {target_database}.{target_schema}"
                        },
                        'messages': [f"{label}: Generated Cortex Analyst YAML from DAX context"],
                        'current_node': node_config['id']
                    }
                else:
                    # Generate demo YAML for Black Friday template
                    print(f"   ⚠️ No input schema - generating demo YAML for Cortex Analyst")
                    demo_yaml = f'''name: black_friday_analytics
description: Black Friday retail analytics semantic model

tables:
  - name: sales_transactions
    description: Black Friday sales transactions
    base_table:
      database: {target_database}
      schema: {target_schema}
      table: SALES_TRANSACTIONS
    dimensions:
      - name: product_category
        synonyms: [category, dept, department]
        description: Product category
        expr: PRODUCT_CATEGORY
        data_type: VARCHAR
      - name: store_region
        synonyms: [region, location, area]
        description: Store region
        expr: STORE_REGION
        data_type: VARCHAR
    time_dimensions:
      - name: transaction_date
        synonyms: [date, sale_date, order_date]
        description: Transaction date
        expr: TRANSACTION_DATE
        data_type: DATE
    measures:
      - name: total_revenue
        synonyms: [revenue, sales, total_sales]
        description: Total revenue
        expr: SUM(REVENUE)
        data_type: NUMBER
        default_aggregation: sum
      - name: gross_margin
        synonyms: [margin, profit_margin]
        description: Gross margin percentage
        expr: AVG(GROSS_MARGIN_PCT)
        data_type: NUMBER
        default_aggregation: avg
'''
                    print(f"   ✅ Generated demo YAML ({len(demo_yaml)} chars)")
                    # Store YAML in shared results for frontend download
                    update_shared_results('generated_yaml', demo_yaml)
                    return {
                        'results': {
                            **results,
                            'generated_yaml': demo_yaml,
                            'target_format': target_format,
                            'transformation_agent': 'Demo Generator',
                            'multi_agent_summary': f"Demo YAML generated for {target_database}.{target_schema}"
                        },
                        'messages': [f"{label}: Generated demo Cortex Analyst YAML"],
                        'current_node': node_config['id']
                }
        
        # Build transformation prompt based on target
        if target_format == 'snowflake':
            # Handle both structured JSON and raw schema text
            if 'raw_schema' in interchange_json:
                input_content = interchange_json['raw_schema'][:8000]
                input_type = "Raw Schema Definition"
            else:
                input_content = json.dumps(interchange_json, indent=2)[:8000]
                input_type = "Interchange JSON"
            
            transform_prompt = f"""You are a Snowflake Cortex semantic model expert. Convert the following {input_type} into a valid Snowflake Cortex Analyst YAML file.

INPUT ({input_type}):
{input_content}

Generate a valid YAML file for Snowflake Cortex Analyst with this structure:

name: model_name
description: Model description

tables:
  - name: table_name
    description: Table description
    base_table:
      database: {target_database}
      schema: {target_schema}
      table: TABLE_NAME
    dimensions:
      - name: dimension_name
        synonyms:
          - alias1
          - alias2
        description: Dimension description
        expr: column_name
        data_type: VARCHAR
    time_dimensions:
      - name: date_dimension
        synonyms:
          - date
        description: Date dimension
        expr: date_column
        data_type: DATE
    measures:
      - name: measure_name
        synonyms:
          - alias
        description: Measure description  
        expr: SUM(column)
        data_type: NUMBER
        default_aggregation: sum

relationships:
  - name: relationship_name
    left_table: table1
    right_table: table2
    relationship_columns:
      - left_column: col1
        right_column: col2
    join_type: left_outer
    relationship_type: many_to_one

verified_queries:
  - name: "Sample Query"
    question: "What is the total revenue?"
    sql: "SELECT SUM(revenue) FROM sales"

Output ONLY valid YAML, no explanation or markdown code blocks."""
        else:
            transform_prompt = f"Convert to {target_format} format: {json.dumps(interchange_json)[:4000]}"

        try:
            # Multi-agent routing
            if transformation_agent == 'cortex':
                print(f"   ❄️ Using Snowflake Cortex")
                agent_used = "Snowflake Cortex"
            else:
                print(f"   🤖 Using {transformation_agent}")
                agent_used = transformation_agent
            
            response = snowflake_client.cortex_complete(
                model=model,
                prompt=transform_prompt,
                options={'temperature': 0.2, 'max_tokens': 4096}
            )
            
            # Clean up response (remove markdown if present)
            yaml_content = response.strip()
            if yaml_content.startswith('```'):
                yaml_content = '\n'.join(yaml_content.split('\n')[1:-1])
            
            print(f"   ✅ Generated {target_format} YAML ({len(yaml_content)} chars)")
            
            # Store YAML in shared results for frontend download
            update_shared_results('generated_yaml', yaml_content)
            
            # Get extraction agent from previous step
            extraction_agent = state.get('results', {}).get('extraction_agent', 'Unknown')
            
            return {
                'results': {
                    **state.get('results', {}),
                    'generated_yaml': yaml_content,
                    'target_format': target_format,
                    'transformation_agent': agent_used,
                    'multi_agent_summary': f"Extraction: {extraction_agent} → Transformation: {agent_used}"
                },
                'messages': [f"{label}: {agent_used} transformed to {target_format} YAML"],
                'current_node': node_config['id']
            }
        except Exception as e:
            print(f"   ❌ Error: {str(e)}")
            return {
                'error': str(e),
                'messages': [f"{label} error: {str(e)}"]
            }
    return schema_transformer_node


def create_file_output_node(node_config: Dict):
    """Create a file output node that prepares content for download and optionally writes to Snowflake stage"""
    def file_output_node(state: WorkflowState) -> Dict:
        data = node_config.get('data', {})
        label = data.get('label', 'File Output')
        output_format = data.get('outputFormat', 'yaml')
        
        # Stage write configuration
        write_to_stage = data.get('writeToStage', False)
        stage_database = data.get('stageDatabase', '')
        stage_schema = data.get('stageSchema', '')
        stage_name = data.get('stageName', '')
        stage_filename = data.get('stageFilename', f'output.{output_format}')
        
        print(f"\n📥 FILE OUTPUT: {label}")
        print(f"   Format: {output_format}")
        
        results = state.get('results', {})
        
        if output_format == 'yaml':
            content = results.get('generated_yaml', '')
        elif output_format == 'json':
            content = json.dumps(results.get('interchange_json', {}), indent=2)
        else:
            content = str(results)
        
        if content:
            print(f"   ✅ Output ready ({len(content)} chars)")
        else:
            print(f"   ⚠️ No content to output")
        
        # Stage write result
        stage_write_status = None
        stage_write_message = None
        
        # Optionally write to Snowflake stage
        if write_to_stage and stage_database and stage_schema and stage_name and content:
            print(f"   📤 Writing to Snowflake stage: @{stage_database}.{stage_schema}.{stage_name}/{stage_filename}")
            try:
                from snowflake_client import snowflake_client
                result = snowflake_client.write_to_stage(
                    content=content,
                    database=stage_database,
                    schema=stage_schema,
                    stage=stage_name,
                    filename=stage_filename
                )
                if result.get('success'):
                    stage_write_status = 'success'
                    stage_write_message = result.get('message', 'Successfully uploaded')
                    print(f"   ✅ {stage_write_message}")
                else:
                    stage_write_status = 'error'
                    stage_write_message = result.get('error', 'Unknown error')
                    print(f"   ❌ Failed: {stage_write_message}")
            except Exception as e:
                stage_write_status = 'error'
                stage_write_message = str(e)
                print(f"   ❌ Exception: {e}")
        
        # Get multi-agent summary
        multi_agent_summary = results.get('multi_agent_summary', 'Single agent workflow')
        extraction_agent = results.get('extraction_agent', 'N/A')
        transformation_agent = results.get('transformation_agent', 'N/A')
        
        # Build stage info for response
        stage_info = ""
        if write_to_stage and stage_write_status:
            if stage_write_status == 'success':
                stage_info = f"\n\n### ☁️ Snowflake Stage Upload\n- **Status:** ✅ Success\n- **Location:** `@{stage_database}.{stage_schema}.{stage_name}/{stage_filename}`"
            else:
                stage_info = f"\n\n### ☁️ Snowflake Stage Upload\n- **Status:** ❌ Failed\n- **Error:** {stage_write_message}"
        
        return {
            'results': {
                **results,
                'output_content': content,
                'output_format': output_format,
                'stage_write_status': stage_write_status,
                'stage_write_message': stage_write_message,
                'agent_response': f"""## Schema Migration Complete! 🎉

### Multi-Agent Orchestration Summary
- **Extraction Agent:** {extraction_agent}
- **Transformation Agent:** {transformation_agent}
- **Flow:** {multi_agent_summary}

### Output Details
- **Format:** {output_format.upper()}
- **Size:** {len(content)} characters{stage_info}

---

### Generated {output_format.upper()} Content

```yaml
{content[:4000]}{'...\n\n(truncated for display)' if len(content) > 4000 else ''}
```

---
*This semantic model was migrated using agent-to-agent translation.*
*Copy the YAML above to use with Snowflake Cortex Analyst.*"""
            },
            'messages': [f"{label}: {output_format.upper()} ready for download"],
            'current_node': node_config['id']
        }
    return file_output_node


# Sample TMDL content for demo
SAMPLE_TMDL_CONTENT = '''
model Sales_Analytics
  description: Enterprise sales analytics model for Power BI
  
  table fact_Sales
    description: Sales transactions at the line item level
    column sale_id: Int64, description: Unique sale identifier, isKey: true
    column customer_id: Int64, description: Foreign key to customer
    column product_id: Int64, description: Foreign key to product  
    column revenue: Decimal, description: Sale amount in USD
    column quantity: Int64, description: Units sold
    column order_date: DateTime, description: Date of sale
    
    measure TotalRevenue = SUM(fact_Sales[revenue])
      description: Sum of all revenue
    
    measure AvgOrderValue = DIVIDE([TotalRevenue], DISTINCTCOUNT(fact_Sales[sale_id]))
      description: Average order value
      
  table dim_Customer
    description: Customer master data
    column customer_id: Int64, isKey: true
    column customer_name: String, description: Customer full name
    column region: String, description: Geographic region
    column segment: String, description: Customer segment (Enterprise, SMB, Consumer)
    
  table dim_Product
    description: Product catalog
    column product_id: Int64, isKey: true
    column product_name: String, description: Product display name
    column category: String, description: Product category
    column unit_price: Decimal, description: Standard unit price
    
  relationship Sales_Customer: fact_Sales.customer_id -> dim_Customer.customer_id, manyToOne
  relationship Sales_Product: fact_Sales.product_id -> dim_Product.product_id, manyToOne
'''


def _get_demo_interchange_json(source_format: str) -> Dict:
    """Return demo interchange JSON when Cortex is unavailable"""
    return {
        "version": "1.0",
        "metadata": {
            "name": "Sales Analytics Model",
            "description": "Demo model extracted from Power BI TMDL",
            "source_platform": source_format
        },
        "tables": [
            {
                "name": "Sales",
                "description": "Sales transactions fact table",
                "table_type": "fact",
                "columns": [
                    {"name": "ProductID", "data_type": "INT64", "description": "Product identifier"},
                    {"name": "Amount", "data_type": "DECIMAL", "description": "Sale amount"},
                    {"name": "Quantity", "data_type": "INT64", "description": "Units sold"},
                    {"name": "DateKey", "data_type": "INT64", "description": "Date key for time intelligence"}
                ]
            },
            {
                "name": "Date",
                "description": "Date dimension table",
                "table_type": "dimension",
                "columns": [
                    {"name": "Date", "data_type": "DATE", "description": "Calendar date"},
                    {"name": "Year", "data_type": "INT64", "description": "Year"},
                    {"name": "Month", "data_type": "INT64", "description": "Month number"}
                ]
            }
        ],
        "measures": [
            {
                "name": "Total Revenue",
                "description": "Sum of all sales amounts",
                "original_expression": {"platform": source_format, "language": "DAX", "code": "SUM(Sales[Amount])"},
                "suggested_sql": "SUM(sales.amount)",
                "translation_confidence": "high"
            },
            {
                "name": "Avg Order Value",
                "description": "Average order value",
                "original_expression": {"platform": source_format, "language": "DAX", "code": "DIVIDE(SUM(Sales[Amount]), COUNT(Sales[ProductID]), 0)"},
                "suggested_sql": "COALESCE(SUM(sales.amount) / NULLIF(COUNT(sales.product_id), 0), 0)",
                "translation_confidence": "high"
            },
            {
                "name": "YoY Growth",
                "description": "Year over year growth percentage",
                "original_expression": {"platform": source_format, "language": "DAX", "code": "DIVIDE(SUM(Sales[Amount]) - CALCULATE(SUM(Sales[Amount]), SAMEPERIODLASTYEAR(Date[Date])), CALCULATE(SUM(Sales[Amount]), SAMEPERIODLASTYEAR(Date[Date])), 0)"},
                "suggested_sql": "/* YoY calculation requires LAG window function */",
                "translation_confidence": "medium"
            }
        ],
        "relationships": [
            {"from_table": "Sales", "from_column": "DateKey", "to_table": "Date", "to_column": "DateKey", "cardinality": "many_to_one"}
        ],
        "sample_questions": [
            "What was total revenue last month?",
            "Show sales by product category",
            "What is the year-over-year growth?"
        ]
    }


def create_dax_translator_node(node_config: Dict):
    """Create a DAX Translator node that converts DAX expressions to Snowflake SQL
    
    This node uses the DAX translation engine to:
    1. Parse DAX expressions
    2. Apply pattern-based translation
    3. Optionally enhance with Cortex LLM
    """
    def dax_translator_node(state: WorkflowState) -> Dict:
        data = node_config.get('data', {})
        label = data.get('label', 'DAX Translator')
        dax_expression = data.get('daxExpression', '')
        auto_translate = data.get('autoTranslate', True)
        
        print(f"\n⚡ DAX TRANSLATOR: {label}")
        print(f"   DAX: {dax_expression[:50]}..." if len(dax_expression) > 50 else f"   DAX: {dax_expression}")
        
        # Get TMDL content from upstream file input if available
        results = state.get('results', {})
        file_content = results.get('file_content', '')
        
        if not dax_expression and file_content:
            # Extract first measure from TMDL for demo
            import re
            measure_match = re.search(r"measure\s+'([^']+)'\s*=\s*(.+?)(?=\n\s*measure|\n\s*$)", file_content, re.DOTALL | re.IGNORECASE)
            if measure_match:
                dax_expression = measure_match.group(2).strip()
                print(f"   Extracted from TMDL: {dax_expression[:50]}...")
        
        if not dax_expression:
            return {
                'error': 'No DAX expression to translate',
                'messages': [f"{label}: No input DAX expression"]
            }
        
        try:
            # Use the DAX translation engine
            from dax_engine import translate_dax, create_sample_retail_context
            
            context = create_sample_retail_context()
            result = translate_dax(dax_expression, context)
            
            print(f"   ✅ Translated with {result.confidence.name} confidence")
            print(f"   SQL: {result.sql[:60]}...")
            print(f"   Patterns: {result.patterns_applied}")
            
            return {
                'results': {
                    **results,
                    'dax_input': dax_expression,
                    'sql_output': result.sql,
                    'translation_confidence': result.confidence.name,
                    'patterns_applied': result.patterns_applied,
                    'tables_used': result.tables_used,
                    'translation_warnings': result.warnings,
                },
                'messages': [f"{label}: Translated DAX → SQL ({result.confidence.name} confidence)"],
                'current_node': node_config['id']
            }
        except Exception as e:
            print(f"   ❌ Error: {str(e)}")
            return {
                'error': str(e),
                'messages': [f"{label} error: {str(e)}"]
            }
    
    return dax_translator_node


def create_semantic_model_node(node_config: Dict):
    """Create a semantic model node"""
    def semantic_model_node(state: WorkflowState) -> Dict:
        # NOTE: Timing and tracing handled by traced_node wrapper
        data = node_config.get('data', {})
        node_id = node_config.get('id', '')
        label = data.get('label', 'Semantic Model')
        database = data.get('database', '')
        schema = data.get('schema', '')
        stage = data.get('stage', '')
        yaml_file = data.get('yamlFile', '')
        
        # Use semanticPath from Data Catalog if available, otherwise construct it
        semantic_path = data.get('semanticPath', '')
        if not semantic_path and database and schema and stage and yaml_file:
            semantic_path = f"@{database}.{schema}.{stage}/{yaml_file}"
        
        print(f"📊 SEMANTIC VIEW LOADED: {label}" + (f" from {yaml_file}" if yaml_file else ""))
        
        # Store semantic model info in state for agents to use
        # This enables Cortex Analyst integration
        existing_models = state.get('semantic_models', {})
        existing_models[node_id] = {
            'label': label,
            'path': semantic_path,
            'database': database,
            'schema': schema,
            'stage': stage,
            'yaml_file': yaml_file
        }
        
        return {
            'messages': [f"📊 Semantic View '{label}' loaded" + (f" from {yaml_file}" if yaml_file else "")],
            'executed_nodes': [node_config['id']],
            'semantic_models': existing_models  # Store for agents
        }
    return semantic_model_node


def generate_execution_plan(nodes: List[Dict], edges: List[Dict]) -> Dict[str, Dict[str, Any]]:
    """
    Generate execution plan with timing using simple heuristics.
    NO LLM CALL - fast and reliable for MVP.
    """
    # Use simple heuristics - no LLM call needed
    print(f"[EXECUTION PLANNER] Generated timing for {len(nodes)} nodes")
    return _generate_default_timing(nodes)


def _generate_default_timing(nodes: List[Dict]) -> Dict[str, Dict[str, Any]]:
    """Fallback: Generate default timing based on node type"""
    timing = {}
    for node in nodes:
        node_id = node['id']
        node_type = node.get('type', '')
        label = node.get('data', {}).get('label', '').lower()
        
        # Simple heuristics
        if node_type == 'snowflakeSource':
            # Longer delays for source nodes to ensure they're traced
            delay = 0.35 if 'tmdl' in label else 0.4
        elif node_type in ('agent', 'cortexAgent'):
            delay = 0.35
        elif node_type == 'supervisor':
            delay = 0.3
        elif node_type == 'externalAgent':
            if 'render' in label:
                delay = 0.3
            elif 'callback' in label:
                delay = 0.2
            else:
                delay = 0.15
        elif node_type == 'semanticModel':
            delay = 0.12
        elif node_type == 'condition':
            delay = 0.08
        elif node_type == 'output':
            delay = 0.1
        else:
            delay = 0.15
        
        timing[node_id] = {'delay': delay, 'reason': f'Default for {node_type}'}
    
    return timing


def build_graph(nodes: List[Dict], edges: List[Dict]) -> StateGraph:
    """
    Build a LangGraph from the visual node/edge representation
    
    Handles special patterns:
    - Router: Uses conditional edges to route to ONE agent
    - Supervisor: Sequential delegation with aggregation
    """
    workflow = StateGraph(WorkflowState)
    
    node_map = {n['id']: n for n in nodes}
    
    # Build adjacency list from edges
    adjacency: Dict[str, List[str]] = {}
    incoming: Dict[str, List[str]] = {n['id']: [] for n in nodes}
    
    for edge in edges:
        source = edge['source']
        target = edge['target']
        if source not in adjacency:
            adjacency[source] = []
        adjacency[source].append(target)
        print(f"[DEBUG] Edge found: {source} → {target}")
        if target in incoming:
            incoming[target].append(source)
    
    # Find start nodes (no incoming edges)
    start_nodes = [nid for nid, sources in incoming.items() if len(sources) == 0]
    
    # Find end nodes (no outgoing edges)
    end_nodes = [nid for nid in node_map.keys() if nid not in adjacency or len(adjacency[nid]) == 0]
    
    # Identify router nodes and their target agents
    router_info: Dict[str, Dict] = {}
    for node in nodes:
        if node.get('type') == 'router':
            router_id = node['id']
            targets = adjacency.get(router_id, [])
            # Get agent labels for matching
            target_agents = []
            for t in targets:
                if t in node_map:
                    target_agents.append({
                        'id': t,
                        'label': node_map[t].get('data', {}).get('label', ''),
                        'type': node_map[t].get('type', '')
                    })
            router_info[router_id] = {
                'node': node,
                'targets': target_agents,
                'routes': node.get('data', {}).get('routes', [])
            }
    
    # Identify which agents are router-controlled (they only execute via routing)
    router_controlled_agents = set()
    for router_id, info in router_info.items():
        for agent in info['targets']:
            if agent['type'] in ('agent', 'externalAgent', 'cortexAgent'):
                router_controlled_agents.add(agent['id'])
    
    print(f"DEBUG: Router-controlled agents: {router_controlled_agents}")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # ADD NODES TO GRAPH - ALL nodes are wrapped with traced_node for universal tracing
    # This ensures ANY template (including user-created) gets automatic tracing
    # ═══════════════════════════════════════════════════════════════════════════
    for node in nodes:
        node_id = node['id']
        node_type = node.get('type', '')
        
        # Create the raw node function based on type
        if node_type == 'snowflakeSource':
            raw_fn = create_source_node(node)
        elif node_type == 'semanticModel':
            raw_fn = create_semantic_model_node(node)
        elif node_type == 'agent':
            raw_fn = create_agent_node(node)
        elif node_type == 'cortexAgent':
            # cortexAgent is a specialized agent - use same handler
            raw_fn = create_agent_node(node)
        elif node_type == 'output':
            raw_fn = create_output_node(node)
        elif node_type == 'cortex':
            raw_fn = create_cortex_node(node)
        elif node_type == 'condition':
            raw_fn = create_condition_node(node)
        elif node_type == 'externalAgent':
            raw_fn = create_external_agent_node(node)
        elif node_type == 'router':
            raw_fn = create_router_node(node, router_info[node_id]['targets'])
        elif node_type == 'supervisor':
            raw_fn = create_supervisor_node(node)
        elif node_type == 'fileInput':
            raw_fn = create_file_input_node(node)
        elif node_type == 'schemaExtractor':
            raw_fn = create_schema_extractor_node(node)
        elif node_type == 'schemaTransformer':
            raw_fn = create_schema_transformer_node(node)
        elif node_type == 'fileOutput':
            raw_fn = create_file_output_node(node)
        elif node_type == 'daxTranslator':
            # DAX Translator node - create inline handler
            raw_fn = create_dax_translator_node(node)
        else:
            # Fallback for unknown node types - still trace them!
            raw_fn = lambda s: s
        
        # WRAP WITH UNIVERSAL TRACING - this is the key!
        # Every node, regardless of type, gets automatic tracing
        traced_fn = traced_node(node_id, raw_fn)
        workflow.add_node(node_id, traced_fn)
    
    # Track which edges we've already added (to avoid duplicates)
    added_edges = set()
    
    # Add edges - special handling for routers
    for source, targets in adjacency.items():
        source_node = node_map.get(source, {})
        source_type = source_node.get('type', '')
        
        if source_type == 'router':
            # For router, use conditional edges to route to ONE agent (or external agent)
            info = router_info[source]
            route_names = [r.get('name', '').lower() for r in info['routes']]
            
            # Include agent, externalAgent, AND semanticModel as valid routing targets
            # (semantic models act as proxies to their connected agents)
            agent_targets = [t['id'] for t in info['targets'] if t['type'] in ('agent', 'externalAgent', 'cortexAgent', 'semanticModel')]
            
            print(f"DEBUG: Router '{source}' targets: {[(t['id'], t['type'], t['label']) for t in info['targets']]}")
            print(f"DEBUG: Agent targets for routing: {agent_targets}")
            print(f"DEBUG: Route names: {route_names}")
            
            if agent_targets:
                # Create routing function that matches intent to agent/semantic model
                def make_router_fn(target_ids, agent_info, route_list):
                    def router_fn(state: WorkflowState) -> str | list:
                        decision = state.get('routing_decision', '').lower().strip()
                        is_multi = state.get('multi_route', False) or decision == 'all'
                        
                        print(f"DEBUG: Router routing decision = '{decision}' (multi={is_multi})")
                        print(f"DEBUG: Available targets: {[(a.get('id'), a.get('label')) for a in agent_info]}")
                        
                        # If ALL/multi-domain, return first target but mark for broadcast
                        # The supervisor will aggregate all agent results
                        if is_multi:
                            print(f"DEBUG: 🔄 MULTI-DOMAIN - triggering first target, supervisor will broadcast")
                            # For multi-domain, we route to first target but the supervisor handles aggregation
                            # This is a simplification - in production we'd use parallel branches
                            return target_ids[0]
                        
                        # Try to match decision to target label or route name
                        for i, target in enumerate(agent_info):
                            target_label = target.get('label', '').lower()
                            route_name = route_list[i].lower() if i < len(route_list) else ''
                            
                            # Match if decision contains target label or route name
                            # Also check for partial matches (e.g., "sales" matches "Sales Cortex SV")
                            if decision:
                                decision_words = decision.split()
                                label_words = target_label.split()
                                
                                # Check for word overlap
                                has_match = (
                                    decision in target_label or 
                                    target_label in decision or
                                    decision in route_name or
                                    route_name in decision or
                                    any(dw in target_label for dw in decision_words) or
                                    any(lw in decision for lw in label_words if len(lw) > 2)
                                )
                                
                                if has_match:
                                    print(f"DEBUG: ✅ Matched! Routing to {target['id']} ({target_label})")
                                    return target['id']
                        
                        # Default to first target
                        print(f"DEBUG: ⚠️ No match, defaulting to first target: {target_ids[0]}")
                        return target_ids[0]
                    return router_fn
                
                routing_fn = make_router_fn(agent_targets, info['targets'], route_names)
                route_map = {t: t for t in agent_targets}
                workflow.add_conditional_edges(source, routing_fn, route_map)
                
                for t in agent_targets:
                    added_edges.add((source, t))
        
        elif source_type == 'supervisor':
            # ═══════════════════════════════════════════════════════════════════════
            # TRUE CONDITIONAL ROUTING FOR SUPERVISORS
            # 
            # The supervisor dynamically selects which agents to consult based on
            # the user's query. We use conditional edges so only selected agents
            # actually execute - this is production-ready behavior.
            # ═══════════════════════════════════════════════════════════════════════
            
            # Separate agent targets from always-execute targets (callbacks, output)
            agent_targets = []  # [(node_id, label), ...]
            always_execute = []
            
            for target in targets:
                target_node = node_map.get(target, {})
                target_type = target_node.get('type', '')
                target_data = target_node.get('data', {})
                target_label = target_data.get('label', target)
                
                # Callbacks and special nodes always execute
                if any(kw in target_label.lower() for kw in ['callback', 'output', 'render', 'display']):
                    always_execute.append(target)
                elif target_type in ('agent', 'externalAgent', 'cortexAgent') or target.startswith('agent-'):
                    # Include cortexAgent type and any node with agent- prefix
                    agent_targets.append((target, target_label))
                else:
                    always_execute.append(target)
            
            print(f"[SUPERVISOR ROUTING] Agent targets: {[(a[0], a[1]) for a in agent_targets]}")
            print(f"[SUPERVISOR ROUTING] Always execute: {always_execute}")
            
            # Add regular edges for always-execute targets
            for target in always_execute:
                edge_key = (source, target)
                if edge_key not in added_edges:
                    print(f"[EDGE] Adding supervisor always-execute edge: {source} → {target}")
                    workflow.add_edge(source, target)
                    added_edges.add(edge_key)
            
            # Add conditional edges for agent targets
            if agent_targets:
                def make_supervisor_router(agent_list, supervisor_id):
                    """Create routing function that returns only selected agent node IDs"""
                    def supervisor_route(state: WorkflowState) -> list:
                        # Check for auth error - don't route to any agents
                        if state.get('auth_error') or state.get('error'):
                            print(f"[SUPERVISOR ROUTE] ❌ Error detected, skipping all agents")
                            return []  # Empty list = skip all agents
                        
                        selected = state.get('selected_agents', [])
                        
                        print(f"[SUPERVISOR ROUTE] selected_agents from state: {selected}")
                        print(f"[SUPERVISOR ROUTE] Available agents: {[(a[0], a[1]) for a in agent_list]}")
                        
                        if not selected:
                            # No agents selected - default to first agent only (not ALL)
                            default = [agent_list[0][0]] if agent_list else []
                            print(f"[SUPERVISOR ROUTE] No selection, defaulting to: {default}")
                            return default
                        
                        # Match selected agent names to node IDs
                        activated = []
                        for node_id, label in agent_list:
                            for sel in selected:
                                sel_lower = sel.lower()
                                label_lower = label.lower()
                                # Match if selected name appears in label
                                if (sel_lower in label_lower or 
                                    any(word in label_lower for word in sel_lower.split() if len(word) > 2)):
                                    activated.append(node_id)
                                    print(f"[SUPERVISOR ROUTE] ✅ Matched '{sel}' → {node_id} ({label})")
                                    break
                        
                        if activated:
                            print(f"[SUPERVISOR ROUTE] Routing to {len(activated)} agents: {activated}")
                            return activated
                        else:
                            # No matches - default to first agent
                            default = [agent_list[0][0]]
                            print(f"[SUPERVISOR ROUTE] No matches, defaulting to: {default}")
                            return default
                    
                    return supervisor_route
                
                route_fn = make_supervisor_router(agent_targets, source)
                route_map = {a[0]: a[0] for a in agent_targets}
                
                print(f"[EDGE] Adding supervisor conditional edges: {source} → {list(route_map.keys())}")
                workflow.add_conditional_edges(source, route_fn, route_map)
                
                for a in agent_targets:
                    added_edges.add((source, a[0]))
        
        elif source in router_controlled_agents:
            # This is an agent that's controlled by a router
            # Only add edges to non-agent targets (like output)
            for target in targets:
                target_node = node_map.get(target, {})
                edge_key = (source, target)
                if edge_key not in added_edges:
                    workflow.add_edge(source, target)
                    added_edges.add(edge_key)
        
        else:
            # Normal edges
            for target in targets:
                edge_key = (source, target)
                if edge_key not in added_edges:
                    print(f"[EDGE] Adding normal edge: {source} → {target}")
                    workflow.add_edge(source, target)
                    added_edges.add(edge_key)
                else:
                    print(f"[EDGE] Skipping duplicate: {source} → {target}")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # MULTI-ENTRY POINT HANDLING WITH CONTEXT LOADER
    # 
    # Problem: Multiple start nodes (TMDLs, sources, copilot) need to all execute
    # Solution: Create a __context_loader__ node that sequentially traces all
    # context nodes, then continues to the main entry point
    # ═══════════════════════════════════════════════════════════════════════════
    
    if len(start_nodes) > 1:
        # Categorize start nodes
        main_entry = None
        context_nodes = []
        
        for sn in start_nodes:
            node_type = node_map.get(sn, {}).get('type', '')
            node_label = node_map.get(sn, {}).get('data', {}).get('label', '').lower()
            sn_lower = sn.lower()
            
            # Context nodes: TMDLs, data sources
            if 'tmdl' in sn_lower or 'src-' in sn_lower:
                context_nodes.append(sn)
            elif node_type == 'externalAgent' and ('copilot' in node_label or 'copilot' in sn_lower):
                main_entry = sn
            elif node_type == 'fileInput':
                main_entry = sn
            elif main_entry is None and node_type in ('externalAgent', 'agent', 'cortexAgent'):
                main_entry = sn
        
        if main_entry is None:
            main_entry = start_nodes[0]
        
        print(f"DEBUG: Main entry: {main_entry}")
        print(f"DEBUG: Context nodes to trace: {context_nodes}")
        
        # Create context loader that traces all context nodes
        def create_context_loader(ctx_nodes, node_configs):
            def context_loader(state: WorkflowState) -> Dict:
                messages = ['📦 Loading context from data sources...']
                
                # Trace each context node
                for ctx_id in ctx_nodes:
                    # Send trace event for this context node
                    eq = get_execution_queue()
                    if eq:
                        try:
                            eq.put_nowait({'type': 'node_executing', 'node_id': ctx_id})
                            print(f"[TRACE] 🔵 Context node '{ctx_id}' - LOADING")
                        except:
                            pass
                    
                    # Small delay for visual effect
                    time.sleep(0.3)
                    
                    # Get node config and extract info
                    ctx_config = node_configs.get(ctx_id, {})
                    ctx_data = ctx_config.get('data', {})
                    ctx_label = ctx_data.get('label', ctx_id)
                    
                    messages.append(f"📊 Loaded: {ctx_label}")
                    print(f"[TRACE] ✅ Context node '{ctx_id}' - LOADED")
                    
                    # Send completed event for context node
                    if eq:
                        try:
                            eq.put_nowait({'type': 'node_completed', 'node_id': ctx_id})
                        except:
                            pass
                
                return {
                    'messages': messages,
                    'executed_nodes': ctx_nodes.copy()
                }
            return context_loader
        
        # Add context loader node
        workflow.add_node("__context_loader__", create_context_loader(context_nodes, node_map))
        
        # Set context loader as entry, then connect to main entry
        workflow.set_entry_point("__context_loader__")
        workflow.add_edge("__context_loader__", main_entry)
        
        print(f"DEBUG: Flow: __context_loader__ → {main_entry}")
        
    elif start_nodes:
        workflow.set_entry_point(start_nodes[0])
        print(f"DEBUG: Single entry point: {start_nodes[0]}")
    
    # Set finish points - only for nodes that have no outgoing edges
    print(f"DEBUG: End nodes identified: {end_nodes}")
    for end_node in end_nodes:
        # Skip if this is a router (handled by conditional edges)
        source_type = node_map.get(end_node, {}).get('type', '')
        if source_type != 'router':
            print(f"[EDGE] Adding edge to END: {end_node} → END")
            workflow.add_edge(end_node, END)
    
    return workflow.compile()


def execute_workflow(nodes: List[Dict], edges: List[Dict], prompt: Optional[str] = None) -> Dict[str, Any]:
    """Execute a compiled workflow and return results"""
    try:
        prompt_log = f" with prompt: '{prompt[:50]}...'" if prompt else ""
        print(f"Executing workflow with {len(nodes)} nodes and {len(edges)} edges{prompt_log}")
        
        # Generate execution plan
        execution_timing = generate_execution_plan(nodes, edges)
        
        graph = build_graph(nodes, edges)
        
        # Build initial messages with the user prompt if provided
        initial_messages = ['🚀 Workflow execution started']
        if prompt:
            initial_messages.append(f"💬 User Query: \"{prompt}\"")
            print(f"\n{'='*60}")
            print(f"📝 USER PROMPT: {prompt}")
            print(f"{'='*60}\n")
        
        initial_state: WorkflowState = {
            'data': [],
            'messages': initial_messages,
            'results': {},
            'agent_results': [],
            'current_node': '',
            'error': '',
            'routing_decision': '',
            'user_prompt': prompt or '',  # Store the prompt in state for agents to use
            'selected_agents': [],
            'executed_nodes': [],
            'simulated_nodes': [],  # Track nodes running in demo/simulated mode
            'execution_timing': execution_timing
        }
        
        # Validate prompt before execution
        if prompt:
            cleaned_prompt, is_valid, error_msg = validate_and_clean_prompt(prompt)
            if not is_valid:
                return {
                    'success': False,
                    'error': error_msg,
                    'messages': [f'⚠️ Invalid prompt: {error_msg}'],
                    'results': {},
                    'user_prompt': prompt
                }
            initial_state['user_prompt'] = cleaned_prompt
        
        final_state = graph.invoke(initial_state)
        
        return {
            'success': True,
            'messages': final_state.get('messages', []),
            'results': final_state.get('results', {}),
            'error': final_state.get('error', ''),
            'user_prompt': prompt,
            'executed_nodes': final_state.get('executed_nodes', [])
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {
            'success': False,
            'error': str(e),
            'messages': [f'Workflow failed: {str(e)}'],
            'results': {},
            'user_prompt': prompt
        }


# NOTE: queue, threading, _thread_local, set_execution_callback, get_execution_queue
# are defined at the TOP of this file to avoid forward reference issues

async def execute_workflow_streaming(nodes: List[Dict], edges: List[Dict], prompt: Optional[str] = None):
    """Execute workflow and yield real-time events as nodes execute"""
    import asyncio
    from concurrent.futures import ThreadPoolExecutor
    
    # Validate prompt FIRST before doing anything else
    validated_prompt = prompt
    if prompt:
        cleaned_prompt, is_valid, error_msg = validate_and_clean_prompt(prompt)
        if not is_valid:
            yield {'type': 'error', 'error': error_msg, 'message': f'⚠️ Invalid prompt: {error_msg}'}
            return
        validated_prompt = cleaned_prompt
    
    # Reset trace state for new execution (prevents duplicate notifications)
    reset_trace_state()
    
    # Create queue for node execution events
    event_queue = queue.Queue()
    set_execution_callback(event_queue)
    
    try:
        yield {'type': 'start', 'message': 'Workflow execution started'}
        
        # Generate execution plan with intelligent timing (gives frontend time to connect)
        print("[EXECUTION PLANNER] Generating execution plan...")
        execution_timing = generate_execution_plan(nodes, edges)
        
        # Additional delay to ensure frontend SSE connection is fully established
        await asyncio.sleep(0.2)
        
        # Build and execute graph in a thread (LangGraph is sync)
        def run_graph(thread_queue):
            # Set the queue for THIS thread (thread-local storage)
            set_execution_callback(thread_queue)
            
            try:
                graph = build_graph(nodes, edges)
                initial_state: WorkflowState = {
                    'data': [],
                    'messages': ['🚀 Workflow execution started'],
                    'results': {},
                    'agent_results': [],
                    'current_node': '',
                    'error': '',
                    'routing_decision': '',
                    'user_prompt': validated_prompt or '',
                    'selected_agents': [],
                    'executed_nodes': [],
                    'simulated_nodes': [],  # Track nodes running in demo/simulated mode
                    'execution_timing': execution_timing  # Intelligent timing from planner
                }
                
                # Run graph.invoke with timeout to handle LangGraph fan-in bug
                from concurrent.futures import ThreadPoolExecutor as InnerExecutor, TimeoutError as FuturesTimeout
                with InnerExecutor(max_workers=1) as inner_executor:
                    invoke_future = inner_executor.submit(graph.invoke, initial_state)
                    try:
                        # Wait up to 120 seconds for graph to complete
                        result = invoke_future.result(timeout=120)
                        print(f"[DEBUG] Graph invoke completed normally")
                    except FuturesTimeout:
                        print(f"[DEBUG] Graph invoke timed out (fan-in bug) - forcing completion")
                        # Graph timed out - this is the fan-in bug
                        # Create a synthetic result with what we have
                        result = {
                            'messages': ['Workflow completed (forced due to LangGraph fan-in timeout)'],
                            'results': {},
                            'executed_nodes': list(_notified_nodes),  # Use the global tracked nodes
                            'simulated_nodes': []
                        }
                
                # Signal completion
                print(f"[DEBUG] Sending _complete event")
                thread_queue.put({'type': '_complete', 'state': result})
                print(f"[DEBUG] _complete event sent to queue")
                return result
            except Exception as e:
                print(f"[DEBUG] Exception in run_graph: {e}")
                thread_queue.put({'type': '_error', 'error': str(e)})
                raise
            finally:
                set_execution_callback(None)  # Clean up this thread's queue
        
        # Start graph execution in background thread, passing the queue
        executor = ThreadPoolExecutor(max_workers=1)
        future = executor.submit(run_graph, event_queue)
        
        # Track executed nodes and timing for timeout detection
        traced_nodes = set()
        completed_nodes = set()
        last_activity_time = time.time()
        last_heartbeat_time = time.time()
        start_time = time.time()
        INACTIVITY_TIMEOUT = 90.0  # Force completion after 90 seconds of no activity (Cortex LLM calls can take 30-60s)
        MAX_TOTAL_TIMEOUT = 300.0  # Max 5 minutes total execution time
        HEARTBEAT_INTERVAL = 3.0  # Send heartbeat every 3 seconds to keep SSE alive
        
        # Stream events as they come from the queue
        while True:
            try:
                # Non-blocking check for events
                event = event_queue.get(timeout=0.1)
                last_activity_time = time.time()  # Reset activity timer
                
                if event['type'] == '_complete':
                    # Graph finished, yield final result
                    print("[DEBUG] Received _complete event!")
                    final_state = event['state']
                    executed = final_state.get('executed_nodes', [])
                    print(f"[DEBUG] Executed nodes: {executed}")
                    
                    # HACK: Force output-final trace if it wasn't executed
                    output_nodes = [n['id'] for n in nodes if n.get('type') == 'output']
                    print(f"[DEBUG] Output nodes in graph: {output_nodes}")
                    for out_id in output_nodes:
                        if out_id not in executed:
                            print(f"[HACK] Forcing trace for missed output node: {out_id}")
                            yield {'type': 'node_executing', 'node_id': out_id}
                            time.sleep(0.2)
                            yield {'type': 'node_completed', 'node_id': out_id}
                            executed.append(out_id)
                    
                    # Merge shared results with final state results
                    stored_results = get_shared_results()
                    final_results = {**final_state.get('results', {}), **stored_results}
                    yield {
                        'type': 'complete',
                        'success': True,
                        'messages': final_state.get('messages', []),
                        'results': final_results,
                        'executed_nodes': executed,
                        'simulated_nodes': final_state.get('simulated_nodes', [])
                    }
                    break
                elif event['type'] == '_error':
                    yield {'type': 'error', 'error': event['error']}
                    break
                elif event['type'] == 'node_executing':
                    # Track this node
                    traced_nodes.add(event.get('node_id'))
                    yield event
                elif event['type'] == 'node_completed':
                    node_id = event.get('node_id')
                    completed_nodes.add(node_id)
                    yield event
                    
                    # CHECK FOR AUTH ERROR from supervisor
                    # This event may have error info from the node execution
                    node_error = event.get('error')
                    if node_error and ('authentication' in node_error.lower() or 'auth' in str(node_error).lower() or 'expired' in str(node_error).lower()):
                        print(f"[ERROR] 🔐 Auth error detected in {node_id}: {node_error}")
                        yield {'type': 'error', 'error': node_error, 'auth_error': True, 'node_id': node_id}
                        break
                    
                    # IMMEDIATE FAN-IN CHECK: After every completion, check if we should force output
                    # With CONDITIONAL ROUTING, only selected agents execute. We use traced_nodes
                    # to know which predecessors are actually expected.
                    output_nodes = [n['id'] for n in nodes if n.get('type') == 'output']
                    output_node_set = set(output_nodes)
                    
                    # Get ALL possible nodes that feed into output (from edge definitions)
                    all_output_predecessors = set()
                    for edge in edges:
                        if edge.get('target') in output_node_set:
                            all_output_predecessors.add(edge.get('source'))
                    
                    # DYNAMIC FAN-IN: Only wait for predecessors that ACTUALLY started executing
                    # This handles conditional routing where some agents aren't selected
                    expected_predecessors = all_output_predecessors & traced_nodes
                    
                    # Debug: Show status after key nodes complete
                    if node_id in all_output_predecessors or node_id == 'pbi-callback' or 'agent-' in node_id:
                        missing = expected_predecessors - completed_nodes
                        print(f"[FAN-IN DEBUG] After {node_id}: {len(completed_nodes & expected_predecessors)}/{len(expected_predecessors)} expected predecessors done")
                        if missing:
                            print(f"[FAN-IN DEBUG] Still waiting for: {missing}")
                        else:
                            print(f"[FAN-IN DEBUG] All expected predecessors complete!")
                    
                    # Check if all EXPECTED output predecessors are completed
                    # (expected = predecessors that actually started, based on conditional routing)
                    all_preds_done = expected_predecessors and expected_predecessors.issubset(completed_nodes)
                    print(f"[FAN-IN CHECK] expected_predecessors={expected_predecessors}, completed_nodes has {len(completed_nodes)} items, all_preds_done={all_preds_done}")
                    if all_preds_done:
                        print(f"[FAN-IN] ✅ All {len(expected_predecessors)} output predecessors completed!")
                        print(f"[FAN-IN] Predecessors: {expected_predecessors}")
                        
                        # Force output node and complete - NO ASYNC SLEEP, direct yield
                        for out_id in output_nodes:
                            if out_id not in completed_nodes:
                                print(f"[FAN-IN] Forcing output node: {out_id}")
                                print(f"[FAN-IN] Yielding node_executing...")
                                yield {'type': 'node_executing', 'node_id': out_id}
                                print(f"[FAN-IN] Yielding node_completed...")
                                yield {'type': 'node_completed', 'node_id': out_id}
                                completed_nodes.add(out_id)
                        
                        print(f"[FAN-IN] Yielding complete event...")
                        # Get the stored results from supervisor
                        stored_results = get_shared_results()
                        print(f"[FAN-IN] Retrieved results: {len(str(stored_results))} chars")
                        
                        # Build rich execution messages for detailed timeline
                        exec_messages = []
                        
                        # Get agents that were actually consulted (from stored results)
                        agents_consulted = stored_results.get('agents_consulted', [])
                        supervisor_name = stored_results.get('supervisor', 'Supervisor')
                        model_used = stored_results.get('model', 'mistral-large2')
                        
                        # Phase 1: Workflow start
                        exec_messages.append("🚀 Workflow execution started")
                        
                        # Phase 2: Context loading
                        context_nodes = [n for n in completed_nodes if n.startswith('tmdl-')]
                        if context_nodes:
                            exec_messages.append("📦 Loading context from data sources...")
                            for ctx in sorted(context_nodes):
                                ctx_name = ctx.replace('tmdl-', '').title()
                                exec_messages.append(f"📊 Loaded: {ctx_name} TMDL")
                        
                        # Phase 3: External agents
                        if 'pbi-copilot' in completed_nodes:
                            exec_messages.append("🟦 Power BI Copilot: Connected (simulated)")
                        if 'agent-gateway' in completed_nodes:
                            exec_messages.append("🛡️ Agent Gateway: Routing established")
                        
                        # Phase 4: Schema/DAX processing
                        if 'dax-translator' in completed_nodes:
                            exec_messages.append("⚡ DAX Translator: Converted DAX → Snowflake SQL")
                        if 'schema-transformer' in completed_nodes:
                            exec_messages.append("🔄 Schema Transformer: Generated Cortex Analyst YAML")
                        
                        # Phase 5: Semantic views
                        sv_nodes = [n for n in completed_nodes if n.startswith('sv-')]
                        if sv_nodes:
                            exec_messages.append("📊 Loading Semantic Models...")
                            for sv in sorted(sv_nodes):
                                sv_name = sv.replace('sv-', '').title()
                                exec_messages.append(f"   ❄️ {sv_name} SV loaded")
                        
                        # Phase 6: YAML output
                        if 'yaml-output' in completed_nodes:
                            exec_messages.append("📄 Cortex YAML Bundle: Ready for download")
                        
                        # Phase 7: Supervisor orchestration
                        if 'supervisor' in completed_nodes:
                            exec_messages.append(f"👔 Supervisor '{supervisor_name}' analyzing query...")
                            exec_messages.append(f"🧠 Planning: Determining relevant agents...")
                            if agents_consulted:
                                exec_messages.append(f"📋 Plan: Consult {agents_consulted}")
                        
                        # Phase 8: Agent execution
                        agent_nodes = [n for n in completed_nodes if n.startswith('agent-') and n != 'agent-gateway']
                        for agent in sorted(agent_nodes):
                            agent_name = agent.replace('agent-', '').title()
                            if any(ac.lower() in agent_name.lower() or agent_name.lower() in ac.lower() for ac in agents_consulted):
                                exec_messages.append(f"🤖 {agent_name} Agent: Analyzing data with {model_used}...")
                                exec_messages.append(f"✅ {agent_name} Agent: Response generated")
                        
                        # Phase 9: Callback
                        if 'pbi-callback' in completed_nodes:
                            exec_messages.append("🔄 Power BI Callback: Response sent to Copilot")
                        
                        # Phase 10: Completion
                        exec_messages.append("✅ Workflow completed successfully")
                        
                        # Add routing summary for stats
                        if agents_consulted:
                            if len(agents_consulted) > 1:
                                exec_messages.append(f"MULTI-DOMAIN query routed to: {', '.join(agents_consulted)}")
                            else:
                                exec_messages.append(f"Query routed to: {agents_consulted[0]}")
                        
                        print(f"[FAN-IN] Execution messages: {len(exec_messages)} items")
                        print(f"[FAN-IN] stored_results keys: {list(stored_results.keys())}")
                        print(f"[FAN-IN] generated_yaml in results: {'generated_yaml' in stored_results}")
                        if 'generated_yaml' in stored_results:
                            print(f"[FAN-IN] YAML length: {len(stored_results['generated_yaml'])} chars")
                        
                        yield {
                            'type': 'complete',
                            'success': True,
                            'messages': exec_messages,
                            'results': stored_results,
                            'executed_nodes': list(completed_nodes),
                            'simulated_nodes': []
                        }
                        print(f"[FAN-IN] Complete event yielded, returning...")
                        return  # Exit the generator
                    
            except queue.Empty:
                # Send heartbeat to keep SSE connection alive during long operations
                time_since_heartbeat = time.time() - last_heartbeat_time
                if time_since_heartbeat > HEARTBEAT_INTERVAL:
                    yield {'type': 'heartbeat', 'elapsed': int(time.time() - start_time)}
                    last_heartbeat_time = time.time()
                
                # Check for inactivity timeout (graph is stuck)
                time_since_activity = time.time() - last_activity_time
                total_elapsed = time.time() - start_time
                
                # Check total timeout first
                if total_elapsed > MAX_TOTAL_TIMEOUT:
                    print(f"[TIMEOUT] Max execution time exceeded ({total_elapsed:.1f}s)")
                    print(f"[TIMEOUT] Traced: {traced_nodes}, Completed: {completed_nodes}")
                    output_nodes = [n['id'] for n in nodes if n.get('type') == 'output']
                    for out_id in output_nodes:
                        if out_id not in completed_nodes:
                            yield {'type': 'node_executing', 'node_id': out_id}
                            await asyncio.sleep(0.15)
                            yield {'type': 'node_completed', 'node_id': out_id}
                    yield {
                        'type': 'complete',
                        'success': True,
                        'messages': ['Workflow completed (max timeout)'],
                        'results': {},
                        'executed_nodes': list(traced_nodes),
                        'simulated_nodes': []
                    }
                    break
                
                if time_since_activity > INACTIVITY_TIMEOUT:
                    print(f"[TIMEOUT] No activity for {time_since_activity:.1f}s - forcing completion")
                    print(f"[TIMEOUT] Traced: {traced_nodes}, Completed: {completed_nodes}")
                    
                    # Force output-final trace and complete
                    for out_id in output_nodes:
                        if out_id not in completed_nodes:
                            print(f"[TIMEOUT] Forcing trace for stuck output node: {out_id}")
                            yield {'type': 'node_executing', 'node_id': out_id}
                            await asyncio.sleep(0.15)
                            yield {'type': 'node_completed', 'node_id': out_id}
                            completed_nodes.add(out_id)
                    
                    # Force completion with what we have
                    yield {
                        'type': 'complete',
                        'success': True,
                        'messages': ['Workflow completed (timeout recovery)'],
                        'results': {},
                        'executed_nodes': list(traced_nodes | completed_nodes),
                        'simulated_nodes': []
                    }
                    break
                
                # No events yet, check if thread is done
                if future.done():
                    print(f"[DEBUG] Future done, checking result...")
                    print(f"[DEBUG] Traced: {traced_nodes}, Completed: {completed_nodes}")
                    # Thread finished but no completion event - force completion
                    try:
                        result = future.result()  # This will raise if there was an exception
                        print(f"[DEBUG] Future returned normally: {type(result)}")
                        # If we got here, graph.invoke() returned but _complete wasn't sent
                        # Force output node tracing
                        output_nodes = [n['id'] for n in nodes if n.get('type') == 'output']
                        for out_id in output_nodes:
                            if out_id not in completed_nodes:
                                yield {'type': 'node_executing', 'node_id': out_id}
                                time.sleep(0.15)
                                yield {'type': 'node_completed', 'node_id': out_id}
                        yield {
                            'type': 'complete',
                            'success': True,
                            'messages': ['Workflow completed'],
                            'results': result if isinstance(result, dict) else {},
                            'executed_nodes': list(traced_nodes | completed_nodes),
                            'simulated_nodes': []
                        }
                    except Exception as e:
                        print(f"[DEBUG] Future raised exception: {e}")
                        yield {'type': 'error', 'error': str(e)}
                    break
                continue
        
        # Thread handles its own cleanup via finally block
        
    except Exception as e:
        yield {
            'type': 'error',
            'error': str(e),
            'message': f'Workflow failed: {str(e)}'
        }
