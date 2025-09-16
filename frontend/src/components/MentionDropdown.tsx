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

export default function MentionDropdown({ query, onSelect, onClose, position }: Props) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: catalog } = useQuery({
    queryKey: ["catalog"],
    queryFn: getCatalog,
    staleTime: 5 * 60 * 1000,
  });

  // Filter items based on query
  const filteredItems: ContextItem[] = React.useMemo(() => {
    if (!catalog) return [];
    
    console.log('MentionDropdown catalog:', catalog); // Debug log
    const items: ContextItem[] = [];
    const queryLower = query.toLowerCase();

    // Add workspaces
    catalog.workspaces.forEach((ws: WorkspaceCatalog) => {
      console.log('Workspace:', ws.name, 'databases:', ws.databases?.length || 0);
      if (!query || ws.name?.toLowerCase().includes(queryLower)) {
        items.push({ label: "Workspace", id: ws.name || ws.id });
      }
    });

    // Add databases
    catalog.workspaces.forEach((ws: WorkspaceCatalog) => {
      ws.databases?.forEach((db: Database) => {
        console.log('Database:', db.name, 'schemas:', db.schemas?.length || 0);
        if (!query || db.name?.toLowerCase().includes(queryLower)) {
          items.push({ label: "SQL Database/Endpoint", id: db.name || db.id });
        }
      });
    });

    // Add schemas
    catalog.workspaces.forEach((ws: WorkspaceCatalog) => {
      ws.databases?.forEach((db: Database) => {
        db.schemas?.forEach((schema: Schema) => {
          console.log('Schema:', schema.name, 'tables:', schema.tables?.length || 0);
          if (!query || schema.name?.toLowerCase().includes(queryLower)) {
            items.push({ label: "Schema", id: schema.name });
          }
        });
      });
    });

    // Add tables
    catalog.workspaces.forEach((ws: WorkspaceCatalog) => {
      ws.databases?.forEach((db: Database) => {
        db.schemas?.forEach((schema: Schema) => {
          schema.tables?.forEach((table: Table) => {
            console.log('Table:', table.name, 'columns:', table.columns?.length || 0);
            if (!query || table.name?.toLowerCase().includes(queryLower)) {
              items.push({ label: "Table", id: `${schema.name}.${table.name}` });
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
                items.push({ label: "Column", id: `${schema.name}.${table.name}.${column.name}` });
              }
            });
          });
        });
      });
    });

    return items.slice(0, 10); // Limit to 10 items
  }, [catalog, query]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, filteredItems.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          onSelect(filteredItems[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [filteredItems, selectedIndex, onSelect, onClose]);

  // Reset selected index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (filteredItems.length === 0) {
    return null;
  }

  return (
    <div
      ref={dropdownRef}
      className="absolute bottom-full left-0 mb-1 z-50 bg-[#161b22] border border-[#30363d] rounded-lg shadow-lg max-h-48 overflow-y-auto min-w-[280px]"
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
            {item.label === "Workspace" && <Building2 size={12} className="text-[#58a6ff]" />}
            {item.label === "SQL Database/Endpoint" && <Server size={12} className="text-[#3fb950]" />}
            {item.label === "Schema" && <FolderOpen size={12} className="text-[#f85149]" />}
            {item.label === "Table" && <Table2 size={12} className="text-[#a855f7]" />}
            {item.label === "Column" && <Columns size={12} className="text-[#ffa657]" />}
            <span className="truncate text-xs">{item.id}</span>
            <span className="text-xs opacity-60 ml-auto">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
