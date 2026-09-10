/**
 * 이런 특성도 자주 보였어요 — 키워드 버블 클라우드 + 근거 인용 (피그마 928:7741).
 *
 * 버블 탭 = 아래 인용 교체, 좌우 화살표 = 이전/다음 키워드. 시안엔 인용이 한 건만
 * 그려져 있으나 화살표가 있어 순회를 전제한다 — 같은 목록을 두 조작이 공유한다.
 */
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Typography } from '@/shared/components/ui';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';
import {
  TRAIT_BUBBLES,
  TRAIT_CLOUD_SIZE,
  TRAIT_QUOTES,
} from './summaryData';
import ArrowLeftIcon20 from '@assets/icons/20/ArrowLeftIcon20.svg';
import ArrowRightIcon20 from '@assets/icons/20/ArrowRightIcon20.svg';

export function TraitCloud() {
  const [index, setIndex] = useState(0);
  const quote = TRAIT_QUOTES[index];

  const move = (delta: number) =>
    setIndex(
      (prev) => (prev + delta + TRAIT_QUOTES.length) % TRAIT_QUOTES.length,
    );

  return (
    <View
      className="items-center rounded-2xl bg-surface"
      style={{ padding: s(20), rowGap: s(24) }}
    >
      <View className="w-full" style={{ rowGap: s(8) }}>
        <Typography
          variant="title-01"
          weight="semibold"
          style={{ color: COLORS.text.title.default }}
        >
          이런 특성도 자주 보였어요
        </Typography>
        <Typography variant="body-02" style={{ color: COLORS.text.body.default }}>
          상담일지와 기록에서 자주 언급된 키워드예요
        </Typography>
      </View>

      <View
        style={{
          width: s(TRAIT_CLOUD_SIZE.width),
          height: s(TRAIT_CLOUD_SIZE.height),
        }}
      >
        {TRAIT_BUBBLES.map((bubble) => {
          const quoteIndex = TRAIT_QUOTES.findIndex(
            (item) => item.traitKey === bubble.key,
          );
          const selected = quoteIndex === index;
          const size = s(bubble.size);
          return (
            // ⚠️ 위치·크기는 이 정적 View가 소유한다. Pressable의 style 함수
            //    (({pressed}) => ({position, left, top}))에 레이아웃 값을 섞으면
            //    실기기에서 적용이 깨져 버블이 전부 겹친다 (mobile-client.md §5).
            <View
              key={bubble.key}
              style={{
                position: 'absolute',
                left: s(bubble.x),
                top: s(bubble.y),
                width: size,
                height: size,
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`${bubble.label} 기록 보기`}
                onPress={() => quoteIndex >= 0 && setIndex(quoteIndex)}
                style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
              >
                <View
                  className="items-center justify-center"
                  style={{
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    backgroundColor: bubble.color,
                    // 시안은 버블 전부 불투명 — 선택 표시는 아래 인용 박스의
                    // 제목이 맡는다(버블을 흐리게 하면 클라우드가 지저분해진다)
                  }}
                >
                  <Typography
                    variant={bubble.size >= 100 ? 'title-01' : 'body-02'}
                    weight="semibold"
                    numberOfLines={1}
                    style={{ color: COLORS.white }}
                  >
                    {bubble.label}
                  </Typography>
                </View>
              </Pressable>
            </View>
          );
        })}
      </View>

      <View
        className="w-full flex-row items-center rounded-xl"
        style={{ padding: s(12), columnGap: s(4), backgroundColor: COLORS.bg.base }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="이전 키워드"
          onPress={() => move(-1)}
          hitSlop={8}
          style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
        >
          <ArrowLeftIcon20 width={20} height={20} />
        </Pressable>

        <View className="flex-1" style={{ rowGap: s(8) }}>
          <Typography
            variant="body-03"
            weight="medium"
            style={{ color: COLORS.text.title.subtle }}
          >
            {quote.title}
          </Typography>
          <Typography
            variant="body-03"
            weight="medium"
            style={{ color: COLORS.text.body.default }}
          >
            {quote.quote}
          </Typography>
          <Typography
            variant="label-01"
            style={{ color: COLORS.text.body.subtle }}
          >
            {quote.recordedAt}
          </Typography>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="다음 키워드"
          onPress={() => move(1)}
          hitSlop={8}
          style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
        >
          <ArrowRightIcon20 width={20} height={20} />
        </Pressable>
      </View>
    </View>
  );
}
