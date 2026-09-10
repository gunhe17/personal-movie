/**
 * 기록 상세 — 시안 287:2878. 배경 글로우 위에 집게로 집어 둔 카드 한 장.
 *
 * §15-5 보호자 주권: 수정은 무흔적(이력·"수정됨" 딱지 없음), 삭제는 즉시 파기 +
 * 죄책감 팝업 금지(확인만 받고 담백하게), 프로필 이동은 원탭.
 * 수정·삭제·이동은 작성자 본인 + 가족 관리자만 — 서버가 막지만 화면도 감춘다.
 *
 * 시안 양옆의 겹친 종이(295:2146·295:2147)는 뺐다 — 상세는 한 장을 보는 화면이라
 * 이전·다음 기록을 암시할 이유가 없다(2026-07-29 판정).
 *
 * 시안에 없지만 남겨 둔 것 — 문서가 요구하는 표면이라 뺄 수 없다:
 *   · 투명성 한 줄(§6·§7-9) — 카드 아래 캡션
 *   · 개인 메모(§15-6) — 두 번째 카드
 *   · 옮기기·지우기(§15-5) — 카드 아래 조용한 텍스트 액션
 * ⚠️ 공유(👥)는 아직 없다 — 어느 센터로 보낼지 구조가 미정이라(기록-시안-정합-요청.md
 * §2-3) 시안의 [공유하기]는 표면만 두고 비활성이다. 투명성 배지도 항상 🔒.
 */
import React, { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMe } from '@/features/auth';
import {
  MOOD_ICON,
  MOOD_LABEL,
  RecordsBgGlow,
  useDeleteRecord,
  useMoveRecordProfile,
  useRecord,
  useSetRecordBookmark,
} from '@/features/records';
import {
  Button,
  ErrorView,
  LoadingView,
  Typography,
} from '@/shared/components/ui';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';
import { formatKst } from '@/shared/utils/date';
import ArrowLeftIcon24 from '@assets/icons/24/ArrowLeftIcon24.svg';
import BookmarkIcon20 from '@assets/icons/20/BookmarkIcon20.svg';
import LockIcon20 from '@assets/icons/20/LockIcon20.svg';

/** 카드를 집어 둔 집게 — 카드 상단 모서리에 걸친다(시안 295:2137 외 3개) */
const CLIP_COLOR = '#42474E';
const CLIP_OFFSETS = [32, 61, 239, 268];

/**
 * 시안 shadow/floating(0 −1 15.8 #000B14 8%) 인라인 —
 * SHADOWS 토큰 갱신은 엘리베이션 정본 확정까지 보류라 Fab과 같은 방식으로 둔다.
 */
const FLOATING_SHADOW = {
  shadowColor: '#000B14',
  shadowOffset: { width: 0, height: -1 },
  shadowOpacity: 0.08,
  shadowRadius: 7.9,
  elevation: 6,
} as const;

