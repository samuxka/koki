import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Switch,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing, typography, borderRadius } from '../../src/theme';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';
import { CurrencyInput } from '../../src/components/ui/CurrencyInput';
import { api } from '../../src/services/api';
import { useAuthStore } from '../../src/stores/auth.store';
import { formatCurrency } from '../../src/utils/formatters';
import {
  ArrowLeft,
  Camera,
  Image as ImageIcon,
  Package,
  Plus,
  Trash2,
  TrendingUp,
  Tag,
  DollarSign,
  Target,
  Sparkles,
  Info,
  Check,
  X,
  Layers,
  ShoppingBag,
} from 'lucide-react-native';

const CATEGORY_SUGGESTIONS = [
  'Bolos & Tortas',
  'Doces Finos',
  'Brigadeiros',
  'Pães & Salgados',
  'Sobremesas',
  'Cookies',
  'Bebidas & Cafés',
  'Kits Festa',
];

const UNIT_SUGGESTIONS = ['unidade', 'cento', 'kg', 'fatia', 'porção', 'caixa'];

const FLAVOR_SUGGESTIONS = [
  'Chocolate Belga',
  'Ninho c/ Nutella',
  'Morango Fresco',
  'Red Velvet',
  'Cenoura c/ Brigadeiro',
  'Maracujá',
  'Pistache',
  'Doce de Leite',
  'Baunilha',
];

interface IngredientItem {
  id: string;
  name: string;
  costCents: number;
}

interface ComplementItem {
  id: string;
  name: string;
  priceCents: number;
}

