/**
 * 바우처 탭 - 내담자 바우처 상세 쿼리 빌더
 *
 * 사용 내역의 related_case_id들로 상담 케이스 상세를 팬아웃 조회한다.
 * (담당 상담사 + 회기별 일지 작성 여부 도출용)
 */

import { getCounselingDetailById } from '$lib/hooks/actions/counseling.action'
import type { CounselingCaseBaseDetail } from '$lib/types/counseling'

export const getVoucherRelatedCases = () => ({
  // 일지 저장 시 CounselingJournalModal이 'getCounselingDetailById' 프리픽스를
  // invalidate하므로 같은 키를 써서 일지 작성 여부가 자동 갱신되게 한다.
  key: ['getCounselingDetailById'],
  request: async (params: {
    centerId: string | null | undefined
    caseIds: string[]
  }): Promise<CounselingCaseBaseDetail[]> => {
    if (!params.centerId || params.caseIds.length === 0) return []
    const results = await Promise.allSettled(
      params.caseIds.map((caseId) =>
        getCounselingDetailById().request({
          centerId: params.centerId!,
          counselingId: caseId
        })
      )
    )
    // 접근 불가한 케이스가 섞여 있어도 페이지 전체가 죽지 않도록 성공분만 사용
    return results
      .filter(
        (r): r is PromiseFulfilledResult<CounselingCaseBaseDetail> =>
          r.status === 'fulfilled'
      )
      .map((r) => r.value)
  }
})
