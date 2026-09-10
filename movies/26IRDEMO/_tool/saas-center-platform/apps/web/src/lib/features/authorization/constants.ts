/** 카테고리별 표시 라벨 및 정렬 순서 */
export const CATEGORY_CONFIG: Record<string, { label: string; order: number }> = {
	client: { label: '내담자', order: 1 },
	counseling: { label: '상담', order: 2 },
	counseling_note: { label: '상담노트', order: 3 },
	assessment: { label: '검사', order: 4 },
	center_assessment: { label: '검사 설정', order: 5 },
	send_link: { label: '바로링크', order: 6 },
	schedule: { label: '일정', order: 7 },
	document: { label: '문서', order: 8 },
	form: { label: '양식', order: 9 },
	form_template: { label: '양식 관리', order: 10 },
	member: { label: '구성원', order: 11 },
	center: { label: '센터', order: 12 },
	program: { label: '프로그램', order: 13 },
	room: { label: '장소', order: 14 },
	role: { label: '역할', order: 15 },
	notice: { label: '공지사항', order: 16 },
	billing: { label: '청구', order: 17 }
} as const

/** 카테고리를 섹션으로 그룹핑 (레퍼런스 디자인: 섹션별 헤더 반복) */
export const CATEGORY_GROUPS = [
	{
		label: '상담 · 검사 관리',
		categories: ['client', 'counseling', 'counseling_note', 'assessment', 'center_assessment', 'send_link']
	},
	{ label: '운영 관리', categories: ['schedule', 'document', 'form', 'form_template', 'billing'] },
	{ label: '센터 관리', categories: ['member', 'center', 'program', 'room', 'role', 'notice'] }
] as const

/** 역할 코드 (ADMIN은 왕관 아이콘 표시 등 특수 처리용) */
export const ROLE_CODES = {
	ADMIN: 'ADMIN',
	MANAGER: 'MANAGER',
	STAFF: 'STAFF',
	COUNSELOR: 'COUNSELOR'
} as const

/** 역할별 뱃지 스타일 (멤버 페이지 패턴 재사용) */
export const ROLE_STYLES: Record<string, { bg: string; text: string }> = {
	ADMIN: { bg: 'bg-[#FFE58733]', text: 'text-[#FFB200]' },
	MANAGER: { bg: 'bg-[#1BBF570F]', text: 'text-[#1BBF57]' },
	STAFF: { bg: 'bg-gray-100', text: 'text-gray-700' },
	COUNSELOR: { bg: 'bg-gray-100', text: 'text-gray-700' }
}
