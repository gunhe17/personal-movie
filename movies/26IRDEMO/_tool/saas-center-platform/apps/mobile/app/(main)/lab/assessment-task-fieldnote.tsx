import { useState, useEffect, useRef } from 'react';
import { View, ScrollView, TouchableOpacity, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, LAYOUT } from '@/shared/constants/theme';
import { Typography } from '@/shared/components/ui/Typography';
import { Icon } from '@/shared/components/icons';
import { s } from '@/shared/utils/scale';

/**
 * [검사 항목] 필드노트 연결 진입점 비교 lab.
 *
 * 결정 사항(백엔드 반영됨): 검사는 항목(task)마다 필드노트 연결 — `field_notes.task_id`.
 * API: PATCH /field-notes/{id}/link-task, GET /field-notes/by-task/{task_id}.
 *
 * 질문: 검사 항목 카드에 "필드노트 상태 + 녹음 연결"을 어떻게 얹나? 카드는 이미
 * (검사명 + 상태 뱃지 + 메뉴) + 구분선 + (소견 행) 구조라 과적재 주의.
 *
 * 필드노트 상태 5종을 한 화면에 보이게 mock 구성:
 *   완료(분석 보기) · 녹음중 · 분석중 · 미연결(녹음 연결) · 온라인검사(제외)
 *
 * 탭 — [현재] 소견 행만(대조군) / [한 행 통합] 필드노트+소견 한 줄 / [전용 행] 필드노트 별도 행.
 *
 * 필드노트 식별색은 보라(`COLORS.fieldnote`)를 아이콘/포인트에만 제한 사용.
 * 온라인 검사(execution_method=online)는 녹음 대상 아님 → 진입점 숨김.
 * "녹음 연결" 탭 동작은 단일 활성 녹음·미니바 흐름과 연결(여기선 mock 알림).
 *
 * 전부 mock. 확정 시 production assessment/[id].tsx TaskCard 에 반영.
 */

type TabKey = 'current' | 'merged' | 'dedicated' | 'chip' | 'zone' | 'chipPro' | 'intro';

const TABS: { key: TabKey; label: string; caption: string }[] = [
  {
    key: 'current',
    label: '현재',
    caption: '소견 행만 있는 현재 카드. 필드노트 진입점 없음(대조군).',
  },
  {
    key: 'merged',
    label: '한 행 통합',
    caption: '하단 한 줄을 좌(필드노트)·우(소견)로 나눔. 카드 높이 그대로, 밀도 높음.',
  },
  {
    key: 'dedicated',
    label: '전용 행',
    caption: '필드노트 전용 행을 소견 위에 추가. 상태가 또렷하지만 카드가 길어짐.',
  },
  {
    key: 'chip',
    label: '보이스 칩',
    caption: '헤더에 모핑 보이스 칩(미연결→녹음중 펄스·파형→분석→완료). 카드 높이 그대로 = 깔끔 + 재미 + 한눈에. — 권장',
  },
  {
    key: 'zone',
    label: '보이스 존',
    caption: '연한 보라 보이스 존 + 라이브 파형. 음성 영역임이 직관적이고 표현이 풍부, 대신 카드가 길어짐.',
  },
  {
    key: 'chipPro',
    label: '칩·상담사',
    caption: '적응형 칩 — 미연결은 조용한 마이크(소음↓), 녹음중은 카드까지 강조(검사 중 한눈에·큰 탭영역), 완료는 "분석" 명확. 검사 중/후 동선 모두 고려. (단, 미연결이 너무 조용해 첫 인지 약함)',
  },
  {
    key: 'intro',
    label: '도입(첫 인지)',
    caption: '신규 기능이라 발견성 우선 — 섹션 도입 힌트 + 라벨 "녹음" 칩으로 "검사에서 녹음 가능"을 인지시킴. 적응형 칩에 발견성 레이어를 얹은 버전. — 권장(도입기)',
  },
];

type FnState = 'none' | 'recording' | 'analyzing' | 'done' | 'online';

type TaskMock = {
  id: string;
  name: string;
  status: 'completed' | 'in_progress' | 'submitted' | 'pending';
  hasOpinion: boolean;
  fn: FnState;
  fnMeta?: string; // 녹음중 시간 / 완료 날짜 등
};

