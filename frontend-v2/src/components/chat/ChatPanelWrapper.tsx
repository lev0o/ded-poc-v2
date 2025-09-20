"use client";
import React, { useRef, useEffect, useState } from "react";
import { ChatPanel } from "./ChatPanel";
import { ContextItem, AgentRunResponse } from "../../lib/types/common";
import { AgentRunResponse as ChatAgentRunResponse } from "../../lib/types/chat";

interface ChatPanelWrapperProps {
  context: ContextItem[];
  onContextChange: (items: ContextItem[]) => void;
  onAgentResult: (resp: AgentRunResponse) => void;
  onShowResults?: () => void;
  isCatalogRefreshing?: boolean;
  onMinWidthChange?: (minWidth: number) => void;
}

export function ChatPanelWrapper({ 
  context, 
  onContextChange, 
  onAgentResult, 
  onShowResults, 
  isCatalogRefreshing,
  onMinWidthChange 
}: ChatPanelWrapperProps) {
  const headerRef = useRef<HTMLDivElement>(null);

  // Calculate minimum width based on header content
  const calculateMinWidth = () => {
    if (headerRef.current) {
      // Create a temporary element to measure the natural width
      const tempElement = document.createElement('div');
      tempElement.style.position = 'absolute';
      tempElement.style.visibility = 'hidden';
      tempElement.style.whiteSpace = 'nowrap';
      tempElement.style.fontSize = '0.875rem'; // text-sm
      tempElement.style.fontWeight = '700'; // font-bold
      tempElement.style.fontFamily = 'inherit';
      
      // Get the header content text
      const headerText = "Nour - Fabric Assistant";
      const buttonText = "New chat";
      tempElement.textContent = `${headerText} ${buttonText}`;
      
      document.body.appendChild(tempElement);
      const naturalWidth = tempElement.offsetWidth;
      document.body.removeChild(tempElement);
      
      // Add padding for the container (px-3 on each side + gap + buffer)
      const minWidth = Math.ceil(naturalWidth + 80); // 24px padding on each side + gap + buffer
      onMinWidthChange?.(minWidth);
    }
  };

  // Calculate min width on mount
  useEffect(() => {
    calculateMinWidth();
  }, []);

  return (
    <div ref={headerRef} className="h-full">
      <ChatPanel
        context={context}
        onContextChange={onContextChange}
        onAgentResult={onAgentResult}
        onShowResults={onShowResults}
        isCatalogRefreshing={isCatalogRefreshing}
      />
    </div>
  );
}
