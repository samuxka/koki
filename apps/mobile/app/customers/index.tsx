import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  RefreshControl,
  Linking,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography, borderRadius } from '../../src/theme';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { LoadingState } from '../../src/components/ui/LoadingState';
import { api } from '../../src/services/api';
import { useAuthStore } from '../../src/stores/auth.store';
import { formatCurrency } from '../../src/utils/formatters';
import { Customer, CustomerSortBy, CustomerFilterType } from '@koki/types';
import {
  Users,
  Search,
  Filter,
  ArrowUpDown,
  LayoutGrid,
  List,
  Plus,
  Phone,
  MessageCircle,
  Award,
  ChevronRight,
  X,
  Check,
  TrendingUp,
  ShoppingBag,
  ArrowLeft,
} from 'lucide-react-native';

const SORT_OPTIONS: { key: CustomerSortBy; label: string; icon: string }[] = [
  { key: 'ranking', label: 'Ranking (Mais gastou)', icon: '🏆' },
  { key: 'orders', label: 'Mais pedidos', icon: '📦' },
  { key: 'newest', label: 'Mais novo ao mais antigo', icon: '⏱️' },
  { key: 'oldest', label: 'Mais antigo ao mais novo', icon: '⏳' },
];

const FILTER_OPTIONS: { key: CustomerFilterType; label: string }[] = [
  { key: 'all', label: 'Todos os Clientes' },
  { key: 'with_orders', label: 'Com pedidos realizados' },
  { key: 'without_orders', label: 'Sem pedidos ainda' },
  { key: 'loyalty_active', label: 'Com Cartão Fidelidade ativo' },
];

