import { snackbarStore } from '$lib/stores/snackbar'
import { appInstance } from '$lib/services/api/instances'
import type { QueryClient } from '@tanstack/svelte-query'
import {
  confirmSCT,
  saveSCTResponses,
  triggerSCTScore,
  updateSCTScore
} from './query-builders'
import type { SCTResponseItem } from './types'

export interface SCTServiceDeps {
  queryClient: QueryClient
  institutionId: string
  examId: string
}

export function createSCTService(deps: SCTServiceDeps) {
  const { queryClient, institutionId, examId } = deps

  /**
   * 결과 쿼리 무효화.
   *
   * 반환 Promise를 반드시 await해야 한다 — 버리면 호출부가 재조회를 기다리지
   * 않고 진행해, 저장·확정 직후 화면이 옛 데이터를 그린 채로 남는다.
   */
  const invalidateResults = () =>
    queryClient.invalidateQueries({
      queryKey: ['sctResults'],
      exact: false
    })

  const handleSaveResponses = async (responses: SCTResponseItem[]) => {
    const action = saveSCTResponses()
    await action.request({ institutionId, examId, responses })
    await invalidateResults()
  }

  const handleScore = async () => {
    const action = triggerSCTScore()
    await action.request({ institutionId, examId })
    await invalidateResults()
  }

  const handleUpdateScore = async (stemId: number, score: number) => {
    const action = updateSCTScore()
    await action.request({ institutionId, examId, stemId, score })
    await invalidateResults()
  }

  const handleConfirm = async () => {
    const action = confirmSCT()
    await action.request({ institutionId, examId })
    snackbarStore.success('검사를 확정했습니다.')
    await invalidateResults()
  }

  const downloadReportPdf = async () => {
    const res = await appInstance.get(
      `/institutions/${institutionId}/examinations/${examId}/sct/report/pdf`,
      { responseType: 'blob' }
    )
    const blob = new Blob([res.data], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sct_report_${examId.slice(0, 8)}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return {
    handleSaveResponses,
    handleScore,
    handleUpdateScore,
    handleConfirm,
    downloadReportPdf,
    invalidateResults
  }
}
