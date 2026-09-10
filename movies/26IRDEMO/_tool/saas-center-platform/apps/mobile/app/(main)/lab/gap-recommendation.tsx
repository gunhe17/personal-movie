import { useState } from 'react';
import { View, ScrollView, TouchableOpacity, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, LAYOUT } from '@/shared/constants/theme';
import { Typography } from '@/shared/components/ui/Typography';
import { Icon } from '@/shared/components/icons';
import { s } from '@/shared/utils/scale';

/**
 * 일정 타임라인 — 빈 시간 추천 시안 비교 lab
 *
 * 컨셉: 일정 사이 빈 구간에 "이 시간에 할 일" 추천 카드 삽입.
 *      한 빈 시간에 여러 업무(일지·검사 소견·보호자 답장)를 묶어 노출 — Agentic 신호(§4)를 시간축에 매핑.
 *
 * 룰:
 *   - 빈 구간 ≥ 30분만 추천 노출 (production은 60분)
 *   - 현재 시각 이후 첫 빈 시간 1곳에만 노출, 그 안에 여러 건 stack
 *   - 점심시간(12-13)은 자동 제외 (점심 칩만 표시)
 *
 * 시안:
 *   A 점선 스택 — 점선 outline + primary tint, "제안" 톤. 여러 건 위아래 stack(한눈 스캔)
 *   B 화살표 — 한 건씩 카드, 헤더 ‹ 1/3 › 카운터+화살표로 탭 전환(날짜 스와이프와 충돌 회피)
 *   D 미니 스택 — outline 컴팩트, 여러 건 행 나열, 액션 즉시
 *
 * 종류·검사 소견·보호자 답장은 mock(데이터 미연동). 실연동 종류만 production 승격.
 */

type Variant = 'option-a' | 'option-b' | 'option-d';

const VARIANTS: { key: Variant; label: string; hint: string }[] = [
  { key: 'option-a', label: 'A 점선 스택', hint: '한눈 스캔' },
  { key: 'option-b', label: 'B 화살표', hint: '‹ 1/3 ›' },
  { key: 'option-d', label: 'D 미니 스택', hint: '액션 즉시' },
];

interface ScheduleSlot {
  type: 'schedule';
  startHour: number; // float, 예: 10.5 = 10:30
  endHour: number;
  title: string;
  meta: string;
  scheduleType: 'counseling' | 'assessment';
}

interface LunchSlot {
  type: 'lunch';
  startHour: number;
  endHour: number;
}

interface RecommendationSlot {
  type: 'recommendation';
  startHour: number;
  endHour: number;
  // 한 빈 시간에 여러 종류(일지·검사 소견·보호자 답장)를 묶어 노출 — 종류별 아이콘으로 구분
  items: {
    icon: keyof typeof Ionicons.glyphMap;
    actionTitle: string;
    sublabel?: string;
  }[];
}

type TimelineSlot = ScheduleSlot | LunchSlot | RecommendationSlot;

// Mock 하루: 9~17시. 첫 빈 구간 90분 (10~11:30)에 3종 추천. 12-13 점심.
const MOCK_SLOTS: TimelineSlot[] = [
  {
    type: 'schedule',
    startHour: 9,
    endHour: 10,
    title: '이은비 외 2명',
    meta: '09:00 ~ 10:00 · 상담실 B · 놀이치료-그룹',
    scheduleType: 'counseling',
  },
  {
    type: 'recommendation',
    startHour: 10,
    endHour: 11.5, // 11:30 — 90분 빈 구간, 멀티 추천
    items: [
      {
        icon: 'document-text-outline',
        actionTitle: '이은비 외 2명의 일지를 작성해볼까요?',
        sublabel: '직전 회기 · 상담일지',
      },
      {
        icon: 'clipboard-outline',
        actionTitle: '박서연님의 검사 소견을 작성해볼까요?',
        sublabel: '어제 검사 · 소견 미작성',
      },
      {
        icon: 'chatbubble-ellipses-outline',
        actionTitle: '한지우님 보호자에게 답장해볼까요?',
        sublabel: '3일 대기 · 메시지',
      },
    ],
  },
  {
    type: 'schedule',
    startHour: 11.5,
    endHour: 12,
    title: '김민준',
    meta: '11:30 ~ 12:00 · 상담실 A · 놀이치료-개인',
    scheduleType: 'counseling',
  },
  {
    type: 'lunch',
    startHour: 12,
    endHour: 13,
  },
  {
    type: 'schedule',
    startHour: 13,
    endHour: 14,
    title: '박서연',
    meta: '13:00 ~ 14:00 · 검사실 · K-WISC',
    scheduleType: 'assessment',
  },
  {
    type: 'recommendation',
    startHour: 14,
    endHour: 15.5, // 15:30
    items: [
      {
        icon: 'clipboard-outline',
        actionTitle: '박서연님의 검사 소견을 작성해볼까요?',
        sublabel: '직전 회기',
      },
      {
        icon: 'chatbubble-ellipses-outline',
        actionTitle: '한지우님 보호자에게 답장해볼까요?',
        sublabel: '3일 대기',
      },
    ],
  },
  {
    type: 'schedule',
    startHour: 15.5,
    endHour: 17,
    title: '한지우',
    meta: '15:30 ~ 17:00 · 상담실 A · 인지치료-개인',
    scheduleType: 'counseling',
  },
];

