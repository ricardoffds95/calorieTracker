import { expect, test, type Page } from "@playwright/test";
import { login, signIn } from "./helpers";
import { fetchProfile, resetProfileRow } from "./seed";

// A new account: the questionnaire is shown on the first login. Every test starts with user A as "never answered"
// and leaves A with a clean, finished profile for the other specs.
test.beforeEach(() => resetProfileRow("A", { onboardingDone: false }));
test.afterEach(() => resetProfileRow("A", { onboardingDone: true }));
test.afterAll(() => resetProfileRow("A", { onboardingDone: true }));

const PLANS = {
  cut: { calories: 2300, protein_g: 160, carbs_g: 260, fat_g: 70 },
  maintain: { calories: 2600, protein_g: 150, carbs_g: 300, fat_g: 80 },
  bulk: { calories: 2800, protein_g: 150, carbs_g: 330, fat_g: 85 },
};
const PLAN = { plans: PLANS, summary: "Excedente pequeno para ganhar massa.", source: "ai" };

/** Mocks the plan endpoint and returns what the page sent. */
async function mockPlan(page: Page, answer: unknown = PLAN, status = 200) {
  const sent: { body?: Record<string, unknown> } = {};
  await page.route("**/api/ai/plan", (route) => {
    sent.body = route.request().postDataJSON();
    return route.fulfill({ status, json: answer });
  });
  return sent;
}

const next = (page: Page) => page.getByRole("button", { name: "Next" });

async function fillAboutYou(page: Page) {
  await page.getByRole("button", { name: "Male", exact: true }).click();
  await page.getByLabel("Age").fill("30");
  await page.getByLabel("Height (cm)").fill("180");
  await page.getByLabel("Weight (kg)").fill("80,5");
}

