import { Batch } from "../types/admin";

/**
 * Formats batch name with program type and individual indicator
 * Examples:
 * - School batch: "Batch #1 (Karate)"
 * - School batch with custom name: "Morning Session (Karate)"
 * - Individual batch: "Batch #1 (Karate) - Individual"
 * - Individual batch with custom name: "Advanced Group (Karate) - Individual"
 */
export function formatBatchName(batch: Batch): string {
  const batchNumber = batch.batchNumber || 0;
  const programLabel = batch.programType === "SELAMBAM" ? "Silambam" : "Karate";
  const isIndividual = batch.schoolId === "individual";

  // Use custom name if provided, otherwise use default "Batch #X"
  const baseName = (batch.customName || "").trim() || `Batch #${batchNumber}`;

  if (isIndividual) {
    return `${baseName} (${programLabel}) - Individual`;
  }

  return `${baseName} (${programLabel})`;
}

/**
 * Formats batch name with short individual indicator
 * Examples:
 * - School batch: "Batch #1 (Karate)"
 * - School batch with custom name: "Morning Session (Karate)"
 * - Individual batch: "Batch #1 (Karate) I"
 * - Individual batch with custom name: "Advanced Group (Karate) I"
 */
export function formatBatchNameShort(batch: Batch): string {
  const batchNumber = batch.batchNumber || 0;
  const programLabel = batch.programType === "SELAMBAM" ? "Silambam" : "Karate";
  const isIndividual = batch.schoolId === "individual";

  // Use custom name if provided, otherwise use default "Batch #X"
  const baseName = (batch.customName || "").trim() || `Batch #${batchNumber}`;

  if (isIndividual) {
    return `${baseName} (${programLabel}) I`;
  }

  return `${baseName} (${programLabel})`;
}

/**
 * Gets program label from program type
 */
export function getProgramLabel(programType: "KARATE" | "SELAMBAM"): string {
  return programType === "SELAMBAM" ? "Silambam" : "Karate";
}

/**
 * Safely format a date that might be a Firebase Timestamp or string
 */
export function formatSafeDate(dateVal: any): string {
  if (!dateVal) return "Invalid Date";
  if (typeof dateVal === 'object') {
    if ('seconds' in dateVal) {
      return new Date(dateVal.seconds * 1000).toLocaleDateString();
    }
    if ('toDate' in dateVal && typeof dateVal.toDate === 'function') {
      return dateVal.toDate().toLocaleDateString();
    }
  }
  const parsed = new Date(dateVal);
  if (isNaN(parsed.getTime())) return "Invalid Date";
  return parsed.toLocaleDateString();
}

