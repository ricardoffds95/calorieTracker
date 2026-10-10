import { expect, test, type Page } from "@playwright/test";
import { addDays, toDateKey } from "../lib/dates";
import { mealEntryRow } from "../lib/log";
import { login } from "./helpers";
import {
  applySavedFoodAs,
  clearDiary,
  clearSaved,
  fetchDiary,
  fetchSavedFoods,
  fetchSavedMeals,
  seedDiary,
  seedSavedFood,
  seedSavedMeal,
} from "./seed";

const DAY = "2026-01-20";
const clearAll = () => Promise.all([clearDiary("A"), clearDiary("B"), clearSaved("A"), clearSaved("B")]);
test.beforeEach(clearAll);
test.afterAll(clearAll);

const ARROZ = {
  id: "5601234567890",
  source: "off",
  name: "Arroz Teste E2E",
  brand: "Marca Teste",
  off_code: "5601234567890",
  serving_size: "75 g",
  calories_100g: 130,
  protein_100g: 2.7,
  carbs_100g: 28.2,
  fat_100g: 0.3,
};

/** Our search route is mocked (no Open Food Facts quota, stable data); returns the queries it received. */
async function mockOff(page: Page) {
  const queries: string[] = [];
  await page.route("**/api/food-search**", (route) => {
    queries.push(new URL(route.request().url()).searchParams.get("q") ?? "");
    return route.fulfill({ json: { results: [ARROZ] } });
  });
  return queries;
}

async function openLog(page: Page, date = DAY, meal = "lunch") {
  await page.goto(`/registar?meal=${meal}&d=${date}`);
  await expect(page.getByRole("heading", { name: "Registar" })).toBeVisible();
  await page.waitForLoadState("networkidle");
}

