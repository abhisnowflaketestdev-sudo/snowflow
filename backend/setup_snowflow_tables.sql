-- ============================================================
-- SNOWFLOW METADATA TABLES
-- Run this to set up persistence for SnowFlow
-- ============================================================

USE DATABASE SNOWFLOW_DEV;
USE SCHEMA DEMO;

-- ============================================================
-- 1. CUSTOM TOOLS TABLE
-- Stores user-defined tools (SQL, Python UDFs, API configs)
-- ============================================================
CREATE TABLE IF NOT EXISTS SNOWFLOW_TOOLS (
    tool_id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    tool_type VARCHAR(20) NOT NULL,  -- 'sql', 'python', 'api'
    parameters VARIANT,               -- JSON array of parameter definitions
    implementation TEXT,              -- SQL query or Python code
    api_endpoint VARCHAR(500),        -- For API tools
    api_method VARCHAR(10),           -- GET, POST, PUT, DELETE
    api_headers VARIANT,              -- JSON object of headers
    created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    created_by VARCHAR(255),
    updated_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    is_approved BOOLEAN DEFAULT FALSE,
    approved_by VARCHAR(255),
    approved_at TIMESTAMP_NTZ
);

-- ============================================================
-- 2. WORKFLOW TEMPLATES TABLE
-- Stores reusable workflow templates
-- ============================================================
CREATE TABLE IF NOT EXISTS SNOWFLOW_TEMPLATES (
    template_id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50),             -- 'analytics', 'customer', 'operations'
    complexity VARCHAR(20),           -- 'simple', 'medium', 'advanced'
    icon VARCHAR(50),                 -- Icon name for UI
    nodes VARIANT NOT NULL,           -- JSON array of node definitions
    edges VARIANT NOT NULL,           -- JSON array of edge definitions
    created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    created_by VARCHAR(255),
    updated_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    is_public BOOLEAN DEFAULT FALSE,
    usage_count INTEGER DEFAULT 0
);

-- ============================================================
-- 3. SAVED WORKFLOWS TABLE
-- Stores user's saved workflows
-- ============================================================
CREATE TABLE IF NOT EXISTS SNOWFLOW_WORKFLOWS (
    workflow_id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    nodes VARIANT NOT NULL,
    edges VARIANT NOT NULL,
    created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    created_by VARCHAR(255),
    updated_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    last_run_at TIMESTAMP_NTZ,
    run_count INTEGER DEFAULT 0
);

