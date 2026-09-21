import { doc, getDoc, setDoc, onSnapshot, runTransaction, collection, addDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "../config/firebase";

export interface AuthAccessRoleSettings {
  registration: {
    enabled: boolean;
    message: string;
    updatedAt: string;
    updatedBy: { uid: string; name: string };
  };
  login: {
    enabled: boolean;
    message: string;
    updatedAt: string;
    updatedBy: { uid: string; name: string };
  };
}

export interface AuthAccessConfig {
  roles: {
    secretary: AuthAccessRoleSettings;
    referee: AuthAccessRoleSettings;
    [key: string]: AuthAccessRoleSettings; // For future-proofing (coaches, etc)
  };
  globalUpdatedAt: string;
  globalUpdatedBy: { uid: string; name: string };
  version: number;
}

const DEFAULT_CONFIG: AuthAccessConfig = {
  roles: {
    secretary: {
      registration: { enabled: true, message: "", updatedAt: new Date().toISOString(), updatedBy: { uid: "system", name: "System" } },
      login: { enabled: true, message: "", updatedAt: new Date().toISOString(), updatedBy: { uid: "system", name: "System" } }
    },
    referee: {
      registration: { enabled: true, message: "", updatedAt: new Date().toISOString(), updatedBy: { uid: "system", name: "System" } },
      login: { enabled: true, message: "", updatedAt: new Date().toISOString(), updatedBy: { uid: "system", name: "System" } }
    }
  },
  globalUpdatedAt: new Date().toISOString(),
  globalUpdatedBy: { uid: "system", name: "System" },
  version: 1
};

export const firebaseAuthAccessService = {
  _cachedConfig: DEFAULT_CONFIG,
  _unsubscribe: null as (() => void) | null,
  
  /**
   * Start listening to real-time changes
   */
  subscribe: (onUpdate?: (config: AuthAccessConfig) => void) => {
    const docRef = doc(db, "auth_settings", "global");
    
    // Attempt to create the doc if it doesn't exist
    getDoc(docRef).then(snap => {
      if (!snap.exists()) {
        setDoc(docRef, DEFAULT_CONFIG).catch(err => console.warn("Could not init auth config:", err));
      }
    });

    firebaseAuthAccessService._unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as AuthAccessConfig;
        firebaseAuthAccessService._cachedConfig = data;
        if (onUpdate) onUpdate(data);
      }
    });

    return () => {
      if (firebaseAuthAccessService._unsubscribe) {
        firebaseAuthAccessService._unsubscribe();
      }
    };
  },

  /**
   * Get current config (uses cache if subscribed, otherwise fetches)
   */
  getSettings: async (): Promise<AuthAccessConfig> => {
    const docRef = doc(db, "auth_settings", "global");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      firebaseAuthAccessService._cachedConfig = docSnap.data() as AuthAccessConfig;
      return firebaseAuthAccessService._cachedConfig;
    }
    // Create it
    await setDoc(docRef, DEFAULT_CONFIG);
    firebaseAuthAccessService._cachedConfig = DEFAULT_CONFIG;
    return DEFAULT_CONFIG;
  },

  /**
   * Update configuration with Optimistic Locking
   */
  updateSettings: async (newConfig: AuthAccessConfig, adminUid: string, adminName: string) => {
    const docRef = doc(db, "auth_settings", "global");
    
    await runTransaction(db, async (transaction) => {
      const docSnap = await transaction.get(docRef);
      
      let currentVersion = 0;
      let previousValues = DEFAULT_CONFIG;
      
      if (docSnap.exists()) {
        const data = docSnap.data() as AuthAccessConfig;
        currentVersion = data.version || 0;
        previousValues = data;
      }

      // Optimistic Locking Check
      if (newConfig.version !== currentVersion) {
        throw new Error("Configuration was updated by another administrator. Please refresh and try again.");
      }

      const updatedConfig: AuthAccessConfig = {
        ...newConfig,
        version: currentVersion + 1,
        globalUpdatedAt: new Date().toISOString(),
        globalUpdatedBy: { uid: adminUid, name: adminName }
      };

      transaction.set(docRef, updatedConfig);

      // Create Audit Log
      const historyRef = doc(collection(db, "auth_settings_history"));
      transaction.set(historyRef, {
        previousValues,
        newValues: updatedConfig,
        adminUid,
        adminName,
        timestamp: serverTimestamp(),
        version: updatedConfig.version,
        changeSource: "Admin Portal"
      });
    });
  },

  /**
   * Convenience helpers (uses cached config if populated)
   */
  isSecretaryRegistrationOpen: () => firebaseAuthAccessService._cachedConfig.roles?.secretary?.registration?.enabled ?? true,
  isSecretaryLoginOpen: () => firebaseAuthAccessService._cachedConfig.roles?.secretary?.login?.enabled ?? true,
  isRefereeRegistrationOpen: () => firebaseAuthAccessService._cachedConfig.roles?.referee?.registration?.enabled ?? true,
  isRefereeLoginOpen: () => firebaseAuthAccessService._cachedConfig.roles?.referee?.login?.enabled ?? true,

  getSecretaryRegistrationMessage: () => firebaseAuthAccessService._cachedConfig.roles?.secretary?.registration?.message || "Registration is temporarily closed.",
  getSecretaryLoginMessage: () => firebaseAuthAccessService._cachedConfig.roles?.secretary?.login?.message || "Login is temporarily disabled.",
  getRefereeRegistrationMessage: () => firebaseAuthAccessService._cachedConfig.roles?.referee?.registration?.message || "Registration is temporarily closed.",
  getRefereeLoginMessage: () => firebaseAuthAccessService._cachedConfig.roles?.referee?.login?.message || "Login is temporarily disabled.",

  /**
   * Emergency Lock: Instantly disable all logins and registrations
   */
  emergencyLock: async (adminUid: string, adminName: string) => {
    const docRef = doc(db, "auth_settings", "global");
    
    await runTransaction(db, async (transaction) => {
      const docSnap = await transaction.get(docRef);
      
      let currentVersion = 0;
      let currentData = DEFAULT_CONFIG;
      
      if (docSnap.exists()) {
        currentData = docSnap.data() as AuthAccessConfig;
        currentVersion = currentData.version || 0;
      }

      const lockConfig = JSON.parse(JSON.stringify(currentData)) as AuthAccessConfig; // deep copy
      const timestamp = new Date().toISOString();
      const updatedBy = { uid: adminUid, name: adminName };
      const emergencyMessage = "System lockdown enacted. Authentication is suspended.";

      Object.keys(lockConfig.roles).forEach(role => {
        lockConfig.roles[role].registration.enabled = false;
        lockConfig.roles[role].registration.message = emergencyMessage;
        lockConfig.roles[role].registration.updatedAt = timestamp;
        lockConfig.roles[role].registration.updatedBy = updatedBy;

        lockConfig.roles[role].login.enabled = false;
        lockConfig.roles[role].login.message = emergencyMessage;
        lockConfig.roles[role].login.updatedAt = timestamp;
        lockConfig.roles[role].login.updatedBy = updatedBy;
      });

      lockConfig.version = currentVersion + 1;
      lockConfig.globalUpdatedAt = timestamp;
      lockConfig.globalUpdatedBy = updatedBy;

      transaction.set(docRef, lockConfig);

      // Create Audit Log
      const historyRef = doc(collection(db, "auth_settings_history"));
      transaction.set(historyRef, {
        previousValues: currentData,
        newValues: lockConfig,
        adminUid,
        adminName,
        timestamp: serverTimestamp(),
        version: lockConfig.version,
        changeSource: "Emergency Lock"
      });
    });
  }
};
