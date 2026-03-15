import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MacroGoals, DEFAULT_GOALS, calculateMacrosFromCalories, GOAL_PRESETS } from '../constants/macros';

export type GoalMode = 'cut' | 'maintain' | 'bulk';

interface GoalsState {
  name: string;
  goalMode: GoalMode;
  goals: MacroGoals;
  setName: (name: string) => void;
  setGoalMode: (mode: GoalMode) => void;
  setGoals: (goals: MacroGoals) => void;
  updateCaloriesAndRecalculate: (calories: number) => void;
  loadFromStorage: () => Promise<void>;
  saveToStorage: () => Promise<void>;
}

const STORAGE_KEY = 'caltracker_goals';

export const useGoalsStore = create<GoalsState>((set, get) => ({
  name: 'Utilizador',
  goalMode: 'maintain',
  goals: DEFAULT_GOALS,

  setName: (name) => {
    set({ name });
    get().saveToStorage();
  },

  setGoalMode: (mode) => {
    const preset = GOAL_PRESETS[mode];
    const newGoals = calculateMacrosFromCalories(
      get().goals.calories,
      preset.proteinPct,
      preset.carbsPct,
      preset.fatPct
    );
    set({ goalMode: mode, goals: newGoals });
    get().saveToStorage();
  },

  setGoals: (goals) => {
    set({ goals });
    get().saveToStorage();
  },

  updateCaloriesAndRecalculate: (calories) => {
    const preset = GOAL_PRESETS[get().goalMode];
    const newGoals = calculateMacrosFromCalories(
      calories,
      preset.proteinPct,
      preset.carbsPct,
      preset.fatPct
    );
    set({ goals: newGoals });
    get().saveToStorage();
  },

  loadFromStorage: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        set(data);
      }
    } catch (e) {
      console.error('Failed to load goals', e);
    }
  },

  saveToStorage: async () => {
    try {
      const { name, goalMode, goals } = get();
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ name, goalMode, goals }));
    } catch (e) {
      console.error('Failed to save goals', e);
    }
  },
}));
