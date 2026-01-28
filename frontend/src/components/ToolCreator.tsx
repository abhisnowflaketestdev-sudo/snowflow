import { useState } from 'react';
import { Wrench, Plus, Trash2, Save, Code, Database, Globe, X, ChevronDown, ChevronRight, CheckCircle } from 'lucide-react';

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array';
  description: string;
  required: boolean;
  default?: string;
}

export interface CustomTool {
  id: string;
  name: string;
  description: string;
  type: 'sql' | 'python' | 'api';
  parameters: ToolParameter[];
  implementation: string;
  // For API type
  apiEndpoint?: string;
  apiMethod?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  apiHeaders?: Record<string, string>;
  // Metadata
  createdAt: Date;
  createdBy: string;
  isApproved: boolean;
}

interface ToolCreatorProps {
  tools: CustomTool[];
  onSaveTool: (tool: CustomTool) => void;
  onDeleteTool: (toolId: string) => void;
  onClose: () => void;
}

export function ToolCreator({ tools, onSaveTool, onDeleteTool, onClose }: ToolCreatorProps) {
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [editingTool, setEditingTool] = useState<CustomTool | null>(null);
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'sql' | 'python' | 'api'>('sql');
  const [parameters, setParameters] = useState<ToolParameter[]>([]);
  const [implementation, setImplementation] = useState('');
  const [apiEndpoint, setApiEndpoint] = useState('');
  const [apiMethod, setApiMethod] = useState<'GET' | 'POST' | 'PUT' | 'DELETE'>('POST');

  const resetForm = () => {
    setName('');
    setDescription('');
    setType('sql');
    setParameters([]);
    setImplementation('');
    setApiEndpoint('');
    setApiMethod('POST');
    setEditingTool(null);
  };

  const handleCreate = () => {
    resetForm();
    setMode('create');
  };

  const handleEdit = (tool: CustomTool) => {
    setName(tool.name);
    setDescription(tool.description);
    setType(tool.type);
    setParameters(tool.parameters);
    setImplementation(tool.implementation);
    setApiEndpoint(tool.apiEndpoint || '');
    setApiMethod(tool.apiMethod || 'POST');
    setEditingTool(tool);
    setMode('edit');
  };

  const handleSave = () => {
    const tool: CustomTool = {
      id: editingTool?.id || `tool-${Date.now()}`,
      name,
      description,
      type,
      parameters,
      implementation,
      apiEndpoint: type === 'api' ? apiEndpoint : undefined,
      apiMethod: type === 'api' ? apiMethod : undefined,
      createdAt: editingTool?.createdAt || new Date(),
      createdBy: 'current_user',
      isApproved: false,
    };
    onSaveTool(tool);
    resetForm();
    setMode('list');
  };

  const addParameter = () => {
    setParameters([...parameters, {
      name: '',
      type: 'string',
      description: '',
      required: true,
    }]);
  };

  const updateParameter = (index: number, updates: Partial<ToolParameter>) => {
    const newParams = [...parameters];
    newParams[index] = { ...newParams[index], ...updates };
    setParameters(newParams);
  };

  const removeParameter = (index: number) => {
    setParameters(parameters.filter((_, i) => i !== index));
  };

  const toggleExpanded = (toolId: string) => {
    const newExpanded = new Set(expandedTools);
    if (newExpanded.has(toolId)) {
      newExpanded.delete(toolId);
    } else {
      newExpanded.add(toolId);
    }
    setExpandedTools(newExpanded);
  };

  const getTypeIcon = (t: string) => {
    switch (t) {
      case 'sql': return <Database size={14} color="#29B5E8" />;
      case 'python': return <Code size={14} color="#3B82F6" />;
      case 'api': return <Globe size={14} color="#10B981" />;
      default: return <Wrench size={14} />;
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid rgb(var(--border))',
    borderRadius: 6,
    fontSize: 12,
    boxSizing: 'border-box',
    outline: 'none',
    fontFamily: 'Inter, -apple-system, sans-serif',
    background: 'rgb(var(--surface))',
    color: 'rgb(var(--fg))',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 11,
    fontWeight: 500,
    color: 'rgb(var(--fg-muted))',
    marginBottom: 4,
  };

  return (
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
      zIndex: 1000,
      fontFamily: 'Inter, -apple-system, sans-serif',
    }}>
      <div style={{
        width: 600,
        maxHeight: '80vh',
        background: 'rgb(var(--surface))',
        border: '1px solid rgb(var(--border))',
        borderRadius: 12,
        boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid rgb(var(--border))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, rgb(var(--surface-2)) 0%, rgb(var(--surface-3)) 100%)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Wrench size={20} color="#8B5CF6" />
            <span style={{ fontWeight: 600, fontSize: 16, color: 'rgb(var(--fg))' }}>
              {mode === 'list' ? 'Custom Tools' : mode === 'create' ? 'Create Tool' : 'Edit Tool'}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
          >
            <X size={20} color="rgb(var(--muted))" />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {mode === 'list' ? (
            <>
              {/* Tool list */}
              {tools.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: 40,
                  color: '#9CA3AF',
                }}>
                  <Wrench size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#6B7280' }}>
                    No custom tools yet
                  </div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>
                    Create tools that your agents can use
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {tools.map(tool => (
                    <div
                      key={tool.id}
                      style={{
                        border: '1px solid rgb(var(--border))',
                        borderRadius: 8,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        onClick={() => toggleExpanded(tool.id)}
                        style={{
                          padding: '12px 16px',
                          background: 'rgb(var(--surface-2))',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                        }}
                      >
                        {expandedTools.has(tool.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        {getTypeIcon(tool.type)}
                        <span style={{ fontWeight: 500, fontSize: 13, color: 'rgb(var(--fg))' }}>
                          {tool.name}
                        </span>
                        {tool.isApproved && (
                          <CheckCircle size={12} color="#10B981" />
                        )}
                        <span style={{ 
                          marginLeft: 'auto', 
                          fontSize: 10, 
                          color: 'rgb(var(--muted))',
                          textTransform: 'uppercase'
                        }}>
                          {tool.type}
                        </span>
                      </div>
                      
                      {expandedTools.has(tool.id) && (
                        <div style={{ padding: 16, borderTop: '1px solid rgb(var(--border))' }}>
                          <div style={{ fontSize: 12, color: 'rgb(var(--muted))', marginBottom: 12 }}>
                            {tool.description}
                          </div>
                          
                          {tool.parameters.length > 0 && (
                            <div style={{ marginBottom: 12 }}>
                              <div style={{ fontSize: 10, fontWeight: 600, color: '#4B5563', marginBottom: 6 }}>
                                PARAMETERS
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {tool.parameters.map((p, i) => (
                                  <span key={i} style={{
                                    fontSize: 10,
                                    padding: '2px 8px',
                                    background: '#E0E7FF',
                                    color: '#4338CA',
                                    borderRadius: 4,
                                  }}>
                                    {p.name}: {p.type}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          <div style={{
                            background: '#1F2937',
                            borderRadius: 6,
                            padding: 12,
                            fontSize: 11,
                            fontFamily: 'monospace',
                            color: '#E5E9F0',
                            whiteSpace: 'pre-wrap',
                            maxHeight: 120,
                            overflowY: 'auto',
                          }}>
                            {tool.implementation || tool.apiEndpoint}
                          </div>
                          
                          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                            <button
                              onClick={() => handleEdit(tool)}
                              style={{
                                padding: '6px 12px',
                                border: '1px solid rgb(var(--border))',
                                borderRadius: 6,
                                background: 'rgb(var(--surface))',
                                color: 'rgb(var(--fg))',
                                fontSize: 11,
                                cursor: 'pointer',
                              }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => onDeleteTool(tool.id)}
                              style={{
                                padding: '6px 12px',
                                border: 'none',
                                borderRadius: 6,
                                background: '#FEE2E2',
                                color: '#991B1B',
                                fontSize: 11,
                                cursor: 'pointer',
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            /* Create/Edit Form */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Name */}
              <div>
                <label style={labelStyle}>Tool Name</label>
                <input
                  style={inputStyle}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., calculate_discount"
                />
              </div>

              {/* Description */}
              <div>
                <label style={labelStyle}>Description</label>
                <input
                  style={inputStyle}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What does this tool do?"
                />
              </div>

              {/* Type */}
              <div>
                <label style={labelStyle}>Tool Type</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['sql', 'python', 'api'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setType(t)}
                      style={{
                        flex: 1,
                        padding: '10px 12px',
                        border: type === t ? '2px solid #8B5CF6' : '1px solid rgb(var(--border))',
                        borderRadius: 8,
                        background: type === t ? 'rgb(var(--purple-bg))' : 'rgb(var(--surface))',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        fontSize: 12,
                        fontWeight: 500,
                        color: type === t ? '#8B5CF6' : 'rgb(var(--muted))',
                      }}
                    >
                      {getTypeIcon(t)}
                      {t.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Parameters */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <label style={{ ...labelStyle, marginBottom: 0 }}>Parameters</label>
                  <button
                    onClick={addParameter}
                    style={{
                      padding: '4px 8px',
                      border: 'none',
                      borderRadius: 4,
                      background: '#E0E7FF',
                      color: '#4338CA',
                      fontSize: 10,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Plus size={10} /> Add
                  </button>
                </div>
                
                {parameters.length === 0 ? (
                  <div style={{ fontSize: 11, color: '#9CA3AF', padding: 8 }}>
                    No parameters defined
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {parameters.map((param, idx) => (
                      <div key={idx} style={{
                        display: 'flex',
                        gap: 8,
                        padding: 10,
                        background: 'rgb(var(--surface-2))',
                        border: '1px solid rgb(var(--border))',
                        borderRadius: 6,
                        alignItems: 'center',
                      }}>
                        <input
                          style={{ ...inputStyle, flex: 2 }}
                          value={param.name}
                          onChange={(e) => updateParameter(idx, { name: e.target.value })}
                          placeholder="param_name"
                        />
                        <select
                          style={{ ...inputStyle, flex: 1 }}
                          value={param.type}
                          onChange={(e) => updateParameter(idx, { type: e.target.value as any })}
                        >
                          <option value="string">string</option>
                          <option value="number">number</option>
                          <option value="boolean">boolean</option>
                          <option value="array">array</option>
                        </select>
                        <button
                          onClick={() => removeParameter(idx)}
                          style={{
                            padding: 6,
                            border: 'none',
                            borderRadius: 4,
                            background: '#FEE2E2',
                            color: '#991B1B',
                            cursor: 'pointer',
                          }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Implementation */}
              {type === 'api' ? (
                <>
                  <div>
                    <label style={labelStyle}>API Endpoint</label>
                    <input
                      style={inputStyle}
                      value={apiEndpoint}
                      onChange={(e) => setApiEndpoint(e.target.value)}
                      placeholder="https://api.example.com/endpoint"
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Method</label>
                    <select
                      style={inputStyle}
                      value={apiMethod}
                      onChange={(e) => setApiMethod(e.target.value as any)}
                    >
                      <option value="GET">GET</option>
                      <option value="POST">POST</option>
                      <option value="PUT">PUT</option>
                      <option value="DELETE">DELETE</option>
                    </select>
                  </div>
                </>
              ) : (
                <div>
                  <label style={labelStyle}>
                    {type === 'sql' ? 'SQL Query' : 'Python Code'}
                  </label>
                  <textarea
                    style={{
                      ...inputStyle,
                      minHeight: 120,
                      fontFamily: 'monospace',
                      fontSize: 12,
                      resize: 'vertical',
                    }}
                    value={implementation}
                    onChange={(e) => setImplementation(e.target.value)}
                    placeholder={type === 'sql' 
                      ? "SELECT * FROM table WHERE column = :param_name"
                      : "def execute(param_name):\n    return result"
                    }
                  />
                  <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 4 }}>
                    {type === 'sql' 
                      ? 'Use :param_name syntax for parameters'
                      : 'Parameters are passed as function arguments'
                    }
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid #E5E9F0',
          display: 'flex',
          justifyContent: 'space-between',
          background: '#F9FAFB',
        }}>
          {mode === 'list' ? (
            <>
              <div style={{ fontSize: 11, color: '#6B7280' }}>
                {tools.length} tool{tools.length !== 1 ? 's' : ''} defined
              </div>
              <button
                onClick={handleCreate}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: 6,
                  background: '#8B5CF6',
                  color: 'white',
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Plus size={14} /> Create Tool
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => { resetForm(); setMode('list'); }}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #E5E9F0',
                  borderRadius: 6,
                  background: 'white',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!name.trim()}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: 6,
                  background: name.trim() ? '#8B5CF6' : '#E5E9F0',
                  color: name.trim() ? 'white' : '#9CA3AF',
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: name.trim() ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Save size={14} /> Save Tool
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}



export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array';
  description: string;
  required: boolean;
  default?: string;
}

export interface CustomTool {
  id: string;
  name: string;
  description: string;
  type: 'sql' | 'python' | 'api';
  parameters: ToolParameter[];
  implementation: string;
  // For API type
  apiEndpoint?: string;
  apiMethod?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  apiHeaders?: Record<string, string>;
  // Metadata
  createdAt: Date;
  createdBy: string;
  isApproved: boolean;
}

interface ToolCreatorProps {
  tools: CustomTool[];
  onSaveTool: (tool: CustomTool) => void;
  onDeleteTool: (toolId: string) => void;
  onClose: () => void;
}
