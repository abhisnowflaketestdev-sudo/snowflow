"""
SQL Validator

Validates generated SQL before returning to the user.

Validation Stages:
1. Syntax Check: Ensure SQL is syntactically valid
2. Schema Check: Verify tables and columns exist
3. Execution Test: Optionally run a test query
4. Result Comparison: Compare SQL result with DAX result (if possible)

Design Principles:
- Non-blocking: Validation issues are warnings, not failures
- Configurable: Enable/disable different validation stages
- Snowflake-aware: Understand Snowflake-specific SQL
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any, Tuple
from enum import Enum, auto
import re


class ValidationLevel(Enum):
    """Level of validation severity."""
    ERROR = auto()      # Critical issue, SQL won't work
    WARNING = auto()    # Potential issue, SQL may work
    INFO = auto()       # Informational message
    SUCCESS = auto()    # Validation passed


@dataclass
class ValidationIssue:
    """
    A single validation issue found.
    
    Attributes:
        level: Severity level
        message: Description of the issue
        location: Where in the SQL the issue was found
        suggestion: Optional fix suggestion
    """
    level: ValidationLevel
    message: str
    location: Optional[str] = None
    suggestion: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "level": self.level.name,
            "message": self.message,
            "location": self.location,
            "suggestion": self.suggestion,
        }


@dataclass
class ValidationResult:
    """
    Result of SQL validation.
    
    Attributes:
        is_valid: Whether the SQL passed validation
        issues: List of issues found
        sql_normalized: Normalized/formatted SQL
        execution_result: Result of test execution (if performed)
    """
    is_valid: bool
    issues: List[ValidationIssue] = field(default_factory=list)
    sql_normalized: str = ""
    execution_result: Optional[Any] = None
    execution_time_ms: Optional[float] = None
    
    @property
    def errors(self) -> List[ValidationIssue]:
        return [i for i in self.issues if i.level == ValidationLevel.ERROR]
    
    @property
    def warnings(self) -> List[ValidationIssue]:
        return [i for i in self.issues if i.level == ValidationLevel.WARNING]
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "is_valid": self.is_valid,
            "issues": [i.to_dict() for i in self.issues],
            "sql_normalized": self.sql_normalized,
            "execution_time_ms": self.execution_time_ms,
            "error_count": len(self.errors),
            "warning_count": len(self.warnings),
        }


class SqlValidator:
    """
    Validates generated SQL for correctness.
    
    Usage:
        validator = SqlValidator()
        result = validator.validate(sql)
        if result.is_valid:
            use(sql)
        else:
            for issue in result.issues:
                handle(issue)
    
    With Snowflake connection:
        validator = SqlValidator(snowflake_client=client)
        result = validator.validate(sql, execute=True)
    """
    
    # Common SQL syntax patterns
    SELECT_PATTERN = re.compile(r'\bSELECT\b', re.IGNORECASE)
    FROM_PATTERN = re.compile(r'\bFROM\b', re.IGNORECASE)
    
    # Snowflake-specific functions
    SNOWFLAKE_FUNCTIONS = {
        "DATEADD", "DATEDIFF", "DATE_TRUNC", "LAST_DAY",
        "TIMESTAMPADD", "TIMESTAMPDIFF",
        "TRY_CAST", "TRY_TO_NUMBER", "TRY_TO_DECIMAL",
        "NVL", "NVL2", "NULLIFZERO", "ZEROIFNULL",
        "IFF", "IFNULL", "COALESCE",
        "REGEXP_LIKE", "REGEXP_REPLACE", "REGEXP_SUBSTR",
        "ARRAY_AGG", "OBJECT_AGG", "LISTAGG",
        "FLATTEN", "LATERAL",
        "QUALIFY", "MATCH_RECOGNIZE",
    }
    
    # SQL reserved words that might indicate issues if used as identifiers
    RESERVED_WORDS = {
        "SELECT", "FROM", "WHERE", "GROUP", "BY", "HAVING",
        "ORDER", "LIMIT", "OFFSET", "JOIN", "LEFT", "RIGHT",
        "INNER", "OUTER", "CROSS", "ON", "AND", "OR", "NOT",
        "IN", "BETWEEN", "LIKE", "IS", "NULL", "TRUE", "FALSE",
        "AS", "CASE", "WHEN", "THEN", "ELSE", "END",
        "UNION", "INTERSECT", "EXCEPT", "ALL", "DISTINCT",
        "INSERT", "UPDATE", "DELETE", "CREATE", "DROP", "ALTER",
        "TABLE", "VIEW", "INDEX", "PROCEDURE", "FUNCTION",
        "PRIMARY", "KEY", "FOREIGN", "REFERENCES", "CONSTRAINT",
        "DEFAULT", "CHECK", "UNIQUE", "NOT", "NULL",
    }
    
    def __init__(self, snowflake_client: Optional[Any] = None):
        """
        Initialize the validator.
        
        Args:
            snowflake_client: Optional Snowflake client for execution testing
        """
        self.snowflake_client = snowflake_client
    
    def validate(
        self,
        sql: str,
        check_syntax: bool = True,
        check_schema: bool = True,
        execute: bool = False,
        limit_rows: int = 1,
    ) -> ValidationResult:
        """
        Validate a SQL expression.
        
        Args:
            sql: SQL to validate
            check_syntax: Perform syntax validation
            check_schema: Verify table/column names
            execute: Run test query
            limit_rows: Limit rows for test execution
            
        Returns:
            ValidationResult
        """
        issues = []
        
        # Normalize SQL
        sql_normalized = self._normalize_sql(sql)
        
        # Syntax validation
        if check_syntax:
            syntax_issues = self._validate_syntax(sql_normalized)
            issues.extend(syntax_issues)
        
        # Schema validation (if we have a client)
        if check_schema and self.snowflake_client:
            schema_issues = self._validate_schema(sql_normalized)
            issues.extend(schema_issues)
        
        # Execution test
        execution_result = None
        execution_time = None
        if execute and self.snowflake_client:
            try:
                exec_result = self._test_execute(sql_normalized, limit_rows)
                execution_result = exec_result.get("result")
                execution_time = exec_result.get("time_ms")
                
                if exec_result.get("error"):
                    issues.append(ValidationIssue(
                        level=ValidationLevel.ERROR,
                        message=f"Execution failed: {exec_result['error']}",
                    ))
            except Exception as e:
                issues.append(ValidationIssue(
                    level=ValidationLevel.WARNING,
                    message=f"Could not test execution: {str(e)}",
                ))
        
        # Determine if valid (no errors)
        is_valid = not any(i.level == ValidationLevel.ERROR for i in issues)
        
        return ValidationResult(
            is_valid=is_valid,
            issues=issues,
            sql_normalized=sql_normalized,
            execution_result=execution_result,
            execution_time_ms=execution_time,
        )
    
    def validate_expression(self, sql_expr: str) -> ValidationResult:
        """
        Validate a SQL expression (not a full statement).
        
        This is for expressions like "SUM(amount)" that aren't full queries.
        """
        issues = []
        
        # Check for obvious issues
        if not sql_expr.strip():
            issues.append(ValidationIssue(
                level=ValidationLevel.ERROR,
                message="Empty expression",
            ))
        
        # Check balanced parentheses
        paren_issues = self._check_balanced_parens(sql_expr)
        issues.extend(paren_issues)
        
        # Check for common mistakes
        mistake_issues = self._check_common_mistakes(sql_expr)
        issues.extend(mistake_issues)
        
        is_valid = not any(i.level == ValidationLevel.ERROR for i in issues)
        
        return ValidationResult(
            is_valid=is_valid,
            issues=issues,
            sql_normalized=sql_expr.strip(),
        )
    
    def _normalize_sql(self, sql: str) -> str:
        """Normalize SQL for consistent validation."""
        # Remove excessive whitespace
        normalized = re.sub(r'\s+', ' ', sql)
        # Trim
        normalized = normalized.strip()
        return normalized
    
    def _validate_syntax(self, sql: str) -> List[ValidationIssue]:
        """Validate SQL syntax."""
        issues = []
        
        # Check for empty SQL
        if not sql.strip():
            issues.append(ValidationIssue(
                level=ValidationLevel.ERROR,
                message="Empty SQL expression",
            ))
            return issues
        
        # Check balanced parentheses
        issues.extend(self._check_balanced_parens(sql))
        
        # Check balanced quotes
        issues.extend(self._check_balanced_quotes(sql))
        
        # Check for incomplete statements
        issues.extend(self._check_incomplete_statements(sql))
        
        # Check for common mistakes
        issues.extend(self._check_common_mistakes(sql))
        
        return issues
    
    def _check_balanced_parens(self, sql: str) -> List[ValidationIssue]:
        """Check for balanced parentheses."""
        issues = []
        
        count = 0
        for i, char in enumerate(sql):
            if char == '(':
                count += 1
            elif char == ')':
                count -= 1
            
            if count < 0:
                issues.append(ValidationIssue(
                    level=ValidationLevel.ERROR,
                    message="Unbalanced parentheses: extra closing parenthesis",
                    location=f"Position {i}",
                ))
                break
        
        if count > 0:
            issues.append(ValidationIssue(
                level=ValidationLevel.ERROR,
                message=f"Unbalanced parentheses: {count} unclosed",
            ))
        
        return issues
    
    def _check_balanced_quotes(self, sql: str) -> List[ValidationIssue]:
        """Check for balanced quotes."""
        issues = []
        
        # Check single quotes
        single_count = sql.count("'") - sql.count("\\'") * 2
        if single_count % 2 != 0:
            issues.append(ValidationIssue(
                level=ValidationLevel.ERROR,
                message="Unbalanced single quotes",
            ))
        
        # Check double quotes (identifiers in some dialects)
        double_count = sql.count('"') - sql.count('\\"') * 2
        if double_count % 2 != 0:
            issues.append(ValidationIssue(
                level=ValidationLevel.ERROR,
                message="Unbalanced double quotes",
            ))
        
        return issues
    
    def _check_incomplete_statements(self, sql: str) -> List[ValidationIssue]:
        """Check for incomplete SQL statements."""
        issues = []
        sql_upper = sql.upper()
        
        # SELECT without aggregation or table reference
        if "SELECT" in sql_upper:
            if "FROM" not in sql_upper and not any(
                func in sql_upper for func in ("SUM(", "AVG(", "COUNT(", "MIN(", "MAX(")
            ):
                # It's an expression, not a statement - this is ok
                pass
        
        # Trailing comma
        if re.search(r',\s*$', sql):
            issues.append(ValidationIssue(
                level=ValidationLevel.ERROR,
                message="Trailing comma at end of expression",
                suggestion="Remove the trailing comma",
            ))
        
        # Trailing AND/OR
        if re.search(r'\b(AND|OR)\s*$', sql, re.IGNORECASE):
            issues.append(ValidationIssue(
                level=ValidationLevel.ERROR,
                message="Incomplete condition: trailing AND/OR",
            ))
        
        return issues
    
    def _check_common_mistakes(self, sql: str) -> List[ValidationIssue]:
        """Check for common SQL mistakes."""
        issues = []
        
        # Using = with NULL instead of IS NULL
        if re.search(r'=\s*NULL\b', sql, re.IGNORECASE):
            issues.append(ValidationIssue(
                level=ValidationLevel.WARNING,
                message="Using = NULL instead of IS NULL",
                suggestion="Use 'IS NULL' or 'IS NOT NULL' for null comparisons",
            ))
        
        # Division by potential zero without safety
        if "/" in sql and "NULLIF" not in sql.upper() and "CASE" not in sql.upper():
            if not re.search(r'/\s*\d+\.?\d*', sql):  # Not dividing by a constant
                issues.append(ValidationIssue(
                    level=ValidationLevel.INFO,
                    message="Division detected - ensure denominator cannot be zero",
                    suggestion="Consider using NULLIF(denominator, 0) or CASE WHEN",
                ))
        
        # Using || for boolean OR in Snowflake (it's string concatenation)
        if "||" in sql and "OR" not in sql.upper():
            # Could be intentional concatenation
            pass
        
        # Comment markers without actual comments
        if "--" in sql and "\n" not in sql:
            issues.append(ValidationIssue(
                level=ValidationLevel.WARNING,
                message="Line comment (--) may hide part of the expression",
            ))
        
        return issues
    
    def _validate_schema(self, sql: str) -> List[ValidationIssue]:
        """Validate table and column names against schema."""
        # This would require database introspection
        # For now, just return empty list
        return []
    
    def _test_execute(self, sql: str, limit_rows: int) -> Dict[str, Any]:
        """Test execute the SQL with LIMIT."""
        if not self.snowflake_client:
            return {"error": "No Snowflake client available"}
        
        # Wrap in LIMIT for safety
        test_sql = f"SELECT * FROM ({sql}) t LIMIT {limit_rows}"
        
        try:
            import time
            start = time.time()
            result = self.snowflake_client.execute_query(test_sql)
            elapsed = (time.time() - start) * 1000
            
            return {
                "result": result,
                "time_ms": elapsed,
                "error": None,
            }
        except Exception as e:
            return {
                "result": None,
                "time_ms": None,
                "error": str(e),
            }


def validate_sql(sql: str) -> ValidationResult:
    """
    Convenience function to validate SQL.
    
    Args:
        sql: SQL to validate
        
    Returns:
        ValidationResult
    """
    validator = SqlValidator()
    return validator.validate(sql)


def validate_sql_expression(sql_expr: str) -> ValidationResult:
    """
    Convenience function to validate a SQL expression.
    
    Args:
        sql_expr: SQL expression to validate
        
    Returns:
        ValidationResult
    """
    validator = SqlValidator()
    return validator.validate_expression(sql_expr)











