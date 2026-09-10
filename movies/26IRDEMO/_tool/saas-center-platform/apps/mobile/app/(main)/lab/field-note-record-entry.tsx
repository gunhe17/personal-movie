import { useEffect, useRef, useState } from 'react';
import { View, ScrollView, Pressable, TextInput, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/shared/constants/theme';
import { Typography } from '@/shared/components/ui/Typography';
import { s } from '@/shared/utils/scale';

/**
 * [필드노트] 녹음 진입 — link-at-start 비교 (탭 시안).
 *
 * 질문: 마이크 탭 = 즉시 blind 녹음(미연결)이 맞나? 상담사는 어떤 회기/검사인지 알고 들어간다.
 * → 연결은 "의도 시점(녹음 시작)"에. 단 즉시성 보존 + 비정형 fallback 유지.
 *
 * 탭:
 *  [현재]      마이크 = 즉시 blind 녹음 → 미연결 노트(대조군).
 *  [연결 선택]  마이크 = "무엇에 연결?" 시트: 지금 회기 선점 + 목록/검색 + "회기 없이" fallback(권장).
 *  [지금 자동]  지금 진행 중 회기가 있으면 시트 대신 원탭 확인 바, 애매할 때만 시트(최소 마찰).
 *
 * mock 데이터만. 색은 COLORS.fieldnoteDark. 확정 시 home.tsx onRecord 라우팅 + 신규 시트 반영.
 */

const DK = {
  bg: COLORS.fieldnoteDark.bg,
  card: COLORS.fieldnoteDark.card,
  line: COLORS.fieldnoteDark.line,
  text: COLORS.fieldnoteDark.text,
  sub: COLORS.fieldnoteDark.sub,
  accent: COLORS.fieldnoteDark.accent,
  warning: COLORS.warning,
  assess: COLORS.assessment,
} as const;
const FNP = COLORS.fieldnote;

const NOW_LABEL = '14:10';

interface MockSession {
  id: string;
  kind: 'counseling' | 'assessment';
  client: string;
  time: string; // "14:00 ~ 15:00"
  assessment?: string; // 검사명
  phase: 'past' | 'now' | 'soon';
}

const SESSIONS: MockSession[] = [
  { id: 's1', kind: 'counseling', client: '김민준', time: '13:00 ~ 14:00', phase: 'past' },
  { id: 's2', kind: 'counseling', client: '이서연', time: '14:00 ~ 15:00', phase: 'now' },
  { id: 't1', kind: 'assessment', client: '홍길동', time: '14:00 ~ 15:30', assessment: 'HTP', phase: 'now' },
  { id: 's3', kind: 'counseling', client: '박도윤', time: '15:30 ~ 16:30', phase: 'soon' },
  { id: 't2', kind: 'assessment', client: '윤아', time: '16:00 ~ 17:00', assessment: 'SCT', phase: 'soon' },
];

// 지금 회기 선점 — 현재 시각이 포함된 회기 중 첫 상담(검사보다 상담 우선 가정).
const NOW_SESSION = SESSIONS.find((x) => x.phase === 'now' && x.kind === 'counseling') ?? null;

function phaseLabel(p: MockSession['phase']): { text: string; color: string } {
  if (p === 'now') return { text: '진행 중', color: COLORS.error };
  if (p === 'soon') return { text: '예정', color: DK.sub };
  return { text: '지난', color: DK.sub };
}

// ── 펄스 마이크 버튼 ──
function MicButton({ onPress }: { onPress: () => void }) {
  const halo = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(halo, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(halo, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [halo]);
  const haloScale = halo.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] });
  const haloOpacity = halo.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] });
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', height: s(96) }}>
      <Animated.View style={{ position: 'absolute', width: s(64), height: s(64), borderRadius: s(32), backgroundColor: FNP, transform: [{ scale: haloScale }], opacity: haloOpacity }} />
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="녹음"
        style={{ width: s(64), height: s(64), borderRadius: s(32), backgroundColor: FNP, alignItems: 'center', justifyContent: 'center', shadowColor: FNP, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } }}
      >
        <Ionicons name="mic" size={s(28)} color={COLORS.white} />
      </Pressable>
    </View>
  );
}

