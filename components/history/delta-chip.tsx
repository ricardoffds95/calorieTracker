import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import type { PeriodKind } from "@/lib/history";

const VERSUS: Record<PeriodKind, string> = { week: "last week", month: "last month", year: "last year", custom: "the range before" };

/** The change of the average against the period before: just a direction and a percentage, no good or bad (goals change over time). */
export function DeltaChip({ percent, kind }: { percent: number | null; kind: PeriodKind }) {
  if (percent === null) return null;
  const Icon = percent > 0 ? ArrowUp : percent < 0 ? ArrowDown : Minus;
  return (
    <span data-testid="delta-chip" className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs tabular-nums">
      <Icon aria-hidden className="size-3" />
      <span>{percent > 0 ? `+${percent}` : percent}%</span>{" "}
      <span className="text-muted-foreground">vs {VERSUS[kind]}</span>
    </span>
  );
}
