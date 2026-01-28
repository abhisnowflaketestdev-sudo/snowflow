# SnowFlow Product Roadmap

## Vision Statement

SnowFlow is not another abstraction layer—it's a **governed, low-code platform** for building Snowflake Intelligence workflows that:

1. **Empowers Business Users** to build custom AI agents and multi-agent orchestrations
2. **Enables IT Admins** to enforce security, governance, and access controls
3. **Mirrors Snowflake's native controls** 1:1 on every component

---

## Two Personas

### 👤 Business User
- Drag & drop components to build workflows
- Configure agents via simple UI (no code)
- Invoke external agents (REST, MCP, etc.)
- Build multi-agent orchestrations
- Limited to components they have privileges for

### 🛡️ IT Admin
- Define which components users can access
- Set governance rules (data masking, row access, etc.)
- Monitor all workflows and executions
- Approve/reject component usage
- Audit trail for compliance

---

## Component Library (Mirrors Snowflake)

### Phase 1: Core Data Components
| Component | Snowflake Mapping | Properties |
|-----------|------------------|------------|
| **Table Source** | `TABLE` | database, schema, table, columns, row_access_policy |
| **View Source** | `VIEW` | database, schema, view, secure (Y/N) |
| **Dynamic Table** | `DYNAMIC TABLE` | target_lag, warehouse, refresh_mode |
| **Stage** | `STAGE` | stage_type (internal/external), url, credentials |
| **Stream** | `STREAM` | source_table, append_only, show_initial_rows |

### Phase 2: Cortex AI Components
| Component | Snowflake Mapping | Properties |
|-----------|------------------|------------|
| **Cortex Complete** | `SNOWFLAKE.CORTEX.COMPLETE()` | model, prompt, temperature, max_tokens |
| **Cortex Analyst** | Cortex Analyst API | semantic_model, warehouse |
| **Cortex Search** | Cortex Search Service | search_service, columns, filter |
| **Cortex Embed** | `SNOWFLAKE.CORTEX.EMBED_TEXT()` | model, text_column |
| **Cortex Sentiment** | `SNOWFLAKE.CORTEX.SENTIMENT()` | text_column |
| **Cortex Summarize** | `SNOWFLAKE.CORTEX.SUMMARIZE()` | text_column |
| **Cortex Translate** | `SNOWFLAKE.CORTEX.TRANSLATE()` | from_lang, to_lang |

### Phase 3: Agent Components
| Component | Type | Properties |
|-----------|------|------------|
| **Snowflake Agent** | Native | tools[], instructions, model, memory |
| **External Agent** | REST/MCP | endpoint, auth_type, headers, payload_template |
| **Tool** | Function | name, description, parameters, sql_or_python |
| **Agent Router** | Orchestration | routing_logic, agents[], fallback |
| **Agent Supervisor** | Orchestration | strategy (sequential/parallel/hierarchical), agents[] |

### Phase 4: Control Flow
| Component | Purpose | Properties |
|-----------|---------|------------|
| **Condition** | Branching | condition_expression, true_path, false_path |
| **Loop** | Iteration | iterator, max_iterations |
| **Parallel** | Fan-out | branches[], join_strategy |
| **Human-in-Loop** | Approval | approvers[], timeout, escalation |

### Phase 5: Output & Integration
| Component | Purpose | Properties |
|-----------|---------|------------|
| **Table Output** | Write to table | target_table, write_mode (append/overwrite/merge) |
| **Notification** | Alert | channel (email/slack/teams), template |
| **API Call** | External | endpoint, method, auth, payload |
| **Dashboard** | Visualization | chart_type, dimensions, measures |

---

## Governance Layer (IT Admin)

### Access Control Model
```
ROLE → COMPONENT_PRIVILEGES → ALLOWED_COMPONENTS
         ↓
    DATA_PRIVILEGES → ALLOWED_DATABASES/SCHEMAS/TABLES
         ↓
    GOVERNANCE_POLICIES → MASKING, ROW_ACCESS, TAGS
```

