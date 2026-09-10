import type { EligibilityAnswers, EvidenceAnswer, IncomeAnswer } from '@/features/voucher';

/** 장애 등록(복지카드) 보유 여부 — 서버 eligibility에 대응 축이 없어 증빙 요건으로 흡수한다. */
export type DisabilityAnswer = 'yes' | 'no';

/**
 * 미연동 홈 플로우의 입력값 — 아이 정보 + 자격 문항.
 *
 * 서버에 보내지 않는다(자가진단과 같은 원칙). 기기에만 남겨 홈이 매번
 * 첫 화면으로 되돌아가지 않게 한다.
 */
export interface SupportCheckAnswers {
  name: string | null;
  /** YYYY-MM-DD */
  birthDate: string | null;
  gender: string | null;
  /** 거주 시/도 — 위치 권한이 없을 때 센터 검색의 기준점 */
  sido: string | null;
  income: IncomeAnswer | null;
  evidence: EvidenceAnswer | null;
  disability: DisabilityAnswer | null;
}

/**
 * 자격 문항 → 서버 룰 매칭 입력.
 * 장애 등록증은 진단서·검사 결과와 같은 증빙 역할을 하므로 evidence로 흡수한다
 * (서버 eligibility에 장애 축이 없다 — 축이 생기면 여기서 갈라내면 된다).
 */
export function toEligibilityAnswers(answers: SupportCheckAnswers): EligibilityAnswers {
  return {
    income: answers.income,
    evidence: answers.disability === 'yes' ? 'yes' : answers.evidence,
  };
}
