"""
Test script for the DAX Translation Engine.

Run with: python -m dax_engine.test_engine
"""

import sys
import json
from typing import List, Tuple

# Import engine components
from .lexer import DaxLexer, tokenize_dax
from .parser import DaxParser, parse_dax
from .translator import DaxTranslator, translate_dax
from .context import SchemaContext, create_sample_retail_context
from .validator import SqlValidator, validate_sql_expression
from .patterns import PatternLibrary


def test_lexer():
    """Test the DAX lexer."""
    print("\n" + "="*60)
    print("TESTING LEXER")
    print("="*60)
    
    test_cases = [
        "SUM(Sales[Amount])",
        "CALCULATE(SUM(Sales[Amount]), Sales[Region] = \"West\")",
        "IF([Sales] > 1000, \"High\", \"Low\")",
        "SAMEPERIODLASTYEAR('Date'[Date])",
        "[Total Sales] + [Tax Amount]",
        "42.5 + 100",
    ]
    
    for dax in test_cases:
        print(f"\nDAX: {dax}")
        try:
            tokens = tokenize_dax(dax)
            print(f"Tokens: {len(tokens)}")
            for token in tokens[:5]:  # Show first 5
                print(f"  {token}")
            if len(tokens) > 5:
                print(f"  ... ({len(tokens) - 5} more)")
            print("✓ OK")
        except Exception as e:
            print(f"✗ FAIL: {e}")


def test_parser():
    """Test the DAX parser."""
    print("\n" + "="*60)
    print("TESTING PARSER")
    print("="*60)
    
    test_cases = [
        "SUM(Sales[Amount])",
        "AVERAGE(Sales[Quantity])",
        "COUNTROWS(Sales)",
        "Sales[Amount] + Sales[Tax]",
        "IF(Sales[Amount] > 100, \"High\", \"Low\")",
        "CALCULATE(SUM(Sales[Amount]), Sales[Year] = 2024)",
        "DIVIDE(SUM(Sales[Revenue]), SUM(Sales[Quantity]))",
    ]
    
    parser = DaxParser()
    for dax in test_cases:
        print(f"\nDAX: {dax}")
        try:
            result = parser.parse(dax)
            if result.success:
                print(f"AST: {result.ast}")
                print(f"AST Dict: {json.dumps(result.ast.to_dict(), indent=2)[:200]}...")
                print("✓ OK")
            else:
                print(f"✗ PARSE FAILED: {result.errors}")
        except Exception as e:
            print(f"✗ ERROR: {e}")


def test_translator():
    """Test the DAX translator."""
    print("\n" + "="*60)
    print("TESTING TRANSLATOR")
    print("="*60)
    
    test_cases = [
        ("SUM(Sales[Amount])", "SUM(sales.amount)"),
        ("AVERAGE(Sales[Quantity])", "AVG(sales.quantity)"),
        ("COUNTROWS(Sales)", "COUNT(*)"),
        ("DISTINCTCOUNT(Sales[CustomerID])", "COUNT(DISTINCT sales.customer_id)"),
        ("Sales[Amount] + Sales[Tax]", "(sales.amount + sales.tax)"),
        ("IF(Sales[Amount] > 100, \"High\", \"Low\")", "CASE WHEN"),
        ("DIVIDE(Sales[Revenue], Sales[Quantity])", "CASE WHEN"),
        ("ISBLANK(Sales[Amount])", "IS NULL"),
        ("SAMEPERIODLASTYEAR(Date[Date])", "DATEADD"),
    ]
    
    translator = DaxTranslator()
    
    for dax, expected_contains in test_cases:
        print(f"\nDAX: {dax}")
        try:
            result = translator.translate(dax)
            if result.success:
                print(f"SQL: {result.sql}")
                print(f"Confidence: {result.confidence.name}")
                print(f"Patterns: {result.patterns_applied}")
                
                if expected_contains.lower() in result.sql.lower():
                    print("✓ OK")
                else:
                    print(f"⚠ MISMATCH: Expected '{expected_contains}' in output")
            else:
                print(f"✗ TRANSLATION FAILED: {result.errors}")
        except Exception as e:
            print(f"✗ ERROR: {e}")


