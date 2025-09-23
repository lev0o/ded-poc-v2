/**
 * Chat info modal component showing AI capabilities
 */

"use client";
import React from "react";

interface ChatInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ChatInfoModal({ isOpen, onClose }: ChatInfoModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-[var(--color-bg-primary)] border border-[var(--color-border-primary)] rounded-lg p-6 max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-[var(--color-text-primary)] font-primary">Nour - Fabric Assistant</h3>
          <button
            onClick={onClose}
            className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="space-y-3 text-sm text-[var(--color-text-primary)]">
          <p className="text-[var(--color-text-tertiary)] mb-3">Nour can help you with:</p>
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <span className="text-[var(--color-info)]">•</span>
              <span>Explore Fabric workspaces, databases, schemas, tables, and columns</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[var(--color-info)]">•</span>
              <span>Execute read-only SQL queries to analyze data</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[var(--color-info)]">•</span>
              <span>Generate interactive charts and visualizations</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[var(--color-success)]">•</span>
              <span><strong>Time series forecasting</strong> with Prophet AI</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[var(--color-success)]">•</span>
              <span><strong>Predictive analytics</strong> with confidence intervals</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[var(--color-info)]">•</span>
              <span>Answer questions about your data structure</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[var(--color-info)]">•</span>
              <span>Help with data analysis and insights</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[var(--color-info)]">•</span>
              <span>Provide guidance on Fabric best practices</span>
            </div>
          </div>
          <div className="mt-4 p-3 bg-[var(--color-bg-tertiary)] rounded border border-[var(--color-border-primary)]">
            <p className="text-[var(--color-info)] font-medium mb-1">💡 Pro Tip:</p>
            <p className="text-xs">Use @ mentions to reference specific items in your queries!</p>
            <p className="text-xs mt-1 text-[var(--color-success)]">Try: "Forecast sales for the next 6 months" or "Predict customer growth trends"</p>
          </div>
        </div>
      </div>
    </div>
  );
}
