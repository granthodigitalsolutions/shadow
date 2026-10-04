import { useEffect, useMemo, useState } from "react";
import { X, Save, Loader2, AlertCircle } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "../../config/firebase";
import { firebaseSchoolService, firebaseStudentService, firebaseBeltTestService } from "../../services/firebaseData";
import { useExamTransitions } from "../../hooks/useExamTransitions";
import { transitionFilterOptions, ExamTransition } from "../../utils/examTransitions";
import { formatINR } from "../../utils/paymentReport";
import type { School, BeltTest } from "../../types/admin";

interface Props {
  /** The Admin area the page is in ("ALL" lets the admin pick the program). */
  currentProgram: "KARATE" | "SELAMBAM" | "ALL";
  onClose: () => void;
  onCreated: (name: string) => void;
}

const STANDARDS = [
  "LKG", "UKG", "1st Standard", "2nd Standard", "3rd Standard", "4th Standard", "5th Standard", "6th Standard",
  "7th Standard", "8th Standard", "9th Standard", "10th Standard", "11th Standard", "12th Standard", "College", "Other",
];

const input =
  "w-full px-4 py-2.5 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 placeholder-zinc-400 border border-zinc-300 dark:border-zinc-700 rounded-xl text-sm font-medium focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";
const label = "block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5";

