import { ReactNode, useState, useEffect, useTransition } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { LogOut, LayoutDashboard, Users, ClipboardList, DollarSign, Calendar, Bell, School, Settings, Menu, X, ChevronRight, MoreHorizontal, MessageCircle, UserCircle, Layers, Tag, Shield, Activity, CreditCard } from "lucide-react";
import { firebaseAuthService } from "../../services/firebaseAuth";
import { useProgram } from "../../contexts/ProgramContext";
import ProgramSwitcher from "./ProgramSwitcher";
import { ThemeToggle } from "../ui/ThemeToggle";
import logoUrl from "../../../assets/shadow-kai-logo.png";

import {
 firebaseStudentService,
 firebaseSchoolService,
 firebaseBeltTestService,
 firebaseBatchService
} from "../../services/firebaseData";

interface AdminLayoutProps {
 children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
 const navigate = useNavigate();
 const location = useLocation();
 const { currentProgram, program } = useProgram();
 const [, startTransition] = useTransition();
 const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

 const handleLogout = async () => {
 await firebaseAuthService.logout();
 startTransition(() => navigate("/admin/login"));
 };

 // Close mobile menu when route changes
 useEffect(() => {
 setIsMobileMenuOpen(false);
 }, [location.pathname]);

 // Background Sync Manager Setup
 useEffect(() => {
 const prog = currentProgram;
 
 // syncManager.register("students", () => firebaseStudentService.getAll(prog));
 // syncManager.register("schools", () => firebaseSchoolService.getAll(false, prog));
 // syncManager.register("beltTests", () => firebaseBeltTestService.getAll(prog as any, false));
 // syncManager.register("batches", () => firebaseBatchService.getAll(prog));
 // syncManager.register("referees", () => firebaseRefereeService.getAll());

 // syncManager.start();

 return () => {
 // syncManager.stop();
 // syncManager.unregister("students");
 // syncManager.unregister("schools");
 // syncManager.unregister("beltTests");
 // syncManager.unregister("batches");
 // syncManager.unregister("referees");
 };
 }, [currentProgram]);

 const allNavItems = [
 { path: `/admin/${program}/dashboard`, icon: LayoutDashboard, label: "Dashboard" },
 { path: `/admin/${program}/live-monitor`, icon: Activity, label: "Batch Monitor" },
 { path: `/admin/${program}/schools`, icon: School, label: "Schools" },
 { path: `/admin/${program}/students`, icon: Users, label: "Students" },
 { path: `/admin/${program}/individual-batches`, icon: Layers, label: "Batches" },
 { path: `/admin/${program}/results`, icon: ClipboardList, label: "Results" },
 { path: `/admin/${program}/whatsapp-results`, icon: MessageCircle, label: "Send Results" },
 { path: `/admin/${program}/manage-belt-tests`, icon: Calendar, label: currentProgram === 'SELAMBAM' ? "Stage Tests" : "Belt Tests" },
 { path: `/admin/${program}/coaches`, icon: Users, label: "Coaches" },
 { path: `/admin/${program}/payments`, icon: CreditCard, label: "Payments" },
 { path: `/admin/${program}/fee-structure`, icon: DollarSign, label: "Fees" },
 { path: `/admin/${program}/stickers`, icon: Tag, label: "Stickers" },
 { path: `/admin/${program}/auth-settings`, icon: Shield, label: "Auth Settings" },
 { path: `/admin/${program}/settings`, icon: Settings, label: "Settings" },
 ];

 // Primary items for mobile bottom bar
 const primaryNavItems = allNavItems.filter(item => 
 ["Dashboard", "Students", "Belt Tests", "Stage Tests", "Results"].includes(item.label)
 );

 // Secondary items for the "More" menu
 const secondaryNavItems = allNavItems.filter(item => 
 !["Dashboard", "Students", "Belt Tests", "Stage Tests", "Results"].includes(item.label)
 );

