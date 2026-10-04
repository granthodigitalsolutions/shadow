import { useEffect, useState } from "react";
import AppLoader from "../ui/AppLoader";
import { Navigate } from "react-router-dom";
import { firebaseAuthService } from "../../services/firebaseAuth";
import { firebaseAdminAuthService } from "../../services/firebaseData";

interface ProtectedRouteProps {
 children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
 const [loading, setLoading] = useState(true);
 const [status, setStatus] = useState<"admin" | "unauthorized" | null>(null);

 useEffect(() => {
 const unsubscribe = firebaseAuthService.onAuthStateChange(async (user) => {
   if (user) {
     const isAdmin = await firebaseAdminAuthService.isAdmin(user.uid);
     if (isAdmin) {
       setStatus("admin");
     } else {
       await firebaseAuthService.logout();
       setStatus("unauthorized");
     }
   } else {
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
