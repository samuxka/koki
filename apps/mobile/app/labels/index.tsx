import React, { useState } from 'react';
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
  Plus,
  Search,
  Tag,
  Printer,
  Calendar,
  Clock,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  PackageCheck,
  Share2,
} from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '../../src/theme';
import { Card, Badge, ProgressBar, LoadingState, EmptyState } from '../../src/components/ui';
import { PlansModal } from '../../src/components/PlansModal';
import { api } from '../../src/services/api';
import { LabelBatch, LabelQuotaResponse } from '@koki/types';

export default function LabelsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expiring_soon' | 'expired'>('all');
  const [plansModalVisible, setPlansModalVisible] = useState(false);

  // Query batches
  const {
    data: batches = [],
    isLoading: loadingBatches,
    refetch: refetchBatches,
    isRefetching,
  } = useQuery<LabelBatch[]>({
    queryKey: ['label-batches', search, statusFilter],
    queryFn: () =>
      api.get<LabelBatch[]>(
        `/labels/batches?search=${encodeURIComponent(search)}&status=${statusFilter}`,
      ),
  });

  // Query monthly quota
  const { data: quota, refetch: refetchQuota } = useQuery<LabelQuotaResponse>({
    queryKey: ['labels-quota'],
    queryFn: () => api.get<LabelQuotaResponse>('/labels/quota'),
  });

  const onRefresh = async () => {
    await Promise.all([refetchBatches(), refetchQuota()]);
  };

  const handleShareBatch = async (batch: LabelBatch) => {
    try {
      const message = `🏷️ *ETIQUETA DE PRODUTO & LOTE*\n\n` +
        `*Produto:* ${batch.productName}\n` +
        `*Lote:* ${batch.batchCode}\n` +
        `*Fabrico:* ${batch.productionDate}\n` +
        `*Validade:* ${batch.expiryDate}\n` +
        (batch.netWeight ? `*Peso Líquido:* ${batch.netWeight}\n` : '') +
        `*Conservação:* ${batch.storageCondition}\n` +
        (batch.ingredientsText ? `*Ingredientes:* ${batch.ingredientsText}\n` : '') +
        (batch.allergensText ? `*ALÉRGICOS:* ${batch.allergensText}\n` : '') +
        `*Quantidade emitida:* ${batch.quantity} un\n\n` +
        `_Gerado com precisão pelo app Koki._`;

      await Share.share({
        message,
        title: `Etiqueta ${batch.batchCode} - ${batch.productName}`,
      });
    } catch (error) {
      console.error(error);
    }
  };

  const getStatusBadge = (batch: LabelBatch) => {
    switch (batch.status) {
      case 'expired':
        return <Badge color={colors.danger} label="Vencido" />;
      case 'expiring_soon':
        return <Badge color={colors.warning} label="Vence em Breve" />;
      case 'depleted':
        return <Badge color={colors.textMuted} label="Esgotado" />;
      case 'active':
      default:
        return <Badge color={colors.success} label="Válido" />;
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
            <Text style={styles.headerTitle}>Etiquetas & Lotes</Text>
            <Text style={styles.headerSubtitle}>Validade, rastreio e impressão</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.newButton}
          onPress={() => router.push('/labels/new' as any)}
          activeOpacity={0.8}
        >
          <Plus size={18} color={colors.textInverse} />
          <Text style={styles.newButtonText}>Novo Lote</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Quota & Plan Card */}
        {quota && (
          <Card style={styles.quotaCard}>
            <View style={styles.quotaHeader}>
              <View style={styles.quotaTitleRow}>
                <Tag size={18} color={colors.primary} style={{ marginRight: 6 }} />
                <Text style={styles.quotaTitle}>Franquia de Etiquetas do Mês</Text>
              </View>
              <Badge
                color={quota.tier === 'business' ? colors.success : quota.tier === 'pro' ? colors.caramel : colors.textSecondary}
                label={`Plano ${quota.tier.toUpperCase()}`}
              />
            </View>

            <View style={styles.quotaProgressSection}>
              <View style={styles.quotaNumbersRow}>
                <Text style={styles.quotaUsedText}>
                  {quota.usedThisMonth}{' '}
                  <Text style={styles.quotaTotalText}>
                    / {quota.monthlyLimit === -1 ? 'Ilimitado' : `${quota.monthlyLimit} etiquetas`}
                  </Text>
                </Text>
                {quota.monthlyLimit !== -1 && (
                  <Text style={styles.quotaRemainingText}>
                    {quota.remainingThisMonth} restantes
                  </Text>
                )}
              </View>

              {quota.monthlyLimit !== -1 && (
                <ProgressBar
                  progress={Math.min(100, (quota.usedThisMonth / quota.monthlyLimit) * 100)}
                  color={quota.isLimitReached ? colors.danger : colors.primary}
                  style={{ height: 7, marginTop: 8 }}
                />
              )}
            </View>

            {quota.tier === 'free' && (
              <TouchableOpacity
                style={styles.upgradeBanner}
                onPress={() => setPlansModalVisible(true)}
                activeOpacity={0.8}
              >
                <Sparkles size={16} color="#b37400" style={{ marginRight: 6 }} />
                <Text style={styles.upgradeText}>
                  Precisa de mais etiquetas? <Text style={styles.upgradeBold}>Faça upgrade para o Pro (300/mês)</Text>
                </Text>
                <ChevronRight size={16} color="#b37400" />
              </TouchableOpacity>
            )}
          </Card>
        )}

        {/* Search & Filters */}
        <View style={styles.searchContainer}>
          <Search size={18} color={colors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por lote ou nome do produto..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {/* Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterContent}
        >
          <TouchableOpacity
            style={[styles.filterChip, statusFilter === 'all' && styles.filterChipActive]}
            onPress={() => setStatusFilter('all')}
          >
            <Text
              style={[
                styles.filterChipText,
                statusFilter === 'all' && styles.filterChipTextActive,
              ]}
            >
              Todos
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, statusFilter === 'active' && styles.filterChipActive]}
            onPress={() => setStatusFilter('active')}
          >
            <Text
              style={[
                styles.filterChipText,
                statusFilter === 'active' && styles.filterChipTextActive,
              ]}
            >
              Válidos
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, statusFilter === 'expiring_soon' && styles.filterChipActive]}
            onPress={() => setStatusFilter('expiring_soon')}
          >
            <Text
              style={[
                styles.filterChipText,
                statusFilter === 'expiring_soon' && styles.filterChipTextActive,
              ]}
            >
              A Vencer
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, statusFilter === 'expired' && styles.filterChipActive]}
            onPress={() => setStatusFilter('expired')}
          >
            <Text
              style={[
                styles.filterChipText,
                statusFilter === 'expired' && styles.filterChipTextActive,
              ]}
            >
              Vencidos
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Batches List */}
        {loadingBatches ? (
          <LoadingState message="Carregando lotes e etiquetas..." variant="list" />
        ) : batches.length === 0 ? (
          <EmptyState
            icon={<Tag size={44} color={colors.primary} />}
            title="Nenhum lote registrado"
            description="Gere etiquetas com validade, dados nutricionais, alérgenos e código de barras para seus produtos."
            actionTitle="Criar 1ª Etiqueta"
            onAction={() => router.push('/labels/new' as any)}
          />
        ) : (
          batches.map((batch) => (
            <Card key={batch.id} style={styles.batchCard}>
              <TouchableOpacity
                onPress={() => router.push(`/labels/${batch.id}` as any)}
                activeOpacity={0.7}
              >
                {/* Header row: batch code & status */}
                <View style={styles.batchCardHeader}>
                  <View style={styles.batchCodeTag}>
                    <Text style={styles.batchCodeText}>{batch.batchCode}</Text>
                  </View>
                  <View style={styles.headerRightBadges}>
                    <View style={styles.qtyBadge}>
                      <Text style={styles.qtyBadgeText}>{batch.quantity} un</Text>
                    </View>
                    {getStatusBadge(batch)}
                  </View>
                </View>

                {/* Product Name */}
                <Text style={styles.productName}>{batch.productName}</Text>

                {/* Info row */}
                <View style={styles.infoRow}>
                  <View style={styles.infoItem}>
                    <Calendar size={13} color={colors.textSecondary} style={{ marginRight: 4 }} />
                    <Text style={styles.infoLabel}>Fab: </Text>
                    <Text style={styles.infoValue}>{batch.productionDate}</Text>
                  </View>

                  <View style={styles.infoItem}>
                    <Clock size={13} color={batch.status === 'expired' ? colors.danger : colors.textSecondary} style={{ marginRight: 4 }} />
                    <Text style={styles.infoLabel}>Val: </Text>
                    <Text
                      style={[
                        styles.infoValue,
                        batch.status === 'expired' && { color: colors.danger, fontWeight: '700' },
                      ]}
                    >
                      {batch.expiryDate}
                    </Text>
                  </View>

                  {batch.netWeight && (
                    <View style={styles.infoItem}>
                      <Text style={styles.infoLabel}>Peso: </Text>
                      <Text style={styles.infoValue}>{batch.netWeight}</Text>
                    </View>
                  )}
                </View>

                {/* Storage condition note */}
                <Text style={styles.storageText} numberOfLines={1}>
                  Condição: {batch.storageCondition}
                </Text>
              </TouchableOpacity>

              {/* Action Buttons Footer */}
              <View style={styles.batchFooter}>
                <TouchableOpacity
                  style={styles.shareButton}
                  onPress={() => handleShareBatch(batch)}
                  activeOpacity={0.7}
                >
                  <Share2 size={15} color={colors.primary} style={{ marginRight: 5 }} />
                  <Text style={styles.shareButtonText}>Compartilhar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.viewLabelButton}
                  onPress={() => router.push(`/labels/${batch.id}` as any)}
                  activeOpacity={0.8}
                >
                  <Printer size={15} color={colors.textInverse} style={{ marginRight: 5 }} />
                  <Text style={styles.viewLabelButtonText}>Ver & Imprimir</Text>
                </TouchableOpacity>
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      {/* Plans Modal */}
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
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
  },
  newButtonText: {
    color: colors.textInverse,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    marginLeft: 4,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: 40,
  },
  quotaCard: {
    padding: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quotaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  quotaTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quotaTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  quotaProgressSection: {
    marginTop: 4,
  },
  quotaNumbersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quotaUsedText: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  quotaTotalText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.regular,
    color: colors.textSecondary,
  },
  quotaRemainingText: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    fontWeight: typography.weights.medium,
  },
  upgradeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff4e0',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: '#f0ddb8',
  },
  upgradeText: {
    flex: 1,
    fontSize: typography.sizes.xs,
    color: '#8a5a00',
  },
  upgradeBold: {
    fontWeight: typography.weights.bold,
  },
  searchContainer: {
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
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.text,
    height: '100%',
  },
  filterScroll: {
    marginBottom: spacing.md,
  },
  filterContent: {
    paddingRight: spacing.md,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: borderRadius.full,
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.xs,
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
  batchCard: {
    padding: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#f0e0cc',
  },
  batchCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  batchCodeTag: {
    backgroundColor: '#f5ebe0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
  },
  batchCodeText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
    fontFamily: 'Courier',
  },
  headerRightBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  qtyBadge: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
  },
  qtyBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: '#555',
  },
  productName: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
    marginBottom: 6,
  },
  infoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 6,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
  },
  infoValue: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  storageText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginBottom: spacing.sm,
  },
  batchFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f7eee4',
    paddingTop: spacing.sm,
    gap: 8,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
  },
  shareButtonText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.primary,
  },
  viewLabelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
  },
  viewLabelButtonText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.textInverse,
  },
});
