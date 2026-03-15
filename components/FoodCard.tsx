import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors, Typography, FontWeight, Spacing, Radius, Shadow } from '../constants/theme';
import { MacroColors } from '../constants/theme';

interface FoodCardProps {
  name: string;
  quantity_g: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  onRemove?: () => void;
}

export default function FoodCard({ name, quantity_g, calories, protein_g, carbs_g, fat_g, onRemove }: FoodCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.left}>
        <Text style={styles.name} numberOfLines={1}>{name}</Text>
        <Text style={styles.quantity}>{quantity_g}g</Text>
        <View style={styles.macros}>
          {[
            { label: 'P', value: protein_g, color: MacroColors.protein },
            { label: 'C', value: carbs_g, color: MacroColors.carbs },
            { label: 'G', value: fat_g, color: MacroColors.fat },
          ].map(m => (
            <View key={m.label} style={[styles.badge, { backgroundColor: m.color + '15', borderColor: m.color + '40' }]}>
              <Text style={[styles.badgeText, { color: m.color }]}>{m.label} {Math.round(m.value)}g</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={styles.right}>
        <Text style={styles.calories}>{Math.round(calories)}</Text>
        <Text style={styles.kcal}>kcal</Text>
        {onRemove && (
          <TouchableOpacity onPress={onRemove} style={styles.removeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="trash-2" size={15} color={Colors.textDisabled} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// Named export for backward compatibility with old FoodCard usage
export { FoodCard };

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginVertical: 4,
    ...Shadow.card,
  },
  left: { flex: 1, marginRight: Spacing.md },
  name: { fontSize: Typography.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary, marginBottom: 2 },
  quantity: { fontSize: Typography.sm, color: Colors.textSecondary, marginBottom: 6 },
  macros: { flexDirection: 'row', gap: 4 },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  badgeText: { fontSize: Typography.xs, fontWeight: FontWeight.medium },
  right: { alignItems: 'flex-end', gap: 2 },
  calories: { fontSize: Typography.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  kcal: { fontSize: Typography.xs, color: Colors.textSecondary },
  removeBtn: { marginTop: 6 },
});
