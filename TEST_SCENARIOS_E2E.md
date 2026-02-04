# SnowFlow End-to-End Test Scenarios
## Real-World Implementation Journeys

> **These are NOT unit tests.** Each scenario is a complete journey that builds a production-ready agentic workflow, testing multiple features along the way.

---

## How to Use This Document

Each scenario is structured as:
1. **Business Context** - Why someone would build this
2. **Features Covered** - All the features touched
3. **Step-by-Step Journey** - Detailed implementation guide
4. **Verification Checkpoints** - What to verify at each stage
5. **Advanced Configurations** - Fine-tuning options to test

---

# JOURNEY 1: Enterprise Retail Analytics Agent 🛒

## Business Context
You're a retail data analyst at a UK supermarket chain. Leadership wants a natural language interface so anyone can query sales data without writing SQL. The agent needs to:
- Answer questions about sales, margins, products, stores
- Handle follow-up questions
- Be accurate (use semantic model)
- Have guardrails for sensitive data

## Features Covered
- [x] Data Source configuration (table selection, column filtering)
- [x] Semantic Model setup (YAML selection, stage browsing)
- [x] Agent configuration (model, instructions, temperature, guardrails)
- [x] Single Agent orchestration
- [x] Output channel (Snowflake Intelligence)
- [x] Pre-flight validation
- [x] Chat interface
- [x] Execution stats

---

### Phase 1: Data Foundation (10 min)

#### Step 1.1: Start Fresh
| Action | Expected Result | Verify |
|--------|-----------------|--------|
| Open `http://localhost:5174` | App loads | See "SnowFlow" logo |
| Click **New** in left sidebar | Confirmation dialog | "Create new workflow?" |
| Confirm | Canvas clears | Empty guided view |
| Note: If you have unsaved work, save it first | | |

#### Step 1.2: Configure Data Source
| Action | Expected Result | Verify |
|--------|-----------------|--------|
| Click **Data Source** layer | Layer expands | See database dropdown |
| Select Database: `AICOLLEGE` | Schemas load | See schema list |
| Select Schema: `SNOWFLOW_RETAIL` | Tables load | See table list |
| Select Object Type: `View` | Views filter | Fewer options |
| Select Object: `VW_RETAIL_SALES` | Object selected | Name appears in card |
| **ADVANCED:** Click "Show Filters" | Filter options appear | See Columns, Filter, Order By |
| Set Columns: `STORE_NAME, PRODUCT_NAME, TOTAL_SALES, MARGIN_PCT` | Column filter applied | 4 columns listed |
| Set Limit: `10000` | Row limit set | "10000" in field |
| Click elsewhere to close | Settings saved | Card shows config |

**Checkpoint 1:** Data Source card should show:
- ✅ Database: AICOLLEGE
- ✅ Schema: SNOWFLOW_RETAIL
- ✅ Object: VW_RETAIL_SALES
- ✅ Columns: 4 selected
- ✅ Limit: 10000

---

### Phase 2: Semantic Intelligence (10 min)

#### Step 2.1: Configure Semantic Model
| Action | Expected Result | Verify |
|--------|-----------------|--------|
| Click **Semantic Model** layer | Layer expands | See stage dropdown |
| Note: Should auto-inherit DB/Schema | Pre-filled | Same as data source |
| Select Stage: `SEMANTIC_MODELS` | YAML files load | See .yaml files |
| Select YAML: `retail_semantic_model.yaml` | Model selected | Name appears |
| **OPTIONAL:** Click "Preview YAML" | YAML content shown | See dimensions/measures |

**Checkpoint 2:** Semantic Model card should show:
- ✅ Stage: SEMANTIC_MODELS
- ✅ YAML: retail_semantic_model.yaml
- ✅ Connected to Data Source (edge visible in Graph view)

#### Step 2.2: Validate Semantic Model
| Action | Expected Result | Verify |
|--------|-----------------|--------|
| Switch to **Graph** view | Node graph visible | See 3 nodes (Data, Semantic, Agent) |
| Click on Semantic Model node | Properties panel opens | See full path |
| Verify path format | `@AICOLLEGE.SNOWFLOW_RETAIL.SEMANTIC_MODELS/retail_semantic_model.yaml` | Correct format |
| Switch back to **Guided** view | Stack view returns | Layers visible |

---

### Phase 3: Agent Configuration (15 min)

#### Step 3.1: Basic Agent Setup
| Action | Expected Result | Verify |
|--------|-----------------|--------|
| Click **Orchestration** layer | Options appear | See Single/Supervisor/Router |
| Select **Single Agent** | Pill highlights blue | ✅ selected |
| Agent configuration expands | Settings visible | Model dropdown |

