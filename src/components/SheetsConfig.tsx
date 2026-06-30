/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Database, Link, ExternalLink, RefreshCw, PlusCircle, Check, X, AlertCircle } from "lucide-react";

interface SheetsConfigProps {
  spreadsheetId: string | null;
  spreadsheetUrl: string | null;
  syncEnabled: boolean;
  onToggleSync: (enabled: boolean) => void;
  onCreateNewSheet: () => void;
  onLinkExistingSheet: (id: string) => void;
  onClose: () => void;
  isLoading: boolean;
  ownerEmail: string;
  allowedEmails: string[];
  currentUserEmail: string;
  onAddAllowedEmail: (email: string) => void;
  onRemoveAllowedEmail: (email: string) => void;
}

export default function SheetsConfig({
  spreadsheetId,
  spreadsheetUrl,
  syncEnabled,
  onToggleSync,
  onCreateNewSheet,
  onLinkExistingSheet,
  onClose,
  isLoading,
  ownerEmail,
  allowedEmails,
  currentUserEmail,
  onAddAllowedEmail,
  onRemoveAllowedEmail,
}: SheetsConfigProps) {
  const [manualId, setManualId] = useState("");
  const [copied, setCopied] = useState(false);
  const [newEmail, setNewEmail] = useState("");

  const handleCopyLink = () => {
    if (spreadsheetUrl) {
      navigator.clipboard.writeText(spreadsheetUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isOwner = currentUserEmail.toLowerCase() === ownerEmail.toLowerCase();


  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto" id="sheets-config-modal">
      <div className="bg-white rounded-xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden" id="sheets-config-container">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Google Sheets Sync</h2>
              <p className="text-[10px] text-slate-400">Database & Real-time Integration</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Status Alert */}
          {spreadsheetId ? (
            <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl space-y-2.5">
              <div className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-600 mt-0.5" />
                <div className="flex-1">
                  <span className="text-xs font-bold text-emerald-800 block uppercase tracking-wide">Connected to Google Sheets</span>
                  <p className="text-[11px] text-emerald-600 mt-0.5">
                    Your attendance entries will synchronize automatically in real-time to your custom workbook.
                  </p>
                </div>
              </div>

              {spreadsheetUrl && (
                <div className="flex gap-2 items-center pt-1">
                  <a
                    href={spreadsheetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-sm uppercase tracking-wide"
                    id="open-sheet-url-btn"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open Sheet
                  </a>
                  <button
                    onClick={handleCopyLink}
                    className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 py-1.5 px-3 rounded-lg text-xs font-bold transition-all shadow-sm uppercase tracking-wide"
                  >
                    {copied ? "Copied!" : "Copy Link"}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <span className="text-xs font-bold text-amber-800 block uppercase tracking-wide">No Google Sheet Linked</span>
                <p className="text-[11px] text-amber-600 mt-0.5">
                  Link an existing Google Sheet or create a brand new template database to persist logs permanently.
                </p>
              </div>
            </div>
          )}

          {/* Sync Toggle */}
          {spreadsheetId && (
            <div className="flex items-center justify-between bg-slate-50 border border-slate-100 p-3.5 rounded-xl">
              <div>
                <span className="text-xs font-bold text-slate-800 block uppercase tracking-wide">Real-Time Syncing</span>
                <span className="text-[10px] text-slate-400">Stream updates directly to sheets</span>
              </div>
              <button
                onClick={() => onToggleSync(!syncEnabled)}
                className={`w-11 h-6 rounded-full transition-colors relative focus:outline-none ${
                  syncEnabled ? "bg-emerald-500" : "bg-slate-300"
                }`}
                id="sync-toggle-switch"
              >
                <span
                  className={`absolute top-0.5 left-0.5 bg-white w-5 h-5 rounded-full shadow transition-transform ${
                    syncEnabled ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          )}

          {/* Setup / Re-link */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Configure Database</h3>

            {/* Create Brand New */}
            <button
              onClick={onCreateNewSheet}
              disabled={isLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider shadow-sm transition-colors flex items-center justify-center gap-1.5"
              id="create-new-sheet-btn"
            >
              {isLoading ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <PlusCircle className="w-3.5 h-3.5" />
              )}
              Create New Sheet Database
            </button>

            {/* Link Manual ID */}
            <div className="border border-slate-200 rounded-xl p-3.5 space-y-2.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">Link Existing Spreadsheet by ID</span>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Paste Google Spreadsheet ID..."
                  value={manualId}
                  onChange={(e) => setManualId(e.target.value)}
                  className="flex-1 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg text-xs text-slate-700 placeholder:text-slate-300 focus:outline-none focus:border-indigo-400 focus:bg-white transition-all font-mono"
                />
                <button
                  onClick={() => {
                    if (manualId.trim()) {
                      onLinkExistingSheet(manualId.trim());
                      setManualId("");
                    }
                  }}
                  disabled={isLoading || !manualId.trim()}
                  className="bg-slate-100 hover:bg-slate-200 disabled:bg-slate-50 disabled:text-slate-300 text-slate-700 py-1.5 px-3.5 rounded-lg text-xs font-bold transition-all shrink-0 uppercase tracking-wider border border-slate-200"
                  id="link-sheet-id-btn"
                >
                  Link
                </button>
              </div>
              <p className="text-[9px] text-slate-400 leading-normal">
                Example ID: extract from URL `https://docs.google.com/spreadsheets/d/<b>YOUR_SPREADSHEET_ID</b>/edit`
              </p>
            </div>

            {/* Access Control section */}
            <div className="border border-slate-200 rounded-xl p-3.5 space-y-3 bg-slate-50/50">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">Shared Access Authentication</span>
                <span className="bg-slate-200 text-slate-700 text-[8px] font-black uppercase px-1.5 py-0.5 rounded tracking-widest">
                  {isOwner ? "Admin" : "Team"}
                </span>
              </div>

              {isOwner ? (
                <div className="space-y-3">
                  <p className="text-[10px] text-slate-400 leading-normal">
                    Authorize other team members' Gmail accounts to let their UIs automatically connect to your spreadsheet.
                  </p>
                  
                  {/* Add email */}
                  <div className="flex gap-1.5">
                    <input
                      type="email"
                      placeholder="Enter team member's Gmail..."
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="flex-1 bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg text-xs text-slate-700 placeholder:text-slate-300 focus:outline-none focus:border-indigo-400 transition-all font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newEmail.trim() && newEmail.includes("@")) {
                          onAddAllowedEmail(newEmail.trim());
                          setNewEmail("");
                        }
                      }}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white py-1.5 px-3 rounded-lg text-xs font-bold uppercase tracking-wider"
                    >
                      Auth
                    </button>
                  </div>

                  {/* Allowed emails list */}
                  <div className="space-y-1 pt-1 max-h-32 overflow-y-auto">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Authorized Gmail Accounts ({allowedEmails.length}):</span>
                    {allowedEmails.map((email) => {
                      const isSelf = email.toLowerCase() === currentUserEmail.toLowerCase();
                      return (
                        <div key={email} className="flex justify-between items-center bg-white border border-slate-100 py-1 px-2.5 rounded-lg text-[11px] font-mono">
                          <span className="text-slate-600 truncate max-w-[200px]">{email}</span>
                          {isSelf ? (
                            <span className="text-[8px] font-black text-emerald-600 bg-emerald-50 border border-emerald-100 px-1 rounded uppercase tracking-wider">Owner</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onRemoveAllowedEmail(email)}
                              className="text-slate-400 hover:text-rose-600 p-0.5"
                              title="Revoke access"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <p className="text-[9px] text-indigo-600 leading-normal bg-indigo-50/50 border border-indigo-100/30 p-2 rounded">
                    💡 <b>Crucial:</b> Remember to also share the spreadsheet URL itself with these Gmail addresses as an <b>Editor</b> in Google Sheets!
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-[11px] text-slate-600 space-y-1 leading-normal">
                    <div><b>Spreadsheet Owner:</b> <span className="font-mono text-slate-500 font-bold">{ownerEmail}</span></div>
                    <div><b>Your Authorization:</b> <span className="text-emerald-600 font-bold">Authenticated & Connected</span></div>
                  </div>
                  <p className="text-[9px] text-slate-400 leading-normal">
                    Your entries are successfully being written directly to the central sheet.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
