# SnowFlow Application Test Plans

> **Purpose**: Comprehensive test plans to validate all features of the SnowFlow low-code workflow builder.
> **Last Updated**: January 24, 2026
> **Tester**: [Your Name]

---

## Table of Contents

1. [Setup & Prerequisites](#1-setup--prerequisites)
2. [Basic UI Navigation Tests](#2-basic-ui-navigation-tests)
3. [Canvas & Workflow Tests](#3-canvas--workflow-tests)
4. [Node Creation Tests](#4-node-creation-tests)
5. [Node Configuration Tests](#5-node-configuration-tests)
6. [Data Catalog Tests](#6-data-catalog-tests)
7. [Workflow Execution Tests](#7-workflow-execution-tests)
8. [File Operations Tests](#8-file-operations-tests)
9. [Control Tower Tests](#9-control-tower-tests)
10. [Settings & Governance Tests](#10-settings--governance-tests)
11. [Templates Tests](#11-templates-tests)
12. [Custom Tools Tests](#12-custom-tools-tests)
13. [Error Handling Tests](#13-error-handling-tests)
14. [Performance Tests](#14-performance-tests)
15. [Accessibility Tests](#15-accessibility-tests)
16. [Orchestration Patterns & Graph Semantics Tests](#16-orchestration-patterns--graph-semantics-tests)
17. [Snowflake Roles, Permissions & Demo Assets Tests](#17-snowflake-roles-permissions--demo-assets-tests)

---

## 1. Setup & Prerequisites

### Pre-Test Checklist

| # | Check Item | Status |
|---|------------|--------|
| 1.1 | Backend server running on `http://localhost:8000` | ☐ |
| 1.2 | Frontend running on `http://localhost:5174` | ☐ |
| 1.3 | Browser (Chrome/Firefox recommended) open | ☐ |
| 1.4 | Developer Tools accessible (F12) | ☐ |
| 1.5 | Snowflake credentials configured (optional for full testing) | ☐ |

### How to Start the Application

```bash
# Terminal 1 - Backend
cd /Users/abhineetasthana/snowflow/backend
./venv/bin/python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload

# Terminal 2 - Frontend
cd /Users/abhineetasthana/snowflow/frontend
npm run dev -- --port 5174
```

### Verify Application is Running

1. Open browser to `http://localhost:5174`
2. You should see the SnowFlow canvas with a dark blue sidebar on the left
3. Check `http://localhost:8000/health` returns `{"status":"ok"}`

---

## 2. Basic UI Navigation Tests

### TEST-2.1: Application Load

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Navigate to `http://localhost:5174` | Page loads without errors | ☐ |
| 2 | Observe the page layout | See: Left sidebar, Top toolbar, Main canvas | ☐ |
| 3 | Check browser console (F12) | No critical errors (warnings are OK) | ☐ |

### TEST-2.2: Left Sidebar Tabs

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Click **"Component"** tab | Shows list of available node types | ☐ |
| 2 | Click **"Catalog"** tab | Shows Data Sources and Semantic Models | ☐ |
| 3 | Click **"Template"** tab | Shows available workflow templates | ☐ |

### TEST-2.3: Resizable Sidebar

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Hover over the right edge of the sidebar | Cursor changes to resize cursor (↔) | ☐ |
| 2 | Click and drag to the RIGHT | Sidebar width increases | ☐ |
| 3 | Click and drag to the LEFT | Sidebar width decreases | ☐ |
| 4 | Release mouse | Sidebar stays at new width | ☐ |
| 5 | Drag sidebar to minimum width (~200px) | Sidebar stops shrinking at minimum | ☐ |

### TEST-2.4: Top Toolbar Elements

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Locate "New" button | Button visible with icon | ☐ |
| 2 | Locate "Open" button | Button visible with icon | ☐ |
| 3 | Locate "Save" button | Button visible with icon | ☐ |
| 4 | Locate workflow name input field | Text input with placeholder "Name this workflow…" | ☐ |
| 5 | Locate "Import" button | Button visible | ☐ |
| 6 | Locate "Export" button | Button visible | ☐ |
| 7 | Locate "Clear" button | Button visible | ☐ |
| 8 | Locate "Run Flow" button | Button visible; opens prompt modal | ☐ |
| 9 | Locate "Preview Chat" button | Button visible; opens preview panel | ☐ |
| 10 | Locate "Control Tower" button | Button visible | ☐ |
| 11 | Locate Workspace menu (Role/Theme) | Compact workspace control visible (not cluttering header) | ☐ |

---

## 3. Canvas & Workflow Tests

### TEST-3.1: Canvas Zoom Controls

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Find zoom controls (bottom right of canvas) | See 4 buttons: +, -, fit, lock | ☐ |
| 2 | Click **"+"** (zoom in) | Canvas zooms in | ☐ |
| 3 | Click **"-"** (zoom out) | Canvas zooms out | ☐ |
| 4 | Click **"fit view"** | Canvas fits all nodes in view | ☐ |
| 5 | Click **"toggle interactivity"** | Toggles pan/zoom lock | ☐ |

### TEST-3.2: Canvas Pan

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Click and drag on empty canvas area | Canvas pans (moves) in drag direction | ☐ |
| 2 | Use scroll wheel | Canvas zooms in/out | ☐ |
| 3 | Hold Ctrl + scroll wheel | Canvas zooms in/out | ☐ |

### TEST-3.3: Node Selection

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Click on any node | Node shows selection border (thicker) | ☐ |
| 2 | Click on empty canvas | Node deselects | ☐ |
| 3 | Click on different node | New node selected, old deselected | ☐ |

### TEST-3.4: Node Movement

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Click and hold on a node | Node becomes draggable | ☐ |
| 2 | Drag node to new position | Node moves with cursor | ☐ |
| 3 | Release mouse | Node stays at new position | ☐ |
| 4 | If node has connections, drag it | Connected edges follow the node | ☐ |

### TEST-3.5: Edge (Connection) Creation

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Hover over node's output handle (right side dot) | Handle highlights | ☐ |
| 2 | Click and drag from output handle | Edge line follows cursor | ☐ |
| 3 | Drag to another node's input handle (left side) | Edge snaps to target handle | ☐ |
| 4 | Release mouse | Permanent edge created between nodes | ☐ |
| 5 | Edge should have animated flow indicator | Blue dots flowing along edge | ☐ |

### TEST-3.6: Edge Deletion

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Click on an edge | Edge becomes selected (thicker/highlighted) | ☐ |
| 2 | Press Delete or Backspace key | Edge is removed | ☐ |

### TEST-3.7: Node Deletion

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Select a node by clicking it | Node shows selection border | ☐ |
| 2 | Press Delete or Backspace key | Node is removed from canvas | ☐ |
| 3 | Check connected edges | All connected edges also removed | ☐ |

---

## 4. Node Creation Tests

### TEST-4.1: Drag-and-Drop from Component Panel

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Click "Component" tab in sidebar | Component list appears | ☐ |
| 2 | Find "Snowflake Source" component | Component visible in list | ☐ |
| 3 | Click and drag "Snowflake Source" to canvas | Node preview follows cursor | ☐ |
| 4 | Release on canvas | New Snowflake Source node created | ☐ |
| 5 | Repeat for "Cortex Agent" | Agent node created on canvas | ☐ |
| 6 | Repeat for "Output" | Output node created on canvas | ☐ |

### TEST-4.2: Create All Node Types

For each node type below, drag from Component panel to canvas and verify creation:

| Node Type | Drag to Canvas | Node Appears | Pass/Fail |
|-----------|---------------|--------------|-----------|
| Snowflake Source | ☐ | ☐ | ☐ |
| Semantic Model | ☐ | ☐ | ☐ |
| Cortex Agent | ☐ | ☐ | ☐ |
| External Agent | ☐ | ☐ | ☐ |
| Supervisor | ☐ | ☐ | ☐ |
| Router | ☐ | ☐ | ☐ |
| Condition | ☐ | ☐ | ☐ |
| Output | ☐ | ☐ | ☐ |
| File Input | ☐ | ☐ | ☐ |
| File Output | ☐ | ☐ | ☐ |
| Schema Extractor | ☐ | ☐ | ☐ |
| Schema Transformer | ☐ | ☐ | ☐ |
| DAX Translator | ☐ | ☐ | ☐ |

---

## 5. Node Configuration Tests

### TEST-5.1: Snowflake Source Node Configuration

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Create a Snowflake Source node | Node appears on canvas | ☐ |
| 2 | Click on the node | Detail panel opens on right side | ☐ |
| 3 | Locate "Database" dropdown | Dropdown visible | ☐ |
| 4 | Click Database dropdown | List of databases appears (or loading indicator) | ☐ |
| 5 | Select a database | Database selected, Schema dropdown enables | ☐ |
| 6 | Click Schema dropdown | List of schemas appears | ☐ |
| 7 | Select a schema | Schema selected | ☐ |
| 8 | Node label should update | Shows "TABLE [name]" or similar | ☐ |

### TEST-5.2: Cortex Agent Node Configuration

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Create a Cortex Agent node | Node appears on canvas | ☐ |
| 2 | Click on the node | Detail panel opens | ☐ |
| 3 | Find "Agent Name" field | Text input visible | ☐ |
| 4 | Enter a name (e.g., "Sales Analyst") | Name accepted | ☐ |
| 5 | Find "Model" dropdown | Dropdown visible | ☐ |
| 6 | Click Model dropdown | List of Cortex models appears | ☐ |
| 7 | Models should include | claude-3-5-sonnet, llama3.1-70b, mistral-large2, etc. | ☐ |
| 8 | Select a model | Model selected and displayed | ☐ |
| 9 | Find "System Prompt" field | Multi-line text area | ☐ |
| 10 | Enter a prompt | Prompt accepted | ☐ |

### TEST-5.3: Output Node Configuration

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Create an Output node | Node appears on canvas | ☐ |
| 2 | Click on the node | Detail panel opens | ☐ |
| 3 | Node shows "Result display" label | Label visible | ☐ |
| 4 | Find "Preview" button | Button visible inside node | ☐ |
| 5 | Find "Download" button | Button visible inside node | ☐ |

### TEST-5.4: Semantic Model Node Configuration

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Create a Semantic Model node | Node appears on canvas | ☐ |
| 2 | Click on the node | Detail panel opens | ☐ |
| 3 | Find Database/Schema/Stage dropdowns | Dropdowns visible | ☐ |
| 4 | Select database → schema → stage | Options cascade properly | ☐ |
| 5 | Find YAML file dropdown | Dropdown shows .yaml files from stage | ☐ |

### TEST-5.5: Supervisor Node Configuration

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Create a Supervisor node | Node appears on canvas | ☐ |
| 2 | Click on the node | Detail panel opens | ☐ |
| 3 | Find "Supervisor Name" field | Text input visible | ☐ |
| 4 | Find "Model" dropdown | Dropdown with Cortex models (account-dependent) | ☐ |
| 5 | Find "Max Iterations" field | Number input visible | ☐ |
| 6 | Find "Delegation Strategy" dropdown | Adaptive/Parallel/Sequential options | ☐ |
| 7 | Find "Aggregation Method" dropdown | Merge/Vote/First/Custom options | ☐ |
| 8 | Connected Agents section | Shows "Agents: None" or a list of connected agent names | ☐ |

### TEST-5.6: Router Node Configuration

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Create a Router node | Node appears on canvas | ☐ |
| 2 | Click on the node | Detail panel opens | ☐ |
| 3 | Find "Routing Strategy" dropdown | Options: content_based, round_robin, etc. | ☐ |
| 4 | Find routing rules configuration | Rule input fields | ☐ |

### TEST-5.7: External Agent Node Configuration

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Create an External Agent node | Node appears on canvas | ☐ |
| 2 | Click on the node | Detail panel opens | ☐ |
| 3 | Select an Agent Type | Options include REST API / MCP Agent / Webhook | ☐ |
| 4 | Find the endpoint field | REST/Webhook: "Endpoint URL"; MCP: "MCP Server URL" | ☐ |
| 5 | Choose Authentication mode | None / Bearer / API Key / OAuth | ☐ |
| 6 | If Bearer/OAuth selected | Token input appears | ☐ |
| 7 | If API Key selected | API Key header + API Key value inputs appear | ☐ |
| 8 | If REST/Webhook | Headers JSON textarea appears | ☐ |

### TEST-5.8: Condition Node Configuration

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Create a Condition node | Node appears on canvas | ☐ |
| 2 | Click on the node | Detail panel opens | ☐ |
| 3 | Find "Condition Expression" field | Text input | ☐ |
| 4 | Node should have TRUE and FALSE outputs | Two output handles visible | ☐ |

---

## 6. Data Catalog Tests

### TEST-6.1: Sources Tab

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Click "Catalog" tab in sidebar | Catalog panel opens | ☐ |
| 2 | "Sources" sub-tab should be visible | Tab/button for Sources | ☐ |
| 3 | Click "Sources" | List of data sources (tables/views) appears | ☐ |
| 4 | If Snowflake connected, see real tables | Tables from Snowflake shown | ☐ |
| 5 | If no Snowflake, see placeholder/error | Appropriate message shown | ☐ |

### TEST-6.2: Semantic Models Tab

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | In Catalog panel, find "Semantics" tab | Tab visible | ☐ |
| 2 | Click "Semantics" | List of semantic models (YAML files) | ☐ |
| 3 | Models organized by database/schema/stage | Hierarchical structure | ☐ |

### TEST-6.3: Drag from Catalog

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | In Sources tab, click and drag a table | Draggable indicator appears | ☐ |
| 2 | Drop on canvas | Snowflake Source node created with table pre-selected | ☐ |
| 3 | In Semantics tab, drag a YAML model | Draggable indicator appears | ☐ |
| 4 | Drop on canvas | Semantic Model node created with model pre-selected | ☐ |

---

## 7. Workflow Execution Tests

> **Important (Connection Rules):** SnowFlow follows the Snowflake Intelligence architecture.
> - ✅ Recommended flow: **Snowflake Source → Semantic Model → Cortex Agent → Output**
> - ⚠️ Advanced: **Snowflake Source → Cortex Agent** is allowed, but SnowFlow will warn that NL→SQL quality may be lower without semantic context
> - ⚠️ Optional shortcut: **Snowflake Source → Cortex (Function) → Output** (no semantic context; accuracy may vary)

### TEST-7.1: NL→SQL Workflow (Recommended 4-Node Flow)

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 0 | Ensure canvas is in **Edit** mode (unlocked) | Nodes/edges can be edited | ☐ |
| 1 | Create 4 nodes: **Snowflake Source**, **Semantic Model**, **Cortex Agent**, **Output** | 4 nodes on canvas | ☐ |
| 2 | Configure **Snowflake Source** | Select any DB/Schema/Table/View you can see in the dropdown (use whatever exists in *your* account) | ☐ |
| 3 | Configure **Semantic Model** | Select any YAML from Catalog → Semantics. If the Semantics tab is empty (0 files), skip the Semantic Model node and instead run the **Source → Agent → Output** “advanced” path and expect a warning + risky (amber) edge | ☐ |
| 4 | Configure **Cortex Agent** | Name=`Sales Analyst`, Model=`Mistral Large 2` (or any available Cortex model) | ☐ |
| 5 | Connect nodes | Source → Semantic Model → Agent → Output | ☐ |
| 6 | Click **Run Flow** | Run Flow modal opens | ☐ |
| 7 | In the modal, enter question | `What are the top 5 products by total net revenue?` | ☐ |
| 8 | Confirm Run | Workflow starts executing; nodes show running/loading state | ☐ |
| 9 | Wait for completion | Output shows an answer and/or table-like result | ☐ |
| 10 | Check Results Panel (right) | Execution results displayed; no uncaught errors | ☐ |

> Optional demo dataset (only if present in your account):
> - Dedicated DB path: DB=`SNOWFLOW_DEMO`, Schema=`RETAIL`, View=`VW_RETAIL_SALES`, Semantic YAML=`@SNOWFLOW_DEMO.RETAIL.SEMANTIC_MODELS/semantic_model_retail.yaml`
> - Fallback install path (if DB create isn’t allowed): DB=`<your backend SNOWFLAKE_DATABASE>`, Schema=`SNOWFLOW_RETAIL`, View=`VW_RETAIL_SALES`, Semantic YAML=`@<DB>.SNOWFLOW_RETAIL.SEMANTIC_MODELS/semantic_model_retail.yaml`

### TEST-7.2: Workflow with Supervisor

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 0 | Ensure canvas is in **Edit** mode (unlocked) | Nodes/edges can be edited | ☐ |
| 1 | Create nodes: **Snowflake Source**, **Semantic Model**, **Supervisor**, **2× Cortex Agent**, **Output** | All nodes on canvas | ☐ |
| 2 | Configure **Snowflake Source** | Select any DB/Schema/Table/View you can see in the dropdown | ☐ |
| 3 | Configure **Semantic Model** | Select any YAML from Catalog → Semantics. If Semantics is empty (0 files), skip the Semantic Model node and instead run **Source → Supervisor → Agents → Output** and expect a warning + risky (amber) edge into the Supervisor/Agents | ☐ |
| 4 | Configure both Agents | Agent A: Name=`Revenue Analyst`, Model=`Mistral Large 2`; Agent B: Name=`Ops Analyst`, Model=`Mistral Large 2` | ☐ |
| 5 | Connect graph | Source → Semantic Model → Supervisor → (Agent A & Agent B) → Output | ☐ |
| 6 | Click **Run Flow** and ask | `Which campaign has the best CTR and which has the highest spend? Summarize by channel.` | ☐ |
| 7 | Verify orchestration | Both agents execute and supervisor aggregates; output shows combined response | ☐ |

> Optional demo dataset (only if present in your account):
> - Dedicated DB path: DB=`SNOWFLOW_DEMO`, Schema=`AD_MEDIA`, View=`VW_AD_PERFORMANCE`, Semantic YAML=`@SNOWFLOW_DEMO.AD_MEDIA.SEMANTIC_MODELS/semantic_model_ad_media.yaml`
> - Fallback install path (if DB create isn’t allowed): DB=`<your backend SNOWFLAKE_DATABASE>`, Schema=`SNOWFLOW_AD_MEDIA`, View=`VW_AD_PERFORMANCE`, Semantic YAML=`@<DB>.SNOWFLOW_AD_MEDIA.SEMANTIC_MODELS/semantic_model_ad_media.yaml`

### TEST-7.3: Conditional Workflow

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 0 | Ensure canvas is in **Edit** mode (unlocked) | Nodes/edges can be edited | ☐ |
| 1 | Create nodes: **Snowflake Source**, **Semantic Model**, **Cortex Agent**, **Condition**, **2× Output** | All nodes on canvas | ☐ |
| 2 | Configure **Snowflake Source** | Select any DB/Schema/Table/View you can see in the dropdown | ☐ |
| 3 | Configure **Semantic Model** | Select any YAML from Catalog → Semantics. If Semantics is empty (0 files), skip the Semantic Model node and run **Source → Agent → Condition → Outputs** (expect a warning + risky edge into the Agent) | ☐ |
| 4 | Configure **Cortex Agent** | Name=`Customer Analyst`, Model=`Mistral Large 2` | ☐ |
| 5 | Connect graph | Source → Semantic Model → Agent → Condition → (TRUE Output & FALSE Output) | ☐ |
| 6 | Configure **Condition Expression** | Use a simple boolean, e.g. `contains(lower(result), "scotland")` | ☐ |
| 7 | Click **Run Flow** and ask | `Which region had the highest total net revenue?` | ☐ |
| 8 | Verify branching | Only one branch executes; correct Output node receives results | ☐ |

> Optional demo dataset (only if present in your account):
> - Dedicated DB path: DB=`SNOWFLOW_DEMO`, Schema=`RETAIL`, View=`VW_RETAIL_SALES`, Semantic YAML=`@SNOWFLOW_DEMO.RETAIL.SEMANTIC_MODELS/semantic_model_retail.yaml`
> - Fallback install path (if DB create isn’t allowed): DB=`<your backend SNOWFLAKE_DATABASE>`, Schema=`SNOWFLOW_RETAIL`, View=`VW_RETAIL_SALES`, Semantic YAML=`@<DB>.SNOWFLOW_RETAIL.SEMANTIC_MODELS/semantic_model_retail.yaml`

### TEST-7.4: Execution Streaming

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Use a working flow from TEST-7.1 | Flow exists on canvas | ☐ |
| 2 | Click **Run Flow** | Execution starts | ☐ |
| 3 | Observe node states | Agent/Output show running state | ☐ |
| 4 | Observe output rendering | Response appears progressively (streaming) or in chunks | ☐ |
| 5 | After completion | Full response displayed; UI remains responsive | ☐ |

### TEST-7.5: Execution Errors

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Create an invalid graph | Leave required nodes unconnected (e.g., Output has no input) or leave required configs blank | ☐ |
| 2 | Click **Run Flow** | Validation error shown (clear guidance on what’s missing/invalid) | ☐ |
| 3 | Create invalid config | Set Agent model to blank / unset required config | ☐ |
| 4 | Click **Run Flow** | Validation error displayed; no crash | ☐ |

---

## 8. File Operations Tests

### TEST-8.1: New Workflow

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Create some nodes on canvas | Nodes exist | ☐ |
| 2 | Click "New" button | Confirmation dialog appears (if nodes exist) | ☐ |
| 3 | Confirm | Canvas clears, fresh state | ☐ |
| 4 | Workflow name field should be empty | Placeholder "Workflow name..." shown | ☐ |

### TEST-8.2: Save Workflow

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Create a workflow with some nodes | Nodes on canvas | ☐ |
| 2 | Enter a workflow name | E.g., "Test Workflow 1" | ☐ |
| 3 | Click "Save" button | Save operation starts | ☐ |
| 4 | Success notification appears | "Workflow saved" or similar | ☐ |
| 5 | Check backend logs | Save request received | ☐ |

### TEST-8.3: Open Workflow

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Click "Open" button | File list dialog/modal appears | ☐ |
| 2 | List of saved workflows displayed | Shows previously saved workflows | ☐ |
| 3 | Click on a workflow name | Workflow selected | ☐ |
| 4 | Click "Open" or double-click | Workflow loads onto canvas | ☐ |
| 5 | Nodes and edges restored | Same as when saved | ☐ |
| 6 | Node configurations preserved | Settings intact | ☐ |

### TEST-8.4: Export Workflow

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Create a workflow | Nodes on canvas | ☐ |
| 2 | Click "Export" button | Export starts | ☐ |
| 3 | File download triggered | JSON file downloads | ☐ |
| 4 | Open downloaded file | Valid JSON structure | ☐ |
| 5 | JSON contains nodes and edges | Workflow structure preserved | ☐ |

### TEST-8.5: Import Workflow

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Click "Import" button | File picker dialog opens | ☐ |
| 2 | Select a previously exported JSON file | File selected | ☐ |
| 3 | Click "Open" | Import starts | ☐ |
| 4 | Workflow loads onto canvas | Nodes and edges appear | ☐ |
| 5 | All configurations preserved | Same as exported | ☐ |

### TEST-8.6: Clear Canvas

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Create several nodes on canvas | Nodes exist | ☐ |
| 2 | Click "Clear" button | Confirmation dialog (optional) | ☐ |
| 3 | Confirm clear | All nodes removed | ☐ |
| 4 | Canvas is empty | No nodes, no edges | ☐ |

---

## 9. Control Tower Tests

### TEST-9.1: Open Control Tower

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Click "Control Tower" button | Modal/dialog opens | ☐ |
| 2 | Load time should be fast | < 1 second ideally | ☐ |
| 3 | Modal shows header "SnowFlow Control Tower" | Title visible | ☐ |
| 4 | Close button visible | "X" or "Close" button | ☐ |
| 5 | Refresh button visible | "Refresh" button | ☐ |

### TEST-9.2: Overview Tab

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Control Tower opens to Overview tab | Overview selected by default | ☐ |
| 2 | "Workflows" stat card visible | Shows count of workflows | ☐ |
| 3 | "Agents" stat card visible | Shows count of agents | ☐ |
| 4 | "Pending" indicator if agents pending | Badge with pending count | ☐ |
| 5 | Quick action buttons visible | "Approve Agent", "Audit Trail", "Configure Governance" | ☐ |

### TEST-9.3: Agents & Workflows Tab

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Click "Agents & Workflows" tab | Tab content loads | ☐ |
| 2 | List of registered agents appears | Agent names, types, statuses | ☐ |
| 3 | Agent types shown | cortex, external, supervisor, router | ☐ |
| 4 | Status indicators visible | active, pending_approval, disabled | ☐ |
| 5 | For pending agents, "Approve" button | Button visible | ☐ |
| 6 | Click "Approve" on pending agent | Agent status changes to approved | ☐ |
| 7 | "Revoke" button for approved agents | Button visible | ☐ |

### TEST-9.4: Audit Log Tab

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Click "Audit Log" tab | Tab content loads | ☐ |
| 2 | List of audit events appears | Actions, timestamps, actors | ☐ |
| 3 | Events include | workflow_executed, agent_approved, settings_updated | ☐ |
| 4 | Timestamps are readable | Human-readable dates | ☐ |
| 5 | Details expandable (if applicable) | Click to see more info | ☐ |

### TEST-9.5: Settings Tab

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Click "Settings" tab | Tab content loads | ☐ |
| 2 | Sub-tabs visible | Security, Governance, AI Models, Integration | ☐ |
| 3 | "Save All Settings" button visible | Button at top | ☐ |

### TEST-9.6: Close Control Tower

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Click "Close" button | Modal closes | ☐ |
| 2 | Click outside modal (on backdrop) | Modal closes | ☐ |
| 3 | Press Escape key | Modal closes | ☐ |
| 4 | Canvas is visible again | Can interact with workflow | ☐ |

---

## 10. Settings & Governance Tests

### TEST-10.1: Security Settings

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | In Settings tab, click "Security" | Security settings shown | ☐ |
| 2 | "Require Agent Approval" toggle visible | Toggle switch | ☐ |
| 3 | Toggle the switch | Value changes (ON/OFF) | ☐ |
| 4 | "Auto-approve Cortex Agents" toggle | Toggle switch | ☐ |
| 5 | "Session Timeout" input | Number input (minutes) | ☐ |
| 6 | Change session timeout value | Value accepted | ☐ |
| 7 | "Max Concurrent Sessions" input | Number input | ☐ |

### TEST-10.2: Governance Settings

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Click "Governance" sub-tab | Governance settings shown | ☐ |
| 2 | "Audit Retention Days" input | Number input | ☐ |
| 3 | "Audit Level" dropdown | Options: minimal, standard, verbose | ☐ |
| 4 | "Enable PII Detection" toggle | Toggle switch | ☐ |
| 5 | "Data Masking" toggle | Toggle switch | ☐ |

### TEST-10.3: AI Models Settings

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Click "AI Models" sub-tab | AI settings shown | ☐ |
| 2 | "Default Model" dropdown | List of Cortex models | ☐ |
| 3 | Select a different default model | Model selected | ☐ |
| 4 | "Max Tokens Per Request" input | Number input | ☐ |
| 5 | "Rate Limits" section | Requests/min, Tokens/min inputs | ☐ |
| 6 | "Allowed Models" list | Checkboxes or multi-select | ☐ |

### TEST-10.4: Integration Settings

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Click "Integration" sub-tab | Integration settings shown | ☐ |
| 2 | "MCP Configuration" section | MCP server settings | ☐ |
| 3 | "Allow External APIs" toggle | Toggle switch | ☐ |
| 4 | "Allowed Endpoints" list | URL whitelist input | ☐ |
| 5 | "Webhook URL" input (if available) | Text input | ☐ |

### TEST-10.5: Save Settings

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Make changes to any settings | Values modified | ☐ |
| 2 | Click "Save All Settings" | Save operation starts | ☐ |
| 3 | Success notification appears | "Settings saved" or similar | ☐ |
| 4 | Close and reopen Control Tower | Settings persisted | ☐ |
| 5 | Previously saved values shown | No data loss | ☐ |

---

## 11. Templates Tests

### TEST-11.1: View Templates

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Click "Template" tab in sidebar | Template list appears | ☐ |
| 2 | Available templates displayed | Template names and descriptions | ☐ |
| 3 | Templates may include | Sales Analytics, Data Pipeline, etc. | ☐ |

### TEST-11.2: Use Template

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Click on a template | Template details shown | ☐ |
| 2 | Click "Use Template" button | Confirmation (if canvas has nodes) | ☐ |
| 3 | Confirm | Template workflow loads onto canvas | ☐ |
| 4 | All template nodes present | Pre-configured workflow | ☐ |
| 5 | Edges connected properly | Workflow structure intact | ☐ |

---

## 12. Custom Tools Tests

### TEST-12.1: Create Custom Tool

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | In Component panel, find "+ Create Custom Tool" | Button visible | ☐ |
| 2 | Click the button | Custom tool dialog opens | ☐ |
| 3 | Enter tool name | E.g., "My Custom Tool" | ☐ |
| 4 | Enter tool description | Description text | ☐ |
| 5 | Define tool parameters | Input fields for params | ☐ |
| 6 | Save custom tool | Tool created | ☐ |
| 7 | Tool appears in Component list | New tool visible | ☐ |

### TEST-12.2: Use Custom Tool

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Find custom tool in Component list | Tool visible | ☐ |
| 2 | Drag custom tool to canvas | Node created | ☐ |
| 3 | Configure custom tool node | Custom config options | ☐ |

---

## 13. Error Handling Tests

### TEST-13.1: Backend Disconnection

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Stop the backend server | Kill uvicorn process | ☐ |
| 2 | Try to run a workflow | Error message displayed | ☐ |
| 3 | Try to save a workflow | Error message displayed | ☐ |
| 4 | Try to open Control Tower | Error or loading indicator | ☐ |
| 5 | Restart backend | Server running again | ☐ |
| 6 | Retry operations | Should work normally | ☐ |

### TEST-13.2: Invalid Configuration

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Create Agent node without selecting model | Model field empty | ☐ |
| 2 | Try to run workflow | Validation error shown | ☐ |
| 3 | Error identifies the problem | "Please select a model" or similar | ☐ |

### TEST-13.3: Network Timeout

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Configure External Agent with invalid URL | E.g., "http://invalid.url.test" | ☐ |
| 2 | Run workflow | Timeout error after delay | ☐ |
| 3 | Error message displayed | "Connection timeout" or similar | ☐ |

---

## 14. Performance Tests

### TEST-14.1: Large Workflow

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Create 20+ nodes on canvas | Nodes created | ☐ |
| 2 | Connect all nodes with edges | Edges created | ☐ |
| 3 | Pan and zoom canvas | Smooth, no lag | ☐ |
| 4 | Select and move nodes | Responsive | ☐ |
| 5 | Save workflow | Saves without timeout | ☐ |

### TEST-14.2: Control Tower Load Time

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Open browser DevTools (F12) | DevTools open | ☐ |
| 2 | Go to Network tab | Network monitoring | ☐ |
| 3 | Click "Control Tower" | Modal opens | ☐ |
| 4 | Check console for load time | Should show "<100ms" ideally | ☐ |
| 5 | API calls complete quickly | All under 3 seconds | ☐ |

### TEST-14.3: Workflow Execution Time

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Create simple 3-node workflow | Source → Agent → Output | ☐ |
| 2 | Run workflow | Execution starts | ☐ |
| 3 | Time from click to first response | Under 5 seconds | ☐ |
| 4 | Total execution time | Reasonable (under 60s for simple) | ☐ |

---

## 15. Accessibility Tests

### TEST-15.1: Keyboard Navigation

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Use Tab key to navigate UI | Focus moves through elements | ☐ |
| 2 | Focus indicators visible | Highlighted/outlined elements | ☐ |
| 3 | Press Enter on buttons | Buttons activate | ☐ |
| 4 | Press Escape | Closes modals/panels | ☐ |

### TEST-15.2: Screen Reader Compatibility

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Enable screen reader | VoiceOver/NVDA active | ☐ |
| 2 | Navigate to buttons | Button labels read aloud | ☐ |
| 3 | Navigate to inputs | Input labels read aloud | ☐ |

### TEST-15.3: Color Contrast

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | View all text elements | Text readable | ☐ |
| 2 | View button labels | Sufficient contrast | ☐ |
| 3 | View node labels | Readable against node background | ☐ |

---

## 16. Orchestration Patterns & Graph Semantics Tests

> **Goal:** Validate that SnowFlow can express and run common orchestration patterns *without surprising graph semantics*.
> This section is intentionally “pattern-driven” (it reuses node types from Sections 4–7).

### TEST-16.1: Fan-in (AND-join) Semantics

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Create 2× upstream nodes (e.g., 2× Cortex Agent) feeding into 1 downstream node (e.g., Output) | Graph created | ☐ |
| 2 | Run flow | Downstream node runs **after both** upstream nodes complete (AND-join) | ☐ |
| 3 | Confirm behavior is consistent | No “either/or” ambiguity; deterministic run order | ☐ |

### TEST-16.2: Router Deterministic Output Ordering

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Create Router with 3 routes (route-1, route-2, route-3) and connect each to a unique Output | Graph created | ☐ |
| 2 | Edit route conditions so each route is uniquely matchable | Conditions saved | ☐ |
| 3 | Run flow with a prompt that matches route-2 | Only the route-2 path executes | ☐ |
| 4 | Repeat with a route-1 prompt | Only route-1 path executes | ☐ |
| 5 | Confirm ordering is stable | Route evaluation order follows route handle IDs (no random shuffling) | ☐ |

### TEST-16.3: Router Strategy Coverage (Current vs Planned)

| Strategy | Expected | Status (PASS/FAIL/N/A) | Notes |
|----------|----------|-------------------------|------|
| Keyword routing | Conditions can act as keyword match | ☐ | Implemented |
| Round-robin | Routes rotate per message | ☐ | N/A until implemented |
| Intent classification | LLM selects route based on intent labels | ☐ | N/A until implemented |

### TEST-16.4: Conditional Branching (TRUE/FALSE)

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Build: Source → (Semantic Model optional) → Agent → Condition → 2× Output | Graph created | ☐ |
| 2 | Set Condition to a simple expression referencing agent output | Saved | ☐ |
| 3 | Run flow | Exactly **one** branch executes (TRUE or FALSE) | ☐ |

### TEST-16.5: Risky Edge (Source → Agent bypassing Semantic Model)

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Create Source → Agent edge **without** Semantic Model | Edge allowed | ☐ |
| 2 | Observe edge styling | Edge is **amber/dashed** (risky) | ☐ |
| 3 | Click edge | Warning toast appears and is dismissible | ☐ |
| 4 | Run flow | Run modal warns about lower NL→SQL quality without semantic context | ☐ |

### TEST-16.6: Read-only Preview Mode (Edit Lock)

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Toggle Preview (read-only) in canvas controls | Editing locks | ☐ |
| 2 | Try to drag nodes / create edges / delete | Blocked + user feedback | ☐ |
| 3 | Pan/zoom canvas | Still works (view-only navigation) | ☐ |
| 4 | Toggle back to Edit | Editing restored | ☐ |

---

## 17. Snowflake Roles, Permissions & Demo Assets Tests

### TEST-17.1: Workspace Role Dropdown (Visibility + UX)

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Open Workspace menu (Role/Theme) | Popover opens; header stays clean (not crowded) | ☐ |
| 2 | View available roles | Only roles granted to the backend Snowflake user are shown | ☐ |
| 3 | Close popover (click outside / Esc) | Popover closes | ☐ |

### TEST-17.2: Role Switch Updates Catalog Access

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Switch role to a “limited” role | Success toast; current role updates | ☐ |
| 2 | Open Catalog → Sources and refresh | Visible DB/schema objects reflect that role | ☐ |
| 3 | Switch role to `ACCOUNTADMIN` | Success toast | ☐ |
| 4 | Refresh Catalog → Semantics | Demo YAMLs should appear if stages are accessible | ☐ |

### TEST-17.3: Demo Assets Install (Dedicated DB Path)

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Set role = `ACCOUNTADMIN` | Role switch succeeds | ☐ |
| 2 | Click “Install Demo Assets” | Install completes successfully | ☐ |
| 3 | Verify DB exists | `SNOWFLOW_DEMO` shows in DB dropdown | ☐ |
| 4 | Verify schemas exist | `RETAIL` and `AD_MEDIA` exist | ☐ |
| 5 | Verify views exist | `VW_RETAIL_SALES` and `VW_AD_PERFORMANCE` exist | ☐ |
| 6 | Verify semantics exist | Semantics tab shows uploaded YAMLs | ☐ |

### TEST-17.4: Demo Assets Install (Fallback DB Path)

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Switch to a role without CREATE DATABASE | Role switch succeeds | ☐ |
| 2 | Click “Install Demo Assets” | Install completes, but uses fallback DB/schemas | ☐ |
| 3 | Verify response | Report shows fallback DB + `SNOWFLOW_RETAIL`/`SNOWFLOW_AD_MEDIA` schemas | ☐ |

### TEST-17.5: Object Picker for Source Node (Views)

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Open Snowflake Source config | Panel opens | ☐ |
| 2 | Select DB + Schema | Object picker populates | ☐ |
| 3 | Change Object Type to View | Name becomes selectable (dropdown), lists views | ☐ |
| 4 | Pick `VW_RETAIL_SALES` | Name set; no manual typing required | ☐ |

---

## Section 18: Guided Stack Canvas (Second View)

These tests validate the new **Guided Stack** canvas mode (Data → Semantic → Orchestration → Experience) and ensure it stays **fully compatible** with the underlying graph state (Run/Save/Export/Import).

### TEST-18.1: View Toggle (Graph ↔ Guided)

| Step | Action | Expected | Pass/Fail |
|------|--------|----------|-----------|
| 1 | Use the new “Graph / Guided” toggle in the left sidebar | View switches immediately | ☐ |
| 2 | Switch back to Graph | Graph view still works normally | ☐ |
| 3 | Switch to Guided again | Guided view still works normally | ☐ |

### TEST-18.2: Initialize Guided Stack (Non-destructive UX)

| Step | Action | Expected | Pass/Fail |
|------|--------|----------|-----------|
| 1 | Switch to Guided view on a workflow that does not have Guided Stack nodes | A banner appears: “Guided Stack isn’t initialized…” | ☐ |
| 2 | Click “Start Guided Stack” | A 4-layer Guided Stack appears and becomes clickable | ☐ |
| 3 | Switch back to Graph view | You see a canonical 4-step graph (Source → Semantic → Orchestration → Output) | ☐ |

### TEST-18.3: Data Layer Config (Click-to-configure)

| Step | Action | Expected | Pass/Fail |
|------|--------|----------|-----------|
| 1 | In Guided view, click the **Data** card | A “Select Data Source” modal opens (Data Catalog) | ☐ |
| 2 | Select a source (e.g., `VW_RETAIL_SALES`) | Data card summary updates to `DB.SCHEMA.OBJECT` | ☐ |
| 3 | Switch to Graph view | The `snowflakeSource` node reflects the same config | ☐ |
| 4 | In Guided view, click **Advanced** on the Data card | Node config panel opens for the Data Source node | ☐ |

### TEST-18.4: Semantic Layer Config + Optional Disable

| Step | Action | Expected | Pass/Fail |
|------|--------|----------|-----------|
| 1 | In Guided view, ensure “Use semantic model (recommended)” is enabled | Semantic card is enabled/clickable | ☐ |
| 2 | Click the **Semantic** card | A “Select Semantic Model” modal opens (Data Catalog) | ☐ |
| 3 | Select a semantic model | Semantic card summary updates to the selected stage path | ☐ |
| 4 | In Guided view, click **Advanced** on the Semantic card | Node config panel opens for the Semantic Model node | ☐ |
| 5 | Disable “Use semantic model” | Guided warns that semantic is recommended and orchestration modes requiring semantic are disabled | ☐ |
| 6 | Switch to Graph view | The direct Source → Agent path is present and is marked as risky (amber/dashed) | ☐ |

### TEST-18.5: Orchestration Mode Switching (Idempotent Graph Mapping)

| Step | Action | Expected | Pass/Fail |
|------|--------|----------|-----------|
| 1 | In Guided view, set Orchestration to “Single agent” | Graph maps to Source → Semantic → Agent → Output | ☐ |
| 2 | Switch Orchestration to “Supervisor” | Graph maps to Source → Semantic → Supervisor → Agents → Output | ☐ |
| 3 | Switch Orchestration to “Router” | Graph maps to Source → Semantic → Router → Agents → Output | ☐ |
| 4 | Switch Orchestration to “External” | Graph maps to Source → Semantic → External Agent → Output | ☐ |
| 5 | Switch back to “Single agent” | Graph returns to the canonical single-agent mapping (no leftover router/supervisor nodes) | ☐ |

### TEST-18.6: Experience Layer (Channel Selector Stub)

| Step | Action | Expected | Pass/Fail |
|------|--------|----------|-----------|
| 1 | In Guided view, change Experience “Channel” between options | Selection updates in the card and persists when switching views | ☐ |
| 2 | Click the Experience card | Output node config panel opens | ☐ |

### TEST-18.7: Governance Panel (Security & Risk Overview)

| Step | Action | Expected | Pass/Fail |
|------|--------|----------|-----------|
| 1 | Click “Governance” in Guided view | Side governance panel opens | ☐ |
| 2 | With semantic enabled | Warnings list shows “No warnings detected” (or empty) | ☐ |
| 3 | Disable semantic (Single agent mode) | Governance panel shows a warning about Source → Agent quality risk | ☐ |
| 4 | Click “Open Control Tower” in the governance panel | Control Tower opens | ☐ |

### TEST-18.8: Parity (Run/Save/Export/Import)

| Step | Action | Expected | Pass/Fail |
|------|--------|----------|-----------|
| 1 | Build a guided stack and run “Run Flow” | Execution behaves the same as Graph view | ☐ |
| 2 | Save workflow | Save succeeds (requires a name) | ☐ |
| 3 | Export and then Import the workflow | Imported workflow renders correctly in both Guided and Graph views | ☐ |

---

## Test Execution Log

| Date | Tester | Tests Executed | Pass | Fail | Notes |
|------|--------|----------------|------|------|-------|
| 2026-01-19 | Abhinee | Section 5 (TEST-5.1 → TEST-5.8) | 8 | 0 | Completed all Section 5 tests; configuration/UX behaviors confirmed working |
| 2026-01-19 | Abhinee | Section 6 (TEST-6.1 → TEST-6.3) | 3 | 0 | Data Catalog tests completed (Sources, Semantics, drag-from-catalog to canvas) |
| | | | | | |
| | | | | | |

---

## Bug Report Template

### Bug ID: BUG-XXX

| Field | Value |
|-------|-------|
| **Title** | |
| **Severity** | Critical / High / Medium / Low |
| **Test Case** | TEST-X.X |
| **Steps to Reproduce** | 1. ... 2. ... 3. ... |
| **Expected Result** | |
| **Actual Result** | |
| **Screenshot/Recording** | |
| **Browser/Environment** | |
| **Additional Notes** | |

---

## Quick Reference: API Endpoints

For manual API testing (via curl or Postman):

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Health check |
| `/run` | POST | Execute workflow (non-streaming) |
| `/run/stream` | POST | Execute workflow (streaming) |
| `/workflow/list` | GET | List saved workflows |
| `/workflow/save` | POST | Save workflow |
| `/workflow/load/{filename}` | GET | Load workflow |
| `/workflow/{filename}` | DELETE | Delete workflow |
| `/catalog/databases` | GET | List Snowflake databases |
| `/catalog/schemas/{database}` | GET | List schemas |
| `/catalog/objects/{database}/{schema}?type=...` | GET | List objects (tables/views/streams/dynamic tables) |
| `/catalog/sources` | GET | List tables/views |
| `/catalog/semantic-models` | GET | List semantic models |
| `/snowflake/roles` | GET | List roles granted to backend Snowflake user |
| `/snowflake/role` | POST | Switch backend Snowflake role (granted roles only) |
| `/control-tower/overview` | GET | Dashboard stats |
| `/control-tower/agents` | GET | List agents |
| `/control-tower/settings` | GET | Get settings |
| `/control-tower/settings` | POST | Save settings |
| `/audit/logs` | GET | Get audit logs |
| `/templates` | GET | List templates |
| `/tools` | GET | List tools |

---

**End of Test Plans Document**

*Generated for SnowFlow Application Testing*
