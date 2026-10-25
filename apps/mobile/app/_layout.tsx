import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from '../src/stores/auth.store';
import { usePreferencesStore } from '../src/stores/preferences.store';
import { colors } from '../src/theme';
import { LoadingState } from '../src/components/ui/LoadingState';
import { CustomAlertModal } from '../src/components/ui/CustomAlertModal';
import { initAlertInterceptor } from '../src/services/alert.service';

// Initialize custom alert interceptor once so all popups match the app's theme
initAlertInterceptor();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // 30 seconds
      retry: 1,
    },
  },
});

function RootNavigation() {
  const { isAuthenticated, needsOnboarding, isLoading, checkAuth } = useAuthStore();
  const { loadPreferences } = usePreferencesStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    checkAuth();
    loadPreferences();
  }, []);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboardingGroup = segments[0] === '(onboarding)';

    if (!isAuthenticated) {
      if (!inAuthGroup) {
        router.replace('/(auth)/login');
      }
    } else if (needsOnboarding) {
      if (!inOnboardingGroup) {
        router.replace('/(onboarding)');
      }
    } else {
      if (inAuthGroup || inOnboardingGroup) {
        router.replace('/(tabs)');
      }
    }
  }, [isAuthenticated, needsOnboarding, isLoading, segments]);

  if (isLoading) {
    return <LoadingState message="Inicializando Koki..." />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="profile"
        options={{
          headerShown: true,
          title: 'Meu Perfil',
          headerTintColor: colors.primaryDark,
          headerStyle: { backgroundColor: colors.background },
        }}
      />
      <Stack.Screen
        name="settings"
        options={{
          headerShown: true,
          title: 'Configurações',
          headerTintColor: colors.primaryDark,
          headerStyle: { backgroundColor: colors.background },
        }}
      />
      <Stack.Screen
        name="orders/new"
        options={{
          presentation: 'modal',
          headerShown: true,
          title: 'Novo Pedido',
          headerTintColor: colors.primaryDark,
          headerStyle: { backgroundColor: colors.background },
        }}
      />
      <Stack.Screen
        name="orders/[id]"
        options={{
          headerShown: true,
          title: 'Detalhes do Pedido',
          headerTintColor: colors.primaryDark,
          headerStyle: { backgroundColor: colors.background },
        }}
      />
      <Stack.Screen
        name="cash/new-transaction"
        options={{
          presentation: 'modal',
          headerShown: true,
          title: 'Nova Movimentação',
          headerTintColor: colors.primaryDark,
          headerStyle: { backgroundColor: colors.background },
        }}
      />
      <Stack.Screen
        name="cash/accounts"
        options={{
          headerShown: true,
          title: 'Caixinhas & Reservas',
          headerTintColor: colors.primaryDark,
          headerStyle: { backgroundColor: colors.background },
        }}
      />
      <Stack.Screen
        name="inventory/index"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="inventory/new"
        options={{
          presentation: 'modal',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="inventory/[id]"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="recipes/index"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="recipes/new"
        options={{
          presentation: 'modal',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="recipes/[id]"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="recipes/edit/[id]"
        options={{
          presentation: 'modal',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="shopping-list/index"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="production-planner/index"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="delivery-planner/index"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="recipe-scaler/index"
        options={{
          headerShown: false,
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        <RootNavigation />
        <CustomAlertModal />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
