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

const next = (page: Page) => page.getByRole("button", { name: "Seguinte" });

async function fillAboutYou(page: Page) {
  await page.getByRole("button", { name: "Masculino" }).click();
  await page.getByLabel("Idade").fill("30");
  await page.getByLabel("Altura (cm)").fill("180");
  await page.getByLabel("Peso (kg)").fill("80,5");
}

test("first login: the questionnaire, the AI plan, and the goals are saved", async ({ page }) => {
  const sent = await mockPlan(page);
  await signIn(page, "A");
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByRole("heading", { name: "Plano nutricional" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Navegação principal" })).toHaveCount(0);

  // step 1: says what is missing, then lets go on
  await expect(next(page)).toBeDisabled();
  await expect(page.getByRole("status").filter({ hasText: "Indica o sexo." })).toBeVisible();
  await fillAboutYou(page);
  await next(page).click();

  // step 2: optional, the two percentages follow each other
  await page.getByLabel("% massa gorda").fill("18");
  await expect(page.getByLabel("% massa magra")).toHaveValue("82");
  await page.getByLabel("% massa magra").fill("80");
  await expect(page.getByLabel("% massa gorda")).toHaveValue("20");
  await next(page).click();

  // step 3: the goal has to be chosen
  await expect(next(page)).toBeDisabled();
  await expect(page.getByRole("status").filter({ hasText: "Escolhe um objetivo." })).toBeVisible();
  await page.getByText("Ganhar massa").click();
  await next(page).click();

  // step 4: the day-to-day (a desk job and a building site are not the same)
  await expect(next(page)).toBeDisabled();
  await expect(page.getByRole("status").filter({ hasText: "Indica como é o teu dia a dia." })).toBeVisible();
  await page.getByRole("button", { name: /^Muito ativo/ }).click();
  await next(page).click();

  // step 5: the training
  await expect(next(page)).toHaveCount(0); // the last step has "Calcular", not "Seguinte"
  await expect(page.getByRole("status").filter({ hasText: "Escolhe a intensidade." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Calcular o meu plano" })).toBeDisabled();
  await page.getByRole("button", { name: "Aumentar Treinos aeróbicos por semana" }).click(); // 2 → 3
  await page.getByRole("button", { name: "Diminuir Treinos anaeróbicos por semana" }).click(); // 2 → 1
  await page.getByRole("button", { name: /^Intensa/ }).click();
  await page.getByLabel("Notas sobre os treinos (opcional)").fill("Musculação 1x (1h) e corrida 3x de 5 km.");
  await page.getByRole("button", { name: "Calcular o meu plano" }).click();

  await expect(page.getByTestId("plan-calories")).toHaveText("2800"); // the goal chosen (bulk) is shown first
  await expect(page.getByTestId("plan-result")).toContainText("150 g");
  await expect(page.getByRole("button", { name: "Ganhar massa (o teu objetivo)" })).toHaveAttribute("aria-pressed", "true");
  // the three plans are there to look at
  await page.getByRole("button", { name: "Perder peso" }).click();
  await expect(page.getByTestId("plan-calories")).toHaveText("2300");
  await page.getByRole("button", { name: "Manter peso" }).click();
  await expect(page.getByTestId("plan-calories")).toHaveText("2600");
  await page.getByRole("button", { name: /^Ganhar massa/ }).click();
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

  await page.getByRole("button", { name: "Usar este plano" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("navigation", { name: "Navegação principal" })).toBeVisible();

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
  await page.getByRole("button", { name: "Saltar por agora" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("navigation", { name: "Navegação principal" })).toBeVisible();

  const profile = await fetchProfile("A");
  expect(profile).toMatchObject({ goal_calories: 2000, goal_protein: 150, mode: "maintain", sex: null });
  expect(profile.onboarding_done_at).not.toBeNull();

  await page.reload();
  await expect(page.getByRole("navigation", { name: "Navegação principal" })).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});

test("each step explains what is wrong", async ({ page }) => {
  await signIn(page, "A");
  await page.getByRole("button", { name: "Feminino" }).click();
  await page.getByLabel("Idade").fill("13");
  await page.getByLabel("Altura (cm)").fill("180");
  await page.getByLabel("Peso (kg)").fill("70");
  await expect(page.getByRole("status").filter({ hasText: "A idade mínima é 14 anos." })).toBeVisible();
  await expect(next(page)).toBeDisabled();
  await page.getByLabel("Idade").fill("25");
  await expect(page.getByRole("status")).toHaveCount(0);
  await next(page).click();

  await page.getByLabel("% massa gorda").fill("80");
  await expect(page.getByRole("status").filter({ hasText: "Máximo 60 %." })).toBeVisible();
  await page.getByLabel("% massa gorda").fill("");
  await expect(next(page)).toBeEnabled(); // optional
});

test("without the AI, the standard calculation is shown and says so", async ({ page }) => {
  await mockPlan(page, { ...PLAN, summary: "Cálculo padrão.", source: "standard" });
  await signIn(page, "A");
  await fillAboutYou(page);
  await next(page).click();
  await next(page).click();
  await page.getByText("Perder peso").click();
  await next(page).click();
  await page.getByRole("button", { name: /^Sedentário/ }).click();
  await next(page).click();
  await page.getByRole("button", { name: /^Moderada/ }).click();
  await page.getByRole("button", { name: "Calcular o meu plano" }).click();
  await expect(page.getByTestId("plan-calories")).toHaveText("2300"); // lose weight was chosen
  await expect(page.getByRole("status").filter({ hasText: "Cálculo padrão" })).toBeVisible();
});

test("a failed calculation shows the error and can be tried again", async ({ page }) => {
  await page.route("**/api/ai/plan", (route) => route.fulfill({ status: 500, json: { error: "internal" } }));
  await signIn(page, "A");
  await fillAboutYou(page);
  await next(page).click();
  await next(page).click();
  await page.getByText("Manter peso").click();
  await next(page).click();
  await page.getByRole("button", { name: /^Ativo/ }).click();
  await next(page).click();
  await page.getByRole("button", { name: /^Leve/ }).click();
  await page.getByRole("button", { name: "Calcular o meu plano" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Não foi possível calcular agora" })).toBeVisible();

  await page.unroute("**/api/ai/plan");
  await mockPlan(page);
  await page.getByRole("button", { name: "Calcular o meu plano" }).click();
  await expect(page.getByTestId("plan-calories")).toHaveText("2600");
});

test("Perfil: the button redoes the plan with the saved answers, 'Cancelar' changes nothing", async ({ page }) => {
  await resetProfileRow("A", { onboardingDone: true });
  await mockPlan(page);
  await login(page, "A");
  await page.getByRole("link", { name: "Perfil" }).click();
  const card = page.getByTestId("plan-card");
  await expect(card.getByRole("link", { name: "Calcular o meu plano" })).toBeVisible();

  await card.getByRole("link", { name: "Calcular o meu plano" }).click();
  await expect(page).toHaveURL(/\/onboarding\?de=perfil/);
  await expect(page.getByRole("button", { name: "Saltar por agora" })).toHaveCount(0);
  await page.getByRole("button", { name: "Cancelar" }).click();
  await expect(page).toHaveURL(/\/perfil$/);
  expect(await fetchProfile("A")).toMatchObject({ goal_calories: 2000, sex: null });

  // do it, adjusting by hand afterwards
  await card.getByRole("link", { name: "Calcular o meu plano" }).click();
  await fillAboutYou(page);
  await next(page).click();
  await next(page).click();
  await expect(page.getByRole("radio", { name: /Manter peso/ })).toBeChecked(); // starts from the current goal
  await page.getByText("Ganhar massa").click();
  await next(page).click();
  await page.getByRole("button", { name: /^Pouco ativo/ }).click();
  await next(page).click();
  await page.getByRole("button", { name: /^Moderada/ }).click();
  await page.getByLabel("Notas sobre os treinos (opcional)").fill("Treino de pernas à segunda.");
  await page.getByRole("button", { name: "Calcular o meu plano" }).click();
  await page.getByRole("button", { name: "Usar e ajustar" }).click();
  await expect(page).toHaveURL(/\/perfil$/);
  await expect(page.getByLabel("Calorias diárias", { exact: true })).toHaveValue("2800");
  await expect(page.getByLabel("Proteína (g)", { exact: true })).toHaveValue("150");

  // the other goals use their own saved plan: no new questionnaire
  await page.getByRole("radio", { name: /Perder peso/ }).check({ force: true });
  await expect(page.getByLabel("Calorias diárias", { exact: true })).toHaveValue("2300");
  await expect(page.getByLabel("Proteína (g)", { exact: true })).toHaveValue("160");
  await expect(page.getByLabel("Hidratos (g)", { exact: true })).toHaveValue("260");
  await expect(page.getByLabel("Gordura (g)", { exact: true })).toHaveValue("70");
  await page.getByRole("radio", { name: /Manter peso/ }).check({ force: true });
  await expect(page.getByLabel("Calorias diárias", { exact: true })).toHaveValue("2600");
  await page.getByRole("button", { name: "Guardar objetivos" }).click();
  await expect(page.getByText("Objetivos guardados")).toBeVisible();
  expect(await fetchProfile("A")).toMatchObject({ mode: "maintain", goal_calories: 2600, goal_protein: 150, goal_carbs: 300, goal_fat: 80 });
  expect(await fetchProfile("A")).toMatchObject({ saved_plans: PLANS }); // still there to switch back
  await page.getByRole("radio", { name: /Ganhar massa/ }).check({ force: true });
  await expect(page.getByLabel("Calorias diárias", { exact: true })).toHaveValue("2800");
  await expect(page.getByTestId("plan-card")).toContainText("Excedente pequeno para ganhar massa.");
  await expect(page.getByTestId("plan-card").getByRole("link", { name: "Refazer o meu plano" })).toBeVisible();

  // redoing it starts from the saved answers (the goal switched above was not saved: the question comes first)
  await page.getByTestId("plan-card").getByRole("link", { name: "Refazer o meu plano" }).click();
  await page.getByRole("button", { name: "Descartar" }).click();
  await expect(page.getByLabel("Idade")).toHaveValue("30");
  await expect(page.getByLabel("Peso (kg)")).toHaveValue("80.5");
  await expect(page.getByRole("button", { name: "Masculino" })).toHaveAttribute("aria-pressed", "true");
  await next(page).click();
  await next(page).click();
  await next(page).click();
  await expect(page.getByRole("button", { name: /^Pouco ativo/ })).toHaveAttribute("aria-pressed", "true");
  await next(page).click();
  await expect(page.getByRole("button", { name: /^Moderada/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Notas sobre os treinos (opcional)")).toHaveValue("Treino de pernas à segunda.");
  await expect(page.getByLabel("Treinos aeróbicos por semana", { exact: true })).toHaveValue("2");
});