function SessionRow({ sc, onPress, compact }: { sc: MockSession; onPress: () => void; compact?: boolean }) {
  const ph = phaseLabel(sc.phase);
  return (
    <Pressable
      onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: s(10), paddingVertical: s(11), paddingHorizontal: s(14), borderRadius: s(12), backgroundColor: DK.card, marginBottom: s(8), opacity: sc.phase === 'past' ? 0.6 : 1 }}
    >
      <View style={{ width: s(7), height: s(7), borderRadius: s(4), backgroundColor: sc.kind === 'assessment' ? DK.assess : FNP }} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6) }}>
          <Typography variant="body-02" weight="semibold" style={{ color: DK.text }}>{sc.client}</Typography>
          {sc.assessment ? (
            <View style={{ paddingHorizontal: s(6), paddingVertical: s(1), borderRadius: s(4), backgroundColor: DK.assess + '26' }}>
              <Typography variant="label-02" weight="medium" style={{ color: DK.assess }}>{sc.assessment}</Typography>
            </View>
          ) : null}
        </View>
        {!compact ? <Typography variant="label-01" style={{ color: DK.sub, marginTop: s(2) }}>{sc.time}</Typography> : null}
      </View>
      <View style={{ paddingHorizontal: s(7), paddingVertical: s(2), borderRadius: s(8), backgroundColor: ph.color + '1F' }}>
        <Typography variant="label-02" weight="medium" style={{ color: ph.color }}>{ph.text}</Typography>
      </View>
      <Ionicons name="mic" size={s(16)} color={DK.accent} />
    </Pressable>
  );
}

// ── 연결 선택 시트 (지금 선점 + 목록/검색 + fallback) ──
function ConnectSheet({ onPick, onClose, autoMode }: { onPick: (msg: string) => void; onClose: () => void; autoMode?: boolean }) {
  const [q, setQ] = useState('');
  const list = SESSIONS.filter((x) => x.phase !== 'past').filter((x) => !q || x.client.includes(q) || (x.assessment ?? '').includes(q));
  return (
    <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: 0, justifyContent: 'flex-end' }}>
      <Pressable onPress={onClose} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' }} />
      <View style={{ backgroundColor: DK.bg, borderTopLeftRadius: s(20), borderTopRightRadius: s(20), paddingHorizontal: s(20), paddingTop: s(10), paddingBottom: s(28), maxHeight: '82%' }}>
        <View style={{ alignSelf: 'center', width: s(36), height: s(4), borderRadius: s(2), backgroundColor: DK.line, marginBottom: s(14) }} />
        <Typography variant="title-01" weight="semibold" style={{ color: DK.text, marginBottom: s(4) }}>무엇을 녹음할까요?</Typography>
        <Typography variant="label-01" style={{ color: DK.sub, marginBottom: s(14) }}>회기·검사를 고르면 바로 연결돼요</Typography>

        {/* 지금 회기 선점 */}
        {NOW_SESSION ? (
          <View style={{ borderRadius: s(14), backgroundColor: 'rgba(185,139,255,0.12)', borderWidth: 1, borderColor: DK.accent + '55', padding: s(14), marginBottom: s(16) }}>
            <Typography variant="label-01" weight="semibold" style={{ color: DK.accent, marginBottom: s(8) }}>지금 진행 중인 회기</Typography>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <Typography variant="body-01" weight="semibold" style={{ color: DK.text }}>{NOW_SESSION.client}</Typography>
                <Typography variant="label-01" style={{ color: DK.sub, marginTop: s(2) }}>{NOW_SESSION.time}</Typography>
              </View>
              <Pressable
                onPress={() => onPick(`start(undefined, "${NOW_SESSION.id}") — ${NOW_SESSION.client} 회기 녹음`)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: s(6), backgroundColor: FNP, borderRadius: s(12), paddingHorizontal: s(16), paddingVertical: s(11) }}
              >
                <Ionicons name="mic" size={s(16)} color={COLORS.white} />
                <Typography variant="body-02" weight="semibold" style={{ color: COLORS.white }}>이 회기 녹음</Typography>
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* 검색 */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8), backgroundColor: DK.card, borderRadius: s(10), paddingHorizontal: s(12), height: s(40), marginBottom: s(12) }}>
          <Ionicons name="search" size={s(16)} color={DK.sub} />
          <TextInput value={q} onChangeText={setQ} placeholder="내담자 이름으로 찾기" placeholderTextColor={DK.sub} style={{ flex: 1, color: DK.text, fontSize: 15, padding: 0 }} />
        </View>

        <Typography variant="label-01" weight="semibold" style={{ color: DK.sub, marginBottom: s(8) }}>오늘 회기 · 진행 중 검사</Typography>
        <ScrollView style={{ maxHeight: s(220) }} showsVerticalScrollIndicator={false}>
          {list.map((sc) => (
            <SessionRow key={sc.id} sc={sc} onPress={() => onPick(`start(…, "${sc.id}") — ${sc.client}${sc.assessment ? ' · ' + sc.assessment : ''}`)} />
          ))}
          {list.length === 0 ? <Typography variant="body-03" style={{ color: DK.sub, textAlign: 'center', paddingVertical: s(20) }}>일치하는 회기가 없어요</Typography> : null}
        </ScrollView>

        {/* fallback — 강등 */}
        <Pressable onPress={() => onPick('start() — 회기 없이 녹음(미지정, 나중에 연결)')} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: s(6), paddingVertical: s(12), marginTop: s(8) }}>
          <Ionicons name="ellipsis-horizontal-circle-outline" size={s(16)} color={DK.sub} />
          <Typography variant="body-03" style={{ color: DK.sub }}>회기 없이 녹음</Typography>
        </Pressable>
      </View>
    </View>
  );
}

