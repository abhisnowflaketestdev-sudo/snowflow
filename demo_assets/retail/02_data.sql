-- Retail domain - synthetic demo data (generated in Snowflake; no huge INSERT files)
-- Row counts are tuned for a "realistic" demo while staying lightweight for installs.

USE DATABASE SNOWFLOW_DEMO;
USE SCHEMA RETAIL;

-- Channels
TRUNCATE TABLE IF EXISTS DIM_CHANNEL;
INSERT INTO DIM_CHANNEL (CHANNEL_ID, CHANNEL_NAME, CHANNEL_TYPE)
SELECT * FROM VALUES
  (1, 'In Store', 'Store'),
  (2, 'Online', 'Ecommerce'),
  (3, 'Click & Collect', 'Omnichannel'),
  (4, 'Delivery', 'Omnichannel');

-- Stores (60)
TRUNCATE TABLE IF EXISTS DIM_STORE;
INSERT INTO DIM_STORE
SELECT
  seq4() + 1                                   AS STORE_ID,
  'Sainsbury''s ' ||
    CASE MOD(seq4(), 8)
      WHEN 0 THEN 'Camden'
      WHEN 1 THEN 'Glasgow'
      WHEN 2 THEN 'Manchester'
      WHEN 3 THEN 'Bristol'
      WHEN 4 THEN 'Leeds'
      WHEN 5 THEN 'Birmingham'
      WHEN 6 THEN 'Edinburgh'
      ELSE 'Liverpool'
    END || ' #' || (seq4() + 1)                AS STORE_NAME,
  CASE MOD(seq4(), 8)
      WHEN 0 THEN 'London'
      WHEN 1 THEN 'Glasgow'
      WHEN 2 THEN 'Manchester'
      WHEN 3 THEN 'Bristol'
      WHEN 4 THEN 'Leeds'
      WHEN 5 THEN 'Birmingham'
      WHEN 6 THEN 'Edinburgh'
      ELSE 'Liverpool'
  END                                          AS CITY,
  CASE
      WHEN MOD(seq4(), 8) IN (0) THEN 'London'
      WHEN MOD(seq4(), 8) IN (1,6) THEN 'Scotland'
      WHEN MOD(seq4(), 8) IN (2,7) THEN 'North West'
      WHEN MOD(seq4(), 8) IN (3) THEN 'South West'
      WHEN MOD(seq4(), 8) IN (4) THEN 'Yorkshire'
      ELSE 'West Midlands'
  END                                          AS REGION,
  'UK'                                         AS COUNTRY,
  CASE MOD(seq4(), 4)
      WHEN 0 THEN 'Superstore'
      WHEN 1 THEN 'Convenience'
      WHEN 2 THEN 'Local'
      ELSE 'Online Hub'
  END                                          AS STORE_FORMAT,
  500 + MOD(seq4(), 3500)                       AS FLOORSPACE_SQM,
  (MOD(seq4(), 5) = 0)                          AS HAS_FUEL_STATION,
  DATEADD(day, - (7000 + MOD(seq4(), 5000)), CURRENT_DATE()) AS OPENED_DATE
FROM TABLE(GENERATOR(ROWCOUNT => 60));

