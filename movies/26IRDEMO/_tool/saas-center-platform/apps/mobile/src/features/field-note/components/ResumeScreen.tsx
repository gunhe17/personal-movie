import React, { useState } from 'react';
import { View, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { Typography } from '@/shared/components/ui/Typography';
import { COLORS } from '@/shared/constants/theme';
import { FieldNoteConfirmModal } from './FieldNoteConfirmModal';
import { s } from '@/shared/utils/scale';

export interface ResumeScreenProps {
  sessionInfo: string;
  /** 녹음한 시간 (초). 화면에 분/초 표시. */
  totalDuration: number;
  /** 일시정지 상태인지 (아니면 recording). 안내 문구가 달라짐. */
  isPaused: boolean;
  /** 분석 가능한 실내용(음성 전사 또는 메모)이 있는지 — true 이면 [분석하기] 버튼 노출. */
  canAnalyze: boolean;
  /** [이어서 녹음하기] — 글로벌 시트 열기 등 호출자 측 책임. */
  onResume: () => void;
  /** [분석하기] — finishRecording 호출. */
  onFinalize: () => void;
  /** [삭제] — 녹음 폐기(노트 삭제). 확인은 호출 측 책임. */
  onDelete: () => void;
  /** 분석 시작 중 (mutation pending) */
  isFinalizing: boolean;
  onBack: () => void;
}

// 필드노트 다크 정체성 — 보라-잉크 베이스 + 블루 녹음 액센트(CompletedScreen·홈 녹음 버튼과 통일).
const FN = COLORS.fieldnoteDark;
const BLUE = '#3B82F6';
const BADGE = 96; // 히어로 아이콘 배지 지름
const GLOW = 300; // 배지 뒤 방사형 글로우 범위

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s2 = Math.floor(sec % 60);
  if (m === 0) return `${s2}초`;
  if (s2 === 0) return `${m}분`;
  return `${m}분 ${s2}초`;
}

export function ResumeScreen({
  sessionInfo,
  totalDuration,
  isPaused,
  canAnalyze,
  onResume,
  onFinalize,
  onDelete,
  isFinalizing,
  onBack,
}: ResumeScreenProps) {
  const insets = useSafeAreaInsets();
  const [showDelete, setShowDelete] = useState(false);
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.iconBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel="뒤로">
          <Ionicons name="chevron-back" size={s(24)} color={FN.text} />
        </Pressable>
        <Typography variant="title-01" weight="semibold" style={{ color: FN.text }}>
          필드노트
        </Typography>
        <Pressable
          onPress={() => setShowDelete(true)}
          style={styles.iconBtn}
          hitSlop={8}
          accessibilityLabel="녹음 삭제"
          accessibilityRole="button"
        >
          <Ionicons name="trash-outline" size={s(21)} color={FN.sub} />
        </Pressable>
      </View>

      <View style={styles.body}>
        {/* 히어로 — 블루 방사형 글로우 + 원형 배지(일시정지/녹음 아이콘) */}
        <View style={styles.hero}>
          <Svg width={s(GLOW)} height={s(GLOW)} style={styles.glow} pointerEvents="none">
            <Defs>
              <RadialGradient id="fnResumeGlow" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={BLUE} stopOpacity={0.18} />
                <Stop offset="0.55" stopColor={BLUE} stopOpacity={0.05} />
                <Stop offset="1" stopColor={BLUE} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width={s(GLOW)} height={s(GLOW)} fill="url(#fnResumeGlow)" />
          </Svg>
          <View style={styles.badge}>
            <Ionicons name={isPaused ? 'pause' : 'mic'} size={s(40)} color={BLUE} />
          </View>
        </View>

        <Typography variant="headline-02" weight="semibold" style={styles.heroTitle}>
          {isPaused ? '녹음이 일시정지되어 있어요' : '녹음이 진행 중이었어요'}
        </Typography>
        <Typography variant="body-02" style={styles.heroSub}>
          이어서 녹음하거나, 지금까지 기록한 내용을 분석할 수 있어요
        </Typography>

        {/* 진행 정보 카드 — 녹음 길이 + 회기 컨텍스트 */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={s(16)} color={BLUE} />
            <Typography variant="body-02" weight="medium" style={{ color: FN.text }}>
              지금까지 {formatDuration(totalDuration)} 녹음했어요
            </Typography>
          </View>
          {sessionInfo ? (
            <View style={[styles.infoRow, { marginTop: s(8) }]}>
              <Ionicons name="person-outline" size={s(16)} color={FN.sub} />
              <Typography variant="label-01" style={{ color: FN.sub, flex: 1 }} numberOfLines={1}>
                {sessionInfo}
              </Typography>
            </View>
          ) : null}
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + s(12) }]}>
        <Pressable
          style={styles.primaryBtn}
          onPress={onResume}
          disabled={isFinalizing}
          accessibilityRole="button"
          accessibilityLabel="이어서 녹음하기"
        >
          <Ionicons name="mic" size={s(18)} color={COLORS.white} />
          <Typography variant="body-01" weight="semibold" style={{ color: COLORS.white }}>
            이어서 녹음하기
          </Typography>
        </Pressable>

        {canAnalyze && (
          <Pressable
            style={styles.secondaryBtn}
            onPress={onFinalize}
            disabled={isFinalizing}
            accessibilityRole="button"
            accessibilityLabel="분석하기"
          >
            {isFinalizing ? (
              <ActivityIndicator size="small" color={FN.sub} />
            ) : (
              <>
                <Ionicons name="sparkles" size={s(16)} color={FN.accent} />
                <Typography variant="body-02" weight="medium" style={{ color: FN.text }}>
                  분석하기
                </Typography>
              </>
            )}
          </Pressable>
        )}
      </View>

      <FieldNoteConfirmModal
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
    backgroundColor: FN.bg,
  },
  header: {
    height: s(44),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: s(8),
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
    paddingHorizontal: s(24),
    paddingBottom: s(60),
  },
  hero: {
    width: s(BADGE),
    height: s(BADGE),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: s(24),
  },
  glow: {
    position: 'absolute',
    top: s((BADGE - GLOW) / 2),
    left: s((BADGE - GLOW) / 2),
  },
  badge: {
    width: s(BADGE),
    height: s(BADGE),
    borderRadius: s(BADGE / 2),
    backgroundColor: 'rgba(59,130,246,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    color: FN.text,
    textAlign: 'center',
  },
  heroSub: {
    color: FN.sub,
    textAlign: 'center',
    marginTop: s(8),
  },
  infoCard: {
    alignSelf: 'stretch',
    backgroundColor: FN.card,
    borderRadius: s(14),
    paddingHorizontal: s(16),
    paddingVertical: s(14),
    marginTop: s(24),
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(8),
  },
  footer: {
    paddingHorizontal: s(20),
    gap: s(10),
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(8),
    height: s(52),
    borderRadius: s(16),
    backgroundColor: BLUE,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(6),
    height: s(50),
    borderRadius: s(16),
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: FN.line,
  },
});
