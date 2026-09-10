import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  Easing,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import ReAnimated, {
  SlideInDown,
  SlideOutDown,
  FadeIn,
  FadeOut,
  Easing as REasing,
} from 'react-native-reanimated';

// Android LayoutAnimation enable (iOS는 기본 활성)
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, LAYOUT, TYPOGRAPHY } from '@/shared/constants/theme';
import { Typography } from '@/shared/components/ui/Typography';
import { Icon } from '@/shared/components/icons';
import { s } from '@/shared/utils/scale';

/**
 * 상담 상세 통합 시안 — 회기 상세 BottomSheet 3영역 + footer 위계 분리.
 *
 * 시트 본문 — 3영역으로 분리:
 *   [1] 회기 정보 — 일정 · 프로그램 · 담당자
 *   [2] 내담자 출결 — 세로 grid 카드 + 우상단 floating 출결 chip
 *   [3] 일지 — 회기 공통(목표·진행·다음 회기 계획) + 내담자별 기록
 *
 * Footer 위계 — 회기 진행 결정 우선, 일지 작성은 그 다음:
 *   scheduled  → [중단] [완료]                            (두 버튼)
 *   completed  → [중단으로 변경] (보조) + [일지 작성하기] (primary)
 *   cancelled  → [완료로 변경]                            (full)
 *
 * 작성 흐름 = wizard (회기 공통 → 내담자별, 단계 결합)
 * 확인·수정은 일지 시트 / session-edit / note-edit 풀스크린 push
 */

type Layer =
  | 'detail'
  | 'session-sheet'
  | 'wizard'
  | 'note-sheet'
  | 'note-edit'
  | 'session-edit';
type JournalState = 'all' | 'partial' | 'none';
type SessionStatus = 'scheduled' | 'completed' | 'cancelled';
type AttendanceStatus = 'unknown' | 'attended' | 'absent' | 'no_show';

interface NoteData {
  goal: string;
  content: string;
  memo: string;
}

interface SessionData {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMin: number;
  room: string;
  sessionNumber: number;
  status: SessionStatus;
  program: string;
  commonGoal: string;
  commonProcess: string;
  nextPlan: string;
  attendance: Record<string, AttendanceStatus>;
  notes: Record<string, NoteData>;
}

const CLIENTS = [
  { id: 'c1', name: '홍길동', genderLabel: '남', age: 32 },
  { id: 'c2', name: '이영희', genderLabel: '여', age: 35 },
];

const PROGRAM_NAME = '집단상담-그룹';
const ROOM_NAME = '1번 상담실';
const SESSION_END_TIME = '15:00';
const SESSION_DURATION_MIN = 60;

const ATTENDANCE_PALETTES: Record<
  AttendanceStatus,
  { label: string; color: string; bg: string }
> = {
  unknown: { label: '미확인', color: COLORS.gray[600], bg: COLORS.gray[100] },
  attended: { label: '참석', color: COLORS.palette.green, bg: COLORS.paletteBg.green },
  absent: { label: '불참', color: COLORS.palette.red, bg: COLORS.paletteBg.red },
  no_show: { label: '노쇼', color: COLORS.palette.orange, bg: COLORS.paletteBg.orange },
};

const INITIAL_SESSIONS: SessionData[] = [
  {
    id: 's5', date: '2026년 5월 15일 (수)', startTime: '14:00', endTime: SESSION_END_TIME,
    durationMin: SESSION_DURATION_MIN, room: ROOM_NAME, sessionNumber: 4, status: 'completed',
    program: PROGRAM_NAME,
    commonGoal: '', commonProcess: '', nextPlan: '',
    attendance: { c1: 'unknown', c2: 'unknown' },
    notes: { c1: { goal: '', content: '', memo: '' }, c2: { goal: '', content: '', memo: '' } },
  },
  {
    id: 's4', date: '2026년 5월 8일 (수)', startTime: '14:00', endTime: SESSION_END_TIME,
    durationMin: SESSION_DURATION_MIN, room: ROOM_NAME, sessionNumber: 3, status: 'completed',
    program: PROGRAM_NAME,
    commonGoal: '인지 재구성 기법 적용 점검',
    commonProcess: '일주일간 적용 시도 사례 공유 + 어려움 토론',
    nextPlan: '학교·직장 환경에서 적용 시도, 분노 모니터링 일지 작성',
    attendance: { c1: 'attended', c2: 'attended' },
    notes: {
      c1: { goal: '학교 환경 적용', content: '학교에서 어려움 보고. 또래 관계 스트레스.', memo: '' },
      c2: { goal: '직장 갈등 다루기', content: '인지 재구성 기법 적용 점검. 우수.', memo: '' },
    },
  },
  {
    id: 's3', date: '2026년 3월 18일 (수)', startTime: '14:00', endTime: SESSION_END_TIME,
    durationMin: SESSION_DURATION_MIN, room: ROOM_NAME, sessionNumber: 2, status: 'completed',
    program: PROGRAM_NAME,
    commonGoal: '주요 호소 문제 재명료화',
    commonProcess: '호소 문제 변화 점검 + 관계 패턴 탐색',
    nextPlan: '인지 재구성 기법 도입, 일주일 적용 사례 정리',
    attendance: { c1: 'attended', c2: 'attended' },
    notes: {
      c1: { goal: '분노 표현', content: '주요 호소 문제 재명료화. 분노 표현 인식.', memo: '' },
      c2: { goal: '대인 관계', content: '대인 관계 패턴 탐색 시작.', memo: '' },
    },
  },
  {
    id: 's2', date: '2026년 3월 11일 (수)', startTime: '14:00', endTime: SESSION_END_TIME,
    durationMin: SESSION_DURATION_MIN, room: ROOM_NAME, sessionNumber: 1, status: 'completed',
    program: PROGRAM_NAME,
    commonGoal: '라포 형성 + 사례 개념화',
    commonProcess: '내담자 상황 청취 + 목표 합의',
    nextPlan: '호소 문제 재정리, 일주일 변화 기록',
    attendance: { c1: 'attended', c2: 'attended' },
    notes: {
      c1: { goal: '라포', content: '자기 인식 양호. 목표 합의.', memo: '' },
      c2: { goal: '라포', content: '가족력 영향 자각.', memo: '' },
    },
  },
];

// ──────────────── Page ────────────────

