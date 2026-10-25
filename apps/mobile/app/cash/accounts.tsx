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
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { colors, spacing, typography, borderRadius } from '../../src/theme';
import { Card } from '../../src/components/ui/Card';
import { Input } from '../../src/components/ui/Input';
import { CurrencyInput } from '../../src/components/ui/CurrencyInput';
import { Button } from '../../src/components/ui/Button';
import { LoadingState } from '../../src/components/ui/LoadingState';
import { api } from '../../src/services/api';
import { useAuthStore } from '../../src/stores/auth.store';
import { usePreferencesStore } from '../../src/stores/preferences.store';
import { formatCurrency } from '../../src/utils/formatters';
import { CashAccount, CashAccountType } from '@koki/types';
import { Wallet, Plus, X, Landmark, PiggyBank, ShieldCheck, Wrench } from 'lucide-react-native';

const ACCOUNT_TYPES: { label: string; val: CashAccountType; icon: any; color: string }[] = [
  { label: 'Caixa Físico', val: 'cash', icon: Wallet, color: '#cc9a52' },
  { label: 'Banco / Conta Corrente', val: 'bank', icon: Landmark, color: '#2980b9' },
  { label: 'Reserva de Emergência', val: 'savings', icon: PiggyBank, color: '#009933' },
  { label: 'Impostos & Taxas', val: 'tax', icon: ShieldCheck, color: '#e67e22' },
  { label: 'Investimentos & Equipamentos', val: 'equipment', icon: Wrench, color: '#8e44ad' },
];

export default function AccountsScreen() {
  const queryClient = useQueryClient();
  const { company } = useAuthStore();
  const { hideValues } = usePreferencesStore();
  const currency = company?.currency || 'EUR';

  const [modalVisible, setModalVisible] = useState(false);
  const [name, setName] = useState('');
  const [selectedType, setSelectedType] = useState<CashAccountType>('cash');
  const [initialBalanceCents, setInitialBalanceCents] = useState(0);
  const [description, setDescription] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const { data: accountsData, isLoading, refetch } = useQuery<CashAccount[] | { items: CashAccount[] }>({
    queryKey: ['cash-accounts-manage'],
    queryFn: () => api.get('/cash/accounts'),
  });

  const accounts: CashAccount[] = Array.isArray(accountsData)
    ? accountsData
    : (accountsData as any)?.items || [];

  const createAccountMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) {
        throw new Error('Informe o nome da caixinha');
      }
      const typeInfo = ACCOUNT_TYPES.find((t) => t.val === selectedType);
      return api.post('/cash/accounts', {
        name: name.trim(),
        type: selectedType,
        icon: 'wallet',
        color: typeInfo?.color || '#cc9a52',
        initialBalanceCents,
        description: description.trim() || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-accounts-manage'] });
      queryClient.invalidateQueries({ queryKey: ['cash-summary'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      setModalVisible(false);
      setName('');
      setInitialBalanceCents(0);
      setDescription('');
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Falha ao criar caixinha');
    },
  });

  if (isLoading && !accounts) {
    return <LoadingState message="Carregando caixinhas..." />;
  }

  const totalConsolidatedCents = (accounts || []).reduce(
    (acc, a) => acc + a.currentBalanceCents,
    0,
  );

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Card style={styles.topCard}>
          <Text style={styles.topCardLabel}>Saldo Total em Caixinhas</Text>
          <Text style={styles.topCardBalance}>
            {formatCurrency(totalConsolidatedCents, currency, hideValues)}
          </Text>
          <Text style={styles.topCardDesc}>
            {accounts?.length || 0} contas financeiras ativas
          </Text>

          <Button
            title="Adicionar Nova Caixinha"
            icon={<Plus size={18} color="#ffffff" />}
            onPress={() => {
              setErrorMessage('');
              setModalVisible(true);
            }}
            style={styles.addBtn}
          />
        </Card>

        <Text style={styles.listSectionTitle}>Suas Caixinhas</Text>

        {accounts?.map((acc) => {
          return (
            <Card key={acc.id} style={styles.accountCard}>
              <View style={styles.accountRow}>
                <View style={[styles.accountIcon, { backgroundColor: `${acc.color}20` }]}>
                  <Wallet size={20} color={acc.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.nameRow}>
                    <Text style={styles.accountName}>{acc.name}</Text>
                    {acc.isDefault && (
                      <View style={styles.defaultBadge}>
                        <Text style={styles.defaultBadgeText}>Principal</Text>
                      </View>
                    )}
                  </View>
                  {acc.description ? (
                    <Text style={styles.accountDesc}>{acc.description}</Text>
                  ) : null}
                </View>

                <Text style={styles.accountBalance}>
                  {formatCurrency(acc.currentBalanceCents, currency, hideValues)}
                </Text>
              </View>
            </Card>
          );
        })}
      </ScrollView>

      {/* Modal - Nova Caixinha */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nova Caixinha</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {errorMessage ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            <Input
              label="Nome da Caixinha *"
              placeholder="Ex: Reserva para Impostos"
              value={name}
              onChangeText={setName}
            />

            <Text style={styles.fieldLabel}>Tipo de Conta</Text>
            <View style={styles.typesRow}>
              {ACCOUNT_TYPES.map((t) => {
                const isSelected = selectedType === t.val;
                return (
                  <TouchableOpacity
                    key={t.val}
                    onPress={() => setSelectedType(t.val)}
                    style={[
                      styles.typeChip,
                      isSelected && { borderColor: t.color, backgroundColor: `${t.color}20` },
                    ]}
                  >
                    <Text
                      style={[
                        styles.typeChipText,
                        isSelected && { color: t.color, fontWeight: typography.weights.bold },
                      ]}
                    >
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <CurrencyInput
              label="Saldo Inicial (opcional)"
              cents={initialBalanceCents}
              onChangeCents={setInitialBalanceCents}
              currency={currency}
            />

            <Input
              label="Descrição / Finalidade"
              placeholder="Ex: Destinado ao pagamento trimestral do IVA"
              value={description}
              onChangeText={setDescription}
            />

            <Button
              title="Salvar Caixinha"
              loading={createAccountMutation.isPending}
              onPress={() => createAccountMutation.mutate()}
              style={{ marginTop: spacing.md }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  topCard: {
    padding: spacing.xl,
    marginBottom: spacing.lg,
  },
  topCardLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  topCardBalance: {
    fontSize: typography.sizes.display,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
    marginVertical: spacing.xs,
  },
  topCardDesc: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  addBtn: {
    marginTop: spacing.xs,
  },
  listSectionTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  accountCard: {
    padding: spacing.md,
    marginBottom: spacing.xs + 2,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  accountIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  accountName: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  defaultBadge: {
    backgroundColor: `${colors.primary}18`,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: borderRadius.sm,
  },
  defaultBadgeText: {
    fontSize: 9,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  accountDesc: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  accountBalance: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.xxl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  errorBox: {
    backgroundColor: `${colors.danger}15`,
    borderColor: `${colors.danger}40`,
    borderWidth: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  errorText: {
    color: colors.danger,
    fontSize: typography.sizes.sm,
  },
  fieldLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.primaryDark,
    marginBottom: spacing.xs,
  },
  typesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  typeChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: '#ffffff',
  },
  typeChipText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
});
