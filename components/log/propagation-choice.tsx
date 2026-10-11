import { Button } from "@/components/ui/button";
import type { PropagationScope } from "@/lib/log";

interface PropagationChoiceProps {
  linked: { all: number; fromToday: number };
  pending: boolean;
  onChoose: (scope: PropagationScope) => void;
  onBack: () => void;
}

const entries = (n: number) => `${n} ${n === 1 ? "entry" : "entries"}`;

/** After editing a saved item: apply the change to the diary from today on, to the whole history, or not at all. */
export function PropagationChoice({ linked, pending, onChoose, onBack }: PropagationChoiceProps) {
  return (
    <div className="flex flex-col gap-3" role="group" aria-label="Update diary">
      <p className="text-sm">
        Used in <strong>{entries(linked.all)}</strong>. Update the diary?
      </p>
      <Button type="button" size="lg" className="h-auto min-h-11 flex-col items-start gap-0.5 py-2 text-left" disabled={pending || linked.fromToday === 0} onClick={() => onChoose("from_today")}>
        <span>From today</span>
        <span className="text-xs font-normal opacity-80">{entries(linked.fromToday)}</span>
      </Button>
      <Button type="button" variant="outline" size="lg" className="h-auto min-h-11 flex-col items-start gap-0.5 py-2 text-left" disabled={pending} onClick={() => onChoose("all")}>
        <span>All history</span>
        <span className="text-xs font-normal text-muted-foreground">{entries(linked.all)}</span>
      </Button>
      <Button type="button" variant="ghost" size="lg" className="h-11" disabled={pending} onClick={() => onChoose("none")}>
        Saved only
      </Button>
      <Button type="button" variant="ghost" className="h-11 text-muted-foreground" disabled={pending} onClick={onBack}>
        Back
      </Button>
    </div>
  );
}
