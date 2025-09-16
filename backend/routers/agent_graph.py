# backend/routers/agent_graph.py
from __future__ import annotations

from typing import Dict, List, Optional, Literal, Tuple
from uuid import uuid4
from datetime import datetime, timezone
import re

from fastapi import APIRouter, Body, HTTPException
from pydantic import BaseModel, Field

# langchain / langgraph
from langchain_core.messages import (
    BaseMessage,
    SystemMessage,
    HumanMessage,
    AIMessage,
    ToolMessage,
)
from langchain_openai import AzureChatOpenAI
from langgraph.prebuilt import create_react_agent

# Your existing imports for tools
from settings import settings
from clients.fabric import list_workspaces, list_items
from sql.odbc import exec_query
from catalog.db import get_session
from catalog.models import SqlEndpoint
from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession
from contextlib import asynccontextmanager
import httpx
import difflib
import unicodedata
import asyncio


# ---------------------------
# Async context manager for database sessions
# ---------------------------
@asynccontextmanager
async def open_session() -> AsyncSession:
    """
    Wrap FastAPI's async-generator get_session() so we can use:
        async with open_session() as session:
            ...
    """
    agen = get_session()                   # async generator
    session = await agen.__anext__()       # get one AsyncSession
    try:
        yield session
    finally:
        await agen.aclose()                # ensure generator cleanup


# ---------------------------
# Workspace resolution utilities
# ---------------------------
UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.I)

async def _resolve_workspace(workspace_or_db: Optional[str]) -> Optional[Tuple[str, str]]:
    """
    Accepts workspace NAME/ID OR a DB ID; returns (workspace_id, workspace_name).
    Prefers names with fuzzy matching; falls back to id lookups.
    """
    s = (workspace_or_db or "").strip()
    if not s:
        return None

    ws = await list_workspaces()
    id2name: dict[str, str] = {}
    names: List[str] = []
    for w in ws:
        wid = w.get("id")
        wname = (w.get("name") or w.get("displayName") or "").strip()
        if wid:
            id2name[wid] = wname
        if wname:
            names.append(wname)

    # exact id?
    if s in id2name:
        return (s, id2name[s])

    # fuzzy by name
    best = _best_match(s, names)
    if best:
        # map back to id
        for wid, wname in id2name.items():
            if _norm(wname) == _norm(best):
                return (wid, wname)

    # GUID but not a workspace id: maybe a database id -> look up locally
    if UUID_RE.match(s):
        async with open_session() as session:
            ep = await session.get(SqlEndpoint, s)
            if ep:
                return (ep.workspace_id, id2name.get(ep.workspace_id, ""))

    return None

async def _resolve_database_in_workspace(workspace: str, database: str) -> Optional[Tuple[str, str]]:
    """
    Accepts workspace name/id and database name/id -> returns (database_id, database_name).
    Uses fuzzy matching on names.
    """
    ws = await _resolve_workspace(workspace)
    if not ws:
        return None
    ws_id, _ = ws

    async with httpx.AsyncClient(base_url=str(settings.backend_base), timeout=30) as c:
        r = await c.get(f"/workspaces/{ws_id}/sqldb")
        r.raise_for_status()
        items = r.json().get("value", [])

    # exact id
    for x in items:
        if x.get("database_id") == database:
            return (database, x.get("name") or x.get("database") or "")

    # name fields
    candidates = []
    for x in items:
        nm = str(x.get("name", "")).strip()
        db = str(x.get("database", "")).strip('"')
        if nm: candidates.append(nm)
        if db and db != nm: candidates.append(db)

    best = _best_match(database, candidates)
    if not best:
        return None

    for x in items:
        nm = str(x.get("name", "")).strip()
        db = str(x.get("database", "")).strip('"')
        if _norm(best) in {_norm(nm), _norm(db)}:
            return (x.get("database_id"), nm or db or "")

    return None

