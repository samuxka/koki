import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Check, Calculator, Sparkles, Tag, Info } from 'lucide-react-native';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../src/services/api';
import { colors, borderRadius, spacing } from '../../src/theme';
import { Input, CurrencyInput, Button } from '../../src/components/ui';
import { PlansModal } from '../../src/components/PlansModal';
import { formatCurrency } from '../../src/utils/formatters';

const PRESET_CATEGORIES = [
  'Farinhas & Secos',
  'Ovos & Laticínios',
  'Chocolates & Cacau',
  'Açúcares & Doces',
  'Frutas & Recheios',
  'Embalagens & Caixas',
  'Fitas & Decoração',
  'Outros',
];

const PRESET_UNITS = [
  { key: 'g', label: 'g (gramas)' },
  { key: 'kg', label: 'kg (quilos)' },
  { key: 'ml', label: 'ml (mililitros)' },
  { key: 'l', label: 'l (litros)' },
  { key: 'unidade', label: 'un (unidade)' },
  { key: 'caixa', label: 'cx (caixa)' },
  { key: 'lata', label: 'lata' },
  { key: 'pct', label: 'pct (pacote)' },
];

export default function NewInventoryItemScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [category, setCategory] = useState(PRESET_CATEGORIES[0]);
  const [customCategory, setCustomCategory] = useState('');
  const [brand, setBrand] = useState('');
  const [unit, setUnit] = useState('g');
  const [currentStockStr, setCurrentStockStr] = useState('0');
  const [minStockStr, setMinStockStr] = useState('100');
  const [idealStockStr, setIdealStockStr] = useState('');

  // Package calculation & Direct unit cost
  const [usePackageCalc, setUsePackageCalc] = useState(true);
  const [packageSizeStr, setPackageSizeStr] = useState('1000');
  const [packageCostCents, setPackageCostCents] = useState(0);
  const [directUnitCostCents, setDirectUnitCostCents] = useState(0);
  const [directBulkCostCents, setDirectBulkCostCents] = useState(0);

  const [location, setLocation] = useState('');
  const [supplier, setSupplier] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [notes, setNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [plansModalVisible, setPlansModalVisible] = useState(false);

  const handleSelectUnit = (newUnit: string) => {
    setUnit(newUnit);
    if ((newUnit === 'g' || newUnit === 'ml') && (packageSizeStr === '1' || !packageSizeStr)) {
      setPackageSizeStr('1000');
    } else if (newUnit !== 'g' && newUnit !== 'ml' && packageSizeStr === '1000') {
      setPackageSizeStr('1');
    }
  };

  // Compute calculated unit cost (cents per unit) without truncating to 0!
  const pkgSize = parseFloat(packageSizeStr.replace(',', '.')) || 0;
  
  let calculatedUnitCostCents = 0;
  if (usePackageCalc) {
    if (pkgSize > 0 && packageCostCents > 0) {
      calculatedUnitCostCents = packageCostCents / pkgSize;
    }
  } else {
    if ((unit === 'g' || unit === 'ml') && directBulkCostCents > 0) {
      calculatedUnitCostCents = directBulkCostCents / 1000;
    } else {
      calculatedUnitCostCents = directUnitCostCents;
    }
  }

  const formatUnitCost = (cents: number, u: string) => {
    if (!cents || cents <= 0) return `0,00 € por ${u}`;
    const euro = cents / 100;
    if (euro < 0.01) {
      return `${euro.toFixed(4).replace('.', ',')} € por ${u}`;
    }
    return `${euro.toFixed(2).replace('.', ',')} € por ${u}`;
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert('Nome obrigatório', 'Informe o nome do insumo.');
      return;
    }

    const finalCategory = customCategory.trim() || category;
    if (!finalCategory.trim()) {
      Alert.alert('Categoria obrigatória', 'Selecione ou informe uma categoria.');
      return;
    }

    const currentStock = parseFloat(currentStockStr.replace(',', '.')) || 0;
    const minStock = parseFloat(minStockStr.replace(',', '.')) || 0;
    const idealStock = idealStockStr ? parseFloat(idealStockStr.replace(',', '.')) : undefined;

    setIsSubmitting(true);
    try {
      await api.post('/inventory', {
        name: name.trim(),
        category: finalCategory,
        brand: brand.trim() || undefined,
        unit,
        currentStock,
        minStock,
        idealStock,
        unitCostCents: calculatedUnitCostCents > 0 ? calculatedUnitCostCents : 0,
        packageSize: usePackageCalc && pkgSize > 0 ? pkgSize : undefined,
        packageCostCents: usePackageCalc && packageCostCents > 0 ? packageCostCents : undefined,
        location: location.trim() || undefined,
        supplier: supplier.trim() || undefined,
        expiryDate: expiryDate.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-summary'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-shopping-list'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-categories'] });

      Alert.alert('Sucesso', 'Insumo cadastrado com sucesso!');
      router.back();
    } catch (err: any) {
      if (err.code === 'INVENTORY_LIMIT_REACHED' || err.message?.includes('limite')) {
        setPlansModalVisible(true);
      } else {
        Alert.alert('Erro ao salvar', err.message || 'Não foi possível cadastrar o insumo.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.container, { paddingTop: Math.max(insets.top, 20) + 8 }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <ArrowLeft size={22} color={colors.primaryDark} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Novo Insumo</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Card: Basic Info */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Identificação do Insumo</Text>

            <View style={styles.inputGroup}>
              <Input
                label="Nome do Insumo *"
                placeholder="Ex: Farinha de Trigo Especial, Chocolate 54%..."
                value={name}
                onChangeText={setName}
              />
            </View>

            <View style={styles.inputGroup}>
              <Input
                label="Marca / Fabricante (opcional)"
                placeholder="Ex: Dona Benta, Nestlé, Callebaut..."
                value={brand}
                onChangeText={setBrand}
              />
            </View>

            {/* Category Selector */}
            <Text style={styles.fieldLabel}>Categoria *</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryChips}
            >
              {PRESET_CATEGORIES.map((cat) => {
                const isSelected = category === cat && !customCategory;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.categoryChip, isSelected && styles.categoryChipActive]}
                    onPress={() => {
                      setCategory(cat);
                      setCustomCategory('');
                    }}
                  >
                    {isSelected && <Check size={14} color="#ffffff" style={{ marginRight: 4 }} />}
                    <Text
                      style={[
                        styles.categoryChipText,
                        isSelected && styles.categoryChipTextActive,
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={[styles.inputGroup, { marginTop: 10 }]}>
              <Input
                placeholder="Ou digite outra categoria personalizada..."
                value={customCategory}
                onChangeText={setCustomCategory}
              />
            </View>
          </View>

          {/* Card: Unit & Stock Control */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Unidade & Nível de Estoque</Text>

            <Text style={styles.fieldLabel}>Unidade de Medida *</Text>
            <View style={styles.unitsGrid}>
              {PRESET_UNITS.map((u) => {
                const isSelected = unit === u.key;
                return (
                  <TouchableOpacity
                    key={u.key}
                    style={[styles.unitChip, isSelected && styles.unitChipActive]}
                    onPress={() => handleSelectUnit(u.key)}
                  >
                    <Text
                      style={[
                        styles.unitChipText,
                        isSelected && styles.unitChipTextActive,
                      ]}
                    >
                      {u.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.rowInputs}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Input
                  label={`Estoque Atual (${unit})`}
                  placeholder="0"
                  keyboardType="numeric"
                  value={currentStockStr}
                  onChangeText={setCurrentStockStr}
                />
              </View>

              <View style={{ flex: 1, marginLeft: 8 }}>
                <Input
                  label={`Estoque Mínimo (${unit}) *`}
                  placeholder="100"
                  keyboardType="numeric"
                  value={minStockStr}
                  onChangeText={setMinStockStr}
                />
              </View>
            </View>

            <View style={[styles.inputGroup, { marginTop: 12 }]}>
              <Input
                label={`Estoque Ideal / Meta (${unit}) (opcional)`}
                placeholder="Ex: 500"
                keyboardType="numeric"
                value={idealStockStr}
                onChangeText={setIdealStockStr}
              />
            </View>
          </View>

          {/* Card: Pricing & Package Helper */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Custo do Insumo</Text>
            <Text style={styles.sectionSubtitle}>
              Informe pelo pacote fechado ou digite o valor unitário
            </Text>

            {/* Segmented Mode Tabs */}
            <View style={styles.costModeTabsRow}>
              <TouchableOpacity
                style={[styles.costModeTab, usePackageCalc && styles.costModeTabActive]}
                activeOpacity={0.75}
                onPress={() => setUsePackageCalc(true)}
              >
                <Calculator
                  size={15}
                  color={usePackageCalc ? colors.primary : colors.textSecondary}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.costModeTabText,
                    usePackageCalc && styles.costModeTabTextActive,
                  ]}
                >
                  Por Pacote / Embalagem
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.costModeTab, !usePackageCalc && styles.costModeTabActive]}
                activeOpacity={0.75}
                onPress={() => setUsePackageCalc(false)}
              >
                <Tag
                  size={15}
                  color={!usePackageCalc ? colors.primary : colors.textSecondary}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.costModeTabText,
                    !usePackageCalc && styles.costModeTabTextActive,
                  ]}
                >
                  Custo Direto
                </Text>
              </TouchableOpacity>
            </View>

            {usePackageCalc ? (
              <View style={styles.packageCalcBox}>
                <View style={styles.rowInputs}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Input
                      label={`Tamanho do Pacote (${unit}) *`}
                      placeholder={unit === 'g' || unit === 'ml' ? 'Ex: 1000' : 'Ex: 1'}
                      keyboardType="numeric"
                      value={packageSizeStr}
                      onChangeText={setPackageSizeStr}
                    />
                  </View>

                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <CurrencyInput
                      label="Valor Pago no Pacote *"
                      cents={packageCostCents}
                      onChangeCents={setPackageCostCents}
                    />
                  </View>
                </View>

                {pkgSize > 0 && packageCostCents > 0 ? (
                  <View style={styles.calcResultBox}>
                    <Sparkles size={20} color={colors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.calcResultLabel}>Custo Unitário Calculado:</Text>
                      <Text style={styles.calcResultValue}>
                        {formatUnitCost(calculatedUnitCostCents, unit)}
                      </Text>
                      {unit === 'g' && calculatedUnitCostCents > 0 && (
                        <Text style={styles.calcResultSub}>
                          ↳ 100g = {((calculatedUnitCostCents * 100) / 100).toFixed(2).replace('.', ',')} € • 1kg = {((calculatedUnitCostCents * 1000) / 100).toFixed(2).replace('.', ',')} €
                        </Text>
                      )}
                      {unit === 'ml' && calculatedUnitCostCents > 0 && (
                        <Text style={styles.calcResultSub}>
                          ↳ 1 Litro = {((calculatedUnitCostCents * 1000) / 100).toFixed(2).replace('.', ',')} €
                        </Text>
                      )}
                    </View>
                  </View>
                ) : (
                  <View style={styles.calcHintBox}>
                    <Info size={15} color={colors.textSecondary} style={{ marginRight: 6 }} />
                    <Text style={styles.calcHintText}>
                      Informe o tamanho da embalagem e o valor pago para o Koki calcular o custo exato por {unit}.
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.packageCalcBox}>
                {unit === 'g' ? (
                  <View>
                    <CurrencyInput
                      label="Preço por 1 kg (1.000 g)"
                      cents={directBulkCostCents}
                      onChangeCents={setDirectBulkCostCents}
                    />
                    {directBulkCostCents > 0 ? (
                      <View style={styles.calcResultBox}>
                        <Sparkles size={20} color={colors.primary} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.calcResultLabel}>Custo por grama:</Text>
                          <Text style={styles.calcResultValue}>
                            {formatUnitCost(calculatedUnitCostCents, 'g')}
                          </Text>
                          <Text style={styles.calcResultSub}>
                            ↳ 100g = {((calculatedUnitCostCents * 100) / 100).toFixed(2).replace('.', ',')} €
                          </Text>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.calcHintBox}>
                        <Info size={15} color={colors.textSecondary} style={{ marginRight: 6 }} />
                        <Text style={styles.calcHintText}>
                          Informe o preço por quilo para calcularmos automaticamente o custo por grama.
                        </Text>
                      </View>
                    )}
                  </View>
                ) : unit === 'ml' ? (
                  <View>
                    <CurrencyInput
                      label="Preço por 1 Litro (1.000 ml)"
                      cents={directBulkCostCents}
                      onChangeCents={setDirectBulkCostCents}
                    />
                    {directBulkCostCents > 0 ? (
                      <View style={styles.calcResultBox}>
                        <Sparkles size={20} color={colors.primary} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.calcResultLabel}>Custo por ml:</Text>
                          <Text style={styles.calcResultValue}>
                            {formatUnitCost(calculatedUnitCostCents, 'ml')}
                          </Text>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.calcHintBox}>
                        <Info size={15} color={colors.textSecondary} style={{ marginRight: 6 }} />
                        <Text style={styles.calcHintText}>
                          Informe o preço por litro para calcularmos automaticamente o custo por ml.
                        </Text>
                      </View>
                    )}
                  </View>
                ) : (
                  <View>
                    <CurrencyInput
                      label={`Custo Unitário por 1 ${unit}`}
                      cents={directUnitCostCents}
                      onChangeCents={setDirectUnitCostCents}
                    />
                    {directUnitCostCents > 0 && (
                      <View style={styles.calcResultBox}>
                        <Sparkles size={20} color={colors.primary} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.calcResultLabel}>Custo Unitário:</Text>
                          <Text style={styles.calcResultValue}>
                            {formatUnitCost(calculatedUnitCostCents, unit)}
                          </Text>
                        </View>
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Card: Location & Supplier */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Armazenamento & Validade</Text>

            <View style={styles.rowInputs}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Input
                  label="Local na Confeitaria"
                  placeholder="Ex: Despensa 1, Geladeira..."
                  value={location}
                  onChangeText={setLocation}
                />
              </View>

              <View style={{ flex: 1, marginLeft: 8 }}>
                <Input
                  label="Fornecedor Habitual"
                  placeholder="Ex: Makro, Recheio..."
                  value={supplier}
                  onChangeText={setSupplier}
                />
              </View>
            </View>

            <View style={[styles.inputGroup, { marginTop: 12 }]}>
              <Input
                label="Data de Validade (opcional)"
                placeholder="DD/MM/AAAA"
                value={expiryDate}
                onChangeText={setExpiryDate}
              />
            </View>

            <View style={[styles.inputGroup, { marginTop: 12 }]}>
              <Input
                label="Observações / Cuidados (opcional)"
                placeholder="Ex: Manter refrigerado após aberto, lote #312..."
                value={notes}
                onChangeText={setNotes}
              />
            </View>
          </View>

          {/* Submit Button */}
          <View style={styles.submitContainer}>
            <Button
              title="Salvar Insumo no Estoque"
              variant="primary"
              size="lg"
              onPress={handleSubmit}
              loading={isSubmitting}
            />
          </View>
        </ScrollView>

        <PlansModal
          visible={plansModalVisible}
          onClose={() => setPlansModalVisible(false)}
        />
      </View>
    </KeyboardAvoidingView>
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
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 14,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: 16,
  },
  cardHeaderWithToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primaryDark,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  inputGroup: {
    marginTop: 10,
  },
  rowInputs: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryChips: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryChipText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  categoryChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  unitsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  unitChip: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  unitChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  unitChipText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  unitChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  costModeTabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    marginBottom: 12,
  },
  costModeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  costModeTabActive: {
    backgroundColor: '#fff6e9',
    borderColor: colors.primary,
  },
  costModeTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  costModeTabTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  packageCalcBox: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  calcResultBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.md,
    padding: 12,
    marginTop: 10,
    borderWidth: 1.5,
    borderColor: '#edd5b8',
  },
  calcResultLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  calcResultValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary,
    marginTop: 2,
  },
  calcResultSub: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
    marginTop: 4,
  },
  calcHintBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.md,
    padding: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  calcHintText: {
    fontSize: 12,
    color: colors.textSecondary,
    flex: 1,
  },
  submitContainer: {
    marginTop: 8,
    marginBottom: 20,
  },
});
