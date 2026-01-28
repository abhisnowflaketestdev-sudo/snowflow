import { Handle, Position } from 'reactflow';
import { GitBranch } from 'lucide-react';

interface RouterNodeProps {
  data: {
    label: string;
    routingStrategy: 'intent' | 'keyword' | 'llm' | 'round_robin';
    routes: Array<{
      name: string;
      condition: string;
      targetAgent: string;
    }>;
  };
  selected: boolean;
}

export function RouterNode({ data, selected }: RouterNodeProps) {
  const routeCount = data.routes?.length || 0;

  return (
    <div style={{
      background: 'rgb(var(--surface-3))',
      border: selected ? '2px solid #A855F7' : '1px solid rgb(var(--border-strong))',
      borderRadius: 12,
      padding: 0,
      minWidth: 180,
      boxShadow: selected ? '0 10px 26px rgba(0,0,0,0.35)' : '0 8px 20px rgba(0,0,0,0.25)',
      fontFamily: 'Inter, -apple-system, sans-serif',
    }}>
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: '#A855F7', width: 10, height: 10, border: '2px solid rgb(var(--handle-border))' }}
      />

      {/* Header */}
      <div style={{
        padding: '10px 12px',
        borderBottom: '1px solid rgb(var(--border))',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <div style={{
          width: 28,
          height: 28,
          borderRadius: 6,
          background: 'rgba(168, 85, 247, 0.16)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <GitBranch size={14} color="white" />
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'rgb(var(--fg))' }}>Router</div>
          <div style={{ fontSize: 10, color: 'rgb(var(--muted))' }}>{data.label || 'Intent Router'}</div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '8px 12px' }}>
        <div style={{ fontSize: 9, color: 'rgb(var(--fg-muted))', marginBottom: 4 }}>
          Strategy: <strong>{data.routingStrategy || 'intent'}</strong>
        </div>
        <div style={{ fontSize: 9, color: 'rgb(var(--muted))' }}>
          {routeCount} route{routeCount !== 1 ? 's' : ''} configured
        </div>
      </div>

      {/* Multiple output handles for routes */}
      <Handle
        type="source"
        position={Position.Right}
        id="route-1"
        style={{ background: '#A855F7', width: 10, height: 10, top: '30%', border: '2px solid rgb(var(--handle-border))' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="route-2"
        style={{ background: '#A855F7', width: 10, height: 10, top: '50%', border: '2px solid rgb(var(--handle-border))' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="route-3"
        style={{ background: '#A855F7', width: 10, height: 10, top: '70%', border: '2px solid rgb(var(--handle-border))' }}
      />
    </div>
  );
}