const TASKS: TaskMock[] = [
  { id: 't1', name: 'BGT (벤더게슈탈트)', status: 'completed', hasOpinion: true, fn: 'done', fnMeta: '12:04 녹음' },
  { id: 't2', name: 'Rorschach (로르샤흐)', status: 'in_progress', hasOpinion: false, fn: 'recording', fnMeta: '08:42' },
  { id: 't3', name: 'HTP (집-나무-사람)', status: 'submitted', hasOpinion: false, fn: 'analyzing' },
  { id: 't4', name: 'SCT (문장완성)', status: 'pending', hasOpinion: false, fn: 'none' },
  { id: 't5', name: 'K-WISC-V (온라인)', status: 'in_progress', hasOpinion: false, fn: 'online' },
];

const TASK_STATUS: Record<string, { label: string; bg: string; fg: string }> = {
  pending: { label: '예정', bg: COLORS.paletteBg.gray, fg: COLORS.palette.gray },
  in_progress: { label: '진행중', bg: COLORS.paletteBg.blue, fg: COLORS.palette.blue },
  submitted: { label: '제출됨', bg: COLORS.paletteBg.yellow, fg: COLORS.palette.yellow },
  completed: { label: '완료', bg: COLORS.paletteBg.green, fg: COLORS.palette.green },
};

// ──────────────── Page ────────────────

export default function AssessmentTaskFieldnoteLab() {
  const router = useRouter();
  const [tabKey, setTabKey] = useState<TabKey>('intro');
  const active = TABS.find((t) => t.key === tabKey)!;

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: COLORS.bg.base }} edges={['top']}>
      {/* 헤더 */}
      <View className="h-[52px] flex-row items-center px-5" style={{ backgroundColor: COLORS.bg.base }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} accessibilityLabel="뒤로 가기" accessibilityRole="button">
          <Icon name="arrow-left" size={24} color={COLORS.gray[900]} />
        </TouchableOpacity>
        <Typography variant="title-01" weight="semibold" className="ml-1.5 text-gray-900">
          검사 항목 · 필드노트 연결
        </Typography>
      </View>

      {/* 탭 pill */}
      <View style={{ paddingHorizontal: s(LAYOUT.screenPaddingX), paddingTop: s(8) }}>
        <View style={{ flexDirection: 'row', backgroundColor: COLORS.gray[50], borderRadius: s(10), padding: s(3) }}>
          {TABS.map((t) => {
            const on = t.key === tabKey;
            return (
              <TouchableOpacity
                key={t.key}
                activeOpacity={0.8}
                onPress={() => setTabKey(t.key)}
                style={{ flex: 1, paddingVertical: s(8), borderRadius: s(8), alignItems: 'center', backgroundColor: on ? COLORS.white : 'transparent' }}
              >
                <Typography variant="label-01" weight={on ? 'semibold' : 'medium'} style={{ color: on ? COLORS.gray[900] : COLORS.gray[500] }}>
                  {t.label}
                </Typography>
              </TouchableOpacity>
            );
          })}
        </View>
        <Typography variant="caption-01" className="text-gray-500" style={{ marginTop: s(8), paddingHorizontal: s(2) }}>
          {active.caption}
        </Typography>
      </View>

      <ScrollView style={{ backgroundColor: COLORS.white, marginTop: s(12) }} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={{ paddingTop: s(20), paddingBottom: s(24), paddingHorizontal: s(20) }}>
          <Typography variant="title-01" weight="semibold" className="text-gray-900" style={{ marginBottom: s(12) }}>
            검사 항목
          </Typography>
          {tabKey === 'intro' && <IntroHint />}
          <View style={{ gap: s(10) }}>
            {TASKS.map((task) => (
              <TaskCard key={task.id} task={task} variant={tabKey} />
            ))}
          </View>
        </View>

        {/* 판정 카드 */}
        <View style={{ marginHorizontal: s(20), marginTop: s(4) }}>
          <View style={{ backgroundColor: COLORS.primary50, borderRadius: s(16), padding: s(16), gap: s(6) }}>
            <Typography variant="label-01" weight="semibold" style={{ color: COLORS.primary700 }}>
              판정
            </Typography>
            <Typography variant="body-03" className="text-gray-700" style={{ lineHeight: 20 }}>
              핵심: 검사별 필드노트는 신규 기능이라 "검사에서 녹음이 가능하다"를 **인지시키는 게 1순위**.
              조용한 아이콘(칩·상담사)은 학습된 뒤엔 좋지만 첫 인지가 약함. 그래서 도입기엔 섹션 힌트 1줄 +
              라벨 "녹음" 칩으로 발견성을 확보(권장). 적응형 강조(녹음중 카드 강조)·동선·hitSlop은 그대로.
            </Typography>
            <Typography variant="body-03" className="text-gray-700" style={{ lineHeight: 20, marginTop: s(4) }}>
              정착 후엔 라벨→조용한 아이콘으로 점진 축소(소음↓), 섹션 힌트는 1회성/노트 0건일 때만. 칩이
              담는 건 "상태+단일 동작"뿐 — 나머지는 상세로. 온라인 검사는 숨김. "녹음"은 단일 활성 녹음·
              미니바와 연결, 정지=저장이라 검사 사이를 오가도 안전.
            </Typography>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ──────────────── TaskCard ────────────────

