import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Pressable,
} from 'react-native';
import RAnimated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
  FadeIn,
} from 'react-native-reanimated';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BottomSheet } from '@/shared/components/ui/BottomSheet';
import { Typography } from '@/shared/components/ui/Typography';
import { Icon } from '@/shared/components/icons';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';
import {
  useNotesBySession,
  useCreateNote,
  useUpdateNote,
  useDeleteNote,
} from '../hooks';
import type { NoteContent, CounselingNoteResponse } from '../types';
import { useFieldNoteBySchedule, generateCounselingNote } from '@/features/field-note';
import { useToastStore, GlobalToastHost } from '@/features/toast';

/** 검사 소견 시트와 통일한 액센트 블루(#4486FF) — cyan primary 대신 사용 */
const ACCENT = '#4486FF';
/** 개인 메모 옐로 (디자인 시스템 외 — 기존 시트 계승) */
const MEMO_BG = '#FFFBEB';
const MEMO_BORDER = '#FDE68A';

/** 그룹 회기 참여 내담자 — 상단 칩으로 전환하며 일지 작성/조회 */
export interface NoteSheetParticipant {
  clientId: string;
  clientName: string | null;
  isWritten: boolean;
  /** 출결 상태 — 'absent'면 일지 작성 시 '불참' 안내를 표시 */
  attendanceStatus?: string | null;
}

export interface CounselingNoteSheetProps {
  visible: boolean;
  onClose: () => void;
  centerId: string | null;
  sessionId: string | null;
  clientId: string | null;
  clientName?: string;
  /** 세션 시작 시각 ISO — (현재 헤더에는 미표시, 호환 위해 유지) */
  sessionStart?: string;
  /** 회기의 일정 ID — 연결된 필드노트로 상담일지 자동 생성(C) 진입에 사용 */
  scheduleId?: string | null;
  /** 필드노트 자동 생성을 시작했을 때 호출 (부모가 field_note_id 폴링) */
  onGenerateStarted?: (fieldNoteId: string) => void;
  /**
   * 같은 회기의 참여 내담자 전체 (그룹). 2명 이상이면 상단에 칩을 띄워
   * 내담자를 전환하며 일지 작성/조회할 수 있다. 단일 회기면 생략.
   */
  participants?: NoteSheetParticipant[];
}

/**
 * 상담일지 작성/조회 시트.
 *
 * 검사 소견 시트(AssessmentOpinionSheet)와 디자인·인터랙션을 통일:
 *  - 공용 BottomSheet + 가운데 타이틀(그룹이면 좌우 ‹ › 내담자 이동)
 *  - 검사 소견 Chip 톤(active 블루 아웃라인 / 작성완료 다크+체크 / 미작성 회색)
 *  - double-diamond 그라데이션 풀폭 "초안 작성하기"
 *  - gray-50 입력 4필드(상담 목표·진행 내용·다음 상담 내용·개인 메모, 스펙 §3-5)
 *  - 항상-편집 + 닫기/저장(닫거나 내담자 전환 시 자동 저장) — view/edit 토글 없음
 *
 * 데이터 모델은 `NoteContent` 그대로. 내용을 모두 비우고 저장하면 기존 일지는 삭제(미작성 복귀).
 */
