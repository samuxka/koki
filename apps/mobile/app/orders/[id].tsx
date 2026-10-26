import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  Image,
  Share,
  Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing, typography, borderRadius } from '../../src/theme';
import { Card } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { Button } from '../../src/components/ui/Button';
import { CurrencyInput } from '../../src/components/ui/CurrencyInput';
import { LoadingState } from '../../src/components/ui/LoadingState';
import { api } from '../../src/services/api';
import { useAuthStore } from '../../src/stores/auth.store';
import { usePreferencesStore } from '../../src/stores/preferences.store';
import { formatCurrency, formatDateTime } from '../../src/utils/formatters';
import { Order, Payment, CashAccount, OperationalStatus, GeneratePaymentLinkResponse } from '@koki/types';
import {
  User,
  Calendar,
  Clock,
  Wallet,
  CheckCircle,
  Truck,
  DollarSign,
  X,
  CreditCard,
  Banknote,
  ArrowRightLeft,
  Camera,
  Image as ImageIcon,
  Eye,
  Trash2,
  Check,
  Share2,
  Send,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react-native';

const nextOperationalStatus: Record<string, OperationalStatus> = {
  pending: 'in_production',
  in_production: 'ready',
  ready: 'delivered',
};

const statusActionNames: Record<string, string> = {
  pending: 'Iniciar Produção',
  in_production: 'Marcar como Pronto',
  ready: 'Confirmar Entrega',
};

export default function OrderDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { company } = useAuthStore();
  const { hideValues } = usePreferencesStore();
  const currency = company?.currency || 'EUR';

  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [paymentAmountCents, setPaymentAmountCents] = useState(0);
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank_transfer'>('cash');
  const [receiptUri, setReceiptUri] = useState<string>('');
  const [selectedReceiptViewUrl, setSelectedReceiptViewUrl] = useState<string | null>(null);

  // Stripe Payment Link State
  const [paymentLinkModalVisible, setPaymentLinkModalVisible] = useState(false);
  const [activePaymentLink, setActivePaymentLink] = useState<string>('');

  // Query order details
  const { data, isLoading, refetch } = useQuery<{ order: Order; payments: Payment[] }>({
    queryKey: ['order-detail', id],
    queryFn: () => api.get(`/orders/${id}`),
    enabled: !!id,
  });

  // Query Cash Accounts for payment destination
  const { data: accountsData } = useQuery<CashAccount[] | { items: CashAccount[] }>({
    queryKey: ['cash-accounts-mini'],
    queryFn: () => api.get('/cash/accounts'),
  });

  const accounts: CashAccount[] = Array.isArray(accountsData)
    ? accountsData
    : (accountsData as any)?.items || [];

  // Update Status Mutation
  const updateStatusMutation = useMutation({
    mutationFn: (newStatus: OperationalStatus) =>
      api.patch(`/orders/${id}/status`, { operationalStatus: newStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['orders-list'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
    },
  });

  // Add Payment Mutation
  const addPaymentMutation = useMutation({
    mutationFn: (variables: {
      amountCents: number;
      paymentMethod: 'cash' | 'bank_transfer';
      receiptUrl?: string;
    }) => {
      const accId = paymentAccountId || accounts?.[0]?.id;
      if (!accId) throw new Error('Selecione a caixinha de destino');
      return api.post(`/orders/${id}/payments`, {
        cashAccountId: accId,
        amountCents: variables.amountCents,
        paymentMethod: variables.paymentMethod,
        receiptUrl: variables.receiptUrl,
        idempotencyKey: `pay-${id}-${Date.now()}`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['orders-list'] });
      queryClient.invalidateQueries({ queryKey: ['cash-summary'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      setPaymentModalVisible(false);
      setReceiptUri('');
    },
    onError: (err: any) => {
      Alert.alert('Erro ao registrar pagamento', err.message);
    },
  });

  // Generate Payment Link Mutation (Stripe)
  const generatePaymentLinkMutation = useMutation({
    mutationFn: () =>
      api.post<GeneratePaymentLinkResponse>(`/orders/${id}/payment-link`),
    onSuccess: (res) => {
      setActivePaymentLink(res.paymentUrl);
      setPaymentLinkModalVisible(true);
      queryClient.invalidateQueries({ queryKey: ['order-detail', id] });
    },
    onError: (err: any) => {
      Alert.alert(
        'Erro ao gerar link de pagamento',
        err.message || 'Falha ao conectar com o serviço da Stripe.',
      );
    },
  });

  const handleSharePaymentLink = async (url: string) => {
    if (!data?.order) return;
    const currentOrder = data.order;
    const message = `Olá, ${currentOrder.customerName}! 🍰\nSegue o link seguro para pagamento do Pedido #${currentOrder.orderNumber} no valor de ${formatCurrency(currentOrder.remainingAmountCents, currency)}:\n\n👉 ${url}\n\nPagamento com Cartão, Apple Pay ou Google Pay via Stripe. Muito obrigado!`;
    try {
      await Share.share({
        message,
        url,
        title: `Link de Pagamento - Pedido #${currentOrder.orderNumber}`,
      });
    } catch (err: any) {
      Alert.alert('Erro ao compartilhar', err.message);
    }
  };

  const handleSendWhatsApp = (url: string) => {
    if (!data?.order) return;
    const currentOrder = data.order;
    const cleanPhone = (currentOrder.customerPhone || '').replace(/\D/g, '');
    const message = encodeURIComponent(
      `Olá, ${currentOrder.customerName}! 🍰\nSegue o link seguro para pagamento do seu Pedido #${currentOrder.orderNumber} no valor de ${formatCurrency(currentOrder.remainingAmountCents, currency)}:\n\n👉 ${url}\n\nVocê pode pagar com Cartão de Crédito/Débito, Apple Pay ou Google Pay processado com segurança pela Stripe. Muito obrigado!`,
    );

    if (cleanPhone) {
      Linking.openURL(`whatsapp://send?phone=${cleanPhone}&text=${message}`).catch(() => {
        Linking.openURL(`https://wa.me/${cleanPhone}?text=${message}`).catch(() => {
          handleSharePaymentLink(url);
        });
      });
    } else {
      handleSharePaymentLink(url);
    }
  };

  const handlePickReceiptFromGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.4,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const uri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        setReceiptUri(uri);
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível acessar a galeria.');
    }
  };

  const handleTakeReceiptPhoto = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permissão necessária', 'Permita o acesso à câmera para fotografar o comprovante.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.4,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const uri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        setReceiptUri(uri);
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível abrir a câmera.');
    }
  };

  const handleConfirmPayment = () => {
    if (!data?.order) return;

    if (paymentAmountCents <= 0) {
      Alert.alert('Valor inválido', 'Informe um valor a receber maior que zero.');
      return;
    }

    if (paymentAmountCents > data.order.remainingAmountCents) {
      Alert.alert(
        'Valor excede restante',
        `O valor informado ultrapassa o saldo restante de ${formatCurrency(data.order.remainingAmountCents, currency, hideValues)}.`,
      );
      return;
    }

    if (paymentMethod === 'bank_transfer' && !receiptUri) {
      Alert.alert(
        'Comprovante obrigatório',
        'Para pagamentos via transferência bancária, é obrigatório anexar o comprovante de pagamento.',
      );
      return;
    }

    addPaymentMutation.mutate({
      amountCents: paymentAmountCents,
      paymentMethod,
      receiptUrl: paymentMethod === 'bank_transfer' ? receiptUri : undefined,
    });
  };

  if (isLoading || !data) {
    return <LoadingState message="Carregando detalhes do pedido..." variant="detail" />;
  }

  const { order, payments } = data;
  const nextStatus = nextOperationalStatus[order.operationalStatus];
  const nextActionName = statusActionNames[order.operationalStatus];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header do Pedido */}
        <Card style={styles.headerCard}>
          <View style={styles.orderTopRow}>
            <Text style={styles.orderNumber}>Pedido #{order.orderNumber}</Text>
            <View style={styles.badgeRow}>
              <Badge status={order.operationalStatus} />
              <Badge status={order.financialStatus} />
            </View>
          </View>

          <View style={styles.infoRow}>
            <User size={16} color={colors.primary} />
            <Text style={styles.customerName}>{order.customerName}</Text>
          </View>

          {order.customerPhone ? (
            <Text style={styles.phoneText}>Contato: {order.customerPhone}</Text>
          ) : null}

          <View style={styles.infoRow}>
            <Calendar size={16} color={colors.caramel} />
            <Text style={styles.dateText}>
              Entrega: {formatDateTime(order.deliveryDate)} ({order.deliveryMethod === 'delivery' ? 'Entrega' : 'Retirada'})
            </Text>
          </View>

          {/* Botão de Avanço do Status Operacional */}
          {nextStatus && (
            <Button
              title={nextActionName}
              variant="secondary"
              loading={updateStatusMutation.isPending}
              onPress={() => updateStatusMutation.mutate(nextStatus)}
              style={styles.actionStatusBtn}
            />
          )}
        </Card>

        {/* Itens do Pedido */}
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Itens do Pedido</Text>
          {order.items.map((item, idx) => (
            <View key={idx} style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>
                  {item.quantity}x {item.productName}
                </Text>
                {item.flavor ? (
                  <Text style={styles.itemFlavor}>Sabor: {item.flavor}</Text>
                ) : null}
                {item.complements && item.complements.length > 0 ? (
                  <Text style={styles.itemComplements}>
                    + {item.complements.map((c) => c.name).join(', ')}
                  </Text>
                ) : null}
                {item.notes ? (
                  <Text style={styles.itemNotes}>Obs: {item.notes}</Text>
                ) : null}
              </View>
              <Text style={styles.itemPrice}>
                {formatCurrency(item.subtotalCents, currency, hideValues)}
              </Text>
            </View>
          ))}

          <View style={styles.divider} />

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total do Pedido</Text>
            <Text style={styles.totalValue}>
              {formatCurrency(order.totalAmountCents, currency, hideValues)}
            </Text>
          </View>
        </Card>

        {/* Situação Financeira e Pagamentos */}
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Financeiro do Pedido</Text>

          <View style={styles.financeGrid}>
            <View style={styles.financeBox}>
              <Text style={styles.financeBoxLabel}>Total</Text>
              <Text style={styles.financeBoxValue}>
                {formatCurrency(order.totalAmountCents, currency, hideValues)}
              </Text>
            </View>

            <View style={styles.financeBox}>
              <Text style={styles.financeBoxLabel}>Pago</Text>
              <Text style={[styles.financeBoxValue, { color: colors.success }]}>
                {formatCurrency(order.paidAmountCents, currency, hideValues)}
              </Text>
            </View>

            <View style={styles.financeBox}>
              <Text style={styles.financeBoxLabel}>Restante</Text>
              <Text style={[styles.financeBoxValue, { color: colors.danger }]}>
                {formatCurrency(order.remainingAmountCents, currency, hideValues)}
              </Text>
            </View>
          </View>

          {order.remainingAmountCents > 0 ? (
            <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
              {/* Botão Principal: Gerar Link de Pagamento (Stripe) */}
              {order.stripePaymentLinkUrl ? (
                <View style={styles.activeLinkCard}>
                  <View style={styles.activeLinkHeader}>
                    <View style={styles.activeLinkHeaderLeft}>
                      <CreditCard size={16} color={colors.primary} />
                      <Text style={styles.activeLinkTitle}>Link Stripe Disponível</Text>
                    </View>
                    <View style={styles.secureBadge}>
                      <ShieldCheck size={12} color={colors.success} />
                      <Text style={styles.secureBadgeText}>Seguro</Text>
                    </View>
                  </View>

                  <Text style={styles.activeLinkUrl} numberOfLines={1}>
                    {order.stripePaymentLinkUrl}
                  </Text>

                  <View style={styles.activeLinkButtonsRow}>
                    <TouchableOpacity
                      style={styles.activeLinkShareBtn}
                      activeOpacity={0.8}
                      onPress={() => {
                        setActivePaymentLink(order.stripePaymentLinkUrl!);
                        setPaymentLinkModalVisible(true);
                      }}
                    >
                      <Share2 size={14} color="#ffffff" style={{ marginRight: 6 }} />
                      <Text style={styles.activeLinkShareBtnText}>Ver & Compartilhar</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.activeLinkWhatsAppBtn}
                      activeOpacity={0.8}
                      onPress={() => handleSendWhatsApp(order.stripePaymentLinkUrl!)}
                    >
                      <Send size={14} color="#00793b" style={{ marginRight: 4 }} />
                      <Text style={styles.activeLinkWhatsAppBtnText}>WhatsApp</Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={styles.regenerateLinkBtn}
                    onPress={() => generatePaymentLinkMutation.mutate()}
                    disabled={generatePaymentLinkMutation.isPending}
                  >
                    <Text style={styles.regenerateLinkText}>
                      {generatePaymentLinkMutation.isPending ? 'Atualizando...' : '↻ Gerar novo link com saldo atual'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <Button
                  title="Gerar Link de Pagamento"
                  icon={<CreditCard size={18} color="#ffffff" />}
                  loading={generatePaymentLinkMutation.isPending}
                  onPress={() => generatePaymentLinkMutation.mutate()}
                  style={styles.stripeBtn}
                />
              )}

              {/* Botão Secundário: Registrar Pagamento Manual */}
              <Button
                title="Registrar Pagamento Manual"
                variant="secondary"
                icon={<DollarSign size={18} color={colors.primary} />}
                onPress={() => {
                  setPaymentAmountCents(order.remainingAmountCents);
                  setPaymentMethod('cash');
                  setReceiptUri('');
                  setPaymentModalVisible(true);
                }}
                style={styles.payBtn}
              />
            </View>
          ) : (
            <View style={styles.fullyPaidBanner}>
              <CheckCircle size={18} color={colors.success} />
              <Text style={styles.fullyPaidText}>Pedido totalmente quitado</Text>
            </View>
          )}

          {/* Histórico de Pagamentos */}
          <Text style={[styles.sectionSubtitle, { marginTop: spacing.lg }]}>
            Histórico de Pagamentos ({payments.length})
          </Text>

          {payments.length === 0 ? (
            <Text style={styles.noPaymentsText}>Nenhum pagamento registrado ainda.</Text>
          ) : (
            payments.map((p) => (
              <View key={p.id} style={styles.paymentRow}>
                <View style={styles.paymentLeft}>
                  {p.paymentMethod === 'bank_transfer' ? (
                    <ArrowRightLeft size={16} color={colors.primary} />
                  ) : (
                    <Banknote size={16} color={colors.caramel} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.paymentMethodText}>
                      {p.paymentMethod === 'bank_transfer' ? 'TRANSFERÊNCIA BANCÁRIA' : 'DINHEIRO'}
                    </Text>
                    <Text style={styles.paymentDate}>{formatDateTime(p.paidAt)}</Text>
                    {p.receiptUrl ? (
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => setSelectedReceiptViewUrl(p.receiptUrl!)}
                        style={styles.viewReceiptRowBtn}
                      >
                        <Eye size={12} color={colors.primary} />
                        <Text style={styles.viewReceiptRowBtnText}>Ver comprovante</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
                <Text style={styles.paymentAmount}>
                  +{formatCurrency(p.amountCents, currency, hideValues)}
                </Text>
              </View>
            ))
          )}
        </Card>

        {order.notes ? (
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Observações</Text>
            <Text style={styles.notesText}>{order.notes}</Text>
          </Card>
        ) : null}
      </ScrollView>

      {/* Modal - Registrar Pagamento */}
      <Modal visible={paymentModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Registrar Pagamento</Text>
              <TouchableOpacity
                onPress={() => setPaymentModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalScrollBody}
            >
              <Text style={styles.modalHelp}>
                Restante do pedido:{' '}
                {formatCurrency(order.remainingAmountCents, currency, hideValues)}
              </Text>

              <CurrencyInput
                label="Valor a Receber *"
                cents={paymentAmountCents}
                onChangeCents={setPaymentAmountCents}
                currency={currency}
              />

              <Text style={styles.fieldLabel}>Caixinha de Destino</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.accountsRow}>
                {accounts.map((acc) => {
                  const isSelected = (paymentAccountId || accounts[0]?.id) === acc.id;
                  return (
                    <TouchableOpacity
                      key={acc.id}
                      onPress={() => setPaymentAccountId(acc.id)}
                      style={[styles.accountChip, isSelected && styles.accountChipSelected]}
                    >
                      <Text
                        style={[
                          styles.accountChipText,
                          isSelected && styles.accountChipTextSelected,
                        ]}
                      >
                        {acc.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>
                Forma de Pagamento *
              </Text>

              {/* Duas opções: Dinheiro e Transferência */}
              <View style={styles.paymentMethodToggleRow}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setPaymentMethod('cash')}
                  style={[
                    styles.paymentMethodOption,
                    paymentMethod === 'cash' && styles.paymentMethodOptionActive,
                  ]}
                >
                  <Banknote
                    size={20}
                    color={paymentMethod === 'cash' ? '#ffffff' : colors.primary}
                  />
                  <Text
                    style={[
                      styles.paymentMethodOptionText,
                      paymentMethod === 'cash' && styles.paymentMethodOptionTextActive,
                    ]}
                  >
                    Dinheiro
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setPaymentMethod('bank_transfer')}
                  style={[
                    styles.paymentMethodOption,
                    paymentMethod === 'bank_transfer' && styles.paymentMethodOptionActive,
                  ]}
                >
                  <ArrowRightLeft
                    size={20}
                    color={paymentMethod === 'bank_transfer' ? '#ffffff' : colors.primary}
                  />
                  <Text
                    style={[
                      styles.paymentMethodOptionText,
                      paymentMethod === 'bank_transfer' && styles.paymentMethodOptionTextActive,
                    ]}
                  >
                    Transferência
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Se o usuário selecionar transferência, o comprovante é obrigatório */}
              {paymentMethod === 'bank_transfer' && (
                <View style={styles.receiptContainer}>
                  <View style={styles.receiptHeaderRow}>
                    <Text style={styles.receiptFieldLabel}>Comprovante de Transferência</Text>
                    <View style={styles.mandatoryBadge}>
                      <Text style={styles.mandatoryBadgeText}>Obrigatório</Text>
                    </View>
                  </View>

                  {!receiptUri ? (
                    <View style={styles.receiptUploadBox}>
                      <ImageIcon size={26} color={colors.primary} />
                      <Text style={styles.receiptUploadText}>
                        Anexe o comprovante de pagamento enviado pelo cliente
                      </Text>
                      <View style={styles.receiptButtonsRow}>
                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={handleTakeReceiptPhoto}
                          style={styles.receiptActionBtn}
                        >
                          <Camera size={16} color={colors.primary} />
                          <Text style={styles.receiptActionBtnText}>Tirar Foto</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={handlePickReceiptFromGallery}
                          style={styles.receiptActionBtn}
                        >
                          <ImageIcon size={16} color={colors.primary} />
                          <Text style={styles.receiptActionBtnText}>Galeria</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.receiptPreviewCard}>
                      <Image source={{ uri: receiptUri }} style={styles.receiptThumbnail} />
                      <View style={{ flex: 1, marginLeft: spacing.sm }}>
                        <View style={styles.receiptStatusRow}>
                          <Check size={14} color={colors.success} />
                          <Text style={styles.receiptStatusText}>Comprovante anexado</Text>
                        </View>
                        <View style={styles.receiptCardActionsRow}>
                          <TouchableOpacity
                            onPress={() => setSelectedReceiptViewUrl(receiptUri)}
                            style={styles.receiptCardMiniBtn}
                          >
                            <Eye size={13} color={colors.primary} />
                            <Text style={styles.receiptCardMiniBtnText}>Ampliar</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            onPress={handlePickReceiptFromGallery}
                            style={styles.receiptCardMiniBtn}
                          >
                            <Camera size={13} color={colors.primary} />
                            <Text style={styles.receiptCardMiniBtnText}>Trocar</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            onPress={() => setReceiptUri('')}
                            style={[
                              styles.receiptCardMiniBtn,
                              { borderColor: `${colors.danger}40` },
                            ]}
                          >
                            <Trash2 size={13} color={colors.danger} />
                            <Text
                              style={[styles.receiptCardMiniBtnText, { color: colors.danger }]}
                            >
                              Remover
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  )}
                </View>
              )}

              <Button
                title="Confirmar Pagamento"
                loading={addPaymentMutation.isPending}
                onPress={handleConfirmPayment}
                style={{ marginTop: spacing.xl }}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal - Visualizador de Comprovante em Tela Cheia */}
      <Modal visible={!!selectedReceiptViewUrl} transparent animationType="fade">
        <View style={styles.imageViewerOverlay}>
          <View style={styles.imageViewerHeader}>
            <Text style={styles.imageViewerTitle}>Comprovante de Transferência</Text>
            <TouchableOpacity
              onPress={() => setSelectedReceiptViewUrl(null)}
              style={styles.imageViewerCloseBtn}
            >
              <X size={22} color="#ffffff" />
            </TouchableOpacity>
          </View>
          {selectedReceiptViewUrl && (
            <View style={styles.imageViewerBody}>
              <Image
                source={{ uri: selectedReceiptViewUrl }}
                style={styles.imageViewerImage}
                resizeMode="contain"
              />
            </View>
          )}
        </View>
      </Modal>

      {/* Modal - Link de Pagamento Stripe */}
      <Modal
        visible={paymentLinkModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPaymentLinkModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setPaymentLinkModalVisible(false)}
        >
          <TouchableOpacity
            style={styles.linkModalContent}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <View style={styles.linkHeaderRow}>
                <View style={styles.stripeIconCircle}>
                  <CreditCard size={20} color={colors.primary} />
                </View>
                <View>
                  <Text style={styles.modalTitle}>Link de Pagamento Stripe</Text>
                  <Text style={styles.linkModalSubtitle}>
                    Pedido #{order.orderNumber} • {order.customerName}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setPaymentLinkModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Banner de Valor a Pagar */}
            <View style={styles.linkAmountBanner}>
              <Text style={styles.linkAmountLabel}>Saldo a Pagar:</Text>
              <Text style={styles.linkAmountValue}>
                {formatCurrency(order.remainingAmountCents, currency, hideValues)}
              </Text>
            </View>

            {/* Caixa da URL */}
            <Text style={styles.urlBoxLabel}>Link Gerado:</Text>
            <View style={styles.urlBox}>
              <Text style={styles.urlBoxText} numberOfLines={2} selectable>
                {activePaymentLink}
              </Text>
            </View>

            {/* Ações */}
            <View style={styles.linkActionsContainer}>
              <TouchableOpacity
                style={styles.whatsappMainBtn}
                activeOpacity={0.8}
                onPress={() => handleSendWhatsApp(activePaymentLink)}
              >
                <Send size={18} color="#ffffff" style={{ marginRight: 8 }} />
                <Text style={styles.whatsappMainBtnText}>Enviar por WhatsApp</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.shareSecondaryBtn}
                activeOpacity={0.8}
                onPress={() => handleSharePaymentLink(activePaymentLink)}
              >
                <Share2 size={16} color={colors.primary} style={{ marginRight: 8 }} />
                <Text style={styles.shareSecondaryBtnText}>Outras Opções de Envio</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.openBrowserBtn}
                activeOpacity={0.8}
                onPress={() => Linking.openURL(activePaymentLink)}
              >
                <ExternalLink size={15} color={colors.textSecondary} style={{ marginRight: 6 }} />
                <Text style={styles.openBrowserBtnText}>Abrir Página de Pagamento</Text>
              </TouchableOpacity>
            </View>

            {/* Rodapé informativo */}
            <View style={styles.stripeBadgeFooter}>
              <ShieldCheck size={15} color={colors.success} style={{ marginRight: 6 }} />
              <Text style={styles.stripeBadgeFooterText}>
                Processado com segurança via Stripe (Cartão, Apple Pay e Google Pay).
              </Text>
            </View>
          </TouchableOpacity>
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
  scroll: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  headerCard: {
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  orderTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  orderNumber: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 4,
  },
  customerName: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  phoneText: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginLeft: 22,
    marginBottom: 4,
  },
  dateText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
  actionStatusBtn: {
    marginTop: spacing.md,
  },
  card: {
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
    marginBottom: spacing.sm,
  },
  sectionSubtitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.primaryDark,
    marginBottom: spacing.xs,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  itemName: {
    fontSize: typography.sizes.sm,
    color: colors.text,
    fontWeight: typography.weights.medium,
  },
  itemFlavor: {
    fontSize: typography.sizes.xs,
    color: colors.primary,
    fontWeight: typography.weights.semibold,
    marginTop: 1,
  },
  itemComplements: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  itemNotes: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: 1,
  },
  itemPrice: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.primary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  totalValue: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  financeGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  financeBox: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  financeBoxLabel: {
    fontSize: 10,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  financeBoxValue: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginTop: 2,
  },
  payBtn: {
    marginTop: spacing.xs,
  },
  fullyPaidBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: `${colors.success}15`,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
  },
  fullyPaidText: {
    fontSize: typography.sizes.sm,
    color: colors.success,
    fontWeight: typography.weights.bold,
  },
  noPaymentsText: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    fontStyle: 'italic',
    paddingVertical: spacing.xs,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  paymentLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginRight: spacing.sm,
  },
  paymentMethodText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  paymentDate: {
    fontSize: 10,
    color: colors.textMuted,
  },
  paymentAmount: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.success,
    flexShrink: 0,
    textAlign: 'right',
  },
  notesText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  viewReceiptRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: `${colors.primary}15`,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    marginTop: 4,
  },
  viewReceiptRowBtnText: {
    fontSize: 10,
    fontWeight: typography.weights.bold,
    color: colors.primary,
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  modalTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  modalScrollBody: {
    paddingBottom: spacing.lg,
  },
  modalHelp: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  fieldLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.primaryDark,
    marginBottom: spacing.xs,
  },
  accountsRow: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  accountChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: '#ffffff',
    marginRight: spacing.xs,
  },
  accountChipSelected: {
    borderColor: colors.primary,
    backgroundColor: `${colors.goldenBeige}30`,
  },
  accountChipText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
  accountChipTextSelected: {
    color: colors.primary,
    fontWeight: typography.weights.bold,
  },
  paymentMethodToggleRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  paymentMethodOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  paymentMethodOptionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  paymentMethodOptionText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  paymentMethodOptionTextActive: {
    color: '#ffffff',
    fontWeight: typography.weights.bold,
  },
  receiptContainer: {
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: `${colors.goldenBeige}15`,
    borderWidth: 1,
    borderColor: `${colors.primary}25`,
  },
  receiptHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  receiptFieldLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  mandatoryBadge: {
    backgroundColor: `${colors.danger}20`,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  mandatoryBadgeText: {
    fontSize: 10,
    fontWeight: typography.weights.bold,
    color: colors.danger,
  },
  receiptUploadBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderWidth: 1.5,
    borderColor: `${colors.primary}40`,
    borderStyle: 'dashed',
    borderRadius: borderRadius.md,
    backgroundColor: '#ffffff',
  },
  receiptUploadText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  receiptButtonsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  receiptActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.md,
    backgroundColor: `${colors.primary}15`,
    borderWidth: 1,
    borderColor: `${colors.primary}30`,
  },
  receiptActionBtnText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  receiptPreviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  receiptThumbnail: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surface,
  },
  receiptStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  receiptStatusText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.success,
  },
  receiptCardActionsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  receiptCardMiniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  receiptCardMiniBtnText: {
    fontSize: 10,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  imageViewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
  },
  imageViewerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: 48,
    paddingBottom: spacing.md,
  },
  imageViewerTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: '#ffffff',
  },
  imageViewerCloseBtn: {
    padding: spacing.xs,
  },
  imageViewerBody: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  imageViewerImage: {
    width: '100%',
    height: '100%',
  },
  stripeBtn: {
    backgroundColor: colors.primary,
  },
  activeLinkCard: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.xs,
  },
  activeLinkHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  activeLinkHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activeLinkTitle: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  secureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e6f7ec',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    gap: 3,
  },
  secureBadgeText: {
    fontSize: 10,
    fontWeight: typography.weights.bold,
    color: colors.success,
  },
  activeLinkUrl: {
    fontSize: 11,
    color: colors.textSecondary,
    backgroundColor: colors.cardBackground,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  activeLinkButtonsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  activeLinkShareBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 8,
    borderRadius: borderRadius.md,
  },
  activeLinkShareBtnText: {
    color: '#ffffff',
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
  },
  activeLinkWhatsAppBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#eafaf1',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#c3ecd2',
  },
  activeLinkWhatsAppBtnText: {
    color: '#00793b',
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
  },
  regenerateLinkBtn: {
    alignItems: 'center',
    marginTop: 8,
  },
  regenerateLinkText: {
    fontSize: 11,
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
  linkModalContent: {
    backgroundColor: colors.cardBackground,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    paddingBottom: 32,
  },
  linkHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stripeIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  linkModalSubtitle: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  linkAmountBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    marginVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  linkAmountLabel: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  linkAmountValue: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.danger,
  },
  urlBoxLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  urlBox: {
    backgroundColor: colors.surface,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  urlBoxText: {
    fontSize: 11,
    color: colors.primaryDark,
    lineHeight: 16,
  },
  linkActionsContainer: {
    gap: spacing.sm,
  },
  whatsappMainBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#25D366',
    paddingVertical: 12,
    borderRadius: borderRadius.md,
  },
  whatsappMainBtnText: {
    color: '#ffffff',
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
  shareSecondaryBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    borderRadius: borderRadius.md,
  },
  shareSecondaryBtnText: {
    color: colors.primary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  openBrowserBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
  },
  openBrowserBtnText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
  stripeBadgeFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    marginTop: spacing.md,
  },
  stripeBadgeFooterText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
});
