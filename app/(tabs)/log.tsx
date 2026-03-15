import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { SaveFormat } from 'expo-image-manipulator';
import { useFood } from '../../hooks/useFood';
import { parseFoodWithAI, analyzeFoodImage, GeminiParsedItem } from '../../services/geminiAI';
import { searchFood, calculateNutrientsForQuantity, FoodSearchResult } from '../../services/openFoodFacts';
import { useSavedMealsStore, SavedMeal, SavedMealItem } from '../../store/savedMealsStore';
import { Colors, Typography, FontWeight, Spacing, Radius, Shadow } from '../../constants/theme';
import { MacroColors } from '../../constants/theme';
import { MealType } from '../../store/foodStore';

type InputMode = 'ai' | 'search' | 'photo' | 'saved';
type MealLabel = { key: MealType; label: string };

const MEALS: MealLabel[] = [
  { key: 'breakfast', label: 'Pequeno-almoço' },
  { key: 'lunch', label: 'Almoço' },
  { key: 'dinner', label: 'Jantar' },
  { key: 'snacks', label: 'Snacks' },
];

// ─── Helper components ────────────────────────────────────────────────────────

function PulseLoader({ text }: { text: string }) {
  return (
    <View style={{ alignItems: 'center', padding: 24, gap: 12 }}>
      <ActivityIndicator size="large" color={Colors.primary} />
      <Text style={{ color: Colors.textSecondary, fontSize: 14 }}>{text}</Text>
    </View>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <View style={{
      backgroundColor: '#FFF0F0',
      borderRadius: 12,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: 1,
      borderColor: '#FFD0D0',
    }}>
      <Feather name="alert-circle" size={18} color="#E85D75" />
      <Text style={{ color: '#E85D75', fontSize: 14, flex: 1 }}>{message}</Text>
    </View>
  );
}

