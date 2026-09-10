import { useState, type ReactNode } from 'react';
import { View, ScrollView, Pressable, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/shared/constants/theme';
import { Typography } from '@/shared/components/ui/Typography';
import { s } from '@/shared/utils/scale';

/**
 * [필드노트] 상세 — "노트 재질" 비교 v2 (탭 시안).
 *
 * 문제: 실제 상세(CompletedScreen)는 "{날짜} 녹음" 제목 + 전사 + 하단 재생 독 = "녹음 재생기".
 *       목록 탭 이름은 "노트"인데 상세엔 노트 정체성이 0.
 *
 * 원칙(피드백 반영):
 *   1) 내용 구조(전체 대화 · 메모 · AI 분석 탭)는 현황처럼 그대로 유지 — 탭을 합치지 않는다.
 *   2) "노트 느낌"은 텍스트 재배치가 아니라 표면/재질(괘선·종이·제본·모눈·손글씨…)에서 만든다.
 *
 * 탭 = 노트 재질 N종. 첫 탭 [현황]은 실제 상세 재현(대조군).
 * 케이스 칩으로 상담/집단/검사/미연결 데이터 전환 → 한 재질이 다양한 케이스에서 버티는지.
 * mock 전용.
 */

const FND = COLORS.fieldnoteDark;
const PAGE = FND.bg; // #171717 — 다크 chrome(상단바·탭)
// 필드노트 메인 컬러 = 블루(실제 CompletedScreen 기준, 기존 보라 #9B5DFF 폐기).
const BLUE = '#3B82F6'; // 다크 면 위 accent·재생
const BLUE_INK = '#2566DD'; // 밝은 종이 위 accent (대비 확보, design blue-600)

// 화자 기본 색 (말풍선) — 재질과 무관하게 고정, 면은 알파로 surface 에 녹임
const SP_LEFT = '#10B981';
const SP_RIGHT = '#8B5CF6';

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const r = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

// ── 케이스 데이터 ─────────────────────────────────────
type Turn = { t: number; right: boolean; speaker: string; text: string; color?: string };
type Memo = { t: number; text: string };

interface NoteCase {
  key: string;
  caseLabel: string;
  domainLabel: string;
  dotColor: string;
  isAssessment: boolean;
  noteNumber: number;
  noteTitle: string;
  client: string | null;
  program: string | null;
  dateText: string;
  timeText: string;
  weekday: string;
  dayNum: string; // "06.25"
  duration: string;
  progress: number;
  linked: boolean;
  linkLabel: string;
  analyzed: boolean;
  summary?: string;
  keywords?: string[];
  keywordsLabel?: string;
  bullets?: { title: string; items: string[] };
  mood?: string;
  quotes?: { t: number; text: string }[];
  speakerCount: number;
  diarized: boolean;
  turns: Turn[];
  memos: Memo[];
}

const CASES: NoteCase[] = [
  {
    key: 'counseling',
    caseLabel: '상담 회기',
    domainLabel: '상담',
    dotColor: COLORS.counseling,
    isAssessment: false,
    noteNumber: 7,
    noteTitle: '놀이치료 6회기',
    client: '김민준',
    program: '놀이치료 · 개인',
    dateText: '6월 25일 (수)',
    timeText: '오후 2:00',
    weekday: '수요일',
    dayNum: '06.25',
    duration: '32분',
    progress: 0.34,
    linked: true,
    linkLabel: '회기 보기',
    analyzed: true,
    summary:
      '분리불안이 다시 올라온 한 주였어요. 등원 거부가 핵심 주제로 반복됐고, 또래 관계에서의 위축이 함께 관찰됐어요. 후반부에는 스스로 다음 주 계획을 말하며 톤이 한결 밝아졌어요.',
    keywords: ['분리불안', '등원 거부', '또래 관계', '계획 세우기'],
    keywordsLabel: '키워드',
    bullets: { title: '주요 이슈', items: ['등원 거부 재발 — 2주째 지속', '또래 관계에서의 위축'] },
    mood: '초반 위축 → 중반 불안 고조 → 후반 안정',
    speakerCount: 2,
    diarized: true,
    turns: [
      { t: 8, right: true, speaker: '상담사', text: '요즘 한 주는 어떻게 지냈어요?' },
      { t: 22, right: false, speaker: '내담자', text: '그게… 지난주에 학교에서 좀 힘든 일이 있었어요.' },
      { t: 72, right: false, speaker: '내담자', text: '친구들이랑 잘 안 맞는 것 같고… 가기 싫어요.' },
      { t: 120, right: true, speaker: '상담사', text: '그럴 때 어떤 기분이 들었어요?' },
      { t: 210, right: false, speaker: '내담자', text: '다음 주엔 한 번 먼저 말 걸어볼까 싶기도 하고요.' },
    ],
    memos: [{ t: 55, text: '등원 거부 다시 시작 — 분리불안 재발 가능성' }],
  },
  {
    key: 'group',
    caseLabel: '집단 상담',
    domainLabel: '상담',
    dotColor: COLORS.counseling,
    isAssessment: false,
    noteNumber: 9,
    noteTitle: '집단 미술치료 4회기',
    client: '박지후 외 2명',
    program: '미술치료 · 집단',
    dateText: '6월 23일 (월)',
    timeText: '오후 3:30',
    weekday: '월요일',
    dayNum: '06.23',
    duration: '52분',
    progress: 0.2,
    linked: true,
    linkLabel: '회기 보기',
    analyzed: true,
    summary:
      '세 아동 모두 협동 과제에 참여했어요. 박지후가 주도적으로 역할을 분담했고, 한 아동은 중반까지 관망하다 후반에 합류했어요.',
    keywords: ['협동 과제', '역할 분담', '관망 → 합류'],
    keywordsLabel: '키워드',
    bullets: { title: '주요 이슈', items: ['관망하던 아동의 지연된 참여', '주도-수동 아동 간 상호작용 편차'] },
    mood: '집단 에너지: 초반 산만 → 중반 몰입 → 후반 정리',
    speakerCount: 4,
    diarized: true,
    turns: [
      { t: 14, right: true, speaker: '상담사', text: '오늘은 셋이 같이 큰 그림 하나를 그려볼 거예요.' },
      { t: 130, right: false, speaker: '박지후', text: '내가 하늘 칠할게! 너는 나무 해.', color: '#10B981' },
      { t: 210, right: false, speaker: '수아', text: '(한참 보다가) 나는… 구름 할래요.', color: '#F59E0B' },
    ],
    memos: [{ t: 200, text: '관망 아동(수아) — 다음 회기 짝 활동 배치 고려' }],
  },
  {
    key: 'assessment',
    caseLabel: '검사 (HTP)',
    domainLabel: '검사',
    dotColor: COLORS.assessment,
    isAssessment: true,
    noteNumber: 12,
    noteTitle: 'HTP 투사검사',
    client: '이서연',
    program: '풀배터리 · HTP',
    dateText: '6월 24일 (화)',
    timeText: '오전 11:00',
    weekday: '화요일',
    dayNum: '06.24',
    duration: '18분',
    progress: 0.5,
    linked: true,
    linkLabel: '검사 보기',
    analyzed: true,
    summary:
      '집-나무-사람 그림 검사를 진행했어요. 나무 그림에서 오래 머뭇거렸고(약 40초 침묵), 사람 그림은 작게 그린 뒤 지우개를 반복해서 사용했어요.',
    keywords: ['머뭇거림', '작게 그림', '지우기 반복'],
    keywordsLabel: '관찰 키워드',
    bullets: { title: '관찰 지점', items: ['나무 그림에서 약 40초 침묵', '사람을 작게 그림 · 지우개 반복 사용'] },
    quotes: [{ t: 140, text: '이건… 죽은 나무예요.' }],
    speakerCount: 2,
    diarized: true,
    turns: [
      { t: 12, right: true, speaker: '검사자', text: '그림을 다 그리면 천천히 말로 설명해줄래요?' },
      { t: 140, right: false, speaker: '내담자', text: '이건… 죽은 나무예요.' },
      { t: 305, right: false, speaker: '내담자', text: '(작게 그린 뒤 지우개로 여러 번 지움)' },
    ],
    memos: [{ t: 300, text: '사람 그림 크기 위축 — 소견에 인용 검토' }],
  },
  {
    key: 'none',
    caseLabel: '미연결 · 미분석',
    domainLabel: '미지정',
    dotColor: COLORS.warning,
    isAssessment: false,
    noteNumber: 15,
    noteTitle: '제목 없는 기록',
    client: null,
    program: null,
    dateText: '오늘',
    timeText: '오후 4:12',
    weekday: '',
    dayNum: '06.26',
    duration: '8분',
    progress: 0,
    linked: false,
    linkLabel: '',
    analyzed: false,
    speakerCount: 0,
    diarized: false,
    turns: [
      { t: 5, right: false, speaker: '', text: '오늘 처음 오셨고, 등원 거부 얘기를 보호자분이 먼저 꺼내셨어요.' },
      { t: 64, right: false, speaker: '', text: '아이는 말수가 적었지만 블록 놀이엔 집중을 잘했어요.' },
    ],
    memos: [{ t: 30, text: '다음엔 보호자 동반 권유' }],
  },
];

// ── 재질 테마 ─────────────────────────────────────────
interface Theme {
  surface: string; // 노트 면 색
  text: string;
  sub: string;
  accent: string;
  line: string; // 구분선/괘선
  memoBg: string;
  light: boolean;
  texture: 'none' | 'ruled' | 'grid';
  textureColor: string;
}

// ── 텍스처 오버레이 ───────────────────────────────────
function RuledOverlay({ color }: { color: string }) {
  const gap = s(30);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: 70 }).map((_, i) => (
        <View key={i} style={{ position: 'absolute', left: 0, right: 0, top: s(48) + i * gap, height: StyleSheet.hairlineWidth, backgroundColor: color }} />
      ))}
    </View>
  );
}
function GridOverlay({ color }: { color: string }) {
  const gap = s(26);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: 80 }).map((_, i) => (
        <View key={`h${i}`} style={{ position: 'absolute', left: 0, right: 0, top: i * gap, height: StyleSheet.hairlineWidth, backgroundColor: color }} />
      ))}
      {Array.from({ length: 16 }).map((_, i) => (
        <View key={`v${i}`} style={{ position: 'absolute', top: 0, bottom: 0, left: i * gap, width: StyleSheet.hairlineWidth, backgroundColor: color }} />
      ))}
    </View>
  );
}

