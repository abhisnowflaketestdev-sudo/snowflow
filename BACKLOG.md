# SnowFlow Feature Backlog

## Priority Legend
- 🔴 **P0 - Must Have** → Required for MVP demo
- 🟡 **P1 - Should Have** → Significantly improves demo impact
- 🟢 **P2 - Nice to Have** → Polish, can skip for MVP
- ⚪ **P3 - Future** → Post-demo roadmap

---

## Current Backlog

### 📊 Demo Data ✅ DONE

| Feature | Priority | Effort | Status |
|---------|----------|--------|--------|
| **Create sample retail data** | 🟡 P1 | 2 hrs | ✅ Done - RETAIL_DEMO schema |
| Populate with realistic grocery data | 🟡 P1 | 1 hr | ✅ Done - Scotland margin scenario |
| Wire up to multi-domain template | 🟡 P1 | 1 hr | ✅ Done - Agent prompts updated |

### 🎬 Real-Time Flow Visualization (NEW)

| Feature | Priority | Effort | Notes |
|---------|----------|--------|-------|
| **Real-time edge tracing** | 🔴 P0 | 3 hrs | Edges glow/pulse as messages flow through |
| Active node highlighting | 🔴 P0 | 1 hr | Current node glows during execution |
| Read-only mode during run | 🟡 P1 | 1 hr | Properties greyed out, canvas frozen |
| Execution progress indicator | 🟡 P1 | 1 hr | Show which step we're on |

### 🔗 Flow Composability & APIs (NEW)

| Feature | Priority | Effort | Notes |
|---------|----------|--------|-------|
| **API endpoints for flows** | 🔴 P0 | 4 hrs | POST /api/flows/{id}/run - Make flows callable |
| Flow-to-flow calls | 🟡 P1 | 3 hrs | One flow can invoke another as a step |
| Multiple concurrent flows | 🟡 P1 | 4 hrs | Run multiple flows, monitor in Control Tower |
| Flow sharing/discovery | 🟢 P2 | 3 hrs | Share flows with team, browse catalog |
| Flow versioning | 🟢 P2 | 2 hrs | Track changes, rollback |

### Data & Governance

| Feature | Priority | Effort | Notes |
|---------|----------|--------|-------|
| Horizon Catalog Integration (tags, policies, lineage) | 🟢 P2 | 2-3 hrs | Nice for governance story, not critical for core demo |
| Data Quality indicators | 🟢 P2 | 1 hr | Show freshness, completeness scores |
| Row-level access policy display | 🟢 P2 | 1 hr | Show what policies apply |
| Semantic Model auto-detection | 🟡 P1 | 2 hrs | Detect if table has semantic model defined |

### Agent Builder

| Feature | Priority | Effort | Notes |
|---------|----------|--------|-------|
| Python tool execution (sandboxed) | 🟢 P2 | 3 hrs | Currently stores code but doesn't execute |
| API tool execution | 🟢 P2 | 1 hr | Make HTTP calls for API-type tools |
| Tool testing UI | 🟢 P2 | 2 hrs | Test tool before adding to agent |
| Agent versioning | ⚪ P3 | 3 hrs | Track changes to agent configs |

### Multi-Agent (Stage 4) ✅ DONE

| Feature | Priority | Effort | Status |
|---------|----------|--------|--------|
| Agent-to-agent routing | 🟡 P1 | 4 hrs | ✅ Done - Router + conditional edges |
| Supervisor agent pattern | 🟡 P1 | 3 hrs | ✅ Done - Supervisor node |
| Agent handoff visualization | 🟡 P1 | 2 hrs | ✅ Done - Animated edges |
| Parallel agent execution | 🟢 P2 | 2 hrs | ⏳ Partial - needs refinement |
| **External agent routing** | 🟡 P1 | 4 hrs | ✅ Done - Copilot, OpenAI, etc. |

### Governance / Control Tower (Stage 5)

