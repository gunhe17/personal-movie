import { useEffect, useRef, useState } from 'react';
import { View, ScrollView, TouchableOpacity, Pressable, Animated } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, LAYOUT } from '@/shared/constants/theme';
import { Typography } from '@/shared/components/ui/Typography';
import { Icon } from '@/shared/components/icons';
import { Skeleton } from '@/shared/components/ui/Skeleton';
import { s } from '@/shared/utils/scale';

/**
 * [검사 상세] "톤 앤 매너" 재구성 비교 lab.
 *
 * 사용자 요청: 내담자 상세(client/[id]) 레이아웃을 복제하라는 게 아니라, 그 "톤 앤 매너"
 * (설계 DNA·품질 바)로 검사 상세를 재구성. 검사 고유 구조(Hero 개요 + 검사 항목 + 내담자 + 청구)는
 * 유지하되 같은 결을 입힌다. 같은 톤을 "어디에 무게를 두고 표현하나"로 여러 케이스를 비교한다.
 *
 * 가져올 톤(복제 아님): 1)액션 우선 2)강조 계층 3)정체성 고정(헤더 내담자명, 검사 1:1)
 * 4)디자인 시스템 충실(스켈레톤·gap 토큰·헤더↔콘텐츠 16) 5)친절 라이팅 6)색 절제.
 *
 * 탭:
 *  - [현재]  production 충실 재현(대조군) — 빈 헤더·중앙 타일(연락처 없음)
 *  - [절제]  Hero 안에 "할 일" warning 칩 (가장 조용함, 권장 A)
 *  - [히어로] 최상단 어텐션 카드로 시급한 1건 강조 (agentic, 권장 B)
 *  - [단계]  접수→실시→소견→결과→보고서 스텝퍼로 "흐름" 정면화
 *  - [항목]  Hero 축소·검사 항목이 주인공(카드마다 다음 할 일 CTA)
 *
 * 전부 mock. 확정 시 assessment/[id].tsx + 신규 _components/AssessmentDetailSkeleton 으로 포팅.
 */

type TabKey = 'current' | 'subtle' | 'hero' | 'flow' | 'worklist' | 'combo' | 'cstyle';

const TABS: { key: TabKey; label: string; caption: string }[] = [
  {
    key: 'current',
    label: '현재',
    caption: '현 production 충실 재현(대조군). 빈 헤더·로딩 스피너·내담자 중앙 타일(연락처 없음).',
  },
  {
    key: 'subtle',
    label: '절제',
    caption:
      '권장 A — 정체성 헤더 + Hero 안에 "할 일" warning 칩 + 내담자 정보카드(연락처). 가장 조용. 단, 시급한 1건이 Hero에 묻힘.',
  },
  {
    key: 'hero',
    label: '히어로',
    caption:
      '권장 B — 최상단에 가장 시급한 1건을 큰 어텐션 카드로(client 상세 톤·펄스). agentic·assertive. 단, 검사 정체성보다 액션이 먼저 와 "무슨 검사"가 한 박자 늦음.',
  },
  {
    key: 'flow',
    label: '단계',
    caption:
      '진행 단계 — 접수→실시→소견→결과→보고서 스텝퍼로 "흐름" 정면화 + 다음 단계 CTA. 단, task별 단계가 제각각이라 단일 파이프라인 환원은 다소 무리(예시).',
  },
  {
    key: 'worklist',
    label: '항목',
    caption:
      '항목 중심 — Hero를 한 줄로 축소, 검사 항목이 주인공(카드마다 다음 할 일 CTA). 실제 작업이 task 단위임을 정면화. 단, 일정·종합보고서 등 케이스 정보는 약화.',
  },
  {
    key: 'combo',
    label: '콤보',
    caption:
      '히어로+단계 조합 — 한 장의 "진행 카드"에 정체성(검사명·진행도) + 스텝퍼(지금 어느 단계) + 그 단계의 다음 행동을 펄스 CTA로 강조. 아래에 일정·보고서·메모는 보조 카드로 분리. 오리엔테이션과 액션을 한 번에. 단, 카드가 무거워 시각 밀도 관리 필요.',
  },
  {
    key: 'cstyle',
    label: '상담형',
    caption:
      '상담 상세(counseling/[id]) 레이아웃을 검사에 이식 + 검사용 보완. 내담자 이름이 Hero 타이틀(검사명 부제) + 소견 미작성 배너 + 1:1 청구는 Hero 안 + 검사 항목을 회기 리스트처럼(제목+필드노트 칩+상태 뱃지+결과보기 게이팅+소견 여부 부제). 보완: 항목별 필드노트 진입·결과보기 + 하단 내담자 정보(생년월일·연락처·보호자 탭투콜, 스펙 §3-6).',
  },
];

// ──────────────── mock ────────────────

const CLIENT = {
  name: '김민준',
  gender: 'male' as const,
  age: 8,
  birth: '2017. 09. 12',
  phone: '010-1234-5678',
  guardianPhone: '010-9876-5432',
};

type TaskMock = {
  id: string;
  name: string;
  status: 'completed' | 'submitted' | 'in_progress' | 'pending';
  hasOpinion: boolean;
  fn: 'none' | 'analyzing' | 'done' | 'online';
  completedAt?: string;
  hasResult: boolean;
};

const TASKS: TaskMock[] = [
  { id: 't1', name: 'BGT (벤더게슈탈트)', status: 'completed', hasOpinion: true, fn: 'done', completedAt: '2026. 6. 5 완료', hasResult: true },
  { id: 't2', name: 'HTP (집-나무-사람)', status: 'submitted', hasOpinion: false, fn: 'analyzing', hasResult: true },
  { id: 't3', name: 'SCT (문장완성검사)', status: 'pending', hasOpinion: false, fn: 'none', hasResult: false },
  { id: 't4', name: 'K-WISC-V (온라인)', status: 'in_progress', hasOpinion: false, fn: 'online', hasResult: false },
];

const SCHEDULE = '2026. 6. 10 (수) 14:00 - 16:00';
const SCHEDULE_SHORT = '6/10 (수) 14:00';
const ROOM = '검사실';
const NOTE = '검사 전 보호자 동의서 확인';

