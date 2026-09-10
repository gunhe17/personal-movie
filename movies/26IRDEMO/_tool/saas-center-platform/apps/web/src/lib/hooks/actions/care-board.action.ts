import { deleteResource, get, patch, post } from '$lib/services/api/instances'

export type CareBoardKind =
  | 'counseling'
  | 'assessment'
  | 'fieldnote'
  | 'document'
  | 'voucher'
  | 'memo'
  | 'handover'

export interface CareBoardStreamRow {
  id: string
  kind: CareBoardKind | string
  occurred_at: string
  source_table: string
  source_id: string
  case_id: string | null
  actor_id: string | null
  actor_name: string | null
  share_class: string
  title: string | null
  subtitle: string | null
  body: string | null
  meta: string | null
  pinned: boolean
  pinned_at: string | null
  pinned_by: string | null
  pinned_by_name: string | null
  source_deleted_at: string | null
}

export interface CareBoardStreamResponse {
  rows: CareBoardStreamRow[]
  next_cursor: string | null
  pinned: CareBoardStreamRow[]
  unread_count: number
  last_seen_at: string | null
}

const base = (centerId: string, clientId: string) =>
  `/centers/${centerId}/clients/${clientId}/care-board`

export const getCareBoardStream = () => ({
  key: ['getCareBoardStream'],
  request: async (params: {
    centerId: string
    clientId: string
    kinds?: string[]
    cursor?: string | null
    limit?: number
  }) => {
    if (!params?.centerId || !params?.clientId) return {} as any
    const query = new URLSearchParams()
    for (const kind of params.kinds ?? []) query.append('kinds', kind)
    if (params.cursor) query.set('cursor', params.cursor)
    if (params.limit) query.set('limit', String(params.limit))
    const suffix = query.toString() ? `?${query}` : ''
    return await get<CareBoardStreamResponse>(
      `${base(params.centerId, params.clientId)}/stream${suffix}`
    )
  }
})

export const postCareBoardRead = () => ({
  // 스트림 키를 쓰지 않는다 — 읽음 표시가 스트림을 무효화하면
  // refetch → 다시 읽음 표시 → refetch 로 도는 루프가 된다
  key: ['postCareBoardRead'],
  request: async (params: { centerId: string; clientId: string }) =>
    await post(`${base(params.centerId, params.clientId)}/read`, {})
})

export const postCareMemo = () => ({
  key: ['getCareBoardStream'],
  request: async (params: {
    centerId: string
    clientId: string
    body: string
  }) =>
    await post(`${base(params.centerId, params.clientId)}/memos`, {
      body: params.body
    })
})

export const patchCareMemo = () => ({
  key: ['getCareBoardStream'],
  request: async (params: {
    centerId: string
    clientId: string
    memoId: string
    body: string
  }) =>
    await patch(
      `${base(params.centerId, params.clientId)}/memos/${params.memoId}`,
      { body: params.body }
    )
})

export const deleteCareMemo = () => ({
  key: ['getCareBoardStream'],
  request: async (params: {
    centerId: string
    clientId: string
    memoId: string
  }) =>
    await deleteResource(
      `${base(params.centerId, params.clientId)}/memos/${params.memoId}`
    )
})

export const postCareBoardPin = () => ({
  key: ['getCareBoardStream'],
  request: async (params: {
    centerId: string
    clientId: string
    entryId: string
    pinned: boolean
  }) =>
    await post(
      `${base(params.centerId, params.clientId)}/entries/${params.entryId}/pin?pinned=${params.pinned}`,
      {}
    )
})
