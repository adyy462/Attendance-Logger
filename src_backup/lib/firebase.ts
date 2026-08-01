/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

const provider = new GoogleAuthProvider();
// Request Google Sheets and Drive File scopes
provider.addScope("https://www.googleapis.com/auth/spreadsheets");
provider.addScope("https://www.googleapis.com/auth/drive.file");

// Set prompt select_account to make switching accounts easy
provider.setCustomParameters({
  prompt: "select_account"
});

let isSigningIn = false;
let cachedAccessToken: string | null = localStorage.getItem("google_access_token");
let tokenExpiry: string | null = localStorage.getItem("google_access_token_expiry");

if (tokenExpiry && parseInt(tokenExpiry) < Date.now()) {
  cachedAccessToken = null;
  localStorage.removeItem("google_access_token");
  localStorage.removeItem("google_access_token_expiry");
}

export const initAuth = (
  onAuthSuccess?: (user: User, token: string | null) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
    } else {
      cachedAccessToken = null;
      localStorage.removeItem("google_access_token");
      localStorage.removeItem("google_access_token_expiry");
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("Failed to get access token from Firebase Auth");
    }

    cachedAccessToken = credential.accessToken;
    localStorage.setItem("google_access_token", cachedAccessToken);
    localStorage.setItem("google_access_token_expiry", (Date.now() + 3500 * 1000).toString()); // 3500 seconds

    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error("Sign in error:", error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
  localStorage.removeItem("google_access_token");
  localStorage.removeItem("google_access_token_expiry");
};

// Shared Spreadsheet Config helpers
export const getSharedConfig = async (): Promise<any | null> => {
  try {
    const docRef = doc(db, "shared_config", "spreadsheet");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data();
    }
    return null;
  } catch (err) {
    console.warn("Could not fetch shared config from Firestore (app may be offline):", err);
    return null;
  }
};

export const saveSharedConfig = async (
  spreadsheetId: string,
  spreadsheetUrl: string,
  ownerEmail: string,
  allowedEmails: string[]
): Promise<void> => {
  try {
    const docRef = doc(db, "shared_config", "spreadsheet");
    await setDoc(docRef, {
      spreadsheetId,
      spreadsheetUrl,
      ownerEmail: ownerEmail.toLowerCase(),
      allowedEmails: allowedEmails.map((e) => e.toLowerCase()),
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Error saving shared config to Firestore:", err);
    throw err;
  }
};

