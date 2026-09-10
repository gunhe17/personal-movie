import { useState } from 'react';
import { View, ScrollView, TouchableOpacity, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, LAYOUT } from '@/shared/constants/theme';
import { Typography } from '@/shared/components/ui/Typography';
import { Icon } from '@/shared/components/icons';
import { s } from '@/shared/utils/scale';

/**
 * 녹음 시트 다크 리컬러 시안 (production RecordingSheet 포팅 레퍼런스).
 *
 * production 시트는 라이트(핑크→블루 파스텔)인데 필드노트 다크 정체성과 안 맞음.
 * 이 lab은 production 구조(모프 expanded↔compact + 컨트롤 + 전사 버블 + 메모 + AI 가이드 pill)를
 * 그대로 다크로 옮겨, 대비·누락을 확인하고 사인오프되면 1:1로 RecordingSheet 에 포팅한다.
 *
 * 탭 — [차분(expanded)] 큰 타이머+파형 / [전사(compact)] 상단 바+전사 버블+메모+AI pill.
 * 하단에 라이트→다크 색 매핑표(포팅 가이드). 전부 mock.
 */

const FN = COLORS.fieldnoteDark;
// 시트 배경 그라데이션 — 라이트 #FCF1FF→#F4F9FF 의 다크 대응(딥 보라 → 잉크)
const SHEET_GRAD: [string, string] = ['#241B3A', '#141220'];
const SURFACE_BTN = 'rgba(255,255,255,0.08)'; // 다크 위 버튼/칩 표면
const REC_RED = COLORS.error;

function WaveBars({ height = 22, n = 7 }: { height?: number; n?: number }) {
  const hs = [0.5, 0.85, 0.6, 1, 0.55, 0.9, 0.5, 0.75, 0.65];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(2.5) }}>
      {hs.slice(0, n).map((h, i) => (
        <View key={i} style={{ width: s(2.5), height: s(height) * h, borderRadius: s(2), backgroundColor: FN.accent }} />
      ))}
    </View>
  );
}

// ───────────────────────── expanded (차분) ─────────────────────────
function ExpandedSheet() {
  return (
    <LinearGradient colors={SHEET_GRAD} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={{ flex: 1 }}>
      <View style={{ height: s(28), alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: s(36), height: s(4), borderRadius: s(2), backgroundColor: FN.line }} />
      </View>

      <View style={{ flex: 1, justifyContent: 'center' }}>
        {/* 흰 박스 → 다크 카드 */}
        <View style={{ marginHorizontal: s(12), borderRadius: s(16), backgroundColor: FN.card, paddingVertical: s(20), alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6), marginBottom: s(12) }}>
            <View style={{ width: s(8), height: s(8), borderRadius: s(4), backgroundColor: REC_RED }} />
            <Typography variant="body-03" style={{ color: FN.sub }}>녹음이 진행중이에요</Typography>
          </View>
          <Typography variant="time" weight="light" style={{ color: FN.text, marginBottom: s(20) }}>04:12</Typography>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(20), marginBottom: s(24) }}>
            <View style={{ width: s(60), height: s(60), borderRadius: s(30), backgroundColor: SURFACE_BTN, borderWidth: 1, borderColor: FN.line, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="pause" size={s(24)} color={FN.text} />
            </View>
            <View style={{ width: s(60), height: s(60), borderRadius: s(30), backgroundColor: REC_RED, alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ width: s(20), height: s(20), borderRadius: s(3), backgroundColor: COLORS.white }} />
            </View>
          </View>
          <WaveBars height={26} n={9} />
        </View>
      </View>

      {/* 하단 '실시간 기록' pill */}
      <View style={{ paddingHorizontal: s(16), paddingBottom: s(16) }}>
        <View style={{ alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: s(6), height: s(48), paddingHorizontal: s(16), borderRadius: s(100), backgroundColor: FN.card }}>
          <Ionicons name="list" size={s(16)} color={FN.accent} />
          <Typography variant="body-03" weight="medium" style={{ color: FN.text }}>실시간 기록</Typography>
        </View>
      </View>
    </LinearGradient>
  );
}

