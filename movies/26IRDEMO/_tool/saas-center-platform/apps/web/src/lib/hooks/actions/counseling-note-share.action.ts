/**
 * 회기 공유문 API 액션
 *
 * 상담 일지(임상 기록)를 보호자·본인이 읽을 톤으로 옮긴 글. 생성만으로는 앱에 보이지 않고,
 * 발행(publish)해야 내담자 앱에 노출된다.
 */

import { get, patch, post } from '$lib/services/api/instances'

export type ShareAudience = 'guardian' | 'self'
export type ShareStatus = 'draft' | 'published'

export interface NoteShareContent {
  /** 전달문 본문 — 문단은 줄바꿈 두 번 */
  text: string | null
}

export interface CounselingNoteShare {
  id: string
  center_id: string
  counseling_session_id: string
  client_id: string
  counseling_note_id: string | null
  author_id: string
  llm_call_id: string | null
  audience: ShareAudience
  status: ShareStatus
  content: Partial<NoteShareContent>
  /** AI 초안을 상담사가 손봤는지 */
  is_edited: boolean
  /** 공유문 본문에서 감지된 민감 표현 분류 — 발행 직전 고지용(차단 아님) */
  sensitive_categories: string[]
  published_at: string | null
  created_at: string
  updated_at: string
}

export const getNoteShares = () => ({
  key: ['getNoteShares'],
  request: async (params: {
    centerId: string | null | undefined
    sessionId: string
  }) => {
    if (!params.centerId || !params.sessionId) return []
    return get<CounselingNoteShare[]>(
      `/centers/${params.centerId}/counseling/sessions/${params.sessionId}/note-shares`
    )
  }
})

export const postGenerateNoteShare = () => ({
  key: ['postGenerateNoteShare'],
  request: async (params: {
    centerId: string
    sessionId: string
    clientId: string
    audience?: ShareAudience
  }) =>
    post<CounselingNoteShare>(
      `/centers/${params.centerId}/counseling/sessions/${params.sessionId}/note-shares/generate`,
      { client_id: params.clientId, audience: params.audience ?? null }
    )
})

export const patchNoteShare = () => ({
  key: ['patchNoteShare'],
  request: async (params: {
    centerId: string
    shareId: string
    content: NoteShareContent
  }) =>
    patch<CounselingNoteShare>(
      `/centers/${params.centerId}/counseling/note-shares/${params.shareId}`,
      { content: params.content }
    )
})

export const postSetNoteSharePublished = () => ({
  key: ['postSetNoteSharePublished'],
  request: async (params: {
    centerId: string
    shareId: string
    published: boolean
  }) =>
    post<CounselingNoteShare>(
      `/centers/${params.centerId}/counseling/note-shares/${params.shareId}/${
        params.published ? 'publish' : 'unpublish'
      }`,
      {}
    )
})
