import { useEffect, useRef, useState } from 'react';
import { View, ScrollView, TouchableOpacity, Animated } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, LAYOUT } from '@/shared/constants/theme';
import { Typography } from '@/shared/components/ui/Typography';
import { Icon } from '@/shared/components/icons';
import { s } from '@/shared/utils/scale';

/**
 * [검사 항목] 소견(필수·독립) + 음성(선택·도우미) — 디자인 격 상향 lab (v5).
 *
 * 모델·데이터·액션은 v4 유지(소견은 음성과 독립, 음성은 선택 도우미 + 라이프사이클
 * 시작/이어/분석하기/보기, 온라인 검사는 음성 숨김). 이번엔 "디자인이 진부하다"는
 * 피드백 → 표면·위계·색 리듬만 끌어올린 시안 비교.
 *
 * 끌어올린 레버 — (1) 회색 평카드+구분선 → white 카드+soft shadow+sunken 트레이로 깊이
 * (2) 검사명 타이포 위계 강화(body-01) + 메타 캡션 (3) 검사 카테고리 dot(blue)로 색 리듬,
 * 보라는 음성에만 (4) 구분선 의존 ↓ 여백·면으로 그룹핑 (5) 녹음중 카드가 은은히 점등.
 *
 * 인터랙티브 유지 — 단일 활성 녹음·미니바·충돌·정지=분석·분석하기·이어 녹음. 전부 mock.
 */

type TabKey = 'toss' | 'current' | 'tray' | 'spine' | 'dash' | 'refined';

const TABS: { key: TabKey; label: string; caption: string }[] = [
  {
    key: 'toss',
    label: '토스',
    caption:
      '추천 — 상담사 친숙한 토스식 카드(부드러운 그림자·여백·친근 라이팅) + 소견을 "읽히는 본문"으로 주연화. 작성분은 노트처럼, 미작성은 다정한 작성 유도. 음성은 조용한 (선택) 한 줄.',
  },
  {
    key: 'current',
    label: '현재',
    caption: 'production 재현(대조군) — 회색 평카드 + 구분선 + 칩. 평범함의 기준점.',
  },
  {
    key: 'tray',
    label: '트레이',
    caption: 'white 카드 + soft shadow. 소견·음성을 카드 안 gray-50 sunken 트레이에 담아 깊이. 정보(위)·액션(아래) 면 분리.',
  },
  {
    key: 'spine',
    label: '스파인',
    caption: '구분선 없이 여백·타이포 위계로만 + 좌측 4px 음성 상태 스파인(녹음 빨강·완료 보라). airy·모던.',
  },
  {
    key: 'dash',
    label: '타일',
    caption: '컴팩트 타일 — [소견]·[음성] 상태 pill 2개가 곧 액션. 한눈 스캔.',
  },
  {
    key: 'refined',
    label: '종합',
    caption: 'white 카드+shadow+카테고리 dot+검사명 hero. 소견 당당한 행 + 음성 우아한 "(선택)" 캡슐.',
  },
];

type FnState = 'none' | 'recording' | 'analyzing' | 'saved' | 'done' | 'online';

type TaskMock = {
  id: string;
  name: string;
  status: 'completed' | 'in_progress' | 'submitted' | 'pending';
  hasOpinion: boolean;
  fn: FnState;
  meta: string;
  timer?: string;
  keyword?: string;
  opinion?: string; // 작성된 소견 본문 (미리보기용)
};

const TASKS: TaskMock[] = [
  { id: 't1', name: 'BGT (벤더게슈탈트)', status: 'completed', hasOpinion: true, fn: 'done', meta: '오늘 완료', keyword: '불안 단서 多', opinion: '전반적으로 불안 수준이 높고, 도형 모사 시 지우기·재확인이 잦았음.' },
  { id: 't2', name: 'Rorschach (로르샤흐)', status: 'in_progress', hasOpinion: false, fn: 'none', meta: '진행 중' },
  { id: 't3', name: 'HTP (집-나무-사람)', status: 'submitted', hasOpinion: false, fn: 'saved', meta: '제출됨 · 녹음 분석 대기' },
  { id: 't4', name: 'SCT (문장완성)', status: 'submitted', hasOpinion: false, fn: 'analyzing', meta: '제출됨' },
  { id: 't5', name: 'K-WISC-V (온라인)', status: 'in_progress', hasOpinion: false, fn: 'online', meta: '온라인 진행' },
];

const TASK_STATUS: Record<string, { label: string; bg: string; fg: string }> = {
  pending: { label: '예정', bg: COLORS.paletteBg.gray, fg: COLORS.palette.gray },
  in_progress: { label: '진행중', bg: COLORS.paletteBg.blue, fg: COLORS.palette.blue },
  submitted: { label: '제출됨', bg: COLORS.paletteBg.yellow, fg: COLORS.palette.yellow },
  completed: { label: '완료', bg: COLORS.paletteBg.green, fg: COLORS.palette.green },
};

