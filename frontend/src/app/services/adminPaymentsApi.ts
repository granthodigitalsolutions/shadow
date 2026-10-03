import { auth } from "../config/firebase";
import { fetchJson } from "../utils/apiFetch";

// Admin payment review goes through the backend (POST /api/admin/payments):
// it verifies the caller is an Admin, re-checks every student's payment state
// inside a transaction, writes an audit entry per student, and reports each
// student's outcome. The browser never decides eligibility on its own.

export type ReviewAction = "confirm" | "reject";

export interface ReviewResult {
  studentId: string;
  outcome: "updated" | "skipped" | "failed";
  reason?: string;
}

export interface ReviewOutcome {
  action: ReviewAction;
  counts: { updated: number; skipped: number; failed: number };
  results: ReviewResult[];
  partial: boolean;
}

export const REVIEW_REASON_LABELS: Record<string, string> = {
  already_confirmed: "already confirmed",
  already_rejected: "already rejected",
  already_processed: "already processed by this request",
  missing_fee: "no registration fee stored",
  not_found: "student not found",
  transaction_error: "could not be saved - try again",
};

export async function reviewAdminPayments(
  action: ReviewAction,
  studentIds: string[],
  requestId: string,
  reason?: string,
): Promise<ReviewOutcome> {
  const user = auth.currentUser;
  if (!user) throw new Error("You must be signed in as an admin.");
  const token = await user.getIdToken();

  const { ok, status, data } = await fetchJson<any>(`${import.meta.env.VITE_API_BASE_URL}/api/admin/payments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action, studentIds, requestId, reason }),
  });

  if (!ok || !data?.success) {
    const message = data?.error?.message || data?.message;
    if (status === 401) throw new Error(message || "Your session expired. Please sign in again.");
    if (status === 403) throw new Error("You don't have permission to review payments.");
    throw new Error(message || "The payment update failed. Nothing was changed - please try again.");
  }
  return { action: data.action, counts: data.counts, results: data.results, partial: !!data.partial };
}
