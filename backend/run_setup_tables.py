"""
Script to create SnowFlow metadata tables in Snowflake.
Run this once to set up the necessary tables for persisting tools, templates, and audit logs.
"""

from snowflake_client import snowflake_client
import os

def run_setup():
    print("🔌 Connecting to Snowflake...")
    snowflake_client.connect()
    
    print("📦 Creating SnowFlow metadata tables...")
    
    # Read the SQL file
    sql_file = os.path.join(os.path.dirname(__file__), 'setup_snowflow_tables.sql')
    with open(sql_file, 'r') as f:
        sql_content = f.read()
    
    # Split into individual statements
    statements = [s.strip() for s in sql_content.split(';') if s.strip() and not s.strip().startswith('--')]
    
    for i, stmt in enumerate(statements):
        if not stmt or stmt.startswith('--'):
            continue
        try:
            # Skip comments
            lines = [l for l in stmt.split('\n') if not l.strip().startswith('--')]
            clean_stmt = '\n'.join(lines)
            if clean_stmt.strip():
                print(f"  Executing statement {i+1}...")
                snowflake_client.execute_sql(clean_stmt)
        except Exception as e:
            print(f"  ⚠️  Statement {i+1} error: {str(e)[:100]}")
    
    print("✅ Setup complete!")
    print("\nTables created:")
    print("  - SNOWFLOW_TOOLS (custom tool definitions)")
    print("  - SNOWFLOW_TEMPLATES (workflow templates)")
    print("  - SNOWFLOW_WORKFLOWS (saved workflows)")
    print("  - SNOWFLOW_AUDIT_LOG (governance audit trail)")
    print("  - SNOWFLOW_DATA_SOURCES (data catalog registry)")

if __name__ == "__main__":
    run_setup()


Script to create SnowFlow metadata tables in Snowflake.
Run this once to set up the necessary tables for persisting tools, templates, and audit logs.
"""

from snowflake_client import snowflake_client
import os

def run_setup():
    print("🔌 Connecting to Snowflake...")
    snowflake_client.connect()
    
    print("📦 Creating SnowFlow metadata tables...")
    
    # Read the SQL file
    sql_file = os.path.join(os.path.dirname(__file__), 'setup_snowflow_tables.sql')
    with open(sql_file, 'r') as f:
        sql_content = f.read()
    
    # Split into individual statements
    statements = [s.strip() for s in sql_content.split(';') if s.strip() and not s.strip().startswith('--')]
    
    for i, stmt in enumerate(statements):
        if not stmt or stmt.startswith('--'):
            continue
        try:
            # Skip comments
            lines = [l for l in stmt.split('\n') if not l.strip().startswith('--')]
            clean_stmt = '\n'.join(lines)
            if clean_stmt.strip():
                print(f"  Executing statement {i+1}...")
                snowflake_client.execute_sql(clean_stmt)
        except Exception as e:
            print(f"  ⚠️  Statement {i+1} error: {str(e)[:100]}")
    
    print("✅ Setup complete!")
    print("\nTables created:")
    print("  - SNOWFLOW_TOOLS (custom tool definitions)")
    print("  - SNOWFLOW_TEMPLATES (workflow templates)")
    print("  - SNOWFLOW_WORKFLOWS (saved workflows)")
    print("  - SNOWFLOW_AUDIT_LOG (governance audit trail)")
    print("  - SNOWFLOW_DATA_SOURCES (data catalog registry)")

if __name__ == "__main__":
    run_setup()












