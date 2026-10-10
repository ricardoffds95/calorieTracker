import { defineConfig, devices } from "@playwright/test";

try {
  process.loadEnvFile(".env.local");
} catch {
  // CI may provide env vars directly
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "mobile-chromium", use: { ...devices["Pixel 7"] } }],
  webServer: {
    // Production build by default (stable timings); E2E_DEV=1 uses the dev server instead.
    command: process.env.E2E_DEV ? "npm run dev" : "npm run build && npm run start",
    url: "http://localhost:3000/login",
    reuseExistingServer: true,
    timeout: 240_000,
  },
});
