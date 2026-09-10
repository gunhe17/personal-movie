import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Animated,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Icon } from '@/shared/components/icons';
import { Typography } from '@/shared/components/ui/Typography';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';

/**
 * 내담자 리스트 · Agentic 시안 (lab)
 *
 * 기존 내담자 메뉴는 단순 리스트였다. 본 시안은 "강조가 필요한 내담자를
 * 우선 보여주는" 에이전트 톤으로 재구성한다. 사용자가 챙겨야 할 신호
 * (일지 미작성·보호자 답장 대기·다음 회기 임박·첫 회기·종결 임박·장기 미접촉)를
 * AI가 추려서 위로 끌어올린다.
 *
 * 탭 5시안:
 *   A 현재    — 단순 그리드 (대조군)
 *   B 나열    — 강조 카드 세로 나열
 *   C 스택    — 강조 카드 덱(겹친 카드, 깊이감). 카드 탭=상세, 하단 점 인디케이터로 순서 조정
 *   D 캐러셀  — 가운데 큰 카드 + 양옆에 작게 peek. 좌우 스와이프 + 하단 인디케이터
 *   E 섹션    — "지금 챙겨요 / 이번 주 관심 / 안정 진행" 그룹핑
 */

type Variant =
  | 'baseline'
  | 'priority'
  | 'priority-stack'
  | 'priority-carousel'
  | 'sections';

const TABS: { key: Variant; label: string; sub: string }[] = [
  { key: 'baseline', label: '현재', sub: '그리드' },
  { key: 'priority', label: 'B 나열', sub: '강조 카드' },
  { key: 'priority-stack', label: 'C 스택', sub: '카드 덱' },
  { key: 'priority-carousel', label: 'D 캐러셀', sub: '양옆 카드' },
  { key: 'sections', label: 'E 섹션', sub: '관심도' },
];

/* ────────────────────────────────────────────────
 * 강조 사유 토큰 — Extended Palette OpacityBG + Solid 쌍.
 *  reason은 카드 색·아이콘·AI 한 줄 코멘트를 함께 결정한다.
 * ──────────────────────────────────────────────── */
type Reason =
  | 'missing-note'        // 일지 미작성
  | 'guardian-pending'    // 보호자 답장 대기
  | 'session-soon'        // 다음 회기 임박 (오늘/내일)
  | 'first-session'       // 첫 회기 직전
  | 'closing-soon'        // 종결 회기 임박
  | 'long-no-contact'     // 장기 미접촉
  | 'stable';             // 안정 진행 (강조 없음)

const REASON_STYLE: Record<
  Reason,
  { fg: string; bg: string; label: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  'missing-note': {
    fg: COLORS.palette.orange,
    bg: COLORS.paletteBg.orange,
    label: '일지 미작성',
    icon: 'document-text-outline',
  },
  'guardian-pending': {
    fg: COLORS.palette.yellow,
    bg: COLORS.paletteBg.yellow,
    label: '보호자 답장 대기',
    icon: 'mail-unread-outline',
  },
  'session-soon': {
    fg: COLORS.palette.blue,
    bg: COLORS.paletteBg.blue,
    label: '회기 임박',
    icon: 'time-outline',
  },
  'first-session': {
    fg: COLORS.palette.mint,
    bg: COLORS.paletteBg.mint,
    label: '첫 회기',
    icon: 'sparkles-outline',
  },
  'closing-soon': {
    fg: COLORS.palette.greenYellow,
    bg: COLORS.paletteBg.greenYellow,
    label: '종결 임박',
    icon: 'flag-outline',
  },
  'long-no-contact': {
    fg: COLORS.palette.red,
    bg: COLORS.paletteBg.red,
    label: '장기 미접촉',
    icon: 'alert-circle-outline',
  },
  stable: {
    fg: COLORS.gray[500],
    bg: COLORS.gray[100],
    label: '안정',
    icon: 'checkmark-circle-outline',
  },
};

/** 우선순위 (낮을수록 위) — 강조 사유의 무게를 결정 */
const REASON_PRIORITY: Record<Reason, number> = {
  'missing-note': 1,
  'guardian-pending': 2,
  'session-soon': 3,
  'first-session': 4,
  'closing-soon': 5,
  'long-no-contact': 6,
  stable: 99,
};

/* ────────────────────────────────────────────────
 * 아바타 컬러 — 사람마다 일관 (seed = id)
 * ──────────────────────────────────────────────── */
const PROFILE_PALETTE = [
  { bg: COLORS.paletteBg.blue, fg: COLORS.palette.blue },
  { bg: COLORS.paletteBg.green, fg: COLORS.palette.green },
  { bg: COLORS.paletteBg.violet, fg: COLORS.palette.violet },
  { bg: COLORS.paletteBg.pink, fg: COLORS.palette.pink },
  { bg: COLORS.paletteBg.mint, fg: COLORS.palette.mint },
  { bg: COLORS.paletteBg.orange, fg: COLORS.palette.orange },
] as const;

function getProfileColor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return PROFILE_PALETTE[Math.abs(hash) % PROFILE_PALETTE.length];
}

/* ────────────────────────────────────────────────
 * Mock 데이터
 * ──────────────────────────────────────────────── */
interface MockClient {
  id: string;
  name: string;
  age: number;
  gender: '여' | '남';
  reason: Reason;
  /** 사유별 핵심 컨텍스트 — 카드 row 2 에 표시 (지난 회기 요약·보호자 메시지·주호소·마지막 일지 등) */
  hint: string;
  /** 메타 (마지막 회기·다음 회기 등) */
  meta: string;
  /** 누적 회기 */
  sessionCount: number;
  /** closing-soon 전용 — 진행 바 표시용 */
  progress?: { done: number; total: number };
}

/**
 * 사유별 상세 아이콘 — 카드 row 2 컨텍스트 블록용.
 * 칩 아이콘(REASON_STYLE.icon, "어떤 상태")과 역할이 다름. 이건 "여기 뭐가 들어있어요" 신호.
 */
