import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Ticket,
  Sparkles,
  Percent,
  DollarSign,
  Calendar,
  Clock,
  Shuffle,
  ShoppingBag,
  Users,
  ShieldCheck,
  Check,
} from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '../../src/theme';
import { Card, Button, Input, CurrencyInput, Badge } from '../../src/components/ui';
import { api } from '../../src/services/api';
import { useAuthStore } from '../../src/stores/auth.store';
import { formatCurrency } from '../../src/utils/formatters';
import { DiscountType, CreateCouponDto, Coupon } from '@koki/types';

const CODE_SUGGESTIONS = [
  'DOCE10',
  'BOLO15',
  'BEMVINDO',
  'CLIENTEVIP',
  'FESTA20',
  'PROMO5',
  'AMOR10',
  'CHOCO15',
];

export default function NewCouponScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { company } = useAuthStore();
  const currency = company?.currency || 'EUR';

  // Form State
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [discountType, setDiscountType] = useState<DiscountType>('percentage');
  const [percentValue, setPercentValue] = useState('10'); // 10%
  const [fixedValueCents, setFixedValueCents] = useState(500); // 5,00 €
  const [maxDiscountCents, setMaxDiscountCents] = useState(0); // 0 = no cap
  const [minOrderCents, setMinOrderCents] = useState(0); // 0 = no min

  // Limits
  const [hasTotalLimit, setHasTotalLimit] = useState(false);
  const [totalLimit, setTotalLimit] = useState('50');
  const [hasCustomerLimit, setHasCustomerLimit] = useState(true);
  const [customerLimit, setCustomerLimit] = useState('1');

  // Dates
  const [expiryOption, setExpiryOption] = useState<'none' | '7d' | '15d' | '30d' | '60d'>('30d');

  const expiryDate = useMemo(() => {
    if (expiryOption === 'none') return undefined;
    const now = new Date();
    const days =
      expiryOption === '7d'
        ? 7
        : expiryOption === '15d'
        ? 15
        : expiryOption === '30d'
        ? 30
        : 60;
    const exp = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    return exp.toISOString().split('T')[0];
  }, [expiryOption]);

  const handleSuggestCode = () => {
    const random = CODE_SUGGESTIONS[Math.floor(Math.random() * CODE_SUGGESTIONS.length)];
    setCode(random);
  };

  // Create Mutation
  const createMutation = useMutation({
    mutationFn: (payload: CreateCouponDto) => api.post<Coupon>('/coupons', payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['coupons-list'] });
      queryClient.invalidateQueries({ queryKey: ['coupons-quota'] });
      Alert.alert('Sucesso!', `O cupom "${data.code}" está ativo e pronto para uso!`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: (err: any) => {
      Alert.alert('Atenção', err.message || 'Não foi possível cadastrar o cupom.');
    },
  });

  const handleSubmit = () => {
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) {
      Alert.alert('Campo Obrigatório', 'Informe o código do cupom (ex: DOCE10).');
      return;
    }

    const discountValue =
      discountType === 'percentage'
        ? Math.min(100, Math.max(1, parseFloat(percentValue) || 10))
        : fixedValueCents;

    if (discountValue <= 0) {
      Alert.alert('Valor Inválido', 'O valor do desconto deve ser maior que zero.');
      return;
    }

    const payload: CreateCouponDto = {
      code: cleanCode,
      description: description.trim() || undefined,
      discountType,
      discountValue,
      minOrderAmountCents: minOrderCents > 0 ? minOrderCents : 0,
      maxDiscountAmountCents:
        discountType === 'percentage' && maxDiscountCents > 0
          ? maxDiscountCents
          : undefined,
      usageLimit: hasTotalLimit ? parseInt(totalLimit, 10) || undefined : undefined,
      usageLimitPerCustomer: hasCustomerLimit
        ? parseInt(customerLimit, 10) || undefined
        : undefined,
      startDate: new Date().toISOString().split('T')[0],
      expiresAt: expiryDate,
      isActive: true,
    };

    createMutation.mutate(payload);
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
            <Text style={styles.headerTitle}>Novo Cupom</Text>
            <Text style={styles.headerSubtitle}>Criar código promocional</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 20) + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Card 1: Code & Name */}
        <Card style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>1. Código Promocional</Text>
            <TouchableOpacity
              style={styles.suggestBtn}
              onPress={handleSuggestCode}
              activeOpacity={0.7}
            >
              <Shuffle size={13} color={colors.primary} style={{ marginRight: 4 }} />
              <Text style={styles.suggestBtnText}>Sugerir Código</Text>
            </TouchableOpacity>
          </View>

          <Input
            label="Código do Cupom *"
            placeholder="Ex: DOCE10, BEMVINDO, PASCOA15"
            value={code}
            onChangeText={(txt) => setCode(txt.toUpperCase().replace(/\s/g, ''))}
            autoCapitalize="characters"
          />

          {/* Quick Code Chips */}
          <View style={styles.chipsRow}>
            {CODE_SUGGESTIONS.slice(0, 4).map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.quickCodeChip, code === s && styles.quickCodeChipActive]}
                onPress={() => setCode(s)}
              >
                <Text
                  style={[
                    styles.quickCodeChipText,
                    code === s && styles.quickCodeChipTextActive,
                  ]}
                >
                  {s}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ marginTop: spacing.sm }}>
            <Input
              label="Descrição / Campanha (Opcional)"
              placeholder="Ex: 10% de desconto na primeira encomenda"
              value={description}
              onChangeText={setDescription}
            />
          </View>
        </Card>

        {/* Card 2: Discount Type & Value */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>2. Tipo e Valor do Desconto</Text>

          {/* Type Switcher Tabs */}
          <View style={styles.typeSwitcher}>
            <TouchableOpacity
              style={[
                styles.typeTab,
                discountType === 'percentage' && styles.typeTabActive,
              ]}
              onPress={() => setDiscountType('percentage')}
            >
              <Percent
                size={16}
                color={discountType === 'percentage' ? colors.textInverse : colors.primary}
              />
              <Text
                style={[
                  styles.typeTabText,
                  discountType === 'percentage' && styles.typeTabTextActive,
                ]}
              >
                Porcentagem (%)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.typeTab,
                discountType === 'fixed' && styles.typeTabActive,
              ]}
              onPress={() => setDiscountType('fixed')}
            >
              <DollarSign
                size={16}
                color={discountType === 'fixed' ? colors.textInverse : colors.primary}
              />
              <Text
                style={[
                  styles.typeTabText,
                  discountType === 'fixed' && styles.typeTabTextActive,
                ]}
              >
                Valor Fixo (€)
              </Text>
            </TouchableOpacity>
          </View>

          {discountType === 'percentage' ? (
            <View>
              <Input
                label="Percentual de Desconto (%) *"
                placeholder="Ex: 10"
                keyboardType="numeric"
                value={percentValue}
                onChangeText={setPercentValue}
              />

              {/* Percentage Presets */}
              <View style={styles.chipsRow}>
                {['5', '10', '15', '20', '25', '30'].map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[
                      styles.quickCodeChip,
                      percentValue === p && styles.quickCodeChipActive,
                    ]}
                    onPress={() => setPercentValue(p)}
                  >
                    <Text
                      style={[
                        styles.quickCodeChipText,
                        percentValue === p && styles.quickCodeChipTextActive,
                      ]}
                    >
                      {p}%
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={{ marginTop: spacing.md }}>
                <CurrencyInput
                  label="Teto Máximo de Desconto (Opcional)"
                  cents={maxDiscountCents}
                  onChangeCents={setMaxDiscountCents}
                  currency={currency}
                />
                <Text style={styles.helperText}>
                  {maxDiscountCents > 0
                    ? `O desconto nunca passará de ${formatCurrency(maxDiscountCents, currency)} por pedido.`
                    : 'Sem teto máximo: o percentual será aplicado integralmente.'}
                </Text>
              </View>
            </View>
          ) : (
            <View>
              <CurrencyInput
                label="Valor do Desconto em Moeda *"
                cents={fixedValueCents}
                onChangeCents={setFixedValueCents}
                currency={currency}
              />
              <Text style={styles.helperText}>
                O valor será subtraído diretamente do total do pedido.
              </Text>
            </View>
          )}

          {/* Min Order */}
          <View style={{ marginTop: spacing.md }}>
            <CurrencyInput
              label="Valor Mínimo do Pedido (Opcional)"
              cents={minOrderCents}
              onChangeCents={setMinOrderCents}
              currency={currency}
            />
            <Text style={styles.helperText}>
              {minOrderCents > 0
                ? `Válido apenas para compras a partir de ${formatCurrency(minOrderCents, currency)}.`
                : 'Sem valor mínimo: válido para pedidos de qualquer valor.'}
            </Text>
          </View>
        </Card>

        {/* Card 3: Limits & Validity */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>3. Validade e Limites de Uso</Text>

          {/* Validity Shortcuts */}
          <Text style={styles.subLabel}>Prazo de Validade:</Text>
          <View style={styles.chipsRow}>
            {[
              { id: '7d', label: '7 dias' },
              { id: '15d', label: '15 dias' },
              { id: '30d', label: '30 dias' },
              { id: '60d', label: '60 dias' },
              { id: 'none', label: 'Sem expiração' },
            ].map((opt) => (
              <TouchableOpacity
                key={opt.id}
                style={[
                  styles.quickCodeChip,
                  expiryOption === opt.id && styles.quickCodeChipActive,
                ]}
                onPress={() => setExpiryOption(opt.id as any)}
              >
                <Text
                  style={[
                    styles.quickCodeChipText,
                    expiryOption === opt.id && styles.quickCodeChipTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {expiryDate && (
            <Text style={styles.helperText}>
              Expira automaticamente em{' '}
              <Text style={{ fontWeight: 'bold' }}>
                {expiryDate.split('-').reverse().join('/')}
              </Text>
              .
            </Text>
          )}

          {/* Total Usage Limit */}
          <View style={styles.limitToggleRow}>
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setHasTotalLimit(!hasTotalLimit)}
            >
              <View style={[styles.checkbox, hasTotalLimit && styles.checkboxChecked]}>
                {hasTotalLimit && <Check size={13} color="#ffffff" />}
              </View>
              <Text style={styles.checkboxLabel}>Limitar total de utilizações</Text>
            </TouchableOpacity>

            {hasTotalLimit && (
              <View style={{ width: 100 }}>
                <Input
                  keyboardType="numeric"
                  placeholder="Ex: 50"
                  value={totalLimit}
                  onChangeText={setTotalLimit}
                />
              </View>
            )}
          </View>

          {/* Per Customer Limit */}
          <View style={[styles.limitToggleRow, { marginTop: spacing.sm }]}>
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setHasCustomerLimit(!hasCustomerLimit)}
            >
              <View style={[styles.checkbox, hasCustomerLimit && styles.checkboxChecked]}>
                {hasCustomerLimit && <Check size={13} color="#ffffff" />}
              </View>
              <Text style={styles.checkboxLabel}>1 uso por cliente</Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Live Preview Ticket */}
        {code.trim().length > 0 && (
          <View style={styles.previewSection}>
            <Text style={styles.previewSectionTitle}>Pré-visualização do Cupom:</Text>
            <Card style={styles.previewCard}>
              <View style={styles.previewHeader}>
                <View style={styles.previewCodeBadge}>
                  <Ticket size={14} color={colors.primary} style={{ marginRight: 4 }} />
                  <Text style={styles.previewCodeText}>{code.trim().toUpperCase()}</Text>
                </View>
                <Badge color={colors.success} label="ATIVO" />
              </View>

              <Text style={styles.previewDiscountBig}>
                {discountType === 'percentage'
                  ? `${percentValue}% DE DESCONTO`
                  : `${formatCurrency(fixedValueCents, currency)} DE DESCONTO`}
              </Text>

              {description ? (
                <Text style={styles.previewDesc}>{description}</Text>
              ) : null}

              <View style={styles.previewFooterRow}>
                {minOrderCents > 0 && (
                  <Text style={styles.previewRuleText}>
                    • Mínimo: {formatCurrency(minOrderCents, currency)}
                  </Text>
                )}
                {expiryDate ? (
                  <Text style={styles.previewRuleText}>
                    • Válido até {expiryDate.split('-').reverse().join('/')}
                  </Text>
                ) : (
                  <Text style={styles.previewRuleText}>• Sem expiração</Text>
                )}
              </View>
            </Card>
          </View>
        )}

        {/* Submit Button */}
        <Button
          title="Criar Cupom Promocional"
          loading={createMutation.isPending}
          onPress={handleSubmit}
          style={styles.submitBtn}
        />
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
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
  },
  card: {
    padding: spacing.md,
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  cardTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
    marginBottom: spacing.sm,
  },
  suggestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5ece0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  suggestBtnText: {
    fontSize: 11,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: 6,
  },
  quickCodeChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.sm,
    backgroundColor: '#faf6f0',
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickCodeChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  quickCodeChipText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
  },
  quickCodeChipTextActive: {
    color: colors.textInverse,
  },
  typeSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#f0e6d9',
    borderRadius: borderRadius.md,
    padding: 3,
    marginBottom: spacing.md,
  },
  typeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: borderRadius.md - 2,
    gap: 6,
  },
  typeTabActive: {
    backgroundColor: colors.primary,
  },
  typeTabText: {
    fontSize: 12,
    fontWeight: typography.weights.semibold,
    color: colors.primary,
  },
  typeTabTextActive: {
    color: colors.textInverse,
  },
  helperText: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginTop: 4,
    fontStyle: 'italic',
  },
  subLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  limitToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxLabel: {
    fontSize: typography.sizes.sm,
    color: colors.text,
  },
  previewSection: {
    marginBottom: spacing.md,
  },
  previewSectionTitle: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  previewCard: {
    backgroundColor: '#fffdf9',
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.caramel,
    padding: spacing.md,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  previewCodeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5ece0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  previewCodeText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
    letterSpacing: 1,
  },
  previewDiscountBig: {
    fontSize: typography.sizes.md,
    fontWeight: '900',
    color: colors.primary,
    marginVertical: 4,
  },
  previewDesc: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  previewFooterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  previewRuleText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  submitBtn: {
    marginTop: spacing.sm,
  },
});
