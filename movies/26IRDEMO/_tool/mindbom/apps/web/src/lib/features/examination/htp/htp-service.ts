import { get, postRaw, put, patch, appInstance } from '$lib/services/api/instances'
import type { HTPDrawing, HTPFullResults, HTPInterpretation } from './types'

function base(instId: string, examId: string) {
  return `/institutions/${instId}/examinations/${examId}/htp`
}

export const htpService = {
  /** HTP 검사 시작 - 4개 Drawing 초기화 */
  initializeDrawings: (instId: string, examId: string) =>
    postRaw<HTPDrawing[]>(`${base(instId, examId)}/drawings/initialize`),

  /** Drawing 목록 조회 */
  listDrawings: (instId: string, examId: string) =>
    get<HTPDrawing[]>(`${base(instId, examId)}/drawings`),

  /** Drawing 수정 (PDI 등) */
  updateDrawing: (instId: string, examId: string, drawingId: string, data: object) =>
    put(`${base(instId, examId)}/drawings/${drawingId}`, data),

  /** Drawing 이미지 업로드 */
  uploadImage: async (instId: string, examId: string, drawingId: string, file: File) => {
    const formData = new FormData()
    formData.append('image', file)
    const res = await appInstance.put<HTPDrawing>(
      `${base(instId, examId)}/drawings/${drawingId}/image`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    )
    return res.data
  },

  /** AI 분석 실행 */
  analyze: (instId: string, examId: string, drawingIds?: string[]) =>
    postRaw<HTPFullResults>(`${base(instId, examId)}/analyze`, {
      drawing_ids: drawingIds ?? null,
    }),

  /**
   * 재해석 — 수정된 BBox로 해석만 다시 생성 (재탐지 없음).
   *
   * 해석 API가 이미지가 아니라 좌표를 받기 때문에 가능하다. 임상가가 박스를
   * 옮긴 결과가 조건(크다/작다)과 해석 문장에 반영되는 유일한 경로다.
   */
  reinterpret: (instId: string, examId: string) =>
    postRaw<HTPFullResults>(`${base(instId, examId)}/reinterpret`),

  /** 전체 결과 조회 */
  getResults: (instId: string, examId: string) =>
    get<HTPFullResults>(`${base(instId, examId)}/results`),

  /** 결과 부분 수정 (임상가 편집) */
  updateResults: (instId: string, examId: string, data: object) =>
    patch(`${base(instId, examId)}/results`, data),

  /** 중요 소견 토글 */
  toggleImportant: (
    instId: string,
    examId: string,
    interpretationId: string,
    isImportant: boolean
  ) =>
    postRaw<HTPInterpretation>(
      `${base(instId, examId)}/interpretations/toggle-important`,
      { interpretation_id: interpretationId, is_important: isImportant }
    ),

  /** 보고서 PDF 다운로드 */
  downloadReportPdf: async (instId: string, examId: string) => {
    const res = await appInstance.get(`${base(instId, examId)}/report/pdf`, {
      responseType: 'blob',
    })
    const blob = new Blob([res.data], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `htp_report_${examId.slice(0, 8)}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  },
}
