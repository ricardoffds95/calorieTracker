"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GoalModePicker } from "@/components/profile/goal-mode-picker";
import { Activity, AboutYou, BodyComposition, DailyLife, answersFromProfile, type AnswersForm } from "@/components/onboarding/answers-fields";
import { PlanResult } from "@/components/onboarding/plan-result";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/hint";
import { Skeleton } from "@/components/ui/skeleton";
import type { GoalMode } from "@/lib/macros";
import type { Json } from "@/lib/supabase/database.types";
import { planAnswersSchema, type PlanAnswers, type PlansByGoal } from "@/lib/nutrition-plan";
import { parseDecimalInput } from "@/lib/numbers";
import { requestPlan } from "@/lib/plan-client";
import { parseIntegerInput } from "@/lib/profile";
import { useProfile, useSaveOnboarding, type Profile } from "@/lib/queries/profile";

const STEPS = [
  { title: "Sobre ti", fields: ["sex", "age", "height_cm", "weight_kg"] },
  { title: "Composição corporal", fields: ["body_fat_pct"] },
  { title: "Objetivo", fields: ["goal"] },
  { title: "O teu dia a dia", fields: ["daily_activity"] },
  { title: "Treino", fields: ["aerobic_sessions", "anaerobic_sessions", "intensity", "notes"] },
] as const;

interface Form extends AnswersForm {
  goal: GoalMode | null;
}

function initialForm(profile: Profile, fromProfile: boolean): Form {
  return {
    ...answersFromProfile(profile, { defaults: true }),
    // A new user chooses; someone redoing the plan starts from the goal they have.
    goal: fromProfile ? (profile.mode as GoalMode) : null,
  };
}

/** The form as the schema reads it; anything not filled in is NaN or undefined so the schema says what is missing. */
function toCandidate(f: Form) {
  return {
    sex: f.sex ?? undefined,
    age: parseIntegerInput(f.age) ?? Number.NaN,
    height_cm: parseIntegerInput(f.height) ?? Number.NaN,
    weight_kg: parseDecimalInput(f.weight) ?? Number.NaN,
    body_fat_pct: f.fat.trim() === "" ? null : (parseDecimalInput(f.fat) ?? Number.NaN),
    goal: f.goal ?? undefined,
    daily_activity: f.daily ?? undefined,
    aerobic_sessions: parseIntegerInput(f.aerobic) ?? Number.NaN,
    anaerobic_sessions: parseIntegerInput(f.anaerobic) ?? Number.NaN,
    intensity: f.intensity ?? undefined,
    notes: f.notes,
  };
}

/** What is wrong in the fields of one step, in words (empty when it is fine). */
function problems(f: Form, step: number): string[] {
  const parsed = planAnswersSchema.safeParse(toCandidate(f));
  if (parsed.success) return [];
  const fields: readonly string[] = STEPS[step]!.fields;
  return [...new Set(parsed.error.issues.filter((i) => fields.includes(String(i.path[0]))).map((i) => i.message))];
}

export function OnboardingScreen({ userId, fromProfile }: { userId: string; fromProfile: boolean }) {
  const profile = useProfile(userId);
  if (profile.isError && !profile.data) {
    return (
      <p role="alert" className="text-sm text-destructive">
        Não foi possível carregar o perfil. Tenta novamente.
      </p>
    );
  }
  if (!profile.data) return <Skeleton className="h-96 w-full" aria-label="A carregar" />;
  return <Flow userId={userId} profile={profile.data} fromProfile={fromProfile} />;
}

type Result = { plans: PlansByGoal; summary: string; source: "ai" | "standard" };