| Feature | Priority | Effort | Notes |
|---------|----------|--------|-------|
| Admin dashboard | 🟡 P1 | 4 hrs | Overview of all agents, usage |
| Usage metrics | 🟡 P1 | 2 hrs | Calls, tokens, latency |
| Agent approval workflow | 🟢 P2 | 3 hrs | IT approves before production |
| Cost tracking | 🟢 P2 | 2 hrs | Credit consumption per agent |
| Audit log viewer | 🟢 P2 | 1 hr | UI for SNOWFLOW_AUDIT_LOG |

### 🚀 Flow Composability & API-fication (NEW)

| Feature | Priority | Effort | Notes |
|---------|----------|--------|-------|
| **REST API endpoints per flow** | 🟡 P1 | 6 hrs | `/api/flows/{flow_id}/execute` - make flows callable as APIs |
| **Flow-to-flow composition** | 🟡 P1 | 8 hrs | One flow calls another as a node type |
| **Concurrent flow execution** | 🟢 P2 | 6 hrs | Run multiple flows simultaneously, track in Control Tower |
| **Flow versioning & rollback** | 🟢 P2 | 4 hrs | Version each flow, rollback to previous |
| **Flow marketplace/discovery** | 🟢 P2 | 6 hrs | Browse, search, clone flows from catalog |
| **Auto-generate OpenAPI spec** | 🟢 P2 | 3 hrs | `/api/flows/{id}/openapi.json` for each flow |
| **Rate limiting per flow** | 🟢 P2 | 2 hrs | Prevent abuse of flow APIs |
| **API key management** | 🟡 P1 | 4 hrs | Generate keys to call flow APIs |

**Vision:** Treat workflows as **API products**. Business analysts build flows → IT publishes as REST APIs → Apps consume them.

**Example:**
```bash
curl -X POST https://snowflow.acme.com/api/flows/margin-analyzer/execute \
  -H "X-API-Key: sk_live_..." \
  -d '{"prompt": "Why did margin drop in Scotland?"}'
```

### Production Ready (Stage 6)

| Feature | Priority | Effort | Notes |
|---------|----------|--------|-------|
| GitHub integration | 🟢 P2 | 3 hrs | Version control for workflows |
| Export as YAML/JSON | 🟡 P1 | 1 hr | Portable workflow definitions |
| Import workflows | 🟡 P1 | 1 hr | Load from file |
| Snowflake Native App packaging | ⚪ P3 | 8 hrs | Deploy as Native App |

### UI Polish

| Feature | Priority | Effort | Notes |
|---------|----------|--------|-------|
| Keyboard shortcuts | 🟢 P2 | 1 hr | Cmd+S, Delete, etc. |
| Undo/Redo | 🟢 P2 | 2 hrs | Track canvas changes |
| Zoom controls | 🟢 P2 | 30 min | Fit to screen, zoom slider |
| Dark mode | ⚪ P3 | 2 hrs | Alternative theme |
| Mobile responsive | ⚪ P3 | 4 hrs | Tablet support |

### Architecture / Distribution

| Feature | Priority | Effort | Notes |
|---------|----------|--------|-------|
| Login/Connect page | 🔴 P0 | 3 hrs | Welcome page with "Connect to Snowflake" |
| Session management | 🔴 P0 | 4 hrs | JWT tokens, session state |
| Multi-tenant connections | 🔴 P0 | 4 hrs | Connect to ANY Snowflake account |
| API versioning (/api/v1) | 🟡 P1 | 2 hrs | Future-proof API structure |
| Connection manager | 🟡 P1 | 3 hrs | Pool connections per session |
| Docker packaging | 🟡 P1 | 2 hrs | Dockerfile + compose |
| Snowflake OAuth | 🟢 P2 | 4 hrs | Proper OAuth flow |
| Snowflake Native App | ⚪ P3 | 8 hrs | Package as Native App |

### 🔐 Agent Gateway & Security (CRITICAL FOR PRODUCTION)

> **Why:** When orchestrating external agents (Copilot, OpenAI, Salesforce), we NEED a secure gateway. This is non-negotiable for enterprise deployment.

