// Tiny generated confirmation beep (Web Audio API) - no audio asset or
// dependency. Mobile browsers only allow audio after a user gesture, so
// unlockScanBeep() must be called from a tap handler (e.g. opening the
// scanner); the one AudioContext it creates is then reused for every beep.
// Every function swallows failures: audio is a nicety and must never break
// the student-add flow.

let ctx: AudioContext | null = null;
let lastBeepAt = 0;
const MIN_GAP_MS = 250; // never stack two beeps for one addition

const getContext = (): AudioContext | null => {
  if (ctx) return ctx;
  try {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  } catch {
    ctx = null;
  }
  return ctx;
};

/** Call from a user gesture (tap) to create/resume the audio context. */
export function unlockScanBeep(): void {
  try {
    const c = getContext();
    if (c && c.state === "suspended") void c.resume().catch(() => {});
  } catch {
    /* ignore */
  }
}

/** One short success beep. Falls back to a brief vibration if audio is blocked. */
export function playSuccessBeep(): void {
  const now = Date.now();
  if (now - lastBeepAt < MIN_GAP_MS) return;
  lastBeepAt = now;

  try {
    const c = getContext();
    if (!c || c.state !== "running") {
      // Audio still locked/unavailable - best-effort haptic fallback (Android).
      try { navigator.vibrate?.(120); } catch { /* ignore */ }
      if (c && c.state === "suspended") void c.resume().catch(() => {});
      return;
    }
    const osc = c.createOscillator();
    const gain = c.createGain();
    const t = c.currentTime;
    osc.type = "sine";
    osc.frequency.setValueAtTime(1040, t);
    // Quick attack/decay envelope avoids clicks; ~150ms total.
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.35, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
    osc.start(t);
    osc.stop(t + 0.16);
  } catch {
    /* never let audio break scanning */
  }
}