// ── 테마 적용 공용 조각 ───────────────────────────────
function Dot({ color, size = 6 }: { color: string; size?: number }) {
  return <View style={{ width: s(size), height: s(size), borderRadius: s(size / 2), backgroundColor: color }} />;
}

function AudioChip({ c, th }: { c: NoteCase; th: Theme }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(10), paddingVertical: s(9), paddingHorizontal: s(12), borderRadius: s(12), backgroundColor: th.light ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)' }}>
      <View style={{ width: s(28), height: s(28), borderRadius: s(14), backgroundColor: BLUE, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="play" size={s(14)} color="#fff" style={{ marginLeft: s(1) }} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ height: s(3), borderRadius: s(1.5), backgroundColor: th.light ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.12)' }}>
          <View style={{ height: s(3), borderRadius: s(1.5), width: `${Math.max(6, c.progress * 100)}%`, backgroundColor: BLUE }} />
        </View>
      </View>
      <Typography variant="label-01" style={{ color: th.sub, fontVariant: ['tabular-nums'] }}>녹음 {c.duration}</Typography>
    </View>
  );
}

function AnalyzeCTA({ th }: { th: Theme }) {
  return (
    <View style={{ borderRadius: s(14), borderWidth: 1, borderColor: th.accent + '55', borderStyle: 'dashed', paddingVertical: s(20), paddingHorizontal: s(16), alignItems: 'center', gap: s(10) }}>
      <Ionicons name="sparkles-outline" size={s(20)} color={th.accent} />
      <Typography variant="body-03" style={{ color: th.sub, textAlign: 'center', lineHeight: s(19) }}>
        아직 분석 전이에요.{'\n'}AI 분석으로 요약·키워드를 만들어 보세요.
      </Typography>
      <View style={{ marginTop: s(2), paddingHorizontal: s(16), paddingVertical: s(9), borderRadius: s(10), backgroundColor: th.accent }}>
        <Typography variant="label-01" weight="semibold" style={{ color: th.light ? '#fff' : '#1A1626' }}>AI 분석하기</Typography>
      </View>
    </View>
  );
}

