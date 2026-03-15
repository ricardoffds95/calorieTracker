import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors, Typography, FontWeight, Spacing, Radius, Shadow } from '../constants/theme';
import { MealType, DiaryEntry, MealEntry } from '../store/foodStore';

interface MealSectionProps {
  meal: MealType;
  items: DiaryEntry[];
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

function MealEntryRow({ entry, onRemove }: { entry: MealEntry; onRemove: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const rotation = useRef(new Animated.Value(0)).current;

  const toggle = () => {
    Animated.timing(rotation, { toValue: expanded ? 0 : 1, duration: 200, useNativeDriver: true }).start();
    setExpanded(v => !v);
  };

  const rotateStyle = {
    transform: [{ rotate: rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] }) }],
  };

  return (
    <View>
      <TouchableOpacity onPress={toggle} style={rowStyles.mealRow} activeOpacity={0.7}>
        <Animated.View style={rotateStyle}>
          <Feather name="chevron-right" size={15} color={Colors.textSecondary} />
        </Animated.View>
        <Text style={rowStyles.mealName} numberOfLines={1}>{entry.name}</Text>
        <View style={rowStyles.mealRight}>
          <Text style={rowStyles.mealCals}>{Math.round(entry.totalCalories)} kcal</Text>
          <TouchableOpacity onPress={onRemove} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="x" size={14} color={Colors.textDisabled} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>

      {expanded && entry.items.map((item, i) => (
        <View key={i} style={rowStyles.subItem}>
          <Text style={rowStyles.subItemName} numberOfLines={1}>└ {item.name}</Text>
          <Text style={rowStyles.subItemCals}>{Math.round(item.calories)} kcal</Text>
        </View>
      ))}
    </View>
  );
}

export default function MealSection({ meal, items, totalCalories, onAddFood, onRemoveFood }: MealSectionProps) {
  const [open, setOpen] = useState(true);
  const anim = useRef(new Animated.Value(1)).current;
  const config = MEAL_CONFIG[meal];

  const toggle = () => {
    Animated.timing(anim, { toValue: open ? 0 : 1, duration: 250, useNativeDriver: false }).start();
    setOpen(v => !v);
  };

  const maxH = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 800] });

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
        {items.map((entry, i) => {
          const isLast = i === items.length - 1;
          if (entry.type === 'meal') {
            return (
              <View key={entry.id} style={!isLast ? styles.foodDivider : undefined}>
                <MealEntryRow entry={entry} onRemove={() => onRemoveFood(entry.id)} />
              </View>
            );
          }
          return (
            <View key={entry.id} style={[styles.foodRow, !isLast && styles.foodDivider]}>
              <Text style={styles.foodName} numberOfLines={1}>{entry.name}</Text>
              <View style={styles.foodRight}>
                <Text style={styles.foodKcal}>{Math.round(entry.calories)} kcal</Text>
                <TouchableOpacity onPress={() => onRemoveFood(entry.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Feather name="x" size={14} color={Colors.textDisabled} />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
        <View style={styles.divider} />
        <TouchableOpacity style={styles.addBtn} onPress={onAddFood} activeOpacity={0.7}>
          <Feather name="plus" size={15} color={Colors.primary} />
          <Text style={styles.addText}>Adicionar alimento</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

export { MealSection };

const rowStyles = StyleSheet.create({
  mealRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: 10, gap: 8 },
  mealName: { flex: 1, fontSize: Typography.sm, color: Colors.textPrimary, fontWeight: FontWeight.semibold },
  mealRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  mealCals: { fontSize: Typography.sm, color: Colors.textSecondary },
  subItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: Spacing.xl + 8, paddingRight: Spacing.lg, paddingVertical: 5 },
  subItemName: { flex: 1, fontSize: Typography.xs, color: Colors.textSecondary, marginRight: 8 },
  subItemCals: { fontSize: Typography.xs, color: Colors.textDisabled },
});

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
