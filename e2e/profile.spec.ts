import { expect, test, type Page } from "@playwright/test";
import { clearCache, login, logout, openProfile } from "./helpers";
import { fetchProfile } from "./seed";

const calories = (page: Page) => page.getByLabel("Daily calories", { exact: true });
const pct = (page: Page, macro: "Protein" | "Carbs" | "Fat") => page.getByLabel(`${macro} %`, { exact: true });
const grams = (page: Page, macro: "Protein" | "Carbs" | "Fat") => page.getByLabel(`${macro} (g)`, { exact: true });
const save = (page: Page) => page.getByRole("button", { name: /Save goals|Saving/ });
const summary = (page: Page) => page.getByTestId("profile-summary");
const total = (page: Page) => page.getByTestId("macro-total");

async function openProfileForm(page: Page, user: "A" | "B" = "A") {
  await login(page, user);
  await openProfile(page);
  await expect(save(page)).toBeVisible();
}

/** Puts the profile back to the defaults (maintain, 2000 kcal) through the UI. */
async function resetProfile(page: Page) {
  await page.goto("/profile");
  await expect(save(page)).toBeVisible();
  // through another mode and back, so the percentages and grams return to the maintain preset
  await page.getByRole("radio", { name: /Lose weight/ }).check({ force: true });
  await page.getByRole("radio", { name: /Maintain weight/ }).check({ force: true });
  await calories(page).fill("2000");
  if (await save(page).isEnabled()) {
    await save(page).click();
    await expect(page.getByText("Goals saved")).toBeVisible();
  }
  await expect(summary(page)).toContainText("Maintain weight · 2000 kcal");
}

test("shows the default goals", async ({ page }) => {
  await openProfileForm(page);
  await expect(calories(page)).toHaveValue("2000");
  await expect(pct(page, "Protein")).toHaveValue("30");
  await expect(pct(page, "Carbs")).toHaveValue("40");
  await expect(pct(page, "Fat")).toHaveValue("30");
  await expect(total(page)).toHaveText("Total: 100% · 2000 kcal");
  // the percentage and the grams of each macro sit on the same row
  for (const macro of ["Protein", "Carbs", "Fat"] as const) {
    const [a, b] = [await pct(page, macro).boundingBox(), await grams(page, macro).boundingBox()];
    expect(Math.abs(a!.y - b!.y)).toBeLessThan(6);
    expect(b!.x).toBeGreaterThan(a!.x);
  }
  await expect(grams(page, "Protein")).toHaveValue("150");
  await expect(grams(page, "Carbs")).toHaveValue("200");
  await expect(grams(page, "Fat")).toHaveValue("67");
  await expect(save(page)).toBeDisabled(); // nothing changed yet
});

test("changing goal and calories updates the preview, saves, and survives reload and an empty cache", async ({ page }) => {
  await openProfileForm(page);
  try {
    await page.getByRole("radio", { name: /Lose weight/ }).check({ force: true });
    await expect(pct(page, "Protein")).toHaveValue("40");
    await expect(pct(page, "Carbs")).toHaveValue("30");
    await expect(pct(page, "Fat")).toHaveValue("30");

    await calories(page).fill("2400");
    await expect(total(page)).toContainText("2400 kcal");
    await expect(grams(page, "Protein")).toHaveValue("240");
    await expect(grams(page, "Carbs")).toHaveValue("180");
    await expect(grams(page, "Fat")).toHaveValue("80");

    await save(page).click();
    await expect(page.getByText("Goals saved")).toBeVisible();
    await expect(summary(page)).toContainText("Lose weight · 2400 kcal");
    await expect(save(page)).toBeDisabled();

    // cache-first
    await page.reload();
    await expect(summary(page)).toContainText("2400 kcal");
    await expect(calories(page)).toHaveValue("2400");
    await expect(page.getByRole("radio", { name: /Lose weight/ })).toBeChecked();

    // DB fallback: empty cache
    await clearCache(page);
    await page.reload();
    await expect(calories(page)).toHaveValue("2400");
    await expect(pct(page, "Protein")).toHaveValue("40");
  } finally {
    await resetProfile(page);
  }
});

test("the grams are editable too: calories and percentages follow, and the exact grams are saved", async ({ page }) => {
  await openProfileForm(page);
  try {
    await grams(page, "Protein").fill("180");
    // 180 g × 4 + 200 g × 4 + 67 g × 9 = 2123 kcal
    await expect(calories(page)).toHaveValue("2123");
    await expect(page.getByTestId("macro-total")).toContainText("Total: 100%");
    await expect(pct(page, "Protein")).toHaveValue("34");
    await expect(total(page)).toContainText("2123 kcal");

    await grams(page, "Fat").fill("72");
    await expect(calories(page)).toHaveValue("2168");

    await save(page).click();
    await expect(page.getByText("Goals saved")).toBeVisible();
    await expect(summary(page)).toContainText("2168 kcal");
    await page.reload();
    await expect(grams(page, "Protein")).toHaveValue("180");
    await expect(grams(page, "Carbs")).toHaveValue("200");
    await expect(grams(page, "Fat")).toHaveValue("72");
    await expect(calories(page)).toHaveValue("2168");

    // calories still drive the grams (keeping the percentages)
    await calories(page).fill("2000");
    await expect(grams(page, "Protein")).toHaveValue(String(Math.round((2000 * Number(await pct(page, "Protein").inputValue())) / 100 / 4)));

    // a grams field that is not a whole number says so and blocks saving
    await grams(page, "Carbs").fill("12.5");
    await expect(page.getByRole("alert").filter({ hasText: "Whole grams only" })).toBeVisible();
    await expect(save(page)).toBeDisabled();
  } finally {
    await resetProfile(page);
  }
});

