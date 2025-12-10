"""
MCP (Model Context Protocol) Client

Connects to MCP servers to invoke external tools.
Reference: https://modelcontextprotocol.io/

MCP allows AI agents to use external tools in a standardized way.
"""

import httpx
from typing import Dict, List, Any, Optional
import json


class MCPClient:
    """Client for interacting with MCP-compliant servers"""
    
    def __init__(self, server_url: str, auth_token: Optional[str] = None):
        self.server_url = server_url.rstrip('/')
        self.auth_token = auth_token
        self.headers = {
            'Content-Type': 'application/json',
        }
        if auth_token:
            self.headers['Authorization'] = f'Bearer {auth_token}'
    
    def list_tools(self) -> Dict[str, Any]:
        """List available tools from the MCP server
        
        Returns:
            Dict with 'tools' array containing tool definitions
        """
        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.post(
                    f"{self.server_url}/tools/list",
                    headers=self.headers,
                    json={}
                )
                response.raise_for_status()
                return response.json()
        except httpx.HTTPError as e:
            return {"error": f"Failed to list tools: {str(e)}", "tools": []}
        except Exception as e:
            return {"error": f"MCP error: {str(e)}", "tools": []}
    
    def call_tool(self, tool_name: str, arguments: Dict[str, Any] = None) -> Dict[str, Any]:
        """Call a specific tool on the MCP server
        
        Args:
            tool_name: Name of the tool to call
            arguments: Arguments to pass to the tool
            
        Returns:
            Tool execution result
        """
        try:
            with httpx.Client(timeout=60.0) as client:
                response = client.post(
                    f"{self.server_url}/tools/call",
                    headers=self.headers,
                    json={
                        "name": tool_name,
                        "arguments": arguments or {}
                    }
                )
                response.raise_for_status()
                return response.json()
        except httpx.HTTPError as e:
            return {"error": f"Tool call failed: {str(e)}", "success": False}
        except Exception as e:
            return {"error": f"MCP error: {str(e)}", "success": False}
    
    def call_tools_batch(self, tool_calls: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Call multiple tools in sequence
        
        Args:
            tool_calls: List of {'name': str, 'arguments': dict}
            
        Returns:
            List of results for each tool call
        """
        results = []
        for call in tool_calls:
            result = self.call_tool(call.get('name', ''), call.get('arguments', {}))
            results.append({
                'tool': call.get('name'),
                'result': result
            })
        return results


def create_mcp_client(server_url: str, auth_token: Optional[str] = None) -> MCPClient:
    """Factory function to create an MCP client"""
    return MCPClient(server_url, auth_token)


# Example usage for testing
if __name__ == "__main__":
    # Test with a local MCP server (if running)
    client = MCPClient("http://localhost:3000")
    
    # List available tools
    tools = client.list_tools()
    print("Available tools:", json.dumps(tools, indent=2))
    
    # Call a tool
    result = client.call_tool("example_tool", {"param1": "value1"})
    print("Tool result:", json.dumps(result, indent=2))







