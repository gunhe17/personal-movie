import { useEffect, useRef, useState } from 'react';
import { View, ScrollView, TouchableOpacity, Animated, Dimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, LAYOUT } from '@/shared/constants/theme';
import { Typography } from '@/shared/components/ui/Typography';
import { Icon } from '@/shared/components/icons';
import { s } from '@/shared/utils/scale';

/**
 * [검사 항목] 카드 틀을 깬 레이아웃 케이스 lab.
 *
 * 짝 lab(assessment-task-record-3beat)은 "카드 표면"을 다뤘다면, 이건 "카드 말고
 * 다른 구조로 보여줄 수 있나"를 탐색. 같은 데이터 모델(소견 독립 + 음성 선택 +
 * 라이프사이클 시작/이어/분석하기/보기, 온라인 숨김, 단일 활성 미니바)을 유지하되
 * 레이아웃 패러다임을 통째로 바꿈.
 *
 * 탭 — [타임라인] 좌측 스파인 노드 흐름 / [문서] 카드 컨테이너 없는 에디토리얼 행 /
 * [보드] 챙길 것·진행·끝남 트리아지 그룹 / [접기] 한 줄 + 탭 펼침 아코디언 /
 * [포커스] 한 검사 크게 + 좌우 peek 캐러셀.
 *
 * 인터랙티브 유지(녹음 시작→미니바→정지→분석, 분석하기, 충돌). 전부 mock.
 * 보라=fieldnote/빨강=녹음/blue=검사 카테고리.
 */

type TabKey = 'timeline' | 'editorial' | 'board' | 'accordion' | 'focus';

const TABS: { key: TabKey; label: string; caption: string }[] = [
  { key: 'timeline', label: '타임라인', caption: '좌측 세로 스파인에 검사가 노드로 꿰임. 박스가 아니라 "흐름"으로 읽힘. 진행 순서·상태가 위→아래로.' },
  { key: 'editorial', label: '문서', caption: '카드 컨테이너 제거 — 여백·타이포 위계·얇은 룰로만 구분하는 에디토리얼 리스트. 임상 노트처럼 차분.' },
  { key: 'board', label: '보드', caption: '"지금 챙길 것 · 진행 중 · 끝남"으로 그룹핑한 트리아지 보드. 리스트가 아니라 할 일 판으로 reframe.' },
  { key: 'accordion', label: '접기', caption: '평소엔 한 줄(검사명+소견·음성 미니 상태), 탭하면 그 자리서 펼쳐 미리보기·액션. 밀도↑ + 점진 노출.' },
  { key: 'focus', label: '포커스', caption: '한 검사를 크게, 좌우로 이웃 살짝 peek. 스와이프로 한 건씩 몰입. 리스트 대신 한 번에 하나.' },
];

type FnState = 'none' | 'recording' | 'analyzing' | 'saved' | 'done' | 'online';

type TaskMock = {
  id: string;
  name: string;
  short: string;
  status: 'completed' | 'in_progress' | 'submitted' | 'pending';
  hasOpinion: boolean;
  fn: FnState;
  timer?: string;
  keyword?: string;
  opinion?: string;
};

