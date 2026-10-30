import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Share,
  Modal,
  Platform,
  KeyboardAvoidingView,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  Truck,
  MapPin,
  Phone,
  MessageCircle,
  Navigation,
  Compass,
  CheckCircle2,
  Clock,
  RotateCcw,
  Plus,
  Share2,
  AlertTriangle,
  User,
  X,
  Check,
  Package,
  Sparkles,
  Map,
  Route,
} from 'lucide-react-native';
import { api } from '../../src/services/api';
import { colors, spacing, typography, borderRadius } from '../../src/theme';
import { formatCurrency } from '../../src/utils/formatters';
import {
  DailyDeliveryPlan,
  DeliveryItem,
  DeliveryShift,
  DeliveryStatus,
  DeliveryFeeEstimateResult,
} from '@koki/types';
import {
  LoadingState,
  EmptyState,
  ProgressBar,
} from '../../src/components/ui';
import { useAlertStore } from '../../src/stores/alert.store';
import { useAuthStore } from '../../src/stores/auth.store';

type ShiftFilter = 'all' | 'morning' | 'afternoon' | 'evening';

const SHIFT_CONFIG: Record<
  DeliveryShift,
  { label: string; icon: string; timeRange: string; color: string; bg: string }
> = {
  morning: { label: 'Manhã', icon: '🌅', timeRange: '08:00 - 12:00', color: '#e67e22', bg: '#fef5eb' },
  afternoon: { label: 'Tarde', icon: '🌤️', timeRange: '12:00 - 18:00', color: '#cc9a52', bg: '#fdf8f0' },
  evening: { label: 'Noite', icon: '🌙', timeRange: '18:00 - 22:00', color: '#2980b9', bg: '#ebf5fb' },
  anytime: { label: 'Qualquer Horário', icon: '⏰', timeRange: 'Horário flexível', color: '#7f8c8d', bg: '#f2f4f4' },
};

function formatIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateFriendly(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const weekdays = [
      'Domingo',
      'Segunda-feira',
      'Terça-feira',
      'Quarta-feira',
      'Quinta-feira',
      'Sexta-feira',
      'Sábado',
    ];
    const months = [
      'Janeiro',
      'Fevereiro',
      'Março',
      'Abril',
      'Maio',
      'Junho',
      'Julho',
      'Agosto',
      'Setembro',
      'Outubro',
      'Novembro',
      'Dezembro',
    ];
    return `${weekdays[date.getDay()]}, ${day} de ${months[date.getMonth()]}`;
  } catch {
    return dateStr;
  }
}

