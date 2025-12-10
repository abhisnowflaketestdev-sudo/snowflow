"""
Schema Context Analyzer

Manages schema information needed for DAX → SQL translation:
- Table structures (columns, types)
- Table relationships (foreign keys)
- Column mappings (DAX name → SQL name)
- Filter context state

This enables context-aware translation where DAX functions
like RELATED() and CALCULATE() need to understand the data model.
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set, Tuple, Any
from enum import Enum, auto
import json


class RelationshipType(Enum):
    """Type of relationship between tables."""
    ONE_TO_MANY = auto()
    MANY_TO_ONE = auto()
    ONE_TO_ONE = auto()
    MANY_TO_MANY = auto()


class CrossFilterDirection(Enum):
    """Direction of cross-filtering in relationships."""
    SINGLE = auto()      # Filters flow one direction
    BOTH = auto()        # Filters flow both directions
    NONE = auto()        # No cross-filtering


class ColumnType(Enum):
    """Data types for columns."""
    STRING = "string"
    INTEGER = "integer"
    FLOAT = "float"
    DECIMAL = "decimal"
    DATE = "date"
    DATETIME = "datetime"
    BOOLEAN = "boolean"
    UNKNOWN = "unknown"
    
    @classmethod
    def from_snowflake_type(cls, sf_type: str) -> "ColumnType":
        """Convert Snowflake type to ColumnType."""
        sf_type = sf_type.upper()
        if sf_type in ("VARCHAR", "STRING", "TEXT", "CHAR"):
            return cls.STRING
        elif sf_type in ("INTEGER", "INT", "BIGINT", "SMALLINT", "TINYINT"):
            return cls.INTEGER
        elif sf_type in ("FLOAT", "DOUBLE", "REAL"):
            return cls.FLOAT
        elif sf_type in ("NUMBER", "DECIMAL", "NUMERIC"):
            return cls.DECIMAL
        elif sf_type == "DATE":
            return cls.DATE
        elif sf_type in ("DATETIME", "TIMESTAMP", "TIMESTAMP_NTZ", "TIMESTAMP_LTZ", "TIMESTAMP_TZ"):
            return cls.DATETIME
        elif sf_type == "BOOLEAN":
            return cls.BOOLEAN
        return cls.UNKNOWN


@dataclass
class Column:
    """
    Represents a column in a table.
    
    Attributes:
        name: Column name in SQL
        dax_name: Column name as referenced in DAX (if different)
        data_type: Column data type
        is_key: Whether this is a primary/foreign key
        is_nullable: Whether null values are allowed
        description: Optional description
    """
    name: str
    dax_name: Optional[str] = None
    data_type: ColumnType = ColumnType.UNKNOWN
    is_key: bool = False
    is_nullable: bool = True
    description: Optional[str] = None
    
    @property
    def effective_dax_name(self) -> str:
        """Get the DAX name (or SQL name if no DAX name set)."""
        return self.dax_name or self.name
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "dax_name": self.dax_name,
            "data_type": self.data_type.value,
            "is_key": self.is_key,
            "is_nullable": self.is_nullable,
            "description": self.description,
        }


@dataclass
class Table:
    """
    Represents a table in the schema.
    
    Attributes:
        name: SQL table name
        dax_name: DAX table name (if different)
        schema: Database schema name
        columns: List of columns
        primary_key: Primary key column(s)
        description: Optional description
    """
    name: str
    dax_name: Optional[str] = None
    schema: Optional[str] = None
    columns: List[Column] = field(default_factory=list)
    primary_key: List[str] = field(default_factory=list)
    description: Optional[str] = None
    
    @property
    def effective_dax_name(self) -> str:
        """Get the DAX name (or SQL name if no DAX name set)."""
        return self.dax_name or self.name
    
    @property
    def full_name(self) -> str:
        """Get fully qualified SQL name."""
        if self.schema:
            return f"{self.schema}.{self.name}"
        return self.name
    
    def get_column(self, name: str) -> Optional[Column]:
        """Get column by name (SQL or DAX name)."""
        for col in self.columns:
            if col.name.lower() == name.lower():
                return col
            if col.dax_name and col.dax_name.lower() == name.lower():
                return col
        return None
    
    def get_column_sql_name(self, dax_name: str) -> Optional[str]:
        """Get SQL column name from DAX column name."""
        col = self.get_column(dax_name)
        return col.name if col else None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "dax_name": self.dax_name,
            "schema": self.schema,
            "columns": [c.to_dict() for c in self.columns],
            "primary_key": self.primary_key,
            "description": self.description,
        }


@dataclass
class TableRelationship:
    """
    Represents a relationship between two tables.
    
    In DAX terms, this defines how RELATED() and
    cross-filtering work between tables.
    """
    from_table: str
    from_column: str
    to_table: str
    to_column: str
    relationship_type: RelationshipType = RelationshipType.MANY_TO_ONE
    cross_filter: CrossFilterDirection = CrossFilterDirection.SINGLE
    is_active: bool = True
    
    @property
    def as_join(self) -> str:
        """Generate SQL JOIN clause."""
        return f"{self.from_table}.{self.from_column} = {self.to_table}.{self.to_column}"
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "from_table": self.from_table,
            "from_column": self.from_column,
            "to_table": self.to_table,
            "to_column": self.to_column,
            "relationship_type": self.relationship_type.name,
            "cross_filter": self.cross_filter.name,
            "is_active": self.is_active,
        }


@dataclass
class FilterContext:
    """
    Represents the current filter context during translation.
    
    DAX's filter context is crucial for CALCULATE and related functions.
    This tracks what filters are applied.
    """
    filters: Dict[str, List[str]] = field(default_factory=dict)  # table.column -> conditions
    removed_filters: Set[str] = field(default_factory=set)  # ALL() removed these
    
    def add_filter(self, table: str, column: str, condition: str) -> None:
        """Add a filter condition."""
        key = f"{table}.{column}"
        if key not in self.filters:
            self.filters[key] = []
        self.filters[key].append(condition)
    
    def remove_filter(self, table: str, column: Optional[str] = None) -> None:
        """Remove filters (like ALL() does)."""
        if column:
            key = f"{table}.{column}"
            self.removed_filters.add(key)
        else:
            # Remove all filters for the table
            keys_to_remove = [k for k in self.filters.keys() if k.startswith(f"{table}.")]
            for k in keys_to_remove:
                self.removed_filters.add(k)
    
    def get_effective_filters(self) -> Dict[str, List[str]]:
        """Get filters excluding removed ones."""
        return {
            k: v for k, v in self.filters.items() 
            if k not in self.removed_filters
        }
    
    def to_where_clause(self) -> str:
        """Generate SQL WHERE clause from filters."""
        effective = self.get_effective_filters()
        if not effective:
            return ""
        
        conditions = []
        for key, filter_list in effective.items():
            conditions.extend(filter_list)
        
        return " AND ".join(conditions)


class SchemaContext:
    """
    Complete schema context for DAX → SQL translation.
    
    This class manages:
    - All tables and their columns
    - Relationships between tables
    - Name mappings (DAX ↔ SQL)
    - Current filter context
    
    Usage:
        ctx = SchemaContext()
        ctx.add_table(Table(name="sales", ...))
        ctx.add_relationship(TableRelationship(...))
        
        # During translation:
        sql_name = ctx.get_sql_column_name("Sales", "Amount")
        joins = ctx.get_join_path("Sales", "Date")
    """
    
    def __init__(self):
        self.tables: Dict[str, Table] = {}
        self.relationships: List[TableRelationship] = []
        self.filter_context = FilterContext()
        
        # Name mappings for quick lookup
        self._dax_to_sql_table: Dict[str, str] = {}
        self._sql_to_dax_table: Dict[str, str] = {}
    
    def add_table(self, table: Table) -> None:
        """Add a table to the schema."""
        self.tables[table.name.lower()] = table
        
        # Update name mappings
        dax_name = table.effective_dax_name.lower()
        sql_name = table.name.lower()
        self._dax_to_sql_table[dax_name] = sql_name
        self._sql_to_dax_table[sql_name] = dax_name
    
    def add_relationship(self, rel: TableRelationship) -> None:
        """Add a relationship between tables."""
        self.relationships.append(rel)
    
    def get_table(self, name: str) -> Optional[Table]:
        """Get table by SQL or DAX name."""
        name_lower = name.lower()
        
        # Try SQL name first
        if name_lower in self.tables:
            return self.tables[name_lower]
        
        # Try DAX name
        sql_name = self._dax_to_sql_table.get(name_lower)
        if sql_name:
            return self.tables.get(sql_name)
        
        return None
    
    def get_sql_table_name(self, dax_name: str) -> Optional[str]:
        """Convert DAX table name to SQL table name."""
        return self._dax_to_sql_table.get(dax_name.lower())
    
    def get_sql_column_name(self, table_name: str, column_name: str) -> Optional[str]:
        """Get SQL column name from DAX reference."""
        table = self.get_table(table_name)
        if table:
            return table.get_column_sql_name(column_name)
        return None
    
    def get_relationships_for_table(self, table_name: str) -> List[TableRelationship]:
        """Get all relationships involving a table."""
        table_lower = table_name.lower()
        return [
            r for r in self.relationships
            if r.from_table.lower() == table_lower or r.to_table.lower() == table_lower
        ]
    
    def get_join_path(self, from_table: str, to_table: str) -> List[TableRelationship]:
        """
        Find relationship path between two tables.
        
        Uses BFS to find the shortest path.
        Returns list of relationships to traverse.
        """
        from_lower = from_table.lower()
        to_lower = to_table.lower()
        
        if from_lower == to_lower:
            return []
        
        # BFS to find path
        visited = {from_lower}
        queue = [(from_lower, [])]
        
        while queue:
            current, path = queue.pop(0)
            
            for rel in self.relationships:
                if not rel.is_active:
                    continue
                
                # Check both directions
                if rel.from_table.lower() == current:
                    next_table = rel.to_table.lower()
                elif rel.to_table.lower() == current:
                    next_table = rel.from_table.lower()
                else:
                    continue
                
                if next_table in visited:
                    continue
                
                new_path = path + [rel]
                
                if next_table == to_lower:
                    return new_path
                
                visited.add(next_table)
                queue.append((next_table, new_path))
        
        return []  # No path found
    
    def generate_joins(self, tables: List[str]) -> str:
        """
        Generate SQL JOINs for a list of tables.
        
        Assumes first table is the base table.
        """
        if len(tables) < 2:
            return ""
        
        base = tables[0]
        joins = []
        joined = {base.lower()}
        
        for table in tables[1:]:
            if table.lower() in joined:
                continue
            
            # Find path from any joined table to this table
            for j in joined:
                path = self.get_join_path(j, table)
                if path:
                    for rel in path:
                        join_table = rel.to_table if rel.from_table.lower() in joined else rel.from_table
                        if join_table.lower() not in joined:
                            joins.append(
                                f"JOIN {join_table} ON {rel.as_join}"
                            )
                            joined.add(join_table.lower())
                    break
        
        return "\n".join(joins)
    
    def to_dict(self) -> Dict[str, Any]:
        """Serialize schema context to dictionary."""
        return {
            "tables": {name: t.to_dict() for name, t in self.tables.items()},
            "relationships": [r.to_dict() for r in self.relationships],
        }
    
    def to_json(self) -> str:
        """Serialize schema context to JSON."""
        return json.dumps(self.to_dict(), indent=2)
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "SchemaContext":
        """Create schema context from dictionary."""
        ctx = cls()
        
        for name, table_data in data.get("tables", {}).items():
            columns = [
                Column(
                    name=c["name"],
                    dax_name=c.get("dax_name"),
                    data_type=ColumnType(c.get("data_type", "unknown")),
                    is_key=c.get("is_key", False),
                    is_nullable=c.get("is_nullable", True),
                    description=c.get("description"),
                )
                for c in table_data.get("columns", [])
            ]
            
            table = Table(
                name=table_data["name"],
                dax_name=table_data.get("dax_name"),
                schema=table_data.get("schema"),
                columns=columns,
                primary_key=table_data.get("primary_key", []),
                description=table_data.get("description"),
            )
            ctx.add_table(table)
        
        for rel_data in data.get("relationships", []):
            rel = TableRelationship(
                from_table=rel_data["from_table"],
                from_column=rel_data["from_column"],
                to_table=rel_data["to_table"],
                to_column=rel_data["to_column"],
                relationship_type=RelationshipType[rel_data.get("relationship_type", "MANY_TO_ONE")],
                cross_filter=CrossFilterDirection[rel_data.get("cross_filter", "SINGLE")],
                is_active=rel_data.get("is_active", True),
            )
            ctx.add_relationship(rel)
        
        return ctx
    
    @classmethod
    def from_json(cls, json_str: str) -> "SchemaContext":
        """Create schema context from JSON."""
        return cls.from_dict(json.loads(json_str))
    
    def to_prompt_context(self) -> str:
        """
        Generate schema description for LLM prompts.
        
        Returns a formatted string describing the schema
        that can be included in translation prompts.
        """
        lines = ["# Schema Context\n"]
        
        lines.append("## Tables\n")
        for name, table in self.tables.items():
            lines.append(f"### {table.effective_dax_name} (SQL: {table.full_name})")
            if table.description:
                lines.append(f"Description: {table.description}")
            lines.append("Columns:")
            for col in table.columns:
                key_marker = " [KEY]" if col.is_key else ""
                lines.append(f"  - {col.effective_dax_name}: {col.data_type.value}{key_marker}")
            lines.append("")
        
        if self.relationships:
            lines.append("## Relationships\n")
            for rel in self.relationships:
                direction = "→" if rel.relationship_type == RelationshipType.MANY_TO_ONE else "↔"
                lines.append(f"- {rel.from_table}.{rel.from_column} {direction} {rel.to_table}.{rel.to_column}")
        
        return "\n".join(lines)


def create_sample_retail_context() -> SchemaContext:
    """
    Create a sample schema context for retail data.
    
    This can be used for testing and demos.
    """
    ctx = SchemaContext()
    
    # Sales fact table
    ctx.add_table(Table(
        name="sales",
        dax_name="Sales",
        columns=[
            Column("sale_id", data_type=ColumnType.INTEGER, is_key=True),
            Column("date_key", dax_name="DateKey", data_type=ColumnType.INTEGER),
            Column("product_key", dax_name="ProductKey", data_type=ColumnType.INTEGER),
            Column("store_key", dax_name="StoreKey", data_type=ColumnType.INTEGER),
            Column("customer_key", dax_name="CustomerKey", data_type=ColumnType.INTEGER),
            Column("quantity", dax_name="Quantity", data_type=ColumnType.INTEGER),
            Column("amount", dax_name="Amount", data_type=ColumnType.DECIMAL),
            Column("discount", dax_name="Discount", data_type=ColumnType.DECIMAL),
        ],
        primary_key=["sale_id"],
        description="Sales transactions",
    ))
    
    # Date dimension
    ctx.add_table(Table(
        name="dim_date",
        dax_name="Date",
        columns=[
            Column("date_key", data_type=ColumnType.INTEGER, is_key=True),
            Column("date", dax_name="Date", data_type=ColumnType.DATE),
            Column("year", dax_name="Year", data_type=ColumnType.INTEGER),
            Column("quarter", dax_name="Quarter", data_type=ColumnType.INTEGER),
            Column("month", dax_name="Month", data_type=ColumnType.INTEGER),
            Column("month_name", dax_name="MonthName", data_type=ColumnType.STRING),
            Column("day", dax_name="Day", data_type=ColumnType.INTEGER),
            Column("day_of_week", dax_name="DayOfWeek", data_type=ColumnType.INTEGER),
            Column("week", dax_name="Week", data_type=ColumnType.INTEGER),
        ],
        primary_key=["date_key"],
        description="Date dimension for time intelligence",
    ))
    
    # Product dimension
    ctx.add_table(Table(
        name="dim_product",
        dax_name="Product",
        columns=[
            Column("product_key", data_type=ColumnType.INTEGER, is_key=True),
            Column("product_name", dax_name="ProductName", data_type=ColumnType.STRING),
            Column("category", dax_name="Category", data_type=ColumnType.STRING),
            Column("subcategory", dax_name="Subcategory", data_type=ColumnType.STRING),
            Column("brand", dax_name="Brand", data_type=ColumnType.STRING),
            Column("unit_price", dax_name="UnitPrice", data_type=ColumnType.DECIMAL),
        ],
        primary_key=["product_key"],
        description="Product dimension",
    ))
    
    # Store dimension
    ctx.add_table(Table(
        name="dim_store",
        dax_name="Store",
        columns=[
            Column("store_key", data_type=ColumnType.INTEGER, is_key=True),
            Column("store_name", dax_name="StoreName", data_type=ColumnType.STRING),
            Column("city", dax_name="City", data_type=ColumnType.STRING),
            Column("state", dax_name="State", data_type=ColumnType.STRING),
            Column("region", dax_name="Region", data_type=ColumnType.STRING),
        ],
        primary_key=["store_key"],
        description="Store dimension",
    ))
    
    # Customer dimension
    ctx.add_table(Table(
        name="dim_customer",
        dax_name="Customer",
        columns=[
            Column("customer_key", data_type=ColumnType.INTEGER, is_key=True),
            Column("customer_name", dax_name="CustomerName", data_type=ColumnType.STRING),
            Column("email", dax_name="Email", data_type=ColumnType.STRING),
            Column("segment", dax_name="Segment", data_type=ColumnType.STRING),
        ],
        primary_key=["customer_key"],
        description="Customer dimension",
    ))
    
    # Relationships
    ctx.add_relationship(TableRelationship(
        from_table="sales", from_column="date_key",
        to_table="dim_date", to_column="date_key",
        relationship_type=RelationshipType.MANY_TO_ONE,
    ))
    
    ctx.add_relationship(TableRelationship(
        from_table="sales", from_column="product_key",
        to_table="dim_product", to_column="product_key",
        relationship_type=RelationshipType.MANY_TO_ONE,
    ))
    
    ctx.add_relationship(TableRelationship(
        from_table="sales", from_column="store_key",
        to_table="dim_store", to_column="store_key",
        relationship_type=RelationshipType.MANY_TO_ONE,
    ))
    
    ctx.add_relationship(TableRelationship(
        from_table="sales", from_column="customer_key",
        to_table="dim_customer", to_column="customer_key",
        relationship_type=RelationshipType.MANY_TO_ONE,
    ))
    
    return ctx