#### Step 3.2: Model Selection
| Action | Expected Result | Verify |
|--------|-----------------|--------|
| Click Model dropdown | Models listed | See Snowflake/Meta/Mistral |
| Select `llama3.1-70b` | Model selected | Name in dropdown |
| **WHY:** 70B model is more accurate for analytics | | |

#### Step 3.3: Instructions/System Prompt
| Action | Expected Result | Verify |
|--------|-----------------|--------|
| Find "Instructions" textarea | Empty or default | Large text area |
| Enter detailed instructions: | | |

```
You are a retail analytics expert for a UK supermarket chain.

RULES:
1. Always include units (£ for currency, % for percentages)
2. When comparing periods, calculate % change
3. Round numbers to 2 decimal places
4. If asked about specific products, list top 5 by default
5. For regional questions, always show Scotland, Wales, England breakdown

CONTEXT:
- Data covers Jan 2024 - Present
- Currency is GBP (£)
- Key metrics: TOTAL_SALES, MARGIN_PCT, UNITS_SOLD
- Regions: Scotland, Wales, England, Northern Ireland

RESPONSE FORMAT:
- Lead with the direct answer
- Provide supporting data in bullet points
- Offer follow-up suggestions
```

| Verify instructions saved | Text visible | 10+ lines |

#### Step 3.4: Advanced Parameters
| Action | Expected Result | Verify |
|--------|-----------------|--------|
| Find "Temperature" slider | Default 0.7 | Slider visible |
| Set Temperature: `0.3` | Slider moves | More deterministic |
| **WHY:** Lower temp = more consistent analytics answers | | |
| Find "Max Tokens" | Default 4096 | Number field |
| Set Max Tokens: `2048` | Value set | Faster responses |
| Find "Enable Guardrails" toggle | Off by default | Toggle switch |
| Turn ON Guardrails | Toggle blue | ✅ enabled |
| **WHY:** Prevents agent from exposing raw SQL or sensitive data | | |

**Checkpoint 3:** Agent configuration should show:
- ✅ Model: llama3.1-70b
- ✅ Instructions: Custom (10+ lines)
- ✅ Temperature: 0.3
- ✅ Max Tokens: 2048
- ✅ Guardrails: ON

---

### Phase 4: Output Configuration (5 min)

#### Step 4.1: Select Channel
| Action | Expected Result | Verify |
|--------|-----------------|--------|
| Click **Experience** layer | Channel options | See Snowflake/REST/Slack |
| Select **Snowflake Intelligence** | Pill highlights | ✅ selected |

#### Step 4.2: Complete Setup
| Action | Expected Result | Verify |
|--------|-----------------|--------|
| Click **Complete Setup** | Output node created | Progress: 4/4 |
| See success message | Toast appears | "Agent configured!" |
| Status indicator turns green | Green checkmark | Ready to test |

**Checkpoint 4:** Full flow configured:
- ✅ Progress: 4/4 steps
- ✅ Green status indicator
- ✅ "Test Agent" button enabled

---

### Phase 5: Testing & Validation (15 min)

#### Step 5.1: Pre-flight Validation
| Action | Expected Result | Verify |
|--------|-----------------|--------|
| **Before running:** Try typing without Complete Setup | | |
| If you skipped Step 4.2, expect error | Validation panel | "No output node" |
| Complete the setup properly | | |

#### Step 5.2: Basic Query Test
| Action | Expected Result | Verify |
|--------|-----------------|--------|
| Type in chat: `What are total sales?` | | |
| Press Enter | Execution starts | Spinner visible |
| Wait for response (10-30s) | Agent responds | Number with £ |
| Check execution stats | Stats panel | Time, tokens shown |

**Expected Response Format:**
```
Total sales are £X,XXX,XXX.XX

Key breakdown:
- Scotland: £X.XM
- England: £X.XM
- Wales: £X.XM

Would you like me to break this down by product category or time period?
```

#### Step 5.3: Follow-up Query
| Action | Expected Result | Verify |
|--------|-----------------|--------|
| Type: `Break it down by product category` | | |
| Press Enter | Uses context | Refers to sales |
| Response shows categories | Table or bullets | Food, Beverages, etc. |

#### Step 5.4: Complex Analytical Query
| Action | Expected Result | Verify |
|--------|-----------------|--------|
| Type: `Why did Scotland margin drop compared to last month?` | | |
| Press Enter | Analysis runs | 15-45 seconds |
| Response has comparison | % change shown | "decreased by X%" |
| Response has reasoning | Bullet points | Explains factors |

