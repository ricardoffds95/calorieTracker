import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useDailyGoals } from '../../hooks/useDailyGoals';
import { GoalMode } from '../../store/goalsStore';
import { calculateMacrosFromCalories, GOAL_PRESETS } from '../../constants/macros';
import { Colors, Typography, FontWeight, Spacing, Radius, Shadow } from '../../constants/theme';
import { MacroColors } from '../../constants/theme';

type GoalOption = { key: GoalMode; label: string; desc: string; icon: 'trending-down' | 'minus' | 'trending-up' };

const GOAL_OPTIONS: GoalOption[] = [
  { key: 'cut', label: 'Perder peso', desc: 'Défice calórico', icon: 'trending-down' },
  { key: 'maintain', label: 'Manter peso', desc: 'Calorias de manutenção', icon: 'minus' },
  { key: 'bulk', label: 'Ganhar massa', desc: 'Excedente calórico', icon: 'trending-up' },
];

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { name, goalMode, goals, setName, setGoalMode, setGoals, updateCaloriesAndRecalculate } = useDailyGoals();

  const [localName, setLocalName] = useState(name);
  const [localCalories, setLocalCalories] = useState(goals.calories.toString());
  const [localProteinPct, setLocalProteinPct] = useState(
    Math.round((goals.protein * 4 / goals.calories) * 100).toString()
  );
  const [localCarbsPct, setLocalCarbsPct] = useState(
    Math.round((goals.carbs * 4 / goals.calories) * 100).toString()
  );
  const [localFatPct, setLocalFatPct] = useState(
    Math.round((goals.fat * 9 / goals.calories) * 100).toString()
  );

  const recalcFromGoalMode = (mode: GoalMode) => {
    const preset = GOAL_PRESETS[mode];
    setLocalProteinPct(Math.round(preset.proteinPct * 100).toString());
    setLocalCarbsPct(Math.round(preset.carbsPct * 100).toString());
    setLocalFatPct(Math.round(preset.fatPct * 100).toString());
  };

  const handleGoalModeChange = (mode: GoalMode) => {
    setGoalMode(mode);
    recalcFromGoalMode(mode);
  };

  const handleSave = () => {
    const cals = parseInt(localCalories);
    const pPct = parseInt(localProteinPct) / 100;
    const cPct = parseInt(localCarbsPct) / 100;
    const fPct = parseInt(localFatPct) / 100;

    if (!cals || cals < 500 || cals > 10000) {
      Alert.alert('Erro', 'Insere um valor de calorias válido (500–10000)');
      return;
    }

    const total = pPct + cPct + fPct;
    if (Math.abs(total - 1) > 0.05) {
      Alert.alert('Erro', `A soma das percentagens deve ser 100% (atual: ${Math.round(total * 100)}%)`);
      return;
    }

    setName(localName.trim() || 'Utilizador');
    const newGoals = calculateMacrosFromCalories(cals, pPct, cPct, fPct);
    setGoals(newGoals);
    Alert.alert('Guardado!', 'Os teus objetivos foram atualizados.');
  };

  const previewGoals = (() => {
    const cals = parseInt(localCalories) || goals.calories;
    const pPct = (parseInt(localProteinPct) || 30) / 100;
    const cPct = (parseInt(localCarbsPct) || 40) / 100;
    const fPct = (parseInt(localFatPct) || 30) / 100;
    return calculateMacrosFromCalories(cals, pPct, cPct, fPct);
  })();

  const totalPct = (parseInt(localProteinPct) || 0) + (parseInt(localCarbsPct) || 0) + (parseInt(localFatPct) || 0);
  const pctOk = Math.abs(totalPct - 100) < 3;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Perfil e Objetivos</Text>

        {/* Name */}
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>O teu nome</Text>
          <TextInput
            style={styles.input}
            value={localName}
            onChangeText={setLocalName}
            placeholder="O teu nome"
            placeholderTextColor={Colors.textDisabled}
          />
        </View>

        {/* Goal mode */}
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Objetivo</Text>
          <View style={styles.goalOptions}>
            {GOAL_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.goalCard, goalMode === opt.key && styles.goalCardActive]}
                onPress={() => handleGoalModeChange(opt.key)}
                activeOpacity={0.7}
              >
                <View style={[styles.goalIconBox, goalMode === opt.key && styles.goalIconBoxActive]}>
                  <Feather name={opt.icon} size={16} color={goalMode === opt.key ? Colors.primary : Colors.textSecondary} />
                </View>
                <Text style={[styles.goalLabel, goalMode === opt.key && styles.goalLabelActive]}>
                  {opt.label}
                </Text>
                <Text style={styles.goalDesc}>{opt.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Calorie goal */}
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Calorias diárias</Text>
          <View style={styles.calorieRow}>
            <TouchableOpacity
              style={styles.adjBtn}
              onPress={() => setLocalCalories(Math.max(500, (parseInt(localCalories) || 2000) - 50).toString())}
            >
              <Text style={styles.adjBtnTxt}>-</Text>
            </TouchableOpacity>
            <TextInput
              style={styles.calorieInput}
              value={localCalories}
              onChangeText={setLocalCalories}
              keyboardType="number-pad"
              textAlign="center"
            />
            <Text style={styles.calorieUnit}>kcal</Text>
            <TouchableOpacity
              style={styles.adjBtn}
              onPress={() => setLocalCalories(Math.min(10000, (parseInt(localCalories) || 2000) + 50).toString())}
            >
              <Text style={styles.adjBtnTxt}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Macro split */}
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Distribuição de macros</Text>
          <MacroPctInput
            label="Proteína"
            color={MacroColors.protein}
            value={localProteinPct}
            onChange={setLocalProteinPct}
          />
          <MacroPctInput
            label="Hidratos"
            color={MacroColors.carbs}
            value={localCarbsPct}
            onChange={setLocalCarbsPct}
          />
          <MacroPctInput
            label="Gordura"
            color={MacroColors.fat}
            value={localFatPct}
            onChange={setLocalFatPct}
          />
          <Text style={styles.totalPct}>
            Total:{' '}
            <Text style={{ color: pctOk ? Colors.success : MacroColors.fat, fontWeight: FontWeight.bold }}>
              {totalPct}%
            </Text>
          </Text>
        </View>

        {/* Preview */}
        <View style={[styles.card, styles.previewCard]}>
          <Text style={styles.fieldLabel}>Pré-visualização</Text>
          <View style={styles.previewRow}>
            <PreviewMacro label="Calorias" value={previewGoals.calories} unit="kcal" color={Colors.primary} />
            <PreviewMacro label="Proteína" value={previewGoals.protein} unit="g" color={MacroColors.protein} />
            <PreviewMacro label="Hidratos" value={previewGoals.carbs} unit="g" color={MacroColors.carbs} />
            <PreviewMacro label="Gordura" value={previewGoals.fat} unit="g" color={MacroColors.fat} />
          </View>
        </View>

        {/* Save */}
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.8}>
          <Feather name="check" size={18} color={Colors.white} />
          <Text style={styles.saveBtnTxt}>Guardar objetivos</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

