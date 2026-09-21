export const PROGRAM = {
    KARATE: 'KARATE',
    SILAMBAM: 'SILAMBAM',
    SELAMBAM: 'SELAMBAM', // Adding this to support legacy spellings in DB
} as const;

export const PROGRAM_LOWER = {
    KARATE: 'karate',
    SILAMBAM: 'silambam',
    SELAMBAM: 'selambam',
} as const;

export const RESULT_STORAGE = {
    [PROGRAM.KARATE]: "results/karate",
    [PROGRAM.SILAMBAM]: "results/silambam",
    [PROGRAM.SELAMBAM]: "results/silambam",
} as const;
