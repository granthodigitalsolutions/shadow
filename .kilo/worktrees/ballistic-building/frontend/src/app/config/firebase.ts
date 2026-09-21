// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, initializeFirestore, Firestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAgD3x4e3knwBhDEYDGC21vNF2FgdRflD0",
  authDomain: "team-shadowkai.firebaseapp.com",
  projectId: "team-shadowkai",
  storageBucket: "team-shadowkai.firebasestorage.app",
  messagingSenderId: "457922879075",
  appId: "1:457922879075:web:f08694b35163071a76a256",
  measurementId: "G-2918RSWLG5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Cloud Firestore with custom settings to reduce errors
// Check if Firestore is already initialized to avoid "failed-precondition" error
let db: Firestore;

try {
  if (typeof window !== 'undefined') {
    db = initializeFirestore(app, {
      ignoreUndefinedProperties: true
      // Removed persistentLocalCache to fix infinite hanging issues
    });
  } else {
    db = getFirestore(app);
  }
} catch (error: any) {
  if (error.code === 'failed-precondition') {
    // Firestore already initialized, use existing instance
    db = getFirestore(app);
  } else {
    throw error;
  }
}

export { db };

// Initialize Firebase Storage
export const storage = getStorage(app);

// Suppress BloomFilter warnings (internal Firestore optimization warnings)
const originalConsoleWarn = console.warn;
console.warn = function(...args) {
  if (args[0]?.includes?.('BloomFilter') || args[0]?.includes?.('BloomFilterError')) {
    // Suppress BloomFilter warnings - these are internal optimization warnings
    return;
  }
  originalConsoleWarn.apply(console, args);
};

export default app;
