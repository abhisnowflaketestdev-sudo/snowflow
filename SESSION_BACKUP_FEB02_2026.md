# SnowFlow Session Backup - February 2, 2026

> **Purpose:** Comprehensive backup of session progress. Read this if AI loses memory.

---

## Session Summary

**Date:** January 29 - February 2, 2026  
**Focus:** Chat UI Redesign, Testing Industry Scenarios, Bug Fixes

---

## Major Accomplishments

### 1. Chat UI Redesign (App.tsx)

**Changes:**
- Renamed "Results" panel to "Agent Chat"
- Added scrollable chat history with user/assistant messages
- Moved Copy/Download buttons to chat header
- Added JSON download option (separate from text download)
- Chat input field at bottom (executes directly, no modal popup)
- Independent stats panel collapse (separate from chat)
- Dark mode contrast fixes for stats panel

**Key Code Changes:**
- `chatInput` state for direct query input
- `runWorkflow()` now called directly from chat input (no `setShowRunModal`)
- `statsExpanded` state for independent stats panel control
- Added `FileText` icon for text download, `Download` icon for JSON

### 2. Workflow Naming & Registry (store.ts)

**New Features:**
- `workflowId`: Unique ID for each workflow (auto-generated)
- `WorkflowRegistryEntry` interface for saved workflows
- `getWorkflowsRegistry()`: Get all saved workflows (for agent selector)
- `updateWorkflowRegistry()`: Auto-updates registry on save
- Registry keeps last 20 workflows sorted by last modified

**Status:** Name prompt temporarily disabled (caused blank page crash due to closure bug)

### 3. Agent Selector Dropdown

- Shows in Graph Canvas when multiple agents present
- Allows selecting which agent to test
- Populates from workflow registry (future)

### 4. Bug Fixes

| Bug | Fix | File |
|-----|-----|------|
| Modal popup on chat input | Changed to direct `runWorkflow()` call | App.tsx |
| Orchestration pill flicker | Fixed useEffect to only reset on execStatus CHANGE | GuidedStackCanvas.tsx |
| Blank page on prompt submit | Disabled name prompt temporarily | App.tsx |
| Dark mode stats unreadable | Changed hardcoded colors to CSS variables | App.tsx |

### 5. Testing Progress

**Retail Scenarios (R1-R6):** ✅ ALL PASSED
- R1: Basic sales questions
- R2: Intermediate analytics
- R3: Advanced diagnostic queries
- R4: Orchestration modes (Single, Supervisor, Router)
- R5: Experience channels (SI, REST API, Slack, Teams)
- R6: Data source changes

**Ad/Media Scenarios (A1-A4):** ✅ ALL PASSED
- A1: Basic campaign questions (spend, ROAS, impressions, top advertisers)
- A2: Intermediate performance (CTR, CPA, creative format, audience, geo)
- A3: Advanced analysis (budget optimization, underperforming campaigns, channel mix, WoW)
- A4: Multi-agent (Supervisor review, Router intent detection)

---

## Pending TODOs

| ID | Task | Status |
|----|------|--------|
| workflow-naming | Re-implement workflow naming prompt (fix closure bug) | Pending |
| file-system-mgmt | Workflow persistence in Snowflake (not local filesystem) | Pending |
| agent-selector-registry | Populate agent selector from saved workflows | Pending |
| draft-indicator | Show DRAFT badge for unsaved workflows | Pending |
| external-agent-integration | Connect to Salesforce/Slack/custom APIs via Cortex Agent | Pending |

---

## Snowflake Assets

### Retail (SNOWFLOW_RETAIL)
- **Data Source:** VW_SALES_DATA or similar
- **Semantic Model:** `tmpz1nsfkp6_semantic_model_retail.yaml`

### Ad/Media (SNOWFLOW_AD_MEDIA)
- **Data Source:** `VW_AD_PERFORMANCE`
- **Semantic Model:** `tmp90wnwnyn_semantic_model_ad_media.yaml` (5KB - full model)
- **Tables:** DIM_ADVERTISER, DIM_AUDIENCE, DIM_CAMPAIGN, DIM_CHANNEL, DIM_CREATIVE, DIM_GEO, FACT_AD_PERFORMANCE

---

## Git Commits (This Session)

```
af33a39 fix: Disable name prompt temporarily to fix blank page crash
0e39fdc fix: Orchestration pill flicker - only reset unsaved on exec status CHANGE
ba2c393 feat: Workflow naming with ID tracking and registry
3a9c79f fix: Closure bug causing blank page on prompt submit
176c139 fix: Direct chat execution, JSON download, agent selector
f90ac4c feat: Add chat input field and move copy/download to header
f305ab6 fix: Dark mode contrast for stats panel text
```

---

## How to Run

**Backend:**
```bash
cd /Users/abhineetasthana/snowflow/backend
source venv/bin/activate
uvicorn main:app --reload --port 8000
```

**Frontend:**
```bash
cd /Users/abhineetasthana/snowflow/frontend
npm run dev -- --port 5174
```

**URLs:**
- Frontend: http://localhost:5174
- Backend: http://localhost:8000
- Health: http://localhost:8000/health
- Connection: http://localhost:8000/connection/status

---

## Key Files Modified

| File | Changes |
|------|---------|
| `frontend/src/App.tsx` | Chat UI redesign, agent selector, stats panel |
| `frontend/src/store.ts` | Workflow ID, registry, persistence |
| `frontend/src/components/GuidedStackCanvas.tsx` | Orchestration pill flicker fix |

---

## User Preferences (Reminder)

- Direct action > excessive confirmation
- No sycophancy, be critical when needed
- Lean, simple solutions that work 100% of the time
- Workflows will be stored in Snowflake (not local filesystem) in the future
- Keep session logs and backups updated

---

*Last Updated: 2026-02-02*