### Admin Dashboard Features
1. **Component Registry** - Enable/disable components per role
2. **Data Catalog** - Browse what data is accessible
3. **Policy Editor** - Apply masking/row-access policies
4. **Workflow Monitor** - See all running/completed workflows
5. **Audit Log** - Who did what, when
6. **Cost Attribution** - Credit usage per workflow/user

### Governance Controls per Component
Every component shows:
- ✅ Allowed / ❌ Blocked badge
- 🔒 Applied policies (masking, row access)
- 📊 Estimated compute cost
- 👁️ Data preview (if permitted)

---

## Implementation Stages

## Status Update (2026-01-17)

The repo has progressed beyond the original “Week 2 / Stage 1” placeholders. Current highlights:
- **Workflow save/load**: implemented (JSON storage + UI)
- **Templates**: implemented (UI + load-to-canvas)
- **Catalog**: implemented with **demo/fallback** behavior when Snowflake is unreachable
- **Control Tower (Governance)**: implemented and stabilized (agent registry, audit log, settings editor)
- **Theming**: Light/Dark toggle implemented; dark surfaces standardized; light mode restored to classic white

## Status Update (2026-01-19)

Additional progress since 2026-01-17:
- **Manual testing**: Section 5 (Node Configuration) confirmed complete by tester (TEST-5.1 → TEST-5.8).
- **Canvas UX**: Preview/read-only lock, Miro-style panning, box selection (Shift+drag), edge selection + delete.
- **External Agents**: Properties dropdown now mirrors the left Components list; preset→custom transitions reset provider/endpoints/auth to prevent confusing visual carryover.

### Stage 1: Foundation (Current → Week 2)
- [x] React Flow canvas with drag & drop
- [x] Basic nodes (Source, Agent, Output)
- [x] Node detail panel
- [x] **Persist workflows** (save/load JSON)
- [x] **Backend execution** (run workflow via backend)
- [x] **Snowflake connection** (real data; with fallback paths when unreachable)

### Stage 2: Component Library (Week 3-4)
- [ ] All Phase 1 data components
- [ ] All Phase 2 Cortex components
- [ ] Component property panels mirror Snowflake exactly
- [ ] Component search/filter in sidebar

### Stage 3: Agent Builder (Week 5-6)
- [x] Custom tool creation UI
- [ ] Agent configuration (model, tools, instructions)
- [ ] External agent integration (REST endpoints)
- [ ] Agent testing sandbox

### Stage 4: Orchestration (Week 7-8)
- [x] Multi-agent routing
- [ ] Sequential/parallel execution (partial; needs refinement)
- [x] Supervisor patterns
- [ ] Human-in-the-loop approvals (not implemented)

### Stage 5: Governance (Week 9-10)
- [x] Admin dashboard (Control Tower)
- [ ] Role-based component access (not implemented)
- [x] Policy application UI (settings editor + backend persistence; scope = SnowFlow governance controls)
- [x] Audit logging (Snowflake-backed + local fallback)

### Stage 6: Production Readiness (Week 11-12)
- [ ] Workflow versioning
- [ ] Scheduling
- [ ] Monitoring & alerting
- [ ] Cost tracking

---

## Technical Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (React)                      │
│  ┌─────────┐  ┌─────────────┐  ┌───────────────────┐   │
│  │ Canvas  │  │ Component   │  │ Admin Dashboard   │   │
│  │ Builder │  │ Library     │  │ (Governance)      │   │
│  └─────────┘  └─────────────┘  └───────────────────┘   │
└────────────────────────┬────────────────────────────────┘
                         │ REST API
┌────────────────────────▼────────────────────────────────┐
│                   BACKEND (FastAPI)                      │
│  ┌─────────┐  ┌─────────────┐  ┌───────────────────┐   │
│  │ Workflow│  │ Auth/RBAC   │  │ Governance        │   │
│  │ Engine  │  │ Service     │  │ Service           │   │
│  └────┬────┘  └─────────────┘  └───────────────────┘   │
│       │                                                  │
│  ┌────▼────────────────────────────────────────────┐   │
│  │              LangGraph Orchestrator              │   │
│  │   (Compiles visual graph → executable agents)    │   │
│  └────┬────────────────────────────────────────────┘   │
└───────┼──────────────────────────────────────────────────┘
        │ Snowflake Python Connector
