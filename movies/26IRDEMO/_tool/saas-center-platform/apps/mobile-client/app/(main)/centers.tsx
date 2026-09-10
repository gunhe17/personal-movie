import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// 지원 확인 플로우가 지역 좌표(lat·lng)를 쿼리로 넘겨 준다
import { useLocalSearchParams } from 'expo-router';
import { Chip, ErrorView, LoadingView, Toast, Typography } from '@/shared/components/ui';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';
import {
  AppMap,
  type AppMapRef,
  type MapCamera,
  type MapCameraIdleEvent,
} from '@/shared/components/map';
import {
  DEFAULT_COORDS,
  DEFAULT_ZOOM,
  DirectoryCenterCard,
  DirectoryCenterListSheet,
  ResearchAreaButton,
  getCurrentCoords,
  useNearbyDirectoryCenters,
  type NearbyQuery,
} from '@/features/directory';
import ListIcon20 from '@assets/icons/20/ListIcon20.svg';
import LocateIcon24 from '@assets/icons/24/LocateIcon24.svg';
import SearchIcon20 from '@assets/icons/20/SearchIcon20.svg';

const INITIAL_RADIUS_M = 3000;
const RESEARCH_THRESHOLD_M = 300;
const RADIUS_RANGE = { min: 100, max: 20000 } as const;

/** 검색바가 세이프에어리어에서 내려오는 여백 */
const SEARCH_TOP_GAP = 8;
/** Input_Atomic(184:1750) — py12 + 라인 20 */
const SEARCH_BAR_H = 44;
/** 목록 시트 상단 ↔ 검색바 사이 여백 */
const SHEET_GAP = 12;

/** 피그마 shadow/floating — 엘리베이션 정본 확정까지 인라인(탭바·Fab과 동일) */
const FLOATING_SHADOW = {
  shadowColor: '#000B14',
  shadowOffset: { width: 0, height: -1 },
  shadowOpacity: 0.08,
  shadowRadius: 7.9,
  elevation: 6,
} as const;

