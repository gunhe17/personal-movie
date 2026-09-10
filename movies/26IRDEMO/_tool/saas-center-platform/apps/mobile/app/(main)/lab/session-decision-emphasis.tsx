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
 * [회기 상세] 일정 진행 결정 강조 비교
 *
 * 예정 회기 상세에서 "일정이 진행되었나요?"(완료/노쇼/취소)가 위 정보·메모와 같은 무게로
 * 묻히는 문제. 색을 더 쓰지 않고 구조(전체폭 밴드)·타이포(질문 헤딩 승격)·카드 크기로만 강조.
 *
 * 탭: [현재] 얇은 hairline + 작은 라벨 질문 + 인라인 카드
 *     [진행 결정 강조] 전체폭 gray-50 밴드 + title-01 헤딩 + 세로형 큰 카드
 */

type Tab = 'current' | 'emphasized';

const DECISIONS = [
  { id: 'completed', accent: COLORS.palette.green, icon: 'checkmark', label: '완료' },
  { id: 'no_show', accent: COLORS.palette.orange, icon: 'alert', label: '노쇼' },
  { id: 'cancelled', accent: COLORS.palette.red, icon: 'close', label: '취소' },
] as const;

export default function SessionDecisionEmphasisLab() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('emphasized');
  const emphasized = tab === 'emphasized';

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
          {(
            [
              { key: 'current', label: '현재' },
              { key: 'emphasized', label: '진행 결정 강조' },
            ] as const
          ).map((t) => {
            const active = tab === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                activeOpacity={0.8}
                onPress={() => setTab(t.key)}
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
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: s(20),
          paddingTop: s(16),
          paddingBottom: s(40),
          gap: s(16),
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* 지난 일지 진입점 (primary50) */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: s(10),
            paddingHorizontal: s(14),
            paddingVertical: s(13),
            borderRadius: s(12),
            backgroundColor: COLORS.primary50,
          }}
        >
          <View
            style={{
              width: s(32),
              height: s(32),
              borderRadius: s(8),
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: COLORS.white,
            }}
          >
            <Ionicons name="document-text" size={s(17)} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1, gap: s(1) }}>
            <Typography variant="body-02" weight="semibold" className="text-gray-900">
              지난 일지 4개
            </Typography>
            <Typography variant="label-01" className="text-gray-500">
              상담 전에 지난 회기 기록을 확인해보세요
            </Typography>
          </View>
          <Ionicons name="chevron-forward" size={s(18)} color={COLORS.primary} />
        </View>

        {/* 회기 정보 */}
        <View style={{ gap: s(6) }}>
          <Typography variant="label-01" className="text-gray-400">
            PLY-0420의 3회기
          </Typography>
          <View className="flex-row items-start" style={{ gap: s(8) }}>
            <View
              className="flex-row items-center"
              style={{ flex: 1, gap: s(6), flexWrap: 'wrap' }}
            >
              <Typography variant="headline-02" weight="bold" className="text-gray-900">
                홍길동 외 2명
              </Typography>
            </View>
            <View
              style={{
                paddingHorizontal: s(8),
                paddingVertical: s(3),
                borderRadius: s(8),
                backgroundColor: COLORS.gray[100],
                marginTop: s(2),
              }}
            >
              <Typography variant="label-02" weight="medium" className="text-gray-600">
                예정
              </Typography>
            </View>
          </View>
          <Typography variant="body-01" weight="medium" className="text-gray-800">
            놀이치료-그룹
          </Typography>
        </View>

        {/* 참여자 · 시간 · 장소 */}
        <View style={{ gap: s(6) }}>
          <View className="flex-row items-center" style={{ gap: s(8) }}>
            <View
              style={{
                width: s(22),
                height: s(22),
                borderRadius: s(11),
                backgroundColor: COLORS.primary50,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="people" size={14} color={COLORS.primary700} />
            </View>
            <Typography variant="body-02" weight="medium" className="flex-1 text-gray-700">
              홍길동 · 이영희 · 박철수
            </Typography>
          </View>
          <View className="flex-row items-center" style={{ gap: s(10) }}>
            <View className="flex-row items-center" style={{ gap: s(6) }}>
              <Icon name="time" size={18} color={COLORS.gray[500]} />
              <Typography variant="body-02" weight="medium" className="text-gray-700">
                5월 28일 (수) 14:00
              </Typography>
            </View>
            <View style={{ width: 1, height: s(12), backgroundColor: COLORS.gray[300] }} />
            <View className="flex-row items-center" style={{ gap: s(6) }}>
              <Icon name="location-16" size={18} color={COLORS.gray[500]} />
              <Typography variant="body-02" weight="medium" className="text-gray-700">
                상담실 A
              </Typography>
            </View>
          </View>
        </View>

        {/* 메모 */}
        <View style={{ gap: s(6) }}>
          <Typography variant="label-01" weight="semibold" className="text-gray-700">
            메모
          </Typography>
          <View
            style={{
              backgroundColor: COLORS.gray[50],
              borderRadius: s(12),
              paddingHorizontal: s(14),
              paddingVertical: s(12),
              minHeight: s(68),
            }}
          >
            <Typography variant="body-02" className="text-gray-900" style={{ lineHeight: s(22) }}>
              지난 회기에 다룬 또래 관계 주제를 이어가기. 보호자 면담 결과 공유 예정.
            </Typography>
          </View>
        </View>

        {/* ───── 진행 결정 ───── */}
        <DecisionSection emphasized={emphasized} />
      </ScrollView>
    </View>
  );
}

