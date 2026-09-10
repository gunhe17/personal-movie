import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '@/shared/components/ui/Typography';
import { ConfirmModal } from '@/shared/components/ui/ConfirmModal';
import { SPACING } from '@/shared/constants/theme';
import { DK } from '../theme';
import { s } from '@/shared/utils/scale';

export interface EmptyNoteScreenProps {
  /** 노트 폐기 — 확인은 화면 내부 ConfirmModal 로 처리. */
  onDelete: () => void;
  onBack: () => void;
}

/**
 * 오디오 청크가 없는(녹음된 음성이 없는) 필드노트용 화면.
 *
 * 청크가 없으면 백엔드 transcribe 가 항상 실패("No audio chunks found")하므로
 * 분석/재시도 진입을 막고, 삭제만 안내한다.
 */
export function EmptyNoteScreen({ onDelete, onBack }: EmptyNoteScreenProps) {
  const [showDelete, setShowDelete] = useState(false);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.iconBtn} hitSlop={8} accessibilityLabel="뒤로" accessibilityRole="button">
          <Ionicons name="chevron-back" size={s(24)} color={DK.text} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setShowDelete(true)}
          style={styles.iconBtn}
          hitSlop={8}
          accessibilityLabel="녹음 삭제"
          accessibilityRole="button"
        >
          <Ionicons name="trash-outline" size={s(22)} color={DK.textSec} />
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        <Ionicons name="mic-off-outline" size={s(56)} color={DK.textMuted} />
        <Typography
          variant="headline-02"
          weight="semibold"
          className="text-center"
          style={{ color: DK.text, marginTop: s(16) }}
        >
          녹음된 음성이 없어요
        </Typography>
        <Typography variant="body-02" className="mt-2 text-center" style={{ color: DK.textSec }}>
          이 녹음엔 분석할 내용이 없어요.{'\n'}삭제할 수 있어요.
        </Typography>
      </View>

      <ConfirmModal
        visible={showDelete}
        title="녹음을 삭제할까요?"
        message="삭제한 녹음은 복구할 수 없어요."
        confirmLabel="삭제"
        cancelLabel="취소"
        destructive
        onConfirm={() => {
          setShowDelete(false);
          onDelete();
        }}
        onCancel={() => setShowDelete(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DK.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: s(12),
  },
  iconBtn: {
    width: s(40),
    height: s(40),
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    paddingBottom: s(80),
  },
});
