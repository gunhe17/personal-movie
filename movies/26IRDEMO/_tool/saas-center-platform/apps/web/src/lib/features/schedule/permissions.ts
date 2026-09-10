import type { Permission } from '$lib/types/permissions'

/**
 * 일정(schedule) 도메인 권한 — 서버 API 권한 코드
 */
export const SCHEDULE_PERMISSIONS = {
	read: 'read:schedule',
	write: 'write:schedule',
	delete: 'delete:schedule'
} as const satisfies Record<string, Permission>

export const SCHEDULE_CREATE_RULE = { any: ['write:schedule'] as const }
export const SCHEDULE_READ_RULE = { any: ['read:schedule'] as const }