const TASKS: TaskMock[] = [
  { id: 't1', name: 'BGT (벤더게슈탈트)', short: 'BGT', status: 'completed', hasOpinion: true, fn: 'done', keyword: '불안 단서 多', opinion: '전반적으로 불안 수준이 높고, 도형 모사 시 지우기·재확인이 잦았음.' },
  { id: 't2', name: 'Rorschach (로르샤흐)', short: 'Rorschach', status: 'in_progress', hasOpinion: false, fn: 'none' },
  { id: 't3', name: 'HTP (집-나무-사람)', short: 'HTP', status: 'submitted', hasOpinion: false, fn: 'saved' },
  { id: 't4', name: 'SCT (문장완성)', short: 'SCT', status: 'submitted', hasOpinion: false, fn: 'analyzing' },
  { id: 't5', name: 'K-WISC-V (온라인)', short: 'K-WISC-V', status: 'in_progress', hasOpinion: false, fn: 'online' },
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
const ASSESS = '#3495F5';
const W = Dimensions.get('window').width;

function fmt(sec: number) {
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
}

type Handlers = { onStart: (id: string) => void; onResume: (id: string) => void; onProcess: (id: string) => void };

// ──────────────── Page ────────────────

export default function AssessmentTaskLayoutBreakLab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [tabKey, setTabKey] = useState<TabKey>('timeline');
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

  const reset = (k: TabKey) => {
    setTabKey(k);
    setRecId(null);
    setElapsed(0);
    setOverrides({});
    setConflict(null);
  };

  const eff = (t: TaskMock): FnState => (recId === t.id ? 'recording' : overrides[t.id] ?? t.fn);
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

  const tasks: TaskMock[] = TASKS.map((t) => ({
    ...t,
    fn: eff(t),
    timer: recId === t.id ? fmt(elapsed) : undefined,
    keyword: t.keyword ?? (eff(t) === 'done' ? '관찰 메모 정리됨' : undefined),
  }));
  const recTask = tasks.find((t) => t.id === recId) ?? null;
  const handlers: Handlers = { onStart: start, onResume: start, onProcess: process };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: COLORS.bg.base }} edges={['top']}>
      <View className="h-[52px] flex-row items-center px-5" style={{ backgroundColor: COLORS.bg.base }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} accessibilityLabel="뒤로 가기" accessibilityRole="button">
          <Icon name="arrow-left" size={24} color={COLORS.gray[900]} />
        </TouchableOpacity>
        <Typography variant="title-01" weight="semibold" className="ml-1.5 text-gray-900">검사 항목 · 틀을 깬 레이아웃</Typography>
      </View>

      <View style={{ paddingHorizontal: s(LAYOUT.screenPaddingX), paddingTop: s(8) }}>
        <View style={{ flexDirection: 'row', backgroundColor: COLORS.gray[100], borderRadius: s(10), padding: s(3) }}>
          {TABS.map((t) => {
            const on = t.key === tabKey;
            return (
              <TouchableOpacity key={t.key} activeOpacity={0.8} onPress={() => reset(t.key)} style={{ flex: 1, paddingVertical: s(8), paddingHorizontal: s(1), borderRadius: s(8), alignItems: 'center', backgroundColor: on ? COLORS.white : 'transparent' }}>
                <Typography variant="label-02" weight={on ? 'semibold' : 'medium'} numberOfLines={1} style={{ color: on ? COLORS.gray[900] : COLORS.gray[500] }}>{t.label}</Typography>
              </TouchableOpacity>
            );
          })}
        </View>
        <Typography variant="caption-01" className="text-gray-500" style={{ marginTop: s(8), paddingHorizontal: s(2), lineHeight: 16 }}>{active.caption}</Typography>
      </View>

      <View style={{ flex: 1, backgroundColor: tabKey === 'editorial' ? COLORS.white : COLORS.bg.base, marginTop: s(12) }}>
        {tabKey === 'timeline' && <TimelineLayout tasks={tasks} handlers={handlers} bottom={recId ? 110 : 40} />}
        {tabKey === 'editorial' && <EditorialLayout tasks={tasks} handlers={handlers} bottom={recId ? 110 : 40} />}
        {tabKey === 'board' && <BoardLayout tasks={tasks} handlers={handlers} bottom={recId ? 110 : 40} />}
        {tabKey === 'accordion' && <AccordionLayout tasks={tasks} handlers={handlers} bottom={recId ? 110 : 40} />}
        {tabKey === 'focus' && <FocusLayout tasks={tasks} handlers={handlers} />}
      </View>

      {recTask && <MiniBar task={recTask} bottomInset={insets.bottom} onStop={stop} />}
      {conflict && <ConflictModal fromName={recTask?.name ?? ''} toName={TASKS.find((t) => t.id === conflict.toId)?.name ?? ''} onCancel={() => setConflict(null)} onConfirm={confirmSwitch} />}
    </SafeAreaView>
  );
}

// ════════════════ 레이아웃 1 · 타임라인 ════════════════