#### Step 5.5: Edge Case - Guardrails Test
| Action | Expected Result | Verify |
|--------|-----------------|--------|
| Type: `Show me the raw SQL you used` | | |
| Press Enter | Guardrails trigger | Politely refuses |
| Response should NOT show SQL | No SELECT/FROM | Privacy maintained |

**Checkpoint 5:** All queries working:
- ✅ Basic aggregation (total sales)
- ✅ Dimensional breakdown (by category)
- ✅ Time comparison (month over month)
- ✅ Guardrails respected

---

### Phase 6: Verify in Graph View (5 min)

#### Step 6.1: Visual Inspection
| Action | Expected Result | Verify |
|--------|-----------------|--------|
| Switch to **Graph** view | Node graph | See all nodes |
| Count nodes | Should be 4+ | Data, Semantic, Agent, Output |
| Verify edges | Lines connecting | Left to right flow |
| Click on Agent node | Panel opens | See all settings |
| Verify Temperature | 0.3 | As configured |
| Verify Guardrails | ON | As configured |

#### Step 6.2: Save Workflow
| Action | Expected Result | Verify |
|--------|-----------------|--------|
| Click **Save** in sidebar | Save modal | Name field |
| Enter: `Retail Analytics Agent v1` | Name entered | |
| Click Save | Toast success | "Workflow saved" |

---

## Final Checklist - Journey 1

| Category | Feature | Tested? |
|----------|---------|---------|
| Data Source | Database selection | ☐ |
| Data Source | Schema selection | ☐ |
| Data Source | Object type filter | ☐ |
| Data Source | Table/View selection | ☐ |
| Data Source | Column filter | ☐ |
| Data Source | Row limit | ☐ |
| Semantic Model | Stage selection | ☐ |
| Semantic Model | YAML file selection | ☐ |
| Semantic Model | Path validation | ☐ |
| Agent | Model selection | ☐ |
| Agent | Custom instructions | ☐ |
| Agent | Temperature | ☐ |
| Agent | Max tokens | ☐ |
| Agent | Guardrails | ☐ |
| Orchestration | Single Agent mode | ☐ |
| Output | Snowflake Intelligence | ☐ |
| Validation | Pre-flight checks | ☐ |
| Chat | Send query | ☐ |
| Chat | View response | ☐ |
| Chat | Execution stats | ☐ |
| Workflow | Save | ☐ |
| View | Guided → Graph | ☐ |

**Time to complete:** ~60 minutes

---

---

# JOURNEY 2: Multi-Agent Supervisor Flow 🤖🤖🤖

## Business Context
You're building a complex analytics system that needs multiple specialized agents:
- **Sales Agent** - Answers revenue/margin questions
- **Inventory Agent** - Answers stock/supply questions
- **Performance Agent** - Answers KPI/trend questions

A Supervisor orchestrates them, routing questions to the right agent.

## Features Covered
- [x] Multiple agent creation
- [x] Supervisor orchestration setup
- [x] Agent delegation configuration
- [x] Max delegation limits
- [x] Supervisor model selection
- [x] Graph view editing
- [x] Edge management
- [x] Multi-agent testing

---

### Phase 1: Create Base Agents (20 min)

#### Step 1.1: Create Sales Agent
| Action | Expected Result | Verify |
|--------|-----------------|--------|
| Start in **Graph** view | Empty canvas | Pan/zoom works |
| Drag **Agent** from sidebar | Agent node appears | Default name |
| Click on agent | Properties panel | Settings visible |
| Set Name: `Sales Agent` | Label updates | |
| Set Model: `llama3.1-70b` | | |
| Set Instructions: | | |

```
You are the Sales Agent. You ONLY answer questions about:
- Revenue and sales totals
- Margins and profitability
- Regional sales breakdown
- Product sales performance

If asked about inventory or KPIs, respond: "That's not my area. Please ask the Inventory or Performance agent."
```

| Set Temperature: `0.2` | | More focused |

#### Step 1.2: Create Inventory Agent
| Action | Expected Result | Verify |
|--------|-----------------|--------|
| Drag another **Agent** | Second node | Two agents visible |
| Position below first agent | Layout clean | No overlap |
| Set Name: `Inventory Agent` | | |
| Set Model: `llama3.1-70b` | | |
| Set Instructions: | | |

```
You are the Inventory Agent. You ONLY answer questions about:
- Stock levels
- Inventory turnover
- Supply chain status
- Out-of-stock items

If asked about sales or KPIs, respond: "That's not my area. Please ask the Sales or Performance agent."
```

#### Step 1.3: Create Performance Agent
| Action | Expected Result | Verify |
|--------|-----------------|--------|
| Drag third **Agent** | Third node | Three agents |
| Position in triangle layout | | |
| Set Name: `Performance Agent` | | |
| Set Instructions: | | |

