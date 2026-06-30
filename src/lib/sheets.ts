/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AttendanceRecord, MonthlySummary, AttendanceStatus } from "../types";

const SPREADSHEET_NAME = "Attendance Logger Backend";

// Safe fetch wrapper that handles common response errors
async function sheetsFetch(url: string, token: string, options: RequestInit = {}) {
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    ...options.headers,
  };

  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const errText = await response.text();
    console.error(`Google Sheets API Error on ${url}:`, errText);
    throw new Error(`Google Sheets API Error: ${response.statusText} (${errText})`);
  }
  return response.json();
}

/**
 * Normalizes sheet names for resilient matching.
 */
function normSheetName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "");
}

/**
 * Dynamically resolves exact sheet titles present on the spreadsheet, falling back to defaults.
 */
export async function getExactSheetNames(spreadsheetId: string, token: string): Promise<{ sheet2: string; monthlySummary: string }> {
  try {
    const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`;
    const meta = await sheetsFetch(metaUrl, token);
    const existing: string[] = meta.sheets?.map((s: any) => s.properties?.title || "") || [];
    
    const sheet2 = existing.find(t => normSheetName(t) === normSheetName("Sheet2")) || "Sheet2";
    const monthlySummary = existing.find(t => normSheetName(t) === normSheetName("Monthly Summary")) || "Monthly Summary";
    return { sheet2, monthlySummary };
  } catch (err) {
    console.warn("Failed to fetch exact sheet names from metadata, using defaults:", err);
    return { sheet2: "Sheet2", monthlySummary: "Monthly Summary" };
  }
}

/**
 * Ensures the linked spreadsheet has the required sheets 'Attendance Log' and 'Monthly Summary'.
 * If they are missing, it creates and initializes them with headers and default values.
 */
export async function ensureRequiredSheetsExist(spreadsheetId: string, token: string): Promise<void> {
  const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`;
  const meta = await sheetsFetch(metaUrl, token);
  
  const existingSheets: string[] = meta.sheets?.map((s: any) => s.properties?.title || "") || [];
  const existingSheetsNorm = existingSheets.map(s => normSheetName(s));
  
  const missingSheets: string[] = [];
  if (!existingSheetsNorm.includes(normSheetName("Sheet2"))) {
    missingSheets.push("Sheet2");
  }
  if (!existingSheetsNorm.includes(normSheetName("Monthly Summary"))) {
    missingSheets.push("Monthly Summary");
  }
  
  if (missingSheets.length > 0) {
    const batchUpdateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
    const requests = missingSheets.map(title => ({
      addSheet: {
        properties: {
          title,
          gridProperties: {
            frozenRowCount: 1,
          },
        },
      },
    }));
    
    try {
      await sheetsFetch(batchUpdateUrl, token, {
        method: "POST",
        body: JSON.stringify({ requests }),
      });
    } catch (err) {
      console.warn("BatchUpdate to create missing sheets failed (already exists or permission restricted):", err);
    }
    
    // Now initialize any newly created sheets we detected were missing
    if (missingSheets.includes("Sheet2")) {
      try {
        const logHeadersUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet2!A1:E1?valueInputOption=USER_ENTERED`;
        await sheetsFetch(logHeadersUrl, token, {
          method: "PUT",
          body: JSON.stringify({
            values: [["Date", "Employee", "Status", "Notes", "Timestamp"]],
          }),
        });
        
        // Seed starter logs
        const sampleLogs = [
          ["2026-06-16", "Aditya", "Half Day", "appointment", new Date("2026-06-16T10:00:00Z").toISOString()],
          ["2026-06-15", "Aditya", "Present", "", new Date("2026-06-15T09:00:00Z").toISOString()],
          ["2026-06-15", "Kuldeep", "Absent", "", new Date("2026-06-15T09:30:00Z").toISOString()],
          ["2026-06-08", "Aditya", "Week Off", "", new Date("2026-06-08T08:00:00Z").toISOString()],
        ];
        const logAppendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet2!A2:E100:append?valueInputOption=USER_ENTERED`;
        await sheetsFetch(logAppendUrl, token, {
          method: "POST",
          body: JSON.stringify({
            values: sampleLogs,
          }),
        });
      } catch (err) {
        console.error("Failed to initialize Sheet2:", err);
      }
    }
    
    if (missingSheets.includes("Monthly Summary")) {
      try {
        const summaryHeadersUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Monthly Summary!A1:G1?valueInputOption=USER_ENTERED`;
        await sheetsFetch(summaryHeadersUrl, token, {
          method: "PUT",
          body: JSON.stringify({
            values: [["Month", "Employee", "Expected Days", "Actual Days Present", "Half Days", "Absent Days", "Attendance %"]],
          }),
        });
        
        const starterRows = [
          ["June 2026", "Aditya", "26", "24", "1", "2", "90.38%"],
          ["June 2026", "Kuldeep", "29", "21", "0", "8", "72.41%"],
          ["July 2026", "Aditya", "31", "0", "0", "0", "0.00%"],
          ["July 2026", "Kuldeep", "31", "0", "0", "0", "0.00%"],
          ["August 2026", "Aditya", "31", "0", "0", "0", "0.00%"],
          ["August 2026", "Kuldeep", "31", "0", "0", "0", "0.00%"],
        ];
        const summaryAppendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Monthly Summary!A2:G100:append?valueInputOption=USER_ENTERED`;
        await sheetsFetch(summaryAppendUrl, token, {
          method: "POST",
          body: JSON.stringify({
            values: starterRows,
          }),
        });
      } catch (err) {
        console.error("Failed to initialize Monthly Summary:", err);
      }
    }
  }
}

/**
 * Searches the user's Drive for the Attendance Logger Backend spreadsheet.
 * Returns the spreadsheet ID if found, otherwise null.
 */
export async function findBackendSpreadsheet(token: string): Promise<string | null> {
  const q = encodeURIComponent(`name = '${SPREADSHEET_NAME}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,webViewLink)`;
  
  try {
    const data = await sheetsFetch(url, token);
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }
    return null;
  } catch (err) {
    console.error("Error searching spreadsheet in Drive:", err);
    return null;
  }
}

/**
 * Creates a new spreadsheet named 'Attendance Logger Backend' in the user's Drive,
 * with the correct starting sheets: 'Sheet2' and 'Monthly Summary'.
 * Pre-populates default summary rows from the CSV structure.
 */
export async function createBackendSpreadsheet(token: string): Promise<{ id: string; url: string }> {
  const url = "https://sheets.googleapis.com/v4/spreadsheets";
  
  const body = {
    properties: {
      title: SPREADSHEET_NAME,
    },
    sheets: [
      {
        properties: {
          title: "Sheet2",
          gridProperties: {
            frozenRowCount: 1,
          },
        },
      },
      {
        properties: {
          title: "Monthly Summary",
          gridProperties: {
            frozenRowCount: 1,
          },
        },
      },
    ],
  };

  const data = await sheetsFetch(url, token, {
    method: "POST",
    body: JSON.stringify(body),
  });

  const spreadsheetId = data.spreadsheetId;
  const spreadsheetUrl = data.spreadsheetUrl;

  // Initialize both sheets with headers and defaults
  await initializeSheets(spreadsheetId, token);

  return { id: spreadsheetId, url: spreadsheetUrl };
}

/**
 * Sets up headers and default values on creation
 */
async function initializeSheets(spreadsheetId: string, token: string) {
  // 1. Set Log headers
  const logHeadersUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet2!A1:E1?valueInputOption=USER_ENTERED`;
  await sheetsFetch(logHeadersUrl, token, {
    method: "PUT",
    body: JSON.stringify({
      values: [["Date", "Employee", "Status", "Notes", "Timestamp"]],
    }),
  });

  // 2. Set Summary headers and starter values
  const summaryHeadersUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Monthly Summary!A1:G1?valueInputOption=USER_ENTERED`;
  await sheetsFetch(summaryHeadersUrl, token, {
    method: "PUT",
    body: JSON.stringify({
      values: [["Month", "Employee", "Expected Days", "Actual Days Present", "Half Days", "Absent Days", "Attendance %"]],
    }),
  });

  // Starter summary rows based on June-December defaults
  const starterRows = [
    ["June 2026", "Aditya", "26", "24", "1", "2", "90.38%"],
    ["June 2026", "Kuldeep", "29", "21", "0", "8", "72.41%"],
    ["July 2026", "Aditya", "31", "0", "0", "0", "0.00%"],
    ["July 2026", "Kuldeep", "31", "0", "0", "0", "0.00%"],
    ["August 2026", "Aditya", "31", "0", "0", "0", "0.00%"],
    ["August 2026", "Kuldeep", "31", "0", "0", "0", "0.00%"],
    ["September 2026", "Aditya", "30", "0", "0", "0", "0.00%"],
    ["September 2026", "Kuldeep", "30", "0", "0", "0", "0.00%"],
    ["October 2026", "Aditya", "31", "0", "0", "0", "0.00%"],
    ["October 2026", "Kuldeep", "31", "0", "0", "0", "0.00%"],
    ["November 2026", "Aditya", "30", "0", "0", "0", "0.00%"],
    ["November 2026", "Kuldeep", "30", "0", "0", "0", "0.00%"],
    ["December 2026", "Aditya", "31", "0", "0", "0", "0.00%"],
    ["December 2026", "Kuldeep", "31", "0", "0", "0", "0.00%"],
  ];

  // Append starter rows to summary
  const summaryAppendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Monthly Summary!A2:G100:append?valueInputOption=USER_ENTERED`;
  await sheetsFetch(summaryAppendUrl, token, {
    method: "POST",
    body: JSON.stringify({
      values: starterRows,
    }),
  });

  // Let's seed a few sample logs in the backend to match the initial June screenshot state:
  const sampleLogs = [
    ["2026-06-16", "Aditya", "Half Day", "appointment", new Date("2026-06-16T10:00:00Z").toISOString()],
    ["2026-06-15", "Aditya", "Present", "", new Date("2026-06-15T09:00:00Z").toISOString()],
    ["2026-06-15", "Kuldeep", "Absent", "", new Date("2026-06-15T09:30:00Z").toISOString()],
    ["2026-06-08", "Aditya", "Week Off", "", new Date("2026-06-08T08:00:00Z").toISOString()],
  ];

  const logAppendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet2!A2:E100:append?valueInputOption=USER_ENTERED`;
  await sheetsFetch(logAppendUrl, token, {
    method: "POST",
    body: JSON.stringify({
      values: sampleLogs,
    }),
  });
}

/**
 * Helper to parse month/year string.
 */
function parseMonthStr(str: string): { year: number; monthIndex: number } | null {
  if (!str) return null;
  const s = str.trim().toLowerCase();

  // Try matching standard YYYY-MM
  const yyyymm = s.match(/^(\d{4})[-/](\d{1,2})$/);
  if (yyyymm) {
    return {
      year: parseInt(yyyymm[1], 10),
      monthIndex: parseInt(yyyymm[2], 10) - 1
    };
  }

  // Try matching MM-YYYY or MM/YYYY
  const mmyyyy = s.match(/^(\d{1,2})[-/](\d{4})$/);
  if (mmyyyy) {
    return {
      year: parseInt(mmyyyy[2], 10),
      monthIndex: parseInt(mmyyyy[1], 10) - 1
    };
  }

  // Try finding month names
  const months = [
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december"
  ];
  const shortMonths = [
    "jan", "feb", "mar", "apr", "may", "jun",
    "jul", "aug", "sep", "oct", "nov", "dec"
  ];

  let foundMonthIndex = -1;
  for (let i = 0; i < months.length; i++) {
    if (s.includes(months[i])) {
      foundMonthIndex = i;
      break;
    }
  }

  if (foundMonthIndex === -1) {
    for (let i = 0; i < shortMonths.length; i++) {
      if (s.includes(shortMonths[i])) {
        foundMonthIndex = i;
        break;
      }
    }
  }

  // Find a 4-digit year
  const yearMatch = s.match(/\b(\d{4})\b/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear();

  if (foundMonthIndex !== -1) {
    return { year, monthIndex: foundMonthIndex };
  }

  return null;
}

/**
 * Helper to map cell value to standard AttendanceStatus
 */
function mapCellValueToStatus(val: any): AttendanceStatus | null {
  if (val === undefined || val === null) return null;
  const clean = String(val).trim().toLowerCase();
  if (clean === "present" || clean === "p" || clean === "✓" || clean === "1" || clean === "yes" || clean === "pr") return "Present";
  if (clean === "absent" || clean === "a" || clean === "x" || clean === "no" || clean === "ab") return "Absent";
  if (clean === "half day" || clean === "hd" || clean === "half" || clean === "0.5") return "Half Day";
  if (clean === "week off" || clean === "wo" || clean === "off" || clean === "w" || clean === "h") return "Week Off";
  return null;
}

/**
 * Helper to map standard AttendanceStatus to cell value
 */
function mapStatusToCellValue(status: AttendanceStatus, useShortCodes: boolean): string {
  if (useShortCodes) {
    switch (status) {
      case "Present": return "P";
      case "Absent": return "A";
      case "Half Day": return "HD";
      case "Week Off": return "WO";
    }
  }
  return status;
}

/**
 * Dynamically retrieves sheet properties, auto-selects the primary log/data sheet,
 * and analyzes the headers to check if it's a pivot grid (days of the month as columns)
 * or a transactional log (columns: Date, Employee, Status).
 */
export async function getPrimarySheetInfo(spreadsheetId: string, token: string): Promise<{
  sheetName: string;
  isPivot: boolean;
  employeeColIndex: number;
  monthColIndex: number;
  dayToColIndex: { [day: number]: number };
  headers: string[];
}> {
  // 1. Fetch all sheet names
  const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`;
  const meta = await sheetsFetch(metaUrl, token);
  const sheetTitles: string[] = meta.sheets?.map((s: any) => s.properties?.title || "") || [];

  if (sheetTitles.length === 0) {
    throw new Error("No sheets found in the Google Spreadsheet.");
  }

  // 2. Select the best sheet to use
  // We prefer sheets with common names like "Sheet2", "Attendance Log", "Attendance", or fallback to the first sheet.
  let sheetName = sheetTitles[0];
  const preferredNames = ["sheet2", "attendance log", "attendance", "logs", "sheet1"];
  for (const pref of preferredNames) {
    const found = sheetTitles.find(t => normSheetName(t) === normSheetName(pref));
    if (found) {
      sheetName = found;
      break;
    }
  }

  // 3. Fetch first row (headers)
  const headersUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!A1:AZ1`;
  let headers: string[] = [];
  try {
    const resp = await sheetsFetch(headersUrl, token);
    headers = resp.values?.[0] || [];
  } catch (err) {
    console.warn(`Failed to fetch headers for sheet ${sheetName}, defaulting to transactional:`, err);
    return {
      sheetName,
      isPivot: false,
      employeeColIndex: 1,
      monthColIndex: -1,
      dayToColIndex: {},
      headers: ["Date", "Employee", "Status", "Notes", "Timestamp"]
    };
  }

  // 4. Analyze headers
  let employeeColIndex = -1;
  let monthColIndex = -1;
  const dayToColIndex: { [day: number]: number } = {};
  let isPivot = false;

  for (let i = 0; i < headers.length; i++) {
    const val = (headers[i] || "").trim().toLowerCase();
    if (val === "employee" || val === "employee name" || val === "name" || val === "emp") {
      employeeColIndex = i;
    } else if (val === "month" || val === "month/year" || val === "period" || val === "month & year") {
      monthColIndex = i;
    } else {
      const num = parseInt(val, 10);
      if (!isNaN(num) && num >= 1 && num <= 31) {
        dayToColIndex[num] = i;
        isPivot = true;
      }
    }
  }

  // Fallbacks if not found
  if (employeeColIndex === -1) {
    employeeColIndex = headers.findIndex(h => {
      const lh = h.toLowerCase();
      return lh.includes("employee") || lh.includes("name") || lh.includes("staff");
    });
    if (employeeColIndex === -1) employeeColIndex = 0;
  }
  if (monthColIndex === -1) {
    monthColIndex = headers.findIndex(h => {
      const lh = h.toLowerCase();
      return lh.includes("month") || lh.includes("period");
    });
    if (monthColIndex === -1) monthColIndex = 1;
  }

  return {
    sheetName,
    isPivot,
    employeeColIndex,
    monthColIndex,
    dayToColIndex,
    headers
  };
}

/**
 * Helper to parse record rows in standard transactional format.
 */
function parseLogs(rows: any[][]): AttendanceRecord[] {
  return rows.map((row: any[]) => {
    const [date, employee, status, notes, timestamp] = row;
    return {
      id: `${date}_${employee}`,
      date: date || "",
      employee: employee || "",
      status: (status as any) || "Present",
      notes: notes || "",
      timestamp: timestamp || new Date().toISOString(),
    };
  }).filter((r: any) => r.date && r.employee);
}

/**
 * Helper to parse summary rows.
 */
function parseSummaries(rows: any[][]): MonthlySummary[] {
  return rows.map((row: any[]) => {
    const [month, employee, expectedDays, actualDays, halfDays, absentDays, attendancePct] = row;
    return {
      month: month || "",
      employee: employee || "",
      expectedDays: Number(expectedDays) || 0,
      actualDays: Number(actualDays) || 0,
      halfDays: Number(halfDays) || 0,
      absentDays: Number(absentDays) || 0,
      attendancePct: attendancePct || "0.00%",
    };
  }).filter((s: any) => s.month && s.employee);
}

/**
 * Fetches all logs and summaries from Google Sheets.
 */
export async function fetchSpreadsheetData(spreadsheetId: string, token: string): Promise<{
  logs: AttendanceRecord[];
  summaries: MonthlySummary[];
}> {
  try {
    const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`;
    const meta = await sheetsFetch(metaUrl, token);
    const sheetTitles: string[] = meta.sheets?.map((s: any) => s.properties?.title || "") || [];

    let logs: AttendanceRecord[] = [];
    let summaries: MonthlySummary[] = [];

    // Identify month sheets (anything matching Month YYYY or fallback to Sheet2 for old data)
    const monthRegex = /^(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}$/i;
    const logSheets = sheetTitles.filter(t => monthRegex.test(t.trim()) || t.trim().toLowerCase() === "sheet2");

    // Fetch from all log sheets
    for (const sheetName of logSheets) {
      try {
        const urlSingle = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!A2:E2000`;
        const dataSingle = await sheetsFetch(urlSingle, token);
        const sheetLogs = parseLogs(dataSingle.values || []);
        logs = logs.concat(sheetLogs);
      } catch (innerErr) {
        console.warn(`Failed to load logs from sheet ${sheetName}:`, innerErr);
      }
    }

    // 4. Load Monthly Summary sheet if it exists
    const summarySheetName = sheetTitles.find(t => normSheetName(t) === normSheetName("Monthly Summary"));
    if (summarySheetName) {
      try {
        const summaryUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(summarySheetName)}!A2:G500`;
        const summaryData = await sheetsFetch(summaryUrl, token);
        summaries = parseSummaries(summaryData.values || []);
      } catch (err) {
        console.warn("Could not load optional 'Monthly Summary' sheet, summaries will be computed dynamically:", err);
      }
    }

    return { logs, summaries };
  } catch (err) {
    console.error("Error fetching spreadsheet data:", err);
    throw err;
  }
}

/**
 * Saves all logs to Google Sheets (clears old logs and rewrites them to preserve sort and edits)
 * Separates logs into distinct sheets for each month (e.g., "June 2026").
 */
export async function saveLogsToSpreadsheet(spreadsheetId: string, token: string, logs: AttendanceRecord[]) {
  try {
    const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`;
    const meta = await sheetsFetch(metaUrl, token);
    const existingSheets: string[] = meta.sheets?.map((s: any) => s.properties?.title || "") || [];

    // Group logs by month string
    const logsByMonth: { [monthStr: string]: AttendanceRecord[] } = {};
    for (const log of logs) {
      const d = new Date(log.date);
      const monthStr = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      if (!logsByMonth[monthStr]) logsByMonth[monthStr] = [];
      logsByMonth[monthStr].push(log);
    }

    // Write to each month's sheet
    for (const [monthStr, monthLogs] of Object.entries(logsByMonth)) {
      // 1. Create sheet if it doesn't exist
      if (!existingSheets.includes(monthStr)) {
        try {
          const createUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
          await sheetsFetch(createUrl, token, {
            method: "POST",
            body: JSON.stringify({
              requests: [{
                addSheet: { properties: { title: monthStr, gridProperties: { frozenRowCount: 1 } } }
              }]
            }),
          });
          
          // Write headers
          const headersUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(monthStr)}!A1:E1?valueInputOption=USER_ENTERED`;
          await sheetsFetch(headersUrl, token, {
            method: "PUT",
            body: JSON.stringify({ values: [["Date", "Employee", "Status", "Notes", "Timestamp"]] }),
          });
          
          existingSheets.push(monthStr); // Mark as created
        } catch (err) {
          console.warn(`Could not create sheet ${monthStr}:`, err);
        }
      }

      // 2. Prepare values
      const values = monthLogs.map(log => [
        log.date,
        log.employee,
        log.status,
        log.notes || "",
        log.timestamp
      ]);

      // 3. Clear existing logs in that sheet
      try {
        const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(monthStr)}!A2:E2000:clear`;
        await sheetsFetch(clearUrl, token, { method: "POST" });
      } catch (err) {
        console.warn(`Could not clear logs range in ${monthStr}:`, err);
      }

      // 4. Write new values
      if (values.length > 0) {
        const writeUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(monthStr)}!A2:E2000?valueInputOption=USER_ENTERED`;
        await sheetsFetch(writeUrl, token, {
          method: "PUT",
          body: JSON.stringify({ values }),
        });
      }
    }
  } catch (err) {
    console.error("Failed to save logs to spreadsheet:", err);
    throw err;
  }
}

/**
 * Saves summaries to Google Sheets (clears old and rewrites them) - completely optional/graceful!
 */
export async function saveSummariesToSpreadsheet(spreadsheetId: string, token: string, summaries: MonthlySummary[]) {
  try {
    const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`;
    const meta = await sheetsFetch(metaUrl, token);
    const sheetTitles: string[] = meta.sheets?.map((s: any) => s.properties?.title || "") || [];
    const summarySheetName = sheetTitles.find(t => normSheetName(t) === normSheetName("Monthly Summary"));

    if (!summarySheetName) {
      console.info("Monthly Summary sheet does not exist in spreadsheet; skipping summaries write (computed dynamically in UI).");
      return;
    }

    const range = `${summarySheetName}!A2:G500`;
    const values = summaries.map(s => [
      s.month,
      s.employee,
      String(s.expectedDays),
      String(s.actualDays),
      String(s.halfDays),
      String(s.absentDays),
      s.attendancePct
    ]);

    try {
      const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(summarySheetName)}!A2:G500:clear`;
      await sheetsFetch(clearUrl, token, { method: "POST" });
    } catch (clearErr) {
      console.warn("Could not clear Monthly Summary range (continuing):", clearErr);
    }

    const writeUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`;
    await sheetsFetch(writeUrl, token, {
      method: "PUT",
      body: JSON.stringify({ values }),
    });
  } catch (err) {
    console.warn("Optional Monthly Summary sheet could not be updated (attendance logs are still saved successfully):", err);
  }
}

