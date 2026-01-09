# SnowFlow Architecture v2 - Production Ready

## Design Principles

1. **Decoupled** - Frontend knows nothing about Snowflake
2. **Multi-tenant** - Connect to ANY Snowflake account
3. **Stateless API** - Horizontal scaling ready
4. **Config-driven** - No hardcoded connections
5. **Portable** - Deploy anywhere (cloud, on-prem, Native App)

---

## Target Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         SNOWFLOW ARCHITECTURE v2                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                        PRESENTATION LAYER                        │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │   │
│  │  │  Web App     │  │  Mobile      │  │  Embedded    │          │   │
│  │  │  (React)     │  │  (Future)    │  │  (iframe)    │          │   │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │   │
│  └─────────┼─────────────────┼─────────────────┼───────────────────┘   │
│            │                 │                 │                        │
│            ▼                 ▼                 ▼                        │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                         API GATEWAY                              │   │
│  │  • Rate limiting  • Auth validation  • Request routing           │   │
│  │  • API versioning (/api/v1/...)                                  │   │
│  └─────────────────────────────┬───────────────────────────────────┘   │
│                                │                                        │
│            ┌───────────────────┼───────────────────┐                   │
│            ▼                   ▼                   ▼                   │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐          │
│  │  AUTH SERVICE   │ │  WORKFLOW SVC   │ │  CATALOG SVC    │          │
│  │                 │ │                 │ │                 │          │
│  │ • OAuth/SSO     │ │ • Build/Run     │ │ • Data sources  │          │
│  │ • Session mgmt  │ │ • Templates     │ │ • Semantic models│          │
│  │ • Token refresh │ │ • Export/Import │ │ • Access control│          │
│  └────────┬────────┘ └────────┬────────┘ └────────┬────────┘          │
│           │                   │                   │                    │
│           └───────────────────┼───────────────────┘                    │
│                               ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    CONNECTION MANAGER                            │   │
│  │  • Multi-tenant Snowflake connections                           │   │
│  │  • Connection pooling per tenant                                │   │
│  │  • Credential vault integration (future)                        │   │
│  └─────────────────────────────┬───────────────────────────────────┘   │
│                                │                                        │
│           ┌────────────────────┼────────────────────┐                  │
│           ▼                    ▼                    ▼                  │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐          │
│  │  Snowflake      │ │  Snowflake      │ │  Snowflake      │          │
│  │  Account A      │ │  Account B      │ │  Account N      │          │
│  │  (Customer 1)   │ │  (Customer 2)   │ │  (Customer N)   │          │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Layer Breakdown

### 1. Presentation Layer
```
/frontend
├── src/
│   ├── pages/
│   │   ├── Login.tsx          # Connect to Snowflake
│   │   ├── Dashboard.tsx      # Main canvas
│   │   └── Admin.tsx          # Control Tower
│   ├── components/            # Reusable UI
│   ├── api/
│   │   └── client.ts          # API client (axios wrapper)
│   └── store/                 # Zustand state
```

**Key:** Frontend ONLY talks to API Gateway. Never directly to Snowflake.

### 2. API Gateway Layer
```
/api-gateway
├── routes/
│   ├── v1/
│   │   ├── auth.py
│   │   ├── workflows.py
│   │   ├── catalog.py
│   │   └── templates.py
├── middleware/
│   ├── auth.py               # JWT validation
│   ├── rate_limit.py
│   └── tenant.py             # Multi-tenant context
└── main.py
```

**Endpoints:**
```
POST   /api/v1/auth/connect      # Connect to Snowflake
POST   /api/v1/auth/disconnect   # End session
GET    /api/v1/auth/me           # Current user/connection

GET    /api/v1/catalog/sources   # List data sources
GET    /api/v1/catalog/schemas   # List schemas

POST   /api/v1/workflows/run     # Execute workflow
POST   /api/v1/workflows/save    # Save workflow
GET    /api/v1/workflows         # List workflows

GET    /api/v1/templates         # List templates
POST   /api/v1/templates         # Create template
```

### 3. Service Layer
```
/services
├── auth/
│   ├── snowflake_oauth.py    # Snowflake OAuth flow
│   ├── session_manager.py    # Session handling
│   └── token_store.py        # Token management
├── workflow/
│   ├── builder.py            # Graph construction
│   ├── executor.py           # LangGraph execution
│   └── validator.py          # Pre-run validation
├── catalog/
│   ├── metadata.py           # Snowflake metadata
│   └── access_control.py     # Permission checking
└── connection/
    ├── manager.py            # Connection pooling
    └── factory.py            # Create connections
```

