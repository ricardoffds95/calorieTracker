import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Alert,
} from 'react-native';
import { useDailyGoals } from '../../hooks/useDailyGoals';
import { GoalMode } from '../../store/goalsStore';
import { calculateMacrosFromCalories, GOAL_PRESETS } from '../../constants/macros';
import { Colors, Typography, FontWeight, Spacing, Radius, Shadow } from '../../constants/theme';
import { MacroColors } from '../../constants/theme';

type GoalOption = { key: GoalMode; label: string; desc: string; emoji: string };

const GOAL_OPTIONS: GoalOption[] = [
  { key: 'cut', label: 'Perder peso', desc: 'Défice calórico', emoji: '📉' },
  { key: 'maintain', label: 'Manter peso', desc: 'Calorias de manutenção', emoji: '⚖️' },
  { key: 'bulk', label: 'Ganhar massa', desc: 'Excedente calórico', emoji: '📈' },
];

export default function ProfileScreen() {
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

  const recalcFromGoalMode = (mode: GoalMode, cals: number) => {
    const preset = GOAL_PRESETS[mode];
    setLocalProteinPct(Math.round(preset.proteinPct * 100).toString());
    setLocalCarbsPct(Math.round(preset.carbsPct * 100).toString());
    setLocalFatPct(Math.round(preset.fatPct * 100).toString());
  };

  const handleGoalModeChange = (mode: GoalMode) => {
    setGoalMode(mode);
    recalcFromGoalMode(mode, parseInt(localCalories) || 2000);
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

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Perfil & Objetivos</Text>

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
                <Text style={styles.goalEmoji}>{opt.emoji}</Text>
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
              <Text style={styles.adjBtnTxt}>−</Text>
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
            <Text style={{
              color:
                Math.abs(
                  (parseInt(localProteinPct) || 0) +
                  (parseInt(localCarbsPct) || 0) +
                  (parseInt(localFatPct) || 0) - 100
                ) < 3
                  ? Colors.accent
                  : Colors.accent2,
            }}>
              {(parseInt(localProteinPct) || 0) +
                (parseInt(localCarbsPct) || 0) +
                (parseInt(localFatPct) || 0)}%
            </Text>
          </Text>
        </View>

        {/* Preview */}
        <View style={[styles.card, styles.previewCard]}>
          <Text style={styles.fieldLabel}>Pré-visualização</Text>
          <View style={styles.previewRow}>
            <PreviewMacro label="Calorias" value={previewGoals.calories} unit="kcal" color={Colors.accent} />
            <PreviewMacro label="Proteína" value={previewGoals.protein} unit="g" color={MacroColors.protein} />
            <PreviewMacro label="Hidratos" value={previewGoals.carbs} unit="g" color={MacroColors.carbs} />
            <PreviewMacro label="Gordura" value={previewGoals.fat} unit="g" color={MacroColors.fat} />
          </View>
        </View>

        {/* Save */}
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.8}>
          <Text style={styles.saveBtnTxt}>Guardar objetivos</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function MacroPctInput({ label, color, value, onChange }: { label: string; color: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={pctStyles.row}>
      <View style={[pctStyles.dot, { backgroundColor: color }]} />
      <Text style={pctStyles.label}>{label}</Text>
      <View style={pctStyles.controls}>
        <TouchableOpacity style={pctStyles.btn} onPress={() => onChange(Math.max(5, (parseInt(value) || 0) - 5).toString())}>
          <Text style={pctStyles.btnTxt}>−</Text>
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
  label: { flex: 1, fontSize: Typography.base, color: Colors.text },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  btn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnTxt: { fontSize: Typography.base, color: Colors.text, fontWeight: FontWeight.bold },
  input: {
    width: 50,
    backgroundColor: Colors.surface2,
    borderRadius: Radius.sm,
    paddingVertical: 4,
    color: Colors.text,
    fontSize: Typography.base,
    fontWeight: FontWeight.semibold,
    borderWidth: 1,
  },
  pct: { fontSize: Typography.sm, color: Colors.textMuted },
});

function PreviewMacro({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={{ fontSize: Typography.lg, color, fontWeight: FontWeight.bold }}>
        {value}
      </Text>
      <Text style={{ fontSize: Typography.xs, color: Colors.textMuted }}>{unit}</Text>
      <Text style={{ fontSize: Typography.xs, color: Colors.textDisabled }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  content: { paddingHorizontal: Spacing.md, paddingTop: Spacing.lg },
  title: {
    fontSize: Typography.xxl,
    color: Colors.text,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.lg,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadow.sm,
  },
  previewCard: {
    borderWidth: 1,
    borderColor: Colors.accent + '30',
  },
  fieldLabel: {
    fontSize: Typography.sm,
    color: Colors.textMuted,
    fontWeight: FontWeight.medium,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  input: {
    backgroundColor: Colors.surface2,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    color: Colors.text,
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
    backgroundColor: Colors.surface2,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  goalCardActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accent + '15',
  },
  goalEmoji: { fontSize: 22, marginBottom: 4 },
  goalLabel: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    fontWeight: FontWeight.semibold,
    textAlign: 'center',
  },
  goalLabelActive: { color: Colors.accent },
  goalDesc: {
    fontSize: 10,
    color: Colors.textDisabled,
    textAlign: 'center',
    marginTop: 2,
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
    backgroundColor: Colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adjBtnTxt: {
    fontSize: Typography.xl,
    color: Colors.text,
    fontWeight: FontWeight.bold,
  },
  calorieInput: {
    flex: 1,
    backgroundColor: Colors.surface2,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    color: Colors.text,
    fontSize: Typography.xl,
    fontWeight: FontWeight.bold,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  calorieUnit: {
    fontSize: Typography.base,
    color: Colors.textMuted,
    fontWeight: FontWeight.medium,
  },
  totalPct: {
    fontSize: Typography.sm,
    color: Colors.textMuted,
    textAlign: 'right',
    marginTop: 4,
  },
  previewRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  saveBtn: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md + 2,
    alignItems: 'center',
    marginBottom: Spacing.md,
    ...Shadow.accent,
  },
  saveBtnTxt: {
    color: Colors.background,
    fontSize: Typography.md,
    fontWeight: FontWeight.bold,
  },
});
