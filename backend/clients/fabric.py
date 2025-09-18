# backend/clients/fabric.py
from typing import Dict, Any, List, Optional, Tuple
import logging
import httpx
from tenacity import AsyncRetrying, stop_after_attempt, wait_exponential, retry_if_exception_type
from settings import settings
from auth.broker import broker, FABRIC_SCOPES

log = logging.getLogger(__name__)


# ------------------------ Basic GET helper ------------------------

async def _get_json(client: httpx.AsyncClient, path: str, params=None, token=None):
    r = await client.get(path, params=params, headers={"Authorization": f"Bearer {token}"})
    r.raise_for_status()
    return r.json()

async def _get_json_retry(
    client: httpx.AsyncClient,
    path: str,
    params: Optional[Dict[str, str]],
    token: str,
) -> Dict[str, Any]:
    retry_types: Tuple[type, ...] = (httpx.RequestError, httpx.ConnectError, httpx.ReadTimeout)
    async for attempt in AsyncRetrying(
        stop=stop_after_attempt(settings.fabric_http_retries),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        retry=retry_if_exception_type(retry_types),
        reraise=True,
    ):
        with attempt:
            return await _get_json(client, path, params=params, token=token)


# ------------------------ Workspace & Items ------------------------

async def check_workspace_availability(workspace_id: str) -> str:
    """Check workspace availability by testing actual connectivity."""
    token = broker.token(FABRIC_SCOPES)
    try:
        async with httpx.AsyncClient(base_url=str(settings.fabric_base), timeout=10) as c:
            # Try to get SQL endpoints for this workspace
            data = await _get_json(c, f"workspaces/{workspace_id}/sqlEndpoints", token=token)
            if data is not None and data.get("value"):
                endpoints = data.get("value", [])
                if endpoints:
                    endpoint_id = endpoints[0]["id"]
                    # Try to get connection string
                    conn_data = await _get_json(c, f"workspaces/{workspace_id}/sqlEndpoints/{endpoint_id}/connectionString", token=token)
                    if conn_data and conn_data.get("connectionString"):
                        conn_str = conn_data["connectionString"]
                        
                        # Check if this is a Fabric endpoint (datawarehouse or onelake)
                        if 'datawarehouse.fabric.microsoft.com' in conn_str or 'onelake.dfs.fabric.microsoft.com' in conn_str:
                            # For Fabric endpoints, test by trying to access workspace items
                            try:
                                items_data = await _get_json(c, f"workspaces/{workspace_id}/items", token=token)
                                
                                # If we can get items, try to test actual data access by attempting a query
                                # This should fail if capacity is paused
                                try:
                                    # Try to get SQL databases for this workspace - this should fail if paused
                                    sql_data = await _get_json(c, f"workspaces/{workspace_id}/sqlEndpoints", token=token)
                                    if sql_data and sql_data.get("value"):
                                        # Try to get connection string for the first SQL endpoint
                                        first_endpoint = sql_data["value"][0]
                                        endpoint_id = first_endpoint["id"]
                                        conn_test = await _get_json(c, f"workspaces/{workspace_id}/sqlEndpoints/{endpoint_id}/connectionString", token=token)
                                        if conn_test and conn_test.get("connectionString"):
                                            # Try to actually execute a SQL query - this should fail if capacity is paused
                                            try:
                                                from sql.odbc import exec_query
                                                conn_str = conn_test["connectionString"]
                                                
                                                # For Fabric datawarehouse endpoints, the connection string is just the hostname
                                                if 'datawarehouse.fabric.microsoft.com' in conn_str:
                                                    # Extract server from the connection string (it's just the hostname)
                                                    server = conn_str.strip()
                                                    database = "master"  # Use master database for Fabric endpoints
                                                    
                                                    try:
                                                        cols, rows = await exec_query(server, database, 1433, "SELECT 1")
                                                        return 'active'
                                                    except Exception as sql_exec_e:
                                                        error_msg = str(sql_exec_e).lower()
                                                        if any(keyword in error_msg for keyword in ["capacity", "paused", "inactive", "suspended", "unavailable", "timeout", "connection", "login", "authentication"]):
                                                            return 'inactive'
                                                        else:
                                                            return 'active'
                                                else:
                                                    # Traditional SQL Server endpoint - try to parse connection string
                                                    server = conn_str.split('Server=')[1].split(';')[0] if 'Server=' in conn_str else None
                                                    database = conn_str.split('Database=')[1].split(';')[0] if 'Database=' in conn_str else None
                                                    
                                                    if server and database:
                                                        cols, rows = await exec_query(server, database, 1433, "SELECT 1")
                                                        return 'active'
                                                    else:
                                                        return 'active'  # Assume active if we can't test
                                            except Exception as sql_exec_e:
                                                error_msg = str(sql_exec_e).lower()
                                                if any(keyword in error_msg for keyword in ["capacity", "paused", "inactive", "suspended", "unavailable", "timeout", "connection"]):
                                                    return 'inactive'
                                                else:
                                                    return 'active'
                                        else:
                                            return 'inactive'
                                    else:
                                        return 'inactive'
                                except Exception as sql_e:
                                    # Check if this is a capacity-related error
                                    error_msg = str(sql_e).lower()
                                    if any(keyword in error_msg for keyword in ["capacity", "paused", "inactive", "suspended", "unavailable"]):
                                        return 'inactive'
                                    else:
                                        return 'active'
                                
                                return 'active' if items_data is not None else 'inactive'
                            except Exception as e:
                                return 'inactive'
                        else:
                            # Traditional SQL Server endpoint - try to parse connection string
                            server = conn_str.split('Server=')[1].split(';')[0] if 'Server=' in conn_str else None
                            database = conn_str.split('Database=')[1].split(';')[0] if 'Database=' in conn_str else None
                            
                            if server and database:
                                try:
                                    from sql.odbc import exec_query
                                    cols, rows = await exec_query(server, database, 1433, "SELECT 1")
                                    return 'active'
                                except Exception as sql_e:
                                    error_msg = str(sql_e).lower()
                                    if any(keyword in error_msg for keyword in ["capacity", "paused", "inactive", "suspended", "unavailable", "timeout"]):
                                        return 'inactive'
                                    else:
                                        return 'active'  # Other SQL errors, assume active
                            else:
                                return 'active'  # Can't parse connection string, assume active
                    else:
                        return 'inactive'
                else:
                    return 'active'  # No SQL endpoints, but workspace is accessible
            else:
                return 'inactive'
    except Exception as e:
        error_msg = str(e).lower()
        # Check for capacity-related errors
        if any(keyword in error_msg for keyword in ["capacity", "paused", "inactive", "suspended", "unavailable"]):
            return 'inactive'
        # For other errors, assume active but log the issue
        return 'active'

