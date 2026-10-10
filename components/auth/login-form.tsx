"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authErrorMessage, validateCredentials, type AuthMode, type CredentialErrors } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";

// Full navigation: the root layout reads the session on the server and keys the cache by user.
function goHome() {
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full reload on purpose
  window.location.assign("/");
}

export function LoginForm({ initialInfo = null }: { initialInfo?: string | null }) {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<CredentialErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(initialInfo);
  const [loading, setLoading] = useState(false);

  function switchMode() {
    setMode(mode === "signin" ? "signup" : "signin");
    setFieldErrors({});
    setError(null);
    setInfo(null);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setInfo(null);
    // Validated here (noValidate on the form): native bubbles are easy to miss and vary per browser.
    const credentials = validateCredentials(mode, { email, password });
    if (!credentials.ok) {
      setFieldErrors(credentials.errors);
      return;
    }
    setFieldErrors({});
    setLoading(true);
    try {
      const supabase = createClient();
      const input = { email: credentials.email, password: credentials.password };
      if (mode === "signin") {
        const { error: signInError } = await supabase.auth.signInWithPassword(input);
        if (signInError) setError(authErrorMessage(signInError, mode));
        else return goHome();
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({ ...input, options: { emailRedirectTo: `${window.location.origin}/auth/confirm` } });
        if (signUpError) setError(authErrorMessage(signUpError, mode));
        else if (data.session) return goHome();
        else {
          setMode("signin");
          setPassword("");
          setInfo(`Conta criada. Enviámos um email de confirmação para ${credentials.email}: abre o link e depois entra aqui.`);
        }
      }
    } catch {
      setError("Sem ligação. Verifica a internet e tenta novamente.");
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
        <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
          {info && (
            <p role="status" className="rounded-md border border-border bg-muted p-3 text-sm text-foreground">
              {info}
            </p>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              className="h-11"
              value={email}
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? "email-error" : undefined}
              onChange={(e) => setEmail(e.target.value)}
            />
            {fieldErrors.email && (
              <p id="email-error" role="alert" className="text-sm text-destructive">
                {fieldErrors.email}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              className="h-11"
              value={password}
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={fieldErrors.password ? "password-error" : undefined}
              onChange={(e) => setPassword(e.target.value)}
            />
            {fieldErrors.password && (
              <p id="password-error" role="alert" className="text-sm text-destructive">
                {fieldErrors.password}
              </p>
            )}
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" disabled={loading}>
            {loading ? "Aguarda…" : mode === "signin" ? "Entrar" : "Criar conta"}
          </Button>
          <Button type="button" variant="ghost" disabled={loading} onClick={switchMode}>
            {mode === "signin" ? "Ainda não tenho conta" : "Já tenho conta"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
