import { useState, useEffect, useMemo, useRef, type ReactNode } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Animated, {
  FadeIn,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { format, isToday } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useQueryClient } from '@tanstack/react-query';
import { useCenterStore, usePermission } from '@/features/center';
import { useScheduleDetail } from '@/features/schedule';
import {
  useCounselingCaseDetail,
  type CounselingSessionDetail,
  type SessionClientParticipant,
} from '@/features/counseling';
import {
  useSessionDetail,
  useSessionParticipants,
  useUpdateSessionStatus,
  useUpdateAttendance,
  useRevertCancelSession,
  updateSessionStatus,
  type AttendanceStatus,
} from '@/features/counseling/session';
import {
  useNotesBySession,
  CounselingNoteSheet,
  type NoteSheetParticipant,
} from '@/features/counseling/note';
import {
  UnifiedBillingSheet,
  IssuedPaymentPrompt,
  useBillablesByRelated,
  type ClientCandidate,
  type IssuedBillable,
} from '@/features/billing';
import { GENDER_LABELS } from '@/features/client';
import { useToastStore } from '@/features/toast';
import { JournalHistorySheet } from './JournalHistorySheet';
import { NoShowConfirmSheet } from './NoShowConfirmSheet';
import { COLORS } from '@/shared/constants/theme';
import { Typography } from '@/shared/components/ui/Typography';
import { GenderAgeMeta } from '@/shared/components/ui/GenderAgeMeta';
import { BadgeRound } from '@/shared/components/ui/BadgeRound';
import { BottomSheet } from '@/shared/components/ui/BottomSheet';
import { Icon } from '@/shared/components/icons';
import { parseDate } from '@/shared/utils/date';
import { ConfirmModal } from '@/shared/components/ui/ConfirmModal';
import { DecisionMorph } from '@/shared/components/ui/DecisionMorph';
import { s } from '@/shared/utils/scale';

/**
 * 상담 회기 상세 — 재사용 가능한 풀페이지 컨텐츠.
 *
 * 사용처:
 *   - `/(main)/counseling/session/[id].tsx` — route 진입 (case 상세, 홈, push 알림 등)
 *   - `/(main)/(tabs)/schedule.tsx` — 캘린더 카드 morph overlay 내부 컨텐츠
 *
 * 자체 data fetching + 상담일지·청구 시트 호스팅. 부모는 onClose만 제공하면 됨.
 */

const ATTENDANCE_PALETTES: Record<
  AttendanceStatus,
  { label: string; color: string; bg: string }
> = {
  scheduled: { label: '미확인', color: COLORS.tag.gray.fg, bg: COLORS.tag.gray.bg },
  attended: { label: '참석', color: COLORS.tag.green.fg, bg: COLORS.tag.green.bg },
  absent: { label: '불참', color: COLORS.tag.red.fg, bg: COLORS.tag.red.bg },
  late: { label: '지각', color: COLORS.tag.amber.fg, bg: COLORS.tag.amber.bg },
  excused: { label: '사유결석', color: COLORS.tag.blue.fg, bg: COLORS.tag.blue.bg },
  no_show: { label: '노쇼', color: COLORS.tag.orange.fg, bg: COLORS.tag.orange.bg },
};

export interface SessionDetailViewProps {
  /** sessionId 또는 scheduleId 중 적어도 하나는 필요. scheduleId만 주면 schedule을 fetch해서 첫 회기로 해소 */
  sessionId?: string | null;
  scheduleId?: string;
  /** `'1'`이면 진입 시 첫 내담자의 일지 시트 자동 오픈 */
  openNote?: string;
  /**
   * 진입 시 일지 작성 wizard 자동 오픈.
   *  - `'1'`: 첫 미작성 내담자 step 부터 (footer CTA 와 동일)
   *  - clientId: 해당 내담자 step 으로 바로 점프 (미작성 일지 리스트에서 내담자 탭)
   */
  openWizard?: string;
  /** 헤더 뒤로가기 버튼 콜백 — route에선 router.back, overlay에선 closeOverlay */
  onClose: () => void;
  /** SafeAreaView edges={['top']}로 래핑할지 여부. overlay는 상위 컨테이너가 위치 제어하므로 false 권장 */
  withSafeArea?: boolean;
}

