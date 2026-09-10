import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Icon } from '@/shared/components/icons';
import { Typography } from '@/shared/components/ui/Typography';
import { BadgeRound, type BadgeRoundVariant } from '@/shared/components/ui/BadgeRound';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';

/**
 * LAB / 내담자 상세 — 비주얼 변주 시안 비교
 *
 * 규칙:
 *   - 현재 내담자 상세의 텍스트 크기·간격은 모두 유지
 *     (이름 title-01/semibold, 부제 body-03/medium,
 *      라벨 label-01/medium·gray-400, 값 body-02/medium·gray-800,
 *      메모 label-01/medium + body-03,
 *      카드 padding 18, 메인 gap 14, 정보 라인 gap 8)
 *   - 좌측 primary 라인은 모두 제거
 *   - 비주얼·레이아웃 변주로 단조로움을 깬다
 *
 * 시안:
 *   1) 컬러 헤더      — 카드 상단을 primary로 도장, 흰 아바타가 떠 있음
 *   2) 좌측 사이드    — 좌측 컬러 영역에 아바타·이름, 우측 흰 영역에 정보
 *   3) 워터마크 명함  — 우상단 거대한 이니셜 워터마크 + 상태 칩
 *
 * 데이터는 mock. 사전기록지·케이스 영역은 시안 전반에 공유.
 */

/* ────────────────────────────────────────────────
 * Mock Data
 * ──────────────────────────────────────────────── */

const MOCK_CLIENT = {
  name: '김은지',
  initial: '김',
  gender: 'female' as 'female' | 'male',
  age: 32,
  birth: '1993.05.14',
  phone: '010-1234-5678',
  createdAt: '2026.03.10',
  memo: '주 1회 화요일 오후, 보호자 동반 상담 진행',
};

interface IntakeFile {
  id: string;
  title: string;
  size: string;
  uploadedAt: string;
}

const MOCK_INTAKES: IntakeFile[] = [
  { id: '1', title: '내담자 신청서.pdf', size: '2.4MB', uploadedAt: '2026.05.10' },
  { id: '2', title: '심리검사 동의서.pdf', size: '512KB', uploadedAt: '2026.05.10' },
];

interface MockCounseling {
  id: string;
  title: string;
  nextDate: string | null;
  completed: number;
  total: number;
  status: 'active' | 'completed' | 'cancelled';
}

const MOCK_COUNSELING: MockCounseling[] = [
  {
    id: 'c1',
    title: '청소년 정서지원 상담',
    nextDate: '2026.05.22',
    completed: 4,
    total: 8,
    status: 'active',
  },
  {
    id: 'c2',
    title: '진로 코칭 8주 프로그램',
    nextDate: null,
    completed: 8,
    total: 8,
    status: 'completed',
  },
];

interface MockAssessment {
  id: string;
  title: string;
  date: string;
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
}

const MOCK_ASSESSMENT: MockAssessment[] = [
  { id: 'a1', title: 'MMPI-2 성격검사', date: '2026.04.18', status: 'completed' },
  { id: 'a2', title: 'WAIS-IV 지능검사', date: '2026.05.02', status: 'completed' },
];

const COUNSELING_BADGE: Record<
  MockCounseling['status'],
  { label: string; variant: BadgeRoundVariant }
> = {
  active: { label: '진행중', variant: 'warning' },
  completed: { label: '완료', variant: 'primary' },
  cancelled: { label: '취소', variant: 'gray' },
};

const ASSESSMENT_BADGE: Record<
  MockAssessment['status'],
  { label: string; variant: BadgeRoundVariant }
> = {
  pending: { label: '예정', variant: 'gray' },
  processing: { label: '진행중', variant: 'warning' },
  completed: { label: '완료', variant: 'primary' },
  cancelled: { label: '취소', variant: 'gray' },
};

/* ────────────────────────────────────────────────
 * 시안 토글
 * ──────────────────────────────────────────────── */

type VariantKey = '1' | '2' | '3';

