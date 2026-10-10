import { NextResponse } from "next/server";
import { z } from "zod";
import { MAX_PAGES, MIN_QUERY_LENGTH, normalizeQuery } from "@/lib/food-search";
import { OffUnavailableError, searchOffServer } from "@/lib/off-search";
import { createClient } from "@/lib/supabase/server";

const MAX_QUERY_LENGTH = 100;

const querySchema = z.object({
  q: z.string().min(MIN_QUERY_LENGTH, `Escreve pelo menos ${MIN_QUERY_LENGTH} letras.`).max(MAX_QUERY_LENGTH, "Pesquisa demasiado longa."),
  page: z.coerce.number().int("Página inválida.").min(1, "Página inválida.").max(MAX_PAGES, "Página inválida."),
});

function jsonError(status: number, error: string, message: string) {
  return NextResponse.json({ error, message }, { status });
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return jsonError(401, "unauthorized", "Sessão expirada. Entra novamente.");

  const params = new URL(request.url).searchParams;
  const parsed = querySchema.safeParse({ q: normalizeQuery(params.get("q") ?? ""), page: params.get("page") ?? "1" });
  if (!parsed.success) return jsonError(400, "invalid_request", parsed.error.issues[0]?.message ?? "Pesquisa inválida.");

  try {
    return NextResponse.json(await searchOffServer(parsed.data.q, { page: parsed.data.page, contactEmail: process.env.OFF_CONTACT_EMAIL }));
  } catch (error) {
    if (error instanceof OffUnavailableError) {
      return jsonError(503, "off_unavailable", "O Open Food Facts não respondeu. Tenta daqui a pouco.");
    }
    return jsonError(500, "internal", "Erro inesperado.");
  }
}