### 4. Connection Manager
```python
# services/connection/manager.py

class ConnectionManager:
    """
    Multi-tenant connection management.
    Each user session has its own Snowflake connection.
    """
    
    def __init__(self):
        self.connections: Dict[str, SnowflakeConnection] = {}
    
    def connect(self, session_id: str, credentials: SnowflakeCredentials):
        """Create connection for a session"""
        conn = snowflake.connector.connect(
            account=credentials.account,
            user=credentials.user,
            password=credentials.password,  # Or OAuth token
            warehouse=credentials.warehouse,
            database=credentials.database,
        )
        self.connections[session_id] = conn
        return session_id
    
    def get_connection(self, session_id: str):
        """Get connection for current session"""
        return self.connections.get(session_id)
    
    def disconnect(self, session_id: str):
        """Close and remove connection"""
        if session_id in self.connections:
            self.connections[session_id].close()
            del self.connections[session_id]
```

---

## Authentication Flow

### Option 1: Username/Password (Simple)
```
┌──────────┐     ┌──────────┐     ┌──────────┐
│  User    │────▶│ SnowFlow │────▶│Snowflake │
│          │     │   API    │     │          │
└──────────┘     └──────────┘     └──────────┘
     │                │                │
     │  1. Enter      │                │
     │  credentials   │                │
     │───────────────▶│                │
     │                │  2. Connect    │
     │                │───────────────▶│
     │                │                │
     │                │  3. Success    │
     │                │◀───────────────│
     │  4. Session    │                │
     │     token      │                │
     │◀───────────────│                │
```

### Option 2: Snowflake OAuth (Production)
```
┌──────────┐     ┌──────────┐     ┌──────────┐
│  User    │────▶│ SnowFlow │────▶│Snowflake │
│          │     │   API    │     │  OAuth   │
└──────────┘     └──────────┘     └──────────┘
     │                │                │
     │  1. Click      │                │
     │  "Connect"     │                │
     │───────────────▶│                │
     │                │  2. Redirect   │
     │◀───────────────│───────────────▶│
     │                │                │
     │  3. User logs  │                │
     │  into Snowflake│                │
     │────────────────────────────────▶│
     │                │                │
     │  4. Callback   │  5. Exchange   │
     │  with code     │     tokens     │
     │───────────────▶│───────────────▶│
     │                │                │
     │  6. Session    │                │
     │◀───────────────│                │
```

---

## Deployment Options

### Option A: Standalone (Current)
```
Docker Compose:
- Frontend container
- Backend container
- Connect to any Snowflake
```

### Option B: Snowflake Native App
```
Package as Snowflake Native App:
- Runs inside customer's Snowflake
- No external hosting needed
- Data never leaves Snowflake
```

### Option C: Cloud Hosted (SaaS)
```
AWS/Azure/GCP:
- Managed service
- Multi-tenant
- Central control plane
```

---

## Migration Path from Current State

### Phase 1: API Refactor (Now)
- [x] Current: All endpoints in main.py
- [ ] Split into versioned routes (/api/v1/...)
- [ ] Add request/response schemas (Pydantic)
- [ ] Add proper error handling

### Phase 2: Auth Layer
- [ ] Add login page to frontend
- [ ] Implement session management
- [ ] Support multiple Snowflake accounts
- [ ] Store credentials securely (not in .env)

### Phase 3: Multi-Tenancy
- [ ] Connection per session
- [ ] Tenant isolation
- [ ] Per-tenant config

### Phase 4: Production Hardening
- [ ] Rate limiting
- [ ] Request logging
- [ ] Health checks
- [ ] Graceful shutdown

---

## Directory Structure (Target)

```
snowflow/
├── frontend/                 # React app
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   ├── Connect.tsx
│   │   │   └── Builder.tsx
│   │   ├── components/
│   │   ├── api/
│   │   │   └── client.ts
│   │   └── store/
│   └── package.json
│
├── backend/
│   ├── api/                  # API Gateway
│   │   ├── v1/
│   │   │   ├── auth.py
│   │   │   ├── workflows.py
│   │   │   ├── catalog.py
│   │   │   └── templates.py
│   │   └── middleware/
│   │
│   ├── services/             # Business logic
│   │   ├── auth/
│   │   ├── workflow/
│   │   ├── catalog/
│   │   └── connection/
│   │
│   ├── core/                 # Shared utilities
│   │   ├── config.py
│   │   ├── exceptions.py
│   │   └── security.py
│   │
│   └── main.py               # Entry point
│
├── docker/
│   ├── Dockerfile.frontend
│   ├── Dockerfile.backend
│   └── docker-compose.yml
│
└── docs/
    ├── ARCHITECTURE.md
    ├── API.md
    └── DEPLOYMENT.md
```

---

## Summary

| Aspect | Current | Target |
|--------|---------|--------|
| Auth | None | OAuth/Session |
| Snowflake | Single .env | Multi-tenant |
| API | Flat routes | Versioned (/v1) |
| Deploy | Local only | Docker/Native App |
| Scaling | Single instance | Horizontal |