const REASON_DETAIL_ICON: Record<
  Exclude<Reason, 'stable'>,
  keyof typeof Ionicons.glyphMap
> = {
  'missing-note': 'create-outline',
  'session-soon': 'list-outline',
  'guardian-pending': 'chatbubble-ellipses-outline',
  'first-session': 'clipboard-outline',
  'closing-soon': 'flag-outline',
  'long-no-contact': 'hourglass-outline',
};

/**
 * 사유별 동적 타이틀 — C 스택 / D 캐러셀 상단에서 "현재 카드"의 액션을 AI 비서 톤으로 호명.
 * 카드를 넘길 때마다 타이틀이 함께 바뀌어 "AI 가 옆에서 한 명씩 짚어주는" 느낌.
 */
function getReasonTitle(client: MockClient): string {
  const name = client.name;
  switch (client.reason) {
    case 'missing-note':
      return `${name}님 일지를 작성해주세요`;
    case 'session-soon':
      return `${name}님 회기가 곧 시작돼요`;
    case 'guardian-pending':
      return `${name}님 보호자께 답장해주세요`;
    case 'first-session':
      return `${name}님 첫 회기를 준비해주세요`;
    case 'closing-soon':
      return `${name}님과 마지막 회기가 다가와요`;
    case 'long-no-contact':
      return `${name}님과 오랜만이에요`;
    case 'stable':
      return `${name}님은 안정 진행 중이에요`;
  }
}

const MOCK_CLIENTS: MockClient[] = [
  {
    id: 'c1',
    name: '박지훈',
    age: 28,
    gender: '남',
    reason: 'missing-note',
    hint: 'AI 초안 — 학교 적응 50분, 발화 빈도 증가 / 인지재구성 시도',
    meta: '지난 회기 5일 전',
    sessionCount: 6,
  },
  {
    id: 'c2',
    name: '김은서',
    age: 9,
    gender: '여',
    reason: 'session-soon',
    hint: '지난 회기 — 분노 호흡법 3회 적용, 학교 친구 갈등 정리',
    meta: '오늘 14:00 · 놀이치료',
    sessionCount: 3,
  },
  {
    id: 'c3',
    name: '최서아',
    age: 14,
    gender: '여',
    reason: 'guardian-pending',
    hint: '어머니: "토요일로 옮길 수 있을까요?" (3일 전 메시지)',
    meta: '지난 회기 7일 전',
    sessionCount: 5,
  },
  {
    id: 'c4',
    name: '김민지',
    age: 11,
    gender: '여',
    reason: 'first-session',
    hint: '주호소 — 학교 친구 관계, 등교 거부 2주째',
    meta: '내일 10:00',
    sessionCount: 0,
  },
  {
    id: 'c5',
    name: '정유나',
    age: 32,
    gender: '여',
    reason: 'closing-soon',
    hint: '마지막 1회기만 남았어요',
    meta: '다음 회기 모레',
    sessionCount: 11,
    progress: { done: 11, total: 12 },
  },
  {
    id: 'c6',
    name: '한도윤',
    age: 25,
    gender: '남',
    reason: 'long-no-contact',
    hint: '마지막 일지 — 새 직장 적응 중, 다음 일정 미정',
    meta: '지난 회기 42일 전',
    sessionCount: 4,
  },
  {
    id: 'c7',
    name: '이서연',
    age: 7,
    gender: '여',
    reason: 'stable',
    hint: '',
    meta: '지난 회기 3일 전',
    sessionCount: 8,
  },
  {
    id: 'c8',
    name: '강현우',
    age: 31,
    gender: '남',
    reason: 'stable',
    hint: '',
    meta: '지난 회기 4일 전',
    sessionCount: 5,
  },
  {
    id: 'c9',
    name: '오태경',
    age: 53,
    gender: '남',
    reason: 'stable',
    hint: '',
    meta: '지난 회기 2일 전',
    sessionCount: 9,
  },
  {
    id: 'c10',
    name: '윤지원',
    age: 26,
    gender: '여',
    reason: 'stable',
    hint: '',
    meta: '지난 회기 5일 전',
    sessionCount: 3,
  },
  {
    id: 'c11',
    name: '서아인',
    age: 16,
    gender: '여',
    reason: 'stable',
    hint: '',
    meta: '지난 회기 6일 전',
    sessionCount: 2,
  },
  {
    id: 'c12',
    name: '이도현',
    age: 19,
    gender: '남',
    reason: 'stable',
    hint: '',
    meta: '지난 회기 1일 전',
    sessionCount: 7,
  },
];

/* ────────────────────────────────────────────────
 * 메인
 * ──────────────────────────────────────────────── */
export default function ClientsAgenticLabScreen() {
  const router = useRouter();
  const [variant, setVariant] = useState<Variant>('priority');

  const sorted = useMemo(() => {
    return [...MOCK_CLIENTS].sort(
      (a, b) => REASON_PRIORITY[a.reason] - REASON_PRIORITY[b.reason],
    );
  }, []);

  const highlighted = useMemo(
    () => sorted.filter((c) => c.reason !== 'stable'),
    [sorted],
  );
  const stable = useMemo(
    () => sorted.filter((c) => c.reason === 'stable'),
    [sorted],
  );

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
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
            내담자 · Agentic
          </Typography>
        </View>
        <View style={{ width: s(24) }} />
      </View>

      {/* 시안 전환 탭 */}
      <View style={{ paddingHorizontal: s(16), paddingTop: s(16) }}>
        <View
          style={{ padding: s(4), gap: s(4) }}
          className="flex-row rounded-md bg-gray-50"
        >
          {TABS.map((tab) => {
            const active = tab.key === variant;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setVariant(tab.key)}
                activeOpacity={0.7}
                style={{ paddingVertical: s(8) }}
                className={`flex-1 items-center justify-center rounded-sm ${
                  active ? 'bg-surface' : 'bg-transparent'
                }`}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Typography
                  variant="label-01"
                  weight={active ? 'semibold' : 'medium'}
                  className={active ? 'text-gray-900' : 'text-gray-500'}
                >
                  {tab.label}
                </Typography>
                <Typography
                  variant="caption-01"
                  weight="regular"
                  className={active ? 'text-gray-500' : 'text-gray-400'}
                  style={{ marginTop: s(2) }}
                >
                  {tab.sub}
                </Typography>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* 시안 내용 */}
      <View className="flex-1 bg-background" style={{ marginTop: s(16) }}>
        {variant === 'baseline' && <BaselineGrid clients={sorted} />}
        {variant === 'priority' && (
          <PriorityList highlighted={highlighted} stable={stable} />
        )}
        {variant === 'priority-stack' && (
          <PriorityStackList highlighted={highlighted} stable={stable} />
        )}
        {variant === 'priority-carousel' && (
          <PriorityCarouselList highlighted={highlighted} allClients={sorted} />
        )}
        {variant === 'sections' && <SectionList clients={sorted} />}
      </View>
    </SafeAreaView>
  );
}

