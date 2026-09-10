import { View, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/shared/constants/theme';
import { Typography } from '@/shared/components/ui/Typography';
import { s } from '@/shared/utils/scale';
import type { FieldNoteAnalysis } from '../types';

const FN = COLORS.fieldnoteDark;
/** 상세 화면(CompletedScreen) 블루 액센트와 통일 — 기존 보라(#B98BFF) 대체. */
const ACCENT = '#3B82F6';
/** 블루 액센트 톤 배경(BLUE @14%) — 칩·재생 버튼 배경. */
const ACCENT_BG = 'rgba(59,130,246,0.14)';

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const ss = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

function SectionLabel({
  icon,
  children,
  color = FN.sub,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6), marginTop: s(18), marginBottom: s(8) }}>
      <Ionicons name={icon} size={s(14)} color={color} />
      <Typography variant="label-01" weight="semibold" style={{ color }}>
        {children}
      </Typography>
    </View>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <View style={{ borderRadius: s(14), backgroundColor: FN.card, padding: s(14) }}>{children}</View>;
}

function Chip({ label }: { label: string }) {
  return (
    <View style={{ backgroundColor: ACCENT_BG, borderRadius: s(999), paddingHorizontal: s(11), paddingVertical: s(6) }}>
      <Typography variant="label-02" weight="medium" style={{ color: ACCENT }}>
        {label}
      </Typography>
    </View>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: s(8) }}>
      <View style={{ width: s(4), height: s(4), borderRadius: s(2), backgroundColor: ACCENT, marginTop: s(8) }} />
      <Typography variant="body-03" style={{ color: FN.text, flex: 1, lineHeight: s(20) }}>
        {text}
      </Typography>
    </View>
  );
}

interface AIAnalysisViewProps {
  analysis: FieldNoteAnalysis;
  /** analysis.summary 가 비었을 때 사용할 평문 요약 폴백. */
  summaryFallback?: string | null;
  /** 하이라이트 탭 → 해당 재생 위치로 점프(+재생). */
  onSeek: (sec: number) => void;
}

/** {t, text} 행 — 탭하면 그 지점부터 재생 (관찰·인용·하이라이트 공용). */
function SeekTextRow({ t, text, onSeek, italic }: { t: number; text: string; onSeek: (sec: number) => void; italic?: boolean }) {
  return (
    <Pressable
      onPress={() => onSeek(t)}
      style={{ flexDirection: 'row', alignItems: 'center', gap: s(10) }}
      accessibilityRole="button"
      accessibilityLabel={`${fmtTime(t)} 지점부터 재생`}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(3), backgroundColor: ACCENT_BG, borderRadius: s(6), paddingHorizontal: s(7), paddingVertical: s(3) }}>
        <Ionicons name="play" size={s(10)} color={ACCENT} />
        <Typography variant="label-02" weight="medium" style={{ color: ACCENT }}>
          {fmtTime(t)}
        </Typography>
      </View>
      <Typography variant="body-03" style={{ color: FN.text, flex: 1, lineHeight: s(19), fontStyle: italic ? 'italic' : 'normal' }}>
        {text}
      </Typography>
    </Pressable>
  );
}

/**
 * AI 분석 탭 — 데이터 있는 섹션만 렌더.
 * - 상담 렌즈: 요약·키워드·주요 이슈·정서·하이라이트
 * - 검사 렌즈(task 노트): 요약·질문↔반응·관찰·인용 후보·하이라이트 (해석 없음 — §3-4-3)
 * 한 노트는 둘 중 한쪽 필드만 채워지므로(서버가 task_id로 분기 생성) 조건부 렌더로 자연 분기됨.
 * 모든 시각 행은 탭하면 그 지점부터 재생.
 */
