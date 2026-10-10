import { expect, test } from "@playwright/test";
import { login } from "./helpers";

const TABS = [
  { name: "Hoje", url: /\/$/, heading: /^Hoje/ },
  { name: "Registar", url: /\/registar$/, heading: "Registar" },
  { name: "Histórico", url: /\/historico$/, heading: "Histórico" },
  { name: "Perfil", url: /\/perfil$/, heading: "Perfil" },
];

test("login page has no tab bar", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("navigation", { name: "Navegação principal" })).toHaveCount(0);
});

test("tabs navigate and mark the active one", async ({ page }) => {
  await login(page, "A");
  for (const tab of TABS) {
    await page.getByRole("link", { name: tab.name }).click();
    await expect(page).toHaveURL(tab.url);
    await expect(page.getByRole("heading", { level: 1, name: tab.heading })).toBeVisible();
    await expect(page.getByRole("link", { name: tab.name })).toHaveAttribute("aria-current", "page");
    await expect(page.locator('nav a[aria-current="page"]')).toHaveCount(1);
  }
});

test("page content is not hidden behind the tab bar", async ({ page }) => {
  await login(page, "A");
  await page.getByRole("link", { name: "Perfil" }).click();
  const button = page.getByRole("button", { name: "Sair" });
  await button.scrollIntoViewIfNeeded();
  const buttonBox = await button.boundingBox();
  const navBox = await page.getByRole("navigation", { name: "Navegação principal" }).boundingBox();
  expect(buttonBox && navBox && buttonBox.y + buttonBox.height <= navBox.y).toBe(true);
});
