import { useState } from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, LAYOUT } from '@/shared/constants/theme';
import { Typography } from '@/shared/components/ui/Typography';
import { Icon } from '@/shared/components/icons';
import { s } from '@/shared/utils/scale';

/**
 * [검사 필드노트] 분석 뷰 비교 lab.
 *
 * 스펙 §3-4-3: 검사 분석은 상담과 다르다 — verbatim이 임상 데이터라 전사 싱크가 1순위,
 * AI는 해석 말고 정리만(반응·관찰·인용), 산출은 검사 소견 초안.
 * 서버는 이미 task_id 노트에 검사 렌즈 분석(responses/observations/quotes)을 생성한다.
 *
 * 이 lab은 그 데이터를 "어떻게 보여줄지" 비교:
 * 탭 — [상담 렌즈(현재)] 대조군: mood/issues 해석이 끼어 검사엔 어색·위험
 *      [검사·구조 우선] 반응/관찰/인용 카드 먼저, 전사 아래
 *      [검사·전사 우선] 전사 싱크 전면(화자 버블+탭 재생), 구조는 되짚기 점프 — 권장
 *
 * 필드노트 다크 스킨(COLORS.fieldnoteDark). 다크 위 텍스트 색은 style={{color}}로(gotcha).
 * 모두 mock. 확정 시 AIAnalysisView(검사 노트 분기)에 반영.
 */

type TabKey = 'counseling' | 'struct' | 'transcript';

const TABS: { key: TabKey; label: string; caption: string }[] = [
  {
    key: 'counseling',
    label: '상담 렌즈(현재)',
    caption: '검사에 상담 분석을 그대로 쓰면? 정서·이슈 "해석"이 끼어 검사자 판단을 오염시킴(대조군·위험).',
  },
  {
    key: 'struct',
    label: '검사·구조 우선',
    caption: '반응↔질문·관찰·인용 카드를 먼저. 정리본을 빠르게 스캔, 전사는 아래에서 확인.',
  },
  {
    key: 'transcript',
    label: '검사·전사 우선',
    caption: '전사 싱크를 전면에 — verbatim 화자 버블 + 탭→그 지점 재생. 구조는 "되짚기" 점프. — 권장',
  },
];

// ──────────────── MOCK (HTP 나무 그림 단계) ────────────────

const DK = COLORS.fieldnoteDark;
const SP_TESTER = DK.accent; // 검사자 — 보라
const SP_CLIENT = '#6FD7A6'; // 내담자 — 연초록 (lab 다크 화자색)
const TOTAL = 150;

const TRANSCRIPT: { t: number; sp: 'tester' | 'client'; text: string }[] = [
  { t: 0, sp: 'tester', text: '오늘은 그림을 몇 개 그려볼 거예요. 편하게 그리면 돼요.' },
  { t: 8, sp: 'client', text: '…네.' },
  { t: 18, sp: 'tester', text: '먼저 나무를 한 그루 그려볼까요?' },
  { t: 30, sp: 'client', text: '(약 8초 후) …어떤 나무요?' },
  { t: 44, sp: 'tester', text: '아무 나무나, 그리고 싶은 걸로요.' },
  { t: 60, sp: 'client', text: '오래된… 큰 나무요. 잎이 다 떨어진.' },
  { t: 92, sp: 'tester', text: '이 나무는 몇 살쯤 됐을까요?' },
  { t: 100, sp: 'client', text: '엄청 늙었어요. 백 살.' },
  { t: 120, sp: 'tester', text: '이 나무 주변엔 뭐가 있어요?' },
  { t: 128, sp: 'client', text: '아무것도 없어요. 혼자 있어요.' },
];

const RESPONSES = [
  { t: 60, prompt: '나무를 그려달라', response: '오래된 큰 나무, 잎이 다 떨어진' },
  { t: 100, prompt: '나무 나이', response: '백 살, 엄청 늙음' },
  { t: 128, prompt: '나무 주변', response: '아무것도 없음, 혼자 있음' },
];
const OBSERVATIONS = [
  { t: 30, text: '지시 후 약 8초 침묵' },
  { t: 30, text: '"어떤 나무요?"라고 되물음 (과제 명료화 요청)' },
];
const QUOTES = [
  { t: 60, text: '오래된… 큰 나무요. 잎이 다 떨어진.' },
  { t: 128, text: '아무것도 없어요. 혼자 있어요.' },
];
const SUMMARY_ASSESS = 'HTP 중 나무 그림 실시 및 사후 질문 진행.';

