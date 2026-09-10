/**
 * 거주 시/도 — 위치 권한이 없을 때 센터 지도의 시작 좌표로 쓴다.
 * 시/군/구까지 받지 않는 이유: 주소→좌표 변환(지오코딩)이 없어 더 좁혀도 쓸 데가 없다.
 */
export const SIDO_OPTIONS = [
  { label: '서울특별시', latitude: 37.5665, longitude: 126.978 },
  { label: '부산광역시', latitude: 35.1796, longitude: 129.0756 },
  { label: '대구광역시', latitude: 35.8714, longitude: 128.6014 },
  { label: '인천광역시', latitude: 37.4563, longitude: 126.7052 },
  { label: '광주광역시', latitude: 35.1595, longitude: 126.8526 },
  { label: '대전광역시', latitude: 36.3504, longitude: 127.3845 },
  { label: '울산광역시', latitude: 35.5384, longitude: 129.3114 },
  { label: '세종특별자치시', latitude: 36.48, longitude: 127.289 },
  { label: '경기도', latitude: 37.4138, longitude: 127.5183 },
  { label: '강원특별자치도', latitude: 37.8228, longitude: 128.1555 },
  { label: '충청북도', latitude: 36.6357, longitude: 127.4917 },
  { label: '충청남도', latitude: 36.5184, longitude: 126.8 },
  { label: '전북특별자치도', latitude: 35.7175, longitude: 127.153 },
  { label: '전라남도', latitude: 34.8679, longitude: 126.991 },
  { label: '경상북도', latitude: 36.4919, longitude: 128.8889 },
  { label: '경상남도', latitude: 35.4606, longitude: 128.2132 },
  { label: '제주특별자치도', latitude: 33.4996, longitude: 126.5312 },
] as const;

export function coordsOfSido(
  sido: string | null,
): { latitude: number; longitude: number } | null {
  if (!sido) return null;
  const found = SIDO_OPTIONS.find((option) => option.label === sido);
  return found ? { latitude: found.latitude, longitude: found.longitude } : null;
}
