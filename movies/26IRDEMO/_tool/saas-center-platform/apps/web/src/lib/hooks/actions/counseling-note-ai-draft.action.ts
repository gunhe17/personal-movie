/**
 * AI 상담일지 초안 이력 API 액션
 *
 * 필드노트에서 생성한 일지 초안의 이력. 크레딧이 차감된 산출물이라 보관·열람 대상이다.
 */

import { get } from '$lib/services/api/instances'

export interface CounselingNoteAiDraft {
  id: string
  counseling_session_id: string
  field_note_id: string
  /** 서식(template_type)에 따라 키가 달라진다 — 화면에서 동적으로 렌더 */
  content: Record<string, unknown>
  summary: string | null
  template_type: string
  llm_call_id: string | null
  author_id: string
  created_at: string
}

export const getCounselingNoteAiDrafts = () => ({
  key: ['getCounselingNoteAiDrafts'],
  request: async (params: {
    centerId: string | null | undefined
    sessionId: string
  }) => {
    if (!params.centerId || !params.sessionId) return []
    return get<CounselingNoteAiDraft[]>(
      `/centers/${params.centerId}/counseling/sessions/${params.sessionId}/ai-drafts`
    )
  }
})
