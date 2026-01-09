import { useState, useEffect } from 'react';
import { Database, Table, Eye, Lock, CheckCircle, Clock, Search, RefreshCw, Loader2, AlertCircle, FileText, Layers } from 'lucide-react';
import axios from 'axios';

interface DataSource {
  id: string;
  name: string;
  type: 'table' | 'view' | 'dynamic_table' | 'stream';
  database: string;
  schema: string;
  hasSemanticModel: boolean;
  hasAccess: boolean;
  rowCount?: number;
  lastUpdated?: string;
  description?: string;
}

interface SemanticModel {
  id: string;
  name: string;
  database: string;
  schema: string;
  stage: string;
  path: string;
  size?: number;
  lastModified?: string;
}

interface DataCatalogProps {
  onSelectSource: (source: DataSource) => void;
  onSelectSemanticModel?: (model: SemanticModel) => void;
}

// Mock data for fallback
const mockDataSources: DataSource[] = [
  { id: '1', name: 'SALES_DATA', type: 'table', database: 'SNOWFLOW_DEV', schema: 'DEMO', hasSemanticModel: true, hasAccess: true, rowCount: 50000 },
  { id: '2', name: 'CUSTOMER_360', type: 'view', database: 'SNOWFLOW_DEV', schema: 'DEMO', hasSemanticModel: true, hasAccess: true, rowCount: 12000 },
  { id: '3', name: 'INVENTORY_STREAM', type: 'stream', database: 'SNOWFLOW_DEV', schema: 'DEMO', hasSemanticModel: false, hasAccess: true },
];

const mockSemanticModels: SemanticModel[] = [
  { id: '1', name: 'sales_analytics.yaml', database: 'SNOWFLOW_PROD', schema: 'SEMANTIC_MODELS', stage: 'CORTEX_STAGE', path: '@SNOWFLOW_PROD.SEMANTIC_MODELS.CORTEX_STAGE/sales_analytics.yaml' },
  { id: '2', name: 'customer_360.yaml', database: 'SNOWFLOW_PROD', schema: 'SEMANTIC_MODELS', stage: 'CORTEX_STAGE', path: '@SNOWFLOW_PROD.SEMANTIC_MODELS.CORTEX_STAGE/customer_360.yaml' },
];

