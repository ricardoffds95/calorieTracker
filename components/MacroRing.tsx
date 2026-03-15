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

function MacroBar({ label, value, goal, color }: { label: string; value: number; goal: number; color: string }) {
  const anim = useRef(new Animated.Value(0)).current;
  const pct = Math.min(value / Math.max(goal, 1), 1);
  const isOver = value > goal;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: pct,
      duration: 800,
      useNativeDriver: false,
    }).start();
  }, [pct]);

  const width = anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={barStyles.row}>
      <View style={barStyles.header}>
        <Text style={barStyles.label}>{label}</Text>
        <Text style={barStyles.valueText}>
          <Text style={[barStyles.current, isOver && barStyles.over]}>{Math.round(value)}g</Text>
          <Text style={barStyles.goal}> / {goal}g</Text>
        </Text>
      </View>
      <View style={barStyles.track}>
        <Animated.View style={[barStyles.fill, { width, backgroundColor: isOver ? '#E85D75' : color }]} />
      </View>
    </View>
  );
}

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

      {/* Pills */}
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

      {/* Macro bars */}
      <View style={styles.barsContainer}>
        <MacroBar label="Proteína" value={protein} goal={proteinGoal} color={MacroColors.protein} />
        <MacroBar label="Hidratos" value={carbs} goal={carbsGoal} color={MacroColors.carbs} />
        <MacroBar label="Gordura" value={fat} goal={fatGoal} color={MacroColors.fat} />
      </View>
    </View>
  );
}

export { MacroRing };

const styles = StyleSheet.create({
  container: { alignItems: 'center', width: '100%' },
  ringWrapper: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  centerText: { position: 'absolute', alignItems: 'center' },
  kcalNumber: { fontSize: Typography.xxxl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  kcalLabel: { fontSize: Typography.sm, color: Colors.textSecondary, marginTop: 2 },
  pills: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.backgroundSubtle, paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.pill },
  dot: { width: 6, height: 6, borderRadius: 3 },
  pillLabel: { fontSize: Typography.xs, color: Colors.textSecondary },
  pillValue: { fontSize: Typography.xs, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  barsContainer: { width: '100%', gap: 12, marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: Colors.border },
});

const barStyles = StyleSheet.create({
  row: { gap: 6 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 13, fontWeight: '500', color: Colors.textSecondary },
  valueText: { fontSize: 13 },
  current: { fontWeight: '600', color: Colors.textPrimary },
  over: { color: '#E85D75' },
  goal: { color: Colors.textDisabled, fontWeight: '400' },
  track: { height: 7, backgroundColor: Colors.border, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
});