async def list_workspaces() -> List[Dict[str, Any]]:
    token = broker.token(FABRIC_SCOPES)
    items: List[Dict[str, Any]] = []
    params: Dict[str, Any] = {}
    
    async with httpx.AsyncClient(base_url=str(settings.fabric_base), timeout=30) as c:
        # First, get all workspaces
        while True:
            data = await _get_json(c, "workspaces", params=params, token=token)
            items.extend(data.get("value", []))
            ct = data.get("continuationToken")
            if not ct:
                break
            params["continuationToken"] = ct
        
        # Then, check availability for each workspace
        detailed_workspaces = []
        for workspace in items:
            try:
                # Get detailed workspace info
                detail_data = await _get_json(c, f"workspaces/{workspace['id']}", token=token)
                if detail_data:
                    workspace.update(detail_data)
                
                # Check workspace availability
                workspace['state'] = await check_workspace_availability(workspace['id'])
                
            except Exception as e:
                # If we can't get details, check availability directly
                workspace['state'] = await check_workspace_availability(workspace['id'])
            
            detailed_workspaces.append(workspace)
    
    return detailed_workspaces

async def list_workspaces_live() -> List[Dict[str, Any]]:
    """Directly call Fabric with retry. Use cache-first at the tool layer."""
    token = broker.token(FABRIC_SCOPES)
    items: List[Dict[str, Any]] = []
    params: Dict[str, str] = {}
    timeout = httpx.Timeout(settings.fabric_http_timeout)
    async with httpx.AsyncClient(base_url=str(settings.fabric_base), timeout=timeout) as c:
        while True:
            data = await _get_json_retry(c, "workspaces", params=params, token=token)
            items.extend(data.get("value", []))
            ct = data.get("continuationToken")
            if not ct:
                break
            params["continuationToken"] = ct
    return items


