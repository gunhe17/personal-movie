import { useMemo, useState } from 'react';
import { View, ScrollView, TouchableOpacity, TextInput, Pressable } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/shared/constants/theme';
import { Typography, getTypographyStyle } from '@/shared/components/ui/Typography';
import { s } from '@/shared/utils/scale';

/**
 * 상담 리스트 시안 — 풀폭 가로 카드 변주 (SkyLife 통신 요금 카드 참고).
 *
 * 4탭 비교:
 *   A 현재 (2-col grid 대조군)
 *   B 좌 아바타 + 하단 강조 박스 (SkyLife 정통 매핑)
 *   C 좌측 D-day 박스 (시간 우선)
 *   D 풀폭 + 하단 strip (좌측 영역 없음, 하단에 progress·N/M·다음 일정 통합)
 *
 * 카드 정보 구성은 production 동일 — 이름·성별/나이·프로그램·progress·상태·다음 예정일·연장필요.
 */

type CaseStatus = 'in_progress' | 'scheduled' | 'completed' | 'cancelled';

interface MockCase {
  id: string;
  name: string;
  gender: '남' | '여';
  age: number;
  extraCount: number;
  program: string;
  status: CaseStatus;
  needsExtension: boolean;
  completed: number;
  total: number;
  nextDateShort: string | null;
  nextDDay: number | null;
}

const MOCK_CASES: MockCase[] = [
  {
    id: 'c1',
    name: '홍길동',
    gender: '남',
    age: 32,
    extraCount: 2,
    program: '집단상담-그룹',
    status: 'in_progress',
    needsExtension: false,
    completed: 5,
    total: 10,
    nextDateShort: '5월 22일 (수)',
    nextDDay: 1,
  },
  {
    id: 'c2',
    name: '이영희',
    gender: '여',
    age: 28,
    extraCount: 0,
    program: '인지행동치료-개인',
    status: 'in_progress',
    needsExtension: false,
    completed: 7,
    total: 10,
    nextDateShort: '5월 25일 (토)',
    nextDDay: 4,
  },
  {
    id: 'c3',
    name: '김민준',
    gender: '남',
    age: 8,
    extraCount: 0,
    program: '놀이치료-개인',
    status: 'scheduled',
    needsExtension: false,
    completed: 0,
    total: 10,
    nextDateShort: '6월 3일 (화)',
    nextDDay: 13,
  },
  {
    id: 'c4',
    name: '박지원',
    gender: '여',
    age: 45,
    extraCount: 0,
    program: '미술치료-개인',
    status: 'in_progress',
    needsExtension: true,
    completed: 10,
    total: 10,
    nextDateShort: '5월 28일 (화)',
    nextDDay: 7,
  },
  {
    id: 'c5',
    name: '최수아',
    gender: '여',
    age: 11,
    extraCount: 1,
    program: '놀이치료-그룹',
    status: 'in_progress',
    needsExtension: false,
    completed: 3,
    total: 10,
    nextDateShort: '5월 21일 (수)',
    nextDDay: 0,
  },
  {
    id: 'c6',
    name: '정현우',
    gender: '남',
    age: 36,
    extraCount: 0,
    program: '인지행동치료-개인',
    status: 'completed',
    needsExtension: false,
    completed: 10,
    total: 10,
    nextDateShort: null,
    nextDDay: null,
  },
];

const STATUS_LABEL: Record<CaseStatus, string> = {
  in_progress: '진행중',
  scheduled: '예정',
  completed: '완료',
  cancelled: '취소',
};

const PRIMARY_BG = 'rgba(19,189,250,0.12)';

/** 상태 뱃지 — 일정 카드 ScheduleItem.StatusBadge 패턴과 동일 */
interface StatusBadgeConfig {
  bg: string;
  text: string;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'] | null;
}

const STATUS_BADGE_CONFIG: Record<CaseStatus, StatusBadgeConfig> = {
  in_progress: {
    bg: COLORS.primary50,
    text: COLORS.primary500,
    label: '진행중',
    icon: 'ellipse',
  },
  scheduled: {
    bg: COLORS.statusBadge.scheduled.bg,
    text: COLORS.statusBadge.scheduled.text,
    label: '예정',
    icon: null,
  },
  completed: {
    bg: COLORS.paletteBg.greenYellow,
    text: COLORS.palette.greenYellow,
    label: '완료',
    icon: 'checkmark',
  },
  cancelled: {
    bg: '#FFE8E8',
    text: COLORS.negative,
    label: '취소',
    icon: 'close',
  },
};

