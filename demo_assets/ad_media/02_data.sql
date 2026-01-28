-- Advertising / Media domain - synthetic demo data (WPP-style agency view)
-- Generated inside Snowflake for scale without huge insert files.

USE DATABASE SNOWFLOW_DEMO;
USE SCHEMA AD_MEDIA;

-- Channels (8)
TRUNCATE TABLE IF EXISTS DIM_CHANNEL;
INSERT INTO DIM_CHANNEL (CHANNEL_ID, CHANNEL_NAME, CHANNEL_TYPE)
SELECT * FROM VALUES
  (1, 'Google Search', 'Search'),
  (2, 'Meta Ads', 'Social'),
  (3, 'YouTube', 'Video'),
  (4, 'TikTok', 'Video'),
  (5, 'DV360', 'Programmatic'),
  (6, 'LinkedIn', 'Social'),
  (7, 'Amazon Retail Media', 'Retail Media'),
  (8, 'CTV', 'Video');

-- Advertisers / clients (25)
TRUNCATE TABLE IF EXISTS DIM_ADVERTISER;
INSERT INTO DIM_ADVERTISER
SELECT
  seq4() + 1 AS ADVERTISER_ID,
  'WPP Demo - Client ' || LPAD((seq4() + 1)::STRING, 2, '0') AS ADVERTISER_NAME,
  CASE MOD(seq4(), 6)
    WHEN 0 THEN 'Telecom'
    WHEN 1 THEN 'Financial Services'
    WHEN 2 THEN 'CPG'
    WHEN 3 THEN 'Retail'
    WHEN 4 THEN 'Travel'
    ELSE 'Automotive'
  END AS INDUSTRY,
  CASE MOD(seq4(), 4)
    WHEN 0 THEN 'UK'
    WHEN 1 THEN 'EU'
    WHEN 2 THEN 'US'
    ELSE 'APAC'
  END AS HQ_REGION,
  CASE MOD(seq4(), 3)
    WHEN 0 THEN 'Enterprise'
    WHEN 1 THEN 'Mid-Market'
    ELSE 'SMB'
  END AS ACCOUNT_TIER
FROM TABLE(GENERATOR(ROWCOUNT => 25));

-- Creatives (300)
TRUNCATE TABLE IF EXISTS DIM_CREATIVE;
INSERT INTO DIM_CREATIVE
SELECT
  seq4() + 1 AS CREATIVE_ID,
  'Creative ' || LPAD((seq4() + 1)::STRING, 4, '0') AS CREATIVE_NAME,
  CASE MOD(seq4(), 6)
    WHEN 0 THEN 'Static'
    WHEN 1 THEN 'Carousel'
    WHEN 2 THEN 'Short Video'
    WHEN 3 THEN 'Long Video'
    WHEN 4 THEN 'Responsive'
    ELSE 'CTV Spot'
  END AS FORMAT,
  CASE MOD(seq4(), 5)
    WHEN 0 THEN 'Price'
    WHEN 1 THEN 'Brand'
    WHEN 2 THEN 'Feature'
    WHEN 3 THEN 'Social Proof'
    ELSE 'Seasonal'
  END AS MESSAGE_ANGLE
FROM TABLE(GENERATOR(ROWCOUNT => 300));

-- Geos (12 UK-like regions)
TRUNCATE TABLE IF EXISTS DIM_GEO;
INSERT INTO DIM_GEO
SELECT * FROM VALUES
  (1, 'London', 'UK'),
  (2, 'South East', 'UK'),
  (3, 'South West', 'UK'),
  (4, 'North West', 'UK'),
  (5, 'Yorkshire', 'UK'),
  (6, 'East Midlands', 'UK'),
  (7, 'West Midlands', 'UK'),
  (8, 'East of England', 'UK'),
  (9, 'Scotland', 'UK'),
  (10, 'Wales', 'UK'),
  (11, 'Northern Ireland', 'UK'),
  (12, 'National', 'UK');

-- Audiences (20)
TRUNCATE TABLE IF EXISTS DIM_AUDIENCE;
INSERT INTO DIM_AUDIENCE
SELECT
  seq4() + 1 AS AUDIENCE_ID,
  CASE MOD(seq4(), 10)
    WHEN 0 THEN 'Prospecting - Broad'
    WHEN 1 THEN 'Prospecting - Lookalike'
    WHEN 2 THEN 'In-Market'
    WHEN 3 THEN 'Interest - Tech'
    WHEN 4 THEN 'Interest - Finance'
    WHEN 5 THEN 'Interest - Travel'
    WHEN 6 THEN 'Remarketing - Site Visitors'
    WHEN 7 THEN 'Remarketing - Cart Abandon'
    WHEN 8 THEN 'CRM - Existing Customers'
    ELSE 'CRM - High Value'
  END AS AUDIENCE_SEGMENT,
  CASE
    WHEN MOD(seq4(), 10) IN (6,7) THEN 'Remarketing'
    WHEN MOD(seq4(), 10) IN (8,9) THEN 'CRM'
    ELSE 'Prospecting'
  END AS AUDIENCE_TYPE