function TaskCard({ task, variant }: { task: TaskMock; variant: TabKey }) {
  const st = TASK_STATUS[task.status];
  const hasActions = task.status !== 'submitted' && task.status !== 'completed';
  // chipPro/intro: 녹음중인 검사는 카드까지 강조 — 검사 중 "어느 검사가 녹음 중"인지 한눈에
  const recEmphasis = (variant === 'chipPro' || variant === 'intro') && task.fn === 'recording';

  return (
    <View
      style={{
        backgroundColor: recEmphasis ? 'rgba(255,66,66,0.05)' : COLORS.gray[50],
        borderRadius: s(16),
        overflow: 'hidden',
      }}
    >
      {recEmphasis && (
        <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: s(3), backgroundColor: COLORS.error }} />
      )}
      {/* 상단: 검사명 + (보이스 칩) + 상태 뱃지 + 메뉴/화살표 */}
      <View style={{ paddingVertical: s(14), paddingHorizontal: s(16), flexDirection: 'row', alignItems: 'center' }}>
        <Typography
          variant="body-02"
          weight="semibold"
          className="flex-1 text-gray-900"
          numberOfLines={recEmphasis ? 1 : 2}
        >
          {task.name}
        </Typography>
        {variant === 'chip' && task.fn !== 'online' && (
          <View style={{ marginRight: s(8) }}>
            <VoiceChip state={task.fn} meta={task.fnMeta} />
          </View>
        )}
        {variant === 'chipPro' && task.fn !== 'online' && (
          <View style={{ marginRight: s(8) }}>
            <VoiceChipPro state={task.fn} meta={task.fnMeta} />
          </View>
        )}
        {variant === 'intro' && task.fn !== 'online' && (
          <View style={{ marginRight: s(8) }}>
            <VoiceChipPro state={task.fn} meta={task.fnMeta} discover />
          </View>
        )}
        <View style={{ backgroundColor: st.bg }} className="mr-2 rounded-full px-2.5 py-1">
          <Typography variant="label-02" weight="semibold" style={{ color: st.fg }}>
            {st.label}
          </Typography>
        </View>
        {hasActions ? (
          <Ionicons name="ellipsis-vertical" size={18} color={COLORS.gray[400]} />
        ) : (
          <Icon name="arrow-right" size={16} color={COLORS.gray[400]} />
        )}
      </View>

      {/* ───── 변형별 하단 ───── */}
      {variant === 'current' && <Divider />}
      {variant === 'current' && <OpinionRow hasOpinion={task.hasOpinion} />}

      {variant === 'merged' && <Divider />}
      {variant === 'merged' && (
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: s(16), paddingVertical: s(10) }}>
          <View style={{ flex: 1 }}>
            <FieldNoteInline state={task.fn} meta={task.fnMeta} />
          </View>
          <View style={{ width: 1, height: s(16), backgroundColor: COLORS.gray[200], marginHorizontal: s(12) }} />
          <OpinionInline hasOpinion={task.hasOpinion} />
        </View>
      )}

      {variant === 'dedicated' && task.fn !== 'online' && <Divider />}
      {variant === 'dedicated' && task.fn !== 'online' && <FieldNoteRow state={task.fn} meta={task.fnMeta} />}
      {variant === 'dedicated' && <Divider />}
      {variant === 'dedicated' && <OpinionRow hasOpinion={task.hasOpinion} />}
      {variant === 'dedicated' && task.fn === 'online' && (
        <View style={{ paddingHorizontal: s(16), paddingBottom: s(10), marginTop: s(-2) }}>
          <Typography variant="label-02" className="text-gray-400">
            온라인 검사 — 필드노트 녹음 대상이 아니에요
          </Typography>
        </View>
      )}

      {/* 보이스 칩 — 헤더에 얹고 하단은 소견만 (카드 높이 유지) */}
      {variant === 'chip' && <Divider />}
      {variant === 'chip' && <OpinionRow hasOpinion={task.hasOpinion} />}

      {/* 보이스 칩 (상담사 적응형) — 헤더 칩 + 하단 소견 */}
      {variant === 'chipPro' && <Divider />}
      {variant === 'chipPro' && <OpinionRow hasOpinion={task.hasOpinion} />}

      {/* 도입 — chipPro 와 동일 카드, 칩만 라벨형(discover) + 섹션 힌트는 리스트 상단 */}
      {variant === 'intro' && <Divider />}
      {variant === 'intro' && <OpinionRow hasOpinion={task.hasOpinion} />}

      {/* 보이스 존 — 연한 보라 영역 + 파형 */}
      {variant === 'zone' && task.fn !== 'online' && <VoiceZone state={task.fn} meta={task.fnMeta} />}
      {variant === 'zone' && <Divider />}
      {variant === 'zone' && <OpinionRow hasOpinion={task.hasOpinion} />}
    </View>
  );
}

