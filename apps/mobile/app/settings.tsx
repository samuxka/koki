import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { colors, spacing, typography, borderRadius } from '../src/theme';
import { Card } from '../src/components/ui/Card';
import { Input } from '../src/components/ui/Input';
import { Button } from '../src/components/ui/Button';
import { api } from '../src/services/api';
import { useAuthStore } from '../src/stores/auth.store';
import { usePreferencesStore } from '../src/stores/preferences.store';
import { Company } from '@koki/types';
import { Store, Sliders, Shield, MapPin } from 'lucide-react-native';

export default function SettingsScreen() {
  const queryClient = useQueryClient();
  const { company, setCompany } = useAuthStore();
  const { hideValues, toggleHideValues } = usePreferencesStore();

  // Dados Gerais da Empresa
  const [tradeName, setTradeName] = useState(company?.tradeName || '');
  const [taxId, setTaxId] = useState(company?.taxId || '');
  const [phone, setPhone] = useState(company?.phone || '');
  const [email, setEmail] = useState(company?.email || '');

  // Endereço da Empresa (Ponto de Partida das Rotas de Entrega)
  const [street, setStreet] = useState(company?.address?.street || '');
  const [number, setNumber] = useState(company?.address?.number || '');
  const [complement, setComplement] = useState(company?.address?.complement || '');
  const [neighborhood, setNeighborhood] = useState(company?.address?.neighborhood || '');
  const [city, setCity] = useState(company?.address?.city || '');
  const [postalCode, setPostalCode] = useState(company?.address?.postalCode || '');

  useEffect(() => {
    if (company) {
      setTradeName(company.tradeName || '');
      setTaxId(company.taxId || '');
      setPhone(company.phone || '');
      setEmail(company.email || '');
      setStreet(company.address?.street || '');
      setNumber(company.address?.number || '');
      setComplement(company.address?.complement || '');
      setNeighborhood(company.address?.neighborhood || '');
      setCity(company.address?.city || '');
      setPostalCode(company.address?.postalCode || '');
    }
  }, [company?.id]);

  const updateCompanyMutation = useMutation({
    mutationFn: async () => {
      if (!tradeName.trim()) {
        throw new Error('O nome comercial da empresa é obrigatório.');
      }

      return api.put<Company>('/companies/current/profile', {
        tradeName: tradeName.trim(),
        taxId: taxId.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        address: {
          street: street.trim() || undefined,
          number: number.trim() || undefined,
          complement: complement.trim() || undefined,
          neighborhood: neighborhood.trim() || undefined,
          city: city.trim() || undefined,
          postalCode: postalCode.trim() || undefined,
        },
      });
    },
    onSuccess: async (updatedCompany) => {
      await setCompany({
        ...(company as Company),
        ...updatedCompany,
      });
      queryClient.invalidateQueries({ queryKey: ['delivery-daily-plan'] });
      Alert.alert(
        'Configurações Salvas!',
        'Os dados e o endereço da empresa foram atualizados. O Planejador de Entregas utilizará este endereço como ponto de partida das rotas.',
      );
    },
    onError: (err: any) => {
      Alert.alert(
        'Erro ao Salvar',
        err.message || 'Não foi possível atualizar os dados da empresa.',
      );
    },
  });

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
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
            label="Nome Comercial *"
            placeholder="Ex: Confeitaria Doce Sonho"
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
            keyboardType="phone-pad"
          />

          <Input
            label="E-mail de Contato"
            placeholder="contato@docesonho.pt"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </Card>

        {/* Endereço da Empresa (Ponto de Partida para Rotas) */}
        <Card style={styles.card}>
          <View style={styles.cardHeader}>
            <MapPin size={18} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Endereço da Empresa</Text>
              <Text style={styles.cardSubtitle}>
                Ponto de partida oficial para cálculo de distância, taxa de entrega e rotas no mapa
              </Text>
            </View>
          </View>

          <Input
            label="Rua / Avenida / Logradouro"
            placeholder="Ex: Avenida da Liberdade"
            value={street}
            onChangeText={setStreet}
          />

          <View style={styles.rowGrid}>
            <View style={{ flex: 1 }}>
              <Input
                label="Número"
                placeholder="Ex: 120"
                value={number}
                onChangeText={setNumber}
              />
            </View>

            <View style={{ flex: 1.3 }}>
              <Input
                label="Complemento / Loja"
                placeholder="Ex: Loja B"
                value={complement}
                onChangeText={setComplement}
              />
            </View>
          </View>

          <Input
            label="Bairro / Freguesia"
            placeholder="Ex: Santo António"
            value={neighborhood}
            onChangeText={setNeighborhood}
          />

          <View style={styles.rowGrid}>
            <View style={{ flex: 1.3 }}>
              <Input
                label="Cidade"
                placeholder="Ex: Lisboa"
                value={city}
                onChangeText={setCity}
              />
            </View>

            <View style={{ flex: 1 }}>
              <Input
                label="Código Postal / CEP"
                placeholder="Ex: 1250-146"
                value={postalCode}
                onChangeText={setPostalCode}
              />
            </View>
          </View>

          <Button
            title="Salvar Dados e Endereço da Empresa"
            loading={updateCompanyMutation.isPending}
            onPress={() => updateCompanyMutation.mutate()}
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
    </KeyboardAvoidingView>
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
    alignItems: 'flex-start',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  cardSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 15,
  },
  rowGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
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
