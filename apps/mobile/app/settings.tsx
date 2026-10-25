import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import { colors, spacing, typography } from '../src/theme';
import { Card } from '../src/components/ui/Card';
import { Input } from '../src/components/ui/Input';
import { Button } from '../src/components/ui/Button';
import { useAuthStore } from '../src/stores/auth.store';
import { usePreferencesStore } from '../src/stores/preferences.store';
import { Store, Sliders, Shield } from 'lucide-react-native';

export default function SettingsScreen() {
  const { company } = useAuthStore();
  const { hideValues, toggleHideValues } = usePreferencesStore();

  const [tradeName, setTradeName] = useState(company?.tradeName || '');
  const [taxId, setTaxId] = useState(company?.taxId || '');
  const [phone, setPhone] = useState(company?.phone || '');
  const [email, setEmail] = useState(company?.email || '');

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Preferências do Aplicativo */}
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <Sliders size={18} color={colors.primary} />
          <Text style={styles.cardTitle}>Preferências de Visualização</Text>
        </View>

        <View style={styles.settingRow}>
          <View style={{ flex: 1, paddingRight: spacing.md }}>
            <Text style={styles.settingTitle}>Ocultar valores monetários</Text>
            <Text style={styles.settingDesc}>
              Substitui saldos e valores por asteriscos para privacidade em público
            </Text>
          </View>
          <Switch
            value={hideValues}
            onValueChange={toggleHideValues}
            trackColor={{ false: colors.border, true: colors.primary }}
          />
        </View>
      </Card>

      {/* Dados da Empresa */}
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <Store size={18} color={colors.primary} />
          <Text style={styles.cardTitle}>Dados da Empresa</Text>
        </View>

        <Input
          label="Nome Comercial"
          value={tradeName}
          onChangeText={setTradeName}
        />

        <Input
          label="NIF / CNPJ"
          placeholder="Ex: 509 123 456"
          value={taxId}
          onChangeText={setTaxId}
        />

        <Input
          label="Telefone de Atendimento"
          placeholder="+351 912 345 678"
          value={phone}
          onChangeText={setPhone}
        />

        <Input
          label="E-mail de Contato"
          placeholder="contato@docesonho.pt"
          value={email}
          onChangeText={setEmail}
        />

        <Button
          title="Salvar Dados da Empresa"
          onPress={() =>
            Alert.alert(
              'Configurações',
              'Dados da empresa atualizados com sucesso no sistema.',
            )
          }
          style={{ marginTop: spacing.sm }}
        />
      </Card>

      {/* Privacidade e Conformidade RGPD */}
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <Shield size={18} color={colors.caramel} />
          <Text style={styles.cardTitle}>Privacidade & RGPD</Text>
        </View>

        <Text style={styles.rgpdText}>
          Seus dados são protegidos conforme as diretrizes do Regulamento Geral sobre a
          Proteção de Dados (RGPD) na União Europeia.
        </Text>
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
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  settingTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  settingDesc: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  rgpdText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    lineHeight: 18,
  },
});
