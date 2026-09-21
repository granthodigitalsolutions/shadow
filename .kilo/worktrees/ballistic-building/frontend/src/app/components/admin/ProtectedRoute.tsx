import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { firebaseAuthService } from "../../services/firebaseAuth";
import { firebaseAdminAuthService, firebaseRefereeAuthService } from "../../services/firebaseData";

interface ProtectedRouteProps {
 children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
 const [loading, setLoading] = useState(true);
 const [status, setStatus] = useState<"admin" | "referee" | "unauthorized" | null>(null);

 useEffect(() => {
 const unsubscribe = firebaseAuthService.onAuthStateChange(async (user) => {
   if (user) {
     const isAdmin = await firebaseAdminAuthService.isAdmin(user.uid);
     if (isAdmin) {
       setStatus("admin");
     } else {
       const isReferee = await firebaseRefereeAuthService.isReferee(user.uid);
       if (isReferee) {
         setStatus("referee");
       } else {
         await firebaseAuthService.logout();
         setStatus("unauthorized");
       }
     }
   } else {
     setStatus("unauthorized");
   }
   setLoading(false);
 });

 return () => unsubscribe();
 }, []);

 if (loading) {
 return (
 <div className="min-h-screen flex items-center justify-center">
 <div className="text-center">
 <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
 <p className="text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400">Loading...</p>
 </div>
 </div>
 );
 }

 if (status === "referee") {
   return <Navigate to="/referee/dashboard" replace />;
 }

 if (status === "unauthorized") {
   return <Navigate to="/admin/login" replace />;
 }

 return <>{children}</>;
}
