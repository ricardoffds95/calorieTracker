import { useEffect } from 'react';
import { useGoalsStore } from '../store/goalsStore';

export function useDailyGoals() {
  const store = useGoalsStore();

  useEffect(() => {
    store.loadFromStorage();
  }, []);

  return store;
}
