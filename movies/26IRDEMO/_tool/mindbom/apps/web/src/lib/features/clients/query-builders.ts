import { get, post, patch, deleteResource } from '$lib/services/api/instances'
import type { Action } from '$lib/types/apiResponse'
import type { ClientListResponse, ClientDetail, ClientFormData } from './types'

export function getClientList(): Action<ClientListResponse, ClientListResponse> {
  return {
    key: ['getClientList'],
    request: async (params?: {
      institutionId: string
      page?: number
      size?: number
      search?: string
      status?: string
      gender?: string
    }) => {
      if (!params?.institutionId) {
        return { items: [], total: 0, page: 1, size: 20, pages: 1 }
      }
      const query = new URLSearchParams()
      if (params.page) query.set('page', String(params.page))
      if (params.size) query.set('size', String(params.size))
      if (params.search) query.set('search', params.search)
      if (params.status) query.set('status', params.status)
      if (params.gender) query.set('gender', params.gender)

      const qs = query.toString()
      const url = `/institutions/${params.institutionId}/clients${qs ? `?${qs}` : ''}`
      return await get<ClientListResponse>(url)
    }
  }
}

export function createClient(): Action<ClientDetail> {
  return {
    key: ['getClientList'],
    request: async (params?: {
      institutionId: string
      payload: ClientFormData
    }) => {
      if (!params?.institutionId) throw new Error('institutionId is required')
      const result = await post<ClientDetail>(
        `/institutions/${params.institutionId}/clients`,
        params.payload
      )
      return result
    }
  }
}

export function updateClient(): Action<ClientDetail> {
  return {
    key: ['getClientList'],
    request: async (params?: {
      institutionId: string
      clientId: string
      payload: Partial<ClientFormData> & { status?: string }
    }) => {
      if (!params?.institutionId || !params?.clientId)
        throw new Error('institutionId and clientId are required')
      return await patch<ClientDetail>(
        `/institutions/${params.institutionId}/clients/${params.clientId}`,
        params.payload
      )
    }
  }
}

export function deleteClient(): Action<void> {
  return {
    key: ['getClientList'],
    request: async (params?: {
      institutionId: string
      clientId: string
    }) => {
      if (!params?.institutionId || !params?.clientId)
        throw new Error('institutionId and clientId are required')
      return await deleteResource<void>(
        `/institutions/${params.institutionId}/clients/${params.clientId}`
      )
    }
  }
}
