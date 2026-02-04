"""
Flow Generator - Text-to-Flow capability for SnowFlow

Takes a natural language description and generates a complete workflow
with properly configured nodes and edges.
"""

import json
import uuid
from typing import Dict, List, Any, Optional
from snowflake_client import snowflake_client


# Node type definitions with default configurations
NODE_TEMPLATES = {
    "snowflakeSource": {
        "type": "snowflakeSource",
        "data": {
            "label": "Data Source",
            "database": "",
            "schema": "",
            "objectName": "",
            "objectType": "view"
        }
    },
    "semanticModel": {
        "type": "semanticModel",
        "data": {
            "label": "Semantic Model",
            "database": "",
            "schema": "",
            "stage": "SEMANTIC_MODELS",
            "yamlFile": ""
        }
    },
    "agent": {
        "type": "agent",
        "data": {
            "label": "Cortex Agent",
            "name": "Agent",
            "model": "llama3.1-70b",
            "instructions": "",
            "temperature": 0.7,
            "maxTokens": 4096,
            "enableGuardrails": False
        }
    },
    "supervisor": {
        "type": "supervisor",
        "data": {
            "label": "Supervisor",
            "model": "llama3.1-70b",
            "systemPrompt": "",
            "maxDelegations": 5
        }
    },
    "router": {
        "type": "router",
        "data": {
            "label": "Intent Router",
            "routes": [
                {"intent": "default", "description": "Default route"}
            ]
        }
    },
    "output": {
        "type": "output",
        "data": {
            "label": "Output",
            "channel": "snowflake_intelligence"
        }
    },
    "externalAgent": {
        "type": "externalAgent",
        "data": {
            "label": "External API",
            "agentType": "rest",
            "endpoint": "",
            "method": "POST"
        }
    }
}

# Known data sources and semantic models (for smart suggestions)
KNOWN_ASSETS = {
    "retail": {
        "database": "AICOLLEGE",
        "schema": "SNOWFLOW_RETAIL",
        "views": ["VW_RETAIL_SALES"],
        "semantic_stage": "SEMANTIC_MODELS",
        "semantic_files": ["retail_semantic_model.yaml"]
    },
    "ad_media": {
        "database": "AICOLLEGE",
        "schema": "SNOWFLOW_AD_MEDIA",
        "views": ["VW_CAMPAIGN_PERFORMANCE"],
        "semantic_stage": "SEMANTIC_MODELS",
        "semantic_files": ["ad_media_semantic_model.yaml"]
    }
}


def generate_node_id() -> str:
    """Generate unique node ID"""
    return f"node_{uuid.uuid4().hex[:8]}"


def position_nodes(nodes: List[Dict]) -> List[Dict]:
    """Auto-position nodes in a left-to-right flow layout"""
    x_start = 100
    y_start = 200
    x_gap = 280
    y_gap = 150
    
    # Group nodes by type for layered layout
    layers = {
        "input": [],      # Data sources
        "semantic": [],   # Semantic models
        "agent": [],      # Agents (can be multiple)
        "orchestrator": [], # Supervisor/Router
        "output": []      # Outputs
    }
    
    for node in nodes:
        node_type = node.get("type", "")
        if node_type == "snowflakeSource":
            layers["input"].append(node)
        elif node_type == "semanticModel":
            layers["semantic"].append(node)
        elif node_type in ("agent", "cortexAgent"):
            layers["agent"].append(node)
        elif node_type in ("supervisor", "router"):
            layers["orchestrator"].append(node)
        elif node_type == "output":
            layers["output"].append(node)
        else:
            layers["agent"].append(node)  # Default to agent layer
    
    # Position each layer
    positioned = []
    current_x = x_start
    
    for layer_name in ["input", "semantic", "agent", "orchestrator", "output"]:
        layer_nodes = layers[layer_name]
        if not layer_nodes:
            continue
            
        # Center vertically if multiple nodes in layer
        total_height = len(layer_nodes) * y_gap
        start_y = y_start - (total_height / 2) + (y_gap / 2)
        
        for i, node in enumerate(layer_nodes):
            node["position"] = {
                "x": current_x,
                "y": start_y + (i * y_gap)
            }
            positioned.append(node)
        
        current_x += x_gap
    
    return positioned