const HOUR_HEIGHT = s(96);
const START_HOUR = 9;
const END_HOUR = 17;
const TIME_COL_WIDTH = s(40);

// Mock 현재 시각 (9:30) — 이후 가장 가까운 빈 시간에만 추천 노출
const MOCK_NOW_HOUR = 9.5;

export default function GapRecommendationLab() {
  const router = useRouter();
  const [variant, setVariant] = useState<Variant>('option-a');

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
              빈 시간 추천
            </Typography>
          </View>
          <View style={{ width: 24 }} />
        </View>

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
          paddingTop: s(16),
          paddingHorizontal: s(LAYOUT.screenPaddingX),
          paddingBottom: s(40),
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* 안내 */}
        <View
          style={{
            padding: s(12),
            borderRadius: s(10),
            backgroundColor: COLORS.white,
            marginBottom: s(16),
            gap: s(4),
          }}
        >
          <Typography
            variant="label-01"
            weight="semibold"
            style={{ color: COLORS.gray[900] }}
          >
            mock 하루 — 9시~17시 (지금 9:30)
          </Typography>
          <Typography
            variant="label-02"
            style={{ color: COLORS.gray[600], lineHeight: s(18) }}
          >
            현재 시각 이후 첫 빈 시간 1곳에만 추천 노출{'\n'}
            10:00~11:30 빈 구간(90분) → 일지·검사 소견·보호자 답장 3건{'\n'}
            점심(12~13)은 자동 제외
          </Typography>
        </View>

        {/* 타임라인 */}
        <Timeline variant={variant} />
      </ScrollView>
    </View>
  );
}

/* ───────── Timeline ───────── */

