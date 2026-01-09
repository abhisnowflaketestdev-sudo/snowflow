import { Handle, Position } from 'reactflow';
import { FileUp, FileDown, ArrowRightLeft, Sparkles, Eye, Download, Copy, Check, Maximize2, Minimize2, Cloud } from 'lucide-react';
import { useState } from 'react';

// ============================================================================
// FILE INPUT NODE - Upload TMDL/JSON/YAML files (Config-only, not expandable)
// ============================================================================

interface FileInputNodeData {
  label: string;
  fileType: 'tmdl' | 'json' | 'yaml' | 'any';
  fileName?: string;
  fileContent?: string;
}

export const FileInputNode = ({ data, selected }: { data: FileInputNodeData; selected?: boolean }) => {
  const fileTypeConfig = {
    tmdl: { color: '#0078D4', label: 'Power BI TMDL' },
    json: { color: '#F59E0B', label: 'JSON' },
    yaml: { color: '#10B981', label: 'YAML' },
    any: { color: '#6B7280', label: 'Any File' },
  };
  
  const config = fileTypeConfig[data.fileType] || fileTypeConfig.any;

  return (
    <div 
      style={{
        background: '#FFFFFF',
        border: selected ? `2px solid ${config.color}` : '1px solid #E5E9F0',
        borderRadius: 10,
        padding: 14,
        width: 220,
        fontFamily: 'Inter, -apple-system, sans-serif',
        boxShadow: selected ? `0 4px 12px ${config.color}40` : '0 2px 8px rgba(0,0,0,0.08)',
      }}
    >
      {/* Header */}
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
          <FileUp size={20} color={config.color} />
        </div>
        <div>
          <div style={{ fontSize: 9, fontWeight: 600, color: config.color, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            File Input
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#1F2937' }}>{data.label}</div>
        </div>
      </div>
      
      {/* File info */}
      <div style={{ padding: 10, background: '#F8FAFC', borderRadius: 8, fontSize: 11 }}>
        <div style={{ marginBottom: 6 }}>
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
        </div>
        {data.fileName ? (
          <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#64748B', wordBreak: 'break-all' }}>
            📄 {data.fileName}
          </div>
        ) : (
          <div style={{ color: '#9CA3AF', fontStyle: 'italic' }}>
            Click to upload file →
          </div>
        )}
      </div>
      
      <Handle type="source" position={Position.Right} style={{ background: config.color, width: 10, height: 10, border: '2px solid white' }} />
    </div>
  );
};

// ============================================================================
// FILE OUTPUT NODE - INTERACTIVE: Expandable with inline preview
// ============================================================================

interface FileOutputNodeData {
  label: string;
  outputFormat: 'yaml' | 'json' | 'sql';
  generatedContent?: string;
  // Optional: Write to Snowflake Stage
  writeToStage?: boolean;
  stageDatabase?: string;
  stageSchema?: string;
  stageName?: string;
  stageFilename?: string;
  stageWriteStatus?: 'pending' | 'writing' | 'success' | 'error';
  stageWriteMessage?: string;
}

export const FileOutputNode = ({ data, selected }: { data: FileOutputNodeData; selected?: boolean }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const formatConfig = {
    yaml: { color: '#10B981', label: 'Snowflake YAML', ext: 'yaml' },
    json: { color: '#F59E0B', label: 'JSON', ext: 'json' },
    sql: { color: '#3B82F6', label: 'SQL', ext: 'sql' },
  };
  
  const config = formatConfig[data.outputFormat] || formatConfig.yaml;
  
  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!data.generatedContent) return;
    
    const blob = new Blob([data.generatedContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `output.${config.ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!data.generatedContent) return;
    navigator.clipboard.writeText(data.generatedContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div 
      style={{
        background: '#FFFFFF',
        border: selected ? `2px solid ${config.color}` : '1px solid #E5E9F0',
        borderRadius: 10,
        padding: 14,
        width: isExpanded ? 400 : 260,
        fontFamily: 'Inter, -apple-system, sans-serif',
        boxShadow: selected ? `0 4px 12px ${config.color}40` : '0 2px 8px rgba(0,0,0,0.08)',
        transition: 'width 0.3s ease, box-shadow 0.3s ease',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: config.color, width: 10, height: 10, border: '2px solid white' }} />
      
      {/* Header */}
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
          <FileDown size={20} color={config.color} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, fontWeight: 600, color: config.color, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            File Output
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#1F2937' }}>{data.label}</div>
        </div>
        
        {/* Expand button */}
        <button
          onClick={handleToggleExpand}
          style={{
            background: `${config.color}15`,
            border: 'none',
            borderRadius: 6,
            padding: 6,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title={isExpanded ? 'Collapse' : 'Expand'}
        >
          {isExpanded ? <Minimize2 size={14} color={config.color} /> : <Maximize2 size={14} color={config.color} />}
        </button>
      </div>
      
      {/* Output info */}
      <div style={{ padding: 10, background: '#F8FAFC', borderRadius: 8, fontSize: 11, marginBottom: 8 }}>
        <div style={{ marginBottom: 6 }}>
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
        </div>
        {data.generatedContent ? (
          <div style={{ color: '#10B981', display: 'flex', alignItems: 'center', gap: 4 }}>
            ✓ Ready ({data.generatedContent.length} chars)
          </div>
        ) : (
          <div style={{ color: '#9CA3AF', fontStyle: 'italic' }}>
            Waiting for input...
          </div>
        )}
      </div>

      {/* Snowflake Stage Write Status */}
      {data.writeToStage && data.stageName && (
        <div style={{ 
          padding: 8, 
          background: data.stageWriteStatus === 'success' ? '#D1FAE5' : 
                      data.stageWriteStatus === 'error' ? '#FEE2E2' :
                      data.stageWriteStatus === 'writing' ? '#DBEAFE' : '#F3F4F6',
          borderRadius: 6, 
          fontSize: 10, 
          marginBottom: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 6
        }}>
          <Cloud size={12} color={
            data.stageWriteStatus === 'success' ? '#059669' : 
            data.stageWriteStatus === 'error' ? '#DC2626' :
            data.stageWriteStatus === 'writing' ? '#2563EB' : '#6B7280'
          } />
          <div style={{ flex: 1 }}>
            <div style={{ 
              fontWeight: 600, 
              color: data.stageWriteStatus === 'success' ? '#059669' : 
                     data.stageWriteStatus === 'error' ? '#DC2626' :
                     data.stageWriteStatus === 'writing' ? '#2563EB' : '#6B7280'
            }}>
              {data.stageWriteStatus === 'success' ? '✓ Uploaded to Stage' : 
               data.stageWriteStatus === 'error' ? '✗ Upload Failed' :
               data.stageWriteStatus === 'writing' ? '↻ Uploading...' : '→ Will upload to Stage'}
            </div>
            <div style={{ fontSize: 9, color: '#6B7280', fontFamily: 'monospace' }}>
              @{data.stageDatabase}.{data.stageSchema}.{data.stageName}/{data.stageFilename || 'output.' + config.ext}
            </div>
            {data.stageWriteMessage && (
              <div style={{ fontSize: 9, color: data.stageWriteStatus === 'error' ? '#DC2626' : '#059669', marginTop: 2 }}>
                {data.stageWriteMessage}
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Expandable Content Preview */}
      {isExpanded && data.generatedContent && (
        <div 
          onClick={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
          style={{
            marginBottom: 8,
            padding: 10,
            background: '#1F2937',
            borderRadius: 8,
            maxHeight: 200,
            overflow: 'auto',
            transition: 'max-height 0.3s ease',
          }}
        >
          <pre style={{
            margin: 0,
            fontSize: 10,
            fontFamily: "'JetBrains Mono', Monaco, monospace",
            color: config.color,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}>
            {data.generatedContent.substring(0, 1500)}
            {data.generatedContent.length > 1500 && '\n\n... (truncated)'}
          </pre>
        </div>
      )}
      
      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={handleToggleExpand}
          disabled={!data.generatedContent}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            padding: '6px 8px',
            borderRadius: 6,
            border: 'none',
            background: data.generatedContent ? '#F3F4F6' : '#F9FAFB',
            color: data.generatedContent ? '#374151' : '#9CA3AF',
            fontSize: 10,
            fontWeight: 500,
            cursor: data.generatedContent ? 'pointer' : 'not-allowed',
          }}
        >
          <Eye size={12} />
          {isExpanded ? 'Collapse' : 'Preview'}
        </button>
        <button
          onClick={handleCopy}
          disabled={!data.generatedContent}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            padding: '6px 8px',
            borderRadius: 6,
            border: 'none',
            background: copied ? config.color : (data.generatedContent ? '#F3F4F6' : '#F9FAFB'),
            color: copied ? 'white' : (data.generatedContent ? '#374151' : '#9CA3AF'),
            fontSize: 10,
            fontWeight: 500,
            cursor: data.generatedContent ? 'pointer' : 'not-allowed',
          }}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
        </button>
        <button
          onClick={handleDownload}
          disabled={!data.generatedContent}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            padding: '6px 8px',
            borderRadius: 6,
            border: 'none',
            background: data.generatedContent ? config.color : '#F9FAFB',
            color: data.generatedContent ? 'white' : '#9CA3AF',
            fontSize: 10,
            fontWeight: 500,
            cursor: data.generatedContent ? 'pointer' : 'not-allowed',
          }}
        >
          <Download size={12} />
          Download
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// SCHEMA EXTRACTOR NODE - INTERACTIVE: Shows extraction status inline
// ============================================================================

interface SchemaExtractorNodeData {
  label: string;
  sourceFormat: 'powerbi' | 'dbt' | 'looker' | 'tableau';
  model?: string;
  extractionStatus?: 'pending' | 'processing' | 'complete' | 'error';
  extractedSchema?: string;
}

export const SchemaExtractorNode = ({ data, selected }: { data: SchemaExtractorNodeData; selected?: boolean }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const formatConfig = {
    powerbi: { color: '#0078D4', label: 'Power BI', icon: '📊' },
    dbt: { color: '#FF694A', label: 'dbt', icon: '🔧' },
    looker: { color: '#4285F4', label: 'Looker', icon: '👁️' },
    tableau: { color: '#E97627', label: 'Tableau', icon: '📈' },
  };
  
  const config = formatConfig[data.sourceFormat] || formatConfig.powerbi;

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!data.extractedSchema) return;
    navigator.clipboard.writeText(data.extractedSchema);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div 
      style={{
        background: '#FFFFFF',
        border: selected ? `2px solid ${config.color}` : '1px solid #E5E9F0',
        borderRadius: 10,
        padding: 14,
        width: isExpanded ? 380 : 260,
        fontFamily: 'Inter, -apple-system, sans-serif',
        boxShadow: selected ? `0 4px 12px ${config.color}40` : '0 2px 8px rgba(0,0,0,0.08)',
        transition: 'width 0.3s ease',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: config.color, width: 10, height: 10, border: '2px solid white' }} />
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{ 
          width: 40, 
          height: 40, 
          borderRadius: 10, 
          background: `${config.color}15`, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          fontSize: 20
        }}>
          {config.icon}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, fontWeight: 600, color: config.color, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Schema Extractor
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#1F2937' }}>{data.label}</div>
        </div>
        
        {/* Expand button */}
        {data.extractedSchema && (
          <button
            onClick={handleToggleExpand}
            style={{
              background: `${config.color}15`,
              border: 'none',
              borderRadius: 6,
              padding: 6,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? <Minimize2 size={14} color={config.color} /> : <Maximize2 size={14} color={config.color} />}
          </button>
        )}
      </div>
      
      {/* Source info */}
      <div 
        onClick={data.extractedSchema ? handleToggleExpand : undefined}
        style={{ 
          padding: 10, 
          background: '#F8FAFC', 
          borderRadius: 8, 
          fontSize: 11, 
          marginBottom: 8,
          cursor: data.extractedSchema ? 'pointer' : 'default',
        }}
      >
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
          <ArrowRightLeft size={12} color="#9CA3AF" />
          <span style={{ 
            background: '#F59E0B',
            color: 'white',
            padding: '2px 6px',
            borderRadius: 4,
            fontSize: 9,
            fontWeight: 600
          }}>
            JSON
          </span>
        </div>
        <div style={{ color: '#64748B', fontSize: 10 }}>
          {data.extractedSchema 
            ? `✓ Extracted (${data.extractedSchema.length} chars)` 
            : 'Extracts tables, relationships, measures → Interchange JSON'}
        </div>
      </div>

      {/* Expandable Preview */}
      {isExpanded && data.extractedSchema && (
        <div 
          onClick={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
          style={{
            marginBottom: 8,
            padding: 10,
            background: '#1F2937',
            borderRadius: 8,
            maxHeight: 150,
            overflow: 'auto',
          }}
        >
          <pre style={{
            margin: 0,
            fontSize: 9,
            fontFamily: "'JetBrains Mono', Monaco, monospace",
            color: '#F59E0B',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}>
            {data.extractedSchema.substring(0, 1000)}
            {data.extractedSchema.length > 1000 && '\n...'}
          </pre>
        </div>
      )}

      {/* Copy button when expanded */}
      {isExpanded && data.extractedSchema && (
        <button
          onClick={handleCopy}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            padding: '6px 8px',
            borderRadius: 6,
            border: 'none',
            background: copied ? config.color : '#F3F4F6',
            color: copied ? 'white' : '#374151',
            fontSize: 10,
            fontWeight: 500,
            cursor: 'pointer',
            marginBottom: 8,
          }}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copied!' : 'Copy JSON'}
        </button>
      )}

      {/* Model selection */}
      <div style={{ fontSize: 10, color: '#6B7280' }}>
        <Sparkles size={10} style={{ marginRight: 4, verticalAlign: 'middle' }} />
        Uses: {data.model || 'mistral-large2'}
      </div>
      
      <Handle type="source" position={Position.Right} style={{ background: '#F59E0B', width: 10, height: 10, border: '2px solid white' }} />
    </div>
  );
};

// ============================================================================
// SCHEMA TRANSFORMER NODE - INTERACTIVE: Shows transformation output inline
// ============================================================================

interface SchemaTransformerNodeData {
  label: string;
  targetFormat: 'snowflake' | 'dbt' | 'looker';
  model?: string;
  transformationStatus?: 'pending' | 'processing' | 'complete' | 'error';
  warnings?: string[];
  transformedOutput?: string;
}

export const SchemaTransformerNode = ({ data, selected }: { data: SchemaTransformerNodeData; selected?: boolean }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const formatConfig = {
    snowflake: { color: '#29B5E8', label: 'Snowflake YAML', icon: '❄️' },
    dbt: { color: '#FF694A', label: 'dbt YAML', icon: '🔧' },
    looker: { color: '#4285F4', label: 'LookML', icon: '👁️' },
  };
  
  const config = formatConfig[data.targetFormat] || formatConfig.snowflake;

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!data.transformedOutput) return;
    navigator.clipboard.writeText(data.transformedOutput);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div 
      style={{
        background: '#FFFFFF',
        border: selected ? `2px solid ${config.color}` : '1px solid #E5E9F0',
        borderRadius: 10,
        padding: 14,
        width: isExpanded ? 380 : 260,
        fontFamily: 'Inter, -apple-system, sans-serif',
        boxShadow: selected ? `0 4px 12px ${config.color}40` : '0 2px 8px rgba(0,0,0,0.08)',
        transition: 'width 0.3s ease',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: '#F59E0B', width: 10, height: 10, border: '2px solid white' }} />
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{ 
          width: 40, 
          height: 40, 
          borderRadius: 10, 
          background: `${config.color}15`, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          fontSize: 20
        }}>
          {config.icon}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, fontWeight: 600, color: config.color, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Schema Transformer
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#1F2937' }}>{data.label}</div>
        </div>
        
        {/* Expand button */}
        {data.transformedOutput && (
          <button
            onClick={handleToggleExpand}
            style={{
              background: `${config.color}15`,
              border: 'none',
              borderRadius: 6,
              padding: 6,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? <Minimize2 size={14} color={config.color} /> : <Maximize2 size={14} color={config.color} />}
          </button>
        )}
      </div>
      
      {/* Transform info */}
      <div 
        onClick={data.transformedOutput ? handleToggleExpand : undefined}
        style={{ 
          padding: 10, 
          background: '#F8FAFC', 
          borderRadius: 8, 
          fontSize: 11, 
          marginBottom: 8,
          cursor: data.transformedOutput ? 'pointer' : 'default',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <span style={{ 
            background: '#F59E0B',
            color: 'white',
            padding: '2px 6px',
            borderRadius: 4,
            fontSize: 9,
            fontWeight: 600
          }}>
            JSON
          </span>
          <ArrowRightLeft size={12} color="#9CA3AF" />
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
        </div>
        <div style={{ color: '#64748B', fontSize: 10 }}>
          {data.transformedOutput 
            ? `✓ Generated (${data.transformedOutput.length} chars)` 
            : `Generates ${config.label} with synonyms & sample questions`}
        </div>
      </div>

      {/* Expandable Preview */}
      {isExpanded && data.transformedOutput && (
        <div 
          onClick={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
          style={{
            marginBottom: 8,
            padding: 10,
            background: '#1F2937',
            borderRadius: 8,
            maxHeight: 150,
            overflow: 'auto',
          }}
        >
          <pre style={{
            margin: 0,
            fontSize: 9,
            fontFamily: "'JetBrains Mono', Monaco, monospace",
            color: config.color,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}>
            {data.transformedOutput.substring(0, 1000)}
            {data.transformedOutput.length > 1000 && '\n...'}
          </pre>
        </div>
      )}

      {/* Copy button when expanded */}
      {isExpanded && data.transformedOutput && (
        <button
          onClick={handleCopy}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            padding: '6px 8px',
            borderRadius: 6,
            border: 'none',
            background: copied ? config.color : '#F3F4F6',
            color: copied ? 'white' : '#374151',
            fontSize: 10,
            fontWeight: 500,
            cursor: 'pointer',
            marginBottom: 8,
          }}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copied!' : 'Copy YAML'}
        </button>
      )}

      {/* Warnings */}
      {data.warnings && data.warnings.length > 0 && (
        <div style={{ fontSize: 10, color: '#F59E0B', marginBottom: 8 }}>
          ⚠️ {data.warnings.length} items need review
        </div>
      )}

      {/* Model */}
      <div style={{ fontSize: 10, color: '#6B7280' }}>
        <Sparkles size={10} style={{ marginRight: 4, verticalAlign: 'middle' }} />
        Uses: {data.model || 'mistral-large2'}
      </div>
      
      <Handle type="source" position={Position.Right} style={{ background: config.color, width: 10, height: 10, border: '2px solid white' }} />
    </div>
  );
};