// 상담 렌즈(대조군) — 일부러 해석성 출력
const COUNSELING = {
  summary: '내담자가 고립감과 우울감을 드러낸 회기.',
  keywords: ['고립', '우울', '위축'],
  issues: ['외로움 호소', '정서적 위축'],
  mood: '전반적으로 가라앉은 정서, 위축된 모습',
  highlights: [{ t: 128, text: '"혼자 있어요" — 고립감 표현' }],
};

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const ss = Math.floor(sec % 60);
  return `${m}:${ss.toString().padStart(2, '0')}`;
}

// ──────────────── Page ────────────────

export default function AssessmentFieldnoteAnalysisLab() {
  const router = useRouter();
  const [tabKey, setTabKey] = useState<TabKey>('transcript');
  const [playPos, setPlayPos] = useState(0);
  const [draftOpen, setDraftOpen] = useState(false);
  const active = TABS.find((t) => t.key === tabKey)!;

  const seek = (t: number) => setPlayPos(t);

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: DK.bg }} edges={['top']}>
      {/* 헤더 */}
      <View className="h-[52px] flex-row items-center px-5" style={{ backgroundColor: DK.bg }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} accessibilityLabel="뒤로 가기" accessibilityRole="button">
          <Ionicons name="chevron-back" size={24} color={DK.text} />
        </TouchableOpacity>
        <Typography variant="title-01" weight="semibold" style={{ color: DK.text, marginLeft: s(6) }}>
          검사 분석 · HTP
        </Typography>
      </View>

      {/* 탭 pill (다크) */}
      <View style={{ paddingHorizontal: s(LAYOUT.screenPaddingX), paddingTop: s(8) }}>
        <View style={{ flexDirection: 'row', backgroundColor: DK.card, borderRadius: s(10), padding: s(3) }}>
          {TABS.map((t) => {
            const on = t.key === tabKey;
            return (
              <TouchableOpacity
                key={t.key}
                activeOpacity={0.8}
                onPress={() => setTabKey(t.key)}
                style={{ flex: 1, paddingVertical: s(8), borderRadius: s(8), alignItems: 'center', backgroundColor: on ? DK.activeBg : 'transparent' }}
              >
                <Typography variant="label-02" weight={on ? 'semibold' : 'medium'} style={{ color: on ? DK.accent : DK.sub }}>
                  {t.label}
                </Typography>
              </TouchableOpacity>
            );
          })}
        </View>
        <Typography variant="caption-01" style={{ color: DK.sub, marginTop: s(8), paddingHorizontal: s(2) }}>
          {active.caption}
        </Typography>
      </View>

      <ScrollView contentContainerStyle={{ padding: s(20), paddingBottom: s(120) }}>
        {tabKey === 'counseling' && <CounselingLens />}
        {tabKey === 'struct' && <StructFirst onSeek={seek} />}
        {tabKey === 'transcript' && <TranscriptFirst playPos={playPos} onSeek={seek} />}

        {/* 소견 초안 CTA (검사 렌즈 탭에서만) */}
        {tabKey !== 'counseling' && (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setDraftOpen((v) => !v)}
            style={{ marginTop: s(20), flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: s(6), backgroundColor: DK.accent, borderRadius: s(12), paddingVertical: s(14) }}
          >
            <Ionicons name="create-outline" size={18} color={DK.bg} />
            <Typography variant="body-02" weight="semibold" style={{ color: DK.bg }}>
              이 분석으로 소견 초안 만들기
            </Typography>
          </TouchableOpacity>
        )}
        {draftOpen && tabKey !== 'counseling' && <DraftPreview />}
      </ScrollView>

      {/* 미니 재생바 — 전사 싱크 */}
      <MiniPlayer playPos={playPos} />
    </SafeAreaView>
  );
}

// ──────────────── 상담 렌즈 (대조군) ────────────────

