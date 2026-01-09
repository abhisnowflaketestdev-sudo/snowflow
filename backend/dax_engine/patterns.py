"""
DAX → SQL Pattern Library

A growing database of known DAX function translations to SQL.
This provides deterministic, reliable translations for common patterns.

The LLM translator uses this library as reference context,
and falls back to pattern-based translation when possible.

Design:
- Patterns are organized by DAX function name
- Each pattern includes SQL template and notes
- Supports Snowflake-specific SQL syntax
- Extensible - add new patterns as needed
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Callable, Any
from enum import Enum, auto


class TargetDialect(Enum):
    """SQL dialect for the target database."""
    SNOWFLAKE = auto()
    POSTGRES = auto()
    BIGQUERY = auto()
    GENERIC = auto()


@dataclass
class DaxPattern:
    """
    A pattern for translating a DAX function to SQL.
    
    Attributes:
        dax_function: Name of the DAX function
        sql_template: SQL template with placeholders
        description: Human-readable description
        notes: Implementation notes
        examples: Example translations
        snowflake_specific: Uses Snowflake-specific features
        requires_context: Whether schema context is needed
    """
    dax_function: str
    sql_template: str
    description: str
    notes: str = ""
    examples: List[Dict[str, str]] = field(default_factory=list)
    snowflake_specific: bool = False
    requires_context: bool = False
    complexity: str = "simple"  # simple, moderate, complex
    

class PatternLibrary:
    """
    Library of DAX → SQL translation patterns.
    
    Usage:
        lib = PatternLibrary()
        pattern = lib.get_pattern("SUM")
        if pattern:
            sql_template = pattern.sql_template
    """
    
    def __init__(self, dialect: TargetDialect = TargetDialect.SNOWFLAKE):
        self.dialect = dialect
        self._patterns: Dict[str, DaxPattern] = {}
        self._load_patterns()
    
    def get_pattern(self, function_name: str) -> Optional[DaxPattern]:
        """Get pattern for a DAX function."""
        return self._patterns.get(function_name.upper())
    
    def has_pattern(self, function_name: str) -> bool:
        """Check if a pattern exists for this function."""
        return function_name.upper() in self._patterns
    
    def list_patterns(self) -> List[str]:
        """List all available patterns."""
        return list(self._patterns.keys())
    
    def add_pattern(self, pattern: DaxPattern) -> None:
        """Add a new pattern to the library."""
        self._patterns[pattern.dax_function.upper()] = pattern
    
    def _load_patterns(self) -> None:
        """Load all predefined patterns."""
        patterns = self._get_all_patterns()
        for pattern in patterns:
            self._patterns[pattern.dax_function.upper()] = pattern
    
    def _get_all_patterns(self) -> List[DaxPattern]:
        """Define all DAX → SQL patterns."""
        return [
            # ========== AGGREGATION FUNCTIONS ==========
            DaxPattern(
                dax_function="SUM",
                sql_template="SUM({column})",
                description="Sum of a column",
                examples=[
                    {"dax": "SUM(Sales[Amount])", "sql": "SUM(sales.amount)"},
                ],
                complexity="simple",
            ),
            
            DaxPattern(
                dax_function="SUMX",
                sql_template="SUM({row_expression})",
                description="Sum of an expression evaluated for each row",
                notes="Requires joining tables and evaluating per-row expression",
                examples=[
                    {
                        "dax": "SUMX(Sales, Sales[Quantity] * Sales[Price])",
                        "sql": "SUM(sales.quantity * sales.price)",
                    },
                ],
                requires_context=True,
                complexity="moderate",
            ),
            
            DaxPattern(
                dax_function="AVERAGE",
                sql_template="AVG({column})",
                description="Average of a column",
                examples=[
                    {"dax": "AVERAGE(Sales[Amount])", "sql": "AVG(sales.amount)"},
                ],
                complexity="simple",
            ),
            
            DaxPattern(
                dax_function="AVERAGEX",
                sql_template="AVG({row_expression})",
                description="Average of an expression evaluated for each row",
                requires_context=True,
                complexity="moderate",
            ),
            
            DaxPattern(
                dax_function="COUNT",
                sql_template="COUNT({column})",
                description="Count of non-blank values in a column",
                examples=[
                    {"dax": "COUNT(Sales[OrderID])", "sql": "COUNT(sales.order_id)"},
                ],
                complexity="simple",
            ),
            
            DaxPattern(
                dax_function="COUNTROWS",
                sql_template="COUNT(*)",
                description="Count of rows in a table",
                examples=[
                    {"dax": "COUNTROWS(Sales)", "sql": "COUNT(*)"},
                ],
                complexity="simple",
            ),
            
            DaxPattern(
                dax_function="DISTINCTCOUNT",
                sql_template="COUNT(DISTINCT {column})",
                description="Count of distinct values",
                examples=[
                    {"dax": "DISTINCTCOUNT(Sales[CustomerID])", "sql": "COUNT(DISTINCT sales.customer_id)"},
                ],
                complexity="simple",
            ),
            
            DaxPattern(
                dax_function="MIN",
                sql_template="MIN({column})",
                description="Minimum value in a column",
                complexity="simple",
            ),
            
            DaxPattern(
                dax_function="MAX",
                sql_template="MAX({column})",
                description="Maximum value in a column",
                complexity="simple",
            ),
            
            # ========== FILTER FUNCTIONS ==========
            DaxPattern(
                dax_function="CALCULATE",
                sql_template="""
