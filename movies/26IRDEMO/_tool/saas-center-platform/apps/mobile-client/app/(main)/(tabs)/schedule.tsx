/**
 * 일정 탭 — 피그마 414:4229.
 *
 * 상단 흰 패널(바우처 마감 배너 · 프로필 필터 · 월 달력) + 하단 선택일 목록.
 * 조회 범위는 표시 중인 달 — 월을 넘기면 그 달을 다시 조회한다.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  addMonths,
  differenceInCalendarDays,
  endOfDay,
  endOfMonth,
  format,
  isSameDay,
  parseISO,
  startOfDay,
  startOfMonth,
  subMonths,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { kstToServerDateTime, nowKst, toKst } from '@/shared/utils/date';
import { useMe } from '@/features/auth';
import { buildProfileColorMap } from '@/features/profile';
import { useSchedules } from '@/features/schedule';
import { useVoucherCatalog } from '@/features/voucher';
import {
  Button,
  EmptyView,
  ErrorView,
  LoadingView,
  Typography,
  type BadgeColor,
} from '@/shared/components/ui';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';
import { useTabBarClearance } from '@/shared/hooks/useTabBarClearance';
import {
  refetchIfFetched,
  useRefreshControl,
} from '@/shared/hooks/useRefreshControl';
import { TabHeader } from './_components/TabHeader';
import { ScheduleCalendar } from './_components/ScheduleCalendar';
import { ScheduleListCard } from './_components/ScheduleListCard';
import { ScheduleFilterChip } from './_components/ScheduleFilterChip';

/** 마감 배너 노출 구간 — 이보다 먼 마감은 급하지 않아 띄우지 않는다 */
const DEADLINE_WINDOW_DAYS = 30;

