import { useState, useEffect } from "react";
import { Settings as SettingsIcon, ToggleLeft, ToggleRight, Info, AlertTriangle, X, Database, PlayCircle, CheckCircle } from "lucide-react";
import AdminLayout from "./AdminLayout";
import { firebaseAdminSettingsService, firebaseStudentService, firebaseBatchService } from "../../services/firebaseData";
import { useToast } from "../../hooks/useToast";
import { AdminSettings } from "../../types/admin";
import { runFullMigration, checkMigrationNeeded, MigrationResult } from "../../utils/migration";
import { firebaseProgramService, branchService } from "../../services/programService";

export default function Settings() {
 const { showToast } = useToast();
 const [settings, setSettings] = useState<AdminSettings | null>(null);
 const [loading, setLoading] = useState(true);
 const [saving, setSaving] = useState(false);
 const [showDisableModal, setShowDisableModal] = useState(false);
 const [individualStats, setIndividualStats] = useState({ students: 0, batches: 0 });
 
 // Migration state
 const [migrationNeeded, setMigrationNeeded] = useState(false);
 const [migrationRunning, setMigrationRunning] = useState(false);
 const [migrationResults, setMigrationResults] = useState<MigrationResult[] | null>(null);
 const [seedingDefaults, setSeedingDefaults] = useState(false);

 useEffect(() => {
 fetchSettings();
 checkIfMigrationNeeded();
 }, []);

 const fetchSettings = async () => {
 try {
 const data = await firebaseAdminSettingsService.get();
 setSettings(data);
 } catch (error) {
 console.error("Error fetching settings:", error);
 showToast("Error loading settings", "error");
 } finally {
 setLoading(false);
 }
 };
 
 const checkIfMigrationNeeded = async () => {
 try {
 const needed = await checkMigrationNeeded();
 setMigrationNeeded(needed);
 } catch (error) {
 console.error("Error checking migration status:", error);
 }
 };
 
 const handleRunMigration = async () => {
 setMigrationRunning(true);
 setMigrationResults(null);
 
 try {
 const results = await runFullMigration();
 setMigrationResults(results);
 setMigrationNeeded(false);
 
 const totalMigrated = results.reduce((sum, r) => sum + r.migrated, 0);
 const totalErrors = results.reduce((sum, r) => sum + r.errors, 0);
 
 if (totalErrors > 0) {
 showToast(`Migration completed with ${totalErrors} errors. Check console for details.`, "error");
 } else if (totalMigrated > 0) {
 showToast(`Successfully migrated ${totalMigrated} records!`, "success");
 } else {
 showToast("All records already have program/branch IDs", "success");
 }
 } catch (error) {
 console.error("Migration failed:", error);
 showToast("Migration failed. Check console for details.", "error");
 } finally {
 setMigrationRunning(false);
 }
 };
 
 const handleSeedDefaults = async () => {
 setSeedingDefaults(true);
 
 try {
 await firebaseProgramService.seedDefaults();
 await branchService.seedDefaults();
 showToast("Default programs and branches seeded successfully!", "success");
 } catch (error) {
 console.error("Seeding failed:", error);
 showToast("Failed to seed defaults. Check console for details.", "error");
 } finally {
 setSeedingDefaults(false);
 }
 };

 const handleToggleIndividualMode = async () => {
 if (!settings) return;

 const newValue = !settings.individualModeEnabled;

 // If trying to DISABLE Individual Mode, show confirmation modal
 if (!newValue && settings.individualModeEnabled) {
 // Fetch individual students and batches count
 try {
 const [students, batches] = await Promise.all([
 firebaseStudentService.getIndividual(),
 firebaseBatchService.getAll(),
 ]);
 const individualBatches = batches.filter((b) => b.schoolId === "individual");
 setIndividualStats({
 students: students.length,
 batches: individualBatches.length,
 });
 setShowDisableModal(true);
 } catch (error) {
 console.error("Error fetching individual data:", error);
 showToast("Error checking individual data", "error");
 }
 return;
 }

 // If enabling, proceed immediately
 setSaving(true);
 try {
 await firebaseAdminSettingsService.toggleIndividualMode(newValue);
 setSettings({ ...settings, individualModeEnabled: newValue });
 showToast("Individual Mode enabled", "success");
 } catch (error) {
 console.error("Error updating settings:", error);
 showToast("Failed to update settings", "error");
 } finally {
 setSaving(false);
 }
 };

 const handleConfirmDisable = async () => {
 if (!settings) return;

 setSaving(true);
 try {
 await firebaseAdminSettingsService.toggleIndividualMode(false);
 setSettings({ ...settings, individualModeEnabled: false });
 showToast("Individual Mode disabled", "success");
 setShowDisableModal(false);
 } catch (error) {
 console.error("Error updating settings:", error);
 showToast("Failed to update settings", "error");
 } finally {
 setSaving(false);
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

 return (
 <AdminLayout>
 <div className="space-y-6">
 {/* Header */}
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-lg shadow-md dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 p-6">
 <div className="flex items-center gap-3">
 <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
 <SettingsIcon className="w-6 h-6 text-purple-600" />
 </div>
 <div>
 <h2
 className="text-2xl font-bold"
 style={{ fontFamily: "'Bebas Neue', sans-serif" }}
 >
 SYSTEM SETTINGS
 </h2>
 <p className="text-sm text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400">Configure system-wide preferences</p>
 </div>
 </div>
 </div>

 {/* Individual Mode Setting */}
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-lg shadow-md dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 p-6">
 <h3 className="text-lg font-bold mb-4">Registration Settings</h3>

 <div className="border-2 border-gray-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-lg p-6">
 <div className="flex items-start justify-between gap-4">
 <div className="flex-1">
 <div className="flex items-center gap-2 mb-2">
 <h4 className="font-bold text-gray-800 dark:text-zinc-200 dark:text-zinc-200 dark:text-zinc-200 dark:text-zinc-200">Individual Mode</h4>
 <span
 className={`px-2 py-1 text-xs font-semibold rounded ${
 settings?.individualModeEnabled
 ? "bg-green-100 text-green-700"
 : "bg-gray-100 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400"
 }`}
 >
 {settings?.individualModeEnabled ? "ENABLED" : "DISABLED"}
 </span>
 </div>
 <p className="text-sm text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 mb-4">
 When enabled, students can register as individuals (not affiliated with any
 school). They can later be added to a school via QR scan during batch
 assignment.
 </p>

 <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
 <h5 className="font-semibold text-blue-800 mb-2 text-sm flex items-center gap-2">
 <Info className="w-4 h-4" />
 What this enables:
 </h5>
 <ul className="text-xs text-blue-700 space-y-1">
 <li>• Students see "School" vs "Individual" option during registration</li>
 <li>• Individual students can register without selecting a school</li>
 <li>• Admin can manage Individual students separately</li>
 <li>• Referees can transfer Individual students to schools via QR scan</li>
 </ul>
 </div>
 </div>

 <button
 onClick={handleToggleIndividualMode}
 disabled={saving}
 className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all active:scale-95 disabled:opacity-50 ${
 settings?.individualModeEnabled
 ? "bg-green-600 hover:bg-green-700 text-white"
 : "bg-gray-600 hover:bg-gray-700 text-white"
 }`}
 >
 {saving ? (
 <>
 <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
 Saving...
 </>
 ) : settings?.individualModeEnabled ? (
 <>
 <ToggleRight className="w-5 h-5" />
 Disable
 </>
 ) : (
 <>
 <ToggleLeft className="w-5 h-5" />
 Enable
 </>
 )}
 </button>
 </div>
 </div>
 </div>

 {/* Warning when Individual Mode is disabled */}
 {!settings?.individualModeEnabled && (
 <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6">
 <h4 className="font-bold text-blue-800 mb-2">⚠️ Individual Mode is Disabled</h4>
 <p className="text-sm text-blue-700">
 Students can only register under existing schools. To allow independent
 registrations, enable Individual Mode above.
 </p>
 </div>
 )}
 
 {/* Migration Section */}
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-lg shadow-md dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 p-6">
 <h3 className="text-lg font-bold mb-4">Data Migration</h3>

 <div className="border-2 border-gray-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-lg p-6">
 <div className="flex items-start justify-between gap-4">
 <div className="flex-1">
 <div className="flex items-center gap-2 mb-2">
 <h4 className="font-bold text-gray-800 dark:text-zinc-200 dark:text-zinc-200 dark:text-zinc-200 dark:text-zinc-200">Data Migration</h4>
 <span
 className={`px-2 py-1 text-xs font-semibold rounded ${
 migrationNeeded
 ? "bg-red-100 text-red-700"
 : "bg-gray-100 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400"
 }`}
 >
 {migrationNeeded ? "NEEDED" : "UP-TO-DATE"}
 </span>
 </div>
 <p className="text-sm text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 mb-4">
 Migrate existing data to include program and branch IDs. This is necessary for new features and improvements.
 </p>

 <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
 <h5 className="font-semibold text-blue-800 mb-2 text-sm flex items-center gap-2">
 <Info className="w-4 h-4" />
 What this enables:
 </h5>
 <ul className="text-xs text-blue-700 space-y-1">
 <li>• New features that require program and branch IDs</li>
 <li>• Improved data management and reporting</li>
 <li>• Enhanced user experience</li>
 </ul>
 </div>
 </div>

 <button
 onClick={handleRunMigration}
 disabled={migrationRunning}
 className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all active:scale-95 disabled:opacity-50 ${
 migrationNeeded
 ? "bg-red-600 hover:bg-red-700 text-white"
 : "bg-gray-600 hover:bg-gray-700 text-white"
 }`}
 >
 {migrationRunning ? (
 <>
 <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
 Migrating...
 </>
 ) : migrationNeeded ? (
 <>
 <PlayCircle className="w-5 h-5" />
 Run Migration
 </>
 ) : (
 <>
 <CheckCircle className="w-5 h-5" />
 Up-to-Date
 </>
 )}
 </button>
 </div>
 </div>
 </div>
 
 {/* Seed Defaults Section */}
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-lg shadow-md dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 p-6">
 <h3 className="text-lg font-bold mb-4">Seed Defaults</h3>

 <div className="border-2 border-gray-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-lg p-6">
 <div className="flex items-start justify-between gap-4">
 <div className="flex-1">
 <div className="flex items-center gap-2 mb-2">
 <h4 className="font-bold text-gray-800 dark:text-zinc-200 dark:text-zinc-200 dark:text-zinc-200 dark:text-zinc-200">Seed Defaults</h4>
 </div>
 <p className="text-sm text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 mb-4">
 Seed default programs and branches into the database. This is useful for setting up a new system or resetting defaults.
 </p>

 <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
 <h5 className="font-semibold text-blue-800 mb-2 text-sm flex items-center gap-2">
 <Info className="w-4 h-4" />
 What this enables:
 </h5>
 <ul className="text-xs text-blue-700 space-y-1">
 <li>• Default programs and branches for new users</li>
 <li>• Simplified setup for new systems</li>
 <li>• Reset defaults if needed</li>
 </ul>
 </div>
 </div>

 <button
 onClick={handleSeedDefaults}
 disabled={seedingDefaults}
 className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all active:scale-95 disabled:opacity-50 ${
 seedingDefaults
 ? "bg-red-600 hover:bg-red-700 text-white"
 : "bg-gray-600 hover:bg-gray-700 text-white"
 }`}
 >
 {seedingDefaults ? (
 <>
 <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
 Seeding...
 </>
 ) : (
 <>
 <Database className="w-5 h-5" />
 Seed Defaults
 </>
 )}
 </button>
 </div>
 </div>
 </div>
 
 {/* Migration Results */}
 {migrationResults && (
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-lg shadow-md dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 p-6">
 <h3 className="text-lg font-bold mb-4">Migration Results</h3>
 
 <div className="space-y-3">
 {migrationResults.map((result) => (
 <div key={result.collection} className="border-2 border-gray-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-lg p-4">
 <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
 <h4 className="font-bold text-gray-800 dark:text-zinc-200 dark:text-zinc-200 dark:text-zinc-200 dark:text-zinc-200 capitalize">{result.collection}</h4>
 <span className="text-sm text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400">
 Total: {result.total}
 </span>
 </div>
 
 <div className="grid grid-cols-3 gap-3">
 <div className="bg-green-50 rounded p-2 text-center">
 <p className="text-xl font-bold text-green-600">{result.migrated}</p>
 <p className="text-xs text-green-700">Migrated</p>
 </div>
 <div className="bg-gray-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 rounded p-2 text-center">
 <p className="text-xl font-bold text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400">{result.skipped}</p>
 <p className="text-xs text-gray-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300">Skipped</p>
 </div>
 <div className="bg-red-50 rounded p-2 text-center">
 <p className="text-xl font-bold text-red-600">{result.errors}</p>
 <p className="text-xs text-red-700">Errors</p>
 </div>
 </div>
 </div>
 ))}
 </div>
 
 <div className="mt-4 bg-green-50 border-2 border-green-200 rounded-lg p-4">
 <p className="text-sm text-green-800 font-semibold">
 ✓ Migration completed successfully!
 </p>
 <p className="text-xs text-green-700 mt-1">
 All records have been updated with program and branch IDs.
 </p>
 </div>
 </div>
 )}
 </div>

 {/* Disable Confirmation Modal */}
 {showDisableModal && (
 <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-2xl shadow-2xl w-full max-w-lg">
 <div className="p-6">
 <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
 <AlertTriangle className="w-8 h-8 text-red-600" />
 </div>

 <h3 className="text-xl font-bold text-center mb-3" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
 DISABLE INDIVIDUAL MODE?
 </h3>

 <div className="space-y-4 mb-6">
 <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
 <p className="text-sm text-red-900 font-bold mb-2">
 ⚠️ Warning: This action will affect system behavior
 </p>
 <p className="text-xs text-red-800">
 Disabling Individual Mode will prevent new students from registering as individuals. However, existing data will remain intact.
 </p>
 </div>

 {/* Current Individual Data Stats */}
 <div className="bg-gray-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-lg p-4">
 <p className="text-sm font-semibold text-gray-800 dark:text-zinc-200 dark:text-zinc-200 dark:text-zinc-200 dark:text-zinc-200 mb-3">Current Individual Data:</p>
 <div className="grid grid-cols-2 gap-3">
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-lg p-3 text-center">
 <p className="text-2xl font-bold text-indigo-600">{individualStats.students}</p>
 <p className="text-xs text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 mt-1">Individual Students</p>
 </div>
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-lg p-3 text-center">
 <p className="text-2xl font-bold text-purple-600">{individualStats.batches}</p>
 <p className="text-xs text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 mt-1">Individual Batches</p>
 </div>
 </div>
 </div>

 <div className="space-y-2 text-sm text-gray-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300">
 <p className="font-semibold text-gray-800 dark:text-zinc-200 dark:text-zinc-200 dark:text-zinc-200 dark:text-zinc-200">What will happen:</p>
 <div className="space-y-1.5 ml-4">
 <div className="flex items-start gap-2">
 <span className="text-red-600 flex-shrink-0">✗</span>
 <p>Students will <strong>no longer see</strong> the "Individual" option during registration</p>
 </div>
 <div className="flex items-start gap-2">
 <span className="text-red-600 flex-shrink-0">✗</span>
 <p>New individual registrations will be <strong>blocked</strong></p>
 </div>
 <div className="flex items-start gap-2">
 <span className="text-red-600 flex-shrink-0">✗</span>
 <p>Individual Students and Individual Batches menu will be <strong>hidden</strong> from admin panel</p>
 </div>
 <div className="flex items-start gap-2">
 <span className="text-green-600 flex-shrink-0">✓</span>
 <p>Existing individual students and batches will <strong>remain in database</strong></p>
 </div>
 <div className="flex items-start gap-2">
 <span className="text-green-600 flex-shrink-0">✓</span>
 <p>You can <strong>re-enable</strong> Individual Mode anytime</p>
 </div>
 </div>
 </div>

 {individualStats.students > 0 && (
 <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
 <p className="text-xs text-blue-800">
 <strong>Recommendation:</strong> If you have active individual students ({individualStats.students}), consider keeping Individual Mode enabled until their belt test is complete.
 </p>
 </div>
 )}
 </div>

 <div className="flex items-center gap-3">
 <button
 onClick={() => setShowDisableModal(false)}
 disabled={saving}
 className="flex-1 px-4 py-3 border-2 border-gray-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 text-gray-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 rounded-lg font-semibold text-sm hover:bg-gray-50 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:bg-zinc-900 transition-colors disabled:opacity-50"
 >
 Cancel
 </button>
 <button
 onClick={handleConfirmDisable}
 disabled={saving}
 className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold text-sm transition-colors disabled:opacity-50 active:scale-95 flex items-center justify-center gap-2"
 >
 {saving ? (
 <>
 <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
 Disabling...
 </>
 ) : (
 <>
 <AlertTriangle className="w-4 h-4" />
 Yes, Disable
 </>
 )}
 </button>
 </div>
 </div>
 </div>
 </div>
 )}
 </AdminLayout>
 );
}