export default function CounselingDetailIntegratedLab() {
  const router = useRouter();
  const [layer, setLayer] = useState<Layer>('detail');
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeClientId, setActiveClientId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionData[]>(INITIAL_SESSIONS);
  const [attendanceSheetTarget, setAttendanceSheetTarget] = useState<string | null>(null);
  const { message, show } = useToast();

  const activeSession = useMemo(
    () => sessions.find((s_) => s_.id === activeSessionId) ?? null,
    [sessions, activeSessionId],
  );

  const pendingNoteSessions = useMemo(
    () => sessions.filter((sess) => sess.status === 'completed' && journalStateOf(sess) !== 'all'),
    [sessions],
  );

  // note-edit 진입 origin — 'direct'면 ← 뒤로 시 session-sheet 직행
  const [noteFlowOrigin, setNoteFlowOrigin] = useState<'sheet' | 'direct'>('sheet');

  const openSessionSheet = (sessionId: string) => {
    setActiveSessionId(sessionId);
    setLayer('session-sheet');
  };
  /**
   * Wizard 진입.
   *  - footer CTA(`일지 작성하기`): clientId 없음 → STEP 1 회기 공통부터
   *  - 내담자 row의 `일지 작성`: clientId 지정 → 해당 내담자 step 으로 바로 진입
   */
  const openWizard = (sessionId: string, clientId?: string) => {
    setActiveSessionId(sessionId);
    setActiveClientId(clientId ?? null);
    setLayer('wizard');
  };
  const openNoteSheet = (sessionId: string, clientId: string) => {
    setActiveSessionId(sessionId);
    setActiveClientId(clientId);
    setNoteFlowOrigin('sheet');
    setLayer('note-sheet');
  };
  /** 일지 시트에서 수정 액션 — note-sheet 경유 */
  const openNoteEdit = () => setLayer('note-edit');
  const openSessionEdit = () => setLayer('session-edit');

  const handleBack = () => {
    if (layer === 'note-edit') {
      // direct 진입 + 미저장이면 session-sheet 직행 (note-sheet skip)
      setLayer(noteFlowOrigin === 'direct' ? 'session-sheet' : 'note-sheet');
    } else if (layer === 'note-sheet') setLayer('session-sheet');
    else if (layer === 'session-edit') setLayer('session-sheet');
    else if (layer === 'wizard') setLayer('session-sheet');
    else if (layer === 'session-sheet') setLayer('detail');
    else router.back();
  };

  const handleCloseSheet = () => setLayer('detail');

  const handleWizardComplete = (sessionId: string, data: Partial<SessionData>) => {
    const target = sessions.find((s_) => s_.id === sessionId);
    const willAutoComplete = target?.status === 'scheduled';
    if (willAutoComplete) {
      LayoutAnimation.configureNext({
        duration: 280,
        create: {
          type: LayoutAnimation.Types.easeInEaseOut,
          property: LayoutAnimation.Properties.opacity,
        },
        update: { type: LayoutAnimation.Types.easeInEaseOut },
        delete: {
          type: LayoutAnimation.Types.easeInEaseOut,
          property: LayoutAnimation.Properties.opacity,
        },
      });
    }
    setSessions((prev) =>
      prev.map((s_) =>
        s_.id === sessionId
          ? {
              ...s_,
              ...data,
              status: s_.status === 'scheduled' ? 'completed' : s_.status,
            }
          : s_,
      ),
    );
    show(
      willAutoComplete
        ? '회기를 완료 처리하고 일지를 저장했어요'
        : '일지를 모두 작성했어요',
    );
    setLayer('session-sheet');
  };

  const handleNoteSave = (sessionId: string, clientId: string, note: NoteData) => {
    const target = sessions.find((s_) => s_.id === sessionId);
    const willAutoComplete = target?.status === 'scheduled';
    if (willAutoComplete) {
      LayoutAnimation.configureNext({
        duration: 280,
        create: {
          type: LayoutAnimation.Types.easeInEaseOut,
          property: LayoutAnimation.Properties.opacity,
        },
        update: { type: LayoutAnimation.Types.easeInEaseOut },
        delete: {
          type: LayoutAnimation.Types.easeInEaseOut,
          property: LayoutAnimation.Properties.opacity,
        },
      });
    }
    setSessions((prev) =>
      prev.map((s_) =>
        s_.id === sessionId
          ? {
              ...s_,
              notes: { ...s_.notes, [clientId]: note },
              status: s_.status === 'scheduled' ? 'completed' : s_.status,
            }
          : s_,
      ),
    );
    const clientName = CLIENTS.find((c) => c.id === clientId)?.name;
    show(
      willAutoComplete
        ? `회기를 완료 처리하고 ${clientName}의 일지를 저장했어요`
        : `${clientName}의 일지를 수정했어요`,
    );
    setNoteFlowOrigin('sheet'); // 저장된 일지를 보는 상태로 정리
    setLayer('note-sheet');
  };

  const handleSessionEditSave = (
    sessionId: string,
    common: { commonGoal: string; commonProcess: string; nextPlan: string },
  ) => {
    setSessions((prev) => prev.map((s_) => (s_.id === sessionId ? { ...s_, ...common } : s_)));
    show('회기 공통을 수정했어요. 모든 일지에 반영됐어요');
    setLayer('session-sheet');
  };

  const handleAttendanceChange = (
    sessionId: string,
    clientId: string,
    next: AttendanceStatus,
  ) => {
    setSessions((prev) =>
      prev.map((s_) =>
        s_.id === sessionId
          ? { ...s_, attendance: { ...s_.attendance, [clientId]: next } }
          : s_,
      ),
    );
  };

  const handleSessionStatusChange = (sessionId: string, next: SessionStatus) => {
    LayoutAnimation.configureNext({
      duration: 280,
      create: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
      update: { type: LayoutAnimation.Types.easeInEaseOut },
      delete: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
    });
    setSessions((prev) =>
      prev.map((s_) => (s_.id === sessionId ? { ...s_, status: next } : s_)),
    );
    if (next === 'completed') show('회기를 완료 처리했어요');
    else if (next === 'cancelled') show('회기를 취소했어요');
    else if (next === 'scheduled') show('예정으로 되돌렸어요');
  };

  return (
    <View className="flex-1" style={{ backgroundColor: COLORS.bg.base }}>
      <DetailLayer
        sessions={sessions}
        pendingCount={pendingNoteSessions.length}
        firstPendingDate={pendingNoteSessions[0]?.date ?? null}
        onBack={() => router.back()}
        onOpenSessionSheet={openSessionSheet}
        onOpenWizardFromAlert={() => {
          if (pendingNoteSessions.length > 0) openWizard(pendingNoteSessions[0].id);
        }}
      />

      {layer === 'session-sheet' && activeSession && (
        <BottomSheetWrap onClose={handleCloseSheet}>
          <SessionSheetContent
            session={activeSession}
            onBack={handleBack}
            onOpenWizard={() => openWizard(activeSession.id)}
            onOpenNoteSheet={(clientId) => openNoteSheet(activeSession.id, clientId)}
            onOpenNoteEditDirect={(clientId) =>
              openWizard(activeSession.id, clientId)
            }
            onOpenSessionEdit={openSessionEdit}
            onOpenAttendanceSheet={(clientId) => setAttendanceSheetTarget(clientId)}
            onStatusChange={(next) => handleSessionStatusChange(activeSession.id, next)}
          />
        </BottomSheetWrap>
      )}

      {/* 출결 변경 sub-sheet — session-sheet 위 작은 모달 */}
      {attendanceSheetTarget && activeSession && (
        <AttendancePickerSheet
          clientName={CLIENTS.find((c) => c.id === attendanceSheetTarget)?.name ?? ''}
          current={activeSession.attendance[attendanceSheetTarget] ?? 'unknown'}
          onPick={(next) => {
            handleAttendanceChange(activeSession.id, attendanceSheetTarget, next);
            setAttendanceSheetTarget(null);
          }}
          onClose={() => setAttendanceSheetTarget(null)}
        />
      )}

      {layer === 'note-sheet' && activeSession && activeClientId && (
        <BottomSheetWrap onClose={handleBack}>
          <NoteSheetContent
            session={activeSession}
            clientId={activeClientId}
            onBack={handleBack}
            onEdit={openNoteEdit}
          />
        </BottomSheetWrap>
      )}

      {layer === 'note-edit' && activeSession && activeClientId && (
        <View style={StyleSheet.absoluteFill}>
          <NoteEditScreen
            session={activeSession}
            clientId={activeClientId}
            onBack={handleBack}
            onSave={(note) => handleNoteSave(activeSession.id, activeClientId, note)}
          />
        </View>
      )}

      {layer === 'session-edit' && activeSession && (
        <View style={StyleSheet.absoluteFill}>
          <SessionEditScreen
            session={activeSession}
            onBack={handleBack}
            onSave={(common) => handleSessionEditSave(activeSession.id, common)}
          />
        </View>
      )}

      {layer === 'wizard' && activeSession && (
        <View style={StyleSheet.absoluteFill}>
          <WizardScreen
            session={activeSession}
            initialClientId={activeClientId}
            onBack={handleBack}
            onComplete={(data) => handleWizardComplete(activeSession.id, data)}
          />
        </View>
      )}

      <Toast visible={!!message} message={message ?? ''} />
    </View>
  );
}

// ──────────────── BottomSheet wrapper ────────────────

function BottomSheetWrap({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* dim backdrop — fade in/out */}
      <ReAnimated.View
        entering={FadeIn.duration(420).easing(REasing.bezier(0.16, 1, 0.3, 1))}
        exiting={FadeOut.duration(520).easing(REasing.bezier(0.16, 1, 0.3, 1))}
        style={{
          ...StyleSheet.absoluteFillObject,
          backgroundColor: 'rgba(0,0,0,0.4)',
        }}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={onClose}
          style={{ flex: 1 }}
        />
      </ReAnimated.View>
      {/* sheet — slide up/down */}
      <ReAnimated.View
        entering={SlideInDown.duration(480).easing(REasing.bezier(0.05, 0.9, 0.1, 1))}
        exiting={SlideOutDown.duration(600).easing(REasing.bezier(0.22, 1, 0.36, 1))}
        style={{
          position: 'absolute', top: s(80), left: 0, right: 0, bottom: 0,
          backgroundColor: COLORS.white,
          borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden',
          shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 16,
          shadowOffset: { width: 0, height: -4 }, elevation: 12,
        }}
      >
        <View style={{ alignItems: 'center', paddingTop: s(10), paddingBottom: s(4) }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: COLORS.gray[300] }} />
        </View>
        {children}
      </ReAnimated.View>
    </View>
  );
}