/* ────────────────────────────────────────────────
 * A 현재 — 단순 그리드 (대조군)
 * ──────────────────────────────────────────────── */
function BaselineGrid({ clients }: { clients: MockClient[] }) {
  return (
    <FlatList
      data={clients}
      keyExtractor={(item) => item.id}
      numColumns={2}
      columnWrapperStyle={{ gap: s(12) }}
      contentContainerStyle={{
        paddingHorizontal: s(20),
        paddingTop: s(4),
        paddingBottom: s(40),
        gap: s(12),
      }}
      renderItem={({ item }) => <BaselineCard client={item} />}
    />
  );
}

function BaselineCard({ client }: { client: MockClient }) {
  const color = getProfileColor(client.id);
  return (
    <View
      className="flex-1 rounded-lg bg-surface"
      style={{ padding: s(16), gap: s(12) }}
    >
      <View
        style={{
          width: s(48),
          height: s(48),
          borderRadius: s(24),
          backgroundColor: color.bg,
        }}
        className="items-center justify-center"
      >
        <Typography variant="title-01" weight="bold" style={{ color: color.fg }}>
          {client.name.slice(0, 1)}
        </Typography>
      </View>
      <View style={{ gap: s(2) }}>
        <Typography
          variant="body-01"
          weight="semibold"
          className="text-gray-900"
          numberOfLines={1}
        >
          {client.name}
        </Typography>
        <Typography variant="label-01" className="text-gray-500">
          {client.gender} · 만 {client.age}세
        </Typography>
      </View>
    </View>
  );
}

/* ────────────────────────────────────────────────
 * B 우선순위 — Top 강조 + 컴팩트 행
 *  - 상단 AI 헤더로 "오늘 N명을 챙기세요"
 *  - 강조 카드는 사유색 보더라인 + AI hint
 *  - 안정 진행 내담자는 작은 행으로 압축
 * ──────────────────────────────────────────────── */
