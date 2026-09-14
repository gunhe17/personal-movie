/**
 * 제출 서류 파생 API 액션
 *
 * 확정된 상담 일지를 그 내담자의 바우처에 걸린 양식으로 옮긴다. 값이 채워진 양식 인스턴스가
 * 함께 태어나고(`content.instance_id`), 상담사는 그 인스턴스를 열어 손보고 제출한다.
 * 양식을 '설계'하는 AI 초안(form/template)과 다른 물건이다 — 이쪽은 이미 있는 칸을 채운다.
 */

import { get, post } from '$lib/services/api/instances'

export interface NoteDerivationContent {
  template_id: string
  template_name: string
  instance_id: string
  client_voucher_id: string
  /** 필드키 → 채워진 값 */
  values: Record<string, string | number>
}

export interface CounselingNoteDerivation {
  id: string
  center_id: string
  counseling_note_id: string
  counseling_session_id: string
  client_id: string
  author_id: string
  llm_call_id: string | null
  status: 'draft' | 'published'
  /** 제출 서류 종류 — 기록지·보고서 등 */
  kind: string
  content: NoteDerivationContent
  created_at: string
  updated_at: string
}

export const getNoteDerivations = () => ({
  key: ['getNoteDerivations'],
  request: async (params: {
    centerId: string | null | undefined
    sessionId: string
  }) => {
    if (!params.centerId || !params.sessionId) return []
    return get<CounselingNoteDerivation[]>(
      `/centers/${params.centerId}/counseling/sessions/${params.sessionId}/note-derivations`
    )
  }
})

export const postDeriveSubmissionForm = () => ({
  key: ['postDeriveSubmissionForm'],
  request: async (params: {
    centerId: string
    sessionId: string
    clientId: string
    kind?: string
  }) =>
    post<CounselingNoteDerivation>(
      `/centers/${params.centerId}/counseling/sessions/${params.sessionId}/note-derivations`,
      { client_id: params.clientId, kind: params.kind ?? null }
    )
})
