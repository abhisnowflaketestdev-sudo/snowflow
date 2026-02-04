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
