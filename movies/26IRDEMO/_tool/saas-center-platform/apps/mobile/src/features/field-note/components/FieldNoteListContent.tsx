import { memo, useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { format, isToday, isYesterday } from 'date-fns';
import { ko } from 'date-fns/locale';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useFieldNotePlatform } from '../platform/context';
// TODO(extraction): 알림 미읽음 카운트 훅은 아직 포트로 빼지 않음 — platform/EXTRACTION.md 참고
import { useUnreadCount } from '@/features/notification';
import {
  useFieldNotes,
  useDeleteFieldNote,
  type FieldNoteResponse,
} from '@/features/field-note';
import {
  AnalyzingPulseDot,
  MiniWaveform,
} from '@/features/field-note/components/AnalyzingIndicator';
import { COLORS } from '@/shared/constants/theme';
import { Typography } from '@/shared/components/ui/Typography';
import { SetBadge } from '@/shared/components/ui/Badge';
import { NotificationBell } from '@/shared/components/ui/NotificationBell';
import { useDelayedSkeleton } from '@/shared/components/ui/Skeleton';
import { parseDate } from '@/shared/utils/date';
import { s } from '@/shared/utils/scale';
import { FieldNoteDetailMorph, type Rect } from './FieldNoteDetailMorph';
import { FieldNoteListSkeleton } from './FieldNoteListSkeleton';
import { useRecordingStore, selectIsActive } from '@/features/field-note/recordingStore';
import { formatSeconds } from '@/features/field-note/utils';
import { RecordTargetSheet } from './RecordTargetSheet';

// 필드노트 다크 정체성 토큰
const FND = COLORS.fieldnoteDark;
// 홈과 동일 톤앤매너 — 페이지 배경·카드 배경 오버라이드(글로벌 토큰과 분리).
const HOME_BG = '#171717'; // bg-base
const HOME_CARD = '#1D2227'; // bg/surface
// 헤더 보이스 파형 모티프
const WAVE = [0.4, 0.7, 1, 0.55, 0.9, 0.45, 0.8, 0.5, 1, 0.6, 0.35, 0.75, 0.5, 0.85, 0.55, 0.7, 0.4];

// 필터 = 분석 축(전체·분석완료·미분석). 선녹음(link-at-start) 도입으로 "녹음 후 연결" 흐름이
// 사라져 연결/미연결 구분 실효성이 낮아짐 → AI 분석 여부로 전환. 카운트는 칩에 인라인.
type FilterKey = 'all' | 'analyzed' | 'unanalyzed';

type HeaderRow = { type: 'header'; key: string; label: string };
type NoteRow = { type: 'note'; data: FieldNoteResponse };
type ListRow = HeaderRow | NoteRow;

const isLinked = (fn: FieldNoteResponse): boolean => !!(fn.schedule_id || fn.task_id);
// AI 분석 완료 여부 — 요약 스텝(summary_status) 완료 기준 (§3-4-1 분석 탭 노출 조건과 동일).
const isAnalyzed = (fn: FieldNoteResponse): boolean => fn.summary_status === 'completed';

function getDateKey(iso: string): string {
  try {
    return format(parseDate(iso), 'yyyy-MM-dd');
  } catch {
    return 'unknown';
  }
}

/** 날짜 헤더 — 오늘/어제/날짜(시안의 "오늘" 그룹). */
function dateLabel(iso: string): string {
  try {
    const d = parseDate(iso);
    if (isToday(d)) return '오늘';
    if (isYesterday(d)) return '어제';
    return format(d, 'M월 d일 (E)', { locale: ko });
  } catch {
    return '날짜 미정';
  }
}

/** 날짜 그룹 + 노트 행(검사 클러스터 없이 노트당 한 카드 — 시안 구조). */
function buildRows(items: FieldNoteResponse[]): ListRow[] {
  const groups = new Map<string, { label: string; items: FieldNoteResponse[] }>();
  for (const fn of items) {
    const key = getDateKey(fn.created_at);
    if (!groups.has(key)) groups.set(key, { label: dateLabel(fn.created_at), items: [] });
    groups.get(key)!.items.push(fn);
  }
  const rows: ListRow[] = [];
  for (const [key, g] of groups) {
    rows.push({ type: 'header', key, label: g.label });
    for (const fn of g.items) rows.push({ type: 'note', data: fn });
  }
  return rows;
}

