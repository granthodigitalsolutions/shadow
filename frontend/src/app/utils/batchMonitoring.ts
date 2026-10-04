import type { Batch, StudentRecord, BeltTest, School } from "../types/admin";
import type { ExamTransition } from "./examTransitions";

// Pure derivation for the Admin Batch Monitoring page. Everything comes from
// existing data: the batch document (maxSize, studentIds, allocatedCount,
// allocatedAssigned, status, refereeIds, examStartedAt ...) and the students
// assigned to it. Nothing is stored for reporting.
//
// Slot model (matches backend/src/utils/examinerBatch.js computeCapacity):
//   capacity         = maxSize (never reduced by allocations)
//   allocated        = slots examiners reserved (batch.allocatedCount)
//   assigned         = actual students in studentIds (unique)
//   allocatedFilled  = students added through allocations (batch.allocatedAssigned)
//   legacy           = students assigned outside an allocation (Admin / older flow)
//   unfilledAllocated= reserved slots with no student yet
//   availablePool    = capacity - allocated - legacy  (still free for any examiner)

export type ExamState = "pending" | "in_progress" | "completed";

export interface BatchRow {
  id: string;
  name: string;
  batch: Batch;
  schoolKey: string;
  schoolName: string;
  program: "KARATE" | "SELAMBAM";
  beltKey: string; // transition id, or `raw:<belt>`
  beltLabel: string;
  capacity: number;
  allocated: number;
  assigned: number;
  unfilledAllocated: number;
  availablePool: number;
  scored: number;
  progressPct: number;
  examState: ExamState;
  refereeAssigned: boolean;
  rawStatus: string;
  createdAt: string; // ISO or ""
  examDate: string; // yyyy-mm-dd or ""
  studentIds: string[];
}

export interface BatchTotals {
  batches: number;
  totalSlots: number;
  assignedStudents: number;
  availablePool: number;
  unfilledAllocated: number;
  allocatedSlots: number;
  pending: number;
  inProgress: number;
  completed: number;
  refereeAssigned: number;
}

const toIso = (v: any): string => {
  if (!v) return "";
  const d = typeof v?.toDate === "function" ? v.toDate() : new Date(v);
  return isNaN(d.getTime()) ? "" : d.toISOString();
};

export function deriveBatchRow(
  batch: Batch,
  studentsById: Map<string, StudentRecord>,
  tests: Map<string, BeltTest>,
  schools: Map<string, School>,
  karate: ExamTransition[],
  silambam: ExamTransition[],
  formatName: (b: Batch) => string,
): BatchRow {
  const b: any = batch;
  const ids = Array.isArray(b.studentIds) ? [...new Set<string>(b.studentIds)] : [];
  const assigned = ids.length;
  const capacity = Number.isInteger(b.maxSize) && b.maxSize >= 0 ? b.maxSize : assigned;
  const allocated = b.allocatedCount || 0;
  const legacy = Math.max(0, assigned - (b.allocatedAssigned || 0));
  const unfilledAllocated = Math.max(0, allocated - Math.min(allocated, (b.allocatedAssigned || 0)));
  const availablePool = Math.max(0, capacity - allocated - legacy);

  // Progress = assigned students that already have a result.
  const scored = ids.filter((id) => {
    const s = studentsById.get(id);
    return !!s && s.testStatus !== "pending" && !!s.testStatus;
  }).length;

  const forcedDone = b.status === "completed";
  const allScored = assigned > 0 && scored === assigned && assigned >= capacity;
  const started = scored > 0 || !!b.examStartedAt || !!b.startedAt;
  const examState: ExamState = forcedDone || allScored ? "completed" : started ? "in_progress" : "pending";

  const program: "KARATE" | "SELAMBAM" = b.programType === "SELAMBAM" ? "SELAMBAM" : "KARATE";
  const list = program === "KARATE" ? karate : silambam;
  const belt = b.belt != null ? String(b.belt) : "";
  const matched = belt
    ? program === "KARATE"
      ? list.find((t) => t.to === belt)
      : list.find((t) => String(t.stageNumber) === belt)
    : undefined;
  const test = tests.get(b.beltTestId);
  const school = schools.get(b.schoolId);
  const isIndividual = b.schoolId === "individual";

  return {
    id: b.id,
    // Exact transition in the name, also for batches generated before the name was stored.
    name: !matched || b.transitionLabel || (b.customName || "").trim() ? formatName(batch) : formatName({ ...batch, transitionLabel: matched.label } as any),
    batch,
    schoolKey: b.schoolId || "unknown",
    schoolName: isIndividual ? "Individual" : school?.name || "Unknown School",
    program,
    beltKey: matched ? matched.id : `raw:${belt}`,
    beltLabel: matched ? matched.label : belt ? (program === "SELAMBAM" ? `Stage ${belt}` : belt) : "Mixed / not set",
    capacity,
    allocated,
    assigned,
    unfilledAllocated,
    availablePool,
    scored,
    progressPct: assigned > 0 ? Math.round((scored / assigned) * 100) : 0,
    examState,
    refereeAssigned: Array.isArray(b.refereeIds) && b.refereeIds.length > 0,
    rawStatus: String(b.status || ""),
    createdAt: toIso(b.createdAt),
    examDate: test?.date ? String(test.date).slice(0, 10) : "",
    studentIds: ids,
  };
}

export function totalsOfBatches(rows: BatchRow[]): BatchTotals {
  const uniqueStudents = new Set<string>();
  const t: BatchTotals = {
    batches: rows.length, totalSlots: 0, assignedStudents: 0, availablePool: 0, unfilledAllocated: 0,
    allocatedSlots: 0, pending: 0, inProgress: 0, completed: 0, refereeAssigned: 0,
  };
  for (const r of rows) {
    t.totalSlots += r.capacity;
    t.availablePool += r.availablePool;
    t.unfilledAllocated += r.unfilledAllocated;
    t.allocatedSlots += r.allocated;
    r.studentIds.forEach((id) => uniqueStudents.add(id)); // a student is counted once even if listed twice
    if (r.examState === "pending") t.pending++;
    else if (r.examState === "in_progress") t.inProgress++;
    else t.completed++;
    if (r.refereeAssigned) t.refereeAssigned++;
  }
  t.assignedStudents = uniqueStudents.size;
  return t;
}

export interface BatchFilters {
  school: string;
  program: "all" | "KARATE" | "SELAMBAM";
  belt: string; // "all" | beltKey
  status: "all" | "pending" | "assigned" | "in_progress" | "completed";
  examDate: string; // "" | yyyy-mm-dd
  search: string;
}
export const DEFAULT_BATCH_FILTERS: BatchFilters = { school: "all", program: "all", belt: "all", status: "all", examDate: "", search: "" };

export function filterBatchRows(rows: BatchRow[], f: BatchFilters): BatchRow[] {
  const q = f.search.trim().toLowerCase();
  return rows.filter((r) => {
    if (f.school !== "all" && r.schoolKey !== f.school) return false;
    if (f.program !== "all" && r.program !== f.program) return false;
    if (f.belt !== "all" && r.beltKey !== f.belt) return false;
    if (f.status === "assigned" ? !r.refereeAssigned : f.status !== "all" && r.examState !== f.status) return false;
    if (f.examDate && r.examDate !== f.examDate) return false;
    if (!q) return true;
    return r.id.toLowerCase().includes(q) || r.name.toLowerCase().includes(q) || String(r.batch.code || "").includes(q);
  });
}
