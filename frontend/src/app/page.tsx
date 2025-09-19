"use client";
import React, { useState } from "react";
import CatalogExplorer from "@/components/CatalogExplorer";
import CenterPane from "@/components/CenterPane";
import ChatPanel from "@/components/ChatPanel";
import Header from "@/components/Header";
import AccountIcon from "@/components/AccountIcon";
import ResizableLayout from "@/components/ResizableLayout";
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
  const [results, setResults] = useState<AgentRunResponse[]>([]);
  const [activePane, setActivePane] = useState<'explorer' | 'chat' | 'center'>('center');
  const [isCatalogRefreshing, setIsCatalogRefreshing] = useState(false);

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
    setResults(prev => [...prev, cleanResponse]);
  };

  return (
    <>
      {/* Desktop Layout */}
      <div className="hidden lg:block">
        <ResizableLayout
          header={<Header />}
          leftPanel={<CatalogExplorer onRefreshStateChange={setIsCatalogRefreshing} />}
          centerPanel={
            <div className="h-full overflow-y-auto">
              <CenterPane results={results} />
            </div>
          }
          rightPanel={
            <ChatPanel
              context={context}
              onContextChange={setContext}
              onAgentResult={handleAgentResult}
              onShowResults={() => setActivePane('center')}
              isCatalogRefreshing={isCatalogRefreshing}
            />
          }
          defaultLeftWidth={350}
          defaultRightWidth={350}
          minWidth={250}
          maxWidth={600}
        />
      </div>

      {/* Mobile Layout */}
      <div className="lg:hidden h-screen flex flex-col overflow-hidden bg-[#0d1117] text-[#e6edf3]">
        {/* Mobile Navigation */}
        <div className="flex bg-[#161b22] h-10">
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
          <div className="px-2 py-1">
            <AccountIcon />
          </div>
        </div>

        {/* Mobile Content */}
        <div className="flex-1 overflow-hidden">
          {activePane === 'explorer' && (
            <div className="h-full bg-[#161b22] overflow-hidden">
              <CatalogExplorer onRefreshStateChange={setIsCatalogRefreshing} />
            </div>
          )}
          {activePane === 'center' && (
            <div className="h-full bg-[#0a0d12] overflow-hidden">
              <div className="h-full overflow-y-auto">
                <CenterPane results={results} />
              </div>
            </div>
          )}
          {activePane === 'chat' && (
            <div className="h-full bg-[#161b22] overflow-hidden">
              <ChatPanel
                context={context}
                onContextChange={setContext}
                onAgentResult={handleAgentResult}
                onShowResults={() => setActivePane('center')}
                isCatalogRefreshing={isCatalogRefreshing}
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
}