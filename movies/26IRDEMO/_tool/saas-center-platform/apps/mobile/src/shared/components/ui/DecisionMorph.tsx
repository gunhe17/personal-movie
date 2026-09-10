import { useRef } from 'react';
import { View, TouchableOpacity } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '@/shared/constants/theme';
import { Typography } from './Typography';
import { Icon } from '@/shared/components/icons';
import { s } from '@/shared/utils/scale';

/**
 * 진행 결정 morph — 선택(버튼들) ↔ 결과("…했어요" + 되돌리기)를 하나의 항상 마운트되는
 * 컴포넌트로 합친다. 선택한 버튼만 남기고 나머지는 사라지며, 남은 버튼의 <Icon> 인스턴스가
 * 유지된 채 폭·위치만 layout 전환으로 좌측 이동(glide)하고 결과 텍스트가 뒤이어 페이드인.
 * 되돌리기 땐 결과([아이콘+텍스트])가 한 묶음으로 fade out, 선택 버튼([아이콘+라벨])이
 * 한 묶음으로 fade in (gen key 로 persist 차단).
 *
 * 회기 상세(완료/취소/노쇼)·검사 항목(완료/중단)에서 공용으로 사용한다.
 * (Reanimated 4/new-arch 는 sharedTransitionTag 미지원 → 아이콘 유지 방식으로 근사)
 */

const MORPH_LAYOUT = LinearTransition.duration(260);

export type DecisionMorphOption = {
  /** 옵션 식별 key */
  key: string;
  /** 선택 버튼 라벨 (예: 완료/취소/노쇼/중단) */
  label: string;
  /** 결과 행 텍스트 (예: "완료된 회기예요") */
  resultLabel: string;
  /** 버튼·결과 공통 아이콘 (둘이 같아야 glide 가 자연스럽다) */
  iconName: React.ComponentProps<typeof Icon>['name'];
};

