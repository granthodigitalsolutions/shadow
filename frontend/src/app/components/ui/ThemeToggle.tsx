import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle() {
 const [mounted, setMounted] = useState(false);
 const { theme, setTheme } = useTheme();

 useEffect(() => {
 setMounted(true);
 }, []);

 if (!mounted) {
 return <div className="w-10 h-10" />;
 }

 const toggleTheme = () => {
 setTheme(theme === 'light' ? 'dark' : 'light');
 };

 return (
 <button
 onClick={toggleTheme}
 className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
 aria-label="Toggle theme"
 title={`Current theme: ${theme}`}
 >
 {theme === 'dark' ? (
 <Moon className="w-5 h-5" />
 ) : (
 <Sun className="w-5 h-5" />
 )}
 </button>
 );
}