export function CounselingNoteSheet({
  visible,
  onClose,
  centerId,
  sessionId,
  clientId,
  clientName,
  sessionStart: _sessionStart,
  scheduleId,
  onGenerateStarted,
  participants,
}: CounselingNoteSheetProps) {
  const insets = useSafeAreaInsets();
  const showToast = useToastStore((st) => st.show);
  const { height: kbHeightSV } = useReanimatedKeyboardAnimation();

  const animatedBottomStyle = useAnimatedStyle(() => ({
    paddingBottom: Math.max(0, -kbHeightSV.value - insets.bottom),
  }));

  // ----- 그룹 내담자 전환 -----
  const [activeClientId, setActiveClientId] = useState<string | null>(clientId);
  const [writtenIds, setWrittenIds] = useState<Set<string>>(() => new Set());
  // 칩 표시 순서(내담자 id). 열릴 때 1회 고정 — 작성 완료된 내담자는 뒤로.
  // 세션 중 저장해도(=리패치/작성여부 변화) 칩이 튀지 않도록 순서는 얼린다.
  const [order, setOrder] = useState<string[]>([]);
  const participantsKey = (participants ?? []).map((p) => p.clientId).join(',');
  const showParticipantChips = (participants?.length ?? 0) > 1;
  // 고정된 순서로 참여 내담자 재배열 (작성 완료 = 뒤로)
  const orderedParticipants = useMemo(() => {
    const ps = participants ?? [];
    if (order.length === 0) return ps;
    const byId = new Map(ps.map((p) => [p.clientId, p]));
    const result = order
      .map((id) => byId.get(id))
      .filter((p): p is NoteSheetParticipant => !!p);
    const known = new Set(order);
    for (const p of ps) if (!known.has(p.clientId)) result.push(p);
    return result;
  }, [participants, order]);
  const activeIndex = orderedParticipants.findIndex((p) => p.clientId === activeClientId);
  const canPrev = showParticipantChips && activeIndex > 0;
  const canNext =
    showParticipantChips && activeIndex >= 0 && activeIndex < orderedParticipants.length - 1;

  // ----- 폼 상태 -----
  const [existingNote, setExistingNote] = useState<CounselingNoteResponse | null>(null);
  const [goal, setGoal] = useState('');
  const [progress, setProgress] = useState('');
  const [nextPlan, setNextPlan] = useState('');
  const [privateMemo, setPrivateMemo] = useState('');
  // 폼이 어떤 내담자로 init 됐는지 — fresh fetch 후에만 세팅. activeClientId와 다르면 "아직 미정착".
  const [initClientId, setInitClientId] = useState<string | null>(null);

  // onClose 가 sessionId·existingNote 를 null 로 바꿔도, 직전에 발사한 저장 요청이 유효한 값으로
  // 나가도록 마지막 유효 식별자를 보존. (RQ mutate 는 mutationFn 을 다음 틱에 실행 → 그 사이 prop 이
  // null 이 되어 ".../sessions/null/notes" 404 가 나던 버그 방지. centerId는 store라 안전하지만 함께 보존)
  const liveIdsRef = useRef<{
    centerId: string | null;
    sessionId: string | null;
    noteId: string | null;
  }>({ centerId, sessionId, noteId: existingNote?.id ?? null });
  if (visible && centerId && sessionId) {
    liveIdsRef.current = { centerId, sessionId, noteId: existingNote?.id ?? null };
  }

  // ----- 쿼리 / 뮤테이션 (활성 내담자 기준) -----
  const { data: notes, isFetching: notesFetching } = useNotesBySession(
    visible ? centerId : null,
    visible ? sessionId : null,
    visible ? activeClientId ?? undefined : undefined,
  );
  const createMutation = useCreateNote(liveIdsRef.current.centerId, liveIdsRef.current.sessionId);
  const updateMutation = useUpdateNote(
    liveIdsRef.current.centerId,
    liveIdsRef.current.noteId,
    liveIdsRef.current.sessionId ?? undefined,
  );
  const deleteMutation = useDeleteNote(
    liveIdsRef.current.centerId,
    liveIdsRef.current.sessionId ?? undefined,
  );

  // 활성 내담자 폼이 fresh 데이터로 init 되기 전까지는 로딩 — stale 캐시로 create/update를
  // 잘못 판정하지 않도록 본문 대신 스피너. (재진입 stale [] → 오작성=409 방지)
  const loading = visible && initClientId !== activeClientId;

  // visible 토글 — open 시 활성 내담자/작성여부 초기화, close 시 폼 정리
  useEffect(() => {
    if (visible) {
      setActiveClientId(clientId);
      setWrittenIds(
        new Set((participants ?? []).filter((p) => p.isWritten).map((p) => p.clientId)),
      );
      // 작성 완료된 내담자는 뒤로 (안정 정렬 — 그 외 순서 유지)
      const sorted = [...(participants ?? [])].sort(
        (a, b) => Number(a.isWritten) - Number(b.isWritten),
      );
      setOrder(sorted.map((p) => p.clientId));
      setInitClientId(null);
    } else {
      setOrder([]);
      setInitClientId(null);
      setExistingNote(null);
      setGoal('');
      setProgress('');
      setNextPlan('');
      setPrivateMemo('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, clientId, participantsKey]);

  // 쿼리 데이터 도착 시 폼 초기화 (활성 내담자당 1회).
  // isFetching 동안엔 init 보류 — 재진입 시 React Query가 stale 캐시([])를 먼저 주고
  // 백그라운드 refetch 하므로, stale로 init 하면 기존 노트를 create 모드로 오판(→ 409)한다.
  // fresh fetch가 끝난(notesFetching=false) 뒤에만 init. activeClientId가 바뀌면
  // initClientId !== activeClientId 라 자동으로 재init.
  useEffect(() => {
    if (!visible || notes === undefined || notesFetching) return;
    if (initClientId === activeClientId) return;
    setInitClientId(activeClientId);
    if (notes.length > 0) {
      const note = notes[0];
      setExistingNote(note);
      setGoal(note.content?.main_topic ?? '');
      setProgress(note.content?.progress ?? '');
      setNextPlan(note.content?.next_goal ?? '');
      setPrivateMemo(note.content?.private_notes ?? '');
      if (activeClientId) {
        setWrittenIds((prev) => new Set(prev).add(activeClientId));
      }
    } else {
      setExistingNote(null);
      setGoal('');
      setProgress('');
      setNextPlan('');
      setPrivateMemo('');
      if (activeClientId) {
        setWrittenIds((prev) => {
          if (!prev.has(activeClientId)) return prev;
          const next = new Set(prev);
          next.delete(activeClientId);
          return next;
        });
      }
    }
  }, [visible, notes, notesFetching, activeClientId, initClientId]);

  // ----- 파생 상태 -----
  const hasContent =
    goal.trim().length > 0 ||
    progress.trim().length > 0 ||
    nextPlan.trim().length > 0 ||
    privateMemo.trim().length > 0;
  const isDirty = useMemo(() => {
    if (!existingNote) return hasContent;
    const orig = existingNote.content;
    if ((orig?.main_topic ?? '') !== goal) return true;
    if ((orig?.progress ?? '') !== progress) return true;
    if ((orig?.next_goal ?? '') !== nextPlan) return true;
    if ((orig?.private_notes ?? '') !== privateMemo) return true;
    return false;
  }, [existingNote, goal, progress, nextPlan, privateMemo, hasContent]);
  const isSaving =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const buildContent = useCallback((): Partial<NoteContent> => {
    const c: Partial<NoteContent> = {};
    if (goal.trim()) c.main_topic = goal.trim();
    if (progress.trim()) c.progress = progress.trim();
    if (nextPlan.trim()) c.next_goal = nextPlan.trim();
    if (privateMemo.trim()) c.private_notes = privateMemo.trim();
    return c;
  }, [goal, progress, nextPlan, privateMemo]);

  // 현재 내담자의 일지를 — 변경됐을 때만 — 저장(생성/수정/삭제). 검사 소견 persistTask 대응.
  const persistActive = useCallback(
    (withToast: boolean) => {
      const cid = activeClientId;
      if (!cid) return;
      const content = buildContent();
      const has = hasContent;
      const onSaveError = (_op: string) => () =>
        showToast({ type: 'error', message: '저장하지 못했어요. 다시 시도해 주세요' });
      // 칩 ✓ 즉시 반영
      setWrittenIds((prev) => {
        const next = new Set(prev);
        if (has) next.add(cid);
        else next.delete(cid);
        return next;
      });
      if (existingNote) {
        if (!has) {
          deleteMutation.mutate(existingNote.id, {
            onError: onSaveError('delete'),
          });
        } else if (isDirty) {
          updateMutation.mutate(
            { content },
            {
              onSuccess: () =>
                withToast && showToast({ type: 'info', message: '상담일지를 저장했어요' }),
              onError: onSaveError('update'),
            },
          );
        }
      } else if (has) {
        createMutation.mutate(
          { client_id: cid, content },
          {
            onSuccess: (note) => {
              setExistingNote(note);
              if (withToast) showToast({ type: 'info', message: '상담일지를 저장했어요' });
            },
            onError: onSaveError('create'),
          },
        );
      }
    },
    [
      activeClientId,
      buildContent,
      hasContent,
      isDirty,
      existingNote,
      createMutation,
      updateMutation,
      deleteMutation,
      showToast,
    ],
  );

  // 닫기/저장 — 현재 내담자 저장 후 닫기 (검사 소견 closeWithSave 대응)
  const closeWithSave = useCallback(
    (withToast: boolean) => {
      persistActive(withToast);
      onClose();
    },
    [persistActive, onClose],
  );

  // 내담자 전환 — 현재 내담자 저장 후 이동
  const switchClient = useCallback(
    (targetId: string) => {
      if (targetId === activeClientId) return;
      persistActive(false);
      setActiveClientId(targetId);
    },
    [activeClientId, persistActive],
  );

  const stepClient = useCallback(
    (dir: -1 | 1) => {
      if (activeIndex < 0) return;
      const target = orderedParticipants[activeIndex + dir];
      if (target) switchClient(target.clientId);
    },
    [orderedParticipants, activeIndex, switchClient],
  );

  // 저장 — 현재 내담자 저장 후, 그룹이면 다음 "미작성" 내담자로 이동.
  // 단일이거나 모두 작성됐으면 닫음 / 현재에 머무름. (검사 소견 saveAndContinue 대응)
  const saveAndContinue = useCallback(() => {
    persistActive(true);
    if (!showParticipantChips) {
      onClose();
      return;
    }
    // 방금 저장한 현재 내담자는 hasContent면 작성됨으로 취급 (writtenIds 비동기 반영 보정)
    const isWrittenNow = (cid: string) =>
      cid === activeClientId ? hasContent : writtenIds.has(cid);
    const list = orderedParticipants;
    const n = list.length;
    const start = Math.max(activeIndex, 0);
    for (let i = 1; i <= n; i++) {
      const p = list[(start + i) % n];
      if (!p || p.clientId === activeClientId) continue;
      if (!isWrittenNow(p.clientId)) {
        setActiveClientId(p.clientId);
        return;
      }
    }
    // 모두 작성됨 → 현재 내담자에 머무름 (저장 토스트만)
  }, [
    persistActive,
    showParticipantChips,
    onClose,
    activeClientId,
    hasContent,
    writtenIds,
    orderedParticipants,
    activeIndex,
  ]);

  // ----- C: 연결된 필드노트로 상담일지 자동 생성 -----
  const { data: linkedFieldNote } = useFieldNoteBySchedule(
    visible && scheduleId ? centerId : null,
    visible ? scheduleId ?? null : null,
  );
  const canGenerateFromFieldNote =
    !existingNote &&
    !!linkedFieldNote &&
    linkedFieldNote.processing_status === 'completed' &&
    linkedFieldNote.note_status !== 'completed';

  const handleGenerateFromFieldNote = useCallback(() => {
    if (!linkedFieldNote) return;
    Alert.alert(
      '필드노트로 상담일지 작성',
      '연결된 필드노트(녹취·요약)로 이 회기의 상담일지 초안을 만들어요. 회기에 참여한 내담자 모두에게 생성되며, 내담자 1명당 약 8 크레딧이 소모돼요.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '만들기',
          onPress: async () => {
            try {
              const res = await generateCounselingNote(centerId!, linkedFieldNote.id);
              if (res.status === 'started') {
                onGenerateStarted?.(linkedFieldNote.id);
                showToast({ type: 'info', message: '상담일지 초안을 만들고 있어요' });
                onClose();
              } else {
                showToast({ type: 'error', message: res.message ?? '상담일지를 만들 수 없어요' });
              }
            } catch {
              showToast({ type: 'error', message: '요청에 실패했어요. 다시 시도해 주세요' });
            }
          },
        },
      ],
    );
  }, [linkedFieldNote, centerId, onGenerateStarted, showToast, onClose]);

  const activeParticipant = participants?.find(
    (p) => p.clientId === activeClientId,
  );
  const activeClientName =
    activeParticipant?.clientName ?? clientName ?? null;
  const activeIsAbsent = activeParticipant?.attendanceStatus === 'absent';
  const headerTitle = activeClientName ? `${activeClientName}의 상담일지` : '상담일지';

  return (
    <BottomSheet visible={visible} onClose={() => closeWithSave(true)} fullHeight horizontalPadding={16}>
      <View style={{ flex: 1 }}>
        {/* 헤더 — 가운데 타이틀 (그룹이면 좌우 ‹ › 내담자 이동) */}
        <View
          style={{
            height: s(48),
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <TouchableOpacity
            onPress={() => stepClient(-1)}
            disabled={!canPrev}
            hitSlop={8}
            accessibilityLabel="이전 내담자"
            accessibilityRole="button"
            style={{ width: s(24), opacity: showParticipantChips ? 1 : 0 }}
          >
            <Ionicons
              name="chevron-back"
              size={24}
              color={canPrev ? COLORS.gray[700] : COLORS.gray[300]}
            />
          </TouchableOpacity>
          <Typography
            variant="title-01"
            weight="semibold"
            numberOfLines={1}
            style={{ flex: 1, textAlign: 'center', color: COLORS.gray[900] }}
          >
            {headerTitle}
          </Typography>
          <TouchableOpacity
            onPress={() => stepClient(1)}
            disabled={!canNext}
            hitSlop={8}
            accessibilityLabel="다음 내담자"
            accessibilityRole="button"
            style={{ width: s(24), opacity: showParticipantChips ? 1 : 0 }}
          >
            <Ionicons
              name="chevron-forward"
              size={24}
              color={canNext ? COLORS.gray[700] : COLORS.gray[300]}
            />
          </TouchableOpacity>
        </View>

        {/* 그룹 회기 — 참여 내담자 칩 (검사 소견 Chip 톤) */}
        {showParticipantChips && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0, height: s(52) }}
            contentContainerStyle={{ gap: s(6), alignItems: 'center' }}
            keyboardShouldPersistTaps="handled"
          >
            {orderedParticipants.map((p) => (
              <ParticipantChip
                key={p.clientId}
                name={p.clientName ?? '내담자'}
                active={p.clientId === activeClientId}
                written={writtenIds.has(p.clientId)}
                onPress={() => switchClient(p.clientId)}
              />
            ))}
          </ScrollView>
        )}

        {/* 본문 */}
        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color={ACCENT} />
          </View>
        ) : (
          <RAnimated.View key={activeClientId ?? 'single'} entering={FadeIn.duration(220)} style={{ flex: 1 }}>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingTop: s(8), paddingBottom: s(20), gap: s(18) }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* C: 연결된 필드노트로 상담일지 초안 — double-diamond 그라데이션 풀폭 */}
              {canGenerateFromFieldNote && (
                <TouchableOpacity activeOpacity={0.85} onPress={handleGenerateFromFieldNote}>
                  <LinearGradient
                    colors={['#5CCBFF', '#C4C3FF', '#D9C2FF']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{
                      height: s(44),
                      borderRadius: s(12),
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: s(8),
                    }}
                  >
                    <Icon name="double-diamond-16" size={16} />
                    <Typography variant="body-03" weight="semibold" style={{ color: '#5B5FE0' }}>
                      초안 작성하기
                    </Typography>
                  </LinearGradient>
                </TouchableOpacity>
              )}

              {/* 불참 내담자 안내 — 상담 목표 인풋 위 */}
              {activeIsAbsent && (
                <Typography
                  variant="body-03"
                  weight="medium"
                  style={{ color: COLORS.error }}
                >
                  불참한 내담자에요
                </Typography>
              )}
              <NoteField
                label="상담 목표"
                value={goal}
                onChangeText={setGoal}
                placeholder="이번 회기의 목표를 입력해 주세요"
                minHeight={92}
                maxLength={3000}
              />
              <NoteField
                label="진행 내용"
                value={progress}
                onChangeText={setProgress}
                placeholder="이번 회기의 진행 내용을 기록해 주세요"
                minHeight={120}
                maxLength={5000}
              />
              <NoteField
                label="다음 상담 내용"
                value={nextPlan}
                onChangeText={setNextPlan}
                placeholder="다음 회기에서 다룰 내용을 입력해 주세요"
                minHeight={92}
                maxLength={3000}
              />
              <NoteField
                label="개인 메모"
                value={privateMemo}
                onChangeText={setPrivateMemo}
                placeholder="개인 메모는 내담자에게 공유되지 않아요"
                minHeight={92}
                maxLength={3000}
                isPrivate
              />
            </ScrollView>
          </RAnimated.View>
        )}

        {/* 푸터 — 닫기 + 저장 (검사 소견 톤) */}
        <RAnimated.View style={[{ paddingTop: s(8) }, animatedBottomStyle]}>
          <View style={{ flexDirection: 'row', gap: s(8) }}>
            <TouchableOpacity
              onPress={() => closeWithSave(false)}
              disabled={isSaving}
              activeOpacity={0.7}
              accessibilityLabel="닫기"
              accessibilityRole="button"
              style={{
                width: s(122),
                paddingVertical: s(13),
                borderRadius: s(10),
                borderWidth: 1,
                borderColor: COLORS.gray[200],
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Typography variant="body-02" weight="medium" style={{ color: COLORS.gray[600] }}>
                닫기
              </Typography>
            </TouchableOpacity>
            <SaveButton pending={isSaving} onPress={saveAndContinue} />
          </View>
        </RAnimated.View>
      </View>

      {/* 시트(Modal) 위에 토스트가 보이도록 시트 안에서도 호스트 마운트 */}
      <GlobalToastHost elevated />
    </BottomSheet>
  );
}