-- Products (800)
TRUNCATE TABLE IF EXISTS DIM_PRODUCT;
INSERT INTO DIM_PRODUCT
SELECT
  seq4() + 1 AS PRODUCT_ID,
  'SKU-' || LPAD((seq4() + 1)::STRING, 6, '0') || ' ' ||
    CASE MOD(seq4(), 10)
      WHEN 0 THEN 'Whole Milk'
      WHEN 1 THEN 'Greek Yogurt'
      WHEN 2 THEN 'Coffee Beans'
      WHEN 3 THEN 'Chicken Breast'
      WHEN 4 THEN 'Free Range Eggs'
      WHEN 5 THEN 'Pasta'
      WHEN 6 THEN 'Tomato Sauce'
      WHEN 7 THEN 'Bananas'
      WHEN 8 THEN 'Shampoo'
      ELSE 'Laundry Detergent'
    END                                          AS PRODUCT_NAME,
  CASE
    WHEN MOD(seq4(), 10) IN (0,1,4) THEN 'Fresh'
    WHEN MOD(seq4(), 10) IN (2,5,6) THEN 'Grocery'
    WHEN MOD(seq4(), 10) IN (3,7) THEN 'Chilled'
    ELSE 'Health & Beauty'
  END                                            AS DEPARTMENT,
  CASE
    WHEN MOD(seq4(), 10) IN (0,1,4) THEN 'Dairy'
    WHEN MOD(seq4(), 10) IN (2) THEN 'Beverages'
    WHEN MOD(seq4(), 10) IN (3) THEN 'Meat'
    WHEN MOD(seq4(), 10) IN (5,6) THEN 'Pantry'
    WHEN MOD(seq4(), 10) IN (7) THEN 'Produce'
    ELSE 'Home Care'
  END                                            AS CATEGORY,
  CASE MOD(seq4(), 6)
    WHEN 0 THEN 'Everyday Essentials'
    WHEN 1 THEN 'Taste the Difference'
    WHEN 2 THEN 'Free From'
    WHEN 3 THEN 'Plant Based'
    WHEN 4 THEN 'Family Favourites'
    ELSE 'Premium Selection'
  END                                            AS SUBCATEGORY,
  CASE MOD(seq4(), 6)
    WHEN 0 THEN 'Sainsbury''s'
    WHEN 1 THEN 'Taste the Difference'
    WHEN 2 THEN 'Heinz'
    WHEN 3 THEN 'Nestlé'
    WHEN 4 THEN 'Unilever'
    ELSE 'P&G'
  END                                            AS BRAND,
  (MOD(seq4(), 6) IN (0,1))                       AS IS_OWN_BRAND,
  ROUND(0.30 + (MOD(seq4(), 500) / 100.0), 2)     AS UNIT_COST,
  ROUND(0.60 + (MOD(seq4(), 900) / 100.0), 2)     AS LIST_PRICE,
  CASE MOD(seq4(), 5)
    WHEN 0 THEN '250g'
    WHEN 1 THEN '500g'
    WHEN 2 THEN '1kg'
    WHEN 3 THEN '2L'
    ELSE '12 pack'
  END                                            AS PACKAGE_SIZE,
  (MOD(seq4(), 10) IN (0,1,3,4,7))                 AS IS_PERISHABLE
FROM TABLE(GENERATOR(ROWCOUNT => 800));

-- Customers (20k)
TRUNCATE TABLE IF EXISTS DIM_CUSTOMER;
INSERT INTO DIM_CUSTOMER
SELECT
  seq4() + 1 AS CUSTOMER_ID,
  CASE MOD(seq4(), 3)
    WHEN 0 THEN 'Value'
    WHEN 1 THEN 'Mainstream'
    ELSE 'Premium'
  END                                        AS SEGMENT,
  CASE MOD(seq4(), 4)
    WHEN 0 THEN 'Bronze'
    WHEN 1 THEN 'Silver'
    WHEN 2 THEN 'Gold'
    ELSE 'Platinum'
  END                                        AS LOYALTY_TIER,
  CASE MOD(seq4(), 6)
    WHEN 0 THEN '18-24'
    WHEN 1 THEN '25-34'
    WHEN 2 THEN '35-44'
    WHEN 3 THEN '45-54'
    WHEN 4 THEN '55-64'
    ELSE '65+'
  END                                        AS AGE_BAND,
  1 + MOD(seq4(), 5)                           AS HOUSEHOLD_SIZE,
  CASE MOD(seq4(), 10)
    WHEN 0 THEN 'NW'
    WHEN 1 THEN 'SW'
    WHEN 2 THEN 'SE'
    WHEN 3 THEN 'E'
    WHEN 4 THEN 'W'
    WHEN 5 THEN 'G'
    WHEN 6 THEN 'M'
    WHEN 7 THEN 'L'
    WHEN 8 THEN 'B'
    ELSE 'LS'
  END                                        AS POSTCODE_AREA,
  DATEADD(day, - (30 + MOD(seq4(), 900)), CURRENT_DATE()) AS SIGNUP_DATE,
  (MOD(seq4(), 8) = 0)                         AS IS_ONLINE_ONLY
FROM TABLE(GENERATOR(ROWCOUNT => 20000));

