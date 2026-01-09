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
  return (
    <div style={{
      background: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)',
      border: selected ? '2px solid #F59E0B' : '1px solid #FDE68A',
      borderRadius: 12,
      padding: 0,
      minWidth: 200,
      boxShadow: selected ? '0 0 0 2px rgba(245,158,11,0.2)' : '0 2px 8px rgba(0,0,0,0.08)',
      fontFamily: 'Inter, -apple-system, sans-serif',
    }}>
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: '#F59E0B', width: 10, height: 10 }}
      />

      {/* Header */}
      <div style={{
        padding: '10px 12px',
        borderBottom: '1px solid #FDE68A',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <div style={{
          width: 28,
          height: 28,
          borderRadius: 6,
          background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Crown size={14} color="white" />
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#92400E' }}>Supervisor</div>
          <div style={{ fontSize: 10, color: '#B45309' }}>{data.label || 'Orchestrator'}</div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '8px 12px' }}>
        <div style={{ fontSize: 9, color: '#92400E', marginBottom: 4 }}>
          Model: <strong>{data.model || 'mistral-large2'}</strong>
        </div>
        <div style={{ fontSize: 9, color: '#B45309', marginBottom: 4 }}>
          Strategy: <strong>{data.delegationStrategy || 'adaptive'}</strong>
        </div>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 4, 
          fontSize: 9, 
          color: '#D97706',
          background: '#FEF3C7',
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
        style={{ background: '#F59E0B', width: 10, height: 10, top: '25%' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="delegate-2"
        style={{ background: '#F59E0B', width: 10, height: 10, top: '50%' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="delegate-3"
        style={{ background: '#F59E0B', width: 10, height: 10, top: '75%' }}
      />
      
      {/* Bottom output for aggregated result */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="output"
        style={{ background: '#10B981', width: 10, height: 10 }}
      />
    </div>
  );
}











