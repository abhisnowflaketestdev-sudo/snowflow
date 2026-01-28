import { Handle, Position } from 'reactflow';
import { Crown, Users } from 'lucide-react';

interface SupervisorNodeProps {
  data: {
    label: string;
    model: string;
    delegationStrategy: 'parallel' | 'sequential' | 'adaptive';
    systemPrompt: string;
    maxDelegations: number;
    aggregationMethod: 'merge' | 'vote' | 'first' | 'custom';
  };
  selected: boolean;
}

export function SupervisorNode({ data, selected }: SupervisorNodeProps) {
  const maxIter = (data.maxDelegations ?? 5) as number;
  return (
    <div style={{
      background: 'rgb(var(--surface-3))',
      border: selected ? '2px solid #F59E0B' : '1px solid rgb(var(--border-strong))',
      borderRadius: 12,
      padding: 0,
      minWidth: 200,
      boxShadow: selected ? '0 10px 26px rgba(0,0,0,0.35)' : '0 8px 20px rgba(0,0,0,0.25)',
      fontFamily: 'Inter, -apple-system, sans-serif',
    }}>
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: '#F59E0B', width: 10, height: 10, border: '2px solid rgb(var(--handle-border))' }}
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
          background: 'rgba(245, 158, 11, 0.16)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Crown size={14} color="white" />
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'rgb(var(--fg))' }}>Supervisor</div>
          <div style={{ fontSize: 10, color: 'rgb(var(--muted))' }}>{data.label || 'Orchestrator'}</div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '8px 12px' }}>
        <div style={{ fontSize: 9, color: 'rgb(var(--fg-muted))', marginBottom: 4 }}>
          Model: <strong>{data.model || 'mistral-large2'}</strong>
        </div>
        <div style={{ fontSize: 9, color: 'rgb(var(--fg-muted))', marginBottom: 4 }}>
          Strategy: <strong>{data.delegationStrategy || 'adaptive'}</strong>
        </div>
        <div style={{ fontSize: 9, color: 'rgb(var(--fg-muted))', marginBottom: 4 }}>
          Max iterations: <strong>{maxIter}</strong>
        </div>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 4, 
          fontSize: 9, 
          color: 'rgb(var(--fg))',
          background: 'rgb(var(--surface-2))',
          border: '1px solid rgb(var(--border))',
          padding: '4px 6px',
          borderRadius: 4,
          marginTop: 4
        }}>
          <Users size={10} />
          <span>Delegates to child agents</span>
        </div>
      </div>

      {/* Output handles for delegated agents */}
      <Handle
        type="source"
        position={Position.Right}
        id="delegate-1"
        style={{ background: '#F59E0B', width: 10, height: 10, top: '25%', border: '2px solid rgb(var(--handle-border))' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="delegate-2"
        style={{ background: '#F59E0B', width: 10, height: 10, top: '50%', border: '2px solid rgb(var(--handle-border))' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="delegate-3"
        style={{ background: '#F59E0B', width: 10, height: 10, top: '75%', border: '2px solid rgb(var(--handle-border))' }}
      />
      
      {/* Bottom output for aggregated result */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="output"
        style={{ background: '#10B981', width: 10, height: 10, border: '2px solid rgb(var(--handle-border))' }}
      />
    </div>
  );
}