// ──────────────── Detail (base) ────────────────

function DetailLayer({
  sessions,
  pendingCount,
  firstPendingDate,
  onBack,
  onOpenSessionSheet,
  onOpenWizardFromAlert,
}: {
  sessions: SessionData[];
  pendingCount: number;
  firstPendingDate: string | null;
  onBack: () => void;
  onOpenSessionSheet: (id: string) => void;
  onOpenWizardFromAlert: () => void;
}) {
  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: COLORS.bg.base }} edges={['top']}>
      <Header title={PROGRAM_NAME} onBack={onBack} />

      <ScrollView contentContainerStyle={{ paddingBottom: s(40) }}>
        <View style={{ paddingTop: s(12), paddingBottom: s(20) }}>
          {pendingCount > 0 && (
            <TouchableOpacity
              onPress={onOpenWizardFromAlert}
              activeOpacity={0.85}
              style={{
                marginHorizontal: s(20),
                marginBottom: s(12),
                backgroundColor: COLORS.primary50,
                borderRadius: s(20),
                paddingHorizontal: s(18),
                paddingVertical: s(16),
                flexDirection: 'row',
                alignItems: 'center',
                gap: s(14),
              }}
            >
              <View
                style={{
                  width: s(44),
                  height: s(44),
                  borderRadius: s(22),
                  backgroundColor: COLORS.white,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="counseling-note-16" size={22} color={COLORS.primary700} />
              </View>
              <View style={{ flex: 1, gap: s(2) }}>
                <Typography variant="body-02" weight="bold" className="text-gray-900">
                  작성해야 할 일지가 {pendingCount}건 있어요!
                </Typography>
                {firstPendingDate && (
                  <Typography variant="body-03" className="text-gray-600">
                    {firstPendingDate}
                    {pendingCount > 1 ? ` 외 ${pendingCount - 1}건` : ''}
                  </Typography>
                )}
              </View>
              <Icon name="arrow-right" size={18} color={COLORS.primary700} />
            </TouchableOpacity>
          )}

          <View
            style={{
              marginHorizontal: s(20),
              backgroundColor: COLORS.white,
              borderRadius: s(20),
              padding: s(20),
              gap: s(16),
            }}
          >
            {/* 라벨 + 우측 status chip */}
            <View className="flex-row items-center">
              <Typography
                variant="label-01"
                weight="semibold"
                style={{ color: COLORS.primary700 }}
              >
                진행중인 상담
              </Typography>
              <View style={{ marginLeft: 'auto' }}>
                <View
                  style={{ backgroundColor: COLORS.paletteBg.orange }}
                  className="rounded-full px-2.5 py-1"
                >
                  <Typography variant="label-02" weight="semibold" style={{ color: COLORS.palette.orange }}>
                    진행중
                  </Typography>
                </View>
              </View>
            </View>

            {/* program name — 큰 헤드라인 */}
            <Typography variant="headline-01" weight="semibold" className="text-gray-900">
              {PROGRAM_NAME}
            </Typography>

            {/* 진행도 — 큰 숫자 강조 */}
            <View style={{ gap: s(12) }}>
              <View className="flex-row items-baseline" style={{ gap: s(6) }}>
                <Typography
                  variant="headline-01"
                  weight="bold"
                  style={{ color: COLORS.primary }}
                >
                  {sessions.filter((s_) => s_.status === 'completed').length}
                </Typography>
                <Typography variant="title-01" weight="medium" className="text-gray-400">
                  / 10 회 진행
                </Typography>
              </View>
              <View
                style={{
                  height: s(8),
                  borderRadius: s(4),
                  backgroundColor: COLORS.gray[100],
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    width: '50%',
                    height: '100%',
                    backgroundColor: COLORS.primary,
                    borderRadius: s(4),
                  }}
                />
              </View>
            </View>
          </View>
        </View>

        <View style={{ backgroundColor: COLORS.white, paddingTop: s(24), paddingHorizontal: s(20) }}>
          <View className="flex-row items-baseline" style={{ gap: s(6), marginBottom: s(12) }}>
            <Typography variant="title-01" weight="semibold" className="text-gray-900">내담자</Typography>
            <Typography variant="label-01" className="text-gray-500">{CLIENTS.length}명</Typography>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(10), marginBottom: s(32) }}>
            {CLIENTS.map((c) => (
              <View
                key={c.id}
                style={{
                  width: '31%',
                  backgroundColor: COLORS.gray[50],
                  borderRadius: s(16),
                  paddingVertical: s(16),
                  paddingHorizontal: s(10),
                  alignItems: 'center',
                  gap: s(10),
                }}
              >
                <View
                  style={{
                    width: s(52),
                    height: s(52),
                    borderRadius: s(26),
                    backgroundColor: COLORS.primary50,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Typography
                    variant="title-01"
                    weight="semibold"
                    style={{ color: COLORS.primary700 }}
                  >
                    {c.name[0]}
                  </Typography>
                </View>
                <View style={{ alignItems: 'center', gap: s(2) }}>
                  <Typography variant="body-02" weight="semibold" className="text-gray-900">
                    {c.name}
                  </Typography>
                  <Typography variant="label-02" className="text-gray-500">
                    {c.genderLabel} · 만 {c.age}세
                  </Typography>
                </View>
              </View>
            ))}
          </View>

          <View style={{ marginBottom: s(12) }}>
            <Typography variant="title-01" weight="semibold" className="text-gray-900">회기</Typography>
          </View>
          <View style={{ gap: s(10) }}>
            {sessions.map((sess) => (
              <SessionRow key={sess.id} session={sess} onPress={() => onOpenSessionSheet(sess.id)} />
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SessionRow({ session, onPress }: { session: SessionData; onPress: () => void }) {
  const hasCommon = !!session.commonGoal;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        backgroundColor: COLORS.gray[50],
        borderRadius: s(16),
        paddingVertical: s(16),
        paddingHorizontal: s(16),
        gap: s(6),
      }}
    >
      <View className="flex-row items-center" style={{ gap: s(10) }}>
        <Typography
          variant="body-02"
          weight="semibold"
          className="text-gray-900 flex-1"
        >
          {session.date}
        </Typography>
        <SessionStatusBadge status={session.status} />
        <Icon name="arrow-right" size={14} color={COLORS.gray[400]} />
      </View>
      <Typography
        variant="body-03"
        numberOfLines={1}
        style={{
          color: hasCommon ? COLORS.gray[600] : COLORS.gray[400],
        }}
      >
        {hasCommon
          ? session.commonGoal
          : session.status === 'scheduled'
            ? '진행 예정'
            : session.status === 'cancelled'
              ? '취소된 회기예요'
              : '이번 회기 기록 미작성'}
      </Typography>
    </TouchableOpacity>
  );
}

// ──────────────── Session Sheet (BottomSheet) — 3영역 + footer ────────────────

function SessionSheetContent({
  session,
  onBack,
  onOpenWizard,
  onOpenNoteSheet,
  onOpenNoteEditDirect,
  onOpenSessionEdit,
  onOpenAttendanceSheet,
  onStatusChange,
}: {
  session: SessionData;
  onBack: () => void;
  onOpenWizard: () => void;
  onOpenNoteSheet: (clientId: string) => void;
  onOpenNoteEditDirect: (clientId: string) => void;
  onOpenSessionEdit: () => void;
  onOpenAttendanceSheet: (clientId: string) => void;
  onStatusChange: (next: SessionStatus) => void;
}) {
  const hasCommon = !!session.commonGoal && !!session.commonProcess;
  const allWritten = CLIENTS.every((c) => !!session.notes[c.id]?.content);
  const status = session.status;

  return (
    <View style={{ flex: 1 }}>
      {/* 시트 헤더 */}
      <View
        style={{
          flexDirection: 'row', alignItems: 'center',
          paddingHorizontal: s(LAYOUT.screenPaddingX), height: s(44),
        }}
      >
        <TouchableOpacity onPress={onBack} hitSlop={8}>
          <Ionicons name="close" size={24} color={COLORS.gray[900]} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Typography variant="title-01" weight="semibold" className="text-gray-900">
            {session.date} {session.startTime}
          </Typography>
        </View>
        <SessionStatusBadge status={status} />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: s(20), paddingTop: s(8),
          paddingBottom: status === 'cancelled' ? s(40) : s(100),
          gap: s(24),
        }}
      >
        {/* [1] 회기 정보 — 일정 상세와 동일 row 구성 (프로그램 N회기 / 날짜 / 시간 / 장소) */}
        <SectionBlock title="회기 정보">
          <View style={{ backgroundColor: COLORS.gray[50], borderRadius: s(12), padding: s(14), gap: s(8) }}>
            <InfoRow label="프로그램" value={`${session.program} ${session.sessionNumber}회기`} />
            <InfoRow label="날짜" value={session.date} />
            <InfoRow
              label="시간"
              value={`${session.startTime} ~ ${session.endTime} (${session.durationMin}분)`}
            />
            <InfoRow label="장소" value={session.room} />
          </View>
        </SectionBlock>

        {/* [2] 회기 진행 — 예정만 SectionBlock + Big card. 결과 상태(완료/취소)는 작은 row */}
        {status === 'scheduled' ? (
          <SectionBlock title="이 회기를 어떻게 처리할까요?">
            <SessionStatusActions status={status} onChange={onStatusChange} />
          </SectionBlock>
        ) : (
          <SessionStatusResultRow
            status={status}
            onChange={onStatusChange}
          />
        )}

        {/* [3] 일지 — 예정/완료 모두 활성. 일지 작성 시 자동 완료 처리. 취소만 dim */}
        <View
          style={{ opacity: status === 'cancelled' ? 0.4 : 1 }}
          pointerEvents={status === 'cancelled' ? 'none' : 'auto'}
        >
          <SectionBlock title="일지">
            {/* 단일 컨테이너 — 회기 공통 + 내담자를 하나의 그룹으로 */}
            <View
              style={{
                backgroundColor: COLORS.gray[50],
                borderRadius: s(16),
                padding: s(14),
                gap: s(14),
              }}
            >
              {/* sub: 이번 회기 기록 */}
              <SubBlock
                label="이번 회기 기록"
                rightAction={{
                  label: hasCommon ? '수정' : '작성',
                  onPress: onOpenSessionEdit,
                }}
              >
                {hasCommon ? (
                  <View
                    style={{
                      backgroundColor: COLORS.white, borderRadius: s(10),
                      paddingHorizontal: s(12), paddingVertical: s(12), gap: s(10),
                    }}
                  >
                    <Text style={localStyles.contentText}>{session.commonGoal}</Text>
                    <Text style={localStyles.contentText}>{session.commonProcess}</Text>
                    {session.nextPlan ? (
                      <Text style={localStyles.contentText}>{session.nextPlan}</Text>
                    ) : null}
                  </View>
                ) : (
                  <View
                    style={{
                      backgroundColor: COLORS.white, borderRadius: s(10),
                      padding: s(12),
                    }}
                  >
                    <Typography variant="label-01" className="text-gray-500">
                      이번 회기 기록이 아직 작성되지 않았어요
                    </Typography>
                  </View>
                )}
              </SubBlock>

              {/* divider — 컨테이너 안에서 두 영역 분리 */}
              <View
                style={{
                  height: 1,
                  backgroundColor: COLORS.gray[200],
                  marginHorizontal: -s(14),
                }}
              />

              {/* sub: 내담자 */}
              <SubBlock label="내담자">
                <View style={{ gap: s(8) }}>
                  {CLIENTS.map((c) => {
                    const att = session.attendance[c.id] ?? 'unknown';
                    const attPalette = ATTENDANCE_PALETTES[att];
                    const filled = !!session.notes[c.id]?.content;
                    return (
                      <TouchableOpacity
                        key={c.id}
                        onPress={() =>
                          filled ? onOpenNoteSheet(c.id) : onOpenNoteEditDirect(c.id)
                        }
                        activeOpacity={0.7}
                        style={{
                          backgroundColor: COLORS.white, borderRadius: s(10),
                          paddingVertical: s(12), paddingHorizontal: s(12),
                          gap: s(10),
                        }}
                      >
                        {/* 윗줄 — 이름·성별·나이 가로 나열 + 우측 출결 chip */}
                        <View className="flex-row items-center" style={{ gap: s(8) }}>
                          <View
                            className="flex-row items-baseline"
                            style={{ gap: s(6), flex: 1 }}
                          >
                            <Typography
                              variant="body-02"
                              weight="semibold"
                              className="text-gray-900"
                              numberOfLines={1}
                            >
                              {c.name}
                            </Typography>
                            <Typography
                              variant="label-01"
                              className="text-gray-500"
                              numberOfLines={1}
                            >
                              {c.genderLabel} · 만 {c.age}세
                            </Typography>
                          </View>
                          <Pressable
                            onPress={() => onOpenAttendanceSheet(c.id)}
                            hitSlop={6}
                            style={{
                              backgroundColor: attPalette.bg,
                              paddingHorizontal: s(10),
                              paddingVertical: s(4),
                              borderRadius: s(14),
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: s(4),
                            }}
                          >
                            <Typography
                              variant="label-02"
                              weight="semibold"
                              style={{ color: attPalette.color }}
                            >
                              {attPalette.label}
                            </Typography>
                            <Ionicons name="chevron-down" size={10} color={attPalette.color} />
                          </Pressable>
                        </View>
                        {/* 아랫줄 — 좌측 일지 작성/보기 액션 */}
                        <View className="flex-row items-center" style={{ gap: s(4) }}>
                          <Typography
                            variant="label-01"
                            weight="semibold"
                            style={{ color: COLORS.primary700 }}
                          >
                            {filled ? '일지 보기' : '일지 작성'}
                          </Typography>
                          <Icon name="arrow-right" size={12} color={COLORS.primary700} />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </SubBlock>
            </View>
          </SectionBlock>
        </View>
      </ScrollView>

      {/* Footer — 예정/완료 모두 일지 작성 가능. 취소만 숨김 */}
      {status !== 'cancelled' && (
        <View
          style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            backgroundColor: COLORS.white,
            borderTopWidth: 1, borderTopColor: COLORS.gray[100],
            paddingHorizontal: s(20), paddingTop: s(12), paddingBottom: s(20),
          }}
        >
          <FooterButton
            label="일지 작성하기"
            tone="primary"
            onPress={onOpenWizard}
          />
        </View>
      )}
    </View>
  );
}

// ──────────────── Footer — 회기 상태별 ────────────────

function SessionFooter({
  status,
  allWritten,
  onStatusChange,
  onOpenWizard,
}: {
  status: SessionStatus;
  allWritten: boolean;
  onStatusChange: (next: SessionStatus) => void;
  onOpenWizard: () => void;
}) {
  return (
    <View
      style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: COLORS.white,
        borderTopWidth: 1, borderTopColor: COLORS.gray[100],
        paddingHorizontal: s(20), paddingTop: s(12), paddingBottom: s(20),
        gap: s(8),
      }}
    >
      {status === 'scheduled' && (
        <View className="flex-row" style={{ gap: s(8) }}>
          <FooterButton
            label="회기 취소"
            tone="danger-outline"
            onPress={() => onStatusChange('cancelled')}
          />
          <FooterButton
            label="회기 완료"
            tone="primary"
            flex
            onPress={() => onStatusChange('completed')}
          />
        </View>
      )}

      {status === 'completed' && (
        <FooterButton
          label="예정으로 되돌리기"
          tone="primary"
          onPress={() => onStatusChange('scheduled')}
        />
      )}

      {status === 'cancelled' && (
        <FooterButton
          label="예정으로 되돌리기"
          tone="primary"
          onPress={() => onStatusChange('scheduled')}
        />
      )}
    </View>
  );
}