const FN = COLORS.fieldnote;
const FN_TINT = 'rgba(155,93,255,0.10)';
const FN_TINT_SOFT = 'rgba(155,93,255,0.06)';
const REC_TINT = 'rgba(255,66,66,0.10)';
const REC_TINT_SOFT = 'rgba(255,66,66,0.045)';
const ASSESS = '#3495F5'; // DS Tier3 category-assessment (lab 직접참조 — 카테고리 dot)
const SHADOW_CARD = { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 };

function fmt(sec: number) {
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
}

// ──────────────── Page ────────────────

export default function AssessmentTaskRecord3BeatLab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [tabKey, setTabKey] = useState<TabKey>('toss');
  const active = TABS.find((t) => t.key === tabKey)!;

  const [recId, setRecId] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [overrides, setOverrides] = useState<Record<string, FnState>>({});
  const [conflict, setConflict] = useState<{ toId: string } | null>(null);

  useEffect(() => {
    if (!recId) return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [recId]);

  const switchTab = (k: TabKey) => {
    setTabKey(k);
    setRecId(null);
    setElapsed(0);
    setOverrides({});
    setConflict(null);
  };

  const effState = (t: TaskMock): FnState => (recId === t.id ? 'recording' : overrides[t.id] ?? t.fn);
  const finish = (id: string) => {
    setOverrides((o) => ({ ...o, [id]: 'analyzing' }));
    setTimeout(() => setOverrides((o) => ({ ...o, [id]: 'done' })), 2500);
  };
  const start = (id: string) => {
    if (recId && recId !== id) return setConflict({ toId: id });
    if (recId === id) return;
    setRecId(id);
    setElapsed(0);
    setOverrides((o) => {
      const n = { ...o };
      delete n[id];
      return n;
    });
  };
  const stop = () => {
    if (!recId) return;
    finish(recId);
    setRecId(null);
  };
  const process = (id: string) => finish(id);
  const confirmSwitch = () => {
    if (!conflict) return;
    const toId = conflict.toId;
    if (recId) finish(recId);
    setRecId(toId);
    setElapsed(0);
    setOverrides((o) => {
      const n = { ...o };
      delete n[toId];
      return n;
    });
    setConflict(null);
  };

  const effTasks: TaskMock[] = TASKS.map((t) => ({
    ...t,
    fn: effState(t),
    timer: recId === t.id ? fmt(elapsed) : undefined,
    keyword: t.keyword ?? (effState(t) === 'done' ? '관찰 메모 정리됨' : undefined),
  }));
  const recTask = effTasks.find((t) => t.id === recId) ?? null;
  const handlers: VoiceHandlers = { onStart: start, onResume: start, onProcess: process };

  const flatBg = tabKey === 'current';

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: COLORS.bg.base }} edges={['top']}>
      <View className="h-[52px] flex-row items-center px-5" style={{ backgroundColor: COLORS.bg.base }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} accessibilityLabel="뒤로 가기" accessibilityRole="button">
          <Icon name="arrow-left" size={24} color={COLORS.gray[900]} />
        </TouchableOpacity>
        <Typography variant="title-01" weight="semibold" className="ml-1.5 text-gray-900">
          검사 항목 · 디자인 상향
        </Typography>
      </View>

      <View style={{ paddingHorizontal: s(LAYOUT.screenPaddingX), paddingTop: s(8) }}>
        <View style={{ flexDirection: 'row', backgroundColor: COLORS.gray[100], borderRadius: s(10), padding: s(3) }}>
          {TABS.map((t) => {
            const on = t.key === tabKey;
            return (
              <TouchableOpacity
                key={t.key}
                activeOpacity={0.8}
                onPress={() => switchTab(t.key)}
                style={{ flex: 1, paddingVertical: s(8), paddingHorizontal: s(1), borderRadius: s(8), alignItems: 'center', backgroundColor: on ? COLORS.white : 'transparent' }}
              >
                <Typography variant="label-02" weight={on ? 'semibold' : 'medium'} numberOfLines={1} style={{ color: on ? COLORS.gray[900] : COLORS.gray[500] }}>
                  {t.label}
                </Typography>
              </TouchableOpacity>
            );
          })}
        </View>
        <Typography variant="caption-01" className="text-gray-500" style={{ marginTop: s(8), paddingHorizontal: s(2), lineHeight: 16 }}>
          {active.caption}
        </Typography>
      </View>

      <ScrollView
        style={{ backgroundColor: flatBg ? COLORS.white : COLORS.bg.base, marginTop: s(12) }}
        contentContainerStyle={{ paddingBottom: recId ? 110 : 40 }}
      >
        <View style={{ paddingTop: s(20), paddingBottom: s(24), paddingHorizontal: s(20) }}>
          <View className="flex-row items-center" style={{ marginBottom: s(14), gap: s(8) }}>
            <Typography variant="headline-02" weight="semibold" className="text-gray-900">검사 항목</Typography>
            <View style={{ backgroundColor: COLORS.primary50, borderRadius: 999, paddingHorizontal: s(8), paddingVertical: s(2) }}>
              <Typography variant="label-02" weight="semibold" style={{ color: COLORS.primary700 }}>눌러보기</Typography>
            </View>
          </View>
          <View style={{ gap: s(12) }}>
            {effTasks.map((task) => (
              <TaskCard key={`${tabKey}-${task.id}`} task={task} variant={tabKey} handlers={handlers} />
            ))}
          </View>
        </View>
      </ScrollView>

      {recTask && <RecordingMiniBar task={recTask} bottomInset={insets.bottom} onStop={stop} />}
      {conflict && (
        <ConflictModal fromName={recTask?.name ?? ''} toName={TASKS.find((t) => t.id === conflict.toId)?.name ?? ''} onCancel={() => setConflict(null)} onConfirm={confirmSwitch} />
      )}
    </SafeAreaView>
  );
}

