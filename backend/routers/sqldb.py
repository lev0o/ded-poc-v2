# backend/routers/sqldb.py
import re
from contextlib import asynccontextmanager
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, delete

from backend.catalog.db import get_session
from backend.catalog.models import SqlEndpoint
from backend.catalog.upsert import upsert_sql_endpoints
from backend.clients.fabric import resolve_sql_endpoints_for_workspace

UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.I)

@asynccontextmanager
async def open_session():
    agen = get_session()
    session = await agen.__anext__()
    try:
        yield session
    finally:
        await agen.aclose()

router = APIRouter(prefix="/workspaces/{workspace_id}/sqldb", tags=["sqldb"])


async def _ensure_cached(session: AsyncSession, workspace_id: str):
    # If nothing cached for this workspace, hydrate once
    first_row = (
        await session.execute(
            select(SqlEndpoint).where(SqlEndpoint.workspace_id == workspace_id)
        )
    ).scalars().first()
    if first_row is None:
        rows = await resolve_sql_endpoints_for_workspace(workspace_id)
        await upsert_sql_endpoints(session, rows)
        await session.commit()


@router.get("")
async def list_sqldb(
    workspace_id: str,
    session: AsyncSession = Depends(get_session),
):
    """Get SQL databases for a workspace from cache."""
    # If a DB id was accidentally passed in the workspace slot, map it to the real workspace id
    if UUID_RE.match(workspace_id):
        ep = await session.get(SqlEndpoint, workspace_id)
        if ep:  # It's actually a DB id
            workspace_id = ep.workspace_id

    await _ensure_cached(session, workspace_id)

    res = (
        await session.execute(
            select(SqlEndpoint).where(SqlEndpoint.workspace_id == workspace_id)
        )
    ).scalars().all()
    return {"value": [r.model_dump() for r in res], "source": "catalog"}

@router.post("/refresh")
async def refresh_sqldb(workspace_id: str, session: AsyncSession = Depends(get_session)):
    """Refresh SQL databases for a workspace from Fabric."""
    # Purge old rows for this workspace to avoid duplicates/stale entries
    await session.execute(delete(SqlEndpoint).where(SqlEndpoint.workspace_id == workspace_id))
    rows = await resolve_sql_endpoints_for_workspace(workspace_id)
    await upsert_sql_endpoints(session, rows)
    await session.commit()
    return {"status": "success", "message": f"SQL databases refreshed for workspace {workspace_id}", "count": len(rows)}


@router.get("/{database_id}")
async def get_sqldb(
    workspace_id: str,
    database_id: str,
    session: AsyncSession = Depends(get_session),
):
    """Get a specific SQL database from cache."""
    obj = await session.get(SqlEndpoint, database_id)
    if not obj or obj.workspace_id != workspace_id:
        raise HTTPException(404, "SQL database/endpoint not found in cache. Use POST /refresh to refresh from Fabric.")

    return obj.model_dump()

@router.post("/{database_id}/refresh")
async def refresh_sqldb_one(
    workspace_id: str, 
    database_id: str, 
    session: AsyncSession = Depends(get_session)
):
    """Refresh a specific SQL database from Fabric."""
    # Reload the whole workspace to keep catalog consistent (simpler than per-id probes)
    await session.execute(delete(SqlEndpoint).where(SqlEndpoint.workspace_id == workspace_id))
    rows = await resolve_sql_endpoints_for_workspace(workspace_id)
    await upsert_sql_endpoints(session, rows)
    await session.commit()

    obj = await session.get(SqlEndpoint, database_id)
    if not obj or obj.workspace_id != workspace_id:
        raise HTTPException(404, "SQL database/endpoint not found after refresh")
    return {"status": "success", "message": f"SQL database {database_id} refreshed"}


