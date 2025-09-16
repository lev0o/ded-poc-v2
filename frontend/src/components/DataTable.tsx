"use client";
import React from "react";

interface Props {
  columns: string[];
  rows: (string | number | boolean | null)[][];
  height?: number;
}

export default function DataTable({ columns, rows, height = 380 }: Props) {
  return (
    <div className="inline-block overflow-auto" style={{ maxHeight: height, minWidth: '300px' }}>
      <table className="text-sm border-collapse border border-[#30363d] w-full">
        <thead className="sticky top-0 bg-[#374151] z-10">
          <tr>
            {columns.map((c, index) => (
              <th 
                key={c} 
                className={`px-2 py-1.5 text-left font-semibold whitespace-nowrap text-[#f9fafb] border-b border-[#6b7280] ${
                  index < columns.length - 1 ? 'border-r border-[#6b7280]' : ''
                }`}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="odd:bg-[#111827] even:bg-[#1f2937] hover:bg-[#374151] transition-colors">
              {r.map((v, j) => (
                <td 
                  key={j} 
                  className={`px-2 py-1.5 whitespace-nowrap text-[#e5e7eb] border-b border-[#374151] ${
                    j < r.length - 1 ? 'border-r border-[#374151]' : ''
                  } ${
                    typeof v === 'number' ? 'text-right' : 'text-left'
                  }`}
                >
                  {String(v)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}