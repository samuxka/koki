import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography, borderRadius } from '../../theme';
import { useAuthStore } from '../../stores/auth.store';
import { usePreferencesStore } from '../../stores/preferences.store';
import { KokiCookie } from './KokiCookie';
import { User, Eye, EyeOff } from 'lucide-react-native';

export const Header: React.FC = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, company } = useAuthStore();
  const { hideValues, toggleHideValues } = usePreferencesStore();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const formattedDate = new Intl.DateTimeFormat('pt-PT', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date());

  const safePaddingTop = Math.max(insets.top, 20) + 8;

  return (
    <View style={[styles.container, { paddingTop: safePaddingTop }]}>
      <View style={styles.left}>
        <View style={styles.brandRow}>
          <View style={styles.cookieCircle}>
            <KokiCookie size={24} variant="brown" />
          </View>
          <View style={styles.titlesCol}>
            <Text style={styles.greeting} numberOfLines={1}>
              {getGreeting()},{' '}
              <Text style={styles.userName}>{user?.fullName?.split(' ')[0] || 'Confeiteiro'}</Text>
            </Text>
            <Text style={styles.companyName} numberOfLines={1}>
              {company?.tradeName || 'Koki Gestão'} • {formattedDate}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={toggleHideValues}
          style={styles.iconButton}
          accessibilityLabel="Ocultar ou exibir valores"
        >
          {hideValues ? (
            <EyeOff size={18} color={colors.primary} />
          ) : (
            <Eye size={18} color={colors.primary} />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => router.push('/profile')}
          style={styles.avatarButton}
          accessibilityLabel="Acessar Perfil"
        >
          <View style={styles.avatar}>
            <User size={16} color="#ffffff" />
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  left: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cookieCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: `${colors.goldenBeige}40`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titlesCol: {
    flex: 1,
    justifyContent: 'center',
  },
  greeting: {
    fontSize: typography.sizes.sm + 1,
    color: colors.textSecondary,
  },
  userName: {
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  companyName: {
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
    marginTop: 1,
    textTransform: 'capitalize',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarButton: {
    marginLeft: 2,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
