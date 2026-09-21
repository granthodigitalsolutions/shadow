import { useState, useEffect, useRef } from "react";
import {
 DollarSign, Edit, Save, X, RefreshCw, Trophy, Shield,
 Plus, Trash2, AlertTriangle,
} from "lucide-react";
import {
 firebaseFeeStructureService,
 firebaseSilambanFeeService,
 FeeStructure as FeeStructureType,
 SilambanFeeStructure,
} from "../../services/firebaseData";
import AdminLayout from "./AdminLayout";
import { useToast } from "../../hooks/useToast";
import { useDialog } from "../../contexts/DialogContext";
import { useProgram } from "../../contexts/ProgramContext";

// ── Stage colour palette ──────────────────────────────────────────────────────
const STAGE_COLORS = [
 { color: "#FFD700", bg: "rgba(255,215,0,.12)" },
 { color: "#FF8C00", bg: "rgba(255,140,0,.12)" },
 { color: "#00C853", bg: "rgba(0,200,83,.12)" },
 { color: "#2979FF", bg: "rgba(41,121,255,.12)" },
 { color: "#AA00FF", bg: "rgba(170,0,255,.12)" },
 { color: "#F44336", bg: "rgba(244,67,54,.12)" },
 { color: "#009688", bg: "rgba(0,150,136,.12)" },
 { color: "#E91E63", bg: "rgba(233,30,99,.12)" },
];
function sc(order: number) { return STAGE_COLORS[(order - 1) % STAGE_COLORS.length]; }


interface EditState { fee: string; stageName: string; }

// ── Delete confirmation modal ─────────────────────────────────────────────────
function DeleteConfirmModal({
 stageName, onConfirm, onCancel, loading,
}: {
 stageName: string;
 onConfirm: () => void;
 onCancel: () => void;
 loading: boolean;
}) {
 return (
 <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in fade-in zoom-in-95">
 <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
 <Trash2 className="w-7 h-7 text-red-500" />
 </div>
 <h3 className="text-lg font-bold text-center text-gray-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 mb-1" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "1px", fontSize: "22px" }}>
 DELETE STAGE
 </h3>
 <p className="text-sm text-center text-gray-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 mb-5">
 Are you sure you want to delete <strong className="text-gray-800 dark:text-zinc-200 dark:text-zinc-200 dark:text-zinc-200 dark:text-zinc-200">"{stageName}"</strong>?
 <br />This action cannot be undone.
 </p>
 <div className="flex gap-3">
 <button
 onClick={onCancel}
 disabled={loading}
 className="flex-1 px-4 py-3 border-2 border-gray-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-xl text-gray-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 font-semibold hover:bg-gray-50 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:bg-zinc-900 text-sm transition-colors disabled:opacity-50"
 >
 Cancel
 </button>
 <button
 onClick={onConfirm}
 disabled={loading}
 className="flex-1 px-4 py-3 bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600 text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
 >
 {loading ? (
 <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
 ) : (
 <Trash2 className="w-4 h-4" />
 )}
 Delete Stage
 </button>
 </div>
 </div>
 </div>
 );
}

