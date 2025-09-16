# backend/routers/workspaces.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, func

from backend.catalog.db import get_session
from backend.catalog.models import Workspace, Item, SqlEndpoint
from backend.catalog.upsert import upsert_workspaces, upsert_items, upsert_sql_endpoints
from backend.clients.fabric import list_workspaces, list_items, map_workspace, map_item, resolve_sql_endpoints_for_workspace
from datetime import datetime, timezone

router = APIRouter(prefix="/workspaces", tags=["workspaces"])

async def _hydrate_all(session: AsyncSession):
    # pull from Fabric Core and persist
    ws_raw = await list_workspaces()
    ws_rows = [map_workspace(w) for w in ws_raw]
    await upsert_workspaces(session, ws_rows)
    await session.commit()

    # also persist items per workspace (summary) to enable /{id}
    for w in ws_raw:
        items_raw = await list_items(w["id"])
        it_rows = [map_item(w["id"], it) for it in items_raw]
        await upsert_items(session, it_rows)
        await session.commit()

@router.get("")
async def get_workspaces(session: AsyncSession = Depends(get_session)):
    """Get all workspaces from cache."""
    count = (await session.execute(select(func.count()).select_from(Workspace))).scalar()
    if count == 0:
        await _hydrate_all(session)

    res = (await session.execute(select(Workspace))).scalars().all()
    return {
        "value": [w.model_dump() for w in res],
        "source": "catalog"
    }

@router.post("/refresh")
async def refresh_workspaces(session: AsyncSession = Depends(get_session)):
    """Refresh all workspaces from Fabric."""
    await _hydrate_all(session)
    return {"status": "success", "message": "All workspaces refreshed"}

@router.get("/{workspace_id}")
async def get_workspace(
    workspace_id: str,
    session: AsyncSession = Depends(get_session),
):
    """Get a specific workspace from cache."""
    ws = await session.get(Workspace, workspace_id)
    if ws is None:
        raise HTTPException(404, "Workspace not found in cache. Use POST /refresh to refresh from Fabric.")

    items = (await session.execute(select(Item).where(Item.workspace_id == workspace_id))).scalars().all()
    return {
        "workspace": ws.model_dump(),
        "items": [i.model_dump() for i in items],
        "source": "catalog"
    }

@router.post("/{workspace_id}/refresh")
async def refresh_workspace(
    workspace_id: str, 
    session: AsyncSession = Depends(get_session)
):
    """Refresh a specific workspace from Fabric."""
    # reload just this workspace + items
    ws_all = await list_workspaces()
    lookup = {w["id"]: w for w in ws_all}
    if workspace_id not in lookup:
        raise HTTPException(404, "Workspace not found in Fabric")
    await upsert_workspaces(session, [map_workspace(lookup[workspace_id])])
    items_raw = await list_items(workspace_id)
    await upsert_items(session, [map_item(workspace_id, it) for it in items_raw])
    await session.commit()
    return {"status": "success", "message": f"Workspace {workspace_id} refreshed"}


@router.get("/{workspace_id}/all")
async def get_workspace_all(workspace_id: str, session: AsyncSession = Depends(get_session)):
    """Get workspace with all its items and SQL endpoints from cache."""
    # ensure workspace meta + items exist
    ws = await session.get(Workspace, workspace_id)
    if ws is None:
        raise HTTPException(404, "Workspace not found in cache. Use POST /refresh to refresh from Fabric.")

    items = (await session.execute(select(Item).where(Item.workspace_id == workspace_id))).scalars().all()
    sqls = (await session.execute(select(SqlEndpoint).where(SqlEndpoint.workspace_id == workspace_id))).scalars().all()

    return {
        "workspace": ws.model_dump(),
        "items": [i.model_dump() for i in items],
        "sql": [s.model_dump() for s in sqls],
        "source": "catalog",
    }

@router.post("/{workspace_id}/all/refresh")
async def refresh_workspace_all(workspace_id: str, session: AsyncSession = Depends(get_session)):
    """Refresh workspace with all its items and SQL endpoints from Fabric."""
    # ensure workspace meta + items exist
    ws_all = await list_workspaces()
    lookup = {w["id"]: w for w in ws_all}
    if workspace_id not in lookup:
        raise HTTPException(404, "Workspace not found in Fabric")
    await upsert_workspaces(session, [map_workspace(lookup[workspace_id])])
    items_raw = await list_items(workspace_id)
    await upsert_items(session, [map_item(workspace_id, it) for it in items_raw])

    # ensure sql endpoints too
    rows = await resolve_sql_endpoints_for_workspace(workspace_id)
    await upsert_sql_endpoints(session, rows)
    await session.commit()

    return {"status": "success", "message": f"Workspace {workspace_id} with all items refreshed"}