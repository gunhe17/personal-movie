import { useMemo, useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  Pressable,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, LAYOUT } from '@/shared/constants/theme';
import { Typography } from '@/shared/components/ui/Typography';
import { Icon } from '@/shared/components/icons';
import { s } from '@/shared/utils/scale';

/**
 * [필드노트] 리스트 필터 IA 비교 — 탭 시안.
 *
 * 질문: 현재 필터(전체 / AI 정리됨 / 정리중 / 녹음만 / 실패)는 전부
 * "시스템 파이프라인 상태" 축이다. 상담사에게 실제로 의미 있는 축인가?
 *
 *   [현재]   파이프라인 상태 5칩 (대조군)
 *   A 미니멀  칩 제거 → 날짜 그룹 + 내담자 검색만
 *   B 할 일   [전체][처리 필요(=미연결+실패)] + 검색. 상태는 카드 배지로
 *   C 연결축  필터 축을 '연결 상태'로 교체 [전체][미연결]. 상태는 카드 배지로
 *
 * mock 데이터만 사용(실 API/feature import 없음). 색은 COLORS.fieldnoteDark 토큰 사용.
 */

const DK = {
  bg: COLORS.fieldnoteDark.bg,
  card: COLORS.fieldnoteDark.card,
  line: COLORS.fieldnoteDark.line,
  text: COLORS.fieldnoteDark.text,
  sub: COLORS.fieldnoteDark.sub,
  accent: COLORS.fieldnoteDark.accent,
  warning: COLORS.warning,
  error: COLORS.error,
} as const;

type FnState = 'summary' | 'processing' | 'unanalyzed' | 'failed';

interface MockNote {
  id: string;
  dateKey: string;
  dateLabel: string;
  time: string;
  title: string;
  /** 검색 대상(내담자명). 미연결이면 빈 문자열. */
  client: string;
  preview: string;
  duration: string;
  linked: boolean;
  state: FnState;
  /** 검사(task) 연결 노트 여부 — 검사명 표기·도메인 필터용 (D·E 탭 전용). */
  isTask?: boolean;
  /** 검사명 (isTask 일 때) — 예: HTP, SCT, 로르샤흐. */
  assessment?: string;
}

// 3개 날짜 그룹 · 상태/연결 조합을 골고루 덮는 mock 9건.
const NOTES: MockNote[] = [
  {
    id: 'n1', dateKey: 'd0', dateLabel: '오늘 · 6월 1일 (일)', time: '14:32',
    title: '김민준', client: '김민준',
    preview: '분리불안이 다시 올라온 한 주. 등원 거부가 핵심 주제였고…',
    duration: '32분', linked: true, state: 'summary',
  },
  {
    id: 'n2', dateKey: 'd0', dateLabel: '오늘 · 6월 1일 (일)', time: '11:05',
    title: '이서연 외 1명', client: '이서연',
    preview: 'AI가 회기를 분석하고 있어요',
    duration: '28분', linked: true, state: 'processing',
  },
  {
    id: 'n3', dateKey: 'd0', dateLabel: '오늘 · 6월 1일 (일)', time: '10:18',
    title: '미연결 필드노트', client: '',
    preview: '아직 회기에 연결되지 않았어요',
    duration: '5분', linked: false, state: 'unanalyzed',
  },
  {
    id: 'n4', dateKey: 'd0', dateLabel: '오늘 · 6월 1일 (일)', time: '09:40',
    title: '박도윤', client: '박도윤',
    preview: '분석에 실패했어요. 다시 시도해 주세요',
    duration: '41분', linked: true, state: 'failed',
  },
  {
    id: 'n5', dateKey: 'd1', dateLabel: '어제 · 5월 31일 (토)', time: '16:20',
    title: '정하린', client: '정하린',
    preview: '놀이 중 또래 갈등 상황을 스스로 언어화하기 시작…',
    duration: '36분', linked: true, state: 'summary',
  },
  {
    id: 'n6', dateKey: 'd1', dateLabel: '어제 · 5월 31일 (토)', time: '13:02',
    title: '미연결 필드노트', client: '',
    preview: '녹음 직후 메모만 남긴 회기. 어느 케이스였는지 연결 필요',
    duration: '12분', linked: false, state: 'summary',
  },
  {
    id: 'n7', dateKey: 'd1', dateLabel: '어제 · 5월 31일 (토)', time: '10:30',
    title: '최우진', client: '최우진',
    preview: '녹음만 저장됨 (분석 안 함)',
    duration: '8분', linked: true, state: 'unanalyzed',
  },
  {
    id: 'n8', dateKey: 'd2', dateLabel: '5월 29일 (목)', time: '15:10',
    title: '김민준', client: '김민준',
    preview: '지난 회기. 또래 관계에서의 위축이 반복 관찰됨…',
    duration: '30분', linked: true, state: 'summary',
  },
  {
    id: 'n9', dateKey: 'd2', dateLabel: '5월 29일 (목)', time: '09:15',
    title: '미연결 필드노트', client: '',
    preview: '분석에 실패했고 연결도 안 됨',
    duration: '4분', linked: false, state: 'failed',
  },
  // ── 검사(task) 연결 노트 — 도메인 필터·리프레시 탭(D·E) 전용 ──
  // 필드노트는 상담 회기뿐 아니라 검사 항목(HTP·SCT 등 투사검사)에도 붙는다.
  // 이 노트들이 있어야 "회기 미지정" 라벨이 왜 상담 특화인지 드러난다.
  {
    id: 't1', dateKey: 'd0', dateLabel: '오늘 · 6월 1일 (일)', time: '13:10',
    title: '김지호', client: '김지호',
    preview: 'HTP — 나무 그림에서 또래 관계 주제가 반복 언급됨',
    duration: '22분', linked: true, state: 'summary', isTask: true, assessment: 'HTP',
  },
  {
    id: 't2', dateKey: 'd1', dateLabel: '어제 · 5월 31일 (토)', time: '11:48',
    title: '이서연', client: '이서연',
    preview: 'AI가 검사 반응을 정리하고 있어요',
    duration: '18분', linked: true, state: 'processing', isTask: true, assessment: 'SCT',
  },
  {
    id: 't3', dateKey: 'd2', dateLabel: '5월 29일 (목)', time: '14:25',
    title: '박민', client: '박민',
    preview: '녹음만 저장됨 (검사 소견 미작성)',
    duration: '15분', linked: true, state: 'unanalyzed', isTask: true, assessment: '로르샤흐',
  },
];

