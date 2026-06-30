/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { ChevronLeft, ChevronRight, FileSpreadsheet, Download, RefreshCw, Printer } from "lucide-react";
import { AttendanceStatus, AttendanceRecord, MonthlySummary } from "../types";
import HolidayChart from "./HolidayChart";

interface SummaryTabProps {
  logs: AttendanceRecord[];
  employees: string[];
  summaries: MonthlySummary[];
  onExportCsv: (monthStr: string) => void;
  isExporting: boolean;
}

export default function SummaryTab({
  logs,
  employees,
  summaries,
  onExportCsv,
  isExporting,
}: SummaryTabProps) {
  const [selectedMonthDate, setSelectedMonthDate] = useState(() => {
    // Default to June 2026 as in the screenshots
    return new Date(2026, 5, 1); // June (0-indexed month 5)
  });

  const [aiInsights, setAiInsights] = useState<string | null>(null);
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);

  const handlePrevMonth = () => {
    setSelectedMonthDate(new Date(selectedMonthDate.getFullYear(), selectedMonthDate.getMonth() - 1, 1));
    setAiInsights(null);
  };

  const handleNextMonth = () => {
    setSelectedMonthDate(new Date(selectedMonthDate.getFullYear(), selectedMonthDate.getMonth() + 1, 1));
    setAiInsights(null);
  };

  const formatMonthYear = (date: Date) => {
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  const currentMonthStr = formatMonthYear(selectedMonthDate); // e.g. "June 2026"

  const handleGenerateInsights = async () => {
    setIsGeneratingInsights(true);
    setAiInsights(null);
    try {
      const relevantLogs = logs.filter(l => {
        const d = new Date(l.date);
        return d.getFullYear() === selectedMonthDate.getFullYear() && d.getMonth() === selectedMonthDate.getMonth();
      });
      const relevantSummaries = summaries.filter(s => s.month === currentMonthStr);

      const res = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month: currentMonthStr,
          logs: relevantLogs,
          summaries: relevantSummaries
        })
      });
      const data = await res.json();
      if (data.success) {
        setAiInsights(data.text);
      } else {
        setAiInsights("Failed to generate insights: " + data.error);
      }
    } catch (err: any) {
      setAiInsights("Error connecting to insights server.");
    } finally {
      setIsGeneratingInsights(false);
    }
  };

  const handlePrintDetailedReport = () => {
    const year = selectedMonthDate.getFullYear();
    const monthIndex = selectedMonthDate.getMonth();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

    let printHtml = `
      <html>
        <head>
          <title>Attendance Report - ${currentMonthStr}</title>
          <style>
            body { font-family: 'Arial', sans-serif; padding: 20px; font-size: 10px; }
            h1 { text-align: center; font-size: 16px; margin-bottom: 20px; text-transform: uppercase; }
            table { width: 100%; border-collapse: collapse; text-align: center; }
            th, td { border: 1px solid #ccc; padding: 4px; min-width: 20px; }
            th { background-color: #f8f9fa; font-weight: bold; }
            .employee-col { text-align: left; font-weight: bold; width: 120px; }
            .P { background-color: #d1fae5; color: #065f46; }
            .A { background-color: #ffe4e6; color: #9f1239; }
            .H { background-color: #fef3c7; color: #92400e; }
            .W { background-color: #f3f4f6; color: #374151; }
          </style>
        </head>
        <body>
          <h1>Attendance Report - ${currentMonthStr}</h1>
          <table>
            <thead>
              <tr>
                <th class="employee-col">Employee</th>
                ${Array.from({ length: daysInMonth }, (_, i) => `<th>${i + 1}</th>`).join("")}
              </tr>
            </thead>
            <tbody>
    `;

    employees.forEach(employee => {
      printHtml += `<tr><td class="employee-col">${employee}</td>`;
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        const log = logs.find(l => l.employee === employee && l.date === dateStr);
        let cellText = "";
        let cellClass = "";
        if (log) {
          if (log.status === "Present") { cellText = "P"; cellClass = "P"; }
          else if (log.status === "Absent") { cellText = "A"; cellClass = "A"; }
          else if (log.status === "Half Day") { cellText = "H"; cellClass = "H"; }
          else if (log.status === "Week Off") { cellText = "W"; cellClass = "W"; }
        }
        printHtml += `<td class="${cellClass}">${cellText}</td>`;
      }
      printHtml += `</tr>`;
    });

    printHtml += `
            </tbody>
          </table>
          <p style="margin-top:20px; text-align:right; font-size:10px;">Printed on: ${new Date().toLocaleString()}</p>
        </body>
      </html>
    `;

    const printWin = window.open("", "_blank");
    if (printWin) {
      printWin.document.open();
      printWin.document.write(printHtml);
      printWin.document.close();
      printWin.focus();
      // small timeout to allow CSS to load
      setTimeout(() => {
        printWin.print();
        printWin.close();
      }, 500);
    }
  };

  // Compute stats for each employee for the current selected month
  const getEmployeeStats = (employee: string) => {
    const year = selectedMonthDate.getFullYear();
    const monthIndex = selectedMonthDate.getMonth();
    
    // Filter logs that fall in this month/year
    const monthLogs = logs.filter((l) => {
      const d = new Date(l.date);
      return d.getFullYear() === year && d.getMonth() === monthIndex && l.employee === employee;
    });

    // Counts from actual logs
    const presentCount = monthLogs.filter((l) => l.status === "Present").length;
    const halfDayCount = monthLogs.filter((l) => l.status === "Half Day").length;
    const absentCount = monthLogs.filter((l) => l.status === "Absent").length;
    const weekOffCount = monthLogs.filter((l) => l.status === "Week Off").length;

    // Read Expected Days from Sheets summaries, or fall back to an elegant calculation
    // e.g. total days minus Sundays/Saturdays, or starter summaries
    const sheetSummary = summaries.find(
      (s) => s.employee === employee && s.month.toLowerCase().includes(currentMonthStr.toLowerCase())
    );

    let expectedDays = sheetSummary ? sheetSummary.expectedDays : 0;
    
    if (!expectedDays || expectedDays === 0) {
      // Calculate dynamic expected days (total days in month minus sundays)
      const totalDaysInMonth = new Date(year, monthIndex + 1, 0).getDate();
      let sundays = 0;
      for (let d = 1; d <= totalDaysInMonth; d++) {
        if (new Date(year, monthIndex, d).getDay() === 0) {
          sundays++;
        }
      }
      expectedDays = totalDaysInMonth - sundays; // default to weekdays-ish
    }

    // Actual working days present = Present count + (0.5 * Half Day count)
    // Wait, let's check how "Actual Days Present" is written in the spreadsheet.
    // In our reverse engineering, the spreadsheet "Actual Days Present" was count of (Present + Half Day) logs.
    // So actualDaysLogged = presentCount + halfDayCount;
    const actualDaysLogged = presentCount + halfDayCount;
    
    // Attendance score = (actualDaysLogged - 0.5 * halfDayCount) / expectedDays
    // Which is equivalent to: (presentCount + 0.5 * halfDayCount) / expectedDays
    const netPresentValue = presentCount + 0.5 * halfDayCount;
    const attendancePctNum = expectedDays > 0 ? (netPresentValue / expectedDays) * 100 : 0;
    const attendancePct = attendancePctNum.toFixed(2) + "%";

    return {
      expectedDays,
      actualDays: actualDaysLogged,
      halfDays: halfDayCount,
      absentDays: absentCount,
      weekOff: weekOffCount,
      attendancePct,
      attendancePctNum,
      netPresentValue,
    };
  };

  return (
    <div className="space-y-4" id="summary-tab-root">
      {/* Month Switcher & Export Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800 tracking-tight">Summary</h2>
          <p className="text-[11px] text-slate-400 font-medium">Monthly attendance overview</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handlePrintDetailedReport}
            className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 px-3.5 py-2 rounded-lg text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5"
            title="Print Detailed Status Report"
          >
            <Printer className="w-3.5 h-3.5" />
            Print
          </button>
          <button
            onClick={() => onExportCsv(currentMonthStr)}
            disabled={isExporting}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white px-3.5 py-2 rounded-lg text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5"
            id="export-csv-btn"
          >
            {isExporting ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            Export
          </button>
        </div>
      </div>

      {/* Month Control Carousel */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm flex items-center justify-between">
        <button
          onClick={handlePrevMonth}
          className="p-1 hover:bg-slate-50 rounded-lg border border-slate-200 text-slate-600 transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <span className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono">
          {currentMonthStr}
        </span>
        <button
          onClick={handleNextMonth}
          className="p-1 hover:bg-slate-50 rounded-lg border border-slate-200 text-slate-600 transition-colors"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Holiday performance interactive stacked bar chart */}
      <HolidayChart
        employees={employees}
        logs={logs}
        selectedMonthDate={selectedMonthDate}
      />

      {/* AI Insights Section */}
      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border border-indigo-100 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
            <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            AI Insights
          </h3>
          <button
            onClick={handleGenerateInsights}
            disabled={isGeneratingInsights}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-[10px] px-3 py-1.5 rounded-lg font-bold uppercase tracking-wider transition-colors"
          >
            {isGeneratingInsights ? "Analyzing..." : "Generate Insights"}
          </button>
        </div>
        
        {aiInsights ? (
          <div className="text-xs text-indigo-800 leading-relaxed bg-white/60 p-3 rounded-lg border border-indigo-100 markdown-body">
            {aiInsights.split('\n').map((line, i) => (
              <p key={i} className="mb-1">{line}</p>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-indigo-400">
            Click generate to analyze attendance patterns for {currentMonthStr} using Gemini AI.
          </p>
        )}
      </div>

      {/* Employee Summaries Lists */}
      <div className="space-y-4">
        {employees.map((employee) => {
          const stats = getEmployeeStats(employee);

          // Color for attendance % bubble
          const getPctBadgeClass = (pct: number) => {
            if (pct >= 85) return "bg-emerald-50 text-emerald-700 border border-emerald-200";
            if (pct >= 70) return "bg-amber-50 text-amber-700 border border-amber-200";
            return "bg-rose-50 text-rose-700 border border-rose-200";
          };

          return (
            <div
              key={employee}
              className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3"
              id={`summary-card-${employee.toLowerCase()}`}
            >
              {/* Top line with Employee Name and % */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-600 font-bold flex items-center justify-center border border-slate-200">
                    {employee.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">{employee}</h3>
                    <span className="text-[11px] text-slate-400 font-medium block mt-0.5">
                      <span className="font-mono font-bold text-slate-600">{stats.netPresentValue}</span> of <span className="font-mono font-bold text-slate-600">{stats.expectedDays}</span> working days
                    </span>
                  </div>
                </div>

                <div className={`px-2 py-0.5 rounded-full text-xs font-bold font-mono ${getPctBadgeClass(stats.attendancePctNum)}`}>
                  {stats.attendancePct}
                </div>
              </div>

              {/* Attendance Ratio Bar */}
              <div className="space-y-1">
                <div className="h-1.5 rounded-full bg-slate-100 flex overflow-hidden">
                  {/* Present section */}
                  <div
                    className="bg-emerald-500 h-full transition-all"
                    style={{
                      width: `${
                        stats.expectedDays > 0 ? (stats.actualDays / stats.expectedDays) * 100 : 0
                      }%`,
                    }}
                  />
                  {/* Half days section */}
                  <div
                    className="bg-amber-500 h-full transition-all"
                    style={{
                      width: `${
                        stats.expectedDays > 0 ? (stats.halfDays / stats.expectedDays) * 100 : 0
                      }%`,
                    }}
                  />
                  {/* Absent section */}
                  <div
                    className="bg-rose-500 h-full transition-all"
                    style={{
                      width: `${
                        stats.expectedDays > 0 ? (stats.absentDays / stats.expectedDays) * 100 : 0
                      }%`,
                    }}
                  />
                </div>
              </div>

              {/* 4-Item Stats Legend */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="flex items-center gap-2 p-1.5 bg-slate-50 border border-slate-100 rounded-lg">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <div>
                    <span className="text-xs font-bold text-slate-700 font-mono block leading-none">{stats.actualDays}</span>
                    <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider mt-0.5">Present</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-1.5 bg-slate-50 border border-slate-100 rounded-lg">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                  <div>
                    <span className="text-xs font-bold text-slate-700 font-mono block leading-none">{stats.halfDays}</span>
                    <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider mt-0.5">Half Day</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-1.5 bg-slate-50 border border-slate-100 rounded-lg">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                  <div>
                    <span className="text-xs font-bold text-slate-700 font-mono block leading-none">{stats.absentDays}</span>
                    <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider mt-0.5">Absent</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-1.5 bg-slate-50 border border-slate-100 rounded-lg">
                  <span className="w-1.5 h-1.5 rounded-full bg-stone-400 shrink-0" />
                  <div>
                    <span className="text-xs font-bold text-slate-700 font-mono block leading-none">{stats.weekOff}</span>
                    <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider mt-0.5">Week Off</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
