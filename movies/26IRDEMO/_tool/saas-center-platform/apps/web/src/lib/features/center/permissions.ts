import type { Permission } from '$lib/types/permissions'

/**
 * 센터(center) 도메인 권한 — 서버 API 권한 코드
 * 센터 정보, 상담실, 프로그램 관리 등
 */
export const CENTER_PERMISSIONS = {
	read: 'read:center',
	write: 'write:center'
} as const satisfies Record<string, Permission>

export const CENTER_EDIT_RULE = { any: ['write:center'] as const }
export const CENTER_MANAGE_ROOM_RULE = { any: ['write:room'] as const }
export const CENTER_PROGRAM_MANAGE_RULE = { any: ['write:program'] as const }

/** 센터 관리 페이지 접근 권한 — read:center 이상 필요 */
export const CENTER_PAGE_ACCESS_RULE = { any: ['read:center'] as const }
