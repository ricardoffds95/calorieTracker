import { expect, test, type Page } from "@playwright/test";
import { toDateKey } from "../lib/dates";
import { elapsedDays, periodFor, periodLabel, shiftPeriod } from "../lib/history";
import { login } from "./helpers";
import { clearDiary, clearSaved, clearTraining, dailyTotalsAs, mealTotalsAs, seedDiary, seedSavedFood, seedTraining, topItemsAs, trainingCountsAs } from "./seed";

const clearAll = () => Promise.all([clearDiary("A"), clearDiary("B"), clearSaved("A"), clearSaved("B"), clearTraining("A"), clearTraining("B")]);
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
  await page.goto(`/history${query ? `?${query}` : ""}`);
  await expect(page.getByRole("heading", { level: 1, name: "History" })).toBeVisible();
  await page.waitForLoadState("networkidle");
}

const label = (page: Page) => page.getByTestId("period-label");
const tab = (page: Page, metric: "calories" | "protein" | "carbs" | "fat") => page.getByTestId(`metric-tab-${metric}`);
/** The list of days is closed until asked for. */
const openDays = (page: Page, noun = "days") => page.getByRole("button", { name: new RegExp(`^Show ${noun}`) }).click();
const now = () => new Date();

test("opens on the current week and shows only what was logged", async ({ page }) => {
  const today = toDateKey(now());
  await seedDiary("A", [row(today, 1850, 120, 190, 55)]);
  await login(page, "A");
  await page.getByRole("link", { name: "History" }).click();
  await expect(page).toHaveURL(/\/history$/);

  const week = periodFor("week", today);
  await expect(label(page)).toHaveText(periodLabel(week, now()));
  await expect(page.getByRole("link", { name: "Week" })).toHaveAttribute("aria-current", "true");
  await expect(page.getByTestId("avg-kcal")).toHaveText("1850");
  await expect(page.getByTestId("logged-days")).toContainText(`1 of ${elapsedDays(week, today)} `);
  await expect(page.getByRole("link", { name: "Back to today" })).toHaveCount(0);
  await expect(page.getByTestId("kcal-bar")).toHaveCount(elapsedDays(week, today)); // days that have not happened are not drawn
});

test("the current month and year stop today: no future days in the chart or the list", async ({ page }) => {
  const today = now();
  await seedDiary("A", [row(toDateKey(today), 1800, 100, 180, 50)]); // the chart only exists once something was logged
  await login(page, "A");
  await openHistory(page, `p=month&d=${toDateKey(today)}`);
  await expect(page.getByTestId("kcal-bar")).toHaveCount(today.getDate());
  await openDays(page);
  await expect(page.getByTestId("bucket-list").getByRole("listitem")).toHaveCount(1); // only today has data
  await page.getByRole("button", { name: "Show all days" }).click();
  await expect(page.getByTestId("bucket-list").getByRole("listitem")).toHaveCount(today.getDate());
  await page.getByRole("link", { name: "Year" }).click();
  await expect(page.getByTestId("kcal-bar")).toHaveCount(today.getMonth() + 1); // January up to this month
});

test("highest and lowest day leave out today, which is not over yet", async ({ page }) => {
  const today = toDateKey(now());
  await seedDiary("A", [row("2026-01-14", 1500, 100, 150, 40), row("2026-01-15", 2000, 120, 200, 60), row(today, 300, 10, 20, 5)]);
  await login(page, "A");
  await openHistory(page, `p=custom&from=2026-01-01&to=${today}`);
  const stat = (kind: "avg" | "max" | "min") => page.getByTestId(`stat-calories-${kind}`);
  await expect(stat("min")).toContainText("1500 kcal"); // not today's 300
  await expect(stat("min")).toContainText("Wed, 14 Jan");
  await expect(stat("max")).toContainText("2000 kcal");
  await expect(stat("avg")).toHaveText("1267 kcal"); // today still counts in the average: (1500 + 2000 + 300) / 3
});

test("with only today logged there is no highest or lowest day", async ({ page }) => {
  const today = toDateKey(now());
  await seedDiary("A", [row(today, 300, 10, 20, 5)]);
  await login(page, "A");
  await openHistory(page, `p=month&d=${today}`);
  await expect(page.getByTestId("stat-calories-avg")).toHaveText("300 kcal");
  await expect(page.getByTestId("stat-calories-max")).toHaveText("—");
  await expect(page.getByTestId("stat-calories-min")).toHaveText("—");
});

