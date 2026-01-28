# SnowFlow Demo Assets (Retail + Advertising/Media)

This folder contains **optional demo data** you can install into **any Snowflake account** to make SnowFlow a repeatable showcase:

- **Retail** (Sainsbury’s-style): stores/products/customers/promotions + sales lines + inventory snapshots
- **Advertising / Media** (WPP-style): clients/campaigns/channels/creatives/audiences + daily performance (spend, revenue, ROAS)

These assets are designed for:
- **Catalog → Sources**: tables/views you can browse and drag onto the canvas
- **Catalog → Semantics**: semantic model YAMLs you can drag onto the canvas
- **Section 7 workflow tests**: repeatable end-to-end “NL→SQL” flows

---

## 1) Install the demo database + schemas

### Option A: Programmatic install (recommended)

If your SnowFlow backend is connected to Snowflake, you can install everything with one API call:

- `POST /demo-assets/install` (default: `SNOWFLOW_DEMO`, uploads YAMLs)

Important: if your Snowflake role **cannot create databases**, the installer will automatically fall back to an existing writable database (typically the backend’s `SNOWFLAKE_DATABASE`) and install into:
- `SNOWFLOW_RETAIL` schema
- `SNOWFLOW_AD_MEDIA` schema

The API response will tell you the **actual** database + schemas used.

Example:

```bash
curl -X POST http://localhost:8000/demo-assets/install \
  -H "Content-Type: application/json" \
  -d '{"demo_database":"SNOWFLOW_DEMO","overwrite_tables":false,"upload_yaml":true}'
```

Check status:

```bash
curl http://localhost:8000/demo-assets/status?demo_database=SNOWFLOW_DEMO
```

### Option B: Manual SQL (Snowsight / SnowSQL)

Run:

```sql
-- Creates: SNOWFLOW_DEMO.RETAIL and SNOWFLOW_DEMO.AD_MEDIA
-- And stages: SEMANTIC_MODELS in each schema
!source demo_assets/snowflake/00_setup.sql
```

Then run the domain scripts:

```sql
!source demo_assets/retail/01_ddl.sql
!source demo_assets/retail/02_data.sql
!source demo_assets/retail/03_views.sql

!source demo_assets/ad_media/01_ddl.sql
!source demo_assets/ad_media/02_data.sql
!source demo_assets/ad_media/03_views.sql
```

> If you’re using Snowsight, just paste the SQL files in order.

---

## 2) Upload semantic model YAML files to Snowflake stages

Create stages are included in `00_setup.sql`:
- `@SNOWFLOW_DEMO.RETAIL.SEMANTIC_MODELS`
- `@SNOWFLOW_DEMO.AD_MEDIA.SEMANTIC_MODELS`

Upload:
- `demo_assets/retail/semantic_model_retail.yaml`
- `demo_assets/retail/semantic_model_retail_ops.yaml`
- `demo_assets/ad_media/semantic_model_ad_media.yaml`
- `demo_assets/ad_media/semantic_model_ad_media_kpis.yaml`

### Option A (Snowsight UI)
Data → Databases → `SNOWFLOW_DEMO` → Schema → **Stages** → `SEMANTIC_MODELS` → Upload file.

### Option B (SnowSQL)
```sql
PUT file://demo_assets/retail/semantic_model_retail.yaml @SNOWFLOW_DEMO.RETAIL.SEMANTIC_MODELS AUTO_COMPRESS=FALSE OVERWRITE=TRUE;
PUT file://demo_assets/retail/semantic_model_retail_ops.yaml @SNOWFLOW_DEMO.RETAIL.SEMANTIC_MODELS AUTO_COMPRESS=FALSE OVERWRITE=TRUE;
PUT file://demo_assets/ad_media/semantic_model_ad_media.yaml @SNOWFLOW_DEMO.AD_MEDIA.SEMANTIC_MODELS AUTO_COMPRESS=FALSE OVERWRITE=TRUE;
PUT file://demo_assets/ad_media/semantic_model_ad_media_kpis.yaml @SNOWFLOW_DEMO.AD_MEDIA.SEMANTIC_MODELS AUTO_COMPRESS=FALSE OVERWRITE=TRUE;
```

---

## 3) Using the assets in SnowFlow

- **Catalog → Sources**:
  - Retail: pick view `<DB>.<RETAIL_SCHEMA>.VW_RETAIL_SALES`
  - Retail ops: pick view `<DB>.<RETAIL_SCHEMA>.VW_RETAIL_INVENTORY_RISK`
  - Ad/Media: pick view `<DB>.<AD_SCHEMA>.VW_AD_PERFORMANCE`
  - Ad/Media KPIs: pick view `<DB>.<AD_SCHEMA>.VW_AD_DAILY_KPIS`
- **Catalog → Semantics**:
  - Retail YAMLs: `semantic_model_retail.yaml`, `semantic_model_retail_ops.yaml`
  - Ad/Media YAMLs: `semantic_model_ad_media.yaml`, `semantic_model_ad_media_kpis.yaml`

Recommended flow for NL→SQL accuracy:
**Snowflake Source → Semantic Model → Cortex Agent → Output**

---

## Notes (App-ification friendly)

These assets are **optional**: the product should work against *any* Snowflake instance.
They exist so demos/tests have consistent data + semantic context.

