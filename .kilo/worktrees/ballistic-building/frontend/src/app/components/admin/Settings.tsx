import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
 Settings as SettingsIcon,
 ToggleLeft,
 ToggleRight,
 Database,
 Palette,
 Trash2,
 Award,
 Save,
 MessageCircle,
 Send,
 LogOut,
} from "lucide-react";
import AdminLayout from "./AdminLayout";
import { firebaseAuthService } from "../../services/firebaseAuth";
import { firebaseAdminSettingsService } from "../../services/firebaseData";
import { useToast } from "../../hooks/useToast";
import { useDialog } from "../../contexts/DialogContext";
import { useProgram } from "../../contexts/ProgramContext";
import { AdminSettings } from "../../types/admin";
import { collection, getDocs, doc, writeBatch } from "firebase/firestore";
import { db } from "../../config/firebase";
import { fetchJson } from "../../utils/apiFetch";


type SettingsTab = 'general' | 'scoring' | 'whatsapp' | 'data';

export default function SettingsNew() {
 const navigate = useNavigate();
 const { showToast } = useToast();
 const { showConfirm } = useDialog();
 const { currentProgram } = useProgram();
 const [activeTab, setActiveTab] = useState<SettingsTab>('general');
 const [settings, setSettings] = useState<AdminSettings | null>(null);
 const [loading, setLoading] = useState(true);
 const [saving, setSaving] = useState(false);
 const [testPhone, setTestPhone] = useState("");
 const [testMessage, setTestMessage] = useState("");
 const [sendingTest, setSendingTest] = useState(false);

 const handleSendTestMessage = async () => {
   if (!testPhone || !testMessage) {
     showToast("Please enter phone and message", "error");
     return;
   }
   setSendingTest(true);
   try {
     const apiUrl = import.meta.env.VITE_API_BASE_URL;
     const { ok, data } = await fetchJson(`${apiUrl}/api/whatsapp/send-test-message`, {
       method: "POST",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify({ phone: testPhone, message: testMessage })
     });
     if (ok && data.success) {
       showToast("Test message sent successfully!", "success");
       setTestMessage("");
     } else {
       showToast(data.error || "Failed to send message", "error");
     }
   } catch (error: any) {
     showToast(error?.message || "Failed to send message", "error");
   } finally {
     setSendingTest(false);
   }
 };

 useEffect(() => {
 fetchSettings();
 }, [currentProgram]);

 const fetchSettings = async () => {
 setLoading(true);
 try {
 const data = await firebaseAdminSettingsService.get(currentProgram);
 setSettings(data);
 } catch (error) {
 console.error("Error fetching settings:", error);
 showToast("Error loading settings", "error");
 } finally {
 setLoading(false);
 }
 };

 const handleSaveSetting = async (key: keyof AdminSettings, value: any) => {
 if (!settings) return;

 setSaving(true);
 try {
 await firebaseAdminSettingsService.update({ [key]: value }, currentProgram);
 setSettings({ ...settings, [key]: value });
 showToast("Settings updated successfully", "success");
 } catch (error) {
 console.error("Error updating settings:", error);
 showToast("Failed to update settings", "error");
 } finally {
 setSaving(false);
 }
 };

 const handleToggle = async (key: keyof AdminSettings) => {
 if (!settings) return;
 const currentValue = settings[key] as boolean;
 await handleSaveSetting(key, !currentValue);
 };

 const handleDeleteAllData = async () => {
 const confirmed = await showConfirm({
 title: "⚠️ Delete ALL Data",
 message: "This will permanently delete ALL students, batches, belt tests, programs, branches, and system settings. Secretaries, Schools, Fee Structures, Fee Requests, and Referees are NOT affected. This action CANNOT be undone!",
 confirmText: "Yes, Delete Everything",
 variant: "danger"
 });

 if (!confirmed) return;

 setLoading(true);
 try {
 // Secretaries, secretarySchools, schools, schoolFeeRequests, feeStructure,
 // silambanFees, and referees are intentionally excluded — Delete All resets
 // transactional/test data only, not the Secretary/School/Fee management structure.
 const collectionsToClear = [
 "students",
 "batches",
 "beltTests",
 "programs",
 "branches",
 "settings"
 ];
 
 for (const colName of collectionsToClear) {
 const colRef = collection(db, colName);
 const snapshot = await getDocs(colRef);
 
 let batch = writeBatch(db);
 let count = 0;
 
 for (const document of snapshot.docs) {
 batch.delete(doc(db, colName, document.id));
 count++;
 if (count >= 400) {
 await batch.commit();
 batch = writeBatch(db);
 count = 0;
 }
 }
 
 if (count > 0) {
 await batch.commit();
 }
 }

 // Clear all local persistent caches
 // dataCache.clear();

 showToast("All system data has been successfully deleted!", "success");
 await fetchSettings();
 } catch (error) {
 console.error("Deletion failed:", error);
 showToast("Deletion failed", "error");
 } finally {
 setLoading(false);
 }
 };

 if (loading) {
 return (
 <AdminLayout>
 <div className="flex items-center justify-center py-12">
 <div className="text-center">
 <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
 <p className="text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400">Loading settings...</p>
 </div>
 </div>
 </AdminLayout>
 );
 }

 const tabs = [
 { id: 'general', label: 'General', icon: SettingsIcon },
 { id: 'scoring', label: 'Scoring', icon: Award },
 { id: 'whatsapp', label: 'WhatsApp Testing', icon: MessageCircle },
 { id: 'data', label: 'Data Management', icon: Database },
 ];

 return (
 <AdminLayout>
 <div className="space-y-6">
 {/* Header */}
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-lg shadow-md dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 p-6">
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
 <div className="flex items-center gap-3">
 <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
 <SettingsIcon className="w-6 h-6 text-purple-600" />
 </div>
 <div>
 <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
 SYSTEM SETTINGS
 </h2>
 <p className="text-sm text-gray-600 dark:text-zinc-400">Configure all system preferences</p>
 </div>
 </div>
 <button 
    onClick={async () => {
      await firebaseAuthService.logout();
      navigate("/admin/login");
    }}
    className="flex items-center justify-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg font-medium transition-colors border border-red-100"
  >
    <LogOut className="w-4 h-4" />
    Logout
  </button>
 </div>
 </div>

 {/* Tabs */}
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-lg shadow-md dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 overflow-hidden">
 <div className="flex overflow-x-auto border-b border-gray-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800">
 {tabs.map((tab) => {
 const Icon = tab.icon;
 return (
 <button
 key={tab.id}
 onClick={() => setActiveTab(tab.id as SettingsTab)}
 className={`flex items-center gap-2 px-6 py-4 font-semibold text-sm whitespace-nowrap transition-colors ${
 activeTab === tab.id
 ? 'bg-indigo-600 text-white'
 : 'bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:bg-zinc-900'
 }`}
 >
 <Icon className="w-4 h-4" />
 {tab.label}
 </button>
 );
 })}
 </div>

 <div className="p-6">
 {/* General Settings */}
 {activeTab === 'general' && (
 <div className="space-y-6">
 <SettingToggle
 title="Student Registration"
 description="Enable or disable new student registrations globally"
 enabled={settings?.studentRegistrationEnabled ?? true}
 onToggle={() => handleToggle('studentRegistrationEnabled')}
 saving={saving}
 info={[
 "When ON, parents can register students normally",
 "When OFF, registration form shows 'Coming Soon' and API blocks submissions"
 ]}
 />
 <SettingToggle
 title="Individual Mode"
 description="Allow students to register without being affiliated with a school"
 enabled={settings?.individualModeEnabled || false}
 onToggle={() => handleToggle('individualModeEnabled')}
 saving={saving}
 info={[
 "Students can register as individuals",
 "Admin can manage individual students separately",
 "Referees can transfer individuals to schools via QR scan"
 ]}
 />
 </div>
 )}

 {/* Scoring Settings */}
 {activeTab === 'scoring' && (
 <div className="space-y-6">
 <SettingNumber
 title="Minimum Passing Percentage"
 description="Students must score at least this percentage to pass"
 value={settings?.minimumPassingPercentage || 60}
 onSave={(value) => handleSaveSetting('minimumPassingPercentage', value)}
 min={0}
 max={100}
 suffix="%"
 saving={saving}
 />

 <SettingToggle
 title="Enable Lesson Numbers"
 description="Show lesson numbers (1-30) in scoring parameters"
 enabled={settings?.enableLessonNumbers !== false}
 onToggle={() => handleToggle('enableLessonNumbers')}
 saving={saving}
 />
 </div>
 )}

 {/* WhatsApp Testing */}
 {activeTab === 'whatsapp' && (
 <div className="space-y-6">
 <div className="border-2 border-gray-200 dark:border-zinc-800 rounded-lg p-4 sm:p-6 bg-white dark:bg-zinc-950">
 <div className="flex flex-col gap-4">
 <div>
 <h4 className="font-bold text-gray-800 dark:text-zinc-200 mb-2">WhatsApp Custom Message Testing</h4>
 <p className="text-sm text-gray-600 dark:text-zinc-400 mb-4">
 Send an arbitrary text message via the WhatsApp API. Note: The recipient must have messaged this WhatsApp Business account within the last 24 hours.
 </p>
 </div>
 <div className="space-y-4 max-w-lg">
 <div>
 <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Phone Number</label>
 <input
 type="text"
 value={testPhone}
 onChange={(e) => setTestPhone(e.target.value)}
 placeholder="+919876543210"
 className="w-full px-4 py-2 border-2 border-gray-300 dark:border-zinc-700 rounded-lg focus:border-green-600 focus:outline-none bg-transparent dark:bg-zinc-900 dark:text-zinc-50"
 />
 </div>
 <div>
 <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Message</label>
 <textarea
 value={testMessage}
 onChange={(e) => setTestMessage(e.target.value)}
 placeholder="Enter your test message here..."
 rows={4}
 className="w-full px-4 py-2 border-2 border-gray-300 dark:border-zinc-700 rounded-lg focus:border-green-600 focus:outline-none bg-transparent dark:bg-zinc-900 dark:text-zinc-50 resize-none"
 />
 </div>
 <button
 onClick={handleSendTestMessage}
 disabled={sendingTest || !testPhone || !testMessage}
 className="flex justify-center items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
 >
 {sendingTest ? (
 <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
 ) : (
 <Send className="w-5 h-5" />
 )}
 Send Test Message
 </button>
 </div>
 </div>
 </div>
 </div>
 )}

 {/* Data Management — Delete All Only */}
 {activeTab === 'data' && (
 <div className="space-y-6">

 {/* Delete All */}
 <div className="border-2 border-red-200 dark:border-zinc-800 rounded-lg p-4 sm:p-6 bg-red-50 dark:bg-zinc-900">
 <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
 <div className="flex-1 w-full">
 <h4 className="font-bold text-red-800 dark:text-red-400 mb-2">Delete All Data</h4>
 <p className="text-sm text-red-700 dark:text-red-300">
 ⚠️ Permanently delete ALL data. This action cannot be undone!
 </p>
 </div>
 <button
 onClick={handleDeleteAllData}
 className="w-full sm:w-auto flex justify-center items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold text-sm transition-colors"
 >
 <Trash2 className="w-4 h-4" />
 Delete All
 </button>
 </div>
 </div>
 </div>
 )}
 </div>
 </div>
 </div>
 </AdminLayout>
 );
}

