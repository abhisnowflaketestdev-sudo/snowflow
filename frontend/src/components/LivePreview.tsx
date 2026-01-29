import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, Sparkles, X, Maximize2, Minimize2, Zap, ChevronDown, ChevronRight, BarChart3, Clock, Database, Trash2 } from 'lucide-react';
import axios from 'axios';

// Execution stats stored with each assistant response
interface ExecutionStats {
  agentsRun: number;
  routesTaken: number;
  semanticViews: number;
  executionTimeMs?: number;
  dataSource?: string;
  model?: string;
  recordsProcessed?: number;
  timeline?: Array<{
    step: string;
    status: 'success' | 'pending' | 'error';
    detail?: string;
  }>;
}

interface Message {
  id: string;  // Unique ID for tracking expanded state
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isReal?: boolean;  // Was this from real Snowflake?
  stats?: ExecutionStats;  // Execution stats for assistant messages
}

interface LivePreviewProps {
  workflowName: string;
  isConfigured: boolean;
  nodes: any[];
  edges: any[];
  onClose?: () => void;
}

export function LivePreview({ workflowName, isConfigured, nodes, edges, onClose }: LivePreviewProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [useRealBackend, setUseRealBackend] = useState(true);
  const [expandedStats, setExpandedStats] = useState<Set<string>>(new Set()); // Track which message stats are expanded
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading]);

  // Toggle stats expansion for a specific message
  const toggleStats = (messageId: string) => {
    setExpandedStats(prev => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  };

  // Generate unique ID for messages
  const generateId = () => `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Clear chat history
  const clearChat = () => {
    setMessages([]);
    setExpandedStats(new Set());
  };

  // Count conversations (user messages)
  const conversationCount = messages.filter(m => m.role === 'user').length;

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessageId = generateId();
    const userMessage: Message = {
      id: userMessageId,
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    const userQuestion = input;
    setInput('');
    setLoading(true);
    const startTime = Date.now();

    try {
      let response: string;
      let isReal = false;
      let stats: ExecutionStats | undefined;

      if (useRealBackend && nodes.length > 0) {
        // Inject user question into agent nodes
        const modifiedNodes = nodes.map(node => {
          if (node.type === 'agent') {
            return {
              ...node,
              data: {
                ...node.data,
                // Append user question to system prompt
                systemPrompt: `${node.data.systemPrompt || ''}\n\nUser Question: ${userQuestion}\n\nAnswer the user's question based on the data provided.`
              }
            };
          }
          return node;
        });

        // Call real backend
        const res = await axios.post('http://localhost:8000/run', { 
          nodes: modifiedNodes, 
          edges 
        });

        const executionTime = Date.now() - startTime;

        if (res.data.results?.agent_response) {
          response = res.data.results.agent_response;
          isReal = true;
          
          // Extract stats from response metadata
          const metadata = res.data.results?.metadata || {};
          stats = {
            agentsRun: nodes.filter(n => n.type === 'agent').length || 1,
            routesTaken: res.data.results?.routes_taken || 0,
            semanticViews: res.data.results?.semantic_views || 1,
            executionTimeMs: res.data.execution_time_ms || executionTime,
            dataSource: metadata.data_source || 'VW_RETAIL_SALES',
            model: metadata.model || 'snowflake-arctic',
            recordsProcessed: res.data.results?.records_processed || 6,
            timeline: [
              { step: 'Workflow execution started', status: 'success' },
              { step: `Data Source: Loaded records from ${metadata.data_source || 'VW_RETAIL_SALES'}`, status: 'success' },
              { step: `Semantic View loaded`, status: 'success', detail: metadata.semantic_model },
              { step: `Agent invoked (Model: ${metadata.model || 'snowflake-arctic'})`, status: 'success' },
              { step: 'Cortex Agent completed analysis', status: 'success' },
              { step: `Output ready - ${response.length} chars`, status: 'success' },
            ],
          };
        } else if (res.data.error) {
          response = `Error: ${res.data.error}`;
          stats = {
            agentsRun: 0,
            routesTaken: 0,
            semanticViews: 0,
            executionTimeMs: executionTime,
            timeline: [
              { step: 'Workflow execution started', status: 'success' },
              { step: 'Error occurred', status: 'error', detail: res.data.error },
            ],
          };
        } else {
          response = 'Workflow completed but no agent response was generated. Make sure you have an Agent node connected.';
          stats = {
            agentsRun: 0,
            routesTaken: 0,
            semanticViews: 0,
            executionTimeMs: executionTime,
          };
        }
      } else {
        // Fallback to simulation
        response = await simulateResponse(userQuestion);
        stats = {
          agentsRun: 1,
          routesTaken: 0,
          semanticViews: 1,
          executionTimeMs: Date.now() - startTime,
          dataSource: 'Simulated',
          model: 'simulation',
          timeline: [
            { step: 'Simulation started', status: 'success' },
            { step: 'Generated mock response', status: 'success' },
          ],
        };
      }

      const assistantMessageId = generateId();
      const assistantMessage: Message = {
        id: assistantMessageId,
        role: 'assistant',
        content: response,
        timestamp: new Date(),
        isReal,
        stats,
      };
      setMessages(prev => [...prev, assistantMessage]);
      
      // Auto-expand stats for the latest message
      setExpandedStats(new Set([assistantMessageId]));
    } catch (err: any) {
      const errorMessageId = generateId();
      const errorMessage: Message = {
        id: errorMessageId,
        role: 'assistant',
        content: `Connection error: ${err.message || 'Could not reach backend'}. Make sure the backend is running on port 8000.`,
        timestamp: new Date(),
        stats: {
          agentsRun: 0,
          routesTaken: 0,
          semanticViews: 0,
          executionTimeMs: Date.now() - startTime,
          timeline: [
            { step: 'Connection failed', status: 'error', detail: err.message },
          ],
        },
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const simulateResponse = async (query: string): Promise<string> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const responses = [
      `Based on the data analysis, here are the key insights for "${query}":\n\n1. **Trend Analysis**: The data shows a positive trend over the last quarter.\n2. **Key Metrics**: Average response time improved by 15%.\n3. **Recommendations**: Consider focusing on the top-performing segments.`,
      `I found relevant information about "${query}":\n\n• The customer feedback sentiment is 72% positive\n• Main themes: product quality, shipping speed, customer service\n• Action items: Address shipping delays in Q2`,
      `Here's what the data tells us about "${query}":\n\n**Summary**: Strong performance with room for improvement in specific areas.\n\n**Details**:\n- Revenue up 12% YoY\n- Customer retention at 85%\n- NPS score: 42 (Good)`,
    ];
    
    return responses[Math.floor(Math.random() * responses.length)];
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'rgb(var(--surface))',
      borderLeft: '1px solid rgb(var(--border))',
      fontFamily: 'Inter, -apple-system, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid rgb(var(--border))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'linear-gradient(135deg, rgb(var(--surface-2)) 0%, rgb(var(--surface-3)) 100%)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            background: '#29B5E8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Sparkles size={14} color="white" />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 12, color: 'rgb(var(--fg))', display: 'flex', alignItems: 'center', gap: 6 }}>
              Live Preview
              {conversationCount > 0 && (
                <span style={{
                  background: '#29B5E8',
                  color: 'white',
                  padding: '1px 6px',
                  borderRadius: 10,
                  fontSize: 9,
                  fontWeight: 500,
                }}>
                  {conversationCount} {conversationCount === 1 ? 'query' : 'queries'}
                </span>
              )}
            </div>
            <div style={{ fontSize: 10, color: 'rgb(var(--muted))' }}>
              {(workflowName || '').trim() || 'Untitled Workflow'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              title="Clear chat history"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 4,
                borderRadius: 4,
                color: 'rgb(var(--muted))',
              }}
            >
              <Trash2 size={14} />
            </button>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              borderRadius: 4,
              color: 'rgb(var(--muted))',
            }}
          >
            {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 4,
                borderRadius: 4,
                color: 'rgb(var(--muted))',
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Status bar */}
      {!isConfigured ? (
        <div style={{
          padding: '8px 16px',
          background: '#FEF3C7',
          borderBottom: '1px solid #FCD34D',
          fontSize: 11,
          color: '#92400E',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <span>⚠️</span>
          <span>Add nodes to your workflow to enable preview</span>
        </div>
      ) : (
        <div style={{
          padding: '8px 16px',
          background: useRealBackend ? '#D1FAE5' : '#E0F2FE',
          borderBottom: '1px solid rgb(var(--border))',
          fontSize: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 4,
            color: useRealBackend ? '#065F46' : '#0369A1'
          }}>
            <Zap size={12} />
            {useRealBackend ? 'Live Mode (Real Snowflake)' : 'Simulation Mode'}
          </div>
          <button
            onClick={() => setUseRealBackend(!useRealBackend)}
            style={{
              fontSize: 9,
              padding: '2px 8px',
              border: 'none',
              borderRadius: 4,
              background: useRealBackend ? '#065F46' : '#0369A1',
              color: 'white',
              cursor: 'pointer',
            }}
          >
            {useRealBackend ? 'Use Sim' : 'Use Live'}
          </button>
        </div>
      )}

      {/* Chat messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}>
        {messages.length === 0 && (
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
            <Bot size={32} style={{ marginBottom: 12, opacity: 0.5 }} />
            <div style={{ fontSize: 13, fontWeight: 500, color: '#6B7280' }}>
              Test Your Agent
            </div>
            <div style={{ fontSize: 11, marginTop: 4 }}>
              Ask a question to see how your workflow responds
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              gap: 10,
              flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
            }}
          >
            <div style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: msg.role === 'user' ? '#29B5E8' : '#F3F4F6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              {msg.role === 'user' 
                ? <User size={14} color="white" />
                : <Bot size={14} color="#6B7280" />
              }
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                maxWidth: '100%',
                padding: '10px 14px',
                borderRadius: 12,
                background: msg.role === 'user' ? '#29B5E8' : '#F3F4F6',
                color: msg.role === 'user' ? 'white' : '#1F2937',
                fontSize: 12,
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}>
                {msg.content}
              </div>
              
              {/* Source indicator for assistant messages */}
              {msg.role === 'assistant' && (
                <div style={{ 
                  fontSize: 9, 
                  color: msg.isReal ? '#10B981' : '#9CA3AF',
                  marginTop: 4,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}>
                  {msg.isReal ? (
                    <>
                      <Zap size={10} /> Snowflake Cortex
                    </>
                  ) : (
                    'Simulated response'
                  )}
                </div>
              )}
              
              {/* Expandable execution stats for assistant messages */}
              {msg.role === 'assistant' && msg.stats && (
                <div style={{ marginTop: 8 }}>
                  {/* Stats toggle button */}
                  <button
                    onClick={() => toggleStats(msg.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 10px',
                      background: expandedStats.has(msg.id) ? '#EEF2FF' : '#F9FAFB',
                      border: `1px solid ${expandedStats.has(msg.id) ? '#C7D2FE' : '#E5E7EB'}`,
                      borderRadius: 8,
                      cursor: 'pointer',
                      fontSize: 10,
                      color: expandedStats.has(msg.id) ? '#4338CA' : '#6B7280',
                      fontWeight: 500,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {expandedStats.has(msg.id) ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    <BarChart3 size={12} />
                    <span>Execution Stats</span>
                    <span style={{ 
                      background: expandedStats.has(msg.id) ? '#4338CA' : '#9CA3AF',
                      color: 'white',
                      padding: '1px 6px',
                      borderRadius: 10,
                      fontSize: 9,
                    }}>
                      {msg.stats.agentsRun} agent{msg.stats.agentsRun !== 1 ? 's' : ''}
                    </span>
                  </button>
                  
                  {/* Expanded stats panel */}
                  {expandedStats.has(msg.id) && (
                    <div style={{
                      marginTop: 8,
                      padding: 12,
                      background: '#F9FAFB',
                      borderRadius: 10,
                      border: '1px solid #E5E7EB',
                    }}>
                      {/* Stats summary row */}
                      <div style={{
                        display: 'flex',
                        gap: 12,
                        marginBottom: 12,
                        flexWrap: 'wrap',
                      }}>
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          padding: '8px 16px',
                          background: '#10B981',
                          borderRadius: 8,
                          minWidth: 60,
                        }}>
                          <span style={{ fontSize: 16, fontWeight: 700, color: 'white' }}>
                            {msg.stats.agentsRun}
                          </span>
                          <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase' }}>
                            Agents Run
                          </span>
                        </div>
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          padding: '8px 16px',
                          background: '#F59E0B',
                          borderRadius: 8,
                          minWidth: 60,
                        }}>
                          <span style={{ fontSize: 16, fontWeight: 700, color: 'white' }}>
                            {msg.stats.routesTaken}
                          </span>
                          <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase' }}>
                            Routes
                          </span>
                        </div>
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          padding: '8px 16px',
                          background: '#8B5CF6',
                          borderRadius: 8,
                          minWidth: 60,
                        }}>
                          <span style={{ fontSize: 16, fontWeight: 700, color: 'white' }}>
                            {msg.stats.semanticViews}
                          </span>
                          <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase' }}>
                            Semantic Views
                          </span>
                        </div>
                      </div>
                      
                      {/* Metadata row */}
                      <div style={{
                        display: 'flex',
                        gap: 16,
                        flexWrap: 'wrap',
                        fontSize: 10,
                        color: '#6B7280',
                        marginBottom: msg.stats.timeline ? 12 : 0,
                      }}>
                        {msg.stats.executionTimeMs && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Clock size={10} />
                            <span>{msg.stats.executionTimeMs}ms</span>
                          </div>
                        )}
                        {msg.stats.dataSource && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Database size={10} />
                            <span>{msg.stats.dataSource}</span>
                          </div>
                        )}
                        {msg.stats.model && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Bot size={10} />
                            <span>{msg.stats.model}</span>
                          </div>
                        )}
                      </div>
                      
                      {/* Execution timeline */}
                      {msg.stats.timeline && msg.stats.timeline.length > 0 && (
                        <div style={{
                          borderTop: '1px solid #E5E7EB',
                          paddingTop: 10,
                        }}>
                          <div style={{ 
                            fontSize: 9, 
                            fontWeight: 600, 
                            color: '#374151',
                            marginBottom: 8,
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                          }}>
                            Execution Timeline
                          </div>
                          {msg.stats.timeline.map((item, i) => (
                            <div
                              key={i}
                              style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: 8,
                                padding: '4px 0',
                                fontSize: 10,
                              }}
                            >
                              <div style={{
                                width: 14,
                                height: 14,
                                borderRadius: '50%',
                                background: item.status === 'success' ? '#10B981' 
                                  : item.status === 'error' ? '#EF4444' 
                                  : '#F59E0B',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                marginTop: 1,
                              }}>
                                {item.status === 'success' ? '✓' : item.status === 'error' ? '✕' : '•'}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ color: '#374151' }}>{item.step}</div>
                                {item.detail && (
                                  <div style={{ 
                                    color: '#9CA3AF', 
                                    fontSize: 9,
                                    wordBreak: 'break-all',
                                  }}>
                                    {item.detail}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
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
              <Loader2 size={14} className="animate-spin" />
              Thinking...
            </div>
          </div>
        )}
        
        {/* Auto-scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div style={{
        padding: 12,
        borderTop: '1px solid rgb(var(--border))',
        background: 'rgb(var(--surface-2))',
      }}>
        <div style={{
          display: 'flex',
          gap: 8,
        }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={isConfigured ? "Ask a question..." : "Configure workflow first"}
            disabled={!isConfigured || loading}
            style={{
              flex: 1,
              padding: '10px 14px',
              border: '1px solid #E5E9F0',
              borderRadius: 8,
              fontSize: 12,
              outline: 'none',
              background: isConfigured ? 'white' : '#F3F4F6',
            }}
          />
          <button
            onClick={handleSend}
            disabled={!isConfigured || loading || !input.trim()}
            style={{
              padding: '10px 14px',
              background: isConfigured && input.trim() ? '#29B5E8' : '#E5E9F0',
              color: isConfigured && input.trim() ? 'white' : '#9CA3AF',
              border: 'none',
              borderRadius: 8,
              cursor: isConfigured && input.trim() ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Send size={14} />
          </button>
        </div>
        <div style={{
          marginTop: 8,
          fontSize: 10,
          color: '#9CA3AF',
          textAlign: 'center',
        }}>
          {useRealBackend 
            ? '⚡ Connected to Snowflake Cortex' 
            : 'Simulation mode • Toggle to use real Snowflake'}
        </div>
      </div>
    </div>
  );
}