async def list_items(workspace_id: str, type_filter: Optional[str] = None) -> List[Dict[str, Any]]:
    token = broker.token(FABRIC_SCOPES)
    params = {"type": type_filter} if type_filter else {}
    results: List[Dict[str, Any]] = []
    async with httpx.AsyncClient(base_url=str(settings.fabric_base), timeout=30) as c:
        while True:
            data = await _get_json(c, f"workspaces/{workspace_id}/items", params=params, token=token)
            results.extend(data.get("value", []))
            ct = data.get("continuationToken")
            if not ct:
                break
            params["continuationToken"] = ct
    return results


def map_workspace(w: dict) -> dict:
    return {
        "id": w.get("id"),
        "name": w.get("displayName") or w.get("name") or "",
        "state": w.get("state", "active"),  # Default to 'active' if no state provided
        "created_by": (w.get("createdBy") or {}).get("email")
        if isinstance(w.get("createdBy"), dict)
        else w.get("createdBy"),
        "created_at": w.get("createdDateTime"),
        "last_activity_at": w.get("lastActionDateTime") or None,
        "region": w.get("region"),
        "last_synced_at": None,
    }


def map_item(workspace_id: str, it: dict) -> dict:
    return {
        "id": it.get("id"),
        "workspace_id": workspace_id,
        "type": it.get("type"),
        "name": it.get("displayName") or it.get("name"),
        "updated_at": it.get("modifiedDateTime") or it.get("createdDateTime"),
        "last_synced_at": None,
    }


# ------------------------ Authed client ------------------------

async def _authed_client() -> httpx.AsyncClient:
    token = broker.token(FABRIC_SCOPES)
    return httpx.AsyncClient(
        base_url=str(settings.fabric_base),
        timeout=30,
        headers={"Authorization": f"Bearer {token}"},
    )


async def _get_json_2xx(c: httpx.AsyncClient, path: str) -> Optional[dict]:
    r = await c.get(path)
    if r.status_code in (401, 403):
        # Usually missing delegated scope (e.g., Lakehouse.Read.All, Warehouse.Read.All, SqlEndpoint.Read.All, SQLDatabase.Read.All)
        log.warning("Fabric API %s returned %s: %s", path, r.status_code, r.text[:300])
        return None
    if r.status_code == 404:
        return None
    r.raise_for_status()
    js = r.json()
    return js if isinstance(js, dict) else None


# ------------------------ Connection resolvers ------------------------

async def get_warehouse_connection_string(workspace_id: str, warehouse_id: str) -> Optional[str]:
    """
    Tries both 'connectionString' and 'getConnectionString' variants.
    Often returns HOST-ONLY (no Database=) for Warehouses.
    """
    async with await _authed_client() as c:
        js = await _get_json_2xx(c, f"workspaces/{workspace_id}/warehouses/{warehouse_id}/connectionString")
        if js and "connectionString" in js:
            return js["connectionString"]
        js = await _get_json_2xx(c, f"workspaces/{workspace_id}/warehouses/{warehouse_id}/getConnectionString")
        if js and "connectionString" in js:
            return js["connectionString"]
    return None


