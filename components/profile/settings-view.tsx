"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Hint } from "@/components/ui/hint";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { passwordProblem } from "@/lib/auth";
import { parseProfileData } from "@/lib/profile-data";
import { clearUserCache } from "@/lib/query/persister";
import { useUpdateProfile, type Profile } from "@/lib/queries/profile";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export const DELETE_WORD = "delete";

/** Name, e-mail, password and deleting the account. */
export function SettingsView({ profile, email }: { profile: Profile; email: string }) {
  const rename = useUpdateProfile(profile.user_id, "Name saved");
  const [name, setName] = useState(profile.name);
  const nameParsed = parseProfileData({ name, sex: null, age: "", height: "", weight: "", fat: "", daily: null, aerobic: "", anaerobic: "", intensity: null, notes: "" });
  const nameChanged = nameParsed.success && nameParsed.data.name !== profile.name;

  const [newEmail, setNewEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"email" | "password" | null>(null);
  const [deleting, setDeleting] = useState(false);

  const problem = passwordProblem(password, repeat);

  async function changeEmail(event: FormEvent) {
    event.preventDefault();
    setEmailError(null);
    const value = newEmail.trim();
    if (!/^\S+@\S+\.\S+$/.test(value)) return setEmailError("Invalid email");
    setBusy("email");
    try {
      const { error } = await createClient().auth.updateUser({ email: value });
      if (error) setEmailError(/rate|too many/i.test(error.message) ? "Too many attempts. Wait a bit" : "Couldn’t change email");
      else {
        toast.success("Check your inbox to confirm");
        setNewEmail("");
      }
    } catch {
      setEmailError("No connection");
    }
    setBusy(null);
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    setPasswordError(null);
    if (problem) return;
    setBusy("password");
    try {
      const { error } = await createClient().auth.updateUser({ password });
      if (error) setPasswordError(/same|different/i.test(error.message) ? "Pick a different password" : /weak|pwned/i.test(error.message) ? "Password too weak" : "Couldn’t change password");
      else {
        toast.success("Password changed");
        setPassword("");
        setRepeat("");
      }
    } catch {
      setPasswordError("No connection");
    }
    setBusy(null);
  }

  return (
    <div className="flex flex-col gap-8">
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (nameParsed.success && nameChanged) rename.mutate({ name: nameParsed.data.name });
        }}
        className="flex flex-col gap-2"
        aria-label="Name form"
      >
        <Label htmlFor="settings-name">Name</Label>
        <div className="flex gap-2">
          <Input id="settings-name" className="h-11" value={name} maxLength={60} autoComplete="given-name" onChange={(e) => setName(e.target.value)} />
          <Button type="submit" className="h-11" disabled={!nameChanged || rename.isPending}>
            Save
          </Button>
        </div>
        {!nameParsed.success && (
          <p role="alert" className="text-sm text-destructive">
            {nameParsed.error.issues[0]?.message}
          </p>
        )}
      </form>

      <form noValidate onSubmit={changeEmail} className="flex flex-col gap-2" aria-label="Email form">
        <Label htmlFor="settings-email">Email</Label>
        <p data-testid="user-email" className="text-sm text-muted-foreground">
          {email}
        </p>
        <div className="flex gap-2">
          <Input id="settings-email" type="email" inputMode="email" autoComplete="email" placeholder="New email" className="h-11" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
          <Button type="submit" className="h-11" disabled={!newEmail.trim() || busy === "email"}>
            Change
          </Button>
        </div>
        {emailError && (
          <p role="alert" className="text-sm text-destructive">
            {emailError}
          </p>
        )}
      </form>

      <form noValidate onSubmit={changePassword} className="flex flex-col gap-2" aria-label="Password form">
        <Label htmlFor="settings-password">Password</Label>
        <Input id="settings-password" type="password" autoComplete="new-password" placeholder="New password" className="h-11" value={password} onChange={(e) => setPassword(e.target.value)} />
        <Input id="settings-repeat" type="password" aria-label="Repeat password" autoComplete="new-password" placeholder="Repeat" className="h-11" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
        {password.length > 0 && problem && <Hint>{problem}</Hint>}
        {passwordError && (
          <p role="alert" className="text-sm text-destructive">
            {passwordError}
          </p>
        )}
        <Button type="submit" variant="outline" size="lg" className="h-11" disabled={!!problem || busy === "password"}>
          Change password
        </Button>
      </form>

      <Button type="button" variant="destructive" size="lg" className="h-11" onClick={() => setDeleting(true)}>
        Delete account
      </Button>
      {deleting && <DeleteAccountDialog userId={profile.user_id} onClose={() => setDeleting(false)} />}
    </div>
  );
}

function DeleteAccountDialog({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [word, setWord] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setPending(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: rpcError } = await supabase.rpc("delete_my_account");
      if (rpcError) throw rpcError;
      await clearUserCache(userId);
      await supabase.auth.signOut();
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full reload on purpose
      window.location.assign("/login");
    } catch (e) {
      setError(/fetch|network/i.test((e as { message?: string }).message ?? "") ? "No connection" : "Couldn’t delete");
      setPending(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete account?</DialogTitle>
          <DialogDescription>All your data is deleted</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="delete-confirm">Type “{DELETE_WORD}” to confirm</Label>
          <Input id="delete-confirm" className="h-11" autoComplete="off" autoCapitalize="none" value={word} onChange={(e) => setWord(e.target.value)} />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button type="button" variant="destructive" size="lg" className="h-11" disabled={word.trim().toLowerCase() !== DELETE_WORD || pending} onClick={remove}>
            {pending ? "Deleting…" : "Delete forever"}
          </Button>
          <Button type="button" variant="ghost" className="h-11" disabled={pending} onClick={onClose}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
