import type { TransmissionMethod, TransmissionStatus, TransmissionType } from '$lib/hooks/actions/transmission.action'

export type TabType = TransmissionType
export type SortOrder = 'asc' | 'desc'

export interface SelectOption<T extends string = string> {
	value: T
	title: string
}

export const DEFAULT_PAGE_SIZE = 10
export const SEARCH_DEBOUNCE_DELAY = 300

// 탭 옵션
export const tabOptions: SelectOption<TabType>[] = [
	{ value: 'direct-link', title: '바로 링크' },
	{ value: 'test-result', title: '검사 결과' }
]

// 정렬 옵션
export const sortOptions: SelectOption<SortOrder>[] = [
	{ value: 'desc', title: '등록순' },
	{ value: 'asc', title: '오래된순' }
]

// 전송 방식 라벨
export const METHOD_LABELS: Record<TransmissionMethod, string> = {
	kakao: '카카오톡',
	email: '이메일',
	sms: '문자'
}

// 전송 상태 라벨
export const STATUS_LABELS: Record<TransmissionStatus, string> = {
	completed: '전송 완료',
	failed: '전송 실패',
	expired: '링크만료'
}

// 전송 상태 색상
export const STATUS_COLORS: Record<TransmissionStatus, string> = {
	completed: 'text-gray-700',
	failed: 'text-red-500',
	expired: 'text-gray-400'
}

// 페이지 사이즈 옵션
export const pageSizeOptions: SelectOption<string>[] = [
	{ value: '6', title: '6' },
	{ value: '10', title: '10' },
	{ value: '20', title: '20' },
	{ value: '50', title: '50' }
]
