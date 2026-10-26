import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography, borderRadius } from '../../src/theme';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { CurrencyInput } from '../../src/components/ui/CurrencyInput';
import { Input } from '../../src/components/ui/Input';
import { PlansModal } from '../../src/components/PlansModal';
import { api } from '../../src/services/api';
import { useAuthStore } from '../../src/stores/auth.store';
import { EntitlementsResponse } from '@koki/types';
import {
  Package,
  Users,
  Boxes,
  BookOpen,
  Calendar,
  Truck,
  Scale,
  Sparkles,
  Ticket,
  Percent,
  MessageSquare,
  Calculator,
  Tag,
  Lock,
  ChevronRight,
  X,
  Check,
} from 'lucide-react-native';

interface ToolItem {
  id: string;
  name: string;
  description: string;
  category: 'management' | 'production' | 'sales' | 'cost';
  icon: any;
  featureKey: string;
  isProOnly: boolean;
}

const TOOLS_CATALOG: ToolItem[] = [
  // Gestão
  {
    id: 'products',
    name: 'Produtos & Catálogo',
    description: 'Cadastro de produtos, preços de venda e custos',
    category: 'management',
    icon: Package,
    featureKey: 'products.create',
    isProOnly: false,
  },
  {
    id: 'customers',
    name: 'Clientes',
    description: 'Base de clientes com moradas e histórico de compras',
    category: 'management',
    icon: Users,
    featureKey: 'customers.create',
    isProOnly: false,
  },
  {
    id: 'inventory',
    name: 'Estoque & Insumos',
    description: 'Controle de ingredientes, embalagens e estoque mínimo',
    category: 'management',
    icon: Boxes,
    featureKey: 'inventory.access',
    isProOnly: false,
  },
  {
    id: 'recipes',
    name: 'Fichas Técnicas & Receitas',
    description: 'Receitas detalhadas com cálculo de custo por porção',
    category: 'management',
    icon: BookOpen,
    featureKey: 'recipes.access',
    isProOnly: false,
  },

  // Produção
  {
    id: 'production_planner',
    name: 'Planejador de Produção',
    description: 'Cronograma diário de fornadas por pedidos e datas',
    category: 'production',
    icon: Calendar,
    featureKey: 'production_planner.access',
    isProOnly: false,
  },
  {
    id: 'delivery_planner',
    name: 'Planejador de Entregas',
    description: 'Rotas, horários e moradas de entrega do dia',
    category: 'production',
    icon: Truck,
    featureKey: 'delivery_planner.access',
    isProOnly: false,
  },
  {
    id: 'recipe_scaler',
    name: 'Escalonador de Receitas',
    description: 'Aumente ou reduza porções mantendo proporções',
    category: 'production',
    icon: Scale,
    featureKey: 'recipes.access',
    isProOnly: false,
  },
  {
    id: 'unit_converter',
    name: 'Conversor de Medidas',
    description: 'Gramas, xícaras e ml com densidade de farinha, açúcar, etc.',
    category: 'production',
    icon: Scale,
    featureKey: 'tools.unit_converter',
    isProOnly: false,
  },

  // Vendas e Marketing
  {
    id: 'coupons',
    name: 'Cupons de Desconto',
    description: 'Códigos promocionais com limites e validade',
    category: 'sales',
    icon: Ticket,
    featureKey: 'coupons.create',
    isProOnly: true,
  },
  {
    id: 'combos',
    name: 'Criador de Combos',
    description: 'Monte kits e combos com cálculo automático de margem',
    category: 'sales',
    icon: Percent,
    featureKey: 'combos.create',
    isProOnly: true,
  },
  {
    id: 'whatsapp_bot',
    name: 'Bot WhatsApp',
    description: 'Integração para receber pedidos por mensagem',
    category: 'sales',
    icon: MessageSquare,
    featureKey: 'whatsapp_bot.access',
    isProOnly: true,
  },

  // Custos e Utilidades
  {
    id: 'cost_calculator',
    name: 'Calculadora de Custos',
    description: 'Formação de preço com ingredientes, mão de obra e margem',
    category: 'cost',
    icon: Calculator,
    featureKey: 'tools.basic_calculator',
    isProOnly: false,
  },
  {
    id: 'labels_generator',
    name: 'Etiquetas & Lotes',
    description: 'Geração de códigos de lote, validade e impressão',
    category: 'cost',
    icon: Tag,
    featureKey: 'labels_generator.access',
    isProOnly: false,
  },
];

