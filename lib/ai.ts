import "server-only";
import { aiResultSchema, type AiFoodItem } from "./schemas";

/** The AI service cannot be used right now (not configured, quota exhausted, down, timeout). */
export class AiUnavailableError extends Error {
  constructor(readonly reason: "not_configured" | "auth" | "quota" | "server" | "timeout" | "network") {
    super(`AI unavailable: ${reason}`);
    this.name = "AiUnavailableError";
  }
}

/** The AI answered, but not with a usable list of foods. */
export class AiInvalidResponseError extends Error {
  constructor() {
    super("AI returned an invalid response");
    this.name = "AiInvalidResponseError";
  }
}

const SYSTEM_PROMPT = `Identifica os alimentos descritos ou visíveis, estima as quantidades em gramas se não especificadas, e devolve APENAS um JSON array sem markdown nem texto extra:
[{"name":"frango grelhado","quantity_g":150,"calories":165,"protein_g":31,"carbs_g":0,"fat_g":3.6}]
Os valores (calories, protein_g, carbs_g, fat_g) são para a quantidade indicada em quantity_g, não por 100 g.
Usa valores nutricionais padrão e nomes em português. Responde APENAS com o JSON array.`;

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const TIMEOUT_MS = 20_000;

interface GeminiPart {
  text?: string;
  thought?: boolean;
  inlineData?: { mimeType: string; data: string };
}

interface GeminiOptions {
  fetch?: typeof fetch;
  apiKey?: string;
  model?: string;
}

function parseModelText(text: string): AiFoodItem[] {
  // responseMimeType should give clean JSON, but strip markdown fences defensively.
  const clean = text.replace(/```(?:json)?/gi, "").trim();
  let json: unknown;
  try {
    json = JSON.parse(clean);
  } catch {
    throw new AiInvalidResponseError();
  }
  const parsed = aiResultSchema.safeParse(json);
  if (!parsed.success) throw new AiInvalidResponseError();
  return parsed.data;
}

async function callGemini(parts: GeminiPart[], options: GeminiOptions): Promise<AiFoodItem[]> {
  const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY;
  const model = options.model ?? process.env.GEMINI_MODEL;
  if (!apiKey || !model) throw new AiUnavailableError("not_configured");

  const fetchFn = options.fetch ?? fetch;
  let response: Response;
  try {
    response = await fetchFn(`${GEMINI_BASE_URL}/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new AiUnavailableError("timeout");
    }
    throw new AiUnavailableError("network");
  }

  if (!response.ok) {
    // The response body is intentionally never logged or returned: it may echo request data.
    if (response.status === 429) throw new AiUnavailableError("quota");
    if (response.status === 401 || response.status === 403) throw new AiUnavailableError("auth");
    if (response.status >= 500) throw new AiUnavailableError("server");
    throw new AiInvalidResponseError();
  }

  const data = (await response.json().catch(() => null)) as {
    candidates?: { content?: { parts?: GeminiPart[] } }[];
  } | null;
  const text = (data?.candidates?.[0]?.content?.parts ?? [])
    .filter((p) => !p.thought)
    .map((p) => p.text ?? "")
    .join("");
  return parseModelText(text);
}

export function parseFoodText(text: string, options: GeminiOptions = {}): Promise<AiFoodItem[]> {
  return callGemini([{ text: `${SYSTEM_PROMPT}\n\n${text}` }], options);
}

export function analyzeFoodImage(
  base64: string,
  mimeType: string,
  options: GeminiOptions = {},
): Promise<AiFoodItem[]> {
  return callGemini([{ text: SYSTEM_PROMPT }, { inlineData: { mimeType, data: base64 } }], options);
}