function FooterButton({
  label,
  tone,
  flex,
  onPress,
  disabled,
}: {
  label: string;
  tone: 'primary' | 'primary-outline' | 'success' | 'danger-outline' | 'ghost';
  flex?: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  const palette =
    tone === 'primary'
      ? { bg: COLORS.primary, fg: COLORS.white, border: 'transparent' }
      : tone === 'primary-outline'
        ? { bg: COLORS.white, fg: COLORS.primary, border: COLORS.primary }
        : tone === 'success'
          ? { bg: COLORS.palette.green, fg: COLORS.white, border: 'transparent' }
          : tone === 'ghost'
            ? { bg: COLORS.white, fg: COLORS.gray[700], border: COLORS.gray[200] }
            : { bg: COLORS.white, fg: COLORS.palette.red, border: COLORS.palette.red };
  const hasBorder =
    tone === 'danger-outline' || tone === 'ghost' || tone === 'primary-outline';
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      style={{
        flex: flex ? 1 : undefined,
        height: s(48), borderRadius: s(12),
        backgroundColor: palette.bg,
        borderWidth: hasBorder ? 1 : 0,
        borderColor: palette.border,
        alignItems: 'center', justifyContent: 'center',
        paddingHorizontal: hasBorder ? s(20) : undefined,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Typography variant="body-02" weight="semibold" style={{ color: palette.fg }}>
        {label}
      </Typography>
    </TouchableOpacity>
  );
}

// ──────────────── 내담자 출결 카드 (세로) ────────────────

function AttendanceClientCard({
  client,
  status,
  onChipPress,
}: {
  client: (typeof CLIENTS)[number];
  status: AttendanceStatus;
  onChipPress: () => void;
}) {
  const palette = ATTENDANCE_PALETTES[status];

  return (
    <View style={{ width: '31%', position: 'relative' }}>
      <View
        style={{
          backgroundColor: COLORS.gray[50], borderRadius: s(12),
          paddingVertical: s(14), paddingHorizontal: s(8),
          alignItems: 'center', gap: s(6),
        }}
      >
        <ProfileAvatar name={client.name} />
        <Typography
          variant="body-02"
          weight="semibold"
          className="text-gray-900"
          numberOfLines={1}
        >
          {client.name}
        </Typography>
        <Typography variant="label-02" className="text-gray-500" numberOfLines={1}>
          {client.genderLabel} · 만 {client.age}세
        </Typography>
      </View>
      {/* 우상단 floating 출결 chip */}
      <Pressable
        onPress={onChipPress}
        hitSlop={6}
        style={{
          position: 'absolute',
          top: -s(4),
          right: -s(4),
          backgroundColor: palette.bg,
          paddingHorizontal: s(8),
          paddingVertical: s(3),
          borderRadius: s(10),
          borderWidth: 2,
          borderColor: COLORS.white,
          flexDirection: 'row',
          alignItems: 'center',
          gap: s(2),
        }}
      >
        <Typography variant="label-02" weight="semibold" style={{ color: palette.color }}>
          {palette.label}
        </Typography>
        <Ionicons name="chevron-down" size={10} color={palette.color} />
      </Pressable>
    </View>
  );
}

function ProfileAvatar({ name }: { name: string }) {
  return (
    <View
      style={{
        width: s(44), height: s(44), borderRadius: s(22),
        backgroundColor: COLORS.primary50,
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      <Typography variant="body-02" weight="semibold" style={{ color: COLORS.primary700 }}>
        {name[0]}
      </Typography>
    </View>
  );
}

// ──────────────── 출결 변경 sub-sheet ────────────────

function AttendancePickerSheet({
  clientName,
  current,
  onPick,
  onClose,
}: {
  clientName: string;
  current: AttendanceStatus;
  onPick: (next: AttendanceStatus) => void;
  onClose: () => void;
}) {
  const options: AttendanceStatus[] = ['unknown', 'attended', 'absent', 'no_show'];

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <TouchableOpacity
        activeOpacity={1}
        onPress={onClose}
        style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' }}
      />
      <View
        style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          backgroundColor: COLORS.white,
          borderTopLeftRadius: 20, borderTopRightRadius: 20,
          paddingBottom: s(24),
        }}
      >
        <View style={{ alignItems: 'center', paddingTop: s(10), paddingBottom: s(8) }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: COLORS.gray[300] }} />
        </View>
        <Typography
          variant="title-01"
          weight="semibold"
          className="text-gray-900"
          style={{ textAlign: 'center', marginBottom: s(16) }}
        >
          {clientName}의 출결
        </Typography>
        {options.map((opt) => {
          const palette = ATTENDANCE_PALETTES[opt];
          const selected = current === opt;
          return (
            <TouchableOpacity
              key={opt}
              onPress={() => onPick(opt)}
              activeOpacity={0.7}
              style={{
                paddingHorizontal: s(20), paddingVertical: s(14),
                flexDirection: 'row', alignItems: 'center', gap: s(12),
                backgroundColor: selected ? COLORS.primary50 : 'transparent',
              }}
            >
              <View style={{ width: s(8), height: s(8), borderRadius: s(4), backgroundColor: palette.color }} />
              <Typography
                variant="body-02"
                weight={selected ? 'semibold' : 'medium'}
                className="text-gray-800 flex-1"
              >
                {palette.label}
              </Typography>
              {selected && <Icon name="check-primary-20" size={16} color={COLORS.primary} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ──────────────── Note Sheet (단건 조회) ────────────────

function NoteSheetContent({
  session,
  clientId,
  onBack,
  onEdit,
}: {
  session: SessionData;
  clientId: string;
  onBack: () => void;
  onEdit: () => void;
}) {
  const client = CLIENTS.find((c) => c.id === clientId)!;
  const note = session.notes[clientId];
  const hasNote = !!note?.content;

  return (
    <View style={{ flex: 1 }}>
      <View
        style={{
          flexDirection: 'row', alignItems: 'center',
          paddingHorizontal: s(LAYOUT.screenPaddingX), height: s(44),
        }}
      >
        <TouchableOpacity onPress={onBack} hitSlop={8}>
          <Icon name="arrow-left" size={24} color={COLORS.gray[900]} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Typography variant="title-01" weight="semibold" className="text-gray-900">
            {client.name}의 상담일지
          </Typography>
        </View>
        {hasNote ? (
          <TouchableOpacity onPress={onEdit} hitSlop={6}>
            <Typography variant="body-03" weight="semibold" style={{ color: COLORS.primary700 }}>
              수정
            </Typography>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 24 }} />
        )}
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: s(20), paddingTop: s(8), paddingBottom: s(40), gap: s(16),
        }}
      >
        <Typography variant="label-01" className="text-gray-500">
          {session.date} {session.startTime}
        </Typography>

        <SessionCommonPreview
          goal={session.commonGoal}
          process={session.commonProcess}
          nextPlan={session.nextPlan}
        />

        {hasNote ? (
          <>
            {note.goal ? (
              <View style={localStyles.goalCard}>
                <View style={localStyles.goalAccent} />
                <View style={localStyles.goalContent}>
                  <Text style={localStyles.goalLabel}>상담 목표</Text>
                  <Text style={localStyles.goalText}>{note.goal}</Text>
                </View>
              </View>
            ) : null}

            <View>
              <SectionLabel title="상담 내용" />
              <Text style={localStyles.contentText}>{note.content}</Text>
            </View>

            {note.memo ? (
              <View style={localStyles.memoCard}>
                <View style={localStyles.memoHeader}>
                  <Ionicons name="lock-closed" size={12} color={COLORS.warning} />
                  <Text style={localStyles.memoLabel}>개인 메모</Text>
                </View>
                <Text style={localStyles.memoText}>{note.memo}</Text>
              </View>
            ) : null}
          </>
        ) : (
          <View style={{ paddingVertical: s(24), alignItems: 'center', gap: s(12) }}>
            <Typography variant="body-02" className="text-gray-500">
              아직 작성된 일지가 없어요
            </Typography>
            <TouchableOpacity
              onPress={onEdit} activeOpacity={0.85}
              style={{
                paddingHorizontal: s(20), paddingVertical: s(10),
                borderRadius: s(10), backgroundColor: COLORS.primary,
              }}
            >
              <Typography variant="body-03" weight="semibold" style={{ color: COLORS.white }}>
                일지 작성하기
              </Typography>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ──────────────── Note Edit (풀스크린) ────────────────

function NoteEditScreen({
  session,
  clientId,
  onBack,
  onSave,
}: {
  session: SessionData;
  clientId: string;
  onBack: () => void;
  onSave: (note: NoteData) => void;
}) {
  const client = CLIENTS.find((c) => c.id === clientId)!;
  const initial = session.notes[clientId] ?? { goal: '', content: '', memo: '' };
  const [goal, setGoal] = useState(initial.goal);
  const [content, setContent] = useState(initial.content);
  const [memo, setMemo] = useState(initial.memo);

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: COLORS.bg.base }} edges={['top']}>
      <Header title={`${client.name}의 상담일지 수정`} onBack={onBack} />

      <ScrollView contentContainerStyle={{ paddingHorizontal: s(20), paddingTop: s(16), paddingBottom: s(120) }}>
        <SessionCommonPreview
          goal={session.commonGoal}
          process={session.commonProcess}
          nextPlan={session.nextPlan}
        />
        <View style={{ gap: s(20), marginTop: s(20) }}>
          <View>
            <SectionLabel title="상담 목표" />
            <TextInput
              style={[localStyles.input, localStyles.inputSmall]}
              value={goal} onChangeText={setGoal}
              placeholder="이번 회기의 목표를 입력해 주세요"
              placeholderTextColor={COLORS.gray[400]} multiline textAlignVertical="top"
            />
          </View>
          <View>
            <SectionLabel title="상담 내용" />
            <TextInput
              style={[localStyles.input, localStyles.inputLarge]}
              value={content} onChangeText={setContent}
              placeholder="상담 내용을 기록해 주세요"
              placeholderTextColor={COLORS.gray[400]} multiline textAlignVertical="top"
            />
          </View>
          <View>
            <SectionLabel title="개인 메모" isPrivate />
            <TextInput
              style={[localStyles.input, localStyles.inputSmall, localStyles.inputPrivate]}
              value={memo} onChangeText={setMemo}
              placeholder="나만 볼 수 있는 메모예요"
              placeholderTextColor={COLORS.gray[400]} multiline textAlignVertical="top"
            />
          </View>
        </View>
      </ScrollView>

      <FooterSaveBar onPress={() => onSave({ goal, content, memo })} />
    </SafeAreaView>
  );
}

// ──────────────── Session Edit (회기 공통 수정) ────────────────

function SessionEditScreen({
  session,
  onBack,
  onSave,
}: {
  session: SessionData;
  onBack: () => void;
  onSave: (common: { commonGoal: string; commonProcess: string; nextPlan: string }) => void;
}) {
  const [goal, setGoal] = useState(session.commonGoal);
  const [process, setProcess] = useState(session.commonProcess);
  const [next, setNext] = useState(session.nextPlan);

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: COLORS.bg.base }} edges={['top']}>
      <Header title="회기 공통 수정" onBack={onBack} />

      <ScrollView contentContainerStyle={{ paddingHorizontal: s(20), paddingTop: s(16), paddingBottom: s(120) }}>
        <View
          style={{
            backgroundColor: COLORS.paletteBg.blue, borderRadius: s(10),
            padding: s(12), flexDirection: 'row', alignItems: 'center', gap: s(8),
            marginBottom: s(16),
          }}
        >
          <View style={{ width: s(8), height: s(8), borderRadius: s(4), backgroundColor: COLORS.palette.blue }} />
          <Typography variant="label-01" className="text-gray-700 flex-1">
            저장 시 같은 회기의 모든 일지에 자동 반영돼요
          </Typography>
        </View>

        <View style={{ gap: s(20) }}>
          <View>
            <SectionLabel title="회기 목표" />
            <TextInput
              style={[localStyles.input, localStyles.inputSmall]}
              value={goal} onChangeText={setGoal}
              placeholder="이번 회기에서 다룰 핵심 주제·목표"
              placeholderTextColor={COLORS.gray[400]} multiline textAlignVertical="top"
            />
          </View>
          <View>
            <SectionLabel title="진행 내용" />
            <TextInput
              style={[localStyles.input, localStyles.inputLarge]}
              value={process} onChangeText={setProcess}
              placeholder="회기에서 진행한 활동·방식"
              placeholderTextColor={COLORS.gray[400]} multiline textAlignVertical="top"
            />
          </View>
          <View>
            <SectionLabel title="다음 회기 계획" />
            <TextInput
              style={[localStyles.input, localStyles.inputSmall]}
              value={next} onChangeText={setNext}
              placeholder="다음 회기에서 다룰 과제·계획"
              placeholderTextColor={COLORS.gray[400]} multiline textAlignVertical="top"
            />
          </View>
        </View>
      </ScrollView>

      <FooterSaveBar onPress={() => onSave({ commonGoal: goal, commonProcess: process, nextPlan: next })} />
    </SafeAreaView>
  );
}

// ──────────────── Wizard (풀스크린) ────────────────

function WizardScreen({
  session,
  initialClientId,
  onBack,
  onComplete,
}: {
  session: SessionData;
  /** 내담자 row 의 `일지 작성` 으로 진입했을 때 지정 — 해당 step 으로 바로 점프 */
  initialClientId: string | null;
  onBack: () => void;
  onComplete: (data: Partial<SessionData>) => void;
}) {
  const stepKeys = ['session', ...CLIENTS.map((c) => c.id)] as const;
  const stepLabels = ['회기 공통', ...CLIENTS.map((c) => c.name)];

  // 내담자 row 진입 시 그 step 으로, 그 외엔 회기 공통(0) 부터
  const initialStep = initialClientId
    ? Math.max(0, stepKeys.indexOf(initialClientId as (typeof stepKeys)[number]))
    : 0;
  const [step, setStep] = useState(initialStep);
  const [commonGoal, setCommonGoal] = useState(session.commonGoal);
  const [commonProcess, setCommonProcess] = useState(session.commonProcess);
  const [nextPlan, setNextPlan] = useState(session.nextPlan);
  const [notes, setNotes] = useState<Record<string, NoteData>>(() => {
    const init: Record<string, NoteData> = {};
    CLIENTS.forEach((c) => {
      init[c.id] = session.notes[c.id] ?? { goal: '', content: '', memo: '' };
    });
    return init;
  });

  const updateNote = (clientId: string, patch: Partial<NoteData>) => {
    setNotes((prev) => ({ ...prev, [clientId]: { ...prev[clientId], ...patch } }));
  };

  const handleNext = () => {
    if (step < stepKeys.length - 1) {
      setStep(step + 1);
    } else {
      onComplete({ commonGoal, commonProcess, nextPlan, notes });
    }
  };

  const currentKey = stepKeys[step];

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: COLORS.white }} edges={['top']}>
      <Header title="일지 작성" onBack={onBack} />

      <View style={{ paddingHorizontal: s(20), paddingTop: s(8), paddingBottom: s(16) }}>
        <View className="flex-row items-center" style={{ gap: s(4) }}>
          {stepKeys.map((_k, idx) => {
            const active = idx === step;
            const done = idx < step;
            const color = done ? COLORS.palette.green : active ? COLORS.primary : COLORS.gray[200];
            return (
              <View key={idx} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: s(4) }}>
                <View
                  style={{
                    width: s(22), height: s(22), borderRadius: s(11),
                    backgroundColor: color,
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {done ? (
                    <Icon name="check-primary-20" size={12} color={COLORS.white} />
                  ) : (
                    <Typography
                      variant="label-02" weight="bold"
                      style={{ color: active ? COLORS.white : COLORS.gray[500] }}
                    >
                      {idx + 1}
                    </Typography>
                  )}
                </View>
                {idx < stepKeys.length - 1 && (
                  <View
                    style={{
                      flex: 1, height: 2,
                      backgroundColor: done ? COLORS.palette.green : COLORS.gray[200],
                    }}
                  />
                )}
              </View>
            );
          })}
        </View>
        <View className="flex-row" style={{ gap: s(4), marginTop: s(8) }}>
          {stepLabels.map((label, idx) => (
            <View key={idx} style={{ flex: 1 }}>
              <Typography
                variant="label-02"
                weight={idx === step ? 'semibold' : 'medium'}
                style={{ color: idx === step ? COLORS.gray[900] : COLORS.gray[400] }}
                numberOfLines={1}
              >
                {label}
              </Typography>
            </View>
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: s(20), paddingBottom: s(120) }}>
        {currentKey === 'session' ? (
          <View style={{ gap: s(20) }}>
            <StageHeader chip="STEP 1" title="회기 공통" desc="회기 전체에 적용. 모든 참여 내담자 일지에 반영." />
            <FormField label="회기 목표" placeholder="이번 회기 목표" value={commonGoal} onChangeText={setCommonGoal} />
            <FormField
              label="진행 내용" placeholder="이번 회기에 진행한 활동"
              value={commonProcess} onChangeText={setCommonProcess} minHeight={120}
            />
            <FormField
              label="다음 회기 계획" placeholder="다음 회기에서 다룰 과제·계획"
              value={nextPlan} onChangeText={setNextPlan}
            />
          </View>
        ) : (
          <View style={{ gap: s(20) }}>
            <StageHeader
              chip={CLIENTS.find((c) => c.id === currentKey)?.name ?? ''}
              title={`${CLIENTS.find((c) => c.id === currentKey)?.name}의 일지`}
              desc="회기 공통은 자동 적용. 본인 단위 기록만 입력."
            />
            <SessionCommonPreview goal={commonGoal} process={commonProcess} nextPlan={nextPlan} />
            <FormField
              label="상담 목표"
              placeholder="이번 회기 이 내담자에게 적용된 목표"
              value={notes[currentKey].goal}
              onChangeText={(v) => updateNote(currentKey, { goal: v })}
            />
            <FormField
              label="상담 내용"
              placeholder="내담자의 반응·관찰·변화"
              value={notes[currentKey].content}
              onChangeText={(v) => updateNote(currentKey, { content: v })}
              minHeight={120}
            />
            <FormField
              label="개인 메모"
              placeholder="나만 볼 수 있는 메모예요"
              value={notes[currentKey].memo}
              onChangeText={(v) => updateNote(currentKey, { memo: v })}
              minHeight={70} secondary
            />
          </View>
        )}
      </ScrollView>

      <View
        style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          backgroundColor: COLORS.white,
          borderTopWidth: 1, borderTopColor: COLORS.gray[100],
          paddingHorizontal: s(20), paddingTop: s(12), paddingBottom: s(20),
          flexDirection: 'row', gap: s(8),
        }}
      >
        {step > 0 ? (
          <TouchableOpacity
            onPress={() => setStep(step - 1)} activeOpacity={0.7}
            style={{
              paddingHorizontal: s(16), height: s(48), borderRadius: s(12),
              backgroundColor: COLORS.gray[100], justifyContent: 'center',
            }}
          >
            <Typography variant="body-02" weight="semibold" className="text-gray-700">이전</Typography>
          </TouchableOpacity>
        ) : (
          <View style={{ width: s(60) }} />
        )}
        <TouchableOpacity
          onPress={handleNext} activeOpacity={0.85}
          style={{
            flex: 1, height: s(48), borderRadius: s(12), backgroundColor: COLORS.primary,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Typography variant="body-02" weight="semibold" style={{ color: COLORS.white }}>
            {step === stepKeys.length - 1 ? '저장 후 완료' : '저장하고 다음'}
          </Typography>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ──────────────── 공통 보조 ────────────────

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View
      style={{
        height: s(52),
        paddingHorizontal: s(LAYOUT.screenPaddingX),
        flexDirection: 'row', alignItems: 'center', gap: s(8),
      }}
    >
      <TouchableOpacity onPress={onBack} hitSlop={8}>
        <Icon name="arrow-left" size={24} color={COLORS.gray[900]} />
      </TouchableOpacity>
      <Typography
        variant="title-01" weight="semibold"
        className="flex-1 text-gray-900" numberOfLines={1}
      >
        {title}
      </Typography>
    </View>
  );
}

