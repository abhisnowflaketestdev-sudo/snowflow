import { useState, useEffect, useCallback } from 'react';
import { 
  BarChart3, Activity, Clock, AlertTriangle, CheckCircle, 
  Database, Brain, Shield, RefreshCw, Eye, Settings,
  Loader2, Zap, Globe, Lock, FileText,
  Play, Check, Server, Cpu, DollarSign, Save,
  Network, GitBranch, Workflow, ChevronDown,
  ChevronUp
} from 'lucide-react';
import axios from 'axios';

// ═══════════════════════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

interface Agent {
  id: string;
  name: string;
  type: 'cortex' | 'external' | 'supervisor' | 'router';
  model: string;
  workflow: string;
  status: 'active' | 'pending_approval' | 'disabled' | 'revoked';
  is_approved: boolean;
  tools: string[];
  last_run: string;
  endpoint?: string;
  risk_level?: string;
}

interface AuditLog {
  log_id: string;
  action_type: string;
  entity_type: string;
  entity_id?: string;
  entity_name: string;
  actor?: string;
  actor_role?: string;
  user_id?: string;
  created_at: string;
  status?: string;
  details?: Record<string, unknown> | string;
}

interface CortexModel {
  id: string;
  name: string;
  provider: string;
  category: 'general' | 'code' | 'embedding' | 'vision';
  contextWindow: number;
  costTier: 'low' | 'medium' | 'high' | 'premium';
  isNew?: boolean;
}

interface MCPServer {
  id: string;
  name: string;
  url: string;
  status: 'active' | 'inactive' | 'error';
  tools: string[];
  enabled: boolean;
}

interface ExternalEndpoint {
  id: string;
  name: string;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  authType: 'none' | 'api_key' | 'oauth' | 'bearer';
  enabled: boolean;
  rateLimit: number;
}

