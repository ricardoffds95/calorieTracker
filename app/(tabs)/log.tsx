import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  Image,
  Animated,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { SaveFormat } from 'expo-image-manipulator';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { useFood } from '../../hooks/useFood';
import { parseFoodWithAI, analyzeFoodImage, GeminiParsedItem } from '../../services/geminiAI';
import {
  searchFood,
  searchByBarcode,
  calculateNutrientsForQuantity,
  FoodSearchResult,
} from '../../services/openFoodFacts';
import { useSavedMealsStore, SavedMeal, SavedMealItem, SavedFood } from '../../store/savedMealsStore';
import { Colors, Typography, FontWeight, Spacing, Radius, Shadow, MacroColors } from '../../constants/theme';
import { MealType } from '../../store/foodStore';

type InputMode = 'ai' | 'search' | 'manual' | 'saved';
type ManualSubMode = 'food' | 'meal';
type SavedSubMode = 'meals' | 'foods';

const VALID_MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snacks'];

const MEAL_DISPLAY: Record<MealType, string> = {
  breakfast: 'Pequeno-almoço',
  lunch: 'Almoço',
  dinner: 'Jantar',
  snacks: 'Snacks',
};

const MEAL_ICONS: Record<MealType, any> = {
  breakfast: 'sunrise',
  lunch: 'sun',
  dinner: 'moon',
  snacks: 'coffee',
};

// ─── QuantityInput ─────────────────────────────────────────────────────────────

function QuantityInput({ value, onChange, min = 1 }: { value: number; onChange: (v: number) => void; min?: number }) {
  const [editing, setEditing] = useState(false);
  const [temp, setTemp] = useState(String(value));

  if (editing) {
    return (
      <TextInput
        style={qtyStyles.input}
        value={temp}
        onChangeText={setTemp}
        keyboardType="numeric"
        autoFocus
        selectTextOnFocus
        returnKeyType="done"
        onBlur={() => {
          const parsed = parseFloat(temp);
          if (!isNaN(parsed) && parsed >= min) onChange(Math.round(parsed));
          else setTemp(String(value));
          setEditing(false);
        }}
        onSubmitEditing={() => {
          const parsed = parseFloat(temp);
          if (!isNaN(parsed) && parsed >= min) onChange(Math.round(parsed));
          else setTemp(String(value));
          setEditing(false);
        }}
      />
    );
  }
  return (
    <TouchableOpacity onPress={() => { setTemp(String(value)); setEditing(true); }} style={qtyStyles.display} activeOpacity={0.7}>
      <Text style={qtyStyles.displayTxt}>{value}g</Text>
    </TouchableOpacity>
  );
}

// ─── Toast ─────────────────────────────────────────────────────────────────────

interface ToastProps { message: string; visible: boolean; color: string }

function Toast({ message, visible, color }: ToastProps) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      opacity.stopAnimation();
      opacity.setValue(0);
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(1500),
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, message]);

  return (
    <Animated.View style={[toastStyles.container, { opacity, backgroundColor: color }]} pointerEvents="none">
      <Feather name="check-circle" size={15} color={Colors.white} />
      <Text style={toastStyles.text}>{message}</Text>
    </Animated.View>
  );
}

// ─── MealSelectorSheet ────────────────────────────────────────────────────────

