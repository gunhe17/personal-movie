import { useState } from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { COLORS, LAYOUT } from '@/shared/constants/theme';
import { Typography } from '@/shared/components/ui/Typography';
import { Icon } from '@/shared/components/icons';
import { s } from '@/shared/utils/scale';

/**
 * [토큰] 본문 회색(gray-600 = text/body/default) 톤 비교
 *
 * 피드백: text/body/default(#606A74)가 실기기에서 연하게 느껴진다 → 토큰을
 * 미세하게 진하게 조정할지 비교. (확정 시 theme.ts gray-600 + design.md
 * text/body/default 동기 개정 — 앱 전역 영향이라 신중히.)
 *
 * 후보는 현재 회색의 블루 틴트(R<G<B, +10/+10)를 유지한 채 등간격으로 어둡게.
 * 동일한 title+body 가상 샘플에 후보색을 적용해 흰 카드 / 회색 페이지 맥락에서 비교.
 */

type ToneKey = 'current' | 'd8' | 'd16' | 'd24';

interface Tone {
  key: ToneKey;
  label: string;
  hex: string;
  rgb: string;
}

// 현재 #606A74 = rgb(96,106,116). 블루 틴트(+10/+10) 유지하며 8씩 어둡게.
const TONES: Tone[] = [
  { key: 'current', label: '현재', hex: '#606A74', rgb: '96·106·116' },
  { key: 'd8', label: '-8', hex: '#58626C', rgb: '88·98·108' },
  { key: 'd16', label: '-16', hex: '#505A64', rgb: '80·90·100' },
  { key: 'd24', label: '-24', hex: '#48525C', rgb: '72·82·92' },
];

const MOCK = {
  title: '홍길동님 상담 요약',
  body:
    '지난 회기에서는 또래 관계에서 느끼는 불안을 중심으로 이야기를 나눴어요. 놀이 과정에서 감정 표현이 한결 자연스러워졌고, 다음 회기에는 보호자 면담 결과를 함께 살펴볼 예정이에요.',
  rows: [
    { label: '프로그램', value: '놀이치료-개인' },
    { label: '다음 상담일', value: '6월 12일 (목) 14:00' },
    { label: '담당', value: '김상담' },
  ],
  caption: '마지막 업데이트 · 6월 8일',
};

export default function BodyGrayToneLab() {
  const router = useRouter();
  const [toneKey, setToneKey] = useState<ToneKey>('current');
  const tone = TONES.find((t) => t.key === toneKey)!;
  const body = tone.hex; // 후보 본문색 (text/body/default 대체값)

  return (
    <View className="flex-1" style={{ backgroundColor: COLORS.gray[50] }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: COLORS.white }}>
        <View
          style={{
            height: s(52),
            paddingHorizontal: s(LAYOUT.screenPaddingX),
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
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
          <Typography variant="title-01" weight="semibold" className="text-gray-900">
            본문 회색 톤
          </Typography>
          <View style={{ width: s(24) }} />
        </View>
      </SafeAreaView>

      {/* 탭 pill */}
      <View
        style={{
          paddingHorizontal: s(LAYOUT.screenPaddingX),
          paddingTop: s(8),
          backgroundColor: COLORS.white,
          paddingBottom: s(12),
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: COLORS.gray[50],
            borderRadius: s(10),
            padding: s(3),
          }}
        >
          {TONES.map((t) => {
            const active = t.key === toneKey;
            return (
              <TouchableOpacity
                key={t.key}
                activeOpacity={0.8}
                onPress={() => setToneKey(t.key)}
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
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: s(LAYOUT.screenPaddingX),
          paddingTop: s(16),
          paddingBottom: s(48),
          gap: s(12),
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* 현재 적용값 표시 */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: s(10),
            paddingVertical: s(4),
          }}
        >
          <View
            style={{
              width: s(28),
              height: s(28),
              borderRadius: s(8),
              backgroundColor: body,
            }}
          />
          <View>
            <Typography variant="body-03" weight="semibold" className="text-gray-900">
              {tone.hex}
              {tone.key === 'current' ? '  (text/body/default 현재값)' : ''}
            </Typography>
            <Typography variant="label-01" style={{ color: COLORS.gray[500] }}>
              rgb {tone.rgb}
            </Typography>
          </View>
        </View>

        {/* 샘플 1 — 흰 카드 위 본문 (실제 카드 맥락) */}
        <SampleCard bg={COLORS.white} bodyColor={body} contextLabel="흰 카드 위 (surface/card)" />

        {/* 샘플 2 — 회색 페이지 위 본문 (페이지 직접 노출 맥락) */}
        <SampleCard
          bg={COLORS.gray[50]}
          bodyColor={body}
          contextLabel="회색 페이지 위 (surface/page)"
          bordered
        />

        {/* 한 줄 비교 — 같은 문장을 후보 색으로 동시에 */}
        <View
          style={{
            backgroundColor: COLORS.white,
            borderRadius: s(12),
            padding: s(16),
            gap: s(10),
          }}
        >
          <Typography variant="label-01" weight="semibold" style={{ color: COLORS.gray[500] }}>
            후보 한눈 비교 (body-02)
          </Typography>
          {TONES.map((t) => (
            <View key={t.key} style={{ flexDirection: 'row', alignItems: 'center', gap: s(8) }}>
              <Typography
                variant="label-02"
                weight="medium"
                style={{ width: s(64), color: COLORS.gray[400] }}
              >
                {t.label} {t.hex}
              </Typography>
              <Typography variant="body-02" style={{ flex: 1, color: t.hex }}>
                감정 표현이 한결 자연스러워졌어요
              </Typography>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

// 타이틀(고정 strong) + 본문/레이블/캡션(후보색) 조합 샘플
function SampleCard({
  bg,
  bodyColor,
  contextLabel,
  bordered,
}: {
  bg: string;
  bodyColor: string;
  contextLabel: string;
  bordered?: boolean;
}) {
  return (
    <View
      style={{
        backgroundColor: bg,
        borderRadius: s(12),
        padding: s(16),
        gap: s(12),
        borderWidth: bordered ? 1 : 0,
        borderColor: COLORS.gray[200],
      }}
    >
      <Typography variant="label-02" weight="medium" style={{ color: COLORS.gray[400] }}>
        {contextLabel}
      </Typography>

      {/* 타이틀 — text/body/strong(gray-900) 고정 */}
      <Typography variant="title-01" weight="semibold" style={{ color: COLORS.gray[900] }}>
        {MOCK.title}
      </Typography>

      {/* 본문 단락 — 후보색 (가독성 핵심 판단 지점) */}
      <Typography variant="body-02" style={{ color: bodyColor, lineHeight: s(22) }}>
        {MOCK.body}
      </Typography>

      {/* 레이블-값 — 레이블 후보색, 값 gray-900 */}
      <View style={{ gap: s(8) }}>
        {MOCK.rows.map((r) => (
          <View key={r.label} style={{ flexDirection: 'row', gap: s(12) }}>
            <Typography variant="body-03" style={{ width: s(76), color: bodyColor }}>
              {r.label}
            </Typography>
            <Typography variant="body-03" style={{ flex: 1, color: COLORS.gray[900] }}>
              {r.value}
            </Typography>
          </View>
        ))}
      </View>

      {/* 캡션 — 후보색 소형 */}
      <Typography variant="label-01" style={{ color: bodyColor }}>
        {MOCK.caption}
      </Typography>
    </View>
  );
}
