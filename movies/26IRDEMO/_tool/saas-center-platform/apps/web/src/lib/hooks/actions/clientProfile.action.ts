/**
 * Client Profile Actions
 * 내담자/보호자 프로필 관련 API action 함수들
 *
 * 모든 요청은 instances (baseURL /api/proxy)를 통해 프록시됨
 */

import { get, post, put, deleteResource } from '$lib/services/api/instances'
import type { Action } from '$lib/types/apiResponse'

// ============================================================
// 타입 정의
// ============================================================

export interface ClientProfileResponse {
	id: string
	center_id: string
	person_id: string
	role: string
	name: string
	birth_date: string
	gender: string
	phone: string
	email: string
	address: string
	status: string
	memo: string
	deleted_at: string | null
	created_at: string
	updated_at: string
}

export interface ClientProfileItem {
	id: string
	name: string
	role: string
	phone: string
	status: string
}

export interface ClientProfileListResponse {
	items: ClientProfileItem[]
	total: number
	page: number
	size: number
	pages: number
}

export interface GetClientProfileListParams {
	centerId: string
	skip?: number
	limit?: number
	role?: 'client' | 'guardian' | 'both' | null
	status?: 'active' | 'inactive' | 'archived' | null
}

export interface CreateClientProfileParams {
	centerId: string
	name: string
	birth_date: string
	gender: string
	phone: string
	role: string
	status: string
	address?: string
	memo?: string
}

// 배치 등록 관련 타입
export interface BatchChildInput {
	name: string
	birth_date: string
	gender: string
}

export interface BatchGuardianInput {
	name: string
	phone: string
	relation_type: string
	is_primary: boolean
}

export interface CreateClientBatchParams {
	centerId: string
	children: BatchChildInput[]
	guardians: BatchGuardianInput[]
}

export interface UpdateClientProfileParams {
	centerId: string
	clientId: string
	phone?: string
	email?: string
	address?: string
	memo?: string
}

export interface GetClientProfileDetailParams {
	centerId: string
	clientId: string
}

export interface DeleteClientProfileParams {
	centerId: string
	clientId: string
}

export interface ClientBatchResponse {
	guardians: ClientProfileResponse[]
	children: ClientProfileResponse[]
	relations: {
		client_relations: number
		sibling_relations: number
	}
}

// ============================================================
// 내담자/보호자 상세 조회
// GET /api/proxy/centers/{center_id}/clients/{client_id}
// ============================================================

export const getClientProfileDetail = (): Action<ClientProfileResponse, ClientProfileResponse> => ({
	key: ['getClientProfileDetail'],
	request: async (params: GetClientProfileDetailParams): Promise<ClientProfileResponse> => {
		if (!params.centerId || !params.clientId) {
			return {} as ClientProfileResponse
		}
		return get<ClientProfileResponse>(
			`/centers/${params.centerId}/clients/${params.clientId}`
		)
	}
})

// ============================================================
// 내담자/보호자 목록 조회
// GET /api/proxy/centers/{center_id}/clients
// ============================================================

export const getClientProfileList = (): Action<ClientProfileListResponse, ClientProfileListResponse> => ({
	key: ['getClientProfileList'],
	request: async (params: GetClientProfileListParams): Promise<ClientProfileListResponse> => {
		if (!params.centerId) {
			return { items: [], total: 0, page: 0, size: 0, pages: 0 }
		}

		const query: Record<string, string | number> = {}
		if (params.skip !== undefined) query.skip = params.skip
		if (params.limit !== undefined) query.limit = params.limit
		if (params.role) query.role = params.role
		if (params.status) query.status = params.status

		return get<ClientProfileListResponse>(
			`/centers/${params.centerId}/clients`,
			query
		)
	}
})

// ============================================================
// 내담자/보호자 생성
// POST /api/proxy/centers/{center_id}/clients
// ============================================================

export const createClientProfile = () => ({
	key: ['createClientProfile', 'getClientProfileList'],
	request: async (params: CreateClientProfileParams): Promise<ClientProfileResponse> => {
		const res = await post<ClientProfileResponse>(
			`/centers/${params.centerId}/clients`,
			{
				name: params.name,
				birth_date: params.birth_date,
				gender: params.gender,
				phone: params.phone,
				role: params.role,
				status: params.status,
				address: params.address || '',
				memo: params.memo || ''
			}
		)
		return (res as { data?: ClientProfileResponse }).data ?? (res as unknown as ClientProfileResponse)
	}
})

// ============================================================
// 내담자/보호자 수정
// PUT /api/proxy/centers/{center_id}/clients/{client_id}
// ============================================================

export const updateClientProfile = () => ({
	key: ['updateClientProfile', 'getClientProfileList'],
	request: async (params: UpdateClientProfileParams): Promise<ClientProfileResponse> => {
		const body: Record<string, string> = {}
		if (params.phone !== undefined) body.phone = params.phone
		if (params.email !== undefined) body.email = params.email
		if (params.address !== undefined) body.address = params.address
		if (params.memo !== undefined) body.memo = params.memo

		const res = await put<ClientProfileResponse>(
			`/centers/${params.centerId}/clients/${params.clientId}`,
			body
		)
		return (res as { data?: ClientProfileResponse }).data ?? (res as unknown as ClientProfileResponse)
	}
})

// ============================================================
// 내담자/보호자 삭제 (소프트 삭제)
// DELETE /api/proxy/centers/{center_id}/clients/{client_id}
// ============================================================

export const deleteClientProfile = () => ({
	key: ['deleteClientProfile', 'getClientProfileList'],
	request: async (params: DeleteClientProfileParams): Promise<ClientProfileResponse> => {
		const res = await deleteResource<ClientProfileResponse>(
			`/centers/${params.centerId}/clients/${params.clientId}`
		)
		return (res as { data?: ClientProfileResponse }).data ?? (res as unknown as ClientProfileResponse)
	}
})

// ============================================================
// 배치 등록 (보호자 + 자녀 동시)
// POST /api/proxy/centers/{center_id}/clients/batch
// ============================================================

export const createClientBatch = () => ({
	key: ['createClientBatch', 'getClientProfileList'],
	request: async (params: CreateClientBatchParams): Promise<ClientBatchResponse> => {
		const res = await post<ClientBatchResponse>(
			`/centers/${params.centerId}/clients/batch`,
			{
				children: params.children,
				guardians: params.guardians
			}
		)
		return (res as { data?: ClientBatchResponse }).data ?? (res as unknown as ClientBatchResponse)
	}
})
