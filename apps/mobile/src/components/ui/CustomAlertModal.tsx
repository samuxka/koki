import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  TouchableWithoutFeedback,
  Dimensions,
} from 'react-native';
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  HelpCircle,
  Sparkles,
} from 'lucide-react-native';
import { useAlertStore, AlertButtonConfig, AlertType } from '../../stores/alert.store';
import { colors, borderRadius, typography } from '../../theme';

interface AlertTypeConfig {
  icon: React.ReactNode;
  accentColor: string;
  badgeBg: string;
  badgeBorder: string;
}

function getAlertConfig(type: AlertType): AlertTypeConfig {
  switch (type) {
    case 'success':
      return {
        icon: <CheckCircle2 size={32} color={colors.success} strokeWidth={2.4} />,
        accentColor: colors.success,
        badgeBg: '#eaf8ef',
        badgeBorder: '#b6e6c4',
      };
    case 'danger':
      return {
        icon: <AlertCircle size={32} color={colors.danger} strokeWidth={2.4} />,
        accentColor: colors.danger,
        badgeBg: '#fdeeee',
        badgeBorder: '#f7c2be',
      };
    case 'warning':
      return {
        icon: <AlertTriangle size={30} color={colors.warning} strokeWidth={2.4} />,
        accentColor: colors.warning,
        badgeBg: '#fef7ed',
        badgeBorder: '#fcdbb8',
      };
    case 'confirm':
      return {
        icon: <HelpCircle size={32} color={colors.primary} strokeWidth={2.4} />,
        accentColor: colors.caramel,
        badgeBg: '#fff6e9',
        badgeBorder: '#edd5b8',
      };
    case 'info':
    default:
      return {
        icon: <Sparkles size={30} color={colors.primary} strokeWidth={2.4} />,
        accentColor: colors.primary,
        badgeBg: '#fff6e9',
        badgeBorder: '#edd5b8',
      };
  }
}

