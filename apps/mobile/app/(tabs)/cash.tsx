import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography, borderRadius } from '../../src/theme';
import { Card } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { Button } from '../../src/components/ui/Button';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { LoadingState } from '../../src/components/ui/LoadingState';
import { api } from '../../src/services/api';
import { useAuthStore } from '../../src/stores/auth.store';
import { usePreferencesStore } from '../../src/stores/preferences.store';
import { formatCurrency, formatDate } from '../../src/utils/formatters';
import { CashSummary, CashTransaction } from '@koki/types';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
  Plus,
  Landmark,
  PiggyBank,
  Receipt,
  Layers,
} from 'lucide-react-native';

export default function CashScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { company } = useAuthStore();
  const { hideValues } = usePreferencesStore();

  const [activeTab, setActiveTab] = useState<'all' | 'income' | 'expense' | 'transfer'>('all');

  // Summary Query
  const {
    data: summary,
    isLoading: loadingSummary,
    isRefetching,
    refetch,
  } = useQuery<CashSummary>({
    queryKey: ['cash-summary'],
    queryFn: () => api.get<CashSummary>('/cash/summary'),
  });

  // Transactions Query
  const { data: transactionsData, isLoading: loadingTx } = useQuery<{
    items: CashTransaction[];
    total: number;
  }>({
    queryKey: ['cash-transactions', activeTab],
    queryFn: () => {
      let url = '/cash/transactions?page=1&limit=30';
      if (activeTab !== 'all') url += `&type=${activeTab}`;
      return api.get(url);
    },
  });

  const currency = company?.currency || 'EUR';
  const accounts = summary?.accounts || [];
  const transactions = transactionsData?.items || [];

  if (loadingSummary && !summary) {
    return <LoadingState message="Carregando finanças..." />;
  }

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={[styles.topHeader, { paddingTop: Math.max(insets.top, 20) + 8 }]}>
        <View>
          <Text style={styles.screenTitle}>Caixa & Finanças</Text>
          <Text style={styles.screenSubtitle}>Gestão financeira e caixinhas</Text>
        </View>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => router.push('/cash/new-transaction')}
          style={styles.newTxBtn}
        >
          <Plus size={18} color="#ffffff" />
          <Text style={styles.newTxBtnText}>Movimentação</Text>
        </TouchableOpacity>
      </View>

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
        {/* Card de Saldo Consolidado */}
        <Card style={styles.consolidatedCard}>
          <Text style={styles.cardLabel}>Saldo Consolidado</Text>
          <Text style={styles.consolidatedBalance}>
            {formatCurrency(summary?.consolidatedBalanceCents || 0, currency, hideValues)}
          </Text>

          <View style={styles.flowRow}>
            <View style={styles.flowItem}>
              <View style={[styles.flowIcon, { backgroundColor: `${colors.success}20` }]}>
                <ArrowDownLeft size={16} color={colors.success} />
              </View>
              <View>
                <Text style={styles.flowLabel}>Entradas</Text>
                <Text style={[styles.flowValue, { color: colors.success }]}>
                  +{formatCurrency(summary?.periodIncomeCents || 0, currency, hideValues)}
                </Text>
              </View>
            </View>

            <View style={styles.flowDivider} />

            <View style={styles.flowItem}>
              <View style={[styles.flowIcon, { backgroundColor: `${colors.danger}20` }]}>
                <ArrowUpRight size={16} color={colors.danger} />
              </View>
              <View>
                <Text style={styles.flowLabel}>Saídas</Text>
                <Text style={[styles.flowValue, { color: colors.danger }]}>
                  -{formatCurrency(summary?.periodExpenseCents || 0, currency, hideValues)}
                </Text>
              </View>
            </View>
          </View>
        </Card>

        {/* Caixinhas & Reservas */}
        <View style={styles.sectionHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <Wallet size={18} color={colors.primary} />
            <Text style={styles.sectionTitle}>Caixinhas e Contas ({accounts.length})</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/cash/accounts')}>
            <Text style={styles.manageText}>Gerenciar</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.accountsRow}
        >
          {accounts.map((acc) => (
            <TouchableOpacity
              key={acc.id}
              activeOpacity={0.8}
              onPress={() => router.push('/cash/accounts')}
              style={styles.accountCard}
            >
              <View style={[styles.accountIcon, { backgroundColor: `${acc.color}25` }]}>
                <Wallet size={18} color={acc.color} />
              </View>
              <Text style={styles.accountName} numberOfLines={1}>
                {acc.name}
              </Text>
              <Text style={styles.accountBalance}>
                {formatCurrency(acc.currentBalanceCents, currency, hideValues)}
              </Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push('/cash/accounts')}
            style={styles.addAccountCard}
          >
            <Plus size={20} color={colors.caramel} />
            <Text style={styles.addAccountText}>Nova Caixinha</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Histórico Financeiro */}
        <View style={[styles.sectionHeader, { marginTop: spacing.md }]}>
          <Text style={styles.sectionTitle}>Extrato Financeiro</Text>
        </View>

        {/* Filter Pills */}
        <View style={styles.filterPills}>
          {[
            { label: 'Tudo', val: 'all' as const },
            { label: 'Entradas', val: 'income' as const },
            { label: 'Saídas', val: 'expense' as const },
            { label: 'Transferências', val: 'transfer' as const },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.val}
              activeOpacity={0.7}
              onPress={() => setActiveTab(tab.val)}
              style={[
                styles.pill,
                activeTab === tab.val && styles.pillActive,
              ]}
            >
              <Text
                style={[
                  styles.pillText,
                  activeTab === tab.val && styles.pillTextActive,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {transactions.length === 0 ? (
          <EmptyState
            icon={<Receipt size={40} color={colors.caramel} />}
            title="Nenhuma movimentação"
            description="Não foram encontradas movimentações para o filtro selecionado."
            actionTitle="Lançar Movimentação"
            onAction={() => router.push('/cash/new-transaction')}
          />
        ) : (
          transactions.map((tx) => {
            const isIncome = tx.type === 'income' || tx.type === 'opening_balance';
            const isExpense = tx.type === 'expense';
            const isTransfer = tx.type === 'transfer';

            return (
              <Card key={tx.id} style={styles.txCard}>
                <View style={styles.txRow}>
                  <View style={styles.txLeft}>
                    <View
                      style={[
                        styles.txIconBadge,
                        isIncome && { backgroundColor: `${colors.success}18` },
                        isExpense && { backgroundColor: `${colors.danger}18` },
                        isTransfer && { backgroundColor: `${colors.caramel}18` },
                      ]}
                    >
                      {isIncome && <ArrowDownLeft size={16} color={colors.success} />}
                      {isExpense && <ArrowUpRight size={16} color={colors.danger} />}
                      {isTransfer && <ArrowLeftRight size={16} color={colors.caramel} />}
                    </View>
                    <View>
                      <Text style={styles.txDescription}>{tx.description}</Text>
                      <Text style={styles.txMeta}>
                        {tx.category} • {formatDate(tx.date)}
                      </Text>
                    </View>
                  </View>

                  <Text
                    style={[
                      styles.txAmount,
                      isIncome && { color: colors.success },
                      isExpense && { color: colors.danger },
                      isTransfer && { color: colors.textSecondary },
                    ]}
                  >
                    {isIncome ? '+' : isExpense ? '-' : ''}
                    {formatCurrency(tx.amountCents, currency, hideValues)}
                  </Text>
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>
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
  newTxBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    gap: 4,
  },
  newTxBtnText: {
    color: '#ffffff',
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  consolidatedCard: {
    padding: spacing.xl,
    marginBottom: spacing.md,
  },
  cardLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  consolidatedBalance: {
    fontSize: typography.sizes.display,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
    marginVertical: spacing.xs,
  },
  flowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  flowItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  flowDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.border,
    marginHorizontal: spacing.sm,
  },
  flowIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flowLabel: {
    fontSize: 10,
    color: colors.textMuted,
  },
  flowValue: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  manageText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  accountsRow: {
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },
  accountCard: {
    width: 130,
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  accountIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  accountName: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
  },
  accountBalance: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
    marginTop: 2,
  },
  addAccountCard: {
    width: 110,
    backgroundColor: `${colors.goldenBeige}25`,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.caramel,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    gap: spacing.xs,
  },
  addAccountText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.caramel,
    textAlign: 'center',
  },
  filterPills: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.md,
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
  txCard: {
    padding: spacing.md,
    marginBottom: spacing.xs + 2,
  },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  txLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  txIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txDescription: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  txMeta: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  txAmount: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    marginLeft: spacing.sm,
  },
});
