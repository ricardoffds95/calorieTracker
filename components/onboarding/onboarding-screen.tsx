"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GoalModePicker } from "@/components/profile/goal-mode-picker";
import { NumberStepper } from "@/components/profile/number-stepper";
import { PlanResult } from "@/components/onboarding/plan-result";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/hint";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type { GoalMode } from "@/lib/macros";
import { DAILY_ACTIVITIES, INTENSITIES, MAX_NOTES_LENGTH, planAnswersSchema, type DailyActivity, type Intensity, type NutritionPlan, type PlanAnswers } from "@/lib/nutrition-plan";
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

interface Form {
  sex: "male" | "female" | null;
  age: string;
  height: string;
  weight: string;
  fat: string;
  lean: string;
  goal: GoalMode | null;
  daily: DailyActivity | null;
  aerobic: string;
  anaerobic: string;
  intensity: Intensity | null;
  notes: string;
}

const round1 = (n: number) => String(Math.round(n * 10) / 10);

function initialForm(profile: Profile, fromProfile: boolean): Form {
  const fat = profile.body_fat_pct;
  return {
    sex: profile.sex === "male" || profile.sex === "female" ? profile.sex : null,
    age: profile.age?.toString() ?? "",
    height: profile.height_cm?.toString() ?? "",
    weight: profile.weight_kg?.toString() ?? "",
    fat: fat === null ? "" : round1(fat),
    lean: fat === null ? "" : round1(100 - fat),
    // A new user chooses; someone redoing the plan starts from the goal they have.
    goal: fromProfile ? (profile.mode as GoalMode) : null,
    daily: DAILY_ACTIVITIES.some((d) => d.key === profile.daily_activity) ? (profile.daily_activity as DailyActivity) : null,
    aerobic: String(profile.aerobic_sessions_per_week ?? 2),
    anaerobic: String(profile.anaerobic_sessions_per_week ?? 2),
    intensity: profile.training_intensity === "low" || profile.training_intensity === "moderate" || profile.training_intensity === "high" ? profile.training_intensity : null,
    notes: profile.training_notes ?? "",
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

type Result = { plan: NutritionPlan; summary: string; source: "ai" | "standard" };

function Flow({ userId, profile, fromProfile }: { userId: string; profile: Profile; fromProfile: boolean }) {
  const router = useRouter();
  const save = useSaveOnboarding(userId);
  const [form, setForm] = useState(() => initialForm(profile, fromProfile));
  const [step, setStep] = useState(0);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

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
    if (response.ok) setResult({ plan: response.plan, summary: response.summary, source: response.source });
    else setError(response.message);
  }

  function apply(then: () => void) {
    const parsed = planAnswersSchema.safeParse(toCandidate(form));
    if (!parsed.success || !result) return;
    const a: PlanAnswers = parsed.data;
    save.mutate(
      {
        mode: a.goal,
        goal_calories: result.plan.calories,
        goal_protein: result.plan.protein_g,
        goal_carbs: result.plan.carbs_g,
        goal_fat: result.plan.fat_g,
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
      {!result && step === 1 && <BodyComposition form={form} patch={patch} />}
      {!result && step === 2 && <GoalModePicker value={form.goal} onChange={(goal) => patch({ goal })} />}
      {!result && step === 3 && <DailyLife form={form} patch={patch} />}
      {!result && step === 4 && <Activity form={form} patch={patch} />}

      {result && (
        <PlanResult
          plan={result.plan}
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

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function AboutYou({ form, patch }: { form: Form; patch: (changes: Partial<Form>) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Sexo</legend>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["male", "Masculino"],
              ["female", "Feminino"],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              type="button"
              variant="outline"
              aria-pressed={form.sex === value}
              className="h-11 aria-pressed:border-primary aria-pressed:text-primary"
              onClick={() => patch({ sex: value })}
            >
              {label}
            </Button>
          ))}
        </div>
      </fieldset>
      <Field id="onb-age" label="Idade">
        <Input id="onb-age" inputMode="numeric" className="h-11" value={form.age} onChange={(e) => patch({ age: e.target.value })} />
      </Field>
      <Field id="onb-height" label="Altura (cm)">
        <Input id="onb-height" inputMode="numeric" className="h-11" value={form.height} onChange={(e) => patch({ height: e.target.value })} />
      </Field>
      <Field id="onb-weight" label="Peso (kg)">
        <Input id="onb-weight" inputMode="decimal" className="h-11" value={form.weight} onChange={(e) => patch({ weight: e.target.value })} />
      </Field>
    </div>
  );
}

function BodyComposition({ form, patch }: { form: Form; patch: (changes: Partial<Form>) => void }) {
  const fromFat = (text: string) => {
    const n = parseDecimalInput(text);
    patch({ fat: text, lean: n === null ? "" : round1(100 - n) });
  };
  const fromLean = (text: string) => {
    const n = parseDecimalInput(text);
    patch({ lean: text, fat: n === null ? "" : round1(100 - n) });
  };
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">Opcional. Se souberes (de uma balança de bioimpedância, por exemplo), o cálculo fica mais preciso. Preenche um dos campos e o outro acompanha.</p>
      <div className="grid grid-cols-2 gap-3">
        <Field id="onb-fat" label="% massa gorda">
          <Input id="onb-fat" inputMode="decimal" className="h-11" value={form.fat} onChange={(e) => fromFat(e.target.value)} />
        </Field>
        <Field id="onb-lean" label="% massa magra">
          <Input id="onb-lean" inputMode="decimal" className="h-11" value={form.lean} onChange={(e) => fromLean(e.target.value)} />
        </Field>
      </div>
      <p className="text-xs text-muted-foreground">Se não souberes, avança: usamos só o peso, a altura e a idade.</p>
    </div>
  );
}

function DailyLife({ form, patch }: { form: Form; patch: (changes: Partial<Form>) => void }) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 text-sm font-medium">Fora do treino, quão ativo é o teu dia a dia?</legend>
      <p className="text-sm text-muted-foreground">Pensa no trabalho e nas deslocações: quem trabalha em casa gasta muito menos do que quem passa o dia numa obra.</p>
      {DAILY_ACTIVITIES.map(({ key, label, description }) => (
        <Button
          key={key}
          type="button"
          variant="outline"
          aria-pressed={form.daily === key}
          className="h-auto min-h-14 flex-col items-start gap-0.5 px-4 py-3 text-left whitespace-normal aria-pressed:border-primary aria-pressed:text-primary"
          onClick={() => patch({ daily: key })}
        >
          <span>{label}</span>
          <span className="text-xs leading-tight font-normal text-muted-foreground">{description}</span>
        </Button>
      ))}
    </fieldset>
  );
}

function Activity({ form, patch }: { form: Form; patch: (changes: Partial<Form>) => void }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label>Treinos aeróbicos por semana</Label>
        <NumberStepper label="Treinos aeróbicos por semana" value={form.aerobic} onChange={(aerobic) => patch({ aerobic })} step={1} min={0} max={14} unit="x" fallback={0} />
        <p className="text-xs text-muted-foreground">Corrida, ciclismo, natação, caminhadas rápidas, ténis, futebol…</p>
      </div>
      <div className="flex flex-col gap-2">
        <Label>Treinos anaeróbicos por semana</Label>
        <NumberStepper label="Treinos anaeróbicos por semana" value={form.anaerobic} onChange={(anaerobic) => patch({ anaerobic })} step={1} min={0} max={14} unit="x" fallback={0} />
        <p className="text-xs text-muted-foreground">Musculação, treino de força, HIIT, crossfit, calistenia…</p>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Intensidade dos treinos</legend>
        <div className="grid grid-cols-3 gap-2">
          {INTENSITIES.map(({ key, label, description }) => (
            <Button
              key={key}
              type="button"
              variant="outline"
              aria-pressed={form.intensity === key}
              className="h-auto min-h-11 flex-col gap-0.5 px-1 py-2 whitespace-normal aria-pressed:border-primary aria-pressed:text-primary"
              onClick={() => patch({ intensity: key })}
            >
              <span>{label}</span>
              <span className="text-xs leading-tight font-normal text-muted-foreground">{description}</span>
            </Button>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="onb-notes">Notas sobre os teus treinos (opcional)</Label>
        <Textarea
          id="onb-notes"
          className="min-h-32 text-base"
          maxLength={MAX_NOTES_LENGTH}
          placeholder="Explica como quiseres, ao pormenor: que treinos fazes, quanto duram, em que dias, o que fazes no trabalho… Ex: musculação 4x por semana (1h, pernas e costas à segunda), corrida de 5 km ao sábado, trabalho sentado."
          value={form.notes}
          onChange={(e) => patch({ notes: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">Quanto mais detalhe, melhor o plano. Só serve para este cálculo.</p>
      </div>
    </div>
  );
}
