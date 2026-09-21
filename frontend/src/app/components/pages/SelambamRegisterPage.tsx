import { useState, useEffect } from 'react';
import {
 User, Home, Book, Phone, MessageCircle, ArrowRight, Check,
 AlertCircle, Users, Building2, UserCircle, Trophy, IndianRupee, XCircle,
} from 'lucide-react';
import {
 firebaseSilambanFeeService,
 firebaseSchoolService,
 firebaseAdminSettingsService,
 firebaseBeltTestService,
 firebaseStudentService,
 SilambanFeeStructure,
} from '../../services/firebaseData';
import { School } from '../../types/admin';

import logo from '../../../assets/shadow-kai-logo.png';
import { useToast } from '../../hooks/useToast';
import ProgressionModal from '../ui/ProgressionModal';
import { 
  silambamStage1, silambamStage2, silambamStage3, silambamStage4, silambamStage5, 
  silambamStage6, silambamStage7, silambamStage8, silambamStage9, silambamStage10 
} from '../../../assets/images';

const silambamImages = [
  silambamStage1, silambamStage2, silambamStage3, silambamStage4, silambamStage5,
  silambamStage6, silambamStage7, silambamStage8, silambamStage9, silambamStage10
];

// ── Stage colour palette (cycles for extra stages) ───────────────────────────
const STAGE_COLORS = [
 { color: '#FFD700', bgColor: 'rgba(255,215,0,.12)' },
 { color: '#FF8C00', bgColor: 'rgba(255,140,0,.12)' },
 { color: '#00C853', bgColor: 'rgba(0,200,83,.12)' },
 { color: '#2979FF', bgColor: 'rgba(41,121,255,.12)'},
 { color: '#AA00FF', bgColor: 'rgba(170,0,255,.12)' },
 { color: '#F44336', bgColor: 'rgba(244,67,54,.12)' },
 { color: '#009688', bgColor: 'rgba(0,150,136,.12)' },
 { color: '#E91E63', bgColor: 'rgba(233,30,99,.12)' },
];
function sc(order: number) { return STAGE_COLORS[(order - 1) % STAGE_COLORS.length]; }

// ── Types ─────────────────────────────────────────────────────────────────────
interface SelambamRegisterPageProps {
 onNavigate: (page: string) => void;
 onStudentUpdate: (student: any) => void;
}

type FormData = {
 name: string;
 gender: string;
 registrationType: 'school' | 'individual';
 schoolId: string;
 standard: string;
 contact: string;
 whatsapp: string;
};

type FormErrors = Partial<Record<keyof FormData, string>>;

// ── Helpers ───────────────────────────────────────────────────────────────────
function isValidPhone(val: string) {
 return /^\d{10}$/.test(val);
}

// ── Sub-components ────────────────────────────────────────────────────────────
function FormField({
 icon, label, tamilLabel, placeholder, value, onChange, onBlur, error,
}: {
 icon: React.ReactNode; label: string; tamilLabel: string; placeholder: string;
 value: string; onChange: (v: string) => void; onBlur: () => void; error?: string;
}) {
 return (
 <div>
 <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--ink)' }}>
 {label} <span style={{ color: 'var(--muted-color)', fontWeight: 400 }}>· {tamilLabel}</span>
 </label>
 <div className="relative">
 <div className="absolute top-1/2 left-3 -translate-y-1/2 pointer-events-none">{icon}</div>
 <input
 type="text" placeholder={placeholder} value={value}
 onChange={(e) => onChange(e.target.value)} onBlur={onBlur}
 className="w-full px-9 py-[11px] border-[1.5px] rounded-lg text-[11.25px] outline-none bg-transparent dark:bg-zinc-900 dark:text-zinc-50"
 style={{
 borderColor: error ? '#EF4444' : 'var(--border-color)',
 backgroundColor: error ? '#FEF2F2' : 'white',
 color: 'var(--ink)',
 }}
 />
 </div>
 {error && (
 <p className="text-xs mt-1 flex items-center gap-1" style={{ color: '#EF4444' }}>
 <AlertCircle size={12} /> {error}
 </p>
 )}
 </div>
 );
}

