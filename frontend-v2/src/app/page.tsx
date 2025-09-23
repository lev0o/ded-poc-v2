"use client";
import React, { useState } from "react";
import { Header, FabricExplorer, ResizableLayout } from "../components/layout";
import { ChatPanelWrapper } from "../components/chat";
import { ErrorBoundary } from "../components/common";
import { ContextItem } from "../lib/types/common";
import { AgentRunResponse } from "../lib/types/chat";
import { WorkspaceItem, DatabaseItem, SchemaItem, TableItem, ColumnItem } from "../lib/types/catalog";

export default function Page() {
  const [isCatalogRefreshing, setIsCatalogRefreshing] = useState(false);
  const [dynamicMinWidth, setDynamicMinWidth] = useState<number | undefined>(undefined);
  const [chatMinWidth, setChatMinWidth] = useState<number | undefined>(undefined);
  const [context, setContext] = useState<ContextItem[]>([]);

  const handleAgentResult = (resp: AgentRunResponse) => {
    // Handle agent results - could show charts, tables, etc.
    console.log('Agent result:', resp);
  };

  // Convert catalog item to ContextItem format
  const convertToContextItem = (item: WorkspaceItem | DatabaseItem | SchemaItem | TableItem | ColumnItem): ContextItem => {
    // Determine the type and label based on the item structure
    let label = '';
    
    if ('state' in item) {
      // Workspace item
      label = `Workspace: ${item.name}`;
    } else if ('kind' in item) {
      // Database item
      label = `Database: ${item.name} (${item.kind})`;
    } else if ('tables' in item) {
      // Schema item
      label = `Schema: ${item.name}`;
    } else if ('columns' in item) {
      // Table item
      const rowCount = 'row_count' in item && item.row_count !== null && item.row_count !== undefined 
        ? ` (${item.row_count.toLocaleString()} rows)` 
        : '';
      label = `Table: ${item.name}${rowCount}`;
    } else if ('data_type' in item) {
      // Column item
      const dataType = item.data_type;
      const constraints = [];
      if ('max_length' in item && item.max_length) constraints.push(`(${item.max_length})`);
      if ('numeric_precision' in item && item.numeric_precision) {
        const scale = 'numeric_scale' in item && item.numeric_scale ? `,${item.numeric_scale}` : '';
        constraints.push(`(${item.numeric_precision}${scale})`);
      }
      if ('is_nullable' in item && item.is_nullable === false) constraints.push('NOT NULL');
      
      label = `Column: ${item.name} - ${dataType}${constraints.join(' ')}`;
    }

    return {
      label,
      id: item.id
    };
  };

  const handleAddToContext = (item: WorkspaceItem | DatabaseItem | SchemaItem | TableItem | ColumnItem) => {
    console.log('handleAddToContext called with item:', item);
    const contextItem = convertToContextItem(item);
    console.log('Converted to context item:', contextItem);
    
    // Check if item already exists in context
    const exists = context.some(existing => existing.id === contextItem.id);
    console.log('Item exists in context:', exists);
    
    if (!exists) {
      setContext(prev => {
        const newContext = [...prev, contextItem];
        console.log('Updated context:', newContext);
        return newContext;
      });
    }
  };

  return (
    <ErrorBoundary>
      <ResizableLayout
        header={<Header />}
        leftPanel={
          <ErrorBoundary>
            <FabricExplorer 
              onRefreshStateChange={setIsCatalogRefreshing}
              onMinWidthChange={setDynamicMinWidth}
            />
          </ErrorBoundary>
        }
        centerPanel={
          <ErrorBoundary>
            <div className="h-full flex items-center justify-center relative overflow-hidden">
              {/* Subtle grid background */}
              <div className="absolute inset-0 opacity-5">
                <div className="absolute inset-0" style={{
                  backgroundImage: `
                    linear-gradient(rgba(56,189,248,0.08) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(56,189,248,0.08) 1px, transparent 1px)
                  `,
                  backgroundSize: '48px 48px'
                }} />
              </div>

              {/* Content */}
              <div className="text-center relative z-10 max-w-3xl px-6">
                <h1 className="text-5xl md:text-6xl font-extrabold tracking-wide font-primary">
                  <span className="bg-gradient-to-r from-cyan-400 via-sky-500 to-blue-600 bg-clip-text text-transparent">
                    Fabric Nexus
                  </span>
                </h1>
                <div className="w-16 h-px md:w-24 bg-gradient-to-r from-transparent via-cyan-500 to-transparent mx-auto my-5" />
                <p className="text-base md:text-lg text-[var(--color-text-secondary)]">
                  Insights on demand
                </p>

                
              </div>
            </div>
          </ErrorBoundary>
        }
        rightPanel={
          <ErrorBoundary>
            <ChatPanelWrapper
              context={context}
              onContextChange={setContext}
              onAgentResult={handleAgentResult}
              isCatalogRefreshing={isCatalogRefreshing}
              onMinWidthChange={setChatMinWidth}
            />
          </ErrorBoundary>
        }
        defaultLeftWidth={320}
        defaultRightWidth={320}
        minWidth={200}
        maxWidth={500}
        dynamicMinWidth={dynamicMinWidth}
        dynamicRightMinWidth={chatMinWidth}
      />
    </ErrorBoundary>
  );
}
