import { expect, test } from "@playwright/test";
import { credentials, login, logout, openProfile } from "./helpers";

test("anonymous users are redirected to /login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
});

test("wrong password shows an error", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("nobody@calorietracker.test");
  await page.getByLabel("Password").fill("wrong-password-123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
});

test("invalid input is explained inline instead of being silently blocked", async ({ page }) => {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Email").fill("ricardo");
  await page.getByLabel("Password").fill("segredo123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Invalid email")).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveAttribute("aria-invalid", "true");

  await page.getByRole("button", { name: "Create an account" }).click();
  await expect(page.getByText("Invalid email")).toHaveCount(0);
  await page.getByLabel("Email").fill("nobody@calorietracker.test");
  await page.getByLabel("Password").fill("curta");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Min 8 characters")).toBeVisible();
});

test("login shows the protected page and logout returns to /login", async ({ page }) => {
  await login(page, "A");
  await openProfile(page);
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByTestId("user-email")).toHaveText(credentials("A").email);
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("profile-summary")).toContainText("2000 kcal");
  await logout(page);
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
});

test("the confirmation link without a session lands on the login saying the email is confirmed", async ({ page }) => {
  await page.goto("/auth/confirm"); // public: no redirect loop, no code
  await expect(page).toHaveURL(/\/login\?confirmed=1/);
  await expect(page.getByRole("status")).toContainText("Email confirmed");
  await expect(page.getByLabel("Email")).toBeVisible();
});

test("an expired or used confirmation link is explained", async ({ page }) => {
  await page.goto("/auth/confirm?error=access_denied&error_description=Email+link+is+invalid+or+has+expired");
  await expect(page).toHaveURL(/\/login\?link=invalid/);
  await expect(page.getByRole("status")).toContainText("expired or already used");
});

test("a wrong code on the confirmation link does not log anyone in", async ({ page }) => {
  await page.goto("/auth/confirm?code=not-a-real-code");
  await expect(page).toHaveURL(/\/login\?confirmed=1/);
});