function CounselingLens() {
  return (
    <View style={{ gap: s(16) }}>
      <View style={{ backgroundColor: 'rgba(255,66,66,0.12)', borderRadius: s(12), padding: s(12), flexDirection: 'row', gap: s(8) }}>
        <Ionicons name="warning-outline" size={16} color="#FF8A8A" />
        <Typography variant="label-01" style={{ color: '#FFB4B4', flex: 1, lineHeight: 18 }}>
          상담 렌즈는 "우울·위축" 같은 해석을 내놓음 — 검사에선 검사자/채점의 몫이라 부적절·위험.
        </Typography>
      </View>
      <Section title="요약">
        <Typography variant="body-02" style={{ color: DK.text, lineHeight: 22 }}>{COUNSELING.summary}</Typography>
      </Section>
      <Section title="키워드">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(6) }}>
          {COUNSELING.keywords.map((k) => (
            <View key={k} style={{ backgroundColor: DK.activeBg, borderRadius: 999, paddingHorizontal: s(10), paddingVertical: s(5) }}>
              <Typography variant="label-02" style={{ color: DK.accent }}>{k}</Typography>
            </View>
          ))}
        </View>
      </Section>
      <Section title="주요 이슈">
        {COUNSELING.issues.map((i) => (
          <Typography key={i} variant="body-03" style={{ color: DK.text, lineHeight: 20 }}>• {i}</Typography>
        ))}
      </Section>
      <Section title="정서 흐름 (해석 ⚠)">
        <Typography variant="body-03" style={{ color: '#FFB4B4', lineHeight: 20 }}>{COUNSELING.mood}</Typography>
      </Section>
    </View>
  );
}

// ──────────────── 검사·구조 우선 ────────────────

function StructFirst({ onSeek }: { onSeek: (t: number) => void }) {
  return (
    <View style={{ gap: s(16) }}>
      <Section title="요약">
        <Typography variant="body-02" style={{ color: DK.text, lineHeight: 22 }}>{SUMMARY_ASSESS}</Typography>
      </Section>

      <Section title={`질문 ↔ 반응 (${RESPONSES.length})`}>
        <View style={{ gap: s(8) }}>
          {RESPONSES.map((r, i) => (
            <SeekRow key={i} t={r.t} onSeek={onSeek}>
              <Typography variant="label-02" style={{ color: DK.sub }}>{r.prompt}</Typography>
              <Typography variant="body-03" style={{ color: DK.text, lineHeight: 20, marginTop: s(2) }}>{r.response}</Typography>
            </SeekRow>
          ))}
        </View>
      </Section>

      <Section title={`관찰 (${OBSERVATIONS.length})`}>
        <View style={{ gap: s(8) }}>
          {OBSERVATIONS.map((o, i) => (
            <SeekRow key={i} t={o.t} onSeek={onSeek}>
              <Typography variant="body-03" style={{ color: DK.text, lineHeight: 20 }}>{o.text}</Typography>
            </SeekRow>
          ))}
        </View>
      </Section>

      <Section title={`인용 후보 (${QUOTES.length})`}>
        <View style={{ gap: s(8) }}>
          {QUOTES.map((q, i) => (
            <SeekRow key={i} t={q.t} onSeek={onSeek} accent>
              <Typography variant="body-03" style={{ color: DK.text, lineHeight: 20, fontStyle: 'italic' }}>“{q.text}”</Typography>
            </SeekRow>
          ))}
        </View>
      </Section>

      <Section title="전사 전체">
        <TranscriptList playPos={-1} onSeek={onSeek} compact />
      </Section>
    </View>
  );
}

// ──────────────── 검사·전사 우선 (권장) ────────────────

function TranscriptFirst({ playPos, onSeek }: { playPos: number; onSeek: (t: number) => void }) {
  return (
    <View style={{ gap: s(16) }}>
      {/* 되짚기 점프 칩 — 구조는 전사 위 보조 점프로 */}
      <View style={{ gap: s(8) }}>
        <Typography variant="label-01" weight="semibold" style={{ color: DK.sub }}>되짚기</Typography>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(6) }}>
          {QUOTES.map((q, i) => (
            <TouchableOpacity key={i} activeOpacity={0.8} onPress={() => onSeek(q.t)} style={{ flexDirection: 'row', alignItems: 'center', gap: s(4), backgroundColor: DK.activeBg, borderRadius: 999, paddingHorizontal: s(10), paddingVertical: s(6) }}>
              <Ionicons name="play" size={11} color={DK.accent} />
              <Typography variant="label-02" style={{ color: DK.accent }}>{fmt(q.t)} 인용</Typography>
            </TouchableOpacity>
          ))}
          {OBSERVATIONS.map((o, i) => (
            <TouchableOpacity key={`o${i}`} activeOpacity={0.8} onPress={() => onSeek(o.t)} style={{ flexDirection: 'row', alignItems: 'center', gap: s(4), backgroundColor: DK.card, borderRadius: 999, paddingHorizontal: s(10), paddingVertical: s(6) }}>
              <Ionicons name="eye-outline" size={12} color={DK.sub} />
              <Typography variant="label-02" style={{ color: DK.sub }}>{fmt(o.t)} 관찰</Typography>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* 전사 싱크 전면 */}
      <View style={{ gap: s(8) }}>
        <Typography variant="label-01" weight="semibold" style={{ color: DK.sub }}>전사 (탭하면 그 지점부터 재생)</Typography>
        <TranscriptList playPos={playPos} onSeek={onSeek} />
      </View>
    </View>
  );
}

