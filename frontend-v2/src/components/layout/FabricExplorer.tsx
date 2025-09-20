"use client";
import React, { useRef, useEffect, useState } from "react";
import { Building2, RefreshCw } from 'lucide-react';
import { getCatalog, refreshCatalog } from '../../lib/api/catalog';
import { CatalogTree } from './CatalogTree';
import { colors, iconSizes, spacing } from '../../lib/design';

interface FabricExplorerProps {
  onRefreshStateChange?: (isRefreshing: boolean) => void;
  onMinWidthChange?: (minWidth: number) => void;
}

export function FabricExplorer({ onRefreshStateChange, onMinWidthChange }: FabricExplorerProps) {
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [catalogData, setCatalogData] = React.useState<any>(null);
  const [error, setError] = React.useState<string | null>(null);
  const statsRef = useRef<HTMLDivElement>(null);

  const fetchCatalog = async () => {
    try {
      const data = await getCatalog();
      setCatalogData(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch catalog');
      setCatalogData(null);
    }
  };

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    onRefreshStateChange?.(true);
    
    try {
      await refreshCatalog();
      await fetchCatalog();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh catalog');
    } finally {
      setIsRefreshing(false);
      onRefreshStateChange?.(false);
    }
  };

  // Calculate minimum width based on statistics line content
  const calculateMinWidth = () => {
    if (statsRef.current) {
      // Create a temporary element to measure the natural width
      const tempElement = document.createElement('div');
      tempElement.style.position = 'absolute';
      tempElement.style.visibility = 'hidden';
      tempElement.style.whiteSpace = 'nowrap';
      tempElement.style.fontSize = '0.75rem'; // text-xs
      tempElement.style.fontFamily = 'inherit';
      
      // Get the current statistics text
      const statsText = statsRef.current.textContent || '';
      tempElement.textContent = statsText;
      
      document.body.appendChild(tempElement);
      const naturalWidth = tempElement.offsetWidth;
      document.body.removeChild(tempElement);
      
      // Add padding for the container (header padding + some buffer)
      const minWidth = Math.ceil(naturalWidth + 32); // 16px padding on each side + buffer
      onMinWidthChange?.(minWidth);
    }
  };

  // Fetch catalog on mount
  React.useEffect(() => {
    fetchCatalog();
  }, []);

  // Calculate min width when catalog data changes
  React.useEffect(() => {
    if (catalogData || error) {
      // Small delay to ensure DOM is updated
      setTimeout(calculateMinWidth, 100);
    }
  }, [catalogData, error]);

  return (
    <div className="h-full flex flex-col bg-[var(--color-bg-secondary)]">
      {/* Fixed Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 bg-[var(--color-bg-secondary)] h-10">
        <h2 className="text-xs font-semibold text-[var(--color-text-secondary)] flex items-center gap-2">
          <Building2 size={iconSizes.xs} className="text-blue-500" />
          Fabric Explorer
        </h2>

        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className={`text-xs rounded px-2 py-1 transition-colors font-medium ${
            isRefreshing
              ? `bg-[${colors.background.secondary}] text-[${colors.text.primary}] cursor-not-allowed`
              : `bg-[${colors.background.primary}] text-[${colors.text.primary}] hover:bg-[${colors.background.secondary}]`
          }`}
          title={isRefreshing ? "Refreshing..." : "Refresh catalog"}
        >
          {isRefreshing ? (
            <RefreshCw size={10} className="animate-spin" />
          ) : (
            <RefreshCw size={10} />
          )}
        </button>
      </div>

      {/* Fixed Statistics Line */}
      <div className="flex-shrink-0 bg-[var(--color-bg-elevated)] text-center py-2">
        <div ref={statsRef} className="text-xs text-[var(--color-text-tertiary)] whitespace-nowrap overflow-hidden">
          {isRefreshing ? (
            "Loading from Fabric..."
          ) : catalogData ? (
            `${catalogData.total_workspaces} workspaces • ${catalogData.total_databases} databases • ${catalogData.total_tables} tables • ${catalogData.total_columns} columns`
          ) : error ? (
            "Error loading catalog"
          ) : (
            "Loading catalog..."
          )}
        </div>
      </div>

      {/* Scrollable content with catalog tree */}
      <div className="flex-1 overflow-auto catalog-scrollbar relative">
        {error ? (
          <div className="p-3 text-red-400 text-sm">
            <div className="font-semibold mb-2">Error:</div>
            <div className="font-mono text-xs bg-red-900/20 p-2 rounded">
              {error}
            </div>
          </div>
        ) : catalogData ? (
          <CatalogTree data={catalogData.workspaces} />
        ) : (
          <div className="p-3 text-[var(--color-text-tertiary)] text-sm">Loading catalog data...</div>
        )}

        {/* Loading overlay - only covers the scrollable content area when refreshing */}
        {isRefreshing && (
          <div className="absolute inset-0 bg-[var(--color-bg-primary)]/80 backdrop-blur-sm z-10 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-[var(--color-info)] border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
      </div>
    </div>
  );
}