function Transcript({ c, th }: { c: NoteCase; th: Theme }) {
  if (!c.diarized) {
    return (
      <View style={{ gap: s(14) }}>
        {c.turns.map((t, i) => (
          <View key={i}>
            <Typography variant="label-02" style={{ color: th.sub, fontVariant: ['tabular-nums'], marginBottom: s(3) }}>{fmt(t.t)}</Typography>
            <Typography variant="body-02" style={{ color: th.text, lineHeight: s(22) }}>{t.text}</Typography>
          </View>
        ))}
      </View>
    );
  }
  return (
    <View style={{ gap: s(12) }}>
      {c.turns.map((t, i) => {
        const color = t.color ?? (t.right ? SP_RIGHT : SP_LEFT);
        return (
          <View key={i} style={{ alignItems: t.right ? 'flex-end' : 'flex-start' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(5), marginBottom: s(3) }}>
              <Dot color={color} size={7} />
              <Typography variant="label-02" weight="semibold" style={{ color }}>{t.speaker}</Typography>
              <Typography variant="label-02" style={{ color: th.sub, fontVariant: ['tabular-nums'] }}>{fmt(t.t)}</Typography>
            </View>
            <View
              style={{
                maxWidth: '84%',
                paddingHorizontal: s(13),
                paddingVertical: s(9),
                borderRadius: s(16),
                borderTopLeftRadius: t.right ? s(16) : s(5),
                borderTopRightRadius: t.right ? s(5) : s(16),
                backgroundColor: color + (th.light ? '22' : '1A'),
              }}
            >
              <Typography variant="body-02" style={{ color: th.text, lineHeight: s(21) }}>{t.text}</Typography>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function Analysis({ c, th }: { c: NoteCase; th: Theme }) {
  if (!c.analyzed) return <AnalyzeCTA th={th} />;
  return (
    <View style={{ gap: s(20) }}>
      <Typography variant="body-01-reading" style={{ color: th.text, lineHeight: s(26) }}>{c.summary}</Typography>
      {c.keywords?.length ? (
        <View>
          <Typography variant="label-01" weight="semibold" style={{ color: th.accent, marginBottom: s(8) }}>{c.keywordsLabel}</Typography>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(8) }}>
            {c.keywords.map((k) => (
              <View key={k} style={{ paddingHorizontal: s(11), paddingVertical: s(6), borderRadius: 999, backgroundColor: th.accent + (th.light ? '1F' : '1A') }}>
                <Typography variant="label-01" style={{ color: th.light ? th.accent : th.text }}>{k}</Typography>
              </View>
            ))}
          </View>
        </View>
      ) : null}
      {c.bullets ? (
        <View>
          <Typography variant="label-01" weight="semibold" style={{ color: th.accent, marginBottom: s(8) }}>{c.bullets.title}</Typography>
          <View style={{ gap: s(8) }}>
            {c.bullets.items.map((b) => (
              <View key={b} style={{ flexDirection: 'row', gap: s(8) }}>
                <View style={{ width: s(5), height: s(5), borderRadius: s(2.5), backgroundColor: th.sub, marginTop: s(8) }} />
                <Typography variant="body-02" style={{ color: th.text, flex: 1, lineHeight: s(22) }}>{b}</Typography>
              </View>
            ))}
          </View>
        </View>
      ) : null}
      {c.mood ? (
        <View>
          <Typography variant="label-01" weight="semibold" style={{ color: th.accent, marginBottom: s(8) }}>정서 흐름</Typography>
          <Typography variant="body-02" style={{ color: th.text, lineHeight: s(22) }}>{c.mood}</Typography>
        </View>
      ) : null}
      {c.quotes?.length ? (
        <View>
          <Typography variant="label-01" weight="semibold" style={{ color: th.accent, marginBottom: s(8) }}>인용 후보</Typography>
          {c.quotes.map((q, i) => (
            <Typography key={i} variant="body-02-reading" style={{ color: th.text, lineHeight: s(23) }}>“{q.text}” <Typography variant="label-02" style={{ color: th.sub }}>{fmt(q.t)}</Typography></Typography>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function Memos({ c, th }: { c: NoteCase; th: Theme }) {
  if (!c.memos.length) return <Typography variant="body-02" style={{ color: th.sub, paddingVertical: s(8) }}>입력된 메모가 없어요.</Typography>;
  return (
    <View style={{ gap: s(10) }}>
      {c.memos.map((m, i) => (
        <View key={i} style={{ backgroundColor: th.memoBg, borderRadius: s(12), paddingHorizontal: s(14), paddingVertical: s(12), gap: s(6) }}>
          <Typography variant="label-02" style={{ color: th.sub, fontVariant: ['tabular-nums'] }}>{fmt(m.t)}</Typography>
          <Typography variant="body-02" style={{ color: th.text, lineHeight: s(20) }}>{m.text}</Typography>
        </View>
      ))}
    </View>
  );
}

// ── 공용 탭 본문 (전체 대화 · 메모 · AI 분석) — 모든 재질이 공유 ──
function TabbedBody({ c, th }: { c: NoteCase; th: Theme }) {
  const [tab, setTab] = useState<'all' | 'memo' | 'ai'>('all');
  const tabs: { k: 'all' | 'memo' | 'ai'; label: string }[] = [
    { k: 'all', label: '전체 대화' },
    { k: 'memo', label: '메모' },
    { k: 'ai', label: 'AI 분석' },
  ];
  return (
    <View>
      <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: th.line, marginBottom: s(16) }}>
        {tabs.map((t) => {
          const active = tab === t.k;
          return (
            <TouchableOpacity key={t.k} style={{ flex: 1, alignItems: 'center', paddingVertical: s(11) }} onPress={() => setTab(t.k)}>
              <Typography variant="body-03" weight={active ? 'bold' : 'medium'} style={{ color: active ? th.accent : th.sub }}>{t.label}</Typography>
              {active ? <View style={{ position: 'absolute', bottom: -1, height: 2, width: '64%', backgroundColor: th.accent }} /> : null}
            </TouchableOpacity>
          );
        })}
      </View>
      {tab === 'all' ? <Transcript c={c} th={th} /> : tab === 'memo' ? <Memos c={c} th={th} /> : <Analysis c={c} th={th} />}
    </View>
  );
}

// ── 노트 면(표면) 래퍼 ────────────────────────────────
function NoteSurface({ th, children, padTop = 18 }: { th: Theme; children: ReactNode; padTop?: number }) {
  return (
    <View style={{ borderRadius: s(18), backgroundColor: th.surface, overflow: 'hidden' }}>
      {th.texture === 'ruled' ? <RuledOverlay color={th.textureColor} /> : th.texture === 'grid' ? <GridOverlay color={th.textureColor} /> : null}
      <View style={{ paddingHorizontal: s(18), paddingTop: s(padTop), paddingBottom: s(20) }}>{children}</View>
    </View>
  );
}

// 기본 노트 헤더 (필드노트 N + 의미 제목 + 메타 + 연결 + 오디오)
function NoteHeader({ c, th }: { c: NoteCase; th: Theme }) {
  return (
    <View style={{ marginBottom: s(16), gap: s(14) }}>
      <View>
        <Typography variant="label-01" weight="semibold" style={{ color: th.accent, marginBottom: s(6) }}>필드노트 {c.noteNumber}</Typography>
        <Typography variant="headline-01" weight="bold" style={{ color: th.text }}>{c.noteTitle}</Typography>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(7), marginTop: s(8), flexWrap: 'wrap' }}>
          <Dot color={c.dotColor} size={7} />
          <Typography variant="body-03" style={{ color: th.sub }}>
            {c.domainLabel}{c.client ? ` · ${c.client}` : ''} · {c.dateText} {c.timeText}
          </Typography>
        </View>
        <LinkRow c={c} th={th} />
      </View>
      <AudioChip c={c} th={th} />
    </View>
  );
}

function LinkRow({ c, th }: { c: NoteCase; th: Theme }) {
  if (c.linked) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(5), marginTop: s(12) }}>
        <Ionicons name={c.isAssessment ? 'clipboard-outline' : 'calendar-outline'} size={s(14)} color={th.accent} />
        <Typography variant="label-01" weight="medium" style={{ color: th.accent }}>{c.linkLabel}</Typography>
        <Ionicons name="chevron-forward" size={s(12)} color={th.accent} />
      </View>
    );
  }
  return (
    <View style={{ alignSelf: 'flex-start', marginTop: s(12), flexDirection: 'row', alignItems: 'center', gap: s(6), paddingHorizontal: s(12), paddingVertical: s(7), borderRadius: 999, borderWidth: 1, borderColor: th.line }}>
      <Ionicons name="link-outline" size={s(13)} color={th.sub} />
      <Typography variant="label-01" weight="medium" style={{ color: th.sub }}>회기 연결하기</Typography>
    </View>
  );
}

// ════════════════════════════════════════════════════
// 0. 현황 (대조군) — 실제 CompletedScreen 재현
// ════════════════════════════════════════════════════
function ControlSkin({ c }: { c: NoteCase }) {
  const th: Theme = { surface: PAGE, text: FND.text, sub: FND.sub, accent: BLUE, line: FND.line, memoBg: '#181F2D', light: false, texture: 'none', textureColor: 'transparent' };
  return (
    <View>
      <View style={{ marginBottom: s(16) }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: s(12) }}>
          <Typography variant="headline-02" weight="bold" style={{ color: th.text, flexShrink: 1 }}>{c.dateText} {c.timeText} 녹음</Typography>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(4) }}>
            <Ionicons name="time-outline" size={s(13)} color={th.sub} />
            <Typography variant="label-01" style={{ color: th.sub }}>{c.duration}</Typography>
          </View>
        </View>
        <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: s(4), backgroundColor: FND.card, borderRadius: 999, paddingHorizontal: s(13), paddingVertical: s(8) }}>
          {c.linked ? (
            <>
              <Ionicons name={c.isAssessment ? 'clipboard-outline' : 'calendar-outline'} size={s(14)} color={th.sub} />
              <Typography variant="label-01" weight="semibold" style={{ color: th.sub }}>{c.linkLabel}</Typography>
              <Ionicons name="chevron-forward" size={s(13)} color={th.sub} />
            </>
          ) : (
            <Typography variant="label-01" weight="semibold" style={{ color: th.text }}>회기 연결하기</Typography>
          )}
        </View>
      </View>
      <TabbedBody c={c} th={th} />
      {/* 하단 재생 독 (mock) */}
      <View style={{ marginTop: s(24), borderTopWidth: 1, borderTopColor: th.line, paddingTop: s(16), backgroundColor: 'rgba(255,255,255,0.04)', marginHorizontal: -s(20), paddingHorizontal: s(20), paddingBottom: s(4) }}>
        <View style={{ height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', marginBottom: s(16) }}>
          <View style={{ height: 4, borderRadius: 2, width: `${Math.max(4, c.progress * 100)}%`, backgroundColor: BLUE }} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: s(28) }}>
          <Ionicons name="play-back-outline" size={s(26)} color={th.sub} />
          <View style={{ width: s(44), height: s(44), borderRadius: s(22), backgroundColor: BLUE, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="play" size={s(22)} color="#fff" style={{ marginLeft: s(2) }} />
          </View>
          <Ionicons name="play-forward-outline" size={s(26)} color={th.sub} />
        </View>
      </View>
    </View>
  );
}

