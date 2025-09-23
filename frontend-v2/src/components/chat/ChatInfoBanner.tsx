/**
 * Chat info banner component with capabilities information
 */

"use client";
import React from "react";

interface ChatInfoBannerProps {
  onShowInfo: () => void;
}

export function ChatInfoBanner({ onShowInfo }: ChatInfoBannerProps) {
  return (
    <div className="flex-shrink-0 bg-[var(--color-bg-elevated)] py-2 flex items-center justify-center">
      <button
        onClick={onShowInfo}
        className="text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors italic flex items-center gap-1.5"
        title="Learn about Nour's capabilities"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Click for more info
      </button>
    </div>
  );
}
