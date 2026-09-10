import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import RNAnimated, {
  FadeInDown,
  FadeInUp,
  FadeOutDown,
  FadeOutUp,
} from 'react-native-reanimated';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { BottomSheet } from '@/shared/components/ui/BottomSheet';
import { ConfirmModal } from '@/shared/components/ui/ConfirmModal';
import { Typography } from '@/shared/components/ui/Typography';
import { GenderAgeMeta } from '@/shared/components/ui/GenderAgeMeta';
import { Icon } from '@/shared/components/icons';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';
import { parseDate, formatTimeRange } from '@/shared/utils/date';
import { GENDER_LABELS } from '@/features/client';
import { useNotesBySession } from '@/features/counseling/note';
import type { CounselingNoteResponse } from '@/features/counseling/note';
import {
  useSessionParticipants,
  useSessionDetail,
  useUpdateAttendance,
  useUpdateSessionStatus,
  useRevertCancelSession,
  updateParticipantAttendance,
  ATTENDANCE_STATUS_LABELS,
  ATTENDANCE_STATUS_COLORS,
  NoShowReasonModal,
  type AttendanceStatus,
  type NoShowReasonResult,
  type SessionParticipantResponse,
} from '@/features/counseling/session';
import {
  useBillablesByRelated,
  resolveBillingState,
  type BillableSummary,
  type BillingActionState,
} from '@/features/billing';
import { usePermission } from '@/features/center';

const SESSION_VIEW_MAX_HEIGHT = 540;

interface SessionDetailSheetProps {
  visible: boolean;
  onClose: () => void;
  centerId: string | null;
  sessionId: string;
  sessionStart: string;
  sessionEnd: string;
  roomName: string | null;
  programName: string;
  counselorNames: string[];
  /** 내담자 카드 탭 시 부모에서 상담일지 시트를 띄우는 콜백. */
  onOpenNote: (client: { clientId: string; name: string }) => void;
  /** 청구 prefill 조회용 케이스 ID */
  caseId: string;
  /** 내담자 청구 배지 탭 시 부모에서 발행/상세 시트를 띄우는 콜백. */
  onOpenBilling: (params: {
    clientId: string;
    clientName: string;
    billableId?: string;
    state: BillingActionState;
  }) => void;
}

const ATTENDANCE_PALETTE: Record<
  AttendanceStatus,
  { color: string; bg: string }
> = {
  attended: { color: COLORS.palette.green, bg: COLORS.paletteBg.green },
  absent: { color: COLORS.palette.red, bg: COLORS.paletteBg.red },
  late: { color: COLORS.palette.yellow, bg: COLORS.paletteBg.yellow },
  excused: { color: COLORS.palette.blue, bg: COLORS.paletteBg.blue },
  scheduled: { color: COLORS.palette.gray, bg: COLORS.paletteBg.gray },
  no_show: { color: COLORS.palette.orange, bg: COLORS.paletteBg.orange },
};

const UNCONFIRMED_LABEL = '미확인';

/** 칩 드롭다운에서 빠르게 토글할 출석 옵션 (참석/불참/노쇼 3개). */
const DROPDOWN_OPTIONS: { value: AttendanceStatus; label: string }[] = [
  { value: 'attended', label: '참석' },
  { value: 'absent', label: '불참' },
  { value: 'no_show', label: '노쇼' },
];
const DROPDOWN_ESTIMATED_HEIGHT = 6 + 36 * DROPDOWN_OPTIONS.length + 6; // padY*2 + rows

function formatTitleDate(value: string): string {
  try {
    return format(parseDate(value), 'yyyy-MM-dd (E)', { locale: ko });
  } catch {
    return value;
  }
}

function formatScheduleLine(start: string, end: string): string {
  try {
    const date = format(parseDate(start), 'yyyy-MM-dd (E)', { locale: ko });
    return `${date} ${formatTimeRange(start, end)}`;
  } catch {
    return start;
  }
}

