import { create } from 'zustand';
import type { Node, Edge, OnNodesChange, OnEdgesChange, OnConnect } from 'reactflow';
import { applyNodeChanges, applyEdgeChanges, addEdge } from 'reactflow';

// LocalStorage keys
const STORAGE_KEY = 'snowflow_canvas_state';
const WORKFLOWS_REGISTRY_KEY = 'snowflow_workflows_registry';

// Generate unique ID
const generateId = () => `wf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Workflow registry entry (for agent selector dropdown)
export interface WorkflowRegistryEntry {
  id: string;
  name: string;
  agentCount: number;
  lastModified: number;
}

// Get all saved workflows from registry
export const getWorkflowsRegistry = (): WorkflowRegistryEntry[] => {
  try {
    const data = localStorage.getItem(WORKFLOWS_REGISTRY_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

// Update workflow in registry
const updateWorkflowRegistry = (id: string, name: string, nodes: Node[]) => {
  if (!name.trim()) return; // Don't register unnamed workflows
  try {
    const registry = getWorkflowsRegistry();
    const agentCount = nodes.filter(n => n.type === 'agent').length;
    const existing = registry.findIndex(w => w.id === id);
    const entry: WorkflowRegistryEntry = { id, name: name.trim(), agentCount, lastModified: Date.now() };
    
    if (existing >= 0) {
      registry[existing] = entry;
    } else {
      registry.push(entry);
    }
    // Keep only last 20 workflows
    const sorted = registry.sort((a, b) => b.lastModified - a.lastModified).slice(0, 20);
    localStorage.setItem(WORKFLOWS_REGISTRY_KEY, JSON.stringify(sorted));
  } catch (e) {
    console.warn('Could not update workflows registry:', e);
  }
};

// Save to localStorage (debounced would be better, but this works for demo)
const saveToLocalStorage = (nodes: Node[], edges: Edge[], name: string, id: string) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ nodes, edges, name, id, savedAt: Date.now() }));
    // Also update registry if workflow has a name
    if (name.trim()) {
      updateWorkflowRegistry(id, name, nodes);
    }
  } catch (e) {
    console.warn('Could not save to localStorage:', e);
  }
};

// Load from localStorage
const loadFromLocalStorage = (): { nodes: Node[]; edges: Edge[]; name: string; id: string } | null => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const data = JSON.parse(saved);
      // Only restore if saved within last 24 hours
      if (data.savedAt && Date.now() - data.savedAt < 24 * 60 * 60 * 1000) {
        const rawName = typeof data.name === 'string' ? data.name : '';
        // Migration: older versions stored the literal string "Untitled Workflow" as a default name.
        // Treat that as "unnamed" so the UI shows the placeholder instead of a fake title.
        const name = rawName.trim() === 'Untitled Workflow' ? '' : rawName;
        const id = data.id || generateId(); // Ensure we always have an ID
        return { nodes: data.nodes, edges: data.edges, name, id };
      }
    }
  } catch (e) {
    console.warn('Could not load from localStorage:', e);
  }
  return null;
};

type FlowState = {
  nodes: Node[];
  edges: Edge[];
  selectedNode: Node | null;
  workflowId: string;
  workflowName: string;
  lastAutosavedAt: number | null;
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  addNode: (node: Node) => void;
  setSelectedNode: (node: Node | null) => void;
  updateNodeData: (nodeId: string, data: Record<string, unknown>) => void;
  setWorkflow: (nodes: Node[], edges: Edge[], name?: string, id?: string) => void;
  setWorkflowName: (name: string) => void;
  clearWorkflow: () => void;
  clearLocalStorage: () => void;
};

const defaultNodes: Node[] = [
  { 
    id: '1', 
    type: 'snowflakeSource', 
    position: { x: 50, y: 120 }, 
    data: { label: 'SALES_DATA', database: 'SNOWFLOW_DEV', schema: 'DEMO', objectType: 'table' } 
  },
  { 
    id: '2', 
    type: 'agent', 
    position: { x: 580, y: 120 }, 
    data: { label: 'Sales Analyst', type: 'analyst', model: 'mistral-large2', instructions: 'Analyze the sales data. What are the top selling products? Which regions perform best?' } 
  },
  { 
    id: '3', 
    type: 'output', 
    position: { x: 870, y: 120 }, 
    data: { label: 'Results', outputType: 'display' } 
  },
];

const defaultEdges: Edge[] = [
  { id: 'e1-2', source: '1', target: '2', animated: true, style: { stroke: '#29B5E8' } },
  { id: 'e2-3', source: '2', target: '3', animated: true, style: { stroke: '#29B5E8' } },
];

// Try to load saved state, otherwise use defaults
const savedState = loadFromLocalStorage();
const initialNodes = savedState?.nodes || defaultNodes;
const initialEdges = savedState?.edges || defaultEdges;
const initialName = savedState?.name ?? '';
const initialId = savedState?.id || generateId();

export const useFlowStore = create<FlowState>((set, get) => ({
  nodes: initialNodes,
  edges: initialEdges,
  selectedNode: null,
  workflowId: initialId,
  workflowName: initialName,
  lastAutosavedAt: null,
  onNodesChange: (changes) => {
    const newNodes = applyNodeChanges(changes, get().nodes);
    const now = Date.now();
    // If the currently selected node was removed, close the properties panel.
    const selected = get().selectedNode;
    const selectedStillExists = selected ? newNodes.some((n) => n.id === selected.id) : true;
    set({ nodes: newNodes, selectedNode: selectedStillExists ? selected : null, lastAutosavedAt: now });
    saveToLocalStorage(newNodes, get().edges, get().workflowName, get().workflowId);
  },
  onEdgesChange: (changes) => {
    const newEdges = applyEdgeChanges(changes, get().edges);
    const now = Date.now();
    set({ edges: newEdges, lastAutosavedAt: now });
    saveToLocalStorage(get().nodes, newEdges, get().workflowName, get().workflowId);
  },
  onConnect: (connection) => {
    const newEdges = addEdge({ ...connection, animated: true, style: { stroke: '#29B5E8' } }, get().edges);
    const now = Date.now();
    set({ edges: newEdges, lastAutosavedAt: now });
    saveToLocalStorage(get().nodes, newEdges, get().workflowName, get().workflowId);
  },
  addNode: (node) => {
    const newNodes = [...get().nodes, node];
    const now = Date.now();
    set({ nodes: newNodes, lastAutosavedAt: now });
    saveToLocalStorage(newNodes, get().edges, get().workflowName, get().workflowId);
  },
  setSelectedNode: (node) => set({ selectedNode: node }),
  updateNodeData: (nodeId, data) => {
    const newNodes = get().nodes.map(n => n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n);
    const now = Date.now();
    set({
      nodes: newNodes,
      selectedNode: get().selectedNode?.id === nodeId 
        ? { ...get().selectedNode!, data: { ...get().selectedNode!.data, ...data } }
        : get().selectedNode
      ,
      lastAutosavedAt: now
    });
    saveToLocalStorage(newNodes, get().edges, get().workflowName, get().workflowId);
  },
  setWorkflow: (nodes, edges, name, id) => {
    const workflowName = name || get().workflowName;
    const workflowId = id || generateId(); // New ID if loading a new workflow
    const now = Date.now();
    set({ nodes, edges, workflowName, workflowId, selectedNode: null, lastAutosavedAt: now });
    saveToLocalStorage(nodes, edges, workflowName, workflowId);
  },
  setWorkflowName: (name) => {
    const now = Date.now();
    set({ workflowName: name, lastAutosavedAt: now });
    saveToLocalStorage(get().nodes, get().edges, name, get().workflowId);
  },
  clearWorkflow: () => {
    const newId = generateId(); // Fresh ID for new workflow
    const now = Date.now();
    set({ nodes: [], edges: [], selectedNode: null, workflowName: '', workflowId: newId, lastAutosavedAt: now });
    saveToLocalStorage([], [], '', newId);
  },
  clearLocalStorage: () => {
    localStorage.removeItem(STORAGE_KEY);
    const newId = generateId();
    set({ nodes: defaultNodes, edges: defaultEdges, selectedNode: null, workflowName: '', workflowId: newId, lastAutosavedAt: null });
  },
}));
