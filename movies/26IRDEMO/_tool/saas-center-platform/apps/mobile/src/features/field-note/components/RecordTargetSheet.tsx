import { useMemo } from 'react';
import { View, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { BottomSheet } from '@/shared/components/ui/BottomSheet';
import { Typography } from '@/shared/components/ui/Typography';
import { Skeleton, useDelayedSkeleton } from '@/shared/components/ui/Skeleton';
import { COLORS } from '@/shared/constants/theme';
import { useFieldNotePlatform } from '../platform/context';
// TODO(extraction): 스케줄 목록 훅은 아직 포트로 빼지 않음 — platform/EXTRACTION.md 참고
import { useScheduleList, type ScheduleListItem } from '@/features/schedule';
import { parseDate } from '@/shared/utils/date';
import { s } from '@/shared/utils/scale';
import { useFieldNotes, useLinkableAssessmentTasks } from '../hooks';
import type { FieldNoteResponse, LinkableAssessmentTask } from '../types';
import type { RecordingContext } from './RecordingSheet';

/**
 * 녹음 진입 연결 선택 시트 — link-at-start (lab field-note-record-entry [연결 선택] 시안).
 *
 * 마이크 탭 = blind 녹음이 아니라 "무엇을 녹음할까요?" 선택:
 *  · 지금 진행 중 상담 회기 선점 카드 (가장 흔한 경우 원탭)
 *  · 오늘 회기(상담) + 진행 중 검사 task 목록
 *
 * 필드노트는 예약된 일정(회기/검사) 안에서만 녹음을 관리한다 — 워크인·미연결 진입은 두지 않는다.
 * 이미 노트가 있는 회기는 녹음 대신 '노트 있음'으로 안내(탭=노트 열기) — schedule 1:1 보호.
 * 시트 자체는 녹음 상태를 만들지 않는다(진입 UI일 뿐) — 선택 결과만 콜백으로 위임.
 */

const FN = COLORS.fieldnoteDark;
const FN_HANDLE = 'rgba(255,255,255,0.2)';
// 필드노트 홈·목록과 동일한 네이비 톤 오버라이드 — 글로벌 fieldnoteDark(보라끼)와 분리.
// (시트만 보라톤이라 홈과 어긋나 보이던 문제 해소)
const HOME_BG = '#040A17'; // 시트 surface
const HOME_CARD = '#252933'; // 회기·검사 행 카드
// 강조색 — 홈은 보라 대신 블루 정체성(녹음 시작·카운트). 시트도 블루로 맞춰 어우러지게.
const ACCENT_BLUE = '#648AE3'; // 아이콘·하이라이트 라벨
const REC_BTN_BG = '#4B7BEC'; // '이 회기 녹음' 버튼 (홈 '녹음 시작'과 동일)
// 다크 시트용 스켈레톤 시머 톤 (라이트 기본값 대신 화이트 오버레이).
const DARK_SKEL: [string, string] = ['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.13)'];

interface RecordTargetSheetProps {
  visible: boolean;
  onClose: () => void;
  /** 회기 선택 — 호출 측이 start/충돌 해소를 담당. */
  onPickSchedule: (sc: ScheduleListItem) => void;
  /** 검사 task 선택. context = 좌상단 표기용(녹음 시작 후 보존). */
  onPickTask: (taskId: string, context: RecordingContext) => void;
  /** 이미 노트가 있는 회기 탭 — 그 노트 열기. */
  onOpenNote: (noteId: string) => void;
}

type Phase = 'past' | 'now' | 'soon';

function phaseOf(sc: ScheduleListItem, nowMs: number): Phase {
  const st = parseDate(sc.start).getTime();
  const en = parseDate(sc.end).getTime();
  if (en < nowMs) return 'past';
  if (st <= nowMs && nowMs <= en) return 'now';
  return 'soon';
}

function phaseLabel(p: Phase): { text: string; color: string } {
  if (p === 'now') return { text: '진행 중', color: COLORS.error };
  if (p === 'soon') return { text: '예정', color: FN.sub };
  return { text: '지난', color: FN.sub };
}

function timeRange(sc: ScheduleListItem): string {
  try {
    return `${format(parseDate(sc.start), 'HH:mm')} ~ ${format(parseDate(sc.end), 'HH:mm')}`;
  } catch {
    return '';
  }
}

function clientLabel(names: string[]): string {
  if (names.length === 0) return '내담자';
  return names.length > 1 ? `${names[0]} 외 ${names.length - 1}` : names[0];
}

/** 검사 세션 예약 시각 — "6월 20일 (금) 14:00". 검사 후보는 오늘로 한정 안 돼 날짜 포함. */
function sessionWhen(iso: string): string {
  try {
    return format(parseDate(iso), 'M월 d일 (E) HH:mm', { locale: ko });
  } catch {
    return '';
  }
}

/** 오늘 상담 회기 행 — 노트가 있으면 '노트 있음'(탭=노트 열기), 없으면 탭=연결 녹음. */
function SessionRow({
  sc,
  phase,
  note,
  onPick,
  onOpenNote,
}: {
  sc: ScheduleListItem;
  phase: Phase;
  note: FieldNoteResponse | undefined;
  onPick: () => void;
  onOpenNote: (noteId: string) => void;
}) {
  const ph = phaseLabel(phase);
  const hasNote = !!note;
  return (
    <Pressable
      onPress={() => (hasNote ? onOpenNote(note!.id) : onPick())}
      accessibilityRole="button"
      accessibilityLabel={`${clientLabel(sc.client_names)} 회기 ${hasNote ? '노트 열기' : '녹음'}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: s(10),
        paddingVertical: s(11),
        paddingHorizontal: s(14),
        borderRadius: s(12),
        backgroundColor: HOME_CARD,
        marginBottom: s(8),
        opacity: phase === 'past' ? 0.6 : 1,
      }}
    >
      <View style={{ width: s(7), height: s(7), borderRadius: s(4), backgroundColor: COLORS.counseling }} />
      <View style={{ flex: 1 }}>
        <Typography variant="body-02" weight="semibold" style={{ color: FN.text }} numberOfLines={1}>
          {clientLabel(sc.client_names)}
        </Typography>
        <Typography variant="label-01" style={{ color: FN.sub, marginTop: s(2) }} numberOfLines={1}>
          {[timeRange(sc), sc.program_name].filter(Boolean).join(' · ')}
        </Typography>
      </View>
      {hasNote ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(3) }}>
          <Ionicons name="document-text-outline" size={s(13)} color={FN.sub} />
          <Typography variant="label-02" weight="medium" style={{ color: FN.sub }}>노트 있음</Typography>
        </View>
      ) : (
        <>
          <View style={{ paddingHorizontal: s(7), paddingVertical: s(2), borderRadius: s(8), backgroundColor: ph.color + '1F' }}>
            <Typography variant="label-02" weight="medium" style={{ color: ph.color }}>{ph.text}</Typography>
          </View>
          <Ionicons name="mic" size={s(16)} color={ACCENT_BLUE} />
        </>
      )}
    </Pressable>
  );
}

/** 오늘 일정 행 스켈레톤 — SessionRow/TaskRow 레이아웃 모사(2줄 텍스트). */
function SessionRowSkeleton() {
  return (
    <View
      style={{
        paddingVertical: s(11),
        paddingHorizontal: s(14),
        borderRadius: s(12),
        backgroundColor: HOME_CARD,
        marginBottom: s(8),
      }}
    >
      <Skeleton width={140} height={14} colors={DARK_SKEL} />
      <Skeleton width={100} height={11} colors={DARK_SKEL} style={{ marginTop: s(6) }} />
    </View>
  );
}

/** 진행 중 검사 task 행 — 블루 dot + 검사명 뱃지(§3-4-2).
 * 노트가 있으면 '노트 있음'(탭=노트 열기), 없으면 탭=task 연결 녹음. (검사 1:1 보호 — SessionRow 대칭) */
function TaskRow({
  task,
  note,
  onPick,
  onOpenNote,
}: {
  task: LinkableAssessmentTask;
  note: FieldNoteResponse | undefined;
  onPick: () => void;
  onOpenNote: (noteId: string) => void;
}) {
  const name = task.assessment_kor_name ?? task.assessment_code ?? '검사';
  const hasNote = !!note;
  return (
    <Pressable
      onPress={() => (hasNote ? onOpenNote(note!.id) : onPick())}
      accessibilityRole="button"
      accessibilityLabel={`${task.client_name} ${name} ${hasNote ? '노트 열기' : '녹음'}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: s(10),
        paddingVertical: s(11),
        paddingHorizontal: s(14),
        borderRadius: s(12),
        backgroundColor: HOME_CARD,
        marginBottom: s(8),
      }}
    >
      <View style={{ width: s(7), height: s(7), borderRadius: s(4), backgroundColor: COLORS.assessment }} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6) }}>
          <Typography variant="body-02" weight="semibold" style={{ color: FN.text }} numberOfLines={1}>
            {task.client_name}
          </Typography>
          <View style={{ paddingHorizontal: s(6), paddingVertical: s(1), borderRadius: s(4), backgroundColor: COLORS.assessment + '26' }}>
            <Typography variant="label-02" weight="medium" style={{ color: COLORS.assessment }}>{name}</Typography>
          </View>
        </View>
        {task.session_start ? (
          <Typography variant="label-01" style={{ color: FN.sub, marginTop: s(2) }} numberOfLines={1}>
            {sessionWhen(task.session_start)}
          </Typography>
        ) : null}
      </View>
      {hasNote ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(3) }}>
          <Ionicons name="document-text-outline" size={s(13)} color={FN.sub} />
          <Typography variant="label-02" weight="medium" style={{ color: FN.sub }}>노트 있음</Typography>
        </View>
      ) : (
        <Ionicons name="mic" size={s(16)} color={ACCENT_BLUE} />
      )}
    </Pressable>
  );
}

