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
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
});

test("login shows the protected page and logout returns to /login", async ({ page }) => {
  await login(page, "A");
  await openProfile(page);
  await expect(page.getByTestId("user-email")).toHaveText(credentials("A").email);
  await expect(page.getByTestId("profile-summary")).toContainText("2000 kcal");
  await logout(page);
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
});