function Divider() {
  return <View style={{ height: 1, backgroundColor: COLORS.gray[200], marginHorizontal: s(16) }} />;
}

// 소견 행 (현재 production 구조)
function OpinionRow({ hasOpinion }: { hasOpinion: boolean }) {
  return (
    <View style={{ paddingVertical: s(10), paddingHorizontal: s(16), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <View className="flex-row items-center" style={{ gap: s(6) }}>
        {hasOpinion ? (
          <>
            <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
            <Typography variant="label-01" weight="medium" style={{ color: COLORS.gray[600] }}>
              소견 작성됨
            </Typography>
          </>
        ) : (
          <Typography variant="label-01" weight="medium" style={{ color: COLORS.gray[400] }}>
            소견 미작성
          </Typography>
        )}
      </View>
      <View className="flex-row items-center" style={{ gap: s(2) }}>
        <Typography variant="label-01" weight="semibold" style={{ color: hasOpinion ? COLORS.gray[600] : COLORS.primary }}>
          {hasOpinion ? '소견 수정' : '소견 작성'}
        </Typography>
        <Icon name="arrow-right" size={12} color={hasOpinion ? COLORS.gray[600] : COLORS.primary} />
      </View>
    </View>
  );
}

function OpinionInline({ hasOpinion }: { hasOpinion: boolean }) {
  return (
    <TouchableOpacity className="flex-row items-center" style={{ gap: s(4) }} activeOpacity={0.7}>
      {hasOpinion && <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />}
      <Typography variant="label-01" weight="semibold" style={{ color: hasOpinion ? COLORS.gray[600] : COLORS.primary }}>
        {hasOpinion ? '소견' : '소견 작성'}
      </Typography>
    </TouchableOpacity>
  );
}

// ───── 필드노트 표현 ─────

/** 상태별 시각 정보 */
function fnVisual(state: FnState) {
  switch (state) {
    case 'done':
      return { icon: 'checkmark-circle' as const, color: COLORS.fieldnote, label: '분석 보기', sub: '필드노트 완료' };
    case 'recording':
      return { icon: 'radio-button-on' as const, color: COLORS.error, label: '녹음 중', sub: '필드노트' };
    case 'analyzing':
      return { icon: 'sync' as const, color: COLORS.fieldnote, label: '분석 중', sub: '필드노트' };
    case 'none':
    default:
      return { icon: 'mic' as const, color: COLORS.fieldnote, label: '녹음 연결', sub: '필드노트' };
  }
}

// 전용 행 — 좌: 상태/라벨, 우: 액션
function FieldNoteRow({ state, meta }: { state: FnState; meta?: string }) {
  const v = fnVisual(state);
  const isAction = state === 'none';
  const isLive = state === 'recording';
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={{ paddingVertical: s(10), paddingHorizontal: s(16), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
    >
      <View className="flex-row items-center" style={{ gap: s(6) }}>
        <Ionicons name={v.icon} size={14} color={v.color} />
        <Typography variant="label-01" weight="medium" style={{ color: COLORS.gray[600] }}>
          {v.sub}
        </Typography>
        {meta && (
          <Typography variant="label-02" style={{ color: isLive ? COLORS.error : COLORS.gray[400] }}>
            {meta}
          </Typography>
        )}
      </View>
      <View className="flex-row items-center" style={{ gap: s(2) }}>
        <Typography variant="label-01" weight="semibold" style={{ color: isAction || isLive ? v.color : COLORS.gray[600] }}>
          {v.label}
        </Typography>
        {(isAction || state === 'done') && <Icon name="arrow-right" size={12} color={isAction ? v.color : COLORS.gray[600]} />}
      </View>
    </TouchableOpacity>
  );
}

// 한 행 통합용 — 컴팩트 인라인
function FieldNoteInline({ state, meta }: { state: FnState; meta?: string }) {
  if (state === 'online') {
    return (
      <Typography variant="label-02" className="text-gray-400" numberOfLines={1}>
        온라인 — 녹음 불가
      </Typography>
    );
  }
  const v = fnVisual(state);
  const isLive = state === 'recording';
  return (
    <TouchableOpacity className="flex-row items-center" style={{ gap: s(4) }} activeOpacity={0.7}>
      <Ionicons name={v.icon} size={14} color={v.color} />
      <Typography variant="label-01" weight="semibold" style={{ color: state === 'none' || isLive ? v.color : COLORS.gray[600] }} numberOfLines={1}>
        {v.label}
      </Typography>
      {meta && isLive && (
        <Typography variant="label-02" style={{ color: COLORS.error }}>
          {meta}
        </Typography>
      )}
    </TouchableOpacity>
  );
}

// ───── 개선안 공통: 파형 · 펄스 ─────

const STATIC_WAVE = [0.4, 0.7, 0.5, 0.95, 0.6, 1, 0.45, 0.8, 0.5, 0.7, 0.55, 0.85, 0.5, 0.75, 0.45, 0.9, 0.6, 0.7];

/** 음성 파형 바. mode: live(애니메이션) | static(고정 패턴) */
function WaveBars({
  count = 12,
  color,
  mode,
  height = 16,
  barWidth = 2.5,
  gap = 2.5,
}: {
  count?: number;
  color: string;
  mode: 'live' | 'static';
  height?: number;
  barWidth?: number;
  gap?: number;
}) {
  const animsRef = useRef(Array.from({ length: count }, () => new Animated.Value(0.4)));
  const anims = animsRef.current;

  useEffect(() => {
    if (mode !== 'live') return;
    const loops = anims.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay((i % 5) * 60),
          Animated.timing(v, { toValue: 1, duration: 300, useNativeDriver: false }),
          Animated.timing(v, { toValue: 0.3, duration: 300, useNativeDriver: false }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [mode, anims]);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap, height }}>
      {anims.map((v, i) => {
        const h =
          mode === 'live'
            ? v.interpolate({ inputRange: [0, 1], outputRange: [height * 0.22, height] })
            : height * STATIC_WAVE[i % STATIC_WAVE.length];
        return (
          <Animated.View
            key={i}
            style={{ width: barWidth, height: h, borderRadius: barWidth, backgroundColor: color }}
          />
        );
      })}
    </View>
  );
}

/** 녹음 중 펄스 점 */
function PulseDot({ color, size = 8 }: { color: string; size?: number }) {
  const a = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(a, { toValue: 0.3, duration: 650, useNativeDriver: true }),
        Animated.timing(a, { toValue: 1, duration: 650, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [a]);
  return (
    <Animated.View
      style={{ width: size, height: size, borderRadius: size, backgroundColor: color, opacity: a }}
    />
  );
}

// fieldnote 정체성 틴트 (lab — DS 외 임시 알파)
const FN_TINT = 'rgba(155,93,255,0.10)';
const FN_TINT_SOFT = 'rgba(155,93,255,0.06)';
const REC_TINT = 'rgba(255,66,66,0.10)';

// ───── 개선안 A: 보이스 칩 (헤더 모핑) ─────

function VoiceChip({ state, meta }: { state: FnState; meta?: string }) {
  if (state === 'recording') {
    return (
      <View
        style={{ flexDirection: 'row', alignItems: 'center', gap: s(5), paddingHorizontal: s(8), paddingVertical: s(4), borderRadius: 999, backgroundColor: REC_TINT }}
      >
        <PulseDot color={COLORS.error} size={s(7)} />
        <WaveBars count={4} color={COLORS.error} mode="live" height={s(11)} barWidth={s(2)} gap={s(1.5)} />
        <Typography variant="label-02" weight="semibold" style={{ color: COLORS.error }}>
          {meta}
        </Typography>
      </View>
    );
  }
  if (state === 'analyzing') {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(4), paddingHorizontal: s(8), paddingVertical: s(4), borderRadius: 999, backgroundColor: FN_TINT }}>
        <Ionicons name="sync" size={12} color={COLORS.fieldnote} />
        <Typography variant="label-02" weight="semibold" style={{ color: COLORS.fieldnote }}>
          분석 중
        </Typography>
      </View>
    );
  }
  if (state === 'done') {
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        style={{ flexDirection: 'row', alignItems: 'center', gap: s(4), paddingHorizontal: s(8), paddingVertical: s(4), borderRadius: 999, backgroundColor: FN_TINT }}
      >
        <Ionicons name="checkmark-circle" size={12} color={COLORS.fieldnote} />
        <WaveBars count={4} color={COLORS.fieldnote} mode="static" height={s(11)} barWidth={s(2)} gap={s(1.5)} />
      </TouchableOpacity>
    );
  }
  // none
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={{ flexDirection: 'row', alignItems: 'center', gap: s(4), paddingHorizontal: s(8), paddingVertical: s(4), borderRadius: 999, backgroundColor: FN_TINT }}
    >
      <Ionicons name="mic" size={12} color={COLORS.fieldnote} />
      <Typography variant="label-02" weight="semibold" style={{ color: COLORS.fieldnote }}>
        녹음
      </Typography>
    </TouchableOpacity>
  );
}

