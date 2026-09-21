import {
  karateBeltYellow,
  karateBeltOrange,
  karateBeltBlue,
  karateBeltGreen,
  karateBeltBrown,
  karateBeltBlack,
  silambamStage1,
  silambamStage2,
  silambamStage3,
  silambamStage4,
  silambamStage5,
  silambamStage6,
  silambamStage7,
  silambamStage8,
  silambamStage9,
  silambamStage10
} from '../../assets/images';

export const karateMascots: Record<string, string> = {
  "White Belt": karateBeltYellow, // using yellow as fallback or white belt asset if exists
  "Yellow Belt": karateBeltYellow,
  "Orange Belt": karateBeltOrange,
  "Green Belt": karateBeltGreen,
  "Blue Belt": karateBeltBlue,
  "Purple Belt": karateBeltBrown, // Fallback/reuse if purple not available
  "I Brown": karateBeltBrown,
  "II Brown": karateBeltBrown,
  "Brown Belt": karateBeltBrown,
  "Black Belt": karateBeltBlack,
};

export const silambamMascots: Record<string, string> = {
  "Stage 1": silambamStage1,
  "Stage 2": silambamStage2,
  "Stage 3": silambamStage3,
  "Stage 4": silambamStage4,
  "Stage 5": silambamStage5,
  "Stage 6": silambamStage6,
  "Stage 7": silambamStage7,
  "Stage 8": silambamStage8,
  "Stage 9": silambamStage9,
  "Stage 10": silambamStage10,
};

// Fallback logic inside the getter
export function getMascotImage(programType: string | undefined, level: string | undefined): string | null {
  if (!programType || !level) return null;

  const prog = programType.toUpperCase();
  
  if (prog === 'KARATE') {
    // Try exact match or partial match
    // E.g. level might be "White Belt -> Yellow Belt"
    for (const [key, value] of Object.entries(karateMascots)) {
      if (level.includes(key)) {
        return value;
      }
    }
    
    // Fallback search
    if (level.includes('Yellow')) return karateBeltYellow;
    if (level.includes('Orange')) return karateBeltOrange;
    if (level.includes('Green')) return karateBeltGreen;
    if (level.includes('Blue')) return karateBeltBlue;
    if (level.includes('Brown')) return karateBeltBrown;
    if (level.includes('Black')) return karateBeltBlack;

    return null;
  }

  if (prog === 'SELAMBAM' || prog === 'SILAMBAM') {
    const stageMatch = level.match(/\d+/);
    if (stageMatch) {
      const stageNum = stageMatch[0];
      return silambamMascots[`Stage ${stageNum}`] || null;
    }
  }

  return null;
}

export function getMascotAccentColor(programType: string | undefined, level: string | undefined): string {
  if (!programType || !level) return 'var(--ink)';

  const prog = programType.toUpperCase();
  
  if (prog === 'KARATE') {
    if (level.includes('Yellow')) return '#FFD700';
    if (level.includes('Orange')) return '#FF8C00';
    if (level.includes('Green')) return '#00C853';
    if (level.includes('Blue')) return '#2979FF';
    if (level.includes('Purple')) return '#AA00FF';
    if (level.includes('Brown')) return '#8B4513';
    if (level.includes('Black')) return '#18181b';
    return '#E5E7EB'; // White/default
  }

  if (prog === 'SELAMBAM' || prog === 'SILAMBAM') {
    const stageMatch = level.match(/\d+/);
    if (stageMatch) {
      const stageNum = parseInt(stageMatch[0], 10);
      switch(stageNum) {
        case 1: return '#FFD700'; // Yellow
        case 2: return '#FF8C00'; // Orange
        case 3: return '#2979FF'; // Blue
        case 4: return '#00C853'; // Green
        case 5: return '#AA00FF'; // Purple
        case 6: return '#8B4513'; // Brown
        case 7: return '#18181b'; // Black
        case 8: return '#FFD700';
        case 9: return '#FF8C00';
        case 10: return '#18181b'; // Black
      }
    }
  }
  return 'var(--ink)';
}

export function preloadImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // Ensure CORS if needed
    img.onload = () => resolve();
    img.onerror = () => {
      console.warn(`Failed to preload image: ${src}`);
      resolve(); // Resolve anyway so PDF generation is not permanently blocked
    };
    img.src = src;
  });
}
