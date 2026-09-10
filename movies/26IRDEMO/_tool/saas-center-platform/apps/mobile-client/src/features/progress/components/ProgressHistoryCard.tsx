/**
 * 상담·검사 이력 카드 — 탭(상담/검사) + 회기 행 + 상태 배지.
 * 자녀 상세·센터 상세가 공유한다. 탭 하단 인디케이터 슬라이드 + 목록 페이드.
 *
 * preview를 주면 각 탭 그 개수만 미리보기 + '전체보기'로 그 자리에서 펼침(접기 가능).
 * preview 없으면 전체를 그대로 보여준다.
 */
import React, { useEffect, useState } from 'react';
import { Pressable, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  Badge,
  Button,
  LoadingView,
  Typography,
  type BadgeColor,
} from '@/shared/components/ui';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';
import type { AssessmentProgress, CounselingProgress } from '../types';

type HistoryTab = 'counseling' | 'assessment';

/** 목록 간격 — 시안 793:9944 (행 ↔ 구분선 ↔ 행 모두 16). */
const ROW_GAP = s(16);

/** 회기 진행 → 배지(진행중 teal / 완료 green). */
function progressBadge(
  completed: number,
  total: number | null,
): { label: string; color: BadgeColor; done: boolean } {
  const done = total != null && total > 0 && completed >= total;
  return done
    ? { label: '완료', color: 'green', done: true }
    : { label: '진행중', color: 'teal', done: false };
}

function DotDivider() {
  return (
    <View style={{ width: 1, height: s(10), backgroundColor: COLORS.border.default }} />
  );
}

function CardDivider() {
  return <View style={{ height: 1, backgroundColor: COLORS.border.default }} />;
}

/** 탭 버튼 — 시안 608:6962 (높이 44, 좌우 19 hug). 폭은 라벨에 맞춰 자란다. */
function HistoryTabButton({
  label,
  active,
  onPress,
  onLayout,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  onLayout: (e: LayoutChangeEvent) => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      onLayout={onLayout}
      className="items-center justify-center"
      style={{ height: s(44), paddingHorizontal: s(19) }}
    >
      <Typography
        variant="body-03"
        weight="medium"
        style={{ color: active ? COLORS.text.body.strong : COLORS.text.body.subtle }}
      >
        {label}
      </Typography>
    </Pressable>
  );
}

function HistoryRow({
  title,
  countLabel,
  countDone,
  subLeft,
  centerName,
  badge,
  onPress,
}: {
  title: string;
  countLabel: string;
  countDone: boolean;
  subLeft: string | null;
  centerName: string | null;
  badge: { label: string; color: BadgeColor };
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={!onPress}
      className="w-full flex-row items-center justify-between"
      style={({ pressed }) => ({ opacity: pressed && onPress ? 0.7 : 1 })}
    >
      <View className="flex-1 pr-2" style={{ rowGap: s(8) }}>
        <View className="flex-row items-center" style={{ columnGap: s(8) }}>
          <Typography
            variant="body-01"
            weight="semibold"
            numberOfLines={1}
            style={{ color: COLORS.text.body.strong }}
          >
            {title}
          </Typography>
          <Typography
            variant="body-03"
            style={{ color: countDone ? COLORS.primary : COLORS.text.body.default }}
          >
            {countLabel}
          </Typography>
        </View>
        <View className="flex-row items-center" style={{ columnGap: s(8) }}>
          {subLeft ? (
            <Typography variant="body-03" style={{ color: COLORS.text.body.subtle }}>
              {subLeft}
            </Typography>
          ) : null}
          {subLeft && centerName ? <DotDivider /> : null}
          {centerName ? (
            <Typography
              variant="body-03"
              numberOfLines={1}
              className="flex-1"
              style={{ color: COLORS.text.body.subtle }}
            >
              {centerName}
            </Typography>
          ) : null}
        </View>
      </View>
      <Badge label={badge.label} color={badge.color} />
    </Pressable>
  );
}

interface ProgressHistoryCardProps {
  counseling: CounselingProgress[];
  assessments: AssessmentProgress[];
  loading?: boolean;
  /** 주면 각 탭 이 개수만 미리보기 + 전체보기 토글. 없으면 전체 노출. */
  preview?: number;
  onCounselingPress?: (item: CounselingProgress) => void;
  onAssessmentPress?: (item: AssessmentProgress) => void;
}