type Variant = 'current' | 'minimal' | 'tasks' | 'linkstate' | 'domain' | 'refined';

const VARIANTS: { key: Variant; label: string }[] = [
  { key: 'current', label: '현재' },
  { key: 'minimal', label: 'A 미니멀' },
  { key: 'tasks', label: 'B 할 일' },
  { key: 'linkstate', label: 'C 연결축' },
  { key: 'domain', label: 'D 도메인' },
  { key: 'refined', label: 'E 리프레시 ✨' },
];

const RATIONALE: Record<Variant, string> = {
  current:
    '필터 축 = 시스템 파이프라인 상태. "정리중"은 자동 해소되고 "AI 정리됨"은 대다수라 변별력이 낮음. 정작 가장 행동이 필요한 "미연결"은 필터에 없음.',
  minimal:
    '칩 제거 → 날짜 그룹 + 내담자 검색만. "지난주 김민준 녹음 찾기" 같은 대부분의 retrieval은 검색이 이김. 단, 할 일(미연결·실패)을 한 번에 모으긴 어려움.',
  tasks:
    '행동 필요한 것만 한 칩으로: 처리 필요 = 미연결 + 실패. 정보 스펙 §4 "지금 뭐 해야 하지" 철학과 정합. 파이프라인 상태는 필터가 아니라 카드 배지로.',
  linkstate:
    '필터 축을 "연결 상태"로 교체 (전체 / 미연결). 실패·정리중·AI요약은 카드 배지로만 표현 → 필터는 단순해지고 상태는 시각적으로 항상 보임. (현재 프로덕션 = "회기 미지정")',
  domain:
    '"회기 미지정"이 상담 특화라는 문제 → 필터 축을 도메인으로: 전체 / 상담 / 검사 / 미지정. 필드노트가 검사(task)에도 붙으므로 검사를 1급으로 끌어올리고, 미연결은 도메인 중립어 "미지정"으로. 카드는 현재 그대로 둬서 필터 축 변화만 비교. (서버 갭: 상담/검사 분리는 link_type 파라미터 또는 클라 필터 필요 — 미지정은 기존 linked=false)',
  refined:
    '도메인 필터 + 디자인 리프레시 종합(권장). 보라 솔리드 칩 → 연한 톤 칩(정체성은 텍스트 색으로만), 카드는 카테고리 dot 색 리듬(상담 그린·검사 블루)·좌측 상태 strip·연한 단일 신호·검사명 뱃지. 진부함·"결 안 맞음"을 면·색·위계로 해소. 미연결 식별자도 "미지정"으로 중립화.',
};