// Reusable Setting Components
interface SettingToggleProps {
 title: string;
 description: string;
 enabled: boolean;
 onToggle: () => void;
 saving?: boolean;
 icon?: React.ElementType;
 info?: string[];
 variant?: 'default' | 'danger';
}

function SettingToggle({ title, description, enabled, onToggle, saving, icon: Icon, info, variant = 'default' }: SettingToggleProps) {
 const badgeClass = variant === 'danger' && enabled
 ? "bg-red-100 text-red-700"
 : enabled
 ? "bg-green-100 text-green-700"
 : "bg-gray-100 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400";

 const buttonClass = variant === 'danger' && enabled
 ? "bg-red-600 hover:bg-red-700 text-white"
 : enabled
 ? "bg-green-600 hover:bg-green-700 text-white"
 : "bg-gray-600 hover:bg-gray-700 text-white";

 return (
 <div className="border-2 border-gray-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-lg p-4 sm:p-6">
 <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
 <div className="flex-1 w-full">
 <div className="flex flex-wrap items-center gap-2 mb-2">
 {Icon && <Icon className="w-5 h-5 text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400" />}
 <h4 className="font-bold text-gray-800 dark:text-zinc-200 dark:text-zinc-200 dark:text-zinc-200 dark:text-zinc-200">{title}</h4>
 <span className={`px-2 py-1 text-xs font-semibold rounded ${badgeClass}`}>
 {enabled ? "ENABLED" : "DISABLED"}
 </span>
 </div>
 <p className="text-sm text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 mb-3">{description}</p>

 {info && (
 <div className="bg-blue-50 border border-blue-200 dark:bg-zinc-900 dark:border-zinc-800 rounded-lg p-3 mb-3 sm:mb-0">
 <ul className="text-xs text-blue-700 dark:text-blue-400 space-y-1">
 {info.map((item, index) => (
 <li key={index}>• {item}</li>
 ))}
 </ul>
 </div>
 )}
 </div>

 <button
 onClick={onToggle}
 disabled={saving}
 className={`w-full sm:w-auto flex justify-center items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all active:scale-95 disabled:opacity-50 ${buttonClass}`}
 >
 {saving ? (
 <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
 ) : enabled ? (
 <ToggleRight className="w-5 h-5" />
 ) : (
 <ToggleLeft className="w-5 h-5" />
 )}
 {enabled ? "Disable" : "Enable"}
 </button>
 </div>
 </div>
 );
}

