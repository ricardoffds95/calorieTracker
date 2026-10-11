import { expect, test } from "@playwright/test";
import { login } from "./helpers";

const TABS = [
  { name: "Today", url: /\/$/, heading: /^Today/ },
  { name: "Saved", url: /\/saved$/, heading: "Saved" },
  { name: "History", url: /\/history$/, heading: "History" },
  { name: "Profile", url: /\/profile$/, heading: "Profile" },
];

test("login page has no tab bar", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toHaveCount(0);
});

test("tabs navigate and mark the active one", async ({ page }) => {
  await login(page, "A");
  for (const tab of TABS) {
    await page.getByRole("link", { name: tab.name }).click();
    await expect(page).toHaveURL(tab.url);
    await expect(page.getByRole("heading", { level: 1, name: tab.heading })).toBeVisible();
    await expect(page.getByRole("link", { name: tab.name })).toHaveAttribute("aria-current", "page");
    await expect(page.locator('nav a[aria-current="page"]')).toHaveCount(1);
  }
});

test("there is no Registar tab: only 4 tabs", async ({ page }) => {
  await login(page, "A");
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  await expect(nav.getByRole("link")).toHaveText(["Today", "Saved", "History", "Profile"]);
});

test("page content is not hidden behind the tab bar", async ({ page }) => {
  await login(page, "A");
  await page.getByRole("link", { name: "Profile" }).click();
  const button = page.getByTestId("plan-card").getByRole("link"); // the last thing on the page
  await button.scrollIntoViewIfNeeded();
  const buttonBox = await button.boundingBox();
  const navBox = await page.getByRole("navigation", { name: "Main navigation" }).boundingBox();
  expect(buttonBox && navBox && buttonBox.y + buttonBox.height <= navBox.y).toBe(true);
});