test("first login: the questionnaire, the AI plan, and the goals are saved", async ({ page }) => {
  const sent = await mockPlan(page);
  await signIn(page, "A");
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByRole("heading", { name: "Nutrition plan" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toHaveCount(0);

  // step 1: says what is missing, then lets go on
  await expect(next(page)).toBeDisabled();
  await expect(page.getByRole("status").filter({ hasText: "Sex required" })).toBeVisible();
  await fillAboutYou(page);
  await next(page).click();

  // step 2: optional, the two percentages follow each other
  await page.getByLabel("Body fat %").fill("18");
  await expect(page.getByLabel("Lean mass %")).toHaveValue("82");
  await page.getByLabel("Lean mass %").fill("80");
  await expect(page.getByLabel("Body fat %")).toHaveValue("20");
  await next(page).click();

  // step 3: the goal has to be chosen
  await expect(next(page)).toBeDisabled();
  await expect(page.getByRole("status").filter({ hasText: "Pick a goal" })).toBeVisible();
  await page.getByText("Gain muscle").click();
  await next(page).click();

  // step 4: the day-to-day (a desk job and a building site are not the same)
  await expect(next(page)).toBeDisabled();
  await expect(page.getByRole("status").filter({ hasText: "Pick daily activity" })).toBeVisible();
  await page.getByRole("button", { name: /^Very active/ }).click();
  await next(page).click();

  // step 5: the training
  await expect(next(page)).toHaveCount(0); // the last step has "Calculate", not "Next"
  await expect(page.getByRole("status").filter({ hasText: "Pick an intensity" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Calculate my plan" })).toBeDisabled();
  await page.getByRole("button", { name: "Increase Aerobic sessions per week" }).click(); // 2 → 3
  await page.getByRole("button", { name: "Decrease Anaerobic sessions per week" }).click(); // 2 → 1
  await page.getByRole("button", { name: /^Hard/ }).click();
  await page.getByLabel("Training notes (optional)").fill("Musculação 1x (1h) e corrida 3x de 5 km.");
  await page.getByRole("button", { name: "Calculate my plan" }).click();

  await expect(page.getByTestId("plan-calories")).toHaveText("2800"); // the goal chosen (bulk) is shown first
  await expect(page.getByTestId("plan-result")).toContainText("150 g");
  await expect(page.getByRole("button", { name: "Gain muscle (your goal)" })).toHaveAttribute("aria-pressed", "true");
  // the three plans are there to look at
  await page.getByRole("button", { name: "Lose weight" }).click();
  await expect(page.getByTestId("plan-calories")).toHaveText("2300");
  await page.getByRole("button", { name: "Maintain weight" }).click();
  await expect(page.getByTestId("plan-calories")).toHaveText("2600");
  await page.getByRole("button", { name: /^Gain muscle/ }).click();
  await expect(page.getByTestId("plan-calories")).toHaveText("2800");
  await expect(page.getByTestId("plan-result")).toContainText("Excedente pequeno para ganhar massa.");
  expect(sent.body).toEqual({
    sex: "male",
    age: 30,
    height_cm: 180,
    weight_kg: 80.5,
    body_fat_pct: 20,
    goal: "bulk",
    daily_activity: "very_active",
    aerobic_sessions: 3,
    anaerobic_sessions: 1,
    intensity: "high",
    notes: "Musculação 1x (1h) e corrida 3x de 5 km.",
  });

  await page.getByRole("button", { name: "Use this plan" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();

  await expect
    .poll(async () => (await fetchProfile("A")).goal_calories)
    .toBe(2800);
  expect(await fetchProfile("A")).toMatchObject({
    mode: "bulk",
    goal_protein: 150,
    goal_carbs: 330,
    goal_fat: 85,
    sex: "male",
    age: 30,
    height_cm: 180,
    weight_kg: 80.5,
    body_fat_pct: 20,
    aerobic_sessions_per_week: 3,
    anaerobic_sessions_per_week: 1,
    daily_activity: "very_active",
    training_intensity: "high",
    training_notes: "Musculação 1x (1h) e corrida 3x de 5 km.",
    plan_summary: "Excedente pequeno para ganhar massa.",
    saved_plans: PLANS, // all three are kept
  });
  expect((await fetchProfile("A")).onboarding_done_at).not.toBeNull();
  await expect(page.getByText(/2800 kcal/).first()).toBeVisible(); // the day screen uses the new goal
});

test("the questionnaire can be skipped: nothing changes and it does not come back", async ({ page }) => {
  await signIn(page, "A");
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByRole("button", { name: "Skip" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();

  const profile = await fetchProfile("A");
  expect(profile).toMatchObject({ goal_calories: 2000, goal_protein: 150, mode: "maintain", sex: null });
  expect(profile.onboarding_done_at).not.toBeNull();

  await page.reload();
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});

test("each step explains what is wrong", async ({ page }) => {
  await signIn(page, "A");
  await page.getByRole("button", { name: "Female", exact: true }).click();
  await page.getByLabel("Age").fill("13");
  await page.getByLabel("Height (cm)").fill("180");
  await page.getByLabel("Weight (kg)").fill("70");
  await expect(page.getByRole("status").filter({ hasText: "Min age 14" })).toBeVisible();
  await expect(next(page)).toBeDisabled();
  await page.getByLabel("Age").fill("25");
  await expect(page.getByRole("status")).toHaveCount(0);
  await next(page).click();

  await page.getByLabel("Body fat %").fill("80");
  await expect(page.getByRole("status").filter({ hasText: "Max 60%" })).toBeVisible();
  await page.getByLabel("Body fat %").fill("");
  await expect(next(page)).toBeEnabled(); // optional
});

test("without the AI, the standard calculation is shown and says so", async ({ page }) => {
  await mockPlan(page, { ...PLAN, summary: "Standard calculation.", source: "standard" });
  await signIn(page, "A");
  await fillAboutYou(page);
  await next(page).click();
  await next(page).click();
  await page.getByText("Lose weight").click();
  await next(page).click();
  await page.getByRole("button", { name: /^Sedentary/ }).click();
  await next(page).click();
  await page.getByRole("button", { name: /^Moderate/ }).click();
  await page.getByRole("button", { name: "Calculate my plan" }).click();
  await expect(page.getByTestId("plan-calories")).toHaveText("2300"); // lose weight was chosen
  await expect(page.getByRole("status").filter({ hasText: "Standard calculation" })).toBeVisible();
});

test("a failed calculation shows the error and can be tried again", async ({ page }) => {
  await page.route("**/api/ai/plan", (route) => route.fulfill({ status: 500, json: { error: "internal" } }));
  await signIn(page, "A");
  await fillAboutYou(page);
  await next(page).click();
  await next(page).click();
  await page.getByText("Maintain weight").click();
  await next(page).click();
  await page.getByRole("button", { name: /^Active/ }).click();
  await next(page).click();
  await page.getByRole("button", { name: /^Light/ }).click();
  await page.getByRole("button", { name: "Calculate my plan" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Couldn't calculate" })).toBeVisible();

  await page.unroute("**/api/ai/plan");
  await mockPlan(page);
  await page.getByRole("button", { name: "Calculate my plan" }).click();
  await expect(page.getByTestId("plan-calories")).toHaveText("2600");
});

test("Perfil: the button redoes the plan with the saved answers, 'Cancel' changes nothing", async ({ page }) => {
  await resetProfileRow("A", { onboardingDone: true });
  await mockPlan(page);
  await login(page, "A");
  await page.getByRole("link", { name: "Profile" }).click();
  const card = page.getByTestId("plan-card");
  await expect(card.getByRole("link", { name: "Calculate my plan" })).toBeVisible();

  await card.getByRole("link", { name: "Calculate my plan" }).click();
  await expect(page).toHaveURL(/\/onboarding\?from=profile/);
  await expect(page.getByRole("button", { name: "Skip" })).toHaveCount(0);
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page).toHaveURL(/\/profile$/);
  expect(await fetchProfile("A")).toMatchObject({ goal_calories: 2000, sex: null });

  // do it, adjusting by hand afterwards
  await card.getByRole("link", { name: "Calculate my plan" }).click();
  await fillAboutYou(page);
  await next(page).click();
  await next(page).click();
  await expect(page.getByRole("radio", { name: /Maintain weight/ })).toBeChecked(); // starts from the current goal
  await page.getByText("Gain muscle").click();
  await next(page).click();
  await page.getByRole("button", { name: /^Lightly active/ }).click();
  await next(page).click();
  await page.getByRole("button", { name: /^Moderate/ }).click();
  await page.getByLabel("Training notes (optional)").fill("Treino de pernas à segunda.");
  await page.getByRole("button", { name: "Calculate my plan" }).click();
  await page.getByRole("button", { name: "Use and adjust" }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByLabel("Daily calories", { exact: true })).toHaveValue("2800");
  await expect(page.getByLabel("Protein (g)", { exact: true })).toHaveValue("150");

  // the other goals use their own saved plan: no new questionnaire
  await page.getByRole("radio", { name: /Lose weight/ }).check({ force: true });
  await expect(page.getByLabel("Daily calories", { exact: true })).toHaveValue("2300");
  await expect(page.getByLabel("Protein (g)", { exact: true })).toHaveValue("160");
  await expect(page.getByLabel("Carbs (g)", { exact: true })).toHaveValue("260");
  await expect(page.getByLabel("Fat (g)", { exact: true })).toHaveValue("70");
  await page.getByRole("radio", { name: /Maintain weight/ }).check({ force: true });
  await expect(page.getByLabel("Daily calories", { exact: true })).toHaveValue("2600");
  await page.getByRole("button", { name: "Save goals" }).click();
  await expect(page.getByText("Goals saved")).toBeVisible();
  expect(await fetchProfile("A")).toMatchObject({ mode: "maintain", goal_calories: 2600, goal_protein: 150, goal_carbs: 300, goal_fat: 80 });
  expect(await fetchProfile("A")).toMatchObject({ saved_plans: PLANS }); // still there to switch back
  await page.getByRole("radio", { name: /Gain muscle/ }).check({ force: true });
  await expect(page.getByLabel("Daily calories", { exact: true })).toHaveValue("2800");
  await expect(page.getByTestId("plan-card")).toContainText("Excedente pequeno para ganhar massa.");
  await expect(page.getByTestId("plan-card").getByRole("link", { name: "Redo my plan" })).toBeVisible();

  // redoing it starts from the saved answers (the goal switched above was not saved: the question comes first)
  await page.getByTestId("plan-card").getByRole("link", { name: "Redo my plan" }).click();
  await page.getByRole("button", { name: "Discard" }).click();
  await expect(page.getByLabel("Age")).toHaveValue("30");
  await expect(page.getByLabel("Weight (kg)")).toHaveValue("80.5");
  await expect(page.getByRole("button", { name: "Male", exact: true })).toHaveAttribute("aria-pressed", "true");
  await next(page).click();
  await next(page).click();
  await next(page).click();
  await expect(page.getByRole("button", { name: /^Lightly active/ })).toHaveAttribute("aria-pressed", "true");
  await next(page).click();
  await expect(page.getByRole("button", { name: /^Moderate/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Training notes (optional)")).toHaveValue("Treino de pernas à segunda.");
  await expect(page.getByLabel("Aerobic sessions per week", { exact: true })).toHaveValue("2");
});
