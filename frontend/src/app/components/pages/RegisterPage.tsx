import { useState, useEffect } from 'react';
import {
 Layers,
 User,
 Home,
 Book,
 Phone,
 MessageCircle,
 ArrowRight,
 Check,
 AlertCircle,
 Calendar,
 XCircle,
 Users,
 Building2,
 UserCircle,
} from 'lucide-react';
import { belts } from '../../data';
import { Student } from '../../types';
import { firebaseBeltTestService, firebaseFeeStructureService, firebaseSchoolService, firebaseStudentService, FeeStructure, firebaseAdminSettingsService } from '../../services/firebaseData';
import { School } from '../../types/admin';

import logo from '../../../assets/shadow-kai-logo.png';
import { useToast } from '../../hooks/useToast';
import { useDialog } from "../../contexts/DialogContext";
import ProgressionModal from '../ui/ProgressionModal';
import { karateBeltYellow, karateBeltOrange, karateBeltBlue, karateBeltGreen, karateBeltBrown, karateBeltBlack } from '../../../assets/images';

const beltImages: Record<string, string> = {
  'Yellow': karateBeltYellow,
  'Orange': karateBeltOrange,
  'Blue': karateBeltBlue,
  'Green': karateBeltGreen,
  'Purple': karateBeltBlue, // Fallback since it's not in the image
  'Brown III': karateBeltBrown,
  'Brown II': karateBeltBrown,
  'Brown I': karateBeltBrown,
  'II Brown': karateBeltBrown,
  'I Brown': karateBeltBrown,
  'Black (Shodan)': karateBeltBlack,
  'Black Belt': karateBeltBlack,
};