interface AdminDashboardProps {
  onClose: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS - Latest Cortex Models (Jan 2026)
// ═══════════════════════════════════════════════════════════════════════════════

const CORTEX_MODELS: CortexModel[] = [
  // Premium Tier - Latest flagship models
  { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic (via Cortex)', category: 'general', contextWindow: 200000, costTier: 'premium', isNew: true },
  { id: 'llama3.3-70b', name: 'Llama 3.3 70B', provider: 'Meta (via Cortex)', category: 'general', contextWindow: 128000, costTier: 'premium', isNew: true },
  { id: 'mistral-large-2', name: 'Mistral Large 2 (24.11)', provider: 'Mistral (via Cortex)', category: 'general', contextWindow: 128000, costTier: 'premium' },
  
  // High Tier - Production models  
  { id: 'llama3.1-405b', name: 'Llama 3.1 405B', provider: 'Meta (via Cortex)', category: 'general', contextWindow: 128000, costTier: 'high' },
  { id: 'llama3.1-70b', name: 'Llama 3.1 70B', provider: 'Meta (via Cortex)', category: 'general', contextWindow: 128000, costTier: 'high' },
  { id: 'mixtral-8x7b', name: 'Mixtral 8x7B', provider: 'Mistral (via Cortex)', category: 'general', contextWindow: 32000, costTier: 'high' },
  { id: 'reka-core', name: 'Reka Core', provider: 'Reka (via Cortex)', category: 'general', contextWindow: 128000, costTier: 'high' },
  
  // Medium Tier - Balanced models
  { id: 'llama3.1-8b', name: 'Llama 3.1 8B', provider: 'Meta (via Cortex)', category: 'general', contextWindow: 128000, costTier: 'medium' },
  { id: 'mistral-7b', name: 'Mistral 7B', provider: 'Mistral (via Cortex)', category: 'general', contextWindow: 32000, costTier: 'medium' },
  { id: 'gemma2-9b', name: 'Gemma 2 9B', provider: 'Google (via Cortex)', category: 'general', contextWindow: 8192, costTier: 'medium' },
  { id: 'reka-flash', name: 'Reka Flash', provider: 'Reka (via Cortex)', category: 'general', contextWindow: 128000, costTier: 'medium' },
  
  // Low Tier - Cost optimized
  { id: 'snowflake-arctic', name: 'Snowflake Arctic', provider: 'Snowflake', category: 'general', contextWindow: 4096, costTier: 'low' },
  { id: 'gemma-7b', name: 'Gemma 7B', provider: 'Google (via Cortex)', category: 'general', contextWindow: 8192, costTier: 'low' },
  
  // Specialized
  { id: 'jamba-1.5-large', name: 'Jamba 1.5 Large', provider: 'AI21 (via Cortex)', category: 'general', contextWindow: 256000, costTier: 'high', isNew: true },
  { id: 'jamba-1.5-mini', name: 'Jamba 1.5 Mini', provider: 'AI21 (via Cortex)', category: 'general', contextWindow: 256000, costTier: 'medium', isNew: true },
];

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function AdminDashboard({ onClose }: AdminDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'agents' | 'audit' | 'settings'>('overview');
  const [settingsSection, setSettingsSection] = useState<'security' | 'governance' | 'models' | 'integrations'>('security');
  
  // Data states
  const [agents, setAgents] = useState<Agent[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [overview, setOverview] = useState({
    workflows: { total: 0, active: 0 },
    agents: { total: 0, cortex: 0, external: 0, pending_approval: 0 },
    tools: { total: 0, approved: 0 },
    executions: { today: 0, week: 0, success_rate: 0 },
    cortex_usage: { complete_calls: 0, analyst_calls: 0, search_calls: 0 },
  });

  // Settings states - all editable
  const [securitySettings, setSecuritySettings] = useState({
    agent_approval_required: true,
    cortex_agents_auto_approved: true,
    external_agents_allowed: true,
    require_mfa_for_approval: false,
    session_timeout_minutes: 60,
    max_concurrent_sessions: 5,
    ip_allowlist_enabled: false,
    ip_allowlist: [] as string[],
  });

  const [governanceSettings, setGovernanceSettings] = useState({
    audit_retention_days: 365,
    require_workflow_approval: false,
    max_agents_per_workflow: 10,
    enforce_data_classification: true,
    pii_detection_enabled: true,
    auto_tag_sensitive_data: true,
    execution_logging_level: 'detailed' as 'minimal' | 'standard' | 'detailed',
  });

  const [modelSettings, setModelSettings] = useState({
    default_model: 'mistral-large-2',
    max_tokens_per_request: 4096,
    max_context_tokens: 32000,
    rate_limits: { requests_per_minute: 60, tokens_per_minute: 100000 },
    allowed_models: ['mistral-large-2', 'llama3.1-70b', 'llama3.1-8b', 'snowflake-arctic'] as string[],
    cost_budget_daily: 100,
    cost_alert_threshold: 80,
  });

  const [integrationSettings, setIntegrationSettings] = useState({
    mcp_enabled: true,
    mcp_servers: [
      { id: 'mcp-1', name: 'Snowflake MCP', url: 'localhost:3000', status: 'active', tools: ['query', 'schema'], enabled: true },
    ] as MCPServer[],
    external_endpoints: [
      { id: 'ep-1', name: 'OpenAI API', url: 'https://api.openai.com/v1', method: 'POST', authType: 'bearer', enabled: false, rateLimit: 60 },
    ] as ExternalEndpoint[],
    router_config: {
      enabled: true,
      strategy: 'cost_optimized' as 'performance' | 'cost_optimized' | 'balanced',
      fallback_model: 'llama3.1-8b',
      retry_attempts: 3,
    },
    supervisor_config: {
      enabled: true,
      max_delegation_depth: 3,
      require_approval_for_external: true,
      auto_terminate_on_error: true,
    },
  });

  const [savingSettings, setSavingSettings] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Fetch data only once on mount - fast load
  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    const startTime = Date.now();
    
    try {
      // Parallel fetch all data - but don't wait for slow endpoints
      const [overviewRes, agentsRes, logsRes, settingsRes] = await Promise.allSettled([
        axios.get('http://localhost:8000/control-tower/overview', { timeout: 3000 }),
        axios.get('http://localhost:8000/control-tower/agents', { timeout: 3000 }),
        axios.get('http://localhost:8000/audit/logs?limit=50', { timeout: 3000 }),
        axios.get('http://localhost:8000/control-tower/settings', { timeout: 2000 }),
      ]);

      if (overviewRes.status === 'fulfilled') setOverview(overviewRes.value.data);
      if (agentsRes.status === 'fulfilled') setAgents(agentsRes.value.data.agents || []);
      if (logsRes.status === 'fulfilled') {
        const logs = logsRes.value.data.logs;
        setAuditLogs(Array.isArray(logs) ? logs : []);
      }
      if (settingsRes.status === 'fulfilled') {
        const s = settingsRes.value.data;
        // Merge received settings with defaults
        if (s.agent_approval_required !== undefined) {
          setSecuritySettings(prev => ({ ...prev, ...s }));
        }
        if (s.default_model) {
          setModelSettings(prev => ({ ...prev, default_model: s.default_model }));
        }
      }
      
      console.log(`Control Tower loaded in ${Date.now() - startTime}ms`);
    } catch (err) {
      console.error('Failed to fetch control tower data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════════
  // AGENT ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════════

  const approveAgent = async (agentId: string) => {
    try {
      await axios.post(`http://localhost:8000/control-tower/agents/${agentId}/approve?approved_by=Admin`);
      const res = await axios.get('http://localhost:8000/control-tower/agents');
      setAgents(res.data.agents || []);
      const overviewRes = await axios.get('http://localhost:8000/control-tower/overview');
      setOverview(overviewRes.data);
    } catch (err) {
      console.error('Failed to approve agent:', err);
    }
  };

  const revokeAgent = async (agentId: string) => {
    try {
      await axios.post(`http://localhost:8000/control-tower/agents/${agentId}/revoke?revoked_by=Admin`);
      const res = await axios.get('http://localhost:8000/control-tower/agents');
      setAgents(res.data.agents || []);
    } catch (err) {
      console.error('Failed to revoke agent:', err);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════════
  // SETTINGS ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════════

  const saveAllSettings = async () => {
    setSavingSettings(true);
    setSaveSuccess(false);
    try {
      const allSettings = {
        security: securitySettings,
        governance: governanceSettings,
        models: modelSettings,
        integrations: integrationSettings,
        // Flatten key settings for backend compatibility
        agent_approval_required: securitySettings.agent_approval_required,
        cortex_agents_auto_approved: securitySettings.cortex_agents_auto_approved,
        external_agents_allowed: securitySettings.external_agents_allowed,
        default_model: modelSettings.default_model,
        max_tokens_per_request: modelSettings.max_tokens_per_request,
        rate_limits: modelSettings.rate_limits,
        audit_retention_days: governanceSettings.audit_retention_days,
        allowed_models: modelSettings.allowed_models,
        mcp_enabled: integrationSettings.mcp_enabled,
        router_enabled: integrationSettings.router_config.enabled,
        supervisor_enabled: integrationSettings.supervisor_config.enabled,
      };
      
      await axios.post('http://localhost:8000/control-tower/settings', allSettings);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setSavingSettings(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════════
  // HELPER COMPONENTS
  // ═══════════════════════════════════════════════════════════════════════════════

  const StatCard = ({ icon: Icon, label, value, color, subtext, onClick }: { 
    icon: typeof BarChart3; label: string; value: number | string; color: string; subtext?: string; onClick?: () => void 
  }) => (
    <div 
      onClick={onClick}
      style={{
      background: 'rgb(var(--surface))',
      border: '1px solid rgb(var(--border))',
      borderRadius: 12,
        padding: 16,
      display: 'flex',
        alignItems: 'center',
        gap: 12,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s',
      }}
    >
      <div style={{
        width: 40,
        height: 40,
        borderRadius: 10,
        background: `${color}15`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Icon size={20} color={color} />
      </div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'rgb(var(--fg))' }}>{value}</div>
        <div style={{ fontSize: 11, color: 'rgb(var(--muted))' }}>{label}</div>
        {subtext && <div style={{ fontSize: 10, color: 'rgb(var(--muted))' }}>{subtext}</div>}
          </div>
      </div>
  );

  const Toggle = ({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
      {label && <span style={{ fontSize: 13, color: 'rgb(var(--fg-muted))' }}>{label}</span>}
      <div 
        onClick={() => onChange(!checked)}
        style={{
          width: 44,
          height: 24,
          background: checked ? '#10B981' : 'rgb(var(--border-strong))',
          borderRadius: 12,
          position: 'relative',
          transition: 'background 0.2s',
          cursor: 'pointer',
        }}
      >
        <div style={{
          width: 20,
          height: 20,
          background: 'rgb(var(--surface))',
          borderRadius: '50%',
          position: 'absolute',
          top: 2,
          left: checked ? 22 : 2,
          transition: 'left 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }} />
    </div>
    </label>
  );

  const SettingRow = ({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) => (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center',
      padding: '12px 0',
      borderBottom: '1px solid rgb(var(--border))',
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'rgb(var(--fg))' }}>{label}</div>
        {description && <div style={{ fontSize: 11, color: 'rgb(var(--muted))', marginTop: 2 }}>{description}</div>}
      </div>
      <div style={{ marginLeft: 16 }}>
        {children}
      </div>
    </div>
  );

  const SectionCard = ({ title, icon: Icon, iconColor, children, collapsible = false }: { 
    title: string; icon: typeof Shield; iconColor: string; children: React.ReactNode; collapsible?: boolean 
  }) => {
    const [collapsed, setCollapsed] = useState(false);
    return (
      <div style={{ background: 'rgb(var(--surface))', border: '1px solid rgb(var(--border))', borderRadius: 12, marginBottom: 16, overflow: 'hidden' }}>
        <div 
          onClick={() => collapsible && setCollapsed(!collapsed)}
          style={{ 
            padding: '14px 20px', 
            borderBottom: collapsed ? 'none' : '1px solid rgb(var(--border))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: collapsible ? 'pointer' : 'default',
            background: 'rgb(var(--surface-2))',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Icon size={18} color={iconColor} />
            <span style={{ fontWeight: 600, fontSize: 14, color: 'rgb(var(--fg))' }}>{title}</span>
          </div>
          {collapsible && (collapsed ? <ChevronDown size={18} color="rgb(var(--muted))" /> : <ChevronUp size={18} color="rgb(var(--muted))" />)}
        </div>
        {!collapsed && <div style={{ padding: '8px 20px 16px' }}>{children}</div>}
      </div>
    );
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'workflow_run': return <Play size={12} color="#10B981" />;
      case 'workflow_complete': return <CheckCircle size={12} color="#10B981" />;
      case 'agent_execution': return <Brain size={12} color="#8B5CF6" />;
      case 'agent_registered': return <Brain size={12} color="#3B82F6" />;
      case 'agent_approved': return <CheckCircle size={12} color="#10B981" />;
      case 'agent_revoked': return <AlertTriangle size={12} color="#EF4444" />;
      case 'settings_updated': return <Settings size={12} color="#F59E0B" />;
      default: return <Clock size={12} color="#6B7280" />;
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════════
  // TAB CONTENT - OVERVIEW
  // ═══════════════════════════════════════════════════════════════════════════════

  const renderOverview = () => (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        <StatCard icon={FileText} label="Workflows" value={overview.workflows.total} color="#3B82F6" />
        <StatCard 
          icon={Brain} 
          label="Agents" 
          value={overview.agents.total} 
          color="#8B5CF6" 
          subtext={overview.agents.pending_approval > 0 ? `${overview.agents.pending_approval} pending` : undefined}
          onClick={() => setActiveTab('agents')}
        />
        <StatCard icon={Settings} label="Custom Tools" value={overview.tools.total} color="#10B981" />
        <StatCard icon={Activity} label="Executions (7d)" value={overview.executions.week} color="#F59E0B" subtext={`${overview.executions.success_rate}% success`} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
        <StatCard icon={Zap} label="Cortex Complete" value={overview.cortex_usage.complete_calls} color="#29B5E8" />
        <StatCard icon={Database} label="Cortex Analyst" value={overview.cortex_usage.analyst_calls} color="#8B5CF6" />
        <StatCard icon={Globe} label="Cortex Search" value={overview.cortex_usage.search_calls} color="#10B981" />
      </div>

      {/* Quick Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <button type="button" onClick={() => setActiveTab('agents')} style={{
          background: overview.agents.pending_approval > 0 ? '#FEF3C7' : 'white',
          border: '1px solid #E5E9F0',
          borderRadius: 12,
          padding: 16,
          cursor: 'pointer',
          textAlign: 'left',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Shield size={16} color="#F59E0B" />
            <span style={{ fontWeight: 600, fontSize: 13 }}>Approve Agents</span>
            {overview.agents.pending_approval > 0 && (
              <span style={{ background: '#EF4444', color: 'white', padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600 }}>
                {overview.agents.pending_approval}
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: '#6B7280' }}>Review pending agent registrations</div>
        </button>
        
        <button type="button" onClick={() => setActiveTab('audit')} style={{
          background: 'rgb(var(--surface))',
          border: '1px solid rgb(var(--border))',
          borderRadius: 12,
          padding: 16,
          cursor: 'pointer',
          textAlign: 'left',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Eye size={16} color="#3B82F6" />
            <span style={{ fontWeight: 600, fontSize: 13 }}>Audit Trail</span>
          </div>
          <div style={{ fontSize: 11, color: '#6B7280' }}>View all activity and compliance logs</div>
        </button>
        
        <button type="button" onClick={() => setActiveTab('settings')} style={{
          background: 'rgb(var(--surface))',
          border: '1px solid rgb(var(--border))',
          borderRadius: 12,
          padding: 16,
          cursor: 'pointer',
          textAlign: 'left',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Settings size={16} color="#6B7280" />
            <span style={{ fontWeight: 600, fontSize: 13 }}>Configure Governance</span>
          </div>
          <div style={{ fontSize: 11, color: '#6B7280' }}>Security, models, and integrations</div>
        </button>
      </div>
    </>
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // TAB CONTENT - AGENTS
  // ═══════════════════════════════════════════════════════════════════════════════

  const renderAgents = () => (
    <div style={{ background: 'rgb(var(--surface))', border: '1px solid rgb(var(--border))', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid rgb(var(--border))', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 600, color: '#1F2937' }}>Agent Registry</div>
          <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
            All registered agents across workflows
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={{ background: '#DBEAFE', color: '#1E40AF', padding: '4px 8px', borderRadius: 4, fontSize: 10 }}>
            {agents.filter(a => a.type === 'cortex').length} Cortex
          </span>
          <span style={{ background: '#E0E7FF', color: '#4338CA', padding: '4px 8px', borderRadius: 4, fontSize: 10 }}>
            {agents.filter(a => a.type === 'supervisor').length} Supervisor
          </span>
          <span style={{ background: '#FEE2E2', color: '#991B1B', padding: '4px 8px', borderRadius: 4, fontSize: 10 }}>
            {agents.filter(a => a.type === 'external').length} External
          </span>
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: 'rgb(var(--surface-2))' }}>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6B7280' }}>Agent</th>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6B7280' }}>Type</th>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6B7280' }}>Workflow</th>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6B7280' }}>Status</th>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6B7280' }}>Risk</th>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6B7280' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {agents.length === 0 ? (
            <tr>
              <td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>
                No agents registered. Create a workflow to register agents.
              </td>
            </tr>
          ) : (
            agents.map((agent) => (
              <tr key={agent.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {agent.type === 'supervisor' ? <GitBranch size={16} color="#6366F1" /> :
                     agent.type === 'router' ? <Network size={16} color="#8B5CF6" /> :
                     <Brain size={16} color={agent.type === 'cortex' ? '#29B5E8' : '#EF4444'} />}
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 12 }}>{agent.name}</div>
                      <div style={{ fontSize: 10, color: '#9CA3AF' }}>{agent.model || 'N/A'}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{
                    background: agent.type === 'cortex' ? '#DBEAFE' : 
                               agent.type === 'supervisor' ? '#E0E7FF' :
                               agent.type === 'router' ? '#EDE9FE' :
                               '#FEE2E2',
                    color: agent.type === 'cortex' ? '#1E40AF' : 
                           agent.type === 'supervisor' ? '#4338CA' :
                           agent.type === 'router' ? '#6D28D9' :
                           '#991B1B',
                    padding: '4px 8px',
                    borderRadius: 4,
                    fontSize: 10,
                    textTransform: 'uppercase',
                  }}>
                    {agent.type}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', fontSize: 12, color: '#6B7280' }}>
                  {agent.workflow || 'System'}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{
                    background: agent.status === 'active' ? '#D1FAE5' : agent.status === 'pending_approval' ? '#FEF3C7' : '#FEE2E2',
                    color: agent.status === 'active' ? '#065F46' : agent.status === 'pending_approval' ? '#92400E' : '#991B1B',
                    padding: '4px 8px',
                    borderRadius: 4,
                    fontSize: 10,
                  }}>
                    {agent.status?.replace(/_/g, ' ')}
                  </span>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{
                    background: agent.risk_level === 'low' ? '#D1FAE5' : agent.risk_level === 'high' ? '#FEE2E2' : '#FEF3C7',
                    color: agent.risk_level === 'low' ? '#065F46' : agent.risk_level === 'high' ? '#991B1B' : '#92400E',
                    padding: '4px 8px',
                    borderRadius: 4,
                    fontSize: 10,
                  }}>
                    {agent.risk_level || 'medium'}
                  </span>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  {agent.status === 'pending_approval' && (
                    <button
                      type="button"
                      onClick={() => approveAgent(agent.id)}
                      style={{
                        background: '#10B981',
                        color: 'white',
                        border: 'none',
                        borderRadius: 4,
                        padding: '4px 12px',
                        fontSize: 10,
                        cursor: 'pointer',
                        marginRight: 8,
                      }}
                    >
                      Approve
                    </button>
                  )}
                  {agent.status === 'active' && agent.type === 'external' && (
                    <button
                      type="button"
                      onClick={() => revokeAgent(agent.id)}
                      style={{
                        background: '#EF4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: 4,
                        padding: '4px 12px',
                        fontSize: 10,
                        cursor: 'pointer',
                      }}
                    >
                      Revoke
                    </button>
                  )}
                  {agent.type === 'cortex' && agent.status === 'active' && (
                    <span style={{ fontSize: 10, color: '#10B981' }}>✓ Auto-approved</span>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // TAB CONTENT - AUDIT
  // ═══════════════════════════════════════════════════════════════════════════════

  const renderAudit = () => (
    <div style={{ background: 'white', border: '1px solid #E5E9F0', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E9F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 600, color: '#1F2937' }}>Audit Trail</div>
          <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
            Immutable record of all governance events
          </div>
        </div>
        <div style={{ fontSize: 11, color: '#6B7280' }}>
          {auditLogs.length} records | Retention: {governanceSettings.audit_retention_days} days
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#F9FAFB' }}>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6B7280' }}>Action</th>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6B7280' }}>Entity</th>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6B7280' }}>User</th>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6B7280' }}>Details</th>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6B7280' }}>Timestamp</th>
          </tr>
        </thead>
        <tbody>
          {auditLogs.length === 0 ? (
            <tr>
              <td colSpan={5} style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>
                No audit logs available. Run a workflow to generate logs.
              </td>
            </tr>
          ) : (
            auditLogs.slice(0, 50).map((log, idx) => (
              <tr key={log.log_id || idx} style={{ borderBottom: '1px solid #F3F4F6' }}>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {getActionIcon(log.action_type)}
                    <span style={{ fontSize: 12 }}>{log.action_type?.replace(/_/g, ' ') || '—'}</span>
                  </div>
                </td>
                <td style={{ padding: '12px 16px', fontSize: 12, color: '#6B7280' }}>
                  {log.entity_name || log.entity_type || '—'}
                </td>
                <td style={{ padding: '12px 16px', fontSize: 12, color: '#6B7280' }}>
                  {log.actor || log.user_id || 'system'}
                </td>
                <td style={{ padding: '12px 16px', fontSize: 11, color: '#9CA3AF', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {typeof log.details === 'object' ? JSON.stringify(log.details) : (log.details || '—')}
                </td>
                <td style={{ padding: '12px 16px', fontSize: 11, color: '#9CA3AF' }}>
                  {log.created_at ? new Date(log.created_at).toLocaleString() : '—'}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // TAB CONTENT - SETTINGS (Full Admin Panel)
  // ═══════════════════════════════════════════════════════════════════════════════

  const renderSettings = () => (
    <div style={{ display: 'flex', gap: 20 }}>
      {/* Settings Navigation Sidebar */}
      <div style={{ width: 200, flexShrink: 0 }}>
        <div style={{ background: 'white', border: '1px solid #E5E9F0', borderRadius: 12, overflow: 'hidden' }}>
          {[
            { id: 'security', label: 'Security', icon: Shield, color: '#EF4444' },
            { id: 'governance', label: 'Governance', icon: FileText, color: '#3B82F6' },
            { id: 'models', label: 'AI Models', icon: Brain, color: '#8B5CF6' },
            { id: 'integrations', label: 'Integrations', icon: Network, color: '#10B981' },
          ].map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSettingsSection(item.id as typeof settingsSection)}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: 'none',
                background: settingsSection === item.id ? '#F3F4F6' : 'transparent',
                borderLeft: settingsSection === item.id ? `3px solid ${item.color}` : '3px solid transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                textAlign: 'left',
              }}
            >
              <item.icon size={16} color={settingsSection === item.id ? item.color : '#6B7280'} />
              <span style={{ fontSize: 13, fontWeight: settingsSection === item.id ? 600 : 400, color: settingsSection === item.id ? '#1F2937' : '#6B7280' }}>
                {item.label}
              </span>
            </button>
          ))}
        </div>
        
        {/* Save Button */}
        <button
          type="button"
          onClick={saveAllSettings}
          disabled={savingSettings}
          style={{
            width: '100%',
            marginTop: 16,
            padding: '12px 16px',
            background: saveSuccess ? '#10B981' : '#29B5E8',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            cursor: savingSettings ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            opacity: savingSettings ? 0.7 : 1,
          }}
        >
          {savingSettings ? <Loader2 size={16} className="animate-spin" /> : saveSuccess ? <Check size={16} /> : <Save size={16} />}
          {savingSettings ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save All Settings'}
        </button>
      </div>

      {/* Settings Content */}
      <div style={{ flex: 1 }}>
        {settingsSection === 'security' && (
          <>
            <SectionCard title="Agent Approval Policy" icon={Shield} iconColor="#EF4444">
              <SettingRow label="Require approval for new agents" description="External agents must be approved before execution">
                <Toggle checked={securitySettings.agent_approval_required} onChange={(v) => setSecuritySettings(s => ({ ...s, agent_approval_required: v }))} />
              </SettingRow>
              <SettingRow label="Auto-approve Cortex agents" description="Native Snowflake Cortex agents are trusted">
                <Toggle checked={securitySettings.cortex_agents_auto_approved} onChange={(v) => setSecuritySettings(s => ({ ...s, cortex_agents_auto_approved: v }))} />
              </SettingRow>
              <SettingRow label="Allow external agents" description="Enable agents connecting to external APIs">
                <Toggle checked={securitySettings.external_agents_allowed} onChange={(v) => setSecuritySettings(s => ({ ...s, external_agents_allowed: v }))} />
              </SettingRow>
              <SettingRow label="Require MFA for approvals" description="Multi-factor authentication for agent approval">
                <Toggle checked={securitySettings.require_mfa_for_approval} onChange={(v) => setSecuritySettings(s => ({ ...s, require_mfa_for_approval: v }))} />
              </SettingRow>
            </SectionCard>

            <SectionCard title="Session Security" icon={Lock} iconColor="#F59E0B">
              <SettingRow label="Session timeout (minutes)" description="Auto-logout after inactivity">
                <input
                  type="number"
                  value={securitySettings.session_timeout_minutes}
                  onChange={(e) => setSecuritySettings(s => ({ ...s, session_timeout_minutes: parseInt(e.target.value) || 60 }))}
                  style={{ width: 80, padding: '6px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 13, textAlign: 'right' }}
                />
              </SettingRow>
              <SettingRow label="Max concurrent sessions" description="Per user">
                <input
                  type="number"
                  value={securitySettings.max_concurrent_sessions}
                  onChange={(e) => setSecuritySettings(s => ({ ...s, max_concurrent_sessions: parseInt(e.target.value) || 5 }))}
                  style={{ width: 80, padding: '6px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 13, textAlign: 'right' }}
                />
              </SettingRow>
              <SettingRow label="IP allowlist" description="Restrict access to specific IPs">
                <Toggle checked={securitySettings.ip_allowlist_enabled} onChange={(v) => setSecuritySettings(s => ({ ...s, ip_allowlist_enabled: v }))} />
              </SettingRow>
            </SectionCard>
          </>
        )}

        {settingsSection === 'governance' && (
          <>
            <SectionCard title="Audit & Compliance" icon={Eye} iconColor="#3B82F6">
              <SettingRow label="Audit log retention (days)" description="How long to keep audit records">
                <input
                  type="number"
                  value={governanceSettings.audit_retention_days}
                  onChange={(e) => setGovernanceSettings(s => ({ ...s, audit_retention_days: parseInt(e.target.value) || 365 }))}
                  style={{ width: 80, padding: '6px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 13, textAlign: 'right' }}
                />
              </SettingRow>
              <SettingRow label="Logging detail level" description="Amount of detail in execution logs">
                <select
                  value={governanceSettings.execution_logging_level}
                  onChange={(e) => setGovernanceSettings(s => ({ ...s, execution_logging_level: e.target.value as 'minimal' | 'standard' | 'detailed' }))}
                  style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 13 }}
                >
                  <option value="minimal">Minimal</option>
                  <option value="standard">Standard</option>
                  <option value="detailed">Detailed</option>
                </select>
              </SettingRow>
            </SectionCard>

            <SectionCard title="Data Protection" icon={Database} iconColor="#10B981">
              <SettingRow label="Enforce data classification" description="Require classification tags on data sources">
                <Toggle checked={governanceSettings.enforce_data_classification} onChange={(v) => setGovernanceSettings(s => ({ ...s, enforce_data_classification: v }))} />
              </SettingRow>
              <SettingRow label="PII detection" description="Automatically detect personally identifiable information">
                <Toggle checked={governanceSettings.pii_detection_enabled} onChange={(v) => setGovernanceSettings(s => ({ ...s, pii_detection_enabled: v }))} />
              </SettingRow>
              <SettingRow label="Auto-tag sensitive data" description="Apply sensitivity tags automatically">
                <Toggle checked={governanceSettings.auto_tag_sensitive_data} onChange={(v) => setGovernanceSettings(s => ({ ...s, auto_tag_sensitive_data: v }))} />
              </SettingRow>
            </SectionCard>

            <SectionCard title="Workflow Controls" icon={Workflow} iconColor="#8B5CF6">
              <SettingRow label="Require workflow approval" description="Admin must approve new workflows">
                <Toggle checked={governanceSettings.require_workflow_approval} onChange={(v) => setGovernanceSettings(s => ({ ...s, require_workflow_approval: v }))} />
              </SettingRow>
              <SettingRow label="Max agents per workflow" description="Limit complexity">
                <input
                  type="number"
                  value={governanceSettings.max_agents_per_workflow}
                  onChange={(e) => setGovernanceSettings(s => ({ ...s, max_agents_per_workflow: parseInt(e.target.value) || 10 }))}
                  style={{ width: 80, padding: '6px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 13, textAlign: 'right' }}
                />
              </SettingRow>
            </SectionCard>
          </>
        )}

        {settingsSection === 'models' && (
          <>
            <SectionCard title="Default Model Configuration" icon={Brain} iconColor="#8B5CF6">
              <SettingRow label="Default model" description="Used when no model is specified">
                <select
                  value={modelSettings.default_model}
                  onChange={(e) => setModelSettings(s => ({ ...s, default_model: e.target.value }))}
                  style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 13, minWidth: 180 }}
                >
                  {CORTEX_MODELS.map(m => (
                    <option key={m.id} value={m.id}>{m.name} {m.isNew && '✨'}</option>
                  ))}
                </select>
              </SettingRow>
              <SettingRow label="Max tokens per request" description="Token limit for LLM calls">
                <input
                  type="number"
                  value={modelSettings.max_tokens_per_request}
                  onChange={(e) => setModelSettings(s => ({ ...s, max_tokens_per_request: parseInt(e.target.value) || 4096 }))}
                  style={{ width: 100, padding: '6px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 13, textAlign: 'right' }}
                />
              </SettingRow>
              <SettingRow label="Max context tokens" description="Maximum context window to use">
                <input
                  type="number"
                  value={modelSettings.max_context_tokens}
                  onChange={(e) => setModelSettings(s => ({ ...s, max_context_tokens: parseInt(e.target.value) || 32000 }))}
                  style={{ width: 100, padding: '6px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 13, textAlign: 'right' }}
                />
              </SettingRow>
            </SectionCard>

            <SectionCard title="Rate Limits" icon={Activity} iconColor="#F59E0B">
              <SettingRow label="Requests per minute" description="Global rate limit">
                <input
                  type="number"
                  value={modelSettings.rate_limits.requests_per_minute}
                  onChange={(e) => setModelSettings(s => ({ ...s, rate_limits: { ...s.rate_limits, requests_per_minute: parseInt(e.target.value) || 60 } }))}
                  style={{ width: 100, padding: '6px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 13, textAlign: 'right' }}
                />
              </SettingRow>
              <SettingRow label="Tokens per minute" description="Token throughput limit">
                <input
                  type="number"
                  value={modelSettings.rate_limits.tokens_per_minute}
                  onChange={(e) => setModelSettings(s => ({ ...s, rate_limits: { ...s.rate_limits, tokens_per_minute: parseInt(e.target.value) || 100000 } }))}
                  style={{ width: 100, padding: '6px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 13, textAlign: 'right' }}
                />
              </SettingRow>
            </SectionCard>

            <SectionCard title="Cost Management" icon={DollarSign} iconColor="#10B981">
              <SettingRow label="Daily budget (credits)" description="Spending limit per day">
                <input
                  type="number"
                  value={modelSettings.cost_budget_daily}
                  onChange={(e) => setModelSettings(s => ({ ...s, cost_budget_daily: parseInt(e.target.value) || 100 }))}
                  style={{ width: 100, padding: '6px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 13, textAlign: 'right' }}
                />
              </SettingRow>
              <SettingRow label="Alert threshold (%)" description="Alert when budget reaches this %">
                <input
                  type="number"
                  value={modelSettings.cost_alert_threshold}
                  onChange={(e) => setModelSettings(s => ({ ...s, cost_alert_threshold: parseInt(e.target.value) || 80 }))}
                  style={{ width: 80, padding: '6px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 13, textAlign: 'right' }}
                />
              </SettingRow>
            </SectionCard>

            <SectionCard title="Available Cortex Models" icon={Cpu} iconColor="#29B5E8" collapsible>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingTop: 8 }}>
                {CORTEX_MODELS.map(m => {
                  const isAllowed = modelSettings.allowed_models.includes(m.id);
  return (
                    <span
                      key={m.id}
                      onClick={() => {
                        if (isAllowed) {
                          setModelSettings(s => ({ ...s, allowed_models: s.allowed_models.filter(id => id !== m.id) }));
                        } else {
                          setModelSettings(s => ({ ...s, allowed_models: [...s.allowed_models, m.id] }));
                        }
                      }}
                      style={{
                        background: isAllowed ? '#29B5E8' : '#F3F4F6',
                        color: isAllowed ? 'white' : '#6B7280',
                        padding: '6px 12px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 500,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      {isAllowed && <Check size={12} />}
                      {m.name}
                      {m.isNew && <span style={{ background: '#FEF3C7', color: '#92400E', padding: '1px 4px', borderRadius: 3, fontSize: 9, marginLeft: 4 }}>NEW</span>}
                    </span>
                  );
                })}
              </div>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 12 }}>
                Click to enable/disable models. Enabled models can be used in workflows.
              </div>
            </SectionCard>
          </>
        )}

        {settingsSection === 'integrations' && (
          <>
            <SectionCard title="MCP Protocol" icon={Server} iconColor="#10B981">
              <SettingRow label="Enable MCP" description="Model Context Protocol for tool integration">
                <Toggle checked={integrationSettings.mcp_enabled} onChange={(v) => setIntegrationSettings(s => ({ ...s, mcp_enabled: v }))} />
              </SettingRow>
              <div style={{ marginTop: 12, padding: 12, background: '#F9FAFB', borderRadius: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#1F2937', marginBottom: 8 }}>MCP Servers</div>
                {integrationSettings.mcp_servers.map((server, idx) => (
                  <div key={server.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: idx < integrationSettings.mcp_servers.length - 1 ? '1px solid #E5E9F0' : 'none' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: server.status === 'active' ? '#10B981' : '#EF4444' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 500 }}>{server.name}</div>
                      <div style={{ fontSize: 10, color: '#6B7280' }}>{server.url}</div>
                    </div>
                    <Toggle 
                      checked={server.enabled} 
                      onChange={(v) => setIntegrationSettings(s => ({
                        ...s,
                        mcp_servers: s.mcp_servers.map(srv => srv.id === server.id ? { ...srv, enabled: v } : srv)
                      }))}
                    />
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="External API Endpoints" icon={Globe} iconColor="#3B82F6">
              <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 12 }}>
                Configure allowed external API endpoints for agents
              </div>
              {integrationSettings.external_endpoints.map((ep, idx) => (
                <div key={ep.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', borderBottom: idx < integrationSettings.external_endpoints.length - 1 ? '1px solid #E5E9F0' : 'none' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{ep.name}</div>
                    <div style={{ fontSize: 10, color: '#6B7280' }}>{ep.url}</div>
                  </div>
                  <span style={{ fontSize: 10, color: '#6B7280', background: '#F3F4F6', padding: '2px 6px', borderRadius: 4 }}>{ep.method}</span>
                  <span style={{ fontSize: 10, color: '#6B7280', background: '#F3F4F6', padding: '2px 6px', borderRadius: 4 }}>{ep.authType}</span>
                  <Toggle 
                    checked={ep.enabled} 
                    onChange={(v) => setIntegrationSettings(s => ({
                      ...s,
                      external_endpoints: s.external_endpoints.map(e => e.id === ep.id ? { ...e, enabled: v } : e)
                    }))}
                  />
                </div>
              ))}
            </SectionCard>

            <SectionCard title="Router Agent Configuration" icon={Network} iconColor="#8B5CF6">
              <SettingRow label="Enable Router agents" description="Allow routing between multiple agents">
                <Toggle checked={integrationSettings.router_config.enabled} onChange={(v) => setIntegrationSettings(s => ({ ...s, router_config: { ...s.router_config, enabled: v } }))} />
              </SettingRow>
              <SettingRow label="Routing strategy" description="How to select destination agent">
                <select
                  value={integrationSettings.router_config.strategy}
                  onChange={(e) => setIntegrationSettings(s => ({ ...s, router_config: { ...s.router_config, strategy: e.target.value as 'performance' | 'cost_optimized' | 'balanced' } }))}
                  style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 13 }}
                >
                  <option value="performance">Performance (fastest)</option>
                  <option value="cost_optimized">Cost Optimized (cheapest)</option>
                  <option value="balanced">Balanced</option>
                </select>
              </SettingRow>
              <SettingRow label="Fallback model" description="Used when routing fails">
                <select
                  value={integrationSettings.router_config.fallback_model}
                  onChange={(e) => setIntegrationSettings(s => ({ ...s, router_config: { ...s.router_config, fallback_model: e.target.value } }))}
                  style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 13 }}
                >
                  {CORTEX_MODELS.filter(m => modelSettings.allowed_models.includes(m.id)).map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </SettingRow>
              <SettingRow label="Retry attempts" description="Number of retries on failure">
                <input
                  type="number"
                  value={integrationSettings.router_config.retry_attempts}
                  onChange={(e) => setIntegrationSettings(s => ({ ...s, router_config: { ...s.router_config, retry_attempts: parseInt(e.target.value) || 3 } }))}
                  style={{ width: 80, padding: '6px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 13, textAlign: 'right' }}
                />
              </SettingRow>
            </SectionCard>

            <SectionCard title="Supervisor Agent Configuration" icon={GitBranch} iconColor="#6366F1">
              <SettingRow label="Enable Supervisor agents" description="Allow hierarchical agent orchestration">
                <Toggle checked={integrationSettings.supervisor_config.enabled} onChange={(v) => setIntegrationSettings(s => ({ ...s, supervisor_config: { ...s.supervisor_config, enabled: v } }))} />
              </SettingRow>
              <SettingRow label="Max delegation depth" description="How deep can supervisors delegate">
                <input
                  type="number"
                  value={integrationSettings.supervisor_config.max_delegation_depth}
                  onChange={(e) => setIntegrationSettings(s => ({ ...s, supervisor_config: { ...s.supervisor_config, max_delegation_depth: parseInt(e.target.value) || 3 } }))}
                  style={{ width: 80, padding: '6px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 13, textAlign: 'right' }}
                />
              </SettingRow>
              <SettingRow label="Require approval for external delegation" description="Admin must approve external agent calls">
                <Toggle checked={integrationSettings.supervisor_config.require_approval_for_external} onChange={(v) => setIntegrationSettings(s => ({ ...s, supervisor_config: { ...s.supervisor_config, require_approval_for_external: v } }))} />
              </SettingRow>
              <SettingRow label="Auto-terminate on error" description="Stop workflow on unrecoverable errors">
                <Toggle checked={integrationSettings.supervisor_config.auto_terminate_on_error} onChange={(v) => setIntegrationSettings(s => ({ ...s, supervisor_config: { ...s.supervisor_config, auto_terminate_on_error: v } }))} />
              </SettingRow>
            </SectionCard>
          </>
        )}
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // MAIN RENDER
  // ═══════════════════════════════════════════════════════════════════════════════

  return (
    <div
      style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
        background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: 'rgb(var(--surface-2))',
          borderRadius: 16,
        width: '90%',
        maxWidth: 1200,
          height: '90vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #0F2942 0%, #1E3A5F 100%)',
          padding: '20px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Shield size={24} color="#29B5E8" />
            <div>
              <div style={{ fontWeight: 700, fontSize: 18, color: 'white' }}>SnowFlow Control Tower</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>Governance, Security & Configuration</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={fetchAllData}
              style={{
                background: 'rgba(255,255,255,0.15)',
                border: 'none',
                borderRadius: 6,
                padding: '6px 14px',
                color: 'white',
                cursor: 'pointer',
                fontSize: 11,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <RefreshCw size={12} />
              Refresh
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.15)',
                border: 'none',
                borderRadius: 6,
                padding: '6px 14px',
                color: 'white',
                cursor: 'pointer',
                fontSize: 11,
              }}
            >
              Close
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid rgb(var(--border))',
          background: 'rgb(var(--surface))',
          padding: '0 24px',
        }}>
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'agents', label: 'Agents & Workflows', icon: Brain },
            { id: 'audit', label: 'Audit Log', icon: Eye },
            { id: 'settings', label: 'Settings', icon: Settings },
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setActiveTab(tab.id as typeof activeTab);
              }}
              style={{
                padding: '12px 18px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 500,
                color: activeTab === tab.id ? 'rgb(var(--ring))' : 'rgb(var(--muted))',
                borderBottom: activeTab === tab.id ? '2px solid rgb(var(--ring))' : '2px solid transparent',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginBottom: -1,
              }}
            >
              <tab.icon size={14} />
              {tab.label}
              {tab.id === 'agents' && overview.agents.pending_approval > 0 && (
                <span style={{ background: '#EF4444', color: 'white', padding: '1px 6px', borderRadius: 8, fontSize: 10, fontWeight: 600 }}>
                  {overview.agents.pending_approval}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <Loader2 size={32} className="animate-spin" color="#29B5E8" />
            </div>
          ) : (
            <>
              {activeTab === 'overview' && renderOverview()}
              {activeTab === 'agents' && renderAgents()}
              {activeTab === 'audit' && renderAudit()}
              {activeTab === 'settings' && renderSettings()}
                </>
              )}
        </div>
      </div>
    </div>
  );
}
