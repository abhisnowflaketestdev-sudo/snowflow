import os
from typing import Dict, List, Tuple, Optional

from snowflake_client import snowflake_client


def _repo_root() -> str:
    return os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


def _demo_assets_root() -> str:
    return os.path.join(_repo_root(), "demo_assets")


def _read_text(path: str) -> str:
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def _split_sql_statements(sql: str) -> List[str]:
    """
    Very small SQL splitter for our demo scripts.
    - Removes full-line comments starting with --
    - Splits on ';' outside of single quotes
    """
    lines = []
    for line in sql.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith("--"):
            continue
        lines.append(line)

    cleaned = "\n".join(lines)
    stmts: List[str] = []
    buf: List[str] = []
    in_single = False
    i = 0
    while i < len(cleaned):
        ch = cleaned[i]
        if ch == "'":
            # handle escaped single quote inside string: ''
            if in_single and i + 1 < len(cleaned) and cleaned[i + 1] == "'":
                buf.append("''")
                i += 2
                continue
            in_single = not in_single
            buf.append(ch)
            i += 1
            continue
        if ch == ";" and not in_single:
            stmt = "".join(buf).strip()
            if stmt:
                stmts.append(stmt)
            buf = []
            i += 1
            continue
        buf.append(ch)
        i += 1

    tail = "".join(buf).strip()
    if tail:
        stmts.append(tail)
    return stmts


def _is_system_database(name: str) -> bool:
    n = (name or "").upper()
    if not n:
        return True
    if n.startswith("SNOWFLAKE"):
        return True
    if n in ("UTIL_DB",):
        return True
    return False


def _list_databases() -> List[str]:
    try:
        res = snowflake_client.execute_sql("SHOW DATABASES")
        if not res.get("success") or not res.get("data"):
            return []
        out: List[str] = []
        for row in res.get("data", []):
            name = row.get("NAME") or row.get("name")
            if name:
                out.append(str(name))
        return out
    except Exception:
        return []


def _database_exists(database: str) -> bool:
    if not database:
        return False
    safe = database.replace("'", "''")
    try:
        res = snowflake_client.execute_sql(f"SHOW DATABASES LIKE '{safe}'")
        return bool(res.get("success") and res.get("data"))
    except Exception:
        return False


def _resolve_install_target(
    requested_demo_database: str,
    warnings: List[str],
    fallback_database: Optional[str] = None,
) -> Dict[str, str]:
    """
    Decide where to install the demo assets.

    - Prefer creating/using `requested_demo_database` with schemas RETAIL + AD_MEDIA
    - If CREATE DATABASE isn't permitted and the DB doesn't exist, fall back to an existing DB
      (prefer env SNOWFLAKE_DATABASE, else the first non-system DB we can see)
      and install into schemas SNOWFLOW_RETAIL + SNOWFLOW_AD_MEDIA to avoid collisions.
    """
    requested = (requested_demo_database or "SNOWFLOW_DEMO").strip()
    if not requested:
        requested = "SNOWFLOW_DEMO"

    # Try to create the requested DB (best UX: dedicated DB).
    try:
        create = snowflake_client.execute_sql(f"CREATE DATABASE IF NOT EXISTS {requested}")
        if create.get("success"):
            return {"database": requested, "retail_schema": "RETAIL", "ad_schema": "AD_MEDIA"}
        # If we can't create but it already exists, we can still use it.
        if _database_exists(requested):
            warnings.append(f"Could not CREATE DATABASE {requested} (insufficient privileges). Using existing database.")
            return {"database": requested, "retail_schema": "RETAIL", "ad_schema": "AD_MEDIA"}
    except Exception as e:
        if _database_exists(requested):
            warnings.append(f"Could not CREATE DATABASE {requested}: {str(e)[:120]}. Using existing database.")
            return {"database": requested, "retail_schema": "RETAIL", "ad_schema": "AD_MEDIA"}

    # Fall back to an existing database (must already exist).
    env_db = os.getenv("SNOWFLAKE_DATABASE")
    candidates: List[str] = []
    for c in (fallback_database, env_db):
        if c and c not in candidates:
            candidates.append(c)

    for db in _list_databases():
        if db not in candidates:
            candidates.append(db)

    for db in candidates:
        if not db or _is_system_database(db):
            continue
        # Smoke-test: can we create a schema? (IF NOT EXISTS keeps it safe.)
        test_schema = "SNOWFLOW_RETAIL"
        try:
            r = snowflake_client.execute_sql(f"CREATE SCHEMA IF NOT EXISTS {db}.{test_schema}")
            if r.get("success"):
                warnings.append(
                    f"Installed demo assets into existing database {db} "
                    f"(could not create {requested}). Schemas used: SNOWFLOW_RETAIL + SNOWFLOW_AD_MEDIA."
                )
                return {"database": db, "retail_schema": "SNOWFLOW_RETAIL", "ad_schema": "SNOWFLOW_AD_MEDIA"}
        except Exception:
            continue

    # If we reach here, we couldn't find any writable DB.
    return {"database": requested, "retail_schema": "RETAIL", "ad_schema": "AD_MEDIA"}


