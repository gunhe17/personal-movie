import { useState } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/shared/constants/theme';
import { Typography } from '@/shared/components/ui/Typography';
import { s } from '@/shared/utils/scale';

/**
 * [필드노트] 상세 노트 느낌 — 과감한 구조 재해석 비교(탭 시안).
 *
 * "글자로 필드노트라 외치기"가 아니라, 상세 구조 자체를 노트답게 재해석.
 * 모두 현재 데이터(타임스탬프 전사·메모·AI 하이라이트·오디오 seek)로 구현 가능한 범위.
 *
 * 탭:
 *  [현행]      평평한 다크 — 날짜 녹음 헤더 + 플레인 전사(대조군).
 *  [A 스파인]  세로 시간축 한 줄기에 발화·메모·AI를 시각순으로 꽂고 playhead 가 흐름.
 *  [B 주석]    전사는 본문, 메모·AI 관찰은 그 순간에 정렬된 여백 주석(마크업 문서).
 *  [C 웨이브폼] 상단 파형+메모/AI 핀, 탭=seek, 아래 전사 가라오케 동기.
 *  [D 카드덱]  요약·키워드·이슈·정서·전사를 옆으로 넘기는 인덱스 카드.
 *
 * mock 전용, COLORS.fieldnoteDark 토큰.
 */

const { width: SCREEN_W } = Dimensions.get('window');

const DK = {
  bg: COLORS.fieldnoteDark.bg,
  card: COLORS.fieldnoteDark.card,
  line: COLORS.fieldnoteDark.line,
  text: COLORS.fieldnoteDark.text,
  sub: COLORS.fieldnoteDark.sub,
  accent: COLORS.fieldnoteDark.accent,
} as const;

const BLUE = '#3B82F6';
const SP_C = DK.accent; // 상담사
const SP_K = '#10B981'; // 내담자

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const r = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

const META = { client: '김민준', context: '놀이치료 - 개인', date: '6월 25일 (수)', time: '14:00', dur: '32분' };

type Ev =
  | { t: number; kind: 'turn'; speaker: string; color: string; text: string }
  | { t: number; kind: 'memo'; text: string }
  | { t: number; kind: 'ai'; text: string };

const TIMELINE: Ev[] = [
  { t: 8, kind: 'turn', speaker: '상담사', color: SP_C, text: '요즘 한 주는 어떻게 지냈어요?' },
  { t: 22, kind: 'turn', speaker: '내담자', color: SP_K, text: '그게… 지난주에 학교에서 좀 힘든 일이 있었어요.' },
  { t: 40, kind: 'turn', speaker: '상담사', color: SP_C, text: '어떤 일이었는지 천천히 말해줄 수 있을까요?' },
  { t: 55, kind: 'memo', text: '등원 거부 다시 시작 — 분리불안 재발 가능성' },
  { t: 72, kind: 'turn', speaker: '내담자', color: SP_K, text: '친구들이랑 잘 안 맞는 것 같고… 가기 싫어요.' },
  { t: 95, kind: 'ai', text: '분리불안 신호 — 등원 거부가 반복 언급됨' },
  { t: 120, kind: 'turn', speaker: '상담사', color: SP_C, text: '그럴 때 어떤 기분이 들었어요?' },
];
const CURRENT_T = 72;
const TURNS = TIMELINE.filter((e): e is Extract<Ev, { kind: 'turn' }> => e.kind === 'turn');

const WAVE = [
  0.2, 0.5, 0.8, 0.4, 0.3, 0.6, 0.9, 0.7, 0.4, 0.2, 0.5, 0.85, 0.6, 0.3, 0.45, 0.7, 0.95, 0.5,
  0.3, 0.25, 0.55, 0.8, 0.6, 0.35, 0.4, 0.7, 0.5, 0.3, 0.6, 0.9, 0.55, 0.3, 0.45, 0.65, 0.4, 0.25,
];
const PROGRESS = 0.34;
const PINS: { pos: number; kind: 'memo' | 'ai' }[] = [
  { pos: 0.18, kind: 'memo' },
  { pos: 0.46, kind: 'ai' },
  { pos: 0.74, kind: 'memo' },
];

