import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Printer,
  Share2,
  Trash2,
  Calendar,
  Clock,
  Tag,
  AlertTriangle,
  CheckCircle2,
  PackageCheck,
  Building,
} from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '../../src/theme';
import { Card, Badge, Button, LoadingState } from '../../src/components/ui';
import { api } from '../../src/services/api';
import { useAuthStore } from '../../src/stores/auth.store';
import { LabelBatch } from '@koki/types';

export default function LabelDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { company } = useAuthStore();

  const { data: batch, isLoading } = useQuery<LabelBatch>({
    queryKey: ['label-batch-detail', id],
    queryFn: () => api.get<LabelBatch>(`/labels/batches/${id}`),
    enabled: !!id,
  });

  const updateStatusMutation = useMutation({
    mutationFn: (status: string) => api.patch(`/labels/batches/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['label-batch-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['label-batches'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/labels/batches/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['label-batches'] });
      queryClient.invalidateQueries({ queryKey: ['labels-quota'] });
      Alert.alert('Sucesso', 'Lote excluído.');
      router.back();
    },
  });

  if (isLoading || !batch) {
    return <LoadingState message="Carregando dados da etiqueta..." variant="detail" />;
  }

  const handleShare = async () => {
    try {
      const message = `🏷️ *ETIQUETA SANITÁRIA DE VALIDADE*\n\n` +
        `*Empresa:* ${company?.tradeName || 'Koki Confeitaria'}\n` +
        `*Produto:* ${batch.productName}\n` +
        `*Lote:* ${batch.batchCode}\n` +
        `*Fabrico:* ${batch.productionDate}\n` +
        `*Validade:* ${batch.expiryDate}\n` +
        (batch.netWeight ? `*Peso Líquido:* ${batch.netWeight}\n` : '') +
        `*Conservação:* ${batch.storageCondition}\n` +
        (batch.ingredientsText ? `*Ingredientes:* ${batch.ingredientsText}\n` : '') +
        (batch.allergensText ? `*ALÉRGICOS:* ${batch.allergensText}\n` : '') +
        `*Quantidade emitida:* ${batch.quantity} un\n\n` +
        `_Registrado no app Koki._`;

      await Share.share({
        message,
        title: `Etiqueta ${batch.batchCode} - ${batch.productName}`,
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Excluir Lote',
      `Deseja realmente remover o registro do lote ${batch.batchCode}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => deleteMutation.mutate(),
        },
      ],
    );
  };

  const toggleDepleted = () => {
    const newStatus = batch.status === 'depleted' ? 'active' : 'depleted';
    updateStatusMutation.mutate(newStatus);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) + 8 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <ArrowLeft size={22} color={colors.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{batch.batchCode}</Text>
          <Text style={styles.headerSubtitle}>{batch.productName}</Text>
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
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Status & Summary Card */}
        <Card style={styles.summaryCard}>
          <View style={styles.summaryTopRow}>
            <View>
              <Text style={styles.productTitle}>{batch.productName}</Text>
              <Text style={styles.batchSubText}>Código: {batch.batchCode}</Text>
            </View>
            <Badge
              color={
                batch.status === 'expired'
                  ? colors.danger
                  : batch.status === 'expiring_soon'
                  ? colors.warning
                  : batch.status === 'depleted'
                  ? colors.textMuted
                  : colors.success
              }
              label={
                batch.status === 'expired'
                  ? 'Vencido'
                  : batch.status === 'expiring_soon'
                  ? 'Vence em Breve'
                  : batch.status === 'depleted'
                  ? 'Esgotado'
                  : 'Válido'
              }
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.metricsGrid}>
            <View style={styles.metricItem}>
              <Calendar size={15} color={colors.primary} style={{ marginBottom: 4 }} />
              <Text style={styles.metricLabel}>Data Fabrico</Text>
              <Text style={styles.metricValue}>{batch.productionDate}</Text>
            </View>

            <View style={styles.metricItem}>
              <Clock
                size={15}
                color={batch.status === 'expired' ? colors.danger : colors.primary}
                style={{ marginBottom: 4 }}
              />
              <Text style={styles.metricLabel}>Validade</Text>
              <Text
                style={[
                  styles.metricValue,
                  batch.status === 'expired' && { color: colors.danger, fontWeight: '700' },
                ]}
              >
                {batch.expiryDate}
              </Text>
            </View>

            <View style={styles.metricItem}>
              <PackageCheck size={15} color={colors.primary} style={{ marginBottom: 4 }} />
              <Text style={styles.metricLabel}>Qtd. Etiquetas</Text>
              <Text style={styles.metricValue}>{batch.quantity} un</Text>
            </View>
          </View>
        </Card>

        {/* Realistic Printable Sticker Card */}
        <View style={styles.stickerWrapper}>
          <Text style={styles.sectionHeader}>Visual da Etiqueta Impressa</Text>

          <View style={styles.stickerBox}>
            <View style={styles.stickerHeader}>
              <Text style={styles.stickerCompany}>{company?.tradeName || 'KOKI CONFEITARIA'}</Text>
              <Text style={styles.stickerSizeTag}>{batch.labelSize.toUpperCase()}</Text>
            </View>

            <Text style={styles.stickerProduct}>{batch.productName}</Text>

            <View style={styles.stickerMeta}>
              <Text style={styles.stickerBatch}>LOTE: {batch.batchCode}</Text>
              {batch.netWeight && <Text style={styles.stickerWeight}>PESO: {batch.netWeight}</Text>}
            </View>

            <View style={styles.stickerDates}>
              <Text style={styles.stickerDate}>FAB: {batch.productionDate}</Text>
              <Text style={[styles.stickerDate, { color: '#c2312a' }]}>VAL: {batch.expiryDate}</Text>
            </View>

            {batch.ingredientsText && (
              <Text style={styles.stickerIngredients}>
                <Text style={{ fontWeight: 'bold' }}>Ingredientes: </Text>
                {batch.ingredientsText}
              </Text>
            )}

            {batch.allergensText && (
              <Text style={styles.stickerAllergens}>
                ALÉRGICOS: {batch.allergensText}
              </Text>
            )}

            <Text style={styles.stickerStorage}>Conservação: {batch.storageCondition}</Text>

            <View style={styles.stickerBarcode}>
              <Text style={styles.barcodeLines}>|||| | ||||| || |||||| | |||| ||| ||||</Text>
              <Text style={styles.barcodeText}>{batch.batchCode}</Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionSection}>
          <Button
            title="Compartilhar Dados da Etiqueta"
            onPress={handleShare}
            style={{ marginBottom: spacing.sm }}
          />

          <TouchableOpacity
            style={styles.toggleDepletedButton}
            onPress={toggleDepleted}
            activeOpacity={0.8}
          >
            <Text style={styles.toggleDepletedText}>
              {batch.status === 'depleted'
                ? 'Reativar Lote como Válido'
                : 'Marcar Lote como Esgotado / Finalizado'}
            </Text>
          </TouchableOpacity>
        </View>
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
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  deleteButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#fdeeed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
    fontFamily: 'Courier',
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
    paddingBottom: 40,
  },
  summaryCard: {
    padding: spacing.md,
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  summaryTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  productTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  batchSubText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    fontFamily: 'Courier',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#f5ebe0',
    marginVertical: spacing.md,
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  metricItem: {
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginBottom: 2,
  },
  metricValue: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  stickerWrapper: {
    marginBottom: spacing.md,
  },
  sectionHeader: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
  },
  stickerBox: {
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#888',
    padding: spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  stickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#222',
    paddingBottom: 4,
    marginBottom: 6,
  },
  stickerCompany: {
    fontSize: 10,
    fontWeight: '800',
    color: '#000',
    letterSpacing: 0.5,
  },
  stickerSizeTag: {
    fontSize: 8,
    fontWeight: '700',
    backgroundColor: '#eee',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 2,
  },
  stickerProduct: {
    fontSize: 16,
    fontWeight: '900',
    color: '#000',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  stickerMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  stickerBatch: {
    fontSize: 10,
    fontWeight: '800',
    fontFamily: 'Courier',
    color: '#000',
  },
  stickerWeight: {
    fontSize: 10,
    fontWeight: '800',
    color: '#000',
  },
  stickerDates: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#222',
    padding: 6,
    marginBottom: 6,
  },
  stickerDate: {
    fontSize: 11,
    fontWeight: '800',
    color: '#000',
  },
  stickerIngredients: {
    fontSize: 9,
    color: '#333',
    lineHeight: 12,
    marginBottom: 4,
  },
  stickerAllergens: {
    fontSize: 9,
    fontWeight: '900',
    color: '#000',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  stickerStorage: {
    fontSize: 9,
    fontStyle: 'italic',
    color: '#555',
    marginBottom: 8,
  },
  stickerBarcode: {
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#222',
    paddingTop: 6,
  },
  barcodeLines: {
    fontSize: 15,
    letterSpacing: 2,
    fontWeight: '900',
    fontFamily: 'Courier',
    color: '#000',
  },
  barcodeText: {
    fontSize: 9,
    fontWeight: '700',
    fontFamily: 'Courier',
    color: '#555',
    marginTop: 2,
  },
  actionSection: {
    marginTop: spacing.sm,
  },
  toggleDepletedButton: {
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
  },
  toggleDepletedText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.primary,
  },
});