async def _resolve_database_global(db_or_name: str) -> Optional[Tuple[str, str, str, str]]:
    """
    Accepts db GUID or name, across all workspaces.
    Returns (workspace_id, workspace_name, database_id, database_name).
    """
    s = (db_or_name or "").strip()
    if not s:
        return None

    if UUID_RE.match(s):
        async with open_session() as session:
            ep = await session.get(SqlEndpoint, s)
            if ep:
                ws = await _resolve_workspace(ep.workspace_id)
                if ws:
                    return (ws[0], ws[1], ep.database_id, ep.name or "")
        # fall through to scan if cache misses

    ws_list = await list_workspaces()
    async with httpx.AsyncClient(base_url=str(settings.backend_base), timeout=30) as c:
        # gather candidates
        name_idx: List[Tuple[str,str,str,str]] = []  # (ws_id, ws_name, db_id, db_name_variant)
        for w in ws_list:
            wid = w.get("id"); wname = (w.get("name") or w.get("displayName") or "").strip()
            if not wid: continue
            r = await c.get(f"/workspaces/{wid}/sqldb")
            if r.status_code != 200: continue
            for x in r.json().get("value", []):
                nm = str(x.get("name", "")).strip()
                db = str(x.get("database", "")).strip('"')
                dbid = x.get("database_id")
                if dbid:
                    if nm: name_idx.append((wid, wname, dbid, nm))
                    if db and db != nm: name_idx.append((wid, wname, dbid, db))

        best = _best_match(s, [t[3] for t in name_idx])
        if not best:
            return None
        # return the first exact match among collected variants
        for t in name_idx:
            if _norm(t[3]) == _norm(best):
                return t
    return None

SAFE_IDENT = re.compile(r"^[A-Za-z0-9_]+$")

def _safe_ident(s: str) -> Optional[str]:
    s = (s or "").strip()
    return s if SAFE_IDENT.match(s) else None

def _norm(s: str) -> str:
    s = (s or "").strip()
    s = unicodedata.normalize("NFKC", s)
    s = s.lower()
    s = re.sub(r"[\s\-_/]+", " ", s)
    return s

def _best_match(name: str, candidates: List[str], cutoff: float = 0.8) -> Optional[str]:
    if not name or not candidates:
        return None
    matches = difflib.get_close_matches(_norm(name), [_norm(c) for c in candidates], n=1, cutoff=cutoff)
    if not matches:
        return None
    # return the original (non-normalized) candidate that best matches
    idx = [_norm(c) for c in candidates].index(matches[0])
    return candidates[idx]


# ---------------------------
# Simple in-memory session store
# ---------------------------
# Keep it in-memory for now. Swap with Redis/DB later if needed.
SessionId = str

class ContextItem(BaseModel):
    label: str
    id: str

class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str

# Per-session stores
SESSION_MESSAGES: Dict[SessionId, List[ChatTurn]] = {}
SESSION_CONTEXT: Dict[SessionId, List[ContextItem]] = {}
MAX_TURNS_PER_SESSION = 30  # cap history to keep context snappy

# ---------------------------
# Request / Response models
# ---------------------------
class AgentRunRequest(BaseModel):
    # Optional persistent conversation id
    session_id: Optional[str] = None

    # New user and/or assistant messages for this turn
    messages: List[ChatTurn] = Field(default_factory=list)

    # Optional context list (generic): e.g., chosen workspace/table/etc.
    context: Optional[List[ContextItem]] = None

    # Optional hard hints (legacy fields; still supported)
    workspace_id: Optional[str] = None
    database_id: Optional[str] = None
    schema: Optional[str] = None
    table: Optional[str] = None

    max_steps: int = 8

class NewSessionResponse(BaseModel):
    session_id: str
    created_at: str

class ResetResponse(BaseModel):
    session_id: str
    cleared_messages: int
    cleared_context: int
    reset_at: str

class AgentRunResponse(BaseModel):
    session_id: Optional[str]
    steps: int
    finished_at: str
    messages: List[Dict[str, object]]
    final_text: Optional[str] = None
    final_data: Optional[TableData] = None
    final_chart: Optional[VegaLiteSpec] = None


router = APIRouter(prefix="/agent", tags=["agent"])


# ---------------------------
# Utilities
# ---------------------------
def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def _build_llm() -> AzureChatOpenAI:
    # Azure OpenAI chat model
    # endpoints/keys are loaded from .env by settings
    return AzureChatOpenAI(
        openai_api_key=str(settings.azure_openai_api_key),
        azure_endpoint=str(settings.azure_openai_endpoint_base),
        api_version=str(settings.azure_openai_api_version),
        azure_deployment=str(settings.azure_openai_deployment),
        temperature=0.2,
        max_tokens=2000,
    )

