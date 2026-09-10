import { View, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { COLORS, LAYOUT } from '@/shared/constants/theme';
import { Typography } from '@/shared/components/ui/Typography';
import { Icon } from '@/shared/components/icons';
import { s } from '@/shared/utils/scale';

/**
 * 상담 상세 · 후보 시안 lab.
 *
 * 단일 페이지 시안 (탭 비교 없음). 사용자가 명시적으로 변주 비교를 요청하면 탭 구조 도입.
 *
 * 후보 구성:
 *   - 요약 카드 통합 (케이스 메타 + 상태 뱃지 + 시작/완료일 + 회기 진행 progress bar)
 *   - compact 가로 행 ClientCard list (참석률 행 제거, 36 아바타, 출석 주의 inline dot)
 *
 * 시안 확정 후 production main `counseling/[id].tsx` 에 반영.
 *
 * 참고 — §3-2 "최근 회기 hero (키워드 chips)" 컨셉은 §3-1 일정 상세 hero 로 이동돼 본 lab 후보에는 미포함.
 */

// ──────────────── MOCK 데이터 ────────────────

const MOCK = {
  program_name: '놀이치료-개인',
  case_status: '진행중',
  counselor_name: '김상담',
  first_session_start: '2026. 03. 01',
  completed_at: '-',
  total_sessions: 10,
  completed_sessions: 5,
  clients: [
    {
      id: 'c1',
      name: '홍길동',
      gender: '남',
      age: 32,
      completed: 5,
    },
    {
      id: 'c2',
      name: '이영희',
      gender: '여',
      age: 35,
      completed: 4,
    },
  ],
  sessions: [
    { id: 's1', dateTime: '2026-03-04 (수) 14:00', room: '2상담실', status: 'completed' as const },
    { id: 's2', dateTime: '2026-03-11 (수) 14:00', room: '2상담실', status: 'completed' as const },
    { id: 's3', dateTime: '2026-03-18 (수) 14:00', room: '2상담실', status: 'completed' as const },
    { id: 's4', dateTime: '2026-05-08 (수) 14:00', room: '2상담실', status: 'completed' as const },
    { id: 's5', dateTime: '2026-05-15 (수) 14:00', room: '2상담실', status: 'completed' as const },
    { id: 's6', dateTime: '2026-05-22 (수) 14:00', room: '2상담실', status: 'scheduled' as const },
    { id: 's7', dateTime: '2026-05-29 (수) 14:00', room: '2상담실', status: 'scheduled' as const },
    { id: 's8', dateTime: '2026-06-05 (수) 14:00', room: '2상담실', status: 'scheduled' as const },
    { id: 's9', dateTime: '2026-06-12 (수) 14:00', room: null, status: 'cancelled' as const },
    { id: 's10', dateTime: '2026-06-19 (수) 14:00', room: '2상담실', status: 'scheduled' as const },
  ],
};

type SessionMockStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show';

const SESSION_STATUS_LABEL: Record<SessionMockStatus, string> = {
  scheduled: '예정',
  completed: '완료',
  cancelled: '취소',
  no_show: '노쇼',
};

function getSessionStatusPalette(status: SessionMockStatus) {
  if (status === 'completed') {
    return { color: COLORS.primary, bg: 'rgba(19,189,250,0.12)' };
  }
  if (status === 'cancelled') {
    return { color: COLORS.palette.red, bg: COLORS.paletteBg.red };
  }
  if (status === 'no_show') {
    return { color: COLORS.palette.orange, bg: COLORS.paletteBg.orange };
  }
  return { color: COLORS.palette.gray, bg: COLORS.paletteBg.gray };
}

// ──────────────── Page ────────────────

export default function CounselingDetailHeroLab() {
  const router = useRouter();
  const progressRatio = MOCK.completed_sessions / MOCK.total_sessions;

  return (
    <View className="flex-1" style={{ backgroundColor: COLORS.bg.base }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: COLORS.white }}>
        {/* 헤더 */}
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
            <Typography variant="title-01" weight="semibold" className="text-gray-900">
              상담 상세 · 후보 시안
            </Typography>
          </View>
          <View style={{ width: 24 }} />
        </View>
      </SafeAreaView>

      <ScrollView
        style={{ backgroundColor: COLORS.bg.base }}
        contentContainerStyle={{
          paddingTop: s(16),
          paddingBottom: s(40),
        }}
      >
        {/* 요약 카드 — 케이스 메타 + 상태 + 시작/완료일 + 회기 진행 progress bar */}
        <View
          style={{
            marginHorizontal: s(20),
            backgroundColor: COLORS.white,
            borderRadius: s(16),
            padding: s(16),
          }}
        >
          {/* 1) 프로그램명 + 상태 뱃지 (담당 상담사 = 본인이라 노출 안 함) */}
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
              style={{ backgroundColor: 'rgba(255,146,0,0.12)' }}
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

          {/* 2) 시작일 / 완료일 */}
          <View style={{ marginTop: s(8), gap: s(2) }}>
            <View className="flex-row items-center">
              <Typography
                variant="label-01"
                className="text-gray-500"
                style={{ width: s(56) }}
              >
                시작일
              </Typography>
              <Typography variant="label-01" weight="medium" className="text-gray-800">
                {MOCK.first_session_start}
              </Typography>
            </View>
            <View className="flex-row items-center">
              <Typography
                variant="label-01"
                className="text-gray-500"
                style={{ width: s(56) }}
              >
                완료일
              </Typography>
              <Typography variant="label-01" weight="medium" className="text-gray-800">
                {MOCK.completed_at}
              </Typography>
            </View>
          </View>

          {/* 3) 회기 진행 progress bar */}
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

        {/* 내담자 — compact 가로 행 list (참석률 없음, 36 아바타, 출석 주의 inline dot) */}
        <View className="mt-4 px-5">
          <Typography variant="body-02" weight="bold" className="mb-2 text-gray-900">
            내담자
          </Typography>
          <View style={{ gap: s(8) }}>
            {MOCK.clients.map((c) => (
              <CompactClientRow key={c.id} client={c} />
            ))}
          </View>
        </View>

        {/* 회기 리스트 */}
        <View className="mt-4 px-5">
          <Typography variant="body-02" weight="bold" className="mb-2 text-gray-900">
            회기
          </Typography>
          <View className="gap-2">
            {MOCK.sessions.map((session) => (
              <SessionCard key={session.id} session={session} />
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// ──────────────── 보조 컴포넌트 ────────────────

/** 회기 카드 — 날짜+시간(top) · 장소(sub) · 상태 뱃지 + chevron(우) (스펙 §3-2 회기 리스트) */
function SessionCard({ session }: { session: typeof MOCK.sessions[number] }) {
  const isCancelled = session.status === 'cancelled';
  const palette = getSessionStatusPalette(session.status);
  const statusLabel = SESSION_STATUS_LABEL[session.status];

  return (
    <View
      className="flex-row items-center rounded-2xl bg-surface px-4 py-3.5"
    >
      <View className="flex-1">
        <Typography
          variant="body-02"
          weight="semibold"
          className={isCancelled ? 'text-gray-400' : 'text-gray-900'}
        >
          {session.dateTime}
        </Typography>
        {session.room && (
          <Typography
            variant="label-01"
            className={isCancelled ? 'mt-1 text-gray-400' : 'mt-1 text-gray-500'}
          >
            {session.room}
          </Typography>
        )}
      </View>
      <View
        style={{ backgroundColor: palette.bg }}
        className="mr-2 rounded-full px-2.5 py-1"
      >
        <Typography
          variant="label-02"
          weight="semibold"
          style={{ color: palette.color }}
        >
          {statusLabel}
        </Typography>
      </View>
      <Icon name="arrow-right" size={16} color={COLORS.gray[400]} />
    </View>
  );
}

/** compact 가로 행 ClientCard — 36 아바타, 한 줄 메타, 우측 진행 회기 */
function CompactClientRow({ client }: { client: typeof MOCK.clients[number] }) {
  return (
    <View
      style={{
        backgroundColor: COLORS.white,
        borderRadius: s(12),
        paddingVertical: s(12),
        paddingHorizontal: s(14),
        flexDirection: 'row',
        alignItems: 'center',
        gap: s(12),
      }}
    >
      <View
        style={{
          width: s(36),
          height: s(36),
          borderRadius: s(18),
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
      <View style={{ flex: 1 }}>
        <View className="flex-row items-center" style={{ gap: s(6) }}>
          <Typography
            variant="body-02"
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
      <Typography variant="label-01" weight="semibold" className="text-gray-700">
        {client.completed}/{MOCK.total_sessions}회
      </Typography>
    </View>
  );
}
