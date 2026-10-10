import { ProgressBar } from "@/components/today/progress-bar";
import type { MacroGoals, MacroTotals } from "@/lib/macros";
import { macroColumns } from "@/lib/today";
import { cn } from "@/lib/utils";

const TONES = { protein: "bg-protein", carbs: "bg-carbs", fat: "bg-fat" } as const;
const TEXT = { protein: "text-protein", carbs: "text-carbs", fat: "text-fat" } as const;

export function MacroColumns({ goals, totals }: { goals: MacroGoals; totals: MacroTotals }) {
  return (
    <section aria-label="Macros do dia" className="grid grid-cols-3 gap-4">
      {macroColumns(goals, totals).map((col) => (
        <div key={col.key} data-testid={`macro-${col.key}`} className="flex flex-col gap-1.5">
          <p className="text-xs text-muted-foreground">{col.label}</p>
          <p className="tabular-nums">
            <span className={cn("text-xl font-semibold", col.over ? "text-destructive" : TEXT[col.key])}>{col.consumed}</span>
            <span className="text-xs text-muted-foreground"> / {col.goal} g</span>
          </p>
          <ProgressBar label={col.label} value={col.progress} over={col.over} tone={TONES[col.key]} />
        </div>
      ))}
    </section>
  );
}