def _generic_context_block(items: List[ContextItem]) -> str:
    if not items:
        return "Context hints: (none)"
    lines = ["Context hints:"]
    lines += [f"{it.label} ({it.id})" for it in items]
    return "\n".join(lines)

def _fallback_context_from_legacy(
    workspace_id: Optional[str],
    database_id: Optional[str],
    schema: Optional[str],
    table: Optional[str],
) -> List[ContextItem]:
    out: List[ContextItem] = []
    if workspace_id:
        out.append(ContextItem(label="Workspace", id=workspace_id))
    if database_id:
        out.append(ContextItem(label="SQL Database/Endpoint", id=database_id))
    if schema:
        out.append(ContextItem(label="Schema", id=schema))
    if table:
        out.append(ContextItem(label="Table", id=table))
    return out

def _system_prompt(base_context: List[ContextItem]) -> str:
    return (
        "You are FabricAgent.\n"
        "You have access to a comprehensive catalog of all Fabric workspaces, databases, schemas, tables, and columns. "
        "Use the catalog_tool to understand the full structure, then use specific tools to explore and query data.\n\n"
        "Core tasks:\n"
        "- Get full structure: catalog_tool() (shows all workspaces, databases, schemas, tables, and columns)\n"
        "- Get fresh data: catalog_tool(fresh_data=True) (refreshes cache first, then returns cached data)\n"
        "- Explore specific items: list_workspaces_tool, list_sqldb_tool, list_schemata_tool, list_tables_tool, list_columns_tool\n"
        "- Query data (read-only): sql_select_tool (single SELECT or CTE+SELECT)\n"
        "- Visualize: make_chart_spec using the last table output\n\n"
        "Rules:\n"
        "- Always start by calling catalog_tool() to understand the full structure (uses cached catalog tables)\n"
        "- Use catalog_tool(fresh_data=True) if user explicitly asks for fresh/live data (refreshes cache first)\n"
        "- Keep SQL read-only; one statement; no comments\n"
        "- Prefer names over IDs when possible\n"
        "- If something is ambiguous, ask ONE clarifying question, then proceed\n"
        "- Mention which tables/columns you used\n"
        "- If any tool returns {\"error\":...}, do not retry blindly; explain and suggest the next step\n\n"
        f"{_generic_context_block(base_context)}"
    )

def _serialize_messages(msgs: List[BaseMessage]) -> List[Dict[str, object]]:
    out: List[Dict[str, object]] = []
    for m in msgs:
        if isinstance(m, SystemMessage):
            out.append({"type": "system", "content": m.content})
        elif isinstance(m, HumanMessage):
            out.append({"type": "human", "content": m.content})
        elif isinstance(m, AIMessage):
            entry: Dict[str, object] = {"type": "ai", "content": m.content}
            # Tool calls, if any
            tool_calls = getattr(m, "tool_calls", None)
            if isinstance(tool_calls, list) and tool_calls:
                entry["tool_calls"] = tool_calls
            out.append(entry)
        elif isinstance(m, ToolMessage):
            out.append({"type": "tool", "name": getattr(m, "name", None), "content": m.content})
        else:
            out.append({"type": "unknown", "content": str(getattr(m, "content", ""))})
    return out


# ---------------------------
# Tool wrappers (LangChain Tools) - minimal examples
# ---------------------------
from langchain_core.tools import tool
from typing import Dict, List, Optional, Literal, Tuple, cast, Mapping, TypedDict
import json
from datetime import datetime, date
from langchain_core.messages import BaseMessage, ToolMessage, SystemMessage, HumanMessage, AIMessage

# TypedDict definitions (no Any)
class TableData(TypedDict):
    columns: List[str]
    rows: List[List[object]]
    rowCount: int

class VegaField(TypedDict, total=False):
    field: str
    type: str

class VegaEncoding(TypedDict, total=False):
    x: VegaField
    y: VegaField

class VegaData(TypedDict, total=False):
    values: List[Dict[str, object]]

