import { expect, test, type Page } from "@playwright/test";
import { login, logout, openProfile } from "./helpers";
import { BENCH, CURL, FLYES, clearDiary, clearTraining, fetchTrainings, fetchWorkouts, insertTrainingAs, seedWorkout } from "./seed";

const DAY = "2026-01-20";
const clearAll = () => Promise.all([clearTraining("A"), clearTraining("B"), clearDiary("A")]);
test.beforeEach(clearAll);
test.afterAll(clearAll);

const sideButton = (page: Page, name: "Front" | "Back") => page.getByRole("group", { name: "Body side" }).getByRole("button", { name });
const muscle = (page: Page, name: string) => page.getByRole("group", { name: "Muscles" }).getByRole("button", { name, exact: true });
const chosen = (page: Page) => page.getByRole("list", { name: "Chosen muscles" }).getByRole("listitem");
const rows = (page: Page) => page.getByTestId("exercise-list").getByRole("listitem");

async function openTraining(page: Page) {
  await page.goto("/training");
  await expect(page.getByRole("heading", { name: "Training", level: 1 })).toBeVisible();
  await page.waitForLoadState("networkidle");
}

/** Chooses muscles by name (the list under the body): the same thing as tapping them on the drawing. */
async function pick(page: Page, ...names: string[]) {
  await page.getByText("By name").click();
  for (const name of names) await muscle(page, name).click();
}

test("the Training tab shows the body and asks to pick a muscle", async ({ page }) => {
  await login(page, "A");
  await page.getByRole("link", { name: "Training", exact: true }).click();
  await expect(page).toHaveURL(/\/training$/);
  await expect(page.getByRole("status").filter({ hasText: "Pick a muscle" })).toBeVisible();
  await expect(page.getByTestId("body")).toHaveAttribute("data-view", "front");
  await sideButton(page, "Back").click();
  await expect(page.getByTestId("body")).toHaveAttribute("data-view", "back");
  await sideButton(page, "Front").click();
  await expect(page.getByTestId("body")).toHaveAttribute("data-view", "front");
  await expect(page.getByTestId("exercise-list")).toHaveCount(0); // nothing until a muscle is chosen
});

test("tapping the body picks a muscle, and the exercises for it appear with photos", async ({ page }) => {
  await login(page, "A");
  await openTraining(page);
  await page.locator('[data-testid="body"] path#chest').first().click({ force: true });
  await expect(chosen(page).first()).toBeVisible();
  await expect(page.getByTestId("exercise-count")).toBeVisible();
  await expect(rows(page).first().locator("img")).toHaveAttribute("src", /cdn\.jsdelivr\.net\/gh\/yuhonas\/free-exercise-db/);
  await expect(chosen(page)).toHaveCount(1);
  await expect(page.locator('[data-testid="body"] path#chest').first()).toHaveAttribute("fill", "var(--primary)"); // the chosen zone is coloured
  await expect(page.locator('[data-testid="body"] path#biceps').first()).not.toHaveAttribute("fill", "var(--primary)");
  await page.locator('[data-testid="body"] path#chest').first().click({ force: true }); // tapping again lets it go
  await expect(chosen(page)).toHaveCount(0);
});

test("the body follows the sex of the profile, and a muscle that shows on both sides keeps its choice", async ({ page }) => {
  await login(page, "A");
  await openTraining(page);
  await expect(page.getByTestId("body")).toHaveAttribute("data-gender", /^(male|female)$/);
  await sideButton(page, "Back").click();
  await page.locator('[data-testid="body"] path#deltoids').first().click({ force: true });
  await expect(page.getByRole("button", { name: "Remove Shoulders" })).toBeVisible();
  await sideButton(page, "Front").click();
  await expect(page.locator('[data-testid="body"] path#deltoids').first()).toHaveAttribute("fill", "var(--primary)"); // coloured on the front too
});

