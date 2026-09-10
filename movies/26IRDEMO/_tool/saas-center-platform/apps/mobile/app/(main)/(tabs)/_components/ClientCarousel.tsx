import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  FlatList,
  Animated,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '@/shared/components/ui/Typography';
import { GenderAgeMeta } from '@/shared/components/ui/GenderAgeMeta';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';
import type { ClientSummary } from '@/features/client';
import {
  calculateAge,
  getGenderLabel,
  getInitial,
  getProfileColor,
} from './client-variants/helpers';

/**
 * 내담자 캐러셀 — 상담사가 관심 표시한 내담자를 가운데 큰 카드 + 양옆 peek로 노출.
 *
 * - 좌우 스와이프 snap + 하단 인디케이터
 * - 음수 gap으로 양옆 카드가 시각적으로 빼꼼히 보임
 *
 * 카드 2행(선별 사유 + 액션)은 서버가 내려주는 `client.signal`에 의존.
 * signal이 없으면 카드는 1행 정보(이름·성별·나이·상태)만 노출하고 2행 박스는 숨김.
 */
const CAROUSEL_ITEM_WIDTH = s(320);
// 카드 사이 간격 — peek 카드가 약간 겹쳐 보이지 않을 정도의 미세 분리.
const CAROUSEL_ITEM_GAP = s(4);
const CAROUSEL_ITEM_FULL = CAROUSEL_ITEM_WIDTH + CAROUSEL_ITEM_GAP;

const AnimatedFlatList = Animated.createAnimatedComponent(
  FlatList,
) as unknown as typeof FlatList;

interface ClientCarouselProps {
  clients: ClientSummary[];
  onPress: (id: string) => void;
  /** 현재 가운데 카드가 바뀔 때 호출 — 상단 동적 타이틀 등에서 사용 */
  onActiveChange?: (client: ClientSummary | null) => void;
}

export function ClientCarousel({
  clients,
  onPress,
  onActiveChange,
}: ClientCarouselProps) {
  const { width: screenWidth } = useWindowDimensions();
  const sidePadding = Math.max(s(20), (screenWidth - CAROUSEL_ITEM_WIDTH) / 2);

  const scrollX = useRef(new Animated.Value(0)).current;
  const listRef = useRef<FlatList<ClientSummary> | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // onActiveChange identity 변화로 인한 effect 재실행을 피하기 위해 ref 로 보관.
  const onActiveChangeRef = useRef(onActiveChange);
  onActiveChangeRef.current = onActiveChange;

  // activeIndex 또는 clients 가 바뀌면 부모에게 현재 가운데 카드 알림 (초기 마운트 포함)
  useEffect(() => {
    onActiveChangeRef.current?.(clients[activeIndex] ?? null);
  }, [activeIndex, clients]);

  // 스크롤 도중 listener 로 active 인덱스를 갱신 — onMomentumScrollEnd 가 스냅 완료
  // 후에야 발화되는 것에 비해 ~300ms 일찍 타이틀이 바뀐다 (카드 절반 통과 시점).
  //
  // 이전엔 +bias 로 30% 시점 조기 전환을 시도했으나 prev 기반 direction 이 매 snap 마다
  // 반전되며 임계점 부근에서 0↔1 무한 진동(jitter) 이 발생. Math.round 의 단일 50%
  // 임계점은 양방향 대칭이라 진동 없음.
  //
  // useMemo + ref 로 reference 안정화 (FlatList 가 매 렌더 native listener 재등록 방지).
  const clientsLengthRef = useRef(clients.length);
  clientsLengthRef.current = clients.length;

  const handleScroll = useMemo(
    () =>
      Animated.event(
        [{ nativeEvent: { contentOffset: { x: scrollX } } }],
        {
          useNativeDriver: true,
          listener: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
            const x = event.nativeEvent.contentOffset.x;
            const idx = Math.max(
              0,
              Math.min(
                clientsLengthRef.current - 1,
                Math.round(x / CAROUSEL_ITEM_FULL),
              ),
            );
            setActiveIndex((prev) => (prev === idx ? prev : idx));
          },
        },
      ),
    [scrollX],
  );

  // 스냅 완료 후 최종 보정 — 스크롤 listener 가 놓친 가장자리 케이스를 마무리.
  const handleMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      const idx = Math.round(x / CAROUSEL_ITEM_FULL);
      setActiveIndex(Math.max(0, Math.min(idx, clients.length - 1)));
    },
    [clients.length],
  );

  const selectIndex = useCallback((idx: number) => {
    listRef.current?.scrollToOffset({
      offset: idx * CAROUSEL_ITEM_FULL,
      animated: true,
    });
    setActiveIndex(idx);
  }, []);

  if (clients.length === 0) return null;

  return (
    <View>
      <AnimatedFlatList<ClientSummary>
        ref={listRef}
        data={clients}
        horizontal
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        snapToInterval={CAROUSEL_ITEM_FULL}
        decelerationRate="fast"
        contentContainerStyle={{
          paddingHorizontal: sidePadding,
          // 카드 shadow와 scale 확대 영역까지 잘리지 않도록 세로 여유 확보
          paddingVertical: s(12),
        }}
        onScroll={handleScroll}
        onMomentumScrollEnd={handleMomentumEnd}
        scrollEventThrottle={16}
        renderItem={({ item, index }) => (
          <CarouselCard
            client={item}
            index={index}
            scrollX={scrollX}
            isActive={index === activeIndex}
            onPress={() => onPress(item.id)}
          />
        )}
      />

      {clients.length > 1 && (
        <CarouselIndicator
          total={clients.length}
          activeIndex={activeIndex}
          onSelect={selectIndex}
        />
      )}
    </View>
  );
}