interface RegisterPageProps {
 onNavigate: (page: string) => void;
 onStudentUpdate: (student: Partial<Student>) => void;
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

function isValidPhone(val: string) {
 return /^\d{10}$/.test(val);
}

export default function RegisterPage({ onNavigate, onStudentUpdate }: RegisterPageProps) {
 const [selectedBelt, setSelectedBelt] = useState(0);
 const [showProgressionModal, setShowProgressionModal] = useState(false);
 const [formData, setFormData] = useState<FormData>({
 name: '',
 gender: '',
 registrationType: 'school',
 schoolId: '',
 standard: '',
 contact: '',
 whatsapp: '',
 });
 const [errors, setErrors] = useState<FormErrors>({});
 const [touched, setTouched] = useState<Partial<Record<keyof FormData, boolean>>>({});
 const [activeBeltTest, setActiveBeltTest] = useState<any>(null);
 const [feeStructure, setFeeStructure] = useState<FeeStructure[]>([]);
 const [schools, setSchools] = useState<School[]>([]);
 const [schoolOptions, setSchoolOptions] = useState<{ label: string; value: string }[]>([]);
 const [loading, setLoading] = useState(true);
 const [loadingSchools, setLoadingSchools] = useState(true);
 const [individualModeEnabled, setIndividualModeEnabled] = useState(false);
 const [studentRegistrationEnabled, setStudentRegistrationEnabled] = useState(true);
 const [showIndividualWarning, setShowIndividualWarning] = useState(false);
 const [isProcessing, setIsProcessing] = useState(false);
 const { showToast } = useToast();
 const { showAlert } = useDialog();

 useEffect(() => {
 const fetchData = async () => {
 try {
 const [test, fees, schoolsData, settings] = await Promise.all([
 firebaseBeltTestService.getActive('KARATE'), // CRITICAL: Filter for Karate only
 firebaseFeeStructureService.getActive(),
 firebaseSchoolService.getAll('KARATE'), // Load schools only from School Management collection
 firebaseAdminSettingsService.get('KARATE'),
 ]);
 setActiveBeltTest(test);
 setFeeStructure(fees);
 setSchools(schoolsData);
 setSchoolOptions(
 schoolsData.map((school) => ({
 label: school.branch ? `${school.name} - ${school.branch}` : school.name,
 value: school.id,
 }))
 );
 setIndividualModeEnabled(settings.individualModeEnabled);
 setStudentRegistrationEnabled(settings.studentRegistrationEnabled !== false);
 } catch (error) {
 console.error('Error fetching data:', error);
 } finally {
 setLoading(false);
 setLoadingSchools(false);
 }
 };

 fetchData();
 }, []);

 const validate = (data: FormData): FormErrors => {
 const e: FormErrors = {};
 if (!data.name.trim()) e.name = 'Student name is required · பெயர் தேவை';
 if (!data.gender) e.gender = 'Gender is required · பாலினம் தேவை';
 if (data.registrationType === 'school' && !data.schoolId)
 e.schoolId = 'School selection is required · பள்ளி தேர்வு தேவை';
 if (!data.standard.trim()) e.standard = 'Standard is required · வகுப்பு தேவை';
 if (data.contact.trim() && !isValidPhone(data.contact)) {
 e.contact = 'Enter a valid 10-digit mobile number';
 }
 if (!data.whatsapp.trim()) {
 e.whatsapp = 'WhatsApp number is required · வாட்ஸ்அப் எண் தேவை';
 } else if (!isValidPhone(data.whatsapp)) {
 e.whatsapp = 'Enter a valid 10-digit mobile number';
 }
 return e;
 };

 const handleChange = (field: keyof FormData, value: string) => {
 const newData = { ...formData, [field]: value };
 // Reset schoolId when switching to individual
 if (field === 'registrationType' && value === 'individual') {
 newData.schoolId = '';
 }
 setFormData(newData);
 if (touched[field]) {
 const newErrors = validate(newData);
 setErrors((prev) => ({ ...prev, [field]: newErrors[field] }));
 }
 };

 const handleBlur = (field: keyof FormData) => {
 setTouched((prev) => ({ ...prev, [field]: true }));
 const newErrors = validate(formData);
 setErrors((prev) => ({ ...prev, [field]: newErrors[field] }));
 };

 const handleIndividualClick = () => {
 if (!individualModeEnabled) {
 showToast("Individual registration is currently disabled by admin", "error");
 return;
 }
 setShowIndividualWarning(true);
 };

 const handleConfirmIndividual = () => {
 handleChange('registrationType', 'individual');
 setShowIndividualWarning(false);
 };

 const handleSubmit = async () => {
 if (!activeBeltTest) {
 await showAlert({
 title: "No Active Test",
 message: "No active belt test is available. Please contact administration.",
 variant: "warning",
 });
 return;
 }

 const allTouched = Object.fromEntries(
 (Object.keys(formData) as (keyof FormData)[]).map((k) => [k, true])
 ) as Record<keyof FormData, boolean>;
 setTouched(allTouched);

 const newErrors = validate(formData);
 setErrors(newErrors);

 if (Object.keys(newErrors).length > 0) return;

 // Determine school info
 let schoolId = formData.schoolId;
 let schoolName = '';

 if (formData.registrationType === 'individual') {
 schoolId = 'individual';
 schoolName = 'Individual';
 } else {
 const selectedSchool = schools.find((s) => s.id === formData.schoolId);
 schoolName = selectedSchool ? `${selectedSchool.name} - ${selectedSchool.branch}` : '';
 }

 setIsProcessing(true);

 try {
   // 1. QR Code is now generated dynamically during Hall Ticket generation
   // We no longer upload it to Firebase Storage.
   let qrUrl = "";

   const studentData = {
     id: `KAR-${Date.now()}`,
     name: formData.name,
     gender: formData.gender,
     registrationType: formData.registrationType,
     schoolId,
     school: schoolName,
     standard: formData.standard,
     contact: formData.contact ? `+91${formData.contact}` : '',
     whatsapp: `+91${formData.whatsapp}`,
     beltLevel: belts[selectedBelt]?.to,
     beltIndex: selectedBelt,
     stageLevel: 1, // Default for Karate
     
     beltTestId: activeBeltTest?.id || "",
     batchId: null,
     refereeId: null,

     paymentStatus: "verified" as const, // Automatically verified since payments are removed
     testStatus: "pending" as const,
     
     programType: 'KARATE',
     program: 'karate',
     
     qrUrl: qrUrl,

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

   // 3. Save to Firestore
   const cleanStudentData = JSON.parse(JSON.stringify(studentData));
   await firebaseStudentService.add(cleanStudentData);

   // Update parent state with the belt test this student registered for
   if (onStudentUpdate && activeBeltTest) {
     onStudentUpdate({ beltTestId: activeBeltTest.id });
   }

   await showAlert({
     title: "Registration Successful",
     message: "Your registration is complete! Our team will contact you with further details about the belt test.",
     variant: "success",
   });

   // Reset the form so the page is ready for a new registration
   setFormData({
     name: '',
     gender: '',
     registrationType: 'school',
     schoolId: '',
     standard: '',
     contact: '',
     whatsapp: '',
   });
   setSelectedBelt(0);
   setErrors({});
   setTouched({});
 } catch (error) {
   console.error("Error saving student data:", error);
   await showAlert({ title: "Save Error", message: "There was an error saving your data. Please contact support.", variant: "error" });
 } finally {
   setIsProcessing(false);
 }
 };

 // Loading state
 if (loading) {
 return (
 <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--off)' }}>
 <div className="text-center">
 <div className="w-16 h-16 border-4 border-yellow-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
 <p className="text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400">Loading...</p>
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
 <div style={{ minHeight: '100vh', background: 'var(--off)',  }}>
 {/* Header */}
 <div style={{ background: 'var(--ink)' }}>
 <div className="max-w-[1200px] mx-auto px-6 py-6">
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

 {/* Coming Soon Message */}
 <div className="max-w-[1200px] mx-auto px-6 py-12">
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-2xl shadow-lg p-12 text-center max-w-2xl mx-auto">
 <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
 <AlertCircle className="w-12 h-12 text-blue-600" />
 </div>

 <h2 className="text-sm font-bold mb-4" style={{ fontFamily: "'Bebas Neue', sans-serif", color: 'var(--ink)' }}>
 REGISTRATION COMING SOON
 </h2>

 <p className="text-sm text-gray-600 dark:text-zinc-400 mb-6">
 Registration is currently turned off. Please check back later.
 </p>
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
 Registration for the upcoming belt test is currently closed. Please contact your master or school for more details.
 </p>
 </div>
 </div>
 </div>
 );
 }

 // No active belt test - show message
 if (!activeBeltTest) {
 return (
 <div style={{ minHeight: '100vh', background: 'var(--off)',  }}>
 {/* Header */}
 <div style={{ background: 'var(--ink)' }}>
 <div className="max-w-[1200px] mx-auto px-6 py-6">
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

 {/* No Belt Test Available Message */}
 <div className="max-w-[1200px] mx-auto px-6 py-12">
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-2xl shadow-lg p-12 text-center max-w-2xl mx-auto">
 <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
 <XCircle className="w-12 h-12 text-red-600" />
 </div>

 <h2 className="text-sm font-bold mb-4" style={{ fontFamily: "'Bebas Neue', sans-serif", color: 'var(--ink)' }}>
 NO ACTIVE BELT TEST AVAILABLE
 </h2>

 <p className="text-sm text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 mb-6">
 Currently, there are no belt tests scheduled for registration.
 </p>

 <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-6 mb-8">
 <div className="flex items-start gap-3">
 <Calendar className="w-6 h-6 text-amber-600 flex-shrink-0 mt-1" />
 <div className="text-left">
 <h3 className="font-bold text-amber-900 mb-2">What does this mean?</h3>
 <p className="text-sm text-amber-800">
 Belt test registrations are currently closed. A new belt test must be scheduled
 by the administration before students can register.
 </p>
 </div>
 </div>
 </div>

 <div className="space-y-3 text-left">
 <p className="text-sm text-gray-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300">
 <strong>For Students & Parents:</strong><br />
 Please check back later or contact your instructor for the next belt test schedule.
 </p>

 <p className="text-sm text-gray-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300">
 <strong>For Administrators:</strong><br />
 Please log in to the admin panel and create a new belt test to enable student registrations.
 </p>
 </div>


 </div>
 </div>
 </div>
 );
 }

 return (
 <div>
 {/* Hero Section */}
 <div style={{ background: 'var(--ink)', overflow: 'hidden', position: 'relative' }}>
 <div className="max-w-[1200px] mx-auto px-6 grid grid-cols-1 md:grid-cols-[1fr_auto] items-end gap-6 pt-9">
 <div className="pb-8">
 {/* Logo + Badge row */}
 <div className="flex items-center gap-3 mb-4">
 <img
 src={logo}
 alt="Shadow Kai Karate"
 className="w-14 h-14 object-cover flex-shrink-0"
 />
 <div
 className="inline-flex items-center gap-[7px] px-3 py-[5px] rounded-full"
 style={{
 background: 'rgba(255,140,0,.15)',
 border: '1px solid rgba(255,140,0,.4)',
 color: 'var(--orange)',
 fontSize: '12px',
 fontWeight: 800,
 letterSpacing: '.08em',
 textTransform: 'uppercase',
 }}
 >
 <Layers size={13} />
 Shadow Kai
 </div>
 </div>
 <h1
 style={{
 fontFamily: "'Bebas Neue', sans-serif",
 fontSize: 'clamp(27px,5.25vw,66px)',
 letterSpacing: '3px',
 lineHeight: '.95',
 color: '#fff',
 }}
 >
 BELT
 <br />
 <span style={{ color: 'var(--orange)' }}>TEST</span>
 <br />
 REGISTRATION
 </h1>
 <p className="text-[11.25px] mt-3.5 leading-[1.6]" style={{ color: '#888' }}>
 மாணவர் பதிவு — Fill in all details below and choose your belt level to get started.
 </p>
 </div>

 {/* Belt decoration strip - hidden on mobile */}
 <div className="hidden md:flex flex-col gap-1.5 pb-8">
 {[
 { name: 'WHITE BELT', bg: '#FFFFFF', color: '#555', border: '2px solid #ddd' },
 { name: 'YELLOW BELT', bg: '#FFD700', color: '#000' },
 { name: 'ORANGE BELT', bg: '#FF8C00', color: '#fff' },
 { name: 'BLUE BELT', bg: '#2979FF', color: '#fff' },
 { name: 'GREEN BELT', bg: '#00C853', color: '#fff' },
 { name: 'II BROWN BELT', bg: '#8B4513', color: '#fff' },
 { name: 'I BROWN BELT', bg: '#5C2D0A', color: '#fff' },
 { name: 'BLACK BELT', bg: '#0D0D0D', color: '#fff', border: '1px solid #333' },
 ].map((belt, i) => (
 <div
 key={i}
 className="w-[180px] h-[22px] rounded-md flex items-center justify-end pr-2.5 transition-transform hover:scale-x-[1.04]"
 style={{
 background: belt.bg,
 color: belt.color,
 fontFamily: "'Bebas Neue', sans-serif",
 fontSize: '13px',
 letterSpacing: '1px',
 border: belt.border,
 }}
 >
 {belt.name}
 </div>
 ))}
 </div>
 </div>
 </div>

 {/* Form Content */}
 <div className="max-w-[960px] mx-auto px-6 py-8 pb-[60px]">

 {/* Registration Type Selector */}
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 border-[1.5px] rounded-2xl p-6 mb-5" style={{ borderColor: 'var(--border-color)' }}>
 <div className="flex items-center gap-2.5 mb-4">
 <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--orange)' }} />
 <div>
 <h2
 className="text-[16.5px] tracking-[1.5px]"
 style={{ fontFamily: "'Bebas Neue', sans-serif", color: 'var(--ink)' }}
 >
 Registration Type
 </h2>
 <p className="text-xs" style={{ color: 'var(--muted-color)' }}>
 பதிவு வகை — Choose how you are registering
 </p>
 </div>
 </div>
 <div className="grid grid-cols-2 gap-3">
 {/* School Option */}
 <button
 type="button"
 onClick={() => handleChange('registrationType', 'school')}
 className={`flex flex-col items-center gap-3 p-5 rounded-xl border-2 transition-all duration-150 ${
 formData.registrationType === 'school'
 ? 'border-orange-500 bg-orange-50'
 : 'border-gray-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 hover:border-gray-300 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700'
 }`}
 >
 <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
 formData.registrationType === 'school' ? 'bg-orange-100' : 'bg-gray-100 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800'
 }`}>
 <Building2 size={24} color={formData.registrationType === 'school' ? 'var(--orange)' : '#999'} />
 </div>
 <div className="text-center">
 <p className="font-bold text-sm" style={{ color: formData.registrationType === 'school' ? 'var(--orange)' : 'var(--ink)' }}>
 School Student
 </p>
 <p className="text-xs text-gray-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 mt-0.5">பள்ளி மாணவர்</p>
 </div>
 {formData.registrationType === 'school' && (
 <div className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center">
 <Check size={12} color="white" strokeWidth={3} />
 </div>
 )}
 </button>

 {/* Individual Option */}
 <button
 type="button"
 onClick={handleIndividualClick}
 disabled={!individualModeEnabled}
 className={`flex flex-col items-center gap-3 p-5 rounded-xl border-2 transition-all duration-150 ${
 formData.registrationType === 'individual'
 ? 'border-blue-500 bg-blue-50'
 : individualModeEnabled
 ? 'border-gray-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 hover:border-gray-300 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700'
 : 'border-gray-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 bg-gray-100 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 opacity-50 cursor-not-allowed'
 }`}
 >
 <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
 formData.registrationType === 'individual' ? 'bg-blue-100' : 'bg-gray-100 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800'
 }`}>
 <UserCircle size={24} color={formData.registrationType === 'individual' ? '#3B82F6' : '#999'} />
 </div>
 <div className="text-center">
 <p className="font-bold text-sm" style={{ color: formData.registrationType === 'individual' ? '#3B82F6' : 'var(--ink)' }}>
 Individual
 </p>
 <p className="text-xs text-gray-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 mt-0.5">தனி மாணவர்</p>
 </div>
 {formData.registrationType === 'individual' && (
 <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
 <Check size={12} color="white" strokeWidth={3} />
 </div>
 )}
 </button>
 </div>
 {formData.registrationType === 'individual' && (
 <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
 <p className="text-xs text-blue-700">
 <strong>Individual Registration:</strong> You are not affiliated with any school. You'll be grouped into an individual batch for the belt test.
 </p>
 </div>
 )}
 </div>

 {/* Personal Details Card */}
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 border-[1.5px] rounded-2xl p-6 mb-5" style={{ borderColor: 'var(--border-color)' }}>
 <div className="flex items-center gap-2.5 mb-[18px]">
 <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--orange)' }} />
 <div>
 <h2
 className="text-[16.5px] tracking-[1.5px]"
 style={{ fontFamily: "'Bebas Neue', sans-serif", color: 'var(--ink)' }}
 >
 Personal Details
 </h2>
 <p className="text-xs" style={{ color: 'var(--muted-color)' }}>
 தனிப்பட்ட விவரங்கள்
 </p>
 </div>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
 <FormField
 icon={<User size={14} color="var(--orange)" strokeWidth={2.5} />}
 label="Student Name"
 tamilLabel="மாணவர் பெயர்"
 placeholder="Enter full name"
 value={formData.name}
 onChange={(v) => handleChange('name', v)}
 onBlur={() => handleBlur('name')}
 error={errors.name}
 />
 <SelectField
 icon={<Users size={14} color="var(--orange)" strokeWidth={2.5} />}
 label="Gender"
 tamilLabel="பாலினம்"
 value={formData.gender}
 onChange={(v) => handleChange('gender', v)}
 onBlur={() => handleBlur('gender')}
 error={errors.gender}
 options={[
 { value: '', label: 'Select Gender' },
 { value: 'Male', label: 'Male · ஆண்' },
 { value: 'Female', label: 'Female · பெண்' },
 ]}
 />
 {/* School selector: only show when registrationType === 'school' */}
 {formData.registrationType === 'school' && (
 <SelectField
 icon={<Home size={14} color="var(--orange)" strokeWidth={2.5} />}
 label="School Name"
 tamilLabel="பள்ளி பெயர்"
 value={formData.schoolId}
 onChange={(v) => handleChange('schoolId', v)}
 onBlur={() => handleBlur('schoolId')}
 error={errors.schoolId}
 options={[
 { value: '', label: loadingSchools ? 'Loading schools...' : 'Select School' },
 ...schoolOptions,
 ]}
 />
 )}
 <SelectField
 icon={<Book size={14} color="var(--orange)" strokeWidth={2.5} />}
 label="Standard"
 tamilLabel="வகுப்பு"
 value={formData.standard}
 onChange={(v) => handleChange('standard', v)}
 onBlur={() => handleBlur('standard')}
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
 ]}
 />
 <PhoneField
 icon={<Phone size={14} color="var(--orange)" strokeWidth={2.5} />}
 label="Student Number"
 tamilLabel="தொடர்பு எண்"
 value={formData.contact}
 onChange={(v: string) => handleChange('contact', v)}
 onBlur={() => handleBlur('contact')}
 error={errors.contact}
 required={false}
 />
 </div>

 <PhoneField
 icon={<MessageCircle size={14} color="var(--orange)" strokeWidth={2.5} />}
 label="Parent WhatsApp"
 tamilLabel="பெற்றோர் வாட்ஸ்அப் எண்"
 value={formData.whatsapp}
 onChange={(v: string) => handleChange('whatsapp', v)}
 onBlur={() => handleBlur('whatsapp')}
 error={errors.whatsapp}
 required={true}
 />
 </div>

 {/* Belt Picker Card */}
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 border-[1.5px] rounded-2xl p-6 mb-5" style={{ borderColor: 'var(--border-color)' }}>
 <div className="flex items-start md:items-center justify-between flex-col md:flex-row gap-4 mb-[18px]">
 <div className="flex items-center gap-2.5">
 <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--red)' }} />
 <div>
 <h2
 className="text-[16.5px] tracking-[1.5px]"
 style={{ fontFamily: "'Bebas Neue', sans-serif", color: 'var(--ink)' }}
 >
 Choose Your Belt Test
 </h2>
 <p className="text-xs" style={{ color: 'var(--muted-color)' }}>
 பட்டை தேர்வு தேர்ந்தெடு — Select the transition you are testing for
 </p>
 </div>
 </div>
 <button
   type="button"
   onClick={() => setShowProgressionModal(true)}
   className="px-4 py-2 text-xs font-bold text-orange-600 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors whitespace-nowrap"
 >
   View Belt Progression
 </button>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
 {belts.map((belt, i) => {
  const matchingFee = feeStructure.find(f => {
  return (f.beltColor || "").toLowerCase() === (belt.to || '').toLowerCase();
  });

 if (!matchingFee) return null;

 const dynamicFee = matchingFee.fee;

 return (
 <BeltCard
 key={i}
 belt={{ ...belt, fee: dynamicFee }}
 index={i}
 isSelected={selectedBelt === i}
 onSelect={() => setSelectedBelt(i)}
 />
 );
 })}
 </div>
 </div>

 {/* Submit Button */}
 <button
 onClick={handleSubmit}
 className="w-full px-6 py-[18px] border-none rounded-2xl text-white cursor-pointer flex items-center justify-center gap-3 transition-all duration-200 relative overflow-hidden hover:translate-y-[-2px] hover:shadow-[0_12px_32px_rgba(0,0,0,.2)] active:translate-y-0"
 style={{
 background: 'var(--orange)',
 fontFamily: "'Bebas Neue', sans-serif",
 fontSize: '22px',
 letterSpacing: '2.5px',
 }}
 >
 <ArrowRight size={22} />
 {isProcessing ? 'PROCESSING...' : 'REGISTER NOW'}
 </button>


 </div>

 {/* Individual Registration Warning Modal */}
 {showIndividualWarning && (
 <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-2xl shadow-2xl w-full max-w-md">
 <div className="p-6">
 <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
 <AlertCircle className="w-8 h-8 text-amber-600" />
 </div>

 <h3 className="text-sm font-bold text-center mb-3" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
 INDIVIDUAL REGISTRATION
 </h3>

 <div className="space-y-3 mb-6">
 <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
 <p className="text-sm text-amber-900 font-medium mb-2">
 ⚠️ Important Notice
 </p>
 <p className="text-xs text-amber-800">
 You are registering as an <strong>Individual Student</strong> without school affiliation. This means:
 </p>
 </div>

 <div className="space-y-2 text-sm text-gray-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300">
 <div className="flex items-start gap-2">
 <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
 <Check size={12} className="text-blue-600" />
 </div>
 <p>You will be added to an <strong>Individual Students batch</strong></p>
 </div>
 <div className="flex items-start gap-2">
 <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
 <Check size={12} className="text-blue-600" />
 </div>
 <p>Admin will group you into a batch closer to the test date</p>
 </div>
 <div className="flex items-start gap-2">
 <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
 <Check size={12} className="text-blue-600" />
 </div>
 <p>This assignment is <strong>one-time and permanent</strong></p>
 </div>
 <div className="flex items-start gap-2">
 <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
 <Check size={12} className="text-blue-600" />
 </div>
 <p>Individual batches must be created by admin first</p>
 </div>
 </div>

 <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
 <p className="text-xs text-blue-800">
 <strong>Admin Notice:</strong> Individual mode has been enabled. Students registering as individuals will require individual batches to be generated by admin before the belt test.
 </p>
 </div>
 </div>

 <div className="flex items-center gap-3">
 <button
 onClick={() => setShowIndividualWarning(false)}
 className="flex-1 px-4 py-3 border-2 border-gray-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 text-gray-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 rounded-lg font-semibold text-sm hover:bg-gray-50 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:bg-zinc-900 transition-colors"
 >
 Cancel
 </button>
 <button
 onClick={handleConfirmIndividual}
 className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm transition-colors active:scale-95"
 >
 Continue
 </button>
 </div>
 </div>
 </div>
 </div>
 )}
 
 <ProgressionModal 
   isOpen={showProgressionModal} 
   onClose={() => setShowProgressionModal(false)} 
   defaultTab="karate"
 />
 </div>
 );
}

