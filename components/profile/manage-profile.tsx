"use client";

import { useState, type FormEvent } from "react";
import { ChevronDown } from "lucide-react";
import { Activity, AboutYou, BodyComposition, DailyLife, answersFromProfile, type AnswersForm } from "@/components/onboarding/answers-fields";
import { LogoutButton } from "@/components/auth/logout-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Hint } from "@/components/ui/hint";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseProfileData, toProfileDataUpdate } from "@/lib/profile-data";
import { useUpdateProfile, type Profile } from "@/lib/queries/profile";
import { cn } from "@/lib/utils";

/** The account: the e-mail, "Gerir perfil" (the name and the personal data of the questionnaire, edited by hand; all optional but the name) and the sign out. */
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

  const summary = [profile.name, profile.weight_kg !== null ? `${profile.weight_kg} kg` : null, profile.height_cm !== null ? `${profile.height_cm} cm` : null].filter(Boolean).join(" · ");

  return (
    <Card data-testid="manage-profile">
      <CardHeader>
        <CardTitle className="text-base">Conta</CardTitle>
        <p data-testid="user-email" className="text-sm text-muted-foreground">
          {email}
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <button type="button" aria-expanded={open} aria-controls="manage-profile-form" onClick={() => setOpen((o) => !o)} className="flex min-h-11 items-center justify-between gap-3 rounded-md border border-border px-4 py-2 text-left">
          <span className="flex flex-col">
            <span className="text-sm font-medium">Gerir perfil</span>
            <span className="text-sm text-muted-foreground">{summary}</span>
          </span>
          <ChevronDown aria-hidden className={cn("size-5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
        </button>
        {open && (
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
        )}
        <LogoutButton userId={profile.user_id} />
      </CardContent>
    </Card>
  );
}
