import ReactFlow, { Background, Controls, ReactFlowProvider } from 'reactflow';
import 'reactflow/dist/style.css';
import { useFlowStore } from './store';
import { SnowflakeSourceNode } from './nodes/SnowflakeSourceNode';
import { AgentNode } from './nodes/AgentNode';
import { OutputNode } from './nodes/OutputNode';
import { CortexNode } from './nodes/CortexNode';
import { ConditionNode } from './nodes/ConditionNode';
import { ExternalAgentNode } from './nodes/ExternalAgentNode';
import { SemanticModelNode } from './nodes/SemanticModelNode';
import { RouterNode } from './nodes/RouterNode';
import { SupervisorNode } from './nodes/SupervisorNode';
import { FileInputNode, FileOutputNode, SchemaExtractorNode, SchemaTransformerNode } from './nodes/SchemaNodes';
import DaxTranslatorNode from './nodes/DaxTranslatorNode';
import { DataCatalog } from './components/DataCatalog';
import { Templates, templateConfigs } from './components/Templates';
import { LivePreview } from './components/LivePreview';
import { ToolCreator } from './components/ToolCreator';
import type { CustomTool } from './components/ToolCreator';
import { AdminDashboard } from './components/AdminDashboard';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Database, Brain, FileOutput, Play, X, Sparkles, Save, FolderOpen, Loader2, CheckCircle, AlertCircle, FileText, Heart, Languages, GitBranch, Globe, Layers, BookOpen, Zap, MessageSquare, Download, Upload, Shield, Bot, Cloud, Building2, FileUp, FileDown, ArrowRightLeft, GripVertical, ChevronLeft, ChevronRight } from 'lucide-react';
import axios from 'axios';
import type { Node } from 'reactflow';

const nodeTypes = {
  snowflakeSource: SnowflakeSourceNode,
  semanticModel: SemanticModelNode,
  agent: AgentNode,
  cortexAgent: AgentNode,  // Alias for templates using 'cortexAgent' type
  output: OutputNode,
  cortex: CortexNode,
  condition: ConditionNode,
  externalAgent: ExternalAgentNode,
  router: RouterNode,
  supervisor: SupervisorNode,
  fileInput: FileInputNode,
  fileOutput: FileOutputNode,
  schemaExtractor: SchemaExtractorNode,
  schemaTransformer: SchemaTransformerNode,
  daxTranslator: DaxTranslatorNode,
};

let nodeId = 10;

