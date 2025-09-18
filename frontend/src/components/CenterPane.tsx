"use client";
import React from "react";
import { AgentRunResponse } from "@/lib/types";
import { extractTable, extractVegaSpec } from "@/lib/utils";
import DataTable from "./DataTable";
import VegaChart, { VegaChartRef } from "./VegaChart";

interface Props {
  results: AgentRunResponse[];
}

// Helper function to ensure data is serializable
function sanitizeData(data: any): any {
  if (data === null || data === undefined) return data;
  if (typeof data === 'string' || typeof data === 'number' || typeof data === 'boolean') return data;
  if (Array.isArray(data)) return data.map(sanitizeData);
  if (typeof data === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'function' || value instanceof Date || value instanceof Set || value instanceof Map) {
        continue; // Skip non-serializable values
      }
      sanitized[key] = sanitizeData(value);
    }
    return sanitized;
  }
  return data;
}

// Download functions
function downloadTableAsCSV(table: { columns: string[]; rows: (string | number | boolean | null)[][]; sql?: string }) {
  const headers = table.columns.join(',');
  const rows = table.rows.map(row => 
    row.map(value => {
      // Convert null/undefined to empty string
      if (value === null || value === undefined) {
        return '';
      }
      // Convert to string and escape CSV values that contain commas or quotes
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    }).join(',')
  );
  
  const csvContent = [headers, ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `table_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`;
  link.click();
}

// These functions will be replaced by ref-based calls

// Individual result content component
function ResultContent({ result }: { result: AgentRunResponse }) {
  const chartRef = React.useRef<VegaChartRef>(null);

  // Sanitize the data to ensure it's serializable
  const sanitizedResult = sanitizeData(result);
  const table = extractTable(sanitizedResult.messages);
  const chart = extractVegaSpec(sanitizedResult.messages);

  const handleDownloadPNG = () => {
    if (chartRef.current) {
      chartRef.current.downloadAsPNG();
    }
  };

  const handleDownloadSVG = () => {
    if (chartRef.current) {
      chartRef.current.downloadAsSVG();
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {table?.sql && (
        <section>
          <h4 className="text-sm font-bold mb-2 pb-1 text-[#f0f6fc]">SQL</h4>
          <pre className="rounded bg-[#0d1117] border border-[#30363d] p-3 overflow-auto"><code className="text-[#e6edf3]">{table.sql}</code></pre>
        </section>
      )}

      {table && (
        <section>
          <div className="flex items-center justify-between mb-2 pb-1">
            <h4 className="text-sm font-bold text-[#f0f6fc]">Data ({table.rowCount} rows)</h4>
            <button
              onClick={() => downloadTableAsCSV(table)}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] rounded text-[#e6edf3] transition-colors"
              title="Download as CSV"
            >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7,10 12,15 17,10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
              CSV
            </button>
          </div>
          <DataTable columns={table.columns} rows={table.rows} />
        </section>
      )}

      {chart && (
        <section>
          <div className="flex items-center justify-between mb-2 pb-1">
            <h4 className="text-sm font-bold text-[#f0f6fc]">Chart</h4>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDownloadPNG}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] rounded text-[#e6edf3] transition-colors"
                title="Download as PNG"
              >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                      <circle cx="8.5" cy="8.5" r="1.5"/>
                      <polyline points="21,15 16,10 5,21"/>
                    </svg>
                PNG
              </button>
              <button
                onClick={handleDownloadSVG}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] rounded text-[#e6edf3] transition-colors"
                title="Download as SVG"
              >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7,10 12,15 17,10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                SVG
              </button>
            </div>
          </div>
          <div className="rounded border border-[#30363d] overflow-auto bg-[#0d1117] inline-block">
            <VegaChart ref={chartRef} spec={sanitizeData(chart)} />
          </div>
        </section>
      )}
      </div>
      
      {/* Fixed timestamp footer */}
      <div className="flex justify-end px-4 py-1 bg-[#111419]">
        <div className="text-xs text-[#8b949e]">
          Generated at {new Date(result.finished_at).toLocaleString()}
        </div>
      </div>
    </div>
  );
}

export default function CenterPane({ results }: Props) {
  const [activeTab, setActiveTab] = React.useState(0);
  
  // Filter results that have actual data to display
  const resultsWithData = results.filter(result => {
    const sanitizedResult = sanitizeData(result);
    const table = extractTable(sanitizedResult.messages);
    const chart = extractVegaSpec(sanitizedResult.messages);
    return table || chart;
  });

  // Update active tab when new results are added
  React.useEffect(() => {
    if (resultsWithData.length > 0) {
      setActiveTab(resultsWithData.length - 1);
    }
  }, [resultsWithData.length]);

  if (resultsWithData.length === 0) {
    return (
      <div className="h-full flex items-center justify-center opacity-60">
        <div>Run a query or ask for a chart to see output here.</div>
      </div>
    );
  }

  const getTabTitle = (result: AgentRunResponse, index: number) => {
    const sanitizedResult = sanitizeData(result);
    const table = extractTable(sanitizedResult.messages);
    const chart = extractVegaSpec(sanitizedResult.messages);
    
    if (table && chart) {
      return `Query ${index + 1} (Data + Chart)`;
    } else if (table) {
      return `Query ${index + 1} (Data)`;
    } else if (chart) {
      return `Query ${index + 1} (Chart)`;
    }
    return `Query ${index + 1}`;
  };

  return (
    <div className="h-full flex flex-col bg-[#111419]">
      {/* Tab Bar */}
      <div className="flex bg-[#161b22] overflow-x-auto h-10">
        {resultsWithData.map((result, index) => (
          <button
            key={result.session_id + '-' + index}
            onClick={() => setActiveTab(index)}
            className={`
              flex items-center gap-2 px-3 py-2 text-sm font-medium whitespace-nowrap
              transition-colors duration-150 h-full
              ${activeTab === index 
                ? 'bg-[#111419] text-[#f0f6fc]' 
                : 'bg-[#0d1117] text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#21262d]'
              }
            `}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14,2 14,8 20,8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10,9 9,9 8,9"/>
            </svg>
            {getTabTitle(result, index)}
          </button>
        ))}
      </div>
      
      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {resultsWithData.map((result, index) => (
          <div
            key={result.session_id + '-' + index}
            className={`h-full ${activeTab === index ? 'block' : 'hidden'}`}
          >
            <ResultContent result={result} />
          </div>
        ))}
      </div>
    </div>
  );
}