// ── Add Stage modal ───────────────────────────────────────────────────────────
function AddStageModal({
 onAdd, onCancel, totalStages,
}: {
 onAdd: (name: string, fee: number) => Promise<void>;
 onCancel: () => void;
 totalStages: number;
}) {
 const [name, setName] = useState(`Stage ${totalStages + 1}`);
 const [fee, setFee] = useState("");
 const [saving, setSaving] = useState(false);
 const [error, setError] = useState("");

 const handleSubmit = async () => {
 if (!name.trim()) { setError("Stage name is required"); return; }
 const num = parseInt(fee);
 if (!fee || isNaN(num) || num <= 0) { setError("Enter a valid fee amount"); return; }
 setSaving(true);
 try {
 await onAdd(name.trim(), num);
 } catch {
 setError("Failed to add stage. Please try again.");
 } finally {
 setSaving(false);
 }
 };

 // Preview colour for new stage
 const previewSc = sc(totalStages + 1);

 return (
 <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
 {/* Coloured header strip */}
 <div className="p-5 text-white" style={{ background: previewSc.color }}>
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-full bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950/20 flex items-center justify-center">
 <Trophy className="w-5 h-5 text-white" />
 </div>
 <div>
 <p className="text-xs font-bold uppercase tracking-widest opacity-80">New Stage</p>
 <h3 className="font-bold text-lg leading-tight" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "1.5px" }}>
 ADD STAGE
 </h3>
 </div>
 </div>
 </div>

 <div className="p-5 space-y-4">
 {/* Stage name */}
 <div>
 <label className="block text-xs font-bold text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 mb-1.5">Stage Name</label>
 <input
 type="text"
 value={name}
 onChange={e => { setName(e.target.value); setError(""); }}
 placeholder={`Stage ${totalStages + 1}`}
 className="w-full px-3 py-2.5 border-2 border-gray-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-lg outline-none text-sm font-semibold text-gray-800 dark:text-zinc-200 dark:text-zinc-200 dark:text-zinc-200 dark:text-zinc-200 focus:border-green-400 transition-colors bg-transparent dark:bg-zinc-900 dark:text-zinc-50"
 autoFocus
 />
 </div>

 {/* Fee */}
 <div>
 <label className="block text-xs font-bold text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 mb-1.5">
 Examination Fee (₹)
 </label>
 <div className="relative">
 <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-lg">₹</span>
 <input
 type="number"
 value={fee}
 onChange={e => { setFee(e.target.value); setError(""); }}
 placeholder="1000"
 min="1"
 className="w-full pl-8 pr-3 py-2.5 border-2 border-gray-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-lg outline-none text-xl font-bold focus:border-green-400 transition-colors bg-transparent dark:bg-zinc-900 dark:text-zinc-50"
 style={{ color: previewSc.color }}
 onKeyDown={e => e.key === "Enter" && handleSubmit()}
 />
 </div>
 </div>

 {error && (
 <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
 <AlertTriangle className="w-4 h-4 flex-shrink-0" />
 {error}
 </div>
 )}

 <div className="flex gap-3 pt-1">
 <button
 onClick={onCancel}
 disabled={saving}
 className="flex-1 px-4 py-3 border-2 border-gray-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-xl text-gray-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 font-semibold hover:bg-gray-50 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:bg-zinc-900 text-sm transition-colors disabled:opacity-50"
 >
 Cancel
 </button>
 <button
 onClick={handleSubmit}
 disabled={saving}
 className="flex-1 px-4 py-3 text-white rounded-xl font-semibold text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
 style={{ background: previewSc.color }}
 >
 {saving ? (
 <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
 ) : (
 <Plus className="w-4 h-4" />
 )}
 Add Stage
 </button>
 </div>
 </div>
 </div>
 </div>
 );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function FeeStructure() {
 const { showToast } = useToast();
 const { showConfirm } = useDialog();

 const { currentProgram } = useProgram();

 // Karate
 const [karateFees, setKarateFees] = useState<FeeStructureType[]>([]);
 const [karateLoading, setKarateLoading] = useState(true);

 // Silambam
 const [silamFees, setSilamFees] = useState<SilambanFeeStructure[]>([]);
 const [silamLoading, setSilamLoading] = useState(true);

 // Edit state
 const [editing, setEditing] = useState<string | null>(null);
 const [editData, setEditData] = useState<EditState>({ fee: "", stageName: "" });

 // Delete confirmation
 const [deleteTarget, setDeleteTarget] = useState<SilambanFeeStructure | null>(null);
 const [deleteLoading, setDeleteLoading] = useState(false);

 // Add stage modal
 const [showAddModal, setShowAddModal] = useState(false);

 // ── Load ────────────────────────────────────────────────────────────────────
 const lastFetchedProgram = useRef<string | null>(null);
 useEffect(() => {
 if (lastFetchedProgram.current === currentProgram) return;
 lastFetchedProgram.current = currentProgram;
 fetchKarate(); fetchSilambam();
 }, [currentProgram]);

 const fetchKarate = async () => {
 setKarateLoading(true);
 try {
 let data = await firebaseFeeStructureService.getAll();
 if (data.length === 0) {
 await firebaseFeeStructureService.initialize();
 data = await firebaseFeeStructureService.getAll();
 }
 setKarateFees(data);
 } catch (err: any) {
 if (err.code === "permission-denied") showToast("Permission denied.", "error");
 else setTimeout(fetchKarate, 2000);
 } finally { setKarateLoading(false); }
 };

 const fetchSilambam = async () => {
 setSilamLoading(true);
 try {
 let data = await firebaseSilambanFeeService.getAll();
 if (data.length === 0) {
 await firebaseSilambanFeeService.initialize();
 data = await firebaseSilambanFeeService.getAll();
 }
 setSilamFees(data);
 } catch (err: any) {
 if (err.code === "permission-denied") showToast("Permission denied.", "error");
 else setTimeout(fetchSilambam, 2000);
 } finally { setSilamLoading(false); }
 };

 // ── Karate actions ──────────────────────────────────────────────────────────
 const saveKarate = async (id: string) => {
 const num = parseInt(editData.fee);
 if (!editData.fee || num <= 0) { showToast("Enter a valid fee amount", "error"); return; }
 try {
 await firebaseFeeStructureService.updateFee(id, num);
 setEditing(null);
 await fetchKarate();
 showToast("Karate fee updated!", "success");
 } catch { showToast("Failed to update fee", "error"); }
 };

 const toggleKarate = async (id: string, current: boolean) => {
 try {
 await firebaseFeeStructureService.toggleActive(id, !current);
 await fetchKarate();
 showToast(current ? "Belt hidden from students" : "Belt visible to students", "success");
 } catch { showToast("Failed to toggle visibility", "error"); }
 };

 const resetKarate = async () => {
 const ok = await showConfirm({
 title: "Reset Karate Fees",
 message: "Reset all Karate belt fees to their default values?",
 detail: [
 "White → Yellow: ₹1,200",
 "Yellow → Orange: ₹1,200",
 "Orange → Blue: ₹1,200",
 "Blue → Green: ₹1,500",
 "Green → II Brown: ₹1,500",
 "II Brown → I Brown: ₹1,500",
 "I Brown → Black Belt: ₹2,000",
 ],
 confirmText: "Yes, Reset",
 variant: "warning",
 });
 if (!ok) return;
 setKarateLoading(true);
 try {
 await firebaseFeeStructureService.resetToDefaults();
 await fetchKarate();
 showToast("Karate fees reset to defaults!", "success");
 } catch { showToast("Failed to reset fees", "error"); }
 finally { setKarateLoading(false); }
 };

 // ── Silambam actions ────────────────────────────────────────────────────────
 const saveSilambam = async (id: string) => {
 const num = parseInt(editData.fee);
 if (!editData.fee || num <= 0) { showToast("Enter a valid fee amount", "error"); return; }
 if (!editData.stageName.trim()) { showToast("Stage name cannot be empty", "error"); return; }
 try {
 await firebaseSilambanFeeService.updateFee(id, num);
 await firebaseSilambanFeeService.updateStageName(id, editData.stageName.trim());
 setEditing(null);
 await fetchSilambam();
 showToast("Stage updated!", "success");
 } catch { showToast("Failed to update stage", "error"); }
 };

 const toggleSilambam = async (id: string, current: boolean) => {
 try {
 await firebaseSilambanFeeService.toggleActive(id, !current);
 await fetchSilambam();
 showToast(current ? "Stage hidden from students" : "Stage visible to students", "success");
 } catch { showToast("Failed to toggle visibility", "error"); }
 };

 const confirmDelete = async () => {
 if (!deleteTarget) return;
 setDeleteLoading(true);
 try {
 await firebaseSilambanFeeService.deleteStage(deleteTarget.id);
      setDeleteTarget(null);
      await fetchSilambam();
      showToast(`"${deleteTarget.stageName}" deleted.`, "success");
    } catch { showToast("Failed to delete stage", "error"); }
    finally { setDeleteLoading(false); }
  };

  const handleAddStage = async (name: string, fee: number) => {
 if (silamFees.length >= 10) {
 showToast("Maximum limit of 10 stages reached.", "error");
 return;
 }
 await firebaseSilambanFeeService.addStage(name, fee);
 setShowAddModal(false);
 await fetchSilambam();
 showToast(`"${name}" added successfully!`, "success");
 };

 const resetSilambam = async () => {
 const ok = await showConfirm({
 title: "Reset Silambam Stages",
 message: "This will delete all custom stages and restore the 5 defaults.",
 detail: [
 "Stage 1: ₹800",
 "Stage 2: ₹900",
 "Stage 3: ₹1,000",
 "Stage 4: ₹1,200",
 "Stage 5: ₹1,500",
 ],
 confirmText: "Yes, Reset",
 variant: "warning",
 });
 if (!ok) return;
 setSilamLoading(true);
 try {
 await firebaseSilambanFeeService.resetToDefaults();
 await fetchSilambam();
 showToast("Silambam stages reset to defaults!", "success");
 } catch { showToast("Failed to reset stages", "error"); }
 finally { setSilamLoading(false); }
 };

 const cancelEdit = () => { setEditing(null); setEditData({ fee: "", stageName: "" }); };

 // ── Render ──────────────────────────────────────────────────────────────────
 return (
 <AdminLayout>
 <div className="space-y-6">
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-lg shadow-md dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 p-6">

 {/* Header */}
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
 <div className="flex items-center gap-3">
 <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
 <DollarSign className="w-6 h-6 text-blue-600" />
 </div>
 <div>
 <h2 className="text-xl sm:text-2xl font-bold" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
 FEE STRUCTURE
 </h2>
 <p className="text-sm text-gray-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400">Manage examination fees per program</p>
 </div>
 </div>

 <div className="flex items-center gap-2">
 {(currentProgram === "SELAMBAM" || currentProgram === "ALL") && silamFees.length < 10 && (
 <button
 onClick={() => setShowAddModal(true)}
 className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold text-sm transition-colors"
 >
 <Plus className="w-4 h-4" />
 Add Stage
 </button>
 )}
 {(currentProgram === "KARATE" || currentProgram === "ALL") && (
 <button
 onClick={resetKarate}
 disabled={karateLoading}
 className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold text-sm transition-colors disabled:opacity-50"
 >
 <RefreshCw className="w-4 h-4" />
 Reset Karate
 </button>
 )}
 {(currentProgram === "SELAMBAM" || currentProgram === "ALL") && (
 <button
 onClick={resetSilambam}
 disabled={silamLoading}
 className="flex items-center gap-2 px-4 py-2.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-semibold text-sm transition-colors disabled:opacity-50"
 >
 <RefreshCw className="w-4 h-4" />
 Reset Defaults
 </button>
 )}
 </div>
 </div>

 {/* ── KARATE TAB ── */}
 {(currentProgram === "KARATE" || currentProgram === "ALL") && (
 <>
 {currentProgram === "ALL" && (
 <div className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold border-b-2 border-blue-600 text-blue-700 mb-6">
 <Shield className="w-4 h-4" /> Karate · Belt Transitions
 </div>
 )}
 {karateLoading ? <LoadingSpinner color="blue" /> : (
 <>
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
 {karateFees.map((fee, index) => (
 <div
 key={fee.id}
 className={`bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 border-2 rounded-xl p-4 hover:shadow-lg transition-all ${
 fee.active === false ? "border-red-200 opacity-60" : "border-gray-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 hover:border-blue-400"
 }`}
 >
 {editing === fee.id ? (
 <div className="space-y-3">
 <p className="text-xs font-semibold text-center text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 border-b pb-2">
 {index === 0 ? "White" : karateFees[index - 1].beltColor} → {fee.beltColor}
 </p>
 <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 text-center">Fee (₹)</label>
 <input
 type="number"
 value={editData.fee}
 onChange={e => setEditData(d => ({ ...d, fee: e.target.value }))}
 className="w-full px-3 py-2.5 border-2 border-gray-300 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700 rounded-lg focus:border-blue-500 outline-none text-2xl font-bold text-blue-600 text-center bg-transparent dark:bg-zinc-900 dark:text-zinc-50"
 autoFocus
 />
 <div className="flex gap-2">
 <button onClick={() => saveKarate(fee.id)} className="flex-1 flex items-center justify-center gap-1 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-semibold">
 <Save className="w-3.5 h-3.5" /> Save
 </button>
 <button onClick={cancelEdit} className="px-3 py-2 bg-gray-400 text-white dark:text-zinc-900 dark:text-zinc-900 dark:text-zinc-900 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:bg-zinc-100 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:bg-zinc-100 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:bg-zinc-100 dark:bg-zinc-9000">
 <X className="w-4 h-4" />
 </button>
 </div>
 </div>
 ) : (
 <div className="space-y-3">
 <div className="flex flex-wrap items-center justify-between gap-3">
 <span className="text-[10px] font-bold text-gray-400">
 {fee.active === false ? "Hidden" : "Visible"}
 </span>
 <ToggleSwitch active={fee.active !== false} onChange={() => toggleKarate(fee.id, fee.active !== false)} color="blue" />
 </div>
 <div className="text-center border-b border-gray-100 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 pb-3">
 <p className="text-sm font-bold text-gray-800 dark:text-zinc-200 dark:text-zinc-200 dark:text-zinc-200 dark:text-zinc-200 mb-1">{index === 0 ? "White" : karateFees[index - 1].beltColor} → {fee.beltColor}</p>
 <p className="text-2xl font-bold text-blue-600">₹{fee.fee.toLocaleString()}</p>
 </div>
 <button
 onClick={() => { setEditing(fee.id); setEditData({ fee: fee.fee.toString(), stageName: "" }); }}
 className="w-full flex items-center justify-center gap-2 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold"
 >
 <Edit className="w-3.5 h-3.5" /> Edit Fee
 </button>
 </div>
 )}
 </div>
 ))}
 </div>
 {karateFees.length === 0 && <p className="text-center text-gray-400 py-8">Initialising…</p>}
 </>
 )}
 </>
 )}

 {/* ── SILAMBAM TAB ── */}
 {(currentProgram === "SELAMBAM" || currentProgram === "ALL") && (
 <>
 {currentProgram === "ALL" && (
 <div className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold border-b-2 border-green-600 text-green-700 mb-6 mt-12">
 <Trophy className="w-4 h-4" /> Silambam · Stage Fees
 <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700">
 {silamFees.length}
 </span>
 </div>
 )}
 {/* Info banner */}
 <div className="mb-5 p-3 bg-green-50 border border-green-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-sm text-green-800 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300">
 <div className="flex-1 min-w-0">
 <strong>Silambam Stage Fees</strong> — Admin-set fees appear live on the registration page.
 You can <strong>rename</strong>, <strong>edit fee</strong>, <strong>hide</strong>, <strong>add</strong>, or <strong>delete</strong> any stage.
 </div>
 {silamFees.length < 10 ? (
 <button
 onClick={() => setShowAddModal(true)}
 className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg font-semibold text-xs hover:bg-green-700 transition-colors whitespace-nowrap"
 >
 <Plus className="w-3.5 h-3.5" /> Add Stage
 </button>
 ) : (
 <span className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-200 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400 rounded-lg font-semibold text-xs whitespace-nowrap">
 Max 10 Stages Reached
 </span>
 )}
 </div>

 {silamLoading ? <LoadingSpinner color="green" /> : (
 <>
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
 {silamFees.map((fee) => {
 const palette = sc(fee.order);
 const isEditing = editing === fee.id;
 return (
 <div
 key={fee.id}
 className={`rounded-xl border-2 transition-all hover:shadow-lg ${
 fee.active === false ? "border-red-200 opacity-60 bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950" : "border-gray-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 hover:border-green-400"
 }`}
 style={{ background: fee.active === false ? "#fff" : palette.bg }}
 >
 {isEditing ? (
 /* ── Edit Mode ── */
 <div className="p-4 space-y-3">
 {/* Colour accent bar */}
 <div className="h-1 rounded-full mb-1" style={{ background: palette.color }} />

 <div>
 <label className="block text-xs font-bold text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 mb-1">Stage Name</label>
 <input
 type="text"
 value={editData.stageName}
 onChange={e => setEditData(d => ({ ...d, stageName: e.target.value }))}
 placeholder="e.g. Beginner"
 className="w-full px-3 py-2 border-2 border-gray-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-lg focus:border-green-400 outline-none text-sm font-semibold bg-transparent dark:bg-zinc-900 dark:text-zinc-50"
 autoFocus
 />
 </div>

 <div>
 <label className="block text-xs font-bold text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 mb-1">Fee Amount (₹)</label>
 <div className="relative">
 <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-400">₹</span>
 <input
 type="number"
 value={editData.fee}
 onChange={e => setEditData(d => ({ ...d, fee: e.target.value }))}
 placeholder="1000"
 className="w-full pl-7 pr-3 py-2.5 border-2 border-gray-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-lg focus:border-green-400 outline-none text-2xl font-bold text-center bg-transparent dark:bg-zinc-900 dark:text-zinc-50"
 style={{ color: palette.color }}
 />
 </div>
 </div>

 <div className="flex gap-2 pt-1">
 <button onClick={() => saveSilambam(fee.id)} className="flex-1 flex items-center justify-center gap-1 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-semibold">
 <Save className="w-3.5 h-3.5" /> Save
 </button>
 <button onClick={cancelEdit} className="px-3 py-2 bg-gray-400 text-white dark:text-zinc-900 dark:text-zinc-900 dark:text-zinc-900 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:bg-zinc-100 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:bg-zinc-100 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:bg-zinc-100 dark:bg-zinc-9000">
 <X className="w-4 h-4" />
 </button>
 </div>
 </div>
 ) : (
 /* ── View Mode ── */
 <div className="p-4">
 {/* Top row: visible toggle + delete */}
 <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
 <div className="flex items-center gap-2">
 <ToggleSwitch
 active={fee.active !== false}
 onChange={() => toggleSilambam(fee.id, fee.active !== false)}
 color="green"
 />
 <span className="text-[10px] font-bold text-gray-400">
 {fee.active === false ? "Hidden" : "Visible"}
 </span>
 </div>
 <button
 onClick={() => setDeleteTarget(fee)}
 className="w-7 h-7 flex items-center justify-center rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
 title="Delete stage"
 >
 <Trash2 className="w-3.5 h-3.5" />
 </button>
 </div>

 {/* Stage icon + info */}
 <div className="flex flex-col items-center gap-2 py-3 border-y border-black/5">
 <div
 className="w-14 h-14 rounded-full flex items-center justify-center"
 style={{ border: `2px solid ${palette.color}`, background: palette.bg }}
 >
 <Trophy className="w-7 h-7" style={{ color: palette.color }} />
 </div>
 <p
 className="font-bold text-center"
 style={{ fontFamily: "'Bebas Neue', sans-serif", color: palette.color, letterSpacing: "1.5px", fontSize: "20px" }}
 >
 {fee.stageName}
 </p>
 <p className="text-2xl font-bold" style={{ color: palette.color }}>
 ₹{fee.fee.toLocaleString()}
 </p>
 <p className="text-[11px] text-gray-400">நிலை {fee.stageNumber}</p>
 </div>

 {/* Edit button */}
 <button
 onClick={() => { setEditing(fee.id); setEditData({ fee: fee.fee.toString(), stageName: fee.stageName }); }}
 className="mt-3 w-full flex items-center justify-center gap-2 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold transition-colors"
 >
 <Edit className="w-3.5 h-3.5" /> Edit Stage
 </button>
 </div>
 )}
 </div>
 );
 })}

 {/* Add Stage card (only visible if < 10 stages) */}
 {silamFees.length < 10 && (
 <button
 onClick={() => setShowAddModal(true)}
 className="rounded-xl border-2 border-dashed border-gray-300 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700 p-4 flex flex-col items-center justify-center gap-3 hover:border-green-400 hover:bg-green-50 transition-all group min-h-[220px]"
 >
 <div className="w-14 h-14 rounded-full border-2 border-dashed border-gray-300 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700 group-hover:border-green-400 flex items-center justify-center transition-colors">
 <Plus className="w-6 h-6 text-gray-400 group-hover:text-green-500 transition-colors" />
 </div>
 <div className="text-center">
 <p className="text-sm font-bold text-gray-400 group-hover:text-green-600 transition-colors" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "1px", fontSize: "17px" }}>
 ADD NEW STAGE
 </p>
 <p className="text-xs text-gray-400 mt-0.5">Click to create a new stage</p>
 </div>
 </button>
 )}
 </div>

 {silamFees.length === 0 && (
 <p className="text-center text-gray-400 py-8 text-sm">No stages yet. Click "Add Stage" to get started.</p>
 )}
 </>
 )}
 </>
 )}
 </div>

 {/* Summary panels */}
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 {currentProgram === "KARATE" ? (
 <>
 <InfoPanel color="blue" title="Fee Inclusions (Karate)" items={["✓ Belt test examination charges", "✓ Official certificate", "✓ New belt upon passing", "✓ Registration processing fee"]} />
 <SummaryPanel color="blue" title="Current Belt Fees" items={karateFees.map((f, i) => ({ label: `${i === 0 ? "White" : karateFees[i - 1].beltColor} → ${f.beltColor}`, value: `₹${f.fee.toLocaleString()}`, hidden: f.active === false }))} />
 </>
 ) : currentProgram === "SELAMBAM" ? (
 <>
 <InfoPanel color="green" title="Fee Inclusions (Silambam)" items={["✓ Stage examination charges", "✓ Official Silambam certificate", "✓ Stage progression recognition", "✓ Registration processing fee"]} />
 <SummaryPanel color="green" title="Current Stage Fees" items={silamFees.map(f => ({ label: f.stageName, value: `₹${f.fee.toLocaleString()}`, hidden: f.active === false }))} />
 </>
 ) : (
 <>
 <InfoPanel color="blue" title="Fee Inclusions (Karate)" items={["✓ Belt test examination charges", "✓ Official certificate", "✓ New belt upon passing", "✓ Registration processing fee"]} />
 <InfoPanel color="green" title="Fee Inclusions (Silambam)" items={["✓ Stage examination charges", "✓ Official Silambam certificate", "✓ Stage progression recognition", "✓ Registration processing fee"]} />
 </>
 )}
 </div>

 <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 dark:bg-zinc-900 dark:border-zinc-800">
 <h4 className="font-bold text-blue-800 mb-2 text-sm dark:text-zinc-100">Admin Notes</h4>
 <ul className="text-xs text-blue-700 space-y-1.5 dark:text-zinc-400">
 <li>• <strong>Silambam stages are fully flexible</strong> — add, rename, edit fee, hide, or delete any stage</li>
 <li>• Changes take effect <strong>immediately</strong> on the student registration page</li>
 <li>• Deleting a stage is <strong>permanent</strong>. Use the visibility toggle to temporarily hide a stage instead</li>
 <li>• <strong>Karate belt transitions</strong> are fixed — only the fee amount is editable</li>
 </ul>
 </div>
 </div>

 {/* Modals */}
 {deleteTarget && (
 <DeleteConfirmModal
 stageName={deleteTarget.stageName}
 onConfirm={confirmDelete}
 onCancel={() => setDeleteTarget(null)}
 loading={deleteLoading}
 />
 )}

 {showAddModal && (
 <AddStageModal
 totalStages={silamFees.length}
 onAdd={handleAddStage}
 onCancel={() => setShowAddModal(false)}
 />
 )}
 </AdminLayout>
 );
}

