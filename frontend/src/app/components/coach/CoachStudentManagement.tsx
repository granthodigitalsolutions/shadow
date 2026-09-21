import { useEffect, useState, useMemo } from "react";
import {
  Search, Edit2, Trash2, X, Save, AlertTriangle,
  CheckCircle, Users, RefreshCw, ChevronDown, Filter, School
} from "lucide-react";
import { firebaseStudentService } from "../../services/firebaseData";
import { firebaseAuthService } from "../../services/firebaseAuth";
import CoachLayout from "./CoachLayout";
import { useCoachSchool } from "../../contexts/CoachSchoolContext";
import { StudentRecord } from "../../types/admin";
import { belts } from "../../data";
import { useToast } from "../../hooks/useToast";

const STANDARD_OPTIONS = [
  'LKG','UKG','1st Standard','2nd Standard','3rd Standard','4th Standard',
  '5th Standard','6th Standard','7th Standard','8th Standard',
  '9th Standard','10th Standard','11th Standard','12th Standard',
  'College','Other'
];

export default function CoachStudentManagement() {
  const { mySchools, selectedSchool, setSelectedSchoolId } = useCoachSchool();
  const [students, setStudents]     = useState<StudentRecord[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [filterProgram, setFilterProgram] = useState<"ALL"|"KARATE"|"SELAMBAM">("ALL");
  const [filterStatus, setFilterStatus]   = useState<"ALL"|"verified"|"pending">("ALL");

  // Edit modal
  const [editStudent, setEditStudent] = useState<StudentRecord | null>(null);
  const [editForm, setEditForm]       = useState<Partial<StudentRecord>>({});
  const [saving, setSaving]           = useState(false);

  // Delete confirm
  const [deleteId, setDeleteId]   = useState<string | null>(null);
  const [deleting, setDeleting]   = useState(false);

  const { showToast } = useToast();

  // ── Load students ──────────────────────────────────────────────────────────
  useEffect(() => {
    const user = firebaseAuthService.getCurrentUser();
    if (!user) { setLoading(false); return; }

    const unsub = firebaseStudentService.listenByCoach(user.uid, (list) => {
      list.sort((a, b) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime());
      setStudents(list);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // ── Filtered list ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return students.filter(s => {
      const matchSchool = !selectedSchool || s.schoolId === selectedSchool.id;
      const q = search.toLowerCase();
      const matchSearch =
        s.name?.toLowerCase().includes(q) ||
        s.school?.toLowerCase().includes(q) ||
        (s.id || '').toLowerCase().includes(q) ||
        s.contact?.includes(q);
      const matchProgram =
        filterProgram === "ALL" ||
        (s.programType || '').toUpperCase() === filterProgram;
      const matchStatus =
        filterStatus === "ALL" ||
        (filterStatus === "verified" ? s.paymentStatus === "verified" : s.paymentStatus !== "verified");
      return matchSchool && matchSearch && matchProgram && matchStatus;
    });
  }, [students, search, filterProgram, filterStatus, selectedSchool]);

  // ── Edit ───────────────────────────────────────────────────────────────────
  const openEdit = (s: StudentRecord) => {
    setEditStudent(s);
    setEditForm({
      name:        s.name,
      gender:      s.gender,
      standard:    s.standard,
      contact:     s.contact,
      whatsapp:    s.whatsapp,
      school:      s.school,
      schoolId:    s.schoolId,
      beltIndex:   s.beltIndex,
      beltLevel:   s.beltLevel,
      stageLevel:  s.stageLevel,
    });
  };

  const handleEditChange = (field: string, value: any) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
    // Auto-update beltLevel when beltIndex changes
    if (field === 'beltIndex') {
      const belt = belts[Number(value)];
      if (belt) setEditForm(prev => ({ ...prev, beltIndex: Number(value), beltLevel: belt.to }));
    }
  };

  const handleSave = async () => {
    if (!editStudent?.id) return;
    setSaving(true);
    try {
      await firebaseStudentService.update(editStudent.id, editForm as any);
      showToast(`✅ ${editForm.name} updated successfully`, "success");
      setEditStudent(null);
    } catch (e: any) {
      showToast(`❌ Failed to update: ${e.message}`, "error");
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await firebaseStudentService.delete(deleteId);
      showToast("🗑️ Student deleted successfully", "success");
      setDeleteId(null);
    } catch (e: any) {
      showToast(`❌ Failed to delete: ${e.message}`, "error");
    } finally {
      setDeleting(false);
    }
  };

  const studentToDelete = students.find(s => s.id === deleteId);

  // ── UI ─────────────────────────────────────────────────────────────────────
  return (
    <CoachLayout>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-950 dark:text-white" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
              STUDENT MANAGEMENT
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
              {filtered.length} of {students.length} students
              {selectedSchool ? ` at ${selectedSchool.name}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 px-3 py-1.5 rounded-lg">
              MY REGISTRATIONS ONLY
            </span>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Search by name, school, ID, contact..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
            />
          </div>

          {/* School filter */}
          <div className="relative">
            <School className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
            <select
              value={selectedSchool?.id || ""}
              onChange={e => setSelectedSchoolId(e.target.value)}
              className="pl-9 pr-8 py-2.5 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 appearance-none cursor-pointer w-full max-w-xs"
            >
              <option value="">All Schools</option>
              {mySchools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
          </div>

          {/* Program filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
            <select
              value={filterProgram}
              onChange={e => setFilterProgram(e.target.value as any)}
              className="pl-9 pr-8 py-2.5 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 appearance-none cursor-pointer"
            >
              <option value="ALL">All Programs</option>
              <option value="KARATE">Karate</option>
              <option value="SELAMBAM">Silambam</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
          </div>

          {/* Status filter */}
          <div className="relative">
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value as any)}
              className="px-4 pr-8 py-2.5 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 appearance-none cursor-pointer"
            >
              <option value="ALL">All Status</option>
              <option value="verified">Verified</option>
              <option value="pending">Pending</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
              <Users className="w-12 h-12 mb-3 opacity-40" />
              <p className="font-semibold">No students found</p>
              <p className="text-sm mt-1">Try adjusting your search or filters</p>
            </div>
          ) : (
            <div className="w-full">
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-50 dark:bg-zinc-900/60 border-b border-zinc-200 dark:border-zinc-800 text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-bold">
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3">School</th>
                    <th className="px-4 py-3">Program / Belt</th>
                    <th className="px-4 py-3">Contact</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Fee</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 text-sm">
                  {filtered.map(student => (
                    <tr key={student.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-900/40 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-bold text-zinc-900 dark:text-white">{student.name}</div>
                        <div className="text-xs text-zinc-400 font-mono">{(student.id || '').slice(-8).toUpperCase()}</div>
                        <div className="text-xs text-zinc-500">{student.standard}</div>
                      </td>
                      <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{student.school || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-md mb-1 ${
                          (student.programType || '').toUpperCase() === 'KARATE'
                            ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400'
                            : 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400'
                        }`}>
                          {(student.programType || 'N/A').toUpperCase()}
                        </span>
                        <div className="text-xs text-zinc-500">{student.beltLevel || student.stageLevel || '—'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-zinc-800 dark:text-zinc-200">{student.contact || '—'}</div>
                        {student.whatsapp && student.whatsapp !== student.contact && (
                          <div className="text-xs text-zinc-400">WA: {student.whatsapp}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1.5 items-start">
                          {student.paymentStatus === 'verified' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-bold border border-emerald-200 dark:border-emerald-500/20">
                              <CheckCircle className="w-3 h-3" /> Verified
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 text-xs font-bold border border-blue-200 dark:border-blue-500/20">
                              <AlertTriangle className="w-3 h-3" /> Pending
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-zinc-800 dark:text-zinc-200">
                        {student.paymentDetails?.amount ? `₹${student.paymentDetails.amount.toLocaleString()}` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openEdit(student)}
                            className="p-2 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors"
                            title="Edit student"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteId(student.id || '')}
                            className="p-2 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
                            title="Delete student"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>

              {/* Mobile Card View */}
              <div className="grid grid-cols-1 gap-4 md:hidden">
                {filtered.map(student => (
                  <div key={student.id} className="bg-white dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-zinc-900 dark:text-white text-lg">{student.name}</div>
                        <div className="text-xs text-zinc-400 font-mono mt-0.5">{(student.id || '').toUpperCase()}</div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <div className="flex items-center gap-2">
                          {student.paymentStatus === 'verified' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase tracking-wider">
                              <CheckCircle className="w-3 h-3" />
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold uppercase tracking-wider">
                              <AlertTriangle className="w-3 h-3" />
                            </span>
                          )}
                          <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            (student.programType || '').toUpperCase() === 'KARATE'
                              ? 'bg-red-50 text-red-600'
                              : 'bg-blue-50 text-blue-600'
                          }`}>
                            {(student.programType || 'N/A').slice(0, 3)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-y-2 text-sm">
                      <div>
                        <p className="text-xs text-zinc-500 uppercase tracking-wider font-bold mb-0.5">School</p>
                        <p className="font-medium text-zinc-800 dark:text-zinc-200 truncate">{student.school || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500 uppercase tracking-wider font-bold mb-0.5">Belt/Stage</p>
                        <p className="font-medium text-zinc-800 dark:text-zinc-200 truncate">{student.beltLevel || student.stageLevel || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500 uppercase tracking-wider font-bold mb-0.5">Contact</p>
                        <p className="font-medium text-zinc-800 dark:text-zinc-200">{student.contact || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500 uppercase tracking-wider font-bold mb-0.5">Fee Paid</p>
                        <p className="font-medium text-zinc-800 dark:text-zinc-200">{student.paymentDetails?.amount ? `,1${student.paymentDetails.amount}` : 'N/A'}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 mt-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                      <button
                        onClick={() => openEdit(student)}
                        className="flex-1 py-2 flex items-center justify-center gap-2 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold transition-colors"
                      >
                        <Edit2 className="w-4 h-4" /> Edit
                      </button>
                      <button
                        onClick={() => setDeleteId(student.id || '')}
                        className="flex-1 py-2 flex items-center justify-center gap-2 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 font-bold transition-colors"
                      >
                        <Trash2 className="w-4 h-4" /> Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── EDIT MODAL ───────────────────────────────────────────────────────── */}
      {editStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-950 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-zinc-200 dark:border-zinc-800">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-5 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 bg-white dark:bg-zinc-950 z-10">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
                  <Edit2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h2 className="font-bold text-zinc-900 dark:text-white">Edit Student</h2>
                  <p className="text-xs text-zinc-400">{editStudent.name}</p>
                </div>
              </div>
              <button onClick={() => setEditStudent(null)} className="p-2 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <div className="p-5 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">Full Name *</label>
                <input
                  type="text"
                  value={editForm.name || ''}
                  onChange={e => handleEditChange('name', e.target.value)}
                  className="w-full px-3 py-2.5 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                />
              </div>

              {/* Gender & Standard */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">Gender</label>
                  <select
                    value={editForm.gender || ''}
                    onChange={e => handleEditChange('gender', e.target.value)}
                    className="w-full px-3 py-2.5 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  >
                    <option value="">Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">Standard</label>
                  <select
                    value={editForm.standard || ''}
                    onChange={e => handleEditChange('standard', e.target.value)}
                    className="w-full px-3 py-2.5 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  >
                    <option value="">Select</option>
                    {STANDARD_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {/* Contact & WhatsApp */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">Contact</label>
                  <input
                    type="tel"
                    value={editForm.contact || ''}
                    onChange={e => handleEditChange('contact', e.target.value)}
                    className="w-full px-3 py-2.5 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">WhatsApp</label>
                  <input
                    type="tel"
                    value={editForm.whatsapp || ''}
                    onChange={e => handleEditChange('whatsapp', e.target.value)}
                    className="w-full px-3 py-2.5 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>
              </div>

              {/* School */}
              <div>
                <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">School</label>
                <select
                  value={editForm.schoolId || ''}
                  onChange={e => {
                    const school = mySchools.find(s => s.id === e.target.value);
                    handleEditChange('schoolId', e.target.value);
                    handleEditChange('school', school?.name || '');
                  }}
                  className="w-full px-3 py-2.5 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                >
                  <option value="">Select School</option>
                  {mySchools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              {/* Karate belt */}
              {(editStudent.programType || '').toUpperCase() === 'KARATE' && (
                <div>
                  <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">Belt Level</label>
                  <select
                    value={editForm.beltIndex ?? ''}
                    onChange={e => handleEditChange('beltIndex', Number(e.target.value))}
                    className="w-full px-3 py-2.5 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  >
                    <option value="">Select Belt</option>
                    {belts.map((b, i) => (
                      <option key={i} value={i}>{b.from} → {b.to}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Silambam stage */}
              {(editStudent.programType || '').toUpperCase() === 'SELAMBAM' && (
                <div>
                  <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">Stage Level</label>
                  <input
                    type="number"
                    min="1"
                    value={editForm.stageLevel || ''}
                    onChange={e => handleEditChange('stageLevel', Number(e.target.value))}
                    className="w-full px-3 py-2.5 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>
              )}
            </div>

            {/* Footer buttons */}
            <div className="p-5 border-t border-zinc-200 dark:border-zinc-800 flex gap-3">
              <button
                onClick={() => setEditStudent(null)}
                className="flex-1 px-4 py-2.5 text-sm font-bold border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-4 py-2.5 text-sm font-bold bg-blue-500 hover:bg-blue-600 text-zinc-950 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRM MODAL ─────────────────────────────────────────────── */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-950 rounded-2xl shadow-2xl w-full max-w-sm border border-zinc-200 dark:border-zinc-800 p-6">
            <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-7 h-7 text-red-500" />
            </div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white text-center mb-1">Delete Student?</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center mb-6">
              <span className="font-bold text-zinc-700 dark:text-zinc-300">{studentToDelete?.name}</span> will be permanently removed. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 px-4 py-2.5 text-sm font-bold border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 text-sm font-bold bg-red-500 hover:bg-red-600 text-white rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </CoachLayout>
  );
}