| Feature | Priority | Effort | Notes |
|---------|----------|--------|-------|
| **Agent Gateway Service** | 🔴 P0 | 8 hrs | Central proxy for ALL external agent calls |
| Secret Management | 🔴 P0 | 4 hrs | Vault/Secrets Manager for API keys, OAuth tokens |
| OAuth Token Management | 🔴 P0 | 6 hrs | Auto-refresh for Copilot, Salesforce tokens |
| Request/Response Logging | 🔴 P0 | 2 hrs | Full audit trail of agent communications |
| Data Loss Prevention (DLP) | 🟡 P1 | 6 hrs | Scan outbound payloads for PII/sensitive data |
| Rate Limiting | 🟡 P1 | 2 hrs | Per-agent, per-user, per-org limits |
| Policy Engine | 🟡 P1 | 8 hrs | Rules: what data → which agents |
| Agent Allowlist | 🟡 P1 | 2 hrs | IT controls approved external agents |
| Payload Sanitization | 🟢 P2 | 4 hrs | Strip sensitive fields before sending |
| Response Validation | 🟢 P2 | 3 hrs | Validate/sanitize inbound responses |
| Cost Controls | 🟢 P2 | 3 hrs | Budget limits per agent/user |
| Circuit Breaker | 🟢 P2 | 2 hrs | Auto-disable failing agents |

**Snowflake Native Options to Explore:**
- `EXTERNAL ACCESS INTEGRATION` - Call external APIs from Snowflake
- `NETWORK RULES` - IP allowlisting
- `SECRETS` - Store API keys in Snowflake
- Check if Snowflake has an Agent Gateway on roadmap

**Architecture Vision:**
```
SnowFlow UI
     │
     ▼
┌────────────────────────────────────────┐
│         AGENT GATEWAY                  │
│  ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │ Secrets  │ │ Policy   │ │  DLP   │ │
│  └──────────┘ └──────────┘ └────────┘ │
│  ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │Rate Limit│ │Audit Log │ │  Cost  │ │
│  └──────────┘ └──────────┘ └────────┘ │
└────┬──────────┬──────────┬──────────┬─┘
     │          │          │          │
     ▼          ▼          ▼          ▼
  Copilot   OpenAI   Salesforce  ServiceNow
```

---

## Completed ✅

- [x] Canvas with drag-drop nodes
- [x] All Snowflake node types (Table, View, Dynamic Table, Stream)
- [x] Cortex Agent with tools (Analyst, Search, MCP, SQL)
- [x] Connection validation rules
- [x] Data Catalog (basic, from INFORMATION_SCHEMA)
- [x] Templates (stored in Snowflake)
- [x] Custom Tool Creator (stored in Snowflake)
- [x] Live Preview chat
- [x] Save/Load workflows
- [x] Save as Template
- [x] Toast notifications
- [x] Audit logging
- [x] **Multi-Agent Routing** - Router node with LLM intent classification
- [x] **Supervisor Pattern** - Delegate to child agents, aggregate results
- [x] **External Agent Integration** - Copilot, OpenAI, Salesforce, ServiceNow presets
- [x] **Hybrid Orchestration** - Route to Snowflake OR external agents
- [x] Build/Live mode toggle with canvas locking

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2024-11-28 | Park Horizon integration | Basic catalog sufficient for MVP demo |
| 2024-11-28 | Add Agent Gateway to backlog | External agent orchestration requires security layer - non-negotiable for prod |
| 2024-11-28 | Support external agents (Copilot, OpenAI) | Enable hybrid cloud orchestration for enterprise use cases |

---

*Last updated: 2024-11-28*


## Priority Legend
- 🔴 **P0 - Must Have** → Required for MVP demo
- 🟡 **P1 - Should Have** → Significantly improves demo impact
- 🟢 **P2 - Nice to Have** → Polish, can skip for MVP
- ⚪ **P3 - Future** → Post-demo roadmap

---

## Current Backlog

### 📊 Demo Data ✅ DONE