# Use Dict for VegaLiteSpec to handle $schema field
VegaLiteSpec = Dict[str, object]

def _json_default(o: object) -> str:
    """JSON serializer for complex objects."""
    if isinstance(o, (datetime, date)):
        return o.isoformat()
    # pydantic v2 model_dump
    if hasattr(o, "model_dump"):
        return str(getattr(o, "model_dump")())
    if hasattr(o, "dict"):
        return str(getattr(o, "dict")())
    return str(o)

def _as_json_str(data: object) -> str:
    """Convert any data to JSON string."""
    return json.dumps(data, default=_json_default, ensure_ascii=False)

def _parse_json(s: str) -> Optional[Dict[str, object]]:
    """Safely parse JSON string."""
    try:
        obj = json.loads(s)
    except Exception:
        return None
    return obj if isinstance(obj, dict) else None

def _extract_last_tool_error(messages: List[BaseMessage]) -> Optional[str]:
    """
    Find the most recent tool error. Handles:
    - ToolMessage.content as JSON: {"error":"..."}
    - ToolMessage.content as plain: "Error: ..." or "error='...'"
    Returns the error string or None.
    """
    last_error: Optional[str] = None
    for msg in messages:
        if isinstance(msg, ToolMessage):
            content = msg.content
            # case 1: dict-like tool return
            if isinstance(content, dict):
                err = content.get("error")
                if isinstance(err, str) and err:
                    last_error = err
                    continue

            # case 2: string content
            if isinstance(content, str):
                s = content.strip()
                # Try JSON
                try:
                    obj = json.loads(s)
                    if isinstance(obj, dict):
                        err = obj.get("error")
                        if isinstance(err, str) and err:
                            last_error = err
                            continue
                except Exception:
                    pass

                ls = s.lower()
                if ls.startswith("error:"):
                    last_error = s.split(":", 1)[1].strip()
                elif ls.startswith("error="):
                    last_error = s.split("=", 1)[1].strip().strip("'\"")
    return last_error

@tool
async def catalog_tool(fresh_data: bool = False, skip_inactive: bool = False) -> str:
    """
    Return a comprehensive catalog of all Fabric workspaces, databases, schemas, and tables.
    By default uses cached backend catalog for speed. Set fresh_data=True to refresh cache first.
    Set skip_inactive=True to skip refreshing inactive/suspended workspaces for faster refresh.
    """
    try:
        if fresh_data:
            # Refresh the catalog first, then return cached data
            async with httpx.AsyncClient(base_url=str(settings.backend_base), timeout=60) as c:
                params = {"skip_inactive": skip_inactive} if skip_inactive else {}
                r = await c.post("/catalog/refresh", params=params)
                if r.status_code != 200:
                    return _as_json_str({"error": f"Failed to refresh catalog: {r.status_code}"})
        
        # Return cached data (either original or freshly refreshed)
        async with httpx.AsyncClient(base_url=str(settings.backend_base), timeout=30) as c:
            r = await c.get("/catalog")
            if r.status_code != 200:
                return _as_json_str({"error": f"Failed to get catalog: {r.status_code}"})
            catalog_data = r.json()
            return _as_json_str(catalog_data)
        
    except Exception as e:
        return _as_json_str({"error": f"{type(e).__name__}: {e}"})








@tool
async def list_workspaces_tool() -> str:
    """
    Return all workspaces as JSON list: [{"id": "...", "name": "..."}]
    """
    try:
        ws = await list_workspaces()
        # normalize minimal fields
        rows = [{"id": w.get("id"), "name": w.get("name") or w.get("displayName")} for w in ws]
        return _as_json_str(rows)
    except Exception as e:
        return _as_json_str({"error": f"{type(e).__name__}: {e}"})

