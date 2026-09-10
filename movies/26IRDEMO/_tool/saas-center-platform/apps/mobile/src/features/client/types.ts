export interface ClientSignal {
  /** 신호 타입 식별자 — 'session_today' | 'log_missing' | 'assessment_result_ready' | 'billing_unpaid' */
  type: string;
  /** ionicon 이름 — 캐러셀 카드 아이콘으로 그대로 사용 */
  icon_name: string;
  /** 상황 요약 — 예: "어제 검사 완료" */
  detail: string;
  /** 액션 안내 — 예: "결과를 공유해 주세요" */
  action: string;
  /** 퀵 액션 target — session_today, log_missing 용. 시트 즉시 노출 */
  session_id?: string | null;
  /** 시트 헤더 표시용 */
  session_start?: string | null;
  /** 퀵 액션 target — assessment_result_ready 용. 검사 케이스 상세로 push */
  assessment_case_id?: string | null;
}

export interface ClientSummary {
  id: string;
  code: string;
  name: string;
  role: "client" | "guardian" | "both";
  phone: string | null;
  status: "active" | "inactive" | "archived";
  birth_date: string | null;
  gender: "male" | "female" | null;
  /** 프로필 이미지 URL (업로드 사진 또는 성별 매칭 기본 아바타) */
  profile_image_url: string | null;
  memo: string | null;
  created_at: string | null;
  /** 현재 상담사가 관심 표시한 내담자인지 — 서버가 list 응답에서 채움 */
  is_favorited: boolean;
  /** 다음 예정 회기 시작 시각 (UTC) — list 응답에서 항상 채워짐 */
  next_session_at?: string | null;
  /** 카드 액션 안내 — favorites 응답에서만 채워짐. 그 외 list 응답에서는 부재 */
  signal?: ClientSignal | null;
}

export interface FavoriteListResponse {
  /** 관심 표시된 내담자 요약 + 신호 (최신순) */
  items: ClientSummary[];
  total: number;
}

export interface ClientSignalListResponse {
  /** 단일 내담자의 활성 신호 — 우선순위 순 (Phase 4a-1 /signals API) */
  items: ClientSignal[];
  total: number;
}

// ─── 문서 (form_instance + document) — web과 동일 API 재사용 ───

export type FormInstanceStatus = "draft" | "submitted";

export interface FormInstanceSummary {
  id: string;
  center_id: string;
  template_id: string;
  status: FormInstanceStatus;
  submitted_at: string | null;
  created_at: string;
}

export interface ClientFormInstanceItem {
  mapping_id: string;
  instance: FormInstanceSummary;
  created_at: string;
}

export interface ClientFormInstanceListResponse {
  items: ClientFormInstanceItem[];
  total: number;
}

export interface DocumentSummary {
  id: string;
  name: string;
  original_name: string | null;
  file_type: string;
  file_size: number;
  storage_path: string;
  created_at: string;
}

export interface ClientDocumentItem {
  mapping_id: string;
  document: DocumentSummary;
  /** pre_admission | consent | assessment | other */
  resource_type: string;
  created_at: string;
}

export interface ClientDocumentListResponse {
  items: ClientDocumentItem[];
  total: number;
}

export interface FavoriteResponse {
  id: string;
  person_id: string;
  client_id: string;
  center_id: string;
  created_at: string;
}

export interface ClientListResponse {
  items: ClientSummary[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface ClientListParams {
  centerId: string;
  skip?: number;
  limit?: number;
  role?: "client" | "guardian" | "both";
  status?: "active" | "inactive" | "archived";
  search?: string;
  /** desc=최신순(기본) · asc=오래된순 · name=이름순 · next_session=회기 임박순 (백엔드 지원) */
  sort?: "asc" | "desc" | "name" | "next_session";
}

export interface ClientDetail {
  id: string;
  code: string;
  center_id: string;
  person_id: string | null;
  role: "client" | "guardian" | "both";
  name: string;
  birth_date: string | null;
  gender: "male" | "female" | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  status: "active" | "inactive" | "archived";
  /** 프로필 이미지 URL (업로드 사진 또는 성별 매칭 기본 아바타) */
  profile_image_url: string | null;
  memo: string | null;
  created_at: string;
  updated_at: string;
  /** 현재 상담사가 관심 표시한 내담자인지 — 서버가 detail 응답에 채움 */
  is_favorited: boolean;
}

/** 내담자별 검사 케이스 (백엔드 AssessmentCaseListItem 과 동일 형태) */
export interface AssessmentCaseSummary {
  case_id: string;
  status: "pending" | "processing" | "completed" | "cancelled";
  assessment_names: string[];
  set_name: string | null;
  completed_count: number;
  total_count: number;
  scheduled_start: string | null;
  scheduled_end: string | null;
  room_name: string | null;
  created_at: string;
}

export interface CounselingCaseListItem {
  case_id: string;
  case_code: string;
  status: "active" | "completed" | "cancelled";
  case_type: "individual" | "group";
  program_name: string | null;
  clients: Array<{
    client_id: string;
    name: string;
    client_code: string | null;
    birth_date: string | null;
    age: number | null;
    gender: string | null;
  }>;
  counselor_name: string | null;
  completed_sessions: number;
  scheduled_sessions: number;
  total_sessions: number;
  next_session_start: string | null;
  created_at: string;
}

export interface CounselingCaseListResponse {
  items: CounselingCaseListItem[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

// --- Registration Types ---

export interface CreateClientPayload {
  role: "client" | "guardian" | "both";
  name: string;
  birth_date: string | null;
  gender: "male" | "female" | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  memo: string | null;
}

export interface BatchGuardianInput {
  name: string;
  birth_date: string | null;
  gender: "male" | "female" | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  relation_type: string;
  relation_detail: string | null;
  is_primary: boolean;
  memo: string | null;
}

export interface BatchChildInput {
  name: string;
  birth_date: string;
  gender: "male" | "female";
  phone: string | null;
  email: string | null;
  address: string | null;
  memo: string | null;
}

export interface BatchCreateClientsRequest {
  guardians: BatchGuardianInput[];
  children: BatchChildInput[];
}

export interface BatchCreateClientsResponse {
  guardians: ClientDetail[];
  children: ClientDetail[];
  relations: {
    client_relations: number;
    sibling_relations: number;
  };
}

// --- Relation Types ---

export interface RelationResponse {
  id: string;
  relation_category: "guardian" | "sibling";
  center_id: string;
  client_id: string;
  related_client_id: string;
  relation_type: string | null;
  is_primary: boolean | null;
  relation_detail: string | null;
  created_at: string;
}

export interface RelationInfo {
  clientId: string;
  name: string;
  /** guardian = 이 내담자의 보호자 / child = 이 내담자(보호자)의 자녀 */
  relationType: 'guardian' | 'child';
  relationLabel: string;
  isPrimary: boolean;
  phone: string | null;
}
