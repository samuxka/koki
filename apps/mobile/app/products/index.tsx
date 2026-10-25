import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  RefreshControl,
  Image,
  Switch,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography, borderRadius } from '../../src/theme';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { Badge } from '../../src/components/ui/Badge';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { LoadingState } from '../../src/components/ui/LoadingState';
import { api } from '../../src/services/api';
import { useAuthStore } from '../../src/stores/auth.store';
import { formatCurrency } from '../../src/utils/formatters';
import { Product, ProductSortBy, ProductFilterType } from '@koki/types';
import {
  Package,
  Search,
  Filter,
  ArrowUpDown,
  LayoutGrid,
  List as ListIcon,
  Plus,
  ChevronRight,
  X,
  Check,
  TrendingUp,
  ShoppingBag,
  ArrowLeft,
  Sparkles,
  Target,
  CheckCircle2,
  XCircle,
  Tag,
  DollarSign,
} from 'lucide-react-native';

const SORT_OPTIONS: { key: ProductSortBy; label: string; icon: string }[] = [
  { key: 'popular', label: 'Mais vendidos (Popularidade)', icon: '🔥' },
  { key: 'revenue', label: 'Maior faturamento acumulado', icon: '💰' },
  { key: 'price_high', label: 'Maior preço de venda', icon: '📈' },
  { key: 'price_low', label: 'Menor preço de venda', icon: '📉' },
  { key: 'newest', label: 'Cadastrados recentemente', icon: '⏱️' },
  { key: 'oldest', label: 'Mais antigos primeiro', icon: '⏳' },
  { key: 'name', label: 'Ordem alfabética (A-Z)', icon: '🔤' },
];

const FILTER_PRESETS: { key: ProductFilterType; label: string }[] = [
  { key: 'all', label: 'Todos os Produtos' },
  { key: 'available', label: 'Apenas Disponíveis' },
  { key: 'unavailable', label: 'Pausados / Esgotados' },
  { key: 'with_goal', label: 'Com Meta de Vendas' },
];

