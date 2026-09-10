import { useEffect, useRef, useState } from 'react';
import { View, ScrollView, Pressable, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/shared/constants/theme';
import { Typography } from '@/shared/components/ui/Typography';
import { s } from '@/shared/utils/scale';

/**
 * [필드노트 홈] 검사 세션 = 검사별 필드노트 — 타임라인에 녹여내기 (탭 시안).
 *
 * 갭: 상담은 회기 1개 = 필드노트 1개(단순). 검사는 세션(일정) 1개 안에 검사(task) N개 →
 * 검사별 필드노트 N개(§3-4-2). 현재 홈 타임라인은 검사를 "검사" 뱃지 하나로 뭉개 검사별
 * 녹음/연결을 못 한다. 검사별 필드노트 상태(완료·녹음중·미연결·온라인 제외)를 어떻게 노출할지.
 *
 * 탭:
 *  [현재]     검사 = "검사" 뱃지 하나(대조군, 갭 노출).
 *  [확장 카드] 검사 세션 카드 탭 → 검사 task 서브행 펼침(녹음/상태/연결). 평소엔 요약(검사 N·녹음 M).
 *  [펼친 행]   검사 task 를 항상 서브행으로 노출(토글 없음). 밀도↑·한눈에.
 *
 * mock 전용. 색은 COLORS.fieldnoteDark. 확정 시 home.tsx 오늘 일정 검사 분기에 반영.
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
  assess: COLORS.assessment,
} as const;
const FNP = COLORS.fieldnote;

type FnState = 'analyzed' | 'recording' | 'analyzing' | 'unlinked' | 'na';
interface Task {
  id: string;
  name: string;
  method: 'onsite' | 'online';
  fn: FnState;
}
interface Sess {
  id: string;
  kind: 'counseling' | 'assessment';
  time: string;
  client: string;
  program: string;
  room: string;
  phase: 'past' | 'now' | 'soon';
  tasks?: Task[];
}

const SESSIONS: Sess[] = [
  { id: 's1', kind: 'counseling', time: '09:00', client: '이서연 외 1명', program: '놀이치료', room: '상담실 A', phase: 'past' },
  {
    id: 's2', kind: 'assessment', time: '10:30', client: '홍길동', program: '종합심리평가', room: '상담실 B', phase: 'now',
    tasks: [
      { id: 't1', name: 'HTP', method: 'onsite', fn: 'analyzed' },
      { id: 't2', name: 'SCT', method: 'onsite', fn: 'recording' },
      { id: 't3', name: 'BGT', method: 'onsite', fn: 'unlinked' },
      { id: 't4', name: '문장완성검사', method: 'online', fn: 'na' },
    ],
  },
  { id: 's3', kind: 'counseling', time: '14:00', client: '박도윤', program: '인지치료', room: '상담실 A', phase: 'soon' },
];

function PulseDot({ size = 6, color = DK.accent }: { size?: number; color?: string }) {
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

/** 검사 task 한 줄 — 검사명 + 필드노트 상태/액션 (§3-4-2/§3-4-3). */
function TaskRow({ task, onBanner }: { task: Task; onBanner: (m: string) => void }) {
  const right = () => {
    switch (task.fn) {
      case 'analyzed':
        return (
          <Pressable onPress={() => onBanner(`${task.name} 분석 보기`)} hitSlop={6} style={{ flexDirection: 'row', alignItems: 'center', gap: s(3) }}>
            <Ionicons name="sparkles" size={s(12)} color={DK.accent} />
            <Typography variant="label-02" weight="medium" style={{ color: DK.accent }}>분석 보기</Typography>
            <Ionicons name="chevron-forward" size={s(12)} color={DK.accent} />
          </Pressable>
        );
      case 'recording':
        return (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(4), paddingHorizontal: s(7), paddingVertical: s(2), borderRadius: s(8), backgroundColor: DK.error + '1F' }}>
            <PulseDot color={DK.error} />
            <Typography variant="label-02" weight="medium" style={{ color: DK.error }}>녹음중</Typography>
          </View>
        );
      case 'analyzing':
        return (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(4), paddingHorizontal: s(7), paddingVertical: s(2), borderRadius: s(8), backgroundColor: DK.accent + '1F' }}>
            <PulseDot color={DK.accent} />
            <Typography variant="label-02" weight="medium" style={{ color: DK.accent }}>분석중</Typography>
          </View>
        );
      case 'unlinked':
        return (
          <Pressable onPress={() => onBanner(`${task.name} 녹음 연결 → start(…, task=${task.id})`)} style={{ flexDirection: 'row', alignItems: 'center', gap: s(4), backgroundColor: FNP, borderRadius: s(999), paddingHorizontal: s(11), paddingVertical: s(6) }}>
            <Ionicons name="mic" size={s(12)} color={COLORS.white} />
            <Typography variant="label-02" weight="semibold" style={{ color: COLORS.white }}>녹음 연결</Typography>
          </Pressable>
        );
      case 'na':
        return <Typography variant="label-02" style={{ color: DK.sub }}>온라인 · 녹음 안 함</Typography>;
    }
  };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8), paddingVertical: s(8) }}>
      <View style={{ width: s(5), height: s(5), borderRadius: s(3), backgroundColor: task.method === 'online' ? DK.sub : DK.assess }} />
      <Typography variant="body-03" weight="medium" style={{ color: task.fn === 'na' ? DK.sub : DK.text, flex: 1 }}>{task.name}</Typography>
      {right()}
    </View>
  );
}