SELECT {aggregation}
FROM {table}
WHERE {filter_conditions}
""".strip(),
                description="Evaluate expression in modified filter context",
                notes="This is the most complex DAX function. The SQL depends heavily on the filter arguments.",
                examples=[
                    {
                        "dax": "CALCULATE(SUM(Sales[Amount]), Sales[Region] = \"West\")",
                        "sql": "SELECT SUM(amount) FROM sales WHERE region = 'West'",
                    },
                ],
                requires_context=True,
                complexity="complex",
            ),
            
            DaxPattern(
                dax_function="FILTER",
                sql_template="{table} WHERE {condition}",
                description="Returns a filtered table",
                notes="Often used inside CALCULATE or SUMX",
                requires_context=True,
                complexity="moderate",
            ),
            
            DaxPattern(
                dax_function="ALL",
                sql_template="-- Removes all filters from {table_or_column}",
                description="Removes all filters from specified table or columns",
                notes="In SQL, this means joining to the unfiltered table or removing WHERE clauses",
                requires_context=True,
                complexity="complex",
            ),
            
            DaxPattern(
                dax_function="ALLEXCEPT",
                sql_template="-- Removes filters except on {kept_columns}",
                description="Removes filters except on specified columns",
                requires_context=True,
                complexity="complex",
            ),
            
            DaxPattern(
                dax_function="VALUES",
                sql_template="SELECT DISTINCT {column} FROM {table}",
                description="Returns distinct values from a column",
                complexity="simple",
            ),
            
            # ========== TIME INTELLIGENCE ==========
            DaxPattern(
                dax_function="SAMEPERIODLASTYEAR",
                sql_template="DATEADD(year, -1, {date_column})",
                description="Returns dates shifted back one year",
                notes="Use with date filter context",
                examples=[
                    {
                        "dax": "CALCULATE(SUM(Sales[Amount]), SAMEPERIODLASTYEAR('Date'[Date]))",
                        "sql": """