// ─── 도메인 판정 (D·E 탭) — 상담(schedule) / 검사(task) / 미지정 ───
type Domain = 'counseling' | 'assessment' | 'unlinked';
function domainOf(n: MockNote): Domain {
  if (!n.linked) return 'unlinked';
  return n.isTask ? 'assessment' : 'counseling';
}
function domainCounts() {
  return {
    counseling: NOTES.filter((n) => domainOf(n) === 'counseling').length,
    assessment: NOTES.filter((n) => domainOf(n) === 'assessment').length,
    unlinked: NOTES.filter((n) => domainOf(n) === 'unlinked').length,
  };
}

// ─── 상태 배지 설정 ───
function stateBadge(state: FnState): { label: string; color: string; icon: keyof typeof Ionicons.glyphMap } | null {
  switch (state) {
    case 'summary':
      return { label: 'AI 요약', color: DK.accent, icon: 'sparkles' };
    case 'processing':
      return { label: '정리중', color: DK.sub, icon: 'sync' };
    case 'unanalyzed':
      return { label: '분석 필요', color: DK.accent, icon: 'sparkles-outline' };
    case 'failed':
      return { label: '실패', color: DK.error, icon: 'alert-circle' };
    default:
      return null;
  }
}

// ─── 카드 ───
function NoteCard({ note, showState, showCategory = false }: { note: MockNote; showState: boolean; showCategory?: boolean }) {
  const badge = stateBadge(note.state);
  return (
    <View
      style={{
        backgroundColor: DK.card,
        borderRadius: s(16),
        paddingHorizontal: s(16),
        paddingVertical: s(14),
        marginBottom: s(10),
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="label-01" style={{ color: DK.sub }}>
          {note.time} · {note.duration}
        </Typography>
        {showState && badge ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(4) }}>
            <Ionicons name={badge.icon} size={s(12)} color={badge.color} />
            <Typography variant="label-02" weight="medium" style={{ color: badge.color }}>
              {badge.label}
            </Typography>
          </View>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: s(6), gap: s(6) }}>
        {/* 카테고리 표식 (showCategory) — 검사=블루 dot+검사명, 상담=그린 dot */}
        {showCategory && note.isTask ? (
          <>
            <View style={{ width: s(6), height: s(6), borderRadius: s(3), backgroundColor: COLORS.assessment }} />
            {note.assessment ? (
              <View style={{ paddingHorizontal: s(6), paddingVertical: s(1), borderRadius: s(4), backgroundColor: COLORS.assessment + '24' }}>
                <Typography variant="label-02" weight="medium" style={{ color: COLORS.assessment }}>{note.assessment}</Typography>
              </View>
            ) : null}
          </>
        ) : showCategory && note.linked ? (
          <View style={{ width: s(6), height: s(6), borderRadius: s(3), backgroundColor: COLORS.counseling }} />
        ) : null}
        <Typography
          variant="body-01"
          weight="semibold"
          numberOfLines={1}
          style={{ color: DK.text, flexShrink: 1 }}
        >
          {note.title}
        </Typography>
        {/* 미연결은 항상 노출 — 연결 상태가 요약 배지에 가려지지 않게 (제안) */}
        {!note.linked ? (
          <View
            style={{
              paddingHorizontal: s(6),
              paddingVertical: s(1),
              borderRadius: s(4),
              backgroundColor: DK.warning + '22',
            }}
          >
            <Typography variant="label-02" weight="medium" style={{ color: DK.warning }}>
              미연결
            </Typography>
          </View>
        ) : null}
        <View style={{ flex: 1 }} />
        <Ionicons name="play-circle" size={s(24)} color={DK.accent} />
      </View>

      <Typography
        variant="body-03"
        numberOfLines={1}
        style={{ color: DK.sub, marginTop: s(4) }}
      >
        {note.preview}
      </Typography>
    </View>
  );
}

// ─── 리프레시 카드 (E 탭) — 연한 신호 칩 ───
function SoftSignal({ label, color, icon }: { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(4), paddingHorizontal: s(8), paddingVertical: s(3), borderRadius: s(999), backgroundColor: color + '1A' }}>
      <Ionicons name={icon} size={s(11)} color={color} />
      <Typography variant="label-02" weight="medium" style={{ color }}>{label}</Typography>
    </View>
  );
}

