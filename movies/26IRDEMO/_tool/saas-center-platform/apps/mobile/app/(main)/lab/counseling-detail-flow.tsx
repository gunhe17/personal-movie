import { useState } from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { COLORS, LAYOUT } from '@/shared/constants/theme';
import { Typography } from '@/shared/components/ui/Typography';
import { Icon } from '@/shared/components/icons';
import { s } from '@/shared/utils/scale';

/**
 * 상담 상세 — 흐름 중심 재구성 시안 (3 variant 비교).
 *
 * 그룹 케이스(2명)를 가정해 일지 단위 모호함 해소.
 * 일지는 회기당 N명(내담자별) 작성되는 본질을 어떻게 표현할지 3안 비교.
 *
 *  A · 내담자 필터  — 사람 chip 선택 → 선택된 사람의 일지만 시간순 (focused 내러티브)
 *  B · 회기 stack  — 회기 카드 시간축 + 내담자별 일지 상태 chip 가로 stack (요약 비교)
 *  C · 회기 펼침   — 회기 카드 시간축 + 회기 안에 사람별 일지 summary 펼침 (풍부)
 */

type Attendance = 'attended' | 'absent' | 'no_show' | 'scheduled';
type JournalState = 'all' | 'partial' | 'none';
type VariantKey = 'A' | 'B' | 'C';

const VARIANTS: { key: VariantKey; label: string }[] = [
  { key: 'A', label: '내담자 필터' },
  { key: 'B', label: '회기 stack' },
  { key: 'C', label: '회기 펼침' },
];

const MOCK = {
  program_name: '집단상담-그룹',
  case_status: '진행중' as const,
  total_sessions: 10,
  completed_sessions: 5,
  pending_notes: 3,
  clients: [
    {
      id: 'c1',
      name: '홍길동',
      gender: '남',
      age: 32,
      completed: 5,
      recent: ['attended', 'attended', 'absent', 'attended', 'attended'] as Attendance[],
    },
    {
      id: 'c2',
      name: '이영희',
      gender: '여',
      age: 35,
      completed: 4,
      recent: ['attended', 'attended', 'absent', 'absent', 'attended'] as Attendance[],
    },
  ],
  // 회기별 일지 (회기 1개 = 내담자 N명의 일지)
  sessions: [
    {
      id: 's5',
      date: '5/15 (수)',
      journals: [
        {
          clientId: 'c1',
          state: 'partial' as JournalState,
          summary:
            '일상에서의 분노 조절 시도 보고. 가족과의 갈등 상황에서 한 차례 적용 성공. 학교 환경에서는 여전히 어려움.',
        },
        {
          clientId: 'c2',
          state: 'all' as JournalState,
          summary:
            '그룹 내 다른 멤버에 대한 인식 변화 표현. 적극적인 발화 시도. 직장 갈등 상황 빈도 감소 보고.',
        },
      ],
    },
    {
      id: 's4',
      date: '5/8 (수)',
      journals: [
        { clientId: 'c1', state: 'none' as JournalState, summary: null },
        {
          clientId: 'c2',
          state: 'all' as JournalState,
          summary:
            '인지 재구성 기법 적용 점검. 일상 모니터링 과제 수행 우수. 자기 인식 수준 상승.',
        },
      ],
    },
    {
      id: 's3',
      date: '3/18 (수)',
      journals: [
        {
          clientId: 'c1',
          state: 'all' as JournalState,
          summary:
            '학교 환경에서 인지 재구성 적용 어려움 보고. 또래 관계 스트레스 주된 호소.',
        },
        {
          clientId: 'c2',
          state: 'all' as JournalState,
          summary: '직장 내 갈등 상황 명료화. 회피 패턴 인식.',
        },
      ],
    },
    {
      id: 's2',
      date: '3/11 (수)',
      journals: [
        {
          clientId: 'c1',
          state: 'all' as JournalState,
          summary: '주요 호소 문제 재명료화. 분노 표현 방식의 변화 인지.',
        },
        {
          clientId: 'c2',
          state: 'all' as JournalState,
          summary: '대인 관계 패턴 탐색 시작. 가족력 영향 자각.',
        },
      ],
    },
    {
      id: 's1',
      date: '3/4 (수)',
      journals: [
        {
          clientId: 'c1',
          state: 'all' as JournalState,
          summary: '최초 라포 형성. 자기 인식 수준 양호.',
        },
        {
          clientId: 'c2',
          state: 'all' as JournalState,
          summary: '최초 라포 형성. 목표 합의.',
        },
      ],
    },
  ],
};

