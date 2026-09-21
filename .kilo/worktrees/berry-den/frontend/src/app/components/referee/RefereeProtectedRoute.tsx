import { ReactNode, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../config/firebase";
import { firebaseRefereeAuthService, firebaseAdminAuthService } from "../../services/firebaseData";

interface RefereeProtectedRouteProps {
 children: ReactNode;
}

export default function RefereeProtectedRoute({ children }: RefereeProtectedRouteProps) {
 const [loading, setLoading] = useState(true);
 const [status, setStatus] = useState<"admin" | "referee" | "unauthorized" | null>(null);

 useEffect(() => {
 const unsubscribe = onAuthStateChanged(auth, async (user) => {
   if (user) {
     const isReferee = await firebaseRefereeAuthService.isReferee(user.uid);
     if (isReferee) {
       setStatus("referee");
     } else {
       const isAdmin = await firebaseAdminAuthService.isAdmin(user.uid);
       if (isAdmin) {
         setStatus("admin");
       } else {
         await auth.signOut();
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
 <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900">
 <div className="text-center">
 <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
 <p className="text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400">Verifying access...</p>
 </div>
 </div>
 );
 }

 if (status === "admin") {
   return <Navigate to="/admin/karate/dashboard" replace />;
 }

 if (status === "unauthorized") {
   return <Navigate to="/referee/login" replace />;
 }

 return <>{children}</>;
}