type VoiceHandlers = { onStart: (id: string) => void; onResume: (id: string) => void; onProcess: (id: string) => void };

// ──────────────── TaskCard (변형 분기) ────────────────

function TaskCard({ task, variant, handlers }: { task: TaskMock; variant: TabKey; handlers: VoiceHandlers }) {
  if (variant === 'toss') return <CardToss task={task} handlers={handlers} />;
  if (variant === 'current') return <CardCurrent task={task} handlers={handlers} />;
  if (variant === 'tray') return <CardTray task={task} handlers={handlers} />;
  if (variant === 'spine') return <CardSpine task={task} handlers={handlers} />;
  if (variant === 'dash') return <CardDash task={task} handlers={handlers} />;
  return <CardRefined task={task} handlers={handlers} />;
}

// 공통 — 검사명 헤더(카테고리 dot + 메타) + 상태뱃지
function TaskHeader({ task, dot = true, big = true }: { task: TaskMock; dot?: boolean; big?: boolean }) {
  const st = TASK_STATUS[task.status];
  return (
    <View className="flex-row items-start" style={{ gap: s(8) }}>
      {dot && <View style={{ width: s(7), height: s(7), borderRadius: s(7), backgroundColor: ASSESS, marginTop: s(7) }} />}
      <View style={{ flex: 1 }}>
        <Typography variant={big ? 'body-01' : 'body-02'} weight="semibold" className="text-gray-900" numberOfLines={2}>
          {task.name}
        </Typography>
      </View>
      <View style={{ backgroundColor: st.bg, borderRadius: 999, paddingHorizontal: s(10), paddingVertical: s(3) }}>
        <Typography variant="label-02" weight="semibold" style={{ color: st.fg }}>{st.label}</Typography>
      </View>
    </View>
  );
}

// ─────────── 변형 0: 현재 (대조군, 평카드) ───────────

function CardCurrent({ task, handlers }: { task: TaskMock; handlers: VoiceHandlers }) {
  const st = TASK_STATUS[task.status];
  const online = task.fn === 'online';
  return (
    <View style={{ backgroundColor: COLORS.gray[50], borderRadius: s(16), overflow: 'hidden' }}>
      <View style={{ paddingVertical: s(14), paddingHorizontal: s(16), flexDirection: 'row', alignItems: 'center' }}>
        <Typography variant="body-02" weight="semibold" className="flex-1 text-gray-900" numberOfLines={2}>{task.name}</Typography>
        {!online && (
          <View style={{ marginRight: s(8) }}>
            <MiniChip state={task.fn} timer={task.timer} onStart={() => handlers.onStart(task.id)} />
          </View>
        )}
        <View style={{ backgroundColor: st.bg }} className="mr-2 rounded-full px-2.5 py-1">
          <Typography variant="label-02" weight="semibold" style={{ color: st.fg }}>{st.label}</Typography>
        </View>
        <Ionicons name="ellipsis-vertical" size={18} color={COLORS.gray[400]} />
      </View>
      <View style={{ height: 1, backgroundColor: COLORS.gray[200], marginHorizontal: s(16) }} />
      <OpinionInline task={task} />
    </View>
  );
}