export function SessionDetailSheet({
  visible,
  onClose,
  centerId,
  sessionId,
  sessionStart,
  sessionEnd,
  roomName,
  programName,
  counselorNames,
  onOpenNote,
  caseId,
  onOpenBilling,
}: SessionDetailSheetProps) {
  const [confirmAction, setConfirmAction] = useState<
    'completed' | 'cancelled' | 'revert' | null
  >(null);
  const [isProcessing, setIsProcessing] = useState(false);
  // 노쇼 사유 모달 — 'no_show' 선택 시 띄움. participantId가 있으면 활성.
  const [noShowTarget, setNoShowTarget] = useState<{
    participantId: string;
    initialNote: string;
    initialIsConsumed: boolean;
  } | null>(null);

  // 시트 닫힐 때 내부 상태 초기화
  useEffect(() => {
    if (!visible) {
      setConfirmAction(null);
      setIsProcessing(false);
      setNoShowTarget(null);
    }
  }, [visible]);

  const { data: participants, isLoading } = useSessionParticipants(
    centerId,
    visible ? sessionId : null,
  );
  const { data: notes } = useNotesBySession(
    centerId,
    visible ? sessionId : null,
  );
  const { data: sessionDetail } = useSessionDetail(
    centerId,
    visible ? sessionId : null,
  );
  // 세션 단건 청구 조회
  const { data: sessionBillables } = useBillablesByRelated({
    centerId,
    relatedType: 'counseling_session',
    relatedSessionId: visible ? sessionId : null,
  });
  // 케이스 패키지 선결제 조회 (패키지 완료 내담자는 "선결제 완료"로 표시)
  const { data: caseBillables } = useBillablesByRelated({
    centerId,
    relatedType: 'counseling_case',
    relatedCaseId: visible ? caseId : null,
  });
  // client_id → 청구 ���핑. 세션 단건이 있으면 세션, 없으면 패키지(케이스) 참조
  const billingMap = useMemo(() => {
    const m = new Map<string, BillableSummary>();
    caseBillables?.forEach((b) => m.set(b.client_id, b));
    sessionBillables?.forEach((b) => m.set(b.client_id, b));
    return m;
  }, [sessionBillables, caseBillables]);
  const updateAttendance = useUpdateAttendance(centerId, sessionId);
  const updateStatus = useUpdateSessionStatus(centerId, sessionId);
  const revertSession = useRevertCancelSession(centerId, sessionId);

  const isCancelled = sessionDetail?.status === 'cancelled';

  // clientId → 노트 객체 맵 (참여자 카드의 hasNote 판단용)
  const noteMap = useMemo(() => {
    const map = new Map<string, CounselingNoteResponse>();
    notes?.forEach((n) => map.set(n.client_id, n));
    return map;
  }, [notes]);

  const clientParticipants = useMemo(() => {
    const list =
      participants?.filter((p) => p.participant_type === 'client') ?? [];
    // 출결 변경 시 서버 응답 순서가 바뀌어도 UI 순서가 흔들리지 않도록
    // 이름(한국어 로케일) → id 순으로 안정 정렬.
    return [...list].sort((a, b) => {
      const nameA = a.participant_name ?? '';
      const nameB = b.participant_name ?? '';
      const byName = nameA.localeCompare(nameB, 'ko');
      if (byName !== 0) return byName;
      return a.id.localeCompare(b.id);
    });
  }, [participants]);

  const handleSelectAttendance = useCallback(
    (participantId: string, status: AttendanceStatus) => {
      // 노쇼는 사유·회기 차감 입력이 필요하므로 모달을 먼저 띄운다.
      if (status === 'no_show') {
        const target = participants?.find((p) => p.id === participantId);
        setNoShowTarget({
          participantId,
          initialNote: target?.note ?? '',
          initialIsConsumed: target?.is_consumed ?? false,
        });
        return;
      }
      updateAttendance.mutate({
        participantId,
        data: { attendance_status: status },
      });
    },
    [updateAttendance, participants],
  );

  const handleConfirmNoShow = useCallback(
    (result: NoShowReasonResult) => {
      if (!noShowTarget) return;
      updateAttendance.mutate({
        participantId: noShowTarget.participantId,
        data: {
          attendance_status: 'no_show',
          note: result.note ? result.note : null,
          is_consumed: result.isConsumed,
        },
      });
      setNoShowTarget(null);
    },
    [noShowTarget, updateAttendance],
  );

  // 내담자 카드 탭 → 부모가 별도 상담일지 시트 띄움 (시트 안 시트 morph 방지)
  const handleClientPress = useCallback(
    (participant: SessionParticipantResponse) => {
      onOpenNote({
        clientId: participant.participant_id,
        name: participant.participant_name ?? '내담자',
      });
    },
    [onOpenNote],
  );

  const handleConfirmAction = useCallback(async () => {
    if (!confirmAction || !centerId || isProcessing) return;
    const action = confirmAction;
    setIsProcessing(true);
    try {
      if (action === 'revert') {
        // 웹 구조와 동일: 세션 상태만 'scheduled'로 복구.
        // 참여자 출결은 취소 직전 상태 그대로 유지 (백엔드 PATCH가 'scheduled' 값 미허용).
        await revertSession.mutateAsync();
      } else {
        // 미확인(scheduled) 참여자만 일괄 변경
        const nextAttendance: AttendanceStatus =
          action === 'completed' ? 'attended' : 'absent';
        const scheduled = clientParticipants.filter(
          (p) => p.attendance_status === 'scheduled',
        );
        if (scheduled.length > 0) {
          await Promise.all(
            scheduled.map((p) =>
              updateParticipantAttendance(centerId, p.id, {
                attendance_status: nextAttendance,
              }),
            ),
          );
        }
        await updateStatus.mutateAsync(action);
      }
      setConfirmAction(null);
    } catch {
      Alert.alert('오류', '처리 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
    }
  }, [
    confirmAction,
    centerId,
    clientParticipants,
    isProcessing,
    updateStatus,
    revertSession,
  ]);

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      {/* 헤더 — 회기 단일 view */}
      <View className="mb-[26px] flex-row items-center justify-between">
        <View style={{ width: 24 }} />
        <Typography variant="title-01" weight="semibold" className="text-gray-900">
          {formatTitleDate(sessionStart)}
        </Typography>
        <TouchableOpacity
          onPress={onClose}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          accessibilityLabel="닫기"
          accessibilityRole="button"
        >
          <Ionicons name="close" size={24} color={COLORS.gray[700]} />
        </TouchableOpacity>
      </View>

      <SessionView
        maxHeight={SESSION_VIEW_MAX_HEIGHT}
        isLoading={isLoading}
        clientParticipants={clientParticipants}
        noteMap={noteMap}
        programName={programName}
        counselorNames={counselorNames}
        sessionStart={sessionStart}
        sessionEnd={sessionEnd}
        roomName={roomName}
        isCancelled={isCancelled}
        billingMap={billingMap}
        onOpenBilling={onOpenBilling}
        onClientPress={handleClientPress}
        onSelectAttendance={handleSelectAttendance}
        onRequestComplete={() => setConfirmAction('completed')}
        onRequestCancel={() => setConfirmAction('cancelled')}
        onRequestRevert={() => setConfirmAction('revert')}
      />

      <NoShowReasonModal
        visible={noShowTarget !== null}
        initialNote={noShowTarget?.initialNote ?? ''}
        initialIsConsumed={noShowTarget?.initialIsConsumed ?? false}
        onConfirm={handleConfirmNoShow}
        onCancel={() => setNoShowTarget(null)}
      />

      <ConfirmModal
        visible={confirmAction !== null}
        title={
          confirmAction === 'completed'
            ? '회기를 완료할까요?'
            : confirmAction === 'cancelled'
              ? '회기를 취소할까요?'
              : '회기를 예정 상태로 되돌릴까요?'
        }
        message={
          confirmAction === 'completed'
            ? "미확인 내담자의 출결이 '참석'으로 변경돼요.\n회기를 완료할까요?"
            : confirmAction === 'cancelled'
              ? "미확인 내담자의 출결이 '불참'으로 변경돼요.\n그래도 회기를 취소할까요?"
              : '회기가 다시 예정 상태로 복구돼요.\n내담자 출결은 취소 직전 상태로 유지됩니다.'
        }
        cancelLabel="닫기"
        confirmLabel={
          confirmAction === 'completed'
            ? '완료'
            : confirmAction === 'cancelled'
              ? '취소'
              : '되돌리기'
        }
        destructive={confirmAction === 'cancelled'}
        onConfirm={handleConfirmAction}
        onCancel={() => {
          if (isProcessing) return;
          setConfirmAction(null);
        }}
      />
    </BottomSheet>
  );
}

