import { createContext, useContext, useState, useCallback, useRef, ReactNode } from "react";
import {
  AlertTriangle, Trash2, RefreshCw, Info, CheckCircle,
  XCircle, X, Check, Send, HelpCircle,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type ConfirmVariant = "danger" | "warning" | "info" | "success";
type AlertVariant   = "error" | "warning" | "info" | "success";

export interface ConfirmOptions {
  title: string;
  message: string;
  detail?: string[];          // optional bullet-point list below message
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
}

export interface AlertOptions {
  title: string;
  message: string;
  variant?: AlertVariant;
}

interface DialogContextValue {
  showConfirm: (opts: ConfirmOptions) => Promise<boolean>;
  showAlert:   (opts: AlertOptions)   => Promise<void>;
}

// ── Context ───────────────────────────────────────────────────────────────────

const DialogContext = createContext<DialogContextValue | null>(null);

export function useDialog(): DialogContextValue {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useDialog must be used inside <DialogProvider>");
  return ctx;
}

// ── Internal state shapes ─────────────────────────────────────────────────────

interface ConfirmState {
  opts: ConfirmOptions;
  resolve: (v: boolean) => void;
}

interface AlertState {
  opts: AlertOptions;
  resolve: () => void;
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function DialogProvider({ children }: { children: ReactNode }) {
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [alertD, setAlertD]   = useState<AlertState  | null>(null);

  const showConfirm = useCallback((opts: ConfirmOptions): Promise<boolean> =>
    new Promise(resolve => setConfirm({ opts, resolve })), []);

  const showAlert = useCallback((opts: AlertOptions): Promise<void> =>
    new Promise(resolve => setAlertD({ opts, resolve })), []);

  const handleConfirmYes = () => {
    confirm?.resolve(true);
    setConfirm(null);
  };
  const handleConfirmNo = () => {
    confirm?.resolve(false);
    setConfirm(null);
  };
  const handleAlertOk = () => {
    alertD?.resolve();
    setAlertD(null);
  };

  return (
    <DialogContext.Provider value={{ showConfirm, showAlert }}>
      {children}

      {/* Confirm Modal */}
      {confirm && (
        <ConfirmModal
          opts={confirm.opts}
          onConfirm={handleConfirmYes}
          onCancel={handleConfirmNo}
        />
      )}

      {/* Alert Modal */}
      {alertD && (
        <AlertModal
          opts={alertD.opts}
          onClose={handleAlertOk}
        />
      )}
    </DialogContext.Provider>
  );
}

// ── Shared backdrop & card wrapper ────────────────────────────────────────────

function Backdrop({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
         style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}>
      <div
        className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden"
        style={{ animation: "dlgIn 0.18s cubic-bezier(0.34,1.56,0.64,1) both" }}
      >
        {children}
      </div>
      <style>{`
        @keyframes dlgIn {
          from { opacity:0; transform:scale(0.88) translateY(12px); }
          to   { opacity:1; transform:scale(1)    translateY(0);    }
        }
      `}</style>
    </div>
  );
}

// ── Variant configs ───────────────────────────────────────────────────────────

const CONFIRM_CFG: Record<ConfirmVariant, {
  iconBg: string; iconColor: string; icon: React.ElementType;
  confirmBg: string; confirmHover: string; strip: string;
}> = {
  danger: {
    iconBg: "#FEE2E2", iconColor: "#EF4444", icon: Trash2,
    confirmBg: "#EF4444", confirmHover: "#DC2626", strip: "#EF4444",
  },
  warning: {
    iconBg: "#FEF3C7", iconColor: "#F59E0B", icon: AlertTriangle,
    confirmBg: "#F59E0B", confirmHover: "#D97706", strip: "#F59E0B",
  },
  info: {
    iconBg: "#DBEAFE", iconColor: "#3B82F6", icon: HelpCircle,
    confirmBg: "#3B82F6", confirmHover: "#2563EB", strip: "#3B82F6",
  },
  success: {
    iconBg: "#DCFCE7", iconColor: "#22C55E", icon: CheckCircle,
    confirmBg: "#22C55E", confirmHover: "#16A34A", strip: "#22C55E",
  },
};

const ALERT_CFG: Record<AlertVariant, {
  iconBg: string; iconColor: string; icon: React.ElementType;
  btnBg: string; btnHover: string; strip: string;
}> = {
  error: {
    iconBg: "#FEE2E2", iconColor: "#EF4444", icon: XCircle,
    btnBg: "#EF4444", btnHover: "#DC2626", strip: "#EF4444",
  },
  warning: {
    iconBg: "#FEF3C7", iconColor: "#F59E0B", icon: AlertTriangle,
    btnBg: "#F59E0B", btnHover: "#D97706", strip: "#F59E0B",
  },
  info: {
    iconBg: "#DBEAFE", iconColor: "#3B82F6", icon: Info,
    btnBg: "#3B82F6", btnHover: "#2563EB", strip: "#3B82F6",
  },
  success: {
    iconBg: "#DCFCE7", iconColor: "#22C55E", icon: CheckCircle,
    btnBg: "#22C55E", btnHover: "#16A34A", strip: "#22C55E",
  },
};

// ── ConfirmModal ──────────────────────────────────────────────────────────────

function ConfirmModal({
  opts, onConfirm, onCancel,
}: { opts: ConfirmOptions; onConfirm: () => void; onCancel: () => void }) {
  const variant = opts.variant ?? "danger";
  const cfg     = CONFIRM_CFG[variant];
  const Icon    = cfg.icon;

  return (
    <Backdrop>
      {/* Colour strip */}
      <div className="h-1.5 w-full" style={{ background: cfg.strip }} />

      <div className="p-6">
        {/* Icon */}
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ background: cfg.iconBg }}
        >
          <Icon className="w-7 h-7" style={{ color: cfg.iconColor }} />
        </div>

        {/* Title */}
        <h3
          className="text-center mb-2"
          style={{
            fontFamily: "'Bebas Neue', sans-serif",
            letterSpacing: "1.5px",
            fontSize: "22px",
            color: "#111827",
          }}
        >
          {opts.title}
        </h3>

        {/* Message */}
        <p className="text-sm text-center text-gray-500 leading-relaxed mb-2">
          {opts.message}
        </p>

        {/* Optional detail bullets */}
        {opts.detail && opts.detail.length > 0 && (
          <ul className="mt-3 mb-1 rounded-xl p-3 space-y-1"
              style={{ background: "#F9FAFB", border: "1px solid #E5E7EB" }}>
            {opts.detail.map((line, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                <span className="mt-0.5 w-1 h-1 rounded-full flex-shrink-0 bg-gray-400 inline-block" />
                {line}
              </li>
            ))}
          </ul>
        )}

        {/* Buttons */}
        <div className="flex gap-3 mt-5">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-colors"
          >
            {opts.cancelText ?? "Cancel"}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3 rounded-xl text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
            style={{ background: cfg.confirmBg }}
            onMouseOver={e => (e.currentTarget.style.background = cfg.confirmHover)}
            onMouseOut={e  => (e.currentTarget.style.background = cfg.confirmBg)}
          >
            <Check className="w-4 h-4" />
            {opts.confirmText ?? "Confirm"}
          </button>
        </div>
      </div>
    </Backdrop>
  );
}

