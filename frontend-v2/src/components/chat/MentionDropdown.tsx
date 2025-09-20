"use client";
import React, { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { getCatalog } from "@/lib/api/catalog";
import { ContextItem } from "@/lib/types/common";
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
function getWorkspaceStatusIcon(workspace: any) {
  const state = workspace.state?.toLowerCase();
  
  switch (state) {
    case 'active':
      return <CheckCircle size={12} className="text-green-500" />;
    case 'suspended':
      return <AlertCircle size={12} className="text-orange-500" />;
    case 'deleted':
      return <XCircle size={12} className="text-red-500" />;
    default:
      return <Clock size={12} className="text-blue-500" />;
  }
}

// Helper function to get database type icon
function getDatabaseIcon(kind: string) {
  const kindLower = kind.toLowerCase();
  
  if (kindLower.includes('sql') && kindLower.includes('endpoint')) {
    return <Server size={14} className="text-green-500" />;
  } else if (kindLower.includes('sql') && kindLower.includes('database')) {
    return <DatabaseIcon size={14} className="text-green-500" />;
  } else if (kindLower.includes('lakehouse')) {
    return <HardDrive size={14} className="text-blue-500" />;
  } else if (kindLower.includes('warehouse')) {
    return <Cloud size={14} className="text-purple-500" />;
  } else {
    return <DatabaseIcon size={14} className="text-green-500" />;
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

export function MentionDropdown({ query, onSelect, onClose, position, selectedIndex }: Props) {
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
    catalog.workspaces.forEach((ws: any) => {
      if (!query || ws.name?.toLowerCase().includes(queryLower)) {
        items.push({ label: "Workspace", id: `workspace:${ws.id}` });
      }
    });

    // Add databases
    catalog.workspaces.forEach((ws: any) => {
      ws.databases?.forEach((db: any) => {
        if (!query || db.name?.toLowerCase().includes(queryLower)) {
          items.push({ label: "SQL Database/Endpoint", id: `database:${ws.id}:${db.id}` });
        }
      });
    });

    // Add schemas
    catalog.workspaces.forEach((ws: any) => {
      ws.databases?.forEach((db: any) => {
        db.schemas?.forEach((schema: any) => {
          if (!query || schema.name?.toLowerCase().includes(queryLower)) {
            items.push({ label: "Schema", id: `schema:${ws.id}:${db.id}:${schema.name}` });
          }
        });
      });
    });

    // Add tables
    catalog.workspaces.forEach((ws: any) => {
      ws.databases?.forEach((db: any) => {
        db.schemas?.forEach((schema: any) => {
          schema.tables?.forEach((table: any) => {
            if (!query || table.name?.toLowerCase().includes(queryLower)) {
              items.push({ label: "Table", id: `table:${ws.id}:${db.id}:${schema.name}.${table.name}` });
            }
          });
        });
      });
    });

    // Add columns
    catalog.workspaces.forEach((ws: any) => {
      ws.databases?.forEach((db: any) => {
        db.schemas?.forEach((schema: any) => {
          schema.tables?.forEach((table: any) => {
            table.columns?.forEach((column: any) => {
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
      className="absolute bottom-full left-0 mb-1 z-50 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-primary)] rounded-lg shadow-lg max-h-80 overflow-y-auto w-full"
    >
      <div className="p-1.5">
        <div className="text-xs text-[var(--color-text-tertiary)] opacity-70 mb-1.5">
          {query ? `${filteredItems.length} result${filteredItems.length !== 1 ? 's' : ''} for "${query}"` : `${filteredItems.length} items available`}
        </div>
        {filteredItems.map((item, index) => (
           <button
             key={`${item.label}:${item.id}`}
             onClick={() => onSelect(item)}
             className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors flex items-center gap-1.5 ${
               index === selectedIndex 
                 ? 'bg-[var(--color-info)] text-white' 
                 : 'text-[var(--color-text-primary)] hover:bg-[var(--color-bg-elevated)]'
             }`}
           >
             {item.label === "Workspace" && <Building2 size={12} className="text-blue-500 flex-shrink-0" />}
             {item.label === "SQL Database/Endpoint" && <Server size={12} className="text-green-500 flex-shrink-0" />}
             {item.label === "Schema" && <FolderOpen size={12} className="text-red-500 flex-shrink-0" />}
             {item.label === "Table" && <Table2 size={12} className="text-purple-500 flex-shrink-0" />}
             {item.label === "Column" && <Columns size={12} className="text-orange-500 flex-shrink-0" />}
             <span className="text-xs truncate flex-1 min-w-0">{getDisplayName(item, catalog)}</span>
             <span className="text-xs opacity-60 flex-shrink-0 ml-2">{item.label}</span>
           </button>
        ))}
      </div>
    </div>
  );
}
