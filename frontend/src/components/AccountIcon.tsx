"use client";
import React, { useState, useEffect } from "react";
import { User, ChevronDown, LogIn, LogOut, Shield } from "lucide-react";

interface UserInfo {
  user_id: string;
  email: string;
  name: string;
  roles: string[];
  permissions: Record<string, any>;
  rls_enabled: boolean;
  last_login: string;
}

export default function AccountIcon() {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("access_token");
      if (token) {
        // Check if user is authenticated
        const response = await fetch("http://127.0.0.1:8000/fabric-auth/status", {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });

        if (response.ok) {
          const authData = await response.json();
          if (authData.authenticated && authData.user) {
            setUser(authData.user);
            setIsAuthenticated(true);
          } else {
            setIsAuthenticated(false);
            setUser(null);
          }
        } else {
          setIsAuthenticated(false);
          setUser(null);
        }
      } else {
        setIsAuthenticated(false);
        setUser(null);
      }
    } catch (error) {
      console.error("Auth check failed:", error);
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    try {
      const mockUser = {
        user_id: "demo-user-001",
        email: "demo@fabric.com",
        name: "Demo User",
        roles: ["analyst"],
        permissions: {
          can_read_all_workspaces: false,
          can_write_workspaces: false,
          can_execute_sql: true,
          can_view_sensitive_data: false,
          can_manage_users: false,
          workspace_access: "limited",
          data_access_level: "filtered"
        },
        rls_enabled: true,
        last_login: new Date().toISOString()
      };
      
      localStorage.setItem("access_token", "mock_token_for_demo");
      setUser(mockUser);
      setIsAuthenticated(true);
      setIsOpen(false);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("http://127.0.0.1:8000/fabric-auth/logout", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("access_token") || ""}`
        }
      });
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      localStorage.removeItem("access_token");
      setUser(null);
      setIsAuthenticated(false);
      setIsOpen(false);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "admin":
        return "text-red-500 bg-red-500/10";
      case "manager":
        return "text-blue-500 bg-blue-500/10";
      case "analyst":
        return "text-green-500 bg-green-500/10";
      case "viewer":
        return "text-gray-500 bg-gray-500/10";
      default:
        return "text-yellow-500 bg-yellow-500/10";
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2 py-2 text-sm text-[#e6edf3] hover:bg-[#21262d]/50 rounded-md transition-colors"
      >
        <div className="w-6 h-6 bg-[#1f6feb] rounded-full flex items-center justify-center">
          {isAuthenticated ? (
            <User size={14} className="text-white" />
          ) : (
            <LogIn size={14} className="text-white" />
          )}
        </div>
        <span className="hidden sm:block">
          {isAuthenticated ? user?.name : "Login"}
        </span>
        <ChevronDown size={12} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-64 bg-[#21262d] border border-[#30363d] rounded-md shadow-lg z-[9999]">
          {isAuthenticated && user ? (
            <>
              {/* User Info */}
              <div className="p-4 border-b border-[#30363d]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#1f6feb] rounded-full flex items-center justify-center">
                    <User size={18} className="text-white" />
                  </div>
                  <div>
                    <div className="font-medium text-[#e6edf3]">{user.name}</div>
                    <div className="text-sm text-[#8b949e]">{user.email}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`px-2 py-1 rounded text-xs ${getRoleColor(user.roles[0] || "")}`}>
                        {user.roles[0]?.toUpperCase() || "USER"}
                      </span>
                      {user.rls_enabled && (
                        <span className="px-2 py-1 rounded text-xs bg-green-500/20 text-green-400">
                          RLS
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* RLS Status */}
              <div className="p-3 border-b border-[#30363d]">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-4 h-4 text-[#58a6ff]" />
                  <span className="text-sm font-medium text-[#e6edf3]">RLS Status</span>
                </div>
                <div className="text-xs text-[#8b949e]">
                  Data access level: {user.permissions.data_access_level}
                </div>
                <div className="text-xs text-[#8b949e]">
                  Workspace access: {user.permissions.workspace_access}
                </div>
              </div>

              {/* Actions */}
              <div className="p-2">
                <button
                  onClick={handleLogout}
                  className="w-full px-3 py-2 bg-[#21262d] text-[#e6edf3] rounded text-sm hover:bg-[#30363d] transition-colors flex items-center justify-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Login Section */}
              <div className="p-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-[#1f6feb] rounded-full flex items-center justify-center">
                    <LogIn size={18} className="text-white" />
                  </div>
                  <div>
                    <div className="font-medium text-[#e6edf3]">Not Authenticated</div>
                    <div className="text-sm text-[#8b949e]">Login to enable RLS</div>
                  </div>
                </div>

                <button
                  onClick={handleLogin}
                  className="w-full px-3 py-2 bg-[#1f6feb] text-white rounded text-sm hover:bg-[#388bfd] transition-colors flex items-center justify-center gap-2"
                >
                  <LogIn className="w-4 h-4" />
                  Login with Demo Account
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
