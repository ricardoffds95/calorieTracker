import { describe, expect, it } from "vitest";
import { authErrorMessage, passwordProblem, validateCredentials } from "./auth";

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
    expect(result).toEqual({ ok: false, errors: { email: "Invalid email" } });
  });
  it("asks for missing fields", () => {
    expect(validateCredentials("signin", { email: " ", password: "" })).toEqual({
      ok: false,
      errors: { email: "Email required", password: "Password required" },
    });
  });
  it("requires 8+ characters only when creating an account", () => {
    expect(validateCredentials("signin", { email: "a@b.pt", password: "curta" }).ok).toBe(true);
    expect(validateCredentials("signup", { email: "a@b.pt", password: "curta" })).toEqual({
      ok: false,
      errors: { password: "Min 8 characters" },
    });
    expect(validateCredentials("signup", { email: "a@b.pt", password: "12345678" }).ok).toBe(true);
  });
});

describe("authErrorMessage", () => {
  it("maps known Supabase codes", () => {
    expect(authErrorMessage({ code: "invalid_credentials", status: 400 }, "signin")).toBe("Wrong email or password");
    expect(authErrorMessage({ code: "email_not_confirmed", status: 400 }, "signin")).toMatch(/Confirm your email/);
    expect(authErrorMessage({ code: "over_email_send_rate_limit", status: 429 }, "signup")).toMatch(/Too many emails/);
    expect(authErrorMessage({ code: "user_already_exists", status: 422 }, "signup")).toMatch(/already exists/);
    expect(authErrorMessage({ code: "signup_disabled", status: 422 }, "signup")).toMatch(/Sign-ups are off/);
  });
  it("reports network failures as 'No connection'", () => {
    expect(authErrorMessage({ name: "AuthRetryableFetchError", status: 0 }, "signin")).toMatch(/^No connection/);
  });
  it("falls back to a generic message", () => {
    expect(authErrorMessage({ status: 400 }, "signin")).toBe("Wrong email or password");
    expect(authErrorMessage({ status: 500 }, "signup")).toBe("Something went wrong");
  });
});

describe("passwordProblem", () => {
  it("asks for at least 8 characters, then for both to match", () => {
    expect(passwordProblem("short", "short")).toBe("Min 8 characters");
    expect(passwordProblem("longenough", "different1")).toBe("Passwords differ");
    expect(passwordProblem("longenough", "longenough")).toBe("");
  });
});
