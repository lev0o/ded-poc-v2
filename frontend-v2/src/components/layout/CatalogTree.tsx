"use client";
import React, { useState } from "react";
import { 
  Building2, 
  ChevronDown,
  ChevronRight,
  Server, 
  Database as DatabaseIcon, 
  Waves, 
  Warehouse, 
  Cloud,
  FolderOpen,
  Table2,
  Columns,
  Power,
  Pause,
  PowerOff,
  XCircle,
  Zap,
  Play,
  Clock
} from "lucide-react";
import { colors, iconSizes, spacing } from '../../lib/design';
import { 
  CatalogTreeProps, 
  TreeItemProps, 
  WorkspaceItem, 
  DatabaseItem, 
  SchemaItem, 
  TableItem, 
  ColumnItem,
  WorkspaceState,
  DatabaseKind
} from '../../lib/types/catalog';
import { ContextItem } from '../../lib/types/common';

// ============================================================================
// TYPES
// ============================================================================

interface IconConfig {
  icon: React.ComponentType<any>;
  className: string;
}

interface StatusIconConfig {
  icon: React.ComponentType<any>;
  className: string;
}

// TreeItemProps is now imported from types

// ============================================================================
// CONSTANTS
// ============================================================================

const ICON_SIZE = iconSizes.sm; // 14px
const CHEVRON_SIZE = iconSizes.sm; // 14px

// Database type icon mapping using design tokens
const DATABASE_ICONS: Record<DatabaseKind, IconConfig> = {
  'SQLEndpoint': { icon: Server, className: 'text-[var(--color-icon-database-sql)]' },
  'LakehouseSqlEndpoint': { icon: Server, className: 'text-[var(--color-icon-database-lakehouse)]' },
  'SqlDatabase': { icon: DatabaseIcon, className: 'text-[var(--color-icon-database-sql)]' },
  'Lakehouse': { icon: Waves, className: 'text-[var(--color-icon-database-lakehouse)]' },
  'Warehouse': { icon: Warehouse, className: 'text-[var(--color-icon-database-warehouse)]' },
  'DataWarehouse': { icon: Cloud, className: 'text-[var(--color-icon-database-datawarehouse)]' },
};

// Level-specific icon mapping using design tokens
const LEVEL_ICONS: Record<number, IconConfig> = {
  0: { icon: Building2, className: 'text-[var(--color-icon-workspace)]' }, // Workspaces
  2: { icon: FolderOpen, className: 'text-[var(--color-icon-schema)]' }, // Schemas
  3: { icon: Table2, className: 'text-[var(--color-icon-table)]' }, // Tables
  4: { icon: Columns, className: 'text-[var(--color-icon-column)]' }, // Columns
};