export function CustomAlertModal() {
  const currentAlert = useAlertStore((s) => s.currentAlert);
  const hideAlert = useAlertStore((s) => s.hideAlert);

  const [visible, setVisible] = useState(false);
  const [activeAlert, setActiveAlert] = useState(currentAlert);

  const animScale = useRef(new Animated.Value(0.85)).current;
  const animOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (currentAlert) {
      setActiveAlert(currentAlert);
      setVisible(true);
      animScale.setValue(0.85);
      animOpacity.setValue(0);

      Animated.parallel([
        Animated.spring(animScale, {
          toValue: 1,
          friction: 7.5,
          tension: 75,
          useNativeDriver: true,
        }),
        Animated.timing(animOpacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (visible) {
      handleDismiss();
    }
  }, [currentAlert]);

  const handleDismiss = (callback?: () => void) => {
    Animated.parallel([
      Animated.timing(animScale, {
        toValue: 0.9,
        duration: 140,
        useNativeDriver: true,
      }),
      Animated.timing(animOpacity, {
        toValue: 0,
        duration: 140,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setVisible(false);
      setActiveAlert(null);
      hideAlert();
      callback?.();
    });
  };

  const handleButtonPress = (btn: AlertButtonConfig) => {
    handleDismiss(() => {
      btn.onPress?.();
    });
  };

  const handleBackdropPress = () => {
    if (!activeAlert || activeAlert.cancelable === false) return;
    const cancelBtn = activeAlert.buttons.find((b) => b.style === 'cancel');
    handleDismiss(() => {
      if (cancelBtn) {
        cancelBtn.onPress?.();
      } else {
        activeAlert.onDismiss?.();
      }
    });
  };

  if (!visible || !activeAlert) {
    return null;
  }

  const config = getAlertConfig(activeAlert.type);
  const buttons = activeAlert.buttons;

  return (
    <Modal
      transparent
      visible={visible}
      statusBarTranslucent
      animationType="none"
      onRequestClose={handleBackdropPress}
    >
      <TouchableWithoutFeedback onPress={handleBackdropPress}>
        <View style={styles.overlay}>
          <Animated.View
            style={[
              styles.backdrop,
              {
                opacity: animOpacity,
              },
            ]}
          />

          <TouchableWithoutFeedback>
            <Animated.View
              style={[
                styles.card,
                {
                  opacity: animOpacity,
                  transform: [{ scale: animScale }],
                },
              ]}
            >
              {/* Subtle accent bar at top */}
              <View
                style={[
                  styles.topAccentBar,
                  { backgroundColor: config.accentColor },
                ]}
              />

              {/* Brand Halo Icon Badge */}
              <View style={[styles.haloRing, { borderColor: config.badgeBorder }]}>
                <View
                  style={[
                    styles.badgeContainer,
                    {
                      backgroundColor: config.badgeBg,
                      borderColor: config.badgeBorder,
                    },
                  ]}
                >
                  {config.icon}
                </View>
              </View>

              {/* Title & Message */}
              <Text style={styles.title}>{activeAlert.title}</Text>
              {activeAlert.message ? (
                <Text style={styles.message}>{activeAlert.message}</Text>
              ) : null}

              {/* Action Buttons */}
              <View style={styles.buttonsContainer}>
                {buttons.length === 1 ? (
                  <TouchableOpacity
                    style={[
                      styles.button,
                      buttons[0].style === 'destructive'
                        ? styles.destructiveButton
                        : styles.primaryButton,
                    ]}
                    activeOpacity={0.85}
                    onPress={() => handleButtonPress(buttons[0])}
                  >
                    <Text
                      style={[
                        styles.buttonText,
                        styles.primaryButtonText,
                      ]}
                    >
                      {buttons[0].text || 'OK'}
                    </Text>
                  </TouchableOpacity>
                ) : buttons.length === 2 ? (
                  <View style={styles.twoButtonsRow}>
                    {/* Render cancel on left, confirm/action on right if applicable */}
                    {(() => {
                      const cancelIdx = buttons.findIndex((b) => b.style === 'cancel');
                      let leftBtn = buttons[0];
                      let rightBtn = buttons[1];

                      if (cancelIdx === 1) {
                        leftBtn = buttons[1];
                        rightBtn = buttons[0];
                      }

                      return (
                        <>
                          <TouchableOpacity
                            style={[
                              styles.button,
                              styles.halfButton,
                              leftBtn.style === 'cancel'
                                ? styles.cancelButton
                                : leftBtn.style === 'destructive'
                                ? styles.destructiveButton
                                : styles.primaryButton,
                            ]}
                            activeOpacity={0.85}
                            onPress={() => handleButtonPress(leftBtn)}
                          >
                            <Text
                              style={[
                                styles.buttonText,
                                leftBtn.style === 'cancel'
                                  ? styles.cancelButtonText
                                  : styles.primaryButtonText,
                              ]}
                              numberOfLines={1}
                            >
                              {leftBtn.text || 'Cancelar'}
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[
                              styles.button,
                              styles.halfButton,
                              rightBtn.style === 'destructive'
                                ? styles.destructiveButton
                                : rightBtn.style === 'cancel'
                                ? styles.cancelButton
                                : styles.primaryButton,
                            ]}
                            activeOpacity={0.85}
                            onPress={() => handleButtonPress(rightBtn)}
                          >
                            <Text
                              style={[
                                styles.buttonText,
                                rightBtn.style === 'cancel'
                                  ? styles.cancelButtonText
                                  : styles.primaryButtonText,
                              ]}
                              numberOfLines={1}
                            >
                              {rightBtn.text || 'Confirmar'}
                            </Text>
                          </TouchableOpacity>
                        </>
                      );
                    })()}
                  </View>
                ) : (
                  <View style={styles.multiButtonsCol}>
                    {buttons.map((b, idx) => {
                      const isCancel = b.style === 'cancel';
                      const isDestructive = b.style === 'destructive';
                      return (
                        <TouchableOpacity
                          key={idx}
                          style={[
                            styles.button,
                            isCancel
                              ? styles.cancelButton
                              : isDestructive
                              ? styles.destructiveButton
                              : styles.primaryButton,
                          ]}
                          activeOpacity={0.85}
                          onPress={() => handleButtonPress(b)}
                        >
                          <Text
                            style={[
                              styles.buttonText,
                              isCancel
                                ? styles.cancelButtonText
                                : styles.primaryButtonText,
                            ]}
                          >
                            {b.text || 'OK'}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(35, 18, 5, 0.65)',
  },
  card: {
    width: '100%',
    maxWidth: Math.min(width - 56, 350),
    backgroundColor: '#ffffff',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 22,
    paddingHorizontal: 22,
    overflow: 'hidden',
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
  topAccentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  haloRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  badgeContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primaryDark,
    textAlign: 'center',
    marginTop: 14,
    lineHeight: 24,
  },
  message: {
    fontSize: 14,
    fontWeight: '400',
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 21,
    paddingHorizontal: 4,
  },
  buttonsContainer: {
    width: '100%',
    marginTop: 22,
  },
  twoButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
  },
  multiButtonsCol: {
    flexDirection: 'column',
    gap: 10,
    width: '100%',
  },
  button: {
    height: 48,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  halfButton: {
    flex: 1,
  },
  primaryButton: {
    backgroundColor: colors.primary,
  },
  destructiveButton: {
    backgroundColor: colors.danger,
  },
  cancelButton: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  buttonText: {
    fontSize: 15,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  cancelButtonText: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
});
