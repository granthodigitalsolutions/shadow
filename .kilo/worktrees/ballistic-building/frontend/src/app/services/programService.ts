import { ProgramType } from '../contexts/ProgramContext';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  limit,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { Program, Branch, DEFAULT_PROGRAMS, DEFAULT_BRANCHES } from "../types/program";

/**
 * Program CRUD Service
 */
export const firebaseProgramService = {
  /**
   * Get all programs
   */
  async getAll(): Promise<Program[]> {
    const snap = await getDocs(collection(db, "programs"));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Program));
  },

  /**
   * Get program by ID
   */
  async getById(id: string): Promise<Program | null> {
    const docSnap = await getDoc(doc(db, "programs", id));
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() } as Program;
  },

  /**
   * Create a new program
   */
  async create(programData: Omit<Program, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const docRef = await addDoc(collection(db, "programs"), {
      ...programData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  },

  /**
   * Update an existing program
   */
  async update(id: string, updates: Partial<Omit<Program, 'id' | 'createdAt'>>): Promise<void> {
    await updateDoc(doc(db, "programs", id), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  },

  /**
   * Delete a program (soft delete by setting active = false)
   */
  async delete(id: string): Promise<void> {
    await updateDoc(doc(db, "programs", id), {
      active: false,
      updatedAt: serverTimestamp(),
    });
  },

  /**
   * Seed default programs if they don't exist
   */
  async seedDefaults(): Promise<void> {
    if ((window as any).__programSeeded) return;
    (window as any).__programSeeded = true;

    const existing = await getDocs(query(collection(db, "programs"), limit(1)));
    if (!existing.empty) {
      return;
    }

    for (const program of DEFAULT_PROGRAMS) {
      await setDoc(doc(db, "programs", program.id), {
        ...program,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  },
};

/**
 * Branch CRUD Service
 */
export const branchService = {
  /**
   * Get all branches
   */
  async getAll(): Promise<Branch[]> {
    const snap = await getDocs(collection(db, "branches"));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Branch));
  },

  /**
   * Get branches by program ID
   */
  async getByProgram(programId: string): Promise<Branch[]> {
    const q = query(collection(db, "branches"), where("programId", "==", programId));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Branch));
  },

  /**
   * Get branch by ID
   */
  async getById(id: string): Promise<Branch | null> {
    const docSnap = await getDoc(doc(db, "branches", id));
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() } as Branch;
  },

  /**
   * Create a new branch
   */
  async create(branchData: Omit<Branch, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const docRef = await addDoc(collection(db, "branches"), {
      ...branchData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  },

  /**
   * Update an existing branch
   */
  async update(id: string, updates: Partial<Omit<Branch, 'id' | 'createdAt'>>): Promise<void> {
    await updateDoc(doc(db, "branches", id), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  },

  /**
   * Delete a branch (soft delete by setting active = false)
   */
  async delete(id: string): Promise<void> {
    await updateDoc(doc(db, "branches", id), {
      active: false,
      updatedAt: serverTimestamp(),
    });
  },

  /**
   * Seed default branches if they don't exist
   */
  async seedDefaults(): Promise<void> {
    if ((window as any).__branchSeeded) return;
    (window as any).__branchSeeded = true;

    const existing = await getDocs(query(collection(db, "branches"), limit(1)));
    if (!existing.empty) {
      return;
    }

    for (const branch of DEFAULT_BRANCHES) {
      await addDoc(collection(db, "branches"), {
        ...branch,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  },
};

/**
 * Program Service Helper
 * Provides utilities for filtering program-specific data
 */
export const programService = {
  /**
   * Get filter condition for Firestore queries based on current program
   * @param currentProgram - The currently selected program (KARATE, SELAMBAM, or ALL)
   * @returns Object with programType filter or null if ALL is selected
   */
  getProgramFilter(currentProgram: ProgramType): { programType: 'KARATE' | 'SELAMBAM' } | null {
    if (currentProgram === 'ALL') {
      return null;
    }
    return { programType: currentProgram };
  },

  /**
   * Check if data should be filtered by program
   * @param currentProgram - The currently selected program
   * @returns true if filtering is needed, false otherwise
   */
  shouldFilterByProgram(currentProgram: ProgramType): boolean {
    return currentProgram !== 'ALL';
  },

  /**
   * Filter array of items by program type
   * @param items - Array of items with programType property
   * @param currentProgram - The currently selected program
   * @returns Filtered array
   */
  filterByProgram<T extends { programType: 'KARATE' | 'SELAMBAM' }>(
    items: T[],
    currentProgram: ProgramType
  ): T[] {
    if (currentProgram === 'ALL') {
      return items;
    }
    return items.filter(item => item.programType === currentProgram);
  },

  /**
   * Get program display name
   * @param programType - The program type
   * @returns Display name for the program
   */
  getProgramDisplayName(programType: 'KARATE' | 'SELAMBAM'): string {
    return programType === 'KARATE' ? 'Karate' : 'Selambam';
  },

  /**
   * Get program color
   * @param programType - The program type
   * @returns Color hex code for the program
   */
  getProgramColor(programType: 'KARATE' | 'SELAMBAM'): string {
    return programType === 'KARATE' ? '#FF8C00' : '#00C853';
  },

  /**
   * Validate that an entity belongs to the current program
   * @param entity - Entity with programType
   * @param currentProgram - The currently selected program
   * @returns true if entity belongs to current program or if ALL is selected
   */
  validateProgramContext<T extends { programType: 'KARATE' | 'SELAMBAM' }>(
    entity: T,
    currentProgram: ProgramType
  ): boolean {
    if (currentProgram === 'ALL') {
      return true;
    }
    return entity.programType === currentProgram;
  }
};