import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { School } from '../types/admin';
import { firebaseCoachSchoolService } from '../services/firebaseData';
import { firebaseAuthService } from '../services/firebaseAuth';

const SELECTED_SCHOOL_STORAGE_KEY = 'coachSelectedSchoolId';

interface CoachSchoolContextType {
  mySchools: School[];
  selectedSchoolId: string | null;
  selectedSchool: School | null;
  setSelectedSchoolId: (id: string | null) => void;
  refreshMySchools: () => Promise<void>;
  loading: boolean;
}

const CoachSchoolContext = createContext<CoachSchoolContextType | undefined>(undefined);

export function CoachSchoolProvider({ children }: { children: ReactNode }) {
  const [mySchools, setMySchools] = useState<School[]>([]);
  const [selectedSchoolId, setSelectedSchoolIdState] = useState<string | null>(() =>
    localStorage.getItem(SELECTED_SCHOOL_STORAGE_KEY),
  );
  const [loading, setLoading] = useState(true);

  const setSelectedSchoolId = (id: string | null) => {
    setSelectedSchoolIdState(id);
    if (id) localStorage.setItem(SELECTED_SCHOOL_STORAGE_KEY, id);
    else localStorage.removeItem(SELECTED_SCHOOL_STORAGE_KEY);
  };

  const refreshMySchools = useCallback(async () => {
    const user = firebaseAuthService.getCurrentUser();
    if (!user) {
      setMySchools([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const schools = await firebaseCoachSchoolService.getMySchools(user.uid);
      setMySchools(schools);
      // Keep the current selection if still valid, otherwise fall back to the first school
      setSelectedSchoolIdState((prev) => {
        if (prev && schools.some((s) => s.id === prev)) return prev;
        const fallback = schools[0]?.id || null;
        if (fallback) localStorage.setItem(SELECTED_SCHOOL_STORAGE_KEY, fallback);
        else localStorage.removeItem(SELECTED_SCHOOL_STORAGE_KEY);
        return fallback;
      });
    } catch (err) {
      console.error('Failed to load coach schools:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = firebaseAuthService.onAuthStateChange((user) => {
      if (user) {
        refreshMySchools();
      } else {
        setMySchools([]);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [refreshMySchools]);

  const selectedSchool = mySchools.find((s) => s.id === selectedSchoolId) || null;

  return (
    <CoachSchoolContext.Provider
      value={{ mySchools, selectedSchoolId, selectedSchool, setSelectedSchoolId, refreshMySchools, loading }}
    >
      {children}
    </CoachSchoolContext.Provider>
  );
}

export function useCoachSchool() {
  const ctx = useContext(CoachSchoolContext);
  if (ctx === undefined) {
    throw new Error('useCoachSchool must be used within a CoachSchoolProvider');
  }
  return ctx;
}