export default function ProductsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { company } = useAuthStore();
  const currency = company?.currency || 'EUR';

  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [sortBy, setSortBy] = useState<ProductSortBy>('popular');
  const [filterType, setFilterType] = useState<ProductFilterType>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortModalVisible, setSortModalVisible] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  // Fetch products from API
  const {
    data,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery<{ items: Product[]; total: number }>({
    queryKey: ['products', search, sortBy, filterType, selectedCategory],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (sortBy) params.append('sortBy', sortBy);
      if (filterType && filterType !== 'all') params.append('filter', filterType);
      if (selectedCategory && selectedCategory !== 'all') params.append('category', selectedCategory);
      params.append('limit', '150');

      return api.get<{ items: Product[]; total: number }>(`/products?${params.toString()}`);
    },
  });

  const rawData: any = data;
  const products: Product[] = Array.isArray(rawData) ? rawData : rawData?.items || [];
  const totalCount = Array.isArray(rawData) ? rawData.length : rawData?.total ?? products.length;

  // Extract distinct categories for fast filtering
  const distinctCategories = useMemo(() => {
    const cats = new Set<string>();
    products.forEach((p) => {
      if (p.category) cats.add(p.category.trim());
    });
    return Array.from(cats);
  }, [products]);

  // Toggle availability mutation
  const toggleMutation = useMutation({
    mutationFn: (productId: string) => api.patch(`/products/${productId}/toggle-availability`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err: any) => {
      Alert.alert('Erro', err.message || 'Falha ao alterar disponibilidade.');
    },
  });

  const handleToggleAvailability = (product: Product) => {
    toggleMutation.mutate(product.id);
  };

  const renderCardItem = ({ item }: { item: Product }) => {
    const marginPercent =
      item.costCents && item.costCents > 0
        ? Math.round(((item.priceCents - item.costCents) / item.priceCents) * 100)
        : null;

    return (
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={() => router.push(`/products/${item.id}` as any)}
        style={styles.cardItemTouch}
      >
        <Card style={styles.cardItem}>
          {/* Header of card: Image / Icon + Category badge + Status switch */}
          <View style={styles.cardTopRow}>
            <View style={styles.imageAndTitle}>
              {item.imageUrl ? (
                <Image source={{ uri: item.imageUrl }} style={styles.productAvatar} />
              ) : (
                <View style={styles.productAvatarPlaceholder}>
                  <Package size={24} color={colors.primary} />
                </View>
              )}
              <View style={styles.productInfo}>
                <View style={styles.categoryRow}>
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryBadgeText}>{item.category || 'Geral'}</Text>
                  </View>
                  {item.monthlySalesGoalUnits && item.monthlySalesGoalUnits > 0 ? (
                    <View style={styles.goalMiniBadge}>
                      <Target size={11} color={colors.caramel} />
                      <Text style={styles.goalMiniBadgeText}>Meta {item.monthlySalesGoalUnits}/mês</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.productName} numberOfLines={2}>
                  {item.name}
                </Text>
              </View>
            </View>
          </View>

          {/* Flavors tags preview if available */}
          {item.flavors && item.flavors.length > 0 ? (
            <View style={styles.flavorsRow}>
              {item.flavors.slice(0, 3).map((f, idx) => (
                <View key={idx} style={styles.flavorTag}>
                  <Text style={styles.flavorTagText} numberOfLines={1}>
                    {f}
                  </Text>
                </View>
              ))}
              {item.flavors.length > 3 ? (
                <Text style={styles.moreFlavorsText}>+{item.flavors.length - 3}</Text>
              ) : null}
            </View>
          ) : null}

          {/* Pricing & Performance bar */}
          <View style={styles.cardFooter}>
            <View>
              <Text style={styles.priceLabel}>Preço de venda</Text>
              <View style={styles.priceContainer}>
                <Text style={styles.priceValue}>{formatCurrency(item.priceCents, currency)}</Text>
                {item.unit ? <Text style={styles.unitText}>/{item.unit}</Text> : null}
              </View>
            </View>

            {/* Profit margin badge or cost */}
            {marginPercent !== null ? (
              <View
                style={[
                  styles.marginBadge,
                  marginPercent >= 50
                    ? styles.marginBadgeHigh
                    : marginPercent >= 20
                    ? styles.marginBadgeMedium
                    : styles.marginBadgeLow,
                ]}
              >
                <TrendingUp
                  size={12}
                  color={
                    marginPercent >= 50
                      ? colors.success
                      : marginPercent >= 20
                      ? colors.warning
                      : colors.danger
                  }
                />
                <Text
                  style={[
                    styles.marginBadgeText,
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
            ) : item.costCents ? (
              <View style={styles.costBadge}>
                <Text style={styles.costBadgeText}>
                  Custo {formatCurrency(item.costCents, currency)}
                </Text>
              </View>
            ) : null}

            {/* Quick availability toggle switch */}
            <View style={styles.availabilityWrapper}>
              <Text
                style={[
                  styles.availabilityLabel,
                  { color: item.isAvailable ? colors.success : colors.textMuted },
                ]}
              >
                {item.isAvailable ? 'Ativo' : 'Pausado'}
              </Text>
              <Switch
                value={item.isAvailable}
                onValueChange={() => handleToggleAvailability(item)}
                trackColor={{ false: '#e2d9cf', true: `${colors.primary}66` }}
                thumbColor={item.isAvailable ? colors.primary : '#9e8c7c'}
                style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
              />
            </View>
          </View>

          {/* Sales metrics summary row */}
          {(item.totalUnitsSold || 0) > 0 || (item.totalRevenueCents || 0) > 0 ? (
            <View style={styles.cardSalesStats}>
              <View style={styles.salesStatItem}>
                <ShoppingBag size={12} color={colors.textSecondary} />
                <Text style={styles.salesStatText}>
                  {item.totalUnitsSold || 0} {item.unit || 'un.'} vendidas
                </Text>
              </View>
              <View style={styles.salesStatItem}>
                <DollarSign size={12} color={colors.textSecondary} />
                <Text style={styles.salesStatText}>
                  {formatCurrency(item.totalRevenueCents || 0, currency)} gerados
                </Text>
              </View>
            </View>
          ) : null}
        </Card>
      </TouchableOpacity>
    );
  };

  const renderListItem = ({ item }: { item: Product }) => {
    const marginPercent =
      item.costCents && item.costCents > 0
        ? Math.round(((item.priceCents - item.costCents) / item.priceCents) * 100)
        : null;

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => router.push(`/products/${item.id}` as any)}
        style={styles.listItem}
      >
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={styles.listAvatar} />
        ) : (
          <View style={styles.listAvatarPlaceholder}>
            <Package size={20} color={colors.primary} />
          </View>
        )}

        <View style={styles.listContent}>
          <View style={styles.listHeaderRow}>
            <Text style={styles.listName} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.listPrice}>{formatCurrency(item.priceCents, currency)}</Text>
          </View>

          <View style={styles.listSubRow}>
            <Text style={styles.listCategory}>{item.category || 'Geral'}</Text>
            {marginPercent !== null ? (
              <Text style={styles.listMarginText}>• {marginPercent}% margem</Text>
            ) : null}
            <Text style={styles.listSoldText}>• {item.totalUnitsSold || 0} vendas</Text>
          </View>
        </View>

        <View style={styles.listRightCol}>
          <Switch
            value={item.isAvailable}
            onValueChange={() => handleToggleAvailability(item)}
            trackColor={{ false: '#e2d9cf', true: `${colors.primary}66` }}
            thumbColor={item.isAvailable ? colors.primary : '#9e8c7c'}
            style={{ transform: [{ scaleX: 0.75 }, { scaleY: 0.75 }] }}
          />
          <ChevronRight size={18} color={colors.textMuted} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Safe Area Top Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) + 8 }]}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <ArrowLeft size={22} color={colors.primaryDark} />
          </TouchableOpacity>

          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Produtos & Catálogo</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{totalCount} itens</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.newButton}
            onPress={() => router.push('/products/new' as any)}
            activeOpacity={0.8}
          >
            <Plus size={18} color="#ffffff" />
            <Text style={styles.newButtonText}>Novo</Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchRow}>
          <View style={styles.searchContainer}>
            <Search size={18} color={colors.textMuted} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar por nome, categoria, sabor..."
              placeholderTextColor={colors.textMuted}
              value={search}
              onChangeText={setSearch}
              clearButtonMode="while-editing"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} style={styles.clearSearch}>
                <X size={16} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Action Controls: View mode toggle, Sort, Filter */}
        <View style={styles.controlsRow}>
          {/* View mode toggle */}
          <View style={styles.viewModeToggle}>
            <TouchableOpacity
              style={[styles.viewModeBtn, viewMode === 'card' && styles.viewModeBtnActive]}
              onPress={() => setViewMode('card')}
            >
              <LayoutGrid
                size={16}
                color={viewMode === 'card' ? colors.primaryDark : colors.textMuted}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.viewModeBtn, viewMode === 'list' && styles.viewModeBtnActive]}
              onPress={() => setViewMode('list')}
            >
              <ListIcon
                size={16}
                color={viewMode === 'list' ? colors.primaryDark : colors.textMuted}
              />
            </TouchableOpacity>
          </View>

          {/* Sort Selector Button */}
          <TouchableOpacity
            style={styles.controlBtn}
            onPress={() => setSortModalVisible(true)}
            activeOpacity={0.7}
          >
            <ArrowUpDown size={15} color={colors.primaryDark} />
            <Text style={styles.controlBtnText} numberOfLines={1}>
              {SORT_OPTIONS.find((s) => s.key === sortBy)?.label.split(' ')[0] || 'Ordenar'}
            </Text>
          </TouchableOpacity>

          {/* Filter Selector Button */}
          <TouchableOpacity
            style={[
              styles.controlBtn,
              (filterType !== 'all' || selectedCategory !== 'all') && styles.controlBtnActive,
            ]}
            onPress={() => setFilterModalVisible(true)}
            activeOpacity={0.7}
          >
            <Filter
              size={15}
              color={
                filterType !== 'all' || selectedCategory !== 'all'
                  ? colors.primary
                  : colors.primaryDark
              }
            />
            <Text
              style={[
                styles.controlBtnText,
                (filterType !== 'all' || selectedCategory !== 'all') && styles.controlBtnTextActive,
              ]}
            >
              Filtros
              {filterType !== 'all' || selectedCategory !== 'all' ? ' •' : ''}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Quick category pills horizontal bar if categories exist */}
        {distinctCategories.length > 0 && (
          <View style={styles.categoryPillsWrapper}>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={['all', ...distinctCategories]}
              keyExtractor={(cat) => cat}
              contentContainerStyle={styles.categoryPillsList}
              renderItem={({ item: cat }) => {
                const isSelected = selectedCategory === cat;
                return (
                  <TouchableOpacity
                    style={[styles.categoryPill, isSelected && styles.categoryPillActive]}
                    onPress={() => setSelectedCategory(cat)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.categoryPillText,
                        isSelected && styles.categoryPillTextActive,
                      ]}
                    >
                      {cat === 'all' ? 'Todas as Categorias' : cat}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        )}
      </View>

      {/* Main Product List */}
      {isLoading && !products.length ? (
        <LoadingState message="Carregando produtos..." />
      ) : products.length === 0 ? (
        <EmptyState
          icon={<Package size={48} color={colors.primary} />}
          title={search ? 'Nenhum produto encontrado' : 'Nenhum produto cadastrado'}
          description={
            search
              ? 'Tente ajustar sua busca ou limpar os filtros aplicados.'
              : 'Cadastre os bolos, doces e salgados do seu cardápio com preços e custos calculados.'
          }
          actionTitle="Cadastrar Produto"
          onAction={() => router.push('/products/new' as any)}
        />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          renderItem={viewMode === 'card' ? renderCardItem : renderListItem}
          contentContainerStyle={[
            styles.listContainer,
            { paddingBottom: Math.max(insets.bottom, 20) + 80 },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => {
                refetch();
              }}
              tintColor={colors.primary}
            />
          }
        />
      )}

      {/* Sort Modal */}
      <Modal
        visible={sortModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSortModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSortModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Ordenar Produtos</Text>
              <TouchableOpacity onPress={() => setSortModalVisible(false)}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {SORT_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.key}
                style={[
                  styles.modalOption,
                  sortBy === option.key && styles.modalOptionSelected,
                ]}
                onPress={() => {
                  setSortBy(option.key);
                  setSortModalVisible(false);
                }}
              >
                <Text style={styles.optionIcon}>{option.icon}</Text>
                <Text
                  style={[
                    styles.optionLabel,
                    sortBy === option.key && styles.optionLabelSelected,
                  ]}
                >
                  {option.label}
                </Text>
                {sortBy === option.key && (
                  <Check size={18} color={colors.primary} style={{ marginLeft: 'auto' }} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Filter Modal */}
      <Modal
        visible={filterModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setFilterModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filtrar Produtos</Text>
              <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.filterSectionTitle}>Status de Disponibilidade</Text>
            {FILTER_PRESETS.map((option) => (
              <TouchableOpacity
                key={option.key}
                style={[
                  styles.modalOption,
                  filterType === option.key && styles.modalOptionSelected,
                ]}
                onPress={() => {
                  setFilterType(option.key);
                }}
              >
                <Text
                  style={[
                    styles.optionLabel,
                    filterType === option.key && styles.optionLabelSelected,
                  ]}
                >
                  {option.label}
                </Text>
                {filterType === option.key && (
                  <Check size={18} color={colors.primary} style={{ marginLeft: 'auto' }} />
                )}
              </TouchableOpacity>
            ))}

            {distinctCategories.length > 0 && (
              <>
                <Text style={[styles.filterSectionTitle, { marginTop: spacing.md }]}>
                  Categorias
                </Text>
                <TouchableOpacity
                  style={[
                    styles.modalOption,
                    selectedCategory === 'all' && styles.modalOptionSelected,
                  ]}
                  onPress={() => setSelectedCategory('all')}
                >
                  <Text
                    style={[
                      styles.optionLabel,
                      selectedCategory === 'all' && styles.optionLabelSelected,
                    ]}
                  >
                    Todas as Categorias
                  </Text>
                  {selectedCategory === 'all' && (
                    <Check size={18} color={colors.primary} style={{ marginLeft: 'auto' }} />
                  )}
                </TouchableOpacity>
                {distinctCategories.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.modalOption,
                      selectedCategory === cat && styles.modalOptionSelected,
                    ]}
                    onPress={() => setSelectedCategory(cat)}
                  >
                    <Text
                      style={[
                        styles.optionLabel,
                        selectedCategory === cat && styles.optionLabelSelected,
                      ]}
                    >
                      {cat}
                    </Text>
                    {selectedCategory === cat && (
                      <Check size={18} color={colors.primary} style={{ marginLeft: 'auto' }} />
                    )}
                  </TouchableOpacity>
                ))}
              </>
            )}

            <View style={styles.modalButtonsRow}>
              <Button
                title="Limpar"
                variant="outline"
                onPress={() => {
                  setFilterType('all');
                  setSelectedCategory('all');
                  setFilterModalVisible(false);
                }}
                style={{ flex: 1, marginRight: spacing.sm }}
              />
              <Button
                title="Aplicar"
                onPress={() => setFilterModalVisible(false)}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </TouchableOpacity>
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
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
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
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  headerTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  countBadge: {
    backgroundColor: `${colors.primary}15`,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  countBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.primary,
  },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.md,
    gap: 4,
  },
  newButtonText: {
    color: '#ffffff',
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
  searchRow: {
    marginBottom: spacing.sm,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    height: 42,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: typography.sizes.sm,
    paddingVertical: 0,
  },
  clearSearch: {
    padding: 4,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  viewModeToggle: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 2,
  },
  viewModeBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  viewModeBtnActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  controlBtn: {
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
  controlBtnActive: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}10`,
  },
  controlBtnText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.primaryDark,
  },
  controlBtnTextActive: {
    color: colors.primary,
  },
  categoryPillsWrapper: {
    marginTop: spacing.xs,
    marginBottom: 4,
  },
  categoryPillsList: {
    gap: spacing.xs,
    paddingVertical: 4,
  },
  categoryPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryPillActive: {
    backgroundColor: colors.primaryDark,
    borderColor: colors.primaryDark,
  },
  categoryPillText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
  },
  categoryPillTextActive: {
    color: '#ffffff',
    fontWeight: typography.weights.bold,
  },
  listContainer: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardItemTouch: {
    marginBottom: spacing.xs,
  },
  cardItem: {
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  imageAndTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  productAvatar: {
    width: 52,
    height: 52,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    marginRight: spacing.md,
  },
  productAvatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: borderRadius.md,
    backgroundColor: `${colors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  productInfo: {
    flex: 1,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  categoryBadge: {
    backgroundColor: colors.surface,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: typography.weights.semibold,
    color: colors.primaryDark,
    textTransform: 'uppercase',
  },
  goalMiniBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${colors.caramel}15`,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    gap: 3,
  },
  goalMiniBadgeText: {
    fontSize: 10,
    fontWeight: typography.weights.semibold,
    color: colors.caramel,
  },
  productName: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  flavorsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: spacing.sm,
  },
  flavorTag: {
    backgroundColor: '#f7f1e9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: '#e8dcce',
  },
  flavorTagText: {
    fontSize: 11,
    color: colors.primaryDark,
    fontWeight: typography.weights.medium,
  },
  moreFlavorsText: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: typography.weights.semibold,
    paddingHorizontal: 4,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  priceLabel: {
    fontSize: 10,
    color: colors.textMuted,
    textTransform: 'uppercase',
    fontWeight: typography.weights.semibold,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  priceValue: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  unitText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
  marginBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    gap: 4,
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
  marginBadgeText: {
    fontSize: 11,
    fontWeight: typography.weights.bold,
  },
  costBadge: {
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  costBadgeText: {
    fontSize: 11,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
  },
  availabilityWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  availabilityLabel: {
    fontSize: 11,
    fontWeight: typography.weights.semibold,
  },
  cardSalesStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingTop: spacing.xs + 2,
    borderTopWidth: 1,
    borderTopColor: '#f1ebe3',
  },
  salesStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  salesStatText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },

  // List View Styles
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  listAvatar: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surface,
    marginRight: spacing.md,
  },
  listAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.sm,
    backgroundColor: `${colors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  listContent: {
    flex: 1,
    marginRight: spacing.sm,
  },
  listHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  listName: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.text,
    flex: 1,
    marginRight: spacing.sm,
  },
  listPrice: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  listSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  listCategory: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },
  listMarginText: {
    fontSize: 11,
    color: colors.success,
    fontWeight: typography.weights.semibold,
  },
  listSoldText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  listRightCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
  },
  modalOptionSelected: {
    backgroundColor: `${colors.primary}12`,
  },
  optionIcon: {
    fontSize: 18,
    marginRight: spacing.md,
  },
  optionLabel: {
    fontSize: typography.sizes.sm,
    color: colors.text,
    fontWeight: typography.weights.medium,
  },
  optionLabelSelected: {
    color: colors.primaryDark,
    fontWeight: typography.weights.bold,
  },
  filterSectionTitle: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    marginTop: spacing.lg,
  },
});