/** 카테고리 메타 — 상담 그린 / 검사 블루 dot + 검사명. 미연결은 null. */
function categoryMeta(n: MockNote): { color: string; label: string | null } | null {
  if (n.isTask) return { color: COLORS.assessment, label: n.assessment ?? null };
  if (n.linked) return { color: COLORS.counseling, label: null };
  return null;
}

function RefinedCard({ note }: { note: MockNote }) {
  const cat = categoryMeta(note);
  const muted = !note.linked;
  // 좌측 strip — "지금 나에게 뭐냐": 처리중=보라 / 미지정·실패=주황 / 그 외 무색
  const strip =
    note.state === 'processing'
      ? DK.accent
      : !note.linked || note.state === 'failed'
        ? DK.warning
        : 'transparent';
  // 우측 단일 신호 — 연결(미지정)이 1순위, 그다음 실패, 그다음 상태 배지
  const badge = stateBadge(note.state);
  const signal = !note.linked
    ? { label: '연결', color: DK.warning, icon: 'link' as const }
    : note.state === 'failed'
      ? { label: '다시 분석', color: DK.error, icon: 'refresh' as const }
      : badge;

  return (
    <View style={{ flexDirection: 'row', backgroundColor: DK.card, borderRadius: s(16), overflow: 'hidden', marginBottom: s(10) }}>
      <View style={{ width: s(3), backgroundColor: strip }} />
      <View style={{ flex: 1, paddingHorizontal: s(16), paddingVertical: s(14) }}>
        {/* Row 1: 카테고리 + 정체성 + 단일 신호 */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6) }}>
          {cat ? <View style={{ width: s(6), height: s(6), borderRadius: s(3), backgroundColor: cat.color }} /> : null}
          {cat?.label ? (
            <View style={{ paddingHorizontal: s(6), paddingVertical: s(1), borderRadius: s(4), backgroundColor: cat.color + '24' }}>
              <Typography variant="label-02" weight="medium" style={{ color: cat.color }}>{cat.label}</Typography>
            </View>
          ) : null}
          <Typography
            variant="body-01"
            weight="semibold"
            numberOfLines={1}
            style={{ color: muted ? DK.sub : DK.text, flexShrink: 1 }}
          >
            {muted ? '미지정' : note.title}
          </Typography>
          <View style={{ flex: 1 }} />
          {signal ? <SoftSignal label={signal.label} color={signal.color} icon={signal.icon} /> : null}
        </View>
        {/* Row 2: 시간 · 길이 */}
        <Typography variant="label-01" style={{ color: DK.sub, marginTop: s(5) }}>
          {note.time} · {note.duration}
        </Typography>
        {/* Row 3: 미리보기 — 상태 문구가 아닌 실제 내용일 때만 */}
        {note.preview && note.state !== 'processing' && note.state !== 'failed' ? (
          <Typography variant="body-03" numberOfLines={2} style={{ color: DK.sub, marginTop: s(6) }}>
            {note.preview}
          </Typography>
        ) : null}
      </View>
    </View>
  );
}

function DateHeader({ label, count }: { label: string; count: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8), marginTop: s(8), marginBottom: s(10) }}>
      <Typography variant="label-01" weight="semibold" style={{ color: DK.sub }}>
        {label}
      </Typography>
      <Typography variant="label-02" style={{ color: DK.sub, opacity: 0.7 }}>
        {count}
      </Typography>
    </View>
  );
}

