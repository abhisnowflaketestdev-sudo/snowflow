/**
 * DAX Translator Node
 * 
 * A workflow node that translates DAX expressions to Snowflake SQL.
 * Can be connected in flows for real-time semantic model translation.
 * 
 * Features INLINE EXPANSION - click on input/output to expand within the node,
 * rather than opening a config panel.
 */

import React, { memo, useState, useEffect, useCallback, useRef } from 'react';
import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import { Sparkles, Check, AlertTriangle, Loader2, Copy, Maximize2, Minimize2 } from 'lucide-react';

interface DaxTranslatorData {
  label?: string;
  daxExpression?: string;
  sqlOutput?: string;
  confidence?: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
  autoTranslate?: boolean;
}

const API_BASE = 'http://localhost:8000';

const DaxTranslatorNode: React.FC<NodeProps<DaxTranslatorData>> = ({ data, selected }) => {
  const [isTranslating, setIsTranslating] = useState(false);
  const [localSql, setLocalSql] = useState(data.sqlOutput || '');
  const [localConfidence, setLocalConfidence] = useState(data.confidence);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [copiedField, setCopiedField] = useState<'dax' | 'sql' | null>(null);
  const daxInputRef = useRef<HTMLDivElement>(null);
  const sqlOutputRef = useRef<HTMLDivElement>(null);

  // Handle wheel events to prevent canvas zoom when scrolling inside expanded content
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (isExpanded) {
        e.stopPropagation();
      }
    };
    
    const daxEl = daxInputRef.current;
    const sqlEl = sqlOutputRef.current;
    
    if (daxEl) {
      daxEl.addEventListener('wheel', handleWheel, { passive: true });
    }
    if (sqlEl) {
      sqlEl.addEventListener('wheel', handleWheel, { passive: true });
    }
    
    return () => {
      if (daxEl) {
        daxEl.removeEventListener('wheel', handleWheel);
      }
      if (sqlEl) {
        sqlEl.removeEventListener('wheel', handleWheel);
      }
    };
  }, [isExpanded]);

  const translate = useCallback(async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!data.daxExpression?.trim()) return;
    
    setIsTranslating(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE}/api/translate/expression`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dax: data.daxExpression }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        setLocalSql(result.sql);
        setLocalConfidence(result.confidence);
      } else {
        setError(result.errors?.[0] || 'Translation failed');
      }
    } catch (err) {
      setError('API error');
    } finally {
      setIsTranslating(false);
    }
  }, [data.daxExpression]);

  // Auto-translate when expression changes (if enabled)
  useEffect(() => {
    if (data.autoTranslate && data.daxExpression) {
      const timer = setTimeout(() => translate(), 500);
      return () => clearTimeout(timer);
    }
  }, [data.daxExpression, data.autoTranslate, translate]);

  const getConfidenceColor = (conf?: string) => {
    switch (conf) {
      case 'HIGH': return '#22c55e';
      case 'MEDIUM': return '#f59e0b';
      case 'LOW': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const handleCopy = (e: React.MouseEvent, field: 'dax' | 'sql', content: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(content);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
  };

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #1e1e2e 0%, #2d2d44 100%)',
        border: selected ? '2px solid #667eea' : '1px solid rgba(255,255,255,0.1)',
        borderRadius: '12px',
        padding: '0',
        width: isExpanded ? '400px' : '280px',
        fontFamily: "'Inter', system-ui, sans-serif",
        boxShadow: selected 
          ? '0 0 20px rgba(102,126,234,0.3)' 
          : '0 4px 12px rgba(0,0,0,0.3)',
        transition: 'width 0.3s ease, box-shadow 0.3s ease',
      }}
    >
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        style={{
          background: '#667eea',
          width: 10,
          height: 10,
          border: '2px solid #1e1e2e',
        }}
      />

      {/* Header - THIS area opens config panel */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Sparkles size={16} color="white" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ 
            color: '#fff', 
            fontWeight: 600, 
            fontSize: '13px',
          }}>
            {data.label || 'DAX Translator'}
          </div>
          <div style={{ 
            color: '#888', 
            fontSize: '10px',
          }}>
            DAX → Snowflake SQL
          </div>
        </div>
        
        {/* Expand/Collapse button */}
        <button
          onClick={handleToggleExpand}
          style={{
            background: 'rgba(255,255,255,0.1)',
            border: 'none',
            borderRadius: '6px',
            padding: '4px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title={isExpanded ? 'Collapse' : 'Expand'}
        >
          {isExpanded ? <Minimize2 size={14} color="#888" /> : <Maximize2 size={14} color="#888" />}
        </button>
        
        {/* Status indicator */}
        {localConfidence && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 8px',
              borderRadius: '12px',
              fontSize: '9px',
              fontWeight: 600,
              background: `${getConfidenceColor(localConfidence)}22`,
              color: getConfidenceColor(localConfidence),
            }}
          >
            {localConfidence === 'HIGH' ? <Check size={10} /> : <AlertTriangle size={10} />}
            {localConfidence}
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: '12px 16px' }}>
        {/* DAX Input - Clickable to expand inline */}
        <div style={{ marginBottom: '10px' }}>
          <div style={{ 
            fontSize: '9px', 
          color: '#666', 
            marginBottom: '4px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span>DAX Input</span>
            {data.daxExpression && (
              <button
                onClick={(e) => handleCopy(e, 'dax', data.daxExpression || '')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                }}
                title="Copy DAX"
              >
                {copiedField === 'dax' ? (
                  <Check size={10} color="#22c55e" />
                ) : (
                  <Copy size={10} color="#666" />
                )}
              </button>
            )}
          </div>
          <div
            ref={daxInputRef}
            className={isExpanded ? 'nowheel nodrag' : ''}
            onClick={handleToggleExpand}
            style={{
              background: 'rgba(0,0,0,0.3)',
              borderRadius: '6px',
              padding: '8px 10px',
              fontSize: '11px',
              color: data.daxExpression ? '#a78bfa' : '#555',
              fontFamily: "'JetBrains Mono', monospace",
              whiteSpace: isExpanded ? 'pre-wrap' : 'nowrap',
              overflow: isExpanded ? 'auto' : 'hidden',
              textOverflow: isExpanded ? 'unset' : 'ellipsis',
              maxHeight: isExpanded ? '150px' : '32px',
              cursor: 'pointer',
              transition: 'max-height 0.3s ease',
              overscrollBehavior: 'contain',
            }}
          >
            {data.daxExpression || 'No expression set...'}
          </div>
        </div>

        {/* SQL Output - Clickable to expand inline */}
        <div>
          <div style={{ 
            fontSize: '9px', 
            color: '#666', 
            marginBottom: '4px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span>SQL Output</span>
            {localSql && (
              <button
                onClick={(e) => handleCopy(e, 'sql', localSql)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                }}
                title="Copy SQL"
              >
                {copiedField === 'sql' ? (
                  <Check size={10} color="#22c55e" />
                ) : (
                  <Copy size={10} color="#666" />
                )}
              </button>
            )}
          </div>
          <div
            ref={sqlOutputRef}
            className={isExpanded ? 'nowheel nodrag' : ''}
            onClick={handleToggleExpand}
            style={{
              background: 'rgba(0,0,0,0.3)',
              borderRadius: '6px',
              padding: '8px 10px',
              fontSize: '11px',
              color: error ? '#ef4444' : localSql ? '#22c55e' : '#555',
              fontFamily: "'JetBrains Mono', monospace",
              whiteSpace: isExpanded ? 'pre-wrap' : 'nowrap',
              overflow: isExpanded ? 'auto' : 'hidden',
              textOverflow: isExpanded ? 'unset' : 'ellipsis',
              maxHeight: isExpanded ? '150px' : '32px',
              minHeight: '32px',
              display: 'flex',
              alignItems: isExpanded ? 'flex-start' : 'center',
              cursor: 'pointer',
              transition: 'max-height 0.3s ease',
              overscrollBehavior: 'contain',
            }}
          >
            {isTranslating ? (
              <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
            ) : error ? (
              error
            ) : localSql ? (
              localSql
            ) : (
              'Click to translate...'
            )}
          </div>
        </div>

        {/* Translate Button */}
        {!data.autoTranslate && (
          <button
            onClick={translate}
            disabled={isTranslating || !data.daxExpression}
            style={{
              width: '100%',
              marginTop: '10px',
              padding: '8px',
              background: isTranslating 
                ? 'rgba(102,126,234,0.3)' 
                : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: 'none',
              borderRadius: '6px',
              color: '#fff',
              fontSize: '11px',
              fontWeight: 600,
              cursor: isTranslating ? 'wait' : 'pointer',
              opacity: !data.daxExpression ? 0.5 : 1,
            }}
          >
            {isTranslating ? 'Translating...' : '⚡ Translate'}
          </button>
        )}
      </div>

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        style={{
          background: '#22c55e',
          width: 10,
          height: 10,
          border: '2px solid #1e1e2e',
        }}
      />

      {/* CSS for spin animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default memo(DaxTranslatorNode);