export function SessionDetailView({
  sessionId,
  scheduleId,
  openNote,
  openWizard,
  onClose,
  withSafeArea = true,
}: SessionDetailViewProps) {
  const centerId = useCenterStore((st) => st.centerId);
  // 청구는 권한 기반 노출 — read|write:billing 없으면 청구 UI·쿼리 숨김
  const { can } = usePermission();
  const canBilling = can('read:billing') || can('write:billing');

  // ─── sessionId 해소 — sessionId 직접 받으면 그대로, scheduleId만 있으면 schedule을 fetch해서 첫 회기로 ──
  const { data: initialSchedule } = useScheduleDetail(
    centerId,
    !sessionId && scheduleId ? scheduleId : null,
  );
  const resolvedSessionId =
    sessionId ?? initialSchedule?.sessions[0]?.session_id ?? null;

  // ─── data fetching ──────────────────────────────────────────────
  const { data: session, isLoading: sessionLoading } = useSessionDetail(
    centerId,
    resolvedSessionId,
  );
  const {
    data: participants,
    isLoading: participantsLoading,
    isError,
    refetch,
  } = useSessionParticipants(centerId, resolvedSessionId);
  const { data: schedule } = useScheduleDetail(
    centerId,
    session?.schedule_id ?? scheduleId ?? null,
  );
  const { data: caseDetail } = useCounselingCaseDetail(
    centerId,
    session?.counseling_case_id ?? null,
  );
  const { data: sessionNotes } = useNotesBySession(centerId, sessionId ?? null);
  const { data: caseBillables } = useBillablesByRelated({
    centerId: canBilling ? centerId : null,
    relatedType: ['counseling_session', 'counseling_case'],
    relatedCaseId: session?.counseling_case_id ?? null,
  });

  // ─── synthesize sheet-shape session detail ──────────────────────
  const sessionDetail: CounselingSessionDetail | null = useMemo(() => {
    if (!session || !participants) return null;
    const noteMap = new Map<string, string>();
    sessionNotes?.forEach((n) => noteMap.set(n.client_id, n.id));
    return {
      session_id: session.id,
      session_number: 0,
      schedule_id: session.schedule_id,
      start: schedule?.start ?? session.created_at,
      end: schedule?.end ?? session.created_at,
      room_id: schedule?.room_id ?? null,
      room_name: schedule?.room_name ?? null,
      status: session.status,
      clients: participants
        .filter((p) => p.participant_type === 'client')
        .map<SessionClientParticipant>((p) => ({
          session_participant_id: p.id,
          participant_type: 'client',
          participant_id: p.participant_id,
          participant_name: p.participant_name ?? '참여자',
          attendance_status: p.attendance_status,
          is_consumed: p.is_consumed,
          note: p.note,
          has_note: noteMap.has(p.participant_id),
        })),
      counselors: participants
        .filter((p) => p.participant_type === 'counselor')
        .map((p) => ({
          counselor_id: p.participant_id,
          counselor_name: p.participant_name ?? '',
        })),
    };
  }, [session, participants, sessionNotes, schedule]);

  const programName = caseDetail?.program_name ?? '';
  const counselorNames =
    caseDetail?.counselors.map((c) => c.counselor_name).filter(Boolean) ?? [];

  // 케이스 서브타이틀 — "{case_code}의 N회기" (강조 X 캡션). schedule 첫 회기 기준
  const firstSessionSummary = schedule?.sessions?.[0] ?? null;
  const caseSubtitle =
    firstSessionSummary?.case_code &&
    firstSessionSummary?.session_number != null
      ? `${firstSessionSummary.case_code}의 ${firstSessionSummary.session_number}회기`
      : null;

  // 지난 일지 — 케이스의 완료된 지난 회기(현재 회기 제외), 최신순. 상담 직전 복습용 열람.
  const pastSessions = useMemo(() => {
    if (!caseDetail?.sessions) return [];
    return caseDetail.sessions
      .filter(
        (sess) =>
          sess.status === 'completed' &&
          sess.session_id !== resolvedSessionId,
      )
      .sort((a, b) => parseDate(b.start).getTime() - parseDate(a.start).getTime());
  }, [caseDetail, resolvedSessionId]);

  // ─── stacked sheets state ───────────────────────────────────────
  const [noteSheetTarget, setNoteSheetTarget] = useState<{
    sessionId: string;
    sessionStart: string;
    clientId: string;
    clientName: string;
    /** 그룹 회기면 참여 내담자 전체 — 시트 상단 칩 전환용. 단일/지난일지는 생략 */
    participants?: NoteSheetParticipant[];
    /** 연결된 필드노트 초안 진입용 */
    scheduleId?: string | null;
  } | null>(null);

  /** 현재 회기 참여 내담자 → 일지 시트 칩(NoteSheetParticipant) */
  const noteSheetParticipants: NoteSheetParticipant[] = useMemo(
    () =>
      (sessionDetail?.clients ?? []).map((c) => ({
        clientId: c.participant_id,
        clientName: c.participant_name,
        isWritten: c.has_note,
        attendanceStatus: c.attendance_status,
      })),
    [sessionDetail],
  );

  // 통합 청구 시트 — 푸터의 "청구" 버튼이 진입점
  const [billingOpen, setBillingOpen] = useState(false);
  // 발행 직후 '납부 처리?' 모달 → 납부 시트 플로우 대상
  const [issuedBillable, setIssuedBillable] = useState<IssuedBillable | null>(
    null,
  );

  // UnifiedBillingSheet용 ClientCandidate[] — case 전체 회기를 내담자별로 묶어 청구 마킹
  const billingClients: ClientCandidate[] = useMemo(() => {
    if (!sessionDetail || !caseDetail) return [];
    return sessionDetail.clients.map((sc) => {
      // 성별·나이·프로필은 case 내담자 정보에서 보강 (세션 참여자엔 없음)
      const cc = caseDetail.clients.find(
        (c) => c.client_id === sc.participant_id,
      );
      const sessions = (caseDetail.sessions ?? [])
        .filter((cs) =>
          cs.clients.some((p) => p.participant_id === sc.participant_id),
        )
        .map((cs) => {
          const billed =
            caseBillables?.some(
              (b) =>
                b.client_id === sc.participant_id &&
                b.related_session_ids.includes(cs.session_id),
            ) ?? false;
          return {
            id: cs.session_id,
            start: cs.start,
            end: cs.end,
            sessionNumber: 0,
            status: cs.status,
            billed,
          };
        });
      return {
        client: {
          id: sc.participant_id,
          name: sc.participant_name,
          gender: cc?.gender ?? null,
          age: cc?.age ?? null,
          profileImageUrl: cc?.profile_image_url ?? null,
          program: caseDetail.program_name,
        },
        sessions,
      };
    });
  }, [sessionDetail, caseDetail, caseBillables]);

  const handleOpenNote = ({
    clientId,
    name,
  }: {
    clientId: string;
    name: string;
  }) => {
    if (!sessionDetail) return;
    setNoteSheetTarget({
      sessionId: sessionDetail.session_id,
      sessionStart: sessionDetail.start,
      clientId,
      clientName: name,
      participants: noteSheetParticipants,
      scheduleId: sessionDetail.schedule_id,
    });
  };

  // 자동 진입 — openNote/openWizard 쿼리로 진입 시 일지 시트 자동 오픈.
  //  - '1'      → 첫 미작성 내담자(없으면 첫 내담자)
  //  - clientId → 해당 내담자
  // openWizard 딥링크(빈 시간 추천 등)로 진입한 경우엔 시트를 닫을 때 진입 지점으로 복귀.
  const autoOpenedNoteRef = useRef(false);
  const autoExitOnCloseRef = useRef(false);
  useEffect(() => {
    const trigger = openWizard ?? openNote;
    if (!trigger) return;
    if (autoOpenedNoteRef.current) return;
    if (!sessionDetail || sessionDetail.clients.length === 0) return;
    autoOpenedNoteRef.current = true;
    autoExitOnCloseRef.current = !!openWizard;
    const clients = sessionDetail.clients;
    const target =
      trigger !== '1'
        ? clients.find((c) => c.participant_id === trigger) ??
          clients.find((c) => !c.has_note) ??
          clients[0]
        : clients.find((c) => !c.has_note) ?? clients[0];
    const timer = setTimeout(() => {
      setNoteSheetTarget({
        sessionId: sessionDetail.session_id,
        sessionStart: sessionDetail.start,
        clientId: target.participant_id,
        clientName: target.participant_name,
        participants: noteSheetParticipants,
        scheduleId: sessionDetail.schedule_id,
      });
    }, 280);
    return () => clearTimeout(timer);
  }, [openNote, openWizard, sessionDetail, noteSheetParticipants]);

  const isLoading = sessionLoading || participantsLoading;

  const ShellWrapper = withSafeArea ? SafeAreaView : View;
  const shellProps = withSafeArea
    ? { edges: ['top'] as const, style: { flex: 1, backgroundColor: COLORS.bg.base } }
    : { style: { flex: 1, backgroundColor: COLORS.bg.base } };

  // ─── render ─────────────────────────────────────────────────────
  if (isLoading || !sessionDetail) {
    return (
      <ShellWrapper {...(shellProps as any)}>
        <Header onBack={onClose} />
        {isError ? (
          <View className="flex-1 items-center justify-center" style={{ gap: s(8) }}>
            <Ionicons
              name="cloud-offline-outline"
              size={48}
              color={COLORS.gray[300]}
            />
            <Typography variant="body-02" weight="semibold" className="text-gray-600">
              회기를 불러올 수 없어요
            </Typography>
            <TouchableOpacity
              onPress={() => refetch()}
              activeOpacity={0.7}
              style={{
                marginTop: s(8),
                paddingHorizontal: s(20),
                paddingVertical: s(8),
                borderRadius: s(12),
                backgroundColor: COLORS.primary,
              }}
            >
              <Typography variant="body-03" weight="semibold" style={{ color: COLORS.white }}>
                다시 시도
              </Typography>
            </TouchableOpacity>
          </View>
        ) : (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        )}
      </ShellWrapper>
    );
  }

  return (
    <ShellWrapper {...(shellProps as any)}>
      <Header onBack={onClose} />

      <SessionContent
        session={sessionDetail}
        centerId={centerId}
        programName={programName}
        caseSubtitle={caseSubtitle}
        counselorNames={counselorNames}
        caseClients={caseDetail?.clients ?? []}
        caseMemo={caseDetail?.memo ?? null}
        pastSessions={pastSessions}
        autoOpenNote={!!(openNote || openWizard)}
        canBilling={canBilling}
        canEdit={caseDetail?.my_role !== 'assistant'}
        onOpenNote={handleOpenNote}
        onOpenSessionNote={(t) => setNoteSheetTarget(t)}
        onOpenBilling={() => setBillingOpen(true)}
      />

      {/* 상담일지 시트 — 그룹이면 내담자 칩으로 전환 (검사 소견 시트와 동일 패턴) */}
      <CounselingNoteSheet
        visible={noteSheetTarget !== null}
        onClose={() => {
          setNoteSheetTarget(null);
          if (autoExitOnCloseRef.current) {
            autoExitOnCloseRef.current = false;
            onClose();
          }
        }}
        centerId={centerId}
        sessionId={noteSheetTarget?.sessionId ?? null}
        clientId={noteSheetTarget?.clientId ?? null}
        clientName={noteSheetTarget?.clientName}
        sessionStart={noteSheetTarget?.sessionStart}
        participants={noteSheetTarget?.participants}
        scheduleId={noteSheetTarget?.scheduleId ?? null}
      />

      {/* 통합 청구 시트 — 푸터의 "청구" 버튼 진입.
          현재 회기를 pre-select, 1:1이면 내담자도 자동 선택 */}
      <UnifiedBillingSheet
        visible={billingOpen}
        onClose={() => setBillingOpen(false)}
        centerId={centerId}
        caseId={session?.counseling_case_id ?? ''}
        caseType="counseling"
        clients={billingClients}
        initialClientId={
          billingClients.length === 1 ? billingClients[0]?.client.id : undefined
        }
        initialSelectedSessionIds={
          sessionDetail ? [sessionDetail.session_id] : []
        }
        onIssued={setIssuedBillable}
      />

      {/* 발행 직후 — '바로 납부할까요?' 모달 → 납부 시트 */}
      <IssuedPaymentPrompt
        issued={issuedBillable}
        centerId={centerId}
        onDone={() => setIssuedBillable(null)}
      />
    </ShellWrapper>
  );
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: s(20),
        height: s(52),
      }}
    >
      <TouchableOpacity
        onPress={onBack}
        hitSlop={8}
        accessibilityLabel="뒤로 가기"
        accessibilityRole="button"
      >
        <Ionicons name="chevron-back" size={24} color={COLORS.gray[900]} />
      </TouchableOpacity>
    </View>
  );
}