-- ============================================================
-- 4. AUDIT LOG TABLE
-- Tracks all actions for governance
-- ============================================================
CREATE TABLE IF NOT EXISTS SNOWFLOW_AUDIT_LOG (
    log_id VARCHAR(100) PRIMARY KEY,
    action_type VARCHAR(50) NOT NULL,  -- 'workflow_run', 'tool_created', 'template_used', etc.
    entity_type VARCHAR(50),           -- 'workflow', 'tool', 'template'
    entity_id VARCHAR(100),
    entity_name VARCHAR(255),
    user_id VARCHAR(255),
    details VARIANT,                   -- JSON with action details
    created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- ============================================================
-- 5. DATA SOURCE REGISTRY
-- Tracks approved data sources with semantic model status
-- ============================================================
CREATE TABLE IF NOT EXISTS SNOWFLOW_DATA_SOURCES (
    source_id VARCHAR(100) PRIMARY KEY,
    database_name VARCHAR(255) NOT NULL,
    schema_name VARCHAR(255) NOT NULL,
    object_name VARCHAR(255) NOT NULL,
    object_type VARCHAR(50) NOT NULL,  -- 'TABLE', 'VIEW', 'DYNAMIC_TABLE', 'STREAM'
    description TEXT,
    status VARCHAR(20) DEFAULT 'pending',  -- 'ready', 'pending', 'no_access'
    has_semantic_model BOOLEAN DEFAULT FALSE,
    semantic_model_path VARCHAR(500),
    row_count BIGINT,
    last_updated TIMESTAMP_NTZ,
    registered_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    registered_by VARCHAR(255)
);

-- ============================================================
-- SEED: Add some initial templates
-- ============================================================
INSERT INTO SNOWFLOW_TEMPLATES (template_id, name, description, category, complexity, icon, nodes, edges, is_public)
SELECT 'tpl-feedback-analyzer', 'Customer Feedback Analyzer', 
       'Analyzes customer feedback for sentiment and key issues using Cortex AI.',
       'customer', 'simple', 'MessageSquare',
       PARSE_JSON('[
         {"id":"1","type":"snowflakeSource","position":{"x":100,"y":150},"data":{"label":"CUSTOMER_FEEDBACK","database":"SNOWFLOW_DEV","schema":"DEMO","objectType":"table"}},
         {"id":"2","type":"semanticModel","position":{"x":350,"y":150},"data":{"label":"Feedback Model","database":"SNOWFLOW_DEV","schema":"DEMO"}},
         {"id":"3","type":"agent","position":{"x":600,"y":150},"data":{"label":"Feedback Agent","model":"mistral-large2","systemPrompt":"Analyze customer feedback. Identify sentiment, key themes, and actionable insights.","tools":{"analyst":{"enabled":true}}}},
         {"id":"4","type":"output","position":{"x":850,"y":150},"data":{"label":"Analysis Results","outputType":"display"}}
       ]'),
       PARSE_JSON('[
         {"id":"e1-2","source":"1","target":"2"},
         {"id":"e2-3","source":"2","target":"3"},
         {"id":"e3-4","source":"3","target":"4"}
       ]'),
       TRUE
WHERE NOT EXISTS (SELECT 1 FROM SNOWFLOW_TEMPLATES WHERE template_id = 'tpl-feedback-analyzer');

INSERT INTO SNOWFLOW_TEMPLATES (template_id, name, description, category, complexity, icon, nodes, edges, is_public)
SELECT 'tpl-sales-qa', 'Sales Q&A Bot', 
       'Answer questions about sales data using natural language.',
       'analytics', 'simple', 'BarChart',
       PARSE_JSON('[
         {"id":"1","type":"snowflakeSource","position":{"x":100,"y":150},"data":{"label":"SALES_DATA","database":"SNOWFLOW_DEV","schema":"DEMO","objectType":"table"}},
         {"id":"2","type":"semanticModel","position":{"x":350,"y":150},"data":{"label":"Sales Model","database":"SNOWFLOW_DEV","schema":"DEMO"}},
         {"id":"3","type":"agent","position":{"x":600,"y":150},"data":{"label":"Sales Agent","model":"mistral-large2","systemPrompt":"You are a sales analyst. Answer questions about sales performance, trends, and metrics.","tools":{"analyst":{"enabled":true}}}},
         {"id":"4","type":"output","position":{"x":850,"y":150},"data":{"label":"Sales Insights","outputType":"display"}}
       ]'),
       PARSE_JSON('[
         {"id":"e1-2","source":"1","target":"2"},
         {"id":"e2-3","source":"2","target":"3"},
         {"id":"e3-4","source":"3","target":"4"}
       ]'),
       TRUE
WHERE NOT EXISTS (SELECT 1 FROM SNOWFLOW_TEMPLATES WHERE template_id = 'tpl-sales-qa');

INSERT INTO SNOWFLOW_TEMPLATES (template_id, name, description, category, complexity, icon, nodes, edges, is_public)
SELECT 'tpl-doc-search', 'Document Search (RAG)', 
       'Search and retrieve information from unstructured documents using Cortex Search.',
       'operations', 'medium', 'Search',
       PARSE_JSON('[
         {"id":"1","type":"snowflakeSource","position":{"x":100,"y":150},"data":{"label":"KNOWLEDGE_BASE","database":"SNOWFLOW_DEV","schema":"DEMO","objectType":"table"}},
         {"id":"2","type":"agent","position":{"x":400,"y":150},"data":{"label":"RAG Agent","model":"mistral-large2","systemPrompt":"Answer questions using the retrieved documents. Cite your sources.","tools":{"search":{"enabled":true,"searchServiceName":"doc_search_svc"}}}},
         {"id":"3","type":"output","position":{"x":700,"y":150},"data":{"label":"Search Results","outputType":"display"}}
       ]'),
       PARSE_JSON('[
         {"id":"e1-2","source":"1","target":"2"},
         {"id":"e2-3","source":"2","target":"3"}
       ]'),
       TRUE
WHERE NOT EXISTS (SELECT 1 FROM SNOWFLOW_TEMPLATES WHERE template_id = 'tpl-doc-search');

-- ============================================================
-- Grant permissions (adjust role as needed)
-- ============================================================
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA DEMO TO ROLE <your_role>;

SELECT 'SnowFlow tables created successfully!' as status;


-- SNOWFLOW METADATA TABLES
-- Run this to set up persistence for SnowFlow
-- ============================================================

USE DATABASE SNOWFLOW_DEV;
USE SCHEMA DEMO;

-- ============================================================
-- 1. CUSTOM TOOLS TABLE
-- Stores user-defined tools (SQL, Python UDFs, API configs)
-- ============================================================
CREATE TABLE IF NOT EXISTS SNOWFLOW_TOOLS (
    tool_id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    tool_type VARCHAR(20) NOT NULL,  -- 'sql', 'python', 'api'
    parameters VARIANT,               -- JSON array of parameter definitions
    implementation TEXT,              -- SQL query or Python code
    api_endpoint VARCHAR(500),        -- For API tools
    api_method VARCHAR(10),           -- GET, POST, PUT, DELETE
    api_headers VARIANT,              -- JSON object of headers
    created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    created_by VARCHAR(255),
    updated_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    is_approved BOOLEAN DEFAULT FALSE,
    approved_by VARCHAR(255),
    approved_at TIMESTAMP_NTZ
);

-- ============================================================
-- 2. WORKFLOW TEMPLATES TABLE
-- Stores reusable workflow templates
-- ============================================================
CREATE TABLE IF NOT EXISTS SNOWFLOW_TEMPLATES (
    template_id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50),             -- 'analytics', 'customer', 'operations'
    complexity VARCHAR(20),           -- 'simple', 'medium', 'advanced'
    icon VARCHAR(50),                 -- Icon name for UI
    nodes VARIANT NOT NULL,           -- JSON array of node definitions
    edges VARIANT NOT NULL,           -- JSON array of edge definitions
    created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    created_by VARCHAR(255),
    updated_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    is_public BOOLEAN DEFAULT FALSE,
    usage_count INTEGER DEFAULT 0
);

