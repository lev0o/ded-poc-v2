"use client";
import React from "react";
import AccountIcon from "./AccountIcon";
import { BeamsBackground } from "./BeamsBackground";

export default function Header() {
  return (
    <div className="hidden lg:block border-b border-[#30363d]/30 relative">
      <BeamsBackground intensity="subtle" className="h-12">
        <div className="flex items-center justify-between w-full h-full px-4 py-3">
          <div className="text-sm font-medium text-[#e6edf3]">
            DED AI Analysis POC
          </div>
          <div className="relative">
            <AccountIcon />
          </div>
        </div>
      </BeamsBackground>
    </div>
  );
}