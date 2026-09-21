import { RouterProvider, createBrowserRouter, Navigate, Outlet, useNavigate, useParams, useLocation } from "react-router-dom";
import { useState, lazy, Suspense, useEffect } from "react";
import { ThemeProvider } from "next-themes";
import WebLayout from "./components/layout/WebLayout";
import LandingPage from "./components/pages/LandingPage";
import NotFound from "./components/pages/NotFound";
import { Student, PageType } from "./types";
import { ToastProvider } from "./hooks/useToast";
import { DialogProvider } from "./contexts/DialogContext";
import { SecretarySchoolProvider } from "./contexts/SecretarySchoolContext";
import { SpeedInsights } from "@vercel/speed-insights/react";


// Protected routes are now lazy loaded

const lazyWithRetry = (componentImport: () => Promise<any>) =>
  lazy(async () => {
    const pageHasAlreadyBeenForceRefreshed = JSON.parse(
      window.sessionStorage.getItem('page-has-been-force-refreshed') || 'false'
    );

    try {
      const component = await componentImport();
      window.sessionStorage.setItem('page-has-been-force-refreshed', 'false');
      return component;
    } catch (error) {
      if (!pageHasAlreadyBeenForceRefreshed) {
        window.sessionStorage.setItem('page-has-been-force-refreshed', 'true');
        window.location.reload();
        // Return a never-resolving promise to prevent React from trying to render while reloading
        return new Promise(() => {}) as any;
      }
      throw error;
    }
  });

const LazyProgramProvider = lazyWithRetry(() => import('./contexts/LazyProgramProvider'));
const RegisterPage = lazyWithRetry(() => import('./components/pages/RegisterPage'));
const SelambamRegisterPage = lazyWithRetry(() => import('./components/pages/SelambamRegisterPage'));
const HallTicketPage = lazyWithRetry(() => import('./components/pages/HallTicketPage'));

const SecretaryLogin           = lazyWithRetry(() => import("./components/secretary/SecretaryLogin"));
const SecretaryRegister        = lazyWithRetry(() => import("./components/secretary/SecretaryRegister"));
const SecretaryDashboard       = lazyWithRetry(() => import("./components/secretary/SecretaryDashboard"));
const BulkRegistration         = lazyWithRetry(() => import("./components/secretary/BulkRegistration"));
const SecretaryFeeRequest = lazyWithRetry(() => import("./components/secretary/SecretaryFeeRequest"));
const SecretaryStudentManagement = lazyWithRetry(() => import("./components/secretary/SecretaryStudentManagement"));
const SecretaryMySchools = lazyWithRetry(() => import("./components/secretary/SecretaryMySchools"));

// Lazy load new public pages
const HomePage                 = lazyWithRetry(() => import("./components/pages/HomePage"));
const AboutPage                = lazyWithRetry(() => import("./components/pages/AboutPage"));
const ProgramsPage             = lazyWithRetry(() => import("./components/pages/ProgramsPage"));
const JourneyPage              = lazyWithRetry(() => import("./components/pages/JourneyPage"));
const GalleryPage              = lazyWithRetry(() => import("./components/pages/GalleryPage"));
const TestimonialsPage         = lazyWithRetry(() => import("./components/pages/TestimonialsPage"));
const ContactPage              = lazyWithRetry(() => import("./components/pages/ContactPage"));
const AchievementsPage         = lazyWithRetry(() => import("./components/pages/AchievementsPage"));

const ProgramKaratePage        = lazyWithRetry(() => import("./components/pages/ProgramKaratePage"));
const ProgramSilambamPage      = lazyWithRetry(() => import("./components/pages/ProgramSilambamPage"));
const ProgramKidsPage          = lazyWithRetry(() => import("./components/pages/ProgramKidsPage"));
const ProgramAdultsPage        = lazyWithRetry(() => import("./components/pages/ProgramAdultsPage"));
const ProgramSelfDefencePage   = lazyWithRetry(() => import("./components/pages/ProgramSelfDefencePage"));
const ProgramTournamentPage    = lazyWithRetry(() => import("./components/pages/ProgramTournamentPage"));
const ProgramBeltTestPage      = lazyWithRetry(() => import("./components/pages/ProgramBeltTestPage"));
const BlogIndexPage            = lazyWithRetry(() => import("./components/pages/BlogIndexPage"));
const BlogPostPage             = lazyWithRetry(() => import("./components/pages/BlogPostPage"));

