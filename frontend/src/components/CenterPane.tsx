"use client";
import React from "react";
import ReactMarkdown from "react-markdown";
import { AgentRunResponse } from "@/lib/types";
import { extractLastAIText, extractTable, extractVegaSpec } from "@/lib/utils";
import DataTable from "./DataTable";
import VegaChart from "./VegaChart";

interface Props {
  last: AgentRunResponse | null;
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

export default function CenterPane({ last }: Props) {
  if (!last) {
    return (
      <div className="h-full flex items-center justify-center opacity-60">
        <div>Run a query or ask for a chart to see output here.</div>
      </div>
    );
  }

  // Sanitize the data to ensure it's serializable
  const sanitizedLast = sanitizeData(last);
  const table = extractTable(sanitizedLast.messages);
  const chart = extractVegaSpec(sanitizedLast.messages);
  const aiText = extractLastAIText(sanitizedLast.messages);


  return (
    <div className="p-4 space-y-6">
      {table?.sql && (
        <section>
          <h3 className="text-sm font-bold mb-2 text-[#f0f6fc]">SQL</h3>
          <pre className="rounded bg-[#161b22] border border-[#30363d] p-3 overflow-auto"><code className="text-[#e6edf3]">{table.sql}</code></pre>
        </section>
      )}

      {table && (
        <section>
          <h3 className="text-sm font-bold mb-2 text-[#f0f6fc]">Data ({table.rowCount} rows)</h3>
          <div className="inline-block rounded border border-[#30363d] overflow-hidden">
            <DataTable columns={table.columns} rows={table.rows} />
          </div>
        </section>
      )}

      {chart && (
        <section>
          <h3 className="text-sm font-bold mb-2 text-[#f0f6fc]">Chart</h3>
          <div className="inline-block rounded border border-[#30363d] overflow-hidden bg-[#0d1117]">
            <div className="p-3">
              <VegaChart spec={sanitizeData(chart)} />
            </div>
          </div>
        </section>
      )}

      {aiText && (
        <section>
          <h3 className="text-sm font-bold mb-2 text-[#f0f6fc]">Answer</h3>
          <div className="text-sm leading-relaxed text-[#e6edf3]">
            <ReactMarkdown 
              components={{
                // Headings
                h1: ({ children, ...props }) => (
                  <h1 className="text-lg font-bold mb-3 mt-4 text-[#f0f6fc]" {...props}>
                    {children}
                  </h1>
                ),
                h2: ({ children, ...props }) => (
                  <h2 className="text-base font-bold mb-2 mt-3 text-[#f0f6fc]" {...props}>
                    {children}
                  </h2>
                ),
                h3: ({ children, ...props }) => (
                  <h3 className="text-sm font-bold mb-2 mt-2 text-[#f0f6fc]" {...props}>
                    {children}
                  </h3>
                ),
                // Paragraphs
                p: ({ children, ...props }) => (
                  <p className="mb-2 text-sm leading-relaxed text-[#e6edf3]" {...props}>
                    {children}
                  </p>
                ),
                // Lists
                ul: ({ children, ...props }) => (
                  <ul className="mb-2 ml-4 list-disc text-sm text-[#e6edf3]" {...props}>
                    {children}
                  </ul>
                ),
                ol: ({ children, ...props }) => (
                  <ol className="mb-2 ml-4 list-decimal text-sm text-[#e6edf3]" {...props}>
                    {children}
                  </ol>
                ),
                li: ({ children, ...props }) => (
                  <li className="mb-1 text-sm text-[#e6edf3]" {...props}>
                    {children}
                  </li>
                ),
                // Code blocks
                code: ({ children, className, ...props }) => {
                  const isInline = !className?.includes('language-');
                  return isInline ? (
                    <code className="bg-[#161b22] border border-[#30363d] px-1.5 py-0.5 rounded text-xs font-mono text-[#e6edf3]" {...props}>
                      {children}
                    </code>
                  ) : (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  );
                },
                pre: ({ children, ...props }) => (
                  <pre className="bg-[#161b22] border border-[#30363d] p-3 rounded-lg overflow-x-auto text-xs font-mono text-[#e6edf3] mb-2" {...props}>
                    {children}
                  </pre>
                ),
                // Blockquotes
                blockquote: ({ children, ...props }) => (
                  <blockquote className="border-l-4 border-[#58a6ff] pl-4 italic text-sm text-[#e6edf3] mb-2" {...props}>
                    {children}
                  </blockquote>
                ),
                // Links
                a: ({ children, href, ...props }) => (
                  <a 
                    href={href} 
                    className="text-[#58a6ff] hover:text-[#79c0ff] hover:underline text-sm font-medium" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    {...props}
                  >
                    {children}
                  </a>
                ),
                // Strong/Bold
                strong: ({ children, ...props }) => (
                  <strong className="font-bold text-[#f0f6fc]" {...props}>
                    {children}
                  </strong>
                ),
                // Emphasis/Italic
                em: ({ children, ...props }) => (
                  <em className="italic text-[#e6edf3]" {...props}>
                    {children}
                  </em>
                ),
              }}
            >
              {aiText}
            </ReactMarkdown>
          </div>
        </section>
      )}
    </div>
  );
}