/** gray-50 입력 필드 (검사 소견 textarea 톤). 개인 메모는 옐로 + 잠금 라벨. */
function NoteField({
  label,
  value,
  onChangeText,
  placeholder,
  minHeight,
  maxLength,
  isPrivate,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  minHeight: number;
  maxLength: number;
  isPrivate?: boolean;
}) {
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(4), marginBottom: s(8) }}>
        {isPrivate && <Ionicons name="lock-closed" size={13} color={COLORS.warning} />}
        <Typography
          variant="body-03"
          weight="medium"
          style={{ color: isPrivate ? COLORS.warning : COLORS.gray[600] }}
        >
          {label}
        </Typography>
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.gray[400]}
        multiline
        textAlignVertical="top"
        maxLength={maxLength}
        style={{
          minHeight: s(minHeight),
          padding: s(14),
          borderRadius: s(12),
          borderWidth: 1,
          borderColor: isPrivate ? MEMO_BORDER : COLORS.gray[200],
          // 일반 입력은 배경 없음(테두리만). 개인 메모만 옐로 배경 유지.
          backgroundColor: isPrivate ? MEMO_BG : 'transparent',
          fontSize: s(15),
          lineHeight: s(24),
          color: COLORS.gray[800],
          letterSpacing: -0.41,
        }}
      />
    </View>
  );
}