type DomainCat = 'counseling' | 'assessment' | null;
interface CardIdentity {
  name: string;
  muted: boolean;
  cat: DomainCat;
}

/** 정체성(누구) + 카테고리(상담/검사/미지정 dot 색). */
function cardIdentity(fn: FieldNoteResponse): CardIdentity {
  const names = fn.schedule?.client_names ?? [];
  if (names.length === 1) return { name: names[0], muted: false, cat: 'counseling' };
  if (names.length > 1) return { name: `${names[0]} 외 ${names.length - 1}명`, muted: false, cat: 'counseling' };
  if (fn.task?.client_name) return { name: fn.task.client_name, muted: false, cat: 'assessment' };
  if (fn.task_id) return { name: '검사 필드노트', muted: false, cat: 'assessment' };
  if (fn.schedule_id) return { name: '연결된 필드노트', muted: false, cat: 'counseling' };
  return { name: '회기 미지정', muted: true, cat: null };
}

/** 분석중 = 파이프라인 처리중 또는 summary 재생성중. */
function isAnalyzing(fn: FieldNoteResponse): boolean {
  return fn.processing_status === 'processing' || fn.summary_status === 'generating';
}

/** 미리보기 — 실제 내용(요약·전사) 있을 때만. */
function cardPreview(fn: FieldNoteResponse): string | null {
  const summary = fn.summary?.trim();
  if (summary) return summary;
  const transcript = fn.refined_transcript?.trim();
  if (transcript) return transcript;
  return null;
}

/** 녹음 중 우측 신호 — 시안대로 블루(info) 파형 + 경과시간. 전역 녹음 elapsed 구독. */
function RecordingSignal() {
  const elapsed = useRecordingStore((st) => st.elapsed);
  const paused = useRecordingStore((st) => st.isPaused);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(5) }}>
      <MiniWaveform color={COLORS.info} bars={4} />
      <Typography variant="label-01" weight="medium" style={{ color: COLORS.info }}>
        {paused ? '일시정지' : '녹음 중'} {formatSeconds(elapsed)}
      </Typography>
    </View>
  );
}

interface NoteRowActions {
  onOpen: (fn: FieldNoteResponse) => void;
  onLong: (fn: FieldNoteResponse) => void;
  registerRef: (id: string, v: View | null) => void;
}

/**
 * 노트 카드 — 시안 룩(평면 분리 카드). 좌측 카테고리 dot + 이름 / 프로그램·검사명 / 미리보기.
 * React.memo: 목록 수십 행이라 상위 state 변화마다 전부 재생성 방지(안정 콜백 + fn 변경분만 리렌더).
 */
