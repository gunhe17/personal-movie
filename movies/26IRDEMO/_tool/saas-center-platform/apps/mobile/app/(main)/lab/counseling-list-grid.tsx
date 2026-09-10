import { useMemo, useState } from 'react';
import { View, ScrollView, TouchableOpacity, TextInput, Pressable } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, LAYOUT } from '@/shared/constants/theme';
import { Typography, getTypographyStyle } from '@/shared/components/ui/Typography';
import { Icon } from '@/shared/components/icons';
import { s } from '@/shared/utils/scale';

/**
 * 상담 리스트 시안 — 2-column grid (compact 카드).
 *
 * 의도: 현재 production 의 긴 가로 카드가 내담자 상세와 시각 유사해지는 우려 해소.
 *       2-col grid 로 더 많은 케이스를 한 화면에, 카드 간 시각 차별 명확.
 *
 * 변경 범위: 카드 layout 만 (헤더·검색·필터 chrome 은 production 동일).
 * 시안 확정 후 production main `counseling/index.tsx` 에 반영.
 */

type CaseStatus = 'in_progress' | 'scheduled' | 'completed' | 'cancelled';

interface MockCase {
  id: string;
  name: string;
  gender: '남' | '여';
  age: number;
  extraCount: number;
  program: string; // [치료프로그램명]-[개인/그룹]
  status: CaseStatus;
  needsExtension: boolean;
  completed: number;
  total: number;
  nextDateShort: string | null; // "3월 25일 (수)"
  nextDDay: number | null; // 음수 = 지남, 0=오늘, 1=내일, N=N일 후
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

function getBadgePalette(status: CaseStatus) {
  if (status === 'completed') return { color: COLORS.primary, bg: 'rgba(19,189,250,0.12)' };
  if (status === 'in_progress') return { color: COLORS.palette.orange, bg: COLORS.paletteBg.orange };
  return { color: COLORS.palette.gray, bg: COLORS.paletteBg.gray };
}

function getProgressColor(status: CaseStatus) {
  if (status === 'completed') return COLORS.primary;
  if (status === 'scheduled' || status === 'cancelled') return COLORS.gray[400];
  return COLORS.palette.orange;
}

function formatDDay(days: number): string {
  if (days === 0) return '오늘';
  if (days === 1) return '내일';
  if (days < 0) return `D+${Math.abs(days)}`;
  return `D-${days}`;
}

// ──────────────── Page ────────────────

const FILTER_TABS: { key: string; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'in_progress', label: '진행중' },
  { key: 'scheduled', label: '예정' },
  { key: 'completed', label: '완료' },
];

export default function CounselingListGridLab() {
  const router = useRouter();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  /** 정렬: 다음 상담일 가까운 순 (오늘·내일·임박이 상위로). null/없음은 맨 뒤. */
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
          상담 현황 · 그리드
        </Typography>
      </View>

      {/* 검색바 */}
      <View
        style={{ paddingHorizontal: s(20), paddingTop: s(16), paddingBottom: s(20) }}
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

      {/* 회색 영역: 필터 + 카운트 + 그리드 */}
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
        <View style={{ paddingHorizontal: s(20), paddingBottom: s(4) }}>
          <Typography variant="label-01" className="text-gray-500">
            총 {sortedCases.length}개
          </Typography>
        </View>

        {/* 2-column grid */}
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: 32,
            gap: 10,
          }}
        >
          {Array.from(
            { length: Math.ceil(sortedCases.length / 2) },
            (_, rowIdx) => {
              const left = sortedCases[rowIdx * 2];
              const right = sortedCases[rowIdx * 2 + 1];
              const leftIdx = rowIdx * 2;
              const rightIdx = rowIdx * 2 + 1;
              return (
                <View key={rowIdx} className="flex-row" style={{ gap: s(10) }}>
                  {left ? (
                    <Animated.View
                      style={{ flex: 1 }}
                      entering={FadeIn.delay(leftIdx * 50).duration(280)}
                    >
                      <CompactCaseCard case_={left} />
                    </Animated.View>
                  ) : (
                    <View className="flex-1" />
                  )}
                  {right ? (
                    <Animated.View
                      style={{ flex: 1 }}
                      entering={FadeIn.delay(rightIdx * 50).duration(280)}
                    >
                      <CompactCaseCard case_={right} />
                    </Animated.View>
                  ) : (
                    <View className="flex-1" />
                  )}
                </View>
              );
            },
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

// ──────────────── Compact Case Card ────────────────

function CompactCaseCard({ case_ }: { case_: MockCase }) {
  const [showExtTip, setShowExtTip] = useState(false);
  const badgePalette = getBadgePalette(case_.status);
  const progressColor = getProgressColor(case_.status);
  const progress = case_.total > 0 ? Math.min(case_.completed / case_.total, 1) : 0;
  const isImminent = case_.nextDDay !== null && case_.nextDDay >= 0 && case_.nextDDay <= 3;

  return (
    <View style={{ position: 'relative', flex: 1 }}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => {
          if (showExtTip) setShowExtTip(false);
        }}
        style={{
          backgroundColor: COLORS.white,
          borderRadius: s(12),
          padding: s(14),
          gap: s(12),
        }}
      >
        {/* 식별 그룹: 이름·메타·프로그램 */}
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

        {/* 진행 그룹: progress bar + N/M회 */}
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

        {/* divider — 진행/일정 영역 분리 */}
        <View
          style={{
            height: 1,
            backgroundColor: COLORS.gray[100],
          }}
        />

        {/* 일정 그룹: 다음 예정일 라벨 + 값 */}
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
            <View
              className="flex-row items-baseline"
              style={{ gap: s(6) }}
            >
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

      {/* 연장필요 — 우상단 floating marker */}
      {case_.needsExtension && (
        <>
          <Pressable
            onPress={() => setShowExtTip((v) => !v)}
            hitSlop={8}
            style={{
              position: 'absolute',
              top: -s(6),
              right: -s(6),
              width: s(26),
              height: s(26),
              borderRadius: s(13),
              backgroundColor: COLORS.palette.brick,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 2,
              borderColor: COLORS.white,
              shadowColor: '#000',
              shadowOpacity: 0.18,
              shadowRadius: 4,
              shadowOffset: { width: 0, height: 2 },
              elevation: 4,
              zIndex: 5,
            }}
          >
            <Ionicons name="alert" size={s(14)} color={COLORS.white} />
          </Pressable>

          {showExtTip && (
            <View
              style={{
                position: 'absolute',
                bottom: '100%',
                right: 0,
                marginBottom: s(12),
                backgroundColor: COLORS.gray[900],
                paddingHorizontal: s(12),
                paddingVertical: s(10),
                borderRadius: s(8),
                maxWidth: s(210),
                gap: s(2),
                shadowColor: '#000',
                shadowOpacity: 0.22,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 4 },
                elevation: 8,
                zIndex: 10,
              }}
            >
              <Typography
                variant="label-02"
                weight="semibold"
                style={{ color: COLORS.white }}
              >
                마지막 예정 회기가 {case_.nextDDay ?? 0}일 후예요
              </Typography>
              <Typography
                variant="label-02"
                weight="medium"
                style={{ color: COLORS.white, opacity: 0.85 }}
              >
                상담을 연장할 수 있어요
              </Typography>
            </View>
          )}
        </>
      )}
    </View>
  );
}
