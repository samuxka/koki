import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { colors, spacing, typography, borderRadius } from '../theme';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { KokiCookie } from './ui/KokiCookie';
import { api } from '../services/api';
import {
  KOKI_PLANS,
  SubscriptionTier,
  Plan as IPlan,
  EntitlementsResponse,
} from '@koki/types';
import {
  X,
  Check,
  Sparkles,
  Crown,
  Zap,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  ShieldCheck,
} from 'lucide-react-native';

interface PlansModalProps {
  visible: boolean;
  onClose: () => void;
  initialTier?: SubscriptionTier;
}

export const PlansModal: React.FC<PlansModalProps> = ({
  visible,
  onClose,
  initialTier = 'pro',
}) => {
  const queryClient = useQueryClient();
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>(initialTier);
  const [showTable, setShowTable] = useState(false);

  const { data: entitlements, isLoading: loadingEntitlements } = useQuery<EntitlementsResponse>({
    queryKey: ['company-entitlements'],
    queryFn: () => api.get<EntitlementsResponse>('/entitlements/features'),
  });

  const upgradeMutation = useMutation({
    mutationFn: (tier: SubscriptionTier) =>
      api.post('/entitlements/upgrade', {
        tier,
        interval: billingInterval,
      }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['company-entitlements'] });
      Alert.alert(
        'Plano Atualizado com Sucesso!',
        selectedTier === 'pro'
          ? 'Parabéns! Seus 14 dias de teste do Koki Pro foram ativados com todas as ferramentas liberadas.'
          : 'Parabéns! Sua empresa agora conta com a escala e automação do Koki Business.',
        [{ text: 'Começar a usar', onPress: onClose }],
      );
    },
    onError: (err: any) => {
      Alert.alert('Erro ao alterar plano', err.message || 'Não foi possível processar a assinatura.');
    },
  });

  const currentTier = entitlements?.tier || 'free';

  const COMPARISON_ROWS = [
    { label: 'Receitas & Fichas Técnicas', free: '10', pro: '100', biz: 'Ilimitadas' },
    { label: 'Itens no Estoque', free: '20 itens', pro: '300 itens', biz: 'Ilimitado' },
    { label: 'Lista de Compras', free: 'Manual', pro: 'Automática', biz: 'Automática' },
    { label: 'Produtos Cadastrados', free: '5', pro: '100', biz: 'Ilimitados' },
    { label: 'Clientes Cadastrados', free: '20', pro: '500', biz: 'Ilimitados' },
    { label: 'Cupons de Desconto', free: '—', pro: '10 ativos', biz: 'Ilimitados' },
    { label: 'Calculadora de Custos', free: 'Sim', pro: 'Sim', biz: 'Sim' },
    { label: 'Conversor de Medidas', free: 'Sim', pro: 'Sim', biz: 'Sim' },
    { label: 'Escalonador de Receitas', free: 'Sim', pro: 'Sim', biz: 'Sim' },
    { label: 'Planeador de Produção', free: '—', pro: 'Manual', biz: 'Automático' },
    { label: 'Planeador de Entrega', free: '—', pro: 'Até 30/mês', biz: 'Ilimitado' },
    { label: 'Gerador de Etiqueta e Lote', free: '10/mês', pro: '300/mês', biz: 'Ilimitado' },
    { label: 'Criador de Combos', free: '2', pro: '30', biz: 'Ilimitados' },
    { label: 'Bot WhatsApp', free: '—', pro: '—', biz: 'Incluído*' },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <KokiCookie size={26} variant="brown" />
              <View>
                <Text style={styles.title}>Planos Koki</Text>
                <Text style={styles.subtitle}>Escale sua confeitaria com o plano certo</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={colors.primaryDark} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scroll}>
            {/* Toggle de Ciclo de Cobrança */}
            <View style={styles.intervalToggle}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setBillingInterval('monthly')}
                style={[
                  styles.intervalBtn,
                  billingInterval === 'monthly' && styles.intervalBtnActive,
                ]}
              >
                <Text
                  style={[
                    styles.intervalText,
                    billingInterval === 'monthly' && styles.intervalTextActive,
                  ]}
                >
                  Mensal
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setBillingInterval('yearly')}
                style={[
                  styles.intervalBtn,
                  billingInterval === 'yearly' && styles.intervalBtnActive,
                ]}
              >
                <Text
                  style={[
                    styles.intervalText,
                    billingInterval === 'yearly' && styles.intervalTextActive,
                  ]}
                >
                  Anual
                </Text>
                <View style={styles.discountBadge}>
                  <Text style={styles.discountBadgeText}>-20% OFF</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* CARD 1: FREE */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setSelectedTier('free')}
              style={[
                styles.planCard,
                selectedTier === 'free' && styles.planCardSelected,
              ]}
            >
              <View style={styles.planCardHeader}>
                <View>
                  <Text style={styles.planName}>Free</Text>
                  <Text style={styles.planTagline}>Para experimentar e começar</Text>
                </View>
                {currentTier === 'free' && (
                  <View style={styles.currentBadge}>
                    <Text style={styles.currentBadgeText}>Plano Atual</Text>
                  </View>
                )}
              </View>

              <View style={styles.priceRow}>
                <Text style={styles.priceBig}>0 €</Text>
                <Text style={styles.pricePeriod}> / para sempre</Text>
              </View>
              <Text style={styles.planDesc}>Ferramentas essenciais com limites.</Text>

              <View style={styles.divider} />

              <View style={styles.featuresList}>
                {KOKI_PLANS.free.highlights.map((h, i) => (
                  <View key={i} style={styles.featureItem}>
                    <Check size={14} color={colors.success} />
                    <Text style={styles.featureText}>{h}</Text>
                  </View>
                ))}
              </View>
            </TouchableOpacity>

            {/* CARD 2: PRO (DESTAQUE MÁXIMO) */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setSelectedTier('pro')}
              style={[
                styles.planCard,
                styles.proCardHighlight,
                selectedTier === 'pro' && styles.proCardSelected,
              ]}
            >
              {/* Badge superior Dourado */}
              <View style={styles.popularBadge}>
                <Sparkles size={13} color="#ffffff" />
                <Text style={styles.popularBadgeText}>MAIS POPULAR • MELHOR VALOR</Text>
              </View>

              <View style={styles.planCardHeader}>
                <View>
                  <Text style={[styles.planName, { color: colors.primary }]}>Pro</Text>
                  <Text style={styles.planTagline}>Gestão completa do dia a dia</Text>
                </View>
                {currentTier === 'pro' ? (
                  <View style={styles.currentBadge}>
                    <Text style={styles.currentBadgeText}>Plano Atual</Text>
                  </View>
                ) : (
                  <View style={styles.trialPill}>
                    <Text style={styles.trialPillText}>14 Dias Grátis</Text>
                  </View>
                )}
              </View>

              <View style={styles.priceRow}>
                <Text style={styles.priceBig}>
                  {billingInterval === 'yearly' ? '7,99 €' : '9,99 €'}
                </Text>
                <Text style={styles.pricePeriod}>
                  {billingInterval === 'yearly' ? ' / mês (cobrado anualmente)' : ' / mês'}
                </Text>
              </View>
              <Text style={styles.planDesc}>
                A melhor relação custo-benefício para controlar receitas, estoque, pedidos e entregas.
              </Text>

              <View style={styles.divider} />

              <View style={styles.featuresList}>
                {KOKI_PLANS.pro.highlights.map((h, i) => (
                  <View key={i} style={styles.featureItem}>
                    <Check size={14} color={colors.primary} />
                    <Text style={[styles.featureText, { fontWeight: '500' }]}>{h}</Text>
                  </View>
                ))}
              </View>
            </TouchableOpacity>

            {/* CARD 3: BUSINESS */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setSelectedTier('business')}
              style={[
                styles.planCard,
                selectedTier === 'business' && styles.businessCardSelected,
              ]}
            >
              <View style={styles.businessBadge}>
                <Crown size={13} color={colors.primaryDark} />
                <Text style={styles.businessBadgeText}>AVANÇADO & ESCALA</Text>
              </View>

              <View style={styles.planCardHeader}>
                <View>
                  <Text style={styles.planName}>Business</Text>
                  <Text style={styles.planTagline}>Automação avançada e maior escala</Text>
                </View>
                {currentTier === 'business' && (
                  <View style={styles.currentBadge}>
                    <Text style={styles.currentBadgeText}>Plano Atual</Text>
                  </View>
                )}
              </View>

              <View style={styles.priceRow}>
                <Text style={styles.priceBig}>
                  {billingInterval === 'yearly' ? '23,90 €' : '29,90 €'}
                </Text>
                <Text style={styles.pricePeriod}>
                  {billingInterval === 'yearly' ? ' / mês (cobrado anualmente)' : ' / mês'}
                </Text>
              </View>
              <Text style={styles.planDesc}>
                Para operações maiores com produção inteligente, entregas ilimitadas e Bot WhatsApp.
              </Text>

              <View style={styles.divider} />

              <View style={styles.featuresList}>
                {KOKI_PLANS.business.highlights.map((h, i) => (
                  <View key={i} style={styles.featureItem}>
                    <Check size={14} color={colors.caramel} />
                    <Text style={styles.featureText}>{h}</Text>
                  </View>
                ))}
              </View>
            </TouchableOpacity>

            {/* Botão de Toggle da Tabela Comparativa */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setShowTable(!showTable)}
              style={styles.tableToggleBtn}
            >
              <Text style={styles.tableToggleText}>
                {showTable ? 'Ocultar Comparação Detalhada' : 'Ver Comparação Completa dos 3 Planos'}
              </Text>
              {showTable ? (
                <ChevronUp size={16} color={colors.primary} />
              ) : (
                <ChevronDown size={16} color={colors.primary} />
              )}
            </TouchableOpacity>

            {/* TABELA COMPARATIVA COMPLETA */}
            {showTable && (
              <View style={styles.comparisonTable}>
                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Funcionalidade</Text>
                  <Text style={styles.tableHeaderCell}>Free</Text>
                  <Text style={[styles.tableHeaderCell, { color: colors.primary, fontWeight: '700' }]}>
                    Pro
                  </Text>
                  <Text style={styles.tableHeaderCell}>Business</Text>
                </View>

                {COMPARISON_ROWS.map((row, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.tableRow,
                      idx % 2 === 1 && { backgroundColor: `${colors.goldenBeige}15` },
                    ]}
                  >
                    <Text style={[styles.tableCellName, { flex: 2 }]}>{row.label}</Text>
                    <Text style={styles.tableCellValue}>{row.free}</Text>
                    <Text style={[styles.tableCellValue, { color: colors.primary, fontWeight: '600' }]}>
                      {row.pro}
                    </Text>
                    <Text style={[styles.tableCellValue, { fontWeight: '600' }]}>{row.biz}</Text>
                  </View>
                ))}
                <Text style={styles.whatsappNote}>
                  * O bot WhatsApp no Business inclui franquia mensal de mensagens automáticas.
                </Text>
              </View>
            )}

            {/* Garantia e Segurança */}
            <View style={styles.guaranteeRow}>
              <ShieldCheck size={18} color={colors.success} />
              <Text style={styles.guaranteeText}>
                14 dias de teste sem compromisso no plano Pro. Cancele quando quiser.
              </Text>
            </View>
          </ScrollView>

          {/* Footer com Ação Principal */}
          <View style={styles.footer}>
            <Button
              title={
                selectedTier === currentTier
                  ? 'Plano Atual Selecionado'
                  : selectedTier === 'pro'
                  ? 'Experimentar Pro (14 Dias Grátis)'
                  : selectedTier === 'business'
                  ? 'Assinar Plano Business'
                  : 'Voltar ao Plano Gratuito'
              }
              disabled={selectedTier === currentTier || upgradeMutation.isPending}
              loading={upgradeMutation.isPending}
              onPress={() => upgradeMutation.mutate(selectedTier)}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    height: '92%',
    backgroundColor: colors.background,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: '#ffffff',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  subtitle: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  intervalToggle: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.md,
    padding: 3,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  intervalBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: borderRadius.sm,
    gap: 6,
  },
  intervalBtnActive: {
    backgroundColor: colors.primary,
  },
  intervalText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.textMuted,
  },
  intervalTextActive: {
    color: '#ffffff',
    fontWeight: typography.weights.bold,
  },
  discountBadge: {
    backgroundColor: colors.caramel,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  discountBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: typography.weights.bold,
  },
  planCard: {
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.lg,
    padding: 16,
    marginBottom: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  planCardSelected: {
    borderColor: colors.primaryDark,
    backgroundColor: '#ffffff',
  },
  proCardHighlight: {
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: '#fffdf9',
    position: 'relative',
    paddingTop: 24,
  },
  proCardSelected: {
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 3,
  },
  popularBadge: {
    position: 'absolute',
    top: -12,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  popularBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.5,
  },
  businessBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: `${colors.goldenBeige}80`,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.xs,
  },
  businessBadgeText: {
    color: colors.primaryDark,
    fontSize: 10,
    fontWeight: typography.weights.bold,
  },
  businessCardSelected: {
    borderColor: colors.caramel,
    borderWidth: 2,
  },
  planCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  planName: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  planTagline: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginTop: 1,
  },
  currentBadge: {
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  currentBadgeText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  trialPill: {
    backgroundColor: `${colors.success}18`,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  trialPillText: {
    fontSize: 11,
    color: colors.success,
    fontWeight: typography.weights.bold,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: spacing.sm,
  },
  priceBig: {
    fontSize: 26,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  pricePeriod: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
  },
  planDesc: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: 4,
    lineHeight: 16,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  featuresList: {
    gap: 6,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    fontSize: typography.sizes.xs,
    color: colors.text,
  },
  tableToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: 6,
  },
  tableToggleText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  comparisonTable: {
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableHeaderCell: {
    flex: 1,
    fontSize: 11,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  tableCellName: {
    fontSize: 11,
    color: colors.text,
    fontWeight: typography.weights.medium,
  },
  tableCellValue: {
    flex: 1,
    fontSize: 10,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  whatsappNote: {
    fontSize: 10,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: 6,
    paddingHorizontal: 4,
  },
  guaranteeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  guaranteeText: {
    flex: 1,
    fontSize: 11,
    color: colors.textMuted,
  },
  footer: {
    padding: spacing.lg,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
