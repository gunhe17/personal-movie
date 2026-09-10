import { useState } from 'react';
import { View, ScrollView, TouchableOpacity, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, LAYOUT } from '@/shared/constants/theme';
import { Typography } from '@/shared/components/ui/Typography';
import { Icon } from '@/shared/components/icons';
import { s } from '@/shared/utils/scale';

/**
 * 필드노트 "현재 코드" 녹음→분석 흐름 진단 (2026-06-04 재점검).
 *
 * 짝: 미래 3안 비교는 `field-note-flow.tsx` + `claudedocs/fieldnote-flow-redesign.md`(6/2).
 * 이 랩은 그 사이 적용된 변경(홈 허브·FAB→홈·녹음 충돌 resolver·회기카드 라이브)을 반영한
 * '지금 코드가 실제로 어떻게 흐르고 어디가 어색한지'를 정리한 진단판.
 *
 * 핵심 결론: FAB·홈은 '공간'으로 고쳐놨는데, 정지 직후 흐름만 옛날 그대로 '처리 풀스크린'으로
 * 점프하는 불일치가 가장 큼. (ProcessingHost가 이미 백그라운드 폴링+토스트를 하는데도 가둠.)
 *
 * 탭 — [흐름] 현재 실제 여정 단계별(어색 지점 핀) / [발견] 항목별 심각도 정리.
 * 전부 mock · 코드 근거는 각 항목 주석/라벨에 파일명 표기.
 */

const FN = COLORS.fieldnoteDark;

type Sev = 'good' | 'low' | 'mid' | 'high';
const SEV_META: Record<Sev, { color: string; label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  good: { color: COLORS.palette.green, label: '개선됨', icon: 'checkmark-circle' },
  low: { color: FN.sub, label: '경미', icon: 'ellipse-outline' },
  mid: { color: COLORS.warning, label: '주의', icon: 'alert-circle' },
  high: { color: COLORS.error, label: '핵심', icon: 'warning' },
};

// ───────────────────────── 흐름 단계 (현재 실제 여정) ─────────────────────────
const STEPS: { phase: string; label: string; sev: Sev; tag?: string; note: string; ref?: string }[] = [
  {
    phase: '진입',
    label: 'FAB → 홈(공간)',
    sev: 'good',
    note: '어디서든 필드노트 공간으로 도착. 녹음 중에도 시트 직행 안 함(최근 개선).',
    ref: 'DraggableFab.handleTap',
  },
  {
    phase: '녹음',
    label: '녹음 시트 (최소화 가능)',
    sev: 'good',
    note: '글로벌 RecordingHost. 최소화하면 회기카드가 "녹음 중"으로 살아있음.',
    ref: 'RecordingHost · home 회기카드',
  },
  {
    phase: '정지',
    label: '확인 모달 "저장 후 바로 분석"',
    sev: 'mid',
    tag: 'B',
    note: '회기 직후 소진된 순간에 분석/저장/삭제 결정 강요. "바로 분석"이라 전사(자동)·AI(선택) 두 층위가 안 나뉨.',
    ref: 'StopConfirmModal',
  },
  {
    phase: '정지 직후',
    label: '처리 풀스크린으로 점프 (최소 2.5s 강제)',
    sev: 'high',
    tag: 'A',
    note: 'finalizeRecording이 _quick로 push → ProcessingScreen에 갇힘. FAB는 홈으로 고쳤는데 여기만 옛 흐름. ProcessingHost가 이미 백그라운드인데도 화면으로 가둠.',
    ref: 'RecordingHost.tsx:427 · orchestrator PROCESSING_MIN_DISPLAY_MS',
  },
  {
    phase: '완료',
    label: 'CompletedScreen 탭(전사·요약·일지)',
    sev: 'low',
    note: 'AI는 버튼(opt-in)이지만, 진입이 강제 점프 뒤라 "검토는 나중에 따로"라는 박자가 안 생김.',
    ref: 'CompletedScreen',
  },
  {
    phase: '검토(나중)',
    label: '홈/목록 → _quick / {scheduleId}',
    sev: 'mid',
    tag: 'G',
    note: '연결=/{scheduleId}, 미연결=_quick?fieldNoteId — 같은 DetailView인데 리뷰 진입 경로가 둘로 갈림.',
    ref: 'ProcessingHost.tsx:48',
  },
];

