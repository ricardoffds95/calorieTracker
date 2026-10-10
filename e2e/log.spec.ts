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

interface Mocked {
  queries: string[];
  pages: number[];
}

/** Our search route is mocked (no Open Food Facts quota, stable data); records what it was asked. */
async function mockOff(page: Page, answer: (q: string, pageNumber: number) => unknown = () => ({ results: [ARROZ] })): Promise<Mocked> {
  const seen: Mocked = { queries: [], pages: [] };
  await page.route("**/api/food-search**", (route) => {
    const params = new URL(route.request().url()).searchParams;
    seen.queries.push(params.get("q") ?? "");
    seen.pages.push(Number(params.get("page")));
    return route.fulfill({ json: answer(params.get("q") ?? "", Number(params.get("page"))) });
  });
  return seen;
}

async function openLog(page: Page, date = DAY, meal = "lunch") {
  await page.goto(`/registar?meal=${meal}&d=${date}`);
  await expect(page.getByRole("heading", { name: "Registar" })).toBeVisible();
  await page.waitForLoadState("networkidle");
}

const searchBox = (page: Page) => page.getByRole("searchbox", { name: "Pesquisar alimento" });
const offTab = (page: Page) => page.getByRole("button", { name: /^Open Food Facts · / });
const savedTab = (page: Page) => page.getByRole("button", { name: /^Guardados · / });
const mealButton = (page: Page, name: string) => page.getByRole("group", { name: "Refeição", exact: true }).getByRole("button", { name, exact: true });

/** Types exact grams through "Escrever gramas" (the only place where the keyboard is meant to open). */
async function typeGrams(page: Page, grams: string) {
  await page.getByRole("button", { name: "Escrever gramas" }).click();
  await page.getByLabel("Gramas", { exact: true }).fill(grams);
}

test("search → add 150 g: diary row, auto-saved food with times_used and the Today totals", async ({ page }) => {
  await mockOff(page);
  await login(page, "A");
  await openLog(page);

  await searchBox(page).fill("arroz teste e2e"); // searches by itself after the pause
  await page.getByRole("button", { name: "Escolher Arroz Teste E2E" }).click();
  await expect(page.getByTestId("grams-value")).toHaveText("75 g"); // one serving
  await expect(mealButton(page, "Almoço")).toHaveAttribute("aria-pressed", "true"); // from the "+" of the meal in Today
  await typeGrams(page, "150");
  await expect(page.getByTestId("grams-value")).toHaveText("150 g");
  await expect(page.getByTestId("nutrient-summary")).toContainText("195");
  await page.getByRole("button", { name: "Guardar e adicionar ao diário" }).click();
  await expect(page.getByText(/Arroz Teste E2E adicionado a almoço/)).toBeVisible();

  const [row] = await fetchDiary("A", DAY);
  expect(row).toMatchObject({ meal: "lunch", kind: "food", quantity_g: 150, calories: 195, protein_g: 4.1, carbs_g: 42.3, fat_g: 0.5 });
  const [saved] = await fetchSavedFoods("A");
  expect(saved).toMatchObject({ id: row!.saved_food_id, name: "Arroz Teste E2E", off_code: "5601234567890", calories_100g: 130, times_used: 1 });

  // Next time it is also found in the saved foods.
  await searchBox(page).fill("arroz teste");
  await expect(savedTab(page)).toHaveText("Guardados · 1");
  await expect(page.getByTestId("search-results").getByRole("button", { name: /Escolher Arroz Teste E2E/ })).toHaveCount(1);
  await expect(page.getByTestId("search-results").getByLabel("Guardado")).toBeVisible();

  await page.goto(`/?d=${DAY}`);
  await expect(page.getByTestId("meal-lunch-kcal")).toHaveText("195 kcal");
});

