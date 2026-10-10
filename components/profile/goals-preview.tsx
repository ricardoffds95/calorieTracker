import { calculateMacrosFromCalories } from "@/lib/macros";

interface GoalsPreviewProps {
  calories: number;
  proteinPct: number;
  carbsPct: number;
  fatPct: number;
}

export function GoalsPreview({ calories, proteinPct, carbsPct, fatPct }: GoalsPreviewProps) {
  const goals = calculateMacrosFromCalories(calories, proteinPct / 100, carbsPct / 100, fatPct / 100);
  const items = [
    { label: "Calorias", value: goals.calories, unit: "kcal", tone: "text-foreground" },
    { label: "Proteína", value: goals.protein, unit: "g", tone: "text-protein" },
    { label: "Hidratos", value: goals.carbs, unit: "g", tone: "text-carbs" },
    { label: "Gordura", value: goals.fat, unit: "g", tone: "text-fat" },
  ];
  return (
    <section aria-label="Pré-visualização das metas" data-testid="goals-preview" className="rounded-md bg-muted p-4">
      <h3 className="mb-3 text-sm font-medium">Pré-visualização</h3>
      <dl className="grid grid-cols-4 gap-2 text-center">
        {items.map(({ label, value, unit, tone }) => (
          <div key={label}>
            <dd className={`text-lg font-semibold tabular-nums ${tone}`}>{value}</dd>
            <dd className="text-xs text-muted-foreground">{unit}</dd>
            <dt className="text-xs text-muted-foreground">{label}</dt>
          </div>
        ))}
      </dl>
    </section>
  );
}
