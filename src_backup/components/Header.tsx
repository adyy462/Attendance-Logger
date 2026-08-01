/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { RefreshCw, Database, LogOut, CheckCircle2, AlertCircle } from "lucide-react";
import { User } from "firebase/auth";

interface HeaderProps {
  user: User | null;
  spreadsheetUrl: string | null;
  syncStatus: "synced" | "syncing" | "error" | "offline";
  onRefresh: () => void;
  onLogout: () => void;
  onOpenConfig: () => void;
}

export default function Header({
  user,
  spreadsheetUrl,
  syncStatus,
  onRefresh,
  onLogout,
  onOpenConfig,
}: HeaderProps) {
  return (
    <header className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-40 shadow-sm" id="header-root">
      <div className="max-w-md mx-auto flex items-center justify-between">
        <div>
          <h1 className="text-sm font-bold text-slate-800 tracking-wider uppercase font-mono" id="header-title">
            Attendance Log
          </h1>
          <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-widest mt-0.5" id="header-subtitle">
            SheetSync Pro
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Sync Status Badge */}
          <button
            onClick={onOpenConfig}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-all border ${
              syncStatus === "synced"
                ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                : syncStatus === "syncing"
                ? "bg-amber-50 border-amber-200 text-amber-700 animate-pulse"
                : syncStatus === "error"
                ? "bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100"
                : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
            }`}
            title="Google Sheets Sync Settings"
            id="sync-status-badge"
          >
            {syncStatus === "synced" && (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span className="inline">Synced</span>
              </>
            )}
            {syncStatus === "syncing" && (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span className="inline">Syncing</span>
              </>
            )}
            {syncStatus === "error" && (
              <>
                <AlertCircle className="w-3.5 h-3.5" />
                <span className="inline">Error</span>
              </>
            )}
            {syncStatus === "offline" && (
              <>
                <Database className="w-3.5 h-3.5" />
                <span className="inline">Offline</span>
              </>
            )}
          </button>

          {/* User Profile / Logout */}
          {user && (
            <div className="flex items-center gap-1.5">
              <img
                src={user.photoURL || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&fit=crop&auto=format&q=80"}
                alt={user.displayName || "User"}
                className="w-7 h-7 rounded border border-slate-200"
                referrerPolicy="no-referrer"
                id="user-profile-avatar"
              />
              <button
                onClick={onLogout}
                className="p-1 rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                title="Sign Out"
                id="header-logout-btn"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
