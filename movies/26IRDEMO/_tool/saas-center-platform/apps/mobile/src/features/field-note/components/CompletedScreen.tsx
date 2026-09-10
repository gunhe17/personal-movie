import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  PanResponder,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import RAnimated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { COLORS, TYPOGRAPHY, SPACING } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';
import { formatKstDateTime } from '@/shared/utils/date';
import { useDarkNavBarWhileMounted } from '../useFieldNoteNavBar';
import { LinkScheduleSheet } from './LinkScheduleSheet';
import { FieldNoteConfirmModal } from './FieldNoteConfirmModal';
import { AIAnalysisView, AIAnalysisTeaser } from './AIAnalysisView';
import { Segment } from '@/shared/components/ui/Segment';
import { ConfirmModal } from '@/shared/components/ui/ConfirmModal';
import { useFieldNotePlatform } from '../platform/context';
import { useQueryClient } from '@tanstack/react-query';
// TODO(extraction): 스케줄 이동/조회는 아직 포트로 빼지 않음 — platform/EXTRACTION.md 참고
import { openScheduleDetail, useScheduleDetail } from '@/features/schedule';
import {
  useGenerateSummary,
  useRunPipeline,
  useDiarize,
  useGenerateCounselingNote,
  useCounselingNoteGenerationComplete,
} from '../hooks';
import type { CompletedViewData } from '../useCompletedView';
import { usePlaybackPositionStore } from '../useAudioPlayer';
import type { FieldNoteDetailResponse, FieldNoteEntry } from '../types';
import type { TimelineItem } from '../timeline';

export interface CompletedScreenProps {
  sessionInfo: string;
  fieldNote: FieldNoteDetailResponse | null | undefined;
  existingFieldNote: FieldNoteDetailResponse | null | undefined;
  fieldNoteId: string | null;
  entries: FieldNoteEntry[];
  audios: FieldNoteDetailResponse['audios'];
  completedView: CompletedViewData;
  onBack: () => void;
  onStartAdditional: () => void;
  /** 노트 삭제 — 폐기 후 닫기 (FieldNoteDetailView 공통 핸들러). */
  onDelete: () => void;
}

type Tab = 'all' | 'memo' | 'ai';

const SPEAKER_DOT_COLORS: Record<string, string> = {
  A: '#8B5CF6',
  B: '#10B981',
  C: '#F59E0B',
  D: '#3B82F6',
};

/** 상세 화면 액센트 — 이미지 #13 기준 블루(탭 활성·진행바·재생/주요 버튼). 기존 보라(#9B5DFF) 대체. */
const BLUE = '#3B82F6';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** "30분 40초" / "5분" / "12초" */
function formatDurationKor(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const sec = Math.floor(totalSeconds % 60);
  if (m === 0) return `${sec}초`;
  if (sec === 0) return `${m}분`;
  return `${m}분 ${sec}초`;
}