function NodeDetailPanel({ customTools, isReadOnly }: { customTools: CustomTool[]; isReadOnly?: boolean }) {
  const { selectedNode, setSelectedNode, updateNodeData } = useFlowStore();
  
  if (!selectedNode) return null;


  const renderFields = () => {
    const { type, data } = selectedNode;
    
    if (type === 'snowflakeSource') {
      return (
        <>
          {/* Basic Identification */}
          <div style={sectionStyle}>Object</div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Name (Table/View)</label>
            <input 
              style={inputStyle} 
              value={data.label || ''} 
              onChange={(e) => updateNodeData(selectedNode.id, { label: e.target.value })}
              placeholder="e.g., SALES_DATA"
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Database</label>
            <input 
              style={inputStyle} 
              value={data.database || ''} 
              onChange={(e) => updateNodeData(selectedNode.id, { database: e.target.value })}
              placeholder="e.g., SNOWFLOW_DEV"
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Schema</label>
            <input 
              style={inputStyle} 
              value={data.schema || ''} 
              onChange={(e) => updateNodeData(selectedNode.id, { schema: e.target.value })}
              placeholder="e.g., DEMO"
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Object Type</label>
            <select 
              style={inputStyle} 
              value={data.objectType || 'table'}
              onChange={(e) => updateNodeData(selectedNode.id, { objectType: e.target.value })}
            >
              <option value="table">Table</option>
              <option value="view">View</option>
              <option value="dynamic_table">Dynamic Table</option>
              <option value="stream">Stream</option>
            </select>
          </div>

          {/* Query Configuration */}
          <div style={sectionStyle}>Query Options</div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Columns</label>
            <input 
              style={inputStyle} 
              value={data.columns || ''} 
              onChange={(e) => updateNodeData(selectedNode.id, { columns: e.target.value })}
              placeholder="* (all) or COL1, COL2, COL3"
            />
            <div style={hintStyle}>Comma-separated column names, or * for all</div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Filter (WHERE)</label>
            <input 
              style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 12 }} 
              value={data.filter || ''} 
              onChange={(e) => updateNodeData(selectedNode.id, { filter: e.target.value })}
              placeholder="e.g., status = 'active' AND amount > 100"
            />
            <div style={hintStyle}>SQL WHERE clause (without WHERE keyword)</div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Order By</label>
            <input 
              style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 12 }} 
              value={data.orderBy || ''} 
              onChange={(e) => updateNodeData(selectedNode.id, { orderBy: e.target.value })}
              placeholder="e.g., created_at DESC"
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Limit</label>
            <input 
              type="number"
              style={inputStyle} 
              value={data.limit || ''} 
              onChange={(e) => updateNodeData(selectedNode.id, { limit: parseInt(e.target.value) || null })}
              placeholder="100"
            />
            <div style={hintStyle}>Max rows to fetch (default: 100)</div>
          </div>

          {/* Dynamic Table specific options */}
          {data.objectType === 'dynamic_table' && (
            <>
              <div style={sectionStyle}>Dynamic Table</div>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Target Lag</label>
                <select 
                  style={inputStyle} 
                  value={data.targetLag || '1 hour'}
                  onChange={(e) => updateNodeData(selectedNode.id, { targetLag: e.target.value })}
                >
                  <option value="1 minute">1 minute</option>
                  <option value="5 minutes">5 minutes</option>
                  <option value="15 minutes">15 minutes</option>
                  <option value="1 hour">1 hour</option>
                  <option value="1 day">1 day</option>
                </select>
                <div style={hintStyle}>How fresh the data should be</div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Warehouse</label>
                <input 
                  style={inputStyle} 
                  value={data.warehouse || ''} 
                  onChange={(e) => updateNodeData(selectedNode.id, { warehouse: e.target.value })}
                  placeholder="COMPUTE_WH"
                />
              </div>
            </>
          )}

          {/* Stream specific options */}
          {data.objectType === 'stream' && (
            <>
              <div style={sectionStyle}>Stream</div>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Source Table</label>
                <input 
                  style={inputStyle} 
                  value={data.sourceTable || ''} 
                  onChange={(e) => updateNodeData(selectedNode.id, { sourceTable: e.target.value })}
                  placeholder="SOURCE_TABLE_NAME"
                />
                <div style={hintStyle}>Table this stream tracks changes on</div>
              </div>
              <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <input 
                  type="checkbox"
                  checked={data.appendOnly || false} 
                  onChange={(e) => updateNodeData(selectedNode.id, { appendOnly: e.target.checked })}
                />
                <label style={{ fontSize: 13, color: '#1F2937' }}>Append Only</label>
              </div>
              <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <input 
                  type="checkbox"
                  checked={data.showInitialRows || false} 
                  onChange={(e) => updateNodeData(selectedNode.id, { showInitialRows: e.target.checked })}
                />
                <label style={{ fontSize: 13, color: '#1F2937' }}>Show Initial Rows</label>
              </div>
            </>
          )}
        </>
      );
    }
    
    if (type === 'agent') {
      return (
        <>
          {/* Basic */}
          <div style={sectionStyle}>Agent</div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Name</label>
            <input 
              style={inputStyle} 
              value={data.label || ''} 
              onChange={(e) => updateNodeData(selectedNode.id, { label: e.target.value })}
            />
          </div>

          {/* Model Selection - All Cortex models */}
          <div style={sectionStyle}>Model (CORTEX.COMPLETE)</div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>LLM Model</label>
            <select 
              style={inputStyle} 
              value={data.model || 'mistral-large2'}
              onChange={(e) => updateNodeData(selectedNode.id, { model: e.target.value })}
            >
              <optgroup label="Mistral">
                <option value="mistral-large2">Mistral Large 2 (recommended)</option>
                <option value="mistral-large">Mistral Large</option>
                <option value="mixtral-8x7b">Mixtral 8x7B</option>
                <option value="mistral-7b">Mistral 7B</option>
              </optgroup>
              <optgroup label="Meta Llama">
                <option value="llama3.1-405b">Llama 3.1 405B</option>
                <option value="llama3.1-70b">Llama 3.1 70B</option>
                <option value="llama3.1-8b">Llama 3.1 8B</option>
                <option value="llama3-70b">Llama 3 70B</option>
                <option value="llama3-8b">Llama 3 8B</option>
              </optgroup>
              <optgroup label="Snowflake">
                <option value="snowflake-arctic">Snowflake Arctic</option>
              </optgroup>
              <optgroup label="Other">
                <option value="reka-flash">Reka Flash</option>
                <option value="reka-core">Reka Core</option>
                <option value="jamba-instruct">Jamba Instruct</option>
                <option value="jamba-1.5-mini">Jamba 1.5 Mini</option>
                <option value="jamba-1.5-large">Jamba 1.5 Large</option>
                <option value="gemma-7b">Gemma 7B</option>
              </optgroup>
            </select>
          </div>

          {/* Prompt Configuration */}
          <div style={sectionStyle}>Prompt</div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>System Prompt</label>
            <textarea 
              style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} 
              value={data.systemPrompt || data.instructions || ''} 
              onChange={(e) => updateNodeData(selectedNode.id, { systemPrompt: e.target.value, instructions: e.target.value })}
              placeholder="You are a helpful data analyst. Analyze the provided data and give insights."
            />
            <div style={hintStyle}>Instructions for the AI agent</div>
          </div>

          {/* Generation Parameters */}
          <div style={sectionStyle}>Generation Parameters</div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Temperature: {data.temperature ?? 0.7}</label>
            <input 
              type="range"
              min="0"
              max="1"
              step="0.1"
              style={{ width: '100%' }} 
              value={data.temperature ?? 0.7} 
              onChange={(e) => updateNodeData(selectedNode.id, { temperature: parseFloat(e.target.value) })}
            />
            <div style={hintStyle}>0 = deterministic, 1 = creative</div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Max Tokens</label>
            <input 
              type="number"
              style={inputStyle} 
              value={data.maxTokens ?? 4096} 
              onChange={(e) => updateNodeData(selectedNode.id, { maxTokens: parseInt(e.target.value) })}
              placeholder="4096"
            />
            <div style={hintStyle}>Maximum tokens to generate</div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Top P: {data.topP ?? 1.0}</label>
            <input 
              type="range"
              min="0"
              max="1"
              step="0.1"
              style={{ width: '100%' }} 
              value={data.topP ?? 1.0} 
              onChange={(e) => updateNodeData(selectedNode.id, { topP: parseFloat(e.target.value) })}
            />
            <div style={hintStyle}>Nucleus sampling (1.0 = disabled)</div>
          </div>

          {/* Safety & Format */}
          <div style={sectionStyle}>Options</div>
          <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <input 
              type="checkbox"
              checked={data.enableGuardrails || false} 
              onChange={(e) => updateNodeData(selectedNode.id, { enableGuardrails: e.target.checked })}
            />
            <label style={{ fontSize: 13, color: '#1F2937' }}>Enable Cortex Guard (safety filters)</label>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Response Format</label>
            <select 
              style={inputStyle} 
              value={data.responseFormat || 'text'}
              onChange={(e) => updateNodeData(selectedNode.id, { responseFormat: e.target.value })}
            >
              <option value="text">Text</option>
              <option value="json">JSON</option>
            </select>
          </div>

          {/* Tools - Agent's available tools */}
          <div style={sectionStyle}>Tools</div>
          <div style={{ padding: 10, background: '#F0F9FF', borderRadius: 8, border: '1px solid #BAE6FD', marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: '#0369A1', marginBottom: 8 }}>
              Agent can use these tools to complete tasks
            </div>
            
            {/* Cortex Analyst Tool (Structured) */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <input 
                  type="checkbox"
                  checked={data.tools?.analyst?.enabled || false}
                  onChange={(e) => updateNodeData(selectedNode.id, { 
                    tools: { 
                      ...data.tools,
                      analyst: { ...data.tools?.analyst, enabled: e.target.checked }
                    }
                  })}
                />
                <label style={{ fontSize: 12, fontWeight: 500, color: '#1F2937' }}>📊 Cortex Analyst</label>
                <span style={{ fontSize: 9, color: '#9CA3AF', background: '#F3F4F6', padding: '1px 4px', borderRadius: 3 }}>structured</span>
              </div>
              {data.tools?.analyst?.enabled && (
                <div style={{ marginLeft: 20, padding: 8, background: 'white', borderRadius: 6, border: '1px solid #E5E9F0' }}>
                  <div style={{ fontSize: 10, color: '#6B7280', marginBottom: 6 }}>
                    Connect to a Semantic Model for NL→SQL
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <label style={{ ...labelStyle, fontSize: 10 }}>Database</label>
                    <input 
                      style={{ ...inputStyle, fontSize: 11, padding: '6px 8px' }}
                      value={data.tools?.analyst?.semanticModelDatabase || ''}
                      onChange={(e) => updateNodeData(selectedNode.id, {
                        tools: {
                          ...data.tools,
                          analyst: { ...data.tools?.analyst, semanticModelDatabase: e.target.value }
                        }
                      })}
                      placeholder="SNOWFLOW_DEV"
                    />
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <label style={{ ...labelStyle, fontSize: 10 }}>Schema</label>
                    <input 
                      style={{ ...inputStyle, fontSize: 11, padding: '6px 8px' }}
                      value={data.tools?.analyst?.semanticModelSchema || ''}
                      onChange={(e) => updateNodeData(selectedNode.id, {
                        tools: {
                          ...data.tools,
                          analyst: { ...data.tools?.analyst, semanticModelSchema: e.target.value }
                        }
                      })}
                      placeholder="DEMO"
                    />
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <label style={{ ...labelStyle, fontSize: 10 }}>Stage</label>
                    <input 
                      style={{ ...inputStyle, fontSize: 11, padding: '6px 8px' }}
                      value={data.tools?.analyst?.semanticModelStage || ''}
                      onChange={(e) => updateNodeData(selectedNode.id, {
                        tools: {
                          ...data.tools,
                          analyst: { ...data.tools?.analyst, semanticModelStage: e.target.value }
                        }
                      })}
                      placeholder="SEMANTIC_MODELS"
                    />
                  </div>
                  <div>
                    <label style={{ ...labelStyle, fontSize: 10 }}>YAML File</label>
                    <input 
                      style={{ ...inputStyle, fontSize: 11, padding: '6px 8px' }}
                      value={data.tools?.analyst?.semanticModelFile || ''}
                      onChange={(e) => updateNodeData(selectedNode.id, {
                        tools: {
                          ...data.tools,
                          analyst: { ...data.tools?.analyst, semanticModelFile: e.target.value }
                        }
                      })}
                      placeholder="sales_model.yaml"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Cortex Search Tool (Unstructured) */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <input 
                  type="checkbox"
                  checked={data.tools?.search?.enabled || false}
                  onChange={(e) => updateNodeData(selectedNode.id, { 
                    tools: { 
                      ...data.tools,
                      search: { ...data.tools?.search, enabled: e.target.checked }
                    }
                  })}
                />
                <label style={{ fontSize: 12, fontWeight: 500, color: '#1F2937' }}>🔍 Cortex Search</label>
                <span style={{ fontSize: 9, color: '#9CA3AF', background: '#F3F4F6', padding: '1px 4px', borderRadius: 3 }}>unstructured</span>
              </div>
              {data.tools?.search?.enabled && (
                <div style={{ marginLeft: 20, padding: 8, background: 'white', borderRadius: 6, border: '1px solid #E5E9F0' }}>
                  <div style={{ fontSize: 10, color: '#6B7280', marginBottom: 6 }}>
                    Vector search on documents/text
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <label style={{ ...labelStyle, fontSize: 10 }}>Search Service Name</label>
                    <input 
                      style={{ ...inputStyle, fontSize: 11, padding: '6px 8px' }}
                      value={data.tools?.search?.searchServiceName || ''}
                      onChange={(e) => updateNodeData(selectedNode.id, {
                        tools: {
                          ...data.tools,
                          search: { ...data.tools?.search, searchServiceName: e.target.value }
                        }
                      })}
                      placeholder="my_search_service"
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    <div>
                      <label style={{ ...labelStyle, fontSize: 10 }}>Database</label>
                      <input 
                        style={{ ...inputStyle, fontSize: 11, padding: '6px 8px' }}
                        value={data.tools?.search?.database || ''}
                        onChange={(e) => updateNodeData(selectedNode.id, {
                          tools: {
                            ...data.tools,
                            search: { ...data.tools?.search, database: e.target.value }
                          }
                        })}
                        placeholder="DB"
                      />
                    </div>
                    <div>
                      <label style={{ ...labelStyle, fontSize: 10 }}>Schema</label>
                      <input 
                        style={{ ...inputStyle, fontSize: 11, padding: '6px 8px' }}
                        value={data.tools?.search?.schema || ''}
                        onChange={(e) => updateNodeData(selectedNode.id, {
                          tools: {
                            ...data.tools,
                            search: { ...data.tools?.search, schema: e.target.value }
                          }
                        })}
                        placeholder="SCHEMA"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* MCP Tool (External Tools) */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <input 
                  type="checkbox"
                  checked={data.tools?.mcp?.enabled || false}
                  onChange={(e) => updateNodeData(selectedNode.id, { 
                    tools: { 
                      ...data.tools,
                      mcp: { ...data.tools?.mcp, enabled: e.target.checked }
                    }
                  })}
                />
                <label style={{ fontSize: 12, fontWeight: 500, color: '#1F2937' }}>🔌 MCP</label>
                <span style={{ fontSize: 9, color: '#9CA3AF', background: '#F3F4F6', padding: '1px 4px', borderRadius: 3 }}>external tools</span>
              </div>
              {data.tools?.mcp?.enabled && (
                <div style={{ marginLeft: 20, padding: 8, background: 'white', borderRadius: 6, border: '1px solid #E5E9F0' }}>
                  <div style={{ fontSize: 10, color: '#6B7280', marginBottom: 6 }}>
                    Connect to MCP server for external tools
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <label style={{ ...labelStyle, fontSize: 10 }}>MCP Server URL</label>
                    <input 
                      style={{ ...inputStyle, fontSize: 11, padding: '6px 8px' }}
                      value={data.tools?.mcp?.serverUrl || ''}
                      onChange={(e) => updateNodeData(selectedNode.id, {
                        tools: {
                          ...data.tools,
                          mcp: { ...data.tools?.mcp, serverUrl: e.target.value }
                        }
                      })}
                      placeholder="http://localhost:3000/mcp"
                    />
                  </div>
                  <div>
                    <label style={{ ...labelStyle, fontSize: 10 }}>Enabled Tools (comma-separated)</label>
                    <input 
                      style={{ ...inputStyle, fontSize: 11, padding: '6px 8px' }}
                      value={data.tools?.mcp?.enabledTools?.join(', ') || ''}
                      onChange={(e) => updateNodeData(selectedNode.id, {
                        tools: {
                          ...data.tools,
                          mcp: { ...data.tools?.mcp, enabledTools: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }
                        }
                      })}
                      placeholder="tool1, tool2, tool3"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* SQL Executor Tool */}
            <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <input 
                type="checkbox"
                checked={data.tools?.sqlExecutor || false}
                onChange={(e) => updateNodeData(selectedNode.id, { 
                  tools: { ...data.tools, sqlExecutor: e.target.checked }
                })}
              />
              <label style={{ fontSize: 12, color: '#1F2937' }}>⚡ SQL Executor</label>
            </div>

            {/* Web Search Tool */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <input 
                type="checkbox"
                checked={data.tools?.webSearch || false}
                onChange={(e) => updateNodeData(selectedNode.id, { 
                  tools: { ...data.tools, webSearch: e.target.checked }
                })}
              />
              <label style={{ fontSize: 12, color: '#1F2937' }}>🌐 Web Search</label>
            </div>

            {/* Custom Tools */}
            {customTools.length > 0 && (
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #E5E9F0' }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#8B5CF6', marginBottom: 6 }}>
                  Custom Tools
                </div>
                {customTools.map(tool => (
                  <div key={tool.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <input 
                      type="checkbox"
                      checked={data.tools?.customTools?.includes(tool.id) || false}
                      onChange={(e) => {
                        const current = data.tools?.customTools || [];
                        const updated = e.target.checked 
                          ? [...current, tool.id]
                          : current.filter((id: string) => id !== tool.id);
                        updateNodeData(selectedNode.id, { 
                          tools: { ...data.tools, customTools: updated }
                        });
                      }}
                    />
                    <label style={{ fontSize: 11, color: '#1F2937' }}>
                      🔧 {tool.name}
                      <span style={{ fontSize: 9, color: '#9CA3AF', marginLeft: 4 }}>
                        ({tool.type})
                      </span>
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      );
    }
    
    if (type === 'output') {
      return (
        <>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Output Name</label>
            <input 
              style={inputStyle} 
              value={data.label || ''} 
              onChange={(e) => updateNodeData(selectedNode.id, { label: e.target.value })}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Output Type</label>
            <select 
              style={inputStyle} 
              value={data.outputType || 'display'}
              onChange={(e) => updateNodeData(selectedNode.id, { outputType: e.target.value })}
            >
              <option value="display">Display</option>
              <option value="table">Table</option>
              <option value="chart">Chart</option>
            </select>
          </div>
        </>
      );
    }

    if (type === 'cortex') {
      return (
        <>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Name</label>
            <input 
              style={inputStyle} 
              value={data.label || ''} 
              onChange={(e) => updateNodeData(selectedNode.id, { label: e.target.value })}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Cortex Function</label>
            <select 
              style={inputStyle} 
              value={data.cortexFunction || 'complete'}
              onChange={(e) => updateNodeData(selectedNode.id, { cortexFunction: e.target.value })}
            >
              <option value="complete">Complete (LLM)</option>
              <option value="summarize">Summarize</option>
              <option value="sentiment">Sentiment</option>
              <option value="translate">Translate</option>
              <option value="embed">Embed Text</option>
            </select>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Source Column</label>
            <input 
              style={inputStyle} 
              value={data.sourceColumn || ''} 
              onChange={(e) => updateNodeData(selectedNode.id, { sourceColumn: e.target.value })}
              placeholder="e.g., FEEDBACK_TEXT"
            />
          </div>
          {data.cortexFunction === 'translate' && (
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Target Language</label>
              <select 
                style={inputStyle} 
                value={data.targetLanguage || 'es'}
                onChange={(e) => updateNodeData(selectedNode.id, { targetLanguage: e.target.value })}
              >
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
                <option value="ja">Japanese</option>
                <option value="zh">Chinese</option>
              </select>
            </div>
          )}
          {data.cortexFunction === 'complete' && (
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Prompt</label>
              <textarea 
                style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} 
                value={data.prompt || ''} 
                onChange={(e) => updateNodeData(selectedNode.id, { prompt: e.target.value })}
                placeholder="Enter your prompt..."
              />
            </div>
          )}
        </>
      );
    }

    if (type === 'condition') {
      return (
        <>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Name</label>
            <input 
              style={inputStyle} 
              value={data.label || ''} 
              onChange={(e) => updateNodeData(selectedNode.id, { label: e.target.value })}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Condition Expression</label>
            <input 
              style={{ ...inputStyle, fontFamily: 'monospace' }} 
              value={data.condition || ''} 
              onChange={(e) => updateNodeData(selectedNode.id, { condition: e.target.value })}
              placeholder="e.g., sentiment > 0"
            />
          </div>
          <div style={{ padding: 12, background: '#FEF3C7', borderRadius: 8, fontSize: 11, color: '#92400E' }}>
            <strong>Outputs:</strong><br/>
            ✓ True path (green handle)<br/>
            ✗ False path (red handle)
          </div>
        </>
      );
    }

    if (type === 'router') {
      return (
        <>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Router Name</label>
            <input 
              style={inputStyle} 
              value={data.label || ''} 
              onChange={(e) => updateNodeData(selectedNode.id, { label: e.target.value })}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Routing Strategy</label>
            <select 
              style={inputStyle} 
              value={data.routingStrategy || 'intent'}
              onChange={(e) => updateNodeData(selectedNode.id, { routingStrategy: e.target.value })}
            >
              <option value="intent">Intent Classification (LLM)</option>
              <option value="keyword">Keyword Matching</option>
              <option value="llm">LLM Decision</option>
              <option value="round_robin">Round Robin</option>
            </select>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Routes</label>
            <div style={{ fontSize: 10, color: '#6B7280', marginBottom: 8 }}>
              Connect each output handle to a different agent
            </div>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input
                  style={{ ...inputStyle, flex: 1 }}
                  placeholder={`Route ${i} name`}
                  value={data.routes?.[i-1]?.name || ''}
                  onChange={(e) => {
                    const routes = [...(data.routes || [{}, {}, {}])];
                    routes[i-1] = { ...routes[i-1], name: e.target.value };
                    updateNodeData(selectedNode.id, { routes });
                  }}
                />
                <input
                  style={{ ...inputStyle, flex: 1, fontFamily: 'monospace', fontSize: 10 }}
                  placeholder="Condition"
                  value={data.routes?.[i-1]?.condition || ''}
                  onChange={(e) => {
                    const routes = [...(data.routes || [{}, {}, {}])];
                    routes[i-1] = { ...routes[i-1], condition: e.target.value };
                    updateNodeData(selectedNode.id, { routes });
                  }}
                />
              </div>
            ))}
          </div>
          <div style={{ padding: 12, background: '#FDF4FF', borderRadius: 8, fontSize: 11, color: '#7E22CE' }}>
            <strong>How it works:</strong><br/>
            Routes incoming requests to different agents based on intent or conditions.
          </div>
        </>
      );
    }

    if (type === 'supervisor') {
      return (
        <>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Supervisor Name</label>
            <input 
              style={inputStyle} 
              value={data.label || ''} 
              onChange={(e) => updateNodeData(selectedNode.id, { label: e.target.value })}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Model</label>
            <select 
              style={inputStyle} 
              value={data.model || 'mistral-large2'}
              onChange={(e) => updateNodeData(selectedNode.id, { model: e.target.value })}
            >
              <option value="mistral-large2">Mistral Large 2</option>
              <option value="llama3.1-70b">Llama 3.1 70B</option>
              <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
            </select>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Delegation Strategy</label>
            <select 
              style={inputStyle} 
              value={data.delegationStrategy || 'adaptive'}
              onChange={(e) => updateNodeData(selectedNode.id, { delegationStrategy: e.target.value })}
            >
              <option value="adaptive">Adaptive (LLM decides)</option>
              <option value="parallel">Parallel (all at once)</option>
              <option value="sequential">Sequential (one by one)</option>
            </select>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>System Prompt</label>
            <textarea 
              style={{ ...inputStyle, minHeight: 80 }} 
              value={data.systemPrompt || ''} 
              onChange={(e) => updateNodeData(selectedNode.id, { systemPrompt: e.target.value })}
              placeholder="You are a supervisor agent. Delegate tasks to specialized agents and aggregate their results."
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Aggregation Method</label>
            <select 
              style={inputStyle} 
              value={data.aggregationMethod || 'merge'}
              onChange={(e) => updateNodeData(selectedNode.id, { aggregationMethod: e.target.value })}
            >
              <option value="merge">Merge all responses</option>
              <option value="vote">Majority vote</option>
              <option value="first">First response wins</option>
              <option value="custom">Custom (LLM summarizes)</option>
            </select>
          </div>
          <div style={{ padding: 12, background: '#FFFBEB', borderRadius: 8, fontSize: 11, color: '#92400E' }}>
            <strong>Supervisor Pattern:</strong><br/>
            Breaks complex tasks into subtasks, delegates to child agents, then aggregates results.
          </div>
        </>
      );
    }

    // Schema Migration Nodes
    if (type === 'fileInput') {
      return (
        <>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Label</label>
            <input 
              style={inputStyle} 
              value={data.label || ''} 
              onChange={(e) => updateNodeData(selectedNode.id, { label: e.target.value })}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>File Type</label>
            <select 
              style={inputStyle} 
              value={data.fileType || 'tmdl'}
              onChange={(e) => updateNodeData(selectedNode.id, { fileType: e.target.value })}
            >
              <option value="tmdl">Power BI TMDL</option>
              <option value="json">JSON</option>
              <option value="yaml">YAML</option>
            </select>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>File Content (paste here)</label>
            <textarea 
              style={{ ...inputStyle, minHeight: 120, fontFamily: 'monospace', fontSize: 10 }} 
              value={data.fileContent || ''} 
              onChange={(e) => updateNodeData(selectedNode.id, { fileContent: e.target.value })}
              placeholder="Paste your TMDL/JSON content here, or leave empty for demo sample..."
            />
          </div>
          <div style={{ padding: 12, background: '#E0F2FE', borderRadius: 8, fontSize: 11, color: '#0369A1' }}>
            <strong>💡 Tip:</strong> Leave empty to use sample Power BI model for demo.
          </div>
        </>
      );
    }

    if (type === 'schemaExtractor') {
      return (
        <>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Label</label>
            <input 
              style={inputStyle} 
              value={data.label || ''} 
              onChange={(e) => updateNodeData(selectedNode.id, { label: e.target.value })}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Source Format</label>
            <select 
              style={inputStyle} 
              value={data.sourceFormat || 'powerbi'}
              onChange={(e) => updateNodeData(selectedNode.id, { sourceFormat: e.target.value })}
            >
              <option value="powerbi">Power BI (TMDL/DAX)</option>
              <option value="dbt">dbt (YAML)</option>
              <option value="looker">Looker (LookML)</option>
              <option value="tableau">Tableau</option>
            </select>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Extraction Agent</label>
            <select 
              style={inputStyle} 
              value={data.extractionAgent || 'copilot'}
              onChange={(e) => updateNodeData(selectedNode.id, { extractionAgent: e.target.value })}
            >
              <option value="copilot">Microsoft Copilot</option>
              <option value="cortex">Snowflake Cortex</option>
              <option value="openai">OpenAI GPT-4</option>
            </select>
          </div>
          <div style={{ padding: 12, background: '#E0F2FE', borderRadius: 8, fontSize: 11, color: '#0369A1' }}>
            <strong>🔄 Extracts:</strong> Tables, columns, measures (DAX), relationships → Interchange JSON
          </div>
        </>
      );
    }

    if (type === 'schemaTransformer') {
      return (
        <>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Label</label>
            <input 
              style={inputStyle} 
              value={data.label || ''} 
              onChange={(e) => updateNodeData(selectedNode.id, { label: e.target.value })}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Target Format</label>
            <select 
              style={inputStyle} 
              value={data.targetFormat || 'snowflake'}
              onChange={(e) => updateNodeData(selectedNode.id, { targetFormat: e.target.value })}
            >
              <option value="snowflake">Snowflake Cortex YAML</option>
              <option value="dbt">dbt Semantic Layer</option>
            </select>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Transformation Agent</label>
            <select 
              style={inputStyle} 
              value={data.transformationAgent || 'cortex'}
              onChange={(e) => updateNodeData(selectedNode.id, { transformationAgent: e.target.value })}
            >
              <option value="cortex">Snowflake Cortex</option>
              <option value="openai">OpenAI GPT-4</option>
            </select>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Snowflake Database</label>
            <input 
              style={inputStyle} 
              value={data.database || 'SNOWFLOW_DEV'} 
              onChange={(e) => updateNodeData(selectedNode.id, { database: e.target.value })}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Snowflake Schema</label>
            <input 
              style={inputStyle} 
              value={data.schema || 'DEMO'} 
              onChange={(e) => updateNodeData(selectedNode.id, { schema: e.target.value })}
            />
          </div>
          <div style={{ padding: 12, background: '#ECFDF5', borderRadius: 8, fontSize: 11, color: '#065F46' }}>
            <strong>❄️ Generates:</strong> Cortex Analyst YAML with synonyms, sample questions, SQL measures
          </div>
        </>
      );
    }

    if (type === 'daxTranslator') {
      return (
        <>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Label</label>
            <input 
              style={inputStyle} 
              value={data.label || ''} 
              onChange={(e) => updateNodeData(selectedNode.id, { label: e.target.value })}
              disabled={isReadOnly}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>DAX Expression</label>
            <textarea 
              style={{ ...inputStyle, minHeight: 100, fontFamily: 'monospace', fontSize: 11 }} 
              value={data.daxExpression || ''} 
              onChange={(e) => updateNodeData(selectedNode.id, { daxExpression: e.target.value })}
              placeholder="e.g., SUM(Sales[Amount])"
              disabled={isReadOnly}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 8 }}>
              <input 
                type="checkbox"
                checked={data.autoTranslate !== false}
                onChange={(e) => updateNodeData(selectedNode.id, { autoTranslate: e.target.checked })}
                disabled={isReadOnly}
              />
              Auto-translate on change
            </label>
          </div>
          {data.sqlOutput && (
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>SQL Output</label>
              <div style={{ 
                padding: 12, 
                background: '#0f172a', 
                borderRadius: 8, 
                fontSize: 11, 
                color: '#22c55e',
                fontFamily: 'monospace',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all'
              }}>
                {data.sqlOutput}
              </div>
            </div>
          )}
          <div style={{ padding: 12, background: '#EEF2FF', borderRadius: 8, fontSize: 11, color: '#3730A3' }}>
            <strong>⚡ Real-time:</strong> 51 DAX patterns → Snowflake SQL
          </div>
        </>
      );
    }

    if (type === 'fileOutput') {
      return (
        <>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Label</label>
            <input 
              style={inputStyle} 
              value={data.label || ''} 
              onChange={(e) => updateNodeData(selectedNode.id, { label: e.target.value })}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Output Format</label>
            <select 
              style={inputStyle} 
              value={data.outputFormat || 'yaml'}
              onChange={(e) => updateNodeData(selectedNode.id, { outputFormat: e.target.value })}
            >
              <option value="yaml">Snowflake YAML</option>
              <option value="json">Interchange JSON</option>
              <option value="sql">SQL DDL</option>
            </select>
          </div>
          <div style={{ padding: 12, background: '#ECFDF5', borderRadius: 8, fontSize: 11, color: '#065F46' }}>
            <strong>📥 Output:</strong> Generated file will appear in the results panel after running.
          </div>
        </>
      );
    }

    if (type === 'externalAgent') {
      return (
        <>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Name</label>
            <input 
              style={inputStyle} 
              value={data.label || ''} 
              onChange={(e) => updateNodeData(selectedNode.id, { label: e.target.value })}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Agent Type</label>
            <select 
              style={inputStyle} 
              value={data.agentType || 'rest'}
              onChange={(e) => updateNodeData(selectedNode.id, { agentType: e.target.value })}
            >
              <option value="rest">REST API</option>
              <option value="mcp">MCP Agent</option>
              <option value="webhook">Webhook</option>
            </select>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Endpoint URL</label>
            <input 
              style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 12 }} 
              value={data.endpoint || ''} 
              onChange={(e) => updateNodeData(selectedNode.id, { endpoint: e.target.value })}
              placeholder="https://api.example.com/agent"
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Method</label>
            <select 
              style={inputStyle} 
              value={data.method || 'POST'}
              onChange={(e) => updateNodeData(selectedNode.id, { method: e.target.value })}
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
            </select>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Authentication</label>
            <select 
              style={inputStyle} 
              value={data.authType || 'none'}
              onChange={(e) => updateNodeData(selectedNode.id, { authType: e.target.value })}
            >
              <option value="none">None</option>
              <option value="bearer">Bearer Token</option>
              <option value="api_key">API Key</option>
            </select>
          </div>
        </>
      );
    }

    if (type === 'semanticModel') {
      return (
        <>
          <div style={sectionStyle}>Semantic Model</div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Model Name</label>
            <input 
              style={inputStyle} 
              value={data.label || ''} 
              onChange={(e) => updateNodeData(selectedNode.id, { label: e.target.value })}
              placeholder="e.g., Sales Analytics Model"
            />
          </div>
          
          <div style={sectionStyle}>YAML Location</div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Database</label>
            <input 
              style={inputStyle} 
              value={data.database || ''} 
              onChange={(e) => updateNodeData(selectedNode.id, { database: e.target.value })}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Schema</label>
            <input 
              style={inputStyle} 
              value={data.schema || ''} 
              onChange={(e) => updateNodeData(selectedNode.id, { schema: e.target.value })}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Stage</label>
            <input 
              style={inputStyle} 
              value={data.stage || ''} 
              onChange={(e) => updateNodeData(selectedNode.id, { stage: e.target.value })}
              placeholder="e.g., SEMANTIC_MODELS"
            />
            <div style={hintStyle}>Internal stage containing YAML file</div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>YAML File Path</label>
            <input 
              style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 12 }} 
              value={data.yamlFile || ''} 
              onChange={(e) => updateNodeData(selectedNode.id, { yamlFile: e.target.value })}
              placeholder="e.g., sales_model.yaml"
            />
          </div>
          
          <div style={{ padding: 12, background: '#E0E7FF', borderRadius: 8, fontSize: 11, color: '#4338CA' }}>
            <strong>Semantic Model defines:</strong><br/>
            • Tables & relationships<br/>
            • Dimensions & measures<br/>
            • Business context for Analyst
          </div>
        </>
      );
    }

    return null;
  };

  const getNodeIcon = () => {
    switch (selectedNode.type) {
      case 'snowflakeSource': return <Database size={20} color="#29B5E8" />;
      case 'semanticModel': return <Layers size={20} color="#6366F1" />;
      case 'agent': return <Brain size={20} color="#8B5CF6" />;
      case 'output': return <FileOutput size={20} color="#10B981" />;
      case 'cortex': return <Sparkles size={20} color="#3B82F6" />;
      case 'condition': return <GitBranch size={20} color="#F59E0B" />;
      case 'externalAgent': return <Globe size={20} color="#EF4444" />;
      default: return <Sparkles size={20} color="#6B7280" />;
    }
  };

  const getNodeTitle = () => {
    switch (selectedNode.type) {
      case 'snowflakeSource': return 'Data Source';
      case 'semanticModel': return 'Semantic Model';
      case 'agent': return 'Cortex Agent';
      case 'output': return 'Output';
      case 'cortex': return 'Cortex Function';
      case 'condition': return 'Condition';
      case 'externalAgent': return 'External Agent';
      default: return 'Node';
    }
  };

  return (
    <div style={{ 
      width: 'var(--panel-width, 340px)',
      minWidth: 280,
      background: '#FFFFFF',
      borderLeft: '1px solid #E5E9F0',
      display: 'flex', 
      flexDirection: 'column',
      fontFamily: 'Inter, -apple-system, sans-serif',
    }}>
      {/* Header */}
      <div style={{ 
        padding: '16px 20px', 
        borderBottom: '1px solid #E5E9F0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {getNodeIcon()}
          <span style={{ fontWeight: 600, color: '#1F2937' }}>{getNodeTitle()}</span>
        </div>
        <button 
          onClick={() => setSelectedNode(null)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
        >
          <X size={18} color="#6B7280" />
        </button>
      </div>

      {/* Fields */}
      <div style={{ padding: 20, flex: 1, overflowY: 'auto' }}>
        {isReadOnly && (
          <div style={{ 
            background: '#FEF3C7', 
            color: '#92400E', 
            padding: '8px 12px', 
            borderRadius: 6, 
            fontSize: 11, 
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}>
            🔒 Live Mode - Read Only
          </div>
        )}
        <fieldset disabled={isReadOnly} style={{ border: 'none', padding: 0, margin: 0, opacity: isReadOnly ? 0.7 : 1 }}>
          {renderFields()}
        </fieldset>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 500,
  color: '#6B7280',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  fontSize: 14,
  border: '1px solid #E5E9F0',
  borderRadius: 6,
  outline: 'none',
  fontFamily: 'Inter, -apple-system, sans-serif',
  boxSizing: 'border-box',
};

const sectionStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  color: '#29B5E8',
  textTransform: 'uppercase',
  letterSpacing: 1,
  marginTop: 20,
  marginBottom: 12,
  paddingBottom: 6,
  borderBottom: '1px solid #E5E9F0',
};

const hintStyle: React.CSSProperties = {
  fontSize: 10,
  color: '#9CA3AF',
  marginTop: 4,
};

type ExecutionStatus = 'idle' | 'running' | 'success' | 'error';
type ExecutionResult = {
  status: string;
  job_id?: string;
  messages?: string[];
  results?: { agent_response?: string };
  error?: string;
  user_prompt?: string;
  executed_nodes?: string[];
  simulated_nodes?: string[];  // Nodes that ran in simulated/demo mode
};

// Collapsible section state
type SectionState = {
  data: boolean;
  semantic: boolean;
  agent: boolean;
  external: boolean;
  migration: boolean;
  output: boolean;
  utils: boolean;
};

// Draggable Panel Component - floats near node, can be moved
function DraggablePanel({ 
  initialPosition, 
  onClose, 
  children 
}: { 
  initialPosition: { x: number; y: number }; 
  onClose: () => void;
  children: React.ReactNode;
}) {
  const [position, setPosition] = useState(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  // Update position when initialPosition changes (new node clicked)
  useEffect(() => {
    setPosition(initialPosition);
  }, [initialPosition.x, initialPosition.y]);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only start drag from the header area
    if ((e.target as HTMLElement).closest('.drag-handle')) {
      setIsDragging(true);
      setDragOffset({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: Math.max(0, Math.min(e.clientX - dragOffset.x, window.innerWidth - 400)),
          y: Math.max(0, Math.min(e.clientY - dragOffset.y, window.innerHeight - 200)),
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  return (
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        zIndex: 1000,
        maxHeight: 'calc(100vh - 120px)',
        maxWidth: 420,
        overflowY: 'auto',
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        borderRadius: 12,
        background: '#FFFFFF',
        border: '1px solid #E5E9F0',
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Drag Handle Header */}
      <div 
        className="drag-handle"
        style={{
          padding: '8px 12px',
          background: 'linear-gradient(135deg, #1E293B 0%, #334155 100%)',
          borderRadius: '12px 12px 0 0',
          cursor: isDragging ? 'grabbing' : 'grab',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <GripVertical size={14} color="#94A3B8" />
          <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500 }}>Drag to move</span>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <X size={16} color="#94A3B8" />
        </button>
      </div>
      {children}
    </div>
  );
}

function Flow() {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, addNode, selectedNode, setSelectedNode, workflowName, setWorkflowName, setWorkflow, clearWorkflow, updateNodeData } = useFlowStore();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [execStatus, setExecStatus] = useState<ExecutionStatus>('idle');
  const [execResult, setExecResult] = useState<ExecutionResult | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [savedWorkflows, setSavedWorkflows] = useState<Array<{ filename: string; name: string; node_count: number }>>([]);
  const [workflowDescription, setWorkflowDescription] = useState('');
  const [backendConnected, setBackendConnected] = useState<boolean | null>(null); // null = checking, true = connected, false = disconnected
  
  // Check backend connection status
  useEffect(() => {
    const checkBackend = async () => {
      try {
        const response = await fetch('http://localhost:8000/health', { 
          method: 'GET',
          signal: AbortSignal.timeout(3000) // 3 second timeout
        });
        setBackendConnected(response.ok);
      } catch {
        setBackendConnected(false);
      }
    };
    
    // Check immediately
    checkBackend();
    
    // Check every 10 seconds
    const interval = setInterval(checkBackend, 10000);
    
    return () => clearInterval(interval);
  }, []);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateCategory, setTemplateCategory] = useState('analytics');
  const [templateComplexity, setTemplateComplexity] = useState('medium');
  const [sections, setSections] = useState<SectionState>({ data: true, semantic: false, agent: true, external: true, migration: false, output: true, utils: false });
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'error' | 'success' } | null>(null);
  const [componentSearch, setComponentSearch] = useState('');
  const [sidebarMode, setSidebarMode] = useState<'components' | 'catalog' | 'templates'>('components');
  const [showPreview, setShowPreview] = useState(false);
  const [showToolCreator, setShowToolCreator] = useState(false);
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);
  const [customTools, setCustomTools] = useState<CustomTool[]>([]);
  const [isProductionMode, setIsProductionMode] = useState(false); // false = build mode (animated), true = production (solid)
  const [userPrompt, setUserPrompt] = useState('');
  const [promptHistory, setPromptHistory] = useState<string[]>([]);
  const [activeNodes, setActiveNodes] = useState<Set<string>>(new Set());
  const [completedNodes, setCompletedNodes] = useState<Set<string>>(new Set());
  const [simulatedNodes, setSimulatedNodes] = useState<Set<string>>(new Set());
  const [executionPhase, setExecutionPhase] = useState<string>('');
  const [panelPosition, setPanelPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [resultsPanelCollapsed, setResultsPanelCollapsed] = useState(false);

  // Load custom tools from Snowflake on startup
  useEffect(() => {
    const loadTools = async () => {
      try {
        const res = await axios.get('http://localhost:8000/tools');
        if (res.data.tools && res.data.tools.length > 0) {
          setCustomTools(res.data.tools.map((t: any) => ({
            id: t.id,
            name: t.name,
            description: t.description,
            type: t.type,
            parameters: t.parameters || [],
            implementation: t.implementation,
            apiEndpoint: t.apiEndpoint,
            apiMethod: t.apiMethod,
            createdAt: t.createdAt ? new Date(t.createdAt) : new Date(),
            createdBy: t.createdBy || 'unknown',
            isApproved: t.isApproved || false,
          })));
        }
      } catch (err) {
        console.log('Could not load tools from Snowflake (table may not exist)');
      }
    };
    loadTools();
  }, []);

  // Helper: check if component matches search
  const matchesSearch = (name: string) => {
    if (!componentSearch) return true;
    return name.toLowerCase().includes(componentSearch.toLowerCase());
  };
  
  // Component definitions for search
  const components = {
    data: ['Table', 'View', 'Dynamic Table', 'Stream'],
    semantic: ['Semantic Model'],
    agent: ['Cortex Agent', 'Router', 'Supervisor', 'Analyst', 'Search', 'MCP', 'SQL'],
    external: ['Custom API', 'Microsoft Copilot', 'OpenAI', 'GPT', 'Salesforce', 'Einstein', 'ServiceNow'],
    migration: ['Schema', 'Migration', 'Power BI', 'TMDL', 'Extract', 'Transform', 'YAML', 'Converter'],
    output: ['Output', 'Display'],
    utils: ['Summarize', 'Sentiment', 'Translate', 'Condition'],
  };
  
  // Check if section has matching components
  const sectionHasMatch = (section: keyof typeof components) => {
    if (!componentSearch) return true;
    return components[section].some(c => c.toLowerCase().includes(componentSearch.toLowerCase()));
  };

  // Show toast notification
  const showToast = (message: string, type: 'info' | 'error' | 'success' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Connection validation rules - Snowflake Intelligence Architecture
  // Flow: Data Sources → Semantic Model → Cortex Agent (with Analyst as tool) → Output
  const isValidConnection = useCallback((connection: { source: string | null; target: string | null }) => {
    if (!connection.source || !connection.target) return false;
    
    const sourceNode = nodes.find(n => n.id === connection.source);
    const targetNode = nodes.find(n => n.id === connection.target);
    
    if (!sourceNode || !targetNode) return false;

    const sourceType = sourceNode.type || '';
    const targetType = targetNode.type || '';

    // Define valid connections based on Snowflake Intelligence architecture:
    // Primary: Data → Semantic Model → Agent → Output
    // Shortcut: Data → Cortex → Output (for simple transforms, with warning)
    const validConnections: Record<string, string[]> = {
      'snowflakeSource': ['semanticModel', 'cortex'],  // Can go to Semantic Model OR directly to Cortex (with warning)
      'semanticModel': ['agent', 'supervisor'],  // Semantic Model feeds into Agent or Supervisor
      'agent': ['externalAgent', 'output', 'cortex', 'condition', 'agent', 'router', 'supervisor'],  // Agent can chain to other agents
      'cortex': ['agent', 'output', 'cortex', 'condition'],
      'condition': ['agent', 'output', 'cortex', 'externalAgent', 'router'],
      'externalAgent': ['agent', 'output', 'router'],
      'router': ['agent', 'supervisor', 'output', 'externalAgent'],  // Router directs to agents (including external)
      'supervisor': ['agent', 'output'],  // Supervisor delegates to agents, aggregates to output
      'output': [],  // Terminal node
      // Schema migration nodes
      'fileInput': ['schemaExtractor'],  // File input → Extractor
      'schemaExtractor': ['schemaTransformer'],  // Extractor → Transformer
      'schemaTransformer': ['fileOutput'],  // Transformer → File output
      'fileOutput': [],  // Terminal node
    };

    // Helpful hints for connections
    const connectionHints: Record<string, Record<string, string>> = {
      'snowflakeSource': {
        'semanticModel': '✓ Data Source → Semantic Model (recommended)',
        'cortex': '⚠️ Direct to Cortex - no semantic context (accuracy may vary)',
      },
      'semanticModel': {
        'agent': '✓ Semantic Model → Agent (Agent uses Analyst tool)',
        'supervisor': '✓ Semantic Model → Supervisor for orchestration',
      },
      'agent': {
        'output': '✓ Agent results → Output',
        'externalAgent': '✓ Agent can invoke external APIs',
        'cortex': '✓ Agent can use Cortex functions',
        'condition': '✓ Agent can branch based on conditions',
        'agent': '✓ Agent handoff to another agent',
        'router': '✓ Agent delegates to Router for intent routing',
        'supervisor': '✓ Agent escalates to Supervisor',
      },
      'cortex': {
        'agent': '✓ Cortex results → Agent for reasoning',
        'output': '✓ Display Cortex results',
        'condition': '✓ Branch based on Cortex output',
      },
      'router': {
        'agent': '✓ Route to specialized agent',
        'supervisor': '✓ Route to supervisor for complex tasks',
        'output': '✓ Direct output for simple cases',
      },
      'supervisor': {
        'agent': '✓ Delegate subtask to agent',
        'output': '✓ Aggregated results → Output',
      },
    };

    const allowed = validConnections[sourceType] || [];
    const isValid = allowed.includes(targetType);

    if (isValid) {
      // Show helpful hint
      const hint = connectionHints[sourceType]?.[targetType];
      if (hint) {
        showToast(hint, 'success');
      }
    } else {
      // Show error with guidance
      const errorMessages: Record<string, string> = {
        'output': 'Output is terminal - nothing connects from it',
        'semanticModel': 'Semantic Model only connects to Agent',
        'snowflakeSource': 'Data Source → Semantic Model or Cortex only',
        'agent': 'Agent connects to Output, Cortex, Condition, or External API',
        'externalAgent': 'External API connects to Agent or Output',
      };
      
      const guidance = errorMessages[sourceType] || `Cannot connect ${sourceType} to ${targetType}`;
      showToast(guidance, 'error');
    }

    return isValid;
  }, [nodes]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const typeData = e.dataTransfer.getData('application/reactflow');
    if (!typeData || !reactFlowWrapper.current) return;

    const bounds = reactFlowWrapper.current.getBoundingClientRect();
    const position = { x: e.clientX - bounds.left - 110, y: e.clientY - bounds.top - 40 };

    // Parse type and subtype (e.g., "cortex:summarize")
    const [type, subtype] = typeData.split(':');

    let data: Record<string, unknown> = {};
    if (type === 'snowflakeSource') {
      const objectType = subtype || 'table';
      const labels: Record<string, string> = {
        'table': 'NEW_TABLE',
        'view': 'NEW_VIEW',
        'dynamic_table': 'NEW_DYN_TABLE',
        'stream': 'NEW_STREAM'
      };
      data = { 
        label: labels[objectType] || 'NEW_TABLE', 
        database: 'SNOWFLOW_DEV', 
        schema: 'DEMO', 
        objectType: objectType
      };
    } else if (type === 'agent') {
      data = { 
        label: 'New Agent', 
        type: 'cortex', 
        model: 'mistral-large2', 
        instructions: '',
        systemPrompt: '',
        temperature: 0.7,
        maxTokens: 4096,
        topP: 1.0,
        enableGuardrails: false,
        responseFormat: 'text',
        tools: {
          analyst: { 
            enabled: false, 
            semanticModelDatabase: '', 
            semanticModelSchema: '', 
            semanticModelStage: '', 
            semanticModelFile: '' 
          },
          search: {
            enabled: false,
            searchServiceName: '',
            database: '',
            schema: '',
            columns: [],
            limit: 10
          },
          mcp: {
            enabled: false,
            serverUrl: '',
            authToken: '',
            enabledTools: []
          },
          sqlExecutor: false,
          webSearch: false
        }
      };
    } else if (type === 'output') {
      data = { label: 'Output', outputType: 'display' };
    } else if (type === 'cortex') {
      const labels: Record<string, string> = {
        summarize: 'Summarize', sentiment: 'Sentiment', translate: 'Translate', complete: 'LLM Complete'
      };
      data = { label: labels[subtype] || 'Cortex', cortexFunction: subtype || 'complete', sourceColumn: '' };
    } else if (type === 'condition') {
      data = { label: 'Check', condition: 'value > 0' };
    } else if (type === 'externalAgent') {
      const preset = e.dataTransfer.getData('preset');
      if (preset === 'copilot') {
        data = { 
          label: 'Microsoft Copilot', 
          agentType: 'copilot',
          endpoint: 'https://graph.microsoft.com/v1.0/me/messages',
          method: 'POST',
          authType: 'oauth',
          provider: 'Microsoft',
          systemPrompt: 'You are Microsoft Copilot. Help with M365 tasks - emails, calendar, Teams, documents.'
        };
      } else if (preset === 'openai') {
        data = { 
          label: 'GPT-4 Agent', 
          agentType: 'openai',
          endpoint: 'https://api.openai.com/v1/chat/completions',
          method: 'POST',
          authType: 'bearer',
          provider: 'OpenAI',
          model: 'gpt-4-turbo',
          systemPrompt: 'You are a helpful AI assistant.'
        };
      } else if (preset === 'salesforce') {
        data = { 
          label: 'Einstein Agent', 
          agentType: 'salesforce',
          endpoint: 'https://api.salesforce.com/einstein/predictions',
          method: 'POST',
          authType: 'oauth',
          provider: 'Salesforce',
          systemPrompt: 'You are Salesforce Einstein. Provide CRM insights and predictions.'
        };
      } else if (preset === 'servicenow') {
        data = { 
          label: 'ServiceNow Agent', 
          agentType: 'servicenow',
          endpoint: 'https://instance.service-now.com/api/now/table/incident',
          method: 'POST',
          authType: 'bearer',
          provider: 'ServiceNow',
          systemPrompt: 'You are ServiceNow agent. Help with ITSM ticket creation and management.'
        };
      } else {
        data = { label: 'API Call', agentType: 'rest', endpoint: '', method: 'POST' };
      }
    } else if (type === 'semanticModel') {
      data = { label: 'My Semantic Model', database: 'SNOWFLOW_DEV', schema: 'DEMO', stage: '', yamlFile: '' };
    } else if (type === 'router') {
      data = { 
        label: 'Intent Router', 
        routingStrategy: 'intent',
        routes: [
          { name: 'Sales', condition: 'intent == "sales"' },
          { name: 'Support', condition: 'intent == "support"' },
          { name: 'General', condition: 'default' },
        ]
      };
    } else if (type === 'supervisor') {
      data = { 
        label: 'Orchestrator', 
        model: 'mistral-large2',
        delegationStrategy: 'adaptive',
        systemPrompt: 'You are a supervisor agent. Break down complex tasks and delegate to specialized agents.',
        aggregationMethod: 'merge'
      };
    } else if (type === 'fileInput') {
      const fileType = subtype || 'tmdl';
      const labels: Record<string, string> = { tmdl: 'Power BI TMDL', json: 'JSON File', yaml: 'YAML File' };
      data = { label: labels[fileType] || 'File Input', fileType };
    } else if (type === 'fileOutput') {
      const outputFormat = subtype || 'yaml';
      const labels: Record<string, string> = { yaml: 'Snowflake YAML', json: 'Interchange JSON', sql: 'SQL Script' };
      data = { label: labels[outputFormat] || 'File Output', outputFormat };
    } else if (type === 'schemaExtractor') {
      const sourceFormat = subtype || 'powerbi';
      const labels: Record<string, string> = { powerbi: 'Power BI Extractor', dbt: 'dbt Extractor', looker: 'Looker Extractor' };
      data = { label: labels[sourceFormat] || 'Schema Extractor', sourceFormat, model: 'mistral-large2' };
    } else if (type === 'schemaTransformer') {
      const targetFormat = subtype || 'snowflake';
      const labels: Record<string, string> = { snowflake: 'Snowflake Transformer', dbt: 'dbt Transformer' };
      data = { label: labels[targetFormat] || 'Schema Transformer', targetFormat, model: 'mistral-large2' };
    } else if (type === 'daxTranslator') {
      data = { 
        label: 'DAX Translator', 
        daxExpression: '', 
        sqlOutput: '',
        autoTranslate: true 
      };
    }

    addNode({ id: `node_${nodeId++}`, type, position, data });
  }, [addNode]);

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    // Position panel near the click, offset slightly to the right
    const x = Math.min(event.clientX + 20, window.innerWidth - 450);
    const y = Math.max(event.clientY - 50, 80);
    setPanelPosition({ x, y });
    setSelectedNode(node);
  }, [setSelectedNode]);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, [setSelectedNode]);

  const runWorkflow = async (prompt?: string) => {
    // Pre-run validation
    if (nodes.length === 0) {
      showToast('Add at least one node to run', 'error');
      return;
    }
    
    // Check for disconnected output nodes
    const outputNodes = nodes.filter(n => n.type === 'output');
    for (const outNode of outputNodes) {
      const hasInput = edges.some(e => e.target === outNode.id);
      if (!hasInput) {
        showToast(`Output "${outNode.data.label}" has no input`, 'error');
        return;
      }
    }

    // Warning: Data Source → Cortex without Semantic Model
    const cortexNodes = nodes.filter(n => n.type === 'cortex');
    const semanticNodes = nodes.filter(n => n.type === 'semanticModel');
    const dataNodes = nodes.filter(n => n.type === 'snowflakeSource');
    
    if (cortexNodes.length > 0 && semanticNodes.length === 0 && dataNodes.length > 0) {
      // Check if any data source connects directly to cortex
      const directDataToCortex = edges.some(e => {
        const sourceNode = nodes.find(n => n.id === e.source);
        const targetNode = nodes.find(n => n.id === e.target);
        return sourceNode?.type === 'snowflakeSource' && targetNode?.type === 'cortex';
      });
      
      if (directDataToCortex) {
        showToast('⚠️ Running without Semantic Model - LLM accuracy may be impacted', 'info');
      }
    }

    // Validate prompt - detect garbage inputs like shell commands
    if (prompt && prompt.trim()) {
      const p = prompt.trim();
      
      // Detect shell commands
      const shellPatterns = [
        /^(cd|ls|pwd|mkdir|rm|cp|mv|cat|echo|grep|find|chmod|sudo|apt|brew|npm|pip|python|node|uvicorn|pkill|kill)\s/i,
        /^\.?\/[a-zA-Z]/,  // Paths like /Users or ./venv
        /&&|\|\|/,  // Shell operators
        /--[a-z]+=/i,  // CLI flags
      ];
      
      for (const pattern of shellPatterns) {
        if (pattern.test(p)) {
          showToast('⚠️ That looks like a shell command, not a question. Please enter a natural language question about your data.', 'error');
          return;
        }
      }
      
      // Too short
      if (p.length < 5) {
        showToast('⚠️ Question is too short. Please provide more detail.', 'error');
        return;
      }
      
      // Add to history only if valid
      setPromptHistory(prev => [prompt, ...prev.slice(0, 9)]); // Keep last 10
    }

    setExecStatus('running');
    setExecResult(null);
    setActiveNodes(new Set());
    setCompletedNodes(new Set());
    setSimulatedNodes(new Set());
    setIsProductionMode(true); // Lock canvas during execution
    
    try {
      // Use fetch with streaming for real-time updates
      const response = await fetch('http://localhost:8000/run/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ nodes, edges, prompt: prompt || undefined })
      });
      
      if (!response.body) throw new Error('No response body');
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const eventData = JSON.parse(line.slice(6));
            console.log('[SSE]', eventData);
            
            if (eventData.type === 'node_executing') {
              const node = nodes.find(n => n.id === eventData.node_id);
              if (node) {
                console.log('[TRACE UI] 🔵 Highlighting node:', eventData.node_id);
                setExecutionPhase(node.data?.label || eventData.node_id);
                
                // STEP 1: Mark this node as ACTIVE (glowing/pulsing)
                setActiveNodes(new Set([eventData.node_id]));
                
                // STEP 2: Wait for visual effect (synced with backend's 500ms delay)
                await new Promise(resolve => setTimeout(resolve, 400));
                
                // STEP 3: Move to COMPLETED state (green checkmark)
                setActiveNodes(new Set()); // Clear active
                setCompletedNodes(prev => new Set([...prev, eventData.node_id]));
              }
            } else if (eventData.type === 'complete') {
              // Update fileOutput nodes with generated content using store
              const results = eventData.results || {};
              console.log('[COMPLETE] Results received:', Object.keys(results));
              console.log('[COMPLETE] generated_yaml:', results.generated_yaml ? `${results.generated_yaml.length} chars` : 'NONE');
              
              if (results.output_content || results.generated_yaml || results.response) {
                const content = results.output_content || results.generated_yaml || results.response;
                console.log('[COMPLETE] Updating output nodes with content:', content.length, 'chars');
                // Get current nodes from store (not the stale closure)
                const currentNodes = useFlowStore.getState().nodes;
                currentNodes.forEach(n => {
                  // Update both fileOutput AND output type nodes
                  if (n.type === 'fileOutput' || n.type === 'output') {
                    console.log('[COMPLETE] Updating node:', n.id, 'type:', n.type);
                    updateNodeData(n.id, { generatedContent: content });
                  }
                });
              } else {
                console.log('[COMPLETE] No content in results');
              }
              
              // Track simulated nodes for visual differentiation
              if (eventData.simulated_nodes && eventData.simulated_nodes.length > 0) {
                setSimulatedNodes(new Set(eventData.simulated_nodes));
                console.log('[SIMULATED] Nodes running in demo mode:', eventData.simulated_nodes);
              }
              
              setExecResult({
                status: 'completed',
                messages: eventData.messages,
                results: eventData.results,
                executed_nodes: eventData.executed_nodes,
                simulated_nodes: eventData.simulated_nodes
              });
              setExecStatus('success');
              setActiveNodes(new Set());
              setExecutionPhase('');
              showToast('Workflow completed!', 'success');
            } else if (eventData.type === 'error') {
              // Handle specific error types
              const errorMsg = eventData.error || 'Unknown error';
              const isAuthError = eventData.auth_error || errorMsg.includes('Authentication') || errorMsg.includes('expired');
              
              setExecStatus('error');
              setActiveNodes(new Set());
              setExecutionPhase('');
              
              if (isAuthError) {
                showToast('🔐 Snowflake Auth Error: Token expired. Restart backend to re-authenticate.', 'error');
              } else {
                showToast(`Workflow Error: ${errorMsg.substring(0, 100)}`, 'error');
              }
              return; // Exit gracefully instead of throwing
            }
          }
        }
      }
    } catch (err) {
      console.error(err);
      setExecStatus('error');
      setActiveNodes(new Set());
      setExecutionPhase('');
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      // Show more specific error message
      if (errMsg.includes('Authentication') || errMsg.includes('expired') || errMsg.includes('auth')) {
        showToast('🔐 Snowflake Auth Error: Token expired. Restart backend.', 'error');
      } else if (errMsg.includes('fetch') || errMsg.includes('network') || errMsg.includes('Failed')) {
        showToast('Failed to connect to backend', 'error');
      } else {
        showToast(`Error: ${errMsg.substring(0, 100)}`, 'error');
      }
    }
  };

  const saveWorkflow = async () => {
    try {
      if (saveAsTemplate) {
        // Save as template to Snowflake
        await axios.post('http://localhost:8000/templates', { 
          name: workflowName, 
          description: workflowDescription,
          category: templateCategory,
          complexity: templateComplexity,
          nodes, 
          edges 
        });
        showToast(`Template "${workflowName}" saved to Snowflake!`, 'success');
      } else {
        // Save as regular workflow
        await axios.post('http://localhost:8000/workflow/save', { name: workflowName, nodes, edges });
        showToast(`Workflow "${workflowName}" saved!`, 'success');
      }
      setShowSaveModal(false);
      setSaveAsTemplate(false);
      setWorkflowDescription('');
    } catch (err) {
      console.error(err);
      showToast('Failed to save', 'error');
    }
  };

  // Export workflow as JSON file
  const exportWorkflow = () => {
    const workflow = {
      name: workflowName || 'Untitled Workflow',
      version: '1.0',
      exportedAt: new Date().toISOString(),
      nodes: nodes.map(n => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: n.data,
      })),
      edges: edges.map(e => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
      })),
    };

    const blob = new Blob([JSON.stringify(workflow, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(workflowName || 'workflow').replace(/\s+/g, '_').toLowerCase()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast('Workflow exported!', 'success');
  };

  // Import workflow from JSON file
  const importWorkflow = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const workflow = JSON.parse(content);
        
        if (!workflow.nodes || !workflow.edges) {
          throw new Error('Invalid workflow format');
        }

        // Load the workflow
        setWorkflow(
          workflow.nodes,
          workflow.edges,
          workflow.name || 'Imported Workflow'
        );
        
        showToast(`Imported "${workflow.name || 'workflow'}"!`, 'success');
      } catch (err) {
        console.error('Import error:', err);
        showToast('Invalid workflow file', 'error');
      }
    };
    reader.readAsText(file);
    
    // Reset input so same file can be imported again
    event.target.value = '';
  };

  const loadWorkflowList = async () => {
    try {
      const res = await axios.get('http://localhost:8000/workflow/list');
      setSavedWorkflows(res.data.workflows);
      setShowLoadModal(true);
    } catch (err) {
      console.error(err);
      alert('Failed to load workflows');
    }
  };

  const loadWorkflow = async (filename: string) => {
    try {
      const res = await axios.get(`http://localhost:8000/workflow/load/${filename}`);
      setWorkflow(res.data.nodes, res.data.edges, res.data.name);
      setShowLoadModal(false);
    } catch (err) {
      console.error(err);
      alert('Failed to load workflow');
    }
  };
  
  const resetCanvas = () => {
    localStorage.clear(); // Clear ALL localStorage
    clearWorkflow();
    window.location.reload(); // Force full page reload
  };

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', fontFamily: 'Inter, -apple-system, sans-serif' }}>
      {/* Sidebar - Snowflake Style (Compact) */}
      <div style={{ 
        width: 'var(--sidebar-width, 240px)', 
        minWidth: 200,
        background: '#FFFFFF', 
        borderRight: '1px solid #E5E9F0',
        padding: 0,
        display: 'flex', 
        flexDirection: 'column' 
      }}>
        {/* Logo */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #E5E9F0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={20} color="#29B5E8" />
            <span style={{ color: '#1F2937', fontSize: 15, fontWeight: 600 }}>SnowFlow</span>
          </div>
        </div>

        {/* Workflow Name & Actions */}
        <div style={{ padding: '8px 12px', borderBottom: '1px solid #E5E9F0' }}>
          <input
            value={workflowName}
            onChange={(e) => setWorkflowName(e.target.value)}
          style={{
              width: '100%', 
              padding: '6px 8px', 
              border: '1px solid #E5E9F0', 
              borderRadius: 4, 
              fontSize: 12,
              fontWeight: 500,
              color: '#1F2937',
              marginBottom: 6,
              boxSizing: 'border-box'
            }}
          />
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => setShowSaveModal(true)} style={compactBtnStyle} title="Save">
              <Save size={12} />
            </button>
            <button onClick={loadWorkflowList} style={compactBtnStyle} title="Load">
              <FolderOpen size={12} />
            </button>
            <button onClick={resetCanvas} style={{...compactBtnStyle, borderColor: '#EF4444', color: '#EF4444'}} title="Clear Canvas & Reset">
              <X size={12} />
            </button>
            <button onClick={exportWorkflow} style={compactBtnStyle} title="Export as JSON">
              <Download size={12} />
            </button>
            <button onClick={() => fileInputRef.current?.click()} style={compactBtnStyle} title="Import from file">
              <Upload size={12} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.yaml,.yml"
              onChange={importWorkflow}
              style={{ display: 'none' }}
            />
            <button onClick={clearWorkflow} style={{ ...compactBtnStyle, color: '#EF4444' }} title="Clear">
              <X size={12} />
            </button>
            <div style={{ 
              marginLeft: 8, 
              padding: '4px 8px', 
              background: nodes.length > 0 ? '#10B981' : '#EF4444', 
              color: 'white', 
              borderRadius: 4, 
              fontSize: 10, 
              fontWeight: 600 
            }}>
              {nodes.length} NODES
            </div>
          </div>
        </div>

        {/* Sidebar Mode Tabs */}
        <div style={{ 
          display: 'flex', 
          borderBottom: '1px solid #E5E9F0',
          padding: '0 8px',
          background: '#F9FAFB'
        }}>
          <button
            onClick={() => setSidebarMode('components')}
            style={{
              flex: 1,
              padding: '10px 4px',
            border: 'none',
              background: 'none',
            cursor: 'pointer',
              fontSize: 10,
              fontWeight: 500,
              color: sidebarMode === 'components' ? '#29B5E8' : '#6B7280',
              borderBottom: sidebarMode === 'components' ? '2px solid #29B5E8' : '2px solid transparent',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
            }}
          >
            <Layers size={14} />
            Components
          </button>
          <button
            onClick={() => setSidebarMode('catalog')}
            style={{
              flex: 1,
              padding: '10px 4px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: 10,
              fontWeight: 500,
              color: sidebarMode === 'catalog' ? '#29B5E8' : '#6B7280',
              borderBottom: sidebarMode === 'catalog' ? '2px solid #29B5E8' : '2px solid transparent',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
            }}
          >
            <BookOpen size={14} />
            Catalog
          </button>
          <button
            onClick={() => setSidebarMode('templates')}
            style={{
              flex: 1,
              padding: '10px 4px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: 10,
              fontWeight: 500,
              color: sidebarMode === 'templates' ? '#29B5E8' : '#6B7280',
              borderBottom: sidebarMode === 'templates' ? '2px solid #29B5E8' : '2px solid transparent',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
            }}
          >
            <Zap size={14} />
            Templates
        </button>
      </div>

        {/* Sidebar Content based on mode */}
        {sidebarMode === 'catalog' && (
          <DataCatalog 
            onSelectSource={(source) => {
              // Add node to canvas
              const newNode = {
                id: `node-${Date.now()}`,
                type: 'snowflakeSource',
                position: { x: 150, y: 150 + Math.random() * 100 },
                data: {
                  label: source.name,
                  database: source.database,
                  schema: source.schema,
                  objectType: source.type,
                },
              };
              addNode(newNode);
              showToast(`Added ${source.name} to canvas`, 'success');
            }}
          />
        )}

        {sidebarMode === 'templates' && (
          <Templates 
            onSelectTemplate={(templateId, nodes, edges) => {
              console.log('[TEMPLATE LOAD]', templateId, 'Nodes:', nodes?.length || 'from config');
              if (nodes && edges) {
                // Template from Snowflake with embedded nodes/edges
                console.log('[NODES FROM SF]', nodes);
                setWorkflow(nodes, edges, templateId.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));
                showToast(`Template loaded from Snowflake!`, 'success');
              } else {
                // Fallback to hardcoded config
                const config = templateConfigs[templateId];
                console.log('[NODES FROM CONFIG]', config?.nodes);
                if (config) {
                  // Deep clone to avoid reference issues
                  const clonedNodes = JSON.parse(JSON.stringify(config.nodes));
                  const clonedEdges = JSON.parse(JSON.stringify(config.edges));
                  setWorkflow(clonedNodes, clonedEdges, templateId.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));
                  showToast(`Template "${templateId}" loaded!`, 'success');
                  
                  // Force fitView after a short delay
                  setTimeout(() => {
                    const fitViewBtn = document.querySelector('.react-flow__controls-fitview') as HTMLButtonElement;
                    if (fitViewBtn) fitViewBtn.click();
                  }, 100);
                }
              }
              setSidebarMode('components');
            }}
          />
        )}

        {sidebarMode === 'components' && (
          <>
            {/* Node Palette - Compact, Collapsible, Snowflake-style */}
            <div style={{ padding: '8px 12px', flex: 1, overflowY: 'auto', fontSize: 12 }}>
              
              {/* Component Search */}
              <div style={{ marginBottom: 10 }}>
                <input
                  type="text"
                  placeholder="🔍 Search components..."
                  value={componentSearch}
                  onChange={(e) => setComponentSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    border: '1px solid #E5E9F0',
                    borderRadius: 6,
                    fontSize: 11,
                    color: '#4B5563',
                    background: '#F9FAFB',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
              </div>
              
              {/* Section: Data Sources */}
          {sectionHasMatch('data') && (
            <>
              <div 
                onClick={() => setSections(s => ({ ...s, data: !s.data }))}
                style={sectionHeaderStyle}
              >
                <span style={{ color: '#29B5E8' }}>●</span> Data Sources
                <span style={{ marginLeft: 'auto', color: '#9CA3AF' }}>{sections.data ? '−' : '+'}</span>
              </div>
              {sections.data && (
                <div style={{ marginBottom: 8 }}>
                  {matchesSearch('Table') && (
                    <div draggable onDragStart={(e) => e.dataTransfer.setData('application/reactflow', 'snowflakeSource:table')} style={compactItemStyle}>
                      <Database size={14} color="#29B5E8" />
                      <span>Table</span>
                    </div>
                  )}
                  {matchesSearch('View') && (
                    <div draggable onDragStart={(e) => e.dataTransfer.setData('application/reactflow', 'snowflakeSource:view')} style={compactItemStyle}>
                      <Database size={14} color="#0EA5E9" />
                      <span>View</span>
                    </div>
                  )}
                  {matchesSearch('Dynamic') && (
                    <div draggable onDragStart={(e) => e.dataTransfer.setData('application/reactflow', 'snowflakeSource:dynamic_table')} style={compactItemStyle}>
                      <Database size={14} color="#8B5CF6" />
                      <span>Dynamic Table</span>
                    </div>
                  )}
                  {matchesSearch('Stream') && (
                    <div draggable onDragStart={(e) => e.dataTransfer.setData('application/reactflow', 'snowflakeSource:stream')} style={compactItemStyle}>
                      <Database size={14} color="#10B981" />
                      <span>Stream</span>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Section: Semantic Layer */}
          {sectionHasMatch('semantic') && (
            <>
              <div 
                onClick={() => setSections(s => ({ ...s, semantic: !s.semantic }))}
                style={sectionHeaderStyle}
              >
                <span style={{ color: '#6366F1' }}>●</span> Semantic Layer
                <span style={{ marginLeft: 'auto', color: '#9CA3AF' }}>{sections.semantic ? '−' : '+'}</span>
              </div>
              {sections.semantic && (
                <div style={{ marginBottom: 8 }}>
                  <div draggable onDragStart={(e) => e.dataTransfer.setData('application/reactflow', 'semanticModel')} style={compactItemStyle}>
                    <Layers size={14} color="#6366F1" />
                    <span>Semantic Model</span>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Section: Cortex Agent */}
          {sectionHasMatch('agent') && (
            <>
              <div 
                onClick={() => setSections(s => ({ ...s, agent: !s.agent }))}
                style={sectionHeaderStyle}
              >
                <span style={{ color: '#8B5CF6' }}>●</span> Cortex Agent
                <span style={{ marginLeft: 'auto', color: '#9CA3AF' }}>{sections.agent ? '−' : '+'}</span>
              </div>
              {sections.agent && (
                <div style={{ marginBottom: 8 }}>
                  <div draggable onDragStart={(e) => e.dataTransfer.setData('application/reactflow', 'agent')} style={compactItemStyle}>
                    <Brain size={14} color="#8B5CF6" />
                    <span>Cortex Agent</span>
                  </div>
                  {/* Tools breakdown with data type hints */}
                  <div style={{ fontSize: 9, color: '#6B7280', padding: '4px 8px 2px 8px', background: '#F9FAFB', borderRadius: 4, margin: '4px 8px 6px 8px' }}>
                    <div style={{ fontWeight: 600, marginBottom: 2, color: '#4B5563' }}>Built-in Tools:</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <span>📊 <strong>Analyst</strong> - structured data (SQL)</span>
                      <span>🔍 <strong>Search</strong> - unstructured (vectors)</span>
                      <span>🔌 <strong>MCP</strong> - external tools</span>
                      <span>⚡ <strong>SQL</strong> - direct queries</span>
                    </div>
                    {customTools.length > 0 && (
                      <div style={{ marginTop: 4, paddingTop: 4, borderTop: '1px solid #E5E9F0' }}>
                        <div style={{ fontWeight: 600, marginBottom: 2, color: '#8B5CF6' }}>Custom Tools ({customTools.length}):</div>
                        {customTools.map(t => (
                          <span key={t.id}>🔧 <strong>{t.name}</strong></span>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={() => setShowToolCreator(true)}
                      style={{
                        marginTop: 6,
                        padding: '4px 8px',
                        border: '1px dashed #8B5CF6',
                        borderRadius: 4,
        background: 'white', 
                        color: '#8B5CF6',
                        fontSize: 9,
                        cursor: 'pointer',
                        width: '100%',
                      }}
                    >
                      + Create Custom Tool
                    </button>
                  </div>
                  {/* Multi-Agent Orchestration */}
                  <div style={{ fontSize: 9, fontWeight: 600, color: '#A855F7', marginTop: 8, marginBottom: 4, padding: '0 8px' }}>
                    ORCHESTRATION
                  </div>
                  <div draggable onDragStart={(e) => e.dataTransfer.setData('application/reactflow', 'router')} style={compactItemStyle}>
                    <GitBranch size={14} color="#A855F7" />
                    <span>Router</span>
                    <span style={{ fontSize: 8, color: '#9CA3AF', marginLeft: 'auto' }}>Intent-based</span>
                  </div>
                  <div draggable onDragStart={(e) => e.dataTransfer.setData('application/reactflow', 'supervisor')} style={compactItemStyle}>
                    <Sparkles size={14} color="#F59E0B" />
                    <span>Supervisor</span>
                    <span style={{ fontSize: 8, color: '#9CA3AF', marginLeft: 'auto' }}>Delegates</span>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Section: External Agents */}
          {sectionHasMatch('external') && (
            <>
              <div 
                onClick={() => setSections(s => ({ ...s, external: !s.external }))}
                style={sectionHeaderStyle}
              >
                <span style={{ color: '#0078D4' }}>●</span> External Agents
                <span style={{ marginLeft: 'auto', color: '#9CA3AF' }}>{sections.external ? '−' : '+'}</span>
              </div>
              {sections.external && (
                <div style={{ marginBottom: 8 }}>
                  <div draggable onDragStart={(e) => e.dataTransfer.setData('application/reactflow', 'externalAgent')} style={compactItemStyle}>
                    <Globe size={14} color="#EF4444" />
                    <span>Custom API</span>
                  </div>
                  <div 
                    draggable 
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/reactflow', 'externalAgent');
                      e.dataTransfer.setData('preset', 'copilot');
                    }} 
                    style={compactItemStyle}
                  >
                    <Sparkles size={14} color="#0078D4" />
                    <span>Microsoft Copilot</span>
                    <span style={{ fontSize: 8, color: '#9CA3AF', marginLeft: 'auto' }}>M365</span>
                  </div>
                  <div 
                    draggable 
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/reactflow', 'externalAgent');
                      e.dataTransfer.setData('preset', 'openai');
                    }} 
                    style={compactItemStyle}
                  >
                    <Bot size={14} color="#10A37F" />
                    <span>OpenAI GPT</span>
                    <span style={{ fontSize: 8, color: '#9CA3AF', marginLeft: 'auto' }}>GPT-4</span>
                  </div>
                  <div 
                    draggable 
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/reactflow', 'externalAgent');
                      e.dataTransfer.setData('preset', 'salesforce');
                    }} 
                    style={compactItemStyle}
                  >
                    <Cloud size={14} color="#00A1E0" />
                    <span>Salesforce Einstein</span>
                  </div>
                  <div 
                    draggable 
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/reactflow', 'externalAgent');
                      e.dataTransfer.setData('preset', 'servicenow');
                    }} 
                    style={compactItemStyle}
                  >
                    <Building2 size={14} color="#81B5A1" />
                    <span>ServiceNow</span>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Section: Schema Migration */}
          {sectionHasMatch('migration') && (
            <>
              <div 
                onClick={() => setSections(s => ({ ...s, migration: !s.migration }))}
                style={sectionHeaderStyle}
              >
                <span style={{ color: '#F59E0B' }}>●</span> Schema Migration
                <span style={{ marginLeft: 'auto', color: '#9CA3AF' }}>{sections.migration ? '−' : '+'}</span>
              </div>
              {sections.migration && (
                <div style={{ marginBottom: 8 }}>
                  <div 
                    draggable 
                    onDragStart={(e) => e.dataTransfer.setData('application/reactflow', 'fileInput:tmdl')} 
                    style={compactItemStyle}
                  >
                    <FileUp size={14} color="#0078D4" />
                    <span>Power BI Input</span>
                    <span style={{ fontSize: 8, color: '#9CA3AF', marginLeft: 'auto' }}>TMDL</span>
                  </div>
                  <div 
                    draggable 
                    onDragStart={(e) => e.dataTransfer.setData('application/reactflow', 'schemaExtractor:powerbi')} 
                    style={compactItemStyle}
                  >
                    <ArrowRightLeft size={14} color="#0078D4" />
                    <span>PBI → JSON</span>
                    <span style={{ fontSize: 8, color: '#9CA3AF', marginLeft: 'auto' }}>Extract</span>
                  </div>
                  <div 
                    draggable 
                    onDragStart={(e) => e.dataTransfer.setData('application/reactflow', 'schemaTransformer:snowflake')} 
                    style={compactItemStyle}
                  >
                    <ArrowRightLeft size={14} color="#29B5E8" />
                    <span>JSON → Snowflake</span>
                    <span style={{ fontSize: 8, color: '#9CA3AF', marginLeft: 'auto' }}>Transform</span>
                  </div>
                  <div 
                    draggable 
                    onDragStart={(e) => e.dataTransfer.setData('application/reactflow', 'fileOutput:yaml')} 
                    style={compactItemStyle}
                  >
                    <FileDown size={14} color="#10B981" />
                    <span>YAML Output</span>
                    <span style={{ fontSize: 8, color: '#9CA3AF', marginLeft: 'auto' }}>Download</span>
                  </div>
                  <div 
                    draggable 
                    onDragStart={(e) => e.dataTransfer.setData('application/reactflow', 'daxTranslator')} 
                    style={compactItemStyle}
                  >
                    <Sparkles size={14} color="#667eea" />
                    <span>DAX Translator</span>
                    <span style={{ fontSize: 8, color: '#9CA3AF', marginLeft: 'auto' }}>DAX→SQL</span>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Section: Output */}
          {sectionHasMatch('output') && (
            <>
              <div 
                onClick={() => setSections(s => ({ ...s, output: !s.output }))}
                style={sectionHeaderStyle}
              >
                <span style={{ color: '#10B981' }}>●</span> Output
                <span style={{ marginLeft: 'auto', color: '#9CA3AF' }}>{sections.output ? '−' : '+'}</span>
              </div>
              {sections.output && (
                <div style={{ marginBottom: 8 }}>
                  <div draggable onDragStart={(e) => e.dataTransfer.setData('application/reactflow', 'output')} style={compactItemStyle}>
                    <FileOutput size={14} color="#10B981" />
                    <span>Display Results</span>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Section: Utilities */}
          {sectionHasMatch('utils') && (
            <>
              <div 
                onClick={() => setSections(s => ({ ...s, utils: !s.utils }))}
                style={sectionHeaderStyle}
              >
                <span style={{ color: '#6B7280' }}>●</span> Utilities
                <span style={{ marginLeft: 'auto', color: '#9CA3AF' }}>{sections.utils ? '−' : '+'}</span>
              </div>
              {sections.utils && (
                <div style={{ marginBottom: 8 }}>
                  <div draggable onDragStart={(e) => e.dataTransfer.setData('application/reactflow', 'cortex:summarize')} style={compactItemStyle}>
                    <FileText size={14} color="#3B82F6" />
                    <span>Summarize</span>
                  </div>
                  <div draggable onDragStart={(e) => e.dataTransfer.setData('application/reactflow', 'cortex:sentiment')} style={compactItemStyle}>
                    <Heart size={14} color="#EC4899" />
                    <span>Sentiment</span>
                  </div>
                  <div draggable onDragStart={(e) => e.dataTransfer.setData('application/reactflow', 'cortex:translate')} style={compactItemStyle}>
                    <Languages size={14} color="#14B8A6" />
                    <span>Translate</span>
                  </div>
                  <div draggable onDragStart={(e) => e.dataTransfer.setData('application/reactflow', 'condition')} style={compactItemStyle}>
                    <GitBranch size={14} color="#F59E0B" />
                    <span>Condition</span>
                  </div>
                </div>
              )}
            </>
          )}
            </div>
          </>
        )}

        {/* Prompt Input & Run Button */}
        <div style={{ padding: '8px 12px' }}>
          {/* Prompt Input */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ 
              position: 'relative',
        display: 'flex',
        alignItems: 'center',
              gap: 4
            }}>
              <input
                type="text"
                value={userPrompt}
                onChange={(e) => setUserPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && userPrompt.trim() && execStatus !== 'running') {
                    runWorkflow(userPrompt);
                  }
                }}
                placeholder="Ask a question to trigger the flow..."
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  border: '1px solid #E5E7EB',
                  borderRadius: 6,
                  fontSize: 12,
                  fontFamily: 'Inter, -apple-system, sans-serif',
                  background: 'white',
                  color: '#1F2937',
                }}
              />
              {userPrompt && (
        <button 
                  onClick={() => setUserPrompt('')}
          style={{
                    position: 'absolute',
                    right: 8,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#9CA3AF',
                    padding: 2,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <X size={12} />
                </button>
              )}
            </div>
            {promptHistory.length > 0 && (
              <div style={{ marginTop: 4 }}>
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      setUserPrompt(e.target.value);
                    }
                  }}
                  value=""
                  style={{
                    width: '100%',
                    padding: '4px 8px',
                    fontSize: 10,
                    color: '#6B7280',
                    border: '1px solid #E5E7EB',
                    borderRadius: 4,
                    background: '#F9FAFB',
                    cursor: 'pointer',
                  }}
                >
                  <option value="">Recent prompts...</option>
                  {promptHistory.map((p, i) => (
                    <option key={i} value={p}>{p.length > 50 ? p.slice(0, 50) + '...' : p}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Backend Connection Status */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 6, 
            padding: '6px 10px', 
            background: backendConnected === false ? '#FEF2F2' : backendConnected === true ? '#F0FDF4' : '#F9FAFB',
            borderRadius: 6,
            marginBottom: 8,
            border: `1px solid ${backendConnected === false ? '#FECACA' : backendConnected === true ? '#BBF7D0' : '#E5E7EB'}`,
          }}>
            <div style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: backendConnected === null ? '#9CA3AF' : backendConnected ? '#22C55E' : '#EF4444',
              boxShadow: backendConnected === true ? '0 0 6px #22C55E' : backendConnected === false ? '0 0 6px #EF4444' : 'none',
              animation: backendConnected === null ? 'pulse 1.5s infinite' : 'none',
            }} />
            <span style={{ 
              fontSize: 10, 
              fontWeight: 500, 
              color: backendConnected === false ? '#DC2626' : backendConnected === true ? '#16A34A' : '#6B7280',
            }}>
              {backendConnected === null ? 'Checking...' : backendConnected ? 'Backend Connected' : 'Backend Disconnected'}
            </span>
          </div>

          {/* Run Buttons */}
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => runWorkflow(userPrompt || undefined)}
              disabled={execStatus === 'running' || backendConnected === false}
              style={{
                flex: 1,
                background: execStatus === 'running' ? '#9CA3AF' : backendConnected === false ? '#FCA5A5' : '#29B5E8',
                color: 'white',
                border: 'none',
                padding: '10px 12px',
                borderRadius: 6,
                cursor: execStatus === 'running' || backendConnected === false ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                fontFamily: 'Inter, -apple-system, sans-serif',
                opacity: backendConnected === false ? 0.7 : 1,
              }}
            >
              {execStatus === 'running' ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
              {execStatus === 'running' ? 'Running...' : userPrompt.trim() ? 'Run with Prompt' : 'Run'}
            </button>
          </div>

          {/* Preview Toggle */}
          <button
            onClick={() => setShowPreview(!showPreview)}
            style={{
              width: '100%',
              marginTop: 6,
              background: showPreview ? '#8B5CF6' : '#F3F4F6',
              color: showPreview ? 'white' : '#4B5563',
              border: 'none',
              padding: '8px 12px',
              borderRadius: 6,
            cursor: 'pointer',
              fontWeight: 500,
              fontSize: 11,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              fontFamily: 'Inter, -apple-system, sans-serif',
            }}
          >
            <MessageSquare size={12} />
            {showPreview ? 'Hide Preview' : 'Test Agent'}
        </button>

          {/* Admin Dashboard Button */}
          <button
            onClick={() => setShowAdminDashboard(true)}
            style={{
              width: '100%',
              marginTop: 6,
              background: '#1E3A5F',
              color: 'white',
              border: 'none',
              padding: '8px 12px',
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: 11,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              fontFamily: 'Inter, -apple-system, sans-serif',
            }}
          >
            <Shield size={12} />
            Control Tower
          </button>

          {/* Execution Status */}
          {execResult && (
      <div style={{ 
              marginTop: 8, 
              padding: 8, 
              background: execStatus === 'success' ? '#D1FAE5' : '#FEE2E2', 
              borderRadius: 6,
              fontSize: 10
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {execStatus === 'success' ? <CheckCircle size={12} color="#10B981" /> : <AlertCircle size={12} color="#EF4444" />}
                <span style={{ fontWeight: 600, color: execStatus === 'success' ? '#065F46' : '#991B1B' }}>
                  {execResult.status}
                </span>
              </div>
              {execResult.error && <div style={{ color: '#991B1B', marginTop: 4 }}>{execResult.error}</div>}
            </div>
          )}
        </div>
      </div>

      {/* Save Modal */}
      {showSaveModal && (
        <div style={modalOverlayStyle}>
          <div style={modalStyle}>
            <h3 style={{ margin: '0 0 16px 0', color: '#1F2937' }}>Save Workflow</h3>
            <input
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              placeholder="Workflow name"
              style={{ ...inputStyle, marginBottom: 12 }}
            />
            <textarea
              value={workflowDescription}
              onChange={(e) => setWorkflowDescription(e.target.value)}
              placeholder="Description (optional)"
              style={{ ...inputStyle, marginBottom: 12, minHeight: 60, resize: 'vertical' }}
            />
            
            {/* Save as Template Option */}
      <div style={{ 
              background: '#F9FAFB', 
              border: '1px solid #E5E9F0', 
            borderRadius: 8,
              padding: 12, 
              marginBottom: 16 
            }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={saveAsTemplate}
                  onChange={(e) => setSaveAsTemplate(e.target.checked)}
                />
                <span style={{ fontWeight: 500, fontSize: 13 }}>Save as Template</span>
              </label>
              {saveAsTemplate && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 8 }}>
                    Templates are reusable patterns that can be shared with others.
                  </div>
                  <select
                    value={templateCategory}
                    onChange={(e) => setTemplateCategory(e.target.value)}
                    style={{ ...inputStyle, marginBottom: 8 }}
                  >
                    <option value="analytics">Analytics</option>
                    <option value="customer">Customer</option>
                    <option value="operations">Operations</option>
                    <option value="custom">Custom</option>
                  </select>
                  <select
                    value={templateComplexity}
                    onChange={(e) => setTemplateComplexity(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="simple">Simple</option>
                    <option value="medium">Medium</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>
              )}
            </div>
            
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowSaveModal(false)} style={{ ...actionBtnStyle, padding: '10px 20px' }}>Cancel</button>
              <button onClick={saveWorkflow} style={{ ...actionBtnStyle, padding: '10px 20px', background: '#29B5E8', color: 'white' }}>
                {saveAsTemplate ? 'Save Template' : 'Save Workflow'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Load Modal */}
      {showLoadModal && (
        <div style={modalOverlayStyle}>
          <div style={{ ...modalStyle, minWidth: 400 }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#1F2937' }}>Load Workflow</h3>
            {savedWorkflows.length === 0 ? (
              <p style={{ color: '#6B7280' }}>No saved workflows found.</p>
            ) : (
              <div style={{ maxHeight: 350, overflowY: 'auto' }}>
                {savedWorkflows.map((wf: any) => (
                  <div
                    key={wf.filename}
                    style={{ 
                      padding: 14, 
                      border: '1px solid #E5E9F0', 
                      borderRadius: 8, 
                      marginBottom: 8,
        display: 'flex',
        alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <div 
                      onClick={() => loadWorkflow(wf.filename)}
                      style={{ flex: 1, cursor: 'pointer' }}
                    >
                      <div style={{ fontWeight: 600, color: '#1F2937', marginBottom: 4 }}>{wf.name}</div>
                      <div style={{ fontSize: 11, color: '#6B7280', display: 'flex', gap: 12 }}>
                        <span>{wf.node_count} nodes</span>
                        {wf.created_at && (
                          <span>{new Date(wf.created_at).toLocaleDateString()} {new Date(wf.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (confirm(`Delete "${wf.name}"?`)) {
                          try {
                            await axios.delete(`http://localhost:8000/workflow/${wf.filename}`);
                            loadWorkflowList();
                            showToast('Workflow deleted', 'info');
                          } catch (err) {
                            showToast('Failed to delete', 'error');
                          }
                        }
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#EF4444',
            cursor: 'pointer',
                        padding: 6,
                        borderRadius: 4,
                        fontSize: 11,
          }}
        >
                      Delete
        </button>
      </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => setShowLoadModal(false)} style={{ ...actionBtnStyle, padding: '10px 20px' }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Canvas */}
      <div 
        ref={reactFlowWrapper} 
        style={{ flex: 1, position: 'relative' }} 
        onDragOver={isProductionMode ? undefined : onDragOver} 
        onDrop={isProductionMode ? undefined : onDrop}
      >
        {/* Guided Lanes Background - Snowflake Intelligence Architecture (4 Lanes) */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, display: 'flex' }}>
          {/* Lane 1: Data Sources */}
          <div style={{ flex: 1, borderRight: '2px dashed #E5E9F0', display: 'flex', flexDirection: 'column', padding: 16 }}>
      <div style={{ 
              background: 'linear-gradient(180deg, rgba(41,181,232,0.08) 0%, transparent 100%)',
              borderRadius: 10,
              padding: '12px 14px',
            }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#29B5E8', textTransform: 'uppercase', letterSpacing: 1 }}>
                Step 1
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1E3A5F', marginTop: 2 }}>Data Sources</div>
              <div style={{ fontSize: 9, color: '#9CA3AF', marginTop: 2 }}>
                Tables, Views
              </div>
            </div>
          </div>
          
          {/* Lane 2: Semantic Model */}
          <div style={{ flex: 1, borderRight: '2px dashed #E5E9F0', display: 'flex', flexDirection: 'column', padding: 16 }}>
        <div style={{
              background: 'linear-gradient(180deg, rgba(99,102,241,0.08) 0%, transparent 100%)',
              borderRadius: 10,
              padding: '12px 14px',
            }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#6366F1', textTransform: 'uppercase', letterSpacing: 1 }}>
                Step 2
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1E3A5F', marginTop: 2 }}>Semantic Model</div>
              <div style={{ fontSize: 9, color: '#9CA3AF', marginTop: 2 }}>
                Business context (YAML)
              </div>
            </div>
          </div>
          
          {/* Lane 3: Cortex Agent (includes tools) */}
          <div style={{ flex: 1.5, borderRight: '2px dashed #E5E9F0', display: 'flex', flexDirection: 'column', padding: 16 }}>
            <div style={{ 
              background: 'linear-gradient(180deg, rgba(139,92,246,0.08) 0%, transparent 100%)',
              borderRadius: 10,
              padding: '12px 14px',
            }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#8B5CF6', textTransform: 'uppercase', letterSpacing: 1 }}>
                Step 3
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1E3A5F', marginTop: 2 }}>Cortex Agent</div>
              <div style={{ fontSize: 9, color: '#9CA3AF', marginTop: 2 }}>
                AI orchestrator
              </div>
              <div style={{ fontSize: 8, color: '#8B5CF6', marginTop: 4, background: 'rgba(139,92,246,0.1)', padding: '3px 6px', borderRadius: 4, display: 'inline-block' }}>
                Analyst · Search · MCP · SQL
              </div>
            </div>
          </div>
          
          {/* Lane 4: Output */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 16 }}>
            <div style={{ 
              background: 'linear-gradient(180deg, rgba(16,185,129,0.08) 0%, transparent 100%)',
              borderRadius: 10,
              padding: '12px 14px',
            }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#10B981', textTransform: 'uppercase', letterSpacing: 1 }}>
                Step 4
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1E3A5F', marginTop: 2 }}>Output</div>
              <div style={{ fontSize: 9, color: '#9CA3AF', marginTop: 2 }}>
                Results & actions
              </div>
            </div>
          </div>
        </div>

        <ReactFlow
          nodes={nodes.map(n => {
            const isActive = activeNodes.has(n.id);
            const isCompleted = completedNodes.has(n.id);
            const isSimulated = simulatedNodes.has(n.id);
            
            let className = '';
            if (isActive) className = 'active-node';
            else if (isSimulated) className = 'simulated-node';
            else if (isCompleted) className = 'completed-node';
            
            return {
              ...n,
              className,
              style: {
                ...n.style,
                opacity: isProductionMode && !isActive && !isCompleted && !isSimulated ? 0.4 : 1,
              }
            };
          })}
          edges={edges.map(e => {
            const isActiveEdge = activeNodes.has(e.target);  // Edge leading to active node
            const isCompletedEdge = completedNodes.has(e.source) && completedNodes.has(e.target);
            
            return {
              ...e,
              animated: !isCompletedEdge,  // Animated dashes except for completed edges
              className: isActiveEdge ? 'active-edge' : isCompletedEdge ? 'completed-edge' : 'idle-edge',
              style: {
                stroke: isActiveEdge ? '#F59E0B' : isCompletedEdge ? '#10B981' : '#29B5E8',
                strokeWidth: isActiveEdge ? 3 : 2,
              }
            };
          })}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          isValidConnection={isValidConnection}
          defaultEdgeOptions={{
            type: 'default',
            style: { stroke: '#29B5E8', strokeWidth: 2 },
            animated: true,
          }}
          fitView
          style={{ background: 'transparent' }}
        >
          <Background color="#E5E9F0" gap={20} />
          <Controls style={{ background: 'white', borderRadius: 8, border: '1px solid #E5E9F0' }} />
          
          {/* Real-time Execution Status - Top Center */}
          {execStatus === 'running' && executionPhase && (
            <div style={{
              position: 'absolute',
              top: 20,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 100,
              background: 'linear-gradient(135deg, #1E3A5F 0%, #0D1B2A 100%)',
              color: 'white',
              padding: '12px 24px',
              borderRadius: 30,
              boxShadow: '0 8px 32px rgba(0,0,0,0.3), 0 0 20px rgba(41, 181, 232, 0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              fontFamily: 'Inter, -apple-system, sans-serif',
              animation: 'pulse 2s ease-in-out infinite',
            }}>
              <div style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: '#29B5E8',
                boxShadow: '0 0 12px rgba(41, 181, 232, 0.8)',
                animation: 'pulse 1s ease-in-out infinite',
              }} />
              <span style={{ fontSize: 13, fontWeight: 500, opacity: 0.7 }}>Processing:</span>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{executionPhase}</span>
              <span style={{ fontSize: 12, opacity: 0.6 }}>
                ({completedNodes.size}/{nodes.length})
              </span>
            </div>
          )}
          
          {/* Floating Mode Toggle - Bottom Center */}
          <div style={{
            position: 'absolute',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10,
            display: 'flex',
            gap: 10,
          }}>
            {isProductionMode ? (
              <>
                <div style={{
                  background: '#10B981',
                  color: 'white',
                  padding: '14px 24px',
                  borderRadius: 28,
                  fontWeight: 600,
                  fontSize: 14,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  fontFamily: 'Inter, -apple-system, sans-serif',
                }}>
                  <span style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
          background: 'white',
                  }} />
                  Live Mode
                </div>
                <button
                  onClick={() => setIsProductionMode(false)}
                  style={{
                    background: 'white',
                    color: '#4B5563',
                    border: '1px solid #E5E9F0',
                    padding: '14px 20px',
                    borderRadius: 28,
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: 14,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    fontFamily: 'Inter, -apple-system, sans-serif',
                  }}
                >
                  ✏️ Edit
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsProductionMode(true)}
                style={{
                  background: 'white',
                  color: '#4B5563',
                  border: '1px solid #E5E9F0',
                  padding: '14px 24px',
                  borderRadius: 28,
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 14,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  fontFamily: 'Inter, -apple-system, sans-serif',
                  transition: 'all 0.2s ease',
                }}
              >
                <span style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: '#F59E0B',
                  animation: 'pulse 1.5s infinite',
                }} />
                Build Mode
              </button>
            )}
          </div>
        </ReactFlow>

        {/* Toast Notification */}
        {toast && (
      <div style={{ 
            position: 'absolute',
            bottom: 20,
            right: 20,
            padding: '12px 16px',
            borderRadius: 8,
            background: toast.type === 'error' ? '#FEE2E2' : toast.type === 'success' ? '#D1FAE5' : '#E0F2FE',
            color: toast.type === 'error' ? '#991B1B' : toast.type === 'success' ? '#065F46' : '#0369A1',
            fontSize: 12,
            fontWeight: 500,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        display: 'flex',
        alignItems: 'center',
            gap: 8,
            zIndex: 1000,
            maxWidth: 300,
          }}>
            {toast.type === 'error' ? <AlertCircle size={14} /> : toast.type === 'success' ? <CheckCircle size={14} /> : <Sparkles size={14} />}
            {toast.message}
        </div>
        )}
      </div>

      {/* Floating Node Detail Panel - positioned near clicked node, draggable */}
      {selectedNode && (
        <DraggablePanel 
          initialPosition={panelPosition}
          onClose={() => setSelectedNode(null)}
        >
          <NodeDetailPanel customTools={customTools} isReadOnly={isProductionMode} />
        </DraggablePanel>
      )}

      {/* Permanent Results Panel - always visible, collapsible */}
      <div style={{
        width: resultsPanelCollapsed ? 48 : 'var(--panel-width, 400px)',
        minWidth: resultsPanelCollapsed ? 48 : 320,
        background: '#FFFFFF',
        borderLeft: '1px solid #E5E9F0',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'Inter, -apple-system, sans-serif',
        transition: 'width 0.2s ease, min-width 0.2s ease',
        position: 'relative',
      }}>
        {/* Collapse/Expand Toggle */}
        <button
          onClick={() => setResultsPanelCollapsed(!resultsPanelCollapsed)}
          style={{
            position: 'absolute',
            left: -12,
            top: 20,
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: '#1E293B',
            border: '2px solid #E5E9F0',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
          }}
          title={resultsPanelCollapsed ? 'Expand Results' : 'Collapse Results'}
        >
          {resultsPanelCollapsed ? (
            <ChevronLeft size={14} color="white" />
          ) : (
            <ChevronRight size={14} color="white" />
          )}
        </button>

        {/* Collapsed State - just icon */}
        {resultsPanelCollapsed ? (
          <div style={{ 
            padding: 12, 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center',
            gap: 8,
          }}>
            <div style={{ 
              width: 32, 
              height: 32, 
              borderRadius: 8, 
              background: execResult ? '#10B98120' : '#F3F4F6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {execResult ? (
                <CheckCircle size={18} color="#10B981" />
              ) : (
                <FileOutput size={18} color="#9CA3AF" />
              )}
            </div>
            <span style={{ 
              writingMode: 'vertical-rl', 
              textOrientation: 'mixed',
              fontSize: 11,
              fontWeight: 500,
              color: '#6B7280',
              letterSpacing: 0.5,
            }}>
              Results
            </span>
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{ 
              padding: '16px 20px', 
              borderBottom: '1px solid #E5E9F0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {execResult ? (
                  <CheckCircle size={20} color="#10B981" />
                ) : (
                  <FileOutput size={20} color="#9CA3AF" />
                )}
                <span style={{ fontWeight: 600, color: '#1F2937' }}>
                  {execResult ? 'Execution Results' : 'Results'}
                </span>
              </div>
              {execResult && (
                <button 
                  onClick={() => setExecResult(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                  title="Clear results"
                >
                  <X size={18} color="#6B7280" />
                </button>
              )}
            </div>
          <div style={{ padding: 20, flex: 1, overflowY: 'auto' }}>
            {/* Download button for YAML output */}
            {execResult && execResult.results?.agent_response?.includes('```yaml') && (
              <button
                onClick={() => {
                  // Extract YAML content from the response
                  const yamlMatch = execResult?.results?.agent_response?.match(/```yaml\n([\s\S]*?)```/);
                  const yamlContent = yamlMatch ? yamlMatch[1] : execResult?.results?.agent_response || '';
                  
                  // Create and download file
                  const blob = new Blob([yamlContent], { type: 'text/yaml' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'cortex_semantic_model.yaml';
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  marginBottom: 16,
                }}
              >
                <Download size={18} />
                Download Snowflake YAML
              </button>
            )}
            
            {execResult && (execResult.results?.agent_response ? (
              <>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  marginBottom: 8 
                }}>
                  <span style={{ fontSize: 11, fontWeight: 500, color: '#6B7280', textTransform: 'uppercase' }}>
                    Agent Response
                  </span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(execResult.results?.agent_response || '');
                      }}
                      style={{
                        padding: '4px 8px',
                        background: '#F3F4F6',
                        border: 'none',
                        borderRadius: 4,
                        fontSize: 10,
                        color: '#6B7280',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                      title="Copy to clipboard"
                    >
                      📋 Copy
                    </button>
                    <button
                      onClick={() => {
                        const content = execResult.results?.agent_response || '';
                        const blob = new Blob([content], { type: 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'agent_response.txt';
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                      }}
                      style={{
                        padding: '4px 8px',
                        background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                        border: 'none',
                        borderRadius: 4,
                        fontSize: 10,
                        color: 'white',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                      title="Download as file"
                    >
                      <Download size={12} />
                      Download
                    </button>
                  </div>
                </div>
                <div style={{ 
                  background: '#F5F7FA', 
                  padding: 16, 
                  borderRadius: 8, 
                  fontSize: 13, 
                  lineHeight: 1.6,
                  color: '#1F2937',
                  whiteSpace: 'pre-wrap'
                }}>
                  {execResult.results.agent_response}
                </div>
              </>
            ) : (
              <>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  marginBottom: 8 
                }}>
                  <span style={{ fontSize: 11, fontWeight: 500, color: '#6B7280', textTransform: 'uppercase' }}>
                    Workflow Results
                  </span>
                  {execResult.results && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(JSON.stringify(execResult.results, null, 2));
                        }}
                        style={{
                          padding: '4px 8px',
                          background: '#F3F4F6',
                          border: 'none',
                          borderRadius: 4,
                          fontSize: 10,
                          color: '#6B7280',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                        title="Copy to clipboard"
                      >
                        📋 Copy
                      </button>
                      <button
                        onClick={() => {
                          const content = JSON.stringify(execResult.results, null, 2);
                          const blob = new Blob([content], { type: 'application/json' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = 'workflow_results.json';
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          URL.revokeObjectURL(url);
                        }}
                        style={{
                          padding: '4px 8px',
                          background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                          border: 'none',
                          borderRadius: 4,
                          fontSize: 10,
                          color: 'white',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                        title="Download as file"
                      >
                        <Download size={12} />
                        Download
                      </button>
                    </div>
                  )}
                </div>
                <div style={{ 
                  background: '#F5F7FA', 
                  padding: 16, 
                  borderRadius: 8, 
                  fontSize: 13, 
                  lineHeight: 1.6,
                  color: '#1F2937',
                  whiteSpace: 'pre-wrap'
                }}>
                  {execResult.results ? JSON.stringify(execResult.results, null, 2) : 'Workflow completed - check execution log below.'}
                </div>
              </>
            ))}
            {/* Execution Summary */}
            {execResult && (
              <div style={{ marginTop: 20 }}>
                {/* User Query */}
                {execResult.user_prompt && (
                  <div style={{ 
                    background: 'linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)', 
                    padding: 12, 
                    borderRadius: 8, 
                    marginBottom: 12,
                    border: '1px solid #C7D2FE'
                  }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#4338CA', textTransform: 'uppercase', marginBottom: 4 }}>
                      💬 Your Question
                    </div>
                    <div style={{ fontSize: 13, color: '#3730A3', fontStyle: 'italic' }}>
                      "{execResult.user_prompt}"
                    </div>
                  </div>
                )}

                {/* Execution Stats */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(3, 1fr)', 
                  gap: 8, 
                  marginBottom: 12 
                }}>
                  <div style={{ background: '#F0FDF4', padding: 10, borderRadius: 6, textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#16A34A' }}>
                      {execResult.messages?.filter((m: string) => m.includes('completed') || m.includes('Agent')).length || 0}
                    </div>
                    <div style={{ fontSize: 10, color: '#15803D' }}>Agents Run</div>
                  </div>
                  <div style={{ background: '#FEF3C7', padding: 10, borderRadius: 6, textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#D97706' }}>
                      {execResult.messages?.filter((m: string) => m.includes('routed') || m.includes('MULTI-DOMAIN') || m.includes('Plan:')).length || 0}
                    </div>
                    <div style={{ fontSize: 10, color: '#B45309' }}>Routes Taken</div>
                  </div>
                  <div style={{ background: '#EDE9FE', padding: 10, borderRadius: 6, textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#7C3AED' }}>
                      {execResult.messages?.filter((m: string) => m.toLowerCase().includes('semantic') || m.includes('SV')).length || 0}
                    </div>
                    <div style={{ fontSize: 10, color: '#6D28D9' }}>Semantic Views</div>
                  </div>
                </div>

                {/* Routing Decision */}
                {execResult.messages?.some((m: string) => m.includes('routed')) && (
                  <div style={{ 
                    background: '#FFFBEB', 
                    border: '1px solid #FCD34D',
                    padding: 12, 
                    borderRadius: 8, 
                    marginBottom: 12 
                  }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#B45309', textTransform: 'uppercase', marginBottom: 6 }}>
                      🔀 Routing Decision
                    </div>
                    {execResult.messages
                      .filter((m: string) => m.includes('routed'))
                      .map((msg: string, i: number) => {
                        // Match "routed to: X, Y, Z" pattern
                        const match = msg.match(/routed to[:\s]+(.+)$/i);
                        const domains = match ? match[1].trim() : 'Unknown';
                        const domainList = domains.split(',').map((d: string) => d.trim());
                        const isMultiDomain = domainList.length > 1;
                        return (
                          <div key={i} style={{ fontSize: 12, color: '#92400E', marginBottom: 4 }}>
                            <strong>{isMultiDomain ? 'Domains Selected:' : 'Domain Selected:'}</strong> {domains}
                            <div style={{ fontSize: 11, color: '#A16207', marginTop: 2 }}>
                              {isMultiDomain 
                                ? `The supervisor analyzed your question and determined it requires insights from multiple domains: ${domainList.join(', ')}. Multi-agent orchestration coordinates responses across these business areas.`
                                : `The router analyzed your question and determined the ${domains} domain is best suited to answer it. Intent classification uses AI to match your question to the most relevant business domain.`
                              }
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}

                {/* Agents Invoked */}
                <div style={{ fontSize: 11, fontWeight: 500, color: '#6B7280', textTransform: 'uppercase', marginBottom: 8 }}>
                  📋 Execution Timeline
                </div>
                <div style={{ 
                  background: '#F9FAFB', 
                  border: '1px solid #E5E7EB',
                  borderRadius: 8, 
                  overflow: 'hidden' 
                }}>
                  {execResult.messages?.map((msg: string, i: number) => {
                    // Categorize message types
                    let icon = '•';
                    let bgColor = 'transparent';
                    let textColor = '#6B7280';
                    
                    if (msg.includes('started')) {
                      icon = '🚀'; bgColor = '#DBEAFE'; textColor = '#1E40AF';
                    } else if (msg.includes('routed')) {
                      icon = '🔀'; bgColor = '#FEF3C7'; textColor = '#92400E';
                    } else if (msg.includes('completed') || msg.includes('analysis')) {
                      icon = '✅'; bgColor = '#D1FAE5'; textColor = '#065F46';
                    } else if (msg.includes('Agent') || msg.includes('agent')) {
                      icon = '🤖'; bgColor = '#EDE9FE'; textColor = '#5B21B6';
                    } else if (msg.includes('Semantic') || msg.includes('semantic') || msg.includes('SV')) {
                      icon = '📊'; bgColor = '#FCE7F3'; textColor = '#9D174D';
                    } else if (msg.includes('error') || msg.includes('Error')) {
                      icon = '❌'; bgColor = '#FEE2E2'; textColor = '#991B1B';
                    } else if (msg.includes('External') || msg.includes('API')) {
                      icon = '🌐'; bgColor = '#CFFAFE'; textColor = '#0E7490';
                    } else if (msg.includes('Query') || msg.includes('query')) {
                      icon = '💬'; bgColor = '#EEF2FF'; textColor = '#3730A3';
                    }
                    
                    return (
                      <div 
                        key={i} 
                        style={{ 
                          padding: '8px 12px', 
                          background: bgColor,
                          borderBottom: i < (execResult.messages?.length || 0) - 1 ? '1px solid #E5E7EB' : 'none',
                          fontSize: 12,
                          color: textColor,
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 8
                        }}
                      >
                        <span style={{ flexShrink: 0 }}>{icon}</span>
                        <span>{msg}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            {/* Empty State - when no results yet */}
            {!execResult && (
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center',
                height: 200,
                color: '#9CA3AF',
                textAlign: 'center',
                padding: 20,
              }}>
                <FileOutput size={40} color="#D1D5DB" style={{ marginBottom: 12 }} />
                <div style={{ fontSize: 14, fontWeight: 500, color: '#6B7280', marginBottom: 4 }}>
                  No Results Yet
                </div>
                <div style={{ fontSize: 12, color: '#9CA3AF' }}>
                  Run a workflow to see results here
                </div>
              </div>
            )}
          </div>
          </>
        )}
      </div>

      {/* Live Preview Panel */}
      {showPreview && !selectedNode && !execResult?.results?.agent_response && (
        <div style={{ width: 'var(--panel-width, 380px)' }}>
          <LivePreview 
            workflowName={workflowName}
            isConfigured={nodes.length > 0}
            nodes={nodes}
            edges={edges}
            onClose={() => setShowPreview(false)}
          />
        </div>
      )}

      {/* Tool Creator Modal */}
      {showToolCreator && (
        <ToolCreator
          tools={customTools}
          onSaveTool={async (tool) => {
            try {
              // Save to Snowflake
              await axios.post('http://localhost:8000/tools', {
                id: tool.id,
                name: tool.name,
                description: tool.description,
                type: tool.type,
                parameters: tool.parameters,
                implementation: tool.implementation,
                apiEndpoint: tool.apiEndpoint,
                apiMethod: tool.apiMethod,
              });
              
              // Update local state
              setCustomTools(prev => {
                const existing = prev.findIndex(t => t.id === tool.id);
                if (existing >= 0) {
                  const updated = [...prev];
                  updated[existing] = tool;
                  return updated;
                }
                return [...prev, tool];
              });
              showToast(`Tool "${tool.name}" saved to Snowflake!`, 'success');
            } catch (err) {
              console.error('Failed to save tool:', err);
              showToast('Failed to save tool to Snowflake', 'error');
            }
          }}
          onDeleteTool={async (toolId) => {
            try {
              await axios.delete(`http://localhost:8000/tools/${toolId}`);
              setCustomTools(prev => prev.filter(t => t.id !== toolId));
              showToast('Tool deleted', 'info');
            } catch (err) {
              console.error('Failed to delete tool:', err);
              showToast('Failed to delete tool', 'error');
            }
          }}
          onClose={() => setShowToolCreator(false)}
        />
      )}

      {/* Admin Dashboard Modal */}
      {showAdminDashboard && (
        <AdminDashboard onClose={() => setShowAdminDashboard(false)} />
      )}
    </div>
  );
}

const sectionHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 4px',
  fontSize: 11,
  fontWeight: 600,
  color: '#1F2937',
  cursor: 'pointer',
  borderBottom: '1px solid #F3F4F6',
  marginBottom: 4,
  userSelect: 'none',
};

const compactItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 8px',
  fontSize: 12,
  color: '#374151',
  background: '#F9FAFB',
  borderRadius: 6,
  marginBottom: 4,
  cursor: 'grab',
  transition: 'background 0.15s',
};

const compactBtnStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '6px',
  background: '#F5F7FA',
  border: '1px solid #E5E9F0',
  borderRadius: 4,
  cursor: 'pointer',
  color: '#6B7280',
};

const actionBtnStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
  padding: '8px 12px',
  background: '#F5F7FA',
  border: '1px solid #E5E9F0',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 500,
  color: '#1F2937',
  fontFamily: 'Inter, -apple-system, sans-serif',
};

const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(0,0,0,0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
};

const modalStyle: React.CSSProperties = {
  background: 'white',
  padding: 24,
  borderRadius: 12,
  width: 400,
  maxWidth: '90%',
  boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
  fontFamily: 'Inter, -apple-system, sans-serif',
};

export default function App() {
  return (
    <ReactFlowProvider>
      <Flow />
    </ReactFlowProvider>
  );
}
