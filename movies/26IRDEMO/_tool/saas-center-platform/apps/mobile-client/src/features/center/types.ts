/** 요일별 운영시간 — 시간은 "HH:MM", null이면 휴무/미설정. */
export interface OperatingTime {
  weekday: string; // MON..SUN
  open_time: string | null;
  close_time: string | null;
  break_start_time: string | null;
  break_end_time: string | null;
}

/** GET /app/centers/{id} — 연결된 센터 상세(읽기 투영). */
export interface CenterDetail {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  image_url: string | null;
  operating_times: OperatingTime[];
}
