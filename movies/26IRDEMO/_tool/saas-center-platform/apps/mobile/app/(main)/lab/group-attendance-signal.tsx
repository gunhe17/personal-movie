import { useState } from 'react';
import { View, ScrollView, TouchableOpacity, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { COLORS, LAYOUT } from '@/shared/constants/theme';
import { Typography } from '@/shared/components/ui/Typography';
import { Icon } from '@/shared/components/icons';
import { s } from '@/shared/utils/scale';

/**
 * 그룹 일정 출결 신호 — 부분 노쇼/불참을 카드에서 보여주기
 *
 * 컨텍스트:
 *   - 일정 상태(예정/완료/취소/노쇼)와 내담자 출결(참석/불참/노쇼)이 독립 레이어.
 *   - 그룹 일정은 일부 노쇼/불참이어도 일정 자체는 '완료'로 유지 → 카드만 봐선 알 수 없음.
 *   - 청구 작업 시 노쇼/불참 발생 일정을 카드 스캔만으로 찾는 게 핵심.
 *
 * 표시 규칙 (양 시안 공통):
 *   - 개인 일정 → 보조 신호 없음 (이미 자동 derive로 정확)
 *   - 그룹 일정 + 전원 참석 → 신호 없음
 *   - 그룹 일정 + 일부 노쇼/불참 → C안에서만 신호 노출
 *   - 그룹 일정 + 전원 노쇼 → 일정 자체가 '노쇼'로 derive (신호 중복이라 숨김)
 *
 * 시안:
 *   A 현재 — 카드 상태만 표시. 그룹 부분 노쇼/불참 신호 없음.
 *   C C안 — 좌측 1px red stripe + 우측 상단 배지 옆 작은 빨강 라벨.
 */

type Variant =
  | 'current'
  | 'option-c'
  | 'option-d'
  | 'hybrid'
  | 'all-top'
  | 'all-bottom-tall';

const VARIANTS: { key: Variant; label: string; hint: string }[] = [
  { key: 'current', label: 'A 현재', hint: '신호 없음' },
  { key: 'option-c', label: 'C 상단', hint: '배지 옆 라벨' },
  { key: 'option-d', label: 'D 하단', hint: '하단 라벨' },
  { key: 'hybrid', label: 'E 혼용', hint: '컨텍스트별' },
  { key: 'all-top', label: 'F 전부 C', hint: 'C 통일' },
  { key: 'all-bottom-tall', label: 'G 전부 D + ↑h', hint: 'D + 카드 키움' },
];

interface MockCard {
  id: string;
  type: 'counseling' | 'assessment';
  primaryName: string;
  extraCount: number; // 0이면 개인, >0이면 그룹
  gender: '남' | '여';
  age: number;
  startTime: string;
  endTime: string;
  room: string;
  program: string;
  status: 'completed' | 'no_show'; // 데모 — 완료/노쇼만
  partialAbsent: number; // 그룹에서 부분 불참 인원
  partialNoShow: number; // 그룹에서 부분 노쇼 인원
}

const MOCK_CARDS: MockCard[] = [
  {
    id: '1',
    type: 'counseling',
    primaryName: '김민준',
    extraCount: 0,
    gender: '남',
    age: 8,
    startTime: '10:00',
    endTime: '10:50',
    room: '상담실 A',
    program: '놀이치료-개인',
    status: 'completed',
    partialAbsent: 0,
    partialNoShow: 0,
  },
  {
    id: '2',
    type: 'counseling',
    primaryName: '이지호',
    extraCount: 2,
    gender: '여',
    age: 10,
    startTime: '11:00',
    endTime: '12:00',
    room: '상담실 B',
    program: '놀이치료-그룹',
    status: 'completed',
    partialAbsent: 0,
    partialNoShow: 0,
  },
  {
    id: '3',
    type: 'counseling',
    primaryName: '박서연',
    extraCount: 2,
    gender: '여',
    age: 9,
    startTime: '13:00',
    endTime: '14:00',
    room: '상담실 A',
    program: '미술치료-그룹',
    status: 'completed',
    partialAbsent: 0,
    partialNoShow: 1, // 그룹 3명 중 1명 노쇼
  },
  {
    id: '4',
    type: 'counseling',
    primaryName: '최도윤',
    extraCount: 3,
    gender: '남',
    age: 11,
    startTime: '14:30',
    endTime: '15:30',
    room: '상담실 B',
    program: '인지치료-그룹',
    status: 'completed',
    partialAbsent: 1, // 그룹 4명 중 1명 불참 + 1명 노쇼
    partialNoShow: 1,
  },
  {
    id: '5',
    type: 'counseling',
    primaryName: '한지우',
    extraCount: 2,
    gender: '여',
    age: 7,
    startTime: '16:00',
    endTime: '17:00',
    room: '상담실 A',
    program: '놀이치료-그룹',
    status: 'no_show', // 그룹 3명 전원 노쇼 → 일정 자체 노쇼
    partialAbsent: 0,
    partialNoShow: 3,
  },
];

export default function GroupAttendanceSignalLab() {
  const router = useRouter();
  const [variant, setVariant] = useState<Variant>('option-c');

  return (
    <View className="flex-1" style={{ backgroundColor: COLORS.bg.base }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: COLORS.white }}>
        <View
          style={{
            height: s(48),
            paddingHorizontal: s(LAYOUT.screenPaddingX),
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={8}
            accessibilityLabel="뒤로 가기"
            accessibilityRole="button"
          >
            <Icon name="arrow-left" size={24} color={COLORS.gray[900]} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Typography
              variant="title-01"
              weight="semibold"
              className="text-gray-900"
            >
              그룹 출결 신호
            </Typography>
          </View>
          <View style={{ width: 24 }} />
        </View>

        {/* 시안 전환 탭 */}
        <View
          style={{
            paddingHorizontal: s(LAYOUT.screenPaddingX),
            paddingBottom: s(12),
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: COLORS.gray[50],
              borderRadius: s(10),
              padding: s(3),
              gap: s(2),
            }}
          >
            {VARIANTS.map((v) => {
              const active = variant === v.key;
              return (
                <Pressable
                  key={v.key}
                  onPress={() => setVariant(v.key)}
                  style={({ pressed }) => ({
                    flex: 1,
                    paddingVertical: s(8),
                    borderRadius: s(8),
                    backgroundColor: active ? COLORS.white : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: pressed ? 0.85 : 1,
                  })}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Typography
                    variant="label-01"
                    weight={active ? 'semibold' : 'medium'}
                    style={{
                      color: active ? COLORS.gray[900] : COLORS.gray[500],
                    }}
                  >
                    {v.label}
                  </Typography>
                </Pressable>
              );
            })}
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: s(LAYOUT.screenPaddingX),
          paddingVertical: s(20),
          gap: s(10),
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* 안내 */}
        <View
          style={{
            padding: s(14),
            borderRadius: s(10),
            backgroundColor: COLORS.white,
            marginBottom: s(8),
            gap: s(4),
          }}
        >
          <Typography
            variant="label-01"
            weight="semibold"
            style={{ color: COLORS.gray[900] }}
          >
            카드 5건 — 다양한 출결 상태 데모
          </Typography>
          <Typography
            variant="label-01"
            style={{ color: COLORS.gray[600], lineHeight: s(18) }}
          >
            1) 개인·완료 / 2) 그룹·전원 참석 / 3) 그룹 3명·1명 노쇼 / 4)
            그룹 4명·1명 불참+1명 노쇼 / 5) 그룹·전원 노쇼
          </Typography>
        </View>

        {variant === 'hybrid' ? (
          <>
            {/* Section 1: Timeline 모드 */}
            <SectionLabel
              title="Timeline 모드 (일간 보기) — C 상단"
              note="height = duration. 신호가 기존 행 안에 들어가 height 영향 X."
            />
            <TimelineSimulation cards={MOCK_CARDS} signalVariant="option-c" />

            {/* Section 2: 비-Timeline 모드 */}
            <View style={{ marginTop: s(24) }}>
              <SectionLabel
                title="비-Timeline 모드 (월간 inline / 리스트 compact) — D 하단"
                note="height 자유. 하단에 신호 행 추가, 디테일하게 표시."
              />
              {MOCK_CARDS.map((card) => (
                <View key={`d-${card.id}`} style={{ marginTop: s(10) }}>
                  <ScheduleCardDemo card={card} variant="option-d" />
                </View>
              ))}
            </View>
          </>
        ) : variant === 'all-top' ? (
          <>
            {/* Section 1: Timeline 모드 — C 상단 */}
            <SectionLabel
              title="Timeline 모드 (일간 보기) — C 상단"
              note="height = duration 보존. 신호가 기존 행 안에 들어가 overflow 없음."
            />
            <TimelineSimulation cards={MOCK_CARDS} signalVariant="option-c" />

            {/* Section 2: 비-Timeline 모드 — C 상단 (동일) */}
            <View style={{ marginTop: s(24) }}>
              <SectionLabel
                title="비-Timeline 모드 (월간 inline / 리스트 compact) — C 상단"
                note="모든 모드에 같은 신호 위치 → 일관성."
              />
              {MOCK_CARDS.map((card) => (
                <View key={`top-${card.id}`} style={{ marginTop: s(10) }}>
                  <ScheduleCardDemo card={card} variant="option-c" />
                </View>
              ))}
            </View>
          </>
        ) : variant === 'all-bottom-tall' ? (
          <>
            {/* Section 1: Timeline 모드 — hourPx 키움 + D 하단 */}
            <SectionLabel
              title="Timeline 모드 (일간 보기) — D 하단 + HOUR_HEIGHT s(96)"
              note="hourPx 64 → 96. 1시간 카드 = s(96)로 D 하단(3행) fit. 30분 회기는 여전히 부풀려져 시간 비례 약화."
            />
            <TimelineSimulation
              cards={MOCK_CARDS}
              signalVariant="option-d"
              hourHeight={s(96)}
            />

            {/* Section 2: 비-Timeline 모드 — D 하단 */}
            <View style={{ marginTop: s(24) }}>
              <SectionLabel
                title="비-Timeline 모드 (월간 inline / 리스트 compact) — D 하단"
                note="모든 모드에 같은 신호 위치 → 일관성."
              />
              {MOCK_CARDS.map((card) => (
                <View
                  key={`bot-${card.id}`}
                  style={{ marginTop: s(10) }}
                >
                  <ScheduleCardDemo card={card} variant="option-d" />
                </View>
              ))}
            </View>
          </>
        ) : (
          MOCK_CARDS.map((card) => (
            <ScheduleCardDemo key={card.id} card={card} variant={variant} />
          ))
        )}
      </ScrollView>
    </View>
  );
}