/** "00:01" */
function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${pad(m)}:${pad(sec)}`;
}

function getSpeakerDotColor(speaker: string): string {
  return SPEAKER_DOT_COLORS[speaker] ?? COLORS.gray[400];
}

function getSpeakerNumberLabel(
  speaker: string,
  speakerMap?: Record<string, string> | null,
): string {
  if (speakerMap?.[speaker]) return speakerMap[speaker];
  const idx = speaker.charCodeAt(0) - 'A'.charCodeAt(0) + 1;
  return idx > 0 && idx <= 26 ? `화자 ${idx}` : `화자 ${speaker}`;
}

export function CompletedScreen({
  fieldNote,
  existingFieldNote,
  fieldNoteId,
  completedView,
  onBack,
  onDelete,
}: CompletedScreenProps) {
  useDarkNavBarWhileMounted();
  const { centerId, notify: showToast, navigate } = useFieldNotePlatform();
  const [showLinkSheet, setShowLinkSheet] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  // 확인 모달(화자분리·상담일지) state 는 이 화면이 아니라 각 버튼 컴포넌트(DiarizeBar·
  // GenerateNoteButton)가 소유한다 — 모달 열기가 긴 전사 리스트 리렌더를 유발하지 않도록.
  const [tab, setTab] = useState<Tab>('all');

  // Mount fade-in animation
  const mountOpacity = useSharedValue(0);
  useEffect(() => {
    mountOpacity.value = withTiming(1, {
      duration: 300,
      easing: Easing.bezier(0, 0, 0.2, 1),
    });
  }, []);

  // 탭 underline 슬라이드 애니메이션 — index 0/1/2 사이를 부드럽게 이동.
  // tabsRow 의 실측 width 를 기반으로 픽셀 단위 transform.
  const TABS: readonly Tab[] = ['all', 'memo', 'ai'] as const;
  const tabIndex = TABS.indexOf(tab);
  const tabIndicator = useSharedValue(tabIndex);
  // 셀 폭은 shared value 로 — onLayout 측정값을 UI 스레드에 직접 반영해, 첫 마운트에도
  // (탭 없이) 언더라인이 즉시 보이게 한다. (plain state + 조건부 마운트는 첫 프레임 레이스로
  // 탭하기 전까지 안 보이던 문제.)
  const tabCellWidth = useSharedValue(0);
  useEffect(() => {
    tabIndicator.value = withTiming(tabIndex, {
      duration: 240,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
    });
  }, [tabIndex, tabIndicator]);
  // 언더라인 = 탭 영역 전체 너비를 N등분한 셀 폭. 활성 탭 셀 전체 하단에 깔린다.
  const tabIndicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tabIndicator.value * tabCellWidth.value }],
    width: tabCellWidth.value,
  }));

  const {
    timelineItems,
    transcriptScrollRef,
    audioPlayer,
    speakerMap,
    handleShare,
    handleCopy,
  } = completedView;

  const fn = fieldNote ?? existingFieldNote;
  const totalDuration = fn?.total_duration ?? 0;
  const summary = fn?.summary ?? '';
  const analysis = fn?.analysis ?? null;
  const summaryStatus = fn?.summary_status ?? 'none';
  // 검사(task) 연결 노트도 연결된 것 — schedule 만 보면 검사 노트에 "회기 연결" 유도가 오표시된다.
  const isLinked = !!(fn?.schedule_id || fn?.task_id);

  const generateSummaryMutation = useGenerateSummary(centerId, fieldNoteId);
  const runPipelineMutation = useRunPipeline(centerId, fieldNoteId);
  // 전사 데이터 존재 여부 — 없으면 run-pipeline 으로 transcribe 부터 시작해야 함.
  // 있으면 generate-summary 만 호출해서 비용/시간 절약.
  // 화자분리 결과(diarized_transcript)도 전사로 인정 — transcribe 는 diarized 만 채운다.
  const hasTranscript =
    !!fn?.refined_transcript ||
    !!fn?.audios?.some(
      (a) => !!a.diarized_transcript || (a.transcript_status === 'completed' && !!a.transcript),
    );
  const startAnalysisMutation = hasTranscript
    ? generateSummaryMutation
    : runPipelineMutation;
  const isStartingSummary = startAnalysisMutation.isPending;

  // 메모/태그만 필터
  const memoItems = useMemo(
    () =>
      timelineItems.filter(
        (i) => i.type === 'memo' || i.type === 'tag',
      ),
    [timelineItems],
  );

  const handleSeekRelative = useCallback(
    (deltaSec: number) => {
      const next = Math.max(
        0,
        audioPlayer.positionRef.current + deltaSec,
      );
      audioPlayer.seekTo(next);
    },
    [audioPlayer],
  );

  // === 상담일지 초안 자동 생성 (A) ===
  const router = useRouter();
  const queryClient = useQueryClient();
  // showToast/navigate/centerId 는 useFieldNotePlatform()에서 (위 상단 destructure)
  const noteStatus = fn?.note_status ?? 'none';
  const generateNoteMutation = useGenerateCounselingNote(centerId, fieldNoteId);
  const isGeneratingNote =
    noteStatus === 'processing' || generateNoteMutation.isPending;
  // 회기 연결 + 분석(요약) 완료여야 일지 생성 의미 있음
  const canGenerateNote = isLinked && summaryStatus === 'completed';

  useCounselingNoteGenerationComplete(fn?.note_status, {
    onComplete: () =>
      showToast({
        type: 'success',
        message: '상담일지 초안을 만들었어요. 눌러서 확인하기',
        durationMs: 4000,
        onPress: () => navigate.toCounselingNotes(),
      }),
    onFailed: () =>
      showToast({
        type: 'error',
        message: '상담일지 생성에 실패했어요. 다시 시도해 주세요',
      }),
  });

  const handleConfirmGenerateNote = useCallback(() => {
    generateNoteMutation.mutate(undefined, {
      onSuccess: (data) => {
        showToast({
          type: data.status === 'started' ? 'info' : 'error',
          message:
            data.status === 'started'
              ? '상담일지 초안을 만들고 있어요'
              : (data.message ?? '상담일지를 만들 수 없어요'),
        });
      },
      onError: () =>
        showToast({
          type: 'error',
          message: '요청에 실패했어요. 다시 시도해 주세요',
        }),
    });
  }, [generateNoteMutation, showToast]);

  // === 화자분리 (유료 온디맨드) ===
  const diarizationStatus = fn?.diarization_status ?? 'none';
  const isDiarized = diarizationStatus === 'completed';
  const diarizeMutation = useDiarize(centerId, fieldNoteId);
  const isDiarizing =
    diarizationStatus === 'processing' || diarizeMutation.isPending;

  const handleConfirmDiarize = useCallback(() => {
    diarizeMutation.mutate(undefined, {
      onSuccess: (data) => {
        showToast({
          type: data.status === 'started' ? 'info' : 'error',
          message:
            data.status === 'started'
              ? '화자를 분리하고 있어요'
              : data.status === 'insufficient_credit'
                ? '크레딧이 부족해요'
                : (data.message ?? '화자 분리를 시작할 수 없어요'),
        });
      },
      onError: () =>
        showToast({
          type: 'error',
          message: '요청에 실패했어요. 다시 시도해 주세요',
        }),
    });
  }, [diarizeMutation, showToast]);

  // '회기 보기' 탭 시 경유 라우트 없이 바로 넘어가도록 연결된 일정 상세를 미리 데운다.
  // (홈과 달리 필드노트 상세엔 prewarm이 없어 콜드 캐시면 경유 라우트가 한 박자 떴다 넘어간다)
  useScheduleDetail(centerId, fn?.schedule_id ?? null);

  // schedule_id 로 연결된 회기(상담 상세)로 이동.
  // 일정 상세 캐시가 있으면 회기 상세로 바로, 없으면 경유 라우트(fetch 후 replace)로 폴백한다.
  const goToLinkedSession = useCallback(
    (scheduleId: string) => {
      openScheduleDetail(router, queryClient, centerId, scheduleId);
    },
    [router, queryClient, centerId],
  );

  // task_id 로 연결된 검사(case 상세)로 이동. /(main)/assessment/[id] 의 id = case_id.
  const goToLinkedTask = useCallback(
    (caseId: string) => {
      navigate.toAssessmentCase(caseId);
    },
    [navigate],
  );

  // === B: 회기 연결 직후 — 스낵바 탭 시 연결된 회기로 이동 ===
  const handleLinkSuccess = useCallback(
    (scheduleId: string) => {
      setShowLinkSheet(false);
      showToast({
        type: 'success',
        message: '회기를 연결했어요. 눌러서 회기 보기',
        durationMs: 4000,
        onPress: () => goToLinkedSession(scheduleId),
      });
    },
    [showToast, goToLinkedSession],
  );

  // 검사 task 연결 — 라우트 아웃 없이(다크 톤 유지) 닫고 토스트만.
  const handleTaskLinkSuccess = useCallback(() => {
    setShowLinkSheet(false);
    showToast({ type: 'success', message: '검사에 연결했어요' });
  }, [showToast]);

  const onCopy = useCallback(async () => {
    const ok = await handleCopy();
    showToast(
      ok
        ? { type: 'success', message: '전사 내용을 복사했어요' }
        : { type: 'error', message: '복사하지 못했어요. 다시 시도해 주세요' },
    );
  }, [handleCopy, showToast]);

  // 시크 함수 최신값 ref — 행마다 새 클로저를 만들지 않는 안정 콜백(handleRowSeek)의 재료.
  const seekRef = useRef(audioPlayer.seekTo);
  seekRef.current = audioPlayer.seekTo;
  // 전사 행 공용 안정 콜백 — 메모이즈된 TimelineRow 의 props 가 렌더마다 안 바뀌게.
  const handleRowSeek = useCallback((t: number) => {
    void seekRef.current(t, true);
  }, []);
  const rowOffsetsRef = useRef<number[]>([]);
  const handleRowLayout = useCallback((idx: number, y: number) => {
    rowOffsetsRef.current[idx] = y;
  }, []);

  // 화자 필터 — 전사에 등장하는 화자별로 모아보기.
  const speakers = useMemo(() => {
    const set = new Set<string>();
    for (const it of timelineItems) {
      if (it.type === 'speaker' && it.speaker) set.add(it.speaker);
    }
    return Array.from(set).sort();
  }, [timelineItems]);
  const [speakerFilter, setSpeakerFilter] = useState<string | null>(null);
  // 화자분리 후 보기 모드 — 말풍선(화자) ↔ 원본(시간+텍스트 평문).
  // 화자 라벨이 의심될 때 원본 흐름으로 대조하는 용도. 화자분리는 텍스트를 바꾸지
  // 않으므로(text-diarize) 같은 세그먼트를 레이아웃만 달리 렌더한다.
  const [transcriptView, setTranscriptView] = useState<'speakers' | 'plain'>('speakers');
  const showSpeakerView = isDiarized && transcriptView === 'speakers';

  const visibleItems = useMemo(() => {
    if (tab === 'memo') return memoItems;
    // 화자 필터는 화자 보기에서만 의미 — 원본 보기에선 무시
    if (tab === 'all' && speakerFilter && showSpeakerView) {
      return timelineItems.filter(
        (i) => i.type === 'speaker' && i.speaker === speakerFilter,
      );
    }
    return timelineItems;
  }, [tab, memoItems, timelineItems, speakerFilter, showSpeakerView]);

  // 활성(현재 재생) 아이템 — 위치 스토어 구독으로 산출.
  // 재생 위치는 매 틱(~500ms) 갱신되지만, 활성 "행"은 발화 단위(수 초)로만 바뀐다.
  // 위치 스토어를 비반응형 subscribe 로 듣고 행 index 가 실제로 바뀔 때만 setState —
  // 화면(긴 전사 리스트)은 틱마다 리렌더되지 않는다.
  const [activeIdx, setActiveIdx] = useState(-1);
  const activeItem = activeIdx >= 0 ? (timelineItems[activeIdx] ?? null) : null;

  const indexForPos = useCallback(
    (pos: number) => {
      for (let i = timelineItems.length - 1; i >= 0; i--) {
        const it = timelineItems[i];
        const t = 'startSeconds' in it ? it.startSeconds : it.timestampSeconds;
        if (pos >= t) return i;
      }
      return -1;
    },
    [timelineItems],
  );
  const indexForPosRef = useRef(indexForPos);
  indexForPosRef.current = indexForPos;
  // 구독 콜백에서 최신 플레이어 상태를 읽기 위한 ref (하이라이트 게이트: 트랙 로드 전엔 표시 X).
  const playerStateRef = useRef(audioPlayer.state);
  playerStateRef.current = audioPlayer.state;
  // 스크럽 드래그 중 여부 — 드래그 중엔 라이브 위치 대신 손가락 위치(handleScrubPos)가 담당.
  const scrubDraggingRef = useRef(false);

  useEffect(() => {
    const unsub = usePlaybackPositionStore.subscribe((s2) => {
      if (scrubDraggingRef.current) return;
      const ps = playerStateRef.current;
      if (!ps.isPlaying && !ps.isLoading && ps.currentChunkIndex === -1) {
        // 정지(트랙 언로드) — 하이라이트 해제 (기존 activeTimelineIndex=-1 동작 보존)
        setActiveIdx((prev) => (prev === -1 ? prev : -1));
        return;
      }
      const idx = indexForPosRef.current(s2.positionSec);
      setActiveIdx((prev) => (prev === idx ? prev : idx));
    });
    return unsub;
  }, []);

  // 전사 아이템이 재구성되면(화자분리 완료 등) 현재 위치 기준으로 활성 행을 재계산 —
  // 옛 index 가 새 배열의 엉뚱한 행을 가리키지 않게.
  useEffect(() => {
    const ps = playerStateRef.current;
    if (!ps.isPlaying && !ps.isLoading && ps.currentChunkIndex === -1) {
      setActiveIdx(-1);
      return;
    }
    setActiveIdx(indexForPos(audioPlayer.positionRef.current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timelineItems]);

  // 재생바 스크럽 위치 → 하이라이트 동기화 (PlayerBar 가 호출).
  // 드래그 중에도 행 index 가 바뀔 때만 setState — 손가락 이동마다 리렌더하지 않는다.
  // 스크럽 '손 뗀 직후' 강제 스크롤 트리거. 탭 시 grant 때 이미 activeIdx 가 sought 로 맞춰지면
  // release 에서 setActiveIdx 가 같은 값이라 activeItem 이 안 바뀌고(=스크롤 effect 미발화),
  // 다음 재생 행 변화(수 초 뒤)까지 스크롤이 안 따라오는 딜레이가 생긴다. 이 틱을 올려 강제 발화.
  const [scrubReleaseTick, setScrubReleaseTick] = useState(0);
  const handleScrubPos = useCallback((sec: number | null, dragging: boolean) => {
    scrubDraggingRef.current = dragging;
    if (sec == null) return; // pending 해제 → 라이브 구독이 이어받음
    const idx = indexForPosRef.current(sec);
    setActiveIdx((prev) => (prev === idx ? prev : idx));
    if (!dragging) setScrubReleaseTick((t) => t + 1); // 손 뗌 → activeItem 불변이어도 스크롤
  }, []);

  // 활성 아이템 → 전사 스크롤 동기화.
  // 각 행의 onLayout 으로 기록한 y 오프셋으로 부드럽게 스크롤한다.
  // 단, 드래그 중엔 스크롤하지 않는다 — 손가락은 하단 바를 잡고 있는데 위쪽 텍스트가
  // 같이 흘러가면 시선이 분산되므로. 손을 떼는 순간(seek 확정) 또는 재생 중 변화일 때만 이동.
  const lastScrolledRef = useRef(-1);
  useEffect(() => {
    if (tab !== 'all' || scrubDraggingRef.current || !activeItem) return;
    const idx = visibleItems.indexOf(activeItem);
    if (idx < 0 || idx === lastScrolledRef.current) return;
    lastScrolledRef.current = idx;
    const y = rowOffsetsRef.current[idx];
    if (y != null && transcriptScrollRef.current) {
      transcriptScrollRef.current.scrollTo({ y: Math.max(0, y - s(80)), animated: true });
    }
    // scrubReleaseTick: 손 뗀 직후 activeItem 이 안 바뀌어도 이 effect 를 재실행시켜 스크롤시킴
  }, [activeItem, visibleItems, tab, transcriptScrollRef, scrubReleaseTick]);

  const mountFadeStyle = useAnimatedStyle(() => ({
    opacity: mountOpacity.value,
  }));

  return (
    <View style={styles.root}>
      <RAnimated.View style={[styles.fill, mountFadeStyle]}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {/* Top bar — back + 복사/공유 */}
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={onBack}
            style={styles.backBtn}
            hitSlop={10}
          >
            <Ionicons name="chevron-back" size={s(24)} color={COLORS.fieldnoteDark.text} />
          </TouchableOpacity>
          <View style={styles.topBarActions}>
            <TouchableOpacity
              onPress={onCopy}
              style={styles.actionBtn}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="전사 내용 복사"
            >
              <Ionicons name="copy-outline" size={s(21)} color={COLORS.fieldnoteDark.text} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleShare}
              style={styles.actionBtn}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="전사 내용 공유"
            >
              <Ionicons name="share-outline" size={s(22)} color={COLORS.fieldnoteDark.text} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowDelete(true)}
              style={styles.actionBtn}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="필드노트 삭제"
            >
              <Ionicons name="trash-outline" size={s(21)} color={COLORS.fieldnoteDark.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>
              {fn?.created_at ? `${formatKstDateTime(fn.created_at)} 녹음` : '녹음'}
            </Text>
            <View style={styles.durationWrap}>
              <Ionicons name="time-outline" size={s(13)} color={COLORS.fieldnoteDark.sub} />
              <Text style={styles.durationText}>{formatDurationKor(totalDuration)}</Text>
            </View>
          </View>
          {isLinked ? (
            fn?.schedule_id ? (
              <TouchableOpacity
                style={styles.sessionLinkBtn}
                onPress={() => goToLinkedSession(fn.schedule_id!)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="calendar-outline"
                  size={s(14)}
                  color={COLORS.fieldnoteDark.sub}
                />
                <Text style={styles.sessionLinkBtnText}>회기 보기</Text>
                <Ionicons
                  name="chevron-forward"
                  size={s(14)}
                  color={COLORS.fieldnoteDark.sub}
                />
              </TouchableOpacity>
            ) : fn?.task?.case_id ? (
              <TouchableOpacity
                style={styles.sessionLinkBtn}
                onPress={() => goToLinkedTask(fn.task!.case_id!)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="clipboard-outline"
                  size={s(14)}
                  color={COLORS.fieldnoteDark.sub}
                />
                <Text style={styles.sessionLinkBtnText}>검사 보기</Text>
                <Ionicons
                  name="chevron-forward"
                  size={s(14)}
                  color={COLORS.fieldnoteDark.sub}
                />
              </TouchableOpacity>
            ) : null
          ) : (
            <TouchableOpacity
              style={styles.linkBtn}
              onPress={() => setShowLinkSheet(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.linkBtnText}>회기 연결하기</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Tabs */}
        <View
          style={styles.tabsRow}
          onLayout={(e) => {
            tabCellWidth.value = e.nativeEvent.layout.width / TABS.length;
          }}
        >
          {TABS.map((t) => {
            const label =
              t === 'all' ? '전체 대화' : t === 'memo' ? '메모 내용' : 'AI 분석';
            const active = tab === t;
            return (
              <TouchableOpacity
                key={t}
                style={styles.tab}
                onPress={() => setTab(t)}
                activeOpacity={0.7}
              >
                <Text
                  style={[styles.tabText, active && styles.tabTextActive]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
          <RAnimated.View
            pointerEvents="none"
            style={[styles.tabUnderline, tabIndicatorStyle]}
          />
        </View>

        {/* Content */}
        {tab === 'ai' ? (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.aiContent}
            showsVerticalScrollIndicator={false}
          >
            {summaryStatus === 'completed' && (summary || analysis) ? (
              <View style={styles.aiCompletedWrap}>
                {analysis ? (
                  <AIAnalysisView
                    analysis={analysis}
                    summaryFallback={summary}
                    onSeek={handleRowSeek}
                  />
                ) : (
                  <Text style={styles.aiSummaryText}>
                    {summary.replace(/\*\*/g, '').replace(/^#+\s/gm, '')}
                  </Text>
                )}

                {/* 상담일지 초안 자동 생성 (A) — 확인 모달은 버튼 컴포넌트가 소유 */}
                {canGenerateNote && (
                  <GenerateNoteButton
                    noteStatus={noteStatus}
                    isGenerating={isGeneratingNote}
                    onConfirm={handleConfirmGenerateNote}
                    onOpenNotes={() => navigate.toCounselingNotes()}
                  />
                )}

                <TouchableOpacity
                  onPress={() => startAnalysisMutation.mutate()}
                  disabled={isStartingSummary}
                  style={styles.aiRegenerateBtn}
                  activeOpacity={0.7}
                >
                  {isStartingSummary ? (
                    <ActivityIndicator size="small" color={COLORS.fieldnoteDark.sub} />
                  ) : (
                    <Text style={styles.aiRegenerateText}>다시 분석</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : summaryStatus === 'generating' ? (
              <View style={styles.aiCenter}>
                <ActivityIndicator size="small" color={COLORS.fieldnoteDark.sub} />
                <Text style={styles.aiCenterText}>
                  분석 중이에요. 잠시만 기다려주세요
                </Text>
              </View>
            ) : summaryStatus === 'failed' ? (
              <View style={styles.aiCenter}>
                <Text style={styles.aiFailTitle}>분석에 실패했어요</Text>
                <Text style={styles.aiFailDesc}>
                  잠시 후 다시 시도해주세요
                </Text>
                <TouchableOpacity
                  onPress={() => startAnalysisMutation.mutate()}
                  disabled={isStartingSummary}
                  style={styles.aiPrimaryBtn}
                  activeOpacity={0.85}
                >
                  {isStartingSummary ? (
                    <ActivityIndicator size="small" color={COLORS.white} />
                  ) : (
                    <Text style={styles.aiPrimaryBtnText}>다시 시도</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              // 미분석 — 블러 처리된 예시 대시보드 미리보기 + "AI 분석하기" CTA(온디맨드).
              <AIAnalysisTeaser
                onAnalyze={() => startAnalysisMutation.mutate()}
                loading={isStartingSummary}
              />
            )}
          </ScrollView>
        ) : (
          <>
            {/* 화자분리(유료 온디맨드) — 전사는 됐지만 아직 화자 구분 전인 노트에만 노출.
                확인 모달 state 는 DiarizeBar 가 소유(모달 열기가 전사 리스트 리렌더 유발 X). */}
            {tab === 'all' &&
              !isDiarized &&
              timelineItems.some(
                (i) => i.type === 'speaker' || i.type === 'transcript',
              ) && (
                <DiarizeBar isDiarizing={isDiarizing} onConfirm={handleConfirmDiarize} />
              )}

            {/* 화자 필터 + 보기 토글 — 화자분리 완료 시. 원본 보기에선 필터 숨김(평문엔 무의미) */}
            {tab === 'all' && isDiarized && speakers.length >= 1 && (
              <View style={styles.speakerFilterRow}>
                {showSpeakerView && speakers.length >= 2 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.speakerFilterBar}
                    contentContainerStyle={styles.speakerFilterContent}
                  >
                    <Segment
                      value={speakerFilter ?? '__all__'}
                      onChange={(v) => setSpeakerFilter(v === '__all__' ? null : v)}
                      options={[
                        { value: '__all__', label: '전체' },
                        ...speakers.map((sp) => ({
                          value: sp,
                          label: getSpeakerNumberLabel(sp, speakerMap),
                        })),
                      ]}
                      dark
                      activeColor={BLUE}
                    />
                  </ScrollView>
                ) : (
                  <Text style={styles.viewModeHint}>
                    {showSpeakerView ? '' : '원본 전사 — 화자 구분 없이 시간순'}
                  </Text>
                )}
                <TouchableOpacity
                  onPress={() =>
                    setTranscriptView((v) => (v === 'speakers' ? 'plain' : 'speakers'))
                  }
                  style={styles.viewToggleBtn}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={showSpeakerView ? '원본 전사 보기' : '화자분리 보기'}
                >
                  <Ionicons
                    name={showSpeakerView ? 'document-text-outline' : 'people-outline'}
                    size={s(13)}
                    color={BLUE}
                  />
                  <Text style={styles.viewToggleText}>
                    {showSpeakerView ? '원본' : '화자'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
            <ScrollView
              ref={transcriptScrollRef}
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {visibleItems.length > 0 ? (
                visibleItems.map((item, idx) => (
                  <TimelineRow
                    key={idx}
                    index={idx}
                    item={item}
                    isActive={tab === 'all' && item === activeItem}
                    speakerMap={speakerMap}
                    showSpeaker={showSpeakerView}
                    onSeek={handleRowSeek}
                    onLayoutRow={handleRowLayout}
                  />
                ))
              ) : (
                <Text style={styles.emptyText}>
                  {tab === 'memo' ? '입력된 메모가 없어요' : '전사된 내용이 없어요'}
                </Text>
              )}
            </ScrollView>
          </>
        )}

        {/* Audio player — 라이브 위치(매 틱)는 PlayerBar 만 구독, 화면 전체는 리렌더 안 됨 */}
        {audioPlayer.state.totalDurationSec > 0 && (
          <PlayerBar
            audioPlayer={audioPlayer}
            onScrubPos={handleScrubPos}
            onSeekRelative={handleSeekRelative}
          />
        )}
      </SafeAreaView>

      <LinkScheduleSheet
        visible={showLinkSheet}
        centerId={centerId}
        fieldNoteId={fieldNoteId}
        onSuccess={handleLinkSuccess}
        onTaskSuccess={handleTaskLinkSuccess}
        onClose={() => setShowLinkSheet(false)}
      />

      <FieldNoteConfirmModal
        visible={showDelete}
        title="필드노트를 삭제할까요?"
        message="삭제한 필드노트는 복구할 수 없어요."
        confirmLabel="삭제"
        cancelLabel="취소"
        destructive
        onConfirm={() => {
          setShowDelete(false);
          onDelete();
        }}
        onCancel={() => setShowDelete(false)}
      />

      </RAnimated.View>
    </View>
  );
}

/**
 * 화자분리 바 — 확인 모달 state 를 자체 소유.
 * 버튼 탭이 CompletedScreen(긴 전사 리스트) 리렌더를 유발하지 않아 모달이 끊김 없이 뜬다.
 */
function DiarizeBar({
  isDiarizing,
  onConfirm,
}: {
  isDiarizing: boolean;
  onConfirm: () => void;
}) {
  const [showConfirm, setShowConfirm] = useState(false);
  return (
    <View style={styles.diarizeBar}>
      {isDiarizing ? (
        <>
          <ActivityIndicator size="small" color={FND.sub} />
          <Text style={styles.diarizeProcessingText}>화자를 분리하고 있어요…</Text>
        </>
      ) : (
        <TouchableOpacity
          style={styles.diarizeBtn}
          onPress={() => setShowConfirm(true)}
          activeOpacity={0.85}
        >
          <Ionicons name="sparkles" size={s(15)} color={FND.text} />
          <Text style={styles.diarizeBtnText}>자동 화자 분리</Text>
        </TouchableOpacity>
      )}
      <ConfirmModal
        visible={showConfirm}
        title="자동 화자 분리"
        message="녹음을 분석해 상담사와 내담자의 발화를 자동으로 구분해요. 녹음 길이에 따라 크레딧이 소모돼요."
        confirmLabel="분리하기"
        cancelLabel="취소"
        onConfirm={() => {
          setShowConfirm(false);
          onConfirm();
        }}
        onCancel={() => setShowConfirm(false)}
      />
    </View>
  );
}

/** 상담일지 초안 버튼 — 확인 모달 state 자체 소유 (DiarizeBar 와 동일 패턴). */
function GenerateNoteButton({
  noteStatus,
  isGenerating,
  onConfirm,
  onOpenNotes,
}: {
  noteStatus: string;
  isGenerating: boolean;
  onConfirm: () => void;
  onOpenNotes: () => void;
}) {
  const [showConfirm, setShowConfirm] = useState(false);
  if (noteStatus === 'completed') {
    return (
      <TouchableOpacity onPress={onOpenNotes} style={styles.aiPrimaryBtn} activeOpacity={0.85}>
        <Text style={styles.aiPrimaryBtnText}>상담일지 보기</Text>
      </TouchableOpacity>
    );
  }
  return (
    <>
      <TouchableOpacity
        onPress={() => setShowConfirm(true)}
        disabled={isGenerating}
        style={styles.aiPrimaryBtn}
        activeOpacity={0.85}
      >
        {isGenerating ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6) }}>
            <ActivityIndicator size="small" color={COLORS.white} />
            <Text style={styles.aiPrimaryBtnText}>상담일지 작성 중…</Text>
          </View>
        ) : (
          <Text style={styles.aiPrimaryBtnText}>
            {noteStatus === 'failed' ? '상담일지 다시 만들기' : '상담일지 초안 만들기'}
          </Text>
        )}
      </TouchableOpacity>
      <ConfirmModal
        visible={showConfirm}
        title="상담일지 초안 만들기"
        message="녹취·요약을 바탕으로 이 회기의 상담일지 초안을 만들어요. 회기에 참여한 내담자 모두에게 생성되며, 내담자 1명당 약 8 크레딧이 소모돼요."
        confirmLabel="만들기"
        cancelLabel="취소"
        onConfirm={() => {
          setShowConfirm(false);
          onConfirm();
        }}
        onCancel={() => setShowConfirm(false)}
      />
    </>
  );
}

/**
 * 재생바 — 라이브 위치(매 틱)와 스크럽 state 를 자체 소유.
 * 위치 스토어(usePlaybackPositionStore)를 이 컴포넌트만 구독해, 재생 중 틱마다
 * 리렌더되는 범위를 이 작은 바로 한정한다. 스크럽 위치는 onScrubPos 로 상위에
 * 알리되, 상위는 활성 "행"이 바뀔 때만 setState 한다.
 */
function PlayerBar({
  audioPlayer,
  onScrubPos,
  onSeekRelative,
}: {
  audioPlayer: CompletedViewData['audioPlayer'];
  onScrubPos: (sec: number | null, dragging: boolean) => void;
  onSeekRelative: (deltaSec: number) => void;
}) {
  const insets = useSafeAreaInsets();
  const positionSec = usePlaybackPositionStore((st) => st.positionSec);
  const total = audioPlayer.state.totalDurationSec;
  const progressPct = total > 0 ? Math.min(100, (positionSec / total) * 100) : 0;

  // 재생바 스크럽(탭/드래그) — track 폭을 측정해 터치 위치를 초로 환산해 seek.
  // 드래그 중엔 scrubFrac 으로 썸을 손가락에 붙이고, 손 떼면 그 지점으로 seek+재생.
  // PanResponder 는 1회만 생성하고 최신값은 ref 로 읽어 stale closure 를 피한다.
  const trackWidthRef = useRef(0);
  const totalDurRef = useRef(0);
  totalDurRef.current = total;
  const seekRef = useRef(audioPlayer.seekTo);
  seekRef.current = audioPlayer.seekTo;
  // scrubFrac: 손가락 드래그 중 위치. pendingFrac: 손 뗀 뒤 '목표' 위치 —
  // 실제 재생 위치가 따라잡기 전까지 썸을 여기에 고정해 '왔다갔다' 를 없앤다.
  const [scrubFrac, setScrubFrac] = useState<number | null>(null);
  const [pendingFrac, setPendingFrac] = useState<number | null>(null);
  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
  const progressPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const w = trackWidthRef.current;
        if (w > 0) setScrubFrac(clamp01(e.nativeEvent.locationX / w));
      },
      onPanResponderMove: (e) => {
        const w = trackWidthRef.current;
        if (w > 0) setScrubFrac(clamp01(e.nativeEvent.locationX / w));
      },
      onPanResponderRelease: (e) => {
        const w = trackWidthRef.current;
        const frac = w > 0 ? clamp01(e.nativeEvent.locationX / w) : null;
        if (frac != null) {
          setPendingFrac(frac); // 목표 위치 고정 (live 가 따라잡을 때까지)
          void seekRef.current(frac * totalDurRef.current, true);
        }
        setScrubFrac(null);
      },
      onPanResponderTerminate: () => setScrubFrac(null),
    }),
  ).current;

  // pending 해제 — 실제 재생 위치가 목표에 충분히 근접하면 live 값으로 매끄럽게 인계.
  // 안전장치: 시크 실패/일시정지 등으로 따라잡지 못해도 일정 시간 뒤 무조건 해제(썸 고착 방지).
  useEffect(() => {
    if (pendingFrac == null) return;
    if (total > 0 && Math.abs(positionSec / total - pendingFrac) < 0.012) {
      setPendingFrac(null);
      return;
    }
    const t = setTimeout(() => setPendingFrac(null), 700);
    return () => clearTimeout(t);
  }, [pendingFrac, positionSec, total]);

  // 스크럽/목표 위치 → 상위 하이라이트 동기화 (행 index 변화시에만 상위 setState).
  useEffect(() => {
    const frac = scrubFrac ?? pendingFrac;
    onScrubPos(frac != null ? frac * totalDurRef.current : null, scrubFrac != null);
  }, [scrubFrac, pendingFrac, onScrubPos]);

  const displayPct =
    scrubFrac != null
      ? scrubFrac * 100
      : pendingFrac != null
        ? pendingFrac * 100
        : progressPct;

  return (
    <View style={styles.playerBarShadow}>
      {/* 글래스 — 뒤 전사 내용이 흐릿하게 비치는 프로스티드 독(홈 탭과 동일 기법) */}
      <BlurView
        intensity={50}
        tint="dark"
        experimentalBlurMethod="dimezisBlurView"
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.playerBarSurface, { height: s(108) + insets.bottom, paddingBottom: insets.bottom }]}>
      <View
        style={styles.progressTouch}
        onLayout={(e) => {
          trackWidthRef.current = e.nativeEvent.layout.width;
        }}
        {...progressPan.panHandlers}
      >
        {/* pointerEvents="none" 필수 — 없으면 터치가 trackFill/thumb(자식)에 잡혀
            e.nativeEvent.locationX 가 그 작은 자식 기준으로 측정된다(thumb 12px → ~6px).
            그러면 어디를 탭하든 frac≈0(맨 앞 ~54초)으로 시크되는 버그. 터치를 항상
            상위 progressTouch(전체 폭)가 받게 해 locationX 가 트랙 전체 기준이 되게 한다. */}
        <View style={styles.progressTrack} pointerEvents="none">
          <View style={[styles.progressFill, { width: `${displayPct}%` }]} />
          <View style={[styles.progressThumb, { left: `${displayPct}%` }]} />
        </View>
      </View>
      <View style={styles.controls}>
        <TouchableOpacity onPress={() => onSeekRelative(-5)} style={styles.skipBtn} hitSlop={8}>
          <Ionicons name="play-back-outline" size={s(26)} color={COLORS.fieldnoteDark.sub} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => audioPlayer.togglePlay()}
          style={styles.playBtn}
          activeOpacity={0.85}
        >
          {audioPlayer.state.isLoading ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <Ionicons
              name={audioPlayer.state.isPlaying ? 'pause' : 'play'}
              size={s(22)}
              color={COLORS.white}
            />
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onSeekRelative(5)} style={styles.skipBtn} hitSlop={8}>
          <Ionicons name="play-forward-outline" size={s(26)} color={COLORS.fieldnoteDark.sub} />
        </TouchableOpacity>
      </View>
      </View>
    </View>
  );
}

interface TimelineRowProps {
  item: TimelineItem;
  isActive: boolean;
  speakerMap: Record<string, string> | null;
  /** 화자 dot/라벨 노출 여부 — 화자분리 완료(유료) 시에만 true. 기본 평문은 시간+텍스트만. */
  showSpeaker?: boolean;
  onSeek: (sec: number) => void;
}

/**
 * 전사 행 — React.memo 로 메모이즈.
 * 전사는 수백 행이라 화면 state 변화(모달·재생 틱 등)마다 전부 재생성하면 JS 스레드가
 * 막혀 모달 등장 애니메이션이 버벅인다. props(onSeek/onLayoutRow/speakerMap)는 상위에서
 * 안정 참조로 내려와, isActive 가 바뀌는 행(최대 2개)만 리렌더된다.
 * onLayout 은 활성 대사 자동 스크롤용 y 오프셋 기록.
 */
const TimelineRow = React.memo(function TimelineRow({
  index,
  onLayoutRow,
  ...rest
}: TimelineRowProps & {
  index: number;
  onLayoutRow: (index: number, y: number) => void;
}) {
  return (
    <View onLayout={(e) => onLayoutRow(index, e.nativeEvent.layout.y)}>
      <TimelineRowInner {...rest} />
    </View>
  );
});

function TimelineRowInner({ item, isActive, speakerMap, showSpeaker = true, onSeek }: TimelineRowProps) {
  if (item.type === 'memo') {
    return (
      <TouchableOpacity
        style={styles.memoCard}
        onPress={() => onSeek(item.timestampSeconds)}
        activeOpacity={0.85}
      >
        <Text style={styles.memoTime}>{formatTimestamp(item.timestampSeconds)}</Text>
        <Text style={styles.memoContent}>{item.content}</Text>
      </TouchableOpacity>
    );
  }

  if (item.type === 'tag') {
    return (
      <TouchableOpacity
        style={styles.tagRow}
        onPress={() => onSeek(item.timestampSeconds)}
        activeOpacity={0.85}
      >
        <Text style={styles.tagTime}>{formatTimestamp(item.timestampSeconds)}</Text>
        <Text style={styles.tagText}>{`#${item.label}`}</Text>
      </TouchableOpacity>
    );
  }

  // speaker / transcript
  const startSec = item.startSeconds;
  const isSpeaker = item.type === 'speaker';
  // 화자분리 전(평문)에는 화자 dot/라벨을 숨기고 시간+텍스트만 — 타임라인 UX는 유지.
  const showSpeakerMeta = isSpeaker && showSpeaker;

  // 화자분리 완료 → 말풍선(좌/우 배치 + 화자색 버블). 화자 letter 짝수=좌, 홀수=우.
  if (showSpeakerMeta && item.type === 'speaker') {
    const color = getSpeakerDotColor(item.speaker);
    const speakerName = getSpeakerNumberLabel(item.speaker, speakerMap);
    // 역할 라벨(speaker_map)이 있으면 상담사=우/내담자=좌, 없으면 letter 짝홀 폴백.
    const mappedName = speakerMap?.[item.speaker];
    const isRight = mappedName
      ? mappedName === '상담사'
      : (item.speaker.charCodeAt(0) - 65) % 2 === 1;
    return (
      <TouchableOpacity
        onPress={() => onSeek(startSec)}
        activeOpacity={0.85}
        style={[styles.bubbleWrap, { alignItems: isRight ? 'flex-end' : 'flex-start' }]}
      >
        <View style={styles.bubbleLabelRow}>
          <View style={[styles.bubbleDot, { backgroundColor: color }]} />
          <Text style={[styles.bubbleSpeaker, { color }]}>{speakerName}</Text>
          <Text style={styles.bubbleTime}>{formatTimestamp(startSec)}</Text>
        </View>
        <View
          style={[
            styles.bubble,
            {
              backgroundColor: color + (isActive ? '2E' : '1A'),
              borderWidth: isActive ? 1 : 0,
              borderColor: color + '66',
              borderTopLeftRadius: isRight ? s(16) : s(5),
              borderTopRightRadius: isRight ? s(5) : s(16),
            },
          ]}
        >
          <Text style={styles.bubbleText}>{item.text}</Text>
        </View>
      </TouchableOpacity>
    );
  }

  // 미분리 평문(화자 숨김) / transcript 폴백 — 시간 + 텍스트만
  return (
    <TouchableOpacity
      style={[styles.speakerRow, isActive && styles.speakerRowActive]}
      onPress={() => onSeek(startSec)}
      activeOpacity={0.85}
    >
      <View style={styles.speakerHeader}>
        <Text style={styles.speakerTime}>{formatTimestamp(startSec)}</Text>
      </View>
      <Text style={styles.speakerText}>{item.text}</Text>
    </TouchableOpacity>
  );
}

