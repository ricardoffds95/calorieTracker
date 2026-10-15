"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Plus, X } from "lucide-react";
import { ARROW_SLOT, KCAL, ROW_GRID } from "@/components/today/row-layout";
import { Button, buttonVariants } from "@/components/ui/button";
import { useDeleteTraining, useTrainingDay, type TrainingEntry } from "@/lib/queries/training";
import { cn } from "@/lib/utils";

interface TrainingSectionProps {
  userId: string;
  dateKey: string;
}

const countLabel = (n: number) => `${n} ${n === 1 ? "exercise" : "exercises"}`;

/** The trainings done on the day, under the meals. */
export function TrainingSection({ userId, dateKey }: TrainingSectionProps) {
  const training = useTrainingDay(userId, dateKey);
  const remove = useDeleteTraining(userId);
  const entries = training.data ?? [];

  return (
    <section aria-labelledby="training-heading" data-testid="training" className="border-t border-border pt-2">
      <div className={ROW_GRID}>
        <h2 id="training-heading" className="flex min-w-0 items-center justify-between gap-2 px-1 text-base font-semibold">
          <span className="min-w-0 truncate">Training</span>
          <span data-testid="training-count" className={cn(KCAL, "font-normal text-muted-foreground")}>
            {entries.length === 0 ? "—" : entries.length === 1 ? "1 done" : `${entries.length} done`}
          </span>
        </h2>
        <span aria-hidden />
        <Link href={`/training/add?d=${dateKey}`} aria-label="Add to Training" className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "size-11 text-primary")}>
          <Plus aria-hidden />
        </Link>
      </div>
      {training.isError && !training.data && (
        <p role="alert" className="px-1 text-sm text-destructive">
          Couldn’t load training
        </p>
      )}
      {entries.length > 0 && (
        <ul>
          {entries.map((entry) => (
            <TrainingRow key={entry.id} entry={entry} onRemove={() => remove.mutate(entry)} />
          ))}
        </ul>
      )}
    </section>
  );
}

function TrainingRow({ entry, onRemove }: { entry: TrainingEntry; onRemove: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const panelId = `training-items-${entry.id}`;
  return (
    <li data-testid="training-row">
      <div className={ROW_GRID}>
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={panelId}
          aria-label={`${entry.name}, ${countLabel(entry.exercises.length)}`}
          onClick={() => setExpanded((value) => !value)}
          className="grid min-h-11 min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-sm px-1 text-left"
        >
          <span className="flex min-w-0 items-center gap-2">
            <ChevronRight className={cn(ARROW_SLOT, "text-muted-foreground motion-safe:transition-transform", expanded && "rotate-90")} aria-hidden />
            <span className="line-clamp-2 min-w-0 py-1 break-words">{entry.name}</span>
          </span>
          <span className={cn(KCAL, "text-muted-foreground")}>{countLabel(entry.exercises.length)}</span>
        </button>
        <span aria-hidden />
        <Button type="button" variant="ghost" size="icon" className="size-11 text-muted-foreground" aria-label={`Remove ${entry.name}`} onClick={onRemove}>
          <X aria-hidden />
        </Button>
      </div>
      {expanded && (
        <ol id={panelId} className="ml-6 list-decimal border-l border-border py-1 pl-8 text-sm text-muted-foreground">
          {entry.exercises.map((exercise) => (
            <li key={exercise.id}>{exercise.name}</li>
          ))}
        </ol>
      )}
    </li>
  );
}
