import { doc, getDoc, setDoc, updateDoc, increment } from "firebase/firestore";
import { db } from "../config/firebase";

export interface StorageAnalytics {
  totalGenerated: number;
  totalUploads: number;
  failedUploads: number;
  storageUsedBytes: number;
  regenerationSkips: number;
  resultLockCount: number;
  averageUploadTime: number; // Stored in ms
}

const ANALYTICS_DOC_ID = "storage";

export const firebaseAnalyticsService = {
  // Get current analytics
  getAnalytics: async (): Promise<StorageAnalytics> => {
    try {
      const docRef = doc(db, "analytics", ANALYTICS_DOC_ID);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        return snapshot.data() as StorageAnalytics;
      }
      
      // Initialize if it doesn't exist
      const initial: StorageAnalytics = {
        totalGenerated: 0,
        totalUploads: 0,
        failedUploads: 0,
        storageUsedBytes: 0,
        regenerationSkips: 0,
        resultLockCount: 0,
        averageUploadTime: 0
      };
      await setDoc(docRef, initial);
      return initial;
    } catch (error) {
      console.error("[Analytics] Error fetching analytics:", error);
      throw error;
    }
  },

  // Track a successful PDF generation and upload
  trackUploadSuccess: async (fileSize: number, uploadTimeMs: number) => {
    try {
      const docRef = doc(db, "analytics", ANALYTICS_DOC_ID);
      
      // We need to update the rolling average upload time
      const current = await firebaseAnalyticsService.getAnalytics();
      const newTotalUploads = current.totalUploads + 1;
      const newAverage = ((current.averageUploadTime * current.totalUploads) + uploadTimeMs) / newTotalUploads;

      await updateDoc(docRef, {
        totalGenerated: increment(1),
        totalUploads: increment(1),
        storageUsedBytes: increment(fileSize),
        averageUploadTime: newAverage
      });
//       console.log("[Analytics] Upload success tracked");
    } catch (error) {
      console.error("[Analytics] Failed to track upload success:", error);
    }
  },

  // Track a failed upload
  trackUploadFailure: async () => {
    try {
      const docRef = doc(db, "analytics", ANALYTICS_DOC_ID);
      await updateDoc(docRef, {
        failedUploads: increment(1)
      });
//       console.log("[Analytics] Upload failure tracked");
    } catch (error) {
      console.error("[Analytics] Failed to track upload failure:", error);
    }
  },

  // Track a skipped regeneration
  trackRegenerationSkip: async () => {
    try {
      const docRef = doc(db, "analytics", ANALYTICS_DOC_ID);
      await updateDoc(docRef, {
        regenerationSkips: increment(1)
      });
//       console.log("[Analytics] Regeneration skip tracked");
    } catch (error) {
      console.error("[Analytics] Failed to track skip:", error);
    }
  },

  // Track result lock
  trackResultLock: async (isLocking: boolean) => {
    try {
      const docRef = doc(db, "analytics", ANALYTICS_DOC_ID);
      await updateDoc(docRef, {
        resultLockCount: increment(isLocking ? 1 : -1)
      });
//       console.log(`[Analytics] Result ${isLocking ? 'lock' : 'unlock'} tracked`);
    } catch (error) {
      console.error("[Analytics] Failed to track lock:", error);
    }
  }
};