const FND = COLORS.fieldnoteDark;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: FND.bg,
  },
  // 콘텐츠만 mount 페이드인 (다크 배경 root 는 항상 불투명 → 전환 시 흰 번쩍임 방지)
  fill: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
  topBar: {
    height: s(44),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: s(8),
  },
  backBtn: {
    width: s(40),
    height: s(40),
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(2),
  },
  actionBtn: {
    width: s(40),
    height: s(40),
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    paddingHorizontal: SPACING.lg,
    paddingTop: s(8),
    paddingBottom: s(16),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: s(12),
  },
  dateLabel: {
    fontSize: s(12),
    color: FND.sub,
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  durationWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(4),
  },
  durationText: {
    fontSize: s(12),
    color: FND.sub,
    fontVariant: ['tabular-nums'],
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  title: {
    fontSize: s(20),
    fontWeight: '700',
    color: FND.text,
    letterSpacing: TYPOGRAPHY.letterSpacing,
    flexShrink: 1,
    marginRight: s(8),
  },
  linkBtn: {
    alignSelf: 'flex-start',
    backgroundColor: FND.card,
    borderRadius: 999,
    paddingHorizontal: s(14),
    paddingVertical: s(8),
  },
  linkBtnText: {
    fontSize: s(13),
    fontWeight: '600',
    color: FND.text,
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  sessionLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(4),
    alignSelf: 'flex-start',
    backgroundColor: FND.card,
    borderRadius: 999,
    paddingHorizontal: s(12),
    paddingVertical: s(8),
  },
  sessionLinkBtnText: {
    fontSize: s(13),
    fontWeight: '600',
    color: FND.sub,
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  // ===== Tabs =====
  // 화면 전체 너비를 사용하고 자식이 flex: 1 로 균등 분할되도록 horizontal padding 없음.
  tabsRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: FND.line,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: s(12),
    position: 'relative',
  },
  tabText: {
    fontSize: s(14),
    fontWeight: '500',
    color: FND.sub,
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  tabTextActive: {
    color: BLUE,
    fontWeight: '700',
  },
  tabUnderline: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    // width 와 translateX 는 animated style 에서 inline 주입
    height: 2,
    backgroundColor: BLUE,
  },
  // ===== Scroll content =====
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: s(16),
    paddingBottom: s(160), // 하단 absolute 재생바(104 + 안드로이드 inset)에 마지막 줄이 안 가리게
    gap: s(16),
  },
  aiContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: s(16),
    paddingBottom: s(160),
  },
  emptyText: {
    fontSize: s(13),
    color: FND.sub,
    textAlign: 'center',
    paddingVertical: s(48),
  },
  aiSummaryText: {
    fontSize: s(14),
    color: FND.text,
    lineHeight: s(22),
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  aiCompletedWrap: {
    gap: s(20),
  },
  aiCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: s(48),
    gap: s(12),
  },
  aiCenterText: {
    fontSize: s(13),
    color: FND.sub,
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  aiEmptyTitle: {
    fontSize: s(15),
    fontWeight: '600',
    color: FND.text,
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  aiEmptyDesc: {
    fontSize: s(13),
    color: FND.sub,
    textAlign: 'center',
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  aiFailTitle: {
    fontSize: s(15),
    fontWeight: '600',
    color: COLORS.error,
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  aiFailDesc: {
    fontSize: s(13),
    color: FND.sub,
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  aiPrimaryBtn: {
    minWidth: s(140),
    height: s(44),
    paddingHorizontal: s(24),
    borderRadius: 12,
    backgroundColor: BLUE,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: s(4),
  },
  aiPrimaryBtnText: {
    fontSize: s(14),
    fontWeight: '600',
    color: COLORS.white,
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  aiRegenerateBtn: {
    alignSelf: 'center',
    paddingHorizontal: s(16),
    paddingVertical: s(8),
    borderRadius: 8,
    backgroundColor: FND.card,
  },
  aiRegenerateText: {
    fontSize: s(13),
    color: FND.text,
    fontWeight: '500',
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  // ===== Speaker / transcript row =====
  speakerRow: {
    paddingVertical: s(4),
  },
  speakerRowActive: {
    backgroundColor: FND.activeBg,
    borderRadius: 8,
    marginHorizontal: -s(8),
    paddingHorizontal: s(8),
  },
  speakerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(6),
    marginBottom: s(4),
  },
  speakerDot: {
    width: s(6),
    height: s(6),
    borderRadius: s(3),
  },
  speakerName: {
    fontSize: s(13),
    fontWeight: '600',
    color: FND.text,
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  speakerTime: {
    fontSize: s(12),
    color: FND.sub,
    fontVariant: ['tabular-nums'],
    letterSpacing: TYPOGRAPHY.letterSpacing,
    marginLeft: s(4),
  },
  speakerText: {
    fontSize: s(14),
    color: FND.text,
    lineHeight: s(22),
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  // ===== Memo card =====
  memoCard: {
    backgroundColor: '#181F2D',
    borderRadius: 12,
    paddingHorizontal: s(14),
    paddingVertical: s(12),
    gap: s(6),
  },
  memoTime: {
    fontSize: s(12),
    color: FND.sub,
    fontVariant: ['tabular-nums'],
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  memoContent: {
    fontSize: s(14),
    color: FND.text,
    lineHeight: s(20),
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  // ===== Tag =====
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(8),
    paddingVertical: s(4),
  },
  tagTime: {
    fontSize: s(12),
    color: FND.sub,
    fontVariant: ['tabular-nums'],
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  tagText: {
    fontSize: s(13),
    color: FND.text,
    fontWeight: '600',
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  // ===== Audio player =====
  // 재생바 — 글래스 독: BlurView 위 흰 10% 반투명 surface + 상단 보더 + 위쪽 드롭섀도(0,-5/11.9/#000 25%).
  // (이미지 스펙: #FFF 10% fill + background blur — 홈 탭 글래스와 동일하게 experimentalBlurMethod 사용.)
  playerBarShadow: {
    // 전사 위에 겹쳐 떠야 하단 콘텐츠가 가려지지 않고 독처럼 보인다(figma Top 708 = absolute).
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.25,
    shadowRadius: 11.9,
    elevation: 16,
  },
  playerBarSurface: {
    // 본체(세이프에어리어 제외) 고정 높이 108 — 높이/하단 패딩은 insets 의존이라 인라인 주입.
    paddingHorizontal: SPACING.lg,
    paddingTop: s(16),
    backgroundColor: 'rgba(255,255,255,0.10)', // #FFF 10% — 블러 위 글래스 필
    borderTopWidth: 1,
    borderTopColor: FND.line,
  },
  progressTouch: {
    // 트랙(4px) 위아래로 넉넉한 터치/드래그 영역 확보. (height:4 + hitSlop 으로 짓누르면
    // 일부 기기에서 onLayout 너비·locationX 측정이 틀어져 스크럽 위치가 어긋남 → 정상 높이 유지.)
    paddingVertical: s(10),
    justifyContent: 'center',
  },
  speakerFilterBar: {
    flexGrow: 0,
    flexShrink: 1,
  },
  speakerFilterContent: {
    paddingVertical: s(10),
  },
  // 화자 필터 + 보기 토글을 한 줄에 — 토글은 우측 고정
  speakerFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(8),
    paddingHorizontal: s(16),
    borderBottomWidth: 1,
    borderBottomColor: FND.line,
  },
  viewModeHint: {
    flex: 1,
    fontSize: s(12),
    color: FND.sub,
    paddingVertical: s(12),
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  viewToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(4),
    paddingHorizontal: s(10),
    paddingVertical: s(6),
    borderRadius: s(8),
    backgroundColor: 'rgba(59,130,246,0.14)', // 블루 액센트 톤(BLUE #3B82F6 @14%)
    marginLeft: 'auto',
  },
  viewToggleText: {
    fontSize: s(12),
    fontWeight: '600',
    color: BLUE,
  },
  diarizeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(8),
    paddingHorizontal: s(16),
    paddingTop: s(20), // 탭과 20px 간격
    paddingBottom: s(10),
  },
  diarizeBtn: {
    // 이미지 #13 — 풀폭 다크 칩 + 중앙 정렬 + ✨
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(6),
    paddingVertical: s(13),
    borderRadius: s(12),
    backgroundColor: '#2D333B', // bg/surface-sunken
  },
  diarizeBtnText: {
    fontSize: s(14),
    fontWeight: '600',
    color: FND.text,
  },
  diarizeProcessingText: {
    fontSize: s(13),
    color: FND.sub,
  },
  // 화자분리 완료 시 말풍선 (lab field-note-record-sheet 시안 포팅)
  bubbleWrap: {
    marginBottom: s(12),
  },
  bubbleLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(5),
    marginBottom: s(3),
    paddingHorizontal: s(2),
  },
  bubbleDot: {
    width: s(7),
    height: s(7),
    borderRadius: s(4),
  },
  bubbleSpeaker: {
    fontSize: s(12),
    fontWeight: '600',
  },
  bubbleTime: {
    fontSize: s(12),
    color: FND.sub,
    fontVariant: ['tabular-nums'],
  },
  bubble: {
    maxWidth: '84%',
    paddingHorizontal: s(13),
    paddingVertical: s(9),
    borderRadius: s(16),
  },
  bubbleText: {
    fontSize: s(15),
    color: FND.text,
    lineHeight: s(21),
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    position: 'relative',
    justifyContent: 'center',
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: BLUE,
    position: 'absolute',
    left: 0,
    top: 0,
  },
  progressThumb: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: BLUE,
    position: 'absolute',
    top: -4,
    marginLeft: -6,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(28),
    marginTop: s(16),
  },
  skipBtn: {
    width: s(44),
    height: s(44),
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtn: {
    width: s(44),
    height: s(44),
    borderRadius: s(22),
    backgroundColor: BLUE,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: BLUE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
});
