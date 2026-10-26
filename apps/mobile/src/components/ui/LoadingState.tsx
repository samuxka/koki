import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography, borderRadius } from '../../theme';
import { SkeletonList, SkeletonDashboard, SkeletonDetail } from './Skeleton';

export interface LoadingStateProps {
  message?: string;
  variant?: 'list' | 'dashboard' | 'detail' | 'cards' | 'default';
  size?: number; // Kept for backward compatibility
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message,
  variant = 'list',
}) => {
  return (
    <View style={styles.container}>
      {/* Optional subtle status indicator */}
      {message && (
        <View style={styles.pillContainer}>
          <View style={styles.statusDot} />
          <Text style={styles.pillText}>{message}</Text>
        </View>
      )}

      {/* Modern Flat Design Skeleton View */}
      {variant === 'dashboard' ? (
        <SkeletonDashboard />
      ) : variant === 'detail' ? (
        <SkeletonDetail />
      ) : (
        <SkeletonList />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  pillContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#ebdccb',
    paddingVertical: 5,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginRight: 6,
  },
  pillText: {
    fontSize: typography.sizes.xs,
    color: colors.primaryDark,
    fontWeight: typography.weights.semibold,
  },
});
