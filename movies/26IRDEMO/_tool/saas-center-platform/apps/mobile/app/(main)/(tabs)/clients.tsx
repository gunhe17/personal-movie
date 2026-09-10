import { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Keyboard,
  BackHandler,
  TextInput,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  Easing,
} from 'react-native-reanimated';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCenterStore, useRole } from '@/features/center';
import {
  useClientFavorites,
  useClientList,
  type ClientSummary,
} from '@/features/client';
import { useUnreadCount } from '@/features/notification';
import { COLORS } from '@/shared/constants/theme';
import { Typography } from '@/shared/components/ui/Typography';
import { SearchField } from '@/shared/components/ui/SearchField';
import { NotificationBell } from '@/shared/components/ui/NotificationBell';
import { useDelayedSkeleton } from '@/shared/components/ui/Skeleton';
import { useTabBarClearance } from '@/shared/hooks/useTabBarClearance';
import { s } from '@/shared/utils/scale';
import { withTabTransition } from './_components/TabTransition';
import {
  ClientRow,
  ClientListSkeleton,
  FavClientCard,
  groupByChoseong,
} from './_components/client-browse';

export default withTabTransition(ClientsScreen);

function ClientsScreen() {
  const router = useRouter();
  const centerId = useCenterStore((s) => s.centerId);
  const { isCounselor } = useRole();
  const tabClear = useTabBarClearance();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // 관심(즐겨찾기) — 검색 중에는 숨김
  const { data: favoritesData, refetch: refetchFavorites } = useClientFavorites(centerId);
  const favorites = useMemo<ClientSummary[]>(() => favoritesData?.items ?? [], [favoritesData]);

  // 전체 명단 — 이름순(서버 sort=name)으로 한 번에 받아 초성 그룹핑.
  // 상담사 담당 내담자는 bounded → limit 크게 잡아 단일 로드.
  const { data, isLoading, isError, refetch, isRefetching } = useClientList(centerId, {
    search: debouncedSearch || undefined,
    sort: 'name',
    limit: 1000,
  });
  const { data: unreadData } = useUnreadCount(centerId);
  const unreadCount = unreadData?.count ?? 0;

  const clients = useMemo<ClientSummary[]>(() => data?.items ?? [], [data]);
  const searching = !!debouncedSearch;
  // 검색 모드 = 인풋 포커스(탭한 즉시) 또는 검색어가 있는 상태.
  // 관심 섹션 접힘·컨테이너 슬라이드·흰 배경을 이걸로 묶는다.
  const searchMode = isFocused || searching;
  // 빠른 로딩에선 스켈레톤을 띄우지 않음(깜빡임 방지)
  const showSkeleton = useDelayedSkeleton(isLoading);

  const grouped = useMemo(
    () => (searching ? [] : groupByChoseong(clients)),
    [clients, searching],
  );

  const handleSearchChange = useCallback(
    (text: string) => {
      setSearch(text);
      if (debounceTimer) clearTimeout(debounceTimer);
      const timer = setTimeout(() => setDebouncedSearch(text.trim()), 300);
      setDebounceTimer(timer);
    },
    [debounceTimer],
  );

  const clearSearch = useCallback(() => {
    setSearch('');
    setDebouncedSearch('');
    if (debounceTimer) clearTimeout(debounceTimer);
  }, [debounceTimer]);

  const handleClientPress = useCallback(
    (id: string) => {
      router.push(`/(main)/client/${id}`);
    },
    [router],
  );

  const onRefresh = useCallback(() => {
    refetch();
    refetchFavorites();
  }, [refetch, refetchFavorites]);

  // 검색 모드 완전 해제 — 키보드 내리고 인풋 blur + 검색어 초기화 → 원래 리스트 복귀.
  const exitSearchMode = useCallback(() => {
    inputRef.current?.blur();
    setIsFocused(false);
    setSearch('');
    setDebouncedSearch('');
    if (debounceTimer) clearTimeout(debounceTimer);
    Keyboard.dismiss();
  }, [debounceTimer]);

  // 검색 모드 여부를 백 핸들러가 최신값으로 읽도록 ref 유지(재구독 없이).
  const searchModeRef = useRef(false);
  searchModeRef.current = isFocused || search.length > 0;

  // Android 하드웨어 백: 키보드 올라간 검색 모드면 화면을 떠나지 않고 원래 리스트로 복귀.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (searchModeRef.current) {
          exitSearchMode();
          return true; // 소비 — 탭/화면 pop 방지
        }
        return false;
      });
      return () => sub.remove();
    }, [exitSearchMode]),
  );

  // 검색 시 관심 섹션이 빠지며 검색바 컨테이너가 위로 미끄러지는 트랜지션.
  // 스프링의 도착점 오버슈트(덜컹) 제거 위해 타이밍 기반 ease-out — 빠르게 감속해 흔들림 없이 멈춤.
  const listLayout = LinearTransition.duration(220).easing(
    Easing.out(Easing.cubic),
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* 헤더: 내담자 + 알림 */}
      <View
        style={{ height: s(52), paddingHorizontal: s(20) }}
        className="flex-row items-center justify-between"
      >
        <Typography variant="headline-02" weight="bold" className="text-gray-900">
          내담자
        </Typography>
        <View className="flex-row items-center" style={{ gap: s(16) }}>
          {/* 내담자 등록 — register 위저드 진입 (기능은 있는데 진입점이 없던 고아 라우트 배선) */}
          <TouchableOpacity
            onPress={() => router.push('/(main)/client/register')}
            accessibilityRole="button"
            accessibilityLabel="내담자 등록"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="person-add-outline" size={22} color={COLORS.gray[700]} />
          </TouchableOpacity>
          <NotificationBell
            count={unreadCount}
            onPress={() => router.push('/(main)/notifications')}
            color={COLORS.gray[700]}
          />
        </View>
      </View>

      {/* 검색 중에는 컨테이너(흰색)가 위로 올라오며 생기는 하단 빈 공간이
          회색 페이지 배경으로 보이지 않도록, body 배경도 흰색으로 전환한다. */}
      <View className={`flex-1 ${searchMode ? 'bg-surface' : 'bg-background'}`}>
        {showSkeleton ? (
          <ClientListSkeleton />
        ) : isLoading ? (
          // delay 창(빠른 로딩) — 잠깐 빈 화면. 스켈레톤/빈상태 깜빡임 방지
          <View className="flex-1" />
        ) : isError ? (
          <ListErrorView onRetry={() => refetch()} />
        ) : (
        <ScrollView
          // 배경 흰색 → 하단 바운스 흰색. 상단(관심 내담자 회색)은 아래 회색 View + 섹션 bg로 처리.
          // 헤더↔콘텐츠 16px 간격은 흰색 ScrollView 패딩이 아니라 회색 관심 섹션 내부 paddingTop으로 줌
          // (흰 띠 방지). 검색 모드(관심 섹션 숨김)에선 전체 컨테이너 자체 paddingTop(24)이 간격 역할.
          style={{ backgroundColor: COLORS.white }}
          contentContainerStyle={{
            paddingTop: 0,
            paddingBottom: 0,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={COLORS.primary} />
          }
        >
          {/* 상단 바운스 시 회색 유지 — 검색 모드(전체 흰색)에선 미적용 */}
          {!searchMode && (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: -600,
                left: 0,
                right: 0,
                height: 600,
                backgroundColor: COLORS.bg.base,
              }}
            />
          )}
          {/* ── 관심 내담자 (검색 모드 진입 시 숨김) ── */}
          {!searchMode && (
            <Animated.View
              entering={FadeIn.duration(120)}
              exiting={FadeOut.duration(90)}
              layout={listLayout}
              // ScrollView가 흰색이라 관심 영역은 회색 bg 명시. paddingTop = 헤더와의 16px 간격(회색),
              // paddingBottom = 전체 컨테이너와의 간격
              style={{
                backgroundColor: COLORS.bg.base,
                paddingHorizontal: s(20),
                paddingTop: s(16),
                paddingBottom: s(24),
              }}
            >
              <SectionLabel title="관심 내담자" count={favorites.length} />
              {favorites.length > 0 ? (
                // 가로 슬라이드 — 부모 좌우 패딩(20)을 상쇄해 화면 끝까지 스크롤(카드 안 잘리게)
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ marginHorizontal: -s(20) }}
                  contentContainerStyle={{
                    gap: s(12),
                    paddingVertical: s(4),
                    paddingLeft: s(20),
                    paddingRight: s(20),
                  }}
                >
                  {favorites.map((c) => (
                    <FavClientCard key={c.id} client={c} onPress={handleClientPress} />
                  ))}
                </ScrollView>
              ) : (
                <View
                  style={{ padding: s(20), gap: s(8) }}
                  className="items-center rounded-lg bg-surface"
                >
                  <Ionicons name="heart-outline" size={s(28)} color={COLORS.primary} />
                  <Typography variant="body-02" weight="semibold" className="text-gray-900">
                    관심 내담자가 아직 없어요
                  </Typography>
                  <Typography variant="body-03" className="text-center text-gray-500">
                    내담자 상세에서 하트를 눌러{'\n'}자주 보는 분을 모아 두세요
                  </Typography>
                </View>
              )}
            </Animated.View>
          )}

          {/* ── 전체 내담자 컨테이너 — 제목 + 검색 + 목록을 하나로 ──
              관심 내담자 섹션이 검색 시 사라질 때 검색바가 순간이동하지 않도록
              layout 트랜지션으로 부드럽게 위로 미끄러지게 한다. */}
          <Animated.View
            layout={listLayout}
            className="bg-surface"
            style={{
              borderTopLeftRadius: s(24),
              borderTopRightRadius: s(24),
              paddingTop: s(24),
              paddingHorizontal: s(16),
              paddingBottom: tabClear,
              gap: s(12),
            }}
          >
            <SectionLabel
              title="전체 내담자"
              count={data?.total ?? clients.length}
              hint={isCounselor ? '담당자로 배정된 내담자만 표시' : undefined}
              mb={0}
            />

            {/* 검색바 */}
            <SearchField
              value={search}
              onChangeText={handleSearchChange}
              onClear={clearSearch}
              placeholder="이름, 전화번호로 검색해주세요"
              blurOnSubmit={false}
              // Figma: bg/surface-sunken + border/default (1px)
              containerStyle={{ borderWidth: 1, borderColor: '#E3EAEF' }}
            />

            {/* 본문 — 그룹 카드 없이 그냥 나열 (초성 헤더 + 행 구분선) */}
            <View>
              {clients.length === 0 ? (
                <ClientEmpty searching={searching} isCounselor={isCounselor} />
              ) : searching ? (
                clients.map((c, idx) => (
                  <ClientRow
                    key={c.id}
                    client={c}
                    onPress={handleClientPress}
                    paddingX={0}
                    isLast={idx === clients.length - 1}
                  />
                ))
              ) : (
                grouped.map(([key, group], gi) => (
                  <View key={key}>
                    <View
                      style={{
                        // 자음 위 16px (첫 그룹은 컨테이너 gap 12 + 4 = 16), 자음 아래 9px
                        paddingTop: gi === 0 ? s(4) : s(16),
                        paddingBottom: s(9),
                        paddingLeft: s(2),
                      }}
                    >
                      <Typography variant="body-03" weight="medium" className="text-gray-400">
                        {key}
                      </Typography>
                    </View>
                    {group.map((c, idx) => (
                      <ClientRow
                        key={c.id}
                        client={c}
                        onPress={handleClientPress}
                        paddingX={0}
                        isFirst={idx === 0}
                        isLast={gi === grouped.length - 1 && idx === group.length - 1}
                      />
                    ))}
                  </View>
                ))
              )}
            </View>
          </Animated.View>
        </ScrollView>
        )}

        {/* 하단 페이드 — 플로팅 탭바 아래 빈 공간으로 새어 보이는 리스트 행이
            또렷하게 노출되지 않고 배경(흰색)으로 자연스럽게 흐려지도록.
            탭바 pill 은 네비게이터 오버레이라 이 그라데이션 위에 그려져 선명하게 유지된다.
            높이를 키우면 더 위 행까지, 줄이면 맨 아래만 흐려진다.
            시작색은 'transparent'(= 알파 0인 검정) 금지 — iOS 는 비-premultiplied 로 보간해
            중간 구간이 반투명 검정을 지나 회색 띠로 보인다. 알파 0인 흰색으로 명시한다. */}
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(255,255,255,0)', COLORS.surface]}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: insets.bottom + s(64),
          }}
        />
      </View>
    </SafeAreaView>
  );
}

