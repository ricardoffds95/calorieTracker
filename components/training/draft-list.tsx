import { ArrowDown, ArrowUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { WorkoutExercise } from "@/lib/training";

interface DraftListProps {
  exercises: readonly WorkoutExercise[];
  onMove: (index: number, direction: -1 | 1) => void;
  onRemove: (id: string) => void;
}

/** The exercises of a workout in order, each one can move up, move down or go. */
export function DraftList({ exercises, onMove, onRemove }: DraftListProps) {
  return (
    <ol data-testid="draft-list" className="flex flex-col">
      {exercises.map((exercise, index) => (
        <li key={exercise.id} className="flex items-center gap-1 border-b border-border last:border-b-0">
          <span className="w-6 shrink-0 text-center text-sm text-muted-foreground tabular-nums">{index + 1}</span>
          <span className="min-w-0 flex-1 py-2 break-words">{exercise.name}</span>
          <Button type="button" variant="ghost" size="icon" className="size-11 shrink-0 text-muted-foreground" aria-label={`Move ${exercise.name} up`} disabled={index === 0} onClick={() => onMove(index, -1)}>
            <ArrowUp aria-hidden />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="size-11 shrink-0 text-muted-foreground" aria-label={`Move ${exercise.name} down`} disabled={index === exercises.length - 1} onClick={() => onMove(index, 1)}>
            <ArrowDown aria-hidden />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="size-11 shrink-0 text-muted-foreground" aria-label={`Remove ${exercise.name} from workout`} onClick={() => onRemove(exercise.id)}>
            <X aria-hidden />
          </Button>
        </li>
      ))}
    </ol>
  );
}
