import { get, post } from '$lib/services/api/instances';
import type { Action, ServerPaginatedResponse } from '$lib/types/apiResponse';

// HTTP-Only 쿠키 환경: 모든 요청은 /api/proxy를 통해 프록시됨
// instances.ts에서 baseURL이 '/api/proxy'로 설정됨

// 수신자 역할 타입
export type RecipientRole = 'guardian' | 'client' | 'professional';

// AssessmentSendLink 타입 정의
export interface AssessmentSendLinkType {
	// Identity
	uid: string;
	center_uid: string;
	session_uid: string;

	// Link Info
	unique_token: string;

	// Recipient (수신자 정보)
	recipient_role: RecipientRole | null;
	recipient_phone: string | null;
	recipient_email: string | null;

	// Status
	expires_at: string | null; // ISO datetime string
	accessed_at: string | null; // ISO datetime string
	completed_at: string | null; // ISO datetime string

	// Audit
	created_at: string; // ISO datetime string
	updated_at: string; // ISO datetime string
	modified_by_account: string | null;
}

// 링크 목록 조회 파라미터
export interface GetAssessmentSendLinksParams {
	centerId: string;
	session_uid?: string; // 특정 세션의 링크만
	has_accessed?: boolean; // 접속 여부 필터
	has_completed?: boolean; // 완료 여부 필터
	sort?: string; // default: created_at...desc
	page?: number;
	page_size?: number;
}

// ========== 바로링크 생성 (send-link) ==========

export interface SendLinkRecipient {
	name: string;
	phone: string;
	relation?: string;
}

export interface CreateSendLinkPayload {
	template_id?: string;
	recipients: SendLinkRecipient[];
	assessment_ids: string[];
	expires_at?: string | null;
	channel?: 'alarmtalk' | 'sms';
}

export interface SendLinkDeliveryResult {
	recipient_phone: string;
	recipient_name: string;
	status: 'sent' | 'failed';
	message_id?: string | null;
	error?: string | null;
}

export interface CreateSendLinkResponse {
	id: string;
	center_id: string;
	case_id: string;
	verification_code: string;
	recipients: SendLinkRecipient[];
	expires_at: string | null;
	revoked_at: string | null;
	assessment_ids: string[];
	url: string;
	channel: 'alarmtalk' | 'sms';
	delivery_results: SendLinkDeliveryResult[];
	created_at: string;
	updated_at: string;
}

export interface CreateSendLinkParams {
	centerId: string;
	caseId: string;
	payload: CreateSendLinkPayload;
}

/**
 * 바로링크 생성 + 메시지 발송
 * POST /centers/{centerId}/assessment-cases/{caseId}/send-link
 */
export const createAssessmentSendLink = (): Action<
	CreateSendLinkResponse
> => ({
	key: ['createAssessmentSendLink'],
	request: async (params: CreateSendLinkParams) => {
		const { centerId, caseId, payload } = params;
		const url = `/centers/${centerId}/assessment-cases/${caseId}/send-link`;
		const response = await post<CreateSendLinkResponse>(url, payload);
		return response;
	}
});

// ========== 결과전송 (send-result) ==========

export interface SendResultRecipient {
	name: string;
	phone: string;
	relation?: string;
}

export interface CreateSendResultPayload {
	recipients: SendResultRecipient[];
	expires_at?: string | null;
	channel?: 'alarmtalk' | 'sms';
	template_id?: string;
}

export interface CreateSendResultResponse {
	id: string;
	center_id: string;
	case_id: string;
	verification_code: string;
	recipients: SendResultRecipient[];
	expires_at: string | null;
	revoked_at: string | null;
	url: string;
	channel: 'alarmtalk' | 'sms';
	delivery_results: SendLinkDeliveryResult[];
	created_at: string;
	updated_at: string;
}

export interface CreateSendResultParams {
	centerId: string;
	caseId: string;
	payload: CreateSendResultPayload;
}

export interface SendResultSummary {
	id: string;
	verification_code: string;
	recipients: SendResultRecipient[];
	expires_at: string | null;
	revoked_at: string | null;
	channel: 'alarmtalk' | 'sms' | null;
	created_at: string;
}

