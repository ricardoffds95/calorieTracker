import { expect, test, type Page } from "@playwright/test";
import { addDays, toDateKey } from "../lib/dates";
import { login } from "./helpers";
import { clearDiary, clearSaved, fetchDiary, fetchSavedFoods, fetchSavedMeals, seedDiary, seedSavedFood, seedSavedMeal } from "./seed";

const clearAll = () => Promise.all([clearDiary("A"), clearDiary("B"), clearSaved("A"), clearSaved("B")]);
test.beforeEach(clearAll);
test.afterAll(clearAll);

async function openSaved(page: Page) {
  await page.getByRole("link", { name: "Guardados", exact: true }).click();
  await expect(page).toHaveURL(/\/guardados$/);
  await expect(page.getByRole("heading", { level: 1, name: "Guardados" })).toBeVisible();
  await page.waitForLoadState("networkidle");
}

const ITEMS = [
  { name: "Aveia", quantity_g: 60, calories: 228, protein_g: 7.9, carbs_g: 36, fat_g: 4.2 },
  { name: "Leite", quantity_g: 250, calories: 115, protein_g: 8.3, carbs_g: 12, fat_g: 4 },
];

test("lists foods and meals with counts and usage, and filters them without accents", async ({ page }) => {
  await seedSavedFood("A", { name: "Iogurte grego", brand: "Marca X", calories_100g: 97, protein_100g: 9, carbs_100g: 4, fat_100g: 5, times_used: 3 });
  await seedSavedFood("A", { name: "Café", calories_100g: 2, protein_100g: 0.1, carbs_100g: 0, fat_100g: 0, times_used: 0 });
  await seedSavedMeal("A", { name: "Papas de aveia", items: ITEMS, total_calories: 343, total_protein: 16.2, total_carbs: 48, total_fat: 8.2, times_used: 2 });
  await login(page, "A");
  await openSaved(page);

  await expect(page.getByRole("button", { name: "Alimentos · 2" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Refeições · 1" })).toBeVisible();
  const rows = page.getByTestId("saved-foods").getByRole("listitem");
  await expect(rows.first()).toContainText("Iogurte grego");
  await expect(rows.first()).toContainText("usado 3×"); // most used first
  await expect(rows.first()).toContainText("97 kcal/100 g");
  await expect(rows.nth(1)).toContainText("nunca usado");

  await page.getByRole("searchbox", { name: "Pesquisar nos guardados" }).fill("CAFE");
  await expect(rows).toHaveCount(1);
  await page.getByRole("searchbox", { name: "Pesquisar nos guardados" }).fill("zzz");
  await expect(page.getByText("Nada com esse nome.")).toBeVisible();

  await page.getByRole("searchbox", { name: "Pesquisar nos guardados" }).fill("");
  await page.getByRole("button", { name: "Refeições · 1" }).click();
  const meal = page.getByTestId("saved-meals").getByRole("listitem");
  await expect(meal).toContainText("Papas de aveia");
  await expect(meal).toContainText("343 kcal");
  await expect(meal).toContainText("2 alimentos");
  await expect(meal).toContainText("usado 2×");
});

test("editing from the tab can update the whole diary history", async ({ page }) => {
  const today = toDateKey(new Date());
  const yesterday = addDays(today, -1);
  const food = await seedSavedFood("A", { name: "Pão E2E com sementes de girassol linhaça e abóbora muito longo", calories_100g: 250, protein_100g: 9, carbs_100g: 48, fat_100g: 3 });
  const entry = (date: string) => ({
    entry_date: date, meal: "breakfast", kind: "food", name: "Pão E2E com sementes de girassol linhaça e abóbora muito longo", quantity_g: 50,
    calories: 125, protein_g: 4.5, carbs_g: 24, fat_g: 1.5, saved_food_id: food.id,
  });
  await seedDiary("A", [entry(yesterday), entry(today)]);
  await login(page, "A");
  await openSaved(page);

  await page.getByRole("button", { name: "Abrir Pão E2E com sementes de girassol linhaça e abóbora muito longo" }).click();
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await page.getByLabel("Calorias").fill("200");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Está em 2 entradas do diário")).toBeVisible();
  await page.getByRole("button", { name: /Todo o histórico/ }).click();
  await expect(page.getByText("Guardado e 2 entradas atualizadas")).toBeVisible();

  expect((await fetchDiary("A", today))[0]).toMatchObject({ calories: 100 });
  expect((await fetchDiary("A", yesterday))[0]).toMatchObject({ calories: 100 });
  await expect(page.getByTestId("saved-foods")).toContainText("200 kcal/100 g");
});

test("deleting a saved food keeps the diary entries, just unlinked", async ({ page }) => {
  const food = await seedSavedFood("A", { name: "Apagar E2E", calories_100g: 100, protein_100g: 1, carbs_100g: 1, fat_100g: 1 });
  await seedDiary("A", [
    { entry_date: "2026-01-20", meal: "lunch", kind: "food", name: "Apagar E2E", quantity_g: 100, calories: 100, protein_g: 1, carbs_g: 1, fat_g: 1, saved_food_id: food.id },
  ]);
  await login(page, "A");
  await openSaved(page);

  await page.getByRole("button", { name: "Abrir Apagar E2E" }).click();
  await page.getByRole("button", { name: "Apagar" }).click();
  await expect(page.getByText("As entradas do diário mantêm-se como estão.")).toBeVisible();
  await page.getByRole("button", { name: "Apagar" }).click(); // confirm
  await expect(page.getByText("Removido dos guardados")).toBeVisible();
  await expect(page.getByRole("button", { name: "Abrir Apagar E2E" })).toHaveCount(0);

  expect(await fetchSavedFoods("A")).toHaveLength(0);
  expect((await fetchDiary("A", "2026-01-20"))[0]).toMatchObject({ name: "Apagar E2E", calories: 100, saved_food_id: null });
});

test("tapping a saved item offers Adicionar ao diário, Editar and Apagar, without opening the keyboard", async ({ page }) => {
  await seedSavedFood("A", { name: "Ovo E2E", calories_100g: 155, protein_100g: 13, carbs_100g: 1.1, fat_100g: 11 });
  await login(page, "A");
  await openSaved(page);

  await page.getByRole("button", { name: "Abrir Ovo E2E" }).click();
  for (const name of ["Adicionar ao diário", "Editar", "Apagar"]) {
    await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  }
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await expect(page.getByLabel("Nome", { exact: true })).toHaveValue("Ovo E2E");
  expect(await page.evaluate(() => ["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName ?? ""))).toBe(false);
});

test("a saved food is added to the diary from here, choosing grams, day and meal (snacks by default)", async ({ page }) => {
  const food = await seedSavedFood("A", { name: "Ovo E2E", calories_100g: 155, protein_100g: 13, carbs_100g: 1.1, fat_100g: 11 });
  await login(page, "A");
  await openSaved(page);

  await page.getByRole("button", { name: "Abrir Ovo E2E" }).click();
  await page.getByRole("button", { name: "Adicionar ao diário" }).click();
  const meal = (name: string) => page.getByRole("group", { name: "Refeição", exact: true }).getByRole("button", { name, exact: true });
  await expect(meal("Lanches")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Data")).toHaveValue(toDateKey(new Date()));
  await page.getByRole("button", { name: "Mais 10 g" }).click(); // 100 → 110 g
  await meal("Almoço").click();
  await page.getByLabel("Data").fill("2026-01-21");
  await page.getByRole("button", { name: "Adicionar ao diário" }).click();
  await expect(page.getByText(/Ovo E2E adicionado a almoço/)).toBeVisible();

  const [row] = await fetchDiary("A", "2026-01-21");
  expect(row).toMatchObject({ meal: "lunch", kind: "food", quantity_g: 110, calories: 171, saved_food_id: food.id });
  await expect(page.getByTestId("saved-foods")).toContainText("usado 1×");
});

test("a saved meal is added to the diary from here, in portions", async ({ page }) => {
  const saved = await seedSavedMeal("A", { name: "Papas de aveia", items: ITEMS, total_calories: 343, total_protein: 16.2, total_carbs: 48, total_fat: 8.2 });
  await login(page, "A");
  await openSaved(page);

  await page.getByRole("button", { name: "Refeições · 1" }).click();
  await page.getByRole("button", { name: "Abrir Papas de aveia" }).click();
  await page.getByRole("button", { name: "Adicionar ao diário" }).click();
  await page.getByRole("button", { name: "Usar 2 porções" }).click();
  await expect(page.getByRole("status", { name: "Porções" })).toHaveText("2 porções");
  await page.getByRole("group", { name: "Refeição", exact: true }).getByRole("button", { name: "Pequeno-almoço", exact: true }).click();
  await page.getByRole("button", { name: "Adicionar ao diário" }).click();
  await expect(page.getByText(/Papas de aveia adicionado a pequeno-almoço/)).toBeVisible();

  const [row] = await fetchDiary("A", toDateKey(new Date()));
  expect(row).toMatchObject({ meal: "breakfast", kind: "meal", doses: 2, calories: 686, saved_meal_id: saved.id });
});

test("creates a food by hand (per 100 g) and explains a duplicate name", async ({ page }) => {
  await login(page, "A");
  await openSaved(page);

  await page.getByRole("button", { name: "Novo alimento" }).click();
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Indica um nome." })).toBeVisible();

  await page.getByLabel("Nome", { exact: true }).fill("Barra E2E");
  await page.getByLabel("Marca (opcional)").fill("Marca Y");
  await page.getByLabel("Calorias (kcal)").fill("410,6");
  await page.getByLabel("Proteína (g)").fill("20");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Alimento guardado")).toBeVisible();
  await expect(page.getByTestId("saved-foods")).toContainText("Barra E2E");
  expect((await fetchSavedFoods("A"))[0]).toMatchObject({ name: "Barra E2E", brand: "Marca Y", calories_100g: 411, protein_100g: 20, times_used: 0 });

  await page.getByRole("button", { name: "Novo alimento" }).click();
  await page.getByLabel("Nome", { exact: true }).fill("barra e2e");
  await page.getByLabel("Calorias (kcal)").fill("100");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Já tens um alimento guardado com este nome" })).toBeVisible();
  expect(await fetchSavedFoods("A")).toHaveLength(1);
});

test("creates a meal without logging it: only 'Guardar', nothing in the diary", async ({ page }) => {
  await login(page, "A");
  await openSaved(page);

  await page.getByRole("button", { name: "Refeições · 0" }).click();
  await page.getByRole("button", { name: "Nova refeição" }).click();
  await page.getByRole("button", { name: "Valores por porção" }).click();
  await page.getByLabel("Nome da refeição").fill("Sopa E2E");
  await page.getByLabel("Calorias (kcal)").fill("180");
  await expect(page.getByRole("button", { name: /adicionar ao diário/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Mais porções" })).toHaveCount(0);
  await page.getByRole("button", { name: "Guardar nas refeições" }).click();
  await expect(page.getByRole("button", { name: "Guardada" })).toBeDisabled();

  const [meal] = await fetchSavedMeals("A");
  expect(meal).toMatchObject({ name: "Sopa E2E", total_calories: 180, times_used: 0 });
  expect(await fetchDiary("A", toDateKey(new Date()))).toHaveLength(0);
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("saved-meals")).toContainText("Sopa E2E");
});

test("saved items are private to each user", async ({ page }) => {
  await seedSavedFood("A", { name: "Só do A", calories_100g: 100, protein_100g: 1, carbs_100g: 1, fat_100g: 1 });
  await seedSavedMeal("A", { name: "Refeição do A", items: ITEMS, total_calories: 343, total_protein: 16.2, total_carbs: 48, total_fat: 8.2 });
  await login(page, "B");
  await openSaved(page);
  await expect(page.getByText("Ainda sem alimentos guardados")).toBeVisible();
  await page.getByRole("button", { name: "Refeições · 0" }).click();
  await expect(page.getByText("Ainda sem refeições guardadas")).toBeVisible();
});

test("new food: the search fills the form, the values can be changed before saving", async ({ page }) => {
  await page.route("**/api/food-search**", (route) =>
    route.fulfill({
      json: {
        results: [{ id: "560", source: "off", name: "Pão E2E com sementes de girassol linhaça e abóbora muito longo", brand: "Padaria", off_code: "560", calories_100g: 265, protein_100g: 9, carbs_100g: 49, fat_100g: 3.2 }],
        page: 1,
        pageCount: 1,
        total: 1,
        totalExact: true,
      },
    }),
  );
  await login(page, "A");
  await openSaved(page);

  await page.getByRole("button", { name: "Novo alimento" }).click();
  await page.getByRole("dialog").getByRole("searchbox", { name: "Pesquisar alimento" }).fill("pao e2e");
  await page.getByRole("button", { name: /^Open Food Facts · / }).click();
  // the keyboard closes by itself once the search ran, and the dialog never grows wider than the screen
  await expect(page.getByRole("button", { name: "Escolher Pão E2E com sementes de girassol linhaça e abóbora muito longo" })).toBeVisible();
  await expect(page.getByRole("dialog").getByRole("searchbox", { name: "Pesquisar alimento" })).not.toBeFocused();
  expect(await page.getByRole("dialog").evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.getByRole("button", { name: "Escolher Pão E2E com sementes de girassol linhaça e abóbora muito longo" }).click();

  await expect(page.getByLabel("Nome", { exact: true })).toHaveValue("Pão E2E com sementes de girassol linhaça e abóbora muito longo");
  await expect(page.getByLabel("Marca (opcional)")).toHaveValue("Padaria");
  await expect(page.getByLabel("Calorias (kcal)")).toHaveValue("265");
  await page.getByLabel("Calorias (kcal)").fill("270");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByTestId("saved-foods")).toContainText("Pão E2E com sementes de girassol linhaça e abóbora muito longo");
  expect(await fetchSavedFoods("A")).toMatchObject([{ name: "Pão E2E com sementes de girassol linhaça e abóbora muito longo", brand: "Padaria", calories_100g: 270, protein_100g: 9, carbs_100g: 49, fat_100g: 3.2 }]);
});

test("new food: the AI fills the form per 100 g of the total weight", async ({ page }) => {
  await page.route("**/api/ai/parse", (route) =>
    route.fulfill({
      json: {
        name: "Frango com arroz",
        items: [
          { name: "Frango", quantity_g: 100, calories: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6 },
          { name: "Arroz", quantity_g: 100, calories: 130, protein_g: 2.7, carbs_g: 28, fat_g: 0.3 },
        ],
      },
    }),
  );
  await login(page, "A");
  await openSaved(page);

  await page.getByRole("button", { name: "Novo alimento" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Com IA" }).click();
  await page.getByLabel("O que comeste?").fill("frango com arroz");
  await page.getByRole("button", { name: "Analisar" }).click();
  await expect(page.getByText("Isto é uma refeição com vários alimentos")).toBeVisible();
  await page.getByRole("button", { name: "Usar na mesma" }).click();

  await expect(page.getByLabel("Nome", { exact: true })).toHaveValue("Frango com arroz");
  await expect(page.getByLabel("Calorias (kcal)")).toHaveValue("148"); // 295 kcal / 200 g
  await expect(page.getByLabel("Proteína (g)")).toHaveValue("16.9");
});
