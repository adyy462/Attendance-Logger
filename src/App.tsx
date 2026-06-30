/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import {
  Check,
  CheckCircle2,
  Calendar as CalendarIcon,
  History,
  BarChart3,
  Camera,
  Database,
  Sparkles,
  RefreshCw,
  AlertCircle,
  FolderSync
} from "lucide-react";
import { User } from "firebase/auth";

// Types
import { AttendanceRecord, AttendanceStatus, MonthlySummary } from "./types";

// Firebase & Sheets
import { initAuth, googleSignIn, logout, getSharedConfig, saveSharedConfig } from "./lib/firebase";
import {
  findBackendSpreadsheet,
  createBackendSpreadsheet,
  fetchSpreadsheetData,
  saveLogsToSpreadsheet,
  saveSummariesToSpreadsheet
} from "./lib/sheets";

// Sub-components
import Header from "./components/Header";
import TodayTab from "./components/TodayTab";
import CalendarTab from "./components/CalendarTab";
import SummaryTab from "./components/SummaryTab";
import HistoryTab from "./components/HistoryTab";
import SheetsConfig from "./components/SheetsConfig";

export default function App() {
  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Sheets Config state
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>("1qvv9YZlbErw2nHN00tqUfmDOxmeVfCCkcZmCxAxloOQ");
  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string | null>("https://docs.google.com/spreadsheets/d/1qvv9YZlbErw2nHN00tqUfmDOxmeVfCCkcZmCxAxloOQ/edit");
  const [syncEnabled, setSyncEnabled] = useState(true);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isSheetsLoading, setIsSheetsLoading] = useState(false);

  // Core Data state
  const [logs, setLogs] = useState<AttendanceRecord[]>([]);
  const [summaries, setSummaries] = useState<MonthlySummary[]>([]);
  const [employees, setEmployees] = useState<string[]>(["Aditya", "Kuldeep"]);
  
  // Navigation & Date state
  const [activeTab, setActiveTab] = useState<"Today" | "Calendar" | "Summary" | "History">("Today");
  const [selectedDate, setSelectedDate] = useState("2026-06-30"); // Initialized to June 30, 2026 to match visual mockups
  const [syncStatus, setSyncStatus] = useState<"synced" | "syncing" | "error" | "offline">("offline");

  const [errorAlert, setErrorAlert] = useState<string | null>(null);

  // Shared Configuration & Access Control state
  const [ownerEmail, setOwnerEmail] = useState<string>("adyy462@gmail.com");
  const [allowedEmails, setAllowedEmails] = useState<string[]>(["adyy462@gmail.com"]);
  const [isUserAuthorized, setIsUserAuthorized] = useState<boolean>(true);

  // Background Outbox Queue State
  const [pendingSync, setPendingSync] = useState<{ logs: boolean, summaries: boolean }>(() => {
    const saved = localStorage.getItem("pending_sync");
    return saved ? JSON.parse(saved) : { logs: false, summaries: false };
  });

  const updatePendingSync = (updates: Partial<{ logs: boolean, summaries: boolean }>) => {
    setPendingSync(prev => {
      const next = { ...prev, ...updates };
      localStorage.setItem("pending_sync", JSON.stringify(next));
      return next;
    });
  };

  // Background Sync Worker
  useEffect(() => {
    let isMounted = true;
    let syncInProgress = false;
    let timeoutId: NodeJS.Timeout | undefined;
    let retryCount = 0;
    const baseDelay = 5000; // 5 seconds
    const maxDelay = 300000; // 5 minutes

    const scheduleNextSync = (success: boolean) => {
      if (!isMounted) return;
      if (success) {
        retryCount = 0;
      } else {
        retryCount++;
      }
      const delay = success ? 10000 : Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(processSyncQueue, delay);
    };

    const processSyncQueue = async () => {
      if (!syncEnabled || !spreadsheetId || !token || syncInProgress) return;
      if (!navigator.onLine) {
        if (syncStatus !== "offline" && isMounted) setSyncStatus("offline");
        scheduleNextSync(false);
        return;
      }
      if (!pendingSync.logs && !pendingSync.summaries) {
         scheduleNextSync(true); // Keep polling slowly if nothing to sync
         return;
      }

      syncInProgress = true;
      if (isMounted) setSyncStatus("syncing");
      
      let success = true;
      try {
        if (pendingSync.logs && isMounted) {
          await saveLogsToSpreadsheet(spreadsheetId, token, logs);
          if (isMounted) updatePendingSync({ logs: false });
        }
        
        if (pendingSync.summaries && isMounted) {
          await saveSummariesToSpreadsheet(spreadsheetId, token, summaries);
          if (isMounted) updatePendingSync({ summaries: false });
        }

        if (isMounted) setSyncStatus("synced");
      } catch (err) {
        console.error("Failed background sync (will retry with backoff):", err);
        if (isMounted) setSyncStatus("error");
        success = false;
      } finally {
        syncInProgress = false;
        scheduleNextSync(success);
      }
    };

    // Process immediately when pendingSync changes
    processSyncQueue();

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [pendingSync, syncEnabled, spreadsheetId, token, logs, summaries]);

  // Daily Morning Reminder at 10:00 AM state
  const [showReminderToast, setShowReminderToast] = useState(false);
  const [reminderPermissions, setReminderPermissions] = useState<string>("default");

  // Initialize Auth on App Load
  useEffect(() => {
    const unsubscribe = initAuth(
      async (authUser, accessToken) => {
        setUser(authUser);
        setNeedsAuth(false);
        
        if (accessToken) {
          setToken(accessToken);
          setSyncStatus("syncing");
          // Auto load existing spreadsheet or find/create one with access control
          await handleSheetsOnboarding(accessToken, authUser);
        } else {
          setToken(null);
          setSyncStatus("error"); // indicates token expired but user is logged in
          loadOfflineData();
        }
      },
      () => {
        setNeedsAuth(true);
        setSyncStatus("offline");
        // Load offline storage fallback
        loadOfflineData();
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  // Syncing / Offline fallback loader
  const loadOfflineData = () => {
    const savedLogs = localStorage.getItem("attendance_logs");
    const savedEmployees = localStorage.getItem("attendance_employees");
    if (savedLogs) {
      setLogs(JSON.parse(savedLogs));
    }
    if (savedEmployees) {
      setEmployees(JSON.parse(savedEmployees));
    }
  };

  const saveOfflineData = (updatedLogs: AttendanceRecord[], updatedEmps: string[]) => {
    localStorage.setItem("attendance_logs", JSON.stringify(updatedLogs));
    localStorage.setItem("attendance_employees", JSON.stringify(updatedEmps));
  };

  // Google Sheets Auto onboarding & config
  const handleSheetsOnboarding = async (accessToken: string, loggedInUser?: User | null) => {
    setIsSheetsLoading(true);
    setErrorAlert(null);
    const activeUser = loggedInUser || user;
    if (!activeUser) {
      setIsSheetsLoading(false);
      return;
    }
    const userEmail = activeUser.email?.toLowerCase() || "";
    const HARDCODED_SPREADSHEET_ID = "1qvv9YZlbErw2nHN00tqUfmDOxmeVfCCkcZmCxAxloOQ";
    const hardcodedUrl = `https://docs.google.com/spreadsheets/d/${HARDCODED_SPREADSHEET_ID}/edit`;
    
    try {
      // 1. Fetch shared config from Firestore first
      let config = null;
      try {
        config = await getSharedConfig();
      } catch (firestoreErr) {
        console.warn("Could not retrieve shared config from Firestore (falling back to defaults):", firestoreErr);
      }
      
      let finalAllowed = config?.allowedEmails || ["adyy462@gmail.com"];
      let finalOwner = config?.ownerEmail || "adyy462@gmail.com";
      
      // Enforce owner/allowed email has Aditya's email as owner
      if (!finalAllowed.includes("adyy462@gmail.com")) {
        finalAllowed.push("adyy462@gmail.com");
      }
      if (userEmail && !finalAllowed.includes(userEmail) && userEmail === "adyy462@gmail.com") {
        finalAllowed.push(userEmail);
      }

      // If no config exists, or config spreadsheet is different, save the hardcoded configuration so it resides in Firestore.
      if (!config || config.spreadsheetId !== HARDCODED_SPREADSHEET_ID) {
        try {
          await saveSharedConfig(HARDCODED_SPREADSHEET_ID, hardcodedUrl, finalOwner, finalAllowed);
        } catch (firestoreErr) {
          console.warn("Could not save configuration to Firestore (continuing with offline fallback/local cache):", firestoreErr);
        }
      }

      setOwnerEmail(finalOwner);
      setAllowedEmails(finalAllowed);
      
      // 2. Check if user is owner or allowed
      const isOwner = userEmail === finalOwner.toLowerCase() || userEmail === "adyy462@gmail.com";
      const isAllowed = finalAllowed.some((e: string) => e.toLowerCase() === userEmail);
      
      if (isOwner || isAllowed) {
        setIsUserAuthorized(true);
        setSpreadsheetId(HARDCODED_SPREADSHEET_ID);
        setSpreadsheetUrl(hardcodedUrl);
        localStorage.setItem("attendance_spreadsheet_id", HARDCODED_SPREADSHEET_ID);
        
        // Fetch logs & summaries
        await loadDataFromSheets(HARDCODED_SPREADSHEET_ID, accessToken);
      } else {
        // Block access
        setIsUserAuthorized(false);
        setSyncStatus("offline");
      }
    } catch (err: any) {
      console.error(err);
      setSyncStatus("error");
      setErrorAlert("Failed to sync with Google Sheets. Displaying local cache instead.");
      loadOfflineData();
    } finally {
      setIsSheetsLoading(false);
    }
  };

  // Load actual values from spreadsheet
  const loadDataFromSheets = async (sheetId: string, accessToken: string) => {
    setSyncStatus("syncing");
    try {
      const data = await fetchSpreadsheetData(sheetId, accessToken);
      
      // Update local states
      if (data.logs && data.logs.length > 0) {
        setLogs(data.logs);
      }
      if (data.summaries && data.summaries.length > 0) {
        setSummaries(data.summaries);
      }

      // Check for any additional employees logged in logs
      const allUniqueEmployees = Array.from(
        new Set(["Aditya", "Kuldeep", ...data.logs.map((l) => l.employee)])
      ).filter(Boolean);
      setEmployees(allUniqueEmployees);

      // Save offline copy
      saveOfflineData(data.logs, allUniqueEmployees);
      setSyncStatus("synced");
    } catch (err) {
      console.error("Failed to load sheet data:", err);
      setSyncStatus("error");
      throw err;
    }
  };

  // Auto-mark Aditya as Week Off on Mondays
  useEffect(() => {
    const d = new Date(selectedDate);
    if (d.getDay() === 1) { // Monday
      const hasAdityaLog = logs.some(l => l.date === selectedDate && l.employee === "Aditya");
      if (!hasAdityaLog && employees.includes("Aditya")) {
        handleLogAttendance("Aditya", "Week Off", "Auto-filled Monday Week Off");
      }
    }
  }, [selectedDate, logs, employees]);

  // Trigger Google Sign In
  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    setErrorAlert(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
        setNeedsAuth(false);
        setSyncStatus("syncing");
        await handleSheetsOnboarding(result.accessToken, result.user);
      }
    } catch (err: any) {
      console.error(err);
      setErrorAlert("Google Sign-In failed or was canceled.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setToken(null);
    setSpreadsheetId(null);
    setSpreadsheetUrl(null);
    setNeedsAuth(true);
    setSyncStatus("offline");
    localStorage.removeItem("attendance_spreadsheet_id");
  };

  // Create template spreadsheet database
  const handleCreateNewSheet = async () => {
    if (!token || !user?.email) return;
    setIsSheetsLoading(true);
    setSyncStatus("syncing");
    try {
      const result = await createBackendSpreadsheet(token);
      setSpreadsheetId(result.id);
      setSpreadsheetUrl(result.url);
      localStorage.setItem("attendance_spreadsheet_id", result.id);

      const userEmail = user.email.toLowerCase();
      setOwnerEmail(userEmail);
      setAllowedEmails([userEmail]);
      setIsUserAuthorized(true);
      await saveSharedConfig(result.id, result.url, userEmail, [userEmail]);

      // Load newly seeded template data
      await loadDataFromSheets(result.id, token);
      setIsConfigOpen(false);
    } catch (err: any) {
      console.error(err);
      setSyncStatus("error");
      setErrorAlert("Failed to create spreadsheet template.");
    } finally {
      setIsSheetsLoading(false);
    }
  };

  // Link existing sheet manually
  const handleLinkExistingSheet = async (id: string) => {
    if (!token || !user?.email) return;
    setIsSheetsLoading(true);
    setSyncStatus("syncing");
    try {
      const url = `https://docs.google.com/spreadsheets/d/${id}/edit`;
      setSpreadsheetId(id);
      setSpreadsheetUrl(url);
      localStorage.setItem("attendance_spreadsheet_id", id);

      const userEmail = user.email.toLowerCase();
      setOwnerEmail(userEmail);
      setAllowedEmails([userEmail]);
      setIsUserAuthorized(true);
      await saveSharedConfig(id, url, userEmail, [userEmail]);

      await loadDataFromSheets(id, token);
      setIsConfigOpen(false);
    } catch (err: any) {
      console.error(err);
      setSyncStatus("error");
      setErrorAlert("Invalid Spreadsheet ID or lacks permission.");
    } finally {
      setIsSheetsLoading(false);
    }
  };

  // Log attendance: Instant updates + background sync
  const handleLogAttendance = async (employee: string, status: AttendanceStatus, notes: string) => {
    const isAditya = employee.toLowerCase() === "aditya";
    if (isAditya && (!user?.email || user.email.toLowerCase() !== "adyy462@gmail.com")) {
      alert("You don't have permission to edit Aditya's attendance.");
      return;
    }

    const recordId = `${selectedDate}_${employee}`;
    const timestamp = new Date().toISOString();

    const newRecord: AttendanceRecord = {
      id: recordId,
      date: selectedDate,
      employee,
      status,
      notes,
      timestamp,
    };

    // Filter out old record for same date + employee, and append new record
    const updatedLogs = logs.filter((l) => !(l.date === selectedDate && l.employee === employee));
    updatedLogs.push(newRecord);

    setLogs(updatedLogs);
    saveOfflineData(updatedLogs, employees);

    // Compute updated summaries
    const updatedSummaries = computeSummaries(updatedLogs, employees);
    setSummaries(updatedSummaries);

    // Queue for background push to Google Sheets if sync is enabled
    if (syncEnabled && spreadsheetId && token) {
      updatePendingSync({ logs: true, summaries: true });
    }
  };

  // Delete log: instant + background sync
  const handleDeleteLog = async (logId: string) => {
    const logToDelete = logs.find((l) => l.id === logId);
    if (logToDelete) {
      const isAditya = logToDelete.employee.toLowerCase() === "aditya";
      if (isAditya && (!user?.email || user.email.toLowerCase() !== "adyy462@gmail.com")) {
        alert("You don't have permission to delete Aditya's attendance.");
        return;
      }
    }

    const updatedLogs = logs.filter((l) => l.id !== logId);
    setLogs(updatedLogs);
    saveOfflineData(updatedLogs, employees);

    const updatedSummaries = computeSummaries(updatedLogs, employees);
    setSummaries(updatedSummaries);

    if (syncEnabled && spreadsheetId && token) {
      updatePendingSync({ logs: true, summaries: true });
    }
  };

  // Add custom employee
  const handleAddEmployee = async (name: string) => {
    if (!name || employees.includes(name)) return;
    const updatedEmps = [...employees, name];
    setEmployees(updatedEmps);
    saveOfflineData(logs, updatedEmps);

    // Automatically compute new summaries with this added employee
    const updatedSummaries = computeSummaries(logs, updatedEmps);
    setSummaries(updatedSummaries);

    // Queue for background sync
    if (syncEnabled && spreadsheetId && token) {
      updatePendingSync({ summaries: true });
    }
  };

  // Shared Configuration & Access Control handlers
  const handleAddAllowedEmail = async (email: string) => {
    if (!email || !spreadsheetId || !spreadsheetUrl || !user?.email) return;
    const cleanEmail = email.trim().toLowerCase();
    if (allowedEmails.includes(cleanEmail)) return;
    
    const updated = [...allowedEmails, cleanEmail];
    setAllowedEmails(updated);
    try {
      await saveSharedConfig(spreadsheetId, spreadsheetUrl, ownerEmail, updated);
    } catch (err) {
      console.error("Failed to save updated allowed emails:", err);
      setErrorAlert("Failed to save changes to cloud.");
    }
  };

  const handleRemoveAllowedEmail = async (email: string) => {
    if (!spreadsheetId || !spreadsheetUrl || !user?.email) return;
    const cleanEmail = email.trim().toLowerCase();
    const updated = allowedEmails.filter(e => e.toLowerCase() !== cleanEmail);
    setAllowedEmails(updated);
    try {
      await saveSharedConfig(spreadsheetId, spreadsheetUrl, ownerEmail, updated);
    } catch (err) {
      console.error("Failed to save updated allowed emails:", err);
      setErrorAlert("Failed to save changes to cloud.");
    }
  };

  // Daily Morning Reminder at 10:00 AM helpers
  const requestNotificationPermission = async () => {
    if ("Notification" in window) {
      try {
        const permission = await Notification.requestPermission();
        setReminderPermissions(permission);
        return permission;
      } catch (err) {
        console.error("Notification request failed:", err);
      }
    }
    return "default";
  };

  useEffect(() => {
    if ("Notification" in window) {
      setReminderPermissions(Notification.permission);
    }

    // Interval to check time every 15 seconds
    const interval = setInterval(() => {
      const now = new Date();
      if (now.getHours() === 10 && now.getMinutes() === 0) {
        const hasTriggeredToday = localStorage.getItem("reminder_triggered_date") === now.toDateString();
        if (!hasTriggeredToday) {
          localStorage.setItem("reminder_triggered_date", now.toDateString());
          triggerReminderNotification();
        }
      }
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  const triggerReminderNotification = () => {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("Attendance SheetSync Pro", {
        body: "⏰ It's 10:00 AM! Please mark your attendance for today.",
        icon: "https://images.unsplash.com/photo-1506784983877-45594efa4cbe?w=120&fit=crop&q=80",
      });
    }
    setShowReminderToast(true);
  };

  // Automated algorithm to calculate monthly summaries
  const computeSummaries = (allLogs: AttendanceRecord[], allEmps: string[]): MonthlySummary[] => {
    const computed: MonthlySummary[] = [];
    
    // Group logs by month
    // We can compute for all months found in the logs plus defaults
    const monthsSet = new Set<string>();
    allLogs.forEach((l) => {
      const d = new Date(l.date);
      const mStr = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      monthsSet.add(mStr);
    });

    // Make sure June 2026 is always there as starting baseline
    monthsSet.add("June 2026");
    monthsSet.add("July 2026");
    monthsSet.add("August 2026");

    Array.from(monthsSet).forEach((monthStr) => {
      // Parse Month Index and Year
      // e.g. "June 2026"
      const parts = monthStr.split(" ");
      const monthName = parts[0];
      const year = Number(parts[1]) || 2026;
      
      const monthsMap: { [key: string]: number } = {
        January: 0, February: 1, March: 2, April: 3, May: 4, June: 5,
        July: 6, August: 7, September: 8, October: 9, November: 10, December: 11
      };
      const monthIndex = monthsMap[monthName] ?? 5;

      allEmps.forEach((employee) => {
        const monthLogs = allLogs.filter((l) => {
          const d = new Date(l.date);
          return d.getFullYear() === year && d.getMonth() === monthIndex && l.employee === employee;
        });

        const present = monthLogs.filter((l) => l.status === "Present").length;
        const halfDay = monthLogs.filter((l) => l.status === "Half Day").length;
        const absent = monthLogs.filter((l) => l.status === "Absent").length;

        // Find standard Expected Days from existing summaries if possible to keep them customized, otherwise fallback
        const existing = summaries.find((s) => s.employee === employee && s.month === monthStr);
        let expectedDays = existing ? existing.expectedDays : 0;

        if (!expectedDays || expectedDays === 0) {
          // Dynamic expected days default matching baseline CSV
          if (monthStr === "June 2026") {
            expectedDays = employee === "Aditya" ? 26 : 29;
          } else {
            // default weekdays count roughly
            const totalDays = new Date(year, monthIndex + 1, 0).getDate();
            let sundays = 0;
            for (let d = 1; d <= totalDays; d++) {
              if (new Date(year, monthIndex, d).getDay() === 0) sundays++;
            }
            expectedDays = totalDays - sundays;
          }
        }

        const actualDaysLogged = present + halfDay;
        const netPresent = present + 0.5 * halfDay;
        const attendancePctNum = expectedDays > 0 ? (netPresent / expectedDays) * 100 : 0;
        const attendancePct = attendancePctNum.toFixed(2) + "%";

        computed.push({
          month: monthStr,
          employee,
          expectedDays,
          actualDays: actualDaysLogged,
          halfDays: halfDay,
          absentDays: absent,
          attendancePct,
        });
      });
    });

    return computed;
  };

  // Export current month log as raw CSV
  const handleExportCsv = (monthStr: string) => {
    // Collect all records in this month
    const parts = monthStr.split(" ");
    const monthName = parts[0];
    const year = Number(parts[1]);

    const monthsMap: { [key: string]: number } = {
      January: 0, February: 1, March: 2, April: 3, May: 4, June: 5,
      July: 6, August: 7, September: 8, October: 9, November: 10, December: 11
    };
    const monthIndex = monthsMap[monthName] ?? 5;

    const monthLogs = logs.filter((l) => {
      const d = new Date(l.date);
      return d.getFullYear() === year && d.getMonth() === monthIndex;
    });

    // Make CSV String
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Date,Employee,Status,Notes,Logged At Timestamp\n";

    monthLogs.forEach((l) => {
      csvContent += `${l.date},"${l.employee}","${l.status}","${l.notes || ""}","${l.timestamp}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Attendance_Log_${monthStr.replace(" ", "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Sign In Onboarding UI
  if (needsAuth) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-6" id="onboarding-container">
        <div className="bg-white rounded-[2.5rem] border border-slate-100 max-w-md w-full p-8 shadow-2xl space-y-8 text-center relative overflow-hidden">
          {/* Decorative gradients */}
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-emerald-500 via-teal-500 to-blue-500" />

          {/* Logo and Greeting */}
          <div className="space-y-3 pt-4">
            <div className="w-16 h-16 bg-slate-900 text-white rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-slate-100">
              <FolderSync className="w-8 h-8 text-emerald-400 animate-pulse" />
            </div>
            <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">
              Attendance Logger
            </h1>
            <p className="text-sm text-slate-400 font-medium max-w-xs mx-auto leading-relaxed">
              Log entries from mobile application and synchronize with Google Sheets in realtime.
            </p>
          </div>

          {/* Features checklist */}
          <div className="bg-slate-50/50 rounded-2xl border border-slate-100 p-5 space-y-3 text-left">
            <div className="flex items-start gap-3">
              <div className="p-1 bg-emerald-50 text-emerald-600 rounded-lg mt-0.5">
                <Check className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-700 block">Real-time Sheets Sync</span>
                <p className="text-[11px] text-slate-400 leading-normal">
                  Instantly inserts raw logs and updates monthly dashboard in your Google Sheet.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-1 bg-emerald-50 text-emerald-600 rounded-lg mt-0.5">
                <Check className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-700 block">Durable Local Persistence</span>
                <p className="text-[11px] text-slate-400 leading-normal">
                  Offline-first caching prevents data loss even with a poor network connection.
                </p>
              </div>
            </div>
          </div>

          {/* Error alerts */}
          {errorAlert && (
            <div className="bg-rose-50 border border-rose-100 text-rose-600 p-4 rounded-2xl text-xs flex items-start gap-2 text-left">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{errorAlert}</span>
            </div>
          )}

          {/* Standard compliance Google Sign In Button */}
          <div className="space-y-4">
            <button
              onClick={handleGoogleLogin}
              disabled={isLoggingIn}
              className="gsi-material-button w-full shadow-md hover:shadow-lg transition-shadow py-3 rounded-2xl flex items-center justify-center border border-slate-200"
              id="google-signin-btn"
            >
              <div className="gsi-material-button-state"></div>
              <div className="gsi-material-button-content-wrapper flex items-center justify-center gap-3">
                <div className="gsi-material-button-icon">
                  <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: "block", width: "20px", height: "20px" }}>
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                    <path fill="none" d="M0 0h48v48H0z"></path>
                  </svg>
                </div>
                <span className="gsi-material-button-contents text-sm font-bold text-slate-700">
                  {isLoggingIn ? "Connecting Google Account..." : "Sign in with Google"}
                </span>
              </div>
            </button>

            <p className="text-[10px] text-slate-400">
              Requires permission to create and update your attendance spreadsheets in Google Sheets.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Authorized Dashboard Layout
  if (!isUserAuthorized) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-6" id="access-pending-container">
        <div className="bg-white rounded-[2.5rem] border border-slate-200 max-w-md w-full p-8 shadow-2xl space-y-8 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-2 bg-rose-500" />
          <div className="space-y-3 pt-4">
            <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-rose-100">
              <AlertCircle className="w-8 h-8 shrink-0" />
            </div>
            <h1 className="text-xl font-black text-slate-800 uppercase tracking-tight">
              Access Pending
            </h1>
            <p className="text-xs text-slate-400 font-bold max-w-xs mx-auto leading-relaxed uppercase tracking-wider">
              Verification Required
            </p>
            <p className="text-sm text-slate-600 max-w-xs mx-auto leading-relaxed pt-2">
              This app is configured to sync with <b>Aditya's</b> centralized Attendance Sheet. 
            </p>
            <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-left space-y-1 text-xs">
              <span className="font-bold text-slate-500 block uppercase tracking-wider text-[9px]">Your Gmail:</span>
              <span className="font-mono text-slate-700 block select-all font-bold">{user?.email}</span>
              <span className="font-bold text-slate-500 block uppercase tracking-wider text-[9px] mt-2">Owner's Contact:</span>
              <span className="font-mono text-slate-700 block font-bold">{ownerEmail || "adyy462@gmail.com"}</span>
            </div>
            <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 p-3 rounded-lg leading-normal">
              Please request the administrator to add your Gmail address to the authorized list from their panel, and make sure they share the Google Sheet with you as an Editor.
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full bg-slate-950 hover:bg-slate-800 text-white text-xs font-bold py-3 rounded-xl uppercase tracking-wider transition-all"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans" id="app-dashboard">
      <Header
        user={user}
        spreadsheetUrl={spreadsheetUrl}
        syncStatus={syncStatus}
        onRefresh={() => {
          if (spreadsheetId && token) {
            loadDataFromSheets(spreadsheetId, token).catch(() => {});
          }
        }}
        onLogout={handleLogout}
        onOpenConfig={() => setIsConfigOpen(true)}
      />

      <main className="flex-1 max-w-md w-full mx-auto px-5 pt-6 pb-24">
        {/* Morning 10:00 AM Reminder Toast */}
        {showReminderToast && (
          <div className="bg-indigo-600 text-white p-4 rounded-2xl shadow-xl flex items-start gap-3 relative overflow-hidden animate-bounce border border-indigo-400 mb-4 z-50">
            <div className="p-2 bg-indigo-500 rounded-lg text-white">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <span className="text-xs font-black uppercase tracking-wider block">⏰ Morning Reminder (10:00 AM)</span>
              <p className="text-[11px] text-indigo-100 mt-0.5 leading-normal font-medium">
                Good morning! Please remember to mark your attendance status for Aditya, Kuldeep, and other team members for today.
              </p>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => {
                    setActiveTab("Today");
                    setShowReminderToast(false);
                  }}
                  className="bg-white text-indigo-600 hover:bg-slate-50 text-[10px] px-2.5 py-1 rounded font-bold uppercase tracking-wider"
                >
                  Mark Now
                </button>
                <button
                  onClick={() => setShowReminderToast(false)}
                  className="bg-indigo-700 hover:bg-indigo-800 text-indigo-100 text-[10px] px-2.5 py-1 rounded font-bold uppercase tracking-wider"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Error Alert Bar */}
        {errorAlert && (
          <div className="bg-rose-50 border border-rose-100 text-rose-600 p-4 rounded-2xl text-xs flex items-start gap-2 mb-4">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="flex-1">{errorAlert}</span>
            <button onClick={() => setErrorAlert(null)} className="font-bold underline text-[10px] hover:text-rose-800">
              Dismiss
            </button>
          </div>
        )}

        {/* Tab View Router */}
        {activeTab === "Today" && (
          <TodayTab
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
            employees={employees}
            logs={logs}
            onLogAttendance={handleLogAttendance}
            onAddEmployee={handleAddEmployee}
            currentUserEmail={user?.email || ""}
          />
        )}

        {activeTab === "Calendar" && (
          <CalendarTab
            logs={logs}
            employees={employees}
            selectedDate={selectedDate}
            onDateSelect={(day) => {
              setSelectedDate(day);
              setActiveTab("Today");
            }}
          />
        )}

        {activeTab === "Summary" && (
          <SummaryTab
            logs={logs}
            employees={employees}
            summaries={summaries}
            onExportCsv={handleExportCsv}
            isExporting={false}
          />
        )}

        {activeTab === "History" && (
          <HistoryTab
            logs={logs}
            employees={employees}
            onDeleteLog={handleDeleteLog}
            currentUserEmail={user?.email || ""}
          />
        )}
      </main>

      {/* Bottom Tab Navigator */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 shadow-xl z-40 py-2.5 px-6">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <button
            onClick={() => setActiveTab("Today")}
            className={`flex flex-col items-center gap-1 flex-1 transition-all ${
              activeTab === "Today" ? "text-slate-900 scale-105" : "text-slate-400 hover:text-slate-600"
            }`}
            id="tab-btn-today"
          >
            <Check className={`w-5 h-5 ${activeTab === "Today" ? "stroke-[2.5]" : "stroke-[1.8]"}`} />
            <span className="text-[10px] font-bold">Today</span>
          </button>

          <button
            onClick={() => setActiveTab("Calendar")}
            className={`flex flex-col items-center gap-1 flex-1 transition-all ${
              activeTab === "Calendar" ? "text-slate-900 scale-105" : "text-slate-400 hover:text-slate-600"
            }`}
            id="tab-btn-calendar"
          >
            <CalendarIcon className={`w-5 h-5 ${activeTab === "Calendar" ? "stroke-[2.5]" : "stroke-[1.8]"}`} />
            <span className="text-[10px] font-bold">Calendar</span>
          </button>

          <button
            onClick={() => setActiveTab("Summary")}
            className={`flex flex-col items-center gap-1 flex-1 transition-all ${
              activeTab === "Summary" ? "text-slate-900 scale-105" : "text-slate-400 hover:text-slate-600"
            }`}
            id="tab-btn-summary"
          >
            <BarChart3 className={`w-5 h-5 ${activeTab === "Summary" ? "stroke-[2.5]" : "stroke-[1.8]"}`} />
            <span className="text-[10px] font-bold">Summary</span>
          </button>

          <button
            onClick={() => setActiveTab("History")}
            className={`flex flex-col items-center gap-1 flex-1 transition-all ${
              activeTab === "History" ? "text-slate-900 scale-105" : "text-slate-400 hover:text-slate-600"
            }`}
            id="tab-btn-history"
          >
            <History className={`w-5 h-5 ${activeTab === "History" ? "stroke-[2.5]" : "stroke-[1.8]"}`} />
            <span className="text-[10px] font-bold">History</span>
          </button>
        </div>
      </nav>

      {/* Sheets Integration Config Drawer/Modal */}
      {isConfigOpen && (
        <SheetsConfig
          spreadsheetId={spreadsheetId}
          spreadsheetUrl={spreadsheetUrl}
          syncEnabled={syncEnabled}
          onToggleSync={setSyncEnabled}
          onCreateNewSheet={handleCreateNewSheet}
          onLinkExistingSheet={handleLinkExistingSheet}
          onClose={() => setIsConfigOpen(false)}
          isLoading={isSheetsLoading}
          ownerEmail={ownerEmail}
          allowedEmails={allowedEmails}
          currentUserEmail={user?.email || ""}
          onAddAllowedEmail={handleAddAllowedEmail}
          onRemoveAllowedEmail={handleRemoveAllowedEmail}
          needsReconnect={!token}
          onReconnect={handleGoogleLogin}
        />
      )}

    </div>
  );
}