function DecisionSection({ emphasized }: { emphasized: boolean }) {
  return (
    <View>
      {emphasized ? (
        <View
          style={{
            height: s(10),
            backgroundColor: COLORS.gray[50],
            marginHorizontal: -s(20),
            marginTop: s(4),
            marginBottom: s(20),
          }}
        />
      ) : (
        <View
          style={{
            height: 1,
            backgroundColor: COLORS.gray[100],
            marginHorizontal: -s(4),
            marginTop: s(4),
            marginBottom: s(12),
          }}
        />
      )}

      <Typography
        variant={emphasized ? 'title-01' : 'label-01'}
        weight={emphasized ? 'semibold' : 'medium'}
        style={{ color: emphasized ? COLORS.gray[900] : COLORS.gray[500] }}
      >
        일정이 진행되었나요?
      </Typography>

      <View style={{ flexDirection: 'row', gap: s(8), marginTop: emphasized ? s(14) : s(8) }}>
        {DECISIONS.map((d) => (
          <DecisionCard
            key={d.id}
            emphasized={emphasized}
            accent={d.accent}
            icon={d.icon}
            label={d.label}
          />
        ))}
      </View>
    </View>
  );
}

function DecisionCard({
  emphasized,
  accent,
  icon,
  label,
}: {
  emphasized: boolean;
  accent: string;
  icon: string;
  label: string;
}) {
  if (emphasized) {
    // 세로형 큰 카드 — 아이콘 위 / 라벨 아래
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: COLORS.gray[50],
          borderRadius: s(12),
          paddingVertical: s(16),
          alignItems: 'center',
          gap: s(8),
        }}
      >
        <View
          style={{
            width: s(30),
            height: s(30),
            borderRadius: s(15),
            backgroundColor: accent,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={icon as never} size={18} color={COLORS.white} />
        </View>
        <Typography variant="body-01" weight="semibold" className="text-gray-900">
          {label}
        </Typography>
      </View>
    );
  }

  // 현재 — 인라인 카드 (아이콘 + 라벨 가로)
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
        <Ionicons name={icon as never} size={16} color={COLORS.white} />
      </View>
      <Typography variant="body-02" weight="semibold" className="text-gray-900">
        {label}
      </Typography>
    </View>
  );
}
