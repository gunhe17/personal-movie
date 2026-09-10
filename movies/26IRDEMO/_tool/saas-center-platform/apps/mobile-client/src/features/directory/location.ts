import * as Location from 'expo-location';

/** 위치 권한 거부/실패 폴백 — 서울시청 */
export const DEFAULT_COORDS = { latitude: 37.5665, longitude: 126.978 };
export const DEFAULT_ZOOM = 14;

/** 거부·실패 시 null — 호출자가 폴백 분기(push.ts 규약: 프라이밍 없이 OS 다이얼로그 직행) */
export async function getCurrentCoords(): Promise<{
  latitude: number;
  longitude: number;
} | null> {
  try {
    const { status: existing } = await Location.getForegroundPermissionsAsync();
    let status = existing;
    if (status !== 'granted') {
      status = (await Location.requestForegroundPermissionsAsync()).status;
    }
    if (status !== 'granted') return null;

    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };
  } catch (error) {
    console.warn('[directory] 현재 위치 조회 실패:', error);
    return null;
  }
}
