"""
Setup script to create sample retail data in Snowflake for the SnowFlow demo.

This creates realistic UK grocery retailer data that agents can actually query.
"""

import sys
sys.path.append('.')
from snowflake_client import snowflake_client

def setup_retail_data():
    """Create sample retail tables with realistic data"""
    
    print("🏪 Setting up retail demo data in Snowflake...")
    
    # Create schema if not exists
    try:
        snowflake_client.execute_query("""
            CREATE SCHEMA IF NOT EXISTS SNOWFLOW_DEV.RETAIL_DEMO
        """)
        print("✅ Schema RETAIL_DEMO created/verified")
    except Exception as e:
        print(f"⚠️ Schema creation: {e}")
    
    # =========================================================================
    # SALES DATA
    # =========================================================================
    print("\n📊 Creating SALES_TRANSACTIONS table...")
    try:
        snowflake_client.execute_query("""
            CREATE OR REPLACE TABLE SNOWFLOW_DEV.RETAIL_DEMO.SALES_TRANSACTIONS (
                transaction_id VARCHAR(20),
                transaction_date DATE,
                store_id VARCHAR(10),
                region VARCHAR(50),
                product_id VARCHAR(20),
                product_name VARCHAR(100),
                category VARCHAR(50),
                quantity INT,
                unit_price DECIMAL(10,2),
                total_amount DECIMAL(10,2),
                cost_amount DECIMAL(10,2),
                margin_amount DECIMAL(10,2),
                margin_pct DECIMAL(5,2),
                customer_id VARCHAR(20),
                is_promotion BOOLEAN
            )
        """)
        
        # Insert sample sales data
        snowflake_client.execute_query("""
            INSERT INTO SNOWFLOW_DEV.RETAIL_DEMO.SALES_TRANSACTIONS VALUES
            -- Scotland stores - showing margin drop scenario
            ('TXN001', '2024-10-15', 'SCO001', 'Scotland', 'PROD001', 'Organic Milk 2L', 'Dairy', 3, 2.50, 7.50, 6.00, 1.50, 20.00, 'CUST001', TRUE),
            ('TXN002', '2024-10-15', 'SCO001', 'Scotland', 'PROD002', 'Whole Chicken', 'Meat', 1, 8.99, 8.99, 7.50, 1.49, 16.57, 'CUST001', TRUE),
            ('TXN003', '2024-10-16', 'SCO002', 'Scotland', 'PROD003', 'Sourdough Bread', 'Bakery', 2, 3.50, 7.00, 5.80, 1.20, 17.14, 'CUST002', FALSE),
            ('TXN004', '2024-10-17', 'SCO001', 'Scotland', 'PROD004', 'Scottish Salmon', 'Fish', 1, 12.99, 12.99, 11.50, 1.49, 11.47, 'CUST003', TRUE),
            ('TXN005', '2024-10-18', 'SCO003', 'Scotland', 'PROD005', 'Whisky 70cl', 'Alcohol', 1, 28.00, 28.00, 22.00, 6.00, 21.43, 'CUST004', FALSE),
            ('TXN006', '2024-10-19', 'SCO002', 'Scotland', 'PROD001', 'Organic Milk 2L', 'Dairy', 5, 2.20, 11.00, 10.00, 1.00, 9.09, 'CUST005', TRUE),
            ('TXN007', '2024-10-20', 'SCO001', 'Scotland', 'PROD006', 'Fresh Strawberries', 'Produce', 2, 4.00, 8.00, 7.20, 0.80, 10.00, 'CUST006', TRUE),
            ('TXN008', '2024-10-21', 'SCO003', 'Scotland', 'PROD007', 'Free Range Eggs 12pk', 'Dairy', 3, 4.50, 13.50, 11.00, 2.50, 18.52, 'CUST007', FALSE),
            -- England stores - better margins for comparison
            ('TXN009', '2024-10-15', 'ENG001', 'England', 'PROD001', 'Organic Milk 2L', 'Dairy', 4, 2.80, 11.20, 8.00, 3.20, 28.57, 'CUST008', FALSE),
            ('TXN010', '2024-10-16', 'ENG002', 'England', 'PROD002', 'Whole Chicken', 'Meat', 2, 9.99, 19.98, 14.00, 5.98, 29.93, 'CUST009', FALSE),
            ('TXN011', '2024-10-17', 'ENG001', 'England', 'PROD003', 'Sourdough Bread', 'Bakery', 3, 3.80, 11.40, 7.50, 3.90, 34.21, 'CUST010', FALSE),
            ('TXN012', '2024-10-18', 'ENG003', 'England', 'PROD008', 'Premium Beef Steak', 'Meat', 1, 15.99, 15.99, 11.00, 4.99, 31.21, 'CUST011', FALSE),
            ('TXN013', '2024-10-19', 'ENG002', 'England', 'PROD009', 'Champagne 75cl', 'Alcohol', 1, 35.00, 35.00, 25.00, 10.00, 28.57, 'CUST012', FALSE),
            ('TXN014', '2024-10-20', 'ENG001', 'England', 'PROD006', 'Fresh Strawberries', 'Produce', 4, 4.50, 18.00, 12.00, 6.00, 33.33, 'CUST013', FALSE),
            -- Wales stores
            ('TXN015', '2024-10-15', 'WAL001', 'Wales', 'PROD010', 'Welsh Lamb Chops', 'Meat', 1, 11.99, 11.99, 8.50, 3.49, 29.11, 'CUST014', FALSE),
            ('TXN016', '2024-10-16', 'WAL001', 'Wales', 'PROD001', 'Organic Milk 2L', 'Dairy', 2, 2.70, 5.40, 4.00, 1.40, 25.93, 'CUST015', FALSE)
        """)
        print("✅ SALES_TRANSACTIONS created with 16 sample rows")
    except Exception as e:
        print(f"❌ Sales table error: {e}")
    
    # =========================================================================
    # INVENTORY DATA
    # =========================================================================
    print("\n📦 Creating INVENTORY table...")
    try:
        snowflake_client.execute_query("""
            CREATE OR REPLACE TABLE SNOWFLOW_DEV.RETAIL_DEMO.INVENTORY (
                store_id VARCHAR(10),
                region VARCHAR(50),
                product_id VARCHAR(20),
                product_name VARCHAR(100),
                category VARCHAR(50),
                current_stock INT,
                min_stock INT,
                max_stock INT,
                days_of_supply DECIMAL(5,1),
                waste_units INT,
                waste_value DECIMAL(10,2),
                shrinkage_pct DECIMAL(5,2),
                last_delivery DATE,
                next_delivery DATE,
                in_stock_rate DECIMAL(5,2)
            )
        """)
        
        snowflake_client.execute_query("""
            INSERT INTO SNOWFLOW_DEV.RETAIL_DEMO.INVENTORY VALUES
            -- Scotland - showing high waste scenario
            ('SCO001', 'Scotland', 'PROD001', 'Organic Milk 2L', 'Dairy', 45, 50, 200, 3.2, 12, 30.00, 2.1, '2024-10-18', '2024-10-22', 92.5),
            ('SCO001', 'Scotland', 'PROD006', 'Fresh Strawberries', 'Produce', 20, 30, 100, 1.5, 25, 100.00, 3.5, '2024-10-19', '2024-10-21', 85.0),
            ('SCO002', 'Scotland', 'PROD002', 'Whole Chicken', 'Meat', 35, 40, 150, 4.0, 8, 72.00, 1.8, '2024-10-17', '2024-10-23', 94.0),
            ('SCO003', 'Scotland', 'PROD003', 'Sourdough Bread', 'Bakery', 60, 50, 200, 2.8, 18, 63.00, 2.5, '2024-10-20', '2024-10-21', 88.0),
            -- England - better inventory management
            ('ENG001', 'England', 'PROD001', 'Organic Milk 2L', 'Dairy', 120, 50, 200, 5.5, 3, 7.50, 0.8, '2024-10-19', '2024-10-23', 98.5),
            ('ENG001', 'England', 'PROD006', 'Fresh Strawberries', 'Produce', 80, 30, 100, 4.2, 5, 20.00, 1.2, '2024-10-20', '2024-10-22', 97.0),
            ('ENG002', 'England', 'PROD002', 'Whole Chicken', 'Meat', 95, 40, 150, 6.0, 2, 18.00, 0.6, '2024-10-18', '2024-10-24', 99.0),
            ('ENG003', 'England', 'PROD003', 'Sourdough Bread', 'Bakery', 110, 50, 200, 4.8, 4, 14.00, 0.9, '2024-10-20', '2024-10-21', 98.0)
        """)
        print("✅ INVENTORY created with 8 sample rows")
    except Exception as e:
        print(f"❌ Inventory table error: {e}")
    
    # =========================================================================
    # STORE OPERATIONS DATA
    # =========================================================================
    print("\n🏪 Creating STORE_OPERATIONS table...")
    try:
        snowflake_client.execute_query("""
            CREATE OR REPLACE TABLE SNOWFLOW_DEV.RETAIL_DEMO.STORE_OPERATIONS (
                store_id VARCHAR(10),
                region VARCHAR(50),
                store_name VARCHAR(100),
                operation_date DATE,
                footfall INT,
                conversion_rate DECIMAL(5,2),
                avg_basket_value DECIMAL(10,2),
                labour_hours DECIMAL(10,2),
                labour_cost DECIMAL(10,2),
                overtime_hours DECIMAL(10,2),
                overtime_cost DECIMAL(10,2),
                waste_cost DECIMAL(10,2),
                energy_cost DECIMAL(10,2)
            )
        """)
        
        snowflake_client.execute_query("""
            INSERT INTO SNOWFLOW_DEV.RETAIL_DEMO.STORE_OPERATIONS VALUES
            -- Scotland stores - showing high labour costs
            ('SCO001', 'Scotland', 'Edinburgh Central', '2024-10-20', 2500, 32.5, 28.50, 480, 5760.00, 45, 810.00, 450.00, 380.00),
            ('SCO002', 'Scotland', 'Glasgow West', '2024-10-20', 2200, 30.0, 25.80, 440, 5280.00, 52, 936.00, 520.00, 350.00),
            ('SCO003', 'Scotland', 'Aberdeen High St', '2024-10-20', 1800, 28.5, 24.20, 380, 4560.00, 38, 684.00, 380.00, 320.00),
            -- England stores - more efficient
            ('ENG001', 'England', 'London Oxford St', '2024-10-20', 4500, 38.5, 42.00, 600, 7200.00, 15, 270.00, 180.00, 520.00),
            ('ENG002', 'England', 'Manchester Arndale', '2024-10-20', 3200, 35.0, 35.50, 520, 6240.00, 12, 216.00, 150.00, 420.00),
            ('ENG003', 'England', 'Birmingham Bull Ring', '2024-10-20', 2800, 34.0, 33.20, 480, 5760.00, 10, 180.00, 140.00, 400.00),
            -- Wales
            ('WAL001', 'Wales', 'Cardiff Central', '2024-10-20', 2000, 33.0, 30.50, 400, 4800.00, 18, 324.00, 220.00, 340.00)
        """)
        print("✅ STORE_OPERATIONS created with 7 sample rows")
    except Exception as e:
        print(f"❌ Store operations table error: {e}")
    
    # =========================================================================
    # CUSTOMER/LOYALTY DATA
    # =========================================================================
    print("\n👥 Creating CUSTOMER_LOYALTY table...")
    try:
        snowflake_client.execute_query("""
            CREATE OR REPLACE TABLE SNOWFLOW_DEV.RETAIL_DEMO.CUSTOMER_LOYALTY (
                customer_id VARCHAR(20),
                region VARCHAR(50),
                loyalty_tier VARCHAR(20),
                member_since DATE,
                total_spend_ytd DECIMAL(10,2),
                visit_count_ytd INT,
                avg_basket_value DECIMAL(10,2),
                points_balance INT,
                clv_score DECIMAL(10,2),
                retention_risk VARCHAR(20),
                last_visit DATE
            )
        """)
        
        snowflake_client.execute_query("""
            INSERT INTO SNOWFLOW_DEV.RETAIL_DEMO.CUSTOMER_LOYALTY VALUES
            ('CUST001', 'Scotland', 'Gold', '2020-03-15', 2450.00, 52, 47.12, 24500, 890.00, 'Low', '2024-10-20'),
            ('CUST002', 'Scotland', 'Silver', '2021-06-20', 1200.00, 35, 34.29, 12000, 520.00, 'Medium', '2024-10-18'),
            ('CUST003', 'Scotland', 'Bronze', '2022-01-10', 680.00, 22, 30.91, 6800, 280.00, 'High', '2024-10-05'),
            ('CUST004', 'Scotland', 'Gold', '2019-08-01', 3200.00, 68, 47.06, 32000, 1100.00, 'Low', '2024-10-21'),
            ('CUST008', 'England', 'Platinum', '2018-02-14', 5800.00, 95, 61.05, 58000, 1850.00, 'Low', '2024-10-21'),
            ('CUST009', 'England', 'Gold', '2019-11-30', 3100.00, 72, 43.06, 31000, 980.00, 'Low', '2024-10-20'),
            ('CUST010', 'England', 'Silver', '2021-04-05', 1450.00, 42, 34.52, 14500, 580.00, 'Low', '2024-10-19'),
            ('CUST014', 'Wales', 'Gold', '2020-07-22', 2800.00, 58, 48.28, 28000, 920.00, 'Low', '2024-10-20')
        """)
        print("✅ CUSTOMER_LOYALTY created with 8 sample rows")
    except Exception as e:
        print(f"❌ Customer loyalty table error: {e}")
    
    # =========================================================================
    # PROMOTIONS DATA
    # =========================================================================
    print("\n🏷️ Creating PROMOTIONS table...")
    try:
        snowflake_client.execute_query("""
            CREATE OR REPLACE TABLE SNOWFLOW_DEV.RETAIL_DEMO.PROMOTIONS (
                promo_id VARCHAR(20),
                promo_name VARCHAR(100),
                region VARCHAR(50),
                start_date DATE,
                end_date DATE,
                discount_pct DECIMAL(5,2),
                promo_type VARCHAR(50),
                products_included VARCHAR(200),
                budget DECIMAL(10,2),
                actual_spend DECIMAL(10,2),
                redemptions INT,
                incremental_sales DECIMAL(10,2),
                roi DECIMAL(5,2)
            )
        """)
        
        snowflake_client.execute_query("""
            INSERT INTO SNOWFLOW_DEV.RETAIL_DEMO.PROMOTIONS VALUES
            ('PROMO001', 'Scotland Autumn Sale', 'Scotland', '2024-10-01', '2024-10-31', 25.00, 'Multi-buy', 'Dairy, Produce', 15000.00, 18500.00, 4200, 32000.00, 1.73),
            ('PROMO002', 'Fresh Fish Friday', 'Scotland', '2024-10-04', '2024-10-25', 20.00, 'Single Item', 'Fish', 5000.00, 6200.00, 890, 8500.00, 1.37),
            ('PROMO003', 'England Weekend Deals', 'England', '2024-10-01', '2024-10-31', 15.00, 'Multi-buy', 'Meat, Bakery', 20000.00, 19500.00, 5800, 48000.00, 2.46),
            ('PROMO004', 'Loyalty Double Points', 'All', '2024-10-15', '2024-10-21', 0.00, 'Points', 'All Categories', 8000.00, 7500.00, 12000, 28000.00, 3.73),
            ('PROMO005', 'Wales Local Produce', 'Wales', '2024-10-01', '2024-10-31', 10.00, 'Single Item', 'Welsh Products', 3000.00, 2800.00, 650, 6500.00, 2.32)
        """)
        print("✅ PROMOTIONS created with 5 sample rows")
    except Exception as e:
        print(f"❌ Promotions table error: {e}")
    
    # =========================================================================
    # SUMMARY VIEW
    # =========================================================================
    print("\n📈 Creating REGIONAL_MARGIN_SUMMARY view...")
    try:
        snowflake_client.execute_query("""
            CREATE OR REPLACE VIEW SNOWFLOW_DEV.RETAIL_DEMO.REGIONAL_MARGIN_SUMMARY AS
            SELECT 
                region,
                COUNT(DISTINCT transaction_id) as total_transactions,
                SUM(total_amount) as total_revenue,
                SUM(margin_amount) as total_margin,
                ROUND(AVG(margin_pct), 2) as avg_margin_pct,
                SUM(CASE WHEN is_promotion THEN total_amount ELSE 0 END) as promo_revenue,
                ROUND(SUM(CASE WHEN is_promotion THEN total_amount ELSE 0 END) / SUM(total_amount) * 100, 2) as promo_mix_pct
            FROM SNOWFLOW_DEV.RETAIL_DEMO.SALES_TRANSACTIONS
            GROUP BY region
        """)
        print("✅ REGIONAL_MARGIN_SUMMARY view created")
    except Exception as e:
        print(f"❌ View error: {e}")
    
    print("\n" + "="*60)
    print("🎉 RETAIL DEMO DATA SETUP COMPLETE!")
    print("="*60)
    print("\nTables created in SNOWFLOW_DEV.RETAIL_DEMO:")
    print("  • SALES_TRANSACTIONS (16 rows)")
    print("  • INVENTORY (8 rows)")
    print("  • STORE_OPERATIONS (7 rows)")
    print("  • CUSTOMER_LOYALTY (8 rows)")
    print("  • PROMOTIONS (5 rows)")
    print("  • REGIONAL_MARGIN_SUMMARY (view)")
    print("\n📊 Scotland shows LOWER margins due to:")
    print("  • Heavy promotions (25% discount)")
    print("  • Higher waste in produce/dairy")
    print("  • More overtime labour costs")
    print("\nThis is the scenario agents will analyze! 🎯")


