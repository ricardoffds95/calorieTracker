import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { useFood } from '../hooks/useFood';
import { useDailyGoals } from '../hooks/useDailyGoals';

function AppInit() {
  const { loadFromStorage } = useFood();
  const { loadFromStorage: loadGoals } = useDailyGoals();

  useEffect(() => {
    loadFromStorage();
    loadGoals();
  }, []);

  return null;
}

export default function RootLayout() {
  return (
    <>
      <AppInit />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}
