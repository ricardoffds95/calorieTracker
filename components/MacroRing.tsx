import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Colors, Typography, FontWeight } from '../constants/theme';
import { MacroColors } from '../constants/theme';

interface Props {
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

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function Arc({
  cx,
  cy,
  r,
  color,
  percent,
  strokeWidth,
  offset,
}: {
  cx: number;
  cy: number;
  r: number;
  color: string;
  percent: number;
  strokeWidth: number;
  offset: number;
}) {
  const circumference = 2 * Math.PI * r;
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: percent,
      duration: 900,
      useNativeDriver: false,
    }).start();
  }, [percent]);

  const strokeDashoffset = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, circumference * (1 - Math.min(percent, 1))],
  });

  return (
    <AnimatedCircle
      cx={cx}
      cy={cy}
      r={r}
      stroke={color}
      strokeWidth={strokeWidth}
      fill="none"
      strokeDasharray={`${circumference} ${circumference}`}
      strokeDashoffset={strokeDashoffset}
      strokeLinecap="round"
      rotation="-90"
      origin={`${cx},${cy}`}
      strokeOpacity={0.9}
    />
  );
}

export function MacroRing({
  calories,
  calorieGoal,
  protein,
  proteinGoal,
  carbs,
  carbsGoal,
  fat,
  fatGoal,
  size = 220,
}: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const remaining = Math.max(calorieGoal - calories, 0);
  const isOver = calories > calorieGoal;

  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  const rings = [
    { r: cx - 14, color: MacroColors.protein, percent: proteinGoal > 0 ? protein / proteinGoal : 0, sw: 10 },
    { r: cx - 30, color: MacroColors.carbs, percent: carbsGoal > 0 ? carbs / carbsGoal : 0, sw: 10 },
    { r: cx - 46, color: MacroColors.fat, percent: fatGoal > 0 ? fat / fatGoal : 0, sw: 10 },
  ];

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <Svg width={size} height={size}>
        {/* Track circles */}
        {rings.map((ring, i) => (
          <Circle
            key={`track-${i}`}
            cx={cx}
            cy={cy}
            r={ring.r}
            stroke={Colors.surface2}
            strokeWidth={ring.sw}
            fill="none"
          />
        ))}
        {/* Animated macro arcs */}
        {rings.map((ring, i) => (
          <Arc
            key={`arc-${i}`}
            cx={cx}
            cy={cy}
            r={ring.r}
            color={ring.color}
            percent={ring.percent}
            strokeWidth={ring.sw}
            offset={0}
          />
        ))}
      </Svg>

      {/* Center text */}
      <View style={[styles.center, { width: size, height: size }]}>
        <Text style={styles.remainingLabel}>
          {isOver ? 'acima' : 'restantes'}
        </Text>
        <Text style={[styles.caloriesNumber, isOver && styles.caloriesOver]}>
          {isOver ? `+${calories - calorieGoal}` : remaining}
        </Text>
        <Text style={styles.kcalLabel}>kcal</Text>
        <Text style={styles.totalLabel}>
          {calories} / {calorieGoal}
        </Text>
      </View>

      {/* Macro legend */}
      <View style={styles.legend}>
        <MacroLegendItem label="P" value={protein} goal={proteinGoal} color={MacroColors.protein} />
        <MacroLegendItem label="C" value={carbs} goal={carbsGoal} color={MacroColors.carbs} />
        <MacroLegendItem label="G" value={fat} goal={fatGoal} color={MacroColors.fat} />
      </View>
    </Animated.View>
  );
}

function MacroLegendItem({
  label,
  value,
  goal,
  color,
}: {
  label: string;
  value: number;
  goal: number;
  color: string;
}) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
      <Text style={styles.legendValue}>
        {Math.round(value)}
        <Text style={styles.legendGoal}>/{goal}g</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  center: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  remainingLabel: {
    fontSize: Typography.sm,
    color: Colors.textMuted,
    fontWeight: FontWeight.medium,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  caloriesNumber: {
    fontSize: Typography.xxxl,
    color: Colors.accent,
    fontWeight: FontWeight.extrabold,
    lineHeight: Typography.xxxl + 6,
  },
  caloriesOver: {
    color: Colors.accent2,
  },
  kcalLabel: {
    fontSize: Typography.sm,
    color: Colors.textMuted,
    fontWeight: FontWeight.medium,
  },
  totalLabel: {
    fontSize: Typography.xs,
    color: Colors.textDisabled,
    marginTop: 4,
  },
  legend: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    fontWeight: FontWeight.bold,
  },
  legendValue: {
    fontSize: Typography.xs,
    color: Colors.text,
    fontWeight: FontWeight.semibold,
  },
  legendGoal: {
    color: Colors.textMuted,
    fontWeight: FontWeight.regular,
  },
});