SELECT SUM(s.amount)
FROM sales s
JOIN date d ON s.date_key = d.date_key
WHERE d.date BETWEEN DATEADD(year, -1, :start_date) AND DATEADD(year, -1, :end_date)
""".strip(),
                    },
                ],
                snowflake_specific=True,
                requires_context=True,
                complexity="moderate",
            ),
            
            DaxPattern(
                dax_function="DATEADD",
                sql_template="DATEADD({interval}, {number}, {date_column})",
                description="Returns dates shifted by specified interval",
                notes="Intervals: day, week, month, quarter, year",
                examples=[
                    {
                        "dax": "DATEADD('Date'[Date], -1, MONTH)",
                        "sql": "DATEADD(month, -1, date)",
                    },
                ],
                snowflake_specific=True,
                complexity="simple",
            ),
            
            DaxPattern(
                dax_function="DATESYTD",
                sql_template="""
{date_column} BETWEEN DATE_TRUNC('year', {current_date}) AND {current_date}
""".strip(),
                description="Returns year-to-date dates",
                snowflake_specific=True,
                complexity="moderate",
            ),
            
            DaxPattern(
                dax_function="DATESMTD",
                sql_template="""
{date_column} BETWEEN DATE_TRUNC('month', {current_date}) AND {current_date}
""".strip(),
                description="Returns month-to-date dates",
                snowflake_specific=True,
                complexity="moderate",
            ),
            
            DaxPattern(
                dax_function="TOTALYTD",
                sql_template="""
SELECT SUM({measure})
FROM {table}
WHERE {date_column} BETWEEN DATE_TRUNC('year', {end_date}) AND {end_date}
""".strip(),
                description="Year-to-date total",
                snowflake_specific=True,
                requires_context=True,
                complexity="moderate",
            ),
            
            DaxPattern(
                dax_function="PREVIOUSYEAR",
                sql_template="""
{date_column} BETWEEN DATEADD(year, -1, DATE_TRUNC('year', {current_date}))
                   AND DATEADD(year, -1, LAST_DAY({current_date}, 'year'))
""".strip(),
                description="Returns dates for the previous year",
                snowflake_specific=True,
                complexity="moderate",
            ),
            
            DaxPattern(
                dax_function="PREVIOUSMONTH",
                sql_template="""
{date_column} BETWEEN DATEADD(month, -1, DATE_TRUNC('month', {current_date}))
                   AND DATEADD(day, -1, DATE_TRUNC('month', {current_date}))
""".strip(),
                description="Returns dates for the previous month",
                snowflake_specific=True,
                complexity="moderate",
            ),
            
            DaxPattern(
                dax_function="PARALLELPERIOD",
                sql_template="DATEADD({interval}, {offset}, {date_column})",
                description="Returns parallel period dates",
                snowflake_specific=True,
                requires_context=True,
                complexity="moderate",
            ),
            
            # ========== LOGICAL FUNCTIONS ==========
            DaxPattern(
                dax_function="IF",
                sql_template="CASE WHEN {condition} THEN {true_result} ELSE {false_result} END",
                description="Conditional expression",
                examples=[
                    {
                        "dax": "IF([Sales] > 1000, \"High\", \"Low\")",
                        "sql": "CASE WHEN sales > 1000 THEN 'High' ELSE 'Low' END",
                    },
                ],
                complexity="simple",
            ),
            
            DaxPattern(
                dax_function="SWITCH",
                sql_template="""
CASE {expression}
    WHEN {value1} THEN {result1}
    WHEN {value2} THEN {result2}
    ELSE {default}
