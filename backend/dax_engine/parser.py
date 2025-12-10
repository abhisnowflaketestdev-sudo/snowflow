"""
DAX Parser

Parses DAX tokens into an Abstract Syntax Tree (AST).
Uses recursive descent parsing with operator precedence.

Grammar (simplified):
    expression     → logic_or
    logic_or       → logic_and ( "||" logic_and )*
    logic_and      → equality ( "&&" equality )*
    equality       → comparison ( ( "=" | "<>" ) comparison )*
    comparison     → term ( ( "<" | "<=" | ">" | ">=" ) term )*
    term           → factor ( ( "+" | "-" | "&" ) factor )*
    factor         → unary ( ( "*" | "/" ) unary )*
    unary          → ( "-" | "NOT" ) unary | power
    power          → call ( "^" call )*
    call           → primary ( "(" arguments? ")" )?
    primary        → NUMBER | STRING | BOOLEAN | column | "(" expression ")"
    column         → IDENTIFIER "[" IDENTIFIER "]" | "[" IDENTIFIER "]"
"""

from typing import List, Optional, Callable, Any
from dataclasses import dataclass

from .lexer import Token, TokenType, DaxLexer, LexerError
from .ast_nodes import (
    DaxNode, DaxExpression, DaxLiteral, DaxColumn, DaxTable,
    DaxFunction, DaxBinaryOp, DaxUnaryOp, DaxVariable, DaxMeasure,
    DaxIfExpression, BinaryOperator, UnaryOperator,
)


class ParseError(Exception):
    """Exception raised when parsing fails."""
    
    def __init__(self, message: str, token: Optional[Token] = None):
        self.token = token
        if token:
            super().__init__(f"Parse error at line {token.line}, column {token.column}: {message}")
        else:
            super().__init__(f"Parse error: {message}")


@dataclass
class ParseResult:
    """Result of parsing a DAX expression."""
    ast: DaxExpression
    tokens: List[Token]
    source: str
    errors: List[str]
    
    @property
    def success(self) -> bool:
        return len(self.errors) == 0


