import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING } from '@/shared/constants/theme';
import { DK } from '../theme';
import { s } from '@/shared/utils/scale';
import { PROCESSING_STEP_LABELS } from '../constants';

export interface FailedScreenProps {
  sessionInfo: string;
  failedStep: string | null | undefined;
  onRetry: () => void;
  isRetrying: boolean;
  onBack: () => void;
}

const ICON_SIZE = 64;
const ACCENT_COLOR = COLORS.error;

/**
 * 분석 실패 화면. ProcessingScreen 과 같은 라벤더 그라데이션 위에
 * 정적인 alert 아이콘과 친근한 메시지, [다시 시도] CTA + 뒤로가기.
 */
export function FailedScreen({
  failedStep,
  onRetry,
  isRetrying,
  onBack,
}: FailedScreenProps) {
  const failedLabel = failedStep
    ? (PROCESSING_STEP_LABELS[failedStep] ?? failedStep)
    : '분석';

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[DK.surface, DK.bg]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={onBack}
            style={styles.headerBtn}
            activeOpacity={0.6}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={24} color={DK.textSec} />
          </TouchableOpacity>
        </View>

        <View style={styles.center}>
          <View style={styles.iconWrap}>
            <Ionicons name="alert-circle" size={ICON_SIZE} color={ACCENT_COLOR} />
          </View>

          <Text style={styles.title}>분석에 실패했어요</Text>
          <Text style={styles.subtitle}>
            {`'${failedLabel}' 단계에서 문제가 발생했어요.\n다시 시도해 보시거나 잠시 후에 시도해 주세요.`}
          </Text>

          <TouchableOpacity
            style={[styles.retryBtn, isRetrying && styles.retryBtnLoading]}
            onPress={onRetry}
            disabled={isRetrying}
            activeOpacity={0.85}
          >
            {isRetrying ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <>
                <Ionicons name="refresh" size={s(18)} color={COLORS.white} />
                <Text style={styles.retryBtnText}>다시 시도</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
  header: {
    height: s(48),
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: s(8),
  },
  headerBtn: {
    width: s(40),
    height: s(40),
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    marginTop: -s(48),
  },
  iconWrap: {
    marginBottom: s(20),
  },
  title: {
    fontSize: s(18),
    fontWeight: '700',
    color: DK.text,
    letterSpacing: TYPOGRAPHY.letterSpacing,
    marginBottom: s(8),
  },
  subtitle: {
    fontSize: s(13),
    color: DK.textSec,
    letterSpacing: TYPOGRAPHY.letterSpacing,
    textAlign: 'center',
    lineHeight: s(20),
    marginBottom: s(28),
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(8),
    backgroundColor: COLORS.fieldnote,
    paddingHorizontal: s(28),
    height: s(48),
    minWidth: s(140),
    borderRadius: 12,
  },
  retryBtnLoading: {
    opacity: 0.7,
  },
  retryBtnText: {
    fontSize: s(15),
    fontWeight: '600',
    color: COLORS.white,
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
});
