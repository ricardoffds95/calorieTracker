"use client";

import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { ExerciseSheet } from "@/components/training/exercise-sheet";
import { useExercises } from "@/lib/queries/training";
import { exerciseImageUrl, type Exercise, type WorkoutExercise } from "@/lib/training";

/** The exercises of a workout, each with its photo; tap one to see all its photos, its muscles and its steps. */
export function WorkoutExerciseList({ exercises }: { exercises: readonly WorkoutExercise[] }) {
  const file = useExercises();
  const byId = useMemo(() => new Map((file.data ?? []).map((exercise) => [exercise.id, exercise])), [file.data]);
  const [open, setOpen] = useState<Exercise | null>(null);

  return (
    <>
      <ol data-testid="workout-exercises" className="flex flex-col">
        {exercises.map((item, index) => {
          const full = byId.get(item.id);
          return (
            <li key={item.id} className="border-b border-border last:border-b-0">
              <button
                type="button"
                aria-label={`Open ${item.name}`}
                disabled={!full}
                onClick={() => full && setOpen(full)}
                className="flex min-h-16 w-full items-center gap-3 rounded-sm py-1 text-left disabled:cursor-default"
              >
                <span className="w-5 shrink-0 text-center text-sm text-muted-foreground tabular-nums">{index + 1}</span>
                {full?.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element -- external photo of the exercise dataset, served as it is
                  <img src={exerciseImageUrl(full.images[0])} alt="" loading="lazy" className="size-14 shrink-0 rounded-md bg-muted object-cover" />
                ) : (
                  <span aria-hidden className="size-14 shrink-0 rounded-md bg-muted" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 break-words">{item.name}</span>
                  {full && <span className="block text-xs text-muted-foreground">{full.equipment}</span>}
                </span>
                {full && <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />}
              </button>
            </li>
          );
        })}
      </ol>
      {open && <ExerciseSheet exercise={open} inWorkout={false} onClose={() => setOpen(null)} />}
    </>
  );
}
