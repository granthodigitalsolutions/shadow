import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { QrCode, Camera, Upload, X, ShieldCheck, ArrowRight } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import jsQR from "jsqr";
import { verifyExaminerCode } from "../../services/examinerApi";
import { ThemeToggle } from "../ui/ThemeToggle";

const CODE_LENGTH = 6;
const CODE_REGEX = /^\d{6}$/;

// Public, no-login landing page for the Examiner flow (Phase 4). An Examiner
// enters the 6-digit code printed/QR-coded on a Phase 3 "Generate Batch"
// roster, or scans the QR code directly, to get a batch-scoped session token.
export default function ExaminerEntry() {
  const navigate = useNavigate();

  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [processingImage, setProcessingImage] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerStarted = useRef(false);
  const isProcessingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Reopening the app mid-event with a still-valid token skips straight to
  // the roster — don't block the initial render on this, just redirect fast.
  useEffect(() => {
    if (localStorage.getItem("examinerToken")) {
      navigate("/examiner/batch", { replace: true });
    }
  }, [navigate]);

  const handleVerify = async (candidate: string) => {
    if (!CODE_REGEX.test(candidate)) {
      setErrorMsg("Enter the 6-digit batch code.");
      return;
    }
    setVerifying(true);
    setErrorMsg(null);
    try {
      const { data } = await verifyExaminerCode(candidate);
      if (data.success && data.token && data.batch) {
        localStorage.setItem("examinerToken", data.token);
        localStorage.setItem("examinerBatch", JSON.stringify(data.batch));
        navigate("/examiner/batch");
      } else {
        setErrorMsg(data.message || "That code wasn't found. Please check and try again.");
      }
    } catch (e: any) {
      setErrorMsg(e?.message || "Could not reach the server. Check your connection and try again.");
    } finally {
      setVerifying(false);
    }
  };

  const handleCodeChange = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, CODE_LENGTH);
    setCode(digits);
    setErrorMsg(null);
    if (digits.length === CODE_LENGTH && !verifying) {
      handleVerify(digits);
    }
  };

  // ── QR scanning (live camera) ───────────────────────────────────────────
  useEffect(() => {
    if (!scanning) return;
    let cancelled = false;

    const startCamera = async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
      if (cancelled || !document.getElementById("examiner-qr-reader")) return;

      setCameraError(null);

      try {
        const html5Qrcode = new Html5Qrcode("examiner-qr-reader");
        scannerRef.current = html5Qrcode;

        await html5Qrcode.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          async (decodedText) => {
            if (isProcessingRef.current) return;
            const candidate = decodedText.trim();
            if (!CODE_REGEX.test(candidate)) return; // ignore unrelated QR codes

            isProcessingRef.current = true;

            if (scannerRef.current && scannerStarted.current) {
              try {
                await scannerRef.current.stop();
              } catch (_) {}
              scannerStarted.current = false;
            }
            setScanning(false);
            setCode(candidate);
            await handleVerify(candidate);

            isProcessingRef.current = false;
          },
          () => {
            // Suppress per-frame decode errors
          },
        );
        scannerStarted.current = true;
      } catch (error: any) {
        if (cancelled) return;
        const name = error?.name || "";
        const msg = error?.message || "";
        if (name === "NotAllowedError" || msg.includes("NotAllowedError")) {
          setCameraError("Camera permission denied. Please allow camera access and try again.");
        } else if (name === "NotFoundError" || msg.includes("NotFoundError")) {
          setCameraError("No camera found on this device.");
        } else {
          setCameraError("Unable to start camera. Please check your browser settings and try again.");
        }
      }
    };

    startCamera();

    return () => {
      cancelled = true;
      if (scannerRef.current && scannerStarted.current) {
        scannerRef.current.stop().catch(() => {});
        scannerStarted.current = false;
      }
      scannerRef.current = null;
    };
  }, [scanning]);

  const handleStopScanning = async () => {
    if (scannerRef.current && scannerStarted.current) {
      try {
        await scannerRef.current.stop();
      } catch (_) {}
      scannerStarted.current = false;
    }
    scannerRef.current = null;
    isProcessingRef.current = false;
    setScanning(false);
    setCameraError(null);
  };

  // ── QR scanning (static image upload fallback) ──────────────────────────
  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setProcessingImage(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          setErrorMsg("Failed to process image.");
          setProcessingImage(false);
          return;
        }

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const decoded = jsQR(imageData.data, imageData.width, imageData.height);

        setProcessingImage(false);
        if (fileInputRef.current) fileInputRef.current.value = "";

        if (!decoded) {
          setErrorMsg("No QR code found in that image.");
          return;
        }

        const candidate = decoded.data.trim();
        if (!CODE_REGEX.test(candidate)) {
          setErrorMsg("That QR code isn't a valid batch code.");
          return;
        }

        setCode(candidate);
        handleVerify(candidate);
      };

      img.onerror = () => {
        setErrorMsg("Failed to load image.");
        setProcessingImage(false);
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = () => {
      setErrorMsg("Failed to read file.");
      setProcessingImage(false);
    };

    reader.readAsDataURL(file);
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col">
      <div className="p-4 flex justify-end">
        <ThemeToggle />
      </div>

      <div className="flex-1 flex items-center justify-center px-4 pb-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <ShieldCheck className="w-8 h-8 text-blue-500" />
            </div>
            <h1
              className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50"
              style={{ fontFamily: "'Bebas Neue', sans-serif" }}
            >
              EXAMINER ACCESS
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 font-medium">
              Enter the 6-digit batch code, or scan its QR code.
            </p>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-sm p-6">
            {scanning ? (
              <div>
                <div className="mb-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-xl p-4 flex flex-col items-center justify-center">
                  <p className="text-sm font-bold text-blue-900 dark:text-blue-300 flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                    </span>
                    CAMERA ACTIVE
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-400 font-medium mt-1 text-center">
                    Point at the batch's QR code — stops automatically on scan
                  </p>
                </div>

                <div
                  id="examiner-qr-reader"
                  className="mb-4 rounded-2xl overflow-hidden border-2 border-zinc-200 dark:border-zinc-800 bg-black min-h-[250px]"
                />

                {cameraError && (
                  <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl p-4">
                    <p className="text-sm text-red-700 dark:text-red-400 font-medium">{cameraError}</p>
                  </div>
                )}

                <button
                  onClick={handleStopScanning}
                  className="w-full px-6 py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-2xl hover:bg-zinc-200 dark:hover:bg-zinc-700 font-bold active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-base"
                >
                  <X className="w-5 h-5" />
                  Cancel Scanning
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2 text-center">
                    Batch Code
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoFocus
                    maxLength={CODE_LENGTH}
                    value={code}
                    disabled={verifying}
                    onChange={(e) => handleCodeChange(e.target.value)}
                    placeholder="000000"
                    className="w-full text-center text-4xl sm:text-5xl font-bold tracking-[0.3em] px-4 py-5 bg-zinc-50 dark:bg-zinc-950 border-2 border-zinc-200 dark:border-zinc-800 rounded-2xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-zinc-900 dark:text-zinc-50 disabled:opacity-60"
                  />
                </div>

                {errorMsg && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl p-3.5 text-center">
                    <p className="text-sm text-red-700 dark:text-red-400 font-semibold">{errorMsg}</p>
                  </div>
                )}

                <button
                  onClick={() => handleVerify(code)}
                  disabled={verifying || code.length !== CODE_LENGTH}
                  className="w-full px-6 py-4 bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-2xl font-bold text-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  {verifying ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      Verify Code
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>

                <div className="flex items-center gap-4 py-1">
                  <div className="h-px bg-zinc-200 dark:bg-zinc-800 flex-1" />
                  <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">OR</span>
                  <div className="h-px bg-zinc-200 dark:bg-zinc-800 flex-1" />
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={() => {
                      setErrorMsg(null);
                      setScanning(true);
                    }}
                    disabled={verifying || processingImage}
                    className="w-full px-5 py-4 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-2xl font-bold active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                  >
                    <Camera className="w-5 h-5" />
                    Scan QR Code
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={verifying || processingImage}
                    className="w-full px-5 py-4 bg-white dark:bg-zinc-950 border-2 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-2xl font-bold active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                  >
                    <Upload className="w-5 h-5" />
                    {processingImage ? "Processing..." : "Upload QR Photo"}
                  </button>
                </div>
              </div>
            )}
          </div>

          <p className="text-center text-xs text-zinc-400 dark:text-zinc-600 mt-6 flex items-center justify-center gap-1.5">
            <QrCode className="w-3.5 h-3.5" />
            Get the batch code from the "Generate Batch" screen in Admin
          </p>
        </div>
      </div>
    </div>
  );
}
