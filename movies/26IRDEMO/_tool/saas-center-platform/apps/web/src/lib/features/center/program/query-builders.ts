/**
 * 프로그램 관리 쿼리 입력 빌더
 */

import { getProgramList } from '$lib/hooks/actions/program.action'

/** 프로그램 목록 조회 입력. 필터/정렬은 프론트(view-model)에서 처리하므로 전량 조회. */
export function buildProgramListInput(centerId: string) {
  return {
    centerId,
    page: 1,
    size: 100
  }
}

export { getProgramList }
