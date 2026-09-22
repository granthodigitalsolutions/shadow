// Volumes split a batch's students into fixed-size, position-based groups
// (Volume 1 = students 1-10, Volume 2 = 11-20, ...) so result PDFs / WhatsApp
// messages are produced a few at a time instead of the whole batch at once.
// Pure helpers only — the WhatsApp sender supplies the student predicates.

export const VOLUME_SIZE = 10;

export interface ResultVolume<T> {
  /** 1-based volume number (Volume 1, Volume 2, ...). */
  number: number;
  /** 1-based position of the volume's first student in the batch (e.g. 21). */
  start: number;
  /** 1-based position of the volume's last student in the batch (e.g. 30). */
  end: number;
  /** The student records that belong to this volume. */
  students: T[];
}

/**
 * Splits items into consecutive volumes of `size`. The count is always
 * ceil(items / size), so the last volume simply holds the remainder and an
 * empty list yields no volumes at all.
 */
export function buildVolumes<T>(items: T[], size: number = VOLUME_SIZE): ResultVolume<T>[] {
  const chunk = Math.max(1, Math.floor(size));
  const count = Math.ceil(items.length / chunk);
  return Array.from({ length: count }, (_, i) => {
    const offset = i * chunk;
    const students = items.slice(offset, offset + chunk);
    return { number: i + 1, start: offset + 1, end: offset + students.length, students };
  });
}

/**
 * Orders a batch's students by the batch's own (immutable) `studentIds` list,
 * then appends any student that has this batchId but isn't in that list, sorted
 * by id. Keeps each student's position — and so their volume — stable across
 * reloads and realtime snapshot updates.
 */
export function orderStudentsByBatch<T extends { id: string }>(
  orderedIds: string[] | undefined,
  students: T[],
): T[] {
  const byId = new Map(students.map((s) => [s.id, s]));
  const seen = new Set<string>();
  const ordered: T[] = [];
  (orderedIds ?? []).forEach((id) => {
    const s = byId.get(id);
    if (s && !seen.has(id)) {
      seen.add(id);
      ordered.push(s);
    }
  });
  students
    .filter((s) => !seen.has(s.id))
    .sort((a, b) => a.id.localeCompare(b.id))
    .forEach((s) => ordered.push(s));
  return ordered;
}

export type VolumeStatus =
  | 'not_scored' // nobody in the volume has a result yet — nothing to generate
  | 'pending' // scored students exist, none processed yet
  | 'partial' // some generated / processed / failed, not everything done
  | 'failed' // every scored student failed
  | 'completed'; // every scored student has a current PDF and a queued/sent message

export interface VolumePredicates<T> {
  /** Has a graded result (pass/fail) — only these can get a result PDF. */
  isScored: (s: T) => boolean;
  /** Current PDF AND WhatsApp message already queued/sent/delivered/read. */
  isFullyProcessed: (s: T) => boolean;
  /** Has an up-to-date result PDF in storage. */
  hasCurrentPdf: (s: T) => boolean;
  /** PDF generation or WhatsApp delivery failed for this student. */
  isFailed: (s: T) => boolean;
}

export interface VolumeSummary {
  total: number;
  scored: number;
  notScored: number;
  /** Students with a current PDF. */
  generated: number;
  /** Students fully done: PDF current and message queued/sent. */
  processed: number;
  failed: number;
  /** Scored students still needing work (not fully processed). */
  remaining: number;
  status: VolumeStatus;
}

export function summarizeVolume<T>(volume: ResultVolume<T>, p: VolumePredicates<T>): VolumeSummary {
  const total = volume.students.length;
  const scoredStudents = volume.students.filter(p.isScored);
  const scored = scoredStudents.length;
  const generated = scoredStudents.filter(p.hasCurrentPdf).length;
  const processed = scoredStudents.filter(p.isFullyProcessed).length;
  const failed = scoredStudents.filter(p.isFailed).length;

  let status: VolumeStatus;
  if (scored === 0) status = 'not_scored';
  else if (processed === scored) status = 'completed';
  else if (failed === scored) status = 'failed';
  else if (processed > 0 || failed > 0 || generated > 0) status = 'partial';
  else status = 'pending';

  return {
    total,
    scored,
    notScored: total - scored,
    generated,
    processed,
    failed,
    remaining: scored - processed,
    status,
  };
}