function OpinionInline({ task }: { task: TaskMock }) {
  return (
    <View style={{ paddingVertical: s(10), paddingHorizontal: s(16), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Typography variant="label-01" weight="medium" style={{ color: task.hasOpinion ? COLORS.gray[600] : COLORS.gray[400] }}>
        {task.hasOpinion ? '소견 작성됨' : '소견 미작성'}
      </Typography>
      <View className="flex-row items-center" style={{ gap: s(2) }}>
        <Typography variant="label-01" weight="semibold" style={{ color: task.hasOpinion ? COLORS.gray[600] : COLORS.primary }}>
          {task.hasOpinion ? '소견 수정' : '소견 작성'}
        </Typography>
        <Icon name="arrow-right" size={12} color={task.hasOpinion ? COLORS.gray[600] : COLORS.primary} />
      </View>
    </View>
  );
}

// ─────────── 변형 1: 액션 트레이 ───────────

function CardTray({ task, handlers }: { task: TaskMock; handlers: VoiceHandlers }) {
  const online = task.fn === 'online';
  const recTint = task.fn === 'recording';
  return (
    <View style={{ backgroundColor: COLORS.white, borderRadius: s(20), padding: s(16), gap: s(14), ...SHADOW_CARD }}>
      <TaskHeader task={task} />
      <View style={{ backgroundColor: recTint ? REC_TINT_SOFT : COLORS.gray[50], borderRadius: s(14), paddingHorizontal: s(14), paddingVertical: s(4) }}>
        <View style={{ paddingVertical: s(11) }}>
          <OpinionBlock task={task} />
        </View>
        {!online && (
          <>
            <View style={{ height: 1, backgroundColor: COLORS.white }} />
            <View style={{ paddingVertical: s(11) }}>
              <VoiceRow task={task} handlers={handlers} />
            </View>
          </>
        )}
      </View>
    </View>
  );
}

// ─────────── 변형 2: 컬러 스파인 (구분선 없음) ───────────

function CardSpine({ task, handlers }: { task: TaskMock; handlers: VoiceHandlers }) {
  const online = task.fn === 'online';
  const spine =
    task.fn === 'recording' ? COLORS.error :
    task.fn === 'none' || online ? COLORS.gray[200] : FN;
  return (
    <View style={{ flexDirection: 'row', backgroundColor: COLORS.white, borderRadius: s(18), overflow: 'hidden', ...SHADOW_CARD }}>
      <View style={{ width: s(4), backgroundColor: spine }} />
      <View style={{ flex: 1, padding: s(16), gap: s(16) }}>
        <TaskHeader task={task} dot={false} />
        <View style={{ gap: s(12) }}>
          <OpinionBlock task={task} />
          {!online && <VoiceRow task={task} handlers={handlers} />}
        </View>
      </View>
    </View>
  );
}

// ─────────── 변형 3: 대시보드 (pill 타일) ───────────

function CardDash({ task, handlers }: { task: TaskMock; handlers: VoiceHandlers }) {
  const online = task.fn === 'online';
  return (
    <View style={{ backgroundColor: COLORS.white, borderRadius: s(18), padding: s(16), gap: s(14), ...SHADOW_CARD }}>
      <TaskHeader task={task} />
      <View style={{ flexDirection: 'row', gap: s(8) }}>
        {/* 소견 타일 */}
        <TouchableOpacity activeOpacity={0.8} style={{ flex: 1, backgroundColor: task.hasOpinion ? COLORS.gray[50] : COLORS.primary50, borderRadius: s(12), paddingVertical: s(10), paddingHorizontal: s(12), flexDirection: 'row', alignItems: 'center', gap: s(6) }}>
          <Ionicons name={task.hasOpinion ? 'checkmark-circle' : 'create-outline'} size={15} color={task.hasOpinion ? COLORS.success : COLORS.primary} />
          <View style={{ flex: 1 }}>
            <Typography variant="label-02" className="text-gray-400">소견</Typography>
            <Typography variant="label-01" weight={task.hasOpinion ? 'medium' : 'semibold'} style={{ color: task.hasOpinion ? COLORS.gray[600] : COLORS.primary }} numberOfLines={1}>
              {task.hasOpinion ? (task.opinion ?? '작성됨') : '작성하기'}
            </Typography>
          </View>
        </TouchableOpacity>
        {/* 음성 타일 */}
        {online ? (
          <View style={{ flex: 1, backgroundColor: COLORS.gray[50], borderRadius: s(12), paddingVertical: s(10), paddingHorizontal: s(12), justifyContent: 'center' }}>
            <Typography variant="label-02" className="text-gray-400">음성</Typography>
            <Typography variant="label-01" weight="medium" className="text-gray-400">온라인 제외</Typography>
          </View>
        ) : (
          <VoiceTile task={task} handlers={handlers} />
        )}
      </View>
    </View>
  );
}

function VoiceTile({ task, handlers }: { task: TaskMock; handlers: VoiceHandlers }) {
  const { fn, id, timer } = task;
  const info =
    fn === 'recording' ? { ic: 'radio-button-on' as const, c: COLORS.error, t: `녹음 중 ${timer}`, on: undefined } :
    fn === 'analyzing' ? { ic: 'sync' as const, c: FN, t: '분석 중', on: undefined } :
    fn === 'saved' ? { ic: 'sparkles' as const, c: FN, t: '분석하기', on: () => handlers.onProcess(id) } :
    fn === 'done' ? { ic: 'document-text' as const, c: FN, t: '분석 보기', on: () => {} } :
    { ic: 'mic' as const, c: FN, t: '녹음 시작', on: () => handlers.onStart(id) };
  return (
    <TouchableOpacity disabled={!info.on} onPress={info.on} activeOpacity={0.8} style={{ flex: 1, backgroundColor: fn === 'recording' ? REC_TINT : FN_TINT, borderRadius: s(12), paddingVertical: s(10), paddingHorizontal: s(12), flexDirection: 'row', alignItems: 'center', gap: s(6) }}>
      {fn === 'recording' ? <PulseDot color={COLORS.error} size={s(8)} /> : <Ionicons name={info.ic} size={15} color={info.c} />}
      <View style={{ flex: 1 }}>
        <Typography variant="label-02" className="text-gray-400">음성 <Typography variant="label-02" style={{ color: COLORS.gray[300] }}>(선택)</Typography></Typography>
        <Typography variant="label-01" weight="semibold" style={{ color: info.c }} numberOfLines={1}>{info.t}</Typography>
      </View>
    </TouchableOpacity>
  );
}

// ─────────── 변형 5: 토스 결 (추천) ───────────
// 상담사 친숙한 토스식 — 부드러운 큰 그림자·여백·친근 라이팅.
// 소견을 "읽히는 본문"으로 주연화(작성분=노트, 미작성=다정한 작성 유도). 음성은 조용한 (선택) 한 줄.

function CardToss({ task, handlers }: { task: TaskMock; handlers: VoiceHandlers }) {
  const online = task.fn === 'online';
  const rec = task.fn === 'recording';
  const an = task.fn === 'analyzing';
  const st = TASK_STATUS[task.status];
  const vColor = rec ? COLORS.error : an ? FN : COLORS.gray[500];
  return (
    <View style={{ backgroundColor: COLORS.white, borderRadius: s(24), overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 3 }, elevation: 3 }}>
      {rec && <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: s(3), backgroundColor: COLORS.error }} />}
      <View style={{ padding: s(18), gap: s(14), backgroundColor: rec ? REC_TINT_SOFT : 'transparent' }}>
        {/* 헤더 */}
        <View className="flex-row items-center" style={{ gap: s(8) }}>
          <View style={{ width: s(7), height: s(7), borderRadius: s(7), backgroundColor: ASSESS }} />
          <Typography variant="body-01" weight="semibold" className="flex-1 text-gray-900" numberOfLines={1}>{task.name}</Typography>
          <View style={{ backgroundColor: st.bg, borderRadius: 999, paddingHorizontal: s(10), paddingVertical: s(3) }}>
            <Typography variant="label-02" weight="semibold" style={{ color: st.fg }}>{st.label}</Typography>
          </View>
        </View>

        {/* 소견 — 주연(읽히는 본문) */}
        {task.hasOpinion ? (
          <View style={{ backgroundColor: COLORS.gray[50], borderRadius: s(16), padding: s(14), gap: s(8) }}>
            <View className="flex-row items-center" style={{ justifyContent: 'space-between' }}>
              <View className="flex-row items-center" style={{ gap: s(6) }}>
                <Ionicons name="checkmark-circle" size={15} color={COLORS.success} />
                <Typography variant="label-01" weight="semibold" className="text-gray-700">소견</Typography>
              </View>
              <TouchableOpacity activeOpacity={0.7} className="flex-row items-center" style={{ gap: s(2) }} hitSlop={8}>
                <Typography variant="label-01" weight="semibold" style={{ color: COLORS.gray[600] }}>수정</Typography>
                <Icon name="arrow-right" size={11} color={COLORS.gray[600]} />
              </TouchableOpacity>
            </View>
            <Typography variant="body-02-reading" className="text-gray-700">{task.opinion}</Typography>
          </View>
        ) : (
          <TouchableOpacity activeOpacity={0.85} style={{ backgroundColor: COLORS.primary50, borderRadius: s(16), padding: s(14), flexDirection: 'row', alignItems: 'center', gap: s(10) }}>
            <View style={{ width: s(34), height: s(34), borderRadius: s(12), backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="create-outline" size={18} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Typography variant="body-02" weight="semibold" className="text-gray-900">소견을 남겨볼까요?</Typography>
              <Typography variant="label-02" className="text-gray-500">이 검사에 대한 의견을 적어요</Typography>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, borderRadius: 999, paddingHorizontal: s(14), paddingVertical: s(8) }}>
              <Typography variant="label-01" weight="semibold" style={{ color: COLORS.white }}>작성</Typography>
            </View>
          </TouchableOpacity>
        )}

        {/* 음성 — 조용한 (선택) 한 줄 */}
        {!online ? (
          <View className="flex-row items-center" style={{ gap: s(8), paddingHorizontal: s(2) }}>
            {rec ? <PulseDot color={COLORS.error} size={s(7)} /> : <Ionicons name={an ? 'sync' : 'mic-outline'} size={14} color={vColor} />}
            <Typography variant="label-01" weight="medium" style={{ color: vColor, flex: 1 }} numberOfLines={1}>{voiceText(task)}</Typography>
            <VoiceActions task={task} handlers={handlers} />
          </View>
        ) : (
          <View className="flex-row items-center" style={{ gap: s(6), paddingHorizontal: s(2) }}>
            <Ionicons name="mic-off-outline" size={13} color={COLORS.gray[300]} />
            <Typography variant="label-02" className="text-gray-400">온라인 검사 — 음성은 해당 없어요</Typography>
          </View>
        )}
      </View>
    </View>
  );
}

