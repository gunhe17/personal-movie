import { useEffect, useRef, useState } from 'react';
import { View, ScrollView, Pressable, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '@/shared/constants/theme';
import { Typography } from '@/shared/components/ui/Typography';
import { s } from '@/shared/utils/scale';

/**
 * [필드노트 홈] 오늘 일정 카드 표면 — 높이 78 + 액션 버튼화 (탭 시안).
 *
 * 요청: 카드 높이 78 고정, 우측 액션을 제대로 된 버튼으로(녹음 시작 / 분석 보기),
 * 현재시간 비교해 진행 중 일정은 액티브(보라 그라데이션 보더) 강조.
 *
 * 결정(사용자 확정):
 *  - 두 버튼 + 상태칩 유지 — 미녹음=녹음 시작(블루), 분석완료=분석 보기(다크).
 *    녹음중·전사중은 버튼 아닌 작은 상태칩 유지.
 *  - 검사 카드는 펼침 유지(헤더만 78) — §3-4-2 검사=task 단위 연결.
 *
 * 탭:
 *  [현재]          production home.tsx 오늘 일정 카드 재현(컴팩트 한 줄·상태 텍스트·작은 녹음 pill, 고정 높이 없음).
 *  [신규 78·버튼]  카드 높이 78 + 카테고리 dot + 두 버튼(녹음 시작/분석 보기) + 상태칩, 진행 중 액티브 보더.
 *
 * mock 전용. 색은 COLORS.fieldnoteDark + 홈 오버라이드. 확정 시 home.tsx 오늘 일정 분기에 반영.
 */

const FN = COLORS.fieldnoteDark;
const FNP = COLORS.fieldnote;
// 홈 전용 오버라이드(production home.tsx와 동일)
const HOME_BG = '#040A17';
const HOME_CARD = '#252933';
// 진행 중('지금') 액티브 — 그라데이션 보더 + 보라 글로우
const NOW_BORDER_GRADIENT = ['#FFFFFF', '#7BBBFF', '#D6A0FF', '#EDD5FF'] as const;
const NOW_GLOW = '#BD38FF';
const TIME_NOW_COLOR = '#A8C5FF';
// 신규 버튼 색 (이미지 기준 — 블루 녹음 / 다크 분석)
const REC_BTN_BG = '#4B7BEC';
const VIEW_BTN_BG = '#363B45';
const VIEW_BTN_TX = '#D8DCE4';

type ActState = 'idle' | 'recording' | 'processing' | 'analyzed';
type TaskState = ActState | 'unlinked';
interface Task {
  id: string;
  name: string;
  method: 'onsite' | 'online';
  fn: TaskState;
}
interface Sess {
  id: string;
  kind: 'counseling' | 'assessment';
  time: string;
  client: string;
  program: string;
  room: string;
  phase: 'past' | 'now' | 'soon';
  act: ActState;
  tasks?: Task[];
}

const SESSIONS: Sess[] = [
  { id: 's1', kind: 'counseling', time: '09:00', client: '홍길동 외 1명', program: '놀이치료', room: '상담실 A', phase: 'past', act: 'analyzed' },
  { id: 's2', kind: 'counseling', time: '10:30', client: '김서연', program: '놀이치료', room: '상담실 A', phase: 'past', act: 'recording' },
  { id: 's3', kind: 'counseling', time: '11:30', client: '박도윤', program: '인지치료', room: '상담실 B', phase: 'past', act: 'processing' },
  { id: 's4', kind: 'counseling', time: '13:00', client: '이지후', program: '스마트폰중독 상담', room: '상담실 A', phase: 'soon', act: 'idle' },
  {
    id: 's5', kind: 'assessment', time: '15:00', client: '홍길동', program: 'HTP 외 4건', room: '상담실 A', phase: 'now', act: 'idle',
    tasks: [
      { id: 't1', name: 'HTP', method: 'onsite', fn: 'analyzed' },
      { id: 't2', name: 'SCT', method: 'onsite', fn: 'recording' },
      { id: 't3', name: 'BGT', method: 'onsite', fn: 'unlinked' },
      { id: 't4', name: '문장완성검사', method: 'online', fn: 'idle' },
    ],
  },
  { id: 's6', kind: 'counseling', time: '16:30', client: '최하준', program: '미술치료', room: '상담실 C', phase: 'soon', act: 'idle' },
];

function PulseDot({ size = 6, color = FN.accent }: { size?: number; color?: string }) {
  const p = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(p, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(p, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [p]);
  const scale = p.interpolate({ inputRange: [0, 1], outputRange: [1, 1.4] });
  const opacity = p.interpolate({ inputRange: [0, 1], outputRange: [1, 0.45] });
  return <Animated.View style={{ width: s(size), height: s(size), borderRadius: s(size / 2), backgroundColor: color, transform: [{ scale }], opacity }} />;
}

/** 진행 중('지금') 그라데이션 보더 링 — 카드보다 1px 크게 뒤에 깔아 가장자리만 노출 + 보라 글로우. */
function NowRing() {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute', top: -1, left: -1, right: -1, bottom: -1, borderRadius: s(15),
        shadowColor: NOW_GLOW, shadowOpacity: 0.25, shadowRadius: 11.4, shadowOffset: { width: 0, height: 0 },
      }}
    >
      <LinearGradient colors={NOW_BORDER_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, borderRadius: s(15) }} />
    </View>
  );
}

