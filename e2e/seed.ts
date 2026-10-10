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
 * 919 kcal, P 66.2, H 125, G 13.4 (goals 2000/150/200/67 => 1081 kcal left).
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
      name: "Frango com arroz",
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
