export interface FoodSearchResult {
  id: string;
  name: string;
  brand?: string;
  calories_100g: number;
  protein_100g: number;
  carbs_100g: number;
  fat_100g: number;
  serving_size?: string;
}

interface OFFProduct {
  code: string;
  product_name?: string;
  brands?: string;
  serving_size?: string;
  nutriments?: {
    'energy-kcal_100g'?: number;
    'energy_100g'?: number;
    protein_100g?: number;
    carbohydrates_100g?: number;
    fat_100g?: number;
  };
}

interface OFFResponse {
  products: OFFProduct[];
  count: number;
}

export async function searchFood(query: string): Promise<FoodSearchResult[]> {
  const encoded = encodeURIComponent(query.trim());
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encoded}&search_simple=1&action=process&json=1&fields=code,product_name,brands,nutriments,serving_size&lc=pt&page_size=20`;

  const response = await fetch(url, {
    headers: { 'User-Agent': 'CalTracker/1.0 (caltracker@example.com)' },
  });

  if (!response.ok) {
    throw new Error(`Erro ao procurar alimento: ${response.status}`);
  }

  const data: OFFResponse = await response.json();

  return data.products
    .filter((p) => p.product_name && p.nutriments)
    .map((p): FoodSearchResult => {
      const n = p.nutriments!;
      const kcal = n['energy-kcal_100g'] ?? (n['energy_100g'] ? n['energy_100g'] / 4.184 : 0);
      return {
        id: p.code,
        name: p.product_name!,
        brand: p.brands,
        calories_100g: Math.round(kcal),
        protein_100g: Math.round((n.protein_100g ?? 0) * 10) / 10,
        carbs_100g: Math.round((n.carbohydrates_100g ?? 0) * 10) / 10,
        fat_100g: Math.round((n.fat_100g ?? 0) * 10) / 10,
        serving_size: p.serving_size,
      };
    })
    .filter((r) => r.calories_100g > 0);
}

export function calculateNutrientsForQuantity(
  food: FoodSearchResult,
  quantity_g: number
): { calories: number; protein_g: number; carbs_g: number; fat_g: number } {
  const factor = quantity_g / 100;
  return {
    calories: Math.round(food.calories_100g * factor),
    protein_g: Math.round(food.protein_100g * factor * 10) / 10,
    carbs_g: Math.round(food.carbs_100g * factor * 10) / 10,
    fat_g: Math.round(food.fat_100g * factor * 10) / 10,
  };
}
