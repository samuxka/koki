import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import {
  ArrowLeft,
  Tag,
  Calendar,
  Clock,
  Sparkles,
  Package,
  BookOpen,
  Check,
  Eye,
  Sliders,
  Image as ImageIcon,
} from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '../../src/theme';
import { Card, Button, Input, Badge } from '../../src/components/ui';
import { api } from '../../src/services/api';
import { useAuthStore } from '../../src/stores/auth.store';
import { Product, Recipe, CreateLabelBatchDto, LabelSize } from '@koki/types';

const SHELF_LIFE_PRESETS = [
  { label: '+3 dias', days: 3 },
  { label: '+5 dias', days: 5 },
  { label: '+7 dias', days: 7 },
  { label: '+15 dias', days: 15 },
  { label: '+30 dias', days: 30 },
  { label: '+90 dias', days: 90 },
];

const STORAGE_CONDITIONS = [
  'Conservar em local seco e fresco',
  'Manter refrigerado de 0°C a 4°C',
  'Manter congelado a -18°C',
  'Após aberto consumir em 48h sob refrigeração',
];

export default function NewLabelScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { company } = useAuthStore();

  const todayStr = new Date().toISOString().split('T')[0];

  const [productName, setProductName] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string | undefined>();
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | undefined>();
  const [batchCode, setBatchCode] = useState('');
  const [productionDate, setProductionDate] = useState(todayStr);
  const [expiryDate, setExpiryDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 5);
    return d.toISOString().split('T')[0];
  });
  const [storageCondition, setStorageCondition] = useState(STORAGE_CONDITIONS[0]);
  const [netWeight, setNetWeight] = useState('');
  const [ingredientsText, setIngredientsText] = useState('');
  const [allergensText, setAllergensText] = useState('');
  const [labelSize, setLabelSize] = useState<LabelSize>('standard');
  const [quantity, setQuantity] = useState('10');
  const [notes, setNotes] = useState('');
  const previewRef = useRef<any>(null);
  const [isSharingPreview, setIsSharingPreview] = useState(false);

  // Fetch products and recipes for fast auto-fill
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['products-list'],
    queryFn: () => api.get<Product[]>('/products'),
  });

  const { data: recipes = [] } = useQuery<Recipe[]>({
    queryKey: ['recipes-list'],
    queryFn: () => api.get<Recipe[]>('/recipes'),
  });

  const handleSelectProduct = (product: Product) => {
    setSelectedProductId(product.id);
    setProductName(product.name);
    if (product.unit && !netWeight) {
      setNetWeight(`1 ${product.unit}`);
    }
  };

  const handleSelectRecipe = (recipe: Recipe) => {
    setSelectedRecipeId(recipe.id);
    setProductName(recipe.name);
    if (recipe.ingredients && recipe.ingredients.length > 0) {
      const ingList = recipe.ingredients.map((i) => i.name).join(', ');
      setIngredientsText(ingList);
    }
    if (recipe.yield && recipe.yieldUnit && !netWeight) {
      setNetWeight(`${recipe.yield} ${recipe.yieldUnit}`);
    }
  };

  const applyShelfLife = (days: number) => {
    const base = new Date(productionDate || todayStr);
    base.setDate(base.getDate() + days);
    setExpiryDate(base.toISOString().split('T')[0]);
  };

  const handleSharePreviewImage = async () => {
    if (!previewRef.current) return;
    try {
      setIsSharingPreview(true);
      const uri = await captureRef(previewRef, {
        format: 'png',
        quality: 1.0,
        result: 'tmpfile',
      });
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: `Etiqueta ${productName || 'Prévia'}`,
          UTI: 'public.png',
        });
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Erro', 'Não foi possível gerar a imagem da prévia.');
    } finally {
      setIsSharingPreview(false);
    }
  };

  const createMutation = useMutation({
    mutationFn: (dto: CreateLabelBatchDto) => api.post('/labels/batches', dto),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['label-batches'] });
      queryClient.invalidateQueries({ queryKey: ['labels-quota'] });
      Alert.alert('Sucesso!', 'Lote registrado e etiqueta gerada com sucesso.');
      router.replace(`/labels/${data.id}` as any);
    },
    onError: (err: any) => {
      Alert.alert(
        'Atenção',
        err.response?.data?.message || err.message || 'Falha ao gerar etiquetas.',
      );
    },
  });

  const handleSave = () => {
    if (!productName.trim()) {
      Alert.alert('Campo Obrigatório', 'Informe o nome do produto.');
      return;
    }

    if (!productionDate.trim() || !expiryDate.trim()) {
      Alert.alert('Datas Obrigatórias', 'Informe a data de fabrico e validade.');
      return;
    }

    const qty = parseInt(quantity, 10) || 1;

    createMutation.mutate({
      productName: productName.trim(),
      productId: selectedProductId,
      recipeId: selectedRecipeId,
      batchCode: batchCode.trim() || undefined,
      productionDate: productionDate.trim(),
      expiryDate: expiryDate.trim(),
      storageCondition,
      netWeight: netWeight.trim() || undefined,
      ingredientsText: ingredientsText.trim() || undefined,
      allergensText: allergensText.trim() || undefined,
      labelSize,
      quantity: qty,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) + 8 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <ArrowLeft size={22} color={colors.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Nova Etiqueta & Lote</Text>
          <Text style={styles.headerSubtitle}>Validade e rastreabilidade sanitária</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Quick Link from Existing Products */}
        {products.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Importar de Produto Cadastrado</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              {products.slice(0, 8).map((p) => {
                const isSelected = selectedProductId === p.id;
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.quickChip, isSelected && styles.quickChipActive]}
                    onPress={() => handleSelectProduct(p)}
                  >
                    <Package size={13} color={isSelected ? colors.textInverse : colors.primary} style={{ marginRight: 4 }} />
                    <Text style={[styles.quickChipText, isSelected && styles.quickChipTextActive]}>
                      {p.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Quick Link from Existing Recipes */}
        {recipes.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Importar de Ficha Técnica / Receita</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              {recipes.slice(0, 8).map((r) => {
                const isSelected = selectedRecipeId === r.id;
                return (
                  <TouchableOpacity
                    key={r.id}
                    style={[styles.quickChip, isSelected && styles.quickChipActive]}
                    onPress={() => handleSelectRecipe(r)}
                  >
                    <BookOpen size={13} color={isSelected ? colors.textInverse : colors.primary} style={{ marginRight: 4 }} />
                    <Text style={[styles.quickChipText, isSelected && styles.quickChipTextActive]}>
                      {r.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Main Details Card */}
        <Card style={styles.formCard}>
          <Text style={styles.cardHeaderTitle}>Dados do Produto & Lote</Text>

          <Input
            label="Nome do Produto *"
            placeholder="Ex: Bolo de Cenoura com Ganache Belga"
            value={productName}
            onChangeText={setProductName}
          />

          <View style={styles.inputRow}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Input
                label="Código do Lote (Opcional)"
                placeholder="Auto: LOT-AAAAMMDD-001"
                value={batchCode}
                onChangeText={setBatchCode}
                autoCapitalize="characters"
              />
            </View>

            <View style={{ width: 120 }}>
              <Input
                label="Qtd. Etiquetas *"
                placeholder="Ex: 10"
                keyboardType="numeric"
                value={quantity}
                onChangeText={setQuantity}
              />
            </View>
          </View>

          <View style={styles.inputRow}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Input
                label="Data de Fabrico *"
                placeholder="AAAA-MM-DD"
                value={productionDate}
                onChangeText={setProductionDate}
              />
            </View>

            <View style={{ flex: 1 }}>
              <Input
                label="Data de Validade *"
                placeholder="AAAA-MM-DD"
                value={expiryDate}
                onChangeText={setExpiryDate}
              />
            </View>
          </View>

          {/* Quick Shelf Life Shortcuts */}
          <View style={styles.shelfLifeContainer}>
            <Text style={styles.shelfLifeLabel}>Atalhos de Validade:</Text>
            <View style={styles.shelfLifeChips}>
              {SHELF_LIFE_PRESETS.map((preset) => (
                <TouchableOpacity
                  key={preset.days}
                  style={styles.shelfLifeChip}
                  onPress={() => applyShelfLife(preset.days)}
                >
                  <Text style={styles.shelfLifeChipText}>{preset.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <Input
            label="Peso Líquido / Quantidade (Opcional)"
            placeholder="Ex: 350g, 1 kg, 6 unidades"
            value={netWeight}
            onChangeText={setNetWeight}
          />

          {/* Storage Conditions Chips */}
          <View style={{ marginTop: spacing.xs, marginBottom: spacing.md }}>
            <Text style={styles.fieldLabel}>Condições de Conservação *</Text>
            {STORAGE_CONDITIONS.map((cond) => {
              const isSelected = storageCondition === cond;
              return (
                <TouchableOpacity
                  key={cond}
                  style={[styles.storageOption, isSelected && styles.storageOptionActive]}
                  onPress={() => setStorageCondition(cond)}
                >
                  <View style={[styles.radioCircle, isSelected && styles.radioCircleActive]}>
                    {isSelected && <View style={styles.radioInner} />}
                  </View>
                  <Text style={[styles.storageOptionText, isSelected && styles.storageOptionTextActive]}>
                    {cond}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Input
            label="Lista de Ingredientes (Ordem decrescente)"
            placeholder="Ex: Farinha de trigo, ovos, manteiga, cacau 100%, açúcar, fermento..."
            value={ingredientsText}
            onChangeText={setIngredientsText}
            multiline
            numberOfLines={3}
          />

          <Input
            label="Alérgenos (Destaque regulatório)"
            placeholder="Ex: CONTÉM GLÚTEN, LEITE E DERIVADOS DE TRIGO. PODE CONTER SOJA E NOZES."
            value={allergensText}
            onChangeText={setAllergensText}
            multiline
            numberOfLines={2}
          />

          {/* Label Dimensions Selector */}
          <View style={{ marginTop: spacing.xs, marginBottom: spacing.sm }}>
            <Text style={styles.fieldLabel}>Tamanho da Etiqueta para Impressão</Text>
            <View style={styles.sizeChipsRow}>
              {[
                { id: 'small', label: '50x30 mm (Mini)' },
                { id: 'standard', label: '60x40 mm (Padrão)' },
                { id: 'large', label: '80x50 mm (Grande)' },
              ].map((s) => {
                const isSelected = labelSize === s.id;
                return (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.sizeChip, isSelected && styles.sizeChipActive]}
                    onPress={() => setLabelSize(s.id as LabelSize)}
                  >
                    <Text style={[styles.sizeChipText, isSelected && styles.sizeChipTextActive]}>
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </Card>

        {/* Live Interactive Label Preview */}
        <View style={styles.previewSection}>
          <View style={styles.previewHeaderRow}>
            <Eye size={18} color={colors.primary} style={{ marginRight: 6 }} />
            <Text style={styles.previewSectionTitle}>Pré-visualização da Etiqueta em Tempo Real</Text>
          </View>

          <View ref={previewRef} collapsable={false} style={styles.liveLabelContainer}>
            {/* Top row */}
            <View style={styles.labelHeaderRow}>
              <Text style={styles.labelCompany}>{company?.tradeName || 'KOKI CONFEITARIA'}</Text>
              <Text style={styles.labelSizeBadge}>{labelSize.toUpperCase()}</Text>
            </View>

            <Text style={styles.labelProductName}>
              {productName || 'NOME DO PRODUTO'}
            </Text>

            <View style={styles.labelMetaRow}>
              <Text style={styles.labelBatchText}>
                LOTE: {batchCode.trim() || `LOT-${todayStr.replace(/-/g, '')}-001`}
              </Text>
              {netWeight ? <Text style={styles.labelWeightText}>PESO: {netWeight}</Text> : null}
            </View>

            {/* Dates box */}
            <View style={styles.labelDatesBox}>
              <Text style={styles.labelDateText}>FAB: {productionDate}</Text>
              <Text style={[styles.labelDateText, { color: '#c2312a' }]}>VAL: {expiryDate}</Text>
            </View>

            {/* Ingredients */}
            {ingredientsText ? (
              <Text style={styles.labelIngredients}>
                <Text style={{ fontWeight: 'bold' }}>Ingredientes: </Text>
                {ingredientsText}
              </Text>
            ) : null}

            {/* Allergens */}
            {allergensText ? (
              <Text style={styles.labelAllergens}>
                ALÉRGICOS: {allergensText}
              </Text>
            ) : null}

            <Text style={styles.labelStorage}>Conservação: {storageCondition}</Text>

            {/* Simulated Barcode */}
            <View style={styles.barcodeSection}>
              <Text style={styles.barcodeLines}>|||| | ||||| || |||||| | |||| ||| ||||</Text>
              <Text style={styles.barcodeText}>
                {batchCode.trim() || `LOT-${todayStr.replace(/-/g, '')}-001`}
              </Text>
            </View>
          </View>

          {/* Quick share preview image button */}
          <TouchableOpacity
            style={styles.sharePreviewBtn}
            onPress={handleSharePreviewImage}
            disabled={isSharingPreview}
            activeOpacity={0.8}
          >
            <ImageIcon size={16} color={colors.primary} style={{ marginRight: 6 }} />
            <Text style={styles.sharePreviewBtnText}>
              {isSharingPreview ? 'Gerando Imagem...' : 'Compartilhar Imagem desta Prévia'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Action Button */}
        <Button
          title={createMutation.isPending ? 'Emitindo Etiquetas...' : 'Gerar & Salvar Lote'}
          onPress={handleSave}
          disabled={createMutation.isPending}
          style={{ marginTop: spacing.md, marginBottom: 40 }}
        />
      </ScrollView>
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
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  headerTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  headerSubtitle: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
  },
  section: {
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  chipRow: {
    flexDirection: 'row',
  },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: borderRadius.full,
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.xs,
  },
  quickChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  quickChipText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.primary,
  },
  quickChipTextActive: {
    color: colors.textInverse,
  },
  formCard: {
    padding: spacing.md,
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  cardHeaderTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
    marginBottom: spacing.md,
  },
  inputRow: {
    flexDirection: 'row',
  },
  shelfLifeContainer: {
    marginBottom: spacing.md,
  },
  shelfLifeLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginBottom: 6,
    fontWeight: typography.weights.medium,
  },
  shelfLifeChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  shelfLifeChip: {
    backgroundColor: '#f5ebe0',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: borderRadius.sm,
  },
  shelfLifeChipText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.primaryDark,
  },
  fieldLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.text,
    marginBottom: 6,
  },
  storageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: 4,
    backgroundColor: '#faf6f0',
  },
  storageOptionActive: {
    backgroundColor: '#f4ede1',
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  radioCircleActive: {
    borderColor: colors.primary,
  },
  radioInner: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: colors.primary,
  },
  storageOptionText: {
    fontSize: typography.sizes.xs,
    color: colors.text,
    flex: 1,
  },
  storageOptionTextActive: {
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  sizeChipsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  sizeChip: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: borderRadius.md,
    backgroundColor: '#faf6f0',
    borderWidth: 1,
    borderColor: colors.border,
  },
  sizeChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  sizeChipText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
  },
  sizeChipTextActive: {
    color: colors.textInverse,
  },
  previewSection: {
    marginTop: spacing.sm,
  },
  previewHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  previewSectionTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  liveLabelContainer: {
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#999',
    padding: spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  labelHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    paddingBottom: 4,
    marginBottom: 6,
  },
  labelCompany: {
    fontSize: 10,
    fontWeight: '800',
    color: '#000',
    letterSpacing: 0.5,
  },
  labelSizeBadge: {
    fontSize: 8,
    fontWeight: '700',
    backgroundColor: '#eee',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
  },
  labelProductName: {
    fontSize: 16,
    fontWeight: '900',
    color: '#000',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  labelMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  labelBatchText: {
    fontSize: 10,
    fontWeight: '800',
    fontFamily: 'Courier',
    color: '#000',
  },
  labelWeightText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#000',
  },
  labelDatesBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#333',
    padding: 6,
    marginBottom: 6,
  },
  labelDateText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#000',
  },
  labelIngredients: {
    fontSize: 9,
    color: '#333',
    lineHeight: 12,
    marginBottom: 4,
  },
  labelAllergens: {
    fontSize: 9,
    fontWeight: '900',
    color: '#000',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  labelStorage: {
    fontSize: 9,
    fontStyle: 'italic',
    color: '#555',
    marginBottom: 8,
  },
  barcodeSection: {
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#333',
    paddingTop: 6,
  },
  barcodeLines: {
    fontSize: 14,
    letterSpacing: 2,
    fontWeight: '900',
    fontFamily: 'Courier',
    color: '#000',
  },
  barcodeText: {
    fontSize: 9,
    fontWeight: '700',
    fontFamily: 'Courier',
    color: '#555',
    marginTop: 2,
  },
  sharePreviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    paddingVertical: 10,
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sharePreviewBtnText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
});