// ─── Session View (기본) ───

interface SessionViewProps {
  maxHeight: number;
  isLoading: boolean;
  clientParticipants: SessionParticipantResponse[];
  noteMap: Map<string, CounselingNoteResponse>;
  programName: string;
  counselorNames: string[];
  sessionStart: string;
  sessionEnd: string;
  roomName: string | null;
  isCancelled: boolean;
  billingMap: Map<string, BillableSummary>;
  onOpenBilling: (params: {
    clientId: string;
    clientName: string;
    billableId?: string;
    state: BillingActionState;
  }) => void;
  onClientPress: (p: SessionParticipantResponse) => void;
  onSelectAttendance: (participantId: string, status: AttendanceStatus) => void;
  onRequestComplete: () => void;
  onRequestCancel: () => void;
  onRequestRevert: () => void;
}

function SessionView({
  maxHeight,
  isLoading,
  clientParticipants,
  noteMap,
  programName,
  counselorNames,
  sessionStart,
  sessionEnd,
  roomName,
  isCancelled,
  billingMap,
  onOpenBilling,
  onClientPress,
  onSelectAttendance,
  onRequestComplete,
  onRequestCancel,
  onRequestRevert,
}: SessionViewProps) {
  const { can } = usePermission();
  const canBilling = can('read:billing') || can('write:billing');
  // 한 번에 하나의 참여자 드롭다운만 열림
  const [openParticipantId, setOpenParticipantId] = useState<string | null>(
    null,
  );
  // ScrollView 바닥의 화면상 Y 좌표. 드롭다운이 푸터(취소/완료)를 침범하지 않도록
  // 칩 아래 가용 공간을 ScrollView 바닥까지로 한정.
  const scrollContainerRef = useRef<View>(null);
  const [scrollBottomY, setScrollBottomY] = useState<number>(0);
  const handleScrollContainerLayout = useCallback(() => {
    scrollContainerRef.current?.measureInWindow((_x, y, _w, h) => {
      setScrollBottomY(y + h);
    });
  }, []);
  return (
    <>
      <View
        ref={scrollContainerRef}
        onLayout={handleScrollContainerLayout}
      >
        <ScrollView
          style={{ maxHeight }}
          showsVerticalScrollIndicator={false}
          onScrollBeginDrag={() => setOpenParticipantId(null)}
        >
        {isCancelled && (
          <View className="mb-3 flex-row items-center">
            <Ionicons
              name="alert-circle"
              size={16}
              color={COLORS.error}
              style={{ marginRight: 4 }}
            />
            <Typography
              variant="body-03"
              weight="medium"
              style={{ color: COLORS.error }}
            >
              취소된 회기입니다
            </Typography>
          </View>
        )}
        {/* 일정 정보 카드 */}
        <View className="mb-4 rounded-2xl bg-gray-50 px-4 py-3">
          <InfoRow
            label="일정"
            value={formatScheduleLine(sessionStart, sessionEnd)}
            secondaryValue={roomName ?? undefined}
          />
          <InfoRow label="프로그램" value={programName || '-'} />
          <InfoRow label="담당자" value={counselorNames.join(', ') || '-'} />
        </View>

        {/* 내담자 */}
        <Typography
          variant="body-02"
          weight="semibold"
          className="mb-2 text-gray-900"
        >
          내담자
        </Typography>

        {isLoading ? (
          <View className="items-center py-6">
            <ActivityIndicator size="small" color={COLORS.primary} />
          </View>
        ) : clientParticipants.length === 0 ? (
          <Typography variant="body-03" className="py-3 text-gray-400">
            등록된 참여자가 없습니다.
          </Typography>
        ) : (
          <View className="gap-2">
            {clientParticipants.map((participant) => (
              <ParticipantCard
                key={participant.id}
                participant={participant}
                hasNote={noteMap.has(participant.participant_id)}
                isDropdownOpen={openParticipantId === participant.id}
                scrollBottomY={scrollBottomY}
                billingState={resolveBillingState(
                  billingMap.get(participant.participant_id),
                )}
                isPackageBilling={
                  billingMap.get(participant.participant_id)?.is_package ?? false
                }
                showBilling={!isCancelled && canBilling}
                onPressBilling={() => {
                  const b = billingMap.get(participant.participant_id);
                  onOpenBilling({
                    clientId: participant.participant_id,
                    clientName: participant.participant_name ?? '내담자',
                    billableId: b?.id,
                    state: resolveBillingState(b),
                  });
                }}
                onCardPress={() => onClientPress(participant)}
                onChipPress={() =>
                  setOpenParticipantId((prev) =>
                    prev === participant.id ? null : participant.id,
                  )
                }
                onSelectAttendance={(status) => {
                  onSelectAttendance(participant.id, status);
                  setOpenParticipantId(null);
                }}
              />
            ))}
          </View>
        )}
        </ScrollView>
      </View>

      {/* 푸터 버튼 */}
      {isCancelled ? (
        <View className="mt-5">
          <TouchableOpacity
            onPress={onRequestRevert}
            activeOpacity={0.7}
            className="items-center justify-center rounded-md bg-gray-100 py-3.5"
            accessibilityLabel="예정으로 되돌리기"
            accessibilityRole="button"
          >
            <Typography
              variant="body-02"
              weight="semibold"
              className="text-gray-800"
            >
              예정으로 되돌리기
            </Typography>
          </TouchableOpacity>
        </View>
      ) : (
        <View className="mt-5 flex-row gap-2">
          <TouchableOpacity
            onPress={onRequestCancel}
            activeOpacity={0.7}
            className="flex-1 items-center justify-center rounded-md border border-error/20 py-3.5"
            accessibilityLabel="회기 취소"
            accessibilityRole="button"
          >
            <Typography
              variant="body-02"
              weight="semibold"
              style={{ color: COLORS.error }}
            >
              회기 취소
            </Typography>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onRequestComplete}
            activeOpacity={0.7}
            className="flex-1 items-center justify-center rounded-md border border-transparent bg-primary py-3.5"
            accessibilityLabel="회기 완료"
            accessibilityRole="button"
          >
            <Typography
              variant="body-02"
              weight="semibold"
              className="text-white"
            >
              회기 완료
            </Typography>
          </TouchableOpacity>
        </View>
      )}
    </>
  );
}