function SelectField({
 icon, label, tamilLabel, value, onChange, onBlur, error, options,
}: {
 icon: React.ReactNode; label: string; tamilLabel: string; value: string;
 onChange: (v: string) => void; onBlur: () => void; error?: string;
 options: { value: string; label: string }[];
}) {
 return (
 <div>
 <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--ink)' }}>
 {label} <span style={{ color: 'var(--muted-color)', fontWeight: 400 }}>· {tamilLabel}</span>
 </label>
 <div className="relative">
 <div className="absolute top-1/2 left-3 -translate-y-1/2 pointer-events-none">{icon}</div>
 <select
 value={value} onChange={(e) => onChange(e.target.value)} onBlur={onBlur}
 className="w-full px-9 py-[11px] border-[1.5px] rounded-lg text-[11.25px] outline-none appearance-none bg-transparent dark:bg-zinc-900 dark:text-zinc-50"
 style={{
 borderColor: error ? '#EF4444' : 'var(--border-color)',
 backgroundColor: error ? '#FEF2F2' : 'white',
 color: 'var(--ink)',
 }}
 >
 {options.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
 </select>
 </div>
 {error && (
 <p className="text-xs mt-1 flex items-center gap-1" style={{ color: '#EF4444' }}>
 <AlertCircle size={12} /> {error}
 </p>
 )}
 </div>
 );
}

function PhoneField({
 icon, label, tamilLabel, value, onChange, onBlur, error, required = true,
}: {
 icon: React.ReactNode; label: string; tamilLabel: string;
 value: string; onChange: (v: string) => void; onBlur: () => void; error?: string; required?: boolean;
}) {
 return (
 <div>
 <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--ink)' }}>
 {label} {!required && <span className="text-gray-400 font-normal normal-case">(Optional)</span>} <span style={{ color: 'var(--muted-color)', fontWeight: 400 }}>· {tamilLabel}</span>
 </label>
 <div className="relative flex">
 <div 
 className="flex items-center justify-center px-3 rounded-l-lg border-[1.5px] border-r-0 bg-gray-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900"
 style={{ borderColor: error ? '#EF4444' : 'var(--border-color)', color: 'var(--ink)', fontWeight: 700 }}
 >
 +91
 </div>
 <div className="relative w-full">
 <div className="absolute top-1/2 left-3 -translate-y-1/2 pointer-events-none">{icon}</div>
 <input
 type="text" maxLength={10} placeholder="00000 00000" value={value}
 onChange={(e) => {
 const val = e.target.value.replace(/\D/g, '').slice(0, 10);
 onChange(val);
 }} 
 onBlur={onBlur}
 className="w-full pl-9 pr-3 py-[11px] border-[1.5px] border-l-0 rounded-r-lg text-[11.25px] outline-none bg-transparent dark:bg-zinc-900 dark:text-zinc-50"
 style={{
 borderColor: error ? '#EF4444' : 'var(--border-color)',
 backgroundColor: error ? '#FEF2F2' : 'white',
 color: 'var(--ink)',
 letterSpacing: '1px'
 }}
 />
 </div>
 </div>
 {error && (
 <p className="text-xs mt-1 flex items-center gap-1" style={{ color: '#EF4444' }}>
 <AlertCircle size={12} /> {error}
 </p>
 )}
 </div>
 );
}

