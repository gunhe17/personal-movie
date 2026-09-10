import { deleteResource, get, patch, post } from '$lib/services/api/instances'
import type { Action } from '$lib/types/apiResponse'

export type RoomItemType = {
  id: string
  name: string
  is_active: boolean
  thumbnail_url: string
  description: string
  memo: string
}

// HTTP-Only 쿠키 환경: 모든 요청은 /api/proxy를 통해 프록시됨
// instances.ts에서 baseURL이 '/api/proxy'로 설정됨

export const postCreateRoom = () => ({
  key: ['postCreateRoom'],
  request: async (request: any) => {
    const { center_id, ...rest } = request
    const response = await post<any>(`/centers/${center_id}/rooms`, rest)
    return response
  }
})

export const getRoomList = (): Action<RoomItemType[], RoomItemType[]> => ({
  key: ['getRoomList'],
  request: async (req: { center_id: string; active_only?: boolean }) => {
    const { center_id: centerId, active_only } = req
    if (!centerId) return []
    const params = active_only ? '?active_only=true' : ''
    const response = await get<RoomItemType[]>(`/centers/${centerId}/rooms${params}`)
    return response
  }
})

export const getRoomDetail = () => ({
  key: ['getRoomDetail'],
  request: async (room_id: string) => {
    const response = await get<any>(`/room/${room_id}`)
    return response
  }
})

export const patchModifyRoom = () => ({
  key: ['patchModifyRoom'],
  request: async (request: any) => {
    const { room_id, center_id, ...req } = request
    const response = await patch(`/centers/${center_id}/rooms/${room_id}`, req)
    return response
  }
})

export const deleteRoom = () => ({
  key: ['deleteRoom'],
  request: async (request: any) => {
    const { room_id, center_id } = request
    const response = await deleteResource(`/centers/${center_id}/rooms/${room_id}`)
    return response
  }
})

export const patchToggleRoom = () => ({
  key: ['patchToggleRoom'],
  request: async (request: any) => {
    const { center_id, room_id, is_active } = request
    const response = await patch(`/centers/${center_id}/rooms/${room_id}`, { is_active })
    return response
  }
})