// ════════════════════════════════════════════════════
// 1. 노트지 (다크) — 다크 면 + 가로 괘선 + 좌측 마진선
// ════════════════════════════════════════════════════
const TH_RULED: Theme = { surface: FND.card, text: FND.text, sub: FND.sub, accent: BLUE, line: 'rgba(255,255,255,0.12)', memoBg: 'rgba(255,255,255,0.05)', light: false, texture: 'ruled', textureColor: 'rgba(255,255,255,0.05)' };
function RuledSkin({ c }: { c: NoteCase }) {
  return (
    <View style={{ borderRadius: s(18), backgroundColor: TH_RULED.surface, overflow: 'hidden', flexDirection: 'row' }}>
      <RuledOverlay color={TH_RULED.textureColor} />
      {/* 좌측 마진선 */}
      <View style={{ width: s(2), backgroundColor: 'rgba(59,130,246,0.45)', marginLeft: s(14) }} />
      <View style={{ flex: 1, paddingLeft: s(14), paddingRight: s(18), paddingTop: s(18), paddingBottom: s(20) }}>
        <NoteHeader c={c} th={TH_RULED} />
        <TabbedBody c={c} th={TH_RULED} />
      </View>
    </View>
  );
}

// ════════════════════════════════════════════════════
// 2. 페이퍼 (아이보리) — 밝은 종이 노트 (다크 데스크 위에 놓인 종이)
// ════════════════════════════════════════════════════
const TH_PAPER: Theme = { surface: '#F4EFE3', text: '#2B2620', sub: '#8A8073', accent: BLUE_INK, line: 'rgba(0,0,0,0.10)', memoBg: 'rgba(0,0,0,0.04)', light: true, texture: 'ruled', textureColor: 'rgba(40,30,20,0.06)' };
function PaperSkin({ c }: { c: NoteCase }) {
  return (
    <NoteSurface th={TH_PAPER}>
      <NoteHeader c={c} th={TH_PAPER} />
      <TabbedBody c={c} th={TH_PAPER} />
    </NoteSurface>
  );
}

