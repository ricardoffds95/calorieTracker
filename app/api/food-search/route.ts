import { NextResponse } from "next/server";
import { z } from "zod";
import { OFF_MIN_QUERY_LENGTH, normalizeQuery } from "@/lib/food-search";
import { OffUnavailableError, searchOffServer } from "@/lib/off-search";
import { createClient } from "@/lib/supabase/server";

const MAX_QUERY_LENGTH = 100;

const querySchema = z.string().min(OFF_MIN_QUERY_LENGTH, "Escreve pelo menos 3 letras.").max(MAX_QUERY_LENGTH, "Pesquisa demasiado longa.");

function jsonError(status: number, error: string, message: string) {
  return NextResponse.json({ error, message }, { status });
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return jsonError(401, "unauthorized", "Sessão expirada. Entra novamente.");

  const parsed = querySchema.safeParse(normalizeQuery(new URL(request.url).searchParams.get("q") ?? ""));
  if (!parsed.success) return jsonError(400, "invalid_request", parsed.error.issues[0]?.message ?? "Pesquisa inválida.");

  try {
    return NextResponse.json({ results: await searchOffServer(parsed.data, { contactEmail: process.env.OFF_CONTACT_EMAIL }) });
  } catch (error) {
    if (error instanceof OffUnavailableError) {
      return jsonError(503, "off_unavailable", "O Open Food Facts não respondeu. Tenta daqui a pouco.");
    }
    return jsonError(500, "internal", "Erro inesperado.");
  }
}
