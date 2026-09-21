import { useState, useEffect } from "react";
import { Save, Loader2 } from "lucide-react";
import { firebaseBeltTestService } from "../../services/firebaseData";
import AdminLayout from "./AdminLayout";
import { useProgram } from "../../contexts/ProgramContext";
import { useToast } from "../../hooks/useToast";
import { useDialog } from "../../contexts/DialogContext";

export default function CreateBeltTest() {
 const { currentProgram, programNavigate } = useProgram();
 const { showAlert } = useDialog();
 const { showToast } = useToast();

 const [programType, setProgramType] = useState<'KARATE' | 'SELAMBAM'>(
 currentProgram === 'SELAMBAM' ? 'SELAMBAM' : 'KARATE'
 );
 const [name, setName] = useState("");
 const [date, setDate] = useState("");
 const [time, setTime] = useState("");
 const [venue, setVenue] = useState("");
 const [locationLink, setLocationLink] = useState("");
 const [locationAddress, setLocationAddress] = useState("");
 const [registrationStartDate, setRegistrationStartDate] = useState("");
 const [registrationEndDate, setRegistrationEndDate] = useState("");
 const [isActive, setIsActive] = useState(true);
 const [saving, setSaving] = useState(false);

 useEffect(() => {
   const checkExisting = async () => {
     try {
       const existingTests = await firebaseBeltTestService.getAll(programType);
       if (existingTests.length > 0) {
         showToast("A test already exists. Only one is allowed per program.", "warning");
         programNavigate("manage-belt-tests");
       }
     } catch (err) {
       console.error("Error checking existing tests:", err);
     }
   };
   checkExisting();
 }, [programType, programNavigate, showToast]);

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();

 if (!name.trim() || !date || !time) {
 await showAlert({
 title: "Missing Details",
 message: "Please fill in all required fields: name, date, and time.",
 variant: "warning",
 });
 return;
 }

 if (registrationStartDate && registrationEndDate && new Date(registrationStartDate) > new Date(registrationEndDate)) {
 await showAlert({
 title: "Invalid Dates",
 message: "Registration End Date cannot be before the Start Date.",
 variant: "warning",
 });
 return;
 }

 setSaving(true);
 try {
   // Double check before creating
   const existingTests = await firebaseBeltTestService.getAll(programType);
   if (existingTests.length > 0) {
     await showAlert({
       title: "Test Already Exists",
       message: `Only ONE test can be created in the system for the ${programType} program. Please delete the existing test to create a new one.`,
       variant: "warning",
     });
     setSaving(false);
     return;
   }

 const payload: any = {
 name: name.trim(),
 date,
 time,
 isActive,
 belts: [],
 scoringParameters: [],
 programType,
 allowedSchoolIds: [],
 maxStudentsPerBatch: 10,
 createdAt: new Date().toISOString(),
 updatedAt: new Date().toISOString(),
 };
 
 // Handle optional fields explicitly to avoid undefined crashing Firestore
 if (venue.trim()) payload.venue = venue.trim();
 if (locationLink.trim()) payload.locationLink = locationLink.trim();
 if (locationAddress.trim()) payload.locationAddress = locationAddress.trim();
 if (registrationStartDate) payload.registrationStartDate = registrationStartDate;
 if (registrationEndDate) payload.registrationEndDate = registrationEndDate;

 await firebaseBeltTestService.create(payload as any);

 showToast("Test created successfully!", "success");
 programNavigate("manage-belt-tests");
 } catch (err) {
 console.error("Error creating test:", err);
 showToast("Failed to create test. Please try again.", "error");
 } finally {
 setSaving(false);
 }
 };

 return (
 <AdminLayout>
 <div className="max-w-2xl mx-auto">
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-2xl shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 p-6 md:p-8">
 <h2
 className="text-3xl font-bold mb-6 text-zinc-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50"
 style={{ fontFamily: "'Bebas Neue', sans-serif" }}
 >
 {programType === 'KARATE' ? 'CREATE KARATE BELT TEST' : 'CREATE SILAMBAM STAGE TEST'}
 </h2>

 <form onSubmit={handleSubmit} className="space-y-5">
 {/* Program Type */}
 <div>
 <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
 Program Type *
 </label>
 <select
 value={programType}
 onChange={(e) => setProgramType(e.target.value as 'KARATE' | 'SELAMBAM')}
 className="w-full px-4 py-3 border-2 border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-xl focus:border-blue-500 focus:outline-none font-semibold text-zinc-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 bg-transparent dark:bg-zinc-900 dark:text-zinc-50"
 disabled={currentProgram !== 'ALL'}
 >
 <option value="KARATE">Karate Belt Test</option>
 <option value="SELAMBAM">Silambam Stage Test</option>
 </select>
 {currentProgram !== 'ALL' && (
 <p className="text-xs text-zinc-400 mt-1">Program type is locked to the current active program.</p>
 )}
 </div>

 {/* Name */}
 <div>
 <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
 Test Name *
 </label>
 <input
 type="text"
 value={name}
 onChange={(e) => setName(e.target.value)}
 className="w-full px-4 py-3 border-2 border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-xl focus:border-blue-500 focus:outline-none font-semibold text-zinc-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 bg-transparent dark:bg-zinc-900 dark:text-zinc-50"
 placeholder={programType === 'KARATE' ? 'e.g., April 2026 Belt Test' : 'e.g., April 2026 Stage Test'}
 required
 />
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 {/* Date */}
 <div>
 <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
 Test Date *
 </label>
 <input
 type="date"
 value={date}
 onChange={(e) => setDate(e.target.value)}
 className="w-full px-4 py-3 border-2 border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-xl focus:border-blue-500 focus:outline-none font-semibold text-zinc-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 bg-transparent dark:bg-zinc-900 dark:text-zinc-50"
 required
 />
 </div>

 {/* Time */}
 <div>
 <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
 Test Time *
 </label>
 <input
 type="time"
 value={time}
 onChange={(e) => setTime(e.target.value)}
 className="w-full px-4 py-3 border-2 border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-xl focus:border-blue-500 focus:outline-none font-semibold text-zinc-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 bg-transparent dark:bg-zinc-900 dark:text-zinc-50"
 required
 />
 </div>
 </div>

 {/* Venue */}
 <div>
 <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
 Venue (Optional)
 </label>
 <input
 type="text"
 value={venue}
 onChange={(e) => setVenue(e.target.value)}
 className="w-full px-4 py-3 border-2 border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-xl focus:border-blue-500 focus:outline-none font-semibold text-zinc-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 bg-transparent dark:bg-zinc-900 dark:text-zinc-50"
 placeholder="e.g., Main Hall, Sports Complex"
 />
 </div>

 {/* Location Link (WhatsApp Override) */}
 <div>
 <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
 Google Maps Link (WhatsApp Override)
 </label>
 <input
 type="url"
 value={locationLink}
 onChange={(e) => setLocationLink(e.target.value)}
 className="w-full px-4 py-3 border-2 border-zinc-200 dark:border-zinc-800 rounded-xl focus:border-blue-500 focus:outline-none font-semibold text-zinc-900 dark:text-zinc-50 bg-transparent dark:bg-zinc-900"
 placeholder="e.g., https://maps.app.goo.gl/..."
 />
 </div>

 {/* Location Address */}
 <div>
   <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
     Full Location Address *
   </label>
   <textarea
     value={locationAddress}
     onChange={(e) => setLocationAddress(e.target.value)}
     className="w-full px-4 py-3 border-2 border-zinc-200 dark:border-zinc-800 rounded-xl focus:border-blue-500 focus:outline-none font-semibold text-zinc-900 dark:text-zinc-50 bg-transparent dark:bg-zinc-900"
     placeholder="e.g., Shadow Kai Karate Academy, Coimbatore, Tamil Nadu"
     rows={2}
     required
   />
 </div>

 {/* Registration Dates */}
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <div>
 <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
 Registration Start Date (Optional)
 </label>
 <input
 type="date"
 value={registrationStartDate}
 onChange={(e) => setRegistrationStartDate(e.target.value)}
 className="w-full px-4 py-3 border-2 border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-xl focus:border-blue-500 focus:outline-none font-semibold text-zinc-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 bg-transparent dark:bg-zinc-900 dark:text-zinc-50"
 />
 </div>
 <div>
 <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
 Registration End Date (Optional)
 </label>
 <input
 type="date"
 value={registrationEndDate}
 onChange={(e) => setRegistrationEndDate(e.target.value)}
 className="w-full px-4 py-3 border-2 border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-xl focus:border-blue-500 focus:outline-none font-semibold text-zinc-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 bg-transparent dark:bg-zinc-900 dark:text-zinc-50"
 />
 </div>
 </div>

 {/* Active Toggle */}
 <div className="flex items-center gap-3 p-4 bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800">
 <input
 type="checkbox"
 id="isActive"
 checked={isActive}
 onChange={(e) => setIsActive(e.target.checked)}
 className="w-5 h-5 accent-amber-500 cursor-pointer bg-transparent dark:bg-zinc-900 dark:text-zinc-50"
 />
 <label htmlFor="isActive" className="font-semibold text-zinc-800 dark:text-zinc-200 dark:text-zinc-200 dark:text-zinc-200 dark:text-zinc-200 cursor-pointer select-none">
 Set as Active Test
 </label>
 <span className="text-xs text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 ml-1">(Students can register when active)</span>
 </div>

 <div className="flex gap-3 pt-2">
 <button
 type="submit"
 disabled={saving}
 className="flex items-center gap-2 px-8 py-3 bg-blue-500 hover:bg-blue-600 disabled:opacity-60 text-zinc-950 rounded-xl font-bold transition-all active:scale-95"
 >
 {saving ? (
 <Loader2 className="w-5 h-5 animate-spin" />
 ) : (
 <Save className="w-5 h-5" />
 )}
 {saving ? "Creating..." : "Create Test"}
 </button>
 <button
 type="button"
 onClick={() => programNavigate("manage-belt-tests")}
 disabled={saving}
 className="px-8 py-3 bg-zinc-100 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 rounded-xl hover:bg-zinc-200 font-bold transition-colors"
 >
 Cancel
 </button>
 </div>
 </form>
 </div>
 </div>
 </AdminLayout>
 );
}
