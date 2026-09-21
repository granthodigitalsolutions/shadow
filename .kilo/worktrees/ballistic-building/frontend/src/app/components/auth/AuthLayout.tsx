import { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import logoUrl from "../../../assets/shadow-kai-logo.png";

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  badgeIcon?: ReactNode;
  badgeText?: string;
  subtitle?: string;
}

export default function AuthLayout({ children, title, badgeIcon, badgeText, subtitle }: AuthLayoutProps) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen w-full bg-slate-50 dark:bg-[#0B0B0B] relative flex flex-col items-center justify-center p-4 sm:p-8 overflow-hidden">
      {/* Premium Background Effects */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        {/* Subtle radial gradients */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 dark:bg-blue-500/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 dark:bg-blue-600/5 rounded-full blur-[150px]" />
        
      </div>

      <div className="w-full max-w-[480px] mb-6 flex justify-start relative z-20">
        <button 
          onClick={() => navigate("/")} 
          className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:text-white transition-colors group"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span className="font-semibold text-sm tracking-wide">Back to Home</span>
        </button>
      </div>

      {/* Center Card */}
      <div className="w-full max-w-[480px] bg-white/80 dark:bg-zinc-900/80 backdrop-blur-2xl border border-slate-200 dark:border-white/10 p-8 sm:p-10 rounded-[28px] shadow-2xl relative z-10 flex flex-col items-center animate-fade-in-up">
        
        {/* Logo */}
        <div className="relative mb-6 group">
          <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full transition-all duration-500 group-hover:bg-blue-500/30 group-hover:blur-2xl" />
          <img src={logoUrl} alt="Shadow Kai Logo" className="w-20 h-20 object-contain drop-shadow-2xl relative z-10" />
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-2 text-center" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "1.5px" }}>
          {title}
        </h1>

        {/* Optional Badge */}
        {badgeText && (
          <div className="flex items-center justify-center gap-2 text-blue-500 bg-blue-500/10 border border-blue-500/20 px-4 py-1.5 rounded-full mt-2 mb-2">
            {badgeIcon}
            <span className="text-[10px] font-bold uppercase tracking-wider">{badgeText}</span>
          </div>
        )}

        {/* Optional Subtitle */}
        {subtitle && (
          <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium mt-2 text-center max-w-[90%]">
            {subtitle}
          </p>
        )}

        <div className="w-full mt-8">
          {children}
        </div>
      </div>
    </div>
  );
}
