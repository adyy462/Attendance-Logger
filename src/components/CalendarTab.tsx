/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AttendanceStatus, AttendanceRecord } from "../types";

interface CalendarTabProps {
  logs: AttendanceRecord[];
  employees: string[];
  selectedDate: string;
  onDateSelect: (date: string) => void;
}

export default function CalendarTab({ logs, employees, selectedDate, onDateSelect }: CalendarTabProps) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date(selectedDate);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const formatMonthYear = (date: Date) => {
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  // Helper to generate dates for the calendar grid
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay(); // 0 = Sunday
    const totalDays = new Date(year, month + 1, 0).getDate();

    const days: (number | null)[] = [];
    
    // Pad first week
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }
    
    // Fill days
    for (let i = 1; i <= totalDays; i++) {
      days.push(i);
    }

    return days;
  };

  const days = getDaysInMonth(currentMonth);

  // Status color mapper for dots
  const getStatusDotClass = (status: AttendanceStatus | "not_marked") => {
    switch (status) {
      case "Present":
        return "bg-emerald-500";
      case "Absent":
        return "bg-rose-500";
      case "Half Day":
        return "bg-amber-500";
      case "Week Off":
        return "bg-stone-400";
      default:
        return "bg-slate-100";
    }
  };

  const getLogForDay = (day: number, employee: string) => {
    const year = currentMonth.getFullYear();
    const month = String(currentMonth.getMonth() + 1).padStart(2, "0");
    const dayStr = String(day).padStart(2, "0");
    const dateStr = `${year}-${month}-${dayStr}`;
    return logs.find((l) => l.date === dateStr && l.employee === employee);
  };

  // Check if a day is the selected date
  const isSelectedDay = (day: number) => {
    const year = currentMonth.getFullYear();
    const month = String(currentMonth.getMonth() + 1).padStart(2, "0");
    const dayStr = String(day).padStart(2, "0");
    const dateStr = `${year}-${month}-${dayStr}`;
    return selectedDate === dateStr;
  };

  const handleDayClick = (day: number) => {
    const year = currentMonth.getFullYear();
    const month = String(currentMonth.getMonth() + 1).padStart(2, "0");
    const dayStr = String(day).padStart(2, "0");
    onDateSelect(`${year}-${month}-${dayStr}`);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-4" id="calendar-tab-root">
      {/* Month Selector */}
      <div className="flex items-center justify-between">
        <button
          onClick={handlePrevMonth}
          className="p-1.5 hover:bg-slate-50 rounded-lg border border-slate-200 text-slate-600 transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <span className="text-sm font-bold text-slate-800 uppercase tracking-wide font-mono" id="calendar-month-title">
          {formatMonthYear(currentMonth)}
        </span>
        <button
          onClick={handleNextMonth}
          className="p-1.5 hover:bg-slate-50 rounded-lg border border-slate-200 text-slate-600 transition-colors"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Legend Area */}
      <div className="border-y border-slate-200 py-2.5 text-[9px] text-slate-500 font-bold uppercase tracking-wider space-y-1">
        <div className="flex items-center justify-between px-0.5">
          <div className="flex gap-2">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded bg-rose-400" /> Aditya
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded bg-emerald-600" /> Kuldeep
            </span>
          </div>
          <div className="flex gap-2">
            <span className="flex items-center gap-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> P
            </span>
            <span className="flex items-center gap-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> A
            </span>
            <span className="flex items-center gap-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> HD
            </span>
            <span className="flex items-center gap-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-stone-400" /> WO
            </span>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div>
        {/* Days of Week Headers */}
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 mb-1">
          {["S", "M", "T", "W", "T", "F", "S"].map((day, idx) => (
            <div key={idx} className="py-1 uppercase tracking-wider">
              {day}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-y-2 gap-x-1" id="calendar-days-grid">
          {days.map((day, idx) => {
            if (day === null) {
              return <div key={idx} className="aspect-square" />;
            }

            const isSelected = isSelectedDay(day);

            return (
              <button
                key={idx}
                onClick={() => handleDayClick(day)}
                className={`aspect-square flex flex-col items-center justify-between py-1.5 rounded-lg relative transition-all border ${
                  isSelected
                    ? "bg-indigo-50 border-indigo-200 text-indigo-700 font-bold shadow-sm"
                    : "border-transparent hover:bg-slate-50 text-slate-700 font-semibold"
                }`}
              >
                <span className="text-xs font-mono">{day}</span>

                {/* Horizontal row of status dots for each employee */}
                <div className="flex gap-0.5 items-center justify-center h-1.5 mt-0.5">
                  {employees.slice(0, 3).map((emp) => {
                    const log = getLogForDay(day, emp);
                    const status = log ? log.status : "not_marked";
                    return (
                      <span
                        key={emp}
                        className={`w-1 h-1 rounded-full transition-colors ${getStatusDotClass(status)}`}
                        title={`${emp}: ${status}`}
                      />
                    );
                  })}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
