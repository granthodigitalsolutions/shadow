import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { LogIn, ShieldCheck, ArrowLeft, Mail, Lock } from "lucide-react";
import { firebaseAuthService } from "../../services/firebaseAuth";
import { firebaseSecretaryAuthService, firebaseAdminAuthService } from "../../services/firebaseData";
import { firebaseAuthAccessService, AuthAccessConfig } from "../../services/firebaseAuthAccessService";
import AuthLayout from "../auth/AuthLayout";
export default function SecretaryLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [authConfig, setAuthConfig] = useState<AuthAccessConfig | null>(null);

  useEffect(() => {
    const unsub = firebaseAuthAccessService.subscribe(setAuthConfig);
    return () => unsub();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (authConfig && !authConfig.roles.secretary.login.enabled) {
      setError(authConfig.roles.secretary.login.message || "Secretary login is temporarily disabled by the administrator.");
      return;
    }
    
    setLoading(true);
    setError("");

    const success = await firebaseAuthService.login(email, password);

    if (success) {
//       console.log("[AUTH] Firebase login success");
      const user = firebaseAuthService.getCurrentUser();
      if (user) {
        try {
          // First check if they are an active secretary
          const secDoc = await firebaseSecretaryAuthService.getSecretaryByUid(user.uid);
          if (secDoc) {
            if (secDoc.active) {
//               console.log("[AUTH] Secretary verified");
              
              // Audit log (fail silently)
              try {
                const { firebaseAuditService } = await import("../../services/firebaseData");
                await firebaseAuditService.logAction(
                  "SECRETARY_LOGIN",
                  "secretary",
                  user.uid,
                  { email },
                  user.uid
                );
              } catch (_) { /* audit log is non-critical */ }
              
              navigate("/secretary/dashboard");
              setLoading(false);
              return;
            } else {
              setError("Your account has been disabled. Please contact the administrator.");
              await firebaseAuthService.logout();
              setLoading(false);
              return;
            }
          }
        } catch (err) {
          console.warn("[AUTH] Error checking secretary status:", err);
          // Permission error reading secretaries collection â€” continue to check admin/request
        }

        try {
          // Check if they are an admin
          const isAdmin = await firebaseAdminAuthService.isAdmin(user.uid);
          if (isAdmin) {
//             console.log("[AUTH] Admin access granted to Secretary Portal");
            navigate("/secretary/dashboard");
            setLoading(false);
            return;
          }
        } catch (err) {
          console.warn("[AUTH] Error checking admin status:", err);
        }

        // If we reach here, they are neither an active secretary nor an admin
        // Try to check their request status for a helpful message
        try {
          const { firebaseSecretaryRequestService } = await import("../../services/firebaseData");
          const request = await firebaseSecretaryRequestService.getByUid(user.uid);
          
          if (request) {
            if (request.status === "pending") {
              setError("Your registration request is awaiting administrator approval.");
            } else if (request.status === "rejected") {
              setError("Your registration request has been rejected. Please contact the administrator.");
            } else {
              setError("Your account is not approved yet, or you do not have secretary privileges.");
            }
          } else {
            setError("Account not found. Please register first, or contact the admin.");
          }
        } catch (err) {
          console.warn("[AUTH] Permission denied fetching secretary request:", err);
          setError("Account not found. Please register first, or contact the admin.");
        }
        
        await firebaseAuthService.logout();
      }
    } else {
      setError("Invalid credentials. Please check your email and password.");
    }

    setLoading(false);
  };

  return (
    <AuthLayout
      title="SECRETARY PORTAL"
      badgeIcon={<ShieldCheck className="w-4 h-4" />}
      badgeText="Authorized Secretary Portal Login"
    >

        {authConfig && !authConfig.roles.secretary.login.enabled ? (
          <div className="text-center p-8 bg-zinc-950/50 rounded-2xl border border-red-500/30 backdrop-blur-sm animate-fade-in">
            <Lock className="w-12 h-12 text-red-500 mx-auto mb-4 opacity-80" />
            <h2 className="text-xl font-bold text-white mb-2">Login Disabled</h2>
            <p className="text-zinc-400 text-sm">{authConfig.roles.secretary.login.message || "Secretary login is temporarily disabled by the administrator."}</p>
            <button onClick={() => navigate("/")} className="mt-6 px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-semibold transition-colors">
              Return Home
            </button>
          </div>
        ) : (
        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-zinc-300 mb-2">Email Address</label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
                <Mail className="w-5 h-5" />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border-slate-200 dark:bg-zinc-950/50 dark:border-white/10 rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all text-sm font-medium text-zinc-900 placeholder-slate-400 dark:text-white dark:placeholder-zinc-500"
                placeholder="secretary@shadowkai.com"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-zinc-300 mb-2">Password</label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
                <Lock className="w-5 h-5" />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border-slate-200 dark:bg-zinc-950/50 dark:border-white/10 rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all text-sm font-medium text-zinc-900 placeholder-slate-400 dark:text-white dark:placeholder-zinc-500"
                placeholder="********"
                required
              />
            </div>
          </div>
          
          <div className="flex justify-end -mt-2">
            <button
              type="button"
              onClick={() => navigate("/forgot-password")}
              className="text-sm font-semibold text-blue-500 hover:text-blue-400 transition-colors"
            >
              Forgot Password?
            </button>
          </div>

          {error && (
            <div className="p-3 bg-red-950/50 text-red-400 text-sm font-medium rounded-xl border border-red-900/50">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-500 dark:hover:bg-blue-400 dark:text-zinc-950 font-bold py-3.5 px-4 rounded-xl transition-all flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider text-sm shadow-lg mt-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white dark:border-zinc-950 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                <span>Sign In to Portal</span>
              </>
            )}
          </button>
          
          <div className="text-center pt-4">
            <button 
              type="button" 
              onClick={() => navigate("/secretary/register")} 
              className="text-zinc-400 hover:text-blue-500 text-sm font-medium transition-colors"
            >
              Request Secretary Access
            </button>
          </div>
        </form>
        )}
    </AuthLayout>
  );
}
