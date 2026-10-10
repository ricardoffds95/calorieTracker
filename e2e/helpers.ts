import { expect, type Page } from "@playwright/test";

export type TestUser = "A" | "B";

export function credentials(user: TestUser) {
  const email = process.env[`E2E_USER_${user}_EMAIL`];
  const password = process.env[`E2E_USER_${user}_PASSWORD`];
  if (!email || !password) throw new Error(`Missing E2E_USER_${user}_* in .env.local`);
  return { email, password };
}

export async function login(page: Page, user: TestUser) {
  const { email, password } = credentials(user);
  await page.goto("/login");
  // Wait for React to hydrate, otherwise the click submits the form natively.
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("navigation", { name: "Navegação principal" })).toBeVisible();
}

/** Signs in and waits to be away from /login, wherever the app sends the user (e.g. the questionnaire has no tab bar). */
export async function signIn(page: Page, user: TestUser) {
  const { email, password } = credentials(user);
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

export async function openProfile(page: Page) {
  await page.getByRole("link", { name: "Perfil" }).click();
  await expect(page).toHaveURL(/\/perfil/);
}

export async function logout(page: Page) {
  // "Sair" is inside "Gerir perfil", which starts closed
  if (!(await page.getByRole("button", { name: "Sair" }).isVisible())) await page.getByRole("button", { name: /Gerir perfil/ }).click();
  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/login/);
}

/** Keys stored by idb-keyval (default DB "keyval-store"/"keyval"). */
export async function cacheKeys(page: Page): Promise<string[]> {
  return page.evaluate(
    () =>
      new Promise<string[]>((resolve, reject) => {
        const open = indexedDB.open("keyval-store");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains("keyval")) return resolve([]);
          const req = db.transaction("keyval").objectStore("keyval").getAllKeys();
          req.onsuccess = () => resolve(req.result.map(String));
          req.onerror = () => reject(req.error);
        };
      }),
  );
}

export async function clearCache(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("keyval-store");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains("keyval")) return resolve();
          const tx = db.transaction("keyval", "readwrite");
          tx.objectStore("keyval").clear();
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
}

/** True once the persisted cache contains a query whose key starts with `queryName`. */
export async function cacheHasQuery(page: Page, queryName: string): Promise<boolean> {
  return page.evaluate(
    (name) =>
      new Promise<boolean>((resolve, reject) => {
        const open = indexedDB.open("keyval-store");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains("keyval")) return resolve(false);
          const req = db.transaction("keyval").objectStore("keyval").getAll();
          req.onsuccess = () =>
            resolve(
              req.result.some((client: { clientState?: { queries?: { queryKey: unknown[] }[] } }) =>
                client.clientState?.queries?.some((q) => q.queryKey[0] === name),
              ),
            );
          req.onerror = () => reject(req.error);
        };
      }),
    queryName,
  );
}