/* ───────── Section Label ───────── */

function SectionLabel({ title, note }: { title: string; note: string }) {
  return (
    <View style={{ gap: s(2), marginBottom: s(8) }}>
      <Typography
        variant="body-03"
        weight="semibold"
        style={{ color: COLORS.gray[900] }}
      >
        {title}
      </Typography>
      <Typography
        variant="caption-01"
        style={{ color: COLORS.gray[600], lineHeight: s(16) }}
      >
        {note}
      </Typography>
    </View>
  );
}

/* ───────── Timeline Simulation (height = duration) ───────── */

function timeToHours(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h + m / 60;
}

function TimelineSimulation({
  cards,
  signalVariant,
  hourHeight = s(60),
}: {
  cards: MockCard[];
  signalVariant: Variant;
  hourHeight?: number;
}) {
  const startHour = 10;
  const endHour = 17;
  const hourPx = hourHeight;
  const totalHours = endHour - startHour;
  const hours = Array.from({ length: totalHours + 1 }, (_, i) => startHour + i);

  return (
    <View
      style={{
        flexDirection: 'row',
        minHeight: hourPx * totalHours + s(24),
      }}
    >
      {/* Time spine */}
      <View style={{ width: s(36) }}>
        {hours.map((h) => (
          <View
            key={h}
            style={{
              height: hourPx,
              alignItems: 'flex-end',
              paddingRight: s(8),
            }}
          >
            <Typography
              variant="label-02"
              weight="medium"
              style={{ color: COLORS.gray[400], marginTop: -s(8) }}
            >
              {h}
            </Typography>
          </View>
        ))}
      </View>

      {/* Card area */}
      <View style={{ flex: 1, position: 'relative' }}>
        {/* Hour lines */}
        {hours.map((_, i) => (
          <View
            key={i}
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: i * hourPx,
              left: 0,
              right: 0,
              height: 1,
              backgroundColor: COLORS.gray[100],
            }}
          />
        ))}
        {/* Cards positioned by time */}
        {cards.map((card) => {
          const startH = timeToHours(card.startTime);
          const endH = timeToHours(card.endTime);
          const top = (startH - startHour) * hourPx;
          const height = Math.max((endH - startH) * hourPx, s(36));
          return (
            <View
              key={card.id}
              style={{
                position: 'absolute',
                top,
                left: s(8),
                right: 0,
                height,
              }}
            >
              <ScheduleCardDemo card={card} variant={signalVariant} />
            </View>
          );
        })}
      </View>
    </View>
  );
}

