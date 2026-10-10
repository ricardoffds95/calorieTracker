"use client";

import { useState, type FormEvent } from "react";
import { ChevronDown } from "lucide-react";
import { useUnsavedEntry } from "@/components/profile/unsaved-guard";
import { Activity, AboutYou, BodyComposition, DailyLife, answersFromProfile, type AnswersForm } from "@/components/onboarding/answers-fields";
import { LogoutButton } from "@/components/auth/logout-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Hint } from "@/components/ui/hint";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseDecimalInput } from "@/lib/numbers";
import { parseProfileData, toProfileDataUpdate } from "@/lib/profile-data";
import { useUpdateProfile, type Profile } from "@/lib/queries/profile";
import { cn } from "@/lib/utils";

/** "Gerir perfil": the account (e-mail, sign out) and the name and personal data of the questionnaire, edited by hand (all optional but the name). */
export function ManageProfile({ profile, email }: { profile: Profile; email: string }) {
  const [open, setOpen] = useState(false);
  const update = useUpdateProfile(profile.user_id, "Dados guardados");
  const [name, setName] = useState(profile.name);
  const [form, setForm] = useState<AnswersForm>(() => answersFromProfile(profile, { defaults: false }));
  const patch = (changes: Partial<AnswersForm>) => setForm((f) => ({ ...f, ...changes }));

  const parsed = parseProfileData({ name, ...form });
  const next = parsed.success ? toProfileDataUpdate(parsed.data) : null;
  const dirty = next !== null && (Object.keys(next) as (keyof typeof next)[]).some((key) => next[key] !== (profile[key as keyof Profile] ?? null));
  const problems = parsed.success ? [] : [...new Set(parsed.error.issues.map((i) => i.message))];

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (next && dirty) update.mutate(next);
  }

  // Anything typed that is not what is saved counts as an unsaved change, even when it is not valid yet.
  const saved = answersFromProfile(profile, { defaults: false });
  // "61,5" and "61.5", or a trailing space, are the same value: compare what would be saved, not the text
  const same = (a: string, b: string) => (parseDecimalInput(a) !== null && parseDecimalInput(b) !== null ? parseDecimalInput(a) === parseDecimalInput(b) : a.trim() === b.trim());
  const edited =
    name.trim() !== profile.name ||
    (Object.keys(saved) as (keyof AnswersForm)[]).some((key) => {
      if (key === "lean") return false; // follows the fat
      const [current, original] = [form[key], saved[key]];
      return typeof current === "string" && typeof original === "string" ? !same(current, original) : current !== original;
    });

  useUnsavedEntry("manage", { dirty: edited, valid: parsed.success, save: () => (next ? update.mutateAsync(next) : Promise.reject(new Error("invalid"))) });

  const summary = [profile.name, profile.weight_kg !== null ? `${profile.weight_kg} kg` : null, profile.height_cm !== null ? `${profile.height_cm} cm` : null].filter(Boolean).join(" · ");

  return (
    <Card data-testid="manage-profile">
      <CardHeader>
        <button type="button" aria-expanded={open} aria-controls="manage-profile-content" onClick={() => setOpen((o) => !o)} className="flex min-h-11 items-center justify-between gap-3 text-left">
          <span className="flex flex-col">
            <CardTitle className="text-base">Gerir perfil</CardTitle>
            <span className="text-sm text-muted-foreground">{summary}</span>
          </span>
          <ChevronDown aria-hidden className={cn("size-5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
        </button>
      </CardHeader>
      {open && (
        <CardContent id="manage-profile-content" className="flex flex-col gap-6">
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-medium">Conta</p>
            <p data-testid="user-email" className="text-sm text-muted-foreground">
              {email}
            </p>
          </div>
          <form id="manage-profile-form" onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="profile-name">Nome</Label>
              <Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} className="h-11" maxLength={60} autoComplete="given-name" />
            </div>
            <AboutYou form={form} patch={patch} />
            <BodyComposition form={form} patch={patch} />
            <DailyLife form={form} patch={patch} />
            <Activity form={form} patch={patch} />
            {problems.length > 0 && <Hint>{problems.join(" ")}</Hint>}
            {parsed.success && !dirty && <p className="text-center text-sm text-muted-foreground">Sem alterações.</p>}
            <Button type="submit" size="lg" className="h-11" disabled={!parsed.success || !dirty || update.isPending}>
              {update.isPending ? "A guardar…" : "Guardar dados"}
            </Button>
          </form>
          <LogoutButton userId={profile.user_id} />
        </CardContent>
      )}
    </Card>
  );
}
