/**
 * 하단 토스트 — 피그마 447:4589.
 *
 * 다크 카드 + 파란 체크 + 본문 2줄(제목·보조). 화면이 넘어가지 않는 액션의 결과를
 * 확실히 인지시키는 용도라 자동으로 사라진다.
 */
import React, { useEffect } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import RAnimated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Typography } from './Typography';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';

interface ToastProps {
  visible: boolean;
  message: string;
  /** 보조 문구 — 결과 이후 무엇을 기대하면 되는지 */
  description?: string;
  onHide: () => void;
  duration?: number;
  /** 하단에서 띄울 추가 여백 — 화면에 고정 액션 바가 있으면 그 높이만큼 준다 */
  bottomOffset?: number;
}

export function Toast({
  visible,
  message,
  description,
  onHide,
  duration = 3000,
  bottomOffset = 0,
}: ToastProps) {
  // 절대 위치라 SafeAreaView의 하단 패딩이 안 먹는다 — inset을 직접 더한다
  const insets = useSafeAreaInsets();
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(onHide, duration);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, duration]);

  if (!visible) return null;

  return (
    <RAnimated.View
      entering={FadeInDown.duration(220)}
      exiting={FadeOutDown.duration(180)}
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: s(16),
        right: s(16),
        bottom: insets.bottom + s(16) + bottomOffset,
        flexDirection: 'row',
        alignItems: 'center',
        columnGap: s(12),
        paddingHorizontal: s(16),
        paddingVertical: s(16),
        borderRadius: s(16),
        backgroundColor: COLORS.gray[900],
      }}
    >
      <Ionicons
        name="checkmark-circle"
        size={s(24)}
        color={COLORS.action.primary}
      />
      <View className="flex-1" style={{ rowGap: s(2) }}>
        <Typography
          variant="body-02"
          weight="semibold"
          style={{ color: COLORS.text.state.inverse }}
        >
          {message}
        </Typography>
        {description ? (
          <Typography variant="body-03" style={{ color: COLORS.gray[400] }}>
            {description}
          </Typography>
        ) : null}
      </View>
    </RAnimated.View>
  );
}