test("averages are per logged day: exact numbers, days summed, empty days left out", async ({ page }) => {
  await seedWeek();
  await login(page, "A");
  await openHistory(page, WEEK);

  await expect(label(page)).toHaveText(periodLabel(periodFor("week", "2026-01-14"), now()));
  // (2000 + 1500 + 1799 + 2400) / 4 days, not / 7
  await expect(page.getByTestId("avg-kcal")).toHaveText("1925");
  await expect(page.getByTestId("logged-days")).toContainText("4 of 7 days logged");
  await expect(page.getByTestId("logged-days")).toContainText("total 7699 kcal");
  // goals change over time, so nothing in the history is compared with them
  await expect(page.getByText(/meta/i)).toHaveCount(0);
  await expect(page.getByRole("progressbar")).toHaveCount(0);

  // average, highest and lowest day of calories and of every macro: one chart, the tabs pick the metric
  const stat = (metric: string, kind: "avg" | "max" | "min") => page.getByTestId(`stat-${metric}-${kind}`);
  await expect(page.getByRole("progressbar")).toHaveCount(0);
  await expect(stat("calories", "avg")).toHaveText("1925 kcal");
  await expect(stat("calories", "max")).toContainText("2400 kcal");
  await expect(stat("calories", "max")).toContainText("Fri, 16 Jan");
  await expect(stat("calories", "min")).toContainText("1500 kcal");
  await expect(stat("calories", "min")).toContainText("Tue, 13 Jan");
  // one chart, a bar for each day of the week
  const bars = page.getByTestId("kcal-bar");
  await expect(bars).toHaveCount(7);
  await expect(page.getByTestId("macro-bar")).toHaveCount(0); // the macros are another tab, not more charts
  await expect(bars.nth(4)).toHaveAttribute("aria-label", /2400 kcal/); // Friday 16
  await expect(bars.nth(2)).toHaveAttribute("aria-label", /none/); // Wednesday

  await tab(page, "protein").click();
  await expect(stat("protein", "avg")).toContainText("80.1 g"); // (100 + 90.5 + 80 + 50) / 4
  await expect(stat("protein", "avg")).toContainText("20% of kcal");
  await expect(stat("protein", "max")).toContainText("100 g");
  await expect(stat("protein", "max")).toContainText("Mon, 12 Jan");
  await expect(stat("protein", "min")).toContainText("50 g");
  await expect(stat("protein", "min")).toContainText("Fri, 16 Jan");
  await expect(page.getByTestId("macro-bar")).toHaveCount(7);
  await tab(page, "carbs").click();
  await expect(stat("carbs", "avg")).toContainText("195 g");
  await expect(stat("carbs", "avg")).toContainText("48% of kcal");
  await expect(stat("carbs", "max")).toContainText("250 g");
  await expect(stat("carbs", "min")).toContainText("150 g");
  await tab(page, "fat").click();
  await expect(stat("fat", "avg")).toContainText("57.6 g");
  await expect(stat("fat", "avg")).toContainText("32% of kcal");
  await expect(stat("fat", "max")).toContainText("80 g");
  await expect(stat("fat", "min")).toContainText("40.4 g");
  await expect(tab(page, "fat")).toHaveAttribute("aria-pressed", "true");
  await expect(tab(page, "calories")).toHaveAttribute("aria-pressed", "false");
});

test("selecting a bar shows every value of that day in one line, and the choice follows the tabs", async ({ page }) => {
  await seedWeek();
  await login(page, "A");
  await openHistory(page, WEEK);
  const readout = page.getByTestId("chart-readout");
  const selected = page.locator('[data-selected="true"]');

  await expect(readout).toHaveText("Tap a bar");
  await page.getByTestId("kcal-bar").nth(0).click();
  await expect(readout).toContainText("2000 kcal");
  await expect(readout).toContainText("P 100 · C 200 · F 60");
  await expect(selected).toHaveCount(1);

  await tab(page, "fat").click(); // another metric, the same day stays selected
  await expect(selected).toHaveCount(1);
  await expect(page.locator('[data-testid="macro-bar"][data-selected="true"]')).toHaveAttribute("data-metric", "fat");
  await page.getByTestId("macro-bar").nth(4).click(); // Friday
  await expect(readout).toContainText("2400 kcal");
  await expect(readout).toContainText("P 50 · C 250 · F 80");

  await page.getByTestId("macro-bar").nth(4).click(); // again: unselect
  await expect(selected).toHaveCount(0);
  await expect(readout).toHaveText("Tap a bar");
});

