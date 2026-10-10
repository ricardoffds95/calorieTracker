import type { NutritionPlan, PlanAnswers } from "./nutrition-plan";

export type PlanClientResult =
  | { ok: true; plan: NutritionPlan; summary: string; source: "ai" | "standard" }
  | { ok: false; reason: "invalid" | "unauthorized" | "network" | "unavailable"; message: string };

const FALLBACK = {
  invalid: "Não foi possível calcular com estes dados. Confirma-os e tenta novamente.",
  unauthorized: "Sessão expirada. Entra novamente.",
  network: "Sem ligação. Verifica a internet e tenta novamente.",
  unavailable: "Não foi possível calcular agora. Tenta novamente daqui a pouco.",
} as const;

/** Browser helper for POST /api/ai/plan. Never throws: the UI shows `message`. */
export async function requestPlan(answers: PlanAnswers, fetchFn: typeof fetch = fetch): Promise<PlanClientResult> {
  let response: Response;
  try {
    response = await fetchFn("/api/ai/plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(answers) });
  } catch {
    return { ok: false, reason: "network", message: FALLBACK.network };
  }
  const body = (await response.json().catch(() => null)) as
    | { calories?: number; protein_g?: number; carbs_g?: number; fat_g?: number; summary?: string; source?: string; message?: string }
    | null;

  if (response.ok && body && [body.calories, body.protein_g, body.carbs_g, body.fat_g].every((n) => typeof n === "number")) {
    return {
      ok: true,
      plan: { calories: body.calories!, protein_g: body.protein_g!, carbs_g: body.carbs_g!, fat_g: body.fat_g! },
      summary: body.summary ?? "",
      source: body.source === "ai" ? "ai" : "standard",
    };
  }
  if (response.status === 401) return { ok: false, reason: "unauthorized", message: FALLBACK.unauthorized };
  if (response.status === 400) return { ok: false, reason: "invalid", message: body?.message ?? FALLBACK.invalid };
  return { ok: false, reason: "unavailable", message: FALLBACK.unavailable };
}
