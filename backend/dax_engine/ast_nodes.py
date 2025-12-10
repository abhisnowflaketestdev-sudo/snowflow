"""
DAX Abstract Syntax Tree (AST) Node Definitions

These classes represent the parsed structure of DAX expressions.
Each node type corresponds to a DAX language construct.

Design Principles:
- Immutable after creation (dataclasses with frozen=True)
- Self-documenting with clear type hints
- Visitor pattern support for tree traversal
- JSON serializable for debugging/logging
"""

from dataclasses import dataclass, field
from typing import List, Optional, Union, Any, Dict
from enum import Enum, auto
from abc import ABC, abstractmethod


class NodeType(Enum):
    """Enumeration of all DAX AST node types."""
    EXPRESSION = auto()
    FUNCTION = auto()
    COLUMN = auto()
    MEASURE = auto()
    TABLE = auto()
    BINARY_OP = auto()
    UNARY_OP = auto()
    LITERAL = auto()
    VARIABLE = auto()
    IF_EXPRESSION = auto()
    SWITCH_EXPRESSION = auto()


class BinaryOperator(Enum):
    """Binary operators in DAX."""
    ADD = "+"
    SUBTRACT = "-"
    MULTIPLY = "*"
    DIVIDE = "/"
    POWER = "^"
    EQUALS = "="
    NOT_EQUALS = "<>"
    LESS_THAN = "<"
    LESS_EQUAL = "<="
    GREATER_THAN = ">"
    GREATER_EQUAL = ">="
    AND = "&&"
    OR = "||"
    AMPERSAND = "&"  # String concatenation


class UnaryOperator(Enum):
    """Unary operators in DAX."""
    NEGATE = "-"
    NOT = "NOT"


@dataclass(frozen=True)
class DaxNode(ABC):
    """
    Base class for all DAX AST nodes.
    
    All nodes are immutable (frozen dataclass) and support:
    - JSON serialization via to_dict()
    - Pretty printing via __str__()
    - Type checking via node_type property
    """
    
    @property
    @abstractmethod
    def node_type(self) -> NodeType:
        """Return the type of this node."""
        pass
    
    @abstractmethod
    def to_dict(self) -> Dict[str, Any]:
        """Convert node to dictionary for JSON serialization."""
        pass
    
    def accept(self, visitor: "DaxVisitor") -> Any:
        """Accept a visitor for tree traversal (Visitor pattern)."""
        method_name = f"visit_{self.__class__.__name__}"
        method = getattr(visitor, method_name, visitor.generic_visit)
        return method(self)


@dataclass(frozen=True)
class DaxLiteral(DaxNode):
    """
    Represents a literal value in DAX.
    
    Examples:
        - 42 (integer)
        - 3.14 (float)
        - "Hello" (string)
        - TRUE (boolean)
        - BLANK() (blank/null)
    """
    value: Union[int, float, str, bool, None]
    literal_type: str  # "integer", "float", "string", "boolean", "blank"
    
    @property
    def node_type(self) -> NodeType:
        return NodeType.LITERAL
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": "literal",
            "value": self.value,
            "literal_type": self.literal_type,
        }
    
    def __str__(self) -> str:
        if self.literal_type == "string":
            return f'"{self.value}"'
        elif self.literal_type == "blank":
            return "BLANK()"
        return str(self.value)


@dataclass(frozen=True)
class DaxColumn(DaxNode):
    """
    Represents a column reference in DAX.
    
    Format: Table[Column] or just [Column]
    
    Examples:
        - Sales[Amount]
        - [Total Revenue]
        - 'Dim Date'[Year]
    """
    table_name: Optional[str]  # None if unqualified [Column]
    column_name: str
    
    @property
    def node_type(self) -> NodeType:
        return NodeType.COLUMN
    
    @property
    def fully_qualified_name(self) -> str:
        """Return full Table[Column] format."""
        if self.table_name:
            return f"{self.table_name}[{self.column_name}]"
        return f"[{self.column_name}]"
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": "column",
            "table": self.table_name,
            "column": self.column_name,
            "qualified_name": self.fully_qualified_name,
        }
    
    def __str__(self) -> str:
        return self.fully_qualified_name


@dataclass(frozen=True)
class DaxTable(DaxNode):
    """
    Represents a table reference in DAX.
    
    Examples:
        - Sales
        - 'Dim Date'
        - ALL(Sales)
    """
    table_name: str
    
    @property
    def node_type(self) -> NodeType:
        return NodeType.TABLE
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": "table",
            "name": self.table_name,
        }
    
    def __str__(self) -> str:
        if " " in self.table_name:
            return f"'{self.table_name}'"
        return self.table_name