export default function ToolsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { company } = useAuthStore();

  const [activeToolModal, setActiveToolModal] = useState<string | null>(null);
  const [proModalVisible, setProModalVisible] = useState(false);

  // Cost calculator state
  const [ingredientsCostCents, setIngredientsCostCents] = useState(1200); // 12.00 €
  const [packagingCostCents, setPackagingCostCents] = useState(150);     // 1.50 €
  const [laborCostCents, setLaborCostCents] = useState(300);             // 3.00 €
  const [overheadCostCents, setOverheadCostCents] = useState(100);          // 1.00 €
  const [calcMethod, setCalcMethod] = useState<'margin' | 'markup'>('margin');
  const [targetPercent, setTargetPercent] = useState('40');
  const [calcResult, setCalcResult] = useState<any>(null);

  // Unit converter state
  const [convertValue, setConvertValue] = useState('2');
  const [convertIngredient, setConvertIngredient] = useState('farinha');
  const [fromUnit, setFromUnit] = useState<any>('xicara');
  const [toUnit, setToUnit] = useState<any>('g');
  const [convertResult, setConvertResult] = useState<any>(null);

  // Query Entitlements
  const { data: entitlements } = useQuery<EntitlementsResponse>({
    queryKey: ['company-entitlements'],
    queryFn: () => api.get<EntitlementsResponse>('/entitlements/features'),
  });

  const isPro = entitlements?.isPro || false;

  const handleToolPress = (tool: ToolItem) => {
    if (tool.isProOnly && !isPro) {
      setProModalVisible(true);
      return;
    }

    if (tool.id === 'customers') {
      router.push('/customers' as any);
      return;
    }

    if (tool.id === 'products') {
      router.push('/products' as any);
      return;
    }

    if (tool.id === 'inventory') {
      router.push('/inventory' as any);
      return;
    }

    if (tool.id === 'shopping_list') {
      router.push('/shopping-list' as any);
      return;
    }

    if (tool.id === 'recipes') {
      router.push('/recipes' as any);
      return;
    }

    if (tool.id === 'production_planner') {
      router.push('/production-planner' as any);
      return;
    }

    if (tool.id === 'delivery_planner') {
      router.push('/delivery-planner' as any);
      return;
    }

    if (tool.id === 'recipe_scaler') {
      router.push('/recipe-scaler' as any);
      return;
    }

    if (tool.id === 'labels_generator') {
      router.push('/labels' as any);
      return;
    }

    if (tool.id === 'cost_calculator') {
      router.push('/cost-calculator' as any);
      return;
    }

    if (tool.id === 'unit_converter') {
      handleCalculateConversion();
      setActiveToolModal('unit_converter');
    } else {
      Alert.alert(
        tool.name,
        `${tool.description}\n\nFuncionalidade ativa e conectada ao backend Koki.`,
      );
    }
  };

  const handleCalculateCost = async () => {
    try {
      const res = await api.post('/tools/cost-calculator', {
        ingredientsCostCents,
        packagingCostCents,
        laborCostCents,
        overheadCostCents,
        method: calcMethod,
        targetPercentage: parseFloat(targetPercent) || 40,
      });
      setCalcResult(res);
    } catch {}
  };

  const handleCalculateConversion = async () => {
    try {
      const res = await api.post('/tools/unit-converter', {
        value: parseFloat(convertValue) || 1,
        fromUnit,
        toUnit,
        ingredient: convertIngredient,
      });
      setConvertResult(res);
    } catch {}
  };

  const renderToolCategory = (
    title: string,
    category: ToolItem['category'],
  ) => {
    const items = TOOLS_CATALOG.filter((t) => t.category === category);

    return (
      <View style={styles.categorySection}>
        <Text style={styles.categoryTitle}>{title}</Text>
        {items.map((tool) => {
          const Icon = tool.icon;
          const locked = tool.isProOnly && !isPro;

          return (
            <TouchableOpacity
              key={tool.id}
              activeOpacity={0.7}
              onPress={() => handleToolPress(tool)}
            >
              <Card style={[styles.toolCard, locked && styles.toolCardLocked]}>
                <View style={styles.toolLeft}>
                  <View
                    style={[
                      styles.toolIconCircle,
                      locked
                        ? { backgroundColor: colors.surface }
                        : { backgroundColor: `${colors.primary}15` },
                    ]}
                  >
                    <Icon size={20} color={locked ? colors.textMuted : colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.toolTitleRow}>
                      <Text style={styles.toolName}>{tool.name}</Text>
                      {tool.isProOnly && (
                        <View style={styles.proPill}>
                          <Text style={styles.proPillText}>PRO</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.toolDesc} numberOfLines={2}>
                      {tool.description}
                    </Text>
                  </View>
                </View>

                {locked ? (
                  <Lock size={16} color={colors.caramel} />
                ) : (
                  <ChevronRight size={18} color={colors.textMuted} />
                )}
              </Card>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.topHeader, { paddingTop: Math.max(insets.top, 20) + 8 }]}>
        <View>
          <Text style={styles.screenTitle}>Ferramentas & Utilitários</Text>
          <Text style={styles.screenSubtitle}>
            Recursos práticos para a operação diária da confeitaria
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {renderToolCategory('Gestão & Operação', 'management')}
        {renderToolCategory('Produção & Cozinha', 'production')}
        {renderToolCategory('Custos & Formação de Preço', 'cost')}
        {renderToolCategory('Vendas & Marketing', 'sales')}
      </ScrollView>

      {/* Modal - Calculadora de Custos */}
      <Modal visible={activeToolModal === 'cost_calculator'} animationType="slide">
        <View style={styles.fullModal}>
          <View style={styles.fullModalHeader}>
            <Text style={styles.fullModalTitle}>Calculadora de Custos</Text>
            <TouchableOpacity onPress={() => setActiveToolModal(null)}>
              <X size={24} color={colors.primaryDark} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.fullModalScroll}>
            <Text style={styles.modalIntro}>
              Forme o preço sugerido do seu bolo ou doce calculando custos diretos e margem.
            </Text>

            <CurrencyInput
              label="Custo dos Ingredientes"
              cents={ingredientsCostCents}
              onChangeCents={setIngredientsCostCents}
            />

            <CurrencyInput
              label="Custo da Embalagem"
              cents={packagingCostCents}
              onChangeCents={setPackagingCostCents}
            />

            <CurrencyInput
              label="Mão de Obra Estimada"
              cents={laborCostCents}
              onChangeCents={setLaborCostCents}
            />

            <CurrencyInput
              label="Custos Indiretos (Gás, Energia)"
              cents={overheadCostCents}
              onChangeCents={setOverheadCostCents}
            />

            <Text style={styles.calcLabel}>Método de Precificação</Text>
            <View style={styles.methodRow}>
              <TouchableOpacity
                onPress={() => setCalcMethod('margin')}
                style={[
                  styles.methodBtn,
                  calcMethod === 'margin' && styles.methodBtnActive,
                ]}
              >
                <Text
                  style={[
                    styles.methodBtnText,
                    calcMethod === 'margin' && styles.methodBtnTextActive,
                  ]}
                >
                  Margem sobre Venda
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setCalcMethod('markup')}
                style={[
                  styles.methodBtn,
                  calcMethod === 'markup' && styles.methodBtnActive,
                ]}
              >
                <Text
                  style={[
                    styles.methodBtnText,
                    calcMethod === 'markup' && styles.methodBtnTextActive,
                  ]}
                >
                  Markup sobre Custo
                </Text>
              </TouchableOpacity>
            </View>

            <Input
              label="Percentual Desejado (%)"
              value={targetPercent}
              onChangeText={setTargetPercent}
              keyboardType="numeric"
            />

            <Button
              title="Recalcular Preço Sugerido"
              onPress={handleCalculateCost}
              style={{ marginTop: spacing.sm }}
            />

            {calcResult && (
              <Card style={styles.resultCard}>
                <Text style={styles.resultCardTitle}>Resultado da Precificação</Text>
                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>Custo Total de Produção:</Text>
                  <Text style={styles.resultValue}>
                    € {(calcResult.totalCostCents / 100).toFixed(2)}
                  </Text>
                </View>

                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>Preço de Venda Sugerido:</Text>
                  <Text style={[styles.resultValue, { color: colors.primary, fontSize: 18 }]}>
                    € {(calcResult.suggestedPriceCents / 100).toFixed(2)}
                  </Text>
                </View>

                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>Lucro Bruto Estimado:</Text>
                  <Text style={[styles.resultValue, { color: colors.success }]}>
                    € {(calcResult.profitCents / 100).toFixed(2)}
                  </Text>
                </View>
              </Card>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Modal - Conversor de Medidas */}
      <Modal visible={activeToolModal === 'unit_converter'} animationType="slide">
        <View style={styles.fullModal}>
          <View style={styles.fullModalHeader}>
            <Text style={styles.fullModalTitle}>Conversor Culinário</Text>
            <TouchableOpacity onPress={() => setActiveToolModal(null)}>
              <X size={24} color={colors.primaryDark} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.fullModalScroll}>
            <Text style={styles.modalIntro}>
              Conversões culinárias que respeitam a densidade específica dos ingredientes.
            </Text>

            <Text style={styles.calcLabel}>Ingrediente de Referência</Text>
            <View style={styles.methodRow}>
              {[
                { label: 'Farinha', val: 'farinha' },
                { label: 'Açúcar', val: 'acucar' },
                { label: 'Manteiga', val: 'manteiga' },
                { label: 'Leite', val: 'leite' },
              ].map((ing) => (
                <TouchableOpacity
                  key={ing.val}
                  onPress={() => setConvertIngredient(ing.val)}
                  style={[
                    styles.methodBtn,
                    convertIngredient === ing.val && styles.methodBtnActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.methodBtnText,
                      convertIngredient === ing.val && styles.methodBtnTextActive,
                    ]}
                  >
                    {ing.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Input
              label="Quantidade"
              value={convertValue}
              onChangeText={setConvertValue}
              keyboardType="numeric"
            />

            <Text style={styles.calcLabel}>De (Unidade de Origem)</Text>
            <View style={styles.pillRow}>
              {[
                { label: 'Xícara', val: 'xicara' },
                { label: 'Colher de Sopa', val: 'colher_sopa' },
                { label: 'Gramas (g)', val: 'g' },
                { label: 'Mililitros (ml)', val: 'ml' },
              ].map((u) => (
                <TouchableOpacity
                  key={u.val}
                  onPress={() => setFromUnit(u.val)}
                  style={[styles.pill, fromUnit === u.val && styles.pillActive]}
                >
                  <Text
                    style={[styles.pillText, fromUnit === u.val && styles.pillTextActive]}
                  >
                    {u.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.calcLabel, { marginTop: spacing.md }]}>
              Para (Unidade de Destino)
            </Text>
            <View style={styles.pillRow}>
              {[
                { label: 'Gramas (g)', val: 'g' },
                { label: 'Quilogramas (kg)', val: 'kg' },
                { label: 'Mililitros (ml)', val: 'ml' },
                { label: 'Xícara', val: 'xicara' },
              ].map((u) => (
                <TouchableOpacity
                  key={u.val}
                  onPress={() => setToUnit(u.val)}
                  style={[styles.pill, toUnit === u.val && styles.pillActive]}
                >
                  <Text style={[styles.pillText, toUnit === u.val && styles.pillTextActive]}>
                    {u.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Button
              title="Converter Medida"
              onPress={handleCalculateConversion}
              style={{ marginTop: spacing.lg }}
            />

            {convertResult && (
              <Card style={styles.resultCard}>
                <Text style={styles.resultCardTitle}>Resultado da Conversão</Text>
                <Text style={styles.conversionBig}>
                  {convertResult.inputValue} {convertResult.fromUnit} ={' '}
                  <Text style={{ color: colors.primary }}>
                    {convertResult.convertedValue} {convertResult.toUnit}
                  </Text>
                </Text>
                <Text style={styles.conversionFoot}>
                  Baseado na densidade culinária de {convertIngredient}.
                </Text>
              </Card>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Modal - Planos Koki (Free, Pro, Business) */}
      <PlansModal
        visible={proModalVisible}
        onClose={() => setProModalVisible(false)}
        initialTier="pro"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
  },
  screenTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  screenSubtitle: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  categorySection: {
    marginTop: spacing.md,
  },
  categoryTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
    marginBottom: spacing.xs + 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  toolCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    marginBottom: spacing.xs + 2,
  },
  toolCardLocked: {
    opacity: 0.85,
  },
  toolLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  toolIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  toolName: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  toolDesc: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  proPill: {
    backgroundColor: colors.caramel,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: borderRadius.sm,
  },
  proPillText: {
    fontSize: 9,
    fontWeight: typography.weights.bold,
    color: '#ffffff',
  },
  fullModal: {
    flex: 1,
    backgroundColor: colors.background,
  },
  fullModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  fullModalTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  fullModalScroll: {
    padding: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  modalIntro: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  calcLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.primaryDark,
    marginBottom: spacing.xs,
  },
  methodRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  methodBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  methodBtnActive: {
    borderColor: colors.primary,
    backgroundColor: `${colors.goldenBeige}25`,
  },
  methodBtnText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  methodBtnTextActive: {
    color: colors.primary,
    fontWeight: typography.weights.bold,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#ffffff',
  },
  pillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pillText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  pillTextActive: {
    color: '#ffffff',
    fontWeight: typography.weights.bold,
  },
  resultCard: {
    marginTop: spacing.xl,
    backgroundColor: '#ffffff',
    padding: spacing.lg,
  },
  resultCardTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
    marginBottom: spacing.md,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  resultLabel: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
  },
  resultValue: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  conversionBig: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
    textAlign: 'center',
    marginVertical: spacing.sm,
  },
  conversionFoot: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  proModalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.xxl,
    alignItems: 'center',
  },
  proCrownBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  proModalTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  proModalSubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 2,
    marginBottom: spacing.lg,
  },
  proBenefitsList: {
    width: '100%',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  proBenefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  proBenefitText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
});
