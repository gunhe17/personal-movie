import { useMemo, useState } from 'react';
import { View, ScrollView, TouchableOpacity, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Icon, type IconName } from '@/shared/components/icons';
import { Typography } from '@/shared/components/ui/Typography';
import { BadgeRound } from '@/shared/components/ui/BadgeRound';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';

/**
 * LAB / 일정 상태 라벨 — 실험 화면
 *
 * 컨셉:
 *   - 홈 카드의 상태 라벨(예정/진행중/취소)을 더 직관적으로 표현하는 3가지 시도를
 *     같은 mock 데이터에 적용하여 한 화면에서 비교.
 *
 * 버전:
 *   A) 남은/경과 시간 강조 (Time-relative)
 *   B) 신호등 신호 (Contextual visual cue, NOW/다음/대기/종료)
 *   C) 자연어 + 절대 시각 (Natural language)
 *
 * 취소 일정 처리:
 *   A — DISABLED (opacity + line-through + 컬러바 회색화)
 *   B — DISABLED (살짝 톤 다운, "취소" 뱃지)
 *   C — 리스트 최하단 분리 ("취소된 일정" 섹션 헤더)
 *
 * 시뮬레이션 토글:
 *   상단에서 현재 시각을 "오전 9시 / 오후 1시 30분 / 오후 5시"로 가상 변경하여
 *   라벨이 어떻게 바뀌는지 직접 확인 가능.
 *
 * 모든 데이터는 화면 내 Mock. API 연동 없음.
 */

/* ────────────────────────────────────────────────
 * 타입 / Mock
 * ──────────────────────────────────────────────── */

type ScheduleType = 'counseling' | 'assessment' | 'meeting' | 'block';
type Gender = 'female' | 'male';
type RawStatus = 'scheduled' | 'completed' | 'no_show' | 'cancelled';

interface MockSchedule {
  id: string;
  startMin: number; // 0~1440 (분 단위, 오늘 기준)
  endMin: number;
  schedule_type: ScheduleType;
  room_name: string | null;
  client: { name: string; gender: Gender; age: number } | null;
  title: string | null;
  raw_status: RawStatus;
}

const TYPE_LABELS: Record<ScheduleType, string> = {
  counseling: '상담',
  assessment: '검사',
  meeting: '회의',
  block: '블록',
};

const TYPE_COLORS: Record<ScheduleType, string> = {
  counseling: COLORS.primary,
  assessment: '#F49937',
  meeting: '#6c757d',
  block: '#ced4da',
};

