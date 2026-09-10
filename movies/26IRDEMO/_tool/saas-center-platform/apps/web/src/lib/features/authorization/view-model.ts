import type { PermissionSummary } from '$lib/hooks/actions/role.action'
import { CATEGORY_CONFIG, ROLE_CODES } from './constants'

// ===== Display Types =====

export interface AssignableMember {
	id: string
	name: string
	email: string
	roleCode: string
	roleName: string
	isActive: boolean
}

export interface RoleChangeItem {
	id: string
	name: string
	fromRoleName: string
	toRoleName: string
}

export interface MemberRowVM {
	id: string
	name: string
	email: string
	isActive: boolean
	lastLoginAt: string | null
}

// ===== Display Helpers =====

export function getRoleDisplayName(role: { code: string; name: string }) {
	if (role.code === ROLE_CODES.ADMIN) return '관리자'
	if (role.code === ROLE_CODES.MANAGER) return '매니저'
	if (role.code === ROLE_CODES.COUNSELOR) return '전문가'
	return role.name
}

export function getRoleDisplayCount(count: number | undefined) {
	if (count === undefined || count === null) return 0
	return count
}

export function getGroupDisplayLabel(label: string) {
	if (label === '상담 · 검사 관리') return '상담 · 검사관리'
	return label
}

export function getCategoryDisplayLabel(label: string) {
	if (label === '내담자') return '내담자 관리'
	return label
}

export function buildCreateRoleCategories(
	baseCategories: AuthCategoryVM[]
): AuthCategoryVM[] {
	return baseCategories.map((cat) => ({
		...cat,
		viewChecked: cat.hasView,
		modifyChecked: false
	}))
}

export function formatMemberDate(value: string | null) {
	if (!value) return '-'
	return value.slice(0, 10)
}

/** 카테고리별 UI 표현 */
export interface AuthCategoryVM {
	category: string
	label: string
	order: number
	/** read 권한 존재 여부 */
	hasView: boolean
	/** write 권한 존재 여부 */
	hasModify: boolean
	/** read 권한 할당 여부 */
	viewChecked: boolean
	/** write+delete 권한 할당 여부 */
	modifyChecked: boolean
	/** 데이터 접근 범위 */
	boundary?: 'all' | 'part'
	/** 각 action별 permission ID (PUT 요청 시 역매핑용) */
	readPermissionId: number | null
	writePermissionId: number | null
	deletePermissionId: number | null
}

/**
 * 전체 권한 + 할당된 권한으로 카테고리별 VM을 빌드
 *
 * Permission code format: "{action}:{resource}" (e.g., "read:client")
 */
export function buildAuthorizationVM(
	allPermissions: PermissionSummary[],
	assignedPermissions: PermissionSummary[]
): AuthCategoryVM[] {
	const assignedCodes = new Set(assignedPermissions.map((p) => p.code))

	// 전체 권한을 category별로 그룹핑, action별로 분류
	const categoryMap = new Map<string, Map<string, PermissionSummary>>()
	for (const perm of allPermissions) {
		const cat = perm.category.toLowerCase()
		if (!categoryMap.has(cat)) {
			categoryMap.set(cat, new Map())
		}
		const [action] = perm.code.split(':')
		categoryMap.get(cat)!.set(action, perm)
	}

	const result: AuthCategoryVM[] = []
	for (const [category, permsMap] of categoryMap) {
		const config = CATEGORY_CONFIG[category]
		if (!config) continue

		const readPerm = permsMap.get('read') ?? null
		const writePerm = permsMap.get('write') ?? null
		const deletePerm = permsMap.get('delete') ?? null

		const viewChecked = readPerm ? assignedCodes.has(readPerm.code) : false
		const writeChecked = writePerm ? assignedCodes.has(writePerm.code) : false
		const deleteChecked = deletePerm ? assignedCodes.has(deletePerm.code) : false

		result.push({
			category,
			label: config.label,
			order: config.order,
			hasView: readPerm !== null,
			hasModify: writePerm !== null,
			viewChecked,
			modifyChecked: writeChecked && (deletePerm ? deleteChecked : true),
			readPermissionId: readPerm?.id ?? null,
			writePermissionId: writePerm?.id ?? null,
			deletePermissionId: deletePerm?.id ?? null
		})
	}

	return result.sort((a, b) => a.order - b.order)
}

/** 섹션 그룹 VM (레퍼런스 디자인의 섹션별 그룹핑) */
export interface AuthGroupVM {
	label: string
	categories: AuthCategoryVM[]
}

/**
 * 카테고리 VM을 섹션 그룹으로 변환
 */
export function groupCategories(
	categories: AuthCategoryVM[],
	groups: readonly { label: string; categories: readonly string[] }[]
): AuthGroupVM[] {
	const catMap = new Map(categories.map((c) => [c.category, c]))
	return groups
		.map((group) => ({
			label: group.label,
			categories: group.categories.map((cat) => catMap.get(cat)).filter(Boolean) as AuthCategoryVM[]
		}))
		.filter((g) => g.categories.length > 0)
}

/**
 * UI 체크 상태를 permission_ids 배열로 역변환 (PUT 요청용)
 */
export function computePermissionIds(categories: AuthCategoryVM[]): number[] {
	const ids: number[] = []
	for (const cat of categories) {
		if (cat.viewChecked && cat.readPermissionId) {
			ids.push(cat.readPermissionId)
		}
		if (cat.modifyChecked) {
			if (cat.writePermissionId) ids.push(cat.writePermissionId)
			if (cat.deletePermissionId) ids.push(cat.deletePermissionId)
		}
	}
	return ids
}
