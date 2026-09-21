import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Program, Branch, ProgramContextValue } from '../types/program';
import { firebaseProgramService, branchService } from '../services/programService';


export type ProgramType = 'KARATE' | 'SELAMBAM' | 'ALL';

// Legacy context type for backward compatibility.
// Only `currentProgram`/`setCurrentProgram` are actually stored in the React
// Context value — `program`/`programNavigate`/`switchProgram` are derived
// fresh per-consumer inside useProgram() from the URL, not from Context.
interface ProgramContextType {
  currentProgram: ProgramType;
  setCurrentProgram: (program: ProgramType) => void;
}

const ProgramContext = createContext<ProgramContextType | undefined>(undefined);

// New enhanced context
const EnhancedProgramContext = createContext<ProgramContextValue | undefined>(undefined);

export function ProgramProvider({ children }: { children: ReactNode }) {
  // Load from localStorage or default to 'KARATE'
  const [currentProgram, setCurrentProgramState] = useState<ProgramType>(() => {
    const saved = localStorage.getItem('currentProgram');
    return (saved as ProgramType) || 'KARATE';
  });

  // New multi-branch state
  const [programs, setPrograms] = useState<Program[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedProgram, setSelectedProgramState] = useState<Program | null>(null);
  const [selectedBranch, setSelectedBranchState] = useState<Branch | null>(null);
  const [loading, setLoading] = useState(true);

  // Filtered branches for selected program
  const filteredBranches = selectedProgram
    ? branches.filter(b => b.programId === selectedProgram.id && b.active)
    : [];

  const setCurrentProgram = (program: ProgramType) => {
    setCurrentProgramState(program);
    localStorage.setItem('currentProgram', program);
  };

  const setSelectedProgram = (program: Program | null) => {
    setSelectedProgramState(program);
    setSelectedBranchState(null); // Reset branch when program changes
    if (program) {
      localStorage.setItem('selectedProgramId', program.id);
    } else {
      localStorage.removeItem('selectedProgramId');
    }
  };

  const setSelectedBranch = (branch: Branch | null) => {
    setSelectedBranchState(branch);
    if (branch) {
      localStorage.setItem('selectedBranchId', branch.id);
    } else {
      localStorage.removeItem('selectedBranchId');
    }
  };

  const refreshPrograms = async () => {
    setLoading(true);
    try {
      // Seed defaults if needed (will fail gracefully if unauthenticated)
      try {
        await firebaseProgramService.seedDefaults();
        await branchService.seedDefaults();
      } catch (seedError) {
        console.warn('Could not seed defaults (expected for non-admins):', seedError);
      }

      // Fetch all programs and branches
      const [programsData, branchesData] = await Promise.all([
        firebaseProgramService.getAll(),
        branchService.getAll(),
      ]);

      setPrograms(programsData.filter(p => p.active));
      setBranches(branchesData.filter(b => b.active));

      // Restore from localStorage or select first
      const savedProgramId = localStorage.getItem('selectedProgramId');
      const savedBranchId = localStorage.getItem('selectedBranchId');

      if (savedProgramId) {
        const program = programsData.find(p => p.id === savedProgramId);
        if (program) {
          setSelectedProgramState(program);
          
          if (savedBranchId) {
            const branch = branchesData.find(b => b.id === savedBranchId && b.programId === program.id);
            if (branch) {
              setSelectedBranchState(branch);
            }
          }
        }
      } else if (programsData.length > 0) {
        // Auto-select first program
        const firstProgram = programsData[0];
        setSelectedProgramState(firstProgram);
        
        // Auto-select first branch for that program
        const firstBranch = branchesData.find(b => b.programId === firstProgram.id);
        if (firstBranch) {
          setSelectedBranchState(firstBranch);
        }
      }
    } catch (error) {
      console.error('Failed to load programs/branches:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshPrograms();
  }, []);

  useEffect(() => {
    // Sync across tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'currentProgram' && e.newValue) {
        setCurrentProgramState(e.newValue as ProgramType);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Legacy context value
  const legacyValue: ProgramContextType = {
    currentProgram,
    setCurrentProgram,
  };

  // Enhanced context value
  const enhancedValue: ProgramContextValue = {
    programs,
    branches,
    selectedProgram,
    selectedBranch,
    filteredBranches,
    setSelectedProgram,
    setSelectedBranch,
    loading,
    refreshPrograms,
  };

  return (
    <ProgramContext.Provider value={legacyValue}>
      <EnhancedProgramContext.Provider value={enhancedValue}>
        {children}
      </EnhancedProgramContext.Provider>
    </ProgramContext.Provider>
  );
}

// Legacy hook for backward compatibility - now URL-based
interface UseProgramResult {
  currentProgram: 'KARATE' | 'SELAMBAM';
  setCurrentProgram: (program: ProgramType) => void;
  program: 'karate' | 'silambam';
  programNavigate: (path: string) => void;
  switchProgram: (newProgram: 'karate' | 'silambam') => Promise<void>;
}

export function useProgram(): UseProgramResult {
  const context = useContext(ProgramContext);
  const params = useParams<{ program?: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  if (context === undefined) {
    throw new Error('useProgram must be used within a ProgramProvider');
  }

  // Get program from URL params
  const urlProgram = (params.program || "").toLowerCase();

  // Validate and default to 'karate' if invalid
  const validProgram = ['karate', 'silambam', 'selambam'].includes(urlProgram || '')
    ? (urlProgram === 'selambam' ? 'silambam' : urlProgram as 'karate' | 'silambam')
    : 'karate';

  // Convert to uppercase for backend compatibility
  const currentProgram = validProgram === 'silambam' ? 'SELAMBAM' : 'KARATE';

  // Helper: Navigate to a path within current program
  const programNavigate = useCallback((path: string) => {
    // Remove leading slash if present
    const cleanPath = path.startsWith('/') ? path.substring(1) : path;
    navigate(`/admin/${validProgram}/${cleanPath}`);
  }, [navigate, validProgram]);

  // Helper: Switch to different program while staying on same page
  const switchProgram = useCallback(async (newProgram: 'karate' | 'silambam') => {
    // Clear memory state to prevent stale data ghosting

    
    // Get current path segments after /admin/{program}/
    const pathSegments = location.pathname.split('/').filter(Boolean);
    // Only preserve the top-level section to avoid keeping IDs from the old program
    const section = pathSegments[2] || 'dashboard';
    navigate(`/admin/${newProgram}/${section}`);
  }, [location.pathname, navigate]);

  return {
    currentProgram,
    setCurrentProgram: context.setCurrentProgram, // Keep for compatibility but won't be used
    program: validProgram,
    programNavigate,
    switchProgram,
  };
}

// New enhanced hook
export function useProgramContext() {
  const context = useContext(EnhancedProgramContext);
  if (context === undefined) {
    throw new Error('useProgramContext must be used within a ProgramProvider');
  }
  return context;
}