// 분 단위 → "HH:mm"
function fmtTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// 분 단위 → 자연어 ("오전 9시", "오후 1시 30분")
function fmtNatural(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const ampm = h < 12 ? '오전' : '오후';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${ampm} ${h12}시` : `${ampm} ${h12}시 ${m}분`;
}

/* ────────────────────────────────────────────────
 * Mock 데이터 (시뮬레이션 now=13:30 기준으로 다양한 상태)
 *   - 09:00-10:00 완료
 *   - 13:00-13:30 방금 종료 (now=13:30 일 때)
 *   - 13:00-14:30 진행중 (now=13:30 일 때)
 *   - 13:45-14:30 곧 시작 (15분 뒤)
 *   - 15:30-16:30 오후 후반
 *   - 14:00-15:00 취소됨
 * ──────────────────────────────────────────────── */

const MOCK: MockSchedule[] = [
  {
    id: 'm1',
    startMin: 9 * 60,
    endMin: 10 * 60,
    schedule_type: 'counseling',
    room_name: '101호',
    client: { name: '김민서', gender: 'female', age: 32 },
    title: null,
    raw_status: 'completed',
  },
  {
    id: 'm2',
    startMin: 13 * 60,
    endMin: 13 * 60 + 30,
    schedule_type: 'assessment',
    room_name: '검사실 A',
    client: { name: '이도현', gender: 'male', age: 12 },
    title: null,
    raw_status: 'scheduled',
  },
  {
    id: 'm3',
    startMin: 13 * 60,
    endMin: 14 * 60 + 30,
    schedule_type: 'counseling',
    room_name: '202호',
    client: { name: '박지유', gender: 'female', age: 28 },
    title: null,
    raw_status: 'scheduled',
  },
  {
    id: 'm4',
    startMin: 13 * 60 + 45,
    endMin: 14 * 60 + 30,
    schedule_type: 'counseling',
    room_name: '301호',
    client: { name: '최서진', gender: 'female', age: 19 },
    title: null,
    raw_status: 'scheduled',
  },
  {
    id: 'm5',
    startMin: 15 * 60 + 30,
    endMin: 16 * 60 + 30,
    schedule_type: 'assessment',
    room_name: '검사실 B',
    client: { name: '정한결', gender: 'male', age: 8 },
    title: null,
    raw_status: 'scheduled',
  },
  {
    id: 'm6',
    startMin: 14 * 60,
    endMin: 15 * 60,
    schedule_type: 'counseling',
    room_name: '102호',
    client: { name: '윤하은', gender: 'female', age: 41 },
    title: null,
    raw_status: 'cancelled',
  },
];

/* ────────────────────────────────────────────────
 * 시뮬레이션 시각 토글
 * ──────────────────────────────────────────────── */

const SIM_OPTIONS: Array<{ key: string; label: string; nowMin: number }> = [
  { key: 'morning', label: '오전 9시', nowMin: 9 * 60 },
  { key: 'noon', label: '오후 1시 30분', nowMin: 13 * 60 + 30 },
  { key: 'evening', label: '오후 5시', nowMin: 17 * 60 },
];

/* ────────────────────────────────────────────────
 * 메인 화면
 * ──────────────────────────────────────────────── */

export default function ScheduleStatusLabelsLab() {
  const router = useRouter();
  const [simKey, setSimKey] = useState<string>('noon');
  const nowMin = useMemo(
    () => SIM_OPTIONS.find((o) => o.key === simKey)?.nowMin ?? 13 * 60 + 30,
    [simKey],
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* 헤더 */}
      <View className="h-12 flex-row items-center px-5">
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityLabel="뒤로 가기"
          accessibilityRole="button"
        >
          <Icon name="arrow-left" size={24} color={COLORS.gray[900]} />
        </TouchableOpacity>
        <View className="flex-1 items-center">
          <Typography variant="title-01" weight="semibold" className="text-gray-900">
            일정 상태 라벨 실험
          </Typography>
        </View>
        <View style={{ width: s(24) }} />
      </View>

      <ScrollView
        contentContainerClassName="pb-12"
        showsVerticalScrollIndicator={false}
      >
        {/* 시뮬레이션 토글 */}
        <View style={{ paddingHorizontal: s(20), paddingVertical: s(12) }}>
          <Typography
            variant="label-01"
            weight="medium"
            className="text-gray-600"
            style={{ marginBottom: s(8) }}
          >
            현재 시각 시뮬레이션
          </Typography>
          <View style={{ gap: s(8) }} className="flex-row">
            {SIM_OPTIONS.map((opt) => {
              const active = opt.key === simKey;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => setSimKey(opt.key)}
                  style={{
                    flex: 1,
                    height: s(36),
                    borderRadius: s(10),
                    borderWidth: 1,
                    borderColor: active ? COLORS.primary : COLORS.gray[200],
                    backgroundColor: active ? COLORS.primary50 : '#FFFFFF',
                  }}
                  className="items-center justify-center"
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Typography
                    variant="label-01"
                    weight={active ? 'semibold' : 'medium'}
                    style={{ color: active ? COLORS.primary : COLORS.gray[700] }}
                  >
                    {opt.label}
                  </Typography>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* 버전 A */}
        <SectionHeader
          title="버전 A — 남은/경과 시간 강조"
          description="시간 거리를 라벨에 직접. 취소: DISABLED 처리."
        />
        <View style={{ gap: s(10), paddingHorizontal: s(20) }}>
          {MOCK.map((item) => (
            <VersionACard key={`a-${item.id}`} item={item} nowMin={nowMin} />
          ))}
        </View>

        <View style={{ height: s(28) }} />

        {/* 버전 B */}
        <SectionHeader
          title="버전 B — 신호등 신호 (NOW/다음/대기)"
          description="짧은 단어 + 색/도트. 진행중·다음만 부각. 취소: DISABLED."
        />
        <View style={{ gap: s(10), paddingHorizontal: s(20) }}>
          <VersionBList items={MOCK} nowMin={nowMin} />
        </View>

        <View style={{ height: s(28) }} />

        {/* 버전 C */}
        <SectionHeader
          title="버전 C — 자연어 + 절대 시각"
          description="사람에게 말하듯 표현. 취소는 리스트 하단 분리."
        />
        <VersionCList items={MOCK} nowMin={nowMin} />

        <View style={{ height: s(16) }} />
      </ScrollView>
    </SafeAreaView>
  );
}

/* ────────────────────────────────────────────────
 * 섹션 헤더
 * ──────────────────────────────────────────────── */

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <View
      style={{
        paddingHorizontal: s(20),
        paddingTop: s(16),
        paddingBottom: s(10),
      }}
    >
      <Typography variant="title-01" weight="semibold" className="text-gray-900">
        {title}
      </Typography>
      <Typography
        variant="body-03"
        className="text-gray-600"
        style={{ marginTop: s(2) }}
      >
        {description}
      </Typography>
    </View>
  );
}

/* ────────────────────────────────────────────────
 * 공통: 카드 내부 행 (시간 컬럼 + 정보 + 라벨 슬롯)
 * ──────────────────────────────────────────────── */

interface CardBaseProps {
  item: MockSchedule;
  disabled?: boolean;
  emphasized?: boolean;
  labelSlot: React.ReactNode;
  // 시간 컬럼 표시 방식 ('default' | 'muted' | 'hidden')
  timeColumn?: 'default' | 'muted' | 'hidden';
}

function ScheduleCardBase({
  item,
  disabled = false,
  emphasized = false,
  labelSlot,
  timeColumn = 'default',
}: CardBaseProps) {
  const typeColor = disabled
    ? COLORS.gray[300]
    : TYPE_COLORS[item.schedule_type] ?? COLORS.gray[400];
  const typeLabel = TYPE_LABELS[item.schedule_type];
  const barWidth = emphasized ? s(6) : s(3);

  const textColor = disabled ? COLORS.gray[400] : COLORS.gray[800];
  const subTextColor = disabled ? COLORS.gray[400] : COLORS.gray[600];
  const cardBg = emphasized ? '#FFFFFF' : '#FFFFFF';
  const cardBorderColor = emphasized ? COLORS.primary : 'transparent';
  const cardBorderWidth = emphasized ? 1 : 0;

  const timeOpacity =
    timeColumn === 'hidden' ? 0 : timeColumn === 'muted' ? 0.55 : 1;

  return (
    <View
      style={{
        height: s(92),
        backgroundColor: cardBg,
        borderWidth: cardBorderWidth,
        borderColor: cardBorderColor,
        opacity: disabled ? 0.55 : 1,
      }}
      className="flex-row overflow-hidden rounded-r-lg"
    >
      <View style={{ backgroundColor: typeColor, width: barWidth }} />
      <View
        style={{ gap: s(12), paddingHorizontal: s(16), paddingVertical: s(12) }}
        className="flex-1 flex-row items-center"
      >
        {/* 시간 컬럼 */}
        <View style={{ gap: s(2), opacity: timeOpacity }} className="items-center">
          <Typography
            variant="body-03"
            weight="medium"
            style={{ color: disabled ? COLORS.gray[400] : COLORS.gray[500] }}
          >
            {fmtTime(item.startMin)}
          </Typography>
          <View style={{ height: s(8) }} className="w-px bg-gray-300" />
          <Typography
            variant="body-03"
            weight="medium"
            style={{ color: disabled ? COLORS.gray[400] : COLORS.gray[500] }}
          >
            {fmtTime(item.endMin)}
          </Typography>
        </View>

        {/* 내담자 + 정보 */}
        <View className="flex-1">
          <View className="flex-row items-center">
            {item.client ? (
              <>
                <Typography
                  variant="body-01"
                  weight="semibold"
                  style={{
                    color: textColor,
                    textDecorationLine: disabled ? 'line-through' : 'none',
                  }}
                >
                  {item.client.name}
                </Typography>
                <Typography
                  variant="body-03"
                  weight="medium"
                  style={{ marginLeft: s(8), color: subTextColor }}
                >
                  {item.client.gender === 'female' ? '여' : '남'}
                </Typography>
                <View
                  style={{ marginHorizontal: s(6), height: s(10) }}
                  className="w-px bg-gray-300"
                />
                <Typography
                  variant="body-03"
                  weight="medium"
                  style={{ color: subTextColor }}
                >
                  만 {item.client.age}세
                </Typography>
              </>
            ) : (
              <Typography
                variant="body-01"
                weight="semibold"
                style={{ color: textColor }}
              >
                {item.title ?? typeLabel}
              </Typography>
            )}
          </View>

          <View style={{ marginTop: s(4), gap: s(2) }}>
            {item.room_name && (
              <InfoLine
                icon="location-16"
                color={disabled ? COLORS.gray[400] : COLORS.gray[500]}
                textColor={disabled ? COLORS.gray[500] : COLORS.gray[700]}
              >
                {item.room_name}
              </InfoLine>
            )}
            <InfoLine
              icon="program-16"
              color={disabled ? COLORS.gray[400] : COLORS.gray[500]}
              textColor={disabled ? COLORS.gray[500] : COLORS.gray[700]}
            >
              {typeLabel}
            </InfoLine>
          </View>
        </View>

        {/* 라벨 슬롯 */}
        <View className="self-start">{labelSlot}</View>
      </View>
    </View>
  );
}

function InfoLine({
  icon,
  color,
  textColor,
  children,
}: {
  icon: IconName;
  color: string;
  textColor: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: s(6) }} className="flex-row items-center">
      <Icon name={icon} size={s(16)} color={color} />
      <Typography variant="body-03" style={{ color: textColor }}>
        {children}
      </Typography>
    </View>
  );
}

/* ────────────────────────────────────────────────
 * 버전 A — 남은/경과 시간 강조
 *   - 진행중 · 30분 남음
 *   - 15분 뒤 시작
 *   - 방금 시작 (±5분)
 *   - 방금 종료 (종료 후 30분 이내)
 *   - 완료 / 취소(disabled)
 * ──────────────────────────────────────────────── */

function VersionACard({
  item,
  nowMin,
}: {
  item: MockSchedule;
  nowMin: number;
}) {
  const { startMin, endMin, raw_status } = item;

  if (raw_status === 'cancelled') {
    return (
      <ScheduleCardBase
        item={item}
        disabled
        labelSlot={<BadgeRound variant="error">취소됨</BadgeRound>}
      />
    );
  }
  if (raw_status === 'no_show') {
    return (
      <ScheduleCardBase
        item={item}
        labelSlot={<BadgeRound variant="gray">노쇼</BadgeRound>}
      />
    );
  }
  if (raw_status === 'completed' || endMin <= nowMin - 30) {
    return (
      <ScheduleCardBase
        item={item}
        labelSlot={<BadgeRound variant="primary">완료</BadgeRound>}
      />
    );
  }

  // 진행중
  if (startMin <= nowMin && nowMin < endMin) {
    const remaining = endMin - nowMin;
    const text =
      Math.abs(nowMin - startMin) <= 5
        ? '방금 시작'
        : `진행중 · ${formatMinutes(remaining)} 남음`;
    return (
      <ScheduleCardBase
        item={item}
        labelSlot={<BadgeRound variant="warning">{text}</BadgeRound>}
      />
    );
  }

  // 방금 종료
  if (endMin <= nowMin && nowMin < endMin + 30) {
    return (
      <ScheduleCardBase
        item={item}
        labelSlot={<BadgeRound variant="gray">방금 종료</BadgeRound>}
      />
    );
  }

  // 미래
  const toStart = startMin - nowMin;
  if (toStart <= 5) {
    return (
      <ScheduleCardBase
        item={item}
        labelSlot={<BadgeRound variant="success">곧 시작</BadgeRound>}
      />
    );
  }
  return (
    <ScheduleCardBase
      item={item}
      labelSlot={
        <BadgeRound variant="gray">{`${formatMinutes(toStart)} 뒤`}</BadgeRound>
      }
    />
  );
}

function formatMinutes(min: number): string {
  if (min < 60) return `${min}분`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (m === 0) return `${h}시간`;
  return `${h}시간 ${m}분`;
}

/* ────────────────────────────────────────────────
 * 버전 B — 신호등 신호 (NOW / 다음 / 대기 / 종료 / 취소)
 *   - 진행중 카드: 빨강 도트 + "NOW" 뱃지 + 좌측 컬러바 굵게 + primary 보더 강조
 *   - 가장 가까운 미래 일정 1건만 "다음" 으로 강조
 *   - 나머지 미래는 "대기" (gray)
 *   - 과거 완료는 "종료" (gray)
 *   - 취소는 DISABLED + "취소"
 * ──────────────────────────────────────────────── */

function VersionBList({
  items,
  nowMin,
}: {
  items: MockSchedule[];
  nowMin: number;
}) {
  // "다음" 후보: cancelled/no_show 제외, 시작 미래
  const nextId = useMemo(() => {
    const candidates = items
      .filter(
        (i) =>
          i.raw_status !== 'cancelled' &&
          i.raw_status !== 'no_show' &&
          i.startMin > nowMin,
      )
      .sort((a, b) => a.startMin - b.startMin);
    return candidates[0]?.id ?? null;
  }, [items, nowMin]);

  return (
    <View style={{ gap: s(10) }}>
      {items.map((item) => (
        <VersionBCard
          key={`b-${item.id}`}
          item={item}
          nowMin={nowMin}
          isNext={item.id === nextId}
        />
      ))}
    </View>
  );
}

function VersionBCard({
  item,
  nowMin,
  isNext,
}: {
  item: MockSchedule;
  nowMin: number;
  isNext: boolean;
}) {
  const { startMin, endMin, raw_status } = item;

  if (raw_status === 'cancelled') {
    return (
      <ScheduleCardBase
        item={item}
        disabled
        labelSlot={<BadgeRound variant="gray">취소</BadgeRound>}
      />
    );
  }
  if (raw_status === 'no_show') {
    return (
      <ScheduleCardBase
        item={item}
        labelSlot={<BadgeRound variant="gray">노쇼</BadgeRound>}
      />
    );
  }

  // 진행중 — NOW 강조
  if (
    raw_status !== 'completed' &&
    startMin <= nowMin &&
    nowMin < endMin
  ) {
    return (
      <ScheduleCardBase
        item={item}
        emphasized
        labelSlot={
          <View
            style={{
              height: s(28),
              paddingHorizontal: s(10),
              borderRadius: s(999),
              backgroundColor: COLORS.error,
              gap: s(6),
            }}
            className="flex-row items-center"
          >
            <View
              style={{
                width: s(6),
                height: s(6),
                borderRadius: s(999),
                backgroundColor: '#FFFFFF',
              }}
            />
            <Typography
              variant="label-01"
              weight="semibold"
              style={{ color: '#FFFFFF' }}
            >
              NOW
            </Typography>
          </View>
        }
      />
    );
  }

  // 종료
  if (raw_status === 'completed' || endMin <= nowMin) {
    return (
      <ScheduleCardBase
        item={item}
        labelSlot={<BadgeRound variant="gray">종료</BadgeRound>}
      />
    );
  }

  // 다음 (가장 가까운 미래)
  if (isNext) {
    return (
      <ScheduleCardBase
        item={item}
        emphasized
        labelSlot={<BadgeRound variant="primary">다음</BadgeRound>}
      />
    );
  }

  // 대기
  return (
    <ScheduleCardBase
      item={item}
      labelSlot={<BadgeRound variant="gray">대기</BadgeRound>}
    />
  );
}

/* ────────────────────────────────────────────────
 * 버전 C — 자연어 + 절대 시각
 *   - 지금 진행 중
 *   - 오후 2시 시작
 *   - 이미 종료
 *   - 오후 1시 종료 (방금 종료 30분 이내)
 *   - 시간 컬럼은 톤다운(muted)하여 라벨이 메인
 *   - 취소는 리스트 최하단으로 분리
 * ──────────────────────────────────────────────── */

function VersionCList({
  items,
  nowMin,
}: {
  items: MockSchedule[];
  nowMin: number;
}) {
  const active = items.filter((i) => i.raw_status !== 'cancelled');
  const cancelled = items.filter((i) => i.raw_status === 'cancelled');

  return (
    <View>
      <View style={{ gap: s(10), paddingHorizontal: s(20) }}>
        {active.map((item) => (
          <VersionCCard key={`c-${item.id}`} item={item} nowMin={nowMin} />
        ))}
      </View>

      {cancelled.length > 0 && (
        <>
          <View
            style={{
              marginTop: s(20),
              marginHorizontal: s(20),
              paddingTop: s(12),
              borderTopWidth: 1,
              borderTopColor: COLORS.gray[200],
            }}
          >
            <Typography
              variant="label-01"
              weight="medium"
              className="text-gray-500"
              style={{ marginBottom: s(8) }}
            >
              취소된 일정 ({cancelled.length})
            </Typography>
          </View>
          <View style={{ gap: s(10), paddingHorizontal: s(20) }}>
            {cancelled.map((item) => (
              <VersionCCard
                key={`c-${item.id}`}
                item={item}
                nowMin={nowMin}
                forceCancelled
              />
            ))}
          </View>
        </>
      )}
    </View>
  );
}

function VersionCCard({
  item,
  nowMin,
  forceCancelled = false,
}: {
  item: MockSchedule;
  nowMin: number;
  forceCancelled?: boolean;
}) {
  const { startMin, endMin, raw_status } = item;

  if (forceCancelled || raw_status === 'cancelled') {
    return (
      <ScheduleCardBase
        item={item}
        timeColumn="muted"
        labelSlot={
          <Typography
            variant="label-01"
            weight="medium"
            style={{ color: COLORS.gray[500] }}
          >
            취소됨
          </Typography>
        }
      />
    );
  }

  if (raw_status === 'no_show') {
    return (
      <ScheduleCardBase
        item={item}
        timeColumn="muted"
        labelSlot={
          <Typography
            variant="label-01"
            weight="medium"
            style={{ color: COLORS.gray[600] }}
          >
            노쇼
          </Typography>
        }
      />
    );
  }

  // 진행중
  if (
    raw_status !== 'completed' &&
    startMin <= nowMin &&
    nowMin < endMin
  ) {
    return (
      <ScheduleCardBase
        item={item}
        timeColumn="muted"
        emphasized
        labelSlot={
          <View
            style={{ gap: s(4), alignItems: 'flex-end' }}
            className="items-end"
          >
            <View
              style={{ gap: s(4) }}
              className="flex-row items-center"
            >
              <View
                style={{
                  width: s(6),
                  height: s(6),
                  borderRadius: s(999),
                  backgroundColor: COLORS.warning,
                }}
              />
              <Typography
                variant="label-01"
                weight="semibold"
                style={{ color: COLORS.warning }}
              >
                지금 진행 중
              </Typography>
            </View>
            <Typography
              variant="caption-01"
              style={{ color: COLORS.gray[500] }}
            >
              {fmtNatural(endMin)} 종료
            </Typography>
          </View>
        }
      />
    );
  }

  // 방금 종료
  if (endMin <= nowMin && nowMin < endMin + 30) {
    return (
      <ScheduleCardBase
        item={item}
        timeColumn="muted"
        labelSlot={
          <Typography
            variant="label-01"
            weight="medium"
            style={{ color: COLORS.gray[700] }}
          >
            {fmtNatural(endMin)} 종료
          </Typography>
        }
      />
    );
  }

  // 완료 / 과거
  if (raw_status === 'completed' || endMin <= nowMin) {
    return (
      <ScheduleCardBase
        item={item}
        timeColumn="muted"
        labelSlot={
          <Typography
            variant="label-01"
            weight="medium"
            style={{ color: COLORS.gray[500] }}
          >
            이미 종료
          </Typography>
        }
      />
    );
  }

  // 미래
  return (
    <ScheduleCardBase
      item={item}
      timeColumn="muted"
      labelSlot={
        <Typography
          variant="label-01"
          weight="semibold"
          style={{ color: COLORS.gray[900] }}
        >
          {fmtNatural(startMin)} 시작
        </Typography>
      }
    />
  );
}
