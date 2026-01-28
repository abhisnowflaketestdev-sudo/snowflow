import { Handle, Position } from 'reactflow';
import { Sparkles, FileText, Heart, Languages, Search, BarChart3 } from 'lucide-react';

interface CortexNodeData {
  label: string;
  cortexFunction: 'complete' | 'summarize' | 'sentiment' | 'translate' | 'embed' | 'search';
  model?: string;
  sourceColumn?: string;
  targetLanguage?: string;
  prompt?: string;
}

const functionConfig = {
  complete: { icon: Sparkles, color: '#8B5CF6', bgColor: '#EDE9FE', label: 'Cortex Complete' },
  summarize: { icon: FileText, color: '#3B82F6', bgColor: '#DBEAFE', label: 'Summarize' },
  sentiment: { icon: Heart, color: '#EC4899', bgColor: '#FCE7F3', label: 'Sentiment' },
  translate: { icon: Languages, color: '#14B8A6', bgColor: '#CCFBF1', label: 'Translate' },
  embed: { icon: BarChart3, color: '#F59E0B', bgColor: '#FEF3C7', label: 'Embed Text' },
  search: { icon: Search, color: '#6366F1', bgColor: '#E0E7FF', label: 'Cortex Search' },
};

export const CortexNode = ({ data, selected }: { data: CortexNodeData; selected?: boolean }) => {
  const config = functionConfig[data.cortexFunction] || functionConfig.complete;
  const Icon = config.icon;

  return (
    <div 
      style={{
        background: 'rgb(var(--surface))',
        border: selected ? `2px solid ${config.color}` : '1px solid rgb(var(--border))',
        borderRadius: 8,
        padding: 12,
        width: 220,
        fontFamily: 'Inter, -apple-system, sans-serif',
        boxShadow: selected ? `0 6px 18px ${config.color}40` : '0 6px 18px rgba(0,0,0,0.25)',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: config.color, width: 10, height: 10 }} />
      
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ 
          width: 36, 
          height: 36, 
          borderRadius: 8, 
          background: config.bgColor, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center' 
        }}>
          <Icon size={18} color={config.color} />
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 500, color: 'rgb(var(--muted))', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {config.label}
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'rgb(var(--fg))' }}>{data.label}</div>
        </div>
      </div>
      
      <div style={{ marginTop: 10, padding: 8, background: 'rgb(var(--surface-2))', border: '1px solid rgb(var(--border))', borderRadius: 6, fontSize: 11, color: 'rgb(var(--muted))' }}>
        {data.cortexFunction === 'complete' && data.model && (
          <div><span style={{ fontWeight: 500 }}>Model:</span> {data.model}</div>
        )}
        {data.cortexFunction === 'translate' && data.targetLanguage && (
          <div><span style={{ fontWeight: 500 }}>To:</span> {data.targetLanguage}</div>
        )}
        {data.sourceColumn && (
          <div><span style={{ fontWeight: 500 }}>Column:</span> {data.sourceColumn}</div>
        )}
        {!data.model && !data.sourceColumn && !data.targetLanguage && (
          <div style={{ fontStyle: 'italic' }}>Configure in properties →</div>
        )}
      </div>
      
      <Handle type="source" position={Position.Right} style={{ background: config.color, width: 10, height: 10 }} />
    </div>
  );
};