@tool
async def list_sqldb_tool(workspace: str) -> str:
    """
    Return SQL endpoints for a workspace (accepts workspace NAME or ID).
    """
    try:
        ws = await _resolve_workspace(workspace)
        if not ws:
            return _as_json_str({"error": f"Unknown workspace '{workspace}'"})
        ws_id, ws_name = ws

        async with httpx.AsyncClient(base_url=str(settings.backend_base), timeout=30) as c:
            r = await c.get(f"/workspaces/{ws_id}/sqldb")
            r.raise_for_status()
            data = r.json()
            items = [
                {
                    "database_id": x["database_id"],
                    "name": x.get("name") or x.get("database"),
                    "kind": x.get("kind"),
                    "server": x.get("server"),
                    "database": x.get("database"),
                    "port": x.get("port", 1433),
                    "connection_string": x.get("connection_string", ""),
                }
                for x in data.get("value", [])
            ]
        out = {"workspace": {"id": ws_id, "name": ws_name}, "items": items}
        return _as_json_str(out)
    except Exception as e:
        return _as_json_str({"error": f"{type(e).__name__}: {e}"})

@tool
async def list_items_tool(workspace: str, type_filter: Optional[str] = None) -> str:
    """
    Return items in a workspace (accepts workspace NAME or ID).
    """
    try:
        ws = await _resolve_workspace(workspace)
        if not ws:
            return _as_json_str({"error": f"Unknown workspace '{workspace}'"})
        ws_id, ws_name = ws

        items = await list_items(ws_id, type_filter)
        result = [
            {
                "id": item.get("id", ""),
                "workspace_id": ws_id,
                "name": item.get("displayName") or item.get("name", ""),
                "type": item.get("type", ""),
            }
            for item in items
        ]
        out = {"workspace": {"id": ws_id, "name": ws_name}, "items": result}
        return _as_json_str(out)
    except Exception as e:
        return _as_json_str({"error": f"{type(e).__name__}: {e}"})

@tool
async def sql_select_tool(workspace_id: str, database_id: str, sql: str) -> str:
    """
    Executes a single read-only SELECT (or CTE + SELECT).
    Accepts workspace/database as NAME or ID.
    """
    try:
        # Resolve workspace (name/id or DB id)
        ws = await _resolve_workspace(workspace_id)
        if not ws:
            return _as_json_str({"error": f"Unknown workspace '{workspace_id}'"})
        ws_id, ws_name = ws

        # Resolve database (name or id for this workspace)
        db = await _resolve_database_in_workspace(ws_id, database_id)
        if not db:
            return _as_json_str({"error": f"Unknown database '{database_id}' for workspace '{ws_name}'"})
        db_id, db_name = db

        s = (sql or "").strip().rstrip(";")
        low = s.lower()
        banned = ("insert","update","delete","merge","alter","drop","truncate","create","grant","revoke","exec")
        is_cte = low.startswith("with ")
        is_select = low.startswith("select ")
        if not (is_select or is_cte):
            return _as_json_str({"error": "Only a single read-only SELECT (or CTE + SELECT) is allowed."})
        if any(b in low for b in banned) or "--" in s or "/*" in s or "*/" in s:
            return _as_json_str({"error": "Mutating SQL or comments are not allowed."})

        async with open_session() as session:
            ep = await session.get(SqlEndpoint, db_id)
            if not ep or ep.workspace_id != ws_id:
                return _as_json_str({"error": "SQL endpoint not found for provided workspace/database."})
            cols, rows = await exec_query(ep.server, ep.database, ep.port or 1433, s)

        payload: TableData = {"columns": cols, "rows": [list(r) for r in rows], "rowCount": len(rows)}
        # include the final sql only as an extra string field for debugging
        payload_out = {"columns": payload["columns"], "rows": payload["rows"], "rowCount": payload["rowCount"], "sql": s}
        return _as_json_str(payload_out)
    except Exception as e:
        return _as_json_str({"error": f"{type(e).__name__}: {e}"})