// ─── 공통 ───

function InfoRow({
  label,
  value,
  secondaryValue,
}: {
  label: string;
  value: string;
  secondaryValue?: string;
}) {
  return (
    <View className="flex-row py-1">
      <Typography variant="label-01" className="w-[64px] text-gray-500">
        {label}
      </Typography>
      <View className="flex-1">
        <Typography variant="label-01" weight="medium" className="text-gray-900">
          {value}
        </Typography>
        {secondaryValue && (
          <Typography variant="label-01" weight="medium" className="text-gray-900">
            {secondaryValue}
          </Typography>
        )}
      </View>
    </View>
  );
}

function ParticipantCard({
  participant,
  hasNote,
  isDropdownOpen,
  scrollBottomY,
  billingState,
  isPackageBilling,
  showBilling,
  onPressBilling,
  onCardPress,
  onChipPress,
  onSelectAttendance,
}: {
  participant: SessionParticipantResponse;
  hasNote: boolean;
  isDropdownOpen: boolean;
  scrollBottomY: number;
  billingState: BillingActionState;
  isPackageBilling: boolean;
  showBilling: boolean;
  onPressBilling: () => void;
  onCardPress: () => void;
  onChipPress: () => void;
  onSelectAttendance: (status: AttendanceStatus) => void;
}) {
  const name = participant.participant_name ?? '-';
  const genderLabel = participant.gender
    ? GENDER_LABELS[participant.gender] ?? participant.gender
    : null;
  const age = useMemo(() => {
    if (!participant.birth_date) return null;
    try {
      const birth = parseDate(participant.birth_date);
      const now = new Date();
      let years = now.getFullYear() - birth.getFullYear();
      const m = now.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) years--;
      return years;
    } catch {
      return null;
    }
  }, [participant.birth_date]);

  const status = participant.attendance_status as AttendanceStatus;
  const palette = ATTENDANCE_PALETTE[status] ?? ATTENDANCE_PALETTE.scheduled;
  const isUnconfirmed = status === 'scheduled';
  const statusLabel = isUnconfirmed
    ? UNCONFIRMED_LABEL
    : ATTENDANCE_STATUS_LABELS[status] ?? status;

  // 드롭다운이 칩 아래 공간이 부족하면 위로 열리도록 방향을 결정.
  const chipRef = useRef<View>(null);
  const [dropdownDirection, setDropdownDirection] = useState<'up' | 'down'>(
    'down',
  );

  const handleChipPress = useCallback(() => {
    if (isDropdownOpen) {
      onChipPress();
      return;
    }
    chipRef.current?.measureInWindow((_x, y, _w, h) => {
      // ScrollView 바닥 기준으로 가용 공간 계산 (푸터 침범 방지).
      // 측정 전(scrollBottomY=0)이면 화면 높이로 폴백.
      const bottomBoundary =
        scrollBottomY > 0 ? scrollBottomY : Dimensions.get('window').height;
      const spaceBelow = bottomBoundary - (y + h);
      setDropdownDirection(
        spaceBelow < DROPDOWN_ESTIMATED_HEIGHT + 12 ? 'up' : 'down',
      );
      onChipPress();
    });
  }, [isDropdownOpen, onChipPress, scrollBottomY]);

  return (
    <View
      style={{
        zIndex: isDropdownOpen ? 100 : 1,
        backgroundColor: hasNote ? COLORS.white : COLORS.primary50,
        borderWidth: 1,
        borderStyle: hasNote ? 'solid' : 'dashed',
        borderColor: hasNote ? COLORS.gray[100] : COLORS.primary300,
      }}
      className="rounded-2xl px-3 py-3"
    >
      <View className="flex-row items-center">
      <TouchableOpacity
        onPress={onCardPress}
        activeOpacity={0.7}
        accessibilityLabel={`${name} 상담일지 보기`}
        accessibilityRole="button"
        className="flex-1 flex-row items-center"
      >
        <View
          style={{
            backgroundColor: hasNote ? COLORS.gray[100] : COLORS.white,
          }}
          className="mr-2 h-7 w-7 items-center justify-center rounded-full"
        >
          <Ionicons name="person" size={14} color={COLORS.gray[400]} />
        </View>
        <View className="flex-1">
          <View className="flex-row items-center">
            <Typography variant="body-02" weight="semibold" className="text-gray-900">
              {name}
            </Typography>
            {(genderLabel || age != null) && (
              <View style={{ marginLeft: s(6) }}>
                <GenderAgeMeta genderLabel={genderLabel} age={age} />
              </View>
            )}
          </View>
          {/* 일지 라인 — 미작성/작성됨 상태별 시각 차별화 */}
          <View className="mt-1 flex-row items-center">
            {hasNote ? (
              <>
                <Icon
                  name="counseling-note-16"
                  size={14}
                  color={COLORS.gray[500]}
                />
                <Typography
                  variant="label-01"
                  weight="medium"
                  className="ml-1 text-gray-600"
                >
                  일지 보기
                </Typography>
              </>
            ) : (
              <>
                <Ionicons
                  name="create-outline"
                  size={14}
                  color={COLORS.primary700}
                />
                <Typography
                  variant="label-01"
                  weight="semibold"
                  style={{ color: COLORS.primary700 }}
                  className="ml-1"
                >
                  일지 작성하기
                </Typography>
                <Ionicons
                  name="chevron-forward"
                  size={12}
                  color={COLORS.primary700}
                  style={{ marginLeft: 2 }}
                />
              </>
            )}
          </View>
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        ref={chipRef}
        onPress={handleChipPress}
        activeOpacity={0.7}
        style={{ backgroundColor: palette.bg }}
        className="ml-2 flex-row items-center rounded-full px-3 py-1.5"
        accessibilityLabel={`출석 상태: ${statusLabel}, 변경하기`}
        accessibilityRole="button"
      >
        <Typography
          variant="label-01"
          weight="semibold"
          style={{ color: palette.color }}
        >
          {statusLabel}
        </Typography>
        <Ionicons
          name={isDropdownOpen ? 'chevron-up' : 'chevron-down'}
          size={14}
          color={palette.color}
          style={{ marginLeft: 2 }}
        />
      </TouchableOpacity>
      {isDropdownOpen && (
        <RNAnimated.View
          entering={
            dropdownDirection === 'up'
              ? FadeInUp.duration(180)
              : FadeInDown.duration(180)
          }
          exiting={
            dropdownDirection === 'up'
              ? FadeOutDown.duration(120)
              : FadeOutUp.duration(120)
          }
          style={{
            position: 'absolute',
            right: 12,
            minWidth: 110,
            backgroundColor: COLORS.white,
            borderRadius: 12,
            paddingVertical: 6,
            shadowColor: '#000',
            shadowOpacity: 0.12,
            shadowOffset: { width: 0, height: 4 },
            shadowRadius: 12,
            elevation: 8,
            zIndex: 100,
            ...(dropdownDirection === 'up'
              ? { bottom: 44 }
              : { top: 44 }),
          }}
        >
          {DROPDOWN_OPTIONS.map((opt) => {
            const isSelected = opt.value === status;
            return (
              <TouchableOpacity
                key={opt.value}
                onPress={() => onSelectAttendance(opt.value)}
                activeOpacity={0.7}
                className="flex-row items-center px-3 py-2"
                accessibilityLabel={opt.label}
                accessibilityRole="button"
              >
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: ATTENDANCE_STATUS_COLORS[opt.value],
                    marginRight: 8,
                  }}
                />
                <Typography
                  variant="body-03"
                  weight={isSelected ? 'semibold' : 'medium'}
                  className="text-gray-800"
                >
                  {opt.label}
                </Typography>
              </TouchableOpacity>
            );
          })}
        </RNAnimated.View>
      )}
      </View>
      {showBilling && (
        <BillingRow state={billingState} isPackage={isPackageBilling} onPress={onPressBilling} />
      )}
    </View>
  );
}

