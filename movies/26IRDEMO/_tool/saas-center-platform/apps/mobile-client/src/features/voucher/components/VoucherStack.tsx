/**
 * 보유 바우처 카드 스택 — 시안 480:4951(바우처 홈).
 *
 * 카드가 지갑처럼 겹쳐 쌓이고, 맨 앞(제일 아래) 한 장만 펼쳐져 잔여 회기·진행바를 보여준다.
 * 위/아래로 끌면 다음·이전 카드가 앞으로 오고, 뒤에 겹친 카드를 터치하면 그 카드가
 * 앞으로 튀어나오며 펼쳐진다.
 *
 * RNGH 미설치(네이티브 재빌드 회피) — 제스처는 PanResponder, 모션은 reanimated.
 * 부모 ScrollView와의 경쟁은 capture 단계에서 세로 드래그만 가로챈다.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, PanResponder, Pressable, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { ProgressBar, Typography } from '@/shared/components/ui';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';
import type { ClientVoucher } from '../types';
import VoucherIcon20 from '@assets/icons/20/VoucherIcon20.svg';

/** 뒤에 겹친 카드가 드러나는 높이 (시안 68/375) */
const PEEK = s(68);
const COLLAPSED_H = s(139);
const EXPANDED_H = s(193);
const FOOTER_H = s(64);
/** 하단 바가 카드보다 조금 더 내려와 끝난다 (시안 333 - 329) */
const FOOTER_OVERHANG = s(4);
/** 이만큼 끌면 다음/이전 카드로 넘어간다 */
const SWIPE_THRESHOLD = s(28);
const POP_SCALE = 1.03;
const SPRING = { damping: 18, stiffness: 190, mass: 0.9 } as const;

/** 카드 틴트 — 콘텐츠성 파스텔(시안 고정값, 토큰 아님). 발급 순서로 순환 */
const CARD_TINTS = ['#DDF4BB', '#C7F0F9', '#E7E3FF', '#FFE7CF'] as const;

/** 하단 바 그라디언트 중간톤 — 대응 프리미티브 없는 시안 고유값(양끝은 bg/emphasis) */
const BAR_HIGHLIGHT = '#424851';

/** 시안 1015:9884 Subtract — r8 사각형 상단 중앙에 반원 노치 */
const BAR_PATH =
  'M335 0C339.418 0 343 3.58172 343 8V56C343 60.4183 339.418 64 335 64H8C3.58172 64 ' +
  '2.49657e-07 60.4183 0 56V8C0 3.58172 3.58172 1.58044e-07 8 0H148.944C150.572 0 ' +
  '152.108 0.687431 153.348 1.74152C158.204 5.86897 164.757 8.40039 171.968 8.40039C179.178 ' +
  '8.40028 185.731 5.86888 190.587 1.74153C191.827 0.687427 193.363 0 194.99 0H335Z';

/** 만료 임박 기준 — 이 안쪽이면 D-day를 위험색으로 강조하고 툴팁을 띄운다 */
const EXPIRY_SOON_DAYS = 7;

function daysLeft(validUntil: string | null): number | null {
  if (!validUntil) return null;
  const parsed = parseISO(validUntil);
  if (Number.isNaN(parsed.getTime())) return null;
  return differenceInCalendarDays(parsed, new Date());
}

function ddayLabel(days: number): string {
  if (days < 0) return '만료';
  if (days === 0) return 'D-day';
  return `D-${days}`;
}

interface StackCardProps {
  voucher: ClientVoucher;
  tint: string;
  /** 위에서부터의 자리(0=맨 뒤) — 앞으로 올수록 커진다 */
  slot: number;
  zIndex: number;
  isActive: boolean;
  drag: SharedValue<number>;
  onPress: () => void;
}

