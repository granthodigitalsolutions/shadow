import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { LogIn, User, Eye, EyeOff, Lock, Mail, ArrowLeft } from "lucide-react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../config/firebase";
import { firebaseRefereeAuthService, firebaseAdminAuthService } from "../../services/firebaseData";
import { firebaseAuthAccessService, AuthAccessConfig } from "../../services/firebaseAuthAccessService";
import { useToast } from "../../hooks/useToast";
import AuthLayout from "../auth/AuthLayout";
export default function RefereeLogin() {
 const navigate = useNavigate();
 const { showToast } = useToast();
 const [loading, setLoading] = useState(false);
 const [showPassword, setShowPassword] = useState(false);
 const [email, setEmail] = useState("");
 const [password, setPassword] = useState("");
 const [error, setError] = useState("");
 const [authConfig, setAuthConfig] = useState<AuthAccessConfig | null>(null);

 useEffect(() => {
   const unsub = firebaseAuthAccessService.subscribe(setAuthConfig);
   return () => unsub();
 }, []);

 const handleLogin = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!email || !password) {
 showToast("Please fill in all fields", "error");
 return;
 }

 if (authConfig && !authConfig.roles.referee.login.enabled) {
   setError(authConfig.roles.referee.login.message || "Referee login is temporarily disabled by the administrator.");
   return;
 }

 setLoading(true);
 setError("");

 try {
  // Use Firebase Auth Directly for specific error handling
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;

  if (user) {
    try {
      // Check if user is a referee in Firestore
      const referee = await firebaseRefereeAuthService.getRefereeByUid(user.uid);
      if (referee) {
        if (!referee.active) {
          await auth.signOut();
          setError("Your account has been deactivated. Please contact the administrator.");
          setLoading(false);
          return;
        }

        // Audit log (fail silently)
        try {
          const { firebaseAuditService } = await import("../../services/firebaseData");
          await firebaseAuditService.logAction(
            "REFEREE_LOGIN",
            "referee",
            user.uid,
            { email },
            user.uid
          );
        } catch (_) {}

        navigate("/referee/dashboard");
        setLoading(false);
        return;
      }
    } catch (err) {
      console.warn("[AUTH] Error checking referee status:", err);
    }

    // No referee doc yet — this account may have registered under the old
    // admin-approval flow and still be sitting in refereeRequests. Approval is
    // no longer required, so migrate it into `referees` and let it straight in.
    // A request the admin explicitly rejected is the one exception: that is a
    // deliberate ban, not a pending approval.
    try {
      const { firebaseRefereeRequestService, firebaseRefereeService } = await import("../../services/firebaseData");
      const request = await firebaseRefereeRequestService.getByUid(user.uid);
      if (request?.status === "rejected") {
        await auth.signOut();
        setError("Your referee access has been revoked. Please contact the administrator.");
        setLoading(false);
        return;
      }
      if (request) {
        await firebaseRefereeService.create({
          name: request.name,
          email: request.email,
          phoneNumber: request.phoneNumber,
          schoolId: "",
          uid: user.uid,
          assignedBatchIds: [],
          active: true,
          status: "active",
        });
        navigate("/referee/dashboard", { replace: true });
        setLoading(false);
        return;
      }
    } catch (err) {
      console.warn("[AUTH] Error auto-activating legacy referee request:", err);
    }

    try {
      // Check if user is an admin
      const isAdmin = await firebaseAdminAuthService.isAdmin(user.uid);
      if (isAdmin) {
        navigate("/referee/dashboard");
        setLoading(false);
        return;
      }
    } catch (err) {
      console.warn("[AUTH] Error checking admin status:", err);
    }

    // Neither a referee, a legacy pending request, nor an admin
    await auth.signOut();
    setError("Account not found. Please register first, or contact the admin.");
  }
 } catch (error: any) {
 console.error("Login error:", error);
 if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
   setError("Invalid email or password");
 } else if (error.code === 'auth/network-request-failed') {
   setError("Network error. Please check your connection and try again.");
 } else if (error.code === 'auth/too-many-requests') {
   setError("Too many failed attempts. Please wait a moment and try again.");
 } else {
   setError("Login failed. Please try again.");
 }
 } finally {
 setLoading(false);
 }
 };

  return (
    <AuthLayout
      title="REFEREE LOGIN"
      subtitle="Shadow Kai Karate • Belt Test System"
    >

        {authConfig && !authConfig.roles.referee.login.enabled ? (
          <div className="text-center p-8 bg-zinc-950/50 rounded-2xl border border-red-500/30 backdrop-blur-sm animate-fade-in">
            <Lock className="w-12 h-12 text-red-500 mx-auto mb-4 opacity-80" />
            <h2 className="text-xl font-bold text-white mb-2">Login Disabled</h2>
            <p className="text-zinc-400 text-sm">{authConfig.roles.referee.login.message || "Referee login is temporarily disabled by the administrator."}</p>
            <button onClick={() => navigate("/")} className="mt-6 px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-semibold transition-colors">
              Return Home
            </button>
          </div>
        ) : (
          <>
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
                placeholder="referee@shadowkai.com"
                required
                disabled={loading}
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
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-12 py-3 bg-slate-50 border-slate-200 dark:bg-zinc-950/50 dark:border-white/10 rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all text-sm font-medium text-zinc-900 placeholder-slate-400 dark:text-white dark:placeholder-zinc-500"
                placeholder="Enter your password"
                required
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-blue-500"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
          
          <div className="flex justify-end -mt-2">
            <button type="button" onClick={() => navigate("/forgot-password")} className="text-sm font-semibold text-blue-500 hover:text-blue-400 transition-colors">
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
            className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-blue-600 text-white dark:bg-blue-500 dark:text-zinc-950 rounded-xl hover:bg-blue-400 font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all uppercase tracking-wider text-sm mt-2 shadow-lg"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white dark:border-zinc-950 border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                <span>Login as Referee</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-6 bg-slate-50 border border-slate-200 dark:bg-zinc-950/30 dark:border-white/5 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-zinc-800/50 rounded-lg shrink-0">
              <User className="w-5 h-5 text-zinc-400" />
            </div>
            <div>
              <p className="font-bold text-sm text-white mb-1">Referee Access Only</p>
              <p className="text-xs text-zinc-400 font-medium">
                If you don't have login credentials, please contact the administrator.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center space-y-3">
          <p className="text-sm text-zinc-400">
            Don't have an account?{" "}
            <button onClick={() => navigate("/referee/signup")} className="text-blue-500 hover:text-blue-400 font-bold transition-colors">
              Register here
            </button>
          </p>
          <a href="/admin/login" className="block text-sm text-slate-400 dark:text-zinc-500 hover:text-zinc-300 font-medium transition-colors">
            Admin Login →
          </a>
        </div>
          </>
        )}
    </AuthLayout>
  );
}
