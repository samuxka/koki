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
  Layers,
  Plus,
  Search,
  Share2,
  Trash2,
  Sparkles,
  ShoppingBag,
  TrendingUp,
  Tag,
  Clock,
  CheckCircle2,
  XCircle,
  PauseCircle,
  PlayCircle,
  Package,
  Crown,
} from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '../../src/theme';
import { Card, Button, Badge, ProgressBar } from '../../src/components/ui';
import { SkeletonList } from '../../src/components/ui/Skeleton';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { api } from '../../src/services/api';
import { useAuthStore } from '../../src/stores/auth.store';
import { formatCurrency } from '../../src/utils/formatters';
import { Combo, ComboQuotaResponse } from '@koki/types';

export default function CombosListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { company } = useAuthStore();
  const currency = company?.currency || 'EUR';

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Query Combos Quota
  const { data: quota, refetch: refetchQuota } = useQuery<ComboQuotaResponse>({
    queryKey: ['combos-quota'],
    queryFn: () => api.get<ComboQuotaResponse>('/combos/quota'),
  });

  // Query Combos List
  const {
    data: combos = [],
    isLoading,
    isRefetching,
    refetch: refetchCombos,
  } = useQuery<Combo[]>({
    queryKey: ['combos-list', search, categoryFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (categoryFilter !== 'all') params.append('category', categoryFilter);
      if (search.trim()) params.append('search', search.trim());
      const qs = params.toString() ? `?${params.toString()}` : '';
      return api.get<Combo[]>(`/combos${qs}`);
    },
  });

  // Toggle Availability Mutation
  const toggleMutation = useMutation({
    mutationFn: (id: string) => api.patch<Combo>(`/combos/${id}/toggle`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['combos-list'] });
      queryClient.invalidateQueries({ queryKey: ['products-list'] });
    },
    onError: (err: any) => {
      Alert.alert('Erro', err.message || 'Falha ao alterar disponibilidade.');
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/combos/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['combos-list'] });
      queryClient.invalidateQueries({ queryKey: ['combos-quota'] });
      queryClient.invalidateQueries({ queryKey: ['products-list'] });
      Alert.alert('Sucesso', 'Combo excluído com sucesso.');
    },
    onError: (err: any) => {
      Alert.alert('Erro', err.message || 'Falha ao excluir combo.');
    },
  });

  const handleDelete = (combo: Combo) => {
    Alert.alert(
      'Excluir Combo',
      `Tem certeza que deseja apagar o kit "${combo.name}"? O produto sincronizado no catálogo também será arquivado.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => deleteMutation.mutate(combo.id),
        },
      ],
    );
  };

  const handleShareCombo = async (combo: Combo) => {
    try {
      const companyName = company?.tradeName || 'nossa confeitaria';
      const itemsList = combo.items
        .map((i) => `  • ${i.quantity}x ${i.productName}${i.flavor ? ` (${i.flavor})` : ''}`)
        .join('\n');

      const message =
        `🎂 *${combo.name.toUpperCase()}*\n` +
        `_Especial da ${companyName}_\n\n` +
        `${combo.description ? `${combo.description}\n\n` : ''}` +
        `📦 *O que vem no kit:*\n` +
        `${itemsList}\n\n` +
        `💰 *VALOR PROMOCIONAL:*\n` +
        `• De: ~${formatCurrency(combo.originalTotalCents, currency)}~\n` +
        `• *Por apenas: ${formatCurrency(combo.priceCents, currency)}*\n` +
        `✨ *Você economiza ${formatCurrency(combo.discountCents, currency)} (${combo.discountPercent}% OFF)!*\n\n` +
        `${combo.minLeadTimeHours ? `⏱️ Encomende com pelo menos ${combo.minLeadTimeHours}h de antecedência.\n\n` : ''}` +
        `Faça sua reserva agora e garanta esse preço especial! 💕`;

      await Share.share({
        message,
        title: combo.name,
      });
    } catch (e) {
      console.error(e);
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
            <Text style={styles.headerTitle}>Criador de Combos</Text>
            <Text style={styles.headerSubtitle}>Kits festas e pacotes promocionais</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.createHeaderBtn}
          onPress={() => router.push('/combos/new' as any)}
          activeOpacity={0.8}
        >
          <Plus size={18} color="#ffffff" style={{ marginRight: 4 }} />
          <Text style={styles.createHeaderBtnText}>Novo Kit</Text>
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
              refetchCombos();
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
                <Layers size={16} color={colors.primary} style={{ marginRight: 6 }} />
                <Text style={styles.quotaTitle}>
                  Combos Ativos ({quota.tier === 'business' ? 'Ilimitado' : `${quota.combosCount} / ${quota.combosLimit}`})
                </Text>
              </View>
              <Badge
                color={quota.canCreate ? colors.success : colors.warning}
                label={quota.tier.toUpperCase()}
              />
            </View>

            {quota.combosLimit > 0 && (
              <View style={styles.quotaProgressBox}>
                <ProgressBar
                  progress={quota.combosCount / quota.combosLimit}
                  color={quota.combosCount >= quota.combosLimit ? colors.warning : colors.primary}
                />
              </View>
            )}

            {!quota.canCreate && (
              <View style={styles.upgradeNotice}>
                <Crown size={14} color={colors.caramel} style={{ marginRight: 6 }} />
                <Text style={styles.upgradeNoticeText}>
                  Limite de {quota.combosLimit} combos atingido. Faça upgrade para desbloquear mais kits!
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Search Bar */}
        <View style={styles.searchBox}>
          <Search size={16} color={colors.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por nome do combo ou item..."
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

        {/* Category Filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterScrollContent}
        >
          {['all', 'Combos & Kits', 'Kits Festa', 'Degustação', 'Café & Lanche'].map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.filterChip,
                categoryFilter === cat && styles.filterChipActive,
              ]}
              onPress={() => setCategoryFilter(cat)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  categoryFilter === cat && styles.filterChipTextActive,
                ]}
              >
                {cat === 'all' ? 'Todos' : cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Loading Skeleton */}
        {isLoading && <SkeletonList />}

        {/* Empty State */}
        {!isLoading && combos.length === 0 && (
          <EmptyState
            title="Nenhum combo encontrado"
            description={
              search
                ? 'Nenhum combo corresponde à sua busca.'
                : 'Monte kits especiais combinando bolos, docinhos e sobremesas. Os clientes adoram a conveniência e você aumenta seu ticket médio!'
            }
            actionTitle="Criar Primeiro Combo"
            onAction={() => router.push('/combos/new' as any)}
          />
        )}

        {/* Combo Cards */}
        {!isLoading &&
          combos.map((combo) => (
            <Card key={combo.id} style={styles.comboCard}>
              {/* Header: Name + Badges */}
              <View style={styles.comboHeaderRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.comboName}>{combo.name}</Text>
                  <Text style={styles.comboCategory}>{combo.category}</Text>
                </View>

                <Badge
                  color={combo.isAvailable ? colors.success : colors.textMuted}
                  label={combo.isAvailable ? 'DISPONÍVEL' : 'PAUSADO'}
                />
              </View>

              {combo.description ? (
                <Text style={styles.comboDescription}>{combo.description}</Text>
              ) : null}

              {/* Items in Combo */}
              <View style={styles.itemsBox}>
                <Text style={styles.itemsBoxTitle}>Itens inclusos no kit:</Text>
                {combo.items.map((item, idx) => (
                  <View key={idx} style={styles.itemRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.itemText}>
                      <Text style={{ fontWeight: 'bold' }}>{item.quantity}x</Text> {item.productName}
                      {item.flavor ? ` (${item.flavor})` : ''}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Financial Box: De -> Por + Economia + Lucro */}
              <View style={styles.pricingComparisonCard}>
                <View style={styles.priceColLeft}>
                  <Text style={styles.originalPriceText}>
                    De: ~{formatCurrency(combo.originalTotalCents, currency)}~
                  </Text>
                  <Text style={styles.promoPriceText}>
                    {formatCurrency(combo.priceCents, currency)}
                  </Text>
                </View>

                <View style={styles.priceColRight}>
                  {combo.discountCents > 0 && (
                    <View style={styles.economyBadge}>
                      <Tag size={11} color={colors.success} style={{ marginRight: 3 }} />
                      <Text style={styles.economyText}>
                        Economia: {formatCurrency(combo.discountCents, currency)} (-{combo.discountPercent}%)
                      </Text>
                    </View>
                  )}

                  <View style={styles.profitBadge}>
                    <TrendingUp size={11} color={colors.primary} style={{ marginRight: 3 }} />
                    <Text style={styles.profitText}>
                      Lucro: +{formatCurrency(combo.profitCents, currency)} ({combo.profitMarginPercent}% margem)
                    </Text>
                  </View>
                </View>
              </View>

              {/* Card Footer: WhatsApp + Actions */}
              <View style={styles.comboFooterRow}>
                <Button
                  title="Divulgar Kit"
                  size="sm"
                  variant="outline"
                  icon={<Share2 size={15} color={colors.primary} />}
                  onPress={() => handleShareCombo(combo)}
                  style={{ flex: 1, marginRight: 8 }}
                />

                <TouchableOpacity
                  style={styles.iconActionBtn}
                  onPress={() => toggleMutation.mutate(combo.id)}
                  activeOpacity={0.7}
                >
                  {combo.isAvailable ? (
                    <PauseCircle size={18} color={colors.warning} />
                  ) : (
                    <PlayCircle size={18} color={colors.success} />
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.iconActionBtn}
                  onPress={() => handleDelete(combo)}
                  activeOpacity={0.7}
                >
                  <Trash2 size={16} color={colors.danger} />
                </TouchableOpacity>
              </View>
            </Card>
          ))}
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
  comboCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  comboHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  comboName: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  comboCategory: {
    fontSize: 11,
    color: colors.caramel,
    fontWeight: typography.weights.semibold,
    marginTop: 1,
  },
  comboDescription: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: 4,
    marginBottom: 8,
  },
  itemsBox: {
    backgroundColor: '#faf7f2',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginVertical: spacing.sm,
    borderWidth: 1,
    borderColor: '#f0e6d8',
  },
  itemsBoxTitle: {
    fontSize: 10,
    fontWeight: typography.weights.bold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 2,
  },
  bulletDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.caramel,
    marginRight: 6,
  },
  itemText: {
    fontSize: typography.sizes.xs,
    color: colors.text,
  },
  pricingComparisonCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fffaf2',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: '#f2dfc5',
    marginVertical: spacing.xs,
  },
  priceColLeft: {
    justifyContent: 'center',
  },
  originalPriceText: {
    fontSize: 11,
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  promoPriceText: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.primary,
  },
  priceColRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  economyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eaf6ec',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  economyText: {
    fontSize: 10,
    fontWeight: typography.weights.bold,
    color: colors.success,
  },
  profitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5ece0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  profitText: {
    fontSize: 10,
    fontWeight: typography.weights.semibold,
    color: colors.primaryDark,
  },
  comboFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
  },
  iconActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
});