def _rewrite_sql_targets(sql: str, database: str, retail_schema: str, ad_schema: str) -> str:
    out = sql
    if database and database != "SNOWFLOW_DEMO":
        out = out.replace("SNOWFLOW_DEMO", database)
    # Only rewrite schema names if we are using non-default schemas.
    if retail_schema and retail_schema != "RETAIL":
        out = out.replace("USE SCHEMA RETAIL;", f"USE SCHEMA {retail_schema};")
    if ad_schema and ad_schema != "AD_MEDIA":
        out = out.replace("USE SCHEMA AD_MEDIA;", f"USE SCHEMA {ad_schema};")
    return out


def install_demo_assets(
    demo_database: str = "SNOWFLOW_DEMO",
    overwrite_tables: bool = False,
    upload_yaml: bool = True,
    fallback_database: Optional[str] = None,
) -> Dict:
    """
    Install demo assets into the connected Snowflake account using the backend's Snowflake credentials.

    Creates:
    - {demo_database}.RETAIL + tables + view
    - {demo_database}.AD_MEDIA + tables + view
    - stages: {demo_database}.RETAIL.SEMANTIC_MODELS + {demo_database}.AD_MEDIA.SEMANTIC_MODELS
    Uploads:
    - semantic_model_retail.yaml
    - semantic_model_ad_media.yaml
    """
    if not hasattr(snowflake_client, "is_snowflake_available") or not snowflake_client.is_snowflake_available():
        return {"success": False, "error": "Snowflake not reachable. Connect VPN / allowlist IP / verify credentials."}

    base = _demo_assets_root()

    sql_files: List[Tuple[str, str]] = [
        ("retail_ddl", os.path.join(base, "retail", "01_ddl.sql")),
        ("retail_data", os.path.join(base, "retail", "02_data.sql")),
        ("retail_views", os.path.join(base, "retail", "03_views.sql")),
        ("ad_media_ddl", os.path.join(base, "ad_media", "01_ddl.sql")),
        ("ad_media_data", os.path.join(base, "ad_media", "02_data.sql")),
        ("ad_media_views", os.path.join(base, "ad_media", "03_views.sql")),
    ]

    executed: List[str] = []
    warnings: List[str] = []
    errors: List[str] = []

    target = _resolve_install_target(demo_database, warnings=warnings, fallback_database=fallback_database)
    target_db = target["database"]
    retail_schema = target["retail_schema"]
    ad_schema = target["ad_schema"]

    # Ensure schemas/stages exist before running domain scripts.
    for stmt in (
        f"CREATE SCHEMA IF NOT EXISTS {target_db}.{retail_schema}",
        f"CREATE SCHEMA IF NOT EXISTS {target_db}.{ad_schema}",
        f"CREATE STAGE IF NOT EXISTS {target_db}.{retail_schema}.SEMANTIC_MODELS",
        f"CREATE STAGE IF NOT EXISTS {target_db}.{ad_schema}.SEMANTIC_MODELS",
    ):
        try:
            res = snowflake_client.execute_sql(stmt)
            if not res.get("success", False):
                msg = f"setup: {res.get('error', 'unknown error')}"
                warnings.append(msg)
                errors.append(msg)
        except Exception as e:
            msg = f"setup: {str(e)[:200]}"
            warnings.append(msg)
            errors.append(msg)

    for key, path in sql_files:
        if not os.path.exists(path):
            return {"success": False, "error": f"Missing demo SQL file: {path}"}

        content = _rewrite_sql_targets(_read_text(path), target_db, retail_schema, ad_schema)

        # If user wants true overwrite semantics, convert CREATE OR REPLACE TABLE to CREATE OR REPLACE TABLE (already),
        # but for data scripts, we prefer idempotence: clear tables first.
        if overwrite_tables and key in ("retail_data", "ad_media_data"):
            # Ensure we are using the correct DB/schema first (scripts already do).
            if key == "retail_data":
                content = (
                    f"USE DATABASE {target_db};\nUSE SCHEMA {retail_schema};\n"
                    f"TRUNCATE TABLE IF EXISTS DIM_CHANNEL;\n"
                    f"TRUNCATE TABLE IF EXISTS DIM_STORE;\n"
                    f"TRUNCATE TABLE IF EXISTS DIM_PRODUCT;\n"
                    f"TRUNCATE TABLE IF EXISTS DIM_CUSTOMER;\n"
                    f"TRUNCATE TABLE IF EXISTS DIM_PROMOTION;\n"
                    f"TRUNCATE TABLE IF EXISTS FACT_SALES_LINE;\n"
                    f"TRUNCATE TABLE IF EXISTS FACT_INVENTORY_DAILY;\n\n"
                    f"{content}"
                )
            if key == "ad_media_data":
                content = (
                    f"USE DATABASE {target_db};\nUSE SCHEMA {ad_schema};\n"
                    f"TRUNCATE TABLE IF EXISTS DIM_CHANNEL;\n"
                    f"TRUNCATE TABLE IF EXISTS DIM_ADVERTISER;\n"
                    f"TRUNCATE TABLE IF EXISTS DIM_CAMPAIGN;\n"
                    f"TRUNCATE TABLE IF EXISTS DIM_CREATIVE;\n"
                    f"TRUNCATE TABLE IF EXISTS DIM_GEO;\n"
                    f"TRUNCATE TABLE IF EXISTS DIM_AUDIENCE;\n"
                    f"TRUNCATE TABLE IF EXISTS FACT_AD_PERFORMANCE;\n\n"
                    f"{content}"
                )

        statements = _split_sql_statements(content)
        for stmt in statements:
            try:
                res = snowflake_client.execute_sql(stmt)
                if not res.get("success", False):
                    msg = f"{key}: {res.get('error', 'unknown error')}"
                    warnings.append(msg)
                    errors.append(msg)
                else:
                    executed.append(f"{key}:ok")
            except Exception as e:
                msg = f"{key}: {str(e)[:200]}"
                warnings.append(msg)
                errors.append(msg)

    uploaded: List[Dict] = []
    if upload_yaml:
        # Upload YAML semantic models to stages so the app can discover them via LIST @stage.
        yaml_paths = [
            (retail_schema, "SEMANTIC_MODELS", "semantic_model_retail.yaml", os.path.join(base, "retail", "semantic_model_retail.yaml")),
            (retail_schema, "SEMANTIC_MODELS", "semantic_model_retail_ops.yaml", os.path.join(base, "retail", "semantic_model_retail_ops.yaml")),
            (ad_schema, "SEMANTIC_MODELS", "semantic_model_ad_media.yaml", os.path.join(base, "ad_media", "semantic_model_ad_media.yaml")),
            (ad_schema, "SEMANTIC_MODELS", "semantic_model_ad_media_kpis.yaml", os.path.join(base, "ad_media", "semantic_model_ad_media_kpis.yaml")),
        ]
        for schema, stage, filename, ypath in yaml_paths:
            if not os.path.exists(ypath):
                warnings.append(f"Missing YAML file: {ypath}")
                continue
            y = _read_text(ypath)
            if target_db and target_db != "SNOWFLOW_DEMO":
                y = y.replace("database: SNOWFLOW_DEMO", f"database: {target_db}")
            if retail_schema and retail_schema != "RETAIL":
                y = y.replace("schema: RETAIL", f"schema: {retail_schema}")
            if ad_schema and ad_schema != "AD_MEDIA":
                y = y.replace("schema: AD_MEDIA", f"schema: {ad_schema}")
            up = snowflake_client.write_to_stage(
                content=y,
                database=target_db,
                schema=schema,
                stage=stage,
                filename=filename,
                overwrite=True,
            )
            uploaded.append(up)
            if not up.get("success"):
                msg = up.get("message") or up.get("error") or f"Failed to upload {filename}"
                warnings.append(msg)
                errors.append(msg)

    # Post-check: verify views exist as "installed" signal.
    status = demo_assets_status(demo_database=target_db, retail_schema=retail_schema, ad_schema=ad_schema)
    installed_ok = bool(
        status.get("success")
        and status.get("objects", {}).get("retail_view")
        and status.get("objects", {}).get("ad_media_view")
    )

    if not installed_ok:
        # Most common cause: role lacks CREATE DATABASE / CREATE SCHEMA / CREATE TABLE privileges.
        hint = (
            "Snowflake privileges appear insufficient to create the demo database/schemas/tables. "
            "Update backend Snowflake role to one with CREATE DATABASE+SCHEMA+TABLE privileges, "
            "or provide a writable existing database for install."
        )
        return {
            "success": False,
            "demo_database": target_db,
            "schemas": {"retail": retail_schema, "ad_media": ad_schema},
            "executed_steps": len(executed),
            "uploaded": uploaded,
            "warnings": warnings,
            "error": hint,
            "status": status,
        }

    return {
        "success": True,
        "demo_database": target_db,
        "schemas": {"retail": retail_schema, "ad_media": ad_schema},
        "executed_steps": len(executed),
        "uploaded": uploaded,
        "warnings": warnings,
        "status": status,
    }


