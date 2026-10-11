import { z } from "zod";
import { CALORIE_PER_GRAM, type GoalMode } from "./macros";

export const INTENSITIES = [
  { key: "low", label: "Light", description: "Can chat" },
  { key: "moderate", label: "Moderate", description: "Sweating" },
  { key: "high", label: "Hard", description: "Near your limit" },
] as const;
export type Intensity = (typeof INTENSITIES)[number]["key"];

export const DAILY_ACTIVITIES = [
  { key: "sedentary", label: "Sedentary", description: "Mostly sitting" },
  { key: "light", label: "Lightly active", description: "Some movement" },
  { key: "active", label: "Active", description: "On your feet" },
  { key: "very_active", label: "Very active", description: "Physical work" },
] as const;
export type DailyActivity = (typeof DAILY_ACTIVITIES)[number]["key"];

export const MAX_NOTES_LENGTH = 2000;

/** What the questionnaire asks. Body fat is optional; the lean mass is 100 − fat. */
export const planAnswersSchema = z.object({
  sex: z.enum(["male", "female"], { error: "Sex required" }),
  age: z.number({ error: "Age required" }).int("Whole numbers only").min(14, "Min age 14").max(100, "Max age 100"),
  height_cm: z.number({ error: "Height required" }).int("Whole numbers only").min(100, "Min 100 cm").max(250, "Max 250 cm"),
  weight_kg: z.number({ error: "Weight required" }).min(30, "Min 30 kg").max(300, "Max 300 kg"),
  body_fat_pct: z.number({ error: "Invalid value" }).min(3, "Min 3%").max(60, "Max 60%").nullable(),
  goal: z.enum(["cut", "maintain", "bulk"], { error: "Pick a goal" }),
  daily_activity: z.enum(["sedentary", "light", "active", "very_active"], { error: "Pick daily activity" }),
  aerobic_sessions: z.number({ error: "Aerobic sessions required" }).int("Whole numbers only").min(0, "Min 0").max(14, "Max 14"),
  anaerobic_sessions: z.number({ error: "Anaerobic sessions required" }).int("Whole numbers only").min(0, "Min 0").max(14, "Max 14"),
  intensity: z.enum(["low", "moderate", "high"], { error: "Pick an intensity" }),
  notes: z.string().trim().max(MAX_NOTES_LENGTH, `Max ${MAX_NOTES_LENGTH} characters`),
});
export type PlanAnswers = z.infer<typeof planAnswersSchema>;