// ─────────── 변형 4: 세련 종합 (권장) ───────────

function CardRefined({ task, handlers }: { task: TaskMock; handlers: VoiceHandlers }) {
  const online = task.fn === 'online';
  const rec = task.fn === 'recording';
  return (
    <View style={{ backgroundColor: COLORS.white, borderRadius: s(20), overflow: 'hidden', ...SHADOW_CARD }}>
      {rec && <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: s(3), backgroundColor: COLORS.error }} />}
      <View style={{ padding: s(16), gap: s(14), backgroundColor: rec ? REC_TINT_SOFT : 'transparent' }}>
        <TaskHeader task={task} />

        {/* 소견 — 작성됐으면 본문 미리보기 한 줄 동반 */}
        <TouchableOpacity activeOpacity={0.8} className="flex-row" style={{ gap: s(8), alignItems: task.hasOpinion ? 'flex-start' : 'center' }}>
          <View style={{ width: s(26), height: s(26), borderRadius: s(8), backgroundColor: task.hasOpinion ? COLORS.paletteBg.green : COLORS.primary50, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={task.hasOpinion ? 'checkmark' : 'create-outline'} size={15} color={task.hasOpinion ? COLORS.success : COLORS.primary} />
          </View>
          <View style={{ flex: 1, gap: s(2) }}>
            <Typography variant="body-02" weight="semibold" className="text-gray-900">
              소견 {task.hasOpinion ? '작성됨' : '미작성'}
            </Typography>
            {task.hasOpinion && task.opinion && (
              <Typography variant="label-02" className="text-gray-500" numberOfLines={2}>
                {task.opinion}
              </Typography>
            )}
          </View>
          <View className="flex-row items-center" style={{ gap: s(2), marginTop: task.hasOpinion ? s(1) : 0 }}>
            <Typography variant="label-01" weight="semibold" style={{ color: task.hasOpinion ? COLORS.gray[600] : COLORS.primary }}>
              {task.hasOpinion ? '수정' : '작성'}
            </Typography>
            <Icon name="arrow-right" size={12} color={task.hasOpinion ? COLORS.gray[600] : COLORS.primary} />
          </View>
        </TouchableOpacity>

        {/* 음성 — 우아한 (선택) 캡슐 */}
        {!online && <VoiceCapsule task={task} handlers={handlers} />}
        {online && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6), paddingHorizontal: s(2) }}>
            <Ionicons name="mic-off-outline" size={13} color={COLORS.gray[300]} />
            <Typography variant="label-02" className="text-gray-400">온라인 검사 — 음성 기록은 해당 없어요</Typography>
          </View>
        )}
      </View>
    </View>
  );
}

