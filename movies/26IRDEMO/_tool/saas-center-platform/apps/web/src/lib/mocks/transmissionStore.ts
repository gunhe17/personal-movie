import type { PaginationRes } from '$lib/types/apiResponse'

// 전송 방식 타입
export type TransmissionMethod = 'kakao' | 'email' | 'sms'

// 전송 상태 타입
export type TransmissionStatus = 'completed' | 'failed' | 'expired'

// 전송 타입 (탭 구분)
export type TransmissionType = 'direct-link' | 'test-result'

// 전송 내역 데이터 타입
export interface TransmissionData {
	uid: string
	sentAt: string // ISO datetime
	method: TransmissionMethod
	type: TransmissionType

	// 내담자 정보
	clientName: string
	clientCode: string
	clientBirthDate: string
	clientAge: number

	// 수신인 정보
	recipientRelation: string
	recipientName: string
	recipientPhone: string

	// 검사 정보
	assessmentName: string
	status: TransmissionStatus

	// 메타
	createdAt: string
}

// 날짜 헬퍼 함수
const daysAgo = (days: number) => {
	const date = new Date()
	date.setDate(date.getDate() - days)
	return date.toISOString()
}

const formatDateTime = (isoString: string) => {
	const date = new Date(isoString)
	const yyyy = date.getFullYear()
	const mm = String(date.getMonth() + 1).padStart(2, '0')
	const dd = String(date.getDate()).padStart(2, '0')
	const hh = String(date.getHours()).padStart(2, '0')
	const min = String(date.getMinutes()).padStart(2, '0')
	const ss = String(date.getSeconds()).padStart(2, '0')
	return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`
}

// Mock 데이터
const baseTransmissions: TransmissionData[] = [
	// ========== 바로 링크 (direct-link) ==========
	{
		uid: 'trans-001',
		sentAt: daysAgo(0),
		method: 'kakao',
		type: 'direct-link',
		clientName: '김은서',
		clientCode: '0123AB',
		clientBirthDate: '2018-01-12',
		clientAge: 12,
		recipientRelation: '엄마',
		recipientName: '이은지',
		recipientPhone: '010-1234-5678',
		assessmentName: '스마트폰 어쩌구',
		status: 'completed',
		createdAt: daysAgo(0)
	},
	{
		uid: 'trans-002',
		sentAt: daysAgo(0),
		method: 'kakao',
		type: 'direct-link',
		clientName: '김은서',
		clientCode: '0123AB',
		clientBirthDate: '2018-01-12',
		clientAge: 12,
		recipientRelation: '엄마',
		recipientName: '이은지',
		recipientPhone: '010-1234-5678',
		assessmentName: '스마트폰 어쩌구',
		status: 'failed',
		createdAt: daysAgo(0)
	},
	{
		uid: 'trans-003',
		sentAt: daysAgo(1),
		method: 'email',
		type: 'direct-link',
		clientName: '김은서',
		clientCode: '0123AB',
		clientBirthDate: '2018-01-12',
		clientAge: 12,
		recipientRelation: '엄마',
		recipientName: '이은지',
		recipientPhone: '010-1234-5678',
		assessmentName: '스마트폰 어쩌구',
		status: 'completed',
		createdAt: daysAgo(1)
	},
	{
		uid: 'trans-004',
		sentAt: daysAgo(2),
		method: 'sms',
		type: 'direct-link',
		clientName: '김은서',
		clientCode: '0123AB',
		clientBirthDate: '2018-01-12',
		clientAge: 12,
		recipientRelation: '엄마',
		recipientName: '이은지',
		recipientPhone: '010-1234-5678',
		assessmentName: '스마트폰 어쩌구',
		status: 'expired',
		createdAt: daysAgo(2)
	},
	{
		uid: 'trans-005',
		sentAt: daysAgo(3),
		method: 'kakao',
		type: 'direct-link',
		clientName: '박민준',
		clientCode: '0456CD',
		clientBirthDate: '2015-05-20',
		clientAge: 10,
		recipientRelation: '아빠',
		recipientName: '박철수',
		recipientPhone: '010-2345-6789',
		assessmentName: 'K-WISC-V',
		status: 'completed',
		createdAt: daysAgo(3)
	},
	{
		uid: 'trans-006',
		sentAt: daysAgo(4),
		method: 'kakao',
		type: 'direct-link',
		clientName: '이서연',
		clientCode: '0789EF',
		clientBirthDate: '2016-08-15',
		clientAge: 9,
		recipientRelation: '엄마',
		recipientName: '김영희',
		recipientPhone: '010-3456-7890',
		assessmentName: '종합주의력검사',
		status: 'completed',
		createdAt: daysAgo(4)
	},
	{
		uid: 'trans-007',
		sentAt: daysAgo(5),
		method: 'email',
		type: 'direct-link',
		clientName: '최지우',
		clientCode: '1012GH',
		clientBirthDate: '2017-03-25',
		clientAge: 8,
		recipientRelation: '엄마',
		recipientName: '정미영',
		recipientPhone: '010-4567-8901',
		assessmentName: '스마트 바디체커',
		status: 'failed',
		createdAt: daysAgo(5)
	},
	{
		uid: 'trans-008',
		sentAt: daysAgo(6),
		method: 'sms',
		type: 'direct-link',
		clientName: '정현우',
		clientCode: '1345IJ',
		clientBirthDate: '2014-11-10',
		clientAge: 11,
		recipientRelation: '아빠',
		recipientName: '정대호',
		recipientPhone: '010-5678-9012',
		assessmentName: 'CBCL 6-18',
		status: 'expired',
		createdAt: daysAgo(6)
	},

	// ========== 검사 결과 (test-result) ==========
	{
		uid: 'trans-101',
		sentAt: daysAgo(0),
		method: 'kakao',
		type: 'test-result',
		clientName: '김은서',
		clientCode: '0123AB',
		clientBirthDate: '2018-01-12',
		clientAge: 12,
		recipientRelation: '엄마',
		recipientName: '이은지',
		recipientPhone: '010-1234-5678',
		assessmentName: '스마트폰 어쩌구',
		status: 'completed',
		createdAt: daysAgo(0)
	},
	{
		uid: 'trans-102',
		sentAt: daysAgo(1),
		method: 'email',
		type: 'test-result',
		clientName: '박민준',
		clientCode: '0456CD',
		clientBirthDate: '2015-05-20',
		clientAge: 10,
		recipientRelation: '아빠',
		recipientName: '박철수',
		recipientPhone: '010-2345-6789',
		assessmentName: 'K-WISC-V',
		status: 'completed',
		createdAt: daysAgo(1)
	},
	{
		uid: 'trans-103',
		sentAt: daysAgo(2),
		method: 'kakao',
		type: 'test-result',
		clientName: '이서연',
		clientCode: '0789EF',
		clientBirthDate: '2016-08-15',
		clientAge: 9,
		recipientRelation: '엄마',
		recipientName: '김영희',
		recipientPhone: '010-3456-7890',
		assessmentName: '종합주의력검사',
		status: 'failed',
		createdAt: daysAgo(2)
	},
	{
		uid: 'trans-104',
		sentAt: daysAgo(3),
		method: 'sms',
		type: 'test-result',
		clientName: '최지우',
		clientCode: '1012GH',
		clientBirthDate: '2017-03-25',
		clientAge: 8,
		recipientRelation: '엄마',
		recipientName: '정미영',
		recipientPhone: '010-4567-8901',
		assessmentName: '스마트 바디체커',
		status: 'expired',
		createdAt: daysAgo(3)
	}
]

// 더 많은 Mock 데이터 생성 (페이지네이션 테스트용)
function generateMoreTransmissions(): TransmissionData[] {
	const methods: TransmissionMethod[] = ['kakao', 'email', 'sms']
	const statuses: TransmissionStatus[] = ['completed', 'failed', 'expired']
	const types: TransmissionType[] = ['direct-link', 'test-result']
	const names = ['강예린', '윤지호', '장서진', '임도윤', '송유나', '한지우']
	const assessments = ['스마트폰 이용습관', 'K-Bayley-III', 'BGT', 'HTP', 'Rorschach', 'PAT-1']

	const generated: TransmissionData[] = []

	for (let i = 0; i < 26; i++) {
		const nameIdx = i % names.length
		const type = types[i % 2]
		generated.push({
			uid: `trans-gen-${i.toString().padStart(3, '0')}`,
			sentAt: daysAgo(7 + i),
			method: methods[i % 3],
			type,
			clientName: names[nameIdx],
			clientCode: `GEN${i.toString().padStart(3, '0')}`,
			clientBirthDate: '2016-06-15',
			clientAge: 9,
			recipientRelation: i % 2 === 0 ? '엄마' : '아빠',
			recipientName: `보호자${i + 1}`,
			recipientPhone: `010-${(1000 + i).toString()}-${(5000 + i).toString()}`,
			assessmentName: assessments[i % assessments.length],
			status: statuses[i % 3],
			createdAt: daysAgo(7 + i)
		})
	}

	return generated
}

let transmissions: TransmissionData[] = [...baseTransmissions, ...generateMoreTransmissions()]

// 페이지네이션 헬퍼
function paginate<T>(list: T[], page = 1, pageSize = 10): PaginationRes<T> {
	const start = (page - 1) * pageSize
	const sliced = list.slice(start, start + pageSize)
	return {
		data: sliced,
		pagination: {
			page,
			page_size: pageSize,
			total: list.length,
			total_pages: Math.max(1, Math.ceil(list.length / pageSize))
		}
	}
}

// 전송 내역 목록 조회 파라미터
export interface GetTransmissionsParams {
	centerId: string
	queryParams: {
		search?: string
		type?: TransmissionType
		sendDate?: string
		sort?: 'asc' | 'desc'
		page?: number
		pageSize?: number
	}
}

// Mock 목록 조회 함수
export function mockListTransmissions(request: GetTransmissionsParams): PaginationRes<TransmissionData> {
	console.log('[mock][transmissions] request', request)
	let list = [...transmissions]

	// 타입 필터 (탭)
	if (request.queryParams.type) {
		list = list.filter((t) => t.type === request.queryParams.type)
	}

	// 검색 필터 (이름, 코드)
	if (request.queryParams.search) {
		const q = request.queryParams.search.toLowerCase()
		list = list.filter(
			(t) => t.clientName.toLowerCase().includes(q) || t.clientCode.toLowerCase().includes(q)
		)
	}

	// 날짜 필터
	if (request.queryParams.sendDate) {
		const filterDate = request.queryParams.sendDate.split('T')[0]
		list = list.filter((t) => t.sentAt.split('T')[0] === filterDate)
	}

	// 정렬
	if (request.queryParams.sort === 'asc') {
		list = list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
	} else {
		list = list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
	}

	return paginate(list, request.queryParams.page ?? 1, request.queryParams.pageSize ?? 10)
}

// Mock 재전송 함수
export function mockResendTransmission(uid: string): { success: boolean; message: string } {
	console.log('[mock][transmissions] resend', uid)
	const found = transmissions.find((t) => t.uid === uid)

	if (!found) {
		return { success: false, message: '전송 내역을 찾을 수 없습니다.' }
	}

	if (found.status === 'expired') {
		return { success: false, message: '만료된 링크는 재전송할 수 없습니다.' }
	}

	// 재전송 성공 시뮬레이션
	return { success: true, message: '재전송되었습니다.' }
}

// 현재 전송 내역 조회 (디버깅용)
export function getMockTransmissions(): TransmissionData[] {
	return [...transmissions]
}