```
You are the Performance Agent. You answer questions about:
- KPIs and metrics
- Trends over time
- Comparative analysis
- Forecasts and projections

Use data-driven responses with specific numbers.
```

**Checkpoint 1:** Three distinct agents configured with specialized instructions.

---

### Phase 2: Add Data Layer (10 min)

#### Step 2.1: Add Shared Data Source
| Action | Expected Result | Verify |
|--------|-----------------|--------|
| Drag **Snowflake Source** | Data node | Database icon |
| Configure DB: `AICOLLEGE` | | |
| Configure Schema: `SNOWFLOW_RETAIL` | | |
| Configure View: `VW_RETAIL_SALES` | | |

#### Step 2.2: Add Semantic Model
| Action | Expected Result | Verify |
|--------|-----------------|--------|
| Drag **Semantic Model** | Model node | Document icon |
| Configure Stage: `SEMANTIC_MODELS` | | |
| Configure YAML: `retail_semantic_model.yaml` | | |

#### Step 2.3: Connect Data to Agents
| Action | Expected Result | Verify |
|--------|-----------------|--------|
| Drag edge: Data Source → Semantic Model | Edge created | Line appears |
| Drag edge: Semantic Model → Sales Agent | Edge created | |
| Drag edge: Semantic Model → Inventory Agent | Edge created | |
| Drag edge: Semantic Model → Performance Agent | Edge created | |
| Semantic Model has 3 outgoing edges | Fan-out pattern | |

**Checkpoint 2:** Data flows to all three agents.

---

### Phase 3: Configure Supervisor (15 min)

#### Step 3.1: Add Supervisor Node
| Action | Expected Result | Verify |
|--------|-----------------|--------|
| Drag **Supervisor** from sidebar | Orchestrator node | Special icon |
| Position at center-right | | |
| Click on Supervisor | Properties panel | |

#### Step 3.2: Configure Supervisor
| Action | Expected Result | Verify |
|--------|-----------------|--------|
| Set Name: `Retail Orchestrator` | | |
| Set Model: `llama3.1-70b` | | Use smart model |
| Set System Prompt: | | |

```
You are the Retail Analytics Orchestrator.

Your job is to:
1. Understand the user's question
2. Delegate to the appropriate specialist agent
3. Synthesize responses if multiple agents needed

ROUTING RULES:
- Sales/revenue/margin questions → Sales Agent
- Stock/inventory/supply questions → Inventory Agent  
- KPIs/trends/comparisons → Performance Agent
- Complex questions → May need multiple agents

Always provide a unified response to the user.
```

| Set Max Delegations: `5` | | Prevent loops |

#### Step 3.3: Connect Agents to Supervisor
| Action | Expected Result | Verify |
|--------|-----------------|--------|
| Drag edge: Sales Agent → Supervisor | Edge created | |
| Drag edge: Inventory Agent → Supervisor | Edge created | |
| Drag edge: Performance Agent → Supervisor | Edge created | |
| Supervisor shows 3 connected agents | List in panel | All three named |

---

### Phase 4: Add Output (5 min)

#### Step 4.1: Configure Output
| Action | Expected Result | Verify |
|--------|-----------------|--------|
| Drag **Output** node | Output appears | |
| Connect: Supervisor → Output | Edge created | |
| Set Channel: Snowflake Intelligence | | |

**Checkpoint 3:** Complete graph:
```
Data Source → Semantic Model → [3 Agents] → Supervisor → Output
```

---

### Phase 5: Testing Multi-Agent (20 min)

#### Step 5.1: Sales Question (Routes to Sales Agent)
| Action | Expected Result | Verify |
|--------|-----------------|--------|
| Type: `What are total sales by region?` | | |
| Press Enter | Supervisor routes | |
| Check response | Sales data | Numbers with £ |
| Check execution | "Sales Agent" mentioned | Right agent used |

#### Step 5.2: Inventory Question (Routes to Inventory Agent)
| Action | Expected Result | Verify |
|--------|-----------------|--------|
| Type: `What products are low on stock?` | | |
| Press Enter | Routes correctly | |
| Check response | Inventory info | Stock levels |

#### Step 5.3: Performance Question (Routes to Performance Agent)
| Action | Expected Result | Verify |
|--------|-----------------|--------|
| Type: `What's the sales trend over the last 6 months?` | | |
| Press Enter | Routes correctly | |
| Check response | Trend analysis | % changes |

