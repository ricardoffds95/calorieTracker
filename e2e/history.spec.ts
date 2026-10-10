import { expect, test, type Page } from "@playwright/test";
import { toDateKey } from "../lib/dates";
import { elapsedDays, periodFor, periodLabel, shiftPeriod } from "../lib/history";
import { login } from "./helpers";
import { clearDiary, clearSaved, dailyTotalsAs, seedDiary, seedSavedFood } from "./seed";

const clearAll = () => Promise.all([clearDiary("A"), clearDiary("B"), clearSaved("A"), clearSaved("B")]);
test.beforeEach(clearAll);
test.afterAll(clearAll);

const row = (date: string, calories: number, protein_g = 0, carbs_g = 0, fat_g = 0, meal = "lunch") => ({
  entry_date: date,
  meal,
  kind: "food",
  name: `Comida ${date}`,
  quantity_g: 100,
  calories,
  protein_g,
  carbs_g,
  fat_g,
});

/** Mon 12 to Sun 18 Jan 2026 (past, so the "elapsed days" are the whole week). Four logged days; Wed 14 has nothing. */
const WEEK = "p=week&d=2026-01-14";
const seedWeek = () =>
  seedDiary("A", [
    row("2026-01-12", 1200, 60, 120, 36, "breakfast"),
    row("2026-01-12", 800, 40, 80, 24, "dinner"), // same day: summed → 2000
    row("2026-01-13", 1500, 90.5, 150, 40.4),
    row("2026-01-15", 1799, 80, 180, 50),
    row("2026-01-16", 2400, 50, 250, 80), // over the 2000 goal
  ]);

async function openHistory(page: Page, query = "") {
  await page.goto(`/historico${query ? `?${query}` : ""}`);
  await expect(page.getByRole("heading", { level: 1, name: "Histórico" })).toBeVisible();
  await page.waitForLoadState("networkidle");
}

const label = (page: Page) => page.getByTestId("period-label");
const now = () => new Date();

test("opens on the current week and shows only what was logged", async ({ page }) => {
  const today = toDateKey(now());
  await seedDiary("A", [row(today, 1850, 120, 190, 55)]);
  await login(page, "A");
  await page.getByRole("link", { name: "Histórico" }).click();
  await expect(page).toHaveURL(/\/historico$/);

  const week = periodFor("week", today);
  await expect(label(page)).toHaveText(periodLabel(week, now()));
  await expect(page.getByRole("link", { name: "Semana" })).toHaveAttribute("aria-current", "true");
  await expect(page.getByTestId("avg-kcal")).toHaveText("1850");
  await expect(page.getByTestId("logged-days")).toContainText(`1 de ${elapsedDays(week, today)} `);
  await expect(page.getByRole("link", { name: "Voltar a hoje" })).toHaveCount(0);
  await expect(page.getByTestId("kcal-bar")).toHaveCount(7);
});

test("averages are per logged day: exact numbers, days summed, empty days left out", async ({ page }) => {
  await seedWeek();
  await login(page, "A");
  await openHistory(page, WEEK);

  await expect(label(page)).toHaveText(periodLabel(periodFor("week", "2026-01-14"), now()));
  // (2000 + 1500 + 1799 + 2400) / 4 days, not / 7
  await expect(page.getByTestId("avg-kcal")).toHaveText("1925");
  await expect(page.getByTestId("logged-days")).toContainText("4 de 7 dias registados");
  await expect(page.getByTestId("logged-days")).toContainText("total 7699 kcal");
  await expect(page.getByTestId("macro-protein")).toContainText("80.1"); // (100 + 90.5 + 80 + 50) / 4
  await expect(page.getByTestId("macro-carbs")).toContainText("195");
  await expect(page.getByTestId("macro-fat")).toContainText("57.6");
  await expect(page.getByTestId("macro-protein")).toContainText("20% das kcal");
  await expect(page.getByTestId("macro-carbs")).toContainText("48% das kcal");
  await expect(page.getByTestId("macro-fat")).toContainText("32% das kcal");
  await expect(page.getByText("Dia mais alto")).toBeVisible();
  // goals change over time, so nothing in the history is compared with them
  await expect(page.getByText(/meta/i)).toHaveCount(0);
  await expect(page.getByRole("progressbar")).toHaveCount(0);

  const bars = page.getByTestId("kcal-bar");
  await expect(bars).toHaveCount(7);
  await expect(bars.nth(4)).toHaveAttribute("aria-label", /2400 kcal/); // Friday 16
  await expect(bars.nth(2)).toHaveAttribute("aria-label", /sem registos/); // Wednesday

  await bars.nth(0).click();
  await expect(page.getByTestId("chart-readout")).toContainText("2000 kcal");
  await expect(page.getByTestId("chart-readout")).toContainText("P 100 · H 200 · G 60");
});