function SessionContent({
  session,
  centerId,
  programName,
  caseSubtitle,
  counselorNames,
  caseClients,
  caseMemo,
  pastSessions,
  autoOpenNote,
  canBilling,
  canEdit,
  onOpenNote,
  onOpenSessionNote,
  onOpenBilling,
}: {
  session: CounselingSessionDetail;
  centerId: string | null;
  programName: string;
  caseSubtitle: string | null;
  counselorNames: string[];
  caseClients: {
    client_id: string;
    name: string;
    gender: string | null;
    age: number | null;
    profile_image_url?: string | null;
  }[];
  caseMemo: string | null;
  /** 케이스의 완료된 지난 회기 (현재 회기 제외, 최신순) — 지난 일지 열람용 */
  pastSessions: CounselingSessionDetail[];
  /** openNote/openWizard 쿼리로 자동 진입 중인지 — 예정 회기 상태 시트 자동 오픈 억제용 */
  autoOpenNote?: boolean;
  /** 청구 권한(read|write:billing) 보유 여부 — 청구 액션 노출 게이팅 */
  canBilling: boolean;
  /** false면 열람 전용 — 부담당(공동 상담사)은 출결·일지를 쓸 수 없다 */
  canEdit: boolean;
  onOpenNote: (client: { clientId: string; name: string }) => void;
  /** 임의 회기·내담자의 일지 시트 오픈 (지난 일지 열람) */
  onOpenSessionNote: (target: {
    sessionId: string;
    sessionStart: string;
    clientId: string;
    clientName: string;
  }) => void;
  /** 푸터 청구 버튼 콜백 — 부모가 UnifiedBillingSheet 오픈 */
  onOpenBilling: () => void;
}) {
  const serverStatus = session.status;
  // 클릭 즉시 애니메이션이 시작되도록 낙관적(optimistic) 상태로 우선 반영하고,
  // 뮤테이션은 백그라운드로 처리한다 (서버 round-trip 대기 제거). 실패 시 null 로 되돌림.
  const [optimisticStatus, setOptimisticStatus] = useState<
    'scheduled' | 'completed' | 'no_show' | 'cancelled' | null
  >(null);
  const status = optimisticStatus ?? serverStatus;
  const sessionId = session.session_id;
  const updateStatus = useUpdateSessionStatus(centerId, sessionId);
  const revertCancel = useRevertCancelSession(centerId, sessionId);
  const updateAttendance = useUpdateAttendance(centerId, sessionId);
  const isGroupSession = session.clients.length > 1;
  // 지난 일지 히스토리 시트 — 상단 brief 진입점에서 오픈
  const [historyOpen, setHistoryOpen] = useState(false);
  // 상담일지 초안 생성 확인 모달
  const [showGenerateNoteConfirm, setShowGenerateNoteConfirm] = useState(false);
  const handleConfirmGenerateNote = () => {
    setShowGenerateNoteConfirm(false);
    // TODO: 상담일지 초안 생성 API 호출
  };
  // 취소 사유 — backend 미지원, 화면 내 mock state. 확인 후엔 read-only 모드
  const [cancelReason, setCancelReason] = useState('');
  const [cancelReasonConfirmed, setCancelReasonConfirmed] = useState(false);
  // 출결 변경 — 배지 탭 시 바텀시트로 상태 선택
  const [attendanceTarget, setAttendanceTarget] = useState<{
    participantId: string;
    name: string;
    current: AttendanceStatus;
  } | null>(null);
  // 최초 진입 시 "일정이 진행되었나요?" 상태 선택 시트 (예정 회기 한정)
  const [statusSheetOpen, setStatusSheetOpen] = useState(false);
  // 노쇼 확인 시트 — 원탭 확정 대신 회기 차감 여부 결정 (D4)
  const [noShowSheetOpen, setNoShowSheetOpen] = useState(false);
  const showToast = useToastStore((st) => st.show);

  const dateLabel = format(parseDate(session.start), 'yyyy년 M월 d일 (E)', {
    locale: ko,
  });
  const timeLabel = format(parseDate(session.start), 'HH:mm', { locale: ko });

  const queryClient = useQueryClient();
  const handleStatusChange = async (
    next: 'scheduled' | 'completed' | 'no_show' | 'cancelled',
  ) => {
    // 노쇼는 즉시 확정하지 않고 확인 시트에서 회기 차감 여부부터 결정 (D4)
    if (next === 'no_show') {
      setNoShowSheetOpen(true);
      return;
    }
    // 클릭 즉시 애니메이션 반영 (서버 응답 대기 제거). 뮤테이션은 백그라운드.
    setOptimisticStatus(next);
    if (next === 'scheduled') {
      if (status === 'cancelled') {
        revertCancel.mutate(undefined, {
          onError: () => setOptimisticStatus(null),
        });
        return;
      }
      try {
        await updateSessionStatus(
          centerId!,
          sessionId,
          'scheduled' as unknown as 'completed',
        );
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: ['counselingSession', centerId, sessionId],
          }),
          queryClient.invalidateQueries({
            queryKey: ['counselingSessions'],
            exact: false,
          }),
          queryClient.invalidateQueries({
            queryKey: ['sessionParticipants', centerId, sessionId],
          }),
          queryClient.invalidateQueries({ queryKey: ['schedule'], exact: false }),
          queryClient.invalidateQueries({ queryKey: ['schedules'], exact: false }),
          queryClient.invalidateQueries({
            queryKey: ['counselingCaseDetail'],
            exact: false,
          }),
        ]);
      } catch (err) {
        setOptimisticStatus(null);
        Alert.alert(
          '되돌릴 수 없어요',
          '회기 상태를 예정으로 되돌리지 못했어요. 잠시 후 다시 시도해 주세요.',
        );
      }
      return;
    }
    updateStatus.mutate(next, { onError: () => setOptimisticStatus(null) });
  };

  const handleAttendanceChange = (
    participantId: string,
    next: AttendanceStatus,
  ) => {
    updateAttendance.mutate({
      participantId,
      data: { attendance_status: next },
    });
  };

  // 노쇼 확정 — 세션 상태 변경 + 참여자 출결·차감 기록.
  // 백엔드는 세션 노쇼 시 출결을 파생하지 않으므로(완료만 자동 참석) 참여자별로 명시 기록.
  const applyNoShow = (isConsumed: boolean) => {
    setNoShowSheetOpen(false);
    setOptimisticStatus('no_show');
    updateStatus.mutate('no_show', {
      onError: () => setOptimisticStatus(null),
      onSuccess: () => {
        // 스펙 §3-1: 일정 노쇼 = 전원 출결 노쇼 default
        session.clients.forEach((client) => {
          updateAttendance.mutate({
            participantId: client.session_participant_id,
            data: { attendance_status: 'no_show', is_consumed: isConsumed },
          });
        });
        // 모바일엔 회기 추가가 없음(웹 위임) — 보강 동선 안내 (D7)
        showToast({
          type: 'success',
          message: '노쇼로 처리했어요. 보강 일정은 웹에서 회기 추가로 잡을 수 있어요',
        });
      },
    });
  };

  const firstUnwrittenClient = session.clients.find((c) => !c.has_note);
  // footer "일지 작성하기" — 첫 미작성 내담자(없으면 첫 내담자)로 일지 시트 오픈.
  // 그룹이면 시트 상단 칩으로 다른 내담자 전환 (검사 소견 시트와 동일 패턴).
  const handleOpenNoteFooter = () => {
    const target = firstUnwrittenClient ?? session.clients[0];
    if (!target) return;
    onOpenNote({ clientId: target.participant_id, name: target.participant_name });
  };

  // 최초 진입 시 예정(scheduled) 회기면 "일정이 진행되었나요?" 시트를 띄운다.
  // 단 시작 시각이 지난 회기만 — 미래 회기(내일 일정 미리 보기 등)에 완료/노쇼를 물으면
  // 조기 완료 처리 같은 오조작을 유도한다. 일지 자동 진입(autoOpenNote)과는 충돌하지 않도록 가드.
  const autoOpenedStatusRef = useRef(false);
  useEffect(() => {
    if (autoOpenedStatusRef.current) return;
    if (!canEdit) return;
    if (autoOpenNote) return;
    if (status !== 'scheduled') return;
    if (parseDate(session.start).getTime() > Date.now()) return;
    autoOpenedStatusRef.current = true;
    const t = setTimeout(() => setStatusSheetOpen(true), 320);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, autoOpenNote, canEdit]);

  // 일지·필드노트 영역은 모든 상태에서 노출. 상태별로 적절한 안내 텍스트만 다르게.
  const showCancelReason = status === 'cancelled';
  // 푸터 — 일지 작성 버튼. 취소 회기 제외하고 항상 노출 (이미지: 예정에서도 노출)
  // 부담당(공동 상담사)은 상담일지 열람·작성이 모두 막혀 있어 푸터 진입점을 숨긴다
  const hasFooter =
    canEdit && status !== 'cancelled' && session.clients.length > 0;
  // 출결 배지는 회기 완료 후에만 의미 있음 (예정 회기엔 미표시)
  const showAttendance = status === 'completed';
  // 지난 일지 진입점 — 오늘 예정된 회기에서만. 일정 카드 진입 시 상담 직전 복습을 자연스럽게 유도.
  const showPastJournals =
    canEdit &&
    pastSessions.length > 0 &&
    status === 'scheduled' &&
    isToday(parseDate(session.start));

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg.base }}>
      <KeyboardAwareScrollView
        // 배경 흰색 → 하단 바운스 흰색. 상단(회색)은 zone View + 아래 회색 View로 처리.
        style={{ backgroundColor: COLORS.white }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingBottom: hasFooter ? s(132) : s(40),
        }}
        bottomOffset={s(24)}
        keyboardShouldPersistTaps="handled"
      >
        {/* 상단 바운스 시 회색 유지 — 콘텐츠 위로 확장된 회색 배경 */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: -600,
            left: 0,
            right: 0,
            height: 600,
            backgroundColor: COLORS.bg.base,
          }}
        />
        {/* ───── Section 1: 회기 정보 + 회기 진행 + 메모/취소 사유 — 흰 카드 ───── */}
        {/* 상단 회색 zone (paddingBottom 32 = 하단 패널과의 간격) */}
        <View
          style={{
            backgroundColor: COLORS.bg.base,
            paddingHorizontal: s(16),
            paddingTop: s(12),
            paddingBottom: s(32),
          }}
        >
          <View
            style={{
              backgroundColor: COLORS.white,
              borderRadius: s(16),
              padding: s(20),
              gap: s(16),
            }}
          >
          {/* 지난 일지 진입점 — 최상단. 오늘 예정 회기에서만, 상담 직전 복습 유도 */}
          {showPastJournals && (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setHistoryOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={`지난 일지 ${pastSessions.length}개 보기`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: s(10),
                paddingHorizontal: s(14),
                paddingVertical: s(13),
                borderRadius: s(12),
                backgroundColor: COLORS.primary50,
                // 상단 타이틀과의 갭 축소 (Section gap 16 → 약 10)
                marginBottom: -s(6),
              }}
            >
              <View
                style={{
                  width: s(32),
                  height: s(32),
                  borderRadius: s(8),
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: COLORS.white,
                }}
              >
                <Ionicons name="document-text" size={s(17)} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1, gap: s(1) }}>
                <Typography variant="body-02" weight="semibold" className="text-gray-900">
                  지난 일지 {pastSessions.length}개
                </Typography>
                <Typography variant="label-01" className="text-gray-500">
                  상담 전에 지난 회기 기록을 확인해보세요
                </Typography>
              </View>
              <Ionicons name="chevron-forward" size={s(18)} color={COLORS.primary} />
            </TouchableOpacity>
          )}

          {/* 회기 정보 — 위계 hierarchy (타이틀 → 부속 정보 → 칩) */}
          <View style={{ gap: s(8) }}>
            <SessionInfoHeader
              session={session}
              caseClients={caseClients}
              programName={programName}
              caseSubtitle={caseSubtitle}
              dateLabel={dateLabel}
              timeLabel={timeLabel}
              roomName={session.room_name}
            />
          </View>

          {/* 메모 — 웹에서 작성된 case-level 메모, 항상 노출 (read-only). 타이틀을 필드 안에 포함 */}
          <View
            style={{
              backgroundColor: COLORS.gray[50],
              borderRadius: s(12),
              paddingHorizontal: s(14),
              paddingVertical: s(12),
              gap: s(6),
              minHeight: s(90),
            }}
          >
            <Typography variant="label-01" weight="semibold" className="text-gray-700">
              메모
            </Typography>
            {caseMemo && caseMemo.trim().length > 0 ? (
              <Typography
                variant="body-02"
                className="text-gray-900"
                style={{ lineHeight: s(22) }}
              >
                {caseMemo}
              </Typography>
            ) : (
              <Typography variant="body-02" className="text-gray-400">
                작성된 메모가 없어요
              </Typography>
            )}
          </View>

          {/* 메모 ↔ 진행 사이 구분 — 예정 회기는 전체폭 gray-50 밴드로 섹션 강조,
              그 외 상태는 기존 얇은 hairline 유지 */}
          {status !== 'scheduled' && (
            <Animated.View
              entering={FadeIn.duration(240)}
              style={{
                height: 1,
                backgroundColor: COLORS.gray[100],
                marginHorizontal: -s(4),
                marginTop: s(4),
              }}
            />
          )}

          {/* 회기 진행 — 선택(완료/취소/노쇼) ↔ 결과 morph (공용 DecisionMorph, 검사 항목과 동일) */}
          <DecisionMorph
            isSelect={status === 'scheduled'}
            options={[
              { key: 'completed', label: '완료', resultLabel: '완료된 회기예요', iconName: 'complete-check-circle-20' },
              { key: 'cancelled', label: '취소', resultLabel: '취소된 회기예요', iconName: 'cancel-red-circle-20' },
              { key: 'no_show', label: '노쇼', resultLabel: '노쇼 처리된 회기예요', iconName: 'warning-yellow-circle-20' },
            ]}
            resultKey={
              status === 'completed' || status === 'cancelled' ? status : 'no_show'
            }
            onSelect={(key) =>
              handleStatusChange(key as 'completed' | 'cancelled' | 'no_show')
            }
            onRevert={() => handleStatusChange('scheduled')}
          />

          {/* 취소 사유 — cancelled 전용 (결과 row 아래) */}
          {status === 'cancelled' && (
            <Animated.View
              key="cancel-reason"
              entering={FadeIn.duration(240).delay(140)}
              style={{ gap: s(8) }}
            >
                {cancelReasonConfirmed ? (
                  <>
                    <View
                      style={{
                        backgroundColor: COLORS.paletteBg.red,
                        borderRadius: s(12),
                        paddingHorizontal: s(16),
                        paddingVertical: s(14),
                        gap: s(6),
                        minHeight: s(110),
                      }}
                    >
                      <Typography
                        variant="body-02"
                        weight="medium"
                        style={{ color: COLORS.gray[600] }}
                      >
                        취소 사유
                      </Typography>
                      {cancelReason.trim() ? (
                        <Typography
                          variant="body-02"
                          className="text-gray-900"
                          style={{ lineHeight: s(22) }}
                        >
                          {cancelReason}
                        </Typography>
                      ) : (
                        <Typography variant="body-02" className="text-gray-400">
                          작성된 취소 사유가 없어요
                        </Typography>
                      )}
                    </View>
                    <TouchableOpacity
                      onPress={() => setCancelReasonConfirmed(false)}
                      activeOpacity={0.7}
                      hitSlop={6}
                      style={{
                        alignSelf: 'flex-end',
                        width: s(64),
                        height: s(36),
                        borderRadius: s(10),
                        backgroundColor: COLORS.gray[100],
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Typography
                        variant="label-01"
                        weight="semibold"
                        className="text-gray-700"
                      >
                        수정
                      </Typography>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <View
                      style={{
                        backgroundColor: COLORS.paletteBg.red,
                        borderRadius: s(12),
                        paddingHorizontal: s(16),
                        paddingVertical: s(14),
                        gap: s(6),
                      }}
                    >
                      <Typography
                        variant="body-02"
                        weight="medium"
                        style={{ color: COLORS.gray[600] }}
                      >
                        취소 사유
                      </Typography>
                      <TextInput
                        value={cancelReason}
                        onChangeText={setCancelReason}
                        placeholder="취소 사유를 입력해주세요"
                        placeholderTextColor={COLORS.gray[400]}
                        multiline
                        textAlignVertical="top"
                        style={{
                          fontSize: s(15),
                          lineHeight: s(22),
                          color: COLORS.gray[900],
                          padding: 0,
                          minHeight: s(72),
                        }}
                      />
                    </View>
                    <TouchableOpacity
                      onPress={() => setCancelReasonConfirmed(true)}
                      activeOpacity={0.7}
                      hitSlop={6}
                      style={{
                        alignSelf: 'flex-end',
                        width: s(64),
                        height: s(36),
                        borderRadius: s(10),
                        backgroundColor: COLORS.gray[100],
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Typography
                        variant="label-01"
                        weight="semibold"
                        className="text-gray-700"
                      >
                        확인
                      </Typography>
                    </TouchableOpacity>
                  </>
                )}
            </Animated.View>
          )}

          {/* 청구 — completed 전용 (결과 row 아래) */}
          {status === 'completed' && canBilling && (
            <Animated.View key="billing" entering={FadeIn.duration(240).delay(140)}>
              <BillingActionRow onPress={onOpenBilling} />
            </Animated.View>
          )}
          </View>
        </View>

        {/* ───── 하단 영역: 필드노트 + 상담일지 — 상단 radius 24 흰 패널 (간격은 위 zone paddingBottom) ───── */}
        <View
          style={{
            flexGrow: 1,
            backgroundColor: COLORS.white,
            borderTopLeftRadius: s(24),
            borderTopRightRadius: s(24),
            paddingTop: s(24),
            paddingBottom: s(20),
            gap: s(32),
          }}
        >
              {/* Section 2: 필드노트 */}
              <View style={{ paddingHorizontal: s(20) }}>
                <SectionBlock title="필드노트">
                  <Animated.View
                    key={`fieldnote-${status}`}
                    entering={FadeIn.duration(220)}
                  >
                    {status === 'cancelled' ? (
                      <DisabledSectionBox
                        icon="mic"
                        text="취소된 상담은 필드노트를 연결할 수 없어요"
                      />
                    ) : (
                      <DisabledSectionBox
                        icon="mic-outline"
                        text="녹음을 완료하면 상담 내용을 분석할 수 있어요"
                      />
                    )}
                  </Animated.View>
                </SectionBlock>
              </View>

              {/* Section 3: 일지 — completed만 작성 UI, 그 외는 상태별 안내 */}
              <View style={{ paddingHorizontal: s(20) }}>
                <SectionBlock title="상담일지">
                  <Animated.View
                    key={`journal-${status}`}
                    entering={FadeIn.duration(220)}
                  >
                  {status === 'cancelled' ? (
                    <DisabledSectionBox
                      iconNode={<Icon name="log-32" size={s(32)} color={COLORS.gray[400]} />}
                      text="취소된 상담은 일지를 작성할 수 없어요"
                    />
                  ) : (
                  <View style={{ gap: s(8) }}>
                    {/* 내담자별 일지 카드 — 내담자 수만큼 (이번 회기 기록 없음) */}
                    {session.clients.length === 0 ? (
                      <Typography variant="body-03" className="text-gray-400">
                        등록된 내담자가 없습니다.
                      </Typography>
                    ) : (
                      session.clients.map((client) => {
                        const cc = caseClients.find(
                          (cl) => cl.client_id === client.participant_id,
                        );
                        const genderLabel = cc?.gender
                          ? GENDER_LABELS[cc.gender] ?? cc.gender
                          : null;
                        const age = cc?.age ?? null;
                        return (
                          <ClientNoteCard
                            key={client.session_participant_id}
                            client={client}
                            genderLabel={genderLabel}
                            age={age}
                            showAttendance={showAttendance}
                            isGroup={isGroupSession}
                            onOpenAttendance={
                              canEdit
                                ? () =>
                                    setAttendanceTarget({
                                      participantId:
                                        client.session_participant_id,
                                      name: client.participant_name,
                                      current: client.attendance_status,
                                    })
                                : undefined
                            }
                            onOpenNote={
                              canEdit
                                ? () =>
                                    onOpenNote({
                                      clientId: client.participant_id,
                                      name: client.participant_name,
                                    })
                                : undefined
                            }
                          />
                        );
                      })
                    )}
                  </View>
                  )}
                  </Animated.View>
              </SectionBlock>
            </View>
        </View>

      </KeyboardAwareScrollView>

      {/* Footer — 일지 작성 (completed에서만). 청구는 상단 결과 row 아래에 배치됨 */}
      {hasFooter && session.clients.length > 0 && (
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: COLORS.white,
            borderTopWidth: 1,
            borderTopColor: COLORS.gray[100],
            paddingHorizontal: s(20),
            paddingTop: s(12),
            paddingBottom: s(52),
          }}
        >
          <FooterButton
            label={firstUnwrittenClient ? '일지 작성하기' : '일지 확인하기'}
            tone={firstUnwrittenClient ? 'primary' : 'primary-subtle'}
            onPress={handleOpenNoteFooter}
          />
        </View>
      )}

      {/* 최초 진입 시 일정 처리 선택 시트 (예정 회기) */}
      <SessionStatusSheet
        visible={statusSheetOpen}
        onClose={() => setStatusSheetOpen(false)}
        onSelect={(next) => {
          setStatusSheetOpen(false);
          handleStatusChange(next);
        }}
      />

      {/* 노쇼 확인 시트 — 회기 차감 여부 결정 후 확정 (D4) */}
      <NoShowConfirmSheet
        visible={noShowSheetOpen}
        onClose={() => setNoShowSheetOpen(false)}
        onConfirm={applyNoShow}
      />

      {/* 출결 변경 바텀시트 */}
      <AttendancePickerSheet
        visible={attendanceTarget !== null}
        clientName={attendanceTarget?.name ?? ''}
        current={attendanceTarget?.current ?? 'scheduled'}
        onSelect={(next) => {
          if (attendanceTarget) {
            handleAttendanceChange(attendanceTarget.participantId, next);
          }
          setAttendanceTarget(null);
        }}
        onClose={() => setAttendanceTarget(null)}
      />

      <ConfirmModal
        visible={showGenerateNoteConfirm}
        title="상담일지 초안 만들기"
        message="녹취·요약을 바탕으로 이 회기의 상담일지 초안을 만들어요. 회기에 참여한 내담자 모두에게 생성되며, 내담자 1명당 약 8 크레딧이 소모돼요."
        confirmLabel="만들기"
        cancelLabel="취소"
        onConfirm={handleConfirmGenerateNote}
        onCancel={() => setShowGenerateNoteConfirm(false)}
      />

      {/* 지난 일지 히스토리 시트 — 탭 시 부모 CounselingNoteSheet(view)로 해당 일지 오픈 */}
      <JournalHistorySheet
        visible={historyOpen}
        onClose={() => setHistoryOpen(false)}
        centerId={centerId}
        sessions={pastSessions}
        isGroup={isGroupSession}
        onOpenNote={(t) => onOpenSessionNote(t)}
      />
    </View>
  );
}