#### Step 5.4: Complex Question (Multiple Agents)
| Action | Expected Result | Verify |
|--------|-----------------|--------|
| Type: `Compare sales performance to inventory levels - are we overstocked on slow sellers?` | | |
| Press Enter | Supervisor coordinates | |
| Check response | Combined analysis | Both sales + inventory |
| May take longer | 30-60 seconds | Multiple delegations |

**Checkpoint 4:** Supervisor correctly routes to appropriate agents.

---

### Phase 6: Advanced Configuration (10 min)

#### Step 6.1: Test Max Delegations
| Action | Expected Result | Verify |
|--------|-----------------|--------|
| Set Max Delegations: `2` | Lower limit | |
| Ask complex question needing 3 agents | | |
| Supervisor should limit calls | Only 2 agents used | Respects limit |

#### Step 6.2: Edit Agent Mid-Flow
| Action | Expected Result | Verify |
|--------|-----------------|--------|
| Click on Sales Agent | Panel opens | |
| Change Temperature to `0.5` | Updated | |
| Amber banner appears | "Changes pending" | |
| Run query again | Uses new config | |

---

## Final Checklist - Journey 2

| Category | Feature | Tested? |
|----------|---------|---------|
| Graph | Drag and drop nodes | ☐ |
| Graph | Create edges | ☐ |
| Graph | Position nodes | ☐ |
| Multi-Agent | 3+ agents | ☐ |
| Multi-Agent | Specialized instructions | ☐ |
| Supervisor | Model selection | ☐ |
| Supervisor | System prompt | ☐ |
| Supervisor | Max delegations | ☐ |
| Supervisor | Agent connections | ☐ |
| Routing | Sales → Sales Agent | ☐ |
| Routing | Inventory → Inventory Agent | ☐ |
| Routing | Performance → Performance Agent | ☐ |
| Routing | Complex → Multiple agents | ☐ |
| UX | Amber "changes pending" | ☐ |

**Time to complete:** ~80 minutes

---

---

# JOURNEY 3: Intent-Based Router with Custom Routes 🔀

## Business Context
You need a router that intelligently directs questions based on intent, with custom routing rules and fallback behavior.

## Features Covered
- [x] Router orchestration mode
- [x] Custom intent routes
- [x] Fallback agent configuration
- [x] Route testing
- [x] Intent classification

---

### Phase 1: Set Up Router (15 min)

#### Step 1.1: Create Router Node
| Action | Expected Result | Verify |
|--------|-----------------|--------|
| Start in **Graph** view | | |
| Drag **Router** node | Router appears | |
| Click on Router | Properties open | |
| See route configuration | 3 default routes | |

#### Step 1.2: Configure Routes
| Action | Expected Result | Verify |
|--------|-----------------|--------|
| Route 1 - Set Intent: `sales` | | |
| Route 1 - Set Description: `Questions about revenue, sales, transactions` | | |
| Route 2 - Set Intent: `brand` | | |
| Route 2 - Set Description: `Questions about brand awareness, marketing impact` | | |
| Route 3 - Set Intent: `performance` | | |
| Route 3 - Set Description: `Questions about KPIs, metrics, trends` | | |

#### Step 1.3: Create Target Agents
| Action | Expected Result | Verify |
|--------|-----------------|--------|
| Create 3 agents (Sales, Brand, Performance) | 3 agent nodes | |
| Connect Router → Sales Agent (Route 1) | Edge to slot 1 | |
| Connect Router → Brand Agent (Route 2) | Edge to slot 2 | |
| Connect Router → Performance Agent (Route 3) | Edge to slot 3 | |

---

### Phase 2: Test Intent Routing (20 min)

#### Step 2.1: Test Sales Intent
| Action | Expected Result | Verify |
|--------|-----------------|--------|
| Type: `How much revenue did we generate?` | | |
| Router classifies as `sales` | Routes to Sales Agent | |

#### Step 2.2: Test Brand Intent
| Action | Expected Result | Verify |
|--------|-----------------|--------|
| Type: `What is our brand awareness score?` | | |
| Router classifies as `brand` | Routes to Brand Agent | |

#### Step 2.3: Test Ambiguous Query
| Action | Expected Result | Verify |
|--------|-----------------|--------|
| Type: `How are we doing?` | Vague question | |
| Router picks best match | Some agent responds | |
| May route to Performance (KPIs) | | |

---

## Final Checklist - Journey 3

| Category | Feature | Tested? |
|----------|---------|---------|
| Router | Create router node | ☐ |
| Router | Configure intents | ☐ |
| Router | Intent descriptions | ☐ |
| Router | Connect to agents | ☐ |
| Routing | Sales intent | ☐ |
| Routing | Brand intent | ☐ |
| Routing | Performance intent | ☐ |
| Routing | Ambiguous handling | ☐ |

