import { useEffect, useRef, useState } from 'react';
import {
  View,
  Modal,
  Pressable,
  TouchableOpacity,
  TextInput,
  Animated,
  StyleSheet,
  Keyboard,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Typography } from '@/shared/components/ui/Typography';
import { Toggle } from '@/shared/components/ui/Toggle';
import { COLORS, RADIUS, TYPOGRAPHY } from '@/shared/constants/theme';

export interface NoShowReasonResult {
  note: string;
  isConsumed: boolean;
}

interface NoShowReasonModalProps {
  visible: boolean;
  /** 편집 모드 진입 시 초기 사유 */
  initialNote?: string;
  /** 편집 모드 진입 시 초기 회기 차감 상태 */
  initialIsConsumed?: boolean;
  /** 확인 시 결과 반환. null이면 취소 */
  onConfirm: (result: NoShowReasonResult) => void;
  onCancel: () => void;
}

const MAX_LENGTH = 500;

export function NoShowReasonModal({
  visible,
  initialNote = '',
  initialIsConsumed = false,
  onConfirm,
  onCancel,
}: NoShowReasonModalProps) {
  const [text, setText] = useState(initialNote);
  const [isConsumed, setIsConsumed] = useState(initialIsConsumed);

  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);

  // 모달 열림 시 초기값으로 상태 리셋
  useEffect(() => {
    if (visible) {
      setText(initialNote);
      setIsConsumed(initialIsConsumed);
      setMounted(true);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          damping: 20,
          stiffness: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start(() => {
        setMounted(false);
        scaleAnim.setValue(0.9);
      });
    }
    // initialNote/initialIsConsumed는 visible 토글 시점에만 재반영
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!mounted) return null;

  const handleConfirm = () => {
    Keyboard.dismiss();
    onConfirm({ note: text.trim(), isConsumed });
  };

  const handleCancel = () => {
    Keyboard.dismiss();
    onCancel();
  };

  return (
    <Modal visible transparent animationType="none" onRequestClose={handleCancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <Animated.View
          style={[styles.overlay, { opacity: fadeAnim }]}
          pointerEvents={visible ? 'auto' : 'none'}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={handleCancel} />
          <Animated.View
            style={[styles.card, { transform: [{ scale: scaleAnim }] }]}
          >
            <Typography
              variant="title-01"
              weight="semibold"
              style={styles.title}
            >
              노쇼 사유
            </Typography>
            <Typography
              variant="body-03"
              weight="regular"
              style={styles.message}
            >
              노쇼 사유를 입력해주세요. (선택)
            </Typography>

            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="사유를 입력해주세요"
              placeholderTextColor={COLORS.gray[400]}
              maxLength={MAX_LENGTH}
              multiline
              textAlignVertical="top"
              style={styles.textarea}
            />
            <Typography
              variant="caption-01"
              weight="regular"
              style={styles.counter}
            >
              {text.length}/{MAX_LENGTH}
            </Typography>

            <View style={styles.toggleRow}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Typography
                  variant="body-02"
                  weight="semibold"
                  style={{ color: COLORS.gray[800] }}
                >
                  회기 차감
                </Typography>
                <Typography
                  variant="body-03"
                  weight="regular"
                  style={{ color: COLORS.gray[500], marginTop: 2 }}
                >
                  이번 노쇼를 남은 회기 1회 사용으로 처리해요.
                </Typography>
              </View>
              <Toggle value={isConsumed} onChange={setIsConsumed} />
            </View>

            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                activeOpacity={0.7}
                onPress={handleCancel}
              >
                <Typography
                  variant="body-02"
                  weight="medium"
                  style={{ color: COLORS.gray[600] }}
                >
                  취소
                </Typography>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmBtn}
                activeOpacity={0.7}
                onPress={handleConfirm}
              >
                <Typography
                  variant="body-02"
                  weight="semibold"
                  style={{ color: COLORS.white }}
                >
                  확인
                </Typography>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: 24,
  },
  title: {
    color: COLORS.gray[900],
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  message: {
    color: COLORS.gray[500],
    marginTop: 8,
    marginBottom: 12,
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  textarea: {
    minHeight: 96,
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.gray[900],
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
    backgroundColor: COLORS.white,
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  counter: {
    color: COLORS.gray[400],
    textAlign: 'right',
    marginTop: 4,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray[100],
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 20,
  },
  cancelBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.gray[100],
  },
  confirmBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
  },
});
