export interface MapCamera {
  latitude: number;
  longitude: number;
  zoom: number;
}

export interface MapMarkerData {
  id: string;
  latitude: number;
  longitude: number;
  selected?: boolean;
  /** partner = 아맘때 입점 센터 전용 마커 (기본: default) */
  variant?: 'default' | 'partner';
}

/** radiusMeters = 뷰포트 중심→가장자리 거리(재검색 반경 산출용) */
export interface MapCameraIdleEvent extends MapCamera {
  radiusMeters: number;
}

export interface AppMapRef {
  moveTo(camera: { latitude: number; longitude: number; zoom?: number }): void;
  /** 현위치 오버레이 표시 — 위치 권한 획득 후에만 호출 */
  enableMyLocation(): void;
}

export interface AppMapProps {
  initialCamera: MapCamera;
  markers: MapMarkerData[];
  onReady?: () => void;
  onMarkerPress?: (id: string) => void;
  onMapPress?: () => void;
  onCameraIdle?: (event: MapCameraIdleEvent) => void;
}
