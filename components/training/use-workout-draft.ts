"use client";

import { useCallback, useState } from "react";
import { addToWorkout, moveInWorkout, type WorkoutExercise } from "@/lib/training";

/** The workout being put together: the exercises chosen so far, in order. */
export function useWorkoutDraft(initial: readonly WorkoutExercise[] = []) {
  const [exercises, setExercises] = useState<WorkoutExercise[]>([...initial]);
  const add = useCallback((exercise: WorkoutExercise) => setExercises((list) => addToWorkout(list, exercise)), []);
  const remove = useCallback((id: string) => setExercises((list) => list.filter((e) => e.id !== id)), []);
  const move = useCallback((index: number, direction: -1 | 1) => setExercises((list) => moveInWorkout(list, index, direction)), []);
  const reset = useCallback((next: readonly WorkoutExercise[] = []) => setExercises([...next]), []);
  return { exercises, add, remove, move, reset };
}

export type WorkoutDraft = ReturnType<typeof useWorkoutDraft>;
