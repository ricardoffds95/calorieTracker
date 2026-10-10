import { expect, test, type Page } from "@playwright/test";
import { toDateKey } from "../lib/dates";
import { clearCache, login, logout, openProfile } from "./helpers";
import { DAY_DATA, DAY_EMPTY, DAY_OVER, clearDiary, dataDayRows, fetchDiary, overGoalRows, seedDiary } from "./seed";

const remaining = (page: Page) => page.getByTestId("remaining-amount");
const label = (page: Page) => page.getByTestId("remaining-label");
const mealKcal = (page: Page, meal: string) => page.getByTestId(`meal-${meal}-kcal`);
const dialog = (page: Page) => page.getByRole("dialog");
const failWrites = (page: Page) =>
  page.route("**/rest/v1/diary_entries*", (route) => (route.request().method() === "GET" ? route.continue() : route.abort()));

async function openDay(page: Page, date: string) {
  await page.goto(`/?d=${date}`);
  await expect(page.getByTestId("day-label")).toBeVisible();
}

// Each call to Supabase from Node can cost seconds on slow networks, so keep these few and parallel.
const clearAll = () => Promise.all([clearDiary("A"), clearDiary("B")]);
test.beforeEach(clearAll);
test.afterAll(clearAll);

test("a day with entries shows exact totals, macros and meals", async ({ page }) => {
  await seedDiary("A", dataDayRows());
  await login(page, "A");
  await openDay(page, DAY_DATA);

  await expect(remaining(page)).toHaveText("1081");
  await expect(label(page)).toHaveText("kcal restantes");
  await expect(page.getByTestId("consumed-vs-goal")).toHaveText("919 / 2000 kcal");
  await expect(page.getByTestId("macro-protein")).toContainText("66.2");
  await expect(page.getByTestId("macro-protein")).toContainText("/ 150 g");
  await expect(page.getByTestId("macro-carbs")).toContainText("125");
  await expect(page.getByTestId("macro-fat")).toContainText("13.4");
  await expect(page.getByTestId("macro-fat")).toContainText("/ 67 g");

  await expect(mealKcal(page, "breakfast")).toHaveText("331 kcal");
  await expect(mealKcal(page, "lunch")).toHaveText("508 kcal");
  await expect(mealKcal(page, "dinner")).toHaveText("—");
  await expect(mealKcal(page, "snacks")).toHaveText("80 kcal");
  await expect(page.getByText("Aveia")).toBeVisible();
  await expect(page.getByText("Iogurte")).toBeVisible();

  // composed meals expand to show their items
  await expect(page.getByText(/^Arroz/)).toHaveCount(0);
  await page.getByRole("button", { name: "Frango com arroz, 2 itens" }).click();
  await expect(page.getByText(/^Arroz · 200 g/)).toBeVisible();
  await expect(page.getByText(/^Frango · 150 g/)).toBeVisible();
});

test("an empty day shows the full goal and links to Registar", async ({ page }) => {
  await login(page, "A");
  await openDay(page, DAY_EMPTY);
  await expect(remaining(page)).toHaveText("2000");
  await expect(page.getByText("Ainda sem registos neste dia.")).toBeVisible();
  const add = page.getByRole("link", { name: "Adicionar a Almoço" });
  await expect(add).toHaveAttribute("href", `/registar?meal=lunch&d=${DAY_EMPTY}`);
  await add.click();
  await expect(page).toHaveURL(new RegExp(`/registar\\?meal=lunch&d=${DAY_EMPTY}`));
});

test("above the goal it shows how much was exceeded", async ({ page }) => {
  await seedDiary("A", overGoalRows());
  await login(page, "A");
  await openDay(page, DAY_OVER);
  await expect(remaining(page)).toHaveText("300");
  await expect(label(page)).toHaveText("kcal acima");
  const bar = page.getByRole("progressbar", { name: "Calorias do dia" });
  await expect(bar).toHaveAttribute("aria-valuenow", "100");
  await expect(bar).toHaveAttribute("data-over", "true");
  await expect(page.getByTestId("macro-protein").getByRole("progressbar")).toHaveAttribute("data-over", "false");
});

