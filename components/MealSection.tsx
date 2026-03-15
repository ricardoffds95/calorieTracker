import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Modal, TextInput, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors, Typography, FontWeight, Spacing, Radius, Shadow } from '../constants/theme';
import { MealType, DiaryEntry, MealEntry, FoodEntry, useFoodStore } from '../store/foodStore';
import { format } from 'date-fns';

interface MealSectionProps {
  meal: MealType;
  items: DiaryEntry[];
  totalCalories: number;
  onAddFood: () => void;
  onRemoveFood: (id: string) => void;
  date?: string;
}

const MEAL_CONFIG: Record<MealType, { label: string; icon: 'sunrise' | 'sun' | 'moon' | 'coffee' }> = {
  breakfast: { label: 'Pequeno-almoço', icon: 'sunrise' },
  lunch: { label: 'Almoço', icon: 'sun' },
  dinner: { label: 'Jantar', icon: 'moon' },
  snacks: { label: 'Lanches', icon: 'coffee' },
};

// ─── Edit Modal ───────────────────────────────────────────────────────────────

interface EditState {
  id: string;
  type: 'food' | 'meal';
  name: string;
  quantity_g: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
}

function EditModal({
  state, onClose, onSave,
}: {
  state: EditState;
  onClose: () => void;
  onSave: (s: EditState) => void;
}) {
  const [s, setS] = useState(state);
  const set = (k: keyof EditState, v: string) => setS(prev => ({ ...prev, [k]: v }));

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={editStyles.overlay}>
        <View style={editStyles.box}>
          <Text style={editStyles.title}>Editar {s.type === 'meal' ? 'refeição' : 'alimento'}</Text>

          <Text style={editStyles.label}>Nome</Text>
          <TextInput style={editStyles.input} value={s.name} onChangeText={v => set('name', v)} />

          {s.type === 'food' && (
            <View style={editStyles.row}>
              <View style={{ flex: 1 }}>
                <Text style={editStyles.label}>Qtd (g)</Text>
                <TextInput style={editStyles.input} keyboardType="numeric" value={s.quantity_g} onChangeText={v => set('quantity_g', v)} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={editStyles.label}>Calorias (kcal)</Text>
                <TextInput style={editStyles.input} keyboardType="numeric" value={s.calories} onChangeText={v => set('calories', v)} />
              </View>
            </View>
          )}

          {s.type === 'meal' && (
            <View style={editStyles.row}>
              <View style={{ flex: 1 }}>
                <Text style={editStyles.label}>Calorias (kcal)</Text>
                <TextInput style={editStyles.input} keyboardType="numeric" value={s.calories} onChangeText={v => set('calories', v)} />
              </View>
            </View>
          )}

          <View style={editStyles.row}>
            <View style={{ flex: 1 }}>
              <Text style={editStyles.label}>Proteína (g)</Text>
              <TextInput style={editStyles.input} keyboardType="numeric" value={s.protein} onChangeText={v => set('protein', v)} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={editStyles.label}>Hidratos (g)</Text>
              <TextInput style={editStyles.input} keyboardType="numeric" value={s.carbs} onChangeText={v => set('carbs', v)} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={editStyles.label}>Gordura (g)</Text>
              <TextInput style={editStyles.input} keyboardType="numeric" value={s.fat} onChangeText={v => set('fat', v)} />
            </View>
          </View>

          <View style={editStyles.btns}>
            <TouchableOpacity style={editStyles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={editStyles.cancelTxt}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[editStyles.saveBtn, !s.name.trim() && { opacity: 0.4 }]}
              onPress={() => { if (s.name.trim()) onSave(s); }}
              activeOpacity={0.7}
              disabled={!s.name.trim()}
            >
              <Text style={editStyles.saveTxt}>Guardar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── MealEntryRow ────────────────────────────────────────────────────────────

function MealEntryRow({
  entry, onRemove, onEdit, onRemoveItem,
}: {
  entry: MealEntry;
  onRemove: () => void;
  onEdit: () => void;
  onRemoveItem: (itemId: string) => void;
}) {
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
          <TouchableOpacity onPress={onEdit} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="edit-2" size={13} color={Colors.textDisabled} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onRemove} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="x" size={14} color={Colors.textDisabled} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>

      {expanded && entry.items.map((item) => (
        <View key={item.id} style={rowStyles.subItem}>
          <Text style={rowStyles.subItemName} numberOfLines={1}>└ {item.name}</Text>
          <Text style={rowStyles.subItemCals}>{Math.round(item.calories)} kcal</Text>
          {entry.items.length > 1 && (
            <TouchableOpacity onPress={() => onRemoveItem(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x" size={12} color={Colors.textDisabled} />
            </TouchableOpacity>
          )}
        </View>
      ))}
    </View>
  );
}

// ─── MealSection ─────────────────────────────────────────────────────────────

export default function MealSection({ meal, items, totalCalories, onAddFood, onRemoveFood, date }: MealSectionProps) {
  const [open, setOpen] = useState(true);
  const anim = useRef(new Animated.Value(1)).current;
  const config = MEAL_CONFIG[meal];
  const updateEntry = useFoodStore(s => s.updateEntry);
  const removeItemFromMeal = useFoodStore(s => s.removeItemFromMeal);
  const [editState, setEditState] = useState<EditState | null>(null);

  const today = date ?? format(new Date(), 'yyyy-MM-dd');

  const toggle = () => {
    Animated.timing(anim, { toValue: open ? 0 : 1, duration: 250, useNativeDriver: false }).start();
    setOpen(v => !v);
  };

  const maxH = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 800] });

  const openEdit = (entry: DiaryEntry) => {
    if (entry.type === 'food') {
      setEditState({
        id: entry.id, type: 'food',
        name: entry.name,
        quantity_g: String(entry.quantity_g),
        calories: String(entry.calories),
        protein: String(entry.protein_g),
        carbs: String(entry.carbs_g),
        fat: String(entry.fat_g),
      });
    } else {
      setEditState({
        id: entry.id, type: 'meal',
        name: entry.name,
        quantity_g: '0',
        calories: String(entry.totalCalories),
        protein: String(entry.totalProtein),
        carbs: String(entry.totalCarbs),
        fat: String(entry.totalFat),
      });
    }
  };

  const saveEdit = (s: EditState) => {
    if (s.type === 'food') {
      updateEntry(s.id, {
        name: s.name.trim(),
        quantity_g: parseFloat(s.quantity_g) || 0,
        calories: parseFloat(s.calories) || 0,
        protein_g: parseFloat(s.protein) || 0,
        carbs_g: parseFloat(s.carbs) || 0,
        fat_g: parseFloat(s.fat) || 0,
      }, today);
    } else {
      updateEntry(s.id, {
        name: s.name.trim(),
        totalCalories: parseFloat(s.calories) || 0,
        totalProtein: parseFloat(s.protein) || 0,
        totalCarbs: parseFloat(s.carbs) || 0,
        totalFat: parseFloat(s.fat) || 0,
      }, today);
    }
    setEditState(null);
  };

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
                <MealEntryRow
                  entry={entry}
                  onRemove={() => onRemoveFood(entry.id)}
                  onEdit={() => openEdit(entry)}
                  onRemoveItem={(itemId) => removeItemFromMeal(entry.id, itemId, today)}
                />
              </View>
            );
          }
          return (
            <View key={entry.id} style={[styles.foodRow, !isLast && styles.foodDivider]}>
              <Text style={styles.foodName} numberOfLines={1}>{entry.name}</Text>
              <View style={styles.foodRight}>
                <Text style={styles.foodKcal}>{Math.round(entry.calories)} kcal</Text>
                <TouchableOpacity onPress={() => openEdit(entry)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Feather name="edit-2" size={13} color={Colors.textDisabled} />
                </TouchableOpacity>
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

      {editState && (
        <EditModal state={editState} onClose={() => setEditState(null)} onSave={saveEdit} />
      )}
    </View>
  );
}

