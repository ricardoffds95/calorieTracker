import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { FoodItem, MealType } from '../store/foodStore';
import { FoodCard } from './FoodCard';
import { Colors, Typography, FontWeight, Spacing, Radius, Shadow } from '../constants/theme';

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Pequeno-almoço',
  lunch: 'Almoço',
  dinner: 'Jantar',
  snacks: 'Snacks',
};

const MEAL_ICONS: Record<MealType, string> = {
  breakfast: '🌅',
  lunch: '☀️',
  dinner: '🌙',
  snacks: '🍎',
};

interface Props {
  meal: MealType;
  items: FoodItem[];
  onRemove?: (id: string) => void;
}

export function MealSection({ meal, items, onRemove }: Props) {
  const [expanded, setExpanded] = useState(true);
  const animHeight = useRef(new Animated.Value(1)).current;

  const totalCals = items.reduce((s, i) => s + i.calories, 0);

  const toggle = () => {
    Animated.timing(animHeight, {
      toValue: expanded ? 0 : 1,
      duration: 250,
      useNativeDriver: false,
    }).start();
    setExpanded(!expanded);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.header}
        onPress={toggle}
        activeOpacity={0.7}
      >
        <View style={styles.headerLeft}>
          <Text style={styles.icon}>{MEAL_ICONS[meal]}</Text>
          <Text style={styles.title}>{MEAL_LABELS[meal]}</Text>
          {items.length > 0 && (
            <View style={styles.countPill}>
              <Text style={styles.countText}>{items.length}</Text>
            </View>
          )}
        </View>
        <View style={styles.headerRight}>
          {totalCals > 0 && (
            <Text style={styles.totalCals}>{totalCals} kcal</Text>
          )}
          <Text style={styles.chevron}>{expanded ? '▾' : '▸'}</Text>
        </View>
      </TouchableOpacity>

      <Animated.View
        style={{
          maxHeight: animHeight.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 2000],
          }),
          overflow: 'hidden',
          opacity: animHeight,
        }}
      >
        {items.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Nenhum alimento registado</Text>
          </View>
        ) : (
          <View style={styles.items}>
            {items.map((item) => (
              <FoodCard key={item.id} item={item} onRemove={onRemove} />
            ))}
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
    ...Shadow.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 4,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  icon: {
    fontSize: Typography.md,
  },
  title: {
    fontSize: Typography.base,
    color: Colors.text,
    fontWeight: FontWeight.semibold,
  },
  countPill: {
    backgroundColor: Colors.surface2,
    borderRadius: Radius.full,
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  countText: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    fontWeight: FontWeight.bold,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  totalCals: {
    fontSize: Typography.sm,
    color: Colors.accent,
    fontWeight: FontWeight.semibold,
  },
  chevron: {
    fontSize: Typography.base,
    color: Colors.textMuted,
  },
  empty: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: Typography.sm,
    color: Colors.textDisabled,
    fontStyle: 'italic',
  },
  items: {
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
});
