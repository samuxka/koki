import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { X, ArrowDownRight, ArrowUpRight, Sliders, Check } from 'lucide-react-native';
import { InventoryItem, InventoryMovementType } from '@koki/types';
import { api } from '../../services/api';
import { colors, borderRadius, spacing } from '../../theme';
import { Input, CurrencyInput, Button } from '../ui';

interface StockMovementModalProps {
  visible: boolean;
  item: InventoryItem | null;
  initialType?: InventoryMovementType;
  onClose: () => void;
  onSuccess: () => void;
}

export function StockMovementModal({
  visible,
  item,
  initialType = 'in',
  onClose,
  onSuccess,
}: StockMovementModalProps) {
  const [type, setType] = useState<InventoryMovementType>(initialType);
  const [quantityStr, setQuantityStr] = useState('');
  const [costCents, setCostCents] = useState(0);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (visible && item) {
      setType(initialType);
      setQuantityStr('');
      setCostCents(0);
      setReason(initialType === 'in' ? 'compra' : initialType === 'out' ? 'producao' : 'ajuste_inventario');
      setNotes('');
    }
  }, [visible, item, initialType]);

  if (!item) return null;

  const currentStock = item.currentStock || 0;
  const qty = parseFloat(quantityStr.replace(',', '.')) || 0;

  let projectedStock = currentStock;
  if (type === 'in') {
    projectedStock = currentStock + qty;
  } else if (type === 'out') {
    projectedStock = Math.max(0, currentStock - qty);
  } else if (type === 'adjustment') {
    projectedStock = qty;
  }

  const reasons =
    type === 'in'
      ? [
          { key: 'compra', label: 'Compra / Reposição' },
          { key: 'devolucao', label: 'Devolução' },
          { key: 'doacao', label: 'Bonificação' },
          { key: 'outro', label: 'Outro' },
        ]
      : type === 'out'
      ? [
          { key: 'producao', label: 'Uso em Produção' },
          { key: 'perda_validade', label: 'Validade Vencida' },
          { key: 'descarte', label: 'Avaria / Descarte' },
          { key: 'outro', label: 'Outro' },
        ]
      : [
          { key: 'ajuste_inventario', label: 'Contagem Física' },
          { key: 'correcao', label: 'Correção de Saldo' },
          { key: 'outro', label: 'Outro' },
        ];

  const handleSubmit = async () => {
    if (qty <= 0 && type !== 'adjustment') {
      Alert.alert('Quantidade inválida', 'Informe uma quantidade maior que zero.');
      return;
    }

    if (type === 'adjustment' && qty < 0) {
      Alert.alert('Quantidade inválida', 'O estoque não pode ser negativo.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post(`/inventory/${item.id}/movements`, {
        type,
        quantity: qty,
        costCents: type === 'in' ? costCents : 0,
        reason,
        notes: notes.trim() || undefined,
      });

      Alert.alert('Sucesso', 'Movimentação registrada com sucesso!');
      onSuccess();
      onClose();
    } catch (err: any) {
      Alert.alert('Erro ao registrar', err.message || 'Não foi possível salvar a movimentação.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetTitle}>Movimentar Estoque</Text>
              <Text style={styles.sheetSubtitle} numberOfLines={1}>
                {item.name} ({item.unit})
              </Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Type Switcher */}
            <View style={styles.typeSwitcher}>
              <TouchableOpacity
                style={[styles.typeTab, type === 'in' && styles.typeTabIn]}
                onPress={() => {
                  setType('in');
                  setReason('compra');
                }}
              >
                <ArrowDownRight
                  size={16}
                  color={type === 'in' ? colors.success : colors.textSecondary}
                  strokeWidth={2.4}
                />
                <Text style={[styles.typeTabText, type === 'in' && styles.typeTabTextIn]}>
                  Entrada
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.typeTab, type === 'out' && styles.typeTabOut]}
                onPress={() => {
                  setType('out');
                  setReason('producao');
                }}
              >
                <ArrowUpRight
                  size={16}
                  color={type === 'out' ? colors.danger : colors.textSecondary}
                  strokeWidth={2.4}
                />
                <Text style={[styles.typeTabText, type === 'out' && styles.typeTabTextOut]}>
                  Saída
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.typeTab, type === 'adjustment' && styles.typeTabAdj]}
                onPress={() => {
                  setType('adjustment');
                  setReason('ajuste_inventario');
                }}
              >
                <Sliders
                  size={16}
                  color={type === 'adjustment' ? colors.primary : colors.textSecondary}
                  strokeWidth={2.4}
                />
                <Text style={[styles.typeTabText, type === 'adjustment' && styles.typeTabTextAdj]}>
                  Ajuste
                </Text>
              </TouchableOpacity>
            </View>

            {/* Current vs Projected Stock Banner */}
            <View style={styles.stockBanner}>
              <View style={styles.stockCol}>
                <Text style={styles.stockLabel}>Estoque Atual</Text>
                <Text style={styles.stockValue}>
                  {currentStock.toLocaleString('pt-PT')} {item.unit}
                </Text>
              </View>
              <View style={styles.stockDivider} />
              <View style={styles.stockCol}>
                <Text style={styles.stockLabel}>Novo Estoque</Text>
                <Text
                  style={[
                    styles.stockValue,
                    {
                      color:
                        projectedStock <= item.minStock
                          ? colors.danger
                          : colors.primaryDark,
                    },
                  ]}
                >
                  {projectedStock.toLocaleString('pt-PT')} {item.unit}
                </Text>
              </View>
            </View>

            {/* Quantity Input */}
            <View style={styles.inputWrapper}>
              <Input
                label={
                  type === 'adjustment'
                    ? `Nova quantidade total contada (${item.unit})`
                    : `Quantidade a ${type === 'in' ? 'adicionar' : 'retirar'} (${item.unit})`
                }
                placeholder="Ex: 500"
                keyboardType="numeric"
                value={quantityStr}
                onChangeText={setQuantityStr}
              />
            </View>

            {/* Cost input for 'in' */}
            {type === 'in' && (
              <View style={styles.inputWrapper}>
                <CurrencyInput
                  label="Valor total pago nesta compra (opcional)"
                  cents={costCents}
                  onChangeCents={setCostCents}
                />
                {qty > 0 && costCents > 0 && (
                  <Text style={styles.unitCostHint}>
                    Custo calculado: {(costCents / 100 / qty).toFixed(4)} € / {item.unit}
                  </Text>
                )}
              </View>
            )}

            {/* Reason Selector */}
            <Text style={styles.fieldLabel}>Motivo da movimentação</Text>
            <View style={styles.reasonsRow}>
              {reasons.map((r) => {
                const isSelected = reason === r.key;
                return (
                  <TouchableOpacity
                    key={r.key}
                    style={[styles.reasonChip, isSelected && styles.reasonChipActive]}
                    onPress={() => setReason(r.key)}
                  >
                    {isSelected && <Check size={14} color="#ffffff" style={{ marginRight: 4 }} />}
                    <Text
                      style={[
                        styles.reasonChipText,
                        isSelected && styles.reasonChipTextActive,
                      ]}
                    >
                      {r.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Notes */}
            <View style={[styles.inputWrapper, { marginTop: spacing.md }]}>
              <Input
                label="Observações (opcional)"
                placeholder="Ex: Fornada especial de bolos, lote #82..."
                value={notes}
                onChangeText={setNotes}
              />
            </View>

            {/* Action Buttons */}
            <View style={styles.actionsContainer}>
              <Button
                title={
                  type === 'in'
                    ? 'Confirmar Entrada'
                    : type === 'out'
                    ? 'Confirmar Saída'
                    : 'Confirmar Ajuste'
                }
                variant={type === 'out' ? 'danger' : 'primary'}
                onPress={handleSubmit}
                loading={isSubmitting}
              />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(35, 18, 5, 0.65)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  sheetSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingBottom: 20,
  },
  typeSwitcher: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: 4,
    gap: 6,
    marginBottom: 16,
  },
  typeTab: {
    flex: 1,
    height: 40,
    borderRadius: borderRadius.md,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  typeTabIn: {
    backgroundColor: '#eaf8ef',
    borderWidth: 1.5,
    borderColor: '#b6e6c4',
  },
  typeTabOut: {
    backgroundColor: '#fdeeee',
    borderWidth: 1.5,
    borderColor: '#f7c2be',
  },
  typeTabAdj: {
    backgroundColor: '#fff6e9',
    borderWidth: 1.5,
    borderColor: '#edd5b8',
  },
  typeTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  typeTabTextIn: {
    color: colors.success,
    fontWeight: '700',
  },
  typeTabTextOut: {
    color: colors.danger,
    fontWeight: '700',
  },
  typeTabTextAdj: {
    color: colors.primary,
    fontWeight: '700',
  },
  stockBanner: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 16,
  },
  stockCol: {
    flex: 1,
    alignItems: 'center',
  },
  stockDivider: {
    width: 1,
    backgroundColor: colors.border,
  },
  stockLabel: {
    fontSize: 11,
    color: colors.textMuted,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  stockValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primaryDark,
    marginTop: 4,
  },
  inputWrapper: {
    marginBottom: 14,
  },
  unitCostHint: {
    fontSize: 12,
    color: colors.caramel,
    marginTop: 4,
    fontWeight: '600',
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  reasonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reasonChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reasonChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  reasonChipText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  reasonChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  actionsContainer: {
    marginTop: 20,
  },
});
