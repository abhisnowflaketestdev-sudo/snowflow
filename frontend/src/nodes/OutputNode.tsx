import { Handle, Position } from 'reactflow';
import { FileOutput, Eye, Download, Copy, Check } from 'lucide-react';
import { useState } from 'react';

interface OutputNodeData {
  label: string;
  outputType?: 'display' | 'table' | 'chart' | 'json' | 'yaml' | 'text';
  channel?: 'snowflake_intelligence' | 'api' | 'slack' | 'teams';
  generatedContent?: string;
}

export const OutputNode = ({ data, selected }: { data: OutputNodeData; selected?: boolean }) => {
  const [showPreview, setShowPreview] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const hasContent = Boolean(data.generatedContent);
  
  // Green theme for output nodes - consistent with FileOutputNode
  const config = { color: '#10B981', label: data.outputType || 'Display' };
  
  // Channel labels for display
  const channelLabels: Record<string, { label: string; icon: string }> = {
    snowflake_intelligence: { label: 'Snowflake Intelligence', icon: '❄️' },
    api: { label: 'REST API', icon: '🔌' },
    slack: { label: 'Slack', icon: '💬' },
    teams: { label: 'Teams', icon: '👥' },
  };
  const channelInfo = channelLabels[data.channel || 'snowflake_intelligence'];
  
  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!data.generatedContent) return;
    
    let ext = 'txt';
    let mimeType = 'text/plain';
    if (data.outputType === 'json') { ext = 'json'; mimeType = 'application/json'; }
    else if (data.outputType === 'yaml') { ext = 'yaml'; mimeType = 'text/yaml'; }
    
    const blob = new Blob([data.generatedContent], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.label?.replace(/\s+/g, '_').toLowerCase() || 'output'}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!data.generatedContent) return;
    navigator.clipboard.writeText(data.generatedContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  const handlePreview = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowPreview(!showPreview);
  };

  return (
    <div 
      style={{
        background: 'rgb(var(--surface-3))',
        border: selected ? `2px solid ${config.color}` : '1px solid rgb(var(--border-strong))',
        borderRadius: 10,
        padding: 14,
        width: 260,
        fontFamily: 'Inter, -apple-system, sans-serif',
        boxShadow: selected ? `0 10px 26px rgba(0,0,0,0.35)` : '0 8px 20px rgba(0,0,0,0.25)',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: config.color, width: 10, height: 10, border: '2px solid rgb(var(--handle-border))' }} />
      
      {/* Header - EXACT same style as FileOutputNode */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{ 
          width: 40, 
          height: 40, 
          borderRadius: 10, 
          background: `${config.color}15`, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center' 
        }}>
          <FileOutput size={20} color={config.color} />
        </div>
        <div>
          <div style={{ fontSize: 9, fontWeight: 600, color: config.color, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Output
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'rgb(var(--fg))' }}>{data.label}</div>
        </div>
      </div>
      
      {/* Output info - EXACT same style as FileOutputNode */}
      <div style={{ padding: 10, background: 'rgb(var(--surface-2))', borderRadius: 8, fontSize: 11, marginBottom: 8, border: '1px solid rgb(var(--border))' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <span style={{ 
            background: config.color,
            color: 'white',
            padding: '2px 6px',
            borderRadius: 4,
            fontSize: 9,
            fontWeight: 600
          }}>
            {config.label}
          </span>
          <span style={{ 
            background: 'rgb(var(--surface-3))',
            color: 'rgb(var(--fg-muted))',
            padding: '2px 6px',
            borderRadius: 4,
            fontSize: 9,
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: 3
          }}>
            {channelInfo.icon} {channelInfo.label}
          </span>
        </div>
        {hasContent ? (
          <div style={{ color: '#10B981', display: 'flex', alignItems: 'center', gap: 4 }}>
            ✓ Ready ({data.generatedContent?.length} chars)
          </div>
        ) : (
          <div style={{ color: 'rgb(var(--muted))', fontStyle: 'italic' }}>
            Waiting for input...
          </div>
        )}
      </div>
      
      {/* Action Buttons - EXACT same style as FileOutputNode */}
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={handlePreview}
          disabled={!hasContent}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            padding: '6px 8px',
            borderRadius: 6,
            border: 'none',
            background: hasContent ? 'rgb(var(--surface-3))' : 'rgb(var(--surface-2))',
            color: hasContent ? 'rgb(var(--fg-muted))' : 'rgb(var(--muted))',
            fontSize: 10,
            fontWeight: 500,
            cursor: hasContent ? 'pointer' : 'not-allowed',
          }}
        >
          <Eye size={12} />
          Preview
        </button>
        <button
          onClick={handleCopy}
          disabled={!hasContent}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            padding: '6px 8px',
            borderRadius: 6,
            border: 'none',
            background: copied ? config.color : (hasContent ? 'rgb(var(--surface-3))' : 'rgb(var(--surface-2))'),
            color: copied ? 'white' : (hasContent ? 'rgb(var(--fg-muted))' : 'rgb(var(--muted))'),
            fontSize: 10,
            fontWeight: 500,
            cursor: hasContent ? 'pointer' : 'not-allowed',
          }}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
        </button>
        <button
          onClick={handleDownload}
          disabled={!hasContent}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            padding: '6px 8px',
            borderRadius: 6,
            border: 'none',
            background: hasContent ? config.color : 'rgb(var(--surface-2))',
            color: hasContent ? 'white' : 'rgb(var(--muted))',
            fontSize: 10,
            fontWeight: 500,
            cursor: hasContent ? 'pointer' : 'not-allowed',
          }}
        >
          <Download size={12} />
          Download
        </button>
      </div>
      
      {/* Preview Panel - EXACT same style as FileOutputNode */}
      {showPreview && hasContent && (
        <div 
          onClick={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
          style={{
            marginTop: 8,
            padding: 8,
            background: 'rgb(var(--surface-3))',
            borderRadius: 6,
            maxHeight: 150,
            overflow: 'auto',
          }}
        >
          <pre style={{
            margin: 0,
            fontSize: 9,
            fontFamily: 'Monaco, monospace',
            color: 'rgb(var(--fg))',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}>
            {data.generatedContent?.substring(0, 500)}
            {(data.generatedContent?.length || 0) > 500 && '\n...'}
          </pre>
        </div>
      )}
    </div>
  );
};