@tool
def make_chart_spec(
    data: TableData,
    mark: Literal["bar","line","area","point","arc","pie","donut"] = "bar",
    x: Optional[str] = None,
    y: Optional[str] = None,
    category: Optional[str] = None,
    value: Optional[str] = None,
    width: int = 480,
    height: int = 320,
    inner_radius: Optional[int] = None,
) -> str:
    """
    Build a Vega-Lite spec from tabular data. Supports bar/line/area/point charts with x/y encoding,
    and pie/donut charts with theta/color encoding.
    """
    cols = data.get("columns", [])
    rows = data.get("rows", [])
    vals = [{cols[i]: row[i] for i in range(min(len(cols), len(row)))} for row in rows]

    def first_nominal() -> str:
        return category or x or (cols[0] if cols else "category")

    def first_numeric() -> str:
        return value or y or (cols[1] if len(cols) > 1 else "value")

    if mark in ("arc", "pie", "donut"):
        cat = first_nominal()
        val = first_numeric()
        spec: VegaLiteSpec = {
                "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
            "width": width, 
            "height": height, 
            "view": {"stroke": None},
            "mark": {"type": "arc", **({"innerRadius": inner_radius} if inner_radius else {})},
            "data": {"values": vals},
                "encoding": {
                "theta": {"field": val, "type": "quantitative"},
                "color": {"field": cat, "type": "nominal", "legend": {"title": cat}},
                "tooltip": [{"field": cat, "type": "nominal"}, {"field": val, "type": "quantitative"}],
                },
            }
    else:
        x_field = x or first_nominal()
        y_field = y or first_numeric()
        spec: VegaLiteSpec = {
            "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
            "width": width, 
            "height": height,
            "mark": mark,
            "data": {"values": vals},
            "encoding": {
                "x": {"field": x_field, "type": "nominal"},
                "y": {"field": y_field, "type": "quantitative"},
                "tooltip": [{"field": x_field, "type": "nominal"}, {"field": y_field, "type": "quantitative"}],
            },
        }
    return _as_json_str(spec)

@tool
async def list_schemata_tool(database: str) -> str:
    """
    List schemas in a SQL Database/Endpoint.
    Accepts database NAME or ID. Returns {"columns":["schema"],"rows":[[...]],"rowCount":N}
    """
    try:
        pair = await _resolve_database_global(database)
        if not pair:
            return _as_json_str({"error": f"Unknown database '{database}'"})
        ws_id, ws_name, db_id, db_name = pair

        sql = "SELECT schema_name FROM INFORMATION_SCHEMA.SCHEMATA ORDER BY schema_name;"
        async with open_session() as session:
            ep = await session.get(SqlEndpoint, db_id)
            if not ep or ep.workspace_id != ws_id:
                return _as_json_str({"error": "SQL endpoint not found for provided database."})
            cols, rows = await exec_query(ep.server, ep.database, ep.port or 1433, sql)

        # Normalize to a single column named 'schema'
        out_rows = [[r[0]] for r in rows]
        return _as_json_str({"columns": ["schema"], "rows": out_rows, "rowCount": len(out_rows)})
    except Exception as e:
        return _as_json_str({"error": f"{type(e).__name__}: {e}"})


@tool
async def list_tables_tool(database: str, schema: str) -> str:
    """
    List base tables in a given schema of a database.
    Accepts database NAME or ID; schema must be an identifier (letters/digits/_).
    Returns {"columns":["schema","table"],"rows":[["SalesLT","Customer"], ...]}
    """
    try:
        schema_safe = _safe_ident(schema)
        if not schema_safe:
            return _as_json_str({"error": f"Invalid schema identifier '{schema}'"})

        pair = await _resolve_database_global(database)
        if not pair:
            return _as_json_str({"error": f"Unknown database '{database}'"})
        ws_id, ws_name, db_id, db_name = pair

        sql = (
            "SELECT TABLE_SCHEMA, TABLE_NAME "
            "FROM INFORMATION_SCHEMA.TABLES "
            f"WHERE TABLE_TYPE='BASE TABLE' AND TABLE_SCHEMA = '{schema_safe}' "
            "ORDER BY TABLE_NAME;"
        )
        async with open_session() as session:
            ep = await session.get(SqlEndpoint, db_id)
            if not ep or ep.workspace_id != ws_id:
                return _as_json_str({"error": "SQL endpoint not found for provided database."})
            cols, rows = await exec_query(ep.server, ep.database, ep.port or 1433, sql)

        out_rows = [[r[0], r[1]] for r in rows]
        return _as_json_str({"columns": ["schema", "table"], "rows": out_rows, "rowCount": len(out_rows)})
    except Exception as e:
        return _as_json_str({"error": f"{type(e).__name__}: {e}"})