def create_edges(nodes: List[Dict], flow_type: str = "single") -> List[Dict]:
    """Create edges based on node arrangement and flow type"""
    edges = []
    
    # Find nodes by type
    data_nodes = [n for n in nodes if n["type"] == "snowflakeSource"]
    semantic_nodes = [n for n in nodes if n["type"] == "semanticModel"]
    agent_nodes = [n for n in nodes if n["type"] in ("agent", "cortexAgent")]
    supervisor_nodes = [n for n in nodes if n["type"] == "supervisor"]
    router_nodes = [n for n in nodes if n["type"] == "router"]
    output_nodes = [n for n in nodes if n["type"] == "output"]
    
    # Data → Semantic (if both exist)
    for data_node in data_nodes:
        for semantic_node in semantic_nodes:
            edges.append({
                "id": f"e-{data_node['id']}-{semantic_node['id']}",
                "source": data_node["id"],
                "target": semantic_node["id"],
                "animated": True
            })
    
    # Semantic → Agents (or Data → Agents if no semantic)
    source_for_agents = semantic_nodes if semantic_nodes else data_nodes
    for source in source_for_agents:
        for agent in agent_nodes:
            edges.append({
                "id": f"e-{source['id']}-{agent['id']}",
                "source": source["id"],
                "target": agent["id"],
                "animated": True
            })
    
    # Handle orchestration
    if supervisor_nodes:
        # Agents → Supervisor
        supervisor = supervisor_nodes[0]
        for agent in agent_nodes:
            edges.append({
                "id": f"e-{agent['id']}-{supervisor['id']}",
                "source": agent["id"],
                "target": supervisor["id"],
                "animated": True
            })
        # Supervisor → Output
        for output in output_nodes:
            edges.append({
                "id": f"e-{supervisor['id']}-{output['id']}",
                "source": supervisor["id"],
                "target": output["id"],
                "animated": True
            })
    elif router_nodes:
        # Router is typically before agents
        router = router_nodes[0]
        # Source → Router
        for source in source_for_agents:
            edges.append({
                "id": f"e-{source['id']}-{router['id']}",
                "source": source["id"],
                "target": router["id"],
                "animated": True
            })
        # Router → Agents (with route indices)
        for i, agent in enumerate(agent_nodes):
            edges.append({
                "id": f"e-{router['id']}-{agent['id']}",
                "source": router["id"],
                "target": agent["id"],
                "sourceHandle": f"route-{i}",
                "animated": True
            })
        # Agents → Output
        for agent in agent_nodes:
            for output in output_nodes:
                edges.append({
                    "id": f"e-{agent['id']}-{output['id']}",
                    "source": agent["id"],
                    "target": output["id"],
                    "animated": True
                })
    else:
        # Single agent flow: Agents → Output
        for agent in agent_nodes:
            for output in output_nodes:
                edges.append({
                    "id": f"e-{agent['id']}-{output['id']}",
                    "source": agent["id"],
                    "target": output["id"],
                    "animated": True
                })
    
    return edges


