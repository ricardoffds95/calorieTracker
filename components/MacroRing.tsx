import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Colors, Typography, FontWeight, Spacing, Radius } from '../constants/theme';
import { MacroColors } from '../constants/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface MacroRingProps {
  calories: number;
  calorieGoal: number;
  protein: number;
  proteinGoal: number;
  carbs: number;
  carbsGoal: number;
  fat: number;
  fatGoal: number;
  size?: number;
}

const SIZE = 220;
const STROKE = 10;
const R = (SIZE - STROKE * 2) / 2;
const CIRCUMFERENCE = 2 * Math.PI * R;
const CX = SIZE / 2;
const CY = SIZE / 2;

export default function MacroRing({ calories, calorieGoal, protein, proteinGoal, carbs, carbsGoal, fat, fatGoal }: MacroRingProps) {
  const proteinAnim = useRef(new Animated.Value(0)).current;
  const carbsAnim = useRef(new Animated.Value(0)).current;
  const fatAnim = useRef(new Animated.Value(0)).current;

  const proteinPct = Math.min(protein / Math.max(proteinGoal, 1), 1);
  const carbsPct = Math.min(carbs / Math.max(carbsGoal, 1), 1);
  const fatPct = Math.min(fat / Math.max(fatGoal, 1), 1);

  useEffect(() => {
    Animated.stagger(120, [
      Animated.timing(proteinAnim, { toValue: proteinPct, duration: 900, useNativeDriver: false }),
      Animated.timing(carbsAnim, { toValue: carbsPct, duration: 900, useNativeDriver: false }),
      Animated.timing(fatAnim, { toValue: fatPct, duration: 900, useNativeDriver: false }),
    ]).start();
  }, [proteinPct, carbsPct, fatPct]);

  const kcalLeft = Math.max(calorieGoal - calories, 0);

  const proteinDash = proteinAnim.interpolate({ inputRange: [0, 1], outputRange: [0, CIRCUMFERENCE] });
  const carbsDash = carbsAnim.interpolate({ inputRange: [0, 1], outputRange: [0, CIRCUMFERENCE] });
  const fatDash = fatAnim.interpolate({ inputRange: [0, 1], outputRange: [0, CIRCUMFERENCE] });

  return (
    <View style={styles.container}>
      <View style={styles.ringWrapper}>
        <Svg width={SIZE} height={SIZE}>
          {/* Track */}
          <Circle cx={CX} cy={CY} r={R} stroke={Colors.border} strokeWidth={STROKE} fill="none" />
          {/* Fat */}
          <AnimatedCircle
            cx={CX} cy={CY} r={R}
            stroke={MacroColors.fat}
            strokeWidth={STROKE}
            fill="none"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={fatDash.interpolate({ inputRange: [0, CIRCUMFERENCE], outputRange: [CIRCUMFERENCE, 0] })}
            strokeLinecap="round"
            rotation={-90}
            origin={`${CX}, ${CY}`}
          />
          {/* Carbs */}
          <AnimatedCircle
            cx={CX} cy={CY} r={R}
            stroke={MacroColors.carbs}
            strokeWidth={STROKE}
            fill="none"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={carbsDash.interpolate({ inputRange: [0, CIRCUMFERENCE], outputRange: [CIRCUMFERENCE, 0] })}
            strokeLinecap="round"
            rotation={-90 + 360 * fatPct * 0.33}
            origin={`${CX}, ${CY}`}
          />
          {/* Protein */}
          <AnimatedCircle
            cx={CX} cy={CY} r={R}
            stroke={MacroColors.protein}
            strokeWidth={STROKE}
            fill="none"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={proteinDash.interpolate({ inputRange: [0, CIRCUMFERENCE], outputRange: [CIRCUMFERENCE, 0] })}
            strokeLinecap="round"
            rotation={-90 + 360 * (fatPct * 0.33 + carbsPct * 0.33)}
            origin={`${CX}, ${CY}`}
          />
        </Svg>
        <View style={styles.centerText}>
          <Text style={styles.kcalNumber}>{kcalLeft}</Text>
          <Text style={styles.kcalLabel}>kcal restantes</Text>
        </View>
      </View>
      <View style={styles.pills}>
        {[
          { label: 'Proteína', value: protein, goal: proteinGoal, color: MacroColors.protein },
          { label: 'Hidratos', value: carbs, goal: carbsGoal, color: MacroColors.carbs },
          { label: 'Gordura', value: fat, goal: fatGoal, color: MacroColors.fat },
        ].map(m => (
          <View key={m.label} style={styles.pill}>
            <View style={[styles.dot, { backgroundColor: m.color }]} />
            <Text style={styles.pillLabel}>{m.label}</Text>
            <Text style={styles.pillValue}>{Math.round(m.value)}g</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// Named export for backward compatibility
export { MacroRing };

const styles = StyleSheet.create({
  container: { alignItems: 'center' },
  ringWrapper: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  centerText: { position: 'absolute', alignItems: 'center' },
  kcalNumber: { fontSize: Typography.xxxl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  kcalLabel: { fontSize: Typography.sm, color: Colors.textSecondary, marginTop: 2 },
  pills: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.backgroundSubtle, paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.pill },
  dot: { width: 6, height: 6, borderRadius: 3 },
  pillLabel: { fontSize: Typography.xs, color: Colors.textSecondary },
  pillValue: { fontSize: Typography.xs, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
});
