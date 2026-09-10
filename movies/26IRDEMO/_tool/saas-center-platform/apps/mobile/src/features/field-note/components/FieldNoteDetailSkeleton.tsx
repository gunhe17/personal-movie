import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import type { DimensionValue } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';
import { Skeleton, SkeletonCircle } from '@/shared/components/ui/Skeleton';

const FND = COLORS.fieldnoteDark;

// 다크 배경(필드노트 상세) 위 시머 — 화이트 오버레이 톤으로 대비 확보.
const DARK_SHIMMER: [string, string] = ['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.11)'];

/** 전사 한 행 — 시간/화자 라벨 + 1~2줄 본문 (실제 TimelineRow 모양 흉내). */
function RowSkeleton({ lines = 2, width = '92%' }: { lines?: number; width?: DimensionValue }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowHead}>
        <SkeletonCircle size={6} colors={DARK_SHIMMER} />
        <Skeleton width={56} height={12} radius={4} colors={DARK_SHIMMER} />
      </View>
      <Skeleton width="100%" height={14} radius={4} colors={DARK_SHIMMER} />
      {lines > 1 ? (
        <Skeleton width={width} height={14} radius={4} colors={DARK_SHIMMER} style={{ marginTop: s(6) }} />
      ) : null}
    </View>
  );
}

/**
 * 필드노트 상세 로딩 스켈레톤.
 *
 * 디자인 스펙 §6.2 — 스피너 대신 CompletedScreen 레이아웃(상단바·헤더·탭·전사 행·재생 독)을
 * 그대로 흉내 내 레이아웃 점프를 없앤다. 헤더 chrome 은 그대로 두고 본문만 스켈레톤으로 대체.
 */
export function FieldNoteDetailSkeleton({ onBack }: { onBack?: () => void }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        {/* Top bar — 뒤로가기는 로딩 중에도 동작(chrome 유지), 복사/공유는 자리만 */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={onBack} style={styles.iconBox} hitSlop={10} disabled={!onBack}>
            <Ionicons name="chevron-back" size={s(24)} color={FND.text} />
          </TouchableOpacity>
          <View style={styles.topBarActions}>
            <View style={styles.iconBox}>
              <SkeletonCircle size={20} colors={DARK_SHIMMER} />
            </View>
            <View style={styles.iconBox}>
              <SkeletonCircle size={20} colors={DARK_SHIMMER} />
            </View>
          </View>
        </View>

        {/* Header — 제목 + 길이 + 회기 연결 pill */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Skeleton width={180} height={22} radius={6} colors={DARK_SHIMMER} />
            <Skeleton width={56} height={14} radius={4} colors={DARK_SHIMMER} />
          </View>
          <Skeleton width={120} height={32} radius={999} colors={DARK_SHIMMER} style={{ marginTop: s(12) }} />
        </View>

        {/* Tabs — 전체 대화 / 메모 내용 / AI 분석 */}
        <View style={styles.tabsRow}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.tab}>
              <Skeleton width={56} height={14} radius={4} colors={DARK_SHIMMER} />
            </View>
          ))}
        </View>

        {/* 전사 행 — 폭을 번갈아 줘 자연스러운 리듬 */}
        <View style={styles.list}>
          <RowSkeleton lines={2} width="88%" />
          <RowSkeleton lines={1} />
          <RowSkeleton lines={2} width="74%" />
          <RowSkeleton lines={2} width="94%" />
          <RowSkeleton lines={1} />
          <RowSkeleton lines={2} width="68%" />
          <RowSkeleton lines={2} width="90%" />
        </View>
      </SafeAreaView>

      {/* 재생 독 — 본체 108(세이프에어리어 제외) + 트랙/컨트롤 자리 */}
      <View style={styles.playerBarShadow}>
        <View style={[styles.playerBarSurface, { height: s(108) + insets.bottom, paddingBottom: insets.bottom }]}>
          <Skeleton width="100%" height={4} radius={2} colors={DARK_SHIMMER} />
          <View style={styles.controls}>
            <SkeletonCircle size={44} colors={DARK_SHIMMER} />
            <SkeletonCircle size={44} colors={DARK_SHIMMER} />
            <SkeletonCircle size={44} colors={DARK_SHIMMER} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: FND.bg,
  },
  safe: {
    flex: 1,
  },
  topBar: {
    height: s(44),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: s(8),
  },
  iconBox: {
    width: s(40),
    height: s(40),
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(2),
  },
  header: {
    paddingHorizontal: SPACING.lg,
    paddingTop: s(8),
    paddingBottom: s(16),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tabsRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: FND.line,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: s(12),
  },
  list: {
    paddingHorizontal: SPACING.lg,
    paddingTop: s(16),
    gap: s(16),
  },
  row: {
    gap: s(6),
  },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(6),
    marginBottom: s(2),
  },
  // 재생 독 — CompletedScreen.playerBarShadow/Surface 와 동일 치수.
  playerBarShadow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.25,
    shadowRadius: 11.9,
    elevation: 16,
  },
  playerBarSurface: {
    paddingHorizontal: SPACING.lg,
    paddingTop: s(16),
    backgroundColor: FND.card,
    borderTopWidth: 1,
    borderTopColor: FND.line,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(28),
    marginTop: s(16),
  },
});
