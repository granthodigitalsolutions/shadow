import { useMemo, useRef, useState } from "react";
import { X, CheckCircle2, XCircle, CheckSquare, Square, RefreshCw, AlertCircle } from "lucide-react";
import { useDialog } from "../../contexts/DialogContext";
import { RegistrationGroup, PaymentRow, formatINR, isEligibleForPayment, statusLabel } from "../../utils/paymentReport";
import { ReviewAction, ReviewOutcome, REVIEW_REASON_LABELS } from "../../services/adminPaymentsApi";

interface Props {
  group: RegistrationGroup;
  /** Runs the review on the backend. Throws on a request-level failure. */
  onReview: (action: ReviewAction, ids: string[], requestId: string, reason?: string) => Promise<ReviewOutcome>;
  onClose: () => void;
}

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
};

const badge = (s: PaymentRow["status"]) =>
  s === "verified"
    ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20"
    : s === "rejected"
    ? "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20"
    : "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20";

export default function PaymentGroupModal({ group, onReview, onClose }: Props) {
  const { showConfirm } = useDialog();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<ReviewOutcome | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  // Reused when the same action is retried after a network failure, so the
  // backend applies it at most once.
  const requestRef = useRef<{ sig: string; id: string } | null>(null);

  const eligible = useMemo(() => group.rows.filter(isEligibleForPayment), [group.rows]);
  const eligibleIds = useMemo(() => new Set(eligible.map((r) => r.id)), [eligible]);
  // Selection only ever holds students that are still eligible in the live data.
  const picked = useMemo(() => group.rows.filter((r) => selected.has(r.id) && eligibleIds.has(r.id)), [group.rows, selected, eligibleIds]);
  const pickedTotal = picked.reduce((a, r) => a + (r.fee ?? 0), 0);
  const allSelected = eligible.length > 0 && eligible.every((r) => selected.has(r.id));

  const toggle = (id: string) =>
    setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const run = async (action: ReviewAction) => {
    if (busy || picked.length === 0) return;
    const ids = picked.map((r) => r.id);
    if (action === "reject" && reason.trim().length < 3) {
      setError("Enter a reason (at least 3 characters) to reject.");
      return;
    }
    const ok = await showConfirm({
      title: action === "confirm" ? "Confirm Payment?" : "Reject Payment?",
      message:
        action === "confirm"
          ? `Mark ${ids.length} student${ids.length > 1 ? "s" : ""} as paid - total ${formatINR(pickedTotal)}. This is recorded as an administrative confirmation.`
          : `Reject the payment for ${ids.length} student${ids.length > 1 ? "s" : ""}? Their registrations are kept. Reason: ${reason.trim()}`,
      confirmText: action === "confirm" ? "Confirm Payment" : "Reject",
      variant: action === "confirm" ? "success" : "danger",
    } as any);
    if (!ok) return;

    const sig = `${action}|${[...ids].sort().join(",")}|${reason.trim()}`;
    if (!requestRef.current || requestRef.current.sig !== sig) requestRef.current = { sig, id: crypto.randomUUID() };

    setBusy(true);
    setError(null);
    setOutcome(null);
    try {
      const res = await onReview(action, ids, requestRef.current.id, action === "reject" ? reason.trim() : undefined);
      requestRef.current = null; // definitive answer - next attempt is a new request
      setOutcome(res);
      const done = new Set(res.results.filter((r) => r.outcome !== "failed").map((r) => r.studentId));
      setSelected((p) => new Set([...p].filter((id) => !done.has(id))));
      if (res.counts.failed === 0) { setRejecting(false); setReason(""); }
    } catch (e: any) {
      // Request-level failure: keep the request id so a retry cannot double-apply.
      setError((e?.message || "The request failed.") + " Nothing was confirmed on screen - retry is safe.");
    } finally {
      setBusy(false);
    }
  };

  const nameOf = (id: string) => group.rows.find((r) => r.id === id)?.name || id;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={busy ? undefined : onClose} />
      <div className="relative bg-white dark:bg-zinc-950 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col border border-zinc-200 dark:border-zinc-800">
        <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-start gap-4">
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white">{group.coach} — {group.school}</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
              Registered {fmtDate(group.registeredAt)} · {group.students} student{group.students === 1 ? "" : "s"}
              {group.inferred ? " · grouped by registration time (older record)" : ""}
            </p>
            <p className="text-sm mt-1 text-zinc-700 dark:text-zinc-300">
              Fees {formatINR(group.totalAmount)} · Paid {formatINR(group.paidAmount)} · Pending {formatINR(group.pendingAmount)}
            </p>
          </div>
          <button onClick={onClose} disabled={busy} aria-label="Close" className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full text-zinc-500 disabled:opacity-40"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-5 py-3 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center gap-3">
          <button
            onClick={() => setSelected(allSelected ? new Set() : new Set(eligible.map((r) => r.id)))}
            disabled={eligible.length === 0 || busy}
            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-bold text-zinc-700 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg disabled:opacity-40"
          >
            {allSelected ? <CheckSquare className="w-4 h-4 text-blue-500" /> : <Square className="w-4 h-4" />}
            Select All Pending ({eligible.length})
          </button>
          <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
            {picked.length} selected · {formatINR(pickedTotal)}
          </span>
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => { setRejecting((r) => !r); setError(null); }}
              disabled={picked.length === 0 || busy}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl disabled:opacity-40"
            >
              <XCircle className="w-4 h-4" /> Reject
            </button>
            <button
              onClick={() => run("confirm")}
              disabled={picked.length === 0 || busy}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl disabled:opacity-40 active:scale-95 transition-all"
            >
              {busy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Confirm Payment
            </button>
          </div>
        </div>

        {rejecting && (
          <div className="px-5 py-3 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap gap-2 items-center bg-red-50/50 dark:bg-red-900/10">
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={200}
              placeholder="Reason for rejection (required)"
              className="flex-1 min-w-[220px] px-3 py-2 text-sm bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white placeholder-zinc-400 border border-zinc-300 dark:border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/30"
            />
            <button onClick={() => run("reject")} disabled={busy || picked.length === 0} className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-40">
              Reject {picked.length} selected
            </button>
          </div>
        )}

        {(error || outcome) && (
          <div className="px-5 pt-3 space-y-2">
            {error && (
              <div className="flex items-start gap-2 p-3 rounded-xl text-sm font-semibold bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/50">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
              </div>
            )}
            {outcome && (
              <div className={`p-3 rounded-xl text-sm border ${outcome.counts.failed ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/50 text-amber-800 dark:text-amber-300" : "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/50 text-emerald-800 dark:text-emerald-300"}`}>
                <p className="font-bold">
                  {outcome.counts.updated} {outcome.action === "confirm" ? "confirmed" : "rejected"}
                  {outcome.counts.skipped ? ` · ${outcome.counts.skipped} skipped` : ""}
                  {outcome.counts.failed ? ` · ${outcome.counts.failed} failed` : ""}
                </p>
                {outcome.results.filter((r) => r.outcome !== "updated").length > 0 && (
                  <ul className="mt-1 text-xs space-y-0.5 max-h-28 overflow-y-auto">
                    {outcome.results.filter((r) => r.outcome !== "updated").map((r) => (
                      <li key={r.studentId}>
                        <span className="font-semibold">{nameOf(r.studentId)}</span> — {r.outcome}: {REVIEW_REASON_LABELS[r.reason || ""] || r.reason}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex-1 overflow-auto p-5">
          <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-x-auto">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="bg-zinc-50 dark:bg-zinc-900 text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                <tr>
                  <th className="p-3 w-10"></th>
                  <th className="p-3">Student</th>
                  <th className="p-3">Registration ID</th>
                  <th className="p-3">Belt Transition</th>
                  <th className="p-3 text-right">Fee</th>
                  <th className="p-3 text-right">Paid</th>
                  <th className="p-3 text-right">Balance</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-zinc-800 dark:text-zinc-200">
                {group.rows.map((r) => {
                  const ok = eligibleIds.has(r.id);
                  return (
                    <tr key={r.id}>
                      <td className="p-3">
                        {ok ? (
                          <button onClick={() => toggle(r.id)} disabled={busy} aria-label={`Select ${r.name}`} className="text-zinc-400 hover:text-blue-500">
                            {selected.has(r.id) ? <CheckSquare className="w-4 h-4 text-blue-500" /> : <Square className="w-4 h-4" />}
                          </button>
                        ) : null}
                      </td>
                      <td className="p-3 font-semibold">{r.name}</td>
                      <td className="p-3 font-mono text-xs text-zinc-500">{r.id}</td>
                      <td className="p-3">
                        {r.program === "KARATE" ? "Karate" : "Silambam"} · {r.transitionLabel}
                        {r.transitionSource === "unmapped" && <span className="ml-1 text-[10px] text-amber-600" title="Could not be matched to a configured transition">(unmapped)</span>}
                      </td>
                      <td className="p-3 text-right">{r.fee === null ? <span className="text-amber-600" title="No fee stored - cannot be confirmed">N/A</span> : formatINR(r.fee)}</td>
                      <td className="p-3 text-right">{formatINR(r.paid)}</td>
                      <td className="p-3 text-right">{formatINR(r.balance)}</td>
                      <td className="p-3">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold border ${badge(r.status)}`}>{statusLabel(r.status)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