// ════════════════════════════════════════════════════
// 3. 모눈 (그리드지) — 엔지니어링/연구 노트 감
// ════════════════════════════════════════════════════
const TH_GRID: Theme = { surface: '#F2F5F7', text: '#1F2A33', sub: '#67767F', accent: BLUE_INK, line: 'rgba(20,60,90,0.12)', memoBg: 'rgba(20,60,90,0.05)', light: true, texture: 'grid', textureColor: 'rgba(30,90,140,0.10)' };
function GridSkin({ c }: { c: NoteCase }) {
  return (
    <NoteSurface th={TH_GRID}>
      <NoteHeader c={c} th={TH_GRID} />
      <TabbedBody c={c} th={TH_GRID} />
    </NoteSurface>
  );
}

// ════════════════════════════════════════════════════
// 4. 크라프트 — 따뜻한 갈색 종이(현장 수첩)
// ════════════════════════════════════════════════════
const TH_KRAFT: Theme = { surface: '#E4D5BC', text: '#3A2E1E', sub: '#897459', accent: BLUE_INK, line: 'rgba(80,50,20,0.14)', memoBg: 'rgba(120,80,40,0.08)', light: true, texture: 'none', textureColor: 'transparent' };
function KraftSkin({ c }: { c: NoteCase }) {
  return (
    <NoteSurface th={TH_KRAFT}>
      <NoteHeader c={c} th={TH_KRAFT} />
      <TabbedBody c={c} th={TH_KRAFT} />
    </NoteSurface>
  );
}

