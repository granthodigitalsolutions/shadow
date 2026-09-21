import { useNavigate } from "react-router-dom";
import { Home, ArrowLeft, AlertCircle } from "lucide-react";
import logo from "../../../assets/shadow-kai-logo.png";

export default function NotFound() {
 const navigate = useNavigate();

 return (
 <div style={{ minHeight: '100vh', background: 'var(--off)' }}>
 {/* Header */}
 <div style={{ background: 'var(--ink)', padding: '0 28px' }}>
 <div className="max-w-[960px] mx-auto py-6">
 <div className="flex items-center gap-3">
 <img
 src={logo}
 alt="Shadow Kai Karate"
 className="w-14 h-14 object-cover"
 />
 <div>
 <h1 className="text-sm font-bold text-white" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
 SHADOW KAI KARATE
 </h1>
 <p className="text-sm text-gray-300">Shadow Kai</p>
 </div>
 </div>
 </div>
 </div>

 {/* 404 Content */}
 <div className="max-w-[640px] mx-auto px-7 py-16">
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-2xl shadow-lg p-12 text-center">
 <div className="w-32 h-32 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-8">
 <AlertCircle className="w-16 h-16 text-red-600" />
 </div>

 <div className="mb-8">
 <h1
 className="text-sm font-bold mb-4"
 style={{ fontFamily: "'Bebas Neue', sans-serif", color: 'var(--ink)' }}
 >
 404
 </h1>
 <h2
 className="text-sm font-bold mb-4"
 style={{ fontFamily: "'Bebas Neue', sans-serif", color: 'var(--ink)' }}
 >
 PAGE NOT FOUND
 </h2>
 <p className="text-sm text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 mb-2">
 The page you are looking for doesn't exist or has been moved.
 </p>
 <p className="text-sm text-gray-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400">
 பக்கம் கிடைக்கவில்லை
 </p>
 </div>

 <div className="flex flex-col sm:flex-row gap-4 justify-center">
 <button
 onClick={() => navigate(-1)}
 className="flex items-center justify-center gap-2 px-6 py-3 border-2 border-gray-300 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:bg-zinc-900 font-semibold transition-colors"
 >
 <ArrowLeft className="w-5 h-5" />
 Go Back
 </button>
 <button
 onClick={() => navigate('/')}
 className="flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-white font-semibold transition-colors"
 style={{ background: 'var(--orange)' }}
 >
 <Home className="w-5 h-5" />
 Home Page
 </button>
 </div>

 <div className="mt-8 pt-8 border-t border-gray-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800">
 <p className="text-sm text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 mb-3">
 <strong>Quick Links:</strong>
 </p>
 <div className="flex flex-wrap gap-3 justify-center text-sm">
 <button
 onClick={() => navigate('/register')}
 className="px-4 py-2 bg-gray-100 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 rounded-lg hover:bg-gray-200 transition-colors"
 >
 Student Registration
 </button>
 <button
 onClick={() => navigate('/admin/login')}
 className="px-4 py-2 bg-gray-100 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 rounded-lg hover:bg-gray-200 transition-colors"
 >
 Admin Login
 </button>
 </div>
 </div>
 </div>
 </div>
 </div>
 );
}
