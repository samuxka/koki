import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Image,
  Alert,
  Modal,
  Switch,
  TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography, borderRadius } from '../../src/theme';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { Badge } from '../../src/components/ui/Badge';
import { LoadingState } from '../../src/components/ui/LoadingState';
import { api } from '../../src/services/api';
import { useAuthStore } from '../../src/stores/auth.store';
import { formatCurrency, formatDate } from '../../src/utils/formatters';
import { CustomerDetailResponse } from '@koki/types';
import {
  ArrowLeft,
  Phone,
  MessageCircle,
  MapPin,
  FileText,
  Award,
  Star,
  ShoppingBag,
  TrendingUp,
  Receipt,
  Plus,
  Edit2,
  Trash2,
  Gift,
  ChevronRight,
  X,
  Settings,
  Check,
} from 'lucide-react-native';

export default function CustomerDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { company } = useAuthStore();
  const currency = company?.currency || 'EUR';

  // Loyalty edit modal state
  const [loyaltyModalVisible, setLoyaltyModalVisible] = useState(false);
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(false);
  const [loyaltyTargetOrders, setLoyaltyTargetOrders] = useState('10');
  const [loyaltyReward, setLoyaltyReward] = useState('');

  // Fetch detailed customer data
  const {
    data,
    isLoading,
    refetch,
  } = useQuery<CustomerDetailResponse>({
    queryKey: ['customer-detail', id],
    queryFn: () => api.get<CustomerDetailResponse>(`/customers/${id}`),
    enabled: !!id,
  });

  // Loyalty update mutation
  const loyaltyMutation = useMutation({
    mutationFn: (body: { enabled: boolean; targetOrders: number; reward?: string }) =>
      api.patch(`/customers/${id}/loyalty`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setLoyaltyModalVisible(false);
      Alert.alert('Sucesso', 'Cartão fidelidade atualizado!');
    },
    onError: (err: any) => {
      Alert.alert('Erro', err.message || 'Falha ao atualizar fidelidade');
    },
  });

  // Delete customer mutation
  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/customers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      Alert.alert('Sucesso', 'Cliente excluído com sucesso.');
      router.back();
    },
    onError: (err: any) => {
      Alert.alert('Erro', err.message || 'Falha ao excluir cliente');
    },
  });

  const handleDelete = () => {
    Alert.alert(
      'Excluir Cliente',
      'Tem certeza que deseja excluir este cliente? O histórico de pedidos será mantido.',
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

  const handleOpenLoyaltyModal = () => {
    if (data?.loyaltyCard) {
      setLoyaltyEnabled(data.loyaltyCard.enabled);
      setLoyaltyTargetOrders(String(data.loyaltyCard.targetOrders || 10));
      setLoyaltyReward(data.loyaltyCard.reward || '');
    }
    setLoyaltyModalVisible(true);
  };

  const handleSaveLoyalty = () => {
    const target = parseInt(loyaltyTargetOrders, 10);
    if (isNaN(target) || target <= 0) {
      Alert.alert('Atenção', 'A meta de pedidos deve ser um número maior que zero.');
      return;
    }
    loyaltyMutation.mutate({
      enabled: loyaltyEnabled,
      targetOrders: target,
      reward: loyaltyReward.trim(),
    });
  };

  const handleCall = (phone?: string) => {
    if (!phone) return;
    Linking.openURL(`tel:${phone.replace(/\s+/g, '')}`);
  };

  const handleWhatsApp = (phone?: string, name?: string) => {
    if (!phone) return;
    const cleanPhone = phone.replace(/\D/g, '');
    const greeting = name ? `Olá ${name}! Tudo bem?` : 'Olá! Tudo bem?';
    Linking.openURL(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(greeting)}`);
  };

  if (isLoading || !data) {
    return <LoadingState message="A carregar dados do cliente..." variant="detail" />;
  }

  const { customer, stats, loyaltyCard, recentOrders } = data;
  const address = customer.address;
  const formattedAddress = address
    ? [
        address.street && `${address.street}${address.number ? `, ${address.number}` : ''}`,
        address.complement,
        address.neighborhood,
        address.city,
        address.postalCode,
      ]
        .filter(Boolean)
        .join(' - ')
    : null;

  const targetOrders = loyaltyCard.targetOrders || 10;
  const currentOrders = loyaltyCard.currentOrders || 0;

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) + 8 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <ArrowLeft size={22} color={colors.primaryDark} />
          </TouchableOpacity>

          <Text style={styles.headerTitle} numberOfLines={1}>
            Detalhes do Cliente
          </Text>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={() => router.push(`/customers/edit/${customer.id}` as any)}
              activeOpacity={0.7}
            >
              <Edit2 size={18} color={colors.primary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={handleDelete}
              activeOpacity={0.7}
            >
              <Trash2 size={18} color={colors.danger} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Card de Perfil */}
        <Card style={styles.profileCard}>
          <View style={styles.profileHeader}>
            {customer.photoUrl ? (
              <Image source={{ uri: customer.photoUrl }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>
                  {customer.name.slice(0, 2).toUpperCase()}
                </Text>
              </View>
            )}

            <View style={{ flex: 1 }}>
              <Text style={styles.customerName}>{customer.name}</Text>
              {customer.phone && (
                <Text style={styles.customerPhone}>{customer.phone}</Text>
              )}
              {customer.email && (
                <Text style={styles.customerEmail}>{customer.email}</Text>
              )}
            </View>
          </View>

          {/* Endereço */}
          {formattedAddress && (
            <View style={styles.infoRow}>
              <MapPin size={16} color={colors.caramel} style={styles.infoIcon} />
              <Text style={styles.infoText}>{formattedAddress}</Text>
            </View>
          )}

          {/* Observações */}
          {customer.notes && (
            <View style={styles.infoRow}>
              <FileText size={16} color={colors.textMuted} style={styles.infoIcon} />
              <Text style={styles.notesText}>{customer.notes}</Text>
            </View>
          )}

          {/* Botões de Contato Rápido e Novo Pedido */}
          <View style={styles.actionsRow}>
            {customer.phone && (
              <>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionBtnWhatsApp]}
                  onPress={() => handleWhatsApp(customer.phone, customer.name)}
                  activeOpacity={0.8}
                >
                  <MessageCircle size={16} color="#ffffff" />
                  <Text style={styles.actionBtnTextWhite}>WhatsApp</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionBtnCall]}
                  onPress={() => handleCall(customer.phone)}
                  activeOpacity={0.8}
                >
                  <Phone size={16} color={colors.primaryDark} />
                  <Text style={styles.actionBtnTextDark}>Ligar</Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnNewOrder]}
              onPress={() => router.push(`/orders/new?customerId=${customer.id}` as any)}
              activeOpacity={0.8}
            >
              <Plus size={16} color="#ffffff" />
              <Text style={styles.actionBtnTextWhite}>Criar Pedido</Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Métricas do Cliente */}
        <View style={styles.metricsGrid}>
          <Card style={styles.metricCard}>
            <View style={[styles.metricIconBox, { backgroundColor: `${colors.primary}15` }]}>
              <TrendingUp size={20} color={colors.primary} />
            </View>
            <Text style={styles.metricLabel}>Total Gasto</Text>
            <Text style={[styles.metricValue, { color: colors.primary }]}>
              {formatCurrency(stats.totalSpentCents, currency)}
            </Text>
          </Card>

          <Card style={styles.metricCard}>
            <View style={[styles.metricIconBox, { backgroundColor: `${colors.caramel}20` }]}>
              <ShoppingBag size={20} color={colors.caramel} />
            </View>
            <Text style={styles.metricLabel}>Pedidos Feitos</Text>
            <Text style={styles.metricValue}>{stats.totalOrdersCount}</Text>
          </Card>

          <Card style={styles.metricCard}>
            <View style={[styles.metricIconBox, { backgroundColor: `${colors.success}15` }]}>
              <Receipt size={20} color={colors.success} />
            </View>
            <Text style={styles.metricLabel}>Ticket Médio</Text>
            <Text style={styles.metricValue}>
              {formatCurrency(stats.averageTicketCents, currency)}
            </Text>
          </Card>
        </View>

        {/* Cartão Fidelidade */}
        <Card style={styles.loyaltyCardWrapper}>
          <View style={styles.loyaltyHeader}>
            <View style={styles.loyaltyHeaderLeft}>
              <View style={styles.loyaltyIconCircle}>
                <Award size={20} color={colors.caramel} />
              </View>
              <View>
                <Text style={styles.loyaltyTitle}>Cartão Fidelidade</Text>
                <Text style={styles.loyaltySubtitle}>
                  {loyaltyCard.enabled
                    ? `${currentOrders} de ${targetOrders} pedidos para o brinde`
                    : 'Desativado para este cliente'}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.loyaltyConfigBtn}
              onPress={handleOpenLoyaltyModal}
              activeOpacity={0.7}
            >
              <Settings size={16} color={colors.primary} />
              <Text style={styles.loyaltyConfigBtnText}>Configurar</Text>
            </TouchableOpacity>
          </View>

          {loyaltyCard.enabled ? (
            <View style={styles.loyaltyBody}>
              {loyaltyCard.reward ? (
                <View style={styles.rewardBanner}>
                  <Gift size={16} color={colors.primary} />
                  <Text style={styles.rewardBannerText}>
                    Recompensa:{' '}
                    <Text style={{ fontWeight: typography.weights.bold }}>
                      {loyaltyCard.reward}
                    </Text>
                  </Text>
                </View>
              ) : null}

              {/* Grid visual de carimbos/selos */}
              <View style={styles.stampsGrid}>
                {Array.from({ length: Math.min(targetOrders, 20) }).map((_, idx) => {
                  const isCompleted = idx < currentOrders;
                  const isLast = idx === targetOrders - 1;

                  return (
                    <View
                      key={idx}
                      style={[
                        styles.stampBox,
                        isCompleted && styles.stampBoxCompleted,
                        isLast && !isCompleted && styles.stampBoxTarget,
                      ]}
                    >
                      {isCompleted ? (
                        <Check size={16} color="#ffffff" />
                      ) : isLast ? (
                        <Gift size={16} color={colors.caramel} />
                      ) : (
                        <Text style={styles.stampNumber}>{idx + 1}</Text>
                      )}
                    </View>
                  );
                })}
              </View>

              {loyaltyCard.completedCycles && loyaltyCard.completedCycles > 0 ? (
                <Text style={styles.completedCyclesText}>
                  🎉 Este cliente já completou e resgatou{' '}
                  <Text style={{ fontWeight: typography.weights.bold }}>
                    {loyaltyCard.completedCycles}{' '}
                    {loyaltyCard.completedCycles === 1 ? 'vez' : 'vezes'}
                  </Text>{' '}
                  o cartão fidelidade!
                </Text>
              ) : null}
            </View>
          ) : (
            <View style={styles.loyaltyDisabledNotice}>
              <Text style={styles.loyaltyDisabledText}>
                Ative o Cartão Fidelidade para fidelizar este cliente com recompensas exclusivas
                após atingir a meta de pedidos definida por você.
              </Text>
              <Button
                title="Ativar Fidelidade"
                variant="outline"
                size="sm"
                onPress={handleOpenLoyaltyModal}
                style={{ marginTop: spacing.sm }}
              />
            </View>
          )}
        </Card>

        {/* Produto Mais Comprado por Ele */}
        <Card style={styles.topProductCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleLeft}>
              <Star size={18} color={colors.caramel} />
              <Text style={styles.sectionTitle}>Produto Favorito</Text>
            </View>
            <Badge label="Mais Comprado" color={colors.caramel} />
          </View>

          {stats.topProduct ? (
            <View style={styles.topProductContent}>
              <View style={styles.topProductIconBox}>
                <ShoppingBag size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.topProductName}>{stats.topProduct.productName}</Text>
                <Text style={styles.topProductDetails}>
                  {stats.topProduct.quantity}{' '}
                  {stats.topProduct.quantity === 1 ? 'unidade comprada' : 'unidades compradas'} •{' '}
                  {formatCurrency(stats.topProduct.totalSpentCents, currency)} investidos
                </Text>
              </View>
            </View>
          ) : (
            <Text style={styles.emptyNotice}>
              Ainda não há dados suficientes de produtos pedidos por este cliente.
            </Text>
          )}
        </Card>

        {/* Histórico de Pedidos */}
        <View style={styles.ordersSection}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Histórico de Pedidos</Text>
            <Text style={styles.ordersCountText}>
              {recentOrders.length} {recentOrders.length === 1 ? 'recente' : 'recentes'}
            </Text>
          </View>

          {recentOrders.length === 0 ? (
            <Card style={styles.emptyOrdersCard}>
              <Text style={styles.emptyNotice}>Nenhum pedido realizado até o momento.</Text>
              <Button
                title="Criar Primeiro Pedido"
                onPress={() => router.push(`/orders/new?customerId=${customer.id}` as any)}
                style={{ marginTop: spacing.sm }}
              />
            </Card>
          ) : (
            recentOrders.map((order) => (
              <TouchableOpacity
                key={order.id}
                activeOpacity={0.8}
                onPress={() => router.push(`/orders/${order.id}` as any)}
              >
                <Card style={styles.orderItemCard}>
                  <View style={styles.orderItemTop}>
                    <View style={styles.orderNumberBadge}>
                      <Text style={styles.orderNumberText}>#{order.orderNumber}</Text>
                    </View>
                    <Text style={styles.orderDate}>{formatDate(order.deliveryDate)}</Text>
                    <View style={{ marginLeft: 'auto' }}>
                      <Text style={styles.orderAmount}>
                        {formatCurrency(order.totalAmountCents, currency)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.orderBadgesRow}>
                    <Badge status={order.operationalStatus} />
                    <Badge status={order.financialStatus} />

                    <ChevronRight size={16} color={colors.textMuted} style={{ marginLeft: 'auto' }} />
                  </View>
                </Card>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      {/* Modal - Configurar Cartão Fidelidade */}
      <Modal visible={loyaltyModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Configurar Cartão Fidelidade</Text>
              <TouchableOpacity onPress={() => setLoyaltyModalVisible(false)}>
                <X size={22} color={colors.primaryDark} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalFieldRow}>
              <Text style={styles.modalFieldLabel}>Ativar Cartão Fidelidade</Text>
              <Switch
                value={loyaltyEnabled}
                onValueChange={setLoyaltyEnabled}
                trackColor={{ false: colors.border, true: colors.caramel }}
                thumbColor="#ffffff"
              />
            </View>

            {loyaltyEnabled && (
              <>
                <Text style={styles.inputLabel}>Quantidade de Pedidos para a Recompensa:</Text>
                <TextInput
                  style={styles.modalInput}
                  value={loyaltyTargetOrders}
                  onChangeText={setLoyaltyTargetOrders}
                  keyboardType="numeric"
                  placeholder="Ex: 10"
                />

                <Text style={styles.inputLabel}>Recompensa / Brinde:</Text>
                <TextInput
                  style={styles.modalInput}
                  value={loyaltyReward}
                  onChangeText={setLoyaltyReward}
                  placeholder="Ex: 1 Bolo Vulcano de Cenoura com Chocolate"
                />
              </>
            )}

            <Button
              title="Salvar Configuração"
              loading={loyaltyMutation.isPending}
              onPress={handleSaveLoyalty}
              style={{ marginTop: spacing.md }}
            />
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
  header: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
    flex: 1,
    marginHorizontal: spacing.md,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  profileCard: {
    padding: spacing.lg,
    backgroundColor: '#ffffff',
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  avatarImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
  },
  customerName: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  customerPhone: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  customerEmail: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginTop: 1,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: spacing.xs,
    gap: spacing.xs + 2,
  },
  infoIcon: {
    marginTop: 2,
  },
  infoText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    flex: 1,
  },
  notesText: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    fontStyle: 'italic',
    flex: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.surface,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    gap: 6,
  },
  actionBtnWhatsApp: {
    backgroundColor: colors.success,
  },
  actionBtnCall: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionBtnNewOrder: {
    backgroundColor: colors.primary,
  },
  actionBtnTextWhite: {
    color: '#ffffff',
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
  },
  actionBtnTextDark: {
    color: colors.primaryDark,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  metricCard: {
    flex: 1,
    padding: spacing.md,
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  metricIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  metricLabel: {
    fontSize: 10,
    color: colors.textMuted,
    textAlign: 'center',
  },
  metricValue: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
    marginTop: 2,
    textAlign: 'center',
  },
  loyaltyCardWrapper: {
    padding: spacing.lg,
    backgroundColor: '#ffffff',
  },
  loyaltyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  loyaltyHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  loyaltyIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: `${colors.goldenBeige}40`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loyaltyTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  loyaltySubtitle: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginTop: 1,
  },
  loyaltyConfigBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  loyaltyConfigBtnText: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: typography.weights.medium,
  },
  loyaltyBody: {
    marginTop: spacing.md,
  },
  rewardBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${colors.goldenBeige}25`,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    gap: spacing.xs + 2,
    borderWidth: 1,
    borderColor: `${colors.caramel}30`,
    marginBottom: spacing.md,
  },
  rewardBannerText: {
    fontSize: typography.sizes.xs,
    color: colors.primaryDark,
    flex: 1,
  },
  stampsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs + 2,
  },
  stampBox: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stampBoxCompleted: {
    backgroundColor: colors.caramel,
    borderColor: colors.caramel,
  },
  stampBoxTarget: {
    borderColor: colors.primary,
    borderStyle: 'dashed',
  },
  stampNumber: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: typography.weights.medium,
  },
  completedCyclesText: {
    fontSize: typography.sizes.xs,
    color: colors.success,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  loyaltyDisabledNotice: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.surface,
    alignItems: 'center',
  },
  loyaltyDisabledText: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  topProductCard: {
    padding: spacing.lg,
    backgroundColor: '#ffffff',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  sectionTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  topProductContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  topProductIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: `${colors.primary}10`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topProductName: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  topProductDetails: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  emptyNotice: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  ordersSection: {
    gap: spacing.sm,
  },
  ordersCountText: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
  },
  emptyOrdersCard: {
    padding: spacing.lg,
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  orderItemCard: {
    padding: spacing.md,
    backgroundColor: '#ffffff',
    gap: spacing.xs + 2,
  },
  orderItemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  orderNumberBadge: {
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  orderNumberText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  orderDate: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
  orderAmount: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  orderBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
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
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  modalFieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  modalFieldLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.primaryDark,
  },
  inputLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
    marginTop: spacing.sm,
    marginBottom: 4,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
    fontSize: typography.sizes.sm,
    color: colors.text,
    backgroundColor: colors.surface,
  },
});
