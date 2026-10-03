import { useEffect, useMemo, useState } from "react";
import { firebaseFeeStructureService, firebaseSilambanFeeService } from "../services/firebaseData";
import { buildKarateTransitions, buildSilambamTransitions } from "../utils/examTransitions";

// The belt/stage transitions, straight from the Admin fee configuration. Used
// by every Admin filter so they all share one definition.
export function useExamTransitions() {
  const [karateFees, setKarateFees] = useState<any[]>([]);
  const [silambamFees, setSilambamFees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([firebaseFeeStructureService.getAll(), firebaseSilambanFeeService.getAll()])
      .then(([k, s]) => { if (!cancelled) { setKarateFees(k); setSilambamFees(s); } })
      .catch((e) => { console.error("Failed to load belt transitions:", e); if (!cancelled) setError("Couldn't load belt/stage transitions."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const karate = useMemo(() => buildKarateTransitions(karateFees), [karateFees]);
  const silambam = useMemo(() => buildSilambamTransitions(silambamFees), [silambamFees]);
  return { karate, silambam, loading, error };
}
