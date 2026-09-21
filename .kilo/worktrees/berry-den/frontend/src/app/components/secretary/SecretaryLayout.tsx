import { ReactNode, useState, useEffect, useTransition } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { LogOut, LayoutDashboard, Users, UserPlus, Menu, X, ChevronRight, UserCircle, DollarSign, School, ChevronDown, Check } from "lucide-react";
import { firebaseAuthService } from "../../services/firebaseAuth";
import { ThemeToggle } from "../ui/ThemeToggle";
import { useSecretarySchool } from "../../contexts/SecretarySchoolContext";
import logoUrl from "../../../assets/shadow-kai-logo.png";

interface SecretaryLayoutProps {
  children: ReactNode;
}

export default function SecretaryLayout({ children }: SecretaryLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [, startTransition] = useTransition();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSchoolMenuOpen, setIsSchoolMenuOpen] = useState(false);
  const { mySchools, selectedSchool, setSelectedSchoolId } = useSecretarySchool();

  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsSchoolMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await firebaseAuthService.logout();
    startTransition(() => navigate("/secretary/login"));
  };

  const navItems = [
    { path: `/secretary/schools`,  icon: School,           label: "My Schools" },
    { path: `/secretary/dashboard`, icon: LayoutDashboard, label: "Dashboard" },
    { path: `/secretary/students`,  icon: Users,           label: "Students" },
    { path: `/secretary/bulk-register`, icon: UserPlus,    label: "Bulk Registration" },
    { path: `/secretary/fee-request`,   icon: DollarSign,  label: "Fee Requests" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex flex-col lg:flex-row pb-20 lg:pb-0">
      
      {/* ─────────────────────────────────────────────────────────────────
          DESKTOP SIDEBAR
      ────────────────────────────────────────────────────────────────── */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 z-50 w-72 bg-white text-zinc-950 border-r border-zinc-200 flex-col dark:bg-zinc-950 dark:border-zinc-200 dark:border-zinc-800 dark:text-white">
        <div className="p-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-white p-1 rounded-xl shadow-sm">
              <img src={logoUrl} alt="Shadow Kai Logo" className="w-10 h-10 object-contain" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-wider" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                SHADOW KAI
              </h1>
              <p className="text-[10px] text-blue-500 font-bold uppercase tracking-widest">Secretary Portal</p>
            </div>
          </div>
          <ThemeToggle />
        </div>

        {/* School Switcher */}
        {mySchools.length > 0 && (
          <div className="px-4 relative">
            <button
              onClick={() => setIsSchoolMenuOpen((v) => !v)}
              className="w-full flex items-center justify-between gap-2 px-4 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:border-blue-400 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <School className="w-4 h-4 text-blue-600 shrink-0" />
                <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                  {selectedSchool ? selectedSchool.name : "Select a school"}
                </span>
              </div>
              <ChevronDown className={`w-4 h-4 text-zinc-400 shrink-0 transition-transform ${isSchoolMenuOpen ? "rotate-180" : ""}`} />
            </button>
            {isSchoolMenuOpen && (
              <div className="absolute left-4 right-4 mt-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl z-10 overflow-hidden max-h-64 overflow-y-auto">
                {mySchools.map((school) => (
                  <button
                    key={school.id}
                    onClick={() => {
                      setSelectedSchoolId(school.id);
                      setIsSchoolMenuOpen(false);
                    }}
                    className="w-full flex items-center justify-between gap-2 px-4 py-2.5 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-blue-50 dark:hover:bg-zinc-800 transition-colors text-left"
                  >
                    <span className="truncate">{school.name}</span>
                    {school.id === selectedSchool?.id && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                  </button>
                ))}
                <button
                  onClick={() => {
                    setIsSchoolMenuOpen(false);
                    startTransition(() => navigate("/secretary/schools"));
                  }}
                  className="w-full px-4 py-2.5 text-xs font-bold text-blue-600 hover:bg-blue-50 dark:hover:bg-zinc-800 transition-colors text-left border-t border-zinc-100 dark:border-zinc-800"
                >
                  Manage Schools
                </button>
              </div>
            )}
          </div>
        )}

        <nav className="flex-1 overflow-y-auto py-4 px-4 space-y-2 custom-scrollbar mt-4">
          {navItems.map((item) => {
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
                  <item.icon className={`w-5 h-5 transition-colors ${isActive ? "text-zinc-950" : "group-hover:text-blue-500"}`} />
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
      <header className="lg:hidden bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-200 dark:border-zinc-800 px-4 py-3 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-zinc-950 p-1.5 rounded-lg">
            <img src={logoUrl} alt="Logo" className="w-7 h-7 object-contain" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-zinc-950 dark:text-white leading-none tracking-wide" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
              SHADOW KAI
            </h1>
            <p className="text-[9px] text-blue-600 font-bold uppercase tracking-widest leading-none mt-0.5">Secretary Portal</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────────────
          MOBILE OVERLAY MENU
      ────────────────────────────────────────────────────────────────── */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-zinc-950/60 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
          <div className="relative w-4/5 max-w-sm bg-white dark:bg-zinc-950 h-full flex flex-col shadow-2xl animate-slide-in-right ml-auto">
            <div className="p-4 border-b border-zinc-100 dark:border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="bg-zinc-100 dark:bg-zinc-900 p-2 rounded-full">
                  <UserCircle className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h2 className="font-bold text-sm text-zinc-900 dark:text-white">Secretary Menu</h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Navigation</p>
                </div>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {navItems.map((item) => {
                const isActive = (location.pathname || '').includes(item.path);
                return (
                  <button
                    key={item.path}
                    onClick={() => startTransition(() => navigate(item.path))}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all font-semibold text-sm ${
                      isActive 
                        ? "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-500 border border-blue-200 dark:border-blue-500/20" 
                        : "text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                    }`}
                  >
                    <item.icon className={`w-5 h-5 ${isActive ? "text-blue-600 dark:text-blue-500" : "text-zinc-400 dark:text-zinc-500"}`} />
                    {item.label}
                  </button>
                );
              })}
            </div>

            <div className="p-4 border-t border-zinc-100 dark:border-zinc-200 dark:border-zinc-800">
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-xl font-bold transition-colors"
              >
                <LogOut className="w-5 h-5" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────
          MOBILE BOTTOM BAR (Quick Actions)
      ────────────────────────────────────────────────────────────────── */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-200 dark:border-zinc-800 flex items-center justify-around p-2 z-40 pb-safe">
        {navItems.map(item => {
          const isActive = (location.pathname || '').includes(item.path);
          return (
            <button
              key={item.path}
              onClick={() => startTransition(() => navigate(item.path))}
              className={`flex flex-col items-center p-2 rounded-xl min-w-[64px] transition-all ${
                isActive ? "text-blue-600 dark:text-blue-500 bg-blue-50 dark:bg-blue-500/10" : "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900"
              }`}
            >
              <item.icon className={`w-5 h-5 mb-1 ${isActive ? "fill-blue-100 dark:fill-blue-900/30" : ""}`} />
              <span className="text-[10px] font-bold">{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* ─────────────────────────────────────────────────────────────────
          MAIN CONTENT AREA
      ────────────────────────────────────────────────────────────────── */}
      <main className="flex-1 lg:ml-72 min-h-screen flex flex-col relative">
        <div className="flex-1 p-4 md:p-8 max-w-[1600px] mx-auto w-full">
          {children}
        </div>
      </main>
      
    </div>
  );
}