@dataclass(frozen=True)
class DaxMeasure(DaxNode):
    """
    Represents a measure definition in DAX.
    
    Format: [Measure Name] = expression
    
    Examples:
        - [Total Sales] = SUM(Sales[Amount])
        - [YoY Growth] = DIVIDE([This Year], [Last Year]) - 1
    """
    name: str
    expression: "DaxExpression"
    format_string: Optional[str] = None
    description: Optional[str] = None
    
    @property
    def node_type(self) -> NodeType:
        return NodeType.MEASURE
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": "measure",
            "name": self.name,
            "expression": self.expression.to_dict(),
            "format_string": self.format_string,
            "description": self.description,
        }
    
    def __str__(self) -> str:
        return f"[{self.name}] = {self.expression}"


@dataclass(frozen=True)
class DaxFunction(DaxNode):
    """
    Represents a DAX function call.
    
    Categories:
        - Aggregation: SUM, AVERAGE, COUNT, MIN, MAX
        - Filter: FILTER, ALL, ALLEXCEPT, VALUES
        - Time Intelligence: DATEADD, SAMEPERIODLASTYEAR, DATESYTD
        - Logical: IF, SWITCH, AND, OR
        - Text: CONCATENATE, FORMAT, LEFT, RIGHT
        - Math: DIVIDE, ABS, ROUND
        - Table: CALCULATETABLE, SUMMARIZE, ADDCOLUMNS
    """
    function_name: str
    arguments: List["DaxExpression"] = field(default_factory=list)
    
    @property
    def node_type(self) -> NodeType:
        return NodeType.FUNCTION
    
    @property
    def category(self) -> str:
        """Determine the category of this DAX function."""
        aggregations = {"SUM", "AVERAGE", "COUNT", "COUNTROWS", "MIN", "MAX", 
                       "SUMX", "AVERAGEX", "COUNTX", "MINX", "MAXX",
                       "DISTINCTCOUNT", "DISTINCTCOUNTNOBLANK"}
        filters = {"FILTER", "ALL", "ALLEXCEPT", "ALLSELECTED", "VALUES",
                  "CALCULATE", "CALCULATETABLE", "KEEPFILTERS", "REMOVEFILTERS"}
        time_intel = {"DATEADD", "SAMEPERIODLASTYEAR", "PREVIOUSYEAR", "PREVIOUSMONTH",
                     "DATESYTD", "DATESMTD", "DATESQTD", "TOTALYTD", "TOTALMTD",
                     "PARALLELPERIOD", "DATESBETWEEN", "DATESINPERIOD"}
        logical = {"IF", "SWITCH", "AND", "OR", "NOT", "TRUE", "FALSE", "IFERROR",
                  "ISBLANK", "ISERROR", "COALESCE"}
        text = {"CONCATENATE", "FORMAT", "LEFT", "RIGHT", "MID", "LEN", "UPPER",
               "LOWER", "TRIM", "SUBSTITUTE", "SEARCH", "FIND"}
        math = {"DIVIDE", "ABS", "ROUND", "ROUNDUP", "ROUNDDOWN", "INT", "MOD",
               "POWER", "SQRT", "LOG", "EXP", "SIGN"}
        table = {"SUMMARIZE", "ADDCOLUMNS", "SELECTCOLUMNS", "CROSSJOIN",
                "UNION", "INTERSECT", "EXCEPT", "NATURALINNERJOIN"}
        
        name_upper = self.function_name.upper()
        if name_upper in aggregations:
            return "aggregation"
        elif name_upper in filters:
            return "filter"
        elif name_upper in time_intel:
            return "time_intelligence"
        elif name_upper in logical:
            return "logical"
        elif name_upper in text:
            return "text"
        elif name_upper in math:
            return "math"
        elif name_upper in table:
            return "table"
        return "unknown"
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": "function",
            "name": self.function_name,
            "category": self.category,
            "arguments": [arg.to_dict() for arg in self.arguments],
            "argument_count": len(self.arguments),
        }
    
    def __str__(self) -> str:
        args_str = ", ".join(str(arg) for arg in self.arguments)
        return f"{self.function_name}({args_str})"


