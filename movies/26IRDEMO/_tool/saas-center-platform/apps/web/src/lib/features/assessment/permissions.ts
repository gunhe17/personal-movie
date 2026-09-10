import type { Permission } from '$lib/types/permissions'

/**
 * 검사(assessment) 도메인 권한 — 서버 API 권한 코드
 */
export const ASSESSMENT_PERMISSIONS = {
	read: 'read:assessment_case',
	write: 'write:assessment_case',
	delete: 'delete:assessment_case'
} as const satisfies Record<string, Permission>

// 접수/예약/케이스 수정·취소 API는 write:assessment_case를 요구합니다.
export const ASSESSMENT_CREATE_RULE = { any: ['write:assessment_case'] as const }
// 삭제 계열은 write 또는 delete 권한으로 통과시킵니다(서버 API별 요구사항 차이 보정).
export const ASSESSMENT_DELETE_RULE = { any: ['write:assessment_case', 'delete:assessment_case'] as const }
export const ASSESSMENT_READ_RULE = { any: ['read:assessment_case'] as const }