// ── 지금 자동: 원탭 확인 바 ──
function NowConfirmBar({ onPick, onMore, onClose }: { onPick: (m: string) => void; onMore: () => void; onClose: () => void }) {
  if (!NOW_SESSION) return null;
  return (
    <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: 0, justifyContent: 'flex-end' }}>
      <Pressable onPress={onClose} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)' }} />
      <View style={{ backgroundColor: DK.bg, borderTopLeftRadius: s(20), borderTopRightRadius: s(20), paddingHorizontal: s(20), paddingTop: s(16), paddingBottom: s(28) }}>
        <Typography variant="label-01" style={{ color: DK.sub, marginBottom: s(6) }}>지금 이 회기인가요?</Typography>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: s(16) }}>
          <View>
            <Typography variant="headline-02" weight="semibold" style={{ color: DK.text }}>{NOW_SESSION.client}</Typography>
            <Typography variant="label-01" style={{ color: DK.sub, marginTop: s(2) }}>{NOW_SESSION.time} · 진행 중</Typography>
          </View>
        </View>
        <Pressable onPress={() => onPick(`start(undefined, "${NOW_SESSION.id}") — 원탭 즉시`)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: s(8), backgroundColor: FNP, borderRadius: s(14), height: s(52) }}>
          <Ionicons name="mic" size={s(20)} color={COLORS.white} />
          <Typography variant="body-01" weight="semibold" style={{ color: COLORS.white }}>이 회기 녹음 시작</Typography>
        </Pressable>
        <Pressable onPress={onMore} style={{ alignItems: 'center', paddingVertical: s(12), marginTop: s(6) }}>
          <Typography variant="body-03" style={{ color: DK.sub }}>다른 회기 / 회기 없이 녹음</Typography>
        </Pressable>
      </View>
    </View>
  );
}