function getBadgePalette(status: CaseStatus) {
  // 레거시 호환 (A/B/D 시안에서 사용) — 작은 인라인 pill 톤
  if (status === 'completed') return { color: COLORS.primary, bg: PRIMARY_BG };
  if (status === 'in_progress') return { color: COLORS.palette.orange, bg: COLORS.paletteBg.orange };
  return { color: COLORS.palette.gray, bg: COLORS.paletteBg.gray };
}

function getProgressColor(status: CaseStatus) {
  if (status === 'cancelled') return COLORS.gray[400];
  return STATUS_BADGE_CONFIG[status].text;
}

function getAvatarPalette(c: MockCase) {
  if (c.status === 'completed') return { bg: PRIMARY_BG, color: COLORS.primary };
  if (c.needsExtension) return { bg: COLORS.paletteBg.brick, color: COLORS.palette.brick };
  if (c.extraCount > 0) return { bg: COLORS.paletteBg.violet, color: COLORS.palette.violet };
  return { bg: COLORS.paletteBg.blue, color: COLORS.palette.blue };
}

function getInitial(name: string) {
  return name.charAt(0);
}

const FILTER_TABS: { key: string; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'in_progress', label: '진행중' },
  { key: 'scheduled', label: '예정' },
  { key: 'completed', label: '완료' },
];

const VARIANTS = [
  { key: 'A', label: 'A 현재 grid' },
  { key: 'B', label: 'B 좌 아바타 + 강조' },
  { key: 'C', label: 'C 좌 D-day' },
  { key: 'D', label: 'D 풀폭 + 하단 strip' },
] as const;

type Variant = (typeof VARIANTS)[number]['key'];

// ─────────────────────────────────────── Page ───────────────────────────────────────