export function RecordTargetSheet({
  visible,
  onClose,
  onPickSchedule,
  onPickTask,
  onOpenNote,
}: RecordTargetSheetProps) {
  const { centerId } = useFieldNotePlatform();
  const today = useMemo(() => new Date(), []);
  // 시트가 열린 시점 기준의 진행/예정 판정 (visible 토글마다 갱신).
  const nowMs = useMemo(() => Date.now(), [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: schedules, isLoading: schedLoading } = useScheduleList(visible ? centerId : null, today);
  const { data: tasks, isLoading: tasksLoading } = useLinkableAssessmentTasks(visible ? centerId : null);
  const showSkeleton = useDelayedSkeleton(visible && (schedLoading || tasksLoading));
  // 회기별 기존 노트 매핑 — 홈과 동일 쿼리 키(size 30) 재사용(캐시 공유).
  const { data: notesPage } = useFieldNotes(visible ? centerId : null, { size: 30 });

  const noteBySchedule = useMemo(() => {
    const m = new Map<string, FieldNoteResponse>();
    for (const n of notesPage?.items ?? []) if (n.schedule_id) m.set(n.schedule_id, n);
    return m;
  }, [notesPage]);
  // 검사(task) 1:1 — 회기와 동일하게 이미 노트가 있는 task 는 새로 만들지 않고 '노트 있음'으로 안내한다.
  // (이 가드가 없으면 노트 있는 task 를 또 녹음 → POST /field-notes 409 ConflictException)
  const noteByTask = useMemo(() => {
    const m = new Map<string, FieldNoteResponse>();
    for (const n of notesPage?.items ?? []) if (n.task_id) m.set(n.task_id, n);
    return m;
  }, [notesPage]);

  const counseling = useMemo(
    () =>
      (schedules ?? [])
        .filter((sc) => sc.schedule_type === 'counseling')
        .sort((a, b) => parseDate(a.start).getTime() - parseDate(b.start).getTime()),
    [schedules],
  );

  // 지금 회기 선점 — 진행 중 상담 회기 중 노트 없는 첫 건 (흔한 경우 원탭).
  const nowSession = useMemo(
    () => counseling.find((sc) => phaseOf(sc, nowMs) === 'now' && !noteBySchedule.get(sc.id)) ?? null,
    [counseling, nowMs, noteBySchedule],
  );

  const taskList = tasks ?? [];

  // 선택 즉시 시트를 닫고 위임 — 확인 모달(홈 충돌 해소)과 모달 중첩을 피한다.
  const pick = (fn: () => void) => {
    onClose();
    fn();
  };

  const empty = counseling.length === 0 && taskList.length === 0;

  return (
    <BottomSheet visible={visible} onClose={onClose} fullHeight surfaceColor={HOME_BG} handleColor={FN_HANDLE}>
      {/* 헤더 — 타이틀 + 닫기 X */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: s(8), marginBottom: s(16) }}>
        <Typography variant="title-01" weight="semibold" style={{ color: FN.text, flex: 1 }} numberOfLines={1}>
          기록할 상담이나 검사를 선택해주세요
        </Typography>
        <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="닫기">
          <Ionicons name="close" size={s(24)} color={FN.sub} />
        </Pressable>
      </View>

      {/* 지금 회기 선점 */}
      {nowSession ? (
        <View
          style={{
            borderRadius: s(14),
            backgroundColor: 'rgba(75,123,236,0.12)',
            borderWidth: 1,
            borderColor: ACCENT_BLUE + '55',
            padding: s(14),
            marginBottom: s(16),
          }}
        >
          <Typography variant="label-01" weight="semibold" style={{ color: ACCENT_BLUE, marginBottom: s(8) }}>
            지금 진행 중인 회기
          </Typography>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, paddingRight: s(8) }}>
              <Typography variant="body-01" weight="semibold" style={{ color: FN.text }} numberOfLines={1}>
                {clientLabel(nowSession.client_names)}
              </Typography>
              <Typography variant="label-01" style={{ color: FN.sub, marginTop: s(2) }} numberOfLines={1}>
                {timeRange(nowSession)}
              </Typography>
            </View>
            <Pressable
              onPress={() => pick(() => onPickSchedule(nowSession))}
              accessibilityRole="button"
              accessibilityLabel={`${clientLabel(nowSession.client_names)} 회기 녹음 시작`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: s(6),
                backgroundColor: REC_BTN_BG,
                borderRadius: s(12),
                paddingHorizontal: s(16),
                paddingVertical: s(11),
              }}
            >
              <Ionicons name="mic" size={s(16)} color={COLORS.white} />
              <Typography variant="body-02" weight="semibold" style={{ color: COLORS.white }}>이 회기 녹음</Typography>
            </Pressable>
          </View>
        </View>
      ) : null}

      <Typography variant="label-01" weight="semibold" style={{ color: FN.sub, marginBottom: s(8) }}>
        오늘 일정
      </Typography>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {showSkeleton ? (
          Array.from({ length: 4 }).map((_, i) => <SessionRowSkeleton key={i} />)
        ) : schedLoading || tasksLoading ? null : (
          <>
            {counseling.map((sc) => (
              <SessionRow
                key={sc.id}
                sc={sc}
                phase={phaseOf(sc, nowMs)}
                note={noteBySchedule.get(sc.id)}
                onPick={() => pick(() => onPickSchedule(sc))}
                onOpenNote={(noteId) => pick(() => onOpenNote(noteId))}
              />
            ))}
            {taskList.map((t) => (
              <TaskRow
                key={t.task_id}
                task={t}
                note={noteByTask.get(t.task_id)}
                onPick={() =>
                  pick(() =>
                    onPickTask(t.task_id, {
                      client: t.client_name,
                      sub: t.assessment_kor_name ?? t.assessment_code ?? '검사',
                      kind: 'assessment',
                    }),
                  )
                }
                onOpenNote={(noteId) => pick(() => onOpenNote(noteId))}
              />
            ))}
            {empty ? (
              <Typography variant="body-03" style={{ color: FN.sub, textAlign: 'center', paddingVertical: s(20) }}>
                오늘 일정이 없어요
              </Typography>
            ) : null}
          </>
        )}
      </ScrollView>
    </BottomSheet>
  );
}
