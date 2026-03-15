import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFood } from '../../hooks/useFood';
import { useDailyGoals } from '../../hooks/useDailyGoals';
import { parseFoodFromText, ParsedFoodItem } from '../../services/claudeAI';
import { searchFood, calculateNutrientsForQuantity, FoodSearchResult } from '../../services/openFoodFacts';
import { Colors, Typography, FontWeight, Spacing, Radius, Shadow } from '../../constants/theme';
import { MacroColors } from '../../constants/theme';
import { MealType } from '../../store/foodStore';

type InputMode = 'ai' | 'search';
type MealLabel = { key: MealType; label: string };

const MEALS: MealLabel[] = [
  { key: 'breakfast', label: 'Pequeno-almoço' },
  { key: 'lunch', label: 'Almoço' },
  { key: 'dinner', label: 'Jantar' },
  { key: 'snacks', label: 'Snacks' },
];

// Replace with your actual API key or load from config
const CLAUDE_API_KEY = process.env.EXPO_PUBLIC_CLAUDE_API_KEY ?? '';

export default function LogScreen() {
  const router = useRouter();
  const { addFood } = useFood();
  const [mode, setMode] = useState<InputMode>('ai');
  const [meal, setMeal] = useState<MealType>('lunch');
  const [aiText, setAiText] = useState('');
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(false);
  const [parsedItems, setParsedItems] = useState<ParsedFoodItem[]>([]);
  const [searchResults, setSearchResults] = useState<FoodSearchResult[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const handleAiParse = async () => {
    if (!aiText.trim()) return;
    setLoading(true);
    try {
      const items = await parseFoodFromText(aiText, CLAUDE_API_KEY);
      setParsedItems(items);
      setSearchResults([]);
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Não foi possível processar o texto');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchText.trim()) return;
    setLoading(true);
    try {
      const results = await searchFood(searchText);
      setSearchResults(results);
      setParsedItems([]);
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Erro na pesquisa');
    } finally {
      setLoading(false);
    }
  };

  const saveAiItems = () => {
    parsedItems.forEach((item) => {
      addFood({
        name: item.name,
        quantity_g: item.quantity_g,
        calories: item.calories,
        protein_g: item.protein_g,
        carbs_g: item.carbs_g,
        fat_g: item.fat_g,
        meal,
      });
    });
    setParsedItems([]);
    setAiText('');
    router.push('/(tabs)/');
  };

  const saveSearchItem = (result: FoodSearchResult) => {
    const qty = quantities[result.id] ?? 100;
    const nutrients = calculateNutrientsForQuantity(result, qty);
    addFood({
      name: result.name,
      quantity_g: qty,
      calories: nutrients.calories,
      protein_g: nutrients.protein_g,
      carbs_g: nutrients.carbs_g,
      fat_g: nutrients.fat_g,
      meal,
    });
    router.push('/(tabs)/');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Registar Alimentos</Text>

          {/* Mode Toggle */}
          <View style={styles.modeToggle}>
            <TouchableOpacity
              style={[styles.modeBtn, mode === 'ai' && styles.modeBtnActive]}
              onPress={() => setMode('ai')}
              activeOpacity={0.7}
            >
              <Text style={[styles.modeBtnTxt, mode === 'ai' && styles.modeBtnTxtActive]}>
                ✨ IA
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, mode === 'search' && styles.modeBtnActive]}
              onPress={() => setMode('search')}
              activeOpacity={0.7}
            >
              <Text style={[styles.modeBtnTxt, mode === 'search' && styles.modeBtnTxtActive]}>
                🔍 Pesquisar
              </Text>
            </TouchableOpacity>
          </View>

          {/* Meal selector */}
          <View style={styles.mealRow}>
            {MEALS.map((m) => (
              <TouchableOpacity
                key={m.key}
                style={[styles.mealPill, meal === m.key && styles.mealPillActive]}
                onPress={() => setMeal(m.key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.mealPillTxt, meal === m.key && styles.mealPillTxtActive]}>
                  {m.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* AI Input */}
          {mode === 'ai' && (
            <View style={styles.section}>
              <Text style={styles.hint}>
                Descreve o que comeste em português ou inglês
              </Text>
              <TextInput
                style={styles.textArea}
                placeholder="ex: comi 150g de frango grelhado com arroz e salada"
                placeholderTextColor={Colors.textDisabled}
                multiline
                numberOfLines={4}
                value={aiText}
                onChangeText={setAiText}
                textAlignVertical="top"
              />
              <TouchableOpacity
                style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
                onPress={handleAiParse}
                activeOpacity={0.8}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={Colors.background} />
                ) : (
                  <Text style={styles.primaryBtnTxt}>Analisar com IA</Text>
                )}
              </TouchableOpacity>

              {parsedItems.length > 0 && (
                <View style={styles.resultsContainer}>
                  <Text style={styles.resultsTitle}>Alimentos identificados:</Text>
                  {parsedItems.map((item, idx) => (
                    <View key={idx} style={styles.resultCard}>
                      <View style={styles.resultHeader}>
                        <Text style={styles.resultName}>{item.name}</Text>
                        <Text style={styles.resultQty}>{item.quantity_g}g</Text>
                      </View>
                      <View style={styles.resultMacros}>
                        <MacroChip value={item.calories} label="kcal" color={Colors.accent} />
                        <MacroChip value={item.protein_g} label="P" color={MacroColors.protein} />
                        <MacroChip value={item.carbs_g} label="C" color={MacroColors.carbs} />
                        <MacroChip value={item.fat_g} label="G" color={MacroColors.fat} />
                      </View>
                    </View>
                  ))}
                  <TouchableOpacity style={styles.saveBtn} onPress={saveAiItems} activeOpacity={0.8}>
                    <Text style={styles.saveBtnTxt}>
                      Guardar {parsedItems.length} alimento{parsedItems.length !== 1 ? 's' : ''}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* Search */}
          {mode === 'search' && (
            <View style={styles.section}>
              <View style={styles.searchRow}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="ex: frango, arroz, banana..."
                  placeholderTextColor={Colors.textDisabled}
                  value={searchText}
                  onChangeText={setSearchText}
                  returnKeyType="search"
                  onSubmitEditing={handleSearch}
                />
                <TouchableOpacity
                  style={styles.searchBtn}
                  onPress={handleSearch}
                  activeOpacity={0.8}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color={Colors.background} size="small" />
                  ) : (
                    <Text style={styles.searchBtnTxt}>🔍</Text>
                  )}
                </TouchableOpacity>
              </View>

              {searchResults.map((result) => (
                <View key={result.id} style={styles.resultCard}>
                  <Text style={styles.resultName}>{result.name}</Text>
                  {result.brand && (
                    <Text style={styles.resultBrand}>{result.brand}</Text>
                  )}
                  <View style={styles.resultMacros}>
                    <MacroChip value={result.calories_100g} label="kcal/100g" color={Colors.accent} />
                    <MacroChip value={result.protein_100g} label="P" color={MacroColors.protein} />
                    <MacroChip value={result.carbs_100g} label="C" color={MacroColors.carbs} />
                    <MacroChip value={result.fat_100g} label="G" color={MacroColors.fat} />
                  </View>
                  <View style={styles.qtyRow}>
                    <TouchableOpacity
                      style={styles.qtyBtn}
                      onPress={() =>
                        setQuantities((q) => ({ ...q, [result.id]: Math.max(10, (q[result.id] ?? 100) - 10) }))
                      }
                    >
                      <Text style={styles.qtyBtnTxt}>−</Text>
                    </TouchableOpacity>
                    <Text style={styles.qtyValue}>{quantities[result.id] ?? 100}g</Text>
                    <TouchableOpacity
                      style={styles.qtyBtn}
                      onPress={() =>
                        setQuantities((q) => ({ ...q, [result.id]: (q[result.id] ?? 100) + 10 }))
                      }
                    >
                      <Text style={styles.qtyBtnTxt}>+</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.saveBtn, { flex: 1, marginTop: 0 }]}
                      onPress={() => saveSearchItem(result)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.saveBtnTxt}>Adicionar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function MacroChip({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <View style={[chipStyles.chip, { borderColor: color + '50' }]}>
      <Text style={[chipStyles.value, { color }]}>{Math.round(value * 10) / 10}</Text>
      <Text style={chipStyles.label}>{label}</Text>
    </View>
  );
}

const chipStyles = StyleSheet.create({
  chip: {
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: 7,
    paddingVertical: 3,
    alignItems: 'center',
  },
  value: {
    fontSize: Typography.sm,
    fontWeight: FontWeight.bold,
  },
  label: {
    fontSize: 10,
    color: Colors.textMuted,
  },
});

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
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 4,
    marginBottom: Spacing.md,
    gap: 4,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  modeBtnActive: {
    backgroundColor: Colors.accent,
  },
  modeBtnTxt: {
    fontSize: Typography.base,
    color: Colors.textMuted,
    fontWeight: FontWeight.medium,
  },
  modeBtnTxtActive: {
    color: Colors.background,
    fontWeight: FontWeight.bold,
  },
  mealRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  mealPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  mealPillActive: {
    backgroundColor: Colors.accent + '20',
    borderColor: Colors.accent,
  },
  mealPillTxt: {
    fontSize: Typography.sm,
    color: Colors.textMuted,
    fontWeight: FontWeight.medium,
  },
  mealPillTxtActive: {
    color: Colors.accent,
    fontWeight: FontWeight.semibold,
  },
  section: { gap: Spacing.md },
  hint: {
    fontSize: Typography.sm,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  textArea: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    color: Colors.text,
    fontSize: Typography.base,
    minHeight: 100,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  primaryBtn: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    ...Shadow.accent,
  },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnTxt: {
    color: Colors.background,
    fontSize: Typography.base,
    fontWeight: FontWeight.bold,
  },
  resultsContainer: { gap: Spacing.sm },
  resultsTitle: {
    fontSize: Typography.base,
    color: Colors.text,
    fontWeight: FontWeight.semibold,
  },
  resultCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
    ...Shadow.sm,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultName: {
    fontSize: Typography.base,
    color: Colors.text,
    fontWeight: FontWeight.semibold,
    flex: 1,
  },
  resultBrand: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
  },
  resultQty: {
    fontSize: Typography.sm,
    color: Colors.textMuted,
  },
  resultMacros: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  saveBtn: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    marginTop: 4,
  },
  saveBtnTxt: {
    color: Colors.background,
    fontSize: Typography.base,
    fontWeight: FontWeight.bold,
  },
  searchRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    color: Colors.text,
    fontSize: Typography.base,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchBtn: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 52,
  },
  searchBtnTxt: { fontSize: 20 },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  qtyBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnTxt: {
    fontSize: Typography.lg,
    color: Colors.text,
    fontWeight: FontWeight.bold,
  },
  qtyValue: {
    fontSize: Typography.base,
    color: Colors.text,
    fontWeight: FontWeight.semibold,
    minWidth: 50,
    textAlign: 'center',
  },
});
