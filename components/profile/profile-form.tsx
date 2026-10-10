"use client";

import { useState, type FormEvent } from "react";
import { GoalModePicker } from "@/components/profile/goal-mode-picker";
import { GoalsPreview } from "@/components/profile/goals-preview";
import { MacroSplit, type MacroPercentInputs } from "@/components/profile/macro-split";
import { NumberStepper } from "@/components/profile/number-stepper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { GoalMode } from "@/lib/macros";
import {
  CALORIE_STEP,
  MAX_CALORIES,
  MIN_CALORIES,
  parseIntegerInput,
  percentagesFromGoals,
  presetPercentages,
  profileFormSchema,
  toProfileUpdate,
} from "@/lib/profile";
import { useUpdateProfile, type Profile } from "@/lib/queries/profile";

function initialPercentages(profile: Profile): MacroPercentInputs {
  const p = percentagesFromGoals({ protein: profile.goal_protein, carbs: profile.goal_carbs, fat: profile.goal_fat });
  return { protein: String(p.protein), carbs: String(p.carbs), fat: String(p.fat) };
}

const asNumber = (text: string) => parseIntegerInput(text) ?? Number.NaN;

export function ProfileForm({ profile }: { profile: Profile }) {
  const update = useUpdateProfile(profile.user_id);
  const [name, setName] = useState(profile.name);
  const [mode, setMode] = useState(profile.mode as GoalMode);
  const [calories, setCalories] = useState(String(profile.goal_calories));
  const [pcts, setPcts] = useState<MacroPercentInputs>(() => initialPercentages(profile));

  const values = {
    name,
    mode,
    calories: asNumber(calories),
    proteinPct: asNumber(pcts.protein),
    carbsPct: asNumber(pcts.carbs),
    fatPct: asNumber(pcts.fat),
  };
  const parsed = profileFormSchema.safeParse(values);
  const total = [pcts.protein, pcts.carbs, pcts.fat].reduce((sum, text) => sum + (parseIntegerInput(text) ?? 0), 0);
  const caloriesError = parsed.success ? undefined : parsed.error.issues.find((i) => i.path[0] === "calories")?.message;
  const nameError = parsed.success ? undefined : parsed.error.issues.find((i) => i.path[0] === "name")?.message;

  const next = parsed.success ? toProfileUpdate(parsed.data) : null;
  const dirty =
    next !== null &&
    (next.name !== profile.name ||
      next.mode !== profile.mode ||
      next.goal_calories !== profile.goal_calories ||
      next.goal_protein !== profile.goal_protein ||
      next.goal_carbs !== profile.goal_carbs ||
      next.goal_fat !== profile.goal_fat);

  function selectMode(newMode: GoalMode) {
    const preset = presetPercentages(newMode);
    setMode(newMode);
    setPcts({ protein: String(preset.protein), carbs: String(preset.carbs), fat: String(preset.fat) });
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (next && dirty) update.mutate(next);
  }

  const previewCalories = Number.isFinite(values.calories) ? values.calories : profile.goal_calories;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="profile-name">O teu nome</Label>
        <Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} className="h-11" maxLength={60} autoComplete="given-name" />
        {nameError && (
          <p role="alert" className="text-sm text-destructive">
            {nameError}
          </p>
        )}
      </div>

      <GoalModePicker value={mode} onChange={selectMode} />

      <div className="flex flex-col gap-2">
        <Label>Calorias diárias</Label>
        <NumberStepper
          label="Calorias diárias"
          value={calories}
          onChange={setCalories}
          step={CALORIE_STEP}
          min={MIN_CALORIES}
          max={MAX_CALORIES}
          unit="kcal"
          fallback={profile.goal_calories}
          invalid={Boolean(caloriesError)}
        />
        {caloriesError && (
          <p role="alert" className="text-sm text-destructive">
            {caloriesError}
          </p>
        )}
      </div>

      <MacroSplit values={pcts} onChange={(key, value) => setPcts((p) => ({ ...p, [key]: value }))} total={total} />

      <GoalsPreview
        calories={previewCalories}
        proteinPct={values.proteinPct || 0}
        carbsPct={values.carbsPct || 0}
        fatPct={values.fatPct || 0}
      />

      {parsed.success && !dirty && <p className="text-center text-sm text-muted-foreground">Sem alterações para guardar.</p>}
      <Button type="submit" size="lg" disabled={!parsed.success || !dirty || update.isPending}>
        {update.isPending ? "A guardar…" : "Guardar objetivos"}
      </Button>
    </form>
  );
}
