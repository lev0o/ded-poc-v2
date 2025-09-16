from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from backend.catalog.db import get_session
from backend.catalog.models import SqlEndpoint
from backend.sql.odbc import exec_query, choose_driver
from datetime import datetime, timezone

router = APIRouter(prefix="/workspaces/{workspace_id}/sqldb/{database_id}", tags=["diagnostics"])

def _now(): return datetime.now(timezone.utc).isoformat()

async def _get_ep(session: AsyncSession, ws_id: str, db_id: str):
    ep = await session.get(SqlEndpoint, db_id)
    if not ep or ep.workspace_id != ws_id: return None
    return ep

@router.get("/availability")
async def availability(workspace_id: str, database_id: str, session: AsyncSession = Depends(get_session)):
    ep = await _get_ep(session, workspace_id, database_id)
    if not ep: return {"available": False, "reason": "not-found"}
    if not ep.server or not ep.database:
        return {"available": False, "reason": "no-connection-info", "checked_at": _now()}
    try:
        driver = choose_driver()
        cols, rows = await exec_query(ep.server, ep.database, ep.port or 1433, "SELECT 1")
        return {"available": bool(rows), "driver": driver, "checked_at": _now()}
    except Exception as e:
        return {"available": False, "reason": str(e), "checked_at": _now()}
