"use client";
import React, { useState } from "react";
import { User, ChevronDown } from "lucide-react";

export default function AccountIcon() {
  const [isOpen, setIsOpen] = useState(false);
  
  // Mock user data - replace with actual user data later
  const user = {
    email: "abdullah@netways.com",
    name: "Abdullah",
    avatar: null
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2 py-2 text-sm text-[#e6edf3] hover:bg-[#21262d]/50 rounded-md transition-colors"
      >
        <div className="w-6 h-6 bg-[#1f6feb] rounded-full flex items-center justify-center">
          <User size={14} className="text-white" />
        </div>
        <span className="hidden sm:block">{user.name}</span>
        <ChevronDown size={12} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-64 bg-[#21262d] border border-[#30363d] rounded-md shadow-lg z-[9999]">
          <div className="p-4 border-b border-[#30363d]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#1f6feb] rounded-full flex items-center justify-center">
                <User size={18} className="text-white" />
              </div>
              <div>
                <div className="font-medium text-[#e6edf3]">{user.name}</div>
                <div className="text-sm text-[#8b949e]">{user.email}</div>
              </div>
            </div>
          </div>
          
          <div className="p-2">
            <div className="text-xs text-[#8b949e] px-2 py-1">
              Account settings coming soon...
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
