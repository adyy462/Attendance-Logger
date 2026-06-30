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
let cachedAccessToken: string | null = null;

// Save token to memory and session storage (safer than localStorage for access tokens but persists refreshing)
// Note: The guide says "do NOT store the access token in localStorage or sessionStorage. Use in-memory caching."
// We will strictly use in-memory caching to respect the security instructions.

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // If there is a user but no cached token, they might have refreshed.
        // We will need them to re-sign-in to get a fresh credential token, or we can see if we can trigger the popup.
        // To be safe and compliant, we clear token and trigger failure so the UI can show the Re-Auth or Connect button.
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
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