**Time to complete:** ~35 minutes

---

---

# JOURNEY 4: External API Integration 🌐

## Business Context
Your agent needs to call external services - a CRM API, a custom ML model, or a third-party data service.

## Features Covered
- [x] External Agent node
- [x] REST API configuration
- [x] Authentication setup (API Key, OAuth)
- [x] Request/response mapping
- [x] Error handling

---

### Phase 1: Add External Agent (15 min)

#### Step 1.1: Create External Agent
| Action | Expected Result | Verify |
|--------|-----------------|--------|
| Drag **External Agent** from sidebar | Node appears | Cloud icon |
| Click on node | Properties panel | |
| Select Type: `REST API` | Config changes | See endpoint field |

#### Step 1.2: Configure REST Endpoint
| Action | Expected Result | Verify |
|--------|-----------------|--------|
| Set Name: `CRM Lookup` | | |
| Set Endpoint: `https://api.example.com/customers` | URL entered | Valid format |
| Set Method: `POST` | Dropdown | |
| Set Auth Type: `API Key` | Auth fields appear | |
| Set Header Name: `X-API-Key` | | |
| Set API Key: `your-key-here` | Masked | *** shown |

#### Step 1.3: Configure Request Body
| Action | Expected Result | Verify |
|--------|-----------------|--------|
| Set Request Template: | JSON editor | |
```json
{
  "query": "{{user_input}}",
  "limit": 10
}
```
| Variables highlighted | {{user_input}} | Template syntax |

#### Step 1.4: Configure Response Mapping
| Action | Expected Result | Verify |
|--------|-----------------|--------|
| Set Response Path: `$.data.results` | JSONPath | |
| Set to extract specific field | | |

---

### Phase 2: Integrate into Flow (10 min)

#### Step 2.1: Connect External Agent
| Action | Expected Result | Verify |
|--------|-----------------|--------|
| Add Cortex Agent | Local agent | |
| Connect: Data → Cortex Agent → External Agent → Output | Chain | |
| External agent receives context | | |

---

### Phase 3: Test External Call (10 min)

#### Step 3.1: Run Query
| Action | Expected Result | Verify |
|--------|-----------------|--------|
| Type: `Look up customer John Smith` | | |
| Press Enter | External call made | |
| **If API works:** Response shown | Data returned | |
| **If API fails:** Error message | Clear error | "Failed to connect" |
| Verify error handling | App doesn't crash | |

---

## Final Checklist - Journey 4

| Category | Feature | Tested? |
|----------|---------|---------|
| External Agent | Create node | ☐ |
| External Agent | REST type | ☐ |
| Config | Endpoint URL | ☐ |
| Config | HTTP method | ☐ |
| Config | API Key auth | ☐ |
| Config | Request template | ☐ |
| Config | Response mapping | ☐ |
| Integration | Chain with Cortex | ☐ |
| Error | Handle API failure | ☐ |

**Time to complete:** ~35 minutes

---

---

# JOURNEY 5: Full Admin & Governance Setup 🛡️

## Business Context
You're the admin setting up governance, monitoring, and audit capabilities for your SnowFlow deployment.

## Features Covered
- [x] Control Tower access
- [x] Agent registry management
- [x] Audit log review
- [x] Settings configuration
- [x] Governance panel
- [x] Dark/Light mode
- [x] Role-based access

---

### Phase 1: Control Tower Exploration (15 min)

#### Step 1.1: Open Control Tower
| Action | Expected Result | Verify |
|--------|-----------------|--------|
| Click **Control Tower** (bottom left) | Modal opens | Large panel |
| See title "SnowFlow Control Tower" | | |
| See 4 tabs: Overview, Agents, Audit, Settings | Tabs visible | |

#### Step 1.2: Overview Tab
| Action | Expected Result | Verify |
|--------|-----------------|--------|
| Review Overview | Dashboard stats | |
| See total agents | Count number | |
| See total executions | Count | |
| See recent activity | Timeline | |

#### Step 1.3: Agents Tab
| Action | Expected Result | Verify |
|--------|-----------------|--------|
| Click **Agents** tab | Agent list | Table view |
| See registered agents | At least 1 | Names listed |
| See agent status | Active/Inactive | Color indicator |
| See agent type | Cortex/External | Type column |
| Click on an agent | Details expand | Config shown |

#### Step 1.4: Audit Tab
| Action | Expected Result | Verify |
|--------|-----------------|--------|
| Click **Audit** tab | Log entries | |
| See timestamps | Date/time | Recent first |
| See actions | Run/Save/Delete | Action type |
| See user | Who did it | Username |
| See entity | What changed | Agent/Workflow |
| Filter by date | Filter works | Fewer entries |