function taskSummary(tasks: Task[]): string {
  const total = tasks.length;
  const done = tasks.filter((t) => t.fn === 'analyzed').length;
  const rec = tasks.filter((t) => t.fn === 'recording' || t.fn === 'analyzing').length;
  if (rec > 0) return `검사 ${total} · 녹음중 ${rec}`;
  return `검사 ${total} · 분석 ${done}/${tasks.filter((t) => t.method === 'onsite').length}`;
}

// ── 카드 본문 (시간·내담자·프로그램) ──
function CardHead({ sc, emphasized }: { sc: Sess; emphasized: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(12) }}>
      <View style={{ width: s(42) }}>
        <Typography variant="label-01" weight="semibold" style={{ color: emphasized ? '#A8C5FF' : DK.text }}>{sc.time}</Typography>
        {emphasized ? <Typography variant="caption-01" weight="semibold" style={{ color: DK.accent }}>지금</Typography> : null}
      </View>
      <View style={{ flex: 1 }}>
        <Typography variant="body-03" weight="medium" style={{ color: DK.text }} numberOfLines={1}>{sc.client}</Typography>
        <Typography variant="caption-01" style={{ color: DK.sub }} numberOfLines={1}>{sc.program} · {sc.room}</Typography>
      </View>
    </View>
  );
}

function Verdict({ lines }: { lines: { tone: 'good' | 'bad' | 'note'; text: string }[] }) {
  const tint = { good: COLORS.success, bad: DK.error, note: DK.sub } as const;
  const icon = { good: 'checkmark-circle', bad: 'close-circle', note: 'ellipse' } as const;
  return (
    <View style={{ margin: s(20), padding: s(14), borderRadius: s(12), backgroundColor: 'rgba(255,255,255,0.04)', gap: s(8) }}>
      {lines.map((l, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: s(8) }}>
          <Ionicons name={icon[l.tone] as keyof typeof Ionicons.glyphMap} size={s(14)} color={tint[l.tone]} style={{ marginTop: s(2) }} />
          <Typography variant="body-03" style={{ color: DK.text, flex: 1, lineHeight: s(20) }}>{l.text}</Typography>
        </View>
      ))}
    </View>
  );
}

type TabKey = 'current' | 'expand' | 'inline';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'current', label: '현재' },
  { key: 'expand', label: '확장 카드' },
  { key: 'inline', label: '펼친 행' },
];

