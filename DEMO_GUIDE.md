# SnowFlow Demo Guide

## Demo Overview

**Audience:** Snowflake Product Teams (internal PoC)  
**Duration:** 10-15 minutes  
**Goal:** Show "art of the possible" - guided low-code UI for Snowflake Intelligence

---

## Pre-Demo Checklist

### 1. Start the Services
```bash
# Terminal 1: Backend
cd /Users/abhineetasthana/snowflow/backend
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000

# Terminal 2: Frontend  
cd /Users/abhineetasthana/snowflow/frontend
npm run dev
```

### 2. Verify Snowflake Connection
- Open http://localhost:5174
- Click **Catalog** tab → Should show real tables from Snowflake
- If empty/error, check `.env` credentials

### 3. Clear Canvas
- Click the **X** button to start fresh

---

## Demo Script

### ACT 1: The Problem (1 min)

> "Today, building a Snowflake Intelligence agent requires writing code, understanding LangGraph, configuring Cortex APIs manually. Business users can't do this themselves, and IT teams become bottlenecks."

### ACT 2: SnowFlow Introduction (1 min)

> "SnowFlow is a visual workflow builder for Snowflake Intelligence. Drag, drop, connect - and you have a working agent."

**Show:**
- The guided lanes on canvas (Data Sources → Semantic Model → Agent → Output)
- The component library in sidebar
- The Build Mode indicator

---

### ACT 3: Build a Simple Agent (3 min)

**Scenario:** Customer feedback analysis

1. **Click "Catalog" tab**
   > "First, I browse our approved data sources. These come directly from Snowflake."

2. **Drag CUSTOMER_FEEDBACK to canvas**
   > "I see which tables have semantic models ready, which need setup."

3. **Drag a Cortex Agent from sidebar**
   > "Now I add an AI agent. This wraps Cortex LLM."

4. **Click on Agent → Configure:**
   - Model: `mistral-large2`
   - System Prompt: `Analyze customer feedback. Identify sentiment, top issues, and suggest improvements.`
   
5. **Connect Data Source → Agent**
   > "Notice the animated connector - we're in Build Mode."

6. **Add Output node, connect Agent → Output**

7. **Click Run**
   > "SnowFlow translates this visual graph into a LangGraph workflow, executes against Snowflake Cortex, and returns results."

8. **Show results panel**

---

### ACT 4: Templates - One-Click Deployment (2 min)

1. **Click X to clear canvas**

2. **Click "Templates" tab**
   > "For common patterns, we have pre-built templates. IT-approved, governance-ready."

3. **Click "Sales Q&A Bot" template**
   > "One click - entire workflow loads. Data source, semantic model, agent with Cortex Analyst tool configured."

4. **Click "Test Agent" button**
   > "I can test the agent right here while building."

5. **Type:** "What were our top 3 products last quarter?"
   > "This goes to Snowflake Cortex in real-time."

---

### ACT 5: Multi-Agent Orchestration (3 min)

1. **Clear canvas, go to Templates**

2. **Select "Multi-Agent Support Router"**
   > "Now here's where it gets interesting. Complex workflows need multiple agents."

3. **Show the Router node**
   > "This Router classifies incoming requests by intent - Sales, Support, or Billing - and routes to specialized agents."

4. **Click on Router → Show configuration**
   - Routing strategy: Intent Classification
   - Routes configured

5. **Show animated connections**
   > "Each path is a different agent. The system intelligently routes."

6. **Toggle to "Live Mode"**
   > "In production, connections become solid - visual distinction between dev and prod."

---

### ACT 6: Governance & Control Tower (2 min)

1. **Click "Control Tower" button**
   > "For IT admins, we have the Control Tower. This is your governance hub."

2. **Show Overview tab**
   - Total workflows, active agents, custom tools
   - Template usage

3. **Show Audit Log tab**
   > "Every action is logged to Snowflake. Who built what, when it ran, what data was accessed."

4. **Close Control Tower**

---

### ACT 7: Portability (1 min)

1. **Click Download button**
   > "Workflows are exportable as JSON. Version control, share with colleagues, import into other environments."

2. **Click Save → Check "Save as Template"**
   > "Or save as a template for others to reuse."