// ──────────────── Page ────────────────

export default function CounselingDetailFlowLab() {
  const router = useRouter();
  const [variant, setVariant] = useState<VariantKey>('A');
  const progressRatio = MOCK.completed_sessions / MOCK.total_sessions;

  return (
    <View className="flex-1" style={{ backgroundColor: COLORS.white }}>
      {/* 헤더 */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: COLORS.bg.base }}>
        <View
          style={{
            height: s(48),
            paddingHorizontal: s(LAYOUT.screenPaddingX),
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <Icon name="arrow-left" size={24} color={COLORS.gray[900]} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Typography variant="title-01" weight="semibold" className="text-gray-900">
              상담 상세 · 흐름
            </Typography>
          </View>
          <View style={{ width: 24 }} />
        </View>

        {/* Variant 비교 탭 */}
        <View style={{ paddingHorizontal: s(20), paddingBottom: s(8) }}>
          <View
            style={{
              backgroundColor: COLORS.gray[100],
              borderRadius: s(8),
              padding: s(2),
              flexDirection: 'row',
              gap: s(2),
            }}
          >
            {VARIANTS.map((v) => {
              const active = variant === v.key;
              return (
                <TouchableOpacity
                  key={v.key}
                  onPress={() => setVariant(v.key)}
                  activeOpacity={0.7}
                  style={{
                    flex: 1,
                    paddingVertical: s(7),
                    backgroundColor: active ? COLORS.white : 'transparent',
                    borderRadius: s(6),
                    alignItems: 'center',
                  }}
                >
                  <Typography
                    variant="label-02"
                    weight={active ? 'semibold' : 'medium'}
                    style={{
                      color: active ? COLORS.gray[900] : COLORS.gray[500],
                    }}
                  >
                    {v.key} · {v.label}
                  </Typography>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        style={{ backgroundColor: COLORS.white }}
        contentContainerStyle={{ paddingBottom: s(40) }}
      >
        {/* Gray Zone — 공통 */}
        <View
          style={{
            backgroundColor: COLORS.bg.base,
            paddingTop: s(12),
            paddingBottom: s(24),
          }}
        >
          {MOCK.pending_notes > 0 && (
            <View
              style={{
                marginHorizontal: s(20),
                marginBottom: s(12),
                backgroundColor: COLORS.paletteBg.yellow,
                borderRadius: s(12),
                paddingHorizontal: s(14),
                paddingVertical: s(10),
                flexDirection: 'row',
                alignItems: 'center',
                gap: s(8),
              }}
            >
              <Typography
                variant="label-01"
                weight="semibold"
                style={{ color: COLORS.palette.yellow }}
              >
                미작성 일지 {MOCK.pending_notes}건
              </Typography>
              <Typography variant="label-01" className="text-gray-400">
                ·
              </Typography>
              <Typography variant="label-01" className="text-gray-700">
                아래 일지 흐름에서 작성하기
              </Typography>
              <View style={{ marginLeft: 'auto' }}>
                <Icon name="arrow-right" size={14} color={COLORS.gray[500]} />
              </View>
            </View>
          )}

          <View
            style={{
              marginHorizontal: s(20),
              backgroundColor: COLORS.white,
              borderRadius: s(16),
              padding: s(16),
            }}
          >
            <View className="flex-row items-start justify-between">
              <View className="flex-1 pr-3">
                <Typography
                  variant="headline-02"
                  weight="semibold"
                  className="text-gray-900"
                >
                  {MOCK.program_name}
                </Typography>
              </View>
              <View
                style={{ backgroundColor: COLORS.paletteBg.orange }}
                className="rounded-full px-2.5 py-1"
              >
                <Typography
                  variant="label-02"
                  weight="semibold"
                  style={{ color: COLORS.palette.orange }}
                >
                  {MOCK.case_status}
                </Typography>
              </View>
            </View>
            <View style={{ marginTop: s(16) }}>
              <View
                className="flex-row items-center justify-between"
                style={{ marginBottom: s(8) }}
              >
                <Typography variant="label-01" weight="medium" className="text-gray-500">
                  회기 진행
                </Typography>
                <Typography variant="label-01" weight="semibold" className="text-gray-900">
                  {MOCK.completed_sessions}/{MOCK.total_sessions}
                </Typography>
              </View>
              <View
                style={{
                  height: s(6),
                  borderRadius: s(3),
                  backgroundColor: COLORS.gray[100],
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    width: `${progressRatio * 100}%`,
                    height: '100%',
                    backgroundColor: COLORS.palette.green,
                  }}
                />
              </View>
            </View>
          </View>
        </View>

        {/* White Zone */}
        <View
          style={{
            backgroundColor: COLORS.white,
            paddingTop: s(24),
            paddingHorizontal: s(20),
          }}
        >
          {/* 내담자 그리드 — 공통 */}
          <View
            className="flex-row items-baseline"
            style={{ gap: s(6), marginBottom: s(12) }}
          >
            <Typography variant="body-02" weight="bold" className="text-gray-900">
              내담자
            </Typography>
            <Typography variant="label-01" className="text-gray-500">
              {MOCK.clients.length}명
            </Typography>
          </View>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: s(10),
              marginBottom: s(28),
            }}
          >
            {MOCK.clients.map((c) => (
              <ClientCard key={c.id} client={c} total={MOCK.total_sessions} />
            ))}
          </View>

          {/* Variant 별 일지 흐름 */}
          {variant === 'A' && <VariantA />}
          {variant === 'B' && <VariantB />}
          {variant === 'C' && <VariantC />}
        </View>
      </ScrollView>
    </View>
  );
}

// ──────────────── Variant A · 내담자 필터 ────────────────

function VariantA() {
  const [selectedId, setSelectedId] = useState(MOCK.clients[0].id);
  const selected = MOCK.clients.find((c) => c.id === selectedId)!;
  const journalsForClient = MOCK.sessions.map((s) => ({
    sessionId: s.id,
    date: s.date,
    j: s.journals.find((j) => j.clientId === selectedId),
  }));

  return (
    <View>
      <View
        className="flex-row items-baseline"
        style={{ gap: s(6), marginBottom: s(4) }}
      >
        <Typography variant="body-02" weight="bold" className="text-gray-900">
          일지 흐름
        </Typography>
        <Typography variant="label-01" className="text-gray-500">
          {selected.name}님 · 최신 → 과거
        </Typography>
      </View>
      <Typography
        variant="label-02"
        className="text-gray-400"
        style={{ marginBottom: s(12) }}
      >
        내담자를 선택해 본인의 회기별 일지를 확인하세요
      </Typography>

      {/* 내담자 선택 chip stack */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: s(8), paddingRight: s(20) }}
        style={{ marginHorizontal: -s(20), paddingHorizontal: s(20), marginBottom: s(12) }}
      >
        {MOCK.clients.map((c) => {
          const active = c.id === selectedId;
          return (
            <TouchableOpacity
              key={c.id}
              onPress={() => setSelectedId(c.id)}
              activeOpacity={0.7}
              style={{
                paddingHorizontal: s(12),
                paddingVertical: s(8),
                borderRadius: s(20),
                backgroundColor: active ? COLORS.gray[900] : COLORS.gray[50],
                flexDirection: 'row',
                alignItems: 'center',
                gap: s(6),
              }}
            >
              <Typography
                variant="label-01"
                weight="semibold"
                style={{ color: active ? COLORS.white : COLORS.gray[800] }}
              >
                {c.name}
              </Typography>
              <Typography
                variant="label-02"
                weight="medium"
                style={{
                  color: active ? 'rgba(255,255,255,0.7)' : COLORS.gray[500],
                }}
              >
                {c.completed}/{MOCK.total_sessions}회
              </Typography>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={{ gap: s(10) }}>
        {journalsForClient.slice(0, 4).map((row) =>
          row.j ? (
            <JournalRow
              key={row.sessionId}
              date={row.date}
              state={row.j.state}
              summary={row.j.summary}
            />
          ) : null,
        )}
      </View>

      {MOCK.sessions.length > 4 && (
        <TouchableOpacity
          activeOpacity={0.7}
          style={{
            paddingVertical: s(12),
            marginTop: s(4),
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: s(4),
          }}
        >
          <Typography variant="label-01" weight="semibold" className="text-gray-600">
            이전 회기 {MOCK.sessions.length - 4}건 더 보기
          </Typography>
          <Icon name="arrow-right" size={12} color={COLORS.gray[600]} />
        </TouchableOpacity>
      )}
    </View>
  );
}

// ──────────────── Variant B · 회기 stack + 일지 chip ────────────────

function VariantB() {
  return (
    <View>
      <View
        className="flex-row items-baseline"
        style={{ gap: s(6), marginBottom: s(4) }}
      >
        <Typography variant="body-02" weight="bold" className="text-gray-900">
          회기별 일지
        </Typography>
        <Typography variant="label-01" className="text-gray-500">
          최신 → 과거
        </Typography>
      </View>
      <Typography
        variant="label-02"
        className="text-gray-400"
        style={{ marginBottom: s(12) }}
      >
        회기별로 내담자 일지 작성 상태를 한눈에 확인하세요
      </Typography>

      <View style={{ gap: s(10) }}>
        {MOCK.sessions.slice(0, 4).map((s) => (
          <SessionChipCard key={s.id} session={s} />
        ))}
      </View>

      {MOCK.sessions.length > 4 && (
        <TouchableOpacity
          activeOpacity={0.7}
          style={{
            paddingVertical: s(12),
            marginTop: s(4),
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: s(4),
          }}
        >
          <Typography variant="label-01" weight="semibold" className="text-gray-600">
            이전 회기 {MOCK.sessions.length - 4}건 더 보기
          </Typography>
          <Icon name="arrow-right" size={12} color={COLORS.gray[600]} />
        </TouchableOpacity>
      )}
    </View>
  );
}

// ──────────────── Variant C · 회기 펼침 (summary 본문 포함) ────────────────

function VariantC() {
  return (
    <View>
      <View
        className="flex-row items-baseline"
        style={{ gap: s(6), marginBottom: s(4) }}
      >
        <Typography variant="body-02" weight="bold" className="text-gray-900">
          회기별 일지
        </Typography>
        <Typography variant="label-01" className="text-gray-500">
          최신 → 과거
        </Typography>
      </View>
      <Typography
        variant="label-02"
        className="text-gray-400"
        style={{ marginBottom: s(12) }}
      >
        회기별 내담자 일지 본문을 한 자리에서 확인하세요
      </Typography>

      <View style={{ gap: s(10) }}>
        {MOCK.sessions.slice(0, 4).map((s) => (
          <SessionExpandedCard key={s.id} session={s} />
        ))}
      </View>

      {MOCK.sessions.length > 4 && (
        <TouchableOpacity
          activeOpacity={0.7}
          style={{
            paddingVertical: s(12),
            marginTop: s(4),
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: s(4),
          }}
        >
          <Typography variant="label-01" weight="semibold" className="text-gray-600">
            이전 회기 {MOCK.sessions.length - 4}건 더 보기
          </Typography>
          <Icon name="arrow-right" size={12} color={COLORS.gray[600]} />
        </TouchableOpacity>
      )}
    </View>
  );
}

// ──────────────── 보조 컴포넌트 ────────────────

function AttendanceDot({ status }: { status: Attendance }) {
  const palette = (() => {
    if (status === 'attended') {
      return { bg: COLORS.palette.green, border: COLORS.palette.green };
    }
    if (status === 'absent' || status === 'no_show') {
      return { bg: COLORS.gray[300], border: COLORS.gray[300] };
    }
    return { bg: 'transparent', border: COLORS.gray[300] };
  })();
  return (
    <View
      style={{
        width: s(7),
        height: s(7),
        borderRadius: s(4),
        backgroundColor: palette.bg,
        borderWidth: 1,
        borderColor: palette.border,
      }}
    />
  );
}

function ClientCard({
  client,
  total,
}: {
  client: typeof MOCK.clients[number];
  total: number;
}) {
  return (
    <View
      style={{
        width: '31%',
        backgroundColor: COLORS.gray[50],
        borderRadius: s(12),
        paddingVertical: s(14),
        paddingHorizontal: s(8),
        alignItems: 'center',
        gap: s(8),
      }}
    >
      <View
        style={{
          width: s(44),
          height: s(44),
          borderRadius: s(22),
          backgroundColor: COLORS.primary50,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography
          variant="body-02"
          weight="semibold"
          style={{ color: COLORS.primary700 }}
        >
          {client.name[0]}
        </Typography>
      </View>
      <View style={{ alignItems: 'center', gap: s(2) }}>
        <Typography
          variant="body-02"
          weight="semibold"
          className="text-gray-900"
          numberOfLines={1}
        >
          {client.name}
        </Typography>
        <Typography variant="label-02" className="text-gray-500" numberOfLines={1}>
          {client.gender} · 만 {client.age}세
        </Typography>
        <Typography
          variant="label-02"
          weight="medium"
          className="text-gray-700"
          style={{ marginTop: s(2) }}
        >
          {client.completed}/{total}회
        </Typography>
      </View>
      <View
        className="flex-row items-center"
        style={{ gap: s(4), marginTop: s(2) }}
      >
        {client.recent.map((status, i) => (
          <AttendanceDot key={i} status={status} />
        ))}
      </View>
    </View>
  );
}

function getJournalPalette(state: JournalState) {
  if (state === 'all') return { bg: COLORS.paletteBg.green, color: COLORS.palette.green };
  if (state === 'partial') return { bg: COLORS.paletteBg.yellow, color: COLORS.palette.yellow };
  return { bg: COLORS.paletteBg.red, color: COLORS.palette.red };
}

function getJournalLabel(state: JournalState) {
  if (state === 'all') return '완료';
  if (state === 'partial') return '부분';
  return '미작성';
}

/** Variant A · 일지 행 (1인 시간순) */
function JournalRow({
  date,
  state,
  summary,
}: {
  date: string;
  state: JournalState;
  summary: string | null;
}) {
  const palette = getJournalPalette(state);
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={{
        backgroundColor: COLORS.gray[50],
        borderRadius: s(12),
        paddingVertical: s(12),
        paddingHorizontal: s(14),
        gap: s(6),
      }}
    >
      <View className="flex-row items-center" style={{ gap: s(8) }}>
        <Typography variant="body-02" weight="semibold" className="text-gray-900">
          {date}
        </Typography>
        <View
          style={{ backgroundColor: palette.bg }}
          className="rounded-full px-2 py-0.5"
        >
          <Typography variant="label-02" weight="semibold" style={{ color: palette.color }}>
            {getJournalLabel(state)}
          </Typography>
        </View>
        <View style={{ marginLeft: 'auto' }}>
          <Icon name="arrow-right" size={12} color={COLORS.gray[400]} />
        </View>
      </View>
      {summary ? (
        <Typography variant="body-03" className="text-gray-600" numberOfLines={2}>
          {summary}
        </Typography>
      ) : (
        <Typography variant="label-01" className="text-gray-400">
          작성된 일지가 없어요 — 탭하여 작성하기
        </Typography>
      )}
    </TouchableOpacity>
  );
}

/** Variant B · 회기 카드 — 일지 상태 chip만 가로 stack */
function SessionChipCard({
  session,
}: {
  session: typeof MOCK.sessions[number];
}) {
  return (
    <View
      style={{
        backgroundColor: COLORS.gray[50],
        borderRadius: s(12),
        paddingVertical: s(12),
        paddingHorizontal: s(14),
        gap: s(10),
      }}
    >
      <View className="flex-row items-center" style={{ gap: s(8) }}>
        <Typography variant="body-02" weight="semibold" className="text-gray-900">
          {session.date}
        </Typography>
        <View style={{ marginLeft: 'auto' }}>
          <Icon name="arrow-right" size={12} color={COLORS.gray[400]} />
        </View>
      </View>
      <View className="flex-row" style={{ gap: s(8), flexWrap: 'wrap' }}>
        {session.journals.map((j) => {
          const client = MOCK.clients.find((c) => c.id === j.clientId);
          const palette = getJournalPalette(j.state);
          return (
            <TouchableOpacity
              key={j.clientId}
              activeOpacity={0.7}
              style={{
                paddingHorizontal: s(10),
                paddingVertical: s(6),
                borderRadius: s(20),
                backgroundColor: COLORS.white,
                flexDirection: 'row',
                alignItems: 'center',
                gap: s(6),
              }}
            >
              <Typography
                variant="label-01"
                weight="semibold"
                className="text-gray-800"
              >
                {client?.name}
              </Typography>
              <View
                style={{ backgroundColor: palette.bg }}
                className="rounded-full px-1.5 py-0.5"
              >
                <Typography
                  variant="label-02"
                  weight="semibold"
                  style={{ color: palette.color }}
                >
                  {getJournalLabel(j.state)}
                </Typography>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

/** Variant C · 회기 카드 — 사람별 일지 summary 본문 펼침 */
function SessionExpandedCard({
  session,
}: {
  session: typeof MOCK.sessions[number];
}) {
  return (
    <View
      style={{
        backgroundColor: COLORS.gray[50],
        borderRadius: s(12),
        paddingVertical: s(12),
        paddingHorizontal: s(14),
        gap: s(10),
      }}
    >
      <View className="flex-row items-center" style={{ gap: s(8) }}>
        <Typography variant="body-02" weight="semibold" className="text-gray-900">
          {session.date}
        </Typography>
        <View style={{ marginLeft: 'auto' }}>
          <Typography variant="label-02" className="text-gray-400">
            내담자 {session.journals.length}명
          </Typography>
        </View>
      </View>
      <View style={{ gap: s(10) }}>
        {session.journals.map((j) => {
          const client = MOCK.clients.find((c) => c.id === j.clientId);
          const palette = getJournalPalette(j.state);
          return (
            <TouchableOpacity
              key={j.clientId}
              activeOpacity={0.7}
              style={{
                backgroundColor: COLORS.white,
                borderRadius: s(10),
                paddingVertical: s(10),
                paddingHorizontal: s(12),
                gap: s(4),
              }}
            >
              <View className="flex-row items-center" style={{ gap: s(6) }}>
                <Typography
                  variant="label-01"
                  weight="semibold"
                  className="text-gray-900"
                >
                  {client?.name}
                </Typography>
                <View
                  style={{ backgroundColor: palette.bg }}
                  className="rounded-full px-1.5 py-0.5"
                >
                  <Typography
                    variant="label-02"
                    weight="semibold"
                    style={{ color: palette.color }}
                  >
                    {getJournalLabel(j.state)}
                  </Typography>
                </View>
                <View style={{ marginLeft: 'auto' }}>
                  <Icon name="arrow-right" size={11} color={COLORS.gray[400]} />
                </View>
              </View>
              {j.summary ? (
                <Typography variant="body-03" className="text-gray-600" numberOfLines={2}>
                  {j.summary}
                </Typography>
              ) : (
                <Typography variant="label-02" className="text-gray-400">
                  작성된 일지가 없어요 — 탭하여 작성하기
                </Typography>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
