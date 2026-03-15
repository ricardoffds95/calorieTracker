import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format } from 'date-fns';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snacks';

export interface FoodEntry {
  id: string;
  type: 'food';
  name: string;
  quantity_g: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  meal: MealType;
  addedAt: string;
}

export interface MealEntry {
  id: string;
  type: 'meal';
  name: string;
  items: {
    id: string;
    name: string;
    quantity_g: number;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  }[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  meal: MealType;
  addedAt: string;
}

export type DiaryEntry = FoodEntry | MealEntry;

export interface DayLog {
  date: string;
  meals: Record<MealType, DiaryEntry[]>;
}

interface FoodState {
  logs: Record<string, DayLog>;
  addFood: (item: Omit<FoodEntry, 'id' | 'addedAt' | 'type'>, date?: string) => void;
  addMeal: (meal: { name: string; items: { name: string; quantity_g: number; calories: number; protein_g: number; carbs_g: number; fat_g: number }[]; meal: MealType }, date?: string) => void;
  removeFood: (foodId: string, date?: string) => void;
  clearDay: (date?: string) => void;
  getTodayTotals: () => { calories: number; protein: number; carbs: number; fat: number };
  getDayTotals: (date: string) => { calories: number; protein: number; carbs: number; fat: number };
  getTodayMeals: () => Record<MealType, DiaryEntry[]>;
  loadFromStorage: () => Promise<void>;
}

const STORAGE_KEY = 'caltracker_food_logs';

const emptyMeals = (): Record<MealType, DiaryEntry[]> => ({
  breakfast: [],
  lunch: [],
  dinner: [],
  snacks: [],
});

function entryCalories(entry: DiaryEntry): { calories: number; protein: number; carbs: number; fat: number } {
  if (entry.type === 'meal') {
    return { calories: entry.totalCalories, protein: entry.totalProtein, carbs: entry.totalCarbs, fat: entry.totalFat };
  }
  return { calories: entry.calories, protein: entry.protein_g, carbs: entry.carbs_g, fat: entry.fat_g };
}

function sumEntries(entries: DiaryEntry[]) {
  return entries.reduce(
    (acc, entry) => {
      const t = entryCalories(entry);
      return { calories: acc.calories + t.calories, protein: acc.protein + t.protein, carbs: acc.carbs + t.carbs, fat: acc.fat + t.fat };
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

// Normalize legacy FoodItem (no type field) to FoodEntry
function normalizeMeals(meals: Record<string, any[]>): Record<MealType, DiaryEntry[]> {
  const result = emptyMeals();
  const mealTypes: MealType[] = ['breakfast', 'lunch', 'dinner', 'snacks'];
  for (const mt of mealTypes) {
    result[mt] = (meals[mt] ?? []).map((entry: any): DiaryEntry => {
      if (!entry.type) return { ...entry, type: 'food' } as FoodEntry;
      return entry as DiaryEntry;
    });
  }
  return result;
}

export const useFoodStore = create<FoodState>((set, get) => ({
  logs: {},

  addFood: (item, date) => {
    const day = date ?? format(new Date(), 'yyyy-MM-dd');
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const newEntry: FoodEntry = { ...item, type: 'food', id, addedAt: new Date().toISOString() };
    set((state) => {
      const existing = state.logs[day] ?? { date: day, meals: emptyMeals() };
      const updated = {
        ...state.logs,
        [day]: {
          ...existing,
          meals: { ...existing.meals, [item.meal]: [...existing.meals[item.meal], newEntry] },
        },
      };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated)).catch(console.error);
      return { logs: updated };
    });
  },

  addMeal: (mealData, date) => {
    const day = date ?? format(new Date(), 'yyyy-MM-dd');
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const items = mealData.items.map((item, i) => ({ id: `${id}_i${i}`, ...item }));
    const totals = items.reduce(
      (acc, item) => ({ calories: acc.calories + item.calories, protein: acc.protein + item.protein_g, carbs: acc.carbs + item.carbs_g, fat: acc.fat + item.fat_g }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
    const newEntry: MealEntry = {
      id,
      type: 'meal',
      name: mealData.name,
      items,
      totalCalories: Math.round(totals.calories * 10) / 10,
      totalProtein: Math.round(totals.protein * 10) / 10,
      totalCarbs: Math.round(totals.carbs * 10) / 10,
      totalFat: Math.round(totals.fat * 10) / 10,
      meal: mealData.meal,
      addedAt: new Date().toISOString(),
    };
    set((state) => {
      const existing = state.logs[day] ?? { date: day, meals: emptyMeals() };
      const updated = {
        ...state.logs,
        [day]: {
          ...existing,
          meals: { ...existing.meals, [mealData.meal]: [...existing.meals[mealData.meal], newEntry] },
        },
      };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated)).catch(console.error);
      return { logs: updated };
    });
  },

  removeFood: (foodId, date) => {
    const day = date ?? format(new Date(), 'yyyy-MM-dd');
    set((state) => {
      const existing = state.logs[day];
      if (!existing) return state;
      const meals = { ...existing.meals } as Record<MealType, DiaryEntry[]>;
      (Object.keys(meals) as MealType[]).forEach((meal) => {
        meals[meal] = meals[meal].filter((e) => e.id !== foodId);
      });
      const updated = { ...state.logs, [day]: { ...existing, meals } };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated)).catch(console.error);
      return { logs: updated };
    });
  },

  clearDay: (date) => {
    const day = date ?? format(new Date(), 'yyyy-MM-dd');
    set((state) => {
      const updated = { ...state.logs, [day]: { date: day, meals: emptyMeals() } };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated)).catch(console.error);
      return { logs: updated };
    });
  },

  getTodayTotals: () => {
    const day = format(new Date(), 'yyyy-MM-dd');
    return get().getDayTotals(day);
  },

  getDayTotals: (date) => {
    const log = get().logs[date];
    if (!log) return { calories: 0, protein: 0, carbs: 0, fat: 0 };
    return sumEntries(Object.values(log.meals).flat());
  },

  getTodayMeals: () => {
    const day = format(new Date(), 'yyyy-MM-dd');
    return get().logs[day]?.meals ?? emptyMeals();
  },

  loadFromStorage: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, any>;
        const logs: Record<string, DayLog> = {};
        for (const [date, dayLog] of Object.entries(parsed)) {
          logs[date] = { date: dayLog.date, meals: normalizeMeals(dayLog.meals ?? {}) };
        }
        set({ logs });
      }
    } catch (e) {
      console.error('Failed to load food logs', e);
    }
  },
}));
