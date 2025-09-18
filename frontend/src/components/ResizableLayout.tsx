"use client";
import React, { useState, useRef, useEffect } from "react";

interface ResizableLayoutProps {
  header?: React.ReactNode;
  leftPanel: React.ReactNode;
  centerPanel: React.ReactNode;
  rightPanel: React.ReactNode;
  defaultLeftWidth?: number;
  defaultRightWidth?: number;
  minWidth?: number;
  maxWidth?: number;
}

export default function ResizableLayout({
  header,
  leftPanel,
  centerPanel,
  rightPanel,
  defaultLeftWidth = 350,
  defaultRightWidth = 350,
  minWidth = 250,
  maxWidth = 600,
}: ResizableLayoutProps) {
  const [leftWidth, setLeftWidth] = useState(defaultLeftWidth);
  const [rightWidth, setRightWidth] = useState(defaultRightWidth);
  const [isDraggingLeft, setIsDraggingLeft] = useState(false);
  const [isDraggingRight, setIsDraggingRight] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDownLeft = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingLeft(true);
  };

  const handleMouseDownRight = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingRight(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const containerWidth = containerRect.width;

      if (isDraggingLeft) {
        const newLeftWidth = e.clientX - containerRect.left;
        const constrainedWidth = Math.min(Math.max(newLeftWidth, minWidth), maxWidth);
        const remainingWidth = containerWidth - constrainedWidth - rightWidth;
        
        if (remainingWidth >= minWidth) {
          setLeftWidth(constrainedWidth);
        }
      }

      if (isDraggingRight) {
        const newRightWidth = containerRect.right - e.clientX;
        const constrainedWidth = Math.min(Math.max(newRightWidth, minWidth), maxWidth);
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
  }, [isDraggingLeft, isDraggingRight, leftWidth, rightWidth, minWidth, maxWidth]);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#0d1117] text-[#e6edf3]">
      {/* Header */}
      {header && (
        <div className="flex-shrink-0">
          {header}
        </div>
      )}

      {/* Resizable Content */}
      <div ref={containerRef} className="flex flex-1 overflow-hidden">
        {/* Left Panel */}
        <div
          className="flex-shrink-0 bg-[#161b22]"
          style={{ width: `${leftWidth}px` }}
        >
          {leftPanel}
        </div>

        {/* Left Resize Handle */}
        <div
          className="w-1 bg-transparent hover:bg-[#1f6feb]/50 cursor-col-resize transition-colors flex-shrink-0"
          onMouseDown={handleMouseDownLeft}
        />

        {/* Center Panel */}
        <div className="flex-1 bg-[#0d1117] min-w-0">
          {centerPanel}
        </div>

        {/* Right Resize Handle */}
        <div
          className="w-1 bg-transparent hover:bg-[#1f6feb]/50 cursor-col-resize transition-colors flex-shrink-0"
          onMouseDown={handleMouseDownRight}
        />

        {/* Right Panel */}
        <div
          className="flex-shrink-0 bg-[#161b22]"
          style={{ width: `${rightWidth}px` }}
        >
          {rightPanel}
        </div>
      </div>
    </div>
  );
}