function MealSelectorSheet({
  visible, onSelect, onClose, bottomInset,
}: {
  visible: boolean;
  onSelect: (meal: MealType) => void;
  onClose: () => void;
  bottomInset: number;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={sheetStyles.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
        <View style={[sheetStyles.sheet, { paddingBottom: bottomInset + 12 }]}>
          <View style={sheetStyles.handle} />
          <Text style={sheetStyles.title}>Adicionar a que refeição?</Text>
          {VALID_MEAL_TYPES.map((m) => (
            <TouchableOpacity key={m} style={sheetStyles.option} onPress={() => onSelect(m)} activeOpacity={0.7}>
              <View style={sheetStyles.optionIcon}>
                <Feather name={MEAL_ICONS[m]} size={18} color={Colors.primary} />
              </View>
              <Text style={sheetStyles.optionLabel}>{MEAL_DISPLAY[m]}</Text>
              <Feather name="chevron-right" size={16} color={Colors.textDisabled} />
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={sheetStyles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={sheetStyles.cancelTxt}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Helper components ─────────────────────────────────────────────────────────

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
    <View style={{ backgroundColor: '#FFF0F0', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#FFD0D0' }}>
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

function MacroPreviewCard({ calories, protein, carbs, fat }: { calories: number; protein: number; carbs: number; fat: number }) {
  if (calories === 0 && protein === 0 && carbs === 0 && fat === 0) return null;
  return (
    <View style={previewStyles.card}>
      <Text style={previewStyles.kcal}>{Math.round(calories)} kcal</Text>
      <View style={previewStyles.pills}>
        <View style={[previewStyles.pill, { backgroundColor: MacroColors.protein + '15' }]}><Text style={[previewStyles.pillTxt, { color: MacroColors.protein }]}>P {Math.round(protein * 10) / 10}g</Text></View>
        <View style={[previewStyles.pill, { backgroundColor: MacroColors.carbs + '15' }]}><Text style={[previewStyles.pillTxt, { color: MacroColors.carbs }]}>C {Math.round(carbs * 10) / 10}g</Text></View>
        <View style={[previewStyles.pill, { backgroundColor: MacroColors.fat + '15' }]}><Text style={[previewStyles.pillTxt, { color: MacroColors.fat }]}>G {Math.round(fat * 10) / 10}g</Text></View>
      </View>
    </View>
  );
}

// ─── Editable AI item ─────────────────────────────────────────────────────────

interface EditableFoodItem {
  id: string;
  name: string;
  quantity_g: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  originalCaloriesPer100g: number;
  originalProteinPer100g: number;
  originalCarbsPer100g: number;
  originalFatPer100g: number;
}

function toEditableItem(item: GeminiParsedItem): EditableFoodItem {
  const qty = item.quantity_g > 0 ? item.quantity_g : 100;
  const factor = 100 / qty;
  return {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: item.name,
    quantity_g: qty,
    calories: item.calories,
    protein_g: item.protein_g,
    carbs_g: item.carbs_g,
    fat_g: item.fat_g,
    originalCaloriesPer100g: item.calories * factor,
    originalProteinPer100g: item.protein_g * factor,
    originalCarbsPer100g: item.carbs_g * factor,
    originalFatPer100g: item.fat_g * factor,
  };
}

function EditableFoodCard({
  item, onQuantityChange, onDelete,
}: {
  item: EditableFoodItem;
  onQuantityChange: (id: string, qty: number) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <View style={editCardStyles.card}>
      <View style={editCardStyles.header}>
        <Text style={editCardStyles.name} numberOfLines={2}>{item.name}</Text>
        <TouchableOpacity onPress={() => onDelete(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="x" size={18} color="#E85D75" />
        </TouchableOpacity>
      </View>
      <View style={editCardStyles.qtyRow}>
        <TouchableOpacity onPress={() => onQuantityChange(item.id, Math.max(5, item.quantity_g - 10))} style={editCardStyles.qtyBtn}>
          <Feather name="minus" size={15} color={Colors.primary} />
        </TouchableOpacity>
        <QuantityInput value={item.quantity_g} onChange={(qty) => onQuantityChange(item.id, qty)} min={1} />
        <TouchableOpacity onPress={() => onQuantityChange(item.id, item.quantity_g + 10)} style={editCardStyles.qtyBtn}>
          <Feather name="plus" size={15} color={Colors.primary} />
        </TouchableOpacity>
      </View>
      <View style={editCardStyles.macros}>
        <Text style={editCardStyles.kcal}>{Math.round(item.calories)} kcal</Text>
        <View style={editCardStyles.macroPills}>
          <Text style={[editCardStyles.macro, { color: MacroColors.protein }]}>P {Math.round(item.protein_g * 10) / 10}g</Text>
          <Text style={[editCardStyles.macro, { color: MacroColors.carbs }]}>H {Math.round(item.carbs_g * 10) / 10}g</Text>
          <Text style={[editCardStyles.macro, { color: MacroColors.fat }]}>G {Math.round(item.fat_g * 10) / 10}g</Text>
        </View>
      </View>
    </View>
  );
}

function ResultsTotalsBar({ items }: { items: EditableFoodItem[] }) {
  const totals = items.reduce(
    (acc, item) => ({ calories: acc.calories + item.calories, protein: acc.protein + item.protein_g, carbs: acc.carbs + item.carbs_g, fat: acc.fat + item.fat_g }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
  return (
    <View style={editCardStyles.totalsBar}>
      <Text style={editCardStyles.totalKcal}>Total: {Math.round(totals.calories)} kcal</Text>
      <Text style={[editCardStyles.totalMacro, { color: MacroColors.protein }]}>P {Math.round(totals.protein * 10) / 10}g</Text>
      <Text style={[editCardStyles.totalMacro, { color: MacroColors.carbs }]}>H {Math.round(totals.carbs * 10) / 10}g</Text>
      <Text style={[editCardStyles.totalMacro, { color: MacroColors.fat }]}>G {Math.round(totals.fat * 10) / 10}g</Text>
    </View>
  );
}

// ─── Barcode validation ───────────────────────────────────────────────────────

const CHECKSUM_TYPES = ['ean13', 'ean8', 'upc_a'];

function validateEAN13(barcode: string): boolean {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(barcode[i]);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  return (10 - (sum % 10)) % 10 === parseInt(barcode[12]);
}

function validateEAN8(barcode: string): boolean {
  let sum = 0;
  for (let i = 0; i < 7; i++) {
    const digit = parseInt(barcode[i]);
    sum += i % 2 === 0 ? digit * 3 : digit;
  }
  return (10 - (sum % 10)) % 10 === parseInt(barcode[7]);
}

function validateUPCA(barcode: string): boolean {
  let sum = 0;
  for (let i = 0; i < 11; i++) {
    const digit = parseInt(barcode[i]);
    sum += i % 2 === 0 ? digit * 3 : digit;
  }
  return (10 - (sum % 10)) % 10 === parseInt(barcode[11]);
}

function isValidBarcode(data: string, type: string): boolean {
  if (!data || data.trim().length === 0) return false;
  const onlyDigits = /^\d+$/.test(data);
  switch (type) {
    case 'ean13':    return onlyDigits && data.length === 13 && validateEAN13(data);
    case 'ean8':     return onlyDigits && data.length === 8 && validateEAN8(data);
    case 'upc_a':    return onlyDigits && data.length === 12 && validateUPCA(data);
    case 'upc_e':    return onlyDigits && data.length >= 6 && data.length <= 8;
    case 'code128':  return data.length >= 1 && data.length <= 48;
    case 'code39':   return /^[A-Z0-9\-\. $\/\+%]+$/.test(data) && data.length >= 1;
    case 'itf14':    return onlyDigits && data.length === 14;
    case 'codabar':  return data.length >= 4;
    case 'datamatrix': case 'pdf417': case 'aztec': case 'qr': return data.length >= 1;
    default:         return data.length >= 4;
  }
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function LogScreen() {
  const insets = useSafeAreaInsets();
  const { addFood, addMeal } = useFood();
  const savedStore = useSavedMealsStore();
  const params = useLocalSearchParams<{ mealContext?: string; timestamp?: string }>();

  // ── Meal context ────────────────────────────────────────────────────────
  const [activeMeal, setActiveMeal] = useState<MealType | null>(null);

  useFocusEffect(
    useCallback(() => {
      const p = params.mealContext;
      if (p && VALID_MEAL_TYPES.includes(p as MealType)) {
        setActiveMeal(p as MealType);
      } else {
        setActiveMeal(null);
      }
    }, [params.mealContext, params.timestamp])
  );

  // ── Toast ────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState({ visible: false, message: '', color: Colors.success });
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message = '✓ Adicionado ao diário', color = Colors.success) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ visible: false, message, color });
    setTimeout(() => setToast({ visible: true, message, color }), 10);
    toastTimer.current = setTimeout(() => setToast(t => ({ ...t, visible: false })), 2500);
  }, []);

  // ── Meal sheet ──────────────────────────────────────────────────────────
  const [mealSheetVisible, setMealSheetVisible] = useState(false);
  const pendingAddFn = useRef<((m: MealType) => void) | null>(null);

  const openMealSheet = (fn: (m: MealType) => void) => {
    pendingAddFn.current = fn;
    setMealSheetVisible(true);
  };

  const handleSheetSelect = (m: MealType) => {
    setMealSheetVisible(false);
    if (pendingAddFn.current) {
      pendingAddFn.current(m);
      pendingAddFn.current = null;
    }
  };

  // ── Mode ─────────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<InputMode>('ai');

  // ── AI tab ───────────────────────────────────────────────────────────────
  const [aiText, setAiText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [editableItems, setEditableItems] = useState<EditableFoodItem[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<{ uri: string; base64: string } | null>(null);

  // Save meal modal
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [saveMealName, setSaveMealName] = useState('');

  // ── Search tab ───────────────────────────────────────────────────────────
  const [searchText, setSearchText] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<FoodSearchResult[]>([]);
  const [fromCache, setFromCache] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [scannerVisible, setScannerVisible] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanConfidence, setScanConfidence] = useState(0);
  const [barcodeError, setBarcodeError] = useState<string | null>(null);
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const scanBuffer = useRef<string[]>([]);

  // ── Manual tab ───────────────────────────────────────────────────────────
  const [manualSubMode, setManualSubMode] = useState<ManualSubMode>('food');
  const [manualName, setManualName] = useState('');
  const [manualQty, setManualQty] = useState(100);
  const [manualCal, setManualCal] = useState('');
  const [manualProtein, setManualProtein] = useState('');
  const [manualCarbs, setManualCarbs] = useState('');
  const [manualFat, setManualFat] = useState('');
  const [mealName, setMealName] = useState('');
  const [mealItems, setMealItems] = useState<SavedMealItem[]>([]);
  const [addItemModalVisible, setAddItemModalVisible] = useState(false);
  const [itemName, setItemName] = useState('');
  const [itemQty, setItemQty] = useState(100);
  const [itemCal, setItemCal] = useState('');
  const [itemProtein, setItemProtein] = useState('');
  const [itemCarbs, setItemCarbs] = useState('');
  const [itemFat, setItemFat] = useState('');

  // ── Saved tab ────────────────────────────────────────────────────────────
  const [savedSubMode, setSavedSubMode] = useState<SavedSubMode>('meals');
  const [savedFoodQtys, setSavedFoodQtys] = useState<Record<string, number>>({});
  const [renamingMealId, setRenamingMealId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');

  // ── Scanner animation ─────────────────────────────────────────────────────

  useEffect(() => {
    if (scannerVisible) {
      scanBuffer.current = [];
      setScanConfidence(0);
      setScanned(false);
      setIsProcessing(false);
      // Pre-warm API connection
      fetch('https://world.openfoodfacts.org/api/v2/product/5449000000996.json?fields=product_name', {
        headers: { 'User-Agent': 'CalTracker/1.0 (caltracker@example.com)' },
      }).catch(() => {});
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(scanLineAnim, { toValue: 1, duration: 1800, useNativeDriver: true }),
          Animated.timing(scanLineAnim, { toValue: 0, duration: 1800, useNativeDriver: true }),
        ])
      );
      anim.start();
      return () => anim.stop();
    } else {
      scanLineAnim.setValue(0);
    }
  }, [scannerVisible]);

  // ── AI handlers ───────────────────────────────────────────────────────────

  const processImageUri = async (uri: string) => {
    try {
      const m = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 800 } }], { compress: 0.7, format: SaveFormat.JPEG, base64: true });
      if (!m.base64) throw new Error('Falha ao processar imagem');
      setSelectedPhoto({ uri: m.uri, base64: m.base64 });
    } catch (e: unknown) {
      setAiError(e instanceof Error ? e.message : 'Erro ao processar imagem');
    }
  };

  const handleTakePhoto = async () => {
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9 });
    if (!r.canceled && r.assets[0]) await processImageUri(r.assets[0].uri);
  };

  const handlePickGallery = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
    if (!r.canceled && r.assets[0]) await processImageUri(r.assets[0].uri);
  };

  const handleAnalyze = async () => {
    if (!selectedPhoto && !aiText.trim()) { setAiError('Escreve algo ou seleciona uma foto.'); return; }
    setAiLoading(true); setAiError(null);
    try {
      const items = selectedPhoto ? await analyzeFoodImage(selectedPhoto.base64) : await parseFoodWithAI(aiText);
      setEditableItems(items.map(toEditableItem));
    } catch (e: unknown) {
      setAiError(e instanceof Error ? e.message : 'Não foi possível processar');
    } finally {
      setAiLoading(false);
    }
  };

  const handleQuantityChange = (id: string, newQty: number) => {
    setEditableItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      const factor = newQty / 100;
      return {
        ...item,
        quantity_g: newQty,
        calories: Math.round(item.originalCaloriesPer100g * factor * 10) / 10,
        protein_g: Math.round(item.originalProteinPer100g * factor * 10) / 10,
        carbs_g: Math.round(item.originalCarbsPer100g * factor * 10) / 10,
        fat_g: Math.round(item.originalFatPer100g * factor * 10) / 10,
      };
    }));
  };

  const handleDeleteItem = (id: string) => {
    setEditableItems(prev => {
      const next = prev.filter(item => item.id !== id);
      return next;
    });
  };

  const addAiItemsToDiary = () => {
    if (editableItems.length === 0) return;
    const doAdd = (m: MealType) => {
      if (editableItems.length === 1) {
        const item = editableItems[0];
        addFood({ name: item.name, quantity_g: item.quantity_g, calories: item.calories, protein_g: item.protein_g, carbs_g: item.carbs_g, fat_g: item.fat_g, meal: m });
      } else {
        addMeal({
          name: aiText.trim() ? aiText.trim().slice(0, 40) : 'Refeição IA',
          items: editableItems.map(item => ({ name: item.name, quantity_g: item.quantity_g, calories: item.calories, protein_g: item.protein_g, carbs_g: item.carbs_g, fat_g: item.fat_g })),
          meal: m,
        });
      }
      setEditableItems([]); setAiText(''); setSelectedPhoto(null);
      showToast(`✓ Adicionado ao ${MEAL_DISPLAY[m]}`);
    };
    if (activeMeal) doAdd(activeMeal);
    else openMealSheet(doAdd);
  };

  const openSaveMealModal = () => {
    setSaveMealName(''); setSaveModalVisible(true);
  };

  const confirmSaveMeal = async () => {
    if (!saveMealName.trim()) return;
    const storeItems: SavedMealItem[] = editableItems.map((item) => ({
      id: Date.now().toString() + Math.random().toString(36).slice(2),
      name: item.name, quantity_g: item.quantity_g, calories: item.calories,
      protein_g: item.protein_g, carbs_g: item.carbs_g, fat_g: item.fat_g,
    }));
    const result = await savedStore.saveMeal(saveMealName.trim(), storeItems);
    if (result.duplicate) {
      Alert.alert(
        'Refeição já guardada',
        `Já tens uma refeição chamada "${saveMealName.trim()}". Queres substituir ou guardar como nova?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Guardar como nova', onPress: async () => { await savedStore.saveMealForce(saveMealName.trim(), storeItems); setSaveModalVisible(false); setSaveMealName(''); showToast('Refeição guardada!'); } },
          { text: 'Substituir', style: 'destructive', onPress: async () => { await savedStore.replaceMeal(result.existingId!, saveMealName.trim(), storeItems); setSaveModalVisible(false); setSaveMealName(''); showToast('Refeição guardada!'); } },
        ]
      );
      return;
    }
    setSaveModalVisible(false); setSaveMealName(''); showToast('Refeição guardada!');
  };

  // ── Search handlers ───────────────────────────────────────────────────────

  const runSearch = async (q: string) => {
    setSearchLoading(true); setSearchError(null);
    try {
      const { results, fromCache: cached } = await searchFood(q);
      setSearchResults(results); setFromCache(cached);
    } catch (e: unknown) {
      setSearchError(e instanceof Error ? e.message : 'Erro na pesquisa');
    } finally {
      setSearchLoading(false);
    }
  };

  useEffect(() => {
    if (searchText.trim().length < 2) return;
    const id = setTimeout(() => runSearch(searchText), 500);
    return () => clearTimeout(id);
  }, [searchText]);

  const saveSearchItem = (result: FoodSearchResult) => {
    const qty = quantities[result.id] ?? 100;
    const n = calculateNutrientsForQuantity(result, qty);
    const doAdd = (m: MealType) => {
      addFood({ name: result.name, quantity_g: qty, calories: n.calories, protein_g: n.protein_g, carbs_g: n.carbs_g, fat_g: n.fat_g, meal: m });
      setQuantities((q) => { const next = { ...q }; delete next[result.id]; return next; });
      showToast(`✓ Adicionado ao ${MEAL_DISPLAY[m]}`);
    };
    if (activeMeal) doAdd(activeMeal);
    else openMealSheet(doAdd);
  };

  const saveSearchFood = async (result: FoodSearchResult) => {
    const res = await savedStore.saveFood({ name: result.name, calories_100g: result.calories_100g, protein_100g: result.protein_100g, carbs_100g: result.carbs_100g, fat_100g: result.fat_100g });
    if (res.duplicate) showToast('Este alimento já está guardado', '#F5A623');
    else showToast(`"${result.name}" guardado!`);
  };

  // ── Barcode handlers ──────────────────────────────────────────────────────

  const openScanner = async () => {
    setBarcodeError(null);
    if (!cameraPermission?.granted) {
      const { granted } = await requestCameraPermission();
      if (!granted) { Alert.alert('Câmera necessária', 'Por favor autoriza o acesso à câmera nas definições.'); return; }
    }
    setScannerVisible(true);
  };

  const lookupBarcode = useCallback(async (data: string, type?: string) => {
    // Keep scanner open showing "isProcessing" state while API responds
    try {
      const food = await searchByBarcode(data, type);
      if (food) { setSearchResults([food]); setFromCache(false); setBarcodeError(null); }
      else { setSearchResults([]); setBarcodeError('Produto não encontrado. Tenta pesquisar pelo nome.'); }
    } catch (e: unknown) {
      setBarcodeError(e instanceof Error ? e.message : 'Erro ao procurar produto.');
    } finally {
      setIsProcessing(false);
      setScannerVisible(false);
    }
  }, []);

  const handleBarcodeScan = useCallback(async ({ type, data }: BarcodeScanningResult) => {
    if (scanned || isProcessing) return;
    if (!isValidBarcode(data, type)) return;

    // Checksum-validated types → trust on first valid read
    if (CHECKSUM_TYPES.includes(type)) {
      scanBuffer.current = [];
      setScanned(true);
      setIsProcessing(true);
      setScanConfidence(3);
      await lookupBarcode(data, type);
      return;
    }

    // Other types → require 2 consistent reads
    scanBuffer.current.push(data);
    if (scanBuffer.current.length > 3) scanBuffer.current = scanBuffer.current.slice(-3);

    const count = scanBuffer.current.filter(b => b === data).length;
    setScanConfidence(count);
    if (count < 2) return;

    scanBuffer.current = [];
    setScanned(true);
    setIsProcessing(true);
    await lookupBarcode(data, type);
  }, [scanned, isProcessing, lookupBarcode]);

  const handleManualEntry = () => {
    if (Platform.OS === 'ios') {
      Alert.prompt(
        'Código de barras',
        'Introduz o código do produto',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Pesquisar',
            onPress: async (value?: string) => {
              if (value && value.trim().length >= 4) {
                setScanned(true);
                setIsProcessing(true);
                await lookupBarcode(value.trim(), 'manual');
              }
            },
          },
        ],
        'plain-text',
        '',
        'default'
      );
    } else {
      setScannerVisible(false);
    }
  };

  // ── Saved handlers ────────────────────────────────────────────────────────

  const addSavedMeal = (savedMeal: SavedMeal) => {
    const doAdd = (m: MealType) => {
      savedStore.addMealToLog(savedMeal, m);
      showToast(`✓ Adicionado ao ${MEAL_DISPLAY[m]}`);
    };
    if (activeMeal) doAdd(activeMeal);
    else openMealSheet(doAdd);
  };

  const longPressMeal = (savedMeal: SavedMeal) => {
    Alert.alert(savedMeal.name, undefined, [
      { text: 'Renomear', onPress: () => { setRenamingMealId(savedMeal.id); setRenameText(savedMeal.name); } },
      { text: 'Eliminar', style: 'destructive', onPress: () => confirmDeleteMeal(savedMeal) },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const confirmDeleteMeal = (savedMeal: SavedMeal) => {
    Alert.alert('Eliminar refeição', `Tens a certeza que queres eliminar "${savedMeal.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => { await savedStore.deleteMeal(savedMeal.id); showToast('Eliminado com sucesso', '#E85D75'); } },
    ]);
  };

  const handleRenameConfirm = async () => {
    if (!renameText.trim() || !renamingMealId) return;
    await savedStore.renameMeal(renamingMealId, renameText.trim());
    setRenamingMealId(null);
  };

  const confirmDeleteFood = (food: SavedFood) => {
    Alert.alert('Eliminar alimento', `Tens a certeza que queres eliminar "${food.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => { await savedStore.deleteFood(food.id); showToast('Eliminado com sucesso', '#E85D75'); } },
    ]);
  };

  const addSavedFood = (food: SavedFood) => {
    const qty = savedFoodQtys[food.id] ?? 100;
    const doAdd = (m: MealType) => {
      savedStore.addFoodToLog(food, qty, m);
      showToast(`✓ Adicionado ao ${MEAL_DISPLAY[m]}`);
    };
    if (activeMeal) doAdd(activeMeal);
    else openMealSheet(doAdd);
  };

  // ── Manual handlers ───────────────────────────────────────────────────────

  const manualPreview = {
    calories: parseFloat(manualCal) || 0,
    protein: parseFloat(manualProtein) || 0,
    carbs: parseFloat(manualCarbs) || 0,
    fat: parseFloat(manualFat) || 0,
  };

  const handleManualAddToDiary = () => {
    if (!manualName.trim()) { Alert.alert('Atenção', 'Preenche o nome do alimento.'); return; }
    const doAdd = (m: MealType) => {
      addFood({ name: manualName.trim(), quantity_g: manualQty, calories: manualPreview.calories, protein_g: manualPreview.protein, carbs_g: manualPreview.carbs, fat_g: manualPreview.fat, meal: m });
      resetManualFood();
      showToast(`✓ Adicionado ao ${MEAL_DISPLAY[m]}`);
    };
    if (activeMeal) doAdd(activeMeal);
    else openMealSheet(doAdd);
  };

  const handleManualSaveFood = async () => {
    if (!manualName.trim()) { Alert.alert('Atenção', 'Preenche o nome do alimento.'); return; }
    const factor = 100 / manualQty;
    const res = await savedStore.saveFood({ name: manualName.trim(), calories_100g: Math.round(manualPreview.calories * factor), protein_100g: Math.round(manualPreview.protein * factor * 10) / 10, carbs_100g: Math.round(manualPreview.carbs * factor * 10) / 10, fat_100g: Math.round(manualPreview.fat * factor * 10) / 10 });
    if (res.duplicate) showToast('Este alimento já está guardado', '#F5A623');
    else { showToast(`"${manualName.trim()}" guardado!`); resetManualFood(); }
  };

  const resetManualFood = () => {
    setManualName(''); setManualQty(100);
    setManualCal(''); setManualProtein(''); setManualCarbs(''); setManualFat('');
  };

  const mealTotals = mealItems.reduce(
    (acc, i) => ({ cal: acc.cal + i.calories, p: acc.p + i.protein_g, c: acc.c + i.carbs_g, f: acc.f + i.fat_g }),
    { cal: 0, p: 0, c: 0, f: 0 }
  );

  const handleAddItemToMeal = () => {
    if (!itemName.trim()) return;
    setMealItems((prev) => [...prev, {
      id: Date.now().toString() + Math.random().toString(36).slice(2),
      name: itemName.trim(), quantity_g: itemQty,
      calories: parseFloat(itemCal) || 0, protein_g: parseFloat(itemProtein) || 0,
      carbs_g: parseFloat(itemCarbs) || 0, fat_g: parseFloat(itemFat) || 0,
    }]);
    setItemName(''); setItemQty(100); setItemCal(''); setItemProtein(''); setItemCarbs(''); setItemFat('');
    setAddItemModalVisible(false);
  };

  const handleMealAddToDiary = () => {
    if (mealItems.length === 0) { Alert.alert('Atenção', 'Adiciona pelo menos um item.'); return; }
    const doAdd = (m: MealType) => {
      if (mealItems.length === 1) {
        const item = mealItems[0];
        addFood({ name: item.name, quantity_g: item.quantity_g, calories: item.calories, protein_g: item.protein_g, carbs_g: item.carbs_g, fat_g: item.fat_g, meal: m });
      } else {
        addMeal({ name: mealName.trim() || 'Refeição manual', items: mealItems, meal: m });
      }
      setMealItems([]); setMealName('');
      showToast(`✓ Adicionado ao ${MEAL_DISPLAY[m]}`);
    };
    if (activeMeal) doAdd(activeMeal);
    else openMealSheet(doAdd);
  };

  const handleSaveMealRefeicao = async () => {
    if (mealItems.length === 0) { Alert.alert('Atenção', 'Adiciona pelo menos um item.'); return; }
    if (!mealName.trim()) { Alert.alert('Atenção', 'Dá um nome à refeição.'); return; }
    const result = await savedStore.saveMeal(mealName.trim(), mealItems);
    if (result.duplicate) {
      Alert.alert(
        'Refeição já guardada',
        `Já tens uma refeição chamada "${mealName.trim()}". Queres substituir ou guardar como nova?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Guardar como nova', onPress: async () => { await savedStore.saveMealForce(mealName.trim(), mealItems); showToast('Refeição guardada!'); setMealItems([]); setMealName(''); } },
          { text: 'Substituir', style: 'destructive', onPress: async () => { await savedStore.replaceMeal(result.existingId!, mealName.trim(), mealItems); showToast('Refeição substituída!'); setMealItems([]); setMealName(''); } },
        ]
      );
      return;
    }
    showToast('Refeição guardada!');
    setMealItems([]); setMealName('');
  };

  // ── Add button label ─────────────────────────────────────────────────────

  const addLabel = (fallback: string) => activeMeal ? `Adicionar ao ${MEAL_DISPLAY[activeMeal]}` : fallback;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>Registar Alimentos</Text>

          {/* Context pill */}
          {activeMeal && (
            <View style={styles.contextPill}>
              <Feather name={MEAL_ICONS[activeMeal]} size={14} color={Colors.primary} />
              <Text style={styles.contextPillTxt}>A adicionar ao {MEAL_DISPLAY[activeMeal]}</Text>
              <TouchableOpacity onPress={() => setActiveMeal(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Feather name="x" size={14} color={Colors.primary} />
              </TouchableOpacity>
            </View>
          )}

          {/* Mode Toggle */}
          <View style={styles.modeToggle}>
            {([
              { key: 'ai', icon: 'zap', label: 'IA' },
              { key: 'search', icon: 'search', label: 'Pesquisar' },
              { key: 'manual', icon: 'edit-3', label: 'Manual' },
              { key: 'saved', icon: 'bookmark', label: 'Guardados' },
            ] as { key: InputMode; icon: any; label: string }[]).map(({ key, icon, label }) => (
              <TouchableOpacity key={key} style={[styles.modeBtn, mode === key && styles.modeBtnActive]} onPress={() => setMode(key)} activeOpacity={0.7}>
                <Feather name={icon} size={14} color={mode === key ? Colors.white : Colors.textSecondary} />
                <Text style={[styles.modeBtnTxt, mode === key && styles.modeBtnTxtActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── AI Tab ──────────────────────────────────────────────────── */}
          {mode === 'ai' && (
            <View style={styles.section}>
              <View style={{ position: 'relative' }}>
                <TextInput
                  style={[styles.textArea, selectedPhoto && { paddingRight: 100 }]}
                  placeholder={selectedPhoto ? 'Foto pronta. Carrega Analisar.' : 'ex: comi 150g de frango grelhado com arroz e salada'}
                  placeholderTextColor={Colors.textDisabled}
                  multiline numberOfLines={4}
                  value={aiText} onChangeText={setAiText}
                  textAlignVertical="top" editable={!selectedPhoto}
                />
                {selectedPhoto && (
                  <View style={styles.photoThumbContainer}>
                    <Image source={{ uri: selectedPhoto.uri }} style={styles.photoThumb} />
                    <TouchableOpacity style={styles.photoThumbRemove} onPress={() => setSelectedPhoto(null)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                      <Feather name="x" size={12} color={Colors.white} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              <View style={styles.photoButtonRow}>
                <TouchableOpacity style={[styles.photoOutlineBtn, { flex: 1 }]} onPress={handleTakePhoto} activeOpacity={0.7} disabled={aiLoading}>
                  <Feather name="camera" size={14} color={Colors.primary} />
                  <Text style={styles.photoOutlineBtnTxt}>Tirar foto</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.photoOutlineBtn, { flex: 1 }]} onPress={handlePickGallery} activeOpacity={0.7} disabled={aiLoading}>
                  <Feather name="image" size={14} color={Colors.primary} />
                  <Text style={styles.photoOutlineBtnTxt}>Galeria</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={[styles.primaryBtn, aiLoading && styles.primaryBtnDisabled]} onPress={handleAnalyze} activeOpacity={0.8} disabled={aiLoading}>
                {aiLoading
                  ? <><ActivityIndicator color={Colors.white} size="small" /><Text style={styles.primaryBtnTxt}>A analisar...</Text></>
                  : <><Feather name="zap" size={16} color={Colors.white} /><Text style={styles.primaryBtnTxt}>Analisar com IA</Text></>
                }
              </TouchableOpacity>

              {aiError && <ErrorCard message={aiError} />}

              {editableItems.length > 0 && (
                <View style={styles.resultsContainer}>
                  <Text style={styles.resultsTitle}>Alimentos identificados:</Text>
                  {editableItems.map((item) => (
                    <EditableFoodCard
                      key={item.id}
                      item={item}
                      onQuantityChange={handleQuantityChange}
                      onDelete={handleDeleteItem}
                    />
                  ))}
                  <ResultsTotalsBar items={editableItems} />
                  <View style={styles.twoButtonRow}>
                    <TouchableOpacity style={[styles.outlineBtnSmall, { flex: 1 }]} onPress={openSaveMealModal} activeOpacity={0.8}>
                      <Feather name="bookmark" size={13} color={Colors.primary} />
                      <Text style={styles.outlineBtnSmallTxt}>Guardar Refeição</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.saveBtn, { flex: 1, marginTop: 0 }]} onPress={addAiItemsToDiary} activeOpacity={0.8}>
                      <Text style={styles.saveBtnTxt}>{addLabel('Adicionar ao Diário')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* ── Search Tab ──────────────────────────────────────────────── */}
          {mode === 'search' && (
            <View style={styles.section}>
              <View style={styles.searchRow}>
                <TextInput style={styles.searchInput} placeholder="ex: frango, arroz, banana..." placeholderTextColor={Colors.textDisabled} value={searchText} onChangeText={setSearchText} returnKeyType="search" onSubmitEditing={() => runSearch(searchText)} />
                <TouchableOpacity style={styles.barcodeBtn} onPress={openScanner} activeOpacity={0.8}>
                  <Feather name="maximize" size={18} color={Colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.searchBtn} onPress={() => runSearch(searchText)} activeOpacity={0.8} disabled={searchLoading}>
                  {searchLoading || isProcessing ? <ActivityIndicator color={Colors.white} size="small" /> : <Feather name="search" size={18} color={Colors.white} />}
                </TouchableOpacity>
              </View>

              {(searchError || barcodeError) && <ErrorCard message={searchError ?? barcodeError!} />}

              {searchResults.length > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.resultsTitle}>{searchResults.length} resultado{searchResults.length !== 1 ? 's' : ''}</Text>
                  {fromCache && <Feather name="zap" size={14} color={Colors.primary} />}
                </View>
              )}

              {searchResults.map((result) => (
                <View key={result.id} style={styles.resultCard}>
                  <Text style={styles.resultName}>{result.name}</Text>
                  {result.brand && <Text style={styles.resultBrand}>{result.brand}</Text>}
                  <View style={styles.resultMacros}>
                    <MacroChip value={result.calories_100g} label="kcal/100g" color={Colors.primary} />
                    <MacroChip value={result.protein_100g} label="P" color={MacroColors.protein} />
                    <MacroChip value={result.carbs_100g} label="C" color={MacroColors.carbs} />
                    <MacroChip value={result.fat_100g} label="G" color={MacroColors.fat} />
                  </View>
                  <View style={styles.qtyRow}>
                    <TouchableOpacity style={styles.qtyBtn} onPress={() => setQuantities((q) => ({ ...q, [result.id]: Math.max(10, (q[result.id] ?? 100) - 10) }))}>
                      <Text style={styles.qtyBtnTxt}>-</Text>
                    </TouchableOpacity>
                    <QuantityInput value={quantities[result.id] ?? 100} onChange={(v) => setQuantities((q) => ({ ...q, [result.id]: v }))} min={10} />
                    <TouchableOpacity style={styles.qtyBtn} onPress={() => setQuantities((q) => ({ ...q, [result.id]: (q[result.id] ?? 100) + 10 }))}>
                      <Text style={styles.qtyBtnTxt}>+</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.twoButtonRow}>
                    <TouchableOpacity style={[styles.saveBtn, { flex: 1, marginTop: 0 }]} onPress={() => saveSearchItem(result)} activeOpacity={0.8}>
                      <Text style={styles.saveBtnTxt}>{addLabel('Adicionar ao Diário')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.outlineBtnSmall, { flex: 1 }]} onPress={() => saveSearchFood(result)} activeOpacity={0.8}>
                      <Feather name="bookmark" size={13} color={Colors.primary} />
                      <Text style={styles.outlineBtnSmallTxt}>Guardar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* ── Manual Tab ──────────────────────────────────────────────── */}
          {mode === 'manual' && (
            <View style={styles.section}>
              <View style={styles.subPillRow}>
                <TouchableOpacity style={[styles.subPill, manualSubMode === 'food' && styles.subPillActive]} onPress={() => setManualSubMode('food')} activeOpacity={0.7}>
                  <Text style={[styles.subPillTxt, manualSubMode === 'food' && styles.subPillTxtActive]}>Alimento</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.subPill, manualSubMode === 'meal' && styles.subPillActive]} onPress={() => setManualSubMode('meal')} activeOpacity={0.7}>
                  <Text style={[styles.subPillTxt, manualSubMode === 'meal' && styles.subPillTxtActive]}>Refeição</Text>
                </TouchableOpacity>
              </View>

              {manualSubMode === 'food' && (
                <View style={{ gap: Spacing.sm }}>
                  <TextInput style={styles.manualInput} placeholder="Nome do alimento" placeholderTextColor={Colors.textDisabled} value={manualName} onChangeText={setManualName} />
                  <View style={styles.manualRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.manualLabel}>Quantidade (g)</Text>
                      <TextInput style={styles.manualInput} keyboardType="numeric" value={String(manualQty)} onChangeText={(t) => setManualQty(parseFloat(t) || 100)} placeholder="100" placeholderTextColor={Colors.textDisabled} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.manualLabel}>Calorias (kcal)</Text>
                      <TextInput style={styles.manualInput} keyboardType="numeric" value={manualCal} onChangeText={setManualCal} placeholder="0" placeholderTextColor={Colors.textDisabled} />
                    </View>
                  </View>
                  <View style={styles.manualRow}>
                    <View style={{ flex: 1 }}><Text style={styles.manualLabel}>Proteína (g)</Text><TextInput style={styles.manualInput} keyboardType="numeric" value={manualProtein} onChangeText={setManualProtein} placeholder="0" placeholderTextColor={Colors.textDisabled} /></View>
                    <View style={{ flex: 1 }}><Text style={styles.manualLabel}>Hidratos (g)</Text><TextInput style={styles.manualInput} keyboardType="numeric" value={manualCarbs} onChangeText={setManualCarbs} placeholder="0" placeholderTextColor={Colors.textDisabled} /></View>
                    <View style={{ flex: 1 }}><Text style={styles.manualLabel}>Gordura (g)</Text><TextInput style={styles.manualInput} keyboardType="numeric" value={manualFat} onChangeText={setManualFat} placeholder="0" placeholderTextColor={Colors.textDisabled} /></View>
                  </View>
                  <MacroPreviewCard {...manualPreview} />
                  <View style={styles.twoButtonRow}>
                    <TouchableOpacity style={[styles.saveBtn, { flex: 1, marginTop: 0 }]} onPress={handleManualAddToDiary} activeOpacity={0.8}>
                      <Text style={styles.saveBtnTxt}>{addLabel('Adicionar ao Diário')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.outlineBtnSmall, { flex: 1 }]} onPress={handleManualSaveFood} activeOpacity={0.8}>
                      <Feather name="bookmark" size={13} color={Colors.primary} />
                      <Text style={styles.outlineBtnSmallTxt}>Guardar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {manualSubMode === 'meal' && (
                <View style={{ gap: Spacing.sm }}>
                  <TextInput style={styles.manualInput} placeholder="Nome da refeição" placeholderTextColor={Colors.textDisabled} value={mealName} onChangeText={setMealName} />
                  {mealItems.length === 0 ? (
                    <View style={[styles.emptyState, { paddingVertical: Spacing.xl }]}>
                      <Feather name="list" size={32} color={Colors.textDisabled} />
                      <Text style={styles.emptyText}>Nenhum item adicionado</Text>
                    </View>
                  ) : (
                    <View style={{ gap: 6 }}>
                      {mealItems.map((item) => (
                        <View key={item.id} style={styles.mealItemRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.mealItemName}>{item.name}</Text>
                            <Text style={styles.mealItemMeta}>{item.quantity_g}g · {Math.round(item.calories)} kcal</Text>
                          </View>
                          <TouchableOpacity onPress={() => setMealItems((prev) => prev.filter((i) => i.id !== item.id))} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <Feather name="trash-2" size={16} color="#E85D75" />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                  {mealItems.length > 0 && (
                    <View style={styles.totalBar}>
                      <Text style={styles.totalBarLabel}>Total:</Text>
                      <Text style={styles.totalBarKcal}>{Math.round(mealTotals.cal)} kcal</Text>
                      <Text style={[styles.totalBarMacro, { color: MacroColors.protein }]}>P {Math.round(mealTotals.p * 10) / 10}g</Text>
                      <Text style={[styles.totalBarMacro, { color: MacroColors.carbs }]}>C {Math.round(mealTotals.c * 10) / 10}g</Text>
                      <Text style={[styles.totalBarMacro, { color: MacroColors.fat }]}>G {Math.round(mealTotals.f * 10) / 10}g</Text>
                    </View>
                  )}
                  <TouchableOpacity style={styles.outlineBtn} onPress={() => setAddItemModalVisible(true)} activeOpacity={0.8}>
                    <Feather name="plus" size={15} color={Colors.primary} />
                    <Text style={styles.outlineBtnTxt}>Adicionar item</Text>
                  </TouchableOpacity>
                  <View style={styles.twoButtonRow}>
                    <TouchableOpacity style={[styles.saveBtn, { flex: 1, marginTop: 0 }]} onPress={handleMealAddToDiary} activeOpacity={0.8}>
                      <Text style={styles.saveBtnTxt}>{addLabel('Adicionar ao Diário')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.outlineBtnSmall, { flex: 1 }]} onPress={handleSaveMealRefeicao} activeOpacity={0.8}>
                      <Feather name="bookmark" size={13} color={Colors.primary} />
                      <Text style={styles.outlineBtnSmallTxt}>Guardar Refeição</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* ── Saved Tab ───────────────────────────────────────────────── */}
          {mode === 'saved' && (
            <View style={styles.section}>
              <View style={styles.subPillRow}>
                <TouchableOpacity style={[styles.subPill, savedSubMode === 'meals' && styles.subPillActive]} onPress={() => setSavedSubMode('meals')} activeOpacity={0.7}>
                  <Text style={[styles.subPillTxt, savedSubMode === 'meals' && styles.subPillTxtActive]}>Refeições</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.subPill, savedSubMode === 'foods' && styles.subPillActive]} onPress={() => setSavedSubMode('foods')} activeOpacity={0.7}>
                  <Text style={[styles.subPillTxt, savedSubMode === 'foods' && styles.subPillTxtActive]}>Alimentos</Text>
                </TouchableOpacity>
              </View>

              {/* Refeições */}
              {savedSubMode === 'meals' && (
                savedStore.meals.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Feather name="bookmark" size={48} color={Colors.textDisabled} />
                    <Text style={styles.emptyTitle}>Sem refeições guardadas</Text>
                    <Text style={styles.emptyText}>Guarda refeições nos outros separadores</Text>
                  </View>
                ) : (
                  <View style={{ gap: Spacing.sm }}>
                    {savedStore.meals.map((savedMeal) => (
                      <TouchableOpacity key={savedMeal.id} activeOpacity={0.8} onLongPress={() => longPressMeal(savedMeal)} style={styles.savedCard}>
                        <View style={styles.savedCardLeft}>
                          {renamingMealId === savedMeal.id ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                              <TextInput
                                style={[styles.manualInput, { flex: 1, paddingVertical: 6 }]}
                                value={renameText}
                                onChangeText={setRenameText}
                                autoFocus
                                returnKeyType="done"
                                onSubmitEditing={handleRenameConfirm}
                              />
                              <TouchableOpacity onPress={handleRenameConfirm} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                <Feather name="check" size={18} color={Colors.primary} />
                              </TouchableOpacity>
                            </View>
                          ) : (
                            <Text style={styles.savedCardName}>{savedMeal.name}</Text>
                          )}
                          <Text style={styles.savedCardMeta}>{savedMeal.items.length} {savedMeal.items.length !== 1 ? 'itens' : 'item'} · {Math.round(savedMeal.totalCalories)} kcal</Text>
                          <View style={styles.savedMacroPills}>
                            <View style={styles.savedMacroPill}><Text style={[styles.savedMacroTxt, { color: MacroColors.protein }]}>P {Math.round(savedMeal.totalProtein * 10) / 10}g</Text></View>
                            <View style={styles.savedMacroPill}><Text style={[styles.savedMacroTxt, { color: MacroColors.carbs }]}>C {Math.round(savedMeal.totalCarbs * 10) / 10}g</Text></View>
                            <View style={styles.savedMacroPill}><Text style={[styles.savedMacroTxt, { color: MacroColors.fat }]}>G {Math.round(savedMeal.totalFat * 10) / 10}g</Text></View>
                          </View>
                        </View>
                        <View style={styles.savedCardActions}>
                          <TouchableOpacity onPress={() => confirmDeleteMeal(savedMeal)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ marginBottom: 6 }}>
                            <Feather name="trash-2" size={16} color={Colors.textDisabled} />
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.addPillBtn} onPress={() => addSavedMeal(savedMeal)} activeOpacity={0.7}>
                            <Text style={styles.addPillBtnTxt}>{activeMeal ? MEAL_DISPLAY[activeMeal].split('-')[0] : 'Adicionar'}</Text>
                          </TouchableOpacity>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )
              )}

              {/* Alimentos */}
              {savedSubMode === 'foods' && (
                savedStore.foods.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Feather name="bookmark" size={48} color={Colors.textDisabled} />
                    <Text style={styles.emptyTitle}>Sem alimentos guardados</Text>
                    <Text style={styles.emptyText}>Guarda alimentos na pesquisa ou entrada manual</Text>
                  </View>
                ) : (
                  <View style={{ gap: Spacing.sm }}>
                    {savedStore.foods.map((food) => (
                      <TouchableOpacity key={food.id} activeOpacity={0.8} onLongPress={() => confirmDeleteFood(food)} style={styles.savedCard}>
                        <View style={styles.savedCardLeft}>
                          <Text style={styles.savedCardName}>{food.name}</Text>
                          <Text style={styles.savedCardMeta}>{food.calories_100g} kcal/100g</Text>
                          <View style={styles.savedMacroPills}>
                            <View style={styles.savedMacroPill}><Text style={[styles.savedMacroTxt, { color: MacroColors.protein }]}>P {food.protein_100g}g</Text></View>
                            <View style={styles.savedMacroPill}><Text style={[styles.savedMacroTxt, { color: MacroColors.carbs }]}>C {food.carbs_100g}g</Text></View>
                            <View style={styles.savedMacroPill}><Text style={[styles.savedMacroTxt, { color: MacroColors.fat }]}>G {food.fat_100g}g</Text></View>
                          </View>
                          <View style={styles.foodQtyRow}>
                            <TouchableOpacity style={styles.qtyBtn} onPress={() => setSavedFoodQtys((q) => ({ ...q, [food.id]: Math.max(10, (q[food.id] ?? 100) - 10) }))}>
                              <Text style={styles.qtyBtnTxt}>-</Text>
                            </TouchableOpacity>
                            <QuantityInput value={savedFoodQtys[food.id] ?? 100} onChange={(v) => setSavedFoodQtys((q) => ({ ...q, [food.id]: v }))} min={10} />
                            <TouchableOpacity style={styles.qtyBtn} onPress={() => setSavedFoodQtys((q) => ({ ...q, [food.id]: (q[food.id] ?? 100) + 10 }))}>
                              <Text style={styles.qtyBtnTxt}>+</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                        <View style={styles.savedCardActions}>
                          <TouchableOpacity onPress={() => confirmDeleteFood(food)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ marginBottom: 6 }}>
                            <Feather name="trash-2" size={16} color={Colors.textDisabled} />
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.addPillBtn} onPress={() => addSavedFood(food)} activeOpacity={0.7}>
                            <Text style={styles.addPillBtnTxt}>Adicionar</Text>
                          </TouchableOpacity>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )
              )}
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Toast */}
      <Toast message={toast.message} visible={toast.visible} color={toast.color} />

      {/* Meal selector sheet */}
      <MealSelectorSheet visible={mealSheetVisible} onSelect={handleSheetSelect} onClose={() => setMealSheetVisible(false)} bottomInset={insets.bottom} />

      {/* Save Meal Modal */}
      <Modal visible={saveModalVisible} transparent animationType="fade" onRequestClose={() => setSaveModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Guardar Refeição</Text>
            <Text style={styles.modalSubtitle}>Dá um nome a esta refeição</Text>
            <TextInput style={styles.modalInput} placeholder="ex: Almoço de frango" placeholderTextColor={Colors.textDisabled} value={saveMealName} onChangeText={setSaveMealName} autoFocus />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={() => setSaveModalVisible(false)} activeOpacity={0.7}>
                <Text style={styles.modalBtnCancelTxt}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnConfirm, !saveMealName.trim() && { opacity: 0.4 }]} onPress={confirmSaveMeal} activeOpacity={0.7} disabled={!saveMealName.trim()}>
                <Text style={styles.modalBtnConfirmTxt}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Item Modal */}
      <Modal visible={addItemModalVisible} transparent animationType="slide" onRequestClose={() => setAddItemModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { gap: Spacing.sm }]}>
            <Text style={styles.modalTitle}>Adicionar item</Text>
            <TextInput style={styles.manualInput} placeholder="Nome do alimento" placeholderTextColor={Colors.textDisabled} value={itemName} onChangeText={setItemName} autoFocus />
            <View style={styles.manualRow}>
              <View style={{ flex: 1 }}><Text style={styles.manualLabel}>Qtd (g)</Text><TextInput style={styles.manualInput} keyboardType="numeric" value={String(itemQty)} onChangeText={(t) => setItemQty(parseFloat(t) || 100)} placeholder="100" placeholderTextColor={Colors.textDisabled} /></View>
              <View style={{ flex: 1 }}><Text style={styles.manualLabel}>kcal</Text><TextInput style={styles.manualInput} keyboardType="numeric" value={itemCal} onChangeText={setItemCal} placeholder="0" placeholderTextColor={Colors.textDisabled} /></View>
            </View>
            <View style={styles.manualRow}>
              <View style={{ flex: 1 }}><Text style={styles.manualLabel}>Proteína</Text><TextInput style={styles.manualInput} keyboardType="numeric" value={itemProtein} onChangeText={setItemProtein} placeholder="0" placeholderTextColor={Colors.textDisabled} /></View>
              <View style={{ flex: 1 }}><Text style={styles.manualLabel}>Hidratos</Text><TextInput style={styles.manualInput} keyboardType="numeric" value={itemCarbs} onChangeText={setItemCarbs} placeholder="0" placeholderTextColor={Colors.textDisabled} /></View>
              <View style={{ flex: 1 }}><Text style={styles.manualLabel}>Gordura</Text><TextInput style={styles.manualInput} keyboardType="numeric" value={itemFat} onChangeText={setItemFat} placeholder="0" placeholderTextColor={Colors.textDisabled} /></View>
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={() => setAddItemModalVisible(false)} activeOpacity={0.7}>
                <Text style={styles.modalBtnCancelTxt}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnConfirm, !itemName.trim() && { opacity: 0.4 }]} onPress={handleAddItemToMeal} activeOpacity={0.7} disabled={!itemName.trim()}>
                <Text style={styles.modalBtnConfirmTxt}>Adicionar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Barcode Scanner Modal */}
      <Modal visible={scannerVisible} transparent={false} animationType="slide" onRequestClose={() => setScannerVisible(false)}>
        <View style={scanStyles.container}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            enableTorch={torchEnabled}
            onBarcodeScanned={scanned ? undefined : handleBarcodeScan}
            barcodeScannerSettings={{
              barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'itf14', 'codabar', 'datamatrix', 'pdf417', 'aztec', 'qr'],
            }}
          />
          <View style={scanStyles.overlay}>
            <View style={scanStyles.overlayTop} />
            <View style={scanStyles.overlayMiddle}>
              <View style={scanStyles.overlaySide} />
              <View style={scanStyles.frame}>
                <View style={[scanStyles.corner, scanStyles.cornerTL, isProcessing && { borderColor: '#4CAF50' }]} />
                <View style={[scanStyles.corner, scanStyles.cornerTR, isProcessing && { borderColor: '#4CAF50' }]} />
                <View style={[scanStyles.corner, scanStyles.cornerBL, isProcessing && { borderColor: '#4CAF50' }]} />
                <View style={[scanStyles.corner, scanStyles.cornerBR, isProcessing && { borderColor: '#4CAF50' }]} />
                <Animated.View style={[scanStyles.scanLine, { transform: [{ translateY: scanLineAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 240] }) }] }]} />
              </View>
              <View style={scanStyles.overlaySide} />
            </View>
            <View style={scanStyles.overlayBottom}>
              {isProcessing ? (
                <View style={{ alignItems: 'center', gap: 10 }}>
                  <ActivityIndicator color="#4CAF50" size="small" />
                  <Text style={[scanStyles.hint, { color: '#4CAF50' }]}>Código lido! A pesquisar...</Text>
                </View>
              ) : (
                <>
                  <Text style={scanStyles.hint}>Aponta para o código de barras</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
                    {[1, 2, 3].map(i => (
                      <View key={i} style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: i <= scanConfidence ? Colors.primary : 'rgba(255,255,255,0.3)' }} />
                    ))}
                  </View>
                  <TouchableOpacity onPress={handleManualEntry} style={{ marginTop: 24, flexDirection: 'row', alignItems: 'center', gap: 8 }} activeOpacity={0.7}>
                    <Feather name="edit-3" size={14} color="rgba(255,255,255,0.6)" />
                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>Introduzir código manualmente</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
          <View style={[scanStyles.topBar, { paddingTop: insets.top + 8 }]}>
            <TouchableOpacity style={scanStyles.iconBtn} onPress={() => setScannerVisible(false)}>
              <Feather name="x" size={22} color={Colors.white} />
            </TouchableOpacity>
            <TouchableOpacity style={scanStyles.iconBtn} onPress={() => setTorchEnabled((v) => !v)}>
              <Feather name="zap" size={22} color={torchEnabled ? Colors.carbs : Colors.white} />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const chipStyles = StyleSheet.create({
  chip: { borderWidth: 1, borderRadius: Radius.sm, paddingHorizontal: 7, paddingVertical: 3, alignItems: 'center' },
  value: { fontSize: Typography.sm, fontWeight: FontWeight.bold },
  label: { fontSize: 10, color: Colors.textSecondary },
});

const previewStyles = StyleSheet.create({
  card: { backgroundColor: Colors.primaryLight, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.primary + '30', gap: 8 },
  kcal: { fontSize: Typography.xl, fontWeight: FontWeight.bold, color: Colors.primary, textAlign: 'center' },
  pills: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  pill: { borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 4 },
  pillTxt: { fontSize: Typography.sm, fontWeight: FontWeight.semibold },
});

const qtyStyles = StyleSheet.create({
  display: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: Colors.primaryLight, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.primary + '40', minWidth: 60, alignItems: 'center' },
  displayTxt: { fontSize: Typography.base, color: Colors.primary, fontWeight: FontWeight.semibold, textAlign: 'center' },
  input: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: Colors.backgroundSubtle, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.primary, minWidth: 60, fontSize: Typography.base, color: Colors.textPrimary, fontWeight: FontWeight.semibold, textAlign: 'center' },
});

