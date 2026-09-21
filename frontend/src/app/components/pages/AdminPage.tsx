import { Users, CreditCard, Home, Calendar, Clock, MapPin, MessageCircle, FileText, Plus } from 'lucide-react';
import { belts } from '../../data';

export default function AdminPage() {
 const students = [
 { name: 'Aravind Kumar S', school: 'GHS Coimbatore', belt: 'White → Yellow', status: 'pass' },
 { name: 'Priya Lakshmi R', school: "St. Joseph's", belt: 'Yellow → Orange', status: 'pending' },
 { name: 'Karthik Vel M', school: 'GHS Coimbatore', belt: 'Orange → Green', status: 'pass' },
 { name: 'Divya Bharathi K', school: 'Govt. Hr. Sec.', belt: 'Green → Blue', status: 'fail' },
 { name: 'Manoj Arasan T', school: "St. Joseph's", belt: 'White → Yellow', status: 'pass' },
 ];

 const notifications = [
 {
 name: 'Aravind Kumar',
 msg: 'Hall ticket ready. Test on 15 Jul at 9:00 AM. Venue: District Sports Complex.',
 time: '2 min ago',
 },
 {
 name: 'Priya Lakshmi',
 msg: 'Payment confirmed ₹1,200. Registration complete for White → Yellow belt test.',
 time: '8 min ago',
 },
 {
 name: 'GHS Coimbatore',
 msg: '38 students registered. WhatsApp invites sent to all parents.',
 time: '1 hr ago',
 },
 ];

 return (
 <div>
 {/* Hero Section */}
 <div style={{ background: 'var(--purple)', padding: '36px 28px 32px' }}>
 <div className="max-w-[960px] mx-auto">
 <h1
 style={{
 fontFamily: "'Bebas Neue', sans-serif",
 fontSize: 'clamp(24px,4.5vw,54px)',
 letterSpacing: '3px',
 color: '#fff',
 lineHeight: 1,
 }}
 >
 ADMIN
 <br />
 <span style={{ color: 'rgba(255,255,255,.3)' }}>DASHBOARD</span>
 </h1>
 <p className="text-[10.5px] font-bold mt-2.5" style={{ color: 'rgba(255,255,255,.7)' }}>
 நிர்வாக பலகை — Manage tests, students, fees and notifications
 </p>
 </div>
 </div>

 {/* Dashboard Content */}
 <div className="max-w-[960px] mx-auto px-7 py-8 pb-[60px]">
 {/* Stats Row */}
 <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
 <StatCard
 number="142"
 label="Registered"
 icon={<Users size={32} />}
 bgColor="#FFF5F5"
 borderColor="#FFD0CC"
 numColor="var(--red)"
 lblColor="#CC2200"
 />
 <StatCard
 number="₹1.7L"
 label="Collected"
 icon={<CreditCard size={32} />}
 bgColor="#FFF8F0"
 borderColor="#FFD4A3"
 numColor="var(--orange)"
 lblColor="#AA5500"
 />
 <StatCard
 number="8"
 label="Schools"
 icon={<Home size={32} />}
 bgColor="#F0F5FF"
 borderColor="#BBCCFF"
 numColor="var(--blue)"
 lblColor="#1040BB"
 />
 <StatCard
 number="15 Jul"
 label="Next Test"
 icon={<Calendar size={32} />}
 bgColor="#F0FFF5"
 borderColor="#B3F0C8"
 numColor="var(--green)"
 lblColor="#007730"
 />
 </div>

 {/* Two Column Layout */}
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
 {/* Create Belt Test */}
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 border-[1.5px] rounded-2xl p-6" style={{ borderColor: 'var(--border-color)' }}>
 <div className="flex items-center gap-2.5 mb-[18px]">
 <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--purple)' }} />
 <div>
 <h2
 className="text-[16.5px] tracking-[1.5px]"
 style={{ fontFamily: "'Bebas Neue', sans-serif", color: 'var(--ink)' }}
 >
 Create Belt Test
 </h2>
 <p className="text-xs" style={{ color: 'var(--muted-color)' }}>
 புதிய தேர்வு உருவாக்கு
 </p>
 </div>
 </div>

 <FormField icon={<Calendar size={14} color="var(--purple)" />} label="Date" type="date" defaultValue="2025-07-15" />
 <FormField icon={<Clock size={14} color="var(--purple)" />} label="Time" type="time" defaultValue="09:00" />
 <FormField icon={<MapPin size={14} color="var(--purple)" />} label="Location" placeholder="Venue name" />
 </div>

 {/* Fee Management */}
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 border-[1.5px] rounded-2xl p-6" style={{ borderColor: 'var(--border-color)' }}>
 <div className="flex items-center gap-2.5 mb-[18px]">
 <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--orange)' }} />
 <div>
 <h2
 className="text-[16.5px] tracking-[1.5px]"
 style={{ fontFamily: "'Bebas Neue', sans-serif", color: 'var(--ink)' }}
 >
 Fee Management
 </h2>
 <p className="text-xs" style={{ color: 'var(--muted-color)' }}>
 கட்டண நிர்வாகம்
 </p>
 </div>
 </div>

 <div className="overflow-x-auto">
 <table className="w-full">
 <thead>
 <tr className="border-b-[2.5px]" style={{ borderColor: 'var(--off)' }}>
 <th className="text-left p-2 text-[8.25px] font-extrabold tracking-[.07em] uppercase" style={{ color: 'var(--muted-color)' }}>
 From
 </th>
 <th className="text-left p-2 text-[8.25px] font-extrabold tracking-[.07em] uppercase" style={{ color: 'var(--muted-color)' }}>
 To
 </th>
 <th className="text-left p-2 text-[8.25px] font-extrabold tracking-[.07em] uppercase" style={{ color: 'var(--muted-color)' }}>
 Fee
 </th>
 </tr>
 </thead>
 <tbody>
 {belts.slice(0, 4).map((belt, i) => (
 <tr key={i} className="hover:bg-[#FAFAFA]">
 <td className="p-2 text-[9.75px] border-b-[1.5px] font-semibold align-middle" style={{ borderColor: 'var(--off)' }}>
 <span className="flex items-center gap-1.5 font-bold">
 <span
 className="w-[11px] h-[11px] rounded-full inline-block flex-shrink-0"
 style={{
 background: belt.fc,
 border: belt.fb ? `1.5px solid ${belt.fb}` : 'none',
 }}
 />
 {belt.from}
 </span>
 </td>
 <td className="p-2 text-[9.75px] border-b-[1.5px] font-semibold align-middle" style={{ borderColor: 'var(--off)' }}>
 <span className="flex items-center gap-1.5">
 <span
 className="w-[11px] h-[11px] rounded-full inline-block flex-shrink-0"
 style={{ background: belt.tc }}
 />
 {belt.to}
 </span>
 </td>
 <td
 className="p-2 text-[12.75px] border-b-[1.5px] align-middle"
 style={{
 borderColor: 'var(--off)',
 fontFamily: "'Bebas Neue', sans-serif",
 color: 'var(--orange)',
 }}
 >
 ₹{belt.fee.toLocaleString()}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 </div>

 {/* Student Management */}
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 border-[1.5px] rounded-2xl p-6 mb-5" style={{ borderColor: 'var(--border-color)' }}>
 <div className="flex items-center gap-2.5 mb-[18px]">
 <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--blue)' }} />
 <div>
 <h2
 className="text-[16.5px] tracking-[1.5px]"
 style={{ fontFamily: "'Bebas Neue', sans-serif", color: 'var(--ink)' }}
 >
 Student Management
 </h2>
 <p className="text-xs" style={{ color: 'var(--muted-color)' }}>
 மாணவர் நிர்வாகம்
 </p>
 </div>
 </div>

 <div className="overflow-x-auto mb-4">
 <table className="w-full">
 <thead>
 <tr className="border-b-[2.5px]" style={{ borderColor: 'var(--off)' }}>
 <th className="text-left p-2 text-[8.25px] font-extrabold tracking-[.07em] uppercase" style={{ color: 'var(--muted-color)' }}>
 Name
 </th>
 <th className="text-left p-2 text-[8.25px] font-extrabold tracking-[.07em] uppercase" style={{ color: 'var(--muted-color)' }}>
 School
 </th>
 <th className="text-left p-2 text-[8.25px] font-extrabold tracking-[.07em] uppercase" style={{ color: 'var(--muted-color)' }}>
 Belt Test
 </th>
 <th className="text-left p-2 text-[8.25px] font-extrabold tracking-[.07em] uppercase" style={{ color: 'var(--muted-color)' }}>
 Status
 </th>
 </tr>
 </thead>
 <tbody>
 {students.map((s, i) => (
 <tr key={i} className="hover:bg-[#FAFAFA]">
 <td className="p-2 text-[9.75px] border-b-[1.5px] font-extrabold" style={{ borderColor: 'var(--off)' }}>
 {s.name}
 </td>
 <td className="p-2 text-[9.75px] border-b-[1.5px] font-semibold" style={{ borderColor: 'var(--off)', color: 'var(--muted-color)' }}>
 {s.school}
 </td>
 <td className="p-2 text-[9.75px] border-b-[1.5px] font-semibold" style={{ borderColor: 'var(--off)' }}>
 {s.belt}
 </td>
 <td className="p-2 text-[9.75px] border-b-[1.5px]" style={{ borderColor: 'var(--off)' }}>
 <StatusBadge status={s.status} />
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>

 <div className="flex flex-wrap gap-2 pt-4 border-t-2" style={{ borderColor: 'var(--off)' }}>
 <ActionButton icon={<MessageCircle size={14} />} label="Send WhatsApp Invite" variant="green" />
 <ActionButton icon={<FileText size={14} />} label="Export to Excel" variant="orange" />
 <ActionButton icon={<Plus size={14} />} label="Generate Certificates" />
 </div>
 </div>

 {/* Notifications */}
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 border-[1.5px] rounded-2xl p-6" style={{ borderColor: 'var(--border-color)' }}>
 <div className="flex items-center gap-2.5 mb-[18px]">
 <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--green)' }} />
 <div>
 <h2
 className="text-[16.5px] tracking-[1.5px]"
 style={{ fontFamily: "'Bebas Neue', sans-serif", color: 'var(--ink)' }}
 >
 WhatsApp Notifications
 </h2>
 <p className="text-xs" style={{ color: 'var(--muted-color)' }}>
 வாட்ஸ்அப் அறிவிப்புகள்
 </p>
 </div>
 </div>

 {notifications.map((notif, i) => (
 <div
 key={i}
 className={`flex gap-3 py-3.5 ${i < notifications.length - 1 ? 'border-b-[1.5px]' : ''}`}
 style={{ borderColor: 'var(--off)' }}
 >
 <div
 className="w-[38px] h-[38px] rounded-[10px] flex items-center justify-center flex-shrink-0"
 style={{ background: '#E8F8EE' }}
 >
 <MessageCircle size={18} color="var(--green)" />
 </div>
 <div className="flex-1">
 <div className="flex flex-wrap justify-between items-center gap-3 gap-2.5">
 <div className="text-[9.75px] font-extrabold" style={{ color: 'var(--ink)' }}>
 {notif.name}
 </div>
 <div className="text-[8.25px] font-bold" style={{ color: '#bbb' }}>
 {notif.time}
 </div>
 </div>
 <div className="text-xs mt-0.5 leading-[1.5] font-semibold" style={{ color: 'var(--muted-color)' }}>
 {notif.msg}
 </div>
 </div>
 </div>
 ))}
 </div>
 </div>
 </div>
 );
}

function StatCard({
 number,
 label,
 icon,
 bgColor,
 borderColor,
 numColor,
 lblColor,
}: {
 number: string;
 label: string;
 icon: React.ReactNode;
 bgColor: string;
 borderColor: string;
 numColor: string;
 lblColor: string;
}) {
 return (
 <div className="rounded-2xl p-4 border-2 relative overflow-hidden" style={{ background: bgColor, borderColor }}>
 <div className="absolute right-3.5 top-3.5 opacity-25">{icon}</div>
 <div
 style={{
 fontFamily: "'Bebas Neue', sans-serif",
 fontSize: '40px',
 letterSpacing: '1px',
 lineHeight: 1,
 color: numColor,
 }}
 >
 {number}
 </div>
 <div className="text-xs font-extrabold mt-1" style={{ color: lblColor }}>
 {label}
 </div>
 </div>
 );
}

function FormField({
 icon,
 label,
 type = 'text',
 placeholder,
 defaultValue,
}: {
 icon: React.ReactNode;
 label: string;
 type?: string;
 placeholder?: string;
 defaultValue?: string;
}) {
 return (
 <div className="mb-3">
 <label
 className="flex items-center gap-[7px] text-xs font-extrabold tracking-[.04em] uppercase mb-1.5"
 style={{ color: 'var(--muted-color)', fontFamily: "'Nunito', sans-serif" }}
 >
 {icon}
 {label}
 </label>
 <input
 type={type}
 placeholder={placeholder}
 defaultValue={defaultValue}
 className="w-full px-3.5 py-3 rounded-[10px] border-2 outline-none transition-all duration-[.18s] bg-transparent dark:bg-zinc-900 dark:text-zinc-50"
 style={{
 background: 'var(--off)',
 borderColor: 'var(--border-color)',
 fontFamily: "'Nunito', sans-serif",
 fontSize: '15px',
 fontWeight: 600,
 color: 'var(--ink)',
 }}
 />
 </div>
 );
}

function StatusBadge({ status }: { status: string }) {
 const styles = {
 pass: { bg: '#E8F8EE', color: '#007730', text: 'Pass' },
 fail: { bg: '#FEECEB', color: '#CC2200', text: 'Fail' },
 pending: { bg: '#FFF8E0', color: '#996600', text: 'Pending' },
 };

 const style = styles[status as keyof typeof styles] || styles.pending;

 return (
 <span
 className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[8.25px] font-extrabold"
 style={{ background: style.bg, color: style.color }}
 >
 {style.text}
 </span>
 );
}

function ActionButton({ icon, label, variant }: { icon: React.ReactNode; label: string; variant?: 'green' | 'orange' }) {
 const styles = {
 green: { bg: '#E8F8EE', border: '#B3ECC8', color: '#007730', hoverBg: '#D4F4E0' },
 orange: { bg: '#FFF8E0', border: '#FFD4A3', color: '#AA5500', hoverBg: '#FFEECC' },
 default: { bg: 'var(--off)', border: 'var(--border-color)', color: 'var(--ink)', hoverBg: '#eee' },
 };

 const style = variant ? styles[variant] : styles.default;

 return (
 <button
 className="flex items-center gap-[7px] px-4 py-2.5 rounded-[10px] border-2 font-extrabold text-[9.75px] cursor-pointer transition-all duration-[.15s]"
 style={{
 background: style.bg,
 borderColor: style.border,
 color: style.color,
 fontFamily: "'Nunito', sans-serif",
 }}
 onMouseEnter={(e) => (e.currentTarget.style.background = style.hoverBg)}
 onMouseLeave={(e) => (e.currentTarget.style.background = style.bg)}
 >
 {icon}
 {label}
 </button>
 );
}
