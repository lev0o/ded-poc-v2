export interface Workspace {
  id: string;
  name: string;
}

export interface SqlEndpoint {
  database_id: string;
  name: string;
  kind: string;
  server: string | null;
  database: string | null;
  port: number;
  connection_string?: string | null;
}

export interface SchemasResponse {
  schemas: string[];
  source: string;
}

export interface TablesResponse {
  tables: { schema: string; table: string }[];
  source: string;
}

export interface ColumnsResponse {
  columns: {
    name: string;
    ordinal: number | null;
    type: string | null;
    nullable: boolean | null;
    max_length: number | null;
    precision: number | null;
    scale: number | null;
  }[];
  source: string;
}

export interface Column {
  name: string;
  data_type: string | null;
  is_nullable: boolean | null;
  max_length: number | null;
  numeric_precision: number | null;
  numeric_scale: number | null;
  ordinal: number | null;
}

export interface Table {
  name: string;
  row_count: number | null;
  last_modified: string | null;
  columns: Column[];
}

export interface Schema {
  name: string;
  tables: Table[];
}

export interface Database {
  id: string;
  name: string;
  kind: string;
  server: string | null;
  database: string | null;
  port: number;
  schemas: Schema[];
}

export interface WorkspaceCatalog {
  id: string;
  name: string;
  state?: string;
  databases: Database[];
}

export interface CatalogResponse {
  workspaces: WorkspaceCatalog[];
  total_workspaces: number;
  total_databases: number;
  total_schemas: number;
  total_tables: number;
  total_columns: number;
  source: string;
}

export type Role = "user" | "assistant";

export interface ChatTurn {
  role: Role;
  content: string;
}

export interface ContextItem {
  label: string; // e.g., "Workspace", "SQL Database/Endpoint", "Schema", "Table"
  id: string;
}

export interface AgentRunRequest {
  session_id?: string | null;
  messages: ChatTurn[];
  context?: ContextItem[] | null;

  // legacy (optional)
  workspace_id?: string | null;
  database_id?: string | null;
  schema?: string | null;
  table?: string | null;

  max_steps?: number;
}

export interface AgentMessage {
  type: "system" | "human" | "ai" | "tool" | "unknown";
  content: string;
  tool_calls?: unknown[];
  name?: string | null; // when type === 'tool'
}

export interface AgentRunResponse {
  session_id?: string | null;
  steps: number;
  finished_at: string;
  messages: AgentMessage[];
  final_text?: string | null;
  final_data?: {
    columns: string[];
    rows: (string | number | boolean | null)[][];
    rowCount: number;
    sql?: string;
  } | null;
  final_chart?: {
    $schema: string;
    [key: string]: unknown;
  } | null;
}

export interface NewSessionResponse {
  session_id: string;
  created_at: string;
}

export interface TablePayload {
  columns: string[];
  rows: (string | number | boolean | null)[][];
  rowCount: number;
  sql?: string; // optional if you include it on backend
}

export interface VegaSpec {
  $schema: string;
  // minimal index signature to allow vega-lite spec; keep typed where we render
  [key: string]: unknown;
}
