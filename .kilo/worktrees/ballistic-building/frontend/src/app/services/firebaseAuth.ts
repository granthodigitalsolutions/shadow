import { signInWithEmailAndPassword, signOut, onAuthStateChanged, User, browserLocalPersistence, setPersistence } from "firebase/auth";
import { auth } from "../config/firebase";

// Set persistence to local
setPersistence(auth, browserLocalPersistence).catch(error => {
  console.error("Error setting persistence:", error);
});
  
export const firebaseAuthService = {
  login: async (email: string, password: string): Promise<boolean> => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return true;
    } catch (error) {
      console.error("Login error:", error);
      return false;
    }
  },

  logout: async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error:", error);
    }
  },

  getCurrentUser: (): User | null => {
    return auth.currentUser;
  },

  onAuthStateChange: (callback: (user: User | null) => void) => {
    return onAuthStateChanged(auth, callback);
  },

  isAuthenticated: (): boolean => {
    return auth.currentUser !== null;
  },
};