---

### ACT 8: Wrap Up (1 min)

> "SnowFlow bridges the gap between Snowflake Intelligence capabilities and business users. IT sets up the building blocks - approved data sources, semantic models, custom tools. Business users assemble them visually. Everyone wins."

**Key takeaways:**
- No code required for business users
- Full governance and audit trail for IT
- Native Snowflake - runs on Cortex, stores in Snowflake tables
- Multi-agent orchestration built-in

---

## Demo Data Setup

If you need fresh demo data, run:

```bash
cd /Users/abhineetasthana/snowflow/backend
source venv/bin/activate
python run_setup_tables.py
```

This creates:
- `SNOWFLOW_TOOLS` - Custom tool definitions
- `SNOWFLOW_TEMPLATES` - Workflow templates
- `SNOWFLOW_AUDIT_LOG` - Governance trail

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Catalog empty | Check Snowflake credentials in `backend/.env` |
| Run fails | Check backend terminal for errors |
| Blank page | Run `npm run dev` in frontend folder |
| Port in use | `lsof -ti:8000 | xargs kill -9` then restart |

---

## Talking Points for Q&A

**Q: Is this production-ready?**
> "This is a PoC to explore the art of the possible. The architecture is sound - FastAPI backend, React frontend, LangGraph orchestration. Production would need auth, proper error handling, deployment pipeline."

**Q: How does it compare to other low-code tools?**
> "SnowFlow is native to Snowflake. It speaks Cortex, understands semantic models, stores everything in Snowflake tables. No external dependencies."

**Q: What about security?**
> "All data stays in Snowflake. The UI just orchestrates - actual processing happens in Cortex. Audit logs capture everything."

**Q: Can it handle complex workflows?**
> "We have Router for intent-based branching, Supervisor for delegation patterns. The multi-agent templates demonstrate this."

---

## Files Reference

| File | Purpose |
|------|---------|
| `SESSION_LOG.md` | Development history |
| `BACKLOG.md` | Feature backlog |
| `ARCHITECTURE.md` | System design |
| `DEMO_GUIDE.md` | This file |



## Demo Overview

**Audience:** Snowflake Product Teams (internal PoC)  
**Duration:** 10-15 minutes  
**Goal:** Show "art of the possible" - guided low-code UI for Snowflake Intelligence

---

## Pre-Demo Checklist

### 1. Start the Services
```bash
# Terminal 1: Backend
cd /Users/abhineetasthana/snowflow/backend
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000

# Terminal 2: Frontend  
cd /Users/abhineetasthana/snowflow/frontend
npm run dev
```

### 2. Verify Snowflake Connection
- Open http://localhost:5174
- Click **Catalog** tab → Should show real tables from Snowflake
- If empty/error, check `.env` credentials

### 3. Clear Canvas
- Click the **X** button to start fresh

---

## Demo Script

### ACT 1: The Problem (1 min)

> "Today, building a Snowflake Intelligence agent requires writing code, understanding LangGraph, configuring Cortex APIs manually. Business users can't do this themselves, and IT teams become bottlenecks."

### ACT 2: SnowFlow Introduction (1 min)

> "SnowFlow is a visual workflow builder for Snowflake Intelligence. Drag, drop, connect - and you have a working agent."

**Show:**
- The guided lanes on canvas (Data Sources → Semantic Model → Agent → Output)
- The component library in sidebar
- The Build Mode indicator

---

### ACT 3: Build a Simple Agent (3 min)

**Scenario:** Customer feedback analysis

1. **Click "Catalog" tab**
   > "First, I browse our approved data sources. These come directly from Snowflake."

2. **Drag CUSTOMER_FEEDBACK to canvas**
   > "I see which tables have semantic models ready, which need setup."

3. **Drag a Cortex Agent from sidebar**
   > "Now I add an AI agent. This wraps Cortex LLM."

4. **Click on Agent → Configure:**
   - Model: `mistral-large2`
   - System Prompt: `Analyze customer feedback. Identify sentiment, top issues, and suggest improvements.`
   
5. **Connect Data Source → Agent**
   > "Notice the animated connector - we're in Build Mode."