// ── Reusable sub-components ───────────────────────────────────────────────────

function LoadingSpinner({ color }: { color: "blue" | "green" }) {
 const cls = color === "blue" ? "border-blue-600" : "border-green-600";
 return (
 <div className="flex justify-center py-12">
 <div className={`w-10 h-10 border-4 ${cls} border-t-transparent rounded-full animate-spin`} />
 </div>
 );
}

function ToggleSwitch({ active, onChange, color }: { active: boolean; onChange: () => void; color: "blue" | "green" }) {
 const onColor = color === "blue" ? "bg-blue-500" : "bg-green-500";
 return (
 <button
 onClick={onChange}
 className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none ${active ? onColor : "bg-red-400"}`}
 role="switch"
 aria-checked={active}
 >
 <span className={`inline-block h-4 w-4 transform rounded-full bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 shadow-lg transition-transform duration-200 ${active ? "translate-x-6" : "translate-x-1"}`} />
 </button>
 );
}

function InfoPanel({ color, title, items }: { color: string; title: string; items: string[] }) {
 const cls = color === "blue" ? "bg-blue-50 border-blue-200 text-blue-800" : "bg-green-50 border-green-200 text-green-800";
 const itemCls = color === "blue" ? "text-blue-700" : "text-green-700";
 return (
 <div className={`border-2 rounded-lg p-4 ${cls} dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300`}>
 <h4 className="font-bold mb-2 text-sm dark:text-zinc-100">{title}</h4>
 <ul className={`text-xs space-y-1 ${itemCls} dark:text-zinc-400`}>{items.map((i, idx) => <li key={idx}>{i}</li>)}</ul>
 </div>
 );
}

function SummaryPanel({ color, title, items }: { color: string; title: string; items: { label: string; value: string; hidden?: boolean }[] }) {
 const cls = color === "blue" ? "bg-blue-50 border-blue-200 text-blue-800" : "bg-green-50 border-green-200 text-green-800";
 const itemCls = color === "blue" ? "text-blue-700" : "text-green-700";
 return (
 <div className={`border-2 rounded-lg p-4 ${cls} dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300`}>
 <h4 className="font-bold mb-2 text-sm dark:text-zinc-100">{title}</h4>
 <div className={`text-xs space-y-1 ${itemCls} dark:text-zinc-400`}>
 {items.map((item, idx) => (
 <p key={idx}>
 {idx + 1}. {item.label} <span className="font-semibold">({item.value})</span>
 {item.hidden && <span className="ml-1 text-[10px] font-bold text-red-500">[HIDDEN]</span>}
 </p>
 ))}
 {items.length === 0 && <p>No stages yet.</p>}
 </div>
 </div>
 );
}