const TASK_STATUS: Record<string, { label: string; bg: string; fg: string }> = {
  pending: { label: '예정', bg: COLORS.paletteBg.gray, fg: COLORS.palette.gray },
  in_progress: { label: '진행중', bg: COLORS.paletteBg.blue, fg: COLORS.palette.blue },
  submitted: { label: '제출됨', bg: COLORS.paletteBg.yellow, fg: COLORS.palette.yellow },
  completed: { label: '완료', bg: COLORS.paletteBg.green, fg: COLORS.palette.green },
};

const completedCount = TASKS.filter((t) => t.status === 'completed' || t.status === 'submitted').length;
const totalCount = TASKS.length;
const opinionTodo = TASKS.filter((t) => (t.status === 'submitted' || t.status === 'completed') && !t.hasOpinion).length;

function getInitial(name: string): string {
  return name.trim().charAt(0) || '?';
}

const genderLabel = CLIENT.gender === 'male' ? '남' : CLIENT.gender === 'female' ? '여' : '';
const clientMeta = [genderLabel, `만 ${CLIENT.age}세`].filter(Boolean).join(' · ');

// ──────────────── Page ────────────────

export default function AssessmentDetailToneLab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [tabKey, setTabKey] = useState<TabKey>('cstyle');
  const [showSkeleton, setShowSkeleton] = useState(false);
  const active = TABS.find((t) => t.key === tabKey)!;
  const isCurrent = tabKey === 'current';
  // 상담형은 상담 상세처럼 헤더를 비우고 이름을 Hero 타이틀로, 청구를 Hero 안에 둔다.
  const showIdentityHeader = !isCurrent && tabKey !== 'cstyle';

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: COLORS.bg.base }} edges={['top']}>
      {/* lab 헤더 */}
      <View className="h-[52px] flex-row items-center px-5" style={{ backgroundColor: COLORS.bg.base }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} accessibilityLabel="뒤로 가기" accessibilityRole="button">
          <Icon name="arrow-left" size={24} color={COLORS.gray[900]} />
        </TouchableOpacity>
        <Typography variant="title-01" weight="semibold" className="ml-1.5 text-gray-900">
          검사 상세 · 톤 앤 매너
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
        {!isCurrent && (
          <TouchableOpacity
            onPress={() => setShowSkeleton((v) => !v)}
            activeOpacity={0.7}
            style={{ marginTop: s(8), alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: s(4), paddingVertical: s(4), paddingHorizontal: s(8), borderRadius: s(999), backgroundColor: COLORS.gray[100] }}
          >
            <Ionicons name={showSkeleton ? 'eye-off-outline' : 'eye-outline'} size={13} color={COLORS.gray[600]} />
            <Typography variant="label-02" weight="medium" className="text-gray-600">
              {showSkeleton ? '콘텐츠 보기' : '스켈레톤 미리보기'}
            </Typography>
          </TouchableOpacity>
        )}
      </View>

      {/* 검사 상세 화면 헤더 (현재·상담형=빈 chevron / 그 외=정체성 고정) */}
      <View style={{ marginTop: s(12) }}>
        <MockScreenHeader showIdentity={showIdentityHeader} />
      </View>

      {!isCurrent && showSkeleton ? (
        <AssessmentDetailSkeleton />
      ) : (
        <ScrollView style={{ backgroundColor: COLORS.white }} contentContainerStyle={{ paddingBottom: s(100) }}>
          {tabKey === 'current' && <BodyCurrent />}
          {tabKey === 'subtle' && <BodySubtle />}
          {tabKey === 'hero' && <BodyHero />}
          {tabKey === 'flow' && <BodyFlow />}
          {tabKey === 'worklist' && <BodyWorklist />}
          {tabKey === 'combo' && <BodyCombo />}
          {tabKey === 'cstyle' && <BodyCounselingStyle />}
        </ScrollView>
      )}

      {/* 청구 푸터 (고정) — 상담형은 청구를 Hero 안에 두므로 푸터 없음 */}
      {tabKey !== 'cstyle' && (
        <View
          style={{
            backgroundColor: COLORS.white,
            borderTopWidth: 1,
            borderColor: COLORS.gray[100],
            paddingHorizontal: s(20),
            paddingTop: s(12),
            paddingBottom: insets.bottom + s(12),
          }}
        >
          <View style={{ backgroundColor: COLORS.primary, borderRadius: s(12), paddingVertical: s(14), alignItems: 'center' }}>
            <Typography variant="body-01" weight="semibold" style={{ color: COLORS.white }}>
              청구하기
            </Typography>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

// ════════════════ 탭별 본문 ════════════════

function BodyCurrent() {
  return (
    <>
      <View style={{ backgroundColor: COLORS.bg.base, paddingTop: s(12), paddingBottom: s(20) }}>
        <Hero />
      </View>
      <View style={{ backgroundColor: COLORS.white, paddingTop: s(24), paddingHorizontal: s(20) }}>
        <SectionTitle title="검사 항목" />
        <View style={{ gap: s(10), marginBottom: s(24) }}>
          {TASKS.map((t) => (
            <TaskCard key={t.id} task={t} gateResult={false} />
          ))}
        </View>
        <View className="flex-row items-baseline" style={{ gap: s(6), marginBottom: s(12) }}>
          <Typography variant="title-01" weight="semibold" className="text-gray-900">내담자</Typography>
          <Typography variant="label-01" className="text-gray-500">1명</Typography>
        </View>
        <ClientTile />
      </View>
    </>
  );
}

function BodySubtle() {
  return (
    <>
      <View style={{ backgroundColor: COLORS.bg.base, paddingTop: s(16), paddingBottom: s(20) }}>
        <Hero showTodo />
      </View>
      <WhiteZone />
    </>
  );
}

function BodyHero() {
  return (
    <>
      <View style={{ backgroundColor: COLORS.bg.base, paddingTop: s(16), paddingBottom: s(20), gap: s(12) }}>
        <AttentionHero />
        <AttentionMiniRow />
        <Hero />
      </View>
      <WhiteZone />
    </>
  );
}

function BodyFlow() {
  return (
    <>
      <View style={{ backgroundColor: COLORS.bg.base, paddingTop: s(16), paddingBottom: s(20) }}>
        <Hero showFlow />
      </View>
      <WhiteZone />
    </>
  );
}

function BodyWorklist() {
  return (
    <>
      <View style={{ backgroundColor: COLORS.bg.base, paddingTop: s(16), paddingBottom: s(16) }}>
        <CompactHeroStrip />
      </View>
      <View style={{ backgroundColor: COLORS.white, paddingTop: s(20), paddingHorizontal: s(20) }}>
        <SectionTitle title="검사 항목" />
        <View style={{ gap: s(10), marginBottom: s(24) }}>
          {TASKS.map((t) => (
            <WorklistTaskCard key={t.id} task={t} />
          ))}
        </View>
        <SectionTitle title="내담자" />
        <ClientInfoCard />
      </View>
    </>
  );
}

// [콤보] 히어로+단계 — 진행 카드(정체성+스텝퍼+다음 행동 CTA) + 보조 정보 카드
function BodyCombo() {
  return (
    <>
      <View style={{ backgroundColor: COLORS.bg.base, paddingTop: s(16), paddingBottom: s(20), gap: s(12) }}>
        <ComboHeroCard />
        <DetailCard />
      </View>
      <WhiteZone />
    </>
  );
}

function ComboHeroCard() {
  const progress = totalCount > 0 ? completedCount / totalCount : 0;
  const fg = COLORS.palette.orange;
  return (
    <View style={{ marginHorizontal: s(20), backgroundColor: COLORS.white, borderRadius: s(20), padding: s(20), gap: s(16), shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2 }}>
      {/* 정체성 (compact) + 상태 */}
      <View style={{ gap: s(10) }}>
        <View className="flex-row items-center" style={{ gap: s(8) }}>
          <SetBadge />
          <Typography variant="body-01" weight="semibold" className="flex-1 text-gray-900" numberOfLines={1}>
            풀배터리 (종합심리검사)
          </Typography>
          <View style={{ backgroundColor: COLORS.paletteBg.orange }} className="rounded-full px-2.5 py-1">
            <Typography variant="label-02" weight="semibold" style={{ color: COLORS.palette.orange }}>진행중</Typography>
          </View>
        </View>
        <View className="flex-row items-center" style={{ gap: s(8) }}>
          <View style={{ flex: 1 }}>
            <ProgressBar progress={progress} />
          </View>
          <Typography variant="label-01" weight="medium" className="text-gray-600">{completedCount}/{totalCount}건</Typography>
        </View>
      </View>

      <View className="h-px bg-gray-100" />

      {/* 스텝퍼 (오리엔테이션 — 지금 어느 단계) */}
      <FlowStepper showCta={false} />

      <View className="h-px bg-gray-100" />

      {/* 지금 할 일 — 현재 단계의 다음 행동을 펄스 CTA로 강조 */}
      <View className="flex-row items-center" style={{ gap: s(14) }}>
        <View style={{ flex: 1, gap: s(8) }}>
          <View className="flex-row items-center" style={{ gap: s(6) }}>
            <Ionicons name="create-outline" size={15} color={fg} />
            <Typography variant="label-01" weight="bold" style={{ color: fg, letterSpacing: 0.3 }}>지금 단계 · 소견</Typography>
          </View>
          <Typography variant="body-01" weight="semibold" className="text-gray-900">HTP 소견을 작성해 주세요</Typography>
          <Typography variant="label-01" className="text-gray-600">제출된 검사 1건의 소견이 비어 있어요</Typography>
        </View>
        <PulsePill fg={fg} />
      </View>
    </View>
  );
}

// 일정·종합보고서·메모 — 콤보에선 보조 카드로 분리
function DetailCard() {
  return (
    <View style={{ marginHorizontal: s(20), backgroundColor: COLORS.white, borderRadius: s(16), padding: s(16), gap: s(8) }}>
      <HeroRow label="일정">
        <Typography variant="label-01" weight="medium" className="text-gray-900">{SCHEDULE}</Typography>
        <Typography variant="label-01" className="text-gray-600">{ROOM}</Typography>
      </HeroRow>
      <HeroRow label="종합보고서">
        <Typography variant="label-01" weight="medium" style={{ color: COLORS.warning }}>작성이 필요해요</Typography>
      </HeroRow>
      <HeroRow label="메모">
        <Typography variant="label-01" weight="medium" className="flex-1 text-gray-900" numberOfLines={2}>{NOTE}</Typography>
      </HeroRow>
    </View>
  );
}

// ════════════════ [상담형] 상담 상세 레이아웃을 검사에 이식 ════════════════

function BodyCounselingStyle() {
  return (
    <>
      {/* Gray Zone — 소견 미작성 배너 + Hero(이름 타이틀·검사명 부제·진행도·청구) */}
      <View style={{ backgroundColor: COLORS.bg.base, paddingTop: s(12), paddingBottom: s(20) }}>
        {opinionTodo > 0 && <OpinionAlert count={opinionTodo} />}
        <CStyleHero />
      </View>

      {/* White Zone — 검사 항목을 회기 리스트처럼 + 내담자 정보(검사용 보완) */}
      <View style={{ backgroundColor: COLORS.white, paddingTop: s(24), paddingBottom: s(24), paddingHorizontal: s(20) }}>
        <View className="flex-row items-baseline" style={{ gap: s(6), marginBottom: s(12) }}>
          <Typography variant="title-01" weight="semibold" className="text-gray-900">검사 항목</Typography>
          <Typography variant="label-01" className="text-gray-500">{totalCount}건</Typography>
        </View>
        <View style={{ gap: s(10), marginBottom: s(24) }}>
          {TASKS.map((t) => (
            <AssessmentItemRow key={t.id} task={t} />
          ))}
        </View>

        {/* 검사용 보완: 상담 1:1엔 없던 내담자 연락처/보호자를 섹션으로 노출 (스펙 §3-6) */}
        <SectionTitle title="내담자" />
        <ClientInfoCard />
      </View>
    </>
  );
}

// 소견 미작성 알림 — 상담의 "일지 미작성 alert"(primary solid)를 검사 소견으로
function OpinionAlert({ count }: { count: number }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`작성해야 할 소견 ${count}건`}
      style={({ pressed }) => ({
        marginHorizontal: s(20),
        marginBottom: s(12),
        backgroundColor: COLORS.primary700,
        borderRadius: s(20),
        paddingHorizontal: s(18),
        paddingVertical: s(16),
        flexDirection: 'row',
        alignItems: 'center',
        gap: s(14),
        opacity: pressed ? 0.92 : 1,
      })}
    >
      <View style={{ width: s(44), height: s(44), borderRadius: s(22), backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="create-outline" size={22} color={COLORS.white} />
      </View>
      <View style={{ flex: 1, gap: s(2) }}>
        <Typography variant="body-02" weight="bold" style={{ color: COLORS.white }}>
          작성해야 할 소견이 {count}건 있어요!
        </Typography>
        <Typography variant="body-03" style={{ color: 'rgba(255,255,255,0.92)' }}>
          HTP (집-나무-사람)
        </Typography>
      </View>
      <Ionicons name="chevron-forward" size={20} color={COLORS.white} />
    </Pressable>
  );
}

// 상담 Hero 형태 — 이름(+성별·나이) 타이틀 / 검사명 부제 / 진행도 / 1:1 청구 버튼
function CStyleHero() {
  const progress = totalCount > 0 ? completedCount / totalCount : 0;
  return (
    <View style={{ marginHorizontal: s(20), backgroundColor: COLORS.white, borderRadius: s(20), padding: s(20), gap: s(16) }}>
      {/* 타이틀 행: 이름 + 성별·나이 + 상태 뱃지 */}
      <View className="flex-row items-start" style={{ gap: s(8) }}>
        <View style={{ flex: 1, gap: s(4) }}>
          <View className="flex-row items-baseline" style={{ gap: s(6), flexWrap: 'wrap' }}>
            <Typography variant="headline-02" weight="bold" className="text-gray-900" numberOfLines={2}>
              {CLIENT.name}
            </Typography>
            <Typography variant="body-03" className="text-gray-500">{clientMeta}</Typography>
          </View>
          {/* 검사명(세트) — 상담의 program_name 자리 */}
          <View className="flex-row items-center" style={{ gap: s(6) }}>
            <SetBadge />
            <Typography variant="body-02" weight="medium" className="flex-1 text-gray-600" numberOfLines={1}>
              풀배터리 (종합심리검사)
            </Typography>
          </View>
        </View>
        <View style={{ marginTop: s(4), backgroundColor: COLORS.paletteBg.orange }} className="rounded-full px-2.5 py-1">
          <Typography variant="label-02" weight="semibold" style={{ color: COLORS.palette.orange }}>진행중</Typography>
        </View>
      </View>

      {/* 큰 숫자 진행도 */}
      <View style={{ gap: s(10) }}>
        <View className="flex-row items-baseline" style={{ gap: s(4) }}>
          <Typography variant="title-01" weight="bold" style={{ color: COLORS.primary }}>{completedCount}</Typography>
          <Typography variant="body-02" weight="medium" className="text-gray-400">/ {totalCount}건 완료</Typography>
        </View>
        <ProgressBar progress={progress} />
      </View>

      {/* 1:1 청구 버튼 (상담 1:1과 동일) */}
      <View style={{ backgroundColor: COLORS.gray[100], borderRadius: s(10), paddingVertical: s(10), alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="label-01" weight="semibold" className="text-gray-700">청구</Typography>
      </View>
    </View>
  );
}

// 검사 항목 행 — 상담의 SessionRow(제목 + 상태 뱃지 + 화살표 + 부제) 형태
function getOpinionSubtitle(task: TaskMock): string | null {
  // 상담의 getSessionSubtitle 미러 — 제출/완료 항목만 소견 작성 여부 노출
  if (task.status !== 'submitted' && task.status !== 'completed') return null;
  return task.hasOpinion ? '소견을 작성했어요' : '아직 소견을 작성하지 않았어요';
}

function AssessmentItemRow({ task }: { task: TaskMock }) {
  const st = TASK_STATUS[task.status];
  const subtitle = getOpinionSubtitle(task);
  const written = task.hasOpinion;
  return (
    <View style={{ backgroundColor: COLORS.gray[50], borderRadius: s(16), paddingVertical: s(16), paddingHorizontal: s(16), gap: subtitle ? s(6) : 0 }}>
      <View className="flex-row items-center" style={{ gap: s(8) }}>
        <Typography variant="body-02" weight="semibold" className="text-gray-900 flex-1" numberOfLines={1}>
          {task.name}
        </Typography>
        {/* 검사용 보완: 항목별 필드노트 진입 (온라인 검사 제외) */}
        {task.fn !== 'online' && <FieldNoteChip state={task.fn} compact />}
        <View style={{ backgroundColor: st.bg, paddingHorizontal: s(10), paddingVertical: s(4), borderRadius: s(16) }}>
          <Typography variant="label-02" weight="semibold" style={{ color: st.fg }}>{st.label}</Typography>
        </View>
        {/* 검사용 보완: 결과 있는 항목만 결과보기 화살표 */}
        {task.hasResult ? (
          <Icon name="arrow-right" size={14} color={COLORS.gray[400]} />
        ) : (
          <View style={{ width: s(14) }} />
        )}
      </View>
      {subtitle && (
        <Typography variant="body-03" numberOfLines={1} style={{ color: written ? COLORS.gray[400] : COLORS.gray[600] }}>
          {subtitle}
        </Typography>
      )}
    </View>
  );
}

// 정체성 헤더 + 검사항목 + 내담자 정보카드 (절제/히어로/단계 공통)
function WhiteZone() {
  return (
    <View style={{ backgroundColor: COLORS.white, paddingTop: s(24), paddingHorizontal: s(20) }}>
      <SectionTitle title="검사 항목" />
      <View style={{ gap: s(10), marginBottom: s(24) }}>
        {TASKS.map((t) => (
          <TaskCard key={t.id} task={t} gateResult />
        ))}
      </View>
      <SectionTitle title="내담자" />
      <ClientInfoCard />
    </View>
  );
}

// ──────────────── 화면 헤더 ────────────────

function MockScreenHeader({ showIdentity }: { showIdentity: boolean }) {
  return (
    <View className="h-[44px] flex-row items-center px-5" style={{ backgroundColor: COLORS.white, borderBottomWidth: 1, borderColor: COLORS.gray[100] }}>
      <Ionicons name="chevron-back" size={22} color={COLORS.gray[900]} />
      {showIdentity && (
        <View className="flex-1 flex-row items-baseline" style={{ marginLeft: s(6), gap: s(6) }}>
          <Typography variant="body-01" weight="semibold" className="text-gray-900" numberOfLines={1}>
            {CLIENT.name}
          </Typography>
          <Typography variant="label-01" className="text-gray-500" numberOfLines={1}>
            {clientMeta}
          </Typography>
        </View>
      )}
    </View>
  );
}

// ──────────────── Hero ────────────────

function Hero({ showTodo = false, showFlow = false }: { showTodo?: boolean; showFlow?: boolean }) {
  const progress = totalCount > 0 ? completedCount / totalCount : 0;
  return (
    <View style={{ marginHorizontal: s(20), backgroundColor: COLORS.white, borderRadius: s(20), padding: s(20), gap: s(16) }}>
      <View className="flex-row items-center">
        <Typography variant="label-01" weight="semibold" style={{ color: COLORS.primary700 }}>진행중인 검사</Typography>
        <View style={{ marginLeft: 'auto', backgroundColor: COLORS.paletteBg.orange }} className="rounded-full px-2.5 py-1">
          <Typography variant="label-02" weight="semibold" style={{ color: COLORS.palette.orange }}>진행중</Typography>
        </View>
      </View>

      <View className="flex-row items-center" style={{ gap: s(8) }}>
        <SetBadge />
        <Typography variant="headline-02" weight="semibold" className="flex-1 text-gray-900" numberOfLines={2}>
          풀배터리 (종합심리검사)
        </Typography>
      </View>

      <View style={{ gap: s(10) }}>
        <View className="flex-row items-baseline" style={{ gap: s(4) }}>
          <Typography variant="title-01" weight="bold" style={{ color: COLORS.primary }}>{completedCount}</Typography>
          <Typography variant="body-02" weight="medium" className="text-gray-400">/ {totalCount}건 완료</Typography>
        </View>
        <ProgressBar progress={progress} />
      </View>

      <View className="h-px bg-gray-100" />

      <View style={{ gap: s(8) }}>
        <HeroRow label="일정">
          <Typography variant="label-01" weight="medium" className="text-gray-900">{SCHEDULE}</Typography>
          <Typography variant="label-01" className="text-gray-600">{ROOM}</Typography>
        </HeroRow>
        <HeroRow label="종합보고서">
          <Typography variant="label-01" weight="medium" style={{ color: COLORS.warning }}>작성이 필요해요</Typography>
        </HeroRow>
        <HeroRow label="메모">
          <Typography variant="label-01" weight="medium" className="flex-1 text-gray-900" numberOfLines={2}>{NOTE}</Typography>
        </HeroRow>
      </View>

      {showTodo && opinionTodo > 0 && (
        <>
          <View className="h-px bg-gray-100" />
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: s(8) }}>
            <Typography variant="label-01" className="text-gray-500" style={{ width: s(72) }}>지금 할 일</Typography>
            <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: s(6) }}>
              <TodoChip icon="create-outline" label={`소견 ${opinionTodo}건 미작성`} />
              <TodoChip icon="card-outline" label="청구 미발행" />
            </View>
          </View>
        </>
      )}

      {showFlow && (
        <>
          <View className="h-px bg-gray-100" />
          <FlowStepper />
        </>
      )}
    </View>
  );
}

function HeroRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="flex-row">
      <Typography variant="label-01" className="text-gray-500" style={{ width: s(72) }}>{label}</Typography>
      <View className="flex-1">{children}</View>
    </View>
  );
}

function SetBadge() {
  return (
    <View className="items-center justify-center rounded-sm border border-gray-200" style={{ height: s(22), paddingHorizontal: s(6) }}>
      <Typography variant="label-02" weight="medium" style={{ color: COLORS.warning }}>세트</Typography>
    </View>
  );
}

function ProgressBar({ progress }: { progress: number }) {
  return (
    <View style={{ height: s(6), borderRadius: s(3), backgroundColor: COLORS.gray[100], overflow: 'hidden' }}>
      <View style={{ width: `${progress * 100}%`, height: '100%', backgroundColor: COLORS.primary, borderRadius: s(3) }} />
    </View>
  );
}

// ──────────────── [단계] 진행 스텝퍼 ────────────────

function FlowStepper({ showCta = true }: { showCta?: boolean }) {
  // 예시: 접수✓ 실시✓ 소견(지금) 결과 보고서. (mock — 캡션의 "무리" 캐비엇 참고)
  const steps = [
    { key: '접수', state: 'done' as const },
    { key: '실시', state: 'done' as const },
    { key: '소견', state: 'current' as const },
    { key: '결과', state: 'todo' as const },
    { key: '보고서', state: 'todo' as const },
  ];
  return (
    <View style={{ gap: s(12) }}>
      <View className="flex-row items-start">
        {steps.map((st, i) => (
          <View key={st.key} style={{ flex: 1, alignItems: 'center' }}>
            <View className="flex-row items-center" style={{ width: '100%' }}>
              <Line filled={st.state === 'done'} hidden={i === 0} />
              <StepDot state={st.state} />
              <Line filled={st.state === 'done' || (st.state === 'current')} hidden={i === steps.length - 1} />
            </View>
            <Typography
              variant="label-02"
              weight={st.state === 'current' ? 'semibold' : 'regular'}
              style={{ color: st.state === 'current' ? COLORS.primary700 : st.state === 'done' ? COLORS.gray[600] : COLORS.gray[400], marginTop: s(6) }}
            >
              {st.key}
            </Typography>
          </View>
        ))}
      </View>
      {/* 다음 단계 CTA */}
      {showCta && (
      <Pressable
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: s(6),
          backgroundColor: COLORS.primary50,
          borderRadius: s(12),
          paddingVertical: s(12),
          opacity: pressed ? 0.7 : 1,
        })}
        accessibilityRole="button"
      >
        <Ionicons name="create-outline" size={15} color={COLORS.primary700} />
        <Typography variant="label-01" weight="semibold" style={{ color: COLORS.primary700 }}>
          다음 단계 · HTP 소견 작성하기
        </Typography>
      </Pressable>
      )}
    </View>
  );
}