export function AIAnalysisView({ analysis, summaryFallback, onSeek }: AIAnalysisViewProps) {
  // 요약 본문: narrative(확장 요약) 우선 → 짧은 summary → 평문 폴백
  const narrative = (analysis.narrative ?? '').trim();
  const shortSummary = (analysis.summary ?? '').trim() || (summaryFallback ?? '').trim();
  const summaryBody = narrative || shortSummary;
  const moodFlow = analysis.mood_flow ?? [];
  const keyQuotes = analysis.key_quotes ?? [];
  const followUps = analysis.follow_ups ?? [];
  const responses = analysis.responses ?? [];
  const observations = analysis.observations ?? [];
  const quotes = analysis.quotes ?? [];

  return (
    <View>
      {summaryBody ? (
        <>
          <SectionLabel icon="sparkles" color={ACCENT}>요약</SectionLabel>
          <Card>
            <Typography variant="body-02" style={{ color: FN.text, lineHeight: s(25) }}>
              {summaryBody}
            </Typography>
          </Card>
        </>
      ) : null}

      {analysis.keywords.length > 0 ? (
        <>
          <SectionLabel icon="pricetags-outline">키워드</SectionLabel>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(6) }}>
            {analysis.keywords.map((k) => (
              <Chip key={k} label={k} />
            ))}
          </View>
        </>
      ) : null}

      {analysis.issues.length > 0 ? (
        <>
          <SectionLabel icon="flag-outline">주요 이슈 · 호소</SectionLabel>
          <Card>
            <View style={{ gap: s(8) }}>
              {analysis.issues.map((it) => (
                <Bullet key={it} text={it} />
              ))}
            </View>
          </Card>
        </>
      ) : null}

      {moodFlow.length > 0 ? (
        <>
          <SectionLabel icon="pulse-outline">정서 흐름</SectionLabel>
          <Card>
            <View style={{ gap: s(12) }}>
              {moodFlow.map((m, i) => (
                <Pressable
                  key={`${m.t}-${i}`}
                  onPress={() => onSeek(m.t)}
                  accessibilityRole="button"
                  accessibilityLabel={`${fmtTime(m.t)} 지점부터 재생`}
                  style={{ flexDirection: 'row', gap: s(10) }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(3), backgroundColor: ACCENT_BG, borderRadius: s(6), paddingHorizontal: s(7), paddingVertical: s(3), alignSelf: 'flex-start', marginTop: s(1) }}>
                    <Ionicons name="play" size={s(10)} color={ACCENT} />
                    <Typography variant="label-02" weight="medium" style={{ color: ACCENT }}>
                      {fmtTime(m.t)}
                    </Typography>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Typography variant="body-03" weight="semibold" style={{ color: FN.text, lineHeight: s(20) }}>
                      {m.mood}
                    </Typography>
                    {m.trigger ? (
                      <Typography variant="label-01" style={{ color: FN.sub, lineHeight: s(18), marginTop: s(1) }}>
                        {m.trigger}
                      </Typography>
                    ) : null}
                  </View>
                </Pressable>
              ))}
            </View>
          </Card>
        </>
      ) : analysis.mood ? (
        <>
          <SectionLabel icon="pulse-outline">정서 흐름</SectionLabel>
          <Card>
            <Typography variant="body-03" style={{ color: FN.text, lineHeight: s(21) }}>
              {analysis.mood}
            </Typography>
          </Card>
        </>
      ) : null}

      {keyQuotes.length > 0 ? (
        <>
          <SectionLabel icon="chatbox-ellipses-outline">의미 있는 발화</SectionLabel>
          <Card>
            <View style={{ gap: s(14) }}>
              {keyQuotes.map((q, i) => (
                <Pressable
                  key={`${q.t}-${i}`}
                  onPress={() => onSeek(q.t)}
                  accessibilityRole="button"
                  accessibilityLabel={`${fmtTime(q.t)} 지점부터 재생`}
                  style={{ gap: s(5) }}
                >
                  <View style={{ flexDirection: 'row', gap: s(8) }}>
                    <View style={{ width: s(2), borderRadius: s(1), backgroundColor: ACCENT }} />
                    <Typography variant="body-02-reading" style={{ color: FN.text, flex: 1, lineHeight: s(23), fontStyle: 'italic' }}>
                      “{q.quote}”
                    </Typography>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8) }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(3), backgroundColor: ACCENT_BG, borderRadius: s(6), paddingHorizontal: s(7), paddingVertical: s(3) }}>
                      <Ionicons name="play" size={s(10)} color={ACCENT} />
                      <Typography variant="label-02" weight="medium" style={{ color: ACCENT }}>
                        {fmtTime(q.t)}
                      </Typography>
                    </View>
                    {q.note ? (
                      <Typography variant="label-01" style={{ color: FN.sub, flex: 1, lineHeight: s(18) }}>
                        {q.note}
                      </Typography>
                    ) : null}
                  </View>
                </Pressable>
              ))}
            </View>
          </Card>
        </>
      ) : null}

      {followUps.length > 0 ? (
        <>
          <SectionLabel icon="arrow-forward-circle-outline">살펴볼 지점</SectionLabel>
          <Card>
            <View style={{ gap: s(12) }}>
              {followUps.map((f, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: s(8) }}>
                  <View style={{ width: s(4), height: s(4), borderRadius: s(2), backgroundColor: ACCENT, marginTop: s(8) }} />
                  <View style={{ flex: 1 }}>
                    <Typography variant="body-03" weight="semibold" style={{ color: FN.text, lineHeight: s(20) }}>
                      {f.point}
                    </Typography>
                    {f.reason ? (
                      <Typography variant="label-01" style={{ color: FN.sub, lineHeight: s(18), marginTop: s(1) }}>
                        {f.reason}
                      </Typography>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          </Card>
        </>
      ) : null}

      {responses.length > 0 ? (
        <>
          <SectionLabel icon="chatbubbles-outline" color={ACCENT}>질문 ↔ 반응</SectionLabel>
          <Card>
            <View style={{ gap: s(12) }}>
              {responses.map((r, i) => (
                <Pressable
                  key={`${r.t}-${i}`}
                  onPress={() => onSeek(r.t)}
                  accessibilityRole="button"
                  accessibilityLabel={`${fmtTime(r.t)} 지점부터 재생`}
                  style={{ gap: s(4) }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6) }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(3), backgroundColor: ACCENT_BG, borderRadius: s(6), paddingHorizontal: s(7), paddingVertical: s(3) }}>
                      <Ionicons name="play" size={s(10)} color={ACCENT} />
                      <Typography variant="label-02" weight="medium" style={{ color: ACCENT }}>
                        {fmtTime(r.t)}
                      </Typography>
                    </View>
                    {r.prompt ? (
                      <Typography variant="label-02" style={{ color: FN.sub, flex: 1 }} numberOfLines={1}>
                        {r.prompt}
                      </Typography>
                    ) : null}
                  </View>
                  {r.response ? (
                    <Typography variant="body-03" style={{ color: FN.text, lineHeight: s(20) }}>
                      {r.response}
                    </Typography>
                  ) : null}
                </Pressable>
              ))}
            </View>
          </Card>
        </>
      ) : null}

      {observations.length > 0 ? (
        <>
          <SectionLabel icon="eye-outline">관찰</SectionLabel>
          <Card>
            <View style={{ gap: s(10) }}>
              {observations.map((o, i) => (
                <SeekTextRow key={`${o.t}-${i}`} t={o.t} text={o.text} onSeek={onSeek} />
              ))}
            </View>
          </Card>
        </>
      ) : null}

      {quotes.length > 0 ? (
        <>
          <SectionLabel icon="reader-outline">인용 후보</SectionLabel>
          <Card>
            <View style={{ gap: s(10) }}>
              {quotes.map((q, i) => (
                <SeekTextRow key={`${q.t}-${i}`} t={q.t} text={`“${q.text}”`} onSeek={onSeek} italic />
              ))}
            </View>
          </Card>
        </>
      ) : null}

      {analysis.highlights.length > 0 ? (
        <>
          <SectionLabel icon="time-outline">하이라이트</SectionLabel>
          <Card>
            <View style={{ gap: s(10) }}>
              {analysis.highlights.map((h, i) => (
                <Pressable
                  key={`${h.t}-${i}`}
                  onPress={() => onSeek(h.t)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: s(10) }}
                  accessibilityRole="button"
                  accessibilityLabel={`${fmtTime(h.t)} 지점부터 재생`}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(3), backgroundColor: ACCENT_BG, borderRadius: s(6), paddingHorizontal: s(7), paddingVertical: s(3) }}>
                    <Ionicons name="play" size={s(10)} color={ACCENT} />
                    <Typography variant="label-02" weight="medium" style={{ color: ACCENT }}>
                      {fmtTime(h.t)}
                    </Typography>
                  </View>
                  <Typography variant="body-03" style={{ color: FN.text, flex: 1, lineHeight: s(19) }}>
                    {h.text}
                  </Typography>
                </Pressable>
              ))}
            </View>
          </Card>
        </>
      ) : null}
    </View>
  );
}

