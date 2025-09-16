"use client";
import React from "react";

interface Props {
  children: React.ReactNode;
  className?: string;
}

export default function ScrollableContent({ children, className = "" }: Props) {
  return (
    <div className={`h-full overflow-y-auto ${className}`}>
      <div className="p-4 space-y-6">
        {children}
      </div>
    </div>
  );
}