-- Promotions (40)
TRUNCATE TABLE IF EXISTS DIM_PROMOTION;
INSERT INTO DIM_PROMOTION
SELECT
  seq4() + 1 AS PROMOTION_ID,
  CASE MOD(seq4(), 5)
    WHEN 0 THEN 'Price Cut'
    WHEN 1 THEN 'Multi-buy'
    WHEN 2 THEN 'Loyalty Offer'
    WHEN 3 THEN 'Seasonal Deal'
    ELSE 'Clearance'
  END || ' #' || (seq4() + 1)                   AS PROMOTION_NAME,
  CASE MOD(seq4(), 5)
    WHEN 0 THEN 'Price'
    WHEN 1 THEN 'Bundle'
    WHEN 2 THEN 'Loyalty'
    WHEN 3 THEN 'Seasonal'
    ELSE 'Clearance'
  END                                          AS PROMOTION_TYPE,
  ROUND(0.05 + (MOD(seq4(), 25) / 100.0), 4)    AS DISCOUNT_PCT, -- 5% to 29%
  DATEADD(day, - (MOD(seq4(), 180)), CURRENT_DATE()) AS START_DATE,
  DATEADD(day,  (7 + MOD(seq4(), 35)), CURRENT_DATE()) AS END_DATE
FROM TABLE(GENERATOR(ROWCOUNT => 40));

-- Sales lines (120k) over last ~180 days
TRUNCATE TABLE IF EXISTS FACT_SALES_LINE;
INSERT INTO FACT_SALES_LINE
WITH gen AS (
  SELECT
    seq4()                                    AS seq,
    (FLOOR(seq4() / 3) + 1)                    AS ORDER_ID,
    DATEADD(minute, - MOD(seq4(), 60*24*180), CURRENT_TIMESTAMP()) AS SALE_TS,
    TO_DATE(DATEADD(day, - MOD(seq4(), 180), CURRENT_DATE()))      AS SALE_DATE,
    (1 + MOD(seq4(), 60))                      AS STORE_ID,
    (1 + MOD(seq4(), 4))                       AS CHANNEL_ID,
    (1 + MOD(seq4(), 20000))                   AS CUSTOMER_ID,
    (1 + MOD(seq4(), 800))                     AS PRODUCT_ID,
    CASE WHEN MOD(seq4(), 5) = 0 THEN (1 + MOD(seq4(), 40)) END     AS PROMOTION_ID,
    (1 + MOD(seq4(), 4))                       AS QUANTITY
  FROM TABLE(GENERATOR(ROWCOUNT => 120000))
)
SELECT
  g.seq + 1                                    AS SALES_LINE_ID,
  g.ORDER_ID,
  g.SALE_TS,
  g.SALE_DATE,
  g.STORE_ID,
  g.CHANNEL_ID,
  g.CUSTOMER_ID,
  g.PRODUCT_ID,
  g.PROMOTION_ID,
  g.QUANTITY,
  ROUND(g.QUANTITY * p.LIST_PRICE, 2)          AS GROSS_REVENUE,
  ROUND((g.QUANTITY * p.LIST_PRICE) * COALESCE(pr.DISCOUNT_PCT, 0), 2) AS DISCOUNT_AMOUNT,
  ROUND((g.QUANTITY * p.LIST_PRICE) * (1 - COALESCE(pr.DISCOUNT_PCT, 0)), 2) AS NET_REVENUE,
  ROUND(g.QUANTITY * p.UNIT_COST, 2)           AS UNIT_COST_TOTAL,
  ROUND(((g.QUANTITY * p.LIST_PRICE) * (1 - COALESCE(pr.DISCOUNT_PCT, 0))) - (g.QUANTITY * p.UNIT_COST), 2) AS MARGIN_AMOUNT
FROM gen g
JOIN DIM_PRODUCT p ON p.PRODUCT_ID = g.PRODUCT_ID
LEFT JOIN DIM_PROMOTION pr ON pr.PROMOTION_ID = g.PROMOTION_ID;

-- Inventory snapshots (14 days × 60 stores × 150 products = 126k rows)
TRUNCATE TABLE IF EXISTS FACT_INVENTORY_DAILY;
INSERT INTO FACT_INVENTORY_DAILY
SELECT
  DATEADD(day, - MOD(seq4(), 14), CURRENT_DATE())        AS SNAPSHOT_DATE,
  1 + MOD(seq4(), 60)                                    AS STORE_ID,
  1 + MOD(seq4(), 150)                                   AS PRODUCT_ID,
  10 + MOD(seq4(), 240)                                  AS STOCK_ON_HAND,
  MOD(seq4(), 30)                                        AS STOCK_IN_TRANSIT,
  20 + MOD(seq4(), 30)                                   AS REORDER_POINT,
  1 + MOD(seq4(), 10)                                    AS LEAD_TIME_DAYS
FROM TABLE(GENERATOR(ROWCOUNT => 126000));