/** 출결 상태 선택 바텀시트 — 배지 탭 시 노출 */
function AttendancePickerSheet({
  visible,
  clientName,
  current,
  onSelect,
  onClose,
}: {
  visible: boolean;
  clientName: string;
  current: AttendanceStatus;
  onSelect: (next: AttendanceStatus) => void;
  onClose: () => void;
}) {
  const options: AttendanceStatus[] = [
    'scheduled',
    'attended',
    'absent',
    'no_show',
  ];
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      {/* 타이틀 — 가운데 정렬 */}
      <Typography
        variant="title-01"
        weight="semibold"
        className="text-gray-900"
        style={{ textAlign: 'center', marginBottom: s(16) }}
      >
        {clientName}의 출결
      </Typography>
      {/* 옵션 리스트 — full-width 행, 선택 시 primary50 bg */}
      {options.map((opt) => {
        const palette = ATTENDANCE_PALETTES[opt];
        const selected = opt === current;
        return (
          <TouchableOpacity
            key={opt}
            onPress={() => onSelect(opt)}
            activeOpacity={0.7}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: s(12),
              // 시트 좌우 패딩(16) 밖까지 행 배경 확장
              marginHorizontal: -s(16),
              paddingHorizontal: s(16),
              paddingVertical: s(14),
              backgroundColor: selected ? COLORS.primary50 : 'transparent',
            }}
            accessibilityRole="button"
            accessibilityLabel={`${palette.label} 선택`}
          >
            <View
              style={{
                width: s(8),
                height: s(8),
                borderRadius: s(4),
                backgroundColor: palette.color,
              }}
            />
            <Typography
              variant="body-02"
              weight={selected ? 'semibold' : 'medium'}
              className="flex-1 text-gray-800"
            >
              {palette.label}
            </Typography>
            {selected && (
              <Ionicons name="checkmark" size={18} color={COLORS.primary} />
            )}
          </TouchableOpacity>
        );
      })}
    </BottomSheet>
  );
}

