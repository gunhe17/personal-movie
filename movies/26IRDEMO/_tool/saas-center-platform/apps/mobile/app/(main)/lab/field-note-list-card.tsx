import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/shared/constants/theme';
import { Typography } from '@/shared/components/ui/Typography';
import { s } from '@/shared/utils/scale';

/**
 * [필드노트] 목록 카드 · 신호/용어 재설계 비교 — 탭 시안.
 *
 * 질문(상담사 관점):
 *  1) "연결/미연결" 용어가 인지 가능한가? (DB 관계어 vs 상담사 할 일 언어)
 *  2) 카드에 녹음중·미연결·분석중 표시가 중복돼 보인다. 진짜 필요한 신호는?
 *  3) 재미·필수·직관 3요소가 실제로 동작하는 카드는?
 *
 * 탭:
 *  [이미지안]   디자이너 시안(다크) 충실 재현 — 검색바 + 전체/연결/미연결 칩 +
 *              날짜 그룹 + 행형 카드(카테고리 dot·프로그램·장소·우측 신호) + 미지정 CTA 카드.
 *  [현재]      production FieldNoteListContent 카드 충실 재현(대조군).
 *  [신호 정리]  한 사실=한 신호 + 정체성 우선 + 단일 우측 신호 + play 제거.
 *  [정리함]     "미연결"→"회기 미지정" + 상단 "정리 필요" 존(액션). 진행중 녹음 제외.
 *  [3요소 ✨]   재미(라이브 파형·호흡 펄스)·필수(좌측 strip=챙길 것 한눈에+단일 액션)·
 *              직관(상태별 색·검사명 뱃지·상대시간). 권장 종합안.
 *
 * mock 데이터만 사용(실 API/feature import 없음). 색은 COLORS.fieldnoteDark 토큰.
 * 짝: field-note-filters(필터 축) — 본 lab 은 카드 아이템 자체.
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
  negative: COLORS.negative,
  success: COLORS.success,
  assess: COLORS.assessment, // 검사 카테고리 블루
  counsel: COLORS.counseling, // 상담 카테고리 그린
  rec: COLORS.info, // 시안의 녹음중 블루
} as const;

// pipeline: 노트의 처리 단계 / linkKind: 연결 대상
type Pipeline = 'recording' | 'paused' | 'analyzing' | 'pending' | 'failed' | 'summary';
type LinkKind = 'schedule' | 'task' | null;

interface MockNote {
  id: string;
  dateKey: string;
  dateLabel: string;
  time: string;
  rel: string | null; // 상대시간 ("3일 전") — 직관용
  dur: string | null;
  linkKind: LinkKind;
  clientNames: string[];
  assessmentName?: string; // task 연결 시 검사명 (HTP 등)
  pipeline: Pipeline;
  summary: string | null; // 요약/전사 미리보기 (실제 내용 있을 때만)
}

// 상태·연결·카테고리 조합을 골고루 덮는 mock 12건 (3개 날짜 그룹).
const NOTES: MockNote[] = [
  // ── 오늘 ──
  {
    id: 'n5', dateKey: 'd0', dateLabel: '오늘 · 6월 8일 (월)', time: '15:10',
    rel: '방금', dur: null, linkKind: null, clientNames: [],
    pipeline: 'recording', summary: null,
  },
  {
    id: 'n8', dateKey: 'd0', dateLabel: '오늘 · 6월 8일 (월)', time: '14:50',
    rel: '20분 전', dur: '12분', linkKind: 'schedule', clientNames: ['김하늘'],
    pipeline: 'paused', summary: null,
  },
  {
    id: 'n1', dateKey: 'd0', dateLabel: '오늘 · 6월 8일 (월)', time: '14:32',
    rel: '38분 전', dur: '32분 10초', linkKind: 'schedule', clientNames: ['김민준'],
    pipeline: 'summary',
    summary: '분리불안이 다시 올라온 한 주. 등원 거부가 핵심 주제였고, 후반부에 스스로 다음 주 계획을 말함.',
  },
  {
    id: 'n2', dateKey: 'd0', dateLabel: '오늘 · 6월 8일 (월)', time: '11:05',
    rel: '4시간 전', dur: '28분', linkKind: 'schedule', clientNames: ['이서연', '이준호'],
    pipeline: 'analyzing', summary: null,
  },
  {
    id: 'n9', dateKey: 'd0', dateLabel: '오늘 · 6월 8일 (월)', time: '10:50',
    rel: '4시간 전', dur: '25분', linkKind: 'schedule', clientNames: ['서준'],
    pipeline: 'pending',
    summary: '(전사됨) 오늘은 학교에서 친구와 있었던 일을 먼저 꺼냈고, 중간에 한참 말을 멈췄다가…',
  },
  {
    id: 'n6', dateKey: 'd0', dateLabel: '오늘 · 6월 8일 (월)', time: '10:30',
    rel: '5시간 전', dur: '21분 4초', linkKind: 'task', clientNames: ['홍길동'], assessmentName: 'HTP',
    pipeline: 'summary',
    summary: 'HTP 실시 및 질문 단계 진행. 집 그림에서 창문을 반복해 강조함.',
  },
  {
    id: 'n3', dateKey: 'd0', dateLabel: '오늘 · 6월 8일 (월)', time: '09:50',
    rel: '5시간 전', dur: '5분', linkKind: null, clientNames: [],
    pipeline: 'pending', summary: null,
  },
  // ── 어제 ──
  {
    id: 'n4', dateKey: 'd1', dateLabel: '어제 · 6월 7일 (일)', time: '16:20',
    rel: '어제', dur: '44분', linkKind: 'schedule', clientNames: ['박도윤'],
    pipeline: 'failed', summary: null,
  },
  {
    id: 'n10', dateKey: 'd1', dateLabel: '어제 · 6월 7일 (일)', time: '14:00',
    rel: '어제', dur: '33분', linkKind: 'task', clientNames: ['윤아'], assessmentName: 'SCT',
    pipeline: 'analyzing', summary: null,
  },
  {
    id: 'n7', dateKey: 'd1', dateLabel: '어제 · 6월 7일 (일)', time: '13:00',
    rel: '어제', dur: '38분', linkKind: 'schedule', clientNames: ['정시우'],
    pipeline: 'pending', summary: null,
  },
  // ── 며칠 전 ──
  {
    id: 'n11', dateKey: 'd2', dateLabel: '6월 5일 (목)', time: '15:00',
    rel: '3일 전', dur: '40분', linkKind: 'schedule', clientNames: ['강민서'],
    pipeline: 'summary',
    summary: '놀이 중 또래 갈등을 재연하며 감정을 표현. 좌절 후 회복 시간이 지난주보다 짧아짐.',
  },
  {
    id: 'n12', dateKey: 'd2', dateLabel: '6월 5일 (목)', time: '11:00',
    rel: '3일 전', dur: '19분', linkKind: 'task', clientNames: ['태오'], assessmentName: 'HTP',
    pipeline: 'failed', summary: null,
  },
];

// ─────────────────────────────────────────────────────────
// 재미: 펄스 점 / 라이브 파형 / 호흡(breathe) 래퍼 — 인라인
// ─────────────────────────────────────────────────────────
function PulseDot({ size = 8, color = DK.accent }: { size?: number; color?: string }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.4] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.45] });
  return (
    <Animated.View
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, transform: [{ scale }], opacity }}
    />
  );
}

/** 라이브 파형 — 녹음 중 표식(재미). 막대들이 scaleY 로 출렁임. */
function MiniWaveform({ color = DK.error, bars = 5 }: { color?: string; bars?: number }) {
  const vals = useRef(Array.from({ length: bars }, () => new Animated.Value(0.4))).current;
  useEffect(() => {
    const loops = vals.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(v, { toValue: 1, duration: 320 + i * 90, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.35, duration: 300 + i * 70, useNativeDriver: true }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [vals]);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(2), height: s(16) }}>
      {vals.map((v, i) => (
        <Animated.View
          key={i}
          style={{ width: s(2.5), height: s(16), borderRadius: s(2), backgroundColor: color, transform: [{ scaleY: v }] }}
        />
      ))}
    </View>
  );
}

