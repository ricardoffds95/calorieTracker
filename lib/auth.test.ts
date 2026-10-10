import { describe, expect, it } from "vitest";
import { authErrorMessage, validateCredentials } from "./auth";

describe("validateCredentials", () => {
  it("accepts a valid email and trims it", () => {
    expect(validateCredentials("signin", { email: "  ana@exemplo.pt ", password: "x" })).toEqual({
      ok: true,
      email: "ana@exemplo.pt",
      password: "x",
    });
  });
  it("explains an email without @ instead of failing silently", () => {
    const result = validateCredentials("signin", { email: "ricardo", password: "segredo123" });
    expect(result).toEqual({ ok: false, errors: { email: "Email inválido. Ex: nome@exemplo.com" } });
  });
  it("asks for missing fields", () => {
    expect(validateCredentials("signin", { email: " ", password: "" })).toEqual({
      ok: false,
      errors: { email: "Indica o email.", password: "Indica a password." },
    });
  });
  it("requires 8+ characters only when creating an account", () => {
    expect(validateCredentials("signin", { email: "a@b.pt", password: "curta" }).ok).toBe(true);
    expect(validateCredentials("signup", { email: "a@b.pt", password: "curta" })).toEqual({
      ok: false,
      errors: { password: "A password tem de ter pelo menos 8 caracteres." },
    });
    expect(validateCredentials("signup", { email: "a@b.pt", password: "12345678" }).ok).toBe(true);
  });
});

describe("authErrorMessage", () => {
  it("maps known Supabase codes", () => {
    expect(authErrorMessage({ code: "invalid_credentials", status: 400 }, "signin")).toBe("Email ou password incorretos.");
    expect(authErrorMessage({ code: "email_not_confirmed", status: 400 }, "signin")).toMatch(/não confirmado/);
    expect(authErrorMessage({ code: "over_email_send_rate_limit", status: 429 }, "signup")).toMatch(/demasiados emails/);
    expect(authErrorMessage({ code: "user_already_exists", status: 422 }, "signup")).toMatch(/Já existe/);
    expect(authErrorMessage({ code: "signup_disabled", status: 422 }, "signup")).toMatch(/desativado/);
  });
  it("reports network failures as 'Sem ligação'", () => {
    expect(authErrorMessage({ name: "AuthRetryableFetchError", status: 0 }, "signin")).toMatch(/^Sem ligação/);
  });
  it("falls back to a generic message", () => {
    expect(authErrorMessage({ status: 400 }, "signin")).toBe("Email ou password incorretos.");
    expect(authErrorMessage({ status: 500 }, "signup")).toBe("Ocorreu um erro. Tenta novamente.");
  });
});
