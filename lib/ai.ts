import "server-only";
import { aiMealSchema, aiResultSchema, type AiMeal } from "./schemas";

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

const SYSTEM_PROMPT = `Identifica o que foi descrito ou está visível, estima as quantidades em gramas se não especificadas, e devolve APENAS um objeto JSON sem markdown nem texto extra:
{"name":"Frango com arroz","kind":"meal","items":[{"name":"frango grelhado","quantity_g":150,"calories":248,"protein_g":46.5,"carbs_g":0,"fat_g":5.4},{"name":"arroz branco cozido","quantity_g":150,"calories":195,"protein_g":4.1,"carbs_g":42.3,"fat_g":0.5}]}
"kind" é "food" quando é UM só alimento ou produto (ex: "peito de frango grelhado", "uma maçã", "um iogurte grego") e "meal" quando é um prato feito ou vários alimentos juntos (ex: "frango com arroz", "tosta mista", "bifana com batatas").
Se "kind" é "food", "items" tem exatamente um item e "name" é o nome desse alimento. Exemplo: {"name":"Peito de frango grelhado","kind":"food","items":[{"name":"peito de frango grelhado","quantity_g":150,"calories":248,"protein_g":46.5,"carbs_g":0,"fat_g":5.4}]}
"name" é um nome curto em português, com maiúscula inicial (ex: "Frango com arroz", "Tosta mista", "Maçã").
Os valores (calories, protein_g, carbs_g, fat_g) de cada item são para a quantidade indicada em quantity_g, não por 100 g.
Usa valores nutricionais padrão e nomes em português. Responde APENAS com o objeto JSON.`;

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

function parseModelText(text: string): AiMeal {
  // responseMimeType should give clean JSON, but strip markdown fences defensively.
  const clean = text.replace(/```(?:json)?/gi, "").trim();
  let json: unknown;
  try {
    json = JSON.parse(clean);
  } catch {
    throw new AiInvalidResponseError();
  }
  const meal = aiMealSchema.safeParse(json);
  if (meal.success) return withKind(meal.data);
  // Older/looser answers: a bare array of items, or an object without a usable name.
  const items = aiResultSchema.safeParse(Array.isArray(json) ? json : (json as { items?: unknown } | null)?.items);
  if (!items.success) throw new AiInvalidResponseError();
  return withKind({ name: items.data.length === 1 ? items.data[0]!.name : "Refeição", items: items.data });
}

/** A food has exactly one item: anything else is a meal, and a missing kind follows the item count. */
function withKind(answer: { name: string; kind?: "food" | "meal"; items: AiMeal["items"] }): AiMeal {
  const single = answer.items.length === 1;
  return { ...answer, kind: single && (answer.kind ?? "food") === "food" ? "food" : "meal" };
}

async function callGemini(parts: GeminiPart[], options: GeminiOptions): Promise<AiMeal> {
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

export function parseFoodText(text: string, options: GeminiOptions = {}): Promise<AiMeal> {
  return callGemini([{ text: `${SYSTEM_PROMPT}\n\n${text}` }], options);
}

export function analyzeFoodImage(
  base64: string,
  mimeType: string,
  options: GeminiOptions = {},
): Promise<AiMeal> {
  return callGemini([{ text: SYSTEM_PROMPT }, { inlineData: { mimeType, data: base64 } }], options);
}