export interface MessageLogSummary {
	id: string;
	channel: string;
	recipient_phone: string;
	recipient_name: string | null;
	status: string;
	error_message: string | null;
	created_at: string;
}

export interface ListSendResultsParams {
	centerId: string;
	caseId: string;
}

export interface GetSendResultDeliveryHistoryParams {
	centerId: string;
	caseId: string;
	sendResultId: string;
}

export interface ResendSendResultParams {
	centerId: string;
	caseId: string;
	sendResultId: string;
	payload: { failed_only: boolean };
}

/**
 * 결과전송 생성 + 메시지 발송
 * POST /centers/{centerId}/assessment-cases/{caseId}/send-result
 */
export const createSendResult = (): Action<
	CreateSendResultResponse
> => ({
	key: ['createSendResult'],
	request: async (params: CreateSendResultParams) => {
		const { centerId, caseId, payload } = params;
		const url = `/centers/${centerId}/assessment-cases/${caseId}/send-result`;
		const response = await post<CreateSendResultResponse>(url, payload);
		return response;
	}
});

/**
 * 결과전송 목록 조회
 * GET /centers/{centerId}/assessment-cases/{caseId}/send-results
 */
export const listSendResults = (): Action<
	SendResultSummary[],
	SendResultSummary[]
> => ({
	key: ['listSendResults'],
	request: async (params: ListSendResultsParams) => {
		const { centerId, caseId } = params;
		const url = `/centers/${centerId}/assessment-cases/${caseId}/send-results`;
		const response = await get<SendResultSummary[]>(url);
		return response;
	}
});

/**
 * 결과전송 발송 이력 조회
 * GET /centers/{centerId}/assessment-cases/{caseId}/send-results/{sendResultId}/delivery-history
 */
export const getSendResultDeliveryHistory = (): Action<
	MessageLogSummary[],
	MessageLogSummary[]
> => ({
	key: ['getSendResultDeliveryHistory'],
	request: async (params: GetSendResultDeliveryHistoryParams) => {
		const { centerId, caseId, sendResultId } = params;
		const url = `/centers/${centerId}/assessment-cases/${caseId}/send-results/${sendResultId}/delivery-history`;
		const response = await get<MessageLogSummary[]>(url);
		return response;
	}
});

/**
 * 결과전송 재전송
 * POST /centers/{centerId}/assessment-cases/{caseId}/send-results/{sendResultId}/resend
 */
export const resendSendResult = (): Action<
	CreateSendResultResponse
> => ({
	key: ['resendSendResult'],
	request: async (params: ResendSendResultParams) => {
		const { centerId, caseId, sendResultId, payload } = params;
		const url = `/centers/${centerId}/assessment-cases/${caseId}/send-results/${sendResultId}/resend`;
		const response = await post<CreateSendResultResponse>(url, payload);
		return response;
	}
});

/**
 * 4.1 바로링크 목록 조회
 * GET /api/centers/{centerId}/view/assessment_send_links
 */
export const getAssessmentSendLinksByCenterId = (): Action<
	AssessmentSendLinkType[],
	ServerPaginatedResponse<AssessmentSendLinkType>
> => ({
	key: ['assessment-send-links'],
	request: async (params: GetAssessmentSendLinksParams) => {
		const { centerId, session_uid, has_accessed, has_completed, sort, page, page_size } = params;

		const queryParams = new URLSearchParams();
		if (session_uid) queryParams.append('session_uid', session_uid);
		if (has_accessed !== undefined) queryParams.append('has_accessed', has_accessed.toString());
		if (has_completed !== undefined) queryParams.append('has_completed', has_completed.toString());
		if (sort) queryParams.append('sort', sort);
		if (page) queryParams.append('page', page.toString());
		if (page_size) queryParams.append('page_size', page_size.toString());

		const queryString = queryParams.toString();
		const url = `/centers/${centerId}/view/assessment_send_links${queryString ? `?${queryString}` : ''}`;

		const response = await get<ServerPaginatedResponse<AssessmentSendLinkType>>(url);

		return response;
	}
});
