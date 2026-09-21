import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { UserPlus, Mail, Lock, User, Phone, Eye, EyeOff } from "lucide-react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../config/firebase";
import { firebaseCoachService } from "../../services/firebaseData";
import { useToast } from "../../hooks/useToast";
import { firebaseAuthAccessService, AuthAccessConfig } from "../../services/firebaseAuthAccessService";
import AuthLayout from "../auth/AuthLayout";

export default function CoachRegister() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });

  const [authConfig, setAuthConfig] = useState<AuthAccessConfig | null>(null);

  useEffect(() => {
    const unsub = firebaseAuthAccessService.subscribe(setAuthConfig);
    return () => unsub();
  }, []);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.fullName.trim() || !formData.email.trim() || !formData.phone.trim()) {
      showToast("Please fill in all required fields", "error");
      return;
    }

    if (formData.password.length < 6) {
      showToast("Password must be at least 6 characters", "error");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      showToast("Passwords do not match", "error");
      return;
    }

    if (authConfig && !authConfig.roles?.coach?.registration?.enabled) {
      showToast(authConfig.roles?.coach?.registration?.message || "Coach registration is closed.", "error");
      return;
    }

    setLoading(true);

    try {
      // 1. Create Firebase Auth account
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );

      const uid = userCredential.user.uid;

      // 2. Directly create coach profile in Firestore — no approval needed
      await firebaseCoachService.create({
        fullName: formData.fullName.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
      }, uid);

      showToast("Registration successful! Redirecting to your dashboard...", "success");

      // 3. Redirect immediately — user stays signed in
      setTimeout(() => {
        navigate("/coach/dashboard");
      }, 1000);
    } catch (error: any) {
      console.error("Sign up error:", error);
      if (error.code === "auth/email-already-in-use") {
        showToast("Email already registered", "error");
      } else if (error.code === "auth/invalid-email") {
        showToast("Invalid email address", "error");
      } else if (error.code === "auth/weak-password") {
        showToast("Password is too weak", "error");
      } else {
        showToast("Registration failed. Please try again.", "error");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="COACH REGISTRATION"
      subtitle="Shadow Kai Karate - Coach Portal"
    >

        {authConfig && !authConfig.roles?.coach?.registration?.enabled ? (
          <div className="text-center p-8 bg-zinc-950/50 rounded-2xl border border-red-500/30 backdrop-blur-sm animate-fade-in">
            <Lock className="w-12 h-12 text-red-500 mx-auto mb-4 opacity-80" />
            <h2 className="text-xl font-bold text-white mb-2">Registration Closed</h2>
            <p className="text-zinc-400 text-sm">{authConfig.roles?.coach?.registration?.message || "Coach registration is temporarily unavailable. Please contact the administrator."}</p>
            <button onClick={() => navigate("/")} className="mt-6 px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-semibold transition-colors">
              Return Home
            </button>
          </div>
        ) : (
        <form onSubmit={handleSignUp} className="grid grid-cols-1 md:grid-cols-2 gap-5">
          
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-zinc-300 mb-2">Full Name *</label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"><User className="w-5 h-5" /></div>
              <input type="text" value={formData.fullName} onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} className="w-full pl-10 pr-4 py-3 bg-slate-50 border-slate-200 dark:bg-zinc-950/50 dark:border-white/10 rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-sm font-medium text-zinc-900 placeholder-slate-400 dark:text-white dark:placeholder-zinc-500 transition-all" placeholder="John Doe" disabled={loading} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-zinc-300 mb-2">Email Address *</label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"><Mail className="w-5 h-5" /></div>
              <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full pl-10 pr-4 py-3 bg-slate-50 border-slate-200 dark:bg-zinc-950/50 dark:border-white/10 rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-sm font-medium text-zinc-900 placeholder-slate-400 dark:text-white dark:placeholder-zinc-500 transition-all" placeholder="john@example.com" disabled={loading} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-zinc-300 mb-2">Mobile Number *</label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"><Phone className="w-5 h-5" /></div>
              <input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full pl-10 pr-4 py-3 bg-slate-50 border-slate-200 dark:bg-zinc-950/50 dark:border-white/10 rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-sm font-medium text-zinc-900 placeholder-slate-400 dark:text-white dark:placeholder-zinc-500 transition-all" placeholder="9876543210" disabled={loading} />
            </div>
          </div>


          <div>
            <label className="block text-sm font-semibold text-zinc-300 mb-2">Password *</label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"><Lock className="w-5 h-5" /></div>
              <input type={showPassword ? "text" : "password"} value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} className="w-full pl-10 pr-12 py-3 bg-slate-50 border-slate-200 dark:bg-zinc-950/50 dark:border-white/10 rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-sm font-medium text-zinc-900 placeholder-slate-400 dark:text-white dark:placeholder-zinc-500 transition-all" placeholder="********" disabled={loading} />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-blue-500">
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-zinc-300 mb-2">Confirm Password *</label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"><Lock className="w-5 h-5" /></div>
              <input type={showConfirmPassword ? "text" : "password"} value={formData.confirmPassword} onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })} className="w-full pl-10 pr-12 py-3 bg-slate-50 border-slate-200 dark:bg-zinc-950/50 dark:border-white/10 rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-sm font-medium text-zinc-900 placeholder-slate-400 dark:text-white dark:placeholder-zinc-500 transition-all" placeholder="********" disabled={loading} />
              <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-blue-500">
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div className="md:col-span-2 mt-2">
            <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-500 dark:hover:bg-blue-400 dark:text-zinc-950 font-bold py-3.5 px-4 rounded-xl transition-all flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider text-sm shadow-lg">
              {loading ? <div className="w-5 h-5 border-2 border-white dark:border-zinc-950 border-t-transparent rounded-full animate-spin" /> : <><UserPlus className="w-5 h-5" /><span>Create Account</span></>}
            </button>
          </div>

          <p className="text-center md:col-span-2 text-sm text-zinc-400 mt-2">
            Already have an account?{" "}
            <button type="button" onClick={() => navigate("/coach/login")} className="text-blue-500 hover:text-blue-400 font-semibold transition-colors">
              Sign In
            </button>
          </p>
        </form>
        )}
    </AuthLayout>
  );
}
