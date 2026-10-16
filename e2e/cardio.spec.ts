import { expect, test, type Page } from "@playwright/test";
import { login } from "./helpers";
import {
  clearActivities,
  clearDiary,
  clearTraining,
  deleteActivityAs,
  fetchActivities,
  fetchTrainings,
  insertCardioAs,
  seedCardio,
  setProfileWeight,
  updateActivityAs,
} from "./seed";

const DAY = "2026-01-20";
const clearAll = () => Promise.all([clearTraining("A"), clearTraining("B"), clearActivities("A"), clearActivities("B"), clearDiary("A")]);
test.beforeEach(async () => {
  await clearAll();
  await setProfileWeight("A", 80);
});
test.afterAll(async () => {
  await clearAll();
  await setProfileWeight("A", null);
});

const sheet = (page: Page) => page.locator('[data-slot="sheet-content"]');
const addButton = (page: Page) => sheet(page).getByRole("button", { name: "Add to diary" });
const hint = (page: Page, text: string) => sheet(page).getByRole("status").filter({ hasText: text });

async function openAddTraining(page: Page) {
  await login(page, "A");
  await page.goto(`/training/add?d=${DAY}`);
  await expect(page.getByRole("heading", { name: "Add training" })).toBeVisible();
  await page.waitForLoadState("networkidle");
}

test("the built-in sports are there, with Other", async ({ page }) => {
  await openAddTraining(page);
  const sports = page.getByTestId("sports");
  for (const name of ["Running", "Cycling", "Football", "Tennis", "Padel", "Volleyball"]) await expect(sports.getByRole("button", { name: `Log ${name}` })).toBeVisible();
  await expect(sports.getByRole("button", { name: "Log other sport" })).toBeVisible();
  expect((await fetchActivities("A")).map((a) => [a.name, a.met])).toEqual([["Running", 8], ["Cycling", 7], ["Football", 7], ["Tennis", 6.8], ["Padel", 6], ["Volleyball", 4]]);
});

test("Running for 30 minutes with a note: saved with the estimate of the calories", async ({ page }) => {
  await openAddTraining(page);
  await page.getByRole("button", { name: "Log Running" }).click();
  await expect(sheet(page).getByText("MET 8 · Compendium of Physical Activities")).toBeVisible();
  await expect(sheet(page).getByLabel("Time (min)")).toHaveValue("30");
  await expect(sheet(page).getByTestId("cardio-kcal")).toHaveText("≈ 320 kcal · estimate"); // 8 × 80 kg × 0.5 h
  await sheet(page).getByLabel("Notes").fill("5 km, 5:30/km");
  await expect(sheet(page).getByLabel("Date")).toHaveValue(DAY);
  await addButton(page).click();
  await expect(page.getByText(/Running added to/)).toBeVisible();

  const [entry] = await fetchTrainings("A", DAY);
  const running = (await fetchActivities("A")).find((a) => a.name === "Running");
  expect(entry).toMatchObject({ kind: "cardio", name: "Running", duration_min: 30, met: 8, weight_kg: 80, calories_est: 320, notes: "5 km, 5:30/km", exercises: null, activity_id: running!.id, saved_workout_id: null });
});

test("the time: buttons by five, the usual times, a typed value, and limits", async ({ page }) => {
  await openAddTraining(page);
  await page.getByRole("button", { name: "Log Cycling" }).click();
  const minutes = sheet(page).getByLabel("Time (min)");
  await sheet(page).getByRole("button", { name: "More time" }).click();
  await expect(minutes).toHaveValue("35");
  await sheet(page).getByRole("button", { name: "Less time" }).click();
  await sheet(page).getByRole("button", { name: "Less time" }).click();
  await expect(minutes).toHaveValue("25");
  await sheet(page).getByRole("group", { name: "Usual times" }).getByRole("button", { name: "45", exact: true }).click();
  await expect(minutes).toHaveValue("45");
  await expect(sheet(page).getByTestId("cardio-kcal")).toHaveText("≈ 420 kcal · estimate"); // 7 × 80 × 0.75
  await minutes.fill("90");
  await expect(sheet(page).getByTestId("cardio-kcal")).toHaveText("≈ 840 kcal · estimate");
  for (const bad of ["0", "1441", "1.5", ""]) {
    await minutes.fill(bad);
    await expect(hint(page, "Time: 1 to 1440 min")).toBeVisible();
    await expect(addButton(page)).toBeDisabled();
  }
  await minutes.fill("1440");
  await expect(addButton(page)).toBeEnabled();
  await sheet(page).getByLabel("Notes").fill("x".repeat(1001));
  await expect(hint(page, "Notes: max 1000 characters")).toBeVisible();
  await expect(addButton(page)).toBeDisabled();
});

