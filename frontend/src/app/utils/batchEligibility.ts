import { StudentRecord } from "../types/admin";

export interface EligibilityParams {
  targetSchoolId: string;
  isIndividual: boolean;
  beltTestId: string;
  belt: string;
}

/**
 * Single source of truth for "Generate Batch" eligibility.
 *
 * A student is eligible when ALL of these hold:
 * - School match: for individual batches, registrationType === 'individual';
 *   otherwise, schoolId === params.targetSchoolId.
 * - beltTestId matches the selected Belt Test.
 * - Belt/stage matches the selected belt (beltLevel for Karate, stageLevel for Silambam).
 * - paymentStatus is 'verified'.
 * - Student is not already enrolled in any batch (batchId === null).
 *
 * Used both for the live "eligible students" count shown while the Admin picks
 * filters, and for the actual list of students enrolled when a batch is generated.
 */
export function filterEligibleStudents(
  allStudents: StudentRecord[],
  params: EligibilityParams,
): StudentRecord[] {
  const { targetSchoolId, isIndividual, beltTestId, belt } = params;

  return allStudents.filter((student) => {
    const schoolMatches = isIndividual
      ? student.registrationType === "individual"
      : student.schoolId === targetSchoolId;

    if (!schoolMatches) return false;
    if (student.beltTestId !== beltTestId) return false;

    const studentBelt = student.beltLevel || student.stageLevel?.toString();
    if (studentBelt !== belt) return false;

    if (student.paymentStatus !== "verified") return false;
    if (student.batchId !== null) return false;

    return true;
  });
}
