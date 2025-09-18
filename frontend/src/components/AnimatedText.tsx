"use client";
import React from "react";

interface AnimatedTextProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export default function AnimatedText({ children, className = "", style = {} }: AnimatedTextProps) {
  return (
    <span 
      className={`inline-block ${className}`}
      style={{
        background: 'linear-gradient(90deg, #8b949e 0%, #e6edf3 50%, #8b949e 100%)',
        backgroundSize: '200% 100%',
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        animation: 'shimmer 2s ease-in-out infinite',
        ...style
      }}
    >
      {children}
      <style jsx>{`
        @keyframes shimmer {
          0% {
            background-position: -200% 0;
          }
          100% {
            background-position: 200% 0;
          }
        }
      `}</style>
    </span>
  );
}
