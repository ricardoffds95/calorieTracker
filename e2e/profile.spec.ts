import { expect, test, type Page } from "@playwright/test";
import { clearCache, login, logout, openProfile } from "./helpers";

const calories = (page: Page) => page.getByLabel("Calorias diárias", { exact: true });
const pct = (page: Page, macro: "Proteína" | "Hidratos" | "Gordura") => page.getByLabel(`${macro} %`, { exact: true });
const save = (page: Page) => page.getByRole("button", { name: /Guardar objetivos|A guardar/ });
const summary = (page: Page) => page.getByTestId("profile-summary");
const preview = (page: Page) => page.getByTestId("goals-preview");

async function openProfileForm(page: Page, user: "A" | "B" = "A") {
  await login(page, user);
  await openProfile(page);
  await expect(save(page)).toBeVisible();
}

/** Puts the profile back to the defaults (maintain, 2000 kcal) through the UI. */
async function resetProfile(page: Page) {
  await page.goto("/perfil");
  await expect(save(page)).toBeVisible();
  await page.getByRole("radio", { name: /Manter peso/ }).check({ force: true });
  await calories(page).fill("2000");
  if (await save(page).isEnabled()) {
    await save(page).click();
    await expect(page.getByText("Objetivos guardados")).toBeVisible();
  }
  await expect(summary(page)).toContainText("Manter peso · 2000 kcal");
}

test("shows the default goals", async ({ page }) => {
  await openProfileForm(page);
  await expect(calories(page)).toHaveValue("2000");
  await expect(pct(page, "Proteína")).toHaveValue("30");
  await expect(pct(page, "Hidratos")).toHaveValue("40");
  await expect(pct(page, "Gordura")).toHaveValue("30");
  await expect(page.getByTestId("macro-total")).toHaveText("Total: 100%");
  await expect(preview(page)).toContainText("150");
  await expect(preview(page)).toContainText("200");
  await expect(preview(page)).toContainText("67");
  await expect(save(page)).toBeDisabled(); // nothing changed yet
});

test("changing goal and calories updates the preview, saves, and survives reload and an empty cache", async ({ page }) => {
  await openProfileForm(page);
  try {
    await page.getByRole("radio", { name: /Perder peso/ }).check({ force: true });
    await expect(pct(page, "Proteína")).toHaveValue("40");
    await expect(pct(page, "Hidratos")).toHaveValue("30");
    await expect(pct(page, "Gordura")).toHaveValue("30");

    await calories(page).fill("2400");
    await expect(preview(page)).toContainText("2400");
    await expect(preview(page)).toContainText("240");
    await expect(preview(page)).toContainText("180");
    await expect(preview(page)).toContainText("80");

    await save(page).click();
    await expect(page.getByText("Objetivos guardados")).toBeVisible();
    await expect(summary(page)).toContainText("Perder peso · 2400 kcal");
    await expect(save(page)).toBeDisabled();

    // cache-first
    await page.reload();
    await expect(summary(page)).toContainText("2400 kcal");
    await expect(calories(page)).toHaveValue("2400");
    await expect(page.getByRole("radio", { name: /Perder peso/ })).toBeChecked();

    // DB fallback: empty cache
    await clearCache(page);
    await page.reload();
    await expect(calories(page)).toHaveValue("2400");
    await expect(pct(page, "Proteína")).toHaveValue("40");
  } finally {
    await resetProfile(page);
  }
});

test("validates calories and the percentage total", async ({ page }) => {
  await openProfileForm(page);

  await calories(page).fill("400");
  await expect(page.getByRole("alert").filter({ hasText: "Mínimo 500 kcal." })).toBeVisible();
  await expect(save(page)).toBeDisabled();

  await calories(page).fill("10001");
  await expect(page.getByRole("alert").filter({ hasText: "Máximo 10000 kcal." })).toBeVisible();
  await expect(save(page)).toBeDisabled();

  await calories(page).fill("");
  await expect(save(page)).toBeDisabled();
  await calories(page).fill("2000");

  await pct(page, "Proteína").fill("35");
  await expect(page.getByTestId("macro-total")).toHaveText(/Total: 105% · A soma tem de ser 100%\./);
  await expect(save(page)).toBeDisabled();
  await page.getByRole("button", { name: "Diminuir Proteína %" }).click();
  await expect(pct(page, "Proteína")).toHaveValue("30");
  await expect(page.getByTestId("macro-total")).toHaveText("Total: 100%");
});

test("the +/- buttons step and respect the limits", async ({ page }) => {
  await openProfileForm(page);
  await page.getByRole("button", { name: "Aumentar Calorias diárias" }).click();
  await expect(calories(page)).toHaveValue("2050");
  await page.getByRole("button", { name: "Diminuir Calorias diárias" }).click();
  await expect(calories(page)).toHaveValue("2000");

  await calories(page).fill("520");
  await page.getByRole("button", { name: "Diminuir Calorias diárias" }).click();
  await expect(calories(page)).toHaveValue("500");
  await calories(page).fill("9990");
  await page.getByRole("button", { name: "Aumentar Calorias diárias" }).click();
  await expect(calories(page)).toHaveValue("10000");

  await pct(page, "Gordura").fill("3");
  await page.getByRole("button", { name: "Diminuir Gordura %" }).click();
  await expect(pct(page, "Gordura")).toHaveValue("0");
});

test("a failed save shows an error and does not pretend it was saved", async ({ page }) => {
  await openProfileForm(page);
  await calories(page).fill("2100");
  await page.route("**/rest/v1/profiles*", (route) => (route.request().method() === "PATCH" ? route.abort() : route.continue()));
  await save(page).click();
  await expect(page.getByText("Sem ligação. As alterações não foram guardadas.")).toBeVisible();
  await expect(summary(page)).toContainText("2000 kcal");
  await expect(summary(page)).not.toContainText("2100");

  // after the network is back, the same edit can be saved
  await page.unroute("**/rest/v1/profiles*");
  await expect(save(page)).toBeEnabled();
  await page.reload();
  await expect(calories(page)).toHaveValue("2000");
});

test("one user's goals never change another user's profile", async ({ page }) => {
  await openProfileForm(page, "A");
  try {
    await calories(page).fill("2600");
    await save(page).click();
    await expect(summary(page)).toContainText("2600 kcal");

    await logout(page);
    await login(page, "B");
    await openProfile(page);
    await expect(summary(page)).toContainText("2000 kcal");
    await expect(calories(page)).toHaveValue("2000");
    await logout(page);
    await login(page, "A");
  } finally {
    await resetProfile(page);
  }
});
