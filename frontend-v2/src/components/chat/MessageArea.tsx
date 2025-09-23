"use client";
import React, { useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { ChatTurn } from "../../lib/types/common";

interface Props {
  turns: ChatTurn[];
  className?: string;
}

export function MessageArea({ turns, className = "" }: Props) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns]);

  return (
    <div className={`h-full overflow-y-auto ${className}`}>
      <div className="space-y-0">
        {turns.map((t, i) => (
          <div key={i} className={`w-full px-3 py-2 shadow-sm ${t.role === "user" ? "bg-[var(--color-info)]" : "bg-[var(--color-bg-ai-message)]"}`}>
            <div className={`flex items-center gap-2 mb-1 ${t.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`text-xs font-semibold ${t.role === "user" ? "text-white" : "text-[var(--color-info)]"}`}>
                {t.role === "user" ? "You" : "Nour"}
              </div>
            </div>
            <div className="text-sm leading-relaxed text-[var(--color-text-primary)]">
              {t.content === "thinking" ? (
                <div className="italic text-[var(--color-text-tertiary)]">
                  Thinking...
                </div>
              ) : (
                <ReactMarkdown 
                  components={{
                    // Headings
                    h1: ({ children, ...props }) => (
                      <h1 className="text-lg font-bold mb-3 mt-4 text-[var(--color-text-primary)]" {...props}>
                        {children}
                      </h1>
                    ),
                    h2: ({ children, ...props }) => (
                      <h2 className="text-base font-bold mb-2 mt-3 text-[var(--color-text-primary)]" {...props}>
                        {children}
                      </h2>
                    ),
                    h3: ({ children, ...props }) => (
                      <h3 className="text-sm font-bold mb-2 mt-2 text-[var(--color-text-primary)]" {...props}>
                        {children}
                      </h3>
                    ),
                    // Paragraphs
                    p: ({ children, ...props }) => (
                      <p className="mb-2 text-sm leading-relaxed text-[var(--color-text-primary)]" {...props}>
                        {children}
                      </p>
                    ),
                    // Lists
                    ul: ({ children, ...props }) => (
                      <ul className="mb-2 ml-4 list-disc text-sm text-[var(--color-text-primary)]" {...props}>
                        {children}
                      </ul>
                    ),
                    ol: ({ children, ...props }) => (
                      <ol className="mb-2 ml-4 list-decimal text-sm text-[var(--color-text-primary)]" {...props}>
                        {children}
                      </ol>
                    ),
                    li: ({ children, ...props }) => (
                      <li className="mb-1 text-sm text-[var(--color-text-primary)]" {...props}>
                        {children}
                      </li>
                    ),
                    // Code blocks
                    code: ({ children, className, ...props }) => {
                      const isInline = !className?.includes('language-');
                      return isInline ? (
                        <code className="bg-[var(--color-bg-tertiary)] border border-[var(--color-border-primary)] px-1.5 py-0.5 rounded text-xs font-mono text-[var(--color-text-primary)]" {...props}>
                          {children}
                        </code>
                      ) : (
                        <code className={className} {...props}>
                          {children}
                        </code>
                      );
                    },
                    pre: ({ children, ...props }) => (
                      <pre className="bg-[var(--color-bg-tertiary)] border border-[var(--color-border-primary)] p-3 rounded-lg overflow-x-auto text-xs font-mono text-[var(--color-text-primary)] mb-2" {...props}>
                        {children}
                      </pre>
                    ),
                    // Blockquotes
                    blockquote: ({ children, ...props }) => (
                      <blockquote className="border-l-4 border-[var(--color-info)] pl-4 italic text-sm text-[var(--color-text-primary)] mb-2" {...props}>
                        {children}
                      </blockquote>
                    ),
                    // Tables - Enhanced for horizontal scrolling
                    table: ({ children, ...props }) => (
                      <div className="mb-2 border border-[var(--color-border-primary)] rounded-lg overflow-x-auto shadow-sm">
                        <table className="min-w-max border-collapse text-xs" {...props}>
                          {children}
                        </table>
                      </div>
                    ),
                    thead: ({ children, ...props }) => (
                      <thead className="bg-[var(--color-bg-tertiary)] sticky top-0 z-10" {...props}>
                        {children}
                      </thead>
                    ),
                    th: ({ children, ...props }) => (
                      <th className="border border-[var(--color-border-primary)] px-3 py-2 text-left font-bold text-[var(--color-text-primary)] text-xs whitespace-nowrap" {...props}>
                        {children}
                      </th>
                    ),
                    td: ({ children, ...props }) => (
                      <td className="border border-[var(--color-border-primary)] px-3 py-2 text-[var(--color-text-primary)] text-xs whitespace-nowrap" {...props}>
                        {children}
                      </td>
                    ),
                    // Links
                    a: ({ children, href, ...props }) => (
                      <a 
                        href={href} 
                        className="text-[var(--color-info)] hover:text-[var(--color-info)]/80 hover:underline text-sm font-medium" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        {...props}
                      >
                        {children}
                      </a>
                    ),
                    // Strong/Bold
                    strong: ({ children, ...props }) => (
                      <strong className="font-bold text-[var(--color-text-primary)]" {...props}>
                        {children}
                      </strong>
                    ),
                    // Emphasis/Italic
                    em: ({ children, ...props }) => (
                      <em className="italic text-[var(--color-text-primary)]" {...props}>
                        {children}
                      </em>
                    ),
                  }}
                >
                  {t.content}
                </ReactMarkdown>
              )}
            </div>
          </div>
        ))}
        {/* Scroll target for auto-scroll */}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