@tool
async def list_columns_tool(database: str, schema: str, table: str) -> str:
    """
    List columns for a schema.table in a database.
    Accepts database NAME or ID. Returns columns with basic metadata.
    """
    try:
        schema_safe = _safe_ident(schema)
        table_safe = _safe_ident(table)
        if not schema_safe or not table_safe:
            return _as_json_str({"error": "Invalid schema or table identifier."})

        pair = await _resolve_database_global(database)
        if not pair:
            return _as_json_str({"error": f"Unknown database '{database}'"})
        ws_id, ws_name, db_id, db_name = pair

        sql = (
            "SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE "
            "FROM INFORMATION_SCHEMA.COLUMNS "
            f"WHERE TABLE_SCHEMA = '{schema_safe}' AND TABLE_NAME = '{table_safe}' "
            "ORDER BY ORDINAL_POSITION;"
        )
        async with open_session() as session:
            ep = await session.get(SqlEndpoint, db_id)
            if not ep or ep.workspace_id != ws_id:
                return _as_json_str({"error": "SQL endpoint not found for provided database."})
            cols, rows = await exec_query(ep.server, ep.database, ep.port or 1433, sql)

        return _as_json_str({"columns": cols, "rows": [list(r) for r in rows], "rowCount": len(rows)})
    except Exception as e:
        return _as_json_str({"error": f"{type(e).__name__}: {e}"})

# You can register more tools (sample_rows, groupby_count, auto_chart, etc.) here and include them below.


# ---------------------------
# Endpoints
# ---------------------------
@router.post("/new", response_model=NewSessionResponse)
async def new_session() -> NewSessionResponse:
    sid = str(uuid4())
    SESSION_MESSAGES[sid] = []
    SESSION_CONTEXT[sid] = []
    return NewSessionResponse(session_id=sid, created_at=_now_iso())

@router.post("/session/{session_id}/reset", response_model=ResetResponse)
async def reset_session(session_id: str) -> ResetResponse:
    cleared_msgs = len(SESSION_MESSAGES.get(session_id, []))
    cleared_ctx = len(SESSION_CONTEXT.get(session_id, []))
    SESSION_MESSAGES[session_id] = []
    SESSION_CONTEXT[session_id] = []
    return ResetResponse(
        session_id=session_id,
        cleared_messages=cleared_msgs,
        cleared_context=cleared_ctx,
        reset_at=_now_iso(),
    )

@router.post("/session/{session_id}/context", response_model=List[ContextItem])
async def set_session_context(session_id: str, items: List[ContextItem] = Body(...)) -> List[ContextItem]:
    # Replace existing context for this session
    SESSION_CONTEXT[session_id] = list(items)
    return SESSION_CONTEXT[session_id]


