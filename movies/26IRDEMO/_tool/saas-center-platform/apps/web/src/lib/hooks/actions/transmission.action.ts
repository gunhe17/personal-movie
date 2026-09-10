// 전송 내역 조회는 인증이 필요한데 /external-api(vite 직프록시)는 Authorization을 못 붙인다
// → HTTP-Only 쿠키에서 토큰을 얹어주는 메인 프록시(get)로 호출 (워크스루 W-9)
import { get, externalPost } from '$lib/services/api/instances'
import type { PaginationRes } from '$lib/types/apiResponse'
import {
	mockResendTransmission,
	type TransmissionData,
	type TransmissionType,
	type TransmissionMethod,
	type TransmissionStatus
} from '$lib/mocks/transmissionStore'

const USE_MOCK = true

// ============================================================
// 전송 내역 목록 조회
// ============================================================

export interface GetTransmissionHistoryParams {
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

// 실 백엔드: GET /centers/{cid}/assessment-transmissions?type=&page=&size= → Page<TransmissionItem>
// 액션이 매핑 경계 — 응답을 기존 PaginationRes<TransmissionData>로 변환해 소비처는 무변경.
// NOTE: search/sendDate/sort 는 백엔드 미지원(추후 서버필터). 현재는 type/page/size.
const getTransmissionHistoryReal = () => ({
	key: ['getTransmissionHistory'],
	request: async (
		request: GetTransmissionHistoryParams
	): Promise<PaginationRes<TransmissionData>> => {
		const { type, page, pageSize } = request.queryParams
		const qp = new URLSearchParams()
		qp.append('type', type ?? 'test-result')
		if (page) qp.append('page', page.toString())
		if (pageSize) qp.append('size', pageSize.toString())

		const res = await get<{
			items: Array<{
				uid: string
				type: TransmissionType
				method: TransmissionMethod
				sent_at: string
				client_name: string | null
				client_code: string | null
				client_birth_date: string | null
				client_age: number | null
				recipient_relation: string | null
				recipient_name: string | null
				recipient_phone: string | null
				assessment_name: string
				status: TransmissionStatus
			}>
			total: number
			page: number
			size: number
			pages: number
		}>(`/centers/${request.centerId}/assessment-transmissions?${qp.toString()}`)

		return {
			data: res.items.map((i) => ({
				uid: i.uid,
				sentAt: i.sent_at,
				method: i.method,
				type: i.type,
				clientName: i.client_name ?? '',
				clientCode: i.client_code ?? '',
				clientBirthDate: i.client_birth_date ?? '',
				clientAge: i.client_age ?? 0,
				recipientRelation: i.recipient_relation ?? '',
				recipientName: i.recipient_name ?? '',
				recipientPhone: i.recipient_phone ?? '',
				assessmentName: i.assessment_name,
				status: i.status,
				createdAt: i.sent_at
			})),
			pagination: {
				page: res.page,
				page_size: res.size,
				total: res.total,
				total_pages: res.pages
			}
		}
	}
})

export const getTransmissionHistory = () => getTransmissionHistoryReal()

// ============================================================
// 재전송
// ============================================================

export interface ResendTransmissionParams {
	centerId: string
	transmissionId: string
}

export interface ResendTransmissionResponse {
	success: boolean
	message: string
}

const resendTransmissionReal = () => ({
	key: ['resendTransmission'],
	request: async (request: ResendTransmissionParams): Promise<ResendTransmissionResponse> => {
		const { centerId, transmissionId } = request
		const url = `/centers/${centerId}/transmissions/${transmissionId}/cmd/resend`
		const response = await externalPost<ResendTransmissionResponse>(url, {})
		// ApiResponse에서 data 추출
		return {
			success: response.success,
			message: response.data?.message ?? (response.success ? '재전송되었습니다.' : '재전송에 실패했습니다.')
		}
	}
})

const resendTransmissionMock = () => ({
	key: ['resendTransmission'],
	request: async (request: ResendTransmissionParams): Promise<ResendTransmissionResponse> =>
		mockResendTransmission(request.transmissionId)
})

export const resendTransmission = () =>
	USE_MOCK ? resendTransmissionMock() : resendTransmissionReal()

// Re-export types
export type { TransmissionData, TransmissionType }
export type { TransmissionMethod, TransmissionStatus } from '$lib/mocks/transmissionStore'
