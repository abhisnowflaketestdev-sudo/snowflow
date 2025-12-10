"""
DAX Lexer (Tokenizer)

Converts DAX source code into a stream of tokens.
This is the first stage of the translation pipeline.

The lexer handles:
- Keywords (SUM, CALCULATE, IF, etc.)
- Identifiers (table names, column names)
- Literals (numbers, strings, booleans)
- Operators (+, -, *, /, =, <>, etc.)
- Delimiters (parentheses, brackets, commas)
- Whitespace and comments

Design: Uses regex-based scanning for efficiency and accuracy.
"""

import re
from dataclasses import dataclass
from typing import List, Iterator, Optional, Tuple
from enum import Enum, auto


class TokenType(Enum):
    """All token types in DAX."""
    # Literals
    INTEGER = auto()
    FLOAT = auto()
    STRING = auto()
    BOOLEAN = auto()
    
    # Identifiers
    IDENTIFIER = auto()
    COLUMN_REF = auto()      # [Column Name]
    QUALIFIED_COLUMN = auto() # Table[Column]
    QUOTED_IDENTIFIER = auto() # 'Table Name'
    
    # Keywords
    KEYWORD = auto()
    VAR = auto()
    RETURN = auto()
    TRUE = auto()
    FALSE = auto()
    BLANK = auto()
    
    # Operators
    PLUS = auto()
    MINUS = auto()
    MULTIPLY = auto()
    DIVIDE = auto()
    POWER = auto()
    EQUALS = auto()
    NOT_EQUALS = auto()
    LESS_THAN = auto()
    LESS_EQUAL = auto()
    GREATER_THAN = auto()
    GREATER_EQUAL = auto()
    AND = auto()
    OR = auto()
    NOT = auto()
    AMPERSAND = auto()  # String concatenation
    
    # Delimiters
    LPAREN = auto()
    RPAREN = auto()
    LBRACKET = auto()
    RBRACKET = auto()
    COMMA = auto()
    SEMICOLON = auto()
    DOT = auto()
    
    # Special
    NEWLINE = auto()
    WHITESPACE = auto()
    COMMENT = auto()
    EOF = auto()
    ERROR = auto()


# DAX keywords (case-insensitive)
DAX_KEYWORDS = {
    # Aggregation functions
    "SUM", "SUMX", "AVERAGE", "AVERAGEX", "COUNT", "COUNTX", "COUNTA",
    "COUNTAX", "COUNTROWS", "COUNTBLANK", "MIN", "MINX", "MAX", "MAXX",
    "DISTINCTCOUNT", "DISTINCTCOUNTNOBLANK", "PRODUCT", "PRODUCTX",
    
    # Filter functions
    "CALCULATE", "CALCULATETABLE", "FILTER", "ALL", "ALLEXCEPT",
    "ALLSELECTED", "ALLNOBLANKROW", "VALUES", "DISTINCT", "KEEPFILTERS",
    "REMOVEFILTERS", "EARLIER", "EARLIEST", "HASONEVALUE", "HASONEFILTER",
    "ISFILTERED", "ISCROSSFILTERED", "SELECTEDVALUE",
    
    # Time intelligence
    "DATEADD", "DATEDIFF", "SAMEPERIODLASTYEAR", "PREVIOUSYEAR",
    "PREVIOUSQUARTER", "PREVIOUSMONTH", "PREVIOUSDAY", "NEXTYEAR",
    "NEXTQUARTER", "NEXTMONTH", "NEXTDAY", "PARALLELPERIOD",
    "STARTOFYEAR", "STARTOFQUARTER", "STARTOFMONTH", "ENDOFYEAR",
    "ENDOFQUARTER", "ENDOFMONTH", "DATESYTD", "DATESMTD", "DATESQTD",
    "TOTALYTD", "TOTALMTD", "TOTALQTD", "DATESBETWEEN", "DATESINPERIOD",
    "FIRSTDATE", "LASTDATE", "OPENINGBALANCEYEAR", "OPENINGBALANCEQUARTER",
    "OPENINGBALANCEMONTH", "CLOSINGBALANCEYEAR", "CLOSINGBALANCEQUARTER",
    "CLOSINGBALANCEMONTH",
    
    # Logical functions
    "IF", "IFERROR", "IFNA", "SWITCH", "AND", "OR", "NOT", "TRUE", "FALSE",
    "ISBLANK", "ISERROR", "ISLOGICAL", "ISNUMBER", "ISTEXT", "ISNONTEXT",
    "COALESCE",
    
    # Text functions
    "CONCATENATE", "CONCATENATEX", "FORMAT", "LEFT", "RIGHT", "MID",
    "LEN", "UPPER", "LOWER", "TRIM", "SUBSTITUTE", "REPLACE", "SEARCH",
    "FIND", "EXACT", "REPT", "UNICODE", "UNICHAR", "VALUE",
    
    # Math functions
    "DIVIDE", "ABS", "ROUND", "ROUNDUP", "ROUNDDOWN", "MROUND", "INT",
    "MOD", "POWER", "SQRT", "LOG", "LOG10", "LN", "EXP", "SIGN", "CEILING",
    "FLOOR", "RAND", "RANDBETWEEN", "PI", "EVEN", "ODD", "FACT", "GCD",
    "LCM", "QUOTIENT", "TRUNC",
    
    # Table functions
    "SUMMARIZE", "SUMMARIZECOLUMNS", "ADDCOLUMNS", "SELECTCOLUMNS",
    "TOPN", "SAMPLE", "GENERATE", "GENERATEALL", "CROSSJOIN",
    "NATURALINNERJOIN", "NATURALLEFTOUTERJOIN", "UNION", "INTERSECT",
    "EXCEPT", "DATATABLE", "ROW", "GENERATESERIES", "CALENDAR",
    "CALENDARAUTO", "TREATAS",
    
    # Relationship functions
    "RELATED", "RELATEDTABLE", "USERELATIONSHIP", "CROSSFILTER",
    
    # Other
    "BLANK", "ERROR", "VAR", "RETURN", "EVALUATE", "DEFINE", "MEASURE",
    "COLUMN", "TABLE", "ORDER", "BY", "ASC", "DESC", "START", "AT",
}