/** 최초 진입 시 일정 처리 선택 시트 — "일정이 진행되었나요?" (완료/취소/노쇼) */
function SessionStatusSheet({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (next: 'completed' | 'cancelled' | 'no_show') => void;
}) {
  const options: {
    key: 'completed' | 'cancelled' | 'no_show';
    label: string;
    icon: React.ComponentProps<typeof Icon>['name'];
  }[] = [
    { key: 'completed', label: '완료', icon: 'complete-check-circle-20' },
    { key: 'cancelled', label: '취소', icon: 'cancel-red-circle-20' },
    { key: 'no_show', label: '노쇼', icon: 'warning-yellow-circle-20' },
  ];
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      {/* 헤더 — 가운데 타이틀 + 우측 닫기 */}
      <View
        style={{ justifyContent: 'center', marginBottom: s(16) }}
        className="flex-row items-center"
      >
        <Typography
          variant="title-01"
          weight="semibold"
          className="text-gray-900"
          style={{ textAlign: 'center' }}
        >
          일정이 진행되었나요?
        </Typography>
        <TouchableOpacity
          onPress={onClose}
          hitSlop={10}
          accessibilityLabel="닫기"
          accessibilityRole="button"
          style={{ position: 'absolute', right: 0 }}
        >
          <Ionicons name="close" size={24} color={COLORS.gray[500]} />
        </TouchableOpacity>
      </View>

      <View style={{ gap: s(10) }}>
        {options.map((opt) => (
          <TouchableOpacity
            key={opt.key}
            onPress={() => onSelect(opt.key)}
            activeOpacity={0.7}
            accessibilityLabel={`${opt.label} 선택`}
            accessibilityRole="button"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: s(8),
              height: s(56),
              borderRadius: s(12),
              backgroundColor: COLORS.gray[50],
            }}
          >
            <Icon name={opt.icon} size={20} />
            <Typography variant="body-02" weight="semibold" className="text-gray-900">
              {opt.label}
            </Typography>
          </TouchableOpacity>
        ))}
      </View>
    </BottomSheet>
  );
}

