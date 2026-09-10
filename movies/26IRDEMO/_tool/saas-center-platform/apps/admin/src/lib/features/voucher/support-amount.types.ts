/**
 * voucher.support_amount (및 추출 후보)의 정규화 스키마.
 * 백엔드 `normalize_amount` 단계가 자유 텍스트를 이 구조로 변환한다 (한글 키 유지).
 *
 * 단일 금액 = number(원), 범위 = {최소, 최대}, 미상 = null.
 * 등급표가 없는 경우 등급별 = [] 이며 top-level 의 정부지원금/본인부담금/월총액 만 사용.
 */

export type AmountRange = { 최소: number | null; 최대: number | null }
export type Amount = number | AmountRange | null

/** 단가의 결제 단위 — 월정액이 아닌 문서용 (회당/시간당/일당) */
export type UnitPeriod = '회' | '시간' | '일'

export interface SupportAmountGrade {
  등급?: number | null
  기준?: string | null
  정부지원금?: Amount
  본인부담금?: Amount
  /** 정부지원 비율 %. 전액지원=100, 자부담=0. 비율형 문서(지원율/본인부담률만 명시)용 */
  지원비율?: number | null
}

export interface SupportAmount {
  통화?: string
  월총액?: Amount
  /** 회당/시간당/일당 단가 — 월정액이 아닌 문서 (정신건강 회당 8만, 장애아돌봄 시간당 12,800 등) */
  단가?: { 금액: Amount; 단위: UnitPeriod }
  /** 지원 한도 — 연 금액한도(누구나돌봄 연 150만), 연 시간한도(1,200h), 월 포인트한도 등 */
  한도?: { 값: number; 단위: '원' | '시간' | '회'; 기간: '연' | '월' }
  정부지원금?: Amount
  본인부담금?: Amount
  가격탄력제?: boolean
  등급별?: SupportAmountGrade[]
  /** 스키마 밖 자유 항목 (식비 분해·면제·이월·가산 규칙 등) — 반복 축이 굳으면 키로 승격 */
  항목?: { 라벨: string; 값: string }[]
}
