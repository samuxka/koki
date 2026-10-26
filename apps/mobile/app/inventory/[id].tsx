import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  FlatList,
  RefreshControl,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Trash2,
  ArrowDownRight,
  ArrowUpRight,
  Sliders,
  Calendar,
  MapPin,
  Truck,
  FileText,
  AlertTriangle,
  Package,
} from 'lucide-react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../src/services/api';
import { InventoryItem, InventoryMovement } from '@koki/types';
import { colors, borderRadius, spacing } from '../../src/theme';
import { formatCurrency } from '../../src/utils/formatters';
import { Badge, LoadingState } from '../../src/components/ui';
import { StockMovementModal } from '../../src/components/inventory/StockMovementModal';

export default function InventoryItemDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  // Movement modal state
  const [movementModalVisible, setMovementModalVisible] = useState(false);
  const [movementType, setMovementType] = useState<'in' | 'out' | 'adjustment'>('in');

  // Query item detail
  const {
    data: item,
    isLoading: isItemLoading,
    refetch: refetchItem,
  } = useQuery<InventoryItem>({
    queryKey: ['inventory-item', id],
    queryFn: () => api.get<InventoryItem>(`/inventory/${id}`),
    enabled: !!id,
  });

  // Query item movements
  const {
    data: movements = [],
    isLoading: isMovementsLoading,
    refetch: refetchMovements,
  } = useQuery<InventoryMovement[]>({
    queryKey: ['inventory-movements', id],
    queryFn: () => api.get<InventoryMovement[]>(`/inventory/${id}/movements`),
    enabled: !!id,
  });

  const handleRefresh = async () => {
    await Promise.all([refetchItem(), refetchMovements()]);
  };

  const handleOpenMovement = (type: 'in' | 'out' | 'adjustment') => {
    setMovementType(type);
    setMovementModalVisible(true);
  };

  const handleMovementSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['inventory-item', id] });
    queryClient.invalidateQueries({ queryKey: ['inventory-movements', id] });
    queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
    queryClient.invalidateQueries({ queryKey: ['inventory-summary'] });
    queryClient.invalidateQueries({ queryKey: ['inventory-shopping-list'] });
  };

  const handleDelete = () => {
    Alert.alert(
      'Excluir Insumo',
      `Tem certeza que deseja remover "${item?.name}" do estoque? O histórico será preservado.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/inventory/${id}`);
              queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
              queryClient.invalidateQueries({ queryKey: ['inventory-summary'] });
              Alert.alert('Sucesso', 'Insumo removido com sucesso!');
              router.back();
            } catch (err: any) {
              Alert.alert('Erro ao excluir', err.message || 'Não foi possível excluir o insumo.');
            }
          },
        },
      ],
    );
  };

  if (isItemLoading || !item) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <LoadingState message="Carregando detalhes do insumo..." variant="detail" />
      </View>
    );
  }

  const currentStock = item.currentStock || 0;
  const minStock = item.minStock || 0;
  const isOutOfStock = currentStock <= 0;
  const isLowStock = currentStock <= minStock;

  const totalValueCents = Math.round(currentStock * (item.unitCostCents || 0));

  // Visual bar percentage
  const maxRef = Math.max(minStock * 2, minStock + 1, 1);
  const percent = Math.min(100, Math.round((currentStock / maxRef) * 100));

  return (
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

        <View style={styles.headerTitleCol}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.headerCategory}>
            {item.brand ? `${item.brand} • ` : ''}
            {item.category}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleDelete}
          activeOpacity={0.7}
        >
          <Trash2 size={20} color={colors.danger} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isItemLoading || isMovementsLoading}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Main Stock Status Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeaderRow}>
            <Text style={styles.statusCardLabel}>Nível de Estoque</Text>
            {isOutOfStock ? (
              <Badge label="Esgotado" color={colors.danger} />
            ) : isLowStock ? (
              <Badge label="Abaixo do Mínimo" color={colors.warning} />
            ) : (
              <Badge label="Estoque em Dia" color={colors.success} />
            )}
          </View>

          <View style={styles.bigStockRow}>
            <Text style={styles.bigStockNumber}>
              {currentStock.toLocaleString('pt-PT')}
            </Text>
            <Text style={styles.bigStockUnit}>{item.unit}</Text>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${Math.max(4, percent)}%`,
                  backgroundColor: isOutOfStock
                    ? colors.danger
                    : isLowStock
                    ? colors.warning
                    : colors.success,
                },
              ]}
            />
          </View>

          <View style={styles.stockMetaRow}>
            <Text style={styles.stockMetaText}>
              Estoque Mínimo: <Text style={styles.stockMetaBold}>{minStock} {item.unit}</Text>
            </Text>
            {item.idealStock ? (
              <Text style={styles.stockMetaText}>
                Ideal: <Text style={styles.stockMetaBold}>{item.idealStock} {item.unit}</Text>
              </Text>
            ) : null}
            <Text style={styles.stockMetaText}>
              Valor Total: <Text style={styles.stockMetaBold}>{formatCurrency(totalValueCents)}</Text>
            </Text>
          </View>

          {/* Quick Movement Action Buttons */}
          <View style={styles.actionButtonsRow}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnIn]}
              activeOpacity={0.8}
              onPress={() => handleOpenMovement('in')}
            >
              <ArrowDownRight size={16} color={colors.success} strokeWidth={2.4} />
              <Text style={[styles.actionBtnText, { color: colors.success }]}>
                Entrada
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnOut]}
              activeOpacity={0.8}
              onPress={() => handleOpenMovement('out')}
            >
              <ArrowUpRight size={16} color={colors.danger} strokeWidth={2.4} />
              <Text style={[styles.actionBtnText, { color: colors.danger }]}>
                Saída
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnAdj]}
              activeOpacity={0.8}
              onPress={() => handleOpenMovement('adjustment')}
            >
              <Sliders size={16} color={colors.primary} strokeWidth={2.4} />
              <Text style={[styles.actionBtnText, { color: colors.primary }]}>
                Ajustar
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Details Grid Card */}
        <View style={styles.detailsCard}>
          <Text style={styles.cardSectionTitle}>Informações de Custo & Despensa</Text>

          <View style={styles.detailRow}>
            <Package size={16} color={colors.textSecondary} />
            <Text style={styles.detailLabel}>Custo Unitário:</Text>
            <Text style={styles.detailValue}>
              {item.unitCostCents > 0
                ? `${(item.unitCostCents / 100 < 0.01 ? (item.unitCostCents / 100).toFixed(4) : (item.unitCostCents / 100).toFixed(2)).replace('.', ',')} € / ${item.unit}${item.unit === 'g' ? ` (~ ${((item.unitCostCents * 1000) / 100).toFixed(2).replace('.', ',')} €/kg)` : ''}`
                : 'Não informado'}
            </Text>
          </View>

          {item.packageSize && item.packageCostCents ? (
            <View style={styles.detailRow}>
              <Package size={16} color={colors.textSecondary} />
              <Text style={styles.detailLabel}>Embalagem Fechada:</Text>
              <Text style={styles.detailValue}>
                {item.packageSize} {item.unit} por {formatCurrency(item.packageCostCents)}
              </Text>
            </View>
          ) : null}

          {item.location ? (
            <View style={styles.detailRow}>
              <MapPin size={16} color={colors.textSecondary} />
              <Text style={styles.detailLabel}>Localização:</Text>
              <Text style={styles.detailValue}>{item.location}</Text>
            </View>
          ) : null}

          {item.supplier ? (
            <View style={styles.detailRow}>
              <Truck size={16} color={colors.textSecondary} />
              <Text style={styles.detailLabel}>Fornecedor:</Text>
              <Text style={styles.detailValue}>{item.supplier}</Text>
            </View>
          ) : null}

          {item.expiryDate ? (
            <View style={styles.detailRow}>
              <Calendar size={16} color={colors.textSecondary} />
              <Text style={styles.detailLabel}>Validade do Lote:</Text>
              <Text style={styles.detailValue}>{item.expiryDate}</Text>
            </View>
          ) : null}

          {item.notes ? (
            <View style={styles.detailRow}>
              <FileText size={16} color={colors.textSecondary} />
              <Text style={styles.detailLabel}>Notas:</Text>
              <Text style={styles.detailValue}>{item.notes}</Text>
            </View>
          ) : null}
        </View>

        {/* Movements History */}
        <View style={styles.movementsSection}>
          <Text style={styles.sectionHeaderTitle}>Extrato de Movimentações</Text>

          {movements.length === 0 ? (
            <View style={styles.emptyMovementsCard}>
              <Text style={styles.emptyMovementsText}>
                Nenhuma movimentação registrada até o momento.
              </Text>
            </View>
          ) : (
            <View style={styles.movementsList}>
              {movements.map((m) => {
                const isIn = m.type === 'in';
                const isOut = m.type === 'out';

                const dateStr = m.date
                  ? new Date(m.date).toLocaleDateString('pt-PT', {
                      day: '2-digit',
                      month: '2-digit',
                      year: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '';

                return (
                  <View key={m.id} style={styles.movementItem}>
                    <View
                      style={[
                        styles.movementIconCircle,
                        isIn
                          ? styles.movementIconIn
                          : isOut
                          ? styles.movementIconOut
                          : styles.movementIconAdj,
                      ]}
                    >
                      {isIn ? (
                        <ArrowDownRight size={16} color={colors.success} />
                      ) : isOut ? (
                        <ArrowUpRight size={16} color={colors.danger} />
                      ) : (
                        <Sliders size={16} color={colors.primary} />
                      )}
                    </View>

                    <View style={styles.movementDetailsCol}>
                      <View style={styles.movementTopRow}>
                        <Text style={styles.movementReasonText}>
                          {m.reason === 'compra'
                            ? 'Compra / Reposição'
                            : m.reason === 'producao'
                            ? 'Uso em Produção'
                            : m.reason === 'perda_validade'
                            ? 'Validade Vencida'
                            : m.reason === 'descarte'
                            ? 'Avaria / Descarte'
                            : m.reason === 'saldo_inicial'
                            ? 'Cadastro Inicial'
                            : m.reason === 'ajuste_inventario'
                            ? 'Contagem Física'
                            : m.reason || 'Movimentação'}
                        </Text>
                        <Text
                          style={[
                            styles.movementQtyText,
                            isIn
                              ? { color: colors.success }
                              : isOut
                              ? { color: colors.danger }
                              : { color: colors.primaryDark },
                          ]}
                        >
                          {isIn ? '+' : isOut ? '-' : ''}
                          {m.quantity} {m.unit}
                        </Text>
                      </View>

                      <View style={styles.movementBottomRow}>
                        <Text style={styles.movementDateText}>{dateStr}</Text>
                        <Text style={styles.movementStockFlowText}>
                          {m.previousStock} → {m.newStock} {m.unit}
                          {m.costCents ? ` • ${formatCurrency(m.costCents)}` : ''}
                        </Text>
                      </View>

                      {m.notes ? (
                        <Text style={styles.movementNotesText}>"{m.notes}"</Text>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Movement Modal */}
      <StockMovementModal
        visible={movementModalVisible}
        item={item}
        initialType={movementType}
        onClose={() => setMovementModalVisible(false)}
        onSuccess={handleMovementSuccess}
      />
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
  headerTitleCol: {
    flex: 1,
    paddingHorizontal: 12,
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
  deleteButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#f7c2be',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 14,
  },
  statusCard: {
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: 16,
  },
  statusHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusCardLabel: {
    fontSize: 12,
    color: colors.textMuted,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  bigStockRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 8,
    marginBottom: 10,
    gap: 6,
  },
  bigStockNumber: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.primaryDark,
    letterSpacing: -0.5,
  },
  bigStockUnit: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: colors.surface,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  stockMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingTop: 4,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface,
    gap: 8,
  },
  stockMetaText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  stockMetaBold: {
    fontWeight: '700',
    color: colors.primaryDark,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
  },
  actionBtnIn: {
    backgroundColor: '#eaf8ef',
    borderColor: '#b6e6c4',
  },
  actionBtnOut: {
    backgroundColor: '#fdeeee',
    borderColor: '#f7c2be',
  },
  actionBtnAdj: {
    backgroundColor: '#fff6e9',
    borderColor: '#edd5b8',
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  detailsCard: {
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: 16,
    gap: 10,
  },
  cardSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primaryDark,
    marginBottom: 4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  detailValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: colors.primaryDark,
    textAlign: 'right',
  },
  movementsSection: {
    marginTop: 6,
  },
  sectionHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primaryDark,
    marginBottom: 10,
  },
  emptyMovementsCard: {
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: 24,
    alignItems: 'center',
  },
  emptyMovementsText: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  movementsList: {
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  movementItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface,
  },
  movementIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  movementIconIn: {
    backgroundColor: '#eaf8ef',
  },
  movementIconOut: {
    backgroundColor: '#fdeeee',
  },
  movementIconAdj: {
    backgroundColor: '#fff6e9',
  },
  movementDetailsCol: {
    flex: 1,
  },
  movementTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  movementReasonText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  movementQtyText: {
    fontSize: 14,
    fontWeight: '800',
  },
  movementBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  movementDateText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  movementStockFlowText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  movementNotesText: {
    fontSize: 11,
    color: colors.caramel,
    fontStyle: 'italic',
    marginTop: 4,
  },
});