test("day navigation, today, and invalid dates", async ({ page }) => {
  await login(page, "A");
  await openDay(page, DAY_DATA);
  await expect(page.getByTestId("day-label")).toHaveText("qui, 15 jan");
  await page.getByRole("link", { name: "Dia seguinte" }).click();
  await expect(page).toHaveURL(new RegExp(`d=${DAY_EMPTY}`));
  await expect(page.getByTestId("day-label")).toHaveText("sex, 16 jan");
  await page.getByRole("link", { name: "Dia anterior" }).click();
  await page.getByRole("link", { name: "Dia anterior" }).click();
  await expect(page.getByTestId("day-label")).toHaveText("qua, 14 jan");

  await page.goto("/");
  await expect(page.getByTestId("day-label")).toHaveText(/^Hoje, /);
  await page.getByRole("link", { name: "Dia anterior" }).click();
  await expect(page.getByTestId("day-label")).toHaveText(/^Ontem, /);
  await page.getByRole("link", { name: "Dia seguinte" }).click();
  await expect(page.getByTestId("day-label")).toHaveText(/^Hoje, /);
  await expect(page).not.toHaveURL(/d=/);

  await page.goto("/?d=2026-02-30");
  await expect(page.getByTestId("day-label")).toHaveText(/^Hoje, /);
  await page.goto("/?d=lixo");
  await expect(page.getByTestId("day-label")).toHaveText(/^Hoje, /);
});

test("today's entries appear under 'Hoje'", async ({ page }) => {
  // Seed before logging in: the cache is fresh for 30 s, so data added behind its back would not show yet.
  await seedDiary("A", dataDayRows(toDateKey(new Date()))); // the browser runs in the same time zone as this process
  await login(page, "A");
  await page.goto("/");
  await expect(page.getByTestId("day-label")).toHaveText(/^Hoje, /);
  await expect(remaining(page)).toHaveText("1081");
});

test("editing a food rescales values, persists in the DB and survives reload and an empty cache", async ({ page }) => {
  await seedDiary("A", dataDayRows());
  await login(page, "A");
  await openDay(page, DAY_DATA);

  await page.getByRole("button", { name: "Editar Aveia" }).click();
  await expect(dialog(page)).toBeVisible();
  await dialog(page).getByLabel("Quantidade (g)").fill("120");
  await expect(dialog(page).getByLabel("Calorias (kcal)")).toHaveValue("448");
  await expect(dialog(page).getByLabel("Proteína (g)")).toHaveValue("16");
  await expect(dialog(page).getByLabel("Hidratos (g)")).toHaveValue("70");
  await dialog(page).getByRole("button", { name: "Guardar" }).click();

  await expect(page.getByText("Entrada atualizada")).toBeVisible();
  await expect(remaining(page)).toHaveText("857"); // 2000 - (919 - 224 + 448)
  await expect(page.getByTestId("macro-protein")).toContainText("74.2");
  await expect(page.getByTestId("macro-carbs")).toContainText("160");
  await expect(page.getByTestId("macro-fat")).toContainText("17.4");
  await expect(mealKcal(page, "breakfast")).toHaveText("555 kcal");

  const rows = await fetchDiary("A", DAY_DATA);
  const aveia = rows.find((r) => r.name === "Aveia");
  expect(aveia).toMatchObject({ quantity_g: 120, calories: 448, protein_g: 16, carbs_g: 70, fat_g: 8 });

  await page.reload();
  await expect(remaining(page)).toHaveText("857");
  await clearCache(page);
  await page.reload();
  await expect(remaining(page)).toHaveText("857");
});