 return (
 <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 flex flex-col lg:flex-row pb-20 lg:pb-0 print:min-h-0 print:h-auto">
 
 {/* ─────────────────────────────────────────────────────────────────
 DESKTOP SIDEBAR
 ────────────────────────────────────────────────────────────────── */}
 <aside className="hidden lg:flex fixed inset-y-0 left-0 z-50 w-72 bg-white text-zinc-950 border-r border-zinc-200 flex-col dark:bg-zinc-950 dark:border-zinc-200 dark:border-zinc-800 dark:text-white print:hidden">
 <div className="p-6 flex flex-wrap items-center justify-between gap-3">
 <div className="flex items-center gap-3">
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 p-1 rounded-xl shadow-sm dark:shadow-none dark:border dark:border-zinc-200 dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-200 dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-200 dark:border-zinc-800">
 <img src={logoUrl} alt="Shadow Kai Logo" className="w-10 h-10 object-contain" />
 </div>
 <div>
 <h1 className="text-xl font-bold tracking-wider" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
 SHADOW KAI
 </h1>
 <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-semibold uppercase tracking-widest">Admin Portal</p>
 </div>
 </div>
 <ThemeToggle />
 </div>

 <div className="px-4 pb-3 border-b border-zinc-200 dark:border-zinc-800">
 <ProgramSwitcher />
 </div>

 <nav className="flex-1 overflow-y-auto py-4 px-4 space-y-1 custom-scrollbar">
 {allNavItems.map((item) => {
 const isActive = (location.pathname || '').includes(item.path);
 return (
 <button
 key={item.path}
 onClick={() => startTransition(() => navigate(item.path))}
 className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 group ${
 isActive 
 ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" 
 : "text-zinc-600 hover:bg-blue-50 hover:text-blue-700 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
 }`}
 >
 <div className="flex items-center gap-3">
 <item.icon className={`w-5 h-5 transition-colors ${isActive ? "text-white" : "text-zinc-400 group-hover:text-blue-700 dark:text-zinc-500 dark:group-hover:text-blue-500"}`} />
 <span className="font-semibold text-sm">{item.label}</span>
 </div>
 {isActive && <ChevronRight className="w-4 h-4 opacity-50" />}
 </button>
 );
 })}
 </nav>

 <div className="p-4 border-t border-zinc-200 dark:border-zinc-800">
 <button
 onClick={handleLogout}
 className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10 rounded-xl transition-colors font-semibold text-sm group"
 >
 <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center group-hover:bg-red-500/20 transition-colors">
 <LogOut className="w-4 h-4" />
 </div>
 Logout
 </button>
 </div>

 </aside>

 {/* ─────────────────────────────────────────────────────────────────
 MOBILE TOP HEADER
 ────────────────────────────────────────────────────────────────── */}
 <header className="lg:hidden bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-200 dark:border-zinc-800 dark:border-zinc-200 dark:border-zinc-800 dark:border-zinc-200 dark:border-zinc-800 dark:border-zinc-200 dark:border-zinc-800 dark:border-zinc-200 dark:border-zinc-800 px-4 py-3 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-30 shadow-sm dark:shadow-none dark:border dark:border-zinc-200 dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-200 dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-200 dark:border-zinc-800 animate-fade-in print:hidden">
 <div className="flex items-center gap-3">
 <img src={logoUrl} alt="Logo" className="w-8 h-8 object-contain" />
 <span className="text-xl font-bold text-zinc-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-white tracking-wide" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>SHADOW KAI ADMIN</span>
 </div>
 <ThemeToggle />
 </header>

 {/* ─────────────────────────────────────────────────────────────────
 MAIN CONTENT AREA
 ────────────────────────────────────────────────────────────────── */}
 <main className="flex-1 lg:ml-72 p-4 sm:p-6 lg:p-8 overflow-x-hidden animate-fade-in print:m-0 print:p-0 print:overflow-visible">
 {children}
 </main>

 {/* ─────────────────────────────────────────────────────────────────
 MOBILE BOTTOM NAVIGATION
 ────────────────────────────────────────────────────────────────── */}
 <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 border-t border-gray-200 dark:border-zinc-200 dark:border-zinc-800 dark:border-zinc-200 dark:border-zinc-800 dark:border-zinc-200 dark:border-zinc-800 dark:border-zinc-200 dark:border-zinc-800 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-40 pb-safe print:hidden">
 <div className="flex items-center justify-around px-2 h-16">
 {primaryNavItems.map((item) => {
 const isActive = (location.pathname || '').includes(item.path);
 return (
 <button
 key={item.path}
 onClick={() => startTransition(() => navigate(item.path))}
 className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-all duration-200 active:scale-95 ${
 isActive ? "text-blue-600" : "text-gray-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white dark:text-zinc-50 dark:hover:text-white dark:text-zinc-50 dark:hover:text-white dark:text-zinc-50 dark:text-zinc-50"
 }`}
 >
 <div className={`relative flex items-center justify-center w-8 h-8 rounded-full transition-all ${isActive ? 'bg-blue-100' : ''}`}>
 <item.icon className={`w-5 h-5 ${isActive ? 'fill-blue-100' : ''}`} />
 </div>
 <span className={`text-[10px] font-semibold ${isActive ? "font-bold" : "font-medium"}`}>
 {item.label}
 </span>
 </button>
 );
 })}