-- ============================================================
-- 3. SAVED WORKFLOWS TABLE
-- Stores user's saved workflows
-- ============================================================
CREATE TABLE IF NOT EXISTS SNOWFLOW_WORKFLOWS (
    workflow_id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    nodes VARIANT NOT NULL,
    edges VARIANT NOT NULL,
    created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    created_by VARCHAR(255),
    updated_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    last_run_at TIMESTAMP_NTZ,
    run_count INTEGER DEFAULT 0
);

-- ============================================================
-- 4. AUDIT LOG TABLE
-- Tracks all actions for governance
-- ============================================================
CREATE TABLE IF NOT EXISTS SNOWFLOW_AUDIT_LOG (
    log_id VARCHAR(100) PRIMARY KEY,
    action_type VARCHAR(50) NOT NULL,  -- 'workflow_run', 'tool_created', 'template_used', etc.
    entity_type VARCHAR(50),           -- 'workflow', 'tool', 'template'
    entity_id VARCHAR(100),
    entity_name VARCHAR(255),
    user_id VARCHAR(255),
    details VARIANT,                   -- JSON with action details
    created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- ============================================================
-- 5. DATA SOURCE REGISTRY
-- Tracks approved data sources with semantic model status
-- ============================================================
CREATE TABLE IF NOT EXISTS SNOWFLOW_DATA_SOURCES (
    source_id VARCHAR(100) PRIMARY KEY,
    database_name VARCHAR(255) NOT NULL,
    schema_name VARCHAR(255) NOT NULL,
    object_name VARCHAR(255) NOT NULL,
    object_type VARCHAR(50) NOT NULL,  -- 'TABLE', 'VIEW', 'DYNAMIC_TABLE', 'STREAM'
    description TEXT,
    status VARCHAR(20) DEFAULT 'pending',  -- 'ready', 'pending', 'no_access'
    has_semantic_model BOOLEAN DEFAULT FALSE,
    semantic_model_path VARCHAR(500),
    row_count BIGINT,
    last_updated TIMESTAMP_NTZ,
    registered_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    registered_by VARCHAR(255)
);

-- ============================================================
-- SEED: Add some initial templates
-- ============================================================
INSERT INTO SNOWFLOW_TEMPLATES (template_id, name, description, category, complexity, icon, nodes, edges, is_public)
SELECT 'tpl-feedback-analyzer', 'Customer Feedback Analyzer', 
       'Analyzes customer feedback for sentiment and key issues using Cortex AI.',
       'customer', 'simple', 'MessageSquare',
       PARSE_JSON('[
         {"id":"1","type":"snowflakeSource","position":{"x":100,"y":150},"data":{"label":"CUSTOMER_FEEDBACK","database":"SNOWFLOW_DEV","schema":"DEMO","objectType":"table"}},
         {"id":"2","type":"semanticModel","position":{"x":350,"y":150},"data":{"label":"Feedback Model","database":"SNOWFLOW_DEV","schema":"DEMO"}},
         {"id":"3","type":"agent","position":{"x":600,"y":150},"data":{"label":"Feedback Agent","model":"mistral-large2","systemPrompt":"Analyze customer feedback. Identify sentiment, key themes, and actionable insights.","tools":{"analyst":{"enabled":true}}}},
         {"id":"4","type":"output","position":{"x":850,"y":150},"data":{"label":"Analysis Results","outputType":"display"}}
       ]'),
       PARSE_JSON('[
         {"id":"e1-2","source":"1","target":"2"},
         {"id":"e2-3","source":"2","target":"3"},
         {"id":"e3-4","source":"3","target":"4"}
       ]'),
       TRUE
WHERE NOT EXISTS (SELECT 1 FROM SNOWFLOW_TEMPLATES WHERE template_id = 'tpl-feedback-analyzer');

INSERT INTO SNOWFLOW_TEMPLATES (template_id, name, description, category, complexity, icon, nodes, edges, is_public)
SELECT 'tpl-sales-qa', 'Sales Q&A Bot', 
       'Answer questions about sales data using natural language.',
       'analytics', 'simple', 'BarChart',
       PARSE_JSON('[
         {"id":"1","type":"snowflakeSource","position":{"x":100,"y":150},"data":{"label":"SALES_DATA","database":"SNOWFLOW_DEV","schema":"DEMO","objectType":"table"}},
         {"id":"2","type":"semanticModel","position":{"x":350,"y":150},"data":{"label":"Sales Model","database":"SNOWFLOW_DEV","schema":"DEMO"}},
         {"id":"3","type":"agent","position":{"x":600,"y":150},"data":{"label":"Sales Agent","model":"mistral-large2","systemPrompt":"You are a sales analyst. Answer questions about sales performance, trends, and metrics.","tools":{"analyst":{"enabled":true}}}},
         {"id":"4","type":"output","position":{"x":850,"y":150},"data":{"label":"Sales Insights","outputType":"display"}}
       ]'),
       PARSE_JSON('[
         {"id":"e1-2","source":"1","target":"2"},
         {"id":"e2-3","source":"2","target":"3"},
         {"id":"e3-4","source":"3","target":"4"}
       ]'),
       TRUE
WHERE NOT EXISTS (SELECT 1 FROM SNOWFLOW_TEMPLATES WHERE template_id = 'tpl-sales-qa');

INSERT INTO SNOWFLOW_TEMPLATES (template_id, name, description, category, complexity, icon, nodes, edges, is_public)
SELECT 'tpl-doc-search', 'Document Search (RAG)', 
       'Search and retrieve information from unstructured documents using Cortex Search.',
       'operations', 'medium', 'Search',
       PARSE_JSON('[
         {"id":"1","type":"snowflakeSource","position":{"x":100,"y":150},"data":{"label":"KNOWLEDGE_BASE","database":"SNOWFLOW_DEV","schema":"DEMO","objectType":"table"}},
         {"id":"2","type":"agent","position":{"x":400,"y":150},"data":{"label":"RAG Agent","model":"mistral-large2","systemPrompt":"Answer questions using the retrieved documents. Cite your sources.","tools":{"search":{"enabled":true,"searchServiceName":"doc_search_svc"}}}},
         {"id":"3","type":"output","position":{"x":700,"y":150},"data":{"label":"Search Results","outputType":"display"}}
       ]'),
       PARSE_JSON('[
         {"id":"e1-2","source":"1","target":"2"},
         {"id":"e2-3","source":"2","target":"3"}
       ]'),
       TRUE
WHERE NOT EXISTS (SELECT 1 FROM SNOWFLOW_TEMPLATES WHERE template_id = 'tpl-doc-search');

-- ============================================================
-- Grant permissions (adjust role as needed)
-- ============================================================
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA DEMO TO ROLE <your_role>;

SELECT 'SnowFlow tables created successfully!' as status;