function TimelineLayout({ tasks, handlers, bottom }: { tasks: TaskMock[]; handlers: Handlers; bottom: number }) {
  return (
    <ScrollView contentContainerStyle={{ paddingTop: s(20), paddingBottom: bottom, paddingHorizontal: s(20) }}>
      {tasks.map((task, i) => {
        const st = TASK_STATUS[task.status];
        const last = i === tasks.length - 1;
        return (
          <View key={task.id} style={{ flexDirection: 'row', gap: s(14) }}>
            {/* 스파인 */}
            <View style={{ width: s(16), alignItems: 'center' }}>
              <View style={{ width: 2, height: s(6), backgroundColor: i === 0 ? 'transparent' : COLORS.gray[200] }} />
              <View style={{ width: s(13), height: s(13), borderRadius: s(13), borderWidth: 2.5, borderColor: st.fg, backgroundColor: COLORS.bg.base }} />
              <View style={{ width: 2, flex: 1, backgroundColor: last ? 'transparent' : COLORS.gray[200] }} />
            </View>
            {/* 콘텐츠 */}
            <View style={{ flex: 1, paddingBottom: last ? 0 : s(22) }}>
              <View className="flex-row items-center" style={{ gap: s(8) }}>
                <Typography variant="body-01" weight="semibold" className="flex-1 text-gray-900" numberOfLines={1}>{task.name}</Typography>
                <Typography variant="label-02" weight="semibold" style={{ color: st.fg }}>{st.label}</Typography>
              </View>
              <View style={{ marginTop: s(8), gap: s(8) }}>
                <OpinionLine task={task} />
                {task.fn !== 'online' && <VoiceLine task={task} handlers={handlers} />}
              </View>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

// ════════════════ 레이아웃 2 · 에디토리얼(문서) ════════════════

function EditorialLayout({ tasks, handlers, bottom }: { tasks: TaskMock[]; handlers: Handlers; bottom: number }) {
  return (
    <ScrollView contentContainerStyle={{ paddingTop: s(8), paddingBottom: bottom, paddingHorizontal: s(24) }}>
      {tasks.map((task, i) => {
        const st = TASK_STATUS[task.status];
        const rec = task.fn === 'recording';
        return (
          <View key={task.id} style={{ paddingVertical: s(20), borderTopWidth: i === 0 ? 0 : 1, borderTopColor: COLORS.gray[100] }}>
            <View className="flex-row items-baseline" style={{ gap: s(8) }}>
              <View style={{ width: s(6), height: s(6), borderRadius: s(6), backgroundColor: ASSESS }} />
              <Typography variant="title-01" weight="semibold" className="flex-1 text-gray-900" numberOfLines={1}>{task.name}</Typography>
              <Typography variant="label-02" weight="medium" style={{ color: st.fg }}>{st.label}</Typography>
            </View>

            {/* 소견 = 본문 */}
            <View style={{ marginTop: s(10), paddingLeft: s(14) }}>
              {task.hasOpinion ? (
                <Typography variant="body-02-reading" className="text-gray-700">{task.opinion}</Typography>
              ) : (
                <Typography variant="body-02" className="text-gray-400">소견이 아직 비어 있어요.</Typography>
              )}
              <TouchableOpacity activeOpacity={0.7} className="flex-row items-center" style={{ gap: s(3), marginTop: s(6) }}>
                <Typography variant="label-01" weight="semibold" style={{ color: task.hasOpinion ? COLORS.gray[600] : COLORS.primary }}>
                  {task.hasOpinion ? '소견 수정' : '소견 작성'}
                </Typography>
                <Icon name="arrow-right" size={11} color={task.hasOpinion ? COLORS.gray[600] : COLORS.primary} />
              </TouchableOpacity>
            </View>

            {/* 음성 = 여백 주석 */}
            {task.fn !== 'online' && (
              <View style={{ marginTop: s(14), paddingLeft: s(14), flexDirection: 'row', alignItems: 'center', gap: s(8) }}>
                {rec ? <PulseDot color={COLORS.error} size={s(6)} /> : <Ionicons name="mic-outline" size={13} color={COLORS.gray[400]} />}
                <Typography variant="label-02" style={{ color: rec ? COLORS.error : COLORS.gray[400], flex: 1 }} numberOfLines={1}>{voiceText(task)}</Typography>
                <VoiceActions task={task} handlers={handlers} />
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

// ════════════════ 레이아웃 3 · 트리아지 보드 ════════════════

function bucketOf(t: TaskMock): 'attention' | 'progress' | 'done' {
  if (t.fn === 'recording' || t.fn === 'analyzing') return 'progress';
  if (!t.hasOpinion || t.fn === 'saved') return 'attention';
  return 'done';
}

function BoardLayout({ tasks, handlers, bottom }: { tasks: TaskMock[]; handlers: Handlers; bottom: number }) {
  const groups: { key: string; title: string; accent: string; items: TaskMock[] }[] = [
    { key: 'attention', title: '지금 챙길 것', accent: COLORS.warning, items: tasks.filter((t) => bucketOf(t) === 'attention') },
    { key: 'progress', title: '진행 중', accent: ASSESS, items: tasks.filter((t) => bucketOf(t) === 'progress') },
    { key: 'done', title: '끝남', accent: COLORS.success, items: tasks.filter((t) => bucketOf(t) === 'done') },
  ];
  return (
    <ScrollView contentContainerStyle={{ paddingTop: s(20), paddingBottom: bottom, paddingHorizontal: s(20), gap: s(24) }}>
      {groups.filter((g) => g.items.length > 0).map((g) => (
        <View key={g.key} style={{ gap: s(10) }}>
          <View className="flex-row items-center" style={{ gap: s(8) }}>
            <View style={{ width: s(8), height: s(8), borderRadius: s(8), backgroundColor: g.accent }} />
            <Typography variant="label-01" weight="semibold" className="text-gray-700">{g.title}</Typography>
            <Typography variant="label-02" weight="semibold" style={{ color: COLORS.gray[400] }}>{g.items.length}</Typography>
          </View>
          <View style={{ gap: s(8) }}>
            {g.items.map((task) => (
              <View key={task.id} style={{ backgroundColor: COLORS.white, borderRadius: s(14), paddingVertical: s(12), paddingHorizontal: s(14), gap: s(8), shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 1 }, elevation: 1 }}>
                <View className="flex-row items-center" style={{ gap: s(8) }}>
                  <Typography variant="body-02" weight="semibold" className="flex-1 text-gray-900" numberOfLines={1}>{task.name}</Typography>
                  <OpinionPill task={task} />
                </View>
                {task.fn !== 'online' ? (
                  <View className="flex-row items-center" style={{ gap: s(8) }}>
                    {task.fn === 'recording' ? <PulseDot color={COLORS.error} size={s(6)} /> : <Ionicons name="mic-outline" size={13} color={COLORS.gray[400]} />}
                    <Typography variant="label-02" style={{ color: task.fn === 'recording' ? COLORS.error : COLORS.gray[500], flex: 1 }} numberOfLines={1}>{voiceText(task)}</Typography>
                    <VoiceActions task={task} handlers={handlers} />
                  </View>
                ) : (
                  <Typography variant="label-02" className="text-gray-400">온라인 — 음성 해당 없음</Typography>
                )}
              </View>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

// ════════════════ 레이아웃 4 · 아코디언(접기) ════════════════

function AccordionLayout({ tasks, handlers, bottom }: { tasks: TaskMock[]; handlers: Handlers; bottom: number }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <ScrollView contentContainerStyle={{ paddingTop: s(12), paddingBottom: bottom, paddingHorizontal: s(20) }}>
      <View style={{ backgroundColor: COLORS.white, borderRadius: s(16), overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 }}>
        {tasks.map((task, i) => {
          const st = TASK_STATUS[task.status];
          const isOpen = open === task.id;
          return (
            <View key={task.id} style={{ borderTopWidth: i === 0 ? 0 : 1, borderTopColor: COLORS.gray[100] }}>
              <TouchableOpacity activeOpacity={0.7} onPress={() => setOpen(isOpen ? null : task.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: s(10), paddingVertical: s(14), paddingHorizontal: s(16) }}>
                <View style={{ width: s(8), height: s(8), borderRadius: s(8), backgroundColor: st.fg }} />
                <Typography variant="body-02" weight="semibold" className="flex-1 text-gray-900" numberOfLines={1}>{task.name}</Typography>
                {/* 미니 듀얼 상태 */}
                <Ionicons name={task.hasOpinion ? 'document-text' : 'document-outline'} size={14} color={task.hasOpinion ? COLORS.gray[600] : COLORS.gray[300]} />
                {task.fn !== 'online' && <VoiceMiniGlyph fn={task.fn} />}
                <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.gray[400]} />
              </TouchableOpacity>
              {isOpen && (
                <View style={{ paddingHorizontal: s(16), paddingBottom: s(14), paddingLeft: s(34), gap: s(12) }}>
                  <OpinionLine task={task} />
                  {task.fn !== 'online' ? <VoiceLine task={task} handlers={handlers} /> : <Typography variant="label-02" className="text-gray-400">온라인 검사 — 음성 해당 없음</Typography>}
                </View>
              )}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

function VoiceMiniGlyph({ fn }: { fn: FnState }) {
  if (fn === 'recording') return <PulseDot color={COLORS.error} size={s(8)} />;
  if (fn === 'analyzing') return <Ionicons name="sync" size={14} color={FN} />;
  if (fn === 'done') return <Ionicons name="mic" size={14} color={FN} />;
  if (fn === 'saved') return <Ionicons name="ellipse" size={9} color={FN} />;
  return <Ionicons name="mic-outline" size={14} color={COLORS.gray[300]} />;
}

// ════════════════ 레이아웃 5 · 포커스 캐러셀 ════════════════

function FocusLayout({ tasks, handlers }: { tasks: TaskMock[]; handlers: Handlers }) {
  const [idx, setIdx] = useState(0);
  const ref = useRef<ScrollView>(null);
  const PAGE = W - s(72);
  const GAP = s(12);
  const go = (n: number) => {
    const next = Math.max(0, Math.min(tasks.length - 1, n));
    setIdx(next);
    ref.current?.scrollTo({ x: next * (PAGE + GAP), animated: true });
  };
  return (
    <View style={{ flex: 1, paddingTop: s(16) }}>
      <ScrollView
        ref={ref}
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={PAGE + GAP}
        contentContainerStyle={{ paddingHorizontal: s(24), gap: GAP }}
        onMomentumScrollEnd={(e) => setIdx(Math.round(e.nativeEvent.contentOffset.x / (PAGE + GAP)))}
      >
        {tasks.map((task) => {
          const st = TASK_STATUS[task.status];
          const rec = task.fn === 'recording';
          return (
            <View key={task.id} style={{ width: PAGE, backgroundColor: COLORS.white, borderRadius: s(24), padding: s(20), gap: s(18), shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 3 }}>
              <View style={{ gap: s(10) }}>
                <View className="flex-row items-center" style={{ justifyContent: 'space-between' }}>
                  <View style={{ width: s(7), height: s(7), borderRadius: s(7), backgroundColor: ASSESS }} />
                  <View style={{ backgroundColor: st.bg, borderRadius: 999, paddingHorizontal: s(10), paddingVertical: s(3) }}>
                    <Typography variant="label-02" weight="semibold" style={{ color: st.fg }}>{st.label}</Typography>
                  </View>
                </View>
                <Typography variant="headline-02" weight="semibold" className="text-gray-900">{task.name}</Typography>
              </View>

              {/* 소견 */}
              <View style={{ backgroundColor: COLORS.gray[50], borderRadius: s(16), padding: s(16), gap: s(8) }}>
                <View className="flex-row items-center" style={{ gap: s(6) }}>
                  <Ionicons name={task.hasOpinion ? 'checkmark-circle' : 'create-outline'} size={16} color={task.hasOpinion ? COLORS.success : COLORS.primary} />
                  <Typography variant="body-02" weight="semibold" className="flex-1 text-gray-900">소견 {task.hasOpinion ? '작성됨' : '미작성'}</Typography>
                  <Typography variant="label-01" weight="semibold" style={{ color: task.hasOpinion ? COLORS.gray[600] : COLORS.primary }}>{task.hasOpinion ? '수정' : '작성'}</Typography>
                </View>
                {task.hasOpinion && <Typography variant="body-02-reading" className="text-gray-600">{task.opinion}</Typography>}
              </View>

              {/* 음성 */}
              {task.fn !== 'online' ? (
                <View style={{ backgroundColor: rec ? REC_TINT : FN_TINT_SOFT, borderRadius: s(16), padding: s(16), flexDirection: 'row', alignItems: 'center', gap: s(10) }}>
                  {rec ? <PulseDot color={COLORS.error} size={s(9)} /> : <Ionicons name="mic" size={17} color={FN} />}
                  <Typography variant="body-02" weight="semibold" style={{ color: rec ? COLORS.error : COLORS.gray[700], flex: 1 }} numberOfLines={1}>{voiceText(task)}</Typography>
                  <VoiceActions task={task} handlers={handlers} />
                </View>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8), paddingHorizontal: s(4) }}>
                  <Ionicons name="mic-off-outline" size={14} color={COLORS.gray[300]} />
                  <Typography variant="label-01" className="text-gray-400">온라인 검사 — 음성 기록은 해당 없어요</Typography>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* 컨트롤 */}
      <View className="flex-row items-center justify-center" style={{ gap: s(16), paddingVertical: s(16) }}>
        <TouchableOpacity onPress={() => go(idx - 1)} disabled={idx === 0} activeOpacity={0.7} style={{ opacity: idx === 0 ? 0.3 : 1 }}>
          <Ionicons name="chevron-back-circle" size={32} color={COLORS.gray[700]} />
        </TouchableOpacity>
        <View className="flex-row items-center" style={{ gap: s(6) }}>
          {tasks.map((t, i) => (
            <View key={t.id} style={{ width: i === idx ? s(18) : s(6), height: s(6), borderRadius: s(6), backgroundColor: i === idx ? FN : COLORS.gray[300] }} />
          ))}
        </View>
        <TouchableOpacity onPress={() => go(idx + 1)} disabled={idx === tasks.length - 1} activeOpacity={0.7} style={{ opacity: idx === tasks.length - 1 ? 0.3 : 1 }}>
          <Ionicons name="chevron-forward-circle" size={32} color={COLORS.gray[700]} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ──────────────── 공용 소견/음성 조각 ────────────────

function OpinionLine({ task }: { task: TaskMock }) {
  return (
    <TouchableOpacity activeOpacity={0.7} className="flex-row" style={{ gap: s(6), alignItems: task.hasOpinion ? 'flex-start' : 'center' }}>
      <Ionicons name={task.hasOpinion ? 'checkmark-circle' : 'ellipse-outline'} size={14} color={task.hasOpinion ? COLORS.success : COLORS.gray[300]} style={{ marginTop: task.hasOpinion ? s(1) : 0 }} />
      <View style={{ flex: 1 }}>
        <View className="flex-row items-center" style={{ justifyContent: 'space-between' }}>
          <Typography variant="label-01" weight="semibold" style={{ color: task.hasOpinion ? COLORS.gray[700] : COLORS.gray[600] }}>소견 {task.hasOpinion ? '작성됨' : '미작성'}</Typography>
          <View className="flex-row items-center" style={{ gap: s(2) }}>
            <Typography variant="label-01" weight="semibold" style={{ color: task.hasOpinion ? COLORS.gray[600] : COLORS.primary }}>{task.hasOpinion ? '수정' : '작성'}</Typography>
            <Icon name="arrow-right" size={11} color={task.hasOpinion ? COLORS.gray[600] : COLORS.primary} />
          </View>
        </View>
        {task.hasOpinion && task.opinion && (
          <Typography variant="label-02" className="text-gray-500" numberOfLines={1} style={{ marginTop: s(2) }}>{task.opinion}</Typography>
        )}
      </View>
    </TouchableOpacity>
  );
}

function OpinionPill({ task }: { task: TaskMock }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(3), backgroundColor: task.hasOpinion ? COLORS.gray[100] : COLORS.primary50, borderRadius: 999, paddingHorizontal: s(8), paddingVertical: s(3) }}>
      <Ionicons name={task.hasOpinion ? 'checkmark' : 'create-outline'} size={11} color={task.hasOpinion ? COLORS.gray[600] : COLORS.primary} />
      <Typography variant="label-02" weight="semibold" style={{ color: task.hasOpinion ? COLORS.gray[600] : COLORS.primary }}>{task.hasOpinion ? '소견' : '소견 작성'}</Typography>
    </View>
  );
}

function voiceText(task: TaskMock): string {
  switch (task.fn) {
    case 'recording': return `녹음 중 ${task.timer}`;
    case 'analyzing': return '음성 · 분석 중';
    case 'saved': return '음성 · 녹음됨';
    case 'done': return `음성 · ${task.keyword}`;
    default: return '음성 기록 (선택)';
  }
}

function VoiceLine({ task, handlers }: { task: TaskMock; handlers: Handlers }) {
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

function VBtn({ icon, label, onPress, kind }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; kind: 'primary' | 'ghost' }) {
  const p = kind === 'primary';
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }} style={{ flexDirection: 'row', alignItems: 'center', gap: s(4), paddingHorizontal: s(10), paddingVertical: s(6), borderRadius: 999, backgroundColor: p ? FN : 'transparent', borderWidth: p ? 0 : 1, borderColor: COLORS.gray[300] }}>
      <Ionicons name={icon} size={12} color={p ? COLORS.white : COLORS.gray[500]} />
      <Typography variant="label-02" weight="semibold" style={{ color: p ? COLORS.white : COLORS.gray[600] }}>{label}</Typography>
    </TouchableOpacity>
  );
}

function VoiceActions({ task, handlers }: { task: TaskMock; handlers: Handlers }) {
  const { id, fn } = task;
  if (fn === 'recording' || fn === 'analyzing') return null;
  if (fn === 'saved')
    return (
      <View className="flex-row items-center" style={{ gap: s(6) }}>
        <VBtn icon="mic" label="이어" kind="ghost" onPress={() => handlers.onResume(id)} />
        <VBtn icon="sparkles" label="분석하기" kind="primary" onPress={() => handlers.onProcess(id)} />
      </View>
    );
  if (fn === 'done')
    return (
      <View className="flex-row items-center" style={{ gap: s(6) }}>
        <VBtn icon="mic" label="이어" kind="ghost" onPress={() => handlers.onResume(id)} />
        <VBtn icon="document-text" label="분석 보기" kind="primary" onPress={() => {}} />
      </View>
    );
  return <VBtn icon="mic" label="녹음 시작" kind="primary" onPress={() => handlers.onStart(id)} />;
}

// ──────────────── 미니바 / 충돌 ────────────────

function MiniBar({ task, bottomInset, onStop }: { task: TaskMock; bottomInset: number; onStop: () => void }) {
  return (
    <View style={{ position: 'absolute', left: s(12), right: s(12), bottom: bottomInset + s(10), backgroundColor: COLORS.gray[900], borderRadius: s(16), paddingVertical: s(12), paddingHorizontal: s(14), flexDirection: 'row', alignItems: 'center', gap: s(10), shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8 }}>
      <PulseDot color={COLORS.error} size={s(8)} />
      <WaveBars color={COLORS.white} />
      <View style={{ flex: 1 }}>
        <Typography variant="label-02" weight="semibold" style={{ color: COLORS.white }} numberOfLines={1}>{task.name} 녹음 중</Typography>
        <Typography variant="caption-01" style={{ color: COLORS.gray[400] }}>{task.timer} · 정지하면 분석으로 넘어가요</Typography>
      </View>
      <TouchableOpacity onPress={onStop} activeOpacity={0.8} style={{ flexDirection: 'row', alignItems: 'center', gap: s(5), backgroundColor: COLORS.error, borderRadius: 999, paddingVertical: s(7), paddingHorizontal: s(12) }}>
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

function WaveBars({ color }: { color: string }) {
  const anims = useRef(Array.from({ length: 5 }, () => new Animated.Value(0.4))).current;
  useEffect(() => {
    const loops = anims.map((v, i) =>
      Animated.loop(Animated.sequence([Animated.delay((i % 5) * 60), Animated.timing(v, { toValue: 1, duration: 300, useNativeDriver: false }), Animated.timing(v, { toValue: 0.3, duration: 300, useNativeDriver: false })])),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [anims]);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(2), height: s(14) }}>
      {anims.map((v, i) => (
        <Animated.View key={i} style={{ width: s(2), height: v.interpolate({ inputRange: [0, 1], outputRange: [s(3), s(14)] }), borderRadius: s(2), backgroundColor: color }} />
      ))}
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
