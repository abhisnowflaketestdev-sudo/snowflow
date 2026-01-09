# Semantic Model Interchange Format

> Universal JSON schema for transferring semantic models between platforms (Power BI, Snowflake, dbt, etc.)

## Overview

This interchange format enables **agent-to-agent semantic model translation**:

```
Power BI TMDL → [MS Agent] → Interchange JSON → [Snowflake Agent] → Cortex YAML
```

---

## Schema Specification (v1.0)

```json
{
  "$schema": "https://snowflow.dev/schemas/semantic-interchange-v1.json",
  "version": "1.0",
  "metadata": {
    "name": "Model Name",
    "description": "Business description of the model",
    "source_platform": "powerbi|snowflake|dbt|looker|tableau",
    "created_at": "2024-11-28T00:00:00Z",
    "created_by": "agent|user"
  },
  "tables": [...],
  "relationships": [...],
  "measures": [...],
  "dimensions": [...],
  "time_dimensions": [...],
  "sample_questions": [...]
}
```

---

## Tables

```json
{
  "tables": [
    {
      "name": "fact_sales",
      "physical_name": "SNOWFLOW_DEV.DEMO.SALES_DATA",
      "description": "Sales transactions at the line item level",
      "table_type": "fact|dimension|bridge",
      "columns": [
        {
          "name": "revenue",
          "physical_name": "REVENUE",
          "data_type": "DECIMAL(18,2)",
          "description": "Total sale amount in USD",
          "synonyms": ["sales", "amount", "total", "sale amount"],
          "is_nullable": false,
          "is_primary_key": false,
          "sample_values": ["100.00", "250.50", "1000.00"]
        }
      ]
    }
  ]
}
```

---

## Relationships

```json
{
  "relationships": [
    {
      "name": "sales_to_customer",
      "from_table": "fact_sales",
      "from_column": "customer_id",
      "to_table": "dim_customer",
      "to_column": "customer_id",
      "cardinality": "many_to_one|one_to_one|many_to_many",
      "is_active": true,
      "description": "Links sales transactions to customer records"
    }
  ]
}
```

---

## Measures

Measures are calculations that may need platform-specific translation.

```json
{
  "measures": [
    {
      "name": "Total Revenue",
      "description": "Sum of all revenue across all transactions",
      "return_type": "DECIMAL",
      "original_expression": {
        "platform": "powerbi",
        "language": "DAX",
        "code": "SUM(fact_sales[revenue])"
      },
      "suggested_sql": "SUM(revenue)",
      "aggregation_type": "sum|avg|count|min|max|custom",
      "base_column": "fact_sales.revenue",
      "sample_questions": [
        "What is the total revenue?",
        "Show me total sales"
      ],
      "translation_confidence": "high|medium|low",
      "translation_notes": "Direct translation - simple SUM aggregation"
    },
    {
      "name": "YoY Revenue Growth",
      "description": "Year-over-year revenue growth percentage",
      "return_type": "DECIMAL",
      "original_expression": {
        "platform": "powerbi",
        "language": "DAX",
        "code": "DIVIDE([Total Revenue] - CALCULATE([Total Revenue], SAMEPERIODLASTYEAR('Date'[Date])), CALCULATE([Total Revenue], SAMEPERIODLASTYEAR('Date'[Date])))"
      },
      "suggested_sql": "(SUM(CASE WHEN YEAR(date) = YEAR(CURRENT_DATE) THEN revenue END) - SUM(CASE WHEN YEAR(date) = YEAR(CURRENT_DATE) - 1 THEN revenue END)) / NULLIF(SUM(CASE WHEN YEAR(date) = YEAR(CURRENT_DATE) - 1 THEN revenue END), 0)",
      "aggregation_type": "custom",
      "translation_confidence": "medium",
      "translation_notes": "DAX time intelligence translated to SQL window functions. Verify date handling."
    }
  ]
}
```

---

## Dimensions

```json
{
  "dimensions": [
    {
      "name": "Product Category",
      "description": "Product category for grouping",
      "table": "dim_product",
      "column": "category",
      "synonyms": ["category", "product type", "product group"],
      "hierarchy": ["category", "subcategory", "product_name"]
    }
  ]
}
```

---

## Time Dimensions

```json
{
  "time_dimensions": [
    {
      "name": "Order Date",
      "description": "Date when the order was placed",
      "table": "fact_sales",
      "column": "order_date",
      "time_granularities": ["day", "week", "month", "quarter", "year"],
      "fiscal_year_start_month": 1
    }
  ]
}
```

---

## Sample Questions

LLM-friendly questions that demonstrate how to query the model.

