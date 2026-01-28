import { Handle, Position, useReactFlow } from 'reactflow';
import { Brain, Sparkles, Wrench } from 'lucide-react';

/**
 * AgentNode - 1:1 mapping to SNOWFLAKE.CORTEX.COMPLETE()
 * 
 * All properties mirror the Cortex Complete function parameters.
 * Reference: https://docs.snowflake.com/en/sql-reference/functions/complete-snowflake-cortex
 * 
 * Also includes TOOLS configuration - Agent can use:
 * - Cortex Analyst: Natural language to SQL via Semantic Model
 * - SQL Executor: Run arbitrary SQL
 * - Web Search: Search the web for information
 */

// Analyst tool configuration (STRUCTURED data - NL to SQL)
export interface AnalystToolConfig {
  enabled: boolean;
  semanticModelDatabase: string;
  semanticModelSchema: string;
  semanticModelStage: string;
  semanticModelFile: string;  // YAML file name
}

// Search tool configuration (UNSTRUCTURED data - vector search)
export interface SearchToolConfig {
  enabled: boolean;
  searchServiceName: string;   // Cortex Search Service name
  database: string;
  schema: string;
  columns: string[];           // Columns to search
  limit: number;               // Max results
}

// MCP tool configuration (Model Context Protocol - external tools)
export interface MCPToolConfig {
  enabled: boolean;
  serverUrl: string;           // MCP server endpoint
  authToken: string;           // Optional auth
  enabledTools: string[];      // Which MCP tools to enable
}

export interface AgentNodeData {
  // Display
  label: string;
  
  // Required parameters
  // NOTE: This is a string (not a union) because available Cortex models vary by Snowflake account/region.
  model: string;
  
  // Prompt configuration
  systemPrompt: string;       // System message (instructions)
  userPromptTemplate: string; // Template for user message, can include {{data}} placeholder
  
  // Generation parameters (all optional, have Snowflake defaults)
  temperature: number;        // 0-1, default 0.7 - controls randomness
  maxTokens: number;          // Max tokens to generate, default 4096
  topP: number;              // 0-1, nucleus sampling, default 1.0
  
  // Guardrails (Cortex Guard)
  enableGuardrails: boolean;  // Enable Cortex Guard for safety
  
  // Response format
  responseFormat: 'text' | 'json'; // Output format
  
  // Advanced
  seed: number | null;        // For reproducibility
  
  // TOOLS - Agent can use these to accomplish tasks
  // Can be either array format (from templates): ['Analyst', 'Search', 'SQL']
  // Or object format (from UI): { analyst: { enabled: true }, ... }
  tools: string[] | {
    analyst?: AnalystToolConfig;      // Structured data (NL → SQL)
    search?: SearchToolConfig;        // Unstructured data (vector search)
    mcp?: MCPToolConfig;              // External tools via MCP
    sqlExecutor?: boolean;
    webSearch?: boolean;
  };
}

const modelDisplayNames: Record<string, string> = {
  'mistral-large2': 'Mistral Large 2',
  'mistral-large': 'Mistral Large',
  'mixtral-8x7b': 'Mixtral 8x7B',
  'mistral-7b': 'Mistral 7B',
  'llama3.1-405b': 'Llama 3.1 405B',
  'llama3.1-70b': 'Llama 3.1 70B',
  'llama3.1-8b': 'Llama 3.1 8B',
  'llama3-70b': 'Llama 3 70B',
  'llama3-8b': 'Llama 3 8B',
  'snowflake-arctic': 'Snowflake Arctic',
  'reka-flash': 'Reka Flash',
  'reka-core': 'Reka Core',
  'jamba-instruct': 'Jamba Instruct',
  'jamba-1.5-mini': 'Jamba 1.5 Mini',
  'jamba-1.5-large': 'Jamba 1.5 Large',
  'gemma-7b': 'Gemma 7B',
};