// 미분석 상태 티저용 예시 데이터 — "이렇게 정리됩니다" 미리보기(블러 뒤). 실데이터 아님.
const EXAMPLE_ANALYSIS: FieldNoteAnalysis = {
  summary: '블록 놀이 중 실패 불안을 다루며 자발적 도전으로 이어진 회기.',
  narrative:
    '회기는 내담자가 블록이 무너졌던 지난 경험을 꺼내며 시작되었다. 실패에 대한 불안을 반복해 언급하다가, 상담사와 함께 무너진 블록을 다시 쌓는 재구성을 거치며 긴장이 풀렸다. 후반에는 자발적으로 더 큰 블록에 도전하며 안정된 반응을 보였고, 회기는 성취감을 표현하는 상태로 마무리되었다.',
  keywords: ['실패 불안', '또래 관계', '블록 놀이', '자기효능감', '재구성'],
  issues: ['실패·무너짐에 대한 두려움', '또래와의 비교 의식', '새 시도 앞의 망설임'],
  mood: null,
  mood_flow: [
    { t: 192, mood: '불안·긴장', trigger: '블록이 무너졌던 경험을 떠올리며' },
    { t: 1300, mood: '안도', trigger: '함께 다시 쌓아 올린 직후' },
    { t: 2285, mood: '성취감', trigger: '큰 블록에 스스로 도전한 뒤' },
  ],
  key_quotes: [
    { t: 192, quote: '저번처럼 무너지면 어떡해요', note: '실패 불안을 처음으로 직접 표현' },
    { t: 2285, quote: '그럼 큰 걸로 쌓아볼래요', note: '회피에서 자발적 시도로 전환' },
  ],
  follow_ups: [
    { point: '또래와 비교하는 장면의 구체적 맥락', reason: '이번 회기에선 언급만 하고 지나감' },
    { point: '성취 경험을 다음 회기로 이어갈 방법', reason: '안정 반응이 일시적인지 확인 필요' },
  ],
  highlights: [
    { t: 192, text: '"저번처럼 무너지면 어떡해요" — 실패 불안 표출' },
    { t: 2285, text: '"그럼 큰 걸로 쌓아볼래요" — 자발적 도전' },
  ],
};

