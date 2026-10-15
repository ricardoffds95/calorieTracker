import { expect, test, type Page } from "@playwright/test";
import { credentials, login, logout, openProfile } from "./helpers";
import { fetchProfile, resetProfileRow, restorePassword } from "./seed";

test.beforeEach(() => resetProfileRow("A", { onboardingDone: true }));
test.afterAll(() => resetProfileRow("A", { onboardingDone: true }));

const menuButton = (page: Page) => page.getByRole("button", { name: "Account menu" });
// the sheet changes its title with the view (Settings, User data…), so it is found by its slot, not by name
const sheet = (page: Page) => page.locator('[data-slot="sheet-content"]');

async function openMenu(page: Page, user: "A" | "B" = "A") {
  await login(page, user);
  await openProfile(page);
  await menuButton(page).click();
  await expect(sheet(page)).toBeVisible();
}

test("the account menu is the picture in the top corner of the Profile, with the four options", async ({ page }) => {
  await login(page, "A");
  await openProfile(page);
  const box = (await menuButton(page).boundingBox())!;
  expect(box.y).toBeLessThan(120);
  expect(box.x).toBeGreaterThan(page.viewportSize()!.width / 2); // on the right
  await expect(page.getByTestId("manage-profile")).toHaveCount(0); // the old card is gone
  await expect(page.getByTestId("profile-summary")).toContainText("Maintain weight · 2000 kcal");

  await menuButton(page).click();
  for (const name of ["Change icon", "Settings", "User data", "Log out"]) {
    await expect(sheet(page).getByRole("button", { name })).toBeVisible();
  }
});

test("the icon can be changed (6 choices) and stays after a reload", async ({ page }) => {
  await openMenu(page);
  await sheet(page).getByRole("button", { name: "Change icon" }).click();
  const choices = sheet(page).getByRole("radio");
  await expect(choices).toHaveCount(10);
  await expect(sheet(page).getByRole("radio", { name: "Flame" })).toHaveAttribute("aria-checked", "false");
  await sheet(page).getByRole("radio", { name: "Flame" }).click();
  await expect(page.getByText("Icon saved")).toBeVisible();
  await expect.poll(async () => (await fetchProfile("A")).avatar).toBe("icon-flame");

  await sheet(page).getByRole("radio", { name: "Photo 2" }).click();
  await expect.poll(async () => (await fetchProfile("A")).avatar).toBe("photo-2");

  await page.reload();
  await expect(menuButton(page).locator("img")).toHaveAttribute("src", "/avatars/photo-2.png");
  await menuButton(page).click();
  await sheet(page).getByRole("button", { name: "Change icon" }).click();
  await expect(sheet(page).getByRole("radio", { name: "Photo 2" })).toHaveAttribute("aria-checked", "true");
});