/** 검사 소견 Chip 톤 — active 블루 아웃라인 / 작성완료 다크+체크 / 미작성 회색 */
function ParticipantChip({
  name,
  active,
  written,
  onPress,
}: {
  name: string;
  active: boolean;
  written: boolean;
  onPress: () => void;
}) {
  const bg = active ? COLORS.primary50 : written ? COLORS.gray[800] : COLORS.white;
  const border = active ? ACCENT : written ? COLORS.gray[800] : COLORS.gray[200];
  const fg = active ? ACCENT : written ? COLORS.white : COLORS.gray[600];
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${name}${written ? ' 작성 완료' : ' 미작성'}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: s(4),
        height: s(32),
        paddingHorizontal: s(12),
        borderRadius: s(20),
        borderWidth: 1,
        backgroundColor: bg,
        borderColor: border,
      }}
    >
      {written && !active && <Ionicons name="checkmark" size={13} color={COLORS.success} />}
      <Typography variant="label-01" weight={active ? 'semibold' : 'medium'} style={{ color: fg }}>
        {name}
      </Typography>
    </TouchableOpacity>
  );
}

/** 저장 버튼 — 누를 때 스프링 바운스 (검사 소견 SaveButton 대응) */
function SaveButton({ pending, onPress }: { pending: boolean; onPress: () => void }) {
  const scale = useSharedValue(1);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <RAnimated.View style={[{ flex: 1 }, aStyle]}>
      <Pressable
        onPress={onPress}
        disabled={pending}
        onPressIn={() => {
          scale.value = withTiming(0.95, { duration: 90 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 7, stiffness: 220, mass: 0.6 });
        }}
        accessibilityRole="button"
        accessibilityLabel="저장"
        style={{
          paddingVertical: s(13),
          borderRadius: s(10),
          backgroundColor: ACCENT,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {pending ? (
          <ActivityIndicator size="small" color={COLORS.white} />
        ) : (
          <Typography variant="body-02" weight="medium" style={{ color: COLORS.white }}>
            저장
          </Typography>
        )}
      </Pressable>
    </RAnimated.View>
  );
}
