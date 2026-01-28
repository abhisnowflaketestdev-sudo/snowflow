-- SnowFlow Demo Assets - Setup
-- Creates a single demo database with 2 schemas (Retail + Advertising/Media)
-- and a semantic-model stage in each schema for YAML uploads.

CREATE DATABASE IF NOT EXISTS SNOWFLOW_DEMO;

CREATE SCHEMA IF NOT EXISTS SNOWFLOW_DEMO.RETAIL;
CREATE SCHEMA IF NOT EXISTS SNOWFLOW_DEMO.AD_MEDIA;

-- Stages to store Cortex Analyst semantic model YAMLs
CREATE STAGE IF NOT EXISTS SNOWFLOW_DEMO.RETAIL.SEMANTIC_MODELS;
CREATE STAGE IF NOT EXISTS SNOWFLOW_DEMO.AD_MEDIA.SEMANTIC_MODELS;

-- Optional: a small warehouse suggestion (skip if you already have one)
-- CREATE WAREHOUSE IF NOT EXISTS SNOWFLOW_WH WAREHOUSE_SIZE='XSMALL' AUTO_SUSPEND=60 AUTO_RESUME=TRUE;
