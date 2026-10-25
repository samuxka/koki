import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Platform,
  Share,
  Alert,
} from 'react-native';
import {
  X,
  ShoppingCart,
  Share2,
  AlertTriangle,
  ArrowDownRight,
  PackageCheck,
  ExternalLink,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { ShoppingListResponse, InventoryItem } from '@koki/types';
import { colors, borderRadius, spacing } from '../../theme';
import { formatCurrency } from '../../utils/formatters';
import { Badge, LoadingState, EmptyState } from '../ui';

interface ShoppingListModalProps {
  visible: boolean;
  onClose: () => void;
  onQuickRestock: (item: InventoryItem, suggestedQty: number) => void;
}

export function ShoppingListModal({
  visible,
  onClose,
  onQuickRestock,
}: ShoppingListModalProps) {
  const router = useRouter();
  const { data, isLoading, refetch } = useQuery<ShoppingListResponse>({
    queryKey: ['inventory-shopping-list'],
    queryFn: () => api.get<ShoppingListResponse>('/inventory/shopping-list'),
    enabled: visible,
  });

  const items = data?.items || [];
  const totalCostCents = data?.totalEstimatedCostCents || 0;

  const handleShare = async () => {
    if (items.length === 0) return;

    try {
      const today = new Date().toLocaleDateString('pt-PT');
      let text = `🛒 *Lista de Compras - Koki*\n📅 ${today}\n\n`;

      items.forEach((entry, idx) => {
        const item = entry.item;
        const estCost = entry.estimatedCostCents > 0
          ? ` (~ ${formatCurrency(entry.estimatedCostCents)})`
          : '';
        text += `${idx + 1}. *${item.name}*: comprar ${entry.suggestedBuyQuantity} ${item.unit}${estCost}\n`;
        text += `   (Estoque atual: ${item.currentStock} ${item.unit} | Mín: ${item.minStock} ${item.unit})\n`;
      });

      if (totalCostCents > 0) {
        text += `\n💰 *Total Estimado:* ${formatCurrency(totalCostCents)}`;
      }

      await Share.share({
        message: text,
      });
    } catch (err: any) {
      Alert.alert('Erro ao compartilhar', err.message || 'Não foi possível compartilhar a lista.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.iconCircle}>
                <ShoppingCart size={20} color={colors.primary} />
              </View>
              <View>
                <Text style={styles.title}>Lista de Compras</Text>
                <Text style={styles.subtitle}>
                  {items.length === 1
                    ? '1 insumo abaixo do mínimo'
                    : `${items.length} insumos precisam de reposição`}
                </Text>
              </View>
            </View>

            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Cost Summary Banner */}
          {items.length > 0 && (
            <View style={styles.summaryBanner}>
              <View style={{ flex: 1 }}>
                <Text style={styles.summaryLabel}>Previsão de Custo Total</Text>
                <Text style={styles.summaryAmount}>{formatCurrency(totalCostCents)}</Text>
              </View>
              <TouchableOpacity
                style={styles.shareBtn}
                activeOpacity={0.85}
                onPress={handleShare}
              >
                <Share2 size={16} color="#ffffff" style={{ marginRight: 6 }} />
                <Text style={styles.shareBtnText}>Compartilhar</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* List Content */}
          {isLoading ? (
            <View style={{ paddingVertical: 40 }}>
              <LoadingState message="Calculando insumos em falta..." />
            </View>
          ) : items.length === 0 ? (
            <View style={{ paddingVertical: 40 }}>
              <EmptyState
                icon={<PackageCheck size={46} color={colors.caramel} />}
                title="Estoque 100% em dia!"
                description="Nenhum insumo está abaixo do estoque mínimo no momento. Bom trabalho!"
              />
            </View>
          ) : (
            <FlatList
              data={items}
              keyExtractor={(item) => item.item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
              renderItem={({ item: entry }) => {
                const item = entry.item;
                const isOutOfStock = item.currentStock <= 0;

                return (
                  <View style={styles.itemCard}>
                    <View style={styles.itemCardTop}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={styles.itemName}>{item.name}</Text>
                        <Text style={styles.itemCategory}>
                          {item.brand ? `${item.brand} • ` : ''}
                          {item.category}
                        </Text>
                      </View>

                      {isOutOfStock ? (
                        <Badge label="Esgotado" color={colors.danger} />
                      ) : (
                        <Badge label="Estoque Baixo" color={colors.warning} />
                      )}
                    </View>

                    <View style={styles.itemStockRow}>
                      <View style={styles.stockStatusBadge}>
                        <AlertTriangle
                          size={12}
                          color={isOutOfStock ? colors.danger : colors.warning}
                        />
                        <Text
                          style={[
                            styles.stockStatusText,
                            {
                              color: isOutOfStock
                                ? colors.danger
                                : colors.warning,
                            },
                          ]}
                        >
                          Atual: {item.currentStock} {item.unit} (Mín: {item.minStock} {item.unit})
                        </Text>
                      </View>
                    </View>

                    <View style={styles.itemCardBottom}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.buyQtyLabel}>Comprar sugerido:</Text>
                        <Text style={styles.buyQtyValue}>
                          +{entry.suggestedBuyQuantity} {item.unit}
                          {entry.estimatedCostCents > 0 && (
                            <Text style={styles.buyCostHint}>
                              {' '}
                              (~ {formatCurrency(entry.estimatedCostCents)})
                            </Text>
                          )}
                        </Text>
                      </View>

                      <TouchableOpacity
                        style={styles.quickRestockBtn}
                        activeOpacity={0.8}
                        onPress={() => {
                          onQuickRestock(item, entry.suggestedBuyQuantity);
                        }}
                      >
                        <ArrowDownRight size={14} color={colors.primary} />
                        <Text style={styles.quickRestockBtnText}>Dar Entrada</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              }}
            />
          )}

          {/* Footer Actions */}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            <TouchableOpacity
              style={[styles.footerCloseBtn, { flex: 1.2, marginTop: 0, backgroundColor: '#fff6e9', borderColor: colors.caramel }]}
              onPress={() => {
                onClose();
                router.push('/shopping-list' as any);
              }}
            >
              <ExternalLink size={15} color={colors.primary} style={{ marginRight: 6 }} />
              <Text style={[styles.footerCloseBtnText, { color: colors.primary, fontWeight: '700' }]}>
                Abrir Tela Cheia
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.footerCloseBtn, { flex: 1, marginTop: 0 }]}
              onPress={onClose}
            >
              <Text style={styles.footerCloseBtnText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
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
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    maxHeight: '88%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff6e9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#edd5b8',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  subtitle: {
    fontSize: 12,
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
  summaryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 16,
  },
  summaryLabel: {
    fontSize: 11,
    color: colors.textMuted,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  summaryAmount: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.primaryDark,
    marginTop: 2,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: borderRadius.md,
  },
  shareBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  listContent: {
    paddingBottom: 16,
    gap: 10,
  },
  itemCard: {
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: 12,
  },
  itemCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  itemName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  itemCategory: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  itemStockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  stockStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  stockStatusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  itemCardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.surface,
  },
  buyQtyLabel: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  buyQtyValue: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  buyCostHint: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.caramel,
  },
  quickRestockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fff6e9',
    borderWidth: 1,
    borderColor: '#edd5b8',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: borderRadius.md,
  },
  quickRestockBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  footerCloseBtn: {
    marginTop: 10,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerCloseBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
});
