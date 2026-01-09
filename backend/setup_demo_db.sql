-- ============================================================================
-- SNOWFLOW DEMO DATABASE SETUP
-- Run this in Snowflake to create sample data for testing
-- ============================================================================

-- Create dedicated database for SnowFlow
CREATE DATABASE IF NOT EXISTS SNOWFLOW_DEV;
USE DATABASE SNOWFLOW_DEV;
CREATE SCHEMA IF NOT EXISTS DEMO;
USE SCHEMA DEMO;

-- ============================================================================
-- SAMPLE DATA: Sales Analytics
-- ============================================================================

CREATE OR REPLACE TABLE SALES_DATA (
    sale_id INTEGER,
    sale_date DATE,
    product_name VARCHAR(100),
    category VARCHAR(50),
    region VARCHAR(50),
    quantity INTEGER,
    unit_price DECIMAL(10,2),
    total_amount DECIMAL(10,2),
    customer_segment VARCHAR(50)
);

INSERT INTO SALES_DATA VALUES
(1, '2024-01-15', 'Laptop Pro 15', 'Electronics', 'North America', 5, 1299.99, 6499.95, 'Enterprise'),
(2, '2024-01-16', 'Wireless Mouse', 'Accessories', 'Europe', 50, 29.99, 1499.50, 'SMB'),
(3, '2024-01-17', 'Cloud Storage 1TB', 'Services', 'Asia Pacific', 100, 9.99, 999.00, 'Consumer'),
(4, '2024-01-18', 'Monitor 27"', 'Electronics', 'North America', 10, 449.99, 4499.90, 'Enterprise'),
(5, '2024-01-19', 'Keyboard Mechanical', 'Accessories', 'Europe', 25, 149.99, 3749.75, 'SMB'),
(6, '2024-01-20', 'Laptop Pro 15', 'Electronics', 'Asia Pacific', 8, 1299.99, 10399.92, 'Enterprise'),
(7, '2024-01-21', 'Webcam HD', 'Accessories', 'North America', 30, 79.99, 2399.70, 'Consumer'),
(8, '2024-01-22', 'Cloud Storage 1TB', 'Services', 'Europe', 200, 9.99, 1998.00, 'Enterprise'),
(9, '2024-01-23', 'Laptop Budget 14', 'Electronics', 'North America', 15, 599.99, 8999.85, 'SMB'),
(10, '2024-01-24', 'Docking Station', 'Accessories', 'Asia Pacific', 12, 199.99, 2399.88, 'Enterprise'),
(11, '2024-02-01', 'Laptop Pro 15', 'Electronics', 'Europe', 7, 1299.99, 9099.93, 'Enterprise'),
(12, '2024-02-05', 'Monitor 27"', 'Electronics', 'North America', 20, 449.99, 8999.80, 'SMB'),
(13, '2024-02-10', 'Cloud Storage 1TB', 'Services', 'Asia Pacific', 500, 9.99, 4995.00, 'Consumer'),
(14, '2024-02-15', 'Wireless Mouse', 'Accessories', 'Europe', 100, 29.99, 2999.00, 'Enterprise'),
(15, '2024-02-20', 'Keyboard Mechanical', 'Accessories', 'North America', 40, 149.99, 5999.60, 'SMB');

-- ============================================================================
-- SAMPLE DATA: Customer Feedback
-- ============================================================================

CREATE OR REPLACE TABLE CUSTOMER_FEEDBACK (
    feedback_id INTEGER,
    customer_id INTEGER,
    product_name VARCHAR(100),
    rating INTEGER,
    feedback_text VARCHAR(1000),
    feedback_date DATE,
    sentiment VARCHAR(20)
);

INSERT INTO CUSTOMER_FEEDBACK VALUES
(1, 101, 'Laptop Pro 15', 5, 'Excellent performance, fast boot time, great display quality.', '2024-01-20', 'positive'),
(2, 102, 'Wireless Mouse', 3, 'Works okay but battery life could be better.', '2024-01-21', 'neutral'),
(3, 103, 'Cloud Storage 1TB', 5, 'Seamless integration, love the automatic sync feature!', '2024-01-22', 'positive'),
(4, 104, 'Monitor 27"', 4, 'Great picture quality, wish it had more USB ports.', '2024-01-23', 'positive'),
(5, 105, 'Keyboard Mechanical', 2, 'Too loud for office use, returning it.', '2024-01-24', 'negative'),
(6, 106, 'Laptop Pro 15', 5, 'Best laptop I have ever owned. Worth every penny.', '2024-01-25', 'positive'),
(7, 107, 'Webcam HD', 4, 'Good video quality for the price point.', '2024-01-26', 'positive'),
(8, 108, 'Docking Station', 1, 'Stopped working after 2 weeks. Very disappointed.', '2024-01-27', 'negative'),
(9, 109, 'Laptop Budget 14', 3, 'Decent for basic tasks, struggles with heavy workloads.', '2024-01-28', 'neutral'),
(10, 110, 'Cloud Storage 1TB', 5, 'Customer support was amazing when I had setup issues.', '2024-01-29', 'positive');