// ════════════════════════════════════════════════════
// 5. 제본 + 인덱스 탭 — 스프링 제본 헤더 + 측면 "노트" 탭
// ════════════════════════════════════════════════════
function BoundSkin({ c }: { c: NoteCase }) {
  const th = TH_RULED;
  return (
    <View>
      {/* 스프링 제본 */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: s(24), marginBottom: -s(6), zIndex: 2 }}>
        {Array.from({ length: 11 }).map((_, i) => (
          <View key={i} style={{ width: s(9), height: s(14), borderRadius: s(4), borderWidth: s(2), borderColor: 'rgba(255,255,255,0.22)', backgroundColor: PAGE }} />
        ))}
      </View>
      <View style={{ borderRadius: s(16), backgroundColor: th.surface, overflow: 'hidden', flexDirection: 'row' }}>
        <RuledOverlay color={th.textureColor} />
        {/* 측면 인덱스 탭 */}
        <View style={{ width: s(26), alignItems: 'center', paddingTop: s(28), backgroundColor: 'rgba(59,130,246,0.16)' }}>
          <View style={{ paddingVertical: s(10), paddingHorizontal: s(4), borderRadius: s(6), backgroundColor: th.accent, alignItems: 'center', gap: s(1) }}>
            <Typography variant="label-02" weight="bold" style={{ color: '#fff' }}>노</Typography>
            <Typography variant="label-02" weight="bold" style={{ color: '#fff' }}>트</Typography>
          </View>
        </View>
        <View style={{ flex: 1, paddingHorizontal: s(16), paddingTop: s(20), paddingBottom: s(20) }}>
          <NoteHeader c={c} th={th} />
          <TabbedBody c={c} th={th} />
        </View>
      </View>
    </View>
  );
}