/** 카테고리 dot — 상담 그린 / 검사 블루 (이미지 신규안). */
function CategoryDot({ kind }: { kind: 'counseling' | 'assessment' }) {
  return <View style={{ width: s(7), height: s(7), borderRadius: s(4), backgroundColor: kind === 'assessment' ? COLORS.assessment : COLORS.counseling }} />;
}

/** 상태칩 — 녹음중(red)·전사중(purple). 버튼 아님(라이브/처리 표시). */
function StateChip({ kind }: { kind: 'recording' | 'processing' }) {
  const color = kind === 'recording' ? COLORS.error : FN.accent;
  const label = kind === 'recording' ? '녹음 중' : '전사 중';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(5), paddingHorizontal: s(9), paddingVertical: s(5), borderRadius: s(8), backgroundColor: color + '1F' }}>
      <PulseDot color={color} />
      <Typography variant="label-02" weight="medium" style={{ color }}>{label}</Typography>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// [현재] — production home.tsx 오늘 일정 카드 재현
// ─────────────────────────────────────────────────────────────
function CurrentCard({ sc, onBanner, expanded, onToggle }: { sc: Sess; onBanner: (m: string) => void; expanded: boolean; onToggle: () => void }) {
  const emphasized = sc.phase === 'now';
  const isPast = sc.phase === 'past';
  const isAssessment = sc.kind === 'assessment';
  const timeColor = emphasized ? TIME_NOW_COLOR : isPast ? FN.sub : FN.text;

  const right = () => {
    if (isAssessment) {
      return (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6) }}>
          {!expanded ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(4), backgroundColor: COLORS.assessment + '26', borderRadius: s(999), paddingHorizontal: s(10), paddingVertical: s(5) }}>
              <Ionicons name="clipboard-outline" size={s(12)} color={COLORS.assessment} />
              <Typography variant="label-02" weight="medium" style={{ color: COLORS.assessment }}>검사</Typography>
            </View>
          ) : null}
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={s(18)} color={FN.sub} />
        </View>
      );
    }
    if (sc.act === 'recording') {
      return (
        <Pressable onPress={() => onBanner(`${sc.client} 녹음 시트 열기`)} hitSlop={6} style={{ flexDirection: 'row', alignItems: 'center', gap: s(4) }}>
          <PulseDot color={COLORS.error} />
          <Typography variant="label-02" weight="medium" style={{ color: COLORS.error }}>녹음 중</Typography>
          <Ionicons name="chevron-forward" size={s(13)} color={COLORS.error} />
        </Pressable>
      );
    }
    if (sc.act === 'processing') {
      return (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(4) }}>
          <View style={{ width: s(6), height: s(6), borderRadius: s(3), backgroundColor: FN.accent }} />
          <Typography variant="label-02" weight="medium" style={{ color: FN.accent }}>전사 중</Typography>
        </View>
      );
    }
    if (sc.act === 'analyzed') {
      return (
        <Pressable onPress={() => onBanner(`${sc.client} 노트 열기`)} hitSlop={6} style={{ flexDirection: 'row', alignItems: 'center', gap: s(4) }}>
          <View style={{ width: s(6), height: s(6), borderRadius: s(3), backgroundColor: COLORS.palette.green }} />
          <Typography variant="label-02" weight="medium" style={{ color: FN.sub }}>분석완료</Typography>
          <Ionicons name="chevron-forward" size={s(13)} color={FN.sub} />
        </Pressable>
      );
    }
    return (
      <Pressable onPress={() => onBanner(`${sc.client} 회기 녹음 시작`)} style={{ flexDirection: 'row', alignItems: 'center', gap: s(5), backgroundColor: FNP, borderRadius: s(999), paddingHorizontal: s(12), paddingVertical: s(7) }}>
        <Ionicons name="mic" size={s(13)} color={COLORS.white} />
        <Typography variant="label-02" weight="semibold" style={{ color: COLORS.white }}>녹음</Typography>
      </Pressable>
    );
  };

  return (
    <View style={{ position: 'relative' }}>
      {emphasized ? <NowRing /> : null}
      <View style={{ borderRadius: s(14), backgroundColor: HOME_CARD, paddingHorizontal: s(14), paddingVertical: s(12), opacity: isPast ? 0.55 : 1 }}>
        <Pressable disabled={!isAssessment} onPress={onToggle} style={{ flexDirection: 'row', alignItems: 'center', gap: s(12) }}>
          <View style={{ width: s(42) }}>
            <Typography variant="label-01" weight="semibold" style={{ color: timeColor }}>{sc.time}</Typography>
            {emphasized ? <Typography variant="caption-01" weight="semibold" style={{ color: FN.accent }}>지금</Typography> : null}
          </View>
          <View style={{ flex: 1 }}>
            <Typography variant="body-03" weight="medium" style={{ color: FN.text }} numberOfLines={1}>{sc.client}</Typography>
            <Typography variant="caption-01" style={{ color: FN.sub }} numberOfLines={1}>{sc.program} · {sc.room}</Typography>
          </View>
          {right()}
        </Pressable>
        {isAssessment && expanded ? (
          <View style={{ marginTop: s(8), borderTopWidth: 1, borderTopColor: FN.line, paddingTop: s(4) }}>
            {sc.tasks!.map((t) => (
              <CurrentTaskRow key={t.id} task={t} onBanner={onBanner} />
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function CurrentTaskRow({ task, onBanner }: { task: Task; onBanner: (m: string) => void }) {
  const right = () => {
    switch (task.fn) {
      case 'analyzed':
        return <Typography variant="label-02" weight="medium" style={{ color: FN.accent }}>분석 보기 ›</Typography>;
      case 'recording':
        return <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(4) }}><PulseDot color={COLORS.error} /><Typography variant="label-02" weight="medium" style={{ color: COLORS.error }}>녹음중</Typography></View>;
      case 'unlinked':
        return (
          <Pressable onPress={() => onBanner(`${task.name} 녹음 연결`)} style={{ flexDirection: 'row', alignItems: 'center', gap: s(4), backgroundColor: FNP, borderRadius: s(999), paddingHorizontal: s(10), paddingVertical: s(5) }}>
            <Ionicons name="mic" size={s(11)} color={COLORS.white} />
            <Typography variant="label-02" weight="semibold" style={{ color: COLORS.white }}>녹음 연결</Typography>
          </Pressable>
        );
      default:
        return <Typography variant="label-02" style={{ color: FN.sub }}>온라인 · 녹음 안 함</Typography>;
    }
  };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8), paddingVertical: s(8) }}>
      <View style={{ width: s(5), height: s(5), borderRadius: s(3), backgroundColor: task.method === 'online' ? FN.sub : COLORS.assessment }} />
      <Typography variant="body-03" weight="medium" style={{ color: task.fn === 'idle' && task.method === 'online' ? FN.sub : FN.text, flex: 1 }}>{task.name}</Typography>
      {right()}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// [신규] — 높이 78 + 카테고리 dot + 버튼화
// ─────────────────────────────────────────────────────────────
function NewCard({ sc, onBanner, expanded, onToggle }: { sc: Sess; onBanner: (m: string) => void; expanded: boolean; onToggle: () => void }) {
  const emphasized = sc.phase === 'now';
  const isPast = sc.phase === 'past';
  const isAssessment = sc.kind === 'assessment';
  const timeColor = emphasized ? TIME_NOW_COLOR : isPast ? FN.sub : FN.text;

  const right = () => {
    if (isAssessment) {
      return (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8) }}>
          {!expanded ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(4), backgroundColor: COLORS.assessment + '26', borderRadius: s(8), paddingHorizontal: s(10), paddingVertical: s(6) }}>
              <Ionicons name="clipboard-outline" size={s(12)} color={COLORS.assessment} />
              <Typography variant="label-02" weight="medium" style={{ color: COLORS.assessment }}>검사 {sc.tasks!.filter((t) => t.method === 'onsite').length}</Typography>
            </View>
          ) : null}
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={s(18)} color={FN.sub} />
        </View>
      );
    }
    if (sc.act === 'recording') return <StateChip kind="recording" />;
    if (sc.act === 'processing') return <StateChip kind="processing" />;
    if (sc.act === 'analyzed') {
      return (
        <Pressable onPress={() => onBanner(`${sc.client} 분석 보기`)} style={{ flexDirection: 'row', alignItems: 'center', gap: s(4), backgroundColor: VIEW_BTN_BG, borderRadius: s(10), paddingHorizontal: s(14), paddingVertical: s(9) }}>
          <Typography variant="label-01" weight="semibold" style={{ color: VIEW_BTN_TX }}>분석 보기</Typography>
        </Pressable>
      );
    }
    return (
      <Pressable onPress={() => onBanner(`${sc.client} 녹음 시작`)} style={{ flexDirection: 'row', alignItems: 'center', gap: s(5), backgroundColor: REC_BTN_BG, borderRadius: s(10), paddingHorizontal: s(14), paddingVertical: s(9) }}>
        <Typography variant="label-01" weight="semibold" style={{ color: COLORS.white }}>녹음 시작</Typography>
      </Pressable>
    );
  };

  return (
    <View style={{ position: 'relative' }}>
      {emphasized ? <NowRing /> : null}
      <View style={{ borderRadius: s(14), backgroundColor: HOME_CARD, paddingHorizontal: s(14), opacity: isPast ? 0.6 : 1 }}>
        {/* 헤더 — 높이 78 고정, 세로 중앙 정렬 */}
        <Pressable disabled={!isAssessment} onPress={onToggle} style={{ height: s(78), flexDirection: 'row', alignItems: 'center', gap: s(12) }}>
          <View style={{ width: s(42) }}>
            <Typography variant="body-03" weight="semibold" style={{ color: timeColor }}>{sc.time}</Typography>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6) }}>
              <CategoryDot kind={sc.kind} />
              <Typography variant="body-02" weight="medium" style={{ color: FN.text, flex: 1 }} numberOfLines={1}>{sc.client}</Typography>
            </View>
            <Typography variant="label-01" style={{ color: FN.sub, marginTop: s(3) }} numberOfLines={1}>{sc.program} · {sc.room}</Typography>
          </View>
          {right()}
        </Pressable>
        {isAssessment && expanded ? (
          <View style={{ borderTopWidth: 1, borderTopColor: FN.line, paddingTop: s(4), paddingBottom: s(8) }}>
            {sc.tasks!.map((t) => (
              <CurrentTaskRow key={t.id} task={t} onBanner={onBanner} />
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function Verdict({ lines }: { lines: { tone: 'good' | 'bad' | 'note'; text: string }[] }) {
  const tint = { good: COLORS.success, bad: COLORS.error, note: FN.sub } as const;
  const icon = { good: 'checkmark-circle', bad: 'close-circle', note: 'ellipse' } as const;
  return (
    <View style={{ margin: s(20), padding: s(14), borderRadius: s(12), backgroundColor: 'rgba(255,255,255,0.04)', gap: s(8) }}>
      {lines.map((l, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: s(8) }}>
          <Ionicons name={icon[l.tone] as keyof typeof Ionicons.glyphMap} size={s(14)} color={tint[l.tone]} style={{ marginTop: s(2) }} />
          <Typography variant="body-03" style={{ color: FN.text, flex: 1, lineHeight: s(20) }}>{l.text}</Typography>
        </View>
      ))}
    </View>
  );
}

type TabKey = 'current' | 'next';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'current', label: '현재' },
  { key: 'next', label: '신규 78·버튼' },
];

export default function FieldNoteHomeCardsLab() {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>('next');
  const [open, setOpen] = useState<Record<string, boolean>>({ s5: true });
  const [banner, setBanner] = useState<string | null>(null);

  const onBanner = (m: string) => setBanner(m);
  const isNew = tab === 'next';

  return (
    <View style={{ flex: 1, backgroundColor: HOME_BG }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={{ height: s(52), flexDirection: 'row', alignItems: 'center', paddingHorizontal: s(12) }}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={{ width: s(40), height: s(40), alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="chevron-back" size={24} color={FN.text} />
          </Pressable>
          <Typography variant="headline-02" weight="bold" style={{ color: FN.text, marginLeft: s(2) }}>오늘 일정 카드 · 78·버튼</Typography>
        </View>

        <View style={{ flexDirection: 'row', gap: s(8), paddingHorizontal: s(20), paddingTop: s(8), paddingBottom: s(6) }}>
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <Pressable key={t.key} onPress={() => { setTab(t.key); setBanner(null); }} style={{ paddingHorizontal: s(14), paddingVertical: s(8), borderRadius: s(999), backgroundColor: active ? FN.accent : 'rgba(255,255,255,0.06)' }}>
                <Typography variant="label-01" weight="medium" style={{ color: active ? '#1A1626' : FN.sub }}>{t.label}</Typography>
              </Pressable>
            );
          })}
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: s(40) }} showsVerticalScrollIndicator={false}>
          <View style={{ paddingHorizontal: s(20), paddingTop: s(8) }}>
            <Typography variant="label-01" weight="semibold" style={{ color: FN.sub, marginBottom: s(8) }}>오늘 일정 {SESSIONS.length}</Typography>
          </View>

          {banner ? (
            <View style={{ marginHorizontal: s(20), marginBottom: s(8), padding: s(12), borderRadius: s(10), backgroundColor: HOME_CARD, flexDirection: 'row', alignItems: 'center', gap: s(8) }}>
              <Ionicons name="arrow-forward-circle" size={s(16)} color={FN.accent} />
              <Typography variant="body-03" style={{ color: FN.text, flex: 1 }}>{banner}</Typography>
            </View>
          ) : null}

          <View style={{ paddingHorizontal: s(20) }}>
            {SESSIONS.map((sc, i) => {
              const isLast = i === SESSIONS.length - 1;
              const emphasized = sc.phase === 'now';
              const isPast = sc.phase === 'past';
              const expanded = !!open[sc.id];
              const toggle = () => setOpen((o) => ({ ...o, [sc.id]: !o[sc.id] }));
              return (
                <View key={sc.id} style={{ flexDirection: 'row' }}>
                  {/* 타임라인 spine — dot 헤더 상단 정렬 + 연속 라인 */}
                  <View style={{ width: s(24), alignItems: 'center' }}>
                    <View style={{ width: s(2), height: s(22), backgroundColor: i === 0 ? 'transparent' : FN.line }} />
                    {emphasized ? (
                      <View style={{ width: s(16), height: s(16), borderRadius: s(8), backgroundColor: '#292E3B', alignItems: 'center', justifyContent: 'center' }}>
                        <View style={{ width: s(8), height: s(8), borderRadius: s(4), backgroundColor: '#648AE3' }} />
                      </View>
                    ) : (
                      <View style={{ width: s(9), height: s(9), borderRadius: s(5), backgroundColor: isPast ? FN.sub : FN.text }} />
                    )}
                    <View style={{ width: s(2), flex: 1, backgroundColor: isLast ? 'transparent' : FN.line }} />
                  </View>

                  {/* 카드 */}
                  <View style={{ flex: 1, paddingVertical: s(5), marginLeft: s(10) }}>
                    {isNew ? (
                      <NewCard sc={sc} onBanner={onBanner} expanded={expanded} onToggle={toggle} />
                    ) : (
                      <CurrentCard sc={sc} onBanner={onBanner} expanded={expanded} onToggle={toggle} />
                    )}
                  </View>
                </View>
              );
            })}
          </View>

          {isNew ? (
            <Verdict lines={[
              { tone: 'good', text: '카드 높이 78 고정 + 세로 중앙 정렬 — 한 줄 컴팩트보다 터치 타깃·가독성↑, 일정 리듬이 또렷.' },
              { tone: 'good', text: '우측 액션 버튼화 — 미녹음=녹음 시작(블루), 분석완료=분석 보기(다크). 무엇을 누를지 명확.' },
              { tone: 'good', text: '녹음중·전사중은 버튼 아닌 상태칩 유지(라이브/처리는 액션 아님) — 버튼 남발 방지.' },
              { tone: 'good', text: '진행 중(현재시간 ∈ 시작~종료)은 보라 그라데이션 보더로 액티브 — 검사 카드도 헤더 78 유지하며 펼침.' },
              { tone: 'note', text: '결정 포인트: 녹음 시작 색을 이미지대로 블루(#4B7BEC)로 둘지, 필드노트 정체성 보라(#9B5DFF)로 통일할지. 카테고리 dot(상담 그린·검사 블루) 신규 추가도 확정 필요.' },
            ]} />
          ) : (
            <Verdict lines={[
              { tone: 'note', text: '현재 production — 한 줄 컴팩트, 고정 높이 없음. 우측이 버튼이 아니라 상태 텍스트(분석완료·전사 중) + 작은 녹음 pill.' },
              { tone: 'bad', text: '"분석완료" 같은 상태 텍스트는 탭 가능한지 불명확 — 버튼처럼 안 읽힘.' },
              { tone: 'note', text: '진행 중 액티브 보더·검사 펼침은 이미 동작(신규안도 그대로 계승).' },
            ]} />
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
