import { useEffect, useMemo, useRef, useState } from 'react';
import { View, ScrollView, TouchableOpacity, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/shared/constants/theme';
import { Typography } from '@/shared/components/ui/Typography';
import { s } from '@/shared/utils/scale';

/**
 * [필드노트] 목록 · 도메인 필터 + 틀을 깬 레이아웃 lab.
 *
 * 두 고민을 한 화면에서:
 *  (1) 필터칩 이름 — "회기 미지정"은 상담 편향(검사는 task 연결). 상담·검사를 함께
 *      포용하는 축으로: [전체 · 상담 · 검사 · 미지정]. "미지정"은 중립어(둘 다 커버).
 *  (2) 목록 — 단순 세로 리스트 탈피. 음성 기록이라는 본질을 살린 틀 깬 레이아웃 3안.
 *
 * 탭(목록 패러다임) — [타임라인] 시간 스파인에 노트가 꿰임 / [도메인 레인] 상담·검사·
 * 미지정 그룹 띠 / [웨이브 피드] 파형이 주연인 매거진형 큰 카드.
 *
 * 필터칩은 세 탭 공용(상단 고정). 다크 필드노트 스킨(COLORS.fieldnoteDark).
 * 전부 mock — 확정 시 FieldNoteListContent + 필터에 반영.
 */

const DK = {
  bg: COLORS.fieldnoteDark.bg,
  card: COLORS.fieldnoteDark.card,
  line: COLORS.fieldnoteDark.line,
  text: COLORS.fieldnoteDark.text,
  sub: COLORS.fieldnoteDark.sub,
  accent: COLORS.fieldnoteDark.accent,
  error: COLORS.error,
  warning: COLORS.warning,
  success: COLORS.success,
  assess: COLORS.assessment,
} as const;

type Pipeline = 'recording' | 'analyzing' | 'pending' | 'failed' | 'summary';
type LinkKind = 'schedule' | 'task' | null;
type Domain = 'counsel' | 'assess' | 'unassigned';

interface Note {
  id: string;
  dateKey: string;
  dateLabel: string;
  time: string;
  rel: string;
  dur: string | null;
  link: LinkKind;
  clients: string[];
  assessment?: string;
  caseId?: string; // 검사 세션(케이스) — 같은 풀배터리 task 노트 묶음 키
  battery?: string; // 검사 세트명(종합심리평가 등)
  pipeline: Pipeline;
  summary: string | null;
}

const NOTES: Note[] = [
  // 오늘 — 상담 녹음 진행 중
  { id: 'u1', dateKey: 'd0', dateLabel: '오늘 · 6월 8일 (월)', time: '15:10', rel: '방금', dur: null, link: 'schedule', clients: ['김민준'], pipeline: 'recording', summary: null },
  // 오늘 — 검사 풀배터리(홍길동 · 종합심리평가) task 노트 3건 (같은 caseId)
  { id: 'h-htp', dateKey: 'd0', dateLabel: '오늘 · 6월 8일 (월)', time: '14:40', rel: '30분 전', dur: '21분', link: 'task', clients: ['홍길동'], assessment: 'HTP', caseId: 'cH', battery: '종합심리평가', pipeline: 'summary', summary: 'HTP 실시·질문 단계. 집 그림에서 창문을 반복 강조.' },
  { id: 'h-bgt', dateKey: 'd0', dateLabel: '오늘 · 6월 8일 (월)', time: '14:20', rel: '50분 전', dur: '12분', link: 'task', clients: ['홍길동'], assessment: 'BGT', caseId: 'cH', battery: '종합심리평가', pipeline: 'analyzing', summary: null },
  { id: 'h-sct', dateKey: 'd0', dateLabel: '오늘 · 6월 8일 (월)', time: '14:05', rel: '1시간 전', dur: '9분', link: 'task', clients: ['홍길동'], assessment: 'SCT', caseId: 'cH', battery: '종합심리평가', pipeline: 'pending', summary: null },
  // 오늘 — 상담
  { id: 'c1', dateKey: 'd0', dateLabel: '오늘 · 6월 8일 (월)', time: '13:32', rel: '2시간 전', dur: '32분', link: 'schedule', clients: ['이서연', '이준호'], pipeline: 'summary', summary: '분리불안이 다시 올라온 한 주. 등원 거부가 핵심 주제였고, 후반부에 스스로 다음 주 계획을 말함.' },
  { id: 'c2', dateKey: 'd0', dateLabel: '오늘 · 6월 8일 (월)', time: '11:05', rel: '4시간 전', dur: '25분', link: 'schedule', clients: ['서준'], pipeline: 'pending', summary: '오늘은 학교에서 친구와 있었던 일을 먼저 꺼냈고, 중간에 한참 말을 멈췄다가…' },
  { id: 'x1', dateKey: 'd0', dateLabel: '오늘 · 6월 8일 (월)', time: '09:50', rel: '5시간 전', dur: '5분', link: null, clients: [], pipeline: 'pending', summary: null },
  // 어제 — 검사 단건(강민서 · 인지기능평가, task 1건 → 단건 표시)
  { id: 'k-bgt', dateKey: 'd1', dateLabel: '어제 · 6월 7일 (일)', time: '14:00', rel: '어제', dur: '33분', link: 'task', clients: ['강민서'], assessment: 'BGT', caseId: 'cK', battery: '인지기능평가', pipeline: 'summary', summary: 'BGT 실시. 도형 모사 중 지우기·재확인이 잦았음.' },
  // 어제 — 상담
  { id: 'c3', dateKey: 'd1', dateLabel: '어제 · 6월 7일 (일)', time: '13:00', rel: '어제', dur: '44분', link: 'schedule', clients: ['박도윤'], pipeline: 'failed', summary: null },
  // 며칠 전 — 미지정
  { id: 'x2', dateKey: 'd2', dateLabel: '6월 5일 (목)', time: '11:00', rel: '3일 전', dur: '12분', link: null, clients: [], pipeline: 'pending', summary: null },
];

function domainOf(n: Note): Domain {
  if (n.link === 'schedule') return 'counsel';
  if (n.link === 'task') return 'assess';
  return 'unassigned';
}

function identity(n: Note): string {
  if (n.link === 'task') return `${n.clients[0] ?? '내담자'} · ${n.assessment}`;
  if (n.link === 'schedule') return n.clients.length > 1 ? `${n.clients[0]} 외 ${n.clients.length - 1}명` : (n.clients[0] ?? '내담자');
  return '미지정';
}

// strip = "이 노트가 나에게 뭐냐" (진행 red / 처리 purple / 챙길 것 orange / 완료 무색)
function stripColor(n: Note): string {
  if (n.pipeline === 'recording') return DK.error;
  if (n.pipeline === 'analyzing') return DK.accent;
  if (domainOf(n) === 'unassigned' || n.pipeline === 'failed') return DK.warning;
  return 'transparent';
}

function stateMeta(n: Note): { text: string; color: string } | null {
  switch (n.pipeline) {
    case 'recording': return { text: '녹음 중', color: DK.error };
    case 'analyzing': return { text: '분석 중', color: DK.accent };
    case 'failed': return { text: '분석 실패 · 다시', color: DK.warning };
    case 'pending': return { text: '분석하기', color: DK.accent };
    default: return null; // summary(완료)
  }
}

type TabKey = 'timeline' | 'lane' | 'feed';
const TABS: { key: TabKey; label: string; caption: string }[] = [
  { key: 'timeline', label: '타임라인', caption: '시간 스파인에 노트가 꿰임 — 음성 기록이 "언제"의 흐름으로 읽힘. 날짜 그룹 + 좌측 시각.' },
  { key: 'lane', label: '도메인 레인', caption: '상담·검사·미지정을 띠(그룹)로. 필터와 같은 축을 공간으로 보여줌. 미지정은 "챙길 것"으로 위에.' },
  { key: 'feed', label: '웨이브 피드', caption: '파형이 주연인 매거진형 큰 카드 — 녹음이라는 본질을 전면에. 한 건씩 풍부하게.' },
];

type DomFilter = 'all' | Domain;
const FILTERS: { key: DomFilter; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'counsel', label: '상담' },
  { key: 'assess', label: '검사' },
  { key: 'unassigned', label: '미지정' },
];