const NoteCard = memo(function NoteCard({
  fn,
  isSet,
  onOpen,
  onLong,
  registerRef,
}: { fn: FieldNoteResponse; isSet: boolean } & NoteRowActions) {
  const id = cardIdentity(fn);
  // 이 노트가 '지금 진행 중인 활성 녹음'인지 — 전역 녹음 스토어와 id 매칭.
  // elapsed(매초 갱신)는 RecordingSignal 안에서만 구독해 이 카드만 리렌더. 활성이 아니면
  // stale 'recording' 노트라 라이브 elapsed(전역 0)를 쓰면 "녹음 중 00:00" 오표시 → 시간/상대시간 사용.
  const isLiveNote = useRecordingStore((st) => st.fieldNoteId === fn.id && (st.isRecording || st.isPaused));
  const failed = fn.processing_status === 'failed';
  const analyzing = isAnalyzing(fn);
  const preview = cardPreview(fn);
  const dotColor = id.cat === 'counseling' ? COLORS.counseling : id.cat === 'assessment' ? COLORS.assessment : COLORS.warning;
  const line2 = id.cat === 'assessment'
    ? (fn.task?.assessment_kor_name || fn.task?.assessment_code || '검사')
    : (fn.schedule?.program_name || null);
  // 상담실 — 상담은 schedule, 검사는 task(케이스 일정) brief 에서. "프로그램 | 상담실" / "검사명 | 상담실".
  const room = id.cat === 'assessment'
    ? (fn.task?.room_name || null)
    : (fn.schedule?.room_name || null);
  // 우측 상단 = 녹음 길이(얼마나 녹음했는지). 시작 시각이 아니라 duration.
  const rightText = formatSeconds(fn.total_duration ?? 0);

  return (
    <View ref={(v) => registerRef(fn.id, v)} collapsable={false}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => onOpen(fn)}
        onLongPress={() => onLong(fn)}
        delayLongPress={600}
        style={{ backgroundColor: HOME_CARD, borderRadius: s(16), padding: s(16), marginBottom: s(12), gap: s(4) }}
      >
        {/* ① 정체성 + 우측 신호 */}
        <View className="flex-row items-center" style={{ gap: s(8) }}>
          <View style={{ width: s(7), height: s(7), borderRadius: s(4), backgroundColor: dotColor }} />
          <Typography variant="body-01" weight="semibold" style={{ color: id.muted ? FND.sub : FND.text, flex: 1 }} numberOfLines={1}>
            {id.name}
          </Typography>
          {isLiveNote ? (
            <RecordingSignal />
          ) : (
            <Typography variant="label-01" style={{ color: FND.sub }}>{rightText}</Typography>
          )}
        </View>

        {/* ② 프로그램 | 상담실 (상담) / 검사명 (검사) */}
        {(line2 || room) ? (
          <View className="flex-row items-center" style={{ gap: s(6) }}>
            {isSet ? <SetBadge /> : null}
            {line2 ? (
              <Typography variant="body-03" style={{ color: FND.sub, flexShrink: 1 }} numberOfLines={1}>{line2}</Typography>
            ) : null}
            {line2 && room ? (
              <View style={{ width: 1, height: s(11), backgroundColor: FND.line }} />
            ) : null}
            {room ? (
              <Typography variant="body-03" style={{ color: FND.sub, flexShrink: 0 }} numberOfLines={1}>{room}</Typography>
            ) : null}
          </View>
        ) : null}

        {/* ③ 미리보기 / 상태 */}
        {failed ? (
          <View className="flex-row items-center" style={{ gap: s(4) }}>
            <Ionicons name="alert-circle" size={s(14)} color={COLORS.negative} />
            <Typography variant="body-03" numberOfLines={1} style={{ color: COLORS.negative, flex: 1 }}>
              분석에 실패했어요. 다시 시도해 주세요
            </Typography>
          </View>
        ) : preview ? (
          <Typography variant="body-03" numberOfLines={2} style={{ color: FND.sub, lineHeight: s(20) }}>
            {preview}
          </Typography>
        ) : analyzing ? (
          <Typography variant="body-03" numberOfLines={1} style={{ color: FND.sub }}>
            AI가 분석하고 있어요
          </Typography>
        ) : null}
      </TouchableOpacity>
    </View>
  );
});

/** 미지정 노트 카드 — 시안의 "어떤 상담·검사에 대한 기록인가요? · 선택하기" CTA. */
const UnlinkedCard = memo(function UnlinkedCard({
  fn,
  onOpen,
  onLong,
  registerRef,
}: { fn: FieldNoteResponse } & NoteRowActions) {
  const dur = formatSeconds(fn.total_duration ?? 0); // 녹음 길이(시작 시각 아님)
  return (
    <View ref={(v) => registerRef(fn.id, v)} collapsable={false}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => onOpen(fn)}
        onLongPress={() => onLong(fn)}
        delayLongPress={600}
        style={{ backgroundColor: HOME_CARD, borderRadius: s(16), padding: s(16), marginBottom: s(12) }}
      >
        <View className="flex-row items-center justify-between">
          <Typography variant="body-01" weight="semibold" style={{ color: FND.text }}>
            {fn.note_number != null ? `필드노트 ${fn.note_number}` : '회기 미지정'}
          </Typography>
          <Typography variant="label-01" style={{ color: FND.sub }}>{dur}</Typography>
        </View>
        <Typography variant="body-03" style={{ color: FND.sub, marginTop: s(8) }}>
          어떤 상담·검사에 대한 기록인가요?
        </Typography>
        <View style={{ marginTop: s(12), height: s(40), borderRadius: s(10), borderWidth: 1, borderColor: FND.line, alignItems: 'center', justifyContent: 'center' }}>
          <Typography variant="body-02" weight="medium" style={{ color: FND.text }}>선택하기</Typography>
        </View>
      </TouchableOpacity>
    </View>
  );
});