export default function DeliveryPlannerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { showAlert } = useAlertStore();
  const { company } = useAuthStore();

  const companyFormattedAddress = useMemo(() => {
    const addr = company?.address;
    if (!addr) return '';
    const streetPart = [addr.street, addr.number, addr.complement].filter(Boolean).join(', ');
    const cityPart = [addr.postalCode, addr.city].filter(Boolean).join(' ');
    return [streetPart, addr.neighborhood, cityPart].filter(Boolean).join(' - ');
  }, [company?.address]);

  const todayStr = useMemo(() => formatIsoDate(new Date()), []);
  const tomorrowStr = useMemo(() => {
    const tom = new Date();
    tom.setDate(tom.getDate() + 1);
    return formatIsoDate(tom);
  }, []);

  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedShift, setSelectedShift] = useState<ShiftFilter>('all');

  // Route Optimization & Origin State
  const [originAddressInput, setOriginAddressInput] = useState<string>('');
  const [isEditingOrigin, setIsEditingOrigin] = useState<boolean>(false);
  const [applySuggestedFeesOnOptimize, setApplySuggestedFeesOnOptimize] = useState<boolean>(true);

  // Modal: Nova Entrega Manual
  const [newDeliveryModalVisible, setNewDeliveryModalVisible] = useState<boolean>(false);
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [street, setStreet] = useState<string>('');
  const [number, setNumber] = useState<string>('');
  const [neighborhood, setNeighborhood] = useState<string>('');
  const [city, setCity] = useState<string>('');
  const [postalCode, setPostalCode] = useState<string>('');
  const [shift, setShift] = useState<DeliveryShift>('morning');
  const [scheduledTime, setScheduledTime] = useState<string>('');
  const [deliveryFeeCents, setDeliveryFeeCents] = useState<string>('0');
  const [remainingAmountCents, setRemainingAmountCents] = useState<string>('0');
  const [driverName, setDriverName] = useState<string>('');
  const [deliveryNotes, setDeliveryNotes] = useState<string>('');
  const [itemsSummary, setItemsSummary] = useState<string>('');
  const [manualFeeEstimate, setManualFeeEstimate] = useState<DeliveryFeeEstimateResult | null>(null);
  const [isEstimatingManualFee, setIsEstimatingManualFee] = useState<boolean>(false);

  // Modal: Atribuir Motorista Rápido
  const [driverModalVisible, setDriverModalVisible] = useState<boolean>(false);
  const [selectedDeliveryForDriver, setSelectedDeliveryForDriver] = useState<DeliveryItem | null>(null);
  const [assignDriverInput, setAssignDriverInput] = useState<string>('');

  // 1. Fetch Daily Delivery Plan
  const {
    data: plan,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery<DailyDeliveryPlan>({
    queryKey: ['delivery-daily-plan', selectedDate],
    queryFn: () => api.get<DailyDeliveryPlan>(`/delivery-planner/daily?date=${selectedDate}`),
  });

  useEffect(() => {
    if (companyFormattedAddress) {
      setOriginAddressInput(companyFormattedAddress);
    } else if (plan?.routeSummary?.originAddress) {
      setOriginAddressInput(plan.routeSummary.originAddress);
    }
  }, [companyFormattedAddress, plan?.routeSummary?.originAddress]);

  // 2. Mutations
  const optimizeRouteMutation = useMutation({
    mutationFn: () =>
      api.post<DailyDeliveryPlan>('/delivery-planner/optimize-route', {
        date: selectedDate,
        shift: selectedShift,
        originAddress: originAddressInput.trim() || undefined,
        applySuggestedFees: applySuggestedFeesOnOptimize,
      }),
    onSuccess: (updatedPlan) => {
      queryClient.setQueryData(['delivery-daily-plan', selectedDate], updatedPlan);
      queryClient.invalidateQueries({ queryKey: ['orders-list'] });
      setIsEditingOrigin(false);
      showAlert({
        title: 'Rota Eficiente Criada! 🗺️',
        message: `As paradas foram ordenadas pelo melhor trajeto (${
          updatedPlan.routeSummary?.totalDistanceKm || 0
        } km total • ~${updatedPlan.routeSummary?.estimatedDurationMinutes || 0} min)${
          applySuggestedFeesOnOptimize
            ? ' e as taxas sugeridas por distância foram aplicadas.'
            : '.'
        }`,
        type: 'success',
        buttons: [{ text: 'Excelente!', style: 'default' }],
      });
    },
    onError: (err: any) => {
      showAlert({
        title: 'Erro ao otimizar rota',
        message: err.message || 'Não foi possível calcular a rota eficiente.',
        type: 'danger',
        buttons: [{ text: 'OK', style: 'default' }],
      });
    },
  });

  const applyStopSuggestedFeeMutation = useMutation({
    mutationFn: ({ id, feeCents }: { id: string; feeCents: number }) =>
      api.patch<DeliveryItem>(`/delivery-planner/${id}/apply-fee`, {
        deliveryFeeCents: feeCents,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-daily-plan', selectedDate] });
      queryClient.invalidateQueries({ queryKey: ['orders-list'] });
      showAlert({
        title: 'Taxa Aplicada!',
        message: 'A taxa sugerida pela distância foi aplicada a esta entrega.',
        type: 'success',
        buttons: [{ text: 'OK', style: 'default' }],
      });
    },
    onError: (err: any) => {
      showAlert({
        title: 'Erro ao aplicar taxa',
        message: err.message || 'Não foi possível atualizar a taxa da entrega.',
        type: 'danger',
        buttons: [{ text: 'OK', style: 'default' }],
      });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status, notes }: { id: string; status: DeliveryStatus; notes?: string }) =>
      api.patch<DeliveryItem>(`/delivery-planner/${id}/status`, { status, notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-daily-plan', selectedDate] });
      queryClient.invalidateQueries({ queryKey: ['orders-list'] });
    },
    onError: (err: any) => {
      showAlert({
        title: 'Erro ao atualizar',
        message: err.message || 'Não foi possível atualizar o status da entrega.',
        type: 'danger',
        buttons: [{ text: 'OK', style: 'default' }],
      });
    },
  });

  const assignDriverMutation = useMutation({
    mutationFn: ({ id, driverName }: { id: string; driverName: string }) =>
      api.patch<DeliveryItem>(`/delivery-planner/${id}/driver`, { driverName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-daily-plan', selectedDate] });
      setDriverModalVisible(false);
      setSelectedDeliveryForDriver(null);
      setAssignDriverInput('');
      showAlert({
        title: 'Entregador Atribuído!',
        message: 'O entregador foi vinculado com sucesso a esta entrega.',
        type: 'success',
        buttons: [{ text: 'OK', style: 'default' }],
      });
    },
    onError: (err: any) => {
      showAlert({
        title: 'Erro ao atribuir',
        message: err.message || 'Não foi possível atribuir o entregador.',
        type: 'danger',
        buttons: [{ text: 'OK', style: 'default' }],
      });
    },
  });

  const createDeliveryMutation = useMutation({
    mutationFn: (data: any) => api.post<DeliveryItem>('/delivery-planner', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-daily-plan', selectedDate] });
      setNewDeliveryModalVisible(false);
      resetNewDeliveryForm();
      showAlert({
        title: 'Entrega Agendada!',
        message: 'A nova entrega foi adicionada ao roteiro do dia.',
        type: 'success',
        buttons: [{ text: 'OK', style: 'default' }],
      });
    },
    onError: (err: any) => {
      showAlert({
        title: 'Erro ao agendar',
        message: err.message || 'Verifique os dados da entrega.',
        type: 'danger',
        buttons: [{ text: 'OK', style: 'default' }],
      });
    },
  });

  const deleteDeliveryMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/delivery-planner/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-daily-plan', selectedDate] });
      showAlert({
        title: 'Entrega Removida',
        message: 'A entrega foi removida da rota com sucesso.',
        type: 'success',
        buttons: [{ text: 'OK', style: 'default' }],
      });
    },
    onError: (err: any) => {
      showAlert({
        title: 'Erro ao remover',
        message: err.message || 'Não foi possível remover a entrega.',
        type: 'danger',
        buttons: [{ text: 'OK', style: 'default' }],
      });
    },
  });

  // Navigation & Actions
  const changeDateByOffset = (offsetDays: number) => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() + offsetDays);
    setSelectedDate(formatIsoDate(date));
  };

  const resetNewDeliveryForm = () => {
    setCustomerName('');
    setCustomerPhone('');
    setStreet('');
    setNumber('');
    setNeighborhood('');
    setCity('');
    setPostalCode('');
    setShift('morning');
    setScheduledTime('');
    setDeliveryFeeCents('0');
    setRemainingAmountCents('0');
    setDriverName('');
    setDeliveryNotes('');
    setItemsSummary('');
    setManualFeeEstimate(null);
  };

  const handleEstimateManualDeliveryFee = async () => {
    if (!street.trim() && !postalCode.trim() && !city.trim()) {
      showAlert({
        title: 'Informe o Endereço',
        message: 'Preencha pelo menos a rua, código postal ou cidade para calcular a distância e sugerir a taxa.',
        type: 'warning',
        buttons: [{ text: 'OK', style: 'default' }],
      });
      return;
    }

    try {
      setIsEstimatingManualFee(true);
      const res = await api.post<DeliveryFeeEstimateResult>('/delivery-planner/estimate-fee', {
        originAddress: originAddressInput.trim() || undefined,
        destinationAddress: {
          street: street.trim() || undefined,
          number: number.trim() || undefined,
          neighborhood: neighborhood.trim() || undefined,
          city: city.trim() || undefined,
          postalCode: postalCode.trim() || undefined,
        },
      });
      setManualFeeEstimate(res);
      setDeliveryFeeCents((res.suggestedFeeCents / 100).toFixed(2));
    } catch (e: any) {
      showAlert({
        title: 'Erro ao estimar taxa',
        message: e.message || 'Não foi possível calcular a distância.',
        type: 'danger',
        buttons: [{ text: 'OK', style: 'default' }],
      });
    } finally {
      setIsEstimatingManualFee(false);
    }
  };

  const handleCreateDeliverySubmit = () => {
    if (!customerName.trim()) {
      showAlert({
        title: 'Nome Obrigatório',
        message: 'Informe o nome do cliente ou destinatário.',
        type: 'warning',
        buttons: [{ text: 'OK', style: 'default' }],
      });
      return;
    }

    createDeliveryMutation.mutate({
      date: selectedDate,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim() || undefined,
      address: {
        street: street.trim() || undefined,
        number: number.trim() || undefined,
        neighborhood: neighborhood.trim() || undefined,
        city: city.trim() || undefined,
        postalCode: postalCode.trim() || undefined,
      },
      shift,
      scheduledTime: scheduledTime.trim() || undefined,
      deliveryFeeCents: Math.round((parseFloat(deliveryFeeCents.replace(',', '.')) || 0) * 100),
      suggestedDeliveryFeeCents: manualFeeEstimate?.suggestedFeeCents,
      distanceKm: manualFeeEstimate?.distanceKm,
      remainingAmountCents: Math.round((parseFloat(remainingAmountCents.replace(',', '.')) || 0) * 100),
      driverName: driverName.trim() || undefined,
      notes: deliveryNotes.trim() || undefined,
      itemsSummary: itemsSummary.trim() || undefined,
      status: 'pending',
    });
  };

  const confirmDeleteDelivery = (item: DeliveryItem) => {
    showAlert({
      title: 'Remover Entrega?',
      message: `Deseja remover a entrega para "${item.customerName}" da rota de ${formatDateFriendly(selectedDate)}?`,
      type: 'confirm',
      buttons: [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: () => deleteDeliveryMutation.mutate(item.id),
        },
      ],
    });
  };

  // Filter deliveries by shift
  const filteredDeliveries = useMemo(() => {
    if (!plan) return [];
    if (selectedShift === 'all') return plan.deliveries;
    return plan.deliveries.filter((d) => d.shift === selectedShift);
  }, [plan, selectedShift]);

  // Open Full Multi-Stop Route in Google Maps
  const handleOpenFullRouteMap = () => {
    if (filteredDeliveries.length === 0) {
      showAlert({
        title: 'Sem Paradas na Rota',
        message: 'Não há entregas no turno selecionado para abrir no mapa.',
        type: 'info',
        buttons: [{ text: 'OK', style: 'default' }],
      });
      return;
    }

    // Prefer non-delivered stops in routeOrder sequence; fallback to all stops in current filter
    const activeStops = filteredDeliveries.filter(
      (d) => d.status !== 'delivered' && d.status !== 'failed',
    );
    const stopsToNavigate = activeStops.length > 0 ? activeStops : filteredDeliveries;

    const stopAddresses = stopsToNavigate
      .map(
        (d) =>
          d.address.formattedAddress ||
          [d.address.street, d.address.number, d.address.neighborhood, d.address.city, d.address.postalCode]
            .filter(Boolean)
            .join(', '),
      )
      .filter((addr) => addr && addr.trim() !== '' && addr !== 'Endereço não informado');

    if (stopAddresses.length === 0) {
      showAlert({
        title: 'Endereços não informados',
        message: 'Cadastre o endereço dos clientes nas entregas para traçar a rota no mapa.',
        type: 'warning',
        buttons: [{ text: 'OK', style: 'default' }],
      });
      return;
    }

    const origin =
      originAddressInput.trim() ||
      plan?.routeSummary?.originAddress ||
      'Lisboa, Portugal';
    const destination = stopAddresses[stopAddresses.length - 1];
    const waypoints = stopAddresses.slice(0, -1);

    const url =
      selectedShift === 'all' &&
      !originAddressInput.trim() &&
      plan?.routeSummary?.googleMapsRouteUrl
        ? plan.routeSummary.googleMapsRouteUrl
        : `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
            origin,
          )}&destination=${encodeURIComponent(destination)}${
            waypoints.length > 0
              ? `&waypoints=${encodeURIComponent(waypoints.join('|'))}`
              : ''
          }&travelmode=driving`;

    Linking.openURL(url).catch(() => {
      showAlert({
        title: 'Não foi possível abrir o mapa',
        message: 'Verifique se há um navegador ou aplicativo Google Maps instalado.',
        type: 'warning',
        buttons: [{ text: 'OK', style: 'default' }],
      });
    });
  };

  // External Navigation & Contacts per Stop
  const openGoogleMaps = (item: DeliveryItem) => {
    const query = encodeURIComponent(
      item.address.formattedAddress ||
        `${item.address.street || ''} ${item.address.number || ''} ${item.address.neighborhood || ''} ${item.address.city || ''}`,
    );
    const url = `https://www.google.com/maps/search/?api=1&query=${query}`;
    Linking.openURL(url).catch(() => {
      showAlert({
        title: 'Não foi possível abrir o mapa',
        message: 'Verifique se há um aplicativo de mapas instalado.',
        type: 'warning',
        buttons: [{ text: 'OK', style: 'default' }],
      });
    });
  };

  const openWaze = (item: DeliveryItem) => {
    const query = encodeURIComponent(
      item.address.formattedAddress ||
        `${item.address.street || ''} ${item.address.number || ''} ${item.address.city || ''}`,
    );
    const url = `https://waze.com/ul?q=${query}&navigate=yes`;
    Linking.openURL(url).catch(() => {
      showAlert({
        title: 'Waze não instalado',
        message: 'Não foi possível abrir o Waze diretamente.',
        type: 'warning',
        buttons: [{ text: 'OK', style: 'default' }],
      });
    });
  };

  const openWhatsApp = (item: DeliveryItem) => {
    if (!item.customerPhone) {
      showAlert({
        title: 'Sem Telefone',
        message: 'Este cliente não possui telefone/WhatsApp cadastrado.',
        type: 'info',
        buttons: [{ text: 'OK', style: 'default' }],
      });
      return;
    }

    const cleanPhone = item.customerPhone.replace(/\D/g, '');
    const message = encodeURIComponent(
      `Olá ${item.customerName}! Aqui é da confeitaria Koki 🍪\nSua encomenda${
        item.orderNumber ? ` do Pedido #${item.orderNumber}` : ''
      } está a caminho da sua morada!\nPrevisão: ${item.scheduledTime || SHIFT_CONFIG[item.shift].label}.`,
    );

    Linking.openURL(`whatsapp://send?phone=${cleanPhone}&text=${message}`).catch(() => {
      Linking.openURL(`https://wa.me/${cleanPhone}?text=${message}`).catch(() => {
        showAlert({
          title: 'Erro',
          message: 'Não foi possível abrir o WhatsApp.',
          type: 'danger',
          buttons: [{ text: 'OK', style: 'default' }],
        });
      });
    });
  };

  const callCustomer = (phone?: string) => {
    if (!phone) {
      showAlert({
        title: 'Sem Telefone',
        message: 'Telefone não cadastrado.',
        type: 'info',
        buttons: [{ text: 'OK', style: 'default' }],
      });
      return;
    }
    Linking.openURL(`tel:${phone.replace(/\s/g, '')}`);
  };

  // Share Route / Dispatch Sheet with Driver on WhatsApp
  const handleShareRoute = async () => {
    if (!plan || plan.deliveries.length === 0) {
      showAlert({
        title: 'Nenhuma Entrega',
        message: 'Não há entregas cadastradas para este dia para compartilhar.',
        type: 'info',
        buttons: [{ text: 'OK', style: 'default' }],
      });
      return;
    }

    let text = `🚚 *ROTEIRO DE ENTREGAS KOKI*\n`;
    text += `🗓️ ${formatDateFriendly(selectedDate)}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

    text += `📊 *RESUMO DA ROTA*\n`;
    text += `• Total de entregas: ${plan.totalDeliveriesCount}\n`;
    if (plan.routeSummary) {
      text += `• Distância total estimada: ${plan.routeSummary.totalDistanceKm} km (~${plan.routeSummary.estimatedDurationMinutes} min)\n`;
    }
    text += `• Concluídas: ${plan.completedDeliveriesCount}/${plan.totalDeliveriesCount}\n`;
    text += `• Total a cobrar na entrega: ${formatCurrency(plan.totalAmountToCollectCents)}\n`;
    if (plan.routeSummary?.googleMapsRouteUrl) {
      text += `• 🗺️ Mapa da Rota Completa: ${plan.routeSummary.googleMapsRouteUrl}\n`;
    }
    text += `\n`;

    plan.deliveries.forEach((d, idx) => {
      const statusIcon = d.status === 'delivered' ? '✅' : d.status === 'out_for_delivery' ? '🛵' : '⚪';
      text += `📍 *PARADA #${idx + 1}* - ${statusIcon} ${d.customerName}${
        d.distanceKm ? ` (${d.distanceKm} km)` : ''
      }\n`;
      if (d.orderNumber) text += `   Pedido: #${d.orderNumber}\n`;
      if (d.scheduledTime) text += `   Horário previsto: ${d.scheduledTime} (${SHIFT_CONFIG[d.shift].label})\n`;
      if (d.address.formattedAddress) text += `   Endereço: ${d.address.formattedAddress}\n`;
      if (d.customerPhone) text += `   Contato: ${d.customerPhone}\n`;
      if (d.itemsSummary) text += `   Itens: ${d.itemsSummary}\n`;

      if (d.financialStatus !== 'paid' && d.remainingAmountCents > 0) {
        text += `   ⚠️ *COBRAR NA ENTREGA: ${formatCurrency(d.remainingAmountCents)}*\n`;
      } else {
        text += `   Pago antecipadamente ✅\n`;
      }

      const mapQuery = encodeURIComponent(
        d.address.formattedAddress ||
          `${d.address.street || ''} ${d.address.number || ''} ${d.address.city || ''}`,
      );
      text += `   🗺️ Mapa: https://www.google.com/maps/search/?api=1&query=${mapQuery}\n\n`;
    });

    text += `_Gerado com carinho pelo Koki Confeitaria_ 🍪✨`;

    try {
      await Share.share({ message: text });
    } catch {}
  };

  const progressPercentage = useMemo(() => {
    if (!plan || plan.totalDeliveriesCount === 0) return 0;
    return Math.round((plan.completedDeliveriesCount / plan.totalDeliveriesCount) * 100);
  }, [plan]);

  return (
    <View style={styles.container}>
      {/* 1. Header Fixo com Safe Area */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) + 8 }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <ChevronLeft size={24} color={colors.primaryDark} />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Planejador de Entregas</Text>
            <Text style={styles.headerSubtitle}>Rotas inteligentes, taxas & mapa do dia</Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerActionButton}
            onPress={handleShareRoute}
            activeOpacity={0.7}
          >
            <Share2 size={20} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerActionButton}
            onPress={() => refetch()}
            activeOpacity={0.7}
          >
            <RotateCcw size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. Barra de Navegação Temporal (Dia anterior / Hoje / Amanhã / Próximo) */}
      <View style={styles.dateStrip}>
        <TouchableOpacity
          style={styles.dateArrow}
          onPress={() => changeDateByOffset(-1)}
          activeOpacity={0.7}
        >
          <ChevronRight size={20} color={colors.primaryDark} style={{ transform: [{ rotate: '180deg' }] }} />
        </TouchableOpacity>

        <View style={styles.dateInfo}>
          <View style={styles.dateQuickPills}>
            <TouchableOpacity
              style={[styles.pill, selectedDate === todayStr && styles.pillActive]}
              onPress={() => setSelectedDate(todayStr)}
            >
              <Text style={[styles.pillText, selectedDate === todayStr && styles.pillTextActive]}>
                Hoje
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.pill, selectedDate === tomorrowStr && styles.pillActive]}
              onPress={() => setSelectedDate(tomorrowStr)}
            >
              <Text style={[styles.pillText, selectedDate === tomorrowStr && styles.pillTextActive]}>
                Amanhã
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.dateTitle} numberOfLines={1}>
            {formatDateFriendly(selectedDate)}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.dateArrow}
          onPress={() => changeDateByOffset(1)}
          activeOpacity={0.7}
        >
          <ChevronRight size={20} color={colors.primaryDark} />
        </TouchableOpacity>
      </View>

      {/* 3. Conteúdo Principal */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 80 }]}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => {
              refetch();
            }}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {isLoading ? (
          <LoadingState message="Carregando roteiro de entregas..." />
        ) : (
          <>
            {/* KPI Summary Card */}
            <View style={styles.summaryCard}>
              <View style={styles.kpiRow}>
                <View style={styles.kpiCol}>
                  <Text style={styles.kpiLabel}>Entregas do Dia</Text>
                  <Text style={styles.kpiValue}>
                    {plan?.completedDeliveriesCount || 0}/{plan?.totalDeliveriesCount || 0}
                  </Text>
                  <Text style={styles.kpiSub}>{progressPercentage}% entregues</Text>
                </View>

                <View style={styles.kpiDivider} />

                <View style={styles.kpiCol}>
                  <Text style={styles.kpiLabel}>Fretes Faturados</Text>
                  <Text style={[styles.kpiValue, { color: colors.caramel }]}>
                    {formatCurrency(plan?.totalDeliveryFeesCents || 0)}
                  </Text>
                  <Text style={styles.kpiSub}>taxas de entrega</Text>
                </View>

                <View style={styles.kpiDivider} />

                <View style={styles.kpiCol}>
                  <Text style={styles.kpiLabel}>A Cobrar no Ato</Text>
                  <Text style={[styles.kpiValue, { color: colors.danger }]}>
                    {formatCurrency(plan?.totalAmountToCollectCents || 0)}
                  </Text>
                  <Text style={styles.kpiSub}>pendente na entrega</Text>
                </View>
              </View>

              {/* Progress Bar */}
              <View style={styles.progressContainer}>
                <ProgressBar
                  progress={progressPercentage / 100}
                  color={progressPercentage === 100 ? colors.success : colors.caramel}
                />
              </View>
            </View>

            {/* CARD DE ROTA EFICIENTE, SUGESTÃO DE TAXA POR DISTÂNCIA & MAPA */}
            <View style={styles.routeOptimizerCard}>
              <View style={styles.routeOptimizerHeader}>
                <View style={styles.routeHeaderTitleRow}>
                  <View style={styles.routeIconBadge}>
                    <Route size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.routeOptimizerTitle}>Rota Eficiente & Taxas</Text>
                    <Text style={styles.routeOptimizerSubtitle} numberOfLines={2}>
                      Partida (Empresa):{' '}
                      {companyFormattedAddress ||
                        plan?.routeSummary?.originAddress ||
                        'Endereço não cadastrado nas Configurações da Conta'}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.editOriginBtn}
                  onPress={() => router.push('/settings')}
                >
                  <Text style={styles.editOriginBtnText}>
                    {companyFormattedAddress ? 'Editar na Conta' : 'Cadastrar Endereço'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Métricas de Distância, Tempo e Sugestão de Taxas */}
              <View style={styles.routeMetricsRow}>
                <View style={styles.routeMetricPill}>
                  <Text style={styles.routeMetricLabel}>Distância Total</Text>
                  <Text style={styles.routeMetricValue}>
                    {plan?.routeSummary?.totalDistanceKm ?? 0} km
                  </Text>
                </View>
                <View style={styles.routeMetricPill}>
                  <Text style={styles.routeMetricLabel}>Tempo Estimado</Text>
                  <Text style={styles.routeMetricValue}>
                    ~{plan?.routeSummary?.estimatedDurationMinutes ?? 0} min
                  </Text>
                </View>
                <View style={styles.routeMetricPill}>
                  <Text style={styles.routeMetricLabel}>Taxas Sugeridas</Text>
                  <Text style={[styles.routeMetricValue, { color: colors.primary }]}>
                    {formatCurrency(plan?.routeSummary?.totalSuggestedFeeCents || 0)}
                  </Text>
                </View>
              </View>

              {/* Opção de aplicar taxas sugeridas automaticamente ao otimizar */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setApplySuggestedFeesOnOptimize(!applySuggestedFeesOnOptimize)}
                style={styles.applyFeesToggleRow}
              >
                <View
                  style={[
                    styles.miniCheckbox,
                    applySuggestedFeesOnOptimize && styles.miniCheckboxChecked,
                  ]}
                >
                  {applySuggestedFeesOnOptimize && <Check size={12} color="#ffffff" />}
                </View>
                <Text style={styles.applyFeesToggleText}>
                  Atualizar taxas das entregas com o valor sugerido pela distância (km)
                </Text>
              </TouchableOpacity>

              {/* Botões Principais: Criar Rota Eficiente + Abrir Mapa com a Rota */}
              <View style={styles.routeMainActionsRow}>
                <TouchableOpacity
                  style={[
                    styles.optimizeRouteBtn,
                    (!plan || plan.deliveries.length === 0) && styles.btnDisabled,
                  ]}
                  activeOpacity={0.85}
                  disabled={
                    optimizeRouteMutation.isPending || !plan || plan.deliveries.length === 0
                  }
                  onPress={() => {
                    if (!companyFormattedAddress && !plan?.routeSummary?.originAddress) {
                      showAlert({
                        title: 'Endereço da Empresa não cadastrado',
                        message:
                          'Cadastre o endereço da sua empresa nas Configurações da Conta para que a rota e as distâncias usem o ponto de partida exato.',
                        type: 'warning',
                        buttons: [
                          {
                            text: 'Cadastrar na Conta',
                            style: 'default',
                            onPress: () => router.push('/settings'),
                          },
                          {
                            text: 'Calcular Mesmo Assim',
                            style: 'cancel',
                            onPress: () => optimizeRouteMutation.mutate(),
                          },
                        ],
                      });
                      return;
                    }
                    optimizeRouteMutation.mutate();
                  }}
                >
                  <Sparkles size={16} color="#ffffff" />
                  <Text style={styles.optimizeRouteBtnText}>
                    {optimizeRouteMutation.isPending
                      ? 'Calculando Rota...'
                      : 'Criar Rota Eficiente'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.openRouteMapBtn,
                    filteredDeliveries.length === 0 && styles.btnDisabled,
                  ]}
                  activeOpacity={0.85}
                  disabled={filteredDeliveries.length === 0}
                  onPress={handleOpenFullRouteMap}
                >
                  <Map size={16} color={colors.primaryDark} />
                  <Text style={styles.openRouteMapBtnText}>Abrir Mapa com a Rota</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Ação: Agendar Nova Parada / Entrega Manual */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.newDeliveryBtn}
                onPress={() => setNewDeliveryModalVisible(true)}
                activeOpacity={0.8}
              >
                <Plus size={16} color="#ffffff" />
                <Text style={styles.newDeliveryBtnText}>Agendar Nova Entrega</Text>
              </TouchableOpacity>
            </View>

            {/* Shift Filter Tabs */}
            <View style={styles.shiftTabs}>
              <TouchableOpacity
                style={[styles.shiftTab, selectedShift === 'all' && styles.shiftTabActive]}
                onPress={() => setSelectedShift('all')}
              >
                <Text style={[styles.shiftTabText, selectedShift === 'all' && styles.shiftTabTextActive]}>
                  Todas ({plan?.deliveries.length || 0})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.shiftTab, selectedShift === 'morning' && styles.shiftTabActive]}
                onPress={() => setSelectedShift('morning')}
              >
                <Text style={[styles.shiftTabText, selectedShift === 'morning' && styles.shiftTabTextActive]}>
                  🌅 Manhã ({plan?.deliveriesByShift.morning.length || 0})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.shiftTab, selectedShift === 'afternoon' && styles.shiftTabActive]}
                onPress={() => setSelectedShift('afternoon')}
              >
                <Text style={[styles.shiftTabText, selectedShift === 'afternoon' && styles.shiftTabTextActive]}>
                  🌤️ Tarde ({plan?.deliveriesByShift.afternoon.length || 0})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.shiftTab, selectedShift === 'evening' && styles.shiftTabActive]}
                onPress={() => setSelectedShift('evening')}
              >
                <Text style={[styles.shiftTabText, selectedShift === 'evening' && styles.shiftTabTextActive]}>
                  🌙 Noite ({plan?.deliveriesByShift.evening.length || 0})
                </Text>
              </TouchableOpacity>
            </View>

            {/* Lista de Entregas / Paradas */}
            {filteredDeliveries.length === 0 ? (
              <EmptyState
                title="Nenhuma entrega agendada"
                description={`Não há entregas registradas para o turno selecionado em ${formatDateFriendly(selectedDate)}.`}
              />
            ) : (
              filteredDeliveries.map((delivery, index) => {
                const shiftCfg = SHIFT_CONFIG[delivery.shift] || SHIFT_CONFIG.morning;
                const isDelivered = delivery.status === 'delivered';
                const isOut = delivery.status === 'out_for_delivery';
                const isFailed = delivery.status === 'failed';
                const hasPendingPayment =
                  delivery.financialStatus !== 'paid' && delivery.remainingAmountCents > 0;
                const suggestedCents = delivery.suggestedDeliveryFeeCents || 0;
                const showSuggestedFeeAction =
                  suggestedCents > 0 && suggestedCents !== delivery.deliveryFeeCents;

                return (
                  <View
                    key={delivery.id}
                    style={[styles.deliveryCard, isDelivered && styles.deliveryCardDelivered]}
                  >
                    {/* Header do Card */}
                    <View style={styles.cardHeaderRow}>
                      <View style={styles.stopSequenceBadge}>
                        <Text style={styles.stopSequenceText}>
                          #{delivery.routeOrder || index + 1}
                        </Text>
                      </View>

                      <View style={styles.cardTitleCol}>
                        <View style={styles.customerNameRow}>
                          <Text
                            style={[
                              styles.customerName,
                              isDelivered && styles.customerNameDelivered,
                            ]}
                          >
                            {delivery.customerName}
                          </Text>
                          {delivery.orderNumber ? (
                            <Text style={styles.orderNumberText}>Pedido #{delivery.orderNumber}</Text>
                          ) : null}
                        </View>

                        <View style={styles.shiftBadgeRow}>
                          <View style={[styles.shiftTag, { backgroundColor: shiftCfg.bg }]}>
                            <Text style={[styles.shiftTagText, { color: shiftCfg.color }]}>
                              {shiftCfg.icon} {shiftCfg.label}
                            </Text>
                          </View>

                          {delivery.distanceKm !== undefined && delivery.distanceKm > 0 ? (
                            <View style={styles.distanceTag}>
                              <Navigation size={10} color={colors.primary} />
                              <Text style={styles.distanceTagText}>{delivery.distanceKm} km</Text>
                            </View>
                          ) : null}

                          {delivery.scheduledTime ? (
                            <View style={styles.timeTag}>
                              <Clock size={11} color={colors.textSecondary} />
                              <Text style={styles.timeTagText}>{delivery.scheduledTime}</Text>
                            </View>
                          ) : null}

                          <View
                            style={[
                              styles.statusBadge,
                              isDelivered && styles.statusBadgeDelivered,
                              isOut && styles.statusBadgeOut,
                              isFailed && styles.statusBadgeFailed,
                            ]}
                          >
                            <Text
                              style={[
                                styles.statusBadgeText,
                                isDelivered && styles.statusBadgeTextDelivered,
                                isOut && styles.statusBadgeTextOut,
                                isFailed && styles.statusBadgeTextFailed,
                              ]}
                            >
                              {isDelivered
                                ? 'Entregue'
                                : isOut
                                ? 'Em Rota 🛵'
                                : isFailed
                                ? 'Não Entregue'
                                : 'Pendente'}
                            </Text>
                          </View>
                        </View>
                      </View>

                      <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={() => confirmDeleteDelivery(delivery)}
                        activeOpacity={0.7}
                      >
                        <X size={16} color={colors.textMuted} />
                      </TouchableOpacity>
                    </View>

                    {/* Endereço */}
                    <View style={styles.addressBox}>
                      <MapPin size={16} color={colors.primary} style={{ marginTop: 2 }} />
                      <Text style={styles.addressText}>
                        {delivery.address.formattedAddress || 'Endereço não informado'}
                      </Text>
                    </View>

                    {/* Sugestão de Taxa Baseada na Distância */}
                    {suggestedCents > 0 && (
                      <View style={styles.stopSuggestedFeeBox}>
                        <View style={styles.stopSuggestedFeeLeft}>
                          <Sparkles size={13} color={colors.primary} />
                          <Text style={styles.stopSuggestedFeeText}>
                            Taxa sugerida ({delivery.distanceKm ?? 0} km):{' '}
                            <Text style={{ fontWeight: '800', color: colors.primary }}>
                              {formatCurrency(suggestedCents)}
                            </Text>
                          </Text>
                        </View>

                        {showSuggestedFeeAction ? (
                          <TouchableOpacity
                            style={styles.applyStopFeeBtn}
                            onPress={() =>
                              applyStopSuggestedFeeMutation.mutate({
                                id: delivery.id,
                                feeCents: suggestedCents,
                              })
                            }
                            disabled={applyStopSuggestedFeeMutation.isPending}
                          >
                            <Text style={styles.applyStopFeeBtnText}>Aplicar Taxa</Text>
                          </TouchableOpacity>
                        ) : (
                          <Text style={styles.appliedFeeCheckText}>Taxa aplicada ✓</Text>
                        )}
                      </View>
                    )}

                    {/* Itens do Pedido */}
                    {delivery.itemsSummary ? (
                      <View style={styles.itemsSummaryBox}>
                        <Package size={14} color={colors.textSecondary} />
                        <Text style={styles.itemsSummaryText} numberOfLines={2}>
                          {delivery.itemsSummary}
                        </Text>
                      </View>
                    ) : null}

                    {/* Alerta Financeiro: Cobrar na entrega ou Pago */}
                    <View style={styles.financialRow}>
                      {hasPendingPayment ? (
                        <View style={styles.alertCollectBox}>
                          <AlertTriangle size={14} color={colors.danger} />
                          <Text style={styles.alertCollectText}>
                            Cobrar na entrega:{' '}
                            <Text style={styles.alertCollectBold}>
                              {formatCurrency(delivery.remainingAmountCents)}
                            </Text>
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.paidBadge}>
                          <Check size={14} color={colors.success} />
                          <Text style={styles.paidBadgeText}>Pago antecipadamente</Text>
                        </View>
                      )}

                      <Text style={styles.feeText}>
                        Taxa atual: {formatCurrency(delivery.deliveryFeeCents || 0)}
                      </Text>
                    </View>

                    {/* Entregador vinculado */}
                    <View style={styles.driverRow}>
                      <View style={styles.driverInfo}>
                        <User size={13} color={colors.textSecondary} />
                        <Text style={styles.driverText}>
                          {delivery.driverName
                            ? `Entregador: ${delivery.driverName}`
                            : 'Nenhum entregador atribuído'}
                        </Text>
                      </View>

                      <TouchableOpacity
                        style={styles.assignDriverBtn}
                        onPress={() => {
                          setSelectedDeliveryForDriver(delivery);
                          setAssignDriverInput(delivery.driverName || '');
                          setDriverModalVisible(true);
                        }}
                      >
                        <Text style={styles.assignDriverBtnText}>
                          {delivery.driverName ? 'Alterar' : '+ Atribuir'}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Barra de Ações Rápidas (Google Maps, Waze, WhatsApp, Ligar) */}
                    <View style={styles.quickNavActions}>
                      <TouchableOpacity
                        style={styles.quickNavBtn}
                        onPress={() => openGoogleMaps(delivery)}
                        activeOpacity={0.7}
                      >
                        <Navigation size={15} color={colors.primary} />
                        <Text style={styles.quickNavBtnText}>Google Maps</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.quickNavBtn}
                        onPress={() => openWaze(delivery)}
                        activeOpacity={0.7}
                      >
                        <Compass size={15} color="#0099ff" />
                        <Text style={[styles.quickNavBtnText, { color: '#0099ff' }]}>Waze</Text>
                      </TouchableOpacity>

                      {delivery.customerPhone ? (
                        <>
                          <TouchableOpacity
                            style={styles.quickNavBtn}
                            onPress={() => openWhatsApp(delivery)}
                            activeOpacity={0.7}
                          >
                            <MessageCircle size={15} color="#25D366" />
                            <Text style={[styles.quickNavBtnText, { color: '#25D366' }]}>WhatsApp</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.quickNavBtn}
                            onPress={() => callCustomer(delivery.customerPhone)}
                            activeOpacity={0.7}
                          >
                            <Phone size={15} color={colors.primaryDark} />
                            <Text style={styles.quickNavBtnText}>Ligar</Text>
                          </TouchableOpacity>
                        </>
                      ) : null}
                    </View>

                    {/* Botões de Avanço de Status da Entrega */}
                    <View style={styles.statusChangeRow}>
                      {!isDelivered ? (
                        <>
                          {!isOut && (
                            <TouchableOpacity
                              style={styles.startRouteBtn}
                              onPress={() =>
                                updateStatusMutation.mutate({
                                  id: delivery.id,
                                  status: 'out_for_delivery',
                                })
                              }
                              activeOpacity={0.8}
                            >
                              <Truck size={14} color="#ffffff" />
                              <Text style={styles.startRouteBtnText}>Sair para Entrega</Text>
                            </TouchableOpacity>
                          )}

                          <TouchableOpacity
                            style={styles.confirmDeliveredBtn}
                            onPress={() =>
                              updateStatusMutation.mutate({
                                id: delivery.id,
                                status: 'delivered',
                              })
                            }
                            activeOpacity={0.8}
                          >
                            <CheckCircle2 size={14} color="#ffffff" />
                            <Text style={styles.confirmDeliveredBtnText}>Confirmar Entrega</Text>
                          </TouchableOpacity>
                        </>
                      ) : (
                        <TouchableOpacity
                          style={styles.reopenDeliveryBtn}
                          onPress={() =>
                            updateStatusMutation.mutate({
                              id: delivery.id,
                              status: 'pending',
                            })
                          }
                          activeOpacity={0.8}
                        >
                          <RotateCcw size={14} color={colors.textSecondary} />
                          <Text style={styles.reopenDeliveryBtnText}>Reabrir Entrega</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </>
        )}
      </ScrollView>

      {/* MODAL: NOVA ENTREGA MANUAL */}
      <Modal
        visible={newDeliveryModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setNewDeliveryModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Nova Entrega / Parada</Text>
                <Text style={styles.modalSubtitle}>Agendar para {formatDateFriendly(selectedDate)}</Text>
              </View>
              <TouchableOpacity
                onPress={() => setNewDeliveryModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
              {/* Destinatário */}
              <Text style={styles.inputLabel}>Nome do Destinatário *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Ex: Mariana Silva"
                placeholderTextColor={colors.textMuted}
                value={customerName}
                onChangeText={setCustomerName}
              />

              {/* Telefone */}
              <Text style={styles.inputLabel}>Telefone / WhatsApp</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Ex: +351 912 345 678"
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
                value={customerPhone}
                onChangeText={setCustomerPhone}
              />

              {/* Endereço */}
              <Text style={styles.inputLabel}>Endereço Completo</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Rua / Avenida"
                placeholderTextColor={colors.textMuted}
                value={street}
                onChangeText={setStreet}
              />

              <View style={styles.inputsGrid}>
                <View style={styles.gridCol}>
                  <Text style={styles.inputLabel}>Número / Apto</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Ex: 45, 2º Dto"
                    placeholderTextColor={colors.textMuted}
                    value={number}
                    onChangeText={setNumber}
                  />
                </View>

                <View style={styles.gridCol}>
                  <Text style={styles.inputLabel}>Bairro / Freguesia</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Ex: Baixa"
                    placeholderTextColor={colors.textMuted}
                    value={neighborhood}
                    onChangeText={setNeighborhood}
                  />
                </View>
              </View>

              <View style={styles.inputsGrid}>
                <View style={styles.gridCol}>
                  <Text style={styles.inputLabel}>Cidade</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Ex: Lisboa"
                    placeholderTextColor={colors.textMuted}
                    value={city}
                    onChangeText={setCity}
                  />
                </View>

                <View style={styles.gridCol}>
                  <Text style={styles.inputLabel}>Código Postal / CEP</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="1000-001"
                    placeholderTextColor={colors.textMuted}
                    value={postalCode}
                    onChangeText={setPostalCode}
                  />
                </View>
              </View>

              {/* Botão para calcular distância e sugerir taxa */}
              <TouchableOpacity
                style={styles.estimateManualFeeBtn}
                onPress={handleEstimateManualDeliveryFee}
                disabled={isEstimatingManualFee}
              >
                <Sparkles size={15} color={colors.primary} />
                <Text style={styles.estimateManualFeeBtnText}>
                  {isEstimatingManualFee
                    ? 'Calculando distância e taxa...'
                    : 'Calcular Distância e Sugerir Taxa'}
                </Text>
              </TouchableOpacity>

              {manualFeeEstimate && (
                <View style={styles.manualFeeEstimateBanner}>
                  <Text style={styles.manualFeeEstimateText}>
                    📍 Distância estimada: <Text style={{ fontWeight: '800' }}>{manualFeeEstimate.distanceKm} km</Text> (~{manualFeeEstimate.estimatedDurationMinutes} min) • Taxa sugerida:{' '}
                    <Text style={{ fontWeight: '800', color: colors.primary }}>
                      {formatCurrency(manualFeeEstimate.suggestedFeeCents)}
                    </Text>
                  </Text>
                </View>
              )}

              {/* Turno e Horário */}
              <Text style={styles.inputLabel}>Turno da Rota</Text>
              <View style={styles.shiftPickerRow}>
                {(['morning', 'afternoon', 'evening'] as DeliveryShift[]).map((sKey) => {
                  const cfg = SHIFT_CONFIG[sKey];
                  const selected = shift === sKey;
                  return (
                    <TouchableOpacity
                      key={sKey}
                      style={[
                        styles.shiftChoiceBtn,
                        selected && { backgroundColor: cfg.bg, borderColor: cfg.color },
                      ]}
                      onPress={() => setShift(sKey)}
                    >
                      <Text
                        style={[
                          styles.shiftChoiceText,
                          selected && { color: cfg.color, fontWeight: '700' },
                        ]}
                      >
                        {cfg.icon} {cfg.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.inputsGrid}>
                <View style={styles.gridCol}>
                  <Text style={styles.inputLabel}>Horário Previsto</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="10:30"
                    placeholderTextColor={colors.textMuted}
                    value={scheduledTime}
                    onChangeText={setScheduledTime}
                  />
                </View>

                <View style={styles.gridCol}>
                  <Text style={styles.inputLabel}>Taxa de Entrega (€)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="0.00"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    value={deliveryFeeCents}
                    onChangeText={setDeliveryFeeCents}
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Valor a Cobrar na Entrega (€)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="0.00 (deixe 0 se já pago)"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                value={remainingAmountCents}
                onChangeText={setRemainingAmountCents}
              />

              <Text style={styles.inputLabel}>Itens da Encomenda</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Ex: 1x Bolo Red Velvet, 50x Brigadeiros"
                placeholderTextColor={colors.textMuted}
                value={itemsSummary}
                onChangeText={setItemsSummary}
              />

              <Text style={styles.inputLabel}>Instruções / Notas da Rota</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder="Ex: Tocar a campainha 2x, deixar com a portaria se ausente."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={2}
                value={deliveryNotes}
                onChangeText={setDeliveryNotes}
              />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setNewDeliveryModalVisible(false)}
              >
                <Text style={styles.modalCancelBtnText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={handleCreateDeliverySubmit}
                disabled={createDeliveryMutation.isPending}
              >
                <Text style={styles.modalSubmitBtnText}>
                  {createDeliveryMutation.isPending ? 'Salvando...' : 'Agendar Entrega'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* MODAL: ATRIBUIR ENTREGADOR */}
      <Modal
        visible={driverModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDriverModalVisible(false)}
      >
        <View style={styles.modalOverlayCenter}>
          <View style={styles.modalSmallCard}>
            <Text style={styles.modalTitle}>Atribuir Entregador</Text>
            <Text style={styles.modalSubtitle}>
              Destinatário: {selectedDeliveryForDriver?.customerName}
            </Text>

            <TextInput
              style={[styles.textInput, { marginTop: spacing.md }]}
              placeholder="Nome do entregador (ex: Carlos, Uber Flash)"
              placeholderTextColor={colors.textMuted}
              value={assignDriverInput}
              onChangeText={setAssignDriverInput}
            />

            <View style={styles.quickDriverSuggestions}>
              {['Carlos Motoboy', 'Uber Flash', 'Entrega Própria', 'Retirada'].map((name) => (
                <TouchableOpacity
                  key={name}
                  style={styles.driverSuggestionChip}
                  onPress={() => setAssignDriverInput(name)}
                >
                  <Text style={styles.driverSuggestionText}>{name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalFooterCenter}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setDriverModalVisible(false)}
              >
                <Text style={styles.modalCancelBtnText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={() => {
                  if (selectedDeliveryForDriver && assignDriverInput.trim()) {
                    assignDriverMutation.mutate({
                      id: selectedDeliveryForDriver.id,
                      driverName: assignDriverInput.trim(),
                    });
                  }
                }}
              >
                <Text style={styles.modalSubmitBtnText}>Salvar</Text>
              </TouchableOpacity>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  headerSubtitle: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  headerActionButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  dateStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dateArrow: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  dateInfo: {
    alignItems: 'center',
    flex: 1,
  },
  dateQuickPills: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: 4,
  },
  pill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
  },
  pillActive: {
    backgroundColor: colors.primary,
  },
  pillText: {
    fontSize: typography.sizes.xs,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  pillTextActive: {
    color: colors.textInverse,
  },
  dateTitle: {
    fontSize: typography.sizes.md,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
  },
  summaryCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  kpiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  kpiCol: {
    flex: 1,
    alignItems: 'center',
  },
  kpiDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border,
  },
  kpiLabel: {
    fontSize: typography.sizes.xs - 1,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  kpiValue: {
    fontSize: typography.sizes.xl,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  kpiSub: {
    fontSize: typography.sizes.xs - 2,
    color: colors.textMuted,
    marginTop: 2,
  },
  progressContainer: {
    marginTop: spacing.xs,
  },
  routeOptimizerCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: `${colors.primary}45`,
    marginBottom: spacing.md,
  },
  routeOptimizerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  routeHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  routeIconBadge: {
    width: 34,
    height: 34,
    borderRadius: borderRadius.md,
    backgroundColor: `${colors.goldenBeige}40`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeOptimizerTitle: {
    fontSize: typography.sizes.md,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  routeOptimizerSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  editOriginBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  editOriginBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  originEditorBox: {
    backgroundColor: colors.surface,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  originEditorLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryDark,
    marginBottom: 4,
  },
  originTextInput: {
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    fontSize: typography.sizes.xs,
    color: colors.text,
  },
  routeMetricsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  routeMetricPill: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  routeMetricLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  routeMetricValue: {
    fontSize: typography.sizes.sm,
    fontWeight: '800',
    color: colors.primaryDark,
    marginTop: 2,
  },
  applyFeesToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
    paddingVertical: 2,
  },
  miniCheckbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  miniCheckboxChecked: {
    backgroundColor: colors.primary,
  },
  applyFeesToggleText: {
    fontSize: 11,
    color: colors.textSecondary,
    flex: 1,
  },
  routeMainActionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  optimizeRouteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.md,
    gap: 6,
  },
  optimizeRouteBtnText: {
    color: '#ffffff',
    fontSize: typography.sizes.xs,
    fontWeight: '800',
  },
  openRouteMapBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.goldenBeige,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.md,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.caramel,
  },
  openRouteMapBtnText: {
    color: colors.primaryDark,
    fontSize: typography.sizes.xs,
    fontWeight: '800',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  actionRow: {
    marginBottom: spacing.sm,
  },
  newDeliveryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.caramel,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  newDeliveryBtnText: {
    color: '#ffffff',
    fontSize: typography.sizes.sm,
    fontWeight: '700',
  },
  shiftTabs: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: 3,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  shiftTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  shiftTabActive: {
    backgroundColor: colors.cardBackground,
  },
  shiftTabText: {
    fontSize: typography.sizes.xs - 1,
    fontWeight: '600',
    color: colors.textMuted,
  },
  shiftTabTextActive: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
  deliveryCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  deliveryCardDelivered: {
    opacity: 0.75,
    backgroundColor: '#fafaf9',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  stopSequenceBadge: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  stopSequenceText: {
    fontSize: typography.sizes.xs,
    fontWeight: '800',
    color: colors.primary,
  },
  cardTitleCol: {
    flex: 1,
  },
  customerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  customerName: {
    fontSize: typography.sizes.md,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  customerNameDelivered: {
    textDecorationLine: 'line-through',
    color: colors.textMuted,
  },
  orderNumberText: {
    fontSize: typography.sizes.xs,
    fontWeight: '700',
    color: colors.caramel,
  },
  shiftBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  shiftTag: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: borderRadius.sm,
  },
  shiftTagText: {
    fontSize: typography.sizes.xs - 1,
    fontWeight: '700',
  },
  distanceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: `${colors.goldenBeige}40`,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: borderRadius.sm,
  },
  distanceTagText: {
    fontSize: typography.sizes.xs - 1,
    color: colors.primaryDark,
    fontWeight: '700',
  },
  timeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.surface,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: borderRadius.sm,
  },
  timeTagText: {
    fontSize: typography.sizes.xs - 1,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  statusBadge: {
    backgroundColor: colors.surface,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: borderRadius.sm,
  },
  statusBadgeDelivered: {
    backgroundColor: '#eafaf1',
  },
  statusBadgeOut: {
    backgroundColor: '#ebf5fb',
  },
  statusBadgeFailed: {
    backgroundColor: '#fdedec',
  },
  statusBadgeText: {
    fontSize: typography.sizes.xs - 1,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  statusBadgeTextDelivered: {
    color: colors.success,
  },
  statusBadgeTextOut: {
    color: '#2980b9',
  },
  statusBadgeTextFailed: {
    color: colors.danger,
  },
  deleteBtn: {
    padding: 2,
  },
  addressBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: spacing.sm,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  addressText: {
    fontSize: typography.sizes.xs,
    color: colors.text,
    flex: 1,
    lineHeight: 18,
  },
  stopSuggestedFeeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
    backgroundColor: `${colors.goldenBeige}25`,
    borderWidth: 1,
    borderColor: `${colors.primary}35`,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    gap: spacing.xs,
  },
  stopSuggestedFeeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
  },
  stopSuggestedFeeText: {
    fontSize: 11,
    color: colors.primaryDark,
    fontWeight: '600',
  },
  applyStopFeeBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  applyStopFeeBtnText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  appliedFeeCheckText: {
    fontSize: 10,
    color: colors.success,
    fontWeight: '700',
  },
  itemsSummaryBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    paddingHorizontal: 4,
  },
  itemsSummaryText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    flex: 1,
  },
  financialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.surface,
  },
  alertCollectBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  alertCollectText: {
    fontSize: typography.sizes.xs,
    color: colors.danger,
    fontWeight: '600',
  },
  alertCollectBold: {
    fontWeight: '800',
  },
  paidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  paidBadgeText: {
    fontSize: typography.sizes.xs,
    color: colors.success,
    fontWeight: '600',
  },
  feeText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
    paddingVertical: 2,
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  driverText: {
    fontSize: typography.sizes.xs - 1,
    color: colors.textSecondary,
  },
  assignDriverBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  assignDriverBtnText: {
    fontSize: typography.sizes.xs,
    fontWeight: '700',
    color: colors.primary,
  },
  quickNavActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.surface,
  },
  quickNavBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickNavBtnText: {
    fontSize: typography.sizes.xs - 1,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  statusChangeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  startRouteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.caramel,
    paddingVertical: 8,
    borderRadius: borderRadius.sm,
    gap: 4,
  },
  startRouteBtnText: {
    color: '#ffffff',
    fontSize: typography.sizes.xs,
    fontWeight: '700',
  },
  confirmDeliveredBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success,
    paddingVertical: 8,
    borderRadius: borderRadius.sm,
    gap: 4,
  },
  confirmDeliveredBtnText: {
    color: '#ffffff',
    fontSize: typography.sizes.xs,
    fontWeight: '700',
  },
  reopenDeliveryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    paddingVertical: 8,
    borderRadius: borderRadius.sm,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reopenDeliveryBtnText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(51, 34, 10, 0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.cardBackground,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '90%',
    padding: spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  modalSubtitle: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
  modalCloseBtn: {
    padding: spacing.xs,
  },
  modalBody: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: '700',
    color: colors.primaryDark,
    marginBottom: 4,
    marginTop: spacing.sm,
  },
  textInput: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.sizes.sm,
    color: colors.text,
  },
  textArea: {
    minHeight: 55,
    textAlignVertical: 'top',
  },
  inputsGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  gridCol: {
    flex: 1,
  },
  estimateManualFeeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: `${colors.goldenBeige}35`,
    borderWidth: 1,
    borderColor: `${colors.primary}40`,
  },
  estimateManualFeeBtnText: {
    fontSize: typography.sizes.xs,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  manualFeeEstimateBanner: {
    marginTop: spacing.xs,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  manualFeeEstimateText: {
    fontSize: 11,
    color: colors.primaryDark,
  },
  shiftPickerRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  shiftChoiceBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  shiftChoiceText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  modalCancelBtnText: {
    fontSize: typography.sizes.sm,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  modalSubmitBtn: {
    flex: 2,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  modalSubmitBtnText: {
    fontSize: typography.sizes.sm,
    fontWeight: '700',
    color: '#ffffff',
  },
  modalOverlayCenter: {
    flex: 1,
    backgroundColor: 'rgba(51, 34, 10, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalSmallCard: {
    width: '100%',
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickDriverSuggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  driverSuggestionChip: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  driverSuggestionText: {
    fontSize: typography.sizes.xs,
    color: colors.primaryDark,
    fontWeight: '600',
  },
  modalFooterCenter: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