export function DecisionMorph({
  isSelect,
  options,
  resultKey,
  title = '일정이 진행되었나요?',
  moveDurations,
  revertLabel = '되돌리기',
  selectDisabled = false,
  revertDisabled = false,
  onSelect,
  onRevert,
}: {
  /** true = 선택 버튼들 노출, false = 결과 행 노출 */
  isSelect: boolean;
  options: DecisionMorphOption[];
  /** !isSelect 일 때 결과로 보여줄 옵션 key */
  resultKey: string;
  /** 선택 모드 상단 안내 문구 */
  title?: string;
  /** 옵션별 아이콘 이동 시간(ms). 미지정 시 거리 추정 기본값 */
  moveDurations?: number[];
  revertLabel?: string;
  selectDisabled?: boolean;
  revertDisabled?: boolean;
  onSelect: (key: string) => void;
  onRevert: () => void;
}) {
  // 되돌리기(결과→선택)로 선택 모드에 진입할 때마다 슬롯 key 를 새로 부여 → 아이콘이
  // persist/glide 하지 않고 [아이콘+버튼]이 그룹 단위로 fade in 된다. 펼침(선택→결과)은
  // 같은 gen 을 공유해 선택 버튼↔결과 행이 persist 되어 아이콘 glide 가 유지된다.
  const genRef = useRef(0);
  const prevSelectRef = useRef(isSelect);
  if (isSelect && !prevSelectRef.current) genRef.current += 1;
  prevSelectRef.current = isSelect;
  const gen = genRef.current;

  const durations = moveDurations ?? [220, 440, 500];
  const shown = isSelect
    ? options
    : options.filter((o) => o.key === resultKey);

  return (
    <Animated.View layout={MORPH_LAYOUT} style={{ gap: s(14), marginTop: s(4) }}>
      {/* 선택 모드에서만 보이는 타이틀 (양옆 페이드 구분선) */}
      {isSelect && (
        <Animated.View
          key="decision-title"
          entering={FadeIn.duration(180)}
          className="flex-row items-center"
          style={{ gap: s(12) }}
        >
          <LinearGradient
            colors={['rgba(218,223,229,1)', 'rgba(218,223,229,0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ flex: 1, height: 1 }}
          />
          <Typography variant="body-03" weight="medium" style={{ color: COLORS.gray[600] }}>
            {title}
          </Typography>
          <LinearGradient
            colors={['rgba(218,223,229,0)', 'rgba(218,223,229,1)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ flex: 1, height: 1 }}
          />
        </Animated.View>
      )}

      <View style={{ flexDirection: 'row', gap: s(8), alignItems: 'center' }}>
        {shown.map((opt) => (
          <DecisionMorphSlot
            // gen 포함 — 되돌리기 시 새 key 로 remount(그룹 fade), 펼침은 같은 gen 으로 persist(glide)
            key={`${opt.key}-${gen}`}
            moveDuration={durations[options.findIndex((o) => o.key === opt.key)] ?? 440}
            iconName={opt.iconName}
            label={opt.label}
            resultLabel={opt.resultLabel}
            revertLabel={revertLabel}
            isResult={!isSelect}
            disabled={selectDisabled}
            revertDisabled={revertDisabled}
            onPress={() => onSelect(opt.key)}
            onRevert={onRevert}
          />
        ))}
      </View>
    </Animated.View>
  );
}

function DecisionMorphSlot({
  moveDuration,
  iconName,
  label,
  resultLabel,
  revertLabel,
  isResult,
  disabled,
  revertDisabled,
  onPress,
  onRevert,
}: {
  moveDuration: number;
  iconName: React.ComponentProps<typeof Icon>['name'];
  label: string;
  resultLabel: string;
  revertLabel: string;
  isResult: boolean;
  disabled: boolean;
  revertDisabled: boolean;
  onPress: () => void;
  onRevert: () => void;
}) {
  // 펼침(forward)은 거리별 속도로 glide. 되돌리기(revert)는 빠르게(160) — 배경·라벨 페이드와
  // 같은 타이밍에 끝나 [아이콘+버튼]이 한 묶음으로 들어오게.
  const moveLayout = LinearTransition.duration(isResult ? moveDuration : 160);
  // 텍스트는 아이콘 이동이 끝나갈 무렵 살짝 겹쳐 페이드인 (이동 시간의 약 70% 지점부터)
  const tailDelay = Math.round(moveDuration * 0.7);

  return (
    <Animated.View
      layout={isResult ? moveLayout : undefined}
      // 슬롯 통째로 그룹 crossfade — 되돌리기 시 결과 슬롯([아이콘+텍스트])이 fade out,
      // 그 위로 버튼([아이콘+라벨])이 fade in. (선택한 슬롯은 persist 라 entering 미발동)
      entering={FadeIn.duration(220)}
      exiting={FadeOut.duration(220)}
      style={{ flex: 1 }}
    >
      <TouchableOpacity
        onPress={onPress}
        disabled={isResult || disabled}
        activeOpacity={isResult ? 1 : 0.85}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: isResult ? s(8) : s(6),
          justifyContent: isResult ? 'flex-start' : 'center',
          minHeight: s(44),
          paddingVertical: isResult ? s(4) : 0,
          opacity: !isResult && disabled ? 0.6 : 1,
        }}
      >
        {/* 카드 배경 — 선택 모드에서만. 결과로 갈 땐 페이드아웃(하드컷 방지) */}
        {!isResult && (
          <Animated.View
            key="card-bg"
            exiting={FadeOut.duration(180)}
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: COLORS.gray[50],
              borderRadius: s(12),
            }}
          />
        )}

        {/* 아이콘 — 두 모드에서 유지(같은 인스턴스). 거리 비례 duration 으로 등속 glide */}
        <Animated.View key="status-icon" layout={moveLayout}>
          <Icon name={iconName} size={20} />
        </Animated.View>

        {/* 선택 라벨 — 결과로 갈 땐 페이드아웃 */}
        {!isResult && (
          <Animated.View key="select-label" exiting={FadeOut.duration(140)}>
            <Typography
              variant="body-02"
              weight="semibold"
              className="text-gray-900"
              numberOfLines={1}
            >
              {label}
            </Typography>
          </Animated.View>
        )}

        {/* 결과 꼬리 — 아이콘이 이동한 뒤 페이드인 */}
        {isResult && (
          <Animated.View
            key="result-tail"
            entering={FadeIn.duration(220).delay(tailDelay)}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: s(8) }}
          >
            <Typography
              variant="body-02"
              weight="semibold"
              className="text-gray-900"
              style={{ flex: 1 }}
            >
              {resultLabel}
            </Typography>
            <TouchableOpacity
              onPress={onRevert}
              disabled={revertDisabled}
              hitSlop={6}
              activeOpacity={0.7}
            >
              <Typography
                variant="body-03"
                weight="regular"
                style={{ color: COLORS.gray[500], opacity: revertDisabled ? 0.5 : 1 }}
              >
                {revertLabel}
              </Typography>
            </TouchableOpacity>
          </Animated.View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}