test("the search waits for a pause (700 ms) or the button; two letters are enough", async ({ page }) => {
  const seen = await mockOff(page);
  await login(page, "A");
  await openLog(page);
  const box = searchBox(page);

  await box.fill("a"); // one letter: nothing to search
  await expect(page.getByRole("button", { name: "Pesquisar", exact: true })).toBeDisabled();
  await page.waitForTimeout(1_000);
  expect(seen.queries).toEqual([]);

  await box.pressSequentially("rroz teste", { delay: 60 }); // typed without pausing: one request in the end
  await expect(page.getByRole("button", { name: "Escolher Arroz Teste E2E" })).toBeVisible();
  expect(seen.queries).toEqual(["arroz teste"]);

  await box.fill("qu"); // two letters, then the button: no need to wait for the pause
  await page.getByRole("button", { name: "Pesquisar", exact: true }).click();
  await expect.poll(() => seen.queries).toEqual(["arroz teste", "qu"]);
  await page.waitForTimeout(1_000); // the pause that follows must not search "qu" again
  expect(seen.queries).toEqual(["arroz teste", "qu"]);
});

test("saved foods and Open Food Facts are always both searched, in separate tabs", async ({ page }) => {
  await seedSavedFood("A", { name: "Iogurte grego E2E", calories_100g: 97, protein_100g: 9, carbs_100g: 4, fat_100g: 5 });
  const seen = await mockOff(page);
  await login(page, "A");
  await openLog(page);

  await searchBox(page).fill("iogurte");
  await expect(savedTab(page)).toHaveText("Guardados · 1");
  await expect(offTab(page)).toHaveText("Open Food Facts · 1");
  expect(seen.queries).toEqual(["iogurte"]); // asked even though a saved food matches
  await expect(page.getByRole("button", { name: "Escolher Iogurte grego E2E" })).toBeVisible(); // opens on the saved foods
  await expect(page.getByRole("button", { name: "Escolher Arroz Teste E2E" })).toHaveCount(0);

  await offTab(page).click();
  await expect(page.getByRole("button", { name: "Escolher Arroz Teste E2E" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Escolher Iogurte grego E2E" })).toHaveCount(0);

  // nothing saved matches: it opens on Open Food Facts
  await searchBox(page).fill("queijo");
  await expect(page.getByRole("button", { name: "Escolher Arroz Teste E2E" })).toBeVisible();
  await expect(savedTab(page)).toHaveText("Guardados · 0");
});

test("every result is reachable: pages of 20 in Open Food Facts, with the total", async ({ page }) => {
  const product = (n: number) => ({ ...ARROZ, id: `p${n}`, name: `Produto ${n}`, off_code: `p${n}` });
  const seen = await mockOff(page, (_q, pageNumber) => ({
    results: [product(pageNumber * 100 + 1), product(pageNumber * 100 + 2)],
    page: pageNumber,
    pageCount: 3,
    total: 45,
    totalExact: true,
  }));
  await login(page, "A");
  await openLog(page);

  await searchBox(page).fill("produto");
  await expect(offTab(page)).toHaveText("Open Food Facts · 45");
  await offTab(page).click();
  await expect(page.getByRole("button", { name: "Escolher Produto 101" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Página 1" })).toHaveAttribute("aria-current", "page");

  await page.getByRole("button", { name: "Página 3" }).click();
  await expect(page.getByRole("button", { name: "Escolher Produto 301" })).toBeVisible();
  expect(seen.pages).toEqual([1, 3]);
  await page.getByRole("button", { name: "Página anterior" }).click();
  await expect(page.getByRole("button", { name: "Escolher Produto 201" })).toBeVisible();

  await searchBox(page).fill("produtos"); // a new search starts on page 1 again
  await expect(page.getByRole("button", { name: "Escolher Produto 101" })).toBeVisible();
});

test("nothing is cached: the same search asks Open Food Facts again", async ({ page }) => {
  const seen = await mockOff(page);
  await login(page, "A");
  await openLog(page);

  await searchBox(page).fill("iogurte");
  await expect(page.getByRole("button", { name: "Escolher Arroz Teste E2E" })).toBeVisible();
  await searchBox(page).fill("");
  await page.waitForTimeout(900); // the empty text must settle (700 ms) before the same words count as a new search
  await searchBox(page).fill("iogurte");
  await expect.poll(() => seen.queries).toEqual(["iogurte", "iogurte"]);
});

test("scrolling the results closes the keyboard", async ({ page }) => {
  const product = (n: number) => ({ ...ARROZ, id: `p${n}`, name: `Produto ${n}`, off_code: `p${n}` });
  await mockOff(page, () => ({ results: Array.from({ length: 20 }, (_, i) => product(i + 1)), page: 1, pageCount: 1, total: 20, totalExact: true }));
  await login(page, "A");
  await openLog(page);

  await searchBox(page).fill("produto");
  await offTab(page).click();
  await expect(page.getByRole("button", { name: "Escolher Produto 20" })).toBeAttached();
  await searchBox(page).focus();
  await expect(searchBox(page)).toBeFocused();
  // the browser scrolling to reveal the field right after focusing must not close the keyboard
  await page.evaluate(() => window.scrollTo(0, 80));
  await page.waitForTimeout(150);
  await expect(searchBox(page)).toBeFocused();
  await page.waitForTimeout(600);
  await page.mouse.move(100, 400);
  await page.mouse.wheel(0, 600);
  await expect(searchBox(page)).not.toBeFocused();
});

test("a food from Open Food Facts can be only saved, or saved and logged", async ({ page }) => {
  await mockOff(page);
  await login(page, "A");
  await openLog(page);

  await searchBox(page).fill("arroz teste e2e");
  await page.getByRole("button", { name: "Escolher Arroz Teste E2E" }).click();
  await page.getByRole("button", { name: "Só guardar nos alimentos" }).click();
  await expect(page.getByText("Guardado nos alimentos")).toBeVisible();
  const [saved] = await fetchSavedFoods("A");
  expect(saved).toMatchObject({ name: "Arroz Teste E2E", off_code: "5601234567890", calories_100g: 130, times_used: 0 });
  expect(await fetchDiary("A", DAY)).toHaveLength(0);

  // already saved: nothing left to save, it can only be logged
  await expect(savedTab(page)).toHaveText("Guardados · 1");
  await page.getByRole("button", { name: "Escolher Arroz Teste E2E" }).click();
  await expect(page.getByRole("button", { name: "Só guardar nos alimentos" })).toHaveCount(0);
  await page.getByRole("button", { name: "Adicionar ao diário" }).click();
  await expect(page.getByText(/Arroz Teste E2E adicionado a almoço/)).toBeVisible();
  const [row] = await fetchDiary("A", DAY);
  expect(row).toMatchObject({ saved_food_id: saved!.id, quantity_g: 100 }); // a saved food has no label serving
  expect((await fetchSavedFoods("A"))[0]).toMatchObject({ times_used: 1 });
});

test("a new food can be logged without saving it: it only goes to the diary", async ({ page }) => {
  await mockOff(page);
  await login(page, "A");
  await openLog(page);

  await searchBox(page).fill("arroz teste e2e");
  await page.getByRole("button", { name: "Escolher Arroz Teste E2E" }).click();
  for (const name of ["Guardar e adicionar ao diário", "Só adicionar ao diário", "Só guardar nos alimentos"]) {
    await expect(page.getByRole("button", { name, exact: true })).toBeVisible(); // the three choices
  }
  await page.getByRole("button", { name: "Só adicionar ao diário", exact: true }).click();
  await expect(page.getByText(/Arroz Teste E2E adicionado a almoço/)).toBeVisible();

  const [row] = await fetchDiary("A", DAY);
  expect(row).toMatchObject({ name: "Arroz Teste E2E", quantity_g: 75, calories: 98, saved_food_id: null });
  expect(await fetchSavedFoods("A")).toHaveLength(0); // nothing was kept in "Guardados"
});

test("opening a food or a meal never opens the keyboard: nothing is focused or selected", async ({ page }) => {
  await seedSavedFood("A", { name: "Ovo E2E", calories_100g: 155, protein_100g: 13, carbs_100g: 1.1, fat_100g: 11 });
  await seedSavedMeal("A", { name: "Sopa E2E", items: [{ name: "Sopa", quantity_g: null, calories: 180, protein_g: 5, carbs_g: 20, fat_g: 6 }], total_calories: 180, total_protein: 5, total_carbs: 20, total_fat: 6 });
  await login(page, "A");
  await openLog(page);
  const focusedField = () => page.evaluate(() => ["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName ?? ""));

  await page.getByRole("button", { name: "Escolher Ovo E2E" }).click();
  await expect(page.getByTestId("grams-value")).toHaveText("100 g");
  expect(await focusedField()).toBe(false);
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Refeições" }).click();
  await page.getByRole("button", { name: "Escolher Sopa E2E" }).click();
  await expect(page.getByRole("status", { name: "Porções" })).toBeVisible();
  expect(await focusedField()).toBe(false);
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Editar guardado Sopa E2E" }).click();
  await expect(page.getByRole("heading", { name: /Editar refeição guardado/ })).toBeVisible();
  expect(await focusedField()).toBe(false);
  expect(await page.evaluate(() => window.getSelection()?.toString() ?? "")).toBe("");
});

test("grams: a bar and buttons move 10 g at a time, or the exact value is typed", async ({ page }) => {
  await seedSavedFood("A", { name: "Ovo E2E", calories_100g: 200, protein_100g: 10, carbs_100g: 0, fat_100g: 10 });
  await login(page, "A");
  await openLog(page);
  await page.getByRole("button", { name: "Escolher Ovo E2E" }).click();

  const grams = page.getByTestId("grams-value");
  await expect(grams).toHaveText("100 g");
  await expect(page.getByLabel("Gramas", { exact: true })).toHaveCount(0); // nothing to type until asked
  await page.getByRole("button", { name: "Mais 10 g" }).click();
  await expect(grams).toHaveText("110 g");
  await expect(page.getByTestId("nutrient-summary")).toContainText("220");
  await page.getByRole("button", { name: "Menos 10 g" }).click();
  await page.getByRole("button", { name: "Menos 10 g" }).click();
  await expect(grams).toHaveText("90 g");

  await page.getByRole("slider").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(grams).toHaveText("110 g"); // 10 g per step

  await typeGrams(page, "275,5"); // decimal comma, beyond the bar's 500 g? no: exact value
  await expect(grams).toHaveText("275.5 g");
  await expect(page.getByTestId("nutrient-summary")).toContainText("551");
  await page.getByLabel("Gramas", { exact: true }).fill("0");
  await expect(page.getByRole("alert").filter({ hasText: "maior que 0" })).toBeVisible();
  await page.getByLabel("Gramas", { exact: true }).fill("900");
  await expect(grams).toHaveText("900 g"); // above the bar
  await page.getByRole("button", { name: "Adicionar ao diário" }).click();
  await expect(page.getByText(/Ovo E2E adicionado a/)).toBeVisible();
  expect((await fetchDiary("A", DAY))[0]).toMatchObject({ quantity_g: 900, calories: 1800 });
});

test("the day and the meal are chosen where the food is added (snacks by default)", async ({ page }) => {
  await seedSavedFood("A", { name: "Ovo E2E", calories_100g: 155, protein_100g: 13, carbs_100g: 1.1, fat_100g: 11 });
  await login(page, "A");
  await page.goto("/registar"); // no meal and day in the URL
  await expect(page.getByRole("heading", { name: "Registar" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("group", { name: "Refeição" })).toHaveCount(0); // the menu at the top is gone

  await page.getByRole("button", { name: "Escolher Ovo E2E" }).click();
  await expect(mealButton(page, "Lanches")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Data")).toHaveValue(toDateKey(new Date()));
  await mealButton(page, "Jantar").click();
  await page.getByLabel("Data").fill("2026-01-22");
  await page.getByRole("button", { name: "Adicionar ao diário" }).click();
  await expect(page.getByText(/Ovo E2E adicionado a jantar \(.*22 jan\)/)).toBeVisible();

  expect(await fetchDiary("A", "2026-01-22")).toHaveLength(1);
  expect((await fetchDiary("A", "2026-01-22"))[0]).toMatchObject({ meal: "dinner", name: "Ovo E2E" });
  expect(await fetchDiary("A", toDateKey(new Date()))).toHaveLength(0);
});

test("when Open Food Facts is down: clear message, saved foods stay, and 'Tentar novamente' recovers", async ({ page }) => {
  await seedSavedFood("A", { name: "Arroz guardado E2E", calories_100g: 120, protein_100g: 2.5, carbs_100g: 26, fat_100g: 0.3 });
  let down = true;
  await page.route("**/api/food-search**", (route) =>
    down ? route.fulfill({ status: 503, json: { error: "off_unavailable" } }) : route.fulfill({ json: { results: [ARROZ] } }),
  );
  await login(page, "A");
  await openLog(page);

  await searchBox(page).fill("arroz");
  await expect(page.getByRole("button", { name: "Escolher Arroz guardado E2E" })).toBeVisible(); // the saved foods are there anyway
  await offTab(page).click();
  const problem = page.getByRole("alert").filter({ hasText: "O Open Food Facts não respondeu" }); // Next.js adds its own empty alert
  await expect(problem).toBeVisible();
  await expect(page.getByText("Sem ligação")).toHaveCount(0);

  down = false;
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(page.getByRole("button", { name: "Escolher Arroz Teste E2E" })).toBeVisible();
  await expect(problem).toHaveCount(0);
});

test.describe("live Open Food Facts", () => {
  test.skip(!process.env.E2E_LIVE_OFF, "Set E2E_LIVE_OFF=1 to search the real Open Food Facts through our route");

  test("'peito de frango' returns real, usable foods, page by page", async ({ page }) => {
    await login(page, "A");
    const first = await page.request.get("/api/food-search?q=peito%20de%20frango");
    expect(first.status()).toBe(200);
    const body = (await first.json()) as { results: { name: string; calories_100g: number }[]; page: number; pageCount: number; total: number };
    expect(body.results.length).toBeGreaterThan(3);
    expect(body.results.every((r) => r.name && r.calories_100g > 0)).toBe(true);
    expect(body).toMatchObject({ page: 1 });
    expect(body.pageCount).toBeGreaterThan(1);
    expect(body.total).toBeGreaterThan(20);
    const second = (await (await page.request.get("/api/food-search?q=peito%20de%20frango&page=2")).json()) as { results: { id: string }[]; page: number };
    expect(second.page).toBe(2);
    expect(second.results[0]?.id).not.toBe((body.results[0] as unknown as { id: string }).id);
    expect((await page.request.get("/api/food-search?q=a")).status()).toBe(400);
    expect((await page.request.get("/api/food-search?q=ar")).status()).toBe(200); // two letters are fine
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
  await page.getByRole("button", { name: "Usar 2 porções" }).click();
  await expect(page.getByRole("status", { name: "Porções" })).toHaveText("2 porções");
  await page.getByRole("button", { name: "Adicionar ao diário" }).click();
  await expect(page.getByText(/Almoço E2E adicionado a jantar/)).toBeVisible();

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
  await page.getByRole("button", { name: "Com IA" }).click();
  await page.getByLabel("O que comeste?").fill("frango com arroz");
  await page.getByRole("button", { name: "Analisar" }).click();
  await expect(page.getByRole("heading", { name: "Frango com arroz" })).toBeVisible();
}

test("AI from a photo → one meal → 'Guardar e adicionar' with 2 portions", async ({ page }) => {
  const sent = await mockAi(page);
  await login(page, "A");
  await openLog(page);

  await page.getByRole("button", { name: "Com IA" }).click();
  const png = await page.screenshot({ clip: { x: 0, y: 0, width: 40, height: 30 } }); // a real image to decode
  await page.locator('input[type="file"]:not([capture])').setInputFiles({ name: "prato.png", mimeType: "image/png", buffer: png });
  await expect(page.getByRole("img", { name: "Foto selecionada" })).toBeVisible();
  await page.getByRole("button", { name: "Analisar" }).click();
  await expect(page.getByRole("heading", { name: "Frango com arroz" })).toBeVisible();
  expect(sent.body).toMatchObject({ type: "image", mimeType: "image/jpeg" });
  await expect(page.getByTestId("nutrient-summary")).toContainText("443"); // 1 portion

  await page.getByRole("button", { name: "Usar 2 porções" }).click();
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

test("Refeições: no barcode and no Open Food Facts; only saved meals are searched, or the AI is used", async ({ page }) => {
  const seen = await mockOff(page);
  const items = [{ name: "Sopa", quantity_g: null, calories: 100, protein_g: 5, carbs_g: 10, fat_g: 2 }];
  await seedSavedMeal("A", { name: "Sopa de legumes", items, total_calories: 100, total_protein: 5, total_carbs: 10, total_fat: 2 });
  await seedSavedMeal("A", { name: "Bifana", items, total_calories: 450, total_protein: 25, total_carbs: 40, total_fat: 20 });
  await login(page, "A");
  await openLog(page);

  await expect(page.getByRole("button", { name: "Código de barras" })).toBeVisible();
  await page.getByRole("button", { name: "Refeições", exact: true }).click();
  await expect(page.getByRole("button", { name: "Código de barras" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Pesquisar", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Com IA" })).toBeVisible();

  await page.getByRole("searchbox", { name: "Pesquisar refeição" }).fill("sopa");
  await expect(page.getByRole("button", { name: "Escolher Sopa de legumes" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Escolher Bifana" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Open Food Facts/ })).toHaveCount(0);
  expect(seen.queries).toEqual([]); // never asked Open Food Facts

  await page.getByRole("button", { name: "Escolher Sopa de legumes" }).click();
  await expect(page.getByRole("heading", { name: "Sopa de legumes" })).toBeVisible();
});

test("long lists of saved items scroll inside themselves", async ({ page }) => {
  for (let i = 1; i <= 14; i++) {
    await seedSavedFood("A", { name: `Alimento ${String(i).padStart(2, "0")}`, calories_100g: 100 + i, protein_100g: 1, carbs_100g: 1, fat_100g: 1 });
  }
  await login(page, "A");
  await openLog(page);

  const list = page.getByRole("region", { name: "Lista de guardados" });
  await expect(list).toBeVisible();
  expect(await list.evaluate((el) => el.scrollHeight > el.clientHeight && getComputedStyle(el).overflowY === "auto")).toBe(true);
});

test("portions change 0.1 at a time, without floating point noise, and have shortcuts", async ({ page }) => {
  await seedSavedMeal("A", { name: "Sopa E2E", items: [{ name: "Sopa", quantity_g: null, calories: 100, protein_g: 5, carbs_g: 10, fat_g: 2 }], total_calories: 100, total_protein: 5, total_carbs: 10, total_fat: 2 });
  await login(page, "A");
  await openLog(page);

  await page.getByRole("button", { name: "Refeições" }).click();
  await page.getByRole("button", { name: "Escolher Sopa E2E" }).click();
  const portions = page.getByLabel("Porções", { exact: true });
  await expect(portions).toHaveText("1 porção");
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Mais porções" }).click();
  await expect(portions).toHaveText("1.3 porções");
  await expect(page.getByTestId("nutrient-summary")).toContainText("130");
  for (let i = 0; i < 5; i++) await page.getByRole("button", { name: "Menos porções" }).click();
  await expect(portions).toHaveText("0.8 porções");
  await page.getByRole("button", { name: "Usar 0.5 porções" }).click();
  await expect(portions).toHaveText("0.5 porções");
  await page.getByRole("button", { name: "Adicionar ao diário" }).click();
  await expect(page.getByText("Sopa E2E adicionado a almoço")).toBeVisible();
  expect((await fetchDiary("A", DAY))[0]).toMatchObject({ doses: 0.5, calories: 50 });
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
  await page.getByRole("button", { name: "Usar 1.5 porções" }).click();
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

test("new meal: a food from the Open Food Facts search asks its quantity", async ({ page }) => {
  await mockOff(page);
  await login(page, "A");
  await openLog(page);

  await page.getByRole("button", { name: "Refeições" }).click();
  await page.getByRole("button", { name: "Nova refeição" }).click();
  await page.getByRole("dialog").getByRole("searchbox", { name: "Pesquisar alimento" }).fill("arroz teste e2e");
  await offTab(page).click();
  await page.getByRole("button", { name: "Escolher Arroz Teste E2E" }).click();
  await typeGrams(page, "200");
  await page.getByRole("button", { name: "Juntar à refeição" }).click();
  await expect(page.getByLabel("Quantidade de Arroz Teste E2E (g)")).toHaveValue("200");
  await page.getByLabel("Nome da refeição").fill("Arroz simples");
  await expect(page.getByTestId("nutrient-summary")).toContainText("260");
});

test("AI knows a single food from a meal: it opens the food sheet with the estimated grams and saves it as a food", async ({ page }) => {
  await page.route("**/api/ai/parse", (route) =>
    route.fulfill({
      json: {
        name: "Peito de frango grelhado",
        kind: "food",
        items: [{ name: "peito de frango grelhado", quantity_g: 150, calories: 248, protein_g: 46.5, carbs_g: 0, fat_g: 5.4 }],
      },
    }),
  );
  await login(page, "A");
  await openLog(page);

  await page.getByRole("button", { name: "Com IA" }).click();
  await page.getByLabel("O que comeste?").fill("150 g de peito de frango grelhado");
  await page.getByRole("button", { name: "Analisar" }).click();

  await expect(page.getByRole("heading", { name: "Peito de frango grelhado" })).toBeVisible();
  await expect(page.getByTestId("nutrient-summary")).toContainText("248"); // the 150 g estimate
  await expect(page.getByRole("button", { name: "Guardar nas refeições" })).toHaveCount(0);
  await page.getByRole("button", { name: "Guardar e adicionar ao diário" }).click();
  await expect(page.getByText(/Peito de frango grelhado adicionado a/)).toBeVisible();

  const [food] = await fetchSavedFoods("A");
  expect(food).toMatchObject({ name: "Peito de frango grelhado", calories_100g: 165, protein_100g: 31, fat_100g: 3.6 });
  expect(await fetchSavedMeals("A")).toHaveLength(0);
  expect((await fetchDiary("A", DAY))[0]).toMatchObject({ kind: "food", quantity_g: 150, calories: 248, saved_food_id: food!.id });
});

test("new meal: the AI result joins the meal and names it", async ({ page }) => {
  await mockAi(page);
  await login(page, "A");
  await openLog(page);

  await page.getByRole("button", { name: "Refeições" }).click();
  await page.getByRole("button", { name: "Nova refeição" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Com IA" }).click();
  await page.getByLabel("O que comeste?").fill("frango com arroz");
  await page.getByRole("button", { name: "Analisar" }).click();
  await expect(page.getByText("Refeição com 2 alimentos")).toBeVisible();
  await page.getByRole("button", { name: "Editar quantidades" }).click();
  await page.getByLabel("Quantidade de Arroz (g)").fill("100");
  await page.getByRole("button", { name: "Concluir" }).click();
  await page.getByRole("button", { name: "Usar refeição completa" }).click();

  await expect(page.getByLabel("Nome da refeição")).toHaveValue("Frango com arroz");
  await expect(page.getByLabel("Quantidade de Frango grelhado (g)")).toHaveValue("150");
  await expect(page.getByLabel("Quantidade de Arroz (g)")).toHaveValue("100");
  await expect(page.getByTestId("nutrient-summary")).toContainText("378"); // 248 + 130
});

test("new meal by joining saved foods: totals are the sum of the foods", async ({ page }) => {
  await seedSavedFood("A", { name: "Aveia E2E", calories_100g: 380, protein_100g: 13.2, carbs_100g: 60, fat_100g: 7 });
  await seedSavedFood("A", { name: "Leite E2E", calories_100g: 46, protein_100g: 3.3, carbs_100g: 4.8, fat_100g: 1.6 });
  await login(page, "A");
  await openLog(page, DAY, "breakfast");

  await page.getByRole("button", { name: "Refeições" }).click();
  await page.getByRole("button", { name: "Nova refeição" }).click();
  await page.getByLabel("Nome da refeição").fill("Papas E2E");
  await page.getByRole("dialog").getByRole("searchbox", { name: "Pesquisar alimento" }).fill("aveia");
  await page.getByRole("button", { name: "Escolher Aveia E2E" }).click();
  await page.getByRole("button", { name: "Juntar à refeição" }).click();
  await page.getByLabel("Quantidade de Aveia E2E (g)").fill("60");
  await page.getByRole("dialog").getByRole("searchbox", { name: "Pesquisar alimento" }).fill("leite");
  await page.getByRole("button", { name: "Escolher Leite E2E" }).click();
  await page.getByRole("button", { name: "Juntar à refeição" }).click();
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
  await page.getByRole("button", { name: "Adicionar ao diário" }).click();
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
