from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, delete
from datetime import datetime, timezone

from backend.catalog.db import get_session
from backend.catalog.models import SqlEndpoint, Schema, Table, Column
from backend.catalog.upsert import upsert_schemas, upsert_tables, upsert_columns
from backend.sql.odbc import fetch_schemata, fetch_tables, fetch_columns

router = APIRouter(prefix="/workspaces/{workspace_id}/sqldb/{database_id}", tags=["introspect"])

def _now(): return datetime.now(timezone.utc).isoformat()

async def _require_ep(s: AsyncSession, ws: str, db: str) -> SqlEndpoint:
    ep = await s.get(SqlEndpoint, db)
    if not ep or ep.workspace_id != ws:
        raise HTTPException(404, "SQL endpoint not found. Try /sqldb?fresh=1 or /sqldb/reload.")
    if not ep.server or not ep.database:
        raise HTTPException(503, "SQL endpoint has no active connection info.")
    return ep

@router.get("/introspect")
async def introspect(
    workspace_id: str,
    database_id: str,
    session: AsyncSession = Depends(get_session),
):
    """Get database introspection from cache."""
    ep = await _require_ep(session, workspace_id, database_id)

    # Check if catalog is empty
    existing_schema = (await session.execute(
        select(Schema).where((Schema.workspace_id==workspace_id)&(Schema.database_id==database_id))
    )).scalars().first()
    
    if existing_schema is None:
        raise HTTPException(404, "No introspection data found in cache. Use POST /introspect/refresh to refresh from database.")

    # build nested map from catalog
    schemas = (await session.execute(
        select(Schema).where((Schema.workspace_id==workspace_id)&(Schema.database_id==database_id))
    )).scalars().all()
    tables = (await session.execute(
        select(Table).where((Table.workspace_id==workspace_id)&(Table.database_id==database_id))
    )).scalars().all()
    columns = (await session.execute(
        select(Column).where((Column.workspace_id==workspace_id)&(Column.database_id==database_id))
    )).scalars().all()

    nested = {s.schema_name: {} for s in schemas}
    for t in tables:
        nested.setdefault(t.schema_name, {})[t.table_name] = []
    for c in columns:
        nested.setdefault(c.schema_name, {}).setdefault(c.table_name, []).append({
            "name": c.column_name,
            "type": c.data_type,
            "nullable": c.is_nullable,
            "max_length": c.max_length,
            "precision": c.numeric_precision,
            "scale": c.numeric_scale,
            "ordinal": c.ordinal,
        })

    return {
        "database": ep.database,
        "schemas": nested,
        "source": "catalog",
        "sampled_at": _now(),
    }

@router.post("/introspect/refresh")
async def refresh_introspect(
    workspace_id: str,
    database_id: str,
    session: AsyncSession = Depends(get_session),
):
    """Refresh database introspection from live database."""
    ep = await _require_ep(session, workspace_id, database_id)

    # wipe existing for a clean rebuild
    await session.execute(delete(Column).where(
        (Column.workspace_id==workspace_id)&(Column.database_id==database_id)
    ))
    await session.execute(delete(Table).where(
        (Table.workspace_id==workspace_id)&(Table.database_id==database_id)
    ))
    await session.execute(delete(Schema).where(
        (Schema.workspace_id==workspace_id)&(Schema.database_id==database_id)
    ))

    # scan live
    try:
        schemata = await fetch_schemata(ep.server, ep.database, ep.port or 1433)
        await upsert_schemas(session, [
            {"workspace_id": workspace_id, "database_id": database_id,
             "schema_name": s, "sampled_at": _now()}
            for s in schemata
        ])
        for s in schemata:
            pairs = await fetch_tables(ep.server, ep.database, ep.port or 1433, s)
            await upsert_tables(session, [
                {"workspace_id": workspace_id, "database_id": database_id,
                 "schema_name": sch, "table_name": tbl, "sampled_at": _now()}
                for sch, tbl in pairs
            ])
            # columns per table
            for _, tbl in pairs:
                cols_raw = await fetch_columns(ep.server, ep.database, ep.port or 1433, s, tbl)
                await upsert_columns(session, [{
                    "workspace_id": workspace_id, "database_id": database_id,
                    "schema_name": s, "table_name": tbl,
                    "column_name": r[0], "ordinal": r[1], "data_type": r[2],
                    "is_nullable": (str(r[3]).upper() == "YES"),
                    "max_length": r[4], "numeric_precision": r[5], "numeric_scale": r[6],
                    "sampled_at": _now()
                } for r in cols_raw])
        await session.commit()
        return {"status": "success", "message": f"Introspection refreshed for database {database_id}"}
    except Exception as e:
        # clean message if endpoint/capacity perms hiccup mid-scan
        raise HTTPException(status_code=503, detail=str(e))