function StepDot({ state }: { state: 'done' | 'current' | 'todo' }) {
  if (state === 'done') {
    return (
      <View style={{ width: s(22), height: s(22), borderRadius: s(11), backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="checkmark" size={13} color={COLORS.white} />
      </View>
    );
  }
  if (state === 'current') {
    return (
      <View style={{ width: s(22), height: s(22), borderRadius: s(11), borderWidth: 2, borderColor: COLORS.primary, backgroundColor: COLORS.primary50, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: s(8), height: s(8), borderRadius: s(4), backgroundColor: COLORS.primary }} />
      </View>
    );
  }
  return <View style={{ width: s(22), height: s(22), borderRadius: s(11), borderWidth: 2, borderColor: COLORS.gray[200], backgroundColor: COLORS.white }} />;
}

function Line({ filled, hidden }: { filled: boolean; hidden: boolean }) {
  return <View style={{ flex: 1, height: 2, backgroundColor: hidden ? 'transparent' : filled ? COLORS.primary : COLORS.gray[200] }} />;
}

// ──────────────── [히어로] 어텐션 카드 ────────────────

function AttentionHero() {
  // 가장 시급한 1건: HTP 소견 미작성
  const fg = COLORS.palette.orange;
  return (
    <View style={{ marginHorizontal: s(20) }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="HTP 소견 미작성, 작성하기"
        style={({ pressed }) => ({
          backgroundColor: COLORS.white,
          borderRadius: s(16),
          flexDirection: 'row',
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOpacity: 0.08,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 3,
          opacity: pressed ? 0.92 : 1,
        })}
      >
        <View style={{ width: s(8), alignSelf: 'stretch', backgroundColor: fg }} />
        <View className="flex-1 flex-row items-center" style={{ padding: s(18), gap: s(14) }}>
          <View style={{ flex: 1, gap: s(10) }}>
            <View className="flex-row items-center" style={{ gap: s(6) }}>
              <Ionicons name="create-outline" size={16} color={fg} />
              <Typography variant="label-01" weight="bold" style={{ color: fg, letterSpacing: 0.3 }}>소견 미작성</Typography>
            </View>
            <View style={{ gap: s(4) }}>
              <Typography variant="headline-02" weight="semibold" className="text-gray-900">HTP 소견을 작성해 주세요</Typography>
              <Typography variant="body-02" className="text-gray-600" style={{ lineHeight: s(22) }}>
                제출된 검사 1건의 소견이 비어 있어요.
              </Typography>
            </View>
          </View>
          <PulsePill fg={fg} />
        </View>
      </Pressable>
    </View>
  );
}

function AttentionMiniRow() {
  const fg = COLORS.palette.yellow;
  return (
    <View style={{ marginHorizontal: s(20) }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="청구 미발행, 청구하기"
        style={({ pressed }) => ({
          backgroundColor: COLORS.white,
          borderRadius: s(12),
          flexDirection: 'row',
          alignItems: 'center',
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOpacity: 0.05,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 1 },
          elevation: 1,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <View style={{ width: s(4), alignSelf: 'stretch', backgroundColor: fg }} />
        <View className="flex-1 flex-row items-center" style={{ paddingVertical: s(12), paddingHorizontal: s(14), gap: s(10) }}>
          <Ionicons name="card-outline" size={16} color={fg} />
          <View style={{ flex: 1 }}>
            <Typography variant="body-03" weight="semibold" className="text-gray-900" numberOfLines={1}>청구가 아직이에요</Typography>
            <Typography variant="label-01" className="text-gray-500" numberOfLines={1}>검사 완료 후 청구를 발행할 수 있어요</Typography>
          </View>
          <Ionicons name="chevron-forward" size={14} color={COLORS.gray[400]} />
        </View>
      </Pressable>
    </View>
  );
}

// 펄스 ring 이 있는 액션 pill (client 상세 AttentionHero 톤)
function PulsePill({ fg }: { fg: string }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1800, useNativeDriver: true }), { resetBeforeIteration: true });
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 0.1, 1], outputRange: [0, 0.32, 0] });
  return (
    <View style={{ position: 'relative' }}>
      <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: fg, borderRadius: s(14), transform: [{ scale: ringScale }], opacity: ringOpacity }} />
      <View style={{ backgroundColor: fg, paddingHorizontal: s(16), paddingVertical: s(14), borderRadius: s(14), minHeight: s(56), minWidth: s(72), alignItems: 'center', justifyContent: 'center', gap: s(2) }}>
        <Ionicons name="arrow-forward" size={20} color={COLORS.white} />
        <Typography variant="label-01" weight="bold" style={{ color: COLORS.white }}>작성하기</Typography>
      </View>
    </View>
  );
}

