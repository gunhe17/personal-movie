import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  TouchableOpacity,
  Animated,
  StyleSheet,
} from 'react-native';
import { COLORS, TYPOGRAPHY, RADIUS, SPACING } from '@/shared/constants/theme';

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel = '확인',
  cancelLabel = '아니요',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, damping: 20, stiffness: 300, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
        setMounted(false);
        scaleAnim.setValue(0.9);
      });
    }
  }, [visible]);

  if (!mounted) return null;

  // close 애니메이션 동안(visible=false 이후) 탭 발생 방지 — race condition으로
  // 의도치 않은 onConfirm 호출이 일어나는 케이스 차단.
  return (
    <Modal visible transparent animationType="none" onRequestClose={onCancel}>
      <Animated.View
        style={[styles.overlay, { opacity: fadeAnim }]}
        pointerEvents={visible ? 'auto' : 'none'}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} activeOpacity={0.7} onPress={onCancel}>
              <Text style={styles.cancelText}>{cancelLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, destructive && styles.confirmDestructive]}
              activeOpacity={0.7}
              onPress={onConfirm}
            >
              <Text style={[styles.confirmText, destructive && styles.confirmDestructiveText]}>
                {confirmLabel}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    // 카드 폭이 320 고정 — 좁은 기기에서도 충돌 없게 최소 여백만 둔다
    paddingHorizontal: 16,
  },
  card: {
    width: 320,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 16,
    gap: 8,
  },
  title: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '600',
    color: COLORS.text.title.default,
    textAlign: 'center',
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.text.body.default,
    textAlign: 'center',
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    // 본문↔버튼 간격 16 = card gap(8) + marginTop(8)
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.gray[100],
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.gray[600],
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  confirmBtn: {
    flex: 1,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
  },
  confirmDestructive: {
    backgroundColor: COLORS.error,
  },
  confirmText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.white,
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  confirmDestructiveText: {
    color: COLORS.white,
  },
});
