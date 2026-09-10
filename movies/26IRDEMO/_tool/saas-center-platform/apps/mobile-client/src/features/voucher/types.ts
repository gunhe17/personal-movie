/** 자격 룰 — 서버 vouchers.eligibility(JSONB). null=기준 미정(안내만) */
export interface VoucherEligibility {
  min_age: number | null;
  max_age: number | null;
  /** 개월 원본(영유아 정밀 매칭 대비) — 매칭은 아직 년 단위(min/max_age)만 사용 */
  min_age_months?: number | null;
  max_age_months?: number | null;
  /** 기준중위소득 상한(%) — null이면 소득 무관 */
  income_max_pct: number | null;
  /** 절대액 소득 상한(원) — 질문지 확장 대비, 매칭 미사용 */
  income_max_won?: number | null;
  need_evidence: boolean;
}

/** GET /app/vouchers 항목 — 제도 카탈로그(공개 읽기 투영, 단일 소스=서버 vouchers) */
export interface VoucherProgram {
  id: string;
  name: string;
  program_name: string;
  program_organization: string;
  program_year: number;
  application_method: string | null;
  application_start_date: string | null;
  application_end_date: string | null;
  support_amount_text: string | null;
  support_scope: string | null;
  support_target: string | null;
  contact: string | null;
  eligibility: VoucherEligibility | null;
}

/** GET /app/client-vouchers 항목 — 내 프로필이 연결 센터에서 발급받은 바우처 */
export interface ClientVoucher {
  id: string;
  profile_id: string;
  profile_name: string | null;
  center_id: string;
  center_name: string | null;
  /** 제도명(카탈로그) — 센터 취급 바우처가 카탈로그를 잃은 경우 null */
  name: string | null;
  program_organization: string | null;
  total_sessions: number;
  remaining_sessions: number;
  valid_from: string | null;
  valid_until: string | null;
}

// --- 자격 자가진단 (2문항 · 입력값 비저장 — 서버 전송 없음) ---

export type IncomeAnswer = 'under' | 'over' | 'unknown';
export type EvidenceAnswer = 'yes' | 'no';

export interface EligibilityAnswers {
  income: IncomeAnswer | null;
  evidence: EvidenceAnswer | null;
}

/** 판정 아닌 안내 — ok/pending/blocked 3상태 */
export type MatchStatus = 'ok' | 'pending' | 'blocked';

export interface VoucherMatch {
  program: VoucherProgram;
  status: MatchStatus;
  /** pending일 때 준비하면 되는 항목들 */
  pending: string[];
  reason: 'age' | 'income' | 'no_rule' | null;
}