const toastStyles = StyleSheet.create({
  container: { position: 'absolute', bottom: 20, alignSelf: 'center', borderRadius: Radius.pill, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm + 2, flexDirection: 'row', alignItems: 'center', gap: 8, ...Shadow.strong, zIndex: 999 },
  text: { color: Colors.white, fontSize: Typography.sm, fontWeight: FontWeight.bold },
});

const sheetStyles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, paddingHorizontal: Spacing.lg, ...Shadow.strong },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: Spacing.md },
  title: { fontSize: Typography.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.md },
  option: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  optionIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  optionLabel: { flex: 1, fontSize: Typography.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  cancelBtn: { alignItems: 'center', paddingVertical: 16 },
  cancelTxt: { fontSize: Typography.base, color: Colors.textSecondary, fontWeight: FontWeight.medium },
});

const SCANNER_SIZE = 250;
const scanStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center' },
  overlayTop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  overlayMiddle: { flexDirection: 'row', height: SCANNER_SIZE },
  overlaySide: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  overlayBottom: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', paddingTop: 24 },
  frame: { width: SCANNER_SIZE, height: SCANNER_SIZE, overflow: 'hidden' },
  corner: { position: 'absolute', width: 28, height: 28, borderColor: Colors.primary, borderWidth: 3 },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  scanLine: { position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: Colors.primary, opacity: 0.9 },
  hint: { color: Colors.white, fontSize: Typography.sm, fontWeight: FontWeight.medium, textAlign: 'center', paddingHorizontal: 24 },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg },
  title: { fontSize: Typography.xxl, color: Colors.textPrimary, fontWeight: FontWeight.bold, marginBottom: Spacing.sm },
  contextPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.primaryLight, borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: 7, alignSelf: 'flex-start', marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.primary + '30' },
  contextPillTxt: { fontSize: Typography.sm, color: Colors.primary, fontWeight: FontWeight.semibold },
  modeToggle: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F4FF', borderRadius: 50, padding: 4, marginHorizontal: 16, marginVertical: 12 },
  modeBtn: { flex: 1, paddingVertical: 8, paddingHorizontal: 6, borderRadius: 50, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 3 },
  modeBtnActive: { backgroundColor: Colors.primary, ...Shadow.card },
  modeBtnTxt: { fontSize: Typography.xs, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  modeBtnTxtActive: { color: Colors.white, fontWeight: FontWeight.bold },
  section: { gap: Spacing.md },
  textArea: { backgroundColor: Colors.backgroundSubtle, borderRadius: Radius.lg, padding: Spacing.md, color: Colors.textPrimary, fontSize: Typography.base, minHeight: 100, borderWidth: 1, borderColor: Colors.border },
  photoButtonRow: { flexDirection: 'row', gap: Spacing.sm },
  photoOutlineBtn: { borderWidth: 1, borderColor: Colors.primary + '60', borderRadius: Radius.md, paddingVertical: 8, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6, backgroundColor: Colors.primaryLight },
  photoOutlineBtnTxt: { color: Colors.primary, fontSize: Typography.sm, fontWeight: FontWeight.medium },
  photoThumbContainer: { position: 'absolute', right: 8, top: 8 },
  photoThumb: { width: 80, height: 80, borderRadius: Radius.md },
  photoThumbRemove: { position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: '#E85D75', alignItems: 'center', justifyContent: 'center' },
  primaryBtn: { backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingVertical: Spacing.md, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, ...Shadow.strong },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnTxt: { color: Colors.white, fontSize: Typography.base, fontWeight: FontWeight.bold },
  outlineBtn: { borderWidth: 1.5, borderColor: Colors.primary, borderRadius: Radius.lg, paddingVertical: Spacing.sm + 2, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  outlineBtnTxt: { color: Colors.primary, fontSize: Typography.base, fontWeight: FontWeight.semibold },
  outlineBtnSmall: { borderWidth: 1.5, borderColor: Colors.primary, borderRadius: Radius.md, paddingVertical: Spacing.sm, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  outlineBtnSmallTxt: { color: Colors.primary, fontSize: Typography.sm, fontWeight: FontWeight.semibold },
  twoButtonRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: 4 },
  resultsContainer: { gap: Spacing.sm },
  resultsTitle: { fontSize: Typography.base, color: Colors.textPrimary, fontWeight: FontWeight.semibold },
  resultCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.sm, borderWidth: 1, borderColor: Colors.border, ...Shadow.card },
  resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  resultName: { fontSize: Typography.base, color: Colors.textPrimary, fontWeight: FontWeight.semibold, flex: 1 },
  resultBrand: { fontSize: Typography.xs, color: Colors.textSecondary },
  resultQty: { fontSize: Typography.sm, color: Colors.textSecondary },
  resultMacros: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: Spacing.sm, alignItems: 'center', marginTop: 4 },
  saveBtnTxt: { color: Colors.white, fontSize: Typography.base, fontWeight: FontWeight.bold },
  searchRow: { flexDirection: 'row', gap: Spacing.sm },
  searchInput: { flex: 1, backgroundColor: Colors.backgroundSubtle, borderRadius: Radius.lg, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2, color: Colors.textPrimary, fontSize: Typography.base, borderWidth: 1, borderColor: Colors.border },
  barcodeBtn: { width: 46, borderRadius: Radius.lg, backgroundColor: Colors.backgroundSubtle, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  searchBtn: { backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingHorizontal: Spacing.md, alignItems: 'center', justifyContent: 'center', minWidth: 52, ...Shadow.card },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  qtyBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.backgroundSubtle, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  qtyBtnTxt: { fontSize: Typography.lg, color: Colors.textPrimary, fontWeight: FontWeight.bold },
  subPillRow: { flexDirection: 'row', backgroundColor: Colors.backgroundSubtle, borderRadius: Radius.pill, padding: 3, borderWidth: 1, borderColor: Colors.border, alignSelf: 'center' },
  subPill: { paddingHorizontal: Spacing.lg, paddingVertical: 7, borderRadius: Radius.pill },
  subPillActive: { backgroundColor: Colors.primary, ...Shadow.card },
  subPillTxt: { fontSize: Typography.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  subPillTxtActive: { color: Colors.white, fontWeight: FontWeight.bold },
  emptyState: { alignItems: 'center', paddingVertical: Spacing.xxxl, gap: Spacing.md },
  emptyTitle: { fontSize: Typography.lg, color: Colors.textPrimary, fontWeight: FontWeight.semibold },
  emptyText: { fontSize: Typography.sm, color: Colors.textSecondary, textAlign: 'center' },
  savedCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, ...Shadow.card },
  savedCardLeft: { flex: 1, gap: 4 },
  savedCardActions: { alignItems: 'center', gap: 4 },
  savedCardName: { fontSize: Typography.base, color: Colors.textPrimary, fontWeight: FontWeight.bold },
  savedCardMeta: { fontSize: Typography.sm, color: Colors.textSecondary },
  savedMacroPills: { flexDirection: 'row', gap: 6, marginTop: 4 },
  savedMacroPill: { backgroundColor: Colors.backgroundSubtle, borderRadius: Radius.sm, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: Colors.border },
  savedMacroTxt: { fontSize: Typography.xs, fontWeight: FontWeight.semibold },
  foodQtyRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  addPillBtn: { backgroundColor: Colors.primary, borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: 8, alignItems: 'center', justifyContent: 'center', ...Shadow.card },
  addPillBtnTxt: { color: Colors.white, fontSize: Typography.sm, fontWeight: FontWeight.bold },
  manualInput: { backgroundColor: Colors.backgroundSubtle, borderRadius: Radius.lg, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2, color: Colors.textPrimary, fontSize: Typography.base, borderWidth: 1, borderColor: Colors.border },
  manualRow: { flexDirection: 'row', gap: Spacing.sm },
  manualLabel: { fontSize: Typography.xs, color: Colors.textSecondary, fontWeight: FontWeight.medium, marginBottom: 4 },
  mealItemRow: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.sm + 2, borderWidth: 1, borderColor: Colors.border, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  mealItemName: { fontSize: Typography.sm, color: Colors.textPrimary, fontWeight: FontWeight.semibold },
  mealItemMeta: { fontSize: Typography.xs, color: Colors.textSecondary },
  totalBar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.backgroundSubtle, borderRadius: Radius.md, padding: Spacing.sm + 2, borderWidth: 1, borderColor: Colors.border, flexWrap: 'wrap' },
  totalBarLabel: { fontSize: Typography.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  totalBarKcal: { fontSize: Typography.sm, color: Colors.primary, fontWeight: FontWeight.bold },
  totalBarMacro: { fontSize: Typography.sm, fontWeight: FontWeight.semibold },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  modalBox: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.xl, width: '100%', gap: Spacing.md, ...Shadow.strong },
  modalTitle: { fontSize: Typography.lg, color: Colors.textPrimary, fontWeight: FontWeight.bold },
  modalSubtitle: { fontSize: Typography.sm, color: Colors.textSecondary },
  modalInput: { backgroundColor: Colors.backgroundSubtle, borderRadius: Radius.lg, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2, color: Colors.textPrimary, fontSize: Typography.base, borderWidth: 1, borderColor: Colors.border },
  modalButtons: { flexDirection: 'row', gap: Spacing.sm, marginTop: 4 },
  modalBtn: { flex: 1, borderRadius: Radius.lg, paddingVertical: Spacing.sm + 2, alignItems: 'center' },
  modalBtnCancel: { backgroundColor: Colors.backgroundSubtle, borderWidth: 1, borderColor: Colors.border },
  modalBtnCancelTxt: { color: Colors.textSecondary, fontSize: Typography.base, fontWeight: FontWeight.medium },
  modalBtnConfirm: { backgroundColor: Colors.primary, ...Shadow.card },
  modalBtnConfirmTxt: { color: Colors.white, fontSize: Typography.base, fontWeight: FontWeight.bold },
});

const editCardStyles = StyleSheet.create({
  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md, gap: 10, borderWidth: 1, borderColor: Colors.border, ...Shadow.card },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  name: { flex: 1, fontSize: Typography.base, color: Colors.textPrimary, fontWeight: FontWeight.semibold },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  qtyBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.primary + '40' },
  macros: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kcal: { fontSize: Typography.base, fontWeight: FontWeight.bold, color: Colors.primary },
  macroPills: { flexDirection: 'row', gap: 8 },
  macro: { fontSize: Typography.sm, fontWeight: FontWeight.semibold },
  totalsBar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: '#EEF3FD', borderRadius: Radius.md, padding: Spacing.sm + 2, borderWidth: 1, borderColor: Colors.primary + '30', flexWrap: 'wrap' },
  totalKcal: { fontSize: Typography.sm, color: Colors.primary, fontWeight: FontWeight.bold, marginRight: 4 },
  totalMacro: { fontSize: Typography.sm, fontWeight: FontWeight.semibold },
});
