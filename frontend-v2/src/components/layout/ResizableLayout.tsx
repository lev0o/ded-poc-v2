"use client";
import React, { useState, useRef, useEffect } from "react";
import { colors, spacing } from "../../lib/design";

// ============================================================================
// TYPES
// ============================================================================

interface ResizableLayoutProps {
  header?: React.ReactNode;
  leftPanel: React.ReactNode;
  centerPanel: React.ReactNode;
  rightPanel?: React.ReactNode;
  defaultLeftWidth?: number;
  defaultRightWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  dynamicMinWidth?: number; // Dynamic minimum width from left panel content
  dynamicRightMinWidth?: number; // Dynamic minimum width from right panel content
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function ResizableLayout({
  header,
  leftPanel,
  centerPanel,
  rightPanel,
  defaultLeftWidth = 320,
  defaultRightWidth = 320,
  minWidth = 200, // Base minimum width
  maxWidth = 500,
  dynamicMinWidth,
  dynamicRightMinWidth,
}: ResizableLayoutProps) {
  // State management
  const [leftWidth, setLeftWidth] = useState(defaultLeftWidth);
  const [rightWidth, setRightWidth] = useState(defaultRightWidth);
  const [isDraggingLeft, setIsDraggingLeft] = useState(false);
  const [isDraggingRight, setIsDraggingRight] = useState(false);
  const [isHoveringLeft, setIsHoveringLeft] = useState(false);
  const [isHoveringRight, setIsHoveringRight] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleMouseDownLeft = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingLeft(true);
  };

  const handleMouseDownRight = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingRight(true);
  };

  // ============================================================================
  // EFFECTS
  // ============================================================================

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const containerWidth = containerRect.width;

      if (isDraggingLeft) {
        const newLeftWidth = e.clientX - containerRect.left;
        const effectiveMinWidth = dynamicMinWidth ? Math.max(minWidth, dynamicMinWidth) : minWidth;
        const constrainedWidth = Math.min(Math.max(newLeftWidth, effectiveMinWidth), maxWidth);
        const remainingWidth = containerWidth - constrainedWidth - (rightPanel ? rightWidth : 0);
        
        if (remainingWidth >= minWidth) {
          setLeftWidth(constrainedWidth);
        }
      }

      if (isDraggingRight && rightPanel) {
        const newRightWidth = containerRect.right - e.clientX;
        const effectiveRightMinWidth = dynamicRightMinWidth ? Math.max(minWidth, dynamicRightMinWidth) : minWidth;
        const constrainedWidth = Math.min(Math.max(newRightWidth, effectiveRightMinWidth), maxWidth);
        const remainingWidth = containerWidth - leftWidth - constrainedWidth;
        
        if (remainingWidth >= minWidth) {
          setRightWidth(constrainedWidth);
        }
      }
    };

    const handleMouseUp = () => {
      setIsDraggingLeft(false);
      setIsDraggingRight(false);
    };

    if (isDraggingLeft || isDraggingRight) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isDraggingLeft, isDraggingRight, leftWidth, rightWidth, minWidth, maxWidth, rightPanel, dynamicMinWidth, dynamicRightMinWidth]);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      {/* Header */}
      {header && (
        <div className="flex-shrink-0">
          {header}
        </div>
      )}

      {/* Resizable Content */}
      <div ref={containerRef} className="flex flex-1 overflow-hidden relative">
        {/* Left Panel */}
        <div
          className="flex-shrink-0 bg-[var(--color-bg-secondary)]"
          style={{ width: `${leftWidth}px` }}
        >
          {leftPanel}
        </div>

        {/* Left Resize Handle */}
        <div
          className="cursor-col-resize absolute z-10"
          onMouseDown={handleMouseDownLeft}
          onMouseEnter={() => setIsHoveringLeft(true)}
          onMouseLeave={() => setIsHoveringLeft(false)}
          style={{ 
            width: '4px',
            height: '100%',
            backgroundColor: 'transparent',
            left: `${leftWidth - 2}px`,
            top: '0'
          }}
        >
          {/* Blue line overlay on hover */}
          {isHoveringLeft && (
            <div 
              className="absolute inset-0 bg-[var(--color-info)]"
              style={{ width: '2px', left: '1px' }}
            />
          )}
        </div>

        {/* Center Panel */}
        <div className="flex-1 bg-[var(--color-bg-primary)] min-w-0">
          {centerPanel}
        </div>

        {/* Right Resize Handle (only if right panel exists) */}
        {rightPanel && (
          <div
            className="cursor-col-resize absolute z-10"
            onMouseDown={handleMouseDownRight}
            onMouseEnter={() => setIsHoveringRight(true)}
            onMouseLeave={() => setIsHoveringRight(false)}
            style={{ 
              width: '4px',
              height: '100%',
              backgroundColor: 'transparent',
              right: `${rightWidth - 2}px`,
              top: '0'
            }}
          >
            {/* Blue line overlay on hover */}
            {isHoveringRight && (
              <div 
                className="absolute inset-0 bg-[var(--color-info)]"
                style={{ width: '2px', right: '1px' }}
              />
            )}
          </div>
        )}

        {/* Right Panel (only if provided) */}
        {rightPanel && (
          <div
            className="flex-shrink-0 bg-[var(--color-bg-secondary)]"
            style={{ width: `${rightWidth}px` }}
          >
            {rightPanel}
          </div>
        )}
      </div>
    </div>
  );
}
