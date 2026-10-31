import React, { useState, useMemo, useCallback } from 'react';
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
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Share2,
  RotateCcw,
  Sparkles,
  Plus,
  Flame,
  ChefHat,
  Package,
  ClipboardList,
  CheckCircle2,
  Circle,
  Clock,
  Thermometer,
  AlertTriangle,
  ShoppingCart,
  Trash2,
  X,
  Check,
  Layers,
  ArrowRight,
  Boxes,
} from 'lucide-react-native';
import { api } from '../../src/services/api';
import { colors, spacing, typography, borderRadius } from '../../src/theme';
import {
  DailyProductionPlan,
  ProductionBatch,
  AggregatedProductDemand,
  AggregatedIngredientRequirement,
  Order,
  OperationalStatus,
  ProductionBatchCategory,
} from '@koki/types';
import {
  Badge,
  LoadingState,
  EmptyState,
  ProgressBar,
} from '../../src/components/ui';
import { useAlertStore } from '../../src/stores/alert.store';

type ActiveTab = 'batches' | 'demands' | 'ingredients' | 'orders';

const CATEGORY_CONFIG: Record<
  ProductionBatchCategory,
  { label: string; icon: any; color: string; bg: string }
> = {
  oven: { label: 'Forno', icon: Flame, color: '#e67e22', bg: '#fef5eb' },
  stove: { label: 'Fogão', icon: ChefHat, color: '#cc9a52', bg: '#fdf8f0' },
  assembly: { label: 'Montagem', icon: Layers, color: '#2980b9', bg: '#ebf5fb' },
  decoration: { label: 'Decoração', icon: Sparkles, color: '#8e44ad', bg: '#f4ecf7' },
  packaging: { label: 'Embalagem', icon: Package, color: '#27ae60', bg: '#eafaf1' },
  other: { label: 'Geral', icon: ClipboardList, color: '#7f8c8d', bg: '#f2f4f4' },
};

function formatIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateFriendly(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const weekdays = [
      'Domingo',
      'Segunda-feira',
      'Terça-feira',
      'Quarta-feira',
      'Quinta-feira',
      'Sexta-feira',
      'Sábado',
    ];
    const months = [
      'Janeiro',
      'Fevereiro',
      'Março',
      'Abril',
      'Maio',
      'Junho',
      'Julho',
      'Agosto',
      'Setembro',
      'Outubro',
      'Novembro',
      'Dezembro',
    ];
    return `${weekdays[date.getDay()]}, ${day} de ${months[date.getMonth()]}`;
  } catch {
    return dateStr;
  }
}

