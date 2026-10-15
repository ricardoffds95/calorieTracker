import { z } from "zod";

/** The 17 muscle groups of the free-exercise-db (the exercises file of the app). */
export const MUSCLES = [
  "abdominals",
  "abductors",
  "adductors",
  "biceps",
  "calves",
  "chest",
  "forearms",
  "glutes",
  "hamstrings",
  "lats",
  "lower back",
  "middle back",
  "neck",
  "quadriceps",
  "shoulders",
  "traps",
  "triceps",
] as const;
export type Muscle = (typeof MUSCLES)[number];

export const MUSCLE_LABELS: Record<Muscle, string> = {
  abdominals: "Abs",
  abductors: "Abductors",
  adductors: "Adductors",
  biceps: "Biceps",
  calves: "Calves",
  chest: "Chest",
  forearms: "Forearms",
  glutes: "Glutes",
  hamstrings: "Hamstrings",
  lats: "Lats",
  "lower back": "Lower back",
  "middle back": "Middle back",
  neck: "Neck",
  quadriceps: "Quads",
  shoulders: "Shoulders",
  traps: "Traps",
  triceps: "Triceps",
};

export interface Exercise {
  id: string;
  name: string;
  level: string;
  equipment: string;
  category: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  /** Paths inside the free-exercise-db `exercises` folder. */
  images: string[];
}

const IMAGE_BASE = "https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/";

/** The address of an exercise photo (served by jsDelivr from the free-exercise-db repository). */
export function exerciseImageUrl(path: string): string {
  return IMAGE_BASE + path.split("/").map(encodeURIComponent).join("/");
}

// --- the body drawing ---------------------------------------------------------------------------

/** The zones of the body drawing (`react-muscle-highlighter`), each one a tap target. */
export const BODY_ZONES = [
  "trapezius",
  "upper-back",
  "lower-back",
  "chest",
  "biceps",
  "triceps",
  "forearm",
  "deltoids",
  "abs",
  "obliques",
  "adductors",
  "hamstring",
  "quadriceps",
  "calves",
  "tibialis",
  "gluteal",
  "neck",
] as const;
export type BodyZone = (typeof BODY_ZONES)[number];

/** The muscles of the exercises that a zone of the drawing stands for (the drawing has fewer zones than the dataset has muscles). */
export const ZONE_MUSCLES: Record<BodyZone, readonly Muscle[]> = {
  trapezius: ["traps"],
  "upper-back": ["lats", "middle back"],
  "lower-back": ["lower back"],
  chest: ["chest"],
  biceps: ["biceps"],
  triceps: ["triceps"],
  forearm: ["forearms"],
  deltoids: ["shoulders"],
  abs: ["abdominals"],
  obliques: ["abdominals"],
  adductors: ["adductors"],
  hamstring: ["hamstrings"],
  quadriceps: ["quadriceps"],
  calves: ["calves"],
  tibialis: ["calves"],
  gluteal: ["glutes", "abductors"],
  neck: ["neck"],
};

/** A tap on a zone: all of its muscles go off when they are all on, otherwise they all go on. */
export function toggleZone(selected: readonly Muscle[], zone: BodyZone): Muscle[] {
  const muscles = ZONE_MUSCLES[zone];
  const allOn = muscles.every((m) => selected.includes(m));
  if (allOn) return selected.filter((m) => !muscles.includes(m));
  return [...selected, ...muscles.filter((m) => !selected.includes(m))];
}

/** The zones to colour: those with at least one selected muscle. */
export function zonesOf(selected: readonly Muscle[]): BodyZone[] {
  return BODY_ZONES.filter((zone) => ZONE_MUSCLES[zone].some((m) => selected.includes(m)));
}

// --- the list of exercises ------------------------------------------------------------------------

export interface ExerciseHit {
  exercise: Exercise;
  /** True when the chosen muscles are only secondary in this exercise (listed after the main ones). */
  secondary: boolean;
}

export const LEVELS = ["beginner", "intermediate", "expert"] as const;

export interface ExerciseFilter {
  /** Part of the name, any case. */
  query?: string;
  /** Some equipment (an exercise needs any one of them), or an empty list / null / undefined for any. */
  equipment?: readonly string[] | string | null;
  /** One level (beginner, intermediate, expert), or null/undefined for any. */
  level?: string | null;
}

