import { expect, test } from "@playwright/test";
import { cacheHasQuery, cacheKeys, clearCache, login, logout, openProfile } from "./helpers";

test("data is cached in IndexedDB and falls back to the DB when the cache is empty", async ({ page }) => {
  await login(page, "A");
  await openProfile(page);
  await expect(page.getByTestId("profile-summary")).toBeVisible();
  await expect.poll(() => cacheHasQuery(page, "profile")).toBe(true);

  // Cache-first: with the DB blocked, the cached profile is still shown after a reload.
  await page.route("**/rest/v1/profiles*", (route) => route.abort());
  await page.reload();
  await expect(page.getByTestId("profile-summary")).toContainText("kcal");
  await page.unroute("**/rest/v1/profiles*");

  // Fallback: empty cache + DB blocked => error; empty cache + DB available => data.
  await clearCache(page);
  await page.route("**/rest/v1/profiles*", (route) => route.abort());
  await page.reload();
  // supabase-js retries failed GETs with backoff and TanStack retries once: the error takes ~16s.
  await expect(page.getByRole("alert").filter({ hasText: "perfil" })).toBeVisible({ timeout: 40_000 });
  await page.unroute("**/rest/v1/profiles*");
  await page.reload();
  await expect(page.getByTestId("profile-summary")).toContainText("kcal");
});

test("cache is isolated per user and cleared on logout", async ({ page }) => {
  await login(page, "A");
  await openProfile(page);
  await expect(page.getByTestId("profile-summary")).toBeVisible();
  await expect.poll(() => cacheKeys(page)).toHaveLength(1);
  const [keyA] = await cacheKeys(page);

  await logout(page);
  expect(await cacheKeys(page)).toHaveLength(0);

  await login(page, "B");
  await openProfile(page);
  await expect(page.getByTestId("profile-summary")).toBeVisible();
  await expect.poll(() => cacheKeys(page)).toHaveLength(1);
  const [keyB] = await cacheKeys(page);
  expect(keyB).not.toBe(keyA);
});
