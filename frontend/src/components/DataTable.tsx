"use client";
import React from "react";

interface Props {
  columns: string[];
  rows: (string | number | boolean | null)[][];
  height?: number;
}

export default function DataTable({ columns, rows, height = 380 }: Props) {
  return (
    <div className="rounded border border-[#30363d] overflow-auto shadow-sm" style={{ maxHeight: height }}>
      <table className="min-w-max text-sm border-collapse">
        <thead className="sticky top-0 bg-[#161b22] z-10">
          <tr>
            {columns.map((c) => (
              <th key={c} className="px-3 py-2 text-left font-bold border-b border-[#30363d] whitespace-nowrap text-[#f0f6fc]">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="odd:bg-[#0d1117] even:bg-[#161b22] hover:bg-[#21262d] transition-colors">
              {r.map((v, j) => (
                <td key={j} className="px-3 py-1 align-top border-b border-[#30363d] whitespace-nowrap text-[#e6edf3]">{String(v)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}