// ──────────────── [항목] 컴팩트 Hero strip ────────────────

function CompactHeroStrip() {
  const progress = totalCount > 0 ? completedCount / totalCount : 0;
  return (
    <View style={{ marginHorizontal: s(20), backgroundColor: COLORS.white, borderRadius: s(16), padding: s(16), gap: s(10) }}>
      <View className="flex-row items-center" style={{ gap: s(8) }}>
        <SetBadge />
        <Typography variant="body-01" weight="semibold" className="flex-1 text-gray-900" numberOfLines={1}>
          풀배터리 (종합심리검사)
        </Typography>
        <View style={{ backgroundColor: COLORS.paletteBg.orange }} className="rounded-full px-2.5 py-1">
          <Typography variant="label-02" weight="semibold" style={{ color: COLORS.palette.orange }}>진행중</Typography>
        </View>
      </View>
      <ProgressBar progress={progress} />
      <View className="flex-row items-center" style={{ gap: s(8) }}>
        <Typography variant="label-01" weight="medium" className="text-gray-700">{completedCount}/{totalCount}건 완료</Typography>
        <View style={{ width: s(2), height: s(2), borderRadius: s(1), backgroundColor: COLORS.gray[300] }} />
        <Ionicons name="calendar-outline" size={12} color={COLORS.gray[400]} />
        <Typography variant="label-01" className="text-gray-500">{SCHEDULE_SHORT}</Typography>
        <View style={{ width: s(2), height: s(2), borderRadius: s(1), backgroundColor: COLORS.gray[300] }} />
        <Typography variant="label-01" weight="medium" style={{ color: COLORS.warning }}>보고서 필요</Typography>
      </View>
    </View>
  );
}

