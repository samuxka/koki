import React, { useState } from 'react';
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
  Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography, borderRadius } from '../../src/theme';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { Badge } from '../../src/components/ui/Badge';
import { ProgressBar } from '../../src/components/ui/ProgressBar';
import { LoadingState } from '../../src/components/ui/LoadingState';
import { api } from '../../src/services/api';
import { useAuthStore } from '../../src/stores/auth.store';
import { formatCurrency, formatDate } from '../../src/utils/formatters';
import { ProductDetailResponse, ProductPeriodFilter } from '@koki/types';
import {
  ArrowLeft,
  Package,
  Edit2,
  Trash2,
  TrendingUp,
  ShoppingBag,
  DollarSign,
  Calendar,
  Target,
  Sparkles,
  Layers,
  FileText,
  Clock,
  ChevronRight,
  Receipt,
  PieChart,
  Tag,
  CheckCircle2,
  AlertCircle,
  X,
  SlidersHorizontal,
} from 'lucide-react-native';

const PERIOD_TABS: { key: ProductPeriodFilter; label: string }[] = [
  { key: 'day', label: 'Dia' },
  { key: 'week', label: 'Semana' },
  { key: 'month', label: 'Mês' },
  { key: 'year', label: 'Ano' },
  { key: 'custom', label: 'Período' },
];

