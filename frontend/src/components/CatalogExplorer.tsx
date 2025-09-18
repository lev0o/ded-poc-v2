"use client";
import React, { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { getCatalog, refreshCatalog, refreshActiveCatalog } from "@/lib/api";
import { ContextItem, WorkspaceCatalog, Database, Schema, Table, Column } from "@/lib/types";
import { 
  Building2, 
  Database as DatabaseIcon, 
  FolderOpen, 
  Table2, 
  Columns, 
  RefreshCw, 
  ChevronDown, 
  ChevronRight, 
  CheckCircle, 
  AlertCircle, 
  AlertTriangle,
  XCircle, 
  Clock,
  ChevronDown as DropdownIcon,
  Server,
  HardDrive,
  Cloud,
  Waves,
  Warehouse,
  Database as DatabaseIcon2
} from "lucide-react";

interface Props {
  // No longer needed since we removed @ add buttons
}

// Helper function to get workspace status icon and styling
function getWorkspaceStatus(workspace: WorkspaceCatalog) {
  const state = workspace.state?.toLowerCase();
  
  switch (state) {
    case 'active':
      return {
        icon: <CheckCircle size={12} className="text-[#3fb950]" />,
        className: "text-[#e6edf3]",
        title: "Active workspace"
      };
    case 'inactive':
      return {
        icon: <AlertTriangle size={12} className="text-[#f85149]" />,
        className: "text-[#e6edf3] opacity-60",
        title: "Workspace capacity is paused or inactive"
      };
    case 'suspended':
      return {
        icon: <AlertCircle size={12} className="text-[#ffa657]" />,
        className: "text-[#e6edf3] opacity-60",
        title: "Suspended workspace"
      };
    case 'deleted':
      return {
        icon: <XCircle size={12} className="text-[#f85149]" />,
        className: "text-[#e6edf3] opacity-40",
        title: "Deleted workspace"
      };
    default:
      return {
        icon: <Clock size={12} className="text-[#58a6ff]" />,
        className: "text-[#e6edf3] opacity-80",
        title: "Unknown workspace status"
      };
  }
}

// Helper function to get database type icon
function getDatabaseIcon(kind: string) {
  const kindLower = kind.toLowerCase();
  
  if (kindLower.includes('sql') && kindLower.includes('endpoint')) {
    // All SQL endpoints use Server icon, but with different colors based on type
    if (kindLower.includes('lakehouse') || kindLower.includes('lake')) {
      return <Server size={14} className="text-[#58a6ff]" />; // Blue for lakehouse endpoints
    } else if (kindLower.includes('warehouse') || kindLower.includes('datawarehouse') || kindLower.includes('data warehouse')) {
      return <Server size={14} className="text-[#f97316]" />; // Orange for warehouse endpoints
    } else {
      return <Server size={14} className="text-[#3fb950]" />; // Green for traditional SQL endpoints
    }
  } else if (kindLower.includes('sql') && kindLower.includes('database')) {
    return <DatabaseIcon2 size={14} className="text-[#3fb950]" />;
  } else if (kindLower.includes('lakehouse') || kindLower.includes('lake')) {
    return <Waves size={14} className="text-[#58a6ff]" />;
  } else if (kindLower.includes('warehouse')) {
    return <Warehouse size={14} className="text-[#f97316]" />;
  } else if (kindLower.includes('datawarehouse') || kindLower.includes('data warehouse')) {
    return <Cloud size={14} className="text-[#8b5cf6]" />;
  } else {
    return <DatabaseIcon size={14} className="text-[#6b7280]" />;
  }
}

// Helper function to group databases and their SQL endpoints
function groupDatabasesAndEndpoints(databases: Database[]) {
  const grouped: { [key: string]: { database: Database; endpoints: Database[] } } = {};
  
  databases.forEach(db => {
    const kindLower = db.kind.toLowerCase();
    
    if (kindLower.includes('sql') && kindLower.includes('endpoint')) {
      // This is a SQL endpoint - find its parent database
      const baseName = db.name?.replace(/\s+SQL\s+Endpoint$/i, '') || db.name;
      const parentKey = baseName || db.id;
      
      if (!grouped[parentKey]) {
        // Create a placeholder database entry
        grouped[parentKey] = {
          database: {
            ...db,
            name: baseName || `Database ${db.id.substring(0, 8)}`,
            kind: kindLower.includes('lakehouse') ? 'Lakehouse' : 
                  kindLower.includes('warehouse') ? 'Warehouse' : 'SQL Database'
          },
          endpoints: []
        };
      }
      grouped[parentKey].endpoints.push(db);
    } else {
      // This is a regular database
      const key = db.name || db.id;
      if (!grouped[key]) {
        grouped[key] = { database: db, endpoints: [] };
      }
    }
  });
  
  return Object.values(grouped);
}

type Expanded = {
  [workspaceId: string]: boolean;
};

type ExpandedDb = {
  [key: string]: boolean; // `${wsId}:${dbId}`
};

type ExpandedEndpoint = {
  [key: string]: boolean; // `${wsId}:${endpointId}`
};

type ExpandedSchema = {
  [key: string]: boolean; // `${wsId}:${dbId}:${schema}`
};

type ExpandedTable = {
  [key: string]: boolean; // `${wsId}:${dbId}:${schema}:${table}`
};

export default function CatalogExplorer({}: Props) {
  const [expanded, setExpanded] = useState<Expanded>({});
  const [expandedDb, setExpandedDb] = useState<ExpandedDb>({});
  const [expandedEndpoint, setExpandedEndpoint] = useState<ExpandedEndpoint>({});
  const [expandedSchema, setExpandedSchema] = useState<ExpandedSchema>({});
  const [expandedTable, setExpandedTable] = useState<ExpandedTable>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: catalog, isLoading, error, refetch } = useQuery({
    queryKey: ["catalog"],
    queryFn: getCatalog,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  const toggleWs = (id: string) => setExpanded(s => ({ ...s, [id]: !s[id] }));
  const toggleDb = (wsId: string, dbId: string) => setExpandedDb(s => {
    const k = `${wsId}:${dbId}`;
    return { ...s, [k]: !s[k] };
  });
  const toggleEndpoint = (wsId: string, endpointId: string) => setExpandedEndpoint(s => {
    const k = `${wsId}:${endpointId}`;
    return { ...s, [k]: !s[k] };
  });
  const toggleSchema = (wsId: string, dbId: string, schema: string) =>
    setExpandedSchema(s => {
      const k = `${wsId}:${dbId}:${schema}`;
      return { ...s, [k]: !s[k] };
    });
  const toggleTable = (wsId: string, dbId: string, schema: string, table: string) =>
    setExpandedTable(s => {
      const k = `${wsId}:${dbId}:${schema}:${table}`;
      return { ...s, [k]: !s[k] };
    });

  if (isLoading) {
    return (
          <div className="h-full overflow-auto bg-[#161b22] no-scrollbar-space">
        <div className="flex items-center justify-between px-3 py-2 bg-[#161b22] h-10">
          <h2 className="text-sm font-bold text-[#f0f6fc] flex items-center gap-2">
              <Building2 size={12} className="text-[#58a6ff]" />
            Fabric Explorer
          </h2>
        </div>
        <div className="bg-[#2d333b] text-center py-2">
          <div className="text-xs text-[#a8b2d1]">Loading catalog...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
          <div className="h-full overflow-auto bg-[#161b22] no-scrollbar-space">
        <div className="flex items-center justify-between px-3 py-2 bg-[#161b22] h-10">
          <h2 className="text-sm font-bold text-[#f0f6fc] flex items-center gap-2">
              <Building2 size={12} className="text-[#58a6ff]" />
            Fabric Explorer
          </h2>
        </div>
        <div className="bg-[#2d333b] text-center py-2">
          <div className="text-xs text-[#f85149]">Error loading catalog: {error.message}</div>
        </div>
      </div>
    );
  }

  if (!catalog) {
    return (
          <div className="h-full overflow-auto bg-[#161b22] no-scrollbar-space">
        <div className="flex items-center justify-between px-3 py-2 bg-[#161b22] h-10">
          <h2 className="text-sm font-bold text-[#f0f6fc] flex items-center gap-2">
              <Building2 size={12} className="text-[#58a6ff]" />
            Fabric Explorer
          </h2>
        </div>
        <div className="bg-[#2d333b] text-center py-2">
          <div className="text-xs text-[#a8b2d1]">No catalog data available</div>
        </div>
      </div>
    );
  }

  return (
        <div className="h-full overflow-auto relative bg-[#161b22] no-scrollbar-space">
      <div className="flex items-center justify-between px-3 py-2 bg-[#161b22] h-10">
        <h2 className="text-sm font-bold text-[#f0f6fc] flex items-center gap-2">
              <Building2 size={12} className="text-[#58a6ff]" />
          Fabric Explorer
        </h2>
        <div className="relative" ref={dropdownRef}>
          <div className="flex">
            {/* Main refresh button (active only) */}
            <button
              onClick={async () => {
                if (isRefreshing) return; // Prevent multiple clicks
                setIsRefreshing(true);
                try {
                  await refreshActiveCatalog();
                  await refetch();
                } catch (error) {
                  console.error('Failed to refresh active catalog:', error);
                } finally {
                  setIsRefreshing(false);
                }
              }}
              disabled={isRefreshing}
               className={`text-xs rounded-l px-2 py-1 transition-colors font-medium ${
                 isRefreshing 
                   ? 'bg-[#161b22] text-[#e6edf3] cursor-not-allowed' 
                   : 'bg-[#0d1117] text-[#e6edf3] hover:bg-[#161b22]'
               }`}
              title={isRefreshing ? "Refreshing..." : "Refresh active workspaces"}
            >
                  {isRefreshing ? (
                    <RefreshCw size={10} className="animate-spin" />
                  ) : (
                    <RefreshCw size={10} />
                  )}
            </button>
            
            {/* Dropdown button */}
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              disabled={isRefreshing}
               className={`text-xs rounded-r px-2 py-1 transition-colors font-medium ${
                 isRefreshing 
                   ? 'bg-[#161b22] text-[#e6edf3] cursor-not-allowed' 
                   : 'bg-[#0d1117] text-[#e6edf3] hover:bg-[#161b22]'
               }`}
              title="More refresh options"
            >
                  <DropdownIcon size={10} />
            </button>
          </div>
          
          {/* Dropdown menu */}
          {showDropdown && (
            <div className="absolute right-0 top-full mt-1 bg-[#161b22] border border-[#30363d] rounded shadow-lg z-10 min-w-[120px]">
              <button
                onClick={async () => {
                  if (isRefreshing) return;
                  setShowDropdown(false);
                  setIsRefreshing(true);
                  try {
                    await refreshCatalog();
                    await refetch();
                  } catch (error) {
                    console.error('Failed to refresh catalog:', error);
                  } finally {
                    setIsRefreshing(false);
                  }
                }}
                disabled={isRefreshing}
                className="w-full text-left px-3 py-2 text-xs text-[#e6edf3] hover:bg-[#0d1117] transition-colors flex items-center gap-2"
                title="Refresh all workspaces"
              >
                    <RefreshCw size={10} />
                Refresh All
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div className="bg-[#2d333b] text-center py-2">
          <div className="text-xs text-[#a8b2d1]">
            {catalog.total_workspaces} workspaces • {catalog.total_databases} databases • {catalog.total_tables} tables • {catalog.total_columns} columns
          </div>
        </div>

        <div className="space-y-0">
          {catalog.workspaces.map((ws: WorkspaceCatalog) => (
            <WorkspaceNode 
              key={ws.id} 
              ws={ws} 
              expanded={!!expanded[ws.id]} 
              onToggle={() => toggleWs(ws.id)}
            >
              {expanded[ws.id] && (
                <DatabaseList 
                  wsId={ws.id} 
                  databases={ws.databases}
                  expandedDb={expandedDb} 
                  toggleDb={toggleDb}
                  expandedEndpoint={expandedEndpoint}
                  toggleEndpoint={toggleEndpoint}
                  expandedSchema={expandedSchema} 
                  toggleSchema={toggleSchema}
                  expandedTable={expandedTable}
                  toggleTable={toggleTable}
                />
              )}
            </WorkspaceNode>
          ))}
        </div>
      </div>

      {/* Loading overlay */}
      {(isLoading || isRefreshing) && (
        <div className="absolute inset-0 bg-[#0d1117]/80 backdrop-blur-sm z-10 flex items-center justify-center">
          <div className="flex flex-col items-center space-y-2">
            <div className="w-6 h-6 border-2 border-[#1f6feb] border-t-transparent rounded-full animate-spin"></div>
            <div className="text-sm text-[#8b949e] font-medium">
              {isRefreshing ? 'Refreshing catalog...' : 'Loading catalog...'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WorkspaceNode({
  ws, expanded, onToggle, children
}: {
  ws: WorkspaceCatalog;
  expanded: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}) {
  const status = getWorkspaceStatus(ws);
  const isInactive = ws.state?.toLowerCase() === 'inactive' || ws.state?.toLowerCase() === 'suspended' || ws.state?.toLowerCase() === 'deleted';
  
  return (
    <div className={`${isInactive ? 'opacity-60' : ''}`}>
      <div className="flex items-center hover:bg-[#161b22]">
        <button 
          onClick={onToggle} 
          className={`flex items-center gap-1.5 font-medium hover:underline text-sm px-2 py-1 w-full text-left ${status.className}`}
          title={status.title}
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <Building2 size={14} className="text-[#58a6ff]" />
          {status.icon}
          <span className="truncate">{ws.name}</span>
        </button>
      </div>
      {expanded && <div className="ml-4">{children}</div>}
    </div>
  );
}

function DatabaseList({
  wsId, databases, expandedDb, toggleDb, expandedEndpoint, toggleEndpoint, expandedSchema, toggleSchema, expandedTable, toggleTable
}: {
  wsId: string;
  databases: Database[];
  expandedDb: { [k: string]: boolean };
  toggleDb: (wsId: string, dbId: string) => void;
  expandedEndpoint: { [k: string]: boolean };
  toggleEndpoint: (wsId: string, endpointId: string) => void;
  expandedSchema: { [k: string]: boolean };
  toggleSchema: (wsId: string, dbId: string, schema: string) => void;
  expandedTable: { [k: string]: boolean };
  toggleTable: (wsId: string, dbId: string, schema: string, table: string) => void;
}) {
  const grouped = groupDatabasesAndEndpoints(databases);
  
  return (
    <div>
      {grouped.map(({ database, endpoints }) => {
        const key = `${wsId}:${database.id}`;
        const open = !!expandedDb[key];
        return (
          <div key={database.id}>
            <div className="flex items-center hover:bg-[#161b22]">
              <button 
                onClick={() => toggleDb(wsId, database.id)} 
                className="flex items-center gap-1.5 hover:underline text-[#e6edf3] font-medium text-sm px-3 py-1 w-full text-left"
                title={`${database.name} (${database.kind})`}
              >
                {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                {getDatabaseIcon(database.kind)}
                <span className="truncate">{database.name}</span>
              </button>
            </div>
            {open && (
              <div className="ml-4">
                {/* Show SQL endpoints if they exist */}
                {endpoints.length > 0 && (
                  <div className="space-y-1">
                    {endpoints.map((endpoint) => {
                      const endpointKey = `${wsId}:${endpoint.id}`;
                      const endpointOpen = !!expandedEndpoint[endpointKey];
                      return (
                        <div key={endpoint.id}>
                          <div className="flex items-center hover:bg-[#161b22]">
                            <button 
                              onClick={() => toggleEndpoint(wsId, endpoint.id)} 
                              className="flex items-center gap-1.5 hover:underline text-[#e6edf3] text-sm px-3 py-1 w-full text-left"
                              title={`${endpoint.name} (${endpoint.kind})`}
                            >
                              {endpointOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                              {getDatabaseIcon(endpoint.kind)}
                              <span className="truncate">{endpoint.name}</span>
                            </button>
                          </div>
                          {endpointOpen && (
                            <SchemaList 
                              wsId={wsId} 
                              dbId={endpoint.id} 
                              schemas={endpoint.schemas}
                              expandedSchema={expandedSchema} 
                              toggleSchema={toggleSchema}
                              expandedTable={expandedTable}
                              toggleTable={toggleTable}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                
                {/* Show schemas directly if no endpoints */}
                {endpoints.length === 0 && (
                  <SchemaList 
                    wsId={wsId} 
                    dbId={database.id} 
                    schemas={database.schemas}
                    expandedSchema={expandedSchema} 
                    toggleSchema={toggleSchema}
                    expandedTable={expandedTable}
                    toggleTable={toggleTable}
                  />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SchemaList({
  wsId, dbId, schemas, expandedSchema, toggleSchema, expandedTable, toggleTable
}: {
  wsId: string;
  dbId: string;
  schemas: Schema[];
  expandedSchema: { [k: string]: boolean };
  toggleSchema: (wsId: string, dbId: string, schema: string) => void;
  expandedTable: { [k: string]: boolean };
  toggleTable: (wsId: string, dbId: string, schema: string, table: string) => void;
}) {
  return (
    <div className="ml-4">
      {schemas.map((schema: Schema) => {
        const key = `${wsId}:${dbId}:${schema.name}`;
        const open = !!expandedSchema[key];
        return (
          <div key={schema.name}>
            <div className="flex items-center hover:bg-[#161b22]">
              <button 
                onClick={() => toggleSchema(wsId, dbId, schema.name)} 
                className="flex items-center gap-1.5 hover:underline text-[#e6edf3] font-medium text-sm px-3 py-1 w-full text-left"
                title={`Schema: ${schema.name}`}
              >
                {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <FolderOpen size={14} className="text-[#f85149]" />
                <span className="truncate">{schema.name}</span>
              </button>
            </div>
            {open && (
              <TableList 
                wsId={wsId} 
                dbId={dbId} 
                schema={schema.name}
                tables={schema.tables}
                expandedTable={expandedTable}
                toggleTable={toggleTable}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function TableList({
  wsId, dbId, schema, tables, expandedTable, toggleTable
}: {
  wsId: string;
  dbId: string;
  schema: string;
  tables: Table[];
  expandedTable: { [k: string]: boolean };
  toggleTable: (wsId: string, dbId: string, schema: string, table: string) => void;
}) {
  return (
    <div className="ml-4">
      {tables.map((table: Table) => {
        const key = `${wsId}:${dbId}:${schema}:${table.name}`;
        const open = !!expandedTable[key];
        return (
          <div key={table.name}>
            <div className="flex items-center hover:bg-[#161b22]">
              <button 
                onClick={() => toggleTable(wsId, dbId, schema, table.name)} 
                className="flex items-center gap-1.5 hover:underline text-sm text-[#e6edf3] font-medium px-3 py-1 w-full text-left"
                title={`Table: ${schema}.${table.name}${table.row_count !== null ? ` (${table.row_count.toLocaleString()} rows)` : ''}`}
              >
                {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <Table2 size={14} className="text-[#a855f7]" />
                <span className="truncate">{table.name}</span>
              </button>
            </div>
            {open && (
              <ColumnList 
                columns={table.columns}
                schema={schema}
                table={table.name}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ColumnList({
  columns, schema, table
}: {
  columns: Column[];
  schema: string;
  table: string;
}) {
  return (
    <div className="ml-4">
      {columns.map((column: Column) => (
        <div 
          key={column.name} 
          className="flex items-center text-xs hover:bg-[#161b22] px-3 py-1"
          title={`Column: ${schema}.${table}.${column.name} - ${column.data_type}${column.max_length ? `(${column.max_length})` : ''}${column.numeric_precision ? `(${column.numeric_precision}${column.numeric_scale ? `,${column.numeric_scale}` : ''})` : ''}${column.is_nullable === false ? ' NOT NULL' : ''}`}
        >
          <div className="flex items-center gap-1.5">
            <Columns size={12} className="text-[#ffa657]" />
            <span className="font-mono text-xs text-[#e6edf3] font-medium">{column.name}</span>
            <span className="text-xs text-[#e6edf3] opacity-70">
              {column.data_type}
              {column.max_length && `(${column.max_length})`}
              {column.numeric_precision && `(${column.numeric_precision}${column.numeric_scale ? `,${column.numeric_scale}` : ''})`}
              {column.is_nullable === false && " NOT NULL"}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
