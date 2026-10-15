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
  await page.goto(`/add?meal=${meal}&d=${date}`);
  await expect(page.getByRole("heading", { name: "Add meal" })).toBeVisible();
  await page.waitForLoadState("networkidle");
}

const searchBox = (page: Page) => page.getByRole("searchbox", { name: "Search food" });
const offTab = (page: Page) => page.getByRole("button", { name: /^Open Food Facts · / });
const savedTab = (page: Page) => page.getByRole("button", { name: /^Saved · / });
const mealButton = (page: Page, name: string) => page.getByRole("group", { name: "Meal", exact: true }).getByRole("button", { name, exact: true });

/** Types exact grams through "Type grams" (the only place where the keyboard is meant to open). */
async function typeGrams(page: Page, grams: string) {
  await page.getByRole("button", { name: "Type grams" }).click();
  await page.getByLabel("Grams", { exact: true }).fill(grams);
}

test("search → add 150 g with the star: diary row, saved food with times_used and the Today totals", async ({ page }) => {
  await mockOff(page);
  await login(page, "A");
  await openLog(page);

  await searchBox(page).fill("arroz teste e2e"); // searches by itself after the pause
  await page.getByRole("button", { name: "Choose Arroz Teste E2E" }).click();
  await expect(page.getByTestId("grams-value")).toHaveText("75 g"); // one serving
  await expect(mealButton(page, "Lunch")).toHaveAttribute("aria-pressed", "true"); // from the "+" of the meal in Today
  await typeGrams(page, "150");
  await expect(page.getByTestId("grams-value")).toHaveText("150 g");
  await expect(page.getByTestId("nutrient-summary")).toContainText("195");
  await page.getByRole("button", { name: "Save to favorites" }).click(); // the star keeps it in Saved
  await page.getByRole("button", { name: "Add to diary" }).click();
  await expect(page.getByText(/Arroz Teste E2E added to lunch.* · saved/)).toBeVisible();

  const [row] = await fetchDiary("A", DAY);
  expect(row).toMatchObject({ meal: "lunch", kind: "food", quantity_g: 150, calories: 195, protein_g: 4.1, carbs_g: 42.3, fat_g: 0.5 });
  const [saved] = await fetchSavedFoods("A");
  expect(saved).toMatchObject({ id: row!.saved_food_id, name: "Arroz Teste E2E", off_code: "5601234567890", calories_100g: 130, times_used: 1 });

  // Next time it is also found in the saved foods.
  await searchBox(page).fill("arroz teste");
  await expect(savedTab(page)).toHaveText("Saved · 1");
  await expect(page.getByTestId("search-results").getByRole("button", { name: /Choose Arroz Teste E2E/ })).toHaveCount(1);
  await expect(page.getByTestId("search-results").getByLabel("Saved")).toBeVisible();

  await page.goto(`/?d=${DAY}`);
  await expect(page.getByTestId("meal-lunch-kcal")).toHaveText("195 kcal");
});

