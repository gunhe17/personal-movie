import React from 'react';
import {
  View,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '@/shared/components/ui/Typography';
import { COLORS, TYPOGRAPHY, SPACING } from '@/shared/constants/theme';
import { DK } from '../theme';
import { s } from '@/shared/utils/scale';

export interface PendingAnalysisScreenProps {
  sessionInfo: string;
  totalDuration: number;
  onStartAnalysis: () => void;
  isStarting: boolean;
  onBack: () => void;
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s2 = Math.floor(sec % 60);
  if (m === 0) return `${s2}초`;
  if (s2 === 0) return `${m}분`;
  return `${m}분 ${s2}초`;
}

export function PendingAnalysisScreen({
  sessionInfo,
  totalDuration,
  onStartAnalysis,
  isStarting,
  onBack,
}: PendingAnalysisScreenProps) {
  const insets = useSafeAreaInsets();
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={s(24)} color={DK.text} />
        </TouchableOpacity>
        <Typography variant="title-01" weight="semibold" style={{ color: DK.text }}>
          필드노트
        </Typography>
        <View style={{ width: s(40) }} />
      </View>

      <View style={styles.body}>
        <View style={styles.iconWrap}>
          <Ionicons name="sparkles" size={s(64)} color={DK.accent} />
        </View>

        <Typography
          variant="headline-02"
          weight="semibold"
          className="text-center"
          style={{ color: DK.text }}
        >
          아직 분석되지 않았어요
        </Typography>

        <Typography
          variant="body-02"
          className="mt-2 text-center"
          style={{ color: DK.textSec }}
        >
          {formatDuration(totalDuration)} 녹음을 분석해서{'\n'}
          화자 분리와 AI 요약을 받아보세요
        </Typography>

        {sessionInfo ? (
          <Typography
            variant="label-01"
            className="mt-4 text-center"
            style={{ color: DK.textSec }}
          >
            {sessionInfo}
          </Typography>
        ) : null}
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + s(12) }]}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={onStartAnalysis}
          activeOpacity={0.85}
          disabled={isStarting}
        >
          {isStarting ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <>
              <Ionicons name="sparkles" size={s(18)} color={COLORS.white} />
              <Typography
                variant="body-01"
                weight="semibold"
                className="text-white"
              >
                분석하기
              </Typography>
            </>
          )}
        </TouchableOpacity>
      </View>
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
    backgroundColor: DK.surface,
    borderBottomWidth: 1,
    borderBottomColor: DK.borderSub,
  },
  backBtn: {
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
  iconWrap: {
    marginBottom: s(20),
  },
  footer: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: s(24),
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(8),
    height: s(52),
    borderRadius: 12,
    backgroundColor: COLORS.fieldnote,
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
});
