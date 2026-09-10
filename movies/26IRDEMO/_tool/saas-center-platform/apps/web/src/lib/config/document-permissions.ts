import type { Permission } from '$lib/types/permissions'

/**
 * 문서(document) 도메인 권한 — 보고서 조회/작성, 공지 등
 * 서버 API 권한 코드
 */
export const DOCUMENT_PERMISSIONS = {
	read: 'read:document',
	write: 'write:document',
	delete: 'delete:document'
} as const satisfies Record<string, Permission>

/** 보고서 조회 (AI 보고서 링크 등) */
export const DOCUMENT_READ_RULE = { any: ['read:document'] as const }
/** 보고서 작성/심화 설계 */
export const DOCUMENT_WRITE_RULE = { any: ['write:document'] as const }