test("several muscles at once; chips take them off; the front and the back are one choice", async ({ page }) => {
  await login(page, "A");
  await openTraining(page);
  await pick(page, "Chest", "Triceps");
  await expect(chosen(page)).toHaveCount(2);
  const both = Number((await page.getByTestId("exercise-count").innerText()).split(" ")[0]);
  await page.getByRole("button", { name: "Remove Triceps" }).click();
  await expect(chosen(page)).toHaveCount(1);
  const chest = Number((await page.getByTestId("exercise-count").innerText()).split(" ")[0]);
  expect(both).toBeGreaterThan(chest);
  expect(chest).toBeGreaterThan(80); // the chest has 84 exercises with it as the main muscle, and more with it as a secondary one
  await sideButton(page, "Back").click(); // turning the body does not lose the choice
  await expect(chosen(page)).toHaveCount(1);
  await page.getByRole("button", { name: "Remove Chest" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Pick a muscle" })).toBeVisible();
});

test("the list has page numbers; search and equipment narrow it down", async ({ page }) => {
  await login(page, "A");
  await openTraining(page);
  await pick(page, "Quads");
  await expect(rows(page)).toHaveCount(20);
  const first = await rows(page).first().innerText();
  const nav = page.getByRole("navigation", { name: "Result pages" });
  await expect(nav).toBeVisible();
  await nav.getByRole("button", { name: "Page 2" }).click();
  await expect(rows(page).first()).not.toHaveText(first);
  await expect(nav.getByRole("button", { name: "Page 2" })).toHaveAttribute("aria-current", "page");

  await page.getByLabel("Search exercises").fill("barbell squat");
  await expect(nav).toHaveCount(0);
  await expect(rows(page).first()).toContainText("Squat");
  await page.getByLabel("Equipment").selectOption("kettlebells");
  await expect(page.getByText("No exercises")).toBeVisible();
  await page.getByLabel("Equipment").selectOption("");
  await page.getByLabel("Search exercises").fill("squat");
  const all = Number((await page.getByTestId("exercise-count").innerText()).split(" ")[0]);
  await page.getByLabel("Level").selectOption("beginner");
  await expect(page.getByTestId("exercise-count")).not.toHaveText(`${all} exercises`);
  const beginners = Number((await page.getByTestId("exercise-count").innerText()).split(" ")[0]);
  expect(beginners).toBeLessThan(all);
  await page.getByLabel("Equipment").selectOption("dumbbell"); // both filters together
  await expect(rows(page).first()).toContainText("Dumbbell");
  await page.getByLabel("Level").selectOption("");
  await page.getByLabel("Equipment").selectOption("");
  await page.getByLabel("Search exercises").fill("");
  await expect(nav).toBeVisible();
});

test("an exercise opens with its photos, muscles and steps", async ({ page }) => {
  await login(page, "A");
  await openTraining(page);
  await pick(page, "Chest");
  await page.getByLabel("Search exercises").fill("dumbbell flyes");
  await page.getByRole("button", { name: "Open Dumbbell Flyes", exact: true }).click();
  const sheet = page.locator('[data-slot="sheet-content"]');
  await expect(sheet.getByText("Dumbbell Flyes")).toBeVisible();
  await expect(sheet.getByTestId("exercise-photos").locator("img")).toHaveCount(2);
  await expect(sheet.getByTestId("exercise-muscles")).toHaveText("Chest");
  await expect(sheet.getByRole("listitem").first()).toBeVisible();
  // a secondary muscle is named as such
  await page.keyboard.press("Escape");
  await page.getByLabel("Search exercises").fill("pushups");
  await page.getByRole("button", { name: "Open Pushups", exact: true }).click();
  await expect(sheet.getByTestId("exercise-muscles")).toContainText("Triceps (secondary)");
});

test("a workout is put together, saved, found in Workouts, edited and deleted", async ({ page }) => {
  await login(page, "A");
  await openTraining(page);
  await pick(page, "Chest");
  await page.getByLabel("Search exercises").fill("bench press - medium");
  await page.getByRole("button", { name: `Open ${BENCH.name}`, exact: true }).click();
  await page.getByRole("button", { name: "Add to workout" }).click();
  const bar = page.getByRole("button", { name: /^Workout · 1 exercise$/ });
  await expect(bar).toBeVisible();
  await expect(page.getByRole("button", { name: `Open ${BENCH.name}`, exact: true }).getByText("In workout")).toBeVisible();

  await page.getByLabel("Search exercises").fill("dumbbell flyes");
  await page.getByRole("button", { name: `Open ${FLYES.name}`, exact: true }).click();
  await page.getByRole("button", { name: "Add to workout" }).click();
  await page.getByRole("button", { name: /^Workout · 2 exercises$/ }).click();

  const sheet = page.locator('[data-slot="sheet-content"]');
  await expect(sheet.getByRole("button", { name: "Save workout" })).toBeDisabled();
  await expect(sheet.getByRole("status").filter({ hasText: "Name required" })).toBeVisible();
  await sheet.getByRole("button", { name: `Move ${FLYES.name} up` }).click(); // fly first, then bench
  await expect(sheet.getByTestId("draft-list").getByRole("listitem").first()).toContainText(FLYES.name);
  await sheet.getByLabel("Workout name").fill("  Chest day  ");
  await sheet.getByRole("button", { name: "Save workout" }).click();

  await expect(page.getByText("Workout saved")).toBeVisible();
  await expect(page.getByRole("button", { name: "Open Chest day" })).toBeVisible(); // the Workouts view
  const [saved] = await fetchWorkouts("A");
  expect(saved).toMatchObject({ name: "Chest day", times_used: 0, exercises: [FLYES, BENCH] });

  // edit: name and one exercise less
  await page.getByRole("button", { name: "Open Chest day" }).click();
  await expect(page.locator('[data-slot="sheet-content"]').getByText("2 exercises")).toBeVisible();
  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByRole("button", { name: /^Editing Chest day · 2 exercises$/ }).click();
  await sheet.getByRole("button", { name: `Remove ${BENCH.name} from workout` }).click();
  await sheet.getByLabel("Workout name").fill("Chest light");
  await sheet.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("button", { name: "Open Chest light" })).toBeVisible();
  await expect.poll(async () => (await fetchWorkouts("A"))[0]?.name).toBe("Chest light");
  expect((await fetchWorkouts("A"))[0]!.exercises).toEqual([FLYES]);

  // delete asks first
  await page.getByRole("button", { name: "Open Chest light" }).click();
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Delete this workout?")).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  expect(await fetchWorkouts("A")).toHaveLength(1);
  await page.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Delete" }).last().click();
  await expect(page.getByText("No workouts yet")).toBeVisible();
  expect(await fetchWorkouts("A")).toHaveLength(0);
});

test("a workout name already saved is refused inline", async ({ page }) => {
  await seedWorkout("A", { name: "Back day", exercises: [CURL] });
  await login(page, "A");
  await openTraining(page);
  await pick(page, "Biceps");
  await page.getByRole("button", { name: `Open ${CURL.name}`, exact: true }).click();
  await page.getByRole("button", { name: "Add to workout" }).click();
  await page.getByRole("button", { name: /^Workout · 1 exercise$/ }).click();
  const sheet = page.locator('[data-slot="sheet-content"]');
  await sheet.getByLabel("Workout name").fill("back day");
  await sheet.getByRole("button", { name: "Save workout" }).click();
  await expect(sheet.getByRole("alert").filter({ hasText: "Workout name already saved" })).toBeVisible();
  expect(await fetchWorkouts("A")).toHaveLength(1);
});

test("Today: Add training with a saved workout marks it done, counts its use, and can be undone", async ({ page }) => {
  const workout = await seedWorkout("A", { name: "Chest day", exercises: [BENCH, FLYES] });
  await login(page, "A");
  await page.goto(`/?d=${DAY}`);
  await expect(page.getByTestId("day-label")).toBeVisible();
  await expect(page.getByTestId("training-count")).toHaveText("—");
  await page.getByRole("link", { name: "Add training" }).click();
  await expect(page).toHaveURL(new RegExp(`/training/add\\?d=${DAY}`));
  await expect(page.getByRole("heading", { name: "Add training" })).toBeVisible();

  await page.getByRole("button", { name: "Choose Chest day" }).click();
  const sheet = page.locator('[data-slot="sheet-content"]');
  await expect(sheet.getByLabel("Date")).toHaveValue(DAY);
  await sheet.getByRole("button", { name: "Add to diary" }).click();
  await expect(page.getByText(/Chest day added to/)).toBeVisible();

  const [entry] = await fetchTrainings("A", DAY);
  expect(entry).toMatchObject({ name: "Chest day", saved_workout_id: workout.id, exercises: [BENCH, FLYES] });
  expect((await fetchWorkouts("A"))[0]).toMatchObject({ times_used: 1 });

  await page.getByRole("button", { name: "View day" }).click();
  await expect(page.getByTestId("training-count")).toHaveText("1 done");
  await page.getByRole("button", { name: "Chest day, 2 exercises" }).click(); // expands
  await expect(page.getByTestId("training-row").getByText(FLYES.name)).toBeVisible();
  await page.getByRole("button", { name: "Remove Chest day" }).click();
  await expect(page.getByTestId("training-count")).toHaveText("—");
  await expect.poll(async () => (await fetchWorkouts("A"))[0]?.times_used).toBe(0);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByTestId("training-count")).toHaveText("1 done");
  await expect.poll(async () => (await fetchWorkouts("A"))[0]?.times_used).toBe(1);
});