// ── AlertModal ────────────────────────────────────────────────────────────────

function AlertModal({
  opts, onClose,
}: { opts: AlertOptions; onClose: () => void }) {
  const variant = opts.variant ?? "info";
  const cfg     = ALERT_CFG[variant];
  const Icon    = cfg.icon;

  return (
    <Backdrop>
      {/* Colour strip */}
      <div className="h-1.5 w-full" style={{ background: cfg.strip }} />

      <div className="p-6">
        {/* Icon */}
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ background: cfg.iconBg }}
        >
          <Icon className="w-7 h-7" style={{ color: cfg.iconColor }} />
        </div>

        {/* Title */}
        <h3
          className="text-center mb-2"
          style={{
            fontFamily: "'Bebas Neue', sans-serif",
            letterSpacing: "1.5px",
            fontSize: "22px",
            color: "#111827",
          }}
        >
          {opts.title}
        </h3>

        {/* Message */}
        <p className="text-sm text-center text-gray-500 leading-relaxed">
          {opts.message}
        </p>

        {/* OK button */}
        <button
          onClick={onClose}
          className="mt-5 w-full py-3 rounded-xl text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
          style={{ background: cfg.btnBg }}
          onMouseOver={e => (e.currentTarget.style.background = cfg.btnHover)}
          onMouseOut={e  => (e.currentTarget.style.background = cfg.btnBg)}
        >
          <Check className="w-4 h-4" />
          Got it
        </button>
      </div>
    </Backdrop>
  );
}