/** 우아한 음성 캡슐 — 아이콘 박스 + 단일 상태 텍스트 + 라이프사이클(중복 제거) */
function VoiceCapsule({ task, handlers }: { task: TaskMock; handlers: VoiceHandlers }) {
  const rec = task.fn === 'recording';
  const an = task.fn === 'analyzing';
  const color = rec ? COLORS.error : an ? FN : COLORS.gray[700];
  return (
    <View style={{ backgroundColor: rec ? REC_TINT : FN_TINT_SOFT, borderRadius: s(14), paddingVertical: s(10), paddingHorizontal: s(12), flexDirection: 'row', alignItems: 'center', gap: s(8) }}>
      <View style={{ width: s(26), height: s(26), borderRadius: s(8), backgroundColor: rec ? 'transparent' : COLORS.white, alignItems: 'center', justifyContent: 'center' }}>
        {rec ? <PulseDot color={COLORS.error} size={s(9)} /> : <Ionicons name={an ? 'sync' : 'mic'} size={15} color={FN} />}
      </View>
      <Typography variant="label-01" weight="semibold" style={{ color }} className="flex-1" numberOfLines={1}>
        {voiceText(task)}
      </Typography>
      <VoiceActions task={task} handlers={handlers} />
    </View>
  );
}

// ──────────────── 공통 소견/음성 조각 ────────────────

function OpinionLabel({ task }: { task: TaskMock }) {
  return (
    <View className="flex-row items-center" style={{ gap: s(6) }}>
      {task.hasOpinion ? <Ionicons name="checkmark-circle" size={15} color={COLORS.success} /> : <Ionicons name="ellipse-outline" size={15} color={COLORS.gray[300]} />}
      <Typography variant="label-01" weight="semibold" style={{ color: task.hasOpinion ? COLORS.gray[700] : COLORS.gray[600] }}>
        소견 {task.hasOpinion ? '작성됨' : '미작성'}
      </Typography>
    </View>
  );
}

function OpinionAction({ task }: { task: TaskMock }) {
  return (
    <TouchableOpacity activeOpacity={0.8} className="flex-row items-center" style={{ gap: s(2) }}>
      <Typography variant="label-01" weight="semibold" style={{ color: task.hasOpinion ? COLORS.gray[600] : COLORS.primary }}>
        {task.hasOpinion ? '수정' : '작성'}
      </Typography>
      <Icon name="arrow-right" size={12} color={task.hasOpinion ? COLORS.gray[600] : COLORS.primary} />
    </TouchableOpacity>
  );
}

