/**
 * 성장 정원 모델 — 활동 탭 C안(성장 정원)의 파생 규칙.
 *
 * 대원칙: 성장은 완료 회기의 절대 누적에만 반응한다. 완료/총회기 비율 매핑 금지 —
 * 연장으로 총회기가 늘어도 식물은 작아지지도, 성장이 더뎌지지도 않는다.
 * 총회기는 그릇(화분 치수)의 정보일 뿐이다. 되돌아가는 연출(시듦·감점·리셋) 금지.
 */
import type { AssessmentProgress, CounselingProgress } from './types';

/** 3구간 성장 단계 — 모종기(잎 1:1) → 개화기(형태) → 성목기(열매 사이클) */
export type PlantStage =
  | 'seed' // 0회
  | 'sprout' // 1–2회
  | 'stem' // 3–5회
  | 'lush' // 6–9회
  | 'bud' // 10–12회
  | 'bloom' // 13–18회
  | 'fruit'; // 19회+

/**
 * 완주는 절대 단계의 유일한 예외 — 누적 수와 무관하게 최종 단계로 승격.
 * (8회짜리 케이스도 8/8 완주 순간 꽃이 핀다. 위로 승격만 하므로 단방향 원칙과 무충돌)
 */
export function plantStage(completed: number, finished: boolean): PlantStage {
  if (finished) return 'fruit';
  if (completed >= 19) return 'fruit';
  if (completed >= 13) return 'bloom';
  if (completed >= 10) return 'bud';
  if (completed >= 6) return 'lush';
  if (completed >= 3) return 'stem';
  if (completed >= 1) return 'sprout';
  return 'seed';
}

/** 화분 치수 — 총회기 구간. 열린 케이스(총량 미정)는 처음부터 대형. */
export type PotSize = 'sm' | 'md' | 'lg';

export function potSize(total: number | null): PotSize {
  if (total == null || total > 24) return 'lg';
  return total <= 12 ? 'sm' : 'md';
}

/** 성목기 장기 단위 — 완료 12회마다 수확 1개 (36회 = 3개) */
export function harvestCount(completed: number): number {
  return Math.floor(completed / 12);
}

export function isCaseFinished(item: CounselingProgress): boolean {
  return (
    item.total_sessions != null &&
    item.total_sessions > 0 &&
    item.completed_sessions >= item.total_sessions
  );
}

// ───────────────────────── 검사 — 배송 추적 파생 상태 ─────────────────────────

/**
 * 검사는 여정이 아니라 '기다림과 도착' — 실시 → 결과 준비 중 → 결과지 도착.
 * '결과 준비 중'(실시 완료 && 결과지 미공개)이 핵심: 보호자가 가장 초조한 구간에
 * 이름을 붙인다. 단 준비 기간 약속 문구("보통 N일")는 센터별로 달라 금지.
 */
export type AssessmentPhase = 'scheduled' | 'testing' | 'preparing' | 'arrived';

export interface AssessmentPhaseInfo {
  phase: AssessmentPhase;
  /** 카드/상세 상태 문구 */
  label: string;
  /** 배송 스테퍼 현재 위치 — 0 실시 · 1 결과 준비 · 2 도착 */
  step: 0 | 1 | 2;
  /** 열람 가능한 결과지 수 */
  arrivedCount: number;
}

export function assessmentPhaseInfo(item: AssessmentProgress): AssessmentPhaseInfo {
  const taskArrived = item.tasks.filter((t) => t.report_visible).length;
  const arrivedCount = taskArrived > 0 ? taskArrived : item.report_visible ? 1 : 0;

  if (arrivedCount > 0) {
    return {
      phase: 'arrived',
      step: 2,
      arrivedCount,
      label: `결과지 ${arrivedCount}건 도착`,
    };
  }
  if (item.total_count > 0 && item.completed_count >= item.total_count) {
    return { phase: 'preparing', step: 1, arrivedCount: 0, label: '결과 준비 중' };
  }
  if (item.completed_count > 0 || item.status === 'in_progress') {
    return {
      phase: 'testing',
      step: 0,
      arrivedCount: 0,
      label:
        item.total_count > 0
          ? `진행 중 · ${item.completed_count}/${item.total_count} 실시`
          : '진행 중',
    };
  }
  return { phase: 'scheduled', step: 0, arrivedCount: 0, label: '예정' };
}

/** 표면 검사 카드 정렬 — 행동 우선(도착 → 준비 → 진행 → 예정) */
const PHASE_ORDER: Record<AssessmentPhase, number> = {
  arrived: 0,
  preparing: 1,
  testing: 2,
  scheduled: 3,
};

export function sortAssessmentsByAction(items: AssessmentProgress[]): AssessmentProgress[] {
  return [...items].sort(
    (a, b) => PHASE_ORDER[assessmentPhaseInfo(a).phase] - PHASE_ORDER[assessmentPhaseInfo(b).phase],
  );
}

/** 정원 화분 정렬 — 다음 일정 임박순, 일정 없는 케이스는 뒤로 */
export function sortCounselingByImminence(items: CounselingProgress[]): CounselingProgress[] {
  return [...items].sort((a, b) => {
    if (!a.next_session_at && !b.next_session_at) return 0;
    if (!a.next_session_at) return 1;
    if (!b.next_session_at) return -1;
    return a.next_session_at.localeCompare(b.next_session_at);
  });
}