function SectionLabel({ title, isPrivate }: { title: string; isPrivate?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: s(6), gap: s(4) }}>
      {isPrivate && <Ionicons name="lock-closed" size={12} color={COLORS.warning} />}
      <Text style={localStyles.sectionLabelText}>{title}</Text>
    </View>
  );
}

function StageHeader({ chip, title, desc }: { chip: string; title: string; desc: string }) {
  return (
    <View style={{ gap: s(8) }}>
      <View
        style={{
          alignSelf: 'flex-start', backgroundColor: COLORS.primary50,
          paddingHorizontal: s(8), paddingVertical: s(3), borderRadius: s(4),
        }}
      >
        <Typography variant="label-02" weight="bold" style={{ color: COLORS.primary700 }}>
          {chip}
        </Typography>
      </View>
      <Typography variant="headline-02" weight="semibold" className="text-gray-900">
        {title}
      </Typography>
      <Typography variant="body-03" className="text-gray-600">
        {desc}
      </Typography>
    </View>
  );
}

function SessionCommonPreview({
  goal,
  process,
  nextPlan,
}: {
  goal: string;
  process: string;
  nextPlan: string;
}) {
  const filled = !!goal && !!process;
  return (
    <View
      style={{
        backgroundColor: COLORS.gray[100], borderRadius: s(12),
        padding: s(14), gap: s(8),
      }}
    >
      <View className="flex-row items-center" style={{ gap: s(6) }}>
        <Ionicons name="bookmark" size={12} color={COLORS.gray[500]} />
        <Typography variant="label-02" weight="semibold" className="text-gray-600">
          회기 공통 (read-only)
        </Typography>
      </View>
      {filled ? (
        <View style={{ gap: s(6) }}>
          <View style={{ gap: s(2) }}>
            <Typography variant="label-02" className="text-gray-500">회기 목표</Typography>
            <Typography variant="body-03" className="text-gray-700">{goal}</Typography>
          </View>
          <View style={{ gap: s(2) }}>
            <Typography variant="label-02" className="text-gray-500">진행 내용</Typography>
            <Typography variant="body-03" className="text-gray-700">{process}</Typography>
          </View>
          {nextPlan ? (
            <View style={{ gap: s(2) }}>
              <Typography variant="label-02" className="text-gray-500">다음 회기 계획</Typography>
              <Typography variant="body-03" className="text-gray-700">{nextPlan}</Typography>
            </View>
          ) : null}
        </View>
      ) : (
        <Typography variant="body-03" className="text-gray-500">
          회기 공통이 아직 작성되지 않았어요
        </Typography>
      )}
    </View>
  );
}

