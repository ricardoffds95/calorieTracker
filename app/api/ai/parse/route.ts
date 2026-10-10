import { NextResponse } from "next/server";
import { AiInvalidResponseError, AiUnavailableError, analyzeFoodImage, parseFoodText } from "@/lib/ai";
import { aiRequestSchema } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";

export const AI_UNAVAILABLE_MESSAGE = "Modo IA não disponível de momento.";

function jsonError(status: number, error: string, message: string) {
  return NextResponse.json({ error, message }, { status });
}

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

  const parsed = aiRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "invalid_request", parsed.error.issues[0]?.message ?? "Pedido inválido.");
  }

  try {
    const input = parsed.data;
    const items =
      input.type === "text"
        ? await parseFoodText(input.text)
        : await analyzeFoodImage(input.image, input.mimeType);
    return NextResponse.json({ items });
  } catch (error) {
    if (error instanceof AiUnavailableError) {
      return jsonError(503, "ai_unavailable", AI_UNAVAILABLE_MESSAGE);
    }
    if (error instanceof AiInvalidResponseError) {
      return jsonError(502, "ai_invalid", "Não foi possível interpretar a resposta. Tenta reformular.");
    }
    return jsonError(500, "internal", "Erro inesperado.");
  }
}