 {/* "More" Button */}
 <button
 onClick={() => setIsMobileMenuOpen(true)}
 className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-all duration-200 active:scale-95 ${
 isMobileMenuOpen ? "text-blue-600" : "text-gray-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white dark:text-zinc-50 dark:hover:text-white dark:text-zinc-50 dark:hover:text-white dark:text-zinc-50 dark:text-zinc-50"
 }`}
 >
 <div className={`relative flex items-center justify-center w-8 h-8 rounded-full transition-all ${isMobileMenuOpen ? 'bg-blue-100' : ''}`}>
 <MoreHorizontal className="w-5 h-5" />
 </div>
 <span className="text-[10px] font-medium">Menu</span>
 </button>
 </div>
 </nav>

 {/* ─────────────────────────────────────────────────────────────────
 MOBILE "MORE" BOTTOM SHEET
 ────────────────────────────────────────────────────────────────── */}
 {isMobileMenuOpen && (
 <>
 <div 
 className="fixed inset-0 bg-black/60 z-50 lg:hidden backdrop-blur-sm animate-fade-in"
 onClick={() => setIsMobileMenuOpen(false)}
 />
 <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-t-3xl z-50 lg:hidden animate-slide-up shadow-2xl flex flex-col max-h-[85vh]">
 <div className="flex items-center justify-center pt-3 pb-1">
 <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
 </div>
 
 <div className="flex flex-wrap items-center justify-between gap-3 px-6 pb-4 pt-2 border-b border-gray-100 dark:border-zinc-200 dark:border-zinc-800 dark:border-zinc-200 dark:border-zinc-800 dark:border-zinc-200 dark:border-zinc-800 dark:border-zinc-200 dark:border-zinc-800">
 <h2 className="text-xl font-bold text-gray-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>More Options</h2>
 <button 
 onClick={() => setIsMobileMenuOpen(false)}
 className="p-2 bg-gray-100 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 rounded-full text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 hover:bg-gray-200 active:scale-95"
 >
 <X className="w-5 h-5" />
 </button>
 </div>

 <div className="overflow-y-auto p-4 space-y-4">
 <div className="bg-gray-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 p-3 rounded-2xl border border-gray-100 dark:border-zinc-200 dark:border-zinc-800 dark:border-zinc-200 dark:border-zinc-800 dark:border-zinc-200 dark:border-zinc-800 dark:border-zinc-200 dark:border-zinc-800">
 <ProgramSwitcher />
 </div>

 <div className="grid grid-cols-2 gap-3">
 {secondaryNavItems.map((item) => {
 const isActive = (location.pathname || '').includes(item.path);
 return (
 <button
 key={item.path}
 onClick={() => startTransition(() => navigate(item.path))}
 className={`flex items-center gap-3 p-4 rounded-2xl border transition-all active:scale-95 ${
 isActive 
 ? "bg-blue-50 border-blue-200 text-blue-900" 
 : "bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 border-gray-200 dark:border-zinc-200 dark:border-zinc-800 dark:border-zinc-200 dark:border-zinc-800 dark:border-zinc-200 dark:border-zinc-800 dark:border-zinc-200 dark:border-zinc-800 text-gray-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 hover:border-gray-300 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700 shadow-sm dark:shadow-none dark:border dark:border-zinc-200 dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-200 dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-200 dark:border-zinc-800"
 }`}
 >
 <item.icon className={`w-5 h-5 ${isActive ? "text-blue-600" : "text-gray-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400"}`} />
 <span className="font-semibold text-sm">{item.label}</span>
 </button>
 );
 })}
 </div>

 <button
 onClick={handleLogout}
 className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-2xl font-bold transition-colors active:scale-95"
 >
 <LogOut className="w-5 h-5" />
 Logout
 </button>
 </div>

 </div>
 </>
 )}

 </div>
 );
}
