import React, { useState, useEffect } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { colors, borderRadius, spacing, typography } from '../../theme';
import { formatCurrency } from '../../utils/formatters';

interface CurrencyInputProps {
  label?: string;
  error?: string;
  cents: number;
  onChangeCents: (cents: number) => void;
  currency?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

export const CurrencyInput: React.FC<CurrencyInputProps> = ({
  label,
  error,
  cents,
  onChangeCents,
  currency = 'EUR',
  containerStyle,
}) => {
  const [displayValue, setDisplayValue] = useState('');

  useEffect(() => {
    setDisplayValue(cents > 0 ? (cents / 100).toFixed(2).replace('.', ',') : '');
  }, [cents]);

  const handleChangeText = (text: string) => {
    // Only numbers
    const cleanNumbers = text.replace(/\D/g, '');
    const numCents = parseInt(cleanNumbers || '0', 10);
    onChangeCents(numCents);
    setDisplayValue(numCents > 0 ? (numCents / 100).toFixed(2).replace('.', ',') : '');
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.inputWrapper, error ? styles.inputError : null]}>
        <Text style={styles.currencyPrefix}>{currency === 'EUR' ? '€' : currency}</Text>
        <TextInput
          keyboardType="numeric"
          value={displayValue}
          onChangeText={handleChangeText}
          placeholder="0,00"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
        />
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.primaryDark,
    marginBottom: spacing.xs,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    minHeight: 48,
  },
  currencyPrefix: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.caramel,
    marginRight: spacing.sm,
  },
  inputError: {
    borderColor: colors.danger,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    paddingVertical: spacing.sm,
  },
  errorText: {
    fontSize: typography.sizes.xs,
    color: colors.danger,
    marginTop: spacing.xs,
  },
});