function ClientNoteCard({
  client,
  genderLabel,
  age,
  onOpenAttendance,
  onOpenNote,
  showAttendance = true,
  isGroup = false,
}: {
  client: SessionClientParticipant;
  genderLabel?: string | null;
  age?: number | null;
  /** undefined면 열람 전용 — 부담당(공동 상담사)은 출결을 바꿀 수 없다 */
  onOpenAttendance?: () => void;
  /** undefined면 열람 전용 — 상담일지는 주담당만 */
  onOpenNote?: () => void;
  /** 출결 배지 노출 여부 — 완료 회기에서만 true */
  showAttendance?: boolean;
  /** 그룹 회기 여부 — 개인은 출결 칩 미노출, 일지보기 단일 행 */
  isGroup?: boolean;
}) {
  const palette = ATTENDANCE_PALETTES[client.attendance_status];
  // 출결 칩은 그룹 회기에서만 노출 (개인은 회기 상태가 곧 출결이라 칩 삭제)
  const showChip = showAttendance && isGroup;

  const nameRow = (
    <View className="flex-row items-center" style={{ flex: 1, gap: s(6) }}>
      <Typography
        variant="body-02"
        weight="semibold"
        className="text-gray-900"
        numberOfLines={1}
        style={{ flexShrink: 1 }}
      >
        {client.participant_name}
      </Typography>
      <GenderAgeMeta genderLabel={genderLabel} age={age} />
    </View>
  );

  // 카드 전체 탭 → 상담일지 시트 (스펙 §3-2/§3-5: 내담자 카드 탭 → 상담일지 바텀시트).
  // 우측 일지 아이콘은 진입 affordance. 출결 칩은 중첩 Pressable이라 칩 탭은 카드 탭과 분리됨.
  // (개인은 showChip=false 라 칩 미노출 — 이름 + 일지 아이콘만)
  return (
    <Pressable
      onPress={onOpenNote}
      disabled={!onOpenNote}
      accessibilityRole="button"
      accessibilityLabel={`${client.participant_name} 상담일지 ${client.has_note ? '보기' : '작성'}`}
      style={{
        backgroundColor: COLORS.gray[50],
        borderRadius: s(12),
        height: s(56),
        paddingHorizontal: s(14),
        flexDirection: 'row',
        alignItems: 'center',
        gap: s(8),
      }}
    >
      {nameRow}
      {showChip && onOpenAttendance && (
        <AttendancePicker palette={palette} onPress={onOpenAttendance} />
      )}
      {onOpenNote && <Icon name="write-journal-20" size={20} />}
    </Pressable>
  );
}