-- ============================================================================
-- SAMPLE DATA: Support Tickets
-- ============================================================================

CREATE OR REPLACE TABLE SUPPORT_TICKETS (
    ticket_id INTEGER,
    customer_id INTEGER,
    product_name VARCHAR(100),
    issue_category VARCHAR(50),
    priority VARCHAR(20),
    status VARCHAR(20),
    description VARCHAR(1000),
    created_date DATE,
    resolved_date DATE
);

INSERT INTO SUPPORT_TICKETS VALUES
(1, 101, 'Laptop Pro 15', 'Hardware', 'High', 'Resolved', 'Screen flickering issue under heavy load', '2024-01-15', '2024-01-17'),
(2, 102, 'Wireless Mouse', 'Connectivity', 'Medium', 'Resolved', 'Mouse disconnects randomly from Bluetooth', '2024-01-16', '2024-01-18'),
(3, 103, 'Cloud Storage 1TB', 'Sync', 'Low', 'Open', 'Files not syncing on mobile app', '2024-01-17', NULL),
(4, 104, 'Monitor 27"', 'Display', 'High', 'Resolved', 'Dead pixels in corner of screen', '2024-01-18', '2024-01-20'),
(5, 105, 'Keyboard Mechanical', 'Hardware', 'Medium', 'Open', 'Spacebar sometimes double registers', '2024-01-19', NULL),
(6, 106, 'Docking Station', 'Connectivity', 'Critical', 'Escalated', 'Complete device failure, no power', '2024-01-20', NULL),
(7, 107, 'Laptop Budget 14', 'Software', 'Low', 'Resolved', 'Need help with driver installation', '2024-01-21', '2024-01-22'),
(8, 108, 'Webcam HD', 'Quality', 'Medium', 'Open', 'Video appears grainy in low light', '2024-01-22', NULL);

-- ============================================================================
-- Verify setup
-- ============================================================================

SELECT 'SALES_DATA' as table_name, COUNT(*) as row_count FROM SALES_DATA
UNION ALL
SELECT 'CUSTOMER_FEEDBACK', COUNT(*) FROM CUSTOMER_FEEDBACK
UNION ALL
SELECT 'SUPPORT_TICKETS', COUNT(*) FROM SUPPORT_TICKETS;


-- SNOWFLOW DEMO DATABASE SETUP
-- Run this in Snowflake to create sample data for testing
-- ============================================================================

-- Create dedicated database for SnowFlow
CREATE DATABASE IF NOT EXISTS SNOWFLOW_DEV;
USE DATABASE SNOWFLOW_DEV;
CREATE SCHEMA IF NOT EXISTS DEMO;
USE SCHEMA DEMO;

-- ============================================================================
-- SAMPLE DATA: Sales Analytics
-- ============================================================================

CREATE OR REPLACE TABLE SALES_DATA (
    sale_id INTEGER,
    sale_date DATE,
    product_name VARCHAR(100),
    category VARCHAR(50),
    region VARCHAR(50),
    quantity INTEGER,
    unit_price DECIMAL(10,2),
    total_amount DECIMAL(10,2),
    customer_segment VARCHAR(50)
);

INSERT INTO SALES_DATA VALUES
(1, '2024-01-15', 'Laptop Pro 15', 'Electronics', 'North America', 5, 1299.99, 6499.95, 'Enterprise'),
(2, '2024-01-16', 'Wireless Mouse', 'Accessories', 'Europe', 50, 29.99, 1499.50, 'SMB'),
(3, '2024-01-17', 'Cloud Storage 1TB', 'Services', 'Asia Pacific', 100, 9.99, 999.00, 'Consumer'),
(4, '2024-01-18', 'Monitor 27"', 'Electronics', 'North America', 10, 449.99, 4499.90, 'Enterprise'),
(5, '2024-01-19', 'Keyboard Mechanical', 'Accessories', 'Europe', 25, 149.99, 3749.75, 'SMB'),
(6, '2024-01-20', 'Laptop Pro 15', 'Electronics', 'Asia Pacific', 8, 1299.99, 10399.92, 'Enterprise'),
(7, '2024-01-21', 'Webcam HD', 'Accessories', 'North America', 30, 79.99, 2399.70, 'Consumer'),
(8, '2024-01-22', 'Cloud Storage 1TB', 'Services', 'Europe', 200, 9.99, 1998.00, 'Enterprise'),
(9, '2024-01-23', 'Laptop Budget 14', 'Electronics', 'North America', 15, 599.99, 8999.85, 'SMB'),
(10, '2024-01-24', 'Docking Station', 'Accessories', 'Asia Pacific', 12, 199.99, 2399.88, 'Enterprise'),
(11, '2024-02-01', 'Laptop Pro 15', 'Electronics', 'Europe', 7, 1299.99, 9099.93, 'Enterprise'),
(12, '2024-02-05', 'Monitor 27"', 'Electronics', 'North America', 20, 449.99, 8999.80, 'SMB'),
(13, '2024-02-10', 'Cloud Storage 1TB', 'Services', 'Asia Pacific', 500, 9.99, 4995.00, 'Consumer'),
(14, '2024-02-15', 'Wireless Mouse', 'Accessories', 'Europe', 100, 29.99, 2999.00, 'Enterprise'),
(15, '2024-02-20', 'Keyboard Mechanical', 'Accessories', 'North America', 40, 149.99, 5999.60, 'SMB');

