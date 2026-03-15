const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// Minimal prompts = fewer tokens = faster responses
const TEXT_PROMPT = `Alimentos em JSON apenas:
[{"name":"","quantity_g":0,"calories":0,"protein_g":0,"carbs_g":0,"fat_g":0}]`;

const IMAGE_PROMPT = `Identifica alimentos na imagem. JSON apenas:
[{"name":"","quantity_g":0,"calories":0,"protein_g":0,"carbs_g":0,"fat_g":0}]`;

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

async function fetchWithTimeout(url: string, options: RequestInit, ms = 8000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeout);
    return response;
  } catch (error: unknown) {
    clearTimeout(timeout);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Pedido demorou demasiado. Tenta novamente.');
    }
    throw error;
  }
}

function handleGeminiError(status: number, errorData: unknown): never {
  console.error('Gemini API error:', status, errorData);
  if (status === 429) {
    const msg = (errorData as any)?.error?.message as string | undefined;
    const retryMatch = msg?.match(/retry in ([\d.]+)s/);
    const secs = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) : null;
    throw new Error(secs
      ? `Limite atingido. Tenta novamente em ${secs} segundos.`
      : 'Limite atingido. Aguarda um momento e tenta novamente.');
  }
  if (status === 401 || status === 403) throw new Error('Não foi possível ligar ao serviço de IA. Verifica a tua ligação.');
  if (status >= 500) throw new Error('O serviço de IA está temporariamente indisponível. Tenta mais tarde.');
  throw new Error('Não foi possível analisar. Tenta novamente.');
}

export async function parseFoodWithAI(input: string): Promise<GeminiParsedItem[]> {
  const response = await fetchWithTimeout(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: TEXT_PROMPT + '\nInput: ' + input }] }],
      generationConfig: { maxOutputTokens: 200, temperature: 0.1, topP: 0.8, topK: 10 },
    }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    handleGeminiError(response.status, err);
  }
  const data = await response.json();
  return parseGeminiResponse(data.candidates[0].content.parts[0].text as string);
}

export async function analyzeFoodImage(base64Image: string): Promise<GeminiParsedItem[]> {
  const response = await fetchWithTimeout(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: IMAGE_PROMPT },
          { inline_data: { mime_type: 'image/jpeg', data: base64Image } },
        ],
      }],
      generationConfig: { maxOutputTokens: 300, temperature: 0.1, topP: 0.8, topK: 10 },
    }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    handleGeminiError(response.status, err);
  }
  const data = await response.json();
  return parseGeminiResponse(data.candidates[0].content.parts[0].text as string);
}