## Design Principles

1. **Decoupled** - Frontend knows nothing about Snowflake
2. **Multi-tenant** - Connect to ANY Snowflake account
3. **Stateless API** - Horizontal scaling ready
4. **Config-driven** - No hardcoded connections
5. **Portable** - Deploy anywhere (cloud, on-prem, Native App)

---

## Target Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         SNOWFLOW ARCHITECTURE v2                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                        PRESENTATION LAYER                        │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │   │
│  │  │  Web App     │  │  Mobile      │  │  Embedded    │          │   │
│  │  │  (React)     │  │  (Future)    │  │  (iframe)    │          │   │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │   │
│  └─────────┼─────────────────┼─────────────────┼───────────────────┘   │
│            │                 │                 │                        │
│            ▼                 ▼                 ▼                        │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                         API GATEWAY                              │   │
│  │  • Rate limiting  • Auth validation  • Request routing           │   │
│  │  • API versioning (/api/v1/...)                                  │   │
│  └─────────────────────────────┬───────────────────────────────────┘   │
│                                │                                        │
│            ┌───────────────────┼───────────────────┐                   │
│            ▼                   ▼                   ▼                   │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐          │
│  │  AUTH SERVICE   │ │  WORKFLOW SVC   │ │  CATALOG SVC    │          │
│  │                 │ │                 │ │                 │          │
│  │ • OAuth/SSO     │ │ • Build/Run     │ │ • Data sources  │          │
│  │ • Session mgmt  │ │ • Templates     │ │ • Semantic models│          │
│  │ • Token refresh │ │ • Export/Import │ │ • Access control│          │
│  └────────┬────────┘ └────────┬────────┘ └────────┬────────┘          │
│           │                   │                   │                    │
│           └───────────────────┼───────────────────┘                    │
│                               ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    CONNECTION MANAGER                            │   │
│  │  • Multi-tenant Snowflake connections                           │   │
│  │  • Connection pooling per tenant                                │   │
│  │  • Credential vault integration (future)                        │   │
│  └─────────────────────────────┬───────────────────────────────────┘   │
│                                │                                        │
│           ┌────────────────────┼────────────────────┐                  │
│           ▼                    ▼                    ▼                  │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐          │
│  │  Snowflake      │ │  Snowflake      │ │  Snowflake      │          │
│  │  Account A      │ │  Account B      │ │  Account N      │          │
│  │  (Customer 1)   │ │  (Customer 2)   │ │  (Customer N)   │          │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Layer Breakdown

### 1. Presentation Layer
```
/frontend
├── src/
│   ├── pages/
│   │   ├── Login.tsx          # Connect to Snowflake
│   │   ├── Dashboard.tsx      # Main canvas
│   │   └── Admin.tsx          # Control Tower
│   ├── components/            # Reusable UI
│   ├── api/
│   │   └── client.ts          # API client (axios wrapper)
│   └── store/                 # Zustand state
```

**Key:** Frontend ONLY talks to API Gateway. Never directly to Snowflake.

### 2. API Gateway Layer
```
/api-gateway
├── routes/
│   ├── v1/
│   │   ├── auth.py
│   │   ├── workflows.py
│   │   ├── catalog.py
│   │   └── templates.py
├── middleware/
│   ├── auth.py               # JWT validation
│   ├── rate_limit.py
│   └── tenant.py             # Multi-tenant context
└── main.py
```

**Endpoints:**
```
POST   /api/v1/auth/connect      # Connect to Snowflake
POST   /api/v1/auth/disconnect   # End session
GET    /api/v1/auth/me           # Current user/connection

GET    /api/v1/catalog/sources   # List data sources
GET    /api/v1/catalog/schemas   # List schemas

POST   /api/v1/workflows/run     # Execute workflow
POST   /api/v1/workflows/save    # Save workflow
GET    /api/v1/workflows         # List workflows

GET    /api/v1/templates         # List templates
POST   /api/v1/templates         # Create template
```

### 3. Service Layer
```
/services
├── auth/
│   ├── snowflake_oauth.py    # Snowflake OAuth flow
│   ├── session_manager.py    # Session handling
│   └── token_store.py        # Token management
├── workflow/
│   ├── builder.py            # Graph construction
│   ├── executor.py           # LangGraph execution
│   └── validator.py          # Pre-run validation
├── catalog/
│   ├── metadata.py           # Snowflake metadata
│   └── access_control.py     # Permission checking
└── connection/
    ├── manager.py            # Connection pooling
    └── factory.py            # Create connections
```

