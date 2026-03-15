import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { Colors, Typography, FontWeight, Spacing, Radius } from '../constants/theme';
import { MacroColors } from '../constants/theme';

interface MacroBarProps {
  label: string;
  current: number;
  goal: number;
  color: string;
  unit?: string;
}

function MacroBar({ label, current, goal, color, unit = 'g' }: MacroBarProps) {
  const anim = useRef(new Animated.Value(0)).current;
  const pct = goal > 0 ? Math.min(current / goal, 1) : 0;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: pct,
      duration: 700,
      useNativeDriver: false,
    }).start();
  }, [pct]);

  const width = anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={styles.barRow}>
      <View style={styles.barHeader}>
        <Text style={styles.barLabel}>{label}</Text>
        <Text style={styles.barValues}>
          <Text style={{ color }}>{Math.round(current)}</Text>
          <Text style={styles.barGoal}> / {goal}{unit}</Text>
        </Text>
      </View>
      <View style={styles.track}>
        <Animated.View
          style={[
            styles.fill,
            {
              width,
              backgroundColor: color,
              opacity: pct > 1.05 ? 1 : 0.85,
            },
          ]}
        />
      </View>
    </View>
  );
}

interface Props {
  calories: number;
  calorieGoal: number;
  protein: number;
  proteinGoal: number;
  carbs: number;
  carbsGoal: number;
  fat: number;
  fatGoal: number;
}

export function DailySummary({ calories, calorieGoal, protein, proteinGoal, carbs, carbsGoal, fat, fatGoal }: Props) {
  return (
    <View style={styles.container}>
      <MacroBar
        label="Proteína"
        current={protein}
        goal={proteinGoal}
        color={MacroColors.protein}
      />
      <MacroBar
        label="Hidratos"
        current={carbs}
        goal={carbsGoal}
        color={MacroColors.carbs}
      />
      <MacroBar
        label="Gordura"
        current={fat}
        goal={fatGoal}
        color={MacroColors.fat}
      />
      <MacroBar
        label="Calorias"
        current={calories}
        goal={calorieGoal}
        color={MacroColors.calories}
        unit=" kcal"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.sm,
  },
  barRow: {
    gap: 4,
  },
  barHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  barLabel: {
    fontSize: Typography.sm,
    color: Colors.textMuted,
    fontWeight: FontWeight.medium,
  },
  barValues: {
    fontSize: Typography.sm,
    color: Colors.text,
  },
  barGoal: {
    color: Colors.textDisabled,
    fontWeight: FontWeight.regular,
  },
  track: {
    height: 6,
    backgroundColor: Colors.surface2,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: Radius.full,
  },
});
