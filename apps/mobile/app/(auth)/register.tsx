import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing, typography, borderRadius } from '../../src/theme';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { KokiLogo } from '../../src/components/ui/KokiLogo';
import { useAuthStore } from '../../src/stores/auth.store';
import { User, Mail, Lock, Phone } from 'lucide-react-native';

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuthStore();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleRegister = async () => {
    if (!fullName.trim() || !email.trim() || !password.trim()) {
      setErrorMessage('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    try {
      setLoading(true);
      setErrorMessage('');
      await register(fullName.trim(), email.trim(), password, phone.trim() || undefined);
    } catch (err: any) {
      setErrorMessage(err.message || 'Falha ao criar conta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <KokiLogo width={180} variant="brown" />
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Criar sua conta</Text>
          <Text style={styles.subtitle}>
            Comece a gerenciar sua confeitaria com o Koki
          </Text>

          {errorMessage ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          <Input
            label="Nome completo *"
            placeholder="Ex: Maria Silva"
            value={fullName}
            onChangeText={(t) => {
              setFullName(t);
              setErrorMessage('');
            }}
            leftIcon={<User size={18} color={colors.textMuted} />}
          />

          <Input
            label="E-mail *"
            placeholder="seu@email.com"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              setErrorMessage('');
            }}
            leftIcon={<Mail size={18} color={colors.textMuted} />}
          />

          <Input
            label="Telefone / WhatsApp"
            placeholder="+351 912 345 678"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
            leftIcon={<Phone size={18} color={colors.textMuted} />}
          />

          <Input
            label="Senha (mínimo 6 caracteres) *"
            placeholder="••••••••"
            secureTextEntry
            value={password}
            onChangeText={(t) => {
              setPassword(t);
              setErrorMessage('');
            }}
            leftIcon={<Lock size={18} color={colors.textMuted} />}
          />

          <Button
            title="Criar minha conta"
            onPress={handleRegister}
            loading={loading}
            style={styles.submitBtn}
          />

          <View style={styles.footer}>
            <Text style={styles.footerText}>Já possui uma conta? </Text>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={styles.loginLink}>Fazer login</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.xl,
    padding: spacing.xxl,
    borderWidth: 1,
    borderColor: colors.border,
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
  submitBtn: {
    marginTop: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  footerText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  loginLink: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
});
