import Anthropic from '@anthropic-ai/sdk';

export interface ParsedFoodItem {
  name: string;
  quantity_g: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

const SYSTEM_PROMPT = `You are a nutrition assistant. The user will describe food they ate in Portuguese or English.
Extract each food item, estimate the quantity in grams if not specified, and return ONLY a JSON array like:
[{"name": "frango grelhado", "quantity_g": 150, "calories": 165, "protein_g": 31, "carbs_g": 0, "fat_g": 3.6}]
Use standard nutritional values. Return ONLY the JSON array, no other text.`;

export async function parseFoodFromText(
  text: string,
  apiKey: string
): Promise<ParsedFoodItem[]> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: text }],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Resposta inesperada da IA');
  }

  let jsonText = content.text.trim();
  // Strip any markdown code fences if present
  jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');

  const parsed = JSON.parse(jsonText) as ParsedFoodItem[];
  return parsed.map((item) => ({
    name: item.name,
    quantity_g: Number(item.quantity_g) || 100,
    calories: Number(item.calories) || 0,
    protein_g: Number(item.protein_g) || 0,
    carbs_g: Number(item.carbs_g) || 0,
    fat_g: Number(item.fat_g) || 0,
  }));
}