/** 소견 라벨 행 + (작성됐으면) 본문 미리보기 한 줄. 두 줄/스파인/트레이 공용. */
function OpinionBlock({ task }: { task: TaskMock }) {
  return (
    <View style={{ gap: s(3) }}>
      <View className="flex-row items-center" style={{ justifyContent: 'space-between' }}>
        <OpinionLabel task={task} />
        <OpinionAction task={task} />
      </View>
      {task.hasOpinion && task.opinion && (
        <Typography variant="label-02" className="text-gray-500" numberOfLines={1} style={{ paddingLeft: s(21) }}>
          {task.opinion}
        </Typography>
      )}
    </View>
  );
}

function VoiceActionBtn({ icon, label, onPress, kind }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; kind: 'primary' | 'ghost' }) {
  const primary = kind === 'primary';
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }} style={{ flexDirection: 'row', alignItems: 'center', gap: s(4), paddingHorizontal: s(10), paddingVertical: s(6), borderRadius: 999, backgroundColor: primary ? FN : 'transparent', borderWidth: primary ? 0 : 1, borderColor: COLORS.gray[300] }}>
      <Ionicons name={icon} size={12} color={primary ? COLORS.white : COLORS.gray[500]} />
      <Typography variant="label-02" weight="semibold" style={{ color: primary ? COLORS.white : COLORS.gray[600] }}>{label}</Typography>
    </TouchableOpacity>
  );
}

/** 상태별 음성 액션 — 녹음중/분석중은 행 텍스트가 상태를 말하므로 액션 없음(중복 제거) */
function VoiceActions({ task, handlers }: { task: TaskMock; handlers: VoiceHandlers }) {
  const { id, fn } = task;
  if (fn === 'recording' || fn === 'analyzing') return null;
  if (fn === 'saved')
    return (
      <View className="flex-row items-center" style={{ gap: s(6) }}>
        <VoiceActionBtn icon="mic" label="이어" kind="ghost" onPress={() => handlers.onResume(id)} />
        <VoiceActionBtn icon="sparkles" label="분석하기" kind="primary" onPress={() => handlers.onProcess(id)} />
      </View>
    );
  if (fn === 'done')
    return (
      <View className="flex-row items-center" style={{ gap: s(6) }}>
        <VoiceActionBtn icon="mic" label="이어" kind="ghost" onPress={() => handlers.onResume(id)} />
        <VoiceActionBtn icon="document-text" label="분석 보기" kind="primary" onPress={() => {}} />
      </View>
    );
  return <VoiceActionBtn icon="mic" label="녹음 시작" kind="primary" onPress={() => handlers.onStart(id)} />;
}

/** 음성 한 줄 상태 텍스트 — 상태를 딱 한 번만. 완료는 "완료" 대신 키워드(값)를 노출. */
function voiceText(task: TaskMock): string {
  switch (task.fn) {
    case 'recording': return `녹음 중 ${task.timer}`;
    case 'analyzing': return '음성 · 분석 중';
    case 'saved': return '음성 · 녹음됨';
    case 'done': return `음성 · ${task.keyword}`;
    default: return '음성 기록 (선택)';
  }
}

/** 음성 한 줄 — 좌측 상태 텍스트(한 번) + 우측 액션. 두 줄/스파인 공용. */
function VoiceRow({ task, handlers }: { task: TaskMock; handlers: VoiceHandlers }) {
  const rec = task.fn === 'recording';
  const an = task.fn === 'analyzing';
  const color = rec ? COLORS.error : an ? FN : COLORS.gray[600];
  return (
    <View className="flex-row items-center" style={{ justifyContent: 'space-between', gap: s(8) }}>
      <View className="flex-row items-center" style={{ gap: s(6), flexShrink: 1 }}>
        {rec ? <PulseDot color={COLORS.error} size={s(7)} /> : <Ionicons name={an ? 'sync' : 'mic-outline'} size={14} color={color} />}
        <Typography variant="label-01" weight="medium" style={{ color }} numberOfLines={1}>{voiceText(task)}</Typography>
      </View>
      <VoiceActions task={task} handlers={handlers} />
    </View>
  );
}

/** 현재(대조군) 미니 칩 */
function MiniChip({ state, timer, onStart }: { state: FnState; timer?: string; onStart: () => void }) {
  const box = (bg: string, c: string, ic: keyof typeof Ionicons.glyphMap, label: string, onPress?: () => void) => (
    <TouchableOpacity disabled={!onPress} onPress={onPress} activeOpacity={0.7} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: s(4), paddingHorizontal: s(9), paddingVertical: s(5), borderRadius: 999, backgroundColor: bg }}>
      <Ionicons name={ic} size={12} color={c} />
      <Typography variant="label-02" weight="semibold" style={{ color: c }}>{label}</Typography>
    </TouchableOpacity>
  );
  if (state === 'recording') return box(REC_TINT, COLORS.error, 'radio-button-on', '녹음 중');
  if (state === 'analyzing') return box(FN_TINT, FN, 'sync', '분석 중');
  if (state === 'saved') return box(FN_TINT, FN, 'ellipsis-horizontal-circle', '녹음됨');
  if (state === 'done') return box(FN_TINT, FN, 'document-text', '분석');
  return box(FN_TINT, FN, 'mic', '녹음', onStart);
}