const CARDS = [
  { title: '요약', body: '분리불안이 다시 올라온 한 주. 등원 거부가 핵심 주제였고, 후반부에 스스로 다음 주 계획을 말함.' },
  { title: '키워드', chips: ['분리불안', '등원 거부', '또래 관계', '계획 세우기'] },
  { title: '주요 이슈', bullets: ['등원 거부 재발', '또래 관계에서의 위축'] },
  { title: '정서 흐름', body: '초반 위축 → 중반 불안 고조 → 후반 안정. 다음 주 계획을 말할 때 톤이 밝아짐.' },
  { title: '전사', body: '상담사: 요즘 한 주는 어떻게 지냈어요?\n내담자: 학교에서 힘든 일이 있었어요…' },
];

// ── 공통 헤더 (맥락 타이틀) ─────────────────────────────
function Header() {
  return (
    <View style={{ marginBottom: s(18) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8) }}>
        <View style={{ width: s(5), height: s(5), borderRadius: s(1.5), backgroundColor: DK.accent }} />
        <Typography variant="title-01" weight="bold" style={{ color: DK.text, flex: 1 }}>
          {META.client} · {META.context}
        </Typography>
      </View>
      <Typography variant="label-01" style={{ color: DK.sub, marginTop: s(4), marginLeft: s(13) }}>
        {META.date} {META.time} · {META.dur}
      </Typography>
    </View>
  );
}

// ── 현행(대조군) ──────────────────────────────────────
function CurrentView() {
  return (
    <View>
      <View style={{ marginBottom: s(16) }}>
        <Typography variant="headline-02" weight="bold" style={{ color: DK.text }}>
          {META.date} {META.time} 녹음
        </Typography>
      </View>
      {TURNS.map((t, i) => (
        <View key={i} style={{ marginBottom: s(14) }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6), marginBottom: s(3) }}>
            <View style={{ width: s(6), height: s(6), borderRadius: s(3), backgroundColor: t.color }} />
            <Typography variant="label-02" weight="medium" style={{ color: DK.sub }}>{t.speaker}</Typography>
          </View>
          <Typography variant="body-02" style={{ color: DK.text, lineHeight: s(22) }}>{t.text}</Typography>
        </View>
      ))}
    </View>
  );
}

// ── A. 타임 스파인 ────────────────────────────────────
function SpineNode({ ev, current }: { ev: Ev; current: boolean }) {
  let inner;
  if (ev.kind === 'turn') {
    inner = <View style={{ width: s(9), height: s(9), borderRadius: s(4.5), backgroundColor: ev.color }} />;
  } else if (ev.kind === 'memo') {
    inner = <View style={{ width: s(8), height: s(8), backgroundColor: DK.accent, transform: [{ rotate: '45deg' }] }} />;
  } else {
    inner = <Ionicons name="star" size={s(12)} color={DK.accent} />;
  }
  return (
    <View style={{ backgroundColor: DK.bg, paddingVertical: s(3) }}>
      <View
        style={
          current
            ? { borderWidth: s(3), borderColor: 'rgba(155,93,255,0.22)', borderRadius: 999, padding: s(2), alignItems: 'center', justifyContent: 'center' }
            : { alignItems: 'center', justifyContent: 'center' }
        }
      >
        {inner}
      </View>
    </View>
  );
}

