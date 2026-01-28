import { useState } from 'react';
import { Send, Bot, User, Loader2, Sparkles, X, Maximize2, Minimize2, Zap } from 'lucide-react';
import axios from 'axios';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isReal?: boolean;  // Was this from real Snowflake?
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

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    const userQuestion = input;
    setInput('');
    setLoading(true);

    try {
      let response: string;
      let isReal = false;

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

        if (res.data.results?.agent_response) {
          response = res.data.results.agent_response;
          isReal = true;
        } else if (res.data.error) {
          response = `Error: ${res.data.error}`;
        } else {
          response = 'Workflow completed but no agent response was generated. Make sure you have an Agent node connected.';
        }
      } else {
        // Fallback to simulation
        response = await simulateResponse(userQuestion);
      }

      const assistantMessage: Message = {
        role: 'assistant',
        content: response,
        timestamp: new Date(),
        isReal,
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (err: any) {
      const errorMessage: Message = {
        role: 'assistant',
        content: `Connection error: ${err.message || 'Could not reach backend'}. Make sure the backend is running on port 8000.`,
        timestamp: new Date(),
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
            <div style={{ fontWeight: 600, fontSize: 12, color: 'rgb(var(--fg))' }}>
              Live Preview
            </div>
            <div style={{ fontSize: 10, color: 'rgb(var(--muted))' }}>
              {(workflowName || '').trim() || 'Untitled Workflow'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
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
            key={idx}
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
            <div>
              <div style={{
                maxWidth: '100%',
                padding: '10px 14px',
                borderRadius: 12,
                background: msg.role === 'user' ? '#29B5E8' : '#F3F4F6',
                color: msg.role === 'user' ? 'white' : '#1F2937',
                fontSize: 12,
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
              }}>
                {msg.content}
              </div>
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


