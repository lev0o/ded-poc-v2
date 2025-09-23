/**
 * Chat input component with mention support and context chips
 */

"use client";
import React, { useRef, useEffect } from "react";
import { ContextItem } from "../../lib/types/common";
import { ContextChips } from "./ContextChips";
import { MentionDropdown } from "./MentionDropdown";

interface ChatInputProps {
  input: string;
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
  context: ContextItem[];
  onRemoveContext: (id: string) => void;
  mentionQuery: string;
  mentionPosition: { top: number; left: number } | null;
  showMentionDropdown: boolean;
  onMentionSelect: (item: ContextItem) => void;
  onMentionClose: () => void;
  mentionSelectedIndex: number;
  isPending: boolean;
  isCatalogRefreshing: boolean;
}

export function ChatInput({
  input,
  onInputChange,
  onKeyDown,
  onSend,
  context,
  onRemoveContext,
  mentionQuery,
  mentionPosition,
  showMentionDropdown,
  onMentionSelect,
  onMentionClose,
  mentionSelectedIndex,
  isPending,
  isCatalogRefreshing
}: ChatInputProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  return (
    <div className="p-3 flex-shrink-0">
      <div className="relative">
        <textarea
          ref={inputRef}
          value={input}
          onChange={onInputChange}
          onKeyDown={onKeyDown}
          disabled={isCatalogRefreshing}
          placeholder={isCatalogRefreshing ? "Chat disabled while refreshing catalog..." : "Ask me anything about your Fabric data... Use @ to mention specific items"}
          className={`w-full h-20 resize-none rounded border border-[var(--color-bg-elevated)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] p-2 focus:border-[var(--color-info)] focus:ring-2 focus:ring-[var(--color-info)] placeholder:text-xs placeholder:italic placeholder:text-[var(--color-text-tertiary)] ${isCatalogRefreshing ? 'opacity-60 cursor-not-allowed' : ''}`}
        />
        {showMentionDropdown && mentionPosition && (
          <MentionDropdown
            query={mentionQuery}
            onSelect={onMentionSelect}
            onClose={onMentionClose}
            position={mentionPosition}
            selectedIndex={mentionSelectedIndex}
          />
        )}
      </div>
      <div className="mt-2 flex justify-between items-center">
        <div className="flex items-center gap-2 flex-1">
          <div className="max-h-10 overflow-y-auto w-full">
            <ContextChips items={context} onRemove={onRemoveContext} />
          </div>
        </div>
        <div className="ml-3">
          <button
            disabled={isPending || !input.trim() || isCatalogRefreshing}
            onClick={onSend}
            className="w-8 h-8 rounded-full bg-[var(--color-info)] text-white disabled:opacity-60 hover:bg-[var(--color-info)]/80 shadow-sm flex items-center justify-center"
          >
            {isPending ? (
              <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" transform="rotate(90 12 12)" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