function distanceM(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.latitude * Math.PI) / 180) *
      Math.cos((b.latitude * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return Math.round(2 * 6_371_000 * Math.asin(Math.sqrt(h)));
}

export default function CentersScreen() {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<AppMapRef>(null);
  const hasLocationRef = useRef(false);

  const [initialCamera, setInitialCamera] = useState<MapCamera | null>(null);
  const [anchor, setAnchor] = useState<NearbyQuery | null>(null);
  const [camera, setCamera] = useState<MapCameraIdleEvent | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [listVisible, setListVisible] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);

  // 지원 확인 플로우가 넘기는 지역 좌표 — 위치 권한이 없을 때의 시작점
  const { lat, lng } = useLocalSearchParams<{ lat?: string; lng?: string }>();
  const fallbackCoords = useMemo(() => {
    const latitude = Number(lat);
    const longitude = Number(lng);
    return Number.isFinite(latitude) && Number.isFinite(longitude) && lat && lng
      ? { latitude, longitude }
      : null;
  }, [lat, lng]);

  const { data: centers = [], isPending, isError, refetch } = useNearbyDirectoryCenters(anchor);

  // 칩 축은 카테고리 열린 집합(센터·복지기관·병원…)이라 현재 결과에서 파생 — 빈도순
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    centers.forEach((c) => counts.set(c.category, (counts.get(c.category) ?? 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
  }, [centers]);

  const visibleCenters = useMemo(() => {
    const keyword = query.trim();
    return centers.filter(
      (c) =>
        (category === null || c.category === category) &&
        (keyword === '' || c.name.includes(keyword) || c.address.includes(keyword)),
    );
  }, [centers, category, query]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const coords = await getCurrentCoords();
      if (!mounted) return;
      hasLocationRef.current = coords !== null;
      // 위치 거부 시 폴백 순서: 호출자가 넘긴 지역 좌표(지원 확인 플로우의 시/도) > 서울시청
      const base = coords ?? fallbackCoords ?? DEFAULT_COORDS;
      setInitialCamera({ ...base, zoom: DEFAULT_ZOOM });
      setAnchor({ ...base, radiusM: INITIAL_RADIUS_M });
    })();
    return () => {
      mounted = false;
    };
    // 최초 1회만 — 진입 후 파라미터가 바뀌는 경로가 없다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMapReady = useCallback(() => {
    if (hasLocationRef.current) mapRef.current?.enableMyLocation();
  }, []);

  const showResearch =
    !!anchor && !!camera && distanceM(anchor, camera) > RESEARCH_THRESHOLD_M;

  const handleResearch = () => {
    if (!camera) return;
    setAnchor({
      latitude: camera.latitude,
      longitude: camera.longitude,
      radiusM: Math.min(RADIUS_RANGE.max, Math.max(RADIUS_RANGE.min, camera.radiusMeters)),
    });
    setCamera(null);
  };

  const handleMyLocation = async () => {
    const coords = await getCurrentCoords();
    if (!coords) {
      setToastVisible(true);
      return;
    }
    hasLocationRef.current = true;
    mapRef.current?.enableMyLocation();
    mapRef.current?.moveTo({ ...coords, zoom: DEFAULT_ZOOM });
    setAnchor({ ...coords, radiusM: INITIAL_RADIUS_M });
  };

  const handleSelectFromList = (id: string) => {
    setListVisible(false);
    setSelectedId(id);
    const center = visibleCenters.find((c) => c.id === id);
    if (center) {
      mapRef.current?.moveTo({ latitude: center.latitude, longitude: center.longitude });
    }
  };

  const selected = selectedId
    ? (visibleCenters.find((c) => c.id === selectedId) ?? null)
    : null;

  return (
    <View className="flex-1 bg-background">
      {initialCamera === null ? (
        <LoadingView />
      ) : (
        <AppMap
          ref={mapRef}
          initialCamera={initialCamera}
          markers={visibleCenters.map((c) => ({
            id: c.id,
            latitude: c.latitude,
            longitude: c.longitude,
            selected: c.id === selectedId,
          }))}
          onReady={handleMapReady}
          onMarkerPress={setSelectedId}
          onMapPress={() => setSelectedId(null)}
          onCameraIdle={setCamera}
        />
      )}

      <View
        className="absolute left-0 right-0"
        style={{ top: insets.top + s(SEARCH_TOP_GAP) }}
        pointerEvents="box-none"
      >
        <View
          className="mx-4 flex-row items-center rounded-xl bg-surface"
          style={{
            height: s(SEARCH_BAR_H),
            paddingHorizontal: s(14),
            columnGap: s(8),
            borderWidth: 1,
            borderColor: COLORS.border.default,
          }}
        >
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="검색어를 입력해주세요"
            placeholderTextColor={COLORS.text.placeholder}
            returnKeyType="search"
            style={{
              flex: 1,
              paddingVertical: 0,
              fontFamily: 'Pretendard-Regular',
              fontSize: s(16),
              color: COLORS.text.body.default,
            }}
          />
          <SearchIcon20 width={20} height={20} />
        </View>

        {categories.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0, marginTop: s(8) }}
            contentContainerStyle={{ paddingHorizontal: s(16), columnGap: s(8) }}
          >
            <Chip label="전체" selected={category === null} onPress={() => setCategory(null)} />
            {categories.map((name) => (
              <Chip
                key={name}
                label={name}
                selected={category === name}
                onPress={() => setCategory((prev) => (prev === name ? null : name))}
              />
            ))}
          </ScrollView>
        ) : null}

        {showResearch ? (
          <View className="items-center" style={{ marginTop: s(10) }} pointerEvents="box-none">
            <ResearchAreaButton onPress={handleResearch} />
          </View>
        ) : null}

        {anchor && !isPending && !isError && visibleCenters.length === 0 ? (
          <View className="items-center" style={{ marginTop: s(10) }} pointerEvents="box-none">
            <View className="rounded-full bg-surface px-4 py-2" style={FLOATING_SHADOW}>
              <Typography variant="body-03" style={{ color: COLORS.gray[600] }}>
                {centers.length === 0
                  ? '이 지역엔 등록된 센터가 없어요'
                  : '조건에 맞는 센터가 없어요'}
              </Typography>
            </View>
          </View>
        ) : null}
      </View>

      {isError ? (
        <View
          className="absolute inset-0 items-center justify-center"
          style={{ backgroundColor: 'rgba(255,255,255,0.85)' }}
        >
          <ErrorView onRetry={refetch} />
        </View>
      ) : null}

      <View
        className="absolute left-0 right-0 flex-row items-end justify-between px-4"
        style={{ bottom: Math.max(insets.bottom, s(16)) }}
        pointerEvents="box-none"
      >
        {/* 좌측 여백(현위치 버튼 42 폭만큼)으로 목록보기 pill을 화면 중앙에 정렬 */}
        <View className="flex-1 items-center" style={{ marginLeft: s(42) }} pointerEvents="box-none">
          <View
            style={[
              {
                borderRadius: s(21),
                backgroundColor: COLORS.surface,
                borderWidth: 1,
                borderColor: COLORS.border.subtle,
              },
              FLOATING_SHADOW,
            ]}
          >
            <Pressable
              accessibilityRole="button"
              onPress={() => setListVisible(true)}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <View
                className="flex-row items-center justify-center"
                style={{ columnGap: 4, paddingHorizontal: s(16), height: s(42) }}
              >
                <ListIcon20 width={20} height={20} />
                <Typography
                  variant="body-02"
                  style={{ color: COLORS.text.body.strong }}
                >
                  목록보기
                </Typography>
              </View>
            </Pressable>
          </View>
        </View>

        <View
          style={[
            {
              width: s(42),
              height: s(42),
              borderRadius: s(21),
              backgroundColor: COLORS.surface,
              borderWidth: 1,
              borderColor: COLORS.border.subtle,
            },
            FLOATING_SHADOW,
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="현재 위치로 이동"
            onPress={handleMyLocation}
            className="h-full w-full items-center justify-center"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <LocateIcon24 width={24} height={24} />
          </Pressable>
        </View>
      </View>

      {selected ? (
        <View
          className="absolute left-4 right-4"
          style={{ bottom: Math.max(insets.bottom, s(16)) + s(56) }}
        >
          <View className="rounded-2xl bg-surface" style={FLOATING_SHADOW}>
            <DirectoryCenterCard center={selected} />
          </View>
        </View>
      ) : null}

      <DirectoryCenterListSheet
        visible={listVisible}
        onClose={() => setListVisible(false)}
        centers={visibleCenters}
        onSelect={handleSelectFromList}
        topOffset={s(SEARCH_TOP_GAP) + s(SEARCH_BAR_H) + s(SHEET_GAP)}
      />

      <Toast
        visible={toastVisible}
        message="위치 권한을 허용하면 내 주변 센터를 볼 수 있어요"
        description="설정 > 앱 > 마인드스코프에서 위치 권한을 켤 수 있어요"
        onHide={() => setToastVisible(false)}
      />
    </View>
  );
}
