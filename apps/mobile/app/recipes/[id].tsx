import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  RefreshControl,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Trash2,
  Edit2,
  Clock,
  Flame,
  CheckCircle2,
  Circle,
  Sparkles,
  Scale,
  PieChart,
  FileText,
} from 'lucide-react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../src/services/api';
import { Recipe } from '@koki/types';
import { colors, borderRadius, spacing } from '../../src/theme';
import { formatCurrency } from '../../src/utils/formatters';
import { Badge, LoadingState } from '../../src/components/ui';

export default function RecipeDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  // Scale multiplier: 0.5, 1, 2, 3 or custom
  const [scaleMultiplier, setScaleMultiplier] = useState(1);
  const [customYieldStr, setCustomYieldStr] = useState('');

  // Interactive instructions checklist
  const [completedSteps, setCompletedSteps] = useState<Record<number, boolean>>({});

  const {
    data: recipe,
    isLoading,
    refetch,
  } = useQuery<Recipe>({
    queryKey: ['recipe', id],
    queryFn: () => api.get<Recipe>(`/recipes/${id}`),
    enabled: !!id,
  });

  const handleToggleStep = (index: number) => {
    setCompletedSteps((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const handlePresetScale = (mult: number) => {
    setScaleMultiplier(mult);
    if (recipe) {
      setCustomYieldStr((recipe.yield * mult).toString());
    }
  };

  const handleCustomYieldChange = (text: string) => {
    setCustomYieldStr(text);
    const parsed = parseFloat(text.replace(',', '.')) || 0;
    if (parsed > 0 && recipe && recipe.yield > 0) {
      setScaleMultiplier(parsed / recipe.yield);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Excluir Ficha Técnica',
      `Tem certeza que deseja excluir a receita "${recipe?.name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/recipes/${id}`);
              queryClient.invalidateQueries({ queryKey: ['recipes'] });
              queryClient.invalidateQueries({ queryKey: ['recipes-summary'] });
              Alert.alert('Sucesso', 'Ficha técnica excluída com sucesso!');
              router.back();
            } catch (err: any) {
              Alert.alert('Erro ao excluir', err.message || 'Não foi possível excluir a receita.');
            }
          },
        },
      ],
    );
  };

  if (isLoading || !recipe) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <LoadingState message="Carregando ficha técnica..." variant="detail" />
      </View>
    );
  }

  const baseYield = recipe.yield || 1;
  const scaledYield = Math.round(baseYield * scaleMultiplier * 100) / 100;

  const scaledIngredients = (recipe.ingredients || []).map((ing) => {
    const scaledQty = Math.round(ing.quantity * scaleMultiplier * 100) / 100;
    const scaledCost = Math.round(ing.costCents * scaleMultiplier);
    return {
      ...ing,
      scaledQty,
      scaledCost,
    };
  });

  const scaledIngredientsCost = Math.round((recipe.ingredientsCostCents || 0) * scaleMultiplier);
  const scaledTotalCost = Math.round((recipe.totalCostCents || 0) * scaleMultiplier);
  const costPerUnit = recipe.costPerYieldUnitCents || 0;

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 20) + 8 }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <ArrowLeft size={22} color={colors.primaryDark} />
        </TouchableOpacity>

        <View style={styles.headerTitleCol}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {recipe.name}
          </Text>
          <Text style={styles.headerCategory}>{recipe.category}</Text>
        </View>

        <View style={styles.headerRightActions}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => router.push(`/recipes/edit/${id}` as any)}
            activeOpacity={0.7}
          >
            <Edit2 size={18} color={colors.primaryDark} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.headerBtn, { borderColor: '#f7c2be' }]}
            onPress={handleDelete}
            activeOpacity={0.7}
          >
            <Trash2 size={18} color={colors.danger} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={() => { refetch(); }} tintColor={colors.primary} />
        }
      >
        {/* Card: Visão Geral */}
        <View style={styles.overviewCard}>
          <View style={styles.overviewTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.overviewTitle}>{recipe.name}</Text>
              {recipe.description ? (
                <Text style={styles.overviewDesc}>{recipe.description}</Text>
              ) : null}
            </View>
            <Badge label={recipe.category} color={colors.primary} />
          </View>

          {/* Times & Oven */}
          <View style={styles.metaRow}>
            {recipe.prepTimeMinutes ? (
              <View style={styles.metaChip}>
                <Clock size={13} color={colors.textSecondary} />
                <Text style={styles.metaChipText}>{recipe.prepTimeMinutes} min preparo</Text>
              </View>
            ) : null}

            {recipe.bakeTimeMinutes ? (
              <View style={styles.metaChip}>
                <Flame size={13} color={colors.warning} />
                <Text style={styles.metaChipText}>{recipe.bakeTimeMinutes} min forno</Text>
              </View>
            ) : null}

            {recipe.ovenTemperature ? (
              <View style={styles.metaChip}>
                <Text style={styles.metaChipText}>{recipe.ovenTemperature} °C</Text>
              </View>
            ) : null}
          </View>

          {/* Pricing Quick Bar */}
          <View style={styles.priceRow}>
            <View style={styles.priceCol}>
              <Text style={styles.priceLabel}>Custo por {recipe.yieldUnit || 'unidade'}</Text>
              <Text style={styles.priceBigValue}>{formatCurrency(costPerUnit)}</Text>
            </View>

            <View style={styles.priceDivider} />

            <View style={styles.priceCol}>
              <Text style={styles.priceLabel}>Custo Total da Receita</Text>
              <Text style={styles.priceBigValue}>{formatCurrency(recipe.totalCostCents)}</Text>
            </View>
          </View>
        </View>

        {/* Card: Escalonador Proporcional Interativo */}
        <View style={styles.scalerCard}>
          <View style={styles.scalerHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Scale size={18} color={colors.primary} />
              <Text style={styles.scalerTitle}>Escalonador Proporcional</Text>
            </View>
            <Badge
              label={`${scaledYield} ${recipe.yieldUnit || 'unidades'}`}
              color={scaleMultiplier !== 1 ? colors.warning : colors.primary}
            />
          </View>

          <Text style={styles.scalerSubtitle}>
            Ajuste a quantidade desejada e todas as medidas serão recalculadas automaticamente:
          </Text>

          {/* Presets Chips */}
          <View style={styles.scalePresetsRow}>
            {[
              { label: '0.5x (Metade)', val: 0.5 },
              { label: '1x (Padrão)', val: 1 },
              { label: '2x (Dobro)', val: 2 },
              { label: '3x (Triplo)', val: 3 },
            ].map((p) => {
              const isSelected = scaleMultiplier === p.val;
              return (
                <TouchableOpacity
                  key={p.val}
                  style={[styles.scalePresetChip, isSelected && styles.scalePresetChipActive]}
                  onPress={() => handlePresetScale(p.val)}
                >
                  <Text
                    style={[
                      styles.scalePresetText,
                      isSelected && styles.scalePresetTextActive,
                    ]}
                  >
                    {p.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Custom Yield Input */}
          <View style={styles.customYieldRow}>
            <Text style={styles.customYieldLabel}>Ou digite o rendimento desejado:</Text>
            <View style={styles.customYieldInputWrapper}>
              <TextInput
                style={styles.customYieldInput}
                placeholder={baseYield.toString()}
                keyboardType="numeric"
                value={customYieldStr}
                onChangeText={handleCustomYieldChange}
              />
              <Text style={styles.customYieldUnit}>{recipe.yieldUnit}</Text>
            </View>
          </View>
        </View>

        {/* Card: Ingredientes & Baker's Percentage */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.sectionTitle}>Ingredientes</Text>
            <Text style={styles.sectionSubtitle}>
              {scaleMultiplier !== 1 ? `Proporção ${scaleMultiplier}x` : 'Receita Padrão'}
            </Text>
          </View>

          <View style={styles.ingredientsTable}>
            {scaledIngredients.map((ing, idx) => (
              <View key={ing.id || idx} style={styles.ingTableRow}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.ingTableName}>{ing.name}</Text>
                    {ing.isFlour ? (
                      <Badge label="Farinha Base (100%)" color={colors.primary} />
                    ) : null}
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 }}>
                    <Text style={styles.ingTableQty}>
                      {ing.scaledQty} {ing.unit}
                    </Text>

                    {ing.bakersPercentage ? (
                      <View style={styles.bakersBadge}>
                        <Text style={styles.bakersText}>
                          {ing.bakersPercentage}% Baker's
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                <Text style={styles.ingTableCost}>{formatCurrency(ing.scaledCost)}</Text>
              </View>
            ))}

            {/* Subtotal da Receita Escalonada */}
            <View style={styles.tableFooterRow}>
              <Text style={styles.tableFooterLabel}>
                Subtotal dos Insumos ({scaleMultiplier}x):
              </Text>
              <Text style={styles.tableFooterValue}>
                {formatCurrency(scaledIngredientsCost)}
              </Text>
            </View>
          </View>
        </View>

        {/* Card: Modo de Preparo Interativo */}
        {recipe.instructions && recipe.instructions.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Modo de Preparo</Text>
            <Text style={styles.sectionSubtitle}>
              Toque em cada etapa para marcar como concluída enquanto cozinha na bancada:
            </Text>

            <View style={styles.instructionsList}>
              {recipe.instructions.map((step, idx) => {
                const isDone = !!completedSteps[idx];
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.instructionStep, isDone && styles.instructionStepDone]}
                    activeOpacity={0.8}
                    onPress={() => handleToggleStep(idx)}
                  >
                    <View style={styles.stepCheckCol}>
                      {isDone ? (
                        <CheckCircle2 size={22} color={colors.success} />
                      ) : (
                        <Circle size={22} color={colors.border} />
                      )}
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={[styles.stepNumber, isDone && styles.stepNumberDone]}>
                        Passo {idx + 1}
                      </Text>
                      <Text style={[styles.stepText, isDone && styles.stepTextDone]}>
                        {step}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* Card: Notas da Confeiteira */}
        {recipe.notes ? (
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <FileText size={16} color={colors.primary} />
              <Text style={styles.sectionTitle}>Dicas & Conservação</Text>
            </View>
            <Text style={styles.notesText}>{recipe.notes}</Text>
          </View>
        ) : null}

        {/* Card: Custos Detalhados & Precificação */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Ficha de Custos & Precificação</Text>

          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Custo de Insumos:</Text>
            <Text style={styles.breakdownValue}>{formatCurrency(recipe.ingredientsCostCents)}</Text>
          </View>

          {recipe.packagingCostCents ? (
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Embalagem:</Text>
              <Text style={styles.breakdownValue}>{formatCurrency(recipe.packagingCostCents)}</Text>
            </View>
          ) : null}

          {recipe.laborCostCents ? (
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Mão de Obra Estimada:</Text>
              <Text style={styles.breakdownValue}>{formatCurrency(recipe.laborCostCents)}</Text>
            </View>
          ) : null}

          {recipe.overheadCostCents ? (
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Custos Fixos (Gás/Energia):</Text>
              <Text style={styles.breakdownValue}>{formatCurrency(recipe.overheadCostCents)}</Text>
            </View>
          ) : null}

          <View style={[styles.breakdownRow, styles.breakdownTotal]}>
            <Text style={styles.breakdownTotalLabel}>Custo Total Base:</Text>
            <Text style={styles.breakdownTotalValue}>{formatCurrency(recipe.totalCostCents)}</Text>
          </View>

          {recipe.suggestedSalePriceCents ? (
            <View style={styles.suggestedPriceBox}>
              <View style={{ flex: 1 }}>
                <Text style={styles.suggestedLabel}>Preço de Venda Sugerido</Text>
                <Text style={styles.suggestedSub}>
                  Lucro bruto estimado de {formatCurrency(Math.max(0, recipe.suggestedSalePriceCents - recipe.totalCostCents))}
                </Text>
              </View>
              <Text style={styles.suggestedValue}>
                {formatCurrency(recipe.suggestedSalePriceCents)}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Edit Button */}
        <TouchableOpacity
          style={styles.editActionBtn}
          activeOpacity={0.85}
          onPress={() => router.push(`/recipes/edit/${id}` as any)}
        >
          <Edit2 size={16} color="#ffffff" style={{ marginRight: 6 }} />
          <Text style={styles.editActionBtnText}>Editar Ficha Técnica</Text>
        </TouchableOpacity>
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  headerTitleCol: {
    flex: 1,
    paddingHorizontal: 10,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  headerCategory: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 1,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 14,
  },
  overviewCard: {
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: 16,
  },
  overviewTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  overviewTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  overviewDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 12,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  metaChipText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  priceRow: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginTop: 14,
  },
  priceCol: {
    flex: 1,
    alignItems: 'center',
  },
  priceDivider: {
    width: 1,
    backgroundColor: colors.border,
  },
  priceLabel: {
    fontSize: 11,
    color: colors.textMuted,
    textTransform: 'uppercase',
    fontWeight: '600',
    textAlign: 'center',
  },
  priceBigValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primaryDark,
    marginTop: 3,
  },
  scalerCard: {
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: '#edd5b8',
    padding: 16,
  },
  scalerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scalerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
  },
  scalerSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
    lineHeight: 16,
  },
  scalePresetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  scalePresetChip: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  scalePresetChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  scalePresetText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  scalePresetTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  customYieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.surface,
  },
  customYieldLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  customYieldInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    height: 36,
  },
  customYieldInput: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primaryDark,
    width: 48,
    textAlign: 'center',
    paddingVertical: 0,
  },
  customYieldUnit: {
    fontSize: 12,
    color: colors.textMuted,
    marginLeft: 2,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: 16,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  ingredientsTable: {
    gap: 8,
  },
  ingTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface,
  },
  ingTableName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  ingTableQty: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  bakersBadge: {
    backgroundColor: '#fff6e9',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#edd5b8',
  },
  bakersText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
  },
  ingTableCost: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  tableFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
  },
  tableFooterLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tableFooterValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary,
  },
  instructionsList: {
    marginTop: 12,
    gap: 10,
  },
  instructionStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    padding: 12,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  instructionStepDone: {
    backgroundColor: '#eaf8ef',
    borderColor: '#b6e6c4',
  },
  stepCheckCol: {
    paddingTop: 2,
  },
  stepNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
  },
  stepNumberDone: {
    color: colors.success,
  },
  stepText: {
    fontSize: 13,
    color: colors.primaryDark,
    lineHeight: 19,
    marginTop: 2,
  },
  stepTextDone: {
    textDecorationLine: 'line-through',
    color: colors.textMuted,
  },
  notesText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface,
  },
  breakdownLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  breakdownValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primaryDark,
  },
  breakdownTotal: {
    borderBottomWidth: 0,
    paddingTop: 10,
  },
  breakdownTotalLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  breakdownTotalValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary,
  },
  suggestedPriceBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eaf8ef',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#b6e6c4',
    padding: 12,
    marginTop: 12,
  },
  suggestedLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.success,
    textTransform: 'uppercase',
  },
  suggestedSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  suggestedValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.success,
  },
  editActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    height: 48,
    marginTop: 6,
    marginBottom: 20,
  },
  editActionBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});