// ──────────────── Section Title ────────────────

function SectionTitle({ title }: { title: string }) {
  return (
    <Typography variant="title-01" weight="semibold" className="text-gray-900" style={{ marginBottom: s(12) }}>
      {title}
    </Typography>
  );
}

// ──────────────── TaskCard (현재/절제/히어로/단계) ────────────────

function TaskCard({ task, gateResult }: { task: TaskMock; gateResult: boolean }) {
  const st = TASK_STATUS[task.status];
  const hasActions = task.status !== 'submitted' && task.status !== 'completed';
  const showResultArrow = gateResult ? task.hasResult : !hasActions;
  return (
    <View style={{ backgroundColor: COLORS.gray[50], borderRadius: s(16), overflow: 'hidden' }}>
      <View style={{ paddingVertical: s(14), paddingHorizontal: s(16), flexDirection: 'row', alignItems: 'center' }}>
        <View className="flex-1">
          <Typography variant="body-02" weight="semibold" className="text-gray-900" numberOfLines={2}>{task.name}</Typography>
          {task.completedAt && <Typography variant="label-01" className="mt-1 text-gray-500">{task.completedAt}</Typography>}
        </View>
        {task.fn !== 'online' && (
          <View style={{ marginRight: s(8) }}>
            <FieldNoteChip state={task.fn} />
          </View>
        )}
        <View style={{ backgroundColor: st.bg }} className="mr-2 rounded-full px-2.5 py-1">
          <Typography variant="label-02" weight="semibold" style={{ color: st.fg }}>{st.label}</Typography>
        </View>
        {hasActions ? (
          <Ionicons name="ellipsis-vertical" size={18} color={COLORS.gray[400]} />
        ) : showResultArrow ? (
          <Icon name="arrow-right" size={16} color={COLORS.gray[400]} />
        ) : (
          <View style={{ width: s(16) }} />
        )}
      </View>
      <View style={{ height: 1, backgroundColor: COLORS.gray[200], marginHorizontal: s(16) }} />
      <View style={{ paddingVertical: s(10), paddingHorizontal: s(16), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View className="flex-row items-center" style={{ gap: s(6) }}>
          {task.hasOpinion ? (
            <>
              <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
              <Typography variant="label-01" weight="medium" style={{ color: COLORS.gray[600] }}>소견 작성됨</Typography>
            </>
          ) : (
            <Typography variant="label-01" weight="medium" style={{ color: COLORS.gray[400] }}>소견 미작성</Typography>
          )}
        </View>
        <View className="flex-row items-center" style={{ gap: s(2) }}>
          <Typography variant="label-01" weight="semibold" style={{ color: task.hasOpinion ? COLORS.gray[600] : COLORS.primary }}>
            {task.hasOpinion ? '소견 수정' : '소견 작성'}
          </Typography>
          <Icon name="arrow-right" size={12} color={task.hasOpinion ? COLORS.gray[600] : COLORS.primary} />
        </View>
      </View>
    </View>
  );
}

// ──────────────── [항목] WorklistTaskCard — 카드마다 단일 다음 할 일 ────────────────

function nextAction(task: TaskMock): { text: string; tone: 'primary' | 'normal' | 'muted'; icon: keyof typeof Ionicons.glyphMap } {
  if (task.status === 'pending') return { text: '검사 예정', tone: 'muted', icon: 'time-outline' };
  if (task.status === 'in_progress') return { text: task.fn === 'online' ? '온라인 진행 중' : '진행 중', tone: 'muted', icon: 'ellipsis-horizontal' };
  if (!task.hasOpinion) return { text: '소견 작성', tone: 'primary', icon: 'create-outline' };
  return { text: '결과 보기', tone: 'normal', icon: 'document-text-outline' };
}

function WorklistTaskCard({ task }: { task: TaskMock }) {
  const st = TASK_STATUS[task.status];
  const act = nextAction(task);
  const actColor = act.tone === 'primary' ? COLORS.primary : act.tone === 'normal' ? COLORS.gray[700] : COLORS.gray[400];
  const isPrimary = act.tone === 'primary';
  return (
    <View style={{ backgroundColor: COLORS.gray[50], borderRadius: s(16), overflow: 'hidden' }}>
      {isPrimary && <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: s(3), backgroundColor: COLORS.primary }} />}
      <View style={{ paddingVertical: s(14), paddingHorizontal: s(16), flexDirection: 'row', alignItems: 'center', gap: s(8) }}>
        <View className="flex-1">
          <Typography variant="body-02" weight="semibold" className="text-gray-900" numberOfLines={1}>{task.name}</Typography>
          <View className="flex-row items-center" style={{ gap: s(6), marginTop: s(4) }}>
            {task.fn !== 'online' && <FieldNoteChip state={task.fn} compact />}
            {task.completedAt && <Typography variant="label-01" className="text-gray-500">{task.completedAt}</Typography>}
          </View>
        </View>
        <View style={{ backgroundColor: st.bg }} className="rounded-full px-2.5 py-1">
          <Typography variant="label-02" weight="semibold" style={{ color: st.fg }}>{st.label}</Typography>
        </View>
      </View>
      <View style={{ height: 1, backgroundColor: COLORS.gray[200], marginHorizontal: s(16) }} />
      <Pressable
        style={({ pressed }) => ({
          paddingVertical: s(11),
          paddingHorizontal: s(16),
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          opacity: pressed && act.tone !== 'muted' ? 0.6 : 1,
        })}
        disabled={act.tone === 'muted'}
        accessibilityRole="button"
      >
        <View className="flex-row items-center" style={{ gap: s(6) }}>
          <Ionicons name={act.icon} size={14} color={actColor} />
          <Typography variant="label-01" weight={isPrimary ? 'semibold' : 'medium'} style={{ color: actColor }}>{act.text}</Typography>
        </View>
        {act.tone !== 'muted' && <Icon name="arrow-right" size={12} color={actColor} />}
      </Pressable>
    </View>
  );
}