const VARIANTS: Array<{ key: VariantKey; label: string; sub: string }> = [
  { key: '1', label: '시안 1', sub: '컬러 헤더' },
  { key: '2', label: '시안 2', sub: '좌측 사이드' },
  { key: '3', label: '시안 3', sub: '워터마크 명함' },
];

type CaseTabKey = 'counseling' | 'assessment';

/* ────────────────────────────────────────────────
 * 메인 화면
 * ──────────────────────────────────────────────── */

export default function ClientDetailDensityLab() {
  const router = useRouter();
  const [variant, setVariant] = useState<VariantKey>('1');
  const [caseTab, setCaseTab] = useState<CaseTabKey>('counseling');

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* 헤더 */}
      <View
        style={{ height: s(48), paddingHorizontal: s(8) }}
        className="flex-row items-center bg-background"
      >
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={8}
          className="h-10 w-10 items-center justify-center"
          accessibilityLabel="뒤로 가기"
          accessibilityRole="button"
        >
          <Icon name="arrow-left" size={s(24)} color={COLORS.gray[900]} />
        </TouchableOpacity>
        <View className="flex-1 items-center">
          <Typography variant="title-01" weight="semibold" className="text-gray-900">
            내담자 상세 — 비주얼 시안
          </Typography>
        </View>
        <View style={{ width: s(40) }} />
      </View>

      {/* 시안 세그먼트 탭 */}
      <View style={{ paddingHorizontal: s(16), paddingVertical: s(10) }}>
        <View
          style={{ padding: s(4), gap: s(4) }}
          className="flex-row rounded-md bg-gray-100"
        >
          {VARIANTS.map((v) => {
            const active = v.key === variant;
            return (
              <TouchableOpacity
                key={v.key}
                onPress={() => setVariant(v.key)}
                activeOpacity={0.7}
                style={{ paddingVertical: s(8) }}
                className={`flex-1 items-center justify-center rounded-sm ${
                  active ? 'bg-surface' : 'bg-transparent'
                }`}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${v.label} — ${v.sub}`}
              >
                <Typography
                  variant="label-01"
                  weight={active ? 'semibold' : 'medium'}
                  className={active ? 'text-gray-900' : 'text-gray-500'}
                >
                  {v.label}
                </Typography>
                <Typography
                  variant="caption-01"
                  className={active ? 'text-gray-500' : 'text-gray-400'}
                  style={{ marginTop: s(2) }}
                >
                  {v.sub}
                </Typography>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: s(40) }}
        showsVerticalScrollIndicator={false}
      >
        {variant === '1' && <Variant1 />}
        {variant === '2' && <Variant2 />}
        {variant === '3' && <Variant3 />}

        {/* 사전기록지 + 케이스 영역 (공유) */}
        <IntakeSection />
        <CaseSection caseTab={caseTab} onTabChange={setCaseTab} />
      </ScrollView>
    </SafeAreaView>
  );
}

/* ────────────────────────────────────────────────
 * 시안 1 — 컬러 헤더 (Hero Block)
 *   - 카드 상단 영역을 primary-500로 도장
 *   - 흰색 ring 아바타가 컬러 영역 위에 또렷이 떠 있음
 *   - 컬러 영역 내부: 이름 white / 부제 primary-100
 *   - 하단 흰 영역: 정보 라인 + 메모 (원본 그대로)
 *   - 좌측 라인 ❌
 * ──────────────────────────────────────────────── */

function Variant1() {
  const c = MOCK_CLIENT;
  return (
    <View
      style={{
        marginHorizontal: s(20),
        marginTop: s(4),
        marginBottom: s(20),
      }}
      className="overflow-hidden rounded-lg"
    >
      {/* 상단 컬러 헤더 */}
      <View
        style={{
          backgroundColor: COLORS.primary500,
          paddingVertical: s(18),
          paddingHorizontal: s(18),
        }}
      >
        <View className="flex-row items-center" style={{ gap: s(14) }}>
          <View
            style={{
              width: s(56),
              height: s(56),
              borderRadius: s(28),
              backgroundColor: '#FFFFFF',
              borderWidth: s(3),
              borderColor: 'rgba(255,255,255,0.4)',
            }}
            className="items-center justify-center"
          >
            <Typography
              variant="headline-02"
              weight="semibold"
              style={{ color: COLORS.primary600 }}
            >
              {c.initial}
            </Typography>
          </View>

          <View className="flex-1" style={{ gap: s(4) }}>
            <Typography
              variant="title-01"
              weight="semibold"
              style={{ color: '#FFFFFF' }}
            >
              {c.name}
            </Typography>
            <View className="flex-row items-center">
              <Typography
                variant="body-03"
                weight="medium"
                style={{ color: COLORS.primary100 }}
              >
                {c.gender === 'female' ? '여' : '남'}
              </Typography>
              <View
                style={{
                  marginHorizontal: s(6),
                  height: s(10),
                  width: 1,
                  backgroundColor: 'rgba(255,255,255,0.4)',
                }}
              />
              <Typography
                variant="body-03"
                weight="medium"
                style={{ color: COLORS.primary100 }}
              >
                만 {c.age}세
              </Typography>
            </View>
          </View>
        </View>
      </View>

      {/* 하단 흰 영역 */}
      <View
        style={{
          backgroundColor: '#FFFFFF',
          paddingVertical: s(18),
          paddingHorizontal: s(18),
          gap: s(14),
        }}
      >
        <View style={{ gap: s(8) }}>
          <InfoLine label="생년월일" value={c.birth} />
          <InfoLine label="연락처" value={c.phone} />
          <InfoLine label="등록일" value={c.createdAt} />
        </View>

        {c.memo ? (
          <>
            <View className="h-px bg-gray-100" />
            <View style={{ gap: s(4) }}>
              <Typography variant="label-01" weight="medium" className="text-gray-400">
                메모
              </Typography>
              <Typography variant="body-03" className="text-gray-800">
                {c.memo}
              </Typography>
            </View>
          </>
        ) : null}
      </View>
    </View>
  );
}

/* ────────────────────────────────────────────────
 * 시안 2 — 좌측 사이드 (Vertical Split)
 *   - 카드 가로 분할: 좌측 primary-50 영역 + 우측 흰 영역
 *   - 좌측: 큰 아바타 + 이름·부제 세로 중앙
 *   - 우측: 정보 라인 + 메모 (라벨-값 패턴 유지, 라벨 폭 축소)
 *   - 좌측 라인 ❌
 * ──────────────────────────────────────────────── */

function Variant2() {
  const c = MOCK_CLIENT;
  return (
    <View
      style={{
        marginHorizontal: s(20),
        marginTop: s(4),
        marginBottom: s(20),
      }}
      className="overflow-hidden rounded-lg flex-row"
    >
      {/* 좌측 컬러 영역 */}
      <View
        style={{
          width: s(124),
          backgroundColor: COLORS.primary50,
          paddingVertical: s(18),
          paddingHorizontal: s(12),
          gap: s(14),
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: s(64),
            height: s(64),
            borderRadius: s(32),
            backgroundColor: '#FFFFFF',
          }}
          className="items-center justify-center"
        >
          <Typography
            variant="headline-02"
            weight="semibold"
            style={{ color: COLORS.primary600 }}
          >
            {c.initial}
          </Typography>
        </View>

        <View style={{ gap: s(4), alignItems: 'center' }}>
          <Typography
            variant="title-01"
            weight="semibold"
            style={{ color: COLORS.primary900 }}
          >
            {c.name}
          </Typography>
          <Typography
            variant="body-03"
            weight="medium"
            style={{ color: COLORS.primary700 }}
          >
            {c.gender === 'female' ? '여' : '남'} · 만 {c.age}세
          </Typography>
        </View>
      </View>

      {/* 우측 흰 영역 */}
      <View
        className="flex-1"
        style={{
          backgroundColor: '#FFFFFF',
          paddingVertical: s(18),
          paddingHorizontal: s(18),
          gap: s(14),
        }}
      >
        <View style={{ gap: s(8) }}>
          <InfoLine label="생년월일" value={c.birth} labelWidth={s(52)} />
          <InfoLine label="연락처" value={c.phone} labelWidth={s(52)} />
          <InfoLine label="등록일" value={c.createdAt} labelWidth={s(52)} />
        </View>

        {c.memo ? (
          <>
            <View className="h-px bg-gray-100" />
            <View style={{ gap: s(4) }}>
              <Typography variant="label-01" weight="medium" className="text-gray-400">
                메모
              </Typography>
              <Typography
                variant="body-03"
                className="text-gray-800"
                numberOfLines={2}
              >
                {c.memo}
              </Typography>
            </View>
          </>
        ) : null}
      </View>
    </View>
  );
}

/* ────────────────────────────────────────────────
 * 시안 3 — 워터마크 명함 (Big Initial)
 *   - 카드 흰색, 우측 상단에 거대한 이니셜 워터마크 (primary-100, decorative)
 *   - 카드 우상단에 상태 칩 (진행중 상담 1)
 *   - 본문 레이아웃은 원본과 동일
 *   - 좌측 라인 ❌ (대신 워터마크 + 상태 칩으로 시각 포인트)
 * ──────────────────────────────────────────────── */

function Variant3() {
  const c = MOCK_CLIENT;
  return (
    <View
      style={{
        marginHorizontal: s(20),
        marginTop: s(4),
        marginBottom: s(20),
        paddingVertical: s(18),
        paddingHorizontal: s(18),
        gap: s(14),
      }}
      className="relative overflow-hidden rounded-lg bg-surface"
    >
      {/* 워터마크 — 우측 배경에 거대한 이니셜 */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          right: s(-12),
          top: s(-28),
        }}
      >
        <Text
          style={{
            fontSize: s(160),
            lineHeight: s(160),
            fontWeight: '700',
            color: COLORS.primary100,
            letterSpacing: -2,
          }}
        >
          {c.initial}
        </Text>
      </View>

      {/* 상단: 아바타 + 이름·부제 + 우측 상태 칩 */}
      <View className="flex-row items-center" style={{ gap: s(14) }}>
        <View
          style={{ width: s(56), height: s(56), borderRadius: s(28) }}
          className="items-center justify-center bg-primary-50"
        >
          <Typography
            variant="headline-02"
            weight="semibold"
            className="text-primary-700"
          >
            {c.initial}
          </Typography>
        </View>

        <View className="flex-1" style={{ gap: s(4) }}>
          <Typography variant="title-01" weight="semibold" className="text-gray-900">
            {c.name}
          </Typography>
          <View className="flex-row items-center">
            <Typography variant="body-03" weight="medium" className="text-gray-600">
              {c.gender === 'female' ? '여' : '남'}
            </Typography>
            <View
              style={{ marginHorizontal: s(6), height: s(10) }}
              className="w-px bg-gray-300"
            />
            <Typography variant="body-03" weight="medium" className="text-gray-600">
              만 {c.age}세
            </Typography>
          </View>
        </View>

        {/* 상태 칩 */}
        <View
          style={{
            paddingVertical: s(5),
            paddingHorizontal: s(8),
            borderRadius: s(999),
            backgroundColor: 'rgba(255, 146, 0, 0.12)',
            gap: s(5),
          }}
          className="flex-row items-center self-start"
        >
          <View
            style={{
              width: s(6),
              height: s(6),
              borderRadius: s(999),
              backgroundColor: COLORS.warning,
            }}
          />
          <Typography
            variant="caption-01"
            weight="semibold"
            style={{ color: COLORS.warning }}
          >
            진행 1
          </Typography>
        </View>
      </View>

      <View className="h-px bg-gray-100" />

      {/* 정보 라인 */}
      <View style={{ gap: s(8) }}>
        <InfoLine label="생년월일" value={c.birth} />
        <InfoLine label="연락처" value={c.phone} />
        <InfoLine label="등록일" value={c.createdAt} />
      </View>

      {/* 메모 */}
      {c.memo ? (
        <>
          <View className="h-px bg-gray-100" />
          <View style={{ gap: s(4) }}>
            <Typography variant="label-01" weight="medium" className="text-gray-400">
              메모
            </Typography>
            <Typography variant="body-03" className="text-gray-800">
              {c.memo}
            </Typography>
          </View>
        </>
      ) : null}
    </View>
  );
}

/* ────────────────────────────────────────────────
 * 공통: 정보 라인 (라벨 | 값 — 원본 스타일 유지)
 * ──────────────────────────────────────────────── */

function InfoLine({
  label,
  value,
  labelWidth = s(64),
}: {
  label: string;
  value: string;
  labelWidth?: number;
}) {
  return (
    <View className="flex-row items-center">
      <View style={{ width: labelWidth }}>
        <Typography variant="label-01" weight="medium" className="text-gray-400">
          {label}
        </Typography>
      </View>
      <Typography
        variant="body-02"
        weight="medium"
        className="flex-1 text-gray-800"
        numberOfLines={1}
      >
        {value}
      </Typography>
    </View>
  );
}

/* ────────────────────────────────────────────────
 * 사전기록지 섹션 (공유)
 * ──────────────────────────────────────────────── */

function IntakeSection() {
  return (
    <View
      style={{
        marginHorizontal: s(20),
        marginBottom: s(20),
        gap: s(10),
      }}
    >
      <View className="flex-row items-end justify-between">
        <Typography variant="body-01" weight="semibold" className="text-gray-900">
          사전기록지
        </Typography>
        <Typography variant="label-01" className="text-gray-400">
          웹에서 업로드
        </Typography>
      </View>

      <View style={{ gap: s(8) }}>
        {MOCK_INTAKES.map((file) => (
          <IntakeRow key={file.id} file={file} />
        ))}
      </View>
    </View>
  );
}

function IntakeRow({ file }: { file: IntakeFile }) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={{ paddingVertical: s(12), paddingHorizontal: s(14), gap: s(12) }}
      className="flex-row items-center rounded-lg bg-surface"
      accessibilityRole="button"
    >
      <View
        style={{ width: s(36), height: s(36), borderRadius: s(8) }}
        className="items-center justify-center bg-primary-50"
      >
        <Icon name="document" size={s(20)} color={COLORS.primary600} />
      </View>
      <View className="flex-1" style={{ gap: s(3) }}>
        <Typography
          variant="body-02"
          weight="medium"
          className="text-gray-900"
          numberOfLines={1}
        >
          {file.title}
        </Typography>
        <View className="flex-row items-center">
          <Typography variant="label-01" className="text-gray-500">
            {file.size}
          </Typography>
          <View
            style={{ marginHorizontal: s(6), height: s(8) }}
            className="w-px bg-gray-300"
          />
          <Typography variant="label-01" className="text-gray-500">
            {file.uploadedAt}
          </Typography>
        </View>
      </View>
      <Icon name="arrow-right" size={s(16)} color={COLORS.gray[300]} />
    </TouchableOpacity>
  );
}

/* ────────────────────────────────────────────────
 * 케이스 섹션 (공유)
 * ──────────────────────────────────────────────── */

function CaseSection({
  caseTab,
  onTabChange,
}: {
  caseTab: CaseTabKey;
  onTabChange: (t: CaseTabKey) => void;
}) {
  const list =
    caseTab === 'counseling' ? MOCK_COUNSELING : MOCK_ASSESSMENT;
  return (
    <View>
      {/* 탭 바 */}
      <View className="flex-row border-y border-gray-200 bg-surface">
        <CaseTabButton
          label="상담"
          count={MOCK_COUNSELING.length}
          active={caseTab === 'counseling'}
          onPress={() => onTabChange('counseling')}
        />
        <CaseTabButton
          label="검사"
          count={MOCK_ASSESSMENT.length}
          active={caseTab === 'assessment'}
          onPress={() => onTabChange('assessment')}
        />
      </View>

      <View style={{ paddingHorizontal: s(20), paddingTop: s(16) }}>
        <Typography variant="body-03" className="text-gray-500">
          총 {list.length}개
        </Typography>
      </View>

      <View
        style={{ paddingHorizontal: s(20), paddingTop: s(12), gap: s(10) }}
      >
        {caseTab === 'counseling'
          ? MOCK_COUNSELING.map((item) => (
              <CounselingRow key={item.id} item={item} />
            ))
          : MOCK_ASSESSMENT.map((item) => (
              <AssessmentRow key={item.id} item={item} />
            ))}
      </View>
    </View>
  );
}

function CaseTabButton({
  label,
  count,
  active,
  onPress,
}: {
  label: string;
  count: number;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{ height: s(48) }}
      className="flex-1 flex-row items-center justify-center"
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Typography
        variant="body-02"
        weight={active ? 'semibold' : 'regular'}
        className={active ? 'text-gray-900' : 'text-gray-500'}
      >
        {label}
      </Typography>
      <Typography
        variant="body-02"
        weight={active ? 'semibold' : 'regular'}
        className={active ? 'text-gray-900' : 'text-gray-400'}
        style={{ marginLeft: s(4) }}
      >
        {count}
      </Typography>
      {active && (
        <View
          style={{
            position: 'absolute',
            bottom: -1,
            left: 0,
            right: 0,
            height: 2,
            backgroundColor: COLORS.gray[900],
          }}
        />
      )}
    </TouchableOpacity>
  );
}

function CounselingRow({ item }: { item: MockCounseling }) {
  const badge = COUNSELING_BADGE[item.status];
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={{ padding: s(16), gap: s(10) }}
      className="rounded-lg bg-surface"
      accessibilityRole="button"
    >
      <View className="flex-row items-center justify-between">
        <Typography variant="body-02" weight="semibold" className="text-gray-900">
          {item.title}
        </Typography>
        <BadgeRound variant={badge.variant}>{badge.label}</BadgeRound>
      </View>
      <View className="flex-row items-center" style={{ gap: s(12) }}>
        <Typography variant="body-03" className="text-gray-500">
          다음 상담일
        </Typography>
        <Typography variant="body-03" className="text-gray-900">
          {item.nextDate ?? '-'}
        </Typography>
      </View>
      <View className="flex-row items-center" style={{ gap: s(12) }}>
        <Typography variant="body-03" className="text-gray-500">
          회기
        </Typography>
        <View className="flex-1">
          <ProgressBar value={item.completed} max={item.total} />
        </View>
        <Typography variant="body-03" className="text-gray-900">
          {item.completed}/{item.total}
        </Typography>
      </View>
    </TouchableOpacity>
  );
}

function AssessmentRow({ item }: { item: MockAssessment }) {
  const badge = ASSESSMENT_BADGE[item.status];
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={{ padding: s(16), gap: s(10) }}
      className="rounded-lg bg-surface"
      accessibilityRole="button"
    >
      <View className="flex-row items-center justify-between">
        <Typography variant="body-02" weight="semibold" className="text-gray-900">
          {item.title}
        </Typography>
        <BadgeRound variant={badge.variant}>{badge.label}</BadgeRound>
      </View>
      <View className="flex-row items-center" style={{ gap: s(12) }}>
        <Typography variant="body-03" className="text-gray-500">
          {item.status === 'completed' ? '완료일' : '등록일'}
        </Typography>
        <Typography variant="body-03" className="text-gray-900">
          {item.date}
        </Typography>
      </View>
    </TouchableOpacity>
  );
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <View
      style={{ height: s(6) }}
      className="w-full overflow-hidden rounded-full bg-gray-100"
    >
      <View
        style={{ width: `${pct}%`, height: '100%' }}
        className="rounded-full bg-primary"
      />
    </View>
  );
}