/** 부드러운 호흡 — 챙길 것 액션 pill 에 시선 유도(재미). scale 1↔1.045 루프. */
function Breathe({ children }: { children: React.ReactNode }) {
  const b = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(b, { toValue: 1, duration: 1100, useNativeDriver: true }),
        Animated.timing(b, { toValue: 0, duration: 1100, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [b]);
  const scale = b.interpolate({ inputRange: [0, 1], outputRange: [1, 1.045] });
  return <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>;
}

function DateHeader({ label, count }: { label: string; count: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: s(14), paddingBottom: s(8) }}>
      <Typography variant="label-01" weight="semibold" style={{ color: DK.text }}>{label}</Typography>
      <Typography variant="label-02" style={{ color: DK.sub, marginLeft: s(6) }}>{count}건</Typography>
    </View>
  );
}

function Chip({
  label, color, icon, pulse, solid,
}: {
  label: string; color: string; icon?: keyof typeof Ionicons.glyphMap; pulse?: boolean; solid?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(4), paddingHorizontal: s(8), paddingVertical: s(3), borderRadius: s(10), backgroundColor: solid ? color : color + '22' }}>
      {pulse ? <PulseDot size={6} color={solid ? '#fff' : color} /> : null}
      {icon ? <Ionicons name={icon} size={s(11)} color={solid ? '#fff' : color} /> : null}
      <Typography variant="label-02" weight="medium" style={{ color: solid ? '#fff' : color }}>{label}</Typography>
    </View>
  );
}

/** 검사 카테고리 표식(블루 dot + 검사명 뱃지) — 직관: 상담↔검사 즉시 구분. */
function AssessTag({ name }: { name?: string }) {
  return (
    <>
      <View style={{ width: s(6), height: s(6), borderRadius: s(3), backgroundColor: DK.assess }} />
      {name ? (
        <View style={{ paddingHorizontal: s(6), paddingVertical: s(1), borderRadius: s(4), backgroundColor: DK.assess + '26' }}>
          <Typography variant="label-02" weight="medium" style={{ color: DK.assess }}>{name}</Typography>
        </View>
      ) : null}
    </>
  );
}

function identityOf(n: MockNote): { text: string; muted: boolean } {
  if (n.pipeline === 'recording') return { text: '녹음 중', muted: false };
  if (n.pipeline === 'paused') return { text: '일시정지된 녹음', muted: false };
  if (n.clientNames.length === 0) return { text: '회기 미지정', muted: true };
  if (n.clientNames.length === 1) return { text: n.clientNames[0], muted: false };
  return { text: `${n.clientNames[0]} 외 ${n.clientNames.length - 1}명`, muted: false };
}

