import { useState } from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, LAYOUT } from '@/shared/constants/theme';
import { Typography } from '@/shared/components/ui/Typography';
import { Icon } from '@/shared/components/icons';
import { s } from '@/shared/utils/scale';

/**
 * [회기 상세] 요소별 간격(리듬) 비교
 *
 * 확정된 "세련됨" 방향:
 *   - 위계는 타이포 크기·굵기로 (면/박스 적층 X)
 *   - 배경색(면 채움)은 "회기 진행/결과 영역" 한 곳에만 — 나머지는 전부 평면(white)
 *   - 그룹 구분은 여백·리듬 + 좌측 정렬 축 통일 (구분선/박스 X)
 *
 * 이 lab은 위 방향을 고정한 채 **간격만** 바꿔 비교한다.
 * 탭: [현재] production 혼합 간격(대조군)
 *     [표준] DS 토큰(그룹24·섹션16·내부6)
 *     [컴팩트] 밀도 우선(16·12·4)
 *     [여유] 숨 트이는 리듬(32·16·8)
 *     [대비] 그룹 간 크게 / 그룹 내 타이트 — "여백으로 그룹핑" 극대화(36·12·4)
 *
 * 상태는 비교가 가장 풍부한 completed · 1:1 회기로 고정.
 */

type RhythmKey = 'standard' | 'compact' | 'airy' | 'contrast';

interface Rhythm {
  /** 5개 주요 그룹(정보·메모·진행결과·필드노트·일지) 사이 */
  group: number;
  /** 섹션 타이틀(필드노트·일지) ↔ 콘텐츠 */
  related: number;
  /** 정보 묶음 내부, 라벨↔값 같은 타이트 쌍 */
  intra: number;
  /** 강조(진행/결과) 블록 세로 패딩 */
  blockPadV: number;
  /** 강조 블록 내부 요소 간격 */
  blockGap: number;
}

const RHYTHMS: Record<RhythmKey, Rhythm> = {
  standard: { group: 24, related: 16, intra: 6, blockPadV: 14, blockGap: 12 },
  compact: { group: 16, related: 12, intra: 4, blockPadV: 12, blockGap: 10 },
  airy: { group: 32, related: 16, intra: 8, blockPadV: 18, blockGap: 14 },
  contrast: { group: 36, related: 12, intra: 4, blockPadV: 14, blockGap: 10 },
};

const TABS: { key: 'current' | RhythmKey; label: string; caption: string }[] = [
  { key: 'current', label: '현재', caption: 'production 혼합 간격 (대조군 · gray 박스 적층)' },
  { key: 'standard', label: '표준', caption: '그룹 24 · 섹션 16 · 내부 6 (DS 토큰)' },
  { key: 'compact', label: '컴팩트', caption: '그룹 16 · 섹션 12 · 내부 4 (밀도 우선)' },
  { key: 'airy', label: '여유', caption: '그룹 32 · 섹션 16 · 내부 8 (숨 트임)' },
  { key: 'contrast', label: '대비', caption: '그룹 36(큼) · 섹션 12 · 내부 4(타이트)' },
];

// ─── mock — completed · 1:1 회기 ──────────────────────────────────
const MOCK = {
  caseCode: 'PLY-0420의 3회기',
  clientName: '홍길동',
  clientMeta: '만 8세 · 남',
  program: '놀이치료-개인',
  datetime: '5월 28일 (수) 14:00',
  room: '상담실 A',
  memo: '지난 회기에 다룬 또래 관계 주제를 이어가기. 보호자 면담 결과 공유 예정.',
};

export default function SessionDetailSpacingLab() {
  const router = useRouter();
  const [tabKey, setTabKey] = useState<'current' | RhythmKey>('contrast');
  const activeTab = TABS.find((t) => t.key === tabKey)!;

  return (
    <View className="flex-1" style={{ backgroundColor: COLORS.white }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: COLORS.white }}>
        <View
          style={{
            height: s(52),
            paddingHorizontal: s(LAYOUT.screenPaddingX),
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={8}
            accessibilityLabel="뒤로 가기"
            accessibilityRole="button"
          >
            <Icon name="arrow-left" size={24} color={COLORS.gray[900]} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* 탭 pill */}
      <View style={{ paddingHorizontal: s(LAYOUT.screenPaddingX), paddingTop: s(8) }}>
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: COLORS.gray[50],
            borderRadius: s(10),
            padding: s(3),
          }}
        >
          {TABS.map((t) => {
            const active = t.key === tabKey;
            return (
              <TouchableOpacity
                key={t.key}
                activeOpacity={0.8}
                onPress={() => setTabKey(t.key)}
                style={{
                  flex: 1,
                  paddingVertical: s(8),
                  borderRadius: s(8),
                  alignItems: 'center',
                  backgroundColor: active ? COLORS.white : 'transparent',
                }}
              >
                <Typography
                  variant="label-01"
                  weight={active ? 'semibold' : 'medium'}
                  style={{ color: active ? COLORS.gray[900] : COLORS.gray[500] }}
                >
                  {t.label}
                </Typography>
              </TouchableOpacity>
            );
          })}
        </View>
        {/* 활성 리듬의 간격 수치 캡션 — "요소별 간격"을 눈으로 보며 선택 */}
        <Typography
          variant="caption-01"
          className="text-gray-400"
          style={{ marginTop: s(8), textAlign: 'center' }}
        >
          {activeTab.caption}
        </Typography>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: s(20),
          paddingTop: s(16),
          paddingBottom: s(40),
        }}
        showsVerticalScrollIndicator={false}
      >
        {tabKey === 'current' ? (
          <CurrentVariant />
        ) : (
          <RefinedVariant rhythm={RHYTHMS[tabKey]} />
        )}
      </ScrollView>
    </View>
  );
}