function SpineRow({ ev }: { ev: Ev }) {
  const current = ev.t === CURRENT_T;
  return (
    <View style={{ flexDirection: 'row' }}>
      <View style={{ width: s(46), alignItems: 'flex-end', paddingRight: s(8), paddingTop: s(5) }}>
        <Typography variant="label-02" style={{ color: current ? DK.accent : DK.sub, fontVariant: ['tabular-nums'] }}>
          {fmt(ev.t)}
        </Typography>
      </View>
      <View style={{ width: s(22), alignItems: 'center' }}>
        <View style={{ position: 'absolute', top: 0, bottom: 0, width: StyleSheet.hairlineWidth, backgroundColor: DK.line }} />
        <SpineNode ev={ev} current={current} />
      </View>
      <View
        style={{
          flex: 1,
          paddingLeft: s(10),
          paddingBottom: s(18),
          paddingTop: current ? s(6) : 0,
        }}
      >
        <View style={current ? { backgroundColor: 'rgba(155,93,255,0.08)', borderRadius: s(10), padding: s(10), marginTop: -s(6) } : undefined}>
          {ev.kind === 'turn' ? (
            <>
              <Typography variant="label-02" weight="medium" style={{ color: ev.color, marginBottom: s(2) }}>{ev.speaker}</Typography>
              <Typography variant="body-02" style={{ color: DK.text, lineHeight: s(22) }}>{ev.text}</Typography>
            </>
          ) : ev.kind === 'memo' ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(5), marginBottom: s(2) }}>
                <Ionicons name="bookmark" size={s(11)} color={DK.accent} />
                <Typography variant="label-02" weight="medium" style={{ color: DK.accent }}>메모</Typography>
              </View>
              <Typography variant="body-03" style={{ color: DK.sub, lineHeight: s(19) }}>{ev.text}</Typography>
            </>
          ) : (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(5), marginBottom: s(2) }}>
                <Ionicons name="sparkles" size={s(11)} color={DK.accent} />
                <Typography variant="label-02" weight="medium" style={{ color: DK.accent }}>AI 하이라이트</Typography>
              </View>
              <Typography variant="body-03" style={{ color: DK.sub, lineHeight: s(19) }}>{ev.text}</Typography>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

function SpineView() {
  return (
    <View>
      <Header />
      <View style={{ marginTop: s(2) }}>
        {TIMELINE.map((ev, i) => <SpineRow key={i} ev={ev} />)}
      </View>
    </View>
  );
}

