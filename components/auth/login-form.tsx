"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup";

// Full navigation: the root layout reads the session on the server and keys the cache by user.
function goHome() {
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full reload on purpose
  window.location.assign("/");
}

export function LoginForm() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    const supabase = createClient();

    if (mode === "signin") {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError("Email ou password incorretos.");
      } else {
        goHome();
      }
    } else {
      const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) {
        setError(signUpError.message);
      } else if (data.session) {
        goHome();
      } else {
        setInfo("Conta criada. Confirma o email para entrares.");
      }
    }
    setLoading(false);
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">{mode === "signin" ? "Entrar" : "Criar conta"}</CardTitle>
        <CardDescription>CalorieTracker</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              className="h-11"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={8}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              className="h-11"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {info && (
            <p role="status" className="text-sm text-muted-foreground">
              {info}
            </p>
          )}
          <Button type="submit" size="lg" disabled={loading}>
            {mode === "signin" ? "Entrar" : "Criar conta"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
            {mode === "signin" ? "Criar conta" : "Já tenho conta"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
