import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
} from 'react-native';
import { COLORS, TYPOGRAPHY } from '@/shared/constants/theme';

export interface RecordingConfirmModalProps {
  visible: boolean;
  title: string;
  /** 보조 설명 (옵션) */
  message?: string;
  /** 주 버튼 라벨 */
  confirmLabel: string;
  /** 주 버튼 톤 — primary(블루) / danger(빨강) */
  confirmTone?: 'primary' | 'danger';
  /** 보조(되돌리기) 버튼 라벨 — 기본 '계속하기' */
  cancelLabel?: string;
  /** 주 버튼 로딩 — 텍스트 대신 스피너 표시, 닫기/취소 잠금 (저장·분석 진행 중) */
  confirmLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const CONFIRM_BG: Record<'primary' | 'danger', string> = {
  primary: '#2566DD', // 저장하고 종료하기
  danger: COLORS.error, // 취소하기(삭제)
};

/**
 * 녹음 확인 다이얼로그 (다크, 단일 페이지) — 종료/취소 공통.
 *  - 종료: "녹음을 종료할까요?" · [저장하고 종료하기](primary) / [계속하기]
 *  - 취소: "녹음을 취소할까요?" + "…노트가 삭제돼요" · [취소하기](danger) / [계속하기]
 */
export function RecordingConfirmModal({
  visible,
  title,
  message,
  confirmLabel,
  confirmTone = 'primary',
  cancelLabel = '계속하기',
  confirmLoading = false,
  onConfirm,
  onCancel,
}: RecordingConfirmModalProps) {
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

  const content = (
    <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={confirmLoading ? undefined : onCancel}
      />
      <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>
        <Text style={styles.title}>{title}</Text>
        {message ? <Text style={styles.message}>{message}</Text> : null}
        <Pressable style={styles.actions} onPress={(e) => e.stopPropagation()}>
          <TouchableOpacity
            style={[styles.confirmBtn, { backgroundColor: CONFIRM_BG[confirmTone] }]}
            activeOpacity={0.85}
            onPress={onConfirm}
            disabled={confirmLoading}
          >
            {confirmLoading ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Text style={styles.confirmText}>{confirmLabel}</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.outlineBtn, confirmLoading && styles.outlineBtnDisabled]}
            activeOpacity={0.7}
            onPress={onCancel}
            disabled={confirmLoading}
          >
            <Text style={styles.outlineText}>{cancelLabel}</Text>
          </TouchableOpacity>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );

  if (Platform.OS === 'android') {
    return (
      <Modal visible transparent animationType="none" onRequestClose={onCancel} statusBarTranslucent hardwareAccelerated>
        {content}
      </Modal>
    );
  }
  return content;
}

const CARD_W = 280;

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  card: {
    width: CARD_W,
    backgroundColor: '#292D34', // 다크 카드 (이미지 #12)
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
    letterSpacing: TYPOGRAPHY.letterSpacing,
    textAlign: 'center',
  },
  message: {
    fontSize: 13,
    color: COLORS.gray[400],
    letterSpacing: TYPOGRAPHY.letterSpacing,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 6,
  },
  actions: {
    flexDirection: 'column',
    gap: 8,
    marginTop: 20,
    width: '100%',
  },
  confirmBtn: {
    width: '100%',
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  confirmText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.white,
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  outlineBtn: {
    width: '100%',
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.gray[700],
    backgroundColor: 'transparent',
  },
  outlineBtnDisabled: {
    opacity: 0.4,
  },
  outlineText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.gray[200],
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
});