export function DataCatalog({ onSelectSource, onSelectSemanticModel }: DataCatalogProps) {
  const [activeTab, setActiveTab] = useState<'sources' | 'semantics'>('sources');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'ready' | 'pending'>('all');
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [semanticModels, setSemanticModels] = useState<SemanticModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSemantics, setLoadingSemantics] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [semanticsError, setSemanticsError] = useState<string | null>(null);

  // Fetch real data from Snowflake
  const fetchSources = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.get('http://localhost:8000/catalog/sources');
      const sources = response.data.sources.map((s: any) => ({
        id: s.id,
        name: s.name,
        type: s.type === 'base table' ? 'table' : s.type,
        database: s.database,
        schema: s.schema,
        hasSemanticModel: s.hasSemanticModel || false,
        hasAccess: s.status !== 'no_access',
        rowCount: s.rowCount,
        lastUpdated: s.lastUpdated,
        description: s.description,
      }));
      setDataSources(sources);
    } catch (err: any) {
      console.error('Failed to fetch catalog:', err);
      setError(err.response?.data?.detail || 'Failed to connect to Snowflake');
      // Fall back to mock data
      setDataSources(mockDataSources);
    } finally {
      setLoading(false);
    }
  };

  // Fetch semantic models from Snowflake stages
  const fetchSemanticModels = async () => {
    setLoadingSemantics(true);
    setSemanticsError(null);
    
    try {
      const response = await axios.get('http://localhost:8000/catalog/semantic-models');
      const models = response.data.semantic_models.map((m: any, idx: number) => ({
        id: m.id || `sm-${idx}`,
        name: m.name,
        database: m.database,
        schema: m.schema,
        stage: m.stage,
        path: m.path,
        size: m.size,
        lastModified: m.lastModified,
      }));
      setSemanticModels(models);
    } catch (err: any) {
      console.error('Failed to fetch semantic models:', err);
      setSemanticsError(err.response?.data?.detail || 'Failed to load semantic models');
      setSemanticModels(mockSemanticModels);
    } finally {
      setLoadingSemantics(false);
    }
  };

  useEffect(() => {
    fetchSources();
    fetchSemanticModels();
  }, []);

  const filteredSources = dataSources.filter(source => {
    const matchesSearch = source.name.toLowerCase().includes(search.toLowerCase()) ||
                          source.database.toLowerCase().includes(search.toLowerCase());
    
    if (filter === 'ready') return matchesSearch && source.hasSemanticModel && source.hasAccess;
    if (filter === 'pending') return matchesSearch && (!source.hasSemanticModel || !source.hasAccess);
    return matchesSearch;
  });

  const readyCount = dataSources.filter(s => s.hasSemanticModel && s.hasAccess).length;
  const pendingCount = dataSources.filter(s => !s.hasSemanticModel || !s.hasAccess).length;

  const filteredSemanticModels = semanticModels.filter(model =>
    model.name.toLowerCase().includes(search.toLowerCase()) ||
    model.database.toLowerCase().includes(search.toLowerCase()) ||
    model.stage.toLowerCase().includes(search.toLowerCase())
  );

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'view': return <Eye size={14} color="#0EA5E9" />;
      case 'dynamic_table': return <RefreshCw size={14} color="#8B5CF6" />;
      case 'stream': return <Database size={14} color="#10B981" />;
      default: return <Table size={14} color="#29B5E8" />;
    }
  };

  const getStatusBadge = (source: DataSource) => {
    if (!source.hasAccess) {
      return (
        <span style={{ 
          fontSize: 9, 
          background: '#FEE2E2', 
          color: '#991B1B', 
          padding: '2px 6px', 
          borderRadius: 4,
          display: 'flex',
          alignItems: 'center',
          gap: 3
        }}>
          <Lock size={10} /> No Access
        </span>
      );
    }
    if (!source.hasSemanticModel) {
      return (
        <span style={{ 
          fontSize: 9, 
          background: '#FEF3C7', 
          color: '#92400E', 
          padding: '2px 6px', 
          borderRadius: 4,
          display: 'flex',
          alignItems: 'center',
          gap: 3
        }}>
          <Clock size={10} /> No Semantic Model
        </span>
      );
    }
    return (
      <span style={{ 
        fontSize: 9, 
        background: '#D1FAE5', 
        color: '#065F46', 
        padding: '2px 6px', 
        borderRadius: 4,
        display: 'flex',
        alignItems: 'center',
        gap: 3
      }}>
        <CheckCircle size={10} /> Ready
      </span>
    );
  };

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%',
      fontFamily: 'Inter, -apple-system, sans-serif',
    }}>
      {/* Header */}
      <div style={{ 
        padding: '12px 16px', 
        borderBottom: '1px solid #E5E9F0',
        background: '#F9FAFB'
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 8,
          marginBottom: 12
        }}>
          <Database size={18} color="#29B5E8" />
          <span style={{ fontWeight: 600, color: '#1F2937', fontSize: 14 }}>Data Catalog</span>
          <button
            onClick={activeTab === 'sources' ? fetchSources : fetchSemanticModels}
            disabled={loading || loadingSemantics}
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: 'none',
              cursor: (loading || loadingSemantics) ? 'not-allowed' : 'pointer',
              padding: 4,
              display: 'flex',
              alignItems: 'center',
            }}
            title="Refresh from Snowflake"
          >
            <RefreshCw size={14} color={(loading || loadingSemantics) ? '#9CA3AF' : '#29B5E8'} className={(loading || loadingSemantics) ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div style={{ 
          display: 'flex', 
          gap: 4, 
          marginBottom: 12,
          background: '#E5E9F0',
          borderRadius: 8,
          padding: 3,
        }}>
          <button
            onClick={() => setActiveTab('sources')}
            style={{
              flex: 1,
              padding: '8px 12px',
              border: 'none',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              background: activeTab === 'sources' ? '#FFFFFF' : 'transparent',
              color: activeTab === 'sources' ? '#1F2937' : '#6B7280',
              boxShadow: activeTab === 'sources' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              transition: 'all 0.15s ease',
            }}
          >
            <Table size={14} />
            Sources ({dataSources.length})
          </button>
          <button
            onClick={() => setActiveTab('semantics')}
            style={{
              flex: 1,
              padding: '8px 12px',
              border: 'none',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              background: activeTab === 'semantics' ? '#FFFFFF' : 'transparent',
              color: activeTab === 'semantics' ? '#1F2937' : '#6B7280',
              boxShadow: activeTab === 'semantics' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              transition: 'all 0.15s ease',
            }}
          >
            <Layers size={14} />
            Semantics ({semanticModels.length})
          </button>
        </div>

        {/* Connection status */}
        {activeTab === 'sources' && error && (
          <div style={{
            background: '#FEF3C7',
            border: '1px solid #F59E0B',
            borderRadius: 6,
            padding: '6px 10px',
            marginBottom: 10,
            fontSize: 11,
            color: '#92400E',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <AlertCircle size={12} />
            <span>{error} (showing cached data)</span>
          </div>
        )}
        {activeTab === 'semantics' && semanticsError && (
          <div style={{
            background: '#FEF3C7',
            border: '1px solid #F59E0B',
            borderRadius: 6,
            padding: '6px 10px',
            marginBottom: 10,
            fontSize: 11,
            color: '#92400E',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <AlertCircle size={12} />
            <span>{semanticsError} (showing demo data)</span>
          </div>
        )}
        
        {/* Search */}
        <div style={{ position: 'relative', marginBottom: 10 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: 8, color: '#9CA3AF' }} />
          <input
            type="text"
            placeholder={activeTab === 'sources' ? "Search data sources..." : "Search semantic models..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 10px 8px 32px',
              border: '1px solid #E5E9F0',
              borderRadius: 6,
              fontSize: 12,
              boxSizing: 'border-box',
              outline: 'none',
            }}
          />
        </div>

        {/* Filter tabs - only show for sources */}
        {activeTab === 'sources' && (
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => setFilter('all')}
              style={{
                flex: 1,
                padding: '6px 8px',
                border: 'none',
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 500,
                cursor: 'pointer',
                background: filter === 'all' ? '#29B5E8' : '#F3F4F6',
                color: filter === 'all' ? 'white' : '#6B7280',
              }}
            >
              All ({dataSources.length})
            </button>
            <button
              onClick={() => setFilter('ready')}
              style={{
                flex: 1,
                padding: '6px 8px',
                border: 'none',
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 500,
                cursor: 'pointer',
                background: filter === 'ready' ? '#10B981' : '#F3F4F6',
                color: filter === 'ready' ? 'white' : '#6B7280',
              }}
            >
              Ready ({readyCount})
            </button>
            <button
              onClick={() => setFilter('pending')}
              style={{
                flex: 1,
                padding: '6px 8px',
                border: 'none',
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 500,
                cursor: 'pointer',
                background: filter === 'pending' ? '#F59E0B' : '#F3F4F6',
                color: filter === 'pending' ? 'white' : '#6B7280',
              }}
            >
              Pending ({pendingCount})
            </button>
          </div>
        )}
      </div>

      {/* Content list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
        {/* Data Sources Tab */}
        {activeTab === 'sources' && (
          <>
            {loading ? (
              <div style={{ 
                textAlign: 'center', 
                padding: 40, 
                color: '#9CA3AF',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12,
              }}>
                <Loader2 size={24} className="animate-spin" />
                <span style={{ fontSize: 12 }}>Loading from Snowflake...</span>
              </div>
            ) : (
              <>
                {filteredSources.map((source, idx) => (
                  <div
                    key={source.id || idx}
                    onClick={() => source.hasAccess && onSelectSource(source)}
                    draggable={source.hasAccess}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/reactflow', 'snowflakeSource');
                      e.dataTransfer.setData('sourceData', JSON.stringify({
                        label: source.name,
                        database: source.database,
                        schema: source.schema,
                        objectType: source.type,
                      }));
                    }}
                    style={{
                      padding: '10px 12px',
                      marginBottom: 8,
                      background: source.hasAccess ? '#FFFFFF' : '#F9FAFB',
                      border: '1px solid #E5E9F0',
                      borderRadius: 8,
                      cursor: source.hasAccess ? 'grab' : 'not-allowed',
                      opacity: source.hasAccess ? 1 : 0.7,
                      transition: 'all 0.15s ease',
                    }}
                    onMouseOver={(e) => {
                      if (source.hasAccess) {
                        e.currentTarget.style.borderColor = '#29B5E8';
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(41,181,232,0.15)';
                      }
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.borderColor = '#E5E9F0';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ 
                        width: 32, 
                        height: 32, 
                        borderRadius: 6, 
                        background: '#F0F9FF', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        {getTypeIcon(source.type)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ 
                          fontSize: 13, 
                          fontWeight: 600, 
                          color: '#1F2937',
                          marginBottom: 2,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {source.name}
                        </div>
                        <div style={{ 
                          fontSize: 10, 
                          color: '#6B7280',
                          marginBottom: 4
                        }}>
                          {source.database}.{source.schema}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          {getStatusBadge(source)}
                          {source.rowCount && (
                            <span style={{ fontSize: 9, color: '#9CA3AF' }}>
                              {source.rowCount.toLocaleString()} rows
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {filteredSources.length === 0 && (
                  <div style={{ 
                    textAlign: 'center', 
                    padding: 40, 
                    color: '#9CA3AF',
                    fontSize: 12
                  }}>
                    No data sources match your filter
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* Semantic Models Tab */}
        {activeTab === 'semantics' && (
          <>
            {loadingSemantics ? (
              <div style={{ 
                textAlign: 'center', 
                padding: 40, 
                color: '#9CA3AF',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12,
              }}>
                <Loader2 size={24} className="animate-spin" />
                <span style={{ fontSize: 12 }}>Loading semantic models from Snowflake stages...</span>
              </div>
            ) : (
              <>
                {filteredSemanticModels.map((model, idx) => (
                  <div
                    key={model.id || idx}
                    onClick={() => onSelectSemanticModel?.(model)}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/reactflow', 'semanticModel');
                      e.dataTransfer.setData('semanticData', JSON.stringify({
                        label: model.name.replace('.yaml', ''),
                        database: model.database,
                        schema: model.schema,
                        stage: model.stage,
                        semanticPath: model.path,
                        yamlFile: model.name,
                      }));
                    }}
                    style={{
                      padding: '10px 12px',
                      marginBottom: 8,
                      background: '#FFFFFF',
                      border: '1px solid #E5E9F0',
                      borderRadius: 8,
                      cursor: 'grab',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.borderColor = '#8B5CF6';
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(139,92,246,0.15)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.borderColor = '#E5E9F0';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ 
                        width: 32, 
                        height: 32, 
                        borderRadius: 6, 
                        background: 'linear-gradient(135deg, #EDE9FE 0%, #DDD6FE 100%)', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <FileText size={14} color="#8B5CF6" />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ 
                          fontSize: 13, 
                          fontWeight: 600, 
                          color: '#1F2937',
                          marginBottom: 2,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {model.name}
                        </div>
                        <div style={{ 
                          fontSize: 10, 
                          color: '#6B7280',
                          marginBottom: 4
                        }}>
                          @{model.database}.{model.schema}.{model.stage}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ 
                            fontSize: 9, 
                            background: '#EDE9FE', 
                            color: '#6D28D9', 
                            padding: '2px 6px', 
                            borderRadius: 4,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 3
                          }}>
                            <Layers size={10} /> YAML
                          </span>
                          {model.size && (
                            <span style={{ fontSize: 9, color: '#9CA3AF' }}>
                              {(model.size / 1024).toFixed(1)} KB
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {filteredSemanticModels.length === 0 && (
                  <div style={{ 
                    textAlign: 'center', 
                    padding: 40, 
                    color: '#9CA3AF',
                    fontSize: 12
                  }}>
                    {semanticModels.length === 0 
                      ? 'No semantic models found in Snowflake stages'
                      : 'No semantic models match your search'}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
