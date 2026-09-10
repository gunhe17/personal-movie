import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { COLORS, TYPOGRAPHY } from '@/shared/constants/theme';

export interface FieldNoteConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  /** 파괴적 액션(되돌리기 어려움) — 확인 버튼을 위험 색으로. */
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const CARD_W = 290;
// 다크 필드노트 정체성 — 네이비 카드 + 블루 액센트(홈 녹음 버튼과 통일), 파괴적 액션만 레드.
const FN = COLORS.fieldnoteDark;
const CARD_BG = '#252933'; // 홈 카드 톤(딥 잉크 위 elevated)
const BLUE = '#4B7BEC'; // 녹음/주요 액션
const CANCEL_BG = 'rgba(255,255,255,0.06)';

/**
 * 필드노트 확인 모달.
 *
 * 다크 필드노트 공간 톤(네이비 카드 · 블루 confirm · spring 등장)으로, 네이티브 Alert 를
 * 대체해 홈·상세·시트와 결을 맞춘다. 단일 확인/취소 용도 — 선언형(visible) API.
 */
export function FieldNoteConfirmModal({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive = false,
  onConfirm,
  onCancel,
}: FieldNoteConfirmModalProps) {
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, damping: 22, stiffness: 320, useNativeDriver: true }),
      ]).start();
    } else if (mounted) {
      Animated.timing(fadeAnim, { toValue: 0, duration: 140, useNativeDriver: true }).start(() => {
        setMounted(false);
        scaleAnim.setValue(0.92);
      });
    }
  }, [visible, mounted, fadeAnim, scaleAnim]);

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onCancel}>
      <Animated.View
        style={[styles.overlay, { opacity: fadeAnim }]}
        // close 애니메이션 동안(visible=false 이후) 탭으로 인한 의도치 않은 onConfirm 차단.
        pointerEvents={visible ? 'auto' : 'none'}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{message}</Text>
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.confirmBtn, destructive && styles.confirmDestructive]}
              activeOpacity={0.85}
              onPress={onConfirm}
            >
              <Text style={styles.confirmText}>{confirmLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.outlineBtn} activeOpacity={0.7} onPress={onCancel}>
              <Text style={styles.outlineText}>{cancelLabel}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.62)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: CARD_W,
    backgroundColor: CARD_BG,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 28,
    elevation: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: FN.text,
    letterSpacing: TYPOGRAPHY.letterSpacing,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: FN.sub,
    letterSpacing: TYPOGRAPHY.letterSpacing,
    textAlign: 'center',
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'column',
    gap: 8,
    marginTop: 22,
    width: '100%',
  },
  confirmBtn: {
    width: '100%',
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: BLUE,
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
  outlineBtn: {
    width: '100%',
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: CANCEL_BG,
  },
  outlineText: {
    fontSize: 15,
    fontWeight: '600',
    color: FN.sub,
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
});
