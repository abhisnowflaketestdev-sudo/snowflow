import { create } from 'zustand';
import type { Node, Edge, OnNodesChange, OnEdgesChange, OnConnect } from 'reactflow';
import { applyNodeChanges, applyEdgeChanges, addEdge } from 'reactflow';

// LocalStorage keys
const STORAGE_KEY = 'snowflow_canvas_state';

// Save to localStorage (debounced would be better, but this works for demo)
const saveToLocalStorage = (nodes: Node[], edges: Edge[], name: string) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ nodes, edges, name, savedAt: Date.now() }));
  } catch (e) {
    console.warn('Could not save to localStorage:', e);
  }
};

// Load from localStorage
const loadFromLocalStorage = (): { nodes: Node[]; edges: Edge[]; name: string } | null => {
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
        return { nodes: data.nodes, edges: data.edges, name };
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
  workflowName: string;
  lastAutosavedAt: number | null;
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  addNode: (node: Node) => void;
  setSelectedNode: (node: Node | null) => void;
  updateNodeData: (nodeId: string, data: Record<string, unknown>) => void;
  setWorkflow: (nodes: Node[], edges: Edge[], name?: string) => void;
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

export const useFlowStore = create<FlowState>((set, get) => ({
  nodes: initialNodes,
  edges: initialEdges,
  selectedNode: null,
  workflowName: initialName,
  lastAutosavedAt: null,
  onNodesChange: (changes) => {
    const newNodes = applyNodeChanges(changes, get().nodes);
    const now = Date.now();
    // If the currently selected node was removed, close the properties panel.
    const selected = get().selectedNode;
    const selectedStillExists = selected ? newNodes.some((n) => n.id === selected.id) : true;
    set({ nodes: newNodes, selectedNode: selectedStillExists ? selected : null, lastAutosavedAt: now });
    saveToLocalStorage(newNodes, get().edges, get().workflowName);
  },
  onEdgesChange: (changes) => {
    const newEdges = applyEdgeChanges(changes, get().edges);
    const now = Date.now();
    set({ edges: newEdges, lastAutosavedAt: now });
    saveToLocalStorage(get().nodes, newEdges, get().workflowName);
  },
  onConnect: (connection) => {
    const newEdges = addEdge({ ...connection, animated: true, style: { stroke: '#29B5E8' } }, get().edges);
    const now = Date.now();
    set({ edges: newEdges, lastAutosavedAt: now });
    saveToLocalStorage(get().nodes, newEdges, get().workflowName);
  },
  addNode: (node) => {
    const newNodes = [...get().nodes, node];
    const now = Date.now();
    set({ nodes: newNodes, lastAutosavedAt: now });
    saveToLocalStorage(newNodes, get().edges, get().workflowName);
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
    saveToLocalStorage(newNodes, get().edges, get().workflowName);
  },
  setWorkflow: (nodes, edges, name) => {
    const workflowName = name || get().workflowName;
    const now = Date.now();
    set({ nodes, edges, workflowName, selectedNode: null, lastAutosavedAt: now });
    saveToLocalStorage(nodes, edges, workflowName);
  },
  setWorkflowName: (name) => {
    const now = Date.now();
    set({ workflowName: name, lastAutosavedAt: now });
    saveToLocalStorage(get().nodes, get().edges, name);
  },
  clearWorkflow: () => {
    const now = Date.now();
    set({ nodes: [], edges: [], selectedNode: null, workflowName: '', lastAutosavedAt: now });
    saveToLocalStorage([], [], '');
  },
  clearLocalStorage: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({ nodes: defaultNodes, edges: defaultEdges, selectedNode: null, workflowName: '', lastAutosavedAt: null });
  },
}));