// ════════════════════════════════════════════════════
// 6. 손글씨 — 다크 최소 변경 + 손글씨풍 날짜 스탬프 헤더
// ════════════════════════════════════════════════════
function HandwrittenSkin({ c }: { c: NoteCase }) {
  const th: Theme = { ...TH_RULED, texture: 'none', surface: FND.bg };
  return (
    <View>
      <View style={{ marginBottom: s(18) }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8) }}>
          <Ionicons name="pencil" size={s(16)} color={th.accent} />
          <Typography variant="headline-01" weight="bold" style={{ color: th.text, fontStyle: 'italic' }}>{c.dateText}{c.weekday ? ` · ${c.weekday[0]}` : ''}</Typography>
        </View>
        {/* 손그림 밑줄(살짝 기울인 accent 라인) */}
        <View style={{ height: s(2.5), width: s(120), backgroundColor: th.accent, borderRadius: s(2), marginTop: s(6), marginLeft: s(24), transform: [{ rotate: '-0.6deg' }] }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(7), marginTop: s(14), flexWrap: 'wrap' }}>
          <Dot color={c.dotColor} size={7} />
          <Typography variant="body-02" weight="medium" style={{ color: th.text }}>{c.noteTitle}</Typography>
          <Typography variant="body-03" style={{ color: th.sub }}>· {c.client ?? '회기 미지정'} · {c.duration}</Typography>
        </View>
        <View style={{ marginTop: s(14) }}><AudioChip c={c} th={th} /></View>
      </View>
      <TabbedBody c={c} th={th} />
    </View>
  );
}

// ════════════════════════════════════════════════════
// 7. 다이어리 — 밝은 종이 + 큰 날짜 + 리본 accent
// ════════════════════════════════════════════════════
const TH_DIARY: Theme = { surface: '#FBF7F0', text: '#2B2620', sub: '#8A8073', accent: BLUE_INK, line: 'rgba(0,0,0,0.10)', memoBg: 'rgba(0,0,0,0.04)', light: true, texture: 'ruled', textureColor: 'rgba(40,30,20,0.05)' };
function DiarySkin({ c }: { c: NoteCase }) {
  return (
    <NoteSurface th={TH_DIARY} padTop={0}>
      {/* 리본 + 큰 날짜 */}
      <View style={{ flexDirection: 'row', marginHorizontal: -s(18), marginBottom: s(18) }}>
        <View style={{ width: s(6), backgroundColor: TH_DIARY.accent }} />
        <View style={{ flex: 1, paddingTop: s(18), paddingLeft: s(14) }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: s(8) }}>
            <Typography variant="headline-01" weight="bold" style={{ color: TH_DIARY.text, fontSize: s(34), lineHeight: s(38) }}>{c.dayNum}</Typography>
            <Typography variant="body-01" weight="medium" style={{ color: TH_DIARY.sub, marginBottom: s(6) }}>{c.weekday || '오늘'} · {c.timeText}</Typography>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(7), marginTop: s(8), flexWrap: 'wrap' }}>
            <Dot color={c.dotColor} size={7} />
            <Typography variant="body-02" weight="medium" style={{ color: TH_DIARY.text }}>{c.noteTitle}</Typography>
            <Typography variant="body-03" style={{ color: TH_DIARY.sub }}>· {c.client ?? '회기 미지정'}</Typography>
          </View>
        </View>
      </View>
      <View style={{ marginBottom: s(16) }}><AudioChip c={c} th={TH_DIARY} /></View>
      <TabbedBody c={c} th={TH_DIARY} />
    </NoteSurface>
  );
}

// ── 재질 탭 정의 ──────────────────────────────────────
type SkinKey = 'control' | 'ruled' | 'paper' | 'grid' | 'kraft' | 'bound' | 'hand' | 'diary';
const SKINS: { key: SkinKey; label: string; render: (c: NoteCase) => ReactNode }[] = [
  { key: 'control', label: '현황', render: (c) => <ControlSkin c={c} /> },
  { key: 'ruled', label: '노트지', render: (c) => <RuledSkin c={c} /> },
  { key: 'paper', label: '페이퍼', render: (c) => <PaperSkin c={c} /> },
  { key: 'grid', label: '모눈', render: (c) => <GridSkin c={c} /> },
  { key: 'kraft', label: '크라프트', render: (c) => <KraftSkin c={c} /> },
  { key: 'bound', label: '제본', render: (c) => <BoundSkin c={c} /> },
  { key: 'hand', label: '손글씨', render: (c) => <HandwrittenSkin c={c} /> },
  { key: 'diary', label: '다이어리', render: (c) => <DiarySkin c={c} /> },
];

