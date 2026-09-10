import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, RADIUS } from '@/shared/constants/theme';
import { BottomSheet } from '@/shared/components/ui/BottomSheet';
import { MIN_RECORDING_DURATION_SECONDS } from '../constants';

export interface StopRecordingSheetProps {
  mode: 'normal' | 'short' | null;
  onClose: () => void;
  onConfirm: () => void;
  onSaveOnly: () => void;
  onDelete: () => void;
}

export function StopRecordingSheet({ mode, onClose, onConfirm, onSaveOnly, onDelete }: StopRecordingSheetProps) {
  return (
    <BottomSheet visible={mode !== null} onClose={onClose}>
      <View style={styles.container}>
        <Text style={styles.title}>
          {mode === 'short' ? '녹음이 너무 짧습니다' : '녹음 종료'}
        </Text>
        {mode === 'short' && (
          <Text style={styles.desc}>
            최소 {MIN_RECORDING_DURATION_SECONDS}초 이상 녹음해야 분석이 가능합니다.
          </Text>
        )}

        <View style={styles.actions}>
          {mode === 'normal' ? (
            <>
              <ActionRow
                icon="stop-circle-outline"
                iconColor={COLORS.primary}
                label="녹음 종료"
                desc="녹음을 종료하고 분석을 시작합니다"
                onPress={onConfirm}
              />
              <ActionRow
                icon="save-outline"
                iconColor={COLORS.warning}
                label="저장만 하기"
                desc="분석 없이 녹음 파일만 저장합니다"
                onPress={onSaveOnly}
              />
              <ActionRow
                icon="arrow-back-outline"
                iconColor={COLORS.gray[500]}
                iconBg={COLORS.gray[100]}
                label="계속 녹음"
                desc="녹음을 이어서 계속합니다"
                onPress={onClose}
              />
            </>
          ) : (
            <>
              <ActionRow
                icon="mic-outline"
                iconColor={COLORS.primary}
                label="계속 녹음"
                desc="녹음을 이어서 계속합니다"
                onPress={onClose}
              />
              <ActionRow
                icon="save-outline"
                iconColor={COLORS.warning}
                label="저장만 하기"
                desc="분석 없이 녹음 파일만 저장합니다"
                onPress={onSaveOnly}
              />
              <ActionRow
                icon="trash-outline"
                iconColor={COLORS.error}
                iconBg={COLORS.error + '12'}
                label="삭제"
                labelColor={COLORS.error}
                desc="녹음을 삭제하고 돌아갑니다"
                onPress={onDelete}
              />
            </>
          )}
        </View>
      </View>
    </BottomSheet>
  );
}

function ActionRow({
  icon,
  iconColor,
  iconBg,
  label,
  labelColor,
  desc,
  onPress,
}: {
  icon: string;
  iconColor: string;
  iconBg?: string;
  label: string;
  labelColor?: string;
  desc: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.actionRow} activeOpacity={0.7} onPress={onPress}>
      <View style={[styles.iconWrap, { backgroundColor: iconBg ?? iconColor + '18' }]}>
        <Ionicons name={icon as any} size={22} color={iconColor} />
      </View>
      <View style={styles.actionText}>
        <Text style={[styles.actionLabel, labelColor ? { color: labelColor } : undefined]}>{label}</Text>
        <Text style={styles.actionDesc}>{desc}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.gray[900],
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  desc: {
    fontSize: 14,
    color: COLORS.gray[500],
    lineHeight: 20,
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  actions: {
    gap: 4,
    marginTop: 4,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: RADIUS.md,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    flex: 1,
    gap: 2,
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.gray[900],
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  actionDesc: {
    fontSize: 13,
    color: COLORS.gray[500],
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
});