// ═════════════════════════════════════════════════════════
// 탭 1) 현재 (production 충실 재현)
// ═════════════════════════════════════════════════════════
function currentTitle(n: MockNote): string {
  if (n.pipeline === 'recording' || n.pipeline === 'paused') return '녹음 중인 필드노트';
  if (n.clientNames.length > 0 && n.linkKind === 'schedule') {
    return n.clientNames.length === 1 ? n.clientNames[0] : `${n.clientNames[0]} 외 ${n.clientNames.length - 1}명`;
  }
  // 검사(task) 연결 — 내담자명 · 검사명 (서버 task brief + isLinked=schedule||task 반영, 2026-06-08).
  if (n.linkKind === 'task') {
    const name = n.clientNames[0];
    if (name && n.assessmentName) return `${name} · ${n.assessmentName}`;
    if (name) return name;
    if (n.assessmentName) return n.assessmentName;
    return '검사 필드노트';
  }
  return '미연결 필드노트';
}
function currentPreview(n: MockNote): string {
  if (n.summary) return n.summary;
  if (n.pipeline === 'analyzing') return 'AI가 회기를 분석하고 있어요';
  if (n.pipeline === 'failed') return '분석에 실패했어요.';
  if (n.pipeline === 'recording' || n.pipeline === 'paused') return '녹음이 진행 중이에요.';
  if (n.linkKind === 'task' && n.assessmentName) return n.assessmentName;
  return '아직 분석된 내용이 없어요.';
}

function CurrentCard({ note: n }: { note: MockNote }) {
  const isRec = n.pipeline === 'recording' || n.pipeline === 'paused';
  const analyzing = n.pipeline === 'analyzing';
  const pending = n.pipeline === 'pending';
  const hasSummary = n.pipeline === 'summary';
  const isFailed = n.pipeline === 'failed';
  const isLinkedCurrent = n.linkKind === 'schedule' || n.linkKind === 'task'; // 검사 노트 미지정 버그 수정 반영

  return (
    <View style={{ borderRadius: s(12), backgroundColor: DK.card, padding: s(14), marginBottom: s(10) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: s(6) }}>
          {isRec ? <PulseDot color={DK.error} /> : analyzing ? <PulseDot /> : null}
          <Typography variant="label-01" style={{ color: DK.sub }}>{n.time}{n.dur ? ` · ${n.dur}` : ''}</Typography>
        </View>
        {isRec ? <Chip label="녹음중" color={DK.error} pulse />
          : analyzing ? <Chip label="분석중" color={DK.accent} pulse />
          : pending ? <Chip label="분석 필요" color={DK.accent} icon="sparkles" />
          : hasSummary ? <Chip label="AI 요약" color={DK.accent} icon="sparkles" />
          : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: s(6) }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: s(6) }}>
          <Typography variant="body-01" weight="semibold" style={{ color: DK.text, flexShrink: 1 }} numberOfLines={1}>{currentTitle(n)}</Typography>
          {!isLinkedCurrent && !isRec ? (
            <View style={{ paddingHorizontal: s(6), paddingVertical: s(1), borderRadius: s(4), backgroundColor: DK.warning + '1A' }}>
              <Typography variant="label-02" weight="medium" style={{ color: DK.warning }}>미연결</Typography>
            </View>
          ) : null}
        </View>
        <Ionicons name="play-circle" size={s(26)} color={DK.accent} />
      </View>
      {isFailed ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(4), marginTop: s(4) }}>
          <Ionicons name="alert-circle" size={s(14)} color={DK.negative} />
          <Typography variant="body-03" style={{ color: DK.negative, flex: 1 }} numberOfLines={2}>{currentPreview(n)}</Typography>
        </View>
      ) : (
        <Typography variant="body-03" style={{ color: DK.sub, marginTop: s(4) }} numberOfLines={2}>{currentPreview(n)}</Typography>
      )}
    </View>
  );
}

// ═════════════════════════════════════════════════════════
// 탭 2) 신호 정리
// ═════════════════════════════════════════════════════════
function rightAffordance(n: MockNote) {
  if (n.pipeline === 'recording') return <Chip label="녹음중" color={DK.error} pulse />;
  if (n.pipeline === 'paused') return <Chip label="일시정지" color={DK.error} icon="pause" />;
  if (n.pipeline === 'analyzing') return <Chip label="분석중" color={DK.accent} pulse />;
  if (n.linkKind === null) return <Chip label="회기 연결" color={DK.warning} icon="link" />;
  if (n.pipeline === 'failed') return <Chip label="다시 분석" color={DK.negative} icon="refresh" />;
  if (n.pipeline === 'pending') return <Chip label="분석 필요" color={DK.accent} icon="sparkles" />;
  return <Ionicons name="sparkles" size={s(14)} color={DK.accent} />;
}