interface SettingNumberProps {
 title: string;
 description: string;
 value: number;
 onSave: (value: number) => void;
 min?: number;
 max?: number;
 suffix?: string;
 saving?: boolean;
}

function SettingNumber({ title, description, value, onSave, min, max, suffix, saving }: SettingNumberProps) {
 const [localValue, setLocalValue] = useState(value);
 const [changed, setChanged] = useState(false);

 const handleChange = (newValue: number) => {
 setLocalValue(newValue);
 setChanged(newValue !== value);
 };

 const handleSave = () => {
 onSave(localValue);
 setChanged(false);
 };

 return (
 <div className="border-2 border-gray-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-lg p-4 sm:p-6">
 <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
 <div className="flex-1 w-full">
 <h4 className="font-bold text-gray-800 dark:text-zinc-200 dark:text-zinc-200 dark:text-zinc-200 dark:text-zinc-200 mb-2">{title}</h4>
 <p className="text-sm text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 mb-4">{description}</p>

 <div className="flex items-center gap-3">
 <input
 type="number"
 value={localValue}
 onChange={(e) => handleChange(parseInt(e.target.value) || 0)}
 min={min}
 max={max}
 className="w-32 px-4 py-2 border-2 border-gray-300 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700 rounded-lg focus:border-indigo-600 focus:outline-none bg-transparent dark:bg-zinc-900 dark:text-zinc-50"
 />
 {suffix && <span className="text-sm text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400">{suffix}</span>}
 </div>
 </div>

 {changed && (
 <button
 onClick={handleSave}
 disabled={saving}
 className="w-full sm:w-auto flex justify-center items-center gap-2 px-4 py-2 mt-2 sm:mt-0 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-sm transition-colors disabled:opacity-50"
 >
 {saving ? (
 <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
 ) : (
 <Save className="w-4 h-4" />
 )}
 Save
 </button>
 )}
 </div>
 </div>
 );
}