// ─── 청구 상태 행 (내담자 카드 하단) ───

function BillingRow({
  state,
  isPackage,
  onPress,
}: {
  state: BillingActionState;
  isPackage: boolean;
  onPress: () => void;
}) {
  const config = {
    none: { label: '청구서 발행', color: COLORS.primary },
    pending: { label: '청구 확인', color: COLORS.warning },
    completed: {
      label: isPackage ? '선결제 완료' : '청구 완료',
      color: COLORS.success,
    },
  }[state];
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className="mt-2.5 flex-row items-center justify-between border-t border-gray-100 pt-2.5"
      accessibilityLabel={`청구 ${config.label}`}
      accessibilityRole="button"
    >
      <View className="flex-row items-center">
        <Ionicons name="card-outline" size={14} color={COLORS.gray[500]} />
        <Typography
          variant="label-01"
          weight="medium"
          className="ml-1.5 text-gray-600"
        >
          청구
        </Typography>
      </View>
      <View className="flex-row items-center">
        <Typography
          variant="label-01"
          weight="semibold"
          style={{ color: config.color }}
        >
          {config.label}
        </Typography>
        <Ionicons
          name="chevron-forward"
          size={12}
          color={config.color}
          style={{ marginLeft: 2 }}
        />
      </View>
    </TouchableOpacity>
  );
}