export default function CustomersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { company } = useAuthStore();
  const currency = company?.currency || 'EUR';

  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [sortBy, setSortBy] = useState<CustomerSortBy>('ranking');
  const [filterType, setFilterType] = useState<CustomerFilterType>('all');
  const [sortModalVisible, setSortModalVisible] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  // Fetch customers from API
  const {
    data,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery<{ items: Customer[]; total: number }>({
    queryKey: ['customers', search, sortBy, filterType],
    queryFn: () =>
      api.get<{ items: Customer[]; total: number }>(
        `/customers?search=${encodeURIComponent(search)}&sortBy=${sortBy}&filter=${filterType}&limit=100`,
      ),
  });

  const customers = data?.items || [];
  const totalCount = data?.total ?? customers.length;

  const handleCall = (phoneNumber?: string) => {
    if (!phoneNumber) return;
    Linking.openURL(`tel:${phoneNumber.replace(/\s+/g, '')}`);
  };

  const handleWhatsApp = (phoneNumber?: string, name?: string) => {
    if (!phoneNumber) return;
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    const greeting = name ? `Olá ${name}! Tudo bem?` : 'Olá! Tudo bem?';
    Linking.openURL(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(greeting)}`);
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const getAvatarColor = (index: number) => {
    const palette = ['#663c00', '#cc9a52', '#8c501e', '#a6723e', '#593202'];
    return palette[index % palette.length];
  };

  const currentSortLabel = SORT_OPTIONS.find((s) => s.key === sortBy)?.label || 'Ordenar';

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) + 8 }]}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <ArrowLeft size={22} color={colors.primaryDark} />
          </TouchableOpacity>

          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>Clientes</Text>
            <Text style={styles.headerSubtitle}>
              {totalCount} {totalCount === 1 ? 'cliente cadastrado' : 'clientes cadastrados'}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.newButton}
            activeOpacity={0.8}
            onPress={() => router.push('/customers/new' as any)}
          >
            <Plus size={18} color="#ffffff" />
            <Text style={styles.newButtonText}>Novo</Text>
          </TouchableOpacity>
        </View>

        {/* Caixa de Pesquisa Avançada */}
        <View style={styles.searchBar}>
          <Search size={18} color={colors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Pesquisar por nome, telefone, morada..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
            clearButtonMode="while-editing"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} style={styles.clearSearchBtn}>
              <X size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Barra de Controles: Ordenar, Filtro e Alternar Visualização */}
        <View style={styles.controlsRow}>
          <TouchableOpacity
            style={styles.controlPill}
            onPress={() => setSortModalVisible(true)}
            activeOpacity={0.7}
          >
            <ArrowUpDown size={14} color={colors.primary} />
            <Text style={styles.controlPillText} numberOfLines={1}>
              {currentSortLabel}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.controlPill,
              filterType !== 'all' && styles.controlPillActive,
            ]}
            onPress={() => setFilterModalVisible(true)}
            activeOpacity={0.7}
          >
            <Filter
              size={14}
              color={filterType !== 'all' ? '#ffffff' : colors.primary}
            />
            <Text
              style={[
                styles.controlPillText,
                filterType !== 'all' && styles.controlPillTextActive,
              ]}
            >
              {filterType === 'all' ? 'Filtros' : 'Filtro Ativo'}
            </Text>
          </TouchableOpacity>

          <View style={styles.viewModeToggle}>
            <TouchableOpacity
              style={[styles.viewModeBtn, viewMode === 'card' && styles.viewModeBtnActive]}
              onPress={() => setViewMode('card')}
            >
              <LayoutGrid
                size={16}
                color={viewMode === 'card' ? '#ffffff' : colors.textMuted}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.viewModeBtn, viewMode === 'list' && styles.viewModeBtnActive]}
              onPress={() => setViewMode('list')}
            >
              <List
                size={16}
                color={viewMode === 'list' ? '#ffffff' : colors.textMuted}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Lista de Clientes */}
      {isLoading ? (
        <LoadingState message="A carregar clientes..." />
      ) : customers.length === 0 ? (
        <EmptyState
          title="Nenhum cliente encontrado"
          description={
            search || filterType !== 'all'
              ? 'Tente ajustar os termos da pesquisa ou limpar os filtros aplicados.'
              : 'Cadastre seus clientes para acompanhar pedidos, histórico e cartões fidelidade.'
          }
          actionTitle="Cadastrar Primeiro Cliente"
          onAction={() => router.push('/customers/new' as any)}
          icon={<Users size={48} color={colors.caramel} />}
        />
      ) : (
        <FlatList
          data={customers}
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
          renderItem={({ item, index }) => {
            const hasLoyalty = item.loyaltyCard?.enabled;
            const loyaltyProgress = item.loyaltyCard?.progressPercent ?? 0;
            const currentOrders = item.loyaltyCard?.currentOrders ?? 0;
            const targetOrders = item.loyaltyCard?.targetOrders ?? 10;

            if (viewMode === 'list') {
              // Visualização em Lista
              return (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => router.push(`/customers/${item.id}` as any)}
                >
                  <Card style={styles.listItemCard}>
                    <View style={styles.listItemLeft}>
                      {item.photoUrl ? (
                        <Image source={{ uri: item.photoUrl }} style={styles.listAvatarImage} />
                      ) : (
                        <View
                          style={[
                            styles.listAvatarPlaceholder,
                            { backgroundColor: getAvatarColor(index) },
                          ]}
                        >
                          <Text style={styles.avatarInitials}>{getInitials(item.name)}</Text>
                        </View>
                      )}

                      <View style={{ flex: 1 }}>
                        <View style={styles.nameRow}>
                          <Text style={styles.customerName} numberOfLines={1}>
                            {item.name}
                          </Text>
                          {hasLoyalty && (
                            <View style={styles.loyaltyTag}>
                              <Award size={11} color={colors.caramel} />
                              <Text style={styles.loyaltyTagText}>
                                {currentOrders}/{targetOrders}
                              </Text>
                            </View>
                          )}
                        </View>

                        {item.phone && (
                          <Text style={styles.customerPhone} numberOfLines={1}>
                            {item.phone}
                          </Text>
                        )}

                        <View style={styles.listMetricsRow}>
                          <Text style={styles.metricText}>
                            <Text style={styles.metricBold}>{item.totalOrdersCount}</Text>{' '}
                            {item.totalOrdersCount === 1 ? 'pedido' : 'pedidos'}
                          </Text>
                          <Text style={styles.metricDot}>•</Text>
                          <Text style={styles.metricText}>
                            Total:{' '}
                            <Text style={[styles.metricBold, { color: colors.primary }]}>
                              {formatCurrency(item.totalSpentCents || 0, currency)}
                            </Text>
                          </Text>
                        </View>
                      </View>
                    </View>

                    <ChevronRight size={18} color={colors.textMuted} />
                  </Card>
                </TouchableOpacity>
              );
            }

            // Visualização em Card (Padrão)
            return (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => router.push(`/customers/${item.id}` as any)}
              >
                <Card style={styles.customerCard}>
                  {/* Cabeçalho do Card */}
                  <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderLeft}>
                      {item.photoUrl ? (
                        <Image source={{ uri: item.photoUrl }} style={styles.cardAvatarImage} />
                      ) : (
                        <View
                          style={[
                            styles.cardAvatarPlaceholder,
                            { backgroundColor: getAvatarColor(index) },
                          ]}
                        >
                          <Text style={styles.cardAvatarInitials}>{getInitials(item.name)}</Text>
                        </View>
                      )}

                      <View style={{ flex: 1 }}>
                        <View style={styles.nameRow}>
                          <Text style={styles.cardCustomerName} numberOfLines={1}>
                            {item.name}
                          </Text>
                        </View>

                        {item.phone ? (
                          <Text style={styles.customerPhone}>{item.phone}</Text>
                        ) : (
                          <Text style={styles.customerPhoneMuted}>Sem telefone</Text>
                        )}
                      </View>
                    </View>

                    {/* Botões de Ação Rápida */}
                    <View style={styles.quickActions}>
                      {item.phone && (
                        <>
                          <TouchableOpacity
                            style={styles.actionCircleBtn}
                            onPress={() => handleWhatsApp(item.phone, item.name)}
                            activeOpacity={0.7}
                          >
                            <MessageCircle size={16} color={colors.success} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.actionCircleBtn}
                            onPress={() => handleCall(item.phone)}
                            activeOpacity={0.7}
                          >
                            <Phone size={16} color={colors.primary} />
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  </View>

                  {/* Cartão Fidelidade se ativo */}
                  {hasLoyalty && (
                    <View style={styles.loyaltyCardBanner}>
                      <View style={styles.loyaltyCardTop}>
                        <View style={styles.loyaltyLabelWrap}>
                          <Award size={14} color={colors.caramel} />
                          <Text style={styles.loyaltyCardLabel}>Cartão Fidelidade</Text>
                        </View>
                        <Text style={styles.loyaltyCardProgressText}>
                          {currentOrders} de {targetOrders} pedidos
                        </Text>
                      </View>
                      <View style={styles.progressBarTrack}>
                        <View
                          style={[
                            styles.progressBarFill,
                            { width: `${Math.max(5, loyaltyProgress)}%` },
                          ]}
                        />
                      </View>
                    </View>
                  )}

                  {/* Rodapé do Card com Métricas */}
                  <View style={styles.cardFooter}>
                    <View style={styles.cardMetricItem}>
                      <View style={styles.metricIconWrap}>
                        <ShoppingBag size={14} color={colors.caramel} />
                      </View>
                      <View>
                        <Text style={styles.metricItemLabel}>Pedidos</Text>
                        <Text style={styles.metricItemValue}>{item.totalOrdersCount || 0}</Text>
                      </View>
                    </View>

                    <View style={styles.metricDivider} />

                    <View style={styles.cardMetricItem}>
                      <View style={styles.metricIconWrap}>
                        <TrendingUp size={14} color={colors.primary} />
                      </View>
                      <View>
                        <Text style={styles.metricItemLabel}>Total Gasto</Text>
                        <Text style={[styles.metricItemValue, { color: colors.primary }]}>
                          {formatCurrency(item.totalSpentCents || 0, currency)}
                        </Text>
                      </View>
                    </View>

                    <ChevronRight size={18} color={colors.textMuted} style={{ marginLeft: 'auto' }} />
                  </View>
                </Card>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Modal - Opções de Ordenação */}
      <Modal visible={sortModalVisible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSortModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Ordenar Clientes</Text>
            {SORT_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.modalOption, sortBy === opt.key && styles.modalOptionActive]}
                onPress={() => {
                  setSortBy(opt.key);
                  setSortModalVisible(false);
                }}
              >
                <Text style={styles.modalOptionIcon}>{opt.icon}</Text>
                <Text
                  style={[
                    styles.modalOptionText,
                    sortBy === opt.key && styles.modalOptionTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
                {sortBy === opt.key && <Check size={18} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modal - Filtros */}
      <Modal visible={filterModalVisible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setFilterModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Filtrar Clientes</Text>
            {FILTER_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.modalOption, filterType === opt.key && styles.modalOptionActive]}
                onPress={() => {
                  setFilterType(opt.key);
                  setFilterModalVisible(false);
                }}
              >
                <Text
                  style={[
                    styles.modalOptionText,
                    filterType === opt.key && styles.modalOptionTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
                {filterType === opt.key && <Check size={18} color={colors.primary} />}
              </TouchableOpacity>
            ))}
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
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  headerSubtitle: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
  },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.md,
    gap: 4,
  },
  newButtonText: {
    color: '#ffffff',
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    height: 42,
    marginBottom: spacing.sm,
  },
  searchIcon: {
    marginRight: spacing.xs,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.primaryDark,
    paddingVertical: 0,
  },
  clearSearchBtn: {
    padding: 4,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  controlPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    gap: 6,
    flex: 1,
  },
  controlPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  controlPillText: {
    fontSize: typography.sizes.xs,
    color: colors.primaryDark,
    fontWeight: typography.weights.medium,
  },
  controlPillTextActive: {
    color: '#ffffff',
    fontWeight: typography.weights.bold,
  },
  viewModeToggle: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 2,
  },
  viewModeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
  },
  viewModeBtnActive: {
    backgroundColor: colors.primary,
  },
  listContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  customerCard: {
    padding: spacing.md,
    backgroundColor: '#ffffff',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  cardAvatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  cardAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardAvatarInitials: {
    color: '#ffffff',
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  cardCustomerName: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  customerPhone: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  customerPhoneMuted: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: 2,
  },
  quickActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  actionCircleBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  loyaltyCardBanner: {
    backgroundColor: `${colors.goldenBeige}30`,
    borderWidth: 1,
    borderColor: `${colors.caramel}40`,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginTop: spacing.sm + 2,
  },
  loyaltyCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  loyaltyLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  loyaltyCardLabel: {
    fontSize: 11,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  loyaltyCardProgressText: {
    fontSize: 11,
    color: colors.caramel,
    fontWeight: typography.weights.bold,
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: '#ffffff',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.caramel,
    borderRadius: 3,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.sm + 2,
    borderTopWidth: 1,
    borderTopColor: colors.surface,
  },
  cardMetricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  metricIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricItemLabel: {
    fontSize: 10,
    color: colors.textMuted,
  },
  metricItemValue: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
  listItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.sm + 4,
    backgroundColor: '#ffffff',
  },
  listItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  listAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  listAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: '#ffffff',
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
  customerName: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  loyaltyTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${colors.goldenBeige}40`,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: borderRadius.sm,
    gap: 3,
  },
  loyaltyTagText: {
    fontSize: 9,
    fontWeight: typography.weights.bold,
    color: colors.caramel,
  },
  listMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 4,
  },
  metricText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  metricBold: {
    fontWeight: typography.weights.bold,
  },
  metricDot: {
    fontSize: 10,
    color: colors.textMuted,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
    marginBottom: spacing.md,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface,
    gap: spacing.sm,
  },
  modalOptionActive: {
    backgroundColor: `${colors.goldenBeige}20`,
  },
  modalOptionIcon: {
    fontSize: 16,
  },
  modalOptionText: {
    fontSize: typography.sizes.sm,
    color: colors.text,
    flex: 1,
  },
  modalOptionTextActive: {
    color: colors.primary,
    fontWeight: typography.weights.bold,
  },
});
