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

  // Generated batches carry their exact transition: "Karate — White → Yellow".
  // An admin-given custom name still wins; old batches keep "Batch #X".
  const transitionLabel = (batch as any).transitionLabel as string | undefined;
  if (transitionLabel && !(batch.customName || "").trim()) {
    const named = `${programLabel} — ${transitionLabel}`;
    return isIndividual ? `${named} - Individual` : named;
  }

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

  const transitionLabel = (batch as any).transitionLabel as string | undefined;
  if (transitionLabel && !(batch.customName || "").trim()) {
    const named = `${programLabel} — ${transitionLabel}`;
    return isIndividual ? `${named} I` : named;
  }

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

// The deployed site. A QR printed from a developer machine must never point at
// localhost or a private address, so those fall back to this domain. Set
// VITE_PUBLIC_APP_URL to override it (e.g. for a staging site).
const DEPLOYED_ORIGIN = "https://teamshadowkai.com";
const isNonPublicOrigin = (o: string) =>
  /^https?:\/\/(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|[^/]*\.local)/i.test(o) || !/^https:/i.test(o);

export const publicAppOrigin = (): string => {
  const configured = (import.meta as any).env?.VITE_PUBLIC_APP_URL as string | undefined;
  if (configured) return configured.replace(/\/+$/, "");
  const here = typeof window !== "undefined" ? window.location.origin : "";
  return here && !isNonPublicOrigin(here) ? here : DEPLOYED_ORIGIN;
};

/**
 * What a Batch QR encodes: a link to the Examiner entry route on the deployed
 * HTTPS domain, naming the intended batch (stable id) and carrying that
 * batch's access code. There is no password or permanent credential in it: the
 * server checks the code belongs to that very batch and then issues a
 * short-lived signed session. Regenerating the batch code revokes old QRs.
 */
export const batchQrUrl = (code: string, batchId?: string): string => {
  const params = new URLSearchParams();
  if (batchId) params.set("batchId", batchId);
  params.set("code", code);
  return `${publicAppOrigin()}/examiner/scan?${params.toString()}`;
};
