/** GET /app/directory-centers 항목 — 전국 센터 디렉토리(공개 읽기, 우리 입점 센터 아님) */
export interface DirectoryCenter {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  /** 외부 정의 분류 — 센터 | 복지기관 | 기타 | 병원 … */
  category: string;
  phone_number: string | null;
  /** 자유텍스트 원문("평일 09:00 - 18:00") — 영업중 판정에 쓰지 않는다 */
  operating_hours_text: string | null;
  website_url: string | null;
  distance_m: number;
}

export interface NearbyQuery {
  latitude: number;
  longitude: number;
  radiusM: number;
}
