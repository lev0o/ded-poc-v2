import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import httpx


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class APITester:
    def __init__(self, base: str, workspace_id: Optional[str], database_id: Optional[str],
                 schema: Optional[str], table: Optional[str], fresh: bool):
        self.base = base.rstrip("/")
        self.ws = workspace_id
        self.db = database_id
        self.schema = schema
        self.table = table
        self.fresh = fresh
        self.results: List[Dict[str, Any]] = []

    def _log(self, method: str, path: str, status: Optional[int], ok: bool, ms: float,
             resp_snippet: Optional[str] = None, error: Optional[str] = None,
             extra: Optional[Dict[str, Any]] = None):
        entry = {
            "ts": now_iso(),
            "method": method,
            "path": path,
            "status": status,
            "ok": ok,
            "ms": round(ms, 1),
        }
        if resp_snippet is not None:
            entry["resp"] = resp_snippet
        if error:
            entry["error"] = error
        if extra:
            entry["extra"] = extra
        self.results.append(entry)

    def _call(self, method: str, path: str, **kwargs) -> Tuple[Optional[Dict[str, Any]], Optional[httpx.Response]]:
        url = f"{self.base}{path}"
        started = time.perf_counter()
        try:
            with httpx.Client(timeout=60) as c:
                r = c.request(method, url, **kwargs)
            elapsed = (time.perf_counter() - started) * 1000
            ok = 200 <= r.status_code < 300
            snippet = None
            try:
                js = r.json()
                snippet = json.dumps(js)[:500]
            except Exception:
                snippet = (r.text or "")[:500]
                js = None
            self._log(method, path, r.status_code, ok, elapsed, snippet)
            return js, r
        except Exception as e:
            elapsed = (time.perf_counter() - started) * 1000
            self._log(method, path, None, False, elapsed, error=str(e))
            return None, None

    # ------------------- test steps -------------------

    def step_workspaces(self):
        js, _ = self._call("GET", "/workspaces")
        if not js or "value" not in js:
            return
        if not self.ws:
            val = js.get("value") or []
            if val:
                self.ws = val[0]["id"]

        if self.ws:
            self._call("GET", f"/workspaces/{self.ws}")
            self._call("GET", f"/workspaces/{self.ws}/all?fresh={'1' if self.fresh else '0'}")

    def step_sqldb_list(self):
        if not self.ws:
            return
        js, _ = self._call("GET", f"/workspaces/{self.ws}/sqldb?fresh={'1' if self.fresh else '0'}")
        if not js or "value" not in js:
            return

        # choose a db with server+database if not provided
        if not self.db:
            for row in js["value"]:
                if row.get("server") and row.get("database"):
                    self.db = row["database_id"]
                    break

        # fall back to first entry
        if not self.db and js["value"]:
            self.db = js["value"][0]["database_id"]

        if self.db:
            self._call("GET", f"/workspaces/{self.ws}/sqldb/{self.db}")

    def step_schema_tables_columns(self):
        if not (self.ws and self.db):
            return

        # /schema
        js, _ = self._call("GET", f"/workspaces/{self.ws}/sqldb/{self.db}/schema")
        if not js:
            return
        schemas = js.get("schemas") or []

        # pick schema: prefer provided, then 'dbo', then first
        chosen_schema = self.schema
        if not chosen_schema:
            chosen_schema = "dbo" if "dbo" in schemas else (schemas[0] if schemas else None)
        self.schema = chosen_schema

        if not self.schema:
            return  # nothing to do

        # /schema/{schema}/tables
        js, _ = self._call("GET", f"/workspaces/{self.ws}/sqldb/{self.db}/schema/{self.schema}/tables")
        if not js:
            return
        tables = js.get("tables") or []
        # pick table: prefer provided, else first
        if not self.table and tables:
            self.table = tables[0]["table"]

        if not self.table:
            return

        # /schema/{schema}/tables/{table}/columns
        self._call("GET", f"/workspaces/{self.ws}/sqldb/{self.db}/schema/{self.schema}/tables/{self.table}/columns")

    def step_query(self):
        if not (self.ws and self.db and self.schema and self.table):
            return
        # read-only test query
        body = {"sql": f"SELECT TOP 5 * FROM [{self.schema}].[{self.table}]"}
        self._call("POST", f"/workspaces/{self.ws}/sqldb/{self.db}/query", json=body)

    def step_reload_smoke(self):
        # optional lightweight reloads just to ensure endpoints respond
        if self.ws:
            self._call("POST", f"/workspaces/{self.ws}/reload")
            self._call("POST", f"/workspaces/{self.ws}/sqldb/reload")

    # ------------------- runner -------------------

    def run(self):
        self.step_workspaces()
        self.step_sqldb_list()
        self.step_schema_tables_columns()
        self.step_query()
        self.step_reload_smoke()


def main():
    ap = argparse.ArgumentParser(description="Fabric Explorer API smoke test")
    ap.add_argument("--base", default=os.environ.get("FABRIC_EXPLORER_BASE", "http://127.0.0.1:8000"),
                    help="Base URL of the API (default: http://127.0.0.1:8000)")
    ap.add_argument("--workspace-id", help="Workspace ID to test (optional)")
    ap.add_argument("--database-id", help="Database/endpoint ID to test (optional)")
    ap.add_argument("--schema", help="Schema to use (optional)")
    ap.add_argument("--table", help="Table to use (optional)")
    ap.add_argument("--fresh", action="store_true", help="Use fresh=1 where supported")
    ap.add_argument("--out", default=None, help="Path to write JSON results (default: ./smoke_results_YYYYmmdd_HHMMSS.json)")
    args = ap.parse_args()

    tester = APITester(args.base, args.workspace_id, args.database_id, args.schema, args.table, args.fresh)
    tester.run()

    # write results
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_path = args.out or f"smoke_results_{ts}.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump({"base": args.base, "results": tester.results}, f, indent=2)
    # console summary
    total = len(tester.results)
    ok = sum(1 for r in tester.results if r["ok"])
    print(f"\n=== Smoke Test Summary ===")
    print(f"Base: {args.base}")
    print(f"Total steps: {total} | OK: {ok} | Failed: {total - ok}")
    print(f"Log: {out_path}")
    # print a compact table
    for r in tester.results:
        status = r["status"] if r["status"] is not None else "ERR"
        print(f"{r['method']:>6} {status:>3} {r['ms']:>7.1f} ms  {r['path']}")


if __name__ == "__main__":
    sys.exit(main())
