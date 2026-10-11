"use client";

import { useState, type FormEvent } from "react";
import { Activity, AboutYou, BodyComposition, DailyLife, answersFromProfile, type AnswersForm } from "@/components/onboarding/answers-fields";
import { useUnsavedEntry } from "@/components/profile/unsaved-guard";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/hint";
import { parseDecimalInput } from "@/lib/numbers";
import { parseProfileData, toProfileDataUpdate } from "@/lib/profile-data";
import { useUpdateProfile, type Profile } from "@/lib/queries/profile";

/** The personal data of the questionnaire (sex, age, body, activity, training), edited by hand. All of it is optional. */
export function UserDataForm({ profile }: { profile: Profile }) {
  const update = useUpdateProfile(profile.user_id, "Data saved");
  const [form, setForm] = useState<AnswersForm>(() => answersFromProfile(profile, { defaults: false }));
  const patch = (changes: Partial<AnswersForm>) => setForm((f) => ({ ...f, ...changes }));

  // the name has its own place (Settings): it is sent as it is saved
  const parsed = parseProfileData({ name: profile.name, ...form });
  const next = parsed.success ? toProfileDataUpdate(parsed.data) : null;
  const dirty = next !== null && (Object.keys(next) as (keyof typeof next)[]).some((key) => key !== "name" && next[key] !== (profile[key as keyof Profile] ?? null));
  const problems = parsed.success ? [] : [...new Set(parsed.error.issues.map((i) => i.message))];

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (next && dirty) update.mutate(next);
  }

  // Anything typed that is not what is saved counts as an unsaved change, even when it is not valid yet.
  const saved = answersFromProfile(profile, { defaults: false });
  // "61,5" and "61.5", or a trailing space, are the same value: compare what would be saved, not the text
  const same = (a: string, b: string) => (parseDecimalInput(a) !== null && parseDecimalInput(b) !== null ? parseDecimalInput(a) === parseDecimalInput(b) : a.trim() === b.trim());
  const edited = (Object.keys(saved) as (keyof AnswersForm)[]).some((key) => {
    if (key === "lean") return false; // follows the fat
    const [current, original] = [form[key], saved[key]];
    return typeof current === "string" && typeof original === "string" ? !same(current, original) : current !== original;
  });

  useUnsavedEntry("data", { dirty: edited, valid: parsed.success, save: () => (next ? update.mutateAsync(next) : Promise.reject(new Error("invalid"))) });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6" aria-label="User data">
      <AboutYou form={form} patch={patch} />
      <BodyComposition form={form} patch={patch} />
      <DailyLife form={form} patch={patch} />
      <Activity form={form} patch={patch} />
      {problems.length > 0 && <Hint>{problems.join(" ")}</Hint>}
      {parsed.success && !dirty && <p className="text-center text-sm text-muted-foreground">No changes</p>}
      <Button type="submit" size="lg" className="h-11" disabled={!parsed.success || !dirty || update.isPending}>
        {update.isPending ? "Saving…" : "Save data"}
      </Button>
    </form>
  );
}
