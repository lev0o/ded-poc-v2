"use client";
import React from 'react';
import { LoadingSpinner } from '../ui';
import { colors, spacing } from '../../lib/design';

interface LoadingStateProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingState({ 
  message = "Loading...", 
  size = 'md',
  className = '' 
}: LoadingStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center min-h-[200px] p-6 ${className}`}>
      <LoadingSpinner size={size} className="mb-4" />
      <p className={`text-sm text-[${colors.text.tertiary}]`}>
        {message}
      </p>
    </div>
  );
}

interface SkeletonProps {
  className?: string;
  height?: string;
  width?: string;
}

export function Skeleton({ 
  className = '', 
  height = '1rem',
  width = '100%'
}: SkeletonProps) {
  return (
    <div 
      className={`bg-[${colors.background.tertiary}] rounded-[${spacing[1]}] animate-pulse ${className}`}
      style={{ height, width }}
    />
  );
}

interface SkeletonTextProps {
  lines?: number;
  className?: string;
}

export function SkeletonText({ lines = 3, className = '' }: SkeletonTextProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton 
          key={index}
          height="0.875rem"
          width={index === lines - 1 ? '75%' : '100%'}
        />
      ))}
    </div>
  );
}
