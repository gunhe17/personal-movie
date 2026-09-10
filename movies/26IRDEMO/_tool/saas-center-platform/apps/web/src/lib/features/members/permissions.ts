import type { Permission, PermissionRule } from '$lib/types/permissions'

/**
 * 구성원(member) 도메인 권한 — API 권한 코드와 동일하게 사용
 * - read: 구성원 목록/상세 조회 (read:member)
 * - invite: 초대 (write:member_invitation)
 * - modify: 본인 수정 (write:member → /me/member)
 * - updateSchedule: 근무/비근무 시간 수정 (write:member)
 */
export const MEMBER_PERMISSIONS = {
	invite: 'write:member_invitation',
	modify: 'write:member',
	read: 'read:member',
	updateSchedule: 'write:member',
	delete: 'delete:member'
} as const satisfies Record<string, Permission>

/** 구성원 페이지 접근 권한 — read:member 이상 필요 */
export const MEMBER_PAGE_ACCESS_RULE: PermissionRule = {
	any: ['read:member']
}

export type MemberPermissionKey = keyof typeof MEMBER_PERMISSIONS