test("validates calories and the percentage total", async ({ page }) => {
  await openProfileForm(page);

  await calories(page).fill("400");
  await expect(page.getByRole("alert").filter({ hasText: "Min 500 kcal" })).toBeVisible();
  await expect(save(page)).toBeDisabled();

  await calories(page).fill("10001");
  await expect(page.getByRole("alert").filter({ hasText: "Max 10000 kcal" })).toBeVisible();
  await expect(save(page)).toBeDisabled();

  await calories(page).fill("");
  await expect(save(page)).toBeDisabled();
  await calories(page).fill("2000");

  await pct(page, "Protein").fill("35");
  await expect(page.getByTestId("macro-total")).toHaveText(/Total: 105% · Must total 100%/);
  await expect(save(page)).toBeDisabled();
  await page.getByRole("button", { name: "Decrease Protein %" }).click();
  await expect(pct(page, "Protein")).toHaveValue("30");
  await expect(page.getByTestId("macro-total")).toContainText("Total: 100%");
});

test("the +/- buttons step and respect the limits", async ({ page }) => {
  await openProfileForm(page);
  await page.getByRole("button", { name: "Increase Daily calories" }).click();
  await expect(calories(page)).toHaveValue("2050");
  await page.getByRole("button", { name: "Decrease Daily calories" }).click();
  await expect(calories(page)).toHaveValue("2000");

  await calories(page).fill("520");
  await page.getByRole("button", { name: "Decrease Daily calories" }).click();
  await expect(calories(page)).toHaveValue("500");
  await calories(page).fill("9990");
  await page.getByRole("button", { name: "Increase Daily calories" }).click();
  await expect(calories(page)).toHaveValue("10000");

  await pct(page, "Fat").fill("3");
  await page.getByRole("button", { name: "Decrease Fat %" }).click();
  await expect(pct(page, "Fat")).toHaveValue("0");
});

test("a failed save shows an error and does not pretend it was saved", async ({ page }) => {
  await openProfileForm(page);
  await calories(page).fill("2100");
  await page.route("**/rest/v1/profiles*", (route) => (route.request().method() === "PATCH" ? route.abort() : route.continue()));
  await save(page).click();
  await expect(page.getByText("No connection. Not saved")).toBeVisible();
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

test.describe("unsaved changes", () => {
  test("leaving with edits asks what to do: keep editing", async ({ page }) => {
    await openProfileForm(page);
    await calories(page).fill("2300");
    await page.getByRole("link", { name: "History" }).click();
    const dialog = page.getByRole("dialog", { name: "Save changes?" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Keep editing" }).click();
    await expect(page).toHaveURL(/\/profile$/);
    await expect(calories(page)).toHaveValue("2300"); // nothing was lost
    expect((await fetchProfile("A")).goal_calories).toBe(2000);
    await calories(page).fill("2000"); // back to the saved value: no longer "changed", no question
    await page.getByRole("link", { name: "History" }).click();
    await expect(page).toHaveURL(/\/history/);
  });

  test("leaving with edits: discard drops them", async ({ page }) => {
    await openProfileForm(page);
    await calories(page).fill("2300");
    await page.getByRole("link", { name: "Today" }).click();
    await page.getByRole("button", { name: "Discard" }).click();
    await expect(page).toHaveURL(/\/$/);
    expect((await fetchProfile("A")).goal_calories).toBe(2000);
    await openProfile(page);
    await expect(calories(page)).toHaveValue("2000");
  });

  test("leaving with edits: save stores them and goes on", async ({ page }) => {
    await openProfileForm(page);
    try {
      await calories(page).fill("2300");
      await page.getByRole("link", { name: "Saved" }).click();
      await page.getByRole("dialog", { name: "Save changes?" }).getByRole("button", { name: "Save", exact: true }).click();
      await expect(page).toHaveURL(/\/saved$/);
      await expect.poll(async () => (await fetchProfile("A")).goal_calories).toBe(2300);
    } finally {
      await resetProfile(page);
    }
  });

  test("with errors in the form it cannot be saved from the question", async ({ page }) => {
    await openProfileForm(page);
    await calories(page).fill("400");
    await page.getByRole("link", { name: "History" }).click();
    const dialog = page.getByRole("dialog", { name: "Save changes?" });
    await expect(dialog.getByRole("status")).toContainText("Fix the errors");
    await expect(dialog.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
    await dialog.getByRole("button", { name: "Discard" }).click();
    await expect(page).toHaveURL(/\/history/);
  });
});
