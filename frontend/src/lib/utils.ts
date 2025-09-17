import { AgentMessage, TablePayload, VegaSpec } from "./types";

export function tryParseJSON(text: string): unknown | null {
  try { return JSON.parse(text); } catch { return null; }
}

export function extractTable(messages: AgentMessage[]): TablePayload | null {
  // Find last tool message that looks like {columns, rows}
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.type !== "tool") continue;
    const parsed = tryParseJSON(m.content);
    if (parsed && typeof parsed === "object" && "columns" in parsed && "rows" in parsed) {
      const p = parsed as { columns: string[]; rows: unknown[][]; rowCount?: number; sql?: string };
      // coerce types carefully:
      const rows = p.rows.map(row => row.map(v => {
        if (typeof v === "string" || typeof v === "number" || typeof v === "boolean" || v === null) return v;
        // fallback stringify
        return JSON.stringify(v);
      }));
      return {
        columns: p.columns,
        rows,
        rowCount: typeof p.rowCount === "number" ? p.rowCount : rows.length,
        sql: typeof p.sql === "string" ? p.sql : undefined
      };
    }
  }
  return null;
}

export function extractVegaSpec(messages: AgentMessage[]): VegaSpec | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.type !== "tool") continue;
    const parsed = tryParseJSON(m.content);
    if (parsed && typeof parsed === "object" && "$schema" in parsed) {
      return parsed as VegaSpec;
    }
  }
  return null;
}

export function extractLastAIText(messages: AgentMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].type === "ai") return messages[i].content;
  }
  return null;
}