function Verdict({ lines }: { lines: { tone: 'good' | 'bad' | 'note'; text: string }[] }) {
  const tint = { good: COLORS.success, bad: COLORS.negative, note: DK.sub } as const;
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

// ── 홈 = 선택지 (시트 없이, 리스트가 곧 picker) ──
function HomeChooser({ onPick }: { onPick: (m: string) => void }) {
  const now = SESSIONS.filter((x) => x.phase === 'now');
  const rest = SESSIONS.filter((x) => x.phase !== 'now');
  return (
    <View style={{ paddingHorizontal: s(20), paddingTop: s(12) }}>
      <Typography variant="label-01" style={{ color: DK.sub, marginBottom: s(12) }}>오늘 · 지금 {NOW_LABEL}</Typography>

      {now.length > 0 ? (
        <>
          <Typography variant="label-01" weight="semibold" style={{ color: DK.accent, marginBottom: s(8) }}>지금 진행 중</Typography>
          {now.map((sc) => (
            <View key={sc.id} style={{ borderRadius: s(14), backgroundColor: 'rgba(185,139,255,0.12)', borderWidth: 1, borderColor: DK.accent + '55', padding: s(14), marginBottom: s(10) }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8) }}>
                <View style={{ width: s(7), height: s(7), borderRadius: s(4), backgroundColor: sc.kind === 'assessment' ? DK.assess : FNP }} />
                <Typography variant="body-01" weight="semibold" style={{ color: DK.text }}>{sc.client}</Typography>
                {sc.assessment ? (
                  <View style={{ paddingHorizontal: s(6), paddingVertical: s(1), borderRadius: s(4), backgroundColor: DK.assess + '26' }}>
                    <Typography variant="label-02" weight="medium" style={{ color: DK.assess }}>{sc.assessment}</Typography>
                  </View>
                ) : null}
              </View>
              <Typography variant="label-01" style={{ color: DK.sub, marginTop: s(3) }}>{sc.time}</Typography>
              <Pressable
                onPress={() => onPick(`start(…, "${sc.id}") — ${sc.client}${sc.assessment ? ' · ' + sc.assessment : ''} 녹음`)}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: s(8), backgroundColor: FNP, borderRadius: s(12), height: s(46), marginTop: s(12) }}
              >
                <Ionicons name="mic" size={s(18)} color={COLORS.white} />
                <Typography variant="body-01" weight="semibold" style={{ color: COLORS.white }}>이 {sc.kind === 'assessment' ? '검사' : '회기'} 녹음</Typography>
              </Pressable>
            </View>
          ))}
        </>
      ) : null}

      <Typography variant="label-01" weight="semibold" style={{ color: DK.sub, marginTop: s(8), marginBottom: s(8) }}>오늘 회기 · 검사</Typography>
      {rest.map((sc) => (
        <SessionRow key={sc.id} sc={sc} onPress={() => onPick(`start(…, "${sc.id}") — ${sc.client}${sc.assessment ? ' · ' + sc.assessment : ''}`)} />
      ))}

      {/* 마이크 강등 = "회기 없이 녹음" 예외 fallback */}
      <Pressable
        onPress={() => onPick('start() — 회기 없이 녹음(예외, 나중에 연결)')}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: s(8), marginTop: s(14), paddingVertical: s(13), borderRadius: s(12), borderWidth: 1, borderColor: DK.line, borderStyle: 'dashed' }}
      >
        <Ionicons name="mic-outline" size={s(16)} color={DK.sub} />
        <Typography variant="body-03" style={{ color: DK.sub }}>회기 없이 녹음</Typography>
      </Pressable>
    </View>
  );
}

type TabKey = 'current' | 'home' | 'sheet' | 'auto';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'current', label: '현재' },
  { key: 'home', label: '홈=선택' },
  { key: 'sheet', label: '연결 선택' },
  { key: 'auto', label: '지금 자동' },
];