export default function RecordDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const meQuery = useMe();
  const recordQuery = useRecord(id ?? null);
  const setBookmark = useSetRecordBookmark();
  const deleteRecord = useDeleteRecord();
  const moveProfile = useMoveRecordProfile();
  const [moving, setMoving] = useState(false);

  const record = recordQuery.data;
  const profiles = meQuery.data?.profiles ?? [];
  const others = profiles.filter((p) => p.id !== record?.profile_id);
  const ready = record?.media.filter((m) => m.url) ?? [];
  const [photo, ...rest] = ready;
  const MoodFace = record?.mood ? MOOD_ICON[record.mood] : null;

  const confirmDelete = () =>
    Alert.alert('이 기록을 지울까요?', '내용과 첨부가 완전히 지워져요.', [
      { text: '아니요', style: 'cancel' },
      {
        text: '지우기',
        style: 'destructive',
        onPress: () =>
          deleteRecord.mutate(id as string, { onSuccess: () => router.back() }),
      },
    ]);

  return (
    <View className="flex-1 bg-background">
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          overflow: 'hidden',
        }}
      >
        <RecordsBgGlow />
      </View>

      <SafeAreaView className="flex-1" edges={['top']}>
        <View className="h-12 flex-row items-center px-4">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="뒤로"
            onPress={() => router.back()}
            hitSlop={8}
          >
            <ArrowLeftIcon24 width={24} height={24} />
          </Pressable>
        </View>

        {recordQuery.isLoading ? (
          <LoadingView className="flex-1" />
        ) : recordQuery.isError || !record ? (
          <ErrorView className="flex-1" onRetry={() => recordQuery.refetch()} />
        ) : (
          <ScrollView
            contentContainerStyle={{
              paddingTop: s(24),
              paddingBottom: s(40),
              rowGap: s(16),
            }}
            showsVerticalScrollIndicator={false}
          >
            <View>
              <View className="self-center" style={{ width: s(309) }}>
                <View
                  className="bg-surface"
                  style={{
                    borderRadius: s(16),
                    ...FLOATING_SHADOW,
                  }}
                >
                  <View
                    className="flex-row items-center justify-between"
                    style={{
                      paddingTop: s(20),
                      paddingBottom: s(12),
                      paddingHorizontal: s(16),
                      borderBottomWidth: 1,
                      borderBottomColor: COLORS.border.subtle,
                    }}
                  >
                    <View
                      className="flex-1 flex-row flex-wrap items-center"
                      style={{ columnGap: s(8) }}
                    >
                      <Typography
                        variant="body-01"
                        weight="semibold"
                        style={{ color: COLORS.black }}
                      >
                        {formatKst(record.occurred_at, 'yyyy. M. d EEEE')}
                      </Typography>
                      <Typography
                        variant="body-03"
                        style={{ color: COLORS.text.body.subtle }}
                      >
                        {formatKst(record.occurred_at, 'a h:mm')}
                      </Typography>
                      {/* 가족이 쓴 기록이면 누구 글인지 보여야 한다 */}
                      {!record.is_mine && record.author_name ? (
                        <Typography
                          variant="body-03"
                          style={{ color: COLORS.text.caption.subtle }}
                        >
                          {record.author_name}
                        </Typography>
                      ) : null}
                    </View>
                    <BookmarkButton
                      bookmarked={!!record.bookmarked_at}
                      onPress={() =>
                        setBookmark.mutate({
                          recordId: record.id,
                          bookmarked: !record.bookmarked_at,
                        })
                      }
                    />
                  </View>

                  <View style={{ padding: s(16), rowGap: s(21) }}>
                    {photo ? (
                      <View>
                        <Image
                          source={{ uri: photo.url as string }}
                          style={{
                            width: '100%',
                            height: s(117),
                            borderRadius: s(12),
                            backgroundColor: COLORS.gray[100],
                          }}
                          resizeMode="cover"
                        />
                        {/* 표정은 사진 오른쪽 아래 모서리에 걸친다(시안 703:8377) */}
                        {MoodFace ? (
                          <View
                            style={{
                              position: 'absolute',
                              right: -s(3),
                              bottom: -s(14),
                            }}
                          >
                            <MoodFace width={s(28)} height={s(28)} />
                          </View>
                        ) : null}
                      </View>
                    ) : MoodFace ? (
                      // 사진이 없으면 걸칠 데가 없다 — 본문 위 오른쪽에 둔다
                      <View className="flex-row items-center justify-end">
                        <MoodFace width={s(28)} height={s(28)} />
                      </View>
                    ) : null}

                    {/* 시안은 사진 한 장 기준 — 첨부가 더 있으면 아래로 이어 붙인다 */}
                    {rest.map((m) => (
                      <Image
                        key={m.id}
                        source={{ uri: m.url as string }}
                        style={{
                          width: '100%',
                          height: s(117),
                          borderRadius: s(12),
                          backgroundColor: COLORS.gray[100],
                        }}
                        resizeMode="cover"
                      />
                    ))}

                    <View style={{ rowGap: s(16) }}>
                      {record.body ? (
                        <Typography
                          variant="body-02-reading"
                          style={{ color: COLORS.text.body.strong }}
                        >
                          {record.body}
                        </Typography>
                      ) : (
                        <Typography
                          variant="body-02-reading"
                          style={{ color: COLORS.text.placeholder }}
                        >
                          {record.mood
                            ? `${MOOD_LABEL[record.mood]}라고 남긴 날이에요`
                            : '내용 없이 남긴 기록이에요'}
                        </Typography>
                      )}

                      <View className="flex-row" style={{ columnGap: s(8) }}>
                        {record.is_mine ? (
                          <View className="flex-1">
                            <Button
                              label="수정하기"
                              variant="assistive"
                              size="lg"
                              onPress={() =>
                                router.push(
                                  `/(main)/record-edit?id=${record.id}`,
                                )
                              }
                            />
                          </View>
                        ) : null}
                        <View className="flex-1">
                          <Button
                            label="공유하기"
                            size="lg"
                            disabled
                            onPress={() => {}}
                          />
                        </View>
                      </View>
                    </View>
                  </View>
                </View>

                {/* 집게는 카드 바깥으로 삐져나온다 — elevation 걸린 카드의 자식으로
                  두면 안드로이드에서 잘려서, 형제로 올려 그린다 */}
                {CLIP_OFFSETS.map((left) => (
                  <View
                    key={left}
                    pointerEvents="none"
                    style={{
                      position: 'absolute',
                      left: s(left),
                      top: -s(7),
                      width: s(8),
                      height: s(18),
                      borderRadius: s(4),
                      backgroundColor: CLIP_COLOR,
                    }}
                  />
                ))}
              </View>
            </View>

            {/* 투명성 한 줄(§6) — 공유가 붙기 전까지는 항상 🔒 */}
            <Typography
              variant="body-03"
              className="text-center"
              style={{ color: COLORS.text.body.subtle }}
            >
              🔒 나와 가족만 볼 수 있어요 · 공유는 준비 중이에요
            </Typography>

            {record.private_memo ? (
              <View
                className="self-center bg-surface"
                style={{
                  width: s(309),
                  padding: s(16),
                  rowGap: s(8),
                  borderRadius: s(16),
                  ...FLOATING_SHADOW,
                }}
              >
                <View
                  className="flex-row items-center"
                  style={{ columnGap: s(4) }}
                >
                  <LockIcon20 width={s(20)} height={s(20)} />
                  <Typography
                    variant="body-01"
                    weight="semibold"
                    style={{ color: COLORS.text.title.default }}
                  >
                    개인 메모
                  </Typography>
                </View>
                <Typography
                  variant="body-02-reading"
                  style={{ color: COLORS.text.body.strong }}
                >
                  {record.private_memo}
                </Typography>
              </View>
            ) : null}

            {record.is_mine ? (
              <View style={{ rowGap: s(8) }}>
                <View
                  className="flex-row items-center justify-center"
                  style={{ columnGap: s(12) }}
                >
                  {others.length > 0 ? (
                    <>
                      <TextAction
                        label={
                          moving
                            ? '옮길 아이 고르기 취소'
                            : '다른 아이로 옮기기'
                        }
                        onPress={() => setMoving((v) => !v)}
                      />
                      <Typography
                        variant="body-03"
                        style={{ color: COLORS.text.caption.subtle }}
                      >
                        ·
                      </Typography>
                    </>
                  ) : null}
                  <TextAction
                    label="지우기"
                    color={COLORS.status.danger}
                    onPress={confirmDelete}
                  />
                </View>

                {moving
                  ? others.map((p) => (
                      <View key={p.id} className="self-center">
                        <Button
                          label={p.display_name}
                          variant="white"
                          size="lg"
                          onPress={() =>
                            moveProfile.mutate(
                              { recordId: record.id, targetProfileId: p.id },
                              { onSuccess: () => setMoving(false) },
                            )
                          }
                        />
                      </View>
                    ))
                  : null}
              </View>
            ) : null}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

/** 북마크 토글 — on이면 teal 틴트 원 + teal 글리프(시안 299:2589) */
function BookmarkButton({
  bookmarked,
  onPress,
}: {
  bookmarked: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={bookmarked ? '저장 해제' : '저장'}
      accessibilityState={{ selected: bookmarked }}
      hitSlop={8}
      onPress={() => {
        // 저장할 때만 톡 튀게 — 해제는 조용히
        scale.value = bookmarked
          ? withTiming(1, { duration: 120 })
          : withSpring(1.18, { damping: 6, stiffness: 260 }, () => {
              scale.value = withSpring(1, { damping: 12, stiffness: 220 });
            });
        onPress();
      }}
    >
      <Animated.View
        style={[
          {
            width: s(28),
            height: s(28),
            borderRadius: s(14),
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: bookmarked
              ? COLORS.tag.teal.bg
              : COLORS.bg['emphasis-subtle'],
          },
          style,
        ]}
      >
        <BookmarkIcon20
          width={s(20)}
          height={s(20)}
          color={bookmarked ? COLORS.tag.teal.fg : COLORS.icon.tertiary}
        />
      </Animated.View>
    </Pressable>
  );
}

/** 카드 밖 조용한 액션 — 시안에 없는 표면이라 버튼 무게를 주지 않는다 */
function TextAction({
  label,
  color = COLORS.text.body.default,
  onPress,
}: {
  label: string;
  color?: string;
  onPress: () => void;
}) {
  const pressed = useSharedValue(0);
  const style = useAnimatedStyle(() => ({ opacity: 1 - pressed.value * 0.4 }));

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      hitSlop={8}
      onPressIn={() => {
        pressed.value = withTiming(1, { duration: 90 });
      }}
      onPressOut={() => {
        pressed.value = withTiming(0, { duration: 140 });
      }}
    >
      <Animated.View style={style}>
        <Typography variant="body-03" weight="medium" style={{ color }}>
          {label}
        </Typography>
      </Animated.View>
    </Pressable>
  );
}
