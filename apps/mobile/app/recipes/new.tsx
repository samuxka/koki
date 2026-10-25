import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Check,
  Boxes,
  X,
  Sparkles,
  Calculator,
  ChevronDown,
} from 'lucide-react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../src/services/api';
import { InventoryItem, RecipeIngredient } from '@koki/types';
import { colors, borderRadius, spacing } from '../../src/theme';
import { formatCurrency } from '../../src/utils/formatters';
import {
  getCostPerGramCents,
  formatCostPerUnit,
  formatRateDescription,
  findMatchingInventoryItem,
} from '../../src/utils/recipeCost';
import { Input, CurrencyInput, Button, Badge } from '../../src/components/ui';
import { PlansModal } from '../../src/components/PlansModal';

const PRESET_CATEGORIES = [
  'Massas & Bolos',
  'Recheios & Cremes',
  'Coberturas',
  'Docinhos & Trufas',
  'Tortas & Sobremesas',
  'Panificação & Folhados',
  'Outro',
];

const PRESET_YIELD_UNITS = [
  'unidades',
  'fatias',
  'porções',
  'bolos',
  'kg',
  'g',
];

const PRESET_ING_UNITS = ['g', 'ml', 'unidade', 'kg', 'l'];

export default function NewRecipeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  // Basic Info
  const [name, setName] = useState('');
  const [category, setCategory] = useState(PRESET_CATEGORIES[0]);
  const [customCategory, setCustomCategory] = useState('');
  const [description, setDescription] = useState('');
  const [yieldAmountStr, setYieldAmountStr] = useState('1');
  const [yieldUnit, setYieldUnit] = useState('unidades');

  // Times & Oven
  const [prepTimeStr, setPrepTimeStr] = useState('');
  const [bakeTimeStr, setBakeTimeStr] = useState('');
  const [ovenTempStr, setOvenTempStr] = useState('');

  // Ingredients List
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);

  // Add Ingredient Modal / Sheet State
  const [ingModalVisible, setIngModalVisible] = useState(false);
  const [editingIngIndex, setEditingIngIndex] = useState<number | null>(null);
  const [ingName, setIngName] = useState('');
  const [ingQtyStr, setIngQtyStr] = useState('');
  const [ingUnit, setIngUnit] = useState('g');
  const [ingUnitCostCents, setIngUnitCostCents] = useState(0);
  const [manualBulkCostCents, setManualBulkCostCents] = useState(0);
  const [ingIsFlour, setIngIsFlour] = useState(false);
  const [ingInventoryId, setIngInventoryId] = useState<string | undefined>();
  const [stockPickerVisible, setStockPickerVisible] = useState(false);

  // Additional Costs
  const [packagingCostCents, setPackagingCostCents] = useState(0);
  const [laborCostCents, setLaborCostCents] = useState(0);
  const [overheadCostCents, setOverheadCostCents] = useState(0);
  const [suggestedSalePriceCents, setSuggestedSalePriceCents] = useState(0);

  // Instructions & Notes
  const [instructions, setInstructions] = useState<string[]>(['']);
  const [notes, setNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [plansModalVisible, setPlansModalVisible] = useState(false);

  // Fetch Inventory items for quick linking
  const { data: inventoryData } = useQuery<{ items: InventoryItem[] }>({
    queryKey: ['inventory-items-picker'],
    queryFn: () => api.get<{ items: InventoryItem[] }>('/inventory?limit=100'),
  });
  const inventoryItems = inventoryData?.items || [];

  // Calculations
  const yieldAmount = parseFloat(yieldAmountStr.replace(',', '.')) || 1;
  const ingredientsCostCents = ingredients.reduce((sum, item) => sum + (item.costCents || 0), 0);
  const totalCostCents =
    ingredientsCostCents + packagingCostCents + laborCostCents + overheadCostCents;
  const costPerUnitCents = yieldAmount > 0 ? Math.round(totalCostCents / yieldAmount) : totalCostCents;

  const handleOpenAddIngredient = () => {
    setEditingIngIndex(null);
    setIngName('');
    setIngQtyStr('');
    setIngUnit('g');
    setIngUnitCostCents(0);
    setManualBulkCostCents(0);
    setIngIsFlour(false);
    setIngInventoryId(undefined);
    setIngModalVisible(true);
  };

  const handleEditIngredient = (ing: RecipeIngredient, idx: number) => {
    setEditingIngIndex(idx);
    setIngName(ing.name);
    setIngQtyStr(ing.quantity ? ing.quantity.toString() : '');
    setIngUnit(ing.unit || 'g');
    setIngUnitCostCents(ing.unitCostCents || 0);
    if ((ing.unit === 'g' || ing.unit === 'ml') && ing.unitCostCents > 0) {
      setManualBulkCostCents(Math.round(ing.unitCostCents * 1000));
    } else {
      setManualBulkCostCents(Math.round(ing.unitCostCents || 0));
    }
    setIngIsFlour(!!ing.isFlour);
    setIngInventoryId(ing.inventoryItemId);
    setIngModalVisible(true);
  };

  const handleSelectInventoryItem = (item: InventoryItem) => {
    setIngInventoryId(item.id);
    setIngName(item.name);

    const defaultUnit =
      item.unit === 'kg' ? 'g' : item.unit === 'l' ? 'ml' : item.unit || 'g';
    setIngUnit(defaultUnit);

    const costPerUnit = getCostPerGramCents(item, defaultUnit);
    setIngUnitCostCents(costPerUnit);

    if (defaultUnit === 'g' || defaultUnit === 'ml') {
      setManualBulkCostCents(Math.round(costPerUnit * 1000));
    } else {
      setManualBulkCostCents(Math.round(costPerUnit));
    }

    const isFlour =
      item.name.toLowerCase().includes('farinha') ||
      (item.category && item.category.toLowerCase().includes('farinha'));
    setIngIsFlour(!!isFlour);

    setStockPickerVisible(false);
  };

  const handleNameChange = (text: string) => {
    setIngName(text);

    // Live exact-match check with inventory
    const matched = findMatchingInventoryItem(text, inventoryItems);
    if (matched) {
      setIngInventoryId(matched.id);
      const targetUnit =
        matched.unit === 'kg' ? 'g' : matched.unit === 'l' ? 'ml' : matched.unit || 'g';
      setIngUnit(targetUnit);
      const costPerUnit = getCostPerGramCents(matched, targetUnit);
      setIngUnitCostCents(costPerUnit);

      if (targetUnit === 'g' || targetUnit === 'ml') {
        setManualBulkCostCents(Math.round(costPerUnit * 1000));
      } else {
        setManualBulkCostCents(Math.round(costPerUnit));
      }

      const isFlour =
        matched.name.toLowerCase().includes('farinha') ||
        (matched.category && matched.category.toLowerCase().includes('farinha'));
      setIngIsFlour(!!isFlour);
    } else if (ingInventoryId) {
      const currentItem = inventoryItems.find((inv) => inv.id === ingInventoryId);
      if (currentItem && currentItem.name.trim().toLowerCase() !== text.trim().toLowerCase()) {
        setIngInventoryId(undefined);
      }
    }
  };

  const handleUnitChange = (newUnit: string) => {
    setIngUnit(newUnit);

    if (ingInventoryId) {
      const inv = inventoryItems.find((i) => i.id === ingInventoryId);
      if (inv) {
        const cost = getCostPerGramCents(inv, newUnit);
        setIngUnitCostCents(cost);
        if (newUnit === 'g' || newUnit === 'ml') {
          setManualBulkCostCents(Math.round(cost * 1000));
        } else {
          setManualBulkCostCents(Math.round(cost));
        }
      }
    } else {
      if ((newUnit === 'g' || newUnit === 'ml') && manualBulkCostCents > 0) {
        setIngUnitCostCents(manualBulkCostCents / 1000);
      }
    }
  };

  const handleManualBulkCostChange = (cents: number) => {
    setManualBulkCostCents(cents);
    if (ingUnit === 'g' || ingUnit === 'ml') {
      setIngUnitCostCents(cents / 1000);
    } else {
      setIngUnitCostCents(cents);
    }
  };

  const handleSaveIngredient = () => {
    if (!ingName.trim()) {
      Alert.alert('Nome obrigatório', 'Informe o nome do ingrediente.');
      return;
    }
    const qty = parseFloat(ingQtyStr.replace(',', '.')) || 0;
    if (qty <= 0) {
      Alert.alert('Quantidade inválida', 'Informe uma quantidade maior que zero.');
      return;
    }

    let finalInventoryId = ingInventoryId;
    let finalUnitCost = ingUnitCostCents;

    if (!finalInventoryId) {
      const matched = findMatchingInventoryItem(ingName, inventoryItems);
      if (matched) {
        finalInventoryId = matched.id;
        if (!finalUnitCost || finalUnitCost === 0) {
          finalUnitCost = getCostPerGramCents(matched, ingUnit);
        }
      }
    }

    const costCents = Math.round(qty * finalUnitCost);

    const newIng: RecipeIngredient = {
      id:
        editingIngIndex !== null && ingredients[editingIngIndex]?.id
          ? ingredients[editingIngIndex].id
          : Math.random().toString(36).substring(2, 9),
      inventoryItemId: finalInventoryId,
      name: ingName.trim(),
      quantity: qty,
      unit: ingUnit,
      unitCostCents: finalUnitCost,
      costCents,
      isFlour: ingIsFlour,
    };

    if (editingIngIndex !== null) {
      const updated = [...ingredients];
      updated[editingIngIndex] = newIng;
      setIngredients(updated);
    } else {
      setIngredients([...ingredients, newIng]);
    }

    setIngModalVisible(false);
  };

  const handleRemoveIngredient = (index: number) => {
    const updated = [...ingredients];
    updated.splice(index, 1);
    setIngredients(updated);
  };

  const handleAddInstructionStep = () => {
    setInstructions([...instructions, '']);
  };

  const handleUpdateInstructionStep = (text: string, index: number) => {
    const updated = [...instructions];
    updated[index] = text;
    setInstructions(updated);
  };

  const handleRemoveInstructionStep = (index: number) => {
    if (instructions.length === 1) {
      setInstructions(['']);
      return;
    }
    const updated = [...instructions];
    updated.splice(index, 1);
    setInstructions(updated);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert('Nome obrigatório', 'Informe o nome da receita.');
      return;
    }

    const finalCategory = customCategory.trim() || category;
    if (!finalCategory.trim()) {
      Alert.alert('Categoria obrigatória', 'Selecione uma categoria.');
      return;
    }

    if (ingredients.length === 0) {
      Alert.alert(
        'Ingredientes obrigatórios',
        'Adicione pelo menos um ingrediente à ficha técnica.',
      );
      return;
    }

    const filteredInstructions = instructions.map((s) => s.trim()).filter(Boolean);

    setIsSubmitting(true);
    try {
      await api.post('/recipes', {
        name: name.trim(),
        category: finalCategory,
        description: description.trim() || undefined,
        yield: yieldAmount,
        yieldUnit,
        prepTimeMinutes: parseInt(prepTimeStr, 10) || undefined,
        bakeTimeMinutes: parseInt(bakeTimeStr, 10) || undefined,
        ovenTemperature: parseInt(ovenTempStr, 10) || undefined,
        ingredients: ingredients.map((i) => ({
          inventoryItemId: i.inventoryItemId,
          name: i.name,
          quantity: i.quantity,
          unit: i.unit,
          unitCostCents: i.unitCostCents,
          costCents: i.costCents,
          isFlour: i.isFlour,
        })),
        instructions: filteredInstructions,
        notes: notes.trim() || undefined,
        packagingCostCents: packagingCostCents || undefined,
        laborCostCents: laborCostCents || undefined,
        overheadCostCents: overheadCostCents || undefined,
        suggestedSalePriceCents: suggestedSalePriceCents || undefined,
      });

      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      queryClient.invalidateQueries({ queryKey: ['recipes-summary'] });
      queryClient.invalidateQueries({ queryKey: ['recipes-categories'] });

      Alert.alert('Sucesso', 'Ficha técnica cadastrada com sucesso!');
      router.back();
    } catch (err: any) {
      if (err.code === 'RECIPES_LIMIT_REACHED' || err.message?.includes('limite')) {
        setPlansModalVisible(true);
      } else {
        Alert.alert('Erro ao salvar', err.message || 'Não foi possível cadastrar a receita.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const matchingStockItems =
    ingName.trim().length >= 2 && !ingInventoryId
      ? inventoryItems
          .filter((inv) =>
            inv.name.toLowerCase().includes(ingName.trim().toLowerCase()),
          )
          .slice(0, 4)
      : [];

  const parsedQty = parseFloat(ingQtyStr.replace(',', '.')) || 0;
  const currentIngredientTotalCents = Math.round(parsedQty * ingUnitCostCents);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.container, { paddingTop: Math.max(insets.top, 20) + 8 }]}>
        {/* Top Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <ArrowLeft size={22} color={colors.primaryDark} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Nova Ficha Técnica</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Card 1: Identificação */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Identificação da Receita</Text>

            <View style={styles.inputGroup}>
              <Input
                label="Nome da Receita *"
                placeholder="Ex: Pão de Ló de Baunilha, Brigadeiro Tradicional..."
                value={name}
                onChangeText={setName}
              />
            </View>

            {/* Category Chips */}
            <Text style={styles.fieldLabel}>Categoria *</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryChips}
            >
              {PRESET_CATEGORIES.map((cat) => {
                const isSelected = category === cat && !customCategory;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.categoryChip, isSelected && styles.categoryChipActive]}
                    onPress={() => {
                      setCategory(cat);
                      setCustomCategory('');
                    }}
                  >
                    {isSelected && <Check size={14} color="#ffffff" style={{ marginRight: 4 }} />}
                    <Text
                      style={[
                        styles.categoryChipText,
                        isSelected && styles.categoryChipTextActive,
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={[styles.inputGroup, { marginTop: 10 }]}>
              <Input
                placeholder="Ou digite outra categoria personalizada..."
                value={customCategory}
                onChangeText={setCustomCategory}
              />
            </View>

            {/* Rendimento */}
            <View style={styles.rowInputs}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Input
                  label="Rendimento Numérico *"
                  placeholder="Ex: 1, 12, 24"
                  keyboardType="numeric"
                  value={yieldAmountStr}
                  onChangeText={setYieldAmountStr}
                />
              </View>

              <View style={{ flex: 1, marginLeft: 8 }}>
                <Input
                  label="Unidade de Rendimento *"
                  placeholder="fatias, bolos, unidades"
                  value={yieldUnit}
                  onChangeText={setYieldUnit}
                />
              </View>
            </View>

            {/* Tempos e Forno */}
            <View style={[styles.rowInputs, { marginTop: 12 }]}>
              <View style={{ flex: 1, marginRight: 6 }}>
                <Input
                  label="Preparo (min)"
                  placeholder="25"
                  keyboardType="numeric"
                  value={prepTimeStr}
                  onChangeText={setPrepTimeStr}
                />
              </View>

              <View style={{ flex: 1, marginHorizontal: 6 }}>
                <Input
                  label="Forno (min)"
                  placeholder="40"
                  keyboardType="numeric"
                  value={bakeTimeStr}
                  onChangeText={setBakeTimeStr}
                />
              </View>

              <View style={{ flex: 1, marginLeft: 6 }}>
                <Input
                  label="Temp (°C)"
                  placeholder="180"
                  keyboardType="numeric"
                  value={ovenTempStr}
                  onChangeText={setOvenTempStr}
                />
              </View>
            </View>
          </View>

          {/* Card 2: Ingredientes */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View>
                <Text style={styles.sectionTitle}>Ingredientes da Receita</Text>
                <Text style={styles.sectionSubtitle}>
                  {ingredients.length}{' '}
                  {ingredients.length === 1 ? 'item adicionado' : 'itens adicionados'}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.addIngBtn}
                activeOpacity={0.85}
                onPress={handleOpenAddIngredient}
              >
                <Plus size={16} color="#ffffff" strokeWidth={2.4} />
                <Text style={styles.addIngBtnText}>Adicionar</Text>
              </TouchableOpacity>
            </View>

            {ingredients.length === 0 ? (
              <View style={styles.emptyIngBox}>
                <Text style={styles.emptyIngText}>
                  Nenhum ingrediente adicionado ainda. Toque em "Adicionar" para buscar do estoque ou digitar avulso.
                </Text>
              </View>
            ) : (
              <View style={styles.ingList}>
                {ingredients.map((ing, idx) => (
                  <TouchableOpacity
                    key={ing.id || idx}
                    style={styles.ingRow}
                    activeOpacity={0.7}
                    onPress={() => handleEditIngredient(ing, idx)}
                  >
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Text style={styles.ingName}>{ing.name}</Text>
                        {ing.inventoryItemId ? (
                          <Badge label="Estoque" color={colors.primary} />
                        ) : null}
                        {ing.isFlour ? (
                          <Badge label="Farinha Base" color={colors.caramel} />
                        ) : null}
                      </View>
                      <Text style={styles.ingMeta}>
                        {ing.quantity} {ing.unit}
                        {ing.unitCostCents > 0
                          ? ` • ${formatCostPerUnit(ing.unitCostCents, ing.unit)}`
                          : ''}
                      </Text>
                    </View>

                    <Text style={styles.ingCost}>{formatCurrency(ing.costCents)}</Text>

                    <TouchableOpacity
                      style={styles.deleteIngBtn}
                      onPress={() => handleRemoveIngredient(idx)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Trash2 size={16} color={colors.danger} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))}

                <View style={styles.ingSubtotalRow}>
                  <Text style={styles.subtotalLabel}>Subtotal Insumos:</Text>
                  <Text style={styles.subtotalValue}>{formatCurrency(ingredientsCostCents)}</Text>
                </View>
              </View>
            )}
          </View>

          {/* Card 3: Custos & Precificação */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Custos Adicionais & Margem</Text>

            <View style={styles.rowInputs}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <CurrencyInput
                  label="Embalagem (€)"
                  cents={packagingCostCents}
                  onChangeCents={setPackagingCostCents}
                />
              </View>

              <View style={{ flex: 1, marginLeft: 8 }}>
                <CurrencyInput
                  label="Mão de Obra (€)"
                  cents={laborCostCents}
                  onChangeCents={setLaborCostCents}
                />
              </View>
            </View>

            <View style={[styles.inputGroup, { marginTop: 10 }]}>
              <CurrencyInput
                label="Custos Fixos / Gás / Energia (€)"
                cents={overheadCostCents}
                onChangeCents={setOverheadCostCents}
              />
            </View>

            {/* Total Cost Result Banner */}
            <View style={styles.costSummaryBanner}>
              <View style={styles.costSummaryCol}>
                <Text style={styles.costSummaryLabel}>Custo Total</Text>
                <Text style={styles.costSummaryValue}>{formatCurrency(totalCostCents)}</Text>
              </View>
              <View style={styles.costSummaryDivider} />
              <View style={styles.costSummaryCol}>
                <Text style={styles.costSummaryLabel}>Custo por {yieldUnit || 'porção'}</Text>
                <Text style={styles.costSummaryValue}>{formatCurrency(costPerUnitCents)}</Text>
              </View>
            </View>

            <View style={[styles.inputGroup, { marginTop: 14 }]}>
              <CurrencyInput
                label="Preço de Venda Sugerido (€) (opcional)"
                cents={suggestedSalePriceCents}
                onChangeCents={setSuggestedSalePriceCents}
              />
            </View>
          </View>

          {/* Card 4: Modo de Preparo */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View>
                <Text style={styles.sectionTitle}>Modo de Preparo</Text>
                <Text style={styles.sectionSubtitle}>Passo a passo para a bancada</Text>
              </View>

              <TouchableOpacity
                style={styles.addStepBtn}
                activeOpacity={0.8}
                onPress={handleAddInstructionStep}
              >
                <Plus size={14} color={colors.primary} />
                <Text style={styles.addStepBtnText}>Passo</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.stepsList}>
              {instructions.map((step, idx) => (
                <View key={idx} style={styles.stepRow}>
                  <View style={styles.stepNumberBadge}>
                    <Text style={styles.stepNumberText}>{idx + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Input
                      placeholder={`Passo ${idx + 1}: ex: Peneire a farinha e bata a manteiga com o açúcar...`}
                      value={step}
                      onChangeText={(t) => handleUpdateInstructionStep(t, idx)}
                    />
                  </View>
                  {instructions.length > 1 && (
                    <TouchableOpacity
                      style={styles.deleteStepBtn}
                      onPress={() => handleRemoveInstructionStep(idx)}
                    >
                      <Trash2 size={16} color={colors.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          </View>

          {/* Card 5: Dicas & Observações */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Notas & Dicas da Confeiteira</Text>
            <View style={styles.inputGroup}>
              <Input
                placeholder="Ex: Pode congelar a massa por até 60 dias. Ponto de calda a 118°C..."
                value={notes}
                onChangeText={setNotes}
              />
            </View>
          </View>

          {/* Submit Button */}
          <View style={styles.submitContainer}>
            <Button
              title="Salvar Ficha Técnica"
              variant="primary"
              size="lg"
              onPress={handleSubmit}
              loading={isSubmitting}
            />
          </View>
        </ScrollView>

        {/* Modal: Adicionar / Editar Ingrediente */}
        <Modal visible={ingModalVisible} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {editingIngIndex !== null ? 'Editar Ingrediente' : 'Adicionar Ingrediente'}
                </Text>
                <TouchableOpacity onPress={() => setIngModalVisible(false)}>
                  <X size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 520 }}>
                {/* Botão Escolher do Estoque */}
                <TouchableOpacity
                  style={styles.pickStockBtn}
                  activeOpacity={0.8}
                  onPress={() => setStockPickerVisible(true)}
                >
                  <Boxes size={18} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pickStockTitle}>Puxar do Estoque de Insumos</Text>
                    <Text style={styles.pickStockSub}>
                      {ingInventoryId
                        ? 'Insumo vinculado com custo automático'
                        : 'Preenche nome, unidade e custo cadastrado'}
                    </Text>
                  </View>
                  <ChevronDown size={18} color={colors.textSecondary} />
                </TouchableOpacity>

                <View style={styles.inputGroup}>
                  <Input
                    label="Nome do Ingrediente *"
                    placeholder="Ex: Chocolate 54%, Açúcar, Farinha..."
                    value={ingName}
                    onChangeText={handleNameChange}
                  />
                </View>

                {/* Autocomplete suggestions from inventory */}
                {matchingStockItems.length > 0 && !ingInventoryId && (
                  <View style={styles.suggestionsContainer}>
                    <Text style={styles.suggestionsTitle}>Encontrados no estoque:</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.suggestionsScroll}
                    >
                      {matchingStockItems.map((item) => {
                        const targetUnit =
                          item.unit === 'kg' ? 'g' : item.unit === 'l' ? 'ml' : item.unit || 'g';
                        const costG = getCostPerGramCents(item, targetUnit);
                        return (
                          <TouchableOpacity
                            key={item.id}
                            style={styles.suggestionChip}
                            onPress={() => handleSelectInventoryItem(item)}
                            activeOpacity={0.7}
                          >
                            <Boxes size={13} color={colors.primary} />
                            <Text style={styles.suggestionText}>{item.name}</Text>
                            <Text style={styles.suggestionPrice}>
                              {formatCostPerUnit(costG, targetUnit)}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}

                <View style={styles.rowInputs}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Input
                      label="Quantidade *"
                      placeholder="Ex: 250"
                      keyboardType="numeric"
                      value={ingQtyStr}
                      onChangeText={setIngQtyStr}
                    />
                  </View>

                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Input
                      label="Unidade *"
                      placeholder="g, ml, un"
                      value={ingUnit}
                      onChangeText={handleUnitChange}
                    />
                  </View>
                </View>

                {/* Quick Unit Selector */}
                <View style={styles.unitChipsRow}>
                  {PRESET_ING_UNITS.map((u) => {
                    const isSelected = ingUnit === u;
                    return (
                      <TouchableOpacity
                        key={u}
                        style={[styles.unitChip, isSelected && styles.unitChipActive]}
                        onPress={() => handleUnitChange(u)}
                      >
                        <Text
                          style={[styles.unitChipText, isSelected && styles.unitChipTextActive]}
                        >
                          {u}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Custo do Ingrediente */}
                {ingInventoryId ? (
                  <View style={styles.stockLinkedBox}>
                    <View style={styles.stockLinkedTop}>
                      <View style={styles.stockLinkedBadge}>
                        <Boxes size={14} color="#ffffff" />
                        <Text style={styles.stockLinkedBadgeText}>Estoque Vinculado</Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => setIngInventoryId(undefined)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={styles.unlinkText}>Editar avulso</Text>
                      </TouchableOpacity>
                    </View>

                    <Text style={styles.stockLinkedCostValue}>
                      {formatRateDescription(ingUnitCostCents, ingUnit)}
                    </Text>
                    <Text style={styles.stockLinkedHint}>
                      Valor por {ingUnit} adicionado automaticamente do seu estoque de insumos.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.manualCostBox}>
                    {ingUnit === 'g' || ingUnit === 'ml' ? (
                      <>
                        <CurrencyInput
                          label={`Preço de Referência (€ por ${ingUnit === 'g' ? 'kg' : 'litro'})`}
                          cents={manualBulkCostCents}
                          onChangeCents={handleManualBulkCostChange}
                        />
                        <View style={styles.calculatedPerGramRow}>
                          <Text style={styles.calculatedPerGramLabel}>
                            Valor automático por {ingUnit}:
                          </Text>
                          <Text style={styles.calculatedPerGramValue}>
                            {formatCostPerUnit(ingUnitCostCents, ingUnit)}
                          </Text>
                        </View>
                      </>
                    ) : (
                      <CurrencyInput
                        label={`Custo Unitário (€ por ${ingUnit})`}
                        cents={ingUnitCostCents}
                        onChangeCents={setIngUnitCostCents}
                      />
                    )}
                  </View>
                )}

                {/* Live Subtotal Preview */}
                {parsedQty > 0 && (
                  <View style={styles.ingSubtotalPreview}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.subtotalPreviewTitle}>Subtotal do ingrediente:</Text>
                      <Text style={styles.subtotalPreviewSub}>
                        {parsedQty} {ingUnit} × {formatCostPerUnit(ingUnitCostCents, ingUnit)}
                      </Text>
                    </View>
                    <Text style={styles.subtotalPreviewCost}>
                      {formatCurrency(currentIngredientTotalCents)}
                    </Text>
                  </View>
                )}

                {/* Toggle Farinha Base */}
                <TouchableOpacity
                  style={styles.flourToggleRow}
                  activeOpacity={0.8}
                  onPress={() => setIngIsFlour(!ingIsFlour)}
                >
                  <View style={[styles.checkbox, ingIsFlour && styles.checkboxActive]}>
                    {ingIsFlour && <Check size={14} color="#ffffff" />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.flourToggleText}>É a farinha base da receita</Text>
                    <Text style={styles.flourToggleSub}>
                      Usada para o cálculo de 100% no Baker's Percentage
                    </Text>
                  </View>
                </TouchableOpacity>

                <View style={{ marginTop: 20, marginBottom: 12 }}>
                  <Button
                    title={editingIngIndex !== null ? 'Salvar Alterações' : 'Incluir na Receita'}
                    variant="primary"
                    onPress={handleSaveIngredient}
                  />
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Modal: Picker de Insumos do Estoque */}
        <Modal visible={stockPickerVisible} transparent animationType="fade">
          <View style={styles.pickerOverlay}>
            <View style={styles.pickerCard}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>Selecione um Insumo do Estoque</Text>
                <TouchableOpacity onPress={() => setStockPickerVisible(false)}>
                  <X size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <FlatList
                data={inventoryItems}
                keyExtractor={(item) => item.id}
                style={{ maxHeight: 380 }}
                renderItem={({ item }) => {
                  const defaultUnit =
                    item.unit === 'kg' ? 'g' : item.unit === 'l' ? 'ml' : item.unit || 'g';
                  const costPerGram = getCostPerGramCents(item, defaultUnit);
                  return (
                    <TouchableOpacity
                      style={styles.pickerItem}
                      activeOpacity={0.7}
                      onPress={() => handleSelectInventoryItem(item)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.pickerItemName}>{item.name}</Text>
                        <Text style={styles.pickerItemSub}>
                          {item.category} • {formatRateDescription(costPerGram, defaultUnit)}
                        </Text>
                      </View>
                      <Badge label={item.unit} color={colors.primary} />
                    </TouchableOpacity>
                  );
                }}
              />
            </View>
          </View>
        </Modal>

        {/* Upgrade Plans Modal */}
        <PlansModal
          visible={plansModalVisible}
          onClose={() => setPlansModalVisible(false)}
        />
      </View>
    </KeyboardAvoidingView>
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
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 14,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: 16,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  inputGroup: {
    marginTop: 10,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
    marginTop: 10,
  },
  rowInputs: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryChips: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryChipText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  categoryChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  addIngBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: borderRadius.md,
  },
  addIngBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  emptyIngBox: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: 16,
    alignItems: 'center',
  },
  emptyIngText: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  ingList: {
    gap: 10,
  },
  ingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface,
  },
  ingName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  ingMeta: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  ingCost: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primaryDark,
    marginRight: 10,
  },
  deleteIngBtn: {
    padding: 6,
  },
  ingSubtotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  subtotalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  subtotalValue: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  costSummaryBanner: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginTop: 14,
  },
  costSummaryCol: {
    flex: 1,
    alignItems: 'center',
  },
  costSummaryDivider: {
    width: 1,
    backgroundColor: colors.border,
  },
  costSummaryLabel: {
    fontSize: 11,
    color: colors.textMuted,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  costSummaryValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primaryDark,
    marginTop: 4,
  },
  addStepBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fff6e9',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#edd5b8',
  },
  addStepBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  stepsList: {
    gap: 10,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepNumberBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  deleteStepBtn: {
    padding: 6,
  },
  submitContainer: {
    marginTop: 8,
    marginBottom: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(35, 18, 5, 0.65)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  pickStockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff6e9',
    borderWidth: 1.5,
    borderColor: '#edd5b8',
    padding: 12,
    borderRadius: borderRadius.md,
    marginBottom: 14,
  },
  pickStockTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  pickStockSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  flourToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    padding: 10,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  checkboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  flourToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primaryDark,
  },
  flourToggleSub: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(35, 18, 5, 0.65)',
    justifyContent: 'center',
    padding: 24,
  },
  pickerCard: {
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.lg,
    padding: 18,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface,
  },
  pickerItemName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  pickerItemSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  suggestionsContainer: {
    marginTop: 6,
    marginBottom: 8,
  },
  suggestionsTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  suggestionsScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff6e9',
    borderWidth: 1,
    borderColor: '#edd5b8',
    borderRadius: borderRadius.full,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  suggestionText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  suggestionPrice: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.caramel,
  },
  unitChipsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
    marginBottom: 6,
  },
  unitChip: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  unitChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  unitChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  unitChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  stockLinkedBox: {
    backgroundColor: '#fff6e9',
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: '#edd5b8',
    padding: 12,
    marginTop: 10,
  },
  stockLinkedTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  stockLinkedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: borderRadius.full,
  },
  stockLinkedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  unlinkText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
  stockLinkedCostValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primaryDark,
    marginTop: 2,
  },
  stockLinkedHint: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 4,
    lineHeight: 15,
  },
  manualCostBox: {
    marginTop: 10,
  },
  calculatedPerGramRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    padding: 10,
    borderRadius: borderRadius.md,
    marginTop: 4,
  },
  calculatedPerGramLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  calculatedPerGramValue: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  ingSubtotalPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#faf5ee',
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    borderRadius: borderRadius.md,
    marginTop: 10,
  },
  subtotalPreviewTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  subtotalPreviewSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  subtotalPreviewCost: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primaryDark,
  },
});