function CarouselCard({
  client,
  index,
  scrollX,
  isActive,
  onPress,
}: {
  client: ClientSummary;
  index: number;
  scrollX: Animated.Value;
  isActive: boolean;
  onPress: () => void;
}) {
  const age = calculateAge(client.birth_date);
  const genderLabel = getGenderLabel(client.gender);
  const initial = getInitial(client.name);
  const color = getProfileColor(client.id);
  const statusStyle = getStatusStyle(client.status);

  // 서버 signal이 있을 때만 2행 박스 노출 — fallback placeholder 제거.
  // 가짜 "특별한 알림이 없어요" 메시지는 시각적 1순위 자리를 무의미하게 점유했음.
  const signal = client.signal;

  const inputRange = [
    (index - 1) * CAROUSEL_ITEM_FULL,
    index * CAROUSEL_ITEM_FULL,
    (index + 1) * CAROUSEL_ITEM_FULL,
  ];

  const scale = scrollX.interpolate({
    inputRange,
    outputRange: [0.88, 1, 0.88],
    extrapolate: 'clamp',
  });
  const opacity = scrollX.interpolate({
    inputRange,
    outputRange: [1, 1, 1],
    extrapolate: 'clamp',
  });
  // iOS shadowOpacity — active만 그림자, peek는 0.
  // peek에서 미세한 그림자도 카드 외곽 halo로 보여 거슬리므로 완전 제거.
  const shadowOpacity = scrollX.interpolate({
    inputRange,
    outputRange: [0, 0.14, 0],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View
      style={{
        width: CAROUSEL_ITEM_WIDTH,
        marginRight: CAROUSEL_ITEM_GAP,
        // translateY 제거 — peek 카드와 active 카드가 세로 중심 정렬
        transform: [{ scale }],
        opacity,
        // shadow는 outer Animated.View에 두어 scrollX 기반 동적 처리.
        // active 카드가 페이지 위에 떠 있는 느낌이 나도록 spread 살짝 더 넉넉히.
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity,
        shadowRadius: 8,
      }}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${client.name} 내담자 상세`}
        style={({ pressed }) => ({
          opacity: pressed ? 0.92 : 1,
          transform: pressed ? [{ scale: 0.99 }] : [],
        })}
      >
        <View
          className="rounded-lg bg-surface"
          style={{
            padding: s(16),
            gap: s(12),
            // Android elevation은 active 카드에만 적용 (정적 분기).
            // peek 카드에 elevation 주면 회색 halo가 거슬리므로 0으로 끔.
            // activeIndex는 scrollX listener로 빠르게 업데이트되어 깜빡임 최소.
            elevation: isActive ? 4 : 0,
          }}
        >
          {/* 1행: 아바타 + 이름·메타 + 상태 칩 */}
          <View className="flex-row items-start" style={{ gap: s(12) }}>
            <View
              style={{
                width: s(48),
                height: s(48),
                borderRadius: s(24),
                backgroundColor: color.bg,
              }}
              className="items-center justify-center"
            >
              <Typography
                variant="title-01"
                weight="semibold"
                style={{ color: color.fg }}
              >
                {initial}
              </Typography>
            </View>
            <View style={{ flex: 1, gap: s(2) }}>
              <Typography
                variant="body-01"
                weight="semibold"
                className="text-gray-900"
                numberOfLines={1}
              >
                {client.name}
              </Typography>
              <GenderAgeMeta genderLabel={genderLabel} age={age} emptyText="-" />
            </View>
            <View
              style={{
                paddingHorizontal: s(8),
                paddingVertical: s(3),
                borderRadius: s(999),
                backgroundColor: statusStyle.bg,
              }}
            >
              <Typography
                variant="label-02"
                weight="semibold"
                style={{ color: statusStyle.fg }}
              >
                {statusStyle.label}
              </Typography>
            </View>
          </View>

          {/* 2행: 서버 신호 — signal 있을 때만 렌더.
           *      카드 높이 변동은 swipe에 큰 영향 없음. 가짜 placeholder 제거. */}
          {signal && (
            <View
              className="flex-row items-center rounded-md"
              style={{
                backgroundColor: COLORS.gray[100],
                paddingHorizontal: s(12),
                paddingVertical: s(12),
                gap: s(10),
              }}
            >
              <View
                style={{
                  width: s(32),
                  height: s(32),
                  borderRadius: s(8),
                  backgroundColor: COLORS.white,
                }}
                className="items-center justify-center"
              >
                <Ionicons
                  name={signal.icon_name as keyof typeof Ionicons.glyphMap}
                  size={s(16)}
                  color={COLORS.gray[700]}
                />
              </View>
              <View style={{ flex: 1, gap: s(2) }}>
                <Typography
                  variant="label-01"
                  className="text-gray-500"
                  numberOfLines={1}
                >
                  {signal.detail}
                </Typography>
                <Typography
                  variant="body-02"
                  weight="semibold"
                  className="text-gray-900"
                  numberOfLines={1}
                >
                  {signal.action}
                </Typography>
              </View>
            </View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

function getStatusStyle(status: ClientSummary['status']) {
  if (status === 'active') {
    return {
      label: '진행중',
      fg: COLORS.palette.blue,
      bg: COLORS.paletteBg.blue,
    };
  }
  // inactive / archived 모두 종결 톤 (gray)
  return {
    label: status === 'archived' ? '보관' : '종결',
    fg: COLORS.gray[600],
    bg: COLORS.gray[100],
  };
}

function CarouselIndicator({
  total,
  activeIndex,
  onSelect,
}: {
  total: number;
  activeIndex: number;
  onSelect: (idx: number) => void;
}) {
  return (
    <View className="items-center" style={{ paddingVertical: s(8) }}>
      <View className="flex-row items-center" style={{ gap: s(10) }}>
        {Array.from({ length: total }).map((_, idx) => {
          const isActive = idx === activeIndex;
          return (
            <Pressable
              key={idx}
              onPress={() => onSelect(idx)}
              hitSlop={{ top: 14, bottom: 14, left: 6, right: 6 }}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              style={{
                width: s(20),
                height: s(20),
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <View
                style={{
                  width: isActive ? s(10) : s(6),
                  height: isActive ? s(10) : s(6),
                  borderRadius: isActive ? s(5) : s(3),
                  backgroundColor: isActive
                    ? COLORS.gray[700]
                    : COLORS.gray[300],
                }}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
