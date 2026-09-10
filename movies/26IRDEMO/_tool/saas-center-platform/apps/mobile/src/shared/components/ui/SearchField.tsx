import {
  View,
  TextInput,
  TouchableOpacity,
  type TextInputProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/shared/constants/theme';
import { getTypographyStyle } from './Typography';
import { s } from '@/shared/utils/scale';

export interface SearchFieldProps
  extends Pick<
    TextInputProps,
    | 'value'
    | 'placeholder'
    | 'autoCapitalize'
    | 'autoCorrect'
    | 'returnKeyType'
    | 'onSubmitEditing'
    | 'blurOnSubmit'
  > {
  onChangeText: (text: string) => void;
  /** 우측 X 버튼 동작. 생략 시 onChangeText('') */
  onClear?: () => void;
  /** 컨테이너 고정 높이 (기본 48) */
  height?: number;
  backgroundColor?: string;
  textColor?: string;
  placeholderColor?: string;
  iconColor?: string;
  /** 보더 등 컨테이너 추가 스타일 */
  containerStyle?: StyleProp<ViewStyle>;
}

/**
 * 서비스 공용 검색 입력 필드.
 *
 * 세로 정렬 원칙(모든 서치필드 공통):
 * - 컨테이너 높이 **고정** + 내부 텍스트 박스도 **26으로 고정**한다.
 *   → placeholder ↔ 입력 텍스트 사이에 측정 높이가 달라지지 않아, 타이핑 시
 *     컨테이너 높이가 점프하거나 텍스트가 아래로 쏠리는 현상이 없다.
 * - 26 박스를 컨테이너(alignItems:center)가 세로 중앙에 배치한다(stretch 금지 —
 *   입력을 컨테이너 높이만큼 늘리면 폰트 메트릭 때문에 아래로 쏠려 보임).
 */
export function SearchField({
  value,
  onChangeText,
  onClear,
  placeholder,
  height = 48,
  backgroundColor = '#F5F7F8',
  textColor = COLORS.text.body.strong,
  placeholderColor = COLORS.gray[400],
  iconColor = COLORS.gray[400],
  containerStyle,
  autoCapitalize = 'none',
  autoCorrect = false,
  returnKeyType = 'search',
  ...inputProps
}: SearchFieldProps) {
  const hasValue = typeof value === 'string' && value.length > 0;
  const handleClear = onClear ?? (() => onChangeText(''));

  return (
    <View
      style={[
        {
          height: s(height),
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: s(16),
          gap: s(8),
          borderRadius: s(12),
          backgroundColor,
        },
        containerStyle,
      ]}
    >
      <TextInput
        style={[
          getTypographyStyle('body-01-reading', 'regular'),
          {
            flex: 1,
            // 텍스트 박스 높이 고정(26): 내용에 따라 높이 변화 없음 → 점프 제거.
            // lineHeight 는 설정하지 않음 — iOS 에서 lineHeight>fontSize 시 여분이 위에 붙어
            // 텍스트가 아래로 쏠려 보이므로, height + 중앙정렬로만 맞춘다.
            height: s(26),
            // getTypographyStyle 가 넣는 lineHeight(26) 를 제거 (위 사유)
            lineHeight: undefined,
            color: textColor,
            padding: 0,
            margin: 0,
            // Android: 폰트 상하 여백 제거 + 중앙 정렬 (iOS는 단일라인 네이티브 중앙)
            includeFontPadding: false,
            textAlignVertical: 'center',
          },
        ]}
        placeholder={placeholder}
        placeholderTextColor={placeholderColor}
        value={value}
        onChangeText={onChangeText}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        returnKeyType={returnKeyType}
        underlineColorAndroid="transparent"
        {...inputProps}
      />
      {hasValue ? (
        <TouchableOpacity
          onPress={handleClear}
          hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
          accessibilityLabel="검색어 지우기"
          accessibilityRole="button"
        >
          <Ionicons name="close-circle" size={s(18)} color={iconColor} />
        </TouchableOpacity>
      ) : (
        <Ionicons name="search-outline" size={s(18)} color={iconColor} />
      )}
    </View>
  );
}
