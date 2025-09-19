"use client";
import React, { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { getCatalog } from "@/lib/api";
import { ContextItem, WorkspaceCatalog, Database, Schema, Table, Column } from "@/lib/types";
import { 
  Building2, 
  Database as DatabaseIcon, 
  FolderOpen, 
  Table2, 
  Columns, 
  Server,
  HardDrive,
  Cloud,
  CheckCircle, 
  AlertCircle, 
  XCircle, 
  Clock
} from "lucide-react";

interface Props {
  query: string;
  onSelect: (item: ContextItem) => void;
  onClose: () => void;
  position: { top: number; left: number };
  selectedIndex: number;
}

// Helper function to get workspace status icon
function getWorkspaceStatusIcon(workspace: WorkspaceCatalog) {
  const state = workspace.state?.toLowerCase();
  
  switch (state) {
    case 'active':
      return <CheckCircle size={12} className="text-[#3fb950]" />;
    case 'suspended':
      return <AlertCircle size={12} className="text-[#ffa657]" />;
    case 'deleted':
      return <XCircle size={12} className="text-[#f85149]" />;
    default:
      return <Clock size={12} className="text-[#58a6ff]" />;
  }
}

// Helper function to get database type icon
function getDatabaseIcon(kind: string) {
  const kindLower = kind.toLowerCase();
  
  if (kindLower.includes('sql') && kindLower.includes('endpoint')) {
    return <Server size={14} className="text-[#3fb950]" />;
  } else if (kindLower.includes('sql') && kindLower.includes('database')) {
    return <DatabaseIcon size={14} className="text-[#3fb950]" />;
  } else if (kindLower.includes('lakehouse')) {
    return <HardDrive size={14} className="text-[#58a6ff]" />;
  } else if (kindLower.includes('warehouse')) {
    return <Cloud size={14} className="text-[#a855f7]" />;
  } else {
    return <DatabaseIcon size={14} className="text-[#3fb950]" />;
  }
}

// Helper function to get display name from ID and catalog data
function getDisplayName(item: ContextItem, catalog: any): string {
  if (item.label === "Workspace") {
    // Format: workspace:workspaceId
    const parts = item.id.split(':');
    const workspaceId = parts[1];
    const workspace = catalog.workspaces.find((ws: any) => ws.id === workspaceId);
    return workspace?.name || workspaceId;
  } else if (item.label === "SQL Database/Endpoint") {
    // Format: database:workspaceId:databaseId
    const parts = item.id.split(':');
    const workspaceId = parts[1];
    const databaseId = parts[2];
    const workspace = catalog.workspaces.find((ws: any) => ws.id === workspaceId);
    const database = workspace?.databases?.find((db: any) => db.id === databaseId);
    return database?.name || databaseId;
  } else if (item.label === "Schema") {
    // Format: schema:workspaceId:databaseId:schemaName
    const parts = item.id.split(':');
    return parts[3] || item.id;
  } else if (item.label === "Table") {
    // Format: table:workspaceId:databaseId:schemaName.tableName
    const parts = item.id.split(':');
    return parts[3] || item.id;
  } else if (item.label === "Column") {
    // Format: column:workspaceId:databaseId:schemaName.tableName.columnName
    const parts = item.id.split(':');
    return parts[3] || item.id;
  }
  return item.id;
}

export default function MentionDropdown({ query, onSelect, onClose, position, selectedIndex }: Props) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: catalog } = useQuery({
    queryKey: ["catalog"],
    queryFn: getCatalog,
    staleTime: 5 * 60 * 1000,
  });

  // Filter items based on query
  const filteredItems: ContextItem[] = React.useMemo(() => {
    if (!catalog) return [];
    
    const items: ContextItem[] = [];
    const queryLower = query.toLowerCase();

    // Add workspaces
    catalog.workspaces.forEach((ws: WorkspaceCatalog) => {
      if (!query || ws.name?.toLowerCase().includes(queryLower)) {
        items.push({ label: "Workspace", id: `workspace:${ws.id}` });
      }
    });

    // Add databases
    catalog.workspaces.forEach((ws: WorkspaceCatalog) => {
      ws.databases?.forEach((db: Database) => {
        if (!query || db.name?.toLowerCase().includes(queryLower)) {
          items.push({ label: "SQL Database/Endpoint", id: `database:${ws.id}:${db.id}` });
        }
      });
    });

    // Add schemas
    catalog.workspaces.forEach((ws: WorkspaceCatalog) => {
      ws.databases?.forEach((db: Database) => {
        db.schemas?.forEach((schema: Schema) => {
          if (!query || schema.name?.toLowerCase().includes(queryLower)) {
            items.push({ label: "Schema", id: `schema:${ws.id}:${db.id}:${schema.name}` });
          }
        });
      });
    });

    // Add tables
    catalog.workspaces.forEach((ws: WorkspaceCatalog) => {
      ws.databases?.forEach((db: Database) => {
        db.schemas?.forEach((schema: Schema) => {
          schema.tables?.forEach((table: Table) => {
            if (!query || table.name?.toLowerCase().includes(queryLower)) {
              items.push({ label: "Table", id: `table:${ws.id}:${db.id}:${schema.name}.${table.name}` });
            }
          });
        });
      });
    });

    // Add columns
    catalog.workspaces.forEach((ws: WorkspaceCatalog) => {
      ws.databases?.forEach((db: Database) => {
        db.schemas?.forEach((schema: Schema) => {
          schema.tables?.forEach((table: Table) => {
            table.columns?.forEach((column: Column) => {
              if (!query || column.name?.toLowerCase().includes(queryLower)) {
                items.push({ label: "Column", id: `column:${ws.id}:${db.id}:${schema.name}.${table.name}.${column.name}` });
              }
            });
          });
        });
      });
    });

    return items; // Show all items
  }, [catalog, query]);

  // Keyboard navigation is now handled by the parent ChatPanel

  // Selected index is now managed by parent component

  // Don't auto-focus the dropdown - let the textarea keep focus for typing

  // Auto-scroll to keep selected item visible
  useEffect(() => {
    if (dropdownRef.current && filteredItems.length > 0) {
      const selectedButton = dropdownRef.current.querySelector(`button:nth-child(${selectedIndex + 2})`); // +2 because first child is the header
      if (selectedButton) {
        // Use immediate scrolling to prevent jittery behavior during rapid navigation
        selectedButton.scrollIntoView({
          behavior: 'auto',
          block: 'nearest'
        });
      }
    }
  }, [selectedIndex, filteredItems.length]);

  if (filteredItems.length === 0) {
    return null;
  }

  return (
    <div
      ref={dropdownRef}
      className="absolute bottom-full left-0 mb-1 z-50 bg-[#161b22] border border-[#30363d] rounded-lg shadow-lg max-h-80 overflow-y-auto w-full"
    >
      <div className="p-1.5">
        <div className="text-xs text-[#e6edf3] opacity-70 mb-1.5">
          {query ? `${filteredItems.length} result${filteredItems.length !== 1 ? 's' : ''} for "${query}"` : `${filteredItems.length} items available`}
        </div>
        {filteredItems.map((item, index) => (
           <button
             key={`${item.label}:${item.id}`}
             onClick={() => onSelect(item)}
             className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors flex items-center gap-1.5 ${
               index === selectedIndex 
                 ? 'bg-[#1f6feb] text-white' 
                 : 'text-[#e6edf3] hover:bg-[#21262d]'
             }`}
           >
             {item.label === "Workspace" && <Building2 size={12} className="text-[#58a6ff] flex-shrink-0" />}
             {item.label === "SQL Database/Endpoint" && <Server size={12} className="text-[#3fb950] flex-shrink-0" />}
             {item.label === "Schema" && <FolderOpen size={12} className="text-[#f85149] flex-shrink-0" />}
             {item.label === "Table" && <Table2 size={12} className="text-[#a855f7] flex-shrink-0" />}
             {item.label === "Column" && <Columns size={12} className="text-[#ffa657] flex-shrink-0" />}
             <span className="text-xs truncate flex-1 min-w-0">{getDisplayName(item, catalog)}</span>
             <span className="text-xs opacity-60 flex-shrink-0 ml-2">{item.label}</span>
           </button>
        ))}
      </div>
    </div>
  );
}
