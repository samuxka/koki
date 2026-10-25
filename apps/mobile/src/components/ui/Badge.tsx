import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { colors, borderRadius, spacing, typography } from '../../theme';
import { OperationalStatus, FinancialStatus } from '@koki/types';

interface BadgeProps {
  label?: string;
  status?: OperationalStatus | FinancialStatus | string;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

const statusLabels: Record<string, string> = {
  pending: 'Pendente',
  in_production: 'Em Produção',
  ready: 'Pronto',
  delivered: 'Entregue',
  canceled: 'Cancelado',
  unpaid: 'Não Pago',
  partial: 'Parcial',
  paid: 'Pago',
};

export const Badge: React.FC<BadgeProps> = ({
  label,
  status,
  color,
  style,
}) => {
  const badgeColor =
    color ||
    (status && (colors.status as any)[status]) ||
    colors.caramel;

  const displayText = label || (status && statusLabels[status]) || status || '';

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: `${badgeColor}18`, borderColor: `${badgeColor}40` },
        style,
      ]}
    >
      <View style={[styles.dot, { backgroundColor: badgeColor }]} />
      <Text style={[styles.text, { color: badgeColor }]}>{displayText}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: spacing.xs + 2,
  },
  text: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
});
