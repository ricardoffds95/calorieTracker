import { NextResponse } from "next/server";
import { AiInvalidResponseError, AiUnavailableError, generateNutritionPlan, type GeneratedPlan } from "@/lib/ai";
import { planAnswersSchema, referencePlan, referenceSummary } from "@/lib/nutrition-plan";
import { createClient } from "@/lib/supabase/server";

function jsonError(status: number, error: string, message: string) {
  return NextResponse.json({ error, message }, { status });
}

/** Calories and macros for the questionnaire. Never fails because of the AI: without it the standard calculation answers. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return jsonError(401, "unauthorized", "Sessão expirada. Entra novamente.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "invalid_request", "Pedido inválido.");
  }
  const parsed = planAnswersSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "invalid_request", parsed.error.issues[0]?.message ?? "Dados inválidos.");

  let result: GeneratedPlan;
  try {
    result = await generateNutritionPlan(parsed.data);
  } catch (error) {
    if (!(error instanceof AiUnavailableError) && !(error instanceof AiInvalidResponseError)) return jsonError(500, "internal", "Erro inesperado.");
    result = { plan: referencePlan(parsed.data), summary: referenceSummary(parsed.data), source: "standard" };
  }
  return NextResponse.json({ ...result.plan, summary: result.summary, source: result.source });
}