// ─── 다크 검색바 ───
function SearchBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: s(8),
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderRadius: s(12),
        paddingHorizontal: s(12),
        height: s(42),
        marginBottom: s(14),
      }}
    >
      <Ionicons name="search" size={s(16)} color={DK.sub} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="내담자 이름으로 검색"
        placeholderTextColor={DK.sub}
        style={{ flex: 1, color: DK.text, fontSize: 15, padding: 0 }}
      />
      {value ? (
        <TouchableOpacity onPress={() => onChange('')} hitSlop={8}>
          <Ionicons name="close-circle" size={s(16)} color={DK.sub} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// ─── 다크 필터 칩 ───
function Chips<T extends string>({
  value,
  options,
  onChange,
  tone = 'solid',
}: {
  value: T;
  options: { value: T; label: string; count?: number }[];
  onChange: (v: T) => void;
  /** solid = 현재(보라 풀블록) · soft = 연한 톤(텍스트만 accent, 풀블록 제거). */
  tone?: 'solid' | 'soft';
}) {
  return (
    <View style={{ flexDirection: 'row', gap: s(8), marginBottom: s(14), flexWrap: 'wrap' }}>
      {options.map((opt) => {
        const active = value === opt.value;
        const activeBg = tone === 'soft' ? DK.accent + '24' : DK.accent;
        const activeFg = tone === 'soft' ? DK.accent : '#1A1626';
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={{
              paddingHorizontal: s(14),
              paddingVertical: s(8),
              borderRadius: s(999),
              backgroundColor: active ? activeBg : 'rgba(255,255,255,0.06)',
            }}
          >
            <Typography
              variant="label-01"
              weight={active ? 'semibold' : 'medium'}
              style={{ color: active ? activeFg : DK.sub }}
            >
              {opt.label}
              {opt.count != null ? ` ${opt.count}` : ''}
            </Typography>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── 리스트 렌더 (날짜 그룹) ───
function GroupedList({
  notes,
  showState,
  showCategory = false,
  refined = false,
}: {
  notes: MockNote[];
  showState: boolean;
  showCategory?: boolean;
  refined?: boolean;
}) {
  const groups = useMemo(() => {
    const map = new Map<string, { label: string; items: MockNote[] }>();
    for (const n of notes) {
      if (!map.has(n.dateKey)) map.set(n.dateKey, { label: n.dateLabel, items: [] });
      map.get(n.dateKey)!.items.push(n);
    }
    return [...map.values()];
  }, [notes]);

  if (notes.length === 0) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: s(48) }}>
        <Ionicons name="documents-outline" size={s(40)} color={DK.sub} />
        <Typography variant="body-02" style={{ color: DK.sub, marginTop: s(12) }}>
          해당하는 필드노트가 없어요
        </Typography>
      </View>
    );
  }

  return (
    <>
      {groups.map((g) => (
        <View key={g.label}>
          <DateHeader label={g.label} count={g.items.length} />
          {g.items.map((n) =>
            refined ? (
              <RefinedCard key={n.id} note={n} />
            ) : (
              <NoteCard key={n.id} note={n} showState={showState} showCategory={showCategory} />
            ),
          )}
        </View>
      ))}
    </>
  );
}

// ─── 시안별 본문 ───
function CurrentView() {
  type F = 'all' | 'summary' | 'processing' | 'unanalyzed' | 'failed';
  const [filter, setFilter] = useState<F>('all');
  const notes = NOTES.filter((n) => filter === 'all' || n.state === filter);
  return (
    <>
      <Chips<F>
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: '전체' },
          { value: 'summary', label: 'AI 정리됨' },
          { value: 'processing', label: '정리중' },
          { value: 'unanalyzed', label: '녹음만' },
          { value: 'failed', label: '실패' },
        ]}
      />
      <GroupedList notes={notes} showState />
    </>
  );
}

function MinimalView() {
  const [q, setQ] = useState('');
  const notes = NOTES.filter((n) => !q || n.client.includes(q));
  return (
    <>
      <SearchBar value={q} onChange={setQ} />
      <GroupedList notes={notes} showState />
    </>
  );
}

function TasksView() {
  type F = 'all' | 'todo';
  const [filter, setFilter] = useState<F>('all');
  const [q, setQ] = useState('');
  const isTodo = (n: MockNote) => !n.linked || n.state === 'failed';
  const todoCount = NOTES.filter(isTodo).length;
  const notes = NOTES.filter((n) => (filter === 'all' || isTodo(n)) && (!q || n.client.includes(q)));
  return (
    <>
      <SearchBar value={q} onChange={setQ} />
      <Chips<F>
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: '전체' },
          { value: 'todo', label: '처리 필요', count: todoCount },
        ]}
      />
      <GroupedList notes={notes} showState />
    </>
  );
}

function LinkStateView() {
  type F = 'all' | 'unlinked';
  const [filter, setFilter] = useState<F>('all');
  const unlinkedCount = NOTES.filter((n) => !n.linked).length;
  const notes = NOTES.filter((n) => filter === 'all' || !n.linked);
  return (
    <>
      <Chips<F>
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: '전체' },
          { value: 'unlinked', label: '미연결', count: unlinkedCount },
        ]}
      />
      <GroupedList notes={notes} showState />
    </>
  );
}

