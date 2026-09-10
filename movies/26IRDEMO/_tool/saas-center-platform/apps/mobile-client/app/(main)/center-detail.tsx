/**
 * 센터 상세 — 시안 652:7038. 자녀 상세의 '소속 센터' 행에서 진입.
 *
 * 히어로(커버·이름·주소·전화 + 전화/문자) + 진행중인 활동(이 센터로 필터한 상담/검사).
 * 커버 이미지는 상단 상태바까지 덮는다(엣지 투 엣지). 운영시간·영업중은 서버 Center 모델에
 * 필드가 없어 미노출(생기면 추가).
 */
import React, { useEffect, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCenterDetail, type OperatingTime } from '@/features/center';
import {
  ProgressHistoryCard,
  useProfileProgress,
  type AssessmentProgress,
  type CounselingProgress,
} from '@/features/progress';
import { ErrorView, LoadingView, Typography } from '@/shared/components/ui';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';
import { nowKst } from '@/shared/utils/date';
import { useRefreshControl } from '@/shared/hooks/useRefreshControl';
import ArrowDownIcon20 from '@assets/icons/20/ArrowDownIcon20.svg';
import CallIcon20 from '@assets/icons/20/CallIcon20.svg';
import CenterIcon20 from '@assets/icons/20/CenterIcon20.svg';
import LocationIcon20 from '@assets/icons/20/LocationIcon20.svg';
import MessageIcon20 from '@assets/icons/20/MessageIcon20.svg';

/** 하단 assistive 버튼(전화·문자) — Button과 같은 구조(Pressable=press, 내부 View=박스). */
function ContactButton({
  icon,
  label,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={{ flex: 1 }}>
      {({ pressed }) => (
        <View
          style={{
            height: s(44),
            width: '100%',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            columnGap: s(6),
            borderRadius: 10,
            backgroundColor: pressed
              ? COLORS.button.assistive.bgPressed
              : COLORS.button.assistive.bg,
          }}
        >
          {icon}
          <Typography
            variant="body-03"
            weight="medium"
            style={{ color: COLORS.button.assistive.text }}
          >
            {label}
          </Typography>
        </View>
      )}
    </Pressable>
  );
}

const WEEKDAY_ORDER = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const WEEKDAY_KO: Record<string, string> = {
  MON: '월',
  TUE: '화',
  WED: '수',
  THU: '목',
  FRI: '금',
  SAT: '토',
  SUN: '일',
};
// getDay() 0=일 … 6=토
const DEVICE_WEEKDAY = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const hoursLabel = (ot: OperatingTime) =>
  ot.open_time && ot.close_time ? `${ot.open_time} - ${ot.close_time}` : '휴무';
/** 기기 시각 기준 영업중 판정(브레이크타임 제외). */
const isOpenNow = (ot: OperatingTime, now: Date) => {
  if (!ot.open_time || !ot.close_time) return false;
  const cur = now.getHours() * 60 + now.getMinutes();
  if (cur < toMin(ot.open_time) || cur >= toMin(ot.close_time)) return false;
  if (ot.break_start_time && ot.break_end_time) {
    if (cur >= toMin(ot.break_start_time) && cur < toMin(ot.break_end_time))
      return false;
  }
  return true;
};

/** 운영시간 행 — 요일 + 시간(+오늘이면 영업중/종료). */
function DayRow({ ot, isToday }: { ot: OperatingTime; isToday: boolean }) {
  // 센터 영업시간은 한국 시각 기준이라 '지금'도 KST로 본다
  const open = isToday && isOpenNow(ot, nowKst());
  const closed = ot.open_time == null;
  return (
    <View className="flex-row items-center" style={{ columnGap: s(8) }}>
      <Typography
        variant="body-03"
        weight="medium"
        style={{ width: s(16), color: COLORS.text.body.strong }}
      >
        {WEEKDAY_KO[ot.weekday]}
      </Typography>
      <View className="flex-row items-center" style={{ columnGap: s(8) }}>
        <Typography
          variant="body-03"
          weight="medium"
          style={{
            color: closed ? COLORS.text.body.subtle : COLORS.text.body.strong,
          }}
        >
          {hoursLabel(ot)}
        </Typography>
        {isToday ? (
          <Typography
            variant="body-03"
            style={{ color: open ? COLORS.primary : COLORS.text.body.subtle }}
          >
            {open ? '영업 중' : '영업 종료'}
          </Typography>
        ) : null}
      </View>
    </View>
  );
}