test("the search waits for a pause (700 ms) or the button; two letters are enough", async ({ page }) => {
  const seen = await mockOff(page);
  await login(page, "A");
  await openLog(page);
  const box = searchBox(page);

  await box.fill("a"); // one letter: nothing to search
  await expect(page.getByRole("button", { name: "Search", exact: true })).toBeDisabled();
  await page.waitForTimeout(1_000);
  expect(seen.queries).toEqual([]);

  await box.pressSequentially("rroz teste", { delay: 60 }); // typed without pausing: one request in the end
  await expect(page.getByRole("button", { name: "Choose Arroz Teste E2E" })).toBeVisible();
  expect(seen.queries).toEqual(["arroz teste"]);

  await box.fill("qu"); // two letters, then the button: no need to wait for the pause
  await page.getByRole("button", { name: "Search", exact: true }).click();
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
  await expect(savedTab(page)).toHaveText("Saved · 1");
  await expect(offTab(page)).toHaveText("Open Food Facts · 1");
  expect(seen.queries).toEqual(["iogurte"]); // asked even though a saved food matches
  await expect(page.getByRole("button", { name: "Choose Iogurte grego E2E" })).toBeVisible(); // opens on the saved foods
  await expect(page.getByRole("button", { name: "Choose Arroz Teste E2E" })).toHaveCount(0);

  await offTab(page).click();
  await expect(page.getByRole("button", { name: "Choose Arroz Teste E2E" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Choose Iogurte grego E2E" })).toHaveCount(0);

  // nothing saved matches: it opens on Open Food Facts
  await searchBox(page).fill("queijo");
  await expect(page.getByRole("button", { name: "Choose Arroz Teste E2E" })).toBeVisible();
  await expect(savedTab(page)).toHaveText("Saved · 0");
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
  await expect(page.getByRole("button", { name: "Choose Produto 101" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Page 1" })).toHaveAttribute("aria-current", "page");

  await page.getByRole("button", { name: "Page 3" }).click();
  await expect(page.getByRole("button", { name: "Choose Produto 301" })).toBeVisible();
  expect(seen.pages).toEqual([1, 3]);
  await page.getByRole("button", { name: "Previous page" }).click();
  await expect(page.getByRole("button", { name: "Choose Produto 201" })).toBeVisible();

  await searchBox(page).fill("produtos"); // a new search starts on page 1 again
  await expect(page.getByRole("button", { name: "Choose Produto 101" })).toBeVisible();
});

test("nothing is cached: the same search asks Open Food Facts again", async ({ page }) => {
  const seen = await mockOff(page);
  await login(page, "A");
  await openLog(page);

  await searchBox(page).fill("iogurte");
  await expect(page.getByRole("button", { name: "Choose Arroz Teste E2E" })).toBeVisible();
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
  await expect(page.getByRole("button", { name: "Choose Produto 20" })).toBeAttached();
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

test("a food from Open Food Facts is kept in Saved only with the star; a saved food shows a filled star", async ({ page }) => {
  await mockOff(page);
  await login(page, "A");
  await openLog(page);

  await searchBox(page).fill("arroz teste e2e");
  await page.getByRole("button", { name: "Choose Arroz Teste E2E" }).click();
  await page.getByRole("button", { name: "Save to favorites" }).click();
  await expect(page.getByRole("button", { name: "Save to favorites" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Add to diary" }).click();
  await expect(page.getByText(/Arroz Teste E2E added to lunch/)).toBeVisible();
  const [saved] = await fetchSavedFoods("A");
  expect(saved).toMatchObject({ name: "Arroz Teste E2E", off_code: "5601234567890", calories_100g: 130, times_used: 1 });

  // already saved: the star is filled and cannot be switched off here, and adding again counts another use
  await expect(savedTab(page)).toHaveText("Saved · 1");
  await page.getByRole("button", { name: "Choose Arroz Teste E2E" }).click();
  await expect(page.getByRole("button", { name: "Saved", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Add to diary" }).click();
  await expect(page.getByText(/Arroz Teste E2E added to lunch/)).toBeVisible();
  const rows = await fetchDiary("A", DAY);
  expect(rows).toHaveLength(2);
  expect(rows[1]).toMatchObject({ saved_food_id: saved!.id, quantity_g: 100 }); // a saved food has no label serving
  expect((await fetchSavedFoods("A"))[0]).toMatchObject({ times_used: 2 });
});

test("a new food has one button, Add to diary: without the star it only goes to the diary", async ({ page }) => {
  await mockOff(page);
  await login(page, "A");
  await openLog(page);

  await searchBox(page).fill("arroz teste e2e");
  await page.getByRole("button", { name: "Choose Arroz Teste E2E" }).click();
  await expect(page.getByRole("button", { name: "Save to favorites" })).toHaveAttribute("aria-pressed", "false");
  for (const gone of ["Save and add", "Add only", "Save only"]) {
    await expect(page.getByRole("button", { name: gone, exact: true })).toHaveCount(0);
  }
  await page.getByRole("button", { name: "Add to diary" }).click();
  await expect(page.getByText(/Arroz Teste E2E added to lunch/)).toBeVisible();

  const [row] = await fetchDiary("A", DAY);
  expect(row).toMatchObject({ name: "Arroz Teste E2E", quantity_g: 75, calories: 98, saved_food_id: null });
  expect(await fetchSavedFoods("A")).toHaveLength(0); // nothing was kept in "Saved"
});

test("opening a food or a meal never opens the keyboard: nothing is focused or selected", async ({ page }) => {
  await seedSavedFood("A", { name: "Ovo E2E", calories_100g: 155, protein_100g: 13, carbs_100g: 1.1, fat_100g: 11 });
  await seedSavedMeal("A", { name: "Sopa E2E", items: [{ name: "Sopa", quantity_g: null, calories: 180, protein_g: 5, carbs_g: 20, fat_g: 6 }], total_calories: 180, total_protein: 5, total_carbs: 20, total_fat: 6 });
  await login(page, "A");
  await openLog(page);
  const focusedField = () => page.evaluate(() => ["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName ?? ""));

  await page.getByRole("button", { name: "Choose Ovo E2E" }).click();
  await expect(page.getByTestId("grams-value")).toHaveText("100 g");
  expect(await focusedField()).toBe(false);
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Choose Sopa E2E" }).click();
  await expect(page.getByRole("status", { name: "Portions" })).toBeVisible();
  expect(await focusedField()).toBe(false);
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Edit saved Sopa E2E" }).click();
  await expect(page.getByRole("heading", { name: /Edit saved meal/ })).toBeVisible();
  expect(await focusedField()).toBe(false);
  expect(await page.evaluate(() => window.getSelection()?.toString() ?? "")).toBe("");
});

test("grams: a bar and buttons move 10 g at a time, or the exact value is typed", async ({ page }) => {
  await seedSavedFood("A", { name: "Ovo E2E", calories_100g: 200, protein_100g: 10, carbs_100g: 0, fat_100g: 10 });
  await login(page, "A");
  await openLog(page);
  await page.getByRole("button", { name: "Choose Ovo E2E" }).click();

  const grams = page.getByTestId("grams-value");
  await expect(grams).toHaveText("100 g");
  await expect(page.getByLabel("Grams", { exact: true })).toHaveCount(0); // nothing to type until asked
  await page.getByRole("button", { name: "Plus 10 g" }).click();
  await expect(grams).toHaveText("110 g");
  await expect(page.getByTestId("nutrient-summary")).toContainText("220");
  await page.getByRole("button", { name: "Minus 10 g" }).click();
  await page.getByRole("button", { name: "Minus 10 g" }).click();
  await expect(grams).toHaveText("90 g");

  await page.getByRole("slider").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(grams).toHaveText("110 g"); // 10 g per step

  await typeGrams(page, "275,5"); // decimal comma, beyond the bar's 500 g? no: exact value
  await expect(grams).toHaveText("275.5 g");
  await expect(page.getByTestId("nutrient-summary")).toContainText("551");
  await page.getByLabel("Grams", { exact: true }).fill("0");
  await expect(page.getByRole("alert").filter({ hasText: "above 0" })).toBeVisible();
  await page.getByLabel("Grams", { exact: true }).fill("900");
  await expect(grams).toHaveText("900 g"); // above the bar
  await page.getByRole("button", { name: "Add to diary" }).click();
  await expect(page.getByText(/Ovo E2E added to/)).toBeVisible();
  expect((await fetchDiary("A", DAY))[0]).toMatchObject({ quantity_g: 900, calories: 1800 });
});

test("the day and the meal are chosen where the food is added (snacks by default)", async ({ page }) => {
  await seedSavedFood("A", { name: "Ovo E2E", calories_100g: 155, protein_100g: 13, carbs_100g: 1.1, fat_100g: 11 });
  await login(page, "A");
  await page.goto("/add"); // no meal and day in the URL
  await expect(page.getByRole("heading", { name: "Add meal" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("group", { name: "Meal" })).toHaveCount(0); // the menu at the top is gone

  await page.getByRole("button", { name: "Choose Ovo E2E" }).click();
  await expect(mealButton(page, "Snacks")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Date")).toHaveValue(toDateKey(new Date()));
  await mealButton(page, "Dinner").click();
  await page.getByLabel("Date").fill("2026-01-22");
  await page.getByRole("button", { name: "Add to diary" }).click();
  await expect(page.getByText(/Ovo E2E added to dinner \(.*22 jan\)/)).toBeVisible();

  expect(await fetchDiary("A", "2026-01-22")).toHaveLength(1);
  expect((await fetchDiary("A", "2026-01-22"))[0]).toMatchObject({ meal: "dinner", name: "Ovo E2E" });
  expect(await fetchDiary("A", toDateKey(new Date()))).toHaveLength(0);
});

test("when Open Food Facts is down: clear message, saved foods stay, and 'Try again' recovers", async ({ page }) => {
  await seedSavedFood("A", { name: "Arroz guardado E2E", calories_100g: 120, protein_100g: 2.5, carbs_100g: 26, fat_100g: 0.3 });
  let down = true;
  await page.route("**/api/food-search**", (route) =>
    down ? route.fulfill({ status: 503, json: { error: "off_unavailable" } }) : route.fulfill({ json: { results: [ARROZ] } }),
  );
  await login(page, "A");
  await openLog(page);

  await searchBox(page).fill("arroz");
  await expect(page.getByRole("button", { name: "Choose Arroz guardado E2E" })).toBeVisible(); // the saved foods are there anyway
  await offTab(page).click();
  const problem = page.getByRole("alert").filter({ hasText: "Open Food Facts not responding" }); // Next.js adds its own empty alert
  await expect(problem).toBeVisible();
  await expect(page.getByText("No connection")).toHaveCount(0);

  down = false;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("button", { name: "Choose Arroz Teste E2E" })).toBeVisible();
  await expect(problem).toHaveCount(0);
});

/** A page of 20 results out of 25 pages, whatever is searched. */
async function manyResults(page: Page) {
  const results = Array.from({ length: 20 }, (_, i) => ({ ...ARROZ, id: `56000000000${i}`, off_code: `56000000000${i}`, name: `Arroz Teste ${i + 1}` }));
  await page.route("**/api/food-search**", (route) => route.fulfill({ json: { results, page: 1, pageCount: 25, total: 500, totalExact: false } }));
}

async function expectPagesInView(page: Page, scope: ReturnType<Page["getByRole"]> | Page) {
  const pages = scope.getByRole("navigation", { name: "Result pages" });
  await expect(pages).toBeVisible();
  const box = (await pages.boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height);
}

async function openManual(page: Page) {
  await login(page, "A");
  await openLog(page, DAY, "dinner");
  await page.getByRole("button", { name: "Add manually" }).click();
  await expect(page.getByRole("dialog", { name: "Add manually" })).toBeVisible();
}

test("Add manually as a food: grams, saved to my foods, logged as a food", async ({ page }) => {
  await openManual(page);
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("radio", { name: "Food" })).toBeChecked();
  await dialog.getByLabel("Name").fill("Bolacha E2E");
  await dialog.getByLabel("Amount (g)").fill("50");
  await dialog.getByLabel("Calories (kcal)").fill("200");
  await dialog.getByRole("button", { name: "Add to diary" }).click();
  await expect(page.getByText(/Bolacha E2E added to/)).toBeVisible();
  const [entry] = await fetchDiary("A", DAY);
  expect(entry).toMatchObject({ kind: "food", name: "Bolacha E2E", meal: "dinner", quantity_g: 50, calories: 200 });
  expect(entry!.saved_food_id).not.toBeNull();
  expect(await fetchSavedFoods("A")).toHaveLength(1);
});

test("Add manually as a meal: one portion, saved to my meals and linked", async ({ page }) => {
  await openManual(page);
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill("Sopa E2E");
  await dialog.getByLabel("Calories (kcal)").fill("180");
  await dialog.getByRole("radio", { name: "Meal" }).click();
  await expect(dialog.getByLabel("Name")).toHaveValue("Sopa E2E"); // what was typed stays
  await expect(dialog.getByLabel("Calories (kcal)")).toHaveValue("180");
  await expect(dialog.getByLabel("Amount (g)")).toHaveCount(0); // a meal has no grams
  await dialog.getByLabel("Protein (g)").fill("6");
  await expect(dialog.getByRole("button", { name: "Save to favorites" })).toHaveAttribute("aria-pressed", "true"); // on by default here
  await dialog.getByRole("button", { name: "Add to diary" }).click();
  await expect(page.getByText(/Sopa E2E added to/)).toBeVisible();

  const meals = await fetchSavedMeals("A");
  expect(meals).toHaveLength(1);
  const [entry] = await fetchDiary("A", DAY);
  expect(entry).toMatchObject({ kind: "meal", name: "Sopa E2E", meal: "dinner", calories: 180, protein_g: 6, doses: 1, saved_meal_id: meals[0]!.id });
  expect(entry!.items).toHaveLength(1);
  expect(await fetchSavedFoods("A")).toHaveLength(0);
});

test("Add manually as a meal without saving it: logged only, nothing in my meals", async ({ page }) => {
  await openManual(page);
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("radio", { name: "Meal" }).click();
  await dialog.getByLabel("Name").fill("Prato E2E");
  await dialog.getByLabel("Calories (kcal)").fill("650");
  await dialog.getByRole("button", { name: "Save to favorites" }).click();
  await dialog.getByRole("button", { name: "Add to diary" }).click();
  await expect(page.getByText(/Prato E2E added to/)).toBeVisible();
  const [entry] = await fetchDiary("A", DAY);
  expect(entry).toMatchObject({ kind: "meal", name: "Prato E2E", calories: 650, saved_meal_id: null });
  expect(await fetchSavedMeals("A")).toHaveLength(0);
});

test("Add manually as a meal: a saved name is refused inline and nothing is added", async ({ page }) => {
  await seedSavedMeal("A", { name: "Sopa E2E", items: [{ name: "Sopa E2E", quantity_g: null, calories: 100, protein_g: 1, carbs_g: 10, fat_g: 1 }], total_calories: 100, total_protein: 1, total_carbs: 10, total_fat: 1 });
  await openManual(page);
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("radio", { name: "Meal" }).click();
  await dialog.getByLabel("Name").fill("Sopa E2E");
  await dialog.getByLabel("Calories (kcal)").fill("180");
  await dialog.getByRole("button", { name: "Add to diary" }).click();
  await expect(dialog.getByRole("alert").filter({ hasText: "Meal name already saved" })).toBeVisible();
  expect(await fetchDiary("A", DAY)).toHaveLength(0);
  await dialog.getByRole("button", { name: "Save to favorites" }).click(); // it can still be only logged
  await dialog.getByRole("button", { name: "Add to diary" }).click();
  await expect(page.getByText(/Sopa E2E added to/)).toBeVisible();
  expect(await fetchDiary("A", DAY)).toHaveLength(1);
});

test("in the new meal dialog the page numbers are in view under the results", async ({ page }) => {
  await manyResults(page);
  await login(page, "A");
  await openLog(page);
  await page.getByRole("button", { name: "New meal" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("searchbox", { name: "Search food" }).fill("arroz");
  await dialog.getByRole("button", { name: /^Open Food Facts · / }).click();
  await expect(dialog.getByRole("button", { name: "Choose Arroz Teste 1", exact: true })).toBeVisible();
  await expectPagesInView(page, dialog);
});

test("on a short screen the page numbers stay above the tab bar without scrolling the page", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 640 });
  await manyResults(page);
  await login(page, "A");
  await openLog(page);
  await searchBox(page).fill("arroz");
  await offTab(page).click();
  await expect(page.getByRole("button", { name: "Choose Arroz Teste 1", exact: true })).toBeVisible();
  const pages = await page.getByRole("navigation", { name: "Result pages" }).boundingBox();
  const tabBar = await page.getByRole("navigation", { name: "Main navigation" }).boundingBox();
  expect(pages!.y + pages!.height).toBeLessThanOrEqual(tabBar!.y + 1);
  expect(pages!.y).toBeGreaterThan(0);
});

test("when Open Food Facts reports too many requests it says to wait", async ({ page }) => {
  await page.route("**/api/food-search**", (route) => route.fulfill({ status: 503, json: { error: "off_unavailable", reason: "rate_limited" } }));
  await login(page, "A");
  await openLog(page);
  await searchBox(page).fill("arroz");
  await offTab(page).click();
  await expect(page.getByRole("alert").filter({ hasText: "Too many searches. Wait a bit" })).toBeVisible();
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
  await seedSavedMeal("A", { name: "Lunch E2E", items, total_calories: 411, total_protein: 49.9, total_carbs: 35.3, total_fat: 5.8 });
  await login(page, "A");
  await openLog(page, DAY, "dinner");

  await page.getByRole("button", { name: "Choose Lunch E2E" }).click();
  await page.getByRole("button", { name: "Use 2 portions" }).click();
  await expect(page.getByRole("status", { name: "Portions" })).toHaveText("2 portions");
  await page.getByRole("button", { name: "Add to diary" }).click();
  await expect(page.getByText(/Lunch E2E added to dinner/)).toBeVisible();

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
    await page.getByRole("button", { name: "Edit saved Pão E2E" }).click();
    await page.getByLabel("Calories").fill(calories);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Used in 2 entries")).toBeVisible();
    await page.getByRole("button", { name: choice }).click();
    await expect(page.getByText(done)).toBeVisible(); // the DB confirmed the edit and the re-apply
  };

  await edit("300", /From today/, "Saved, 1 entry updated");
  expect((await fetchDiary("A", today))[0]).toMatchObject({ calories: 150 });
  expect((await fetchDiary("A", yesterday))[0]).toMatchObject({ calories: 125 });

  await edit("200", /All history/, "Saved, 2 entries updated");
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

  await page.getByRole("button", { name: "Edit saved Papas E2E" }).click();
  await page.getByLabel("Amount of Aveia (g)").fill("60"); // rescaled from the saved item
  await page.getByRole("button", { name: "Save" }).click();
  await page.getByRole("button", { name: /All history/ }).click();
  await expect(page.getByText("Saved, 2 entries updated")).toBeVisible();

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
  name: "Chicken and rice",
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
  await page.getByRole("button", { name: "With AI" }).click();
  await page.getByLabel("What did you eat?").fill("frango com arroz");
  await page.getByRole("button", { name: "Analisar" }).click();
  await expect(page.getByRole("heading", { name: "Chicken and rice" })).toBeVisible();
}

test("AI from a photo → one meal → star and Add to diary with 2 portions", async ({ page }) => {
  const sent = await mockAi(page);
  await login(page, "A");
  await openLog(page);

  await page.getByRole("button", { name: "With AI" }).click();
  const png = await page.screenshot({ clip: { x: 0, y: 0, width: 40, height: 30 } }); // a real image to decode
  await page.locator('input[type="file"]:not([capture])').setInputFiles({ name: "prato.png", mimeType: "image/png", buffer: png });
  await expect(page.getByRole("img", { name: "Selected photo" })).toBeVisible();
  await page.getByRole("button", { name: "Analisar" }).click();
  await expect(page.getByRole("heading", { name: "Chicken and rice" })).toBeVisible();
  expect(sent.body).toMatchObject({ type: "image", mimeType: "image/jpeg" });
  await expect(page.getByTestId("nutrient-summary")).toContainText("443"); // 1 portion

  await page.getByRole("button", { name: "Use 2 portions" }).click();
  await page.getByRole("button", { name: "Save to favorites" }).click();
  await page.getByRole("button", { name: "Add to diary" }).click();
  await expect(page.getByText("Chicken and rice added to lunch")).toBeVisible();

  const [meal] = await fetchSavedMeals("A");
  expect(meal).toMatchObject({ name: "Chicken and rice", total_calories: 443, items: AI_MEAL.items });
  const [row] = await fetchDiary("A", DAY);
  expect(row).toMatchObject({ kind: "meal", saved_meal_id: meal!.id, doses: 2, calories: 886, protein_g: 101.2 });
});

test("AI 'Edit' corrects the values, then the star keeps the meal and Add logs it", async ({ page }) => {
  await mockAi(page);
  await login(page, "A");
  await openLog(page);
  await analyzeText(page);

  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Meal name").fill("Frango com muito arroz");
  await page.getByLabel("Amount of Arroz (g)").fill("300"); // rescaled from the AI values
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("heading", { name: "Frango com muito arroz" })).toBeVisible();
  await expect(page.getByTestId("nutrient-summary")).toContainText("638");

  await page.getByRole("button", { name: "Save to favorites" }).click();
  await page.getByRole("button", { name: "Add to diary" }).click();
  await expect(page.getByText("Frango com muito arroz added to lunch")).toBeVisible();
  const [meal] = await fetchSavedMeals("A");
  expect(meal).toMatchObject({ name: "Frango com muito arroz", total_calories: 638 });
  const [row] = await fetchDiary("A", DAY);
  expect(row).toMatchObject({ kind: "meal", saved_meal_id: meal!.id, calories: 638 });
});

test("AI meal without the star logs an unlinked meal; with a saved name the star explains it inline", async ({ page }) => {
  await seedSavedMeal("A", { name: "Chicken and rice", items: AI_MEAL.items, total_calories: 443, total_protein: 50.6, total_carbs: 42.3, total_fat: 5.9 });
  await mockAi(page);
  await login(page, "A");
  await openLog(page);
  await analyzeText(page);

  await page.getByRole("button", { name: "Save to favorites" }).click();
  await page.getByRole("button", { name: "Add to diary" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Meal name already saved" })).toBeVisible();
  expect(await fetchSavedMeals("A")).toHaveLength(1);
  expect(await fetchDiary("A", DAY)).toHaveLength(0); // nothing was added either

  await page.getByRole("button", { name: "Save to favorites" }).click(); // star off: only logged
  await page.getByRole("button", { name: "Add to diary" }).click();
  await expect(page.getByText("Chicken and rice added to lunch")).toBeVisible();
  const [row] = await fetchDiary("A", DAY);
  expect(row).toMatchObject({ kind: "meal", saved_meal_id: null, doses: 1, calories: 443 });
});

test("one search covers saved foods and saved meals; a meal opens the portions sheet", async ({ page }) => {
  const seen = await mockOff(page);
  const items = [{ name: "Sopa", quantity_g: null, calories: 100, protein_g: 5, carbs_g: 10, fat_g: 2 }];
  await seedSavedMeal("A", { name: "Sopa de legumes", items, total_calories: 100, total_protein: 5, total_carbs: 10, total_fat: 2 });
  await seedSavedMeal("A", { name: "Bifana", items, total_calories: 450, total_protein: 25, total_carbs: 40, total_fat: 20 });
  await seedSavedFood("A", { name: "Sopa instantânea E2E", calories_100g: 40, protein_100g: 1, carbs_100g: 6, fat_100g: 1 });
  await login(page, "A");
  await openLog(page);

  // no Alimentos | Refeições switch any more; the barcode and the AI are still there
  await expect(page.getByRole("group", { name: "Saved type" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Barcode" })).toBeVisible();
  await expect(page.getByRole("button", { name: "With AI" })).toBeVisible();
  await expect(page.getByRole("button", { name: "New meal" })).toBeVisible();

  await searchBox(page).fill("sopa");
  await expect(savedTab(page)).toHaveText("Saved · 2");
  const results = page.getByRole("region", { name: "Search results" });
  await expect(results.getByRole("button", { name: "Choose Sopa de legumes" })).toBeVisible();
  await expect(results.getByRole("button", { name: "Choose Sopa instantânea E2E" })).toBeVisible();
  await expect(results.getByText("Meal", { exact: true })).toHaveCount(1); // only the meal is tagged
  await expect(results.getByRole("button", { name: "Choose Bifana" })).toHaveCount(0);
  expect(seen.queries).toContain("sopa"); // Open Food Facts is searched too

  await results.getByRole("button", { name: "Choose Sopa de legumes" }).click();
  await expect(page.getByRole("heading", { name: "Sopa de legumes" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Use 2 portions" })).toBeVisible();
});

test("before searching, the saved foods and meals are listed together, most used first", async ({ page }) => {
  const items = [{ name: "Sopa", quantity_g: null, calories: 100, protein_g: 5, carbs_g: 10, fat_g: 2 }];
  await seedSavedFood("A", { name: "Aveia E2E", calories_100g: 380, protein_100g: 13, carbs_100g: 60, fat_100g: 7, times_used: 1 });
  await seedSavedMeal("A", { name: "Bifana", items, total_calories: 450, total_protein: 25, total_carbs: 40, total_fat: 20, times_used: 5 });
  await login(page, "A");
  await openLog(page);

  const rows = page.getByTestId("saved-all").getByRole("listitem");
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText("Bifana");
  await expect(rows.first()).toContainText("Meal");
  await expect(rows.nth(1)).toContainText("Aveia E2E");
});

test("'Add meal' on the day screen opens Registar on snacks and on that day", async ({ page }) => {
  await seedSavedFood("A", { name: "Ovo E2E", calories_100g: 155, protein_100g: 13, carbs_100g: 1.1, fat_100g: 11 });
  await login(page, "A");
  await page.goto(`/?d=${DAY}`);
  await page.getByRole("link", { name: "Add meal" }).click();
  await expect(page).toHaveURL(new RegExp(`/add\\?meal=snacks&d=${DAY}`));
  await expect(page.getByTestId("log-day")).toContainText("20");
  await page.getByRole("button", { name: "Choose Ovo E2E" }).click();
  await expect(mealButton(page, "Snacks")).toHaveAttribute("aria-pressed", "true");
});

test("the + of a meal on the day screen keeps its meal", async ({ page }) => {
  await login(page, "A");
  await page.goto(`/?d=${DAY}`);
  await page.getByRole("link", { name: "Add to Dinner" }).click();
  await expect(page).toHaveURL(new RegExp(`/add\\?meal=dinner&d=${DAY}`));
});

test("long lists of saved items open on the five most used and scroll inside themselves", async ({ page }) => {
  for (let i = 1; i <= 14; i++) {
    await seedSavedFood("A", { name: `Alimento ${String(i).padStart(2, "0")}`, calories_100g: 100 + i, protein_100g: 1, carbs_100g: 1, fat_100g: 1 });
  }
  await login(page, "A");
  await openLog(page);

  // the screen opens on the five most used; the rest comes with "Show all"
  await expect(page.getByRole("heading", { name: "Most used" })).toBeVisible();
  await expect(page.getByTestId("saved-all").getByRole("listitem")).toHaveCount(5);
  await expect(page.getByRole("button", { name: "Show less" })).toHaveCount(0); // nothing to close yet
  await page.getByRole("button", { name: "Show all · 14" }).click();
  await expect(page.getByTestId("saved-all").getByRole("listitem")).toHaveCount(14);
  await expect(page.getByRole("button", { name: "Show all · 14" })).toHaveCount(0); // all of them are shown
  await page.getByRole("button", { name: "Show less" }).click(); // back to the five most used
  await expect(page.getByTestId("saved-all").getByRole("listitem")).toHaveCount(5);
  await page.getByRole("button", { name: "Show all · 14" }).click();
  await expect(page.getByTestId("saved-all").getByRole("listitem")).toHaveCount(14);
  const list = page.getByRole("region", { name: "Saved list" });
  await expect(list).toBeVisible();
  expect(await list.evaluate((el) => el.scrollHeight > el.clientHeight && getComputedStyle(el).overflowY === "auto")).toBe(true);
});

test("portions change 0.1 at a time, without floating point noise, and have shortcuts", async ({ page }) => {
  await seedSavedMeal("A", { name: "Sopa E2E", items: [{ name: "Sopa", quantity_g: null, calories: 100, protein_g: 5, carbs_g: 10, fat_g: 2 }], total_calories: 100, total_protein: 5, total_carbs: 10, total_fat: 2 });
  await login(page, "A");
  await openLog(page);

  await page.getByRole("button", { name: "Choose Sopa E2E" }).click();
  const portions = page.getByLabel("Portions", { exact: true });
  await expect(portions).toHaveText("1 portion");
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "More portions" }).click();
  await expect(portions).toHaveText("1.3 portions");
  await expect(page.getByTestId("nutrient-summary")).toContainText("130");
  for (let i = 0; i < 5; i++) await page.getByRole("button", { name: "Fewer portions" }).click();
  await expect(portions).toHaveText("0.8 portions");
  await page.getByRole("button", { name: "Use 0.5 portions" }).click();
  await expect(portions).toHaveText("0.5 portions");
  await page.getByRole("button", { name: "Add to diary" }).click();
  await expect(page.getByText("Sopa E2E added to lunch")).toBeVisible();
  expect((await fetchDiary("A", DAY))[0]).toMatchObject({ doses: 0.5, calories: 50 });
});

test("new meal by values per portion: 1.5 portions, shown without grams on Today", async ({ page }) => {
  await login(page, "A");
  await openLog(page, DAY, "dinner");

  await page.getByRole("button", { name: "New meal" }).click();
  await page.getByRole("button", { name: "Per portion" }).click();
  await page.getByLabel("Meal name").fill("Bifana");
  await page.getByLabel("Calories (kcal)").fill("450");
  await page.getByLabel("Protein (g)").fill("25");
  await page.getByRole("button", { name: "Use 1.5 portions" }).click();
  await page.getByRole("button", { name: "Add to diary" }).click(); // the star starts on in New meal
  await expect(page.getByText("Bifana added to dinner")).toBeVisible();

  const [meal] = await fetchSavedMeals("A");
  expect(meal!.items).toEqual([{ name: "Bifana", quantity_g: null, calories: 450, protein_g: 25, carbs_g: 0, fat_g: 0 }]);
  expect((await fetchDiary("A", DAY))[0]).toMatchObject({ calories: 675, protein_g: 37.5, doses: 1.5 });

  await page.goto(`/?d=${DAY}`);
  const row = page.getByTestId("meal-dinner");
  await expect(row).toContainText("1.5 portions");
  await expect(row).toContainText("675 kcal");
  await row.getByRole("button", { name: /Bifana, 1 itens/ }).click();
  await expect(row.getByText(/ g$/)).toHaveCount(0);
});

test("new meal: a food from the Open Food Facts search asks its quantity", async ({ page }) => {
  await mockOff(page);
  await login(page, "A");
  await openLog(page);

  await page.getByRole("button", { name: "New meal" }).click();
  await page.getByRole("dialog").getByRole("searchbox", { name: "Search food" }).fill("arroz teste e2e");
  await offTab(page).click();
  await page.getByRole("button", { name: "Choose Arroz Teste E2E" }).click();
  await typeGrams(page, "200");
  await page.getByRole("button", { name: "Add to meal" }).click();
  await expect(page.getByLabel("Amount of Arroz Teste E2E (g)")).toHaveValue("200");
  await page.getByLabel("Meal name").fill("Arroz simples");
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

  await page.getByRole("button", { name: "With AI" }).click();
  await page.getByLabel("What did you eat?").fill("150 g de peito de frango grelhado");
  await page.getByRole("button", { name: "Analisar" }).click();

  await expect(page.getByRole("heading", { name: "Peito de frango grelhado" })).toBeVisible();
  await expect(page.getByTestId("nutrient-summary")).toContainText("248"); // the 150 g estimate
  await expect(page.getByRole("button", { name: "Save meal" })).toHaveCount(0);
  await page.getByRole("button", { name: "Save to favorites" }).click();
  await page.getByRole("button", { name: "Add to diary" }).click();
  await expect(page.getByText(/Peito de frango grelhado added to/)).toBeVisible();

  const [food] = await fetchSavedFoods("A");
  expect(food).toMatchObject({ name: "Peito de frango grelhado", calories_100g: 165, protein_100g: 31, fat_100g: 3.6 });
  expect(await fetchSavedMeals("A")).toHaveLength(0);
  expect((await fetchDiary("A", DAY))[0]).toMatchObject({ kind: "food", quantity_g: 150, calories: 248, saved_food_id: food!.id });
});

test("new meal: the AI result joins the meal and names it", async ({ page }) => {
  await mockAi(page);
  await login(page, "A");
  await openLog(page);

  await page.getByRole("button", { name: "New meal" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "With AI" }).click();
  await page.getByLabel("What did you eat?").fill("frango com arroz");
  await page.getByRole("button", { name: "Analisar" }).click();
  await expect(page.getByText("Meal · 2 foods")).toBeVisible();
  await page.getByRole("button", { name: "Edit amounts" }).click();
  await page.getByLabel("Amount of Arroz (g)").fill("100");
  await page.getByRole("button", { name: "Done" }).click();
  await page.getByRole("button", { name: "Use whole meal" }).click();

  await expect(page.getByLabel("Meal name")).toHaveValue("Chicken and rice");
  await expect(page.getByLabel("Amount of Frango grelhado (g)")).toHaveValue("150");
  await expect(page.getByLabel("Amount of Arroz (g)")).toHaveValue("100");
  await expect(page.getByTestId("nutrient-summary")).toContainText("378"); // 248 + 130
});

test("new meal: tick several saved foods in one list (with a filter) and join them all at once", async ({ page }) => {
  const names = ["Aveia", "Leite", "Banana", "Ovo", "Arroz", "Frango", "Maçã"];
  for (const [i, name] of names.entries()) await seedSavedFood("A", { name: `${name} E2E`, calories_100g: 100 + i * 10, protein_100g: 2, carbs_100g: 10, fat_100g: 1 });
  await login(page, "A");
  await openLog(page);

  await page.getByRole("button", { name: "New meal" }).click();
  await page.getByLabel("Meal name").fill("Breakfast E2E");
  await page.getByRole("button", { name: /^Pick from my foods/ }).click();

  await expect(page.getByRole("checkbox")).toHaveCount(7);
  await page.getByRole("checkbox", { name: "Aveia E2E" }).click();
  await page.getByRole("searchbox", { name: "Filter foods" }).fill("banana");
  await expect(page.getByRole("checkbox")).toHaveCount(1);
  await page.getByRole("checkbox", { name: "Banana E2E" }).click();
  await page.getByRole("searchbox", { name: "Filter foods" }).fill("");
  await expect(page.getByRole("checkbox", { name: "Aveia E2E" })).toBeChecked(); // ticks survive the filter
  await page.getByRole("button", { name: "Add 2 foods" }).click();

  await expect(page.getByLabel("Amount of Aveia E2E (g)")).toHaveValue("100");
  await expect(page.getByLabel("Amount of Banana E2E (g)")).toHaveValue("100");
  await expect(page.getByTestId("nutrient-summary")).toContainText("220"); // 100 + 120
  await page.getByRole("button", { name: "Add to diary" }).click(); // the star starts on in New meal: saved and logged
  await expect(page.getByText(/Breakfast E2E added to/)).toBeVisible();
  const [meal] = await fetchSavedMeals("A");
  expect(meal).toMatchObject({ name: "Breakfast E2E", total_calories: 220 });
  expect((meal!.items as { name: string }[]).map((i) => i.name)).toEqual(["Aveia E2E", "Banana E2E"]);
});

test("new meal: the list of saved foods always has the filter, even with few foods", async ({ page }) => {
  await seedSavedFood("A", { name: "Aveia E2E", calories_100g: 380, protein_100g: 13, carbs_100g: 60, fat_100g: 7 });
  await seedSavedFood("A", { name: "Leite E2E", calories_100g: 46, protein_100g: 3, carbs_100g: 5, fat_100g: 2 });
  await login(page, "A");
  await openLog(page);

  await page.getByRole("button", { name: "New meal" }).click();
  await page.getByRole("button", { name: /^Pick from my foods/ }).click();
  await page.getByRole("searchbox", { name: "Filter foods" }).fill("lei");
  await expect(page.getByRole("checkbox")).toHaveCount(1);
  await expect(page.getByRole("checkbox", { name: "Leite E2E" })).toBeVisible();
  await page.getByRole("searchbox", { name: "Filter foods" }).fill("zzz");
  await expect(page.getByText("No matches")).toBeVisible();
});

test("new meal: every food can be removed, and the warning says exactly what is missing", async ({ page }) => {
  await seedSavedFood("A", { name: "Aveia E2E", calories_100g: 380, protein_100g: 13, carbs_100g: 60, fat_100g: 7 });
  await seedSavedFood("A", { name: "Leite E2E", calories_100g: 46, protein_100g: 3, carbs_100g: 5, fat_100g: 2 });
  await login(page, "A");
  await openLog(page);

  await page.getByRole("button", { name: "New meal" }).click();
  const warning = page.getByRole("status").filter({ hasText: "Missing" });
  await expect(warning).toHaveText("Missing: name, a food");

  await page.getByRole("button", { name: /^Pick from my foods/ }).click();
  await page.getByRole("checkbox", { name: "Aveia E2E" }).click();
  await page.getByRole("checkbox", { name: "Leite E2E" }).click();
  await page.getByRole("button", { name: "Add 2 foods" }).click();
  await expect(warning).toHaveText("Missing: name");

  await page.getByRole("button", { name: "Remove Aveia E2E" }).click();
  await page.getByRole("button", { name: "Remove Leite E2E" }).click(); // the last one too
  await expect(page.getByTestId("items-editor")).toHaveCount(0);
  await page.getByLabel("Meal name").fill("Vazia");
  await expect(warning).toHaveText("Missing: a food");

  await page.getByRole("button", { name: /^Pick from my foods/ }).click();
  await page.getByRole("checkbox", { name: "Leite E2E" }).click();
  await page.getByRole("button", { name: "Add 1 food" }).click();
  await expect(warning).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add to diary" })).toBeVisible();

  await page.getByLabel("Amount of Leite E2E (g)").fill("0");
  await expect(page.getByRole("status").filter({ hasText: "Needs a name and an amount" })).toBeVisible();
});

test("new meal by values per portion: the warning asks for the calories", async ({ page }) => {
  await login(page, "A");
  await openLog(page);
  await page.getByRole("button", { name: "New meal" }).click();
  await page.getByRole("button", { name: "Per portion" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Missing" })).toHaveText("Missing: name, calories");
  await page.getByLabel("Meal name").fill("Bifana");
  await expect(page.getByRole("status").filter({ hasText: "Missing" })).toHaveText("Missing: calories");
});

test("other forms explain what is missing: short search, empty AI, no day, no selection", async ({ page }) => {
  await seedSavedFood("A", { name: "Aveia E2E", calories_100g: 380, protein_100g: 13, carbs_100g: 60, fat_100g: 7 });
  await mockOff(page);
  await login(page, "A");
  await openLog(page);

  // a search with one letter
  await searchBox(page).fill("a");
  await expect(page.getByRole("status").filter({ hasText: "Min 2 letters" })).toBeVisible();
  await searchBox(page).fill("");
  await expect(page.getByRole("status").filter({ hasText: "Min 2 letters" })).toHaveCount(0);

  // the AI with nothing to analyse
  await page.getByRole("button", { name: "With AI" }).click();
  await expect(page.getByRole("button", { name: "Analisar" })).toBeDisabled();
  await expect(page.getByRole("status").filter({ hasText: "Add text or a photo" })).toBeVisible();
  await page.keyboard.press("Escape");

  // the day of an entry cleared
  await page.getByRole("button", { name: "Choose Aveia E2E" }).click();
  await page.getByLabel("Date", { exact: true }).fill("");
  await expect(page.getByRole("status").filter({ hasText: "Pick a date" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add to diary" })).toBeDisabled();
  await page.keyboard.press("Escape");

  // new meal: the list of saved foods with nothing ticked
  await page.getByRole("button", { name: "New meal" }).click();
  await page.getByRole("button", { name: /^Pick from my foods/ }).click();
  await expect(page.getByRole("status").filter({ hasText: "Pick at least one food" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add to meal" })).toBeDisabled();
});

test("AI 'Edit': says why 'Done' is not available", async ({ page }) => {
  await mockAi(page);
  await login(page, "A");
  await openLog(page);
  await analyzeText(page);
  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Meal name").fill("");
  await expect(page.getByRole("status").filter({ hasText: "Meal name required" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Done" })).toBeDisabled();
  await page.getByLabel("Meal name").fill("Frango");
  await page.getByLabel("Amount of Arroz (g)").fill("0");
  await expect(page.getByRole("status").filter({ hasText: "Needs a name and an amount" })).toBeVisible();
});

test("new meal by joining saved foods: totals are the sum of the foods", async ({ page }) => {
  await seedSavedFood("A", { name: "Aveia E2E", calories_100g: 380, protein_100g: 13.2, carbs_100g: 60, fat_100g: 7 });
  await seedSavedFood("A", { name: "Leite E2E", calories_100g: 46, protein_100g: 3.3, carbs_100g: 4.8, fat_100g: 1.6 });
  await login(page, "A");
  await openLog(page, DAY, "breakfast");

  await page.getByRole("button", { name: "New meal" }).click();
  await page.getByLabel("Meal name").fill("Papas E2E");
  await page.getByRole("dialog").getByRole("searchbox", { name: "Search food" }).fill("aveia");
  await page.getByRole("button", { name: "Choose Aveia E2E" }).click();
  await page.getByRole("button", { name: "Add to meal" }).click();
  await page.getByLabel("Amount of Aveia E2E (g)").fill("60");
  await page.getByRole("dialog").getByRole("searchbox", { name: "Search food" }).fill("leite");
  await page.getByRole("button", { name: "Choose Leite E2E" }).click();
  await page.getByRole("button", { name: "Add to meal" }).click();
  await page.getByLabel("Amount of Leite E2E (g)").fill("250");
  await expect(page.getByTestId("nutrient-summary")).toContainText("343"); // 228 + 115
  await page.getByRole("button", { name: "Add to diary" }).click(); // the star starts on in New meal: saved and logged
  await expect(page.getByText(/Papas E2E added to/)).toBeVisible();

  const [meal] = await fetchSavedMeals("A");
  expect(meal).toMatchObject({ name: "Papas E2E", total_calories: 343, total_protein: 16.2 });
  expect(meal!.items).toEqual([
    { name: "Aveia E2E", quantity_g: 60, calories: 228, protein_g: 7.9, carbs_g: 36, fat_g: 4.2 },
    { name: "Leite E2E", quantity_g: 250, calories: 115, protein_g: 8.3, carbs_g: 12, fat_g: 4 },
  ]);
});

test("a failed insert shows 'No connection' and nothing is saved", async ({ page }) => {
  await seedSavedFood("A", { name: "Ovo E2E", calories_100g: 155, protein_100g: 13, carbs_100g: 1.1, fat_100g: 11 });
  await login(page, "A");
  await openLog(page);
  await page.route("**/rest/v1/diary_entries**", (route) => (route.request().method() === "POST" ? route.abort("internetdisconnected") : route.continue()));

  await page.getByRole("button", { name: "Choose Ovo E2E" }).click();
  await page.getByRole("button", { name: "Add to diary" }).click();
  await expect(page.getByText(/No connection/)).toBeVisible();
  await expect(page.getByText("Ovo E2E added to lunch")).toHaveCount(0);
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
  await expect(page.getByText("Nothing saved yet")).toBeVisible();
  await page.getByRole("searchbox", { name: "Search food" }).fill("privado e2e");
  await expect(page.getByRole("button", { name: "Choose Privado E2E" })).toHaveCount(0);
});