#### Step 1.5: Settings Tab
| Action | Expected Result | Verify |
|--------|-----------------|--------|
| Click **Settings** tab | Config form | |
| See governance settings | Toggles | |
| Toggle "Require Approval" | Changes | On/Off |
| Save settings | Toast success | |
| Re-open Control Tower | Setting persisted | Still on |

---

### Phase 2: Theme & Preferences (5 min)

#### Step 2.1: Dark Mode
| Action | Expected Result | Verify |
|--------|-----------------|--------|
| Find theme toggle (top right) | Sun/Moon icon | |
| Click to toggle Dark Mode | Theme changes | Dark background |
| All UI elements adapt | Readable | No broken colors |
| Text contrast OK | Can read everything | |

#### Step 2.2: Light Mode
| Action | Expected Result | Verify |
|--------|-----------------|--------|
| Click toggle again | Light theme | White background |
| Verify readability | All visible | |

---

### Phase 3: Snowflake Role Management (10 min)

#### Step 3.1: View Roles
| Action | Expected Result | Verify |
|--------|-----------------|--------|
| Find role dropdown (header area) | Current role shown | |
| Click dropdown | Available roles | List of roles |
| See granted roles | From Snowflake | |

#### Step 3.2: Switch Role
| Action | Expected Result | Verify |
|--------|-----------------|--------|
| Select different role | Role changes | |
| Toast confirms switch | "Role switched" | |
| Data access changes | May see different DBs | Role-based |

---

### Phase 4: Governance Panel in Guided View (10 min)

#### Step 4.1: Access Governance
| Action | Expected Result | Verify |
|--------|-----------------|--------|
| Go to Guided view | Stack visible | |
| Find Governance/Shield icon | Usually in header | |
| Click to open | Panel expands | |

#### Step 4.2: Review Governance Status
| Action | Expected Result | Verify |
|--------|-----------------|--------|
| See governance checklist | Items listed | |
| Red items = issues | Fix needed | |
| Amber = warnings | Review needed | |
| Green = good | Approved | |
| Click "Acknowledge" on warnings | Status changes | Amber → Green |

---

## Final Checklist - Journey 5

| Category | Feature | Tested? |
|----------|---------|---------|
| Control Tower | Open modal | ☐ |
| Control Tower | Overview tab | ☐ |
| Control Tower | Agents tab | ☐ |
| Control Tower | Audit tab | ☐ |
| Control Tower | Settings tab | ☐ |
| Agent Registry | View agents | ☐ |
| Agent Registry | Agent status | ☐ |
| Audit | View log | ☐ |
| Audit | Timestamps | ☐ |
| Audit | Filter | ☐ |
| Settings | Toggle governance | ☐ |
| Settings | Save/persist | ☐ |
| Theme | Dark mode | ☐ |
| Theme | Light mode | ☐ |
| Theme | All elements adapt | ☐ |
| Roles | View roles | ☐ |
| Roles | Switch role | ☐ |
| Governance | View panel | ☐ |
| Governance | Acknowledge | ☐ |

**Time to complete:** ~40 minutes

---

---

# JOURNEY 6: Channel Configuration Deep Dive 📡

## Business Context
You need to deploy the same agent to multiple channels: Snowflake Intelligence, REST API, and Slack.

## Features Covered
- [x] Snowflake Intelligence channel
- [x] REST API endpoint
- [x] Slack configuration
- [x] Teams configuration
- [x] Channel switching

---

### Phase 1: Snowflake Intelligence (5 min)
*Already covered in Journey 1*

### Phase 2: REST API Channel (15 min)

#### Step 2.1: Configure REST Output
| Action | Expected Result | Verify |
|--------|-----------------|--------|
| Complete agent setup (Journey 1) | Agent ready | |
| Click on Output node (Graph view) | Properties open | |
| Change Channel: `REST API` | Config changes | |
| See endpoint configuration | URL field | |
| Set Endpoint Path: `/api/retail-agent` | Path set | |
| See API documentation | Swagger-like | |

#### Step 2.2: Test REST Endpoint
| Action | Expected Result | Verify |
|--------|-----------------|--------|
| Click "Test API Endpoint" | Test modal | |
| Enter test query | Input field | |
| Click Test | Request sent | |
| See JSON response | API format | Status, data |

### Phase 3: Slack Channel (10 min)

#### Step 3.1: Configure Slack
| Action | Expected Result | Verify |
|--------|-----------------|--------|
| Change Channel: `Slack` | Slack config | |
| See Slack-specific fields | Webhook URL, Channel | |
| Note: Test disabled | "Configure in Slack" | Can't test locally |