export default function ProductDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { company } = useAuthStore();
  const currency = company?.currency || 'EUR';

  // Period filter state for the chart
  const [period, setPeriod] = useState<ProductPeriodFilter>('week');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [customPeriodModalVisible, setCustomPeriodModalVisible] = useState(false);
  const [selectedBarIndex, setSelectedBarIndex] = useState<number | null>(null);

  // Fetch product detail and analytics
  const {
    data,
    isLoading,
    refetch,
  } = useQuery<ProductDetailResponse>({
    queryKey: ['product-detail', id, period, customStartDate, customEndDate],
    queryFn: () => {
      let url = `/products/${id}?period=${period}`;
      if (period === 'custom' && customStartDate && customEndDate) {
        url += `&startDate=${encodeURIComponent(customStartDate)}&endDate=${encodeURIComponent(
          customEndDate,
        )}`;
      }
      return api.get<ProductDetailResponse>(url);
    },
    enabled: !!id,
  });

  // Toggle availability mutation
  const toggleMutation = useMutation({
    mutationFn: () => api.patch(`/products/${id}/toggle-availability`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err: any) => {
      Alert.alert('Erro', err.message || 'Falha ao alterar status');
    },
  });

  // Delete product mutation
  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/products/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      Alert.alert('Sucesso', 'Produto excluído com sucesso.');
      router.back();
    },
    onError: (err: any) => {
      Alert.alert('Erro', err.message || 'Falha ao excluir produto');
    },
  });

  const handleDelete = () => {
    Alert.alert(
      'Excluir Produto',
      'Tem certeza de que deseja remover este produto? Esta ação não pode ser desfeita.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => deleteMutation.mutate(),
        },
      ],
    );
  };

  if (isLoading && !data) {
    return <LoadingState message="Carregando dados do produto..." />;
  }

  if (!data?.product) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Package size={48} color={colors.textMuted} />
        <Text style={{ marginTop: spacing.md, color: colors.textSecondary }}>
          Produto não encontrado.
        </Text>
        <Button title="Voltar" onPress={() => router.back()} style={{ marginTop: spacing.lg }} />
      </View>
    );
  }

  const { product, metrics, chartData = [], recentOrders = [] } = data;

  const totalPeriodOrders = chartData.reduce((acc, p) => acc + (p.ordersCount || 0), 0);
  const totalPeriodUnits = chartData.reduce((acc, p) => acc + (p.unitsSold || 0), 0);
  const totalPeriodRevenueCents = chartData.reduce((acc, p) => acc + (p.revenueCents || 0), 0);

  // Calculate maximum values for the bar chart scaling
  const maxUnits = Math.max(...chartData.map((p) => p.unitsSold), 1);
  const maxRevenue = Math.max(...chartData.map((p) => p.revenueCents), 1);

  return (
    <View style={styles.container}>
      {/* Header with Safe Area Inset */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) + 8 }]}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <ArrowLeft size={22} color={colors.primaryDark} />
        </TouchableOpacity>

        <Text style={styles.headerTitle} numberOfLines={1}>
          {product.name}
        </Text>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => router.push(`/products/edit/${product.id}` as any)}
            activeOpacity={0.7}
          >
            <Edit2 size={18} color={colors.primaryDark} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.headerButton, styles.deleteHeaderBtn]}
            onPress={handleDelete}
            activeOpacity={0.7}
          >
            <Trash2 size={18} color={colors.danger} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 20) + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Product Hero Card */}
        <Card style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            {product.imageUrl ? (
              <Image source={{ uri: product.imageUrl }} style={styles.heroImage} />
            ) : (
              <View style={styles.heroImagePlaceholder}>
                <Package size={36} color={colors.primary} />
              </View>
            )}

            <View style={styles.heroInfo}>
              <View style={styles.categoryRow}>
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryBadgeText}>{product.category || 'Geral'}</Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    product.isAvailable ? styles.statusBadgeActive : styles.statusBadgeInactive,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      { color: product.isAvailable ? colors.success : colors.textMuted },
                    ]}
                  >
                    {product.isAvailable ? 'Disponível' : 'Pausado'}
                  </Text>
                </View>
              </View>

              <Text style={styles.heroProductName}>{product.name}</Text>

              <View style={styles.heroPriceRow}>
                <Text style={styles.heroPrice}>
                  {formatCurrency(product.priceCents, currency)}
                </Text>
                {product.unit ? <Text style={styles.heroUnit}>/{product.unit}</Text> : null}
              </View>
            </View>
          </View>

          {/* Unit Economics: Price, Cost, Profit, Margin */}
          <View style={styles.economicsGrid}>
            <View style={styles.econItem}>
              <Text style={styles.econLabel}>Preço Venda</Text>
              <Text style={styles.econValue}>
                {formatCurrency(product.priceCents, currency)}
              </Text>
            </View>
            <View style={styles.econDivider} />
            <View style={styles.econItem}>
              <Text style={styles.econLabel}>Custo Unitário</Text>
              <Text style={[styles.econValue, { color: colors.danger }]}>
                {product.costCents ? formatCurrency(product.costCents, currency) : 'N/D'}
              </Text>
            </View>
            <View style={styles.econDivider} />
            <View style={styles.econItem}>
              <Text style={styles.econLabel}>Lucro / Unidade</Text>
              <Text style={[styles.econValue, { color: colors.success }]}>
                {product.costCents
                  ? formatCurrency(Math.max(0, product.priceCents - product.costCents), currency)
                  : 'N/D'}
              </Text>
            </View>
            <View style={styles.econDivider} />
            <View style={styles.econItem}>
              <Text style={styles.econLabel}>Margem</Text>
              <Text
                style={[
                  styles.econValue,
                  {
                    color:
                      (metrics.profitMarginPercentage || 0) >= 50
                        ? colors.success
                        : (metrics.profitMarginPercentage || 0) >= 20
                        ? colors.warning
                        : colors.primaryDark,
                  },
                ]}
              >
                {(metrics.profitMarginPercentage || 0) > 0 ? `${metrics.profitMarginPercentage}%` : 'N/D'}
              </Text>
            </View>
          </View>

          {/* Quick toggle availability bar */}
          <View style={styles.heroToggleRow}>
            <View>
              <Text style={styles.togglePromptTitle}>Disponibilidade de Venda</Text>
              <Text style={styles.togglePromptSub}>
                {product.isAvailable
                  ? 'Aparece normalmente para seleção nos pedidos'
                  : 'Oculto e pausado temporariamente'}
              </Text>
            </View>
            <Switch
              value={product.isAvailable}
              onValueChange={() => toggleMutation.mutate()}
              trackColor={{ false: '#e2d9cf', true: `${colors.primary}66` }}
              thumbColor={product.isAvailable ? colors.primary : '#9e8c7c'}
            />
          </View>
        </Card>

        {/* Sales & Orders Chart Section */}
        <Card style={styles.chartCard}>
          <View style={styles.chartHeaderRow}>
            <View style={styles.chartTitleWrapper}>
              <TrendingUp size={20} color={colors.primary} />
              <Text style={styles.chartSectionTitle}>Desempenho de Vendas</Text>
            </View>
          </View>

          {/* Period Filter Tabs */}
          <View style={styles.periodTabsRow}>
            {PERIOD_TABS.map((tab) => {
              const isSelected = period === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.periodTab, isSelected && styles.periodTabActive]}
                  onPress={() => {
                    if (tab.key === 'custom') {
                      setCustomPeriodModalVisible(true);
                    } else {
                      setPeriod(tab.key);
                      setSelectedBarIndex(null);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.periodTabText,
                      isSelected && styles.periodTabTextActive,
                    ]}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Period Summary Stats */}
          <View style={styles.chartPeriodSummary}>
            <View style={styles.periodStatBox}>
              <Text style={styles.periodStatLabel}>Pedidos no Período</Text>
              <Text style={styles.periodStatValue}>{totalPeriodOrders}</Text>
            </View>
            <View style={styles.periodStatBox}>
              <Text style={styles.periodStatLabel}>Unidades Vendidas</Text>
              <Text style={styles.periodStatValue}>{totalPeriodUnits}</Text>
            </View>
            <View style={styles.periodStatBox}>
              <Text style={styles.periodStatLabel}>Faturamento</Text>
              <Text style={[styles.periodStatValue, { color: colors.primaryDark }]}>
                {formatCurrency(totalPeriodRevenueCents, currency)}
              </Text>
            </View>
          </View>

          {/* Selected Bar Detail Tooltip */}
          {selectedBarIndex !== null && chartData[selectedBarIndex] && (
            <View style={styles.chartTooltip}>
              <Text style={styles.tooltipDate}>
                {chartData[selectedBarIndex].label}
              </Text>
              <View style={styles.tooltipMetricsRow}>
                <Text style={styles.tooltipMetricItem}>
                  📦 {chartData[selectedBarIndex].ordersCount} pedidos
                </Text>
                <Text style={styles.tooltipMetricItem}>
                  🧁 {chartData[selectedBarIndex].unitsSold} {product.unit || 'un.'}
                </Text>
                <Text style={[styles.tooltipMetricItem, { fontWeight: 'bold' }]}>
                  💰 {formatCurrency(chartData[selectedBarIndex].revenueCents, currency)}
                </Text>
              </View>
            </View>
          )}

          {/* Dynamic Bar & Pillar Visualization */}
          {chartData.length > 0 ? (
            <View style={styles.chartVisualizationWrapper}>
              <View style={styles.barsContainer}>
                {chartData.map((point: any, index: number) => {
                  const isSelected = selectedBarIndex === index;
                  // Height scale based on units sold or orderCount
                  const heightPercent =
                    maxUnits > 0 ? Math.min(100, Math.max(12, (point.unitsSold / maxUnits) * 100)) : 12;

                  return (
                    <TouchableOpacity
                      key={index}
                      style={styles.barColumn}
                      activeOpacity={0.8}
                      onPress={() => setSelectedBarIndex(isSelected ? null : index)}
                    >
                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.barFill,
                            { height: `${heightPercent}%` },
                            isSelected && styles.barFillSelected,
                            point.unitsSold === maxUnits && maxUnits > 0 && styles.barFillPeak,
                          ]}
                        />
                      </View>
                      <Text
                        style={[
                          styles.barLabel,
                          isSelected && styles.barLabelSelected,
                        ]}
                        numberOfLines={1}
                      >
                        {point.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={styles.chartHint}>Toque em uma barra para ver detalhes do intervalo</Text>
            </View>
          ) : (
            <View style={styles.emptyChart}>
              <Text style={styles.emptyChartText}>
                Nenhuma venda registrada para o período selecionado.
              </Text>
            </View>
          )}
        </Card>

        {/* All-time Historical Performance Metrics */}
        <View style={styles.metricsGrid}>
          <Card style={styles.metricCard}>
            <View style={[styles.metricIconCircle, { backgroundColor: `${colors.primary}15` }]}>
              <DollarSign size={20} color={colors.primary} />
            </View>
            <Text style={styles.metricLabel}>Total Ganho com Este Produto</Text>
            <Text style={styles.metricMainValue}>
              {formatCurrency(metrics.totalRevenueCents, currency)}
            </Text>
            <Text style={styles.metricSub}>Acumulado de todas as vendas</Text>
          </Card>

          <Card style={styles.metricCard}>
            <View style={[styles.metricIconCircle, { backgroundColor: `${colors.success}15` }]}>
              <TrendingUp size={20} color={colors.success} />
            </View>
            <Text style={styles.metricLabel}>Lucro Total Estimado</Text>
            <Text style={[styles.metricMainValue, { color: colors.success }]}>
              {formatCurrency(metrics.totalProfitCents, currency)}
            </Text>
            <Text style={styles.metricSub}>Descontado o custo dos insumos</Text>
          </Card>

          <Card style={styles.metricCardSmall}>
            <View style={styles.smallMetricRow}>
              <View style={[styles.metricIconCircle, { backgroundColor: `${colors.caramel}15` }]}>
                <ShoppingBag size={18} color={colors.caramel} />
              </View>
              <View>
                <Text style={styles.smallMetricLabel}>Unidades Vendidas</Text>
                <Text style={styles.smallMetricValue}>
                  {metrics.totalUnitsSold} {product.unit || 'un.'}
                </Text>
              </View>
            </View>
          </Card>

          <Card style={styles.metricCardSmall}>
            <View style={styles.smallMetricRow}>
              <View style={[styles.metricIconCircle, { backgroundColor: '#6366f115' }]}>
                <Receipt size={18} color="#6366f1" />
              </View>
              <View>
                <Text style={styles.smallMetricLabel}>Total de Pedidos</Text>
                <Text style={styles.smallMetricValue}>{metrics.totalOrdersCount} pedidos</Text>
              </View>
            </View>
          </Card>
        </View>

        {/* Monthly Sales Goal Progress Card */}
        {metrics.monthlyGoal && (
          <Card style={styles.goalCard}>
            <View style={styles.goalHeaderRow}>
              <View style={styles.goalTitleWrapper}>
                <Target size={20} color={colors.primary} />
                <Text style={styles.cardTitle}>Meta de Vendas deste Mês</Text>
              </View>
              <View style={styles.goalBadge}>
                <Text style={styles.goalBadgeText}>
                  {metrics.monthlyGoal.progressPercentage}% Concluída
                </Text>
              </View>
            </View>

            <View style={styles.goalNumbersRow}>
              <View>
                <Text style={styles.goalNumLabel}>Vendidos este mês</Text>
                <Text style={styles.goalNumValue}>
                  {metrics.monthlyGoal.soldThisMonth} {product.unit || 'un.'}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.goalNumLabel}>Meta do mês</Text>
                <Text style={styles.goalNumValue}>
                  {metrics.monthlyGoal.targetUnits} {product.unit || 'un.'}
                </Text>
              </View>
            </View>

            <ProgressBar
              progress={metrics.monthlyGoal.progressPercentage}
              color={colors.primary}
              height={10}
              style={{ marginVertical: spacing.sm }}
            />

            <View style={styles.goalFooterRow}>
              <Text style={styles.goalRemainingText}>
                {metrics.monthlyGoal.remainingUnits > 0
                  ? `Faltam apenas ${metrics.monthlyGoal.remainingUnits} unidades para bater a meta!`
                  : '🎉 Parabéns! Você bateu a meta deste produto neste mês!'}
              </Text>
              <Text style={styles.goalRevenueThisMonth}>
                {formatCurrency(metrics.monthlyGoal.soldThisMonth * product.priceCents, currency)} gerados
              </Text>
            </View>
          </Card>
        )}

        {/* Ingredients & Cost Breakdown Card */}
        {product.ingredients && product.ingredients.length > 0 && (
          <Card style={styles.sectionCard}>
            <View style={styles.cardTitleWithIcon}>
              <PieChart size={18} color={colors.primary} />
              <Text style={styles.cardTitle}>Composição de Ingredientes</Text>
            </View>
            <Text style={styles.sectionSubtitle}>
              Detalhamento de insumos e custo por unidade para fabricação deste produto:
            </Text>

            <View style={styles.ingredientsList}>
              {product.ingredients.map((ing, idx) => {
                const totalCost = metrics.totalCostCents || product.costCents || 1;
                const percent = Math.round((ing.costCents / totalCost) * 100);

                return (
                  <View key={`${ing.name}_${idx}`} style={styles.ingredientItem}>
                    <View style={styles.ingLeftCol}>
                      <Text style={styles.ingName}>{ing.name}</Text>
                      <Text style={styles.ingPercent}>{percent}% do custo total</Text>
                    </View>
                    <Text style={styles.ingPrice}>
                      {formatCurrency(ing.costCents, currency)}
                    </Text>
                  </View>
                );
              })}
            </View>

            <View style={styles.ingredientTotalRow}>
              <Text style={styles.ingTotalLabel}>Custo Total dos Ingredientes:</Text>
              <Text style={styles.ingTotalValue}>
                {formatCurrency(product.costCents || 0, currency)}
              </Text>
            </View>
          </Card>
        )}

        {/* Flavors Badges Card */}
        {product.flavors && product.flavors.length > 0 && (
          <Card style={styles.sectionCard}>
            <View style={styles.cardTitleWithIcon}>
              <Sparkles size={18} color={colors.primary} />
              <Text style={styles.cardTitle}>Sabores Disponíveis ({product.flavors.length})</Text>
            </View>
            <View style={styles.flavorsPillGrid}>
              {product.flavors.map((flavor, idx) => (
                <View key={idx} style={styles.flavorPill}>
                  <Text style={styles.flavorPillText}>{flavor}</Text>
                </View>
              ))}
            </View>
          </Card>
        )}

        {/* Complements Card */}
        {product.complements && product.complements.length > 0 && (
          <Card style={styles.sectionCard}>
            <View style={styles.cardTitleWithIcon}>
              <Layers size={18} color={colors.primary} />
              <Text style={styles.cardTitle}>Complementos & Adicionais</Text>
            </View>
            <View style={styles.complementsList}>
              {product.complements.map((comp, idx) => (
                <View key={`${comp.name}_${idx}`} style={styles.compRow}>
                  <Text style={styles.compName}>{comp.name}</Text>
                  <Text style={styles.compPrice}>
                    +{formatCurrency(comp.additionalPriceCents, currency)}
                  </Text>
                </View>
              ))}
            </View>
          </Card>
        )}

        {/* Notes Card */}
        {product.notes ? (
          <Card style={styles.sectionCard}>
            <View style={styles.cardTitleWithIcon}>
              <FileText size={18} color={colors.primary} />
              <Text style={styles.cardTitle}>Observações Internas</Text>
            </View>
            <Text style={styles.notesText}>{product.notes}</Text>
          </Card>
        ) : null}

        {/* Recent Orders History Card */}
        <Card style={styles.sectionCard}>
          <View style={styles.cardTitleWithIcon}>
            <Receipt size={18} color={colors.primary} />
            <Text style={styles.cardTitle}>Histórico Recente de Pedidos</Text>
          </View>
          <Text style={styles.sectionSubtitle}>
            Últimos pedidos que incluíram este item no cardápio:
          </Text>

          {recentOrders && recentOrders.length > 0 ? (
            <View style={styles.ordersList}>
              {recentOrders.map((ord) => (
                <TouchableOpacity
                  key={ord.id}
                  style={styles.orderItem}
                  onPress={() => router.push(`/orders/${ord.id}` as any)}
                  activeOpacity={0.7}
                >
                  <View style={styles.orderLeftCol}>
                    <Text style={styles.orderNumberText}>Pedido #{ord.orderNumber}</Text>
                    <Text style={styles.orderCustomerText}>{ord.customerName}</Text>
                    <Text style={styles.orderDateText}>
                      {ord.deliveryDate ? formatDate(ord.deliveryDate) : 'Sem data'}
                    </Text>
                  </View>

                  <View style={styles.orderRightCol}>
                    <Text style={styles.orderQuantityText}>
                      {ord.quantity}x {product.unit || 'un.'}
                    </Text>
                    <Text style={styles.orderTotalText}>
                      {formatCurrency(ord.subtotalCents, currency)}
                    </Text>
                    <ChevronRight size={16} color={colors.textMuted} />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.emptyOrdersBox}>
              <Text style={styles.emptyOrdersText}>
                Nenhum pedido recente registrado para este produto.
              </Text>
            </View>
          )}
        </Card>
      </ScrollView>

      {/* Custom Period Modal */}
      <Modal
        visible={customPeriodModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCustomPeriodModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setCustomPeriodModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filtrar Período Personalizado</Text>
              <TouchableOpacity onPress={() => setCustomPeriodModalVisible(false)}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Data Inicial (AAAA-MM-DD)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Ex: 2026-01-01"
              placeholderTextColor={colors.textMuted}
              value={customStartDate}
              onChangeText={setCustomStartDate}
            />

            <Text style={styles.fieldLabel}>Data Final (AAAA-MM-DD)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Ex: 2026-12-31"
              placeholderTextColor={colors.textMuted}
              value={customEndDate}
              onChangeText={setCustomEndDate}
            />

            <View style={styles.modalButtonsRow}>
              <Button
                title="Cancelar"
                variant="outline"
                onPress={() => {
                  setPeriod('month');
                  setCustomPeriodModalVisible(false);
                }}
                style={{ flex: 1, marginRight: spacing.sm }}
              />
              <Button
                title="Filtrar"
                onPress={() => {
                  if (!customStartDate || !customEndDate) {
                    Alert.alert('Atenção', 'Informe as datas inicial e final.');
                    return;
                  }
                  setPeriod('custom');
                  setCustomPeriodModalVisible(false);
                }}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerButton: {
    width: 38,
    height: 38,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  deleteHeaderBtn: {
    backgroundColor: `${colors.danger}12`,
    borderColor: `${colors.danger}30`,
  },
  headerTitle: {
    flex: 1,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
    textAlign: 'center',
    marginHorizontal: spacing.sm,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  scrollContent: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  heroCard: {
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  heroImage: {
    width: 72,
    height: 72,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    marginRight: spacing.md,
  },
  heroImagePlaceholder: {
    width: 72,
    height: 72,
    borderRadius: borderRadius.md,
    backgroundColor: `${colors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  heroInfo: {
    flex: 1,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  categoryBadge: {
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
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
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  statusBadgeActive: {
    backgroundColor: `${colors.success}15`,
  },
  statusBadgeInactive: {
    backgroundColor: `${colors.textMuted}15`,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: typography.weights.bold,
  },
  heroProductName: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 4,
  },
  heroPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  heroPrice: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  heroUnit: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  economicsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  econItem: {
    flex: 1,
    alignItems: 'center',
  },
  econDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.border,
  },
  econLabel: {
    fontSize: 9,
    textTransform: 'uppercase',
    color: colors.textMuted,
    fontWeight: typography.weights.semibold,
    marginBottom: 2,
  },
  econValue: {
    fontSize: 12,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  heroToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  togglePromptTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  togglePromptSub: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
  },

  // Chart section
  chartCard: {
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.border,
  },
  chartHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  chartTitleWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chartSectionTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  periodTabsRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: 3,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  periodTab: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: borderRadius.sm,
  },
  periodTabActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  periodTabText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  periodTabTextActive: {
    color: colors.primaryDark,
    fontWeight: typography.weights.bold,
  },
  chartPeriodSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fbf8f4',
    borderRadius: borderRadius.md,
    padding: spacing.sm + 2,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#ede4d8',
  },
  periodStatBox: {
    alignItems: 'center',
    flex: 1,
  },
  periodStatLabel: {
    fontSize: 9,
    color: colors.textMuted,
    textTransform: 'uppercase',
    fontWeight: typography.weights.semibold,
  },
  periodStatValue: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginTop: 2,
  },
  chartTooltip: {
    backgroundColor: colors.primaryDark,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    alignItems: 'center',
  },
  tooltipDate: {
    fontSize: 11,
    fontWeight: typography.weights.bold,
    color: '#ffffff',
    marginBottom: 4,
  },
  tooltipMetricsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  tooltipMetricItem: {
    fontSize: 11,
    color: '#fdf7f0',
  },
  chartVisualizationWrapper: {
    marginTop: spacing.xs,
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 140,
    paddingTop: 10,
    paddingBottom: 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
    marginHorizontal: 2,
  },
  barTrack: {
    width: '100%',
    maxWidth: 24,
    height: '100%',
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
    alignItems: 'center',
  },
  barFill: {
    width: '100%',
    backgroundColor: `${colors.primary}60`,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  barFillSelected: {
    backgroundColor: colors.primary,
  },
  barFillPeak: {
    backgroundColor: colors.caramel,
  },
  barLabel: {
    fontSize: 9,
    color: colors.textMuted,
    marginTop: 4,
    textAlign: 'center',
  },
  barLabelSelected: {
    color: colors.primaryDark,
    fontWeight: typography.weights.bold,
  },
  chartHint: {
    fontSize: 10,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  emptyChart: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  emptyChartText: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
  },

  // Metrics Grid
  metricsGrid: {
    gap: spacing.sm,
  },
  metricCard: {
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.border,
  },
  metricIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  metricLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  metricMainValue: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
    marginVertical: 2,
  },
  metricSub: {
    fontSize: 11,
    color: colors.textMuted,
  },
  metricCardSmall: {
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.border,
  },
  smallMetricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  smallMetricLabel: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  smallMetricValue: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },

  // Monthly Sales Goal Card
  goalCard: {
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    backgroundColor: '#fffcf7',
    borderWidth: 1,
    borderColor: '#e8dcce',
  },
  goalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  goalTitleWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  cardTitleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  goalBadge: {
    backgroundColor: `${colors.primary}15`,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  goalBadgeText: {
    fontSize: 10,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  goalNumbersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  goalNumLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  goalNumValue: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  goalFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  goalRemainingText: {
    fontSize: 11,
    color: colors.primaryDark,
    fontWeight: typography.weights.medium,
    flex: 1,
  },
  goalRevenueThisMonth: {
    fontSize: 11,
    fontWeight: typography.weights.bold,
    color: colors.textSecondary,
  },

  // Ingredients Card
  sectionCard: {
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    lineHeight: 16,
  },
  ingredientsList: {
    borderTopWidth: 1,
    borderTopColor: '#f1ebe3',
    paddingTop: spacing.xs,
  },
  ingredientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f7f2ec',
  },
  ingLeftCol: {
    flex: 1,
  },
  ingName: {
    fontSize: typography.sizes.sm,
    color: colors.text,
    fontWeight: typography.weights.medium,
  },
  ingPercent: {
    fontSize: 10,
    color: colors.textMuted,
  },
  ingPrice: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.danger,
  },
  ingredientTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
  },
  ingTotalLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  ingTotalValue: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.danger,
  },

  // Flavors
  flavorsPillGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: spacing.xs,
  },
  flavorPill: {
    backgroundColor: '#f7f1e9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: '#e8dcce',
  },
  flavorPillText: {
    fontSize: 12,
    color: colors.primaryDark,
    fontWeight: typography.weights.semibold,
  },

  // Complements
  complementsList: {
    marginTop: spacing.xs,
  },
  compRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1ebe3',
  },
  compName: {
    fontSize: typography.sizes.sm,
    color: colors.text,
    fontWeight: typography.weights.medium,
  },
  compPrice: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.success,
  },

  // Notes
  notesText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    lineHeight: 20,
    marginTop: spacing.xs,
  },

  // Orders
  ordersList: {
    marginTop: spacing.xs,
  },
  orderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1ebe3',
  },
  orderLeftCol: {
    flex: 1,
  },
  orderNumberText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  orderCustomerText: {
    fontSize: 12,
    color: colors.text,
    marginTop: 1,
  },
  orderDateText: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
  orderRightCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  orderQuantityText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  orderTotalText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  emptyOrdersBox: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  emptyOrdersText: {
    fontSize: 11,
    color: colors.textMuted,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
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
  fieldLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.primaryDark,
    marginBottom: 4,
    marginTop: spacing.sm,
  },
  modalInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    height: 44,
    fontSize: typography.sizes.sm,
    color: colors.text,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    marginTop: spacing.lg,
  },
});