async def get_sqlendpoint_connection_string(workspace_id: str, sql_endpoint_id: str) -> Optional[str]:
    """GET /v1/workspaces/{workspaceId}/sqlEndpoints/{sqlEndpointId}/connectionString"""
    token = broker.token(FABRIC_SCOPES)
    async with httpx.AsyncClient(base_url=str(settings.fabric_base), timeout=30,
                                 headers={"Authorization": f"Bearer {token}"}) as c:
        r = await c.get(f"workspaces/{workspace_id}/sqlEndpoints/{sql_endpoint_id}/connectionString")
        if r.status_code == 404:
            return None
        r.raise_for_status()
        js = r.json()
        return js.get("connectionString")


async def get_lakehouse_sql_connection_string(workspace_id: str, lakehouse_id: str) -> Optional[str]:
    """
    Lakehouse GET returns properties.sqlEndpointProperties.connectionString (host-only).
    """
    async with await _authed_client() as c:
        js = await _get_json_2xx(c, f"workspaces/{workspace_id}/lakehouses/{lakehouse_id}")
        if not js:
            return None
        props = js.get("properties") or {}
        sql_ep = props.get("sqlEndpointProperties") or {}
        return sql_ep.get("connectionString")



async def get_sqldb_properties(workspace_id: str, sqldb_id: str) -> Dict[str, Optional[str]]:
    """
    Fabric SQL Database (Preview) – try multiple shapes:
      1) /sqlDatabases/{id} -> properties.connectionString/serverFqdn/databaseName
      2) /sqlDatabases/{id}/connectionString or /getConnectionString -> { connectionString }
      3) /items/{id} -> properties.connectionString or nested sqlEndpointProperties.connectionString
    Return best-effort dict with connectionString/serverFqdn/databaseName.
    """
    async with await _authed_client() as c:
        # 1) canonical get
        js = await _get_json_2xx(c, f"workspaces/{workspace_id}/sqlDatabases/{sqldb_id}")
        props = (js or {}).get("properties") or {}
        if props.get("connectionString") or props.get("serverFqdn") or props.get("databaseName"):
            return {
                "connectionString": props.get("connectionString"),
                "serverFqdn": props.get("serverFqdn"),
                "databaseName": props.get("databaseName"),
            }

        # 2) explicit connectionString endpoints
        for suffix in ("connectionString", "getConnectionString"):
            js2 = await _get_json_2xx(c, f"workspaces/{workspace_id}/sqlDatabases/{sqldb_id}/{suffix}")
            if js2 and isinstance(js2, dict) and "connectionString" in js2:
                return {"connectionString": js2["connectionString"], "serverFqdn": None, "databaseName": None}

        # 3) generic item lookup as a last resort
        it = await _get_json_2xx(c, f"workspaces/{workspace_id}/items/{sqldb_id}")
        if it:
            # direct connectionString on item?
            if "connectionString" in it:
                return {"connectionString": it["connectionString"], "serverFqdn": None, "databaseName": None}
            # nested places
            for k in ("properties", "sqlEndpointProperties", "connection"):
                node = it.get(k) if isinstance(it.get(k), dict) else None
                if node and "connectionString" in node:
                    return {"connectionString": node["connectionString"], "serverFqdn": None, "databaseName": None}

    return {"connectionString": None, "serverFqdn": None, "databaseName": None}


