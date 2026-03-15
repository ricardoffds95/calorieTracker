import { useEffect } from 'react';
import { useFoodStore } from '../store/foodStore';

export function useFood() {
  const store = useFoodStore();

  useEffect(() => {
    store.loadFromStorage();
  }, []);

  return store;
}
