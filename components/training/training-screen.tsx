"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ExerciseBrowser } from "@/components/training/exercise-browser";
import { useWorkoutDraft } from "@/components/training/use-workout-draft";
import { WorkoutSheet } from "@/components/training/workout-sheet";
import { WorkoutsList } from "@/components/training/workouts-list";
import { Button } from "@/components/ui/button";
import { DUPLICATE_WORKOUT, useCreateWorkout, useUpdateWorkout, type SavedWorkout } from "@/lib/queries/training";

type Tab = "exercises" | "workouts";

/** The Training tab: the body and its exercises, and the workouts the user keeps. */
export function TrainingScreen({ userId }: { userId: string }) {
  const [tab, setTab] = useState<Tab>("exercises");
  const draft = useWorkoutDraft();
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<SavedWorkout | null>(null);
  const [sheet, setSheet] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const create = useCreateWorkout(userId);
  const update = useUpdateWorkout(userId);
  const pending = create.isPending || update.isPending;

  function clear() {
    draft.reset();
    setName("");
    setEditing(null);
    setError(null);
    setSheet(false);
  }

  function startEditing(workout: SavedWorkout) {
    draft.reset(workout.exercises);
    setName(workout.name);
    setEditing(workout);
    setError(null);
    setTab("exercises");
  }

  async function save() {
    setError(null);
    try {
      if (editing) await update.mutateAsync({ id: editing.id, name, exercises: draft.exercises });
      else {
        await create.mutateAsync({ name, exercises: draft.exercises });
        toast.success("Workout saved");
      }
    } catch (e) {
      if ((e as { code?: string }).code === DUPLICATE_WORKOUT) setError("Workout name already saved");
      return; // any other error was already shown as a toast
    }
    clear();
    setTab("workouts");
  }

  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label="Training view" className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
        {(["exercises", "workouts"] as const).map((value) => (
          <Button
            key={value}
            type="button"
            variant="ghost"
            aria-pressed={tab === value}
            className="h-10 text-sm text-muted-foreground aria-pressed:bg-card aria-pressed:text-foreground dark:aria-pressed:bg-background"
            onClick={() => setTab(value)}
          >
            {value === "exercises" ? "Exercises" : "Workouts"}
          </Button>
        ))}
      </div>

      {tab === "exercises" ? (
        <ExerciseBrowser inWorkout={draft.exercises.map((e) => e.id)} onAdd={draft.add} />
      ) : (
        <WorkoutsList userId={userId} onEdit={startEditing} />
      )}

      {draft.exercises.length > 0 && (
        <div className="sticky bottom-[calc(var(--tab-bar-height)+env(safe-area-inset-bottom)+0.5rem)] z-10">
          <Button type="button" size="lg" className="h-12 w-full shadow-md" onClick={() => setSheet(true)}>
            {editing ? `Editing ${editing.name}` : "Workout"} · {draft.exercises.length} {draft.exercises.length === 1 ? "exercise" : "exercises"}
          </Button>
        </div>
      )}

      {sheet && (
        <WorkoutSheet
          title={editing ? "Edit workout" : "New workout"}
          name={name}
          onNameChange={setName}
          exercises={draft.exercises}
          onMove={draft.move}
          onRemove={draft.remove}
          onSave={() => void save()}
          onClear={clear}
          onClose={() => setSheet(false)}
          pending={pending}
          error={error}
          saveLabel={editing ? "Save changes" : "Save workout"}
        />
      )}
    </div>
  );
}
