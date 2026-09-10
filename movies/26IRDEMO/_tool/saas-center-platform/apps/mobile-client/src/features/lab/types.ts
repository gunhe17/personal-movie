/**
 * LAB(실험실) 모듈 타입 — 반영 전 시안을 앱 안에서 확인하는 공간.
 *
 * 새 시안 추가: `app/(main)/lab/<slug>.tsx` 파일 + `registry.ts` 배열 한 줄.
 * 전문가앱(apps/mobile) LAB 구조의 내담자앱 포팅본 — 카테고리 축 없이 status만 둔다.
 */

export type LabExperimentStatus = 'wip' | 'ready';

export interface LabExperiment {
  /** URL segment. `app/(main)/lab/<slug>.tsx` 파일명과 일치해야 한다. */
  slug: string;
  title: string;
  description: string;
  status?: LabExperimentStatus;
}
