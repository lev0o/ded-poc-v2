/**
 * Refactored Chat Panel - Main chat interface using smaller, focused components
 */

"use client";
import React, { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AgentRunRequest, AgentRunResponse } from "../../lib/types/chat";
import { ChatTurn, ContextItem } from "../../lib/types/common";
import { newAgentSession, runAgent, setAgentContext } from "../../lib/api/chat";
import { getCatalog } from "../../lib/api/catalog";
import { getFilteredMentionItems, getContextDisplayName as getDisplayName } from '../../lib/utils/catalogUtils';
import { MessageArea } from "./MessageArea";
import { ChatHeader } from "./ChatHeader";
import { ChatInfoBanner } from "./ChatInfoBanner";
import { ChatInput } from "./ChatInput";
import { ChatInfoModal } from "./ChatInfoModal";

interface Props {
  context: ContextItem[];
  onContextChange: (items: ContextItem[]) => void;
  onAgentResult: (resp: AgentRunResponse) => void;
  onShowResults?: () => void;
  isCatalogRefreshing?: boolean;
}

export function ChatPanel({ context, onContextChange, onAgentResult, onShowResults, isCatalogRefreshing = false }: Props) {
  // State management
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState<string>("");
  const [mentionQuery, setMentionQuery] = useState<string>("");
  const [mentionPosition, setMentionPosition] = useState<{ top: number; left: number } | null>(null);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionSelectedIndex, setMentionSelectedIndex] = useState(0);
  const [showInfoModal, setShowInfoModal] = useState(false);

  // Data fetching
  const { data: catalog } = useQuery({
    queryKey: ["catalog"],
    queryFn: getCatalog,
    staleTime: 5 * 60 * 1000,
  });

  // Helper function for getting display names
  const getContextDisplayName = (item: ContextItem): string => {
    return getDisplayName(item, catalog || null);
  };

  // Initialize session on mount
  useEffect(() => {
    (async () => {
      const sid = await newAgentSession();
      setSessionId(sid);
      if (context.length) await setAgentContext(sid, context);
    })();
  }, []);

  // Send message mutation
  const { mutate: send, isPending } = useMutation({
    mutationFn: async (message: string) => {
      if (!sessionId) throw new Error("No session");
      const req: AgentRunRequest = {
        session_id: sessionId,
        messages: [{ role: "user", content: message }],
        context
      };
      return await runAgent(req);
    },
    onSuccess: (resp) => {
      onAgentResult(resp);
      // Replace the "thinking" message with the actual AI response
      const ai = resp.messages.slice().reverse().find(m => m.type === "ai");
      if (ai) {
        setTurns(t => {
          const newTurns = [...t];
          if (newTurns.length > 0 && newTurns[newTurns.length - 1].content === "thinking") {
            newTurns[newTurns.length - 1] = { role: "assistant", content: ai.content };
          }
          return newTurns;
        });
        if (onShowResults) {
          onShowResults();
        }
      }
    }
  });

  // Handle sending messages
  const handleSend = () => {
    if (!input.trim()) return;
    
    const message = input.trim();
    
    // Create enhanced user message content that includes context info
    const userContent = context.length > 0 
      ? `${message}\n\n*Context: ${context.map(c => `${c.label}: ${getContextDisplayName(c)}`).join(', ')}*`
      : message;
    
    // Add user message and "thinking" placeholder
    setTurns(t => [
      ...t,
      { role: "user", content: userContent },
      { role: "assistant", content: "thinking" }
    ]);
    
    // Clear input and send request
    setInput("");
    send(message);
    onContextChange([]);
  };

  // Handle context removal
  const onRemoveContext = (id: string) => {
    const newContext = context.filter(c => c.id !== id);
    onContextChange(newContext);
    
    const contextItem = context.find(c => c.id === id);
    if (contextItem) {
      const displayName = getContextDisplayName(contextItem);
      const escapedName = displayName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const mentionRegex = new RegExp(`@${escapedName}(?=\\s|$)`, 'g');
      const newInput = input.replace(mentionRegex, '');
      setInput(newInput);
    }
    
    if (sessionId) setAgentContext(sessionId, newContext).catch(() => void 0);
  };

  // Handle input changes with mention detection
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInput(value);

    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = value.substring(0, cursorPos);
    const textAfterCursor = value.substring(cursorPos);
    
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex === -1) {
      setShowMentionDropdown(false);
      setMentionQuery("");
      return;
    }
    
    const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
    const isActivelyTyping = textAfterCursor === '' || /^\s/.test(textAfterCursor);
    
    if (!isActivelyTyping) {
      setShowMentionDropdown(false);
      setMentionQuery("");
      return;
    }
    
    // Check if this matches an existing context item (more robust check)
    const isExistingMention = context.some(item => {
      const displayName = getContextDisplayName(item);
      // Check if the text after @ exactly matches the display name
      return textAfterAt === displayName || textAfterAt.startsWith(displayName + ' ');
    });
    
    if (isExistingMention) {
      setShowMentionDropdown(false);
      setMentionQuery("");
      return;
    }
    
    // Only show dropdown if we're actively typing a new mention
    setMentionQuery(textAfterAt);
    const rect = e.target.getBoundingClientRect();
    setMentionPosition({
      top: rect.bottom + 4,
      left: rect.left
    });
    setShowMentionDropdown(true);
  };

  // Handle mention selection
  const handleMentionSelect = (item: ContextItem) => {
    // Find the last @ symbol in the input
    const lastAtIndex = input.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      // Find where the mention query starts (after @)
      const mentionStart = lastAtIndex + 1;
      const beforeAt = input.substring(0, lastAtIndex);
      const afterMention = input.substring(mentionStart + mentionQuery.length);
      
      const displayName = getContextDisplayName(item);
      const newInput = beforeAt + `@${displayName} ` + afterMention;
      
      setInput(newInput);
      setShowMentionDropdown(false);
      setMentionQuery("");
      
      const existingContext = context.find(c => c.id === item.id);
      if (!existingContext) {
        onContextChange([...context, item]);
      }
    }
  };

  // Handle mention dropdown close
  const handleMentionClose = () => {
    setShowMentionDropdown(false);
    setMentionQuery("");
    setMentionSelectedIndex(0);
  };

  // Reset selected index when mention query changes
  useEffect(() => {
    setMentionSelectedIndex(0);
  }, [mentionQuery]);

  // Handle keyboard events
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      
      if (showMentionDropdown && mentionPosition) {
        const filteredItems = catalog ? getFilteredMentionItems(catalog, mentionQuery) : [];
        if (filteredItems[mentionSelectedIndex]) {
          handleMentionSelect(filteredItems[mentionSelectedIndex]);
        }
        return;
      }
      
      if (input.trim() && !isPending && !isCatalogRefreshing) {
        handleSend();
      }
      return;
    }
    
    if (showMentionDropdown && mentionPosition) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const filteredCount = catalog ? getFilteredMentionItems(catalog, mentionQuery).length : 0;
        setMentionSelectedIndex(prev => Math.min(prev + 1, filteredCount - 1));
        return;
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionSelectedIndex(prev => Math.max(prev - 1, 0));
        return;
      }
    }
    
    // Handle Backspace for mention deletion
    if (e.key === 'Backspace') {
      const textarea = e.currentTarget;
      const cursorPos = textarea.selectionStart;
      const textBeforeCursor = input.substring(0, cursorPos);
      const textAfterCursor = input.substring(cursorPos);
      
      // Only handle if cursor is at end or followed by space
      if (textAfterCursor === '' || textAfterCursor.startsWith(' ')) {
        // Find complete mentions at the end of text
        for (const contextItem of context) {
          const displayName = getContextDisplayName(contextItem);
          const mentionPattern = `@${displayName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`;
          const regex = new RegExp(mentionPattern);
          const match = textBeforeCursor.match(regex);
          
          if (match) {
            e.preventDefault();
            // Remove the entire @ mention
            const beforeMention = textBeforeCursor.substring(0, match.index);
            const newInput = beforeMention + textAfterCursor;
            
            setInput(newInput);
            
            // Remove the corresponding context chip
            const newContext = context.filter(c => c.id !== contextItem.id);
            onContextChange(newContext);
            
            // Keep backend in sync
            if (sessionId) setAgentContext(sessionId, newContext).catch(() => void 0);
            
            // Set cursor position after deletion
            setTimeout(() => {
              textarea.setSelectionRange(beforeMention.length, beforeMention.length);
            }, 0);
            break;
          }
        }
      }
    }
  };

  // Handle new chat
  const onNewChat = async () => {
    const sid = await newAgentSession();
    setSessionId(sid);
    setTurns([]);
    if (context.length) await setAgentContext(sid, context);
  };

  return (
    <div className="flex h-full flex-col bg-[var(--color-bg-secondary)]">
      <ChatHeader onNewChat={onNewChat} />
      <ChatInfoBanner onShowInfo={() => setShowInfoModal(true)} />
      
      <div className="flex-1 overflow-hidden">
        <MessageArea turns={turns} />
      </div>

      <ChatInput
        input={input}
        onInputChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onSend={handleSend}
        context={context}
        onRemoveContext={onRemoveContext}
        mentionQuery={mentionQuery}
        mentionPosition={mentionPosition}
        showMentionDropdown={showMentionDropdown}
        onMentionSelect={handleMentionSelect}
        onMentionClose={handleMentionClose}
        mentionSelectedIndex={mentionSelectedIndex}
        isPending={isPending}
        isCatalogRefreshing={isCatalogRefreshing}
      />

      <ChatInfoModal 
        isOpen={showInfoModal} 
        onClose={() => setShowInfoModal(false)} 
      />
    </div>
  );
}