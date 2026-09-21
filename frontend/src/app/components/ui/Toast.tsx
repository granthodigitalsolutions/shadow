import { useEffect } from 'react';
import { CheckCircle, AlertCircle, X, Info } from 'lucide-react';

interface ToastProps {
 message: string;
 type: 'success' | 'error' | 'info' | 'warning';
 onClose: () => void;
 duration?: number;
}

export default function Toast({ message, type, onClose, duration = 3500 }: ToastProps) {
 useEffect(() => {
 if (duration > 0) {
 const timer = setTimeout(onClose, duration);
 return () => clearTimeout(timer);
 }
 }, [duration, onClose]);

 const styles = {
 success: { accent: 'bg-green-500', icon: 'text-green-500', Icon: CheckCircle },
 error: { accent: 'bg-red-500', icon: 'text-red-500', Icon: AlertCircle },
 info: { accent: 'bg-blue-500', icon: 'text-blue-500', Icon: Info },
 warning: { accent: 'bg-amber-500', icon: 'text-amber-500', Icon: AlertCircle },
 };

 const { accent, icon, Icon } = styles[type];

 return (
 <div className="pointer-events-auto animate-slide-in-right w-full">
 <div className="relative flex items-start gap-2.5 overflow-hidden rounded-xl bg-white dark:bg-zinc-900 shadow-lg border border-zinc-200 dark:border-zinc-800 pl-3.5 pr-8 py-2.5">
 <span className={`absolute left-0 top-0 h-full w-1 ${accent}`} />
 <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${icon}`} />
 <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-100 leading-snug line-clamp-3">{message}</p>
 <button
 onClick={onClose}
 className="absolute top-2 right-2 p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-md transition-colors"
 aria-label="Dismiss notification"
 >
 <X className="w-3.5 h-3.5" />
 </button>
 </div>
 </div>
 );
}
