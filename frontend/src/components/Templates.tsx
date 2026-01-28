import { useState, useEffect } from 'react';
import { MessageSquare, BarChart3, FileSearch, Headphones, TrendingUp, Users, Zap, ArrowRight, RefreshCw, Loader2, Cloud } from 'lucide-react';
import axios from 'axios';

interface Template {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: 'analytics' | 'customer' | 'operations' | 'custom' | 'testing';
  complexity: 'simple' | 'medium' | 'advanced';
  nodes: any[];
  edges: any[];
  nodeCount: number;
  isFromSnowflake?: boolean;
  usageCount?: number;
}

// Default templates (fallback)
const defaultTemplates: Template[] = [
  {
    id: 'debug-test',
    name: '🐛 DEBUG TEST',
    description: 'Simple 3-node test template',
    icon: <Zap size={20} color="#FF0000" />,
    category: 'testing',
    complexity: 'simple',
    nodes: [],
    edges: [],
    nodeCount: 3,
  },
  {
    id: 'customer-feedback-analyzer',
    name: 'Customer Feedback Analyzer',
    description: 'Analyze customer feedback, extract sentiment, and identify top issues automatically.',
    icon: <MessageSquare size={20} color="#8B5CF6" />,
    category: 'customer',
    complexity: 'simple',
    nodes: [],
    edges: [],
    nodeCount: 3,
  },
  {
    id: 'sales-qa-bot',
    name: 'Sales Q&A Bot',
    description: 'Natural language interface for sales data. Ask questions, get answers.',
    icon: <BarChart3 size={20} color="#10B981" />,
    category: 'analytics',
    complexity: 'simple',
    nodes: [],
    edges: [],
    nodeCount: 3,
  },
  {
    id: 'document-search-rag',
    name: 'Document Search (RAG)',
    description: 'Search through documents and get AI-powered answers with citations.',
    icon: <FileSearch size={20} color="#0EA5E9" />,
    category: 'operations',
    complexity: 'medium',
    nodes: [],
    edges: [],
    nodeCount: 4,
  },
  {
    id: 'multi-agent-support',
    name: 'Multi-Agent Support Router',
    description: 'Routes customer inquiries to specialized agents (Sales, Support, Billing) based on intent.',
    icon: <Users size={20} color="#A855F7" />,
    category: 'customer',
    complexity: 'advanced',
    nodes: [],
    edges: [],
    nodeCount: 6,
  },
  {
    id: 'supervisor-analytics',
    name: 'Supervisor Analytics Agent',
    description: 'Orchestrates multiple specialist agents to answer complex business questions.',
    icon: <TrendingUp size={20} color="#F59E0B" />,
    category: 'analytics',
    complexity: 'advanced',
    nodes: [],
    edges: [],
    nodeCount: 7,
  },
  {
    id: 'hybrid-copilot-snowflake',
    name: 'Hybrid: Copilot + Snowflake',
    description: 'Routes queries to Microsoft Copilot (M365 data) or Snowflake Agent (enterprise data) based on intent.',
    icon: <Zap size={20} color="#0078D4" />,
    category: 'operations',
    complexity: 'advanced',
    nodes: [],
    edges: [],
    nodeCount: 6,
  },
  {
    id: 'semantic-model-migration',
    name: 'Semantic Model Migration',
    description: 'Convert Power BI semantic models to Snowflake Cortex YAML via agent-to-agent translation.',
    icon: <ArrowRight size={20} color="#F59E0B" />,
    category: 'operations',
    complexity: 'advanced',
    nodes: [],
    edges: [],
    nodeCount: 4,
  },
  {
    id: 'retail-grocer-multi-domain',
    name: 'Retail Grocer: PBI ↔ Snowflake',
    description: 'Multi-domain orchestration: Copilot → Cortex Agents → Copilot Callback. Shows bidirectional flow.',
    icon: <TrendingUp size={20} color="#10B981" />,
    category: 'analytics',
    complexity: 'advanced',
    nodes: [],
    edges: [],
    nodeCount: 24,
  },
  {
    id: 'dax-translation-test',
    name: '⚡ DAX Translation Pipeline',
    description: 'Full test of DAX→SQL translation: TMDL input → DAX Translator → Cortex Agent → Multi-domain routing. Tests the complete translation layer.',
    icon: <Zap size={20} color="#667eea" />,
    category: 'testing',
    complexity: 'advanced',
    nodes: [],
    edges: [],
    nodeCount: 12,
  },
  {
    id: 'enterprise-migration-orchestration',
    name: '🚀 Enterprise Migration + Orchestration',
    description: 'Complete enterprise flow: Power BI TMDL → DAX Translation → Snowflake Semantic Views → Multi-Agent Supervisor → Domain Agents → Copilot Callback. The ultimate stress test.',
    icon: <TrendingUp size={20} color="#F59E0B" />,
    category: 'testing',
    complexity: 'advanced',
    nodes: [],
    edges: [],
    nodeCount: 18,
  },
  {
    id: 'black-friday-postmortem',
    name: '🖤 Black Friday Post-Mortem (EXTREME)',
    description: 'Fortune 500 retail scenario: Complex DAX (YoY, LTV, Rolling Avg, Market Basket), 6 domain agents, external market intelligence, bidirectional Copilot flow. The ultimate stress test.',
    icon: <TrendingUp size={20} color="#000000" />,
    category: 'testing',
    complexity: 'advanced',
    nodes: [],
    edges: [],
    nodeCount: 24,
  },
];

interface TemplatesProps {
  onSelectTemplate: (templateId: string, nodes?: any[], edges?: any[]) => void;
}

const getIconForCategory = (category: string, iconName?: string) => {
  // Try to match icon name from database
  if (iconName) {
    switch (iconName.toLowerCase()) {
      case 'messagesquare': return <MessageSquare size={20} color="#8B5CF6" />;
      case 'barchart': case 'barchart3': return <BarChart3 size={20} color="#10B981" />;
      case 'search': case 'filesearch': return <FileSearch size={20} color="#0EA5E9" />;
      case 'headphones': return <Headphones size={20} color="#F59E0B" />;
      case 'trendingup': return <TrendingUp size={20} color="#EF4444" />;
      case 'users': return <Users size={20} color="#6366F1" />;
    }
  }
  
  // Fallback based on category
  switch (category) {
    case 'analytics': return <BarChart3 size={20} color="#10B981" />;
    case 'customer': return <Users size={20} color="#8B5CF6" />;
    case 'operations': return <FileSearch size={20} color="#0EA5E9" />;
    default: return <Zap size={20} color="#F59E0B" />;
  }
};

export function Templates({ onSelectTemplate }: TemplatesProps) {
  const [templates, setTemplates] = useState<Template[]>(defaultTemplates);
  const [loading, setLoading] = useState(true);
  const [hasSnowflakeTemplates, setHasSnowflakeTemplates] = useState(false);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await axios.get('http://localhost:8000/templates');
      if (res.data.templates && res.data.templates.length > 0) {
        const snowflakeTemplates: Template[] = res.data.templates.map((t: any) => ({
          id: t.id,
          name: t.name,
          description: t.description || '',
          icon: getIconForCategory(t.category, t.icon),
          category: t.category || 'custom',
          complexity: t.complexity || 'medium',
          nodes: t.nodes || [],
          edges: t.edges || [],
          nodeCount: (t.nodes || []).length,
          isFromSnowflake: true,
          usageCount: t.usageCount || 0,
        }));
        setTemplates(snowflakeTemplates);
        setHasSnowflakeTemplates(true);
      } else {
        // Use hardcoded templates with their configs
        const templatesWithConfigs = defaultTemplates.map(t => ({
          ...t,
          nodes: templateConfigs[t.id]?.nodes || [],
          edges: templateConfigs[t.id]?.edges || [],
        }));
        setTemplates(templatesWithConfigs);
      }
    } catch (err) {
      console.log('Could not load templates from Snowflake, using defaults');
      const templatesWithConfigs = defaultTemplates.map(t => ({
        ...t,
        nodes: templateConfigs[t.id]?.nodes || [],
        edges: templateConfigs[t.id]?.edges || [],
      }));
      setTemplates(templatesWithConfigs);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleSelectTemplate = async (template: Template) => {
    console.log('Loading template:', template.id, 'Nodes:', template.nodes.length, 'Edges:', template.edges.length);
    console.log('Node IDs:', template.nodes.map((n: any) => n.id));
    
    // Track usage if from Snowflake
    if (template.isFromSnowflake) {
      try {
        await axios.post(`http://localhost:8000/templates/${template.id}/use`);
      } catch (err) {
        console.log('Could not track template usage');
      }
    }
    
    // Pass nodes and edges directly if available
    if (template.nodes.length > 0) {
      onSelectTemplate(template.id, template.nodes, template.edges);
    } else {
      // Fallback to config lookup
      onSelectTemplate(template.id);
    }
  };

  const complexityColors = {
    simple: { bg: '#D1FAE5', color: '#065F46', label: 'Simple' },
    medium: { bg: '#FEF3C7', color: '#92400E', label: 'Medium' },
    advanced: { bg: '#FEE2E2', color: '#991B1B', label: 'Advanced' },
  };

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%',
      fontFamily: 'Inter, -apple-system, sans-serif',
      background: 'rgb(var(--surface))',
      color: 'rgb(var(--fg))',
    }}>
      {/* Header */}
      <div style={{ 
        padding: '12px 16px', 
        borderBottom: '1px solid rgb(var(--border))',
        background: 'rgb(var(--surface-2))'
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 8,
          marginBottom: 8
        }}>
          <Zap size={18} color="#F59E0B" />
          <span style={{ fontWeight: 600, color: 'rgb(var(--fg))', fontSize: 14 }}>Templates</span>
          {hasSnowflakeTemplates && (
            <span title="Loaded from Snowflake"><Cloud size={12} color="#64748b" /></span>
          )}
          <button
            onClick={fetchTemplates}
            disabled={loading}
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              padding: 4,
            }}
          >
            <RefreshCw size={14} color={loading ? 'rgb(var(--muted))' : 'rgb(var(--fg-muted))'} />
          </button>
        </div>
        <div style={{ fontSize: 11, color: 'rgb(var(--muted))' }}>
          Pre-built patterns. Deploy in minutes, not hours.
        </div>
      </div>

      {/* Template list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
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
            <span style={{ fontSize: 12 }}>Loading templates...</span>
          </div>
        ) : (
          templates.map((template) => (
            <div
              key={template.id}
              onClick={() => handleSelectTemplate(template)}
              style={{
                padding: '14px',
                marginBottom: 10,
                background: 'rgb(var(--surface-3))',
                border: '1px solid rgb(var(--border-strong))',
                borderRadius: 10,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.borderColor = '#64748b';
                e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.25)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.borderColor = 'rgb(var(--border-strong))';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.transform = 'none';
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                <div style={{ 
                  width: 36, 
                  height: 36, 
                  borderRadius: 8, 
                  background: 'rgb(var(--surface-2))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  {template.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'rgb(var(--fg))', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {template.name}
                    {template.isFromSnowflake && (
                      <Cloud size={10} color="#64748b" />
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgb(var(--muted))', lineHeight: 1.4 }}>
                    {template.description}
                  </div>
                </div>
              </div>

              {/* Metadata */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                <span style={{ 
                  fontSize: 9, 
                  background: complexityColors[template.complexity]?.bg || '#F3F4F6', 
                  color: complexityColors[template.complexity]?.color || '#6B7280', 
                  padding: '2px 6px', 
                  borderRadius: 4 
                }}>
                  {complexityColors[template.complexity]?.label || template.complexity}
                </span>
                <span style={{ fontSize: 9, color: '#9CA3AF' }}>
                  {template.nodeCount} nodes
                </span>
                {template.usageCount !== undefined && template.usageCount > 0 && (
                  <span style={{ fontSize: 9, color: '#9CA3AF' }}>
                    Used {template.usageCount}x
                  </span>
                )}
              </div>

              {/* Deploy button */}
              <div style={{ 
                marginTop: 10, 
                paddingTop: 10, 
                borderTop: '1px solid rgb(var(--border))',
                display: 'flex',
                justifyContent: 'flex-end'
              }}>
                <span style={{ 
                  fontSize: 11, 
                  color: 'rgb(var(--fg-muted))', 
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}>
                  Use Template <ArrowRight size={12} />
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div style={{ 
        padding: '10px 16px', 
        borderTop: '1px solid rgb(var(--border))',
        background: 'rgb(var(--surface-2))',
        fontSize: 10,
        color: 'rgb(var(--muted))',
        textAlign: 'center'
      }}>
        {hasSnowflakeTemplates ? 'Templates synced from Snowflake' : 'Templates are IT-approved and governance-ready'}
      </div>
    </div>
  );
}

