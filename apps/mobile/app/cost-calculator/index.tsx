import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Share,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Calculator,
  Percent,
  Sparkles,
  BookOpen,
  Package,
  Clock,
  Flame,
  AlertCircle,
  Share2,
  TrendingUp,
  DollarSign,
  ChevronRight,
  PlusCircle,
  Layers,
} from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '../../src/theme';
import { Card, Button, Input, CurrencyInput, Badge, ProgressBar } from '../../src/components/ui';
import { api } from '../../src/services/api';
import { useAuthStore } from '../../src/stores/auth.store';
import { formatCurrency } from '../../src/utils/formatters';
import { Recipe, Product, CostCalculationResult, PricingMethod } from '@koki/types';

export default function CostCalculatorScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { company } = useAuthStore();
  const currency = company?.currency || 'EUR';

  // State
  const [productName, setProductName] = useState('');
  const [yieldUnits, setYieldUnits] = useState('1');
  const [yieldUnitName, setYieldUnitName] = useState('unidade');

  // Pillar 1: Ingredients
  const [ingredientsCostCents, setIngredientsCostCents] = useState(1250); // 12,50 €

  // Pillar 2: Packaging
  const [packagingCostCents, setPackagingCostCents] = useState(180); // 1,80 €

  // Pillar 3: Labor
  const [laborMode, setLaborMode] = useState<'fixed' | 'hourly'>('fixed');
  const [laborFixedCents, setLaborFixedCents] = useState(500); // 5,00 €
  const [monthlySalaryDesiredCents, setMonthlySalaryDesiredCents] = useState(150000); // 1.500,00 €
  const [monthlyHoursWorked, setMonthlyHoursWorked] = useState('160'); // 160h
  const [productionTimeMinutes, setProductionTimeMinutes] = useState('60'); // 1 hora

  // Pillar 4: Overhead / Fixed operational costs
  const [overheadMode, setOverheadMode] = useState<'percent' | 'fixed'>('percent');
  const [overheadPercent, setOverheadPercent] = useState('15'); // 15% sobre insumos
  const [overheadFixedCents, setOverheadFixedCents] = useState(200); // 2,00 €

  // Pillar 5: Waste / Technical loss
  const [wastePercent, setWastePercent] = useState(5); // 5%

  // Pricing Strategy
  const [pricingMethod, setPricingMethod] = useState<PricingMethod>('margin');
  const [targetMarginPercent, setTargetMarginPercent] = useState('45'); // 45%
  const [targetMarkupPercent, setTargetMarkupPercent] = useState('100'); // 100% (2x)
  const [customPriceCents, setCustomPriceCents] = useState(3500); // 35,00 €

  // Query Recipes & Products for fast import
  const { data: recipes = [] } = useQuery<Recipe[]>({
    queryKey: ['recipes-list'],
    queryFn: () => api.get<Recipe[]>('/recipes'),
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['products-list'],
    queryFn: () => api.get<Product[]>('/products'),
  });

  // Calculate hourly rate and computed labor cents
  const hourlyRateCents = useMemo(() => {
    const hours = parseFloat(monthlyHoursWorked) || 160;
    return Math.round(monthlySalaryDesiredCents / Math.max(1, hours));
  }, [monthlySalaryDesiredCents, monthlyHoursWorked]);

  const computedLaborCents = useMemo(() => {
    if (laborMode === 'fixed') {
      return laborFixedCents;
    }
    const minutes = parseFloat(productionTimeMinutes) || 60;
    const hours = minutes / 60;
    return Math.round(hours * hourlyRateCents);
  }, [laborMode, laborFixedCents, productionTimeMinutes, hourlyRateCents]);

  // Compute overhead cents
  const computedOverheadCents = useMemo(() => {
    if (overheadMode === 'fixed') {
      return overheadFixedCents;
    }
    const pct = parseFloat(overheadPercent) || 0;
    return Math.round(ingredientsCostCents * (pct / 100));
  }, [overheadMode, overheadFixedCents, overheadPercent, ingredientsCostCents]);

  // Calculate pricing mutation / API call
  const { data: result, mutate: calculatePricing } = useMutation({
    mutationFn: (payload: any) => api.post<CostCalculationResult>('/tools/cost-calculator', payload),
  });

  // Trigger calculation on input change
  useEffect(() => {
    const units = parseInt(yieldUnits, 10) || 1;
    const targetPercent =
      pricingMethod === 'margin'
        ? parseFloat(targetMarginPercent) || 40
        : parseFloat(targetMarkupPercent) || 100;

    calculatePricing({
      productName: productName.trim() || undefined,
      ingredientsCostCents,
      packagingCostCents,
      laborCostCents: computedLaborCents,
      overheadCostCents: computedOverheadCents,
      wastePercentage: wastePercent,
      method: pricingMethod,
      targetPercentage: targetPercent,
      customPriceCents,
      yieldUnits: units,
      yieldUnitName,
    });
  }, [
    productName,
    ingredientsCostCents,
    packagingCostCents,
    computedLaborCents,
    computedOverheadCents,
    wastePercent,
    pricingMethod,
    targetMarginPercent,
    targetMarkupPercent,
    customPriceCents,
    yieldUnits,
    yieldUnitName,
  ]);

  const handleImportRecipe = (recipe: Recipe) => {
    setProductName(recipe.name);
    setIngredientsCostCents(recipe.ingredientsCostCents || 0);
    setPackagingCostCents(recipe.packagingCostCents || 0);
    setLaborFixedCents(recipe.laborCostCents || 0);
    setLaborMode('fixed');
    setOverheadFixedCents(recipe.overheadCostCents || 0);
    setOverheadMode('fixed');
    setYieldUnits(String(recipe.yield || 1));
    setYieldUnitName(recipe.yieldUnit || 'fatias');
    Alert.alert('Ficha Importada', `Custos de "${recipe.name}" carregados com sucesso!`);
  };

  const handleImportProduct = (prod: Product) => {
    setProductName(prod.name);
    setIngredientsCostCents(prod.costCents || 0);
    setCustomPriceCents(prod.priceCents || 0);
    setYieldUnits('1');
    setYieldUnitName(prod.unit || 'unidade');
    Alert.alert('Produto Importado', `Custos de "${prod.name}" carregados!`);
  };

  const handleShareSummary = async () => {
    if (!result) return;
    try {
      const title = productName.trim() || 'Ficha de Precificação';
      const msg = `🍰 *KOKI — FORMAÇÃO DE PREÇO & CUSTOS*\n\n` +
        `*Produto:* ${title}\n` +
        `*Rendimento:* ${result.yieldUnits} ${result.yieldUnitName}\n\n` +
        `📦 *COMPOSIÇÃO DE CUSTOS:*\n` +
        `• Insumos/Ingredientes: ${formatCurrency(result.ingredientsCostCents, currency)}\n` +
        `• Embalagem: ${formatCurrency(result.packagingCostCents, currency)}\n` +
        `• Mão de Obra: ${formatCurrency(result.laborCostCents, currency)}\n` +
        `• Custos Operacionais: ${formatCurrency(result.overheadCostCents, currency)}\n` +
        `• Margem de Perda (${wastePercent}%): ${formatCurrency(result.wasteCents, currency)}\n` +
        `--------------------------\n` +
        `*CUSTO TOTAL:* ${formatCurrency(result.totalCostCents, currency)} (${formatCurrency(result.costPerUnitCents, currency)} / ${result.yieldUnitName})\n\n` +
        `💰 *PREÇO & LUCRATIVIDADE:*\n` +
        `• *Preço Sugerido:* ${formatCurrency(result.suggestedPriceCents, currency)} (${formatCurrency(result.pricePerUnitCents, currency)} / ${result.yieldUnitName})\n` +
        `• *Lucro no Bolso:* ${formatCurrency(result.profitCents, currency)} (${formatCurrency(result.profitPerUnitCents, currency)} / ${result.yieldUnitName})\n` +
        `• *Margem Real:* +${result.effectiveMarginPercent}%\n` +
        `• *Markup:* +${result.effectiveMarkupPercent}%\n\n` +
        `_Calculado com precisão gastronômica no app Koki._`;

      await Share.share({
        message: msg,
        title: `Precificação - ${title}`,
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleApplyToCatalog = () => {
    if (!result) return;
    router.push({
      pathname: '/products/new' as any,
      params: {
        prefillName: productName.trim() || '',
        prefillPriceCents: String(result.suggestedPriceCents),
        prefillCostCents: String(result.totalCostCents),
        prefillUnit: yieldUnitName,
      },
    });
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
            <Text style={styles.headerTitle}>Calculadora de Custos</Text>
            <Text style={styles.headerSubtitle}>Formação de preço e margem de lucro</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.shareHeaderBtn}
          onPress={handleShareSummary}
          activeOpacity={0.7}
        >
          <Share2 size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 20) + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Quick Import Bar from Recipes */}
        {recipes.length > 0 && (
          <View style={styles.importSection}>
            <Text style={styles.importLabel}>Importar de Ficha Técnica / Receita:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
              {recipes.slice(0, 8).map((r) => (
                <TouchableOpacity
                  key={r.id}
                  style={styles.importChip}
                  onPress={() => handleImportRecipe(r)}
                  activeOpacity={0.7}
                >
                  <BookOpen size={13} color={colors.primary} style={{ marginRight: 5 }} />
                  <Text style={styles.importChipText}>{r.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Product & Yield Card */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>1. Identificação do Produto & Rendimento</Text>

          <Input
            label="Nome do Produto / Doce"
            placeholder="Ex: Bolo de Brigadeiro Belga (Forma 20cm)"
            value={productName}
            onChangeText={setProductName}
          />

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Input
                label="Rendimento Total"
                placeholder="Ex: 12"
                keyboardType="numeric"
                value={yieldUnits}
                onChangeText={setYieldUnits}
              />
            </View>

            <View style={{ flex: 1 }}>
              <Input
                label="Unidade de Medida"
                placeholder="Ex: fatias, unidades"
                value={yieldUnitName}
                onChangeText={setYieldUnitName}
              />
            </View>
          </View>

          {/* Quick Yield Chips */}
          <View style={styles.yieldChipsRow}>
            {['unidade', 'fatia', 'cento', 'kg', 'pote'].map((u) => (
              <TouchableOpacity
                key={u}
                style={[styles.yieldChip, yieldUnitName === u && styles.yieldChipActive]}
                onPress={() => setYieldUnitName(u)}
              >
                <Text style={[styles.yieldChipText, yieldUnitName === u && styles.yieldChipTextActive]}>
                  {u}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* Pillars 1 & 2: Direct Costs (Ingredients & Packaging) */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>2. Custos Diretos de Produção</Text>

          <CurrencyInput
            label="Custo dos Ingredientes (Matérias-Primas) *"
            cents={ingredientsCostCents}
            onChangeCents={setIngredientsCostCents}
            currency={currency}
          />
          <Text style={styles.helperText}>
            Soma dos insumos usados (farinhas, manteigas, chocolates, recheios).
          </Text>

          <View style={{ marginTop: spacing.sm }}>
            <CurrencyInput
              label="Embalagens & Apresentação"
              cents={packagingCostCents}
              onChangeCents={setPackagingCostCents}
              currency={currency}
            />
            <Text style={styles.helperText}>
              Caixa para bolo, tabuleiro (cake board), fita, tag e sacola.
            </Text>
          </View>
        </Card>

        {/* Pillar 3: Labor (Mão de Obra) */}
        <Card style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>3. Mão de Obra do Confeiteiro</Text>
            <View style={styles.miniToggle}>
              <TouchableOpacity
                style={[styles.toggleBtn, laborMode === 'fixed' && styles.toggleBtnActive]}
                onPress={() => setLaborMode('fixed')}
              >
                <Text style={[styles.toggleBtnText, laborMode === 'fixed' && styles.toggleBtnTextActive]}>
                  Fixo
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, laborMode === 'hourly' && styles.toggleBtnActive]}
                onPress={() => setLaborMode('hourly')}
              >
                <Text style={[styles.toggleBtnText, laborMode === 'hourly' && styles.toggleBtnTextActive]}>
                  Por Hora
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {laborMode === 'fixed' ? (
            <CurrencyInput
              label="Valor da Mão de Obra para esta Receita"
              cents={laborFixedCents}
              onChangeCents={setLaborFixedCents}
              currency={currency}
            />
          ) : (
            <View style={styles.hourlyContainer}>
              <CurrencyInput
                label="Salário Mensal Pretendido"
                cents={monthlySalaryDesiredCents}
                onChangeCents={setMonthlySalaryDesiredCents}
                currency={currency}
              />

              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Input
                    label="Horas de Trabalho / Mês"
                    placeholder="Ex: 160"
                    keyboardType="numeric"
                    value={monthlyHoursWorked}
                    onChangeText={setMonthlyHoursWorked}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Input
                    label="Tempo de Preparo (min)"
                    placeholder="Ex: 90"
                    keyboardType="numeric"
                    value={productionTimeMinutes}
                    onChangeText={setProductionTimeMinutes}
                  />
                </View>
              </View>

              <View style={styles.hourlyResultBanner}>
                <Clock size={16} color={colors.primary} style={{ marginRight: 6 }} />
                <Text style={styles.hourlyResultText}>
                  Sua hora vale: <Text style={{ fontWeight: 'bold' }}>{formatCurrency(hourlyRateCents, currency)}/h</Text>
                  {'  '}•{'  '}
                  Custo deste doce: <Text style={{ fontWeight: 'bold', color: colors.primary }}>{formatCurrency(computedLaborCents, currency)}</Text>
                </Text>
              </View>
            </View>
          )}
        </Card>

        {/* Pillars 4 & 5: Overhead & Waste */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>4. Custos Fixos & Desperdício Técnico</Text>

          {/* Overhead */}
          <View style={styles.cardHeaderRow}>
            <Text style={styles.subCardTitle}>Custos Operacionais (Energia, Gás, Água)</Text>
            <View style={styles.miniToggle}>
              <TouchableOpacity
                style={[styles.toggleBtn, overheadMode === 'percent' && styles.toggleBtnActive]}
                onPress={() => setOverheadMode('percent')}
              >
                <Text style={[styles.toggleBtnText, overheadMode === 'percent' && styles.toggleBtnTextActive]}>
                  % Insumos
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, overheadMode === 'fixed' && styles.toggleBtnActive]}
                onPress={() => setOverheadMode('fixed')}
              >
                <Text style={[styles.toggleBtnText, overheadMode === 'fixed' && styles.toggleBtnTextActive]}>
                  Valor Fixo
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {overheadMode === 'percent' ? (
            <View>
              <Input
                label="Percentual de Custos Operacionais (%)"
                placeholder="Ex: 15"
                keyboardType="numeric"
                value={overheadPercent}
                onChangeText={setOverheadPercent}
              />
              <Text style={styles.helperText}>
                {overheadPercent}% sobre os ingredientes = <Text style={{ fontWeight: 'bold' }}>{formatCurrency(computedOverheadCents, currency)}</Text>
              </Text>
            </View>
          ) : (
            <CurrencyInput
              label="Valor Fixo de Custos Operacionais"
              cents={overheadFixedCents}
              onChangeCents={setOverheadFixedCents}
              currency={currency}
            />
          )}

          {/* Waste / Perda */}
          <View style={{ marginTop: spacing.md }}>
            <Text style={styles.subCardTitle}>Margem de Perda / Desperdício (%)</Text>
            <View style={styles.wasteChipsRow}>
              {[0, 5, 10, 15].map((w) => (
                <TouchableOpacity
                  key={w}
                  style={[styles.wasteChip, wastePercent === w && styles.wasteChipActive]}
                  onPress={() => setWastePercent(w)}
                >
                  <Text style={[styles.wasteChipText, wastePercent === w && styles.wasteChipTextActive]}>
                    +{w}%
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.helperText}>
              Protege contra sobras de caldas, rebarbas de bolo e perdas no manuseio.
            </Text>
          </View>
        </Card>

        {/* Pricing Strategy Selector */}
        <Card style={styles.strategyCard}>
          <Text style={styles.strategyTitle}>5. Estratégia de Precificação</Text>

          {/* Strategy Tabs */}
          <View style={styles.strategyTabs}>
            <TouchableOpacity
              style={[styles.strategyTab, pricingMethod === 'margin' && styles.strategyTabActive]}
              onPress={() => setPricingMethod('margin')}
            >
              <Percent size={15} color={pricingMethod === 'margin' ? colors.textInverse : colors.primary} />
              <Text style={[styles.strategyTabText, pricingMethod === 'margin' && styles.strategyTabTextActive]}>
                Margem (% Venda)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.strategyTab, pricingMethod === 'markup' && styles.strategyTabActive]}
              onPress={() => setPricingMethod('markup')}
            >
              <TrendingUp size={15} color={pricingMethod === 'markup' ? colors.textInverse : colors.primary} />
              <Text style={[styles.strategyTabText, pricingMethod === 'markup' && styles.strategyTabTextActive]}>
                Markup (% Custo)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.strategyTab, pricingMethod === 'target_price' && styles.strategyTabActive]}
              onPress={() => setPricingMethod('target_price')}
            >
              <DollarSign size={15} color={pricingMethod === 'target_price' ? colors.textInverse : colors.primary} />
              <Text style={[styles.strategyTabText, pricingMethod === 'target_price' && styles.strategyTabTextActive]}>
                Preço Alvo
              </Text>
            </TouchableOpacity>
          </View>

          {/* Strategy Inputs */}
          {pricingMethod === 'margin' && (
            <View style={styles.strategyBody}>
              <Input
                label="Margem de Lucro Desejada (%)"
                placeholder="Ex: 40"
                keyboardType="numeric"
                value={targetMarginPercent}
                onChangeText={setTargetMarginPercent}
              />
              <View style={styles.quickPresetRow}>
                {['30', '40', '50', '60', '70'].map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[styles.presetChip, targetMarginPercent === p && styles.presetChipActive]}
                    onPress={() => setTargetMarginPercent(p)}
                  >
                    <Text style={[styles.presetChipText, targetMarginPercent === p && styles.presetChipTextActive]}>
                      {p}%
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {pricingMethod === 'markup' && (
            <View style={styles.strategyBody}>
              <Input
                label="Markup sobre o Custo (%)"
                placeholder="Ex: 100"
                keyboardType="numeric"
                value={targetMarkupPercent}
                onChangeText={setTargetMarkupPercent}
              />
              <View style={styles.quickPresetRow}>
                {[
                  { label: '50% (1.5x)', val: '50' },
                  { label: '100% (2x)', val: '100' },
                  { label: '150% (2.5x)', val: '150' },
                  { label: '200% (3x)', val: '200' },
                ].map((p) => (
                  <TouchableOpacity
                    key={p.val}
                    style={[styles.presetChip, targetMarkupPercent === p.val && styles.presetChipActive]}
                    onPress={() => setTargetMarkupPercent(p.val)}
                  >
                    <Text style={[styles.presetChipText, targetMarkupPercent === p.val && styles.presetChipTextActive]}>
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {pricingMethod === 'target_price' && (
            <View style={styles.strategyBody}>
              <CurrencyInput
                label="Quanto você deseja cobrar por este produto?"
                cents={customPriceCents}
                onChangeCents={setCustomPriceCents}
                currency={currency}
              />
              <Text style={styles.helperText}>
                Descubra automaticamente a margem de lucro real que sobrará para você.
              </Text>
            </View>
          )}
        </Card>

        {/* Live Result Master Banner */}
        {result && (
          <Card style={styles.resultMasterCard}>
            <View style={styles.resultHeader}>
              <Sparkles size={20} color={colors.primary} style={{ marginRight: 6 }} />
              <Text style={styles.resultMasterTitle}>Resultado da Precificação</Text>
            </View>

            {/* Suggested Sale Price Hero */}
            <View style={styles.heroPriceBox}>
              <Text style={styles.heroPriceLabel}>Preço de Venda Sugerido</Text>
              <Text style={styles.heroPriceValue}>
                {formatCurrency(result.suggestedPriceCents, currency)}
              </Text>
              {result.yieldUnits > 1 && (
                <Text style={styles.heroUnitSubtext}>
                  {formatCurrency(result.pricePerUnitCents, currency)} por {result.yieldUnitName}
                </Text>
              )}
            </View>

            {/* Metrics Row: Cost & Profit */}
            <View style={styles.metricsCompareRow}>
              <View style={styles.compareItem}>
                <Text style={styles.compareLabel}>Custo Total</Text>
                <Text style={styles.compareCostValue}>
                  {formatCurrency(result.totalCostCents, currency)}
                </Text>
                {result.yieldUnits > 1 && (
                  <Text style={styles.compareUnitValue}>
                    {formatCurrency(result.costPerUnitCents, currency)} / {result.yieldUnitName}
                  </Text>
                )}
              </View>

              <View style={styles.compareDivider} />

              <View style={styles.compareItem}>
                <Text style={styles.compareLabel}>Lucro no Bolso</Text>
                <Text style={styles.compareProfitValue}>
                  +{formatCurrency(result.profitCents, currency)}
                </Text>
                <Badge
                  color={result.effectiveMarginPercent >= 30 ? colors.success : colors.warning}
                  label={`${result.effectiveMarginPercent}% de margem`}
                  style={{ marginTop: 4 }}
                />
              </View>
            </View>

            {/* Visual Distribution Bar */}
            <View style={styles.distributionSection}>
              <Text style={styles.distributionTitle}>Distribuição do Preço Final</Text>
              <View style={styles.multiProgressBar}>
                <View style={[styles.barSegment, { flex: result.percentages.ingredients || 1, backgroundColor: colors.caramel }]} />
                <View style={[styles.barSegment, { flex: result.percentages.packaging || 1, backgroundColor: colors.goldenBeige }]} />
                <View style={[styles.barSegment, { flex: result.percentages.labor || 1, backgroundColor: colors.primary }]} />
                <View style={[styles.barSegment, { flex: result.percentages.overhead || 1, backgroundColor: colors.warning }]} />
                <View style={[styles.barSegment, { flex: result.percentages.profit || 1, backgroundColor: colors.success }]} />
              </View>

              {/* Legend */}
              <View style={styles.legendGrid}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.caramel }]} />
                  <Text style={styles.legendText}>Insumos ({formatCurrency(result.ingredientsCostCents, currency)})</Text>
                </View>

                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.goldenBeige }]} />
                  <Text style={styles.legendText}>Embalagem ({formatCurrency(result.packagingCostCents, currency)})</Text>
                </View>

                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
                  <Text style={styles.legendText}>Mão de Obra ({formatCurrency(result.laborCostCents, currency)})</Text>
                </View>

                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.warning }]} />
                  <Text style={styles.legendText}>Operacional ({formatCurrency(result.overheadCostCents, currency)})</Text>
                </View>

                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
                  <Text style={[styles.legendText, { fontWeight: 'bold' }]}>Lucro Líquido ({formatCurrency(result.profitCents, currency)})</Text>
                </View>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionButtonsRow}>
              <Button
                title="Cadastrar no Catálogo"
                icon={<PlusCircle size={18} color="#fff" />}
                onPress={handleApplyToCatalog}
                style={{ flex: 1, marginRight: 8 }}
              />

              <Button
                title="WhatsApp"
                variant="outline"
                icon={<Share2 size={16} color={colors.primary} />}
                onPress={handleShareSummary}
                style={{ width: 120 }}
              />
            </View>
          </Card>
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
  shareHeaderBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: 50,
  },
  importSection: {
    marginBottom: spacing.md,
  },
  importLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  chipScroll: {
    flexDirection: 'row',
  },
  importChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: borderRadius.full,
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.xs,
  },
  importChipText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.primary,
  },
  card: {
    padding: spacing.md,
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
    marginBottom: spacing.md,
  },
  subCardTitle: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
  },
  helperText: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginTop: -8,
    marginBottom: spacing.sm,
    fontStyle: 'italic',
  },
  yieldChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  yieldChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.sm,
    backgroundColor: '#faf6f0',
    borderWidth: 1,
    borderColor: colors.border,
  },
  yieldChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  yieldChipText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  yieldChipTextActive: {
    color: colors.textInverse,
    fontWeight: typography.weights.bold,
  },
  miniToggle: {
    flexDirection: 'row',
    backgroundColor: '#f0e6d9',
    borderRadius: borderRadius.sm,
    padding: 2,
  },
  toggleBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.sm - 2,
  },
  toggleBtnActive: {
    backgroundColor: colors.primary,
  },
  toggleBtnText: {
    fontSize: 11,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
  },
  toggleBtnTextActive: {
    color: colors.textInverse,
  },
  hourlyContainer: {
    marginTop: spacing.xs,
  },
  hourlyResultBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#faf3e8',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    marginTop: spacing.xs,
  },
  hourlyResultText: {
    fontSize: typography.sizes.xs,
    color: colors.text,
    flex: 1,
  },
  wasteChipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 6,
  },
  wasteChip: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: borderRadius.md,
    backgroundColor: '#faf6f0',
    borderWidth: 1,
    borderColor: colors.border,
  },
  wasteChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  wasteChipText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.textSecondary,
  },
  wasteChipTextActive: {
    color: colors.textInverse,
  },
  strategyCard: {
    padding: spacing.md,
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  strategyTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
    marginBottom: spacing.sm,
  },
  strategyTabs: {
    flexDirection: 'row',
    backgroundColor: '#f0e6d9',
    borderRadius: borderRadius.md,
    padding: 3,
    marginBottom: spacing.md,
  },
  strategyTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: borderRadius.md - 2,
  },
  strategyTabActive: {
    backgroundColor: colors.primary,
  },
  strategyTabText: {
    fontSize: 11,
    fontWeight: typography.weights.semibold,
    color: colors.primary,
    marginLeft: 4,
  },
  strategyTabTextActive: {
    color: colors.textInverse,
  },
  strategyBody: {
    marginTop: spacing.xs,
  },
  quickPresetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  presetChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
    backgroundColor: '#faf6f0',
    borderWidth: 1,
    borderColor: colors.border,
  },
  presetChipActive: {
    backgroundColor: colors.caramel,
    borderColor: colors.caramel,
  },
  presetChipText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
  },
  presetChipTextActive: {
    color: colors.textInverse,
  },
  resultMasterCard: {
    padding: spacing.lg,
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.xl,
    borderWidth: 1.5,
    borderColor: colors.caramel,
    shadowColor: colors.primaryDark,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  resultMasterTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  heroPriceBox: {
    alignItems: 'center',
    backgroundColor: '#fffaf2',
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#f0ddbe',
    marginBottom: spacing.md,
  },
  heroPriceLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  heroPriceValue: {
    fontSize: 32,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: -0.5,
  },
  heroUnitSubtext: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: 4,
    fontWeight: typography.weights.medium,
  },
  metricsCompareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
  },
  compareItem: {
    flex: 1,
    alignItems: 'center',
  },
  compareDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border,
  },
  compareLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginBottom: 2,
  },
  compareCostValue: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  compareProfitValue: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.success,
  },
  compareUnitValue: {
    fontSize: 10,
    color: colors.textMuted,
  },
  distributionSection: {
    marginBottom: spacing.md,
  },
  distributionTitle: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  multiProgressBar: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    backgroundColor: '#eee',
    marginBottom: spacing.sm,
  },
  barSegment: {
    height: '100%',
  },
  legendGrid: {
    gap: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  legendText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    marginTop: spacing.xs,
  },
});
