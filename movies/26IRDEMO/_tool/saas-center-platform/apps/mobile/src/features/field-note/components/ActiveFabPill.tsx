import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, TYPOGRAPHY } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';
import { useRecordingStore } from '../recordingStore';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatPillTime(sec: number): string {
  const safe = Math.max(0, sec);
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const ss = Math.floor(safe % 60);
  if (h > 0) return `${pad2(h)}:${pad2(m)}:${pad2(ss)}`;
  return `${pad2(m)}:${pad2(ss)}`;
}

/**
 * 녹음 활성 상태에서 FAB 자리를 대신하는 시간 pill.
 * - 흰 배경 + 1px 그라데이션 보더 (#A56EFF → #7B79FF → #219EFF)
 * - 빨간 점 + 시간 표시 (mm:ss / hh:mm:ss)
 *
 * elapsed(매초 갱신)는 이 작은 pill 만 직접 구독 — prop 으로 받으면 상위(FAB·홈 등)가
 * 매초 통째로 리렌더되어 긴 리스트 화면 성능을 깎는다.
 */
export function ActiveFabPill() {
  const elapsed = useRecordingStore((st) => st.elapsed);
  return (
    <LinearGradient
      colors={['#A56EFF', '#7B79FF', '#219EFF']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.borderWrap}
    >
      <View style={styles.inner}>
        <View style={styles.dot} />
        <Text style={styles.timeText}>{formatPillTime(elapsed)}</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  borderWrap: {
    padding: 1,
    borderRadius: 100,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(6),
    height: s(40),
    paddingHorizontal: s(14),
    backgroundColor: COLORS.white,
    borderRadius: 100,
  },
  dot: {
    width: s(7),
    height: s(7),
    borderRadius: s(3.5),
    backgroundColor: COLORS.error,
  },
  timeText: {
    fontSize: s(14),
    fontWeight: '600',
    color: COLORS.gray[900],
    fontVariant: ['tabular-nums'],
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
});