def test_translator_with_context():
    """Test translation with schema context."""
    print("\n" + "="*60)
    print("TESTING TRANSLATOR WITH SCHEMA CONTEXT")
    print("="*60)
    
    # Create sample context
    context = create_sample_retail_context()
    print(f"Context tables: {list(context.tables.keys())}")
    print(f"Relationships: {len(context.relationships)}")
    
    test_cases = [
        "SUM(Sales[Amount])",
        "AVERAGE(Product[UnitPrice])",
        "COUNTROWS(Customer)",
    ]
    
    translator = DaxTranslator(context=context)
    
    for dax in test_cases:
        print(f"\nDAX: {dax}")
        try:
            result = translator.translate(dax)
            if result.success:
                print(f"SQL: {result.sql}")
                print(f"Tables used: {result.tables_used}")
                print("✓ OK")
            else:
                print(f"✗ FAILED: {result.errors}")
        except Exception as e:
            print(f"✗ ERROR: {e}")


def test_validator():
    """Test SQL validation."""
    print("\n" + "="*60)
    print("TESTING VALIDATOR")
    print("="*60)
    
    test_cases = [
        ("SUM(amount)", True),
        ("SUM(amount", False),  # Missing paren
        ("column = NULL", True),  # Warning for = NULL
        ("", False),  # Empty
        ("revenue / quantity", True),  # Info about division
    ]
    
    for sql, should_pass in test_cases:
        print(f"\nSQL: {sql or '(empty)'}")
        try:
            result = validate_sql_expression(sql)
            print(f"Valid: {result.is_valid}")
            for issue in result.issues:
                print(f"  [{issue.level.name}] {issue.message}")
            
            if result.is_valid == should_pass:
                print("✓ OK")
            else:
                print(f"⚠ Expected valid={should_pass}")
        except Exception as e:
            print(f"✗ ERROR: {e}")


def test_patterns():
    """Test pattern library."""
    print("\n" + "="*60)
    print("TESTING PATTERN LIBRARY")
    print("="*60)
    
    library = PatternLibrary()
    
    print(f"Total patterns: {len(library.list_patterns())}")
    
    # Show some patterns
    sample_funcs = ["SUM", "CALCULATE", "IF", "SAMEPERIODLASTYEAR", "DIVIDE"]
    for func in sample_funcs:
        pattern = library.get_pattern(func)
        if pattern:
            print(f"\n{func}:")
            print(f"  Description: {pattern.description}")
            print(f"  Complexity: {pattern.complexity}")
            print(f"  Snowflake-specific: {pattern.snowflake_specific}")
        else:
            print(f"\n{func}: No pattern found")


def test_full_pipeline():
    """Test the full translation pipeline."""
    print("\n" + "="*60)
    print("TESTING FULL PIPELINE")
    print("="*60)
    
    # Retail example
    context = create_sample_retail_context()
    translator = DaxTranslator(context=context)
    validator = SqlValidator()
    
    complex_dax = """
    CALCULATE(
        SUM(Sales[Amount]),
        Product[Category] = "Electronics"
    )
    """
    
    print(f"\nComplex DAX:\n{complex_dax.strip()}")
    
    result = translator.translate(complex_dax)
    print(f"\nTranslation Result:")
    print(f"  Success: {result.success}")
    print(f"  SQL: {result.sql}")
    print(f"  Confidence: {result.confidence.name}")
    print(f"  Patterns: {result.patterns_applied}")
    print(f"  Warnings: {result.warnings}")
    
    if result.success:
        val_result = validator.validate_expression(result.sql)
        print(f"\nValidation:")
        print(f"  Valid: {val_result.is_valid}")
        for issue in val_result.issues:
            print(f"  [{issue.level.name}] {issue.message}")


def run_all_tests():
    """Run all tests."""
    print("="*60)
    print("DAX TRANSLATION ENGINE - TEST SUITE")
    print("="*60)
    
    test_lexer()
    test_parser()
    test_translator()
    test_translator_with_context()
    test_validator()
    test_patterns()
    test_full_pipeline()
    
    print("\n" + "="*60)
    print("ALL TESTS COMPLETED")
    print("="*60)


if __name__ == "__main__":






