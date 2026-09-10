import { useRef, useState } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  Animated,
  TouchableOpacity,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
  type LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';
import { Typography } from '@/shared/components/ui/Typography';
import { Icon } from '@/shared/components/icons';
import { WeekStrip } from '../(tabs)/_components/WeekStrip';

/**
 * [일정] WeekStrip 스크롤 방향 접기/펼치기 프로토타입
 *
 * 문제(디자이너 제기): 리스트 뷰에서 WeekStrip(날짜 선택)은 ScrollView 자식이라
 * 아래로 스크롤하면 위로 사라지고, 맨 위까지 되돌려야만 다시 나타난다.
 * → 밑으로 내린 상태에서 다음 날로 옮기려면 매번 맨 위로 올려야 해 불편.
 *
 * 목표: 아래로 스크롤하면 지금처럼 접히되, **위로 스크롤하면 (맨 위가 아니어도)
 * 다시 내려오게** 한다. "N명을 만나요" 날짜 헤더는 항상 고정.
 *
 * 탭 — [현재] 대조군(자식이라 맨 위에서만 복귀) / [방향 반응] 아래=접힘·위=복귀(제안)
 *      / [항상 고정] 접지 않음(공간 상시 차지하는 대안)
 *
 * 전부 mock. 확정 시 schedule.tsx 리스트 뷰의 WeekStrip/sticky 헤더 구성에 반영.
 */

type Variant = 'current' | 'direction' | 'pinned';
const VARIANTS: { key: Variant; label: string }[] = [
  { key: 'current', label: '현재' },
  { key: 'direction', label: '방향 반응' },
  { key: 'pinned', label: '항상 고정' },
];

const SCREEN_PADDING_X = 16;
// 방향 판정 임계값 — 작은 흔들림에 토글되지 않도록(hysteresis)
const DIR_THRESHOLD = s(8);

/* ───────── mock 데이터 ───────── */

type Card = { id: string; time: string; name: string; meta: string };
const MOCK_CARDS: Card[] = [
  { id: 'c1', time: '09:00', name: '박지우님의 상담', meta: '놀이치료-개인 · 1상담실' },
  { id: 'c2', time: '10:00', name: '이준호님의 검사', meta: '풀배터리검사 · 2상담실' },
  { id: 'c3', time: '11:00', name: '김서연님의 상담', meta: '미술치료-개인 · 1상담실' },
  { id: 'c4', time: '13:00', name: '최하은님의 상담', meta: '놀이치료-개인 · 3상담실' },
  { id: 'c5', time: '14:00', name: '정민서님의 상담', meta: '인지치료-개인 · 1상담실' },
  { id: 'c6', time: '15:00', name: '오시우님의 검사', meta: '풀배터리검사 · 2상담실' },
  { id: 'c7', time: '16:00', name: '한지민님의 상담', meta: '놀이치료-개인 · 1상담실' },
  { id: 'c8', time: '17:00', name: '강도윤님의 상담', meta: '미술치료-그룹 · 4상담실' },
  { id: 'c9', time: '18:00', name: '윤서아님의 상담', meta: '놀이치료-개인 · 1상담실' },
  { id: 'c10', time: '19:00', name: '임하준님의 상담', meta: '인지치료-개인 · 2상담실' },
];

function MockList() {
  return (
    <View style={{ paddingHorizontal: s(SCREEN_PADDING_X), paddingTop: s(12), gap: s(12) }}>
      {MOCK_CARDS.map((c) => (
        <View
          key={c.id}
          style={{
            flexDirection: 'row',
            gap: s(12),
            backgroundColor: COLORS.gray[50],
            borderRadius: s(12),
            paddingVertical: s(12),
            paddingHorizontal: s(16),
            alignItems: 'center',
          }}
        >
          <Typography variant="body-02" weight="semibold" style={{ color: COLORS.gray[700], width: s(44) }}>
            {c.time}
          </Typography>
          <View style={{ flex: 1 }}>
            <Typography variant="body-02" weight="semibold" style={{ color: COLORS.gray[900] }}>
              {c.name}
            </Typography>
            <Typography variant="body-03" style={{ color: COLORS.gray[600], marginTop: s(2) }}>
              {c.meta}
            </Typography>
          </View>
        </View>
      ))}
    </View>
  );
}

