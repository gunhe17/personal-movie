/**
 * 아이와 함께 연습해봐요 — 지표 영역별 추천 활동 목록 (피그마 928:7095).
 * 행 = 영역 뱃지 + 활동 이름 + 일러스트, 사이는 헤어라인 구분.
 */
import React from 'react';
import { Pressable, View } from 'react-native';
import type { SvgProps } from 'react-native-svg';
import { Badge, Typography } from '@/shared/components/ui';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';
import { PRACTICE_ITEMS, type PracticeItem } from './summaryData';
import ActivityBook from '@assets/images/activity/activity-book.svg';
import ActivityShop from '@assets/images/activity/activity-shop.svg';
import ActivityTurtle from '@assets/images/activity/activity-turtle.svg';

const ILLUSTRATION: Record<string, React.FC<SvgProps>> = {
  book: ActivityBook,
  shop: ActivityShop,
  turtle: ActivityTurtle,
};

export function PracticeList({
  onSelect,
}: {
  onSelect: (item: PracticeItem) => void;
}) {
  return (
    <View style={{ rowGap: s(12) }}>
      <Typography
        variant="title-01"
        weight="semibold"
        style={{ color: COLORS.text.title.default }}
      >
        아이와 함께 연습해봐요
      </Typography>

      <View
        className="rounded-2xl bg-surface"
        style={{
          paddingTop: s(16),
          paddingHorizontal: s(16),
          paddingBottom: s(20),
          rowGap: s(16),
        }}
      >
        {PRACTICE_ITEMS.map((item, index) => {
          const Illustration = ILLUSTRATION[item.key];
          return (
            <React.Fragment key={item.key}>
              {index > 0 ? (
                <View
                  style={{ height: 1, backgroundColor: COLORS.border.subtle }}
                />
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${item.title} 자세히 보기`}
                onPress={() => onSelect(item)}
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
              >
                <View className="flex-row items-center justify-between">
                  {/* 시안은 128 고정폭이나 실제로는 제목이 한 줄로 넘쳐 그려진다
                      — 폰트 폭 편차로 잘리지 않도록 남는 폭을 준다 */}
                  <View
                    className="flex-1"
                    style={{ marginRight: s(12), rowGap: s(4) }}
                  >
                    <View className="self-start">
                      <Badge
                        shape="rect"
                        color={item.domainColor}
                        label={item.domain}
                      />
                    </View>
                    <Typography
                      variant="body-01"
                      weight="semibold"
                      style={{ color: COLORS.text.headline }}
                    >
                      {item.title}
                    </Typography>
                  </View>
                  {Illustration ? (
                    <Illustration width={s(44)} height={s(44)} />
                  ) : null}
                </View>
              </Pressable>
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
}
