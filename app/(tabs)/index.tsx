import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Animated,
  StyleSheet,
  StatusBar,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useFood } from '../../hooks/useFood';
import { useDailyGoals } from '../../hooks/useDailyGoals';
import { MacroRing } from '../../components/MacroRing';
import { DailySummary } from '../../components/DailySummary';
import { MealSection } from '../../components/MealSection';
import { Colors, Typography, FontWeight, Spacing, Radius, Shadow } from '../../constants/theme';
import { MealType } from '../../store/foodStore';

const MEALS: MealType[] = ['breakfast', 'lunch', 'dinner', 'snacks'];

export default function DashboardScreen() {
  const router = useRouter();
  const { getTodayTotals, getTodayMeals, removeFood } = useFood();
  const { name, goals } = useDailyGoals();

  const totals = getTodayTotals();
  const meals = getTodayMeals();

  const today = format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR });
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';

  // Staggered fade-in animations
  const anims = useRef(
    Array.from({ length: 5 }, () => new Animated.Value(0))
  ).current;

  useEffect(() => {
    const animations = anims.map((anim, i) =>
      Animated.timing(anim, {
        toValue: 1,
        duration: 400,
        delay: i * 80,
        useNativeDriver: true,
      })
    );
    Animated.stagger(80, animations).start();
  }, []);

  const fabScale = useRef(new Animated.Value(1)).current;
  const handleFabPress = () => {
    Animated.sequence([
      Animated.spring(fabScale, { toValue: 0.88, useNativeDriver: true }),
      Animated.spring(fabScale, { toValue: 1, useNativeDriver: true }),
    ]).start();
    router.push('/(tabs)/log');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View style={[styles.header, { opacity: anims[0], transform: [{ translateY: anims[0].interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }]}>
          <View>
            <Text style={styles.greeting}>
              {greeting}, <Text style={styles.name}>{name}</Text>
            </Text>
            <Text style={styles.date}>{today}</Text>
          </View>
          <TouchableOpacity
            style={styles.avatarBtn}
            onPress={() => router.push('/(tabs)/profile')}
            activeOpacity={0.7}
          >
            <Text style={styles.avatarEmoji}>👤</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Macro Ring */}
        <Animated.View style={[styles.ringContainer, { opacity: anims[1], transform: [{ scale: anims[1].interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }] }]}>
          <MacroRing
            calories={totals.calories}
            calorieGoal={goals.calories}
            protein={totals.protein}
            proteinGoal={goals.protein}
            carbs={totals.carbs}
            carbsGoal={goals.carbs}
            fat={totals.fat}
            fatGoal={goals.fat}
            size={230}
          />
        </Animated.View>

        {/* Progress bars */}
        <Animated.View style={[styles.card, { opacity: anims[2], transform: [{ translateY: anims[2].interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }]}>
          <Text style={styles.sectionTitle}>Progresso de hoje</Text>
          <DailySummary
            calories={totals.calories}
            calorieGoal={goals.calories}
            protein={totals.protein}
            proteinGoal={goals.protein}
            carbs={totals.carbs}
            carbsGoal={goals.carbs}
            fat={totals.fat}
            fatGoal={goals.fat}
          />
        </Animated.View>

        {/* Meals */}
        <Animated.View style={{ opacity: anims[3], transform: [{ translateY: anims[3].interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }}>
          <Text style={[styles.sectionTitle, { marginBottom: Spacing.sm }]}>Refeições</Text>
          {MEALS.map((meal) => (
            <MealSection
              key={meal}
              meal={meal}
              items={meals[meal]}
              onRemove={removeFood}
            />
          ))}
        </Animated.View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB */}
      <Animated.View style={[styles.fabContainer, { transform: [{ scale: fabScale }] }]}>
        <TouchableOpacity style={styles.fab} onPress={handleFabPress} activeOpacity={0.85}>
          <Text style={styles.fabIcon}>+</Text>
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.xl,
  },
  greeting: {
    fontSize: Typography.xl,
    color: Colors.textMuted,
    fontWeight: FontWeight.regular,
  },
  name: {
    color: Colors.text,
    fontWeight: FontWeight.bold,
  },
  date: {
    fontSize: Typography.sm,
    color: Colors.textDisabled,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  avatarBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  avatarEmoji: {
    fontSize: 20,
  },
  ringContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadow.sm,
  },
  sectionTitle: {
    fontSize: Typography.base,
    color: Colors.text,
    fontWeight: FontWeight.semibold,
    marginBottom: Spacing.md,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 90,
    right: Spacing.lg,
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.accent,
  },
  fabIcon: {
    fontSize: 32,
    color: Colors.background,
    fontWeight: FontWeight.bold,
    lineHeight: 36,
  },
});
