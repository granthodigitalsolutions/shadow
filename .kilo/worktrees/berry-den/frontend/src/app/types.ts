export type ProgramType = 'KARATE' | 'SELAMBAM';

export interface Student {
  id: string;
  name: string;
  gender: string;
  registrationType?: 'school' | 'individual'; // How student registered
  schoolId: string; // Reference to School document ("individual" for individual students)
  school: string; // School name (kept for backward compatibility)
  standard: string;
  contact: string;
  whatsapp: string;
  beltIndex?: number; // For Karate
  stageLevel?: number; // For Selambam
  programType: ProgramType; // CRITICAL: Program identifier (uppercase for code)
  program?: 'karate' | 'selambam'; // CRITICAL: Program identifier (lowercase for database)
  eventId?: string; // The event this student is registered for
  registrationFingerprint?: string; // Deterministic fingerprint to prevent duplicates
}

export type PageType = 'register' | 'hallticket' | 'referee' | 'admin';

export interface Belt {
  from: string;
  to: string;
  fc: string;
  tc: string;
  fb: string | null;
  fee: number;
}

export interface ScoreCriteria {
  k: string;
  e: string;
  t: string;
  bg: string;
  ic: string;
  icon: string;
  v: number;
}