// D 도메인축 — 필터만 도메인으로 교체(카드는 현재 그대로). 검사를 1급으로, "미연결"→"미지정".
function DomainView() {
  type F = 'all' | Domain;
  const [filter, setFilter] = useState<F>('all');
  const [q, setQ] = useState('');
  const c = domainCounts();
  const notes = NOTES.filter(
    (n) => (filter === 'all' || domainOf(n) === filter) && (!q || n.client.includes(q)),
  );
  return (
    <>
      <SearchBar value={q} onChange={setQ} />
      <Chips<F>
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: '전체' },
          { value: 'counseling', label: '상담', count: c.counseling },
          { value: 'assessment', label: '검사', count: c.assessment },
          { value: 'unlinked', label: '미지정', count: c.unlinked },
        ]}
      />
      <GroupedList notes={notes} showState showCategory />
    </>
  );
}

// E 리프레시 — 도메인 필터 + 연한 칩 + 리프레시 카드(카테고리 dot·strip·연한 신호).
function RefinedView() {
  type F = 'all' | Domain;
  const [filter, setFilter] = useState<F>('all');
  const [q, setQ] = useState('');
  const c = domainCounts();
  const notes = NOTES.filter(
    (n) => (filter === 'all' || domainOf(n) === filter) && (!q || n.client.includes(q)),
  );
  return (
    <>
      <SearchBar value={q} onChange={setQ} />
      <Chips<F>
        value={filter}
        onChange={setFilter}
        tone="soft"
        options={[
          { value: 'all', label: '전체' },
          { value: 'counseling', label: '상담', count: c.counseling },
          { value: 'assessment', label: '검사', count: c.assessment },
          { value: 'unlinked', label: '미지정', count: c.unlinked },
        ]}
      />
      <GroupedList notes={notes} showState refined />
    </>
  );
}

export default function FieldNoteFiltersLab() {
  const router = useRouter();
  const [variant, setVariant] = useState<Variant>('current');

  return (
    <View style={{ flex: 1, backgroundColor: DK.bg }}>
      {/* 헤더 + 시안 탭 (표준 라이트 lab 크롬) */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: COLORS.white }}>
        <View
          style={{
            height: s(48),
            paddingHorizontal: s(LAYOUT.screenPaddingX),
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <TouchableOpacity onPress={() => router.back()} hitSlop={8} accessibilityRole="button" accessibilityLabel="뒤로 가기">
            <Icon name="arrow-left" size={24} color={COLORS.gray[900]} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Typography variant="title-01" weight="semibold" className="text-gray-900">
              필드노트 필터 비교
            </Typography>
          </View>
          <View style={{ width: 24 }} />
        </View>

        <View style={{ paddingHorizontal: s(LAYOUT.screenPaddingX), paddingBottom: s(12) }}>
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: COLORS.gray[50],
              borderRadius: s(10),
              padding: s(3),
              gap: s(2),
            }}
          >
            {VARIANTS.map((v) => {
              const active = variant === v.key;
              return (
                <Pressable
                  key={v.key}
                  onPress={() => setVariant(v.key)}
                  style={({ pressed }) => ({
                    flex: 1,
                    paddingVertical: s(8),
                    borderRadius: s(8),
                    backgroundColor: active ? COLORS.white : 'transparent',
                    alignItems: 'center',
                    opacity: pressed ? 0.85 : 1,
                  })}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Typography
                    variant="label-01"
                    weight={active ? 'semibold' : 'medium'}
                    style={{ color: active ? COLORS.text.title.default : COLORS.gray[500] }}
                  >
                    {v.label}
                  </Typography>
                </Pressable>
              );
            })}
          </View>
        </View>
      </SafeAreaView>

      {/* 다크 프리뷰 — 실제 필드노트 리스트 톤 */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: s(LAYOUT.screenPaddingX),
          paddingTop: s(16),
          paddingBottom: s(40),
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* 시안 의도 설명 */}
        <View
          style={{
            flexDirection: 'row',
            gap: s(8),
            backgroundColor: 'rgba(185,139,255,0.1)',
            borderRadius: s(12),
            padding: s(12),
            marginBottom: s(16),
          }}
        >
          <Ionicons name="bulb-outline" size={s(16)} color={DK.accent} style={{ marginTop: s(1) }} />
          <Typography variant="body-03" style={{ color: DK.text, flex: 1, lineHeight: 20 }}>
            {RATIONALE[variant]}
          </Typography>
        </View>

        {variant === 'current' ? <CurrentView /> : null}
        {variant === 'minimal' ? <MinimalView /> : null}
        {variant === 'tasks' ? <TasksView /> : null}
        {variant === 'linkstate' ? <LinkStateView /> : null}
        {variant === 'domain' ? <DomainView /> : null}
        {variant === 'refined' ? <RefinedView /> : null}
      </ScrollView>
    </View>
  );
}
