// Program & Branch Type Definitions

export interface Program {
  id: string;           // "karate", "selambam", etc.
  name: string;         // "Karate Belt Test", "Selambam Event"
  shortName: string;    // "Karate", "Selambam"
  color: string;        // Accent color for UI
  icon: string;         // Emoji or icon identifier
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Branch {
  id: string;
  name: string;         // "Branch 1", "Chennai Center", etc.
  programId: string;    // Which program this branch belongs to
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

// Default programs seeded into Firestore
export const DEFAULT_PROGRAMS: Omit<Program, 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'karate',
    name: 'Karate Belt Test',
    shortName: 'Karate',
    color: '#D97706',   // amber-600
    icon: '🥋',
    active: true,
  },
  {
    id: 'selambam',
    name: 'Selambam Event',
    shortName: 'Selambam',
    color: '#7C3AED',   // violet-600
    icon: '🪄',
    active: true,
  },
];

// Default branches seeded into Firestore
export const DEFAULT_BRANCHES: Omit<Branch, 'id' | 'createdAt' | 'updatedAt'>[] = [
  { name: 'Branch 1 - Main Center', programId: 'karate', active: true },
  { name: 'Branch 2 - City Branch', programId: 'karate', active: true },
  { name: 'Branch 1 - Main Center', programId: 'selambam', active: true },
];

// Program context value shape
export interface ProgramContextValue {
  programs: Program[];
  branches: Branch[];
  selectedProgram: Program | null;
  selectedBranch: Branch | null;
  filteredBranches: Branch[]; // branches for selected program
  setSelectedProgram: (program: Program | null) => void;
  setSelectedBranch: (branch: Branch | null) => void;
  loading: boolean;
  refreshPrograms: () => Promise<void>;
}
