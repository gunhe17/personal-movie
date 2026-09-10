/** 서버 통제 vocabulary — 임의 확장 금지(설계.md §15-1) */
export type RecordMood =
  | 'excited'
  | 'calm'
  | 'neutral'
  | 'sad'
  | 'angry'
  | 'anxious';

export type RecordMediaType = 'image' | 'video';

export type RecordMediaUploadStatus =
  | 'pending'
  | 'uploaded'
  | 'processing'
  | 'ready'
  | 'failed';

export interface RecordMedia {
  id: string;
  media_type: RecordMediaType;
  upload_status: RecordMediaUploadStatus;
  duration_ms: number | null;
  width: number | null;
  height: number | null;
  /** ready인 첨부만 실린다 — pending이면 null */
  url: string | null;
}

/** GET /app/records 항목 */
export interface AppRecord {
  id: string;
  profile_id: string;
  occurred_at: string;
  mood: RecordMood | null;
  body: string | null;
  /** 작성자 본인에게만 실린다 — 타인 조회 시 null(설계.md §15-6) */
  private_memo: string | null;
  bookmarked_at: string | null;
  is_mine: boolean;
  author_name: string | null;
  media: RecordMedia[];
}

export interface AppRecordList {
  items: AppRecord[];
  next_cursor: string | null;
}

export interface RecordCreateInput {
  profile_id: string;
  client_key: string;
  occurred_at: string;
  mood: RecordMood;
  body?: string | null;
  private_memo?: string | null;
}

export interface RecordUpdateInput {
  occurred_at?: string;
  mood?: RecordMood;
  body?: string | null;
  private_memo?: string | null;
}
