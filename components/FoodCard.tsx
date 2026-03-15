import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { FoodItem } from '../store/foodStore';
import { Colors, Typography, FontWeight, Spacing, Radius, Shadow } from '../constants/theme';
import { MacroColors } from '../constants/theme';

interface Props {
  item: FoodItem;
  onRemove?: (id: string) => void;
}

export function FoodCard({ item, onRemove }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.left}>
        <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.quantity}>{item.quantity_g}g</Text>
      </View>

      <View style={styles.macros}>
        <MacroBadge value={item.protein_g} color={MacroColors.protein} label="P" />
        <MacroBadge value={item.carbs_g} color={MacroColors.carbs} label="C" />
        <MacroBadge value={item.fat_g} color={MacroColors.fat} label="G" />
      </View>

      <View style={styles.right}>
        <Text style={styles.calories}>{item.calories}</Text>
        <Text style={styles.kcal}>kcal</Text>
        {onRemove && (
          <TouchableOpacity
            onPress={() => onRemove(item.id)}
            activeOpacity={0.7}
            style={styles.removeBtn}
          >
            <Text style={styles.removeTxt}>✕</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function MacroBadge({ value, color, label }: { value: number; color: string; label: string }) {
  return (
    <View style={[styles.badge, { borderColor: color + '40' }]}>
      <Text style={[styles.badgeLabel, { color }]}>{label}</Text>
      <Text style={styles.badgeValue}>{Math.round(value * 10) / 10}g</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface2,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    marginBottom: Spacing.xs,
    ...Shadow.sm,
  },
  left: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  name: {
    fontSize: Typography.base,
    color: Colors.text,
    fontWeight: FontWeight.medium,
  },
  quantity: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  macros: {
    flexDirection: 'row',
    gap: 6,
    marginRight: Spacing.sm,
  },
  badge: {
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: 5,
    paddingVertical: 2,
    alignItems: 'center',
  },
  badgeLabel: {
    fontSize: 9,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
  },
  badgeValue: {
    fontSize: 10,
    color: Colors.text,
    fontWeight: FontWeight.medium,
  },
  right: {
    alignItems: 'flex-end',
    minWidth: 48,
  },
  calories: {
    fontSize: Typography.md,
    color: Colors.accent,
    fontWeight: FontWeight.bold,
  },
  kcal: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
  },
  removeBtn: {
    marginTop: 4,
    padding: 2,
  },
  removeTxt: {
    fontSize: Typography.xs,
    color: Colors.textDisabled,
  },
});
