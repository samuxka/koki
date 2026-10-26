import React, { useEffect, useRef } from 'react';
import {
  View,
  Animated,
  StyleSheet,
  ViewStyle,
  StyleProp,
  DimensionValue,
  ScrollView,
} from 'react-native';
import { colors, spacing, borderRadius } from '../../theme';

export interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 16,
  borderRadius: radius = borderRadius.sm,
  style,
}) => {
  const opacityAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacityAnim, {
          toValue: 0.9,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0.4,
          duration: 750,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();

    return () => animation.stop();
  }, [opacityAnim]);

  return (
    <Animated.View
      style={[
        styles.skeletonBase,
        {
          width,
          height,
          borderRadius: radius,
          opacity: opacityAnim,
        },
        style,
      ]}
    />
  );
};

export const SkeletonCard: React.FC<{ style?: StyleProp<ViewStyle> }> = ({ style }) => {
  return (
    <View style={[styles.card, style]}>
      <View style={styles.cardHeader}>
        <Skeleton width={42} height={42} borderRadius={21} />
        <View style={styles.cardHeaderText}>
          <Skeleton width="65%" height={15} borderRadius={4} />
          <Skeleton width="40%" height={11} borderRadius={4} style={{ marginTop: 6 }} />
        </View>
        <Skeleton width={60} height={20} borderRadius={borderRadius.full} />
      </View>
      <View style={styles.cardDivider} />
      <View style={styles.cardFooter}>
        <Skeleton width="30%" height={12} borderRadius={4} />
        <Skeleton width="25%" height={14} borderRadius={4} />
      </View>
    </View>
  );
};

export const SkeletonList: React.FC = () => {
  return (
    <View style={styles.container}>
      {/* Search & Filter Bar */}
      <View style={styles.filterSection}>
        <Skeleton width="100%" height={44} borderRadius={borderRadius.md} />
        <View style={styles.chipsRow}>
          <Skeleton width={70} height={28} borderRadius={borderRadius.full} style={{ marginRight: 8 }} />
          <Skeleton width={85} height={28} borderRadius={borderRadius.full} style={{ marginRight: 8 }} />
          <Skeleton width={80} height={28} borderRadius={borderRadius.full} style={{ marginRight: 8 }} />
          <Skeleton width={60} height={28} borderRadius={borderRadius.full} />
        </View>
      </View>

      {/* Cards List */}
      <View style={styles.listSection}>
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </View>
    </View>
  );
};

export const SkeletonDashboard: React.FC = () => {
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Monthly Sales Goal Card */}
      <View style={[styles.card, { padding: spacing.lg, marginBottom: spacing.md }]}>
        <View style={styles.goalRow}>
          <View style={{ flex: 1 }}>
            <Skeleton width="50%" height={13} borderRadius={4} />
            <Skeleton width="75%" height={26} borderRadius={6} style={{ marginTop: 8 }} />
            <Skeleton width="40%" height={12} borderRadius={4} style={{ marginTop: 6 }} />
          </View>
          <Skeleton width={72} height={72} borderRadius={36} />
        </View>
        <Skeleton width="100%" height={8} borderRadius={4} style={{ marginTop: 14 }} />
      </View>

      {/* 2 Balance / Stat Cards */}
      <View style={styles.statsRow}>
        <View style={[styles.card, { flex: 1, marginRight: 8, padding: spacing.md }]}>
          <Skeleton width={32} height={32} borderRadius={16} />
          <Skeleton width="60%" height={11} borderRadius={4} style={{ marginTop: 8 }} />
          <Skeleton width="80%" height={18} borderRadius={4} style={{ marginTop: 4 }} />
        </View>
        <View style={[styles.card, { flex: 1, padding: spacing.md }]}>
          <Skeleton width={32} height={32} borderRadius={16} />
          <Skeleton width="60%" height={11} borderRadius={4} style={{ marginTop: 8 }} />
          <Skeleton width="80%" height={18} borderRadius={4} style={{ marginTop: 4 }} />
        </View>
      </View>

      {/* Section Title */}
      <View style={{ marginTop: spacing.lg, marginBottom: spacing.sm, paddingHorizontal: 4 }}>
        <Skeleton width="45%" height={16} borderRadius={4} />
      </View>

      {/* Urgent Orders / Cards */}
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
    </ScrollView>
  );
};

export const SkeletonDetail: React.FC = () => {
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Hero Banner Card */}
      <View style={[styles.card, { padding: spacing.lg, marginBottom: spacing.md }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Skeleton width="60%" height={22} borderRadius={6} />
          <Skeleton width={70} height={22} borderRadius={borderRadius.full} />
        </View>
        <Skeleton width="40%" height={13} borderRadius={4} style={{ marginTop: 10 }} />
        <Skeleton width="100%" height={1} style={{ marginVertical: 14 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Skeleton width="30%" height={14} borderRadius={4} />
          <Skeleton width="35%" height={18} borderRadius={4} />
        </View>
      </View>

      {/* Details Box */}
      <View style={[styles.card, { padding: spacing.lg, marginBottom: spacing.md }]}>
        <Skeleton width="35%" height={15} borderRadius={4} style={{ marginBottom: 14 }} />
        <Skeleton width="100%" height={12} borderRadius={4} style={{ marginBottom: 8 }} />
        <Skeleton width="90%" height={12} borderRadius={4} style={{ marginBottom: 8 }} />
        <Skeleton width="70%" height={12} borderRadius={4} style={{ marginBottom: 14 }} />
        <Skeleton width="100%" height={40} borderRadius={borderRadius.md} />
      </View>

      {/* Action Button */}
      <Skeleton width="100%" height={48} borderRadius={borderRadius.md} style={{ marginTop: 8 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  skeletonBase: {
    backgroundColor: '#ebdccb',
  },
  card: {
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#f0e0cc',
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardHeaderText: {
    flex: 1,
    marginLeft: spacing.md,
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#f5ebe0',
    marginVertical: spacing.sm,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  filterSection: {
    marginBottom: spacing.md,
  },
  chipsRow: {
    flexDirection: 'row',
    marginTop: spacing.sm,
  },
  listSection: {
    flex: 1,
  },
  goalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
});