@dataclass
class Token:
    """
    Represents a single token from the lexer.
    
    Attributes:
        type: The type of token
        value: The actual text of the token
        line: Line number (1-indexed)
        column: Column number (1-indexed)
        position: Absolute position in source
    """
    type: TokenType
    value: str
    line: int
    column: int
    position: int
    
    def __str__(self) -> str:
        return f"Token({self.type.name}, {repr(self.value)}, {self.line}:{self.column})"
    
    def __repr__(self) -> str:
        return self.__str__()
    
    @property
    def is_operator(self) -> bool:
        """Check if this token is an operator."""
        return self.type in {
            TokenType.PLUS, TokenType.MINUS, TokenType.MULTIPLY,
            TokenType.DIVIDE, TokenType.POWER, TokenType.EQUALS,
            TokenType.NOT_EQUALS, TokenType.LESS_THAN, TokenType.LESS_EQUAL,
            TokenType.GREATER_THAN, TokenType.GREATER_EQUAL,
            TokenType.AND, TokenType.OR, TokenType.NOT, TokenType.AMPERSAND,
        }
    
    @property
    def is_literal(self) -> bool:
        """Check if this token is a literal value."""
        return self.type in {
            TokenType.INTEGER, TokenType.FLOAT, TokenType.STRING,
            TokenType.BOOLEAN,
        }


class LexerError(Exception):
    """Exception raised when the lexer encounters invalid input."""
    
    def __init__(self, message: str, line: int, column: int, position: int):
        self.line = line
        self.column = column
        self.position = position
        super().__init__(f"Lexer error at line {line}, column {column}: {message}")


