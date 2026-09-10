import type { Permission } from '$lib/types/permissions'

/**
 * 상담(counseling) 도메인 권한 — 서버 API 권한 코드
 */
export const COUNSELING_PERMISSIONS = {
	read: 'read:counseling',
	write: 'write:counseling',
	delete: 'delete:counseling'
} as const satisfies Record<string, Permission>

export const COUNSELING_CREATE_RULE = { any: ['write:counseling'] as const }
export const COUNSELING_DELETE_RULE = { any: ['delete:counseling'] as const }
