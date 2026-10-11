import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/hint";
import type { GoalMode } from "@/lib/macros";
import { GOALS, type PlansByGoal } from "@/lib/nutrition-plan";
import { GOAL_MODE_OPTIONS } from "@/lib/profile";
import { cn } from "@/lib/utils";

const SHORT: Record<GoalMode, string> = { cut: "Lose", maintain: "Maintain", bulk: "Gain" };

interface PlanResultProps {
  plans: PlansByGoal;
  /** The plan on screen; "Usar" makes it the active one. */
  shown: GoalMode;
  onShow: (goal: GoalMode) => void;
  /** The goal chosen in the questionnaire. */
  chosen: GoalMode | null;
  summary: string;
  source: "ai" | "standard";
  pending: boolean;
  onUse: () => void;
  onAdjust: () => void;
  onBack: () => void;
}

/** The three plans (one per goal) of the same person, with the chosen goal's first. All three are kept. */
export function PlanResult({ plans, shown, onShow, chosen, summary, source, pending, onUse, onAdjust, onBack }: PlanResultProps) {
  const plan = plans[shown];
  const macros = [
    { label: "Protein", value: plan.protein_g, tone: "text-protein" },
    { label: "Carbs", value: plan.carbs_g, tone: "text-carbs" },
    { label: "Fat", value: plan.fat_g, tone: "text-fat" },
  ];
  return (
    <div className="flex flex-col gap-5" data-testid="plan-result">
      <div role="group" aria-label="Plan by goal" className="grid grid-cols-3 gap-1 rounded-md bg-muted p-1">
        {GOALS.map((goal) => (
          <Button
            key={goal}
            type="button"
            variant="ghost"
            aria-pressed={shown === goal}
            aria-label={`${GOAL_MODE_OPTIONS.find((o) => o.mode === goal)?.label}${goal === chosen ? " (your goal)" : ""}`}
            className={cn("h-11 flex-col gap-0 text-muted-foreground aria-pressed:bg-card aria-pressed:text-foreground dark:aria-pressed:bg-background")}
            onClick={() => onShow(goal)}
          >
            <span>{SHORT[goal]}</span>
            {goal === chosen && <span className="text-[10px] leading-none text-primary">your goal</span>}
          </Button>
        ))}
      </div>
      <div>
        <p className="text-5xl font-semibold tabular-nums" data-testid="plan-calories">
          {plan.calories}
        </p>
        <p className="text-sm text-muted-foreground">kcal per day</p>
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
      {source === "standard" && <Hint>Standard calculation</Hint>}
      <p className="text-xs text-muted-foreground">All 3 plans are saved</p>
      <div className="flex flex-col gap-2">
        <Button type="button" size="lg" className="h-11" disabled={pending} onClick={onUse}>
          {pending ? "Saving…" : "Use this plan"}
        </Button>
        <Button type="button" variant="outline" size="lg" className="h-11" disabled={pending} onClick={onAdjust}>
          Use and adjust
        </Button>
        <Button type="button" variant="ghost" className="h-11" disabled={pending} onClick={onBack}>
          Edit answers
        </Button>
      </div>
    </div>
  );
}