┌───────▼──────────────────────────────────────────────────┐
│                    SNOWFLAKE                             │
│  ┌─────────┐  ┌─────────────┐  ┌───────────────────┐   │
│  │ Cortex  │  │ Data        │  │ Governance        │   │
│  │ LLMs    │  │ Tables      │  │ (Policies, Roles) │   │
│  └─────────┘  └─────────────┘  └───────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

---

## Next Immediate Step

**Stage 1 completion** - Let's wire up:
1. Save/load workflows to JSON
2. Connect to real Snowflake
3. Execute a simple Source → Agent → Output flow for real

Ready to proceed?



## Vision Statement

SnowFlow is not another abstraction layer—it's a **governed, low-code platform** for building Snowflake Intelligence workflows that:

1. **Empowers Business Users** to build custom AI agents and multi-agent orchestrations
2. **Enables IT Admins** to enforce security, governance, and access controls
3. **Mirrors Snowflake's native controls** 1:1 on every component

---

## Two Personas

### 👤 Business User
- Drag & drop components to build workflows
- Configure agents via simple UI (no code)
- Invoke external agents (REST, MCP, etc.)
- Build multi-agent orchestrations
- Limited to components they have privileges for

### 🛡️ IT Admin
- Define which components users can access
- Set governance rules (data masking, row access, etc.)
- Monitor all workflows and executions
- Approve/reject component usage
- Audit trail for compliance

---

## Component Library (Mirrors Snowflake)

### Phase 1: Core Data Components
| Component | Snowflake Mapping | Properties |
|-----------|------------------|------------|
| **Table Source** | `TABLE` | database, schema, table, columns, row_access_policy |
| **View Source** | `VIEW` | database, schema, view, secure (Y/N) |
| **Dynamic Table** | `DYNAMIC TABLE` | target_lag, warehouse, refresh_mode |
| **Stage** | `STAGE` | stage_type (internal/external), url, credentials |
| **Stream** | `STREAM` | source_table, append_only, show_initial_rows |

### Phase 2: Cortex AI Components
| Component | Snowflake Mapping | Properties |
|-----------|------------------|------------|
| **Cortex Complete** | `SNOWFLAKE.CORTEX.COMPLETE()` | model, prompt, temperature, max_tokens |
| **Cortex Analyst** | Cortex Analyst API | semantic_model, warehouse |
| **Cortex Search** | Cortex Search Service | search_service, columns, filter |
| **Cortex Embed** | `SNOWFLAKE.CORTEX.EMBED_TEXT()` | model, text_column |
| **Cortex Sentiment** | `SNOWFLAKE.CORTEX.SENTIMENT()` | text_column |
| **Cortex Summarize** | `SNOWFLAKE.CORTEX.SUMMARIZE()` | text_column |
| **Cortex Translate** | `SNOWFLAKE.CORTEX.TRANSLATE()` | from_lang, to_lang |

### Phase 3: Agent Components
| Component | Type | Properties |
|-----------|------|------------|
| **Snowflake Agent** | Native | tools[], instructions, model, memory |
| **External Agent** | REST/MCP | endpoint, auth_type, headers, payload_template |
| **Tool** | Function | name, description, parameters, sql_or_python |
| **Agent Router** | Orchestration | routing_logic, agents[], fallback |
| **Agent Supervisor** | Orchestration | strategy (sequential/parallel/hierarchical), agents[] |

### Phase 4: Control Flow
| Component | Purpose | Properties |
|-----------|---------|------------|
| **Condition** | Branching | condition_expression, true_path, false_path |
| **Loop** | Iteration | iterator, max_iterations |
| **Parallel** | Fan-out | branches[], join_strategy |
| **Human-in-Loop** | Approval | approvers[], timeout, escalation |

### Phase 5: Output & Integration
| Component | Purpose | Properties |
|-----------|---------|------------|
| **Table Output** | Write to table | target_table, write_mode (append/overwrite/merge) |
| **Notification** | Alert | channel (email/slack/teams), template |
| **API Call** | External | endpoint, method, auth, payload |
| **Dashboard** | Visualization | chart_type, dimensions, measures |