END
""".strip(),
                description="Multi-way conditional",
                complexity="moderate",
            ),
            
            DaxPattern(
                dax_function="IFERROR",
                sql_template="COALESCE(TRY_CAST({expression} AS {type}), {default})",
                description="Returns alternate value if error",
                notes="Snowflake uses TRY_* functions for error handling",
                snowflake_specific=True,
                complexity="moderate",
            ),
            
            DaxPattern(
                dax_function="ISBLANK",
                sql_template="{column} IS NULL",
                description="Check if value is blank/null",
                examples=[
                    {
                        "dax": "ISBLANK([Name])",
                        "sql": "name IS NULL",
                    },
                ],
                complexity="simple",
            ),
            
            DaxPattern(
                dax_function="COALESCE",
                sql_template="COALESCE({value1}, {value2}, ...)",
                description="Returns first non-null value",
                complexity="simple",
            ),
            
            # ========== MATH FUNCTIONS ==========
            DaxPattern(
                dax_function="DIVIDE",
                sql_template="NULLIF({denominator}, 0) AS divisor, {numerator} / divisor",
                description="Safe division with zero handling",
                notes="DIVIDE(a, b, alt) = if b=0 then alt else a/b",
                examples=[
                    {
                        "dax": "DIVIDE([Revenue], [Quantity])",
                        "sql": "CASE WHEN quantity = 0 THEN NULL ELSE revenue / quantity END",
                    },
                    {
                        "dax": "DIVIDE([Revenue], [Quantity], 0)",
                        "sql": "CASE WHEN quantity = 0 THEN 0 ELSE revenue / quantity END",
                    },
                ],
                complexity="simple",
            ),
            
            DaxPattern(
                dax_function="ABS",
                sql_template="ABS({value})",
                description="Absolute value",
                complexity="simple",
            ),
            
            DaxPattern(
                dax_function="ROUND",
                sql_template="ROUND({value}, {decimals})",
                description="Round to specified decimals",
                complexity="simple",
            ),
            
            DaxPattern(
                dax_function="INT",
                sql_template="FLOOR({value})",
                description="Truncate to integer",
                complexity="simple",
            ),
            
            DaxPattern(
                dax_function="MOD",
                sql_template="MOD({number}, {divisor})",
                description="Modulo operation",
                complexity="simple",
            ),
            
            DaxPattern(
                dax_function="POWER",
                sql_template="POWER({base}, {exponent})",
                description="Raise to power",
                complexity="simple",
            ),
            
            DaxPattern(
                dax_function="SQRT",
                sql_template="SQRT({value})",
                description="Square root",
                complexity="simple",
            ),
            
            # ========== TEXT FUNCTIONS ==========
            DaxPattern(
                dax_function="CONCATENATE",
                sql_template="CONCAT({text1}, {text2})",
                description="Concatenate two strings",
                examples=[
                    {
                        "dax": "CONCATENATE([FirstName], [LastName])",
                        "sql": "CONCAT(first_name, last_name)",
                    },
                ],
                complexity="simple",
            ),
            
            DaxPattern(
                dax_function="LEFT",
                sql_template="LEFT({text}, {num_chars})",
                description="Left substring",
                complexity="simple",
            ),
            
            DaxPattern(
                dax_function="RIGHT",
                sql_template="RIGHT({text}, {num_chars})",
                description="Right substring",
                complexity="simple",
            ),
            
            DaxPattern(
                dax_function="MID",
                sql_template="SUBSTR({text}, {start}, {num_chars})",
                description="Middle substring",
                snowflake_specific=True,
                complexity="simple",
            ),
            
            DaxPattern(
                dax_function="LEN",
                sql_template="LENGTH({text})",
                description="String length",
                snowflake_specific=True,
                complexity="simple",
            ),
            
            DaxPattern(
                dax_function="UPPER",
                sql_template="UPPER({text})",
                description="Convert to uppercase",
                complexity="simple",
            ),
            
            DaxPattern(
                dax_function="LOWER",
                sql_template="LOWER({text})",
                description="Convert to lowercase",
                complexity="simple",
            ),
            
            DaxPattern(
                dax_function="TRIM",
                sql_template="TRIM({text})",
                description="Remove leading/trailing whitespace",
                complexity="simple",
            ),
            
            DaxPattern(
                dax_function="FORMAT",
                sql_template="TO_VARCHAR({value}, {format_string})",
                description="Format value as string",
                notes="Format strings differ between DAX and Snowflake",
                snowflake_specific=True,
                complexity="moderate",
            ),
            
            # ========== TABLE FUNCTIONS ==========
            DaxPattern(
                dax_function="SUMMARIZE",
                sql_template="""
SELECT {group_by_columns}, {aggregations}
FROM {table}
GROUP BY {group_by_columns}
""".strip(),
                description="Group by and aggregate",
                requires_context=True,
                complexity="moderate",
            ),
            
            DaxPattern(
                dax_function="ADDCOLUMNS",
                sql_template="""
SELECT *, {new_column_expression} AS {new_column_name}
FROM {table}
""".strip(),
                description="Add calculated columns to table",
                requires_context=True,
                complexity="moderate",
            ),
            
            DaxPattern(
                dax_function="SELECTCOLUMNS",
                sql_template="""