function FormField({
  label, placeholder, value, onChangeText, minHeight = 80, secondary,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
  minHeight?: number;
  secondary?: boolean;
}) {
  return (
    <View style={{ gap: s(6) }}>
      <SectionLabel title={label} isPrivate={secondary} />
      <TextInput
        value={value} onChangeText={onChangeText}
        placeholder={placeholder} placeholderTextColor={COLORS.gray[400]}
        multiline textAlignVertical="top"
        style={[localStyles.input, { minHeight: s(minHeight) }, secondary && localStyles.inputPrivate]}
      />
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row" style={{ gap: s(12) }}>
      <Typography variant="label-01" className="text-gray-500" style={{ width: s(60) }}>
        {label}
      </Typography>
      <Typography variant="label-01" weight="medium" className="text-gray-800 flex-1">
        {value}
      </Typography>
    </View>
  );
}

/** 큰 영역 — 시트 안 명확하게 분리되는 단위 (회기 정보 / 일지) */
function SectionBlock({
  title,
  helper,
  rightAction,
  children,
}: {
  title: string;
  helper?: string;
  rightAction?: { label: string; onPress: () => void };
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: s(10) }}>
      <View className="flex-row items-end" style={{ gap: s(8) }}>
        <View style={{ flex: 1, gap: s(2) }}>
          <Typography variant="title-01" weight="semibold" className="text-gray-900">
            {title}
          </Typography>
          {helper && (
            <Typography variant="label-02" className="text-gray-400">
              {helper}
            </Typography>
          )}
        </View>
        {rightAction && (
          <TouchableOpacity
            onPress={rightAction.onPress}
            activeOpacity={0.85}
            style={{
              backgroundColor: COLORS.primary,
              paddingHorizontal: s(12),
              paddingVertical: s(7),
              borderRadius: s(16),
              flexDirection: 'row',
              alignItems: 'center',
              gap: s(4),
            }}
          >
            <Ionicons name="create-outline" size={12} color={COLORS.white} />
            <Typography variant="label-02" weight="semibold" style={{ color: COLORS.white }}>
              {rightAction.label}
            </Typography>
          </TouchableOpacity>
        )}
      </View>
      {children}
    </View>
  );
}

