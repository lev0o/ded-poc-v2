# fabric_explorer/sql/odbc.py
from typing import List, Tuple, Any, Optional
import os
from functools import lru_cache
import pyodbc
import anyio
from backend.auth.broker import sql_access_token_buffer

ACCESS_TOKEN_ATTR = 1256  # SQL_COPT_SS_ACCESS_TOKEN

@lru_cache()
def choose_driver() -> str:
    drivers = [d.strip() for d in pyodbc.drivers()]
    override = os.environ.get("ODBC_DRIVER_NAME")
    if override and override in drivers:
        return override
    for name in ("ODBC Driver 18 for SQL Server", "ODBC Driver 17 for SQL Server", "ODBC Driver 13 for SQL Server"):
        if name in drivers:
            return name
    raise RuntimeError(f"No suitable ODBC driver found. Installed: {drivers or '[]'}")

def build_conn_str(server: str, database: str, port: int = 1433) -> str:
    host = server if server.lower().startswith("tcp:") else f"tcp:{server}"
    driver = choose_driver()
    tsc = os.environ.get("SQL_TRUST_SERVER_CERT", "no").lower() in ("1", "true", "yes")
    return (
        f"DRIVER={{{driver}}};"
        f"SERVER={host},{port};"
        f"DATABASE={database};"
        "Encrypt=yes;"
        f"TrustServerCertificate={'yes' if tsc else 'no'};"
        "Connection Timeout=30;"
        # IMPORTANT: Do NOT include Authentication=... when using ACCESS_TOKEN (attr 1256)
    )

def _connect(server: str, database: str, port: int) -> pyodbc.Connection:
    conn_str = build_conn_str(server, database, port)
    token_buf = sql_access_token_buffer()  # length-prefixed UTF-16-LE
    return pyodbc.connect(conn_str, attrs_before={ACCESS_TOKEN_ATTR: token_buf})

async def exec_query(server: str, database: str, port: int, sql: str,
                     params: Optional[Tuple[Any, ...]] = None,
                     timeout: int = 60) -> Tuple[List[str], List[Tuple[Any, ...]]]:
    def _run():
        with _connect(server, database, port) as conn:
            conn.timeout = timeout
            cur = conn.cursor()
            cur.execute(sql, params or ())
            cols = [d[0] for d in cur.description] if cur.description else []
            rows = cur.fetchall() if cur.description else []
            return cols, rows
    try:
        return await anyio.to_thread.run_sync(_run)
    except pyodbc.InterfaceError as e:
        raise RuntimeError(
            f"ODBC interface error: {e}. "
            "Ensure 64-bit 'ODBC Driver 18 for SQL Server' is installed. "
            "Python sees drivers: " + str(pyodbc.drivers())
        ) from e
    except pyodbc.Error as e:
        raise RuntimeError(f"ODBC error: {e}") from e

# ---------- metadata helpers ----------
SCHEMATA_SQL = "SELECT schema_name FROM INFORMATION_SCHEMA.SCHEMATA ORDER BY schema_name;"
TABLES_SQL = """
SELECT TABLE_SCHEMA, TABLE_NAME
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_TYPE='BASE TABLE' AND TABLE_SCHEMA = ?
ORDER BY TABLE_NAME;
"""
COLUMNS_SQL = """
SELECT COLUMN_NAME, ORDINAL_POSITION, DATA_TYPE, IS_NULLABLE,
       CHARACTER_MAXIMUM_LENGTH, NUMERIC_PRECISION, NUMERIC_SCALE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
ORDER BY ORDINAL_POSITION;
"""

async def fetch_schemata(server: str, database: str, port: int) -> List[str]:
    cols, rows = await exec_query(server, database, port, SCHEMATA_SQL)
    return [r[0] for r in rows]

async def fetch_tables(server: str, database: str, port: int, schema: str) -> List[Tuple[str, str]]:
    cols, rows = await exec_query(server, database, port, TABLES_SQL, (schema,))
    return [(r[0], r[1]) for r in rows]

async def fetch_columns(server: str, database: str, port: int, schema: str, table: str) -> List[Tuple[Any, ...]]:
    cols, rows = await exec_query(server, database, port, COLUMNS_SQL, (schema, table))
    return rows
