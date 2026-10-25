import React from 'react';
import { View, Platform, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography } from '../../src/theme';
import { SpeedDialFAB } from '../../src/components/SpeedDialFAB';
import { Home, ShoppingBag, Wallet, Wrench } from 'lucide-react-native';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const bottomPadding = insets.bottom > 0 ? insets.bottom : 8;
  const tabHeight = (Platform.OS === 'ios' ? 52 : 58) + (insets.bottom > 0 ? insets.bottom : 8);

  return (
    <View style={styles.container}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: {
            backgroundColor: '#ffffff',
            borderTopColor: colors.border,
            borderTopWidth: 1,
            height: tabHeight,
            paddingBottom: bottomPadding,
            paddingTop: 8,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: typography.weights.medium,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Início',
            tabBarIcon: ({ color }) => <Home size={22} color={typeof color === 'string' ? color : colors.primary} />,
          }}
        />
        <Tabs.Screen
          name="orders"
          options={{
            title: 'Pedidos',
            tabBarIcon: ({ color }) => <ShoppingBag size={22} color={typeof color === 'string' ? color : colors.primary} />,
          }}
        />
        <Tabs.Screen
          name="cash"
          options={{
            title: 'Caixa',
            tabBarIcon: ({ color }) => <Wallet size={22} color={typeof color === 'string' ? color : colors.primary} />,
          }}
        />
        <Tabs.Screen
          name="tools"
          options={{
            title: 'Ferramentas',
            tabBarIcon: ({ color }) => <Wrench size={22} color={typeof color === 'string' ? color : colors.primary} />,
          }}
        />
      </Tabs>

      {/* Floating Action Button (FAB) with animated speed dial */}
      <SpeedDialFAB bottomOffset={tabHeight} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
