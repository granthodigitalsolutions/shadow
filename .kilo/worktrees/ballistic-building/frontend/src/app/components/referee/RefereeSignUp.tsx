import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { UserPlus, Mail, Lock, User, Phone, Eye, EyeOff } from "lucide-react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../config/firebase";
import { firebaseRefereeService, firebaseAuditService } from "../../services/firebaseData";
import { useToast } from "../../hooks/useToast";
import { firebaseAuthAccessService, AuthAccessConfig } from "../../services/firebaseAuthAccessService";
import AuthLayout from "../auth/AuthLayout";
export default function RefereeSignUp() {
 const navigate = useNavigate();
 const { showToast } = useToast();
 const [loading, setLoading] = useState(false);
 const [showPassword, setShowPassword] = useState(false);
 const [showConfirmPassword, setShowConfirmPassword] = useState(false);
 const [formData, setFormData] = useState({
 name: "",
 email: "",
 phoneNumber: "",
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
 if (!formData.name.trim()) {
 showToast("Please enter your full name", "error");
 return;
 }

 if (!formData.email.trim()) {
 showToast("Please enter your email", "error");
 return;
 }

 if (!formData.phoneNumber.trim()) {
 showToast("Please enter your phone number", "error");
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

 if (authConfig && !authConfig.roles.referee.registration.enabled) {
   showToast(authConfig.roles.referee.registration.message || "Referee registration is closed.", "error");
   return;
 }

 setLoading(true);

 let createdUser: import("firebase/auth").User | null = null;
 try {
 // Create Firebase Auth account
 const userCredential = await createUserWithEmailAndPassword(
 auth,
 formData.email,
 formData.password
 );
 createdUser = userCredential.user;

  // Directly create the active referee profile — no admin approval needed
  try {
    await firebaseRefereeService.create({
      name: formData.name.trim(),
      email: formData.email.trim(),
      phoneNumber: formData.phoneNumber.trim(),
      schoolId: "",
      uid: userCredential.user.uid,
      assignedBatchIds: [],
      active: true,
      status: "active",
    });
  } catch (profileError) {
    // Auth account exists but the profile write failed — roll back the auth
    // account so the email isn't left in a stuck "in-use but no profile" state.
    console.error("Referee profile creation failed, rolling back auth account:", profileError);
    try {
      await createdUser.delete();
    } catch (rollbackError) {
      console.error("Failed to roll back auth account after profile creation failure:", rollbackError);
    }
    showToast("Registration failed while creating your profile. Please try again.", "error");
    setLoading(false);
    return;
  }

    // Log the registration action (fail silently if permissions are insufficient)
    try {
      await firebaseAuditService.logAction(
        "REFEREE_REGISTERED",
        "referee",
        userCredential.user.uid,
        { email: formData.email.trim(), name: formData.name.trim() },
        userCredential.user.uid
      );
    } catch (logError) {
      console.warn("Failed to log registration action:", logError);
    }

 showToast("Registration successful. Welcome to Shadow Kai!", "success");

 // createUserWithEmailAndPassword already signed this user in, so the session
 // is live — go straight to the dashboard, no approval wait.
 navigate("/referee/dashboard", { replace: true });
 } catch (error: any) {
 console.error("Sign up error:", error);
 if (error.code === "auth/email-already-in-use") {
 showToast("An account with this email already exists.", "error");
 } else if (error.code === "auth/invalid-email") {
 showToast("Invalid email address", "error");
 } else if (error.code === "auth/weak-password") {
 showToast("Password is too weak", "error");
 } else {
 showToast("Registration failed. Please check your connection and try again.", "error");
 }
 } finally {
 setLoading(false);
 }
 };

  return (
    <AuthLayout
      title="REFEREE SIGN UP"
      subtitle="Shadow Kai Karate - Create Your Referee Account"
    >

        {authConfig && !authConfig.roles.referee.registration.enabled ? (
          <div className="text-center p-8 bg-zinc-950/50 rounded-2xl border border-red-500/30 backdrop-blur-sm animate-fade-in">
            <Lock className="w-12 h-12 text-red-500 mx-auto mb-4 opacity-80" />
            <h2 className="text-xl font-bold text-white mb-2">Registration Closed</h2>
            <p className="text-zinc-400 text-sm">{authConfig.roles.referee.registration.message || "Referee registration is temporarily unavailable. Please contact the administrator."}</p>
            <button onClick={() => navigate("/")} className="mt-6 px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-semibold transition-colors">
              Return Home
            </button>
          </div>
        ) : (
          <>
            {/* Sign Up Form */}
            <form onSubmit={handleSignUp} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-zinc-300 mb-2">Full Name *</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
                    <User className="w-5 h-5" />
                  </div>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border-slate-200 dark:bg-zinc-950/50 dark:border-white/10 rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all text-sm font-medium text-zinc-900 placeholder-slate-400 dark:text-white dark:placeholder-zinc-500"
                    placeholder="Referee Kumar"
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-zinc-300 mb-2">Email Address *</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
                    <Mail className="w-5 h-5" />
                  </div>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border-slate-200 dark:bg-zinc-950/50 dark:border-white/10 rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all text-sm font-medium text-zinc-900 placeholder-slate-400 dark:text-white dark:placeholder-zinc-500"
                    placeholder="referee@example.com"
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-zinc-300 mb-2">Phone Number *</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
                    <Phone className="w-5 h-5" />
                  </div>
                  <input
                    type="tel"
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border-slate-200 dark:bg-zinc-950/50 dark:border-white/10 rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all text-sm font-medium text-zinc-900 placeholder-slate-400 dark:text-white dark:placeholder-zinc-500"
                    placeholder="+91 98765 43210"
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-zinc-300 mb-2">Password *</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
                    <Lock className="w-5 h-5" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full pl-10 pr-12 py-3 bg-slate-50 border-slate-200 dark:bg-zinc-950/50 dark:border-white/10 rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all text-sm font-medium text-zinc-900 placeholder-slate-400 dark:text-white dark:placeholder-zinc-500"
                    placeholder="Minimum 6 characters"
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

              <div>
                <label className="block text-sm font-semibold text-zinc-300 mb-2">Confirm Password *</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
                    <Lock className="w-5 h-5" />
                  </div>
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className="w-full pl-10 pr-12 py-3 bg-slate-50 border-slate-200 dark:bg-zinc-950/50 dark:border-white/10 rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all text-sm font-medium text-zinc-900 placeholder-slate-400 dark:text-white dark:placeholder-zinc-500"
                    placeholder="Re-enter password"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-blue-500"
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-blue-600 text-white dark:bg-blue-500 dark:text-zinc-950 rounded-xl hover:bg-blue-400 font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all uppercase tracking-wider text-sm mt-4 shadow-lg"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white dark:border-zinc-950 border-t-transparent rounded-full animate-spin"></div>
                    Registering...
                  </>
                ) : (
                  <>
                    <UserPlus className="w-5 h-5" />
                    Register as Referee
                  </>
                )}
              </button>
            </form>

            {/* Footer Links */}
            <div className="mt-6 text-center space-y-3">
              <p className="text-center text-sm text-zinc-400 mt-2">
                Already have an account?{" "}
                <button type="button" onClick={() => navigate("/referee/login")} className="text-blue-500 hover:text-blue-400 font-semibold transition-colors">
                  Sign In
                </button>
              </p>
              <a href="/" className="block text-sm text-slate-400 dark:text-zinc-500 hover:text-zinc-300 font-medium transition-colors">
                ← Back to Student Registration
              </a>
            </div>
          </>
        )}
    </AuthLayout>
  );
}
