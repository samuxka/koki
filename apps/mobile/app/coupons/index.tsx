import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Share,
  Alert,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Ticket,
  Plus,
  Search,
  Share2,
  Trash2,
  Calendar,
  Sparkles,
  ShoppingBag,
  TrendingDown,
  CheckCircle2,
  Clock,
  XCircle,
  PauseCircle,
  PlayCircle,
  Copy,
  Crown,
} from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '../../src/theme';
import { Card, Button, Badge, ProgressBar } from '../../src/components/ui';
import { SkeletonList } from '../../src/components/ui/Skeleton';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { api } from '../../src/services/api';
import { useAuthStore } from '../../src/stores/auth.store';
import { formatCurrency } from '../../src/utils/formatters';
import { Coupon, CouponQuotaResponse, CouponStatus } from '@koki/types';

export default function CouponsListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { company } = useAuthStore();
  const currency = company?.currency || 'EUR';

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Query Coupons Quota
  const { data: quota, refetch: refetchQuota } = useQuery<CouponQuotaResponse>({
    queryKey: ['coupons-quota'],
    queryFn: () => api.get<CouponQuotaResponse>('/coupons/quota'),
  });

  // Query Coupons List
  const {
    data: coupons = [],
    isLoading,
    isRefetching,
    refetch: refetchCoupons,
  } = useQuery<Coupon[]>({
    queryKey: ['coupons-list', statusFilter, search],
    queryFn: () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (search.trim()) params.append('search', search.trim());
      const qs = params.toString() ? `?${params.toString()}` : '';
      return api.get<Coupon[]>(`/coupons${qs}`);
    },
  });

  // Toggle Active Mutation
  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return api.patch<Coupon>(`/coupons/${id}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coupons-list'] });
      queryClient.invalidateQueries({ queryKey: ['coupons-quota'] });
    },
    onError: (err: any) => {
      Alert.alert('Erro', err.message || 'Falha ao atualizar cupom.');
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/coupons/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coupons-list'] });
      queryClient.invalidateQueries({ queryKey: ['coupons-quota'] });
      Alert.alert('Sucesso', 'Cupom excluído com sucesso.');
    },
    onError: (err: any) => {
      Alert.alert('Erro', err.message || 'Falha ao excluir cupom.');
    },
  });

  const handleDelete = (coupon: Coupon) => {
    Alert.alert(
      'Excluir Cupom',
      `Tem certeza que deseja apagar o cupom "${coupon.code}"? Esta ação não pode ser desfeita.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => deleteMutation.mutate(coupon.id),
        },
      ],
    );
  };

  const handleShareCoupon = async (coupon: Coupon) => {
    try {
      const discountText =
        coupon.discountType === 'percentage'
          ? `${coupon.discountValue}% OFF`
          : `${formatCurrency(coupon.discountValue, currency)} de desconto`;

      const minText =
        coupon.minOrderAmountCents && coupon.minOrderAmountCents > 0
          ? `\n*Pedido mínimo:* ${formatCurrency(coupon.minOrderAmountCents, currency)}`
          : '';

      const expiryText = coupon.expiresAt
        ? `\n*Validade:* até ${coupon.expiresAt.split('-').reverse().join('/')}`
        : '';

      const companyName = company?.tradeName || 'nossa confeitaria';

      const message =
        `🎉 *PRESENTE ESPECIAL DA ${companyName.toUpperCase()}!*\n\n` +
        `Use o cupom promocional *${coupon.code}* e ganhe *${discountText}* no seu pedido! 🍰✨\n` +
        `${minText}` +
        `${expiryText}\n\n` +
        `Faça sua encomenda e aproveite! 💕`;

      await Share.share({
        message,
        title: `Cupom ${coupon.code}`,
      });
    } catch (e) {
      console.error(e);
    }
  };

  const getStatusBadge = (status: CouponStatus) => {
    switch (status) {
      case 'active':
        return <Badge color={colors.success} label="Ativo" />;
      case 'expired':
        return <Badge color={colors.danger} label="Expirado" />;
      case 'depleted':
        return <Badge color={colors.warning} label="Esgotado" />;
      case 'inactive':
      default:
        return <Badge color={colors.textMuted} label="Pausado" />;
    }
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
            <Text style={styles.headerTitle}>Cupons de Desconto</Text>
            <Text style={styles.headerSubtitle}>Promoções e códigos para clientes</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.createHeaderBtn}
          onPress={() => router.push('/coupons/new' as any)}
          activeOpacity={0.8}
        >
          <Plus size={18} color="#ffffff" style={{ marginRight: 4 }} />
          <Text style={styles.createHeaderBtnText}>Novo</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 20) + 40 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading || isRefetching}
            onRefresh={() => {
              refetchCoupons();
              refetchQuota();
            }}
            colors={[colors.primary]}
          />
        }
      >
        {/* Quota Banner */}
        {quota && (
          <View style={styles.quotaCard}>
            <View style={styles.quotaHeader}>
              <View style={styles.quotaTitleRow}>
                <Ticket size={16} color={colors.primary} style={{ marginRight: 6 }} />
                <Text style={styles.quotaTitle}>
                  Cupons Ativos ({quota.tier === 'business' ? 'Ilimitado' : `${quota.activeCouponsCount} / ${quota.activeCouponsLimit}`})
                </Text>
              </View>
              <Badge
                color={quota.canCreate ? colors.success : colors.warning}
                label={quota.tier.toUpperCase()}
              />
            </View>

            {quota.activeCouponsLimit > 0 && (
              <View style={styles.quotaProgressBox}>
                <ProgressBar
                  progress={quota.activeCouponsCount / quota.activeCouponsLimit}
                  color={quota.activeCouponsCount >= quota.activeCouponsLimit ? colors.warning : colors.primary}
                />
              </View>
            )}

            {!quota.canCreate && quota.activeCouponsLimit === 0 && (
              <View style={styles.upgradeNotice}>
                <Crown size={14} color={colors.caramel} style={{ marginRight: 6 }} />
                <Text style={styles.upgradeNoticeText}>
                  Faça upgrade para o plano <Text style={{ fontWeight: 'bold' }}>Pro</Text> para ativar cupons promocionais para seus clientes!
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Search & Filter Bar */}
        <View style={styles.searchBox}>
          <Search size={16} color={colors.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por código ou descrição..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <XCircle size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Status Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterScrollContent}
        >
          {[
            { id: 'all', label: 'Todos' },
            { id: 'active', label: 'Ativos' },
            { id: 'expired', label: 'Expirados' },
            { id: 'depleted', label: 'Esgotados' },
            { id: 'inactive', label: 'Pausados' },
          ].map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.filterChip,
                statusFilter === item.id && styles.filterChipActive,
              ]}
              onPress={() => setStatusFilter(item.id)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  statusFilter === item.id && styles.filterChipTextActive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Loading Skeleton */}
        {isLoading && <SkeletonList />}

        {/* Empty State */}
        {!isLoading && coupons.length === 0 && (
          <EmptyState
            title="Nenhum cupom encontrado"
            description={
              search
                ? 'Nenhum cupom corresponde à sua busca.'
                : 'Crie cupons promocionais com porcentagem ou valor fixo para presentear seus clientes e aumentar suas vendas!'
            }
            actionTitle="Criar Cupom"
            onAction={() => router.push('/coupons/new' as any)}
          />
        )}

        {/* Coupon Ticket Cards */}
        {!isLoading &&
          coupons.map((coupon) => {
            const isPercent = coupon.discountType === 'percentage';
            const usageProgress =
              coupon.usageLimit && coupon.usageLimit > 0
                ? Math.min(1, coupon.usageCount / coupon.usageLimit)
                : 0;

            return (
              <Card key={coupon.id} style={styles.ticketCard}>
                {/* Ticket Top Half */}
                <View style={styles.ticketMain}>
                  {/* Left Column: Big Discount Badge */}
                  <View style={styles.discountBadgeCol}>
                    <Text style={styles.discountBigNumber}>
                      {isPercent ? `${coupon.discountValue}%` : formatCurrency(coupon.discountValue, currency)}
                    </Text>
                    <Text style={styles.discountBigLabel}>
                      {isPercent ? 'DESCONTO' : 'OFF'}
                    </Text>
                  </View>

                  {/* Right Column: Code & Rules */}
                  <View style={styles.ticketDetailsCol}>
                    <View style={styles.codeRow}>
                      <View style={styles.codeBox}>
                        <Ticket size={13} color={colors.primary} style={{ marginRight: 4 }} />
                        <Text style={styles.codeText}>{coupon.code}</Text>
                      </View>
                      {getStatusBadge(coupon.computedStatus)}
                    </View>

                    {coupon.description ? (
                      <Text style={styles.ticketDescription} numberOfLines={2}>
                        {coupon.description}
                      </Text>
                    ) : null}

                    {/* Metadata lines */}
                    <View style={styles.ticketMetaRow}>
                      {coupon.minOrderAmountCents && coupon.minOrderAmountCents > 0 ? (
                        <View style={styles.metaBadge}>
                          <ShoppingBag size={11} color={colors.textSecondary} style={{ marginRight: 3 }} />
                          <Text style={styles.metaText}>
                            Min: {formatCurrency(coupon.minOrderAmountCents, currency)}
                          </Text>
                        </View>
                      ) : null}

                      {coupon.expiresAt ? (
                        <View style={styles.metaBadge}>
                          <Clock size={11} color={colors.textSecondary} style={{ marginRight: 3 }} />
                          <Text style={styles.metaText}>
                            Até {coupon.expiresAt.split('-').reverse().join('/')}
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.metaBadge}>
                          <Sparkles size={11} color={colors.textSecondary} style={{ marginRight: 3 }} />
                          <Text style={styles.metaText}>Sem expiração</Text>
                        </View>
                      )}
                    </View>

                    {/* Usage Progress */}
                    {coupon.usageLimit && coupon.usageLimit > 0 ? (
                      <View style={styles.usageContainer}>
                        <View style={styles.usageTextRow}>
                          <Text style={styles.usageLabel}>Utilizações</Text>
                          <Text style={styles.usageValue}>
                            {coupon.usageCount} / {coupon.usageLimit}
                          </Text>
                        </View>
                        <ProgressBar progress={usageProgress} color={colors.caramel} />
                      </View>
                    ) : (
                      <Text style={styles.unlimitedUsageText}>
                        Usado {coupon.usageCount} vez(es) • Ilimitado
                      </Text>
                    )}
                  </View>
                </View>

                {/* Perforated Divider Line */}
                <View style={styles.perforationRow}>
                  <View style={styles.notchLeft} />
                  <View style={styles.dashedLine} />
                  <View style={styles.notchRight} />
                </View>

                {/* Ticket Actions Footer */}
                <View style={styles.ticketFooter}>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => handleShareCoupon(coupon)}
                    activeOpacity={0.7}
                  >
                    <Share2 size={15} color={colors.primary} style={{ marginRight: 4 }} />
                    <Text style={styles.actionBtnText}>WhatsApp</Text>
                  </TouchableOpacity>

                  <View style={styles.footerRightBtns}>
                    <TouchableOpacity
                      style={styles.actionIconBtn}
                      onPress={() =>
                        toggleMutation.mutate({
                          id: coupon.id,
                          isActive: !coupon.isActive,
                        })
                      }
                      activeOpacity={0.7}
                    >
                      {coupon.isActive ? (
                        <PauseCircle size={18} color={colors.warning} />
                      ) : (
                        <PlayCircle size={18} color={colors.success} />
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.actionIconBtn}
                      onPress={() => handleDelete(coupon)}
                      activeOpacity={0.7}
                    >
                      <Trash2 size={16} color={colors.danger} />
                    </TouchableOpacity>
                  </View>
                </View>
              </Card>
            );
          })}
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
    justifyContent: 'space-between',
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
  createHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
  },
  createHeaderBtnText: {
    color: '#ffffff',
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
  },
  quotaCard: {
    backgroundColor: '#fffdf9',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#f0ddbe',
    marginBottom: spacing.md,
  },
  quotaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quotaTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quotaTitle: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  quotaProgressBox: {
    marginTop: spacing.sm,
  },
  upgradeNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    backgroundColor: '#fff8ea',
    padding: 8,
    borderRadius: borderRadius.sm,
  },
  upgradeNoticeText: {
    fontSize: 11,
    color: colors.textSecondary,
    flex: 1,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.text,
  },
  filterScroll: {
    marginBottom: spacing.md,
  },
  filterScrollContent: {
    flexDirection: 'row',
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
  },
  filterChipTextActive: {
    color: colors.textInverse,
  },
  ticketCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 0,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  ticketMain: {
    flexDirection: 'row',
    padding: spacing.md,
  },
  discountBadgeCol: {
    width: 84,
    backgroundColor: '#fff2df',
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: '#f5ddbc',
    marginRight: spacing.md,
  },
  discountBigNumber: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.primary,
    textAlign: 'center',
  },
  discountBigLabel: {
    fontSize: 10,
    fontWeight: typography.weights.bold,
    color: colors.caramel,
    marginTop: 2,
    letterSpacing: 0.5,
  },
  ticketDetailsCol: {
    flex: 1,
    justifyContent: 'center',
  },
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  codeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5ece0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: '#e8dbcb',
  },
  codeText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
    letterSpacing: 0.8,
  },
  ticketDescription: {
    fontSize: typography.sizes.xs,
    color: colors.text,
    marginBottom: 6,
  },
  ticketMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#faf6f0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  metaText: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  usageContainer: {
    marginTop: 2,
  },
  usageTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  usageLabel: {
    fontSize: 10,
    color: colors.textMuted,
  },
  usageValue: {
    fontSize: 10,
    fontWeight: typography.weights.bold,
    color: colors.textSecondary,
  },
  unlimitedUsageText: {
    fontSize: 10,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  perforationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 16,
    position: 'relative',
  },
  notchLeft: {
    width: 12,
    height: 16,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    backgroundColor: colors.background,
    marginLeft: -1,
  },
  dashedLine: {
    flex: 1,
    height: 1,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#e0d5c5',
  },
  notchRight: {
    width: 12,
    height: 16,
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
    backgroundColor: colors.background,
    marginRight: -1,
  },
  ticketFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    backgroundColor: '#faf7f2',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionBtnText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.primary,
  },
  footerRightBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