| Feature | Priority | Effort | Status |
|---------|----------|--------|--------|
| **Create sample retail data** | 🟡 P1 | 2 hrs | ✅ Done - RETAIL_DEMO schema |
| Populate with realistic grocery data | 🟡 P1 | 1 hr | ✅ Done - Scotland margin scenario |
| Wire up to multi-domain template | 🟡 P1 | 1 hr | ✅ Done - Agent prompts updated |

### 🎬 Real-Time Flow Visualization (NEW)

| Feature | Priority | Effort | Notes |
|---------|----------|--------|-------|
| **Real-time edge tracing** | 🔴 P0 | 3 hrs | Edges glow/pulse as messages flow through |
| Active node highlighting | 🔴 P0 | 1 hr | Current node glows during execution |
| Read-only mode during run | 🟡 P1 | 1 hr | Properties greyed out, canvas frozen |
| Execution progress indicator | 🟡 P1 | 1 hr | Show which step we're on |

### 🔗 Flow Composability & APIs (NEW)

| Feature | Priority | Effort | Notes |
|---------|----------|--------|-------|
| **API endpoints for flows** | 🔴 P0 | 4 hrs | POST /api/flows/{id}/run - Make flows callable |
| Flow-to-flow calls | 🟡 P1 | 3 hrs | One flow can invoke another as a step |
| Multiple concurrent flows | 🟡 P1 | 4 hrs | Run multiple flows, monitor in Control Tower |
| Flow sharing/discovery | 🟢 P2 | 3 hrs | Share flows with team, browse catalog |
| Flow versioning | 🟢 P2 | 2 hrs | Track changes, rollback |

### Data & Governance

| Feature | Priority | Effort | Notes |
|---------|----------|--------|-------|
| Horizon Catalog Integration (tags, policies, lineage) | 🟢 P2 | 2-3 hrs | Nice for governance story, not critical for core demo |
| Data Quality indicators | 🟢 P2 | 1 hr | Show freshness, completeness scores |
| Row-level access policy display | 🟢 P2 | 1 hr | Show what policies apply |
| Semantic Model auto-detection | 🟡 P1 | 2 hrs | Detect if table has semantic model defined |

### Agent Builder

| Feature | Priority | Effort | Notes |
|---------|----------|--------|-------|
| Python tool execution (sandboxed) | 🟢 P2 | 3 hrs | Currently stores code but doesn't execute |
| API tool execution | 🟢 P2 | 1 hr | Make HTTP calls for API-type tools |
| Tool testing UI | 🟢 P2 | 2 hrs | Test tool before adding to agent |
| Agent versioning | ⚪ P3 | 3 hrs | Track changes to agent configs |

### Multi-Agent (Stage 4) ✅ DONE

| Feature | Priority | Effort | Status |
|---------|----------|--------|--------|
| Agent-to-agent routing | 🟡 P1 | 4 hrs | ✅ Done - Router + conditional edges |
| Supervisor agent pattern | 🟡 P1 | 3 hrs | ✅ Done - Supervisor node |
| Agent handoff visualization | 🟡 P1 | 2 hrs | ✅ Done - Animated edges |
| Parallel agent execution | 🟢 P2 | 2 hrs | ⏳ Partial - needs refinement |
| **External agent routing** | 🟡 P1 | 4 hrs | ✅ Done - Copilot, OpenAI, etc. |

### Governance / Control Tower (Stage 5)

| Feature | Priority | Effort | Notes |
|---------|----------|--------|-------|
| Admin dashboard | 🟡 P1 | 4 hrs | Overview of all agents, usage |
| Usage metrics | 🟡 P1 | 2 hrs | Calls, tokens, latency |
| Agent approval workflow | 🟢 P2 | 3 hrs | IT approves before production |
| Cost tracking | 🟢 P2 | 2 hrs | Credit consumption per agent |
| Audit log viewer | 🟢 P2 | 1 hr | UI for SNOWFLOW_AUDIT_LOG |

### 🚀 Flow Composability & API-fication (NEW)