FROM TABLE(GENERATOR(ROWCOUNT => 20));

-- Campaigns (120) mapped to advertisers
TRUNCATE TABLE IF EXISTS DIM_CAMPAIGN;
INSERT INTO DIM_CAMPAIGN
SELECT
  seq4() + 1 AS CAMPAIGN_ID,
  1 + MOD(seq4(), 25) AS ADVERTISER_ID,
  'Campaign ' || LPAD((seq4() + 1)::STRING, 3, '0') || ' - ' ||
    CASE MOD(seq4(), 5)
      WHEN 0 THEN 'Brand Lift'
      WHEN 1 THEN 'Acquisition'
      WHEN 2 THEN 'Conversion'
      WHEN 3 THEN 'Retention'
      ELSE 'Seasonal'
    END AS CAMPAIGN_NAME,
  CASE MOD(seq4(), 4)
    WHEN 0 THEN 'Awareness'
    WHEN 1 THEN 'Consideration'
    WHEN 2 THEN 'Acquisition'
    ELSE 'Conversion'
  END AS OBJECTIVE,
  DATEADD(day, - (30 + MOD(seq4(), 180)), CURRENT_DATE()) AS START_DATE,
  DATEADD(day,   (14 + MOD(seq4(), 120)), CURRENT_DATE()) AS END_DATE,
  ROUND(20000 + (MOD(seq4(), 500) * 250), 2) AS BUDGET_GBP
FROM TABLE(GENERATOR(ROWCOUNT => 120));

-- Daily performance facts (120k rows over last ~90 days)
TRUNCATE TABLE IF EXISTS FACT_AD_PERFORMANCE;
INSERT INTO FACT_AD_PERFORMANCE
WITH gen AS (
  SELECT
    seq4() AS seq,
    DATEADD(day, - MOD(seq4(), 90), CURRENT_DATE()) AS EVENT_DATE,
    1 + MOD(seq4(), 25) AS ADVERTISER_ID,
    1 + MOD(seq4(), 120) AS CAMPAIGN_ID,
    1 + MOD(seq4(), 8) AS CHANNEL_ID,
    1 + MOD(seq4(), 300) AS CREATIVE_ID,
    1 + MOD(seq4(), 12) AS GEO_ID,
    1 + MOD(seq4(), 20) AS AUDIENCE_ID
  FROM TABLE(GENERATOR(ROWCOUNT => 120000))
),
base AS (
  SELECT
    g.*,
    -- base volumes
    (1000 + MOD(g.seq * 97, 250000))::NUMBER AS IMPRESSIONS,
    -- CTR varies by channel type (very roughly)
    CASE
      WHEN g.CHANNEL_ID IN (1) THEN 0.020
      WHEN g.CHANNEL_ID IN (2,6) THEN 0.012
      WHEN g.CHANNEL_ID IN (3,4,8) THEN 0.006
      WHEN g.CHANNEL_ID IN (5) THEN 0.004
      ELSE 0.010
    END AS BASE_CTR,
    -- CVR varies a bit by objective-ish (proxy using campaign id)
    (0.020 + (MOD(g.CAMPAIGN_ID, 6) / 100.0)) AS BASE_CVR,
    -- CPM varies by channel
    CASE
      WHEN g.CHANNEL_ID IN (1) THEN 8.0
      WHEN g.CHANNEL_ID IN (2,6) THEN 6.0
      WHEN g.CHANNEL_ID IN (3,4,8) THEN 10.0
      WHEN g.CHANNEL_ID IN (5) THEN 5.0
      ELSE 7.0
    END AS CPM_GBP,
    -- avg conversion value varies by advertiser (light proxy)
    (20 + MOD(g.ADVERTISER_ID * 11, 80))::NUMBER AS AVG_CONV_VALUE
  FROM gen g
)
SELECT
  EVENT_DATE,
  ADVERTISER_ID,
  CAMPAIGN_ID,
  CHANNEL_ID,
  CREATIVE_ID,
  GEO_ID,
  AUDIENCE_ID,
  IMPRESSIONS,
  FLOOR(IMPRESSIONS * BASE_CTR) AS CLICKS,
  FLOOR(FLOOR(IMPRESSIONS * BASE_CTR) * BASE_CVR) AS CONVERSIONS,
  CASE WHEN CHANNEL_ID IN (3,4,8) THEN FLOOR(IMPRESSIONS * (0.20 + MOD(seq, 40)/100.0)) ELSE 0 END AS VIDEO_VIEWS,
  ROUND((IMPRESSIONS / 1000) * CPM_GBP, 2) AS SPEND_GBP,
  ROUND(FLOOR(FLOOR(IMPRESSIONS * BASE_CTR) * BASE_CVR) * AVG_CONV_VALUE, 2) AS REVENUE_GBP
FROM base;