// ───────────────────────── compact (전사) ─────────────────────────
const BUBBLES = [
  '오늘은 블록 놀이부터 해볼까요?',
  '저번처럼 무너지면 어떡해요.',
  '무너져도 괜찮아요. 같이 다시 쌓으면 되니까.',
];
function CompactSheet() {
  return (
    <LinearGradient colors={SHEET_GRAD} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={{ flex: 1 }}>
      <View style={{ height: s(28), alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: s(36), height: s(4), borderRadius: s(2), backgroundColor: FN.line }} />
      </View>

      {/* 상단 compact 바 (흰 박스 68dp → 다크 카드) */}
      <View style={{ marginHorizontal: s(12), height: s(56), borderRadius: s(16), backgroundColor: FN.card, flexDirection: 'row', alignItems: 'center', paddingHorizontal: s(14), gap: s(10) }}>
        <View style={{ width: s(8), height: s(8), borderRadius: s(4), backgroundColor: REC_RED }} />
        <View style={{ flex: 1 }}><WaveBars height={20} n={9} /></View>
        <Typography variant="body-02" weight="semibold" style={{ color: FN.text }}>04:12</Typography>
        <View style={{ width: s(32), height: s(32), borderRadius: s(16), backgroundColor: SURFACE_BTN, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="pause" size={s(16)} color={FN.text} />
        </View>
        <View style={{ width: s(32), height: s(32), borderRadius: s(16), backgroundColor: REC_RED, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: s(11), height: s(11), borderRadius: s(2), backgroundColor: COLORS.white }} />
        </View>
      </View>

      {/* 전사 버블 (라이트 버블 → 다크 카드 버블) */}
      <ScrollView contentContainerStyle={{ padding: s(16), gap: s(8) }} style={{ flex: 1 }}>
        {BUBBLES.map((t, i) => (
          <View key={i} style={{ backgroundColor: FN.card, borderRadius: s(14), paddingHorizontal: s(12), paddingVertical: s(9) }}>
            <Typography variant="body-03" style={{ color: FN.text, lineHeight: s(20) }}>{t}</Typography>
          </View>
        ))}
      </ScrollView>

      {/* AI 가이드 pill (보라 그라데이션 — 정체성과 이미 맞음, 유지) */}
      <View style={{ paddingHorizontal: s(16), alignItems: 'flex-end', marginBottom: s(8) }}>
        <LinearGradient colors={['#A56EFF', '#7B79FF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flexDirection: 'row', alignItems: 'center', gap: s(5), borderRadius: s(999), paddingHorizontal: s(12), paddingVertical: s(8) }}>
          <Ionicons name="sparkles" size={s(13)} color={COLORS.white} />
          <Typography variant="label-02" weight="semibold" className="text-white">AI 상담 가이드</Typography>
        </LinearGradient>
      </View>

      {/* 메모 pill (흰 → 다크 카드) */}
      <View style={{ paddingHorizontal: s(16), paddingBottom: s(16) }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8), backgroundColor: FN.card, borderRadius: s(14), paddingHorizontal: s(14), paddingVertical: s(10) }}>
          <Typography variant="body-03" style={{ color: FN.sub, flex: 1 }}>메모 내용을 입력해주세요</Typography>
          <Ionicons name="arrow-up-circle" size={s(24)} color={FN.accent} />
        </View>
      </View>
    </LinearGradient>
  );
}

// ───────────────────────── 색 매핑표 (포팅 가이드) ─────────────────────────
const MAP: { el: string; light: string; dark: string }[] = [
  { el: '시트 배경 그라데이션', light: '#FCF1FF→#F4F9FF', dark: '#241B3A→#141220' },
  { el: '흰 박스/pill/버블', light: 'white', dark: 'FN.card #211D33' },
  { el: '타이머·본문 텍스트', light: 'gray-800/900', dark: 'FN.text #E7E3F5' },
  { el: '보조 텍스트(REC 라벨·placeholder)', light: 'gray-600/400', dark: 'FN.sub #A39DBF' },
  { el: '핸들·구분선', light: 'gray-500', dark: 'FN.line' },
  { el: '일시정지 버튼', light: 'surface+gray보더', dark: 'rgba(255,255,255,0.08)+FN.line' },
  { el: '정지 버튼·REC 점', light: '#FF6466', dark: 'error (유지)' },
  { el: '파형·AI 강조', light: '보라', dark: 'FN.accent / 보라 그라데이션 유지' },
];

// ════════════════════ 루트 ════════════════════
type Tab = 'expanded' | 'compact';
const TABS: { key: Tab; label: string }[] = [
  { key: 'expanded', label: '차분(expanded)' },
  { key: 'compact', label: '전사(compact)' },
];

export default function FieldNoteSheetDarkLab() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('expanded');

  return (
    <View className="flex-1 bg-base">
      <SafeAreaView edges={['top']} style={{ backgroundColor: COLORS.white }}>
        <View style={{ height: s(48), paddingHorizontal: s(LAYOUT.screenPaddingX), flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8} accessibilityLabel="뒤로 가기" accessibilityRole="button">
            <Icon name="arrow-left" size={24} color={COLORS.gray[900]} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Typography variant="title-01" weight="semibold" className="text-gray-900">녹음 시트 다크 리컬러</Typography>
          </View>
          <View style={{ width: 24 }} />
        </View>
        <View style={{ paddingHorizontal: s(LAYOUT.screenPaddingX), paddingBottom: s(12) }}>
          <View style={{ flexDirection: 'row', backgroundColor: COLORS.gray[50], borderRadius: s(10), padding: s(3) }}>
            {TABS.map((t) => {
              const active = tab === t.key;
              return (
                <Pressable key={t.key} onPress={() => setTab(t.key)} style={{ flex: 1, paddingVertical: s(8), borderRadius: s(8), backgroundColor: active ? COLORS.white : 'transparent', alignItems: 'center' }}>
                  <Typography variant="label-02" weight={active ? 'semibold' : 'regular'} style={{ color: active ? COLORS.gray[900] : COLORS.gray[500] }}>{t.label}</Typography>
                </Pressable>
              );
            })}
          </View>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ padding: s(LAYOUT.screenPaddingX), paddingBottom: s(60) }}>
        <View style={{ height: s(560), borderRadius: s(24), borderWidth: 1, borderColor: FN.line, overflow: 'hidden' }}>
          {tab === 'expanded' ? <ExpandedSheet /> : <CompactSheet />}
        </View>

        {/* 색 매핑표 */}
        <Typography variant="label-01" weight="semibold" className="text-gray-900" style={{ marginTop: s(18), marginBottom: s(8) }}>라이트 → 다크 매핑 (포팅 가이드)</Typography>
        <View style={{ borderRadius: s(12), backgroundColor: COLORS.gray[50], padding: s(12), gap: s(8) }}>
          {MAP.map((m) => (
            <View key={m.el} style={{ gap: s(2) }}>
              <Typography variant="label-02" weight="semibold" className="text-gray-800">{m.el}</Typography>
              <Typography variant="caption-01" className="text-gray-500">{m.light}  →  {m.dark}</Typography>
            </View>
          ))}
        </View>
        <Typography variant="caption-01" className="text-gray-500" style={{ marginTop: s(12), lineHeight: s(16) }}>
          사인오프되면 RecordingSheet 의 gradient·styles·AiGuideMorph·전사 버블 색을 위 매핑대로 1:1 포팅. AI 가이드 보라 그라데이션은 정체성과 맞아 유지. 전부 mock.
        </Typography>
      </ScrollView>
    </View>
  );
}
