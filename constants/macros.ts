export interface MacroGoals {
  calories: number;
  protein: number; // grams
  carbs: number;   // grams
  fat: number;     // grams
}

export interface MacroTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export const CALORIE_PER_GRAM = {
  protein: 4,
  carbs: 4,
  fat: 9,
};

export const DEFAULT_GOALS: MacroGoals = {
  calories: 2000,
  protein: 150,
  carbs: 200,
  fat: 65,
};

export const GOAL_PRESETS = {
  cut: { proteinPct: 0.40, carbsPct: 0.30, fatPct: 0.30 },
  maintain: { proteinPct: 0.30, carbsPct: 0.40, fatPct: 0.30 },
  bulk: { proteinPct: 0.25, carbsPct: 0.50, fatPct: 0.25 },
};

export function calculateMacrosFromCalories(
  calories: number,
  proteinPct: number,
  carbsPct: number,
  fatPct: number
): MacroGoals {
  const proteinCals = calories * proteinPct;
  const carbsCals = calories * carbsPct;
  const fatCals = calories * fatPct;

  return {
    calories,
    protein: Math.round(proteinCals / CALORIE_PER_GRAM.protein),
    carbs: Math.round(carbsCals / CALORIE_PER_GRAM.carbs),
    fat: Math.round(fatCals / CALORIE_PER_GRAM.fat),
  };
}

export function calculateTotalCalories(protein: number, carbs: number, fat: number): number {
  return Math.round(
    protein * CALORIE_PER_GRAM.protein +
    carbs * CALORIE_PER_GRAM.carbs +
    fat * CALORIE_PER_GRAM.fat
  );
}

export function getProgressPercent(current: number, goal: number): number {
  if (goal <= 0) return 0;
  return Math.min(current / goal, 1);
}

export function getCaloriesRemaining(current: number, goal: number): number {
  return Math.max(goal - current, 0);
}

export function getMacroStatus(current: number, goal: number): 'under' | 'good' | 'over' {
  const ratio = current / goal;
  if (ratio > 1.05) return 'over';
  if (ratio >= 0.90) return 'good';
  return 'under';
}