// ──────────────── 필드노트 칩 ────────────────

function FieldNoteChip({ state, compact = false }: { state: 'none' | 'analyzing' | 'done'; compact?: boolean }) {
  const map = {
    analyzing: { icon: 'sync' as const, label: '분석 중' },
    done: { icon: 'document-text' as const, label: '분석' },
    none: { icon: 'mic' as const, label: '녹음' },
  };
  const { icon, label } = map[state];
  return <Chip bg="rgba(155,93,255,0.10)" color={COLORS.fieldnote} icon={icon} label={label} compact={compact} />;
}

function Chip({ bg, color, icon, label, compact = false }: { bg: string; color: string; icon: keyof typeof Ionicons.glyphMap; label: string; compact?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(4), paddingHorizontal: s(compact ? 7 : 9), paddingVertical: s(compact ? 2 : 4), borderRadius: 999, backgroundColor: bg }}>
      <Ionicons name={icon} size={compact ? 11 : 12} color={color} />
      <Typography variant="label-02" weight="semibold" style={{ color }}>{label}</Typography>
    </View>
  );
}

function TodoChip({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(4), backgroundColor: COLORS.paletteBg.orange, borderRadius: s(999), paddingHorizontal: s(9), paddingVertical: s(4) }}>
      <Ionicons name={icon} size={12} color={COLORS.palette.orange} />
      <Typography variant="label-02" weight="semibold" style={{ color: COLORS.palette.orange }}>{label}</Typography>
    </View>
  );
}

