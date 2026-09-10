import type { Permission } from '$lib/types/permissions'

/**
 * 내담자(client) 도메인 권한 — 서버 API 권한 코드
 */
export const CLIENT_PERMISSIONS = {
	read: 'read:client',
	write: 'write:client',
	delete: 'delete:client'
} as const satisfies Record<string, Permission>

export const CLIENT_CREATE_RULE = { any: ['write:client'] as const }
export const CLIENT_DELETE_RULE = { any: ['delete:client'] as const }
export const CLIENT_READ_RULE = { any: ['read:client'] as const }
