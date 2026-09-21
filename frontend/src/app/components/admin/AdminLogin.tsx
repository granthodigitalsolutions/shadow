import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogIn, Shield, ArrowLeft, Mail, Lock } from "lucide-react";
import { firebaseAuthService } from "../../services/firebaseAuth";
import { firebaseAdminAuthService } from "../../services/firebaseData";
import AuthLayout from "../auth/AuthLayout";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const success = await firebaseAuthService.login(email, password);

    if (success) {
//       console.log("[AUTH] Firebase login success");
//       console.log("[AUTH] Checking admin role");
      const user = firebaseAuthService.getCurrentUser();
      if (user) {
        const isAdmin = await firebaseAdminAuthService.isAdmin(user.uid);
        if (isAdmin) {
//           console.log("[AUTH] Admin verified");
          navigate("/admin/karate/dashboard");
        } else {
          console.warn("[AUTH] Unknown user attempted admin access");
          setError("Unauthorized account.");
          await firebaseAuthService.logout();
        }
      }
    } else {
      setError("Invalid credentials. Please check your email and password.");
    }

    setLoading(false);
  };

  return (
    <AuthLayout
      title="ADMIN LOGIN"
      badgeIcon={<Shield className="w-4 h-4" />}
      badgeText="Secure Access"
    >

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
                placeholder="admin@shadowkai.com"
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
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border-slate-200 dark:bg-zinc-950/50 dark:border-white/10 rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all text-sm font-medium text-zinc-900 placeholder-slate-400 dark:text-white dark:placeholder-zinc-500"
                placeholder="********"
                required
                disabled={loading}
              />
            </div>
          </div>
          


          {error && (
            <div className="p-3 bg-red-950/50 text-red-400 text-sm font-medium rounded-xl border border-red-900/50">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white dark:bg-blue-500 dark:text-zinc-950 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg uppercase tracking-wider text-sm mt-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white dark:border-zinc-950 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                <span>Sign In</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-6 bg-slate-50 border border-slate-200 dark:bg-zinc-950/30 dark:border-white/5 rounded-xl p-4">
          <p className="text-xs text-zinc-400 text-center leading-relaxed">
            <strong>Security Notice:</strong> Admin credentials are managed securely through Firebase Authentication. Unauthorized access attempts are logged.
          </p>
        </div>
    </AuthLayout>
  );
}