function Timeline({ variant }: { variant: Variant }) {
  const totalHours = END_HOUR - START_HOUR;
  const hours = Array.from({ length: totalHours + 1 }, (_, i) => START_HOUR + i);
  // 현재 시각 이후 가장 가까운 추천 슬롯만 노출
  const activeRecIdx = MOCK_SLOTS.findIndex(
    (slot) => slot.type === 'recommendation' && slot.startHour >= MOCK_NOW_HOUR,
  );

  return (
    <View
      style={{
        flexDirection: 'row',
        minHeight: HOUR_HEIGHT * totalHours + s(24),
      }}
    >
      {/* Time spine */}
      <View style={{ width: TIME_COL_WIDTH }}>
        {hours.map((h) => (
          <View
            key={h}
            style={{
              height: HOUR_HEIGHT,
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

      {/* Slots area */}
      <View style={{ flex: 1, position: 'relative' }}>
        {/* hour lines */}
        {hours.map((_, i) => (
          <View
            key={i}
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: i * HOUR_HEIGHT,
              left: 0,
              right: 0,
              height: 1,
              backgroundColor: COLORS.gray[100],
            }}
          />
        ))}

        {/* slots */}
        {MOCK_SLOTS.map((slot, idx) => {
          const top = (slot.startHour - START_HOUR) * HOUR_HEIGHT;
          const height = (slot.endHour - slot.startHour) * HOUR_HEIGHT;

          if (slot.type === 'schedule') {
            return (
              <View
                key={idx}
                style={{
                  position: 'absolute',
                  top,
                  left: s(8),
                  right: 0,
                  height,
                }}
              >
                <ScheduleCard slot={slot} />
              </View>
            );
          }
          if (slot.type === 'lunch') {
            return (
              <View
                key={idx}
                style={{
                  position: 'absolute',
                  top,
                  left: s(8),
                  right: 0,
                  height,
                }}
              >
                <LunchSlotCard />
              </View>
            );
          }
          // recommendation — 가장 가까운 1개만 노출
          if (idx !== activeRecIdx) return null;
          return (
            <View
              key={idx}
              style={{
                position: 'absolute',
                top,
                left: s(8),
                right: 0,
                height,
              }}
            >
              {variant === 'option-a' ? (
                <RecommendationCardA slot={slot} />
              ) : variant === 'option-b' ? (
                <RecommendationCardB slot={slot} />
              ) : (
                <RecommendationCardD slot={slot} />
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

/* ───────── Schedule Card (production-like 미니) ───────── */

function ScheduleCard({ slot }: { slot: ScheduleSlot }) {
  const categoryColor =
    slot.scheduleType === 'assessment' ? COLORS.assessment : COLORS.counseling;
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: COLORS.gray[50],
        borderRadius: s(12),
        paddingVertical: s(8),
        paddingHorizontal: s(12),
        marginRight: s(16),
      }}
    >
      <View
        style={{
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
          [{slot.scheduleType === 'assessment' ? '검사' : '상담'}] {slot.title}
        </Typography>
      </View>
      <Typography
        variant="body-03"
        weight="medium"
        style={{ color: COLORS.gray[700], marginTop: s(4) }}
        numberOfLines={1}
      >
        {slot.meta}
      </Typography>
    </View>
  );
}

/* ───────── Lunch Slot ───────── */

function LunchSlotCard() {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: COLORS.white,
        borderRadius: s(10),
        marginRight: s(16),
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: s(6),
        opacity: 0.6,
      }}
    >
      <Ionicons name="restaurant-outline" size={s(14)} color={COLORS.gray[500]} />
      <Typography
        variant="label-01"
        weight="medium"
        style={{ color: COLORS.gray[500] }}
      >
        점심 시간
      </Typography>
    </View>
  );
}

/* ───────── Recommendation Card A — 점선 + primary tint ───────── */

function RecommendationCardA({ slot }: { slot: RecommendationSlot }) {
  const durationMin = Math.round((slot.endHour - slot.startHour) * 60);
  if (slot.items.length === 0) return null;
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: COLORS.primary50,
        borderRadius: s(12),
        paddingVertical: s(12),
        paddingHorizontal: s(14),
        marginRight: s(16),
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: COLORS.primary300,
        gap: s(10),
      }}
    >
      {/* 헤더 — 빈 시간 + 제안 톤 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6) }}>
        <Ionicons name="bulb-outline" size={s(15)} color={COLORS.primary700} />
        <Typography
          variant="label-01"
          weight="semibold"
          style={{ color: COLORS.primary700 }}
        >
          {durationMin}분 여유 · 이런 건 어때요?
        </Typography>
      </View>

      {/* 추천 항목 stack — 종류별 아이콘 */}
      <View style={{ gap: s(10) }}>
        {slot.items.map((item, i) => (
          <Pressable
            key={i}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: s(8),
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Ionicons
              name={item.icon}
              size={s(16)}
              color={COLORS.primary700}
              style={{ marginTop: s(1) }}
            />
            <View style={{ flex: 1 }}>
              <Typography
                variant="body-03"
                weight="medium"
                style={{ color: COLORS.gray[900], lineHeight: s(20) }}
                numberOfLines={2}
              >
                {item.actionTitle}
              </Typography>
              {item.sublabel && (
                <Typography
                  variant="label-02"
                  style={{ color: COLORS.gray[600], marginTop: s(2) }}
                >
                  {item.sublabel}
                </Typography>
              )}
            </View>
            <Ionicons
              name="chevron-forward"
              size={s(14)}
              color={COLORS.primary}
              style={{ marginTop: s(2) }}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/* ───────── Recommendation Card B — 화살표(‹ 1/3 ›) 탭 전환 ───────── */

function RecommendationCardB({ slot }: { slot: RecommendationSlot }) {
  const [active, setActive] = useState(0);
  const count = slot.items.length;
  const item = slot.items[active];
  if (!item) return null;
  const atStart = active === 0;
  const atEnd = active === count - 1;

  return (
    <View style={{ flex: 1, marginRight: s(16), gap: s(10) }}>
      {/* 헤더 — "지금 처리하면 좋아요"(semibold 13) + ‹ N/M › 카운터 (탭 전환, 날짜 스와이프와 충돌 없음) */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6) }}>
        <Typography
          variant="label-01"
          weight="semibold"
          style={{ color: COLORS.primary, flex: 1 }}
        >
          지금 처리하면 좋아요
        </Typography>
        {count > 1 && (
          <View
            style={{ flexDirection: 'row', alignItems: 'center', gap: s(8) }}
          >
            {/* icon/secondary, 16 */}
            <Pressable
              onPress={() => setActive((i) => Math.max(0, i - 1))}
              disabled={atStart}
              hitSlop={8}
              style={({ pressed }) => ({
                opacity: atStart ? 0.35 : pressed ? 0.5 : 1,
              })}
              accessibilityLabel="이전 추천"
              accessibilityRole="button"
            >
              <Ionicons
                name="chevron-back"
                size={s(16)}
                color={COLORS.gray[400]}
              />
            </Pressable>
            {/* 2/3 — text/caption/default, medium 13 */}
            <Typography
              variant="label-01"
              weight="medium"
              style={{ color: COLORS.text.body.subtle }}
            >
              {active + 1}/{count}
            </Typography>
            <Pressable
              onPress={() => setActive((i) => Math.min(count - 1, i + 1))}
              disabled={atEnd}
              hitSlop={8}
              style={({ pressed }) => ({
                opacity: atEnd ? 0.35 : pressed ? 0.5 : 1,
              })}
              accessibilityLabel="다음 추천"
              accessibilityRole="button"
            >
              <Ionicons
                name="chevron-forward"
                size={s(16)}
                color={COLORS.gray[400]}
              />
            </Pressable>
          </View>
        )}
      </View>

      {/* 현재 추천 카드 한 장 */}
      <BItemCard item={item} />
    </View>
  );
}

function BItemCard({ item }: { item: RecommendationSlot['items'][number] }) {
  return (
    <View
      style={{
        backgroundColor: COLORS.primary50,
        borderRadius: s(16),
        paddingVertical: s(16),
        paddingHorizontal: s(16),
        gap: s(12),
      }}
    >
      {/* 아이콘(20) + 제목 — text/body/strong, semibold 14 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(10) }}>
        <Ionicons name={item.icon} size={s(20)} color={COLORS.primary} />
        <Typography
          variant="body-03"
          weight="semibold"
          style={{ color: COLORS.text.title.default, flex: 1 }}
          numberOfLines={2}
        >
          {item.actionTitle}
        </Typography>
      </View>
      {/* 바로가기 — text/label/default, medium 13 + icon/primary 16 */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: s(2),
        }}
      >
        <Typography
          variant="label-01"
          weight="medium"
          style={{ color: COLORS.text.label.default }}
        >
          바로가기
        </Typography>
        <Ionicons name="chevron-forward" size={s(16)} color={COLORS.primary} />
      </View>
    </View>
  );
}

/* ───────── Recommendation Card D — outline 미니 카드 ───────── */

function RecommendationCardD({ slot }: { slot: RecommendationSlot }) {
  const durationMin = Math.round((slot.endHour - slot.startHour) * 60);
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: COLORS.white,
        borderRadius: s(12),
        paddingVertical: s(10),
        paddingHorizontal: s(12),
        marginRight: s(16),
        borderWidth: 1,
        borderColor: COLORS.gray[200],
        gap: s(8),
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: s(6),
        }}
      >
        <Ionicons
          name="bulb-outline"
          size={s(14)}
          color={COLORS.gray[600]}
        />
        <Typography
          variant="label-01"
          weight="semibold"
          style={{ color: COLORS.gray[700] }}
        >
          {durationMin}분 여유
        </Typography>
      </View>
      <View style={{ gap: s(6) }}>
        {slot.items.map((item, i) => (
          <Pressable
            key={i}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: s(8),
              paddingVertical: s(4),
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: COLORS.gray[100],
              paddingTop: i === 0 ? 0 : s(8),
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Ionicons
              name={item.icon}
              size={s(15)}
              color={COLORS.gray[600]}
              style={{ marginTop: s(1) }}
            />
            <View style={{ flex: 1 }}>
              <Typography
                variant="body-03"
                weight="medium"
                style={{ color: COLORS.gray[900] }}
                numberOfLines={2}
              >
                {item.actionTitle}
              </Typography>
              {item.sublabel && (
                <Typography
                  variant="label-02"
                  style={{ color: COLORS.gray[500], marginTop: s(2) }}
                >
                  {item.sublabel}
                </Typography>
              )}
            </View>
            <Ionicons
              name="chevron-forward"
              size={s(14)}
              color={COLORS.gray[400]}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
}
