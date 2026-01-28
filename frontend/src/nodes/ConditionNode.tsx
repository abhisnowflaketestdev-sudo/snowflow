import { Handle, Position } from 'reactflow';
import { GitBranch } from 'lucide-react';

interface ConditionNodeData {
  label: string;
  condition?: string;
  trueLabel?: string;
  falseLabel?: string;
}

export const ConditionNode = ({ data, selected }: { data: ConditionNodeData; selected?: boolean }) => {
  return (
    <div 
      style={{
        background: 'rgb(var(--surface))',
        border: selected ? '2px solid #F59E0B' : '1px solid rgb(var(--border))',
        borderRadius: 8,
        padding: 12,
        width: 200,
        fontFamily: 'Inter, -apple-system, sans-serif',
        boxShadow: selected ? '0 4px 12px rgba(245,158,11,0.25)' : '0 1px 3px rgba(0,0,0,0.1)',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: '#F59E0B', width: 10, height: 10, border: '2px solid rgb(var(--handle-border))' }} />
      
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ 
          width: 36, 
          height: 36, 
          borderRadius: 8, 
          background: '#FEF3C7', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center' 
        }}>
          <GitBranch size={18} color="#F59E0B" />
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 500, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Condition
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'rgb(var(--fg))' }}>{data.label}</div>
        </div>
      </div>
      
      {data.condition && (
        <div style={{ marginTop: 10, padding: 8, background: 'rgb(var(--surface-2))', borderRadius: 6, border: '1px solid rgb(var(--border))', fontSize: 11, color: 'rgb(var(--fg-muted))', fontFamily: 'monospace' }}>
          {data.condition}
        </div>
      )}
      
      {/* True output */}
      <Handle 
        type="source" 
        position={Position.Right} 
        id="true"
        style={{ background: '#10B981', width: 10, height: 10, border: '2px solid rgb(var(--handle-border))', top: '30%' }} 
      />
      {/* False output */}
      <Handle 
        type="source" 
        position={Position.Right} 
        id="false"
        style={{ background: '#EF4444', width: 10, height: 10, border: '2px solid rgb(var(--handle-border))', top: '70%' }} 
      />
      
      <div style={{ position: 'absolute', right: -30, top: '26%', fontSize: 9, color: '#10B981', fontWeight: 600 }}>✓</div>
      <div style={{ position: 'absolute', right: -30, top: '66%', fontSize: 9, color: '#EF4444', fontWeight: 600 }}>✗</div>
    </div>
  );
};