/* ───────── mock chrome (월 네비 / 날짜 헤더) ───────── */

function MonthNav() {
  return (
    <View
      style={{
        paddingHorizontal: s(20),
        paddingTop: s(16),
        paddingBottom: s(10),
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: s(12),
        backgroundColor: COLORS.white,
      }}
    >
      <Icon name="arrow-left-16" size={s(16)} />
      <Typography variant="title-01" weight="semibold" className="text-gray-900">
        6월 4째주
      </Typography>
      <Icon name="arrow-right-16" size={s(16)} />
    </View>
  );
}

function DayHeader({ count }: { count: number }) {
  return (
    <View
      style={{
        paddingHorizontal: s(20),
        paddingVertical: s(12),
        backgroundColor: COLORS.white,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.gray[100],
      }}
    >
      <Typography variant="body-02" weight="semibold" style={{ color: COLORS.gray[900] }}>
        오늘 {count}명을 만나요
      </Typography>
    </View>
  );
}

/* ───────── 변형 1: 현재 (대조군) ─────────
   WeekStrip 이 ScrollView 의 첫 자식(index 0) — 스크롤로 사라지고 맨 위에서만 복귀. */
function CurrentVariant({ date, onDate }: { date: Date; onDate: (d: Date) => void }) {
  return (
    <View style={{ flex: 1 }}>
      <MonthNav />
      <ScrollView
        stickyHeaderIndices={[1]}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: s(60) }}
        style={{ backgroundColor: COLORS.white }}
      >
        <View style={{ backgroundColor: COLORS.white }}>
          <WeekStrip selectedDate={date} onSelectDate={onDate} />
        </View>
        <DayHeader count={MOCK_CARDS.length} />
        <MockList />
      </ScrollView>
    </View>
  );
}

/* ───────── 변형 2: 방향 반응 (제안) ─────────
   WeekStrip 높이를 스크롤 방향에 맞춰 0↔H 로 애니메이션.
   아래로 = 접힘, 위로 = 복귀(맨 위 아니어도). 날짜 헤더는 항상 고정. */
function DirectionVariant({ date, onDate }: { date: Date; onDate: (d: Date) => void }) {
  const [stripH, setStripH] = useState(s(64));
  const heightAnim = useRef(new Animated.Value(s(64))).current;
  const lastY = useRef(0);
  const shown = useRef(true);

  const animateTo = (h: number) =>
    Animated.timing(heightAnim, {
      toValue: h,
      duration: 200,
      useNativeDriver: false, // 높이 애니메이션은 native driver 미지원
    }).start();

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const dy = y - lastY.current;
    if (Math.abs(dy) < DIR_THRESHOLD) return; // 흔들림 무시 (lastY 유지 → 누적)
    if (dy > 0 && shown.current && y > stripH * 0.5) {
      shown.current = false;
      animateTo(0); // 아래로 → 접기
    } else if (dy < 0 && !shown.current) {
      shown.current = true;
      animateTo(stripH); // 위로 → 펼치기
    }
    lastY.current = y;
  };

  const onStripLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0 && Math.abs(h - stripH) > 1 && shown.current) {
      setStripH(h);
      heightAnim.setValue(h);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.white }}>
      <MonthNav />
      {/* 접히는 WeekStrip 밴드 — 높이 클램프 + overflow hidden */}
      <Animated.View style={{ height: heightAnim, overflow: 'hidden' }}>
        <View onLayout={onStripLayout}>
          <WeekStrip selectedDate={date} onSelectDate={onDate} />
        </View>
      </Animated.View>
      {/* 항상 고정되는 날짜 헤더 */}
      <DayHeader count={MOCK_CARDS.length} />
      <ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: s(60) }}
        style={{ backgroundColor: COLORS.white }}
      >
        <MockList />
      </ScrollView>
    </View>
  );
}

