import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts, DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import * as SplashScreen from 'expo-splash-screen';
import { useFoodStore } from '../store/foodStore';
import { useGoalsStore } from '../store/goalsStore';

SplashScreen.preventAutoHideAsync();

function AppInit() {
  const loadFood = useFoodStore(s => s.loadFromStorage);
  const loadGoals = useGoalsStore(s => s.loadFromStorage);
  useEffect(() => { loadFood(); loadGoals(); }, []);
  return null;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <>
      <AppInit />
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#FFFFFF' } }} />
    </>
  );
}