function PriorityList({
  highlighted,
  stable,
}: {
  highlighted: MockClient[];
  stable: MockClient[];
}) {
  return (
    <ScrollView
      contentContainerStyle={{
        paddingHorizontal: s(20),
        paddingTop: s(4),
        paddingBottom: s(40),
        gap: s(16),
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* 섹션 헤더 — B 나열은 정적 (단일 focus 없음) */}
      <SectionHeader
        title="오늘 챙겨야 할 분들"
        rightBadge={`${highlighted.length}명`}
        subtitle="AI가 우선순위로 정리했어요. 카드 탭 = 상세"
      />

      {/* 강조 카드 */}
      <View style={{ gap: s(12) }}>
        {highlighted.map((c) => (
          <PriorityCard key={c.id} client={c} />
        ))}
      </View>

      {/* 안정 진행 — 컴팩트 행 */}
      {stable.length > 0 && (
        <View style={{ gap: s(8) }}>
          <View className="flex-row items-center" style={{ gap: s(6) }}>
            <Typography
              variant="label-01"
              weight="semibold"
              className="text-gray-600"
            >
              안정 진행 중
            </Typography>
            <Typography variant="label-01" className="text-gray-400">
              {stable.length}
            </Typography>
          </View>
          <View
            className="rounded-lg bg-surface"
            style={{ paddingVertical: s(4) }}
          >
            {stable.map((c, idx) => (
              <CompactRow
                key={c.id}
                client={c}
                isLast={idx === stable.length - 1}
              />
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function PriorityCard({ client }: { client: MockClient }) {
  const color = getProfileColor(client.id);
  const style = REASON_STYLE[client.reason];
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      className="rounded-lg bg-surface"
      style={{
        padding: s(16),
        gap: s(12),
        borderLeftWidth: s(3),
        borderLeftColor: style.fg,
      }}
      accessibilityRole="button"
      accessibilityLabel={`${client.name}, ${style.label}`}
    >
      {/* 1행: 아바타 + 이름·메타 + 사유칩 */}
      <View className="flex-row items-start" style={{ gap: s(12) }}>
        <View
          style={{
            width: s(48),
            height: s(48),
            borderRadius: s(24),
            backgroundColor: color.bg,
          }}
          className="items-center justify-center"
        >
          <Typography
            variant="title-01"
            weight="bold"
            style={{ color: color.fg }}
          >
            {client.name.slice(0, 1)}
          </Typography>
        </View>
        <View style={{ flex: 1, gap: s(2) }}>
          <Typography
            variant="body-01"
            weight="semibold"
            className="text-gray-900"
            numberOfLines={1}
          >
            {client.name}
          </Typography>
          <Typography variant="label-01" className="text-gray-500">
            {client.gender} · 만 {client.age}세 · 회기 {client.sessionCount}
          </Typography>
        </View>
        <View
          style={{
            paddingHorizontal: s(10),
            paddingVertical: s(4),
            borderRadius: s(999),
            backgroundColor: style.bg,
          }}
          className="flex-row items-center"
        >
          <Ionicons name={style.icon} size={12} color={style.fg} />
          <Typography
            variant="label-02"
            weight="semibold"
            style={{ color: style.fg, marginLeft: s(4) }}
          >
            {style.label}
          </Typography>
        </View>
      </View>

      {/* 2행: 사유별 컨텍스트 블록 */}
      <ReasonContextBlock client={client} />

      {/* 3행: 메타 */}
      <View className="flex-row items-center" style={{ gap: s(6) }}>
        <Ionicons name="time-outline" size={12} color={COLORS.gray[400]} />
        <Typography variant="label-01" className="text-gray-500">
          {client.meta}
        </Typography>
      </View>
    </TouchableOpacity>
  );
}

function CompactRow({
  client,
  isLast,
}: {
  client: MockClient;
  isLast: boolean;
}) {
  const color = getProfileColor(client.id);
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      className="flex-row items-center"
      style={{
        paddingHorizontal: s(16),
        paddingVertical: s(12),
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: COLORS.gray[100],
        gap: s(12),
      }}
    >
      <View
        style={{
          width: s(32),
          height: s(32),
          borderRadius: s(16),
          backgroundColor: color.bg,
        }}
        className="items-center justify-center"
      >
        <Typography
          variant="label-01"
          weight="bold"
          style={{ color: color.fg }}
        >
          {client.name.slice(0, 1)}
        </Typography>
      </View>
      <View style={{ flex: 1 }}>
        <Typography
          variant="body-02"
          weight="semibold"
          className="text-gray-900"
          numberOfLines={1}
        >
          {client.name}
        </Typography>
        <Typography variant="label-01" className="text-gray-500">
          {client.gender} · 만 {client.age}세 · {client.meta}
        </Typography>
      </View>
      <Ionicons name="chevron-forward" size={14} color={COLORS.gray[300]} />
    </TouchableOpacity>
  );
}

/* ────────────────────────────────────────────────
 * C 섹션 — 관심도 그룹
 *  - 지금 챙겨요 (priority 1~2: 일지 미작성, 보호자 답장)
 *  - 이번 주 관심 (priority 3~6: 회기 임박·첫 회기·종결·장기 미접촉)
 *  - 안정 진행
 * ──────────────────────────────────────────────── */
function SectionList({ clients }: { clients: MockClient[] }) {
  const groups = useMemo(() => {
    const now = clients.filter((c) =>
      ['missing-note', 'guardian-pending'].includes(c.reason),
    );
    const week = clients.filter((c) =>
      [
        'session-soon',
        'first-session',
        'closing-soon',
        'long-no-contact',
      ].includes(c.reason),
    );
    const calm = clients.filter((c) => c.reason === 'stable');
    return { now, week, calm };
  }, [clients]);

  return (
    <ScrollView
      contentContainerStyle={{
        paddingHorizontal: s(20),
        paddingTop: s(4),
        paddingBottom: s(40),
        gap: s(24),
      }}
      showsVerticalScrollIndicator={false}
    >
      <SectionBlock
        title="지금 챙겨요"
        accent={COLORS.palette.orange}
        count={groups.now.length}
        description="당장 손이 가야 하는 내담자예요"
      >
        {groups.now.map((c) => (
          <SectionCard key={c.id} client={c} />
        ))}
      </SectionBlock>

      <SectionBlock
        title="이번 주 관심"
        accent={COLORS.palette.blue}
        count={groups.week.length}
        description="회기·전환·라포 점검이 임박했어요"
      >
        {groups.week.map((c) => (
          <SectionCard key={c.id} client={c} />
        ))}
      </SectionBlock>

      <SectionBlock
        title="안정 진행 중"
        accent={COLORS.gray[400]}
        count={groups.calm.length}
        description=""
      >
        <View
          className="rounded-lg bg-surface"
          style={{ paddingVertical: s(4) }}
        >
          {groups.calm.map((c, idx) => (
            <CompactRow
              key={c.id}
              client={c}
              isLast={idx === groups.calm.length - 1}
            />
          ))}
        </View>
      </SectionBlock>
    </ScrollView>
  );
}

function SectionBlock({
  title,
  accent,
  count,
  description,
  children,
}: {
  title: string;
  accent: string;
  count: number;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: s(12) }}>
      <View style={{ gap: s(4) }}>
        <View className="flex-row items-center" style={{ gap: s(8) }}>
          <View
            style={{
              width: s(6),
              height: s(6),
              borderRadius: s(3),
              backgroundColor: accent,
            }}
          />
          <Typography
            variant="title-01"
            weight="semibold"
            className="text-gray-900"
          >
            {title}
          </Typography>
          <Typography
            variant="label-01"
            weight="medium"
            className="text-gray-400"
          >
            {count}
          </Typography>
        </View>
        {description ? (
          <Typography
            variant="body-03"
            className="text-gray-500"
            style={{ marginLeft: s(14) }}
          >
            {description}
          </Typography>
        ) : null}
      </View>
      <View style={{ gap: s(8) }}>{children}</View>
    </View>
  );
}

function SectionCard({ client }: { client: MockClient }) {
  const color = getProfileColor(client.id);
  const style = REASON_STYLE[client.reason];
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      className="rounded-lg bg-surface"
      style={{ padding: s(16), gap: s(12) }}
      accessibilityRole="button"
      accessibilityLabel={`${client.name}, ${style.label}`}
    >
      <View className="flex-row items-center" style={{ gap: s(12) }}>
        <View
          style={{
            width: s(40),
            height: s(40),
            borderRadius: s(20),
            backgroundColor: color.bg,
          }}
          className="items-center justify-center"
        >
          <Typography
            variant="body-01"
            weight="bold"
            style={{ color: color.fg }}
          >
            {client.name.slice(0, 1)}
          </Typography>
        </View>
        <View style={{ flex: 1, gap: s(2) }}>
          <Typography
            variant="body-01"
            weight="semibold"
            className="text-gray-900"
            numberOfLines={1}
          >
            {client.name}
          </Typography>
          <Typography variant="label-01" className="text-gray-500">
            {client.gender} · 만 {client.age}세 · {client.meta}
          </Typography>
        </View>
        <View
          style={{
            paddingHorizontal: s(8),
            paddingVertical: s(3),
            borderRadius: s(999),
            backgroundColor: style.bg,
          }}
        >
          <Typography
            variant="label-02"
            weight="semibold"
            style={{ color: style.fg }}
          >
            {style.label}
          </Typography>
        </View>
      </View>
      {client.hint && client.reason !== 'stable' ? (
        <View
          className="flex-row items-start"
          style={{ gap: s(6), paddingLeft: s(2) }}
        >
          <View style={{ paddingTop: s(2) }}>
            <Ionicons
              name={REASON_DETAIL_ICON[client.reason]}
              size={11}
              color={style.fg}
            />
          </View>
          <Typography
            variant="body-03"
            className="flex-1 text-gray-700"
            numberOfLines={2}
          >
            {client.hint}
          </Typography>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

/* ────────────────────────────────────────────────
 * B′ 카드 덱 — 강조 카드들이 뒤로 겹쳐진 스택.
 *   - 앞의 카드가 제일 크고 뒤로 갈수록 작아져 공간감
 *   - 맨 앞 카드 탭 → 맨 뒤로 이동, 그 뒤 카드가 앞으로
 *   - 각 카드는 Animated.spring 으로 자신의 stack position 으로 보간
 * ──────────────────────────────────────────────── */
function PriorityStackList({
  highlighted,
  stable,
}: {
  highlighted: MockClient[];
  stable: MockClient[];
}) {
  // 카드의 표시 순서(첫 원소가 맨 앞). order 가 바뀔 때마다 각 카드가 자신의 새 position 으로 spring 한다.
  const [order, setOrder] = useState<string[]>(() =>
    highlighted.map((c) => c.id),
  );

  // 카드 본체 탭 → 상세 페이지 (lab 에서는 시각 피드백만, 실제는 router.push 자리).
  const handleCardTap = useCallback((_client: MockClient) => {
    // production: router.push(`/(main)/client/${_client.id}`)
  }, []);

  // 하단 인디케이터 점 탭 → 그 카드를 맨 앞으로. 카드 본체 탭과 분리해 실수 전환 방지.
  const selectCard = useCallback((id: string) => {
    setOrder((prev) => {
      if (prev[0] === id) return prev;
      return [id, ...prev.filter((x) => x !== id)];
    });
  }, []);

  const frontId = order[0];
  const frontClient = highlighted.find((c) => c.id === frontId);

  return (
    <ScrollView
      contentContainerStyle={{
        paddingHorizontal: s(20),
        paddingTop: s(4),
        paddingBottom: s(40),
        gap: s(16),
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* 섹션 헤더 — 스택 front card 에 따라 동적 호명 */}
      <SectionHeader
        title={
          frontClient ? getReasonTitle(frontClient) : '오늘 챙겨야 할 분들'
        }
        rightBadge={`${highlighted.length}명`}
        subtitle="카드 탭 = 상세 / 아래 점으로 카드 순서 조정"
      />

      {/* 카드 덱 영역 — 절대 위치 카드들, top 오프셋으로 뒤 카드 peek 공간 확보 */}
      <View
        style={{
          position: 'relative',
          height: s(260),
          marginTop: s(16),
        }}
      >
        {highlighted.map((client) => {
          const position = order.indexOf(client.id);
          return (
            <StackCard
              key={client.id}
              client={client}
              position={position}
              total={highlighted.length}
              onPress={() => handleCardTap(client)}
            />
          );
        })}
      </View>

      {/* 하단 인디케이터 — 점을 탭해서 카드를 앞으로 가져옴 */}
      <StackIndicator
        cards={highlighted}
        order={order}
        onSelect={selectCard}
      />

      {/* 안정 진행 — 현재 B 시안과 동일 */}
      {stable.length > 0 && (
        <View style={{ gap: s(8) }}>
          <View className="flex-row items-center" style={{ gap: s(6) }}>
            <Typography
              variant="label-01"
              weight="semibold"
              className="text-gray-600"
            >
              안정 진행 중
            </Typography>
            <Typography variant="label-01" className="text-gray-400">
              {stable.length}
            </Typography>
          </View>
          <View
            className="rounded-lg bg-surface"
            style={{ paddingVertical: s(4) }}
          >
            {stable.map((c, idx) => (
              <CompactRow
                key={c.id}
                client={c}
                isLast={idx === stable.length - 1}
              />
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

/* ────────────────────────────────────────────────
 * StackCard — 자신의 stack position 으로 spring 보간되는 카드 한 장.
 *   position 0 = 맨 앞 (가장 큼, 또렷함). 1, 2, ... = 뒤로 갈수록 작고 흐림.
 * ──────────────────────────────────────────────── */
function StackCard({
  client,
  position,
  total,
  onPress,
}: {
  client: MockClient;
  position: number;
  total: number;
  onPress: () => void;
}) {
  // 자신의 현재 position 을 Animated.Value 로 들고 있다가, prop 이 바뀌면 spring.
  const anim = useRef(new Animated.Value(position)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: position,
      tension: 80,
      friction: 13,
      useNativeDriver: true,
    }).start();
  }, [anim, position]);

  // 0 = 맨 앞, 1~ = 뒤로 갈수록 작고 위로 솟고 흐림 (peek 효과)
  const scale = anim.interpolate({
    inputRange: [0, 1, 2, 3, 4, 5, 6],
    outputRange: [1, 0.94, 0.88, 0.82, 0.76, 0.7, 0.64],
    extrapolate: 'clamp',
  });
  const translateY = anim.interpolate({
    inputRange: [0, 1, 2, 3, 4, 5, 6],
    outputRange: [s(0), s(-14), s(-28), s(-42), s(-56), s(-70), s(-84)],
    extrapolate: 'clamp',
  });
  const opacity = anim.interpolate({
    inputRange: [0, 1, 2, 3, 4],
    outputRange: [1, 0.88, 0.55, 0.25, 0],
    extrapolate: 'clamp',
  });

  const isFront = position === 0;
  const reason = REASON_STYLE[client.reason];
  const color = getProfileColor(client.id);

  return (
    <Animated.View
      pointerEvents={isFront ? 'auto' : 'none'}
      style={{
        position: 'absolute',
        top: s(60),
        left: 0,
        right: 0,
        opacity,
        zIndex: total - position,
        transform: [{ translateY }, { scale }],
      }}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={
          isFront ? `${client.name}, 탭하면 상세로 이동` : undefined
        }
        style={({ pressed }) => ({
          opacity: pressed ? 0.92 : 1,
          transform: pressed ? [{ scale: 0.99 }] : [],
        })}
      >
        <View
          className="rounded-lg bg-surface"
          style={{
            padding: s(16),
            gap: s(12),
            borderLeftWidth: s(3),
            borderLeftColor: reason.fg,
            // 카드 덱 깊이감을 위한 그림자
            shadowColor: '#000',
            shadowOffset: { width: 0, height: s(4) },
            shadowOpacity: 0.08,
            shadowRadius: s(10),
            elevation: 4,
          }}
        >
          {/* 1행: 아바타 + 이름·메타 + 사유칩 */}
          <View className="flex-row items-start" style={{ gap: s(12) }}>
            <View
              style={{
                width: s(48),
                height: s(48),
                borderRadius: s(24),
                backgroundColor: color.bg,
              }}
              className="items-center justify-center"
            >
              <Typography
                variant="title-01"
                weight="bold"
                style={{ color: color.fg }}
              >
                {client.name.slice(0, 1)}
              </Typography>
            </View>
            <View style={{ flex: 1, gap: s(2) }}>
              <Typography
                variant="body-01"
                weight="semibold"
                className="text-gray-900"
                numberOfLines={1}
              >
                {client.name}
              </Typography>
              <Typography variant="label-01" className="text-gray-500">
                {client.gender} · 만 {client.age}세 · 회기 {client.sessionCount}
              </Typography>
            </View>
            <View
              style={{
                paddingHorizontal: s(10),
                paddingVertical: s(4),
                borderRadius: s(999),
                backgroundColor: reason.bg,
              }}
              className="flex-row items-center"
            >
              <Ionicons name={reason.icon} size={12} color={reason.fg} />
              <Typography
                variant="label-02"
                weight="semibold"
                style={{ color: reason.fg, marginLeft: s(4) }}
              >
                {reason.label}
              </Typography>
            </View>
          </View>

          {/* 2행: 사유별 컨텍스트 블록 */}
          <ReasonContextBlock client={client} />

          {/* 3행: 메타 */}
          <View className="flex-row items-center" style={{ gap: s(6) }}>
            <Ionicons
              name="time-outline"
              size={12}
              color={COLORS.gray[400]}
            />
            <Typography variant="label-01" className="text-gray-500">
              {client.meta}
            </Typography>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

/* ────────────────────────────────────────────────
 * StackIndicator — 카드 덱 하단의 점 인디케이터.
 *   - 카드 1장당 점 하나. 점 색 = 사유 색(Reason fg)
 *   - 맨 앞 카드의 점은 크고 또렷, 나머지는 작고 흐림
 *   - 점 탭 → 그 카드를 맨 앞으로 (실수로 카드 본체를 탭했을 때 다음으로 넘어가는 문제 해결)
 * ──────────────────────────────────────────────── */
function StackIndicator({
  cards,
  order,
  onSelect,
}: {
  cards: MockClient[];
  order: string[];
  onSelect: (id: string) => void;
}) {
  if (cards.length <= 1) return null;

  const frontId = order[0];

  return (
    <View
      className="items-center"
      style={{ gap: s(8), paddingVertical: s(8) }}
      accessibilityLabel="카드 덱 순서 조정"
    >
      <View className="flex-row items-center" style={{ gap: s(10) }}>
        {cards.map((client) => {
          const isFront = client.id === frontId;
          const reason = REASON_STYLE[client.reason];
          return (
            <Pressable
              key={client.id}
              onPress={() => onSelect(client.id)}
              hitSlop={{ top: 14, bottom: 14, left: 6, right: 6 }}
              accessibilityRole="button"
              accessibilityState={{ selected: isFront }}
              accessibilityLabel={`${client.name} · ${reason.label}`}
              style={{
                width: s(20),
                height: s(20),
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AnimatedDot active={isFront} color={reason.fg} />
            </Pressable>
          );
        })}
      </View>
      <Typography variant="caption-01" className="text-gray-400">
        점을 탭하면 그 카드가 앞으로 와요
      </Typography>
    </View>
  );
}

function AnimatedDot({ active, color }: { active: boolean; color: string }) {
  const anim = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: active ? 1 : 0,
      tension: 160,
      friction: 14,
      useNativeDriver: true,
    }).start();
  }, [anim, active]);

  const scale = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.5],
  });
  const opacity = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 1],
  });

  return (
    <Animated.View
      style={{
        width: s(8),
        height: s(8),
        borderRadius: s(4),
        backgroundColor: color,
        opacity,
        transform: [{ scale }],
      }}
    />
  );
}

/* ────────────────────────────────────────────────
 * D 캐러셀 — 가운데 큰 카드 + 양옆 작게 peek.
 *   - 좌우 스와이프(snap)로 카드 전환
 *   - 스크롤 위치에 따라 각 카드가 scale/opacity 보간 → 공간감
 *   - 카드 본체 탭 = 상세 (스택과 동일 컨벤션)
 *   - 하단 인디케이터 점 탭 = 그 카드로 scrollToOffset
 * ──────────────────────────────────────────────── */
const CAROUSEL_ITEM_WIDTH = s(320);
const CAROUSEL_ITEM_GAP = s(-16);
const CAROUSEL_ITEM_FULL = CAROUSEL_ITEM_WIDTH + CAROUSEL_ITEM_GAP;

// useNativeDriver: true 로 onScroll 을 바인딩하려면 Animated 래핑이 필수.
// 일반 FlatList 에 직접 연결하면 "useNativeDriver was specified but..." 에러 발생.
// Animated.createAnimatedComponent 는 제네릭을 잃어 ListRenderItem<unknown> 으로 보이므로
// typeof FlatList 로 캐스트해서 <AnimatedFlatList<MockClient>> 사용시 제네릭 복구.
const AnimatedFlatList = Animated.createAnimatedComponent(
  FlatList,
) as unknown as typeof FlatList;

function PriorityCarouselList({
  highlighted,
  allClients,
}: {
  highlighted: MockClient[];
  allClients: MockClient[];
}) {
  const { width: screenWidth } = useWindowDimensions();
  const sidePadding = Math.max(s(20), (screenWidth - CAROUSEL_ITEM_WIDTH) / 2);

  const scrollX = useRef(new Animated.Value(0)).current;
  // AnimatedFlatList 인스턴스의 ref — scrollToOffset 호출용. 래핑 컴포넌트라 타입은 any 캐스트.
  const listRef = useRef<FlatList<MockClient> | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    { useNativeDriver: true },
  );

  const handleMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      const idx = Math.round(x / CAROUSEL_ITEM_FULL);
      setActiveIndex(Math.max(0, Math.min(idx, highlighted.length - 1)));
    },
    [highlighted.length],
  );

  // 카드 본체 탭 → 상세 페이지 (lab 에서는 placeholder)
  const handleCardTap = useCallback((_client: MockClient) => {
    // production: router.push(`/(main)/client/${_client.id}`)
  }, []);

  // 인디케이터 점 탭 → 그 카드로 스냅 이동
  const selectCard = useCallback(
    (id: string) => {
      const idx = highlighted.findIndex((c) => c.id === id);
      if (idx < 0) return;
      listRef.current?.scrollToOffset({
        offset: idx * CAROUSEL_ITEM_FULL,
        animated: true,
      });
      setActiveIndex(idx);
    },
    [highlighted],
  );

  // 인디케이터는 frontId 만 보고 active 표시 — activeIndex 기반으로 order 합성
  const indicatorOrder = useMemo(() => {
    if (!highlighted[activeIndex]) return [];
    const activeId = highlighted[activeIndex].id;
    return [
      activeId,
      ...highlighted.map((c) => c.id).filter((id) => id !== activeId),
    ];
  }, [highlighted, activeIndex]);

  const frontClient = highlighted[activeIndex];

  return (
    <ScrollView
      contentContainerStyle={{
        paddingTop: s(4),
        paddingBottom: s(40),
        gap: s(16),
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* 섹션 헤더 — 캐러셀 active card 에 따라 동적 호명 + 진행 카운터 */}
      <View style={{ marginHorizontal: s(20) }}>
        <SectionHeader
          title={
            frontClient ? getReasonTitle(frontClient) : '오늘 챙겨야 할 분들'
          }
          rightBadge={`${activeIndex + 1}/${highlighted.length}`}
          subtitle="양옆 스와이프 또는 아래 점 탭으로 카드 이동"
        />
      </View>

      {/* 캐러셀 — Animated.event 가 scrollX 를 native 로 구동 */}
      <View style={{ marginTop: s(8), marginBottom: s(8) }}>
        <AnimatedFlatList<MockClient>
          ref={listRef}
          data={highlighted}
          horizontal
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          snapToInterval={CAROUSEL_ITEM_FULL}
          decelerationRate="fast"
          contentContainerStyle={{ paddingHorizontal: sidePadding }}
          onScroll={handleScroll}
          onMomentumScrollEnd={handleMomentumEnd}
          scrollEventThrottle={16}
          renderItem={({ item, index }) => (
            <CarouselCard
              client={item}
              index={index}
              scrollX={scrollX}
              onPress={() => handleCardTap(item)}
            />
          )}
        />
      </View>

      {/* 하단 인디케이터 — 스택과 동일 컴포넌트 재사용 */}
      <StackIndicator
        cards={highlighted}
        order={indicatorOrder}
        onSelect={selectCard}
      />

      {/* 전체 내담자 — 캐러셀 아래에서 모든 내담자를 별개 카드로 나열 */}
      {allClients.length > 0 && (
        <View style={{ gap: s(12), marginHorizontal: s(20) }}>
          <View className="flex-row items-center" style={{ gap: s(6) }}>
            <Typography
              variant="label-01"
              weight="semibold"
              className="text-gray-600"
            >
              전체 내담자
            </Typography>
            <Typography variant="label-01" className="text-gray-400">
              {allClients.length}
            </Typography>
          </View>
          <View style={{ gap: s(8) }}>
            {allClients.map((c) => (
              <SectionCard key={c.id} client={c} />
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

/* ────────────────────────────────────────────────
 * CarouselCard — 자신의 index 기준으로 scrollX 보간.
 *   index 와 scrollX 가 정확히 일치할 때 = 가운데 = 1.0 / 1.0
 *   ±1 인접 카드 = 0.84 / 0.45 (옆에 살짝 보이는 peek)
 * ──────────────────────────────────────────────── */
function CarouselCard({
  client,
  index,
  scrollX,
  onPress,
}: {
  client: MockClient;
  index: number;
  scrollX: Animated.Value;
  onPress: () => void;
}) {
  const inputRange = [
    (index - 1) * CAROUSEL_ITEM_FULL,
    index * CAROUSEL_ITEM_FULL,
    (index + 1) * CAROUSEL_ITEM_FULL,
  ];

  const scale = scrollX.interpolate({
    inputRange,
    outputRange: [0.84, 1, 0.84],
    extrapolate: 'clamp',
  });
  const opacity = scrollX.interpolate({
    inputRange,
    outputRange: [0.45, 1, 0.45],
    extrapolate: 'clamp',
  });
  const translateY = scrollX.interpolate({
    inputRange,
    outputRange: [s(8), 0, s(8)],
    extrapolate: 'clamp',
  });

  const reason = REASON_STYLE[client.reason];
  const color = getProfileColor(client.id);

  return (
    <Animated.View
      style={{
        width: CAROUSEL_ITEM_WIDTH,
        marginRight: CAROUSEL_ITEM_GAP,
        transform: [{ scale }, { translateY }],
        opacity,
      }}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${client.name}, 탭하면 상세로 이동`}
        style={({ pressed }) => ({
          opacity: pressed ? 0.92 : 1,
          transform: pressed ? [{ scale: 0.99 }] : [],
        })}
      >
        <View
          className="rounded-lg bg-surface"
          style={{
            padding: s(16),
            gap: s(12),
            shadowColor: '#000',
            shadowOffset: { width: 0, height: s(4) },
            shadowOpacity: 0.08,
            shadowRadius: s(10),
            elevation: 4,
          }}
        >
          {/* 1행: 아바타 + 이름·메타 + 사유칩 */}
          <View className="flex-row items-start" style={{ gap: s(12) }}>
            <View
              style={{
                width: s(44),
                height: s(44),
                borderRadius: s(22),
                backgroundColor: color.bg,
              }}
              className="items-center justify-center"
            >
              <Typography
                variant="body-01"
                weight="bold"
                style={{ color: color.fg }}
              >
                {client.name.slice(0, 1)}
              </Typography>
            </View>
            <View style={{ flex: 1, gap: s(2) }}>
              <Typography
                variant="body-01"
                weight="semibold"
                className="text-gray-900"
                numberOfLines={1}
              >
                {client.name}
              </Typography>
              <Typography
                variant="label-01"
                className="text-gray-500"
                numberOfLines={1}
              >
                {client.gender} · 만 {client.age}세
              </Typography>
            </View>
            <View
              style={{
                paddingHorizontal: s(8),
                paddingVertical: s(3),
                borderRadius: s(999),
                backgroundColor: reason.bg,
              }}
              className="flex-row items-center"
            >
              <Ionicons name={reason.icon} size={11} color={reason.fg} />
              <Typography
                variant="label-02"
                weight="semibold"
                style={{ color: reason.fg, marginLeft: s(3) }}
              >
                {reason.label}
              </Typography>
            </View>
          </View>

          {/* 2행: 사유별 컨텍스트 블록 */}
          <ReasonContextBlock client={client} />

          {/* 3행: 메타 */}
          <View className="flex-row items-center" style={{ gap: s(6) }}>
            <Ionicons
              name="time-outline"
              size={12}
              color={COLORS.gray[400]}
            />
            <Typography variant="label-01" className="text-gray-500">
              회기 {client.sessionCount} · {client.meta}
            </Typography>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

/* ────────────────────────────────────────────────
 * SectionHeader — 우선순위 시안 상단 타이틀.
 *   B 나열 / C 스택 / D 캐러셀 에서 공유 사용.
 * ──────────────────────────────────────────────── */
function SectionHeader({
  title,
  rightBadge,
  subtitle,
}: {
  title: string;
  /** 우측 뱃지 — "6명" / "1/6" 등. 생략 가능. */
  rightBadge?: string;
  subtitle: string;
}) {
  return (
    <View style={{ gap: s(2) }}>
      <View
        className="flex-row items-end"
        style={{ gap: s(8) }}
      >
        <Typography
          variant="title-01"
          weight="semibold"
          className="flex-1 text-gray-900"
          numberOfLines={1}
        >
          {title}
        </Typography>
        {rightBadge ? (
          <Typography
            variant="body-03"
            weight="medium"
            className="text-gray-500"
            style={{ paddingBottom: s(2) }}
          >
            {rightBadge}
          </Typography>
        ) : null}
      </View>
      <Typography variant="body-03" className="text-gray-500">
        {subtitle}
      </Typography>
    </View>
  );
}

/* ────────────────────────────────────────────────
 * ReasonContextBlock — 카드 row 2. 사유별로 모양과 내용이 달라짐.
 *  - 공통: 배경은 reason.bg (tint), 아이콘은 reason.fg (solid), 텍스트는 hint
 *  - closing-soon: 텍스트 대신 진행 바 + N/M 회기 표시
 *  - 사유에 따라 아이콘이 다름(REASON_DETAIL_ICON) — 같은 사유는 한 눈에 식별 가능
 * ──────────────────────────────────────────────── */
function ReasonContextBlock({ client }: { client: MockClient }) {
  const style = REASON_STYLE[client.reason];

  // closing-soon — 진행 바
  if (client.reason === 'closing-soon' && client.progress) {
    const { done, total } = client.progress;
    const pct = Math.max(0, Math.min(1, done / total));
    return (
      <View
        className="rounded-md"
        style={{
          backgroundColor: style.bg,
          paddingHorizontal: s(12),
          paddingVertical: s(10),
          gap: s(8),
        }}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center" style={{ gap: s(6) }}>
            <Ionicons name="flag-outline" size={12} color={style.fg} />
            <Typography
              variant="label-01"
              weight="semibold"
              style={{ color: style.fg }}
            >
              종결까지 {total - done}회기
            </Typography>
          </View>
          <Typography
            variant="label-01"
            weight="semibold"
            style={{ color: style.fg }}
          >
            {done}/{total}
          </Typography>
        </View>
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
              width: `${pct * 100}%`,
              height: '100%',
              backgroundColor: style.fg,
              borderRadius: s(2),
            }}
          />
        </View>
      </View>
    );
  }

  // 그 외 사유 — 아이콘 + 컨텍스트 텍스트
  const iconName =
    client.reason === 'stable'
      ? 'checkmark-circle-outline'
      : REASON_DETAIL_ICON[client.reason];

  return (
    <View
      className="flex-row items-start rounded-md"
      style={{
        backgroundColor: style.bg,
        paddingHorizontal: s(12),
        paddingVertical: s(10),
        gap: s(8),
      }}
    >
      <View style={{ paddingTop: s(2) }}>
        <Ionicons name={iconName} size={13} color={style.fg} />
      </View>
      <Typography
        variant="body-03"
        className="flex-1 text-gray-800"
        numberOfLines={2}
      >
        {client.hint}
      </Typography>
    </View>
  );
}