```json
{
  "sample_questions": [
    {
      "question": "What was the total revenue last quarter?",
      "intent": "aggregation",
      "measures_used": ["Total Revenue"],
      "filters": ["time = last quarter"]
    },
    {
      "question": "Which product category has the highest sales?",
      "intent": "ranking",
      "measures_used": ["Total Revenue"],
      "dimensions_used": ["Product Category"]
    }
  ]
}
```

---

## Platform-Specific Extensions

### Power BI Extensions

```json
{
  "powerbi_extensions": {
    "display_folders": {...},
    "row_level_security": [...],
    "calculation_groups": [...],
    "perspectives": [...]
  }
}
```

### Snowflake Extensions

```json
{
  "snowflake_extensions": {
    "warehouse": "COMPUTE_WH",
    "stage_location": "@SEMANTIC_MODELS",
    "cortex_search_services": [...],
    "access_policies": [...]
  }
}
```

---

## Example: Full Interchange Document

```json
{
  "$schema": "https://snowflow.dev/schemas/semantic-interchange-v1.json",
  "version": "1.0",
  "metadata": {
    "name": "Sales Analytics Model",
    "description": "Enterprise sales analytics covering orders, customers, and products",
    "source_platform": "powerbi",
    "created_at": "2024-11-28T10:00:00Z",
    "created_by": "ms-copilot-agent"
  },
  "tables": [
    {
      "name": "fact_sales",
      "physical_name": "SALES_DATA",
      "description": "Sales transactions",
      "table_type": "fact",
      "columns": [
        {"name": "sale_id", "data_type": "INTEGER", "description": "Unique sale identifier", "is_primary_key": true},
        {"name": "customer_id", "data_type": "INTEGER", "description": "Foreign key to customer"},
        {"name": "product_id", "data_type": "INTEGER", "description": "Foreign key to product"},
        {"name": "revenue", "data_type": "DECIMAL(18,2)", "description": "Sale amount", "synonyms": ["sales", "amount"]},
        {"name": "quantity", "data_type": "INTEGER", "description": "Units sold"},
        {"name": "order_date", "data_type": "DATE", "description": "Date of sale"}
      ]
    },
    {
      "name": "dim_customer",
      "physical_name": "CUSTOMERS",
      "description": "Customer master data",
      "table_type": "dimension",
      "columns": [
        {"name": "customer_id", "data_type": "INTEGER", "is_primary_key": true},
        {"name": "customer_name", "data_type": "VARCHAR", "synonyms": ["name", "customer"]},
        {"name": "region", "data_type": "VARCHAR", "synonyms": ["territory", "area"]}
      ]
    }
  ],
  "relationships": [
    {
      "name": "sales_customer",
      "from_table": "fact_sales",
      "from_column": "customer_id",
      "to_table": "dim_customer",
      "to_column": "customer_id",
      "cardinality": "many_to_one"
    }
  ],
  "measures": [
    {
      "name": "Total Revenue",
      "description": "Sum of all sales revenue",
      "original_expression": {"platform": "powerbi", "language": "DAX", "code": "SUM(fact_sales[revenue])"},
      "suggested_sql": "SUM(revenue)",
      "aggregation_type": "sum",
      "translation_confidence": "high"
    }
  ],
  "dimensions": [
    {
      "name": "Customer Region",
      "table": "dim_customer",
      "column": "region",
      "synonyms": ["region", "territory", "area"]
    }
  ],
  "time_dimensions": [
    {
      "name": "Order Date",
      "table": "fact_sales",
      "column": "order_date",
      "time_granularities": ["day", "month", "quarter", "year"]
    }
  ],
  "sample_questions": [
    {"question": "What is the total revenue?", "measures_used": ["Total Revenue"]},
    {"question": "Show revenue by region", "measures_used": ["Total Revenue"], "dimensions_used": ["Customer Region"]},
    {"question": "What were sales last month?", "measures_used": ["Total Revenue"], "filters": ["Order Date = last month"]}
  ]
}
```

---

## Agent Prompts

### MS Copilot Agent: TMDL → Interchange JSON

```
You are a semantic model expert. Given a Power BI TMDL file, extract:
1. All tables and columns with descriptions
2. Relationships between tables
3. DAX measures - preserve original DAX and suggest SQL equivalent
4. Mark translation confidence (high/medium/low)

Output as JSON following the Semantic Model Interchange Format v1.0.
```

### Snowflake Cortex Agent: Interchange JSON → YAML

```
You are a Snowflake Cortex semantic model expert. Given an Interchange JSON:
1. Generate a valid Cortex Analyst YAML file
2. Map tables to Snowflake fully-qualified names
3. Convert measures to Snowflake SQL syntax
4. Add synonyms and sample_questions for LLM understanding
5. Flag any measures that need manual review

Output as valid YAML for Snowflake Cortex Analyst.
```

---