// ───────────────────────── 발견 목록 (심각도순) ─────────────────────────
const FINDINGS: { id: string; sev: Sev; title: string; body: string; ref: string }[] = [
  {
    id: 'A',
    sev: 'high',
    title: '정지하면 여전히 분석 풀스크린에 갇힘',
    body: '정지 후 _quick로 push → ProcessingScreen 풀스크린 + 최소 2.5초 강제 표시 + 완료 애니메이션 hold. FAB는 "녹음 중에도 홈"으로 고쳐놓고 정지 직후만 옛 흐름 → 불일치. ProcessingHost 백그라운드가 이미 있음.',
    ref: 'RecordingHost.finalizeRecording / useFieldNoteOrchestrator',
  },
  {
    id: 'B',
    sev: 'high',
    title: '가장 지친 순간에 결정 강요 + 분석 강제',
    body: '"종료하면 저장 후 바로 분석" — 회기 직후 분석/저장/삭제 결정. 전사(자동)·AI(선택) 두 층위 분리가 아직 미적용(finish skipPipeline=false면 전체 파이프라인).',
    ref: 'StopConfirmModal',
  },
  {
    id: 'C',
    sev: 'mid',
    title: '녹음 엔진이 둘 (아키텍처 부채)',
    body: '글로벌 RecordingHost(실사용: streaming·충돌·minimize·FAB라이브 전부) + DetailView orchestrator 내부 useRecorder(이제 vestigial). /{scheduleId}로 녹음 시작 진입점 0건인데 코드는 살아있음. 같은 DetailView에서 resume=글로벌 / new 자동시작=로컬로 엔진이 갈림.',
    ref: 'useFieldNoteOrchestrator · useRecordingHandlers · RecordingScreen',
  },
  {
    id: 'D',
    sev: 'mid',
    title: '화면 = 상태머신 7모드 (절반은 죽은 분기)',
    body: '[scheduleId]/_quick 한 라우트가 new/resume/recording/processing/pending/completed/failed로 변형, 뒤로가기는 전부 router.back. capture가 글로벌 시트로 빠진 지금 recording/new 분기는 거의 안 쓰임 → 비대.',
    ref: 'useFieldNoteOrchestrator.screenMode',
  },
  {
    id: 'E',
    sev: 'low',
    title: '인위적 대기 (2.5s + 완료 애니메이션 hold)',
    body: '분석이 빨리 끝나도 처리화면 최소 2.5초 유지. "가두지 말라" 원칙과 반대. 검정 화면 레이스 가드(completionDoneRef)가 설계 취약함의 증거.',
    ref: 'PROCESSING_MIN_DISPLAY_MS',
  },
  {
    id: 'F',
    sev: 'low',
    title: 'pending_analysis(저장만) 분기 취약',
    body: 'isPendingAnalysis 조건이 복잡하고 "분석 후 pending으로 되돌아오는 루프" 방지 주석 존재 → 상태 판정이 깨지기 쉬움.',
    ref: 'orchestrator isPendingAnalysis',
  },
  {
    id: 'G',
    sev: 'low',
    title: '리뷰 진입 라우팅 이원화',
    body: '연결=/{scheduleId}, 미연결=_quick?fieldNoteId. ProcessingHost 완료 토스트도 이 둘로 분기 → 같은 DetailView인데 경로 둘.',
    ref: 'ProcessingHost.tsx:48',
  },
];