/* ─── 섹션 라벨 ─── */
function SectionLabel({
  title,
  count,
  hint,
  mb = s(10),
}: {
  title: string;
  count?: number;
  hint?: string;
  mb?: number;
}) {
  return (
    <View style={{ marginBottom: mb }}>
      <View className="flex-row items-baseline" style={{ gap: s(6) }}>
        <Typography variant="title-01" weight="semibold" className="text-gray-900">
          {title}
        </Typography>
        {count !== undefined && (
          <Typography variant="body-03" weight="regular" className="text-gray-400">
            {count}
          </Typography>
        )}
      </View>
      {hint && (
        <Typography variant="caption-01" className="text-gray-500" style={{ marginTop: s(2) }}>
          {hint}
        </Typography>
      )}
    </View>
  );
}

/* ─── 에러 상태 ─── */
function ListErrorView({ onRetry }: { onRetry: () => void }) {
  return (
    <View className="flex-1 items-center justify-center" style={{ gap: s(8), paddingHorizontal: s(20) }}>
      <Ionicons name="cloud-offline-outline" size={s(40)} color={COLORS.gray[300]} />
      <Typography variant="body-02" weight="semibold" className="text-gray-600">
        목록을 불러올 수 없어요
      </Typography>
      <Typography variant="body-03" className="text-center text-gray-400">
        네트워크 연결을 확인하고 다시 시도해 주세요
      </Typography>
      <TouchableOpacity
        onPress={onRetry}
        style={{ marginTop: s(8), paddingHorizontal: s(20), paddingVertical: s(10) }}
        className="rounded-md bg-primary"
        accessibilityRole="button"
      >
        <Typography variant="body-03" weight="semibold" className="text-white">
          다시 시도
        </Typography>
      </TouchableOpacity>
    </View>
  );
}

/* ─── 빈 상태 ─── */
function ClientEmpty({ searching, isCounselor }: { searching: boolean; isCounselor: boolean }) {
  if (searching) {
    return (
      <View style={{ paddingVertical: s(48), gap: s(8) }} className="items-center">
        <Ionicons name="search-outline" size={s(40)} color={COLORS.gray[300]} />
        <Typography variant="body-02" weight="semibold" className="text-gray-600">
          검색 결과가 없어요
        </Typography>
        <Typography variant="body-03" className="text-gray-400">
          다른 검색어를 입력해 보세요
        </Typography>
      </View>
    );
  }
  return (
    <View style={{ paddingVertical: s(48), gap: s(8) }} className="items-center">
      <Ionicons name="people-outline" size={s(40)} color={COLORS.gray[300]} />
      <Typography variant="body-02" weight="semibold" className="text-gray-600">
        {isCounselor ? '배정된 내담자가 없어요' : '등록된 내담자가 없어요'}
      </Typography>
      <Typography variant="body-03" className="text-gray-400">
        {isCounselor
          ? '상담 또는 검사 케이스에 배정되면 이곳에 표시돼요'
          : '웹에서 내담자를 등록하면 이곳에 표시돼요'}
      </Typography>
    </View>
  );
}
