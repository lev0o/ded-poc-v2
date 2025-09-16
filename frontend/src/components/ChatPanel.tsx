"use client";
import React, { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AgentMessage, AgentRunRequest, AgentRunResponse, ChatTurn, ContextItem } from "@/lib/types";
import { newAgentSession, runAgent, setAgentContext } from "@/lib/api";
import ContextChips from "./ContextChips";
import MessageArea from "./MessageArea";
import MentionDropdown from "./MentionDropdown";

interface Props {
  context: ContextItem[];
  onContextChange: (items: ContextItem[]) => void;
  onAgentResult: (resp: AgentRunResponse) => void;
  onShowResults?: () => void;
}

export default function ChatPanel({ context, onContextChange, onAgentResult, onShowResults }: Props) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState<string>("");
  const [mentionQuery, setMentionQuery] = useState<string>("");
  const [mentionPosition, setMentionPosition] = useState<{ top: number; left: number } | null>(null);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);

  useEffect(() => {
    // lazy-create session on first render
    (async () => {
      const sid = await newAgentSession();
      setSessionId(sid);
      if (context.length) await setAgentContext(sid, context);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      // append user + last ai text
      const ai = resp.messages.findLast(m => m.type === "ai");
      if (ai) {
        // Create enhanced user message content that includes context info
        const userContent = context.length > 0 
          ? `${input}\n\n*Context: ${context.map(c => `${c.label} (${c.id})`).join(', ')}*`
          : input;
        
        setTurns(t => [
          ...t,
          { role: "user", content: userContent },
          { role: "assistant", content: ai.content }
        ]);
        setInput("");
        // Auto-switch to results on mobile
        if (onShowResults) {
          onShowResults();
        }
      }
    }
  });

  const handleSend = () => {
    if (!input.trim()) return;
    send(input.trim());
  };

  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  // Remove context and corresponding @ mention from text
  const onRemoveContext = (id: string) => {
    // Remove from context
    const newContext = context.filter(c => c.id !== id);
    onContextChange(newContext);
    
    // Remove @ mention from text - be more precise with regex
    const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const mentionRegex = new RegExp(`@${escapedId}\\b`, 'g');
    const newInput = input.replace(mentionRegex, '');
    setInput(newInput);
    
    // keep backend in sync if session exists
    if (sessionId) setAgentContext(sessionId, newContext).catch(() => void 0);
  };

  // Handle mention detection
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInput(value);

    // Check for @ mention
    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = value.substring(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@([^\s]*)$/);

    if (mentionMatch) {
      const query = mentionMatch[1];
      setMentionQuery(query);
      
      // Calculate position for dropdown
      const rect = e.target.getBoundingClientRect();
      setMentionPosition({
        top: rect.bottom + 4,
        left: rect.left
      });
      setShowMentionDropdown(true);
    } else {
      setShowMentionDropdown(false);
      setMentionQuery("");
    }
  };

  // Handle mention selection
  const handleMentionSelect = (item: ContextItem) => {
    const cursorPos = inputRef.current?.selectionStart || 0;
    const textBeforeCursor = input.substring(0, cursorPos);
    const textAfterCursor = input.substring(cursorPos);
    
    // Replace the @ mention with the selected item
    const beforeMention = textBeforeCursor.replace(/@[^\s]*$/, '');
    const newInput = beforeMention + `@${item.id}` + textAfterCursor;
    const newCursorPos = beforeMention.length + `@${item.id}`.length;
    
    setInput(newInput);
    setShowMentionDropdown(false);
    setMentionQuery("");
    
    // Add to context only if not already present
    const existingContext = context.find(c => c.id === item.id && c.label === item.label);
    if (!existingContext) {
      onContextChange([...context, item]);
    }
    
    // Restore cursor position
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  // Handle mention dropdown close
  const handleMentionClose = () => {
    setShowMentionDropdown(false);
    setMentionQuery("");
  };

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isPending) {
        handleSend();
      }
    }
  };

  // Handle backspace for atomic @ mention deletion
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Backspace') {
      const textarea = e.currentTarget;
      const cursorPos = textarea.selectionStart;
      const textBeforeCursor = input.substring(0, cursorPos);
      
      // Check if cursor is right after a complete @ mention
      const mentionRegex = /@([^\s]+)$/;
      const match = textBeforeCursor.match(mentionRegex);
      
      if (match) {
        // Check if this @ mention corresponds to an existing context item
        const mentionId = match[1];
        const contextItem = context.find(item => item.id === mentionId);
        
        if (contextItem) {
          e.preventDefault();
          // Remove the entire @ mention
          const beforeMention = textBeforeCursor.substring(0, match.index);
          const afterCursor = input.substring(cursorPos);
          const newInput = beforeMention + afterCursor;
          
          setInput(newInput);
          
          // Remove the corresponding context chip
          const newContext = context.filter(c => c.id !== mentionId);
          onContextChange(newContext);
          
          // Keep backend in sync
          if (sessionId) setAgentContext(sessionId, newContext).catch(() => void 0);
          
          // Set cursor position after deletion
          setTimeout(() => {
            textarea.setSelectionRange(beforeMention.length, beforeMention.length);
          }, 0);
        }
      }
    }
  };

  const onNewChat = async () => {
    const sid = await newAgentSession();
    setSessionId(sid);
    setTurns([]);
    if (context.length) await setAgentContext(sid, context);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-2 border-b border-[#30363d] flex-shrink-0">
        <h2 className="text-sm font-bold text-[#f0f6fc] flex items-center gap-2">
          <svg className="w-4 h-4 text-[#58a6ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          AI Assistant
        </h2>
        <button
          onClick={onNewChat}
          className="text-xs rounded px-2 py-1 transition-colors font-medium bg-[#21262d] text-[#e6edf3] hover:bg-[#30363d] shadow-sm"
        >
          New chat
        </button>
      </div>


      {/* Messages Area */}
      <MessageArea turns={turns} />

      {/* Input Section */}
      <div className="border-t border-[#30363d] p-3 flex-shrink-0">
        <div className="relative">
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            onKeyDown={handleKeyDown}
            placeholder="Type a message… Use @ to mention items (workspace, database, schema, table, column)."
            className="w-full h-24 resize-none rounded border border-[#30363d] bg-[#0d1117] text-[#e6edf3] p-2 focus:border-[#1f6feb] focus:ring-2 focus:ring-[#1f6feb] transition-colors"
          />
          {showMentionDropdown && mentionPosition && (
            <MentionDropdown
              query={mentionQuery}
              onSelect={handleMentionSelect}
              onClose={handleMentionClose}
              position={mentionPosition}
            />
          )}
        </div>
        <div className="mt-2 flex justify-between items-center">
          <div className="flex items-center gap-2 flex-1">
            <ContextChips items={context} onRemove={onRemoveContext} />
          </div>
          <div className="ml-3">
            <button
              disabled={isPending || !input.trim()}
              onClick={handleSend}
              className="w-8 h-8 rounded-full bg-[#1f6feb] text-white disabled:opacity-60 hover:bg-[#388bfd] transition-colors shadow-sm flex items-center justify-center"
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
    </div>
  );
}