/* ───────── 변형 3: 항상 고정 (대안) ─────────
   WeekStrip 을 접지 않고 항상 노출. 공간을 상시 차지하지만 "다시 못 봄" 문제 자체가 없음. */
function PinnedVariant({ date, onDate }: { date: Date; onDate: (d: Date) => void }) {
  return (
    <View style={{ flex: 1, backgroundColor: COLORS.white }}>
      <MonthNav />
      <WeekStrip selectedDate={date} onSelectDate={onDate} />
      <DayHeader count={MOCK_CARDS.length} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: s(60) }}
        style={{ backgroundColor: COLORS.white }}
      >
        <MockList />
      </ScrollView>
    </View>
  );
}

/* ───────── 판정 캡션 ───────── */
function Verdict({ variant }: { variant: Variant }) {
  const text =
    variant === 'current'
      ? '대조군 — 아래로 스크롤하면 WeekStrip이 위로 사라지고, 다시 보려면 맨 위까지 올려야 함. (현재 동작)'
      : variant === 'direction'
        ? '제안 — 아래로 스크롤=접힘, 위로 스크롤=즉시 복귀(맨 위 아니어도). 날짜 헤더는 고정. ※ 실제 적용 시 자동 스크롤(날짜 전환)은 방향 판정에서 제외 필요.'
        : '대안 — 접지 않고 항상 노출. 접근성은 가장 좋지만 세로 공간을 상시 차지함.';
  return (
    <View
      style={{
        margin: s(16),
        padding: s(12),
        borderRadius: s(12),
        backgroundColor: COLORS.gray[75],
      }}
    >
      <Typography variant="label-01" style={{ color: COLORS.gray[600], lineHeight: s(18) }}>
        {text}
      </Typography>
    </View>
  );
}

/* ───────── 메인 ───────── */
export default function ScheduleWeekStripCollapseLab() {
  const router = useRouter();
  const [variant, setVariant] = useState<Variant>('direction');
  const [date, setDate] = useState(() => new Date(2026, 5, 25)); // mock: 2026-06-25

  return (
    <View className="flex-1" style={{ backgroundColor: COLORS.white }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: COLORS.white }}>
        {/* lab 헤더 */}
        <View
          style={{
            height: s(48),
            paddingHorizontal: s(SCREEN_PADDING_X),
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <TouchableOpacity onPress={() => router.back()} hitSlop={8} accessibilityLabel="뒤로 가기" accessibilityRole="button">
            <Icon name="arrow-left" size={24} color={COLORS.gray[900]} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Typography variant="title-01" weight="semibold" className="text-gray-900">
              WeekStrip 접기/펼치기
            </Typography>
          </View>
          <View style={{ width: 24 }} />
        </View>

        {/* 변형 탭 */}
        <View style={{ flexDirection: 'row', gap: s(6), paddingHorizontal: s(SCREEN_PADDING_X), paddingBottom: s(10) }}>
          {VARIANTS.map((o) => {
            const active = variant === o.key;
            return (
              <Pressable
                key={o.key}
                onPress={() => setVariant(o.key)}
                style={{
                  paddingVertical: s(7),
                  paddingHorizontal: s(14),
                  borderRadius: 999,
                  backgroundColor: active ? COLORS.gray[900] : COLORS.gray[50],
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Typography variant="label-01" weight={active ? 'semibold' : 'medium'} style={{ color: active ? COLORS.white : COLORS.gray[600] }}>
                  {o.label}
                </Typography>
              </Pressable>
            );
          })}
        </View>
      </SafeAreaView>

      <Verdict variant={variant} />

      {/* 프리뷰 — 실제 화면처럼 한 영역에서 스크롤 */}
      <View style={{ flex: 1, borderTopWidth: 1, borderTopColor: COLORS.gray[100] }}>
        {variant === 'current' ? (
          <CurrentVariant date={date} onDate={setDate} />
        ) : variant === 'direction' ? (
          <DirectionVariant date={date} onDate={setDate} />
        ) : (
          <PinnedVariant date={date} onDate={setDate} />
        )}
      </View>
    </View>
  );
}