export default function NewProductScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { company } = useAuthStore();
  const currency = company?.currency || 'EUR';

  // Basic Information
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Bolos & Tortas');
  const [unit, setUnit] = useState('unidade');
  const [priceCents, setPriceCents] = useState(0);
  const [photoUrl, setPhotoUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [isAvailable, setIsAvailable] = useState(true);

  // Sales Goal (optional)
  const [monthlySalesGoalUnits, setMonthlySalesGoalUnits] = useState('');

  // Cost & Ingredients (optional)
  const [manualCostCents, setManualCostCents] = useState(0);
  const [ingredients, setIngredients] = useState<IngredientItem[]>([]);
  const [ingredientNameInput, setIngredientNameInput] = useState('');
  const [ingredientCostInput, setIngredientCostInput] = useState(0);

  // Flavors (optional)
  const [flavors, setFlavors] = useState<string[]>([]);
  const [flavorInput, setFlavorInput] = useState('');

  // Complements (optional)
  const [complements, setComplements] = useState<ComplementItem[]>([]);
  const [complementNameInput, setComplementNameInput] = useState('');
  const [complementPriceInput, setComplementPriceInput] = useState(0);

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Auto-calculated total cost
  const totalCostCents = useMemo(() => {
    if (ingredients.length > 0) {
      return ingredients.reduce((sum, item) => sum + item.costCents, 0);
    }
    return manualCostCents;
  }, [ingredients, manualCostCents]);

  // Auto-calculated profit and margin
  const profitCents = Math.max(0, priceCents - totalCostCents);
  const marginPercent =
    priceCents > 0 && totalCostCents > 0
      ? Math.round(((priceCents - totalCostCents) / priceCents) * 100)
      : null;

  // Monthly revenue projected from goal
  const goalUnits = parseInt(monthlySalesGoalUnits, 10) || 0;
  const projectedMonthlyRevenueCents = goalUnits * priceCents;

  const createMutation = useMutation({
    mutationFn: (body: any) => api.post('/products', body),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      Alert.alert('Sucesso', 'Produto cadastrado com sucesso!');
      if (res?.id) {
        router.replace(`/products/${res.id}` as any);
      } else {
        router.back();
      }
    },
    onError: (err: any) => {
      Alert.alert('Erro ao salvar', err.message || 'Não foi possível cadastrar o produto.');
    },
  });

  const handlePickFromGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.35,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const uri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        setPhotoUrl(uri);
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível abrir a galeria.');
    }
  };

  const handleTakePhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permissão necessária', 'Permita o acesso à câmera para tirar fotos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.35,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const uri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        setPhotoUrl(uri);
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível abrir a câmera.');
    }
  };

  // Ingredient Helpers
  const handleAddIngredient = () => {
    if (!ingredientNameInput.trim()) {
      Alert.alert('Atenção', 'Informe o nome do ingrediente.');
      return;
    }
    if (ingredientCostInput <= 0) {
      Alert.alert('Atenção', 'Informe o custo do ingrediente.');
      return;
    }

    const newItem: IngredientItem = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: ingredientNameInput.trim(),
      costCents: ingredientCostInput,
    };

    setIngredients([...ingredients, newItem]);
    setIngredientNameInput('');
    setIngredientCostInput(0);
  };

  const handleRemoveIngredient = (id: string) => {
    setIngredients(ingredients.filter((item) => item.id !== id));
  };

  // Flavor Helpers
  const handleAddFlavor = (nameToAdd?: string) => {
    const text = (nameToAdd || flavorInput).trim();
    if (!text) return;
    if (flavors.includes(text)) {
      Alert.alert('Atenção', 'Este sabor já foi adicionado.');
      return;
    }
    setFlavors([...flavors, text]);
    setFlavorInput('');
  };

  const handleRemoveFlavor = (flavorToRemove: string) => {
    setFlavors(flavors.filter((f) => f !== flavorToRemove));
  };

  // Complement Helpers
  const handleAddComplement = () => {
    if (!complementNameInput.trim()) {
      Alert.alert('Atenção', 'Informe o nome do complemento ou adicional.');
      return;
    }

    const newItem: ComplementItem = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: complementNameInput.trim(),
      priceCents: complementPriceInput,
    };

    setComplements([...complements, newItem]);
    setComplementNameInput('');
    setComplementPriceInput(0);
  };

  const handleRemoveComplement = (id: string) => {
    setComplements(complements.filter((item) => item.id !== id));
  };

  const handleSave = () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) {
      newErrors.name = 'Nome do produto é obrigatório';
    }
    if (!priceCents || priceCents <= 0) {
      newErrors.price = 'Informe um preço de venda válido maior que zero';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      Alert.alert('Campos obrigatórios', 'Por favor, preencha o nome e o preço de venda do produto.');
      return;
    }

    setErrors({});

    const payload: any = {
      name: name.trim(),
      category: category.trim() || 'Geral',
      unit: unit.trim() || 'unidade',
      priceCents,
      costCents: totalCostCents > 0 ? totalCostCents : undefined,
      imageUrl: photoUrl.trim() || undefined,
      notes: notes.trim() || undefined,
      isAvailable,
      ingredients: ingredients.length > 0
        ? ingredients.map((i) => ({ name: i.name, costCents: i.costCents }))
        : undefined,
      flavors: flavors.length > 0 ? flavors : undefined,
      complements: complements.length > 0
        ? complements.map((c) => ({ name: c.name, additionalPriceCents: c.priceCents }))
        : undefined,
    };

    createMutation.mutate(payload);
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container}>
        {/* Header with Safe Area */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) + 8 }]}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <ArrowLeft size={22} color={colors.primaryDark} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Novo Produto</Text>
          <View style={{ width: 38 }} />
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, 20) + 90 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Photo Picker Card */}
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Foto do Produto</Text>
            <View style={styles.photoContainer}>
              {photoUrl ? (
                <View style={styles.photoWrapper}>
                  <Image source={{ uri: photoUrl }} style={styles.productPhoto} />
                  <TouchableOpacity
                    style={styles.removePhotoButton}
                    onPress={() => setPhotoUrl('')}
                    activeOpacity={0.7}
                  >
                    <Trash2 size={16} color="#ffffff" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Package size={40} color={colors.caramel} />
                  <Text style={styles.photoHint}>Adicione uma foto apetitosa</Text>
                </View>
              )}

              <View style={styles.photoButtonsRow}>
                <TouchableOpacity
                  style={styles.photoActionBtn}
                  onPress={handleTakePhoto}
                  activeOpacity={0.7}
                >
                  <Camera size={18} color={colors.primaryDark} />
                  <Text style={styles.photoActionText}>Câmera</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.photoActionBtn}
                  onPress={handlePickFromGallery}
                  activeOpacity={0.7}
                >
                  <ImageIcon size={18} color={colors.primaryDark} />
                  <Text style={styles.photoActionText}>Galeria</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Card>

          {/* Basic Info Card */}
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Dados Principais</Text>

            <Input
              label="Nome do Produto *"
              placeholder="Ex: Bolo Vulcão de Cenoura c/ Brigadeiro"
              value={name}
              onChangeText={(text) => {
                setName(text);
                if (errors.name) setErrors({ ...errors, name: '' });
              }}
              error={errors.name}
            />

            {/* Category selection */}
            <Text style={styles.fieldLabel}>Categoria *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Digite ou escolha uma categoria abaixo"
              placeholderTextColor={colors.textMuted}
              value={category}
              onChangeText={setCategory}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.suggestionRow}
            >
              {CATEGORY_SUGGESTIONS.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.suggestionChip,
                    category === cat && styles.suggestionChipActive,
                  ]}
                  onPress={() => setCategory(cat)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.suggestionChipText,
                      category === cat && styles.suggestionChipTextActive,
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Unit selection */}
            <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>Unidade de Venda</Text>
            <View style={styles.unitRow}>
              {UNIT_SUGGESTIONS.map((u) => (
                <TouchableOpacity
                  key={u}
                  style={[styles.unitChip, unit === u && styles.unitChipActive]}
                  onPress={() => setUnit(u)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.unitChipText, unit === u && styles.unitChipTextActive]}>
                    {u}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Price of Sale */}
            <View style={{ marginTop: spacing.md }}>
              <CurrencyInput
                label="Preço de Venda *"
                cents={priceCents}
                onChangeCents={(val) => {
                  setPriceCents(val);
                  if (errors.price) setErrors({ ...errors, price: '' });
                }}
                currency={currency}
                error={errors.price}
              />
            </View>

            {/* Status Switch */}
            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchTitle}>Disponível para venda</Text>
                <Text style={styles.switchSubtitle}>
                  {isAvailable ? 'Item visível e ativo no cardápio' : 'Item pausado / esgotado'}
                </Text>
              </View>
              <Switch
                value={isAvailable}
                onValueChange={setIsAvailable}
                trackColor={{ false: '#e2d9cf', true: `${colors.primary}66` }}
                thumbColor={isAvailable ? colors.primary : '#9e8c7c'}
              />
            </View>
          </Card>

          {/* Cost & Profit Margin Calculator Card */}
          <Card style={[styles.sectionCard, styles.calculatorCard]}>
            <View style={styles.calcHeader}>
              <View style={styles.calcTitleWrapper}>
                <TrendingUp size={20} color={colors.primary} />
                <Text style={styles.sectionTitle}>Custos & Margem de Lucro</Text>
              </View>
              {marginPercent !== null && (
                <View
                  style={[
                    styles.marginResultBadge,
                    marginPercent >= 50
                      ? styles.marginBadgeHigh
                      : marginPercent >= 20
                      ? styles.marginBadgeMedium
                      : styles.marginBadgeLow,
                  ]}
                >
                  <Text
                    style={[
                      styles.marginResultText,
                      {
                        color:
                          marginPercent >= 50
                            ? colors.success
                            : marginPercent >= 20
                            ? colors.warning
                            : colors.danger,
                      },
                    ]}
                  >
                    {marginPercent}% margem
                  </Text>
                </View>
              )}
            </View>

            <Text style={styles.calcExplanation}>
              Adicione os ingredientes usados e o valor gasto. O Koki soma o custo total e calcula
              seu lucro real e margem percentual automaticamente!
            </Text>

            {/* Live Profit Snapshot Bar */}
            <View style={styles.profitSnapshot}>
              <View style={styles.snapshotItem}>
                <Text style={styles.snapshotLabel}>Preço Venda</Text>
                <Text style={styles.snapshotValue}>{formatCurrency(priceCents, currency)}</Text>
              </View>
              <Text style={styles.snapshotOperator}>-</Text>
              <View style={styles.snapshotItem}>
                <Text style={styles.snapshotLabel}>Custo Total</Text>
                <Text style={[styles.snapshotValue, { color: colors.danger }]}>
                  {formatCurrency(totalCostCents, currency)}
                </Text>
              </View>
              <Text style={styles.snapshotOperator}>=</Text>
              <View style={styles.snapshotItem}>
                <Text style={styles.snapshotLabel}>Lucro Líquido</Text>
                <Text style={[styles.snapshotValue, { color: colors.success }]}>
                  {formatCurrency(profitCents, currency)}
                </Text>
              </View>
            </View>

            {/* Dynamic Ingredient List */}
            {ingredients.length > 0 && (
              <View style={styles.ingredientListWrapper}>
                <Text style={styles.subListTitle}>Ingredientes Adicionados ({ingredients.length})</Text>
                {ingredients.map((ing) => (
                  <View key={ing.id} style={styles.ingredientRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.ingredientName}>{ing.name}</Text>
                    </View>
                    <Text style={styles.ingredientCost}>
                      {formatCurrency(ing.costCents, currency)}
                    </Text>
                    <TouchableOpacity
                      onPress={() => handleRemoveIngredient(ing.id)}
                      style={styles.removeIngBtn}
                    >
                      <Trash2 size={16} color={colors.danger} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* Add Ingredient Form Box */}
            <View style={styles.addIngredientBox}>
              <Text style={styles.addIngredientTitle}>+ Adicionar Ingrediente / Insumo</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Ex: 500g Leite Condensado Moça"
                placeholderTextColor={colors.textMuted}
                value={ingredientNameInput}
                onChangeText={setIngredientNameInput}
              />
              <CurrencyInput
                label="Valor gasto no ingrediente"
                cents={ingredientCostInput}
                onChangeCents={setIngredientCostInput}
                currency={currency}
                containerStyle={{ marginBottom: spacing.sm }}
              />
              <Button
                title="Adicionar à Receita"
                variant="outline"
                onPress={handleAddIngredient}
                style={styles.addIngSubmitBtn}
              />
            </View>

            {/* Or manual cost fallback if no ingredients */}
            {ingredients.length === 0 && (
              <View style={{ marginTop: spacing.md }}>
                <CurrencyInput
                  label="Ou informe o custo estimado total diretamente:"
                  cents={manualCostCents}
                  onChangeCents={setManualCostCents}
                  currency={currency}
                />
              </View>
            )}
          </Card>

          {/* Monthly Sales Goal Card */}
          <Card style={styles.sectionCard}>
            <View style={styles.cardTitleWithIcon}>
              <Target size={18} color={colors.caramel} />
              <Text style={styles.sectionTitle}>Meta de Vendas Mensal (Opcional)</Text>
            </View>
            <Text style={styles.fieldHint}>
              Defina quantas unidades deste produto você quer vender por mês para acompanhar seu
              progresso.
            </Text>

            <TextInput
              style={styles.textInput}
              placeholder="Ex: 50 unidades/mês"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              value={monthlySalesGoalUnits}
              onChangeText={(text) => setMonthlySalesGoalUnits(text.replace(/\D/g, ''))}
            />

            {goalUnits > 0 && priceCents > 0 && (
              <View style={styles.projectedRevenueBox}>
                <Sparkles size={16} color={colors.primary} />
                <Text style={styles.projectedRevenueText}>
                  Meta: {goalUnits} {unit}s ={' '}
                  <Text style={{ fontWeight: typography.weights.bold }}>
                    {formatCurrency(projectedMonthlyRevenueCents, currency)}
                  </Text>{' '}
                  em faturamento estimado
                </Text>
              </View>
            )}
          </Card>

          {/* Flavors Section Card */}
          <Card style={styles.sectionCard}>
            <View style={styles.cardTitleWithIcon}>
              <Sparkles size={18} color={colors.primary} />
              <Text style={styles.sectionTitle}>Sabores Disponíveis (Opcional)</Text>
            </View>
            <Text style={styles.fieldHint}>
              Sabores ou recheios que o cliente pode escolher para este produto.
            </Text>

            {/* Current Added Flavors */}
            {flavors.length > 0 && (
              <View style={styles.tagsContainer}>
                {flavors.map((flavor) => (
                  <View key={flavor} style={styles.flavorBadge}>
                    <Text style={styles.flavorBadgeText}>{flavor}</Text>
                    <TouchableOpacity
                      onPress={() => handleRemoveFlavor(flavor)}
                      style={styles.removeTagBtn}
                    >
                      <X size={14} color={colors.primaryDark} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* Add Flavor Input */}
            <View style={styles.tagInputRow}>
              <TextInput
                style={[styles.textInput, { flex: 1, marginBottom: 0 }]}
                placeholder="Adicionar novo sabor..."
                placeholderTextColor={colors.textMuted}
                value={flavorInput}
                onChangeText={setFlavorInput}
                onSubmitEditing={() => handleAddFlavor()}
                returnKeyType="done"
              />
              <TouchableOpacity
                style={styles.addTagButton}
                onPress={() => handleAddFlavor()}
                activeOpacity={0.7}
              >
                <Plus size={18} color="#ffffff" />
              </TouchableOpacity>
            </View>

            {/* Quick Flavor Suggestions */}
            <Text style={[styles.fieldLabel, { marginTop: spacing.md, fontSize: 11 }]}>
              Sugestões rápidas de confeitaria:
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.suggestionRow}
            >
              {FLAVOR_SUGGESTIONS.map((fs) => (
                <TouchableOpacity
                  key={fs}
                  style={styles.suggestionChip}
                  onPress={() => handleAddFlavor(fs)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.suggestionChipText}>+ {fs}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Card>

          {/* Complements / Add-ons Card */}
          <Card style={styles.sectionCard}>
            <View style={styles.cardTitleWithIcon}>
              <Layers size={18} color={colors.primary} />
              <Text style={styles.sectionTitle}>Complementos & Adicionais (Opcional)</Text>
            </View>
            <Text style={styles.fieldHint}>
              Adicionais pagos que podem acompanhar o produto (ex: vela de aniversário, embalagem
              especial, topo de bolo).
            </Text>

            {/* Complements List */}
            {complements.length > 0 && (
              <View style={styles.complementsListWrapper}>
                {complements.map((item) => (
                  <View key={item.id} style={styles.complementRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.complementName}>{item.name}</Text>
                    </View>
                    <Text style={styles.complementPrice}>
                      +{formatCurrency(item.priceCents, currency)}
                    </Text>
                    <TouchableOpacity
                      onPress={() => handleRemoveComplement(item.id)}
                      style={styles.removeIngBtn}
                    >
                      <Trash2 size={16} color={colors.danger} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* Add Complement Box */}
            <View style={styles.addComplementBox}>
              <TextInput
                style={styles.textInput}
                placeholder="Ex: Topo de Bolo Personalizado c/ Nome"
                placeholderTextColor={colors.textMuted}
                value={complementNameInput}
                onChangeText={setComplementNameInput}
              />
              <CurrencyInput
                label="Valor adicional"
                cents={complementPriceInput}
                onChangeCents={setComplementPriceInput}
                currency={currency}
                containerStyle={{ marginBottom: spacing.sm }}
              />
              <Button
                title="Adicionar Complemento"
                variant="outline"
                onPress={handleAddComplement}
                style={styles.addIngSubmitBtn}
              />
            </View>
          </Card>

          {/* Notes Card */}
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Observações Internas (Opcional)</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              placeholder="Instruções de preparo, tempo de forno, validade ou alergênicos..."
              placeholderTextColor={colors.textMuted}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </Card>

          {/* Submit Button */}
          <Button
            title="Cadastrar Produto"
            onPress={handleSave}
            loading={createMutation.isPending}
            style={styles.saveButton}
          />
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
  },
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
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  scrollContent: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  sectionCard: {
    padding: spacing.lg,
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
    marginBottom: spacing.xs,
  },
  cardTitleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  fieldLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.primaryDark,
    marginBottom: spacing.xs,
  },
  fieldHint: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    lineHeight: 18,
  },
  textInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    height: 48,
    fontSize: typography.sizes.sm,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  textArea: {
    height: 96,
    paddingTop: spacing.sm,
  },
  suggestionRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingVertical: 4,
    marginBottom: spacing.xs,
  },
  suggestionChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  suggestionChipActive: {
    backgroundColor: colors.primaryDark,
    borderColor: colors.primaryDark,
  },
  suggestionChipText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  suggestionChipTextActive: {
    color: '#ffffff',
    fontWeight: typography.weights.bold,
  },
  unitRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  unitChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  unitChipActive: {
    backgroundColor: `${colors.primary}18`,
    borderColor: colors.primary,
  },
  unitChipText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  unitChipTextActive: {
    color: colors.primary,
    fontWeight: typography.weights.bold,
  },
  photoContainer: {
    alignItems: 'center',
    marginVertical: spacing.sm,
  },
  photoWrapper: {
    position: 'relative',
    marginBottom: spacing.md,
  },
  productPhoto: {
    width: 120,
    height: 120,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface,
  },
  removePhotoButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: borderRadius.lg,
    backgroundColor: `${colors.caramel}15`,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.caramel,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    padding: spacing.sm,
  },
  photoHint: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 6,
  },
  photoButtonsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  photoActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.md,
    gap: 6,
  },
  photoActionText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.primaryDark,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  switchTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  switchSubtitle: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
  },

  // Calculator styles
  calculatorCard: {
    backgroundColor: '#fffdf9',
    borderColor: '#e8dcce',
  },
  calcHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  calcTitleWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  marginResultBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  marginResultText: {
    fontSize: 12,
    fontWeight: typography.weights.bold,
  },
  marginBadgeHigh: {
    backgroundColor: `${colors.success}18`,
  },
  marginBadgeMedium: {
    backgroundColor: `${colors.warning}18`,
  },
  marginBadgeLow: {
    backgroundColor: `${colors.danger}18`,
  },
  calcExplanation: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  profitSnapshot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  snapshotItem: {
    alignItems: 'center',
  },
  snapshotLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    color: colors.textMuted,
    fontWeight: typography.weights.semibold,
  },
  snapshotValue: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginTop: 2,
  },
  snapshotOperator: {
    fontSize: 16,
    fontWeight: typography.weights.bold,
    color: colors.textMuted,
  },
  ingredientListWrapper: {
    marginBottom: spacing.md,
  },
  subListTitle: {
    fontSize: 12,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#f0e6dc',
  },
  ingredientName: {
    fontSize: typography.sizes.sm,
    color: colors.text,
    fontWeight: typography.weights.medium,
  },
  ingredientCost: {
    fontSize: typography.sizes.sm,
    color: colors.danger,
    fontWeight: typography.weights.bold,
    marginRight: spacing.sm,
  },
  removeIngBtn: {
    padding: 4,
  },
  addIngredientBox: {
    backgroundColor: '#f9f5ef',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#e8dcce',
  },
  addIngredientTitle: {
    fontSize: 12,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
    marginBottom: spacing.xs,
  },
  addIngSubmitBtn: {
    marginTop: spacing.xs,
  },

  // Goal Box
  projectedRevenueBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${colors.primary}12`,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    gap: 8,
    marginTop: spacing.xs,
  },
  projectedRevenueText: {
    fontSize: 12,
    color: colors.primaryDark,
  },

  // Flavors & Tags
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: spacing.md,
  },
  flavorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f7f1e9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: '#e8dcce',
    gap: 6,
  },
  flavorBadgeText: {
    fontSize: 12,
    fontWeight: typography.weights.semibold,
    color: colors.primaryDark,
  },
  removeTagBtn: {
    padding: 2,
  },
  tagInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  addTagButton: {
    width: 48,
    height: 48,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Complements
  complementsListWrapper: {
    marginBottom: spacing.md,
  },
  complementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#f0e6dc',
  },
  complementName: {
    fontSize: typography.sizes.sm,
    color: colors.text,
    fontWeight: typography.weights.medium,
  },
  complementPrice: {
    fontSize: typography.sizes.sm,
    color: colors.success,
    fontWeight: typography.weights.bold,
    marginRight: spacing.sm,
  },
  addComplementBox: {
    backgroundColor: '#f9f5ef',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#e8dcce',
  },

  // Save
  saveButton: {
    marginTop: spacing.md,
  },
});