// ───────────────────────── 개선 흐름 (대안 A 방향) ─────────────────────────
const IMPROVED_STEPS: { phase: string; label: string; changed: boolean; was?: string; note: string }[] = [
  {
    phase: '진입',
    label: 'FAB → 홈(공간)',
    changed: false,
    note: '그대로 — 어디서든 필드노트 공간으로 도착.',
  },
  {
    phase: '녹음',
    label: '녹음 시트 (최소화 · 라이브 표시)',
    changed: false,
    note: '그대로 — 최소화하면 회기카드/미니바가 "녹음 중".',
  },
  {
    phase: '정지',
    label: '"녹음을 마칠까요?" (마치기 / 계속 / 삭제)',
    changed: true,
    was: '"저장 후 바로 분석" + 분석/저장/삭제 결정 강요',
    note: '분석을 정지 순간에 안 물음. 마치기 = 전사·화자분리만 자동 백그라운드 시작.',
  },
  {
    phase: '정지 직후',
    label: '홈으로 복귀 + "저장했어요" 토스트',
    changed: true,
    was: '_quick 처리 풀스크린으로 점프 (2.5s 강제)',
    note: '처리 화면에 안 가둠. ProcessingHost가 백그라운드로 폴링.',
  },
  {
    phase: '처리',
    label: '백그라운드 카드 배지 "전사 중 → 전사됨"',
    changed: true,
    was: '풀스크린 ProcessingScreen에 갇힘',
    note: '홈/목록 카드가 자연 전환 + 완료 토스트로 알림.',
  },
  {
    phase: '검토(나중)',
    label: '카드 탭 → 리뷰 (전사 채워짐 · AI는 "만들기" 버튼)',
    changed: true,
    was: '강제 점프 뒤 곧장 완료 화면',
    note: '내가 앉을 때가 검토. AI 요약·일지초안은 그 화면에서 opt-in.',
  },
];

// ───────────────────────── 조각 ─────────────────────────
function SevChip({ sev }: { sev: Sev }) {
  const m = SEV_META[sev];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(4), backgroundColor: m.color + '22', borderRadius: s(999), paddingHorizontal: s(8), paddingVertical: s(3) }}>
      <Ionicons name={m.icon} size={s(11)} color={m.color} />
      <Typography variant="label-02" weight="semibold" style={{ color: m.color }}>{m.label}</Typography>
    </View>
  );
}

