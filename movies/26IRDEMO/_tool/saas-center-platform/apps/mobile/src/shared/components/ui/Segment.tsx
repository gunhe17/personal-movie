/**
 * Segment 컴포넌트 (모바일 전용 — 필터/탭 칩)
 *
 * pill-shape 필터 칩 그룹. 컨트롤드 컴포넌트(value + onChange) 패턴.
 *
 * 디자인 스펙:
 * - 높이 36, 좌우 패딩 14px, 완전 라운드(rounded-full)
 * - active   : bg/emphasis (gray-800), 라벨/카운트 모두 text-white
 * - inactive : border border-gray-300, 라벨 text-gray-700, 카운트 text-gray-500
 * - 기본 타이포: 라벨 = body-02-reading / regular, 카운트 = label-01 / regular
 *
 * @example
 *   const [filter, setFilter] = useState('all');
 *   <Segment
 *     value={filter}
 *     onChange={setFilter}
 *     options={[
 *       { value: 'all',    label: '전체',   count: 3 },
 *       { value: 'active', label: '진행중', count: 5 },
 *       { value: 'done',   label: '완료' },   // count는 선택
 *     ]}
 *   />
 *
 *   // 많은 옵션을 가로 스크롤로 노출하려면 부모에서 ScrollView로 감싸기
 *   <ScrollView horizontal showsHorizontalScrollIndicator={false}>
 *     <Segment ... />
 *   </ScrollView>
 */

import { Pressable, View, type ViewProps } from 'react-native';
import {
  Typography,
  type TypographyVariant,
  type TypographyWeight,
} from './Typography';
import { COLORS } from '@/shared/constants/theme';

export interface SegmentOption<T extends string = string> {
  value: T;
  label: string;
  /** 옵션 우측에 표시할 카운트(숫자). 미지정 시 라벨만 노출 */
  count?: number;
  disabled?: boolean;
}

export interface SegmentProps<T extends string = string>
  extends Omit<ViewProps, 'children'> {
  value: T;
  options: SegmentOption<T>[];
  onChange: (value: T) => void;
  /** 아이템 사이 간격 (px, 기본 8) */
  gap?: number;
  /** 라벨 타이포 variant override (기본 body-02-reading) */
  variant?: TypographyVariant;
  /** 라벨 타이포 weight override (기본 regular) */
  weight?: TypographyWeight;
  /** 카운트 타이포 variant override (기본 label-01) */
  countVariant?: TypographyVariant;
  /** 카운트 타이포 weight override (기본 regular) */
  countWeight?: TypographyWeight;
  /** 다크 변형 — 어두운 배경(필드노트 도메인 등) 위에서 사용. 기본 라이트. */
  dark?: boolean;
  /** 활성 칩 배경색 override (기본: 라이트 gray-800 / 다크 #9B5DFF). 도메인 액센트 맞춤용. */
  activeColor?: string;
}

export function Segment<T extends string = string>({
  value,
  options,
  onChange,
  gap = 8,
  variant = 'body-02-reading',
  weight = 'regular',
  countVariant = 'label-01',
  countWeight = 'regular',
  dark = false,
  activeColor,
  className = '',
  style,
  ...rest
}: SegmentProps<T>) {
  return (
    <View
      className={`flex-row ${className}`.trim()}
      style={[{ gap }, style]}
      {...rest}
    >
      {options.map((opt) => {
        const isActive = opt.value === value;
        const isDisabled = !!opt.disabled;

        // 활성 배경: activeColor override(인라인 style) 우선, 없으면 기본 className.
        const useActiveColor = isActive && !!activeColor;
        const containerClass = isActive
          ? useActiveColor
            ? ''
            : dark
              ? 'bg-[#9B5DFF]'
              : 'bg-emphasis'
          : dark
            ? 'border border-[#FFFFFF2E]'
            : 'border border-gray-300';
        // 색은 className(text-*) 대신 inline style 로 전달한다.
        // Typography 가 기본 'text-text' className 을 강제 주입해, 같은 color 속성의
        // arbitrary className(text-[#...])이 충돌에서 밀려 비활성 칩이 안 보였다(다크).
        // inline style 은 style 배열 맨 뒤에 적용돼 항상 이긴다.
        const labelColor = isActive
          ? COLORS.white
          : dark
            ? '#A39DBF'
            : COLORS.gray[700];
        const countColor = isActive
          ? COLORS.white
          : dark
            ? '#6B6485'
            : COLORS.gray[500];
        const opacityClass = isDisabled ? 'opacity-50' : '';

        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            disabled={isDisabled}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive, disabled: isDisabled }}
            className={`h-[36px] flex-row items-center rounded-full px-[14px] ${containerClass} ${opacityClass}`.trim()}
            style={useActiveColor ? { backgroundColor: activeColor } : undefined}
          >
            <Typography
              variant={variant}
              weight={weight}
              style={{ color: labelColor }}
            >
              {opt.label}
            </Typography>
            {opt.count !== undefined && (
              <Typography
                variant={countVariant}
                weight={countWeight}
                className="ml-1"
                style={{ color: countColor }}
              >
                {opt.count}
              </Typography>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
