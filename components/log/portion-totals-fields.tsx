import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { mealEditSchema } from "@/lib/diary-edit";
import { roundCalories, roundMacro, type FoodItem } from "@/lib/nutrition";
import { parseDecimalInput } from "@/lib/numbers";

/** Totals of 1 portion as typed (text, so fields can be cleared while typing). */
export interface PortionTotals {
  calories: string;
  protein_g: string;
  carbs_g: string;
  fat_g: string;
}

const FIELDS = [
  ["calories", "Calories (kcal)"],
  ["protein_g", "Protein (g)"],
  ["carbs_g", "Carbs (g)"],
  ["fat_g", "Fat (g)"],
] as const;

export function totalsFromItem(item: FoodItem): PortionTotals {
  return { calories: String(item.calories), protein_g: String(item.protein_g), carbs_g: String(item.carbs_g), fat_g: String(item.fat_g) };
}

/** A meal defined per portion is one item without grams; null while the values are invalid. */
export function portionItems(name: string, totals: PortionTotals): FoodItem[] | null {
  const num = (t: string) => parseDecimalInput(t) ?? Number.NaN;
  const parsed = mealEditSchema.safeParse({
    name,
    calories: num(totals.calories),
    protein_g: num(totals.protein_g),
    carbs_g: num(totals.carbs_g),
    fat_g: num(totals.fat_g),
  });
  if (!parsed.success) return null;
  const { calories, protein_g, carbs_g, fat_g } = parsed.data;
  return [
    {
      name: parsed.data.name,
      quantity_g: null,
      calories: roundCalories(calories),
      protein_g: roundMacro(protein_g),
      carbs_g: roundMacro(carbs_g),
      fat_g: roundMacro(fat_g),
    },
  ];
}

export function PortionTotalsFields({ value, onChange }: { value: PortionTotals; onChange: (value: PortionTotals) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3" role="group" aria-label="Per portion">
      {FIELDS.map(([key, label]) => (
        <div key={key} className="flex flex-col gap-1.5">
          <Label htmlFor={`portion-${key}`}>{label}</Label>
          <Input
            id={`portion-${key}`}
            inputMode="decimal"
            className="h-11"
            value={value[key]}
            onChange={(e) => onChange({ ...value, [key]: e.target.value })}
          />
        </div>
      ))}
    </div>
  );
}