@dataclass(frozen=True)
class DaxBinaryOp(DaxNode):
    """
    Represents a binary operation in DAX.
    
    Examples:
        - [Sales] + [Tax]
        - [Revenue] / [Quantity]
        - [Value] >= 100
    """
    left: "DaxExpression"
    operator: BinaryOperator
    right: "DaxExpression"
    
    @property
    def node_type(self) -> NodeType:
        return NodeType.BINARY_OP
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": "binary_op",
            "operator": self.operator.value,
            "left": self.left.to_dict(),
            "right": self.right.to_dict(),
        }
    
    def __str__(self) -> str:
        return f"({self.left} {self.operator.value} {self.right})"


@dataclass(frozen=True)
class DaxUnaryOp(DaxNode):
    """
    Represents a unary operation in DAX.
    
    Examples:
        - -[Value]
        - NOT [IsActive]
    """
    operator: UnaryOperator
    operand: "DaxExpression"
    
    @property
    def node_type(self) -> NodeType:
        return NodeType.UNARY_OP
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": "unary_op",
            "operator": self.operator.value,
            "operand": self.operand.to_dict(),
        }
    
    def __str__(self) -> str:
        if self.operator == UnaryOperator.NOT:
            return f"NOT {self.operand}"
        return f"{self.operator.value}{self.operand}"


@dataclass(frozen=True)
class DaxVariable(DaxNode):
    """
    Represents a variable declaration or reference in DAX.
    
    Examples:
        - VAR TotalSales = SUM(Sales[Amount])
        - RETURN TotalSales
    """
    name: str
    expression: Optional["DaxExpression"] = None  # None if just a reference
    is_definition: bool = False
    
    @property
    def node_type(self) -> NodeType:
        return NodeType.VARIABLE
    
    def to_dict(self) -> Dict[str, Any]:
        result = {
            "type": "variable",
            "name": self.name,
            "is_definition": self.is_definition,
        }
        if self.expression:
            result["expression"] = self.expression.to_dict()
        return result
    
    def __str__(self) -> str:
        if self.is_definition and self.expression:
            return f"VAR {self.name} = {self.expression}"
        return self.name


@dataclass(frozen=True)
class DaxIfExpression(DaxNode):
    """
    Represents an IF expression in DAX.
    
    Example:
        IF([Sales] > 1000, "High", "Low")
    """
    condition: "DaxExpression"
    true_result: "DaxExpression"
    false_result: Optional["DaxExpression"] = None
    
    @property
    def node_type(self) -> NodeType:
        return NodeType.IF_EXPRESSION
    
    def to_dict(self) -> Dict[str, Any]:
        result = {
            "type": "if_expression",
            "condition": self.condition.to_dict(),
            "true_result": self.true_result.to_dict(),
        }
        if self.false_result:
            result["false_result"] = self.false_result.to_dict()
        return result
    
    def __str__(self) -> str:
        if self.false_result:
            return f"IF({self.condition}, {self.true_result}, {self.false_result})"
        return f"IF({self.condition}, {self.true_result})"


# Type alias for any DAX expression
DaxExpression = Union[
    DaxLiteral,
    DaxColumn,
    DaxTable,
    DaxMeasure,
    DaxFunction,
    DaxBinaryOp,
    DaxUnaryOp,
    DaxVariable,
    DaxIfExpression,
]


class DaxVisitor(ABC):
    """
    Base class for AST visitors (Visitor pattern).
    
    Subclass this and implement visit_* methods for each node type
    you want to handle.
    """
    
    def generic_visit(self, node: DaxNode) -> Any:
        """Called for nodes without a specific visitor method."""
        raise NotImplementedError(f"No visitor for {type(node).__name__}")
    
    def visit_DaxLiteral(self, node: DaxLiteral) -> Any:
        return self.generic_visit(node)
    
    def visit_DaxColumn(self, node: DaxColumn) -> Any:
        return self.generic_visit(node)
    
    def visit_DaxTable(self, node: DaxTable) -> Any:
        return self.generic_visit(node)
    
    def visit_DaxMeasure(self, node: DaxMeasure) -> Any:
        return self.generic_visit(node)
    
    def visit_DaxFunction(self, node: DaxFunction) -> Any:
        return self.generic_visit(node)
    
    def visit_DaxBinaryOp(self, node: DaxBinaryOp) -> Any:
        return self.generic_visit(node)
    
    def visit_DaxUnaryOp(self, node: DaxUnaryOp) -> Any:
        return self.generic_visit(node)
    
    def visit_DaxVariable(self, node: DaxVariable) -> Any:
        return self.generic_visit(node)
    
    def visit_DaxIfExpression(self, node: DaxIfExpression) -> Any:
        return self.generic_visit(node)