test("the edit form validates, accepts decimal commas and can be cancelled", async ({ page }) => {
  await seedDiary("A", dataDayRows());
  await login(page, "A");
  await openDay(page, DAY_DATA);

  await page.getByRole("button", { name: "Editar Iogurte" }).click();
  const save = dialog(page).getByRole("button", { name: "Guardar" });
  await dialog(page).getByLabel("Nome").fill("   ");
  await expect(save).toBeDisabled();
  await expect(dialog(page).getByText("Indica um nome.")).toBeVisible();
  await dialog(page).getByLabel("Nome").fill("Iogurte grego");
  await dialog(page).getByLabel("Calorias (kcal)").fill("-5");
  await expect(save).toBeDisabled();
  await dialog(page).getByLabel("Calorias (kcal)").fill("abc");
  await expect(save).toBeDisabled();
  await dialog(page).getByLabel("Quantidade (g)").fill("0");
  await expect(save).toBeDisabled();
  await dialog(page).getByLabel("Quantidade (g)").fill("125");
  await dialog(page).getByLabel("Calorias (kcal)").fill("80,6");
  await dialog(page).getByLabel("Proteína (g)").fill("5,25");
  await expect(save).toBeEnabled();
  await save.click();
  await expect(page.getByText("Iogurte grego")).toBeVisible();
  await expect(page.getByText("Entrada atualizada")).toBeVisible(); // the DB confirmed the write
  const row = (await fetchDiary("A", DAY_DATA)).find((r) => r.name === "Iogurte grego");
  expect(row).toMatchObject({ calories: 81, protein_g: 5.3 });

  // cancelling changes nothing
  await page.getByRole("button", { name: "Editar Banana" }).click();
  await dialog(page).getByLabel("Calorias (kcal)").fill("999");
  await dialog(page).getByRole("button", { name: "Cancelar" }).click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(mealKcal(page, "breakfast")).toHaveText("331 kcal");
});

test("deleting can be undone, and a kept delete persists", async ({ page }) => {
  await seedDiary("A", dataDayRows());
  const original = (await fetchDiary("A", DAY_DATA)).find((r) => r.name === "Banana")!;
  await login(page, "A");
  await openDay(page, DAY_DATA);

  await page.getByRole("button", { name: "Remover Banana" }).click();
  await expect(page.getByText("Banana")).toHaveCount(0);
  await expect(remaining(page)).toHaveText("1188");
  await page.getByRole("button", { name: "Anular" }).click();
  await expect(page.getByText("Banana")).toBeVisible();
  await expect(remaining(page)).toHaveText("1081");
  const restored = (await fetchDiary("A", DAY_DATA)).find((r) => r.name === "Banana");
  expect(restored).toMatchObject({ id: original.id, calories: 107, created_at: original.created_at });

  await page.getByRole("button", { name: "Remover Iogurte" }).click();
  await expect(remaining(page)).toHaveText("1161");
  await expect(page.getByText("Entrada removida")).toBeVisible(); // shown once the DB confirmed the delete
  await page.reload();
  await expect(page.getByText("Iogurte")).toHaveCount(0);
  await expect(remaining(page)).toHaveText("1161");
  expect((await fetchDiary("A", DAY_DATA)).some((r) => r.name === "Iogurte")).toBe(false);
});

test("removing an item recalculates the meal, and the last item cannot be removed", async ({ page }) => {
  await seedDiary("A", dataDayRows());
  await login(page, "A");
  await openDay(page, DAY_DATA);

  await page.getByRole("button", { name: "Frango com arroz, 2 itens" }).click();
  await page.getByRole("button", { name: "Remover Arroz de Frango com arroz" }).click();
  await expect(mealKcal(page, "lunch")).toHaveText("248 kcal");
  await expect(remaining(page)).toHaveText("1341");
  await expect(page.getByTestId("macro-carbs")).toContainText("69"); // 125 - 56
  await expect(page.getByRole("button", { name: /^Remover .* de Frango com arroz$/ })).toHaveCount(0);

  // No toast confirms this write: wait for the DB instead of racing the optimistic update.
  const savedMeal = () => fetchDiary("A", DAY_DATA).then((rows) => rows.find((r) => r.kind === "meal"));
  await expect.poll(async () => (await savedMeal())?.calories).toBe(248);
  const meal = await savedMeal();
  expect(meal).toMatchObject({ calories: 248, protein_g: 46.5, carbs_g: 0, fat_g: 5.4 });
  expect(meal?.items).toHaveLength(1);
});

