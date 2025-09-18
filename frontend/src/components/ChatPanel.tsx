"use client";
import React, { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AgentMessage, AgentRunRequest, AgentRunResponse, ChatTurn, ContextItem } from "@/lib/types";
import { newAgentSession, runAgent, setAgentContext } from "@/lib/api";
import ContextChips from "./ContextChips";
import MessageArea from "./MessageArea";
import MentionDropdown from "./MentionDropdown";
import { useQuery } from "@tanstack/react-query";
import { getCatalog } from "@/lib/api";
import { ShinyText } from "@appletosolutions/reactbits";

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
  const [showInfoModal, setShowInfoModal] = useState(false);

  const { data: catalog } = useQuery({
    queryKey: ["catalog"],
    queryFn: getCatalog,
    staleTime: 5 * 60 * 1000,
  });

  // Helper function to get display name for context formatting
  const getContextDisplayName = (item: ContextItem): string => {
    if (!catalog) return item.id;
    
    if (item.label === "Workspace") {
      // Format: workspace:workspaceId
      const parts = item.id.split(':');
      const workspaceId = parts[1];
      const workspace = catalog.workspaces.find((ws: any) => ws.id === workspaceId);
      return workspace?.name || workspaceId;
    } else if (item.label === "SQL Database/Endpoint") {
      // Format: database:workspaceId:databaseId
      const parts = item.id.split(':');
      const workspaceId = parts[1];
      const databaseId = parts[2];
      const workspace = catalog.workspaces.find((ws: any) => ws.id === workspaceId);
      const database = workspace?.databases?.find((db: any) => db.id === databaseId);
      return database?.name || databaseId;
    } else if (item.label === "Schema") {
      // Format: schema:workspaceId:databaseId:schemaName
      const parts = item.id.split(':');
      return parts[3] || item.id;
    } else if (item.label === "Table") {
      // Format: table:workspaceId:databaseId:schemaName.tableName
      const parts = item.id.split(':');
      return parts[3] || item.id;
    } else if (item.label === "Column") {
      // Format: column:workspaceId:databaseId:schemaName.tableName.columnName
      const parts = item.id.split(':');
      return parts[3] || item.id;
    }
    return item.id;
  };

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
      // Replace the "thinking" message with the actual AI response
      const ai = resp.messages.slice().reverse().find(m => m.type === "ai");
      if (ai) {
        setTurns(t => {
          const newTurns = [...t];
          // Replace the last "thinking" message with the actual AI response
          if (newTurns.length > 0 && newTurns[newTurns.length - 1].content === "thinking") {
            newTurns[newTurns.length - 1] = { role: "assistant", content: ai.content };
          }
          return newTurns;
        });
        // Auto-switch to results on mobile
        if (onShowResults) {
          onShowResults();
        }
      }
    }
  });

  const handleSend = () => {
    console.log('handleSend called with input:', input);
    if (!input.trim()) {
      console.log('Empty input, returning');
      return;
    }
    
    const message = input.trim();
    console.log('Sending message:', message);
    
    // Create enhanced user message content that includes context info
    const userContent = context.length > 0 
      ? `${message}\n\n*Context: ${context.map(c => `${c.label}: ${getContextDisplayName(c)}`).join(', ')}*`
      : message;
    
    // Immediately add user message and "thinking" placeholder to turns
    setTurns(t => [
      ...t,
      { role: "user", content: userContent },
      { role: "assistant", content: "thinking" }
    ]);
    
    // Clear input immediately
    setInput("");
    
    // Send the request
    send(message);
  };

  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  // Remove context and corresponding @ mention from text
  const onRemoveContext = (id: string) => {
    console.log('=== onRemoveContext ===');
    console.log('Removing ID:', id);
    console.log('Current input:', JSON.stringify(input));
    console.log('Current context:', context);
    
    // Remove from context
    const newContext = context.filter(c => c.id !== id);
    onContextChange(newContext);
    
    // Find the context item to get its display name
    const contextItem = context.find(c => c.id === id);
    console.log('Found context item:', contextItem);
    
    if (contextItem) {
      const displayName = getContextDisplayName(contextItem);
      console.log('Display name:', JSON.stringify(displayName));
      
      // Remove @ mention from text using display name
      const escapedName = displayName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      console.log('Escaped name:', escapedName);
      const mentionRegex = new RegExp(`@${escapedName}(?=\\s|$)`, 'g');
      console.log('Regex:', mentionRegex);
      const newInput = input.replace(mentionRegex, '');
      console.log('New input:', JSON.stringify(newInput));
      setInput(newInput);
    }
    
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
    
    // Look for @ at the end of the text before cursor
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      
      // Check if this looks like a mention (not part of a completed mention)
      // A mention is either:
      // 1. At the very end of text
      // 2. Followed by a space (indicating it's complete)
      // 3. Currently being typed (no space after it yet)
      
      const textAfterCursor = value.substring(cursorPos);
      const isTypingMention = textAfterCursor === '' || textAfterCursor.startsWith(' ');
      
      if (isTypingMention) {
        // Check if this matches any existing context item
        // Only check for existing mentions if there's actual text after @
        const isExistingMention = textAfterAt.length > 0 && context.some(item => {
          const displayName = getContextDisplayName(item);
          return textAfterAt === displayName || displayName.startsWith(textAfterAt);
        });
        
        if (!isExistingMention) {
          // This is a new mention being typed (including just @)
          setMentionQuery(textAfterAt);
          
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
      } else {
        setShowMentionDropdown(false);
        setMentionQuery("");
      }
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
    
    // Find the last @ in the text before cursor (the one being typed)
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      // Replace from the last @ to the cursor position
      const beforeAt = textBeforeCursor.substring(0, lastAtIndex);
      const displayName = getContextDisplayName(item);
      const newInput = beforeAt + `@${displayName}` + textAfterCursor;
      const newCursorPos = beforeAt.length + `@${displayName}`.length;
      
      setInput(newInput);
      setShowMentionDropdown(false);
      setMentionQuery("");
      
      // Add to context only if not already present
      const existingContext = context.find(c => c.id === item.id);
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
    }
  };

  // Handle mention dropdown close
  const handleMentionClose = () => {
    setShowMentionDropdown(false);
    setMentionQuery("");
  };

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    console.log('handleKeyPress called with key:', e.key);
    if (e.key === 'Enter' && !e.shiftKey) {
      console.log('Enter key detected, preventing default and calling handleSend');
      e.preventDefault();
      if (input.trim() && !isPending) {
        handleSend();
      } else {
        console.log('Not sending - input:', input.trim(), 'isPending:', isPending);
      }
    }
  };

  // Handle backspace for atomic @ mention deletion
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    console.log('handleKeyDown called with key:', e.key);
    
    // Handle Enter key
    if (e.key === 'Enter' && !e.shiftKey) {
      console.log('Enter key detected in handleKeyDown, preventing default and calling handleSend');
      e.preventDefault();
      if (input.trim() && !isPending) {
        handleSend();
      } else {
        console.log('Not sending - input:', input.trim(), 'isPending:', isPending);
      }
      return;
    }
    
    // Only handle Backspace key, let other keys pass through
    if (e.key !== 'Backspace') {
      console.log('Not Backspace or Enter, returning early');
      return;
    }

    const textarea = e.currentTarget;
    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = input.substring(0, cursorPos);
    
    // Check if cursor is right after a complete @ mention
    // Only trigger if cursor is at the very end of a mention (no characters after it)
    let bestMatch = null;
    let bestContextItem = null;
    
    // Check if cursor is at the end of the text or followed by a space
    const textAfterCursor = input.substring(cursorPos);
    const isAtEndOfMention = textAfterCursor === '' || textAfterCursor.startsWith(' ');
    
    if (isAtEndOfMention) {
      for (const contextItem of context) {
        const displayName = getContextDisplayName(contextItem);
        const mentionPattern = `@${displayName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`;
        const regex = new RegExp(mentionPattern);
        const match = textBeforeCursor.match(regex);
        
        if (match && (!bestMatch || match[0].length > bestMatch[0].length)) {
          bestMatch = match;
          bestContextItem = contextItem;
        }
      }
    }
    
    const match = bestMatch;
    
    if (match && bestContextItem) {
      // We already found the matching context item
      const contextItem = bestContextItem;
      const mentionName = match[1];
      console.log('=== handleKeyDown ===');
      console.log('Looking for mention:', JSON.stringify(mentionName));
      console.log('Found context item:', contextItem);
      
      if (contextItem) {
        e.preventDefault();
        // Remove the entire @ mention
        const beforeMention = textBeforeCursor.substring(0, match.index);
        const afterCursor = input.substring(cursorPos);
        const newInput = beforeMention + afterCursor;
        
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
    <div className="flex h-full flex-col bg-[#161b22]">
      {/* Fixed Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 bg-[#161b22] h-10">
        <h2 className="text-sm font-bold text-[#f0f6fc] flex items-center gap-2">
              <svg className="w-3 h-3 text-[#58a6ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
          Nour - Fabric Assistant
        </h2>
        <button
          onClick={onNewChat}
          className="text-xs rounded px-2 py-1 transition-colors font-medium bg-[#0d1117] text-[#e6edf3] hover:bg-[#161b22]"
        >
          New chat
        </button>
      </div>

      {/* Fixed Info Banner */}
      <div className="flex-shrink-0 bg-[#2d333b] py-2 flex items-center justify-center">
        <button
          onClick={() => setShowInfoModal(true)}
          className="text-xs text-[#a8b2d1] hover:text-[#e6edf3] transition-colors italic flex items-center gap-1.5"
          title="Learn about Nour's capabilities"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Click for more info
        </button>
      </div>


      {/* Scrollable Messages Area */}
      <div className="flex-1 overflow-hidden">
        <MessageArea turns={turns} />
      </div>

      {/* Input Section */}
      <div className="p-3 flex-shrink-0">
        <div className="relative">
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a message… Use @ to mention items (workspace, database, schema, table, column)."
            className="w-full h-20 resize-none rounded border border-[#30363d] bg-[#21262d] text-[#e6edf3] p-2 focus:border-[#1f6feb] focus:ring-2 focus:ring-[#1f6feb] transition-colors placeholder:text-xs placeholder:italic placeholder:text-[#8b949e]"
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
            <div className="max-h-10 overflow-y-auto w-full">
              <ContextChips items={context} onRemove={onRemoveContext} />
            </div>
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

      {/* Info Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-[#0d1117] border border-[#30363d] rounded-lg p-6 max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[#f0f6fc]">Nour - Fabric Assistant</h3>
              <button
                onClick={() => setShowInfoModal(false)}
                className="text-[#8b949e] hover:text-[#e6edf3] transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-3 text-sm text-[#e6edf3]">
              <p className="text-[#8b949e] mb-3">Nour can help you with:</p>
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <span className="text-[#58a6ff]">•</span>
                  <span>Explore Fabric workspaces, databases, schemas, tables, and columns</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-[#58a6ff]">•</span>
                  <span>Execute read-only SQL queries to analyze data</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-[#58a6ff]">•</span>
                  <span>Generate interactive charts and visualizations</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-[#3fb950]">•</span>
                  <span><strong>Time series forecasting</strong> with Prophet AI</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-[#3fb950]">•</span>
                  <span><strong>Predictive analytics</strong> with confidence intervals</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-[#58a6ff]">•</span>
                  <span>Answer questions about your data structure</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-[#58a6ff]">•</span>
                  <span>Help with data analysis and insights</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-[#58a6ff]">•</span>
                  <span>Provide guidance on Fabric best practices</span>
                </div>
              </div>
              <div className="mt-4 p-3 bg-[#161b22] rounded border border-[#30363d]">
                <p className="text-[#58a6ff] font-medium mb-1">💡 Pro Tip:</p>
                <p className="text-xs">Use @ mentions to reference specific items in your queries!</p>
                <p className="text-xs mt-1 text-[#3fb950]">Try: "Forecast sales for the next 6 months" or "Predict customer growth trends"</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