/* ───────── Schedule Card Demo ───────── */

function ScheduleCardDemo({
  card,
  variant,
}: {
  card: MockCard;
  variant: Variant;
}) {
  const isGroup = card.extraCount > 0;
  const isNoShow = card.status === 'no_show';
  const isCompleted = card.status === 'completed';

  // 부분 노쇼/불참 발생 여부 — 일정 자체가 노쇼면 신호 중복이라 숨김
  const hasPartialIssue =
    !isNoShow && (card.partialAbsent > 0 || card.partialNoShow > 0);
  const showStripe =
    (variant === 'option-c' || variant === 'option-d') &&
    isGroup &&
    hasPartialIssue;
  const showInlineSignal = variant === 'option-c' && isGroup && hasPartialIssue;
  const showBottomSignal =
    variant === 'option-d' && isGroup && hasPartialIssue;

  // 보조 라벨 텍스트 — 발생한 것만
  const signalParts: string[] = [];
  if (card.partialAbsent > 0) signalParts.push(`불참 ${card.partialAbsent}`);
  if (card.partialNoShow > 0) signalParts.push(`노쇼 ${card.partialNoShow}`);
  const signalText = signalParts.join(' · ');

  // 카드 배경 — 완료/노쇼 차별 (DayTimeline과 동일 톤)
  const cardBg = isNoShow ? COLORS.gray[100] : COLORS.gray[50];
  const contentOpacity = isNoShow ? 0.7 : 1;
  const categoryColor =
    card.type === 'assessment' ? COLORS.assessment : COLORS.counseling;
  const categoryPrefix = card.type === 'assessment' ? '[검사]' : '[상담]';
  const titleText =
    card.extraCount > 0
      ? `${categoryPrefix} ${card.primaryName} 외 ${card.extraCount}명`
      : `${categoryPrefix} ${card.primaryName}`;

  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: cardBg,
        borderRadius: s(12),
        overflow: 'hidden',
      }}
    >
      {/* 좌측 red stripe — C·D안 + 부분 이슈 있을 때만 */}
      {showStripe && (
        <View
          style={{
            width: s(3),
            backgroundColor: COLORS.palette.red,
          }}
        />
      )}

      <View
        style={{
          flex: 1,
          paddingVertical: s(10),
          paddingHorizontal: s(12),
          opacity: contentOpacity,
        }}
      >
        {/* 1행: 타이틀 + 성별·나이 + 배지 + 보조 라벨 */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: s(6),
          }}
        >
          <View
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              gap: s(6),
            }}
          >
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: categoryColor,
              }}
            />
            <Typography
              variant="body-02"
              weight="semibold"
              style={{ color: COLORS.gray[900], flexShrink: 1 }}
              numberOfLines={1}
            >
              {titleText}
            </Typography>
            <Typography
              variant="label-01"
              style={{ color: COLORS.gray[700] }}
              numberOfLines={1}
            >
              {card.gender} · 만 {card.age}세
            </Typography>
          </View>

          {/* 배지 묶음 — 보조 라벨(좌, C안만) + 상태 배지(우, 항상 우측 끝 정렬) */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: s(6),
            }}
          >
            {showInlineSignal && (
              <Typography
                variant="label-02"
                weight="semibold"
                style={{ color: COLORS.palette.red }}
              >
                {signalText}
              </Typography>
            )}
            {isCompleted && (
              <View
                style={{
                  paddingHorizontal: s(6),
                  paddingVertical: s(2),
                  borderRadius: s(4),
                  backgroundColor: COLORS.gray[200],
                }}
              >
                <Typography
                  variant="label-02"
                  weight="semibold"
                  style={{ color: COLORS.gray[600] }}
                >
                  완료
                </Typography>
              </View>
            )}
            {isNoShow && (
              <View
                style={{
                  paddingHorizontal: s(6),
                  paddingVertical: s(2),
                  borderRadius: s(4),
                  backgroundColor: COLORS.paletteBg.red,
                }}
              >
                <Typography
                  variant="label-02"
                  weight="semibold"
                  style={{ color: COLORS.palette.red }}
                >
                  노쇼
                </Typography>
              </View>
            )}
          </View>
        </View>

        {/* 2행: 시간 · 장소 · 프로그램 */}
        <View
          style={{
            marginTop: s(4),
            flexDirection: 'row',
            alignItems: 'center',
            gap: s(6),
          }}
        >
          <Typography
            variant="body-03"
            weight="semibold"
            style={{ color: COLORS.gray[700] }}
          >
            {card.startTime}~{card.endTime}
          </Typography>
          <View
            style={{
              width: 1,
              height: s(10),
              backgroundColor: COLORS.gray[300],
            }}
          />
          <Typography
            variant="body-03"
            style={{ color: COLORS.gray[700] }}
            numberOfLines={1}
          >
            {card.room}
          </Typography>
          <View
            style={{
              width: 1,
              height: s(10),
              backgroundColor: COLORS.gray[300],
            }}
          />
          <Typography
            variant="body-03"
            style={{ color: COLORS.gray[700], flex: 1 }}
            numberOfLines={1}
          >
            {card.program}
          </Typography>
        </View>

        {/* 하단 라벨 — D안 + 부분 이슈 있을 때만 */}
        {showBottomSignal && (
          <View
            style={{
              marginTop: s(8),
              paddingTop: s(8),
              borderTopWidth: 1,
              borderTopColor: COLORS.gray[200],
              flexDirection: 'row',
              alignItems: 'center',
              gap: s(6),
            }}
          >
            <View
              style={{
                width: s(4),
                height: s(4),
                borderRadius: s(2),
                backgroundColor: COLORS.palette.red,
              }}
            />
            <Typography
              variant="label-02"
              weight="semibold"
              style={{ color: COLORS.palette.red }}
            >
              {signalText}
            </Typography>
          </View>
        )}
      </View>
    </View>
  );
}