function MacroPctInput({ label, color, value, onChange }: { label: string; color: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={pctStyles.row}>
      <View style={[pctStyles.dot, { backgroundColor: color }]} />
      <Text style={pctStyles.label}>{label}</Text>
      <View style={pctStyles.controls}>
        <TouchableOpacity style={pctStyles.btn} onPress={() => onChange(Math.max(5, (parseInt(value) || 0) - 5).toString())}>
          <Text style={pctStyles.btnTxt}>-</Text>
        </TouchableOpacity>
        <TextInput
          style={[pctStyles.input, { borderColor: color + '60' }]}
          value={value}
          onChangeText={onChange}
          keyboardType="number-pad"
          textAlign="center"
        />
        <Text style={pctStyles.pct}>%</Text>
        <TouchableOpacity style={pctStyles.btn} onPress={() => onChange(Math.min(80, (parseInt(value) || 0) + 5).toString())}>
          <Text style={pctStyles.btnTxt}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const pctStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm, gap: Spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  label: { flex: 1, fontSize: Typography.base, color: Colors.textPrimary },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  btn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.backgroundSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  btnTxt: { fontSize: Typography.base, color: Colors.textPrimary, fontWeight: FontWeight.bold },
  input: {
    width: 50,
    backgroundColor: Colors.backgroundSubtle,
    borderRadius: Radius.sm,
    paddingVertical: 4,
    color: Colors.textPrimary,
    fontSize: Typography.base,
    fontWeight: FontWeight.semibold,
    borderWidth: 1,
  },
  pct: { fontSize: Typography.sm, color: Colors.textSecondary },
});

function PreviewMacro({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={{ fontSize: Typography.lg, color, fontWeight: FontWeight.bold }}>
        {value}
      </Text>
      <Text style={{ fontSize: Typography.xs, color: Colors.textSecondary }}>{unit}</Text>
      <Text style={{ fontSize: Typography.xs, color: Colors.textDisabled }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg },
  title: {
    fontSize: Typography.xxl,
    color: Colors.textPrimary,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.lg,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.card,
  },
  previewCard: {
    borderColor: Colors.primaryLight,
    backgroundColor: Colors.surfaceElevated,
  },
  fieldLabel: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    fontWeight: FontWeight.semibold,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  input: {
    backgroundColor: Colors.backgroundSubtle,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    color: Colors.textPrimary,
    fontSize: Typography.base,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  goalOptions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  goalCard: {
    flex: 1,
    backgroundColor: Colors.backgroundSubtle,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 4,
  },
  goalCardActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  goalIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalIconBoxActive: {
    backgroundColor: Colors.primary + '20',
  },
  goalLabel: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    fontWeight: FontWeight.semibold,
    textAlign: 'center',
  },
  goalLabelActive: { color: Colors.primary },
  goalDesc: {
    fontSize: 10,
    color: Colors.textDisabled,
    textAlign: 'center',
  },
  calorieRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  adjBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.backgroundSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  adjBtnTxt: {
    fontSize: Typography.xl,
    color: Colors.textPrimary,
    fontWeight: FontWeight.bold,
  },
  calorieInput: {
    flex: 1,
    backgroundColor: Colors.backgroundSubtle,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    color: Colors.textPrimary,
    fontSize: Typography.xl,
    fontWeight: FontWeight.bold,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  calorieUnit: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  totalPct: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    textAlign: 'right',
    marginTop: 4,
  },
  previewRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md + 2,
    alignItems: 'center',
    marginBottom: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    ...Shadow.strong,
  },
  saveBtnTxt: {
    color: Colors.white,
    fontSize: Typography.md,
    fontWeight: FontWeight.bold,
  },
});
