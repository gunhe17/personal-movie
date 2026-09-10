/**
 * 내담자 목록 정렬 "보기 설정" 영속화 (localStorage)
 *
 * 정렬은 URL 필터와 달리 앱을 다시 열어도 사용자가 직접 바꾸기 전까지 유지된다.
 * - 우선순위: URL 파라미터(있으면) > localStorage 저장값 > 기본값
 * - 저장 위치: localStorage (기기/브라우저별). centerStore와 동일한 컨벤션, browser 가드 필수.
 * - 검색어/일시적 필터는 영속화하지 않는다(앱 재진입 시 초기화가 자연스러움).
 * - 보기모드(list/grid)는 반응형 강제 전환 로직과 얽혀 영속화하지 않는다(정렬만 유지).
 */
import { browser } from '$app/environment'
import { VALID_SORT, type ClientSort } from './filters'

const SORT_KEY = 'clients:sort'

export const readStoredSort = (): ClientSort | null => {
  if (!browser) return null
  const v = localStorage.getItem(SORT_KEY)
  return v && (VALID_SORT as string[]).includes(v) ? (v as ClientSort) : null
}

export const writeStoredSort = (sort: ClientSort): void => {
  if (!browser) return
  localStorage.setItem(SORT_KEY, sort)
}
