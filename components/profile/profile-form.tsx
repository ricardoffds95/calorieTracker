"use client";

import { useState, type FormEvent } from "react";
import { GoalModePicker } from "@/components/profile/goal-mode-picker";
import { MacroGrams, type MacroGramInputs } from "@/components/profile/macro-grams";
import { MacroSplit, type MacroPercentInputs } from "@/components/profile/macro-split";
import { NumberStepper } from "@/components/profile/number-stepper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { calculateTotalCalories, type GoalMode } from "@/lib/macros";
import {
  CALORIE_STEP,
  gramsFromPercentages,
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

function initialGrams(profile: Profile): MacroGramInputs {
  return { protein: String(profile.goal_protein), carbs: String(profile.goal_carbs), fat: String(profile.goal_fat) };
}

/** Grams for a calorie target and percentages, or null while any of the texts is not a whole number. */
function gramsFor(calories: string, pcts: MacroPercentInputs): MacroGramInputs | null {
  const values = [calories, pcts.protein, pcts.carbs, pcts.fat].map(parseIntegerInput);
  if (values.some((v) => v === null)) return null;
  const [kcal, protein, carbs, fat] = values as number[];
  const g = gramsFromPercentages(kcal!, { protein: protein!, carbs: carbs!, fat: fat! });
  return { protein: String(g.protein), carbs: String(g.carbs), fat: String(g.fat) };
}

export function ProfileForm({ profile }: { profile: Profile }) {
  const update = useUpdateProfile(profile.user_id);
  const [name, setName] = useState(profile.name);
  const [mode, setMode] = useState(profile.mode as GoalMode);
  const [calories, setCalories] = useState(String(profile.goal_calories));
  const [pcts, setPcts] = useState<MacroPercentInputs>(() => initialPercentages(profile));
  const [grams, setGrams] = useState<MacroGramInputs>(() => initialGrams(profile));

  const values = {
    name,
    mode,
    calories: asNumber(calories),
    proteinPct: asNumber(pcts.protein),
    carbsPct: asNumber(pcts.carbs),
    fatPct: asNumber(pcts.fat),
    proteinG: asNumber(grams.protein),
    carbsG: asNumber(grams.carbs),
    fatG: asNumber(grams.fat),
  };
  const parsed = profileFormSchema.safeParse(values);
  const total = [pcts.protein, pcts.carbs, pcts.fat].reduce((sum, text) => sum + (parseIntegerInput(text) ?? 0), 0);
  const caloriesError = parsed.success ? undefined : parsed.error.issues.find((i) => i.path[0] === "calories")?.message;
  const gramsErrors: Partial<Record<keyof MacroGramInputs, string>> = {};
  if (!parsed.success) {
    const keys = { proteinG: "protein", carbsG: "carbs", fatG: "fat" } as const;
    for (const issue of parsed.error.issues) {
      const key = keys[issue.path[0] as keyof typeof keys];
      if (key) gramsErrors[key] ??= issue.message;
    }
  }
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
    const nextPcts = { protein: String(preset.protein), carbs: String(preset.carbs), fat: String(preset.fat) };
    setMode(newMode);
    setPcts(nextPcts);
    const g = gramsFor(calories, nextPcts);
    if (g) setGrams(g);
  }

  // The calories, the percentages and the grams are three ways of editing the same goal; each one updates the others.
  function changeCalories(text: string) {
    setCalories(text);
    const g = gramsFor(text, pcts);
    if (g) setGrams(g);
  }

  function changePercent(key: keyof MacroPercentInputs, text: string) {
    const nextPcts = { ...pcts, [key]: text };
    setPcts(nextPcts);
    const g = gramsFor(calories, nextPcts);
    if (g) setGrams(g);
  }

  function changeGrams(key: keyof MacroGramInputs, text: string) {
    const nextGrams = { ...grams, [key]: text };
    setGrams(nextGrams);
    const [protein, carbs, fat] = [nextGrams.protein, nextGrams.carbs, nextGrams.fat].map(parseIntegerInput);
    if (protein === null || carbs === null || fat === null || protein === undefined || carbs === undefined || fat === undefined) return;
    const kcal = calculateTotalCalories(protein, carbs, fat);
    setCalories(String(kcal));
    if (kcal > 0) {
      const p = percentagesFromGoals({ protein, carbs, fat });
      setPcts({ protein: String(p.protein), carbs: String(p.carbs), fat: String(p.fat) });
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (next && dirty) update.mutate(next);
  }

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
          onChange={changeCalories}
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

      <MacroSplit values={pcts} onChange={changePercent} total={total} />

      <MacroGrams values={grams} onChange={changeGrams} calories={values.calories} errors={gramsErrors} />

      {parsed.success && !dirty && <p className="text-center text-sm text-muted-foreground">Sem alterações para guardar.</p>}
      <Button type="submit" size="lg" disabled={!parsed.success || !dirty || update.isPending}>
        {update.isPending ? "A guardar…" : "Guardar objetivos"}
      </Button>
    </form>
  );
}