// Template definitions (the actual node/edge configurations) - used as fallback
export const templateConfigs: Record<string, { nodes: any[]; edges: any[] }> = {
  'debug-test': {
    nodes: [
      { id: 'test1', type: 'snowflakeSource', position: { x: 100, y: 100 }, data: { label: 'TEST NODE', database: 'DB', schema: 'SCHEMA', objectType: 'table' } },
      { id: 'test2', type: 'agent', position: { x: 400, y: 100 }, data: { label: 'TEST AGENT', model: 'mistral-large2', systemPrompt: 'test' } },
      { id: 'test3', type: 'output', position: { x: 700, y: 100 }, data: { label: 'TEST OUTPUT', outputType: 'display' } },
    ],
    edges: [
      { id: 'e1', source: 'test1', target: 'test2' },
      { id: 'e2', source: 'test2', target: 'test3' },
    ],
  },
  'customer-feedback-analyzer': {
    nodes: [
      { id: 'source-1', type: 'snowflakeSource', position: { x: 100, y: 200 }, data: { label: 'CUSTOMER_FEEDBACK', database: 'SNOWFLOW_DEV', schema: 'DEMO', objectType: 'table' } },
      { id: 'agent-1', type: 'agent', position: { x: 500, y: 200 }, data: { label: 'Feedback Analyzer', model: 'mistral-large2', systemPrompt: 'Analyze customer feedback. Identify sentiment, key issues, and actionable insights. Group feedback by theme.', temperature: 0.3, tools: { analyst: { enabled: false }, search: { enabled: false }, mcp: { enabled: false }, sqlExecutor: false, webSearch: false } } },
      { id: 'output-1', type: 'output', position: { x: 900, y: 200 }, data: { label: 'Analysis Results', outputType: 'display' } },
    ],
    edges: [
      { id: 'e1', source: 'source-1', target: 'agent-1' },
      { id: 'e2', source: 'agent-1', target: 'output-1' },
    ],
  },
  'sales-qa-bot': {
    nodes: [
      { id: 'source-1', type: 'snowflakeSource', position: { x: 100, y: 200 }, data: { label: 'SALES_DATA', database: 'SNOWFLOW_DEV', schema: 'DEMO', objectType: 'table' } },
      { id: 'semantic-1', type: 'semanticModel', position: { x: 350, y: 200 }, data: { label: 'Sales Semantic Model', database: 'SNOWFLOW_DEV', schema: 'DEMO', stage: 'SEMANTIC_MODELS', yamlFile: 'sales_model.yaml' } },
      { id: 'agent-1', type: 'agent', position: { x: 650, y: 200 }, data: { label: 'Sales Q&A Agent', model: 'mistral-large2', systemPrompt: 'You are a sales analyst. Answer questions about sales data clearly and accurately.', tools: { analyst: { enabled: true, semanticModelDatabase: 'SNOWFLOW_DEV', semanticModelSchema: 'DEMO', semanticModelStage: 'SEMANTIC_MODELS', semanticModelFile: 'sales_model.yaml' }, search: { enabled: false }, mcp: { enabled: false }, sqlExecutor: false, webSearch: false } } },
      { id: 'output-1', type: 'output', position: { x: 950, y: 200 }, data: { label: 'Answer', outputType: 'display' } },
    ],
    edges: [
      { id: 'e1', source: 'source-1', target: 'semantic-1' },
      { id: 'e2', source: 'semantic-1', target: 'agent-1' },
      { id: 'e3', source: 'agent-1', target: 'output-1' },
    ],
  },
  'document-search-rag': {
    nodes: [
      { id: 'source-1', type: 'snowflakeSource', position: { x: 100, y: 200 }, data: { label: 'DOCUMENTS', database: 'KNOWLEDGE', schema: 'BASE', objectType: 'table' } },
      { id: 'agent-1', type: 'agent', position: { x: 500, y: 200 }, data: { label: 'Document Search Agent', model: 'mistral-large2', systemPrompt: 'Search documents and answer questions. Always cite your sources.', tools: { analyst: { enabled: false }, search: { enabled: true, searchServiceName: 'doc_search_svc', database: 'KNOWLEDGE', schema: 'BASE' }, mcp: { enabled: false }, sqlExecutor: false, webSearch: false } } },
      { id: 'output-1', type: 'output', position: { x: 900, y: 200 }, data: { label: 'Answer with Citations', outputType: 'display' } },
    ],
    edges: [
      { id: 'e1', source: 'source-1', target: 'agent-1' },
      { id: 'e2', source: 'agent-1', target: 'output-1' },
    ],
  },
  'multi-agent-support': {
    nodes: [
      { id: 'source-1', type: 'snowflakeSource', position: { x: 50, y: 200 }, data: { label: 'SUPPORT_TICKETS', database: 'SNOWFLOW_DEV', schema: 'DEMO', objectType: 'table', limit: 5 } },
      { id: 'router-1', type: 'router', position: { x: 280, y: 200 }, data: { label: 'Issue Router', routingStrategy: 'intent', routes: [{ name: 'Hardware', condition: 'issue_category contains hardware or display' }, { name: 'Software', condition: 'issue_category contains software or sync' }, { name: 'Connectivity', condition: 'issue_category contains connectivity' }] } },
      { id: 'agent-hardware', type: 'agent', position: { x: 530, y: 80 }, data: { label: 'Hardware Agent', model: 'mistral-large2', systemPrompt: 'You are a hardware support specialist. Help with physical device issues like screens, keyboards, and displays. Provide troubleshooting steps and warranty information.' } },
      { id: 'agent-software', type: 'agent', position: { x: 530, y: 200 }, data: { label: 'Software Agent', model: 'mistral-large2', systemPrompt: 'You are a software support specialist. Help with drivers, installations, syncing issues, and application problems.' } },
      { id: 'agent-connectivity', type: 'agent', position: { x: 530, y: 320 }, data: { label: 'Connectivity Agent', model: 'mistral-large2', systemPrompt: 'You are a connectivity specialist. Help with Bluetooth, WiFi, USB, and network connection issues.' } },
      { id: 'output-1', type: 'output', position: { x: 780, y: 200 }, data: { label: 'Response', outputType: 'display' } },
    ],
    edges: [
      { id: 'e1', source: 'source-1', target: 'router-1' },
      { id: 'e2', source: 'router-1', target: 'agent-hardware', sourceHandle: 'route-1' },
      { id: 'e3', source: 'router-1', target: 'agent-software', sourceHandle: 'route-2' },
      { id: 'e4', source: 'router-1', target: 'agent-connectivity', sourceHandle: 'route-3' },
      { id: 'e5', source: 'agent-hardware', target: 'output-1' },
      { id: 'e6', source: 'agent-software', target: 'output-1' },
      { id: 'e7', source: 'agent-connectivity', target: 'output-1' },
    ],
  },
  'supervisor-analytics': {
    nodes: [
      { id: 'source-1', type: 'snowflakeSource', position: { x: 50, y: 100 }, data: { label: 'SALES_DATA', database: 'SNOWFLOW_DEV', schema: 'DEMO', objectType: 'table', limit: 10 } },
      { id: 'source-2', type: 'snowflakeSource', position: { x: 50, y: 250 }, data: { label: 'CUSTOMER_FEEDBACK', database: 'SNOWFLOW_DEV', schema: 'DEMO', objectType: 'table', limit: 10 } },
      { id: 'supervisor-1', type: 'supervisor', position: { x: 250, y: 175 }, data: { label: 'Analytics Orchestrator', model: 'mistral-large2', delegationStrategy: 'parallel', systemPrompt: 'You orchestrate analytics tasks. Delegate to specialist agents and synthesize their findings.', aggregationMethod: 'merge' } },
      { id: 'agent-sales', type: 'agent', position: { x: 500, y: 80 }, data: { label: 'Sales Analyst', model: 'mistral-large2', systemPrompt: 'Analyze sales trends, revenue, and performance metrics.' } },
      { id: 'agent-customer', type: 'agent', position: { x: 500, y: 200 }, data: { label: 'Customer Analyst', model: 'mistral-large2', systemPrompt: 'Analyze customer behavior, churn, and satisfaction.' } },
      { id: 'agent-forecast', type: 'agent', position: { x: 500, y: 320 }, data: { label: 'Forecaster', model: 'mistral-large2', systemPrompt: 'Generate forecasts and predictions based on historical data.' } },
      { id: 'output-1', type: 'output', position: { x: 750, y: 175 }, data: { label: 'Executive Summary', outputType: 'display' } },
    ],
    edges: [
      { id: 'e1', source: 'source-1', target: 'supervisor-1' },
      { id: 'e2', source: 'source-2', target: 'supervisor-1' },
      { id: 'e3', source: 'supervisor-1', target: 'agent-sales', sourceHandle: 'delegate-1' },
      { id: 'e4', source: 'supervisor-1', target: 'agent-customer', sourceHandle: 'delegate-2' },
      { id: 'e5', source: 'supervisor-1', target: 'agent-forecast', sourceHandle: 'delegate-3' },
      { id: 'e6', source: 'supervisor-1', target: 'output-1', sourceHandle: 'output' },
    ],
  },
  'hybrid-copilot-snowflake': {
    nodes: [
      { id: 'source-1', type: 'snowflakeSource', position: { x: 50, y: 200 }, data: { label: 'SUPPORT_TICKETS', database: 'SNOWFLOW_DEV', schema: 'DEMO', objectType: 'table', limit: 5 } },
      { id: 'router-1', type: 'router', position: { x: 280, y: 200 }, data: { 
        label: 'Hybrid Router', 
        routingStrategy: 'intent', 
        routes: [
          { name: 'Enterprise', condition: 'Query requires enterprise/warehouse data, analytics, or database queries' },
          { name: 'Productivity', condition: 'Query relates to emails, calendar, documents, Teams, or M365 apps' }
        ] 
      }},
      { id: 'agent-snowflake', type: 'agent', position: { x: 550, y: 120 }, data: { 
        label: 'Snowflake Agent', 
        model: 'mistral-large2', 
        systemPrompt: 'You are a Snowflake data analyst. Analyze enterprise data from Snowflake warehouse. Provide insights on tickets, sales, and customer data.',
        tools: { analyst: { enabled: false }, search: { enabled: false }, sqlExecutor: true }
      }},
      { id: 'agent-copilot', type: 'externalAgent', position: { x: 550, y: 300 }, data: { 
        label: 'Microsoft Copilot', 
        agentType: 'copilot',
        endpoint: 'https://graph.microsoft.com/v1.0/me/messages',
        method: 'POST',
        authType: 'oauth',
        provider: 'Microsoft',
        systemPrompt: 'You are Microsoft Copilot. Help with M365 tasks - emails, calendar, Teams, documents.'
      }},
      { id: 'output-1', type: 'output', position: { x: 820, y: 200 }, data: { label: 'Unified Response', outputType: 'display' } },
    ],
    edges: [
      { id: 'e1', source: 'source-1', target: 'router-1' },
      { id: 'e2', source: 'router-1', target: 'agent-snowflake', sourceHandle: 'route-1' },
      { id: 'e3', source: 'router-1', target: 'agent-copilot', sourceHandle: 'route-2' },
      { id: 'e4', source: 'agent-snowflake', target: 'output-1' },
      { id: 'e5', source: 'agent-copilot', target: 'output-1' },
    ],
  },
  // ============================================================================
  // RETAIL GROCER: Full PBI ↔ Snowflake Multi-Domain Orchestration
  // 
  // MICROSOFT SIDE (Left):
  //   - Power BI Copilot (entry)
  //   - TMDL Semantic Models (DAX measures, relationships)
  //   - MS Fabric Agent (orchestrator)
  //   - Power BI Renderer (visualization output)
  //
  // SNOWFLAKE SIDE (Right):
  //   - Supervisor (HUB - plans & dispatches)
  //   - Domain Cortex Agents (SPOKES)
  //   - Cortex Semantic Views (YAML)
  // ============================================================================
  'retail-grocer-multi-domain': {
    nodes: [
      // ═══════════════════════════════════════════════════════════════════════
      // MICROSOFT / POWER BI SIDE (x: 50-400)
      // ═══════════════════════════════════════════════════════════════════════
      
      { id: 'pbi-copilot', type: 'externalAgent', position: { x: 50, y: 280 }, data: { 
        label: '🟦 Power BI Copilot', 
        agentType: 'copilot',
        endpoint: 'https://api.powerbi.com/v1.0/myorg/copilot',
        method: 'POST',
        authType: 'oauth',
        provider: 'Microsoft',
        systemPrompt: 'User entry point. Receives: "Why did margin drop in Scotland?"'
      }},
      
      // Power BI TMDL Semantic Models (DAX-based)
      { id: 'tmdl-sales', type: 'snowflakeSource', position: { x: 220, y: 80 }, data: { 
        label: '📊 Sales TMDL', 
        objectType: 'view',
        database: 'FABRIC',
        schema: 'SEMANTIC_MODELS'
      }},
      { id: 'tmdl-inventory', type: 'snowflakeSource', position: { x: 220, y: 180 }, data: { 
        label: '📦 Inventory TMDL', 
        objectType: 'view',
        database: 'FABRIC',
        schema: 'SEMANTIC_MODELS'
      }},
      { id: 'tmdl-customer', type: 'snowflakeSource', position: { x: 220, y: 280 }, data: { 
        label: '👥 Customer TMDL', 
        objectType: 'view',
        database: 'FABRIC',
        schema: 'SEMANTIC_MODELS'
      }},
      { id: 'tmdl-promo', type: 'snowflakeSource', position: { x: 220, y: 380 }, data: { 
        label: '🏷️ Promo TMDL', 
        objectType: 'view',
        database: 'FABRIC',
        schema: 'SEMANTIC_MODELS'
      }},
      { id: 'tmdl-ops', type: 'snowflakeSource', position: { x: 220, y: 480 }, data: { 
        label: '🏪 Ops TMDL', 
        objectType: 'view',
        database: 'FABRIC',
        schema: 'SEMANTIC_MODELS'
      }},
      
      { id: 'ms-fabric-agent', type: 'externalAgent', position: { x: 400, y: 280 }, data: { 
        label: '🟦 MS Fabric Agent', 
        agentType: 'custom',
        endpoint: 'https://api.fabric.microsoft.com/v1/agent',
        method: 'POST',
        authType: 'oauth',
        provider: 'Microsoft',
        systemPrompt: 'MS Fabric orchestrator. Handoff complex queries to Snowflake.'
      }},
      
      // ═══════════════════════════════════════════════════════════════════════
      // GATEWAY (x: 580)
      // ═══════════════════════════════════════════════════════════════════════
      
      { id: 'gateway', type: 'condition', position: { x: 580, y: 280 }, data: { 
        label: '🔄 Agent Gateway',
        condition: 'Cross-platform handoff',
        description: 'Security checkpoint'
      }},
      
      // ═══════════════════════════════════════════════════════════════════════
      // SNOWFLAKE SIDE - SUPERVISOR HUB & SPOKE PATTERN (x: 780+)
      // ═══════════════════════════════════════════════════════════════════════
      
      // DATA SOURCES - Real Snowflake tables
      { id: 'src-sales', type: 'snowflakeSource', position: { x: 800, y: 0 }, data: { 
        label: 'SALES_TRANSACTIONS', 
        database: 'SNOWFLOW_DEV',
        schema: 'RETAIL_DEMO',
        objectType: 'table'
      }},
      { id: 'src-inventory', type: 'snowflakeSource', position: { x: 950, y: 0 }, data: { 
        label: 'INVENTORY', 
        database: 'SNOWFLOW_DEV',
        schema: 'RETAIL_DEMO',
        objectType: 'table'
      }},
      { id: 'src-ops', type: 'snowflakeSource', position: { x: 1100, y: 0 }, data: { 
        label: 'STORE_OPERATIONS', 
        database: 'SNOWFLOW_DEV',
        schema: 'RETAIL_DEMO',
        objectType: 'table'
      }},
      
      // SUPERVISOR - The central orchestrator (HUB)
      { id: 'supervisor-retail', type: 'supervisor', position: { x: 800, y: 280 }, data: { 
        label: '🧠 Retail Supervisor', 
        model: 'mistral-large2', 
        delegationStrategy: 'adaptive',
        systemPrompt: 'Head of Analytics for UK grocery retailer. Data available: SALES_TRANSACTIONS, INVENTORY, STORE_OPERATIONS, CUSTOMER_LOYALTY, PROMOTIONS in SNOWFLOW_DEV.RETAIL_DEMO. Scotland shows lower margins due to heavy promos, waste, and overtime. PLAN which agents needed, DISPATCH to them, AGGREGATE results.',
        aggregationMethod: 'synthesize'
      }},
      
      // DOMAIN AGENTS (SPOKES) - with real table references
      { id: 'agent-sales', type: 'agent', position: { x: 1050, y: 80 }, data: { 
        label: '💰 Sales Agent', 
        model: 'mistral-large2', 
        systemPrompt: 'Sales analyst for UK grocery retailer. Query SNOWFLOW_DEV.RETAIL_DEMO.SALES_TRANSACTIONS. Analyze revenue, margins, regional performance. Scotland has avg 15% margin vs England 30%. Heavy promo activity in Scotland.',
        tools: { analyst: { enabled: true }, sqlExecutor: { enabled: true } }
      }},
      { id: 'agent-inventory', type: 'agent', position: { x: 1150, y: 180 }, data: { 
        label: '📦 Inventory Agent', 
        model: 'mistral-large2', 
        systemPrompt: 'Supply chain analyst. Query SNOWFLOW_DEV.RETAIL_DEMO.INVENTORY. Scotland has high waste (25 units strawberries, 12 units milk) vs England (5, 3). Days of supply lower in Scotland.',
        tools: { analyst: { enabled: true }, sqlExecutor: { enabled: true } }
      }},
      { id: 'agent-ops', type: 'agent', position: { x: 1150, y: 380 }, data: { 
        label: '🏪 Ops Agent', 
        model: 'mistral-large2', 
        systemPrompt: 'Store operations analyst. Query SNOWFLOW_DEV.RETAIL_DEMO.STORE_OPERATIONS. Scotland stores have 45-52 overtime hours vs England 10-15. Higher waste and labour costs in Scotland.',
        tools: { analyst: { enabled: true }, sqlExecutor: { enabled: true } }
      }},
      { id: 'agent-promo', type: 'agent', position: { x: 1050, y: 480 }, data: { 
        label: '🏷️ Promo Agent', 
        model: 'mistral-large2', 
        systemPrompt: 'Trading analyst. Query SNOWFLOW_DEV.RETAIL_DEMO.PROMOTIONS. Scotland Autumn Sale has 25% discount, overspent budget (£18.5k vs £15k). ROI 1.73 vs England 2.46.',
        tools: { analyst: { enabled: true }, sqlExecutor: { enabled: true } }
      }},
      { id: 'agent-customer', type: 'agent', position: { x: 900, y: 480 }, data: { 
        label: '👥 Customer Agent', 
        model: 'mistral-large2', 
        systemPrompt: 'Customer insights analyst. Query SNOWFLOW_DEV.RETAIL_DEMO.CUSTOMER_LOYALTY. Analyze loyalty tiers, CLV scores, retention risk. Scotland has higher at-risk customers.',
        tools: { analyst: { enabled: true }, sqlExecutor: { enabled: true } }
      }},
      
      // Semantic Views (attached to each agent) - Snowflake YAML format
      { id: 'sv-sales', type: 'semanticModel', position: { x: 1050, y: 0 }, data: { 
        label: '❄️ Sales SV', 
        yamlFile: 'sales_revenue.yaml'
      }},
      { id: 'sv-inventory', type: 'semanticModel', position: { x: 1280, y: 180 }, data: { 
        label: '❄️ Inventory SV', 
        yamlFile: 'inventory_supply.yaml'
      }},
      { id: 'sv-ops', type: 'semanticModel', position: { x: 1280, y: 380 }, data: { 
        label: '❄️ Ops SV', 
        yamlFile: 'store_operations.yaml'
      }},
      { id: 'sv-promo', type: 'semanticModel', position: { x: 1050, y: 560 }, data: { 
        label: '❄️ Promo SV', 
        yamlFile: 'promotions.yaml'
      }},
      { id: 'sv-customer', type: 'semanticModel', position: { x: 820, y: 560 }, data: { 
        label: '❄️ Customer SV', 
        yamlFile: 'customer_loyalty.yaml'
      }},
      
      // ═══════════════════════════════════════════════════════════════════════
      // RETURN TO MICROSOFT
      // ═══════════════════════════════════════════════════════════════════════
      
      { id: 'pbi-renderer', type: 'externalAgent', position: { x: 1420, y: 280 }, data: { 
        label: '🟦 PBI Renderer', 
        agentType: 'custom',
        endpoint: 'https://api.powerbi.com/v1.0/myorg/reports',
        method: 'POST',
        authType: 'oauth',
        provider: 'Microsoft',
        systemPrompt: 'Create visualization from Snowflake insights.'
      }},
      
      { id: 'copilot-callback', type: 'externalAgent', position: { x: 1590, y: 280 }, data: { 
        label: '🔄 Copilot Callback', 
        agentType: 'copilot',
        endpoint: 'https://api.powerbi.com/v1.0/myorg/copilot/respond',
        method: 'POST',
        authType: 'oauth',
        provider: 'Microsoft',
        systemPrompt: 'Return response to user in Copilot.'
      }},
      
      { id: 'output-final', type: 'output', position: { x: 1760, y: 280 }, data: { 
        label: '📊 SnowFlow View', 
        outputType: 'display'
      }},
    ],
    edges: [
      // === MICROSOFT SIDE: Copilot + TMDLs → Fabric Agent ===
      { id: 'e1', source: 'pbi-copilot', target: 'ms-fabric-agent' },
      { id: 'e-tmdl1', source: 'tmdl-sales', target: 'ms-fabric-agent' },
      { id: 'e-tmdl2', source: 'tmdl-inventory', target: 'ms-fabric-agent' },
      { id: 'e-tmdl3', source: 'tmdl-customer', target: 'ms-fabric-agent' },
      { id: 'e-tmdl4', source: 'tmdl-promo', target: 'ms-fabric-agent' },
      { id: 'e-tmdl5', source: 'tmdl-ops', target: 'ms-fabric-agent' },
      
      // === GATEWAY → SUPERVISOR ===
      { id: 'e2', source: 'ms-fabric-agent', target: 'gateway' },
      { id: 'e3', source: 'gateway', target: 'supervisor-retail' },
      
      // === DATA SOURCES → SUPERVISOR ===
      { id: 'e-data1', source: 'src-sales', target: 'supervisor-retail' },
      { id: 'e-data2', source: 'src-inventory', target: 'supervisor-retail' },
      { id: 'e-data3', source: 'src-ops', target: 'supervisor-retail' },
      
      // === SUPERVISOR ↔ AGENTS (Hub & Spoke) ===
      { id: 'e4', source: 'supervisor-retail', target: 'agent-sales' },
      { id: 'e5', source: 'supervisor-retail', target: 'agent-inventory' },
      { id: 'e6', source: 'supervisor-retail', target: 'agent-ops' },
      { id: 'e7', source: 'supervisor-retail', target: 'agent-promo' },
      { id: 'e8', source: 'supervisor-retail', target: 'agent-customer' },
      
      // === AGENTS → SEMANTIC VIEWS ===
      { id: 'e9', source: 'agent-sales', target: 'sv-sales' },
      { id: 'e10', source: 'agent-inventory', target: 'sv-inventory' },
      { id: 'e11', source: 'agent-ops', target: 'sv-ops' },
      { id: 'e12', source: 'agent-promo', target: 'sv-promo' },
      { id: 'e13', source: 'agent-customer', target: 'sv-customer' },
      
      // === SUPERVISOR → OUTPUT ===
      { id: 'e14', source: 'supervisor-retail', target: 'pbi-renderer' },
      { id: 'e15', source: 'pbi-renderer', target: 'copilot-callback' },
      { id: 'e16', source: 'copilot-callback', target: 'output-final' },
    ],
  },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // SEMANTIC MODEL MIGRATION (Full Pipeline)
  // Schema Extractor → DAX Translator → Schema Transformer → Supervisor → Agents
  // ═══════════════════════════════════════════════════════════════════════════
  'semantic-model-migration': {
    nodes: [
      // ═══════════════════════════════════════════════════════════════════════
      // STAGE 1: INPUT & EXTRACTION
      // ═══════════════════════════════════════════════════════════════════════
      { id: 'tmdl-input', type: 'fileInput', position: { x: 50, y: 250 }, data: { 
        label: '📊 Power BI TMDL', 
        fileType: 'tmdl',
        fileContent: `// Power BI TMDL - Retail Sales Model
table Sales
  column ProductID: int64
  column Amount: decimal
  column Quantity: int64
  column DateKey: int64
  column RegionID: string

  measure 'Total Revenue' = SUM(Sales[Amount])
  measure 'Avg Order Value' = DIVIDE(SUM(Sales[Amount]), COUNT(Sales[ProductID]), 0)
  measure 'YoY Growth' = CALCULATE(SUM(Sales[Amount]), SAMEPERIODLASTYEAR('Date'[Date]))
  measure 'Margin %' = DIVIDE(SUM(Sales[Amount]) - SUM(Sales[Cost]), SUM(Sales[Amount]), 0)

table Date
  column Date: date
  column Year: int64
  column Month: int64
  column DateKey: int64

relationship Sales.DateKey -> Date.DateKey
`
      }},
      
      { id: 'schema-extractor', type: 'schemaExtractor', position: { x: 300, y: 250 }, data: { 
        label: '🔍 Schema Extractor',
        sourceFormat: 'powerbi',
        extractionAgent: 'copilot',
        model: 'mistral-large2',
        description: 'Microsoft Copilot extracts schema from TMDL'
      }},
      
      // ═══════════════════════════════════════════════════════════════════════
      // STAGE 2: DAX TRANSLATION
      // ═══════════════════════════════════════════════════════════════════════
      { id: 'dax-translator', type: 'daxTranslator', position: { x: 550, y: 250 }, data: { 
        label: '⚡ DAX Translator',
        daxExpression: 'SUM(Sales[Amount])',
        autoTranslate: true
      }},
      
      // ═══════════════════════════════════════════════════════════════════════
      // STAGE 3: SCHEMA TRANSFORMATION
      // ═══════════════════════════════════════════════════════════════════════
      { id: 'schema-transformer', type: 'schemaTransformer', position: { x: 800, y: 250 }, data: { 
        label: '🔄 Schema Transformer',
        targetFormat: 'snowflake',
        transformationAgent: 'cortex',
        database: 'SNOWFLOW_DEV',
        schema: 'DEMO',
        model: 'mistral-large2',
        description: 'Snowflake Cortex transforms to YAML'
      }},
      
      // ═══════════════════════════════════════════════════════════════════════
      // STAGE 4: SEMANTIC VIEWS (Translated)
      // ═══════════════════════════════════════════════════════════════════════
      { id: 'sv-analytics', type: 'semanticModel', position: { x: 1050, y: 150 }, data: { 
        label: '❄️ Analytics SV',
        database: 'SNOWFLOW_DEV',
        schema: 'DEMO',
        yamlFile: 'analytics_translated.yaml',
        description: 'Translated analytics semantic view'
      }},
      
      { id: 'sv-sales', type: 'semanticModel', position: { x: 1050, y: 350 }, data: { 
        label: '❄️ Sales SV',
        database: 'SNOWFLOW_DEV',
        schema: 'DEMO',
        yamlFile: 'sales_translated.yaml',
        description: 'Translated sales semantic view'
      }},
      
      // ═══════════════════════════════════════════════════════════════════════
      // STAGE 5: SUPERVISOR & AGENTS
      // ═══════════════════════════════════════════════════════════════════════
      { id: 'supervisor', type: 'supervisor', position: { x: 1300, y: 250 }, data: { 
        label: '🧠 Analytics Supervisor',
        model: 'mistral-large2',
        delegationStrategy: 'adaptive',
        systemPrompt: 'You orchestrate analytics queries. Use the translated semantic views (from Power BI TMDL) to answer questions. Delegate to Sales Agent for revenue/margin queries, Analytics Agent for trends/forecasts.',
        aggregationMethod: 'synthesize'
      }},
      
      { id: 'agent-analytics', type: 'agent', position: { x: 1550, y: 150 }, data: { 
        label: '📈 Analytics Agent',
        model: 'mistral-large2',
        systemPrompt: 'Analytics specialist. Analyze trends, forecasts, and YoY comparisons using the translated semantic views.',
        tools: { analyst: { enabled: true }, sqlExecutor: { enabled: true } }
      }},
      
      { id: 'agent-sales', type: 'agent', position: { x: 1550, y: 350 }, data: { 
        label: '💰 Sales Agent',
        model: 'mistral-large2',
        systemPrompt: 'Sales analyst. Answer questions using the translated SQL measures: Total Revenue = SUM(sales.amount), Avg Order Value, Margin %.',
        tools: { analyst: { enabled: true }, sqlExecutor: { enabled: true } }
      }},
      
      // ═══════════════════════════════════════════════════════════════════════
      // STAGE 6: OUTPUTS
      // ═══════════════════════════════════════════════════════════════════════
      { id: 'yaml-output', type: 'fileOutput', position: { x: 1050, y: 500 }, data: { 
        label: '📄 Cortex YAML',
        outputFormat: 'yaml',
        description: 'Download generated Snowflake semantic model'
      }},
      
      { id: 'output-display', type: 'output', position: { x: 1800, y: 250 }, data: { 
        label: '📊 Results',
        outputType: 'display'
      }},
    ],
    edges: [
      // Stage 1 → 2: Input to Extraction
      { id: 'e1', source: 'tmdl-input', target: 'schema-extractor' },
      
      // Stage 2 → 3: Extraction to Translation
      { id: 'e2', source: 'schema-extractor', target: 'dax-translator' },
      
      // Stage 3 → 4: Translation to Transformation
      { id: 'e3', source: 'dax-translator', target: 'schema-transformer' },
      
      // Stage 4 → 5: Transformation to Semantic Views
      { id: 'e4', source: 'schema-transformer', target: 'sv-analytics' },
      { id: 'e5', source: 'schema-transformer', target: 'sv-sales' },
      
      // Stage 4 → YAML Output (branched)
      { id: 'e6', source: 'schema-transformer', target: 'yaml-output' },
      
      // Stage 5: Semantic Views → Supervisor
      { id: 'e7', source: 'sv-analytics', target: 'supervisor' },
      { id: 'e8', source: 'sv-sales', target: 'supervisor' },
      
      // Stage 5: Supervisor → Agents
      { id: 'e9', source: 'supervisor', target: 'agent-analytics' },
      { id: 'e10', source: 'supervisor', target: 'agent-sales' },
      
      // Stage 6: Supervisor → Output
      { id: 'e11', source: 'supervisor', target: 'output-display' },
    ],
  },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // DAX TRANSLATION TEST TEMPLATE (Simplified)
  // SIMPLIFIED: Linear flow to test DAX translation end-to-end
  // ═══════════════════════════════════════════════════════════════════════════
  'dax-translation-test': {
    nodes: [
      // INPUT: Power BI TMDL
      { id: 'tmdl-input', type: 'fileInput', position: { x: 50, y: 200 }, data: { 
        label: '📊 Power BI TMDL', 
        fileType: 'tmdl',
        fileContent: `// Power BI TMDL - Sales Model
table Sales
  column ProductID: int64
  column Amount: decimal
  column Quantity: int64

  measure 'Total Revenue' = SUM(Sales[Amount])
  measure 'Avg Order Value' = DIVIDE(SUM(Sales[Amount]), COUNT(Sales[ProductID]), 0)
  measure 'YoY Growth' = CALCULATE(SUM(Sales[Amount]), SAMEPERIODLASTYEAR('Date'[Date]))
`
      }},
      
      // TRANSLATE: DAX → SQL
      { id: 'dax-translator', type: 'daxTranslator', position: { x: 300, y: 200 }, data: { 
        label: '⚡ DAX Translator',
        daxExpression: 'SUM(Sales[Amount])',
        autoTranslate: true
      }},
      
      // SEMANTIC VIEW: Contains translated SQL
      { id: 'semantic-view', type: 'semanticModel', position: { x: 550, y: 200 }, data: { 
        label: '❄️ Translated SV',
        database: 'SNOWFLOW_DEV',
        schema: 'DEMO',
        yamlFile: 'sales_translated.yaml',
        description: 'Snowflake Semantic View with DAX→SQL measures'
      }},
      
      // AGENT: Uses semantic view to answer
      { id: 'sales-agent', type: 'agent', position: { x: 800, y: 200 }, data: { 
        label: '💰 Sales Agent', 
        model: 'mistral-large2', 
        systemPrompt: 'Sales analyst. Answer questions using the translated SQL measures: Total Revenue = SUM(sales.amount), Avg Order Value = AVG calculation.',
        tools: { analyst: { enabled: true }, sqlExecutor: { enabled: true } }
      }},
      
      // OUTPUT: Display results
      { id: 'output', type: 'output', position: { x: 1050, y: 200 }, data: { 
        label: '📊 Results', 
        outputType: 'display'
      }},
    ],
    edges: [
      { id: 'e1', source: 'tmdl-input', target: 'dax-translator' },
      { id: 'e2', source: 'dax-translator', target: 'semantic-view' },
      { id: 'e3', source: 'semantic-view', target: 'sales-agent' },
      { id: 'e4', source: 'sales-agent', target: 'output' },
    ],
  },
  
  // ═══════════════════════════════════════════════════════════════════════════════
  // ENTERPRISE MIGRATION + ORCHESTRATION
  // The ultimate stress test combining:
  // - Power BI TMDL extraction
  // - DAX → SQL translation
  // - Snowflake semantic view generation
  // - Multi-agent supervisor orchestration
  // - Microsoft Copilot callback
  // ═══════════════════════════════════════════════════════════════════════════════
  'enterprise-migration-orchestration': {
    nodes: [
      // ═══════════════════════════════════════════════════════════════════════════
      // STAGE 1: MICROSOFT POWER BI SIDE
      // ═══════════════════════════════════════════════════════════════════════════
      
      // Entry: Power BI Copilot receives user query
      { id: 'pbi-copilot', type: 'externalAgent', position: { x: 50, y: 300 }, data: {
        label: '🟦 Power BI Copilot',
        agentType: 'copilot',
        endpoint: 'https://api.powerbi.com/v1.0/myorg/copilot',
        method: 'POST',
        authType: 'oauth',
        provider: 'Microsoft',
        systemPrompt: 'Entry point: User asks about sales performance'
      }},
      
      // TMDL Files (Power BI Semantic Models)
      { id: 'tmdl-sales', type: 'fileInput', position: { x: 200, y: 100 }, data: {
        label: '📊 Sales TMDL',
        fileType: 'tmdl',
        fileContent: `table Sales
  column ProductID: int64
  column Amount: decimal
  column RegionID: string
  column DateKey: int64
  
  measure 'Total Revenue' = SUM(Sales[Amount])
  measure 'Avg Order Value' = DIVIDE(SUM(Sales[Amount]), COUNT(Sales[ProductID]), 0)
  measure 'Margin %' = DIVIDE(SUM(Sales[Amount]) - SUM(Sales[Cost]), SUM(Sales[Amount]))
`
      }},
      
      { id: 'tmdl-inventory', type: 'fileInput', position: { x: 200, y: 220 }, data: {
        label: '📦 Inventory TMDL',
        fileType: 'tmdl',
        fileContent: `table Inventory
  column ProductID: int64
  column StockLevel: int64
  column ReorderPoint: int64
  
  measure 'Total Stock' = SUM(Inventory[StockLevel])
  measure 'Low Stock Items' = COUNTROWS(FILTER(Inventory, [StockLevel] < [ReorderPoint]))
`
      }},
      
      { id: 'tmdl-promo', type: 'fileInput', position: { x: 200, y: 340 }, data: {
        label: '🏷️ Promo TMDL',
        fileType: 'tmdl',
        fileContent: `table Promotions
  column PromoID: string
  column DiscountPct: decimal
  column ROI: decimal
  
  measure 'Promo ROI' = AVERAGE(Promotions[ROI])
  measure 'Best Promo' = MAXX(Promotions, [ROI])
`
      }},
      
      // ═══════════════════════════════════════════════════════════════════════════
      // STAGE 2: DAX TRANSLATION PIPELINE
      // ═══════════════════════════════════════════════════════════════════════════
      
      { id: 'dax-translator', type: 'daxTranslator', position: { x: 450, y: 220 }, data: {
        label: '⚡ DAX Translator',
        daxExpression: 'SUM(Sales[Amount])',
        autoTranslate: true
      }},
      
      { id: 'schema-transformer', type: 'schemaTransformer', position: { x: 650, y: 220 }, data: {
        label: '🔄 Schema Transformer',
        targetFormat: 'snowflake',
        transformationAgent: 'cortex',
        database: 'SNOWFLOW_DEV',
        schema: 'DEMO'
      }},
      
      // ═══════════════════════════════════════════════════════════════════════════
      // STAGE 3: SNOWFLAKE SEMANTIC VIEWS (Translated from Power BI)
      // ═══════════════════════════════════════════════════════════════════════════
      
      { id: 'sv-sales', type: 'semanticModel', position: { x: 850, y: 120 }, data: {
        label: '❄️ Sales SV',
        database: 'SNOWFLOW_DEV',
        schema: 'DEMO',
        yamlFile: 'sales_translated.yaml',
        description: 'Translated from Power BI Sales TMDL'
      }},
      
      { id: 'sv-inventory', type: 'semanticModel', position: { x: 850, y: 240 }, data: {
        label: '❄️ Inventory SV',
        database: 'SNOWFLOW_DEV',
        schema: 'DEMO',
        yamlFile: 'inventory_translated.yaml',
        description: 'Translated from Power BI Inventory TMDL'
      }},
      
      { id: 'sv-promo', type: 'semanticModel', position: { x: 850, y: 360 }, data: {
        label: '❄️ Promo SV',
        database: 'SNOWFLOW_DEV',
        schema: 'DEMO',
        yamlFile: 'promo_translated.yaml',
        description: 'Translated from Power BI Promo TMDL'
      }},
      
      // ═══════════════════════════════════════════════════════════════════════════
      // STAGE 4: MULTI-AGENT SUPERVISOR
      // ═══════════════════════════════════════════════════════════════════════════
      
      { id: 'supervisor', type: 'supervisor', position: { x: 1050, y: 240 }, data: {
        label: '🧠 Analytics Supervisor',
        model: 'mistral-large2',
        delegationStrategy: 'adaptive',
        systemPrompt: 'You orchestrate analytics queries across Sales, Inventory, and Promo domains. Analyze the user question and decide which domain agent(s) to consult. Use the translated Snowflake semantic views.',
        aggregationMethod: 'synthesize'
      }},
      
      // Domain Agents
      { id: 'agent-sales', type: 'agent', position: { x: 1250, y: 120 }, data: {
        label: '💰 Sales Agent',
        model: 'mistral-large2',
        systemPrompt: 'Sales analyst. Use the translated semantic view (from Power BI TMDL) to answer revenue, margin, and sales performance questions.',
        tools: { analyst: { enabled: true }, sqlExecutor: { enabled: true } }
      }},
      
      { id: 'agent-inventory', type: 'agent', position: { x: 1250, y: 240 }, data: {
        label: '📦 Inventory Agent',
        model: 'mistral-large2',
        systemPrompt: 'Inventory analyst. Use the translated semantic view to answer stock, supply chain, and reorder questions.',
        tools: { analyst: { enabled: true }, sqlExecutor: { enabled: true } }
      }},
      
      { id: 'agent-promo', type: 'agent', position: { x: 1250, y: 360 }, data: {
        label: '🏷️ Promo Agent',
        model: 'mistral-large2',
        systemPrompt: 'Promotions analyst. Use the translated semantic view to answer promotional effectiveness, ROI, and campaign questions.',
        tools: { analyst: { enabled: true }, sqlExecutor: { enabled: true } }
      }},
      
      // ═══════════════════════════════════════════════════════════════════════════
      // STAGE 5: OUTPUT & CALLBACK
      // ═══════════════════════════════════════════════════════════════════════════
      
      { id: 'yaml-output', type: 'fileOutput', position: { x: 850, y: 480 }, data: {
        label: '📄 Cortex YAML',
        outputFormat: 'yaml',
        description: 'Download the translated Snowflake semantic model'
      }},
      
      { id: 'pbi-callback', type: 'externalAgent', position: { x: 1450, y: 240 }, data: {
        label: '🔄 Copilot Callback',
        agentType: 'copilot',
        endpoint: 'https://api.powerbi.com/v1.0/myorg/copilot/respond',
        method: 'POST',
        authType: 'oauth',
        provider: 'Microsoft',
        systemPrompt: 'Return synthesized results to Power BI Copilot for visualization'
      }},
      
      { id: 'output-final', type: 'output', position: { x: 1650, y: 240 }, data: {
        label: '📊 Results',
        outputType: 'display'
      }},
    ],
    edges: [
      // STAGE 1: TMDLs feed into DAX Translator
      { id: 'e1', source: 'tmdl-sales', target: 'dax-translator' },
      { id: 'e2', source: 'tmdl-inventory', target: 'dax-translator' },
      { id: 'e3', source: 'tmdl-promo', target: 'dax-translator' },
      
      // Copilot also triggers the flow
      { id: 'e4', source: 'pbi-copilot', target: 'dax-translator' },
      
      // STAGE 2: DAX Translator → Schema Transformer
      { id: 'e5', source: 'dax-translator', target: 'schema-transformer' },
      
      // STAGE 3: Schema Transformer → Semantic Views + YAML Output
      { id: 'e6', source: 'schema-transformer', target: 'sv-sales' },
      { id: 'e7', source: 'schema-transformer', target: 'sv-inventory' },
      { id: 'e8', source: 'schema-transformer', target: 'sv-promo' },
      { id: 'e9', source: 'schema-transformer', target: 'yaml-output' },
      
      // STAGE 4: Semantic Views → Supervisor
      { id: 'e10', source: 'sv-sales', target: 'supervisor' },
      { id: 'e11', source: 'sv-inventory', target: 'supervisor' },
      { id: 'e12', source: 'sv-promo', target: 'supervisor' },
      
      // Supervisor → Agents
      { id: 'e13', source: 'supervisor', target: 'agent-sales' },
      { id: 'e14', source: 'supervisor', target: 'agent-inventory' },
      { id: 'e15', source: 'supervisor', target: 'agent-promo' },
      
      // Supervisor → Callback
      { id: 'e16', source: 'supervisor', target: 'pbi-callback' },
      
      // STAGE 5: Callback → Output
      { id: 'e17', source: 'pbi-callback', target: 'output-final' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🖤 BLACK FRIDAY POST-MORTEM (EXTREME COMPLEXITY)
  // Fortune 500 Retail Scenario with:
  // - Complex DAX: YoY Growth, Customer LTV, Rolling Averages, Market Basket, Promo Lift
  // - 6 Domain Agents: Sales, Inventory, Promo, Customer, Operations, Finance
  // - External Agents: Power BI Copilot, MS Fabric, Market Intelligence API
  // - Bidirectional flow with comprehensive callback
  // ═══════════════════════════════════════════════════════════════════════════════
  'black-friday-postmortem': {
    nodes: [
      // ═══════════════════════════════════════════════════════════════════════════
      // STAGE 1: EXTERNAL ENTRY POINTS (Microsoft Ecosystem)
      // ═══════════════════════════════════════════════════════════════════════════
      
      { id: 'pbi-copilot', type: 'externalAgent', position: { x: 50, y: 350 }, data: {
        label: '🟦 Power BI Copilot',
        agentType: 'copilot',
        endpoint: 'https://api.powerbi.com/v1.0/myorg/copilot',
        method: 'POST',
        authType: 'oauth',
        provider: 'Microsoft',
        systemPrompt: 'Executive asks: Give me a complete Black Friday post-mortem analysis'
      }},
      
      { id: 'ms-fabric', type: 'externalAgent', position: { x: 50, y: 500 }, data: {
        label: '🟦 MS Fabric Agent',
        agentType: 'custom',
        endpoint: 'https://api.fabric.microsoft.com/v1/agent',
        method: 'POST',
        authType: 'oauth',
        provider: 'Microsoft',
        systemPrompt: 'Fabric OneLake data lakehouse context'
      }},
      
      { id: 'market-intel', type: 'externalAgent', position: { x: 50, y: 650 }, data: {
        label: '📊 Market Intelligence',
        agentType: 'custom',
        endpoint: 'https://api.marketintel.com/v1/competitor-pricing',
        method: 'GET',
        authType: 'apiKey',
        provider: 'Third-Party',
        systemPrompt: 'Competitor pricing and market share data'
      }},

      // ═══════════════════════════════════════════════════════════════════════════
      // AGENT GATEWAY - Security & Protocol Translation Layer
      // ═══════════════════════════════════════════════════════════════════════════
      
      { id: 'agent-gateway', type: 'externalAgent', position: { x: 150, y: 700 }, data: {
        label: '🛡️ Agent Gateway',
        agentType: 'gateway',
        endpoint: 'internal://gateway',
        method: 'POST',
        authType: 'oauth',
        provider: 'SnowFlow',
        systemPrompt: 'Security Gateway: OAuth, Rate Limiting, Circuit Breaker, Audit Logging, Protocol Translation between Snowflake Cortex and Microsoft Fabric agents'
      }},

      // ═══════════════════════════════════════════════════════════════════════════
      // STAGE 2: COMPLEX TMDL FILES (Real Enterprise DAX Measures)
      // ═══════════════════════════════════════════════════════════════════════════
      
      { id: 'tmdl-sales', type: 'fileInput', position: { x: 250, y: 50 }, data: {
        label: '💰 Sales TMDL',
        fileType: 'tmdl',
        fileContent: `table Sales
  column TransactionID: string
  column ProductID: int64
  column CustomerID: string
  column Amount: decimal
  column Cost: decimal
  column Quantity: int64
  column RegionID: string
  column ChannelID: string  // Online vs In-Store
  column DateKey: int64
  column StoreID: string
  
  // ═══════════════════════════════════════════════════════════════════
  // COMPLEX DAX MEASURE: Year-over-Year Growth with Time Intelligence
  // ═══════════════════════════════════════════════════════════════════
  measure 'YoY Revenue Growth %' = 
    VAR CurrentPeriod = CALCULATE(SUM(Sales[Amount]), DATESYTD(Calendar[Date]))
    VAR PriorPeriod = CALCULATE(SUM(Sales[Amount]), SAMEPERIODLASTYEAR(DATESYTD(Calendar[Date])))
    RETURN DIVIDE(CurrentPeriod - PriorPeriod, PriorPeriod, 0) * 100

  // ═══════════════════════════════════════════════════════════════════
  // COMPLEX DAX MEASURE: Rolling 7-Day Average
  // ═══════════════════════════════════════════════════════════════════
  measure 'Rolling 7-Day Avg' = 
    AVERAGEX(
      DATESINPERIOD(Calendar[Date], LASTDATE(Calendar[Date]), -7, DAY),
      CALCULATE(SUM(Sales[Amount]))
    )

  // ═══════════════════════════════════════════════════════════════════
  // COMPLEX DAX MEASURE: Channel Mix (Online vs In-Store)
  // ═══════════════════════════════════════════════════════════════════
  measure 'Online Share %' = 
    DIVIDE(
      CALCULATE(SUM(Sales[Amount]), Sales[ChannelID] = "ONLINE"),
      SUM(Sales[Amount]),
      0
    ) * 100

  measure 'Gross Margin %' = DIVIDE(SUM(Sales[Amount]) - SUM(Sales[Cost]), SUM(Sales[Amount]), 0) * 100
  measure 'Avg Transaction Value' = DIVIDE(SUM(Sales[Amount]), DISTINCTCOUNT(Sales[TransactionID]), 0)
  measure 'Units Per Transaction' = DIVIDE(SUM(Sales[Quantity]), DISTINCTCOUNT(Sales[TransactionID]), 0)
`
      }},
      
      { id: 'tmdl-customer', type: 'fileInput', position: { x: 250, y: 170 }, data: {
        label: '👥 Customer TMDL',
        fileType: 'tmdl',
        fileContent: `table Customers
  column CustomerID: string
  column FirstPurchaseDate: date
  column Segment: string  // New, Returning, VIP, Churned
  column LoyaltyTier: string
  column AcquisitionChannel: string
  column LifetimeOrders: int64
  column LifetimeRevenue: decimal
  
  // ═══════════════════════════════════════════════════════════════════
  // COMPLEX DAX MEASURE: Customer Lifetime Value (LTV)
  // ═══════════════════════════════════════════════════════════════════
  measure 'Customer LTV' = 
    AVERAGEX(
      VALUES(Customers[CustomerID]),
      VAR CustomerRev = CALCULATE(SUM(Sales[Amount]))
      VAR TenureMonths = DATEDIFF(MIN(Customers[FirstPurchaseDate]), TODAY(), MONTH)
      VAR MonthlyValue = DIVIDE(CustomerRev, MAX(TenureMonths, 1))
      RETURN MonthlyValue * 36  // 3-year projected LTV
    )

  // ═══════════════════════════════════════════════════════════════════
  // COMPLEX DAX MEASURE: New vs Returning Customer Split
  // ═══════════════════════════════════════════════════════════════════
  measure 'New Customer Revenue %' = 
    VAR NewCustomerRev = CALCULATE(
      SUM(Sales[Amount]),
      FILTER(Customers, Customers[Segment] = "New")
    )
    RETURN DIVIDE(NewCustomerRev, SUM(Sales[Amount]), 0) * 100

  // ═══════════════════════════════════════════════════════════════════
  // COMPLEX DAX MEASURE: Customer Acquisition Cost Efficiency
  // ═══════════════════════════════════════════════════════════════════
  measure 'CAC to LTV Ratio' = 
    DIVIDE([Customer LTV], [Avg Acquisition Cost], 0)

  measure 'Customer Count' = DISTINCTCOUNT(Customers[CustomerID])
  measure 'Repeat Purchase Rate' = DIVIDE(
    CALCULATE(COUNTROWS(Customers), Customers[LifetimeOrders] > 1),
    COUNTROWS(Customers),
    0
  ) * 100
`
      }},
      
      { id: 'tmdl-inventory', type: 'fileInput', position: { x: 250, y: 290 }, data: {
        label: '📦 Inventory TMDL',
        fileType: 'tmdl',
        fileContent: `table Inventory
  column ProductID: int64
  column SKU: string
  column StockLevel: int64
  column ReorderPoint: int64
  column SafetyStock: int64
  column LeadTimeDays: int64
  column WarehouseID: string
  column LastRestockDate: date
  
  // ═══════════════════════════════════════════════════════════════════
  // COMPLEX DAX MEASURE: Days of Inventory On Hand
  // ═══════════════════════════════════════════════════════════════════
  measure 'Days On Hand' = 
    VAR AvgDailySales = DIVIDE(
      CALCULATE(SUM(Sales[Quantity]), DATESINPERIOD(Calendar[Date], TODAY(), -30, DAY)),
      30
    )
    VAR CurrentStock = SUM(Inventory[StockLevel])
    RETURN DIVIDE(CurrentStock, MAX(AvgDailySales, 0.1), 0)

  // ═══════════════════════════════════════════════════════════════════
  // COMPLEX DAX MEASURE: Stockout Revenue Impact
  // ═══════════════════════════════════════════════════════════════════
  measure 'Stockout Lost Revenue' = 
    VAR StockoutItems = FILTER(Inventory, Inventory[StockLevel] = 0)
    VAR AvgItemRevenue = AVERAGEX(
      VALUES(Products[ProductID]),
      CALCULATE(SUM(Sales[Amount]))
    )
    RETURN COUNTROWS(StockoutItems) * AvgItemRevenue

  measure 'In-Stock Rate %' = DIVIDE(
    CALCULATE(COUNTROWS(Inventory), Inventory[StockLevel] > 0),
    COUNTROWS(Inventory),
    0
  ) * 100
  measure 'Below Reorder Point' = CALCULATE(COUNTROWS(Inventory), Inventory[StockLevel] < Inventory[ReorderPoint])
`
      }},
      
      { id: 'tmdl-promo', type: 'fileInput', position: { x: 250, y: 410 }, data: {
        label: '🏷️ Promotions TMDL',
        fileType: 'tmdl',
        fileContent: `table Promotions
  column PromoID: string
  column PromoType: string  // BOGO, Percentage, Flash, Bundle
  column DiscountPercent: decimal
  column StartDate: date
  column EndDate: date
  column CategoryID: string
  column MinPurchase: decimal
  column RedemptionCount: int64
  column PromoCost: decimal
  
  // ═══════════════════════════════════════════════════════════════════
  // COMPLEX DAX MEASURE: Promotional Lift with Control Group
  // ═══════════════════════════════════════════════════════════════════
  measure 'Promo Lift %' = 
    VAR PromoSales = CALCULATE(SUM(Sales[Amount]), Promotions[IsActive] = TRUE)
    VAR BaselinePeriod = DATESINPERIOD(Calendar[Date], MIN(Promotions[StartDate]), -4, WEEK)
    VAR BaselineDailyAvg = DIVIDE(
      CALCULATE(SUM(Sales[Amount]), BaselinePeriod),
      28
    )
    VAR PromoDays = DATEDIFF(MIN(Promotions[StartDate]), MAX(Promotions[EndDate]), DAY)
    VAR ExpectedSales = BaselineDailyAvg * PromoDays
    RETURN DIVIDE(PromoSales - ExpectedSales, ExpectedSales, 0) * 100

  // ═══════════════════════════════════════════════════════════════════
  // COMPLEX DAX MEASURE: Promotional ROI
  // ═══════════════════════════════════════════════════════════════════
  measure 'Promo ROI' = 
    VAR IncrementalRevenue = [Promo Lift %] / 100 * SUM(Sales[Amount])
    VAR PromoCost = SUM(Promotions[PromoCost])
    RETURN DIVIDE(IncrementalRevenue - PromoCost, PromoCost, 0)

  measure 'Redemption Rate %' = DIVIDE(SUM(Promotions[RedemptionCount]), [Total Transactions], 0) * 100
  measure 'Avg Discount Given' = AVERAGE(Promotions[DiscountPercent])
`
      }},
      
      { id: 'tmdl-ops', type: 'fileInput', position: { x: 250, y: 530 }, data: {
        label: '🏪 Operations TMDL',
        fileType: 'tmdl',
        fileContent: `table StoreOperations
  column StoreID: string
  column Region: string
  column StoreType: string  // Flagship, Standard, Express
  column TrafficCount: int64
  column StaffCount: int64
  column OperatingHours: decimal
  column DateKey: int64
  column FulfillmentType: string  // In-Store, BOPIS, Ship-from-Store

  // ═══════════════════════════════════════════════════════════════════
  // COMPLEX DAX MEASURE: Conversion Rate with Traffic Attribution
  // ═══════════════════════════════════════════════════════════════════
  measure 'Conversion Rate %' = 
    DIVIDE(
      DISTINCTCOUNT(Sales[TransactionID]),
      SUM(StoreOperations[TrafficCount]),
      0
    ) * 100

  // ═══════════════════════════════════════════════════════════════════
  // COMPLEX DAX MEASURE: Revenue Per Labor Hour
  // ═══════════════════════════════════════════════════════════════════
  measure 'Rev Per Labor Hour' = 
    DIVIDE(
      SUM(Sales[Amount]),
      SUMX(StoreOperations, StoreOperations[StaffCount] * StoreOperations[OperatingHours]),
      0
    )

  // ═══════════════════════════════════════════════════════════════════
  // COMPLEX DAX MEASURE: BOPIS Share (Buy Online Pick-up In Store)
  // ═══════════════════════════════════════════════════════════════════
  measure 'BOPIS Share %' = 
    DIVIDE(
      CALCULATE(COUNTROWS(StoreOperations), StoreOperations[FulfillmentType] = "BOPIS"),
      COUNTROWS(StoreOperations),
      0
    ) * 100

  measure 'Traffic vs Last Year' = 
    VAR CurrentTraffic = SUM(StoreOperations[TrafficCount])
    VAR LastYearTraffic = CALCULATE(SUM(StoreOperations[TrafficCount]), SAMEPERIODLASTYEAR(Calendar[Date]))
    RETURN DIVIDE(CurrentTraffic - LastYearTraffic, LastYearTraffic, 0) * 100
`
      }},
      
      { id: 'tmdl-finance', type: 'fileInput', position: { x: 250, y: 650 }, data: {
        label: '💵 Finance TMDL',
        fileType: 'tmdl',
        fileContent: `table Finance
  column CategoryID: string
  column BudgetAmount: decimal
  column ActualAmount: decimal
  column ForecastAmount: decimal
  column Period: string
  column CostCenter: string

  // ═══════════════════════════════════════════════════════════════════
  // COMPLEX DAX MEASURE: Budget Variance Analysis
  // ═══════════════════════════════════════════════════════════════════
  measure 'Budget Variance %' = 
    DIVIDE(
      SUM(Finance[ActualAmount]) - SUM(Finance[BudgetAmount]),
      SUM(Finance[BudgetAmount]),
      0
    ) * 100

  // ═══════════════════════════════════════════════════════════════════
  // COMPLEX DAX MEASURE: Forecast Accuracy
  // ═══════════════════════════════════════════════════════════════════
  measure 'Forecast Accuracy %' = 
    1 - ABS(DIVIDE(
      SUM(Finance[ActualAmount]) - SUM(Finance[ForecastAmount]),
      SUM(Finance[ForecastAmount]),
      0
    ))

  measure 'Marketing Spend ROI' = DIVIDE([Incremental Revenue], [Marketing Spend], 0)
`
      }},

      // ═══════════════════════════════════════════════════════════════════════════
      // STAGE 3: DAX TRANSLATOR (Complex multi-measure translation)
      // ═══════════════════════════════════════════════════════════════════════════
      
      { id: 'dax-translator', type: 'daxTranslator', position: { x: 500, y: 300 }, data: {
        label: '⚡ Enterprise DAX Translator',
        daxExpression: `// Complex multi-measure Black Friday analysis
VAR BlackFridayRevenue = CALCULATE(SUM(Sales[Amount]), Calendar[Date] = DATE(2024, 11, 29))
VAR LastYearBF = CALCULATE(SUM(Sales[Amount]), Calendar[Date] = DATE(2023, 11, 24))
VAR YoYGrowth = DIVIDE(BlackFridayRevenue - LastYearBF, LastYearBF, 0)
VAR OnlineShare = DIVIDE(CALCULATE(SUM(Sales[Amount]), Sales[ChannelID] = "ONLINE"), BlackFridayRevenue, 0)
VAR AvgBasketSize = DIVIDE(BlackFridayRevenue, DISTINCTCOUNT(Sales[TransactionID]), 0)
VAR NewCustomerRev = CALCULATE(SUM(Sales[Amount]), FILTER(Customers, Customers[Segment] = "New"))
RETURN 
  "YoY: " & FORMAT(YoYGrowth, "0.0%") & 
  " | Online: " & FORMAT(OnlineShare, "0.0%") &
  " | Basket: " & FORMAT(AvgBasketSize, "$#,##0")`,
        sqlOutput: '',
        confidence: 'analyzing'
      }},

      // ═══════════════════════════════════════════════════════════════════════════
      // STAGE 4: SCHEMA TRANSFORMER + SEMANTIC VIEWS
      // ═══════════════════════════════════════════════════════════════════════════
      
      { id: 'schema-transformer', type: 'schemaTransformer', position: { x: 750, y: 300 }, data: {
        label: '🔄 Schema Transformer',
        sourceFormat: 'json',
        targetFormat: 'yaml',
        targetPlatform: 'snowflake',
        extractionAgent: 'cortex',
        database: 'SNOWFLOW_PROD.RETAIL_ANALYTICS'
      }},
      
      // Snowflake Semantic Views (6 domains)
      { id: 'sv-sales', type: 'semanticModel', position: { x: 550, y: 700 }, data: {
        label: '❄️ Sales SV',
        yamlFile: 'bf_sales_analytics.yaml',
        description: 'Black Friday sales semantic view'
      }},
      { id: 'sv-customer', type: 'semanticModel', position: { x: 700, y: 700 }, data: {
        label: '❄️ Customer SV',
        yamlFile: 'bf_customer_analytics.yaml',
        description: 'Customer behavior semantic view'
      }},
      { id: 'sv-inventory', type: 'semanticModel', position: { x: 850, y: 700 }, data: {
        label: '❄️ Inventory SV',
        yamlFile: 'bf_inventory_analytics.yaml',
        description: 'Inventory & stockout semantic view'
      }},
      { id: 'sv-promo', type: 'semanticModel', position: { x: 1000, y: 700 }, data: {
        label: '❄️ Promo SV',
        yamlFile: 'bf_promo_analytics.yaml',
        description: 'Promotional lift semantic view'
      }},
      { id: 'sv-ops', type: 'semanticModel', position: { x: 1150, y: 700 }, data: {
        label: '❄️ Operations SV',
        yamlFile: 'bf_operations_analytics.yaml',
        description: 'Store operations semantic view'
      }},
      { id: 'sv-finance', type: 'semanticModel', position: { x: 1300, y: 700 }, data: {
        label: '❄️ Finance SV',
        yamlFile: 'bf_finance_analytics.yaml',
        description: 'Financial performance semantic view'
      }},

      // ═══════════════════════════════════════════════════════════════════════════
      // STAGE 5: SUPERVISOR + 6 DOMAIN AGENTS
      // ═══════════════════════════════════════════════════════════════════════════
      
      { id: 'supervisor', type: 'supervisor', position: { x: 900, y: 500 }, data: {
        label: '🧠 Executive Analytics Supervisor',
        model: 'mistral-large2',
        strategy: 'adaptive',
        childAgents: ['Sales', 'Customer', 'Inventory', 'Promo', 'Operations', 'Finance'],
        systemPrompt: 'You are a Fortune 500 retail executive analyst. Route queries to appropriate domain experts for Black Friday post-mortem analysis.'
      }},
      
      // 6 Domain Agents
      { id: 'agent-sales', type: 'cortexAgent', position: { x: 1100, y: 100 }, data: {
        label: '💰 Sales Agent',
        model: 'mistral-large2',
        tools: ['Analyst', 'Search', 'SQL'],
        systemPrompt: 'Sales analyst specializing in revenue, YoY growth, channel mix, and transaction analysis for Black Friday.'
      }},
      { id: 'agent-customer', type: 'cortexAgent', position: { x: 1250, y: 100 }, data: {
        label: '👥 Customer Agent',
        model: 'mistral-large2',
        tools: ['Analyst', 'Search', 'SQL'],
        systemPrompt: 'Customer analyst specializing in LTV, acquisition, retention, and segment behavior for Black Friday.'
      }},
      { id: 'agent-inventory', type: 'cortexAgent', position: { x: 1100, y: 220 }, data: {
        label: '📦 Inventory Agent',
        model: 'mistral-large2',
        tools: ['Analyst', 'Search', 'SQL'],
        systemPrompt: 'Supply chain analyst specializing in stockouts, days-on-hand, and inventory optimization for Black Friday.'
      }},
      { id: 'agent-promo', type: 'cortexAgent', position: { x: 1250, y: 220 }, data: {
        label: '🏷️ Promo Agent',
        model: 'mistral-large2',
        tools: ['Analyst', 'Search', 'SQL'],
        systemPrompt: 'Promotional analyst specializing in lift, ROI, redemption rates, and campaign effectiveness for Black Friday.'
      }},
      { id: 'agent-ops', type: 'cortexAgent', position: { x: 1100, y: 340 }, data: {
        label: '🏪 Operations Agent',
        model: 'mistral-large2',
        tools: ['Analyst', 'Search', 'SQL'],
        systemPrompt: 'Operations analyst specializing in store traffic, conversion, labor efficiency, and fulfillment for Black Friday.'
      }},
      { id: 'agent-finance', type: 'cortexAgent', position: { x: 1250, y: 340 }, data: {
        label: '💵 Finance Agent',
        model: 'mistral-large2',
        tools: ['Analyst', 'Search', 'SQL'],
        systemPrompt: 'Financial analyst specializing in budget variance, forecast accuracy, and ROI for Black Friday.'
      }},

      // ═══════════════════════════════════════════════════════════════════════════
      // STAGE 6: OUTPUT & CALLBACKS
      // ═══════════════════════════════════════════════════════════════════════════
      
      { id: 'yaml-output', type: 'fileOutput', position: { x: 1000, y: 850 }, data: {
        label: '📄 Cortex YAML Bundle',
        outputFormat: 'yaml',
        description: 'Complete translated semantic model bundle'
      }},
      
      { id: 'pbi-callback', type: 'externalAgent', position: { x: 1450, y: 400 }, data: {
        label: '🔄 Copilot Callback',
        agentType: 'copilot',
        endpoint: 'https://api.powerbi.com/v1.0/myorg/copilot/respond',
        method: 'POST',
        authType: 'oauth',
        provider: 'Microsoft',
        systemPrompt: 'Return comprehensive Black Friday analysis to Power BI for executive dashboard visualization'
      }},
      
      { id: 'output-final', type: 'output', position: { x: 1600, y: 400 }, data: {
        label: '📊 Executive Dashboard',
        outputType: 'display'
      }},
    ],
    edges: [
      // External agents → Gateway (Security Layer)
      { id: 'e1', source: 'pbi-copilot', target: 'agent-gateway' },
      { id: 'e2', source: 'ms-fabric', target: 'agent-gateway' },
      { id: 'e3', source: 'market-intel', target: 'agent-gateway' },
      
      // Gateway → Internal Processing
      { id: 'e1b', source: 'agent-gateway', target: 'dax-translator' },
      
      // TMDLs → DAX Translator
      { id: 'e4', source: 'tmdl-sales', target: 'dax-translator' },
      { id: 'e5', source: 'tmdl-customer', target: 'dax-translator' },
      { id: 'e6', source: 'tmdl-inventory', target: 'dax-translator' },
      { id: 'e7', source: 'tmdl-promo', target: 'dax-translator' },
      { id: 'e8', source: 'tmdl-ops', target: 'dax-translator' },
      { id: 'e9', source: 'tmdl-finance', target: 'dax-translator' },
      
      // DAX Translator → Schema Transformer
      { id: 'e10', source: 'dax-translator', target: 'schema-transformer' },
      
      // Schema Transformer → Semantic Views
      { id: 'e11', source: 'schema-transformer', target: 'sv-sales' },
      { id: 'e12', source: 'schema-transformer', target: 'sv-customer' },
      { id: 'e13', source: 'schema-transformer', target: 'sv-inventory' },
      { id: 'e14', source: 'schema-transformer', target: 'sv-promo' },
      { id: 'e15', source: 'schema-transformer', target: 'sv-ops' },
      { id: 'e16', source: 'schema-transformer', target: 'sv-finance' },
      { id: 'e17', source: 'schema-transformer', target: 'yaml-output' },
      
      // Semantic Views → Supervisor
      { id: 'e18', source: 'sv-sales', target: 'supervisor' },
      { id: 'e19', source: 'sv-customer', target: 'supervisor' },
      { id: 'e20', source: 'sv-inventory', target: 'supervisor' },
      { id: 'e21', source: 'sv-promo', target: 'supervisor' },
      { id: 'e22', source: 'sv-ops', target: 'supervisor' },
      { id: 'e23', source: 'sv-finance', target: 'supervisor' },
      
      // Supervisor → All 6 Agents
      { id: 'e24', source: 'supervisor', target: 'agent-sales' },
      { id: 'e25', source: 'supervisor', target: 'agent-customer' },
      { id: 'e26', source: 'supervisor', target: 'agent-inventory' },
      { id: 'e27', source: 'supervisor', target: 'agent-promo' },
      { id: 'e28', source: 'supervisor', target: 'agent-ops' },
      { id: 'e29', source: 'supervisor', target: 'agent-finance' },
      
      // All agents connect to output (parallel execution)
      { id: 'e32', source: 'agent-sales', target: 'output-final' },
      { id: 'e33', source: 'agent-customer', target: 'output-final' },
      { id: 'e34', source: 'agent-inventory', target: 'output-final' },
      { id: 'e35', source: 'agent-promo', target: 'output-final' },
      { id: 'e36', source: 'agent-ops', target: 'output-final' },
      { id: 'e37', source: 'agent-finance', target: 'output-final' },
      
      // Supervisor also connects to callback, callback to output
      { id: 'e30', source: 'supervisor', target: 'pbi-callback' },
      { id: 'e31', source: 'pbi-callback', target: 'output-final' },
      
      // YAML Output → Supervisor
      { id: 'e38', source: 'yaml-output', target: 'supervisor' },
    ],
  },
};
