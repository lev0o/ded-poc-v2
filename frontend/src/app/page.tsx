"use client";
import React, { useState } from "react";
import CatalogExplorer from "@/components/CatalogExplorer";
import CenterPane from "@/components/CenterPane";
import ChatPanel from "@/components/ChatPanel";
import { AgentRunResponse, ContextItem } from "@/lib/types";

// Helper function to ensure data is serializable
function sanitizeForSerialization(obj: any): any {
  if (obj === null || obj === undefined) { return obj; }
  if (typeof obj === 'function') { return undefined; }
  if (obj instanceof Set || obj instanceof Map || obj instanceof Date) { return undefined; }
  if (Array.isArray(obj)) { return obj.map(sanitizeForSerialization).filter(item => item !== undefined); }
  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const sanitizedValue = sanitizeForSerialization(value);
      if (sanitizedValue !== undefined) { sanitized[key] = sanitizedValue; }
    }
    return sanitized;
  }
  return obj;
}

export default function Page() {
  const [context, setContext] = useState<ContextItem[]>([]);
  const [last, setLast] = useState<AgentRunResponse | null>(null);
  const [activePane, setActivePane] = useState<'explorer' | 'chat' | 'center'>('center');

  const addContext = (item: ContextItem) => {
    setContext(prev => {
      // de-dupe by (label,id)
      const key = `${item.label}:${item.id}`;
      const exists = prev.some(p => `${p.label}:${p.id}` === key);
      return exists ? prev : [...prev, item];
    });
  };

  const handleAgentResult = (resp: AgentRunResponse) => {
    const cleanResponse = sanitizeForSerialization(resp) as AgentRunResponse;
    setLast(cleanResponse);
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#0d1117] text-[#e6edf3]">

      {/* Mobile Navigation */}
      <div className="lg:hidden flex border-b border-[#30363d] bg-[#0d1117]">
        <button
          onClick={() => setActivePane('explorer')}
          className={`flex-1 px-4 py-2 text-sm font-semibold transition-colors ${
            activePane === 'explorer'
              ? 'bg-[#1f6feb] text-[#ffffff] shadow-sm'
              : 'text-[#e6edf3] hover:text-[#f0f6fc] hover:bg-[#161b22]'
          }`}
        >
          Explorer
        </button>
        <button
          onClick={() => setActivePane('center')}
          className={`flex-1 px-4 py-2 text-sm font-semibold transition-colors ${
            activePane === 'center'
              ? 'bg-[#1f6feb] text-[#ffffff] shadow-sm'
              : 'text-[#e6edf3] hover:text-[#f0f6fc] hover:bg-[#161b22]'
          }`}
        >
          Results
        </button>
        <button
          onClick={() => setActivePane('chat')}
          className={`flex-1 px-4 py-2 text-sm font-semibold transition-colors ${
            activePane === 'chat'
              ? 'bg-[#1f6feb] text-[#ffffff] shadow-sm'
              : 'text-[#e6edf3] hover:text-[#f0f6fc] hover:bg-[#161b22]'
          }`}
        >
          Chat
        </button>
      </div>

      {/* Desktop Layout */}
      <div className="hidden lg:grid lg:grid-cols-[320px_1fr_380px] flex-1 overflow-hidden">
        <aside className="border-r border-[#30363d] bg-[#0d1117] h-full overflow-hidden">
          <CatalogExplorer />
        </aside>

        <main className="bg-[#0d1117] h-full overflow-hidden">
          <div className="h-full overflow-y-auto">
            <CenterPane last={last} />
          </div>
        </main>

        <aside className="border-l border-[#30363d] bg-[#0d1117] h-full overflow-hidden">
          <ChatPanel
            context={context}
            onContextChange={setContext}
            onAgentResult={handleAgentResult}
            onShowResults={() => setActivePane('center')}
          />
        </aside>
      </div>

      {/* Mobile Layout */}
      <div className="lg:hidden flex-1 overflow-hidden">
        {activePane === 'explorer' && (
          <div className="h-full bg-[#0d1117] overflow-hidden">
            <CatalogExplorer />
          </div>
        )}
        {activePane === 'center' && (
          <div className="h-full bg-[#0d1117] overflow-hidden">
            <div className="h-full overflow-y-auto">
              <CenterPane last={last} />
            </div>
          </div>
        )}
        {activePane === 'chat' && (
          <div className="h-full bg-[#0d1117] overflow-hidden">
            <ChatPanel
              context={context}
              onContextChange={setContext}
              onAgentResult={handleAgentResult}
              onShowResults={() => setActivePane('center')}
            />
          </div>
        )}
      </div>
    </div>
  );
}