// ──────────────── 내담자 ────────────────

function ClientTile() {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(10), marginBottom: s(32) }}>
      <View style={{ flex: 1, backgroundColor: COLORS.gray[50], borderRadius: s(16), paddingVertical: s(16), paddingHorizontal: s(10), alignItems: 'center', gap: s(10) }}>
        <Avatar size={52} />
        <View style={{ alignItems: 'center', gap: s(2) }}>
          <Typography variant="body-02" weight="semibold" className="text-gray-900" numberOfLines={1}>{CLIENT.name}</Typography>
          <Typography variant="label-02" className="text-gray-500" numberOfLines={1}>{clientMeta}</Typography>
          <Typography variant="label-02" weight="medium" className="text-gray-700" numberOfLines={1} style={{ marginTop: s(2) }}>{completedCount}/{totalCount}건</Typography>
        </View>
      </View>
    </View>
  );
}

function ClientInfoCard() {
  return (
    <View style={{ backgroundColor: COLORS.gray[50], borderRadius: s(16), padding: s(16), gap: s(14), marginBottom: s(24) }}>
      <View className="flex-row items-center" style={{ gap: s(12) }}>
        <Avatar size={44} />
        <View style={{ flex: 1 }}>
          <Typography variant="body-01" weight="semibold" className="text-gray-900" numberOfLines={1}>{CLIENT.name}</Typography>
          <Typography variant="label-01" className="text-gray-500" numberOfLines={1}>{clientMeta}</Typography>
        </View>
        <Icon name="arrow-right" size={16} color={COLORS.gray[400]} />
      </View>
      <View className="h-px bg-gray-200" />
      <View style={{ gap: s(10) }}>
        <InfoLine label="생년월일" value={CLIENT.birth} />
        <ContactLine label="내담자" value={CLIENT.phone} />
        <ContactLine label="보호자" value={CLIENT.guardianPhone} />
      </View>
    </View>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center">
      <Typography variant="label-01" weight="medium" className="text-gray-400" style={{ width: s(64) }}>{label}</Typography>
      <Typography variant="body-02" weight="medium" className="flex-1 text-gray-800" numberOfLines={1}>{value}</Typography>
    </View>
  );
}

function ContactLine({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center">
      <Typography variant="label-01" weight="medium" className="text-gray-400" style={{ width: s(64) }}>{label}</Typography>
      <Typography variant="body-02" weight="medium" className="flex-1 text-gray-800" numberOfLines={1}>{value}</Typography>
      <Pressable
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: s(4), paddingVertical: s(5), paddingHorizontal: s(10), borderRadius: s(999), backgroundColor: COLORS.white, opacity: pressed ? 0.6 : 1 })}
        accessibilityRole="button"
        accessibilityLabel={`${label}에게 전화`}
      >
        <Ionicons name="call-outline" size={13} color={COLORS.primary700} />
        <Typography variant="label-02" weight="semibold" style={{ color: COLORS.primary700 }}>전화</Typography>
      </Pressable>
    </View>
  );
}

function Avatar({ size }: { size: number }) {
  return (
    <View style={{ width: s(size), height: s(size), borderRadius: s(size / 2), backgroundColor: COLORS.primary50, alignItems: 'center', justifyContent: 'center' }}>
      <Typography variant={size > 48 ? 'title-01' : 'body-01'} weight="semibold" style={{ color: COLORS.primary700 }}>{getInitial(CLIENT.name)}</Typography>
    </View>
  );
}

// ──────────────── 스켈레톤 ────────────────

function AssessmentDetailSkeleton() {
  return (
    <ScrollView style={{ backgroundColor: COLORS.white }} scrollEnabled={false} contentContainerStyle={{ paddingBottom: s(40) }}>
      <View style={{ backgroundColor: COLORS.bg.base, paddingTop: s(16), paddingBottom: s(20) }}>
        <View style={{ marginHorizontal: s(20), backgroundColor: COLORS.white, borderRadius: s(20), padding: s(20), gap: s(16) }}>
          <View className="flex-row items-center justify-between">
            <Skeleton width={72} height={16} />
            <Skeleton width={44} height={20} radius={10} />
          </View>
          <Skeleton width={200} height={24} />
          <Skeleton width={120} height={20} />
          <Skeleton width="100%" height={6} radius={3} />
          <View className="h-px bg-gray-100" />
          <Skeleton width="80%" height={16} />
          <Skeleton width="60%" height={16} />
        </View>
      </View>
      <View style={{ backgroundColor: COLORS.white, paddingTop: s(24), paddingHorizontal: s(20), gap: s(10) }}>
        <Skeleton width={80} height={20} />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} width="100%" height={84} radius={16} />
        ))}
        <View style={{ height: s(14) }} />
        <Skeleton width={60} height={20} />
        <Skeleton width="100%" height={120} radius={16} />
      </View>
    </ScrollView>
  );
}
