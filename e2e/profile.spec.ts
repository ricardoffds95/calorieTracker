import { expect, test, type Page } from "@playwright/test";
import { clearCache, login, logout, openProfile } from "./helpers";
import { fetchProfile, resetProfileRow } from "./seed";

const calories = (page: Page) => page.getByLabel("Calorias diárias", { exact: true });
const pct = (page: Page, macro: "Proteína" | "Hidratos" | "Gordura") => page.getByLabel(`${macro} %`, { exact: true });
const grams = (page: Page, macro: "Proteína" | "Hidratos" | "Gordura") => page.getByLabel(`${macro} (g)`, { exact: true });
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
  // through another mode and back, so the percentages and grams return to the maintain preset
  await page.getByRole("radio", { name: /Perder peso/ }).check({ force: true });
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
  await expect(grams(page, "Proteína")).toHaveValue("150");
  await expect(grams(page, "Hidratos")).toHaveValue("200");
  await expect(grams(page, "Gordura")).toHaveValue("67");
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
    await expect(preview(page)).toContainText("Total: 2400 kcal");
    await expect(grams(page, "Proteína")).toHaveValue("240");
    await expect(grams(page, "Hidratos")).toHaveValue("180");
    await expect(grams(page, "Gordura")).toHaveValue("80");

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

test("the grams are editable too: calories and percentages follow, and the exact grams are saved", async ({ page }) => {
  await openProfileForm(page);
  try {
    await grams(page, "Proteína").fill("180");
    // 180 g × 4 + 200 g × 4 + 67 g × 9 = 2123 kcal
    await expect(calories(page)).toHaveValue("2123");
    await expect(page.getByTestId("macro-total")).toHaveText("Total: 100%");
    await expect(pct(page, "Proteína")).toHaveValue("34");
    await expect(preview(page)).toContainText("Total: 2123 kcal");

    await page.getByRole("button", { name: "Aumentar Gordura (g)" }).click(); // +5 g
    await expect(grams(page, "Gordura")).toHaveValue("72");
    await expect(calories(page)).toHaveValue("2168");

    await save(page).click();
    await expect(page.getByText("Objetivos guardados")).toBeVisible();
    await expect(summary(page)).toContainText("2168 kcal");
    await page.reload();
    await expect(grams(page, "Proteína")).toHaveValue("180");
    await expect(grams(page, "Hidratos")).toHaveValue("200");
    await expect(grams(page, "Gordura")).toHaveValue("72");
    await expect(calories(page)).toHaveValue("2168");

    // calories still drive the grams (keeping the percentages)
    await calories(page).fill("2000");
    await expect(grams(page, "Proteína")).toHaveValue(String(Math.round((2000 * Number(await pct(page, "Proteína").inputValue())) / 100 / 4)));

    // a grams field that is not a whole number says so and blocks saving
    await grams(page, "Hidratos").fill("12.5");
    await expect(page.getByRole("alert").filter({ hasText: "Usa um número inteiro de gramas." })).toBeVisible();
    await expect(save(page)).toBeDisabled();
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

test("Gerir perfil: the name and the personal data are edited by hand, at the bottom of the page", async ({ page }) => {
  await openProfileForm(page);
  const original = (await fetchProfile("A")).name;
  try {
    const manage = page.getByTestId("manage-profile");
    // after the goals, before the account; closed until opened
    const goalsY = (await save(page).boundingBox())!.y;
    expect((await manage.boundingBox())!.y).toBeGreaterThan(goalsY);
    await expect(page.getByLabel("Nome", { exact: true })).toHaveCount(0);
    await manage.getByRole("button", { name: /Gerir perfil/ }).click();

    await page.getByLabel("Nome", { exact: true }).fill("Teste E2E");
    await page.getByRole("button", { name: "Feminino" }).click();
    await page.getByLabel("Idade").fill("33");
    await page.getByLabel("Altura (cm)").fill("168");
    await page.getByLabel("Peso (kg)").fill("61,5");
    await page.getByLabel("% massa gorda").fill("24");
    await expect(page.getByLabel("% massa magra")).toHaveValue("76");
    await page.getByRole("button", { name: /^Ativo/ }).click();
    await page.getByRole("button", { name: "Aumentar Treinos aeróbicos por semana" }).click();
    await page.getByRole("button", { name: /^Moderada/ }).click();
    await page.getByLabel("Notas sobre os treinos (opcional)").fill("Corrida 5 km ao sábado");
    await page.getByRole("button", { name: "Guardar dados" }).click();
    await expect(page.getByText("Dados guardados")).toBeVisible();

    await expect(summary(page)).toContainText("Teste E2E");
    expect(await fetchProfile("A")).toMatchObject({
      name: "Teste E2E",
      sex: "female",
      age: 33,
      height_cm: 168,
      weight_kg: 61.5,
      body_fat_pct: 24,
      daily_activity: "active",
      aerobic_sessions_per_week: 1,
      anaerobic_sessions_per_week: null,
      training_intensity: "moderate",
      training_notes: "Corrida 5 km ao sábado",
    });
    // goals are untouched
    expect(await fetchProfile("A")).toMatchObject({ goal_calories: 2000, mode: "maintain" });
    await expect(page.getByRole("button", { name: "Guardar dados" })).toBeDisabled();

    // after a reload the data is there; clearing a field stores nothing for it
    await page.reload();
    await page.getByTestId("manage-profile").getByRole("button", { name: /Gerir perfil/ }).click();
    await expect(page.getByLabel("Peso (kg)")).toHaveValue("61.5");
    await expect(page.getByTestId("manage-profile")).toContainText("Teste E2E · 61.5 kg · 168 cm");
    await page.getByLabel("Peso (kg)").fill("");
    await page.getByRole("button", { name: "Guardar dados" }).click();
    await expect.poll(async () => (await fetchProfile("A")).weight_kg).toBeNull();

    // a wrong value says what is wrong and blocks saving
    await page.getByLabel("Idade").fill("5");
    await expect(page.getByRole("status").filter({ hasText: "A idade mínima é 14 anos." })).toBeVisible();
    await expect(page.getByRole("button", { name: "Guardar dados" })).toBeDisabled();
  } finally {
    await resetProfileRow("A", { onboardingDone: true });
    const supabaseName = original;
    await page.goto("/perfil");
    await page.getByTestId("manage-profile").getByRole("button", { name: /Gerir perfil/ }).click();
    await page.getByLabel("Nome", { exact: true }).fill(supabaseName);
    if (await page.getByRole("button", { name: "Guardar dados" }).isEnabled()) await page.getByRole("button", { name: "Guardar dados" }).click();
    await expect.poll(async () => (await fetchProfile("A")).name).toBe(original);
  }
});
