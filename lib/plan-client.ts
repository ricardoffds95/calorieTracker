import { parseSavedPlans, type PlanAnswers, type PlansByGoal } from "./nutrition-plan";

export type PlanClientResult =
  | { ok: true; plans: PlansByGoal; summary: string; source: "ai" | "standard" }
  | { ok: false; reason: "invalid" | "unauthorized" | "network" | "unavailable"; message: string };

const FALLBACK = {
  invalid: "Check your details",
  unauthorized: "Session expired",
  network: "No connection",
  unavailable: "Couldn't calculate. Try again",
} as const;

/** Browser helper for POST /api/ai/plan. Never throws: the UI shows `message`. */
export async function requestPlan(answers: PlanAnswers, fetchFn: typeof fetch = fetch): Promise<PlanClientResult> {
  let response: Response;
  try {
    response = await fetchFn("/api/ai/plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(answers) });
  } catch {
    return { ok: false, reason: "network", message: FALLBACK.network };
  }
  const body = (await response.json().catch(() => null)) as { plans?: unknown; summary?: string; source?: string; message?: string } | null;

  const plans = response.ok ? parseSavedPlans(body?.plans) : null;
  if (plans) return { ok: true, plans, summary: body?.summary ?? "", source: body?.source === "ai" ? "ai" : "standard" };
  if (response.status === 401) return { ok: false, reason: "unauthorized", message: FALLBACK.unauthorized };
  if (response.status === 400) return { ok: false, reason: "invalid", message: body?.message ?? FALLBACK.invalid };
  return { ok: false, reason: "unavailable", message: FALLBACK.unavailable };
}