function TidyCard({ note: n }: { note: MockNote }) {
  const isTask = n.linkKind === 'task';
  const { text: identity, muted } = identityOf(n);
  return (
    <View style={{ borderRadius: s(12), backgroundColor: DK.card, padding: s(14), marginBottom: s(10) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: s(7) }}>
          {isTask ? <AssessTag name={n.assessmentName} /> : null}
          <Typography variant="body-01" weight="semibold" style={{ color: muted ? DK.sub : DK.text, flexShrink: 1 }} numberOfLines={1}>{identity}</Typography>
        </View>
        {rightAffordance(n)}
      </View>
      <Typography variant="label-01" style={{ color: DK.sub, marginTop: s(5) }}>{n.time}{n.dur ? ` · ${n.dur}` : ''}</Typography>
      {n.summary ? (
        <Typography variant="body-03" style={{ color: DK.sub, marginTop: s(6) }} numberOfLines={2}>{n.summary}</Typography>
      ) : null}
    </View>
  );
}

// ═════════════════════════════════════════════════════════
// 탭 3) 정리함 모델
// ═════════════════════════════════════════════════════════
function InboxCard({ note: n, action }: { note: MockNote; action: boolean }) {
  const isTask = n.linkKind === 'task';
  const { text: identity, muted } = identityOf(n);
  return (
    <View style={{ borderRadius: s(12), backgroundColor: DK.card, padding: s(14), marginBottom: s(10) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: s(7) }}>
          {isTask ? <AssessTag name={n.assessmentName} /> : null}
          <Typography variant="body-01" weight="semibold" style={{ color: muted ? DK.sub : DK.text, flexShrink: 1 }} numberOfLines={1}>{identity}</Typography>
        </View>
        {!action && n.pipeline === 'analyzing' ? <Chip label="분석중" color={DK.accent} pulse />
          : !action && n.pipeline === 'summary' ? <Ionicons name="sparkles" size={s(14)} color={DK.accent} />
          : null}
      </View>
      <Typography variant="label-01" style={{ color: DK.sub, marginTop: s(5) }}>{n.time}{n.dur ? ` · ${n.dur}` : ''}</Typography>
      {n.summary ? (
        <Typography variant="body-03" style={{ color: DK.sub, marginTop: s(6) }} numberOfLines={2}>{n.summary}</Typography>
      ) : null}
      {action ? (
        <View style={{ flexDirection: 'row', gap: s(8), marginTop: s(10) }}>
          {n.linkKind === null ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(5), paddingHorizontal: s(12), paddingVertical: s(7), borderRadius: s(9), backgroundColor: DK.warning + '22' }}>
              <Ionicons name="link" size={s(13)} color={DK.warning} />
              <Typography variant="label-01" weight="semibold" style={{ color: DK.warning }}>회기 연결</Typography>
            </View>
          ) : null}
          {n.pipeline === 'failed' ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(5), paddingHorizontal: s(12), paddingVertical: s(7), borderRadius: s(9), backgroundColor: DK.negative + '22' }}>
              <Ionicons name="refresh" size={s(13)} color={DK.negative} />
              <Typography variant="label-01" weight="semibold" style={{ color: DK.negative }}>다시 분석</Typography>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

// ═════════════════════════════════════════════════════════
// 탭 4) 3요소 ✨ (재미·필수·직관 종합)
// ═════════════════════════════════════════════════════════
type Attention = 'live' | 'wait' | 'todo' | 'optional' | 'done';
function attentionOf(n: MockNote): Attention {
  if (n.pipeline === 'recording' || n.pipeline === 'paused') return 'live';
  if (n.pipeline === 'analyzing') return 'wait';
  // 챙길 것 = 회기 미지정 + 실패 (필수·구조적). 연결이 1순위라 미지정은 미분석보다 우선.
  if (n.linkKind === null || n.pipeline === 'failed') return 'todo';
  // 전사만 됨(미분석) — 분석은 선택·유료라 차분하게. 강요 안 함.
  if (n.pipeline === 'pending') return 'optional';
  return 'done';
}
// 직관: 좌측 strip 색 = "지금 이 노트가 나에게 뭐냐"
const STRIP: Record<Attention, string> = {
  live: DK.error,          // 진행 중
  wait: DK.accent,         // 처리 중(기다림)
  todo: DK.warning,        // 챙길 것(회기 미지정·실패)
  optional: 'transparent', // 전사만 됨 — 분석은 선택(차분)
  done: 'transparent',     // 완료(차분)
};

/** 챙길 것(todo) 단일 액션 — 필수. 호흡으로 시선 유도(재미). */
function TodoAction({ note: n }: { note: MockNote }) {
  const cfg = n.linkKind === null
    ? { label: '회기 연결', icon: 'link' as const, color: DK.warning }
    : n.pipeline === 'failed'
      ? { label: '다시 분석', icon: 'refresh' as const, color: DK.negative }
      : { label: '분석하기', icon: 'sparkles' as const, color: DK.accent };
  return (
    <Breathe>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(5), paddingHorizontal: s(12), paddingVertical: s(7), borderRadius: s(10), backgroundColor: cfg.color + '22' }}>
        <Ionicons name={cfg.icon} size={s(13)} color={cfg.color} />
        <Typography variant="label-01" weight="semibold" style={{ color: cfg.color }}>{cfg.label}</Typography>
      </View>
    </Breathe>
  );
}

