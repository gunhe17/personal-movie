/**
 * 센터 연결 완료 — 시안 1054:8359.
 *
 * 성공 표식은 체크를 획으로 그린다 — 원은 내보낸 벡터 그대로 쓰고, 체크만 선으로 따라 그린
 * 뒤 다 그려지면 원이 한 번 툭 커졌다 돌아온다.
 */
import React, { useEffect } from 'react';
import { Image, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLinkFlowStore } from '@/features/link';
import { Button, Typography } from '@/shared/components/ui';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';
import { formatBirthDate } from '@/shared/utils/format';
import CenterIcon20 from '@assets/icons/20/CenterIcon20.svg';
import CheckCircleIcon52 from '@assets/icons/52/CheckCircleIcon52.svg';
import CheckMarkIcon52 from '@assets/icons/52/CheckMarkIcon52.svg';

const MARK = 52;

/**
 * 체크가 그려지는 건 왼→오 가림막을 걷어서 낸다.
 * SVG stroke-dashoffset이 정석이지만 reanimated 4 + 새 아키텍처에서 SVG animatedProps가
 * 반영되지 않아(획이 처음부터 다 보임) 레이아웃 폭 애니메이션으로 바꿨다.
 * 체크 경로의 x는 단조 증가라(왼쪽 끝 → 꺾임 → 오른쪽 끝) 가로로 걷으면 그려지는 순서와 같다.
 *
 * 아래 두 값 = 내보낸 벡터에서 체크가 실제로 차지하는 x 구간(41.6 기준 11.99~32.02).
 */
const CHECK_X_START = 11.99 / 41.6002;
const CHECK_X_END = 32.02 / 41.6002;

/** 원 등장 → 체크가 그려짐 → 다 그려지면 원이 한 번 커졌다 돌아옴 */
const CIRCLE_IN_MS = 220;
const DRAW_DELAY_MS = 120;
const DRAW_MS = 420;
const POP_UP_MS = 130;
const POP_DOWN_MS = 220;
const POP_SCALE = 1.12;

const GENDER_LABEL: Record<string, string> = { male: '남자', female: '여자' };

/** 성공 표식 — 체크가 그려지고, 다 그려지면 원이 한 번 커진다 */
function SuccessMark() {
  const enter = useSharedValue(0);
  const draw = useSharedValue(0);
  const pop = useSharedValue(1);

  // worklet 안에서 s() 호출 금지 — 렌더 단계에서 숫자로 미리 계산한다
  const size = s(MARK);

  useEffect(() => {
    enter.value = withTiming(1, { duration: CIRCLE_IN_MS });
    draw.value = withDelay(
      DRAW_DELAY_MS,
      withTiming(
        1,
        { duration: DRAW_MS, easing: Easing.out(Easing.cubic) },
        (finished) => {
          if (!finished) return;
          pop.value = withSequence(
            withTiming(POP_SCALE, { duration: POP_UP_MS }),
            withTiming(1, {
              duration: POP_DOWN_MS,
              easing: Easing.out(Easing.back(2)),
            }),
          );
        },
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 원과 체크가 함께 커져야 '원이 커진다'로 읽힌다 — 표식 전체에 건다
  const markStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ scale: (0.85 + enter.value * 0.15) * pop.value }],
  }));

  // 가림막 폭 — 체크가 시작되는 x부터 끝나는 x까지만 걷는다(앞뒤 빈 구간을 기다리지 않게)
  const revealStyle = useAnimatedStyle(() => ({
    width: size * (CHECK_X_START + draw.value * (CHECK_X_END - CHECK_X_START)),
  }));

  return (
    <Animated.View style={[{ width: size, height: size }, markStyle]}>
      <CheckCircleIcon52 width={size} height={size} />
      <Animated.View
        style={[
          { position: 'absolute', top: 0, left: 0, height: size, overflow: 'hidden' },
          revealStyle,
        ]}
      >
        <CheckMarkIcon52 width={size} height={size} />
      </Animated.View>
    </Animated.View>
  );
}

