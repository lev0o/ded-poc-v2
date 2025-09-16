# fabric_explorer/routers/dbmeta.py
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, delete
from datetime import datetime, timezone

from backend.catalog.db import get_session
from backend.catalog.models import SqlEndpoint, Schema, Table, Column
from backend.catalog.upsert import upsert_schemas, upsert_tables, upsert_columns
from backend.sql.odbc import fetch_schemata, fetch_tables, fetch_columns, exec_query

router = APIRouter(prefix="/workspaces/{workspace_id}/sqldb/{database_id}", tags=["dbmeta"])


async def _require_endpoint(session: AsyncSession, workspace_id: str, database_id: str) -> SqlEndpoint:
    ep = await session.get(SqlEndpoint, database_id)
    if not ep or ep.workspace_id != workspace_id:
        raise HTTPException(404, "SQL endpoint not found. Try /sqldb?fresh=1 or /sqldb/reload.")
    if not ep.server or not ep.database:
        raise HTTPException(
            503,
            "SQL endpoint has no active connection info (capacity inactive, endpoint unavailable, "
            "or missing permissions). Try again later or activate capacity."
        )
    return ep


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@router.get("/schema")
async def list_schemata(
    workspace_id: str,
    database_id: str,
    session: AsyncSession = Depends(get_session),
):
    """Get schemas for a database from cache."""
    ep = await _require_endpoint(session, workspace_id, database_id)

    existing = (
        await session.execute(
            select(Schema).where(
                (Schema.workspace_id == workspace_id) & (Schema.database_id == database_id)
            )
        )
    ).scalars().all()

    if not existing:
        raise HTTPException(404, "No schemas found in cache. Use POST /schema/refresh to refresh from database.")

    return {"schemas": [s.schema_name for s in existing], "source": "catalog"}

@router.post("/schema/refresh")
async def refresh_schemata(
    workspace_id: str,
    database_id: str,
    session: AsyncSession = Depends(get_session),
):
    """Refresh schemas for a database from live database."""
    ep = await _require_endpoint(session, workspace_id, database_id)

    await session.execute(
        delete(Schema).where(
            (Schema.workspace_id == workspace_id) & (Schema.database_id == database_id)
        )
    )
    try:
        names = await fetch_schemata(ep.server, ep.database, ep.port or 1433)
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))
    rows = [
        {"workspace_id": workspace_id, "database_id": database_id, "schema_name": s, "sampled_at": _now_iso()}
        for s in names
    ]
    await upsert_schemas(session, rows)
    await session.commit()
    return {"status": "success", "message": f"Schemas refreshed for database {database_id}", "count": len(names)}


@router.get("/schema/{schema}/tables")
async def list_tables(
    workspace_id: str,
    database_id: str,
    schema: str,
    session: AsyncSession = Depends(get_session),
):
    """Get tables for a schema from cache."""
    ep = await _require_endpoint(session, workspace_id, database_id)

    existing = (
        await session.execute(
            select(Table).where(
                (Table.workspace_id == workspace_id)
                & (Table.database_id == database_id)
                & (Table.schema_name == schema)
            )
        )
    ).scalars().all()

    if not existing:
        raise HTTPException(404, f"No tables found in cache for schema {schema}. Use POST /schema/{schema}/tables/refresh to refresh from database.")

    return {
        "tables": [{"schema": t.schema_name, "table": t.table_name} for t in existing],
        "source": "catalog",
    }

@router.post("/schema/{schema}/tables/refresh")
async def refresh_tables(
    workspace_id: str,
    database_id: str,
    schema: str,
    session: AsyncSession = Depends(get_session),
):
    """Refresh tables for a schema from live database."""
    ep = await _require_endpoint(session, workspace_id, database_id)

    await session.execute(
        delete(Table).where(
            (Table.workspace_id == workspace_id)
            & (Table.database_id == database_id)
            & (Table.schema_name == schema)
        )
    )
    try:
        pairs = await fetch_tables(ep.server, ep.database, ep.port or 1433, schema)
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))
    rows = [
        {
            "workspace_id": workspace_id,
            "database_id": database_id,
            "schema_name": s,
            "table_name": t,
            "sampled_at": _now_iso(),
        }
        for s, t in pairs
    ]
    await upsert_tables(session, rows)
    await session.commit()
    return {"status": "success", "message": f"Tables refreshed for schema {schema}", "count": len(pairs)}


