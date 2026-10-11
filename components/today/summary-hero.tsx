import { ProgressBar } from "@/components/today/progress-bar";
import { describeRemaining } from "@/lib/today";
import { cn } from "@/lib/utils";

export function SummaryHero({ goalCalories, consumed }: { goalCalories: number; consumed: number }) {
  const summary = describeRemaining(goalCalories, consumed);
  return (
    <section aria-label="Day summary" className="flex flex-col gap-3">
      <div>
        <p data-testid="remaining-amount" className={cn("text-6xl font-semibold tracking-tight tabular-nums", summary.over && "text-destructive")}>
          {summary.amount}
        </p>
        <p data-testid="remaining-label" className={cn("text-base", summary.over ? "text-destructive" : "text-muted-foreground")}>
          {summary.label}
        </p>
      </div>
      <p data-testid="consumed-vs-goal" className="text-sm text-muted-foreground tabular-nums">
        {consumed} / {goalCalories} kcal
      </p>
      <ProgressBar label="Calories" value={summary.progress} over={summary.over} tone="bg-primary" />
    </section>
  );
}