export default function ScheduleScreen() {
  const router = useRouter();
  const tabClearance = useTabBarClearance();
  const meQuery = useMe();
  const me = meQuery.data;

  // 날짜 상태는 KST 벽시계 기준(shared/utils/date.ts 규칙)
  const [month, setMonth] = useState(() => startOfMonth(nowKst()));
  const [selected, setSelected] = useState(() => startOfDay(nowKst()));
  /** null = 전체 */
  const [profileFilter, setProfileFilter] = useState<string | null>(null);

  const activeLinks = useMemo(
    () => (me?.links ?? []).filter((link) => link.status === 'active'),
    [me],
  );
  const isLinked = activeLinks.length > 0;

  // 연결된 프로필만 필터 대상 — 연결 안 된 프로필은 일정 자체가 없다
  // 미연결이어도 달력·칩은 보여준다(구조) — 일정 데이터만 연결에 달렸다
  const linkedProfiles = useMemo(() => {
    if (!me) return [];
    if (activeLinks.length === 0) return me.profiles;
    const ids = new Set(activeLinks.map((link) => link.profile_id));
    return me.profiles.filter((p) => ids.has(p.id));
  }, [me, activeLinks]);

  const profileColorById = useMemo(
    () => buildProfileColorMap(linkedProfiles),
    [linkedProfiles],
  );

  const range = useMemo(
    () => ({
      start: kstToServerDateTime(startOfMonth(month)),
      end: kstToServerDateTime(endOfDay(endOfMonth(month))),
    }),
    [month],
  );
  const schedulesQuery = useSchedules(range.start, range.end, isLinked);

  const schedules = useMemo(() => {
    const all = schedulesQuery.data ?? [];
    return profileFilter
      ? all.filter((sc) => sc.profile_id === profileFilter)
      : all;
  }, [schedulesQuery.data, profileFilter]);

  // 일정 1건 = 점 1개(프로필 색). 같은 아동 2건이면 같은 색 점 2개 — 개수를 반영한다.
  const dotsByDate = useMemo(() => {
    const map = new Map<string, BadgeColor[]>();
    for (const schedule of schedules) {
      const key = format(toKst(schedule.start_time), 'yyyy-MM-dd');
      const color = profileColorById.get(schedule.profile_id) ?? 'gray';
      const list = map.get(key) ?? [];
      list.push(color);
      map.set(key, list);
    }
    return map;
  }, [schedules, profileColorById]);

  const daySchedules = useMemo(
    () => schedules.filter((sc) => isSameDay(toKst(sc.start_time), selected)),
    [schedules, selected],
  );

  // 마감 임박 바우처 — 공개 카탈로그에서 가장 가까운 마감 1건
  const catalogQuery = useVoucherCatalog();
  const catalog = catalogQuery.data ?? [];

  const refreshControl = useRefreshControl(() =>
    Promise.all([
      refetchIfFetched(meQuery),
      refetchIfFetched(schedulesQuery),
      catalogQuery.refetch(),
    ]),
  );
  const deadline = useMemo(() => {
    const today = startOfDay(nowKst());
    return catalog
      .filter((p) => !!p.application_end_date)
      .map((p) => ({
        program: p,
        // 모집 마감은 서버 `date` 타입(달력상의 날짜)이라 KST 변환 대상이 아니다
        days: differenceInCalendarDays(
          parseISO(p.application_end_date!),
          today,
        ),
      }))
      .filter((x) => x.days >= 0 && x.days <= DEADLINE_WINDOW_DAYS)
      .sort((a, b) => a.days - b.days)[0];
  }, [catalog]);

  const profileNameById = useMemo(
    () => new Map(linkedProfiles.map((p) => [p.id, p.display_name])),
    [linkedProfiles],
  );

  // 헤더까지 흰 배경 — 상단 패널이 헤더에 이어 붙는다(시안 414:4281)
  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      <TabHeader title="일정" />

      {meQuery.isLoading ? (
        <LoadingView className="flex-1" />
      ) : meQuery.isError ? (
        <ErrorView className="flex-1" onRetry={() => meQuery.refetch()} />
      ) : (
        <ScrollView
          className="flex-1 bg-background"
          refreshControl={refreshControl}
          contentContainerStyle={{ paddingBottom: tabClearance }}
        >
          {/* 상단 흰 패널 — 배너·필터·달력 */}
          <View
            className="rounded-b-[20px] bg-surface px-4 pb-5 pt-3"
            style={{ rowGap: s(8) }}
          >
            {deadline ? (
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  router.push(`/(main)/vouchers/${deadline.program.id}`)
                }
                style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}
              >
                {/* 배경·레이아웃은 내부 View 정적 style (Pressable style 함수엔 opacity만 —
                  §5). 시안 고정 배너 컬러 #5BAFF9는 콘텐츠성, 토큰 아님 */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    columnGap: s(8),
                    padding: s(16),
                    borderRadius: s(12),
                    backgroundColor: '#5BAFF9',
                  }}
                >
                  <Typography
                    variant="body-01"
                    weight="semibold"
                    className="flex-1"
                    style={{ color: COLORS.text.state.inverse }}
                  >
                    {`${deadline.program.name}의 마감일이 ${deadline.days === 0 ? '오늘까지예요' : `${deadline.days}일 남았어요`}`}
                  </Typography>
                  <View className="flex-row items-center">
                    <Typography
                      variant="body-03"
                      style={{ color: COLORS.text.state.inverse }}
                    >
                      자세히 보기
                    </Typography>
                    {/* 디자인 시스템 arrow 에셋은 회색 고정이라 흰 배너엔 Ionicons로 대체 */}
                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color={COLORS.white}
                    />
                  </View>
                </View>
              </Pressable>
            ) : null}

            {/* 프로필 필터 */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ columnGap: s(8), paddingVertical: s(8) }}
            >
              <ScheduleFilterChip
                label="전체"
                active={profileFilter === null}
                onPress={() => setProfileFilter(null)}
              />
              {linkedProfiles.map((profile) => (
                <ScheduleFilterChip
                  key={profile.id}
                  label={profile.display_name}
                  active={profileFilter === profile.id}
                  color={profileColorById.get(profile.id)}
                  imageUrl={profile.image_url}
                  onPress={() => setProfileFilter(profile.id)}
                />
              ))}
            </ScrollView>

            <ScheduleCalendar
              month={month}
              selected={selected}
              dotsByDate={dotsByDate}
              countLabel={
                isLinked ? `${schedules.length}건의 일정이 있어요` : ''
              }
              onSelect={setSelected}
              onPrevMonth={() => setMonth((m) => subMonths(m, 1))}
              onNextMonth={() => setMonth((m) => addMonths(m, 1))}
            />
          </View>

          {/* 선택일 목록 */}
          <View className="px-4 pb-5 pt-7" style={{ rowGap: s(12) }}>
            <Typography
              variant="body-02"
              weight="medium"
              style={{ color: COLORS.text.title.subtle }}
            >
              {format(selected, 'M월 d일', { locale: ko })}
            </Typography>

            {!isLinked ? (
              <View
                className="rounded-xl bg-surface"
                style={{ padding: s(24) }}
              >
                <EmptyView
                  title="아직 연결된 센터가 없어요"
                  description="센터에서 받은 초대 코드로 연결하면 예약이 여기에 보여요"
                  className="py-6"
                />
                <Button
                  label="초대 코드 입력하기"
                  size="lg"
                  onPress={() => router.push('/(link)/code')}
                />
              </View>
            ) : schedulesQuery.isLoading ? (
              <LoadingView className="py-10" />
            ) : schedulesQuery.isError ? (
              <ErrorView
                className="py-10"
                onRetry={() => schedulesQuery.refetch()}
              />
            ) : daySchedules.length === 0 ? (
              <View className="rounded-xl bg-surface">
                <EmptyView
                  title="이 날은 일정이 없어요"
                  description="달력에서 점이 있는 날을 눌러보세요"
                  className="py-10"
                />
              </View>
            ) : (
              <View style={{ rowGap: s(12) }}>
                {daySchedules.map((schedule) => (
                  // 그룹 세션은 한 schedule_id가 여러 프로필에 걸쳐 나와 키가 겹친다
                  <ScheduleListCard
                    key={`${schedule.schedule_id}-${schedule.profile_id}`}
                    schedule={schedule}
                    profileName={profileNameById.get(schedule.profile_id)}
                    profileColor={
                      profileColorById.get(schedule.profile_id) ?? 'gray'
                    }
                  />
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