export { MealSection };

const rowStyles = StyleSheet.create({
  mealRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: 10, gap: 8 },
  mealName: { flex: 1, fontSize: Typography.sm, color: Colors.textPrimary, fontWeight: FontWeight.semibold },
  mealRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mealCals: { fontSize: Typography.sm, color: Colors.textSecondary },
  subItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: Spacing.xl + 8, paddingRight: Spacing.lg, paddingVertical: 5 },
  subItemName: { flex: 1, fontSize: Typography.xs, color: Colors.textSecondary, marginRight: 8 },
  subItemCals: { fontSize: Typography.xs, color: Colors.textDisabled },
});

const editStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  box: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.xl, width: '100%', gap: Spacing.sm, ...Shadow.strong },
  title: { fontSize: Typography.lg, color: Colors.textPrimary, fontWeight: FontWeight.bold, marginBottom: 4 },
  label: { fontSize: Typography.xs, color: Colors.textSecondary, fontWeight: FontWeight.medium, marginBottom: 3 },
  input: { backgroundColor: Colors.backgroundSubtle, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, color: Colors.textPrimary, fontSize: Typography.base, borderWidth: 1, borderColor: Colors.border },
  row: { flexDirection: 'row', gap: Spacing.sm },
  btns: { flexDirection: 'row', gap: Spacing.sm, marginTop: 4 },
  cancelBtn: { flex: 1, borderRadius: Radius.lg, paddingVertical: Spacing.sm + 2, alignItems: 'center', backgroundColor: Colors.backgroundSubtle, borderWidth: 1, borderColor: Colors.border },
  cancelTxt: { color: Colors.textSecondary, fontSize: Typography.base, fontWeight: FontWeight.medium },
  saveBtn: { flex: 1, borderRadius: Radius.lg, paddingVertical: Spacing.sm + 2, alignItems: 'center', backgroundColor: Colors.primary, ...Shadow.card },
  saveTxt: { color: Colors.white, fontSize: Typography.base, fontWeight: FontWeight.bold },
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
  foodName: { flex: 1, fontSize: Typography.sm, color: Colors.textPrimary, marginRight: Spacing.sm },
  foodRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  foodKcal: { fontSize: Typography.sm, color: Colors.textSecondary },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: Spacing.lg, paddingVertical: 12 },
  addText: { fontSize: Typography.sm, fontWeight: FontWeight.medium, color: Colors.primary },
});
