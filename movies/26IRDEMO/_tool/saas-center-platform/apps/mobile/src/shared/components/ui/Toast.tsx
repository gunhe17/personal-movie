import { useEffect, useRef, useCallback } from 'react';
import { Text, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, RADIUS, SPACING } from '@/shared/constants/theme';

type ToastType = 'success' | 'error';

interface ToastProps {
  visible: boolean;
  type: ToastType;
  message: string;
  onHide: () => void;
  duration?: number;
}

const ICON: Record<ToastType, React.ComponentProps<typeof Ionicons>['name']> = {
  success: 'checkmark-circle',
  error: 'alert-circle',
};

const BG: Record<ToastType, string> = {
  success: COLORS.gray[900],
  error: COLORS.error,
};

export function Toast({ visible, type, message, onHide, duration = 2000 }: ToastProps) {
  const translateY = useRef(new Animated.Value(-80)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const hide = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: -80, duration: 250, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => onHide());
  }, [onHide]);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, damping: 18, stiffness: 200, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();

      const timer = setTimeout(hide, duration);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[styles.container, { backgroundColor: BG[type], transform: [{ translateY }], opacity }]}
      pointerEvents="none"
    >
      <Ionicons name={ICON[type]} size={18} color={COLORS.white} />
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: SPACING.lg,
    right: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: RADIUS.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 9999,
  },
  text: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.white,
    letterSpacing: TYPOGRAPHY.letterSpacing,
    flex: 1,
  },
});
