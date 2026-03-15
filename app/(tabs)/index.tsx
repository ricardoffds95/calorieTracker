import React, { useRef, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useFood } from '../../hooks/useFood';
import { useDailyGoals } from '../../hooks/useDailyGoals';
import MacroRing from '../../components/MacroRing';
import DailySummary from '../../components/DailySummary';
import MealSection from '../../components/MealSection';
import { Colors, Typography, FontWeight, Spacing, Radius, Shadow } from '../../constants/theme';
import { MealType, DiaryEntry, useFoodStore } from '../../store/foodStore';
import { useRouter } from 'expo-router';

const MEALS: MealType[] = ['breakfast', 'lunch', 'dinner', 'snacks'];

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { removeFood } = useFood();
  const { goals, name } = useDailyGoals();
  const todayISO = format(new Date(), 'yyyy-MM-dd');
  const todayLog = useFoodStore(s => s.logs[todayISO]);
  const meals = useMemo(
    () => todayLog?.meals ?? { breakfast: [], lunch: [], dinner: [], snacks: [] } as Record<MealType, DiaryEntry[]>,
    [todayLog]
  );
  const totals = useMemo(() => {
    const all = (Object.values(meals) as DiaryEntry[][]).flat();
    return all.reduce((acc, e) => e.type === 'meal'
      ? { calories: acc.calories + e.totalCalories, protein: acc.protein + e.totalProtein, carbs: acc.carbs + e.totalCarbs, fat: acc.fat + e.totalFat }
      : { calories: acc.calories + e.calories, protein: acc.protein + e.protein_g, carbs: acc.carbs + e.carbs_g, fat: acc.fat + e.fat_g },
      { calories: 0, protein: 0, carbs: 0, fat: 0 });
  }, [todayLog]);

  const fabAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim0 = useRef(new Animated.Value(0)).current;
  const fadeAnim1 = useRef(new Animated.Value(0)).current;
  const fadeAnim2 = useRef(new Animated.Value(0)).current;
  const fadeAnim3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(fabAnim, { toValue: 1, friction: 5, tension: 60, useNativeDriver: true }).start();
    Animated.stagger(80, [
      Animated.timing(fadeAnim0, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(fadeAnim1, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(fadeAnim2, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(fadeAnim3, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  const todayISODisplay = format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR });
  const greeting = name ? `Olá, ${name}` : 'Olá';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Animated.View style={{ opacity: fadeAnim0 }}>
          <Text style={styles.greeting}>{greeting}</Text>
          <Text style={styles.date}>{todayISODisplay}</Text>
          <Text style={styles.title}>Hoje</Text>
        </Animated.View>

        {/* Macro Ring */}
        <Animated.View style={[styles.ringCard, { opacity: fadeAnim1 }]}>
          <MacroRing
            calories={totals.calories} calorieGoal={goals.calories}
            protein={totals.protein} proteinGoal={goals.protein}
            carbs={totals.carbs} carbsGoal={goals.carbs}
            fat={totals.fat} fatGoal={goals.fat}
          />
        </Animated.View>

        {/* Daily Summary */}
        <Animated.View style={{ opacity: fadeAnim2, marginBottom: Spacing.lg }}>
          <DailySummary
            calories={totals.calories} calorieGoal={goals.calories}
            protein={totals.protein} proteinGoal={goals.protein}
            carbs={totals.carbs} carbsGoal={goals.carbs}
            fat={totals.fat} fatGoal={goals.fat}
          />
        </Animated.View>

        {/* Meals */}
        <Animated.View style={{ opacity: fadeAnim3 }}>
          <Text style={styles.sectionTitle}>Refeições</Text>
          {MEALS.map(meal => {
            const items = meals[meal];
            const mealCalories = items.reduce((sum, entry) => sum + (entry.type === 'meal' ? entry.totalCalories : entry.calories), 0);
            return (
              <MealSection
                key={meal}
                meal={meal}
                items={items}
                totalCalories={mealCalories}
                date={todayISO}
                onAddFood={() => router.push({ pathname: '/(tabs)/log', params: { mealContext: meal, timestamp: Date.now().toString() } })}
                onRemoveFood={(id) => removeFood(id, todayISO)}
              />
            );
          })}
        </Animated.View>
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB */}
      <Animated.View style={[styles.fab, { transform: [{ scale: fabAnim }], bottom: insets.bottom + 80 }]}>
        <TouchableOpacity
          style={styles.fabBtn}
          onPress={() => router.push('/log')}
          activeOpacity={0.85}
        >
          <Feather name="plus" size={24} color={Colors.white} />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  content: { padding: Spacing.lg },
  greeting: { fontSize: Typography.sm, color: Colors.textSecondary, marginBottom: 2 },
  date: { fontSize: Typography.sm, color: Colors.textDisabled, marginBottom: Spacing.sm },
  title: { fontSize: Typography.xxl, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.xl },
  ringCard: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.xl, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', marginBottom: Spacing.lg, ...Shadow.card },
  sectionTitle: { fontSize: Typography.base, fontWeight: FontWeight.semibold, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: Spacing.sm },
  fab: { position: 'absolute', right: Spacing.xl },
  fabBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', ...Shadow.strong },
});