### Phase 4: Teams Channel (10 min)

#### Step 4.1: Configure Teams
| Action | Expected Result | Verify |
|--------|-----------------|--------|
| Change Channel: `Teams` | Teams config | |
| See Teams-specific fields | | |

---

## Final Checklist - Journey 6

| Category | Feature | Tested? |
|----------|---------|---------|
| Channel | Snowflake Intelligence | ☐ |
| Channel | REST API config | ☐ |
| Channel | REST test | ☐ |
| Channel | Slack config | ☐ |
| Channel | Teams config | ☐ |
| Channel | Switch between | ☐ |

**Time to complete:** ~40 minutes

---

---

# JOURNEY 7: Schema Migration (Power BI to Snowflake) 🔄

## Business Context
You're migrating Power BI semantic models to Snowflake Cortex Analyst YAML format.

## Features Covered
- [x] File Input node (TMDL)
- [x] Schema Extractor
- [x] DAX Translator
- [x] Schema Transformer
- [x] File Output (YAML)
- [x] Migration pipeline

---

### Phase 1: Set Up Migration Pipeline (20 min)

#### Step 1.1: Add File Input
| Action | Expected Result | Verify |
|--------|-----------------|--------|
| Graph view | | |
| Drag **File Input** | Node appears | |
| Select Type: `Power BI TMDL` | | |
| Upload TMDL file | File loaded | Filename shown |

#### Step 1.2: Add Schema Extractor
| Action | Expected Result | Verify |
|--------|-----------------|--------|
| Drag **Schema Extractor** | Node appears | |
| Select Format: `Power BI` | | |
| Connect: File Input → Extractor | Edge | |

#### Step 1.3: Add DAX Translator
| Action | Expected Result | Verify |
|--------|-----------------|--------|
| Drag **DAX Translator** | Node appears | |
| Connect: Extractor → DAX Translator | Edge | |
| Configure model: `llama3.1-70b` | LLM selected | |

#### Step 1.4: Add Schema Transformer
| Action | Expected Result | Verify |
|--------|-----------------|--------|
| Drag **Schema Transformer** | Node appears | |
| Select Target: `Snowflake` | | |
| Connect: DAX Translator → Transformer | Edge | |

#### Step 1.5: Add File Output
| Action | Expected Result | Verify |
|--------|-----------------|--------|
| Drag **File Output** | Node appears | |
| Select Format: `YAML` | | |
| Connect: Transformer → Output | Edge | |

---

### Phase 2: Run Migration (10 min)

#### Step 2.1: Execute Pipeline
| Action | Expected Result | Verify |
|--------|-----------------|--------|
| Click Run/Execute | Pipeline starts | |
| Watch nodes activate | Left to right | |
| See progress | Node highlights | |
| Pipeline completes | All green | |

#### Step 2.2: Download Output
| Action | Expected Result | Verify |
|--------|-----------------|--------|
| Click on File Output | Properties | |
| Click Download | YAML file | |
| Open file | Valid YAML | Dimensions/measures |

---

## Final Checklist - Journey 7

| Category | Feature | Tested? |
|----------|---------|---------|
| File Input | TMDL upload | ☐ |
| Extractor | Power BI parsing | ☐ |
| DAX | Translation | ☐ |
| Transformer | Snowflake format | ☐ |
| File Output | YAML download | ☐ |
| Pipeline | Full execution | ☐ |

**Time to complete:** ~30 minutes

---

---

# Summary: Total Feature Coverage

| Journey | Time | Key Features |
|---------|------|--------------|
| 1. Enterprise Retail Agent | 60 min | Data, Semantic, Agent config, Testing |
| 2. Multi-Agent Supervisor | 80 min | Multiple agents, Supervisor, Routing |
| 3. Intent Router | 35 min | Router, Custom intents |
| 4. External API | 35 min | External agent, REST, Auth |
| 5. Admin & Governance | 40 min | Control Tower, Audit, Settings |
| 6. Channel Deep Dive | 40 min | REST, Slack, Teams |
| 7. Schema Migration | 30 min | File I/O, DAX, Transformer |

**Total Time:** ~5-6 hours for complete coverage
**Total Features:** 67 unique features tested

---

## Execution Tracking

| Journey | Status | Tester | Date | Notes |
|---------|--------|--------|------|-------|
| Journey 1 | ☐ | | | |
| Journey 2 | ☐ | | | |
| Journey 3 | ☐ | | | |
| Journey 4 | ☐ | | | |
| Journey 5 | ☐ | | | |
| Journey 6 | ☐ | | | |
| Journey 7 | ☐ | | | |
