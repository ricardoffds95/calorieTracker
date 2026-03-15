const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

const SYSTEM_PROMPT = `Identifica os alimentos descritos ou visíveis, estima as quantidades em gramas se não especificadas, e devolve APENAS um JSON array sem markdown nem texto extra:
[{"name":"frango grelhado","quantity_g":150,"calories":165,"protein_g":31,"carbs_g":0,"fat_g":3.6}]
Usa valores nutricionais padrão. Responde APENAS com o JSON array.`;

export interface GeminiParsedItem {
  name: string;
  quantity_g: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

function parseGeminiResponse(text: string): GeminiParsedItem[] {
  const clean = text.replace(/```json\n?|```\n?/g, '').trim();
  return JSON.parse(clean) as GeminiParsedItem[];
}

async function callGemini(contents: unknown): Promise<GeminiParsedItem[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  let response: Response;
  try {
    response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents }),
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === 'AbortError') throw new Error('Pedido demorou demasiado. Tenta novamente.');
    throw err;
  }
  clearTimeout(timeout);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('Gemini API error:', response.status, errorData);
    if (response.status === 429) {
      const retryMatch = (errorData?.error?.message as string | undefined)?.match(/retry in ([\d.]+)s/);
      const secs = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) : null;
      throw new Error(secs ? `Limite atingido. Tenta novamente em ${secs} segundos.` : 'Limite atingido. Aguarda um momento e tenta novamente.');
    }
    if (response.status === 401 || response.status === 403) throw new Error('Não foi possível ligar ao serviço de IA. Verifica a tua ligação.');
    if (response.status >= 500) throw new Error('O serviço de IA está temporariamente indisponível. Tenta mais tarde.');
    throw new Error('Não foi possível analisar. Tenta novamente.');
  }

  const data = await response.json();
  const parts = data?.candidates?.[0]?.content?.parts as Array<{ text?: string; thought?: boolean }> | undefined;
  const text = parts?.filter(p => !p.thought).map(p => p.text ?? '').join('') ?? '';
  return parseGeminiResponse(text);
}

export function parseFoodWithAI(input: string): Promise<GeminiParsedItem[]> {
  return callGemini([{ parts: [{ text: SYSTEM_PROMPT + '\n\n' + input }] }]);
}

export function analyzeFoodImage(base64Image: string): Promise<GeminiParsedItem[]> {
  return callGemini([{
    parts: [
      { text: SYSTEM_PROMPT },
      { inline_data: { mime_type: 'image/jpeg', data: base64Image } },
    ],
  }]);
}
