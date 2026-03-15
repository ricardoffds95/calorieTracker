import AsyncStorage from '@react-native-async-storage/async-storage';

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
  product_name_pt?: string;
  product_name_en?: string;
  brands?: string;
  serving_size?: string;
  nutriments?: Record<string, number>;
}

interface OFFResponse {
  products: OFFProduct[];
  count: number;
}

const CACHE_KEY = 'food_search_cache_v1';
const CACHE_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

interface CacheEntry {
  results: FoodSearchResult[];
  timestamp: number;
}

type CacheStore = Record<string, CacheEntry>;

async function getCache(): Promise<CacheStore> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (raw) return JSON.parse(raw) as CacheStore;
  } catch {
    // ignore
  }
  return {};
}

async function setCache(store: CacheStore): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(store));
  } catch {
    // ignore
  }
}

export function mapProduct(p: any): FoodSearchResult {
  const nutriments = p.nutriments || {};
  const name = p.product_name || p.product_name_pt || p.product_name_en || '';

  const kcal = nutriments['energy-kcal_100g']
    ?? nutriments['energy-kcal']
    ?? (nutriments['energy_100g'] ? nutriments['energy_100g'] / 4.184 : 0);

  const protein = nutriments['proteins_100g']
    ?? nutriments['protein_100g']
    ?? nutriments['proteins']
    ?? 0;

  const carbs = nutriments['carbohydrates_100g']
    ?? nutriments['carbohydrates']
    ?? 0;

  const fat = nutriments['fat_100g']
    ?? nutriments['fat']
    ?? 0;

  return {
    id: p.code || String(Date.now()),
    name,
    brand: p.brands,
    calories_100g: Math.round(kcal),
    protein_100g: Math.round(protein * 10) / 10,
    carbs_100g: Math.round(carbs * 10) / 10,
    fat_100g: Math.round(fat * 10) / 10,
    serving_size: p.serving_size,
  };
}

export async function searchFood(query: string): Promise<{ results: FoodSearchResult[]; fromCache: boolean }> {
  const normalized = query.trim().toLowerCase();
  const cache = await getCache();
  const entry = cache[normalized];
  const now = Date.now();

  if (entry && now - entry.timestamp < CACHE_EXPIRY_MS) {
    return { results: entry.results, fromCache: true };
  }

  const encoded = encodeURIComponent(normalized);
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encoded}&search_simple=1&action=process&json=1&fields=code,product_name,product_name_pt,product_name_en,brands,nutriments,serving_size&lc=pt&page_size=20`;

  const response = await fetch(url, {
    headers: { 'User-Agent': 'CalTracker/1.0 (caltracker@example.com)' },
  });

  if (!response.ok) {
    throw new Error(`Erro ao procurar alimento: ${response.status}`);
  }

  const data: OFFResponse = await response.json();

  const results = data.products
    .filter((p) => (p.product_name || p.product_name_pt || p.product_name_en) && p.nutriments)
    .map(mapProduct)
    .filter((r) => r.name.trim().length > 0 && r.calories_100g > 0);

  const updatedCache: CacheStore = { ...cache, [normalized]: { results, timestamp: now } };
  await setCache(updatedCache);

  return { results, fromCache: false };
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
