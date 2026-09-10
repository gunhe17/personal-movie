import { View, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { COLORS, LAYOUT } from '@/shared/constants/theme';
import { Typography } from '@/shared/components/ui/Typography';
import { Icon } from '@/shared/components/icons';
import { s } from '@/shared/utils/scale';

/**
 * 상담 상세 시안 — 두 영역 분리 (gray top / white bottom).
 *
 * 레퍼런스: "챌린지" 류 페이지 패턴. 상단 gray 영역에 white 카드(hero·case info)를
 * 띄우고, 하단은 white 배경으로 명확히 분리해 리스트 콘텐츠 영역으로.
 *
 * Zone 구성:
 *   - Gray zone (gray-50 bg): 일지 alert · 다음 회기 카드 · 상담 정보 카드 (white cards on gray)
 *   - White zone (white bg):  내담자 list · 회기 list (gray-50 sunken cards on white)
 *
 * 단일 페이지 (탭 비교 없음). 시안 확정 후 main 적용 후보.
 */

// ──────────────── MOCK 데이터 ────────────────

const MOCK = {
  program_name: '놀이치료-개인',
  case_status: '진행중',
  first_session_start: '2026. 03. 01',
  completed_at: '-',
  total_sessions: 10,
  completed_sessions: 5,
  next_session: {
    date: '5/22 (수)',
    time: '14:00',
    room: '2상담실',
    dDay: 3,
  },
  pending_notes: 2,
  clients: [
    { id: 'c1', name: '홍길동', gender: '남', age: 32, completed: 5 },
    { id: 'c2', name: '이영희', gender: '여', age: 35, completed: 4 },
  ],
  sessions: [
    { id: 's1', dateTime: '2026-03-04 (수) 14:00', room: '2상담실', status: 'completed' as SessionStatus, noteState: 'all' as const },
    { id: 's2', dateTime: '2026-03-11 (수) 14:00', room: '2상담실', status: 'completed' as SessionStatus, noteState: 'all' as const },
    { id: 's3', dateTime: '2026-03-18 (수) 14:00', room: '2상담실', status: 'completed' as SessionStatus, noteState: 'all' as const },
    { id: 's4', dateTime: '2026-05-08 (수) 14:00', room: '2상담실', status: 'completed' as SessionStatus, noteState: 'none' as const },
    { id: 's5', dateTime: '2026-05-15 (수) 14:00', room: '2상담실', status: 'completed' as SessionStatus, noteState: 'partial' as const },
    { id: 's6', dateTime: '2026-05-22 (수) 14:00', room: '2상담실', status: 'scheduled' as SessionStatus, noteState: null },
    { id: 's7', dateTime: '2026-05-29 (수) 14:00', room: '2상담실', status: 'scheduled' as SessionStatus, noteState: null },
    { id: 's8', dateTime: '2026-06-05 (수) 14:00', room: '2상담실', status: 'scheduled' as SessionStatus, noteState: null },
    { id: 's9', dateTime: '2026-06-12 (수) 14:00', room: null, status: 'cancelled' as SessionStatus, noteState: null },
    { id: 's10', dateTime: '2026-06-19 (수) 14:00', room: '2상담실', status: 'scheduled' as SessionStatus, noteState: null },
  ],
};

type SessionStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show';
type NoteState = 'none' | 'partial' | 'all' | null;

const SESSION_STATUS_LABEL: Record<SessionStatus, string> = {
  scheduled: '예정',
  completed: '완료',
  cancelled: '취소',
  no_show: '노쇼',
};

function getSessionStatusPalette(status: SessionStatus) {
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

function getStatusLineColor(status: SessionStatus) {
  if (status === 'completed') return COLORS.palette.green;
  if (status === 'cancelled') return COLORS.palette.red;
  if (status === 'no_show') return COLORS.palette.orange;
  return COLORS.gray[300];
}

// ──────────────── Page ────────────────

export default function CounselingDetailZonesLab() {
  const router = useRouter();
  const progressRatio = MOCK.completed_sessions / MOCK.total_sessions;

  return (
    <View className="flex-1" style={{ backgroundColor: COLORS.white }}>
      {/* 헤더 — gray zone과 같은 톤 */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: COLORS.bg.base }}>
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
              상담 상세 · 두 영역
            </Typography>
          </View>
          <View style={{ width: 24 }} />
        </View>
      </SafeAreaView>

      <ScrollView
        style={{ backgroundColor: COLORS.white }}
        contentContainerStyle={{ paddingBottom: s(40) }}
      >
        {/* ────────── Gray Zone (상단 영역) ────────── */}
        <View
          style={{
            backgroundColor: COLORS.bg.base,
            paddingTop: s(12),
            paddingBottom: s(24),
          }}
        >
          {/* 일지 미작성 alert */}
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
                가장 오래된 회기부터 작성하기
              </Typography>
              <View style={{ marginLeft: 'auto' }}>
                <Icon name="arrow-right" size={14} color={COLORS.gray[500]} />
              </View>
            </View>
          )}

          {/* 다음 회기 카드 (white, primary accent label) */}
          <View
            style={{
              marginHorizontal: s(20),
              marginBottom: s(12),
              backgroundColor: COLORS.white,
              borderRadius: s(16),
              padding: s(16),
            }}
          >
            <View
              className="flex-row items-center justify-between"
              style={{ marginBottom: s(8) }}
            >
              <Typography
                variant="label-01"
                weight="medium"
                style={{ color: COLORS.primary700 }}
              >
                다음 회기
              </Typography>
              <View
                style={{ backgroundColor: COLORS.paletteBg.orange }}
                className="rounded-full px-2.5 py-0.5"
              >
                <Typography
                  variant="label-02"
                  weight="semibold"
                  style={{ color: COLORS.palette.orange }}
                >
                  D-{MOCK.next_session.dDay}
                </Typography>
              </View>
            </View>
            <Typography
              variant="title-01"
              weight="semibold"
              className="text-gray-900"
            >
              {MOCK.next_session.date} {MOCK.next_session.time}
            </Typography>
            <Typography
              variant="body-03"
              className="text-gray-600"
              style={{ marginTop: s(4) }}
            >
              {MOCK.next_session.room}
            </Typography>
          </View>

          {/* 상담 정보 카드 (white) */}
          <View
            style={{
              marginHorizontal: s(20),
              backgroundColor: COLORS.white,
              borderRadius: s(16),
              padding: s(16),
            }}
          >
            {/* 프로그램명 + 상태 */}
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

            {/* 시작일 / 완료일 */}
            <View style={{ marginTop: s(12), gap: s(2) }}>
              <View className="flex-row items-center">
                <Typography
                  variant="label-01"
                  className="text-gray-500"
                  style={{ width: s(56) }}
                >
                  시작일
                </Typography>
                <Typography
                  variant="label-01"
                  weight="medium"
                  className="text-gray-800"
                >
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
                <Typography
                  variant="label-01"
                  weight="medium"
                  className="text-gray-800"
                >
                  {MOCK.completed_at}
                </Typography>
              </View>
            </View>

            {/* 회기 진행 */}
            <View style={{ marginTop: s(16) }}>
              <View
                className="flex-row items-center justify-between"
                style={{ marginBottom: s(8) }}
              >
                <Typography
                  variant="label-01"
                  weight="medium"
                  className="text-gray-500"
                >
                  회기 진행
                </Typography>
                <Typography
                  variant="label-01"
                  weight="semibold"
                  className="text-gray-900"
                >
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

        {/* ────────── White Zone (하단 영역) ────────── */}
        <View
          style={{
            backgroundColor: COLORS.white,
            paddingTop: s(24),
            paddingHorizontal: s(20),
          }}
        >
          {/* 내담자 */}
          <Typography
            variant="body-02"
            weight="bold"
            className="text-gray-900"
            style={{ marginBottom: s(8) }}
          >
            내담자
          </Typography>
          <View style={{ gap: s(8), marginBottom: s(24) }}>
            {MOCK.clients.map((c) => (
              <SunkenClientRow key={c.id} client={c} />
            ))}
          </View>

          {/* 회기 */}
          <Typography
            variant="body-02"
            weight="bold"
            className="text-gray-900"
            style={{ marginBottom: s(8) }}
          >
            회기
          </Typography>
          <View className="gap-2">
            {MOCK.sessions.map((session) => (
              <SunkenSessionCard key={session.id} session={session} />
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// ──────────────── 보조 컴포넌트 ────────────────

/** White zone 내담자 행 — gray-50 sunken bg */
function SunkenClientRow({ client }: { client: typeof MOCK.clients[number] }) {
  return (
    <View
      style={{
        backgroundColor: COLORS.gray[50],
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

/** White zone 회기 카드 — gray-50 sunken bg, 좌측 status 라인 + 인라인 CTA */
function SunkenSessionCard({ session }: { session: typeof MOCK.sessions[number] }) {
  const isCancelled = session.status === 'cancelled';
  const palette = getSessionStatusPalette(session.status);
  const statusLabel = SESSION_STATUS_LABEL[session.status];
  const statusLineColor = getStatusLineColor(session.status);

  const noteSignalLabel =
    session.noteState === 'none'
      ? '일지 미작성'
      : session.noteState === 'partial'
        ? '일지 부분 작성'
        : null;

  const ctaLabel =
    session.status === 'completed'
      ? session.noteState === 'all'
        ? '일지 보기'
        : '일지 작성하기'
      : session.status === 'cancelled'
        ? '취소 사유'
        : session.status === 'no_show'
          ? '노쇼 사유'
          : '회기 정보';

  return (
    <View
      style={{
        backgroundColor: COLORS.gray[50],
        borderRadius: s(16),
        overflow: 'hidden',
        flexDirection: 'row',
        alignItems: 'stretch',
      }}
    >
      <View style={{ width: s(3), backgroundColor: statusLineColor }} />
      <View className="flex-1 flex-row items-center px-4 py-3.5">
        <View className="flex-1">
          <Typography
            variant="body-02"
            weight="semibold"
            className={isCancelled ? 'text-gray-400' : 'text-gray-900'}
          >
            {session.dateTime}
          </Typography>
          {(session.room || noteSignalLabel) && (
            <View
              className="mt-1 flex-row items-center"
              style={{ gap: s(6) }}
            >
              {session.room && (
                <Typography
                  variant="label-01"
                  className={isCancelled ? 'text-gray-400' : 'text-gray-500'}
                >
                  {session.room}
                </Typography>
              )}
              {session.room && noteSignalLabel && (
                <Typography variant="label-01" className="text-gray-300">
                  ·
                </Typography>
              )}
              {noteSignalLabel && (
                <Typography
                  variant="label-01"
                  weight="semibold"
                  style={{ color: COLORS.palette.yellow }}
                >
                  {noteSignalLabel}
                </Typography>
              )}
            </View>
          )}
          <View
            className="mt-2 flex-row items-center"
            style={{ gap: s(4) }}
          >
            <Typography
              variant="label-01"
              weight="semibold"
              style={{ color: COLORS.primary }}
            >
              {ctaLabel}
            </Typography>
            <Icon name="arrow-right" size={12} color={COLORS.primary} />
          </View>
        </View>
        <View
          style={{ backgroundColor: palette.bg }}
          className="rounded-full px-2.5 py-1"
        >
          <Typography
            variant="label-02"
            weight="semibold"
            style={{ color: palette.color }}
          >
            {statusLabel}
          </Typography>
        </View>
      </View>
    </View>
  );
}