export function ProgressHistoryCard({
  counseling,
  assessments,
  loading = false,
  preview,
  onCounselingPress,
  onAssessmentPress,
}: ProgressHistoryCardProps) {
  const [tab, setTab] = useState<HistoryTab>('counseling');
  const [showAll, setShowAll] = useState(false);

  const switchTab = (next: HistoryTab) => {
    setTab(next);
    setShowAll(false);
  };

  /**
   * 탭 폭이 라벨에 따라 달라져(시안 hug) 인디케이터도 측정값을 따라간다.
   * 첫 측정은 애니메이션 없이 자리 잡고, 이후 탭 전환에서만 슬라이드한다.
   */
  const [tabLayouts, setTabLayouts] = useState<
    Record<HistoryTab, { x: number; width: number }>
  >({ counseling: { x: 0, width: 0 }, assessment: { x: 0, width: 0 } });

  const handleTabLayout = (key: HistoryTab) => (e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    setTabLayouts((prev) =>
      prev[key].x === x && prev[key].width === width
        ? prev
        : { ...prev, [key]: { x, width } },
    );
  };

  const indicatorX = useSharedValue(0);
  const indicatorW = useSharedValue(0);
  useEffect(() => {
    const layout = tabLayouts[tab];
    if (layout.width === 0) return;
    if (indicatorW.value === 0) {
      indicatorX.value = layout.x;
      indicatorW.value = layout.width;
      return;
    }
    const timing = { duration: 220, easing: Easing.out(Easing.cubic) };
    indicatorX.value = withTiming(layout.x, timing);
    indicatorW.value = withTiming(layout.width, timing);
  }, [tab, tabLayouts, indicatorX, indicatorW]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
    width: indicatorW.value,
  }));

  const collapse = preview != null && !showAll;
  const visibleCounseling = collapse ? counseling.slice(0, preview) : counseling;
  const visibleAssessments = collapse ? assessments.slice(0, preview) : assessments;
  const currentTotal = tab === 'counseling' ? counseling.length : assessments.length;
  const hasMore = preview != null && currentTotal > preview;

  return (
    <View className="rounded-2xl bg-surface px-4 pb-4 pt-3">
      {/* 탭 — 하단 인디케이터가 부드럽게 슬라이드 */}
      <View style={{ position: 'relative' }}>
        <View
          className="flex-row"
          style={{ borderBottomWidth: 1, borderBottomColor: COLORS.border.default }}
        >
          <HistoryTabButton
            label="상담"
            active={tab === 'counseling'}
            onPress={() => switchTab('counseling')}
            onLayout={handleTabLayout('counseling')}
          />
          <HistoryTabButton
            label="검사"
            active={tab === 'assessment'}
            onPress={() => switchTab('assessment')}
            onLayout={handleTabLayout('assessment')}
          />
        </View>
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              bottom: 0,
              left: 0,
              height: 1.5,
              backgroundColor: COLORS.gray[900],
            },
            indicatorStyle,
          ]}
        />
      </View>

      {/* 목록 — 탭 전환 시 페이드 */}
      <Animated.View
        key={tab}
        entering={FadeIn.duration(200)}
        style={{ marginTop: s(20), rowGap: ROW_GAP }}
      >
        {loading ? (
          <LoadingView className="py-6" />
        ) : tab === 'counseling' ? (
          visibleCounseling.length === 0 ? (
            <Typography
              variant="body-02"
              className="py-4 text-center"
              style={{ color: COLORS.text.caption.default }}
            >
              아직 상담 이력이 없어요
            </Typography>
          ) : (
            visibleCounseling.map((item, i) => {
              const badge = progressBadge(item.completed_sessions, item.total_sessions);
              const count = item.total_sessions
                ? `${item.completed_sessions}/${item.total_sessions}회기`
                : `${item.completed_sessions}회기`;
              return (
                <View key={item.case_id} style={{ rowGap: ROW_GAP }}>
                  {i > 0 ? <CardDivider /> : null}
                  <HistoryRow
                    title={item.counseling_type ?? '상담'}
                    countLabel={count}
                    countDone={badge.done}
                    subLeft={item.counselor_name ? `${item.counselor_name} 상담사` : null}
                    centerName={item.center_name}
                    badge={badge}
                    onPress={
                      onCounselingPress ? () => onCounselingPress(item) : undefined
                    }
                  />
                </View>
              );
            })
          )
        ) : visibleAssessments.length === 0 ? (
          <Typography
            variant="body-02"
            className="py-4 text-center"
            style={{ color: COLORS.text.caption.default }}
          >
            아직 검사 이력이 없어요
          </Typography>
        ) : (
          visibleAssessments.map((item, i) => {
            const badge = progressBadge(item.completed_count, item.total_count);
            const count = item.total_count
              ? `${item.completed_count}/${item.total_count}개`
              : `${item.completed_count}개`;
            return (
              <View key={item.case_id} style={{ rowGap: ROW_GAP }}>
                {i > 0 ? <CardDivider /> : null}
                <HistoryRow
                  title={item.name}
                  countLabel={count}
                  countDone={badge.done}
                  subLeft={null}
                  centerName={item.center_name}
                  badge={badge}
                  onPress={onAssessmentPress ? () => onAssessmentPress(item) : undefined}
                />
              </View>
            );
          })
        )}
      </Animated.View>

      {/* 전체보기/접기 — preview 초과일 때만, 그 자리에서 펼침 */}
      {hasMore ? (
        <Button
          label={showAll ? '접기' : '전체보기'}
          variant="outline"
          size="lg"
          onPress={() => setShowAll((v) => !v)}
          className="mt-5"
        />
      ) : null}
    </View>
  );
}
