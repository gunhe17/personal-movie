/**
 * 기록 탭 — 피그마 203:5829 (기록/리스트).
 *
 * 프로필 필터 칩 + 기간 이동 헤더(월 라벨·좌우 화살표) + 뷰 토글, 그 아래 3뷰:
 *   주간(기본) — 주간 스트립에서 고른 **하루**의 카드만 (시안 323:5575)
 *   월간        — 그 달 기록을 날짜 섹션으로 모아보기 (시안 276:6934)
 *   저장        — 북마크한 기록, 같은 날짜 섹션 형태
 * 월 격자 달력은 뺐다 — 월간을 모아보기로 두기로 해서(2026-07-30 판정) 격자가
 * 있을 자리가 없다. 격자 컴포넌트(ScheduleCalendar)는 일정 탭이 계속 쓴다.
 *
 * 배경은 bg/base 위에 시안 271:6566 글로우 타원(blur 50.4, #EBFBE3→#DDF0F8)을 겹친다 —
 * 흰 필터 칩과 작성하기 버튼의 틸 글로우가 이 배경을 전제로 한 스펙이라 세트로 간다.
 *
 * ⚠️ 기록은 센터 연결과 무관하게 작동한다(설계.md §15-6) — 일정·진행현황과 달리
 * 필터 대상이 "연결된 프로필"이 아니라 내 가족의 전체 프로필이다. 연결을 전제하면
 * §3 상황①("센터가 처음")에서 관찰 기록이 통째로 죽는다.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { kstToServerDateTime, nowKst, toKst } from '@/shared/utils/date';
import { useMe } from '@/features/auth';
import { buildProfileColorMap } from '@/features/profile';
import { useRecordDates, useRecords } from '@/features/records';
import { ErrorView, LoadingView, Typography } from '@/shared/components/ui';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';
import { useTabBarClearance } from '@/shared/hooks/useTabBarClearance';
import { ScheduleFilterChip } from './_components/ScheduleFilterChip';
import { TabHeader } from './_components/TabHeader';
import { RecordWeekStrip } from './_components/RecordWeekStrip';
import { RecordsBgGlow } from '@/features/records';
import { RecordListCard } from './_components/RecordListCard';
import { RecordWriteFab } from './_components/RecordWriteFab';
import { RecordEmptyState } from './_components/RecordEmptyState';
import {
  RecordViewToggle,
  type ViewMode,
} from './_components/RecordViewToggle';
import ArrowLeftIcon20 from '@assets/icons/20/ArrowLeftIcon20.svg';
import ArrowRightIcon20 from '@assets/icons/20/ArrowRightIcon20.svg';

export default function RecordsScreen() {
  const router = useRouter();
  const tabClearance = useTabBarClearance();
  const meQuery = useMe();
  const me = meQuery.data;

  // 화면의 날짜 상태는 전부 KST 벽시계 기준(shared/utils/date.ts 규칙)
  const [selected, setSelected] = useState(() => startOfDay(nowKst()));
  /** null = 전체 */
  const [profileFilter, setProfileFilter] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('week');

  const profiles = me?.profiles ?? [];
  const profileColorById = useMemo(
    () => buildProfileColorMap(profiles),
    [profiles],
  );

  // 점 범위는 넓은 쪽(달력 격자)으로 한 번만 받아 주간 스트립과 나눠 쓴다
  const range = useMemo(() => {
    const from = startOfWeek(startOfMonth(selected));
    const to = addDays(endOfWeek(endOfMonth(selected)), 1);
    return { from: kstToServerDateTime(from), to: kstToServerDateTime(to) };
  }, [selected]);

  const datesQuery = useRecordDates({
    profileId: profileFilter,
    from: range.from,
    to: range.to,
    enabled: !!me,
  });

  /**
   * 보는 기간이 뷰마다 다르다(2026-07-30 판정):
   *   주간 — 스트립에서 **고른 하루**만 [00:00, 다음날 00:00)
   *   월간 — 그 달 전체를 날짜 섹션으로 모아보기(시안 276:6934)
   *   저장 — 날짜 축이 없어 기간을 걸지 않는다
   * 기간은 서버에서 거른다 — 클라에서 자르면 커서 페이지에 그날이 안 실려 "없음"이 된다.
   */
  const listRange = useMemo(() => {
    if (viewMode === 'bookmark') return null;
    const from =
      viewMode === 'month' ? startOfMonth(selected) : startOfDay(selected);
    const to = viewMode === 'month' ? addMonths(from, 1) : addDays(from, 1);
    return { from: kstToServerDateTime(from), to: kstToServerDateTime(to) };
  }, [selected, viewMode]);

  const recordsQuery = useRecords({
    profileId: profileFilter,
    bookmarkedOnly: viewMode === 'bookmark',
    from: listRange?.from ?? null,
    to: listRange?.to ?? null,
    enabled: !!me,
  });

  const records = useMemo(
    () => recordsQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [recordsQuery.data],
  );

  /** 월간·저장 뷰의 날짜 섹션 — occurred_at desc를 하루 단위로 끊는다 */
  const sections = useMemo(() => {
    const groups: { key: string; day: Date; items: typeof records }[] = [];
    records.forEach((record) => {
      const day = startOfDay(toKst(record.occurred_at));
      const key = format(day, 'yyyy-MM-dd');
      const last = groups[groups.length - 1];
      if (last && last.key === key) last.items.push(record);
      else groups.push({ key, day, items: [record] });
    });
    return groups;
  }, [records]);

  const focusName =
    (profileFilter
      ? profiles.find((p) => p.id === profileFilter)?.display_name
      : profiles[0]?.display_name) ?? '아이';

  /**
   * 고른 날짜가 비었어도 이 달에 기록이 있으면 큰 빈 화면(일러스트+CTA)을 띄우지
   * 않는다 — 날짜만 옮기면 되는 상황에 화면을 통째로 바꾸면 길을 잃는다.
   */
  const monthHasRecords = Object.keys(datesQuery.data ?? {}).length > 0;
  const showFullEmpty =
    records.length === 0 && (viewMode === 'bookmark' || !monthHasRecords);
  /**
   * 작성 FAB은 큰 빈 화면일 때만 감춘다 — 그 화면은 자기 CTA를 갖고 있어
   * 버튼이 둘이 된다(시안 323:5575).
   */
  const showWriteFab = !showFullEmpty;
  /** FAB(52) + 시안 간격(12)만큼 스크롤 끝을 더 밀어 마지막 카드가 안 가리게 */
  const listPaddingBottom = tabClearance + (showWriteFab ? s(64) : 0);

  const openCreate = () =>
    router.push({
      pathname: '/(main)/record-create',
      params: profileFilter ? { profileId: profileFilter } : undefined,
    });

  return (
    <View className="flex-1 bg-background">
      {/* 배경 글로우 — 화면 밖으로 넘치는 부분은 잘라낸다(시안 프레임 클리핑과 동일) */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          overflow: 'hidden',
        }}
      >
        <RecordsBgGlow />
      </View>

      <SafeAreaView className="flex-1" edges={['top']}>
        <TabHeader title="기록" />

        {meQuery.isLoading ? (
          <LoadingView className="flex-1" />
        ) : meQuery.isError ? (
          <ErrorView className="flex-1" onRetry={() => meQuery.refetch()} />
        ) : profiles.length === 0 ? (
          <RecordEmptyState
            kind="no-profile"
            focusName=""
            paddingBottom={tabClearance}
            onPress={() => router.push('/(main)/profile-form')}
          />
        ) : (
          <View className="flex-1">
            {/* 프로필 필터 */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              // 가로 ScrollView가 flex 컬럼 안에서 세로로 늘어나 칩~달력 사이 큰
              // 여백을 만든다 — flexGrow:0으로 콘텐츠 높이에 고정한다.
              style={{ flexGrow: 0 }}
              // 시안 414:4077의 칩 밴드는 h54 — 34 칩 기준 상하 10이 맞다
              contentContainerStyle={{
                columnGap: s(8),
                paddingHorizontal: s(16),
                paddingVertical: s(10),
              }}
            >
              <ScheduleFilterChip
                label="전체"
                active={profileFilter === null}
                inactiveTone="surface"
                onPress={() => setProfileFilter(null)}
              />
              {profiles.map((profile) => (
                <ScheduleFilterChip
                  key={profile.id}
                  label={profile.display_name}
                  active={profileFilter === profile.id}
                  color={profileColorById.get(profile.id)}
                  imageUrl={profile.image_url}
                  inactiveTone="surface"
                  onPress={() => setProfileFilter(profile.id)}
                />
              ))}
            </ScrollView>

            {/* 기간 이동 헤더 — 주간은 주 단위, 월간은 달 단위로 옮긴다.
                저장한 기록은 기간 축이 없어 화살표·라벨을 감춘다(죽은 컨트롤 금지) */}
            <View className="h-11 flex-row items-center justify-between px-4">
              {viewMode === 'bookmark' ? (
                <View />
              ) : (
                <View
                  className="flex-row items-center"
                  style={{ columnGap: s(8) }}
                >
                  <ArrowButton
                    label={viewMode === 'month' ? '이전 달' : '이전 주'}
                    onPress={() =>
                      setSelected((d) =>
                        viewMode === 'month'
                          ? addMonths(d, -1)
                          : addDays(d, -7),
                      )
                    }
                  >
                    <ArrowLeftIcon20 width={20} height={20} />
                  </ArrowButton>
                  <Typography
                    variant="title-01"
                    weight="semibold"
                    style={{ color: COLORS.text.title.default }}
                  >
                    {format(selected, 'yyyy년 M월')}
                  </Typography>
                  <ArrowButton
                    label={viewMode === 'month' ? '다음 달' : '다음 주'}
                    onPress={() =>
                      setSelected((d) =>
                        viewMode === 'month' ? addMonths(d, 1) : addDays(d, 7),
                      )
                    }
                  >
                    <ArrowRightIcon20 width={20} height={20} />
                  </ArrowButton>
                </View>
              )}

              {/* 뷰 토글 */}
              <RecordViewToggle value={viewMode} onChange={setViewMode} />
            </View>

            {/* 주간 스트립 — 하루를 고르는 축이라 주간 뷰에만 있다(시안 276:6934엔 없음) */}
            {viewMode === 'week' ? (
              <View className="px-4 py-2">
                <RecordWeekStrip
                  selected={selected}
                  onSelect={setSelected}
                  countsByDate={datesQuery.data}
                />
              </View>
            ) : null}

            {recordsQuery.isLoading && records.length === 0 ? (
              <LoadingView className="flex-1" />
            ) : recordsQuery.isError ? (
              <ErrorView
                className="flex-1"
                onRetry={() => recordsQuery.refetch()}
              />
            ) : showFullEmpty ? (
              <RecordEmptyState
                kind={viewMode === 'bookmark' ? 'bookmark' : 'no-record'}
                focusName={focusName}
                paddingBottom={tabClearance}
                onPress={openCreate}
              />
            ) : records.length === 0 ? (
              // 이 기간엔 기록이 있는데 고른 날짜만 빈 경우 — 날짜만 옮기면 된다
              <EmptyDayNotice />
            ) : (
              <FadeWhileLoading loading={recordsQuery.isPlaceholderData}>
                <ScrollView
                  contentContainerStyle={{
                    paddingHorizontal: s(16),
                    paddingTop: s(4),
                    paddingBottom: listPaddingBottom,
                    rowGap: viewMode === 'week' ? s(12) : s(24),
                  }}
                  onScroll={({ nativeEvent }) => {
                    const { layoutMeasurement, contentOffset, contentSize } =
                      nativeEvent;
                    const nearEnd =
                      layoutMeasurement.height + contentOffset.y >=
                      contentSize.height - s(200);
                    if (
                      nearEnd &&
                      recordsQuery.hasNextPage &&
                      !recordsQuery.isFetchingNextPage
                    ) {
                      recordsQuery.fetchNextPage();
                    }
                  }}
                  scrollEventThrottle={16}
                >
                  {/* 주간은 이미 하루라 헤더가 카드의 날짜와 겹친다 — 섹션 없이 카드만.
                    월간·저장은 여러 날이 섞여 날짜 섹션으로 묶는다(시안 276:6934) */}
                  {viewMode === 'week'
                    ? records.map((record) => (
                        <RecordListCard
                          key={record.id}
                          record={record}
                          onPress={() =>
                            router.push(`/(main)/record-detail?id=${record.id}`)
                          }
                        />
                      ))
                    : sections.map((section) => (
                        <View key={section.key} style={{ rowGap: s(12) }}>
                          <Typography
                            variant="body-03"
                            style={{ color: COLORS.text.body.subtle }}
                          >
                            {format(section.day, 'M월 d일 EEEE', {
                              locale: ko,
                            })}
                          </Typography>
                          {section.items.map((record) => (
                            <RecordListCard
                              key={record.id}
                              record={record}
                              onPress={() =>
                                router.push(
                                  `/(main)/record-detail?id=${record.id}`,
                                )
                              }
                            />
                          ))}
                        </View>
                      ))}
                </ScrollView>
              </FadeWhileLoading>
            )}
          </View>
        )}
      </SafeAreaView>

      {showWriteFab ? <RecordWriteFab onPress={openCreate} /> : null}
    </View>
  );
}

/**
 * 새 기간을 불러오는 동안 이전 목록을 살짝 흐리게 — 스피너로 교체하면 깜빡이고,
 * 아무 표시가 없으면 눌렀는지 모른다. 150ms 페이드라 전환으로 읽힌다.
 */
function FadeWhileLoading({
  loading,
  children,
}: {
  loading: boolean;
  children: React.ReactNode;
}) {
  const progress = useDerivedValue(
    () => withTiming(loading ? 1 : 0, { duration: 150 }),
    [loading],
  );
  const style = useAnimatedStyle(() => ({
    flex: 1,
    opacity: 1 - progress.value * 0.45,
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}

/** 고른 날짜만 빈 경우의 가벼운 안내 — 큰 빈 화면(일러스트+CTA)을 대신한다 */
function EmptyDayNotice() {
  return (
    <View className="items-center" style={{ paddingVertical: s(40) }}>
      <Typography variant="body-02" style={{ color: COLORS.text.body.subtle }}>
        이 날에는 기록이 없어요
      </Typography>
    </View>
  );
}

function ArrowButton({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
    >
      {children}
    </Pressable>
  );
}
