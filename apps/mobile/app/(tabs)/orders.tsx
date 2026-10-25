import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography, borderRadius } from '../../src/theme';
import { Card } from '../../src/components/ui/Card';
import { Input } from '../../src/components/ui/Input';
import { Badge } from '../../src/components/ui/Badge';
import { Button } from '../../src/components/ui/Button';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { LoadingState } from '../../src/components/ui/LoadingState';
import { api } from '../../src/services/api';
import { useAuthStore } from '../../src/stores/auth.store';
import { usePreferencesStore } from '../../src/stores/preferences.store';
import { formatCurrency, formatDateTime } from '../../src/utils/formatters';
import { Order, PaginatedResponse } from '@koki/types';
import {
  Search,
  Filter,
  Plus,
  ShoppingBag,
  TrendingUp,
  Clock,
  CheckCircle2,
  X,
} from 'lucide-react-native';

export default function OrdersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { company } = useAuthStore();
  const { hideValues } = usePreferencesStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [operationalStatus, setOperationalStatus] = useState<string>('all');
  const [financialStatus, setFinancialStatus] = useState<string>('all');
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const {
    data: ordersData,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery<PaginatedResponse<Order>>({
    queryKey: ['orders-list', debouncedSearch, operationalStatus, financialStatus],
    queryFn: () => {
      let url = `/orders?page=1&limit=50`;
      if (debouncedSearch) url += `&search=${encodeURIComponent(debouncedSearch)}`;
      if (operationalStatus !== 'all') url += `&operationalStatus=${operationalStatus}`;
      if (financialStatus !== 'all') url += `&financialStatus=${financialStatus}`;
      return api.get<PaginatedResponse<Order>>(url);
    },
  });

  const currency = company?.currency || 'EUR';
  const orders = ordersData?.items || [];

  // Indicators calculations
  const pendingCount = orders.filter(
    (o) => o.operationalStatus === 'pending' || o.operationalStatus === 'in_production',
  ).length;
  const paidCount = orders.filter((o) => o.financialStatus === 'paid').length;

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={[styles.topHeader, { paddingTop: Math.max(insets.top, 20) + 8 }]}>
        <View>
          <Text style={styles.screenTitle}>Gestão de Pedidos</Text>
          <Text style={styles.screenSubtitle}>
            {ordersData?.total || 0} pedidos cadastrados
          </Text>
        </View>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => router.push('/orders/new')}
          style={styles.addOrderBtn}
        >
          <Plus size={20} color="#ffffff" />
          <Text style={styles.addOrderBtnText}>Novo Pedido</Text>
        </TouchableOpacity>
      </View>

      {/* Cards Indicadores */}
      <View style={styles.metricsRow}>
        <Card style={styles.metricCard}>
          <View style={styles.metricHeader}>
            <ShoppingBag size={16} color={colors.primary} />
            <Text style={styles.metricTitle}>Total</Text>
          </View>
          <Text style={styles.metricValue}>{ordersData?.total || 0}</Text>
        </Card>

        <Card style={styles.metricCard}>
          <View style={styles.metricHeader}>
            <Clock size={16} color={colors.warning} />
            <Text style={styles.metricTitle}>Pendentes</Text>
          </View>
          <Text style={[styles.metricValue, { color: colors.warning }]}>{pendingCount}</Text>
        </Card>

        <Card style={styles.metricCard}>
          <View style={styles.metricHeader}>
            <CheckCircle2 size={16} color={colors.success} />
            <Text style={styles.metricTitle}>Quitados</Text>
          </View>
          <Text style={[styles.metricValue, { color: colors.success }]}>{paidCount}</Text>
        </Card>
      </View>

      {/* Search & Filter Bar */}
      <View style={styles.searchRow}>
        <View style={styles.searchInputWrapper}>
          <Input
            placeholder="Buscar por cliente, nº do pedido..."
            value={searchTerm}
            onChangeText={setSearchTerm}
            leftIcon={<Search size={18} color={colors.textMuted} />}
            containerStyle={{ marginBottom: 0 }}
          />
        </View>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setFilterModalVisible(true)}
          style={[
            styles.filterBtn,
            (operationalStatus !== 'all' || financialStatus !== 'all') && styles.filterBtnActive,
          ]}
        >
          <Filter
            size={18}
            color={
              operationalStatus !== 'all' || financialStatus !== 'all'
                ? '#ffffff'
                : colors.primary
            }
          />
        </TouchableOpacity>
      </View>

      {/* Orders List */}
      {isLoading ? (
        <LoadingState message="Carregando pedidos..." />
      ) : orders.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag size={48} color={colors.caramel} />}
          title="Nenhum pedido encontrado"
          description={
            searchTerm || operationalStatus !== 'all'
              ? 'Tente ajustar os filtros ou termo de busca.'
              : 'Comece criando o primeiro pedido da sua confeitaria!'
          }
          actionTitle="Novo Pedido"
          onAction={() => router.push('/orders/new')}
        />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => {
                refetch();
              }}
              tintColor={colors.primary}
            />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.push(`/orders/${item.id}` as any)}
            >
              <Card style={styles.orderItemCard}>
                <View style={styles.itemHeader}>
                  <View style={styles.numberBadge}>
                    <Text style={styles.numberText}>#{item.orderNumber}</Text>
                  </View>
                  <View style={styles.badgesGroup}>
                    <Badge status={item.operationalStatus} />
                    <Badge status={item.financialStatus} />
                  </View>
                </View>

                <Text style={styles.customerName}>{item.customerName}</Text>

                {item.items && item.items.length > 0 && (
                  <Text style={styles.itemsSummary} numberOfLines={1}>
                    {item.items.map((i) => `${i.quantity}x ${i.productName}`).join(', ')}
                  </Text>
                )}

                <View style={styles.itemDivider} />

                <View style={styles.itemFooter}>
                  <View>
                    <Text style={styles.footerLabel}>Entrega</Text>
                    <Text style={styles.footerValue}>{formatDateTime(item.deliveryDate)}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.footerLabel}>Total</Text>
                    <Text style={styles.totalValue}>
                      {formatCurrency(item.totalAmountCents, currency, hideValues)}
                    </Text>
                  </View>
                </View>

                {item.remainingAmountCents > 0 && (
                  <View style={styles.remainingBanner}>
                    <Text style={styles.remainingText}>
                      Restante a receber:{' '}
                      <Text style={{ fontWeight: typography.weights.bold }}>
                        {formatCurrency(item.remainingAmountCents, currency, hideValues)}
                      </Text>
                    </Text>
                  </View>
                )}
              </Card>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Filter Modal */}
      <Modal visible={filterModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filtrar Pedidos</Text>
              <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.filterSectionTitle}>Status Operacional</Text>
            <View style={styles.pillRow}>
              {[
                { label: 'Todos', val: 'all' },
                { label: 'Pendente', val: 'pending' },
                { label: 'Em Produção', val: 'in_production' },
                { label: 'Pronto', val: 'ready' },
                { label: 'Entregue', val: 'delivered' },
                { label: 'Cancelado', val: 'canceled' },
              ].map((s) => (
                <TouchableOpacity
                  key={s.val}
                  onPress={() => setOperationalStatus(s.val)}
                  style={[
                    styles.pill,
                    operationalStatus === s.val && styles.pillActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.pillText,
                      operationalStatus === s.val && styles.pillTextActive,
                    ]}
                  >
                    {s.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.filterSectionTitle, { marginTop: spacing.md }]}>
              Status Financeiro
            </Text>
            <View style={styles.pillRow}>
              {[
                { label: 'Todos', val: 'all' },
                { label: 'Pago', val: 'paid' },
                { label: 'Parcial', val: 'partial' },
                { label: 'Não Pago', val: 'unpaid' },
              ].map((s) => (
                <TouchableOpacity
                  key={s.val}
                  onPress={() => setFinancialStatus(s.val)}
                  style={[
                    styles.pill,
                    financialStatus === s.val && styles.pillActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.pillText,
                      financialStatus === s.val && styles.pillTextActive,
                    ]}
                  >
                    {s.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalBtnRow}>
              <Button
                title="Limpar Filtros"
                variant="outline"
                onPress={() => {
                  setOperationalStatus('all');
                  setFinancialStatus('all');
                  setFilterModalVisible(false);
                }}
                style={{ flex: 1 }}
              />
              <Button
                title="Aplicar"
                onPress={() => setFilterModalVisible(false)}
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
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
  },
  screenTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  screenSubtitle: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
  },
  addOrderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    gap: 4,
  },
  addOrderBtnText: {
    color: '#ffffff',
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
  metricsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  metricCard: {
    flex: 1,
    padding: spacing.md,
    marginBottom: spacing.xs,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  metricTitle: {
    fontSize: 11,
    color: colors.textMuted,
  },
  metricValue: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  searchRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  searchInputWrapper: {
    flex: 1,
  },
  filterBtn: {
    width: 48,
    height: 48,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  orderItemCard: {
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  numberBadge: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  numberText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  badgesGroup: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  customerName: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginTop: spacing.xs,
  },
  itemsSummary: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  itemDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerLabel: {
    fontSize: 10,
    color: colors.textMuted,
  },
  footerValue: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
  },
  totalValue: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  remainingBanner: {
    backgroundColor: `${colors.danger}12`,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
    marginTop: spacing.sm,
  },
  remainingText: {
    fontSize: 11,
    color: colors.danger,
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
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  filterSectionTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.primaryDark,
    marginBottom: spacing.xs,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#ffffff',
  },
  pillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pillText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  pillTextActive: {
    color: '#ffffff',
    fontWeight: typography.weights.bold,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
});
