/**
 * 기록 목록 카드 — 시안 323:4690.
 *
 * 썸네일 91×96(있을 때만) + [날짜 16 Medium / 시각 14 subtle / 본문 2줄] +
 * 오른쪽 위 북마크 원(28). 북마크 표현은 상세 카드와 같다(299:2589).
 *
 * 가족 스코프라 한 타임라인에 여러 구성원의 기록이 섞인다 — 작성자 표시가 필수다
 * (§16-4 "양육자별 관찰 차이 자체가 임상 정보"). 시안 카드에는 작성자 줄이 없어
 * 내 기록이 아닐 때만 시각 옆에 덧붙인다. 투명성 배지는 🔒/👥 2상태 고정이라(§7-9)
 * 작성자를 배지로 만들지 않는다.
 *
 * 기분은 카드에서 뺐다 — 시안이 날짜·시각·본문·썸네일만 두고, 기분은 상세에서
 * 사진 모서리의 표정으로 보여준다(집계·비교 금지 §15-1과도 같은 방향).
 */
import React from 'react';
import { Image, Pressable, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { type AppRecord } from '@/features/records';
import { Typography } from '@/shared/components/ui';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';
import { toKst } from '@/shared/utils/date';
import BookmarkIcon20 from '@assets/icons/20/BookmarkIcon20.svg';

interface RecordListCardProps {
  record: AppRecord;
  onPress: () => void;
}

export function RecordListCard({ record, onPress }: RecordListCardProps) {
  const thumbnail = record.media.find((m) => m.url);
  // 서버는 UTC naive를 준다 — KST 벽시계로 옮겨야 시각이 9시간 밀리지 않는다
  const occurredAt = toKst(record.occurred_at);
  const pressed = useSharedValue(0);

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * 0.015 }],
    opacity: 1 - pressed.value * 0.06,
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${format(occurredAt, 'M월 d일')} 기록`}
      onPress={onPress}
      onPressIn={() => {
        pressed.value = withTiming(1, { duration: 90 });
      }}
      onPressOut={() => {
        pressed.value = withTiming(0, { duration: 140 });
      }}
    >
      <Animated.View
        style={[
          {
            padding: s(16),
            borderRadius: s(16),
            backgroundColor: COLORS.surface,
          },
          pressStyle,
        ]}
      >
        <View className="flex-row items-start" style={{ columnGap: s(16) }}>
          {thumbnail?.url ? (
            <Image
              source={{ uri: thumbnail.url }}
              style={{
                width: s(91),
                height: s(96),
                borderRadius: s(12),
                backgroundColor: COLORS.gray[100],
              }}
              resizeMode="cover"
            />
          ) : null}

          <View className="flex-1" style={{ rowGap: s(8) }}>
            <View style={{ rowGap: s(8) }}>
              {/* 북마크 원이 오른쪽 위를 차지해 날짜 줄만 폭을 비워 둔다 */}
              <View style={{ paddingRight: s(32) }}>
                <Typography
                  variant="body-01"
                  weight="medium"
                  style={{ color: COLORS.black }}
                >
                  {format(occurredAt, 'yyyy. MM. dd EEEE', { locale: ko })}
                </Typography>
              </View>
              <View
                className="flex-row flex-wrap items-center"
                style={{ columnGap: s(6) }}
              >
                <Typography
                  variant="body-03"
                  style={{ color: COLORS.text.body.subtle }}
                >
                  {format(occurredAt, 'a h:mm', { locale: ko })}
                </Typography>
                {!record.is_mine && record.author_name ? (
                  <Typography
                    variant="body-03"
                    style={{ color: COLORS.text.caption.subtle }}
                  >
                    {record.author_name}
                  </Typography>
                ) : null}
              </View>
            </View>

            {record.body ? (
              <Typography
                variant="body-02-reading"
                numberOfLines={2}
                style={{ color: COLORS.text.body.default }}
              >
                {record.body}
              </Typography>
            ) : null}
          </View>
        </View>

        {record.bookmarked_at ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              right: s(16),
              top: s(8),
              width: s(28),
              height: s(28),
              borderRadius: s(14),
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: COLORS.tag.teal.bg,
            }}
          >
            <BookmarkIcon20
              width={s(20)}
              height={s(20)}
              color={COLORS.tag.teal.fg}
            />
          </View>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}
