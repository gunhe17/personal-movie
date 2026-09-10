import { differenceInYears, parseISO } from 'date-fns';
import type { EligibilityAnswers, VoucherMatch, VoucherProgram } from './types';

/** 생년월일(YYYY-MM-DD) → 만 나이. 없거나 파싱 불가면 null(연령 조건 미적용). */
export function ageFromBirthDate(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null;
  // 생년월일은 서버 `date` 타입(달력상의 날짜)이라 KST 변환 대상이 아니다
  const parsed = parseISO(birthDate);
  if (Number.isNaN(parsed.getTime())) return null;
  return differenceInYears(new Date(), parsed);
}

/**
 * 자가진단 답변 → 서버 eligibility 룰 매칭. 판정이 아닌 안내(최종 확인 = 주민센터·복지로).
 * 답변은 이 함수에 넘겨 매칭에만 쓰고 저장·전송하지 않는다.
 */
export function matchVouchers(
  answers: EligibilityAnswers,
  age: number | null,
  programs: VoucherProgram[],
): VoucherMatch[] {
  return programs.map((program) => {
    const rule = program.eligibility;
    if (!rule) {
      return { program, status: 'pending', pending: [], reason: 'no_rule' } as const;
    }

    const ageBlocked =
      age !== null &&
      ((rule.max_age !== null && age > rule.max_age) ||
        (rule.min_age !== null && age < rule.min_age));
    const incomeBlocked = rule.income_max_pct !== null && answers.income === 'over';

    const pending: string[] = [];
    if (rule.income_max_pct !== null && answers.income === 'unknown') {
      pending.push('소득 기준 확인');
    }
    if (rule.need_evidence && answers.evidence !== 'yes') {
      pending.push('진단서·검사 결과');
    }

    const blocked = ageBlocked || incomeBlocked;
    return {
      program,
      status: blocked ? 'blocked' : pending.length > 0 ? 'pending' : 'ok',
      pending,
      reason: ageBlocked ? 'age' : incomeBlocked ? 'income' : null,
    } as const;
  });
}