*Version: 1.0 | Last Updated: 2024-11-28*



> Universal JSON schema for transferring semantic models between platforms (Power BI, Snowflake, dbt, etc.)

## Overview

This interchange format enables **agent-to-agent semantic model translation**:

```
Power BI TMDL → [MS Agent] → Interchange JSON → [Snowflake Agent] → Cortex YAML
```

---

## Schema Specification (v1.0)

```json
{
  "$schema": "https://snowflow.dev/schemas/semantic-interchange-v1.json",
  "version": "1.0",
  "metadata": {
    "name": "Model Name",
    "description": "Business description of the model",
    "source_platform": "powerbi|snowflake|dbt|looker|tableau",
    "created_at": "2024-11-28T00:00:00Z",
    "created_by": "agent|user"
  },
  "tables": [...],
  "relationships": [...],
  "measures": [...],
  "dimensions": [...],
  "time_dimensions": [...],
  "sample_questions": [...]
}
```

---

## Tables

```json
{
  "tables": [
    {
      "name": "fact_sales",
      "physical_name": "SNOWFLOW_DEV.DEMO.SALES_DATA",
      "description": "Sales transactions at the line item level",
      "table_type": "fact|dimension|bridge",
      "columns": [
        {
          "name": "revenue",
          "physical_name": "REVENUE",
          "data_type": "DECIMAL(18,2)",
          "description": "Total sale amount in USD",
          "synonyms": ["sales", "amount", "total", "sale amount"],
          "is_nullable": false,
          "is_primary_key": false,
          "sample_values": ["100.00", "250.50", "1000.00"]
        }
      ]
    }
  ]
}
```

---

## Relationships

```json
{
  "relationships": [
    {
      "name": "sales_to_customer",
      "from_table": "fact_sales",
      "from_column": "customer_id",
      "to_table": "dim_customer",
      "to_column": "customer_id",
      "cardinality": "many_to_one|one_to_one|many_to_many",
      "is_active": true,
      "description": "Links sales transactions to customer records"
    }
  ]
}
```

---

## Measures

Measures are calculations that may need platform-specific translation.

```json
{
  "measures": [
    {
      "name": "Total Revenue",
      "description": "Sum of all revenue across all transactions",
      "return_type": "DECIMAL",
      "original_expression": {
        "platform": "powerbi",
        "language": "DAX",
        "code": "SUM(fact_sales[revenue])"
      },
      "suggested_sql": "SUM(revenue)",
      "aggregation_type": "sum|avg|count|min|max|custom",
      "base_column": "fact_sales.revenue",
      "sample_questions": [
        "What is the total revenue?",
        "Show me total sales"
      ],
      "translation_confidence": "high|medium|low",
      "translation_notes": "Direct translation - simple SUM aggregation"
    },
    {
      "name": "YoY Revenue Growth",
      "description": "Year-over-year revenue growth percentage",
      "return_type": "DECIMAL",
      "original_expression": {
        "platform": "powerbi",
        "language": "DAX",
        "code": "DIVIDE([Total Revenue] - CALCULATE([Total Revenue], SAMEPERIODLASTYEAR('Date'[Date])), CALCULATE([Total Revenue], SAMEPERIODLASTYEAR('Date'[Date])))"
      },
      "suggested_sql": "(SUM(CASE WHEN YEAR(date) = YEAR(CURRENT_DATE) THEN revenue END) - SUM(CASE WHEN YEAR(date) = YEAR(CURRENT_DATE) - 1 THEN revenue END)) / NULLIF(SUM(CASE WHEN YEAR(date) = YEAR(CURRENT_DATE) - 1 THEN revenue END), 0)",
      "aggregation_type": "custom",
      "translation_confidence": "medium",
      "translation_notes": "DAX time intelligence translated to SQL window functions. Verify date handling."
    }
  ]
}
```

---

## Dimensions

```json
{
  "dimensions": [
    {
      "name": "Product Category",
      "description": "Product category for grouping",
      "table": "dim_product",
      "column": "category",
      "synonyms": ["category", "product type", "product group"],
      "hierarchy": ["category", "subcategory", "product_name"]
    }
  ]
}
```

---

## Time Dimensions

```json
{
  "time_dimensions": [
    {
      "name": "Order Date",
      "description": "Date when the order was placed",
      "table": "fact_sales",
      "column": "order_date",
      "time_granularities": ["day", "week", "month", "quarter", "year"],
      "fiscal_year_start_month": 1
    }
  ]
}
```

---

## Sample Questions

LLM-friendly questions that demonstrate how to query the model.