// ───── 개선안 C: 보이스 칩 (상담사 적응형) ─────
// 미연결=조용한 마이크(소음↓) · 녹음중=확장 펄스·파형+시간 · 분석중 · 완료="분석"(탭=보기)
// 모든 탭 동작은 hitSlop 으로 44pt 확보.

const CHIP_HIT = { top: 12, bottom: 12, left: 10, right: 10 };

function VoiceChipPro({ state, meta, discover = false }: { state: FnState; meta?: string; discover?: boolean }) {
  if (state === 'recording') {
    return (
      <View
        style={{ flexDirection: 'row', alignItems: 'center', gap: s(5), paddingHorizontal: s(9), paddingVertical: s(5), borderRadius: 999, backgroundColor: REC_TINT }}
      >
        <PulseDot color={COLORS.error} size={s(7)} />
        <WaveBars count={3} color={COLORS.error} mode="live" height={s(11)} barWidth={s(2)} gap={s(1.5)} />
        <Typography variant="label-02" weight="semibold" style={{ color: COLORS.error }}>
          {meta}
        </Typography>
      </View>
    );
  }
  if (state === 'analyzing') {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(4), paddingHorizontal: s(8), paddingVertical: s(4), borderRadius: 999, backgroundColor: FN_TINT }}>
        <Ionicons name="sync" size={12} color={COLORS.fieldnote} />
        <Typography variant="label-02" weight="semibold" style={{ color: COLORS.fieldnote }}>
          분석 중
        </Typography>
      </View>
    );
  }
  if (state === 'done') {
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        hitSlop={CHIP_HIT}
        accessibilityLabel="필드노트 분석 보기"
        accessibilityRole="button"
        style={{ flexDirection: 'row', alignItems: 'center', gap: s(4), paddingHorizontal: s(9), paddingVertical: s(4), borderRadius: 999, backgroundColor: FN_TINT }}
      >
        <Ionicons name="document-text" size={12} color={COLORS.fieldnote} />
        <Typography variant="label-02" weight="semibold" style={{ color: COLORS.fieldnote }}>
          분석
        </Typography>
      </TouchableOpacity>
    );
  }
  // none(도입기, discover) — 라벨 "녹음" 칩으로 "검사에서 녹음 가능"을 인지시킴.
  if (discover) {
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        hitSlop={CHIP_HIT}
        accessibilityLabel="이 검사 녹음 연결"
        accessibilityRole="button"
        style={{ flexDirection: 'row', alignItems: 'center', gap: s(4), paddingHorizontal: s(9), paddingVertical: s(5), borderRadius: 999, backgroundColor: FN_TINT }}
      >
        <Ionicons name="mic" size={13} color={COLORS.fieldnote} />
        <Typography variant="label-02" weight="semibold" style={{ color: COLORS.fieldnote }}>
          녹음
        </Typography>
      </TouchableOpacity>
    );
  }
  // none(정착기) — 조용한 마이크(아이콘 only). 안 쓰는 검사에 시각 소음 최소, 탭영역은 hitSlop 으로 확보.
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      hitSlop={CHIP_HIT}
      accessibilityLabel="이 검사 녹음 연결"
      accessibilityRole="button"
      style={{ width: s(28), height: s(28), borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: FN_TINT }}
    >
      <Ionicons name="mic" size={15} color={COLORS.fieldnote} />
    </TouchableOpacity>
  );
}

