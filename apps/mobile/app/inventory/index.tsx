import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  TextInput,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Boxes,
  Plus,
  ShoppingCart,
  Search,
  X,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  ChevronRight,
  Sparkles,
} from 'lucide-react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../src/services/api';
import { InventoryItem, InventorySummary, ShoppingListResponse, EntitlementsResponse } from '@koki/types';
import { colors, borderRadius, spacing } from '../../src/theme';
import { formatCurrency } from '../../src/utils/formatters';
import { Header, Badge, LoadingState, EmptyState } from '../../src/components/ui';
import { StockMovementModal } from '../../src/components/inventory/StockMovementModal';
import { ShoppingListModal } from '../../src/components/inventory/ShoppingListModal';
import { PlansModal } from '../../src/components/PlansModal';

export default function InventoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [onlyLowStock, setOnlyLowStock] = useState(false);

  // Modals state
  const [movementModalVisible, setMovementModalVisible] = useState(false);
  const [selectedItemForMovement, setSelectedItemForMovement] = useState<InventoryItem | null>(null);
  const [movementInitialType, setMovementInitialType] = useState<'in' | 'out' | 'adjustment'>('in');
  const [shoppingListModalVisible, setShoppingListModalVisible] = useState(false);
  const [plansModalVisible, setPlansModalVisible] = useState(false);

  // Queries
  const {
    data: itemsData,
    isLoading: isItemsLoading,
    isRefetching,
    refetch: refetchItems,
  } = useQuery<{ items: InventoryItem[]; total: number }>({
    queryKey: ['inventory-items', selectedCategory, onlyLowStock, search],
    queryFn: () => {
      const params = new URLSearchParams();
      if (selectedCategory !== 'all') params.append('category', selectedCategory);
      if (onlyLowStock) params.append('lowStock', 'true');
      if (search.trim()) params.append('search', search.trim());
      const qs = params.toString();
      return api.get<{ items: InventoryItem[]; total: number }>(`/inventory${qs ? `?${qs}` : ''}`);
    },
  });

  const { data: summaryData, refetch: refetchSummary } = useQuery<InventorySummary>({
    queryKey: ['inventory-summary'],
    queryFn: () => api.get<InventorySummary>('/inventory/summary'),
  });

  const { data: shoppingListData, refetch: refetchShoppingList } = useQuery<ShoppingListResponse>({
    queryKey: ['inventory-shopping-list'],
    queryFn: () => api.get<ShoppingListResponse>('/inventory/shopping-list'),
  });

  const { data: categories = [] } = useQuery<string[]>({
    queryKey: ['inventory-categories'],
    queryFn: () => api.get<string[]>('/inventory/categories'),
  });

  const { data: entitlements } = useQuery<EntitlementsResponse>({
    queryKey: ['company-entitlements'],
    queryFn: () => api.get<EntitlementsResponse>('/entitlements/features'),
  });

  const items = itemsData?.items || [];
  const lowStockCount = summaryData?.lowStockCount || shoppingListData?.lowStockItemsCount || 0;
  const totalStockValueCents = summaryData?.totalStockValueCents || 0;
  const totalItems = summaryData?.totalItems || items.length;

  const inventoryLimit = entitlements?.limits?.inventoryItemsLimit ?? 20;
  const isNearLimit = inventoryLimit !== -1 && totalItems >= inventoryLimit;

  const handleRefreshAll = async () => {
    await Promise.all([
      refetchItems(),
      refetchSummary(),
      refetchShoppingList(),
    ]);
  };

  const handleOpenMovement = (item: InventoryItem, type: 'in' | 'out') => {
    setSelectedItemForMovement(item);
    setMovementInitialType(type);
    setMovementModalVisible(true);
  };

  const handleQuickRestockFromList = (item: InventoryItem, suggestedQty: number) => {
    setShoppingListModalVisible(false);
    setSelectedItemForMovement(item);
    setMovementInitialType('in');
    setMovementModalVisible(true);
  };

  const handleMovementSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
    queryClient.invalidateQueries({ queryKey: ['inventory-summary'] });
    queryClient.invalidateQueries({ queryKey: ['inventory-shopping-list'] });
  };

  const handleNewItemPress = () => {
    if (isNearLimit && !entitlements?.isPro) {
      setPlansModalVisible(true);
      return;
    }
    router.push('/inventory/new' as any);
  };

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 20) + 8 }]}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.title}>Estoque & Insumos</Text>
          <Text style={styles.subtitle}>
            {totalItems} {totalItems === 1 ? 'insumo cadastrado' : 'insumos cadastrados'}
            {inventoryLimit !== -1 ? ` (${totalItems}/${inventoryLimit})` : ''}
          </Text>
        </View>

        <View style={styles.headerActions}>
          {/* Shopping list button with counter badge */}
          <TouchableOpacity
            style={styles.headerIconBtn}
            activeOpacity={0.8}
            onPress={() => router.push('/shopping-list' as any)}
          >
            <ShoppingCart size={20} color={colors.primary} />
            {lowStockCount > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{lowStockCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* New item button */}
          <TouchableOpacity
            style={styles.newItemBtn}
            activeOpacity={0.85}
            onPress={handleNewItemPress}
          >
            <Plus size={16} color="#ffffff" strokeWidth={2.4} />
            <Text style={styles.newItemBtnText}>Novo</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Summary KPI Cards */}
      <View style={styles.kpiContainer}>
        {/* Total Stock Value */}
        <View style={[styles.kpiCard, { flex: 1.2 }]}>
          <Text style={styles.kpiLabel}>Valor em Estoque</Text>
          <Text style={styles.kpiValue} numberOfLines={1}>
            {formatCurrency(totalStockValueCents)}
          </Text>
          <Text style={styles.kpiHint}>Patrimônio de matérias-primas</Text>
        </View>

        {/* Low Stock Alert */}
        <TouchableOpacity
          style={[
            styles.kpiCard,
            { flex: 1 },
            lowStockCount > 0 && styles.kpiCardAlert,
          ]}
          activeOpacity={0.8}
          onPress={() => {
            setOnlyLowStock(!onlyLowStock);
          }}
        >
          <View style={styles.kpiHeaderRow}>
            <Text style={styles.kpiLabel}>Reposição</Text>
            {lowStockCount > 0 && (
              <AlertTriangle size={14} color={colors.danger} />
            )}
          </View>
          <Text
            style={[
              styles.kpiValue,
              lowStockCount > 0 && { color: colors.danger },
            ]}
          >
            {lowStockCount} {lowStockCount === 1 ? 'item' : 'itens'}
          </Text>
          <Text style={styles.kpiHint}>
            {onlyLowStock ? 'Filtro ativo' : 'Abaixo do mínimo'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Search size={18} color={colors.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por nome, marca ou fornecedor..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <X size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Category and Filter Chips */}
      <View style={styles.chipsWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsContainer}
        >
          {/* All */}
          <TouchableOpacity
            style={[
              styles.chip,
              selectedCategory === 'all' && !onlyLowStock && styles.chipActive,
            ]}
            onPress={() => {
              setSelectedCategory('all');
              setOnlyLowStock(false);
            }}
          >
            <Text
              style={[
                styles.chipText,
                selectedCategory === 'all' && !onlyLowStock && styles.chipTextActive,
              ]}
            >
              Todos
            </Text>
          </TouchableOpacity>

          {/* Low Stock Only */}
          <TouchableOpacity
            style={[styles.chip, onlyLowStock && styles.chipDangerActive]}
            onPress={() => setOnlyLowStock(!onlyLowStock)}
          >
            <AlertTriangle
              size={12}
              color={onlyLowStock ? '#ffffff' : colors.warning}
              style={{ marginRight: 4 }}
            />
            <Text
              style={[
                styles.chipText,
                onlyLowStock && styles.chipTextActive,
              ]}
            >
              Repor Urgente ({lowStockCount})
            </Text>
          </TouchableOpacity>

          {/* Categories */}
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat && !onlyLowStock;
            return (
              <TouchableOpacity
                key={cat}
                style={[styles.chip, isSelected && styles.chipActive]}
                onPress={() => {
                  setSelectedCategory(cat);
                  setOnlyLowStock(false);
                }}
              >
                <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Main Items List */}
      {isItemsLoading ? (
        <LoadingState message="Carregando estoque..." />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={handleRefreshAll}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon={<Boxes size={46} color={colors.caramel} />}
              title="Nenhum insumo encontrado"
              description={
                search || onlyLowStock || selectedCategory !== 'all'
                  ? 'Tente ajustar os filtros ou o termo de busca.'
                  : 'Cadastre ingredientes, embalagens e fitas para ter o controle total de custos e compras.'
              }
              actionTitle={
                search || onlyLowStock || selectedCategory !== 'all'
                  ? 'Limpar Filtros'
                  : 'Cadastrar Insumo'
              }
              onAction={
                search || onlyLowStock || selectedCategory !== 'all'
                  ? () => {
                      setSearch('');
                      setSelectedCategory('all');
                      setOnlyLowStock(false);
                    }
                  : handleNewItemPress
              }
            />
          }
          renderItem={({ item }) => {
            const isOutOfStock = (item.currentStock || 0) <= 0;
            const isLow = (item.currentStock || 0) <= (item.minStock || 0);

            // Stock percentage relative to 2x min stock
            const maxRef = Math.max(item.minStock * 2, item.minStock + 1, 1);
            const percent = Math.min(100, Math.round(((item.currentStock || 0) / maxRef) * 100));

            return (
              <TouchableOpacity
                style={styles.itemCard}
                activeOpacity={0.88}
                onPress={() => router.push(`/inventory/${item.id}` as any)}
              >
                {/* Top Info */}
                <View style={styles.itemHeader}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.itemName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.itemSubtext}>
                      {item.brand ? `${item.brand} • ` : ''}
                      {item.category}
                      {item.location ? ` • ${item.location}` : ''}
                    </Text>
                  </View>

                  {isOutOfStock ? (
                    <Badge label="Esgotado" color={colors.danger} />
                  ) : isLow ? (
                    <Badge label="Repor" color={colors.warning} />
                  ) : (
                    <Badge label="Em dia" color={colors.success} />
                  )}
                </View>

                {/* Stock Progress Bar */}
                <View style={styles.progressContainer}>
                  <View style={styles.progressBarBg}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${Math.max(4, percent)}%`,
                          backgroundColor: isOutOfStock
                            ? colors.danger
                            : isLow
                            ? colors.warning
                            : colors.success,
                        },
                      ]}
                    />
                  </View>
                </View>

                {/* Numbers and Quick Actions Row */}
                <View style={styles.itemFooter}>
                  <View style={styles.itemStockCol}>
                    <Text style={styles.itemStockValue}>
                      {item.currentStock?.toLocaleString('pt-PT')} {item.unit}
                    </Text>
                    <Text style={styles.itemMinStock}>
                      Mín: {item.minStock?.toLocaleString('pt-PT')} {item.unit}
                      {item.unitCostCents > 0
                        ? ` • ${(item.unitCostCents / 100 < 0.01 ? (item.unitCostCents / 100).toFixed(4) : (item.unitCostCents / 100).toFixed(2)).replace('.', ',')} €/${item.unit}`
                        : ''}
                    </Text>
                  </View>

                  <View style={styles.itemActionButtons}>
                    {/* Entry Button */}
                    <TouchableOpacity
                      style={[styles.quickActionBtn, styles.quickActionIn]}
                      activeOpacity={0.75}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleOpenMovement(item, 'in');
                      }}
                    >
                      <ArrowDownRight size={14} color={colors.success} />
                      <Text style={[styles.quickActionText, { color: colors.success }]}>
                        Entrada
                      </Text>
                    </TouchableOpacity>

                    {/* Exit Button */}
                    <TouchableOpacity
                      style={[styles.quickActionBtn, styles.quickActionOut]}
                      activeOpacity={0.75}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleOpenMovement(item, 'out');
                      }}
                    >
                      <ArrowUpRight size={14} color={colors.danger} />
                      <Text style={[styles.quickActionText, { color: colors.danger }]}>
                        Saída
                      </Text>
                    </TouchableOpacity>

                    <ChevronRight size={16} color={colors.border} style={{ marginLeft: 2 }} />
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Movement Modal */}
      <StockMovementModal
        visible={movementModalVisible}
        item={selectedItemForMovement}
        initialType={movementInitialType}
        onClose={() => {
          setMovementModalVisible(false);
          setSelectedItemForMovement(null);
        }}
        onSuccess={handleMovementSuccess}
      />

      {/* Shopping List Modal */}
      <ShoppingListModal
        visible={shoppingListModalVisible}
        onClose={() => setShoppingListModalVisible(false)}
        onQuickRestock={handleQuickRestockFromList}
      />

      {/* Plan Limits Upgrade Modal */}
      <PlansModal
        visible={plansModalVisible}
        onClose={() => setPlansModalVisible(false)}
      />
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
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTitleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.primaryDark,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: colors.danger,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  cartBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  newItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: borderRadius.md,
  },
  newItemBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  kpiContainer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  kpiCard: {
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: 14,
  },
  kpiCardAlert: {
    borderColor: '#f7c2be',
    backgroundColor: '#fff9f9',
  },
  kpiHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kpiLabel: {
    fontSize: 11,
    color: colors.textMuted,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primaryDark,
    marginTop: 4,
  },
  kpiHint: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.primaryDark,
    paddingVertical: 0,
  },
  chipsWrapper: {
    marginBottom: 12,
  },
  chipsContainer: {
    paddingHorizontal: 20,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: borderRadius.full,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipDangerActive: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },
  chipText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#ffffff',
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 10,
  },
  itemCard: {
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: 14,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  itemName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  itemSubtext: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  progressContainer: {
    marginTop: 10,
    marginBottom: 10,
  },
  progressBarBg: {
    height: 5,
    backgroundColor: colors.surface,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  itemFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemStockCol: {
    flex: 1,
  },
  itemStockValue: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  itemMinStock: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },
  itemActionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quickActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  quickActionIn: {
    backgroundColor: '#eaf8ef',
    borderColor: '#b6e6c4',
  },
  quickActionOut: {
    backgroundColor: '#fdeeee',
    borderColor: '#f7c2be',
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: '700',
  },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: borderRadius.md,
    marginTop: 14,
  },
  emptyActionBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});
