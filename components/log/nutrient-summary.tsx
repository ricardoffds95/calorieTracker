import type { Nutrients } from "@/lib/nutrition";

/** "248 kcal · P 46.5 · C 0 · F 5.4" with the macro tokens. */
export function NutrientSummary({ value, className }: { value: Nutrients; className?: string }) {
  return (
    <p data-testid="nutrient-summary" className={className}>
      <span className="text-2xl font-semibold tabular-nums">{value.calories}</span>
      <span className="text-sm text-muted-foreground"> kcal</span>
      <span className="ml-3 text-sm tabular-nums">
        <span className="text-protein">P {value.protein_g}</span>
        <span className="text-muted-foreground"> · </span>
        <span className="text-carbs">C {value.carbs_g}</span>
        <span className="text-muted-foreground"> · </span>
        <span className="text-fat">F {value.fat_g}</span>
      </span>
    </p>
  );
}