// ──────────────── Page ────────────────

export default function FieldNoteListBreakLab() {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>('timeline');
  const [filter, setFilter] = useState<DomFilter>('all');
  const active = TABS.find((t) => t.key === tab)!;

  const counts = useMemo(() => {
    const c: Record<DomFilter, number> = { all: NOTES.length, counsel: 0, assess: 0, unassigned: 0 };
    NOTES.forEach((n) => { c[domainOf(n)]++; });
    return c;
  }, []);

  const notes = useMemo(() => (filter === 'all' ? NOTES : NOTES.filter((n) => domainOf(n) === filter)), [filter]);

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: DK.bg }} edges={['top']}>
      <View className="h-[52px] flex-row items-center px-5">
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} accessibilityLabel="뒤로 가기" accessibilityRole="button">
          <Ionicons name="chevron-back" size={24} color={DK.text} />
        </TouchableOpacity>
        <Typography variant="title-01" weight="semibold" style={{ color: DK.text, marginLeft: s(6) }}>필드노트 · 목록</Typography>
      </View>

      {/* 목록 패러다임 탭 */}
      <View style={{ paddingHorizontal: s(16), paddingTop: s(8) }}>
        <View style={{ flexDirection: 'row', backgroundColor: DK.card, borderRadius: s(10), padding: s(3) }}>
          {TABS.map((t) => {
            const on = t.key === tab;
            return (
              <TouchableOpacity key={t.key} activeOpacity={0.8} onPress={() => setTab(t.key)} style={{ flex: 1, paddingVertical: s(8), borderRadius: s(8), alignItems: 'center', backgroundColor: on ? DK.accent : 'transparent' }}>
                <Typography variant="label-01" weight={on ? 'semibold' : 'medium'} style={{ color: on ? '#fff' : DK.sub }}>{t.label}</Typography>
              </TouchableOpacity>
            );
          })}
        </View>
        <Typography variant="caption-01" style={{ color: DK.sub, marginTop: s(8), paddingHorizontal: s(2), lineHeight: 16 }}>{active.caption}</Typography>
      </View>

      {/* 도메인 필터칩 — 상담·검사 포용 */}
      <View style={{ paddingTop: s(12) }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: s(16), gap: s(8) }}>
          {FILTERS.map((f) => {
            const on = filter === f.key;
            return (
              <TouchableOpacity key={f.key} activeOpacity={0.8} onPress={() => setFilter(f.key)} style={{ flexDirection: 'row', alignItems: 'center', gap: s(5), paddingHorizontal: s(13), paddingVertical: s(7), borderRadius: 999, backgroundColor: on ? DK.text : DK.card, borderWidth: 1, borderColor: on ? DK.text : DK.line }}>
                <Typography variant="label-01" weight="semibold" style={{ color: on ? DK.bg : DK.sub }}>{f.label}</Typography>
                <Typography variant="label-02" weight="semibold" style={{ color: on ? DK.bg : DK.sub, opacity: 0.7 }}>{counts[f.key]}</Typography>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View style={{ flex: 1, marginTop: s(12) }}>
        {tab === 'timeline' && <TimelineList notes={notes} />}
        {tab === 'lane' && <LaneList notes={notes} filter={filter} />}
        {tab === 'feed' && <FeedList notes={notes} />}
      </View>
    </SafeAreaView>
  );
}

// ════════════════ 1 · 타임라인 ════════════════

type TRow =
  | { kind: 'single'; n: Note }
  | { kind: 'cluster'; caseId: string; battery: string; client: string; time: string; notes: Note[] };

// 검사 task 노트는 같은 세션(caseId)끼리 묶음. 상담·미지정·검사 단건은 단일 행.
function buildTimelineItems(items: Note[]): TRow[] {
  const out: TRow[] = [];
  const idx = new Map<string, number>();
  for (const n of items) {
    if (domainOf(n) === 'assess' && n.caseId) {
      const at = idx.get(n.caseId);
      if (at == null) {
        idx.set(n.caseId, out.length);
        out.push({ kind: 'cluster', caseId: n.caseId, battery: n.battery ?? '검사', client: n.clients[0] ?? '내담자', time: n.time, notes: [n] });
      } else {
        (out[at] as Extract<TRow, { kind: 'cluster' }>).notes.push(n);
      }
    } else {
      out.push({ kind: 'single', n });
    }
  }
  // task 1건짜리 배터리는 단건으로 강등
  return out.map((r) => (r.kind === 'cluster' && r.notes.length === 1 ? { kind: 'single' as const, n: r.notes[0] } : r));
}

function clusterDot(notes: Note[]): string {
  if (notes.some((n) => n.pipeline === 'recording')) return DK.error;
  if (notes.some((n) => n.pipeline === 'analyzing')) return DK.accent;
  if (notes.some((n) => n.pipeline === 'failed')) return DK.warning;
  return DK.assess;
}

function subDot(n: Note): string {
  if (n.pipeline === 'recording') return DK.error;
  if (n.pipeline === 'analyzing') return DK.accent;
  if (n.pipeline === 'failed') return DK.warning;
  return DK.line;
}

function TimelineList({ notes }: { notes: Note[] }) {
  const groups = useMemo(() => groupByDate(notes), [notes]);
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: s(40), paddingHorizontal: s(20) }}>
      {groups.map((g) => {
        const rows = buildTimelineItems(g.items);
        return (
          <View key={g.key} style={{ marginTop: s(4) }}>
            <Typography variant="label-01" weight="semibold" style={{ color: DK.sub, marginBottom: s(10), marginTop: s(10), letterSpacing: 0.2 }}>{g.label}</Typography>
            {rows.map((row, i) => {
              const first = i === 0;
              const last = i === rows.length - 1;
              return row.kind === 'cluster'
                ? <ClusterNode key={row.caseId} row={row} first={first} last={last} />
                : <SingleNode key={row.n.id} n={row.n} first={first} last={last} />;
            })}
          </View>
        );
      })}
    </ScrollView>
  );
}

