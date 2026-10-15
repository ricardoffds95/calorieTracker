"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, Plus } from "lucide-react";
import { toast } from "sonner";
import { LogHeader, dayHref } from "@/components/log/log-header";
import { AddWorkoutSheet } from "@/components/training/add-workout-sheet";
import { ExerciseBrowser } from "@/components/training/exercise-browser";
import { useBodyGender } from "@/components/training/use-body-gender";
import { FinishWorkoutSheet } from "@/components/training/finish-workout-sheet";
import { useWorkoutDraft } from "@/components/training/use-workout-draft";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMounted } from "@/components/use-mounted";
import { dateKeyOrToday, formatDayLabel } from "@/lib/dates";
import { DUPLICATE_WORKOUT, useAddTraining, useCreateWorkout, useSavedWorkouts, type SavedWorkout } from "@/lib/queries/training";
import type { WorkoutExercise } from "@/lib/training";

const FIRST = 5;
const PAGE = 15;

export function AddTrainingScreen({ userId }: { userId: string }) {
  // "Today" depends on the browser's clock, so nothing date-based renders on the server.
  if (!useMounted()) return <Skeleton className="h-96 w-full" aria-label="Loading" />;
  return <AddTrainingDay userId={userId} />;
}

function AddTrainingDay({ userId }: { userId: string }) {
  const [now] = useState(() => new Date());
  const router = useRouter();
  const dateKey = dateKeyOrToday(useSearchParams().get("d"), now);
  const workouts = useSavedWorkouts(userId);
  const add = useAddTraining(userId);
  const createWorkout = useCreateWorkout(userId);
  const [limit, setLimit] = useState(FIRST);
  const [open, setOpen] = useState<SavedWorkout | null>(null);
  const [building, setBuilding] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const draft = useWorkoutDraft();
  const gender = useBodyGender(userId);

  function added(name: string, day: string) {
    setOpen(null);
    setFinishing(false);
    setBuilding(false);
    draft.reset();
    toast.success(`${name} added to ${formatDayLabel(day, now).toLowerCase()}`, { action: { label: "View day", onClick: () => router.push(dayHref(day, now)) } });
  }

  function addSaved(workout: SavedWorkout, date: string) {
    add.mutate({ entry_date: date, name: workout.name, exercises: workout.exercises, saved_workout_id: workout.id }, { onSuccess: () => added(workout.name, date) });
  }

  async function addNew({ name, save, date }: { name: string; save: boolean; date: string }) {
    setError(null);
    const exercises: WorkoutExercise[] = draft.exercises;
    let savedId: string | null = null;
    if (save) {
      try {
        savedId = (await createWorkout.mutateAsync({ name, exercises })).id;
      } catch (e) {
        if ((e as { code?: string }).code === DUPLICATE_WORKOUT) setError("Workout name already saved");
        return; // any other error was already shown as a toast
      }
    }
    add.mutate({ entry_date: date, name, exercises, saved_workout_id: savedId }, { onSuccess: () => added(name, date) });
  }

  const list = workouts.data ?? [];

  return (
    <div className="flex flex-col gap-5">
      <LogHeader dateKey={dateKey} now={now} title="Add training" />

      {building ? (
        <>
          <Button type="button" variant="ghost" className="-ml-2 h-11 self-start px-2 text-muted-foreground" onClick={() => setBuilding(false)}>
            <ChevronLeft aria-hidden /> Back to workouts
          </Button>
          <ExerciseBrowser inWorkout={draft.exercises.map((e) => e.id)} onAdd={draft.add} gender={gender} />
          {draft.exercises.length > 0 && (
            <div className="sticky bottom-[calc(var(--tab-bar-height)+env(safe-area-inset-bottom)+0.5rem)] z-10">
              <Button type="button" size="lg" className="h-12 w-full shadow-md" onClick={() => setFinishing(true)}>
                Workout · {draft.exercises.length} {draft.exercises.length === 1 ? "exercise" : "exercises"}
              </Button>
            </div>
          )}
        </>
      ) : (
        <>
          <Button type="button" size="lg" className="h-11" onClick={() => setBuilding(true)}>
            <Plus aria-hidden /> New workout
          </Button>
          <section aria-label="Saved workouts" className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-muted-foreground">{list.length > FIRST ? "Most used" : "Workouts"}</h2>
            {workouts.isPending && <Skeleton className="h-32 w-full" aria-label="Loading workouts" />}
            {workouts.isError && !workouts.data && (
              <p role="alert" className="text-sm text-destructive">
                Couldn’t load workouts
              </p>
            )}
            {workouts.data && list.length === 0 && <p className="py-2 text-sm text-muted-foreground">No workouts yet</p>}
            {list.length > 0 && (
              <ul data-testid="saved-workouts">
                {list.slice(0, limit).map((workout) => (
                  <li key={workout.id}>
                    <button type="button" aria-label={`Choose ${workout.name}`} onClick={() => setOpen(workout)} className="flex min-h-12 w-full items-center justify-between gap-3 rounded-sm px-1 text-left">
                      <span className="min-w-0 truncate">{workout.name}</span>
                      <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
                        {workout.exercises.length} {workout.exercises.length === 1 ? "exercise" : "exercises"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {list.length > FIRST && (
              <div className="flex gap-2">
                {list.length > limit && (
                  <Button type="button" variant="ghost" className="h-11 flex-1" onClick={() => setLimit((n) => n + PAGE)}>
                    Show all · {list.length}
                  </Button>
                )}
                {limit > FIRST && (
                  <Button type="button" variant="ghost" className="h-11 flex-1 text-muted-foreground" onClick={() => setLimit(FIRST)}>
                    Show less
                  </Button>
                )}
              </div>
            )}
          </section>
        </>
      )}

      {open && <AddWorkoutSheet workout={open} initialDate={dateKey} pending={add.isPending} onAdd={addSaved} onClose={() => setOpen(null)} />}
      {finishing && (
        <FinishWorkoutSheet
          exercises={draft.exercises}
          initialDate={dateKey}
          onMove={draft.move}
          onRemove={draft.remove}
          onAdd={(values) => void addNew(values)}
          onClose={() => setFinishing(false)}
          pending={add.isPending || createWorkout.isPending}
          error={error}
        />
      )}
    </div>
  );
}
