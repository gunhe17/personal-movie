export type PrepSignalType =
  | 'unwritten_journals'
  | 'first_meeting'
  | 'unreviewed_assessment'
  | 'previous_note_summary'
  | 'retest'
  | 'attendance_warning'
  | 'field_note_summary'
  | 'group_member_change'
  | 'extension_needed'
  | 'unpaid_billing';

export interface PrepSignalItem {
  signal_type: PrepSignalType;
  priority: number;
  label: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
}

export interface PrepSignalsResponse {
  schedule_id: string;
  signals: PrepSignalItem[];
}

// 횡단 신호(§4) — 특정 일정이 아니라 상담사(member) 단위 집계
export interface HomeSignalsResponse {
  signals: PrepSignalItem[];
}