test("Add training with a new workout: the star keeps it, no star only logs it", async ({ page }) => {
  await login(page, "A");
  await page.goto(`/training/add?d=${DAY}`);
  await expect(page.getByText("No workouts yet")).toBeVisible();

  async function newWorkout(name: string, star: boolean) {
    await page.getByRole("button", { name: "New workout" }).click();
    await page.getByText("By name").click();
    await muscle(page, "Biceps").click();
    await page.getByRole("button", { name: `Open ${CURL.name}`, exact: true }).click();
    await page.getByRole("button", { name: "Add to workout" }).click();
    await page.getByRole("button", { name: /^Workout · 1 exercise$/ }).click();
    const sheet = page.locator('[data-slot="sheet-content"]');
    await sheet.getByLabel("Workout name").fill(name);
    if (!star) await sheet.getByRole("button", { name: "Save to favorites" }).click();
    await expect(sheet.getByRole("button", { name: "Save to favorites" })).toHaveAttribute("aria-pressed", String(star));
    await sheet.getByRole("button", { name: "Add to diary" }).click();
    await expect(page.getByText(new RegExp(`${name} added to`))).toBeVisible();
  }

  await newWorkout("Arms A", false);
  expect(await fetchWorkouts("A")).toHaveLength(0); // nothing kept
  expect((await fetchTrainings("A", DAY))[0]).toMatchObject({ name: "Arms A", saved_workout_id: null });

  await newWorkout("Arms B", true);
  const [kept] = await fetchWorkouts("A");
  expect(kept).toMatchObject({ name: "Arms B", times_used: 1, exercises: [CURL] });
  expect((await fetchTrainings("A", DAY))[1]).toMatchObject({ name: "Arms B", saved_workout_id: kept!.id });
  await expect(page.getByRole("button", { name: "Choose Arms B" })).toBeVisible(); // now in the list
});