function FormField({
 icon,
 label,
 tamilLabel,
 placeholder,
 value,
 onChange,
 onBlur,
 error,
}: {
 icon: React.ReactNode;
 label: string;
 tamilLabel: string;
 placeholder: string;
 value: string;
 onChange: (value: string) => void;
 onBlur?: () => void;
 error?: string;
}) {
 return (
 <div className="flex flex-col gap-1.5">
 <label
 className="flex items-center gap-[7px] text-xs font-extrabold tracking-[.04em] uppercase"
 style={{ color: 'var(--muted-color)', fontFamily: "'Nunito', sans-serif" }}
 >
 {icon}
 {label}{' '}
 <span className="text-[8.25px] normal-case tracking-normal" style={{ color: '#bbb' }}>
 · {tamilLabel}
 </span>
 </label>
 <input
 type="text"
 placeholder={placeholder}
 value={value}
 onChange={(e) => onChange(e.target.value)}
 className="px-3.5 py-3 rounded-[10px] border-2 outline-none transition-all duration-[.18s] w-full placeholder:font-medium bg-transparent dark:bg-zinc-900 dark:text-zinc-50"
 style={{
 background: error ? '#fff5f5' : 'var(--off)',
 borderColor: error ? '#FF3B2F' : 'var(--border-color)',
 fontFamily: "'Nunito', sans-serif",
 fontSize: '15px',
 fontWeight: 600,
 color: 'var(--ink)',
 }}
 onFocus={(e) => {
 e.target.style.borderColor = error ? '#FF3B2F' : 'var(--orange)';
 e.target.style.boxShadow = error
 ? '0 0 0 4px rgba(255,59,47,.10)'
 : '0 0 0 4px rgba(255,140,0,.12)';
 e.target.style.background = '#fff';
 }}
 onBlur={(e) => {
 e.target.style.borderColor = error ? '#FF3B2F' : 'var(--border-color)';
 e.target.style.boxShadow = 'none';
 e.target.style.background = error ? '#fff5f5' : 'var(--off)';
 onBlur?.();
 }}
 />
 {error && (
 <div className="flex items-center gap-1.5" style={{ color: '#FF3B2F', fontSize: '11.5px', fontWeight: 700 }}>
 <AlertCircle size={11} strokeWidth={2.5} />
 {error}
 </div>
 )}
 </div>
 );
}