```json
{
  "sample_questions": [
    {
      "question": "What was the total revenue last quarter?",
      "intent": "aggregation",
      "measures_used": ["Total Revenue"],
      "filters": ["time = last quarter"]
    },
    {
      "question": "Which product category has the highest sales?",
      "intent": "ranking",
      "measures_used": ["Total Revenue"],
      "dimensions_used": ["Product Category"]
    }
  ]
}
```

---

## Platform-Specific Extensions

### Power BI Extensions

```json
{
  "powerbi_extensions": {
    "display_folders": {...},
    "row_level_security": [...],
    "calculation_groups": [...],
    "perspectives": [...]
  }
}
```

### Snowflake Extensions

```json
{
  "snowflake_extensions": {
    "warehouse": "COMPUTE_WH",
    "stage_location": "@SEMANTIC_MODELS",
    "cortex_search_services": [...],
    "access_policies": [...]
  }
}
```

---

## Example: Full Interchange Document

```json
{
  "$schema": "https://snowflow.dev/schemas/semantic-interchange-v1.json",
  "version": "1.0",
  "metadata": {
    "name": "Sales Analytics Model",
    "description": "Enterprise sales analytics covering orders, customers, and products",
    "source_platform": "powerbi",
    "created_at": "2024-11-28T10:00:00Z",
    "created_by": "ms-copilot-agent"
  },
  "tables": [
    {
      "name": "fact_sales",
      "physical_name": "SALES_DATA",
      "description": "Sales transactions",
      "table_type": "fact",
      "columns": [
        {"name": "sale_id", "data_type": "INTEGER", "description": "Unique sale identifier", "is_primary_key": true},
        {"name": "customer_id", "data_type": "INTEGER", "description": "Foreign key to customer"},
        {"name": "product_id", "data_type": "INTEGER", "description": "Foreign key to product"},
        {"name": "revenue", "data_type": "DECIMAL(18,2)", "description": "Sale amount", "synonyms": ["sales", "amount"]},
        {"name": "quantity", "data_type": "INTEGER", "description": "Units sold"},
        {"name": "order_date", "data_type": "DATE", "description": "Date of sale"}
      ]
    },
    {
      "name": "dim_customer",
      "physical_name": "CUSTOMERS",
      "description": "Customer master data",
      "table_type": "dimension",
      "columns": [
        {"name": "customer_id", "data_type": "INTEGER", "is_primary_key": true},
        {"name": "customer_name", "data_type": "VARCHAR", "synonyms": ["name", "customer"]},
        {"name": "region", "data_type": "VARCHAR", "synonyms": ["territory", "area"]}
      ]
    }
  ],
  "relationships": [
    {
      "name": "sales_customer",
      "from_table": "fact_sales",
      "from_column": "customer_id",
      "to_table": "dim_customer",
      "to_column": "customer_id",
      "cardinality": "many_to_one"
    }
  ],
  "measures": [
    {
      "name": "Total Revenue",
      "description": "Sum of all sales revenue",
      "original_expression": {"platform": "powerbi", "language": "DAX", "code": "SUM(fact_sales[revenue])"},
      "suggested_sql": "SUM(revenue)",
      "aggregation_type": "sum",
      "translation_confidence": "high"
    }
  ],
  "dimensions": [
    {
      "name": "Customer Region",
      "table": "dim_customer",
      "column": "region",
      "synonyms": ["region", "territory", "area"]
    }
  ],
  "time_dimensions": [
    {
      "name": "Order Date",
      "table": "fact_sales",
      "column": "order_date",
      "time_granularities": ["day", "month", "quarter", "year"]
    }
  ],
  "sample_questions": [
    {"question": "What is the total revenue?", "measures_used": ["Total Revenue"]},
    {"question": "Show revenue by region", "measures_used": ["Total Revenue"], "dimensions_used": ["Customer Region"]},
    {"question": "What were sales last month?", "measures_used": ["Total Revenue"], "filters": ["Order Date = last month"]}
  ]
}
```

---

## Agent Prompts

### MS Copilot Agent: TMDL → Interchange JSON

```
You are a semantic model expert. Given a Power BI TMDL file, extract:
1. All tables and columns with descriptions
2. Relationships between tables
3. DAX measures - preserve original DAX and suggest SQL equivalent
4. Mark translation confidence (high/medium/low)

Output as JSON following the Semantic Model Interchange Format v1.0.
```

### Snowflake Cortex Agent: Interchange JSON → YAML

```
You are a Snowflake Cortex semantic model expert. Given an Interchange JSON:
1. Generate a valid Cortex Analyst YAML file
2. Map tables to Snowflake fully-qualified names
3. Convert measures to Snowflake SQL syntax
4. Add synonyms and sample_questions for LLM understanding
5. Flag any measures that need manual review

Output as valid YAML for Snowflake Cortex Analyst.
```

---

*Version: 1.0 | Last Updated: 2024-11-28*