/** 작은 영역 — "일지" 안 sub-section (회기 공통 / 내담자별 기록) */
function SubBlock({
  label,
  helper,
  rightAction,
  children,
}: {
  label: string;
  helper?: string;
  rightAction?: { label: string; onPress: () => void };
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: s(6) }}>
      <View className="flex-row items-center" style={{ gap: s(8) }}>
        <Typography variant="label-01" weight="semibold" className="text-gray-700 flex-1">
          {label}
        </Typography>
        {rightAction && (
          <TouchableOpacity onPress={rightAction.onPress} hitSlop={6} activeOpacity={0.7}>
            <View className="flex-row items-center" style={{ gap: s(4) }}>
              <Icon name="modify-20" size={12} color={COLORS.primary700} />
              <Typography variant="label-02" weight="semibold" style={{ color: COLORS.primary700 }}>
                {rightAction.label}
              </Typography>
            </View>
          </TouchableOpacity>
        )}
      </View>
      {helper && (
        <Typography variant="label-02" className="text-gray-400" style={{ marginBottom: s(4) }}>
          {helper}
        </Typography>
      )}
      {children}
    </View>
  );
}

/** 회기 진행 상태 — Big card selection (scheduled) + 되돌리기 (completed/cancelled) */
function SessionStatusActions({
  status,
  onChange,
}: {
  status: SessionStatus;
  onChange: (next: SessionStatus) => void;
}) {
  if (status === 'scheduled') {
    return (
      <View style={{ flexDirection: 'row', gap: s(10) }}>
        <SessionDecisionCard
          accent={COLORS.palette.green}
          renderIcon={(color) => <Icon name="check-primary-20" size={20} color={color} />}
          label="회기 완료"
          sub="진행했어요"
          onPress={() => onChange('completed')}
        />
        <SessionDecisionCard
          accent={COLORS.palette.red}
          renderIcon={(color) => <Ionicons name="close" size={22} color={color} />}
          label="회기 취소"
          sub="진행 안 했어요"
          onPress={() => onChange('cancelled')}
        />
      </View>
    );
  }

  return (
    <FooterButton
      label="예정으로 되돌리기"
      tone="ghost"
      flex
      onPress={() => onChange('scheduled')}
    />
  );
}

