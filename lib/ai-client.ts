import type { AiFoodItem, AiRequest } from "./schemas";

export type AiClientResult =
  | { ok: true; items: AiFoodItem[] }
  | { ok: false; reason: "unavailable" | "invalid" | "unauthorized" | "network"; message: string };

const FALLBACK: Record<"unavailable" | "invalid" | "unauthorized" | "network", string> = {
  unavailable: "Modo IA não disponível de momento.",
  invalid: "Não foi possível interpretar a resposta. Tenta reformular.",
  unauthorized: "Sessão expirada. Entra novamente.",
  network: "Sem ligação. Verifica a internet e tenta novamente.",
};

/** Browser helper for POST /api/ai/parse. Never throws: the UI shows `message` in an alert. */
export async function requestAiParse(input: AiRequest, fetchFn: typeof fetch = fetch): Promise<AiClientResult> {
  let response: Response;
  try {
    response = await fetchFn("/api/ai/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    return { ok: false, reason: "network", message: FALLBACK.network };
  }

  const body = (await response.json().catch(() => null)) as { items?: AiFoodItem[]; message?: string } | null;
  if (response.ok && body?.items) return { ok: true, items: body.items };

  if (response.status === 401) return { ok: false, reason: "unauthorized", message: FALLBACK.unauthorized };
  if (response.status === 400 || response.status === 502) {
    return { ok: false, reason: "invalid", message: body?.message ?? FALLBACK.invalid };
  }
  // 503 (quota exhausted, not configured, down) and anything unexpected
  return { ok: false, reason: "unavailable", message: FALLBACK.unavailable };
}