/**
 * 목록 상단 녹음 CTA — 전역 녹음 상태를 구독해 표시가 바뀐다.
 *  - 미녹음: [🎙 녹음하기] → 연결 선택 시트(link-at-start)
 *  - 녹음중: [● 녹음 중 · MM:SS · 탭하여 열기] → 진행 시트 복원
 * (elapsed 매초 갱신이 리스트 전체를 리렌더하지 않도록 별도 컴포넌트로 분리.)
 */
function RecordCtaButton({ onStartRequest }: { onStartRequest: () => void }) {
  const isRecording = useRecordingStore(selectIsActive);
  const recElapsed = useRecordingStore((st) => st.elapsed);
  const openSheet = useRecordingStore((st) => st.openSheet);

  return (
    <TouchableOpacity
      onPress={() => (isRecording ? openSheet() : onStartRequest())}
      activeOpacity={0.85}
      accessibilityLabel={isRecording ? '녹음 시트 열기' : '새 녹음 시작'}
      accessibilityRole="button"
      style={{
        marginHorizontal: s(20),
        marginTop: s(4),
        height: s(50),
        borderRadius: s(14),
        backgroundColor: COLORS.fieldnote,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: s(8),
      }}
    >
      {isRecording ? (
        <>
          <AnalyzingPulseDot color={COLORS.white} size={8} />
          <Typography variant="body-01" weight="semibold" style={{ color: COLORS.white }}>
            녹음 중 · {formatSeconds(recElapsed)}
          </Typography>
          <Typography variant="label-01" style={{ color: 'rgba(255,255,255,0.75)', marginLeft: s(2) }}>
            탭하여 열기
          </Typography>
        </>
      ) : (
        <>
          <Ionicons name="mic" size={s(20)} color={COLORS.white} />
          <Typography variant="body-01" weight="semibold" style={{ color: COLORS.white }}>
            녹음하기
          </Typography>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(2), marginLeft: s(4) }}>
            {WAVE.slice(0, 7).map((h, i) => (
              <View key={i} style={{ width: s(2), height: s(14) * h, borderRadius: s(1), backgroundColor: 'rgba(255,255,255,0.6)' }} />
            ))}
          </View>
        </>
      )}
    </TouchableOpacity>
  );
}

interface FieldNoteListContentProps {
  /** 헤더 뒤로가기 — 모핑 닫기(역재생)와 연결된다. (embedded 모드에선 헤더가 없어 미사용) */
  onBack?: () => void;
  /**
   * 필드노트 홈(sub-app) 노트 탭에 끼워 넣는 모드.
   * - 자체 헤더/녹음 CTA/SafeArea/모핑 오버레이를 빼고 검색+필터+리스트만 렌더(상위 컨테이너가 chrome 제공).
   * - 카드 탭은 모핑 대신 `_quick` 상세 라우트 push (상위 플로팅 네비와 충돌 방지).
   */
  embedded?: boolean;
  /** 리스트 하단 여백 — 상위 플로팅 네비 높이만큼 띄울 때 사용. */
  listBottomPadding?: number;
  /**
   * 새 녹음 요청 — link-at-start 연결 선택 시트 열기.
   * embedded(홈 노트 탭)에선 홈이 시트를 소유하므로 콜백으로 위임,
   * standalone 에선 미전달 시 자체 RecordTargetSheet 를 마운트한다.
   */
  onRequestRecord?: () => void;
}

/**
 * 필드노트 전체 목록 본문 (헤더 + 검색 + 필터 + 리스트).
 *
 * 라우트(`field-note/index`)와 모핑 오버레이에서 공용으로 쓰기 위해 분리.
 * 뒤로가기는 `onBack` 으로 위임 — 모핑 역재생 후 라우트 pop.
 * `embedded` 면 필드노트 홈 sub-app 의 노트 탭으로 끼워져 chrome 없이 검색+필터+리스트만 렌더.
 *
 * 데이터: 한 번에 size 50 unfiltered 로 받아 **클라이언트측**에서 검색·필터·카운트 처리
 * (연결/미연결 카운트를 동시에 보여주려면 단일 소스가 필요). 50건 초과 정밀도는 추후 페이지네이션 시 보강.
 */