function FlagshipCard({ note: n }: { note: MockNote }) {
  const att = attentionOf(n);
  const isTask = n.linkKind === 'task';
  const { text: identity, muted } = identityOf(n);

  // 우측 상단 신호(직관): 한 개만.
  const topRight =
    att === 'live'
      ? (n.pipeline === 'recording'
          ? <MiniWaveform color={DK.error} />
          : <Chip label="일시정지" color={DK.error} icon="pause" />)
      : att === 'wait'
        ? <Chip label="분석중" color={DK.accent} pulse />
        : att === 'optional'
          ? <Chip label="분석하기" color={DK.accent} icon="sparkles" /> // 선택 — 조용히 제안
          : att === 'done'
            ? <Ionicons name="sparkles" size={s(15)} color={DK.accent} />
            : null; // todo → 하단 액션으로

  return (
    <View style={{ flexDirection: 'row', borderRadius: s(12), backgroundColor: DK.card, marginBottom: s(10), overflow: 'hidden' }}>
      {/* 직관: 좌측 상태 strip */}
      <View style={{ width: s(4), backgroundColor: STRIP[att] }} />
      <View style={{ flex: 1, padding: s(14) }}>
        {/* Row 1: 정체성(필수) + 단일 신호(직관) */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: s(7) }}>
            {isTask ? <AssessTag name={n.assessmentName} /> : null}
            <Typography variant="body-01" weight="semibold" style={{ color: muted ? DK.sub : DK.text, flexShrink: 1 }} numberOfLines={1}>{identity}</Typography>
          </View>
          {topRight}
        </View>

        {/* Row 2: 상대시간 · 길이 (직관 — 언제) */}
        <Typography variant="label-01" style={{ color: DK.sub, marginTop: s(5) }}>
          {n.rel ?? n.time}{n.dur ? ` · ${n.dur}` : ''}
        </Typography>

        {/* Row 3: 미리보기 — 실제 내용 있을 때만 */}
        {n.summary ? (
          <Typography variant="body-03" style={{ color: DK.sub, marginTop: s(6) }} numberOfLines={2}>{n.summary}</Typography>
        ) : null}

        {/* 챙길 것: 단일 액션(필수) + 호흡(재미) */}
        {att === 'todo' ? (
          <View style={{ flexDirection: 'row', marginTop: s(10) }}>
            <TodoAction note={n} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

// ─── 판정 캡션 ───
function Verdict({ lines }: { lines: { tone: 'good' | 'bad' | 'note'; text: string }[] }) {
  const tint = { good: DK.success, bad: DK.negative, note: DK.sub } as const;
  const icon = { good: 'checkmark-circle', bad: 'close-circle', note: 'ellipse' } as const;
  return (
    <View style={{ marginTop: s(8), padding: s(14), borderRadius: s(12), backgroundColor: 'rgba(255,255,255,0.04)', gap: s(8) }}>
      {lines.map((l, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: s(8) }}>
          <Ionicons name={icon[l.tone] as keyof typeof Ionicons.glyphMap} size={s(14)} color={tint[l.tone]} style={{ marginTop: s(2) }} />
          <Typography variant="body-03" style={{ color: DK.text, flex: 1, lineHeight: s(20) }}>{l.text}</Typography>
        </View>
      ))}
    </View>
  );
}

// ─── 그룹 렌더 ───
function GroupedList({ notes, render }: { notes: MockNote[]; render: (n: MockNote) => React.ReactNode }) {
  const groups = useMemo(() => {
    const map = new Map<string, { label: string; items: MockNote[] }>();
    for (const n of notes) {
      if (!map.has(n.dateKey)) map.set(n.dateKey, { label: n.dateLabel, items: [] });
      map.get(n.dateKey)!.items.push(n);
    }
    return [...map.values()];
  }, [notes]);
  return (
    <>
      {groups.map((g) => (
        <View key={g.label}>
          <DateHeader label={g.label} count={g.items.length} />
          {g.items.map((n) => (<View key={n.id}>{render(n)}</View>))}
        </View>
      ))}
    </>
  );
}

// ═════════════════════════════════════════════════════════
// 탭 0) 이미지안 — 디자이너 시안 충실 재현
// ═════════════════════════════════════════════════════════
type ImgCat = 'counseling' | 'assessment' | null;
interface ImgNote {
  id: string;
  cat: ImgCat;
  name: string;
  set?: string; // "세트" 뱃지
  program?: string;
  room?: string;
  right: { kind: 'recording' | 'duration'; value: string };
  preview?: string;
  unlinked?: boolean; // 미지정 CTA 카드
  prompt?: string;
}

const PREVIEW =
  '내담자가 부모님의 갈등 상황과 그로 인한 자신의 감정에 대해 이야기 함. 상담을 통해 과거의 경험을 되짚어보며 해결하고…';

const IMG_NOTES: ImgNote[] = [
  { id: 'g1', cat: 'counseling', name: '홍길동 외 1명', program: '놀이치료 - 개인', room: '상담실 A', right: { kind: 'recording', value: '12:45' } },
  { id: 'g2', cat: 'counseling', name: '홍길동 외 1명', program: '놀이치료 - 개인', room: '상담실 A', right: { kind: 'duration', value: '50:12' }, preview: PREVIEW },
  { id: 'g3', cat: 'assessment', name: '김지민', set: '세트', program: '풀배터리검사-HTP', room: '상담실 A', right: { kind: 'duration', value: '50:12' }, preview: PREVIEW },
  { id: 'g4', cat: 'assessment', name: '김지민', program: '스마트폰중독검사', room: '상담실 A', right: { kind: 'duration', value: '50:12' }, preview: PREVIEW },
  { id: 'g5', cat: null, name: '필드노트 12', right: { kind: 'duration', value: '50:12' }, unlinked: true, prompt: '어떤 상담·검사에 대한 기록인가요?' },
];

/** 시안의 작은 녹음중 이퀄라이저(블루 3바, 출렁임). */
function RecBars({ color = DK.rec }: { color?: string }) {
  const vals = useRef([0.5, 0.95, 0.6].map((v) => new Animated.Value(v))).current;
  useEffect(() => {
    const loops = vals.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(v, { toValue: 1, duration: 300 + i * 80, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.4, duration: 280 + i * 70, useNativeDriver: true }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [vals]);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(2), height: s(12) }}>
      {vals.map((v, i) => (
        <Animated.View key={i} style={{ width: s(2.5), height: s(12), borderRadius: s(2), backgroundColor: color, transform: [{ scaleY: v }] }} />
      ))}
    </View>
  );
}