// 섹션 도입 힌트 — 신규 기능 첫 인지용 (검사 항목 리스트 상단 1회성 톤)
function IntroHint() {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: s(8),
        backgroundColor: FN_TINT_SOFT,
        borderRadius: s(12),
        paddingHorizontal: s(12),
        paddingVertical: s(10),
        marginBottom: s(12),
      }}
    >
      <Ionicons name="mic" size={16} color={COLORS.fieldnote} />
      <Typography variant="label-01" className="flex-1" style={{ color: COLORS.gray[700] }}>
        검사마다 음성을 기록해 자동으로 정리할 수 있어요. 투사검사에 특히 유용해요.
      </Typography>
    </View>
  );
}

// ───── 개선안 B: 보이스 존 (연한 보라 영역 + 파형) ─────

function VoiceZone({ state, meta }: { state: FnState; meta?: string }) {
  const live = state === 'recording';
  const tint = live ? REC_TINT : FN_TINT_SOFT;
  const accent = live ? COLORS.error : COLORS.fieldnote;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      style={{ backgroundColor: tint, paddingHorizontal: s(16), paddingVertical: s(12), flexDirection: 'row', alignItems: 'center', gap: s(10) }}
    >
      {live ? (
        <PulseDot color={COLORS.error} size={s(8)} />
      ) : (
        <Ionicons
          name={state === 'done' ? 'checkmark-circle' : state === 'analyzing' ? 'sync' : 'mic'}
          size={16}
          color={accent}
        />
      )}

      <View style={{ flex: 1 }}>
        {state === 'none' ? (
          <Typography variant="label-01" weight="semibold" style={{ color: COLORS.fieldnote }}>
            녹음 연결
          </Typography>
        ) : state === 'analyzing' ? (
          <WaveBars count={18} color={COLORS.fieldnote} mode="live" height={s(16)} />
        ) : live ? (
          <WaveBars count={18} color={COLORS.error} mode="live" height={s(16)} />
        ) : (
          <WaveBars count={18} color={COLORS.fieldnote} mode="static" height={s(16)} />
        )}
      </View>

      <View className="flex-row items-center" style={{ gap: s(4) }}>
        <Typography variant="label-01" weight="semibold" style={{ color: accent }}>
          {state === 'recording'
            ? meta
            : state === 'analyzing'
              ? '분석 중'
              : state === 'done'
                ? '분석 보기'
                : ''}
        </Typography>
        {(state === 'none' || state === 'done') && (
          <Icon name="arrow-right" size={12} color={state === 'none' ? COLORS.fieldnote : COLORS.fieldnote} />
        )}
      </View>
    </TouchableOpacity>
  );
}
