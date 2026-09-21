/**
 * Migration Utility
 * 
 * Adds programId + branchId to all existing Firestore documents that
 * were created before the multi-program architecture was introduced.
 * 
 * Default: All existing records become Karate / Branch-1
 * 
 * SAFE TO RUN MULTIPLE TIMES — only updates docs missing the fields.
 */

import {
  collection,
  getDocs,
  doc,
  updateDoc,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { branchService } from "../services/programService";

export interface MigrationResult {
  collection: string;
  total: number;
  migrated: number;
  skipped: number;
  errors: number;
}

const DEFAULT_PROGRAM_ID = "karate";

// Get the first active branch for karate
async function getDefaultBranchId(): Promise<string> {
  try {
    const branches = await branchService.getByProgram(DEFAULT_PROGRAM_ID);
    if (branches.length > 0) return branches[0].id;
  } catch (_) {}
  return "branch_1"; // fallback
}

async function migrateCollection(
  collectionName: string,
  defaultBranchId: string
): Promise<MigrationResult> {
  const result: MigrationResult = {
    collection: collectionName,
    total: 0,
    migrated: 0,
    skipped: 0,
    errors: 0,
  };

  try {
    const snapshot = await getDocs(collection(db, collectionName));
    result.total = snapshot.docs.length;

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();

      // Skip if already has programId
      if (data.programId) {
        result.skipped++;
        continue;
      }

      try {
        await updateDoc(doc(db, collectionName, docSnap.id), {
          programId: DEFAULT_PROGRAM_ID,
          branchId: defaultBranchId,
          updatedAt: serverTimestamp(),
        });
        result.migrated++;
      } catch (err) {
        console.error(`Migration error in ${collectionName}/${docSnap.id}:`, err);
        result.errors++;
      }
    }
  } catch (err) {
    console.error(`Failed to migrate collection ${collectionName}:`, err);
  }

  return result;
}

/**
 * Runs the full migration on all relevant collections.
 * Call this once from the Admin Settings page.
 */
export async function runFullMigration(): Promise<MigrationResult[]> {
  const defaultBranchId = await getDefaultBranchId();

  const collections = [
    "students",
    "schools",
    "batches",
    "beltTests",
    "referees",
  ];

  const results: MigrationResult[] = [];

  for (const col of collections) {
    const result = await migrateCollection(col, defaultBranchId);
    results.push(result);
  }

  return results;
}

/**
 * Check if migration is needed (any collection has docs without programId)
 */
export async function checkMigrationNeeded(): Promise<boolean> {
  try {
    const collections = ["students", "schools", "batches", "beltTests"];
    for (const col of collections) {
      const q = query(collection(db, col), where("programId", "==", null));
      // Note: Firestore doesn't support "field not exists" natively via SDK
      // Instead, we'll check a small sample
      const snapshot = await getDocs(collection(db, col));
      for (const docSnap of snapshot.docs) {
        if (!docSnap.data().programId) {
          return true;
        }
      }
    }
    return false;
  } catch {
    return false;
  }
}