// ── B. 주석 매니스크립트 ──────────────────────────────
function ManuscriptView() {
  return (
    <View>
      <Header />
      {TURNS.map((turn, i) => {
        const next = TURNS[i + 1];
        const ann = TIMELINE.filter(
          (e) => (e.kind === 'memo' || e.kind === 'ai') && e.t >= turn.t && (!next || e.t < next.t),
        );
        return (
          <View key={i} style={{ flexDirection: 'row', marginBottom: s(16) }}>
            <View style={{ flex: 1, paddingRight: s(12) }}>
              <Typography variant="label-02" weight="medium" style={{ color: turn.color, marginBottom: s(2) }}>{turn.speaker}</Typography>
              <Typography variant="body-02" style={{ color: DK.text, lineHeight: s(22) }}>{turn.text}</Typography>
            </View>
            <View style={{ width: s(116), borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: DK.line, paddingLeft: s(10), gap: s(8) }}>
              {ann.map((a, j) => (
                <View key={j}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(4), marginBottom: s(1) }}>
                    <Ionicons name={a.kind === 'memo' ? 'bookmark' : 'sparkles'} size={s(10)} color={DK.accent} />
                    <Typography variant="label-02" weight="medium" style={{ color: DK.accent }}>{a.kind === 'memo' ? '메모' : 'AI'}</Typography>
                  </View>
                  <Typography variant="caption-01" style={{ color: DK.sub, lineHeight: s(15) }}>{a.text}</Typography>
                </View>
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ── C. 어노테이티드 웨이브폼 ──────────────────────────
function WaveformView() {
  return (
    <View>
      <Header />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: s(6) }}>
        <Typography variant="label-02" style={{ color: DK.sub, fontVariant: ['tabular-nums'] }}>00:00</Typography>
        <Typography variant="label-02" style={{ color: DK.sub, fontVariant: ['tabular-nums'] }}>32:10</Typography>
      </View>
      <View style={{ height: s(66), justifyContent: 'flex-end' }}>
        {PINS.map((p, i) => (
          <View key={i} style={{ position: 'absolute', top: 0, left: `${p.pos * 100}%`, alignItems: 'center' }}>
            <Ionicons name={p.kind === 'memo' ? 'bookmark' : 'sparkles'} size={s(11)} color={DK.accent} />
            <View style={{ width: StyleSheet.hairlineWidth, height: s(38), backgroundColor: 'rgba(155,93,255,0.35)' }} />
          </View>
        ))}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: s(2), height: s(46) }}>
          {WAVE.map((h, i) => {
            const played = i / WAVE.length <= PROGRESS;
            return (
              <View
                key={i}
                style={{ flex: 1, height: Math.max(s(3), h * s(46)), borderRadius: s(1), backgroundColor: played ? BLUE : 'rgba(255,255,255,0.14)' }}
              />
            );
          })}
        </View>
        <View style={{ position: 'absolute', bottom: 0, top: s(22), left: `${PROGRESS * 100}%`, width: s(1.5), backgroundColor: DK.text }} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: s(28), marginTop: s(16) }}>
        <Ionicons name="play-back" size={s(22)} color={DK.sub} />
        <View style={{ width: s(52), height: s(52), borderRadius: s(26), backgroundColor: BLUE, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="play" size={s(24)} color="#fff" style={{ marginLeft: s(2) }} />
        </View>
        <Ionicons name="play-forward" size={s(22)} color={DK.sub} />
      </View>
      <View style={{ marginTop: s(22) }}>
        {TURNS.map((t, i) => {
          const active = t.t === CURRENT_T;
          return (
            <View key={i} style={{ padding: s(10), borderRadius: s(10), backgroundColor: active ? 'rgba(59,130,246,0.12)' : 'transparent', marginBottom: s(2) }}>
              <Typography variant="label-02" weight="medium" style={{ color: active ? BLUE : DK.sub, marginBottom: s(2) }}>{t.speaker}</Typography>
              <Typography variant="body-02" style={{ color: active ? DK.text : DK.sub, lineHeight: s(22) }}>{t.text}</Typography>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ── D. 인덱스 카드 덱 ─────────────────────────────────
function CardDeckView() {
  const [page, setPage] = useState(0);
  const CARD_W = SCREEN_W - s(40) - s(36);
  const GAP = s(12);
  return (
    <View>
      <Header />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_W + GAP}
        decelerationRate="fast"
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / (CARD_W + GAP)))}
      >
        {CARDS.map((c, i) => (
          <View
            key={i}
            style={{ width: CARD_W, marginRight: GAP, minHeight: s(220), borderRadius: s(16), backgroundColor: DK.card, padding: s(18), borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.06)' }}
          >
            <Typography variant="label-01" weight="semibold" style={{ color: DK.accent, marginBottom: s(12) }}>{c.title}</Typography>
            {c.body ? (
              <Typography variant="body-02" style={{ color: DK.text, lineHeight: s(24) }}>{c.body}</Typography>
            ) : null}
            {c.chips ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(8) }}>
                {c.chips.map((ch) => (
                  <View key={ch} style={{ paddingHorizontal: s(10), paddingVertical: s(6), borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.06)' }}>
                    <Typography variant="label-01" style={{ color: DK.text }}>{ch}</Typography>
                  </View>
                ))}
              </View>
            ) : null}
            {c.bullets ? (
              <View style={{ gap: s(8) }}>
                {c.bullets.map((b) => (
                  <View key={b} style={{ flexDirection: 'row', gap: s(8) }}>
                    <View style={{ width: s(5), height: s(5), borderRadius: s(2.5), backgroundColor: DK.accent, marginTop: s(7) }} />
                    <Typography variant="body-02" style={{ color: DK.text, flex: 1, lineHeight: s(22) }}>{b}</Typography>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ))}
      </ScrollView>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: s(6), marginTop: s(16) }}>
        {CARDS.map((_, i) => (
          <View key={i} style={{ width: s(6), height: s(6), borderRadius: s(3), backgroundColor: i === page ? DK.accent : 'rgba(255,255,255,0.18)' }} />
        ))}
      </View>
    </View>
  );
}

type TabKey = 'current' | 'spine' | 'manuscript' | 'wave' | 'deck';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'current', label: '현행' },
  { key: 'spine', label: 'A 스파인' },
  { key: 'manuscript', label: 'B 주석' },
  { key: 'wave', label: 'C 웨이브폼' },
  { key: 'deck', label: 'D 카드덱' },
];

const VERDICTS: Record<TabKey, string[]> = {
  current: ['평평한 다크 + "…녹음" — 노트 정체성 0(대조군).'],
  spine: [
    '시간축 한 줄기에 발화·메모·AI를 시각순으로 — "회기를 다시 걷는" 재해석.',
    'playhead 노드(보라 링)가 현재 지점. 노드 탭 = 그 시점 seek(구현 가능).',
    '메모·AI가 대화 흐름 속 제자리에 박혀 맥락이 살아남.',
  ],
  manuscript: [
    '전사=본문, 메모·AI=여백 주석. 마크업된 문서라 가장 "노트"다움.',
    '여백이 좁은 기기에선 주석 폭 압박 — 길면 1~2줄 클램프 필요.',
  ],
  wave: [
    '녹음 아티팩트로 프레이밍 — 파형 위 메모/AI 핀, 탭=seek.',
    '전사는 playhead 라인 가라오케 동기(파랑 강조).',
    '파형이 상단을 크게 먹어 — 접히는 미니 모드 필요할 수.',
  ],
  deck: [
    '요약·키워드·이슈·정서·전사를 넘기는 인덱스 카드 — 촉각적.',
    '전사처럼 긴 내용은 카드에 안 맞음(스캔 불리) — 전사는 별도 탭이 나을 수.',
  ],
};

export default function FieldNoteDetailHeaderLab() {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>('spine');

  return (
    <View style={{ flex: 1, backgroundColor: DK.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={{ height: s(52), flexDirection: 'row', alignItems: 'center', paddingHorizontal: s(12) }}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={10} style={{ width: s(40), height: s(40), alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="chevron-back" size={24} color={DK.text} />
          </TouchableOpacity>
          <Typography variant="headline-02" weight="bold" style={{ color: DK.text, marginLeft: s(2) }}>상세 노트 느낌</Typography>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0 }}
          contentContainerStyle={{ gap: s(8), paddingHorizontal: s(20), paddingTop: s(8), paddingBottom: s(6) }}
        >
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <Pressable
                key={t.key}
                onPress={() => setTab(t.key)}
                style={{ paddingHorizontal: s(14), paddingVertical: s(8), borderRadius: 999, backgroundColor: active ? DK.accent : 'rgba(255,255,255,0.06)' }}
              >
                <Typography variant="label-01" weight="medium" style={{ color: active ? '#1A1626' : DK.sub }}>{t.label}</Typography>
              </Pressable>
            );
          })}
        </ScrollView>

        <ScrollView contentContainerStyle={{ paddingHorizontal: s(20), paddingTop: s(16), paddingBottom: s(60) }} showsVerticalScrollIndicator={false}>
          {tab === 'current' ? <CurrentView />
            : tab === 'spine' ? <SpineView />
            : tab === 'manuscript' ? <ManuscriptView />
            : tab === 'wave' ? <WaveformView />
            : <CardDeckView />}

          <View style={{ height: 1, backgroundColor: DK.line, marginTop: s(28), marginBottom: s(16) }} />
          <View style={{ gap: s(8) }}>
            {VERDICTS[tab].map((line, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: s(8) }}>
                <Typography variant="body-03" style={{ color: DK.sub }}>·</Typography>
                <Typography variant="body-03" style={{ color: DK.sub, flex: 1, lineHeight: s(20) }}>{line}</Typography>
              </View>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
