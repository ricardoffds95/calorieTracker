import { setDefaultResultOrder } from "node:dns";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database, TablesInsert } from "../lib/supabase/database.types";
import { credentials, type TestUser } from "./helpers";

type SeedRow = Omit<TablesInsert<"diary_entries">, "user_id">;

// Some networks (and this container) stall on IPv6 before falling back to IPv4.
setDefaultResultOrder("ipv4first");

const clients = new Map<TestUser, Promise<SupabaseClient<Database>>>();

/** Supabase client in Node, signed in as a test user (reused per worker): RLS applies exactly as in the app. */
function clientFor(user: TestUser) {
  let client = clients.get(user);
  if (!client) {
    client = signIn(user);
    clients.set(user, client);
  }
  return client;
}

async function signIn(user: TestUser) {
  const supabase = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await supabase.auth.signInWithPassword(credentials(user));
  if (error) throw error;
  return supabase;
}

export async function clearDiary(user: TestUser) {
  const supabase = await clientFor(user);
  const { error } = await supabase.from("diary_entries").delete().gte("created_at", "1970-01-01");
  if (error) throw error;
}

export async function seedDiary(user: TestUser, rows: SeedRow[]) {
  const supabase = await clientFor(user);
  const { error } = await supabase.from("diary_entries").insert(rows);
  if (error) throw error;
}

export async function fetchDiary(user: TestUser, date: string) {
  const supabase = await clientFor(user);
  const { data, error } = await supabase.from("diary_entries").select("*").eq("entry_date", date).order("created_at");
  if (error) throw error;
  return data;
}

export const DAY_DATA = "2026-01-15";
export const DAY_EMPTY = "2026-01-16";
export const DAY_OVER = "2026-01-17";

const at = (date: string, time: string) => `${date}T${time}:00Z`;

const frango = { name: "Frango", quantity_g: 150, calories: 248, protein_g: 46.5, carbs_g: 0, fat_g: 5.4 };
const arroz = { name: "Arroz", quantity_g: 200, calories: 260, protein_g: 5.4, carbs_g: 56, fat_g: 0.6 };

/**
 * 919 kcal, P 66.2, C 125, F 13.4 (goals 2000/150/200/67 => 1081 kcal left).
 * breakfast 331 (Aveia + Banana), lunch 508 (meal), snacks 80.
 */
export function dataDayRows(date = DAY_DATA): SeedRow[] {
  return [
    { entry_date: date, meal: "breakfast", kind: "food", name: "Aveia", quantity_g: 60, calories: 224, protein_g: 8, carbs_g: 35, fat_g: 4, created_at: at(date, "08:00") },
    { entry_date: date, meal: "breakfast", kind: "food", name: "Banana", quantity_g: 120, calories: 107, protein_g: 1.3, carbs_g: 27, fat_g: 0.4, created_at: at(date, "08:05") },
    {
      entry_date: date,
      meal: "lunch",
      kind: "meal",
      name: "Chicken and rice",
      calories: 508,
      protein_g: 51.9,
      carbs_g: 56,
      fat_g: 6,
      items: [frango, arroz],
      created_at: at(date, "13:00"),
    },
    { entry_date: date, meal: "snacks", kind: "food", name: "Iogurte", quantity_g: 125, calories: 80, protein_g: 5, carbs_g: 7, fat_g: 3, created_at: at(date, "16:00") },
  ];
}

export function overGoalRows(date = DAY_OVER): SeedRow[] {
  return [{ entry_date: date, meal: "dinner", kind: "food", name: "Banquete", quantity_g: 900, calories: 2300, protein_g: 80, carbs_g: 250, fat_g: 100, created_at: at(date, "20:00") }];
}

/** Saved foods and meals of a user (diary entries keep their rows: the FK sets the link to null). */
export async function clearSaved(user: TestUser) {
  const supabase = await clientFor(user);
  const [foods, meals] = await Promise.all([
    supabase.from("saved_foods").delete().gte("created_at", "1970-01-01"),
    supabase.from("saved_meals").delete().gte("created_at", "1970-01-01"),
  ]);
  if (foods.error) throw foods.error;
  if (meals.error) throw meals.error;
}