@router.get("/schema/{schema}/tables/{table}/columns")
async def list_columns(
    workspace_id: str,
    database_id: str,
    schema: str,
    table: str,
    session: AsyncSession = Depends(get_session),
):
    """Get columns for a table from cache."""
    ep = await _require_endpoint(session, workspace_id, database_id)

    existing = (
        await session.execute(
            select(Column).where(
                (Column.workspace_id == workspace_id)
                & (Column.database_id == database_id)
                & (Column.schema_name == schema)
                & (Column.table_name == table)
            )
        )
    ).scalars().all()

    if not existing:
        raise HTTPException(404, f"No columns found in cache for table {schema}.{table}. Use POST /schema/{schema}/tables/{table}/columns/refresh to refresh from database.")

    return {
        "columns": [
            {
                "name": c.column_name,
                "ordinal": c.ordinal,
                "type": c.data_type,
                "nullable": c.is_nullable,
                "max_length": c.max_length,
                "precision": c.numeric_precision,
                "scale": c.numeric_scale,
            }
            for c in existing
        ],
        "source": "catalog",
    }

@router.post("/schema/{schema}/tables/{table}/columns/refresh")
async def refresh_columns(
    workspace_id: str,
    database_id: str,
    schema: str,
    table: str,
    session: AsyncSession = Depends(get_session),
):
    """Refresh columns for a table from live database."""
    ep = await _require_endpoint(session, workspace_id, database_id)

    await session.execute(
        delete(Column).where(
            (Column.workspace_id == workspace_id)
            & (Column.database_id == database_id)
            & (Column.schema_name == schema)
            & (Column.table_name == table)
        )
    )
    try:
        rows_raw = await fetch_columns(ep.server, ep.database, ep.port or 1433, schema, table)
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))
    rows = [
        {
            "workspace_id": workspace_id,
            "database_id": database_id,
            "schema_name": schema,
            "table_name": table,
            "column_name": r[0],
            "ordinal": r[1],
            "data_type": r[2],
            "is_nullable": (str(r[3]).upper() == "YES"),
            "max_length": r[4],
            "numeric_precision": r[5],
            "numeric_scale": r[6],
            "sampled_at": _now_iso(),
        }
        for r in rows_raw
    ]
    await upsert_columns(session, rows)
    await session.commit()
    return {"status": "success", "message": f"Columns refreshed for table {schema}.{table}", "count": len(rows_raw)}


# ---------------- query endpoint (read-only by default) ----------------

BLOCKLIST = ("insert", "update", "delete", "merge", "alter", "drop", "truncate", "create", "grant", "revoke")


@router.post("/query")
async def query_sql(
    workspace_id: str,
    database_id: str,
    body: dict = Body(..., example={"sql": "SELECT TOP 100 * FROM [dbo].[YourTable] WHERE id = ?", "params": [123], "maxRows": 1000}),
    session: AsyncSession = Depends(get_session),
):
    ep = await _require_endpoint(session, workspace_id, database_id)
    sql_txt = (body.get("sql") or "").strip()
    params = body.get("params") or []          # NEW
    max_rows = int(body.get("maxRows") or 10000)

    # naïve safety (read-only)
    lower = sql_txt.lower().replace("\n", " ")
    if any(tok in lower for tok in BLOCKLIST):
        raise HTTPException(400, "Only read-only queries are allowed. (Detected a mutating statement.)")

    try:
        cols, rows = await exec_query(ep.server, ep.database, ep.port or 1433, sql_txt, tuple(params))
    except Exception as e:
        # Bubble up driver / token / capacity issues as friendly 503
        raise HTTPException(status_code=503, detail=str(e))

    if max_rows and len(rows) > max_rows:
        rows = rows[:max_rows]

    return {
        "columns": cols,
        "rows": [list(r) for r in rows],
        "rowCount": len(rows),
    }
