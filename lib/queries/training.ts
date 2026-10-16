"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { toastSaveError } from "@/lib/queries/errors";
import { historyKey } from "@/lib/queries/history";
import { createClient } from "@/lib/supabase/client";
import type { Json, Tables, TablesInsert } from "@/lib/supabase/database.types";
import { parseWorkoutExercises, type Exercise, type WorkoutExercise } from "@/lib/training";

export interface SavedWorkout extends Omit<Tables<"saved_workouts">, "exercises"> {
  exercises: WorkoutExercise[];
}

/** A training done on a day: strength (a list of exercises) or cardio (a sport, for some minutes). */
export interface TrainingEntry extends Omit<Tables<"training_entries">, "exercises" | "kind"> {
  kind: "strength" | "cardio";
  /** Empty for cardio. */
  exercises: WorkoutExercise[];
}

export const exercisesFileKey = ["exercises-file"] as const;
export const savedWorkoutsKey = (userId: string) => ["saved_workouts", userId] as const;
/** Every day of the user (to refresh them all at once). */
const allTrainingKey = (userId: string) => ["training", userId] as const;
export const trainingDayKey = (userId: string, dateKey: string) => ["training", userId, dateKey] as const;

/** Error code of a unique violation: a workout with the same name already exists. */
export const DUPLICATE_WORKOUT = "23505";

const toJson = (exercises: readonly WorkoutExercise[]) => exercises.map(({ id, name }) => ({ id, name })) as Json;

/** The exercises of the app (a static file, ~800 KB): loaded once, never kept in the persisted cache. */
export function useExercises() {
  return useQuery({
    queryKey: exercisesFileKey,
    queryFn: async ({ signal }): Promise<Exercise[]> => {
      const response = await fetch("/training/exercises.json", { signal });
      if (!response.ok) throw new Error("Couldn't load exercises");
      return (await response.json()) as Exercise[];
    },
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
    refetchOnWindowFocus: false,
    meta: { persist: false },
  });
}

/** Most used first, then alphabetical. */
function byUsage(a: { times_used: number; name: string }, b: { times_used: number; name: string }) {
  return b.times_used - a.times_used || a.name.localeCompare(b.name, "pt");
}

function toWorkout(row: Tables<"saved_workouts">): SavedWorkout {
  return { ...row, exercises: parseWorkoutExercises(row.exercises) };
}

export function useSavedWorkouts(userId: string) {
  return useQuery({
    queryKey: savedWorkoutsKey(userId),
    queryFn: async (): Promise<SavedWorkout[]> => {
      const { data, error } = await createClient().from("saved_workouts").select("*");
      if (error) throw error;
      // A corrupt row (no valid exercises) must not take the whole list down.
      return data.map(toWorkout).filter((w) => w.exercises.length > 0).sort(byUsage);
    },
  });
}

interface WorkoutValues {
  name: string;
  exercises: readonly WorkoutExercise[];
}

export function useCreateWorkout(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, exercises }: WorkoutValues): Promise<SavedWorkout> => {
      const { data, error } = await createClient().from("saved_workouts").insert({ name: name.trim(), exercises: toJson(exercises) }).select().single();
      if (error) throw error;
      return toWorkout(data);
    },
    // A duplicate name is shown inline by the caller; everything else as a toast.
    onError: (error: { message?: string; code?: string }) => {
      if (error.code !== DUPLICATE_WORKOUT) toastSaveError(error);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: savedWorkoutsKey(userId) }),
  });
}

export function useUpdateWorkout(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name, exercises }: WorkoutValues & { id: string }) => {
      const { data, error } = await createClient()
        .from("saved_workouts")
        .update({ name: name.trim(), exercises: toJson(exercises) })
        .eq("id", id)
        .select("id");
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("Workout not found");
    },
    onError: (error: { message?: string; code?: string }) => {
      if (error.code !== DUPLICATE_WORKOUT) toastSaveError(error);
    },
    onSuccess: () => toast.success("Workout saved"),
    onSettled: () => queryClient.invalidateQueries({ queryKey: savedWorkoutsKey(userId) }),
  });
}

/** Deleting a workout keeps the trainings already done (they only lose the link, ON DELETE SET NULL). */
export function useDeleteWorkout(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await createClient().from("saved_workouts").delete().eq("id", id).select("id");
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("Workout not found");
    },
    onError: (error: { message?: string }) => toastSaveError(error),
    onSuccess: () => toast("Removed"),
    onSettled: () => Promise.all([queryClient.invalidateQueries({ queryKey: savedWorkoutsKey(userId) }), queryClient.invalidateQueries({ queryKey: allTrainingKey(userId) })]),
  });
}

function toEntry(row: Tables<"training_entries">): TrainingEntry {
  return { ...row, kind: row.kind === "cardio" ? "cardio" : "strength", exercises: parseWorkoutExercises(row.exercises) };
}

function byCreatedAt(a: TrainingEntry, b: TrainingEntry) {
  return a.created_at.localeCompare(b.created_at);
}

export function useTrainingDay(userId: string, dateKey: string) {
  return useQuery({
    queryKey: trainingDayKey(userId, dateKey),
    queryFn: async (): Promise<TrainingEntry[]> => {
      const { data, error } = await createClient().from("training_entries").select("*").eq("entry_date", dateKey).order("created_at", { ascending: true });
      if (error) throw error;
      // A corrupt strength row (no valid exercises) must not take the day down; a cardio one has none by design.
      return data.map(toEntry).filter((e) => e.kind === "cardio" || e.exercises.length > 0);
    },
  });
}