function PhoneField({
 icon,
 label,
 tamilLabel,
 value,
 onChange,
 onBlur,
 error,
 required = true,
}: {
 icon: React.ReactNode;
 label: string;
 tamilLabel: string;
 value: string;
 onChange: (value: string) => void;
 onBlur?: () => void;
 error?: string;
 required?: boolean;
}) {
 return (
 <div className="flex flex-col gap-1.5">
 <label
 className="flex items-center gap-[7px] text-xs font-extrabold tracking-[.04em] uppercase"
 style={{ color: 'var(--muted-color)', fontFamily: "'Nunito', sans-serif" }}
 >
 {icon}
 {label}{!required && <span className="text-gray-400 lowercase ml-1">(Optional)</span>}{' '}
 <span className="text-[8.25px] normal-case tracking-normal" style={{ color: '#bbb' }}>
 · {tamilLabel}
 </span>
 </label>
 <div className="flex relative">
 <div 
 className="absolute left-0 top-0 bottom-0 flex items-center justify-center px-3 rounded-l-[10px] border-2 border-r-0 bg-gray-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 transition-colors duration-[.18s]"
 style={{ borderColor: error ? '#FF3B2F' : 'var(--border-color)', color: 'var(--ink)', fontWeight: 700 }}
 >
 +91
 </div>
 <input
 type="text"
 maxLength={10}
 placeholder="00000 00000"
 value={value}
 onChange={(e) => {
 const val = e.target.value.replace(/\D/g, '').slice(0, 10);
 onChange(val);
 }}
 className="pl-[60px] pr-3.5 py-3 rounded-[10px] border-2 outline-none transition-all duration-[.18s] w-full placeholder:font-medium bg-transparent dark:bg-zinc-900 dark:text-zinc-50"
 style={{
 background: error ? '#fff5f5' : 'var(--off)',
 borderColor: error ? '#FF3B2F' : 'var(--border-color)',
 fontFamily: "'Nunito', sans-serif",
 fontSize: '15px',
 fontWeight: 600,
 color: 'var(--ink)',
 letterSpacing: '1px'
 }}
 onFocus={(e) => {
 e.target.style.borderColor = error ? '#FF3B2F' : 'var(--orange)';
 e.target.style.boxShadow = error
 ? '0 0 0 4px rgba(255,59,47,.10)'
 : '0 0 0 4px rgba(255,140,0,.12)';
 e.target.style.background = '#fff';
 if (e.target.previousSibling) {
 (e.target.previousSibling as HTMLElement).style.borderColor = error ? '#FF3B2F' : 'var(--orange)';
 }
 }}
 onBlur={(e) => {
 e.target.style.borderColor = error ? '#FF3B2F' : 'var(--border-color)';
 e.target.style.boxShadow = 'none';
 e.target.style.background = error ? '#fff5f5' : 'var(--off)';
 if (e.target.previousSibling) {
 (e.target.previousSibling as HTMLElement).style.borderColor = error ? '#FF3B2F' : 'var(--border-color)';
 }
 onBlur?.();
 }}
 />
 </div>
 {error && (
 <div className="flex items-center gap-1.5" style={{ color: '#FF3B2F', fontSize: '11.5px', fontWeight: 700 }}>
 <AlertCircle size={11} strokeWidth={2.5} />
 {error}
 </div>
 )}
 </div>
 );
}