export function FieldNoteListContent({ onBack, embedded = false, listBottomPadding, onRequestRecord }: FieldNoteListContentProps) {
  const { centerId, navigate } = useFieldNotePlatform();
  const [filter, setFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');
  // standalone 자체 연결 선택 시트 (embedded 는 onRequestRecord 로 홈 시트에 위임).
  const [targetSheetVisible, setTargetSheetVisible] = useState(false);
  const startRecording = useRecordingStore((st) => st.start);

  // 목록 → 상세 morph 오버레이 상태
  const [detail, setDetail] = useState<{ id: string; rect: Rect } | null>(null);
  const cardRefs = useRef(new Map<string, View>());
  // 행별 "최초 등장" 추적 — 스크롤 재진입 시 stagger 반복 재생 방지.
  const seenRowsRef = useRef<Set<string>>(new Set());
  const openDetail = useCallback((fn: FieldNoteResponse, rect: Rect) => {
    setDetail({ id: fn.id, rect });
  }, []);

  // 연결/미연결 카운트를 같이 보여주려면 unfiltered 단일 소스 필요.
  const { data: fieldNotesPage, isLoading, refetch } =
    useFieldNotes(centerId, { size: 50 });
  // 빠른 캐시 새로고침은 스피너가 명멸해 오히려 시야를 방해 → 최소 표시시간(600ms)으로 부드럽게.
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetch(), new Promise((r) => setTimeout(r, 600))]);
    setRefreshing(false);
  }, [refetch]);
  // 콜드 로딩만 스켈레톤(캐시 재방문 시 isLoading=false). 깜빡임 방지 게이트(§6.2).
  const showSkeleton = useDelayedSkeleton(isLoading);
  const { data: unreadData } = useUnreadCount(centerId);
  const unreadCount = unreadData?.count ?? 0;

  const deleteMutation = useDeleteFieldNote(centerId);

  const items = useMemo(() => fieldNotesPage?.items ?? [], [fieldNotesPage]);

  // 칩 카운트(검색 무관 — 전체 기준).
  const counts = useMemo(() => {
    let analyzed = 0;
    for (const fn of items) if (isAnalyzed(fn)) analyzed += 1;
    return { all: items.length, analyzed, unanalyzed: items.length - analyzed };
  }, [items]);

  // 검사 세트(case 안 검사 노트 ≥2)인 case_id 집합 — 세트 뱃지 판단.
  const setCaseIds = useMemo(() => {
    const tally = new Map<string, number>();
    for (const fn of items) {
      const cid = fn.task?.case_id;
      if (fn.task_id && cid) tally.set(cid, (tally.get(cid) ?? 0) + 1);
    }
    const set = new Set<string>();
    for (const [cid, n] of tally) if (n >= 2) set.add(cid);
    return set;
  }, [items]);

  // 필터 + 검색(내담자명·프로그램·검사명) 클라이언트측 적용.
  const visibleItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((fn) => {
      if (filter === 'analyzed' && !isAnalyzed(fn)) return false;
      if (filter === 'unanalyzed' && isAnalyzed(fn)) return false;
      if (!q) return true;
      const hay = [
        ...(fn.schedule?.client_names ?? []),
        fn.task?.client_name ?? '',
        fn.schedule?.program_name ?? '',
        fn.task?.assessment_kor_name ?? '',
      ].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [items, filter, search]);

  const rows = useMemo<ListRow[]>(
    () => (visibleItems.length === 0 ? [] : buildRows(visibleItems)),
    [visibleItems],
  );

  const handleLongPress = useCallback(
    (fn: FieldNoteResponse) => {
      Alert.alert('필드노트 삭제', '이 필드노트를 삭제하시겠습니까?', [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: () => deleteMutation.mutate(fn.id),
        },
      ]);
    },
    [deleteMutation],
  );

  // 카드 탭 → embedded는 상세 라우트 push, 그 외는 morph 오버레이.
  const openOrMorph = useCallback(
    (fn: FieldNoteResponse) => {
      if (embedded) {
        navigate.toFieldNoteQuick(fn.id);
        return;
      }
      const node = cardRefs.current.get(fn.id);
      if (node) node.measureInWindow((x, y, w, h) => openDetail(fn, { x, y, w, h }));
      else openDetail(fn, { x: 0, y: 0, w: 0, h: 0 });
    },
    [embedded, navigate, openDetail],
  );

  // 카드 ref 등록 — morph 시작 rect 측정용. 행 컴포넌트 메모이즈를 위해 안정 콜백으로.
  const registerCardRef = useCallback((id: string, v: View | null) => {
    if (v) cardRefs.current.set(id, v);
  }, []);

  const renderRow = useCallback(
    ({ item: row, index }: { item: ListRow; index: number }) => {
      const key = row.type === 'header' ? `header:${row.key}` : row.data.id;
      // 최초 등장만 위에서부터 촤르륵(stagger) — 재진입 시엔 즉시 표시.
      // FadeInDown 기본 ReduceMotion.System → 감소 모션 설정 시 자동 무효(§8.5).
      const isFirstAppearance = !seenRowsRef.current.has(key);
      if (isFirstAppearance) seenRowsRef.current.add(key);
      // 초기 뷰포트(상위 ~12개)만 드롭인 — 스크롤로 뒤늦게 등장하는 셀까지 매번 애니메이션하면
      // 큰 목록 업데이트가 무거워진다(VirtualizedList slow-to-update).
      const entering = isFirstAppearance && index < 12
        ? FadeInDown.duration(320).delay(Math.min(index, 10) * 35)
        : undefined;

      let content: React.ReactNode;
      if (row.type === 'header') {
        content = (
          <View style={{ paddingTop: index === 0 ? 0 : s(14), paddingBottom: s(10) }}>
            <Typography variant="label-01" style={{ color: FND.sub }}>{row.label}</Typography>
          </View>
        );
      } else {
        const fn = row.data;
        const cta = !isLinked(fn) && fn.status !== 'recording' && fn.status !== 'paused';
        content = cta ? (
          <UnlinkedCard fn={fn} onOpen={openOrMorph} onLong={handleLongPress} registerRef={registerCardRef} />
        ) : (
          <NoteCard
            fn={fn}
            isSet={!!(fn.task?.case_id && setCaseIds.has(fn.task.case_id))}
            onOpen={openOrMorph}
            onLong={handleLongPress}
            registerRef={registerCardRef}
          />
        );
      }

      return <Animated.View entering={entering}>{content}</Animated.View>;
    },
    [openOrMorph, handleLongPress, registerCardRef, setCaseIds],
  );

  // 검색바 — 시안 상단 검색.
  const searchView = (
    <View style={{ paddingHorizontal: s(20), paddingTop: s(12) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', height: s(48), borderRadius: s(14), backgroundColor: HOME_CARD, paddingHorizontal: s(16) }}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="내담자 이름, 프로그램으로 검색해주세요"
          placeholderTextColor={FND.sub}
          returnKeyType="search"
          style={{
            flex: 1,
            color: FND.text,
            fontSize: s(15),
            // 텍스트 박스 높이 고정 + 중앙 정렬: 타이핑 시 높이 변화/하단 쏠림 방지
            // (lineHeight 는 미설정 — iOS 하단 쏠림 방지)
            height: s(24),
            padding: 0,
            includeFontPadding: false,
            textAlignVertical: 'center',
          }}
        />
        <Ionicons name="search" size={s(20)} color={FND.sub} />
      </View>
    </View>
  );

  // 필터 칩 — 전체/분석완료/미분석 + 카운트. active = 라이트 채움 pill(시안).
  const CHIPS: { key: FilterKey; label: string; count: number }[] = [
    { key: 'all', label: '전체', count: counts.all },
    { key: 'analyzed', label: '분석완료', count: counts.analyzed },
    { key: 'unanalyzed', label: '미분석', count: counts.unanalyzed },
  ];
  const filterView = (
    <View style={{ flexDirection: 'row', gap: s(8), paddingHorizontal: s(20), paddingTop: s(14), paddingBottom: s(4) }}>
      {CHIPS.map((c) => {
        const active = filter === c.key;
        return (
          <TouchableOpacity
            key={c.key}
            onPress={() => setFilter(c.key)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`${c.label} ${c.count}개`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: s(6), paddingHorizontal: s(14), paddingVertical: s(8), borderRadius: s(999), backgroundColor: active ? '#E9E9EF' : 'transparent', borderWidth: 1, borderColor: active ? 'transparent' : FND.line }}
          >
            <Typography variant="label-01" weight={active ? 'semibold' : 'medium'} style={{ color: active ? '#1A1622' : FND.sub }}>{c.label}</Typography>
            <Typography variant="label-02" weight="medium" style={{ color: active ? '#6B6480' : FND.sub }}>{c.count}</Typography>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const listView = (
    <FlatList<ListRow>
      data={rows}
      keyExtractor={(row) => (row.type === 'header' ? `header:${row.key}` : row.data.id)}
      renderItem={renderRow}
      // 큰 목록 업데이트 부담 완화 — 한 번에 적게 렌더하고 윈도우를 좁힌다.
      windowSize={9}
      maxToRenderPerBatch={6}
      initialNumToRender={8}
      updateCellsBatchingPeriod={60}
      contentContainerStyle={{ paddingHorizontal: s(20), paddingTop: s(10), paddingBottom: listBottomPadding ?? s(100) }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={FND.accent}
          colors={[FND.accent]}
          progressBackgroundColor={HOME_CARD}
        />
      }
      ListEmptyComponent={
        // 로딩은 bodyView 의 스켈레톤이 담당 — 여기는 '진짜 빈 목록'만.
        <View className="items-center gap-3 py-16">
          <Ionicons name="mic-outline" size={48} color={FND.sub} />
          <Typography variant="body-03" style={{ color: FND.sub }}>
            {search.trim() ? '검색 결과가 없어요'
              : filter === 'unanalyzed' ? '미분석 필드노트가 없어요'
              : filter === 'analyzed' ? '분석완료된 필드노트가 없어요'
              : '필드노트가 없어요'}
          </Typography>
        </View>
      }
      showsVerticalScrollIndicator={false}
    />
  );

  // 본문 — 콜드 로딩은 스켈레톤, delay 창(빠른 로딩)은 빈 화면, 그 외 리스트.
  // 스켈레톤을 FlatList 안에 넣지 않고 본문 전체를 대체(§6.2). 검색/필터 chrome 은 위에서 그대로 유지.
  const bodyView = showSkeleton ? (
    <FieldNoteListSkeleton bottomPadding={listBottomPadding} />
  ) : isLoading ? (
    <View style={{ flex: 1 }} />
  ) : (
    listView
  );

  // embedded(홈 sub-app 노트 탭): chrome 없이 검색+필터+리스트만. 모핑 대신 상세 라우트 push 사용.
  if (embedded) {
    return (
      <View style={{ flex: 1, backgroundColor: HOME_BG }}>
        {searchView}
        {filterView}
        {bodyView}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: HOME_BG }}>
    <SafeAreaView className="flex-1" edges={['top']} style={{ backgroundColor: HOME_BG }}>
      {/* 상단 헤더 — 뒤로가기는 모핑 역재생으로 위임 */}
      <View
        style={{ height: s(52) }}
        className="flex-row items-center px-5"
      >
        <TouchableOpacity
          onPress={onBack}
          activeOpacity={0.7}
          className="-ml-2 h-10 w-10 items-center justify-center"
          accessibilityLabel="뒤로"
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={24} color={FND.text} />
        </TouchableOpacity>
        <Typography
          variant="headline-02"
          weight="bold"
          className="ml-1 flex-1"
          style={{ color: FND.text }}
        >
          필드노트
        </Typography>
        <NotificationBell
          count={unreadCount}
          onPress={() => navigate.toNotifications()}
          color={FND.sub}
          dotBorderColor={FND.bg}
        />
      </View>

      {/* 상단 녹음 CTA — 연결 선택 시트로 link-at-start(녹음 중이면 시트 복원) */}
      <RecordCtaButton onStartRequest={() => (onRequestRecord ? onRequestRecord() : setTargetSheetVisible(true))} />

      {searchView}
      {filterView}
      {bodyView}
    </SafeAreaView>

      {/* 목록 → 상세 morph 오버레이 (라우트 이동 X) */}
      {detail && (
        <FieldNoteDetailMorph
          fieldNoteId={detail.id}
          rect={detail.rect}
          onClosed={() => setDetail(null)}
        />
      )}

      {/* standalone 연결 선택 시트 — RecordCtaButton(미녹음) 탭 시 */}
      {!onRequestRecord && (
        <RecordTargetSheet
          visible={targetSheetVisible}
          onClose={() => setTargetSheetVisible(false)}
          onPickSchedule={(sc) => void startRecording(undefined, sc.id)}
          onPickTask={(taskId) => void startRecording(undefined, undefined, taskId)}
          onOpenNote={(noteId) => navigate.toFieldNoteQuick(noteId)}
        />
      )}
    </View>
  );
}