SELECT {column_expressions}
FROM {table}
""".strip(),
                description="Select specific columns with optional rename",
                requires_context=True,
                complexity="moderate",
            ),
            
            DaxPattern(
                dax_function="TOPN",
                sql_template="""
SELECT TOP {n} *
FROM {table}
ORDER BY {order_by} {direction}
""".strip(),
                description="Top N rows",
                snowflake_specific=True,
                complexity="moderate",
            ),
            
            DaxPattern(
                dax_function="UNION",
                sql_template="{table1} UNION ALL {table2}",
                description="Combine tables",
                complexity="simple",
            ),
            
            DaxPattern(
                dax_function="CROSSJOIN",
                sql_template="{table1} CROSS JOIN {table2}",
                description="Cartesian product of tables",
                complexity="simple",
            ),
            
            # ========== RELATIONSHIP FUNCTIONS ==========
            DaxPattern(
                dax_function="RELATED",
                sql_template="{related_table}.{column}",
                description="Get value from related table",
                notes="Requires JOIN in SQL based on relationship",
                requires_context=True,
                complexity="moderate",
            ),
            
            DaxPattern(
                dax_function="RELATEDTABLE",
                sql_template="""
SELECT * FROM {related_table} 
WHERE {foreign_key} = {primary_key}
""".strip(),
                description="Get related table rows",
                requires_context=True,
                complexity="moderate",
            ),
        ]
    
    def get_patterns_by_category(self, category: str) -> List[DaxPattern]:
        """Get all patterns in a category."""
        category_functions = {
            "aggregation": ["SUM", "SUMX", "AVERAGE", "AVERAGEX", "COUNT", 
                          "COUNTROWS", "DISTINCTCOUNT", "MIN", "MAX"],
            "filter": ["CALCULATE", "FILTER", "ALL", "ALLEXCEPT", "VALUES"],
            "time_intelligence": ["SAMEPERIODLASTYEAR", "DATEADD", "DATESYTD",
                                 "DATESMTD", "TOTALYTD", "PREVIOUSYEAR", 
                                 "PREVIOUSMONTH", "PARALLELPERIOD"],
            "logical": ["IF", "SWITCH", "IFERROR", "ISBLANK", "COALESCE"],
            "math": ["DIVIDE", "ABS", "ROUND", "INT", "MOD", "POWER", "SQRT"],
            "text": ["CONCATENATE", "LEFT", "RIGHT", "MID", "LEN", "UPPER",
                    "LOWER", "TRIM", "FORMAT"],
            "table": ["SUMMARIZE", "ADDCOLUMNS", "SELECTCOLUMNS", "TOPN",
                     "UNION", "CROSSJOIN"],
            "relationship": ["RELATED", "RELATEDTABLE"],
        }
        
        functions = category_functions.get(category.lower(), [])
        return [self._patterns[f] for f in functions if f in self._patterns]
    
    def to_prompt_context(self) -> str:
        """
        Generate pattern context for LLM prompts.
        
        Returns a formatted string describing available patterns
        that can be included in translation prompts.
        """
        lines = ["# DAX → Snowflake SQL Pattern Reference\n"]
        
        categories = [
            ("Aggregation", "aggregation"),
            ("Filter", "filter"),
            ("Time Intelligence", "time_intelligence"),
            ("Logical", "logical"),
            ("Math", "math"),
            ("Text", "text"),
            ("Table", "table"),
        ]
        
        for title, category in categories:
            patterns = self.get_patterns_by_category(category)
            if patterns:
                lines.append(f"\n## {title} Functions\n")
                for p in patterns:
                    lines.append(f"- {p.dax_function}: {p.description}")
                    if p.examples:
                        ex = p.examples[0]
                        lines.append(f"  DAX: `{ex['dax']}`")
                        lines.append(f"  SQL: `{ex['sql']}`")
        
        return "\n".join(lines)


# Singleton instance for convenience
_default_library: Optional[PatternLibrary] = None


def get_pattern_library() -> PatternLibrary:
    """Get the default pattern library instance."""
    global _default_library
    if _default_library is None:
        _default_library = PatternLibrary()
    return _default_library











