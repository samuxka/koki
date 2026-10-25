import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { colors, borderRadius, spacing } from '../../theme';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: 'elevated' | 'flat' | 'outlined';
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  variant = 'flat',
}) => {
  return (
    <View
      style={[
        styles.base,
        variant === 'outlined' ? styles.outlined : styles.flat,
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.lg,
    padding: 14,
    marginBottom: spacing.sm,
  },
  flat: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  outlined: {
    borderWidth: 1.5,
    borderColor: colors.caramel,
  },
});
