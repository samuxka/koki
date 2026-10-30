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
import { useQuery } from '@tanstack/react-query';
import { colors, spacing, typography, borderRadius } from '../src/theme';
import { Card } from '../src/components/ui/Card';
import { Button } from '../src/components/ui/Button';
import { KokiCookie } from '../src/components/ui/KokiCookie';
import { PlansModal } from '../src/components/PlansModal';
import { api } from '../src/services/api';
import { useAuthStore } from '../src/stores/auth.store';
import { formatDate } from '../src/utils/formatters';
import { EntitlementsResponse } from '@koki/types';
import {
  User,
  Store,
  Crown,
  Settings,
  LogOut,
  Mail,
  Phone,
  Shield,
  ChevronRight,
} from 'lucide-react-native';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, company, logout } = useAuthStore();
  const [plansModalVisible, setPlansModalVisible] = useState(false);

  const { data: entitlements } = useQuery<EntitlementsResponse>({
    queryKey: ['company-entitlements'],
    queryFn: () => api.get<EntitlementsResponse>('/entitlements/features'),
  });

  const tier = entitlements?.tier || 'free';
  const tierName =
    tier === 'business' ? 'Koki Business' : tier === 'pro' ? 'Koki Pro' : 'Koki Free';
  const tierDesc =
    tier === 'business'
      ? 'Operações maiores, automação e bot WhatsApp'
      : tier === 'pro'
      ? 'Gestão completa do dia a dia (100 receitas e estoque)'
      : 'Ferramentas essenciais com limites para começar';

  const handleLogout = () => {
    Alert.alert('Encerrar Sessão', 'Deseja realmente sair da sua conta no Koki?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Avatar e Nome */}
      <View style={styles.avatarSection}>
        <View style={styles.avatarBig}>
          <User size={40} color="#ffffff" />
        </View>
        <Text style={styles.userName}>{user?.fullName || 'Confeiteiro'}</Text>
        <Text style={styles.userEmail}>{user?.email}</Text>
      </View>

      {/* Empresa e Papel */}
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <Store size={18} color={colors.primary} />
          <Text style={styles.cardTitle}>Empresa Ativa</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Nome Comercial:</Text>
          <Text style={styles.value}>{company?.tradeName || 'Minha Empresa'}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Tipo de Negócio:</Text>
          <Text style={[styles.value, { textTransform: 'capitalize' }]}>
            {company?.businessType || 'Confeitaria'}
          </Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Moeda Principal:</Text>
          <Text style={styles.value}>{company?.currency || 'EUR'}</Text>
        </View>

        <View style={[styles.row, { alignItems: 'flex-start', marginTop: 4 }]}>
          <Text style={styles.label}>Endereço (Partida):</Text>
          <Text
            style={[
              styles.value,
              { flex: 1, textAlign: 'right', marginLeft: spacing.sm },
              !company?.address?.street && !company?.address?.city && { color: colors.textMuted },
            ]}
            numberOfLines={2}
          >
            {company?.address?.street || company?.address?.city
              ? [
                  company?.address?.street
                    ? `${company.address.street}${company.address.number ? `, ${company.address.number}` : ''}`
                    : null,
                  company?.address?.neighborhood,
                  company?.address?.postalCode
                    ? `${company.address.postalCode}${company.address.city ? ` ${company.address.city}` : ''}`
                    : company?.address?.city,
                ]
                  .filter(Boolean)
                  .join(' - ')
              : 'Não cadastrado (configure abaixo)'}
          </Text>
        </View>
      </Card>

      {/* Plano & Assinatura */}
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <Crown size={18} color={colors.caramel} />
          <Text style={styles.cardTitle}>Plano & Assinatura</Text>
        </View>

        <View style={styles.planBanner}>
          <View style={{ flex: 1, paddingRight: spacing.sm }}>
            <Text style={styles.planName}>{tierName}</Text>
            <Text style={styles.planDesc}>{tierDesc}</Text>
          </View>
          <View
            style={[
              styles.activePill,
              tier === 'business'
                ? { backgroundColor: `${colors.caramel}30` }
                : tier === 'pro'
                ? { backgroundColor: `${colors.primary}20` }
                : undefined,
            ]}
          >
            <Text
              style={[
                styles.activePillText,
                tier !== 'free' ? { color: colors.primaryDark } : undefined,
              ]}
            >
              {tier === 'business' ? 'Business' : tier === 'pro' ? 'Pro Ativo' : 'Ativo'}
            </Text>
          </View>
        </View>

        <Button
          title={tier === 'business' ? 'Gerenciar Plano' : 'Ver Planos & Fazer Upgrade'}
          variant="secondary"
          onPress={() => setPlansModalVisible(true)}
          style={styles.upgradeBtn}
        />
      </Card>

      {/* Ações e Navegações */}
      <Card style={styles.card}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => router.push('/settings')}
          style={styles.navRow}
        >
          <View style={styles.navLeft}>
            <Settings size={18} color={colors.primary} />
            <Text style={styles.navTitle}>Configurações & Endereço da Empresa</Text>
          </View>
          <ChevronRight size={18} color={colors.textMuted} />
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={handleLogout}
          style={styles.navRow}
        >
          <View style={styles.navLeft}>
            <LogOut size={18} color={colors.danger} />
            <Text style={[styles.navTitle, { color: colors.danger }]}>Sair da Conta</Text>
          </View>
          <ChevronRight size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </Card>

      <View style={styles.brandFooter}>
        <KokiCookie size={32} variant="brown" />
        <Text style={styles.versionText}>Koki Mobile v1.0.0 • SaaS de Gestão</Text>
      </View>

      <PlansModal
        visible={plansModalVisible}
        onClose={() => setPlansModalVisible(false)}
        initialTier="pro"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
    backgroundColor: colors.background,
  },
  avatarSection: {
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  avatarBig: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  userName: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  userEmail: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
    marginTop: 2,
  },
  card: {
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs + 2,
  },
  label: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
  },
  value: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  planBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  planName: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  planDesc: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  activePill: {
    backgroundColor: `${colors.success}20`,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  activePillText: {
    fontSize: 10,
    fontWeight: typography.weights.bold,
    color: colors.success,
  },
  upgradeBtn: {
    marginTop: spacing.xs,
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  navLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  navTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  brandFooter: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
    gap: spacing.xs,
  },
  versionText: {
    textAlign: 'center',
    fontSize: 11,
    color: colors.textMuted,
  },
});