/* ════════════════════════════════════════════════════════════════
 * 신규 방향 — 평면 + 타이포 위계 + 단일 강조 면. 간격만 rhythm으로 변주.
 * ════════════════════════════════════════════════════════════════ */
function RefinedVariant({ rhythm }: { rhythm: Rhythm }) {
  return (
    <View style={{ gap: s(rhythm.group) }}>
      {/* G1 회기 정보 — 평면, 좌측 정렬 축, 타이포 위계 */}
      <View style={{ gap: s(rhythm.intra) }}>
        <Typography variant="label-01" className="text-gray-400">
          {MOCK.caseCode}
        </Typography>
        <View className="flex-row items-start" style={{ gap: s(8) }}>
          <View
            className="flex-row items-baseline"
            style={{ flex: 1, gap: s(6), flexWrap: 'wrap' }}
          >
            <Typography variant="headline-02" weight="bold" className="text-gray-900">
              {MOCK.clientName}
            </Typography>
            <Typography variant="body-03" weight="medium" className="text-gray-500">
              {MOCK.clientMeta}
            </Typography>
          </View>
          <StatusBadge label="완료" />
        </View>
        <Typography variant="body-01" weight="medium" className="text-gray-800">
          {MOCK.program}
        </Typography>
        <View className="flex-row items-center" style={{ gap: s(10), marginTop: s(rhythm.intra) }}>
          <MetaLine icon="time" text={MOCK.datetime} />
          <View style={{ width: 1, height: s(12), backgroundColor: COLORS.gray[300] }} />
          <MetaLine icon="location-16" text={MOCK.room} />
        </View>
      </View>

      {/* G2 메모 — 평면. 라벨↔값은 intra(타이트) */}
      <View style={{ gap: s(rhythm.intra) }}>
        <Typography variant="label-01" weight="semibold" className="text-gray-600">
          메모
        </Typography>
        <Typography variant="body-02" className="text-gray-900" style={{ lineHeight: s(22) }}>
          {MOCK.memo}
        </Typography>
      </View>

      {/* G3 회기 진행/결과 — 유일한 강조 면(gray-50). 화면의 앵커 */}
      <View
        style={{
          backgroundColor: COLORS.gray[50],
          borderRadius: s(16),
          paddingHorizontal: s(14),
          paddingVertical: s(rhythm.blockPadV),
          gap: s(rhythm.blockGap),
        }}
      >
        <View className="flex-row items-center" style={{ gap: s(10) }}>
          <View
            style={{
              width: s(24),
              height: s(24),
              borderRadius: s(12),
              backgroundColor: COLORS.palette.green,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="checkmark" size={16} color={COLORS.white} />
          </View>
          <Typography
            variant="body-02"
            weight="semibold"
            className="text-gray-900"
            style={{ flex: 1 }}
          >
            완료된 회기예요
          </Typography>
          <TouchableOpacity hitSlop={6} activeOpacity={0.7}>
            <Typography variant="label-01" weight="medium" className="text-gray-600">
              되돌리기
            </Typography>
          </TouchableOpacity>
        </View>
        <View style={{ height: 1, backgroundColor: COLORS.gray[200] }} />
        <TouchableOpacity
          activeOpacity={0.85}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: s(8),
            height: s(44),
            borderRadius: s(12),
            backgroundColor: COLORS.white,
          }}
        >
          <Ionicons name="receipt-outline" size={18} color={COLORS.primary700} />
          <Typography variant="body-02" weight="semibold" style={{ color: COLORS.primary700 }}>
            청구하기
          </Typography>
        </TouchableOpacity>
      </View>

      {/* G4 필드노트 — 평면. 섹션 타이틀↔콘텐츠는 related */}
      <View style={{ gap: s(rhythm.related) }}>
        <Typography variant="title-01" weight="semibold" className="text-gray-900">
          필드노트
        </Typography>
        <View style={{ gap: s(12) }}>
          <View style={{ gap: s(2) }}>
            <Typography variant="body-03" weight="medium" className="text-gray-700">
              이 회기에 연결된 필드노트가 없어요
            </Typography>
            <Typography variant="body-03" className="text-gray-500">
              지금 녹음하거나 기존 노트를 연결하세요
            </Typography>
          </View>
          <View className="flex-row" style={{ gap: s(8) }}>
            <OutlineButton icon="mic-outline" label="녹음하기" />
            <OutlineButton icon="link-outline" label="연결하기" />
          </View>
        </View>
      </View>

      {/* G5 일지 — 평면. 1:1이라 단일 내담자 기록(카드 배경 없음) */}
      <View style={{ gap: s(rhythm.related) }}>
        <Typography variant="title-01" weight="semibold" className="text-gray-900">
          일지
        </Typography>
        <View style={{ gap: s(10) }}>
          <View className="flex-row items-center" style={{ gap: s(8) }}>
            <View className="flex-row items-baseline" style={{ flex: 1, gap: s(6) }}>
              <Typography variant="body-02" weight="semibold" className="text-gray-900">
                {MOCK.clientName}
              </Typography>
              <Typography variant="label-01" className="text-gray-500">
                {MOCK.clientMeta}
              </Typography>
            </View>
            <AttendanceChip />
          </View>
          <TouchableOpacity
            activeOpacity={0.7}
            hitSlop={6}
            className="flex-row items-center"
            style={{ gap: s(4) }}
          >
            <Typography variant="label-01" weight="semibold" style={{ color: COLORS.primary700 }}>
              일지 작성
            </Typography>
            <Icon name="arrow-right" size={12} color={COLORS.primary700} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

/* ════════════════════════════════════════════════════════════════
 * 대조군 — 현재 production 느낌(gray 박스 적층 + 혼합 간격)
 * ════════════════════════════════════════════════════════════════ */
function CurrentVariant() {
  return (
    <View>
      {/* Section 1 — 정보 + 메모 + 진행결과 (gap 16) */}
      <View style={{ gap: s(16) }}>
        {/* 회기 정보 */}
        <View style={{ gap: s(6) }}>
          <View className="flex-row items-start" style={{ gap: s(8) }}>
            <View
              className="flex-row items-baseline"
              style={{ flex: 1, gap: s(6), flexWrap: 'wrap' }}
            >
              <Typography variant="headline-02" weight="bold" className="text-gray-900">
                {MOCK.clientName}
              </Typography>
              <Typography variant="body-03" weight="medium" className="text-gray-500">
                {MOCK.clientMeta}
              </Typography>
            </View>
            <StatusBadge label="완료" />
          </View>
          <Typography variant="body-01" weight="medium" className="text-gray-800">
            {MOCK.program}
          </Typography>
          <View className="flex-row items-center" style={{ gap: s(10) }}>
            <MetaLine icon="time" text={MOCK.datetime} />
            <View style={{ width: 1, height: s(12), backgroundColor: COLORS.gray[300] }} />
            <MetaLine icon="location-16" text={MOCK.room} />
          </View>
          <Typography variant="label-01" className="text-gray-400" style={{ marginTop: s(6) }}>
            {MOCK.caseCode}
          </Typography>
        </View>

        {/* 메모 — gray-50 박스(라벨 박스 안) */}
        <View
          style={{
            backgroundColor: COLORS.gray[50],
            borderRadius: s(12),
            paddingHorizontal: s(14),
            paddingVertical: s(12),
            gap: s(6),
            minHeight: s(68),
          }}
        >
          <Typography variant="label-01" weight="semibold" className="text-gray-700">
            메모
          </Typography>
          <Typography variant="body-02" className="text-gray-900" style={{ lineHeight: s(22) }}>
            {MOCK.memo}
          </Typography>
        </View>

        {/* hairline */}
        <View
          style={{
            height: 1,
            backgroundColor: COLORS.gray[100],
            marginHorizontal: -s(4),
            marginTop: s(4),
          }}
        />

        {/* 진행 결과 + 청구 (gap 10) */}
        <View style={{ gap: s(10) }}>
          <View
            className="flex-row items-center"
            style={{ gap: s(10), paddingVertical: s(4) }}
          >
            <View
              style={{
                width: s(24),
                height: s(24),
                borderRadius: s(12),
                backgroundColor: COLORS.palette.green,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="checkmark" size={16} color={COLORS.white} />
            </View>
            <Typography
              variant="body-02"
              weight="semibold"
              className="text-gray-900"
              style={{ flex: 1 }}
            >
              완료된 회기예요
            </Typography>
            <TouchableOpacity hitSlop={6} activeOpacity={0.7}>
              <Typography variant="label-01" weight="medium" className="text-gray-600">
                되돌리기
              </Typography>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            activeOpacity={0.85}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: s(8),
              height: s(44),
              borderRadius: s(12),
              backgroundColor: COLORS.primary50,
            }}
          >
            <Ionicons name="receipt-outline" size={18} color={COLORS.primary700} />
            <Typography variant="body-02" weight="semibold" style={{ color: COLORS.primary700 }}>
              청구하기
            </Typography>
          </TouchableOpacity>
        </View>
      </View>

      {/* 전체폭 gray 밴드 — 하단 영역 분리 */}
      <View
        style={{
          height: s(8),
          backgroundColor: COLORS.gray[50],
          marginHorizontal: -s(20),
          marginTop: s(32),
        }}
      />

      {/* Section 2/3 — 필드노트 + 일지 (gap 32) */}
      <View style={{ paddingTop: s(32), gap: s(32) }}>
        {/* 필드노트 — gray-50 박스, 가운데 정렬 */}
        <View style={{ gap: s(10) }}>
          <Typography variant="title-01" weight="semibold" className="text-gray-900">
            필드노트
          </Typography>
          <View
            style={{
              backgroundColor: COLORS.gray[50],
              borderRadius: s(16),
              paddingHorizontal: s(16),
              paddingVertical: s(20),
              gap: s(16),
            }}
          >
            <View style={{ gap: s(2), alignItems: 'center' }}>
              <Typography variant="body-03" weight="medium" className="text-gray-700">
                이 회기에 연결된 필드노트가 없어요
              </Typography>
              <Typography variant="body-03" className="text-gray-500">
                지금 녹음하거나 기존 노트를 연결하세요
              </Typography>
            </View>
            <View className="flex-row" style={{ gap: s(8) }}>
              <OutlineButton icon="mic-outline" label="녹음하기" />
              <OutlineButton icon="link-outline" label="연결하기" />
            </View>
          </View>
        </View>

        {/* 일지 — 1:1 standalone gray-50 카드 */}
        <View style={{ gap: s(10) }}>
          <Typography variant="title-01" weight="semibold" className="text-gray-900">
            일지
          </Typography>
          <View
            style={{
              backgroundColor: COLORS.gray[50],
              borderRadius: s(16),
              paddingVertical: s(16),
              paddingHorizontal: s(16),
              gap: s(10),
            }}
          >
            <View className="flex-row items-center" style={{ gap: s(8) }}>
              <View className="flex-row items-baseline" style={{ flex: 1, gap: s(6) }}>
                <Typography variant="body-02" weight="semibold" className="text-gray-900">
                  {MOCK.clientName}
                </Typography>
                <Typography variant="label-01" className="text-gray-500">
                  {MOCK.clientMeta}
                </Typography>
              </View>
              <AttendanceChip />
            </View>
            <TouchableOpacity
              activeOpacity={0.7}
              hitSlop={6}
              className="flex-row items-center"
              style={{ gap: s(4) }}
            >
              <Typography variant="label-01" weight="semibold" style={{ color: COLORS.primary700 }}>
                일지 작성
              </Typography>
              <Icon name="arrow-right" size={12} color={COLORS.primary700} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

/* ─── 공용 작은 조각 ─────────────────────────────────────────────── */
function StatusBadge({ label }: { label: string }) {
  return (
    <View
      style={{
        paddingHorizontal: s(8),
        paddingVertical: s(3),
        borderRadius: s(8),
        backgroundColor: COLORS.gray[200],
        marginTop: s(2),
      }}
    >
      <Typography variant="label-02" weight="medium" className="text-gray-600">
        {label}
      </Typography>
    </View>
  );
}

function MetaLine({
  icon,
  text,
}: {
  icon: 'time' | 'location-16';
  text: string;
}) {
  return (
    <View className="flex-row items-center" style={{ gap: s(6) }}>
      <Icon name={icon} size={18} color={COLORS.gray[500]} />
      <Typography variant="body-03" className="text-gray-500">
        {text}
      </Typography>
    </View>
  );
}

function OutlineButton({
  icon,
  label,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={{
        flex: 1,
        height: s(38),
        borderWidth: 1,
        borderColor: COLORS.gray[300],
        borderRadius: s(10),
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: s(6),
      }}
    >
      <Ionicons name={icon} size={16} color={COLORS.gray[500]} />
      <Typography variant="body-03" weight="medium" className="text-gray-500">
        {label}
      </Typography>
    </TouchableOpacity>
  );
}

function AttendanceChip() {
  return (
    <View
      style={{
        backgroundColor: COLORS.paletteBg.green,
        paddingHorizontal: s(10),
        paddingVertical: s(4),
        borderRadius: s(14),
      }}
    >
      <Typography variant="label-02" weight="semibold" style={{ color: COLORS.palette.green }}>
        참석
      </Typography>
    </View>
  );
}
