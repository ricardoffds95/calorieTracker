import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface SavedMealItem {
  id: string;
  name: string;
  quantity_g: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface SavedMeal {
  id: string;
  name: string;
  items: SavedMealItem[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  createdAt: string;
  timesUsed: number;
}

interface SavedMealsState {
  meals: SavedMeal[];
  saveMeal: (name: string, items: SavedMealItem[]) => Promise<void>;
  deleteMeal: (id: string) => Promise<void>;
  incrementUsage: (id: string) => Promise<void>;
  loadFromStorage: () => Promise<void>;
}

const STORAGE_KEY = 'caltracker_saved_meals';

export const useSavedMealsStore = create<SavedMealsState>((set, get) => ({
  meals: [],

  saveMeal: async (name, items) => {
    const meal: SavedMeal = {
      id: Date.now().toString(),
      name,
      items,
      totalCalories: items.reduce((s, i) => s + i.calories, 0),
      totalProtein: items.reduce((s, i) => s + i.protein_g, 0),
      totalCarbs: items.reduce((s, i) => s + i.carbs_g, 0),
      totalFat: items.reduce((s, i) => s + i.fat_g, 0),
      createdAt: new Date().toISOString(),
      timesUsed: 0,
    };
    const meals = [meal, ...get().meals];
    set({ meals });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(meals));
  },

  deleteMeal: async (id) => {
    const meals = get().meals.filter((m) => m.id !== id);
    set({ meals });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(meals));
  },

  incrementUsage: async (id) => {
    const meals = get().meals.map((m) =>
      m.id === id ? { ...m, timesUsed: m.timesUsed + 1 } : m
    );
    set({ meals });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(meals));
  },

  loadFromStorage: async () => {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) set({ meals: JSON.parse(raw) as SavedMeal[] });
  },
}));