def demo_assets_status(demo_database: str = "SNOWFLOW_DEMO", retail_schema: str = "RETAIL", ad_schema: str = "AD_MEDIA") -> Dict:
    """
    Lightweight status check: verifies key views exist and YAMLs present in stages (best-effort).
    """
    if not hasattr(snowflake_client, "is_snowflake_available") or not snowflake_client.is_snowflake_available():
        return {"success": False, "error": "Snowflake not reachable"}

    checks: List[Tuple[str, str]] = [
        ("retail_view", f"SHOW VIEWS LIKE 'VW_RETAIL_SALES' IN SCHEMA {demo_database}.{retail_schema}"),
        ("ad_media_view", f"SHOW VIEWS LIKE 'VW_AD_PERFORMANCE' IN SCHEMA {demo_database}.{ad_schema}"),
    ]
    out: Dict[str, Optional[bool]] = {}
    for key, q in checks:
        try:
            res = snowflake_client.execute_sql(q)
            out[key] = bool(res.get("success") and res.get("data"))
        except Exception:
            out[key] = None

    # Stage list is optional; depends on stage permissions
    try:
        retail_files = snowflake_client.list_stage_files(demo_database, retail_schema, "SEMANTIC_MODELS", pattern=".*\\.(yaml|yml)")
    except Exception:
        retail_files = []
    try:
        ad_files = snowflake_client.list_stage_files(demo_database, ad_schema, "SEMANTIC_MODELS", pattern=".*\\.(yaml|yml)")
    except Exception:
        ad_files = []

    return {
        "success": True,
        "demo_database": demo_database,
        "schemas": {"retail": retail_schema, "ad_media": ad_schema},
        "objects": out,
        "semantic_models": {
            "retail_count": len(retail_files),
            "ad_media_count": len(ad_files),
        }
    }

