import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors, Typography, FontWeight, Spacing, Radius, Shadow } from '../constants/theme';
import { MealType } from '../store/foodStore';

interface FoodItem { id: string; name: string; calories: number; quantity_g: number; }
interface MealSectionProps {
  meal: MealType;
  items: FoodItem[];
  totalCalories: number;
  onAddFood: () => void;
  onRemoveFood: (id: string) => void;
}

const MEAL_CONFIG: Record<MealType, { label: string; icon: 'sunrise' | 'sun' | 'moon' | 'coffee' }> = {
  breakfast: { label: 'Pequeno-almoço', icon: 'sunrise' },
  lunch: { label: 'Almoço', icon: 'sun' },
  dinner: { label: 'Jantar', icon: 'moon' },
  snacks: { label: 'Lanches', icon: 'coffee' },
};

export default function MealSection({ meal, items, totalCalories, onAddFood, onRemoveFood }: MealSectionProps) {
  const [open, setOpen] = useState(true);
  const anim = useRef(new Animated.Value(1)).current;
  const config = MEAL_CONFIG[meal];

  const toggle = () => {
    Animated.timing(anim, { toValue: open ? 0 : 1, duration: 250, useNativeDriver: false }).start();
    setOpen(v => !v);
  };

  const maxH = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 500] });

  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.header} onPress={toggle} activeOpacity={0.7}>
        <View style={styles.headerLeft}>
          <View style={styles.iconBox}>
            <Feather name={config.icon} size={16} color={Colors.primary} />
          </View>
          <Text style={styles.mealName}>{config.label}</Text>
          {items.length > 0 && <View style={styles.countPill}><Text style={styles.countText}>{items.length}</Text></View>}
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.kcal}>{Math.round(totalCalories)} kcal</Text>
          <Feather name={open ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textDisabled} />
        </View>
      </TouchableOpacity>

      <Animated.View style={{ maxHeight: maxH, overflow: 'hidden' }}>
        {items.length > 0 && <View style={styles.divider} />}
        {items.map((item, i) => (
          <View key={item.id} style={[styles.foodRow, i < items.length - 1 && styles.foodDivider]}>
            <Text style={styles.foodName} numberOfLines={1}>{item.name}</Text>
            <View style={styles.foodRight}>
              <Text style={styles.foodKcal}>{Math.round(item.calories)} kcal</Text>
              <TouchableOpacity onPress={() => onRemoveFood(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Feather name="x" size={14} color={Colors.textDisabled} />
              </TouchableOpacity>
            </View>
          </View>
        ))}
        <View style={styles.divider} />
        <TouchableOpacity style={styles.addBtn} onPress={onAddFood} activeOpacity={0.7}>
          <Feather name="plus" size={15} color={Colors.primary} />
          <Text style={styles.addText}>Adicionar alimento</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// Named export for backward compatibility
export { MealSection };

const styles = StyleSheet.create({
  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', ...Shadow.card, marginBottom: Spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  iconBox: { width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  mealName: { fontSize: Typography.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  countPill: { backgroundColor: Colors.primaryLight, paddingHorizontal: 7, paddingVertical: 2, borderRadius: Radius.pill },
  countText: { fontSize: Typography.xs, fontWeight: FontWeight.semibold, color: Colors.primary },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  kcal: { fontSize: Typography.sm, color: Colors.textSecondary },
  divider: { height: 1, backgroundColor: Colors.border, marginHorizontal: Spacing.lg },
  foodRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: 10 },
  foodDivider: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  foodName: { flex: 1, fontSize: Typography.sm, color: Colors.textPrimary, marginRight: Spacing.md },
  foodRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  foodKcal: { fontSize: Typography.sm, color: Colors.textSecondary },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: Spacing.lg, paddingVertical: 12 },
  addText: { fontSize: Typography.sm, fontWeight: FontWeight.medium, color: Colors.primary },
});