// Lazy load admin components
const AdminLogin               = lazyWithRetry(() => import("./components/admin/AdminLogin"));
const AdminDashboard           = lazyWithRetry(() => import("./components/admin/AdminDashboard"));
const StudentManagement        = lazyWithRetry(() => import("./components/admin/StudentManagement"));
const ResultManagement         = lazyWithRetry(() => import("./components/admin/ResultManagement"));
const SchoolManagement         = lazyWithRetry(() => import("./components/admin/SchoolManagement"));
const BatchManagement          = lazyWithRetry(() => import("./components/admin/BatchManagement"));
const RefereeManagement        = lazyWithRetry(() => import("./components/admin/RefereeManagement"));
const SecretaryManagement      = lazyWithRetry(() => import("./components/admin/SecretaryManagement"));
const AdminSchoolDetail        = lazyWithRetry(() => import("./components/admin/AdminSchoolDetail"));
const BatchMonitoringDashboard = lazyWithRetry(() => import("./components/admin/monitoring/BatchMonitoringDashboard"));
const ManageBeltTests          = lazyWithRetry(() => import("./components/admin/ManageBeltTests"));
const CreateBeltTest           = lazyWithRetry(() => import("./components/admin/CreateBeltTest"));
const EditBeltTest             = lazyWithRetry(() => import("./components/admin/EditBeltTest"));
const FeeStructure             = lazyWithRetry(() => import("./components/admin/FeeStructure"));
const SchoolFeeRequests = lazyWithRetry(() => import("./components/admin/SchoolFeeRequests"));
const ScoreStudent             = lazyWithRetry(() => import("./components/admin/ScoreStudent"));
const ViewResult               = lazyWithRetry(() => import("./components/admin/ViewResult"));
const Settings                 = lazyWithRetry(() => import("./components/admin/Settings"));
const AdminAuthSettings        = lazyWithRetry(() => import("./components/admin/AdminAuthSettings"));
const WhatsAppResultsSender     = lazyWithRetry(() => import("./components/admin/WhatsAppResultsSender"));
const DataSeeder               = lazyWithRetry(() => import("./components/admin/DataSeeder"));
const StickerPrinting          = lazyWithRetry(() => import("./components/admin/StickerPrinting"));

const ProgramBranchManagement  = lazyWithRetry(() => import("./components/admin/ProgramBranchManagement"));

// Lazy load referee components
const RefereeLogin             = lazyWithRetry(() => import("./components/referee/RefereeLogin"));
const RefereeSignUp            = lazyWithRetry(() => import("./components/referee/RefereeSignUp"));
const RefereeDashboard         = lazyWithRetry(() => import("./components/referee/RefereeDashboard"));

// Lazy load auth components
const ForgotPassword           = lazyWithRetry(() => import("./components/auth/ForgotPassword"));
const ResetPassword            = lazyWithRetry(() => import("./components/auth/ResetPassword"));
const BatchScanner             = lazyWithRetry(() => import("./components/referee/BatchScanner"));
const BatchScoring             = lazyWithRetry(() => import("./components/referee/BatchScoring"));
const RefereeResults           = lazyWithRetry(() => import("./components/referee/RefereeResults"));

const ProtectedRoute = lazyWithRetry(() => import("./components/admin/ProtectedRoute"));
const RefereeProtectedRoute = lazyWithRetry(() => import("./components/referee/RefereeProtectedRoute"));
const SecretaryProtectedRoute = lazyWithRetry(() => import("./components/secretary/SecretaryProtectedRoute"));

// ── Shared loading fallback ─────────────────────────────────────────────────
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-gray-50">
    <div className="text-center">
      <div className="w-16 h-16 border-4 border-yellow-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
      <p className="text-gray-600">Loading…</p>
    </div>
  </div>
);

// ── Redirect helper for old admin URLs ─────────────────────────────────────
function RedirectToKarate({ path }: { path: string }) {
  const navigate = useNavigate();
  const params = useParams();

  useEffect(() => {
    // Replace params in path
    let targetPath = path;
    Object.entries(params).forEach(([key, value]) => {
      targetPath = targetPath.replace(`:${key}`, value || '');
    });
    navigate(targetPath, { replace: true });
  }, [navigate, params, path]);

  return <PageLoader />;
}

