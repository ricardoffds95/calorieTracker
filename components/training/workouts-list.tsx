"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useDeleteWorkout, useSavedWorkouts, type SavedWorkout } from "@/lib/queries/training";

interface WorkoutsListProps {
  userId: string;
  onEdit: (workout: SavedWorkout) => void;
}

/** The workouts the user keeps: tap one to see its exercises, edit it or delete it. */
export function WorkoutsList({ userId, onEdit }: WorkoutsListProps) {
  const workouts = useSavedWorkouts(userId);
  const remove = useDeleteWorkout(userId);
  const [open, setOpen] = useState<SavedWorkout | null>(null);
  const [confirming, setConfirming] = useState(false);

  function close() {
    setOpen(null);
    setConfirming(false);
  }

  return (
    <section aria-label="Workouts" className="flex flex-col gap-2">
      {workouts.isPending && <Skeleton className="h-32 w-full" aria-label="Loading workouts" />}
      {workouts.isError && !workouts.data && (
        <p role="alert" className="text-sm text-destructive">
          Couldn’t load workouts
        </p>
      )}
      {workouts.data && workouts.data.length === 0 && <p className="py-2 text-sm text-muted-foreground">No workouts yet</p>}
      {workouts.data && workouts.data.length > 0 && (
        <ul data-testid="workouts">
          {workouts.data.map((workout) => (
            <li key={workout.id}>
              <button type="button" aria-label={`Open ${workout.name}`} onClick={() => setOpen(workout)} className="flex min-h-12 w-full items-center justify-between gap-3 rounded-sm px-1 text-left">
                <span className="min-w-0 truncate">{workout.name}</span>
                <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
                  {workout.exercises.length} {workout.exercises.length === 1 ? "exercise" : "exercises"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <Sheet open onOpenChange={(isOpen) => !isOpen && close()}>
          <SheetContent side="bottom" className="mx-auto max-h-[92dvh] max-w-md overflow-y-auto rounded-t-lg pb-[max(1rem,env(safe-area-inset-bottom))]">
            <SheetHeader>
              <SheetTitle>{open.name}</SheetTitle>
              <SheetDescription>
                {open.exercises.length} {open.exercises.length === 1 ? "exercise" : "exercises"} · used {open.times_used} {open.times_used === 1 ? "time" : "times"}
              </SheetDescription>
            </SheetHeader>
            <ol className="flex list-decimal flex-col gap-1 px-4 pl-9">
              {open.exercises.map((exercise) => (
                <li key={exercise.id}>{exercise.name}</li>
              ))}
            </ol>
            <SheetFooter>
              {confirming ? (
                <>
                  <p role="alert" className="text-center text-sm">
                    Delete this workout?
                  </p>
                  <Button
                    type="button"
                    variant="destructive"
                    size="lg"
                    className="h-12"
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(open.id, { onSuccess: close })}
                  >
                    Delete
                  </Button>
                  <Button type="button" variant="outline" className="h-11" onClick={() => setConfirming(false)}>
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    size="lg"
                    className="h-12"
                    onClick={() => {
                      onEdit(open);
                      close();
                    }}
                  >
                    <Pencil aria-hidden /> Edit
                  </Button>
                  <Button type="button" variant="outline" className="h-11" onClick={() => setConfirming(true)}>
                    Delete
                  </Button>
                </>
              )}
            </SheetFooter>
          </SheetContent>
        </Sheet>
      )}
    </section>
  );
}