/** 운영시간 카드 — 접힘=오늘, 펼침=나머지 요일이 부드럽게 드롭다운. */
function OperatingHoursCard({ times }: { times: OperatingTime[] }) {
  const [expanded, setExpanded] = useState(false);
  const [extraH, setExtraH] = useState(0);
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(expanded ? 1 : 0, {
      duration: 240,
      easing: Easing.out(Easing.cubic),
    });
  }, [expanded, progress]);

  const bodyStyle = useAnimatedStyle(() => ({
    height: extraH * progress.value,
    opacity: progress.value,
  }));
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 180}deg` }],
  }));

  if (times.length === 0) return null;

  const todayCode = DEVICE_WEEKDAY[nowKst().getDay()];
  const ordered = WEEKDAY_ORDER.map((w) =>
    times.find((t) => t.weekday === w),
  ).filter((t): t is OperatingTime => !!t);
  const today = times.find((t) => t.weekday === todayCode) ?? ordered[0];
  const others = ordered.filter((t) => t.weekday !== today.weekday);

  return (
    <View
      className="px-4 pb-4 pt-3"
      style={{ borderRadius: 12, backgroundColor: COLORS.bg['surface-sunken'] }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((v) => !v)}
        className="h-5 flex-row items-center justify-between"
      >
        <Typography
          variant="body-03"
          weight="medium"
          style={{ color: COLORS.text.title.subtle }}
        >
          운영시간
        </Typography>
        <Animated.View style={chevronStyle}>
          <ArrowDownIcon20 width={s(20)} height={s(20)} />
        </Animated.View>
      </Pressable>

      <View style={{ marginTop: s(9) }}>
        <DayRow ot={today} isToday />
      </View>

      {/* 펼침 영역 — 측정한 높이만큼 애니메이션(overflow clip). */}
      <Animated.View style={[{ overflow: 'hidden' }, bodyStyle]}>
        <View
          onLayout={(e) => setExtraH(e.nativeEvent.layout.height)}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            paddingTop: s(8),
            rowGap: s(8),
          }}
        >
          {others.map((ot) => (
            <DayRow key={ot.weekday} ot={ot} isToday={false} />
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

/** 커버 위 뒤로가기 — 상태바 아래, 대비용 흰 스크림 원형. */
function CoverBack({ top, onPress }: { top: number; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="뒤로가기"
      onPress={onPress}
      hitSlop={8}
      className="absolute left-4 items-center justify-center rounded-full"
      style={{
        top,
        width: 32,
        height: 32,
        backgroundColor: 'rgba(255,255,255,0.9)',
      }}
    >
      <Ionicons name="chevron-back" size={22} color={COLORS.gray[900]} />
    </Pressable>
  );
}

export default function CenterDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { centerId, profileId } = useLocalSearchParams<{
    centerId?: string;
    profileId?: string;
  }>();

  const centerQuery = useCenterDetail(centerId ?? null);
  const progressQuery = useProfileProgress(profileId ?? null);
  const refreshControl = useRefreshControl(() =>
    Promise.all([centerQuery.refetch(), progressQuery.refetch()]),
  );

  const center = centerQuery.data ?? null;
  const phone = center?.phone ?? null;

  // 이 센터의 진행 현황만
  const counseling = (progressQuery.data?.counseling ?? []).filter(
    (c) => c.center_id === centerId,
  );
  const assessments = (progressQuery.data?.assessments ?? []).filter(
    (a) => a.center_id === centerId,
  );

  const goCounseling = (item: CounselingProgress) =>
    router.push({
      pathname: '/(main)/counseling-case/[caseId]',
      params: { caseId: item.case_id, profileId: profileId ?? '' },
    });
  const goAssessment = (item: AssessmentProgress) =>
    router.push({
      pathname: '/(main)/assessment-case/[caseId]',
      params: { caseId: item.case_id, profileId: profileId ?? '' },
    });

  // 상태바 아래로 밀어 두는 뒤로가기 위치
  const backTop = insets.top + s(4);

  if (centerQuery.isLoading || centerQuery.isError || !center) {
    return (
      <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
        <View className="h-[52px] flex-row items-center px-4">
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color={COLORS.gray[900]} />
          </Pressable>
        </View>
        {centerQuery.isLoading ? (
          <LoadingView className="flex-1" />
        ) : (
          <ErrorView className="flex-1" onRetry={() => centerQuery.refetch()} />
        )}
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        refreshControl={refreshControl}
        contentContainerStyle={{ paddingBottom: s(40) }}
      >
        {/* 히어로 카드 — 커버가 상단 상태바까지 덮는다 */}
        <View className="bg-surface">
          <View style={{ height: insets.top + s(140) }}>
            {center.image_url ? (
              <Image
                source={{ uri: center.image_url }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover"
              />
            ) : (
              // 센터 이미지 없을 때 — 그린 글로우 플레이스홀더(장식)
              <LinearGradient
                colors={['#EBFBE3', '#DDF0F8']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CenterIcon20 width={s(40)} height={s(40)} />
              </LinearGradient>
            )}
            <CoverBack top={backTop} onPress={() => router.back()} />
          </View>

          <View className="px-4 pb-4 pt-4" style={{ rowGap: s(16) }}>
            <View style={{ rowGap: s(15) }}>
              <Typography
                variant="headline-02"
                weight="semibold"
                style={{ color: COLORS.text.title.default }}
              >
                {center.name}
              </Typography>
              {center.address || phone ? (
                <View style={{ rowGap: s(8) }}>
                  {center.address ? (
                    <View
                      className="flex-row items-center"
                      style={{ columnGap: s(4) }}
                    >
                      <LocationIcon20 width={s(20)} height={s(20)} />
                      <Typography
                        variant="body-02"
                        className="flex-1"
                        style={{ color: COLORS.text.title.default }}
                      >
                        {center.address}
                      </Typography>
                    </View>
                  ) : null}
                  {phone ? (
                    <View
                      className="flex-row items-center"
                      style={{ columnGap: s(4) }}
                    >
                      <CallIcon20 width={s(20)} height={s(20)} />
                      <Typography
                        variant="body-02"
                        style={{ color: COLORS.text.title.default }}
                      >
                        {phone}
                      </Typography>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>

            {/* 운영시간 — 접힘=오늘, 펼침=전체 */}
            <OperatingHoursCard times={center.operating_times} />

            {/* 전화·문자 — 번호가 있을 때만 */}
            {phone ? (
              <View
                className="flex-row items-center"
                style={{ columnGap: s(8) }}
              >
                <ContactButton
                  icon={<CallIcon20 width={s(20)} height={s(20)} />}
                  label="전화"
                  onPress={() => Linking.openURL(`tel:${phone}`)}
                />
                <ContactButton
                  icon={<MessageIcon20 width={s(20)} height={s(20)} />}
                  label="문자"
                  onPress={() => Linking.openURL(`sms:${phone}`)}
                />
              </View>
            ) : null}
          </View>
        </View>

        {/* 진행중인 활동 — 이 센터 */}
        <View className="mt-6 px-4">
          <Typography
            variant="body-01"
            weight="semibold"
            className="mb-3"
            style={{ color: COLORS.text.title.default }}
          >
            진행중인 활동
          </Typography>
          <ProgressHistoryCard
            counseling={counseling}
            assessments={assessments}
            loading={progressQuery.isLoading}
            onCounselingPress={goCounseling}
            onAssessmentPress={goAssessment}
          />
        </View>
      </ScrollView>
    </View>
  );
}
