import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { UserPlus, Shield, Mail, Lock, User } from "lucide-react";
import { createUserWithEmailAndPassword, deleteUser, signOut } from "firebase/auth";
import { auth } from "../../config/firebase";
import { firebaseAdminAuthService } from "../../services/firebaseData";
import { firebaseAuthAccessService } from "../../services/firebaseAuthAccessService";
import AuthLayout from "../auth/AuthLayout";

const inputCls =
  "w-full pl-10 pr-4 py-3 bg-slate-50 border-slate-200 dark:bg-zinc-950/50 dark:border-white/10 rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all text-sm font-medium text-zinc-900 placeholder-slate-400 dark:text-white dark:placeholder-zinc-500";

// Instant admin self-registration. Only works while "Admin Self-Registration"
// is enabled in Auth Settings - the Firestore rules enforce the same switch, so
// it cannot be bypassed from the browser.
export default function AdminRegister() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<boolean | null>(null);

  useEffect(() => {
    firebaseAuthAccessService
      .getSettings()
      .then((cfg) => setOpen(cfg.roles?.admin?.registration?.enabled ?? true))
      .catch(() => setOpen(true)); // the database rule still decides
    import("./AdminDashboard");
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (name.trim().length < 2) return setError("Enter your full name.");
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    if (password !== confirm) return setError("Passwords do not match.");

    setLoading(true);
    let created: Awaited<ReturnType<typeof createUserWithEmailAndPassword>> | null = null;
    try {
      created = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await firebaseAdminAuthService.createAdmin(created.user.uid, { name: name.trim(), email: email.trim() } as any);
      sessionStorage.setItem("sk_admin_verified_uid", created.user.uid);
      navigate("/admin/karate/dashboard", { replace: true });
    } catch (err: any) {
      const code = err?.code || "";
      if (created) {
        // The account was made but the admin record was refused (registration closed):
        // remove the half-created sign-in so it can't linger.
        await deleteUser(created.user).catch(() => signOut(auth));
      }
      setError(
        code === "auth/email-already-in-use" ? "An account with this email already exists. Please sign in instead."
        : code === "auth/invalid-email" ? "Enter a valid email address."
        : code === "auth/weak-password" ? "Password is too weak (at least 6 characters)."
        : /permission/i.test(err?.message || "") ? "Admin registration is currently closed."
        : "Registration failed. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="ADMIN REGISTER" badgeIcon={<Shield className="w-4 h-4" />} badgeText="Create Admin Account">
      {open === false ? (
        <div className="p-4 bg-red-950/50 text-red-400 text-sm font-medium rounded-xl border border-red-900/50">
          {firebaseAuthAccessService.getAdminRegistrationMessage()}
        </div>
      ) : (
        <form onSubmit={handleRegister} className="space-y-5">
          {[
            { label: "Full Name", icon: User, type: "text", value: name, set: setName, ph: "Your name", auto: "name" },
            { label: "Email Address", icon: Mail, type: "email", value: email, set: setEmail, ph: "admin@shadowkai.com", auto: "email" },
            { label: "Password", icon: Lock, type: "password", value: password, set: setPassword, ph: "At least 6 characters", auto: "new-password" },
            { label: "Confirm Password", icon: Lock, type: "password", value: confirm, set: setConfirm, ph: "Repeat password", auto: "new-password" },
          ].map((f) => (
            <div key={f.label}>
              <label className="block text-sm font-semibold text-zinc-300 mb-2">{f.label}</label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"><f.icon className="w-5 h-5" /></div>
                <input type={f.type} value={f.value} autoComplete={f.auto} onChange={(e) => f.set(e.target.value)} className={inputCls} placeholder={f.ph} required disabled={loading} />
              </div>
            </div>
          ))}

          {error && <div className="p-3 bg-red-950/50 text-red-400 text-sm font-medium rounded-xl border border-red-900/50">{error}</div>}

          <button
            type="submit"
            disabled={loading || open === null}
            className="w-full bg-blue-600 text-white dark:bg-blue-500 dark:text-zinc-950 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg uppercase tracking-wider text-sm mt-2"
          >
            {loading ? <div className="w-5 h-5 border-2 border-white dark:border-zinc-950 border-t-transparent rounded-full animate-spin" /> : <><UserPlus className="w-5 h-5" /><span>Create Admin Account</span></>}
          </button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-zinc-400">
        Already have an account?{" "}
        <Link to="/admin/login" className="font-bold text-blue-500 hover:text-blue-400">Sign in</Link>
      </p>
    </AuthLayout>
  );
}
