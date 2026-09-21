import { Layers, UserPlus, Ticket, CheckSquare, LayoutGrid } from 'lucide-react';
import { PageType } from '../types';

interface TopbarProps {
 currentPage: PageType;
 onNavigate: (page: PageType) => void;
}

export default function Topbar({ currentPage, onNavigate }: TopbarProps) {
 const navItems: { page: PageType; icon: React.ReactNode; label: string }[] = [
 { page: 'register', icon: <UserPlus size={15} />, label: 'Register' },
 { page: 'hallticket', icon: <Ticket size={15} />, label: 'Hall Ticket' },
 { page: 'referee', icon: <CheckSquare size={15} />, label: 'Scoring' },
 { page: 'admin', icon: <LayoutGrid size={15} />, label: 'Admin' },
 ];

 const getActiveClass = (page: PageType) => {
 const baseColors = {
 register: 'bg-[--orange] text-[--ink]',
 hallticket: 'bg-[--green] text-[--ink]',
 referee: 'bg-[--red] text-[--ink]',
 admin: 'bg-[--purple] text-white',
 };
 return currentPage === page ? baseColors[page] : '';
 };

 return (
 <nav
 className="flex flex-wrap items-center justify-between gap-3 px-4 md:px-7 h-16 sticky top-0 z-[200]"
 style={{ background: 'var(--ink)' }}
 >
 <div className="flex items-center gap-2.5 no-underline cursor-pointer">
 <div
 className="w-[38px] h-[38px] rounded-[10px] flex items-center justify-center flex-shrink-0"
 style={{ background: 'var(--red)' }}
 >
 <Layers size={20} color="white" strokeWidth={2.5} />
 </div>
 <span
 className="text-[26px] tracking-[2px]"
 style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#fff' }}
 >
 Karate<span style={{ color: 'var(--yellow)' }}>Pass</span>
 </span>
 </div>

 <div
 className="flex gap-1 p-[5px] rounded-[14px] overflow-x-auto max-w-[calc(100vw-200px)]"
 style={{ background: '#1A1A1A', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
 >
 {navItems.map(({ page, icon, label }) => (
 <button
 key={page}
 onClick={() => onNavigate(page)}
 className={`flex items-center gap-[7px] px-[15px] py-[7px] rounded-[10px] border-none transition-all duration-200 whitespace-nowrap
 ${currentPage === page ? getActiveClass(page) : 'bg-transparent text-[#888] hover:text-white'}`}
 style={{ fontFamily: "'Nunito', sans-serif", fontSize: '13px', fontWeight: 700 }}
 >
 {icon}
 <span className="hidden sm:inline">{label}</span>
 </button>
 ))}
 </div>
 </nav>
 );
}