function Flow({ userId, profile, fromProfile }: { userId: string; profile: Profile; fromProfile: boolean }) {
  const router = useRouter();
  const save = useSaveOnboarding(userId);
  const [form, setForm] = useState(() => initialForm(profile, fromProfile));
  const [step, setStep] = useState(0);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [shown, setShown] = useState<GoalMode>("maintain"); // the plan on screen: the chosen goal first

  const patch = (changes: Partial<Form>) => setForm((f) => ({ ...f, ...changes }));
  const leave = () => router.replace(fromProfile ? "/perfil" : "/");
  const missing = result ? [] : problems(form, step);

  function skip() {
    if (fromProfile) return leave();
    save.mutate({}, { onSuccess: leave });
  }

  async function calculate() {
    const parsed = planAnswersSchema.safeParse(toCandidate(form));
    if (!parsed.success) return;
    setError(null);
    setCalculating(true);
    const response = await requestPlan(parsed.data);
    setCalculating(false);
    if (response.ok) {
      setResult({ plans: response.plans, summary: response.summary, source: response.source });
      setShown(form.goal ?? "maintain");
    }
    else setError(response.message);
  }

  function apply(then: () => void) {
    const parsed = planAnswersSchema.safeParse(toCandidate(form));
    if (!parsed.success || !result) return;
    const a: PlanAnswers = parsed.data;
    const plan = result.plans[shown];
    save.mutate(
      {
        mode: shown,
        goal_calories: plan.calories,
        goal_protein: plan.protein_g,
        goal_carbs: plan.carbs_g,
        goal_fat: plan.fat_g,
        saved_plans: result.plans as unknown as Json,
        sex: a.sex,
        age: a.age,
        height_cm: a.height_cm,
        weight_kg: a.weight_kg,
        body_fat_pct: a.body_fat_pct,
        daily_activity: a.daily_activity,
        aerobic_sessions_per_week: a.aerobic_sessions,
        anaerobic_sessions_per_week: a.anaerobic_sessions,
        training_intensity: a.intensity,
        training_notes: a.notes === "" ? null : a.notes,
        plan_summary: result.summary,
        toast: "Plano guardado nos teus objetivos",
      },
      { onSuccess: then },
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Plano nutricional</h1>
          <p className="text-sm text-muted-foreground">{result ? "O teu plano" : `Passo ${step + 1} de ${STEPS.length} · ${STEPS[step]!.title}`}</p>
        </div>
        <Button type="button" variant="ghost" className="h-11 shrink-0 text-muted-foreground" disabled={save.isPending} onClick={skip}>
          {fromProfile ? "Cancelar" : "Saltar por agora"}
        </Button>
      </header>

      {!result && (
        <div role="progressbar" aria-label="Progresso" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step + 1} className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
        </div>
      )}

      {!result && step === 0 && <AboutYou form={form} patch={patch} />}
      {!result && step === 1 && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">Opcional. Deixa em branco se não souberes.</p>
          <BodyComposition form={form} patch={patch} />
        </div>
      )}
      {!result && step === 2 && <GoalModePicker value={form.goal} onChange={(goal) => patch({ goal })} />}
      {!result && step === 3 && <DailyLife form={form} patch={patch} />}
      {!result && step === 4 && <Activity form={form} patch={patch} />}

      {result && (
        <PlanResult
          plans={result.plans}
          shown={shown}
          onShow={setShown}
          chosen={form.goal}
          summary={result.summary}
          source={result.source}
          pending={save.isPending}
          onUse={() => apply(leave)}
          onAdjust={() => apply(() => router.replace("/perfil"))}
          onBack={() => setResult(null)}
        />
      )}

      {!result && missing.length > 0 && <Hint>{missing.join(" ")}</Hint>}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {!result && (
        <div className="flex gap-2">
          {step > 0 && (
            <Button type="button" variant="outline" size="lg" className="h-11 flex-1" disabled={calculating} onClick={() => setStep(step - 1)}>
              Voltar
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button type="button" size="lg" className="h-11 flex-1" disabled={missing.length > 0} onClick={() => setStep(step + 1)}>
              Seguinte
            </Button>
          ) : (
            <Button type="button" size="lg" className="h-11 flex-1" disabled={missing.length > 0 || calculating} onClick={calculate}>
              {calculating ? "A calcular…" : "Calcular o meu plano"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