@router.post("/run", response_model=AgentRunResponse)
async def run_agent(req: AgentRunRequest) -> AgentRunResponse:
    # Resolve session
    sid: Optional[str] = req.session_id
    # Load or init history/context
    history: List[ChatTurn] = SESSION_MESSAGES.get(sid, []).copy() if sid else []
    context_items: List[ContextItem] = (
        req.context if req.context is not None
        else (SESSION_CONTEXT.get(sid, []).copy() if sid else [])
    )

    # Back-compat: if legacy hints provided, append them as generic context items
    legacy_ctx = _fallback_context_from_legacy(req.workspace_id, req.database_id, req.schema, req.table)
    if legacy_ctx:
        context_items.extend(legacy_ctx)

    # Build the system prompt including generic context block
    system = _system_prompt(context_items)

    # Convert stored + new messages into LangChain messages
    def to_lc(turns: List[ChatTurn]) -> List[BaseMessage]:
        out: List[BaseMessage] = []
        for t in turns:
            if t.role == "user":
                out.append(HumanMessage(t.content))
            else:
                out.append(AIMessage(t.content))
        return out

    prior_msgs_lc = to_lc(history)
    new_msgs_lc = to_lc(req.messages)

    # Compose full message list for this invocation
    input_messages: List[BaseMessage] = [SystemMessage(system), *prior_msgs_lc, *new_msgs_lc]

    # LLM & tools
    llm = _build_llm()
    tools = [
        catalog_tool,
        list_workspaces_tool, list_sqldb_tool, list_items_tool,
        list_schemata_tool, list_tables_tool, list_columns_tool,
        sql_select_tool, make_chart_spec,
    ]

    # Build graph (no prompt arg; we pass SystemMessage in input instead)
    graph = create_react_agent(model=llm, tools=tools)

    # Invoke asynchronously for async tools with recursion limit to prevent infinite loops
    result = await graph.ainvoke(
        {"messages": input_messages},
        config={"recursion_limit": req.max_steps or 8}
    )

    # The graph returns a dict with "messages"
    out_messages_obj = result.get("messages", [])
    if not isinstance(out_messages_obj, list):
        raise HTTPException(500, "Agent returned unexpected payload.")

    msgs: List[BaseMessage] = cast(List[BaseMessage], out_messages_obj)

    # Detect tool error and stop early (unchanged)
    tool_err = _extract_last_tool_error(msgs)
    if tool_err:
        out_msgs = _serialize_messages(out_messages_obj)
        return AgentRunResponse(
            session_id=sid,
            steps=sum(1 for m in msgs if isinstance(m, ToolMessage)) + 1,
            messages=out_msgs,
            finished_at=_now_iso(),
            final_text=(
                "I couldn't complete that request because a tool returned an error: "
                f"{tool_err}\n\nPlease adjust your request (e.g., pick a different table/column or simplify the SQL) and try again."
            ),
            final_data=None,
            final_chart=None,
        )

    # Find last table & last chart in tool outputs
    last_table: Optional[TableData] = None
    last_chart: Optional[VegaLiteSpec] = None

    for m in msgs:
        if isinstance(m, ToolMessage) and isinstance(m.content, str):
            obj = _parse_json(m.content)
            if not obj:
                continue
            if "columns" in obj and "rows" in obj:
                # Slim validation into TableData
                cols = obj.get("columns")
                rows = obj.get("rows")
                rc = obj.get("rowCount", len(rows) if isinstance(rows, list) else 0)
                if isinstance(cols, list) and isinstance(rows, list):
                    last_table = {"columns": cols, "rows": rows, "rowCount": rc}
            if "$schema" in obj and "encoding" in obj and "data" in obj:
                last_chart = obj  # type: ignore[assignment]

    # If user asked for a chart, synthesize from last_table if needed
    user_wants_chart = any(
        isinstance(m, HumanMessage)
        and isinstance(m.content, str)
        and any(k in m.content.lower() for k in ("chart", "plot", "visual", "bar", "line", "scatter"))
        for m in msgs
    )

    if user_wants_chart and last_table and not last_chart:
        cols = last_table["columns"]
        # simple heuristic: category/cnt if present, else first (x) and next (y)
        if "category" in cols and "cnt" in cols:
            x_field, y_field = "category", "cnt"
        else:
            x_field = cols[0] if cols else "x"
            y_field = cols[1] if len(cols) > 1 else "y"
        spec_json = make_chart_spec.invoke({"data": last_table, "mark": "bar", "x": x_field, "y": y_field})
        obj = _parse_json(spec_json)
        if obj and "$schema" in obj:
            last_chart = obj  # type: ignore[assignment]

    serialized = _serialize_messages(out_messages_obj)
    steps = max(0, len([m for m in serialized if m["type"] in ("tool", "ai")]))

    # Persist turn into session
    if sid:
        SESSION_MESSAGES.setdefault(sid, [])
        SESSION_CONTEXT.setdefault(sid, context_items)
        SESSION_MESSAGES[sid].extend(req.messages)
        # Append only final AI text
        final_ai_text = next((m.content for m in reversed(out_messages_obj) if isinstance(m, AIMessage)), None)
        if final_ai_text:
            SESSION_MESSAGES[sid].append(ChatTurn(role="assistant", content=final_ai_text))
        # Cap
        if len(SESSION_MESSAGES[sid]) > 2*MAX_TURNS_PER_SESSION:
            SESSION_MESSAGES[sid] = SESSION_MESSAGES[sid][-2*MAX_TURNS_PER_SESSION:]

    return AgentRunResponse(
        session_id=sid,
        steps=steps,
        finished_at=_now_iso(),
        messages=serialized,
        final_text=next((m["content"] for m in reversed(serialized) if m.get("type") == "ai"), None),
        final_data=last_table,
        final_chart=last_chart,
    )