class DaxParser:
    """
    Recursive descent parser for DAX expressions.
    
    Usage:
        parser = DaxParser()
        result = parser.parse("SUM(Sales[Amount])")
        if result.success:
            ast = result.ast
    """
    
    def __init__(self):
        self.tokens: List[Token] = []
        self.current = 0
        self.source = ""
        self.errors: List[str] = []
    
    def parse(self, source: str) -> ParseResult:
        """
        Parse a DAX expression into an AST.
        
        Args:
            source: DAX expression string
            
        Returns:
            ParseResult with AST and any errors
        """
        self.source = source
        self.errors = []
        self.current = 0
        
        try:
            lexer = DaxLexer(source)
            self.tokens = lexer.tokenize()
        except LexerError as e:
            return ParseResult(
                ast=DaxLiteral(None, "blank"),
                tokens=[],
                source=source,
                errors=[str(e)],
            )
        
        try:
            ast = self._expression()
            
            # Check for unconsumed tokens (except EOF)
            if not self._is_at_end():
                token = self._peek()
                self.errors.append(
                    f"Unexpected token after expression: {token.value}"
                )
            
            return ParseResult(
                ast=ast,
                tokens=self.tokens,
                source=source,
                errors=self.errors,
            )
        except ParseError as e:
            self.errors.append(str(e))
            return ParseResult(
                ast=DaxLiteral(None, "blank"),
                tokens=self.tokens,
                source=source,
                errors=self.errors,
            )
    
    def parse_measure(self, source: str) -> ParseResult:
        """
        Parse a measure definition: [Name] = expression
        
        Args:
            source: Measure definition string
        """
        self.source = source
        self.errors = []
        self.current = 0
        
        try:
            lexer = DaxLexer(source)
            self.tokens = lexer.tokenize()
        except LexerError as e:
            return ParseResult(
                ast=DaxLiteral(None, "blank"),
                tokens=[],
                source=source,
                errors=[str(e)],
            )
        
        try:
            # Expect [MeasureName]
            if not self._check(TokenType.COLUMN_REF):
                raise ParseError("Expected measure name in brackets [Name]")
            
            name_token = self._advance()
            name = name_token.value[1:-1]  # Remove brackets
            
            # Expect =
            if not self._match(TokenType.EQUALS):
                raise ParseError("Expected '=' after measure name")
            
            # Parse expression
            expr = self._expression()
            
            measure = DaxMeasure(name=name, expression=expr)
            
            return ParseResult(
                ast=measure,
                tokens=self.tokens,
                source=source,
                errors=self.errors,
            )
        except ParseError as e:
            self.errors.append(str(e))
            return ParseResult(
                ast=DaxLiteral(None, "blank"),
                tokens=self.tokens,
                source=source,
                errors=self.errors,
            )
    
    # ========== Recursive Descent Methods ==========
    
    def _expression(self) -> DaxExpression:
        """Parse any expression - entry point."""
        # Handle VAR...RETURN
        if self._check(TokenType.VAR):
            return self._var_expression()
        
        return self._logic_or()
    
    def _var_expression(self) -> DaxExpression:
        """Parse VAR x = expr RETURN result"""
        variables = []
        
        while self._match(TokenType.VAR):
            # Variable name
            if not self._check(TokenType.IDENTIFIER):
                raise ParseError("Expected variable name after VAR")
            name = self._advance().value
            
            # Equals
            if not self._match(TokenType.EQUALS):
                raise ParseError("Expected '=' in variable definition")
            
            # Value expression
            value = self._logic_or()
            variables.append(DaxVariable(name, value, is_definition=True))
        
        # RETURN
        if not self._match(TokenType.RETURN):
            raise ParseError("Expected RETURN after VAR definitions")
        
        # Return expression
        return_expr = self._expression()
        
        # For now, we'll wrap this in the return expression
        # A more complete implementation would track variables in scope
        return return_expr
    
    def _logic_or(self) -> DaxExpression:
        """Parse OR expressions: a || b"""
        expr = self._logic_and()
        
        while self._match(TokenType.OR):
            right = self._logic_and()
            expr = DaxBinaryOp(expr, BinaryOperator.OR, right)
        
        return expr
    
    def _logic_and(self) -> DaxExpression:
        """Parse AND expressions: a && b"""
        expr = self._equality()
        
        while self._match(TokenType.AND):
            right = self._equality()
            expr = DaxBinaryOp(expr, BinaryOperator.AND, right)
        
        return expr
    
    def _equality(self) -> DaxExpression:
        """Parse equality: a = b, a <> b"""
        expr = self._comparison()
        
        while True:
            if self._match(TokenType.EQUALS):
                right = self._comparison()
                expr = DaxBinaryOp(expr, BinaryOperator.EQUALS, right)
            elif self._match(TokenType.NOT_EQUALS):
                right = self._comparison()
                expr = DaxBinaryOp(expr, BinaryOperator.NOT_EQUALS, right)
            else:
                break
        
        return expr
    
    def _comparison(self) -> DaxExpression:
        """Parse comparison: a < b, a <= b, etc."""
        expr = self._term()
        
        while True:
            if self._match(TokenType.LESS_THAN):
                right = self._term()
                expr = DaxBinaryOp(expr, BinaryOperator.LESS_THAN, right)
            elif self._match(TokenType.LESS_EQUAL):
                right = self._term()
                expr = DaxBinaryOp(expr, BinaryOperator.LESS_EQUAL, right)
            elif self._match(TokenType.GREATER_THAN):
                right = self._term()
                expr = DaxBinaryOp(expr, BinaryOperator.GREATER_THAN, right)
            elif self._match(TokenType.GREATER_EQUAL):
                right = self._term()
                expr = DaxBinaryOp(expr, BinaryOperator.GREATER_EQUAL, right)
            else:
                break
        
        return expr
    
    def _term(self) -> DaxExpression:
        """Parse addition/subtraction/concatenation: a + b, a - b, a & b"""
        expr = self._factor()
        
        while True:
            if self._match(TokenType.PLUS):
                right = self._factor()
                expr = DaxBinaryOp(expr, BinaryOperator.ADD, right)
            elif self._match(TokenType.MINUS):
                right = self._factor()
                expr = DaxBinaryOp(expr, BinaryOperator.SUBTRACT, right)
            elif self._match(TokenType.AMPERSAND):
                right = self._factor()
                expr = DaxBinaryOp(expr, BinaryOperator.AMPERSAND, right)
            else:
                break
        
        return expr
    
    def _factor(self) -> DaxExpression:
        """Parse multiplication/division: a * b, a / b"""
        expr = self._unary()
        
        while True:
            if self._match(TokenType.MULTIPLY):
                right = self._unary()
                expr = DaxBinaryOp(expr, BinaryOperator.MULTIPLY, right)
            elif self._match(TokenType.DIVIDE):
                right = self._unary()
                expr = DaxBinaryOp(expr, BinaryOperator.DIVIDE, right)
            else:
                break
        
        return expr
    
    def _unary(self) -> DaxExpression:
        """Parse unary operators: -x, NOT x"""
        if self._match(TokenType.MINUS):
            operand = self._unary()
            return DaxUnaryOp(UnaryOperator.NEGATE, operand)
        
        if self._match(TokenType.NOT):
            operand = self._unary()
            return DaxUnaryOp(UnaryOperator.NOT, operand)
        
        return self._power()
    
    def _power(self) -> DaxExpression:
        """Parse power: a ^ b"""
        expr = self._call()
        
        if self._match(TokenType.POWER):
            right = self._power()  # Right-associative
            expr = DaxBinaryOp(expr, BinaryOperator.POWER, right)
        
        return expr
    
    def _call(self) -> DaxExpression:
        """Parse function calls: FUNC(args)"""
        expr = self._primary()
        
        # Check if this is a function call
        if isinstance(expr, DaxTable) and self._match(TokenType.LPAREN):
            # It's a function call
            func_name = expr.table_name
            args = self._arguments()
            
            if not self._match(TokenType.RPAREN):
                raise ParseError(f"Expected ')' after function arguments")
            
            return DaxFunction(func_name, args)
        
        return expr
    
    def _arguments(self) -> List[DaxExpression]:
        """Parse function arguments: (a, b, c)"""
        args = []
        
        if not self._check(TokenType.RPAREN):
            args.append(self._expression())
            
            while self._match(TokenType.COMMA):
                args.append(self._expression())
        
        return args
    
    def _primary(self) -> DaxExpression:
        """Parse primary expressions (literals, columns, groups)."""
        
        # Boolean literals
        if self._match(TokenType.TRUE):
            return DaxLiteral(True, "boolean")
        
        if self._match(TokenType.FALSE):
            return DaxLiteral(False, "boolean")
        
        # BLANK()
        if self._check(TokenType.BLANK):
            self._advance()
            if self._match(TokenType.LPAREN):
                self._match(TokenType.RPAREN)
            return DaxLiteral(None, "blank")
        
        # Number literals
        if self._match(TokenType.INTEGER):
            return DaxLiteral(int(self._previous().value), "integer")
        
        if self._match(TokenType.FLOAT):
            return DaxLiteral(float(self._previous().value), "float")
        
        # String literals
        if self._match(TokenType.STRING):
            value = self._previous().value[1:-1]  # Remove quotes
            return DaxLiteral(value, "string")
        
        # Column reference: [Column] or Table[Column]
        if self._match(TokenType.COLUMN_REF):
            column_name = self._previous().value[1:-1]  # Remove brackets
            return DaxColumn(None, column_name)
        
        # Qualified column: Table[Column] or 'Table Name'[Column]
        if self._check(TokenType.IDENTIFIER) or self._check(TokenType.QUOTED_IDENTIFIER):
            return self._qualified_reference()
        
        # Keyword that might be a function name
        if self._check(TokenType.KEYWORD):
            return self._qualified_reference()
        
        # Grouped expression: (expr)
        if self._match(TokenType.LPAREN):
            expr = self._expression()
            if not self._match(TokenType.RPAREN):
                raise ParseError("Expected ')' after grouped expression")
            return expr
        
        raise ParseError(f"Unexpected token: {self._peek().value}", self._peek())
    
    def _qualified_reference(self) -> DaxExpression:
        """Parse Table[Column] or Table or 'Table Name'[Column]"""
        
        # Get table/function name
        if self._check(TokenType.QUOTED_IDENTIFIER):
            token = self._advance()
            name = token.value[1:-1]  # Remove quotes
        elif self._check(TokenType.IDENTIFIER):
            token = self._advance()
            name = token.value
        elif self._check(TokenType.KEYWORD):
            token = self._advance()
            name = token.value
        else:
            raise ParseError("Expected identifier")
        
        # Check for [Column] part
        if self._check(TokenType.COLUMN_REF):
            col_token = self._advance()
            column_name = col_token.value[1:-1]  # Remove brackets
            return DaxColumn(name, column_name)
        
        # Just a table or function name
        return DaxTable(name)
    
    # ========== Helper Methods ==========
    
    def _peek(self) -> Token:
        """Look at current token without consuming it."""
        return self.tokens[self.current]
    
    def _previous(self) -> Token:
        """Get the previously consumed token."""
        return self.tokens[self.current - 1]
    
    def _is_at_end(self) -> bool:
        """Check if we've consumed all tokens."""
        return self._peek().type == TokenType.EOF
    
    def _advance(self) -> Token:
        """Consume and return current token."""
        if not self._is_at_end():
            self.current += 1
        return self._previous()
    
    def _check(self, token_type: TokenType) -> bool:
        """Check if current token is of given type."""
        if self._is_at_end():
            return False
        return self._peek().type == token_type
    
    def _match(self, *types: TokenType) -> bool:
        """Check if current token matches any of the given types, consume if so."""
        for token_type in types:
            if self._check(token_type):
                self._advance()
                return True
        return False


def parse_dax(source: str) -> ParseResult:
    """
    Convenience function to parse DAX expression.
    
    Args:
        source: DAX expression string
        
    Returns:
        ParseResult with AST
    """
    parser = DaxParser()
    return parser.parse(source)


def parse_dax_measure(source: str) -> ParseResult:
    """
    Convenience function to parse DAX measure definition.
    
    Args:
        source: Measure definition like "[Name] = expression"
        
    Returns:
        ParseResult with DaxMeasure AST
    """
    parser = DaxParser()
    return parser.parse_measure(source)