test("the saved workouts open on the five most used", async ({ page }) => {
  for (let i = 1; i <= 7; i++) await seedWorkout("A", { name: `Workout ${i}`, exercises: [CURL], times_used: i });
  await login(page, "A");
  await page.goto(`/training/add?d=${DAY}`);
  const list = page.getByTestId("saved-workouts").getByRole("listitem");
  await expect(page.getByRole("heading", { name: "Most used" })).toBeVisible();
  await expect(list).toHaveCount(5);
  await expect(list.first()).toContainText("Workout 7");
  await page.getByRole("button", { name: "Show all · 7" }).click();
  await expect(list).toHaveCount(7);
  await page.getByRole("button", { name: "Show less" }).click();
  await expect(list).toHaveCount(5);
});

test("a failed save shows an error and nothing is shown as saved", async ({ page }) => {
  await login(page, "A");
  await openTraining(page);
  await pick(page, "Biceps");
  await page.getByRole("button", { name: `Open ${CURL.name}`, exact: true }).click();
  await page.getByRole("button", { name: "Add to workout" }).click();
  await page.getByRole("button", { name: /^Workout · 1 exercise$/ }).click();
  const sheet = page.locator('[data-slot="sheet-content"]');
  await sheet.getByLabel("Workout name").fill("Offline");
  await page.route("**/rest/v1/saved_workouts*", (route) => (route.request().method() === "POST" ? route.abort() : route.continue()));
  await sheet.getByRole("button", { name: "Save workout" }).click();
  await expect(page.getByText("No connection. Not saved")).toBeVisible();
  expect(await fetchWorkouts("A")).toHaveLength(0);
});

test("one user never sees another user's workouts or trainings, and cannot link to them", async ({ page }) => {
  const mine = await seedWorkout("A", { name: "Secret day", exercises: [BENCH] });
  await login(page, "A");
  await page.goto(`/training/add?d=${DAY}`);
  await page.getByRole("button", { name: "Choose Secret day" }).click();
  await page.locator('[data-slot="sheet-content"]').getByRole("button", { name: "Add to diary" }).click();
  await expect(page.getByText(/Secret day added to/)).toBeVisible();
  await page.goto("/profile");
  await openProfile(page);
  await logout(page);

  await login(page, "B");
  await page.goto(`/training/add?d=${DAY}`);
  await expect(page.getByText("No workouts yet")).toBeVisible();
  await page.goto(`/?d=${DAY}`);
  await expect(page.getByTestId("training-count")).toHaveText("—");
  expect(await fetchWorkouts("B")).toHaveLength(0);
  expect(await fetchTrainings("B")).toHaveLength(0);

  // the database refuses a training of B that points at a workout of A
  const refused = await insertTrainingAs("B", { entry_date: DAY, name: "Sneaky", saved_workout_id: mine.id });
  expect(refused.error).not.toBeNull();
  expect(await fetchTrainings("B")).toHaveLength(0);
});

test("the Workouts view has New workout: it goes to the exercises with nothing in the workout", async ({ page }) => {
  await seedWorkout("A", { name: "Back day", exercises: [CURL] });
  await login(page, "A");
  await openTraining(page);
  await page.getByRole("group", { name: "Training view" }).getByRole("button", { name: "Workouts" }).click();
  await expect(page.getByRole("button", { name: "Open Back day" })).toBeVisible();
  await page.getByRole("button", { name: "New workout" }).click();
  await expect(page.getByRole("group", { name: "Training view" }).getByRole("button", { name: "Exercises" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("status").filter({ hasText: "Pick a muscle" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Workout · / })).toHaveCount(0);
});