function FlowRail() {
  return (
    <View style={{ borderRadius: s(16), backgroundColor: FN.bg, borderWidth: 1, borderColor: FN.line, padding: s(16) }}>
      {STEPS.map((st, i) => {
        const m = SEV_META[st.sev];
        const last = i === STEPS.length - 1;
        return (
          <View key={i} style={{ flexDirection: 'row', gap: s(12) }}>
            {/* 레일 (점 + 세로선) */}
            <View style={{ alignItems: 'center', width: s(16) }}>
              <View style={{ width: s(14), height: s(14), borderRadius: s(7), backgroundColor: m.color }} />
              {!last && <View style={{ flex: 1, width: 2, backgroundColor: FN.line, marginVertical: s(2) }} />}
            </View>
            {/* 내용 */}
            <View style={{ flex: 1, paddingBottom: last ? 0 : s(16) }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6), flexWrap: 'wrap' }}>
                <Typography variant="label-02" weight="medium" style={{ color: FN.sub }}>{st.phase}</Typography>
                {st.tag && (
                  <View style={{ backgroundColor: m.color, borderRadius: s(5), paddingHorizontal: s(5), paddingVertical: s(1) }}>
                    <Typography variant="caption-01" weight="bold" style={{ color: COLORS.white }}>{st.tag}</Typography>
                  </View>
                )}
                <SevChip sev={st.sev} />
              </View>
              <Typography variant="body-02" weight="semibold" style={{ color: FN.text, marginTop: s(3) }}>{st.label}</Typography>
              <Typography variant="body-03" style={{ color: FN.sub, marginTop: s(3), lineHeight: s(19) }}>{st.note}</Typography>
              {st.ref && (
                <Typography variant="caption-01" style={{ color: FN.accent, marginTop: s(4) }}>{st.ref}</Typography>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function FindingsList() {
  return (
    <View style={{ gap: s(10) }}>
      {FINDINGS.map((f) => {
        const m = SEV_META[f.sev];
        return (
          <View key={f.id} style={{ borderRadius: s(14), backgroundColor: FN.bg, borderWidth: 1, borderColor: FN.line, borderLeftWidth: s(3), borderLeftColor: m.color, padding: s(14) }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8) }}>
              <View style={{ width: s(22), height: s(22), borderRadius: s(7), backgroundColor: m.color, alignItems: 'center', justifyContent: 'center' }}>
                <Typography variant="label-02" weight="bold" style={{ color: COLORS.white }}>{f.id}</Typography>
              </View>
              <Typography variant="body-02" weight="semibold" style={{ color: FN.text, flex: 1 }}>{f.title}</Typography>
              <SevChip sev={f.sev} />
            </View>
            <Typography variant="body-03" style={{ color: FN.sub, marginTop: s(8), lineHeight: s(20) }}>{f.body}</Typography>
            <Typography variant="caption-01" style={{ color: FN.accent, marginTop: s(6) }}>{f.ref}</Typography>
          </View>
        );
      })}
    </View>
  );
}

function ImprovedRail() {
  return (
    <View style={{ borderRadius: s(16), backgroundColor: FN.bg, borderWidth: 1, borderColor: FN.line, padding: s(16) }}>
      {IMPROVED_STEPS.map((st, i) => {
        const dot = st.changed ? FN.accent : COLORS.palette.green;
        const last = i === IMPROVED_STEPS.length - 1;
        return (
          <View key={i} style={{ flexDirection: 'row', gap: s(12) }}>
            <View style={{ alignItems: 'center', width: s(16) }}>
              <View style={{ width: s(14), height: s(14), borderRadius: s(7), backgroundColor: dot }} />
              {!last && <View style={{ flex: 1, width: 2, backgroundColor: FN.line, marginVertical: s(2) }} />}
            </View>
            <View style={{ flex: 1, paddingBottom: last ? 0 : s(16) }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6), flexWrap: 'wrap' }}>
                <Typography variant="label-02" weight="medium" style={{ color: FN.sub }}>{st.phase}</Typography>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(4), backgroundColor: dot + '22', borderRadius: s(999), paddingHorizontal: s(8), paddingVertical: s(3) }}>
                  <Ionicons name={st.changed ? 'sparkles' : 'checkmark'} size={s(11)} color={dot} />
                  <Typography variant="label-02" weight="semibold" style={{ color: dot }}>{st.changed ? '변경' : '유지'}</Typography>
                </View>
              </View>
              <Typography variant="body-02" weight="semibold" style={{ color: FN.text, marginTop: s(3) }}>{st.label}</Typography>
              {st.was && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(5), marginTop: s(4) }}>
                  <Ionicons name="arrow-undo-outline" size={s(12)} color={FN.sub} />
                  <Typography variant="caption-01" style={{ color: FN.sub, flex: 1, textDecorationLine: 'line-through' }}>이전: {st.was}</Typography>
                </View>
              )}
              <Typography variant="body-03" style={{ color: FN.sub, marginTop: s(3), lineHeight: s(19) }}>{st.note}</Typography>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function VerdictCard() {
  return (
    <View style={{ marginTop: s(16), borderRadius: s(16), backgroundColor: 'rgba(185,139,255,0.12)', padding: s(16), gap: s(10) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(7) }}>
        <Ionicons name="flag" size={s(16)} color={FN.accent} />
        <Typography variant="body-01" weight="bold" style={{ color: FN.text }}>한 줄 결론</Typography>
      </View>
      <Typography variant="body-03" style={{ color: FN.sub, lineHeight: s(20) }}>
        FAB·홈은 '공간'으로 고쳤는데 <Typography variant="body-03" weight="semibold" style={{ color: FN.text }}>정지 직후만 옛 흐름(처리 풀스크린 점프)</Typography>이라 불일치가 가장 큼.
        문서의 <Typography variant="body-03" weight="semibold" style={{ color: FN.accent }}>대안 A</Typography>(정지→홈/목록 복귀 · 처리=백그라운드 카드/토스트 · AI=노트 버튼)가 이걸 직답하고,
        홈(장소)·미니바·ProcessingHost 인프라가 이미 깔려 있어 레버리지가 큼.
      </Typography>
      <View style={{ height: 1, backgroundColor: FN.line, marginVertical: s(2) }} />
      <Typography variant="label-01" weight="semibold" style={{ color: FN.text }}>다음 수 (제안)</Typography>
      {[
        'finalizeRecording의 _quick push 제거 → 홈 복귀 + 처리는 백그라운드 카드/토스트',
        'StopConfirmModal "분석" 결정 제거 → "마칠까요?"로 단순화 + 전사 자동/AI 노트 버튼 분리',
        'DetailView vestigial 로컬 녹음 엔진 정리 → 글로벌 일원화',
      ].map((t, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: s(7) }}>
          <Typography variant="body-03" weight="bold" style={{ color: FN.accent }}>{i + 1}</Typography>
          <Typography variant="body-03" style={{ color: FN.sub, flex: 1, lineHeight: s(19) }}>{t}</Typography>
        </View>
      ))}
    </View>
  );
}

// ════════════════════ 루트 ════════════════════
type Tab = 'flow' | 'findings' | 'improved';
const TABS: { key: Tab; label: string }[] = [
  { key: 'flow', label: '현재 흐름' },
  { key: 'findings', label: '발견' },
  { key: 'improved', label: '개선' },
];

export default function FieldNoteFlowAuditLab() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('flow');

  return (
    <View className="flex-1 bg-base">
      <SafeAreaView edges={['top']} style={{ backgroundColor: COLORS.white }}>
        <View style={{ height: s(48), paddingHorizontal: s(LAYOUT.screenPaddingX), flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8} accessibilityLabel="뒤로 가기" accessibilityRole="button">
            <Icon name="arrow-left" size={24} color={COLORS.gray[900]} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Typography variant="title-01" weight="semibold" className="text-gray-900">필드노트 흐름 진단 (현재 코드)</Typography>
          </View>
          <View style={{ width: 24 }} />
        </View>
        <View style={{ paddingHorizontal: s(LAYOUT.screenPaddingX), paddingBottom: s(12) }}>
          <View style={{ flexDirection: 'row', backgroundColor: COLORS.gray[50], borderRadius: s(10), padding: s(3) }}>
            {TABS.map((t) => {
              const active = tab === t.key;
              return (
                <Pressable key={t.key} onPress={() => setTab(t.key)} style={{ flex: 1, paddingVertical: s(8), borderRadius: s(8), backgroundColor: active ? COLORS.white : 'transparent', alignItems: 'center' }}>
                  <Typography variant="label-01" weight={active ? 'semibold' : 'regular'} style={{ color: active ? COLORS.gray[900] : COLORS.gray[500] }}>{t.label}</Typography>
                </Pressable>
              );
            })}
          </View>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ padding: s(LAYOUT.screenPaddingX), paddingBottom: s(60) }}>
        <View style={{ marginBottom: s(12), flexDirection: 'row', alignItems: 'center', gap: s(6) }}>
          <Ionicons name="information-circle-outline" size={s(15)} color={COLORS.gray[500]} />
          <Typography variant="body-03" className="text-gray-500" style={{ flex: 1 }}>
            2026-06-04 재점검. 짝: field-note-flow(미래 3안) + claudedocs/fieldnote-flow-redesign.md. 코드 근거는 보라색 줄.
          </Typography>
        </View>

        {tab === 'improved' && (
          <View style={{ marginBottom: s(12), borderRadius: s(12), backgroundColor: 'rgba(0,191,64,0.12)', padding: s(12), flexDirection: 'row', gap: s(8) }}>
            <Ionicons name="server-outline" size={s(15)} color={COLORS.palette.green} />
            <Typography variant="label-02" style={{ color: FN.sub, flex: 1, lineHeight: s(17) }}>
              백엔드 변경 0. finish · ProcessingHost(백그라운드+토스트) · generateSummary/generateCounselingNote(개별 호출) · skipPipeline 모두 이미 존재. 두 층위(전사 자동 / AI 선택)도 백엔드에 이미 분리됨. 프론트에서 정지 후 push 제거 + 모달 단순화 + AI를 노트 버튼으로 옮기는 게 핵심.
            </Typography>
          </View>
        )}

        {tab === 'flow' ? <FlowRail /> : tab === 'findings' ? <FindingsList /> : <ImprovedRail />}
        <VerdictCard />
      </ScrollView>
    </View>
  );
}