function StackCard({
  voucher,
  tint,
  slot,
  zIndex,
  isActive,
  drag,
  onPress,
}: StackCardProps) {
  const y = useSharedValue(slot * PEEK);
  const height = useSharedValue(isActive ? EXPANDED_H : COLLAPSED_H);
  const detail = useSharedValue(isActive ? 1 : 0);
  const pop = useSharedValue(1);
  const mounted = useRef(false);

  useEffect(() => {
    y.value = withSpring(slot * PEEK, SPRING);
    height.value = withTiming(isActive ? EXPANDED_H : COLLAPSED_H, { duration: 240 });
    detail.value = withTiming(isActive ? 1 : 0, { duration: isActive ? 260 : 120 });
    // 터치·스와이프로 막 앞에 온 카드만 튀어나오는 느낌 (최초 렌더는 제외)
    if (isActive && mounted.current) {
      pop.value = withSequence(
        withTiming(POP_SCALE, { duration: 130 }),
        withSpring(1, SPRING),
      );
    }
    mounted.current = true;
  }, [slot, isActive, y, height, detail, pop]);

  const cardStyle = useAnimatedStyle(() => ({
    height: height.value,
    transform: [{ translateY: y.value + drag.value }, { scale: pop.value }],
  }));
  const detailStyle = useAnimatedStyle(() => ({ opacity: detail.value }));

  const days = daysLeft(voucher.valid_until);
  const isUrgent = days !== null && days <= EXPIRY_SOON_DAYS;
  const used = Math.max(0, voucher.total_sessions - voucher.remaining_sessions);
  const usedRatio = voucher.total_sessions > 0 ? used / voucher.total_sessions : 0;

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          zIndex,
          borderRadius: s(16),
          backgroundColor: isActive ? COLORS.bg.surface : tint,
          borderWidth: isActive ? 1 : 0,
          borderColor: COLORS.border.default,
          // 위쪽으로 퍼지는 그림자 — 카드가 앞장을 덮고 있다는 신호(시안 480:4887).
          // 클리핑(overflow)은 안쪽 View가 진다 — 같은 뷰에 주면 iOS에서 그림자가 잘린다
          shadowColor: '#000B14',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: isActive ? 0.12 : 0.08,
          shadowRadius: isActive ? 12 : 6,
          elevation: isActive ? 6 : 3,
        },
        cardStyle,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${voucher.name ?? '바우처'} 자세히 보기`}
        // 펼쳐진 카드도 responder를 잡아야 한다 — disabled면 터치가 뒤 카드로 샌다
        onPress={onPress}
        style={{ flex: 1, borderRadius: s(16), overflow: 'hidden', padding: s(16) }}
      >
        <View className="flex-row items-start justify-between">
          <View className="flex-1 pr-2">
            <Typography variant="label-01" style={{ color: COLORS.text.body.subtle }}>
              {voucher.program_organization ?? voucher.center_name ?? '지원 제도'}
            </Typography>
            <View className="mt-1 flex-row items-center" style={{ columnGap: 8 }}>
              <Typography
                variant="body-01"
                weight="semibold"
                numberOfLines={1}
                style={{ color: COLORS.text.title.default, flexShrink: 1 }}
              >
                {voucher.name ?? '바우처'}
              </Typography>
              {days !== null ? (
                <Typography
                  variant="body-03"
                  style={{
                    color: isUrgent ? COLORS.status.danger : COLORS.text.state.brand,
                  }}
                >
                  {ddayLabel(days)}
                </Typography>
              ) : null}
            </View>
          </View>
          <Typography
            variant="body-02"
            weight="medium"
            style={{ color: COLORS.text.body.strong }}
          >
            {voucher.remaining_sessions}/{voucher.total_sessions}회
          </Typography>
        </View>

        <Animated.View style={[{ marginTop: s(12) }, detailStyle]} pointerEvents="none">
          <View className="flex-row items-center" style={{ columnGap: 4 }}>
            <Typography
              variant="headline-01"
              weight="semibold"
              style={{ color: COLORS.text.state.brand }}
            >
              {voucher.remaining_sessions}
            </Typography>
            <Typography
              variant="body-02"
              weight="medium"
              style={{ color: COLORS.text.body.default }}
            >
              회 남았어요
            </Typography>
          </View>
          <ProgressBar ratio={usedRatio} className="mt-2" />
          <Image
            source={require('@assets/images/voucher/voucher-dog.png')}
            style={{
              position: 'absolute',
              right: 0,
              top: -s(20),
              width: s(78),
              height: s(64),
            }}
            resizeMode="contain"
          />
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

interface VoucherStackProps {
  vouchers: ClientVoucher[];
}

export function VoucherStack({ vouchers }: VoucherStackProps) {
  const count = vouchers.length;
  const [activeIndex, setActiveIndex] = useState(0);
  const [tooltipClosed, setTooltipClosed] = useState(false);
  const drag = useSharedValue(0);

  useEffect(() => {
    if (activeIndex >= count) setActiveIndex(0);
  }, [count, activeIndex]);

  const step = useCallback(
    (delta: number) => {
      setActiveIndex((current) => (current + delta + count) % count);
    },
    [count],
  );

  const pan = useMemo(
    () =>
      PanResponder.create({
        // 부모 ScrollView보다 먼저 잡아야 스택 위 세로 드래그가 스크롤로 새지 않는다
        onMoveShouldSetPanResponderCapture: (_, gesture) =>
          count > 1 &&
          Math.abs(gesture.dy) > 10 &&
          Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.5,
        onPanResponderMove: (_, gesture) => {
          drag.value = Math.max(-PEEK, Math.min(PEEK, gesture.dy));
        },
        onPanResponderRelease: (_, gesture) => {
          const dy = Math.max(-PEEK, Math.min(PEEK, gesture.dy));
          if (dy <= -SWIPE_THRESHOLD) step(1);
          else if (dy >= SWIPE_THRESHOLD) step(-1);
          // 카드 자리(y)도 스프링이라 drag를 0으로 풀어도 튀지 않는다
          drag.value = withSpring(0, SPRING);
        },
        onPanResponderTerminate: () => {
          drag.value = withSpring(0, SPRING);
        },
      }),
    [count, step, drag],
  );

  if (count === 0) return null;

  const safeIndex = Math.min(activeIndex, count - 1);
  const activeDays = daysLeft(vouchers[safeIndex].valid_until);
  const showTooltip =
    !tooltipClosed && activeDays !== null && activeDays >= 0 && activeDays <= EXPIRY_SOON_DAYS;

  return (
    <View
      style={{ height: (count - 1) * PEEK + EXPANDED_H + FOOTER_OVERHANG }}
      {...pan.panHandlers}
    >
      {vouchers.map((voucher, index) => {
        // 앞(rank 0)이 펼쳐진 카드 — 뒤로 갈수록 위쪽 자리로 밀린다
        const rank = (index - safeIndex + count) % count;
        return (
          <StackCard
            key={voucher.id}
            voucher={voucher}
            tint={CARD_TINTS[index % CARD_TINTS.length]}
            slot={count - 1 - rank}
            zIndex={count - rank}
            isActive={rank === 0}
            drag={drag}
            onPress={() => setActiveIndex(index)}
          />
        );
      })}

      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: FOOTER_H,
          zIndex: count + 1,
        }}
        pointerEvents="none"
      >
        <Svg width="100%" height="100%" viewBox="0 0 343 64" preserveAspectRatio="none">
          <Defs>
            <LinearGradient
              id="voucherStackBar"
              x1="4"
              y1="6"
              x2="367.5"
              y2="64"
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0" stopColor={COLORS.bg.emphasis} />
              <Stop offset="0.711538" stopColor={BAR_HIGHLIGHT} />
              <Stop offset="1" stopColor={COLORS.bg.emphasis} />
            </LinearGradient>
          </Defs>
          <Path d={BAR_PATH} fill="url(#voucherStackBar)" />
        </Svg>
        <View
          className="absolute flex-row items-center"
          style={{ left: s(16), top: s(24), columnGap: 8 }}
        >
          <VoucherIcon20 width={20} height={20} />
          <Typography variant="body-02" weight="medium" style={{ color: COLORS.white }}>
            총 {count}개의 바우처가 있어요
          </Typography>
        </View>
      </View>

      {showTooltip ? (
        <View
          style={{
            position: 'absolute',
            right: s(8),
            top: Math.max(0, (count - 1) * PEEK - s(38)),
            zIndex: count + 2,
          }}
        >
          <View
            className="flex-row items-center rounded-lg"
            style={{
              backgroundColor: 'rgba(45,51,59,0.9)', // bg/emphasis @ 90% — 카드 위에 뜨는 툴팁(시안 37:704)
              paddingHorizontal: s(8),
              paddingVertical: s(6),
              columnGap: 4,
            }}
          >
            <Typography
              variant="label-01"
              weight="medium"
              style={{ color: COLORS.text.state.inverse }}
            >
              바우처 만료가 얼마 안남았어요!
            </Typography>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="안내 닫기"
              onPress={() => setTooltipClosed(true)}
              hitSlop={8}
            >
              <Ionicons name="close" size={14} color={COLORS.white} />
            </Pressable>
          </View>
          {/* 아래를 가리키는 꼬리 — 펼쳐진 카드를 지목한다 */}
          <View
            style={{
              alignSelf: 'flex-end',
              marginRight: s(16),
              width: 0,
              height: 0,
              borderLeftWidth: 5,
              borderRightWidth: 5,
              borderTopWidth: 6,
              borderLeftColor: 'transparent',
              borderRightColor: 'transparent',
              borderTopColor: 'rgba(45,51,59,0.9)',
            }}
          />
        </View>
      ) : null}
    </View>
  );
}
