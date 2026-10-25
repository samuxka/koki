import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Share,
  Modal,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShoppingCart,
  Plus,
  Search,
  Check,
  Share2,
  Trash2,
  ChevronLeft,
  PackageCheck,
  AlertTriangle,
  Minus,
  X,
  RotateCcw,
  Boxes,
  Sparkles,
} from 'lucide-react-native';
import { api } from '../../src/services/api';
import { colors, spacing, typography, borderRadius } from '../../src/theme';
import { formatCurrency } from '../../src/utils/formatters';
import {
  ShoppingListItem,
  ShoppingListResponse,
  InventoryItem,
} from '@koki/types';
import { Badge, LoadingState, EmptyState, ProgressBar, CurrencyInput } from '../../src/components/ui';
import { useAlertStore } from '../../src/stores/alert.store';

type FilterTab = 'all' | 'pending' | 'purchased';

const CATEGORY_CHIPS = [
  'Todas',
  'Farinhas & Secos',
  'Laticínios & Ovos',
  'Chocolates & Doces',
  'Açúcares & Adoçantes',
  'Gorduras & Óleos',
  'Embalagens & Descartáveis',
  'Decoração & Confeitos',
  'Limpeza & Utensílios',
  'Geral',
];

export default function ShoppingListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { showAlert } = useAlertStore();

  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [addModalVisible, setAddModalVisible] = useState<boolean>(false);

  // Add Item Modal state
  const [modalMode, setModalMode] = useState<'inventory' | 'custom'>('inventory');
  const [inventorySearch, setInventorySearch] = useState<string>('');
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<InventoryItem | null>(null);
  const [addQty, setAddQty] = useState<string>('1');
  const [customName, setCustomName] = useState<string>('');
  const [customCategory, setCustomCategory] = useState<string>('Geral');
  const [customUnit, setCustomUnit] = useState<string>('un');
  const [customCostCents, setCustomCostCents] = useState<number>(0);
  const [customNotes, setCustomNotes] = useState<string>('');

  // 1. Fetch Shopping List
  const {
    data: shoppingData,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery<ShoppingListResponse>({
    queryKey: ['shopping-list'],
    queryFn: () => api.get<ShoppingListResponse>('/inventory/shopping-list'),
  });

  // 2. Fetch Inventory Items for the "Add from Inventory" tab
  const { data: inventoryCatalog } = useQuery<{ items: InventoryItem[] }>({
    queryKey: ['inventory-all-items'],
    queryFn: () => api.get<{ items: InventoryItem[] }>('/inventory?limit=200'),
    enabled: addModalVisible && modalMode === 'inventory',
  });

  // Mutations
  const toggleMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/inventory/shopping-list/${id}/toggle`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopping-list'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-shopping-list'] });
    },
    onError: (err: any) => {
      showAlert({
        type: 'danger',
        title: 'Erro ao atualizar',
        message: err.message || 'Não foi possível alterar o status do item.',
        buttons: [{ text: 'OK' }],
      });
    },
  });

  const updateQtyMutation = useMutation({
    mutationFn: ({ id, quantity, estimatedCostCents }: { id: string; quantity: number; estimatedCostCents?: number }) =>
      api.patch(`/inventory/shopping-list/${id}`, { quantity, estimatedCostCents }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopping-list'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-shopping-list'] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/inventory/shopping-list/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopping-list'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-shopping-list'] });
    },
    onError: (err: any) => {
      showAlert({
        type: 'danger',
        title: 'Erro ao remover',
        message: err.message || 'Não foi possível remover o item da lista.',
        buttons: [{ text: 'OK' }],
      });
    },
  });

  const addMutation = useMutation({
    mutationFn: (payload: any) => api.post('/inventory/shopping-list', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopping-list'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-shopping-list'] });
      resetAddModal();
      setAddModalVisible(false);
      showAlert({
        type: 'success',
        title: 'Item Adicionado',
        message: 'O item foi inserido na sua lista de compras.',
        buttons: [{ text: 'OK' }],
      });
    },
    onError: (err: any) => {
      showAlert({
        type: 'danger',
        title: 'Erro ao adicionar',
        message: err.message || 'Não foi possível adicionar o item.',
        buttons: [{ text: 'OK' }],
      });
    },
  });

  const restockMutation = useMutation({
    mutationFn: () => api.post('/inventory/shopping-list/restock-purchased', {}),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['shopping-list'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-shopping-list'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-summary'] });
      showAlert({
        type: 'success',
        title: 'Estoque Atualizado! 🎉',
        message: `${res.restockedCount || 0} insumos comprados tiveram sua entrada registrada no estoque automaticamente.`,
        buttons: [{ text: 'Excelente!' }],
      });
    },
    onError: (err: any) => {
      showAlert({
        type: 'danger',
        title: 'Erro ao atualizar estoque',
        message: err.message || 'Ocorreu uma falha ao dar entrada nos itens.',
        buttons: [{ text: 'OK' }],
      });
    },
  });

  const clearPurchasedMutation = useMutation({
    mutationFn: () => api.post('/inventory/shopping-list/clear-purchased', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopping-list'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-shopping-list'] });
    },
  });

  const rawItems = shoppingData?.items || [];
  const totalEstimatedCostCents = shoppingData?.totalEstimatedCostCents || 0;

  // Filtered Items
  const filteredItems = useMemo(() => {
    return rawItems.filter((entry) => {
      // Tab filter
      if (activeTab === 'pending' && entry.isPurchased) return false;
      if (activeTab === 'purchased' && !entry.isPurchased) return false;

      // Category filter
      if (selectedCategory !== 'Todas') {
        const cat = entry.category || entry.item?.category || 'Geral';
        if (cat.toLowerCase() !== selectedCategory.toLowerCase()) {
          return false;
        }
      }

      // Search query
      if (searchQuery.trim().length > 0) {
        const query = searchQuery.toLowerCase().trim();
        const name = (entry.name || entry.item?.name || '').toLowerCase();
        const cat = (entry.category || entry.item?.category || '').toLowerCase();
        if (!name.includes(query) && !cat.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [rawItems, activeTab, selectedCategory, searchQuery]);

  // Metrics
  const totalCount = rawItems.length;
  const purchasedCount = rawItems.filter((i) => i.isPurchased).length;
  const pendingCount = totalCount - purchasedCount;
  const progressPercent = totalCount > 0 ? Math.round((purchasedCount / totalCount) * 100) : 0;

  // Handlers
  const handleToggleItem = (entry: ShoppingListItem) => {
    const id = entry.id || (entry.item?.id ? `inv_${entry.item.id}` : '');
    if (!id) return;
    toggleMutation.mutate(id);
  };

  const handleQtyChange = (entry: ShoppingListItem, delta: number) => {
    const id = entry.id || (entry.item?.id ? `inv_${entry.item.id}` : '');
    if (!id) return;
    const currentQty = entry.suggestedBuyQuantity || 1;
    const newQty = Math.max(1, currentQty + delta);
    const unitCost = entry.item?.unitCostCents || 0;
    const newCost = Math.round(newQty * unitCost);
    updateQtyMutation.mutate({ id, quantity: newQty, estimatedCostCents: newCost });
  };

  const handleDeleteItem = (entry: ShoppingListItem) => {
    const id = entry.id || (entry.item?.id ? `inv_${entry.item.id}` : '');
    if (!id) return;

    showAlert({
      type: 'confirm',
      title: 'Remover da Lista',
      message: `Deseja remover "${entry.name || entry.item?.name}" da lista de compras?`,
      buttons: [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: () => removeMutation.mutate(id),
        },
      ],
    });
  };

  const handleShareList = async () => {
    if (rawItems.length === 0) {
      showAlert({
        type: 'info',
        title: 'Lista Vazia',
        message: 'Adicione itens à lista de compras antes de compartilhar.',
        buttons: [{ text: 'OK' }],
      });
      return;
    }

    try {
      const today = new Date().toLocaleDateString('pt-PT');
      let text = `🛒 *Lista de Compras Koki*\n📅 ${today}\n\n`;

      const pending = rawItems.filter((i) => !i.isPurchased);
      const purchased = rawItems.filter((i) => i.isPurchased);

      if (pending.length > 0) {
        text += `*A COMPRAR (${pending.length}):*\n`;
        pending.forEach((entry, idx) => {
          const name = entry.name || entry.item?.name;
          const qty = entry.suggestedBuyQuantity;
          const unit = entry.unit || entry.item?.unit || 'un';
          const cost = entry.estimatedCostCents > 0 ? ` (~ ${formatCurrency(entry.estimatedCostCents)})` : '';
          text += `⬜ ${idx + 1}. *${name}*: ${qty} ${unit}${cost}\n`;
          if (entry.notes) {
            text += `   ↳ Obs: ${entry.notes}\n`;
          }
        });
      }

      if (purchased.length > 0) {
        text += `\n*JÁ COMPRADOS (${purchased.length}):*\n`;
        purchased.forEach((entry) => {
          const name = entry.name || entry.item?.name;
          const qty = entry.suggestedBuyQuantity;
          const unit = entry.unit || entry.item?.unit || 'un';
          text += `✅ ~${name}~ (${qty} ${unit})\n`;
        });
      }

      if (totalEstimatedCostCents > 0) {
        text += `\n💰 *Total Estimado:* ${formatCurrency(totalEstimatedCostCents)}`;
      }

      await Share.share({
        message: text,
      });
    } catch (err: any) {
      showAlert({
        type: 'danger',
        title: 'Erro ao compartilhar',
        message: err.message || 'Não foi possível compartilhar a lista.',
        buttons: [{ text: 'OK' }],
      });
    }
  };

  const handleRestockPurchased = () => {
    const purchasedWithStock = rawItems.filter((i) => i.isPurchased && (i.inventoryItemId || i.item?.id));
    if (purchasedWithStock.length === 0) {
      showAlert({
        type: 'info',
        title: 'Nenhum insumo do estoque comprado',
        message: 'Marque como comprados os insumos cadastrados no estoque para atualizar a quantidade automaticamente.',
        buttons: [{ text: 'OK' }],
      });
      return;
    }

    showAlert({
      type: 'confirm',
      title: 'Dar Entrada no Estoque?',
      message: `Deseja registrar a entrada de ${purchasedWithStock.length} ${
        purchasedWithStock.length === 1 ? 'insumo comprado' : 'insumos comprados'
      } no estoque? O saldo atual de cada um será incrementado automaticamente.`,
      buttons: [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Atualizar Estoque',
          style: 'default',
          onPress: () => restockMutation.mutate(),
        },
      ],
    });
  };

  const handleClearPurchased = () => {
    showAlert({
      type: 'confirm',
      title: 'Limpar Comprados',
      message: 'Deseja remover todos os itens já marcados como comprados da lista?',
      buttons: [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Limpar',
          style: 'destructive',
          onPress: () => clearPurchasedMutation.mutate(),
        },
      ],
    });
  };

  const resetAddModal = () => {
    setSelectedInventoryItem(null);
    setAddQty('1');
    setCustomName('');
    setCustomCategory('Geral');
    setCustomUnit('un');
    setCustomCostCents(0);
    setCustomNotes('');
    setInventorySearch('');
  };

  const handleSaveAddModal = () => {
    if (modalMode === 'inventory') {
      if (!selectedInventoryItem) {
        showAlert({
          type: 'warning',
          title: 'Selecione um insumo',
          message: 'Escolha um insumo do estoque para adicionar à lista.',
          buttons: [{ text: 'OK' }],
        });
        return;
      }

      const qty = parseFloat(addQty.replace(',', '.')) || 1;
      const unitCost = selectedInventoryItem.unitCostCents || 0;
      const estimatedCostCents = Math.round(qty * unitCost);

      addMutation.mutate({
        name: selectedInventoryItem.name,
        category: selectedInventoryItem.category,
        unit: selectedInventoryItem.unit,
        quantity: qty,
        estimatedCostCents,
        inventoryItemId: selectedInventoryItem.id,
        notes: customNotes.trim() || undefined,
      });
    } else {
      if (!customName.trim()) {
        showAlert({
          type: 'warning',
          title: 'Nome obrigatório',
          message: 'Digite o nome do produto ou item a comprar.',
          buttons: [{ text: 'OK' }],
        });
        return;
      }

      const qty = parseFloat(addQty.replace(',', '.')) || 1;

      addMutation.mutate({
        name: customName.trim(),
        category: customCategory.trim() || 'Geral',
        unit: customUnit.trim() || 'un',
        quantity: qty,
        estimatedCostCents: customCostCents,
        notes: customNotes.trim() || undefined,
      });
    }
  };

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 20) + 8 }]}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backBtn}
            activeOpacity={0.7}
            onPress={() => router.back()}
          >
            <ChevronLeft size={24} color={colors.primary} />
          </TouchableOpacity>
          <View>
            <Text style={styles.title}>Lista de Compras</Text>
            <Text style={styles.subtitle}>
              {pendingCount === 0
                ? 'Tudo comprado! 🛒'
                : `${pendingCount} ${pendingCount === 1 ? 'item pendente' : 'itens pendentes'}`}
            </Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            activeOpacity={0.7}
            onPress={handleShareList}
          >
            <Share2 size={20} color={colors.primary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.addItemBtn}
            activeOpacity={0.85}
            onPress={() => {
              resetAddModal();
              setAddModalVisible(true);
            }}
          >
            <Plus size={16} color="#ffffff" strokeWidth={2.4} />
            <Text style={styles.addItemBtnText}>Item</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* KPI Cards Row */}
      <View style={styles.kpiContainer}>
        {/* Card 1: A Comprar */}
        <View style={[styles.kpiCard, { flex: 1 }]}>
          <Text style={styles.kpiLabel}>A Comprar</Text>
          <Text style={styles.kpiValue}>{pendingCount}</Text>
          <Text style={styles.kpiHint}>
            {purchasedCount > 0 ? `${purchasedCount} no carrinho` : 'Nenhum comprado'}
          </Text>
        </View>

        {/* Card 2: Custo Estimado */}
        <View style={[styles.kpiCard, { flex: 1.3 }]}>
          <Text style={styles.kpiLabel}>Total Estimado</Text>
          <Text style={[styles.kpiValue, { color: colors.primary }]} numberOfLines={1}>
            {formatCurrency(totalEstimatedCostCents)}
          </Text>
          <Text style={styles.kpiHint}>Previsão de gasto</Text>
        </View>

        {/* Card 3: Progresso */}
        <View style={[styles.kpiCard, { flex: 1.1 }]}>
          <Text style={styles.kpiLabel}>Progresso</Text>
          <Text style={[styles.kpiValue, { color: progressPercent === 100 && totalCount > 0 ? colors.success : colors.caramel }]}>
            {progressPercent}%
          </Text>
          <View style={{ marginTop: 4 }}>
            <ProgressBar
              progress={progressPercent}
              color={progressPercent === 100 ? colors.success : colors.caramel}
              height={6}
            />
          </View>
        </View>
      </View>

      {/* Action Banner: Se houver itens comprados para dar baixa */}
      {purchasedCount > 0 && (
        <View style={styles.restockBanner}>
          <View style={styles.restockBannerLeft}>
            <View style={styles.restockIconCircle}>
              <PackageCheck size={18} color="#ffffff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.restockBannerTitle}>
                {purchasedCount} {purchasedCount === 1 ? 'item no carrinho' : 'itens no carrinho'}
              </Text>
              <Text style={styles.restockBannerSub}>
                Deseja abastecer o estoque com as compras feitas?
              </Text>
            </View>
          </View>

          <View style={styles.restockActionsRow}>
            <TouchableOpacity
              style={styles.restockBtn}
              activeOpacity={0.85}
              onPress={handleRestockPurchased}
              disabled={restockMutation.isPending}
            >
              <Text style={styles.restockBtnText}>
                {restockMutation.isPending ? 'Abastecendo...' : 'Dar Entrada no Estoque'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.clearBtn}
              activeOpacity={0.7}
              onPress={handleClearPurchased}
            >
              <Text style={styles.clearBtnText}>Limpar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Search size={18} color={colors.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por produto, insumo ou categoria..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Status Filter Tabs (Todos, A Comprar, Comprados) */}
      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'all' && styles.tabBtnActive]}
          activeOpacity={0.7}
          onPress={() => setActiveTab('all')}
        >
          <Text style={[styles.tabBtnText, activeTab === 'all' && styles.tabBtnTextActive]}>
            Todos ({totalCount})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'pending' && styles.tabBtnActive]}
          activeOpacity={0.7}
          onPress={() => setActiveTab('pending')}
        >
          <Text style={[styles.tabBtnText, activeTab === 'pending' && styles.tabBtnTextActive]}>
            A Comprar ({pendingCount})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'purchased' && styles.tabBtnActive]}
          activeOpacity={0.7}
          onPress={() => setActiveTab('purchased')}
        >
          <Text style={[styles.tabBtnText, activeTab === 'purchased' && styles.tabBtnTextActive]}>
            Comprados ({purchasedCount})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Category Filter Chips */}
      <View style={styles.categoryChipsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryChipsScroll}
        >
          {CATEGORY_CHIPS.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[styles.categoryChip, isSelected && styles.categoryChipActive]}
                activeOpacity={0.7}
                onPress={() => setSelectedCategory(cat)}
              >
                <Text
                  style={[styles.categoryChipText, isSelected && styles.categoryChipTextActive]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Items ScrollView */}
      {isLoading ? (
        <LoadingState message="Carregando lista de compras..." />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 80 },
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
        >
          {filteredItems.length === 0 ? (
            <EmptyState
              icon={<ShoppingCart size={40} color={colors.primary} />}
              title={
                searchQuery || selectedCategory !== 'Todas'
                  ? 'Nenhum item filtrado'
                  : 'Sua lista de compras está vazia'
              }
              description={
                searchQuery || selectedCategory !== 'Todas'
                  ? 'Não encontramos nenhum item correspondente aos filtros selecionados.'
                  : 'Nenhum insumo está em falta no momento! Toque em "+ Item" para adicionar ingredientes ou materiais avulsos para o mercado.'
              }
            />
          ) : (
            filteredItems.map((entry) => {
              const isPurchased = !!entry.isPurchased;
              const name = entry.name || entry.item?.name || 'Insumo';
              const category = entry.category || entry.item?.category || 'Geral';
              const unit = entry.unit || entry.item?.unit || 'un';
              const qty = entry.suggestedBuyQuantity || 1;
              const isLowStock = entry.source === 'low_stock';
              const currentStock = entry.item?.currentStock;
              const minStock = entry.item?.minStock;

              return (
                <View
                  key={entry.id || name}
                  style={[styles.itemCard, isPurchased && styles.itemCardPurchased]}
                >
                  {/* Left: Checkbox */}
                  <TouchableOpacity
                    style={[styles.checkbox, isPurchased && styles.checkboxPurchased]}
                    activeOpacity={0.8}
                    onPress={() => handleToggleItem(entry)}
                  >
                    {isPurchased && <Check size={14} color="#ffffff" strokeWidth={2.8} />}
                  </TouchableOpacity>

                  {/* Middle: Content */}
                  <View style={styles.itemCenter}>
                    <View style={styles.itemTitleRow}>
                      <Text
                        style={[styles.itemName, isPurchased && styles.itemNamePurchased]}
                        numberOfLines={2}
                      >
                        {name}
                      </Text>
                    </View>

                    {/* Badges Row */}
                    <View style={styles.itemBadgesRow}>
                      <Badge label={category} color={colors.primary} />
                      {isLowStock ? (
                        <View style={styles.lowStockBadge}>
                          <AlertTriangle size={11} color={colors.danger} />
                          <Text style={styles.lowStockBadgeText}>Estoque Baixo</Text>
                        </View>
                      ) : (
                        <Badge label="Avulso" color={colors.caramel} />
                      )}
                    </View>

                    {/* Stock Detail if from inventory */}
                    {isLowStock && currentStock !== undefined && minStock !== undefined && (
                      <Text style={styles.stockStatusText}>
                        Estoque atual: <Text style={{ fontWeight: '700' }}>{currentStock} {unit}</Text> | Mín: {minStock} {unit}
                      </Text>
                    )}

                    {/* Optional Notes */}
                    {entry.notes ? (
                      <Text style={styles.itemNotes} numberOfLines={1}>
                        ↳ {entry.notes}
                      </Text>
                    ) : null}

                    {/* Stepper & Estimated Cost */}
                    <View style={styles.itemFooterRow}>
                      <View style={styles.stepperContainer}>
                        <TouchableOpacity
                          style={styles.stepperBtn}
                          activeOpacity={0.6}
                          onPress={() => handleQtyChange(entry, -1)}
                        >
                          <Minus size={13} color={colors.text} />
                        </TouchableOpacity>

                        <Text style={styles.stepperValue}>
                          {qty} <Text style={styles.stepperUnit}>{unit}</Text>
                        </Text>

                        <TouchableOpacity
                          style={styles.stepperBtn}
                          activeOpacity={0.6}
                          onPress={() => handleQtyChange(entry, 1)}
                        >
                          <Plus size={13} color={colors.text} />
                        </TouchableOpacity>
                      </View>

                      {entry.estimatedCostCents > 0 && (
                        <Text style={styles.itemCostText}>
                          {formatCurrency(entry.estimatedCostCents)}
                        </Text>
                      )}
                    </View>
                  </View>

                  {/* Right Action: Delete */}
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    activeOpacity={0.7}
                    onPress={() => handleDeleteItem(entry)}
                  >
                    <Trash2 size={16} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Floating Bottom Button */}
      <View style={[styles.floatingBottom, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TouchableOpacity
          style={styles.floatingAddBtn}
          activeOpacity={0.85}
          onPress={() => {
            resetAddModal();
            setAddModalVisible(true);
          }}
        >
          <Plus size={18} color="#ffffff" strokeWidth={2.4} style={{ marginRight: 6 }} />
          <Text style={styles.floatingAddBtnText}>Adicionar Item à Lista</Text>
        </TouchableOpacity>
      </View>

      {/* MODAL: Adicionar Item à Lista */}
      <Modal
        visible={addModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAddModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Adicionar à Lista de Compras</Text>
                <Text style={styles.modalSub}>
                  {modalMode === 'inventory' ? 'Selecione um insumo do estoque' : 'Cadastre um produto ou material avulso'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setAddModalVisible(false)}
              >
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Mode Switch Tabs */}
            <View style={styles.modalTabsRow}>
              <TouchableOpacity
                style={[styles.modalTab, modalMode === 'inventory' && styles.modalTabActive]}
                activeOpacity={0.7}
                onPress={() => setModalMode('inventory')}
              >
                <Boxes size={16} color={modalMode === 'inventory' ? colors.primary : colors.textSecondary} style={{ marginRight: 6 }} />
                <Text style={[styles.modalTabText, modalMode === 'inventory' && styles.modalTabTextActive]}>
                  Do Estoque
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalTab, modalMode === 'custom' && styles.modalTabActive]}
                activeOpacity={0.7}
                onPress={() => setModalMode('custom')}
              >
                <Sparkles size={16} color={modalMode === 'custom' ? colors.primary : colors.textSecondary} style={{ marginRight: 6 }} />
                <Text style={[styles.modalTabText, modalMode === 'custom' && styles.modalTabTextActive]}>
                  Item Avulso
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
              {modalMode === 'inventory' ? (
                /* Aba: Do Estoque */
                <View style={styles.modalBody}>
                  {/* Search Inventory */}
                  <View style={styles.modalSearchBar}>
                    <Search size={16} color={colors.textSecondary} style={{ marginRight: 6 }} />
                    <TextInput
                      style={styles.modalSearchInput}
                      placeholder="Pesquisar insumo cadastrado..."
                      placeholderTextColor={colors.textMuted}
                      value={inventorySearch}
                      onChangeText={setInventorySearch}
                    />
                  </View>

                  {/* Inventory Picker List */}
                  <View style={styles.inventoryPickerList}>
                    {(inventoryCatalog?.items || [])
                      .filter((item) =>
                        inventorySearch.trim().length === 0
                          ? true
                          : item.name.toLowerCase().includes(inventorySearch.toLowerCase().trim())
                      )
                      .slice(0, 15)
                      .map((item) => {
                        const isSelected = selectedInventoryItem?.id === item.id;
                        return (
                          <TouchableOpacity
                            key={item.id}
                            style={[
                              styles.inventoryPickerItem,
                              isSelected && styles.inventoryPickerItemSelected,
                            ]}
                            activeOpacity={0.7}
                            onPress={() => {
                              setSelectedInventoryItem(item);
                              const target = item.idealStock && item.idealStock > item.minStock
                                ? item.idealStock
                                : Math.max(item.minStock * 2, item.minStock + 1);
                              const defaultBuy = Math.max(1, target - item.currentStock);
                              setAddQty(defaultBuy.toString());
                            }}
                          >
                            <View style={{ flex: 1 }}>
                              <Text
                                style={[
                                  styles.inventoryPickerItemName,
                                  isSelected && { color: colors.primary, fontWeight: '700' },
                                ]}
                              >
                                {item.name}
                              </Text>
                              <Text style={styles.inventoryPickerItemSub}>
                                Estoque atual: {item.currentStock} {item.unit} • {item.unitCostCents > 0 ? `${(item.unitCostCents / 100 < 0.01 ? (item.unitCostCents / 100).toFixed(4) : (item.unitCostCents / 100).toFixed(2)).replace('.', ',')} €/${item.unit}` : 'Sem custo'}
                              </Text>
                            </View>
                            {isSelected && <Check size={18} color={colors.primary} />}
                          </TouchableOpacity>
                        );
                      })}
                  </View>

                  {selectedInventoryItem && (
                    <View style={styles.selectedItemBox}>
                      <Text style={styles.selectedItemLabel}>Quantidade a comprar ({selectedInventoryItem.unit}):</Text>
                      <TextInput
                        style={styles.selectedItemInput}
                        keyboardType="numeric"
                        value={addQty}
                        onChangeText={setAddQty}
                        placeholder="1"
                      />
                    </View>
                  )}
                </View>
              ) : (
                /* Aba: Item Avulso */
                <View style={styles.modalBody}>
                  <Text style={styles.fieldLabel}>Nome do Produto ou Material *</Text>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="ex: Papel toalha, Forminhas nº 4, Fita cetim"
                    placeholderTextColor={colors.textMuted}
                    value={customName}
                    onChangeText={setCustomName}
                  />

                  <View style={styles.rowTwoCols}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={styles.fieldLabel}>Quantidade</Text>
                      <TextInput
                        style={styles.fieldInput}
                        keyboardType="numeric"
                        placeholder="1"
                        value={addQty}
                        onChangeText={setAddQty}
                      />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.fieldLabel}>Unidade</Text>
                      <TextInput
                        style={styles.fieldInput}
                        placeholder="un, pct, kg, l"
                        value={customUnit}
                        onChangeText={setCustomUnit}
                      />
                    </View>
                  </View>

                  <Text style={styles.fieldLabel}>Categoria</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                    {CATEGORY_CHIPS.filter((c) => c !== 'Todas').map((cat) => (
                      <TouchableOpacity
                        key={cat}
                        style={[styles.smallChip, customCategory === cat && styles.smallChipActive]}
                        onPress={() => setCustomCategory(cat)}
                      >
                        <Text style={[styles.smallChipText, customCategory === cat && styles.smallChipTextActive]}>
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  <Text style={styles.fieldLabel}>Custo Estimado (Opcional)</Text>
                  <CurrencyInput
                    cents={customCostCents}
                    onChangeCents={setCustomCostCents}
                  />

                  <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Observações / Marca</Text>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="ex: Marca específica, cor vermelha..."
                    placeholderTextColor={colors.textMuted}
                    value={customNotes}
                    onChangeText={setCustomNotes}
                  />
                </View>
              )}
            </ScrollView>

            {/* Modal Actions */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                activeOpacity={0.7}
                onPress={() => setAddModalVisible(false)}
              >
                <Text style={styles.modalCancelBtnText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalConfirmBtn}
                activeOpacity={0.85}
                onPress={handleSaveAddModal}
                disabled={addMutation.isPending}
              >
                <Text style={styles.modalConfirmBtnText}>
                  {addMutation.isPending ? 'Salvando...' : 'Adicionar à Lista'}
                </Text>
              </TouchableOpacity>
            </View>
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
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: borderRadius.md,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.primaryDark,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 13,
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
    borderRadius: borderRadius.md,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: borderRadius.md,
    gap: 4,
  },
  addItemBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  kpiContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    gap: 8,
    marginTop: 8,
    marginBottom: 10,
  },
  kpiCard: {
    backgroundColor: '#ffffff',
    padding: 10,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  kpiLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primaryDark,
    marginTop: 2,
  },
  kpiHint: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  restockBanner: {
    backgroundColor: '#eef8f0',
    marginHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: '#c6e8cf',
    marginBottom: 10,
  },
  restockBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  restockIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restockBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e5f32',
  },
  restockBannerSub: {
    fontSize: 12,
    color: '#3a7d4e',
    marginTop: 1,
  },
  restockActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
  },
  restockBtn: {
    backgroundColor: colors.success,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: borderRadius.sm,
  },
  restockBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  clearBtn: {
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  clearBtnText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  searchContainer: {
    paddingHorizontal: spacing.md,
    marginBottom: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.md,
    paddingHorizontal: 12,
    height: 42,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
  },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    gap: 8,
    marginBottom: 8,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabBtnTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  categoryChipsContainer: {
    marginBottom: 8,
  },
  categoryChipsScroll: {
    paddingHorizontal: spacing.md,
    gap: 6,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryChipActive: {
    backgroundColor: colors.goldenBeige,
    borderColor: colors.caramel,
  },
  categoryChipText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  categoryChipTextActive: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingTop: 4,
    gap: 8,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  itemCardPurchased: {
    backgroundColor: '#faf8f5',
    borderColor: '#e8dcce',
    opacity: 0.85,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    backgroundColor: '#ffffff',
  },
  checkboxPurchased: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  itemCenter: {
    flex: 1,
  },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  itemNamePurchased: {
    textDecorationLine: 'line-through',
    color: colors.textMuted,
  },
  itemBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    marginBottom: 4,
  },
  lowStockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#fdeeee',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: '#f7c2be',
  },
  lowStockBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.danger,
  },
  stockStatusText: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 4,
  },
  itemNotes: {
    fontSize: 11,
    fontStyle: 'italic',
    color: colors.caramel,
    marginBottom: 4,
  },
  itemFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepperBtn: {
    width: 28,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primaryDark,
    paddingHorizontal: 6,
  },
  stepperUnit: {
    fontSize: 11,
    fontWeight: '400',
    color: colors.textSecondary,
  },
  itemCostText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  deleteBtn: {
    padding: 6,
    marginTop: 2,
  },
  floatingBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingTop: 10,
  },
  floatingAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    height: 48,
  },
  floatingAddBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  /* MODAL */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(51, 34, 10, 0.45)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  modalSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  modalTabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  modalTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTabActive: {
    backgroundColor: '#fff6e9',
    borderColor: colors.primary,
  },
  modalTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  modalTabTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  modalBody: {
    paddingVertical: 4,
  },
  modalSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    paddingHorizontal: 10,
    height: 38,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 12,
    color: colors.text,
  },
  inventoryPickerList: {
    maxHeight: 180,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    backgroundColor: '#ffffff',
  },
  inventoryPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  inventoryPickerItemSelected: {
    backgroundColor: '#fffaf3',
  },
  inventoryPickerItemName: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '500',
  },
  inventoryPickerItemSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },
  selectedItemBox: {
    marginTop: 12,
    padding: 10,
    backgroundColor: '#fffaf3',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.goldenBeige,
  },
  selectedItemLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primaryDark,
    marginBottom: 6,
  },
  selectedItemInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 10,
    height: 38,
    fontSize: 14,
    color: colors.text,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primaryDark,
    marginBottom: 4,
  },
  fieldInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: 12,
    height: 42,
    fontSize: 13,
    color: colors.text,
    marginBottom: 10,
  },
  rowTwoCols: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  smallChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 6,
  },
  smallChipActive: {
    backgroundColor: colors.goldenBeige,
    borderColor: colors.caramel,
  },
  smallChipText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  smallChipTextActive: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
  },
  modalCancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalCancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  modalConfirmBtn: {
    flex: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
  },
  modalConfirmBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
});