// Admin-side student creation. Produces the same record shape the coach Bulk
// Registration writes (including the exact transition and its configured fee),
// so the student behaves identically in batches, payments and reports.
export default function AdminAddStudentModal({ currentProgram, onClose, onCreated }: Props) {
  const { karate, silambam, loading: transitionsLoading, error: transitionsError } = useExamTransitions();

  const [program, setProgram] = useState<"KARATE" | "SELAMBAM">(currentProgram === "SELAMBAM" ? "SELAMBAM" : "KARATE");
  const [regType, setRegType] = useState<"school" | "individual">("school");
  const [schools, setSchools] = useState<School[]>([]);
  const [activeTest, setActiveTest] = useState<BeltTest | null>(null);
  const [testChecked, setTestChecked] = useState(false);

  const [schoolId, setSchoolId] = useState("");
  const [name, setName] = useState("");
  const [gender, setGender] = useState("");
  const [standard, setStandard] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [contact, setContact] = useState("");
  const [transitionKey, setTransitionKey] = useState("");
  const [paid, setPaid] = useState<"pending" | "verified">("pending");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    firebaseSchoolService.getActive(program).then(setSchools).catch(() => setSchools([]));
  }, [program]);

  useEffect(() => {
    setTestChecked(false);
    setTransitionKey("");
    setSchoolId("");
    firebaseBeltTestService
      .getActive(program)
      .then((t) => setActiveTest(t))
      .catch(() => setActiveTest(null))
      .finally(() => setTestChecked(true));
  }, [program]);

  const options = useMemo(() => transitionFilterOptions(program, karate, silambam), [program, karate, silambam]);
  const transition: ExamTransition | undefined = useMemo(
    () => (program === "KARATE" ? karate : silambam).find((t) => t.id === transitionKey),
    [program, karate, silambam, transitionKey],
  );

  const validate = (): string | null => {
    if (!activeTest) return "There is no active belt test for this program. Activate one first (Belt Tests).";
    if (!name.trim()) return "Student name is required.";
    if (regType === "school" && !schoolId) return "Select a school (or choose Individual).";
    if (!gender) return "Select a gender.";
    if (!standard) return "Select a standard.";
    if (!/^\d{10}$/.test(whatsapp)) return "Parent WhatsApp must be exactly 10 digits.";
    if (contact && !/^\d{10}$/.test(contact)) return "Student mobile must be exactly 10 digits (or leave it empty).";
    if (!transition) return "Select the belt/stage transition.";
    if (!transition.feeConfigured) return "No fee is configured for this transition. Set it in Fees first.";
    return null;
  };

  const handleSave = async () => {
    const problem = validate();
    if (problem) { setError(problem); return; }
    if (saving || !transition || !activeTest) return;
    setSaving(true);
    setError(null);
    try {
      const adminUid = auth.currentUser?.uid;
      if (!adminUid) throw new Error("You must be signed in as an admin.");

      // Unique registration id (same SKT-year-5digits pattern as the coach flow).
      let id = "";
      for (let i = 0; i < 6 && !id; i++) {
        const candidate = `SKT-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
        if (!(await getDoc(doc(db, "students", candidate))).exists()) id = candidate;
      }
      if (!id) throw new Error("Could not generate a unique registration id. Please try again.");

      const school = schools.find((s) => s.id === schoolId);
      const isKarate = program === "KARATE";
      const record: any = {
        id,
        name: name.trim(),
        gender,
        registrationType: regType,
        schoolId: regType === "individual" ? "individual" : schoolId,
        school: regType === "individual" ? "Individual" : school ? (school.branch ? `${school.name} - ${school.branch}` : school.name) : "",
        standard,
        contact: contact ? `+91${contact}` : "",
        whatsapp: `+91${whatsapp}`,
        programType: program,
        program: program.toLowerCase(),
        // Same stored values as the coach flow: the exam's target belt/stage, plus the exact transition.
        beltLevel: isKarate ? transition.to : "",
        beltIndex: isKarate ? Math.max(0, (transition.order || 1) - 1) : 0,
        stageLevel: isKarate ? undefined : transition.stageNumber,
        examTransition: { from: transition.from, to: transition.to, feeId: transition.id },
        beltTestId: activeTest.id,
        batchId: null,
        refereeId: null,
        testStatus: "pending",
        paymentStatus: paid,
        qrUrl: "",
        addedByAdmin: adminUid,
        paymentDetails: {
          amount: transition.fee, // the configured fee - never typed in by hand
          method: "Admin entry",
          transactionId: "",
          paymentDate: new Date().toISOString(),
          testDate: activeTest.date || "",
          testTime: activeTest.time || "",
          ...(paid === "verified" ? { confirmationType: "admin_manual" } : {}),
        },
      };
      if (paid === "verified") {
        record.confirmedBy = adminUid;
        record.confirmedAt = new Date();
      }
      Object.keys(record).forEach((k) => record[k] === undefined && delete record[k]);

      await firebaseStudentService.add(record);
      onCreated(record.name);
      onClose();
    } catch (e: any) {
      console.error("Admin add student failed:", e);
      setError(e?.message || "Could not save the student. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-zinc-950/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-950 rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden border border-zinc-200 dark:border-zinc-800">
        <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-900">
          <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-50">Add Student</h3>
          <button onClick={onClose} disabled={saving} aria-label="Close" className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 disabled:opacity-40"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl text-sm font-semibold bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/50">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
            </div>
          )}
          {transitionsError && <p className="text-sm text-red-600">{transitionsError}</p>}
          {testChecked && !activeTest && (
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">No active belt test for {program === "KARATE" ? "Karate" : "Silambam"} - activate one before adding students.</p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {currentProgram === "ALL" && (
              <div>
                <label className={label}>Program</label>
                <select value={program} onChange={(e) => setProgram(e.target.value as any)} className={input}>
                  <option value="KARATE">Karate</option>
                  <option value="SELAMBAM">Silambam</option>
                </select>
              </div>
            )}
            <div>
              <label className={label}>Registration type</label>
              <select value={regType} onChange={(e) => setRegType(e.target.value as any)} className={input}>
                <option value="school">School student</option>
                <option value="individual">Individual</option>
              </select>
            </div>
            {regType === "school" && (
              <div className="sm:col-span-2">
                <label className={label}>School *</label>
                <select value={schoolId} onChange={(e) => setSchoolId(e.target.value)} className={input}>
                  <option value="">Select school</option>
                  {schools.map((s) => <option key={s.id} value={s.id}>{s.branch ? `${s.name} - ${s.branch}` : s.name}</option>)}
                </select>
              </div>
            )}
            <div className="sm:col-span-2">
              <label className={label}>Student name *</label>
              <input type="text" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} placeholder="Full name" className={input} />
            </div>
            <div>
              <label className={label}>Gender *</label>
              <select value={gender} onChange={(e) => setGender(e.target.value)} className={input}>
                <option value="">Select</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
            <div>
              <label className={label}>Standard *</label>
              <select value={standard} onChange={(e) => setStandard(e.target.value)} className={input}>
                <option value="">Select</option>
                {STANDARDS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>Parent WhatsApp *</label>
              <div className="flex">
                <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 text-sm">+91</span>
                <input type="tel" inputMode="numeric" maxLength={10} value={whatsapp} onChange={(e) => setWhatsapp(e.target.value.replace(/\D/g, ""))} placeholder="10 digits" className={`${input} rounded-l-none`} />
              </div>
            </div>
            <div>
              <label className={label}>Student mobile <span className="normal-case font-medium text-zinc-400">(optional)</span></label>
              <div className="flex">
                <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 text-sm">+91</span>
                <input type="tel" inputMode="numeric" maxLength={10} value={contact} onChange={(e) => setContact(e.target.value.replace(/\D/g, ""))} placeholder="Optional" className={`${input} rounded-l-none`} />
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className={label}>{program === "KARATE" ? "Belt transition" : "Stage transition"} *</label>
              <select value={transitionKey} onChange={(e) => setTransitionKey(e.target.value)} disabled={transitionsLoading} className={input}>
                <option value="">{transitionsLoading ? "Loading..." : "Select transition"}</option>
                {options.map((o) => {
                  const t = (program === "KARATE" ? karate : silambam).find((x) => x.id === o.key);
                  return <option key={o.key} value={o.key} disabled={!t?.feeConfigured}>{o.label}{t?.feeConfigured ? ` - ${formatINR(t.fee)}` : " - fee not set"}</option>;
                })}
              </select>
              {transition?.feeConfigured && <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-1.5">Registration fee: {formatINR(transition.fee)}</p>}
            </div>
            <div className="sm:col-span-2">
              <label className={label}>Payment status</label>
              <select value={paid} onChange={(e) => setPaid(e.target.value as any)} className={input}>
                <option value="pending">Pending - not yet paid</option>
                <option value="verified">Confirmed - payment received (admin confirmation)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-3">
          <button onClick={onClose} disabled={saving} className="px-5 py-2.5 text-sm font-bold text-zinc-600 dark:text-zinc-300 rounded-xl disabled:opacity-40">Cancel</button>
          <button onClick={handleSave} disabled={saving || !activeTest} className="px-5 py-2.5 text-sm font-bold bg-blue-500 hover:bg-blue-600 text-zinc-950 rounded-xl flex items-center gap-2 disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Add Student
          </button>
        </div>
      </div>
    </div>
  );
}
