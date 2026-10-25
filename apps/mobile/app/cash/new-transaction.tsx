import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { colors, spacing, typography, borderRadius } from '../../src/theme';
import { Card } from '../../src/components/ui/Card';
import { Input } from '../../src/components/ui/Input';
import { CurrencyInput } from '../../src/components/ui/CurrencyInput';
import { Button } from '../../src/components/ui/Button';
import { api } from '../../src/services/api';
import { useAuthStore } from '../../src/stores/auth.store';
import { CashAccount } from '@koki/types';
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight } from 'lucide-react-native';

const INCOME_CATEGORIES = ['Venda Avulsa', 'Receita Extra', 'Reembolso', 'Outras Receitas'];
const EXPENSE_CATEGORIES = ['Ingredientes', 'Embalagens', 'Salários', 'Contas / Energia / Gás', 'Marketing', 'Outras Despesas'];

export default function NewTransactionScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { company } = useAuthStore();
  const currency = company?.currency || 'EUR';

  const [type, setType] = useState<'income' | 'expense' | 'transfer'>('income');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [destinationAccountId, setDestinationAccountId] = useState('');
  const [category, setCategory] = useState(INCOME_CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [amountCents, setAmountCents] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');

  // Fetch accounts
  const { data: accountsData } = useQuery<CashAccount[] | { items: CashAccount[] }>({
    queryKey: ['cash-accounts-mini'],
    queryFn: () => api.get('/cash/accounts'),
  });

  const accounts: CashAccount[] = Array.isArray(accountsData)
    ? accountsData
    : (accountsData as any)?.items || [];

  const mutation = useMutation({
    mutationFn: async () => {
      if (amountCents <= 0) {
        throw new Error('Informe um valor maior que zero');
      }
      if (!description.trim()) {
        throw new Error('Informe uma descrição para a movimentação');
      }

      const accountId = selectedAccountId || accounts?.[0]?.id;
      if (!accountId) {
        throw new Error('Selecione a caixinha');
      }

      if (type === 'transfer') {
        const destId = destinationAccountId || accounts?.[1]?.id;
        if (!destId) {
          throw new Error('Selecione a caixinha de destino');
        }
        return api.post('/cash/transactions/transfer', {
          sourceAccountId: accountId,
          destinationAccountId: destId,
          amountCents,
          description: description.trim(),
        });
      }

      const endpoint =
        type === 'income' ? '/cash/transactions/income' : '/cash/transactions/expense';
      return api.post(endpoint, {
        cashAccountId: accountId,
        category,
        description: description.trim(),
        amountCents,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-summary'] });
      queryClient.invalidateQueries({ queryKey: ['cash-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      router.back();
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Falha ao registrar movimentação');
    },
  });

  const activeCategories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {errorMessage ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}

      {/* Tipo de Movimentação */}
      <View style={styles.typeSelector}>
        {[
          { label: 'Entrada', val: 'income' as const, icon: ArrowDownLeft, color: colors.success },
          { label: 'Saída', val: 'expense' as const, icon: ArrowUpRight, color: colors.danger },
          { label: 'Transferência', val: 'transfer' as const, icon: ArrowLeftRight, color: colors.caramel },
        ].map((t) => {
          const Icon = t.icon;
          const isSelected = type === t.val;
          return (
            <TouchableOpacity
              key={t.val}
              activeOpacity={0.8}
              onPress={() => {
                setType(t.val);
                setCategory(t.val === 'income' ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0]);
              }}
              style={[
                styles.typeBtn,
                isSelected && { borderColor: t.color, backgroundColor: `${t.color}15` },
              ]}
            >
              <Icon size={18} color={isSelected ? t.color : colors.textMuted} />
              <Text
                style={[
                  styles.typeBtnText,
                  isSelected && { color: t.color, fontWeight: typography.weights.bold },
                ]}
              >
                {t.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Card style={styles.card}>
        <CurrencyInput
          label="Valor da Movimentação *"
          cents={amountCents}
          onChangeCents={setAmountCents}
          currency={currency}
        />

        <Input
          label="Descrição *"
          placeholder="Ex: Compra de chocolate em pó 1kg"
          value={description}
          onChangeText={setDescription}
        />

        {/* Caixinha de Origem */}
        <Text style={styles.fieldLabel}>
          {type === 'transfer' ? 'Caixinha de Origem *' : 'Caixinha *'}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
          {accounts?.map((acc) => {
            const isSelected = (selectedAccountId || accounts[0]?.id) === acc.id;
            return (
              <TouchableOpacity
                key={acc.id}
                onPress={() => setSelectedAccountId(acc.id)}
                style={[styles.chip, isSelected && styles.chipSelected]}
              >
                <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                  {acc.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Caixinha de Destino (se for transferência) */}
        {type === 'transfer' && (
          <View style={{ marginTop: spacing.md }}>
            <Text style={styles.fieldLabel}>Caixinha de Destino *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
              {accounts?.map((acc) => {
                const isSelected = (destinationAccountId || accounts[1]?.id) === acc.id;
                return (
                  <TouchableOpacity
                    key={acc.id}
                    onPress={() => setDestinationAccountId(acc.id)}
                    style={[styles.chip, isSelected && styles.chipSelected]}
                  >
                    <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                      {acc.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Categoria (se não for transferência) */}
        {type !== 'transfer' && (
          <View style={{ marginTop: spacing.md }}>
            <Text style={styles.fieldLabel}>Categoria *</Text>
            <View style={styles.categoryGrid}>
              {activeCategories.map((c) => {
                const isSelected = category === c;
                return (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setCategory(c)}
                    style={[styles.categoryPill, isSelected && styles.categoryPillSelected]}
                  >
                    <Text
                      style={[
                        styles.categoryPillText,
                        isSelected && styles.categoryPillTextSelected,
                      ]}
                    >
                      {c}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        <Button
          title={
            type === 'income'
              ? 'Confirmar Entrada'
              : type === 'expense'
              ? 'Confirmar Saída'
              : 'Realizar Transferência'
          }
          variant={type === 'expense' ? 'danger' : 'primary'}
          loading={mutation.isPending}
          onPress={() => mutation.mutate()}
          style={styles.submitBtn}
        />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
    backgroundColor: colors.background,
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
  typeSelector: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  typeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: '#ffffff',
  },
  typeBtnText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  card: {
    padding: spacing.xl,
  },
  fieldLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.primaryDark,
    marginBottom: spacing.xs,
  },
  chipsRow: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: '#ffffff',
    marginRight: spacing.xs,
  },
  chipSelected: {
    borderColor: colors.primary,
    backgroundColor: `${colors.goldenBeige}30`,
  },
  chipText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
  chipTextSelected: {
    color: colors.primary,
    fontWeight: typography.weights.bold,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  categoryPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: '#ffffff',
  },
  categoryPillSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  categoryPillText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
  categoryPillTextSelected: {
    color: '#ffffff',
    fontWeight: typography.weights.bold,
  },
  submitBtn: {
    marginTop: spacing.xl,
  },
});
