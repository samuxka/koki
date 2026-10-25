import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { colors, spacing, typography, borderRadius } from '../../src/theme';
import { Header } from '../../src/components/ui/Header';
import { Card } from '../../src/components/ui/Card';
import { ProgressBar } from '../../src/components/ui/ProgressBar';
import { Badge } from '../../src/components/ui/Badge';
import { Button } from '../../src/components/ui/Button';
import { CurrencyInput } from '../../src/components/ui/CurrencyInput';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { LoadingState } from '../../src/components/ui/LoadingState';
import { api } from '../../src/services/api';
import { usePreferencesStore } from '../../src/stores/preferences.store';
import { formatCurrency, formatDateTime } from '../../src/utils/formatters';
import { DashboardOverview } from '@koki/types';
import {
  TrendingUp,
  Wallet,
  Clock,
  ArrowRight,
  Plus,
  Edit2,
  Calendar,
  AlertCircle,
  Users,
  Package,
} from 'lucide-react-native';

export default function DashboardScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hideValues } = usePreferencesStore();

  const [period, setPeriod] = useState<'7d' | '30d' | 'month'>('7d');
  const [goalModalVisible, setGoalModalVisible] = useState(false);
  const [newGoalCents, setNewGoalCents] = useState(0);

  // Queries
  const {
    data: overview,
    isLoading: loadingOverview,
    isRefetching,
    refetch,
  } = useQuery<DashboardOverview>({
    queryKey: ['dashboard-overview'],
    queryFn: () => api.get<DashboardOverview>('/dashboard/overview'),
  });

  const { data: chartData } = useQuery<{ date: string; count: number }[]>({
    queryKey: ['dashboard-chart', period],
    queryFn: () => api.get(`/dashboard/orders-chart?period=${period}`),
  });

  // Goal update mutation
  const updateGoalMutation = useMutation({
    mutationFn: (cents: number) =>
      api.put('/companies/current/sales-goal', { monthlySalesGoalCents: cents }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      setGoalModalVisible(false);
    },
  });

  if (loadingOverview && !overview) {
    return <LoadingState message="Carregando painel do Koki..." />;
  }

  const currency = overview?.company?.currency || 'EUR';
  const salesGoal = overview?.salesGoal;

  return (
    <View style={styles.container}>
      <Header />

      <ScrollView
        contentContainerStyle={styles.scroll}
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
        {/* Card - Meta de Vendas */}
        <Card style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={styles.iconCircle}>
                <TrendingUp size={20} color={colors.primary} />
              </View>
              <Text style={styles.cardTitle}>Meta de Vendas do Mês</Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                setNewGoalCents(salesGoal?.monthlySalesGoalCents || 0);
                setGoalModalVisible(true);
              }}
              style={styles.editIconBtn}
            >
              <Edit2 size={16} color={colors.caramel} />
            </TouchableOpacity>
          </View>

          <View style={styles.goalValuesRow}>
            <View>
              <Text style={styles.metaLabel}>Vendido</Text>
              <Text style={styles.goalSoldValue}>
                {formatCurrency(salesGoal?.currentMonthSoldCents || 0, currency, hideValues)}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.metaLabel}>Meta Mensal</Text>
              <Text style={styles.goalTotalValue}>
                {formatCurrency(salesGoal?.monthlySalesGoalCents || 0, currency, hideValues)}
              </Text>
            </View>
          </View>

          <ProgressBar
            progress={salesGoal?.progressPercentage || 0}
            color={colors.primary}
            height={10}
            style={styles.progressBar}
          />

          <View style={styles.goalFooter}>
            <Text style={styles.goalProgressText}>
              {salesGoal?.progressPercentage || 0}% alcançado
            </Text>
            <Text style={styles.goalRemainingText}>
              Faltam{' '}
              {formatCurrency(salesGoal?.remainingCents || 0, currency, hideValues)}
            </Text>
          </View>
        </Card>

        {/* Card - Saldo Consolidado */}
        <Card style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={[styles.iconCircle, { backgroundColor: `${colors.success}18` }]}>
                <Wallet size={20} color={colors.success} />
              </View>
              <Text style={styles.cardTitle}>Saldo em Caixa</Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => router.push('/(tabs)/cash')}
              style={styles.cashLink}
            >
              <Text style={styles.cashLinkText}>Ver caixinhas</Text>
              <ArrowRight size={14} color={colors.primary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.balanceValue}>
            {formatCurrency(overview?.totalBalanceCents || 0, currency, hideValues)}
          </Text>
          <Text style={styles.balanceDesc}>Saldo consolidado em todas as caixinhas ativas</Text>
        </Card>

        {/* Gráfico - Quantidade de Pedidos */}
        <Card style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={[styles.iconCircle, { backgroundColor: `${colors.caramel}20` }]}>
                <Calendar size={20} color={colors.caramel} />
              </View>
              <Text style={styles.cardTitle}>Volume de Pedidos</Text>
            </View>
          </View>

          {/* Filtros de período */}
          <View style={styles.periodTabs}>
            {[
              { label: '7 dias', val: '7d' as const },
              { label: '30 dias', val: '30d' as const },
              { label: 'Mês', val: 'month' as const },
            ].map((p) => (
              <TouchableOpacity
                key={p.val}
                activeOpacity={0.7}
                onPress={() => setPeriod(p.val)}
                style={[styles.periodTab, period === p.val && styles.periodTabActive]}
              >
                <Text
                  style={[
                    styles.periodTabText,
                    period === p.val && styles.periodTabTextActive,
                  ]}
                >
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Gráfico de barras simples e fluido */}
          <View style={styles.chartContainer}>
            {chartData && chartData.length > 0 ? (
              <View style={styles.barsRow}>
                {chartData.slice(-7).map((point, idx) => {
                  const maxCount = Math.max(...chartData.map((d) => d.count), 1);
                  const barHeight = Math.max(8, Math.round((point.count / maxCount) * 80));
                  return (
                    <View key={idx} style={styles.barCol}>
                      <Text style={styles.barValue}>{point.count > 0 ? point.count : ''}</Text>
                      <View style={[styles.barFill, { height: barHeight }]} />
                      <Text style={styles.barLabel}>{point.date.slice(8, 10)}</Text>
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.chartEmpty}>Nenhum pedido no período</Text>
            )}
          </View>
        </Card>

        {/* Pedidos Pendentes e Urgentes */}
        <View style={styles.sectionHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <Clock size={18} color={colors.warning} />
            <Text style={styles.sectionTitle}>
              Pedidos que Precisam de Atenção ({overview?.pendingOrdersCount || 0})
            </Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/(tabs)/orders')}>
            <Text style={styles.seeAllText}>Ver todos</Text>
          </TouchableOpacity>
        </View>

        {overview?.urgentOrders && overview.urgentOrders.length > 0 ? (
          overview.urgentOrders.map((order) => (
            <TouchableOpacity
              key={order.id}
              activeOpacity={0.8}
              onPress={() => router.push(`/orders/${order.id}` as any)}
            >
              <Card style={styles.orderCard}>
                <View style={styles.orderCardHeader}>
                  <Text style={styles.orderNumber}>#{order.orderNumber}</Text>
                  <Badge status={order.operationalStatus} />
                </View>
                <Text style={styles.orderCustomer}>{order.customerName}</Text>
                <View style={styles.orderFooter}>
                  <Text style={styles.orderDate}>
                    Entrega: {formatDateTime(order.deliveryDate)}
                  </Text>
                  <Text style={styles.orderAmount}>
                    {formatCurrency(order.totalAmountCents, currency, hideValues)}
                  </Text>
                </View>
              </Card>
            </TouchableOpacity>
          ))
        ) : (
          <Card style={styles.emptyCard}>
            <AlertCircle size={24} color={colors.success} style={{ marginBottom: spacing.xs }} />
            <Text style={styles.emptyCardTitle}>Tudo em dia!</Text>
            <Text style={styles.emptyCardDesc}>Não há pedidos pendentes urgentes no momento.</Text>
          </Card>
        )}
      </ScrollView>

      {/* Modal para editar meta */}
      <Modal visible={goalModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Editar Meta de Vendas</Text>
            <Text style={styles.modalSubtitle}>
              Defina seu objetivo financeiro mensal para a confeitaria
            </Text>

            <CurrencyInput
              label="Nova Meta Mensal"
              cents={newGoalCents}
              onChangeCents={setNewGoalCents}
              currency={currency}
            />

            <View style={styles.modalBtnRow}>
              <Button
                title="Cancelar"
                variant="outline"
                onPress={() => setGoalModalVisible(false)}
                style={{ flex: 1 }}
              />
              <Button
                title="Salvar Meta"
                loading={updateGoalMutation.isPending}
                onPress={() => updateGoalMutation.mutate(newGoalCents)}
                style={{ flex: 1 }}
              />
            </View>
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
  scroll: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xxl,
  },
  card: {
    marginBottom: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: `${colors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: typography.sizes.sm + 1,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  editIconBtn: {
    padding: spacing.xs,
  },
  goalValuesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  metaLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
  },
  goalSoldValue: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.primary,
    marginTop: 2,
  },
  goalTotalValue: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
    marginTop: 2,
  },
  progressBar: {
    marginVertical: spacing.xs,
  },
  goalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  goalProgressText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  goalRemainingText: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
  },
  cashLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cashLinkText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  balanceValue: {
    fontSize: 24,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
    letterSpacing: -0.5,
  },
  balanceDesc: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  periodTabs: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: 3,
    marginBottom: spacing.sm,
  },
  periodTab: {
    flex: 1,
    paddingVertical: 5,
    alignItems: 'center',
    borderRadius: borderRadius.sm,
  },
  periodTabActive: {
    backgroundColor: '#ffffff',
  },
  periodTabText: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    fontWeight: typography.weights.medium,
  },
  periodTabTextActive: {
    color: colors.primary,
    fontWeight: typography.weights.bold,
  },
  chartContainer: {
    height: 85,
    justifyContent: 'flex-end',
    paddingTop: spacing.xs,
  },
  barsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 100,
    paddingHorizontal: spacing.sm,
  },
  barCol: {
    alignItems: 'center',
    width: 32,
  },
  barValue: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.primary,
    marginBottom: 4,
  },
  barFill: {
    width: 14,
    backgroundColor: colors.caramel,
    borderRadius: 7,
  },
  barLabel: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 4,
  },
  chartEmpty: {
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: typography.sizes.sm,
    paddingVertical: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  seeAllText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  orderCard: {
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  orderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderNumber: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  orderCustomer: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginVertical: spacing.xs,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  orderDate: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
  },
  orderAmount: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyCardTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  emptyCardDesc: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.xxl,
  },
  modalTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  modalSubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    marginBottom: spacing.lg,
    marginTop: 2,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
});
