/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type AttendanceStatus = 'Present' | 'Absent' | 'Half Day' | 'Week Off';

export interface AttendanceRecord {
  id: string; // usually `${date}_${employee}`
  date: string; // YYYY-MM-DD
  employee: string;
  status: AttendanceStatus;
  notes: string;
  timestamp: string; // ISO string of when it was logged
}

export interface MonthlySummary {
  month: string; // e.g., "June 2026"
  employee: string;
  expectedDays: number;
  actualDays: number;
  halfDays: number;
  absentDays: number;
  attendancePct: string; // percentage string, e.g. "90.38%"
}

export interface SpreadsheetConfig {
  spreadsheetId: string;
  spreadsheetUrl: string;
  syncEnabled: boolean;
}