// ──────────────── 공통 ────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: s(8) }}>
      <Typography variant="label-01" weight="semibold" style={{ color: DK.sub }}>{title}</Typography>
      {children}
    </View>
  );
}

function SeekRow({ t, onSeek, accent, children }: { t: number; onSeek: (t: number) => void; accent?: boolean; children: React.ReactNode }) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => onSeek(t)}
      style={{ flexDirection: 'row', gap: s(10), backgroundColor: DK.card, borderRadius: s(12), padding: s(12), borderLeftWidth: accent ? s(2) : 0, borderLeftColor: DK.accent }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(3) }}>
        <Ionicons name="play" size={11} color={DK.accent} />
        <Typography variant="label-02" style={{ color: DK.accent }}>{fmt(t)}</Typography>
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </TouchableOpacity>
  );
}

function TranscriptList({ playPos, onSeek, compact }: { playPos: number; onSeek: (t: number) => void; compact?: boolean }) {
  return (
    <View style={{ gap: s(compact ? 4 : 8) }}>
      {TRANSCRIPT.map((line, i) => {
        const next = TRANSCRIPT[i + 1]?.t ?? TOTAL;
        const activeLine = playPos >= line.t && playPos < next;
        const color = line.sp === 'tester' ? SP_TESTER : SP_CLIENT;
        return (
          <TouchableOpacity
            key={i}
            activeOpacity={0.7}
            onPress={() => onSeek(line.t)}
            style={{ flexDirection: 'row', gap: s(8), backgroundColor: activeLine ? DK.activeBg : 'transparent', borderRadius: s(10), paddingVertical: s(6), paddingHorizontal: s(8) }}
          >
            <Typography variant="label-02" style={{ color: DK.sub, width: s(30) }}>{fmt(line.t)}</Typography>
            <View style={{ flex: 1 }}>
              <Typography variant="label-02" weight="semibold" style={{ color }}>
                {line.sp === 'tester' ? '검사자' : '내담자'}
              </Typography>
              <Typography variant="body-03" style={{ color: DK.text, lineHeight: 20 }}>{line.text}</Typography>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function MiniPlayer({ playPos }: { playPos: number }) {
  const ratio = Math.min(playPos / TOTAL, 1);
  return (
    <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: DK.card, borderTopWidth: 1, borderTopColor: DK.line, paddingHorizontal: s(20), paddingTop: s(12), paddingBottom: s(28) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(12) }}>
        <View style={{ width: s(36), height: s(36), borderRadius: 999, backgroundColor: DK.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="play" size={18} color={DK.bg} />
        </View>
        <View style={{ flex: 1, gap: s(6) }}>
          <View style={{ height: s(4), borderRadius: 999, backgroundColor: DK.line, overflow: 'hidden' }}>
            <View style={{ width: `${ratio * 100}%`, height: '100%', backgroundColor: DK.accent }} />
          </View>
          <Typography variant="caption-01" style={{ color: DK.sub }}>{fmt(playPos)} / {fmt(TOTAL)}</Typography>
        </View>
      </View>
    </View>
  );
}

function DraftPreview() {
  return (
    <View style={{ marginTop: s(12), backgroundColor: DK.card, borderRadius: s(12), padding: s(14), gap: s(8) }}>
      <Typography variant="label-01" weight="semibold" style={{ color: DK.accent }}>소견 초안 (검토 후 작성)</Typography>
      <Typography variant="caption-01" style={{ color: DK.sub, lineHeight: 16 }}>
        AI는 해석하지 않아요. 아래는 verbatim·관찰을 모은 scaffold일 뿐 — 소견 시트에 채워지고, 작성은 검사자가 합니다.
      </Typography>
      <View style={{ height: 1, backgroundColor: DK.line, marginVertical: s(2) }} />
      <Typography variant="body-03" style={{ color: DK.text, lineHeight: 20 }}>
        · 나무: "오래된 큰 나무, 잎이 다 떨어진" ({fmt(60)}){'\n'}
        · 나이: 백 살 ({fmt(100)}){'\n'}
        · 주변: "아무것도 없어요. 혼자 있어요." ({fmt(128)}){'\n'}
        · 관찰: 지시 후 약 8초 침묵, 과제 명료화 요청 ({fmt(30)})
      </Typography>
    </View>
  );
}
