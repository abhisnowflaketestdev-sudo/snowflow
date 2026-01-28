import { Handle, Position } from 'reactflow';
import { Table, Eye, Zap, Activity } from 'lucide-react';

/**
 * SnowflakeSourceNode - 1:1 mapping to Snowflake table/view access
 * 
 * Maps to: SELECT [columns] FROM [database].[schema].[table] [WHERE filter] [LIMIT limit]
 * 
 * All properties mirror Snowflake's table access capabilities.
 * Supports: Table, View, Dynamic Table, Stream
 */

export interface SnowflakeSourceData {
  // Object identification (required)
  label: string;              // Display name in UI
  database: string;           // Snowflake database name
  schema: string;             // Snowflake schema name
  objectType: 'table' | 'view' | 'dynamic_table' | 'stream';
  
  // Query configuration (optional)
  columns: string;            // Comma-separated columns, or * for all
  filter: string;             // WHERE clause (without WHERE keyword)
  orderBy: string;            // ORDER BY clause (without ORDER BY keyword)
  limit: number;              // LIMIT clause
  
  // Dynamic Table specific
  targetLag?: string;         // e.g., '1 hour', '5 minutes'
  warehouse?: string;         // Compute warehouse
  
  // Stream specific
  sourceTable?: string;       // Source table for stream
  appendOnly?: boolean;       // Append-only mode
  showInitialRows?: boolean;  // Include initial rows
  
  // Metadata (read-only, populated by system)
  rowCount?: number;          // Estimated row count
  lastModified?: string;      // Last modified timestamp
  owner?: string;             // Object owner
  
  // Governance (read-only, populated by system)
  rowAccessPolicy?: string;   // Applied row access policy
  maskingPolicies?: string[]; // Applied masking policies
  tags?: Record<string, string>; // Applied tags
}

const objectTypeConfig = {
  table: { icon: Table, label: 'TABLE', color: '#29B5E8', bg: '#E0F4FC' },
  view: { icon: Eye, label: 'VIEW', color: '#0EA5E9', bg: '#E0F7FA' },
  dynamic_table: { icon: Zap, label: 'DYNAMIC TABLE', color: '#8B5CF6', bg: '#EDE9FE' },
  stream: { icon: Activity, label: 'STREAM', color: '#10B981', bg: '#D1FAE5' },
};

export const SnowflakeSourceNode = ({ data, selected }: { data: SnowflakeSourceData; selected?: boolean }) => {
  const config = objectTypeConfig[data.objectType] || objectTypeConfig.table;
  const Icon = config.icon;
  
  const hasFilter = data.filter && data.filter.trim() !== '';
  const hasLimit = data.limit && data.limit > 0;
  const hasColumns = data.columns && data.columns !== '*' && data.columns.trim() !== '';
  
  return (
    <div 
      style={{
        background: 'rgb(var(--surface))',
        border: selected ? `2px solid ${config.color}` : '1px solid rgb(var(--border))',
        borderRadius: 8,
        padding: 12,
        width: 240,
        fontFamily: 'Inter, -apple-system, sans-serif',
        boxShadow: selected ? `0 4px 12px ${config.color}40` : '0 1px 3px rgba(0,0,0,0.1)',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: config.color, width: 10, height: 10, border: '2px solid rgb(var(--handle-border))' }} />
      
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ 
          width: 36, 
          height: 36, 
          borderRadius: 8, 
          background: config.bg, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center' 
        }}>
          <Icon size={18} color={config.color} />
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 500, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {config.label}
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'rgb(var(--fg))' }}>{data.label}</div>
        </div>
      </div>
      
      {/* Connection info */}
      <div style={{ marginTop: 10, padding: 8, background: 'rgb(var(--surface-2))', borderRadius: 6, fontSize: 11, color: 'rgb(var(--muted))', border: '1px solid rgb(var(--border))' }}>
        {data.database && <div><span style={{ fontWeight: 500 }}>DB:</span> {data.database}</div>}
        {data.schema && <div><span style={{ fontWeight: 500 }}>Schema:</span> {data.schema}</div>}
      </div>
      
      {/* Query modifiers */}
      {(hasColumns || hasFilter || hasLimit) && (
        <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {hasColumns && (
            <span style={{ fontSize: 9, background: '#DBEAFE', color: '#1D4ED8', padding: '2px 6px', borderRadius: 4 }}>
              {data.columns.split(',').length} cols
            </span>
          )}
          {hasFilter && (
            <span style={{ fontSize: 9, background: '#FEF3C7', color: '#B45309', padding: '2px 6px', borderRadius: 4 }}>
              filtered
            </span>
          )}
          {hasLimit && (
            <span style={{ fontSize: 9, background: '#E0E7FF', color: '#4338CA', padding: '2px 6px', borderRadius: 4 }}>
              limit {data.limit}
            </span>
          )}
        </div>
      )}
      
      {/* Governance indicators */}
      {data.rowAccessPolicy && (
        <div style={{ marginTop: 6, fontSize: 9, color: '#059669', display: 'flex', alignItems: 'center', gap: 4 }}>
          🔒 Row Access Policy
        </div>
      )}
      
      <Handle type="source" position={Position.Right} style={{ background: config.color, width: 10, height: 10, border: '2px solid rgb(var(--handle-border))' }} />
    </div>
  );
};