export default function LinkDoneScreen() {
  const router = useRouter();
  const { verifyResult, claimedLinks } = useLinkFlowStore();
  const reset = useLinkFlowStore((state) => state.reset);

  // 방금 확인한 값 그대로 — me 재조회를 기다리지 않는다
  const childByClientId = new Map(
    (verifyResult?.children ?? []).map((child) => [child.client_id, child]),
  );
  const centerImage = verifyResult?.center.image_url ?? null;

  const goHome = () => {
    reset();
    router.replace('/(main)/(tabs)');
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <View className="h-[52px] flex-row items-center justify-end px-4">
        {/* 연결은 이미 끝났다 — 되돌아갈 단계가 없어 나가기 하나만 둔다(시안의 뒤로가기 생략) */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="닫기"
          onPress={goHome}
          hitSlop={8}
        >
          <Ionicons name="close" size={24} color={COLORS.gray[900]} />
        </Pressable>
      </View>

      <View
        className="flex-1 items-center px-4"
        style={{ paddingTop: s(64), rowGap: s(20) }}
      >
        <SuccessMark />

        <View className="w-full" style={{ rowGap: s(24) }}>
          <Typography
            variant="headline-01"
            weight="semibold"
            className="text-center"
            style={{ color: COLORS.text.title.default }}
          >
            센터 연결을 완료했어요!
          </Typography>

          <View style={{ rowGap: s(12) }}>
            {claimedLinks.map((link) => {
              const child = childByClientId.get(link.client_id);
              const birth = formatBirthDate(child?.birth_date ?? null);
              const gender = child?.gender
                ? (GENDER_LABEL[child.gender] ?? child.gender)
                : null;
              const image = centerImage ?? link.center_logo_url;

              return (
                <View
                  key={link.id}
                  className="flex-row items-center bg-surface"
                  style={{
                    padding: s(16),
                    columnGap: s(12),
                    borderRadius: s(12),
                    borderWidth: 1,
                    borderColor: COLORS.border.subtle,
                  }}
                >
                  <View
                    className="items-center justify-center overflow-hidden"
                    style={{
                      width: s(40),
                      height: s(40),
                      borderRadius: s(20),
                      backgroundColor: COLORS.bg['surface-sunken'],
                    }}
                  >
                    {image ? (
                      <Image
                        source={{ uri: image }}
                        style={{ width: s(40), height: s(40) }}
                        resizeMode="cover"
                      />
                    ) : (
                      <CenterIcon20 width={s(20)} height={s(20)} />
                    )}
                  </View>

                  <View className="flex-1" style={{ rowGap: s(8) }}>
                    <Typography
                      variant="body-02"
                      weight="medium"
                      numberOfLines={1}
                      style={{ color: COLORS.text.title.subtle }}
                    >
                      {link.center_name}
                    </Typography>
                    <View
                      className="flex-row items-center"
                      style={{ columnGap: s(8) }}
                    >
                      <Typography
                        variant="body-01"
                        weight="semibold"
                        numberOfLines={1}
                        style={{ color: COLORS.text.title.default }}
                      >
                        {child?.name ?? ''}
                      </Typography>
                      {birth ? (
                        <Typography
                          variant="body-01"
                          style={{ color: COLORS.text.body.default }}
                        >
                          {birth}
                        </Typography>
                      ) : null}
                      {birth && gender ? (
                        <View
                          style={{
                            width: 1,
                            height: s(10),
                            backgroundColor: COLORS.border.default,
                          }}
                        />
                      ) : null}
                      {gender ? (
                        <Typography
                          variant="body-01"
                          style={{ color: COLORS.text.body.default }}
                        >
                          {gender}
                        </Typography>
                      ) : null}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </View>

      <View
        className="bg-background"
        style={{ paddingHorizontal: s(16), paddingTop: s(16), paddingBottom: s(16) }}
      >
        <Button label="확인" onPress={goHome} />
      </View>
    </SafeAreaView>
  );
}
