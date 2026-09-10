export type ScheduleKind = 'counseling' | 'assessment';

/** 센터 확인을 기다리는 변경 요청 — 있으면 재요청 대신 "검토 중"을 보여준다 */
export interface PendingChangeRequest {
  request_id: string;
  requested_start: string;
  requested_end: string;
}

/** GET /app/schedules/{id}/available-slots — 비활성 슬롯도 함께 내려온다(시안 그리드) */
export interface AvailableSlot {
  time: string;
  available: boolean;
}

export interface AvailableSlots {
  date: string;
  slot_minutes: number;
  duration_minutes: number;
  slots: AvailableSlot[];
}

/** GET /app/schedules 항목 — 읽기 전용 일정 */
export interface AppSchedule {
  schedule_id: string;
  profile_id: string;
  center_id: string;
  center_name: string;
  kind: ScheduleKind;
  title: string;
  start_time: string;
  end_time: string;
  status: string;
  /** 담당 상담사 이름 — 일정에 담당자가 없으면 null */
  counselor_name: string | null;
  /** 상담실 이름 — 배정 전이면 null */
  room_name: string | null;
  /** 담당자가 일정에 남긴 메모(Schedule.note) — 없으면 null */
  memo: string | null;
  /** 이 회기가 청구된 바우처(제도) 이름 — 바우처 청구 없으면 null */
  voucher_name: string | null;
  /** 센터 확인 대기 중인 변경 요청 — 없으면 null */
  pending_change_request: PendingChangeRequest | null;
}
