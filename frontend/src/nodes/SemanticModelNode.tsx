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
  
  // Model metadata (read from YAML or manually set)
  description?: string;
  tables?: string[];       // List of tables in the model
  verified?: boolean;      // Whether model has been validated
}

export const SemanticModelNode = ({ data, selected }: { data: SemanticModelData; selected?: boolean }) => {
  return (
    <div 
      style={{
        background: '#FFFFFF',
        border: selected ? '2px solid #6366F1' : '1px solid #E5E9F0',
        borderRadius: 8,
        padding: 12,
        width: 240,
        fontFamily: 'Inter, -apple-system, sans-serif',
        boxShadow: selected ? '0 4px 12px rgba(99,102,241,0.25)' : '0 1px 3px rgba(0,0,0,0.1)',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: '#6366F1', width: 10, height: 10, border: '2px solid white' }} />
      
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ 
          width: 36, 
          height: 36, 
          borderRadius: 8, 
          background: '#E0E7FF', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center' 
        }}>
          <Layers size={18} color="#6366F1" />
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 500, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Semantic Model
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#1F2937' }}>{data.label}</div>
        </div>
      </div>
      
      {/* Model location */}
      <div style={{ marginTop: 10, padding: 8, background: '#F5F7FA', borderRadius: 6, fontSize: 11, color: '#6B7280' }}>
        {data.stage && data.yamlFile ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <FileJson size={12} />
              <span style={{ fontFamily: 'monospace', fontSize: 10 }}>@{data.stage}/{data.yamlFile}</span>
            </div>
          </>
        ) : (
          <div style={{ fontStyle: 'italic' }}>Configure YAML location →</div>
        )}
      </div>
      
      {/* Tables count */}
      {data.tables && data.tables.length > 0 && (
        <div style={{ marginTop: 6, fontSize: 10, color: '#6B7280' }}>
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
      
      <Handle type="source" position={Position.Right} style={{ background: '#6366F1', width: 10, height: 10, border: '2px solid white' }} />
    </div>
  );
};