function MacroChip({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <View style={[chipStyles.chip, { borderColor: color + '50', backgroundColor: color + '10' }]}>
      <Text style={[chipStyles.value, { color }]}>{Math.round(value * 10) / 10}</Text>
      <Text style={chipStyles.label}>{label}</Text>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function LogScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addFood } = useFood();
  const savedMealsStore = useSavedMealsStore();

  const [mode, setMode] = useState<InputMode>('ai');
  const [meal, setMeal] = useState<MealType>('lunch');

  // AI tab
  const [aiText, setAiText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [parsedItems, setParsedItems] = useState<GeminiParsedItem[]>([]);

  // Save meal modal
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [saveMealName, setSaveMealName] = useState('');
  const [pendingSaveItems, setPendingSaveItems] = useState<GeminiParsedItem[]>([]);

  // Search tab
  const [searchText, setSearchText] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<FoodSearchResult[]>([]);
  const [fromCache, setFromCache] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Photo tab
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoItems, setPhotoItems] = useState<GeminiParsedItem[]>([]);

  // ── AI handlers ─────────────────────────────────────────────────────────────

  const handleAiParse = async () => {
    if (!aiText.trim()) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const items = await parseFoodWithAI(aiText);
      setParsedItems(items);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Não foi possível processar o texto';
      setAiError(msg);
    } finally {
      setAiLoading(false);
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

  const openSaveMealModal = (items: GeminiParsedItem[]) => {
    setPendingSaveItems(items);
    setSaveMealName('');
    setSaveModalVisible(true);
  };

  const confirmSaveMeal = async () => {
    if (!saveMealName.trim()) return;
    const storeItems: SavedMealItem[] = pendingSaveItems.map((item) => ({
      id: Date.now().toString() + Math.random().toString(36).slice(2),
      name: item.name,
      quantity_g: item.quantity_g,
      calories: item.calories,
      protein_g: item.protein_g,
      carbs_g: item.carbs_g,
      fat_g: item.fat_g,
    }));
    await savedMealsStore.saveMeal(saveMealName.trim(), storeItems);
    setSaveModalVisible(false);
    setSaveMealName('');
  };

  // ── Search handlers ──────────────────────────────────────────────────────────

  const handleSearchChange = useCallback((text: string) => {
    setSearchText(text);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      if (text.trim().length >= 2) {
        runSearch(text);
      }
    }, 500);
  }, []);

  const runSearch = async (q: string) => {
    setSearchLoading(true);
    setSearchError(null);
    try {
      const { results, fromCache: cached } = await searchFood(q);
      setSearchResults(results);
      setFromCache(cached);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro na pesquisa';
      setSearchError(msg);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSearchSubmit = () => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    runSearch(searchText);
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

  // ── Photo handlers ───────────────────────────────────────────────────────────

  const processImageUri = async (uri: string) => {
    setPhotoLoading(true);
    setPhotoError(null);
    try {
      const manipulated = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 800 } }],
        { compress: 0.7, format: SaveFormat.JPEG, base64: true }
      );
      if (!manipulated.base64) throw new Error('Falha ao processar imagem');
      const items = await analyzeFoodImage(manipulated.base64);
      setPhotoItems(items);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao analisar imagem';
      setPhotoError(msg);
    } finally {
      setPhotoLoading(false);
    }
  };

  const handleTakePhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.9,
    });
    if (!result.canceled && result.assets[0]) {
      await processImageUri(result.assets[0].uri);
    }
  };

  const handlePickGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9,
    });
    if (!result.canceled && result.assets[0]) {
      await processImageUri(result.assets[0].uri);
    }
  };

  const savePhotoItems = () => {
    photoItems.forEach((item) => {
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
    setPhotoItems([]);
    router.push('/(tabs)/');
  };

  // ── Saved meals handlers ─────────────────────────────────────────────────────

  const addSavedMeal = (savedMeal: SavedMeal) => {
    savedMeal.items.forEach((item) => {
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
    savedMealsStore.incrementUsage(savedMeal.id);
    router.push('/(tabs)/');
  };

  const confirmDeleteMeal = (savedMeal: SavedMeal) => {
    Alert.alert(
      'Eliminar refeição',
      `Tens a certeza que queres eliminar "${savedMeal.name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => savedMealsStore.deleteMeal(savedMeal.id),
        },
      ]
    );
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Registar Alimentos</Text>

          {/* Mode Toggle */}
          <View style={styles.modeToggle}>
            <TouchableOpacity
              style={[styles.modeBtn, mode === 'ai' && styles.modeBtnActive]}
              onPress={() => setMode('ai')}
              activeOpacity={0.7}
            >
              <Feather name="zap" size={14} color={mode === 'ai' ? Colors.white : Colors.textSecondary} />
              <Text style={[styles.modeBtnTxt, mode === 'ai' && styles.modeBtnTxtActive]}>IA</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, mode === 'search' && styles.modeBtnActive]}
              onPress={() => setMode('search')}
              activeOpacity={0.7}
            >
              <Feather name="search" size={14} color={mode === 'search' ? Colors.white : Colors.textSecondary} />
              <Text style={[styles.modeBtnTxt, mode === 'search' && styles.modeBtnTxtActive]}>Pesquisar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, mode === 'photo' && styles.modeBtnActive]}
              onPress={() => setMode('photo')}
              activeOpacity={0.7}
            >
              <Feather name="camera" size={14} color={mode === 'photo' ? Colors.white : Colors.textSecondary} />
              <Text style={[styles.modeBtnTxt, mode === 'photo' && styles.modeBtnTxtActive]}>Foto</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, mode === 'saved' && styles.modeBtnActive]}
              onPress={() => setMode('saved')}
              activeOpacity={0.7}
            >
              <Feather name="bookmark" size={14} color={mode === 'saved' ? Colors.white : Colors.textSecondary} />
              <Text style={[styles.modeBtnTxt, mode === 'saved' && styles.modeBtnTxtActive]}>Guardados</Text>
            </TouchableOpacity>
          </View>

          {/* Meal selector — visible on all tabs */}
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

          {/* ── AI Tab ──────────────────────────────────────────────────── */}
          {mode === 'ai' && (
            <View style={styles.section}>
              <Text style={styles.hint}>Descreve o que comeste em português ou inglês</Text>
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
                style={[styles.primaryBtn, aiLoading && styles.primaryBtnDisabled]}
                onPress={handleAiParse}
                activeOpacity={0.8}
                disabled={aiLoading}
              >
                {aiLoading ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <>
                    <Feather name="zap" size={16} color={Colors.white} />
                    <Text style={styles.primaryBtnTxt}>Analisar com IA</Text>
                  </>
                )}
              </TouchableOpacity>

              {aiError && <ErrorCard message={aiError} />}

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
                        <MacroChip value={item.calories} label="kcal" color={Colors.primary} />
                        <MacroChip value={item.protein_g} label="P" color={MacroColors.protein} />
                        <MacroChip value={item.carbs_g} label="C" color={MacroColors.carbs} />
                        <MacroChip value={item.fat_g} label="G" color={MacroColors.fat} />
                      </View>
                    </View>
                  ))}
                  <TouchableOpacity style={styles.saveBtn} onPress={saveAiItems} activeOpacity={0.8}>
                    <Text style={styles.saveBtnTxt}>
                      Adicionar {parsedItems.length} alimento{parsedItems.length !== 1 ? 's' : ''}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.outlineBtn}
                    onPress={() => openSaveMealModal(parsedItems)}
                    activeOpacity={0.8}
                  >
                    <Feather name="bookmark" size={15} color={Colors.primary} />
                    <Text style={styles.outlineBtnTxt}>Guardar Refeição</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* ── Search Tab ──────────────────────────────────────────────── */}
          {mode === 'search' && (
            <View style={styles.section}>
              <View style={styles.searchRow}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="ex: frango, arroz, banana..."
                  placeholderTextColor={Colors.textDisabled}
                  value={searchText}
                  onChangeText={handleSearchChange}
                  returnKeyType="search"
                  onSubmitEditing={handleSearchSubmit}
                />
                <TouchableOpacity
                  style={styles.searchBtn}
                  onPress={handleSearchSubmit}
                  activeOpacity={0.8}
                  disabled={searchLoading}
                >
                  {searchLoading ? (
                    <ActivityIndicator color={Colors.white} size="small" />
                  ) : (
                    <Feather name="search" size={18} color={Colors.white} />
                  )}
                </TouchableOpacity>
              </View>

              {searchError && <ErrorCard message={searchError} />}

              {searchResults.length > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.resultsTitle}>{searchResults.length} resultados</Text>
                  {fromCache && (
                    <Feather name="zap" size={14} color={Colors.primary} />
                  )}
                </View>
              )}

              {searchResults.map((result) => (
                <View key={result.id} style={styles.resultCard}>
                  <Text style={styles.resultName}>{result.name}</Text>
                  {result.brand && (
                    <Text style={styles.resultBrand}>{result.brand}</Text>
                  )}
                  <View style={styles.resultMacros}>
                    <MacroChip value={result.calories_100g} label="kcal/100g" color={Colors.primary} />
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
                      <Text style={styles.qtyBtnTxt}>-</Text>
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

          {/* ── Photo Tab ───────────────────────────────────────────────── */}
          {mode === 'photo' && (
            <View style={styles.section}>
              <Text style={styles.hint}>Tira uma foto ou seleciona da galeria para identificar alimentos</Text>
              <View style={styles.photoButtonRow}>
                <TouchableOpacity
                  style={[styles.photoOutlineBtn, { flex: 1 }]}
                  onPress={handleTakePhoto}
                  activeOpacity={0.7}
                  disabled={photoLoading}
                >
                  <Feather name="camera" size={16} color={Colors.primary} />
                  <Text style={styles.photoOutlineBtnTxt}>Tirar Foto</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.photoOutlineBtn, { flex: 1 }]}
                  onPress={handlePickGallery}
                  activeOpacity={0.7}
                  disabled={photoLoading}
                >
                  <Feather name="image" size={16} color={Colors.primary} />
                  <Text style={styles.photoOutlineBtnTxt}>Galeria</Text>
                </TouchableOpacity>
              </View>

              {photoLoading && <PulseLoader text="A analisar refeição..." />}

              {photoError && <ErrorCard message={photoError} />}

              {photoItems.length > 0 && (
                <View style={styles.resultsContainer}>
                  <Text style={styles.resultsTitle}>Alimentos identificados:</Text>
                  {photoItems.map((item, idx) => (
                    <View key={idx} style={styles.resultCard}>
                      <View style={styles.resultHeader}>
                        <Text style={styles.resultName}>{item.name}</Text>
                        <Text style={styles.resultQty}>{item.quantity_g}g</Text>
                      </View>
                      <View style={styles.resultMacros}>
                        <MacroChip value={item.calories} label="kcal" color={Colors.primary} />
                        <MacroChip value={item.protein_g} label="P" color={MacroColors.protein} />
                        <MacroChip value={item.carbs_g} label="C" color={MacroColors.carbs} />
                        <MacroChip value={item.fat_g} label="G" color={MacroColors.fat} />
                      </View>
                    </View>
                  ))}
                  <TouchableOpacity style={styles.saveBtn} onPress={savePhotoItems} activeOpacity={0.8}>
                    <Text style={styles.saveBtnTxt}>
                      Adicionar tudo ({photoItems.length} alimento{photoItems.length !== 1 ? 's' : ''})
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* ── Saved Meals Tab ─────────────────────────────────────────── */}
          {mode === 'saved' && (
            <View style={styles.section}>
              {savedMealsStore.meals.length === 0 ? (
                <View style={styles.emptyState}>
                  <Feather name="bookmark" size={48} color={Colors.textDisabled} />
                  <Text style={styles.emptyTitle}>Refeições Guardadas</Text>
                  <Text style={styles.emptyText}>Ainda não tens refeições guardadas</Text>
                </View>
              ) : (
                <FlatList
                  data={savedMealsStore.meals}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                  contentContainerStyle={{ gap: Spacing.sm }}
                  renderItem={({ item: savedMeal }) => (
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onLongPress={() => confirmDeleteMeal(savedMeal)}
                      style={styles.savedCard}
                    >
                      <View style={styles.savedCardLeft}>
                        <Text style={styles.savedCardName}>{savedMeal.name}</Text>
                        <Text style={styles.savedCardMeta}>
                          {savedMeal.items.length} {savedMeal.items.length !== 1 ? 'itens' : 'item'} · {Math.round(savedMeal.totalCalories)} kcal
                        </Text>
                        <View style={styles.savedMacroPills}>
                          <View style={styles.savedMacroPill}>
                            <Text style={[styles.savedMacroTxt, { color: MacroColors.protein }]}>
                              P {Math.round(savedMeal.totalProtein * 10) / 10}g
                            </Text>
                          </View>
                          <View style={styles.savedMacroPill}>
                            <Text style={[styles.savedMacroTxt, { color: MacroColors.carbs }]}>
                              C {Math.round(savedMeal.totalCarbs * 10) / 10}g
                            </Text>
                          </View>
                          <View style={styles.savedMacroPill}>
                            <Text style={[styles.savedMacroTxt, { color: MacroColors.fat }]}>
                              G {Math.round(savedMeal.totalFat * 10) / 10}g
                            </Text>
                          </View>
                        </View>
                      </View>
                      <TouchableOpacity
                        style={styles.addPillBtn}
                        onPress={() => addSavedMeal(savedMeal)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.addPillBtnTxt}>Adicionar</Text>
                      </TouchableOpacity>
                    </TouchableOpacity>
                  )}
                />
              )}
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Save Meal Name Modal ─────────────────────────────────────────── */}
      <Modal
        visible={saveModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSaveModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Guardar Refeição</Text>
            <Text style={styles.modalSubtitle}>Dá um nome a esta refeição</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="ex: Almoço de frango"
              placeholderTextColor={Colors.textDisabled}
              value={saveMealName}
              onChangeText={setSaveMealName}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => setSaveModalVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.modalBtnCancelTxt}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnConfirm, !saveMealName.trim() && { opacity: 0.4 }]}
                onPress={confirmSaveMeal}
                activeOpacity={0.7}
                disabled={!saveMealName.trim()}
              >
                <Text style={styles.modalBtnConfirmTxt}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

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
    color: Colors.textSecondary,
  },
});

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
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundSubtle,
    borderRadius: Radius.lg,
    padding: 4,
    marginBottom: Spacing.md,
    gap: 3,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
  },
  modeBtnActive: {
    backgroundColor: Colors.primary,
    ...Shadow.card,
  },
  modeBtnTxt: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  modeBtnTxtActive: {
    color: Colors.white,
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
    backgroundColor: Colors.backgroundSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  mealPillActive: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  mealPillTxt: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  mealPillTxtActive: {
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
  },
  section: { gap: Spacing.md },
  hint: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  textArea: {
    backgroundColor: Colors.backgroundSubtle,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    color: Colors.textPrimary,
    fontSize: Typography.base,
    minHeight: 100,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    ...Shadow.strong,
  },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnTxt: {
    color: Colors.white,
    fontSize: Typography.base,
    fontWeight: FontWeight.bold,
  },
  outlineBtn: {
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.sm + 2,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  outlineBtnTxt: {
    color: Colors.primary,
    fontSize: Typography.base,
    fontWeight: FontWeight.semibold,
  },
  resultsContainer: { gap: Spacing.sm },
  resultsTitle: {
    fontSize: Typography.base,
    color: Colors.textPrimary,
    fontWeight: FontWeight.semibold,
  },
  resultCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.card,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultName: {
    fontSize: Typography.base,
    color: Colors.textPrimary,
    fontWeight: FontWeight.semibold,
    flex: 1,
  },
  resultBrand: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
  },
  resultQty: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
  },
  resultMacros: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    marginTop: 4,
  },
  saveBtnTxt: {
    color: Colors.white,
    fontSize: Typography.base,
    fontWeight: FontWeight.bold,
  },
  searchRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    backgroundColor: Colors.backgroundSubtle,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    color: Colors.textPrimary,
    fontSize: Typography.base,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 52,
    ...Shadow.card,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  qtyBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.backgroundSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  qtyBtnTxt: {
    fontSize: Typography.lg,
    color: Colors.textPrimary,
    fontWeight: FontWeight.bold,
  },
  qtyValue: {
    fontSize: Typography.base,
    color: Colors.textPrimary,
    fontWeight: FontWeight.semibold,
    minWidth: 50,
    textAlign: 'center',
  },
  // Photo tab
  photoButtonRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  photoOutlineBtn: {
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primaryLight,
  },
  photoOutlineBtnTxt: {
    color: Colors.primary,
    fontSize: Typography.base,
    fontWeight: FontWeight.semibold,
  },
  // Saved meals tab
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
    gap: Spacing.md,
  },
  emptyTitle: {
    fontSize: Typography.lg,
    color: Colors.textPrimary,
    fontWeight: FontWeight.semibold,
  },
  emptyText: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  savedCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    ...Shadow.card,
  },
  savedCardLeft: {
    flex: 1,
    gap: 4,
  },
  savedCardName: {
    fontSize: Typography.base,
    color: Colors.textPrimary,
    fontWeight: FontWeight.bold,
  },
  savedCardMeta: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
  },
  savedMacroPills: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  savedMacroPill: {
    backgroundColor: Colors.backgroundSubtle,
    borderRadius: Radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  savedMacroTxt: {
    fontSize: Typography.xs,
    fontWeight: FontWeight.semibold,
  },
  addPillBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.card,
  },
  addPillBtnTxt: {
    color: Colors.white,
    fontSize: Typography.sm,
    fontWeight: FontWeight.bold,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  modalBox: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    width: '100%',
    gap: Spacing.md,
    ...Shadow.strong,
  },
  modalTitle: {
    fontSize: Typography.lg,
    color: Colors.textPrimary,
    fontWeight: FontWeight.bold,
  },
  modalSubtitle: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
  },
  modalInput: {
    backgroundColor: Colors.backgroundSubtle,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    color: Colors.textPrimary,
    fontSize: Typography.base,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: 4,
  },
  modalBtn: {
    flex: 1,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.sm + 2,
    alignItems: 'center',
  },
  modalBtnCancel: {
    backgroundColor: Colors.backgroundSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalBtnCancelTxt: {
    color: Colors.textSecondary,
    fontSize: Typography.base,
    fontWeight: FontWeight.medium,
  },
  modalBtnConfirm: {
    backgroundColor: Colors.primary,
    ...Shadow.card,
  },
  modalBtnConfirmTxt: {
    color: Colors.white,
    fontSize: Typography.base,
    fontWeight: FontWeight.bold,
  },
});
