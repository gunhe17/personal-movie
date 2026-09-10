/**
 * BadgeRoundState 컴포넌트 (출석 상태 드롭다운 트리거)
 *
 * 출석 상태(참석/불참/미확인) 표시 + 탭 시 picker UI(드롭다운, BottomSheet 등) 호출.
 * 컴포넌트 자체는 **display + onPress trigger**만 담당. 실제 옵션 UI는 부모가 결정.
 *
 * Variants (디자인 시스템 명세):
 * - attended    : bg #00C50714, text #00C507  (참석)
 * - absent      : bg #FF424214, text #FF4242  (불참)
 * - unconfirmed : bg gray-50,   text gray-600 (미확인)
 *
 * 디자인:
 * - 고정 사이즈 w-74 × h-30, rounded-full
 * - 우측 chevron (`isOpen` 으로 up/down 토글)
 * - 라벨/chevron 색상은 variant 텍스트 컬러와 일치
 * - 라벨 타이포: label-01 / medium
 *
 * @example
 *   // 1) 기본 — 부모가 BottomSheet 등으로 상태 변경
 *   const [status, setStatus] = useState<BadgeStateVariant>('attended');
 *   const LABEL = { attended: '참석', absent: '불참', unconfirmed: '미확인' };
 *   <BadgeRoundState
 *     variant={status}
 *     isOpen={sheetOpen}
 *     onPress={() => setSheetOpen(true)}
 *   >
 *     {LABEL[status]}
 *   </BadgeRoundState>
 *
 *   // 2) 읽기 전용 (chevron 숨김)
 *   <BadgeRoundState variant="unconfirmed" showChevron={false}>미확인</BadgeRoundState>
 *
 *   // 3) ref 측정이 필요한 경우 (드롭다운 위치 계산용)
 *   const ref = useRef<View>(null);
 *   <BadgeRoundState ref={ref} variant="attended" onPress={...}>참석</BadgeRoundState>
 */

import React, { forwardRef } from 'react';
import {
  Pressable,
  type PressableProps,
  type View,
} from 'react-native';
import { Typography } from './Typography';
import { Icon } from '@/shared/components/icons';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';

export type BadgeStateVariant = 'attended' | 'absent' | 'unconfirmed';

const VARIANT: Record<BadgeStateVariant, { bg: string; text: string }> = {
  attended: { bg: '#00C50714', text: '#00C507' },
  absent: { bg: '#FF424214', text: '#FF4242' },
  unconfirmed: { bg: COLORS.gray[50], text: COLORS.gray[600] },
};

export interface BadgeRoundStateProps
  extends Omit<PressableProps, 'children' | 'style'> {
  variant?: BadgeStateVariant;
  children: React.ReactNode;
  /** 드롭다운 open 상태 — true면 chevron-up, false면 chevron-down (기본 false) */
  isOpen?: boolean;
  /** chevron 노출 여부 (기본 true). false면 정적 표시 */
  showChevron?: boolean;
  className?: string;
}

export const BadgeRoundState = forwardRef<View, BadgeRoundStateProps>(
  function BadgeRoundState(
    {
      variant = 'unconfirmed',
      children,
      isOpen = false,
      showChevron = true,
      className = '',
      disabled,
      onPress,
      ...rest
    },
    ref,
  ) {
    const { bg, text } = VARIANT[variant];
    const opacityClass = disabled ? 'opacity-50' : '';
    const chevronName = isOpen ? 'arrow-up-16' : 'arrow-down-16';

    return (
      <Pressable
        ref={ref}
        disabled={disabled}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ disabled: !!disabled, expanded: isOpen }}
        style={{
          width: s(74),
          height: s(30),
          backgroundColor: bg,
          gap: 2,
        }}
        className={`flex-row items-center justify-center self-start rounded-full ${opacityClass} ${className}`.trim()}
        {...rest}
      >
        <Typography variant="label-01" weight="medium" style={{ color: text }}>
          {children}
        </Typography>
        {showChevron && <Icon name={chevronName} size={16} color={text} />}
      </Pressable>
    );
  },
);