def generate_flow_from_prompt(prompt: str, available_assets: Optional[Dict] = None) -> Dict:
    """
    Generate a complete workflow from a natural language prompt.
    
    Args:
        prompt: Natural language description of desired workflow
        available_assets: Optional dict of available databases/tables/semantic models
    
    Returns:
        Dict with 'nodes', 'edges', 'name', and 'description'
    """
    
    # Build the LLM prompt
    system_prompt = """You are a workflow generator for SnowFlow, an agentic AI platform.
Given a user's description, generate a JSON workflow definition.

AVAILABLE NODE TYPES:
1. snowflakeSource - Data source (table/view from Snowflake)
2. semanticModel - Cortex Analyst semantic model (YAML file)
3. agent - Cortex AI agent that answers questions
4. supervisor - Orchestrates multiple agents
5. router - Routes questions to different agents based on intent
6. output - Output channel (snowflake_intelligence, rest_api, slack, teams)
7. externalAgent - External API integration

COMMON PATTERNS:
1. Simple Agent: snowflakeSource → semanticModel → agent → output
2. Multi-Agent: snowflakeSource → semanticModel → [agent1, agent2, agent3] → supervisor → output
3. Router Flow: snowflakeSource → semanticModel → router → [agent1, agent2] → output

KNOWN DATA SOURCES:
- Retail: AICOLLEGE.SNOWFLOW_RETAIL.VW_RETAIL_SALES (semantic: retail_semantic_model.yaml)
- Ad/Media: AICOLLEGE.SNOWFLOW_AD_MEDIA.VW_CAMPAIGN_PERFORMANCE (semantic: ad_media_semantic_model.yaml)

OUTPUT FORMAT (JSON only, no markdown):
{
  "name": "Workflow Name",
  "description": "Brief description",
  "flow_type": "single|supervisor|router",
  "nodes": [
    {
      "type": "snowflakeSource",
      "label": "Retail Data",
      "database": "AICOLLEGE",
      "schema": "SNOWFLOW_RETAIL",
      "objectName": "VW_RETAIL_SALES"
    },
    {
      "type": "semanticModel",
      "label": "Retail Semantic",
      "database": "AICOLLEGE",
      "schema": "SNOWFLOW_RETAIL",
      "stage": "SEMANTIC_MODELS",
      "yamlFile": "retail_semantic_model.yaml"
    },
    {
      "type": "agent",
      "label": "Sales Agent",
      "name": "Sales Agent",
      "model": "llama3.1-70b",
      "instructions": "You are a sales analytics expert..."
    },
    {
      "type": "output",
      "label": "Output",
      "channel": "snowflake_intelligence"
    }
  ]
}

RULES:
1. Always include at least: data source, agent, output
2. Use semantic model for accurate SQL generation
3. For multi-agent, use supervisor or router
4. Give agents specific, focused instructions
5. Match data source to the use case (retail vs ad/media)
6. Return ONLY valid JSON, no explanation text"""

    user_message = f"""Generate a workflow for this request:

"{prompt}"

Return ONLY the JSON workflow definition."""

    try:
        # Call Cortex LLM
        result = snowflake_client.cortex_complete(
            model="llama3.1-70b",
            prompt=f"{system_prompt}\n\nUser: {user_message}",
            temperature=0.3,  # Lower for more consistent structure
            max_tokens=2000
        )
        
        if not result.get("success"):
            return {
                "success": False,
                "error": result.get("error", "LLM call failed")
            }
        
        # Parse the LLM response
        response_text = result.get("response", "")
        
        # Try to extract JSON from response
        json_str = response_text.strip()
        
        # Handle markdown code blocks
        if "```json" in json_str:
            json_str = json_str.split("```json")[1].split("```")[0].strip()
        elif "```" in json_str:
            json_str = json_str.split("```")[1].split("```")[0].strip()
        
        try:
            flow_def = json.loads(json_str)
        except json.JSONDecodeError as e:
            return {
                "success": False,
                "error": f"Failed to parse LLM response as JSON: {str(e)}",
                "raw_response": response_text[:500]
            }
        
        # Convert simplified node format to full node format
        nodes = []
        for node_def in flow_def.get("nodes", []):
            node_type = node_def.get("type")
            if node_type not in NODE_TEMPLATES:
                continue
            
            node = {
                "id": generate_node_id(),
                "type": node_type,
                "data": {**NODE_TEMPLATES[node_type]["data"]}
            }
            
            # Apply custom properties
            for key, value in node_def.items():
                if key != "type":
                    node["data"][key] = value
            
            nodes.append(node)
        
        # Ensure we have minimum required nodes
        if not any(n["type"] == "snowflakeSource" for n in nodes):
            # Add default data source
            nodes.insert(0, {
                "id": generate_node_id(),
                "type": "snowflakeSource",
                "data": {
                    "label": "Data Source",
                    "database": "AICOLLEGE",
                    "schema": "SNOWFLOW_RETAIL",
                    "objectName": "VW_RETAIL_SALES",
                    "objectType": "view"
                }
            })
        
        if not any(n["type"] == "output" for n in nodes):
            nodes.append({
                "id": generate_node_id(),
                "type": "output",
                "data": {
                    "label": "Output",
                    "channel": "snowflake_intelligence"
                }
            })
        
        # Position nodes
        nodes = position_nodes(nodes)
        
        # Create edges
        flow_type = flow_def.get("flow_type", "single")
        edges = create_edges(nodes, flow_type)
        
        return {
            "success": True,
            "name": flow_def.get("name", "Generated Workflow"),
            "description": flow_def.get("description", prompt),
            "nodes": nodes,
            "edges": edges,
            "flow_type": flow_type
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


def generate_flow_quick(prompt: str) -> Dict:
    """
    Quick flow generation using pattern matching (no LLM call).
    Useful for common patterns and faster response.
    """
    prompt_lower = prompt.lower()
    
    nodes = []
    edges = []
    flow_type = "single"
    name = "Generated Workflow"
    
    # Detect domain
    is_retail = any(w in prompt_lower for w in ["retail", "sales", "store", "product", "margin", "revenue"])
    is_admedia = any(w in prompt_lower for w in ["ad", "media", "campaign", "impression", "click", "brand", "marketing"])
    
    # Detect orchestration type
    is_multi_agent = any(w in prompt_lower for w in ["multi", "multiple agents", "supervisor", "orchestrat"])
    is_router = any(w in prompt_lower for w in ["router", "route", "intent"])
    
    # Build data source
    if is_retail:
        data_node = {
            "id": generate_node_id(),
            "type": "snowflakeSource",
            "data": {
                "label": "Retail Sales Data",
                "database": "AICOLLEGE",
                "schema": "SNOWFLOW_RETAIL",
                "objectName": "VW_RETAIL_SALES",
                "objectType": "view"
            }
        }
        semantic_node = {
            "id": generate_node_id(),
            "type": "semanticModel",
            "data": {
                "label": "Retail Semantic Model",
                "database": "AICOLLEGE",
                "schema": "SNOWFLOW_RETAIL",
                "stage": "SEMANTIC_MODELS",
                "yamlFile": "retail_semantic_model.yaml",
                "semanticPath": "@AICOLLEGE.SNOWFLOW_RETAIL.SEMANTIC_MODELS/retail_semantic_model.yaml"
            }
        }
        name = "Retail Analytics Agent"
    elif is_admedia:
        data_node = {
            "id": generate_node_id(),
            "type": "snowflakeSource",
            "data": {
                "label": "Campaign Performance Data",
                "database": "AICOLLEGE",
                "schema": "SNOWFLOW_AD_MEDIA",
                "objectName": "VW_CAMPAIGN_PERFORMANCE",
                "objectType": "view"
            }
        }
        semantic_node = {
            "id": generate_node_id(),
            "type": "semanticModel",
            "data": {
                "label": "Ad/Media Semantic Model",
                "database": "AICOLLEGE",
                "schema": "SNOWFLOW_AD_MEDIA",
                "stage": "SEMANTIC_MODELS",
                "yamlFile": "ad_media_semantic_model.yaml",
                "semanticPath": "@AICOLLEGE.SNOWFLOW_AD_MEDIA.SEMANTIC_MODELS/ad_media_semantic_model.yaml"
            }
        }
        name = "Ad/Media Analytics Agent"
    else:
        # Default to retail
        data_node = {
            "id": generate_node_id(),
            "type": "snowflakeSource",
            "data": {
                "label": "Data Source",
                "database": "AICOLLEGE",
                "schema": "SNOWFLOW_RETAIL",
                "objectName": "VW_RETAIL_SALES",
                "objectType": "view"
            }
        }
        semantic_node = {
            "id": generate_node_id(),
            "type": "semanticModel",
            "data": {
                "label": "Semantic Model",
                "database": "AICOLLEGE",
                "schema": "SNOWFLOW_RETAIL",
                "stage": "SEMANTIC_MODELS",
                "yamlFile": "retail_semantic_model.yaml",
                "semanticPath": "@AICOLLEGE.SNOWFLOW_RETAIL.SEMANTIC_MODELS/retail_semantic_model.yaml"
            }
        }
        name = "Custom Analytics Agent"
    
    nodes.append(data_node)
    nodes.append(semantic_node)
    
    # Build agents based on orchestration type
    if is_multi_agent or is_router:
        # Create multiple specialized agents
        agents = []
        
        if is_retail:
            agents = [
                {
                    "id": generate_node_id(),
                    "type": "agent",
                    "data": {
                        "label": "Sales Agent",
                        "name": "Sales Agent",
                        "model": "llama3.1-70b",
                        "instructions": "You are a sales analytics expert. Answer questions about revenue, transactions, and sales performance.",
                        "temperature": 0.3
                    }
                },
                {
                    "id": generate_node_id(),
                    "type": "agent",
                    "data": {
                        "label": "Margin Agent",
                        "name": "Margin Agent",
                        "model": "llama3.1-70b",
                        "instructions": "You are a profitability expert. Answer questions about margins, costs, and profitability analysis.",
                        "temperature": 0.3
                    }
                },
                {
                    "id": generate_node_id(),
                    "type": "agent",
                    "data": {
                        "label": "Regional Agent",
                        "name": "Regional Agent",
                        "model": "llama3.1-70b",
                        "instructions": "You are a regional analyst. Answer questions about geographic performance, store comparisons, and regional trends.",
                        "temperature": 0.3
                    }
                }
            ]
        else:
            agents = [
                {
                    "id": generate_node_id(),
                    "type": "agent",
                    "data": {
                        "label": "Performance Agent",
                        "name": "Performance Agent",
                        "model": "llama3.1-70b",
                        "instructions": "You are a campaign performance expert. Answer questions about impressions, clicks, and conversions.",
                        "temperature": 0.3
                    }
                },
                {
                    "id": generate_node_id(),
                    "type": "agent",
                    "data": {
                        "label": "Brand Agent",
                        "name": "Brand Agent",
                        "model": "llama3.1-70b",
                        "instructions": "You are a brand marketing expert. Answer questions about brand awareness, sentiment, and brand metrics.",
                        "temperature": 0.3
                    }
                }
            ]
        
        nodes.extend(agents)
        
        if is_router:
            # Add router
            router_node = {
                "id": generate_node_id(),
                "type": "router",
                "data": {
                    "label": "Intent Router",
                    "routes": [
                        {"intent": "sales", "description": "Sales and revenue questions"},
                        {"intent": "margin", "description": "Profitability questions"},
                        {"intent": "region", "description": "Geographic questions"}
                    ] if is_retail else [
                        {"intent": "performance", "description": "Campaign metrics questions"},
                        {"intent": "brand", "description": "Brand awareness questions"}
                    ]
                }
            }
            nodes.append(router_node)
            flow_type = "router"
            name = f"{name} with Router"
        else:
            # Add supervisor
            supervisor_node = {
                "id": generate_node_id(),
                "type": "supervisor",
                "data": {
                    "label": "Orchestrator",
                    "model": "llama3.1-70b",
                    "systemPrompt": "You are the orchestrator. Route questions to the appropriate specialist agent and synthesize their responses.",
                    "maxDelegations": 5
                }
            }
            nodes.append(supervisor_node)
            flow_type = "supervisor"
            name = f"{name} with Supervisor"
    else:
        # Single agent
        agent_node = {
            "id": generate_node_id(),
            "type": "agent",
            "data": {
                "label": "Analytics Agent",
                "name": "Analytics Agent",
                "model": "llama3.1-70b",
                "instructions": f"You are an analytics expert for {'retail' if is_retail else 'advertising'} data. Provide accurate, data-driven answers with specific numbers.",
                "temperature": 0.3,
                "enableGuardrails": True
            }
        }
        nodes.append(agent_node)
        flow_type = "single"
    
    # Add output
    output_node = {
        "id": generate_node_id(),
        "type": "output",
        "data": {
            "label": "Output",
            "channel": "snowflake_intelligence"
        }
    }
    nodes.append(output_node)
    
    # Position and connect
    nodes = position_nodes(nodes)
    edges = create_edges(nodes, flow_type)
    
    return {
        "success": True,
        "name": name,
        "description": prompt,
        "nodes": nodes,
        "edges": edges,
        "flow_type": flow_type
    }


# ============================================================================
# FLOW EDITING - Modify existing flows via natural language
# ============================================================================

def detect_edit_intent(prompt: str) -> Dict[str, Any]:
    """
    Detect what kind of edit the user wants to make.
    
    Returns:
        {
            "action": "add" | "remove" | "modify" | "replace",
            "target": "agent" | "router" | "supervisor" | "data_source" | "semantic" | "output" | None,
            "details": { ... specific details ... }
        }
    """
    prompt_lower = prompt.lower()
    
    # Detect action
    action = None
    if any(w in prompt_lower for w in ["add", "insert", "include", "create another", "add another"]):
        action = "add"
    elif any(w in prompt_lower for w in ["remove", "delete", "drop", "get rid of"]):
        action = "remove"
    elif any(w in prompt_lower for w in ["change", "modify", "update", "set", "switch", "replace"]):
        action = "modify"
    elif any(w in prompt_lower for w in ["replace all", "rebuild", "start over"]):
        action = "replace"
    else:
        action = "add"  # Default to add
    
    # Detect target
    target = None
    if any(w in prompt_lower for w in ["agent", "analyst"]):
        target = "agent"
    elif any(w in prompt_lower for w in ["router", "routing", "intent"]):
        target = "router"
    elif any(w in prompt_lower for w in ["supervisor", "orchestrat"]):
        target = "supervisor"
    elif any(w in prompt_lower for w in ["data source", "table", "view", "data"]):
        target = "data_source"
    elif any(w in prompt_lower for w in ["semantic", "model", "yaml"]):
        target = "semantic"
    elif any(w in prompt_lower for w in ["output", "channel"]):
        target = "output"
    
    # Detect specific details
    details = {}
    
    # Model changes
    model_patterns = ["llama", "mistral", "snowflake-arctic", "claude", "gpt"]
    for pattern in model_patterns:
        if pattern in prompt_lower:
            # Extract full model name
            import re
            match = re.search(rf'{pattern}[\w.-]*', prompt_lower)
            if match:
                details["model"] = match.group(0)
    
    # Temperature changes
    import re
    temp_match = re.search(r'temperature\s*(?:to|=|:)?\s*([\d.]+)', prompt_lower)
    if temp_match:
        details["temperature"] = float(temp_match.group(1))
    
    # Agent name/type
    agent_types = ["sales", "margin", "inventory", "performance", "brand", "regional", "customer"]
    for agent_type in agent_types:
        if agent_type in prompt_lower:
            details["agent_type"] = agent_type
            break
    
    return {
        "action": action,
        "target": target,
        "details": details
    }


def edit_flow(
    prompt: str,
    existing_nodes: List[Dict],
    existing_edges: List[Dict]
) -> Dict:
    """
    Edit an existing flow based on natural language instruction.
    
    Args:
        prompt: Natural language edit instruction
        existing_nodes: Current nodes in the flow
        existing_edges: Current edges in the flow
    
    Returns:
        Updated nodes and edges
    """
    intent = detect_edit_intent(prompt)
    action = intent["action"]
    target = intent["target"]
    details = intent["details"]
    
    # Copy existing data
    nodes = [dict(n) for n in existing_nodes]
    edges = [dict(e) for e in existing_edges]
    
    # Track changes made
    changes = []
    
    if action == "replace":
        # Full replacement - generate new flow
        return generate_flow_quick(prompt)
    
    elif action == "add":
        if target == "agent":
            # Add a new agent
            agent_type = details.get("agent_type", "custom")
            agent_labels = {
                "sales": "Sales Agent",
                "margin": "Margin Agent",
                "inventory": "Inventory Agent",
                "performance": "Performance Agent",
                "brand": "Brand Agent",
                "regional": "Regional Agent",
                "customer": "Customer Agent",
                "custom": "New Agent"
            }
            agent_instructions = {
                "sales": "You are a sales analytics expert. Answer questions about revenue, transactions, and sales performance.",
                "margin": "You are a profitability expert. Answer questions about margins, costs, and profitability analysis.",
                "inventory": "You are an inventory expert. Answer questions about stock levels, supply chain, and inventory turnover.",
                "performance": "You are a performance analyst. Answer questions about KPIs, metrics, and campaign performance.",
                "brand": "You are a brand expert. Answer questions about brand awareness, sentiment, and marketing impact.",
                "regional": "You are a regional analyst. Answer questions about geographic performance and regional comparisons.",
                "customer": "You are a customer behavior analyst. Answer questions about shopping patterns and customer segments.",
                "custom": "You are a helpful analytics assistant."
            }
            
            new_agent = {
                "id": generate_node_id(),
                "type": "agent",
                "data": {
                    "label": agent_labels.get(agent_type, "New Agent"),
                    "name": agent_labels.get(agent_type, "New Agent"),
                    "model": details.get("model", "llama3.1-70b"),
                    "instructions": agent_instructions.get(agent_type, "You are a helpful analytics assistant."),
                    "temperature": details.get("temperature", 0.3)
                }
            }
            nodes.append(new_agent)
            changes.append(f"Added {agent_labels.get(agent_type, 'new agent')}")
            
            # Connect to semantic model or data source
            semantic_nodes = [n for n in nodes if n["type"] == "semanticModel"]
            data_nodes = [n for n in nodes if n["type"] == "snowflakeSource"]
            source = semantic_nodes[0] if semantic_nodes else (data_nodes[0] if data_nodes else None)
            
            if source:
                edges.append({
                    "id": f"e-{source['id']}-{new_agent['id']}",
                    "source": source["id"],
                    "target": new_agent["id"],
                    "animated": True
                })
            
            # Connect to supervisor if exists
            supervisor_nodes = [n for n in nodes if n["type"] == "supervisor"]
            if supervisor_nodes:
                edges.append({
                    "id": f"e-{new_agent['id']}-{supervisor_nodes[0]['id']}",
                    "source": new_agent["id"],
                    "target": supervisor_nodes[0]["id"],
                    "animated": True
                })
        
        elif target == "supervisor":
            # Add supervisor if not exists
            if not any(n["type"] == "supervisor" for n in nodes):
                new_supervisor = {
                    "id": generate_node_id(),
                    "type": "supervisor",
                    "data": {
                        "label": "Orchestrator",
                        "model": details.get("model", "llama3.1-70b"),
                        "systemPrompt": "You are the orchestrator. Route questions to the appropriate specialist agent and synthesize their responses.",
                        "maxDelegations": 5
                    }
                }
                nodes.append(new_supervisor)
                changes.append("Added supervisor orchestrator")
                
                # Connect all agents to supervisor
                agent_nodes = [n for n in nodes if n["type"] == "agent"]
                for agent in agent_nodes:
                    # Remove direct agent→output edges
                    edges = [e for e in edges if not (e["source"] == agent["id"] and any(n["type"] == "output" and n["id"] == e["target"] for n in nodes))]
                    # Add agent→supervisor edge
                    edges.append({
                        "id": f"e-{agent['id']}-{new_supervisor['id']}",
                        "source": agent["id"],
                        "target": new_supervisor["id"],
                        "animated": True
                    })
                
                # Connect supervisor to output
                output_nodes = [n for n in nodes if n["type"] == "output"]
                if output_nodes:
                    edges.append({
                        "id": f"e-{new_supervisor['id']}-{output_nodes[0]['id']}",
                        "source": new_supervisor["id"],
                        "target": output_nodes[0]["id"],
                        "animated": True
                    })
        
        elif target == "router":
            # Add router if not exists
            if not any(n["type"] == "router" for n in nodes):
                new_router = {
                    "id": generate_node_id(),
                    "type": "router",
                    "data": {
                        "label": "Intent Router",
                        "routes": [
                            {"intent": "general", "description": "General questions"},
                            {"intent": "specific", "description": "Specific analysis questions"}
                        ]
                    }
                }
                nodes.append(new_router)
                changes.append("Added intent router")
    
    elif action == "modify":
        if target == "agent":
            # Modify agent settings
            agent_nodes = [n for n in nodes if n["type"] == "agent"]
            for agent in agent_nodes:
                if "model" in details:
                    agent["data"]["model"] = details["model"]
                    changes.append(f"Changed {agent['data']['label']} model to {details['model']}")
                if "temperature" in details:
                    agent["data"]["temperature"] = details["temperature"]
                    changes.append(f"Changed {agent['data']['label']} temperature to {details['temperature']}")
        
        elif target == "supervisor":
            supervisor_nodes = [n for n in nodes if n["type"] == "supervisor"]
            for sup in supervisor_nodes:
                if "model" in details:
                    sup["data"]["model"] = details["model"]
                    changes.append(f"Changed supervisor model to {details['model']}")
    
    elif action == "remove":
        if target == "agent":
            # Remove last added agent (or specific one if named)
            agent_nodes = [n for n in nodes if n["type"] == "agent"]
            if len(agent_nodes) > 1:  # Keep at least one agent
                agent_type = details.get("agent_type")
                to_remove = None
                
                if agent_type:
                    # Find specific agent
                    for agent in agent_nodes:
                        if agent_type.lower() in agent["data"]["label"].lower():
                            to_remove = agent
                            break
                
                if not to_remove:
                    # Remove last agent
                    to_remove = agent_nodes[-1]
                
                if to_remove:
                    nodes = [n for n in nodes if n["id"] != to_remove["id"]]
                    edges = [e for e in edges if e["source"] != to_remove["id"] and e["target"] != to_remove["id"]]
                    changes.append(f"Removed {to_remove['data']['label']}")
        
        elif target == "supervisor":
            supervisor_nodes = [n for n in nodes if n["type"] == "supervisor"]
            if supervisor_nodes:
                sup = supervisor_nodes[0]
                nodes = [n for n in nodes if n["id"] != sup["id"]]
                edges = [e for e in edges if e["source"] != sup["id"] and e["target"] != sup["id"]]
                changes.append("Removed supervisor")
                
                # Reconnect agents directly to output
                agent_nodes = [n for n in nodes if n["type"] == "agent"]
                output_nodes = [n for n in nodes if n["type"] == "output"]
                if output_nodes:
                    for agent in agent_nodes:
                        edges.append({
                            "id": f"e-{agent['id']}-{output_nodes[0]['id']}",
                            "source": agent["id"],
                            "target": output_nodes[0]["id"],
                            "animated": True
                        })
    
    # Reposition nodes
    nodes = position_nodes(nodes)
    
    return {
        "success": True,
        "action": action,
        "target": target,
        "changes": changes,
        "nodes": nodes,
        "edges": edges,
        "node_count": len(nodes),
        "edge_count": len(edges)
    }


def is_edit_request(prompt: str) -> bool:
    """
    Determine if a prompt is an edit request vs a new flow creation.
    
    Edit keywords: add, remove, change, modify, update, delete, insert
    Create keywords: create, build, set up, make, generate, design
    """
    prompt_lower = prompt.lower().strip()
    
    # Check for explicit /edit command
    if prompt_lower.startswith("/edit"):
        return True
    
    # Edit keywords (when flow already exists)
    edit_keywords = [
        "add a", "add an", "add another",
        "remove", "delete", "drop",
        "change", "modify", "update", "set",
        "switch to", "use instead",
        "insert", "include"
    ]
    
    for keyword in edit_keywords:
        if keyword in prompt_lower:
            return True
    
    return False
