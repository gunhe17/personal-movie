import type { TransmissionData, TransmissionMethod, TransmissionStatus } from '$lib/hooks/actions/transmission.action'
import { METHOD_LABELS, STATUS_LABELS, STATUS_COLORS } from './constants'

// 전송 내역 ViewModel
export interface TransmissionVM {
	id: string
	sentAt: string // 포맷된 전송 일시
	method: TransmissionMethod
	methodLabel: string

	// 내담자
	clientName: string
	clientCode: string
	clientBirthDate: string
	clientAge: string // "만 X세" 형식

	// 수신인
	recipientRelation: string
	recipientName: string
	recipientPhone: string

	// 검사
	assessmentName: string

	// 상태
	status: TransmissionStatus
	statusLabel: string
	statusColor: string

	// 재전송 가능 여부
	canResend: boolean
}

// 날짜 포맷 (2025-12-14 13:12:33)
function formatDateTime(isoString: string): string {
	const date = new Date(isoString)
	const yyyy = date.getFullYear()
	const mm = String(date.getMonth() + 1).padStart(2, '0')
	const dd = String(date.getDate()).padStart(2, '0')
	const hh = String(date.getHours()).padStart(2, '0')
	const min = String(date.getMinutes()).padStart(2, '0')
	const ss = String(date.getSeconds()).padStart(2, '0')
	return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`
}

// 단건 변환
export function mapToTransmissionVM(data: TransmissionData): TransmissionVM {
	return {
		id: data.uid,
		sentAt: formatDateTime(data.sentAt),
		method: data.method,
		methodLabel: METHOD_LABELS[data.method],

		clientName: data.clientName,
		clientCode: data.clientCode,
		clientBirthDate: data.clientBirthDate,
		clientAge: `만 ${data.clientAge}세`,

		recipientRelation: data.recipientRelation,
		recipientName: data.recipientName,
		recipientPhone: data.recipientPhone,

		assessmentName: data.assessmentName,

		status: data.status,
		statusLabel: STATUS_LABELS[data.status],
		statusColor: STATUS_COLORS[data.status],

		// expired 상태가 아닐 때만 재전송 가능
		canResend: data.status !== 'expired'
	}
}

// 목록 변환
export function mapToTransmissionVMList(list: TransmissionData[]): TransmissionVM[] {
	return list.map(mapToTransmissionVM)
}