def _normalize_from_connstring(cs: Optional[str]) -> Dict[str, Optional[str]]:
    """
    Accepts:
      - HOST-ONLY (e.g., 'xyz.datawarehouse.fabric.microsoft.com')
      - Full 'k=v;...' (e.g., 'Data Source=tcp:host,1433;Initial Catalog=DB;...')
    Returns {server, database, port}.
    """
    if not cs:
        return {"server": None, "database": None, "port": 1433}

    # Host-only (no '=' inside)
    if "=" not in cs:
        server = cs.strip()
        port = 1433
        if "," in server:
            host, _, port_str = server.partition(",")
            server = host
            try:
                port = int(port_str)
            except ValueError:
                port = 1433
        return {"server": server, "database": None, "port": port}

    # k=v;... string
    parts: Dict[str, str] = {}
    for kv in cs.split(";"):
        if "=" in kv:
            k, v = kv.split("=", 1)
            parts[k.strip().lower()] = v.strip()
    server = parts.get("data source") or parts.get("server")
    database = parts.get("initial catalog") or parts.get("database")
    port = 1433
    if server and "," in server:
        try:
            port = int(server.split(",", 1)[1])
        except ValueError:
            port = 1433
    return {"server": server, "database": database, "port": port}


def _fallback_db_name(item_name: Optional[str], parsed_db: Optional[str]) -> Optional[str]:
    # Fabric connection strings often omit Database=; use item name as the DB name fallback
    return parsed_db or item_name

def _dedupe_prefer_connected(rows: List[dict]) -> List[dict]:
    """
    If multiple items share the same (kind, name), keep the one that has a server/connstring.
    """
    best: Dict[Tuple[str, str], dict] = {}
    def score(r: dict) -> Tuple[int, int]:
        return (1 if r.get("server") else 0, 1 if r.get("connection_string") else 0)

    for r in rows:
        key = (r.get("kind") or "", r.get("name") or "")
        current = best.get(key)
        if current is None or score(r) > score(current):
            best[key] = r
    return list(best.values())


# ------------------------ Resolver (main entry) ------------------------

async def resolve_sql_endpoints_for_workspace(workspace_id: str) -> List[dict]:
    from datetime import datetime, timezone
    items = await list_items(workspace_id)
    rows: List[dict] = []
    now_iso = datetime.now(timezone.utc).isoformat()

    for it in items:
        it_id = it.get("id")
        it_type = (it.get("type") or "").lower()
        name = it.get("displayName") or it.get("name") or it_id
        cs = None
        kind = None

        if it_type == "warehouse":
            kind = "Warehouse"
            cs = await get_warehouse_connection_string(workspace_id, it_id)

        elif it_type in ("lakehouse", "sqlendpoint", "sqlep", "lakehousesqlendpoint"):
            # If it is explicitly an SQLEndpoint item, use the SQLEndpoint API;
            # if it's a Lakehouse, fetch its embedded SQL endpoint properties.
            if it_type == "sqlendpoint":
                kind = "SQLEndpoint"
                cs = await get_sqlendpoint_connection_string(workspace_id, it_id)
            else:
                kind = "LakehouseSqlEndpoint"
                cs = await get_lakehouse_sql_connection_string(workspace_id, it_id)

        elif it_type in ("sqldatabase", "sql database", "sqldatabasepreview"):
            kind = "SqlDatabase"
            props = await get_sqldb_properties(workspace_id, it_id)
            cs = props.get("connectionString")
            if cs:
                meta = _normalize_from_connstring(cs)
                server, database, port = meta["server"], meta["database"], meta["port"]
            else:
                # Fallback props if connstring not present
                server = props.get("serverFqdn")
                database = props.get("databaseName")
                port = 1433
            rows.append({
                "database_id": it_id,
                "workspace_id": workspace_id,
                "kind": kind,
                "name": name,
                "server": server,
                "database": _fallback_db_name(name, database),
                "port": port,
                "connection_string": cs,
                "last_synced_at": now_iso,
            })
            continue

        else:
            continue  # non-SQL items

        meta = _normalize_from_connstring(cs)
        rows.append({
            "database_id": it_id,
            "workspace_id": workspace_id,
            "kind": kind,
            "name": name,
            "server": meta["server"],
            "database": _fallback_db_name(name, meta["database"]),
            "port": meta["port"],
            "connection_string": cs,
            "last_synced_at": now_iso,
        })
    return rows