| Feature | Priority | Effort | Notes |
|---------|----------|--------|-------|
| **REST API endpoints per flow** | 🟡 P1 | 6 hrs | `/api/flows/{flow_id}/execute` - make flows callable as APIs |
| **Flow-to-flow composition** | 🟡 P1 | 8 hrs | One flow calls another as a node type |
| **Concurrent flow execution** | 🟢 P2 | 6 hrs | Run multiple flows simultaneously, track in Control Tower |
| **Flow versioning & rollback** | 🟢 P2 | 4 hrs | Version each flow, rollback to previous |
| **Flow marketplace/discovery** | 🟢 P2 | 6 hrs | Browse, search, clone flows from catalog |
| **Auto-generate OpenAPI spec** | 🟢 P2 | 3 hrs | `/api/flows/{id}/openapi.json` for each flow |
| **Rate limiting per flow** | 🟢 P2 | 2 hrs | Prevent abuse of flow APIs |
| **API key management** | 🟡 P1 | 4 hrs | Generate keys to call flow APIs |

**Vision:** Treat workflows as **API products**. Business analysts build flows → IT publishes as REST APIs → Apps consume them.

**Example:**
```bash
curl -X POST https://snowflow.acme.com/api/flows/margin-analyzer/execute \
  -H "X-API-Key: sk_live_..." \
  -d '{"prompt": "Why did margin drop in Scotland?"}'
```

### Production Ready (Stage 6)

| Feature | Priority | Effort | Notes |
|---------|----------|--------|-------|
| GitHub integration | 🟢 P2 | 3 hrs | Version control for workflows |
| Export as YAML/JSON | 🟡 P1 | 1 hr | Portable workflow definitions |
| Import workflows | 🟡 P1 | 1 hr | Load from file |
| Snowflake Native App packaging | ⚪ P3 | 8 hrs | Deploy as Native App |

### UI Polish

| Feature | Priority | Effort | Notes |
|---------|----------|--------|-------|
| Keyboard shortcuts | 🟢 P2 | 1 hr | Cmd+S, Delete, etc. |
| Undo/Redo | 🟢 P2 | 2 hrs | Track canvas changes |
| Zoom controls | 🟢 P2 | 30 min | Fit to screen, zoom slider |
| Dark mode | ⚪ P3 | 2 hrs | Alternative theme |
| Mobile responsive | ⚪ P3 | 4 hrs | Tablet support |

### Architecture / Distribution

| Feature | Priority | Effort | Notes |
|---------|----------|--------|-------|
| Login/Connect page | 🔴 P0 | 3 hrs | Welcome page with "Connect to Snowflake" |
| Session management | 🔴 P0 | 4 hrs | JWT tokens, session state |
| Multi-tenant connections | 🔴 P0 | 4 hrs | Connect to ANY Snowflake account |
| API versioning (/api/v1) | 🟡 P1 | 2 hrs | Future-proof API structure |
| Connection manager | 🟡 P1 | 3 hrs | Pool connections per session |
| Docker packaging | 🟡 P1 | 2 hrs | Dockerfile + compose |
| Snowflake OAuth | 🟢 P2 | 4 hrs | Proper OAuth flow |
| Snowflake Native App | ⚪ P3 | 8 hrs | Package as Native App |

### 🔐 Agent Gateway & Security (CRITICAL FOR PRODUCTION)

> **Why:** When orchestrating external agents (Copilot, OpenAI, Salesforce), we NEED a secure gateway. This is non-negotiable for enterprise deployment.

| Feature | Priority | Effort | Notes |
|---------|----------|--------|-------|
| **Agent Gateway Service** | 🔴 P0 | 8 hrs | Central proxy for ALL external agent calls |
| Secret Management | 🔴 P0 | 4 hrs | Vault/Secrets Manager for API keys, OAuth tokens |
| OAuth Token Management | 🔴 P0 | 6 hrs | Auto-refresh for Copilot, Salesforce tokens |
| Request/Response Logging | 🔴 P0 | 2 hrs | Full audit trail of agent communications |
| Data Loss Prevention (DLP) | 🟡 P1 | 6 hrs | Scan outbound payloads for PII/sensitive data |
| Rate Limiting | 🟡 P1 | 2 hrs | Per-agent, per-user, per-org limits |
| Policy Engine | 🟡 P1 | 8 hrs | Rules: what data → which agents |
| Agent Allowlist | 🟡 P1 | 2 hrs | IT controls approved external agents |
| Payload Sanitization | 🟢 P2 | 4 hrs | Strip sensitive fields before sending |
| Response Validation | 🟢 P2 | 3 hrs | Validate/sanitize inbound responses |
| Cost Controls | 🟢 P2 | 3 hrs | Budget limits per agent/user |
| Circuit Breaker | 🟢 P2 | 2 hrs | Auto-disable failing agents |

