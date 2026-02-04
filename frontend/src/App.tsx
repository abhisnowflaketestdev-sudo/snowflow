import ReactFlow, { Background, ControlButton, Controls, ReactFlowProvider, useReactFlow, SelectionMode } from 'reactflow';
import 'reactflow/dist/style.css';
import { useFlowStore } from './store';
import { SnowflakeSourceNode } from './nodes/SnowflakeSourceNode';
import { AgentNode } from './nodes/AgentNode';
import { OutputNode } from './nodes/OutputNode';
import { CortexNode } from './nodes/CortexNode';
import { ConditionNode } from './nodes/ConditionNode';
import { ExternalAgentNode, externalAgentPresets } from './nodes/ExternalAgentNode';
import { SemanticModelNode } from './nodes/SemanticModelNode';
import { RouterNode } from './nodes/RouterNode';
import { SupervisorNode } from './nodes/SupervisorNode';
import { FileInputNode, FileOutputNode, SchemaExtractorNode, SchemaTransformerNode } from './nodes/SchemaNodes';
import DaxTranslatorNode from './nodes/DaxTranslatorNode';
import { DataCatalog } from './components/DataCatalog';
import { Templates, templateConfigs } from './components/Templates';
// LivePreview removed - chat now built into main panel
import { ToolCreator } from './components/ToolCreator';
import type { CustomTool } from './components/ToolCreator';
import { AdminDashboard } from './components/AdminDashboard';
import { GuidedStackCanvas } from './components/GuidedStackCanvas';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Database, Brain, FileOutput, Play, X, Sparkles, Save, FolderOpen, Loader2, CheckCircle, CheckCircle2, AlertCircle, AlertTriangle, XCircle, FileText, Heart, Languages, GitBranch, Globe, Layers, BookOpen, Zap, MessageSquare, Download, Upload, Shield, Bot, Cloud, Building2, FileUp, FileDown, ArrowRightLeft, GripVertical, ChevronLeft, ChevronRight, ChevronDown, Sun, Moon, Pencil, Lock, Unlock, RefreshCw, Trash2, User, BarChart3, Copy } from 'lucide-react';
import axios from 'axios';
import type { Node } from 'reactflow';
import { getStoredTheme, setTheme, type ThemeMode } from './theme';

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

type CortexModelOption = { id: string; label?: string; provider?: string; available?: boolean | null };

