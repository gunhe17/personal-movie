import { useState } from 'react';
import { View, ScrollView, TouchableOpacity, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/shared/constants/theme';
import { Typography } from '@/shared/components/ui/Typography';
import { Icon } from '@/shared/components/icons';
import { s } from '@/shared/utils/scale';

/**
 * 회기 상세 상단 영역 그룹핑 비교 시안.
 *
 * 4탭 비교:
 *   A 현재 — gap 16 균일 (대조군)
 *   B Pattern A — gap 차별화 + 메모/진행 라벨 강화 (light-touch)
 *   C Pattern B — 메모 + 진행 + 취소사유를 하나의 gray-50 카드로 통합
 *   D Pattern C — 메모만 gray-50 카드, 진행은 떠 있음 (성격별 분리)
 *
 * mock: 예정 상태 그룹 회기, 메모 없음.
 */

type Variant = 'A' | 'B' | 'C' | 'D' | 'E';
const VARIANTS: { key: Variant; label: string; desc: string }[] = [
  { key: 'A', label: 'A 현재', desc: 'gap 16 균일' },
  { key: 'B', label: 'B 공간+라벨', desc: 'gap 차별화 + 미니 라벨' },
  { key: 'C', label: 'C 통합 카드', desc: '메모+진행 한 카드' },
  { key: 'D', label: 'D 메모만 카드', desc: '진행은 떠 있음' },
  { key: 'E', label: 'E D + 진행 분리선', desc: '메모 라벨 카드 안 + 진행 위 hairline' },
];

const MOCK = {
  title: '홍길동 외 1명',
  program: '놀이치료-그룹',
  dateLabel: '2026년 5월 28일 (목) 14:00',
  roomName: '상담실 A',
  memo: '',
};

export default function CounselingSessionTopGroupingLab() {
  const router = useRouter();
  const [variant, setVariant] = useState<Variant>('B');
  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: COLORS.white }} edges={['top']}>
      {/* 헤더 */}
      <View
        className="h-[52px] flex-row items-center px-5"
        style={{ backgroundColor: COLORS.white }}
      >
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={COLORS.gray[900]} />
        </TouchableOpacity>
        <Typography
          variant="title-01"
          weight="semibold"
          className="flex-1 text-gray-900"
          style={{ marginLeft: s(6) }}
        >
          상단 그룹핑 시안
        </Typography>
      </View>

      {/* 탭 */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: s(20),
          paddingTop: s(8),
          paddingBottom: s(12),
          gap: s(8),
        }}
      >
        {VARIANTS.map((v) => {
          const active = variant === v.key;
          return (
            <Pressable
              key={v.key}
              onPress={() => setVariant(v.key)}
              style={{
                paddingHorizontal: s(14),
                paddingVertical: s(8),
                borderRadius: 999,
                backgroundColor: active ? COLORS.gray[900] : COLORS.white,
                borderWidth: 1,
                borderColor: active ? COLORS.gray[900] : COLORS.gray[200],
              }}
            >
              <Typography
                variant="body-03"
                weight="semibold"
                style={{ color: active ? COLORS.white : COLORS.gray[800] }}
              >
                {v.label}
              </Typography>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* 변주 부제 */}
      <View style={{ paddingHorizontal: s(20), paddingBottom: s(8) }}>
        <Typography variant="label-01" className="text-gray-500">
          {VARIANTS.find((x) => x.key === variant)?.desc}
        </Typography>
      </View>

      <ScrollView
        style={{ flex: 1, backgroundColor: COLORS.gray[100] }}
        contentContainerStyle={{ paddingVertical: s(16), paddingHorizontal: s(16) }}
      >
        {/* 시안 영역 — 흰 카드 위 wrap, 실제 회기 상세 width 시뮬레이션 */}
        <View
          style={{
            backgroundColor: COLORS.white,
            borderRadius: s(20),
            overflow: 'hidden',
          }}
        >
          {variant === 'A' && <VariantA />}
          {variant === 'B' && <VariantB />}
          {variant === 'C' && <VariantC />}
          {variant === 'D' && <VariantD />}
          {variant === 'E' && <VariantE />}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ───── 공통 sub-component ─────

function InfoHero() {
  return (
    <View style={{ gap: s(8) }}>
      <View className="flex-row items-start" style={{ gap: s(8) }}>
        <View style={{ flex: 1, gap: s(4) }}>
          <Typography variant="headline-02" weight="bold" className="text-gray-900">
            {MOCK.title}
          </Typography>
          <Typography variant="body-02" weight="medium" className="text-gray-600">
            {MOCK.program}
          </Typography>
        </View>
        <StatusBadge label="예정" />
      </View>
      <View
        className="flex-row items-center"
        style={{ gap: s(10), marginTop: s(6) }}
      >
        <InfoLine iconName="calendar-16" text={MOCK.dateLabel} />
        <View
          style={{
            width: 1,
            height: s(12),
            backgroundColor: COLORS.gray[300],
          }}
        />
        <InfoLine iconName="location-16" text={MOCK.roomName} />
      </View>
    </View>
  );
}

function InfoLine({
  iconName,
  text,
}: {
  iconName: 'calendar-16' | 'location-16';
  text: string;
}) {
  return (
    <View className="flex-row items-center" style={{ gap: s(6) }}>
      <Icon name={iconName} size={16} color={COLORS.gray[500]} />
      <Typography variant="body-03" weight="medium" className="text-gray-700">
        {text}
      </Typography>
    </View>
  );
}

function MemoBlock({ label = true }: { label?: boolean }) {
  return (
    <View style={{ gap: s(6) }}>
      {label && (
        <Typography variant="label-01" weight="semibold" className="text-gray-700">
          메모
        </Typography>
      )}
      <View
        style={{
          backgroundColor: COLORS.gray[50],
          borderRadius: s(12),
          paddingHorizontal: s(14),
          paddingVertical: s(12),
          minHeight: s(56),
          justifyContent: 'center',
        }}
      >
        <Typography variant="body-03" className="text-gray-400">
          작성된 메모가 없습니다
        </Typography>
      </View>
    </View>
  );
}

function StatusActions({ withTitle = true }: { withTitle?: boolean }) {
  return (
    <View style={{ gap: s(8) }}>
      {withTitle && (
        <Typography variant="label-01" weight="semibold" className="text-gray-700">
          일정이 진행되었나요?
        </Typography>
      )}
      <View style={{ flexDirection: 'row', gap: s(8) }}>
        <DecisionCard
          accent={COLORS.palette.green}
          iconName="checkmark"
          label="완료"
        />
        <DecisionCard
          accent={COLORS.palette.orange}
          iconName="alert"
          label="노쇼"
        />
        <DecisionCard accent={COLORS.palette.red} iconName="close" label="취소" />
      </View>
    </View>
  );
}

function DecisionCard({
  accent,
  iconName,
  label,
}: {
  accent: string;
  iconName: keyof typeof Ionicons.glyphMap;
  label: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: COLORS.gray[50],
        borderRadius: s(12),
        paddingVertical: s(10),
        paddingHorizontal: s(8),
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: s(6),
      }}
    >
      <View
        style={{
          width: s(22),
          height: s(22),
          borderRadius: s(11),
          backgroundColor: accent,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={iconName} size={16} color={COLORS.white} />
      </View>
      <Typography variant="body-02" weight="semibold" className="text-gray-900">
        {label}
      </Typography>
    </View>
  );
}

function StatusBadge({ label }: { label: string }) {
  return (
    <View
      style={{
        backgroundColor: COLORS.statusBadge.scheduled.bg,
        paddingHorizontal: s(8),
        paddingVertical: s(4),
        borderRadius: s(8),
        marginTop: s(2),
      }}
    >
      <Typography
        variant="label-02"
        weight="semibold"
        style={{ color: COLORS.statusBadge.scheduled.text }}
      >
        {label}
      </Typography>
    </View>
  );
}

function InfoChip({
  iconName,
  text,
}: {
  iconName: 'calendar-16' | 'location-16';
  text: string;
}) {
  return (
    <View
      className="flex-row items-center"
      style={{
        backgroundColor: COLORS.gray[50],
        borderRadius: s(999),
        paddingHorizontal: s(10),
        paddingVertical: s(6),
        gap: s(4),
      }}
    >
      <Icon name={iconName} size={14} color={COLORS.gray[500]} />
      <Typography variant="label-01" weight="medium" className="text-gray-700">
        {text}
      </Typography>
    </View>
  );
}

function Hairline({ inset = 0 }: { inset?: number }) {
  return (
    <View
      style={{
        height: 1,
        backgroundColor: COLORS.gray[200],
        marginHorizontal: inset,
      }}
    />
  );
}

// ─────────────── Variant A — 현재 (대조군) ───────────────
function VariantA() {
  return (
    <View style={{ paddingHorizontal: s(20), paddingTop: s(16), paddingBottom: s(40), gap: s(16) }}>
      <InfoHero />
      <MemoBlock />
      <StatusActions />
    </View>
  );
}

// ─────────────── Variant B — 공간+라벨 (Pattern A) ───────────────
// 정보 → gap 28 → 메모(라벨) → gap 16 → 진행(라벨 강화)
function VariantB() {
  return (
    <View style={{ paddingHorizontal: s(20), paddingTop: s(16), paddingBottom: s(40) }}>
      <InfoHero />
      <View style={{ height: s(28) }} />
      <MemoBlock />
      <View style={{ height: s(16) }} />
      <StatusActions />
    </View>
  );
}

// ─────────────── Variant C — 통합 카드 (Pattern B) ───────────────
// 정보 → 한 gray-50 컨테이너 안 [메모 + 구분선 + 진행]
function VariantC() {
  return (
    <View style={{ paddingHorizontal: s(20), paddingTop: s(16), paddingBottom: s(40), gap: s(16) }}>
      <InfoHero />
      <View
        style={{
          backgroundColor: COLORS.gray[50],
          borderRadius: s(16),
          padding: s(14),
          gap: s(14),
        }}
      >
        <View style={{ gap: s(6) }}>
          <Typography variant="label-01" weight="semibold" className="text-gray-700">
            메모
          </Typography>
          <View
            style={{
              backgroundColor: COLORS.white,
              borderRadius: s(10),
              paddingHorizontal: s(12),
              paddingVertical: s(10),
              minHeight: s(48),
              justifyContent: 'center',
            }}
          >
            <Typography variant="body-03" className="text-gray-400">
              작성된 메모가 없습니다
            </Typography>
          </View>
        </View>
        <Hairline inset={-s(14)} />
        <View style={{ gap: s(8) }}>
          <Typography variant="label-01" weight="semibold" className="text-gray-700">
            일정이 진행되었나요?
          </Typography>
          <View style={{ flexDirection: 'row', gap: s(8) }}>
            <DecisionCardOnWhite
              accent={COLORS.palette.green}
              iconName="checkmark"
              label="완료"
            />
            <DecisionCardOnWhite
              accent={COLORS.palette.orange}
              iconName="alert"
              label="노쇼"
            />
            <DecisionCardOnWhite
              accent={COLORS.palette.red}
              iconName="close"
              label="취소"
            />
          </View>
        </View>
      </View>
    </View>
  );
}

function DecisionCardOnWhite({
  accent,
  iconName,
  label,
}: {
  accent: string;
  iconName: keyof typeof Ionicons.glyphMap;
  label: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: COLORS.white,
        borderRadius: s(12),
        paddingVertical: s(10),
        paddingHorizontal: s(8),
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: s(6),
      }}
    >
      <View
        style={{
          width: s(22),
          height: s(22),
          borderRadius: s(11),
          backgroundColor: accent,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={iconName} size={16} color={COLORS.white} />
      </View>
      <Typography variant="body-02" weight="semibold" className="text-gray-900">
        {label}
      </Typography>
    </View>
  );
}

// ─────────────── Variant D — 메모만 카드 (Pattern C) ───────────────
// 정보 → 메모(gray-50 카드, 라벨+본문 함께 묶음) → 진행(떠 있음, 액션 톤)
function VariantD() {
  return (
    <View style={{ paddingHorizontal: s(20), paddingTop: s(16), paddingBottom: s(40), gap: s(16) }}>
      <InfoHero />
      <View
        style={{
          backgroundColor: COLORS.gray[50],
          borderRadius: s(16),
          paddingHorizontal: s(14),
          paddingVertical: s(12),
          gap: s(6),
        }}
      >
        <Typography variant="label-01" weight="semibold" className="text-gray-700">
          메모
        </Typography>
        <Typography variant="body-03" className="text-gray-400">
          작성된 메모가 없습니다
        </Typography>
      </View>
      <StatusActions />
    </View>
  );
}

// ─────────────── Variant E — D + 진행 위 분리선 ───────────────
// 정보 → 메모(D처럼 라벨 카드 안에) → hairline divider → 일정이 진행되었나요? + cards
function VariantE() {
  return (
    <View style={{ paddingHorizontal: s(20), paddingTop: s(16), paddingBottom: s(40), gap: s(16) }}>
      <InfoHero />
      <View
        style={{
          backgroundColor: COLORS.gray[50],
          borderRadius: s(16),
          paddingHorizontal: s(14),
          paddingVertical: s(12),
          gap: s(6),
        }}
      >
        <Typography variant="label-01" weight="semibold" className="text-gray-700">
          메모
        </Typography>
        <Typography variant="body-03" className="text-gray-400">
          작성된 메모가 없습니다
        </Typography>
      </View>
      {/* 메모와 진행 selection 사이 분리선 — full-width, 연한 톤 */}
      <View
        style={{
          height: 1,
          backgroundColor: COLORS.gray[100],
          marginHorizontal: -s(20),
        }}
      />
      <StatusActions />
    </View>
  );
}
