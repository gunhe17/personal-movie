/**
 * 지도 어댑터 — 화면 코드가 지도 SDK를 직접 모르게 하는 유일한 라이브러리 import 지점.
 * SDK 교체(카카오맵 등) 시 이 파일과 types.ts 계약만 유지하면 화면은 무변경.
 */
import { forwardRef, useImperativeHandle, useRef } from 'react';
import { View } from 'react-native';
import {
  NaverMapView,
  NaverMapMarkerOverlay,
  type NaverMapViewRef,
} from '@mj-studio/react-native-naver-map';
import MarkerDefault from '@assets/images/map/marker-center-default.svg';
import MarkerAmam from '@assets/images/map/marker-center-amam.svg';
import type { AppMapProps, AppMapRef } from './types';

const METERS_PER_DEGREE_LAT = 111_320;

// 피그마 마커 원본 비율(179:1523·189:1126) 36×40.51 — 선택 시 동일 비율 확대
const PIN_W = 36;
const PIN_H = 40.5116;
const SELECTED_SCALE = 44 / 36;

function pinFrame(selected: boolean) {
  const scale = selected ? SELECTED_SCALE : 1;
  return { width: Math.round(PIN_W * scale), height: Math.round(PIN_H * scale) };
}

function CenterPin({ selected, partner }: { selected: boolean; partner: boolean }) {
  const frame = pinFrame(selected);
  const Marker = partner ? MarkerAmam : MarkerDefault;
  return (
    // 문서 요구: 마커 커스텀 뷰는 key 변경으로 재캡처 + collapsable={false} + 고정 width/height
    <View
      key={`pin-${partner ? 'amam' : 'default'}-${selected ? 'selected' : 'idle'}`}
      collapsable={false}
      style={{ width: frame.width, height: frame.height }}
    >
      <Marker width={frame.width} height={frame.height} />
    </View>
  );
}

export const NaverMap = forwardRef<AppMapRef, AppMapProps>(function NaverMap(
  { initialCamera, markers, onReady, onMarkerPress, onMapPress, onCameraIdle },
  ref,
) {
  const mapRef = useRef<NaverMapViewRef>(null);

  useImperativeHandle(ref, () => ({
    moveTo: ({ latitude, longitude, zoom }) => {
      mapRef.current?.animateCameraTo({ latitude, longitude, zoom, duration: 400 });
    },
    enableMyLocation: () => {
      mapRef.current?.setLocationTrackingMode('NoFollow');
    },
  }));

  return (
    <NaverMapView
      ref={mapRef}
      style={{ flex: 1 }}
      initialCamera={initialCamera}
      isShowLocationButton={false}
      onInitialized={onReady}
      onTapMap={onMapPress}
      onCameraIdle={({ latitude, longitude, zoom, region }) => {
        const halfHeight = (region.latitudeDelta / 2) * METERS_PER_DEGREE_LAT;
        const halfWidth =
          (region.longitudeDelta / 2) *
          METERS_PER_DEGREE_LAT *
          Math.cos((latitude * Math.PI) / 180);
        onCameraIdle?.({
          latitude,
          longitude,
          zoom: zoom ?? initialCamera.zoom,
          radiusMeters: Math.round(Math.max(halfHeight, halfWidth)),
        });
      }}
    >
      {markers.map((marker) => {
        const selected = !!marker.selected;
        const partner = marker.variant === 'partner';
        const frame = pinFrame(selected);
        return (
          <NaverMapMarkerOverlay
            key={marker.id}
            latitude={marker.latitude}
            longitude={marker.longitude}
            width={frame.width}
            height={frame.height}
            anchor={{ x: 0.5, y: 1 }}
            onTap={() => onMarkerPress?.(marker.id)}
          >
            <CenterPin selected={selected} partner={partner} />
          </NaverMapMarkerOverlay>
        );
      })}
    </NaverMapView>
  );
});
