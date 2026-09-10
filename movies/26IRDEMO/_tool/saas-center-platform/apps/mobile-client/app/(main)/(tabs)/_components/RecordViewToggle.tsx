/**
 * 기록 탭 뷰 토글 — 시안 414:4094 (Tab/small).
 *
 * 컨테이너 p4·gap4·r8(배경 없음), 슬롯 28×28·r4. 선택 표시는 흰 슬롯 하나뿐이라
 * 슬롯마다 배경을 켜고 끄는 대신 **흰 알약 하나를 슬라이드**시킨다 — 어느 칸으로
 * 가는지가 눈에 남아 전환이 부드럽다.
 *
 * 아이콘 색(선택 icon/primary ↔ 비선택 icon/muted)은 SVG 색이라 style로 보간할 수
 * 없어 두 벌을 겹쳐 두고 opacity를 교차시킨다. 알약과 같은 progress를 쓰므로
 * 알약이 지나가는 칸의 아이콘이 따라서 진해진다.
 */
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';
import BarsIcon20 from '@assets/icons/20/BarsIcon20.svg';
import CalendarFillIcon20 from '@assets/icons/20/CalendarFillIcon20.svg';
import BookmarkIcon20 from '@assets/icons/20/BookmarkIcon20.svg';

/** 주간 = 고른 하루 / 월간 = 그 달 모아보기(시안 276:6934) / 저장 = 북마크 */
export type ViewMode = 'week' | 'month' | 'bookmark';

const VIEW_TABS: { mode: ViewMode; Icon: typeof BarsIcon20; label: string }[] =
  [
    { mode: 'week', Icon: BarsIcon20, label: '주간 보기' },
    { mode: 'month', Icon: CalendarFillIcon20, label: '월간 모아보기' },
    { mode: 'bookmark', Icon: BookmarkIcon20, label: '저장한 기록' },
  ];

const SLOT = 28;
const GAP = 4;
const PAD = 4;
const RADIUS = 4;
const ICON = 20;
/** 알약 이동 + 아이콘 교차 지속 시간 — 공용 Chip(150)보다 살짝 길게 잡아 이동이 읽히게 */
const DURATION = 180;

interface RecordViewToggleProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
}

export function RecordViewToggle({ value, onChange }: RecordViewToggleProps) {
  const index = VIEW_TABS.findIndex((tab) => tab.mode === value);
  const progress = useDerivedValue(
    () => withTiming(index, { duration: DURATION }),
    [index],
  );
  // worklet 안에서 s() 호출 금지 — 렌더 단계에서 숫자로 만들어 넘긴다
  const step = s(SLOT + GAP);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * step }],
  }));

  return (
    <View
      className="flex-row items-center rounded-lg"
      style={{ padding: s(PAD), columnGap: s(GAP) }}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            left: s(PAD),
            top: s(PAD),
            width: s(SLOT),
            height: s(SLOT),
            borderRadius: s(RADIUS),
            backgroundColor: COLORS.bg.surface,
          },
          pillStyle,
        ]}
      />
      {VIEW_TABS.map((tab, i) => (
        <ToggleSlot
          key={tab.mode}
          index={i}
          progress={progress}
          Icon={tab.Icon}
          label={tab.label}
          selected={tab.mode === value}
          onPress={() => onChange(tab.mode)}
        />
      ))}
    </View>
  );
}

interface ToggleSlotProps {
  index: number;
  progress: SharedValue<number>;
  Icon: typeof BarsIcon20;
  label: string;
  selected: boolean;
  onPress: () => void;
}

function ToggleSlot({
  index,
  progress,
  Icon,
  label,
  selected,
  onPress,
}: ToggleSlotProps) {
  /** 알약이 이 칸에 얹혀 있는 정도(0~1) — 이웃 칸으로 넘어가는 동안 선형으로 빠진다 */
  const activeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [index - 1, index, index + 1],
      [0, 1, 0],
      Extrapolation.CLAMP,
    ),
  }));
  const mutedStyle = useAnimatedStyle(() => ({
    opacity:
      1 -
      interpolate(
        progress.value,
        [index - 1, index, index + 1],
        [0, 1, 0],
        Extrapolation.CLAMP,
      ),
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{ width: s(SLOT), height: s(SLOT) }}
    >
      <Animated.View style={[StyleSheet.absoluteFill, CENTER, mutedStyle]}>
        <Icon width={ICON} height={ICON} color={COLORS.icon.muted} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, CENTER, activeStyle]}>
        <Icon width={ICON} height={ICON} color={COLORS.icon.primary} />
      </Animated.View>
    </Pressable>
  );
}

const CENTER = {
  alignItems: 'center',
  justifyContent: 'center',
} as const;
