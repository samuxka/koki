import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Share,
  Modal,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  Scale,
  Sparkles,
  Share2,
  RotateCcw,
  BookOpen,
  PieChart,
  Circle,
  Square,
  Search,
  Check,
  X,
  ArrowRight,
  Flame,
  Clock,
  Save,
  Wheat,
} from 'lucide-react-native';
import { api } from '../../src/services/api';
import { colors, spacing, typography, borderRadius } from '../../src/theme';
import { formatCurrency } from '../../src/utils/formatters';
import { Recipe, RecipeIngredient } from '@koki/types';
import { Badge, LoadingState, EmptyState } from '../../src/components/ui';
import { useAlertStore } from '../../src/stores/alert.store';

type ScalingMode = 'multiplier' | 'pan' | 'flour';
type PanShape = 'round' | 'rectangular';

const PRESET_MULTIPLIERS = [0.5, 1, 1.5, 2, 2.5, 3, 5];

const COMMON_ROUND_PANS = [
  { label: '15 cm', value: 15 },
  { label: '20 cm (Padrão)', value: 20 },
  { label: '22 cm', value: 22 },
  { label: '25 cm', value: 25 },
  { label: '28 cm', value: 28 },
  { label: '30 cm', value: 30 },
];

export default function RecipeScalerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { showAlert } = useAlertStore();

  // Mode
  const [activeMode, setActiveMode] = useState<ScalingMode>('multiplier');

  // Selected Recipe
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [recipePickerModalVisible, setRecipePickerModalVisible] = useState<boolean>(false);
  const [recipeSearchQuery, setRecipeSearchQuery] = useState<string>('');

  // Mode 1: Multiplier / Target Yield
  const [multiplier, setMultiplier] = useState<number>(1);
  const [customYieldStr, setCustomYieldStr] = useState<string>('');

  // Mode 2: Pan Scaling
  const [origPanShape, setOrigPanShape] = useState<PanShape>('round');
  const [origDiameter, setOrigDiameter] = useState<number>(20);
  const [origLength, setOrigLength] = useState<string>('20');
  const [origWidth, setOrigWidth] = useState<string>('20');

  const [targetPanShape, setTargetPanShape] = useState<PanShape>('round');
  const [targetDiameter, setTargetDiameter] = useState<number>(25);
  const [targetLength, setTargetLength] = useState<string>('30');
  const [targetWidth, setTargetWidth] = useState<string>('20');

  // Mode 3: Flour / Baker's %
  const [customFlourStr, setCustomFlourStr] = useState<string>('500');

  // Fetch available recipes
  const { data: recipesData, isLoading: isLoadingRecipes } = useQuery<{ items: Recipe[] }>({
    queryKey: ['recipes-all-for-scaler'],
    queryFn: () => api.get<{ items: Recipe[] }>('/recipes?limit=100'),
  });

  const availableRecipes = recipesData?.items || [];

  // Filtered recipes in modal
  const filteredRecipes = useMemo(() => {
    if (!recipeSearchQuery.trim()) return availableRecipes;
    const q = recipeSearchQuery.toLowerCase();
    return availableRecipes.filter(
      (r) => r.name.toLowerCase().includes(q) || r.category.toLowerCase().includes(q),
    );
  }, [availableRecipes, recipeSearchQuery]);

  // If none selected yet and recipes loaded, auto-select first recipe
  React.useEffect(() => {
    if (!selectedRecipe && availableRecipes.length > 0) {
      const first = availableRecipes[0];
      setSelectedRecipe(first);
      setCustomYieldStr((first.yield || 1).toString());
    }
  }, [availableRecipes, selectedRecipe]);

  // Calculate scaling factor based on active mode
  const scalingFactor = useMemo(() => {
    if (!selectedRecipe) return 1;

    if (activeMode === 'multiplier') {
      const parsedYield = parseFloat(customYieldStr.replace(',', '.')) || 0;
      if (parsedYield > 0 && selectedRecipe.yield > 0) {
        return parsedYield / selectedRecipe.yield;
      }
      return multiplier > 0 ? multiplier : 1;
    }

    if (activeMode === 'pan') {
      const origArea =
        origPanShape === 'round'
          ? Math.PI * Math.pow(origDiameter / 2, 2)
          : (parseFloat(origLength) || 20) * (parseFloat(origWidth) || 20);

      const targetArea =
        targetPanShape === 'round'
          ? Math.PI * Math.pow(targetDiameter / 2, 2)
          : (parseFloat(targetLength) || 30) * (parseFloat(targetWidth) || 20);

      return origArea > 0 ? targetArea / origArea : 1;
    }

    if (activeMode === 'flour') {
      const flourIng = (selectedRecipe.ingredients || []).find(
        (i) => i.isFlour || i.name.toLowerCase().includes('farinha'),
      );
      const origFlour = flourIng?.quantity || 0;
      const targetFlour = parseFloat(customFlourStr.replace(',', '.')) || 0;

      if (origFlour > 0 && targetFlour > 0) {
        return targetFlour / origFlour;
      }
      return 1;
    }

    return 1;
  }, [
    activeMode,
    selectedRecipe,
    customYieldStr,
    multiplier,
    origPanShape,
    origDiameter,
    origLength,
    origWidth,
    targetPanShape,
    targetDiameter,
    targetLength,
    targetWidth,
    customFlourStr,
  ]);

  // Calculate scaled data
  const scaledData = useMemo(() => {
    if (!selectedRecipe) {
      return {
        factor: 1,
        scaledYield: 1,
        yieldUnit: 'unidades',
        scaledIngredients: [],
        originalTotalCostCents: 0,
        scaledTotalCostCents: 0,
        costPerYieldUnitCents: 0,
      };
    }

    const factor = Number(scalingFactor.toFixed(4));
    const originalYield = selectedRecipe.yield || 1;
    const scaledYield = Number((originalYield * factor).toFixed(2));
    const ingredients = selectedRecipe.ingredients || [];

    const totalScaledFlour = ingredients
      .filter((i) => i.isFlour || i.name.toLowerCase().includes('farinha'))
      .reduce((sum, i) => sum + i.quantity * factor, 0);

    let originalTotalCostCents = 0;
    let scaledTotalCostCents = 0;

    const scaledIngredients = ingredients.map((ing) => {
      const scaledQuantity = Number((ing.quantity * factor).toFixed(2));
      const origCost = ing.costCents || Math.round((ing.unitCostCents || 0) * ing.quantity);
      const scaledCost = Math.round(origCost * factor);

      originalTotalCostCents += origCost;
      scaledTotalCostCents += scaledCost;

      const bakersPercentage =
        totalScaledFlour > 0
          ? Number(((scaledQuantity / totalScaledFlour) * 100).toFixed(1))
          : undefined;

      return {
        ...ing,
        originalQuantity: ing.quantity,
        scaledQuantity,
        originalCostCents: origCost,
        scaledCostCents: scaledCost,
        bakersPercentage,
      };
    });

    const costPerYieldUnitCents =
      scaledYield > 0 ? Math.round(scaledTotalCostCents / scaledYield) : 0;

    return {
      factor,
      originalYield,
      scaledYield,
      yieldUnit: selectedRecipe.yieldUnit || 'porções',
      scaledIngredients,
      originalTotalCostCents,
      scaledTotalCostCents,
      costPerYieldUnitCents,
    };
  }, [selectedRecipe, scalingFactor]);

  // Save Scaled Recipe as a New Recipe
  const saveAsNewRecipeMutation = useMutation({
    mutationFn: (newRecipeData: any) => api.post<Recipe>('/recipes', newRecipeData),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      queryClient.invalidateQueries({ queryKey: ['recipes-summary'] });
      showAlert({
        title: 'Receita Salva!',
        message: `A nova receita escalonada "${created.name}" foi adicionada com sucesso ao seu catálogo.`,
        type: 'success',
        buttons: [
          { text: 'Continuar no Escalonador', style: 'default' },
          { text: 'Ver Receita', onPress: () => router.push(`/recipes/${created.id}` as any) },
        ],
      });
    },
    onError: (err: any) => {
      showAlert({
        title: 'Erro ao salvar',
        message: err.message || 'Não foi possível salvar a nova receita.',
        type: 'danger',
        buttons: [{ text: 'OK', style: 'default' }],
      });
    },
  });

  const handleSaveAsNewRecipe = () => {
    if (!selectedRecipe) return;

    const newName = `${selectedRecipe.name} (${scaledData.scaledYield} ${scaledData.yieldUnit})`;

    showAlert({
      title: 'Salvar Ficha Técnica?',
      message: `Deseja salvar a versão escalonada como uma nova receita:\n"${newName}"?`,
      type: 'confirm',
      buttons: [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Salvar',
          style: 'default',
          onPress: () => {
            saveAsNewRecipeMutation.mutate({
              name: newName,
              category: selectedRecipe.category,
              description: `Escalonada a partir de ${selectedRecipe.name} (fator ${scaledData.factor}x)`,
              yield: scaledData.scaledYield,
              yieldUnit: scaledData.yieldUnit,
              prepTimeMinutes: selectedRecipe.prepTimeMinutes,
              bakeTimeMinutes: selectedRecipe.bakeTimeMinutes,
              ovenTemperature: selectedRecipe.ovenTemperature,
              instructions: selectedRecipe.instructions || [],
              ingredients: scaledData.scaledIngredients.map((i) => ({
                inventoryItemId: i.inventoryItemId,
                name: i.name,
                quantity: i.scaledQuantity,
                unit: i.unit,
                unitCostCents: i.unitCostCents,
                costCents: i.scaledCostCents,
                isFlour: i.isFlour,
                bakersPercentage: i.bakersPercentage,
              })),
            });
          },
        },
      ],
    });
  };

  // Share Scaled Recipe to WhatsApp / Team
  const handleShare = async () => {
    if (!selectedRecipe) return;

    let text = `🎂 *RECEITA ESCALONADA KOKI*\n`;
    text += `*${selectedRecipe.name}*\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

    text += `📊 *RENDIMENTO & ESCALA*\n`;
    text += `• Fator: ${scaledData.factor.toFixed(2)}x (${
      scaledData.factor >= 1
        ? `+${Math.round((scaledData.factor - 1) * 100)}%`
        : `-${Math.round((1 - scaledData.factor) * 100)}%`
    })\n`;
    text += `• Rendimento: ${scaledData.scaledYield} ${scaledData.yieldUnit} (Original: ${scaledData.originalYield})\n`;
    if (selectedRecipe.ovenTemperature) {
      text += `• Forno: ${selectedRecipe.ovenTemperature}°C`;
      if (selectedRecipe.bakeTimeMinutes) text += ` • ${selectedRecipe.bakeTimeMinutes} min`;
      text += `\n`;
    }
    text += `\n`;

    text += `🥣 *INGREDIENTES ESCALONADOS*\n`;
    scaledData.scaledIngredients.forEach((ing) => {
      const bp = ing.bakersPercentage ? ` [${ing.bakersPercentage}%]` : '';
      text += `▪ *${ing.scaledQuantity} ${ing.unit}* - ${ing.name}${bp}\n`;
    });
    text += `\n`;

    text += `💰 *CUSTOS ESTIMADOS*\n`;
    text += `• Custo Total: ${formatCurrency(scaledData.scaledTotalCostCents)}\n`;
    text += `• Custo por ${scaledData.yieldUnit}: ${formatCurrency(scaledData.costPerYieldUnitCents)}\n\n`;

    text += `_Escalonado com precisão no Koki Confeitaria_ 🍪✨`;

    try {
      await Share.share({ message: text });
    } catch {}
  };

  const handleSelectRecipe = (r: Recipe) => {
    setSelectedRecipe(r);
    setCustomYieldStr((r.yield || 1).toString());
    setMultiplier(1);
    setRecipePickerModalVisible(false);
  };

  const resetScaler = () => {
    setMultiplier(1);
    if (selectedRecipe) {
      setCustomYieldStr((selectedRecipe.yield || 1).toString());
    }
    setOrigDiameter(20);
    setTargetDiameter(25);
    setCustomFlourStr('500');
  };

  return (
    <View style={styles.container}>
      {/* 1. Header Fixo com Safe Area */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) + 8 }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <ChevronLeft size={24} color={colors.primaryDark} />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Escalonador de Receitas</Text>
            <Text style={styles.headerSubtitle}>Proporções, formas e Baker's %</Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerActionButton}
            onPress={handleShare}
            activeOpacity={0.7}
          >
            <Share2 size={20} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerActionButton}
            onPress={resetScaler}
            activeOpacity={0.7}
          >
            <RotateCcw size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 80 }]}
      >
        {/* 2. Seletor de Receita Base */}
        <View style={styles.recipeSelectCard}>
          <View style={styles.recipeSelectHeader}>
            <View style={styles.recipeIconBadge}>
              <BookOpen size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.recipeSelectLabel}>Receita / Ficha Técnica</Text>
              <Text style={styles.recipeSelectName} numberOfLines={1}>
                {selectedRecipe ? selectedRecipe.name : 'Selecione uma receita...'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.changeRecipeBtn}
              onPress={() => setRecipePickerModalVisible(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.changeRecipeBtnText}>Trocar</Text>
            </TouchableOpacity>
          </View>

          {selectedRecipe && (
            <View style={styles.recipeMetaRow}>
              <View style={styles.metaBadge}>
                <Text style={styles.metaBadgeText}>
                  Rendimento original: <Text style={styles.metaBadgeBold}>{selectedRecipe.yield} {selectedRecipe.yieldUnit}</Text>
                </Text>
              </View>

              {selectedRecipe.ovenTemperature ? (
                <View style={styles.metaBadge}>
                  <Flame size={12} color={colors.danger} />
                  <Text style={[styles.metaBadgeText, { color: colors.danger }]}>
                    {selectedRecipe.ovenTemperature}°C
                  </Text>
                </View>
              ) : null}

              {selectedRecipe.bakeTimeMinutes ? (
                <View style={styles.metaBadge}>
                  <Clock size={12} color={colors.textSecondary} />
                  <Text style={styles.metaBadgeText}>{selectedRecipe.bakeTimeMinutes} min</Text>
                </View>
              ) : null}
            </View>
          )}
        </View>

        {/* 3. Modos de Escalonamento (Segmented Control) */}
        <View style={styles.modeTabs}>
          <TouchableOpacity
            style={[styles.modeTab, activeMode === 'multiplier' && styles.modeTabActive]}
            onPress={() => setActiveMode('multiplier')}
          >
            <PieChart size={15} color={activeMode === 'multiplier' ? colors.primary : colors.textMuted} />
            <Text style={[styles.modeTabText, activeMode === 'multiplier' && styles.modeTabTextActive]}>
              Porções / Fator
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeTab, activeMode === 'pan' && styles.modeTabActive]}
            onPress={() => setActiveMode('pan')}
          >
            <Circle size={15} color={activeMode === 'pan' ? colors.primary : colors.textMuted} />
            <Text style={[styles.modeTabText, activeMode === 'pan' && styles.modeTabTextActive]}>
              Forma de Bolo
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeTab, activeMode === 'flour' && styles.modeTabActive]}
            onPress={() => setActiveMode('flour')}
          >
            <Wheat size={15} color={activeMode === 'flour' ? colors.primary : colors.textMuted} />
            <Text style={[styles.modeTabText, activeMode === 'flour' && styles.modeTabTextActive]}>
              Farinha (Baker's %)
            </Text>
          </TouchableOpacity>
        </View>

        {/* 4. Controles do Modo Ativo */}
        <View style={styles.controlsCard}>
          {/* MODO 1: MULTIPLICADOR / RENDIMENTO */}
          {activeMode === 'multiplier' && (
            <View>
              <Text style={styles.controlTitle}>Multiplicadores Rápidos</Text>
              <View style={styles.presetButtonsRow}>
                {PRESET_MULTIPLIERS.map((m) => {
                  const isSelected = multiplier === m && !customYieldStr;
                  return (
                    <TouchableOpacity
                      key={m}
                      style={[styles.presetBtn, isSelected && styles.presetBtnActive]}
                      onPress={() => {
                        setMultiplier(m);
                        if (selectedRecipe) {
                          setCustomYieldStr((selectedRecipe.yield * m).toString());
                        }
                      }}
                    >
                      <Text style={[styles.presetBtnText, isSelected && styles.presetBtnTextActive]}>
                        {m}x
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.customYieldRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Ou informe o Rendimento Desejado:</Text>
                  <View style={styles.inputGroup}>
                    <TextInput
                      style={styles.yieldTextInput}
                      placeholder="Ex: 24"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                      value={customYieldStr}
                      onChangeText={(t) => {
                        setCustomYieldStr(t);
                        const parsed = parseFloat(t.replace(',', '.')) || 0;
                        if (parsed > 0 && selectedRecipe && selectedRecipe.yield > 0) {
                          setMultiplier(parsed / selectedRecipe.yield);
                        }
                      }}
                    />
                    <Text style={styles.yieldUnitSuffix}>
                      {selectedRecipe?.yieldUnit || 'porções'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* MODO 2: CAKE PAN SCALING (FORMAS) */}
          {activeMode === 'pan' && (
            <View>
              <Text style={styles.controlTitle}>Adaptação de Forma de Bolo</Text>
              <Text style={styles.controlSubtitle}>
                Calcula o fator de área para que a massa asse na mesma altura.
              </Text>

              {/* Forma Original */}
              <Text style={styles.subHeaderLabel}>1. Forma Original da Receita:</Text>
              <View style={styles.panPresetRow}>
                {COMMON_ROUND_PANS.map((pan) => (
                  <TouchableOpacity
                    key={pan.value}
                    style={[
                      styles.panChip,
                      origDiameter === pan.value && styles.panChipActive,
                    ]}
                    onPress={() => setOrigDiameter(pan.value)}
                  >
                    <Text
                      style={[
                        styles.panChipText,
                        origDiameter === pan.value && styles.panChipTextActive,
                      ]}
                    >
                      {pan.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Nova Forma Desejada */}
              <Text style={[styles.subHeaderLabel, { marginTop: spacing.md }]}>
                2. Nova Forma Desejada:
              </Text>
              <View style={styles.panPresetRow}>
                {COMMON_ROUND_PANS.map((pan) => (
                  <TouchableOpacity
                    key={pan.value}
                    style={[
                      styles.panChip,
                      targetDiameter === pan.value && styles.panChipActiveTarget,
                    ]}
                    onPress={() => setTargetDiameter(pan.value)}
                  >
                    <Text
                      style={[
                        styles.panChipText,
                        targetDiameter === pan.value && styles.panChipTextActiveTarget,
                      ]}
                    >
                      {pan.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* MODO 3: FARINHA BASE (BAKER'S %) */}
          {activeMode === 'flour' && (
            <View>
              <Text style={styles.controlTitle}>Panificação & Baker's Percentage</Text>
              <Text style={styles.controlSubtitle}>
                Ajuste a quantidade de farinha base (100%) e todos os ingredientes se adaptam automaticamente.
              </Text>

              <Text style={styles.inputLabel}>Quantidade de Farinha Desejada (g):</Text>
              <View style={styles.inputGroup}>
                <TextInput
                  style={styles.yieldTextInput}
                  placeholder="500"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  value={customFlourStr}
                  onChangeText={setCustomFlourStr}
                />
                <Text style={styles.yieldUnitSuffix}>gramas</Text>
              </View>

              <View style={styles.flourTipBox}>
                <Wheat size={16} color={colors.primary} />
                <Text style={styles.flourTipText}>
                  Todos os ingredientes mantêm as proporções exatas de hidratação, fermentação e gordura da massa.
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* 5. Destaque do Fator Aplicado & Comparativo */}
        <View style={styles.factorHighlightCard}>
          <View style={styles.factorCol}>
            <Text style={styles.factorLabel}>Fator de Escala</Text>
            <Text style={styles.factorValue}>{scaledData.factor.toFixed(2)}x</Text>
            <Text style={styles.factorPercent}>
              {scaledData.factor >= 1
                ? `+${Math.round((scaledData.factor - 1) * 100)}% da receita`
                : `-${Math.round((1 - scaledData.factor) * 100)}% da receita`}
            </Text>
          </View>

          <View style={styles.factorDivider} />

          <View style={styles.factorCol}>
            <Text style={styles.factorLabel}>Novo Rendimento</Text>
            <Text style={[styles.factorValue, { color: colors.caramel }]}>
              {scaledData.scaledYield}
            </Text>
            <Text style={styles.factorSub}>{scaledData.yieldUnit}</Text>
          </View>

          <View style={styles.factorDivider} />

          <View style={styles.factorCol}>
            <Text style={styles.factorLabel}>Novo Custo Total</Text>
            <Text style={[styles.factorValue, { color: colors.success }]}>
              {formatCurrency(scaledData.scaledTotalCostCents)}
            </Text>
            <Text style={styles.factorSub}>
              {formatCurrency(scaledData.costPerYieldUnitCents)}/{scaledData.yieldUnit.slice(0, 4)}
            </Text>
          </View>
        </View>

        {/* 6. Tabela de Ingredientes Escalonados */}
        <View style={styles.ingredientsCard}>
          <View style={styles.ingredientsCardHeader}>
            <Text style={styles.ingredientsCardTitle}>Ingredientes Escalonados</Text>
            <Text style={styles.ingredientsCardSubtitle}>
              {scaledData.scaledIngredients.length} ingredientes calculados
            </Text>
          </View>

          {scaledData.scaledIngredients.map((ing, idx) => (
            <View key={idx} style={styles.ingredientRow}>
              <View style={styles.ingNameCol}>
                <View style={styles.ingTitleRow}>
                  <Text style={styles.ingName}>{ing.name}</Text>
                  {ing.isFlour ? (
                    <View style={styles.flourTag}>
                      <Text style={styles.flourTagText}>Base 100%</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.ingOrigQty}>
                  Original: {ing.originalQuantity} {ing.unit} • {formatCurrency(ing.originalCostCents)}
                </Text>
              </View>

              <View style={styles.ingScaledCol}>
                <Text style={styles.ingScaledQty}>
                  {ing.scaledQuantity} <Text style={styles.ingScaledUnit}>{ing.unit}</Text>
                </Text>
                {ing.bakersPercentage !== undefined ? (
                  <Text style={styles.bakersPercentText}>{ing.bakersPercentage}%</Text>
                ) : null}
              </View>
            </View>
          ))}
        </View>

        {/* 7. Botão de Ação: Salvar como Nova Receita */}
        <View style={styles.bottomActions}>
          <TouchableOpacity
            style={styles.saveRecipeBtn}
            onPress={handleSaveAsNewRecipe}
            activeOpacity={0.8}
            disabled={saveAsNewRecipeMutation.isPending}
          >
            <Save size={18} color="#ffffff" />
            <Text style={styles.saveRecipeBtnText}>
              {saveAsNewRecipeMutation.isPending
                ? 'Salvando Ficha...'
                : 'Salvar como Nova Ficha Técnica'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* MODAL: SELECIONAR RECEITA DO CATÁLOGO */}
      <Modal
        visible={recipePickerModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setRecipePickerModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Selecionar Receita</Text>
                <Text style={styles.modalSubtitle}>Escolha a ficha técnica para escalonar</Text>
              </View>
              <TouchableOpacity
                onPress={() => setRecipePickerModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Busca */}
            <View style={styles.searchBar}>
              <Search size={18} color={colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar por nome ou categoria..."
                placeholderTextColor={colors.textMuted}
                value={recipeSearchQuery}
                onChangeText={setRecipeSearchQuery}
              />
            </View>

            <ScrollView style={styles.recipeList}>
              {filteredRecipes.length === 0 ? (
                <EmptyState
                  title="Nenhuma receita encontrada"
                  description="Cadastre receitas no módulo de Fichas Técnicas para escalonar."
                />
              ) : (
                filteredRecipes.map((r) => {
                  const isSelected = selectedRecipe?.id === r.id;
                  return (
                    <TouchableOpacity
                      key={r.id}
                      style={[styles.recipeListItem, isSelected && styles.recipeListItemActive]}
                      onPress={() => handleSelectRecipe(r)}
                      activeOpacity={0.7}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.recipeListTitle, isSelected && styles.recipeListTitleActive]}>
                          {r.name}
                        </Text>
                        <Text style={styles.recipeListSub}>
                          {r.category} • Rendimento: {r.yield} {r.yieldUnit}
                        </Text>
                      </View>

                      {isSelected ? (
                        <Check size={20} color={colors.primary} />
                      ) : (
                        <ChevronLeft
                          size={18}
                          color={colors.textMuted}
                          style={{ transform: [{ rotate: '180deg' }] }}
                        />
                      )}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  headerSubtitle: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  headerActionButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
  },
  recipeSelectCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  recipeSelectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  recipeIconBadge: {
    width: 38,
    height: 38,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipeSelectLabel: {
    fontSize: typography.sizes.xs - 1,
    color: colors.textSecondary,
  },
  recipeSelectName: {
    fontSize: typography.sizes.md,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  changeRecipeBtn: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  changeRecipeBtnText: {
    fontSize: typography.sizes.xs,
    fontWeight: '700',
    color: colors.primary,
  },
  recipeMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.surface,
    flexWrap: 'wrap',
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.surface,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  metaBadgeText: {
    fontSize: typography.sizes.xs - 1,
    color: colors.textSecondary,
  },
  metaBadgeBold: {
    fontWeight: '700',
    color: colors.primaryDark,
  },
  modeTabs: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: 3,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    gap: 4,
  },
  modeTabActive: {
    backgroundColor: colors.cardBackground,
  },
  modeTabText: {
    fontSize: typography.sizes.xs - 1,
    fontWeight: '600',
    color: colors.textMuted,
  },
  modeTabTextActive: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
  controlsCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  controlTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: '700',
    color: colors.primaryDark,
    marginBottom: 2,
  },
  controlSubtitle: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  presetButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  presetBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  presetBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  presetBtnText: {
    fontSize: typography.sizes.xs,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  presetBtnTextActive: {
    color: '#ffffff',
  },
  customYieldRow: {
    marginTop: spacing.xs,
  },
  inputLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  yieldTextInput: {
    flex: 1,
    paddingVertical: spacing.sm,
    fontSize: typography.sizes.md,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  yieldUnitSuffix: {
    fontSize: typography.sizes.xs,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  subHeaderLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: '700',
    color: colors.primaryDark,
    marginBottom: 4,
  },
  panPresetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  panChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  panChipActive: {
    backgroundColor: '#fff6e9',
    borderColor: colors.caramel,
  },
  panChipActiveTarget: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  panChipText: {
    fontSize: typography.sizes.xs - 1,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  panChipTextActive: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
  panChipTextActiveTarget: {
    color: '#ffffff',
    fontWeight: '700',
  },
  flourTipBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  flourTipText: {
    fontSize: typography.sizes.xs - 1,
    color: colors.textSecondary,
    flex: 1,
  },
  factorHighlightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  factorCol: {
    flex: 1,
    alignItems: 'center',
  },
  factorDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border,
  },
  factorLabel: {
    fontSize: typography.sizes.xs - 1,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  factorValue: {
    fontSize: typography.sizes.xl,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  factorPercent: {
    fontSize: typography.sizes.xs - 2,
    fontWeight: '700',
    color: colors.caramel,
    marginTop: 2,
  },
  factorSub: {
    fontSize: typography.sizes.xs - 2,
    color: colors.textMuted,
    marginTop: 2,
  },
  ingredientsCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  ingredientsCardHeader: {
    marginBottom: spacing.sm,
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface,
  },
  ingredientsCardTitle: {
    fontSize: typography.sizes.md,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  ingredientsCardSubtitle: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface,
  },
  ingNameCol: {
    flex: 1,
  },
  ingTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  ingName: {
    fontSize: typography.sizes.sm,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  flourTag: {
    backgroundColor: '#fff6e9',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: colors.goldenBeige,
  },
  flourTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.primary,
  },
  ingOrigQty: {
    fontSize: typography.sizes.xs - 1,
    color: colors.textMuted,
    marginTop: 2,
  },
  ingScaledCol: {
    alignItems: 'flex-end',
  },
  ingScaledQty: {
    fontSize: typography.sizes.md,
    fontWeight: '800',
    color: colors.primary,
  },
  ingScaledUnit: {
    fontSize: typography.sizes.xs,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  bakersPercentText: {
    fontSize: typography.sizes.xs - 1,
    fontWeight: '700',
    color: colors.caramel,
    marginTop: 2,
  },
  bottomActions: {
    marginTop: spacing.xs,
  },
  saveRecipeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  saveRecipeBtnText: {
    color: '#ffffff',
    fontSize: typography.sizes.sm,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(51, 34, 10, 0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.cardBackground,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '80%',
    padding: spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  modalSubtitle: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
  modalCloseBtn: {
    padding: spacing.xs,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.text,
  },
  recipeList: {
    maxHeight: 350,
  },
  recipeListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface,
  },
  recipeListItemActive: {
    backgroundColor: '#fff6e9',
  },
  recipeListTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  recipeListTitleActive: {
    color: colors.primary,
  },
  recipeListSub: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
