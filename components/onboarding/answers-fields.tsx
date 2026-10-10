"use client";

import type { ReactNode } from "react";
import { NumberStepper } from "@/components/profile/number-stepper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DAILY_ACTIVITIES, INTENSITIES, MAX_NOTES_LENGTH, type DailyActivity, type Intensity } from "@/lib/nutrition-plan";
import { parseDecimalInput } from "@/lib/numbers";
import type { Profile } from "@/lib/queries/profile";

/** What the questionnaire asks (and "Gerir perfil" edits), as the texts of the fields. */
export interface AnswersForm {
  sex: "male" | "female" | null;
  age: string;
  height: string;
  weight: string;
  fat: string;
  lean: string;
  daily: DailyActivity | null;
  aerobic: string;
  anaerobic: string;
  intensity: Intensity | null;
  notes: string;
}

type Patch = (changes: Partial<AnswersForm>) => void;

export const round1 = (n: number) => String(Math.round(n * 10) / 10);

/** The saved answers as field texts. `defaults`: the questionnaire starts the weekly sessions at 2; the profile form leaves them blank. */
export function answersFromProfile(profile: Profile, { defaults }: { defaults: boolean }): AnswersForm {
  const fat = profile.body_fat_pct;
  const sessions = (value: number | null) => value?.toString() ?? (defaults ? "2" : "");
  return {
    sex: profile.sex === "male" || profile.sex === "female" ? profile.sex : null,
    age: profile.age?.toString() ?? "",
    height: profile.height_cm?.toString() ?? "",
    weight: profile.weight_kg?.toString() ?? "",
    fat: fat === null ? "" : round1(fat),
    lean: fat === null ? "" : round1(100 - fat),
    daily: DAILY_ACTIVITIES.some((d) => d.key === profile.daily_activity) ? (profile.daily_activity as DailyActivity) : null,
    aerobic: sessions(profile.aerobic_sessions_per_week),
    anaerobic: sessions(profile.anaerobic_sessions_per_week),
    intensity: INTENSITIES.some((i) => i.key === profile.training_intensity) ? (profile.training_intensity as Intensity) : null,
    notes: profile.training_notes ?? "",
  };
}

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

export function AboutYou({ form, patch }: { form: AnswersForm; patch: Patch }) {
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

export function BodyComposition({ form, patch }: { form: AnswersForm; patch: Patch }) {
  const fromFat = (text: string) => {
    const n = parseDecimalInput(text);
    patch({ fat: text, lean: n === null ? "" : round1(100 - n) });
  };
  const fromLean = (text: string) => {
    const n = parseDecimalInput(text);
    patch({ lean: text, fat: n === null ? "" : round1(100 - n) });
  };
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field id="onb-fat" label="% massa gorda">
        <Input id="onb-fat" inputMode="decimal" className="h-11" value={form.fat} onChange={(e) => fromFat(e.target.value)} />
      </Field>
      <Field id="onb-lean" label="% massa magra">
        <Input id="onb-lean" inputMode="decimal" className="h-11" value={form.lean} onChange={(e) => fromLean(e.target.value)} />
      </Field>
    </div>
  );
}

export function DailyLife({ form, patch }: { form: AnswersForm; patch: Patch }) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 text-sm font-medium">Quão ativo é o teu dia a dia?</legend>
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

export function Activity({ form, patch }: { form: AnswersForm; patch: Patch }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label>Treinos aeróbicos por semana</Label>
        <NumberStepper label="Treinos aeróbicos por semana" value={form.aerobic} onChange={(aerobic) => patch({ aerobic })} step={1} min={0} max={14} unit="x" fallback={0} />
        <p className="text-xs text-muted-foreground">Corrida, ciclismo, natação, ténis…</p>
      </div>
      <div className="flex flex-col gap-2">
        <Label>Treinos anaeróbicos por semana</Label>
        <NumberStepper label="Treinos anaeróbicos por semana" value={form.anaerobic} onChange={(anaerobic) => patch({ anaerobic })} step={1} min={0} max={14} unit="x" fallback={0} />
        <p className="text-xs text-muted-foreground">Musculação, força, HIIT…</p>
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
      <Field id="onb-notes" label="Notas sobre os treinos (opcional)">
        <Textarea
          id="onb-notes"
          className="min-h-28 text-base"
          maxLength={MAX_NOTES_LENGTH}
          placeholder="Ex: musculação 4x por semana, 1h; corrida de 5 km ao sábado"
          value={form.notes}
          onChange={(e) => patch({ notes: e.target.value })}
        />
      </Field>
    </div>
  );
}
