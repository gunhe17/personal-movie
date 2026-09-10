import { modalStore } from '$lib/stores/modal'
import type { CaseClient, CounselingSession } from '$lib/types/counseling'
import CounselingJournalModal from './components/CounselingJournalModal.svelte'

export interface OpenCounselingJournalModalParams {
  session: CounselingSession
  caseClients: CaseClient[]
  programName: string
  initialClientId: string
  isSecretMode?: boolean
}

/**
 * 상담일지 작성 모달 열기 (화면 하단 시트 스타일)
 *
 * 참여자별 일지 작성/수정 모달. 저장/조회/invalidate는 모달 내부에서 처리.
 * 종합 소견(summary) 필드는 UI에 노출하지 않고 기존 값 그대로 유지된다.
 */
export function openCounselingJournalModal(
  params: OpenCounselingJournalModalParams
) {
  const { session, caseClients, programName, initialClientId, isSecretMode } =
    params

  return modalStore.open({
    component: CounselingJournalModal,
    props: {
      session,
      caseClients,
      programName,
      initialClientId,
      isSecretMode
    },
    options: {
      placement: 'bottom',
      customWidth: 640,
      overflowVisible: true
    }
  })
}