/** 시안 카드 1행(행형, 하단 구분선). 카테고리 dot + 이름 / 프로그램·장소 / 미리보기. */
function ImageRow({ note: n }: { note: ImgNote }) {
  const dotColor = n.cat === 'counseling' ? DK.counsel : n.cat === 'assessment' ? DK.assess : null;
  const isRec = n.right.kind === 'recording';

  if (n.unlinked) {
    return (
      <View style={{ borderRadius: s(16), backgroundColor: DK.card, padding: s(16), marginBottom: s(12) }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="body-01" weight="semibold" style={{ color: DK.text }}>{n.name}</Typography>
          <Typography variant="label-01" style={{ color: DK.sub }}>{n.right.value}</Typography>
        </View>
        <Typography variant="body-03" style={{ color: DK.sub, marginTop: s(8) }}>{n.prompt}</Typography>
        <Pressable style={{ marginTop: s(12), height: s(40), borderRadius: s(10), borderWidth: 1, borderColor: DK.line, alignItems: 'center', justifyContent: 'center' }}>
          <Typography variant="body-02" weight="medium" style={{ color: DK.text }}>선택하기</Typography>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ borderRadius: s(16), backgroundColor: DK.card, padding: s(16), marginBottom: s(12) }}>
      {/* Row 1: dot + 이름 ........ 우측 신호 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: s(8) }}>
          {dotColor ? <View style={{ width: s(7), height: s(7), borderRadius: s(4), backgroundColor: dotColor }} /> : null}
          <Typography variant="body-01" weight="semibold" style={{ color: DK.text, flexShrink: 1 }} numberOfLines={1}>{n.name}</Typography>
        </View>
        {isRec ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(5) }}>
            <RecBars />
            <Typography variant="label-01" weight="medium" style={{ color: DK.rec }}>녹음 중 {n.right.value}</Typography>
          </View>
        ) : (
          <Typography variant="label-01" style={{ color: DK.sub }}>{n.right.value}</Typography>
        )}
      </View>

      {/* Row 2: [세트] 프로그램 | 장소 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6), marginTop: s(6) }}>
        {n.set ? (
          <View style={{ paddingHorizontal: s(6), paddingVertical: s(1), borderRadius: s(4), backgroundColor: DK.assess + '26' }}>
            <Typography variant="label-02" weight="medium" style={{ color: DK.assess }}>{n.set}</Typography>
          </View>
        ) : null}
        <Typography variant="body-03" style={{ color: DK.sub }} numberOfLines={1}>
          {n.program}{n.room ? `  |  ${n.room}` : ''}
        </Typography>
      </View>

      {/* Row 3: 미리보기 2줄 */}
      {n.preview ? (
        <Typography variant="body-03" style={{ color: DK.sub, marginTop: s(8), lineHeight: s(20) }} numberOfLines={2}>{n.preview}</Typography>
      ) : null}
    </View>
  );
}