test("the list shows only the days with data, and every day on request", async ({ page }) => {
  await seedWeek();
  await login(page, "A");
  await openHistory(page, WEEK);
  const items = page.getByTestId("bucket-list").getByRole("listitem");

  await expect(page.getByTestId("bucket-list")).toHaveCount(0); // closed until asked for
  await openDays(page);
  await expect(items).toHaveCount(4); // Mon 12, Tue 13, Thu 15, Fri 16
  await expect(page.getByTestId("bucket-list")).not.toContainText("—");
  await page.getByRole("button", { name: "Show all days" }).click();
  await expect(items).toHaveCount(7);
  await expect(page.getByTestId("bucket-list").getByText("—")).toHaveCount(3);
  await expect(page.getByRole("button", { name: "Logged days only" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("kcal-bar")).toHaveCount(7); // the charts always show the whole period
  await page.getByRole("button", { name: "Logged days only" }).click();
  await expect(items).toHaveCount(4);

  await openHistory(page, "p=year&d=2026-01-01"); // months in the year view
  await openDays(page, "months");
  await page.getByRole("button", { name: "Show all months" }).click();
  await expect(items).toHaveCount(now().getFullYear() === 2026 ? now().getMonth() + 1 : 12); // a past year has 12 months
});

test("arrows, kind links, going to a date and 'Back to today'", async ({ page }) => {
  await seedWeek();
  await login(page, "A");
  await openHistory(page, WEEK);

  const week = periodFor("week", "2026-01-14");
  await page.getByRole("link", { name: "Previous period" }).click();
  await expect(page).toHaveURL(/p=week&d=2026-01-05/);
  await expect(label(page)).toHaveText(periodLabel(shiftPeriod(week, -1), now()));
  await expect(page.getByTestId("history-empty")).toBeVisible();
  await page.getByRole("link", { name: "Next period" }).click();
  await expect(page.getByTestId("avg-kcal")).toHaveText("1925");

  await page.getByRole("link", { name: "Month" }).click();
  await expect(page).toHaveURL(/p=month&d=2026-01-01/);
  await expect(label(page)).toHaveText(periodLabel(periodFor("month", "2026-01-01"), now()));
  await expect(page.getByTestId("logged-days")).toContainText("4 of 31 days logged");
  await expect(page.getByTestId("kcal-bar")).toHaveCount(31);

  await page.getByRole("link", { name: "Year" }).click();
  await expect(page).toHaveURL(/p=year&d=2026-01-01/);
  // a past year has 12 months; the current one stops at this month
  await expect(page.getByTestId("kcal-bar")).toHaveCount(now().getFullYear() === 2026 ? now().getMonth() + 1 : 12);
  await expect(page.getByTestId("avg-kcal")).toHaveText("1925");
  await openDays(page, "months");
  await page.getByTestId("bucket-list").getByRole("link", { name: /January/i }).click(); // drill into the month
  await expect(page).toHaveURL(/p=month&d=2026-01-01/);

  await page.getByRole("button", { name: /Go to date/ }).click();
  await page.getByLabel("Date", { exact: true }).fill("2025-12-31");
  await page.getByRole("button", { name: "Go", exact: true }).click();
  await expect(page).toHaveURL(/p=month&d=2025-12-01/);

  await page.getByRole("link", { name: "Back to today" }).click();
  await expect(page).toHaveURL(/p=month&d=\d{4}-\d{2}-01/);
  await expect(page.getByRole("link", { name: "Back to today" })).toHaveCount(0);
});

test("a custom range between two dates, validated, and kept in the URL", async ({ page }) => {
  await seedWeek();
  await login(page, "A");
  await openHistory(page, WEEK);

  await page.getByRole("link", { name: "Range" }).click();
  await expect(page).toHaveURL(/p=custom&from=2026-01-12&to=2026-01-18/);
  await page.getByLabel("To", { exact: true }).fill("2026-01-01"); // before "From"
  await page.getByRole("button", { name: "View range" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "End date must be after the start" })).toBeVisible();
  await page.getByLabel("From", { exact: true }).fill("2010-01-01");
  await page.getByLabel("To", { exact: true }).fill("2026-01-18");
  await page.getByRole("button", { name: "View range" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Max 10 years" })).toBeVisible();

  await page.getByLabel("From", { exact: true }).fill("2026-01-13");
  await page.getByLabel("To", { exact: true }).fill("2026-01-16");
  await page.getByRole("button", { name: "View range" }).click();
  await expect(page).toHaveURL(/p=custom&from=2026-01-13&to=2026-01-16/);
  await expect(page.getByTestId("logged-days")).toContainText("3 of 4 days logged"); // 13, 15 and 16
  await expect(page.getByTestId("avg-kcal")).toHaveText("1900"); // (1500 + 1799 + 2400) / 3 = 1899.67

  await page.reload();
  await expect(page.getByTestId("avg-kcal")).toHaveText("1900");
  await page.getByRole("link", { name: "Previous period" }).click(); // moves by its own length (4 days)
  await expect(page).toHaveURL(/p=custom&from=2026-01-09&to=2026-01-12/);
  await expect(page.getByTestId("avg-kcal")).toHaveText("2000");
});

test("a period that has not started and an unknown URL are handled", async ({ page }) => {
  await login(page, "A");
  await openHistory(page, "p=week&d=2099-01-04");
  await expect(page.getByText("Not started")).toBeVisible();
  await openHistory(page, "p=custom&from=nope&to=2026-01-01");
  await expect(label(page)).toHaveText(periodLabel(periodFor("week", toDateKey(now())), now())); // back to this week
});

test("what is logged in Registar shows up in the history", async ({ page }) => {
  await seedSavedFood("A", { name: "Ovo E2E", calories_100g: 155, protein_100g: 13, carbs_100g: 1.1, fat_100g: 11 });
  await login(page, "A");
  await page.getByRole("link", { name: "History" }).click();
  await expect(page.getByTestId("history-empty")).toBeVisible();

  await page.getByRole("link", { name: "Today", exact: true }).click();
  await page.getByRole("link", { name: "Add meal" }).click();
  await page.getByRole("button", { name: "Choose Ovo E2E" }).click();
  await page.getByRole("button", { name: /Add to/ }).click();
  await expect(page.getByText(/Ovo E2E added to/)).toBeVisible();

  await page.getByRole("link", { name: "History" }).click(); // same session: the cache must have been invalidated
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

const meal = (date: string, name: string, calories: number, mealName = "lunch") => ({
  entry_date: date,
  meal: mealName,
  kind: "meal",
  name,
  calories,
  protein_g: 30,
  carbs_g: 60,
  fat_g: 20,
  doses: 1,
  items: [{ name, quantity_g: null, calories, protein_g: 30, carbs_g: 60, fat_g: 20 }],
});

/** Four logged days in the week of WEEK, plus a day in the week before. */
const seedInsights = () =>
  seedDiary("A", [
    { ...row("2026-01-12", 150, 12, 1, 10, "breakfast"), name: "  ovo " }, // the same food: case and spaces are ignored
    { ...row("2026-01-12", 1100, 40, 130, 40), name: "Pizza" },
    { ...row("2026-01-13", 150, 12, 1, 10, "breakfast"), name: "Ovo" },
    meal("2026-01-13", "Frango com arroz", 600),
    { ...row("2026-01-15", 150, 12, 1, 10, "breakfast"), name: "Ovo" },
    meal("2026-01-15", "Frango com arroz", 600),
    { ...row("2026-01-16", 150, 12, 1, 10, "breakfast"), name: "Ovo" },
    { ...row("2026-01-16", 5, 0, 1, 0, "snacks"), name: "Café" },
    { ...row("2026-01-07", 600, 30, 60, 20), name: "Sopa" }, // the week before
  ]);

test("Most eaten: by times and by calories, foods and meals, same names counted together", async ({ page }) => {
  await seedInsights();
  await login(page, "A");
  await openHistory(page, WEEK);

  const list = page.getByTestId("top-items");
  const rows = list.getByRole("listitem");
  await expect(rows).toHaveCount(4);
  await expect(rows.nth(0)).toContainText("Ovo");
  await expect(rows.nth(0).getByTestId("top-times")).toHaveText("4×");
  await expect(rows.nth(0).getByTestId("top-calories")).toHaveText("600 kcal");
  await expect(rows.nth(1)).toContainText("Frango com arroz");
  await expect(rows.nth(1)).toContainText("Meal");
  await expect(rows.nth(2)).toContainText("Pizza"); // a tie on times: the one with more calories first
  await expect(rows.nth(3)).toContainText("Café");

  await page.getByRole("region", { name: "Most eaten" }).getByRole("button", { name: "Calories" }).click();
  await expect(rows.nth(0)).toContainText("Frango com arroz");
  await expect(rows.nth(0).getByTestId("top-times")).toHaveText("2×");
  await expect(rows.nth(0).getByTestId("top-calories")).toHaveText("1200 kcal");
  await expect(rows.nth(1)).toContainText("Pizza");
  await expect(rows.nth(2)).toContainText("Ovo");
  await expect(rows.nth(3)).toContainText("Café");
});

test("Calories by meal: the share of each meal and its average per logged day", async ({ page }) => {
  await seedInsights();
  await login(page, "A");
  await openHistory(page, WEEK);
  // breakfast 600, lunch 2300, dinner 0, snacks 5 of 2905 kcal over 4 logged days
  await expect(page.getByTestId("meal-percent-breakfast")).toHaveText("21%");
  await expect(page.getByTestId("meal-percent-lunch")).toHaveText("79%");
  await expect(page.getByTestId("meal-percent-dinner")).toHaveText("0%");
  await expect(page.getByTestId("meal-percent-snacks")).toHaveText("0%");
  const legend = page.getByTestId("meal-legend");
  await expect(legend).toContainText("150 kcal/day");
  await expect(legend).toContainText("575 kcal/day");
  await expect(page.getByTestId("meal-bar")).toHaveAttribute("aria-label", "Breakfast 21%, Lunch 79%, Dinner 0%, Snacks 0%");
});

test("the average is compared with the period before: a direction and a percentage, no goals", async ({ page }) => {
  await seedInsights();
  await login(page, "A");
  await openHistory(page, WEEK);
  // (1250 + 750 + 750 + 155) / 4 = 726 against 600 the week before
  await expect(page.getByTestId("avg-kcal")).toHaveText("726");
  await expect(page.getByTestId("delta-chip")).toHaveText("+21% vs last week");

  await openHistory(page, "p=week&d=2026-01-05"); // the week before has nothing before it
  await expect(page.getByTestId("delta-chip")).toHaveCount(0);
});

test("with fewer than 3 logged days there is no comparison, just a short note", async ({ page }) => {
  await seedDiary("A", [row("2026-01-12", 1800, 100, 180, 50), row("2026-01-07", 1500)]);
  await login(page, "A");
  await openHistory(page, WEEK);
  await expect(page.getByTestId("avg-kcal")).toHaveText("1800");
  await expect(page.getByTestId("delta-chip")).toHaveCount(0);
  await expect(page.getByRole("status").filter({ hasText: "Log 3+ days for trends" })).toBeVisible();
  await expect(page.getByTestId("top-items").getByRole("listitem")).toHaveCount(1); // what there is is still shown
});

test("the whole screen is short: the four metrics are one chart", async ({ page }) => {
  await seedInsights();
  await login(page, "A");
  await openHistory(page, WEEK);
  await expect(page.getByRole("button", { name: /^Show days/ })).toBeVisible();
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  expect(height).toBeLessThan(2100); // it was about 3 times that with four charts and the full list
});

test("the insight functions only read your own entries and refuse bad input", async () => {
  await seedInsights();
  const top = await topItemsAs("A", "2026-01-01", "2026-01-31", "times");
  expect(top.data?.map((r) => [r.name, r.kind, r.times, r.total_calories])).toEqual([
    ["Ovo", "food", 4, 600],
    ["Frango com arroz", "meal", 2, 1200],
    ["Pizza", "food", 1, 1100],
    ["Sopa", "food", 1, 600],
    ["Café", "food", 1, 5],
  ]);
  expect((await topItemsAs("A", "2026-01-01", "2026-01-31", "calories", 2)).data?.map((r) => r.name)).toEqual(["Frango com arroz", "Pizza"]);
  expect((await topItemsAs("B", "2026-01-01", "2026-01-31", "times")).data).toEqual([]);
  expect((await topItemsAs("A", "2026-01-01", "2026-01-31", "name" as "times")).error?.message).toMatch(/invalid order/);
  expect((await topItemsAs("A", "2026-01-01", "2026-01-31", "times", 50)).error?.message).toMatch(/invalid limit/);
  expect((await topItemsAs("A", "2026-02-01", "2026-01-01", "times")).error?.message).toMatch(/invalid date range/);

  const meals = await mealTotalsAs("A", "2026-01-12", "2026-01-18");
  expect(Object.fromEntries((meals.data ?? []).map((r) => [r.meal, r.calories]))).toEqual({ breakfast: 600, lunch: 2300, snacks: 5 });
  expect((await mealTotalsAs("B", "2026-01-12", "2026-01-18")).data).toEqual([]);
  expect((await mealTotalsAs("A", "2000-01-01", "2026-01-01")).error?.message).toMatch(/too large/);
});

test.describe("training in the history", () => {
  const days = (page: Page) => page.getByTestId("training-days").getByRole("listitem");

  test("a week: how many trainings, on how many days, and a check on each day trained", async ({ page }) => {
    // Mon 12 and Wed 14 (two trainings) and Fri 16; nothing logged to eat that week
    await seedTraining("A", [{ entry_date: "2026-01-12" }, { entry_date: "2026-01-14" }, { entry_date: "2026-01-14", name: "Legs" }, { entry_date: "2026-01-16" }]);
    await login(page, "A");
    await openHistory(page, WEEK);

    await expect(page.getByTestId("training-card")).toBeVisible(); // even with nothing eaten
    await expect(page.getByTestId("history-empty")).toBeVisible();
    await expect(page.getByTestId("training-total")).toHaveText("4");
    await expect(page.getByTestId("training-days-count")).toHaveText("on 3 days");
    await expect(days(page)).toHaveCount(7);
    await expect(page.locator('[data-testid="training-days"] li[data-trained="true"]')).toHaveCount(3);
    await expect(page.locator('[data-testid="training-days"] li[data-trained="false"]')).toHaveCount(4);
    await expect(days(page).nth(2).getByRole("link")).toHaveAccessibleName(/Wed, 14 Jan: 2 trainings/);
    await expect(days(page).nth(1).getByRole("link")).toHaveAccessibleName(/Tue, 13 Jan: no training/);
    await days(page).nth(2).getByRole("link").click(); // a day opens in Today
    await expect(page).toHaveURL(/\/\?d=2026-01-14/);
  });

  test("the change against the week before, only when that week had trainings", async ({ page }) => {
    await seedTraining("A", [{ entry_date: "2026-01-12" }, { entry_date: "2026-01-14" }, { entry_date: "2026-01-16" }, { entry_date: "2026-01-17" }, { entry_date: "2026-01-06" }, { entry_date: "2026-01-08" }]);
    await login(page, "A");
    await openHistory(page, WEEK);
    await expect(page.getByTestId("training-total")).toHaveText("4");
    await expect(page.getByTestId("training-card").getByTestId("delta-chip")).toContainText("+100% vs last week"); // 4 against 2

    await openHistory(page, "p=week&d=2026-01-06"); // the week before has nothing before it
    await expect(page.getByTestId("training-total")).toHaveText("2");
    await expect(page.getByTestId("training-card").getByTestId("delta-chip")).toHaveCount(0);
  });

  test("no trainings: a short line and no strip", async ({ page }) => {
    await seedDiary("A", [row("2026-01-13", 1500, 90, 150, 40)]);
    await login(page, "A");
    await openHistory(page, WEEK);
    await expect(page.getByTestId("training-empty")).toHaveText("No training");
    await expect(page.getByTestId("training-days")).toHaveCount(0);
  });

  test("today with a training is checked", async ({ page }) => {
    const today = toDateKey(now());
    await seedTraining("A", [{ entry_date: today }]);
    await login(page, "A");
    await openHistory(page, `p=week&d=${today}`);
    await expect(page.getByTestId("training-total")).toHaveText("1");
    const done = page.locator(`[data-testid="training-days"] li[data-trained="true"]`);
    await expect(done).toHaveCount(1);
    await expect(done.getByRole("link")).toHaveAccessibleName(/: trained$/);
  });

  test("a month shows a circle per day; a year shows a bar per month", async ({ page }) => {
    await seedTraining("A", [{ entry_date: "2025-01-03" }, { entry_date: "2025-01-20" }, { entry_date: "2025-01-20", name: "Legs" }, { entry_date: "2025-03-10" }]);
    await login(page, "A");
    await openHistory(page, "p=month&d=2025-01-15");
    await expect(page.getByTestId("training-total")).toHaveText("3");
    await expect(days(page)).toHaveCount(31);
    await expect(page.locator('[data-testid="training-days"] li[data-trained="true"]')).toHaveCount(2);

    await openHistory(page, "p=year&d=2025-06-01");
    await expect(page.getByTestId("training-total")).toHaveText("4");
    await expect(page.getByTestId("training-days-count")).toHaveText("on 3 days");
    const bars = page.getByTestId("training-bars").getByRole("listitem");
    await expect(bars).toHaveCount(12);
    await expect(bars.nth(0).getByRole("link")).toHaveAccessibleName(/January: 3 trainings/);
    await expect(bars.nth(1).getByRole("link")).toHaveAccessibleName(/February: 0 trainings/);
    await expect(bars.nth(2).getByRole("link")).toHaveAccessibleName(/March: 1 training$/);
  });

  test("the list of days marks the days trained", async ({ page }) => {
    await seedDiary("A", [row("2026-01-12", 1500, 90, 150, 40), row("2026-01-13", 1700, 90, 150, 40)]);
    await seedTraining("A", [{ entry_date: "2026-01-13" }]);
    await login(page, "A");
    await openHistory(page, WEEK);
    await openDays(page);
    const rows = page.getByTestId("bucket-list").getByRole("listitem");
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0).getByTestId("trained-mark")).toHaveCount(0);
    await expect(rows.nth(1).getByTestId("trained-mark")).toBeVisible();
  });

  test("adding a training in Add training shows up in the history, and removing it takes it away", async ({ page }) => {
    const today = toDateKey(now());
    await login(page, "A");
    await page.goto(`/training/add?d=${today}`);
    await page.getByRole("button", { name: "New workout" }).click();
    await page.locator('[data-testid="body"] path#biceps').first().click({ force: true });
    await page.getByRole("button", { name: /^Open .*Curl/ }).first().click();
    await page.getByRole("button", { name: "Add to workout" }).click();
    await page.getByRole("button", { name: /^Workout · 1 exercise$/ }).click();
    const sheet = page.locator('[data-slot="sheet-content"]');
    await sheet.getByLabel("Workout name").fill("Arms");
    await sheet.getByRole("button", { name: "Save to favorites" }).click(); // only logged
    await sheet.getByRole("button", { name: "Add to diary" }).click();
    await expect(page.getByText(/Arms added to/)).toBeVisible();

    await page.getByRole("link", { name: "History", exact: true }).click();
    await expect(page.getByTestId("training-total")).toHaveText("1");
    await page.getByRole("link", { name: "Today", exact: true }).click();
    await page.getByRole("button", { name: "Remove Arms" }).click();
    await expect(page.getByTestId("training-count")).toHaveText("—");
    await page.getByRole("link", { name: "History", exact: true }).click();
    await expect(page.getByTestId("training-empty")).toBeVisible();
  });

  test("each user only counts their own trainings", async ({ page }) => {
    await seedTraining("A", [{ entry_date: "2026-01-12" }]);
    await seedTraining("B", [{ entry_date: "2026-01-13" }, { entry_date: "2026-01-13" }]);
    const a = await trainingCountsAs("A", "2026-01-01", "2026-12-31");
    expect(a.data).toEqual([{ entry_date: "2026-01-12", trainings: 1 }]);
    const b = await trainingCountsAs("B", "2026-01-01", "2026-12-31");
    expect(b.data).toEqual([{ entry_date: "2026-01-13", trainings: 2 }]);
    expect((await trainingCountsAs("A", "2026-02-01", "2026-01-01")).error?.message).toMatch(/invalid date range/);
    expect((await trainingCountsAs("A", "2000-01-01", "2026-01-01")).error?.message).toMatch(/too large/);
    await login(page, "A");
    await openHistory(page, WEEK);
    await expect(page.getByTestId("training-total")).toHaveText("1");
  });
});
