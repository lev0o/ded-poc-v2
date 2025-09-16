"use client";
import React from "react";

export default function ScrollTest() {
  const generateMessages = () => {
    const messages = [];
    for (let i = 1; i <= 20; i++) {
      messages.push({
        role: i % 2 === 0 ? "user" : "assistant",
        content: `Message ${i}: This is a test message to verify scrolling behavior. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.`
      });
    }
    return messages;
  };

  const generateWideTable = () => {
    const columns = Array.from({ length: 10 }, (_, i) => `Column ${i + 1}`);
    const rows = Array.from({ length: 5 }, (_, i) => 
      Array.from({ length: 10 }, (_, j) => `Data ${i + 1}-${j + 1}`)
    );
    
    return (
      <table className="min-w-full border-collapse text-xs">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            {columns.map((col, i) => (
              <th key={i} className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="odd:bg-white even:bg-gray-50 dark:odd:bg-slate-900 dark:even:bg-slate-800">
              {row.map((cell, j) => (
                <td key={j} className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  const messages = generateMessages();

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
        <h2 className="text-lg font-semibold">Scroll Test</h2>
        <div className="text-sm text-gray-500">Testing scroll behavior</div>
      </div>

      {/* Messages Area - Fixed height container with proper scrolling */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto px-3 py-2">
          <div className="space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className={`w-full max-w-[85%] rounded px-3 py-2 ${msg.role === "user" ? "bg-sky-100 dark:bg-sky-900 ml-auto" : "bg-slate-100 dark:bg-slate-800"}`}>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <p className="mb-2 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                    {msg.content}
                  </p>
                  
                  {/* Add wide table to every 5th message */}
                  {i % 5 === 0 && (
                    <div className="overflow-x-auto mb-2 border border-gray-200 dark:border-gray-700 rounded-lg">
                      {generateWideTable()}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Input Section */}
      <div className="border-t border-slate-200 dark:border-slate-700 p-3 flex-shrink-0">
        <div className="text-xs text-slate-500 dark:text-slate-400">
          This is a test component to verify scrolling behavior
        </div>
      </div>
    </div>
  );
}