export default function CounselingListHorizontalLab() {
  const router = useRouter();
  const [variant, setVariant] = useState<Variant>('B');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const sortedCases = useMemo(() => {
    return [...MOCK_CASES].sort((a, b) => {
      const aDDay = a.nextDDay;
      const bDDay = b.nextDDay;
      if (aDDay === null && bDDay === null) return 0;
      if (aDDay === null) return 1;
      if (bDDay === null) return -1;
      return aDDay - bDDay;
    });
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      {/* 헤더 */}
      <View className="h-[52px] flex-row items-center gap-1.5 bg-surface px-5">
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
          accessibilityLabel="뒤로 가기"
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={24} color={COLORS.gray[900]} />
        </TouchableOpacity>
        <Typography variant="headline-02" weight="bold" className="text-gray-900">
          상담 현황 · 가로 카드
        </Typography>
      </View>

      {/* 시안 탭 */}
      <View style={{ paddingHorizontal: s(20), paddingTop: s(8), paddingBottom: s(12) }}>
        <View
          className="flex-row rounded-full bg-gray-50"
          style={{ padding: s(4) }}
        >
          {VARIANTS.map((v) => {
            const isActive = variant === v.key;
            return (
              <TouchableOpacity
                key={v.key}
                onPress={() => setVariant(v.key)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`${v.label} 시안`}
                style={{
                  flex: 1,
                  paddingVertical: s(8),
                  alignItems: 'center',
                  borderRadius: 9999,
                  backgroundColor: isActive ? COLORS.white : 'transparent',
                  shadowColor: isActive ? '#000' : 'transparent',
                  shadowOpacity: isActive ? 0.08 : 0,
                  shadowRadius: isActive ? 4 : 0,
                  shadowOffset: { width: 0, height: 1 },
                  elevation: isActive ? 1 : 0,
                }}
              >
                <Typography
                  variant="label-02"
                  weight={isActive ? 'semibold' : 'medium'}
                  className={isActive ? 'text-gray-900' : 'text-gray-500'}
                >
                  {v.label}
                </Typography>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* 검색바 */}
      <View
        style={{ paddingHorizontal: s(20), paddingBottom: s(20) }}
        className="border-b border-gray-100"
      >
        <View
          style={{ height: s(44), paddingHorizontal: s(16), gap: s(8) }}
          className="flex-row items-center rounded-[12px] bg-gray-50"
        >
          <TextInput
            style={[
              getTypographyStyle('body-01-reading', 'regular'),
              { flex: 1, color: COLORS.text.body.strong, padding: 0 },
            ]}
            placeholder="내담자 이름으로 검색해주세요"
            placeholderTextColor={COLORS.gray[400]}
            value={search}
            onChangeText={setSearch}
          />
          <Ionicons name="search-outline" size={s(18)} color={COLORS.gray[400]} />
        </View>
      </View>

      {/* 회색 영역: 필터 + 카운트 + 리스트 */}
      <View className="flex-1 bg-background">
        {/* 필터 pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: 4,
            gap: 8,
          }}
        >
          {FILTER_TABS.map((tab) => {
            const isActive = filter === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setFilter(tab.key)}
                activeOpacity={0.7}
                className={`h-9 flex-row items-center gap-1 rounded-full border px-3.5 ${
                  isActive ? 'border-gray-900 bg-gray-900' : 'border-gray-200'
                }`}
              >
                <Typography
                  variant="body-03"
                  weight="semibold"
                  className={isActive ? 'text-white' : 'text-gray-800'}
                >
                  {tab.label}
                </Typography>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* 총 N개 */}
        <View style={{ paddingHorizontal: s(20), paddingTop: s(8), paddingBottom: s(4) }}>
          <Typography variant="label-01" className="text-gray-500">
            총 {sortedCases.length}개
          </Typography>
        </View>

        {/* 리스트 */}
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: 32,
            gap: variant === 'A' ? 10 : 12,
          }}
        >
          {variant === 'A' ? (
            <GridList cases={sortedCases} />
          ) : (
            sortedCases.map((c, idx) => (
              <Animated.View
                key={c.id}
                entering={FadeIn.delay(idx * 40).duration(260)}
              >
                {variant === 'B' && <CardB case_={c} />}
                {variant === 'C' && <CardC case_={c} />}
                {variant === 'D' && <CardD case_={c} />}
              </Animated.View>
            ))
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────── A. 현재 grid (대조군) ───────────────────────────────────────

function GridList({ cases }: { cases: MockCase[] }) {
  return (
    <View style={{ gap: s(10) }}>
      {Array.from({ length: Math.ceil(cases.length / 2) }, (_, rowIdx) => {
        const left = cases[rowIdx * 2];
        const right = cases[rowIdx * 2 + 1];
        return (
          <View key={rowIdx} className="flex-row" style={{ gap: s(10) }}>
            {left ? (
              <Animated.View
                style={{ flex: 1 }}
                entering={FadeIn.delay(rowIdx * 2 * 40).duration(260)}
              >
                <CompactGridCard case_={left} />
              </Animated.View>
            ) : (
              <View className="flex-1" />
            )}
            {right ? (
              <Animated.View
                style={{ flex: 1 }}
                entering={FadeIn.delay((rowIdx * 2 + 1) * 40).duration(260)}
              >
                <CompactGridCard case_={right} />
              </Animated.View>
            ) : (
              <View className="flex-1" />
            )}
          </View>
        );
      })}
    </View>
  );
}

function CompactGridCard({ case_ }: { case_: MockCase }) {
  const badgePalette = getBadgePalette(case_.status);
  const progressColor = getProgressColor(case_.status);
  const progress = case_.total > 0 ? Math.min(case_.completed / case_.total, 1) : 0;
  const isImminent = case_.nextDDay !== null && case_.nextDDay >= 0 && case_.nextDDay <= 3;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={{
        backgroundColor: COLORS.white,
        borderRadius: s(12),
        padding: s(14),
        gap: s(12),
      }}
    >
      <View style={{ gap: s(6) }}>
        <View style={{ gap: s(2) }}>
          <View className="flex-row items-center" style={{ gap: s(6) }}>
            <Typography
              variant="body-02"
              weight="bold"
              className="text-gray-900"
              numberOfLines={1}
              style={{ flex: 1 }}
            >
              {case_.name}
              {case_.extraCount > 0 ? ` 외 ${case_.extraCount}명` : ''}
            </Typography>
            <View
              style={{ backgroundColor: badgePalette.bg }}
              className="rounded-full px-2 py-0.5"
            >
              <Typography
                variant="label-02"
                weight="semibold"
                style={{ color: badgePalette.color }}
              >
                {STATUS_LABEL[case_.status]}
              </Typography>
            </View>
          </View>
          <Typography variant="label-01" className="text-gray-500">
            {case_.gender} · 만 {case_.age}세
          </Typography>
        </View>
        <Typography
          variant="body-03"
          weight="medium"
          className="text-gray-700"
          numberOfLines={1}
        >
          {case_.program}
        </Typography>
      </View>

      <View style={{ gap: s(4) }}>
        <View
          style={{
            height: s(4),
            borderRadius: s(2),
            backgroundColor: COLORS.gray[100],
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              width: `${progress * 100}%`,
              height: '100%',
              backgroundColor: progressColor,
            }}
          />
        </View>
        <Typography
          variant="label-02"
          weight="semibold"
          style={{ color: progressColor }}
        >
          {case_.completed}/{case_.total}회
        </Typography>
      </View>

      <View style={{ height: 1, backgroundColor: COLORS.gray[100] }} />

      <View style={{ gap: s(2) }}>
        <Typography variant="label-02" className="text-gray-500">
          다음 예정일
        </Typography>
        {case_.nextDDay === 0 ? (
          <Typography
            variant="label-01"
            weight="semibold"
            style={{ color: COLORS.palette.orange }}
          >
            오늘
          </Typography>
        ) : case_.nextDDay === 1 ? (
          <Typography
            variant="label-01"
            weight="medium"
            style={{ color: COLORS.palette.orange }}
          >
            내일
          </Typography>
        ) : case_.nextDateShort && case_.nextDDay !== null ? (
          <View className="flex-row items-baseline" style={{ gap: s(6) }}>
            <Typography
              variant="label-01"
              weight="medium"
              className="text-gray-700"
              numberOfLines={1}
            >
              {case_.nextDateShort}
            </Typography>
            <Typography
              variant="label-02"
              weight="semibold"
              style={{
                color: isImminent ? COLORS.palette.orange : COLORS.gray[500],
              }}
            >
              D-{case_.nextDDay}
            </Typography>
          </View>
        ) : (
          <Typography variant="label-01" className="text-gray-400">
            -
          </Typography>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────── B. 좌 아바타 + 강조 박스 (SkyLife 매핑) ───────────────────────────────────────

function CardB({ case_ }: { case_: MockCase }) {
  const badgePalette = getBadgePalette(case_.status);
  const avatar = getAvatarPalette(case_);
  const progressColor = getProgressColor(case_.status);
  const progress = case_.total > 0 ? Math.min(case_.completed / case_.total, 1) : 0;

  /** 하단 강조 박스 콘텐츠 결정 — 연장필요 우선, 그다음 다음 예정일. */
  const highlight = (() => {
    if (case_.needsExtension) {
      return {
        icon: 'alert-circle' as const,
        color: COLORS.palette.brick,
        bg: COLORS.paletteBg.brick,
        text: '예정 회기 모두 완료 — 연장 결정이 필요해요',
      };
    }
    if (case_.nextDDay === 0) {
      return {
        icon: 'time' as const,
        color: COLORS.palette.orange,
        bg: COLORS.paletteBg.orange,
        text: `다음 회기는 오늘이에요`,
      };
    }
    if (case_.nextDDay === 1) {
      return {
        icon: 'calendar' as const,
        color: COLORS.palette.orange,
        bg: COLORS.paletteBg.orange,
        text: `다음 회기는 내일 ${case_.nextDateShort?.split(' ').slice(-1)[0] ?? ''}`,
      };
    }
    if (case_.nextDateShort && case_.nextDDay !== null) {
      const imminent = case_.nextDDay <= 3;
      return {
        icon: 'calendar' as const,
        color: imminent ? COLORS.palette.orange : COLORS.gray[600],
        bg: imminent ? COLORS.paletteBg.orange : COLORS.gray[100],
        text: `다음 회기 ${case_.nextDateShort} · D-${case_.nextDDay}`,
      };
    }
    return {
      icon: 'checkmark-circle' as const,
      color: COLORS.primary,
      bg: PRIMARY_BG,
      text: '모든 회기가 완료됐어요',
    };
  })();

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={{
        backgroundColor: COLORS.white,
        borderRadius: s(16),
        padding: s(16),
        gap: s(12),
      }}
    >
      {/* 상단 가로 배치: 좌 아바타 + 정보 stack + 우 chevron */}
      <View className="flex-row" style={{ gap: s(14) }}>
        {/* 좌 아바타 */}
        <View
          style={{
            width: s(56),
            height: s(56),
            borderRadius: s(14),
            backgroundColor: avatar.bg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography
            variant="title-01"
            weight="bold"
            style={{ color: avatar.color }}
          >
            {getInitial(case_.name)}
          </Typography>
        </View>

        {/* 정보 stack */}
        <View style={{ flex: 1, gap: s(4) }}>
          {/* 상단 라벨 row: 성별·나이 + 상태 뱃지 */}
          <View className="flex-row items-center justify-between">
            <Typography variant="label-01" className="text-gray-500">
              {case_.gender} · 만 {case_.age}세
            </Typography>
            <View
              style={{ backgroundColor: badgePalette.bg }}
              className="rounded-full px-2 py-0.5"
            >
              <Typography
                variant="label-02"
                weight="semibold"
                style={{ color: badgePalette.color }}
              >
                {STATUS_LABEL[case_.status]}
              </Typography>
            </View>
          </View>

          {/* 메인: 이름 (가격 자리) */}
          <Typography
            variant="title-01"
            weight="bold"
            className="text-gray-900"
            numberOfLines={1}
          >
            {case_.name}
            {case_.extraCount > 0 ? ` 외 ${case_.extraCount}명` : ''}
          </Typography>

          {/* 보조: 프로그램 · 진행 N/M */}
          <View className="flex-row items-center" style={{ gap: s(6) }}>
            <Typography
              variant="body-03"
              className="text-gray-600"
              numberOfLines={1}
              style={{ flexShrink: 1 }}
            >
              {case_.program}
            </Typography>
            <Typography variant="body-03" className="text-gray-300">
              |
            </Typography>
            <Typography
              variant="body-03"
              weight="semibold"
              style={{ color: progressColor }}
            >
              {case_.completed}/{case_.total}회
            </Typography>
          </View>
        </View>
      </View>

      {/* progress bar (메인 정보와 강조 박스 사이) */}
      <View
        style={{
          height: s(4),
          borderRadius: s(2),
          backgroundColor: COLORS.gray[100],
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: `${progress * 100}%`,
            height: '100%',
            backgroundColor: progressColor,
          }}
        />
      </View>

      {/* 하단 강조 박스 (밀리의 서재 자리) */}
      <View
        className="flex-row items-center"
        style={{
          backgroundColor: highlight.bg,
          borderRadius: s(10),
          paddingHorizontal: s(12),
          paddingVertical: s(10),
          gap: s(8),
        }}
      >
        <Ionicons name={highlight.icon} size={s(16)} color={highlight.color} />
        <Typography
          variant="label-01"
          weight="semibold"
          style={{ color: highlight.color, flex: 1 }}
          numberOfLines={1}
        >
          {highlight.text}
        </Typography>
      </View>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────── C. 좌측 D-day 박스 ───────────────────────────────────────

function CardC({ case_ }: { case_: MockCase }) {
  const badgeConfig = STATUS_BADGE_CONFIG[case_.status];
  const progressColor = getProgressColor(case_.status);
  const progress = case_.total > 0 ? Math.min(case_.completed / case_.total, 1) : 0;
  const isImminent = case_.nextDDay !== null && case_.nextDDay >= 0 && case_.nextDDay <= 3;

  /** 좌측 D-day 박스 색상 — 진행중/완료는 상태 뱃지 톤과 통일 */
  const dBoxPalette = (() => {
    if (case_.status === 'completed' || case_.status === 'in_progress') {
      return { bg: badgeConfig.bg, color: badgeConfig.text };
    }
    if (case_.status === 'cancelled') return { bg: COLORS.gray[100], color: COLORS.gray[500] };
    if (case_.nextDDay === null) return { bg: COLORS.gray[100], color: COLORS.gray[400] };
    if (isImminent) return { bg: COLORS.paletteBg.orange, color: COLORS.palette.orange };
    return { bg: COLORS.gray[50], color: COLORS.gray[700] };
  })();

  /** D-day 박스 상단 텍스트 — 완료/취소는 단어, 그 외 D-N */
  const dBoxTop = (() => {
    if (case_.status === 'completed') return '완료';
    if (case_.status === 'cancelled') return '취소';
    if (case_.nextDDay === null) return '일정';
    if (case_.nextDDay === 0) return 'TODAY';
    if (case_.nextDDay < 0) return `D+${Math.abs(case_.nextDDay)}`;
    return `D-${case_.nextDDay}`;
  })();

  /** D-day 박스 하단 텍스트 — 짧은 날짜 (5/22 형식). 완료/취소는 null (한 줄만 표시) */
  const dBoxBottom = (() => {
    if (case_.status === 'completed' || case_.status === 'cancelled') return null;
    if (case_.nextDDay === null) return '미정';
    const match = case_.nextDateShort?.match(/(\d+)월\s*(\d+)일/);
    if (!match) return '';
    return `${match[1]}/${match[2]}`;
  })();

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={{
        backgroundColor: COLORS.white,
        borderRadius: s(16),
        padding: s(14),
        flexDirection: 'row',
        gap: s(14),
        alignItems: 'stretch',
      }}
    >
      {/* 좌측 D-day 박스 */}
      <View
        style={{
          width: s(72),
          backgroundColor: dBoxPalette.bg,
          borderRadius: s(12),
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: s(10),
          gap: s(2),
        }}
      >
        <Typography
          variant="body-01"
          weight="bold"
          style={{ color: dBoxPalette.color }}
        >
          {dBoxTop}
        </Typography>
        {dBoxBottom != null && (
          <Typography
            variant="label-02"
            weight="medium"
            style={{ color: dBoxPalette.color, opacity: 0.85 }}
          >
            {dBoxBottom}
          </Typography>
        )}
      </View>

      {/* 우측 정보 stack */}
      <View style={{ flex: 1, gap: s(8) }}>
        {/* 이름 + 상태 뱃지 */}
        <View className="flex-row items-center" style={{ gap: s(6) }}>
          <Typography
            variant="body-01"
            weight="bold"
            className="text-gray-900"
            numberOfLines={1}
            style={{ flex: 1 }}
          >
            {case_.name}
            {case_.extraCount > 0 ? ` 외 ${case_.extraCount}명` : ''}
          </Typography>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: badgeConfig.bg,
              paddingHorizontal: s(8),
              paddingVertical: s(4),
              borderRadius: s(8),
              gap: s(4),
            }}
          >
            {badgeConfig.icon && (
              <Ionicons
                name={badgeConfig.icon}
                size={case_.status === 'in_progress' ? 8 : 12}
                color={badgeConfig.text}
              />
            )}
            <Typography
              variant="label-02"
              weight="semibold"
              style={{ color: badgeConfig.text }}
            >
              {badgeConfig.label}
            </Typography>
          </View>
        </View>

        {/* 성별 나이 · 프로그램 */}
        <View className="flex-row items-center" style={{ gap: s(6) }}>
          <Typography variant="label-01" className="text-gray-500">
            {case_.gender} · 만 {case_.age}세
          </Typography>
          <Typography variant="label-01" className="text-gray-300">
            |
          </Typography>
          <Typography
            variant="label-01"
            className="text-gray-600"
            numberOfLines={1}
            style={{ flexShrink: 1 }}
          >
            {case_.program}
          </Typography>
        </View>

        {/* progress bar + N/M회 */}
        <View className="flex-row items-center" style={{ gap: s(8) }}>
          <View
            style={{
              flex: 1,
              height: s(4),
              borderRadius: s(2),
              backgroundColor: COLORS.gray[100],
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                width: `${progress * 100}%`,
                height: '100%',
                backgroundColor: progressColor,
              }}
            />
          </View>
          <Typography
            variant="label-02"
            weight="semibold"
            style={{ color: progressColor }}
          >
            {case_.completed}/{case_.total}회
          </Typography>
        </View>

        {/* 연장필요 inline */}
        {case_.needsExtension && (
          <View className="flex-row items-center" style={{ gap: s(4) }}>
            <Ionicons name="alert-circle" size={s(12)} color={COLORS.palette.brick} />
            <Typography
              variant="label-02"
              weight="semibold"
              style={{ color: COLORS.palette.brick }}
            >
              연장 결정 필요
            </Typography>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────── D. 풀폭 + 하단 strip ───────────────────────────────────────

function CardD({ case_ }: { case_: MockCase }) {
  const badgePalette = getBadgePalette(case_.status);
  const progressColor = getProgressColor(case_.status);
  const progress = case_.total > 0 ? Math.min(case_.completed / case_.total, 1) : 0;
  const isImminent = case_.nextDDay !== null && case_.nextDDay >= 0 && case_.nextDDay <= 3;

  const stripBg = case_.needsExtension
    ? COLORS.paletteBg.brick
    : isImminent
      ? COLORS.paletteBg.orange
      : COLORS.gray[50];

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={{
        backgroundColor: COLORS.white,
        borderRadius: s(16),
        overflow: 'hidden',
      }}
    >
      {/* 상단 본문 */}
      <View style={{ padding: s(16), gap: s(8) }}>
        {/* 메인 행: 이름 + 상태 뱃지 */}
        <View className="flex-row items-center" style={{ gap: s(8) }}>
          <Typography
            variant="title-01"
            weight="bold"
            className="text-gray-900"
            numberOfLines={1}
            style={{ flex: 1 }}
          >
            {case_.name}
            {case_.extraCount > 0 ? ` 외 ${case_.extraCount}명` : ''}
          </Typography>
          <View
            style={{ backgroundColor: badgePalette.bg }}
            className="rounded-full px-2.5 py-1"
          >
            <Typography
              variant="label-02"
              weight="semibold"
              style={{ color: badgePalette.color }}
            >
              {STATUS_LABEL[case_.status]}
            </Typography>
          </View>
        </View>

        {/* 메타: 성별 나이 */}
        <Typography variant="body-03" className="text-gray-500">
          {case_.gender} · 만 {case_.age}세
        </Typography>

        {/* 프로그램 */}
        <Typography
          variant="body-03"
          weight="medium"
          className="text-gray-700"
          numberOfLines={1}
        >
          {case_.program}
        </Typography>
      </View>

      {/* 하단 통합 strip — progress + N/M + 다음 일정 */}
      <View
        style={{
          backgroundColor: stripBg,
          paddingHorizontal: s(16),
          paddingVertical: s(12),
          gap: s(8),
        }}
      >
        <View
          style={{
            height: s(4),
            borderRadius: s(2),
            backgroundColor: 'rgba(0,0,0,0.06)',
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              width: `${progress * 100}%`,
              height: '100%',
              backgroundColor: progressColor,
            }}
          />
        </View>
        <View className="flex-row items-center justify-between">
          <Typography
            variant="label-01"
            weight="semibold"
            style={{ color: progressColor }}
          >
            {case_.completed}/{case_.total}회
          </Typography>

          {case_.needsExtension ? (
            <View className="flex-row items-center" style={{ gap: s(4) }}>
              <Ionicons name="alert-circle" size={s(14)} color={COLORS.palette.brick} />
              <Typography
                variant="label-01"
                weight="semibold"
                style={{ color: COLORS.palette.brick }}
              >
                연장 결정 필요
              </Typography>
            </View>
          ) : case_.nextDDay === null ? (
            <Typography variant="label-01" className="text-gray-400">
              일정 미정
            </Typography>
          ) : (
            <View className="flex-row items-baseline" style={{ gap: s(6) }}>
              <Typography
                variant="label-01"
                weight="medium"
                className="text-gray-700"
              >
                {case_.nextDDay === 0
                  ? '오늘'
                  : case_.nextDDay === 1
                    ? `내일 ${case_.nextDateShort?.split(' ').slice(-1)[0] ?? ''}`
                    : case_.nextDateShort}
              </Typography>
              {case_.nextDDay >= 2 && (
                <Typography
                  variant="label-02"
                  weight="semibold"
                  style={{
                    color: isImminent ? COLORS.palette.orange : COLORS.gray[500],
                  }}
                >
                  D-{case_.nextDDay}
                </Typography>
              )}
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}