// 연속 레일 — 점 위/아래 라인으로 카드 사이를 끊김 없이 잇는다.
function Spine({ time, color, first, last }: { time: string; color: string; first: boolean; last: boolean }) {
  return (
    <>
      <View style={{ width: s(38), alignItems: 'flex-end', paddingTop: s(15) }}>
        <Typography variant="label-02" weight="semibold" style={{ color: DK.sub }}>{time}</Typography>
      </View>
      <View style={{ width: s(14), alignItems: 'center' }}>
        <View style={{ width: 2, height: s(15), backgroundColor: first ? 'transparent' : DK.line }} />
        <View style={{ width: s(11), height: s(11), borderRadius: s(11), backgroundColor: DK.bg, borderWidth: 2.5, borderColor: color }} />
        <View style={{ width: 2, flex: 1, backgroundColor: last ? 'transparent' : DK.line, marginTop: s(2) }} />
      </View>
    </>
  );
}

function DomainDot({ dom }: { dom: Domain }) {
  const c = dom === 'assess' ? DK.assess : dom === 'counsel' ? DK.accent : DK.warning;
  return <View style={{ width: s(6), height: s(6), borderRadius: s(6), backgroundColor: c }} />;
}

// 단일 노트 — 카드로 분리, 내부는 [정체성 / 오디오 / 요약] 3영역으로 정돈.
function SingleNode({ n, first, last }: { n: Note; first: boolean; last: boolean }) {
  const sc = stripColor(n);
  const sm = stateMeta(n);
  const dom = domainOf(n);
  return (
    <View style={{ flexDirection: 'row', gap: s(10) }}>
      <Spine time={n.time} color={sc === 'transparent' ? DK.line : sc} first={first} last={last} />
      <View style={{ flex: 1, paddingBottom: last ? s(2) : s(12) }}>
        <TouchableOpacity activeOpacity={0.85} style={{ backgroundColor: DK.card, borderRadius: s(16), padding: s(14), gap: s(10) }}>
          {/* ① 정체성 */}
          <View className="flex-row items-center" style={{ gap: s(7) }}>
            <DomainDot dom={dom} />
            <Typography variant="body-02" weight="semibold" style={{ color: dom === 'unassigned' ? DK.sub : DK.text, flex: 1 }} numberOfLines={1}>{identity(n)}</Typography>
            {sm && <SignalText sm={sm} live={n.pipeline === 'recording'} />}
          </View>
          {/* ② 오디오 메타 */}
          <View className="flex-row items-center" style={{ gap: s(8) }}>
            <Ionicons name="play" size={12} color={DK.sub} />
            <View style={{ width: s(56) }}>
              <Wave color={n.pipeline === 'recording' ? DK.error : DK.line} live={false} n={12} />
            </View>
            <Typography variant="label-02" style={{ color: DK.sub }}>{n.dur ?? n.rel}</Typography>
          </View>
          {/* ③ 요약 (구분선으로 분리) */}
          {n.summary && (
            <>
              <View style={{ height: 1, backgroundColor: DK.line }} />
              <Typography variant="label-02" style={{ color: DK.sub, lineHeight: 18 }} numberOfLines={2}>{n.summary}</Typography>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// 검사 세션 클러스터 — 한 풀배터리의 task 노트들을 한 카드 안에 묶음.
function ClusterNode({ row, first, last }: { row: Extract<TRow, { kind: 'cluster' }>; first: boolean; last: boolean }) {
  return (
    <View style={{ flexDirection: 'row', gap: s(10) }}>
      <Spine time={row.time} color={clusterDot(row.notes)} first={first} last={last} />
      <View style={{ flex: 1, paddingBottom: last ? s(2) : s(12) }}>
        <View style={{ backgroundColor: DK.card, borderRadius: s(16), padding: s(14), gap: s(10) }}>
          {/* 배터리 헤더 */}
          <View className="flex-row items-center" style={{ gap: s(7) }}>
            <View style={{ width: s(6), height: s(6), borderRadius: s(6), backgroundColor: DK.assess }} />
            <Typography variant="body-02" weight="semibold" style={{ color: DK.text, flex: 1 }} numberOfLines={1}>{row.client} · {row.battery}</Typography>
            <View style={{ backgroundColor: 'rgba(52,149,245,0.16)', borderRadius: 999, paddingHorizontal: s(8), paddingVertical: s(2) }}>
              <Typography variant="label-02" weight="semibold" style={{ color: DK.assess }}>검사 {row.notes.length}</Typography>
            </View>
          </View>
          <View style={{ height: 1, backgroundColor: DK.line }} />
          {/* task 노트 서브리스트 */}
          {row.notes.map((n, i) => {
            const sm = stateMeta(n);
            return (
              <TouchableOpacity key={n.id} activeOpacity={0.7} style={{ flexDirection: 'row', alignItems: 'center', gap: s(8), paddingTop: i === 0 ? 0 : s(9), marginTop: i === 0 ? 0 : 0, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: DK.line, paddingBottom: i === row.notes.length - 1 ? 0 : s(9) }}>
                {n.pipeline === 'summary'
                  ? <Ionicons name="checkmark-circle" size={14} color={DK.success} />
                  : <View style={{ width: s(7), height: s(7), borderRadius: s(7), backgroundColor: subDot(n) }} />}
                <Typography variant="label-01" weight="semibold" style={{ color: DK.text, flex: 1 }} numberOfLines={1}>{n.assessment}</Typography>
                <Typography variant="label-02" style={{ color: DK.sub }}>{n.dur ?? n.rel}</Typography>
                {sm && <SignalText sm={sm} live={n.pipeline === 'recording'} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

// ════════════════ 2 · 도메인 레인 ════════════════

function LaneList({ notes, filter }: { notes: Note[]; filter: DomFilter }) {
  const lanes: { key: Domain; title: string; color: string }[] = [
    { key: 'unassigned', title: '미지정 · 챙길 것', color: DK.warning },
    { key: 'counsel', title: '상담', color: DK.accent },
    { key: 'assess', title: '검사', color: DK.assess },
  ];
  const visible = filter === 'all' ? lanes : lanes.filter((l) => l.key === filter);
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: s(40), paddingHorizontal: s(20), gap: s(22) }}>
      {visible.map((lane) => {
        const items = notes.filter((n) => domainOf(n) === lane.key);
        if (items.length === 0) return null;
        return (
          <View key={lane.key} style={{ gap: s(10) }}>
            <View className="flex-row items-center" style={{ gap: s(8) }}>
              <View style={{ width: s(8), height: s(8), borderRadius: s(8), backgroundColor: lane.color }} />
              <Typography variant="label-01" weight="semibold" style={{ color: DK.text }}>{lane.title}</Typography>
              <Typography variant="label-02" weight="semibold" style={{ color: DK.sub }}>{items.length}</Typography>
            </View>
            <View style={{ gap: s(8) }}>
              {items.map((n) => {
                const sm = stateMeta(n);
                return (
                  <TouchableOpacity key={n.id} activeOpacity={0.85} style={{ backgroundColor: DK.card, borderRadius: s(14), padding: s(14), gap: s(8) }}>
                    <View className="flex-row items-center" style={{ gap: s(8) }}>
                      <Typography variant="body-02" weight="semibold" style={{ color: domainOf(n) === 'unassigned' ? DK.sub : DK.text, flex: 1 }} numberOfLines={1}>{identity(n)}</Typography>
                      <Typography variant="label-02" style={{ color: DK.sub }}>{n.rel}</Typography>
                      {sm && <SignalText sm={sm} live={n.pipeline === 'recording'} />}
                    </View>
                    <View className="flex-row items-center" style={{ gap: s(7) }}>
                      <Ionicons name="play" size={12} color={DK.sub} />
                      <View style={{ width: s(54) }}>
                        <Wave color={n.pipeline === 'recording' ? DK.error : DK.line} live={false} n={11} />
                      </View>
                      {n.dur && <Typography variant="label-02" style={{ color: DK.sub }}>{n.dur}</Typography>}
                    </View>
                    {n.summary && <Typography variant="label-02" style={{ color: DK.sub, lineHeight: 17 }} numberOfLines={1}>{n.summary}</Typography>}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

// ════════════════ 3 · 웨이브 피드 ════════════════

function FeedList({ notes }: { notes: Note[] }) {
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: s(40), paddingHorizontal: s(20), gap: s(14) }}>
      {notes.map((n) => {
        const rec = n.pipeline === 'recording';
        const sm = stateMeta(n);
        const dom = domainOf(n);
        return (
          <TouchableOpacity key={n.id} activeOpacity={0.9} style={{ backgroundColor: DK.card, borderRadius: s(20), overflow: 'hidden' }}>
            {/* 파형 히어로 */}
            <View style={{ paddingHorizontal: s(18), paddingTop: s(18), paddingBottom: s(14), backgroundColor: rec ? 'rgba(255,66,66,0.08)' : 'transparent' }}>
              <View className="flex-row items-center" style={{ justifyContent: 'space-between', marginBottom: s(14) }}>
                <View className="flex-row items-center" style={{ gap: s(6) }}>
                  {dom === 'assess' && <View style={{ width: s(6), height: s(6), borderRadius: s(6), backgroundColor: DK.assess }} />}
                  {dom === 'counsel' && <View style={{ width: s(6), height: s(6), borderRadius: s(6), backgroundColor: DK.accent }} />}
                  <Typography variant="body-01" weight="semibold" style={{ color: dom === 'unassigned' ? DK.sub : DK.text }} numberOfLines={1}>{identity(n)}</Typography>
                </View>
                {sm && <SignalChip sm={sm} live={rec} />}
              </View>
              <Wave color={rec ? DK.error : DK.accent} live={rec} n={44} tall />
              <View className="flex-row items-center" style={{ justifyContent: 'space-between', marginTop: s(12) }}>
                <Typography variant="label-02" style={{ color: DK.sub }}>{n.rel}{n.dur ? ` · ${n.dur}` : ''}</Typography>
                <Ionicons name="play-circle" size={26} color={rec ? DK.sub : DK.accent} />
              </View>
            </View>
            {n.summary && (
              <View style={{ paddingHorizontal: s(18), paddingVertical: s(14), borderTopWidth: 1, borderTopColor: DK.line }}>
                <Typography variant="label-02" style={{ color: DK.sub, lineHeight: 18 }} numberOfLines={2}>{n.summary}</Typography>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

// ──────────────── 공용 ────────────────

function groupByDate(notes: Note[]) {
  const map = new Map<string, { key: string; label: string; items: Note[] }>();
  notes.forEach((n) => {
    if (!map.has(n.dateKey)) map.set(n.dateKey, { key: n.dateKey, label: n.dateLabel, items: [] });
    map.get(n.dateKey)!.items.push(n);
  });
  return Array.from(map.values());
}

function SignalText({ sm, live }: { sm: { text: string; color: string }; live: boolean }) {
  return (
    <View className="flex-row items-center" style={{ gap: s(4) }}>
      {live && <PulseDot color={sm.color} size={s(6)} />}
      <Typography variant="label-02" weight="semibold" style={{ color: sm.color }}>{sm.text}</Typography>
    </View>
  );
}

function SignalChip({ sm, live }: { sm: { text: string; color: string }; live: boolean }) {
  return (
    <View className="flex-row items-center" style={{ gap: s(4), paddingHorizontal: s(9), paddingVertical: s(4), borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.06)' }}>
      {live && <PulseDot color={sm.color} size={s(6)} />}
      <Typography variant="label-02" weight="semibold" style={{ color: sm.color }}>{sm.text}</Typography>
    </View>
  );
}

const STATIC = [0.4, 0.7, 0.5, 0.95, 0.6, 1, 0.45, 0.8, 0.5, 0.7, 0.55, 0.85, 0.5, 0.75, 0.45, 0.9, 0.6, 0.7, 0.5, 0.8];

function Wave({ color, live, n = 20, tall }: { color: string; live: boolean; n?: number; tall?: boolean }) {
  const H = tall ? s(40) : s(14);
  const anims = useRef(Array.from({ length: n }, () => new Animated.Value(0.7))).current;
  useEffect(() => {
    if (!live) return;
    // 부드러운 swell — 느린 주기 + easing in/out + 낮은 진폭(눈 피로 ↓, 깜빡임 제거)
    const loops = anims.map((v, i) =>
      Animated.loop(Animated.sequence([
        Animated.delay((i % 6) * 110),
        Animated.timing(v, { toValue: 1, duration: 750, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(v, { toValue: 0.6, duration: 750, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      ])),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [live, anims]);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: tall ? s(3) : s(2), height: H, width: '100%' }}>
      {anims.map((v, i) => {
        const h = live ? v.interpolate({ inputRange: [0, 1], outputRange: [H * 0.55, H] }) : H * STATIC[i % STATIC.length];
        return <Animated.View key={i} style={{ flex: 1, height: h, borderRadius: s(2), backgroundColor: color }} />;
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
