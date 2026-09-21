import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { KeyRound, ArrowLeft, Send, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";
import { auth } from "../../config/firebase";
import logoUrl from "../../../assets/shadow-kai-logo.png";
import { FirebaseError } from "firebase/app";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const oobCode = searchParams.get("oobCode");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Verify the reset code when component mounts
  useEffect(() => {
    const verifyCode = async () => {
      if (!oobCode) {
        setError("Invalid or missing reset code. Please request a new password reset link.");
        setVerifyingCode(false);
        return;
      }
      try {
        const verifiedEmail = await verifyPasswordResetCode(auth, oobCode);
        setEmail(verifiedEmail);
      } catch (err: unknown) {
        if (err instanceof FirebaseError) {
          switch (err.code) {
            case "auth/invalid-action-code":
              setError("The password reset link is invalid or has expired. Please request a new one.");
              break;
            default:
              setError(`Error verifying link: ${err.message}`);
          }
        } else {
          setError("An unexpected error occurred verifying the reset link.");
        }
      } finally {
        setVerifyingCode(false);
      }
    };

    verifyCode();
  }, [oobCode]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oobCode) return;
    
    setError("");
    
    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }
    
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    
    setLoading(true);

    try {
      await confirmPasswordReset(auth, oobCode, password);
      setSuccess(true);
    } catch (err: unknown) {
      console.error("Password reset failed:", err);
      if (err instanceof FirebaseError) {
        setError(`Firebase Error: ${err.code} - ${err.message}`);
      } else {
        setError("An unexpected error occurred: " + String(err));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background styling to match other auth pages */}
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1555597673-b21d5c935865?auto=format&fit=crop&q=80')] bg-cover bg-center opacity-10" />
      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-transparent" />

      <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl relative z-10 border border-zinc-200 dark:border-zinc-800 p-8 overflow-hidden backdrop-blur-sm">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-red-500" />
        
        <div className="flex justify-center mb-8">
          <div className="w-20 h-20 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center p-4 border-2 border-zinc-200 dark:border-zinc-700">
            <img src={logoUrl} alt="Shadow Kai Logo" className="w-full h-full object-contain" />
          </div>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '1px' }}>
            CREATE NEW PASSWORD
          </h1>
          <p className="text-slate-400 dark:text-zinc-500 dark:text-zinc-400 font-medium text-xs tracking-wider uppercase mt-2">
            Secure your Shadow Kai account
          </p>
        </div>

        {verifyingCode ? (
          <div className="text-center py-8">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-zinc-400 font-medium">Verifying reset link...</p>
          </div>
        ) : error && !success && !email ? (
          <div className="text-center animate-in fade-in zoom-in duration-300">
             <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 mb-6">
              <ShieldCheck className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-red-800 dark:text-red-400 mb-2">Link Invalid</h3>
              <p className="text-sm text-red-600 dark:text-red-500">
                {error}
              </p>
            </div>
            <button
              onClick={() => navigate("/forgot-password")}
              className="inline-flex items-center text-sm font-bold text-blue-600 dark:text-blue-500 hover:text-blue-700 dark:hover:text-blue-400 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Request New Link
            </button>
          </div>
        ) : success ? (
          <div className="text-center animate-in fade-in zoom-in duration-300">
            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-6 mb-6">
              <ShieldCheck className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-emerald-800 dark:text-emerald-400 mb-2">Password Reset Successful</h3>
              <p className="text-sm text-emerald-600 dark:text-emerald-500">
                Your password has been successfully updated. You can now sign in with your new password.
              </p>
            </div>
            <button
              onClick={() => navigate("/")}
              className="w-full flex justify-center items-center py-3.5 px-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 transition-all hover:shadow-xl hover:shadow-blue-500/30 active:scale-[0.98]"
            >
              Go to Login
            </button>
          </div>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-5">
            {email && (
               <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 text-center">
                 <p className="text-sm text-slate-400 dark:text-zinc-500 dark:text-zinc-400">Resetting password for:</p>
                 <p className="font-semibold text-zinc-900 dark:text-white">{email}</p>
               </div>
            )}
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">
                New Password
              </label>
              <div className="relative group">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-blue-500 transition-colors">
                  <KeyRound className="w-5 h-5" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm font-medium text-zinc-900 dark:text-zinc-50"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">
                Confirm New Password
              </label>
              <div className="relative group">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-blue-500 transition-colors">
                  <KeyRound className="w-5 h-5" />
                </div>
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm font-medium text-zinc-900 dark:text-zinc-50"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg text-sm text-red-600 dark:text-red-400 text-center font-medium animate-in slide-in-from-top-1">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !password || !confirmPassword}
              className="w-full flex justify-center items-center py-3.5 px-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 transition-all hover:shadow-xl hover:shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] mt-6"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Send className="w-5 h-5 mr-2" />
                  Reset Password
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