interface AIAnalysisTeaserProps {
  onAnalyze: () => void;
  loading: boolean;
}

/**
 * 미분석 상태 — 블러 처리된 예시 대시보드(미리보기) + "AI 분석하기" CTA.
 * AI 분석은 추후 유료 기능이라, 결과를 다 보여주지 않고 "이렇게 나온다"만 흐릿하게 노출한다.
 */
export function AIAnalysisTeaser({ onAnalyze, loading }: AIAnalysisTeaserProps) {
  return (
    <View style={teaserStyles.wrap}>
      <View style={teaserStyles.previewClip} pointerEvents="none">
        <AIAnalysisView analysis={EXAMPLE_ANALYSIS} onSeek={() => {}} />
      </View>
      <BlurView intensity={22} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={teaserStyles.dim} />
      <View style={teaserStyles.cta}>
        <Ionicons name="sparkles" size={s(28)} color={ACCENT} />
        <Typography
          variant="body-01"
          weight="semibold"
          style={{ color: FN.text, textAlign: 'center', marginTop: s(8) }}
        >
          AI가 회기를 이렇게 정리해드려요
        </Typography>
        <Typography
          variant="body-03"
          style={{ color: FN.sub, textAlign: 'center', lineHeight: s(20), marginTop: s(4) }}
        >
          회기 요약 · 정서 흐름 · 의미 있는 발화 · 살펴볼 지점까지.{'\n'}분석하면 실제 내용으로 채워져요.
        </Typography>
        <Pressable
          onPress={onAnalyze}
          disabled={loading}
          style={teaserStyles.btn}
          accessibilityRole="button"
          accessibilityLabel="AI 분석하기"
        >
          {loading ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <Ionicons name="sparkles" size={s(16)} color={COLORS.white} />
          )}
          <Typography variant="body-01" weight="semibold" style={{ color: COLORS.white }}>
            {loading ? '분석 중…' : 'AI 분석하기'}
          </Typography>
        </Pressable>
      </View>
    </View>
  );
}

const teaserStyles = StyleSheet.create({
  wrap: {
    position: 'relative',
    borderRadius: s(16),
    overflow: 'hidden',
    minHeight: s(420),
  },
  previewClip: { height: s(420) },
  dim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(20,18,32,0.45)',
  },
  cta: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: s(28),
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(7),
    backgroundColor: ACCENT,
    borderRadius: s(14),
    paddingVertical: s(13),
    paddingHorizontal: s(22),
    marginTop: s(18),
    minWidth: s(160),
  },
});
