import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MealType } from './foodStore';
import { useFoodStore } from './foodStore';

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

export interface SavedFood {
  id: string;
  name: string;
  calories_100g: number;
  protein_100g: number;
  carbs_100g: number;
  fat_100g: number;
  createdAt: string;
  timesUsed: number;
}

interface SavedMealsState {
  meals: SavedMeal[];
  foods: SavedFood[];
  saveMeal: (name: string, items: SavedMealItem[]) => Promise<{ duplicate: boolean; existingId?: string }>;
  saveMealForce: (name: string, items: SavedMealItem[]) => Promise<void>;
  saveFood: (food: Omit<SavedFood, 'id' | 'createdAt' | 'timesUsed'>) => Promise<{ duplicate: boolean }>;
  replaceMeal: (id: string, name: string, items: SavedMealItem[]) => Promise<void>;
  renameMeal: (id: string, newName: string) => Promise<void>;
  editMeal: (id: string, updates: Partial<Pick<SavedMeal, 'name' | 'totalCalories' | 'totalProtein' | 'totalCarbs' | 'totalFat'>>) => Promise<void>;
  editFood: (id: string, updates: Partial<Pick<SavedFood, 'name' | 'calories_100g' | 'protein_100g' | 'carbs_100g' | 'fat_100g'>>) => Promise<void>;
  deleteMeal: (id: string) => Promise<void>;
  deleteFood: (id: string) => Promise<void>;
  incrementUsage: (id: string) => Promise<void>;
  incrementFoodUsage: (id: string) => Promise<void>;
  addMealToLog: (meal: SavedMeal, mealType: MealType) => void;
  addFoodToLog: (food: SavedFood, quantity: number, mealType: MealType) => void;
  loadFromStorage: () => Promise<void>;
}

const MEALS_KEY = 'caltracker_saved_meals';
const FOODS_KEY = 'caltracker_saved_foods';

function computeTotals(items: SavedMealItem[]) {
  return items.reduce(
    (acc, i) => ({
      calories: acc.calories + i.calories,
      protein: acc.protein + i.protein_g,
      carbs: acc.carbs + i.carbs_g,
      fat: acc.fat + i.fat_g,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

export const useSavedMealsStore = create<SavedMealsState>((set, get) => ({
  meals: [],
  foods: [],

  saveMeal: async (name, items) => {
    const existing = get().meals.find(
      (m) => m.name.toLowerCase().trim() === name.toLowerCase().trim()
    );
    if (existing) {
      return { duplicate: true, existingId: existing.id };
    }
    await get().saveMealForce(name, items);
    return { duplicate: false };
  },

  saveMealForce: async (name, items) => {
    const totals = computeTotals(items);
    const meal: SavedMeal = {
      id: Date.now().toString(),
      name,
      items,
      totalCalories: totals.calories,
      totalProtein: totals.protein,
      totalCarbs: totals.carbs,
      totalFat: totals.fat,
      createdAt: new Date().toISOString(),
      timesUsed: 0,
    };
    const meals = [meal, ...get().meals].sort((a, b) => b.timesUsed - a.timesUsed);
    set({ meals });
    await AsyncStorage.setItem(MEALS_KEY, JSON.stringify(meals));
  },

  saveFood: async (foodData) => {
    const exists = get().foods.some(
      (f) => f.name.toLowerCase().trim() === foodData.name.toLowerCase().trim()
    );
    if (exists) return { duplicate: true };
    const food: SavedFood = {
      id: Date.now().toString(),
      ...foodData,
      createdAt: new Date().toISOString(),
      timesUsed: 0,
    };
    const foods = [food, ...get().foods].sort((a, b) => b.timesUsed - a.timesUsed);
    set({ foods });
    await AsyncStorage.setItem(FOODS_KEY, JSON.stringify(foods));
    return { duplicate: false };
  },

  replaceMeal: async (id, name, items) => {
    const totals = computeTotals(items);
    const meals = get()
      .meals.map((m) =>
        m.id === id
          ? { ...m, name, items, totalCalories: totals.calories, totalProtein: totals.protein, totalCarbs: totals.carbs, totalFat: totals.fat }
          : m
      )
      .sort((a, b) => b.timesUsed - a.timesUsed);
    set({ meals });
    await AsyncStorage.setItem(MEALS_KEY, JSON.stringify(meals));
  },

  editMeal: async (id, updates) => {
    const meals = get().meals.map(m => m.id === id ? { ...m, ...updates } : m);
    set({ meals });
    await AsyncStorage.setItem(MEALS_KEY, JSON.stringify(meals));
  },

  editFood: async (id, updates) => {
    const foods = get().foods.map(f => f.id === id ? { ...f, ...updates } : f);
    set({ foods });
    await AsyncStorage.setItem(FOODS_KEY, JSON.stringify(foods));
  },

  renameMeal: async (id, newName) => {
    const meals = get().meals.map((m) => (m.id === id ? { ...m, name: newName } : m));
    set({ meals });
    await AsyncStorage.setItem(MEALS_KEY, JSON.stringify(meals));
  },

  deleteMeal: async (id) => {
    const meals = get().meals.filter((m) => m.id !== id);
    set({ meals });
    await AsyncStorage.setItem(MEALS_KEY, JSON.stringify(meals));
  },

  deleteFood: async (id) => {
    const foods = get().foods.filter((f) => f.id !== id);
    set({ foods });
    await AsyncStorage.setItem(FOODS_KEY, JSON.stringify(foods));
  },

  incrementUsage: async (id) => {
    const meals = get()
      .meals.map((m) => (m.id === id ? { ...m, timesUsed: m.timesUsed + 1 } : m))
      .sort((a, b) => b.timesUsed - a.timesUsed);
    set({ meals });
    await AsyncStorage.setItem(MEALS_KEY, JSON.stringify(meals));
  },

  incrementFoodUsage: async (id) => {
    const foods = get()
      .foods.map((f) => (f.id === id ? { ...f, timesUsed: f.timesUsed + 1 } : f))
      .sort((a, b) => b.timesUsed - a.timesUsed);
    set({ foods });
    await AsyncStorage.setItem(FOODS_KEY, JSON.stringify(foods));
  },

  addMealToLog: (meal, mealType) => {
    useFoodStore.getState().addMeal({
      name: meal.name,
      items: meal.items.map(item => ({
        name: item.name,
        quantity_g: item.quantity_g,
        calories: item.calories,
        protein_g: item.protein_g,
        carbs_g: item.carbs_g,
        fat_g: item.fat_g,
      })),
      meal: mealType,
    });
    get().incrementUsage(meal.id);
  },

  addFoodToLog: (food, quantity, mealType) => {
    const addFood = useFoodStore.getState().addFood;
    const factor = quantity / 100;
    addFood({
      name: food.name,
      quantity_g: quantity,
      calories: Math.round(food.calories_100g * factor),
      protein_g: Math.round(food.protein_100g * factor * 10) / 10,
      carbs_g: Math.round(food.carbs_100g * factor * 10) / 10,
      fat_g: Math.round(food.fat_100g * factor * 10) / 10,
      meal: mealType,
    });
    get().incrementFoodUsage(food.id);
  },

  loadFromStorage: async () => {
    try {
      const rawMeals = await AsyncStorage.getItem(MEALS_KEY);
      const rawFoods = await AsyncStorage.getItem(FOODS_KEY);
      const meals = rawMeals ? (JSON.parse(rawMeals) as SavedMeal[]) : [];
      const foods = rawFoods ? (JSON.parse(rawFoods) as SavedFood[]) : [];
      set({ meals, foods });
    } catch {
      // ignore
    }
  },
}));