test("Settings: the name is saved, the email is shown", async ({ page }) => {
  await openMenu(page);
  await sheet(page).getByRole("button", { name: "Settings" }).click();
  await expect(page.getByTestId("user-email")).toHaveText(credentials("A").email);
  await sheet(page).getByLabel("Name", { exact: true }).fill("Name E2E");
  await sheet(page).getByRole("form", { name: "Name form" }).getByRole("button", { name: "Save" }).click();
  await expect.poll(async () => (await fetchProfile("A")).name).toBe("Name E2E");
  await sheet(page).getByRole("button", { name: "Back" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("profile-summary")).toContainText("Name E2E");
});

test("Settings: the new password must be long enough and repeated; changing it works", async ({ page }) => {
  const temporary = "E2e-temporary-pass-1";
  await openMenu(page, "B");
  try {
    await sheet(page).getByRole("button", { name: "Settings" }).click();
    const change = sheet(page).getByRole("button", { name: "Change password" });
    await expect(change).toBeDisabled();
    await sheet(page).getByLabel("Password", { exact: true }).fill("short");
    await expect(sheet(page).getByRole("status")).toContainText("Min 8 characters");
    await sheet(page).getByLabel("Password", { exact: true }).fill(temporary);
    await sheet(page).getByLabel("Repeat password").fill("something-else-1");
    await expect(sheet(page).getByRole("status")).toContainText("Passwords differ");
    await expect(change).toBeDisabled();
    await sheet(page).getByLabel("Repeat password").fill(temporary);
    await expect(change).toBeEnabled();
    await change.click();
    await expect(page.getByText("Password changed")).toBeVisible();
    await expect(sheet(page).getByLabel("Password", { exact: true })).toHaveValue("");
  } finally {
    await restorePassword("B", temporary);
  }
});

test("Settings: an email that is not one is refused before asking Supabase", async ({ page }) => {
  await openMenu(page);
  await sheet(page).getByRole("button", { name: "Settings" }).click();
  await sheet(page).getByPlaceholder("New email").fill("not-an-email");
  await sheet(page).getByRole("button", { name: "Change", exact: true }).click();
  await expect(sheet(page).getByRole("alert").filter({ hasText: "Invalid email" })).toBeVisible();
});

test("Settings: deleting the account needs the word 'delete'; Cancel keeps everything", async ({ page }) => {
  await openMenu(page);
  await sheet(page).getByRole("button", { name: "Settings" }).click();
  await sheet(page).getByRole("button", { name: "Delete account" }).click();
  const dialog = page.getByRole("dialog", { name: "Delete account?" });
  const confirm = dialog.getByRole("button", { name: "Delete forever" });
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel(/Type/).fill("delet");
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel(/Type/).fill("Delete");
  await expect(confirm).toBeEnabled();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(/\/profile/);
});

test("Settings: confirming the deletion calls the function, clears the session and goes to the login", async ({ page }) => {
  let called = false;
  await page.route("**/rest/v1/rpc/delete_my_account", (route) => {
    called = true;
    return route.fulfill({ status: 204, body: "" });
  });
  await openMenu(page);
  await sheet(page).getByRole("button", { name: "Settings" }).click();
  await sheet(page).getByRole("button", { name: "Delete account" }).click();
  const dialog = page.getByRole("dialog", { name: "Delete account?" });
  await dialog.getByLabel(/Type/).fill("delete");
  await dialog.getByRole("button", { name: "Delete forever" }).click();
  await expect(page).toHaveURL(/\/login/);
  expect(called).toBe(true);
});

test("a failed deletion says so and keeps the account", async ({ page }) => {
  await page.route("**/rest/v1/rpc/delete_my_account", (route) => route.fulfill({ status: 500, json: { message: "boom" } }));
  await openMenu(page);
  await sheet(page).getByRole("button", { name: "Settings" }).click();
  await sheet(page).getByRole("button", { name: "Delete account" }).click();
  const dialog = page.getByRole("dialog", { name: "Delete account?" });
  await dialog.getByLabel(/Type/).fill("delete");
  await dialog.getByRole("button", { name: "Delete forever" }).click();
  await expect(dialog.getByRole("alert").filter({ hasText: "Couldn’t delete" })).toBeVisible();
  await expect(page).toHaveURL(/\/profile/);
});

test("User data: the personal data is edited by hand and saved", async ({ page }) => {
  await openMenu(page);
  await sheet(page).getByRole("button", { name: "User data" }).click();
  await page.getByRole("button", { name: "Female", exact: true }).click();
  await page.getByLabel("Age").fill("33");
  await page.getByLabel("Height (cm)").fill("168");
  await page.getByLabel("Weight (kg)").fill("61,5");
  await page.getByLabel("Body fat %").fill("24");
  await expect(page.getByLabel("Lean mass %")).toHaveValue("76");
  await page.getByRole("button", { name: /^Active/ }).click();
  await page.getByRole("button", { name: "Increase Aerobic sessions per week" }).click();
  await page.getByRole("button", { name: /^Moderate/ }).click();
  await page.getByLabel("Training notes (optional)").fill("Corrida 5 km ao sábado");
  await page.getByRole("button", { name: "Save data" }).click();
  await expect(page.getByText("Data saved")).toBeVisible();
  expect(await fetchProfile("A")).toMatchObject({
    sex: "female",
    age: 33,
    height_cm: 168,
    weight_kg: 61.5,
    body_fat_pct: 24,
    daily_activity: "active",
    aerobic_sessions_per_week: 1,
    training_intensity: "moderate",
    training_notes: "Corrida 5 km ao sábado",
    goal_calories: 2000, // the goals are untouched
  });
  await expect(page.getByRole("button", { name: "Save data" })).toBeDisabled();

  // clearing a field stores nothing for it; a wrong value says what is wrong
  await page.getByLabel("Weight (kg)").fill("");
  await page.getByRole("button", { name: "Save data" }).click();
  await expect.poll(async () => (await fetchProfile("A")).weight_kg).toBeNull();
  await page.getByLabel("Age").fill("5");
  await expect(page.getByRole("status").filter({ hasText: "Min age 14" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save data" })).toBeDisabled();
});

test("User data: going back or closing with edits asks to save; the saved data is there after a reload", async ({ page }) => {
  await openMenu(page);
  await sheet(page).getByRole("button", { name: "User data" }).click();
  await page.getByLabel("Age").fill("41");

  await sheet(page).getByRole("button", { name: "Back" }).click();
  const ask = page.getByRole("dialog", { name: "Save changes?" });
  await expect(ask).toBeVisible();
  await ask.getByRole("button", { name: "Keep editing" }).click();
  await expect(page.getByLabel("Age")).toHaveValue("41"); // nothing lost

  await page.keyboard.press("Escape");
  await expect(ask).toBeVisible();
  await ask.getByRole("button", { name: "Save", exact: true }).click();
  await expect.poll(async () => (await fetchProfile("A")).age).toBe(41);
  await expect(sheet(page)).toHaveCount(0);

  await page.reload();
  await menuButton(page).click();
  await sheet(page).getByRole("button", { name: "User data" }).click();
  await expect(page.getByLabel("Age")).toHaveValue("41");

  // edits that are dropped really are
  await page.getByLabel("Age").fill("55");
  await sheet(page).getByRole("button", { name: "Back" }).click();
  await page.getByRole("dialog", { name: "Save changes?" }).getByRole("button", { name: "Discard" }).click();
  await expect(sheet(page).getByRole("button", { name: "User data" })).toBeVisible();
  expect((await fetchProfile("A")).age).toBe(41);
});

test("Log out is in the menu", async ({ page }) => {
  await login(page, "A");
  await openProfile(page);
  await logout(page);
});
