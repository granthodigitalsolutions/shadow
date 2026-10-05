import { useEffect, useState } from "react";
import AppLoader from "../ui/AppLoader";
import { Navigate } from "react-router-dom";
import { firebaseAuthService } from "../../services/firebaseAuth";
import { firebaseAdminAuthService } from "../../services/firebaseData";

interface ProtectedRouteProps {
 children: React.ReactNode;
}

// Set by the login screen (and here) once this tab has verified the admin.
export const ADMIN_OK_KEY = "sk_admin_verified_uid";

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
 const [loading, setLoading] = useState(true);
 const [status, setStatus] = useState<"admin" | "unauthorized" | null>(null);

 useEffect(() => {
 const unsubscribe = firebaseAuthService.onAuthStateChange(async (user) => {
   if (user) {
     // Already verified in this tab: open the admin area at once and re-check in
     // the background (Firestore rules still enforce admin access on every read).
     if (sessionStorage.getItem(ADMIN_OK_KEY) === user.uid) {
       setStatus("admin");
       setLoading(false);
     }
     const isAdmin = await firebaseAdminAuthService.isAdmin(user.uid);
     if (isAdmin) {
       sessionStorage.setItem(ADMIN_OK_KEY, user.uid);
       setStatus("admin");
     } else {
       sessionStorage.removeItem(ADMIN_OK_KEY);
       await firebaseAuthService.logout();
       setStatus("unauthorized");
     }
   } else {
     sessionStorage.removeItem(ADMIN_OK_KEY);
     setStatus("unauthorized");
   }
   setLoading(false);
 });

 return () => unsubscribe();
 }, []);

 if (loading) return <AppLoader />;

 if (status === "unauthorized") {
   return <Navigate to="/admin/login" replace />;
 }

 return <>{children}</>;
}
