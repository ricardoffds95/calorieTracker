import type { MacroTotals } from "@/lib/macros";
import { macroSplit } from "@/lib/history";
import { cn } from "@/lib/utils";

const MACROS = [
  { key: "protein", label: "Proteína", text: "text-protein" },
  { key: "carbs", label: "Hidratos", text: "text-carbs" },
  { key: "fat", label: "Gordura", text: "text-fat" },
] as const;

/** Average grams per logged day and each macro's share of the calories. No goals: they change over time. */
export function MacroAverages({ average }: { average: MacroTotals }) {
  const split = macroSplit(average);
  return (
    <section aria-label="Macros em média por dia registado" className="grid grid-cols-3 gap-4">
      {MACROS.map(({ key, label, text }) => (
        <div key={key} data-testid={`macro-${key}`} className="flex flex-col gap-1">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="tabular-nums">
            <span className={cn("text-xl font-semibold", text)}>{average[key]}</span>
            <span className="text-xs text-muted-foreground"> g</span>
          </p>
          <p className="text-xs text-muted-foreground tabular-nums">{split[key]}% das kcal</p>
        </div>
      ))}
    </section>
  );
}
