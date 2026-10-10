export type MealType = "breakfast" | "lunch" | "dinner" | "snacks";
export const MEAL_TYPES: readonly MealType[] = ["breakfast", "lunch", "dinner", "snacks"];

export type GoalMode = "cut" | "maintain" | "bulk";

export interface MacroTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export type MacroGoals = MacroTotals;

export const CALORIE_PER_GRAM = { protein: 4, carbs: 4, fat: 9 } as const;

export const DEFAULT_GOALS: MacroGoals = { calories: 2000, protein: 150, carbs: 200, fat: 65 };

/** Share of calories per macro for each goal mode. */
export const GOAL_PRESETS: Record<GoalMode, { proteinPct: number; carbsPct: number; fatPct: number }> = {
  cut: { proteinPct: 0.4, carbsPct: 0.3, fatPct: 0.3 },
  maintain: { proteinPct: 0.3, carbsPct: 0.4, fatPct: 0.3 },
  bulk: { proteinPct: 0.25, carbsPct: 0.5, fatPct: 0.25 },
};

/** Grams of each macro for a calorie target split by percentages (grams rounded to integers). */
export function calculateMacrosFromCalories(
  calories: number,
  proteinPct: number,
  carbsPct: number,
  fatPct: number,
): MacroGoals {
  return {
    calories,
    protein: Math.round((calories * proteinPct) / CALORIE_PER_GRAM.protein),
    carbs: Math.round((calories * carbsPct) / CALORIE_PER_GRAM.carbs),
    fat: Math.round((calories * fatPct) / CALORIE_PER_GRAM.fat),
  };
}

export function goalsForMode(calories: number, mode: GoalMode): MacroGoals {
  const { proteinPct, carbsPct, fatPct } = GOAL_PRESETS[mode];
  return calculateMacrosFromCalories(calories, proteinPct, carbsPct, fatPct);
}

export function calculateTotalCalories(protein: number, carbs: number, fat: number): number {
  return Math.round(
    protein * CALORIE_PER_GRAM.protein + carbs * CALORIE_PER_GRAM.carbs + fat * CALORIE_PER_GRAM.fat,
  );
}

/** 0..1, capped; 0 when the goal is not positive. */
export function getProgressPercent(current: number, goal: number): number {
  if (goal <= 0) return 0;
  return Math.min(Math.max(current / goal, 0), 1);
}

export function getCaloriesRemaining(current: number, goal: number): number {
  return Math.max(goal - current, 0);
}

export type MacroStatus = "under" | "good" | "over";

export function getMacroStatus(current: number, goal: number): MacroStatus {
  if (goal <= 0) return current > 0 ? "over" : "under";
  const ratio = current / goal;
  if (ratio > 1.05) return "over";
  if (ratio >= 0.9) return "good";
  return "under";
}
