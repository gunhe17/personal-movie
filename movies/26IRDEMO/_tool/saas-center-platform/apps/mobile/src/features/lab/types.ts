/**
 * LAB(실험실) 모듈 타입 정의
 *
 * - 새 실험 화면을 추가할 때는 `registry.ts`의 LAB_EXPERIMENTS 배열에 항목을 추가하고,
 *   동일한 slug 로 `app/(main)/lab/<slug>.tsx` 파일을 만들면 자동으로 목록에 노출된다.
 */

export type LabExperimentStatus = 'wip' | 'ready';

/**
 * 실험 카테고리. 실험실 목록 화면 상단 탭으로 분리해 노출한다.
 * - `final`  : 현재 작업 중인 최종 시안 후보 (앞으로 추가되는 시안의 기본 분류)
 * - `agentic`: AI 비서 컨셉(기획 변경 후) 신규 시안 — 보존용
 * - `legacy` : 그 이전 시안 (기본값)
 */
export type LabCategory = 'final' | 'agentic' | 'legacy';

export interface LabExperiment {
  /** URL segment. `app/(main)/lab/<slug>.tsx` 파일명과 일치해야 한다. */
  slug: string;
  title: string;
  description: string;
  status?: LabExperimentStatus;
  /** 미지정 시 'legacy' 로 간주 */
  category?: LabCategory;
}