/** The columns of a training entry (without its id and time), strength or cardio. */
function entryRow(entry: Pick<TrainingEntry, "kind" | "entry_date" | "name" | "exercises" | "saved_workout_id" | "activity_id" | "duration_min" | "met" | "weight_kg" | "calories_est" | "notes">): TablesInsert<"training_entries"> {
  if (entry.kind === "cardio") {
    return {
      kind: "cardio",
      entry_date: entry.entry_date,
      name: entry.name,
      exercises: null,
      activity_id: entry.activity_id,
      duration_min: entry.duration_min,
      met: entry.met,
      weight_kg: entry.weight_kg,
      calories_est: entry.calories_est,
      notes: entry.notes,
    };
  }
  return { kind: "strength", entry_date: entry.entry_date, name: entry.name, exercises: toJson(entry.exercises), saved_workout_id: entry.saved_workout_id };
}

export interface NewTraining {
  entry_date: string;
  name: string;
  exercises: readonly WorkoutExercise[];
  saved_workout_id: string | null;
}

/** Write-through insert of a training done on a day. No optimistic rows: the cache only shows what the DB returned. */
export function useAddTraining(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (training: NewTraining): Promise<TrainingEntry> => {
      const { data, error } = await createClient()
        .from("training_entries")
        .insert({ entry_date: training.entry_date, name: training.name.trim(), exercises: toJson(training.exercises), saved_workout_id: training.saved_workout_id, kind: "strength" })
        .select()
        .single();
      if (error) throw error;
      return toEntry(data);
    },
    onSuccess: (entry) => {
      queryClient.setQueryData<TrainingEntry[]>(trainingDayKey(userId, entry.entry_date), (current) =>
        current && !current.some((e) => e.id === entry.id) ? [...current, entry].sort(byCreatedAt) : current,
      );
    },
    onError: (error: { message?: string }) => toastSaveError(error),
    onSettled: (entry) =>
      Promise.all([
        entry ? queryClient.invalidateQueries({ queryKey: trainingDayKey(userId, entry.entry_date) }) : queryClient.invalidateQueries({ queryKey: allTrainingKey(userId) }),
        // times_used changed in SQL
        queryClient.invalidateQueries({ queryKey: savedWorkoutsKey(userId) }),
        queryClient.invalidateQueries({ queryKey: historyKey(userId) }),
      ]),
  });
}

/** Removes a training from its day, with "Undo" (the same row comes back with its id and time). */
export function useDeleteTraining(userId: string) {
  const queryClient = useQueryClient();

  async function restore(entry: TrainingEntry) {
    const { error } = await createClient()
      .from("training_entries")
      .insert({ ...entryRow(entry), id: entry.id, created_at: entry.created_at });
    if (error) {
      toastSaveError(error);
      return;
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: trainingDayKey(userId, entry.entry_date) }),
      queryClient.invalidateQueries({ queryKey: savedWorkoutsKey(userId) }),
      queryClient.invalidateQueries({ queryKey: historyKey(userId) }),
    ]);
  }

  return useMutation({
    mutationFn: async (entry: TrainingEntry) => {
      const { data, error } = await createClient().from("training_entries").delete().eq("id", entry.id).select("id");
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("Training not found");
    },
    onMutate: async (entry) => {
      const key = trainingDayKey(userId, entry.entry_date);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<TrainingEntry[]>(key);
      if (previous) queryClient.setQueryData<TrainingEntry[]>(key, previous.filter((e) => e.id !== entry.id));
      return { previous, key };
    },
    onError: (error: { message?: string }, _entry, context) => {
      if (context?.previous) queryClient.setQueryData(context.key, context.previous);
      toastSaveError(error);
    },
    onSuccess: (_data, entry) => toast("Training removed", { action: { label: "Undo", onClick: () => void restore(entry) } }),
    onSettled: (_data, _error, entry) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: trainingDayKey(userId, entry.entry_date) }),
        queryClient.invalidateQueries({ queryKey: savedWorkoutsKey(userId) }),
        queryClient.invalidateQueries({ queryKey: historyKey(userId) }),
      ]),
  });
}

export interface NewCardio {
  entry_date: string;
  /** The sport: the activity's name, or what the user wrote for "Other". */
  name: string;
  activity_id: string | null;
  duration_min: number;
  met: number | null;
  weight_kg: number | null;
  calories_est: number | null;
  notes: string | null;
}

/** Write-through insert of a cardio training (a sport for some minutes). */
export function useAddCardio(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (cardio: NewCardio): Promise<TrainingEntry> => {
      const { data, error } = await createClient()
        .from("training_entries")
        .insert(entryRow({ ...cardio, kind: "cardio", exercises: [], saved_workout_id: null }))
        .select()
        .single();
      if (error) throw error;
      return toEntry(data);
    },
    onSuccess: (entry) => {
      queryClient.setQueryData<TrainingEntry[]>(trainingDayKey(userId, entry.entry_date), (current) =>
        current && !current.some((e) => e.id === entry.id) ? [...current, entry].sort(byCreatedAt) : current,
      );
    },
    onError: (error: { message?: string }) => toastSaveError(error),
    onSettled: (entry) =>
      Promise.all([
        entry ? queryClient.invalidateQueries({ queryKey: trainingDayKey(userId, entry.entry_date) }) : queryClient.invalidateQueries({ queryKey: allTrainingKey(userId) }),
        queryClient.invalidateQueries({ queryKey: historyKey(userId) }),
      ]),
  });
}