/** 이미지안 전체 화면(헤더·검색·칩·그룹·행 카드). 검색/칩은 시각만(mock). */
function ImageScreen() {
  const [f, setF] = useState<'all' | 'linked' | 'unlinked'>('all');
  const CHIPS: { key: typeof f; label: string; count: number }[] = [
    { key: 'all', label: '전체', count: 50 },
    { key: 'linked', label: '연결', count: 12 },
    { key: 'unlinked', label: '미연결', count: 12 },
  ];
  return (
    <View>
      <Typography variant="headline-02" weight="bold" style={{ color: DK.text, marginTop: s(6), marginBottom: s(14) }}>노트</Typography>

      {/* 검색바 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', height: s(48), borderRadius: s(14), backgroundColor: DK.card, paddingHorizontal: s(16), marginBottom: s(16) }}>
        <Typography variant="body-02" style={{ color: DK.sub, flex: 1 }}>내담자 이름, 프로그램으로 검색</Typography>
        <Ionicons name="search" size={s(20)} color={DK.sub} />
      </View>

      {/* 필터 칩: 전체/연결/미연결 + 카운트. active = 라이트 채움 pill */}
      <View style={{ flexDirection: 'row', gap: s(8), marginBottom: s(6) }}>
        {CHIPS.map((c) => {
          const active = f === c.key;
          return (
            <Pressable
              key={c.key}
              onPress={() => setF(c.key)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: s(6), paddingHorizontal: s(14), paddingVertical: s(8), borderRadius: s(999), backgroundColor: active ? '#E9E9EF' : 'transparent', borderWidth: 1, borderColor: active ? 'transparent' : DK.line }}
            >
              <Typography variant="label-01" weight={active ? 'semibold' : 'medium'} style={{ color: active ? '#1A1622' : DK.sub }}>{c.label}</Typography>
              <Typography variant="label-02" weight="medium" style={{ color: active ? '#6B6480' : DK.sub }}>{c.count}</Typography>
            </Pressable>
          );
        })}
      </View>

      {/* 날짜 그룹 + 행 카드 */}
      <View style={{ paddingTop: s(10) }}>
        <Typography variant="label-01" style={{ color: DK.sub, paddingBottom: s(10) }}>오늘</Typography>
        {IMG_NOTES.map((n) => <ImageRow key={n.id} note={n} />)}
      </View>

      <Verdict lines={[
        { tone: 'good', text: '정체성(이름) 1순위 + 카테고리 dot(상담 그린·검사 블루)로 상담↔검사 즉시 구분. [세트] 뱃지·녹음중 인라인 명확.' },
        { tone: 'note', text: '시안의 녹음중은 블루(시안 톤). 3요소 탭은 진행=red strip — 정체성 색 정책(블루 vs 보라/레드) 합의 필요.' },
        { tone: 'bad', text: '필터 "연결/미연결"은 DB 관계어 — 스펙 §3-4-4는 ❌, "회기 미지정"(또는 도메인 축 전체·상담·검사·미지정)으로 확정.' },
        { tone: 'bad', text: '카드 우측이 녹음 길이뿐 — "분석중/분석하기/완료" 신호가 없어 분석 여부를 카드에서 모름(§3-4-4 단일 신호).' },
        { tone: 'note', text: '녹음중 카드를 목록에 노출 — 최근 결정(녹음 제어 홈 마이크 일원화)과 중복 여부 확인. 상태 strip(좌측 띠)은 미반영(dot=카테고리로 사용).' },
      ]} />
    </View>
  );
}

// ═════════════════════════════════════════════════════════
type TabKey = 'image' | 'current' | 'tidy' | 'inbox' | 'flagship';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'image', label: '이미지안' },
  { key: 'current', label: '현재' },
  { key: 'tidy', label: '신호 정리' },
  { key: 'inbox', label: '정리함' },
  { key: 'flagship', label: '3요소 ✨' },
];