export interface NutritionPlan {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export const MIN_PLAN_CALORIES = 1200;

/** Fraction of the maintenance calories eaten for each goal. */
const GOAL_FACTOR: Record<GoalMode, number> = { cut: 0.8, maintain: 1, bulk: 1.1 };
/** Grams of protein per kg of body weight for each goal. */
const PROTEIN_PER_KG: Record<GoalMode, number> = { cut: 2, maintain: 1.6, bulk: 1.8 };

/** Basal metabolic rate: Katch-McArdle when the body fat is known, otherwise Mifflin-St Jeor. */
export function basalMetabolicRate(a: Pick<PlanAnswers, "sex" | "age" | "height_cm" | "weight_kg" | "body_fat_pct">): number {
  if (a.body_fat_pct !== null) return 370 + 21.6 * a.weight_kg * (1 - a.body_fat_pct / 100);
  return 10 * a.weight_kg + 6.25 * a.height_cm - 5 * a.age + (a.sex === "male" ? 5 : -161);
}

/** How much a session weighs for each intensity. */
const INTENSITY_WEIGHT: Record<Intensity, number> = { low: 0.75, moderate: 1, high: 1.25 };

/** What the day-to-day (the job, the commute, the house) adds on top of the factor of a sedentary person. */
const DAILY_EXTRA: Record<DailyActivity, number> = { sedentary: 0, light: 0.075, active: 0.15, very_active: 0.3 };
const MAX_ACTIVITY_FACTOR = 2.2;

/**
 * Multiplier of the basal rate: the weekly training (aerobic and anaerobic sessions, weighed by their intensity) as for a
 * sedentary person, plus what the day-to-day adds (a builder burns far more than someone working from home).
 */
export function activityFactor(aerobicSessions: number, anaerobicSessions: number, intensity: Intensity, daily: DailyActivity = "sedentary"): number {
  const effective = (aerobicSessions + anaerobicSessions) * INTENSITY_WEIGHT[intensity];
  const training = effective <= 0 ? 1.2 : effective <= 2 ? 1.375 : effective <= 4 ? 1.55 : effective <= 6 ? 1.725 : 1.9;
  return Math.min(MAX_ACTIVITY_FACTOR, Math.round((training + DAILY_EXTRA[daily]) * 1000) / 1000);
}

/** A standard, explainable plan: the safety net around the AI's answer and the fallback when it is not available. */
export function referencePlan(a: PlanAnswers, goal: GoalMode = a.goal): NutritionPlan {
  const maintenance = basalMetabolicRate(a) * activityFactor(a.aerobic_sessions, a.anaerobic_sessions, a.intensity, a.daily_activity);
  const calories = Math.max(MIN_PLAN_CALORIES, Math.round((maintenance * GOAL_FACTOR[goal]) / 10) * 10);
  const protein_g = Math.round(a.weight_kg * PROTEIN_PER_KG[goal]);
  const fat_g = Math.round((calories * 0.25) / CALORIE_PER_GRAM.fat);
  const carbs_g = Math.max(0, Math.round((calories - protein_g * CALORIE_PER_GRAM.protein - fat_g * CALORIE_PER_GRAM.fat) / CALORIE_PER_GRAM.carbs));
  return { calories, protein_g, carbs_g, fat_g };
}

/** The three plans (lose, maintain, gain) for the same person: they are all kept, so the goal can change later without redoing the questionnaire. */
export type PlansByGoal = Record<GoalMode, NutritionPlan>;
export const GOALS: readonly GoalMode[] = ["cut", "maintain", "bulk"];

export function referencePlans(a: PlanAnswers): PlansByGoal {
  return { cut: referencePlan(a, "cut"), maintain: referencePlan(a, "maintain"), bulk: referencePlan(a, "bulk") };
}

const aiMacros = z.object({
  calories: z.number().finite(),
  protein_g: z.number().finite().min(0),
  carbs_g: z.number().finite().min(0),
  fat_g: z.number().finite().min(0),
});

/** What the AI returns: a plan for each goal and one short sentence. */
export const aiPlanSchema = z.object({
  plans: z.object({ cut: aiMacros, maintain: aiMacros, bulk: aiMacros }),
  summary: z.string().trim().min(1).max(300),
});

/** The plans as stored in the profile (jsonb): anything that is not three well-formed plans is ignored. */
export const savedPlansSchema = z.object({ cut: aiMacros, maintain: aiMacros, bulk: aiMacros });
export function parseSavedPlans(value: unknown): PlansByGoal | null {
  const parsed = savedPlansSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** How far the AI's calories may be from the reference before it is not trusted. */
const MAX_CALORIE_DEVIATION = 0.25;
/** How far its macros' calories may be from its calories before the carbs are recomputed to fit. */
const MAX_MACRO_MISMATCH = 0.08;

/**
 * The AI's plan made safe: calories inside ±25 % of the reference (otherwise the reference is used), never under the
 * floor, whole numbers, and macros that add up to the calories (the carbs absorb the difference).
 */
export function reconcilePlan(ai: Pick<NutritionPlan, "calories" | "protein_g" | "carbs_g" | "fat_g">, reference: NutritionPlan): { plan: NutritionPlan; trusted: boolean } {
  const deviation = Math.abs(ai.calories - reference.calories) / reference.calories;
  if (!(deviation <= MAX_CALORIE_DEVIATION) || ai.calories < MIN_PLAN_CALORIES) return { plan: reference, trusted: false };

  const calories = Math.round(ai.calories);
  const protein_g = Math.round(ai.protein_g);
  const fat_g = Math.round(ai.fat_g);
  let carbs_g = Math.round(ai.carbs_g);
  const fromMacros = protein_g * CALORIE_PER_GRAM.protein + carbs_g * CALORIE_PER_GRAM.carbs + fat_g * CALORIE_PER_GRAM.fat;
  if (Math.abs(fromMacros - calories) / calories > MAX_MACRO_MISMATCH) {
    carbs_g = Math.round((calories - protein_g * CALORIE_PER_GRAM.protein - fat_g * CALORIE_PER_GRAM.fat) / CALORIE_PER_GRAM.carbs);
    if (carbs_g < 0) return { plan: reference, trusted: false }; // protein and fat alone already exceed the calories
  }
  return { plan: { calories, protein_g, carbs_g, fat_g }, trusted: true };
}

/**
 * The AI's three plans made safe, one by one against the reference of each goal. If they do not go up from losing to
 * gaining (or any of them is not trusted), the standard plans are used for all three: mixing the two would be incoherent.
 */
export function reconcilePlans(ai: PlansByGoal, answers: PlanAnswers): { plans: PlansByGoal; trusted: boolean } {
  const reference = referencePlans(answers);
  const checked = { cut: reconcilePlan(ai.cut, reference.cut), maintain: reconcilePlan(ai.maintain, reference.maintain), bulk: reconcilePlan(ai.bulk, reference.bulk) };
  const plans: PlansByGoal = { cut: checked.cut.plan, maintain: checked.maintain.plan, bulk: checked.bulk.plan };
  const trusted = GOALS.every((g) => checked[g].trusted) && plans.cut.calories <= plans.maintain.calories && plans.maintain.calories <= plans.bulk.calories;
  return trusted ? { plans, trusted } : { plans: reference, trusted: false };
}

/** The explanation shown with the standard plans. */
export function referenceSummary(): string {
  return "Standard calculation";
}