function SelectField({
 icon,
 label,
 tamilLabel,
 value,
 onChange,
 onBlur,
 error,
 options,
}: {
 icon: React.ReactNode;
 label: string;
 tamilLabel: string;
 value: string;
 onChange: (value: string) => void;
 onBlur?: () => void;
 error?: string;
 options: { value: string; label: string }[];
}) {
 return (
 <div className="flex flex-col gap-1.5">
 <label
 className="flex items-center gap-[7px] text-xs font-extrabold tracking-[.04em] uppercase"
 style={{ color: 'var(--muted-color)', fontFamily: "'Nunito', sans-serif" }}
 >
 {icon}
 {label}{' '}
 <span className="text-[8.25px] normal-case tracking-normal" style={{ color: '#bbb' }}>
 · {tamilLabel}
 </span>
 </label>
 <select
 value={value}
 onChange={(e) => onChange(e.target.value)}
 className="px-3.5 py-3 rounded-[10px] border-2 outline-none transition-all duration-[.18s] w-full bg-transparent dark:bg-zinc-900 dark:text-zinc-50"
 style={{
 background: error ? '#fff5f5' : 'var(--off)',
 borderColor: error ? '#FF3B2F' : 'var(--border-color)',
 fontFamily: "'Nunito', sans-serif",
 fontSize: '15px',
 fontWeight: 600,
 color: value ? 'var(--ink)' : '#999',
 }}
 onFocus={(e) => {
 e.target.style.borderColor = error ? '#FF3B2F' : 'var(--orange)';
 e.target.style.boxShadow = error
 ? '0 0 0 4px rgba(255,59,47,.10)'
 : '0 0 0 4px rgba(255,140,0,.12)';
 e.target.style.background = '#fff';
 }}
 onBlur={(e) => {
 e.target.style.borderColor = error ? '#FF3B2F' : 'var(--border-color)';
 e.target.style.boxShadow = 'none';
 e.target.style.background = error ? '#fff5f5' : 'var(--off)';
 onBlur?.();
 }}
 >
 {options.map((option) => (
 <option key={option.value} value={option.value}>
 {option.label}
 </option>
 ))}
 </select>
 {error && (
 <div className="flex items-center gap-1.5" style={{ color: '#FF3B2F', fontSize: '11.5px', fontWeight: 700 }}>
 <AlertCircle size={11} strokeWidth={2.5} />
 {error}
 </div>
 )}
 </div>
 );
}