export default function FieldNoteRecordEntryLab() {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>('home');
  const [overlay, setOverlay] = useState<'none' | 'sheet' | 'auto'>('none');
  const [banner, setBanner] = useState<string | null>(null);

  const showResult = (msg: string) => {
    setOverlay('none');
    setBanner(msg);
  };

  const onMic = () => {
    setBanner(null);
    if (tab === 'current') {
      setBanner('start() — 바로 blind 녹음 시작 → 미연결 노트 생성');
    } else if (tab === 'sheet') {
      setOverlay('sheet');
    } else {
      setOverlay(NOW_SESSION ? 'auto' : 'sheet');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: DK.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={{ height: s(52), flexDirection: 'row', alignItems: 'center', paddingHorizontal: s(12) }}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={{ width: s(40), height: s(40), alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="chevron-back" size={24} color={DK.text} />
          </Pressable>
          <Typography variant="headline-02" weight="bold" style={{ color: DK.text, marginLeft: s(2) }}>녹음 진입</Typography>
        </View>

        <View style={{ flexDirection: 'row', gap: s(8), paddingHorizontal: s(20), paddingTop: s(8), paddingBottom: s(6) }}>
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <Pressable key={t.key} onPress={() => { setTab(t.key); setBanner(null); setOverlay('none'); }} style={{ paddingHorizontal: s(14), paddingVertical: s(8), borderRadius: s(999), backgroundColor: active ? DK.accent : 'rgba(255,255,255,0.06)' }}>
                <Typography variant="label-01" weight="medium" style={{ color: active ? '#1A1626' : DK.sub }}>{t.label}</Typography>
              </Pressable>
            );
          })}
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: s(40) }} showsVerticalScrollIndicator={false}>
          {/* mock 필드노트 홈 — 탭별 진입 방식 비교 */}
          <View style={{ paddingHorizontal: s(20), paddingTop: s(10) }}>
            <Typography variant="body-03" style={{ color: DK.sub, lineHeight: s(20) }}>
              {tab === 'home'
                ? '홈 리스트가 곧 선택지 — 회기/검사 카드 탭이 바로 연결 녹음. 마이크는 "회기 없이 녹음" fallback으로 강등.'
                : '아래 마이크를 눌러 진입 동작을 비교하세요. 선택 시 호출될 `start(...)`가 배너로 표시됩니다.'}
            </Typography>
          </View>

          {tab === 'home' ? <HomeChooser onPick={showResult} /> : <MicButton onPress={onMic} />}

          {banner ? (
            <View style={{ marginHorizontal: s(20), padding: s(12), borderRadius: s(10), backgroundColor: DK.card, flexDirection: 'row', alignItems: 'center', gap: s(8) }}>
              <Ionicons name="arrow-forward-circle" size={s(16)} color={DK.accent} />
              <Typography variant="body-03" style={{ color: DK.text, flex: 1 }}>{banner}</Typography>
            </View>
          ) : null}

          {tab === 'current' ? (
            <Verdict lines={[
              { tone: 'bad', text: '마이크 = 즉시 blind 녹음 → schedule_id·task_id 없는 미연결 노트. "무엇에 대한 녹음인지" 모른 채 시작.' },
              { tone: 'bad', text: '나중에 LinkScheduleSheet로 연결 → link-later 백로그·미연결 더미. 용어/필터 부담의 근원.' },
              { tone: 'note', text: '검사 노트는 이 경로로 못 만듦(task 연결은 검사 항목에서만).' },
            ]} />
          ) : tab === 'home' ? (
            <Verdict lines={[
              { tone: 'good', text: '홈 리스트 자체가 선택지 — 별도 picker 시트 없음(연결 선택 시트는 이 리스트를 모달로 중복하던 것).' },
              { tone: 'good', text: '지금 진행 중 회기를 맨 위 강조 → 흔한 경우 원탭. 카드 탭이 곧 link-at-start.' },
              { tone: 'good', text: '마이크는 "회기 없이 녹음" fallback으로 강등 — record-first 암시 제거. 미지정은 예외.' },
              { tone: 'note', text: '거의 코드 추가 없음 — 현행 home.tsx "오늘 회기" 리스트에 "지금 강조"만 더하고 중앙 마이크 동작만 바꾸면 됨.' },
            ]} />
          ) : tab === 'sheet' ? (
            <Verdict lines={[
              { tone: 'bad', text: '약점: 이 시트 목록 = 홈의 "오늘 회기" 리스트를 모달로 한 번 더 — [홈=선택]과 중복 레이어.' },
              { tone: 'good', text: '마이크 = "무엇에 연결?" 시트. 지금 회기 선점 + 목록 + 검색 → 고르는 순간 연결(link-at-start).' },
              { tone: 'good', text: '검사도 같은 시트에서(블루 뱃지). "회기 없이 녹음"은 맨 아래로 강등.' },
              { tone: 'note', text: '시트가 이기는 경우는 "홈 안 거치고 아무 화면에서나 즉시 녹음"뿐 — 현재 FAB는 어차피 홈으로 이동.' },
            ]} />
          ) : (
            <Verdict lines={[
              { tone: 'good', text: '지금 진행 중 회기가 있으면 시트 대신 원탭 확인 바 → 가장 흔한 경우 마찰 최소(P2 즉시성).' },
              { tone: 'good', text: '"다른 회기 / 회기 없이"로 전체 시트 진입 — 애매하거나 예외일 때만.' },
              { tone: 'note', text: '지금 회기가 없으면(즉석) 곧장 전체 시트로 폴백. 선점 오인 위험은 확인 한 단계로 흡수.' },
            ]} />
          )}
        </ScrollView>
      </SafeAreaView>

      {overlay === 'sheet' ? <ConnectSheet onPick={showResult} onClose={() => setOverlay('none')} /> : null}
      {overlay === 'auto' ? <NowConfirmBar onPick={showResult} onMore={() => setOverlay('sheet')} onClose={() => setOverlay('none')} /> : null}
    </View>
  );
}