// Workspace status icon mapping using design tokens
const STATUS_ICONS: Record<WorkspaceState, StatusIconConfig> = {
  'active': { icon: Power, className: 'text-[var(--color-icon-status-active)]' },
  'inactive': { icon: Pause, className: 'text-[var(--color-icon-status-inactive)]' },
  'paused': { icon: Pause, className: 'text-[var(--color-icon-status-paused)]' },
  'suspended': { icon: PowerOff, className: 'text-[var(--color-icon-status-suspended)]' },
  'deleted': { icon: XCircle, className: 'text-[var(--color-icon-status-deleted)]' },
  'provisioning': { icon: Zap, className: 'text-[var(--color-icon-status-provisioning)]' },
  'starting': { icon: Play, className: 'text-[var(--color-icon-status-starting)]' },
  'stopping': { icon: PowerOff, className: 'text-[var(--color-icon-status-stopping)]' },
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Gets the appropriate icon configuration for a database based on its kind
 */
const getDatabaseIcon = (kind: DatabaseKind): IconConfig => {
  const kindLower = kind.toLowerCase();
  
  // Check for specific database types
  for (const [key, config] of Object.entries(DATABASE_ICONS)) {
    if (kindLower.includes(key.toLowerCase())) {
      return config;
    }
  }
  
  // Special cases for SQL endpoints
  if (kindLower.includes('sql') && kindLower.includes('endpoint')) {
    if (kindLower.includes('lakehouse')) {
      return DATABASE_ICONS.LakehouseSqlEndpoint;
    }
    if (kindLower.includes('warehouse')) {
      return { icon: Server, className: 'text-[var(--color-icon-database-warehouse)]' };
    }
    return DATABASE_ICONS.SQLEndpoint;
  }
  
  // Default fallback
  return { icon: DatabaseIcon, className: 'text-[var(--color-icon-database-default)]' };
};

/**
 * Gets the appropriate icon configuration for an item based on its level
 */
const getIconForLevel = (item: WorkspaceItem | DatabaseItem | SchemaItem | TableItem | ColumnItem, level: number): IconConfig => {
  // Level-specific icons
  if (LEVEL_ICONS[level]) {
    return LEVEL_ICONS[level];
  }
  
  // Database level (level 1) - use kind-based icon
  if (level === 1 && 'kind' in item) {
    return getDatabaseIcon(item.kind);
  }
  
  // Default fallback
  return { icon: DatabaseIcon, className: 'text-[var(--color-icon-database-default)]' };
};

/**
 * Gets the status icon configuration for a workspace state
 */
const getStatusIcon = (state: WorkspaceState): StatusIconConfig => {
  return STATUS_ICONS[state] || { icon: Clock, className: 'text-[var(--color-icon-status-unknown)]' };
};

/**
 * Gets the children array for an item based on its level
 */
const getChildren = (item: WorkspaceItem | DatabaseItem | SchemaItem | TableItem | ColumnItem, level: number): (WorkspaceItem | DatabaseItem | SchemaItem | TableItem | ColumnItem)[] => {
  const childrenMap: Record<number, string> = {
    0: 'databases',
    1: 'schemas', 
    2: 'tables',
    3: 'columns'
  };
  
  const childrenKey = childrenMap[level];
  return childrenKey ? ((item as any)[childrenKey] || []) : [];
};

/**
 * Generates a unique key for an item based on its level and parent
 */
const getItemKey = (item: WorkspaceItem | DatabaseItem | SchemaItem | TableItem | ColumnItem, level: number, parentKey: string): string => {
  const keyMap: Record<number, string> = {
    0: item.id,
    1: `${parentKey}:${item.id}`,
    2: `${parentKey}:${item.name}`,
    3: `${parentKey}:${item.name}`,
    4: `${parentKey}:${item.name}`
  };
  
  return keyMap[level] || `${parentKey}:${item.name || item.id}`;
};

/**
 * Gets the display name for an item
 */
const getItemName = (item: WorkspaceItem | DatabaseItem | SchemaItem | TableItem | ColumnItem, level: number): string => {
  return item.name || item.id;
};

/**
 * Generates a descriptive title for an item (used in tooltips)
 */
const getItemTitle = (item: WorkspaceItem | DatabaseItem | SchemaItem | TableItem | ColumnItem, level: number): string => {
  const titleMap: Record<number, string> = {
    0: `Workspace: ${item.name} (${'state' in item ? item.state : 'unknown'})`,
    1: `Database: ${item.name} (${'kind' in item ? item.kind : 'unknown'})`,
    2: `Schema: ${item.name}`,
    3: `Table: ${item.name}${'row_count' in item && item.row_count !== null && item.row_count !== undefined ? ` (${item.row_count.toLocaleString()} rows)` : ''}`,
    4: `Column: ${item.name} - ${'data_type' in item ? item.data_type : 'unknown'}${'max_length' in item && item.max_length ? `(${item.max_length})` : ''}${'numeric_precision' in item && item.numeric_precision ? `(${item.numeric_precision}${'numeric_scale' in item && item.numeric_scale ? `,${item.numeric_scale}` : ''})` : ''}${'is_nullable' in item && item.is_nullable === false ? ' NOT NULL' : ''}`
  };
  
  return titleMap[level] || item.name || item.id;
};

// ============================================================================
// COMPONENTS
// ============================================================================

/**
 * Chevron component for expandable items
 */
const ChevronIcon: React.FC<{ isExpanded: boolean; hasChildren: boolean }> = ({ 
  isExpanded, 
  hasChildren 
}) => {
  if (!hasChildren) {
    return <div style={{ width: `${CHEVRON_SIZE}px` }} />;
  }
  
  return isExpanded ? <ChevronDown size={CHEVRON_SIZE} /> : <ChevronRight size={CHEVRON_SIZE} />;
};

/**
 * Status icon component for workspaces
 */
const WorkspaceStatusIcon: React.FC<{ state: string }> = ({ state }) => {
  const statusConfig = getStatusIcon(state as WorkspaceState);
  const StatusIconComponent = statusConfig.icon;
  
  return (
    <div className="flex-shrink-0 px-1" title={`Workspace status: ${state}`}>
      <StatusIconComponent size={ICON_SIZE} className={statusConfig.className} />
    </div>
  );
};

/**
 * Individual tree item component
 */
const TreeItem: React.FC<TreeItemProps> = ({
  item,
  level,
  parentKey,
  isExpanded,
  hasChildren,
  onToggle
}) => {
  const iconConfig = getIconForLevel(item, level);
  const IconComponent = iconConfig.icon;
  
  const handleItemClick = () => {
    if (hasChildren) {
      onToggle();
    }
  };
  
  return (
    <div className="flex items-center hover:bg-[var(--color-bg-secondary)]">
      <button 
        onClick={hasChildren ? handleItemClick : undefined}
        className={`flex items-center gap-1.5 font-normal hover:underline text-xs px-2 py-1 flex-1 text-left min-w-0 ${
          hasChildren ? 'cursor-pointer' : 'cursor-default'
        }`}
        title={getItemTitle(item, level)}
        disabled={!hasChildren}
      >
        <ChevronIcon isExpanded={isExpanded} hasChildren={hasChildren} />
        <IconComponent size={ICON_SIZE} className={iconConfig.className} />
        <span className="truncate min-w-0 flex-1 text-[var(--color-text-secondary)]">{getItemName(item, level)}</span>
      </button>
      
      {/* Status icon for workspaces only */}
      {level === 0 && 'state' in item && item.state && (
        <WorkspaceStatusIcon state={item.state} />
      )}
    </div>
  );
};

/**
 * Children container component
 */
const ChildrenContainer: React.FC<{
  children: (WorkspaceItem | DatabaseItem | SchemaItem | TableItem | ColumnItem)[];
  level: number;
  parentKey: string;
  expanded: { [key: string]: boolean };
  toggleExpanded: (key: string) => void;
}> = ({ children, level, parentKey, expanded, toggleExpanded }) => {
  return (
    <div className="ml-4">
      {children.map((child: WorkspaceItem | DatabaseItem | SchemaItem | TableItem | ColumnItem, childIndex: number) => (
        <CatalogTree 
          key={getItemKey(child, level + 1, parentKey)}
          data={child} 
          level={level + 1} 
          parentKey={parentKey}
        />
      ))}
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * Recursive catalog tree component
 */
export function CatalogTree({ data, level = 0, parentKey = '' }: CatalogTreeProps) {
  const [expanded, setExpanded] = useState<{ [key: string]: boolean }>({});

  const toggleExpanded = (key: string) => {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const renderItem = (item: WorkspaceItem | DatabaseItem | SchemaItem | TableItem | ColumnItem, index: number) => {
    const itemKey = getItemKey(item, level, parentKey);
    const isExpanded = expanded[itemKey];
    const children = getChildren(item, level);
    const hasChildren = children.length > 0;
    
    return (
      <div key={itemKey}>
        <TreeItem
          item={item}
          level={level}
          parentKey={parentKey}
          isExpanded={isExpanded}
          hasChildren={hasChildren}
          onToggle={() => toggleExpanded(itemKey)}
        />
        
        {isExpanded && hasChildren && (
          <ChildrenContainer
            children={children}
            level={level}
            parentKey={itemKey}
            expanded={expanded}
            toggleExpanded={toggleExpanded}
          />
        )}
      </div>
    );
  };

  // Handle array of items (top level workspaces)
  if (Array.isArray(data)) {
    return (
      <div className="space-y-0">
        {data.map((item, index) => renderItem(item, index))}
      </div>
    );
  }

  // Handle single item (recursive calls)
  return renderItem(data, 0);
}