-- ============================================================================
-- SAMPLE DATA: Customer Feedback
-- ============================================================================

CREATE OR REPLACE TABLE CUSTOMER_FEEDBACK (
    feedback_id INTEGER,
    customer_id INTEGER,
    product_name VARCHAR(100),
    rating INTEGER,
    feedback_text VARCHAR(1000),
    feedback_date DATE,
    sentiment VARCHAR(20)
);

INSERT INTO CUSTOMER_FEEDBACK VALUES
(1, 101, 'Laptop Pro 15', 5, 'Excellent performance, fast boot time, great display quality.', '2024-01-20', 'positive'),
(2, 102, 'Wireless Mouse', 3, 'Works okay but battery life could be better.', '2024-01-21', 'neutral'),
(3, 103, 'Cloud Storage 1TB', 5, 'Seamless integration, love the automatic sync feature!', '2024-01-22', 'positive'),
(4, 104, 'Monitor 27"', 4, 'Great picture quality, wish it had more USB ports.', '2024-01-23', 'positive'),
(5, 105, 'Keyboard Mechanical', 2, 'Too loud for office use, returning it.', '2024-01-24', 'negative'),
(6, 106, 'Laptop Pro 15', 5, 'Best laptop I have ever owned. Worth every penny.', '2024-01-25', 'positive'),
(7, 107, 'Webcam HD', 4, 'Good video quality for the price point.', '2024-01-26', 'positive'),
(8, 108, 'Docking Station', 1, 'Stopped working after 2 weeks. Very disappointed.', '2024-01-27', 'negative'),
(9, 109, 'Laptop Budget 14', 3, 'Decent for basic tasks, struggles with heavy workloads.', '2024-01-28', 'neutral'),
(10, 110, 'Cloud Storage 1TB', 5, 'Customer support was amazing when I had setup issues.', '2024-01-29', 'positive');

-- ============================================================================
-- SAMPLE DATA: Support Tickets
-- ============================================================================

CREATE OR REPLACE TABLE SUPPORT_TICKETS (
    ticket_id INTEGER,
    customer_id INTEGER,
    product_name VARCHAR(100),
    issue_category VARCHAR(50),
    priority VARCHAR(20),
    status VARCHAR(20),
    description VARCHAR(1000),
    created_date DATE,
    resolved_date DATE
);

INSERT INTO SUPPORT_TICKETS VALUES
(1, 101, 'Laptop Pro 15', 'Hardware', 'High', 'Resolved', 'Screen flickering issue under heavy load', '2024-01-15', '2024-01-17'),
(2, 102, 'Wireless Mouse', 'Connectivity', 'Medium', 'Resolved', 'Mouse disconnects randomly from Bluetooth', '2024-01-16', '2024-01-18'),
(3, 103, 'Cloud Storage 1TB', 'Sync', 'Low', 'Open', 'Files not syncing on mobile app', '2024-01-17', NULL),
(4, 104, 'Monitor 27"', 'Display', 'High', 'Resolved', 'Dead pixels in corner of screen', '2024-01-18', '2024-01-20'),
(5, 105, 'Keyboard Mechanical', 'Hardware', 'Medium', 'Open', 'Spacebar sometimes double registers', '2024-01-19', NULL),
(6, 106, 'Docking Station', 'Connectivity', 'Critical', 'Escalated', 'Complete device failure, no power', '2024-01-20', NULL),
(7, 107, 'Laptop Budget 14', 'Software', 'Low', 'Resolved', 'Need help with driver installation', '2024-01-21', '2024-01-22'),
(8, 108, 'Webcam HD', 'Quality', 'Medium', 'Open', 'Video appears grainy in low light', '2024-01-22', NULL);

-- ============================================================================
-- Verify setup
-- ============================================================================

SELECT 'SALES_DATA' as table_name, COUNT(*) as row_count FROM SALES_DATA
UNION ALL
SELECT 'CUSTOMER_FEEDBACK', COUNT(*) FROM CUSTOMER_FEEDBACK
UNION ALL
SELECT 'SUPPORT_TICKETS', COUNT(*) FROM SUPPORT_TICKETS;