class DaxLexer:
    """
    Tokenizer for DAX expressions.
    
    Usage:
        lexer = DaxLexer(dax_source)
        tokens = lexer.tokenize()
        # or iterate:
        for token in lexer:
            process(token)
    """
    
    # Regex patterns for token recognition
    # Order matters - more specific patterns should come first
    TOKEN_PATTERNS = [
        # Whitespace and comments
        (r'[ \t]+', TokenType.WHITESPACE),
        (r'\r?\n', TokenType.NEWLINE),
        (r'//[^\r\n]*', TokenType.COMMENT),
        (r'/\*[\s\S]*?\*/', TokenType.COMMENT),
        
        # String literals (double-quoted)
        (r'"(?:[^"\\]|\\.)*"', TokenType.STRING),
        
        # Quoted identifiers (single-quoted for table names with spaces)
        (r"'(?:[^'\\]|\\.)*'", TokenType.QUOTED_IDENTIFIER),
        
        # Column references [Column Name]
        (r'\[[^\]]+\]', TokenType.COLUMN_REF),
        
        # Numbers (float before integer to match correctly)
        (r'\d+\.\d+(?:[eE][+-]?\d+)?', TokenType.FLOAT),
        (r'\d+(?:[eE][+-]?\d+)?', TokenType.INTEGER),
        
        # Two-character operators (must come before single-char)
        (r'<>', TokenType.NOT_EQUALS),
        (r'<=', TokenType.LESS_EQUAL),
        (r'>=', TokenType.GREATER_EQUAL),
        (r'&&', TokenType.AND),
        (r'\|\|', TokenType.OR),
        
        # Single-character operators
        (r'\+', TokenType.PLUS),
        (r'-', TokenType.MINUS),
        (r'\*', TokenType.MULTIPLY),
        (r'/', TokenType.DIVIDE),
        (r'\^', TokenType.POWER),
        (r'=', TokenType.EQUALS),
        (r'<', TokenType.LESS_THAN),
        (r'>', TokenType.GREATER_THAN),
        (r'&', TokenType.AMPERSAND),
        
        # Delimiters
        (r'\(', TokenType.LPAREN),
        (r'\)', TokenType.RPAREN),
        (r'\[', TokenType.LBRACKET),
        (r'\]', TokenType.RBRACKET),
        (r',', TokenType.COMMA),
        (r';', TokenType.SEMICOLON),
        (r'\.', TokenType.DOT),
        
        # Identifiers (must come after operators)
        (r'[a-zA-Z_][a-zA-Z0-9_]*', TokenType.IDENTIFIER),
    ]
    
    def __init__(self, source: str):
        """
        Initialize the lexer with DAX source code.
        
        Args:
            source: The DAX expression or code to tokenize
        """
        self.source = source
        self.position = 0
        self.line = 1
        self.column = 1
        self._tokens: Optional[List[Token]] = None
        
        # Compile regex patterns for efficiency
        self._compiled_patterns = [
            (re.compile(pattern), token_type)
            for pattern, token_type in self.TOKEN_PATTERNS
        ]
    
    def tokenize(self) -> List[Token]:
        """
        Tokenize the entire source and return list of tokens.
        
        Returns:
            List of Token objects (excluding whitespace/comments)
        
        Raises:
            LexerError: If invalid input is encountered
        """
        if self._tokens is not None:
            return self._tokens
        
        self._tokens = []
        self.position = 0
        self.line = 1
        self.column = 1
        
        while self.position < len(self.source):
            token = self._next_token()
            if token:
                # Skip whitespace and comments
                if token.type not in {TokenType.WHITESPACE, TokenType.COMMENT}:
                    self._tokens.append(token)
                
                # Update newline tracking
                if token.type == TokenType.NEWLINE:
                    self.line += 1
                    self.column = 1
        
        # Add EOF token
        self._tokens.append(Token(
            TokenType.EOF, "", self.line, self.column, self.position
        ))
        
        return self._tokens
    
    def _next_token(self) -> Optional[Token]:
        """Get the next token from the source."""
        if self.position >= len(self.source):
            return None
        
        for pattern, token_type in self._compiled_patterns:
            match = pattern.match(self.source, self.position)
            if match:
                value = match.group(0)
                token = Token(
                    type=self._classify_token(token_type, value),
                    value=value,
                    line=self.line,
                    column=self.column,
                    position=self.position,
                )
                
                # Update position
                self.position = match.end()
                if token_type != TokenType.NEWLINE:
                    self.column += len(value)
                
                return token
        
        # No pattern matched - error
        char = self.source[self.position]
        raise LexerError(
            f"Unexpected character: {repr(char)}",
            self.line, self.column, self.position
        )
    
    def _classify_token(self, base_type: TokenType, value: str) -> TokenType:
        """
        Further classify tokens based on their value.
        
        Handles keywords, booleans, etc.
        """
        if base_type == TokenType.IDENTIFIER:
            upper_value = value.upper()
            
            # Check for keywords
            if upper_value in DAX_KEYWORDS:
                if upper_value == "TRUE":
                    return TokenType.TRUE
                elif upper_value == "FALSE":
                    return TokenType.FALSE
                elif upper_value == "BLANK":
                    return TokenType.BLANK
                elif upper_value == "VAR":
                    return TokenType.VAR
                elif upper_value == "RETURN":
                    return TokenType.RETURN
                elif upper_value == "AND":
                    return TokenType.AND
                elif upper_value == "OR":
                    return TokenType.OR
                elif upper_value == "NOT":
                    return TokenType.NOT
                return TokenType.KEYWORD
        
        return base_type
    
    def __iter__(self) -> Iterator[Token]:
        """Iterate over tokens."""
        return iter(self.tokenize())
    
    def peek(self, offset: int = 0) -> Optional[Token]:
        """
        Peek at a token without consuming it.
        
        Args:
            offset: How many tokens ahead to peek (0 = current)
        """
        tokens = self.tokenize()
        idx = offset
        if idx < len(tokens):
            return tokens[idx]
        return None


def tokenize_dax(source: str) -> List[Token]:
    """
    Convenience function to tokenize DAX source.
    
    Args:
        source: DAX expression or code
        
    Returns:
        List of tokens
    """
    lexer = DaxLexer(source)
    return lexer.tokenize()


# Helper function to check if a string might be a DAX expression
def looks_like_dax(text: str) -> bool:
    """
    Quick check if text appears to be DAX code.
    
    This is a heuristic check, not a full parse.
    """
    # Look for common DAX patterns
    dax_indicators = [
        r'\bSUM\s*\(',
        r'\bCALCULATE\s*\(',
        r'\bFILTER\s*\(',
        r'\bAVERAGE\s*\(',
        r'\[.*\]',  # Column reference
        r"'[^']+'\[",  # Qualified column with quoted table
    ]
    
    text_upper = text.upper()
    for pattern in dax_indicators:
        if re.search(pattern, text_upper):
            return True
    return False







