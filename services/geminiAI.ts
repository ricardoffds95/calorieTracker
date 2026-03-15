const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

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
  const response = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents }),
  });
  if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);
  const data = await response.json();
  const text = data.candidates[0].content.parts[0].text as string;
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
