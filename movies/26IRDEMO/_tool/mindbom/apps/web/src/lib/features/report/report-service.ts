import { get, postRaw, appInstance } from '$lib/services/api/instances'
import type {
  ComprehensiveReport,
  ComprehensiveReportSummary,
  DraftMode,
  ReportSection,
} from './types'

function base(instId: string) {
  return `/institutions/${instId}/comprehensive-reports`
}

export const reportService = {
  /** 종합보고서 생성 (복수 검사 선택) */
  create: (
    instId: string,
    body: { client_id: string; examination_ids: string[]; title?: string }
  ) => postRaw<ComprehensiveReport>(base(instId), body),

  /** 내담자별 목록 */
  list: (instId: string, clientId: string) =>
    get<{ items: ComprehensiveReportSummary[]; total: number }>(base(instId), {
      client_id: clientId,
    }),

  /** 단일 조회 */
  get: (instId: string, reportId: string) =>
    get<ComprehensiveReport>(`${base(instId)}/${reportId}`),

  /** AI 초안 생성 */
  generateDraft: (instId: string, reportId: string, mode: DraftMode) =>
    postRaw<ComprehensiveReport>(`${base(instId)}/${reportId}/generate-draft`, {
      mode,
    }),

  /** 섹션/제목 저장 (임상가 편집) */
  saveSections: async (
    instId: string,
    reportId: string,
    sections: ReportSection[],
    title?: string
  ) => {
    const res = await appInstance.patch<ComprehensiveReport>(
      `${base(instId)}/${reportId}`,
      { sections, title }
    )
    return res.data
  },

  /** 확정 (clinician/admin만) */
  confirm: (instId: string, reportId: string) =>
    postRaw<ComprehensiveReport>(`${base(instId)}/${reportId}/confirm`),

  /** PDF 다운로드 */
  downloadPdf: async (instId: string, reportId: string) => {
    const res = await appInstance.get(
      `${base(instId)}/${reportId}/report/pdf`,
      { responseType: 'blob' }
    )
    const blob = new Blob([res.data], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `comprehensive_report_${reportId.slice(0, 8)}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  },
}