export default function FieldNoteHomeAssessmentLab() {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>('expand');
  const [open, setOpen] = useState<Record<string, boolean>>({ s2: true });
  const [banner, setBanner] = useState<string | null>(null);

  const onBanner = (m: string) => setBanner(m);

  return (
    <View style={{ flex: 1, backgroundColor: DK.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={{ height: s(52), flexDirection: 'row', alignItems: 'center', paddingHorizontal: s(12) }}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={{ width: s(40), height: s(40), alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="chevron-back" size={24} color={DK.text} />
          </Pressable>
          <Typography variant="headline-02" weight="bold" style={{ color: DK.text, marginLeft: s(2) }}>검사 세션 · 검사별 노트</Typography>
        </View>

        <View style={{ flexDirection: 'row', gap: s(8), paddingHorizontal: s(20), paddingTop: s(8), paddingBottom: s(6) }}>
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <Pressable key={t.key} onPress={() => { setTab(t.key); setBanner(null); }} style={{ paddingHorizontal: s(14), paddingVertical: s(8), borderRadius: s(999), backgroundColor: active ? DK.accent : 'rgba(255,255,255,0.06)' }}>
                <Typography variant="label-01" weight="medium" style={{ color: active ? '#1A1626' : DK.sub }}>{t.label}</Typography>
              </Pressable>
            );
          })}
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: s(40) }} showsVerticalScrollIndicator={false}>
          <View style={{ paddingHorizontal: s(20), paddingTop: s(8) }}>
            <Typography variant="label-01" weight="semibold" style={{ color: DK.sub, marginBottom: s(8) }}>오늘 일정 {SESSIONS.length}</Typography>
          </View>

          {banner ? (
            <View style={{ marginHorizontal: s(20), marginBottom: s(8), padding: s(12), borderRadius: s(10), backgroundColor: DK.card, flexDirection: 'row', alignItems: 'center', gap: s(8) }}>
              <Ionicons name="arrow-forward-circle" size={s(16)} color={DK.accent} />
              <Typography variant="body-03" style={{ color: DK.text, flex: 1 }}>{banner}</Typography>
            </View>
          ) : null}

          <View style={{ paddingHorizontal: s(20) }}>
            {SESSIONS.map((sc, i) => {
              const isLast = i === SESSIONS.length - 1;
              const emphasized = sc.phase === 'now';
              const isPast = sc.phase === 'past';
              const isAssessment = sc.kind === 'assessment';
              const expanded = !!open[sc.id];
              return (
                <View key={sc.id} style={{ flexDirection: 'row' }}>
                  {/* 타임라인 spine — dot 상단(헤더) 정렬 + 연속 라인 */}
                  <View style={{ width: s(24), alignItems: 'center' }}>
                    <View style={{ width: s(2), height: s(22), backgroundColor: i === 0 ? 'transparent' : DK.line }} />
                    {emphasized ? (
                      <View style={{ width: s(16), height: s(16), borderRadius: s(8), backgroundColor: '#292E3B', alignItems: 'center', justifyContent: 'center' }}>
                        <View style={{ width: s(8), height: s(8), borderRadius: s(4), backgroundColor: '#648AE3' }} />
                      </View>
                    ) : (
                      <View style={{ width: s(9), height: s(9), borderRadius: s(5), backgroundColor: isPast ? DK.sub : DK.text }} />
                    )}
                    <View style={{ width: s(2), flex: 1, backgroundColor: isLast ? 'transparent' : DK.line }} />
                  </View>

                  {/* 카드 */}
                  <View style={{ flex: 1, paddingBottom: s(10) }}>
                    <View style={{ borderRadius: s(14), backgroundColor: DK.card, paddingHorizontal: s(14), paddingVertical: s(12), borderWidth: emphasized ? 1 : 0, borderColor: DK.accent + '66', opacity: isPast ? 0.6 : 1 }}>
                      {/* 헤더 행 */}
                      {isAssessment && tab !== 'inline' ? (
                        <Pressable
                          onPress={() => tab === 'expand' ? setOpen((o) => ({ ...o, [sc.id]: !o[sc.id] })) : onBanner('검사 상세로 이동')}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: s(12) }}
                        >
                          <View style={{ flex: 1 }}>
                            <CardHead sc={sc} emphasized={emphasized} />
                          </View>
                          {tab === 'current' ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(4), backgroundColor: DK.assess + '26', borderRadius: s(999), paddingHorizontal: s(10), paddingVertical: s(5) }}>
                              <Ionicons name="clipboard-outline" size={s(12)} color={DK.assess} />
                              <Typography variant="label-02" weight="medium" style={{ color: DK.assess }}>검사</Typography>
                            </View>
                          ) : (
                            <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={s(18)} color={DK.sub} />
                          )}
                        </Pressable>
                      ) : (
                        <CardHead sc={sc} emphasized={emphasized} />
                      )}

                      {/* 검사 요약 줄 (확장 카드, 접힘 상태) */}
                      {isAssessment && tab === 'expand' && !expanded ? (
                        <Typography variant="label-01" style={{ color: DK.sub, marginTop: s(8) }}>{taskSummary(sc.tasks!)}</Typography>
                      ) : null}

                      {/* 상담 — 단순 상태/녹음 (검사 아님) */}
                      {!isAssessment ? (
                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: s(8) }}>
                          {isPast ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(4) }}>
                              <View style={{ width: s(6), height: s(6), borderRadius: s(3), backgroundColor: COLORS.palette.green }} />
                              <Typography variant="label-02" weight="medium" style={{ color: DK.sub }}>분석완료</Typography>
                            </View>
                          ) : (
                            <Pressable onPress={() => onBanner(`${sc.client} 회기 녹음 → start(…, schedule=${sc.id})`)} style={{ flexDirection: 'row', alignItems: 'center', gap: s(5), backgroundColor: FNP, borderRadius: s(999), paddingHorizontal: s(12), paddingVertical: s(7) }}>
                              <Ionicons name="mic" size={s(13)} color={COLORS.white} />
                              <Typography variant="label-02" weight="semibold" style={{ color: COLORS.white }}>녹음</Typography>
                            </Pressable>
                          )}
                        </View>
                      ) : null}

                      {/* 검사 task 서브행 — 확장(열림) 또는 펼친 행 */}
                      {isAssessment && (tab === 'inline' || (tab === 'expand' && expanded)) ? (
                        <View style={{ marginTop: s(8), borderTopWidth: 1, borderTopColor: DK.line, paddingTop: s(4) }}>
                          {sc.tasks!.map((t) => (
                            <TaskRow key={t.id} task={t} onBanner={onBanner} />
                          ))}
                        </View>
                      ) : null}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>

          {tab === 'current' ? (
            <Verdict lines={[
              { tone: 'bad', text: '검사 세션이 "검사" 뱃지 하나로 뭉뚱그려짐 — 세션 안에 HTP·SCT·BGT 등 검사별 필드노트가 N개인데 홈에서 안 보임.' },
              { tone: 'bad', text: '검사별 녹음 연결/상태를 홈에서 못 함 → 검사 상세까지 들어가야만 가능.' },
              { tone: 'note', text: '상담(회기=노트 1개)과 검사(세션⊃검사 task N)의 구조 차이를 홈이 반영 못 함.' },
            ]} />
          ) : tab === 'expand' ? (
            <Verdict lines={[
              { tone: 'good', text: '검사 세션 카드 탭 → 검사 task 서브행 펼침. 평소엔 "검사 N · 녹음 M" 요약으로 압축(밀도 관리).' },
              { tone: 'good', text: '검사별 필드노트 상태/액션을 홈에서 바로 — 완료(분석 보기)·녹음중·미연결(녹음 연결)·온라인(녹음 안 함).' },
              { tone: 'good', text: '상담 카드는 단순(회기=노트 1개) 유지. 검사만 확장 — 구조 차이를 그대로 반영.' },
              { tone: 'note', text: '서버: task별 필드노트 상태 묶음(검사 세션→task 목록+각 fn 상태)이 홈 응답에 필요(useFieldNotesByTask 재사용 가능).' },
            ]} />
          ) : (
            <Verdict lines={[
              { tone: 'good', text: '검사 task 를 항상 서브행으로 — 토글 없이 한눈에. 오늘 검사 적을 때 빠름.' },
              { tone: 'bad', text: '검사 많거나 풀배터리면 타임라인이 길어져 상담 회기가 묻힘 — 밀도 부담.' },
              { tone: 'note', text: '절충: 기본 접힘(확장 카드) + 진행 중 세션만 자동 펼침 같은 하이브리드도 가능.' },
            ]} />
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
