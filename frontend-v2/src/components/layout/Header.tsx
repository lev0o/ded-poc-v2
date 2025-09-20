"use client";
import React from "react";
import { AccountIcon } from "../../domains/auth";
import { BeamsBackground } from "../common";

export function Header() {
  return (
    <div className="hidden lg:block border-b border-[#30363d]/20 relative z-10">
      <BeamsBackground intensity="subtle" className="h-12">
        <div className="flex items-center justify-between w-full h-full px-4 py-3">
          <div className="text-lg font-semibold text-[var(--color-text-primary)] font-primary tracking-wide">
            Fabric Nexus
          </div>
          <div className="relative">
            <AccountIcon />
          </div>
        </div>
      </BeamsBackground>
    </div>
  );
}