function AttendancePicker({
  palette,
  onPress,
}: {
  palette: { label: string; color: string; bg: string };
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={{
        backgroundColor: palette.bg,
        paddingHorizontal: s(10),
        paddingVertical: s(4),
        borderRadius: s(14),
        flexDirection: 'row',
        alignItems: 'center',
        gap: s(4),
      }}
      accessibilityLabel={`출결 ${palette.label} 변경`}
      accessibilityRole="button"
    >
      <Typography
        variant="label-02"
        weight="semibold"
        style={{ color: palette.color }}
      >
        {palette.label}
      </Typography>
      <Ionicons name="chevron-down" size={10} color={palette.color} />
    </Pressable>
  );
}

/** 청구 버튼 배경 — mint @ 10% (#00C3BC + 1A), 디자인 시스템 외 지정값 (상담 상세 내담자 카드와 동일) */
const MINT_BG = '#00C3BC1A';

/**
 * 청구 액션 버튼 — 완료된 회기에서 결과 row 아래에 노출.
 * 상담 상세 내담자별 청구 버튼과 동일 스타일(mint 배경 + mint-charge 아이콘 + gray-600), 너비 전체.
 */
function BillingActionRow({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityLabel="청구서 발행"
      accessibilityRole="button"
      style={{
        width: '100%',
        height: s(44),
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: s(4),
        borderRadius: s(10),
        backgroundColor: MINT_BG,
      }}
    >
      <Icon name="mint-charge-16" size={16} />
      <Typography
        variant="body-03"
        weight="medium"
        style={{ color: COLORS.gray[600] }}
      >
        청구서 발행
      </Typography>
    </TouchableOpacity>
  );
}

/** 헤더 아바타 — 프로필 이미지(→ 이니셜 폴백) 원형 + 그룹 +N 뱃지 */
function HeaderAvatar({
  name,
  extraCount,
  imageUrl,
}: {
  name: string;
  extraCount: number;
  imageUrl?: string | null;
}) {
  const initial = name.trim().charAt(0) || '?';
  return (
    <View style={{ width: s(36), height: s(36) }}>
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={{
            width: s(36),
            height: s(36),
            borderRadius: s(18),
            backgroundColor: COLORS.gray[100],
          }}
        />
      ) : (
        <View
          style={{
            width: s(36),
            height: s(36),
            borderRadius: s(18),
            backgroundColor: COLORS.gray[100],
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography variant="body-02" weight="semibold" style={{ color: COLORS.gray[500] }}>
            {initial}
          </Typography>
        </View>
      )}
      {extraCount > 0 && (
        <View
          style={{
            position: 'absolute',
            right: -s(4),
            bottom: -s(4),
            minWidth: s(20),
            height: s(20),
            paddingHorizontal: s(4),
            borderRadius: s(10),
            backgroundColor: COLORS.primary50,
            borderWidth: 1,
            borderColor: COLORS.primary100,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography variant="caption-01" weight="regular" style={{ color: '#4486FF' }}>
            +{extraCount}
          </Typography>
        </View>
      )}
    </View>
  );
}

/** 회기 정보 라벨-값 행 — 아이콘 + 고정폭 라벨 + 값 */
function InfoLabelRow({
  icon,
  label,
  value,
  multiline = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  /** true면 값이 잘리지 않고 줄바꿈되어 전부 노출 (예: 그룹 내담자 다수) */
  multiline?: boolean;
}) {
  return (
    <View
      className="flex-row"
      style={{ gap: s(12), alignItems: multiline ? 'flex-start' : 'center' }}
    >
      {/* 아이콘 + 레이블 — 프레임 폭 60, 내부 간격 4 (레이블↔값은 바깥 gap 12) */}
      <View className="flex-row items-center" style={{ width: s(60), gap: s(4) }}>
        {icon}
        <Typography
          variant="body-02"
          weight="regular"
          style={{ color: COLORS.gray[600] }}
        >
          {label}
        </Typography>
      </View>
      <Typography
        variant="body-02"
        weight="regular"
        className="flex-1 text-gray-900"
        numberOfLines={multiline ? undefined : 1}
      >
        {value}
      </Typography>
    </View>
  );
}

function SessionInfoHeader({
  session,
  caseClients,
  programName,
  caseSubtitle,
  dateLabel,
  timeLabel,
  roomName,
}: {
  session: CounselingSessionDetail;
  caseClients: {
    client_id: string;
    name: string;
    gender: string | null;
    age: number | null;
    profile_image_url?: string | null;
  }[];
  programName: string;
  caseSubtitle: string | null;
  dateLabel: string;
  timeLabel: string;
  roomName: string | null;
}) {
  const sessionClients = session.clients;
  const is1on1 = sessionClients.length === 1;
  const isGroup = sessionClients.length > 1;
  const firstClient = sessionClients[0];
  const titleText = firstClient
    ? is1on1
      ? firstClient.participant_name
      : `${firstClient.participant_name} 외 ${sessionClients.length - 1}명`
    : '회기';
  const extraCount = Math.max(0, sessionClients.length - 1);

  // 1:1 — 성별·나이 subtitle (성별/나이를 분리해 사이에 구분선 렌더)
  const caseClientMap = new Map(caseClients.map((c) => [c.client_id, c]));
  const subtitleMeta = (() => {
    if (!is1on1 || !firstClient) return null;
    const cc = caseClientMap.get(firstClient.participant_id);
    const genderLabel = cc?.gender ? GENDER_LABELS[cc.gender] ?? cc.gender : null;
    const age = cc?.age ?? null;
    if (!genderLabel && age == null) return null;
    return { genderLabel, age };
  })();

  // group — 이름 inline list (쉼표 구분)
  const groupNamesText = isGroup
    ? sessionClients.map((c) => c.participant_name).join(', ')
    : null;

  // 첫 내담자 프로필 이미지 (case 내담자에서 매칭)
  const heroImageUrl = firstClient
    ? caseClientMap.get(firstClient.participant_id)?.profile_image_url ?? null
    : null;

  return (
    <View>
      {/* 케이스 코드 — 최상단 caption (아바타와 12) */}
      {caseSubtitle && (
        <Typography
          variant="label-01"
          weight="regular"
          numberOfLines={1}
          style={{ color: COLORS.gray[500], marginBottom: s(12) }}
        >
          {caseSubtitle}
        </Typography>
      )}

      {/* 아바타 + 이름 + 성별·나이 */}
      <View className="flex-row items-center" style={{ gap: s(10) }}>
        <HeaderAvatar
          name={firstClient?.participant_name ?? '회'}
          extraCount={extraCount}
          imageUrl={heroImageUrl}
        />
        <View
          className="flex-row items-center"
          style={{ flex: 1, gap: s(6), flexWrap: 'wrap' }}
        >
          <Typography
            variant="title-01"
            weight="semibold"
            numberOfLines={1}
            style={{ color: COLORS.gray[900] }}
          >
            {titleText}
          </Typography>
          {is1on1 && subtitleMeta && (
            <GenderAgeMeta
              genderLabel={subtitleMeta.genderLabel}
              age={subtitleMeta.age}
              size="lg"
            />
          )}
        </View>
      </View>

      {/* 프로그램 — 프로필과 16 */}
      {programName && (
        <Typography
          variant="body-01"
          weight="semibold"
          className="text-gray-900"
          numberOfLines={1}
          style={{ marginTop: s(16) }}
        >
          {programName}
        </Typography>
      )}

      {/* 라벨-값 행 — 일정 / 장소 / 내담자(그룹). 프로그램과 8, 행 사이 4 */}
      <View style={{ gap: s(4), marginTop: s(8) }}>
        <InfoLabelRow
          icon={<Icon name="time-20" size={20} color={COLORS.icon.tertiary} />}
          label="일정"
          value={`${dateLabel} ${timeLabel}`}
        />
        {roomName && (
          <InfoLabelRow
            icon={<Icon name="location-20" size={20} color={COLORS.icon.tertiary} />}
            label="장소"
            value={roomName}
          />
        )}
        {isGroup && groupNamesText && (
          <InfoLabelRow
            icon={<Icon name="people-20" size={20} color={COLORS.icon.tertiary} />}
            label="내담자"
            value={groupNamesText}
            multiline
          />
        )}
      </View>
    </View>
  );
}

function InfoLine({
  iconName,
  text,
}: {
  iconName: 'time' | 'location-16';
  text: string;
}) {
  return (
    <View className="flex-row items-center" style={{ gap: s(6) }}>
      <Icon name={iconName} size={18} color={COLORS.gray[500]} />
      <Typography variant="body-02" weight="medium" className="text-gray-700">
        {text}
      </Typography>
    </View>
  );
}

function InfoChip({
  iconName,
  text,
}: {
  iconName: 'calendar-16' | 'location-16';
  text: string;
}) {
  return (
    <View
      className="flex-row items-center"
      style={{
        backgroundColor: COLORS.gray[50],
        borderRadius: s(999),
        paddingHorizontal: s(10),
        paddingVertical: s(6),
        gap: s(4),
      }}
    >
      <Icon name={iconName} size={14} color={COLORS.gray[500]} />
      <Typography variant="label-01" weight="medium" className="text-gray-700">
        {text}
      </Typography>
    </View>
  );
}

function FieldnoteEmptyDashed({ onPressConnect }: { onPressConnect: () => void }) {
  return (
    <View
      style={{
        backgroundColor: COLORS.gray[50],
        borderRadius: s(16),
        paddingHorizontal: s(16),
        paddingVertical: s(20),
        gap: s(16),
      }}
    >
      <View style={{ gap: s(2), alignItems: 'center' }}>
        <Typography
          variant="body-03"
          weight="medium"
          className="text-gray-700"
        >
          이 회기에 연결된 필드노트가 없어요
        </Typography>
        <Typography variant="body-03" className="text-gray-500">
          지금 녹음하거나 기존 노트를 연결하세요
        </Typography>
      </View>
      <View className="flex-row" style={{ gap: s(8) }}>
        <FieldnoteEmptyButton
          icon="mic-outline"
          label="녹음하기"
          onPress={() => {
            // TODO: 필드노트 녹음 시작
          }}
        />
        <FieldnoteEmptyButton
          icon="link-outline"
          label="연결하기"
          onPress={onPressConnect}
        />
      </View>
    </View>
  );
}

function FieldnoteEmptyButton({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        flex: 1,
        height: s(38),
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: COLORS.gray[300],
        borderRadius: s(10),
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: s(6),
      }}
      accessibilityLabel={label}
      accessibilityRole="button"
    >
      <Ionicons name={icon} size={16} color={COLORS.gray[500]} />
      <Typography variant="body-03" weight="medium" className="text-gray-500">
        {label}
      </Typography>
    </TouchableOpacity>
  );
}

