import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { firebaseAuthService } from "../../services/firebaseAuth";
import { firebaseAdminAuthService, firebaseCoachAuthService } from "../../services/firebaseData";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function CoachProtectedRoute({ children }: ProtectedRouteProps) {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"admin" | "coach" | "unauthorized" | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = firebaseAuthService.onAuthStateChange(async (user) => {
//       console.log("CoachProtectedRoute: auth state changed", user?.uid);
      if (user) {
        try {
          const isAdmin = await firebaseAdminAuthService.isAdmin(user.uid);
//           console.log("isAdmin result:", isAdmin);
          if (isAdmin) {
            setStatus("admin");
          } else {
            // Add a timeout to prevent infinite hanging due to Firestore cache bugs
            const timeoutPromise = new Promise<boolean>((_, reject) =>
              setTimeout(() => reject(new Error("Timeout waiting for coach authorization")), 8000)
            );

            const isCoach = await Promise.race([
              firebaseCoachAuthService.isCoach(user.uid),
              timeoutPromise
            ]);

//             console.log("isCoach result:", isCoach);
            if (isCoach) {
              setStatus("coach");
            } else {
              await firebaseAuthService.logout();
              setStatus("unauthorized");
            }
          }
        } catch (error) {
          console.error("Error in CoachProtectedRoute auth check:", error);
          setErrorMsg(error instanceof Error ? error.message : "Authorization check failed");
          setStatus("unauthorized");
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
          <p className="text-gray-600 dark:text-zinc-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="min-h-screen flex items-center justify-center flex-col p-4 text-center">
        <div className="text-red-500 mb-4 bg-red-100 p-4 rounded-full">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold mb-2 text-zinc-800 dark:text-zinc-100">Authentication Error</h2>
        <p className="text-zinc-600 dark:text-zinc-400 mb-6 max-w-md">{errorMsg}</p>
        <button 
          onClick={() => window.location.reload()}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  // Admins can access coach portal too, if they want
  if (status === "coach" || status === "admin") {
    return <>{children}</>;
  }

  return <Navigate to="/coach/login" replace />;
}
