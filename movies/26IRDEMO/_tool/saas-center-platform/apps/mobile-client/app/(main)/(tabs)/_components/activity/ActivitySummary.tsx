/**
 * 활동 요약 탭 — 피그마 913:5939.
 *
 * 층 구조: 히어로(성장 문구 + 화분 일러스트) → 발달 지표 레이더 카드 →
 *          특성 키워드 클라우드 → 아이와 함께 연습해봐요.
 *
 * ⚠️ 지표·키워드·추천 활동은 아직 서버 계약이 없다 — summaryData.ts의 예시 값이며
 *    하단에 예시임을 고지한다(실데이터로 오인될 표면을 만들지 않는다).
 */
import React, { useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { Button, Typography } from '@/shared/components/ui';
import { COLORS, LAYOUT, RADIUS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';
import { DevelopmentRadar } from './DevelopmentRadar';
import { PracticeDetailSheet } from './PracticeDetailSheet';
import { PracticeList } from './PracticeList';
import { TraitCloud } from './TraitCloud';
import {
  DEVELOPMENT_AXES,
  DEVELOPMENT_HEADLINE,
  type PracticeItem,
} from './summaryData';
import PlantPotArt from '@assets/images/activity/plant-pot.svg';
import WateringCanArt from '@assets/images/activity/watering-can.svg';
import QuestionIcon16 from '@assets/icons/16/QuestionIcon16.svg';

/** 레이더 카드 안쪽 여백 — 차트는 이 여백을 넘겨 카드 폭 전체를 쓴다 */
const CARD_PAD = 20;

interface ActivitySummaryProps {
  /** 히어로 문구에 들어갈 아이 이름 */
  childName: string;
  onOpenIndicatorGuide: () => void;
}

export function ActivitySummary({
  childName,
  onOpenIndicatorGuide,
}: ActivitySummaryProps) {
  const { width: windowWidth } = useWindowDimensions();
  const [practice, setPractice] = useState<PracticeItem | null>(null);
  // 카드 = 화면 폭에서 좌우 화면 여백(16)을 뺀 값. 레이더 중심을 여기서 잡는다.
  const cardWidth = windowWidth - LAYOUT.screenPaddingX * 2;

  return (
    <View style={{ rowGap: s(12) }}>
      {/* 히어로 — 문구는 왼쪽, 화분·물뿌리개는 오른쪽 절대배치(시안 928:6834) */}
      <View style={{ height: s(88) }}>
        <Typography
          variant="headline-02"
          weight="semibold"
          style={{ color: COLORS.text.headline }}
        >
          {`${childName}의 마음이\n이렇게 자라고 있어요`}
        </Typography>
        <WateringCanArt
          width={s(63)}
          height={s(63)}
          style={{ position: 'absolute', right: s(13.4), top: 0 }}
        />
        <PlantPotArt
          width={s(64)}
          height={s(64)}
          style={{ position: 'absolute', right: s(60.2), top: s(21) }}
        />
      </View>

      {/* 발달 지표 레이더 카드 */}
      <View
        className="overflow-hidden bg-surface"
        style={{ borderRadius: RADIUS['2xl'], paddingVertical: s(CARD_PAD) }}
      >
        <Typography
          variant="title-01"
          weight="semibold"
          style={{
            paddingHorizontal: s(CARD_PAD),
            color: COLORS.text.headline,
          }}
        >
          {DEVELOPMENT_HEADLINE.map((part, index) => (
            <Typography
              key={index}
              variant="title-01"
              weight="semibold"
              style={{
                color: part.accent ? COLORS.brand[500] : COLORS.text.headline,
              }}
            >
              {part.text}
            </Typography>
          ))}
        </Typography>

        <View style={{ marginTop: s(24) }}>
          <DevelopmentRadar axes={DEVELOPMENT_AXES} width={cardWidth} />
        </View>

        <Button
          label="지표가 궁금해요"
          variant="outline"
          size="md"
          icon={<QuestionIcon16 width={16} height={16} />}
          onPress={onOpenIndicatorGuide}
          style={{ marginTop: s(33), marginHorizontal: s(CARD_PAD) }}
        />
      </View>

      <TraitCloud />

      <View style={{ marginTop: s(12) }}>
        <PracticeList onSelect={setPractice} />
      </View>

      <PracticeDetailSheet item={practice} onClose={() => setPractice(null)} />

      <Typography
        variant="label-01"
        className="text-center"
        style={{ marginTop: s(8), color: COLORS.text.caption.subtle }}
      >
        발달 지표·키워드·추천 활동은 준비 중인 기능의 예시 화면이에요
      </Typography>
    </View>
  );
}
