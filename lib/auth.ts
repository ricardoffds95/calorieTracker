import { z } from "zod";

export type AuthMode = "signin" | "signup";

export const MIN_PASSWORD_LENGTH = 8;

const email = z.string().trim().min(1, "Email required").pipe(z.email("Invalid email"));

const credentialsSchemas: Record<AuthMode, z.ZodType<{ email: string; password: string }>> = {
  signin: z.object({ email, password: z.string().min(1, "Password required") }),
  signup: z.object({
    email,
    password: z.string().min(MIN_PASSWORD_LENGTH, `Min ${MIN_PASSWORD_LENGTH} characters`),
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
      return "Wrong email or password";
    case "email_not_confirmed":
      return "Confirm your email first";
    case "over_email_send_rate_limit":
      return "Too many emails. Wait a bit";
    case "over_request_rate_limit":
      return "Too many attempts. Wait a bit";
    case "user_already_exists":
    case "email_exists":
      return "Account already exists";
    case "weak_password":
      return "Password too weak";
    case "email_address_invalid":
      return "Invalid email";
    case "signup_disabled":
      return "Sign-ups are off";
  }
  // fetch failures surface as AuthRetryableFetchError with status 0
  if (error.name === "AuthRetryableFetchError" || error.status === 0) {
    return "No connection";
  }
  if (mode === "signin" && error.status === 400) return "Wrong email or password";
  return "Something went wrong";
}

/** What stops a new password from being used, in words (empty when it is fine). */
export function passwordProblem(password: string, repeat: string): string {
  if (password.length < MIN_PASSWORD_LENGTH) return `Min ${MIN_PASSWORD_LENGTH} characters`;
  if (password !== repeat) return "Passwords differ";
  return "";
}
