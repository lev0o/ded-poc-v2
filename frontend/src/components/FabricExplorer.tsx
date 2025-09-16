"use client";
import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getCatalog, refreshCatalog } from "@/lib/api";
import { ContextItem, WorkspaceCatalog, Database, Schema, Table, Column } from "@/lib/types";

interface Props {
  onPickContext: (item: ContextItem) => void;
}

type Expanded = {
  [workspaceId: string]: boolean;
};

type ExpandedDb = {
  [key: string]: boolean; // `${wsId}:${dbId}`
};

type ExpandedSchema = {
  [key: string]: boolean; // `${wsId}:${dbId}:${schema}`
};

export default function FabricExplorer({ onPickContext }: Props) {
  const [expanded, setExpanded] = useState<Expanded>({});
  const [expandedDb, setExpandedDb] = useState<ExpandedDb>({});
  const [expandedSchema, setExpandedSchema] = useState<ExpandedSchema>({});

  const { data: catalog, isLoading, error, refetch } = useQuery({
    queryKey: ["catalog"],
    queryFn: getCatalog,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const toggleWs = (id: string) => setExpanded(s => ({ ...s, [id]: !s[id] }));
  const toggleDb = (wsId: string, dbId: string) => setExpandedDb(s => {
    const k = `${wsId}:${dbId}`;
    return { ...s, [k]: !s[k] };
  });
  const toggleSchema = (wsId: string, dbId: string, schema: string) =>
    setExpandedSchema(s => {
      const k = `${wsId}:${dbId}:${schema}`;
      return { ...s, [k]: !s[k] };
    });

  if (isLoading) {
    return (
      <div className="h-full overflow-auto p-3 space-y-3">
        <h2 className="text-lg font-semibold">Fabric explorer</h2>
        <div className="text-sm text-gray-500">Loading catalog...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full overflow-auto p-3 space-y-3">
        <h2 className="text-lg font-semibold">Fabric explorer</h2>
        <div className="text-sm text-red-500">Error loading catalog: {error.message}</div>
      </div>
    );
  }

  if (!catalog) {
    return (
      <div className="h-full overflow-auto p-3 space-y-3">
        <h2 className="text-lg font-semibold">Fabric explorer</h2>
        <div className="text-sm text-gray-500">No catalog data available</div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Fabric explorer</h2>
        <div className="flex items-center space-x-2">
          <div className="text-xs text-gray-500">
            {catalog.total_workspaces} workspaces • {catalog.total_databases} databases • {catalog.total_tables} tables • {catalog.total_columns} columns
          </div>
          <button
            onClick={async () => {
              try {
                await refreshCatalog();
                await refetch();
              } catch (error) {
                console.error('Failed to refresh catalog:', error);
              }
            }}
            className="text-xs rounded px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            title="Refresh catalog from Fabric"
          >
            ↻
          </button>
        </div>
      </div>
      <div className="text-xs opacity-70">Workspaces → SQL DB/Endpoint → Schemas → Tables</div>

      <div className="space-y-2">
        {catalog.workspaces.map((ws: WorkspaceCatalog) => (
          <WorkspaceNode key={ws.id} ws={ws} expanded={!!expanded[ws.id]} onToggle={() => toggleWs(ws.id)} onPickContext={onPickContext}>
            {expanded[ws.id] && (
              <DatabaseList wsId={ws.id} databases={ws.databases} onPickContext={onPickContext} expandedDb={expandedDb} toggleDb={toggleDb} expandedSchema={expandedSchema} toggleSchema={toggleSchema} />
            )}
          </WorkspaceNode>
        ))}
      </div>
    </div>
  );
}

function WorkspaceNode({
  ws, expanded, onToggle, children, onPickContext
}: {
  ws: WorkspaceCatalog;
  expanded: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
  onPickContext: (item: ContextItem) => void;
}) {
  return (
    <div className="rounded border border-slate-200 dark:border-slate-700">
      <div className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-800">
        <button onClick={onToggle} className="font-medium hover:underline">{expanded ? "▾" : "▸"} {ws.name}</button>
        <button
          className="text-xs rounded px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
          onClick={() => onPickContext({ label: "Workspace", id: ws.name || ws.id })}
          title={`Add workspace "${ws.name}" as context`}
        >
          @ add
        </button>
      </div>
      {expanded && <div className="p-2">{children}</div>}
    </div>
  );
}

function DatabaseList({
  wsId, databases, onPickContext, expandedDb, toggleDb, expandedSchema, toggleSchema
}: {
  wsId: string;
  databases: Database[];
  onPickContext: (item: ContextItem) => void;
  expandedDb: { [k: string]: boolean };
  toggleDb: (wsId: string, dbId: string) => void;
  expandedSchema: { [k: string]: boolean };
  toggleSchema: (wsId: string, dbId: string, schema: string) => void;
}) {
  return (
    <div className="space-y-2">
      {databases.map((db: Database) => {
        const key = `${wsId}:${db.id}`;
        const open = !!expandedDb[key];
        return (
          <div key={db.id} className="rounded border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between px-3 py-2">
              <button onClick={() => toggleDb(wsId, db.id)} className="hover:underline">
                {open ? "▾" : "▸"} {db.name} <span className="opacity-60 text-xs">({db.kind})</span>
              </button>
              <button
                className="text-xs rounded px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                onClick={() => onPickContext({ label: "SQL Database/Endpoint", id: db.name || db.id })}
                title={`Add database "${db.name}" as context`}
              >
                @ add
              </button>
            </div>
            {open && <SchemaList wsId={wsId} dbId={db.id} schemas={db.schemas} onPickContext={onPickContext} expandedSchema={expandedSchema} toggleSchema={toggleSchema} />}
          </div>
        );
      })}
    </div>
  );
}

function SchemaList({
  wsId, dbId, schemas, onPickContext, expandedSchema, toggleSchema
}: {
  wsId: string;
  dbId: string;
  schemas: Schema[];
  onPickContext: (item: ContextItem) => void;
  expandedSchema: { [k: string]: boolean };
  toggleSchema: (wsId: string, dbId: string, schema: string) => void;
}) {
  return (
    <div className="pl-3 space-y-2">
      {schemas.map((schema: Schema) => {
        const key = `${wsId}:${dbId}:${schema.name}`;
        const open = !!expandedSchema[key];
        return (
          <div key={schema.name} className="rounded border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between px-3 py-2">
              <button onClick={() => toggleSchema(wsId, dbId, schema.name)} className="hover:underline">{open ? "▾" : "▸"} {schema.name}</button>
              <button
                className="text-xs rounded px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                onClick={() => onPickContext({ label: "Schema", id: schema.name })}
                title={`Add schema "${schema.name}" as context`}
              >
                @ add
              </button>
            </div>
            {open && <TableList wsId={wsId} dbId={dbId} schema={schema.name} tables={schema.tables} onPickContext={onPickContext} />}
          </div>
        );
      })}
    </div>
  );
}

function TableList({
  wsId, dbId, schema, tables, onPickContext
}: {
  wsId: string;
  dbId: string;
  schema: string;
  tables: Table[];
  onPickContext: (item: ContextItem) => void;
}) {
  return (
    <ul className="pl-3">
      {tables.map((table: Table) => (
        <li key={table.name} className="flex items-center justify-between py-1">
          <span className="font-mono text-xs">
            {schema}.{table.name}
            {table.row_count !== null && (
              <span className="opacity-60 text-xs ml-2">({table.row_count.toLocaleString()} rows)</span>
            )}
          </span>
          <button
            className="text-xs rounded px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
            onClick={() => onPickContext({ label: "Table", id: `${schema}.${table.name}` })}
            title={`Add table "${schema}.${table.name}" as context`}
          >
            @ add
          </button>
        </li>
      ))}
    </ul>
  );
}