interface SettingTextProps {
 title: string;
 description: string;
 value: string;
 onSave: (value: string) => void;
 placeholder?: string;
 type?: string;
 saving?: boolean;
}

function SettingText({ title, description, value, onSave, placeholder, type = 'text', saving }: SettingTextProps) {
 const [localValue, setLocalValue] = useState(value);
 const [changed, setChanged] = useState(false);

 const handleChange = (newValue: string) => {
 setLocalValue(newValue);
 setChanged(newValue !== value);
 };

 const handleSave = () => {
 onSave(localValue);
 setChanged(false);
 };

 return (
 <div className="border-2 border-gray-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-lg p-4 sm:p-6">
 <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
 <div className="flex-1 w-full">
 <h4 className="font-bold text-gray-800 dark:text-zinc-200 dark:text-zinc-200 dark:text-zinc-200 dark:text-zinc-200 mb-2">{title}</h4>
 <p className="text-sm text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 mb-4">{description}</p>

 <input
 type={type}
 value={localValue}
 onChange={(e) => handleChange(e.target.value)}
 placeholder={placeholder}
 className="w-full px-4 py-2 border-2 border-gray-300 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700 rounded-lg focus:border-indigo-600 focus:outline-none bg-transparent dark:bg-zinc-900 dark:text-zinc-50"
 />
 </div>

 {changed && (
 <button
 onClick={handleSave}
 disabled={saving}
 className="w-full sm:w-auto flex justify-center items-center gap-2 px-4 py-2 mt-2 sm:mt-0 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-sm transition-colors disabled:opacity-50"
 >
 {saving ? (
 <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
 ) : (
 <Save className="w-4 h-4" />
 )}
 Save
 </button>
 )}
 </div>
 </div>
 );
}