6. **Add Output node, connect Agent → Output**

7. **Click Run**
   > "SnowFlow translates this visual graph into a LangGraph workflow, executes against Snowflake Cortex, and returns results."

8. **Show results panel**

---

### ACT 4: Templates - One-Click Deployment (2 min)

1. **Click X to clear canvas**

2. **Click "Templates" tab**
   > "For common patterns, we have pre-built templates. IT-approved, governance-ready."

3. **Click "Sales Q&A Bot" template**
   > "One click - entire workflow loads. Data source, semantic model, agent with Cortex Analyst tool configured."

4. **Click "Test Agent" button**
   > "I can test the agent right here while building."

5. **Type:** "What were our top 3 products last quarter?"
   > "This goes to Snowflake Cortex in real-time."

---

### ACT 5: Multi-Agent Orchestration (3 min)

1. **Clear canvas, go to Templates**

2. **Select "Multi-Agent Support Router"**
   > "Now here's where it gets interesting. Complex workflows need multiple agents."

3. **Show the Router node**
   > "This Router classifies incoming requests by intent - Sales, Support, or Billing - and routes to specialized agents."

4. **Click on Router → Show configuration**
   - Routing strategy: Intent Classification
   - Routes configured

5. **Show animated connections**
   > "Each path is a different agent. The system intelligently routes."

6. **Toggle to "Live Mode"**
   > "In production, connections become solid - visual distinction between dev and prod."

---

### ACT 6: Governance & Control Tower (2 min)

1. **Click "Control Tower" button**
   > "For IT admins, we have the Control Tower. This is your governance hub."

2. **Show Overview tab**
   - Total workflows, active agents, custom tools
   - Template usage

3. **Show Audit Log tab**
   > "Every action is logged to Snowflake. Who built what, when it ran, what data was accessed."

4. **Close Control Tower**

---

### ACT 7: Portability (1 min)

1. **Click Download button**
   > "Workflows are exportable as JSON. Version control, share with colleagues, import into other environments."

2. **Click Save → Check "Save as Template"**
   > "Or save as a template for others to reuse."

---

### ACT 8: Wrap Up (1 min)

> "SnowFlow bridges the gap between Snowflake Intelligence capabilities and business users. IT sets up the building blocks - approved data sources, semantic models, custom tools. Business users assemble them visually. Everyone wins."

**Key takeaways:**
- No code required for business users
- Full governance and audit trail for IT
- Native Snowflake - runs on Cortex, stores in Snowflake tables
- Multi-agent orchestration built-in

---

## Demo Data Setup

If you need fresh demo data, run:

```bash
cd /Users/abhineetasthana/snowflow/backend
source venv/bin/activate
python run_setup_tables.py
```

This creates:
- `SNOWFLOW_TOOLS` - Custom tool definitions
- `SNOWFLOW_TEMPLATES` - Workflow templates
- `SNOWFLOW_AUDIT_LOG` - Governance trail

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Catalog empty | Check Snowflake credentials in `backend/.env` |
| Run fails | Check backend terminal for errors |
| Blank page | Run `npm run dev` in frontend folder |
| Port in use | `lsof -ti:8000 | xargs kill -9` then restart |

---

## Talking Points for Q&A

**Q: Is this production-ready?**
> "This is a PoC to explore the art of the possible. The architecture is sound - FastAPI backend, React frontend, LangGraph orchestration. Production would need auth, proper error handling, deployment pipeline."

**Q: How does it compare to other low-code tools?**
> "SnowFlow is native to Snowflake. It speaks Cortex, understands semantic models, stores everything in Snowflake tables. No external dependencies."

**Q: What about security?**
> "All data stays in Snowflake. The UI just orchestrates - actual processing happens in Cortex. Audit logs capture everything."

**Q: Can it handle complex workflows?**
> "We have Router for intent-based branching, Supervisor for delegation patterns. The multi-agent templates demonstrate this."

---

## Files Reference

| File | Purpose |
|------|---------|
| `SESSION_LOG.md` | Development history |
| `BACKLOG.md` | Feature backlog |
| `ARCHITECTURE.md` | System design |
| `DEMO_GUIDE.md` | This file |












