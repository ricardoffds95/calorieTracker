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

test("invalid input is explained inline instead of being silently blocked", async ({ page }) => {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Email").fill("ricardo");
  await page.getByLabel("Password").fill("segredo123");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText("Email inválido. Ex: nome@exemplo.com")).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveAttribute("aria-invalid", "true");

  await page.getByRole("button", { name: "Ainda não tenho conta" }).click();
  await expect(page.getByText("Email inválido")).toHaveCount(0);
  await page.getByLabel("Email").fill("nobody@calorietracker.test");
  await page.getByLabel("Password").fill("curta");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByText("A password tem de ter pelo menos 8 caracteres.")).toBeVisible();
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
