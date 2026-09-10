import { deleteResource, get, patch, post, put } from '$lib/services/api/instances'

// ===== Types =====

export type RoleSummary = {
	id: string
	code: string
	name: string
	is_preset?: boolean
	member_count?: number
	access_level?: string
}

export type PermissionSummary = {
	id: number
	code: string
	name: string
	category: string
}

export type RolePermissionsResponse = {
	role_id?: string
	role_code: string
	role_name: string
	access_level: string
	permissions: PermissionSummary[]
}

export type RoleCreateRequest = {
	centerId: string
	name: string
	description?: string | null
	permission_ids: number[]
	access_level: string
}

export type RoleUpdateRequest = {
	centerId: string
	roleCode: string
	name?: string
	description?: string | null
	permission_ids: number[]
	access_level?: string
}

export type RoleDeleteRequest = {
	centerId: string
	roleCode: string
}

export type RoleMemberSummary = {
	id: string
	name: string
	email: string | null
	last_login_at: string | null
	is_active: boolean
}

export type RoleMembersResponse = {
	items: RoleMemberSummary[]
	total: number
	page: number
	size: number
	pages: number
}

export type GetRoleMembersRequest = {
	centerId: string
	roleCode: string
	page?: number
	size?: number
	search?: string
}

export type BatchAssignRoleMembersRequest = {
	centerId: string
	roleCode: string
	member_ids: string[]
}

export type BatchAssignRoleMembersResponse = {
	changed_count: number
	results: Array<{
		member_id: string
		previous_role_code: string
		previous_role_name: string
		new_role_code: string
		new_role_name: string
		person_name: string
	}>
}

// ===== Actions =====

// HTTP-Only 쿠키 환경: 모든 요청은 /api/proxy를 통해 프록시됨
// instances.ts에서 baseURL이 '/api/proxy'로 설정됨

/** 센터별 역할 목록 조회 */
export const getCenterRoles = () => ({
	key: ['getCenterRoles'],
	request: async (req: { centerId: string }) => {
		const centerId = req.centerId
		if (!centerId) return []
		const response = await get<RoleSummary[]>(`/centers/${centerId}/roles`)
		return response
	}
})

/** 전체 권한 목록 조회 (글로벌) */
export const getAllPermissions = () => ({
	key: ['getAllPermissions'],
	request: async () => {
		const response = await get<PermissionSummary[]>('/role/permissions')
		return response
	}
})

/** 역할별 할당된 권한 조회 */
export const getRolePermissions = () => ({
	key: ['getRolePermissions'],
	request: async (req: { centerId: string; roleCode: string }) => {
		const { centerId, roleCode } = req
		if (!centerId || !roleCode) return null
		const response = await get<RolePermissionsResponse>(
			`/centers/${centerId}/roles/${roleCode}/permissions`
		)
		return response
	}
})

/** 역할 권한 일괄 설정 */
export const putRolePermissions = () => ({
	key: ['putRolePermissions', 'getRolePermissions'],
	request: async (req: { centerId: string; roleCode: string; permission_ids: number[] }) => {
		const { centerId, roleCode, permission_ids } = req
		const response = await put<RolePermissionsResponse>(
			`/centers/${centerId}/roles/${roleCode}/permissions`,
			{ permission_ids }
		)
		return response
	}
})

/** 커스텀 역할 생성 */
export const postCreateRole = () => ({
	key: ['postCreateRole', 'getCenterRoles', 'getRolePermissions'],
	request: async (req: RoleCreateRequest) => {
		const { centerId, ...body } = req
		return await post<RolePermissionsResponse>(`/centers/${centerId}/roles`, body)
	}
})

/** 역할 수정 */
export const patchUpdateRole = () => ({
	key: ['patchUpdateRole', 'getCenterRoles', 'getRolePermissions'],
	request: async (req: RoleUpdateRequest) => {
		const { centerId, roleCode, ...body } = req
		return await patch<RolePermissionsResponse>(`/centers/${centerId}/roles/${roleCode}`, body)
	}
})

/** 역할 삭제 */
export const deleteRole = () => ({
	key: ['deleteRole', 'getCenterRoles', 'getRolePermissions'],
	request: async (req: RoleDeleteRequest) => {
		const { centerId, roleCode } = req
		return await deleteResource<void>(`/centers/${centerId}/roles/${roleCode}`)
	}
})

/** 역할별 구성원 목록 조회 */
export const getRoleMembers = () => ({
	key: ['getRoleMembers'],
	request: async (req: GetRoleMembersRequest) => {
		const { centerId, roleCode, page = 1, size = 20, search } = req
		if (!centerId || !roleCode) {
			return { items: [], total: 0, page: 1, size: 20, pages: 0 } as RoleMembersResponse
		}
		return await get<RoleMembersResponse>(`/centers/${centerId}/roles/${encodeURIComponent(roleCode)}/members`, {
			page,
			size,
			search: search || undefined
		})
	}
})

/** 역할별 구성원 일괄 배정 */
export const postBatchAssignRoleMembers = () => ({
	key: ['postBatchAssignRoleMembers', 'getRoleMembers', 'getMemberList', 'getCenterRoles'],
	request: async (req: BatchAssignRoleMembersRequest) => {
		const { centerId, roleCode, member_ids } = req
		return await post<BatchAssignRoleMembersResponse>(`/centers/${centerId}/roles/${roleCode}/members/batch-assign`, {
			member_ids
		})
	}
})
