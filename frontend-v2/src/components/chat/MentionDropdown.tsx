"use client";
import React, { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { getCatalog } from "../../lib/api/catalog";
import { ContextItem } from "../../lib/types/common";
import { getFilteredMentionItems, getContextDisplayName } from "../../lib/utils/catalogUtils";
import { CatalogData } from "../../lib/types/catalog";
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
function getWorkspaceStatusIcon(workspace: { state?: string }) {
  const state = workspace.state?.toLowerCase();
  
  switch (state) {
    case 'active':
      return <CheckCircle size={12} className="text-[var(--color-icon-status-active)]" />;
    case 'suspended':
      return <AlertCircle size={12} className="text-[var(--color-icon-status-suspended)]" />;
    case 'deleted':
      return <XCircle size={12} className="text-[var(--color-icon-status-deleted)]" />;
    default:
      return <Clock size={12} className="text-[var(--color-icon-status-unknown)]" />;
  }
}

// Helper function to get database type icon
function getDatabaseIcon(kind: string) {
  const kindLower = kind.toLowerCase();
  
  if (kindLower.includes('sql') && kindLower.includes('endpoint')) {
    return <Server size={14} className="text-[var(--color-icon-database-sql)]" />;
  } else if (kindLower.includes('sql') && kindLower.includes('database')) {
    return <DatabaseIcon size={14} className="text-[var(--color-icon-database-sql)]" />;
  } else if (kindLower.includes('lakehouse')) {
    return <HardDrive size={14} className="text-[var(--color-icon-database-lakehouse)]" />;
  } else if (kindLower.includes('warehouse')) {
    return <Cloud size={14} className="text-[var(--color-icon-database-warehouse)]" />;
  } else {
    return <DatabaseIcon size={14} className="text-[var(--color-icon-database-default)]" />;
  }
}


export function MentionDropdown({ query, onSelect, onClose, position, selectedIndex }: Props) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: catalog } = useQuery({
    queryKey: ["catalog"],
    queryFn: getCatalog,
    staleTime: 5 * 60 * 1000,
  });

  // Use the utility function for filtering items
  const filteredItems: ContextItem[] = React.useMemo(() => {
    return getFilteredMentionItems(catalog || null, query);
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
             {item.label === "Workspace" && <Building2 size={12} className="text-[var(--color-icon-workspace)] flex-shrink-0" />}
             {item.label === "SQL Database/Endpoint" && <Server size={12} className="text-[var(--color-icon-database-sql)] flex-shrink-0" />}
             {item.label === "Schema" && <FolderOpen size={12} className="text-[var(--color-icon-schema)] flex-shrink-0" />}
             {item.label === "Table" && <Table2 size={12} className="text-[var(--color-icon-table)] flex-shrink-0" />}
             {item.label === "Column" && <Columns size={12} className="text-[var(--color-icon-column)] flex-shrink-0" />}
             <span className="text-xs truncate flex-1 min-w-0">{getContextDisplayName(item, catalog || null)}</span>
             <span className="text-xs opacity-60 flex-shrink-0 ml-2">{item.label}</span>
           </button>
        ))}
      </div>
    </div>
  );
}