export default function FieldNoteListCardLab() {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>('image');

  // 필터 = 회기 연결 축 (전체 / 회기 미지정). 분석 상태는 필터에서 빠지고 카드 strip·배지로.
  // 미지정 = linkKind === null (연결은 필수·이진·영구 속성). 신호정리·3요소 탭에 적용.
  const [linkFilter, setLinkFilter] = useState<'all' | 'unlinked'>('all');
  const unlinkedCount = NOTES.filter((n) => n.linkKind === null).length;
  const flatNotes = linkFilter === 'unlinked' ? NOTES.filter((n) => n.linkKind === null) : NOTES;
  const showFilter = tab === 'tidy' || tab === 'flagship';

  // 정리함(대안 뷰): 진행/일시정지 녹음 제외 + 챙길 것(미지정·실패) / 그 외
  const inboxNotes = NOTES.filter((n) => n.pipeline !== 'recording' && n.pipeline !== 'paused');
  const needAttention = inboxNotes.filter((n) => n.linkKind === null || n.pipeline === 'failed');
  const tidied = inboxNotes.filter((n) => !(n.linkKind === null || n.pipeline === 'failed'));

  return (
    <View style={{ flex: 1, backgroundColor: DK.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={{ height: s(52), flexDirection: 'row', alignItems: 'center', paddingHorizontal: s(12) }}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={10} style={{ width: s(40), height: s(40), alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="chevron-back" size={24} color={DK.text} />
          </TouchableOpacity>
          <Typography variant="headline-02" weight="bold" style={{ color: DK.text, marginLeft: s(2) }}>필드노트 목록 카드</Typography>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: s(8), paddingHorizontal: s(20), paddingTop: s(8), paddingBottom: s(6) }}>
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <Pressable key={t.key} onPress={() => setTab(t.key)} style={{ paddingHorizontal: s(14), paddingVertical: s(8), borderRadius: s(999), backgroundColor: active ? DK.accent : 'rgba(255,255,255,0.06)' }}>
                <Typography variant="label-01" weight="medium" style={{ color: active ? '#1A1626' : DK.sub }}>{t.label}</Typography>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* 필터 = 회기 연결 축 — 신호정리·3요소 탭에서만 (현재=production 축 유지, 정리함=그룹으로 대체) */}
        {showFilter ? (
          <View style={{ flexDirection: 'row', gap: s(8), paddingHorizontal: s(20), paddingTop: s(2), paddingBottom: s(8) }}>
            {([['all', '전체'], ['unlinked', '회기 미지정']] as const).map(([key, label]) => {
              const active = linkFilter === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => setLinkFilter(key)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: s(5), paddingHorizontal: s(13), paddingVertical: s(7), borderRadius: s(999), backgroundColor: active ? DK.accent + '26' : 'transparent', borderWidth: 1, borderColor: active ? 'transparent' : DK.line }}
                >
                  <Typography variant="label-01" weight="medium" style={{ color: active ? DK.accent : DK.sub }}>{label}</Typography>
                  {key === 'unlinked' ? (
                    <View style={{ minWidth: s(16), paddingHorizontal: s(4), borderRadius: s(8), backgroundColor: active ? DK.accent : 'rgba(255,255,255,0.1)', alignItems: 'center' }}>
                      <Typography variant="label-02" weight="semibold" style={{ color: active ? '#1A1626' : DK.sub }}>{unlinkedCount}</Typography>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <ScrollView contentContainerStyle={{ paddingHorizontal: s(20), paddingBottom: s(60) }} showsVerticalScrollIndicator={false}>
          {tab === 'image' ? (
            <ImageScreen />
          ) : tab === 'current' ? (
            <>
              <GroupedList notes={NOTES} render={(n) => <CurrentCard note={n} />} />
              <Verdict lines={[
                { tone: 'good', text: '검사 노트 미지정 버그는 수정 반영됨 — 이제 "홍길동 · HTP"로 표시(서버 task brief + isLinked=schedule||task).' },
                { tone: 'bad', text: '녹음/일시정지 노트: 같은 사실이 dot · "녹음중" 배지 · 제목 · 미리보기 4곳 반복.' },
                { tone: 'bad', text: 'play-circle 항상 노출(재생 오해). 진짜 미연결은 "미연결"이 제목+pill 두 번.' },
                { tone: 'bad', text: '케이스가 늘수록 우측 배지 종류만 늘어 "누구 회기인지"가 더 안 보임. → [3요소]로 해소.' },
              ]} />
            </>
          ) : tab === 'tidy' ? (
            <>
              <GroupedList notes={flatNotes} render={(n) => <TidyCard note={n} />} />
              <Verdict lines={[
                { tone: 'good', text: '정체성(누구·검사명) 1순위. 검사 노트는 블루 dot + 검사명 뱃지로 정상 표시.' },
                { tone: 'good', text: '우측은 단일 신호/액션 하나 — 녹음중/일시정지/분석중/회기 연결/다시 분석/분석 필요/완료(✨).' },
                { tone: 'good', text: 'play 제거. 미리보기는 실제 내용(요약·전사) 있을 때만 — 상태 문구 반복 안 함.' },
                { tone: 'note', text: '서버: 목록에 task brief(내담자·검사명) enrich + isLinked = schedule_id || task_id.' },
              ]} />
            </>
          ) : tab === 'inbox' ? (
            <>
              {needAttention.length > 0 ? (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6), paddingTop: s(14), paddingBottom: s(8) }}>
                    <Ionicons name="alert-circle" size={s(15)} color={DK.warning} />
                    <Typography variant="label-01" weight="semibold" style={{ color: DK.text }}>챙길 것</Typography>
                    <Typography variant="label-02" style={{ color: DK.sub }}>{needAttention.length}건</Typography>
                  </View>
                  {needAttention.map((n) => <InboxCard key={n.id} note={n} action />)}
                </>
              ) : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6), paddingTop: s(18), paddingBottom: s(8) }}>
                <Ionicons name="checkmark-done" size={s(15)} color={DK.sub} />
                <Typography variant="label-01" weight="semibold" style={{ color: DK.text }}>그 외</Typography>
                <Typography variant="label-02" style={{ color: DK.sub }}>{tidied.length}건</Typography>
              </View>
              {tidied.map((n) => <InboxCard key={n.id} note={n} action={false} />)}
              <Verdict lines={[
                { tone: 'note', text: '대안 뷰 — 필터는 회기 연결 축(전체/회기 미지정)으로 확정. 이건 필터 대신 "그룹"으로 보는 변형.' },
                { tone: 'good', text: '챙길 것(회기 미지정·실패)만 상단 존에 액션 버튼. 미분석은 "그 외"로 — 분석은 선택이라 강요 안 함.' },
                { tone: 'note', text: '"미연결"→"회기 미지정" 용어는 §3-4 ❓영역 — INFORMATION_SPEC 갱신 후 확정.' },
              ]} />
            </>
          ) : (
            <>
              <GroupedList notes={flatNotes} render={(n) => <FlagshipCard note={n} />} />
              <Verdict lines={[
                { tone: 'good', text: '필터(회기 연결 축) = 전체 / 회기 미지정. 분석 단계는 필터에서 빠지고 strip·배지로만 — 축이 깔끔해짐.' },
                { tone: 'good', text: '직관 — 좌측 strip: 빨강=진행 중 / 보라=처리 중 / 주황=챙길 것(회기 미지정·실패) / 무색=완료·전사만.' },
                { tone: 'good', text: '필수 — 챙길 것(주황)만 단일 액션(회기 연결·다시 분석). 분석은 선택이라 "분석하기"는 조용한 제안(주황 아님).' },
                { tone: 'good', text: '재미 — 녹음은 라이브 파형, 처리중은 펄스, 챙길 것 버튼은 호흡. 검사 노트는 블루 뱃지+상대시간으로 직관.' },
                { tone: 'note', text: '서버 갭: 목록에 task brief(내담자·검사명) enrich + isLinked=schedule||task. strip·필터는 클라 파생(추가 데이터 불필요).' },
              ]} />
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