/**
 * The exercises for the chosen muscles: those where one of them is a main muscle first, then those where it is only
 * secondary, each group in alphabetical order. With no muscle chosen, nothing (the screen asks to pick one).
 */
export function filterExercises(exercises: readonly Exercise[], muscles: readonly Muscle[], filter: ExerciseFilter = {}): ExerciseHit[] {
  if (muscles.length === 0) return [];
  const query = (filter.query ?? "").trim().toLowerCase();
  const wanted: readonly string[] = muscles;
  const equipment = typeof filter.equipment === "string" ? [filter.equipment] : (filter.equipment ?? []);
  const primary: Exercise[] = [];
  const secondary: Exercise[] = [];
  for (const exercise of exercises) {
    if (equipment.length > 0 && !equipment.includes(exercise.equipment)) continue;
    if (filter.level && exercise.level !== filter.level) continue;
    if (query && !exercise.name.toLowerCase().includes(query)) continue;
    if (exercise.primaryMuscles.some((m) => wanted.includes(m))) primary.push(exercise);
    else if (exercise.secondaryMuscles.some((m) => wanted.includes(m))) secondary.push(exercise);
  }
  const byName = (a: Exercise, b: Exercise) => a.name.localeCompare(b.name, "en") || a.id.localeCompare(b.id);
  return [
    ...primary.sort(byName).map((exercise) => ({ exercise, secondary: false })),
    ...secondary.sort(byName).map((exercise) => ({ exercise, secondary: true })),
  ];
}

/** The equipment found in the exercises, alphabetical. */
export function equipmentOf(exercises: readonly Exercise[]): string[] {
  return [...new Set(exercises.map((e) => e.equipment))].sort((a, b) => a.localeCompare(b, "en"));
}

// --- workouts ---------------------------------------------------------------------------------------

export const MAX_WORKOUT_NAME = 100;
export const MAX_WORKOUT_EXERCISES = 50;

/** What a workout keeps of an exercise: its id in the exercises file, and the name it had when it was added. */
export const workoutExerciseSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[A-Za-z0-9_\-.()'%]+$/),
  name: z.string().trim().min(1).max(200),
});
export type WorkoutExercise = z.infer<typeof workoutExerciseSchema>;

export const workoutExercisesSchema = z
  .array(workoutExerciseSchema)
  .min(1, "Add an exercise")
  .max(MAX_WORKOUT_EXERCISES, `Max ${MAX_WORKOUT_EXERCISES} exercises`);

export const workoutNameSchema = z.string().trim().min(1, "Name required").max(MAX_WORKOUT_NAME, `Max ${MAX_WORKOUT_NAME} characters`);

/** The first problem of a workout in words, or "" when it can be saved. */
export function workoutProblem(name: string, exercises: readonly WorkoutExercise[]): string {
  const checkedName = workoutNameSchema.safeParse(name);
  if (!checkedName.success) return checkedName.error.issues[0]!.message;
  const checked = workoutExercisesSchema.safeParse(exercises);
  return checked.success ? "" : checked.error.issues[0]!.message;
}

export function toWorkoutExercise(exercise: Pick<Exercise, "id" | "name">): WorkoutExercise {
  return { id: exercise.id, name: exercise.name };
}

/** The exercises as stored in a row (a corrupt row gives an empty list instead of breaking the screen). */
export function parseWorkoutExercises(value: unknown): WorkoutExercise[] {
  const parsed = workoutExercisesSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
}

/** Adds an exercise to a workout in progress unless it is already there or the workout is full. */
export function addToWorkout(list: readonly WorkoutExercise[], exercise: WorkoutExercise): WorkoutExercise[] {
  if (list.some((e) => e.id === exercise.id) || list.length >= MAX_WORKOUT_EXERCISES) return [...list];
  return [...list, exercise];
}

/** Moves the exercise at `index` one place up (-1) or down (+1); the list is returned as it was at the ends. */
export function moveInWorkout(list: readonly WorkoutExercise[], index: number, direction: -1 | 1): WorkoutExercise[] {
  const target = index + direction;
  if (index < 0 || index >= list.length || target < 0 || target >= list.length) return [...list];
  const next = [...list];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}
