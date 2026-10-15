"use client";

import { useState, type FormEvent } from "react";
import { AvatarGrid } from "@/components/profile/avatar-grid";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/hint";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MAX_NAME_LENGTH, validateWelcomeName } from "@/lib/profile";
import { useUpdateProfile } from "@/lib/queries/profile";

interface WelcomeStepProps {
  userId: string;
  /** Leaves the whole onboarding, as the questionnaire's Skip does. */
  onSkip: () => void;
  skipping: boolean;
}

/** First thing after creating an account: the name and the icon, before the questionnaire. */
export function WelcomeStep({ userId, onSkip, skipping }: WelcomeStepProps) {
  const save = useUpdateProfile(userId, "Profile saved");
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const checked = validateWelcomeName(name);
  const missing = [checked.ok ? null : checked.message, avatar === null ? "Pick an icon" : null].filter(Boolean);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!checked.ok || avatar === null) return;
    save.mutate({ name: checked.name, avatar });
  }

  return (
    <form onSubmit={onSubmit} noValidate aria-label="Welcome" className="flex flex-col gap-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome</h1>
        <Button type="button" variant="ghost" className="h-11 shrink-0 text-muted-foreground" disabled={skipping || save.isPending} onClick={onSkip}>
          Skip
        </Button>
      </header>
      <div className="flex flex-col gap-2">
        <Label htmlFor="welcome-name">Name</Label>
        <Input id="welcome-name" className="h-11" value={name} maxLength={MAX_NAME_LENGTH + 10} autoComplete="given-name" onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium">Icon</span>
        <AvatarGrid value={avatar} onChange={setAvatar} disabled={save.isPending} />
      </div>
      {missing.length > 0 && <Hint>{missing.join(" · ")}</Hint>}
      <Button type="submit" size="lg" className="h-11" disabled={missing.length > 0 || save.isPending}>
        {save.isPending ? "Saving…" : "Continue"}
      </Button>
    </form>
  );
}
