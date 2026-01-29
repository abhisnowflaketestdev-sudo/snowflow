import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Node, Edge } from 'reactflow';
import { useFlowStore } from '../store';
import { AlertTriangle, Brain, Database, Layers, Shield, Minus, Plus, RotateCcw, ChevronDown, Lock, CheckCircle2, Trash2, Play, Sparkles, Globe, RefreshCw } from 'lucide-react';
import { DataCatalog } from './DataCatalog';

type OrchestrationMode = 'single' | 'supervisor' | 'router' | 'external';
type ExperienceChannel = 'snowflake_intelligence' | 'api' | 'slack' | 'teams';

// Progress steps: 0=nothing, 1=data done, 2=semantic done, 3=orch done, 4=experience done
type ProgressStep = 0 | 1 | 2 | 3 | 4;

type GuidedStackConfig = {
  version: 1;
  useSemantic: boolean;
  orchestration: OrchestrationMode;
  channel: ExperienceChannel;
  progress: ProgressStep;
};

const DEFAULT_CONFIG: GuidedStackConfig = {
  version: 1,
  useSemantic: true,
  orchestration: 'single',
  channel: 'snowflake_intelligence',
  progress: 0,
};

const IDS = {
  data: 'gs-data',
  semantic: 'gs-semantic',
  agent: 'gs-agent',
  output: 'gs-output',
  supervisor: 'gs-supervisor',
  agentA: 'gs-agent-a',
  agentB: 'gs-agent-b',
  router: 'gs-router',
  routeA: 'gs-route-a',
  routeB: 'gs-route-b',
  external: 'gs-external',
} as const;

const ALL_GUIDED_NODE_IDS = new Set<string>(Object.values(IDS));

const GUIDED_EDGE_IDS = new Set<string>([
  'e-gs-data-sem',
  'e-gs-sem-agent',
  'e-gs-data-agent',
  'e-gs-agent-out',
  'e-gs-data-sup',
  'e-gs-sup-a',
  'e-gs-sup-b',
  'e-gs-a-out',
  'e-gs-b-out',
  'e-gs-sem-sup',
  'e-gs-data-router',
  'e-gs-router-a',
  'e-gs-router-b',
  'e-gs-ra-out',
  'e-gs-rb-out',
  'e-gs-sem-router',
  'e-gs-data-ext',
  'e-gs-ext-out',
  'e-gs-sem-ext',
]);

// Check if a "config holder" output node exists with guided config
function getGuidedConfigFromGraph(nodes: Node[]): GuidedStackConfig {
  // PRIORITY: Check output node first (has final config at progress 4)
  const outputNode = nodes.find((n) => n.id === IDS.output);
  const outputConfig = (outputNode?.data as any)?.guidedStackConfig;
  
  if (outputConfig && typeof outputConfig === 'object' && outputConfig.version === 1) {
    return {
      ...DEFAULT_CONFIG,
      ...outputConfig,
      useSemantic: Boolean(outputConfig.useSemantic ?? true),
      orchestration: (outputConfig.orchestration as OrchestrationMode) || 'single',
      channel: (outputConfig.channel as ExperienceChannel) || 'snowflake_intelligence',
      progress: (typeof outputConfig.progress === 'number' ? outputConfig.progress : 0) as ProgressStep,
    };
  }
  
  // Fallback: check any node with guidedStackConfig (data node for progress 1-3)
  const configHolder = nodes.find((n) => (n.data as any)?.guidedStackConfig);
  const raw = (configHolder?.data as any)?.guidedStackConfig;
  
  if (raw && typeof raw === 'object' && raw.version === 1) {
    return {
      ...DEFAULT_CONFIG,
      ...raw,
      useSemantic: Boolean(raw.useSemantic ?? true),
      orchestration: (raw.orchestration as OrchestrationMode) || 'single',
      channel: (raw.channel as ExperienceChannel) || 'snowflake_intelligence',
      progress: (typeof raw.progress === 'number' ? raw.progress : 0) as ProgressStep,
    };
  }
  return DEFAULT_CONFIG;
}

// Build graph progressively based on progress step
function buildProgressiveGraph(
  existingNodes: Node[],
  existingEdges: Edge[],
  config: GuidedStackConfig,
  nodeDataOverrides?: Record<string, Record<string, unknown>>
): { nodes: Node[]; edges: Edge[] } {
  const baseY = 180;
  const pos = {
    data: { x: 140, y: baseY },
    semantic: { x: 430, y: baseY },
    orchestration: { x: 720, y: baseY },
    output: { x: 1010, y: baseY },
  };

  const guidedNodes: Node[] = [];
  const guidedEdges: Edge[] = [];

  // Step 1+: Data node exists
  if (config.progress >= 1) {
    const existingData = existingNodes.find((n) => n.id === IDS.data);
    // Spread order: defaults -> existing -> overrides (most specific wins)
    guidedNodes.push({
      id: IDS.data,
      type: 'snowflakeSource',
      position: existingData?.position ?? pos.data,
      data: {
        label: 'Data Source',
        database: '',
        schema: '',
        objectType: 'table',
        columns: '',
        filter: '',
        orderBy: '',
        limit: 100,
        ...(existingData?.data as any || {}),
        ...(nodeDataOverrides?.[IDS.data] || {}),
      },
    });
  }

  // Step 2+: Semantic node exists (if enabled)
  if (config.progress >= 2 && config.useSemantic) {
    const existingSem = existingNodes.find((n) => n.id === IDS.semantic);
    guidedNodes.push({
      id: IDS.semantic,
      type: 'semanticModel',
      position: existingSem?.position ?? pos.semantic,
      data: {
        label: 'Semantic Model',
        database: '',
        schema: '',
        stage: '',
        yamlFile: '',
        semanticPath: '',
        ...(existingSem?.data as any || {}),
        ...(nodeDataOverrides?.[IDS.semantic] || {}),
      },
    });
    guidedEdges.push({ id: 'e-gs-data-sem', source: IDS.data, target: IDS.semantic, animated: true });
  }

  // Step 3+: Orchestration nodes exist
  if (config.progress >= 3) {
    const addSingleAgent = () => {
      const existing = existingNodes.find((n) => n.id === IDS.agent);
      guidedNodes.push({
        id: IDS.agent,
        type: 'agent',
        position: existing?.position ?? pos.orchestration,
        data: {
          label: 'Cortex Agent',
          model: 'mistral-large2',
          systemPrompt: 'You are a helpful data analyst.',
          instructions: 'You are a helpful data analyst.',
          temperature: 0.7,
          maxTokens: 4096,
          topP: 1,
          ...(existing?.data as any || {}),
          ...(nodeDataOverrides?.[IDS.agent] || {}),
        },
      });
      if (config.useSemantic && config.progress >= 2) {
        guidedEdges.push({ id: 'e-gs-sem-agent', source: IDS.semantic, target: IDS.agent, animated: true });
      } else {
        guidedEdges.push({ id: 'e-gs-data-agent', source: IDS.data, target: IDS.agent, animated: true });
      }
    };

    const addSupervisor = () => {
      const existingSup = existingNodes.find((n) => n.id === IDS.supervisor);
      const existingA = existingNodes.find((n) => n.id === IDS.agentA);
      const existingB = existingNodes.find((n) => n.id === IDS.agentB);
      
      guidedNodes.push({
        id: IDS.supervisor,
        type: 'supervisor',
        position: existingSup?.position ?? pos.orchestration,
        data: {
          label: 'Supervisor',
          model: 'mistral-large2',
          systemPrompt: 'You are a supervisor agent.',
          delegationStrategy: 'adaptive',
          aggregationMethod: 'merge',
          maxDelegations: 5,
          ...(existingSup?.data as any || {}),
        },
      });
      guidedNodes.push({
        id: IDS.agentA,
        type: 'agent',
        position: existingA?.position ?? { x: pos.orchestration.x + 40, y: pos.orchestration.y - 140 },
        data: { label: 'Specialist A', model: 'mistral-large2', ...(existingA?.data as any || {}) },
      });
      guidedNodes.push({
        id: IDS.agentB,
        type: 'agent',
        position: existingB?.position ?? { x: pos.orchestration.x + 40, y: pos.orchestration.y + 140 },
        data: { label: 'Specialist B', model: 'mistral-large2', ...(existingB?.data as any || {}) },
      });
      guidedEdges.push({ id: 'e-gs-sup-a', source: IDS.supervisor, target: IDS.agentA, animated: true });
      guidedEdges.push({ id: 'e-gs-sup-b', source: IDS.supervisor, target: IDS.agentB, animated: true });
      if (config.useSemantic && config.progress >= 2) {
        guidedEdges.push({ id: 'e-gs-sem-sup', source: IDS.semantic, target: IDS.supervisor, animated: true });
      } else {
        guidedEdges.push({ id: 'e-gs-data-sup', source: IDS.data, target: IDS.supervisor, animated: true });
      }
    };

    const addRouter = () => {
      const existingRouter = existingNodes.find((n) => n.id === IDS.router);
      const existingA = existingNodes.find((n) => n.id === IDS.routeA);
      const existingB = existingNodes.find((n) => n.id === IDS.routeB);
      
      guidedNodes.push({
        id: IDS.router,
        type: 'router',
        position: existingRouter?.position ?? pos.orchestration,
        data: {
          label: 'Router',
          routingStrategy: 'keyword',
          routes: [
            { name: 'Route 1', condition: 'sales,revenue' },
            { name: 'Route 2', condition: 'inventory,stock' },
          ],
          ...(existingRouter?.data as any || {}),
        },
      });
      guidedNodes.push({
        id: IDS.routeA,
        type: 'agent',
        position: existingA?.position ?? { x: pos.orchestration.x + 40, y: pos.orchestration.y - 140 },
        data: { label: 'Sales Agent', model: 'mistral-large2', ...(existingA?.data as any || {}) },
      });
      guidedNodes.push({
        id: IDS.routeB,
        type: 'agent',
        position: existingB?.position ?? { x: pos.orchestration.x + 40, y: pos.orchestration.y + 140 },
        data: { label: 'Ops Agent', model: 'mistral-large2', ...(existingB?.data as any || {}) },
      });
      guidedEdges.push({ id: 'e-gs-router-a', source: IDS.router, target: IDS.routeA, animated: true, sourceHandle: 'route-1' });
      guidedEdges.push({ id: 'e-gs-router-b', source: IDS.router, target: IDS.routeB, animated: true, sourceHandle: 'route-2' });
      if (config.useSemantic && config.progress >= 2) {
        guidedEdges.push({ id: 'e-gs-sem-router', source: IDS.semantic, target: IDS.router, animated: true });
      } else {
        guidedEdges.push({ id: 'e-gs-data-router', source: IDS.data, target: IDS.router, animated: true });
      }
    };

    const addExternal = () => {
      const existing = existingNodes.find((n) => n.id === IDS.external);
      guidedNodes.push({
        id: IDS.external,
        type: 'externalAgent',
        position: existing?.position ?? pos.orchestration,
        data: {
          label: 'External Agent',
          agentType: 'rest',
          endpoint: '',
          method: 'POST',
          authType: 'none',
          ...(existing?.data as any || {}),
          ...(nodeDataOverrides?.[IDS.external] || {}),
        },
      });
      if (config.useSemantic && config.progress >= 2) {
        guidedEdges.push({ id: 'e-gs-sem-ext', source: IDS.semantic, target: IDS.external, animated: true });
      } else {
        guidedEdges.push({ id: 'e-gs-data-ext', source: IDS.data, target: IDS.external, animated: true });
      }
    };

    if (config.orchestration === 'supervisor') addSupervisor();
    else if (config.orchestration === 'router') addRouter();
    else if (config.orchestration === 'external') addExternal();
    else addSingleAgent();
  }

  // Step 4: Output node exists
  if (config.progress >= 4) {
    const existingOut = existingNodes.find((n) => n.id === IDS.output);
    // IMPORTANT: Spread existing data FIRST, then override with new config
    // This ensures config changes (like channel) aren't overwritten by stale data
    guidedNodes.push({
      id: IDS.output,
      type: 'output',
      position: existingOut?.position ?? pos.output,
      data: {
        ...(existingOut?.data as any || {}),  // Existing data first
        label: 'Results',
        outputType: 'display',
        guidedStackConfig: config,  // New config LAST to override
      },
    });

    // Connect orchestration to output
    if (config.orchestration === 'single') {
      guidedEdges.push({ id: 'e-gs-agent-out', source: IDS.agent, target: IDS.output, animated: true });
    } else if (config.orchestration === 'supervisor') {
      guidedEdges.push({ id: 'e-gs-a-out', source: IDS.agentA, target: IDS.output, animated: true });
      guidedEdges.push({ id: 'e-gs-b-out', source: IDS.agentB, target: IDS.output, animated: true });
    } else if (config.orchestration === 'router') {
      guidedEdges.push({ id: 'e-gs-ra-out', source: IDS.routeA, target: IDS.output, animated: true });
      guidedEdges.push({ id: 'e-gs-rb-out', source: IDS.routeB, target: IDS.output, animated: true });
    } else if (config.orchestration === 'external') {
      guidedEdges.push({ id: 'e-gs-ext-out', source: IDS.external, target: IDS.output, animated: true });
    }
  }

  // Store config in a special holder node if no output yet (for persistence)
  if (config.progress < 4 && config.progress > 0) {
    // Store config in data node - config MUST be last to override any stale values
    const dataIdx = guidedNodes.findIndex((n) => n.id === IDS.data);
    if (dataIdx >= 0) {
      const existingData = guidedNodes[dataIdx].data as any;
      guidedNodes[dataIdx] = {
        ...guidedNodes[dataIdx],
        data: { 
          ...existingData,
          guidedStackConfig: config,  // New config LAST to ensure it's not overwritten
        },
      };
    }
  }

  // Merge with existing non-guided nodes
  const requiredGuidedIds = new Set(guidedNodes.map((n) => n.id));
  const preservedNonGuidedNodes = existingNodes.filter((n) => !ALL_GUIDED_NODE_IDS.has(n.id));
  const nextNodes = [...preservedNonGuidedNodes, ...guidedNodes];

  // Handle edges
  const desiredGuidedEdges: Edge[] = guidedEdges.map((e) => ({
    ...e,
    animated: true,
    style: { stroke: '#29B5E8', ...(e.style || {}) },
  }));

  const removedGuidedIds = new Set(
    existingNodes
      .filter((n) => ALL_GUIDED_NODE_IDS.has(n.id) && !requiredGuidedIds.has(n.id))
      .map((n) => n.id)
  );

  const nextEdgesBase = existingEdges.filter((e) => {
    const source = String((e as any).source ?? '');
    const target = String((e as any).target ?? '');
    if (removedGuidedIds.has(source) || removedGuidedIds.has(target)) return false;
    const id = String(e.id ?? '');
    const isGuidedById = id.startsWith('e-gs-') || GUIDED_EDGE_IDS.has(id);
    const connectsRequiredGuided = requiredGuidedIds.has(source) && requiredGuidedIds.has(target);
    if (isGuidedById || connectsRequiredGuided) return false;
    return true;
  });

  const existingEdgeIds = new Set(nextEdgesBase.map((e) => String(e.id)));
  const nextEdges = [
    ...nextEdgesBase,
    ...desiredGuidedEdges.filter((e) => !existingEdgeIds.has(String(e.id))),
  ];

  return { nodes: nextNodes, edges: nextEdges };
}