function BeltCard({
 belt,
 index,
 isSelected,
 onSelect,
}: {
 belt: (typeof belts)[0];
 index: number;
 isSelected: boolean;
 onSelect: () => void;
}) {
 const gradientsMap: Record<string, { bg: string, border: string, fee: string, tick: string }> = {
  'Yellow': { bg: 'linear-gradient(135deg,#fffbf0,#fff8e0)', border: '#FFD700', fee: '#B8860B', tick: '#FFD700' },
  'Orange': { bg: 'linear-gradient(135deg,#fff8e0,#fff3cc)', border: '#FF8C00', fee: '#CC6A00', tick: '#FF8C00' },
  'Blue': { bg: 'linear-gradient(135deg,#f0f5ff,#e0eaff)', border: '#2979FF', fee: '#1045CC', tick: '#2979FF' },
  'Green': { bg: 'linear-gradient(135deg,#f0fff5,#e0f8ec)', border: '#00C853', fee: '#007A30', tick: '#00C853' },
  'Purple': { bg: 'linear-gradient(135deg,#f8f0ff,#f0e0ff)', border: '#AA00FF', fee: '#7700BB', tick: '#AA00FF' },
  'II Brown': { bg: 'linear-gradient(135deg,#f5f0ee,#ede0d8)', border: '#8B4513', fee: '#5C2D0A', tick: '#8B4513' },
  'I Brown': { bg: 'linear-gradient(135deg,#f5f0ee,#ede0d8)', border: '#8B4513', fee: '#5C2D0A', tick: '#8B4513' },
  'Black Belt': { bg: 'linear-gradient(135deg,#f4f4f5,#e4e4e7)', border: '#18181b', fee: '#000000', tick: '#18181b' },
 };

 const style = gradientsMap[belt.to] || { bg: 'linear-gradient(135deg,#f8f9fa,#e9ecef)', border: '#ced4da', fee: '#6c757d', tick: '#adb5bd' };
 const beltImg = beltImages[belt.to];

 return (
 <div
 onClick={onSelect}
 className={`border-[2.5px] w-full max-w-[260px] sm:max-w-none mx-auto rounded-2xl p-3.5 pb-3 cursor-pointer transition-all duration-[.18s] relative overflow-hidden flex flex-col justify-between
 ${isSelected ? 'translate-y-[-3px] shadow-[0_8px_28px_rgba(0,0,0,.15)]' : 'hover:border-[#ccc] hover:translate-y-[-2px] hover:shadow-[0_6px_20px_rgba(0,0,0,.08)]'}`}
 style={{
 background: isSelected ? style.bg : '#fff',
 borderColor: isSelected ? style.border : 'var(--border-color)',
 minHeight: '210px'
 }}
 >
 <div className="flex-1">
 <div className="flex items-center gap-1.5 mb-2">
 <div
 className="flex-1 h-[9px] rounded-[5px]"
 style={{ background: belt.fc, border: belt.fb ? `2px solid ${belt.fb}` : 'none' }}
 />
 <ArrowRight size={10} color="#bbb" />
 <div className="flex-1 h-[9px] rounded-[5px]" style={{ background: belt.tc }} />
 </div>
 <div className="text-[8.25px] font-bold leading-[1.3]" style={{ color: 'var(--muted-color)' }}>
 {belt.from} → {belt.to}
 </div>
 </div>
  {beltImg && (
     <div className="flex justify-center my-2 pointer-events-none flex-1 items-center">
       <img src={beltImg} alt={belt.to} className="w-full h-[110px] object-contain drop-shadow-md rounded-md scale-[1.25]" />
     </div>
   )}
 <div
 className="mt-1"
 style={{
 fontFamily: "'Bebas Neue', sans-serif",
 fontSize: '22px',
 letterSpacing: '.5px',
 color: isSelected ? style.fee : 'inherit',
 }}
 >
 ₹{belt.fee.toLocaleString()}
 </div>
 {isSelected && (
 <div
 className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
 style={{ background: style.tick }}
 >
 <Check size={11} color="white" strokeWidth={3} />
 </div>
 )}
 </div>
 );
}
