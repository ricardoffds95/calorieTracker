import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/hint";
import type { NutritionPlan } from "@/lib/nutrition-plan";

interface PlanResultProps {
  plan: NutritionPlan;
  summary: string;
  source: "ai" | "standard";
  pending: boolean;
  onUse: () => void;
  onAdjust: () => void;
  onBack: () => void;
}

/** The proposed calories and macros, why, and what to do with them. */
export function PlanResult({ plan, summary, source, pending, onUse, onAdjust, onBack }: PlanResultProps) {
  const macros = [
    { label: "Proteína", value: plan.protein_g, tone: "text-protein" },
    { label: "Hidratos", value: plan.carbs_g, tone: "text-carbs" },
    { label: "Gordura", value: plan.fat_g, tone: "text-fat" },
  ];
  return (
    <div className="flex flex-col gap-5" data-testid="plan-result">
      <div>
        <p className="text-5xl font-semibold tabular-nums" data-testid="plan-calories">
          {plan.calories}
        </p>
        <p className="text-sm text-muted-foreground">kcal por dia</p>
      </div>
      <dl className="grid grid-cols-3 gap-3 rounded-md bg-muted p-4 text-center">
        {macros.map(({ label, value, tone }) => (
          <div key={label}>
            <dd className={`text-2xl font-semibold tabular-nums ${tone}`}>{value} g</dd>
            <dt className="text-xs text-muted-foreground">{label}</dt>
          </div>
        ))}
      </dl>
      {summary && <p className="text-sm">{summary}</p>}
      {source === "standard" && <Hint>A IA não esteve disponível ou deu valores pouco fiáveis, por isso usei um cálculo padrão.</Hint>}
      <p className="text-xs text-muted-foreground">É uma estimativa para te orientar, não aconselhamento médico. Podes ajustar tudo no Perfil quando quiseres.</p>
      <div className="flex flex-col gap-2">
        <Button type="button" size="lg" className="h-11" disabled={pending} onClick={onUse}>
          {pending ? "A guardar…" : "Usar este plano"}
        </Button>
        <Button type="button" variant="outline" size="lg" className="h-11" disabled={pending} onClick={onAdjust}>
          Usar e ajustar à mão
        </Button>
        <Button type="button" variant="ghost" className="h-11" disabled={pending} onClick={onBack}>
          Mudar as respostas
        </Button>
      </div>
    </div>
  );
}
