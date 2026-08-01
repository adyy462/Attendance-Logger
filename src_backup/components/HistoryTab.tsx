/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Trash2, Calendar, Filter, MessageSquare, AlertCircle } from "lucide-react";
import { AttendanceRecord, AttendanceStatus } from "../types";

interface HistoryTabProps {
  logs: AttendanceRecord[];
  employees: string[];
  onDeleteLog: (logId: string) => void;
  currentUserEmail?: string;
}

export default function HistoryTab({ logs, employees, onDeleteLog, currentUserEmail }: HistoryTabProps) {
  const [selectedFilter, setSelectedFilter] = useState<string>("All");

  // Helper to format date like "Tue, Jun 16, 2026"
  const formatDateString = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getStatusBadgeClass = (status: AttendanceStatus) => {
    switch (status) {
      case "Present":
        return "bg-emerald-50 text-emerald-700 border border-emerald-100";
      case "Absent":
        return "bg-rose-50 text-rose-700 border border-rose-100";
      case "Half Day":
        return "bg-amber-50 text-amber-700 border border-amber-100";
      case "Week Off":
        return "bg-stone-50 text-stone-700 border border-stone-100";
      default:
        return "bg-slate-50 text-slate-700 border border-slate-100";
    }
  };

  // Sort logs by date descending, then timestamp descending
  const sortedLogs = [...logs].sort((a, b) => {
    const dateCompare = b.date.localeCompare(a.date);
    if (dateCompare !== 0) return dateCompare;
    return b.timestamp.localeCompare(a.timestamp);
  });

  // Filtered logs
  const filteredLogs = selectedFilter === "All"
    ? sortedLogs
    : sortedLogs.filter((log) => log.employee === selectedFilter);

  const getAvatarColor = (name: string) => {
    const firstChar = name.toUpperCase().charAt(0);
    if (firstChar === "A") return "bg-rose-500 text-white";
    if (firstChar === "K") return "bg-emerald-600 text-white";
    return "bg-slate-500 text-white";
  };

  const handleDeleteClick = (log: AttendanceRecord) => {
    const isAditya = log.employee.toLowerCase() === "aditya";
    if (isAditya && (!currentUserEmail || currentUserEmail.toLowerCase() !== "adyy462@gmail.com")) {
      alert("You don't have permission to delete Aditya's attendance.");
      return;
    }
    const isConfirmed = window.confirm(
      `Are you sure you want to delete the attendance log for ${log.employee} on ${formatDateString(log.date)}?`
    );
    if (isConfirmed) {
      onDeleteLog(log.id);
    }
  };

  return (
    <div className="space-y-4" id="history-tab-root">
      {/* Title */}
      <div>
        <h2 className="text-lg font-bold text-slate-800 tracking-tight">History</h2>
        <p className="text-[11px] text-slate-400 font-medium">All logged attendance entries</p>
      </div>

      {/* Dynamic Filters Bar */}
      <div className="flex gap-1.5 items-center overflow-x-auto pb-1 no-scrollbar" id="history-filters-container">
        {["All", ...employees].map((empName) => (
          <button
            key={empName}
            onClick={() => setSelectedFilter(empName)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-all ${
              selectedFilter === empName
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-white border border-slate-200 text-slate-500 hover:bg-slate-50"
            }`}
          >
            {empName}
          </button>
        ))}
      </div>

      {/* Logs List */}
      <div className="space-y-2.5" id="history-logs-list">
        {filteredLogs.length > 0 ? (
          filteredLogs.map((log) => (
            <div
              key={log.id}
              className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm flex items-center justify-between hover:border-slate-300 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                {/* Employee initial avatar */}
                <div className={`w-8 h-8 rounded-lg font-bold text-xs flex items-center justify-center ${getAvatarColor(log.employee)}`}>
                  {log.employee.charAt(0).toUpperCase()}
                </div>

                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-slate-800 text-xs">{log.employee}</span>
                    <span className="text-slate-300 text-xs">•</span>
                    <span className="text-slate-400 text-[11px] font-mono font-bold">{formatDateString(log.date)}</span>
                  </div>
                  {log.notes && (
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5 italic">
                      &ldquo;{log.notes}&rdquo;
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Status pill */}
                <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${getStatusBadgeClass(log.status)}`}>
                  {log.status}
                </span>

                {/* Trash delete action */}
                <button
                  onClick={() => handleDeleteClick(log)}
                  disabled={log.employee.toLowerCase() === "aditya" && (!currentUserEmail || currentUserEmail.toLowerCase() !== "adyy462@gmail.com")}
                  className={`p-1 rounded-md transition-all ${
                    log.employee.toLowerCase() === "aditya" && (!currentUserEmail || currentUserEmail.toLowerCase() !== "adyy462@gmail.com")
                      ? "text-slate-200 cursor-not-allowed opacity-50"
                      : "text-slate-300 hover:text-rose-500 hover:bg-rose-50"
                  }`}
                  title={
                    log.employee.toLowerCase() === "aditya" && (!currentUserEmail || currentUserEmail.toLowerCase() !== "adyy462@gmail.com")
                      ? "Permission denied"
                      : "Delete attendance entry"
                  }
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="bg-slate-50/50 border border-slate-200 rounded-xl p-6 text-center space-y-1.5">
            <AlertCircle className="w-6 h-6 text-slate-300 mx-auto" />
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">No logs found</h4>
            <p className="text-[10px] text-slate-400 max-w-xs mx-auto">
              {selectedFilter === "All"
                ? "No records logged yet. Check the Today tab to start logging."
                : `No records logged for ${selectedFilter} yet.`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
