import { Handle, Position } from 'reactflow';
import { MessageSquareText, Database } from 'lucide-react';

/**
 * CortexAnalystNode - Represents Snowflake Cortex Analyst
 * 
 * Cortex Analyst enables natural language queries against a semantic model.
 * It translates questions into SQL and executes them.
 * 
 * Reference: https://docs.snowflake.com/en/user-guide/snowflake-cortex/cortex-analyst
 */

export interface CortexAnalystData {
  label: string;
  
  // Semantic model reference
  semanticModel: string;     // Name of semantic model to use
  database: string;
  schema: string;
  stage: string;
  yamlFile: string;
  
  // Query configuration
  question: string;          // Natural language question
  warehouse: string;         // Warehouse to use for execution
  
  // Response options
  showSQL: boolean;          // Include generated SQL in response
  showExplanation: boolean;  // Include explanation of query
}

export const CortexAnalystNode = ({ data, selected }: { data: CortexAnalystData; selected?: boolean }) => {
  return (
    <div 
      style={{
        background: '#FFFFFF',
        border: selected ? '2px solid #0EA5E9' : '1px solid #E5E9F0',
        borderRadius: 8,
        padding: 12,
        width: 240,
        fontFamily: 'Inter, -apple-system, sans-serif',
        boxShadow: selected ? '0 4px 12px rgba(14,165,233,0.25)' : '0 1px 3px rgba(0,0,0,0.1)',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: '#0EA5E9', width: 10, height: 10, border: '2px solid white' }} />
      
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ 
          width: 36, 
          height: 36, 
          borderRadius: 8, 
          background: '#E0F2FE', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center' 
        }}>
          <MessageSquareText size={18} color="#0EA5E9" />
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 500, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Cortex Analyst
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#1F2937' }}>{data.label}</div>
        </div>
      </div>
      
      {/* Semantic model reference */}
      <div style={{ marginTop: 10, padding: 8, background: '#F5F7FA', borderRadius: 6, fontSize: 11, color: '#6B7280' }}>
        {data.semanticModel ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Database size={12} />
            <span style={{ fontWeight: 500 }}>Model:</span> {data.semanticModel}
          </div>
        ) : (
          <div style={{ fontStyle: 'italic' }}>Select semantic model →</div>
        )}
      </div>
      
      {/* Question preview */}
      {data.question && (
        <div style={{ marginTop: 8, fontSize: 11, color: '#6B7280', lineHeight: 1.4, fontStyle: 'italic' }}>
          "{data.question.length > 60 ? data.question.slice(0, 60) + '...' : data.question}"
        </div>
      )}
      
      {/* Options */}
      <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {data.showSQL && (
          <span style={{ fontSize: 9, background: '#DBEAFE', color: '#1D4ED8', padding: '2px 6px', borderRadius: 4 }}>
            Show SQL
          </span>
        )}
        {data.warehouse && (
          <span style={{ fontSize: 9, background: '#F3F4F6', color: '#4B5563', padding: '2px 6px', borderRadius: 4 }}>
            {data.warehouse}
          </span>
        )}
      </div>
      
      <Handle type="source" position={Position.Right} style={{ background: '#0EA5E9', width: 10, height: 10, border: '2px solid white' }} />
    </div>
  );
};