// ──────────────── 미니바 / 충돌 ────────────────

function RecordingMiniBar({ task, bottomInset, onStop }: { task: TaskMock; bottomInset: number; onStop: () => void }) {
  return (
    <View style={{ position: 'absolute', left: s(12), right: s(12), bottom: bottomInset + s(10), backgroundColor: COLORS.gray[900], borderRadius: s(16), paddingVertical: s(12), paddingHorizontal: s(14), flexDirection: 'row', alignItems: 'center', gap: s(10), shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8 }}>
      <PulseDot color={COLORS.error} size={s(8)} />
      <WaveBars count={5} color={COLORS.white} mode="live" height={s(14)} barWidth={s(2)} gap={s(2)} />
      <View style={{ flex: 1 }}>
        <Typography variant="label-02" weight="semibold" style={{ color: COLORS.white }} numberOfLines={1}>{task.name} 녹음 중</Typography>
        <Typography variant="caption-01" style={{ color: COLORS.gray[400] }}>{task.timer} · 정지하면 분석으로 넘어가요</Typography>
      </View>
      <TouchableOpacity onPress={onStop} activeOpacity={0.8} accessibilityLabel="녹음 정지" accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: s(5), backgroundColor: COLORS.error, borderRadius: 999, paddingVertical: s(7), paddingHorizontal: s(12) }}>
        <Ionicons name="stop" size={13} color={COLORS.white} />
        <Typography variant="label-02" weight="semibold" style={{ color: COLORS.white }}>정지</Typography>
      </TouchableOpacity>
    </View>
  );
}

function ConflictModal({ fromName, toName, onCancel, onConfirm }: { fromName: string; toName: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: s(28) }}>
      <View style={{ width: '100%', backgroundColor: COLORS.white, borderRadius: s(20), padding: s(20), gap: s(8) }}>
        <Typography variant="headline-02" weight="semibold" className="text-gray-900">녹음을 바꿀까요?</Typography>
        <Typography variant="body-03" className="text-gray-600" style={{ lineHeight: 20 }}>
          지금 <Typography variant="body-03" weight="semibold" className="text-gray-800">{fromName}</Typography> 녹음 중이에요.
          멈추고 <Typography variant="body-03" weight="semibold" className="text-gray-800">{toName}</Typography> 녹음을 시작할까요? 멈춘 녹음은 폐기되지 않고 분석으로 넘어가요.
        </Typography>
        <View className="flex-row" style={{ gap: s(8), marginTop: s(8) }}>
          <TouchableOpacity onPress={onCancel} activeOpacity={0.8} style={{ flex: 1, backgroundColor: COLORS.gray[100], borderRadius: s(12), paddingVertical: s(13), alignItems: 'center' }}>
            <Typography variant="body-02" weight="semibold" style={{ color: COLORS.gray[700] }}>취소</Typography>
          </TouchableOpacity>
          <TouchableOpacity onPress={onConfirm} activeOpacity={0.85} style={{ flex: 1, backgroundColor: FN, borderRadius: s(12), paddingVertical: s(13), alignItems: 'center' }}>
            <Typography variant="body-02" weight="semibold" style={{ color: COLORS.white }}>멈추고 새로</Typography>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ──────────────── 모션 ────────────────

const STATIC_WAVE = [0.4, 0.7, 0.5, 0.95, 0.6, 1, 0.45, 0.8, 0.5, 0.7];

function WaveBars({ count = 5, color, mode, height = 14, barWidth = 2, gap = 2 }: { count?: number; color: string; mode: 'live' | 'static'; height?: number; barWidth?: number; gap?: number }) {
  const animsRef = useRef(Array.from({ length: count }, () => new Animated.Value(0.4)));
  const anims = animsRef.current;
  useEffect(() => {
    if (mode !== 'live') return;
    const loops = anims.map((v, i) =>
      Animated.loop(Animated.sequence([Animated.delay((i % 5) * 60), Animated.timing(v, { toValue: 1, duration: 300, useNativeDriver: false }), Animated.timing(v, { toValue: 0.3, duration: 300, useNativeDriver: false })])),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [mode, anims]);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap, height }}>
      {anims.map((v, i) => {
        const h = mode === 'live' ? v.interpolate({ inputRange: [0, 1], outputRange: [height * 0.25, height] }) : height * STATIC_WAVE[i % STATIC_WAVE.length];
        return <Animated.View key={i} style={{ width: barWidth, height: h, borderRadius: barWidth, backgroundColor: color }} />;
      })}
    </View>
  );
}

function PulseDot({ color, size = 8 }: { color: string; size?: number }) {
  const a = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([Animated.timing(a, { toValue: 0.3, duration: 650, useNativeDriver: true }), Animated.timing(a, { toValue: 1, duration: 650, useNativeDriver: true })]));
    loop.start();
    return () => loop.stop();
  }, [a]);
  return <Animated.View style={{ width: size, height: size, borderRadius: size, backgroundColor: color, opacity: a }} />;
}
