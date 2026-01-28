import { Handle, Position } from 'reactflow';
import { FileJson, Layers } from 'lucide-react';

/**
 * SemanticModelNode - Represents a Snowflake Semantic Model
 * 
 * Semantic models are YAML files that define:
 * - Tables and their relationships
 * - Dimensions and measures
 * - Business context and descriptions
 * 
 * Reference: https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-analyst/semantic-model-spec
 */

export interface SemanticModelData {
  label: string;
  
  // Semantic model location
  database: string;
  schema: string;
  stage: string;           // Stage where YAML is stored
  yamlFile: string;        // Path to YAML file in stage
  semanticPath?: string;   // Full stage path (e.g., @DB.SCHEMA.STAGE/file.yaml)
  
  // Model metadata (read from YAML or manually set)
  description?: string;
  tables?: string[];       // List of tables in the model
  verified?: boolean;      // Whether model has been validated
}

export const SemanticModelNode = ({ data, selected }: { data: SemanticModelData; selected?: boolean }) => {
  return (
    <div 
      style={{
        background: 'rgb(var(--surface-3))',
        border: selected ? '2px solid #6366F1' : '1px solid rgb(var(--border-strong))',
        borderRadius: 8,
        padding: 12,
        width: 240,
        fontFamily: 'Inter, -apple-system, sans-serif',
        boxShadow: selected ? '0 10px 26px rgba(0,0,0,0.35)' : '0 8px 20px rgba(0,0,0,0.25)',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: '#6366F1', width: 10, height: 10, border: '2px solid rgb(var(--handle-border))' }} />
      
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <div style={{ 
          width: 36, 
          height: 36, 
          borderRadius: 8, 
          background: 'rgba(99, 102, 241, 0.16)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Layers size={18} color="#6366F1" />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 500, color: 'rgb(var(--muted))', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Semantic Model
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'rgb(var(--fg))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={data.label}>{data.label}</div>
        </div>
      </div>
      
      {/* Model location */}
      <div style={{ marginTop: 10, padding: 8, background: 'rgb(var(--surface-2))', borderRadius: 6, border: '1px solid rgb(var(--border))', fontSize: 11, color: 'rgb(var(--muted))', overflow: 'hidden' }}>
        {data.semanticPath ? (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, minWidth: 0 }}>
            <FileJson size={12} />
            <span
              style={{
                fontFamily: 'monospace',
                fontSize: 9,
                minWidth: 0,
                overflow: 'hidden',
                wordBreak: 'break-all',
                display: '-webkit-box',
                WebkitBoxOrient: 'vertical' as any,
                WebkitLineClamp: 2 as any,
              }}
              title={data.semanticPath}
            >
              {data.semanticPath}
            </span>
          </div>
        ) : data.stage && data.yamlFile ? (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, minWidth: 0 }}>
            <FileJson size={12} />
            <span
              style={{
                fontFamily: 'monospace',
                fontSize: 10,
                minWidth: 0,
                overflow: 'hidden',
                wordBreak: 'break-all',
                display: '-webkit-box',
                WebkitBoxOrient: 'vertical' as any,
                WebkitLineClamp: 2 as any,
              }}
              title={`@${data.database}.${data.schema}.${data.stage}/${data.yamlFile}`}
            >
              @{data.database}.{data.schema}.{data.stage}/{data.yamlFile}
            </span>
          </div>
        ) : (
          <div style={{ fontStyle: 'italic' }}>Configure YAML location →</div>
        )}
      </div>
      
      {/* Tables count */}
      {data.tables && data.tables.length > 0 && (
        <div style={{ marginTop: 6, fontSize: 10, color: 'rgb(var(--muted))' }}>
          {data.tables.length} tables defined
        </div>
      )}
      
      {/* Verified badge */}
      {data.verified && (
        <div style={{ marginTop: 6, display: 'flex', gap: 4 }}>
          <span style={{ fontSize: 9, background: '#D1FAE5', color: '#065F46', padding: '2px 6px', borderRadius: 4 }}>
            ✓ Verified
          </span>
        </div>
      )}
      
      <Handle type="source" position={Position.Right} style={{ background: '#6366F1', width: 10, height: 10, border: '2px solid rgb(var(--handle-border))' }} />
    </div>
  );
};








