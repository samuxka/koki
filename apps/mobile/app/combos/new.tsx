import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Layers,
  Plus,
  Trash2,
  Sparkles,
  Percent,
  DollarSign,
  Clock,
  ShoppingBag,
  TrendingUp,
  Tag,
  Check,
  X,
  Search,
} from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '../../src/theme';
import { Card, Button, Input, CurrencyInput, Badge } from '../../src/components/ui';
import { api } from '../../src/services/api';
import { useAuthStore } from '../../src/stores/auth.store';
import { formatCurrency } from '../../src/utils/formatters';
import { Product, CreateComboDto, Combo } from '@koki/types';

const CATEGORY_PRESETS = [
  'Combos & Kits',
  'Kits Festa',
  'Degustação',
  'Café & Lanche',
  'Presentes',
];

interface SelectedComboItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPriceCents: number;
  unitCostCents: number;
  flavor?: string;
  notes?: string;
}

export default function NewComboScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { company } = useAuthStore();
  const currency = company?.currency || 'EUR';

  // Form State
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Kits Festa');
  const [description, setDescription] = useState('');
  const [leadTimeHours, setLeadTimeHours] = useState<number>(24);
  const [syncAsProduct, setSyncAsProduct] = useState(true);

  // Selected Items in Combo
  const [items, setItems] = useState<SelectedComboItem[]>([]);

  // Promo Price
  const [priceCents, setPriceCents] = useState<number>(0);

  // Product Selection Modal
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [productSearch, setProductSearch] = useState('');

  // Fetch Available Products
  const { data: productsData } = useQuery<{ items: Product[] } | Product[]>({
    queryKey: ['products-list-mini'],
    queryFn: () => api.get('/products?availableOnly=true'),
  });

  const availableProducts: Product[] = Array.isArray(productsData)
    ? productsData
    : (productsData as any)?.items || [];

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return availableProducts;
    const term = productSearch.toLowerCase();
    return availableProducts.filter((p) => p.name.toLowerCase().includes(term));
  }, [availableProducts, productSearch]);

  // Calculations
  const originalTotalCents = useMemo(() => {
    return items.reduce((acc, i) => acc + i.quantity * i.unitPriceCents, 0);
  }, [items]);

  const totalCostCents = useMemo(() => {
    return items.reduce((acc, i) => acc + i.quantity * i.unitCostCents, 0);
  }, [items]);

  const discountCents = Math.max(0, originalTotalCents - priceCents);
  const discountPercent =
    originalTotalCents > 0 ? Math.round((discountCents / originalTotalCents) * 100) : 0;
  const profitCents = Math.max(0, priceCents - totalCostCents);
  const profitMarginPercent =
    priceCents > 0 ? Math.round((profitCents / priceCents) * 100) : 0;

  // Add product to combo
  const handleSelectProduct = (product: Product) => {
    const existingIndex = items.findIndex((i) => i.productId === product.id);
    if (existingIndex >= 0) {
      const updated = [...items];
      updated[existingIndex].quantity += 1;
      setItems(updated);
    } else {
      setItems([
        ...items,
        {
          productId: product.id,
          productName: product.name,
          quantity: 1,
          unitPriceCents: product.priceCents || 0,
          unitCostCents: product.costCents || 0,
          flavor: product.flavors?.[0] || undefined,
        },
      ]);
    }

    // If priceCents was 0 or untouched, suggest sum
    if (priceCents === 0) {
      setPriceCents(product.priceCents || 0);
    } else {
      setPriceCents((prev) => prev + (product.priceCents || 0));
    }

    setIsPickerOpen(false);
    setProductSearch('');
  };

  const handleUpdateItemQty = (index: number, delta: number) => {
    const updated = [...items];
    const newQty = updated[index].quantity + delta;
    if (newQty <= 0) {
      updated.splice(index, 1);
    } else {
      updated[index].quantity = newQty;
    }
    setItems(updated);
  };

  const handleApplyDiscountPreset = (percent: number) => {
    if (originalTotalCents <= 0) return;
    const factor = (100 - percent) / 100;
    const newPrice = Math.round(originalTotalCents * factor);
    setPriceCents(newPrice);
  };

  // Submit Mutation
  const createMutation = useMutation({
    mutationFn: (payload: CreateComboDto) => api.post<Combo>('/combos', payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['combos-list'] });
      queryClient.invalidateQueries({ queryKey: ['combos-quota'] });
      queryClient.invalidateQueries({ queryKey: ['products-list'] });
      Alert.alert(
        'Sucesso!',
        `O combo "${data.name}" foi criado e está disponível para pedidos!`,
        [{ text: 'OK', onPress: () => router.back() }],
      );
    },
    onError: (err: any) => {
      Alert.alert('Atenção', err.message || 'Falha ao cadastrar combo.');
    },
  });

  const handleSubmit = () => {
    if (!name.trim()) {
      Alert.alert('Campo Obrigatório', 'Informe o nome do combo ou kit.');
      return;
    }

    if (items.length === 0) {
      Alert.alert('Itens Necessários', 'Adicione pelo menos um produto ao combo.');
      return;
    }

    if (priceCents <= 0) {
      Alert.alert('Preço Inválido', 'Defina um preço de venda para o combo.');
      return;
    }

    const payload: CreateComboDto = {
      name: name.trim(),
      category: category.trim(),
      description: description.trim() || undefined,
      items: items.map((i) => ({
        productId: i.productId,
        productName: i.productName,
        quantity: i.quantity,
        unitPriceCents: i.unitPriceCents,
        unitCostCents: i.unitCostCents,
        flavor: i.flavor,
        notes: i.notes,
      })),
      priceCents,
      isAvailable: true,
      minLeadTimeHours: leadTimeHours,
      syncAsProduct,
    };

    createMutation.mutate(payload);
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) + 8 }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <ArrowLeft size={22} color={colors.primary} />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Novo Combo / Kit</Text>
            <Text style={styles.headerSubtitle}>Montar pacote promocional</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 20) + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Card 1: Identification */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>1. Identificação do Combo</Text>

          <Input
            label="Nome do Kit / Pacote *"
            placeholder="Ex: Kit Festa Aniversário - 20 Pessoas"
            value={name}
            onChangeText={setName}
          />

          <Text style={styles.fieldLabel}>Categoria:</Text>
          <View style={styles.chipsRow}>
            {CATEGORY_PRESETS.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.categoryChip, category === cat && styles.categoryChipActive]}
                onPress={() => setCategory(cat)}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    category === cat && styles.categoryChipTextActive,
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ marginTop: spacing.sm }}>
            <Input
              label="Descrição para os Clientes (Opcional)"
              placeholder="Ex: A combinação perfeita para sua festa. Inclui bolo 20cm e docinhos."
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={2}
            />
          </View>

          <Text style={[styles.fieldLabel, { marginTop: spacing.sm }]}>
            Antecedência Mínima de Pedido:
          </Text>
          <View style={styles.chipsRow}>
            {[
              { label: 'Pronta Entrega', hours: 0 },
              { label: '24 Horas', hours: 24 },
              { label: '48 Horas', hours: 48 },
              { label: '72 Horas', hours: 72 },
            ].map((t) => (
              <TouchableOpacity
                key={t.hours}
                style={[
                  styles.categoryChip,
                  leadTimeHours === t.hours && styles.categoryChipActive,
                ]}
                onPress={() => setLeadTimeHours(t.hours)}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    leadTimeHours === t.hours && styles.categoryChipTextActive,
                  ]}
                >
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* Card 2: Items in Combo */}
        <Card style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>2. Produtos Inclusos no Kit</Text>
            <TouchableOpacity
              style={styles.addProductBtn}
              onPress={() => setIsPickerOpen(true)}
              activeOpacity={0.7}
            >
              <Plus size={14} color="#ffffff" style={{ marginRight: 4 }} />
              <Text style={styles.addProductBtnText}>Adicionar Produto</Text>
            </TouchableOpacity>
          </View>

          {items.length === 0 ? (
            <TouchableOpacity
              style={styles.emptyItemsBox}
              onPress={() => setIsPickerOpen(true)}
              activeOpacity={0.8}
            >
              <ShoppingBag size={28} color={colors.caramel} style={{ marginBottom: 6 }} />
              <Text style={styles.emptyItemsTitle}>Nenhum produto adicionado</Text>
              <Text style={styles.emptyItemsSub}>
                Toque aqui para escolher bolos, doces e insumos do seu catálogo.
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={{ gap: spacing.sm }}>
              {items.map((item, index) => (
                <View key={item.productId + index} style={styles.itemCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemNameText}>{item.productName}</Text>
                    <Text style={styles.itemPriceSubText}>
                      Avulso: {formatCurrency(item.unitPriceCents, currency)} un • Custo: {formatCurrency(item.unitCostCents, currency)}
                    </Text>
                  </View>

                  {/* Quantity Stepper */}
                  <View style={styles.stepperRow}>
                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => handleUpdateItemQty(index, -1)}
                    >
                      <Text style={styles.stepperBtnText}>-</Text>
                    </TouchableOpacity>

                    <Text style={styles.stepperValue}>{item.quantity}</Text>

                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => handleUpdateItemQty(index, 1)}
                    >
                      <Text style={styles.stepperBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    onPress={() => handleUpdateItemQty(index, -item.quantity)}
                    style={styles.removeItemBtn}
                  >
                    <Trash2 size={16} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              ))}

              {/* Items Summary Subtotal */}
              <View style={styles.subtotalBanner}>
                <View style={styles.subtotalRow}>
                  <Text style={styles.subtotalLabel}>Soma dos Itens Avulsos:</Text>
                  <Text style={styles.subtotalValue}>
                    {formatCurrency(originalTotalCents, currency)}
                  </Text>
                </View>

                <View style={styles.subtotalRow}>
                  <Text style={styles.subtotalLabel}>Custo Total de Produção:</Text>
                  <Text style={[styles.subtotalValue, { color: colors.textSecondary }]}>
                    {formatCurrency(totalCostCents, currency)}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </Card>

        {/* Card 3: Pricing & Profit Simulator */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>3. Preço Promocional & Margem de Lucro</Text>

          <CurrencyInput
            label="Preço de Venda do Combo *"
            cents={priceCents}
            onChangeCents={setPriceCents}
            currency={currency}
          />

          {/* Quick Discount Presets */}
          <Text style={[styles.fieldLabel, { marginTop: spacing.xs }]}>
            Aplicar Desconto sobre Itens Avulsos:
          </Text>
          <View style={styles.chipsRow}>
            {[
              { label: '-5%', val: 5 },
              { label: '-10%', val: 10 },
              { label: '-15%', val: 15 },
              { label: '-20%', val: 20 },
              { label: '-25%', val: 25 },
            ].map((p) => (
              <TouchableOpacity
                key={p.val}
                style={styles.discountPresetChip}
                onPress={() => handleApplyDiscountPreset(p.val)}
              >
                <Text style={styles.discountPresetText}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Live Financial Metrics Banner */}
          <View style={styles.financialMetricsBox}>
            <View style={styles.financialMetricItem}>
              <Text style={styles.metricLabel}>Economia do Cliente</Text>
              <Text style={styles.metricEconomyValue}>
                {formatCurrency(discountCents, currency)}
              </Text>
              <Text style={styles.metricSubtext}>-{discountPercent}% OFF</Text>
            </View>

            <View style={styles.metricDivider} />

            <View style={styles.financialMetricItem}>
              <Text style={styles.metricLabel}>Lucro Líquido</Text>
              <Text style={styles.metricProfitValue}>
                +{formatCurrency(profitCents, currency)}
              </Text>
              <Badge
                color={profitMarginPercent >= 30 ? colors.success : colors.warning}
                label={`${profitMarginPercent}% de margem`}
                style={{ marginTop: 2 }}
              />
            </View>
          </View>
        </Card>

        {/* Card 4: Catalog Sync */}
        <Card style={styles.card}>
          <TouchableOpacity
            style={styles.syncRow}
            onPress={() => setSyncAsProduct(!syncAsProduct)}
            activeOpacity={0.8}
          >
            <View style={[styles.checkbox, syncAsProduct && styles.checkboxActive]}>
              {syncAsProduct && <Check size={13} color="#ffffff" />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.syncTitle}>Sincronizar no Catálogo de Produtos</Text>
              <Text style={styles.syncSubtitle}>
                Cria automaticamente este kit como produto vendável para fechar pedidos com 1 clique.
              </Text>
            </View>
          </TouchableOpacity>
        </Card>

        {/* Submit Button */}
        <Button
          title="Salvar Combo Promocional"
          loading={createMutation.isPending}
          onPress={handleSubmit}
          style={styles.submitBtn}
        />
      </ScrollView>

      {/* Product Selection Modal */}
      <Modal visible={isPickerOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Adicionar ao Combo</Text>
              <TouchableOpacity onPress={() => setIsPickerOpen(false)}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={styles.modalSearchBox}>
              <Search size={16} color={colors.textSecondary} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Buscar produto..."
                placeholderTextColor={colors.textMuted}
                value={productSearch}
                onChangeText={setProductSearch}
              />
            </View>

            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              {filteredProducts.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={styles.productPickerItem}
                  onPress={() => handleSelectProduct(p)}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pickerItemName}>{p.name}</Text>
                    <Text style={styles.pickerItemCategory}>{p.category}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.pickerItemPrice}>
                      {formatCurrency(p.priceCents || 0, currency)}
                    </Text>
                    <Text style={styles.pickerItemCost}>
                      Custo: {formatCurrency(p.costCents || 0, currency)}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
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
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
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
  card: {
    padding: spacing.md,
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  cardTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
    marginBottom: spacing.sm,
  },
  fieldLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: spacing.xs,
  },
  categoryChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
    backgroundColor: '#faf6f0',
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryChipText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
  },
  categoryChipTextActive: {
    color: colors.textInverse,
  },
  addProductBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: borderRadius.sm,
  },
  addProductBtnText: {
    fontSize: 11,
    fontWeight: typography.weights.bold,
    color: '#ffffff',
  },
  emptyItemsBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: '#faf7f2',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#e0d5c5',
    marginVertical: spacing.xs,
  },
  emptyItemsTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
    marginBottom: 2,
  },
  emptyItemsSub: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#faf7f2',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  itemNameText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  itemPriceSubText: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: spacing.sm,
  },
  stepperBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  stepperBtnText: {
    fontSize: 16,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  stepperValue: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.text,
    minWidth: 20,
    textAlign: 'center',
  },
  removeItemBtn: {
    padding: 6,
  },
  subtotalBanner: {
    backgroundColor: '#fffaf2',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: '#f2dfc5',
    marginTop: spacing.xs,
    gap: 4,
  },
  subtotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subtotalLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
  subtotalValue: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  discountPresetChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.sm,
    backgroundColor: '#fff2df',
    borderWidth: 1,
    borderColor: '#f0ddbe',
  },
  discountPresetText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  financialMetricsBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f9f6f0',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  financialMetricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 10,
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  metricEconomyValue: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  metricProfitValue: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.success,
  },
  metricSubtext: {
    fontSize: 11,
    fontWeight: typography.weights.semibold,
    color: colors.success,
    marginTop: 2,
  },
  metricDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border,
  },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  checkboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  syncTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  syncSubtitle: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  submitBtn: {
    marginTop: spacing.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.cardBackground,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  modalSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    height: 40,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.text,
  },
  productPickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickerItemName: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  pickerItemCategory: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  pickerItemPrice: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  pickerItemCost: {
    fontSize: 10,
    color: colors.textMuted,
  },
});
