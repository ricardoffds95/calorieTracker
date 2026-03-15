import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format } from 'date-fns';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snacks';

export interface FoodItem {
  id: string;
  name: string;
  quantity_g: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  meal: MealType;
  addedAt: string;
}

export interface DayLog {
  date: string;
  meals: Record<MealType, FoodItem[]>;
}

interface FoodState {
  logs: Record<string, DayLog>;
  addFood: (item: Omit<FoodItem, 'id' | 'addedAt'>, date?: string) => void;
  removeFood: (foodId: string, date?: string) => void;
  clearDay: (date?: string) => void;
  getTodayTotals: () => { calories: number; protein: number; carbs: number; fat: number };
  getDayTotals: (date: string) => { calories: number; protein: number; carbs: number; fat: number };
  getTodayMeals: () => Record<MealType, FoodItem[]>;
  loadFromStorage: () => Promise<void>;
}

const STORAGE_KEY = 'caltracker_food_logs';

const emptyMeals = (): Record<MealType, FoodItem[]> => ({
  breakfast: [],
  lunch: [],
  dinner: [],
  snacks: [],
});

function sumItems(items: FoodItem[]) {
  return items.reduce(
    (acc, item) => ({
      calories: acc.calories + item.calories,
      protein: acc.protein + item.protein_g,
      carbs: acc.carbs + item.carbs_g,
      fat: acc.fat + item.fat_g,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

export const useFoodStore = create<FoodState>((set, get) => ({
  logs: {},

  addFood: (item, date) => {
    const day = date ?? format(new Date(), 'yyyy-MM-dd');
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const newItem: FoodItem = { ...item, id, addedAt: new Date().toISOString() };

    set((state) => {
      const existing = state.logs[day] ?? { date: day, meals: emptyMeals() };
      const updated = {
        ...state.logs,
        [day]: {
          ...existing,
          meals: {
            ...existing.meals,
            [item.meal]: [...existing.meals[item.meal], newItem],
          },
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
      const meals = { ...existing.meals } as Record<MealType, FoodItem[]>;
      (Object.keys(meals) as MealType[]).forEach((meal) => {
        meals[meal] = meals[meal].filter((i) => i.id !== foodId);
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
    const allItems = Object.values(log.meals).flat();
    return sumItems(allItems);
  },

  getTodayMeals: () => {
    const day = format(new Date(), 'yyyy-MM-dd');
    return get().logs[day]?.meals ?? emptyMeals();
  },

  loadFromStorage: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const logs = JSON.parse(raw) as Record<string, DayLog>;
        set({ logs });
      }
    } catch (e) {
      console.error('Failed to load food logs', e);
    }
  },
}));