### 4. Connection Manager
```python
# services/connection/manager.py

class ConnectionManager:
    """
    Multi-tenant connection management.
    Each user session has its own Snowflake connection.
    """
    
    def __init__(self):
        self.connections: Dict[str, SnowflakeConnection] = {}
    
    def connect(self, session_id: str, credentials: SnowflakeCredentials):
        """Create connection for a session"""
        conn = snowflake.connector.connect(
            account=credentials.account,
            user=credentials.user,
            password=credentials.password,  # Or OAuth token
            warehouse=credentials.warehouse,
            database=credentials.database,
        )
        self.connections[session_id] = conn
        return session_id
    
    def get_connection(self, session_id: str):
        """Get connection for current session"""
        return self.connections.get(session_id)
    
    def disconnect(self, session_id: str):
        """Close and remove connection"""
        if session_id in self.connections:
            self.connections[session_id].close()
            del self.connections[session_id]
```

---

## Authentication Flow

### Option 1: Username/Password (Simple)
```
┌──────────┐     ┌──────────┐     ┌──────────┐
│  User    │────▶│ SnowFlow │────▶│Snowflake │
│          │     │   API    │     │          │
└──────────┘     └──────────┘     └──────────┘
     │                │                │
     │  1. Enter      │                │
     │  credentials   │                │
     │───────────────▶│                │
     │                │  2. Connect    │
     │                │───────────────▶│
     │                │                │
     │                │  3. Success    │
     │                │◀───────────────│
     │  4. Session    │                │
     │     token      │                │
     │◀───────────────│                │
```

### Option 2: Snowflake OAuth (Production)
```
┌──────────┐     ┌──────────┐     ┌──────────┐
│  User    │────▶│ SnowFlow │────▶│Snowflake │
│          │     │   API    │     │  OAuth   │
└──────────┘     └──────────┘     └──────────┘
     │                │                │
     │  1. Click      │                │
     │  "Connect"     │                │
     │───────────────▶│                │
     │                │  2. Redirect   │
     │◀───────────────│───────────────▶│
     │                │                │
     │  3. User logs  │                │
     │  into Snowflake│                │
     │────────────────────────────────▶│
     │                │                │
     │  4. Callback   │  5. Exchange   │
     │  with code     │     tokens     │
     │───────────────▶│───────────────▶│
     │                │                │
     │  6. Session    │                │
     │◀───────────────│                │
```

---

## Deployment Options

### Option A: Standalone (Current)
```
Docker Compose:
- Frontend container
- Backend container
- Connect to any Snowflake
```

### Option B: Snowflake Native App
```
Package as Snowflake Native App:
- Runs inside customer's Snowflake
- No external hosting needed
- Data never leaves Snowflake
```

### Option C: Cloud Hosted (SaaS)
```
AWS/Azure/GCP:
- Managed service
- Multi-tenant
- Central control plane
```

---

## Migration Path from Current State

### Phase 1: API Refactor (Now)
- [x] Current: All endpoints in main.py
- [ ] Split into versioned routes (/api/v1/...)
- [ ] Add request/response schemas (Pydantic)
- [ ] Add proper error handling

### Phase 2: Auth Layer
- [ ] Add login page to frontend
- [ ] Implement session management
- [ ] Support multiple Snowflake accounts
- [ ] Store credentials securely (not in .env)

### Phase 3: Multi-Tenancy
- [ ] Connection per session
- [ ] Tenant isolation
- [ ] Per-tenant config

### Phase 4: Production Hardening
- [ ] Rate limiting
- [ ] Request logging
- [ ] Health checks
- [ ] Graceful shutdown

---

## Directory Structure (Target)

```
snowflow/
├── frontend/                 # React app
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   ├── Connect.tsx
│   │   │   └── Builder.tsx
│   │   ├── components/
│   │   ├── api/
│   │   │   └── client.ts
│   │   └── store/
│   └── package.json
│
├── backend/
│   ├── api/                  # API Gateway
│   │   ├── v1/
│   │   │   ├── auth.py
│   │   │   ├── workflows.py
│   │   │   ├── catalog.py
│   │   │   └── templates.py
│   │   └── middleware/
│   │
│   ├── services/             # Business logic
│   │   ├── auth/
│   │   ├── workflow/
│   │   ├── catalog/
│   │   └── connection/
│   │
│   ├── core/                 # Shared utilities
│   │   ├── config.py
│   │   ├── exceptions.py
│   │   └── security.py
│   │
│   └── main.py               # Entry point
│
├── docker/
│   ├── Dockerfile.frontend
│   ├── Dockerfile.backend
│   └── docker-compose.yml
│
└── docs/
    ├── ARCHITECTURE.md
    ├── API.md
    └── DEPLOYMENT.md
```

---

## Summary

| Aspect | Current | Target |
|--------|---------|--------|
| Auth | None | OAuth/Session |
| Snowflake | Single .env | Multi-tenant |
| API | Flat routes | Versioned (/v1) |
| Deploy | Local only | Docker/Native App |
| Scaling | Single instance | Horizontal |












