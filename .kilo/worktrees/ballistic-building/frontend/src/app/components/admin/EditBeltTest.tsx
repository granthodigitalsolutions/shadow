import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Save } from "lucide-react";
import { firebaseBeltTestService } from "../../services/firebaseData";
import AdminLayout from "./AdminLayout";
import { useToast } from "../../hooks/useToast";
import { useDialog } from "../../contexts/DialogContext";
import { useProgram } from "../../contexts/ProgramContext";

export default function EditBeltTest() {
 const { testId } = useParams();
 const { programNavigate } = useProgram();
 const { showAlert } = useDialog();
 const { showToast } = useToast();
 const [name, setName] = useState("");
 const [date, setDate] = useState("");
 const [time, setTime] = useState("");
 const [venue, setVenue] = useState("");
 const [locationLink, setLocationLink] = useState("");
 const [locationAddress, setLocationAddress] = useState("");
 const [registrationStartDate, setRegistrationStartDate] = useState("");
 const [registrationEndDate, setRegistrationEndDate] = useState("");
 const [isActive, setIsActive] = useState(false);
 const [loading, setLoading] = useState(true);
 const [saving, setSaving] = useState(false);

 useEffect(() => {
 const fetchTest = async () => {
 if (!testId) return;
 try {
 const test = await firebaseBeltTestService.getById(testId);
 if (test) {
 setName(test.name);
 setDate(test.date);
 setTime(test.time);
 setVenue(test.venue ?? "");
 setLocationLink(test.locationLink ?? "");
 setLocationAddress(test.locationAddress ?? "");
 setRegistrationStartDate(test.registrationStartDate ?? "");
 setRegistrationEndDate(test.registrationEndDate ?? "");
 setIsActive(test.isActive);
 } else {
 showToast("Belt test not found", "error");
 programNavigate("manage-belt-tests");
 }
 } catch (err) {
 console.error("Error loading belt test:", err);
 showToast("Error loading belt test", "error");
 } finally {
 setLoading(false);
 }
 };
 fetchTest();
 }, [testId, programNavigate]);

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();

 if (!name || !date || !time) {
 await showAlert({
 title: "Missing Details",
 message: "Please fill in all basic details (name, date, time).",
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

 if (!testId) return;
 setSaving(true);
 try {
 const updates: any = {
 name,
 date,
 time,
 isActive,
 };
 
 // Safely handle optional fields using empty strings if they are cleared
 if (venue.trim()) updates.venue = venue.trim();
 else updates.venue = "";
 
 if (locationLink.trim()) updates.locationLink = locationLink.trim();
 else updates.locationLink = "";
 
 if (locationAddress.trim()) updates.locationAddress = locationAddress.trim();
 else updates.locationAddress = "";

 if (registrationStartDate) updates.registrationStartDate = registrationStartDate;
 else updates.registrationStartDate = ""; 
 
 if (registrationEndDate) updates.registrationEndDate = registrationEndDate;
 else updates.registrationEndDate = ""; 

 // Only update the editable fields â€” do NOT pass belts or scoringParameters
//  console.log("[EditBeltTest] ðŸ”„ Updating belt test:", testId, JSON.stringify(updates));
 await firebaseBeltTestService.update(testId, updates);
//  console.log("[EditBeltTest] âœ… Update succeeded for:", testId);
 showToast("Belt test updated!", "success");
 programNavigate("manage-belt-tests");
 } catch (err) {
 console.error("Error saving belt test:", err);
 showToast("Error saving belt test", "error");
 } finally {
 setSaving(false);
 }
 };

 if (loading) {
 return (
 <AdminLayout>
 <div className="flex items-center justify-center min-h-[60vh]">
 <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
 </div>
 </AdminLayout>
 );
 }

 return (
 <AdminLayout>
 <div className="max-w-2xl mx-auto">
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-2xl shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 p-6 md:p-8">
 <h2
 className="text-3xl font-bold mb-6 text-zinc-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50"
 style={{ fontFamily: "'Bebas Neue', sans-serif" }}
 >
 EDIT BELT TEST
 </h2>

 <form onSubmit={handleSubmit} className="space-y-6">
 <div className="space-y-4">
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
 placeholder="e.g., April 2026 Belt Test"
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
 </div>
 </div>

 <div className="flex gap-3 pt-2">
 <button
 type="submit"
 disabled={saving}
 className="flex items-center gap-2 px-8 py-3 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-zinc-950 rounded-xl font-bold transition-all active:scale-95"
 >
 {saving ? (
 <span className="w-4 h-4 border-2 border-zinc-900/30 border-t-zinc-900 rounded-full animate-spin" />
 ) : (
 <Save className="w-5 h-5" />
 )}
 {saving ? "Saving..." : "Save Changes"}
 </button>
 <button
 type="button"
 onClick={() => programNavigate("manage-belt-tests")}
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
