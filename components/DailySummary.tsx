import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Colors, Typography, FontWeight, Spacing, Radius, Shadow, MacroColors } from '../constants/theme';

interface DailySummaryProps {
  calories: number; calorieGoal: number;
  protein: number; proteinGoal: number;
  carbs: number; carbsGoal: number;
  fat: number; fatGoal: number;
}

function Bar({ label, value, goal, color, unit }: { label: string; value: number; goal: number; color: string; unit: string }) {
  const anim = useRef(new Animated.Value(0)).current;
  const pct = Math.min(value / Math.max(goal, 1), 1);
  useEffect(() => {
    Animated.timing(anim, { toValue: pct, duration: 800, useNativeDriver: false }).start();
  }, [pct]);
  const width = anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  return (
    <View style={styles.barRow}>
      <View style={styles.barHeader}>
        <Text style={styles.barLabel}>{label}</Text>
        <Text style={styles.barValue}>{Math.round(value)}{unit} <Text style={styles.barGoal}>/ {goal}{unit}</Text></Text>
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, { width, backgroundColor: color }]} />
      </View>
    </View>
  );
}

export default function DailySummary({ calories, calorieGoal, protein, proteinGoal, carbs, carbsGoal, fat, fatGoal }: DailySummaryProps) {
  return (
    <View style={styles.card}>
      <Bar label="Proteína" value={protein} goal={proteinGoal} color={MacroColors.protein} unit="g" />
      <Bar label="Hidratos" value={carbs} goal={carbsGoal} color={MacroColors.carbs} unit="g" />
      <Bar label="Gordura" value={fat} goal={fatGoal} color={MacroColors.fat} unit="g" />
      <Bar label="Calorias" value={calories} goal={calorieGoal} color={Colors.textPrimary} unit="kcal" />
    </View>
  );
}

// Named export for backward compatibility
export { DailySummary };

const styles = StyleSheet.create({
  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, ...Shadow.card, gap: Spacing.md },
  barRow: { gap: 6 },
  barHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  barLabel: { fontSize: Typography.sm, fontWeight: FontWeight.medium, color: Colors.textSecondary },
  barValue: { fontSize: Typography.sm, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  barGoal: { fontWeight: FontWeight.regular, color: Colors.textDisabled },
  track: { height: 6, backgroundColor: Colors.border, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
});