/** 섹션 빈/비활성 상태 박스 — gray-50 면에 아이콘 + 안내문구 중앙 정렬.
 *  필드노트·상담일지의 안내(녹음 전·취소 회기 등)에 공통 사용. */
function DisabledSectionBox({
  icon,
  iconNode,
  text,
}: {
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  /** 커스텀 아이콘(커스텀 SVG 등). 주면 Ionicons 대신 렌더 */
  iconNode?: ReactNode;
  text: string;
}) {
  return (
    <View
      style={{
        backgroundColor: COLORS.gray[50],
        borderRadius: s(16),
        paddingVertical: s(28),
        paddingHorizontal: s(16),
        alignItems: 'center',
        gap: s(12),
      }}
    >
      {/* 필드노트 고스트 아이콘 — icon/tertiary(gray-300). 텍스트(gray-400)보다 한 톤 연하게 */}
      {iconNode ?? (icon ? <Ionicons name={icon} size={s(30)} color={COLORS.gray[300]} /> : null)}
      {/* 색은 inline style로 강제 — Typography 기본색(text-text #191919)이
          className override를 이겨 진하게 찍히는 NativeWind 충돌 회피 */}
      <Typography variant="body-03" style={{ color: COLORS.gray[400], textAlign: 'center' }}>
        {text}
      </Typography>
    </View>
  );
}

function EmptyStateBox({ text }: { text: string }) {
  return (
    <View
      style={{
        backgroundColor: COLORS.gray[50],
        borderRadius: s(12),
        paddingHorizontal: s(14),
        paddingVertical: s(20),
      }}
    >
      <Typography variant="body-03" className="text-center text-gray-300">
        {text}
      </Typography>
    </View>
  );
}

function SectionBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: s(10) }}>
      <Typography variant="title-01" weight="semibold" className="text-gray-900">
        {title}
      </Typography>
      {children}
    </View>
  );
}

function SubBlock({
  label,
  rightAction,
  children,
}: {
  label: string;
  rightAction?: { label: string; onPress: () => void };
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: s(6) }}>
      <View className="flex-row items-center" style={{ gap: s(8) }}>
        <Typography
          variant="label-01"
          weight="semibold"
          className="text-gray-700 flex-1"
        >
          {label}
        </Typography>
        {rightAction && (
          <TouchableOpacity
            onPress={rightAction.onPress}
            hitSlop={6}
            activeOpacity={0.7}
          >
            <View className="flex-row items-center" style={{ gap: s(4) }}>
              <Ionicons
                name="create-outline"
                size={12}
                color={COLORS.primary700}
              />
              <Typography
                variant="label-02"
                weight="semibold"
                style={{ color: COLORS.primary700 }}
              >
                {rightAction.label}
              </Typography>
            </View>
          </TouchableOpacity>
        )}
      </View>
      {children}
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center">
      <Typography
        variant="body-03"
        className="text-gray-500"
        style={{ width: s(56) }}
      >
        {label}
      </Typography>
      <Typography
        variant="body-02"
        weight="medium"
        className="flex-1 text-right text-gray-900"
      >
        {value}
      </Typography>
    </View>
  );
}

function FooterButton({
  label,
  tone,
  onPress,
  disabled,
}: {
  label: string;
  tone: 'primary' | 'primary-subtle' | 'secondary';
  onPress: () => void;
  disabled?: boolean;
}) {
  // 디자인 시스템 button/* 컴포넌트 토큰 사용
  const palette =
    tone === 'primary'
      ? {
          bg: COLORS.button.primary['bg-default'],
          text: COLORS.button.primary['text-default'],
        }
      : tone === 'primary-subtle'
        ? {
            bg: COLORS.button.secondary['bg-default'],
            text: COLORS.button.secondary['text-default'],
          }
        : {
            bg: COLORS.button.assistive['bg-default'],
            text: COLORS.button.assistive['text-default'],
          };
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      style={{
        height: s(52),
        borderRadius: s(12),
        backgroundColor: palette.bg,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Typography
        variant="body-02"
        weight="semibold"
        style={{ color: palette.text }}
      >
        {label}
      </Typography>
    </TouchableOpacity>
  );
}

/**
 * 회기 상태 뱃지 — 일정 카드(ScheduleItem)의 StatusBadge와 시각·색·아이콘 1:1 동일.
 * 회기 상태는 API를 통해 같은 데이터 소스이므로 변경 시 일정 카드에도 자동 반영
 * (useUpdateSessionStatus / useRevertCancelSession onSuccess에서 `schedule(s)` 캐시 invalidate).
 */
function SessionStatusBadge({ status }: { status: string }) {
  const config =
    status === 'completed'
      ? {
          bg: '#84B5221A',
          text: '#84B522',
          label: '완료',
        }
      : status === 'cancelled'
        ? {
            bg: '#FFE8E8',
            text: COLORS.negative,
            label: '취소',
          }
        : status === 'no_show'
          ? {
              bg: 'rgba(244,117,0,0.08)',
              text: '#F47500',
              label: '노쇼',
            }
          : {
              bg: COLORS.statusBadge.scheduled.bg,
              text: COLORS.statusBadge.scheduled.text,
              label: '예정',
            };
  return (
    <BadgeRound bg={config.bg} color={config.text}>
      {config.label}
    </BadgeRound>
  );
}