// ── Protected layout wrappers ───────────────────────────────────────────────
function AdminProtectedLayout() {
  return (
    <Suspense fallback={<PageLoader />}>
      <ProtectedRoute>
        <LazyProgramProvider>
          <Outlet />
        </LazyProgramProvider>
      </ProtectedRoute>
    </Suspense>
  );
}

function RefereeProtectedLayout() {
  return (
    <Suspense fallback={<PageLoader />}>
      <RefereeProtectedRoute>
        <LazyProgramProvider>
          <Outlet />
        </LazyProgramProvider>
      </RefereeProtectedRoute>
    </Suspense>
  );
}

function SecretaryProtectedLayout() {
  return (
    <Suspense fallback={<PageLoader />}>
      <SecretaryProtectedRoute>
        <LazyProgramProvider>
          <SecretarySchoolProvider>
            <Outlet />
          </SecretarySchoolProvider>
        </LazyProgramProvider>
      </SecretaryProtectedRoute>
    </Suspense>
  );
}

// ── Public layout (Suspense for lazy pages) ─────────────────────────────────
function PublicLayout() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Outlet />
    </Suspense>
  );
}

// ── Student registration flows (internal state machine, not router-driven) ──
function generateStudentId(): string {
  const year = new Date().getFullYear();
  const rand = Math.floor(10000 + Math.random() * 90000);
  return `SKT-${year}-${rand}`;
}

