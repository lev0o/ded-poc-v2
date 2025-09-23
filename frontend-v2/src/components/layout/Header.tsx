"use client";
import React from "react";
import { AccountIcon } from "../../domains/auth";
import { BeamsBackground } from "../common";
import { useTheme } from "../../lib/providers/ThemeProvider";
import { Sun, Moon } from "lucide-react";

export function Header() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="hidden lg:block border-b border-[var(--color-border-primary)] relative z-10">
      <BeamsBackground intensity="subtle" className="h-12">
        <div className="flex items-center justify-between w-full h-full px-4 py-3">
          <div className="text-lg font-semibold text-[var(--color-text-primary)] font-primary tracking-wide">
            Fabric Nexus
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-md hover:bg-[var(--color-bg-tertiary)]"
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            >
              {theme === 'dark' ? (
                <Sun size={16} className="text-[var(--color-text-secondary)]" />
              ) : (
                <Moon size={16} className="text-[var(--color-text-secondary)]" />
              )}
            </button>
            <AccountIcon />
          </div>
        </div>
      </BeamsBackground>
    </div>
  );
}
