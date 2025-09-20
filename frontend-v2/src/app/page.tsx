"use client";
import React, { useState } from "react";
import { Header, FabricExplorer, ResizableLayout } from "../components/layout";
import { ChatPanelWrapper } from "../components/chat";
import { ErrorBoundary } from "../components/common";
import { ContextItem } from "../lib/types/common";
import { AgentRunResponse } from "../lib/types/chat";

export default function Page() {
  const [isCatalogRefreshing, setIsCatalogRefreshing] = useState(false);
  const [dynamicMinWidth, setDynamicMinWidth] = useState<number | undefined>(undefined);
  const [chatMinWidth, setChatMinWidth] = useState<number | undefined>(undefined);
  const [context, setContext] = useState<ContextItem[]>([]);

  const handleAgentResult = (resp: AgentRunResponse) => {
    // Handle agent results - could show charts, tables, etc.
    console.log('Agent result:', resp);
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
            <div className="h-full flex items-center justify-center">
                     <div className="text-center">
                       <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-4 font-primary tracking-wide">Fabric Nexus</h2>
                       <p className="text-[var(--color-text-tertiary)] mb-4">
                         AI-powered Microsoft Fabric data exploration and analysis
                       </p>
                <div className="text-sm text-[var(--color-info)] space-y-2">
                  <p>✅ Resizable layout implemented</p>
                  <p>✅ Design system integrated</p>
                  <p>✅ Modular architecture established</p>
                  <p>✅ Clean VS Code-style resizing</p>
                  <p>✅ Blue hover indicators</p>
                  <p>✅ Smooth drag interactions</p>
                  <p>✅ Error boundaries added</p>
                  <p>✅ Type safety improved</p>
                  <p>✅ Chat panel integrated</p>
                </div>
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