/** 회기 결과 상태 row — completed/cancelled 시 작게 표시 + 되돌리기 액션 */
function SessionStatusResultRow({
  status,
  onChange,
}: {
  status: SessionStatus;
  onChange: (next: SessionStatus) => void;
}) {
  const isCompleted = status === 'completed';
  const accent = isCompleted ? COLORS.palette.green : COLORS.palette.red;
  const label = isCompleted ? '완료된 회기예요' : '취소된 회기예요';

  return (
    <View
      style={{
        backgroundColor: COLORS.gray[50],
        borderRadius: s(12),
        paddingVertical: s(14),
        paddingHorizontal: s(14),
        flexDirection: 'row',
        alignItems: 'center',
        gap: s(10),
      }}
    >
      <View
        style={{
          width: s(24),
          height: s(24),
          borderRadius: s(12),
          backgroundColor: accent,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {isCompleted ? (
          <Icon name="check-primary-20" size={14} color={COLORS.white} />
        ) : (
          <Ionicons name="close" size={16} color={COLORS.white} />
        )}
      </View>
      <Typography
        variant="body-02"
        weight="semibold"
        className="text-gray-900"
        style={{ flex: 1 }}
      >
        {label}
      </Typography>
      <TouchableOpacity
        onPress={() => onChange('scheduled')}
        hitSlop={6}
        activeOpacity={0.7}
      >
        <Typography
          variant="label-01"
          weight="semibold"
          className="text-gray-600"
        >
          되돌리기
        </Typography>
      </TouchableOpacity>
    </View>
  );
}

/** 회기 진행 결정 카드 — gray-50 bg + 컬러 아이콘 + 라벨·부가 설명 */
function SessionDecisionCard({
  accent,
  renderIcon,
  label,
  sub,
  onPress,
}: {
  accent: string;
  renderIcon: (color: string) => React.ReactNode;
  label: string;
  sub: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        flex: 1,
        backgroundColor: COLORS.gray[50],
        borderRadius: s(12),
        paddingVertical: s(20),
        paddingHorizontal: s(14),
        alignItems: 'center',
        gap: s(10),
      }}
    >
      <View
        style={{
          width: s(36),
          height: s(36),
          borderRadius: s(18),
          backgroundColor: accent,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {renderIcon(COLORS.white)}
      </View>
      <View style={{ alignItems: 'center', gap: s(2) }}>
        <Typography variant="body-02" weight="semibold" className="text-gray-900">
          {label}
        </Typography>
        <Typography variant="label-02" className="text-gray-500">
          {sub}
        </Typography>
      </View>
    </TouchableOpacity>
  );
}

function SessionStatusBadge({ status }: { status: SessionStatus }) {
  const palette =
    status === 'completed'
      ? { color: COLORS.primary, bg: COLORS.primary50, label: '완료' }
      : status === 'cancelled'
        ? { color: COLORS.palette.red, bg: COLORS.paletteBg.red, label: '취소' }
        : { color: COLORS.palette.orange, bg: COLORS.paletteBg.orange, label: '예정' };
  return (
    <View
      style={{
        backgroundColor: palette.bg, paddingHorizontal: s(10),
        paddingVertical: s(4), borderRadius: s(16),
      }}
    >
      <Typography variant="label-02" weight="semibold" style={{ color: palette.color }}>
        {palette.label}
      </Typography>
    </View>
  );
}

function FooterSaveBar({ onPress }: { onPress: () => void }) {
  return (
    <View
      style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: COLORS.white,
        borderTopWidth: 1, borderTopColor: COLORS.gray[100],
        paddingHorizontal: s(20), paddingTop: s(12), paddingBottom: s(20),
      }}
    >
      <TouchableOpacity
        onPress={onPress} activeOpacity={0.85}
        style={{
          height: s(52), borderRadius: s(12), backgroundColor: COLORS.primary,
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Typography variant="body-01" weight="semibold" style={{ color: COLORS.white }}>
          저장
        </Typography>
      </TouchableOpacity>
    </View>
  );
}

function Toast({ message, visible }: { message: string; visible: boolean }) {
  if (!visible) return null;
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute', bottom: s(80), left: s(20), right: s(20),
        backgroundColor: COLORS.gray[900], borderRadius: s(12),
        paddingVertical: s(12), paddingHorizontal: s(16),
        flexDirection: 'row', alignItems: 'center', gap: s(8),
        shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: s(12),
        shadowOffset: { width: 0, height: s(4) }, elevation: 12, zIndex: 100,
      }}
    >
      <Icon name="check-primary-20" size={16} color={COLORS.palette.green} />
      <Typography variant="body-03" weight="medium" style={{ color: COLORS.white, flex: 1 }}>
        {message}
      </Typography>
    </View>
  );
}

function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 2400);
    return () => clearTimeout(t);
  }, [message]);
  return { message, show: setMessage };
}

function journalStateOf(session: SessionData): JournalState {
  const written = CLIENTS.filter((c) => !!session.notes[c.id]?.content).length;
  if (written === 0) return 'none';
  if (written < CLIENTS.length) return 'partial';
  return 'all';
}

// ──────────────── styles ────────────────

const localStyles = StyleSheet.create({
  goalCard: {
    flexDirection: 'row', backgroundColor: COLORS.primary50,
    borderRadius: s(12), overflow: 'hidden',
  },
  goalAccent: { width: 3, backgroundColor: COLORS.primary },
  goalContent: { flex: 1, paddingHorizontal: s(14), paddingVertical: s(12) },
  goalLabel: {
    fontSize: s(12), fontWeight: '600', color: COLORS.primary700,
    letterSpacing: TYPOGRAPHY.letterSpacing, marginBottom: s(4),
  },
  goalText: {
    fontSize: s(14), fontWeight: '500', color: COLORS.gray[900],
    lineHeight: s(22), letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  contentText: {
    fontSize: s(15), color: COLORS.gray[900], lineHeight: s(26),
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  memoCard: {
    backgroundColor: '#FFFBEB', borderRadius: s(12),
    paddingHorizontal: s(14), paddingVertical: s(12),
  },
  memoHeader: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: s(6) },
  memoLabel: {
    fontSize: s(12), fontWeight: '600', color: COLORS.warning,
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  memoText: {
    fontSize: s(14), color: COLORS.gray[800], lineHeight: s(22),
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  sectionLabelText: {
    fontSize: s(13), fontWeight: '600', color: COLORS.gray[700],
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  input: {
    fontSize: s(14), lineHeight: s(20), color: COLORS.gray[900],
    letterSpacing: TYPOGRAPHY.letterSpacing,
    padding: s(12), borderRadius: s(12), borderWidth: 1,
    borderColor: COLORS.gray[200], backgroundColor: COLORS.white,
    textAlignVertical: 'top', minHeight: s(80),
  },
  inputPrivate: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  inputSmall: { minHeight: s(96) },
  inputLarge: { minHeight: s(120) },
});
