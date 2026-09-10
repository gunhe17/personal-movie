/**
 * 검사별 소견(opinion) 작성 서비스
 *
 * 쓰기는 소견 작성 모드(AssessmentOpinionWorkspace, 데스크톱)가 정본이고,
 * 태블릿 이하에서는 기존 모달로 폴백한다. self_report, external_service 공통.
 */

import { modalStore } from '$lib/stores/modal'
import { snackbarStore } from '$lib/stores/snackbar'
import { requireCenterId } from '$lib/stores/center.store'
import { updateTaskOpinion } from '$lib/hooks/actions/case.action'
import AssessmentOpinionModal from './components/AssessmentOpinionModal.svelte'
import type { AssessmentItem } from './types'
import type { QueryClient } from '@tanstack/svelte-query'

export interface OpinionServiceParams {
  /** 케이스에 속한 전체 검사 목록 (탭으로 표시) */
  assessments: AssessmentItem[]
  /** 현재 선택된 검사 ID (초기 탭) */
  initialAssessmentId: string
  /** 내담자명 (모달 헤더 — "{이름}의 검사 소견") */
  clientName?: string
  /** 검사 실시 일시 (헤더 보조 텍스트) */
  scheduledLabel?: string
  /** 메타카드 — 내담자 코드 */
  clientCode?: string
  /** 메타카드 — 작성일 (저장 시점 기준 라벨) */
  createdLabel?: string
  queryClient?: QueryClient
  onSaved?: (taskId: string, nextOpinion: string | null) => void | Promise<void>
}

/**
 * 검사 하나의 소견 저장 — 작성 모드·폴백 모달이 공유한다.
 * 실패 시 스낵바를 띄우고 다시 throw (호출부가 저장 실패를 알 수 있게)
 */
export async function saveTaskOpinion(params: {
  taskId: string
  opinion: string | null
  queryClient?: QueryClient
  onSaved?: (taskId: string, nextOpinion: string | null) => void | Promise<void>
}): Promise<void> {
  const { taskId, opinion, queryClient, onSaved } = params
  try {
    await updateTaskOpinion().request({
      centerId: requireCenterId(),
      taskId,
      opinion
    })
    snackbarStore.success('소견이 저장되었습니다')
    if (queryClient) {
      queryClient.invalidateQueries({ queryKey: ['getCaseById'], exact: false })
      queryClient.invalidateQueries({
        queryKey: ['getTasksByCaseId'],
        exact: false
      })
      queryClient.invalidateQueries({ queryKey: ['getTaskById'], exact: false })
    }
    await onSaved?.(taskId, opinion)
  } catch (error) {
    console.error('[updateTaskOpinion] failed', error)
    snackbarStore.error('소견 저장에 실패했습니다')
    throw error
  }
}

/**
 * 소견 작성/수정 모달 열기 — 태블릿 이하 폴백 (데스크톱은 소견 작성 모드)
 */
export function openAssessmentOpinionModal(params: OpinionServiceParams) {
  const {
    assessments,
    initialAssessmentId,
    clientName,
    scheduledLabel,
    clientCode,
    createdLabel,
    queryClient,
    onSaved
  } = params

  const tabs = assessments
    .filter((a) => !!a.taskId)
    .map((a) => ({
      id: a.id,
      taskId: a.taskId!,
      name: a.name,
      opinion: a.opinion ?? null
    }))

  modalStore.open({
    component: AssessmentOpinionModal,
    props: {
      assessments: tabs,
      initialAssessmentId,
      clientName,
      scheduledLabel,
      clientCode,
      createdLabel,
      onConfirm: (taskId: string, opinion: string | null) =>
        saveTaskOpinion({ taskId, opinion, queryClient, onSaved })
    },
    options: {
      placement: 'bottom',
      customWidth: 640,
      overflowVisible: true
    }
  })
}