function summarizeData(node?: Node, progress?: number) {
  if (!node || progress === 0) return 'Click to select data source';
  const d: any = node.data || {};
  if (!d.database || !d.schema || !d.label) return 'Click to select data source';
  return `${d.database}.${d.schema}.${d.label}`;
}

function summarizeSemantic(node?: Node, progress?: number) {
  if (!node || (progress ?? 0) < 2) return 'Click to select semantic model';
  const d: any = node.data || {};
  return String(d.semanticPath || (d.stage && d.yamlFile ? `@${d.database}.${d.schema}.${d.stage}/${d.yamlFile}` : 'Click to select'));
}

function summarizeExperience(config: GuidedStackConfig) {
  if (config.channel === 'api') return 'API Endpoint';
  if (config.channel === 'slack') return 'Slack';
  if (config.channel === 'teams') return 'Microsoft Teams';
  return 'Snowflake Intelligence (ai.snowflake.com)';
}

// Snowflake brand colors
const SF_BLUE = '#29B5E8';
const SF_BLUE_DARK = '#0D74AF';
const SF_PURPLE = '#8B5CF6';
const SF_INDIGO = '#6366F1';
const LOCKED_GREY = '#CBD5E1';

// Check if there are existing nodes that look like a workflow (not from guided mode)
function hasExistingWorkflow(nodes: Node[]): boolean {
  // If there are any nodes (guided or not), there's an existing workflow
  return nodes.length > 0;
}