test("Other: the name is required; without the star it is only logged, with it the sport is kept as one of mine", async ({ page }) => {
  await openAddTraining(page);
  await page.getByRole("button", { name: "Log other sport" }).click();
  await expect(addButton(page)).toBeDisabled();
  await expect(hint(page, "Name required")).toBeVisible();
  await expect(sheet(page).getByTestId("cardio-kcal")).toHaveCount(0); // no MET, no estimate
  await sheet(page).getByLabel("Sport name").fill("Beach volleyball");
  await sheet(page).getByLabel("Time (min)").fill("60");
  await addButton(page).click();
  await expect(page.getByText(/Beach volleyball added to/)).toBeVisible();
  expect((await fetchActivities("A")).some((a) => a.name === "Beach volleyball")).toBe(false); // not kept
  expect((await fetchTrainings("A", DAY))[0]).toMatchObject({ kind: "cardio", name: "Beach volleyball", duration_min: 60, met: null, weight_kg: null, calories_est: null, activity_id: null });

  await page.getByRole("button", { name: "Log other sport" }).click();
  await sheet(page).getByLabel("Sport name").fill("Squash");
  await sheet(page).getByRole("button", { name: "Save to favorites" }).click();
  await addButton(page).click();
  await expect(page.getByText(/Squash added to/)).toBeVisible();
  const own = (await fetchActivities("A")).find((a) => a.name === "Squash");
  expect(own).toMatchObject({ met: null, source: null });
  expect((await fetchTrainings("A", DAY))[1]).toMatchObject({ name: "Squash", activity_id: own!.id });
  await expect(page.getByTestId("sports").getByRole("button", { name: "Log Squash" })).toBeVisible(); // there next time

  // a sport name already kept is refused inline, and it can still be only logged
  await page.getByRole("button", { name: "Log other sport" }).click();
  await sheet(page).getByLabel("Sport name").fill("squash");
  await sheet(page).getByRole("button", { name: "Save to favorites" }).click();
  await addButton(page).click();
  await expect(sheet(page).getByRole("alert").filter({ hasText: "Sport name already saved" })).toBeVisible();
  expect(await fetchTrainings("A", DAY)).toHaveLength(2);
  await sheet(page).getByRole("button", { name: "Save to favorites" }).click();
  await addButton(page).click();
  await expect(page.getByText(/squash added to/)).toBeVisible();
  expect(await fetchTrainings("A", DAY)).toHaveLength(3);
});

test("without a weight in the profile there is no estimate, and it says why", async ({ page }) => {
  await setProfileWeight("A", null);
  await openAddTraining(page);
  await page.getByRole("button", { name: "Log Running" }).click();
  await expect(sheet(page).getByTestId("cardio-kcal")).toHaveCount(0);
  await expect(sheet(page).getByText("Add your weight in Profile for kcal")).toBeVisible();
  await addButton(page).click();
  await expect(page.getByText(/Running added to/)).toBeVisible();
  expect((await fetchTrainings("A", DAY))[0]).toMatchObject({ met: 8, weight_kg: null, calories_est: null });
});

test("Padel says it is not in the Compendium", async ({ page }) => {
  await openAddTraining(page);
  await page.getByRole("button", { name: "Log Padel" }).click();
  await expect(sheet(page).getByText("Padel is not in the Compendium: the value is tennis doubles.")).toBeVisible();
  await expect(sheet(page).getByTestId("cardio-kcal")).toHaveText("≈ 240 kcal · estimate"); // 6 × 80 × 0.5
});