function StageCard({
 fee, isSelected, onSelect,
}: {
 fee: SilambanFeeStructure; isSelected: boolean; onSelect: () => void;
}) {
 const style = sc(fee.order);
 const stageImg = silambamImages[(fee.stageNumber - 1) % 10];
 return (
 <button
 type="button"
 onClick={onSelect}
 className={`relative p-3.5 pb-3 rounded-2xl border-[2.5px] transition-all duration-[.18s] cursor-pointer w-full max-w-[260px] sm:max-w-none mx-auto flex flex-col justify-between overflow-hidden ${
 isSelected
 ? 'translate-y-[-3px] shadow-[0_8px_28px_rgba(0,0,0,.15)]'
 : 'hover:border-[#ccc] hover:translate-y-[-2px] hover:shadow-[0_6px_20px_rgba(0,0,0,.08)]'
 }`}
 style={{
   backgroundColor: isSelected ? style.bgColor : 'white',
   borderColor: isSelected ? style.color : 'var(--border-color)',
   minHeight: '210px'
 }}
 >
 <div className="flex-1 flex flex-col items-center">
 {/* Icon */}
 <div
 className="w-10 h-10 rounded-full flex items-center justify-center mb-1.5"
 style={{ background: style.bgColor, border: `2px solid ${style.color}` }}
 >
 <Trophy size={20} color={style.color} strokeWidth={2.5} />
 </div>

 {/* Stage name */}
 <div className="text-center mb-1">
 <p
 className="font-bold leading-tight"
 style={{
 fontFamily: "'Bebas Neue', sans-serif",
 letterSpacing: '1px',
 fontSize: '18px',
 color: isSelected ? style.color : 'var(--ink)',
 }}
 >
 {fee.stageName}
 </p>
 <p className="text-[8px] text-gray-500">நிலை {fee.stageNumber}</p>
 </div>
 </div>
 
 {stageImg && (
   <div className="flex justify-center my-1 pointer-events-none flex-1 items-center w-full">
     <img src={stageImg} alt={fee.stageName} className="w-full h-[110px] object-contain drop-shadow-md scale-[1.25]" />
   </div>
 )}

 {/* Fee */}
 <div
 className="mt-1 flex items-center justify-center gap-1 w-full"
 style={{
 fontFamily: "'Bebas Neue', sans-serif",
 fontSize: '22px',
 letterSpacing: '.5px',
 color: isSelected ? style.color : 'var(--ink)',
 }}
 >
 ₹{fee.fee.toLocaleString()}
 </div>

 {/* Selected tick */}
 {isSelected && (
 <div
 className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
 style={{ background: '#00C853' }}
 >
 <Check size={11} color="white" strokeWidth={3} />
 </div>
 )}
 </button>
 );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function SelambamRegisterPage({ onNavigate, onStudentUpdate }: SelambamRegisterPageProps) {
 const { showToast } = useToast();
 const [showProgressionModal, setShowProgressionModal] = useState(false);

 const [selectedStage, setSelectedStage] = useState<number>(1);
 const [formData, setFormData] = useState<FormData>({
 name: '', gender: '', registrationType: 'school',
 schoolId: '', standard: '', contact: '', whatsapp: '',
 });
 const [errors, setErrors] = useState<FormErrors>({});
 const [touched, setTouched] = useState<Partial<Record<keyof FormData, boolean>>>({});

 const [stageFees, setStageFees] = useState<SilambanFeeStructure[]>([]);
 const [schools, setSchools] = useState<School[]>([]);
 const [schoolOptions, setSchoolOptions] = useState<{ label: string; value: string }[]>([]);
 const [loading, setLoading] = useState(true);
 const [loadingSchools, setLoadingSchools] = useState(true);
 const [individualModeEnabled, setIndividual] = useState(false);
 const [studentRegistrationEnabled, setStudentRegistrationEnabled] = useState(true);
 const [showIndividualWarning, setShowWarning] = useState(false);
 const [activeBeltTest, setActiveBeltTest] = useState<any>(null);
 const [isProcessing, setIsProcessing] = useState(false);

 // ── Fetch ──────────────────────────────────────────────────────────────────
 useEffect(() => {
 (async () => {
 try {
 const [fees, schoolsData, settings, test] = await Promise.all([
 firebaseSilambanFeeService.getActive(),
 firebaseSchoolService.getAll('SELAMBAM'), // Load schools only from School Management collection
 firebaseAdminSettingsService.get('SELAMBAM'),
 firebaseBeltTestService.getActive('SELAMBAM'),
 ]);
 setStageFees(fees);
 setSchools(schoolsData);
 setSchoolOptions(
 schoolsData.map(school => ({
 label: school.branch ? `${school.name} - ${school.branch}` : school.name,
 value: school.id
 }))
 );
 setIndividual(settings.individualModeEnabled);
 setStudentRegistrationEnabled(settings.studentRegistrationEnabled !== false);
 setActiveBeltTest(test);
 // Default to first active stage
 if (fees.length > 0) setSelectedStage(fees[0].stageNumber);
 } catch (err) {
 console.error('Selambam registration fetch error:', err);
 } finally {
 setLoading(false);
 setLoadingSchools(false);
 }
 })();
 }, []);

 // ── Derived ────────────────────────────────────────────────────────────────
 const selectedFee = stageFees.find(f => f.stageNumber === selectedStage);

 // ── Validation ────────────────────────────────────────────────────────────
 const validate = (data: FormData): FormErrors => {
 const e: FormErrors = {};
 if (!data.name.trim()) e.name = 'Student name is required · பெயர் தேவை';
 if (!data.gender) e.gender = 'Gender is required · பாலினம் தேவை';
 if (data.registrationType === 'school' && !data.schoolId)
 e.schoolId = 'School selection is required · பள்ளி தேர்வு தேவை';
 if (!data.standard.trim()) e.standard = 'Standard is required · வகுப்பு தேவை';
 if (data.contact.trim() && !isValidPhone(data.contact)) e.contact = 'Enter a valid 10-digit mobile number';
 if (!data.whatsapp.trim()) e.whatsapp = 'WhatsApp number is required · வாட்ஸ்அப் எண் தேவை';
 else if (!isValidPhone(data.whatsapp)) e.whatsapp = 'Enter a valid 10-digit mobile number';
 return e;
 };

 const handleChange = (field: keyof FormData, value: string) => {
 const newData = { ...formData, [field]: value };
 if (field === 'registrationType' && value === 'individual') newData.schoolId = '';
 setFormData(newData);
 if (touched[field]) {
 const newErr = validate(newData);
 setErrors(prev => ({ ...prev, [field]: newErr[field] }));
 }
 };

 const handleBlur = (field: keyof FormData) => {
 setTouched(prev => ({ ...prev, [field]: true }));
 const newErr = validate(formData);
 setErrors(prev => ({ ...prev, [field]: newErr[field] }));
 };

 const handleSubmit = async () => {
 const allTouched = Object.fromEntries(
 (Object.keys(formData) as (keyof FormData)[]).map(k => [k, true])
 ) as Record<keyof FormData, boolean>;
 setTouched(allTouched);
 const newErr = validate(formData);
 setErrors(newErr);
 if (Object.keys(newErr).length > 0) return;

 let schoolId = formData.schoolId;
 let schoolName = '';
 if (formData.registrationType === 'individual') {
 schoolId = 'individual'; schoolName = 'Individual';
 } else {
 const s = schools.find(s => s.id === formData.schoolId);
 schoolName = s ? `${s.name} - ${s.branch}` : '';
 }

 setIsProcessing(true);
 try {
 const studentData = {
 id: `STU-${Date.now()}`,
 name: formData.name,
 gender: formData.gender,
 registrationType: formData.registrationType,
 schoolId,
 school: schoolName,
 standard: formData.standard,
 contact: formData.contact ? `+91${formData.contact}` : '',
 whatsapp: `+91${formData.whatsapp}`,
 stageLevel: selectedStage,
 beltLevel: selectedFee?.stageName || '',
 beltIndex: 0,
 beltTestId: activeBeltTest?.id || "",
 batchId: null,
 refereeId: null,
 paymentStatus: "verified" as const,
 testStatus: "pending" as const,
 programType: 'SELAMBAM',
 program: 'selambam',
 qrUrl: "",
 paymentDetails: {
 amount: 0,
 method: "Bypassed",
 transactionId: "skipped",
 paymentDate: new Date().toISOString(),
 testDate: activeBeltTest?.date || new Date().toISOString(),
 testTime: activeBeltTest?.time || "10:00 AM",
 },
 registeredAt: new Date().toISOString(),
 };
 const cleanStudentData = JSON.parse(JSON.stringify(studentData));
 await firebaseStudentService.add(cleanStudentData);
 if (onStudentUpdate && activeBeltTest) {
 onStudentUpdate({ beltTestId: activeBeltTest.id });
 }

 alert("Registration successful! Our team will contact you with further details about the stage test.");

 // Reset the form so the page is ready for a new registration
 setFormData({
 name: '', gender: '', registrationType: 'school',
 schoolId: '', standard: '', contact: '', whatsapp: '',
 });
 setSelectedStage(stageFees.length > 0 ? stageFees[0].stageNumber : 1);
 setErrors({});
 setTouched({});
 } catch (error) {
 console.error("Error saving student data:", error);
 alert("There was an error saving your data. Please contact support.");
 } finally {
 setIsProcessing(false);
 }
 };

 // ── Loading ────────────────────────────────────────────────────────────────
 if (loading) {
 return (
 <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--off)' }}>
 <div className="text-center">
 <div className="w-16 h-16 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
 <p className="text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400">Loading…</p>
 </div>
 </div>
 );
 }

 const isClosed = activeBeltTest ? (() => {
 const now = new Date();
 const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
 
 if (activeBeltTest.registrationStartDate) {
 const start = new Date(activeBeltTest.registrationStartDate);
 start.setHours(0, 0, 0, 0);
 if (today < start) return true;
 }
 if (activeBeltTest.registrationEndDate) {
 const end = new Date(activeBeltTest.registrationEndDate);
 end.setHours(23, 59, 59, 999);
 if (now > end) return true;
 }
 return false;
 })() : false;

 if (!studentRegistrationEnabled) {
 return (
 <div style={{ minHeight: '100vh', background: 'var(--off)' }}>
 <div style={{ background: 'var(--ink)' }}>
 <div className="max-w-[1200px] mx-auto px-6 py-6">
 <div className="flex items-center gap-3">
 <img src={logo} alt="Shadow Kai Silambam" className="w-14 h-14 object-cover" />
 <div>
 <h1 className="text-sm font-bold text-white" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>SHADOW KAI SILAMBAM</h1>
 <p className="text-sm text-gray-300">Shadow Kai</p>
 </div>
 </div>
 </div>
 </div>
 <div className="max-w-[1200px] mx-auto px-6 py-12">
 <div className="bg-white rounded-2xl shadow-lg p-12 text-center max-w-2xl mx-auto">
 <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
 <AlertCircle className="w-12 h-12 text-blue-600" />
 </div>
 <h2 className="text-sm font-bold mb-4" style={{ fontFamily: "'Bebas Neue', sans-serif", color: 'var(--ink)' }}>REGISTRATION COMING SOON</h2>
 <p className="text-sm text-gray-600 mb-6">Registration is currently turned off. Please check back later.</p>
 </div>
 </div>
 </div>
 );
 }

 if (isClosed) {
 return (
 <div style={{ minHeight: '100vh', background: 'var(--off)',  }}>
 {/* Header */}
 <div style={{ background: 'var(--ink)' }}>
 <div className="max-w-[1200px] mx-auto px-6 py-6">
 <div className="flex items-center gap-3">
 <img
 src={logo}
 alt="Shadow Kai Silambam"
 className="w-14 h-14 object-cover"
 />
 <div>
 <h1 className="text-sm font-bold text-white" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
 SHADOW KAI SILAMBAM
 </h1>
 <p className="text-sm text-gray-300">Traditional Arts</p>
 </div>
 </div>
 </div>
 </div>

 {/* Registration Closed Message */}
 <div className="max-w-[1200px] mx-auto px-6 py-12">
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-2xl shadow-lg p-12 text-center max-w-2xl mx-auto">
 <div className="w-24 h-24 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
 <AlertCircle className="w-12 h-12 text-orange-600" />
 </div>

 <h2 className="text-sm font-bold mb-4" style={{ fontFamily: "'Bebas Neue', sans-serif", color: 'var(--ink)' }}>
 REGISTRATION CLOSED
 </h2>

 <p className="text-sm text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 mb-6">
 Registration for the upcoming stage test is currently closed. Please contact your master or school for more details.
 </p>
 </div>
 </div>
 </div>
 );
 }

 // No active test - show message
 if (!activeBeltTest) {
 return (
 <div style={{ minHeight: '100vh', background: 'var(--off)',  }}>
 {/* Header */}
 <div style={{ background: 'var(--ink)' }}>
 <div className="max-w-[1200px] mx-auto px-6 py-6">
 <div className="flex items-center gap-3">
 <img
 src={logo}
 alt="Shadow Kai Silambam"
 className="w-14 h-14 object-cover"
 />
 <div>
 <h1 className="text-sm font-bold text-white" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
 SHADOW KAI SILAMBAM
 </h1>
 <p className="text-sm text-gray-300">Traditional Arts</p>
 </div>
 </div>
 </div>
 </div>

 {/* No Belt Test Available Message */}
 <div className="max-w-[1200px] mx-auto px-6 py-12">
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-2xl shadow-lg p-12 text-center max-w-2xl mx-auto">
 <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
 <XCircle className="w-12 h-12 text-red-600" />
 </div>

 <h2 className="text-sm font-bold mb-4" style={{ fontFamily: "'Bebas Neue', sans-serif", color: 'var(--ink)' }}>
 NO ACTIVE TEST AVAILABLE
 </h2>

 <p className="text-sm text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 mb-6">
 Currently, there are no stage tests scheduled for registration.
 </p>
 </div>
 </div>
 </div>
 );
 }

 return (
 <div>
 {/* ── Hero ── */}
 <div style={{ background: 'var(--ink)', overflow: 'hidden', position: 'relative' }}>
 <div className="max-w-[1200px] mx-auto px-6 grid grid-cols-1 md:grid-cols-[1fr_auto] items-end gap-6 pt-9">
 <div className="pb-8">
 <div className="flex items-center gap-3 mb-4">
 <img
 src={logo} alt="Shadow Kai"
 className="w-14 h-14 object-cover flex-shrink-0"
 />
 <div
 className="inline-flex items-center gap-[7px] px-3 py-[5px] rounded-full"
 style={{
 background: 'rgba(0,200,83,.15)', border: '1px solid rgba(0,200,83,.4)',
 color: '#00C853', fontSize: '12px', fontWeight: 800,
 letterSpacing: '.08em', textTransform: 'uppercase',
 }}
 >
 <Trophy size={13} /> Selambam
 </div>
 </div>
 <h1
 style={{
 fontFamily: "'Bebas Neue', sans-serif",
 fontSize: 'clamp(27px,5.25vw,66px)',
 letterSpacing: '3px', lineHeight: '.95', color: '#fff',
 }}
 >
 SELAMBAM<br />
 <span style={{ color: '#00C853' }}>REGISTRATION</span>
 </h1>
 <p className="text-[11.25px] mt-3.5 leading-[1.6]" style={{ color: '#888' }}>
 செலம்பம் பதிவு — Fill in all details below and choose your stage level.
 </p>
 </div>

 {/* Stage strip decoration */}
 <div className="hidden md:flex flex-col gap-1.5 pb-8">
 {stageFees.slice(0, 6).map((f) => (
 <div
 key={f.id}
 className="w-[180px] h-[22px] rounded-md flex items-center justify-end pr-2.5"
 style={{
 background: sc(f.order).color, color: '#fff',
 fontFamily: "'Bebas Neue', sans-serif", fontSize: '13px', letterSpacing: '1px',
 }}
 >
 {f.stageName}
 </div>
 ))}
 </div>
 </div>
 </div>

 {/* ── Form ── */}
 <div className="max-w-[960px] mx-auto px-6 py-8 pb-[60px]">

 {/* Registration type */}
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 border-[1.5px] rounded-2xl p-6 mb-5" style={{ borderColor: 'var(--border-color)' }}>
 <div className="flex items-center gap-2.5 mb-4">
 <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#00C853' }} />
 <div>
 <h2 className="text-[16.5px] tracking-[1.5px]" style={{ fontFamily: "'Bebas Neue', sans-serif", color: 'var(--ink)' }}>
 Registration Type
 </h2>
 <p className="text-xs" style={{ color: 'var(--muted-color)' }}>பதிவு வகை — Choose how you are registering</p>
 </div>
 </div>
 <div className="grid grid-cols-2 gap-3">
 {[
 { type: 'school' as const, label: 'School Student', tamil: 'பள்ளி மாணவர்', Icon: Building2, activeColor: '#00C853', activeBg: 'bg-green-50 border-green-500' },
 { type: 'individual' as const, label: 'Individual', tamil: 'தனி மாணவர்', Icon: UserCircle, activeColor: '#3B82F6', activeBg: 'bg-blue-50 border-blue-500' },
 ].map(({ type, label, tamil, Icon, activeColor, activeBg }) => (
 <button
 key={type}
 type="button"
 onClick={() => type === 'individual' ? setShowWarning(true) : handleChange('registrationType', type)}
 disabled={type === 'individual' && !individualModeEnabled}
 className={`flex flex-col items-center gap-3 p-5 rounded-xl border-2 transition-all duration-150 ${
 formData.registrationType === type ? activeBg : 'border-gray-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 hover:border-gray-300 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700'
 } ${type === 'individual' && !individualModeEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
 >
 <div className={`w-12 h-12 rounded-full flex items-center justify-center ${formData.registrationType === type ? 'bg-opacity-20' : 'bg-gray-100 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800'}`}
 style={{ background: formData.registrationType === type ? activeColor + '22' : undefined }}>
 <Icon size={24} color={formData.registrationType === type ? activeColor : '#999'} />
 </div>
 <div className="text-center">
 <p className="font-bold text-sm" style={{ color: formData.registrationType === type ? activeColor : 'var(--ink)' }}>
 {label}
 </p>
 <p className="text-xs text-gray-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 mt-0.5">{tamil}</p>
 </div>
 {formData.registrationType === type && (
 <div className="w-5 h-5 rounded-full flex items-center justify-center"
 style={{ background: activeColor }}>
 <Check size={12} color="white" strokeWidth={3} />
 </div>
 )}
 </button>
 ))}
 </div>
 </div>

 {/* Personal details */}
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 border-[1.5px] rounded-2xl p-6 mb-5" style={{ borderColor: 'var(--border-color)' }}>
 <div className="flex items-center gap-2.5 mb-[18px]">
 <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#00C853' }} />
 <div>
 <h2 className="text-[16.5px] tracking-[1.5px]" style={{ fontFamily: "'Bebas Neue', sans-serif", color: 'var(--ink)' }}>
 Personal Details
 </h2>
 <p className="text-xs" style={{ color: 'var(--muted-color)' }}>தனிப்பட்ட விவரங்கள்</p>
 </div>
 </div>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
 <FormField icon={<User size={14} color="#00C853" strokeWidth={2.5} />}
 label="Student Name" tamilLabel="மாணவர் பெயர்" placeholder="Enter full name"
 value={formData.name} onChange={v => handleChange('name', v)}
 onBlur={() => handleBlur('name')} error={errors.name} />
 <SelectField icon={<Users size={14} color="#00C853" strokeWidth={2.5} />}
 label="Gender" tamilLabel="பாலினம்" value={formData.gender}
 onChange={v => handleChange('gender', v)} onBlur={() => handleBlur('gender')}
 error={errors.gender}
 options={[{ value: '', label: 'Select Gender' }, { value: 'Male', label: 'Male · ஆண்' }, { value: 'Female', label: 'Female · பெண்' }]} />
 {formData.registrationType === 'school' && (
 <SelectField icon={<Home size={14} color="#00C853" strokeWidth={2.5} />}
 label="School Name" tamilLabel="பள்ளி பெயர்" value={formData.schoolId}
 onChange={v => handleChange('schoolId', v)} onBlur={() => handleBlur('schoolId')}
 error={errors.schoolId}
 options={[
 { value: '', label: loadingSchools ? 'Loading schools…' : 'Select School' },
 ...schoolOptions,
 ]} />
 )}
 <SelectField icon={<Book size={14} color="#00C853" strokeWidth={2.5} />}
 label="Standard" tamilLabel="வகுப்பு" value={formData.standard}
 onChange={v => handleChange('standard', v)} onBlur={() => handleBlur('standard')}
 error={errors.standard}
 options={[
 { value: '', label: 'Select Standard' },
 { value: 'LKG', label: 'LKG' },
 { value: 'UKG', label: 'UKG' },
 { value: '1st Standard', label: '1st Standard' },
 { value: '2nd Standard', label: '2nd Standard' },
 { value: '3rd Standard', label: '3rd Standard' },
 { value: '4th Standard', label: '4th Standard' },
 { value: '5th Standard', label: '5th Standard' },
 { value: '6th Standard', label: '6th Standard' },
 { value: '7th Standard', label: '7th Standard' },
 { value: '8th Standard', label: '8th Standard' },
 { value: '9th Standard', label: '9th Standard' },
 { value: '10th Standard', label: '10th Standard' },
 { value: '11th Standard', label: '11th Standard' },
 { value: '12th Standard', label: '12th Standard' },
 { value: 'College / Adult', label: 'College / Adult' }
 ]} />
 <PhoneField icon={<Phone size={14} color="#00C853" strokeWidth={2.5} />}
 label="Student Number" tamilLabel="தொடர்பு எண்"
 value={formData.contact} onChange={v => handleChange('contact', v)}
 onBlur={() => handleBlur('contact')} error={errors.contact} required={false} />
 </div>
 <PhoneField icon={<MessageCircle size={14} color="#00C853" strokeWidth={2.5} />}
 label="Parent WhatsApp" tamilLabel="பெற்றோர் வாட்ஸ்அப் எண்"
 value={formData.whatsapp} onChange={v => handleChange('whatsapp', v)}
 onBlur={() => handleBlur('whatsapp')} error={errors.whatsapp} required={true} />
 </div>

 {/* Stage selection */}
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 border-[1.5px] rounded-2xl p-6 mb-5" style={{ borderColor: 'var(--border-color)' }}>
 <div className="flex items-start md:items-center justify-between flex-col md:flex-row gap-4 mb-[18px]">
 <div className="flex items-center gap-2.5">
 <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#00C853' }} />
 <div>
 <h2 className="text-[16.5px] tracking-[1.5px]" style={{ fontFamily: "'Bebas Neue', sans-serif", color: 'var(--ink)' }}>
 Choose Your Stage
 </h2>
 <p className="text-xs" style={{ color: 'var(--muted-color)' }}>உங்கள் நிலையை தேர்வு செய்யவும் - Select your Selambam stage level</p>
 </div>
 </div>
 <button
   type="button"
   onClick={() => setShowProgressionModal(true)}
   className="px-4 py-2 text-xs font-bold text-green-600 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors whitespace-nowrap"
 >
   View Stage Progression
 </button>
 </div>

 {stageFees.length === 0 ? (
 <p className="text-center text-gray-400 py-8 text-sm">Loading stage fees…</p>
 ) : (
 <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
 {stageFees.map((fee) => (
 <StageCard
 key={fee.id}
 fee={fee}
 isSelected={selectedStage === fee.stageNumber}
 onSelect={() => setSelectedStage(fee.stageNumber)}
 />
 ))}
 </div>
 )}

 {/* Selected fee summary */}
 {selectedFee && (
 <div
 className="mt-4 p-4 rounded-xl flex flex-wrap items-center justify-between gap-3"
 style={{ background: sc(selectedFee.order).bgColor, border: `1.5px solid ${sc(selectedFee.order).color}` }}
 >
 <div>
 <p className="text-xs font-semibold text-gray-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400">Selected Stage</p>
 <p className="font-bold" style={{ color: sc(selectedFee.order).color }}>
 {selectedFee.stageName} · நிலை {selectedFee.stageNumber}
 </p>
 </div>
 <div className="text-right">
 <p className="text-xs font-semibold text-gray-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400">Examination Fee</p>
 <p className="text-sm font-bold" style={{ color: sc(selectedFee.order).color }}>
 ₹{selectedFee.fee.toLocaleString()}
 </p>
 </div>
 </div>
 )}
 </div>

 {/* Submit */}
 <button
 onClick={handleSubmit}
 disabled={isProcessing}
 className="w-full px-6 py-[18px] border-none rounded-2xl text-white cursor-pointer flex items-center justify-center gap-3 transition-all duration-200 hover:translate-y-[-2px] hover:shadow-[0_12px_32px_rgba(0,0,0,.2)] active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed"
 style={{ background: '#00C853', fontFamily: "'Bebas Neue', sans-serif", fontSize: '22px', letterSpacing: '2.5px' }}
 >
 <ArrowRight size={22} />
 {isProcessing ? 'PROCESSING...' : 'REGISTER NOW'}
 </button>

 <div className="flex items-center justify-center mt-6">
 <a href="/" className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:bg-zinc-800 dark:bg-zinc-800" style={{ color: '#00C853' }}>
 ← Back to Home
 </a>
 </div>
 </div>

 {/* Individual warning modal */}
 {showIndividualWarning && (
 <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-2xl shadow-2xl w-full max-w-md p-6">
 <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
 <AlertCircle className="w-8 h-8 text-amber-600" />
 </div>
 <h3 className="text-sm font-bold text-center mb-3" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
 INDIVIDUAL REGISTRATION
 </h3>
 <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4 text-xs text-amber-800">
 You are registering as an <strong>Individual Student</strong> without school affiliation.
 You will be added to an individual students batch and may be reassigned during testing.
 </div>
 <div className="flex gap-3">
 <button
 onClick={() => setShowWarning(false)}
 className="flex-1 px-4 py-3 border-2 border-gray-300 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700 rounded-xl text-gray-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 font-semibold hover:bg-gray-50 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:bg-zinc-900"
 >
 Cancel
 </button>
 <button
 onClick={() => { handleChange('registrationType', 'individual'); setShowWarning(false); }}
 className="flex-1 px-4 py-3 rounded-xl text-white font-semibold"
 style={{ background: '#00C853' }}
 >
 Continue
 </button>
 </div>
 </div>
 </div>
 )}

 <ProgressionModal 
   isOpen={showProgressionModal} 
   onClose={() => setShowProgressionModal(false)} 
   defaultTab="silambam"
 />
 </div>
 );
}
