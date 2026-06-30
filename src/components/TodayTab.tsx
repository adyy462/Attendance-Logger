/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { ChevronLeft, ChevronRight, PlusCircle, MessageSquare } from "lucide-react";
import { AttendanceStatus, AttendanceRecord } from "../types";

interface TodayTabProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
  employees: string[];
  logs: AttendanceRecord[];
  onLogAttendance: (employee: string, status: AttendanceStatus, notes: string) => void;
  onAddEmployee: (name: string) => void;
  currentUserEmail?: string;
}

export default function TodayTab({
  selectedDate,
  onDateChange,
  employees,
  logs,
  onLogAttendance,
  onAddEmployee,
  currentUserEmail,
}: TodayTabProps) {
  const [newEmpName, setNewEmpName] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [activeNotesField, setActiveNotesField] = useState<string | null>(null);
  const [tempNotes, setTempNotes] = useState<{ [employee: string]: string }>({});

  // Helper to format date like "June 30, 2026"
  const formatDateString = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const handlePrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    onDateChange(d.toLocaleDateString("sv-SE")); // YYYY-MM-DD
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    onDateChange(d.toLocaleDateString("sv-SE")); // YYYY-MM-DD
  };

  // Find logs for today
  const getLogForEmployee = (employee: string) => {
    return logs.find((l) => l.date === selectedDate && l.employee === employee);
  };

  const handleAddEmpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newEmpName.trim()) {
      onAddEmployee(newEmpName.trim());
      setNewEmpName("");
      setShowAddForm(false);
    }
  };

  // Color mappings for Avatars
  const getAvatarColor = (name: string) => {
    const firstChar = name.toUpperCase().charAt(0);
    if (firstChar === "A") return "bg-rose-500 text-white";
    if (firstChar === "K") return "bg-emerald-600 text-white";
    // General hashing
    const colors = [
      "bg-sky-500 text-white",
      "bg-indigo-500 text-white",
      "bg-violet-500 text-white",
      "bg-amber-500 text-white",
      "bg-orange-500 text-white",
      "bg-fuchsia-500 text-white",
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  return (
    <div className="space-y-4" id="today-tab-root">
      {/* Date Header Switcher */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex flex-col items-center">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Attendance Sheet</span>
        <h2 className="text-xs font-bold text-indigo-600 uppercase tracking-wide mt-0.5">Aditya & Kuldeep</h2>

        <div className="flex items-center gap-4 mt-3 w-full justify-between max-w-xs">
          <button
            onClick={handlePrevDay}
            className="p-1.5 hover:bg-slate-50 rounded-lg border border-slate-200 text-slate-600 transition-colors"
            id="prev-day-btn"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="text-center">
            <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">Today</span>
            <span className="text-sm font-bold text-slate-800 font-mono" id="current-selected-date">
              {formatDateString(selectedDate)}
            </span>
          </div>
          <button
            onClick={handleNextDay}
            className="p-1.5 hover:bg-slate-50 rounded-lg border border-slate-200 text-slate-600 transition-colors"
            id="next-day-btn"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Employees Attendance Logging Cards */}
      <div className="space-y-3">
        {employees.map((employee) => {
          const log = getLogForEmployee(employee);
          const currentStatus = log ? log.status : "not marked";
          const currentNotes = log ? log.notes : "";
          const isAditya = employee.toLowerCase() === "aditya";
          const canEdit = !isAditya || (currentUserEmail && currentUserEmail.toLowerCase() === "adyy462@gmail.com");

          return (
            <div
              key={employee}
              className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-sm space-y-3 relative overflow-hidden"
              id={`today-card-${employee.toLowerCase()}`}
            >
              {/* Colored status strip */}
              <div
                className={`absolute right-0 top-0 bottom-0 w-1.5 transition-all ${
                  currentStatus === "Present"
                    ? "bg-emerald-500"
                    : currentStatus === "Absent"
                    ? "bg-rose-500"
                    : currentStatus === "Half Day"
                    ? "bg-amber-500"
                    : currentStatus === "Week Off"
                    ? "bg-stone-400"
                    : "bg-slate-200"
                }`}
              />

              {/* Card Header Info */}
              <div className="flex items-center justify-between pr-3">
                <div className="flex items-center gap-2.5">
                  <div className={`w-9 h-9 rounded-lg font-bold text-sm flex items-center justify-center shadow-inner ${getAvatarColor(employee)}`}>
                    {employee.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">{employee}</h3>
                    <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                          currentStatus === "not marked" 
                            ? "bg-slate-100 text-slate-500" 
                            : currentStatus === "Present"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                            : currentStatus === "Absent"
                            ? "bg-rose-50 text-rose-700 border border-rose-100"
                            : currentStatus === "Half Day"
                            ? "bg-amber-50 text-amber-700 border border-amber-100"
                            : "bg-stone-50 text-stone-700 border border-stone-100"
                        }`}
                      >
                        {currentStatus === "not marked" ? "unmarked" : currentStatus}
                      </span>
                    </div>
                    {currentNotes && (
                      <span className="block text-[10px] text-amber-600 font-medium mt-1 italic">
                        &ldquo;{currentNotes}&rdquo;
                      </span>
                    )}
                  </div>
                </div>

                {/* WhatsApp & Quick notes triggers */}
                <div className="flex gap-1.5 items-center">
                  <button
                    onClick={() => {
                      if (!canEdit) return;
                      setActiveNotesField(activeNotesField === employee ? null : employee);
                      if (!tempNotes[employee]) {
                        setTempNotes({ ...tempNotes, [employee]: currentNotes });
                      }
                    }}
                    disabled={!canEdit}
                    className={`p-1 rounded-md border text-[10px] flex items-center gap-1 transition-all ${
                      !canEdit ? "opacity-50 cursor-not-allowed bg-slate-50 border-slate-200 text-slate-300" :
                      activeNotesField === employee
                        ? "bg-indigo-50 border-indigo-200 text-indigo-600"
                        : "bg-white hover:bg-slate-50 border-slate-200 text-slate-400 hover:text-slate-600"
                    }`}
                    title={!canEdit ? "Permission denied" : "Add custom note/remarks"}
                  >
                    <MessageSquare className="w-3 h-3" />
                    <span className="font-bold uppercase tracking-wider">Note</span>
                  </button>
                </div>
              </div>

              {/* Collapsible Notes Field */}
              {activeNotesField === employee && (
                <div className="px-0.5 py-0.5 flex gap-2">
                  <input
                    type="text"
                    value={tempNotes[employee] || ""}
                    onChange={(e) => setTempNotes({ ...tempNotes, [employee]: e.target.value })}
                    placeholder="Add remark (e.g. sick leave, late)..."
                    className="flex-1 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md text-xs text-slate-600 placeholder:text-slate-300 focus:outline-none focus:border-indigo-400 focus:bg-white transition-all"
                  />
                  <button
                    onClick={() => {
                      // Apply note immediately with current status (or default Present)
                      onLogAttendance(employee, log ? log.status : "Present", tempNotes[employee] || "");
                      setActiveNotesField(null);
                    }}
                    className="bg-indigo-600 text-white text-[10px] px-2.5 py-1 rounded-md font-bold hover:bg-indigo-700 transition-colors"
                  >
                    Save
                  </button>
                </div>
              )}

              {/* Status Action Buttons */}
              <div className="grid grid-cols-4 gap-1.5 pr-2 pt-0.5">
                {(["Present", "Absent", "Half Day", "Week Off"] as AttendanceStatus[]).map((status) => {
                  const isActive = currentStatus === status;
                  return (
                    <button
                      key={status}
                      disabled={!canEdit}
                      onClick={() => {
                        if (!canEdit) return;
                        let finalNotes = tempNotes[employee] || currentNotes;
                        if (status === "Absent") {
                          const reason = window.prompt(`Please enter the reason for ${employee}'s absence:`, finalNotes);
                          if (reason !== null) {
                            finalNotes = reason;
                          } else {
                            return; // User cancelled
                          }
                        }
                        
                        onLogAttendance(employee, status, finalNotes);
                        
                        if (status === "Absent") {
                          setTempNotes({ ...tempNotes, [employee]: finalNotes });
                        }
                      }}
                      className={`py-1.5 px-0.5 text-[10px] font-bold rounded-md border transition-all ${
                        !canEdit ? "opacity-50 cursor-not-allowed bg-slate-50 border-slate-200 text-slate-400" :
                        isActive
                          ? status === "Present"
                            ? "bg-emerald-600 border-emerald-600 text-white shadow-sm"
                            : status === "Absent"
                            ? "bg-rose-600 border-rose-600 text-white shadow-sm"
                            : status === "Half Day"
                            ? "bg-amber-600 border-amber-600 text-white shadow-sm"
                            : "bg-stone-600 border-stone-600 text-white shadow-sm"
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {status}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Custom Employee Module */}
      <div className="pt-1">
        {showAddForm ? (
          <form onSubmit={handleAddEmpSubmit} className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Add New Team Member</span>
            <div className="flex gap-2">
              <input
                type="text"
                value={newEmpName}
                onChange={(e) => setNewEmpName(e.target.value)}
                placeholder="Enter full name..."
                required
                className="flex-1 bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-xs text-slate-700 placeholder:text-slate-300 focus:outline-none focus:border-indigo-400"
              />
              <button
                type="submit"
                className="bg-indigo-600 text-white text-xs px-3.5 py-1.5 rounded-lg font-bold hover:bg-indigo-700 transition-colors"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="bg-white border border-slate-200 text-slate-500 text-xs px-2.5 py-1.5 rounded-lg font-bold hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setShowAddForm(true)}
            className="w-full border border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/10 text-slate-500 hover:text-indigo-600 py-2.5 rounded-xl font-bold text-[11px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all"
            id="add-team-member-btn"
          >
            <PlusCircle className="w-3.5 h-3.5" /> Add New Team Member
          </button>
        )}
      </div>


    </div>
  );
}
