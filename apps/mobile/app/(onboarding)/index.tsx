import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing, typography, borderRadius } from '../../src/theme';
import { Input } from '../../src/components/ui/Input';
import { CurrencyInput } from '../../src/components/ui/CurrencyInput';
import { Button } from '../../src/components/ui/Button';
import { KokiLogo } from '../../src/components/ui/KokiLogo';
import { api } from '../../src/services/api';
import { useAuthStore } from '../../src/stores/auth.store';
import { BusinessType } from '@koki/types';
import { Store, Target, Wallet, CheckCircle2 } from 'lucide-react-native';

const businessTypes: { label: string; value: BusinessType; desc: string }[] = [
  { label: 'Confeitaria', value: 'confeitaria', desc: 'Bolos, doces finos e tortas personalizadas' },
  { label: 'Pastelaria', value: 'pastelaria', desc: 'Pastéis artesanais, salgados e folhados' },
  { label: 'Padaria', value: 'padaria', desc: 'Pães artesanais, fermentação natural e biscoitos' },
  { label: 'Outro', value: 'outro', desc: 'Outro ramo alimentício ou gastronômico' },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { setCompany, checkAuth } = useAuthStore();

  const [step, setStep] = useState(1);
  const [tradeName, setTradeName] = useState('');
  const [businessType, setBusinessType] = useState<BusinessType>('confeitaria');
  const [currency, setCurrency] = useState('EUR');
  const [salesGoalCents, setSalesGoalCents] = useState(300000); // 3.000 € default
  const [initialCashAccountName, setInitialCashAccountName] = useState('Caixa Físico');
  const [initialBalanceCents, setInitialBalanceCents] = useState(0);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleNext = () => {
    if (step === 1) {
      if (!tradeName.trim()) {
        setErrorMessage('Informe o nome da sua confeitaria ou padaria.');
        return;
      }
      setErrorMessage('');
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    }
  };

  const handleFinish = async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const data = await api.post<{ company: any; cashAccount: any }>('/companies/onboarding', {
        tradeName: tradeName.trim(),
        businessType,
        currency,
        timezone: 'Europe/Lisbon',
        monthlySalesGoalCents: salesGoalCents,
        initialCashAccountName: initialCashAccountName.trim() || 'Caixa Físico',
        initialBalanceCents,
      });

      await setCompany(data.company);
      await checkAuth();
      router.replace('/(tabs)');
    } catch (err: any) {
      setErrorMessage(err.message || 'Falha ao concluir configuração.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.topLogo}>
        <KokiLogo width={160} variant="brown" />
      </View>

      <View style={styles.stepsHeader}>
        <Text style={styles.stepIndicator}>Passo {step} de 3</Text>
        <View style={styles.stepBars}>
          <View style={[styles.stepBar, step >= 1 && styles.stepBarActive]} />
          <View style={[styles.stepBar, step >= 2 && styles.stepBarActive]} />
          <View style={[styles.stepBar, step >= 3 && styles.stepBarActive]} />
        </View>
      </View>

      {errorMessage ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}

      {step === 1 && (
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Store size={26} color={colors.primary} />
          </View>
          <Text style={styles.title}>Sua Empresa</Text>
          <Text style={styles.subtitle}>
            Como se chama seu negócio e qual o seu foco principal?
          </Text>

          <Input
            label="Nome comercial da confeitaria/padaria *"
            placeholder="Ex: Doce Sonho Confeitaria"
            value={tradeName}
            onChangeText={(t) => {
              setTradeName(t);
              setErrorMessage('');
            }}
          />

          <Text style={styles.fieldLabel}>Tipo de negócio *</Text>
          <View style={styles.typeList}>
            {businessTypes.map((t) => {
              const selected = businessType === t.value;
              return (
                <TouchableOpacity
                  key={t.value}
                  activeOpacity={0.8}
                  onPress={() => setBusinessType(t.value)}
                  style={[styles.typeOption, selected && styles.typeOptionSelected]}
                >
                  <View style={styles.typeOptionHeader}>
                    <Text
                      style={[styles.typeOptionTitle, selected && styles.typeOptionTitleSelected]}
                    >
                      {t.label}
                    </Text>
                    {selected && <CheckCircle2 size={18} color={colors.primary} />}
                  </View>
                  <Text style={styles.typeOptionDesc}>{t.desc}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Button title="Continuar" onPress={handleNext} style={styles.nextBtn} />
        </View>
      )}

      {step === 2 && (
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Target size={26} color={colors.primary} />
          </View>
          <Text style={styles.title}>Moeda e Meta de Vendas</Text>
          <Text style={styles.subtitle}>
            Defina sua meta mensal de vendas para acompanhar o progresso diário.
          </Text>

          <Text style={styles.fieldLabel}>Moeda principal</Text>
          <View style={styles.currencyRow}>
            {['EUR', 'BRL', 'USD'].map((c) => (
              <TouchableOpacity
                key={c}
                activeOpacity={0.8}
                onPress={() => setCurrency(c)}
                style={[styles.currencyBtn, currency === c && styles.currencyBtnSelected]}
              >
                <Text
                  style={[
                    styles.currencyBtnText,
                    currency === c && styles.currencyBtnTextSelected,
                  ]}
                >
                  {c === 'EUR' ? '€ Euro' : c === 'BRL' ? 'R$ Real' : '$ Dólar'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <CurrencyInput
            label="Meta de vendas para este mês"
            cents={salesGoalCents}
            onChangeCents={setSalesGoalCents}
            currency={currency}
          />
          <Text style={styles.hint}>
            Você poderá alterar sua meta de vendas a qualquer momento no início.
          </Text>

          <View style={styles.btnRow}>
            <Button
              title="Voltar"
              variant="outline"
              onPress={() => setStep(1)}
              style={styles.backBtn}
            />
            <Button title="Continuar" onPress={handleNext} style={styles.continueBtn} />
          </View>
        </View>
      )}

      {step === 3 && (
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Wallet size={26} color={colors.primary} />
          </View>
          <Text style={styles.title}>Sua Primeira Caixinha</Text>
          <Text style={styles.subtitle}>
            Organize seu dinheiro criando sua primeira conta de caixa.
          </Text>

          <Input
            label="Nome da caixinha *"
            placeholder="Ex: Caixa Físico ou Gaveta"
            value={initialCashAccountName}
            onChangeText={setInitialCashAccountName}
          />

          <CurrencyInput
            label="Saldo inicial atual (opcional)"
            cents={initialBalanceCents}
            onChangeCents={setInitialBalanceCents}
            currency={currency}
          />
          <Text style={styles.hint}>
            O saldo inicial é gerado como um lançamento de abertura rastreável.
          </Text>

          <View style={styles.btnRow}>
            <Button
              title="Voltar"
              variant="outline"
              onPress={() => setStep(2)}
              style={styles.backBtn}
            />
            <Button
              title="Concluir e Começar"
              loading={loading}
              onPress={handleFinish}
              style={styles.continueBtn}
            />
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: spacing.xl,
    backgroundColor: colors.background,
    justifyContent: 'center',
  },
  topLogo: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  stepsHeader: {
    marginBottom: spacing.xl,
  },
  stepIndicator: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.caramel,
    marginBottom: spacing.xs,
  },
  stepBars: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  stepBar: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  stepBarActive: {
    backgroundColor: colors.primary,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.xl,
    padding: spacing.xxl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: `${colors.caramel}20`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    marginBottom: spacing.xl,
    marginTop: 2,
  },
  errorBox: {
    backgroundColor: `${colors.danger}15`,
    borderColor: `${colors.danger}40`,
    borderWidth: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  errorText: {
    color: colors.danger,
    fontSize: typography.sizes.sm,
  },
  fieldLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.primaryDark,
    marginBottom: spacing.xs,
  },
  typeList: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  typeOption: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  typeOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: `${colors.goldenBeige}20`,
  },
  typeOptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  typeOptionTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  typeOptionTitleSelected: {
    color: colors.primary,
  },
  typeOptionDesc: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  currencyRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  currencyBtn: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
  },
  currencyBtnSelected: {
    borderColor: colors.primary,
    backgroundColor: `${colors.goldenBeige}25`,
  },
  currencyBtnText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  currencyBtnTextSelected: {
    color: colors.primary,
    fontWeight: typography.weights.bold,
  },
  hint: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginBottom: spacing.lg,
  },
  nextBtn: {
    marginTop: spacing.md,
  },
  btnRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  backBtn: {
    flex: 1,
  },
  continueBtn: {
    flex: 2,
  },
});
