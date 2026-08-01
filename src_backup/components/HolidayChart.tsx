/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { AttendanceRecord } from "../types";
import { Calendar, Info } from "lucide-react";

interface HolidayChartProps {
  employees: string[];
  logs: AttendanceRecord[];
  selectedMonthDate: Date;
}

export default function HolidayChart({
  employees,
  logs,
  selectedMonthDate,
}: HolidayChartProps) {
  const [hoveredSegment, setHoveredSegment] = useState<{
    employee: string;
    type: string;
    count: number;
  } | null>(null);

  const year = selectedMonthDate.getFullYear();
  const monthIndex = selectedMonthDate.getMonth();
  const currentMonthStr = selectedMonthDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  // Calculate days in the selected month
  const totalDaysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  // Retrieve stats for each employee
  const chartData = employees.map((employee) => {
    const monthLogs = logs.filter((l) => {
      const d = new Date(l.date);
      return (
        d.getFullYear() === year &&
        d.getMonth() === monthIndex &&
        l.employee === employee
      );
    });

    const present = monthLogs.filter((l) => l.status === "Present").length;
    const halfDay = monthLogs.filter((l) => l.status === "Half Day").length;
    const absent = monthLogs.filter((l) => l.status === "Absent").length;
    
    // Explicit week offs from logs
    const weekOffLogs = monthLogs.filter((l) => l.status === "Week Off").length;

    // Remaining days can be considered holidays / unscheduled week offs
    const scheduledDaysCount = present + halfDay + absent + weekOffLogs;
    const remainingDays = Math.max(0, totalDaysInMonth - scheduledDaysCount);
    
    // Holiday Tracking is the sum of Week Offs logged + unscheduled calendar holidays (weekends)
    const totalHolidays = weekOffLogs + remainingDays;

    return {
      employee,
      present,
      halfDay,
      absent,
      holidays: totalHolidays,
      total: totalDaysInMonth,
    };
  });

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-4" id="holiday-tracker-chart">
      {/* Chart Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Holiday & Attendance Performance</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{currentMonthStr}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-indigo-600 bg-indigo-50/50 px-2 py-0.5 rounded-md font-mono font-bold">
          <Info className="w-3 h-3" />
          <span>Interactive</span>
        </div>
      </div>

      {/* SVG Staggered Stacked Bar Chart */}
      <div className="relative pt-2 pb-1">
        <div className="space-y-4">
          {chartData.map((data) => {
            // Percentages for stacking
            const pctPresent = (data.present / data.total) * 100;
            const pctHalfDay = (data.halfDay / data.total) * 100;
            const pctAbsent = (data.absent / data.total) * 100;
            const pctHolidays = (data.holidays / data.total) * 100;

            return (
              <div key={data.employee} className="space-y-1.5">
                {/* Employee label and total days */}
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-700">{data.employee}</span>
                  <span className="text-[10px] font-mono text-slate-400 font-bold">
                    {data.total} Days Total
                  </span>
                </div>

                {/* Staggered Stacked Bar container */}
                <div className="h-7 w-full rounded-lg bg-slate-100 flex overflow-hidden border border-slate-200/40 relative">
                  {/* Present Segment */}
                  {data.present > 0 && (
                    <button
                      type="button"
                      onClick={() => {}}
                      onMouseEnter={() =>
                        setHoveredSegment({
                          employee: data.employee,
                          type: "Present",
                          count: data.present,
                        })
                      }
                      onMouseLeave={() => setHoveredSegment(null)}
                      className="bg-emerald-500 hover:bg-emerald-600 transition-colors h-full cursor-help flex items-center justify-center text-[10px] font-black text-white font-mono"
                      style={{ width: `${pctPresent}%` }}
                      title={`${data.present} Days Present`}
                    >
                      {pctPresent > 15 && data.present}
                    </button>
                  )}

                  {/* Half Day Segment */}
                  {data.halfDay > 0 && (
                    <button
                      type="button"
                      onClick={() => {}}
                      onMouseEnter={() =>
                        setHoveredSegment({
                          employee: data.employee,
                          type: "Half Day",
                          count: data.halfDay,
                        })
                      }
                      onMouseLeave={() => setHoveredSegment(null)}
                      className="bg-amber-500 hover:bg-amber-600 transition-colors h-full cursor-help flex items-center justify-center text-[10px] font-black text-white font-mono"
                      style={{ width: `${pctHalfDay}%` }}
                      title={`${data.halfDay} Half Days`}
                    >
                      {pctHalfDay > 15 && data.halfDay}
                    </button>
                  )}

                  {/* Absent Segment */}
                  {data.absent > 0 && (
                    <button
                      type="button"
                      onClick={() => {}}
                      onMouseEnter={() =>
                        setHoveredSegment({
                          employee: data.employee,
                          type: "Absent",
                          count: data.absent,
                        })
                      }
                      onMouseLeave={() => setHoveredSegment(null)}
                      className="bg-rose-500 hover:bg-rose-600 transition-colors h-full cursor-help flex items-center justify-center text-[10px] font-black text-white font-mono"
                      style={{ width: `${pctAbsent}%` }}
                      title={`${data.absent} Days Absent`}
                    >
                      {pctAbsent > 15 && data.absent}
                    </button>
                  )}

                  {/* Holidays/Week Off Segment */}
                  {data.holidays > 0 && (
                    <button
                      type="button"
                      onClick={() => {}}
                      onMouseEnter={() =>
                        setHoveredSegment({
                          employee: data.employee,
                          type: "Holidays & Weekoffs",
                          count: data.holidays,
                        })
                      }
                      onMouseLeave={() => setHoveredSegment(null)}
                      className="bg-slate-400 hover:bg-slate-500 transition-colors h-full cursor-help flex items-center justify-center text-[10px] font-black text-white font-mono"
                      style={{ width: `${pctHolidays}%` }}
                      title={`${data.holidays} Holidays / Weekoffs`}
                    >
                      {pctHolidays > 15 && data.holidays}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dynamic Hover Tooltip Info */}
      <div className="h-8 flex items-center justify-center bg-slate-50 border border-slate-100 rounded-lg text-xs">
        {hoveredSegment ? (
          <p className="font-medium text-slate-700 animate-fade-in">
            🎯 <span className="font-bold text-indigo-600">{hoveredSegment.employee}</span> has{" "}
            <span className="font-black text-slate-800 font-mono bg-white border border-slate-200 px-1.5 py-0.5 rounded mx-0.5">
              {hoveredSegment.count}
            </span>{" "}
            days of <span className="font-bold text-slate-600">{hoveredSegment.type}</span>
          </p>
        ) : (
          <p className="text-slate-400 font-medium">
            💡 Hover over the staggered bars to see exact holiday & performance counts!
          </p>
        )}
      </div>

      {/* Color Legend */}
      <div className="grid grid-cols-4 gap-1 pt-1.5 border-t border-slate-100">
        <div className="flex items-center gap-1.5 justify-center">
          <span className="w-2.5 h-2.5 rounded-md bg-emerald-500 shrink-0" />
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Present</span>
        </div>
        <div className="flex items-center gap-1.5 justify-center">
          <span className="w-2.5 h-2.5 rounded-md bg-amber-500 shrink-0" />
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Half Day</span>
        </div>
        <div className="flex items-center gap-1.5 justify-center">
          <span className="w-2.5 h-2.5 rounded-md bg-rose-500 shrink-0" />
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Absent</span>
        </div>
        <div className="flex items-center gap-1.5 justify-center">
          <span className="w-2.5 h-2.5 rounded-md bg-slate-400 shrink-0" />
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Holiday</span>
        </div>
      </div>
    </div>
  );
}
