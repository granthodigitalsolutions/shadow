import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, signInWithCustomToken } from "firebase/auth";
import { getFirestore, doc, onSnapshot, Unsubscribe } from "firebase/firestore";
import { firebaseConfig } from "../config/firebase";
import type { ExaminerCapacity } from "./examinerApi";

// Real-time (Firestore onSnapshot) view of an examiner's batch capacity.
//
// Examiners don't use Admin/Coach accounts, so this runs on its OWN Firebase app
// instance signed in with a scoped custom token minted by the backend after the
// batch code was verified. That keeps it fully separate from any Admin/Coach
// session in the same browser, and firestore.rules only let this identity `get`
// its own batch document and its own allocation (read-only).

const APP_NAME = "examiner-live";

const getLiveApp = () => (getApps().some((a) => a.name === APP_NAME) ? getApp(APP_NAME) : initializeApp(firebaseConfig, APP_NAME));

/** examinerId lives in the (signed) batch session token's payload. */
export function examinerIdFromSession(token: string | null): string | null {
  try {
    if (!token) return null;
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.examinerId === "string" ? payload.examinerId : null;
  } catch {
    return null;
  }
}

// Same arithmetic as backend/src/utils/examinerBatch.js computeCapacity()/toMyAllocation().
function toCapacity(batch: any, alloc: any | null): ExaminerCapacity {
  const ids: string[] = Array.isArray(batch.studentIds) ? batch.studentIds : [];
  const total = Number.isInteger(batch.maxSize) ? batch.maxSize : ids.length;
  const allocated = batch.allocatedCount || 0;
  const legacy = Math.max(0, ids.length - (batch.allocatedAssigned || 0));
  const mineIds: string[] = alloc && Array.isArray(alloc.studentIds) ? alloc.studentIds : [];
  const quantity = (alloc && alloc.quantity) || 0;
  return {
    total,
    allocated,
    available: Math.max(0, total - allocated - legacy),
    mine: { quantity, assigned: mineIds.length, remaining: Math.max(0, quantity - mineIds.length), studentIds: mineIds, started: !!(alloc && alloc.examStartedAt) },
  };
}

export async function subscribeExaminerCapacity(opts: {
  batchId: string;
  examinerId: string;
  firebaseToken: string;
  onData: (capacity: ExaminerCapacity, batchStatus: string | null) => void;
  onError: (err: unknown) => void;
}): Promise<Unsubscribe> {
  const app = getLiveApp();
  await signInWithCustomToken(getAuth(app), opts.firebaseToken);
  const fs = getFirestore(app);

  let batch: any = null;
  let alloc: any | null = null;
  let allocReady = false;
  const emit = () => { if (batch && allocReady) opts.onData(toCapacity(batch, alloc), batch.status ?? null); };

  const unsubBatch = onSnapshot(doc(fs, "batches", opts.batchId), (snap) => { batch = snap.exists() ? snap.data() : null; emit(); }, opts.onError);
  const unsubAlloc = onSnapshot(
    doc(fs, "batches", opts.batchId, "allocations", opts.examinerId),
    (snap) => { alloc = snap.exists() ? snap.data() : null; allocReady = true; emit(); },
    opts.onError,
  );
  return () => { unsubBatch(); unsubAlloc(); };
}