test("search → add 150 g: diary row, auto-saved food with times_used and the Today totals", async ({ page }) => {
  await mockOff(page);
  await login(page, "A");
  await openLog(page);
  await expect(page.getByRole("button", { name: "Almoço", exact: true })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("searchbox", { name: "Pesquisar alimento" }).fill("arroz teste e2e");
  await page.getByRole("button", { name: "Escolher Arroz Teste E2E" }).click();
  await expect(page.getByLabel("Quantidade (g)")).toHaveValue("75"); // one serving
  await page.getByLabel("Quantidade (g)").fill("150");
  await expect(page.getByTestId("nutrient-summary")).toContainText("195");
  await page.getByRole("button", { name: "Adicionar a almoço" }).click();
  await expect(page.getByText("Arroz Teste E2E adicionado a almoço")).toBeVisible();

  const [row] = await fetchDiary("A", DAY);
  expect(row).toMatchObject({ meal: "lunch", kind: "food", quantity_g: 150, calories: 195, protein_g: 4.1, carbs_g: 42.3, fat_g: 0.5 });
  const [saved] = await fetchSavedFoods("A");
  expect(saved).toMatchObject({ id: row!.saved_food_id, name: "Arroz Teste E2E", off_code: "5601234567890", calories_100g: 130, times_used: 1 });

  // Next time it comes from the saved foods, without a duplicate from Open Food Facts.
  await page.getByRole("searchbox", { name: "Pesquisar alimento" }).fill("arroz teste");
  await expect(page.getByTestId("search-results").getByRole("button", { name: /Escolher Arroz Teste E2E/ })).toHaveCount(1);
  await expect(page.getByTestId("search-results").getByLabel("Guardado")).toBeVisible();

  await page.goto(`/?d=${DAY}`);
  await expect(page.getByTestId("meal-lunch-kcal")).toHaveText("195 kcal");
});

test("pausing while typing never searches below 3 letters, and typing on makes a single request", async ({ page }) => {
  const queries = await mockOff(page);
  await login(page, "A");
  await openLog(page);
  const box = page.getByRole("searchbox", { name: "Pesquisar alimento" });

  await box.fill("ar");
  await page.waitForTimeout(1_000); // longer than the debounce
  expect(queries).toEqual([]);
  await expect(page.getByText("Escreve pelo menos 3 letras")).toBeVisible();

  await box.pressSequentially("roz teste", { delay: 60 }); // typed on without pausing
  await expect(page.getByRole("button", { name: "Escolher Arroz Teste E2E" })).toBeVisible();
  expect(queries).toEqual(["arroz teste"]);
});

test("matching saved foods are enough: Open Food Facts is only asked on request", async ({ page }) => {
  await seedSavedFood("A", { name: "Iogurte grego E2E", calories_100g: 97, protein_100g: 9, carbs_100g: 4, fat_100g: 5 });
  const queries = await mockOff(page);
  await login(page, "A");
  await openLog(page);
  const box = page.getByRole("searchbox", { name: "Pesquisar alimento" });

  await box.fill("iogurte");
  await expect(page.getByRole("button", { name: "Escolher Iogurte grego E2E" })).toBeVisible();
  await page.waitForTimeout(1_000); // longer than the debounce
  expect(queries).toEqual([]);
  await expect(page.getByRole("button", { name: "Escolher Arroz Teste E2E" })).toHaveCount(0);

  await page.getByRole("button", { name: "Pesquisar no Open Food Facts" }).click();
  await expect(page.getByRole("button", { name: "Escolher Arroz Teste E2E" })).toBeVisible();
  expect(queries).toEqual(["iogurte"]);
  await expect(page.getByRole("button", { name: "Escolher Iogurte grego E2E" })).toBeVisible(); // saved stays first

  // nothing saved matches: it goes online by itself
  await box.fill("queijo");
  await expect.poll(() => queries).toEqual(["iogurte", "queijo"]); // previous results stay on screen meanwhile
});

test("cache first: a repeated search shows the cached results with no request, and the button refreshes them", async ({ page }) => {
  const queries = await mockOff(page);
  await login(page, "A");
  await openLog(page);
  const box = page.getByRole("searchbox", { name: "Pesquisar alimento" });
  const result = page.getByRole("button", { name: "Escolher Arroz Teste E2E" });

  await box.fill("iogurte"); // nothing saved, nothing cached: it goes online by itself
  await expect(result).toBeVisible();
  expect(queries).toEqual(["iogurte"]);

  await box.fill("");
  await box.fill("iogurte"); // now cached
  await expect(result).toBeVisible();
  await expect(page.getByRole("button", { name: "Pesquisar no Open Food Facts" })).toBeVisible();
  await page.waitForTimeout(1_000); // longer than the debounce
  expect(queries).toEqual(["iogurte"]);

  await page.getByRole("button", { name: "Pesquisar no Open Food Facts" }).click();
  await expect.poll(() => queries).toEqual(["iogurte", "iogurte"]);
  await expect(page.getByRole("button", { name: "Pesquisar no Open Food Facts" })).toHaveCount(0);
});

test("a food from Open Food Facts can be only saved, or saved and logged", async ({ page }) => {
  await mockOff(page);
  await login(page, "A");
  await openLog(page);
  const box = page.getByRole("searchbox", { name: "Pesquisar alimento" });

  await box.fill("arroz teste e2e");
  await page.getByRole("button", { name: "Escolher Arroz Teste E2E" }).click();
  await page.getByRole("button", { name: "Só guardar nos alimentos" }).click();
  await expect(page.getByText("Guardado nos alimentos")).toBeVisible();
  const [saved] = await fetchSavedFoods("A");
  expect(saved).toMatchObject({ name: "Arroz Teste E2E", off_code: "5601234567890", calories_100g: 130, times_used: 0 });
  expect(await fetchDiary("A", DAY)).toHaveLength(0);

  // already saved: nothing left to save, it can only be logged
  await box.fill("arroz teste e2e");
  await page.getByRole("button", { name: "Escolher Arroz Teste E2E" }).click();
  await expect(page.getByRole("button", { name: "Só guardar nos alimentos" })).toHaveCount(0);
  await page.getByRole("button", { name: "Adicionar a almoço" }).click();
  await expect(page.getByText("Arroz Teste E2E adicionado a almoço")).toBeVisible();
  const [row] = await fetchDiary("A", DAY);
  expect(row).toMatchObject({ saved_food_id: saved!.id, quantity_g: 100 }); // a saved food has no label serving
  expect((await fetchSavedFoods("A"))[0]).toMatchObject({ times_used: 1 });
});

test("when Open Food Facts is down: clear message, saved foods stay, and 'Tentar novamente' recovers", async ({ page }) => {
  await seedSavedFood("A", { name: "Arroz guardado E2E", calories_100g: 120, protein_100g: 2.5, carbs_100g: 26, fat_100g: 0.3 });
  let down = true;
  await page.route("**/api/food-search**", (route) =>
    down ? route.fulfill({ status: 503, json: { error: "off_unavailable" } }) : route.fulfill({ json: { results: [ARROZ] } }),
  );
  await login(page, "A");
  await openLog(page);

  await page.getByRole("searchbox", { name: "Pesquisar alimento" }).fill("arroz");
  await page.getByRole("button", { name: "Pesquisar no Open Food Facts" }).click(); // the saved "Arroz" already matches
  const problem = page.getByRole("alert").filter({ hasText: "O Open Food Facts não respondeu" }); // Next.js adds its own empty alert
  await expect(problem).toBeVisible();
  await expect(page.getByText("Sem ligação")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Escolher Arroz guardado E2E" })).toBeVisible();

  down = false;
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(page.getByRole("button", { name: "Escolher Arroz Teste E2E" })).toBeVisible();
  await expect(problem).toHaveCount(0);
});

test.describe("live Open Food Facts", () => {
  test.skip(!process.env.E2E_LIVE_OFF, "Set E2E_LIVE_OFF=1 to search the real Open Food Facts through our route");

  test("'peito de frango' returns real, usable foods", async ({ page }) => {
    await login(page, "A");
    const response = await page.request.get("/api/food-search?q=peito%20de%20frango");
    expect(response.status()).toBe(200);
    const { results } = (await response.json()) as { results: { name: string; calories_100g: number }[] };
    expect(results.length).toBeGreaterThan(3);
    expect(results.every((r) => r.name && r.calories_100g > 0)).toBe(true);
    expect((await page.request.get("/api/food-search?q=ar")).status()).toBe(400);
  });
});

test("a saved meal with 2 portions stores doses and doubled items", async ({ page }) => {
  const items = [
    { name: "Frango", quantity_g: 150, calories: 248, protein_g: 46.5, carbs_g: 0, fat_g: 5.4 },
    { name: "Arroz", quantity_g: 125, calories: 163, protein_g: 3.4, carbs_g: 35.3, fat_g: 0.4 },
  ];
  await seedSavedMeal("A", { name: "Almoço E2E", items, total_calories: 411, total_protein: 49.9, total_carbs: 35.3, total_fat: 5.8 });
  await login(page, "A");
  await openLog(page, DAY, "dinner");

  await page.getByRole("button", { name: "Refeições" }).click();
  await page.getByRole("button", { name: "Escolher Almoço E2E" }).click();
  await page.getByRole("button", { name: "Mais porções" }).click();
  await page.getByRole("button", { name: "Mais porções" }).click();
  await expect(page.getByRole("status", { name: "Porções" })).toHaveText("2 porções");
  await page.getByRole("button", { name: "Adicionar a jantar" }).click();
  await expect(page.getByText("Almoço E2E adicionado a jantar")).toBeVisible();

  const [row] = await fetchDiary("A", DAY);
  expect(row).toMatchObject({ kind: "meal", meal: "dinner", doses: 2, calories: 822, protein_g: 99.8 });
  expect(row!.items).toEqual([
    { name: "Frango", quantity_g: 300, calories: 496, protein_g: 93, carbs_g: 0, fat_g: 10.8 },
    { name: "Arroz", quantity_g: 250, calories: 326, protein_g: 6.8, carbs_g: 70.6, fat_g: 0.8 },
  ]);
});

test("editing a saved food updates the diary from today on, or the whole history", async ({ page }) => {
  const today = toDateKey(new Date()); // the browser runs in the same time zone as this process
  const yesterday = addDays(today, -1);
  const food = await seedSavedFood("A", { name: "Pão E2E", calories_100g: 250, protein_100g: 9, carbs_100g: 48, fat_100g: 3 });
  const entry = (date: string) => ({
    entry_date: date, meal: "breakfast", kind: "food", name: "Pão E2E", quantity_g: 50,
    calories: 125, protein_g: 4.5, carbs_g: 24, fat_g: 1.5, saved_food_id: food.id,
  });
  await seedDiary("A", [entry(yesterday), entry(today)]);
  await login(page, "A");
  await openLog(page, today, "breakfast");

  const edit = async (calories: string, choice: RegExp, done: string) => {
    await page.getByRole("button", { name: "Editar guardado Pão E2E" }).click();
    await page.getByLabel("Calorias").fill(calories);
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByText("Está em 2 entradas do diário")).toBeVisible();
    await page.getByRole("button", { name: choice }).click();
    await expect(page.getByText(done)).toBeVisible(); // the DB confirmed the edit and the re-apply
  };

  await edit("300", /A partir de hoje/, "Guardado e 1 entrada atualizada");
  expect((await fetchDiary("A", today))[0]).toMatchObject({ calories: 150 });
  expect((await fetchDiary("A", yesterday))[0]).toMatchObject({ calories: 125 });

  await edit("200", /Todo o histórico/, "Guardado e 2 entradas atualizadas");
  expect((await fetchDiary("A", today))[0]).toMatchObject({ calories: 100 });
  expect((await fetchDiary("A", yesterday))[0]).toMatchObject({ calories: 100 });
});

test("editing a saved meal re-applies it with each entry's doses (SQL = TypeScript rounding)", async ({ page }) => {
  const items = [
    { name: "Aveia", quantity_g: 45, calories: 171, protein_g: 5.9, carbs_g: 27, fat_g: 3.2 },
    { name: "Leite", quantity_g: 250, calories: 115, protein_g: 8.3, carbs_g: 12, fat_g: 3.9 },
  ];
  const meal = await seedSavedMeal("A", { name: "Papas E2E", items, total_calories: 286, total_protein: 14.2, total_carbs: 39, total_fat: 7.1 });
  const target = { entry_date: DAY, meal: "breakfast" as const };
  await seedDiary("A", [
    { ...mealEntryRow(target, { ...meal, items }, 1.5), created_at: `${DAY}T08:00:00Z` },
    { ...mealEntryRow(target, { ...meal, items }, 1), created_at: `${DAY}T09:00:00Z` },
  ]);
  await login(page, "A");
  await openLog(page, DAY, "breakfast");

  await page.getByRole("button", { name: "Refeições" }).click();
  await page.getByRole("button", { name: "Editar guardado Papas E2E" }).click();
  await page.getByLabel("Quantidade de Aveia (g)").fill("60"); // rescaled from the saved item
  await page.getByRole("button", { name: "Guardar" }).click();
  await page.getByRole("button", { name: /Todo o histórico/ }).click();
  await expect(page.getByText("Guardado e 2 entradas atualizadas")).toBeVisible();

  const edited = [{ name: "Aveia", quantity_g: 60, calories: 228, protein_g: 7.9, carbs_g: 36, fat_g: 4.3 }, items[1]!];
  const [withDoses, single] = await fetchDiary("A", DAY);
  const expected = (doses: number) => {
    const row = mealEntryRow(target, { ...meal, items: edited }, doses);
    return { items: row.items, calories: row.calories, protein_g: row.protein_g, carbs_g: row.carbs_g, fat_g: row.fat_g, doses };
  };
  expect(withDoses).toMatchObject(expected(1.5));
  expect(single).toMatchObject(expected(1));
});

const AI_MEAL = {
  name: "Frango com arroz",
  items: [
    { name: "Frango grelhado", quantity_g: 150, calories: 248, protein_g: 46.5, carbs_g: 0, fat_g: 5.4 },
    { name: "Arroz", quantity_g: 150, calories: 195, protein_g: 4.1, carbs_g: 42.3, fat_g: 0.5 },
  ],
};

/** Mocks the AI endpoint and returns what the page sent. */
async function mockAi(page: Page) {
  const sent: { body?: { type?: string; mimeType?: string } } = {};
  await page.route("**/api/ai/parse", (route) => {
    sent.body = route.request().postDataJSON();
    return route.fulfill({ json: AI_MEAL });
  });
  return sent;
}

async function analyzeText(page: Page) {
  await page.getByRole("button", { name: "Registar com IA" }).click();
  await page.getByLabel("O que comeste?").fill("frango com arroz");
  await page.getByRole("button", { name: "Analisar" }).click();
  await expect(page.getByRole("heading", { name: "Frango com arroz" })).toBeVisible();
}

test("AI from a photo → one meal → 'Guardar e adicionar' with 2 portions", async ({ page }) => {
  const sent = await mockAi(page);
  await login(page, "A");
  await openLog(page);

  await page.getByRole("button", { name: "Registar com IA" }).click();
  const png = await page.screenshot({ clip: { x: 0, y: 0, width: 40, height: 30 } }); // a real image to decode
  await page.locator('input[type="file"]:not([capture])').setInputFiles({ name: "prato.png", mimeType: "image/png", buffer: png });
  await expect(page.getByRole("img", { name: "Foto selecionada" })).toBeVisible();
  await page.getByRole("button", { name: "Analisar" }).click();
  await expect(page.getByRole("heading", { name: "Frango com arroz" })).toBeVisible();
  expect(sent.body).toMatchObject({ type: "image", mimeType: "image/jpeg" });
  await expect(page.getByTestId("nutrient-summary")).toContainText("443"); // 1 portion

  await page.getByRole("button", { name: "Mais porções" }).click();
  await page.getByRole("button", { name: "Mais porções" }).click();
  await page.getByRole("button", { name: "Guardar e adicionar ao diário" }).click();
  await expect(page.getByText("Frango com arroz adicionado a almoço")).toBeVisible();

  const [meal] = await fetchSavedMeals("A");
  expect(meal).toMatchObject({ name: "Frango com arroz", total_calories: 443, items: AI_MEAL.items });
  const [row] = await fetchDiary("A", DAY);
  expect(row).toMatchObject({ kind: "meal", saved_meal_id: meal!.id, doses: 2, calories: 886, protein_g: 101.2 });
});

test("AI 'Editar' corrects the values, then 'Guardar nas refeições' saves without logging", async ({ page }) => {
  await mockAi(page);
  await login(page, "A");
  await openLog(page);
  await analyzeText(page);

  await page.getByRole("button", { name: "Editar" }).click();
  await page.getByLabel("Nome da refeição").fill("Frango com muito arroz");
  await page.getByLabel("Quantidade de Arroz (g)").fill("300"); // rescaled from the AI values
  await page.getByRole("button", { name: "Concluir" }).click();
  await expect(page.getByRole("heading", { name: "Frango com muito arroz" })).toBeVisible();
  await expect(page.getByTestId("nutrient-summary")).toContainText("638");

  await page.getByRole("button", { name: "Guardar nas refeições" }).click();
  await expect(page.getByRole("button", { name: "Guardada" })).toBeDisabled();
  const [meal] = await fetchSavedMeals("A");
  expect(meal).toMatchObject({ name: "Frango com muito arroz", total_calories: 638 });
  expect(await fetchDiary("A", DAY)).toHaveLength(0);
});

test("AI 'Só adicionar' logs an unlinked meal; a duplicate name is explained inline", async ({ page }) => {
  await seedSavedMeal("A", { name: "Frango com arroz", items: AI_MEAL.items, total_calories: 443, total_protein: 50.6, total_carbs: 42.3, total_fat: 5.9 });
  await mockAi(page);
  await login(page, "A");
  await openLog(page);
  await analyzeText(page);

  await page.getByRole("button", { name: "Guardar nas refeições" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Já tens uma refeição guardada com este nome" })).toBeVisible();
  expect(await fetchSavedMeals("A")).toHaveLength(1);

  await page.getByRole("button", { name: /Só adicionar ao diário/ }).click();
  await expect(page.getByText("Frango com arroz adicionado a almoço")).toBeVisible();
  const [row] = await fetchDiary("A", DAY);
  expect(row).toMatchObject({ kind: "meal", saved_meal_id: null, doses: 1, calories: 443 });
});

test("new meal by values per portion: 1.5 portions, shown without grams on Today", async ({ page }) => {
  await login(page, "A");
  await openLog(page, DAY, "dinner");

  await page.getByRole("button", { name: "Refeições" }).click();
  await page.getByRole("button", { name: "Nova refeição" }).click();
  await page.getByRole("button", { name: "Valores por porção" }).click();
  await page.getByLabel("Nome da refeição").fill("Bifana");
  await page.getByLabel("Calorias (kcal)").fill("450");
  await page.getByLabel("Proteína (g)").fill("25");
  await page.getByRole("button", { name: "Mais porções" }).click();
  await page.getByRole("button", { name: "Guardar e adicionar ao diário" }).click();
  await expect(page.getByText("Bifana adicionado a jantar")).toBeVisible();

  const [meal] = await fetchSavedMeals("A");
  expect(meal!.items).toEqual([{ name: "Bifana", quantity_g: null, calories: 450, protein_g: 25, carbs_g: 0, fat_g: 0 }]);
  expect((await fetchDiary("A", DAY))[0]).toMatchObject({ calories: 675, protein_g: 37.5, doses: 1.5 });

  await page.goto(`/?d=${DAY}`);
  const row = page.getByTestId("meal-dinner");
  await expect(row).toContainText("1.5 porções");
  await expect(row).toContainText("675 kcal");
  await row.getByRole("button", { name: /Bifana, 1 itens/ }).click();
  await expect(row.getByText(/ g$/)).toHaveCount(0);
});

test("new meal by joining saved foods: totals are the sum of the foods", async ({ page }) => {
  await seedSavedFood("A", { name: "Aveia E2E", calories_100g: 380, protein_100g: 13.2, carbs_100g: 60, fat_100g: 7 });
  await seedSavedFood("A", { name: "Leite E2E", calories_100g: 46, protein_100g: 3.3, carbs_100g: 4.8, fat_100g: 1.6 });
  await login(page, "A");
  await openLog(page, DAY, "breakfast");

  await page.getByRole("button", { name: "Refeições" }).click();
  await page.getByRole("button", { name: "Nova refeição" }).click();
  await page.getByLabel("Nome da refeição").fill("Papas E2E");
  await page.getByLabel("Adicionar alimento guardado").fill("aveia");
  await page.getByRole("button", { name: "Juntar Aveia E2E" }).click();
  await page.getByLabel("Quantidade de Aveia E2E (g)").fill("60");
  await page.getByLabel("Adicionar alimento guardado").fill("leite");
  await page.getByRole("button", { name: "Juntar Leite E2E" }).click();
  await page.getByLabel("Quantidade de Leite E2E (g)").fill("250");
  await expect(page.getByTestId("nutrient-summary")).toContainText("343"); // 228 + 115
  await page.getByRole("button", { name: "Guardar nas refeições" }).click();
  await expect(page.getByRole("button", { name: "Guardada" })).toBeDisabled();

  const [meal] = await fetchSavedMeals("A");
  expect(meal).toMatchObject({ name: "Papas E2E", total_calories: 343, total_protein: 16.2 });
  expect(meal!.items).toEqual([
    { name: "Aveia E2E", quantity_g: 60, calories: 228, protein_g: 7.9, carbs_g: 36, fat_g: 4.2 },
    { name: "Leite E2E", quantity_g: 250, calories: 115, protein_g: 8.3, carbs_g: 12, fat_g: 4 },
  ]);
});

test("a failed insert shows 'Sem ligação' and nothing is saved", async ({ page }) => {
  await seedSavedFood("A", { name: "Ovo E2E", calories_100g: 155, protein_100g: 13, carbs_100g: 1.1, fat_100g: 11 });
  await login(page, "A");
  await openLog(page);
  await page.route("**/rest/v1/diary_entries**", (route) => (route.request().method() === "POST" ? route.abort("internetdisconnected") : route.continue()));

  await page.getByRole("button", { name: "Escolher Ovo E2E" }).click();
  await page.getByRole("button", { name: "Adicionar a almoço" }).click();
  await expect(page.getByText(/Sem ligação/)).toBeVisible();
  await expect(page.getByText("Ovo E2E adicionado a almoço")).toHaveCount(0);
  expect(await fetchDiary("A", DAY)).toHaveLength(0);
});

test("saved items are private: B does not see A's foods and cannot re-apply them", async ({ page }) => {
  const food = await seedSavedFood("A", { name: "Privado E2E", calories_100g: 100, protein_100g: 1, carbs_100g: 1, fat_100g: 1 });
  await seedDiary("A", [
    { entry_date: DAY, meal: "lunch", kind: "food", name: "Privado E2E", quantity_g: 100, calories: 1, protein_g: 0, carbs_g: 0, fat_g: 0, saved_food_id: food.id },
  ]);
  expect(await applySavedFoodAs("B", food.id)).toBe(0);
  expect((await fetchDiary("A", DAY))[0]).toMatchObject({ calories: 1 });

  await login(page, "B");
  await openLog(page);
  await expect(page.getByText("Ainda sem alimentos guardados")).toBeVisible();
  await page.getByRole("searchbox", { name: "Pesquisar alimento" }).fill("privado e2e");
  await expect(page.getByRole("button", { name: "Escolher Privado E2E" })).toHaveCount(0);
});
