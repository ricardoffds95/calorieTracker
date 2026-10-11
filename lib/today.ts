import { getMacroStatus, getProgressPercent, type MacroGoals, type MacroTotals, type MealType } from "./macros";
import { roundCalories } from "./nutrition";

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snacks: "Snacks",
};

export function mealLabel(meal: MealType): string {
  return MEAL_LABELS[meal];
}

export interface RemainingSummary {
  /** Always positive: how many kcal are left, or how many were exceeded. */
  amount: number;
  label: "kcal left" | "kcal over";
  over: boolean;
  /** 0..1, capped. */
  progress: number;
}

export function describeRemaining(goalCalories: number, consumed: number): RemainingSummary {
  const diff = roundCalories(goalCalories - consumed);
  return {
    amount: Math.abs(diff),
    label: diff < 0 ? "kcal over" : "kcal left",
    over: diff < 0,
    progress: getProgressPercent(consumed, goalCalories),
  };
}

export interface MacroColumn {
  key: "protein" | "carbs" | "fat";
  label: string;
  consumed: number;
  goal: number;
  progress: number;
  over: boolean;
}

const MACRO_LABELS = [
  { key: "protein", label: "Protein" },
  { key: "carbs", label: "Carbs" },
  { key: "fat", label: "Fat" },
] as const;

export function macroColumns(goals: MacroGoals, totals: MacroTotals): MacroColumn[] {
  return MACRO_LABELS.map(({ key, label }) => ({
    key,
    label,
    consumed: totals[key],
    goal: goals[key],
    progress: getProgressPercent(totals[key], goals[key]),
    over: getMacroStatus(totals[key], goals[key]) === "over",
  }));
}
