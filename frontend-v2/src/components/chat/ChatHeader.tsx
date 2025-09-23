/**
 * Chat panel header component with title and new chat button
 */

"use client";
import React from "react";

interface ChatHeaderProps {
  onNewChat: () => void;
}

export function ChatHeader({ onNewChat }: ChatHeaderProps) {
  return (
    <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 bg-[var(--color-bg-tertiary)] h-10">
      <h2 className="text-sm font-bold text-[var(--color-text-primary)] flex items-center gap-2 whitespace-nowrap font-primary">
        <svg className="w-3 h-3 text-[var(--color-info)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        Nour - Fabric Assistant
      </h2>
      <button
        onClick={onNewChat}
        className="text-xs rounded px-2 py-1 font-medium bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] whitespace-nowrap"
      >
        New chat
      </button>
    </div>
  );
}
