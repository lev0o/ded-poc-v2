"use client";
import React, { useState, useEffect, useRef } from "react";
import { User, ChevronDown } from "lucide-react";

export function AccountIcon() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Mock user data - replace with actual user data later
  const user = {
    email: "abdullah@netways.com",
    name: "Abdullah",
    avatar: null
  };

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]/50 rounded-md transition-colors"
      >
        <div className="w-6 h-6 bg-[var(--color-info)] rounded-full flex items-center justify-center">
          <User size={14} className="text-white" />
        </div>
        <span className="hidden sm:block">{user.name}</span>
        <ChevronDown size={12} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-64 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-primary)] rounded-md shadow-lg z-[9999]">
          <div className="p-3">
            <div className="mb-4 pb-3 border-b border-[var(--color-border-primary)]">
              <div className="text-sm font-medium text-[var(--color-text-primary)]">
                {user.name}
              </div>
              <div className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
                {user.email}
              </div>
            </div>
            
            <div className="space-y-1">
              <button className="w-full text-left px-3 py-2 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] rounded-md transition-colors">
                Profile Settings
              </button>
              <button className="w-full text-left px-3 py-2 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] rounded-md transition-colors">
                Preferences
              </button>
              <button className="w-full text-left px-3 py-2 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] rounded-md transition-colors">
                Security
              </button>
            </div>
            
            <div className="border-t border-[var(--color-border-primary)] mt-3 pt-3">
              <button className="w-full text-left px-3 py-2 text-xs text-[var(--color-error)] hover:bg-[var(--color-bg-elevated)] rounded-md transition-colors">
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