export const AgentNode = ({ id, data, selected }: { id: string; data: AgentNodeData; selected?: boolean }) => {
  const modelName = modelDisplayNames[data.model] || data.model || 'Mistral Large 2';
  const hasCustomParams = (data.temperature !== undefined && data.temperature !== 0.7) || 
                          (data.maxTokens !== undefined && data.maxTokens !== 4096);

  const { getNodes, getEdges } = useReactFlow();
  const missingSemanticContext = (() => {
    try {
      const nodes = getNodes();
      const edges = getEdges();

      // Only show the badge if this agent is in a data-driven flow (has a Snowflake Source upstream)
      // AND there is no Semantic Model upstream.
      const byId = new Map(nodes.map(n => [n.id, n]));
      const incomingByTarget = new Map<string, string[]>();
      for (const e of edges) {
        if (!incomingByTarget.has(e.target)) incomingByTarget.set(e.target, []);
        incomingByTarget.get(e.target)!.push(e.source);
      }

      let hasDataUpstream = false;
      const visited = new Set<string>();
      const queue: string[] = [id];
      while (queue.length) {
        const cur = queue.shift()!;
        if (visited.has(cur)) continue;
        visited.add(cur);

        const incoming = incomingByTarget.get(cur) || [];
        for (const srcId of incoming) {
          const src = byId.get(srcId);
          if (!src) continue;
          if (src.type === 'semanticModel') return false; // semantic context exists
          if (src.type === 'snowflakeSource') hasDataUpstream = true;
          queue.push(srcId);
        }

        if (visited.size > 50) break; // safety for pathological graphs
      }
      return hasDataUpstream;
    } catch {
      return false;
    }
  })();
  
  // Count enabled tools - handle both array format (from templates) and object format (from UI)
  const enabledTools: string[] = [];
  
  // Check if tools is an array (template format: ['Analyst', 'Search', 'SQL'])
  if (Array.isArray(data.tools)) {
    enabledTools.push(...data.tools);
  } else if (data.tools) {
    // Object format from UI configuration
    if (data.tools.analyst?.enabled) enabledTools.push('Analyst');
    if (data.tools.search?.enabled) enabledTools.push('Search');
    if (data.tools.mcp?.enabled) enabledTools.push('MCP');
    if (data.tools.sqlExecutor) enabledTools.push('SQL');
    if (data.tools.webSearch) enabledTools.push('Web');
  }

  return (
    <div 
      style={{
        background: 'rgb(var(--surface-3))',
        border: selected ? '2px solid #8B5CF6' : '1px solid rgb(var(--border-strong))',
        borderRadius: 8,
        padding: 12,
        width: 240,
        fontFamily: 'Inter, -apple-system, sans-serif',
        boxShadow: selected ? '0 10px 26px rgba(0,0,0,0.35)' : '0 8px 20px rgba(0,0,0,0.25)',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: '#8B5CF6', width: 10, height: 10, border: '2px solid rgb(var(--handle-border))' }} />
      
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ 
          width: 36, 
          height: 36, 
          borderRadius: 8, 
          background: 'rgba(139, 92, 246, 0.16)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center' 
        }}>
          <Brain size={18} color="#8B5CF6" />
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 500, color: 'rgb(var(--muted))', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Cortex Agent
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'rgb(var(--fg))' }}>{data.label}</div>
          {missingSemanticContext && (
            <div style={{
              marginTop: 4,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '2px 6px',
              borderRadius: 999,
              background: 'rgba(245, 158, 11, 0.14)',
              border: '1px solid rgba(245, 158, 11, 0.35)',
              color: '#F59E0B',
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: 0.2
            }}>
              No semantic context
            </div>
          )}
        </div>
      </div>
      
      {/* Model info */}
      <div style={{ marginTop: 10, padding: 8, background: 'rgb(var(--surface-2))', borderRadius: 6, border: '1px solid rgb(var(--border))' }}>
        <div style={{ fontSize: 11, color: 'rgb(var(--muted))', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Sparkles size={12} /> 
          <span style={{ fontWeight: 500 }}>{modelName}</span>
        </div>
        {hasCustomParams && (
          <div style={{ fontSize: 10, color: 'rgb(var(--muted))', marginTop: 4 }}>
            temp: {data.temperature ?? 0.7} | max: {data.maxTokens ?? 4096}
          </div>
        )}
      </div>
      
      {/* Tools indicator */}
      {enabledTools.length > 0 && (
        <div style={{ marginTop: 8, padding: '6px 8px', background: 'rgb(var(--surface-2))', borderRadius: 6, border: '1px solid rgb(var(--border))' }}>
          <div style={{ fontSize: 10, color: 'rgb(var(--fg-muted))', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Wrench size={11} />
            <span style={{ fontWeight: 500 }}>Tools:</span>
            <span>{enabledTools.join(', ')}</span>
          </div>
        </div>
      )}
      
      {/* System prompt preview */}
      {data.systemPrompt && (
        <div style={{ marginTop: 8, fontSize: 11, color: 'rgb(var(--muted))', lineHeight: 1.4 }}>
          {data.systemPrompt.length > 60 ? data.systemPrompt.slice(0, 60) + '...' : data.systemPrompt}
        </div>
      )}
      
      {/* Indicators */}
      <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {data.enableGuardrails && (
          <span style={{ fontSize: 9, background: '#D1FAE5', color: '#065F46', padding: '2px 6px', borderRadius: 4 }}>
            🛡️ Guardrails
          </span>
        )}
        {data.responseFormat === 'json' && (
          <span style={{ fontSize: 9, background: '#E0E7FF', color: '#4338CA', padding: '2px 6px', borderRadius: 4 }}>
            JSON
          </span>
        )}
      </div>
      
      <Handle type="source" position={Position.Right} style={{ background: '#8B5CF6', width: 10, height: 10, border: '2px solid rgb(var(--handle-border))' }} />
    </div>
  );
};