const VERDICTS: Record<SkinKey, string[]> = {
  control: ['"{날짜} 녹음" 제목 + 전사 + 하단 재생 독 = "녹음 재생기". 탭 구조는 그대로지만 노트 정체성 0(대조군).'],
  ruled: [
    '다크 정체성 유지 + 가로 괘선·좌측 마진선으로 "공책" 질감. 탭 구조 그대로.',
    '위험 가장 낮음(다크 스킨 안 벗어남). 다만 괘선이 약하면 "그냥 다크 카드"로 보일 수 있어 강도 조절 필요.',
  ],
  paper: [
    '다크 데스크 위에 놓인 "아이보리 종이" — 표면을 바꿔 가장 직접적으로 노트로 읽힘.',
    '앱 chrome(상단바·탭)은 다크 유지, 노트 본체만 종이라 정체성 충돌 적음. 다크 일관성 이탈은 트레이드오프.',
  ],
  grid: [
    '모눈(그리드)지 — 연구/관찰 기록 느낌. 검사(HTP) 케이스와 특히 잘 맞음.',
    '밝은 면이라 가독성 좋음. 그리드가 빽빽하면 전사 가독성 방해 — 농도 낮게.',
  ],
  kraft: [
    '따뜻한 크라프트(갈색) 종이 — "현장 수첩" 무드. 친근·아날로그.',
    '채도가 있어 카테고리 dot·상태색과 부딪힐 수 있음. 색 충돌 점검 필요.',
  ],
  bound: [
    '스프링 제본 + 측면 "노트" 인덱스 탭 — 물성(제본된 노트)으로 정체성. 목록 탭명 "노트"와 직접 연결.',
    '제본/측면 탭이 가로 폭을 먹고 장식성이 큼 — 매일 보는 화면엔 과할 수 있음.',
  ],
  hand: [
    '다크 거의 그대로 + 손글씨풍 날짜 스탬프·밑줄. 변경 최소, 친근함만 가미.',
    '진짜 손글씨 폰트 없이 italic 근사라 효과 제한적 — 제대로 하려면 폰트 에셋 필요.',
  ],
  diary: [
    '밝은 종이 + 큰 날짜 + 리본 — "다이어리/일기" 무드. 날짜 중심이라 회기 회상에 강함.',
    '큰 날짜가 상단을 먹어 제목/내용이 밀림. 정보형보다 감성형.',
  ],
};

export default function FieldNoteDetailV2Lab() {
  const router = useRouter();
  const [skin, setSkin] = useState<SkinKey>('ruled');
  const [caseIdx, setCaseIdx] = useState(0);
  const c = CASES[caseIdx];
  const current = SKINS.find((x) => x.key === skin)!;

  return (
    <View style={{ flex: 1, backgroundColor: PAGE }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* 다크 chrome 상단바 */}
        <View style={{ height: s(52), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: s(8) }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity onPress={() => router.back()} hitSlop={10} style={{ width: s(40), height: s(40), alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="chevron-back" size={24} color={FND.text} />
            </TouchableOpacity>
            <Typography variant="headline-02" weight="bold" style={{ color: FND.text, marginLeft: s(2) }}>상세 노트 느낌 v2</Typography>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8), paddingRight: s(8) }}>
            <Ionicons name="copy-outline" size={s(20)} color={FND.sub} />
            <Ionicons name="share-outline" size={s(21)} color={FND.sub} />
            <Ionicons name="trash-outline" size={s(20)} color={FND.sub} />
          </View>
        </View>

        {/* 재질 탭 */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: s(8), paddingHorizontal: s(20), paddingTop: s(8), paddingBottom: s(8) }}>
          {SKINS.map((sk) => {
            const active = skin === sk.key;
            return (
              <Pressable key={sk.key} onPress={() => setSkin(sk.key)} style={{ paddingHorizontal: s(14), paddingVertical: s(8), borderRadius: 999, backgroundColor: active ? BLUE : 'rgba(255,255,255,0.06)' }}>
                <Typography variant="label-01" weight="medium" style={{ color: active ? '#fff' : FND.sub }}>{sk.label}</Typography>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* 케이스 칩 */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: s(6), paddingHorizontal: s(20), paddingBottom: s(10) }}>
          {CASES.map((cc, i) => {
            const active = caseIdx === i;
            return (
              <Pressable key={cc.key} onPress={() => setCaseIdx(i)} style={{ flexDirection: 'row', alignItems: 'center', gap: s(5), paddingVertical: s(7), paddingHorizontal: s(12), borderRadius: s(8), backgroundColor: active ? 'rgba(255,255,255,0.08)' : 'transparent', borderWidth: 1, borderColor: active ? 'rgba(255,255,255,0.14)' : 'transparent' }}>
                <Dot color={cc.dotColor} size={6} />
                <Typography variant="label-02" weight={active ? 'semibold' : 'regular'} style={{ color: active ? FND.text : FND.sub }}>{cc.caseLabel}</Typography>
              </Pressable>
            );
          })}
        </ScrollView>

        <ScrollView contentContainerStyle={{ paddingHorizontal: s(20), paddingTop: s(8), paddingBottom: s(80) }} showsVerticalScrollIndicator={false}>
          <View key={`${skin}-${caseIdx}`}>{current.render(c)}</View>

          {/* 평가 노트 */}
          <View style={{ height: 1, backgroundColor: FND.line, marginTop: s(28), marginBottom: s(16) }} />
          <View style={{ gap: s(8) }}>
            {VERDICTS[skin].map((line, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: s(8) }}>
                <Typography variant="body-03" style={{ color: FND.sub }}>·</Typography>
                <Typography variant="body-03" style={{ color: FND.sub, flex: 1, lineHeight: s(20) }}>{line}</Typography>
              </View>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