test("failed writes show an error and nothing is shown as saved", async ({ page }) => {
  await seedDiary("A", dataDayRows());
  await login(page, "A");
  await openDay(page, DAY_DATA);
  await failWrites(page);

  await page.getByRole("button", { name: "Editar Aveia" }).click();
  await dialog(page).getByLabel("Calorias (kcal)").fill("999");
  await dialog(page).getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Sem ligação. As alterações não foram guardadas.")).toBeVisible();
  await expect(remaining(page)).toHaveText("1081");

  await page.getByRole("button", { name: "Remover Banana" }).click();
  await expect(page.getByText("Sem ligação. As alterações não foram guardadas.").first()).toBeVisible();
  await expect(page.getByText("Banana")).toBeVisible();
  await expect(remaining(page)).toHaveText("1081");

  expect((await fetchDiary("A", DAY_DATA)).find((r) => r.name === "Aveia")?.calories).toBe(224);
});

test("another user never sees these entries", async ({ page }) => {
  await seedDiary("A", dataDayRows());
  await login(page, "A");
  await openDay(page, DAY_DATA);
  await expect(remaining(page)).toHaveText("1081");
  await openProfile(page);
  await logout(page);

  await login(page, "B");
  await openDay(page, DAY_DATA);
  await expect(remaining(page)).toHaveText("2000");
  await expect(page.getByText("Aveia")).toHaveCount(0);
  await expect(page.getByText("Ainda sem registos neste dia.")).toBeVisible();
});

test("the rows of the day line up: the calories of headings, foods, meals and items end at the same place, long names wrap", async ({ page }) => {
  const day = toDateKey(new Date());
  const items = [
    { name: "Peito de frango grelhado com especiarias e molho", quantity_g: 150, calories: 248, protein_g: 46, carbs_g: 0, fat_g: 5 },
    { name: "Arroz", quantity_g: 150, calories: 195, protein_g: 4, carbs_g: 42, fat_g: 1 },
  ];
  await seedDiary("A", [
    { entry_date: day, meal: "lunch", kind: "meal", name: "Menu McCrispy Chicken Deluxe com batatas grandes e bebida", calories: 1037, protein_g: 40, carbs_g: 100, fat_g: 50, doses: 1, items },
    { entry_date: day, meal: "lunch", kind: "meal", name: "Tosta", calories: 516, protein_g: 20, carbs_g: 50, fat_g: 20, doses: 1.5, items },
    { entry_date: day, meal: "snacks", kind: "food", name: "Iogurte magro sem lactose com pedaços de frutos silvestres e cereais", quantity_g: 200, calories: 110, protein_g: 8, carbs_g: 12, fat_g: 1 },
    { entry_date: day, meal: "snacks", kind: "food", name: "Ovo", quantity_g: 60, calories: 93, protein_g: 8, carbs_g: 1, fat_g: 7 },
  ]);
  await login(page, "A");
  await page.getByRole("button", { name: /Menu McCrispy.*itens/ }).click();

  const rightEdges = async (locator: ReturnType<Page["getByTestId"]>) => {
    const boxes = await locator.evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().right)));
    return boxes;
  };
  const edges = [...(await rightEdges(page.getByTestId("row-kcal"))), ...(await rightEdges(page.getByTestId("meal-lunch-kcal"))), ...(await rightEdges(page.getByTestId("meal-snacks-kcal")))];
  expect(edges.length).toBeGreaterThanOrEqual(8); // 2 + 2 items + 2 snacks + 2 headings
  expect(new Set(edges).size).toBe(1); // one single right edge

  // a long name wraps on two lines at most and never pushes the calories out
  const name = page.getByRole("button", { name: /^Editar Iogurte magro/ });
  const box = (await name.boundingBox())!;
  expect(box.height).toBeLessThan(90);
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
});