**Snowflake Native Options to Explore:**
- `EXTERNAL ACCESS INTEGRATION` - Call external APIs from Snowflake
- `NETWORK RULES` - IP allowlisting
- `SECRETS` - Store API keys in Snowflake
- Check if Snowflake has an Agent Gateway on roadmap

**Architecture Vision:**
```
SnowFlow UI
     │
     ▼
┌────────────────────────────────────────┐
│         AGENT GATEWAY                  │
│  ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │ Secrets  │ │ Policy   │ │  DLP   │ │
│  └──────────┘ └──────────┘ └────────┘ │
│  ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │Rate Limit│ │Audit Log │ │  Cost  │ │
│  └──────────┘ └──────────┘ └────────┘ │
└────┬──────────┬──────────┬──────────┬─┘
     │          │          │          │
     ▼          ▼          ▼          ▼
  Copilot   OpenAI   Salesforce  ServiceNow
```

---

## Completed ✅

- [x] Canvas with drag-drop nodes
- [x] All Snowflake node types (Table, View, Dynamic Table, Stream)
- [x] Cortex Agent with tools (Analyst, Search, MCP, SQL)
- [x] Connection validation rules
- [x] Data Catalog (basic, from INFORMATION_SCHEMA)
- [x] Templates (stored in Snowflake)
- [x] Custom Tool Creator (stored in Snowflake)
- [x] Live Preview chat
- [x] Save/Load workflows
- [x] Save as Template
- [x] Toast notifications
- [x] Audit logging
- [x] **Multi-Agent Routing** - Router node with LLM intent classification
- [x] **Supervisor Pattern** - Delegate to child agents, aggregate results
- [x] **External Agent Integration** - Copilot, OpenAI, Salesforce, ServiceNow presets
- [x] **Hybrid Orchestration** - Route to Snowflake OR external agents
- [x] Build/Live mode toggle with canvas locking

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2024-11-28 | Park Horizon integration | Basic catalog sufficient for MVP demo |
| 2024-11-28 | Add Agent Gateway to backlog | External agent orchestration requires security layer - non-negotiable for prod |
| 2024-11-28 | Support external agents (Copilot, OpenAI) | Enable hybrid cloud orchestration for enterprise use cases |

---

*Last updated: 2024-11-28*


---

## 📅 January 2026 Update

### Recently Completed ✅

- [x] **Resizable Sidebar** - Drag handle to adjust width (200-500px)
- [x] **Security Audit** - All Python CVEs patched
- [x] **GitHub Migration** - Moved to `abhisnowflaketestdev-sudo/snowflow`

### Currently In Progress 🔄

| Feature | Priority | Status | Notes |
|---------|----------|--------|-------|
| **Control Tower** | 🔴 P0 | Pending | Agent approval, marketplace, monitoring |
| **UI Panel Fixes** | 🔴 P0 | Needs verification | Overflow, dropdowns |
| **Dynamic Snowflake Dropdowns** | 🟡 P1 | Partially done | DB/Schema/Stage selectors |

### Session Context (If Chat Lost)

**User Context:**
- Returning after 1 month break
- Focus: Enterprise production readiness
- Priority: Control Tower feature
- GitHub: `abhisnowflaketestdev-sudo/snowflow`

**Technical Context:**
- Frontend running on port 5173
- Backend running on port 8000
- All security vulnerabilities patched
- Resizable sidebar implemented

*Last updated: 2026-01-09*
