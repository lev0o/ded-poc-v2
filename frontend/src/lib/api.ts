import { AgentRunRequest, AgentRunResponse, ContextItem, NewSessionResponse, SchemasResponse, TablesResponse, Workspace, SqlEndpoint, CatalogResponse } from "./types";

const BASE = process.env.NEXT_PUBLIC_BACKEND_BASE as string;

async function j<T>(r: Response): Promise<T> {
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`${r.status} ${r.statusText}: ${text}`);
  }
  return r.json() as Promise<T>;
}

export async function getWorkspaces(): Promise<Workspace[]> {
  const r = await fetch(`${BASE}/workspaces`, { cache: "no-store" });
  const data = await r.json() as { value: { id: string; name: string }[] };
  return data.value.map(w => ({ id: w.id, name: w.name }));
}

export async function getSqlDbs(workspaceId: string): Promise<SqlEndpoint[]> {
  const r = await fetch(`${BASE}/workspaces/${workspaceId}/sqldb`, { cache: "no-store" });
  const data = await r.json() as { value: SqlEndpoint[] };
  return data.value;
}

export async function getSchemas(workspaceId: string, dbId: string): Promise<SchemasResponse> {
  const r = await fetch(`${BASE}/workspaces/${workspaceId}/sqldb/${dbId}/schema`);
  return j<SchemasResponse>(r);
}

export async function getTables(workspaceId: string, dbId: string, schema: string): Promise<TablesResponse> {
  const r = await fetch(`${BASE}/workspaces/${workspaceId}/sqldb/${dbId}/schema/${encodeURIComponent(schema)}/tables`);
  return j<TablesResponse>(r);
}

export async function getCatalog(): Promise<CatalogResponse> {
  const r = await fetch(`${BASE}/catalog`, { cache: "no-store" });
  return j<CatalogResponse>(r);
}

export async function refreshCatalog(): Promise<void> {
  const r = await fetch(`${BASE}/catalog/refresh`, { method: "POST" });
  if (!r.ok) {
    throw new Error(`Failed to refresh catalog: ${r.status} ${r.statusText}`);
  }
}

export async function refreshActiveCatalog(): Promise<void> {
  const r = await fetch(`${BASE}/catalog/refresh-active`, { method: "POST" });
  if (!r.ok) {
    throw new Error(`Failed to refresh active catalog: ${r.status} ${r.statusText}`);
  }
}

export async function newAgentSession(): Promise<string> {
  const r = await fetch(`${BASE}/agent/new`, { method: "POST" });
  const data = await j<NewSessionResponse>(r);
  return data.session_id;
}

export async function setAgentContext(sessionId: string, items: ContextItem[]): Promise<ContextItem[]> {
  const r = await fetch(`${BASE}/agent/session/${sessionId}/context`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(items)
  });
  return j<ContextItem[]>(r);
}

export async function runAgent(req: AgentRunRequest): Promise<AgentRunResponse> {
  const r = await fetch(`${BASE}/agent/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  return j<AgentRunResponse>(r);
}