test("Today lists the sport with its time; it opens to the note and the calories, and removing can be undone", async ({ page }) => {
  await openAddTraining(page);
  await page.getByRole("button", { name: "Log Running" }).click();
  await sheet(page).getByLabel("Notes").fill("5 km\nfelt good");
  await addButton(page).click();
  await expect(page.getByText(/Running added to/)).toBeVisible();
  await page.getByRole("button", { name: "View day" }).click();

  await expect(page.getByTestId("training-count")).toHaveText("1 done");
  const row = page.getByTestId("training-row");
  await expect(row).toHaveAttribute("data-kind", "cardio");
  await page.getByRole("button", { name: "Running, 30 min" }).click();
  await expect(row.getByTestId("training-kcal")).toHaveText("≈ 320 kcal · estimate");
  await expect(row.getByTestId("training-notes")).toContainText("felt good");

  await page.getByRole("button", { name: "Remove Running" }).click();
  await expect(page.getByTestId("training-count")).toHaveText("—");
  await expect.poll(async () => (await fetchTrainings("A", DAY)).length).toBe(0);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByTestId("training-count")).toHaveText("1 done");
  await expect.poll(async () => (await fetchTrainings("A", DAY))[0]).toMatchObject({ kind: "cardio", name: "Running", duration_min: 30, calories_est: 320, notes: "5 km\nfelt good", exercises: null });
});

test("a sport without a note or an estimate has nothing to open", async ({ page }) => {
  await seedCardio("A", [{ entry_date: DAY, name: "Squash", duration_min: 75 }]);
  await login(page, "A");
  await page.goto(`/?d=${DAY}`);
  await expect(page.getByTestId("training-count")).toHaveText("1 done");
  const open = page.getByRole("button", { name: "Squash, 1 h 15 min" });
  await expect(open).toBeVisible();
  await expect(open).toBeDisabled();
});

test("the history counts the sports as trainings", async ({ page }) => {
  await seedCardio("A", [{ entry_date: "2026-01-12" }, { entry_date: "2026-01-14", name: "Tennis", duration_min: 60 }]);
  await login(page, "A");
  await page.goto("/history?p=week&d=2026-01-14");
  await expect(page.getByTestId("training-total")).toHaveText("2");
  await expect(page.getByTestId("training-days-count")).toHaveText("on 2 days");
});

test("a failed save shows an error and nothing is shown as saved", async ({ page }) => {
  await openAddTraining(page);
  await page.getByRole("button", { name: "Log Running" }).click();
  await page.route("**/rest/v1/training_entries*", (route) => (route.request().method() === "POST" ? route.abort() : route.continue()));
  await addButton(page).click();
  await expect(page.getByText("No connection. Not saved")).toBeVisible();
  expect(await fetchTrainings("A")).toHaveLength(0);
});

test("the sports of one user are theirs alone; the built-in ones cannot be changed; no link to someone else's sport", async ({ page }) => {
  await openAddTraining(page);
  await page.getByRole("button", { name: "Log other sport" }).click();
  await sheet(page).getByLabel("Sport name").fill("Squash");
  await sheet(page).getByRole("button", { name: "Save to favorites" }).click();
  await addButton(page).click();
  await expect(page.getByText(/Squash added to/)).toBeVisible();
  const mine = (await fetchActivities("A")).find((a) => a.name === "Squash")!;

  // B does not see it, and only has the built-in ones
  expect((await fetchActivities("B")).map((a) => a.name)).toEqual(["Running", "Cycling", "Football", "Tennis", "Padel", "Volleyball"]);

  // the built-in ones are not anybody's to change or delete
  const running = (await fetchActivities("B")).find((a) => a.name === "Running")!;
  expect((await updateActivityAs("B", running.id, 99)).data).toEqual([]);
  expect((await deleteActivityAs("B", running.id)).data).toEqual([]);
  expect((await updateActivityAs("A", running.id, 99)).data).toEqual([]);
  expect((await fetchActivities("A")).find((a) => a.name === "Running")!.met).toBe(8);

  // a training of B cannot point at A's own sport; it can point at a built-in one
  const refused = await insertCardioAs("B", { entry_date: DAY, activity_id: mine.id });
  expect(refused.error).not.toBeNull();
  const allowed = await insertCardioAs("B", { entry_date: DAY, activity_id: running.id });
  expect(allowed.error).toBeNull();
  expect(await fetchTrainings("B")).toHaveLength(1);
});