if __name__ == "__main__":
    setup_retail_data()

Setup script to create sample retail data in Snowflake for the SnowFlow demo.

This creates realistic UK grocery retailer data that agents can actually query.
"""

import sys
sys.path.append('.')
from snowflake_client import snowflake_client

def setup_retail_data():
    """Create sample retail tables with realistic data"""
    
    print("🏪 Setting up retail demo data in Snowflake...")
    
    # Create schema if not exists
    try:
        snowflake_client.execute_query("""
            CREATE SCHEMA IF NOT EXISTS SNOWFLOW_DEV.RETAIL_DEMO
        """)
        print("✅ Schema RETAIL_DEMO created/verified")
    except Exception as e:
        print(f"⚠️ Schema creation: {e}")
    
    # =========================================================================
    # SALES DATA
    # =========================================================================
    print("\n📊 Creating SALES_TRANSACTIONS table...")
    try:
        snowflake_client.execute_query("""
            CREATE OR REPLACE TABLE SNOWFLOW_DEV.RETAIL_DEMO.SALES_TRANSACTIONS (
                transaction_id VARCHAR(20),
                transaction_date DATE,
                store_id VARCHAR(10),
                region VARCHAR(50),
                product_id VARCHAR(20),
                product_name VARCHAR(100),
                category VARCHAR(50),
                quantity INT,
                unit_price DECIMAL(10,2),
                total_amount DECIMAL(10,2),
                cost_amount DECIMAL(10,2),
                margin_amount DECIMAL(10,2),
                margin_pct DECIMAL(5,2),
                customer_id VARCHAR(20),
                is_promotion BOOLEAN
            )
        """)
        
        # Insert sample sales data
        snowflake_client.execute_query("""
            INSERT INTO SNOWFLOW_DEV.RETAIL_DEMO.SALES_TRANSACTIONS VALUES
            -- Scotland stores - showing margin drop scenario
            ('TXN001', '2024-10-15', 'SCO001', 'Scotland', 'PROD001', 'Organic Milk 2L', 'Dairy', 3, 2.50, 7.50, 6.00, 1.50, 20.00, 'CUST001', TRUE),
            ('TXN002', '2024-10-15', 'SCO001', 'Scotland', 'PROD002', 'Whole Chicken', 'Meat', 1, 8.99, 8.99, 7.50, 1.49, 16.57, 'CUST001', TRUE),
            ('TXN003', '2024-10-16', 'SCO002', 'Scotland', 'PROD003', 'Sourdough Bread', 'Bakery', 2, 3.50, 7.00, 5.80, 1.20, 17.14, 'CUST002', FALSE),
            ('TXN004', '2024-10-17', 'SCO001', 'Scotland', 'PROD004', 'Scottish Salmon', 'Fish', 1, 12.99, 12.99, 11.50, 1.49, 11.47, 'CUST003', TRUE),
            ('TXN005', '2024-10-18', 'SCO003', 'Scotland', 'PROD005', 'Whisky 70cl', 'Alcohol', 1, 28.00, 28.00, 22.00, 6.00, 21.43, 'CUST004', FALSE),
            ('TXN006', '2024-10-19', 'SCO002', 'Scotland', 'PROD001', 'Organic Milk 2L', 'Dairy', 5, 2.20, 11.00, 10.00, 1.00, 9.09, 'CUST005', TRUE),
            ('TXN007', '2024-10-20', 'SCO001', 'Scotland', 'PROD006', 'Fresh Strawberries', 'Produce', 2, 4.00, 8.00, 7.20, 0.80, 10.00, 'CUST006', TRUE),
            ('TXN008', '2024-10-21', 'SCO003', 'Scotland', 'PROD007', 'Free Range Eggs 12pk', 'Dairy', 3, 4.50, 13.50, 11.00, 2.50, 18.52, 'CUST007', FALSE),
            -- England stores - better margins for comparison
            ('TXN009', '2024-10-15', 'ENG001', 'England', 'PROD001', 'Organic Milk 2L', 'Dairy', 4, 2.80, 11.20, 8.00, 3.20, 28.57, 'CUST008', FALSE),
            ('TXN010', '2024-10-16', 'ENG002', 'England', 'PROD002', 'Whole Chicken', 'Meat', 2, 9.99, 19.98, 14.00, 5.98, 29.93, 'CUST009', FALSE),
            ('TXN011', '2024-10-17', 'ENG001', 'England', 'PROD003', 'Sourdough Bread', 'Bakery', 3, 3.80, 11.40, 7.50, 3.90, 34.21, 'CUST010', FALSE),
            ('TXN012', '2024-10-18', 'ENG003', 'England', 'PROD008', 'Premium Beef Steak', 'Meat', 1, 15.99, 15.99, 11.00, 4.99, 31.21, 'CUST011', FALSE),
            ('TXN013', '2024-10-19', 'ENG002', 'England', 'PROD009', 'Champagne 75cl', 'Alcohol', 1, 35.00, 35.00, 25.00, 10.00, 28.57, 'CUST012', FALSE),
            ('TXN014', '2024-10-20', 'ENG001', 'England', 'PROD006', 'Fresh Strawberries', 'Produce', 4, 4.50, 18.00, 12.00, 6.00, 33.33, 'CUST013', FALSE),
            -- Wales stores
            ('TXN015', '2024-10-15', 'WAL001', 'Wales', 'PROD010', 'Welsh Lamb Chops', 'Meat', 1, 11.99, 11.99, 8.50, 3.49, 29.11, 'CUST014', FALSE),
            ('TXN016', '2024-10-16', 'WAL001', 'Wales', 'PROD001', 'Organic Milk 2L', 'Dairy', 2, 2.70, 5.40, 4.00, 1.40, 25.93, 'CUST015', FALSE)
        """)
        print("✅ SALES_TRANSACTIONS created with 16 sample rows")
    except Exception as e:
        print(f"❌ Sales table error: {e}")
    
    # =========================================================================
    # INVENTORY DATA
    # =========================================================================
    print("\n📦 Creating INVENTORY table...")
    try:
        snowflake_client.execute_query("""
            CREATE OR REPLACE TABLE SNOWFLOW_DEV.RETAIL_DEMO.INVENTORY (
                store_id VARCHAR(10),
                region VARCHAR(50),
                product_id VARCHAR(20),
                product_name VARCHAR(100),
                category VARCHAR(50),
                current_stock INT,
                min_stock INT,
                max_stock INT,
                days_of_supply DECIMAL(5,1),
                waste_units INT,
                waste_value DECIMAL(10,2),
                shrinkage_pct DECIMAL(5,2),
                last_delivery DATE,
                next_delivery DATE,
                in_stock_rate DECIMAL(5,2)
            )
        """)
        
        snowflake_client.execute_query("""
            INSERT INTO SNOWFLOW_DEV.RETAIL_DEMO.INVENTORY VALUES
            -- Scotland - showing high waste scenario
            ('SCO001', 'Scotland', 'PROD001', 'Organic Milk 2L', 'Dairy', 45, 50, 200, 3.2, 12, 30.00, 2.1, '2024-10-18', '2024-10-22', 92.5),
            ('SCO001', 'Scotland', 'PROD006', 'Fresh Strawberries', 'Produce', 20, 30, 100, 1.5, 25, 100.00, 3.5, '2024-10-19', '2024-10-21', 85.0),
            ('SCO002', 'Scotland', 'PROD002', 'Whole Chicken', 'Meat', 35, 40, 150, 4.0, 8, 72.00, 1.8, '2024-10-17', '2024-10-23', 94.0),
            ('SCO003', 'Scotland', 'PROD003', 'Sourdough Bread', 'Bakery', 60, 50, 200, 2.8, 18, 63.00, 2.5, '2024-10-20', '2024-10-21', 88.0),
            -- England - better inventory management
            ('ENG001', 'England', 'PROD001', 'Organic Milk 2L', 'Dairy', 120, 50, 200, 5.5, 3, 7.50, 0.8, '2024-10-19', '2024-10-23', 98.5),
            ('ENG001', 'England', 'PROD006', 'Fresh Strawberries', 'Produce', 80, 30, 100, 4.2, 5, 20.00, 1.2, '2024-10-20', '2024-10-22', 97.0),
            ('ENG002', 'England', 'PROD002', 'Whole Chicken', 'Meat', 95, 40, 150, 6.0, 2, 18.00, 0.6, '2024-10-18', '2024-10-24', 99.0),
            ('ENG003', 'England', 'PROD003', 'Sourdough Bread', 'Bakery', 110, 50, 200, 4.8, 4, 14.00, 0.9, '2024-10-20', '2024-10-21', 98.0)
        """)
        print("✅ INVENTORY created with 8 sample rows")
    except Exception as e:
        print(f"❌ Inventory table error: {e}")
    
    # =========================================================================
    # STORE OPERATIONS DATA
    # =========================================================================
    print("\n🏪 Creating STORE_OPERATIONS table...")
    try:
        snowflake_client.execute_query("""
            CREATE OR REPLACE TABLE SNOWFLOW_DEV.RETAIL_DEMO.STORE_OPERATIONS (
                store_id VARCHAR(10),
                region VARCHAR(50),
                store_name VARCHAR(100),
                operation_date DATE,
                footfall INT,
                conversion_rate DECIMAL(5,2),
                avg_basket_value DECIMAL(10,2),
                labour_hours DECIMAL(10,2),
                labour_cost DECIMAL(10,2),
                overtime_hours DECIMAL(10,2),
                overtime_cost DECIMAL(10,2),
                waste_cost DECIMAL(10,2),
                energy_cost DECIMAL(10,2)
            )
        """)
        
        snowflake_client.execute_query("""
            INSERT INTO SNOWFLOW_DEV.RETAIL_DEMO.STORE_OPERATIONS VALUES
            -- Scotland stores - showing high labour costs
            ('SCO001', 'Scotland', 'Edinburgh Central', '2024-10-20', 2500, 32.5, 28.50, 480, 5760.00, 45, 810.00, 450.00, 380.00),
            ('SCO002', 'Scotland', 'Glasgow West', '2024-10-20', 2200, 30.0, 25.80, 440, 5280.00, 52, 936.00, 520.00, 350.00),
            ('SCO003', 'Scotland', 'Aberdeen High St', '2024-10-20', 1800, 28.5, 24.20, 380, 4560.00, 38, 684.00, 380.00, 320.00),
            -- England stores - more efficient
            ('ENG001', 'England', 'London Oxford St', '2024-10-20', 4500, 38.5, 42.00, 600, 7200.00, 15, 270.00, 180.00, 520.00),
            ('ENG002', 'England', 'Manchester Arndale', '2024-10-20', 3200, 35.0, 35.50, 520, 6240.00, 12, 216.00, 150.00, 420.00),
            ('ENG003', 'England', 'Birmingham Bull Ring', '2024-10-20', 2800, 34.0, 33.20, 480, 5760.00, 10, 180.00, 140.00, 400.00),
            -- Wales
            ('WAL001', 'Wales', 'Cardiff Central', '2024-10-20', 2000, 33.0, 30.50, 400, 4800.00, 18, 324.00, 220.00, 340.00)
        """)
        print("✅ STORE_OPERATIONS created with 7 sample rows")
    except Exception as e:
        print(f"❌ Store operations table error: {e}")
    
    # =========================================================================
    # CUSTOMER/LOYALTY DATA
    # =========================================================================
    print("\n👥 Creating CUSTOMER_LOYALTY table...")
    try:
        snowflake_client.execute_query("""
            CREATE OR REPLACE TABLE SNOWFLOW_DEV.RETAIL_DEMO.CUSTOMER_LOYALTY (
                customer_id VARCHAR(20),
                region VARCHAR(50),
                loyalty_tier VARCHAR(20),
                member_since DATE,
                total_spend_ytd DECIMAL(10,2),
                visit_count_ytd INT,
                avg_basket_value DECIMAL(10,2),
                points_balance INT,
                clv_score DECIMAL(10,2),
                retention_risk VARCHAR(20),
                last_visit DATE
            )
        """)
        
        snowflake_client.execute_query("""
            INSERT INTO SNOWFLOW_DEV.RETAIL_DEMO.CUSTOMER_LOYALTY VALUES
            ('CUST001', 'Scotland', 'Gold', '2020-03-15', 2450.00, 52, 47.12, 24500, 890.00, 'Low', '2024-10-20'),
            ('CUST002', 'Scotland', 'Silver', '2021-06-20', 1200.00, 35, 34.29, 12000, 520.00, 'Medium', '2024-10-18'),
            ('CUST003', 'Scotland', 'Bronze', '2022-01-10', 680.00, 22, 30.91, 6800, 280.00, 'High', '2024-10-05'),
            ('CUST004', 'Scotland', 'Gold', '2019-08-01', 3200.00, 68, 47.06, 32000, 1100.00, 'Low', '2024-10-21'),
            ('CUST008', 'England', 'Platinum', '2018-02-14', 5800.00, 95, 61.05, 58000, 1850.00, 'Low', '2024-10-21'),
            ('CUST009', 'England', 'Gold', '2019-11-30', 3100.00, 72, 43.06, 31000, 980.00, 'Low', '2024-10-20'),
            ('CUST010', 'England', 'Silver', '2021-04-05', 1450.00, 42, 34.52, 14500, 580.00, 'Low', '2024-10-19'),
            ('CUST014', 'Wales', 'Gold', '2020-07-22', 2800.00, 58, 48.28, 28000, 920.00, 'Low', '2024-10-20')
        """)
        print("✅ CUSTOMER_LOYALTY created with 8 sample rows")
    except Exception as e:
        print(f"❌ Customer loyalty table error: {e}")
    
    # =========================================================================
    # PROMOTIONS DATA
    # =========================================================================
    print("\n🏷️ Creating PROMOTIONS table...")
    try:
        snowflake_client.execute_query("""
            CREATE OR REPLACE TABLE SNOWFLOW_DEV.RETAIL_DEMO.PROMOTIONS (
                promo_id VARCHAR(20),
                promo_name VARCHAR(100),
                region VARCHAR(50),
                start_date DATE,
                end_date DATE,
                discount_pct DECIMAL(5,2),
                promo_type VARCHAR(50),
                products_included VARCHAR(200),
                budget DECIMAL(10,2),
                actual_spend DECIMAL(10,2),
                redemptions INT,
                incremental_sales DECIMAL(10,2),
                roi DECIMAL(5,2)
            )
        """)
        
        snowflake_client.execute_query("""
            INSERT INTO SNOWFLOW_DEV.RETAIL_DEMO.PROMOTIONS VALUES
            ('PROMO001', 'Scotland Autumn Sale', 'Scotland', '2024-10-01', '2024-10-31', 25.00, 'Multi-buy', 'Dairy, Produce', 15000.00, 18500.00, 4200, 32000.00, 1.73),
            ('PROMO002', 'Fresh Fish Friday', 'Scotland', '2024-10-04', '2024-10-25', 20.00, 'Single Item', 'Fish', 5000.00, 6200.00, 890, 8500.00, 1.37),
            ('PROMO003', 'England Weekend Deals', 'England', '2024-10-01', '2024-10-31', 15.00, 'Multi-buy', 'Meat, Bakery', 20000.00, 19500.00, 5800, 48000.00, 2.46),
            ('PROMO004', 'Loyalty Double Points', 'All', '2024-10-15', '2024-10-21', 0.00, 'Points', 'All Categories', 8000.00, 7500.00, 12000, 28000.00, 3.73),
            ('PROMO005', 'Wales Local Produce', 'Wales', '2024-10-01', '2024-10-31', 10.00, 'Single Item', 'Welsh Products', 3000.00, 2800.00, 650, 6500.00, 2.32)
        """)
        print("✅ PROMOTIONS created with 5 sample rows")
    except Exception as e:
        print(f"❌ Promotions table error: {e}")
    
    # =========================================================================
    # SUMMARY VIEW
    # =========================================================================
    print("\n📈 Creating REGIONAL_MARGIN_SUMMARY view...")
    try:
        snowflake_client.execute_query("""
            CREATE OR REPLACE VIEW SNOWFLOW_DEV.RETAIL_DEMO.REGIONAL_MARGIN_SUMMARY AS
            SELECT 
                region,
                COUNT(DISTINCT transaction_id) as total_transactions,
                SUM(total_amount) as total_revenue,
                SUM(margin_amount) as total_margin,
                ROUND(AVG(margin_pct), 2) as avg_margin_pct,
                SUM(CASE WHEN is_promotion THEN total_amount ELSE 0 END) as promo_revenue,
                ROUND(SUM(CASE WHEN is_promotion THEN total_amount ELSE 0 END) / SUM(total_amount) * 100, 2) as promo_mix_pct
            FROM SNOWFLOW_DEV.RETAIL_DEMO.SALES_TRANSACTIONS
            GROUP BY region
        """)
        print("✅ REGIONAL_MARGIN_SUMMARY view created")
    except Exception as e:
        print(f"❌ View error: {e}")
    
    print("\n" + "="*60)
    print("🎉 RETAIL DEMO DATA SETUP COMPLETE!")
    print("="*60)
    print("\nTables created in SNOWFLOW_DEV.RETAIL_DEMO:")
    print("  • SALES_TRANSACTIONS (16 rows)")
    print("  • INVENTORY (8 rows)")
    print("  • STORE_OPERATIONS (7 rows)")
    print("  • CUSTOMER_LOYALTY (8 rows)")
    print("  • PROMOTIONS (5 rows)")
    print("  • REGIONAL_MARGIN_SUMMARY (view)")
    print("\n📊 Scotland shows LOWER margins due to:")
    print("  • Heavy promotions (25% discount)")
    print("  • Higher waste in produce/dairy")
    print("  • More overtime labour costs")
    print("\nThis is the scenario agents will analyze! 🎯")


if __name__ == "__main__":
    setup_retail_data()







