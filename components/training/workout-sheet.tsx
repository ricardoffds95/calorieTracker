"use client";

import { DraftList } from "@/components/training/draft-list";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/hint";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { MAX_WORKOUT_NAME, workoutProblem, type WorkoutExercise } from "@/lib/training";

interface WorkoutSheetProps {
  title: string;
  name: string;
  onNameChange: (name: string) => void;
  exercises: readonly WorkoutExercise[];
  onMove: (index: number, direction: -1 | 1) => void;
  onRemove: (id: string) => void;
  onSave: () => void;
  onClear: () => void;
  onClose: () => void;
  pending: boolean;
  /** A problem found when saving (e.g. the name is already used). */
  error: string | null;
  saveLabel: string;
}

/** The workout being put together: its name and its exercises in order, to save or start again. */
export function WorkoutSheet({ title, name, onNameChange, exercises, onMove, onRemove, onSave, onClear, onClose, pending, error, saveLabel }: WorkoutSheetProps) {
  const problem = workoutProblem(name, exercises);
  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="mx-auto max-h-[92dvh] max-w-md overflow-y-auto rounded-t-lg pb-[max(1rem,env(safe-area-inset-bottom))]">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            {exercises.length} {exercises.length === 1 ? "exercise" : "exercises"}
          </SheetDescription>
        </SheetHeader>
        <form
          id="workout-form"
          noValidate
          className="flex flex-col gap-4 px-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!problem) onSave();
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="workout-name">Workout name</Label>
            <Input id="workout-name" className="h-11" placeholder="e.g. Back day" maxLength={MAX_WORKOUT_NAME + 20} value={name} onChange={(e) => onNameChange(e.target.value)} />
          </div>
          {exercises.length > 0 ? <DraftList exercises={exercises} onMove={onMove} onRemove={onRemove} /> : <p className="text-sm text-muted-foreground">No exercises</p>}
          {problem && name !== "" && <Hint>{problem}</Hint>}
          {problem && name === "" && <Hint>Name required</Hint>}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </form>
        <SheetFooter>
          <Button type="submit" form="workout-form" size="lg" className="h-12" disabled={Boolean(problem) || pending}>
            {pending ? "Saving…" : saveLabel}
          </Button>
          <Button type="button" variant="outline" className="h-11" disabled={pending} onClick={onClear}>
            Start over
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
