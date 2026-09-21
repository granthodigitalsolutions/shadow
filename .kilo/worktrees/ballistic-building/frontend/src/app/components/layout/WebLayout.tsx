import { Suspense, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';

// Shared loading fallback for lazy-loaded pages
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen" style={{ background: 'var(--ink)' }}>
    <div className="text-center">
      <div className="w-16 h-16 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-4" style={{ borderColor: 'rgba(255,140,0,0.3)', borderTopColor: 'var(--orange)' }} />
      <p style={{ color: 'rgba(255,255,255,0.8)', fontFamily: "'Bebas Neue',sans-serif", fontSize: '20px', letterSpacing: '2px' }}>LOADING...</p>
    </div>
  </div>
);

export default function WebLayout() {
  const location = useLocation();

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [location.pathname]);

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <Navbar />
      
      <main className="flex-1">
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>

      <Footer />
    </div>
  );
}