export function GuidedStackCanvas({
  onOpenNode,
  onOpenControlTower,
  onRunFlow,
  activeNodes,
  completedNodes,
  execStatus,
  isDarkMode = false,
  runningPrompt,
}: {
  onOpenNode: (nodeId: string, anchorEl?: HTMLElement | null) => void;
  onOpenControlTower: () => void;
  onRunFlow?: () => void;
  activeNodes?: Set<string>;
  completedNodes?: Set<string>;
  execStatus?: 'idle' | 'validating' | 'running' | 'success' | 'error';
  isDarkMode?: boolean;
  runningPrompt?: string;
}) {
  const { nodes, edges, setWorkflow, workflowName } = useFlowStore();
  const [zoom, setZoom] = useState(1);
  const [showGovernance, setShowGovernance] = useState(false);
  const [catalogMode, setCatalogMode] = useState<null | 'data' | 'semantic'>(null);
  const [showResetPrompt, setShowResetPrompt] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [copiedField, setCopiedField] = useState<null | 'url' | 'body'>(null);
  const [governanceReviewed, setGovernanceReviewed] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastTestedConfig, setLastTestedConfig] = useState<string | null>(null);
  const [changeToast, setChangeToast] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  
  // Show toast notification when changes are applied
  const showChangeToast = useCallback((message: string) => {
    setChangeToast(message);
    setTimeout(() => setChangeToast(null), 2500);
  }, []);

  const nodesById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const guidedConfig = useMemo(() => getGuidedConfigFromGraph(nodes), [nodes]);
  const progress = guidedConfig.progress;

  // On first mount, check if we need to show reset prompt
  useEffect(() => {
    if (!hasInitialized) {
      setHasInitialized(true);
      // If progress is 0 but there are existing nodes, show reset prompt
      if (progress === 0 && hasExistingWorkflow(nodes)) {
        setShowResetPrompt(true);
      }
    }
  }, [hasInitialized, progress, nodes]);

  // Reset the graph to start fresh
  const resetGraph = useCallback(() => {
    setWorkflow([], [], workflowName || 'Untitled Workflow');
    setShowResetPrompt(false);
  }, [setWorkflow, workflowName]);

  // Keep existing workflow and continue
  const keepExisting = useCallback(() => {
    setShowResetPrompt(false);
  }, []);

  // Update progress and rebuild graph
  const advanceProgress = useCallback(
    (newProgress: ProgressStep, configUpdates?: Partial<GuidedStackConfig>) => {
      console.log('[GUIDED] advanceProgress called:', { currentProgress: guidedConfig.progress, newProgress, configUpdates });
      const nextConfig: GuidedStackConfig = { ...guidedConfig, ...configUpdates, progress: newProgress };
      console.log('[GUIDED] Building graph with config:', nextConfig);
      const built = buildProgressiveGraph(nodes, edges, nextConfig);
      console.log('[GUIDED] Built graph:', { nodeCount: built.nodes.length, edgeCount: built.edges.length });
      setWorkflow(built.nodes, built.edges, workflowName);
    },
    [nodes, edges, guidedConfig, setWorkflow, workflowName]
  );

  const updateConfig = useCallback(
    (updates: Partial<GuidedStackConfig>, toastMessage?: string) => {
      console.log('[GUIDED] updateConfig called with:', updates);
      console.log('[GUIDED] Current config:', guidedConfig);
      const nextConfig: GuidedStackConfig = { ...guidedConfig, ...updates };
      console.log('[GUIDED] New config:', nextConfig);
      const built = buildProgressiveGraph(nodes, edges, nextConfig);
      console.log('[GUIDED] Graph rebuilt, setting workflow...');
      setWorkflow(built.nodes, built.edges, workflowName);
      
      // ALWAYS mark as having unsaved changes when config is modified
      // (except for initial setup steps)
      if (guidedConfig.progress >= 4 || lastTestedConfig !== null) {
        setHasUnsavedChanges(true);
      }
      
      // Show toast feedback if provided
      if (toastMessage) {
        showChangeToast(toastMessage);
      }
    },
    [nodes, edges, guidedConfig, setWorkflow, workflowName, lastTestedConfig, showChangeToast]
  );

  // Track when execution completes to mark config as "tested"
  // Use ref to track previous execStatus and only act on CHANGE to success
  const prevExecStatusRef = useRef(execStatus);
  useEffect(() => {
    const wasSuccess = prevExecStatusRef.current === 'success';
    const isNowSuccess = execStatus === 'success';
    prevExecStatusRef.current = execStatus;
    
    // Only reset when execStatus CHANGES to success (not on every guidedConfig change)
    if (isNowSuccess && !wasSuccess) {
      const configSnapshot = JSON.stringify({ 
        data: guidedConfig.dataSource, 
        semantic: guidedConfig.semanticPath, 
        orch: guidedConfig.orchestration,
        channel: guidedConfig.channel 
      });
      setLastTestedConfig(configSnapshot);
      setHasUnsavedChanges(false);
    }
  }, [execStatus, guidedConfig]);

  const openCatalog = useCallback(
    (mode: 'data' | 'semantic') => {
      setCatalogMode(mode);
    },
    []
  );

  const applyDataSelection = useCallback(
    (source: { name: string; database: string; schema: string; type: string }) => {
      const nextConfig: GuidedStackConfig = { ...guidedConfig, progress: Math.max(1, guidedConfig.progress) as ProgressStep };
      const built = buildProgressiveGraph(nodes, edges, nextConfig, {
        [IDS.data]: {
          label: source.name,
          database: source.database,
          schema: source.schema,
          objectType: source.type,
        },
      });
      setWorkflow(built.nodes, built.edges, workflowName);
      setCatalogMode(null);
      showChangeToast(`Data source set: ${source.database}.${source.schema}.${source.name}`);
      
      // Mark unsaved if already configured
      if (guidedConfig.progress >= 4 || lastTestedConfig !== null) {
        setHasUnsavedChanges(true);
      }
    },
    [nodes, edges, guidedConfig, setWorkflow, workflowName, showChangeToast, lastTestedConfig]
  );

  const applySemanticSelection = useCallback(
    (model: { name: string; database: string; schema: string; stage: string; path: string }) => {
      const nextConfig: GuidedStackConfig = { ...guidedConfig, useSemantic: true, progress: Math.max(2, guidedConfig.progress) as ProgressStep };
      const built = buildProgressiveGraph(nodes, edges, nextConfig, {
        [IDS.semantic]: {
          label: model.name,
          database: model.database,
          schema: model.schema,
          stage: model.stage,
          yamlFile: model.name,
          semanticPath: model.path,
        },
      });
      setWorkflow(built.nodes, built.edges, workflowName);
      setCatalogMode(null);
      showChangeToast(`Semantic model set: ${model.name}`);
      
      // Mark unsaved if already configured
      if (guidedConfig.progress >= 4 || lastTestedConfig !== null) {
        setHasUnsavedChanges(true);
      }
    },
    [nodes, edges, guidedConfig, setWorkflow, workflowName, showChangeToast, lastTestedConfig]
  );

  const skipSemantic = useCallback(() => {
    advanceProgress(Math.max(2, guidedConfig.progress) as ProgressStep, { useSemantic: false });
    showChangeToast('Semantic model skipped');
  }, [advanceProgress, guidedConfig.progress, showChangeToast]);

  const dataNode = nodesById.get(IDS.data);
  const semNode = nodesById.get(IDS.semantic);

  // Determine what's unlocked
  const isDataUnlocked = true; // Always unlocked
  const isDataConfigured = progress >= 1 && Boolean(dataNode?.data && (dataNode.data as any).database && (dataNode.data as any).label);
  const isSemanticUnlocked = isDataConfigured;
  const isSemanticConfigured = progress >= 2;
  const isOrchUnlocked = isSemanticConfigured;
  const isOrchConfigured = progress >= 3;
  const isExpUnlocked = isOrchConfigured;
  const isExpConfigured = progress >= 4;

  // Debug logging (minimal)

  // Execution state for each layer
  const isRunning = execStatus === 'running';
  const orchNodeIds = [IDS.agent, IDS.supervisor, IDS.router, IDS.external, IDS.agentA, IDS.agentB, IDS.routeA, IDS.routeB];
  
  const isDataExecuting = isRunning && activeNodes?.has(IDS.data);
  const isDataCompleted = completedNodes?.has(IDS.data);
  const isSemanticExecuting = isRunning && activeNodes?.has(IDS.semantic);
  const isSemanticCompleted = completedNodes?.has(IDS.semantic);
  const isOrchExecuting = isRunning && orchNodeIds.some(id => activeNodes?.has(id));
  const isOrchCompleted = orchNodeIds.some(id => completedNodes?.has(id));
  const isExpExecuting = isRunning && activeNodes?.has(IDS.output);
  const isExpCompleted = completedNodes?.has(IDS.output);

  // Determine layer execution status: 'idle' | 'waiting' | 'executing' | 'completed'
  type LayerExecStatus = 'idle' | 'waiting' | 'executing' | 'completed';
  const getLayerExecStatus = (isExecuting: boolean, isCompleted: boolean, layerIndex: number): LayerExecStatus => {
    if (!isRunning) return 'idle';
    if (isCompleted) return 'completed';
    if (isExecuting) return 'executing';
    // Check if we're waiting (a previous layer is executing)
    const executingLayers = [isDataExecuting, isSemanticExecuting, isOrchExecuting, isExpExecuting];
    const completedLayers = [isDataCompleted, isSemanticCompleted, isOrchCompleted, isExpCompleted];
    // If no layer before this one is completed yet and we're running, we're waiting
    for (let i = 0; i < layerIndex; i++) {
      if (executingLayers[i]) return 'waiting';
      if (!completedLayers[i]) return 'waiting';
    }
    return 'waiting';
  };

  const dataExecStatus = getLayerExecStatus(isDataExecuting, isDataCompleted ?? false, 0);
  const semanticExecStatus = getLayerExecStatus(isSemanticExecuting, isSemanticCompleted ?? false, 1);
  const orchExecStatus = getLayerExecStatus(isOrchExecuting, isOrchCompleted, 2);
  const expExecStatus = getLayerExecStatus(isExpExecuting, isExpCompleted ?? false, 3);

  // Governance status - requires explicit review to turn green
  type GovernanceStatus = 'grey' | 'red' | 'amber' | 'green';
  const governanceStatus: GovernanceStatus = useMemo(() => {
    if (progress === 0) return 'grey';
    
    // Check for critical issues first
    if (guidedConfig.orchestration === 'external') {
      const ext = nodesById.get(IDS.external);
      const d: any = ext?.data || {};
      if (!String(d.endpoint || '').trim()) return 'red';
    }
    
    // If complete but not reviewed, stay amber
    if (progress === 4) {
      if (!governanceReviewed) return 'amber'; // Needs review!
      if (!guidedConfig.useSemantic) return 'amber'; // Data quality concern
      return 'green';
    }
    
    return 'amber'; // In progress
  }, [progress, guidedConfig, nodesById, governanceReviewed]);

  const governanceColors: Record<GovernanceStatus, { bg: string; border: string; text: string; icon: string }> = {
    grey: { bg: '#F1F5F9', border: '#94A3B8', text: '#64748B', icon: '#94A3B8' },
    red: { bg: '#FEE2E2', border: '#EF4444', text: '#DC2626', icon: '#EF4444' },
    amber: { bg: '#FEF3C7', border: '#F59E0B', text: '#D97706', icon: '#F59E0B' },
    green: { bg: '#D1FAE5', border: '#10B981', text: '#059669', icon: '#10B981' },
  };
  const govColor = governanceColors[governanceStatus];

  const stackScale = Math.max(0.7, Math.min(1.25, zoom));

  // Connector arrow between layers
  const Connector = ({ locked }: { locked?: boolean }) => (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: 3, height: 24, background: locked ? LOCKED_GREY : `linear-gradient(180deg, ${SF_BLUE} 0%, ${SF_BLUE_DARK} 100%)`, borderRadius: 2 }} />
        <ChevronDown size={16} color={locked ? LOCKED_GREY : SF_BLUE_DARK} style={{ marginTop: -4 }} />
      </div>
    </div>
  );

  // Status badge for step progress
  const StepBadge = ({ step, current }: { step: number; current: number }) => {
    if (current >= step) {
      return (
        <span style={{ fontSize: 10, fontWeight: 700, padding: '6px 12px', borderRadius: 999, background: 'rgba(16,185,129,0.1)', color: '#059669', textTransform: 'uppercase', letterSpacing: 0.5, border: '1px solid rgba(16,185,129,0.2)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <CheckCircle2 size={12} /> Complete
        </span>
      );
    }
    if (current === step - 1) {
      return (
        <span style={{ fontSize: 10, fontWeight: 700, padding: '6px 12px', borderRadius: 999, background: 'rgba(41,181,232,0.1)', color: SF_BLUE_DARK, textTransform: 'uppercase', letterSpacing: 0.5, border: `1px solid rgba(41,181,232,0.3)`, animation: 'pulse 2s infinite' }}>
          Step {step} → Configure
        </span>
      );
    }
    return (
      <span style={{ fontSize: 10, fontWeight: 700, padding: '6px 12px', borderRadius: 999, background: '#F1F5F9', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5, border: '1px solid #E2E8F0', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <Lock size={10} /> Locked
      </span>
    );
  };

  // Layer card wrapper with locked state and execution visualization
  const LayerCard = ({
    accentColor,
    isTop,
    isBottom,
    locked,
    active,
    layerExecStatus,
    children,
    onClick,
    title,
  }: {
    accentColor: string;
    isTop?: boolean;
    isBottom?: boolean;
    locked?: boolean;
    active?: boolean;
    layerExecStatus?: LayerExecStatus;
    children: React.ReactNode;
    onClick?: () => void;
    title?: string;
  }) => {
    // Execution state colors
    const execColors = {
      idle: accentColor,
      waiting: '#94A3B8', // Grey - waiting
      executing: '#F59E0B', // Amber - currently running
      completed: '#10B981', // Green - done
    };
    
    const effectiveColor = locked ? LOCKED_GREY : (layerExecStatus && layerExecStatus !== 'idle' ? execColors[layerExecStatus] : accentColor);
    const isExecuting = layerExecStatus === 'executing';
    const isExecCompleted = layerExecStatus === 'completed';
    const isWaiting = layerExecStatus === 'waiting';
    
    // Dark mode card backgrounds
    const cardBgColor = isExecCompleted 
      ? (isDarkMode ? 'rgba(16,185,129,0.1)' : 'rgba(16,185,129,0.05)') 
      : isExecuting 
      ? (isDarkMode ? 'rgba(245,158,11,0.1)' : 'rgba(245,158,11,0.05)') 
      : isWaiting 
      ? (isDarkMode ? '#1E293B' : '#F8FAFC') 
      : locked 
      ? (isDarkMode ? '#1E293B' : '#F8FAFC') 
      : (isDarkMode ? '#1E293B' : 'white');
    
    const cardShadow = isExecuting 
      ? `0 0 0 4px rgba(245,158,11,0.3), 0 8px 24px rgba(245,158,11,0.2)` 
      : isExecCompleted 
      ? `0 0 0 3px rgba(16,185,129,0.2)` 
      : active 
      ? `0 0 0 3px ${accentColor}40` 
      : isDarkMode 
      ? '0 2px 12px rgba(0,0,0,0.3)' 
      : '0 2px 12px rgba(0,0,0,0.04)';
    
    return (
      <div
        onClick={locked ? undefined : onClick}
        title={locked ? 'Complete previous step first' : title}
        className={isExecuting ? 'layer-executing' : ''}
        style={{
          borderRadius: isTop ? '20px 20px 6px 6px' : isBottom ? '6px 6px 20px 20px' : 6,
          border: `3px solid ${effectiveColor}`,
          background: cardBgColor,
          padding: '20px 24px',
          cursor: locked ? 'not-allowed' : onClick ? 'pointer' : 'default',
          userSelect: 'none',
          transition: 'all 0.3s ease',
          boxShadow: cardShadow,
          opacity: isWaiting ? 0.5 : locked ? 0.6 : 1,
          position: 'relative',
        }}
        onMouseOver={(e) => { if (!locked && onClick && !isRunning) e.currentTarget.style.boxShadow = `0 8px 30px rgba(41,181,232,0.15)`; }}
        onMouseOut={(e) => { 
          if (isExecuting) e.currentTarget.style.boxShadow = `0 0 0 4px rgba(245,158,11,0.3), 0 8px 24px rgba(245,158,11,0.2)`;
          else if (isExecCompleted) e.currentTarget.style.boxShadow = `0 0 0 3px rgba(16,185,129,0.2)`;
          else e.currentTarget.style.boxShadow = active ? `0 0 0 3px ${accentColor}40` : (isDarkMode ? '0 2px 12px rgba(0,0,0,0.3)' : '0 2px 12px rgba(0,0,0,0.04)'); 
        }}
      >
        {locked && (
          <div style={{ position: 'absolute', top: 10, left: 10 }}>
            <Lock size={14} color={LOCKED_GREY} />
          </div>
        )}
        {/* Execution status indicator */}
        {layerExecStatus && layerExecStatus !== 'idle' && (
          <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            {isWaiting && <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#94A3B8' }} />}
            {isExecuting && <div className="exec-spinner" style={{ width: 16, height: 16, border: '2px solid #F59E0B', borderTopColor: 'transparent', borderRadius: '50%' }} />}
            {isExecCompleted && <CheckCircle2 size={18} color="#10B981" />}
          </div>
        )}
        {children}
      </div>
    );
  };

  // Orchestration mode pills
  const OrchestrationPills = ({ mode, disabled }: { mode: OrchestrationMode; disabled?: boolean }) => {
    const items: Array<{ id: OrchestrationMode; label: string; icon: string }> = [
      { id: 'single', label: 'Single Agent', icon: '🤖' },
      { id: 'supervisor', label: 'Supervisor', icon: '👔' },
      { id: 'router', label: 'Router', icon: '🔀' },
      { id: 'external', label: 'External', icon: '🌐' },
    ];

    return (
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
        {items.map((it) => {
          const active = mode === it.id;
          return (
            <button
              key={it.id}
              disabled={disabled}
              onClick={(e) => {
                e.stopPropagation();
                if (disabled) return;
                console.log('[GUIDED] Orchestration pill clicked:', it.id);
                updateConfig({ orchestration: it.id }, `Switched to ${it.label}`);
              }}
              style={{
                borderRadius: 8,
                border: `2px solid ${active ? SF_PURPLE : colors.inputBorder}`,
                background: active ? 'rgba(139,92,246,0.15)' : colors.cardBg,
                color: active ? SF_PURPLE : colors.textSecondary,
                padding: '10px 16px',
                fontSize: 13,
                fontWeight: 600,
                cursor: disabled ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                opacity: disabled ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
              onMouseOver={(e) => { if (!disabled && !active) e.currentTarget.style.borderColor = SF_PURPLE; e.currentTarget.style.background = 'rgba(139,92,246,0.08)'; }}
              onMouseOut={(e) => { if (!active) { e.currentTarget.style.borderColor = colors.inputBorder; e.currentTarget.style.background = colors.cardBg; } }}
            >
              <span>{it.icon}</span>
              {it.label}
              {active && <CheckCircle2 size={14} style={{ marginLeft: 4 }} />}
            </button>
          );
        })}
      </div>
    );
  };

  // Theme-aware colors
  const colors = useMemo(() => ({
    // Main backgrounds
    canvasBg: isDarkMode 
      ? 'linear-gradient(180deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)'
      : 'linear-gradient(180deg, #F0F9FF 0%, #E0F2FE 50%, #F0F9FF 100%)',
    cardBg: isDarkMode ? '#1E293B' : 'white',
    cardBorder: isDarkMode ? 'rgba(148, 163, 184, 0.2)' : 'rgba(0, 0, 0, 0.08)',
    // Text colors
    textPrimary: isDarkMode ? '#F1F5F9' : '#0F172A',
    textSecondary: isDarkMode ? '#94A3B8' : '#64748B',
    textMuted: isDarkMode ? '#64748B' : '#9CA3AF',
    // Interactive
    inputBg: isDarkMode ? '#0F172A' : '#F8FAFC',
    inputBorder: isDarkMode ? 'rgba(148, 163, 184, 0.3)' : '#E2E8F0',
    hoverBg: isDarkMode ? 'rgba(148, 163, 184, 0.1)' : 'rgba(0, 0, 0, 0.04)',
    // Modal
    modalBg: isDarkMode ? '#1E293B' : 'white',
    modalOverlay: isDarkMode ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.6)',
    // Info boxes
    infoBg: isDarkMode ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5',
    infoBorder: isDarkMode ? 'rgba(16, 185, 129, 0.3)' : '#A7F3D0',
    infoText: isDarkMode ? '#6EE7B7' : '#065F46',
    warningBg: isDarkMode ? 'rgba(251, 191, 36, 0.15)' : '#FEF3C7',
    warningBorder: isDarkMode ? 'rgba(251, 191, 36, 0.3)' : '#FCD34D',
    warningText: isDarkMode ? '#FCD34D' : '#92400E',
  }), [isDarkMode]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflowY: 'auto',
        overflowX: 'hidden',
        background: colors.canvasBg,
        transition: 'background 0.3s ease',
        pointerEvents: 'auto', // Ensure clicks are enabled
      }}
    >
      {/* Animations for step progress and execution */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes glow {
          0%, 100% { box-shadow: 0 0 0 4px rgba(245,158,11,0.3), 0 8px 24px rgba(245,158,11,0.2); }
          50% { box-shadow: 0 0 0 6px rgba(245,158,11,0.4), 0 12px 32px rgba(245,158,11,0.3); }
        }
        .layer-executing {
          animation: glow 1.5s ease-in-out infinite;
        }
        .exec-spinner {
          animation: spin 0.8s linear infinite;
        }
      `}</style>

      {/* Reset prompt modal - shown when switching to Guided with existing workflow */}
      {showResetPrompt && (
        <div style={{ position: 'absolute', inset: 0, background: colors.modalOverlay, zIndex: 100, display: 'grid', placeItems: 'center' }}>
          <div style={{ width: '90%', maxWidth: 480, background: colors.modalBg, borderRadius: 20, padding: 32, boxShadow: '0 25px 50px rgba(0,0,0,0.25)', textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: 16, background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)', display: 'grid', placeItems: 'center', margin: '0 auto 20px' }}>
              <AlertTriangle size={32} color="white" />
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: colors.textPrimary, marginBottom: 12 }}>Existing Workflow Detected</div>
            <div style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 1.6, marginBottom: 24 }}>
              You have an existing workflow on the canvas. Guided mode works best starting from scratch with a step-by-step wizard.
              <br /><br />
              <strong style={{ color: SF_BLUE }}>Start Fresh:</strong> Clear all nodes and begin the guided 4-step setup.
              <br />
              <strong style={{ color: '#475569' }}>Keep Existing:</strong> Stay in Guided view but use Graph view to edit your workflow.
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                onClick={resetGraph}
                style={{
                  padding: '14px 28px',
                  borderRadius: 12,
                  border: 'none',
                  background: `linear-gradient(135deg, ${SF_BLUE} 0%, ${SF_BLUE_DARK} 100%)`,
                  color: 'white',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  boxShadow: '0 4px 16px rgba(41,181,232,0.35)',
                }}
              >
                <Trash2 size={16} />
                Start Fresh
              </button>
              <button
                onClick={keepExisting}
                style={{
                  padding: '14px 28px',
                  borderRadius: 12,
                  border: '2px solid #E2E8F0',
                  background: 'white',
                  color: '#64748B',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Keep Existing
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ padding: '40px 24px', transform: `scale(${stackScale})`, transformOrigin: 'top center' }}>
        {/* Header */}
        <div style={{ maxWidth: 580, margin: '0 auto 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg, ${SF_BLUE} 0%, ${SF_BLUE_DARK} 100%)`, display: 'grid', placeItems: 'center' }}>
                <Database size={16} color="white" />
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: SF_BLUE, textTransform: 'uppercase', letterSpacing: 1.5 }}>
                Snowflake Intelligence
              </span>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: colors.textPrimary, letterSpacing: -0.5 }}>Build Your Agent</div>
            <div style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>
              {progress === 0 && 'Start by selecting a data source below'}
              {progress === 1 && 'Now configure your semantic model (or skip)'}
              {progress === 2 && 'Choose your orchestration pattern'}
              {progress === 3 && 'Finally, select your delivery channel'}
              {progress === 4 && 'Your agent is ready! Switch to Graph view for fine-tuning.'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {/* Reset button - only show if there's progress or nodes */}
            {(progress > 0 || nodes.length > 0) && (
              <button
                onClick={() => setShowResetPrompt(true)}
                style={{
                  borderRadius: 10,
                  border: `2px solid ${colors.inputBorder}`,
                  background: colors.cardBg,
                  color: colors.textSecondary,
                  padding: '10px 14px',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.15s ease',
                }}
                title="Clear canvas and start fresh"
              >
                <RotateCcw size={14} />
                Reset
              </button>
            )}
            <button
              onClick={() => setShowGovernance(true)}
              style={{
                borderRadius: 12,
                border: `2px solid ${govColor.border}`,
                background: govColor.bg,
                color: govColor.text,
                padding: '12px 18px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: `0 4px 12px ${govColor.border}25`,
                transition: 'all 0.2s ease',
              }}
              title={`Governance: ${governanceStatus === 'grey' ? 'Not started' : governanceStatus === 'green' ? 'All good' : governanceStatus === 'amber' ? 'In progress' : 'Issues'}`}
            >
              <Shield size={16} color={govColor.icon} />
              Governance
              {governanceStatus === 'green' && <span style={{ fontSize: 11 }}>✓</span>}
              {governanceStatus === 'amber' && <span style={{ fontSize: 11 }}>●</span>}
              {governanceStatus === 'red' && <span style={{ fontSize: 11 }}>⚠</span>}
            </button>
          </div>
        </div>

        {/* Unsaved changes banner - shows when config changed after setup complete */}
        {hasUnsavedChanges && progress >= 4 && (
          <div style={{ 
            maxWidth: 580, 
            margin: '0 auto 16px',
            padding: '12px 16px',
            background: 'linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(234,179,8,0.15) 100%)',
            borderRadius: 12,
            border: '2px solid rgba(245,158,11,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ 
                width: 10, 
                height: 10, 
                borderRadius: '50%', 
                background: '#F59E0B',
                animation: 'pulse 1.5s infinite'
              }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#F59E0B' }}>Changes pending</div>
                <div style={{ fontSize: 11, color: '#64748B' }}>Click "Test Agent" to apply your changes</div>
              </div>
            </div>
            <button
              onClick={onRunFlow}
              disabled={isRunning}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: 'none',
                background: '#F59E0B',
                color: 'white',
                fontSize: 12,
                fontWeight: 700,
                cursor: isRunning ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <RefreshCw size={14} />
              Apply & Run
            </button>
          </div>
        )}

        {/* Progress indicator */}
        <div style={{ maxWidth: 580, margin: '0 auto 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: colors.textSecondary }}>Progress</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: progress === 4 ? '#059669' : SF_BLUE }}>{progress}/4 steps</div>
          </div>
          <div style={{ height: 8, background: isDarkMode ? 'rgba(148, 163, 184, 0.2)' : '#E2E8F0', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(progress / 4) * 100}%`, background: progress === 4 ? '#10B981' : `linear-gradient(90deg, ${SF_BLUE} 0%, ${SF_BLUE_DARK} 100%)`, borderRadius: 4, transition: 'width 0.3s ease' }} />
          </div>
        </div>

        {/* Stack - REVERSED: Experience (top) → Data (bottom) */}
        <div style={{ maxWidth: 580, margin: '0 auto' }}>
          {/* Layer 4: Experience - TOP */}
          <LayerCard
            accentColor={SF_INDIGO}
            isTop
            locked={!isExpUnlocked}
            active={isOrchConfigured && !isExpConfigured}
            layerExecStatus={expExecStatus}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: isExpUnlocked ? `linear-gradient(135deg, ${SF_INDIGO} 0%, #4F46E5 100%)` : LOCKED_GREY, display: 'grid', placeItems: 'center' }}>
                  <Layers size={24} color="white" />
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: isExpUnlocked ? colors.textPrimary : colors.textMuted }}>Experience</div>
                  <div style={{ fontSize: 12, color: colors.textSecondary, fontWeight: 500 }}>Delivery channel for your agent</div>
                </div>
              </div>
              <StepBadge step={4} current={progress} />
            </div>
            {/* Show message when locked */}
            {!isExpUnlocked && (
              <div style={{ marginTop: 12, padding: 14, background: isDarkMode ? 'rgba(148, 163, 184, 0.1)' : '#F8FAFC', borderRadius: 10, border: `2px dashed ${isDarkMode ? 'rgba(148, 163, 184, 0.3)' : '#CBD5E1'}` }}>
                <div style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center' }}>
                  Complete the <strong>Cortex Agent</strong> step first to unlock this layer.
                </div>
              </div>
            )}
            {isExpUnlocked && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, pointerEvents: 'auto' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: isDarkMode ? '#94A3B8' : '#475569', minWidth: 70 }}>Channel</div>
                  <select
                    value={guidedConfig.channel}
                    onChange={(e) => {
                      const newChannel = e.target.value as ExperienceChannel;
                      const channelNames: Record<ExperienceChannel, string> = {
                        snowflake_intelligence: 'Snowflake Intelligence',
                        api: 'REST API',
                        slack: 'Slack',
                        teams: 'Microsoft Teams',
                      };
                      console.log('[GUIDED] Channel changed to:', newChannel);
                      updateConfig({ channel: newChannel }, `Channel set to ${channelNames[newChannel]}`);
                    }}
                    style={{ 
                      flex: 1, 
                      padding: '12px 14px', 
                      borderRadius: 10, 
                      border: `2px solid ${colors.inputBorder}`, 
                      fontSize: 14, 
                      color: colors.textPrimary, 
                      background: colors.inputBg, 
                      cursor: 'pointer', 
                      pointerEvents: 'auto',
                      transition: 'border-color 0.2s ease',
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = SF_INDIGO; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = colors.inputBorder; }}
                  >
                    <option value="snowflake_intelligence">Snowflake Intelligence (ai.snowflake.com)</option>
                    <option value="api">REST API Endpoint</option>
                    <option value="slack">Slack (Coming Soon)</option>
                    <option value="teams">Microsoft Teams (Coming Soon)</option>
                  </select>
                </div>
                
                {/* Channel-specific info */}
                {guidedConfig.channel === 'api' && (
                  <div style={{ marginBottom: 14 }}>
                    {/* API Endpoint Overview */}
                    <div style={{ padding: 16, background: colors.infoBg, borderRadius: 12, border: `1px solid ${colors.infoBorder}`, marginBottom: 12 }}>
                      <div style={{ fontSize: 13, color: colors.infoText, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                        🔌 REST API Endpoint
                      </div>
                      <div style={{ fontSize: 12, color: colors.infoText, lineHeight: 1.6, opacity: 0.9 }}>
                        Your agent will be accessible via a REST API. After completing setup, you can test the endpoint below or deploy it for production use.
                      </div>
                    </div>
                    
                    {/* Technical Details - Shown when configured */}
                    {isExpConfigured && (
                      <div style={{ padding: 16, background: isDarkMode ? 'rgba(15, 23, 42, 0.6)' : '#F8FAFC', borderRadius: 12, border: `1px solid ${colors.inputBorder}` }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
                          Endpoint Details
                        </div>
                        
                        {/* Endpoint URL */}
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <div style={{ fontSize: 11, color: colors.textMuted }}>Endpoint URL (Local Dev)</div>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText('http://localhost:8000/run/stream');
                                setCopiedField('url');
                                setTimeout(() => setCopiedField(null), 2000);
                              }}
                              style={{ 
                                padding: '4px 8px', 
                                borderRadius: 4, 
                                border: 'none', 
                                background: copiedField === 'url' ? '#10B981' : (isDarkMode ? 'rgba(148,163,184,0.2)' : '#E2E8F0'), 
                                color: copiedField === 'url' ? 'white' : colors.textMuted, 
                                fontSize: 10, 
                                fontWeight: 600, 
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                              }}
                            >
                              {copiedField === 'url' ? '✓ Copied!' : '📋 Copy'}
                            </button>
                          </div>
                          <div style={{ 
                            padding: '10px 12px', 
                            background: isDarkMode ? '#0F172A' : 'white', 
                            borderRadius: 8, 
                            border: `1px solid ${colors.inputBorder}`,
                            fontFamily: 'monospace',
                            fontSize: 12,
                            color: SF_BLUE,
                            wordBreak: 'break-all',
                            userSelect: 'all',
                            cursor: 'text'
                          }}>
                            POST http://localhost:8000/run/stream
                          </div>
                        </div>
                        
                        {/* Request Format */}
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <div style={{ fontSize: 11, color: colors.textMuted }}>Request Body (JSON)</div>
                            <button
                              onClick={() => {
                                const requestBody = JSON.stringify({ prompt: "Your question here", nodes: nodes, edges: edges }, null, 2);
                                navigator.clipboard.writeText(requestBody);
                                setCopiedField('body');
                                setTimeout(() => setCopiedField(null), 2000);
                              }}
                              style={{ 
                                padding: '4px 8px', 
                                borderRadius: 4, 
                                border: 'none', 
                                background: copiedField === 'body' ? '#10B981' : (isDarkMode ? 'rgba(148,163,184,0.2)' : '#E2E8F0'), 
                                color: copiedField === 'body' ? 'white' : colors.textMuted, 
                                fontSize: 10, 
                                fontWeight: 600, 
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                              }}
                            >
                              {copiedField === 'body' ? '✓ Copied!' : '📋 Copy Full'}
                            </button>
                          </div>
                          <pre style={{ 
                            padding: '10px 12px', 
                            background: isDarkMode ? '#0F172A' : 'white', 
                            borderRadius: 8, 
                            border: `1px solid ${colors.inputBorder}`,
                            fontFamily: 'monospace',
                            fontSize: 11,
                            color: colors.textSecondary,
                            margin: 0,
                            overflow: 'auto',
                            whiteSpace: 'pre-wrap',
                            userSelect: 'all',
                            cursor: 'text'
                          }}>
{`{
  "prompt": "Your question here",
  "nodes": [...],
  "edges": [...]
}`}
                          </pre>
                        </div>
                        
                        {/* Response Format */}
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: 11, color: colors.textMuted, marginBottom: 4 }}>Response (Server-Sent Events)</div>
                          <div style={{ fontSize: 11, color: colors.textSecondary, lineHeight: 1.5 }}>
                            Streams real-time execution events including <code style={{ background: colors.inputBg, padding: '2px 4px', borderRadius: 3 }}>node_executing</code>, <code style={{ background: colors.inputBg, padding: '2px 4px', borderRadius: 3 }}>node_completed</code>, and <code style={{ background: colors.inputBg, padding: '2px 4px', borderRadius: 3 }}>complete</code> with the agent response.
                          </div>
                        </div>
                        
                        {/* Authentication Note */}
                        <div style={{ 
                          padding: 10, 
                          background: colors.warningBg, 
                          borderRadius: 8, 
                          border: `1px solid ${colors.warningBorder}`,
                          fontSize: 11,
                          color: colors.warningText
                        }}>
                          ⚠️ <strong>Note:</strong> Local dev endpoint has no auth. For production, deploy via Snowflake Native App with OAuth/JWT authentication.
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {(guidedConfig.channel === 'slack' || guidedConfig.channel === 'teams') && (
                  <div style={{ marginBottom: 14, padding: 12, background: colors.warningBg, borderRadius: 10, border: `1px solid ${colors.warningBorder}` }}>
                    <div style={{ fontSize: 12, color: colors.warningText, fontWeight: 600, marginBottom: 4 }}>🚧 Coming Soon</div>
                    <div style={{ fontSize: 11, color: colors.warningText, lineHeight: 1.5, opacity: 0.85 }}>
                      {guidedConfig.channel === 'slack' ? 'Slack' : 'Microsoft Teams'} integration is under development. You can still test your agent below.
                    </div>
                  </div>
                )}
                
                {!isExpConfigured && (
                  <button
                    type="button"
                    onClick={() => {
                      // Build graph with progress 4
                      const nextConfig: GuidedStackConfig = { 
                        ...guidedConfig, 
                        progress: 4 as ProgressStep 
                      };
                      const built = buildProgressiveGraph(nodes, edges, nextConfig);
                      setWorkflow(built.nodes, built.edges, workflowName || 'Untitled Workflow');
                    }}
                    style={{ width: '100%', padding: '16px 20px', borderRadius: 12, border: 'none', background: `linear-gradient(135deg, ${SF_INDIGO} 0%, #4F46E5 100%)`, color: 'white', fontSize: 15, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                  >
                    <Sparkles size={18} />
                    Complete Setup
                  </button>
                )}
                {isExpConfigured && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {/* Unsaved changes banner */}
                    {hasUnsavedChanges && (
                      <div style={{ 
                        padding: '10px 14px', 
                        background: 'linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(234,179,8,0.15) 100%)', 
                        borderRadius: 10, 
                        border: '2px solid rgba(245,158,11,0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10
                      }}>
                        <div style={{ 
                          width: 8, 
                          height: 8, 
                          borderRadius: '50%', 
                          background: '#F59E0B',
                          animation: 'pulse 1.5s infinite'
                        }} />
                        <div style={{ fontSize: 12, color: '#F59E0B', fontWeight: 600 }}>
                          Changes detected — run again to apply
                        </div>
                      </div>
                    )}
                    {/* Show running prompt when executing */}
                    {isRunning && runningPrompt && (
                      <div style={{
                        padding: '12px 14px',
                        background: isDarkMode ? 'rgba(99,102,241,0.15)' : '#EEF2FF',
                        borderRadius: 10,
                        border: `2px solid ${isDarkMode ? 'rgba(99,102,241,0.4)' : '#C7D2FE'}`,
                        marginBottom: 10,
                      }}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: isDarkMode ? '#A5B4FC' : '#6366F1', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Running Query
                        </div>
                        <div style={{ 
                          fontSize: 13, 
                          color: isDarkMode ? '#E0E7FF' : '#4338CA', 
                          fontStyle: 'italic',
                          lineHeight: 1.4,
                          wordBreak: 'break-word',
                        }}>
                          "{runningPrompt.length > 100 ? runningPrompt.substring(0, 100) + '...' : runningPrompt}"
                        </div>
                      </div>
                    )}
                    {/* Test button - label changes based on channel and unsaved state */}
                    {onRunFlow && (
                      <button
                        onClick={onRunFlow}
                        disabled={isRunning || guidedConfig.channel === 'slack' || guidedConfig.channel === 'teams'}
                        style={{ 
                          width: '100%', 
                          padding: '18px 24px', 
                          borderRadius: 14, 
                          border: hasUnsavedChanges ? '2px solid #F59E0B' : 'none', 
                          background: isRunning 
                            ? '#94A3B8' 
                            : (guidedConfig.channel === 'slack' || guidedConfig.channel === 'teams')
                              ? '#CBD5E1'
                              : hasUnsavedChanges
                                ? 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)'
                                : 'linear-gradient(135deg, #10B981 0%, #059669 100%)', 
                          color: 'white', 
                          fontSize: 16, 
                          fontWeight: 700, 
                          cursor: (isRunning || guidedConfig.channel === 'slack' || guidedConfig.channel === 'teams') ? 'not-allowed' : 'pointer', 
                          boxShadow: (isRunning || guidedConfig.channel === 'slack' || guidedConfig.channel === 'teams') ? 'none' : hasUnsavedChanges ? '0 6px 20px rgba(245,158,11,0.4)' : '0 6px 20px rgba(16,185,129,0.4)',
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          gap: 10,
                          transition: 'all 0.2s ease',
                        }}
                      >
                        {isRunning ? (
                          <>
                            <div className="exec-spinner" style={{ width: 18, height: 18, border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%' }} />
                            Running...
                          </>
                        ) : hasUnsavedChanges ? (
                          <>
                            <RefreshCw size={20} />
                            Re-run with Changes
                          </>
                        ) : guidedConfig.channel === 'api' ? (
                          <>
                            <Play size={20} fill="white" />
                            Test API Endpoint
                          </>
                        ) : guidedConfig.channel === 'slack' ? (
                          <>
                            <Play size={20} fill="white" />
                            Test in Slack (Coming Soon)
                          </>
                        ) : guidedConfig.channel === 'teams' ? (
                          <>
                            <Play size={20} fill="white" />
                            Test in Teams (Coming Soon)
                          </>
                        ) : (
                          <>
                            <Play size={20} fill="white" />
                            Test Agent
                          </>
                        )}
                      </button>
                    )}
                    
                    {/* Channel-specific action button */}
                    {guidedConfig.channel === 'snowflake_intelligence' && (
                      <button
                        onClick={() => window.open('https://ai.snowflake.com', '_blank')}
                        style={{ 
                          width: '100%', 
                          padding: '14px 20px', 
                          borderRadius: 12, 
                          border: '2px solid #29B5E8', 
                          background: 'white', 
                          color: '#0F172A', 
                          fontSize: 14, 
                          fontWeight: 600, 
                          cursor: 'pointer', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          gap: 8,
                          transition: 'all 0.15s ease',
                        }}
                        onMouseOver={(e) => { e.currentTarget.style.background = '#EBF8FF'; }}
                        onMouseOut={(e) => { e.currentTarget.style.background = 'white'; }}
                      >
                        <Globe size={16} color="#29B5E8" />
                        Open Snowflake Intelligence
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </LayerCard>

          <Connector locked={!isOrchConfigured} />

          {/* Layer 3: Orchestration / Agent */}
          <LayerCard
            accentColor={SF_PURPLE}
            locked={!isOrchUnlocked}
            active={isSemanticConfigured && !isOrchConfigured}
            layerExecStatus={orchExecStatus}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: isOrchUnlocked ? `linear-gradient(135deg, ${SF_PURPLE} 0%, #7C3AED 100%)` : LOCKED_GREY, display: 'grid', placeItems: 'center' }}>
                  <Brain size={24} color="white" />
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: isOrchUnlocked ? colors.textPrimary : colors.textMuted }}>Cortex Agent</div>
                  <div style={{ fontSize: 12, color: colors.textSecondary, fontWeight: 500 }}>AI reasoning and tool orchestration</div>
                </div>
              </div>
              <StepBadge step={3} current={progress} />
            </div>
            {/* Show message when locked */}
            {!isOrchUnlocked && (
              <div style={{ marginTop: 12, padding: 14, background: isDarkMode ? 'rgba(148, 163, 184, 0.1)' : '#F8FAFC', borderRadius: 10, border: `2px dashed ${isDarkMode ? 'rgba(148, 163, 184, 0.3)' : '#CBD5E1'}` }}>
                <div style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center' }}>
                  Complete the <strong>Semantic Model</strong> step first to unlock this layer.
                </div>
              </div>
            )}
            {isOrchUnlocked && (
              <>
                {/* Orchestration mode selection - ALWAYS clickable when unlocked */}
                <div style={{ position: 'relative', zIndex: 5 }}>
                  <OrchestrationPills mode={guidedConfig.orchestration} disabled={isRunning} />
                </div>
                
                {/* Help text */}
                <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {!isOrchConfigured ? (
                    <>
                      <span style={{ color: SF_PURPLE }}>👆</span>
                      Select a pattern above, then click <strong>Confirm</strong> below
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={12} color="#10B981" />
                      <span style={{ color: '#059669' }}>Pattern selected.</span> Click any button above to change, or adjust settings below
                    </>
                  )}
                </div>
                
                {/* Action buttons */}
                <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {!isOrchConfigured ? (
                    <button
                      type="button"
                      onClick={() => {
                        // DIRECT inline state update
                        const newProgress = Math.max(3, guidedConfig.progress) as ProgressStep;
                        const nextConfig: GuidedStackConfig = { ...guidedConfig, progress: newProgress };
                        const built = buildProgressiveGraph(nodes, edges, nextConfig);
                        setWorkflow(built.nodes, built.edges, workflowName || 'Untitled Workflow');
                        showChangeToast(`${guidedConfig.orchestration === 'single' ? 'Single Agent' : guidedConfig.orchestration === 'supervisor' ? 'Supervisor' : guidedConfig.orchestration === 'router' ? 'Router' : 'External'} pattern confirmed`);
                      }}
                      style={{ 
                        flex: 1, 
                        padding: '14px 20px', 
                        borderRadius: 12, 
                        border: 'none', 
                        background: `linear-gradient(135deg, ${SF_PURPLE} 0%, #7C3AED 100%)`, 
                        color: 'white', 
                        fontSize: 14, 
                        fontWeight: 700, 
                        cursor: 'pointer', 
                        boxShadow: '0 4px 12px rgba(139,92,246,0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                      }}
                    >
                      <CheckCircle2 size={16} />
                      Confirm Orchestration
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        const nodeId = guidedConfig.orchestration === 'supervisor' ? IDS.supervisor
                          : guidedConfig.orchestration === 'router' ? IDS.router
                          : guidedConfig.orchestration === 'external' ? IDS.external
                          : IDS.agent;
                        onOpenNode(nodeId, containerRef.current);
                      }}
                      style={{ 
                        padding: '12px 18px', 
                        borderRadius: 10, 
                        border: `2px solid ${colors.inputBorder}`, 
                        background: colors.cardBg, 
                        color: colors.textSecondary, 
                        fontSize: 13, 
                        fontWeight: 600, 
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        transition: 'all 0.15s ease',
                      }}
                      onMouseOver={(e) => { e.currentTarget.style.borderColor = SF_PURPLE; e.currentTarget.style.color = SF_PURPLE; }}
                      onMouseOut={(e) => { e.currentTarget.style.borderColor = colors.inputBorder; e.currentTarget.style.color = colors.textSecondary; }}
                    >
                      ⚙️ Advanced Settings
                    </button>
                  )}
                </div>
              </>
            )}
          </LayerCard>

          <Connector locked={!isSemanticConfigured} />

          {/* Layer 2: Semantic Model */}
          <LayerCard
            accentColor={SF_PURPLE}
            locked={!isSemanticUnlocked}
            active={isDataConfigured && !isSemanticConfigured}
            layerExecStatus={semanticExecStatus}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: isSemanticUnlocked ? `linear-gradient(135deg, ${SF_PURPLE} 0%, #7C3AED 100%)` : LOCKED_GREY, display: 'grid', placeItems: 'center' }}>
                  <Layers size={24} color="white" />
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: isSemanticUnlocked ? colors.textPrimary : colors.textMuted }}>Semantic Model</div>
                  <div style={{ fontSize: 12, color: colors.textSecondary, fontWeight: 500 }}>Business context for Cortex Analyst</div>
                </div>
              </div>
              <StepBadge step={2} current={progress} />
            </div>
            {/* Show message when locked */}
            {!isSemanticUnlocked && (
              <div style={{ marginTop: 12, padding: 14, background: isDarkMode ? 'rgba(148, 163, 184, 0.1)' : '#F8FAFC', borderRadius: 10, border: `2px dashed ${isDarkMode ? 'rgba(148, 163, 184, 0.3)' : '#CBD5E1'}` }}>
                <div style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center' }}>
                  Complete the <strong>Data</strong> step first to unlock this layer.
                </div>
              </div>
            )}
            {isSemanticUnlocked && (
              <>
                {!isSemanticConfigured && (
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={guidedConfig.useSemantic}
                        onChange={(e) => updateConfig({ useSemantic: e.target.checked })}
                        style={{ width: 18, height: 18, accentColor: SF_PURPLE }}
                      />
                      <span style={{ fontSize: 14, color: '#1E293B', fontWeight: 500 }}>Use semantic model (recommended)</span>
                    </label>
                    <div style={{ fontSize: 12, color: '#94A3B8', marginLeft: 28, marginTop: 4 }}>Improves NL→SQL quality significantly</div>
                  </div>
                )}
                {guidedConfig.useSemantic ? (
                  <>
                    <div style={{ fontSize: 14, color: colors.textSecondary, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', wordBreak: 'break-all', background: colors.inputBg, borderRadius: 10, padding: 14, marginBottom: 14 }}>
                      {summarizeSemantic(semNode, progress)}
                    </div>
                    {/* Always show button to change semantic model */}
                    <button
                      onClick={() => openCatalog('semantic')}
                      style={{ 
                        width: '100%', 
                        padding: '14px 20px', 
                        borderRadius: 12, 
                        border: isSemanticConfigured ? `2px solid ${colors.inputBorder}` : 'none', 
                        background: isSemanticConfigured ? colors.cardBg : `linear-gradient(135deg, ${SF_PURPLE} 0%, #7C3AED 100%)`, 
                        color: isSemanticConfigured ? colors.textSecondary : 'white', 
                        fontSize: 14, 
                        fontWeight: 700, 
                        cursor: 'pointer' 
                      }}
                    >
                      {isSemanticConfigured ? '✎ Change Semantic Model' : 'Select Semantic Model'}
                    </button>
                  </>
                ) : (
                  <>
                    {!isSemanticConfigured && (
                      <button
                        onClick={skipSemantic}
                        style={{ width: '100%', padding: '14px 20px', borderRadius: 12, border: '2px solid #F59E0B', background: 'rgba(251,191,36,0.06)', color: '#D97706', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
                      >
                        Skip Semantic Model (Not Recommended)
                      </button>
                    )}
                    {isSemanticConfigured && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ padding: 14, background: colors.warningBg, borderRadius: 10, border: `1px solid ${colors.warningBorder}` }}>
                          <div style={{ fontSize: 12, color: colors.warningText }}>
                            ⚠️ Semantic model skipped. Results may be less accurate.
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            updateConfig({ useSemantic: true });
                            openCatalog('semantic');
                          }}
                          style={{ width: '100%', padding: '12px 16px', borderRadius: 10, border: `2px solid ${colors.inputBorder}`, background: colors.cardBg, color: colors.textSecondary, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                        >
                          ✎ Add Semantic Model
                        </button>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </LayerCard>

          <Connector locked={!isDataConfigured} />

          {/* Layer 1: Data - BOTTOM */}
          <LayerCard
            accentColor={SF_BLUE}
            isBottom
            active={progress === 0}
            layerExecStatus={dataExecStatus}
            onClick={() => openCatalog('data')}
            title="Select a data source"
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: `linear-gradient(135deg, ${SF_BLUE} 0%, ${SF_BLUE_DARK} 100%)`, display: 'grid', placeItems: 'center' }}>
                  <Database size={24} color="white" />
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: colors.textPrimary }}>Data</div>
                  <div style={{ fontSize: 12, color: colors.textSecondary, fontWeight: 500 }}>Tables, views, and data sources</div>
                </div>
              </div>
              <StepBadge step={1} current={progress} />
            </div>
            <div style={{ fontSize: 14, color: colors.textSecondary, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', wordBreak: 'break-all', background: colors.inputBg, borderRadius: 10, padding: 14, marginBottom: 14 }}>
              {summarizeData(dataNode, progress)}
            </div>
            {/* Always show button - changes label based on state */}
            <button
              onClick={() => openCatalog('data')}
              style={{ 
                width: '100%', 
                padding: '14px 20px', 
                borderRadius: 12, 
                border: isDataConfigured ? `2px solid ${colors.inputBorder}` : 'none', 
                background: isDataConfigured ? colors.cardBg : `linear-gradient(135deg, ${SF_BLUE} 0%, ${SF_BLUE_DARK} 100%)`, 
                color: isDataConfigured ? colors.textSecondary : 'white', 
                fontSize: 14, 
                fontWeight: 700, 
                cursor: 'pointer' 
              }}
            >
              {isDataConfigured ? '✎ Change Data Source' : 'Select Data Source'}
            </button>
            {progress === 0 && (
              <div style={{ marginTop: 14, textAlign: 'center', fontSize: 13, color: SF_BLUE, fontWeight: 600 }}>
                ↑ Start here
              </div>
            )}
          </LayerCard>

          {/* Completion hint - subtle since main CTA is in Experience layer */}
          {progress === 4 && (
            <div style={{ marginTop: 20, borderRadius: 14, border: `2px solid ${colors.inputBorder}`, background: colors.cardBg, padding: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 1.5 }}>
                <CheckCircle2 size={14} color="#10B981" style={{ display: 'inline', verticalAlign: -2, marginRight: 6 }} />
                <strong style={{ color: '#059669' }}>Agent configured!</strong> Click <strong style={{ color: '#10B981' }}>Test Agent</strong> above to run, or switch to <strong style={{ color: SF_BLUE }}>Graph view</strong> for advanced customization.
              </div>
            </div>
          )}

          {/* Hint: Switch to Graph for complex flows */}
          {progress > 0 && progress < 4 && (
            <div style={{ marginTop: 20, borderRadius: 14, border: `2px solid ${colors.inputBorder}`, background: colors.cardBg, padding: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 1.5 }}>
                <strong style={{ color: colors.textPrimary }}>Need more control?</strong> Switch to <strong style={{ color: SF_BLUE }}>Graph view</strong> anytime for advanced customization.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Zoom controls */}
      <div style={{ position: 'absolute', right: 20, bottom: 20, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 10 }}>
        {[
          { icon: Plus, action: () => setZoom((z) => Math.min(1.25, Math.round((z + 0.1) * 10) / 10)), title: 'Zoom in' },
          { icon: Minus, action: () => setZoom((z) => Math.max(0.7, Math.round((z - 0.1) * 10) / 10)), title: 'Zoom out' },
          { icon: RotateCcw, action: () => setZoom(1), title: 'Reset zoom' },
        ].map(({ icon: Icon, action, title }) => (
          <button
            key={title}
            onClick={action}
            title={title}
            style={{ width: 44, height: 44, borderRadius: 12, border: `2px solid ${colors.inputBorder}`, background: colors.cardBg, color: colors.textSecondary, cursor: 'pointer', display: 'grid', placeItems: 'center', boxShadow: isDarkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.06)' }}
          >
            <Icon size={18} />
          </button>
        ))}
      </div>

      {/* Catalog modal */}
      {catalogMode && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'grid', placeItems: 'center' }}>
          <div style={{ width: '90%', maxWidth: 900, height: '80%', maxHeight: 700, background: 'white', borderRadius: 20, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }}>
            <div style={{ padding: '18px 24px', borderBottom: '2px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F8FAFC', flexShrink: 0 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#0F172A' }}>
                {catalogMode === 'data' ? 'Select Data Source' : 'Select Semantic Model'}
              </div>
              <button onClick={() => setCatalogMode(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94A3B8', padding: 8, fontSize: 24, lineHeight: 1 }}>×</button>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
              <DataCatalog
                initialTab={catalogMode === 'data' ? 'sources' : 'semantics'}
                onSelectSource={catalogMode === 'data' ? applyDataSelection : undefined}
                onSelectSemanticModel={catalogMode === 'semantic' ? applySemanticSelection : undefined}
              />
            </div>
          </div>
        </div>
      )}

      {/* Change toast notification */}
      {changeToast && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 100,
            background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
            color: 'white',
            padding: '14px 24px',
            borderRadius: 12,
            fontSize: 14,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            boxShadow: '0 8px 24px rgba(16, 185, 129, 0.4)',
            animation: 'slideUp 0.3s ease',
          }}
        >
          <CheckCircle2 size={18} />
          {changeToast}
        </div>
      )}
      
      {/* Add slideUp animation */}
      <style>{`
        @keyframes slideUp {
          from { transform: translateX(-50%) translateY(20px); opacity: 0; }
          to { transform: translateX(-50%) translateY(0); opacity: 1; }
        }
      `}</style>

      {/* Governance side panel */}
      {showGovernance && (
        <div style={{ position: 'absolute', top: 0, right: 0, width: 400, height: '100%', background: 'white', borderLeft: `3px solid ${govColor.border}`, boxShadow: '-10px 0 40px rgba(0,0,0,0.1)', zIndex: 40, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '18px 20px', borderBottom: '2px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: govColor.bg, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: govColor.border, display: 'grid', placeItems: 'center' }}>
                <Shield size={20} color="white" />
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A' }}>Governance</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: govColor.text, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {governanceStatus === 'grey' && 'Not Started'}
                  {governanceStatus === 'green' && '✓ Ready'}
                  {governanceStatus === 'amber' && '● In Progress'}
                  {governanceStatus === 'red' && '⚠ Issues Found'}
                </div>
              </div>
            </div>
            <button onClick={() => setShowGovernance(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94A3B8', padding: 8, fontSize: 20, lineHeight: 1 }}>×</button>
          </div>
          <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
            {/* Progress */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Setup Progress</div>
              <div style={{ background: '#F8FAFC', borderRadius: 12, padding: 14 }}>
                {[
                  { step: 1, label: 'Data Source', done: progress >= 1 },
                  { step: 2, label: 'Semantic Model', done: progress >= 2 },
                  { step: 3, label: 'Orchestration', done: progress >= 3 },
                  { step: 4, label: 'Experience', done: progress >= 4 },
                ].map(({ step, label, done }) => (
                  <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: step < 4 ? 8 : 0 }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: done ? '#10B981' : '#E2E8F0', display: 'grid', placeItems: 'center' }}>
                      {done && <CheckCircle2 size={14} color="white" />}
                    </div>
                    <div style={{ fontSize: 13, color: done ? '#059669' : '#64748B', fontWeight: done ? 600 : 400 }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Warnings */}
            {progress >= 2 && !guidedConfig.useSemantic && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#F59E0B', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Warnings</div>
                <div style={{ background: 'rgba(251,191,36,0.06)', border: '2px solid rgba(251,191,36,0.3)', borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 13, color: '#92400E', lineHeight: 1.5 }}>
                    <AlertTriangle size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: -2 }} />
                    Semantic model skipped. NL→SQL quality may be lower.
                  </div>
                </div>
              </div>
            )}

            {/* Critical Issues */}
            {progress === 4 && guidedConfig.orchestration === 'external' && (() => {
              const ext = nodesById.get(IDS.external);
              const d: any = ext?.data || {};
              if (!String(d.endpoint || '').trim()) {
                return (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#EF4444', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Critical Issues</div>
                    <div style={{ background: 'rgba(239,68,68,0.06)', border: '2px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: 14 }}>
                      <div style={{ fontSize: 13, color: '#DC2626', lineHeight: 1.5 }}>
                        External Agent is missing an endpoint URL.
                      </div>
                    </div>
                  </div>
                );
              }
              return null;
            })()}

            {/* Needs Review - show acknowledge button */}
            {governanceStatus === 'amber' && progress === 4 && !governanceReviewed && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#D97706', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Action Required</div>
                <div style={{ background: 'rgba(245,158,11,0.08)', border: '2px solid rgba(245,158,11,0.3)', borderRadius: 10, padding: 14, fontSize: 13, color: '#92400E', marginBottom: 12 }}>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>Review before deploying:</div>
                  <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
                    <li>Data access is limited to configured sources</li>
                    <li>Agent responses may include sensitive data</li>
                    {guidedConfig.channel === 'api' && <li>API endpoint has no authentication in dev mode</li>}
                    {!guidedConfig.useSemantic && <li>No semantic model - results may be less accurate</li>}
                  </ul>
                </div>
                <button
                  onClick={() => setGovernanceReviewed(true)}
                  style={{ width: '100%', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', color: 'white', padding: '12px 16px', cursor: 'pointer', fontWeight: 700, fontSize: 13, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  <CheckCircle2 size={16} />
                  I've Reviewed - Mark as Ready
                </button>
              </div>
            )}

            {/* All Good */}
            {governanceStatus === 'green' && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#10B981', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Status</div>
                <div style={{ background: 'rgba(16,185,129,0.06)', border: '2px solid rgba(16,185,129,0.3)', borderRadius: 10, padding: 14, fontSize: 13, color: '#059669' }}>
                  ✓ Governance reviewed. Your agent is ready to deploy.
                </div>
              </div>
            )}

            <button
              onClick={onOpenControlTower}
              style={{ width: '100%', borderRadius: 12, border: `2px solid ${SF_BLUE}`, background: 'white', color: SF_BLUE_DARK, padding: '14px 16px', cursor: 'pointer', fontWeight: 700, fontSize: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10, transition: 'all 0.15s ease' }}
              onMouseOver={(e) => { e.currentTarget.style.background = SF_BLUE; e.currentTarget.style.color = 'white'; }}
              onMouseOut={(e) => { e.currentTarget.style.background = 'white'; e.currentTarget.style.color = SF_BLUE_DARK; }}
            >
              <Shield size={16} />
              Open Control Tower
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