export default function ProductionPlannerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { showAlert } = useAlertStore();

  // Current selected day (YYYY-MM-DD)
  const todayStr = useMemo(() => formatIsoDate(new Date()), []);
  const tomorrowStr = useMemo(() => {
    const tom = new Date();
    tom.setDate(tom.getDate() + 1);
    return formatIsoDate(tom);
  }, []);

  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [activeTab, setActiveTab] = useState<ActiveTab>('batches');

  // Modal: Nova Fornada Manual
  const [newBatchModalVisible, setNewBatchModalVisible] = useState<boolean>(false);
  const [batchName, setBatchName] = useState<string>('');
  const [batchCategory, setBatchCategory] = useState<ProductionBatchCategory>('oven');
  const [batchTime, setBatchTime] = useState<string>('');
  const [batchTemp, setBatchTemp] = useState<string>('180');
  const [batchDuration, setBatchDuration] = useState<string>('45');
  const [batchNotes, setBatchNotes] = useState<string>('');

  // 1. Fetch Daily Production Plan
  const {
    data: plan,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery<DailyProductionPlan>({
    queryKey: ['production-daily-plan', selectedDate],
    queryFn: () => api.get<DailyProductionPlan>(`/production-planner/daily?date=${selectedDate}`),
  });

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch, selectedDate]),
  );

  // 2. Mutations
  const toggleBatchMutation = useMutation({
    mutationFn: (batchId: string) =>
      api.patch<ProductionBatch>(`/production-planner/batches/${batchId}/toggle`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-daily-plan', selectedDate] });
    },
    onError: (err: any) => {
      showAlert({
        title: 'Erro ao atualizar',
        message: err.message || 'Não foi possível alterar o status do lote.',
        type: 'danger',
        buttons: [{ text: 'OK', style: 'default' }],
      });
    },
  });

  const deleteBatchMutation = useMutation({
    mutationFn: (batchId: string) =>
      api.delete(`/production-planner/batches/${batchId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-daily-plan', selectedDate] });
      showAlert({
        title: 'Fornada Removida',
        message: 'A fornada foi excluída com sucesso.',
        type: 'success',
        buttons: [{ text: 'OK', style: 'default' }],
      });
    },
    onError: (err: any) => {
      showAlert({
        title: 'Erro ao excluir',
        message: err.message || 'Não foi possível excluir a fornada.',
        type: 'danger',
        buttons: [{ text: 'OK', style: 'default' }],
      });
    },
  });

  const autoGenerateMutation = useMutation({
    mutationFn: (date: string) =>
      api.post<ProductionBatch[]>('/production-planner/auto-generate', { date }),
    onSuccess: (batches) => {
      queryClient.invalidateQueries({ queryKey: ['production-daily-plan', selectedDate] });
      showAlert({
        title: 'Cronograma Gerado!',
        message: `Foram criadas ${batches.length} fornadas/lotes inteligentes a partir dos pedidos do dia.`,
        type: 'success',
        buttons: [{ text: 'Ver Cronograma', style: 'default' }],
      });
      setActiveTab('batches');
    },
    onError: (err: any) => {
      showAlert({
        title: 'Aviso',
        message: err.message || 'Não foi possível gerar as fornadas automaticamente.',
        type: 'warning',
        buttons: [{ text: 'Entendi', style: 'default' }],
      });
    },
  });

  const createBatchMutation = useMutation({
    mutationFn: (data: any) => api.post<ProductionBatch>('/production-planner/batches', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-daily-plan', selectedDate] });
      setNewBatchModalVisible(false);
      resetNewBatchForm();
      showAlert({
        title: 'Fornada Criada!',
        message: 'A nova fornada foi adicionada ao cronograma com sucesso.',
        type: 'success',
        buttons: [{ text: 'OK', style: 'default' }],
      });
    },
    onError: (err: any) => {
      showAlert({
        title: 'Erro ao criar',
        message: err.message || 'Verifique os dados informados.',
        type: 'danger',
        buttons: [{ text: 'OK', style: 'default' }],
      });
    },
  });

  const updateOrderStatusMutation = useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: OperationalStatus }) =>
      api.patch(`/production-planner/orders/${orderId}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-daily-plan', selectedDate] });
    },
    onError: (err: any) => {
      showAlert({
        title: 'Erro ao atualizar pedido',
        message: err.message || 'Não foi possível atualizar o status.',
        type: 'danger',
        buttons: [{ text: 'OK', style: 'default' }],
      });
    },
  });

  const addShortageToShoppingListMutation = useMutation({
    mutationFn: (item: { name: string; quantity: number; unit: string }) =>
      api.post('/inventory/shopping-list', {
        name: item.name,
        quantity: Math.max(1, Math.ceil(item.quantity)),
        unit: item.unit,
        notes: `Demanda de produção para ${selectedDate}`,
      }),
    onSuccess: () => {
      showAlert({
        title: 'Adicionado às Compras!',
        message: 'O insumo em falta foi adicionado à Lista de Compras.',
        type: 'success',
        buttons: [
          { text: 'Continuar no Planejador', style: 'default' },
          { text: 'Ir para Compras', onPress: () => router.push('/shopping-list' as any) },
        ],
      });
    },
    onError: (err: any) => {
      showAlert({
        title: 'Erro ao adicionar',
        message: err.message || 'Não foi possível adicionar o item à lista de compras.',
        type: 'danger',
        buttons: [{ text: 'OK', style: 'default' }],
      });
    },
  });

  // Date Navigation
  const changeDateByOffset = (offsetDays: number) => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() + offsetDays);
    setSelectedDate(formatIsoDate(date));
  };

  const resetNewBatchForm = () => {
    setBatchName('');
    setBatchCategory('oven');
    setBatchTime('');
    setBatchTemp('180');
    setBatchDuration('45');
    setBatchNotes('');
  };

  const handleCreateBatchSubmit = () => {
    if (!batchName.trim()) {
      showAlert({
        title: 'Nome Obrigatório',
        message: 'Por favor, informe um nome para a fornada ou lote.',
        type: 'warning',
        buttons: [{ text: 'OK', style: 'default' }],
      });
      return;
    }

    createBatchMutation.mutate({
      date: selectedDate,
      name: batchName.trim(),
      category: batchCategory,
      time: batchTime.trim() || undefined,
      temperature: batchTemp ? parseFloat(batchTemp) : undefined,
      durationMinutes: batchDuration ? parseInt(batchDuration, 10) : undefined,
      notes: batchNotes.trim() || undefined,
      status: 'pending',
    });
  };

  const confirmDeleteBatch = (batch: ProductionBatch) => {
    showAlert({
      title: 'Excluir Fornada?',
      message: `Deseja realmente remover "${batch.name}" do cronograma?`,
      type: 'confirm',
      buttons: [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => deleteBatchMutation.mutate(batch.id),
        },
      ],
    });
  };

  // Share Daily Production Plan (WhatsApp / Clipboard)
  const handleSharePlan = async () => {
    if (!plan) return;

    let text = `📅 *PLANO DE PRODUÇÃO KOKI*\n`;
    text += `🗓️ ${formatDateFriendly(selectedDate)}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

    text += `📊 *RESUMO DO DIA*\n`;
    text += `• Pedidos: ${plan.totalOrdersCount}\n`;
    text += `• Itens a produzir: ${plan.metrics.totalItemsToProduce} un\n`;
    text += `• Fornadas: ${plan.metrics.completedBatchesCount}/${plan.metrics.totalBatchesCount} concluídas\n\n`;

    if (plan.batches.length > 0) {
      text += `🔥 *CRONOGRAMA DE FORNADAS*\n`;
      plan.batches.forEach((b) => {
        const statusIcon = b.status === 'completed' ? '✅' : b.status === 'in_progress' ? '⏳' : '⚪';
        text += `${statusIcon} *${b.time || '--:--'}* - ${b.name}`;
        if (b.temperature) text += ` (${b.temperature}°C)`;
        text += `\n`;
        if (b.items && b.items.length > 0) {
          b.items.forEach((it) => {
            text += `   ▪ ${it.quantity}x ${it.productName}`;
            if (it.flavor) text += ` [${it.flavor}]`;
            text += `\n`;
          });
        }
      });
      text += `\n`;
    }

    if (plan.productDemands.length > 0) {
      text += `🎂 *DEMANDAS DE PRODUTOS*\n`;
      plan.productDemands.forEach((d) => {
        text += `• *${d.totalQuantity}x ${d.productName}*\n`;
        if (d.flavors.length > 0) {
          text += `  Sabores: ${d.flavors.map((f) => `${f.flavor} (${f.quantity})`).join(', ')}\n`;
        }
        if (d.orderNumbers.length > 0) {
          text += `  Pedidos: #${d.orderNumbers.join(', #')}\n`;
        }
      });
      text += `\n`;
    }

    if (plan.ingredientRequirements.length > 0) {
      text += `📦 *INSUMOS NECESSÁRIOS*\n`;
      plan.ingredientRequirements.forEach((ing) => {
        const shortage = ing.isShortage ? ' ⚠️ [EM FALTA]' : '';
        text += `• ${ing.name}: ${ing.requiredQuantity} ${ing.unit}${shortage}\n`;
      });
      text += `\n`;
    }

    text += `_Gerado com amor pelo Koki Confeitaria_ 🍪✨`;

    try {
      await Share.share({ message: text });
    } catch {}
  };

  const progressPercentage = useMemo(() => {
    if (!plan || plan.metrics.totalBatchesCount === 0) return 0;
    return Math.round(
      (plan.metrics.completedBatchesCount / plan.metrics.totalBatchesCount) * 100,
    );
  }, [plan]);

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
            <Text style={styles.headerTitle}>Planejador de Produção</Text>
            <Text style={styles.headerSubtitle}>Fornadas, demandas & insumos diários</Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerActionButton}
            onPress={handleSharePlan}
            activeOpacity={0.7}
          >
            <Share2 size={20} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerActionButton}
            onPress={() => refetch()}
            activeOpacity={0.7}
          >
            <RotateCcw size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. Barra de Navegação Temporal (Dia anterior / Hoje / Amanhã / Próximo) */}
      <View style={styles.dateStrip}>
        <TouchableOpacity
          style={styles.dateArrow}
          onPress={() => changeDateByOffset(-1)}
          activeOpacity={0.7}
        >
          <ChevronRight size={20} color={colors.primaryDark} style={{ transform: [{ rotate: '180deg' }] }} />
        </TouchableOpacity>

        <View style={styles.dateInfo}>
          <View style={styles.dateQuickPills}>
            <TouchableOpacity
              style={[styles.pill, selectedDate === todayStr && styles.pillActive]}
              onPress={() => setSelectedDate(todayStr)}
            >
              <Text style={[styles.pillText, selectedDate === todayStr && styles.pillTextActive]}>
                Hoje
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.pill, selectedDate === tomorrowStr && styles.pillActive]}
              onPress={() => setSelectedDate(tomorrowStr)}
            >
              <Text style={[styles.pillText, selectedDate === tomorrowStr && styles.pillTextActive]}>
                Amanhã
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.dateTitle} numberOfLines={1}>
            {formatDateFriendly(selectedDate)}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.dateArrow}
          onPress={() => changeDateByOffset(1)}
          activeOpacity={0.7}
        >
          <ChevronRight size={20} color={colors.primaryDark} />
        </TouchableOpacity>
      </View>

      {/* 3. Conteúdo Principal */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 80 }]}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => {
              refetch();
            }}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {isLoading ? (
          <LoadingState message="Carregando planejamento de produção..." />
        ) : (
          <>
            {/* KPI Summary Card */}
            <View style={styles.summaryCard}>
              <View style={styles.kpiRow}>
                <View style={styles.kpiCol}>
                  <Text style={styles.kpiLabel}>Pedidos do Dia</Text>
                  <Text style={styles.kpiValue}>{plan?.totalOrdersCount || 0}</Text>
                  <Text style={styles.kpiSub}>
                    {plan?.metrics.ordersByStatus.ready || 0} prontos • {plan?.metrics.ordersByStatus.in_production || 0} em prod.
                  </Text>
                </View>

                <View style={styles.kpiDivider} />

                <View style={styles.kpiCol}>
                  <Text style={styles.kpiLabel}>Itens a Produzir</Text>
                  <Text style={[styles.kpiValue, { color: colors.caramel }]}>
                    {plan?.metrics.totalItemsToProduce || 0}
                  </Text>
                  <Text style={styles.kpiSub}>
                    {plan?.productDemands.length || 0} tipos de produtos
                  </Text>
                </View>

                <View style={styles.kpiDivider} />

                <View style={styles.kpiCol}>
                  <Text style={styles.kpiLabel}>Fornadas</Text>
                  <Text style={[styles.kpiValue, { color: colors.success }]}>
                    {plan?.metrics.completedBatchesCount || 0}/{plan?.metrics.totalBatchesCount || 0}
                  </Text>
                  <Text style={styles.kpiSub}>
                    {progressPercentage}% concluído
                  </Text>
                </View>
              </View>

              {/* Progress Bar */}
              <View style={styles.progressContainer}>
                <ProgressBar
                  progress={progressPercentage / 100}
                  color={progressPercentage === 100 ? colors.success : colors.caramel}
                />
              </View>
            </View>

            {/* 4 Tabs Segmented Control */}
            <View style={styles.tabsContainer}>
              <TouchableOpacity
                style={[styles.tabButton, activeTab === 'batches' && styles.tabButtonActive]}
                onPress={() => setActiveTab('batches')}
              >
                <Flame size={16} color={activeTab === 'batches' ? colors.primary : colors.textMuted} />
                <Text style={[styles.tabText, activeTab === 'batches' && styles.tabTextActive]}>
                  Fornadas ({plan?.batches.length || 0})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabButton, activeTab === 'demands' && styles.tabButtonActive]}
                onPress={() => setActiveTab('demands')}
              >
                <ChefHat size={16} color={activeTab === 'demands' ? colors.primary : colors.textMuted} />
                <Text style={[styles.tabText, activeTab === 'demands' && styles.tabTextActive]}>
                  Demandas ({plan?.productDemands.length || 0})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabButton, activeTab === 'ingredients' && styles.tabButtonActive]}
                onPress={() => setActiveTab('ingredients')}
              >
                <Boxes size={16} color={activeTab === 'ingredients' ? colors.primary : colors.textMuted} />
                <Text style={[styles.tabText, activeTab === 'ingredients' && styles.tabTextActive]}>
                  Insumos ({plan?.ingredientRequirements.length || 0})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabButton, activeTab === 'orders' && styles.tabButtonActive]}
                onPress={() => setActiveTab('orders')}
              >
                <ClipboardList size={16} color={activeTab === 'orders' ? colors.primary : colors.textMuted} />
                <Text style={[styles.tabText, activeTab === 'orders' && styles.tabTextActive]}>
                  Pedidos ({plan?.orders.length || 0})
                </Text>
              </TouchableOpacity>
            </View>

            {/* TAB 1: FORNADAS & LOTES (CRONOGRAMA) */}
            {activeTab === 'batches' && (
              <View style={styles.tabContent}>
                {/* Ações de Lote: Auto-Gerar ou Manual */}
                <View style={styles.batchActionsRow}>
                  <TouchableOpacity
                    style={styles.autoGenerateButton}
                    onPress={() => autoGenerateMutation.mutate(selectedDate)}
                    disabled={autoGenerateMutation.isPending}
                    activeOpacity={0.8}
                  >
                    <Sparkles size={16} color="#ffffff" />
                    <Text style={styles.autoGenerateButtonText}>
                      {autoGenerateMutation.isPending ? 'Gerando Fornadas...' : 'Auto-Gerar Fornadas'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.manualBatchButton}
                    onPress={() => setNewBatchModalVisible(true)}
                    activeOpacity={0.8}
                  >
                    <Plus size={16} color={colors.primary} />
                    <Text style={styles.manualBatchButtonText}>Nova Fornada</Text>
                  </TouchableOpacity>
                </View>

                {(!plan?.batches || plan.batches.length === 0) ? (
                  <EmptyState
                    title="Nenhuma fornada planejada"
                    description={`Clique em "Auto-Gerar Fornadas" para criar o cronograma inteligente dos pedidos de ${formatDateFriendly(selectedDate)} ou adicione manualmente.`}
                  />
                ) : (
                  plan.batches.map((batch) => {
                    const cat = CATEGORY_CONFIG[batch.category] || CATEGORY_CONFIG.other;
                    const CatIcon = cat.icon;
                    const isCompleted = batch.status === 'completed';
                    const isInProgress = batch.status === 'in_progress';

                    return (
                      <View
                        key={batch.id}
                        style={[
                          styles.batchCard,
                          isCompleted && styles.batchCardCompleted,
                        ]}
                      >
                        {/* Batch Header */}
                        <View style={styles.batchHeaderRow}>
                          <TouchableOpacity
                            style={styles.batchCheckTouch}
                            onPress={() => toggleBatchMutation.mutate(batch.id)}
                            activeOpacity={0.7}
                          >
                            {isCompleted ? (
                              <CheckCircle2 size={24} color={colors.success} />
                            ) : isInProgress ? (
                              <View style={styles.inProgressBadge}>
                                <Text style={styles.inProgressText}>EM ANDAMENTO</Text>
                              </View>
                            ) : (
                              <Circle size={24} color={colors.textMuted} />
                            )}
                          </TouchableOpacity>

                          <View style={styles.batchTitleCol}>
                            <Text
                              style={[
                                styles.batchName,
                                isCompleted && styles.batchNameCompleted,
                              ]}
                            >
                              {batch.name}
                            </Text>

                            <View style={styles.batchMetaRow}>
                              <View style={[styles.categoryTag, { backgroundColor: cat.bg }]}>
                                <CatIcon size={12} color={cat.color} />
                                <Text style={[styles.categoryTagText, { color: cat.color }]}>
                                  {cat.label}
                                </Text>
                              </View>

                              {batch.time ? (
                                <View style={styles.metaBadge}>
                                  <Clock size={12} color={colors.textSecondary} />
                                  <Text style={styles.metaBadgeText}>{batch.time}</Text>
                                </View>
                              ) : null}

                              {batch.temperature ? (
                                <View style={styles.metaBadge}>
                                  <Thermometer size={12} color={colors.danger} />
                                  <Text style={[styles.metaBadgeText, { color: colors.danger }]}>
                                    {batch.temperature}°C
                                  </Text>
                                </View>
                              ) : null}

                              {batch.durationMinutes ? (
                                <View style={styles.metaBadge}>
                                  <Text style={styles.metaBadgeText}>{batch.durationMinutes} min</Text>
                                </View>
                              ) : null}
                            </View>
                          </View>

                          <TouchableOpacity
                            style={styles.deleteBatchButton}
                            onPress={() => confirmDeleteBatch(batch)}
                            activeOpacity={0.7}
                          >
                            <Trash2 size={16} color={colors.textMuted} />
                          </TouchableOpacity>
                        </View>

                        {/* Batch Items List */}
                        {batch.items && batch.items.length > 0 && (
                          <View style={styles.batchItemsList}>
                            {batch.items.map((it, idx) => (
                              <View key={idx} style={styles.batchItemRow}>
                                <View style={styles.batchItemBullet} />
                                <Text style={styles.batchItemName}>
                                  <Text style={styles.batchItemQty}>{it.quantity}x </Text>
                                  {it.productName}
                                  {it.flavor ? (
                                    <Text style={styles.batchItemFlavor}> • {it.flavor}</Text>
                                  ) : null}
                                </Text>
                                {it.notes ? (
                                  <Text style={styles.batchItemNotes}>{it.notes}</Text>
                                ) : null}
                              </View>
                            ))}
                          </View>
                        )}

                        {/* Batch Notes */}
                        {batch.notes ? (
                          <View style={styles.batchNotesBox}>
                            <Text style={styles.batchNotesText}>💡 {batch.notes}</Text>
                          </View>
                        ) : null}
                      </View>
                    );
                  })
                )}
              </View>
            )}

            {/* TAB 2: DEMANDAS DE PRODUTOS */}
            {activeTab === 'demands' && (
              <View style={styles.tabContent}>
                {(!plan?.productDemands || plan.productDemands.length === 0) ? (
                  <EmptyState
                    title="Nenhuma demanda para este dia"
                    description="Não há pedidos ativos agendados para a data selecionada."
                  />
                ) : (
                  plan.productDemands.map((demand, idx) => (
                    <View key={demand.productId || idx} style={styles.demandCard}>
                      <View style={styles.demandHeader}>
                        <View style={styles.demandTitleCol}>
                          <Text style={styles.demandProductName}>{demand.productName}</Text>
                          <Text style={styles.demandCategory}>{demand.category || 'Geral'}</Text>
                        </View>

                        <View style={styles.demandQuantityBadge}>
                          <Text style={styles.demandQuantityNumber}>{demand.totalQuantity}</Text>
                          <Text style={styles.demandQuantityUnit}>{demand.unit}</Text>
                        </View>
                      </View>

                      {/* Sabores Consolidados */}
                      {demand.flavors.length > 0 && (
                        <View style={styles.demandSubSection}>
                          <Text style={styles.demandSubSectionTitle}>Sabores do dia:</Text>
                          <View style={styles.flavorPillsRow}>
                            {demand.flavors.map((fl, fIdx) => (
                              <View key={fIdx} style={styles.flavorPill}>
                                <Text style={styles.flavorPillText}>
                                  {fl.flavor}: <Text style={styles.flavorPillQty}>{fl.quantity}x</Text>
                                </Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      )}

                      {/* Complementos */}
                      {demand.complements.length > 0 && (
                        <View style={styles.demandSubSection}>
                          <Text style={styles.demandSubSectionTitle}>Adicionais:</Text>
                          <Text style={styles.demandComplementsText}>
                            {demand.complements.map((c) => `${c.name} (${c.count}x)`).join(', ')}
                          </Text>
                        </View>
                      )}

                      {/* Pedidos Vinculados */}
                      {demand.orderNumbers.length > 0 && (
                        <View style={styles.demandOrdersRow}>
                          <Text style={styles.demandOrdersLabel}>Pedidos:</Text>
                          {demand.orderNumbers.map((num) => (
                            <View key={num} style={styles.orderNumberChip}>
                              <Text style={styles.orderNumberChipText}>#{num}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  ))
                )}
              </View>
            )}

            {/* TAB 3: INSUMOS NECESSÁRIOS */}
            {activeTab === 'ingredients' && (
              <View style={styles.tabContent}>
                {(!plan?.ingredientRequirements || plan.ingredientRequirements.length === 0) ? (
                  <EmptyState
                    title="Nenhum insumo calculado"
                    description="Para calcular os insumos automaticamente, certifique-se de que os produtos possuem Ficha Técnica/Receita vinculada."
                  />
                ) : (
                  <>
                    <View style={styles.ingredientsInfoBanner}>
                      <Boxes size={18} color={colors.primary} />
                      <Text style={styles.ingredientsInfoBannerText}>
                        Ingredientes calculados proporcionalmente às receitas e quantidades do dia.
                      </Text>
                    </View>

                    {plan.ingredientRequirements.map((ing, idx) => (
                      <View
                        key={idx}
                        style={[
                          styles.ingredientCard,
                          ing.isShortage && styles.ingredientCardShortage,
                        ]}
                      >
                        <View style={styles.ingredientMain}>
                          <View style={styles.ingredientNameCol}>
                            <Text style={styles.ingredientName}>{ing.name}</Text>
                            <Text style={styles.ingredientStockText}>
                              {ing.currentStock !== undefined
                                ? `Estoque atual: ${ing.currentStock} ${ing.unit}`
                                : 'Estoque não monitorado'}
                            </Text>
                          </View>

                          <View style={styles.ingredientNeedCol}>
                            <Text style={styles.ingredientNeedLabel}>Necessário</Text>
                            <Text style={styles.ingredientNeedValue}>
                              {ing.requiredQuantity} {ing.unit}
                            </Text>
                          </View>
                        </View>

                        {/* Shortage Action Row */}
                        {ing.isShortage ? (
                          <View style={styles.shortageRow}>
                            <View style={styles.shortageAlert}>
                              <AlertTriangle size={14} color={colors.danger} />
                              <Text style={styles.shortageAlertText}>
                                Em falta no estoque (Faltam {(ing.requiredQuantity - (ing.currentStock || 0)).toFixed(1)} {ing.unit})
                              </Text>
                            </View>

                            <TouchableOpacity
                              style={styles.addToListButton}
                              onPress={() =>
                                addShortageToShoppingListMutation.mutate({
                                  name: ing.name,
                                  quantity: ing.requiredQuantity - (ing.currentStock || 0),
                                  unit: ing.unit,
                                })
                              }
                              activeOpacity={0.8}
                            >
                              <ShoppingCart size={14} color="#ffffff" />
                              <Text style={styles.addToListButtonText}>+ Lista de Compras</Text>
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <View style={styles.stockOkRow}>
                            <Check size={14} color={colors.success} />
                            <Text style={styles.stockOkText}>Estoque suficiente para a produção</Text>
                          </View>
                        )}
                      </View>
                    ))}
                  </>
                )}
              </View>
            )}

            {/* TAB 4: PEDIDOS DO DIA */}
            {activeTab === 'orders' && (
              <View style={styles.tabContent}>
                {(!plan?.orders || plan.orders.length === 0) ? (
                  <EmptyState
                    title="Nenhum pedido para este dia"
                    description={`Não há pedidos com data de entrega prevista para ${formatDateFriendly(selectedDate)}.`}
                  />
                ) : (
                  plan.orders.map((order) => {
                    const isPickup = order.deliveryMethod === 'pickup';
                    return (
                      <View key={order.id} style={styles.orderCard}>
                        <View style={styles.orderCardHeader}>
                          <View>
                            <Text style={styles.orderNumberText}>Pedido #{order.orderNumber}</Text>
                            <Text style={styles.orderCustomerName}>{order.customerName}</Text>
                          </View>

                          <Badge status={order.operationalStatus} />
                        </View>

                        {/* Order Items */}
                        <View style={styles.orderItemsBox}>
                          {order.items.map((it, itIdx) => (
                            <Text key={itIdx} style={styles.orderItemRowText}>
                              • <Text style={styles.orderItemQtyText}>{it.quantity}x</Text> {it.productName}
                              {it.flavor ? ` (${it.flavor})` : ''}
                            </Text>
                          ))}
                        </View>

                        {/* Order Footer & Fast Action Buttons */}
                        <View style={styles.orderStatusActions}>
                          <Text style={styles.orderActionLabel}>Mudar status:</Text>

                          <View style={styles.orderStatusButtonsGroup}>
                            <TouchableOpacity
                              style={[
                                styles.orderStatusBtn,
                                order.operationalStatus === 'pending' && styles.orderStatusBtnActive,
                              ]}
                              onPress={() =>
                                updateOrderStatusMutation.mutate({
                                  orderId: order.id,
                                  status: 'pending',
                                })
                              }
                            >
                              <Text
                                style={[
                                  styles.orderStatusBtnText,
                                  order.operationalStatus === 'pending' && styles.orderStatusBtnTextActive,
                                ]}
                              >
                                Pendente
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={[
                                styles.orderStatusBtn,
                                order.operationalStatus === 'in_production' && styles.orderStatusBtnActive,
                              ]}
                              onPress={() =>
                                updateOrderStatusMutation.mutate({
                                  orderId: order.id,
                                  status: 'in_production',
                                })
                              }
                            >
                              <Text
                                style={[
                                  styles.orderStatusBtnText,
                                  order.operationalStatus === 'in_production' && styles.orderStatusBtnTextActive,
                                ]}
                              >
                                Em Produção
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={[
                                styles.orderStatusBtn,
                                order.operationalStatus === 'ready' && styles.orderStatusBtnActive,
                              ]}
                              onPress={() =>
                                updateOrderStatusMutation.mutate({
                                  orderId: order.id,
                                  status: 'ready',
                                })
                              }
                            >
                              <Text
                                style={[
                                  styles.orderStatusBtnText,
                                  order.operationalStatus === 'ready' && styles.orderStatusBtnTextActive,
                                ]}
                              >
                                Pronto
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* MODAL: NOVA FORNADA MANUAL */}
      <Modal
        visible={newBatchModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setNewBatchModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Nova Fornada / Lote</Text>
                <Text style={styles.modalSubtitle}>Agendar lote para {formatDateFriendly(selectedDate)}</Text>
              </View>
              <TouchableOpacity
                onPress={() => setNewBatchModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Nome */}
              <Text style={styles.inputLabel}>Nome da Fornada / Lote *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Ex: Fornada 1 - Bolos de Cenoura"
                placeholderTextColor={colors.textMuted}
                value={batchName}
                onChangeText={setBatchName}
              />

              {/* Categoria */}
              <Text style={styles.inputLabel}>Processo / Categoria</Text>
              <View style={styles.categoryPickerRow}>
                {(['oven', 'stove', 'assembly', 'decoration', 'packaging'] as ProductionBatchCategory[]).map(
                  (catKey) => {
                    const cfg = CATEGORY_CONFIG[catKey];
                    const selected = batchCategory === catKey;
                    return (
                      <TouchableOpacity
                        key={catKey}
                        style={[
                          styles.catChoiceBtn,
                          selected && { backgroundColor: cfg.bg, borderColor: cfg.color },
                        ]}
                        onPress={() => setBatchCategory(catKey)}
                      >
                        <cfg.icon size={14} color={selected ? cfg.color : colors.textSecondary} />
                        <Text
                          style={[
                            styles.catChoiceText,
                            selected && { color: cfg.color, fontWeight: '700' },
                          ]}
                        >
                          {cfg.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  },
                )}
              </View>

              {/* Horário, Temperatura e Duração */}
              <View style={styles.inputsGrid}>
                <View style={styles.gridCol}>
                  <Text style={styles.inputLabel}>Horário</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="08:30"
                    placeholderTextColor={colors.textMuted}
                    value={batchTime}
                    onChangeText={setBatchTime}
                  />
                </View>

                <View style={styles.gridCol}>
                  <Text style={styles.inputLabel}>Temperatura (°C)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="180"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    value={batchTemp}
                    onChangeText={setBatchTemp}
                  />
                </View>

                <View style={styles.gridCol}>
                  <Text style={styles.inputLabel}>Duração (min)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="45"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    value={batchDuration}
                    onChangeText={setBatchDuration}
                  />
                </View>
              </View>

              {/* Notas */}
              <Text style={styles.inputLabel}>Observações da Cozinha</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder="Ex: Untar formas com manteiga e farinha, pré-aquecer forno."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={3}
                value={batchNotes}
                onChangeText={setBatchNotes}
              />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setNewBatchModalVisible(false)}
              >
                <Text style={styles.modalCancelBtnText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={handleCreateBatchSubmit}
                disabled={createBatchMutation.isPending}
              >
                <Text style={styles.modalSubmitBtnText}>
                  {createBatchMutation.isPending ? 'Salvando...' : 'Adicionar ao Cronograma'}
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
  dateStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dateArrow: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  dateInfo: {
    alignItems: 'center',
    flex: 1,
  },
  dateQuickPills: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: 4,
  },
  pill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
  },
  pillActive: {
    backgroundColor: colors.primary,
  },
  pillText: {
    fontSize: typography.sizes.xs,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  pillTextActive: {
    color: colors.textInverse,
  },
  dateTitle: {
    fontSize: typography.sizes.md,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
  },
  summaryCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  kpiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  kpiCol: {
    flex: 1,
    alignItems: 'center',
  },
  kpiDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border,
  },
  kpiLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  kpiValue: {
    fontSize: typography.sizes.xxl,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  kpiSub: {
    fontSize: typography.sizes.xs - 1,
    color: colors.textMuted,
    marginTop: 2,
  },
  progressContainer: {
    marginTop: spacing.xs,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: 3,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    gap: 4,
  },
  tabButtonActive: {
    backgroundColor: colors.cardBackground,
  },
  tabText: {
    fontSize: typography.sizes.xs,
    fontWeight: '600',
    color: colors.textMuted,
  },
  tabTextActive: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
  tabContent: {
    gap: spacing.sm,
  },
  batchActionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  autoGenerateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  autoGenerateButtonText: {
    color: '#ffffff',
    fontSize: typography.sizes.sm,
    fontWeight: '700',
  },
  manualBatchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardBackground,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    gap: spacing.xs,
  },
  manualBatchButtonText: {
    color: colors.primary,
    fontSize: typography.sizes.sm,
    fontWeight: '700',
  },
  batchCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  batchCardCompleted: {
    opacity: 0.75,
    backgroundColor: '#fafaf9',
  },
  batchHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  batchCheckTouch: {
    padding: 2,
  },
  inProgressBadge: {
    backgroundColor: colors.status.in_production,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  inProgressText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
  },
  batchTitleCol: {
    flex: 1,
  },
  batchName: {
    fontSize: typography.sizes.md,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  batchNameCompleted: {
    textDecorationLine: 'line-through',
    color: colors.textMuted,
  },
  batchMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: 4,
  },
  categoryTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  categoryTagText: {
    fontSize: typography.sizes.xs - 1,
    fontWeight: '700',
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
    fontWeight: '600',
    color: colors.textSecondary,
  },
  deleteBatchButton: {
    padding: spacing.xs,
  },
  batchItemsList: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.surface,
    gap: 4,
  },
  batchItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  batchItemBullet: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.caramel,
  },
  batchItemName: {
    fontSize: typography.sizes.sm,
    color: colors.text,
    flex: 1,
  },
  batchItemQty: {
    fontWeight: '700',
    color: colors.primaryDark,
  },
  batchItemFlavor: {
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  batchItemNotes: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
  },
  batchNotesBox: {
    marginTop: spacing.sm,
    backgroundColor: colors.surface,
    padding: spacing.xs + 2,
    borderRadius: borderRadius.sm,
  },
  batchNotesText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
  demandCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  demandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  demandTitleCol: {
    flex: 1,
  },
  demandProductName: {
    fontSize: typography.sizes.md,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  demandCategory: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
  },
  demandQuantityBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    gap: 2,
  },
  demandQuantityNumber: {
    fontSize: typography.sizes.xl,
    fontWeight: '800',
    color: colors.primary,
  },
  demandQuantityUnit: {
    fontSize: typography.sizes.xs,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  demandSubSection: {
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.surface,
  },
  demandSubSectionTitle: {
    fontSize: typography.sizes.xs,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  flavorPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  flavorPill: {
    backgroundColor: '#fff6e9',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.goldenBeige,
  },
  flavorPillText: {
    fontSize: typography.sizes.xs,
    color: colors.primaryDark,
  },
  flavorPillQty: {
    fontWeight: '700',
    color: colors.primary,
  },
  demandComplementsText: {
    fontSize: typography.sizes.xs,
    color: colors.text,
  },
  demandOrdersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.sm,
    flexWrap: 'wrap',
  },
  demandOrdersLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  orderNumberChip: {
    backgroundColor: colors.surface,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: borderRadius.sm,
  },
  orderNumberChipText: {
    fontSize: typography.sizes.xs,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  ingredientsInfoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  ingredientsInfoBannerText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    flex: 1,
  },
  ingredientCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ingredientCardShortage: {
    borderColor: colors.danger,
    backgroundColor: '#fffcfb',
  },
  ingredientMain: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ingredientNameCol: {
    flex: 1,
  },
  ingredientName: {
    fontSize: typography.sizes.md,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  ingredientStockText: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  ingredientNeedCol: {
    alignItems: 'flex-end',
  },
  ingredientNeedLabel: {
    fontSize: typography.sizes.xs - 1,
    color: colors.textSecondary,
  },
  ingredientNeedValue: {
    fontSize: typography.sizes.lg,
    fontWeight: '800',
    color: colors.primary,
  },
  shortageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.surface,
  },
  shortageAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  shortageAlertText: {
    fontSize: typography.sizes.xs,
    fontWeight: '600',
    color: colors.danger,
  },
  addToListButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    gap: 4,
  },
  addToListButtonText: {
    color: '#ffffff',
    fontSize: typography.sizes.xs,
    fontWeight: '700',
  },
  stockOkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.xs,
  },
  stockOkText: {
    fontSize: typography.sizes.xs,
    color: colors.success,
    fontWeight: '600',
  },
  orderCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  orderCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  orderNumberText: {
    fontSize: typography.sizes.sm,
    fontWeight: '800',
    color: colors.primary,
  },
  orderCustomerName: {
    fontSize: typography.sizes.md,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  orderItemsBox: {
    marginVertical: spacing.xs,
    padding: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.sm,
    gap: 2,
  },
  orderItemRowText: {
    fontSize: typography.sizes.xs,
    color: colors.text,
  },
  orderItemQtyText: {
    fontWeight: '700',
    color: colors.primaryDark,
  },
  orderStatusActions: {
    marginTop: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  orderActionLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  orderStatusButtonsGroup: {
    flexDirection: 'row',
    gap: 4,
  },
  orderStatusBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surface,
  },
  orderStatusBtnActive: {
    backgroundColor: colors.primary,
  },
  orderStatusBtnText: {
    fontSize: typography.sizes.xs - 1,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  orderStatusBtnTextActive: {
    color: '#ffffff',
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
    maxHeight: '85%',
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
  modalBody: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: '700',
    color: colors.primaryDark,
    marginBottom: 4,
    marginTop: spacing.sm,
  },
  textInput: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.sizes.sm,
    color: colors.text,
  },
  textArea: {
    minHeight: 65,
    textAlignVertical: 'top',
  },
  categoryPickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  catChoiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  catChoiceText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
  inputsGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  gridCol: {
    flex: 1,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  modalCancelBtnText: {
    fontSize: typography.sizes.sm,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  modalSubmitBtn: {
    flex: 2,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  modalSubmitBtnText: {
    fontSize: typography.sizes.sm,
    fontWeight: '700',
    color: '#ffffff',
  },
});