---

## Governance Layer (IT Admin)

### Access Control Model
```
ROLE → COMPONENT_PRIVILEGES → ALLOWED_COMPONENTS
         ↓
    DATA_PRIVILEGES → ALLOWED_DATABASES/SCHEMAS/TABLES
         ↓
    GOVERNANCE_POLICIES → MASKING, ROW_ACCESS, TAGS
```

### Admin Dashboard Features
1. **Component Registry** - Enable/disable components per role
2. **Data Catalog** - Browse what data is accessible
3. **Policy Editor** - Apply masking/row-access policies
4. **Workflow Monitor** - See all running/completed workflows
5. **Audit Log** - Who did what, when
6. **Cost Attribution** - Credit usage per workflow/user

### Governance Controls per Component
Every component shows:
- ✅ Allowed / ❌ Blocked badge
- 🔒 Applied policies (masking, row access)
- 📊 Estimated compute cost
- 👁️ Data preview (if permitted)

---

## Implementation Stages

### Stage 1: Foundation (Current → Week 2)
- [x] React Flow canvas with drag & drop
- [x] Basic nodes (Source, Agent, Output)
- [x] Node detail panel
- [ ] **Persist workflows** (save/load JSON)
- [ ] **Backend execution** (actually run LangGraph)
- [ ] **Snowflake connection** (real data)

### Stage 2: Component Library (Week 3-4)
- [ ] All Phase 1 data components
- [ ] All Phase 2 Cortex components
- [ ] Component property panels mirror Snowflake exactly
- [ ] Component search/filter in sidebar

### Stage 3: Agent Builder (Week 5-6)
- [ ] Custom tool creation UI
- [ ] Agent configuration (model, tools, instructions)
- [ ] External agent integration (REST endpoints)
- [ ] Agent testing sandbox

### Stage 4: Orchestration (Week 7-8)
- [ ] Multi-agent routing
- [ ] Sequential/parallel execution
- [ ] Supervisor patterns
- [ ] Human-in-the-loop approvals

### Stage 5: Governance (Week 9-10)
- [ ] Admin dashboard
- [ ] Role-based component access
- [ ] Policy application UI
- [ ] Audit logging

### Stage 6: Production Readiness (Week 11-12)
- [ ] Workflow versioning
- [ ] Scheduling
- [ ] Monitoring & alerting
- [ ] Cost tracking

---

## Technical Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (React)                      │
│  ┌─────────┐  ┌─────────────┐  ┌───────────────────┐   │
│  │ Canvas  │  │ Component   │  │ Admin Dashboard   │   │
│  │ Builder │  │ Library     │  │ (Governance)      │   │
│  └─────────┘  └─────────────┘  └───────────────────┘   │
└────────────────────────┬────────────────────────────────┘
                         │ REST API
┌────────────────────────▼────────────────────────────────┐
│                   BACKEND (FastAPI)                      │
│  ┌─────────┐  ┌─────────────┐  ┌───────────────────┐   │
│  │ Workflow│  │ Auth/RBAC   │  │ Governance        │   │
│  │ Engine  │  │ Service     │  │ Service           │   │
│  └────┬────┘  └─────────────┘  └───────────────────┘   │
│       │                                                  │
│  ┌────▼────────────────────────────────────────────┐   │
│  │              LangGraph Orchestrator              │   │
│  │   (Compiles visual graph → executable agents)    │   │
│  └────┬────────────────────────────────────────────┘   │
└───────┼──────────────────────────────────────────────────┘
        │ Snowflake Python Connector
┌───────▼──────────────────────────────────────────────────┐
│                    SNOWFLAKE                             │
│  ┌─────────┐  ┌─────────────┐  ┌───────────────────┐   │
│  │ Cortex  │  │ Data        │  │ Governance        │   │
│  │ LLMs    │  │ Tables      │  │ (Policies, Roles) │   │
│  └─────────┘  └─────────────┘  └───────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

---

## Next Immediate Step

**Stage 1 completion** - Let's wire up:
1. Save/load workflows to JSON
2. Connect to real Snowflake
3. Execute a simple Source → Agent → Output flow for real

Ready to proceed?