function StudentFlow() {
  const [page, setPage] = useState<PageType>("register");
  const [student, setStudent] = useState<Student>({
    id: generateStudentId(),
    name: "",
    gender: "",
    schoolId: "",
    school: "",
    standard: "",
    contact: "",
    whatsapp: "",
    beltIndex: 0,
    programType: "KARATE",
  });

  const handleNavigate = (target: string) => {
    setPage(target as PageType);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleStudentUpdate = (updates: Partial<Student>) => {
    setStudent((prev) => ({ ...prev, ...updates }));
  };

  return (
    <div style={{ fontFamily: "'Nunito', sans-serif", background: "var(--off)", color: "var(--ink)", minHeight: "100vh" }}>
      <Suspense fallback={<PageLoader />}>
        {page === "register" && (
          <RegisterPage onNavigate={handleNavigate} onStudentUpdate={handleStudentUpdate} />
        )}
        {page === "hallticket" && (
          <HallTicketPage 
            student={student} 
            onBack={() => handleNavigate("register")} 
            onRegisterNew={() => {
              setStudent({
                id: generateStudentId(),
                name: "",
                gender: "",
                schoolId: "",
                school: "",
                standard: "",
                contact: "",
                whatsapp: "",
                beltIndex: 0,
                programType: "KARATE",
              });
              handleNavigate("register");
            }}
          />
        )}
      </Suspense>
    </div>
  );
}

function SelambamFlow() {
  const [page, setPage] = useState<PageType>("register");
  const [student, setStudent] = useState<any>({
    id: generateStudentId(),
    name: "",
    gender: "",
    schoolId: "",
    school: "",
    standard: "",
    contact: "",
    whatsapp: "",
    stageLevel: 1,
    programType: "SELAMBAM",
  });

  const handleNavigate = (target: string) => {
    setPage(target as PageType);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleStudentUpdate = (updates: any) => {
    setStudent((prev: any) => ({ ...prev, ...updates }));
  };

  return (
    <div style={{ fontFamily: "'Nunito', sans-serif", background: "var(--off)", color: "var(--ink)", minHeight: "100vh" }}>
      <Suspense fallback={<PageLoader />}>
        {page === "register" && (
          <SelambamRegisterPage onNavigate={handleNavigate} onStudentUpdate={handleStudentUpdate} />
        )}
        {page === "hallticket" && (
          <HallTicketPage 
            student={student} 
            onBack={() => handleNavigate("register")} 
            onRegisterNew={() => {
              setStudent({
                id: generateStudentId(),
                name: "",
                gender: "",
                schoolId: "",
                school: "",
                standard: "",
                contact: "",
                whatsapp: "",
                stageLevel: 1,
                programType: "SELAMBAM",
              });
              handleNavigate("register");
            }}
          />
        )}
      </Suspense>
    </div>
  );
}

import { useRouteError } from "react-router-dom";

function GlobalError() {
  const error = useRouteError() as Error;
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center bg-gray-50 dark:bg-zinc-950">
      <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50 mb-2">Oops! Something went wrong</h1>
      <p className="text-gray-500 dark:text-gray-400 max-w-md mb-6">{error?.message || "An unexpected error occurred. Please try again."}</p>
      <button onClick={() => window.location.href = '/'} className="px-6 py-2.5 bg-gray-900 dark:bg-white dark:text-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition-colors">
        Return to Home
      </button>
    </div>
  );
}

// ── Root Wrapper for Conditional Theme ─────────────────────────────────────────
function RootWrapper() {
  const location = useLocation();
  const isDarkAllowed = location.pathname.startsWith('/admin') || location.pathname.startsWith('/referee') || location.pathname.startsWith('/secretary');
  
  return (
    <ThemeProvider attribute="class" defaultTheme="light" forcedTheme={isDarkAllowed ? undefined : "light"}>
      <Outlet />
    </ThemeProvider>
  );
}

// ── Router definition ───────────────────────────────────────────────────────
const router = createBrowserRouter([
  {
    element: <RootWrapper />,
    errorElement: <GlobalError />,
    children: [
      // Public pages wrapped in new multi-page layout
      {
        element: <WebLayout />,
        children: [
          { path: "/", element: <HomePage /> },
          { path: "/about", element: <AboutPage /> },
          { path: "/programs", element: <ProgramsPage /> },
          { path: "/programs/karate", element: <ProgramKaratePage /> },
          { path: "/programs/silambam", element: <ProgramSilambamPage /> },
          { path: "/programs/kids-karate", element: <ProgramKidsPage /> },
          { path: "/programs/adult-karate", element: <ProgramAdultsPage /> },
          { path: "/programs/womens-self-defence", element: <ProgramSelfDefencePage /> },
          { path: "/programs/tournament-training", element: <ProgramTournamentPage /> },
          { path: "/programs/belt-test-prep", element: <ProgramBeltTestPage /> },
          { path: "/blog", element: <BlogIndexPage /> },
          { path: "/blog/:slug", element: <BlogPostPage /> },
          { path: "/journey", element: <JourneyPage /> },
          { path: "/gallery", element: <GalleryPage /> },
          { path: "/testimonials", element: <TestimonialsPage /> },
          { path: "/contact", element: <ContactPage /> },
          { path: "/achievements", element: <AchievementsPage /> },
          { path: "/landing", element: <LandingPage /> }, // Keep old landing accessible if needed
        ],
      },

  { path: "/register",           element: <StudentFlow /> },
  { path: "/karate/register",    element: <StudentFlow /> },
  { path: "/selambam/register",  element: <SelambamFlow /> },

  // Admin public (login / register need Suspense)
  {
    element: <PublicLayout />,
    children: [
      { path: "/admin/login",    element: <AdminLogin /> },
      { path: "/admin/register", element: <Navigate to="/admin/login" replace /> },
      { path: "/referee/login",  element: <RefereeLogin /> },
      { path: "/referee/signup", element: <RefereeSignUp /> },
      { path: "/secretary/login", element: <SecretaryLogin /> },
      { path: "/secretary/register", element: <SecretaryRegister /> },
      { path: "/forgot-password", element: <ForgotPassword /> },
      { path: "/reset-password", element: <ResetPassword /> },
    ],
  },

  // Admin redirect - default to karate
  { path: "/admin", element: <Navigate to="/admin/karate/dashboard" replace /> },

  // Backward compatibility redirects for old URLs
  { path: "/admin/dashboard", element: <Navigate to="/admin/karate/dashboard" replace /> },
  { path: "/admin/schools", element: <Navigate to="/admin/karate/schools" replace /> },
  { path: "/admin/schools/:schoolId/batches", element: <RedirectToKarate path="/admin/karate/schools/:schoolId/batches" /> },
  { path: "/admin/referees", element: <Navigate to="/admin/karate/referees" replace /> },
  { path: "/admin/students", element: <Navigate to="/admin/karate/students" replace /> },
  { path: "/admin/results", element: <Navigate to="/admin/karate/results" replace /> },
  { path: "/admin/manage-belt-tests", element: <Navigate to="/admin/karate/manage-belt-tests" replace /> },
  { path: "/admin/create-belt-test", element: <Navigate to="/admin/karate/create-belt-test" replace /> },
  { path: "/admin/edit-belt-test/:testId", element: <RedirectToKarate path="/admin/karate/edit-belt-test/:testId" /> },
  { path: "/admin/fee-structure", element: <Navigate to="/admin/karate/fee-structure" replace /> },
  { path: "/admin/settings", element: <Navigate to="/admin/karate/settings" replace /> },
  { path: "/admin/whatsapp-results", element: <Navigate to="/admin/karate/whatsapp-results" replace /> },

  { path: "/admin/program-branches", element: <Navigate to="/admin/karate/program-branches" replace /> },
  { path: "/admin/score-student/:studentId", element: <RedirectToKarate path="/admin/karate/score-student/:studentId" /> },

  // Admin protected routes - program-specific
  {
    element: <AdminProtectedLayout />,
    children: [
      { path: "/admin/:program/dashboard",                        element: <AdminDashboard /> },
      { path: "/admin/:program/live-monitor",                     element: <BatchMonitoringDashboard /> },
      { path: "/admin/:program/schools",                          element: <SchoolManagement /> },
      { path: "/admin/:program/schools/:schoolId/batches",        element: <BatchManagement /> },
      { path: "/admin/:program/referees",                         element: <RefereeManagement /> },
      { path: "/admin/:program/secretaries",                      element: <SecretaryManagement /> },
      { path: "/admin/:program/secretaries/:secretaryId/schools/:schoolId", element: <AdminSchoolDetail /> },
      { path: "/admin/:program/students",                         element: <StudentManagement /> },
      { path: "/admin/:program/results",                          element: <ResultManagement /> },
      { path: "/admin/:program/manage-belt-tests",                element: <ManageBeltTests /> },
      { path: "/admin/:program/create-belt-test",                 element: <CreateBeltTest /> },
      { path: "/admin/:program/edit-belt-test/:testId",           element: <EditBeltTest /> },
      { path: "/admin/:program/fee-structure",                    element: <FeeStructure /> },
      { path: "/admin/:program/fee-requests",                    element: <SchoolFeeRequests /> },
      { path: "/admin/:program/settings",                         element: <Settings /> },
      { path: "/admin/:program/auth-settings",                    element: <AdminAuthSettings /> },
      { path: "/admin/:program/whatsapp-results",                  element: <WhatsAppResultsSender /> },
      { path: "/admin/:program/individual-students",              element: <StudentManagement /> },
      { path: "/admin/:program/individual-batches",               element: <BatchManagement /> },
      { path: "/admin/:program/program-branches",                 element: <ProgramBranchManagement /> },
      { path: "/admin/:program/score-student/:studentId",         element: <ScoreStudent /> },
      { path: "/admin/:program/view-result/:studentId",           element: <ViewResult /> },
      { path: "/admin/:program/seeder",                           element: <DataSeeder /> },
      { path: "/admin/:program/stickers",                         element: <StickerPrinting /> },
    ],
  },

  // Public result page (no auth required)
  {
    element: <PublicLayout />,
    children: [
      { path: "/result/:studentId", element: <ViewResult /> },
    ],
  },

  // Referee protected routes
  {
    element: <RefereeProtectedLayout />,
    children: [
      { path: "/referee/dashboard",              element: <RefereeDashboard /> },
      { path: "/referee/results",                element: <RefereeResults /> },
      { path: "/referee/batch/:batchId/scan",    element: <BatchScanner /> },
      { path: "/referee/batch/:batchId/score",   element: <BatchScoring /> },
    ],
  },

  // Secretary protected routes
  {
    element: <SecretaryProtectedLayout />,
    children: [
      { path: "/secretary/schools",         element: <SecretaryMySchools /> },
      { path: "/secretary/dashboard",      element: <SecretaryDashboard /> },
      { path: "/secretary/bulk-register",  element: <BulkRegistration /> },
                { path: "/secretary/fee-request",  element: <SecretaryFeeRequest /> },
      { path: "/secretary/students",       element: <SecretaryStudentManagement /> },
    ],
  },

  // 404
      { path: "*", element: <NotFound /> },
    ]
  }
]);

// ── App root ────────────────────────────────────────────────────────────────
export default function App() {

  return (
    <ToastProvider>
      <DialogProvider>
        <RouterProvider
          router={router}
        />
        <SpeedInsights />
      </DialogProvider>
    </ToastProvider>
  );
}
