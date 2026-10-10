import { z } from "zod";

export type AuthMode = "signin" | "signup";

export const MIN_PASSWORD_LENGTH = 8;

const email = z.string().trim().min(1, "Indica o email.").pipe(z.email("Email inválido. Ex: nome@exemplo.com"));

const credentialsSchemas: Record<AuthMode, z.ZodType<{ email: string; password: string }>> = {
  signin: z.object({ email, password: z.string().min(1, "Indica a password.") }),
  signup: z.object({
    email,
    password: z.string().min(MIN_PASSWORD_LENGTH, `A password tem de ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`),
  }),
};

export type CredentialErrors = Partial<Record<"email" | "password", string>>;

export type CredentialsResult =
  | { ok: true; email: string; password: string }
  | { ok: false; errors: CredentialErrors };

/** Validates the login form; one message per field (the first issue). */
export function validateCredentials(mode: AuthMode, input: { email: string; password: string }): CredentialsResult {
  const parsed = credentialsSchemas[mode].safeParse(input);
  if (parsed.success) return { ok: true, ...parsed.data };
  const errors: CredentialErrors = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0];
    if ((field === "email" || field === "password") && !errors[field]) errors[field] = issue.message;
  }
  return { ok: false, errors };
}

/** Shape of Supabase AuthError that matters here. */
export interface AuthErrorLike {
  code?: string;
  status?: number;
  name?: string;
}

/** User-facing (PT) message for a Supabase auth error. */
export function authErrorMessage(error: AuthErrorLike, mode: AuthMode): string {
  switch (error.code) {
    case "invalid_credentials":
      return "Email ou password incorretos.";
    case "email_not_confirmed":
      return "Email ainda não confirmado. Abre o link que te enviámos por email e tenta novamente.";
    case "over_email_send_rate_limit":
      return "Foram enviados demasiados emails. Espera um pouco e tenta novamente.";
    case "over_request_rate_limit":
      return "Demasiadas tentativas. Espera um pouco e tenta novamente.";
    case "user_already_exists":
    case "email_exists":
      return "Já existe uma conta com este email. Entra com a tua password.";
    case "weak_password":
      return "Password demasiado fraca. Usa uma mais longa ou com mais variedade.";
    case "email_address_invalid":
      return "Email inválido. Ex: nome@exemplo.com";
    case "signup_disabled":
      return "O registo de novas contas está desativado.";
  }
  // fetch failures surface as AuthRetryableFetchError with status 0
  if (error.name === "AuthRetryableFetchError" || error.status === 0) {
    return "Sem ligação. Verifica a internet e tenta novamente.";
  }
  if (mode === "signin" && error.status === 400) return "Email ou password incorretos.";
  return "Ocorreu um erro. Tenta novamente.";
}
