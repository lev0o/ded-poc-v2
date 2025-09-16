"use client";
import React from "react";
import { ContextItem } from "@/lib/types";
import { 
  Building2, 
  Server, 
  FolderOpen, 
  Table2, 
  Columns 
} from "lucide-react";

interface Props {
  items: ContextItem[];
  onRemove: (id: string) => void;
}

// Helper function to get icon for different context types
function getContextIcon(label: string) {
  switch (label.toLowerCase()) {
    case "workspace":
      return <Building2 size={12} className="text-[#58a6ff]" />;
    case "sql database/endpoint":
      return <Server size={12} className="text-[#3fb950]" />;
    case "schema":
      return <FolderOpen size={12} className="text-[#f85149]" />;
    case "table":
      return <Table2 size={12} className="text-[#a855f7]" />;
    case "column":
      return <Columns size={12} className="text-[#ffa657]" />;
    default:
      return <Building2 size={12} className="text-[#58a6ff]" />;
  }
}

// Helper function to format the display text
function formatContextDisplay(item: ContextItem) {
  const { label, id } = item;
  
  // For table items, show schema.table format
  if (label === "Table" && id.includes(".")) {
    return id; // Already in schema.table format
  }
  
  // For other items, show the ID (which could be a name or GUID)
  return id;
}

// Helper function to truncate long IDs
function truncateId(id: string, maxLength: number = 20) {
  if (id.length <= maxLength) return id;
  return `${id.substring(0, maxLength - 3)}...`;
}

export default function ContextChips({ items, onRemove }: Props) {
  if (items.length === 0) {
    return (
      <div className="text-xs text-[#e6edf3] opacity-70 italic">
        No context selected. Use <span className="text-[#58a6ff] font-medium">@</span> to mention items from the catalog.
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-start gap-1 max-w-full">
      {items.map((it) => (
        <span 
          key={`${it.label}:${it.id}`} 
          className="inline-flex items-center gap-1 rounded-full bg-[#161b22] border border-[#30363d] px-2 py-0.5 text-xs shadow-sm flex-shrink-0 hover:bg-[#21262d] transition-colors"
        >
          {getContextIcon(it.label)}
          <span className="text-[#e6edf3] font-medium whitespace-nowrap">
            {truncateId(formatContextDisplay(it), 12)}
          </span>
          <button
            aria-label={`Remove ${it.label} context`}
            className="ml-0.5 rounded-full p-0.5 hover:bg-[#30363d] text-[#e6edf3] transition-colors"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRemove(it.id);
            }}
          >
            <svg className="w-2 h-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </span>
      ))}
    </div>
  );
}
