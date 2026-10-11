import { beforeEach, describe, expect, it, vi } from "vitest";

const exchangeCodeForSession = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { exchangeCodeForSession } }),
}));

import { GET } from "./route";

const call = (query: string) => GET(new Request(`https://app.example.com/auth/confirm${query}`));

beforeEach(() => exchangeCodeForSession.mockReset());

describe("GET /auth/confirm", () => {
  it("turns the code into a session and goes to the app", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });
    const response = await call("?code=abc");
    expect(exchangeCodeForSession).toHaveBeenCalledWith("abc");
    expect(response.headers.get("location")).toBe("https://app.example.com/");
  });

  it("says the email is confirmed when the code cannot be used (another device)", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: { message: "code verifier not found" } });
    expect((await call("?code=abc")).headers.get("location")).toBe("https://app.example.com/login?confirmed=1");
  });

  it("goes to the login with 'confirmed' when there is no code", async () => {
    expect((await call("")).headers.get("location")).toBe("https://app.example.com/login?confirmed=1");
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("explains an invalid link (expired or used)", async () => {
    expect((await call("?error=access_denied&error_description=Email+link+is+invalid")).headers.get("location")).toBe(
      "https://app.example.com/login?link=invalid",
    );
  });
});
