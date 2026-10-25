import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  TouchableWithoutFeedback,
  Modal,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors, typography, borderRadius } from '../theme';
import {
  Plus,
  ShoppingBag,
  Users,
  ArrowLeftRight,
  Package,
} from 'lucide-react-native';

interface SpeedDialFABProps {
  bottomOffset?: number;
}

interface ActionItem {
  key: string;
  label: string;
  icon: any;
  iconColor: string;
  bgColor: string;
  route: string;
}

const ACTION_ITEMS: ActionItem[] = [
  {
    key: 'order',
    label: 'Novo Pedido',
    icon: ShoppingBag,
    iconColor: '#ffffff',
    bgColor: colors.primary,
    route: '/orders/new',
  },
  {
    key: 'customer',
    label: 'Adicionar Cliente',
    icon: Users,
    iconColor: '#ffffff',
    bgColor: colors.primary,
    route: '/customers/new',
  },
  {
    key: 'transfer',
    label: 'Transferência',
    icon: ArrowLeftRight,
    iconColor: '#ffffff',
    bgColor: colors.primary,
    route: '/cash/new-transaction?type=transfer',
  },
  {
    key: 'product',
    label: 'Novo Produto',
    icon: Package,
    iconColor: '#ffffff',
    bgColor: colors.primary,
    route: '/products/new',
  },
];

export const SpeedDialFAB: React.FC<SpeedDialFABProps> = ({ bottomOffset = 64 }) => {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  // Animations
  const animValue = useRef(new Animated.Value(0)).current;

  const openMenu = () => {
    setIsOpen(true);
    animValue.setValue(0);
    Animated.parallel([
      Animated.spring(animValue, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeMenu = (callback?: () => void) => {
    Animated.timing(animValue, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      setIsOpen(false);
      if (callback) callback();
    });
  };

  const handleActionPress = (route: string) => {
    closeMenu(() => {
      router.push(route as any);
    });
  };

  // Rotation for the main FAB icon: 0deg -> 45deg (turns '+' into 'x')
  const rotation = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  const backdropOpacity = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.45],
  });

  const itemsTranslateY = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [24, 0],
  });

  const itemsScale = animValue.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0.6, 0.85, 1],
  });

  const itemsOpacity = animValue.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: [0, 0.5, 1],
  });

  return (
    <>
      {/* 1. Closed State FAB (Rendered directly in tab layout) */}
      {!isOpen && (
        <View
          pointerEvents="box-none"
          style={[styles.floatingRoot, { bottom: bottomOffset + 14 }]}
        >
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={openMenu}
            style={styles.mainFab}
          >
            <Plus size={28} color="#ffffff" />
          </TouchableOpacity>
        </View>
      )}

      {/* 2. Open State Overlay with Modal (covers screen with zero clipping) */}
      <Modal
        visible={isOpen}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={() => closeMenu()}
      >
        <View style={styles.modalFullContainer}>
          {/* Backdrop (tap to close) */}
          <TouchableWithoutFeedback onPress={() => closeMenu()}>
            <Animated.View
              style={[
                styles.modalBackdrop,
                {
                  opacity: backdropOpacity,
                },
              ]}
            />
          </TouchableWithoutFeedback>

          {/* Speed Dial Stack: Actions list above, Main X button below */}
          <View
            pointerEvents="box-none"
            style={[styles.floatingRoot, { bottom: bottomOffset + 14 }]}
          >
            {/* Animated Actions Column */}
            <Animated.View
              style={[
                styles.actionsColumn,
                {
                  opacity: itemsOpacity,
                  transform: [
                    { translateY: itemsTranslateY },
                    { scale: itemsScale },
                  ],
                },
              ]}
            >
              {ACTION_ITEMS.map((item) => {
                const IconComponent = item.icon;

                return (
                  <View key={item.key} style={styles.actionRow}>
                    {/* Action Label Pill */}
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => handleActionPress(item.route)}
                      style={styles.labelPill}
                    >
                      <Text style={styles.labelText} numberOfLines={1}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>

                    {/* Action Circle Button (centered with main FAB) */}
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => handleActionPress(item.route)}
                      style={[styles.actionBtn, { backgroundColor: item.bgColor }]}
                    >
                      <IconComponent size={20} color={item.iconColor} />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </Animated.View>

            {/* Main Trigger Button (Turned into 'X') */}
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={() => closeMenu()}
              style={[styles.mainFab, styles.mainFabActive]}
            >
              <Animated.View style={{ transform: [{ rotate: rotation }] }}>
                <Plus size={28} color="#ffffff" />
              </Animated.View>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  floatingRoot: {
    position: 'absolute',
    right: 18,
    alignItems: 'flex-end',
    zIndex: 9999,
  },
  modalFullContainer: {
    flex: 1,
    position: 'relative',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000000',
  },
  actionsColumn: {
    alignItems: 'flex-end',
    marginBottom: 12,
    gap: 12,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  labelPill: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: borderRadius.md,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#ece4da',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.18,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  labelText: {
    fontSize: 13,
    fontWeight: typography.weights.bold,
    color: colors.primaryDark,
  },
  actionBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    // 5px margin right ensures the 46px circle is mathematically centered with the 56px main button (56 - 46 = 10 / 2 = 5)
    marginRight: 5,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 5,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  mainFab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.38,
        shadowRadius: 6,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  mainFabActive: {
    backgroundColor: colors.primaryDark,
  },
});