test("arrows, kind links, going to a date and 'Voltar a hoje'", async ({ page }) => {
  await seedWeek();
  await login(page, "A");
  await openHistory(page, WEEK);

  const week = periodFor("week", "2026-01-14");
  await page.getByRole("link", { name: "Período anterior" }).click();
  await expect(page).toHaveURL(/p=week&d=2026-01-05/);
  await expect(label(page)).toHaveText(periodLabel(shiftPeriod(week, -1), now()));
  await expect(page.getByTestId("history-empty")).toBeVisible();
  await page.getByRole("link", { name: "Período seguinte" }).click();
  await expect(page.getByTestId("avg-kcal")).toHaveText("1925");

  await page.getByRole("link", { name: "Mês" }).click();
  await expect(page).toHaveURL(/p=month&d=2026-01-01/);
  await expect(label(page)).toHaveText(periodLabel(periodFor("month", "2026-01-01"), now()));
  await expect(page.getByTestId("logged-days")).toContainText("4 de 31 dias registados");
  await expect(page.getByTestId("kcal-bar")).toHaveCount(31);

  await page.getByRole("link", { name: "Ano" }).click();
  await expect(page).toHaveURL(/p=year&d=2026-01-01/);
  await expect(page.getByTestId("kcal-bar")).toHaveCount(12);
  await expect(page.getByTestId("avg-kcal")).toHaveText("1925");
  await page.getByTestId("bucket-list").getByRole("link", { name: /janeiro/i }).click(); // drill into the month
  await expect(page).toHaveURL(/p=month&d=2026-01-01/);

  await page.getByRole("button", { name: /Ir para uma data/ }).click();
  await page.getByLabel("Data", { exact: true }).fill("2025-12-31");
  await page.getByRole("button", { name: "Ir", exact: true }).click();
  await expect(page).toHaveURL(/p=month&d=2025-12-01/);

  await page.getByRole("link", { name: "Voltar a hoje" }).click();
  await expect(page).toHaveURL(/p=month&d=\d{4}-\d{2}-01/);
  await expect(page.getByRole("link", { name: "Voltar a hoje" })).toHaveCount(0);
});

test("a custom range between two dates, validated, and kept in the URL", async ({ page }) => {
  await seedWeek();
  await login(page, "A");
  await openHistory(page, WEEK);

  await page.getByRole("link", { name: "Intervalo" }).click();
  await expect(page).toHaveURL(/p=custom&from=2026-01-12&to=2026-01-18/);
  await page.getByLabel("Até", { exact: true }).fill("2026-01-01"); // before "De"
  await page.getByRole("button", { name: "Ver intervalo" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "A data final tem de ser depois da inicial" })).toBeVisible();
  await page.getByLabel("De", { exact: true }).fill("2010-01-01");
  await page.getByLabel("Até", { exact: true }).fill("2026-01-18");
  await page.getByRole("button", { name: "Ver intervalo" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Máximo 10 anos" })).toBeVisible();

  await page.getByLabel("De", { exact: true }).fill("2026-01-13");
  await page.getByLabel("Até", { exact: true }).fill("2026-01-16");
  await page.getByRole("button", { name: "Ver intervalo" }).click();
  await expect(page).toHaveURL(/p=custom&from=2026-01-13&to=2026-01-16/);
  await expect(page.getByTestId("logged-days")).toContainText("3 de 4 dias registados"); // 13, 15 and 16
  await expect(page.getByTestId("avg-kcal")).toHaveText("1900"); // (1500 + 1799 + 2400) / 3 = 1899.67

  await page.reload();
  await expect(page.getByTestId("avg-kcal")).toHaveText("1900");
  await page.getByRole("link", { name: "Período anterior" }).click(); // moves by its own length (4 days)
  await expect(page).toHaveURL(/p=custom&from=2026-01-09&to=2026-01-12/);
  await expect(page.getByTestId("avg-kcal")).toHaveText("2000");
});

test("a period that has not started and an unknown URL are handled", async ({ page }) => {
  await login(page, "A");
  await openHistory(page, "p=week&d=2099-01-04");
  await expect(page.getByText("Este período ainda não começou.")).toBeVisible();
  await openHistory(page, "p=custom&from=nope&to=2026-01-01");
  await expect(label(page)).toHaveText(periodLabel(periodFor("week", toDateKey(now())), now())); // back to this week
});

test("what is logged in Registar shows up in the history", async ({ page }) => {
  await seedSavedFood("A", { name: "Ovo E2E", calories_100g: 155, protein_100g: 13, carbs_100g: 1.1, fat_100g: 11 });
  await login(page, "A");
  await page.getByRole("link", { name: "Histórico" }).click();
  await expect(page.getByTestId("history-empty")).toBeVisible();

  await page.getByRole("link", { name: "Registar", exact: true }).click();
  await page.getByRole("button", { name: "Escolher Ovo E2E" }).click();
  await page.getByRole("button", { name: /Adicionar a/ }).click();
  await expect(page.getByText(/Ovo E2E adicionado a/)).toBeVisible();

  await page.getByRole("link", { name: "Histórico" }).click(); // same session: the cache must have been invalidated
  await expect(page.getByTestId("avg-kcal")).toHaveText("155");
});

test("each user only sees their own days", async ({ page }) => {
  await seedWeek();
  const a = await dailyTotalsAs("A", "2026-01-01", "2026-01-31");
  expect(a.error).toBeNull();
  expect(a.data?.map((d) => [d.entry_date, d.calories, d.entries])).toEqual([
    ["2026-01-12", 2000, 2],
    ["2026-01-13", 1500, 1],
    ["2026-01-15", 1799, 1],
    ["2026-01-16", 2400, 1],
  ]);
  expect((await dailyTotalsAs("B", "2026-01-01", "2026-01-31")).data).toEqual([]);
  expect((await dailyTotalsAs("A", "2026-02-01", "2026-01-01")).error?.message).toMatch(/invalid date range/);
  expect((await dailyTotalsAs("A", "2000-01-01", "2026-01-01")).error?.message).toMatch(/too large/);

  await login(page, "B");
  await openHistory(page, WEEK);
  await expect(page.getByTestId("history-empty")).toBeVisible();
});