export async function seedSavedFood(user: TestUser, row: Omit<TablesInsert<"saved_foods">, "user_id">) {
  const supabase = await clientFor(user);
  const { data, error } = await supabase.from("saved_foods").insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function seedSavedMeal(user: TestUser, row: Omit<TablesInsert<"saved_meals">, "user_id">) {
  const supabase = await clientFor(user);
  const { data, error } = await supabase.from("saved_meals").insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function fetchSavedFoods(user: TestUser) {
  const supabase = await clientFor(user);
  const { data, error } = await supabase.from("saved_foods").select("*");
  if (error) throw error;
  return data;
}

/** Calls apply_saved_food as `user` (RLS applies): returns how many entries changed. */
export async function applySavedFoodAs(user: TestUser, foodId: string) {
  const supabase = await clientFor(user);
  const { data, error } = await supabase.rpc("apply_saved_food", { p_food_id: foodId });
  if (error) throw error;
  return data;
}

export async function fetchSavedMeals(user: TestUser) {
  const supabase = await clientFor(user);
  const { data, error } = await supabase.from("saved_meals").select("*");
  if (error) throw error;
  return data;
}

/** Calls diary_daily_totals as `user` (RLS applies). */
export async function dailyTotalsAs(user: TestUser, from: string, to: string) {
  const supabase = await clientFor(user);
  return supabase.rpc("diary_daily_totals", { p_from: from, p_to: to });
}

/** Calls diary_top_items as `user` (RLS applies). */
export async function topItemsAs(user: TestUser, from: string, to: string, order: "times" | "calories", limit = 5) {
  const supabase = await clientFor(user);
  return supabase.rpc("diary_top_items", { p_from: from, p_to: to, p_order: order, p_limit: limit });
}

/** Calls diary_meal_totals as `user` (RLS applies). */
export async function mealTotalsAs(user: TestUser, from: string, to: string) {
  const supabase = await clientFor(user);
  return supabase.rpc("diary_meal_totals", { p_from: from, p_to: to });
}

/** The profile row of a test user (RLS: only their own). */
export async function fetchProfile(user: TestUser) {
  const supabase = await clientFor(user);
  const { data, error } = await supabase.from("profiles").select("*").single();
  if (error) throw error;
  return data;
}

/** Puts a test user back to a clean profile: default goals, no questionnaire answers, onboarding done or not, with or without an icon. */
export async function resetProfileRow(user: TestUser, { onboardingDone, avatar = null }: { onboardingDone: boolean; avatar?: string | null }) {
  const supabase = await clientFor(user);
  // getSession reads the local session: getUser would ask the server, which refuses after a test signed this user out everywhere.
  const { data: auth, error: authError } = await supabase.auth.getSession();
  if (authError || !auth.session) throw authError ?? new Error("No session");
  const { error } = await supabase
    .from("profiles")
    .update({
      name: "Utilizador",
      mode: "maintain",
      goal_calories: 2000,
      goal_protein: 150,
      goal_carbs: 200,
      goal_fat: 67,
      sex: null,
      age: null,
      height_cm: null,
      weight_kg: null,
      body_fat_pct: null,
      daily_activity: null,
      avatar,
      saved_plans: null,
      aerobic_sessions_per_week: null,
      anaerobic_sessions_per_week: null,
      training_intensity: null,
      training_notes: null,
      plan_summary: null,
      onboarding_done_at: onboardingDone ? new Date().toISOString() : null,
    })
    .eq("user_id", auth.session.user.id);
  if (error) throw error;
}

/**
 * Puts a test user's password back after a test changed it: signs in with the temporary one (if the change happened)
 * and sets the original from the environment.
 */
export async function restorePassword(user: TestUser, temporary: string) {
  const { email, password } = credentials(user);
  const supabase = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await supabase.auth.signInWithPassword({ email, password: temporary });
  if (error) return; // the change did not happen: the original still works
  const { error: updateError } = await supabase.auth.updateUser({ password });
  if (updateError) throw updateError;
}

type WorkoutRow = Omit<TablesInsert<"saved_workouts">, "user_id">;

export const BENCH = { id: "Barbell_Bench_Press_-_Medium_Grip", name: "Barbell Bench Press - Medium Grip" };
export const FLYES = { id: "Dumbbell_Flyes", name: "Dumbbell Flyes" };
export const CURL = { id: "Barbell_Curl", name: "Barbell Curl" };

/** Every training done and every saved workout of a user. */
export async function clearTraining(user: TestUser) {
  const supabase = await clientFor(user);
  const entries = await supabase.from("training_entries").delete().gte("created_at", "1970-01-01");
  if (entries.error) throw entries.error;
  const workouts = await supabase.from("saved_workouts").delete().gte("created_at", "1970-01-01");
  if (workouts.error) throw workouts.error;
}

export async function seedWorkout(user: TestUser, row: Pick<WorkoutRow, "name" | "exercises"> & Partial<WorkoutRow>) {
  const supabase = await clientFor(user);
  const { data, error } = await supabase.from("saved_workouts").insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function fetchWorkouts(user: TestUser) {
  const supabase = await clientFor(user);
  const { data, error } = await supabase.from("saved_workouts").select("*").order("created_at");
  if (error) throw error;
  return data;
}

export async function fetchTrainings(user: TestUser, date?: string) {
  const supabase = await clientFor(user);
  const query = supabase.from("training_entries").select("*").order("created_at");
  const { data, error } = await (date ? query.eq("entry_date", date) : query);
  if (error) throw error;
  return data;
}

/** Inserts a training as `user` (RLS and the composite FK apply): returns the error, if any. */
export async function insertTrainingAs(user: TestUser, row: { entry_date: string; name: string; saved_workout_id: string | null }) {
  const supabase = await clientFor(user);
  return supabase.from("training_entries").insert({ ...row, exercises: [BENCH] });
}

/** Trainings done on days, as the user (RLS applies). Each row is one training. */
export async function seedTraining(user: TestUser, rows: { entry_date: string; name?: string }[]) {
  const supabase = await clientFor(user);
  const { error } = await supabase.from("training_entries").insert(rows.map((r) => ({ entry_date: r.entry_date, name: r.name ?? "Chest day", exercises: [BENCH] })));
  if (error) throw error;
}

/** Calls training_daily_counts as `user` (RLS applies). */
export async function trainingCountsAs(user: TestUser, from: string, to: string) {
  const supabase = await clientFor(user);
  return supabase.rpc("training_daily_counts", { p_from: from, p_to: to });
}

/** The weight in the profile of a test user (kcal of a sport are estimated from it); null takes it away. */
export async function setProfileWeight(user: TestUser, weightKg: number | null) {
  const supabase = await clientFor(user);
  const { data: auth, error: authError } = await supabase.auth.getSession();
  if (authError || !auth.session) throw authError ?? new Error("No session");
  const { error } = await supabase.from("profiles").update({ weight_kg: weightKg }).eq("user_id", auth.session.user.id);
  if (error) throw error;
}

/** The activities a user sees: the built-in ones and their own. */
export async function fetchActivities(user: TestUser) {
  const supabase = await clientFor(user);
  const { data, error } = await supabase.from("activities").select("*").order("sort_order").order("name");
  if (error) throw error;
  return data;
}

/** The user's own activities go (the built-in ones are not theirs to delete). */
export async function clearActivities(user: TestUser) {
  const supabase = await clientFor(user);
  const { error } = await supabase.from("activities").delete().not("user_id", "is", null);
  if (error) throw error;
}

/** Tries to change a built-in activity as `user`: RLS must leave it alone (no row comes back). */
export async function updateActivityAs(user: TestUser, id: string, met: number) {
  const supabase = await clientFor(user);
  return supabase.from("activities").update({ met }).eq("id", id).select("id");
}

export async function deleteActivityAs(user: TestUser, id: string) {
  const supabase = await clientFor(user);
  return supabase.from("activities").delete().eq("id", id).select("id");
}

type CardioRow = { entry_date: string; name?: string; duration_min?: number; notes?: string | null; activity_id?: string | null };

/** Cardio trainings done on days, as the user. */
export async function seedCardio(user: TestUser, rows: CardioRow[]) {
  const supabase = await clientFor(user);
  const { error } = await supabase.from("training_entries").insert(
    rows.map((r) => ({ kind: "cardio", exercises: null, name: r.name ?? "Running", duration_min: r.duration_min ?? 30, notes: r.notes ?? null, activity_id: r.activity_id ?? null, entry_date: r.entry_date })),
  );
  if (error) throw error;
}

/** Inserts a cardio training as `user` (RLS and the activity check apply): returns the error, if any. */
export async function insertCardioAs(user: TestUser, row: { entry_date: string; activity_id: string | null }) {
  const supabase = await clientFor(user);
  return supabase.from("training_entries").insert({ kind: "cardio", exercises: null, name: "Running", duration_min: 30, entry_date: row.entry_date, activity_id: row.activity_id });
}
