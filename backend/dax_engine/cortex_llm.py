"""
Snowflake Cortex LLM Integration for DAX Translation

Uses Snowflake's built-in COMPLETE() function to enhance DAX → SQL
translation for complex patterns that the deterministic parser can't handle.

This provides:
- Fallback for unknown DAX functions
- Enhancement for MEDIUM confidence translations
- Context-aware translation using schema information
"""

from typing import Optional, Dict, Any, List
from dataclasses import dataclass
import json
import re


@dataclass
class CortexTranslationResult:
    """Result from Cortex LLM translation."""
    sql: str
    success: bool
    model_used: str
    tokens_used: Optional[int] = None
    error: Optional[str] = None


class CortexLLMTranslator:
    """
    Uses Snowflake Cortex to translate complex DAX expressions.
    
    This is called when:
    1. Pattern-based translation has LOW confidence
    2. Unknown DAX functions are encountered
    3. Complex nested expressions need help
    
    Usage:
        from snowflake_client import snowflake_client
        
        cortex = CortexLLMTranslator(snowflake_client)
        result = cortex.translate_dax(
            dax="CALCULATE(SUM(Sales[Amount]), USERELATIONSHIP(...))",
            context=schema_context,
            initial_sql="..."  # Optional: pattern-based attempt
        )
    """
    
    # Available Cortex models (in order of capability)
    MODELS = [
        "mistral-large2",      # Best for complex reasoning
        "mistral-large",       # Good balance
        "llama3.1-70b",        # Strong open model
        "mistral-7b",          # Fast, less capable
    ]
    
    DEFAULT_MODEL = "mistral-large2"
    
    def __init__(self, snowflake_client: Any, model: str = None):
        """
        Initialize with Snowflake client.
        
        Args:
            snowflake_client: Connected Snowflake client with execute_sql method
            model: Cortex model to use (default: mistral-large2)
        """
        self.client = snowflake_client
        self.model = model or self.DEFAULT_MODEL
    
    def translate_dax(
        self,
        dax: str,
        context: Optional[str] = None,
        initial_sql: Optional[str] = None,
        patterns_context: Optional[str] = None,
    ) -> CortexTranslationResult:
        """
        Translate DAX to SQL using Cortex LLM.
        
        Args:
            dax: DAX expression to translate
            context: Schema context (tables, relationships)
            initial_sql: Initial pattern-based translation attempt
            patterns_context: Known patterns for reference
            
        Returns:
            CortexTranslationResult with SQL and metadata
        """
        prompt = self._build_prompt(dax, context, initial_sql, patterns_context)
        
        try:
            sql_result = self._call_cortex(prompt)
            
            # Extract SQL from response
            extracted_sql = self._extract_sql(sql_result)
            
            return CortexTranslationResult(
                sql=extracted_sql,
                success=True,
                model_used=self.model,
            )
        except Exception as e:
            return CortexTranslationResult(
                sql=initial_sql or "",
                success=False,
                model_used=self.model,
                error=str(e),
            )
    
    def enhance_translation(
        self,
        dax: str,
        pattern_sql: str,
        confidence: str,
        warnings: List[str],
    ) -> CortexTranslationResult:
        """
        Enhance an existing pattern-based translation.
        
        Called when confidence is MEDIUM or there are warnings.
        
        Args:
            dax: Original DAX expression
            pattern_sql: Pattern-based SQL attempt
            confidence: Current confidence level
            warnings: Warnings from pattern translation
            
        Returns:
            Enhanced translation result
        """
        prompt = f"""You are a DAX to Snowflake SQL expert.

The following DAX expression was translated to SQL, but the translation may need improvement.

DAX Expression:
{dax}

Current SQL Translation:
{pattern_sql}

Confidence Level: {confidence}
Warnings: {', '.join(warnings) if warnings else 'None'}

Please review and provide a corrected/improved Snowflake SQL translation.
If the current translation is correct, return it unchanged.
Only return the SQL, no explanations.
"""
        
        try:
            sql_result = self._call_cortex(prompt)
            extracted_sql = self._extract_sql(sql_result)
            
            return CortexTranslationResult(
                sql=extracted_sql,
                success=True,
                model_used=self.model,
            )
        except Exception as e:
            return CortexTranslationResult(
                sql=pattern_sql,
                success=False,
                model_used=self.model,
                error=str(e),
            )
    
    def _build_prompt(
        self,
        dax: str,
        context: Optional[str],
        initial_sql: Optional[str],
        patterns_context: Optional[str],
    ) -> str:
        """Build the prompt for Cortex."""
        parts = [
            "You are an expert at translating Power BI DAX expressions to Snowflake SQL.",
            "Your task is to convert the following DAX expression to valid Snowflake SQL.",
            "",
            "IMPORTANT RULES:",
            "1. Use Snowflake-specific functions (DATEADD, DATE_TRUNC, etc.)",
            "2. Handle NULL properly with COALESCE or NULLIF",
            "3. Use CASE WHEN for conditional logic",
            "4. Convert table[column] references to table.column format",
            "5. Convert CamelCase to snake_case for column names",
            "",
        ]
        
        if patterns_context:
            parts.extend([
                "REFERENCE PATTERNS:",
                patterns_context,
                "",
            ])
        
        if context:
            parts.extend([
                "SCHEMA CONTEXT:",
                context,
                "",
            ])
        
        parts.extend([
            "DAX EXPRESSION:",
            dax,
            "",
        ])
        
        if initial_sql:
            parts.extend([
                "INITIAL TRANSLATION ATTEMPT (may need fixes):",
                initial_sql,
                "",
            ])
        
        parts.extend([
            "Provide ONLY the Snowflake SQL translation, no explanations.",
            "If you cannot translate, return: -- UNABLE TO TRANSLATE: <reason>",
        ])
        
        return "\n".join(parts)
    
    def _call_cortex(self, prompt: str) -> str:
        """Call Snowflake Cortex COMPLETE function."""
        # Escape single quotes in prompt
        escaped_prompt = prompt.replace("'", "''")
        
        query = f"""
        SELECT SNOWFLAKE.CORTEX.COMPLETE(
            '{self.model}',
            '{escaped_prompt}'
        ) as response
        """
        
        result = self.client.execute_sql(query)
        
        if result and len(result) > 0:
            return result[0].get('RESPONSE', '')
        
        raise Exception("No response from Cortex")
    
    def _extract_sql(self, response: str) -> str:
        """Extract SQL from LLM response."""
        # Clean up the response
        response = response.strip()
        
        # Remove markdown code blocks if present
        if response.startswith("```sql"):
            response = response[6:]
        elif response.startswith("```"):
            response = response[3:]
        
        if response.endswith("```"):
            response = response[:-3]
        
        # Remove any leading/trailing whitespace
        response = response.strip()
        
        # If response contains explanatory text, try to extract just SQL
        lines = response.split('\n')
        sql_lines = []
        in_sql = False
        
        for line in lines:
            # Skip obvious non-SQL lines
            if line.strip().startswith('#') or line.strip().startswith('//'):
                continue
            if 'explanation' in line.lower() or 'note:' in line.lower():
                continue
            
            # Include lines that look like SQL
            if any(kw in line.upper() for kw in ['SELECT', 'SUM', 'AVG', 'COUNT', 'CASE', 'WHEN', 'FROM', 'WHERE', 'JOIN', 'GROUP', 'ORDER', 'DATEADD', 'COALESCE', '(', ')']):
                in_sql = True
            
            if in_sql or line.strip():
                sql_lines.append(line)
        
        return '\n'.join(sql_lines).strip() or response
    
    def test_connection(self) -> bool:
        """Test if Cortex is accessible."""
        try:
            result = self._call_cortex("Say 'OK' if you can read this.")
            return 'OK' in result.upper() or len(result) > 0
        except Exception:
            return False


def create_cortex_translator(snowflake_client: Any) -> Optional[CortexLLMTranslator]:
    """
    Factory function to create a Cortex translator.
    
    Returns None if Cortex is not available.
    """
    try:
        translator = CortexLLMTranslator(snowflake_client)
        if translator.test_connection():
            return translator
        return None
    except Exception:
        return None