function NodeDetailPanel({
  customTools,
  isReadOnly,
  cortexModels,
  roleVersion,
  onRefreshCortexModels,
  cortexModelsRefreshing,
  cortexModelProbe,
  setCortexModelProbe,
  cortexCrossRegion,
  setCortexCrossRegion,
}: {
  customTools: CustomTool[];
  isReadOnly?: boolean;
  cortexModels?: CortexModelOption[];
  roleVersion?: number;
  onRefreshCortexModels?: (opts: { probe: boolean; crossRegion: boolean; forceRefresh?: boolean }) => void;
  cortexModelsRefreshing?: boolean;
  cortexModelProbe?: boolean;
  setCortexModelProbe?: (v: boolean) => void;
  cortexCrossRegion?: boolean;
  setCortexCrossRegion?: (v: boolean) => void;
}) {
  const { selectedNode, updateNodeData, nodes, edges } = useFlowStore();
  const [sfDatabases, setSfDatabases] = useState<string[]>([]);
  const [sfSchemas, setSfSchemas] = useState<string[]>([]);
  const [sfStages, setSfStages] = useState<string[]>([]);
  const [sfYamlFiles, setSfYamlFiles] = useState<string[]>([]);
  const [sfObjects, setSfObjects] = useState<string[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  
  // Fetch Snowflake metadata for dropdowns
  useEffect(() => {
    const fetchDatabases = async () => {
      try {
        const res = await axios.get('http://localhost:8000/catalog/databases');
        if (res.data.databases) {
          setSfDatabases(res.data.databases);
        }
      } catch (err) {
        // Fallback to common defaults
        setSfDatabases(['SNOWFLOW_DEV', 'SNOWFLOW_PROD', 'DEMO_DB']);
      }
    };
    fetchDatabases();
  }, [roleVersion]);
  
  // Fetch schemas when database changes
  useEffect(() => {
    const fetchSchemas = async () => {
      if (!selectedNode?.data?.database) return;
      try {
        const res = await axios.get(`http://localhost:8000/catalog/schemas/${selectedNode.data.database}`);
        if (res.data.schemas) {
          setSfSchemas(res.data.schemas);
        }
      } catch (err) {
        setSfSchemas(['PUBLIC', 'DEMO', 'SEMANTIC_MODELS', 'RETAIL_ANALYTICS']);
      }
    };
    fetchSchemas();
  }, [selectedNode?.data?.database]);
  
  // Fetch stages when schema changes
  useEffect(() => {
    const fetchStages = async () => {
      if (!selectedNode?.data?.database || !selectedNode?.data?.schema) return;
      try {
        const res = await axios.get(`http://localhost:8000/catalog/stages/${selectedNode.data.database}/${selectedNode.data.schema}`);
        if (res.data.stages) {
          setSfStages(res.data.stages);
        }
      } catch (err) {
        setSfStages(['SEMANTIC_MODELS', 'CORTEX_STAGE', 'DATA_STAGE']);
      }
    };
    fetchStages();
  }, [selectedNode?.data?.database, selectedNode?.data?.schema]);

  // Fetch object names when DB/Schema/ObjectType changes (tables/views/etc)
  useEffect(() => {
    const fetchObjects = async () => {
      if (!selectedNode?.data?.database || !selectedNode?.data?.schema) {
        setSfObjects([]);
        return;
      }
      const t = (selectedNode?.data?.objectType || 'table') as string;
      try {
        const res = await axios.get(
          `http://localhost:8000/catalog/objects/${selectedNode.data.database}/${selectedNode.data.schema}?type=${encodeURIComponent(t)}`
        );
        if (Array.isArray(res.data?.objects)) {
          setSfObjects(res.data.objects);
        } else {
          setSfObjects([]);
        }
      } catch {
        setSfObjects([]);
      }
    };
    fetchObjects();
  }, [selectedNode?.data?.database, selectedNode?.data?.schema, selectedNode?.data?.objectType, roleVersion]);
  
  // Fetch YAML files when stage changes
  useEffect(() => {
    const fetchYamlFiles = async () => {
      if (!selectedNode?.data?.database || !selectedNode?.data?.schema || !selectedNode?.data?.stage) return;
      setLoadingOptions(true);
      try {
        const res = await axios.get(
          `http://localhost:8000/catalog/semantic-models/${selectedNode.data.database}/${selectedNode.data.schema}/${selectedNode.data.stage}`
        );
        if (res.data.semantic_models) {
          setSfYamlFiles(res.data.semantic_models.map((m: any) => m.name));
        }
      } catch (err) {
        setSfYamlFiles([]);
      } finally {
        setLoadingOptions(false);
      }
    };
    fetchYamlFiles();
  }, [selectedNode?.data?.database, selectedNode?.data?.schema, selectedNode?.data?.stage]);
  
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
            {sfObjects.length > 0 ? (
              <select
                style={inputStyle}
                value={data.label || ''}
                onChange={(e) => updateNodeData(selectedNode.id, { label: e.target.value })}
                disabled={!data.database || !data.schema}
              >
                <option value="">Select object…</option>
                {sfObjects.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            ) : (
              <input 
                style={inputStyle} 
                value={data.label || ''} 
                onChange={(e) => updateNodeData(selectedNode.id, { label: e.target.value })}
                placeholder="e.g., VW_RETAIL_SALES"
              />
            )}
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Database</label>
            <select 
              style={inputStyle} 
              value={data.database || ''} 
              onChange={(e) => updateNodeData(selectedNode.id, { database: e.target.value, schema: '' })}
            >
              <option value="">Select database...</option>
              {sfDatabases.map(db => (
                <option key={db} value={db}>{db}</option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Schema</label>
            <select 
              style={inputStyle} 
              value={data.schema || ''} 
              onChange={(e) => updateNodeData(selectedNode.id, { schema: e.target.value })}
              disabled={!data.database}
            >
              <option value="">Select schema...</option>
              {sfSchemas.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {!data.database && <div style={hintStyle}>Select database first</div>}
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Object Type</label>
            <select 
              style={inputStyle} 
              value={data.objectType || 'table'}
              onChange={(e) => updateNodeData(selectedNode.id, { objectType: e.target.value, label: '' })}
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
      const modelsByProvider = (cortexModels || []).reduce<Record<string, CortexModelOption[]>>((acc, m) => {
        const key = m.provider || 'Models';
        acc[key] = acc[key] || [];
        acc[key].push(m);
        return acc;
      }, {});
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
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select 
                style={{ ...inputStyle, flex: 1 }} 
                value={data.model || 'mistral-large2'}
                onChange={(e) => updateNodeData(selectedNode.id, { model: e.target.value })}
              >
              {cortexModels?.length ? (
                Object.entries(modelsByProvider).map(([provider, models]) => (
                  <optgroup key={provider} label={provider}>
                    {models.map((m) => (
                      <option
                        key={m.id}
                        value={m.id}
                        disabled={m.available === false}
                      >
                        {(m.label || m.id) + (m.available === false ? ' (unavailable)' : '')}
                      </option>
                    ))}
                  </optgroup>
                ))
              ) : (
                <>
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
                </>
              )}
            </select>
              <button
                onClick={() => onRefreshCortexModels?.({ probe: !!cortexModelProbe, crossRegion: !!cortexCrossRegion, forceRefresh: true })}
                disabled={!onRefreshCortexModels || cortexModelsRefreshing}
                title="Refresh model list from Snowflake"
                style={{
                  width: 38,
                  height: 36,
                  borderRadius: 10,
                  border: '1px solid rgb(var(--border))',
                  background: 'rgb(var(--surface-2))',
                  color: 'rgb(var(--fg))',
                  cursor: (!onRefreshCortexModels || cortexModelsRefreshing) ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <RefreshCw size={16} className={cortexModelsRefreshing ? 'animate-spin' : ''} />
              </button>
            </div>
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'rgb(var(--fg-muted))' }}>
                <input
                  type="checkbox"
                  checked={!!cortexModelProbe}
                  onChange={(e) => setCortexModelProbe?.(e.target.checked)}
                  disabled={!setCortexModelProbe}
                />
                Probe availability (slower, costs a tiny COMPLETE() call per model)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'rgb(var(--fg-muted))' }}>
                <input
                  type="checkbox"
                  checked={!!cortexCrossRegion}
                  onChange={(e) => setCortexCrossRegion?.(e.target.checked)}
                  disabled={!setCortexCrossRegion}
                />
                Cross-region models (experimental; requires Snowflake entitlement)
              </label>
            </div>
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
            <label style={labelStyle}>Delivery Channel</label>
            <select 
              style={inputStyle} 
              value={data.channel || 'snowflake_intelligence'}
              onChange={(e) => updateNodeData(selectedNode.id, { channel: e.target.value })}
            >
              <option value="snowflake_intelligence">Snowflake Intelligence (ai.snowflake.com)</option>
              <option value="api">REST API Endpoint</option>
              <option value="slack">Slack (Coming Soon)</option>
              <option value="teams">Microsoft Teams (Coming Soon)</option>
            </select>
          </div>
          {data.channel === 'api' && (
            <div style={{ marginBottom: 16, padding: 12, background: 'rgba(16,185,129,0.08)', borderRadius: 8, border: '1px solid rgba(16,185,129,0.2)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#059669', marginBottom: 6 }}>🔌 REST API Endpoint</div>
              <div style={{ fontSize: 10, color: '#065F46', lineHeight: 1.5 }}>
                Your agent will be accessible via:<br/>
                <code style={{ background: 'rgba(0,0,0,0.05)', padding: '2px 4px', borderRadius: 3, fontSize: 9 }}>POST http://localhost:8000/run/stream</code>
              </div>
            </div>
          )}
          {(data.channel === 'slack' || data.channel === 'teams') && (
            <div style={{ marginBottom: 16, padding: 12, background: 'rgba(245,158,11,0.08)', borderRadius: 8, border: '1px solid rgba(245,158,11,0.2)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#D97706', marginBottom: 4 }}>🚧 Coming Soon</div>
              <div style={{ fontSize: 10, color: '#92400E' }}>
                {data.channel === 'slack' ? 'Slack' : 'Microsoft Teams'} integration is under development.
              </div>
            </div>
          )}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Output Format</label>
            <select 
              style={inputStyle} 
              value={data.outputType || 'display'}
              onChange={(e) => updateNodeData(selectedNode.id, { outputType: e.target.value })}
            >
              <option value="display">Display (Text)</option>
              <option value="json">JSON</option>
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
      const outgoing = edges.filter((e) => e.source === selectedNode.id);
      const connectedTargetsByIndex: Array<Node | null> = [null, null, null];
      for (const e of outgoing) {
        const sh = (e as any).sourceHandle as string | undefined;
        if (typeof sh === 'string' && sh.startsWith('route-')) {
          const idx = parseInt(sh.split('-')[1] || '', 10);
          if (idx >= 1 && idx <= 3) {
            connectedTargetsByIndex[idx - 1] = nodes.find((n) => n.id === e.target) || null;
          }
        }
      }

      const syncRoutesFromConnections = () => {
        const current = [...(data.routes || [{}, {}, {}])];
        const next = [0, 1, 2].map((i) => {
          const target = connectedTargetsByIndex[i];
          const existing = current[i] || {};
          const targetLabel = target ? (((target as any).data?.label as string) || target.id) : '';
          const safeName = (existing as any).name || targetLabel || `Route ${i + 1}`;
          const existingCond = (existing as any).condition || '';
          const defaultCond =
            (data.routingStrategy || 'intent') === 'keyword'
              ? '' // keyword list is user-defined; keep blank by default
              : `intent == "${safeName.toLowerCase().replace(/\s+/g, '_')}"`;
          return {
            ...(existing as any),
            name: safeName,
            condition: existingCond || defaultCond,
            targetAgent: target ? target.id : (existing as any).targetAgent || '',
          };
        });
        updateNodeData(selectedNode.id, { routes: next });
      };

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
              Connect each output handle to a different agent. You can optionally tune the intent/keywords per route.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
              <button
                onClick={syncRoutesFromConnections}
                style={{
                  padding: '6px 10px',
                  fontSize: 11,
                  borderRadius: 8,
                  border: '1px solid rgb(var(--border))',
                  background: 'rgb(var(--surface-2))',
                  color: 'rgb(var(--fg))',
                  cursor: 'pointer',
                }}
                title="Fill route names/targets from connected nodes (does not overwrite your existing text)"
              >
                Sync from connections
              </button>
            </div>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 10, color: 'rgb(var(--muted))', marginBottom: 6 }}>
                  Output {i} →{' '}
                  <strong style={{ color: 'rgb(var(--fg))' }}>
                    {connectedTargetsByIndex[i - 1]
                      ? (((connectedTargetsByIndex[i - 1] as any).data?.label as string) || connectedTargetsByIndex[i - 1]!.id)
                      : 'Not connected'}
                  </strong>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
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
                    placeholder={(data.routingStrategy || 'intent') === 'keyword' ? 'Keywords (comma-separated)' : 'Intent hint (optional)'}
                  value={data.routes?.[i-1]?.condition || ''}
                  onChange={(e) => {
                    const routes = [...(data.routes || [{}, {}, {}])];
                    routes[i-1] = { ...routes[i-1], condition: e.target.value };
                    updateNodeData(selectedNode.id, { routes });
                  }}
                />
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding: 12, background: '#FDF4FF', borderRadius: 8, fontSize: 11, color: '#7E22CE' }}>
            <strong>How it works:</strong><br/>
            Routes incoming requests to connected agents based on the selected strategy.
          </div>
        </>
      );
    }

    if (type === 'supervisor') {
      const modelsByProvider = (cortexModels || []).reduce<Record<string, CortexModelOption[]>>((acc, m) => {
        const key = m.provider || 'Models';
        acc[key] = acc[key] || [];
        acc[key].push(m);
        return acc;
      }, {});

      const outgoing = edges.filter((e) => e.source === selectedNode.id);
      const connectedAgents = outgoing
        .map((e) => nodes.find((n) => n.id === e.target))
        .filter((n): n is Node => Boolean(n))
        .filter((n) => n.type === 'agent' || n.type === 'cortexAgent');

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
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select 
                style={{ ...inputStyle, flex: 1 }} 
                value={data.model || 'mistral-large2'}
                onChange={(e) => updateNodeData(selectedNode.id, { model: e.target.value })}
              >
              {cortexModels?.length ? (
                Object.entries(modelsByProvider).map(([provider, models]) => (
                  <optgroup key={provider} label={provider}>
                    {models.map((m) => (
                      <option
                        key={m.id}
                        value={m.id}
                        disabled={m.available === false}
                      >
                        {(m.label || m.id) + (m.available === false ? ' (unavailable)' : '')}
                      </option>
                    ))}
                  </optgroup>
                ))
              ) : (
                <>
              <option value="mistral-large2">Mistral Large 2</option>
              <option value="llama3.1-70b">Llama 3.1 70B</option>
              <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
                </>
              )}
            </select>
              <button
                onClick={() => onRefreshCortexModels?.({ probe: !!cortexModelProbe, crossRegion: !!cortexCrossRegion, forceRefresh: true })}
                disabled={!onRefreshCortexModels || cortexModelsRefreshing}
                title="Refresh model list from Snowflake"
                style={{
                  width: 38,
                  height: 36,
                  borderRadius: 10,
                  border: '1px solid rgb(var(--border))',
                  background: 'rgb(var(--surface-2))',
                  color: 'rgb(var(--fg))',
                  cursor: (!onRefreshCortexModels || cortexModelsRefreshing) ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <RefreshCw size={16} className={cortexModelsRefreshing ? 'animate-spin' : ''} />
              </button>
            </div>
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'rgb(var(--fg-muted))' }}>
                <input
                  type="checkbox"
                  checked={!!cortexModelProbe}
                  onChange={(e) => setCortexModelProbe?.(e.target.checked)}
                  disabled={!setCortexModelProbe}
                />
                Probe availability (slower)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'rgb(var(--fg-muted))' }}>
                <input
                  type="checkbox"
                  checked={!!cortexCrossRegion}
                  onChange={(e) => setCortexCrossRegion?.(e.target.checked)}
                  disabled={!setCortexCrossRegion}
                />
                Cross-region models (experimental)
              </label>
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Max Iterations</label>
            <input
              type="number"
              min={1}
              max={50}
              style={inputStyle}
              value={data.maxDelegations ?? 5}
              onChange={(e) => updateNodeData(selectedNode.id, { maxDelegations: Math.max(1, Math.min(50, parseInt(e.target.value || '5', 10))) })}
              placeholder="5"
            />
            <div style={hintStyle}>Upper bound on delegation/looping steps (safety guard)</div>
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
          <div style={{ marginBottom: 16 }}>
            <div style={sectionStyle}>Connected Agents</div>
            <div style={{ fontSize: 12, color: 'rgb(var(--fg-muted))' }}>
              {connectedAgents.length === 0 ? (
                <span>Agents: <strong>None</strong></span>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div>Agents: <strong>{connectedAgents.length}</strong></div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {connectedAgents.map((n) => (
                      <span key={n.id} style={{ padding: '4px 8px', borderRadius: 999, border: '1px solid rgb(var(--border))', background: 'rgb(var(--surface-2))', color: 'rgb(var(--fg))', fontSize: 11 }}>
                        {(n.data as any)?.label || n.id}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
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
      const agentType = data.agentType || 'rest';
      const endpointLabel =
        agentType === 'mcp' ? 'MCP Server URL' : 'Endpoint URL';
      const endpointPlaceholder =
        agentType === 'mcp'
          ? 'http://localhost:3001 (MCP server)'
          : agentType === 'webhook'
            ? 'https://hooks.example.com/your-webhook'
            : 'https://api.example.com/agent';

      const authLabel = 'Authentication';

      const isMcp = agentType === 'mcp';

      const handleExternalAgentTypeChange = (nextType: string) => {
        const prev = data.agentType || 'rest';

        const nextPatch: Record<string, unknown> = { agentType: nextType };

        // Vendor presets: keep styling consistent and auto-fill known defaults.
        if (['copilot', 'openai', 'salesforce', 'servicenow'].includes(nextType)) {
          const preset = (externalAgentPresets as any)[nextType];
          if (preset) {
            // Only overwrite the display name if the user hasn't customized it.
            const prevLabel = String(data.label || '');
            const looksAuto = !prevLabel || prevLabel === 'API Call' || prevLabel === 'Custom API' || prevLabel === 'Microsoft Copilot' || prevLabel === 'OpenAI GPT' || prevLabel === 'Salesforce Einstein' || prevLabel === 'ServiceNow';
            if (looksAuto) nextPatch.label = preset.label;
            nextPatch.provider = preset.provider;
            nextPatch.endpoint = preset.endpoint;
            nextPatch.method = preset.method || 'POST';
            nextPatch.authType = preset.authType || 'none';
            // Do not carry over tokens across type switches.
            nextPatch.authToken = '';
            nextPatch.apiKey = '';
            nextPatch.apiKeyHeader = 'X-API-Key';
            if (preset.headers) {
              try {
                nextPatch.headersJson = JSON.stringify(preset.headers, null, 0);
              } catch {
                nextPatch.headersJson = '';
              }
            }
          }
          updateNodeData(selectedNode.id, nextPatch);
          return;
        }

        // If switching to MCP, the existing REST-style endpoint is almost certainly wrong.
        // Keep user-entered MCP endpoints, but clear obvious vendor REST URLs.
        if (nextType === 'mcp' && prev !== 'mcp') {
          const currentEndpoint = String(data.endpoint || '');
          const looksLikeVendorRest =
            currentEndpoint.includes('api.salesforce.com') ||
            currentEndpoint.includes('openai.com') ||
            currentEndpoint.includes('service-now.com') ||
            currentEndpoint.includes('graph.microsoft.com');
          if (looksLikeVendorRest) {
            nextPatch.endpoint = '';
            nextPatch.provider = '';
          }
          nextPatch.method = 'POST';
          // MCP typically uses a bearer token when needed
          nextPatch.authType = 'bearer';
        }

        // If switching away from MCP, reset method to POST (reasonable default).
        if (prev === 'mcp' && nextType !== 'mcp') {
          nextPatch.method = data.method || 'POST';
        }

        // If switching from a vendor preset to a custom type, clear provider so card doesn't imply vendor integration.
        if (['copilot', 'openai', 'salesforce', 'servicenow'].includes(prev) && ['rest', 'webhook', 'mcp'].includes(nextType)) {
          nextPatch.provider = '';
          // Avoid confusing carry-over of vendor endpoints/credentials into a Custom API/MCP/Webhook.
          nextPatch.endpoint = '';
          nextPatch.method = 'POST';
          nextPatch.authType = 'none';
          nextPatch.authToken = '';
          nextPatch.apiKey = '';
          nextPatch.apiKeyHeader = 'X-API-Key';
          nextPatch.headersJson = '{"Content-Type":"application/json"}';

          // If the label was auto-set by a preset, switch it back to "Custom API".
          const prevLabel = String(data.label || '');
          const wasPresetLabel = ['Microsoft Copilot', 'OpenAI GPT', 'Salesforce Einstein', 'ServiceNow'].includes(prevLabel);
          if (wasPresetLabel) nextPatch.label = 'Custom API';
        }

        updateNodeData(selectedNode.id, nextPatch);
      };

      return (
        <>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Name</label>
            <input 
              style={inputStyle} 
              value={data.label || ''} 
              onChange={(e) => updateNodeData(selectedNode.id, { label: e.target.value })}
              disabled={isReadOnly}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Agent Type</label>
            <select 
              style={inputStyle} 
              value={agentType}
              onChange={(e) => handleExternalAgentTypeChange(e.target.value)}
              disabled={isReadOnly}
            >
              <optgroup label="Presets">
                <option value="copilot">Microsoft Copilot</option>
                <option value="openai">OpenAI GPT</option>
                <option value="salesforce">Salesforce Einstein</option>
                <option value="servicenow">ServiceNow</option>
              </optgroup>
              <optgroup label="Custom">
              <option value="rest">Custom API</option>
              <option value="mcp">MCP Agent</option>
              <option value="webhook">Webhook</option>
              </optgroup>
            </select>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>{endpointLabel}</label>
            <input 
              style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 12 }} 
              value={data.endpoint || ''} 
              onChange={(e) => updateNodeData(selectedNode.id, { endpoint: e.target.value })}
              placeholder={endpointPlaceholder}
              disabled={isReadOnly}
            />
            {isMcp ? (
              <div style={hintStyle}>
                MCP uses a server URL (not a vendor REST endpoint). The node will call tools exposed by that MCP server.
          </div>
            ) : agentType === 'webhook' ? (
              <div style={hintStyle}>Webhook endpoints are typically public HTTPS URLs that accept POST requests.</div>
            ) : null}
          </div>
          {!isMcp && (
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Method</label>
            <select 
              style={inputStyle} 
              value={data.method || 'POST'}
              onChange={(e) => updateNodeData(selectedNode.id, { method: e.target.value })}
                disabled={isReadOnly}
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
            </select>
          </div>
          )}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>{authLabel}</label>
            <select 
              style={inputStyle} 
              value={data.authType || 'none'}
              onChange={(e) => updateNodeData(selectedNode.id, { authType: e.target.value })}
              disabled={isReadOnly}
            >
              <option value="none">None</option>
              <option value="bearer">Bearer Token</option>
              {!isMcp && <option value="api_key">API Key</option>}
              {!isMcp && <option value="oauth">OAuth</option>}
            </select>
          </div>

          {/* Credentials / headers (type-aware) */}
          {!isMcp && data.authType === 'bearer' && (
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Bearer Token</label>
              <input
                type="password"
                style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 12 }}
                value={data.authToken || ''}
                onChange={(e) => updateNodeData(selectedNode.id, { authToken: e.target.value })}
                placeholder="Paste token…"
                disabled={isReadOnly}
              />
            </div>
          )}

          {!isMcp && data.authType === 'api_key' && (
            <>
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>API Key Header Name</label>
                <input
                  style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 12 }}
                  value={data.apiKeyHeader || 'X-API-Key'}
                  onChange={(e) => updateNodeData(selectedNode.id, { apiKeyHeader: e.target.value })}
                  placeholder="X-API-Key"
                  disabled={isReadOnly}
                />
                <div style={hintStyle}>Most APIs use `X-API-Key` or `Authorization`.</div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>API Key</label>
                <input
                  type="password"
                  style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 12 }}
                  value={data.apiKey || ''}
                  onChange={(e) => updateNodeData(selectedNode.id, { apiKey: e.target.value })}
                  placeholder="Paste key…"
                  disabled={isReadOnly}
                />
          </div>
            </>
          )}

          {!isMcp && data.authType === 'oauth' && (
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>OAuth Access Token</label>
              <input
                type="password"
                style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 12 }}
                value={data.authToken || ''}
                onChange={(e) => updateNodeData(selectedNode.id, { authToken: e.target.value })}
                placeholder="Paste access token…"
                disabled={isReadOnly}
              />
              <div style={hintStyle}>For production, this should be managed by an Agent Gateway / secrets store.</div>
            </div>
          )}

          {isMcp && (
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>MCP Auth Token (optional)</label>
              <input
                type="password"
                style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 12 }}
                value={data.authToken || ''}
                onChange={(e) => updateNodeData(selectedNode.id, { authToken: e.target.value })}
                placeholder="Bearer token (optional)…"
                disabled={isReadOnly}
              />
            </div>
          )}

          {!isMcp && (
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Headers (JSON)</label>
              <textarea
                style={{ ...inputStyle, minHeight: 90, resize: 'vertical', fontFamily: 'monospace', fontSize: 11 }}
                value={data.headersJson || ''}
                onChange={(e) => updateNodeData(selectedNode.id, { headersJson: e.target.value })}
                placeholder='{"Content-Type":"application/json"}'
                disabled={isReadOnly}
              />
              <div style={hintStyle}>Merged with auth headers at runtime. Invalid JSON will be ignored.</div>
            </div>
          )}
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
            <select 
              style={inputStyle} 
              value={data.database || ''} 
              onChange={(e) => {
                updateNodeData(selectedNode.id, { database: e.target.value, schema: '', stage: '', yamlFile: '' });
              }}
            >
              <option value="">Select database...</option>
              {sfDatabases.map(db => (
                <option key={db} value={db}>{db}</option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Schema</label>
            <select 
              style={inputStyle} 
              value={data.schema || ''} 
              onChange={(e) => {
                updateNodeData(selectedNode.id, { schema: e.target.value, stage: '', yamlFile: '' });
              }}
              disabled={!data.database}
            >
              <option value="">Select schema...</option>
              {sfSchemas.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {!data.database && <div style={hintStyle}>Select database first</div>}
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Stage</label>
            <select 
              style={inputStyle} 
              value={data.stage || ''} 
              onChange={(e) => {
                updateNodeData(selectedNode.id, { stage: e.target.value, yamlFile: '' });
              }}
              disabled={!data.schema}
            >
              <option value="">Select stage...</option>
              {sfStages.map(st => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
            {!data.schema && <div style={hintStyle}>Select schema first</div>}
            {data.schema && <div style={hintStyle}>Internal stage containing YAML file</div>}
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>YAML File</label>
            <select 
              style={inputStyle} 
              value={data.yamlFile || ''} 
              onChange={(e) => {
                updateNodeData(selectedNode.id, { yamlFile: e.target.value });
              }}
              disabled={!data.stage || loadingOptions}
            >
              <option value="">{loadingOptions ? 'Loading...' : 'Select YAML file...'}</option>
              {sfYamlFiles.map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
            {!data.stage && <div style={hintStyle}>Select stage first</div>}
            {data.stage && sfYamlFiles.length === 0 && !loadingOptions && (
              <div style={hintStyle}>No YAML files found in this stage</div>
            )}
          </div>
          
          <div style={{ padding: 12, background: 'rgb(var(--purple-bg))', borderRadius: 8, fontSize: 11, color: 'rgb(var(--purple-fg))' }}>
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
      width: '100%',
      maxWidth: '100%',
      background: 'rgb(var(--surface))',
      display: 'flex', 
      flexDirection: 'column',
      fontFamily: 'Inter, -apple-system, sans-serif',
      boxSizing: 'border-box',
    }}>
      {/* Header */}
      <div style={{ 
        padding: '14px 16px', 
        borderBottom: '1px solid rgb(var(--border))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgb(var(--surface-2))',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {getNodeIcon()}
          <span style={{ fontWeight: 600, color: 'rgb(var(--fg))', fontSize: 14 }}>{getNodeTitle()}</span>
        </div>
      </div>

      {/* Fields */}
      <div style={{ padding: '16px', flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {isReadOnly && (
          <div style={{ 
            background: 'rgb(var(--warning-bg))', 
            color: 'rgb(var(--warning-fg))', 
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
  color: 'rgb(var(--muted))',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  fontSize: 14,
  border: '1px solid rgb(var(--border))',
  borderRadius: 6,
  outline: 'none',
  fontFamily: 'Inter, -apple-system, sans-serif',
  boxSizing: 'border-box',
  background: 'rgb(var(--surface))',
  color: 'rgb(var(--fg))',
};

const sectionStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  color: 'rgb(var(--ring))',
  textTransform: 'uppercase',
  letterSpacing: 1,
  marginTop: 20,
  marginBottom: 12,
  paddingBottom: 6,
  borderBottom: '1px solid rgb(var(--border))',
};

const hintStyle: React.CSSProperties = {
  fontSize: 10,
  color: 'rgb(var(--muted))',
  marginTop: 4,
};

type ExecutionStatus = 'idle' | 'validating' | 'running' | 'success' | 'error';
type ExecutionResult = {
  status: string;
  job_id?: string;
  messages?: string[];
  results?: { agent_response?: string };
  error?: string;
  user_prompt?: string;
  executed_nodes?: string[];
  simulated_nodes?: string[];
};

// History entry for tracking past queries
interface ExecutionHistoryEntry {
  id: string;
  prompt: string;
  result: ExecutionResult;
  timestamp: Date;
  executionTimeMs?: number;
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
        width: 380,
        maxHeight: 'calc(100vh - 120px)',
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        borderRadius: 12,
        background: '#FFFFFF',
        border: '1px solid #E5E9F0',
        display: 'flex',
        flexDirection: 'column',
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
          flex: '0 0 auto',
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
      <div style={{ flex: '1 1 auto', overflowY: 'auto', overflowX: 'hidden' }}>
        {children}
      </div>
    </div>
  );
}

function Flow() {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, addNode, selectedNode, setSelectedNode, workflowId, workflowName, setWorkflowName, setWorkflow, clearWorkflow, updateNodeData, lastAutosavedAt } = useFlowStore();
  const { screenToFlowPosition } = useReactFlow();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const workflowNameInputRef = useRef<HTMLInputElement>(null);
  const [execStatus, setExecStatus] = useState<ExecutionStatus>('idle');
  const [execResult, setExecResult] = useState<ExecutionResult | null>(null);
  const [executionHistory, setExecutionHistory] = useState<ExecutionHistoryEntry[]>([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [statsExpanded, setStatsExpanded] = useState(true); // Independent stats panel state
  const [chatInput, setChatInput] = useState(''); // Chat input field
  const [chatMode, setChatMode] = useState<'query' | 'edit'>('query'); // Toggle between query and edit modes
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null); // For multi-agent selection
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showNamePrompt, setShowNamePrompt] = useState(false); // Prompt for workflow name before first run
  const [pendingRunPrompt, setPendingRunPrompt] = useState<string | undefined>(undefined); // Store prompt while naming
  
  // Validation state
  const [showValidationPanel, setShowValidationPanel] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    errors: Array<{ code: string; message: string; suggestion: string; node_id?: string; details?: Record<string, unknown> }>;
    warnings: Array<{ code: string; message: string; suggestion: string; node_id?: string }>;
    info: Array<{ code: string; message: string; node_id?: string }>;
  } | null>(null);
  const [pendingValidationPrompt, setPendingValidationPrompt] = useState<string | undefined>(undefined);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [savedWorkflows, setSavedWorkflows] = useState<Array<{ filename: string; name: string; node_count: number }>>([]);
  const [workflowDescription, setWorkflowDescription] = useState('');
  const [backendConnected, setBackendConnected] = useState<boolean | null>(null); // null = checking, true = connected, false = disconnected
  const [snowflakeStatus, setSnowflakeStatus] = useState<{
    connected: boolean;
    warning: boolean;
    troubleshooting: string[] | null;
    consecutive_failures: number;
  } | null>(null);
  const [showConnectionWarning, setShowConnectionWarning] = useState(false);
  const [demoInstallStatus, setDemoInstallStatus] = useState<'idle' | 'installing' | 'done' | 'error'>('idle');
  const [demoInstallReport, setDemoInstallReport] = useState<any | null>(null);
  const [sfRoles, setSfRoles] = useState<string[]>([]);
  const [sfCurrentRole, setSfCurrentRole] = useState<string>('');
  const [sfRoleLoading, setSfRoleLoading] = useState(false);
  const [sfRoleVersion, setSfRoleVersion] = useState(0);
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
  const workspaceMenuRef = useRef<HTMLDivElement | null>(null);
  
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

  // Poll Snowflake connection status from backend monitor
  useEffect(() => {
    const checkSnowflakeStatus = async () => {
      try {
        const response = await fetch('http://localhost:8000/connection/status', {
          method: 'GET',
          signal: AbortSignal.timeout(5000)
        });
        if (response.ok) {
          const status = await response.json();
          setSnowflakeStatus(status);
          // Show warning popup if there's a warning and we haven't dismissed it
          if (status.warning && !status.connected) {
            setShowConnectionWarning(true);
          }
        }
      } catch {
        // Backend might not be up yet, ignore
      }
    };
    
    // Check after a short delay (let backend start)
    const initialTimeout = setTimeout(checkSnowflakeStatus, 3000);
    
    // Check every 15 seconds
    const interval = setInterval(checkSnowflakeStatus, 15000);
    
    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, []);

  // Retry Snowflake connection
  const retrySnowflakeConnection = async () => {
    try {
      const response = await fetch('http://localhost:8000/connection/retry', {
        method: 'POST',
        signal: AbortSignal.timeout(30000)
      });
      const result = await response.json();
      if (result.success) {
        setShowConnectionWarning(false);
        showToast('Snowflake connection restored!', 'success');
        // Refresh status
        const statusResponse = await fetch('http://localhost:8000/connection/status');
        if (statusResponse.ok) {
          setSnowflakeStatus(await statusResponse.json());
        }
      } else {
        showToast('Connection retry failed. See troubleshooting steps.', 'error');
      }
    } catch (e) {
      showToast('Failed to retry connection', 'error');
    }
  };

  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateCategory, setTemplateCategory] = useState('analytics');
  const [templateComplexity, setTemplateComplexity] = useState('medium');
  const [sections, setSections] = useState<SectionState>({ data: true, semantic: false, agent: true, external: true, migration: false, output: true, utils: false });
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'error' | 'success'; dismissible?: boolean } | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const [componentSearch, setComponentSearch] = useState('');
  const [sidebarMode, setSidebarMode] = useState<'components' | 'catalog' | 'templates'>('components');
  // showPreview removed - chat panel always visible
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
  const [showRawJson, setShowRawJson] = useState(false); // Toggle for raw JSON view in results
  const [sidebarWidth, setSidebarWidth] = useState(280); // Default sidebar width in pixels
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [canvasView, setCanvasView] = useState<'graph' | 'stack'>('graph');
  const [hasUserEdited, setHasUserEdited] = useState(false);
  const hasUserEditedRef = useRef(false);
  const [showRunModal, setShowRunModal] = useState(false);
  const [runModalPrompt, setRunModalPrompt] = useState('');
  const [currentRunningPrompt, setCurrentRunningPrompt] = useState('');
  const blockedDndToastAtRef = useRef<number>(0);
  // Selection: left-click drag to box-select (when unlocked). Cmd/Ctrl+click to add to selection.
  const [cortexModels, setCortexModels] = useState<Array<{ id: string; label?: string; provider?: string; available?: boolean | null }>>([]);
  const [cortexModelsRefreshing, setCortexModelsRefreshing] = useState(false);
  const [cortexModelProbe, setCortexModelProbe] = useState(false);
  const [cortexCrossRegion, setCortexCrossRegion] = useState(false);

  // Note: Selection is handled by ReactFlow - left-drag to box-select, Cmd/Ctrl+click to multi-select

  // Fetch Cortex model list (best-effort). Falls back to static dropdown options if unavailable.
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const res = await axios.get('http://localhost:8000/cortex/models');
        if (Array.isArray(res.data?.models)) {
          setCortexModels(res.data.models);
        }
      } catch {
        // Ignore - UI will use static list
      }
    };
    fetchModels();
  }, []);

  const refreshCortexModels = useCallback(async (opts: { probe: boolean; crossRegion: boolean; forceRefresh?: boolean }) => {
    setCortexModelsRefreshing(true);
    try {
      const res = await axios.get('http://localhost:8000/cortex/models', {
        params: {
          probe: !!opts.probe,
          force_refresh: opts.forceRefresh !== false,
          cross_region: !!opts.crossRegion,
        },
      });
      if (Array.isArray(res.data?.models)) {
        setCortexModels(res.data.models);
      }
    } catch {
      // ignore; UI falls back
    } finally {
      setCortexModelsRefreshing(false);
    }
  }, []);

  const markUserEdited = useCallback(() => {
    if (hasUserEditedRef.current) return;
    hasUserEditedRef.current = true;
    setHasUserEdited(true);
  }, []);

  // Theme (system/light/dark)
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => getStoredTheme());
  const resolvedTheme = themeMode;

  const toggleTheme = useCallback(() => {
    const next: ThemeMode = themeMode === 'dark' ? 'light' : 'dark';
    setThemeMode(next);
  }, [themeMode]);

  useEffect(() => {
    // Keep class in sync if themeMode is modified elsewhere
    setTheme(themeMode);
  }, [themeMode]);
  
  // Sidebar resize handlers
  const handleSidebarResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingSidebar(true);
    
    const startX = e.clientX;
    const startWidth = sidebarWidth;
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const newWidth = Math.max(200, Math.min(500, startWidth + delta)); // Min 200px, Max 500px
      setSidebarWidth(newWidth);
    };
    
    const handleMouseUp = () => {
      setIsResizingSidebar(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [sidebarWidth]);

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
    const isWarning = message.trim().startsWith('⚠️');
    const durationMs = isWarning ? 12000 : type === 'error' ? 9000 : type === 'success' ? 5000 : 9000;
    const dismissible = isWarning || type === 'error';

    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }

    setToast({ message, type, dismissible });
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, durationMs);
  };

  // Snowflake role switching (best-effort)
  const fetchSnowflakeRoles = useCallback(async () => {
    try {
      const res = await axios.get('http://localhost:8000/snowflake/roles');
      const roles = Array.isArray(res.data?.roles) ? res.data.roles : [];
      setSfRoles(roles);
      const current = typeof res.data?.current_role === 'string' ? res.data.current_role : '';
      const fallback = typeof res.data?.default_role === 'string' ? res.data.default_role : '';
      setSfCurrentRole(current || fallback || '');
    } catch {
      // Ignore; role switching is optional UX
      setSfRoles([]);
    }
  }, []);

  useEffect(() => {
    if (backendConnected === false) return;
    fetchSnowflakeRoles();
  }, [backendConnected, fetchSnowflakeRoles]);

  const switchSnowflakeRole = useCallback(async (role: string) => {
    const next = (role || '').trim();
    if (!next) return;
    setSfRoleLoading(true);
    try {
      const res = await axios.post('http://localhost:8000/snowflake/role', { role: next });
      const current = typeof res.data?.current_role === 'string' ? res.data.current_role : next;
      setSfCurrentRole(current);
      setSfRoleVersion((v) => v + 1);
      showToast(`Role set to ${current}`, 'success');
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Failed to switch role';
      showToast(String(msg).slice(0, 160), 'error');
    } finally {
      setSfRoleLoading(false);
    }
  }, [showToast]);

  // Close workspace menu on outside click / Esc
  useEffect(() => {
    if (!showWorkspaceMenu) return;
    const onMouseDown = (e: MouseEvent) => {
      const el = workspaceMenuRef.current;
      if (!el) return;
      if (e.target instanceof Node && el.contains(e.target)) return;
      setShowWorkspaceMenu(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowWorkspaceMenu(false);
    };
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [showWorkspaceMenu]);

  const installDemoAssets = useCallback(async () => {
    if (demoInstallStatus === 'done' && demoInstallReport) {
      // Re-click = show the latest report modal
      setShowLoadModal(false); // ensure other modals don't overlap
      setShowSaveModal(false);
      setShowRunModal(false);
      showToast('Showing latest demo install report', 'info');
      return;
    }
    if (backendConnected === false) {
      showToast('Backend not connected — cannot install demo assets', 'error');
      return;
    }
    if (demoInstallStatus === 'installing') return;

    setDemoInstallStatus('installing');
    setDemoInstallReport(null);
    showToast('Installing demo assets into Snowflake…', 'info');
    try {
      const res = await fetch('http://localhost:8000/demo-assets/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ demo_database: 'SNOWFLOW_DEMO', overwrite_tables: false, upload_yaml: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        const msg = data?.detail || data?.error || 'Install failed';
        setDemoInstallReport(data);
        setDemoInstallStatus('error');
        showToast(`Demo install failed: ${String(msg).slice(0, 140)}`, 'error');
        return;
      }
      setDemoInstallStatus('done');
      setDemoInstallReport(data);
      const warnCount = Array.isArray(data?.warnings) ? data.warnings.length : 0;
      showToast(warnCount > 0 ? `Demo assets installed (with ${warnCount} warnings)` : 'Demo assets installed!', 'success');
    } catch (e: any) {
      setDemoInstallStatus('error');
      setDemoInstallReport({ error: String(e?.message || e) });
      showToast(`Demo install failed: ${String(e?.message || e).slice(0, 140)}`, 'error');
    }
  }, [backendConnected, demoInstallStatus]);

  const hasSemanticUpstream = useCallback((targetNodeId: string) => {
    const byId = new Map(nodes.map(n => [n.id, n]));
    const incomingByTarget = new Map<string, string[]>();
    for (const e of edges) {
      if (!incomingByTarget.has(e.target)) incomingByTarget.set(e.target, []);
      incomingByTarget.get(e.target)!.push(e.source);
    }
    const visited = new Set<string>();
    const queue: string[] = [targetNodeId];
    while (queue.length) {
      const cur = queue.shift()!;
      if (visited.has(cur)) continue;
      visited.add(cur);
      const incoming = incomingByTarget.get(cur) || [];
      for (const srcId of incoming) {
        const src = byId.get(srcId);
        if (!src) continue;
        if (src.type === 'semanticModel') return true;
        queue.push(srcId);
      }
      if (visited.size > 100) break;
    }
    return false;
  }, [nodes, edges]);

  // Centralized connection rules + hints.
  // Any hint starting with "⚠️" is treated as a universal "risky edge" indicator.
  const validConnections: Record<string, string[]> = useMemo(() => ({
    'snowflakeSource': ['semanticModel', 'agent', 'cortex', 'router', 'supervisor', 'externalAgent'],  // Semantic Model (recommended) OR advanced paths (warn)
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
  }), []);

  const connectionHints: Record<string, Record<string, string>> = useMemo(() => ({
      'snowflakeSource': {
        'semanticModel': '✓ Data Source → Semantic Model (recommended)',
      'agent': '⚠️ Data Source → Agent without Semantic Model (quality may be lower)',
        'cortex': '⚠️ Direct to Cortex - no semantic context (accuracy may vary)',
        'router': '⚠️ Data Source → Router without Semantic Model (quality may be lower)',
        'supervisor': '⚠️ Data Source → Supervisor without Semantic Model (quality may be lower)',
        'externalAgent': '⚠️ Data Source → External Agent without Semantic Model (guardrails may be lower)',
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
  }), []);

  const edgesWithQualityHints = useMemo(() => {
    const byId = new Map(nodes.map(n => [n.id, n]));
    return edges.map((e) => {
      const sType = byId.get(e.source)?.type;
      const tType = byId.get(e.target)?.type;

      // Universal "risky edge" rule:
      // Any connection whose hint begins with "⚠️" is treated as risky and gets amber dashed styling + click toast.
      const hint = (sType && tType) ? connectionHints[sType]?.[tType] : undefined;
      const isRisky = Boolean(hint && String(hint).trim().startsWith('⚠️'));
      if (!isRisky) return e;

      // Optional de-noising: make the message specific when an alternate semantic path exists.
      const semanticAlt = (sType === 'snowflakeSource' && tType === 'agent') ? hasSemanticUpstream(e.target) : false;
      const msg = semanticAlt
        ? '⚠️ This edge bypasses the Semantic Model while an alternate semantic path exists. For best NL→SQL accuracy, route through a Semantic Model.'
        : String(hint);

      return {
        ...e,
        data: {
          ...(e as any).data,
          qualityWarning: msg,
        },
        // IMPORTANT:
        // Many edges already carry inline style.stroke (e.g. '#29B5E8') from previous defaults.
        // Inline styles beat CSS, so we explicitly override stroke + dash for risky edges here.
        // We do NOT set strokeWidth so hover/selected thickening still works via CSS.
        style: (() => {
          const prev = (e.style || {}) as Record<string, any>;
          // Drop strokeWidth if present so CSS can control thickening.
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { strokeWidth, ...rest } = prev;
          return {
            ...rest,
            stroke: 'rgb(var(--edge-active))',
            strokeDasharray: '6 4',
          };
        })(),
      };
    });
  }, [edges, nodes, hasSemanticUpstream, connectionHints]);

  // Connection validation rules - Snowflake Intelligence Architecture
  // Recommended: Data Sources → Semantic Model → Cortex Agent (with Analyst as tool) → Output
  // Advanced (⚠️): allowed, but lower-confidence / less guided paths.
  //
  // IMPORTANT: Any connection hint that starts with "⚠️" is treated as a "risky edge" and will be styled
  // (amber dashed) in the canvas + will show the hint toast when clicked. This makes the warning system universal
  // as we add/relax connection rules over time.
  const isValidConnection = useCallback((connection: { source: string | null; target: string | null }) => {
    if (!connection.source || !connection.target) return false;
    
    const sourceNode = nodes.find(n => n.id === connection.source);
    const targetNode = nodes.find(n => n.id === connection.target);
    
    if (!sourceNode || !targetNode) return false;

    const sourceType = sourceNode.type || '';
    const targetType = targetNode.type || '';

    const allowed = validConnections[sourceType] || [];
    const isValid = allowed.includes(targetType);

    if (isValid) {
      // Show helpful hint
      const hint = connectionHints[sourceType]?.[targetType];
      if (hint) {
        const toastType = hint.trim().startsWith('⚠️') ? 'info' : 'success';
        showToast(hint, toastType);
      }
    } else {
      // Show error with guidance
      const errorMessages: Record<string, string> = {
        'output': 'Output is terminal - nothing connects from it',
        'semanticModel': 'Semantic Model connects to Agent or Supervisor',
        'snowflakeSource': 'Data Source → Semantic Model (recommended), or Agent/Cortex (advanced)',
        'agent': 'Agent connects to Output, Cortex, Condition, or External API',
        'externalAgent': 'External API connects to Agent or Output',
      };
      
      const guidance = errorMessages[sourceType] || `Cannot connect ${sourceType} to ${targetType}`;
      showToast(guidance, 'error');
    }

    return isValid;
  }, [nodes, validConnections, connectionHints]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (isProductionMode) {
      e.dataTransfer.dropEffect = 'none';
      const now = Date.now();
      if (now - blockedDndToastAtRef.current > 1500) {
        blockedDndToastAtRef.current = now;
        showToast('Preview mode is locked — click the lock icon to edit', 'info');
      }
      return;
    }
    e.dataTransfer.dropEffect = 'move';
  }, [isProductionMode]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (isProductionMode) {
      const now = Date.now();
      if (now - blockedDndToastAtRef.current > 1500) {
        blockedDndToastAtRef.current = now;
        showToast('Unlock the canvas (lock icon) to add nodes', 'info');
      }
      return;
    }
    markUserEdited();
    const typeData = e.dataTransfer.getData('application/reactflow');
    if (!typeData || !reactFlowWrapper.current) return;

    // Convert from screen coords → canvas coords (accounts for pan/zoom)
    const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    // Offset so the cursor lands near the node header (more natural than top-left)
    const position = { x: flowPos.x - 110, y: flowPos.y - 40 };

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
      data = { label: 'Output', outputType: 'display', channel: 'snowflake_intelligence' };
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
        data = { label: 'Custom API', agentType: 'rest', endpoint: '', method: 'POST', authType: 'none', provider: '' };
      }
    } else if (type === 'semanticModel') {
      // Check if dropped from Data Catalog with semantic data
      const semanticDataStr = e.dataTransfer.getData('semanticData');
      if (semanticDataStr) {
        try {
          const semanticData = JSON.parse(semanticDataStr);
          data = {
            label: semanticData.label || 'Semantic Model',
            database: semanticData.database || 'SNOWFLOW_DEV',
            schema: semanticData.schema || 'DEMO',
            stage: semanticData.stage || '',
            yamlFile: semanticData.yamlFile || '',
            semanticPath: semanticData.semanticPath || '',
          };
        } catch {
      data = { label: 'My Semantic Model', database: 'SNOWFLOW_DEV', schema: 'DEMO', stage: '', yamlFile: '' };
        }
      } else {
        data = { label: 'My Semantic Model', database: 'SNOWFLOW_DEV', schema: 'DEMO', stage: '', yamlFile: '' };
      }
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
        aggregationMethod: 'merge',
        maxDelegations: 5,
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
  }, [addNode, isProductionMode, markUserEdited, screenToFlowPosition]);

  const handleNodesChange: typeof onNodesChange = useCallback((changes) => {
    markUserEdited();
    onNodesChange(changes);
  }, [markUserEdited, onNodesChange]);

  const handleEdgesChange: typeof onEdgesChange = useCallback((changes) => {
    markUserEdited();
    onEdgesChange(changes);
  }, [markUserEdited, onEdgesChange]);

  const handleConnect: typeof onConnect = useCallback((connection) => {
    markUserEdited();
    onConnect(connection);
  }, [markUserEdited, onConnect]);

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    // Position panel near the click, offset slightly to the right
    const x = Math.min(event.clientX + 20, window.innerWidth - 450);
    const y = Math.max(event.clientY - 50, 80);
    setPanelPosition({ x, y });
    setSelectedNode(node);
  }, [setSelectedNode]);

  const openNodeById = useCallback((nodeId: string, anchorEl?: HTMLElement | null) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const rect = anchorEl?.getBoundingClientRect?.();
    const baseX = rect ? rect.left + 24 : 24;
    const baseY = rect ? rect.top + 120 : 120;
    const x = Math.min(baseX + sidebarWidth + 20, window.innerWidth - 450);
    const y = Math.max(baseY - 40, 80);
    setPanelPosition({ x, y });
    setSelectedNode(node);
  }, [nodes, sidebarWidth, setSelectedNode]);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, [setSelectedNode]);

  const runWorkflow = async (prompt?: string, _skipNameCheck?: boolean) => {
    // Name check disabled temporarily - was causing blank page
    // TODO: Re-enable after debugging
    // const currentName = useFlowStore.getState().workflowName;
    // if (!skipNameCheck && !currentName.trim()) {
    //   setPendingRunPrompt(prompt);
    //   setShowNamePrompt(true);
    //   return;
    // }
    
    // Pre-run validation
    if (nodes.length === 0) {
      showToast('Add at least one node to run', 'error');
      return;
    }
    
    // CRITICAL: Require at least one output node (flow must be complete)
    const outputNodes = nodes.filter(n => n.type === 'output');
    if (outputNodes.length === 0) {
      showToast('Complete your flow setup first - no output node found', 'error');
      setExecStatus('idle');
      return;
    }
    
    // Check for disconnected output nodes
    for (const outNode of outputNodes) {
      const hasInput = edges.some(e => e.target === outNode.id);
      if (!hasInput) {
        showToast(`Output "${outNode.data.label}" has no input - complete setup first`, 'error');
        setExecStatus('idle');
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

    // Warning: Data Source → Agent without Semantic Model
    const agentNodes = nodes.filter(n => n.type === 'agent');
    if (agentNodes.length > 0 && semanticNodes.length === 0 && dataNodes.length > 0) {
      const directDataToAgent = edges.some(e => {
        const sourceNode = nodes.find(n => n.id === e.source);
        const targetNode = nodes.find(n => n.id === e.target);
        return sourceNode?.type === 'snowflakeSource' && targetNode?.type === 'agent';
      });
      if (directDataToAgent) {
        showToast('⚠️ Running Data → Agent without a Semantic Model. For NL→SQL, add a Semantic Model for best accuracy.', 'info');
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

    // PRE-FLIGHT VALIDATION: Check backend before running
    setExecStatus('validating' as ExecutionStatus);
    try {
      const validationRes = await fetch('http://localhost:8000/workflow/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes, edges, prompt: prompt || undefined })
      });
      
      if (validationRes.ok) {
        const validation = await validationRes.json();
        setValidationResult(validation);
        
        // Block on errors - show detailed validation panel
        if (!validation.valid) {
          setPendingValidationPrompt(prompt);
          setShowValidationPanel(true);
          setExecStatus('idle');
          return;
        }
        
        // Show warnings as toasts but don't block
        if (validation.warnings && validation.warnings.length > 0) {
          // Show first warning as toast, rest in console
          showToast(`⚠️ ${validation.warnings[0].message}`, 'info');
          if (validation.warnings.length > 1) {
            console.log('[PREFLIGHT] Additional warnings:', validation.warnings.slice(1));
          }
        }
        
        // Show info messages
        if (validation.info && validation.info.length > 0) {
          console.log('[PREFLIGHT] Info:', validation.info);
        }
        
        console.log('[PREFLIGHT] Validation passed:', validation.summary);
      } else {
        // Validation endpoint failed - continue anyway but warn
        console.warn('[PREFLIGHT] Validation endpoint failed, continuing...');
      }
    } catch (valErr) {
      // Validation call failed - continue anyway (endpoint might not exist in old backends)
      console.warn('[PREFLIGHT] Validation failed, continuing:', valErr);
    }

    setExecStatus('running');
    setExecResult(null);
    setActiveNodes(new Set());
    setCompletedNodes(new Set());
    setSimulatedNodes(new Set());
    setIsProductionMode(true); // Lock canvas during execution
    setCurrentRunningPrompt(prompt || ''); // Track what query is running
    
    const executionStartTime = Date.now(); // Track execution time for history
    
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
              
              // DEBUG: Log the complete event data
              console.log('[COMPLETE] Full eventData:', eventData);
              console.log('[COMPLETE] eventData.results type:', typeof eventData.results);
              console.log('[COMPLETE] eventData.results:', JSON.stringify(eventData.results, null, 2));
              console.log('[COMPLETE] agent_response:', eventData.results?.agent_response);
              
              const newResult = {
                status: 'completed',
                messages: eventData.messages,
                results: eventData.results || {},
                executed_nodes: eventData.executed_nodes,
                simulated_nodes: eventData.simulated_nodes,
                user_prompt: prompt // Store the prompt with result
              };
              setExecResult(newResult);
              
              // Add to execution history
              const historyEntry: ExecutionHistoryEntry = {
                id: `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                prompt: prompt || 'Unknown query',
                result: newResult,
                timestamp: new Date(),
                executionTimeMs: Date.now() - executionStartTime
              };
              setExecutionHistory(prev => [historyEntry, ...prev]); // Newest first
              setSelectedHistoryId(historyEntry.id);
              
              setExecStatus('success');
              setActiveNodes(new Set());
              setExecutionPhase('');
              setIsProductionMode(false); // Unlock canvas after successful execution
              setCurrentRunningPrompt(''); // Clear running prompt
              showToast('Workflow completed!', 'success');
            } else if (eventData.type === 'error') {
              // Handle specific error types
              const errorMsg = eventData.error || 'Unknown error';
              const isAuthError = eventData.auth_error || errorMsg.includes('Authentication') || errorMsg.includes('expired');
              
              setExecStatus('error');
              setActiveNodes(new Set());
              setExecutionPhase('');
              setIsProductionMode(false); // Unlock canvas after error
              setCurrentRunningPrompt(''); // Clear running prompt
              
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
      setIsProductionMode(false); // Unlock canvas after catch error
      setCurrentRunningPrompt(''); // Clear running prompt
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
      const trimmedName = (workflowName || '').trim();
      if (!trimmedName) {
        showToast('Please name the workflow before saving', 'error');
        workflowNameInputRef.current?.focus();
        return;
      }

      if (saveAsTemplate) {
        // Save as template to Snowflake
        await axios.post('http://localhost:8000/templates', { 
          name: trimmedName, 
          description: workflowDescription,
          category: templateCategory,
          complexity: templateComplexity,
          nodes, 
          edges 
        });
        showToast(`Template "${trimmedName}" saved to Snowflake!`, 'success');
      } else {
        // Save as regular workflow
        await axios.post('http://localhost:8000/workflow/save', { name: trimmedName, nodes, edges });
        showToast(`Workflow "${trimmedName}" saved!`, 'success');
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
      name: (workflowName || '').trim() || 'Untitled Workflow',
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
  
  // (Intentionally no "reset all localStorage" control here; workflows use explicit New/Clear actions.)

  return (
      <div style={{ 
      width: '100vw', 
      height: '100vh', 
      display: 'flex', 
      fontFamily: 'Inter, -apple-system, sans-serif',
      background: 'rgb(var(--bg))',
      color: 'rgb(var(--fg))',
    }}>
      {/* Sidebar - Snowflake Style (Resizable) */}
      <div style={{ 
        width: sidebarWidth, 
        minWidth: 200,
        maxWidth: 500,
        background: 'rgb(var(--surface))', 
        borderRight: 'none',
        padding: 0,
        display: 'flex', 
        flexDirection: 'column',
        position: 'relative',
        flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{ padding: '10px 12px', borderBottom: '1px solid rgb(var(--border))' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <Sparkles size={20} color="#29B5E8" />
              <span style={{ color: 'rgb(var(--fg))', fontSize: 15, fontWeight: 650, letterSpacing: 0.2 }}>SnowFlow</span>
            </div>

            {/* Compact workspace controls (Role + Theme) */}
            <div ref={workspaceMenuRef} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <button
                onClick={() => setShowWorkspaceMenu((v) => !v)}
                title="Workspace settings (Role, Theme)"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  height: 30,
                  padding: '0 10px',
                  borderRadius: 10,
                  border: '1px solid rgb(var(--border))',
                  background: 'rgb(var(--surface-2))',
                  color: 'rgb(var(--fg))',
                  cursor: 'pointer',
                  userSelect: 'none',
                  maxWidth: 200,
                }}
                onMouseOver={(e) => { e.currentTarget.style.borderColor = 'rgb(var(--border-strong))'; e.currentTarget.style.background = 'rgb(var(--surface-3))'; }}
                onMouseOut={(e) => { e.currentTarget.style.borderColor = 'rgb(var(--border))'; e.currentTarget.style.background = 'rgb(var(--surface-2))'; }}
                aria-label="Workspace settings"
              >
                <Shield size={14} />
                <span style={{
                  fontSize: 12,
                  color: 'rgb(var(--fg-muted))',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: 140,
                }}>
                  {sfCurrentRole || 'Role'}
                </span>
                <ChevronDown size={14} />
              </button>

              {showWorkspaceMenu && (
                <div
                  style={{
                    position: 'absolute',
                    top: 36,
                    right: 0,
                    width: 260,
                    padding: 10,
                    borderRadius: 12,
                    border: '1px solid rgb(var(--border-strong))',
                    background: 'rgb(var(--surface))',
                    boxShadow: '0 10px 28px rgba(0,0,0,0.28)',
                    zIndex: 50,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 650, color: 'rgb(var(--fg))' }}>Workspace</div>
                    <button
                      onClick={() => setShowWorkspaceMenu(false)}
                      title="Close"
                      style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'rgb(var(--muted))', padding: 2 }}
                    >
                      <X size={14} />
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 10, color: 'rgb(var(--muted))', marginBottom: 6 }}>Snowflake Role</div>
                      <select
                        value={sfCurrentRole}
                        disabled={sfRoleLoading || sfRoles.length === 0}
                        onChange={(e) => switchSnowflakeRole(e.target.value)}
                        title={sfRoles.length ? 'Choose Snowflake role for browsing/installing assets' : 'Role switching unavailable (backend offline or no roles)'}
                        style={{
                          width: '100%',
                          height: 34,
                          padding: '0 10px',
                          borderRadius: 10,
                          border: '1px solid rgb(var(--border))',
                          background: 'rgb(var(--surface-2))',
                          color: 'rgb(var(--fg))',
                          fontSize: 12,
                          cursor: (sfRoleLoading || sfRoles.length === 0) ? 'not-allowed' : 'pointer',
                          outline: 'none',
                        }}
                      >
                        {sfRoles.length === 0 ? (
                          <option value={sfCurrentRole || ''}>{sfCurrentRole ? sfCurrentRole : '—'}</option>
                        ) : (
                          sfRoles.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))
                        )}
                      </select>
                      <div style={{ marginTop: 6, fontSize: 10, color: 'rgb(var(--muted))', lineHeight: 1.3 }}>
                        Changes what databases/models you can browse and where demo assets install.
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: 10, color: 'rgb(var(--muted))' }}>Theme</div>
                      <button
                        onClick={toggleTheme}
                        title={`Theme: ${themeMode === 'dark' ? 'Dark' : 'Light'} (click to toggle)`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 40,
                          height: 34,
                          borderRadius: 10,
                          border: '1px solid rgb(var(--border))',
                          background: 'rgb(var(--surface-2))',
                          color: 'rgb(var(--fg))',
                          cursor: 'pointer',
                        }}
                        onMouseOver={(e) => { e.currentTarget.style.borderColor = 'rgb(var(--border-strong))'; e.currentTarget.style.background = 'rgb(var(--surface-3))'; }}
                        onMouseOut={(e) => { e.currentTarget.style.borderColor = 'rgb(var(--border))'; e.currentTarget.style.background = 'rgb(var(--surface-2))'; }}
                        aria-label="Toggle theme"
                      >
                        {resolvedTheme === 'dark' ? (
                          <Moon size={16} />
                        ) : (
                          <Sun size={16} />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* View toggle (Graph vs Guided Stack) */}
        <div style={{ padding: '10px 12px', borderBottom: '1px solid rgb(var(--border))' }}>
          <div
            style={{
              display: 'flex',
              gap: 4,
              background: 'rgb(var(--surface-3))',
              border: '1px solid rgb(var(--border))',
              borderRadius: 12,
              padding: 3,
            }}
          >
            <button
              onClick={() => setCanvasView('graph')}
              style={{
                flex: 1,
                padding: '8px 10px',
                border: 'none',
                borderRadius: 10,
                cursor: 'pointer',
                background: canvasView === 'graph' ? 'rgb(var(--surface))' : 'transparent',
                color: canvasView === 'graph' ? 'rgb(var(--fg))' : 'rgb(var(--muted))',
                fontSize: 12,
                fontWeight: 700,
                boxShadow: canvasView === 'graph' ? '0 1px 2px rgba(0,0,0,0.25)' : 'none',
              }}
              title="Graph canvas (power user)"
            >
              Graph
            </button>
            <button
              onClick={() => setCanvasView('stack')}
              style={{
                flex: 1,
                padding: '8px 10px',
                border: 'none',
                borderRadius: 10,
                cursor: 'pointer',
                background: canvasView === 'stack' ? 'rgb(var(--surface))' : 'transparent',
                color: canvasView === 'stack' ? 'rgb(var(--fg))' : 'rgb(var(--muted))',
                fontSize: 12,
                fontWeight: 700,
                boxShadow: canvasView === 'stack' ? '0 1px 2px rgba(0,0,0,0.25)' : 'none',
              }}
              title="Guided Stack (onboarding)"
            >
              Guided
            </button>
          </div>
          <div style={{ marginTop: 8, fontSize: 10, color: 'rgb(var(--muted))', lineHeight: 1.3 }}>
            Guided is a click-to-configure onboarding view. Both modes run the same workflow.
          </div>
        </div>

        {/* File Actions Bar - Clean Snowflake Style */}
        <div style={{ padding: '10px 12px', borderBottom: '1px solid rgb(var(--border))', background: 'rgb(var(--surface))' }}>
          {/* Primary Actions Row */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            {/* New Workflow Button - Primary Action */}
            <button 
              onClick={() => {
                if (nodes.length > 0 && !window.confirm('Create new workflow? Unsaved changes will be lost.')) return;
                clearWorkflow();
                setWorkflowName('');
                hasUserEditedRef.current = false;
                setHasUserEdited(false);
                showToast('New workflow created', 'success');
              }}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '8px 12px',
                background: 'linear-gradient(135deg, #29B5E8 0%, #0EA5E9 100%)',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
              onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <FileText size={14} />
              New
            </button>

            {/* Open Button */}
            <button 
              onClick={loadWorkflowList}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '8px 12px',
                background: 'rgb(var(--surface-2))',
                color: 'rgb(var(--fg-muted))',
                border: '1px solid rgb(var(--border))',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseOver={(e) => { e.currentTarget.style.background = 'rgb(var(--surface-3))'; e.currentTarget.style.borderColor = 'rgb(var(--border-strong))'; }}
              onMouseOut={(e) => { e.currentTarget.style.background = 'rgb(var(--surface-2))'; e.currentTarget.style.borderColor = 'rgb(var(--border))'; }}
              title="Open saved workflow"
            >
              <FolderOpen size={14} />
              Open
            </button>

            {/* Save Button */}
            <button 
              onClick={() => setShowSaveModal(true)}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '8px 12px',
                background: 'rgb(var(--surface-2))',
                color: 'rgb(var(--fg-muted))',
                border: '1px solid rgb(var(--border))',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseOver={(e) => { e.currentTarget.style.background = 'rgb(var(--surface-3))'; e.currentTarget.style.borderColor = 'rgb(var(--border-strong))'; }}
              onMouseOut={(e) => { e.currentTarget.style.background = 'rgb(var(--surface-2))'; e.currentTarget.style.borderColor = 'rgb(var(--border))'; }}
              title="Save workflow"
            >
              <Save size={14} />
              Save
            </button>
          </div>

          {/* Workflow Name Input */}
          <div style={{ position: 'relative', marginBottom: 8 }}>
          <input
              ref={workflowNameInputRef}
            value={workflowName}
            onChange={(e) => setWorkflowName(e.target.value)}
              placeholder="Name this workflow…"
          style={{
              width: '100%', 
                padding: '8px 10px', 
                paddingRight: 32,
                border: '1px solid rgb(var(--border))', 
                borderRadius: 6, 
                fontSize: 13,
              fontWeight: 500,
                color: 'rgb(var(--fg))',
                boxSizing: 'border-box',
                background: 'rgb(var(--surface))',
                outline: hasUserEdited && !workflowName.trim() ? '2px solid rgb(var(--ring))' : 'none',
                outlineOffset: 1,
              }}
            />
            <span style={{ 
              position: 'absolute', 
              right: 10, 
              top: '50%', 
              transform: 'translateY(-50%)',
              color: 'rgb(var(--muted))',
              fontSize: 10,
            }}>
              <Pencil size={12} />
            </span>
          </div>

          {/* Subtle autosave / naming nudge (only after first edit) */}
          {hasUserEdited && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: -2, marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: 'rgb(var(--fg-muted))' }}>
                {!workflowName.trim() ? (
                  <span><strong style={{ color: 'rgb(var(--fg))', fontWeight: 600 }}>Tip:</strong> add a name to save it</span>
                ) : (
                  <span>Ready to save</span>
                )}
              </div>
              <div style={{ fontSize: 11, color: 'rgb(var(--muted))', display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle size={12} />
                <span title={lastAutosavedAt ? new Date(lastAutosavedAt).toLocaleString() : undefined}>
                  Draft autosaved
                </span>
              </div>
            </div>
          )}

          {/* Secondary Actions Row */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {/* Import/Export Group */}
            <div style={{ display: 'flex', gap: 2 }}>
              <button 
                onClick={() => fileInputRef.current?.click()}
                style={{
                  padding: '6px 10px',
                  background: 'rgb(var(--surface-2))',
                  color: 'rgb(var(--fg-muted))',
                  border: '1px solid rgb(var(--border))',
                  borderRadius: '6px 0 0 6px',
                  fontSize: 10,
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  transition: 'all 0.15s ease',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = 'rgb(var(--surface-3))';
                  e.currentTarget.style.borderColor = 'rgb(var(--border-strong))';
                  e.currentTarget.style.color = 'rgb(var(--fg))';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'rgb(var(--surface-2))';
                  e.currentTarget.style.borderColor = 'rgb(var(--border))';
                  e.currentTarget.style.color = 'rgb(var(--fg-muted))';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
                onMouseDown={(e) => { e.currentTarget.style.transform = 'translateY(1px)'; }}
                onMouseUp={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
                title="Import from JSON file"
              >
                <Upload size={12} />
                Import
            </button>
              <button 
                onClick={exportWorkflow}
                style={{
                  padding: '6px 10px',
                  background: 'rgb(var(--surface-2))',
                  color: 'rgb(var(--fg-muted))',
                  border: '1px solid rgb(var(--border))',
                  borderLeft: 'none',
                  borderRadius: '0 6px 6px 0',
                  fontSize: 10,
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  transition: 'all 0.15s ease',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = 'rgb(var(--surface-3))';
                  e.currentTarget.style.borderColor = 'rgb(var(--border-strong))';
                  e.currentTarget.style.color = 'rgb(var(--fg))';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'rgb(var(--surface-2))';
                  e.currentTarget.style.borderColor = 'rgb(var(--border))';
                  e.currentTarget.style.color = 'rgb(var(--fg-muted))';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
                onMouseDown={(e) => { e.currentTarget.style.transform = 'translateY(1px)'; }}
                onMouseUp={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
                title="Export to JSON file"
              >
              <Download size={12} />
                Export
            </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.yaml,.yml"
              onChange={importWorkflow}
              style={{ display: 'none' }}
            />

            {/* Spacer */}
            <div style={{ flex: 1 }} />

            {/* Clear Canvas Button */}
            <button 
              onClick={() => {
                if (nodes.length === 0) return;
                if (window.confirm('Clear all nodes from canvas?')) {
                  clearWorkflow();
                  showToast('Canvas cleared', 'info');
                }
              }}
              disabled={nodes.length === 0}
              style={{
                padding: '6px 10px',
                background: nodes.length > 0 ? '#FEF2F2' : '#F9FAFB',
                color: nodes.length > 0 ? '#DC2626' : '#9CA3AF',
                border: `1px solid ${nodes.length > 0 ? '#FECACA' : '#E5E9F0'}`,
                borderRadius: 6,
                fontSize: 10,
                fontWeight: 500,
                cursor: nodes.length > 0 ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
              title="Clear canvas"
            >
              <X size={12} />
              Clear
            </button>

            {/* Node Count Badge */}
            <div style={{ 
              padding: '5px 10px', 
              background: nodes.length > 0 ? '#ECFDF5' : '#F9FAFB', 
              color: nodes.length > 0 ? '#059669' : '#9CA3AF',
              border: `1px solid ${nodes.length > 0 ? '#A7F3D0' : '#E5E9F0'}`,
              borderRadius: 6, 
              fontSize: 10, 
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}>
              <div style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: nodes.length > 0 ? '#10B981' : '#9CA3AF',
              }} />
              {nodes.length}
            </div>
          </div>
        </div>

        {/* Sidebar Mode Tabs */}
        <div style={{ 
          display: 'flex', 
          borderBottom: '1px solid rgb(var(--border))',
          padding: '0 8px',
          background: 'rgb(var(--surface))'
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
              color: sidebarMode === 'components' ? '#29B5E8' : 'rgb(var(--muted))',
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
              color: sidebarMode === 'catalog' ? '#29B5E8' : 'rgb(var(--muted))',
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
              color: sidebarMode === 'templates' ? '#29B5E8' : 'rgb(var(--muted))',
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

        {/* Sidebar Content Container - Scrollable */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0 }}>
        {/* Sidebar Content based on mode */}
        {sidebarMode === 'catalog' && (
          <DataCatalog 
            onSelectSource={(source) => {
              // Add data source node to canvas
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
            onSelectSemanticModel={(model) => {
              // Add semantic model node to canvas
              const newNode = {
                id: `node-${Date.now()}`,
                type: 'semanticModel',
                position: { x: 350, y: 150 + Math.random() * 100 },
                data: {
                  label: model.name.replace('.yaml', ''),
                  database: model.database,
                  schema: model.schema,
                  stage: model.stage,
                  yamlFile: model.name,
                  semanticPath: model.path,
                },
              };
              addNode(newNode);
              showToast(`Added semantic model ${model.name} to canvas`, 'success');
            }}
            roleVersion={sfRoleVersion}
          />
        )}

        {sidebarMode === 'templates' && (
          <Templates 
            onSelectTemplate={(templateId, nodes, edges) => {
              console.log('[TEMPLATE LOAD] Starting...', templateId);
              console.log('[TEMPLATE LOAD] Received nodes:', nodes?.length, 'edges:', edges?.length);
              
              let loadedNodes: any[] = [];
              let loadedEdges: any[] = [];
              let workflowTitle = templateId.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
              
              if (nodes && nodes.length > 0 && edges) {
                // Template with embedded nodes/edges
                console.log('[TEMPLATE] Using provided nodes:', nodes);
                loadedNodes = JSON.parse(JSON.stringify(nodes));
                loadedEdges = JSON.parse(JSON.stringify(edges));
              } else {
                // Fallback to hardcoded config
                const config = templateConfigs[templateId];
                console.log('[TEMPLATE] Falling back to config:', config);
                if (config && config.nodes) {
                  loadedNodes = JSON.parse(JSON.stringify(config.nodes));
                  loadedEdges = JSON.parse(JSON.stringify(config.edges));
                }
              }
              
              if (loadedNodes.length > 0) {
                console.log('[TEMPLATE] Setting workflow with', loadedNodes.length, 'nodes');
                setWorkflow(loadedNodes, loadedEdges, workflowTitle);
                showToast(`Template "${workflowTitle}" loaded with ${loadedNodes.length} nodes!`, 'success');
                
                // Force fitView after a short delay to ensure nodes are rendered
                  setTimeout(() => {
                    const fitViewBtn = document.querySelector('.react-flow__controls-fitview') as HTMLButtonElement;
                  if (fitViewBtn) {
                    console.log('[TEMPLATE] Triggering fitView');
                    fitViewBtn.click();
                }
                }, 200);
              } else {
                console.error('[TEMPLATE] No nodes to load for template:', templateId);
                showToast(`Template "${templateId}" has no nodes defined`, 'error');
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
                    border: '1px solid rgb(var(--border))',
                    borderRadius: 6,
                    fontSize: 11,
                    color: 'rgb(var(--fg))',
                    background: 'rgb(var(--surface-2))',
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
                  <div style={{ fontSize: 9, color: 'rgb(var(--muted))', padding: '6px 8px', background: 'rgb(var(--surface-2))', border: '1px solid rgb(var(--border))', borderRadius: 6, margin: '6px 8px 8px 8px' }}>
                    <div style={{ fontWeight: 600, marginBottom: 4, color: 'rgb(var(--fg-muted))' }}>Built-in Tools:</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <span>📊 <strong>Analyst</strong> - structured data (SQL)</span>
                      <span>🔍 <strong>Search</strong> - unstructured (vectors)</span>
                      <span>🔌 <strong>MCP</strong> - external tools</span>
                      <span>⚡ <strong>SQL</strong> - direct queries</span>
                    </div>
                    {customTools.length > 0 && (
                      <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid rgb(var(--border))' }}>
                        <div style={{ fontWeight: 600, marginBottom: 2, color: '#8B5CF6' }}>Custom Tools ({customTools.length}):</div>
                        {customTools.map(t => (
                          <span key={t.id}>🔧 <strong>{t.name}</strong></span>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={() => setShowToolCreator(true)}
                      style={{
                        marginTop: 8,
                        padding: '6px 8px',
                        border: '1px dashed #8B5CF6',
                        borderRadius: 6,
                        background: 'rgb(var(--surface-3))',
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
        </div>{/* End Sidebar Content Container */}

        {/* Run / Preview / Control Tower - Fixed at bottom */}
        <div style={{ padding: '8px 12px', flexShrink: 0, borderTop: '1px solid rgb(var(--border))' }}>
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

          {/* Demo Assets Installer */}
          <button
            onClick={installDemoAssets}
            disabled={backendConnected === false || demoInstallStatus === 'installing' || execStatus === 'running'}
            style={{
              width: '100%',
              marginBottom: 8,
              border: '1px solid rgb(var(--border-strong))',
              background: demoInstallStatus === 'done' ? 'rgba(16,185,129,0.18)' : demoInstallStatus === 'error' ? 'rgba(239,68,68,0.14)' : 'rgb(var(--surface-3))',
              color: 'rgb(var(--fg))',
              padding: '8px 10px',
              borderRadius: 6,
              cursor: backendConnected === false || demoInstallStatus === 'installing' || execStatus === 'running' ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              fontSize: 11,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              fontFamily: 'Inter, -apple-system, sans-serif',
              opacity: backendConnected === false ? 0.7 : 1,
            }}
            title="Creates SNOWFLOW_DEMO demo data (Retail + Ad/Media) and uploads semantic model YAMLs"
          >
            {demoInstallStatus === 'installing' ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
            {demoInstallStatus === 'installing' ? 'Installing Demo Assets…' : demoInstallStatus === 'done' ? 'Demo Assets Installed' : 'Install Demo Assets'}
          </button>

          {/* Run Buttons */}
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => {
                if (execStatus === 'running' || backendConnected === false) return;
                setRunModalPrompt(userPrompt);
                setShowRunModal(true);
              }}
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
              {execStatus === 'running' ? 'Running...' : 'Run Flow'}
            </button>
          </div>

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

        {/* Name Workflow Modal (shown on first run) */}
        {showNamePrompt && (
          <div style={modalOverlayStyle}>
            <div style={{ ...modalStyle, minWidth: 380 }}>
              <h3 style={{ margin: '0 0 8px 0', color: '#1F2937' }}>Name Your Workflow</h3>
              <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 12 }}>
                Give your workflow a name to save and track it.
              </div>
              <input
                type="text"
                value={workflowName}
                onChange={(e) => setWorkflowName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && workflowName.trim()) {
                    setShowNamePrompt(false);
                    // Continue with the pending run (skip name check since we just set it)
                    setTimeout(() => runWorkflow(pendingRunPrompt, true), 100);
                    setPendingRunPrompt(undefined);
                  }
                }}
                placeholder="e.g., Retail Sales Agent"
                style={{ ...inputStyle, marginBottom: 12 }}
                autoFocus
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => {
                    setShowNamePrompt(false);
                    setPendingRunPrompt(undefined);
                  }}
                  style={{ ...buttonStyle, flex: 1, background: '#E5E7EB', color: '#374151' }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (!workflowName.trim()) {
                      showToast('Please enter a workflow name', 'error');
                      return;
                    }
                    setShowNamePrompt(false);
                    // Continue with the pending run (skip name check since we just set it)
                    setTimeout(() => runWorkflow(pendingRunPrompt, true), 100);
                    setPendingRunPrompt(undefined);
                  }}
                  style={{ ...buttonStyle, flex: 1, background: '#29B5E8', color: 'white' }}
                >
                  Save & Run
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Validation Errors Panel */}
        {showValidationPanel && validationResult && (
          <div style={modalOverlayStyle}>
            <div style={{ 
              ...modalStyle, 
              minWidth: 480, 
              maxWidth: 560,
              maxHeight: '80vh',
              overflow: 'auto'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{ 
                  width: 36, 
                  height: 36, 
                  borderRadius: '50%', 
                  background: validationResult.errors.length > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center'
                }}>
                  {validationResult.errors.length > 0 ? (
                    <XCircle size={20} color="#EF4444" />
                  ) : (
                    <AlertTriangle size={20} color="#F59E0B" />
                  )}
                </div>
                <div>
                  <h3 style={{ margin: 0, color: '#1F2937', fontSize: 16 }}>
                    {validationResult.errors.length > 0 ? "Can't Run Workflow" : "Review Before Running"}
                  </h3>
                  <div style={{ fontSize: 12, color: '#6B7280' }}>
                    {validationResult.errors.length > 0 
                      ? `${validationResult.errors.length} issue${validationResult.errors.length > 1 ? 's' : ''} found that must be fixed`
                      : `${validationResult.warnings.length} warning${validationResult.warnings.length > 1 ? 's' : ''} to review`
                    }
                  </div>
                </div>
              </div>

              {/* Errors Section */}
              {validationResult.errors.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ 
                    fontSize: 11, 
                    fontWeight: 700, 
                    color: '#EF4444', 
                    textTransform: 'uppercase', 
                    letterSpacing: 0.5,
                    marginBottom: 8
                  }}>
                    Errors (Must Fix)
                  </div>
                  {validationResult.errors.map((err, i) => (
                    <div key={i} style={{ 
                      background: 'rgba(239, 68, 68, 0.08)', 
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      borderRadius: 10,
                      padding: 12,
                      marginBottom: 8
                    }}>
                      <div style={{ 
                        fontSize: 13, 
                        fontWeight: 600, 
                        color: '#B91C1C', 
                        marginBottom: 4,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                      }}>
                        <XCircle size={14} />
                        {err.message}
                      </div>
                      <div style={{ 
                        fontSize: 12, 
                        color: '#374151', 
                        background: 'rgba(255,255,255,0.6)',
                        padding: '8px 10px',
                        borderRadius: 6,
                        marginTop: 6
                      }}>
                        <strong style={{ color: '#059669' }}>How to fix:</strong> {err.suggestion}
                      </div>
                      {err.details && Object.keys(err.details).length > 0 && (
                        <div style={{ 
                          fontSize: 10, 
                          color: '#6B7280', 
                          marginTop: 6,
                          fontFamily: 'monospace'
                        }}>
                          {err.details.troubleshooting && Array.isArray(err.details.troubleshooting) && (
                            <div style={{ marginTop: 4 }}>
                              {(err.details.troubleshooting as string[]).map((step: string, j: number) => (
                                <div key={j} style={{ marginLeft: 8 }}>{String(step)}</div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Warnings Section */}
              {validationResult.warnings.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ 
                    fontSize: 11, 
                    fontWeight: 700, 
                    color: '#D97706', 
                    textTransform: 'uppercase', 
                    letterSpacing: 0.5,
                    marginBottom: 8
                  }}>
                    Warnings
                  </div>
                  {validationResult.warnings.map((warn, i) => (
                    <div key={i} style={{ 
                      background: 'rgba(245, 158, 11, 0.08)', 
                      border: '1px solid rgba(245, 158, 11, 0.25)',
                      borderRadius: 10,
                      padding: 12,
                      marginBottom: 8
                    }}>
                      <div style={{ 
                        fontSize: 13, 
                        fontWeight: 600, 
                        color: '#92400E', 
                        marginBottom: 4,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                      }}>
                        <AlertTriangle size={14} />
                        {warn.message}
                      </div>
                      <div style={{ 
                        fontSize: 12, 
                        color: '#374151', 
                        marginTop: 4
                      }}>
                        {warn.suggestion}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Info Section */}
              {validationResult.info && validationResult.info.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ 
                    fontSize: 11, 
                    fontWeight: 700, 
                    color: '#0EA5E9', 
                    textTransform: 'uppercase', 
                    letterSpacing: 0.5,
                    marginBottom: 8
                  }}>
                    Verified
                  </div>
                  {validationResult.info.map((info, i) => (
                    <div key={i} style={{ 
                      background: 'rgba(14, 165, 233, 0.08)', 
                      border: '1px solid rgba(14, 165, 233, 0.25)',
                      borderRadius: 10,
                      padding: 10,
                      marginBottom: 6,
                      fontSize: 12,
                      color: '#0369A1',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}>
                      <CheckCircle2 size={14} color="#0EA5E9" />
                      {info.message}
                    </div>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button
                  onClick={() => {
                    setShowValidationPanel(false);
                    setPendingValidationPrompt(undefined);
                    setValidationResult(null);
                  }}
                  style={{ 
                    flex: 1, 
                    background: '#E5E7EB', 
                    color: '#374151',
                    padding: '10px 16px',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {validationResult.errors.length > 0 ? 'Fix Issues' : 'Cancel'}
                </button>
                {validationResult.errors.length === 0 && validationResult.warnings.length > 0 && (
                  <button
                    onClick={() => {
                      setShowValidationPanel(false);
                      setValidationResult(null);
                      // Continue running despite warnings
                      const prompt = pendingValidationPrompt;
                      setPendingValidationPrompt(undefined);
                      // Directly continue to execution
                      setExecStatus('running');
                      setExecResult(null);
                      setActiveNodes(new Set());
                      setCompletedNodes(new Set());
                      setSimulatedNodes(new Set());
                      setIsProductionMode(true);
                      setCurrentRunningPrompt(prompt || '');
                      
                      // Execute the workflow
                      fetch('http://localhost:8000/run/stream', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ nodes, edges, prompt: prompt || undefined })
                      }).then(async (response) => {
                        if (!response.body) throw new Error('No response body');
                        // ... handle streaming (simplified - actual logic is in runWorkflow)
                        showToast('Running workflow...', 'info');
                      }).catch(err => {
                        showToast(`Error: ${err.message}`, 'error');
                        setExecStatus('error');
                      });
                    }}
                    style={{ 
                      flex: 1, 
                      background: '#F59E0B', 
                      color: 'white',
                      padding: '10px 16px',
                      border: 'none',
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Run Anyway
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Run Flow Modal (optional question) */}
        {showRunModal && (
          <div style={modalOverlayStyle}>
            <div style={{ ...modalStyle, minWidth: 420 }}>
              <h3 style={{ margin: '0 0 10px 0', color: '#1F2937' }}>Run Flow</h3>
              <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 10 }}>
                Optional: add a question to guide the run.
              </div>
              {(() => {
                const semanticCount = nodes.filter(n => n.type === 'semanticModel').length;
                if (semanticCount > 0) return null;
                const directDataToAgent = edges.some(e => {
                  const s = nodes.find(n => n.id === e.source)?.type;
                  const t = nodes.find(n => n.id === e.target)?.type;
                  return s === 'snowflakeSource' && t === 'agent';
                });
                if (!directDataToAgent) return null;
                return (
                  <div style={{
                    marginBottom: 10,
                    padding: 10,
                    borderRadius: 8,
                    background: 'rgba(245, 158, 11, 0.12)',
                    border: '1px solid rgba(245, 158, 11, 0.35)',
                    color: '#92400E',
                    fontSize: 12,
                    lineHeight: 1.35
                  }}>
                    <strong>Heads up:</strong> This flow runs <span style={{ fontWeight: 600 }}>Data → Agent</span> without a Semantic Model. For NL→SQL on proprietary data, add a Semantic Model to improve accuracy.
                  </div>
                );
              })()}
              <input
                type="text"
                value={runModalPrompt}
                onChange={(e) => setRunModalPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && execStatus !== 'running') {
                    const p = runModalPrompt.trim();
                    setUserPrompt(p);
                    setShowRunModal(false);
                    runWorkflow(p || undefined);
                  }
                }}
                placeholder="e.g., What are the top 5 products by revenue?"
                style={{ ...inputStyle, marginBottom: 10 }}
                autoFocus
              />
              {promptHistory.length > 0 && (
                <select
                  onChange={(e) => {
                    if (e.target.value) setRunModalPrompt(e.target.value);
                  }}
                  value=""
                  style={{ ...inputStyle, fontSize: 12, marginBottom: 14 }}
                >
                  <option value="">Recent prompts…</option>
                  {promptHistory.map((p, i) => (
                    <option key={i} value={p}>{p.length > 80 ? p.slice(0, 80) + '…' : p}</option>
                  ))}
                </select>
              )}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowRunModal(false)}
                  style={{ ...actionBtnStyle, padding: '10px 16px' }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const p = runModalPrompt.trim();
                    setUserPrompt(p);
                    setShowRunModal(false);
                    runWorkflow(p || undefined);
                  }}
                  style={{ ...actionBtnStyle, padding: '10px 16px', background: '#29B5E8', color: 'white' }}
                  disabled={execStatus === 'running' || backendConnected === false}
                >
                  Run
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Sidebar Resize Handle */}
        <div
          onMouseDown={handleSidebarResizeStart}
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: 6,
            height: '100%',
            cursor: 'col-resize',
            background: isResizingSidebar ? '#29B5E8' : 'transparent',
            borderRight: '1px solid #E5E9F0',
            transition: 'background 0.15s ease',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onMouseEnter={(e) => {
            if (!isResizingSidebar) {
              e.currentTarget.style.background = 'rgba(41, 181, 232, 0.2)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isResizingSidebar) {
              e.currentTarget.style.background = 'transparent';
            }
          }}
          title="Drag to resize sidebar"
        >
          <GripVertical 
            size={12} 
            style={{ 
              color: '#9CA3AF', 
              opacity: 0.6,
              pointerEvents: 'none',
            }} 
          />
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
        onDragOver={onDragOver} 
        onDrop={onDrop}
      >
        {canvasView === 'graph' ? (
          <>
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
          edges={edgesWithQualityHints.map(e => {
            const isActiveEdge = activeNodes.has(e.target);  // Edge leading to active node
            const isCompletedEdge = completedNodes.has(e.source) && completedNodes.has(e.target);
            const isRisky = Boolean((e as any)?.data?.qualityWarning);
            const base = isActiveEdge ? 'active-edge' : isCompletedEdge ? 'completed-edge' : 'idle-edge';
            
            return {
              ...e,
              animated: !isCompletedEdge,  // Animated dashes except for completed edges
              className: `${base}${isRisky ? ' risky-edge' : ''}`,
              // Increase click/hover target so users don't need pixel-perfect aim.
              interactionWidth: 20,
              // Base stroke colors handled via CSS classes; quality warnings override via `style`
            };
          })}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={handleConnect}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          onEdgeClick={(evt, edge) => {
            evt.stopPropagation();
            const warn = (edge as any)?.data?.qualityWarning;
            if (warn) {
              showToast(warn, 'info');
              return;
            }
            showToast(`Selected connection: ${edge.source} → ${edge.target} (press Delete to remove)`, 'info');
          }}
          nodeTypes={nodeTypes}
          isValidConnection={isValidConnection}
          elementsSelectable={!isProductionMode}
          nodesDraggable={!isProductionMode}
          nodesConnectable={!isProductionMode}
          edgesUpdatable={!isProductionMode}
          edgesFocusable={!isProductionMode}
          panOnDrag={!isProductionMode ? [1, 2] : false}
          selectionOnDrag={!isProductionMode}
          selectionKeyCode={null}
          selectionMode={SelectionMode.Partial}
          panOnScroll
          zoomOnScroll
          deleteKeyCode={['Backspace', 'Delete']}
          multiSelectionKeyCode={['Meta', 'Control']}
          defaultEdgeOptions={{
            type: 'default',
            animated: true,
          }}
          fitView
          style={{ background: 'transparent' }}
        >
          <Background
            color={
              resolvedTheme === 'dark'
                ? 'rgba(148, 163, 184, 0.12)' // subtle grid on dark
                : 'rgba(203, 213, 225, 0.7)'  // subtle grid on light
            }
            gap={20}
          />
          <Controls
            showInteractive={false}
            style={{
              background: resolvedTheme === 'dark' ? 'rgb(15 23 42)' : 'rgb(255 255 255)',
              borderRadius: 8,
              border: `1px solid ${resolvedTheme === 'dark' ? 'rgb(51 65 85)' : 'rgb(226 232 240)'}`,
              color: resolvedTheme === 'dark' ? 'rgb(226 232 240)' : 'rgb(15 23 42)',
            }}
          >
            <ControlButton
              onClick={() => {
                const next = !isProductionMode;
                setIsProductionMode(next);
                showToast(next ? 'Preview mode: locked (pan/zoom still available)' : 'Edit mode: unlocked', 'info');
              }}
              title={isProductionMode ? 'Unlock (enable editing)' : 'Lock (preview/read-only)'}
              style={{ color: resolvedTheme === 'dark' ? 'rgb(226 232 240)' : 'rgb(15 23 42)' }}
            >
              {/* Semantics: Locked icon = read-only, Unlocked icon = editable */}
              {isProductionMode ? <Lock size={16} /> : <Unlock size={16} />}
            </ControlButton>
          </Controls>
          
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
          
          {/* (Removed bottom-center Build/Preview pill: lock/unlock is now in the bottom-right controls) */}
        </ReactFlow>
          </>
        ) : (
          <GuidedStackCanvas
            onOpenNode={openNodeById}
            onOpenControlTower={() => setShowAdminDashboard(true)}
            onRunFlow={() => setShowRunModal(true)}
            activeNodes={activeNodes}
            completedNodes={completedNodes}
            execStatus={execStatus}
            isDarkMode={themeMode === 'dark'}
            runningPrompt={currentRunningPrompt}
          />
        )}
        
        {/* Floating View Toggle - top left of canvas area */}
        <div style={{
          position: 'absolute',
          top: 12,
          left: 12, // Fixed position from left edge of canvas
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          background: themeMode === 'dark' ? 'rgba(30, 41, 59, 0.95)' : 'rgba(255, 255, 255, 0.95)',
          borderRadius: 10,
          padding: 4,
          boxShadow: themeMode === 'dark' 
            ? '0 2px 12px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.1)' 
            : '0 2px 12px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.08)',
          zIndex: 10,
          transition: 'left 0.15s ease', // Smooth transition when sidebar resizes
        }}>
          <button
            onClick={() => setCanvasView('graph')}
            style={{
              padding: '6px 14px',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              background: canvasView === 'graph' ? 'rgb(var(--primary))' : 'transparent',
              color: canvasView === 'graph' ? 'white' : themeMode === 'dark' ? '#94A3B8' : '#475569',
              fontSize: 12,
              fontWeight: 600,
              transition: 'all 0.15s ease',
            }}
          >
            Graph
          </button>
          <button
            onClick={() => setCanvasView('stack')}
            style={{
              padding: '6px 14px',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              background: canvasView === 'stack' ? 'rgb(var(--primary))' : 'transparent',
              color: canvasView === 'stack' ? 'white' : themeMode === 'dark' ? '#94A3B8' : '#475569',
              fontSize: 12,
              fontWeight: 600,
              transition: 'all 0.15s ease',
            }}
          >
            Guided
          </button>
        </div>

        {/* Snowflake Connection Warning Popup */}
        {showConnectionWarning && snowflakeStatus && !snowflakeStatus.connected && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}>
            <div style={{
              background: isDarkMode ? '#1E293B' : 'white',
              borderRadius: 16,
              padding: 24,
              maxWidth: 480,
              width: '90%',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
                  display: 'grid',
                  placeItems: 'center',
                }}>
                  <AlertTriangle size={24} color="white" />
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: isDarkMode ? '#F1F5F9' : '#1E293B' }}>
                    Snowflake Connection Lost
                  </div>
                  <div style={{ fontSize: 13, color: isDarkMode ? '#94A3B8' : '#64748B' }}>
                    {snowflakeStatus.consecutive_failures} consecutive failures
                  </div>
                </div>
              </div>

              {/* Troubleshooting Steps */}
              <div style={{
                background: isDarkMode ? 'rgba(248,250,252,0.05)' : '#F8FAFC',
                borderRadius: 10,
                padding: 16,
                marginBottom: 20,
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: isDarkMode ? '#F1F5F9' : '#1E293B', marginBottom: 10 }}>
                  Troubleshooting Steps:
                </div>
                <ol style={{
                  margin: 0,
                  paddingLeft: 20,
                  fontSize: 12,
                  color: isDarkMode ? '#94A3B8' : '#64748B',
                  lineHeight: 1.8,
                }}>
                  {snowflakeStatus.troubleshooting?.map((step, i) => (
                    <li key={i}>{step.replace(/^\d+\.\s*/, '')}</li>
                  ))}
                </ol>
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  onClick={retrySnowflakeConnection}
                  style={{
                    flex: 1,
                    padding: '12px 20px',
                    borderRadius: 10,
                    border: 'none',
                    background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                    color: 'white',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  <RefreshCw size={16} />
                  Retry Connection
                </button>
                <button
                  onClick={() => setShowConnectionWarning(false)}
                  style={{
                    padding: '12px 20px',
                    borderRadius: 10,
                    border: `2px solid ${isDarkMode ? '#334155' : '#E2E8F0'}`,
                    background: 'transparent',
                    color: isDarkMode ? '#94A3B8' : '#64748B',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toast Notification */}
        {toast && (
      <div style={{ 
            position: 'absolute',
            bottom: 20,
            right: 20,
            padding: '12px 14px',
            borderRadius: 10,
            background: toast.type === 'error' ? '#FEE2E2' : toast.type === 'success' ? '#D1FAE5' : '#E0F2FE',
            color: toast.type === 'error' ? '#991B1B' : toast.type === 'success' ? '#065F46' : '#0369A1',
            fontSize: 12,
            fontWeight: 500,
            boxShadow: '0 8px 22px rgba(0,0,0,0.22)',
        display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            zIndex: 1000,
            maxWidth: 360,
            lineHeight: 1.35,
          }}>
            <div style={{ marginTop: 2 }}>
            {toast.type === 'error' ? <AlertCircle size={14} /> : toast.type === 'success' ? <CheckCircle size={14} /> : <Sparkles size={14} />}
            </div>
            <div style={{ flex: 1 }}>
            {toast.message}
            </div>
            {toast.dismissible && (
              <button
                onClick={() => {
                  if (toastTimerRef.current) {
                    window.clearTimeout(toastTimerRef.current);
                    toastTimerRef.current = null;
                  }
                  setToast(null);
                }}
                title="Dismiss"
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  padding: 0,
                  color: 'currentColor',
                  opacity: 0.75,
                }}
              >
                <X size={14} />
              </button>
            )}
        </div>
        )}
      </div>

      {/* Floating Node Detail Panel - positioned near clicked node, draggable */}
      {selectedNode && (
        <DraggablePanel 
          initialPosition={panelPosition}
          onClose={() => setSelectedNode(null)}
        >
          <NodeDetailPanel
            customTools={customTools}
            isReadOnly={isProductionMode}
            cortexModels={cortexModels}
            roleVersion={sfRoleVersion}
            onRefreshCortexModels={refreshCortexModels}
            cortexModelsRefreshing={cortexModelsRefreshing}
            cortexModelProbe={cortexModelProbe}
            setCortexModelProbe={setCortexModelProbe}
            cortexCrossRegion={cortexCrossRegion}
            setCortexCrossRegion={setCortexCrossRegion}
          />
        </DraggablePanel>
      )}

      {/* Permanent Results Panel - always visible, collapsible */}
      <div style={{
        width: resultsPanelCollapsed ? 48 : 'var(--panel-width, 400px)',
        minWidth: resultsPanelCollapsed ? 48 : 320,
        background: 'rgb(var(--surface))',
        borderLeft: '1px solid rgb(var(--border))',
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
            background: 'rgb(var(--surface-3))',
            border: '1px solid rgb(var(--border-strong))',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
          }}
          title={resultsPanelCollapsed ? 'Expand Results' : 'Collapse Results'}
        >
          {resultsPanelCollapsed ? (
            <ChevronLeft size={14} color="rgb(var(--fg))" />
          ) : (
            <ChevronRight size={14} color="rgb(var(--fg))" />
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
              background: execResult ? 'rgb(var(--success-bg))' : 'rgb(var(--surface-2))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {execResult ? (
                <CheckCircle size={18} color="#10B981" />
              ) : (
                <FileOutput size={18} color="rgb(var(--muted))" />
              )}
            </div>
            <span style={{ 
              writingMode: 'vertical-rl', 
              textOrientation: 'mixed',
              fontSize: 11,
              fontWeight: 500,
              color: 'rgb(var(--muted))',
              letterSpacing: 0.5,
            }}>
              Agent
            </span>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div style={{ 
              padding: '10px 12px', 
              borderBottom: '1px solid rgb(var(--border))',
              background: 'linear-gradient(135deg, rgb(var(--surface-2)) 0%, rgb(var(--surface-3)) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  background: nodes.some(n => n.type === 'agent') ? '#29B5E8' : '#9CA3AF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <MessageSquare size={12} color="white" />
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 11, color: 'rgb(var(--fg))', display: 'flex', alignItems: 'center', gap: 4 }}>
                    Agent Chat
                    {executionHistory.length > 0 && (
                      <span style={{
                        background: '#29B5E8',
                        color: 'white',
                        padding: '0px 5px',
                        borderRadius: 8,
                        fontSize: 8,
                        fontWeight: 500,
                      }}>
                        {executionHistory.length}
                      </span>
                    )}
                  </div>
                  {/* Agent selector for multi-agent (Graph view) */}
                  {(() => {
                    const agentNodes = nodes.filter(n => n.type === 'agent');
                    if (agentNodes.length > 1 && canvasView === 'graph') {
                      return (
                        <select
                          value={selectedAgentId || agentNodes[0]?.id || ''}
                          onChange={(e) => setSelectedAgentId(e.target.value)}
                          style={{
                            fontSize: 9,
                            padding: '2px 4px',
                            border: '1px solid rgb(var(--border))',
                            borderRadius: 4,
                            background: 'rgb(var(--surface))',
                            color: 'rgb(var(--fg))',
                            cursor: 'pointer',
                            maxWidth: 120,
                          }}
                        >
                          {agentNodes.map(agent => (
                            <option key={agent.id} value={agent.id}>
                              {agent.data?.label || agent.data?.name || 'Agent'}
                            </option>
                          ))}
                        </select>
                      );
                    }
                    return (
                      <div style={{ fontSize: 9, color: 'rgb(var(--muted))', display: 'flex', alignItems: 'center', gap: 4 }}>
                        {nodes.some(n => n.type === 'agent') 
                          ? (workflowName || <span style={{ fontStyle: 'italic', opacity: 0.7 }}>Unsaved workflow</span>) 
                          : 'Add an agent to start'}
                        {nodes.some(n => n.type === 'agent') && !workflowName && (
                          <span style={{
                            background: '#F59E0B',
                            color: 'white',
                            padding: '1px 4px',
                            borderRadius: 4,
                            fontSize: 7,
                            fontWeight: 600,
                          }}>DRAFT</span>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
              
              {/* Header Actions: Copy, Download Text, Download JSON, Clear */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {selectedHistoryId && execResult?.results?.agent_response && (
                  <>
                    <button 
                      onClick={() => navigator.clipboard.writeText(execResult.results?.agent_response || '')}
                      style={{ 
                        background: 'none', 
                        border: 'none', 
                        cursor: 'pointer', 
                        padding: 4,
                        color: 'rgb(var(--muted))',
                      }}
                      title="Copy response"
                    >
                      <Copy size={12} />
                    </button>
                    <button 
                      onClick={() => {
                        const content = execResult.results?.agent_response || '';
                        const blob = new Blob([content], { type: 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'response.txt';
                        a.click();
                      }}
                      style={{ 
                        background: 'none', 
                        border: 'none', 
                        cursor: 'pointer', 
                        padding: 4,
                        color: 'rgb(var(--muted))',
                      }}
                      title="Download as text"
                    >
                      <FileText size={12} />
                    </button>
                    <button 
                      onClick={() => {
                        const content = JSON.stringify({
                          status: 'success',
                          timestamp: new Date().toISOString(),
                          query: execResult.user_prompt,
                          data: { agent_response: execResult.results?.agent_response }
                        }, null, 2);
                        const blob = new Blob([content], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'response.json';
                        a.click();
                      }}
                      style={{ 
                        background: 'none', 
                        border: 'none', 
                        cursor: 'pointer', 
                        padding: 4,
                        color: 'rgb(var(--muted))',
                      }}
                      title="Download as JSON"
                    >
                      <Download size={12} />
                    </button>
                  </>
                )}
                {executionHistory.length > 0 && (
                  <button 
                    onClick={() => {
                      setExecutionHistory([]);
                      setExecResult(null);
                      setSelectedHistoryId(null);
                    }}
                    style={{ 
                      background: 'none', 
                      border: 'none', 
                      cursor: 'pointer', 
                      padding: 4,
                      color: 'rgb(var(--muted))',
                    }}
                    title="Clear chat history"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* Two-Panel Layout: Chat (flexible) + Stats (fixed bottom) */}
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              
              {/* CHAT PANEL - Takes available space */}
              <div style={{ 
                flex: 1, 
                display: 'flex', 
                flexDirection: 'column',
                overflow: 'hidden',
                minHeight: 0, // Important for flex scroll
              }}>
                {/* Chat Messages - Scrollable */}
                <div style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                }}>
                  {executionHistory.length === 0 ? (
                    <div style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#9CA3AF',
                      textAlign: 'center',
                      padding: 24,
                    }}>
                      <Sparkles size={40} style={{ marginBottom: 12, opacity: 0.4, color: '#8B5CF6' }} />
                      <div style={{ fontSize: 14, fontWeight: 500, color: '#6B7280' }}>
                        {nodes.some(n => n.type === 'agent') ? 'Ask Your Agent' : 'Create a Flow'}
                      </div>
                      <div style={{ fontSize: 12, marginTop: 4, maxWidth: 240, lineHeight: 1.5 }}>
                        {nodes.some(n => n.type === 'agent') 
                          ? 'Type a question below to query your agent'
                          : (
                            <>
                              Type below to generate a flow, e.g.:
                              <br />
                              <span style={{ color: '#8B5CF6', fontWeight: 500 }}>"Create a retail analytics agent"</span>
                            </>
                          )
                        }
                      </div>
                      {!nodes.some(n => n.type === 'agent') && (
                        <div style={{ 
                          fontSize: 10, 
                          marginTop: 12, 
                          color: '#9CA3AF',
                          background: 'rgb(var(--surface-2))',
                          padding: '8px 12px',
                          borderRadius: 8,
                        }}>
                          Try: "Create a multi-agent supervisor for ad campaigns"
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Render chat messages in chronological order (oldest first) */
                    [...executionHistory].reverse().map((entry) => (
                      <div key={entry.id}>
                        {/* User Message */}
                        <div 
                          onClick={() => {
                            setSelectedHistoryId(entry.id);
                            setExecResult(entry.result);
                          }}
                          style={{
                            display: 'flex',
                            gap: 10,
                            flexDirection: 'row-reverse',
                            cursor: 'pointer',
                            opacity: selectedHistoryId === entry.id ? 1 : 0.7,
                            transition: 'opacity 0.15s ease',
                          }}
                        >
                          <div style={{
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            background: '#29B5E8',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}>
                            <User size={14} color="white" />
                          </div>
                          <div style={{
                            maxWidth: '85%',
                            padding: '10px 14px',
                            borderRadius: 12,
                            background: selectedHistoryId === entry.id ? '#29B5E8' : '#E0F2FE',
                            color: selectedHistoryId === entry.id ? 'white' : '#0369A1',
                            fontSize: 12,
                            lineHeight: 1.5,
                            border: selectedHistoryId === entry.id ? '2px solid #0EA5E9' : '1px solid #BAE6FD',
                          }}>
                            {entry.prompt}
                          </div>
                        </div>
                        
                        {/* Assistant Response */}
                        <div 
                          onClick={() => {
                            setSelectedHistoryId(entry.id);
                            setExecResult(entry.result);
                          }}
                          style={{
                            display: 'flex',
                            gap: 10,
                            marginTop: 8,
                            cursor: 'pointer',
                            opacity: selectedHistoryId === entry.id ? 1 : 0.7,
                          }}
                        >
                          <div style={{
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            background: selectedHistoryId === entry.id ? '#10B981' : '#F3F4F6',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}>
                            <Bot size={14} color={selectedHistoryId === entry.id ? 'white' : '#6B7280'} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              padding: '10px 14px',
                              borderRadius: 12,
                              background: selectedHistoryId === entry.id ? '#F0FDF4' : '#F9FAFB',
                              border: selectedHistoryId === entry.id ? '2px solid #10B981' : '1px solid #E5E7EB',
                              fontSize: 12,
                              lineHeight: 1.5,
                              color: '#1F2937',
                              maxHeight: selectedHistoryId === entry.id ? 'none' : 80,
                              overflow: 'hidden',
                              position: 'relative',
                            }}>
                              <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                {entry.result.results?.agent_response 
                                  ? (selectedHistoryId === entry.id 
                                      ? entry.result.results.agent_response 
                                      : entry.result.results.agent_response.substring(0, 150) + (entry.result.results.agent_response.length > 150 ? '...' : ''))
                                  : 'No response'}
                              </div>
                              {selectedHistoryId !== entry.id && entry.result.results?.agent_response && entry.result.results.agent_response.length > 150 && (
                                <div style={{
                                  position: 'absolute',
                                  bottom: 0,
                                  left: 0,
                                  right: 0,
                                  height: 30,
                                  background: 'linear-gradient(transparent, #F9FAFB)',
                                }}/>
                              )}
                            </div>
                            <div style={{ 
                              fontSize: 9, 
                              color: '#10B981',
                              marginTop: 4,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                            }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                <Zap size={10} /> Snowflake Cortex
                              </span>
                              {entry.executionTimeMs && (
                                <span style={{ color: '#9CA3AF' }}>• {entry.executionTimeMs}ms</span>
                              )}
                              {selectedHistoryId === entry.id && (
                                <span style={{ color: '#10B981', fontWeight: 600 }}>• Selected ↓</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  
                  {/* Loading indicator when running */}
                  {execStatus === 'running' && (
                    <div style={{ display: 'flex', gap: 10 }}>
                      <div style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        background: '#F3F4F6',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        <Bot size={14} color="#6B7280" />
                      </div>
                      <div style={{
                        padding: '10px 14px',
                        borderRadius: 12,
                        background: '#F3F4F6',
                        color: '#6B7280',
                        fontSize: 12,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}>
                        <Loader2 size={14} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
                        Thinking...
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Chat Input Field - Supports queries, flow generation, AND flow editing */}
                <div style={{
                  padding: '10px 12px',
                  borderTop: '1px solid rgb(var(--border))',
                  background: 'rgb(var(--surface-2))',
                }}>
                  {/* Mode Toggle - Only show when there's a flow */}
                  {nodes.length > 0 && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 8,
                    }}>
                      <div style={{
                        display: 'flex',
                        background: 'rgb(var(--surface-3))',
                        borderRadius: 6,
                        padding: 2,
                        gap: 2,
                      }}>
                        <button
                          onClick={() => setChatMode('query')}
                          style={{
                            padding: '4px 10px',
                            fontSize: 10,
                            fontWeight: 600,
                            border: 'none',
                            borderRadius: 4,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            background: chatMode === 'query' ? '#29B5E8' : 'transparent',
                            color: chatMode === 'query' ? 'white' : 'rgb(var(--muted))',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <MessageSquare size={10} />
                          Ask
                        </button>
                        <button
                          onClick={() => setChatMode('edit')}
                          style={{
                            padding: '4px 10px',
                            fontSize: 10,
                            fontWeight: 600,
                            border: 'none',
                            borderRadius: 4,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            background: chatMode === 'edit' ? '#F59E0B' : 'transparent',
                            color: chatMode === 'edit' ? 'white' : 'rgb(var(--muted))',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <Pencil size={10} />
                          Edit Flow
                        </button>
                      </div>
                      <div style={{ fontSize: 9, color: 'rgb(var(--muted))' }}>
                        {chatMode === 'query' ? 'Ask questions' : 'Modify workflow'}
                      </div>
                    </div>
                  )}
                  
                  {/* Mode hints based on input */}
                  {(() => {
                    const input = chatInput.trim().toLowerCase();
                    const isCreate = /^(create|build|set up|make|generate|design)\s/i.test(input);
                    
                    if (isCreate) {
                      return (
                        <div style={{ fontSize: 10, color: '#8B5CF6', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Sparkles size={10} />
                          Create mode - Press Enter to generate new workflow
                        </div>
                      );
                    }
                    return null;
                  })()}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={async (e) => {
                        if (e.key === 'Enter' && chatInput.trim() && execStatus !== 'running') {
                          const prompt = chatInput.trim();
                          const isCreate = /^(create|build|set up|make|generate|design)\s/i.test(prompt);
                          // Edit mode: toggle is set to edit, OR explicit keywords, OR /edit prefix
                          const isEditKeyword = prompt.toLowerCase().startsWith('/edit') || /^(add|remove|delete|change|modify|update|switch|insert)\s/i.test(prompt);
                          const shouldEdit = (chatMode === 'edit' && nodes.length > 0) || isEditKeyword;
                          const editPrompt = prompt.toLowerCase().startsWith('/edit') ? prompt.slice(5).trim() : prompt;
                          
                          if (isCreate && chatMode !== 'edit') {
                            // FLOW GENERATION MODE - Create new flow
                            setChatInput('');
                            setExecStatus('running');
                            showToast('Generating workflow...', 'info');
                            
                            try {
                              const res = await fetch('http://localhost:8000/flow/generate', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ prompt, use_llm: false })
                              });
                              
                              if (res.ok) {
                                const data = await res.json();
                                if (data.success && data.nodes && data.edges) {
                                  setWorkflow(data.nodes, data.edges, data.name || 'Generated Workflow');
                                  setCanvasView('graph');
                                  setChatMode('query'); // Switch back to query mode after creation
                                  showToast(`✨ Created "${data.name}" with ${data.node_count} nodes`, 'success');
                                } else {
                                  showToast(`Generation failed: ${data.error || 'Unknown error'}`, 'error');
                                }
                              } else {
                                showToast('Failed to generate flow', 'error');
                              }
                            } catch (err) {
                              showToast(`Error: ${err instanceof Error ? err.message : 'Unknown'}`, 'error');
                            } finally {
                              setExecStatus('idle');
                            }
                          } else if (shouldEdit && nodes.length > 0) {
                            // FLOW EDIT MODE - Modify existing flow
                            setChatInput('');
                            setExecStatus('running');
                            showToast('Editing workflow...', 'info');
                            
                            try {
                              const res = await fetch('http://localhost:8000/flow/edit', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ prompt: editPrompt, nodes, edges })
                              });
                              
                              if (res.ok) {
                                const data = await res.json();
                                if (data.success && data.nodes && data.edges) {
                                  setWorkflow(data.nodes, data.edges, workflowName);
                                  setCanvasView('graph');
                                  const changesList = data.changes?.join(', ') || 'Flow updated';
                                  showToast(`✏️ ${changesList}`, 'success');
                                } else {
                                  showToast(`Edit failed: ${data.error || 'Unknown error'}`, 'error');
                                }
                              } else {
                                showToast('Failed to edit flow', 'error');
                              }
                            } catch (err) {
                              showToast(`Error: ${err instanceof Error ? err.message : 'Unknown'}`, 'error');
                            } finally {
                              setExecStatus('idle');
                            }
                          } else if (nodes.some(n => n.type === 'agent')) {
                            // QUERY EXECUTION MODE
                            setUserPrompt(prompt);
                            setChatInput('');
                            runWorkflow(prompt);
                          } else {
                            showToast('Type "Create..." to generate a flow, or "Add..." to edit', 'info');
                          }
                        }
                      }}
                      placeholder={
                        nodes.length === 0
                          ? "Type 'Create a retail analytics agent' to start"
                          : chatMode === 'edit'
                            ? "e.g., 'Add an inventory agent' or 'Remove supervisor'"
                            : nodes.some(n => n.type === 'agent')
                              ? "Ask your agent a question..."
                              : "Type 'Create...' to build a flow"
                      }
                      disabled={execStatus === 'running'}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        border: '1px solid rgb(var(--border))',
                        borderRadius: 8,
                        fontSize: 12,
                        outline: 'none',
                        background: 'rgb(var(--surface))',
                        color: 'rgb(var(--fg))',
                      }}
                    />
                    <button
                      onClick={async () => {
                        if (chatInput.trim() && execStatus !== 'running') {
                          const prompt = chatInput.trim();
                          const isCreate = /^(create|build|set up|make|generate|design)\s/i.test(prompt);
                          const isEditKeyword = prompt.toLowerCase().startsWith('/edit') || /^(add|remove|delete|change|modify|update|switch|insert)\s/i.test(prompt);
                          const shouldEdit = (chatMode === 'edit' && nodes.length > 0) || isEditKeyword;
                          const editPrompt = prompt.toLowerCase().startsWith('/edit') ? prompt.slice(5).trim() : prompt;
                          
                          if (isCreate && chatMode !== 'edit') {
                            setChatInput('');
                            setExecStatus('running');
                            showToast('Generating workflow...', 'info');
                            try {
                              const res = await fetch('http://localhost:8000/flow/generate', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ prompt, use_llm: false })
                              });
                              if (res.ok) {
                                const data = await res.json();
                                if (data.success) {
                                  setWorkflow(data.nodes, data.edges, data.name || 'Generated Workflow');
                                  setCanvasView('graph');
                                  setChatMode('query'); // Switch back to query mode
                                  showToast(`✨ Created "${data.name}" with ${data.node_count} nodes`, 'success');
                                } else {
                                  showToast(`Generation failed: ${data.error}`, 'error');
                                }
                              }
                            } catch (err) {
                              showToast(`Error: ${err instanceof Error ? err.message : 'Unknown'}`, 'error');
                            } finally {
                              setExecStatus('idle');
                            }
                          } else if (shouldEdit && nodes.length > 0) {
                            setChatInput('');
                            setExecStatus('running');
                            showToast('Editing workflow...', 'info');
                            try {
                              const res = await fetch('http://localhost:8000/flow/edit', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ prompt: editPrompt, nodes, edges })
                              });
                              if (res.ok) {
                                const data = await res.json();
                                if (data.success) {
                                  setWorkflow(data.nodes, data.edges, workflowName);
                                  setCanvasView('graph');
                                  showToast(`✏️ ${data.changes?.join(', ') || 'Flow updated'}`, 'success');
                                } else {
                                  showToast(`Edit failed: ${data.error}`, 'error');
                                }
                              }
                            } catch (err) {
                              showToast(`Error: ${err instanceof Error ? err.message : 'Unknown'}`, 'error');
                            } finally {
                              setExecStatus('idle');
                            }
                          } else if (nodes.some(n => n.type === 'agent') && chatMode === 'query') {
                            setUserPrompt(prompt);
                            setChatInput('');
                            runWorkflow(prompt);
                          } else {
                            showToast('Type "Create..." to generate a flow or switch to Edit mode', 'info');
                          }
                        }
                      }}
                      disabled={!chatInput.trim() || execStatus === 'running'}
                      style={{
                        padding: '8px 12px',
                        background: chatInput.trim() ? (
                          /^(create|build|set up|make|generate|design)\s/i.test(chatInput) && chatMode !== 'edit'
                            ? '#8B5CF6'  // Purple for create
                            : chatMode === 'edit' || chatInput.toLowerCase().startsWith('/edit') || /^(add|remove|delete|change|modify|update|switch|insert)\s/i.test(chatInput)
                              ? '#F59E0B'  // Amber for edit
                              : '#29B5E8'  // Blue for queries
                        ) : 'rgb(var(--surface-3))',
                        color: chatInput.trim() ? 'white' : 'rgb(var(--muted))',
                        border: 'none',
                        borderRadius: 8,
                        cursor: chatInput.trim() ? 'pointer' : 'not-allowed',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      title={
                        /^(create|build|set up|make|generate|design)\s/i.test(chatInput) ? "Generate new flow" 
                        : (chatInput.toLowerCase().startsWith('/edit') || /^(add|remove|delete|change|modify|update|switch|insert)\s/i.test(chatInput)) ? "Edit flow"
                        : "Send message"
                      }
                    >
                      {/^(create|build|set up|make|generate|design)\s/i.test(chatInput) && chatMode !== 'edit'
                        ? <Sparkles size={14} /> 
                        : chatMode === 'edit' || chatInput.toLowerCase().startsWith('/edit') || /^(add|remove|delete|change|modify|update|switch|insert)\s/i.test(chatInput)
                          ? <Pencil size={14} />
                          : <Play size={14} />
                      }
                    </button>
                  </div>
                </div>
              </div>
              
              {/* STATS PANEL - Always visible, independently collapsible */}
              <div style={{ 
                flexShrink: 0,
                background: 'rgb(var(--surface-2))',
                borderTop: '2px solid rgb(var(--border))',
              }}>
                {/* Draggable Divider / Stats Header */}
                <button
                  onClick={() => setStatsExpanded(!statsExpanded)}
                  style={{
                    width: '100%',
                    padding: '8px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'rgb(var(--surface-3))',
                    border: 'none',
                    cursor: 'pointer',
                    borderBottom: statsExpanded ? '1px solid rgb(var(--border))' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <BarChart3 size={14} color="#6366F1" />
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'rgb(var(--fg))' }}>
                      Execution Stats
                    </span>
                    {selectedHistoryId && (
                      <span style={{
                        background: '#10B981',
                        color: 'white',
                        padding: '1px 6px',
                        borderRadius: 8,
                        fontSize: 9,
                      }}>
                        Active
                      </span>
                    )}
                  </div>
                  <div style={{ 
                    transform: statsExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease',
                    color: 'rgb(var(--muted))',
                  }}>
                    <ChevronDown size={14} />
                  </div>
                </button>
                
                {/* Stats Content - shown when expanded */}
                {statsExpanded && (
                  <div style={{ 
                    padding: 12, 
                    maxHeight: 300, 
                    overflowY: 'auto',
                  }}>
                    {selectedHistoryId && execResult ? (
                      <>
                        {/* Metrics Row */}
                        <div style={{
                          display: 'flex',
                          gap: 8,
                          marginBottom: 12,
                        }}>
                          <div style={{
                            flex: 1,
                            background: '#10B981',
                            padding: '10px 8px',
                            borderRadius: 8,
                            textAlign: 'center',
                          }}>
                            <div style={{ fontSize: 18, fontWeight: 700, color: 'white' }}>
                              {execResult.messages?.filter((m: string) => m.includes('completed') || m.includes('Agent')).length || 1}
                            </div>
                            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase' }}>
                              Agents
                            </div>
                          </div>
                          <div style={{
                            flex: 1,
                            background: '#F59E0B',
                            padding: '10px 8px',
                            borderRadius: 8,
                            textAlign: 'center',
                          }}>
                            <div style={{ fontSize: 18, fontWeight: 700, color: 'white' }}>
                              {execResult.messages?.filter((m: string) => m.includes('routed')).length || 0}
                            </div>
                            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase' }}>
                              Routes
                            </div>
                          </div>
                          <div style={{
                            flex: 1,
                            background: '#8B5CF6',
                            padding: '10px 8px',
                            borderRadius: 8,
                            textAlign: 'center',
                          }}>
                            <div style={{ fontSize: 18, fontWeight: 700, color: 'white' }}>
                              {execResult.messages?.filter((m: string) => m.toLowerCase().includes('semantic')).length || 1}
                            </div>
                            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase' }}>
                              Semantic
                            </div>
                          </div>
                        </div>
                        
                        {/* Timeline */}
                        {execResult.messages && execResult.messages.length > 0 && (
                          <div style={{
                            background: 'rgb(var(--surface))',
                            borderRadius: 8,
                            border: '1px solid rgb(var(--border))',
                            overflow: 'hidden',
                            marginBottom: 12,
                          }}>
                            <div style={{
                              padding: '8px 12px',
                              borderBottom: '1px solid rgb(var(--border))',
                              fontSize: 9,
                              fontWeight: 600,
                              color: 'rgb(var(--muted))',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                            }}>
                              Execution Timeline
                            </div>
                            {execResult.messages.slice(0, 6).map((msg: string, i: number) => {
                              const isSuccess = msg.includes('completed') || msg.includes('success') || msg.includes('loaded');
                              const isAgent = msg.includes('Agent') || msg.includes('Cortex');
                              return (
                                <div
                                  key={i}
                                  style={{
                                    padding: '5px 12px',
                                    borderBottom: i < Math.min(execResult.messages!.length - 1, 5) ? '1px solid rgb(var(--border))' : 'none',
                                    fontSize: 9,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    background: isAgent ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                                  }}
                                >
                                  <div style={{
                                    width: 12,
                                    height: 12,
                                    borderRadius: '50%',
                                    background: isSuccess ? '#10B981' : '#F59E0B',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 7,
                                    color: 'white',
                                    flexShrink: 0,
                                  }}>
                                    ✓
                                  </div>
                                  <span style={{ color: 'rgb(var(--fg))', fontSize: 9 }}>{msg}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        
                        {/* Copy/Download moved to header */}
                      </>
                    ) : (
                      /* Empty state when no message selected */
                      <div style={{
                        textAlign: 'center',
                        padding: '16px 12px',
                        color: 'rgb(var(--muted))',
                        fontSize: 11,
                      }}>
                        <BarChart3 size={24} style={{ opacity: 0.3, marginBottom: 8 }} />
                        <div>Click a chat message to view its stats</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

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
  color: 'rgb(var(--fg))',
  cursor: 'pointer',
  borderBottom: '1px solid rgb(var(--border))',
  marginBottom: 4,
  userSelect: 'none',
};

const compactItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 8px',
  fontSize: 12,
  color: 'rgb(var(--fg))',
  background: 'rgb(var(--surface-3))',
  border: '1px solid rgb(var(--border-strong))',
  borderRadius: 6,
  marginBottom: 4,
  cursor: 'grab',
  boxShadow: '0 8px 20px rgba(0,0,0,0.18)',
  transition: 'all 0.15s ease',
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
