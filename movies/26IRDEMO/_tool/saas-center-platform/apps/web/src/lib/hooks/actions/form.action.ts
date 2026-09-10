import { get, post, postRaw, put, patch, deleteResource } from '$lib/services/api/instances'

// ========== Types ==========

/**
 * FormTemplate.schema 계약 — canonical (backend: form_schema.py)
 * 3평면: pages(배경) · fields(데이터) · elements(표현, 좌표+z).
 */

// 확정 14종 — docs/form/element-spec.md (checkbox 단일·consent 제외)
export type FormFieldType =
	| 'text' | 'textarea' | 'email' | 'phone' | 'number'
	| 'date' | 'time' | 'datetime'
	| 'select' | 'radio' | 'checkbox_group'
	| 'signature' | 'file' | 'image'

/** 선택지 (select/radio/checkbox_group 등) */
export interface FormFieldOption {
	value: string
	label: string
	allow_text?: boolean
}

/** DATA 평면 — 의미 키 → 필드 정의 (backend FieldDef) */
export interface FormField {
	type: FormFieldType
	label: string
	required: boolean
	options?: FormFieldOption[]
	validation?: Record<string, unknown>
}

/** PRESENTATION 평면 — 정규화 좌표[x,y,w,h](0~1)·정수 z-index 위젯 (backend ElementDef) */
export interface FormElement {
	id: string
	page: number
	rect: [number, number, number, number]
	z: number
	widget: string
	field_refs: string[]
	option?: string | null
	slot?: number | null
	/** 장식/안내 텍스트 (heading 문구 등, field_refs 없는 요소) */
	text?: string | null
}

/** 배경 페이지 (스캔 서식) */
export interface FormPage {
	no: number
	image: string
	w: number
	h: number
}

export interface FormSchema {
	pages?: FormPage[]
	fields: Record<string, FormField>
	elements?: FormElement[]
}

export interface TemplateSummary {
	id: string
	center_id: string | null
	/** 어느 공용 서식에서 들여왔는가 — 센터 사본을 원본과 이어주는 끈 */
	source_template_id?: string | null
	name: string
	version: number
	/** 문서 스냅샷 렌더용 (목록 응답에 포함) */
	schema: FormSchema
	is_active: boolean
	created_at: string
}

export interface TemplateResponse extends TemplateSummary {
	schema: FormSchema
}

export interface TemplateListResponse {
	items: TemplateSummary[]
	total: number
}

export interface AnswerItem {
	question_id: string
	answer: { value: string | string[] }
}

export interface AnswerResponse {
	id: string
	instance_id: string
	question_id: string
	answer: { value: string | string[] }
	created_at: string
	updated_at: string
}

export interface InstanceResponse {
	id: string
	center_id: string
	template_id: string
	status: 'draft' | 'submitted'
	submitted_at: string | null
	created_at: string
	answers: AnswerResponse[]
	signatures: any[]
}

export interface InstanceSummary {
	id: string
	center_id: string
	template_id: string
	status: 'draft' | 'submitted'
	submitted_at: string | null
	created_at: string
}

export interface InstanceListResponse {
	items: InstanceSummary[]
	total: number
	page: number
	size: number
}

// ========== Template Management ==========

/** AI 양식 초안 생성 — 자연어 설명 → FormSchema */
export const postGenerateFormDraft = () => ({
	key: ['postGenerateFormDraft'],
	request: async (params: {
		centerId: string
		description: string
	}): Promise<{ schema: FormSchema }> => {
		return await postRaw<{ schema: FormSchema }>(
			`/centers/${params.centerId}/forms/templates/draft`,
			{ description: params.description }
		)
	}
})

export const postCreateFormTemplate = () => ({
	key: ['postCreateFormTemplate'],
	request: async (params: {
		centerId: string
		name: string
		schema: FormSchema
	}) => {
		return await post<TemplateResponse>(
			`/centers/${params.centerId}/forms/templates`,
			{ name: params.name, schema: params.schema }
		)
	}
})

export const putUpdateFormTemplate = () => ({
	key: ['putUpdateFormTemplate'],
	request: async (params: {
		centerId: string
		templateId: string
		schema: FormSchema
	}) => {
		return await put<TemplateResponse>(
			`/centers/${params.centerId}/forms/templates/${params.templateId}`,
			{ schema: params.schema }
		)
	}
})

export const postCloneFormTemplate = () => ({
	key: ['postCloneFormTemplate'],
	request: async (params: {
		centerId: string
		templateId: string
		name: string
	}) => {
		return await post<TemplateResponse>(
			`/centers/${params.centerId}/forms/templates/${params.templateId}/clone`,
			{ name: params.name }
		)
	}
})

export const deleteFormTemplate = () => ({
	key: ['deleteFormTemplate'],
	request: async (params: {
		centerId: string
		templateId: string
	}): Promise<void> => {
		await deleteResource(
			`/centers/${params.centerId}/forms/templates/${params.templateId}`
		)
	}
})

/**
 * 템플릿 상태(활성/비활성) 변경 — 토글
 * PATCH /centers/{centerId}/forms/templates/{templateId}/status
 */
export const patchFormTemplateStatus = () => ({
	key: ['patchFormTemplateStatus'],
	request: async (params: {
		centerId: string
		templateId: string
		isActive: boolean
	}): Promise<TemplateResponse> => {
		const response = await patch<TemplateResponse>(
			`/centers/${params.centerId}/forms/templates/${params.templateId}/status`,
			{ is_active: params.isActive }
		)
		return response as unknown as TemplateResponse
	}
})

// ========== Client Form Instance (매핑) ==========

export interface ClientFormInstanceItem {
	mapping_id: string
	instance: InstanceSummary
	created_at: string
}

export interface ClientFormInstanceListResponse {
	items: ClientFormInstanceItem[]
	total: number
}

// ========== Actions ==========

export const getFormTemplates = () => ({
	key: ['getFormTemplates'],
	request: async (params: {
		centerId: string
		includeSystem?: boolean
		/** 비활성 템플릿까지 받는다. 관리 화면 전용 — 피커는 활성만 봐야 한다 */
		includeInactive?: boolean
	}): Promise<TemplateListResponse> => {
		if (!params.centerId) return { items: [], total: 0 }
		const search = new URLSearchParams()
		if (params.includeSystem !== false) search.set('include_system', 'true')
		if (params.includeInactive) search.set('include_inactive', 'true')
		const query = search.size ? `?${search}` : ''
		return await get<TemplateListResponse>(
			`/centers/${params.centerId}/forms/templates${query}`
		)
	}
})

export const getFormTemplate = () => ({
	key: ['getFormTemplate'],
	request: async (params: {
		centerId: string
		templateId: string
	}): Promise<TemplateResponse> => {
		return await get<TemplateResponse>(
			`/centers/${params.centerId}/forms/templates/${params.templateId}`
		)
	}
})

export const postCreateFormInstance = () => ({
	key: ['postCreateFormInstance'],
	request: async (params: {
		centerId: string
		templateId: string
	}): Promise<InstanceResponse> => {
		const response = await post<InstanceResponse>(
			`/centers/${params.centerId}/forms/instances`,
			{ template_id: params.templateId }
		)
		return response as unknown as InstanceResponse
	}
})

export const getFormInstance = () => ({
	key: ['getFormInstance'],
	request: async (params: {
		centerId: string
		instanceId: string
	}): Promise<InstanceResponse> => {
		return await get<InstanceResponse>(
			`/centers/${params.centerId}/forms/instances/${params.instanceId}`
		)
	}
})

export const getFormInstances = () => ({
	key: ['getFormInstances'],
	request: async (params: {
		centerId: string
		templateId?: string
		status?: string
		page?: number
		size?: number
	}): Promise<InstanceListResponse> => {
		if (!params.centerId) return { items: [], total: 0, page: 1, size: 20 }
		const query = new URLSearchParams()
		if (params.templateId) query.append('template_id', params.templateId)
		if (params.status) query.append('status', params.status)
		if (params.page) query.append('page', params.page.toString())
		if (params.size) query.append('size', params.size.toString())
		const queryStr = query.toString()
		return await get<InstanceListResponse>(
			`/centers/${params.centerId}/forms/instances${queryStr ? `?${queryStr}` : ''}`
		)
	}
})

export const putSaveFormAnswers = () => ({
	key: ['putSaveFormAnswers'],
	request: async (params: {
		centerId: string
		instanceId: string
		answers: AnswerItem[]
	}) => {
		const response = await put<{ answers: AnswerResponse[] }>(
			`/centers/${params.centerId}/forms/instances/${params.instanceId}/answers`,
			{ answers: params.answers }
		)
		return response
	}
})

export const postSubmitFormInstance = () => ({
	key: ['postSubmitFormInstance'],
	request: async (params: {
		centerId: string
		instanceId: string
	}): Promise<InstanceResponse> => {
		const response = await post<InstanceResponse>(
			`/centers/${params.centerId}/forms/instances/${params.instanceId}/submit`
		)
		return response as unknown as InstanceResponse
	}
})

// ========== Client Form Instance Actions ==========

export const postLinkFormInstance = () => ({
	key: ['postLinkFormInstance'],
	request: async (params: {
		centerId: string
		clientId: string
		templateId: string
	}): Promise<ClientFormInstanceItem> => {
		const response = await post<ClientFormInstanceItem>(
			`/centers/${params.centerId}/clients/${params.clientId}/form-instances`,
			{ template_id: params.templateId }
		)
		return response as unknown as ClientFormInstanceItem
	}
})

export const getClientFormInstances = () => ({
	key: ['getClientFormInstances'],
	request: async (params: {
		centerId: string
		clientId: string
		templateId?: string
		status?: string
	}): Promise<ClientFormInstanceListResponse> => {
		if (!params.centerId || !params.clientId) return { items: [], total: 0 }
		const query = new URLSearchParams()
		if (params.templateId) query.append('template_id', params.templateId)
		if (params.status) query.append('status', params.status)
		const queryStr = query.toString()
		return await get<ClientFormInstanceListResponse>(
			`/centers/${params.centerId}/clients/${params.clientId}/form-instances${queryStr ? `?${queryStr}` : ''}`
		)
	}
})

export const deleteClientFormInstance = () => ({
	key: ['deleteClientFormInstance'],
	request: async (params: {
		centerId: string
		clientId: string
		mappingId: string
	}): Promise<void> => {
		await deleteResource(
			`/centers/${params.centerId}/clients/${params.clientId}/form-instances/${params.mappingId}`
		)
	}
})

// ========== Voucher Form Instance Actions (바우처-폼 인스턴스 매핑) ==========

export const postLinkVoucherFormInstance = () => ({
	key: ['postLinkVoucherFormInstance'],
	request: async (params: {
		centerId: string
		clientVoucherId: string
		templateId: string
	}): Promise<ClientFormInstanceItem> => {
		const response = await post<ClientFormInstanceItem>(
			`/centers/${params.centerId}/client-vouchers/${params.clientVoucherId}/form-instances`,
			{ template_id: params.templateId }
		)
		return response as unknown as ClientFormInstanceItem
	}
})

export const getVoucherFormInstances = () => ({
	key: ['getVoucherFormInstances'],
	request: async (params: {
		centerId: string | null | undefined
		clientVoucherId: string
		status?: string
	}): Promise<ClientFormInstanceListResponse> => {
		if (!params.centerId || !params.clientVoucherId)
			return { items: [], total: 0 }
		const query = new URLSearchParams()
		if (params.status) query.append('status', params.status)
		const queryStr = query.toString()
		return await get<ClientFormInstanceListResponse>(
			`/centers/${params.centerId}/client-vouchers/${params.clientVoucherId}/form-instances${queryStr ? `?${queryStr}` : ''}`
		)
	}
})

export const deleteVoucherFormInstance = () => ({
	key: ['deleteVoucherFormInstance'],
	request: async (params: {
		centerId: string
		clientVoucherId: string
		mappingId: string
	}): Promise<void> => {
		await deleteResource(
			`/centers/${params.centerId}/client-vouchers/${params.clientVoucherId}/form-instances/${params.mappingId}`
		)
	}
})

// ========== Form Send (문서 양식 문자 전송 / 작성 요청) ==========

export interface FormSendRecipient {
	name: string
	phone: string
	relation?: string | null
	/** 수신자별 발급된 폼 인스턴스 */
	instance_id?: string | null
	/** 인스턴스 상태 (draft | submitted) — 발급 내역 조회 시 채워짐 */
	status?: 'draft' | 'submitted' | string | null
}

export interface FormSendDeliveryResult {
	recipient_phone: string
	recipient_name: string
	status: 'sent' | 'failed' | string
	message_id?: string | null
	error?: string | null
}

export interface FormSendResponse {
	id: string
	center_id: string
	form_template_id: string
	recipients: FormSendRecipient[]
	channel: 'alarmtalk' | 'sms'
	delivery_results: FormSendDeliveryResult[]
	created_at: string
	updated_at: string
}

export interface FormSendSummary {
	id: string
	recipients: FormSendRecipient[]
	channel: 'alarmtalk' | 'sms' | null
	created_at: string
}

export interface CreateFormSendPayload {
	recipients: FormSendRecipient[]
	channel: 'alarmtalk' | 'sms'
	template_id?: string | null
}

/**
 * 문서 양식 전송 생성 + 문자 발송
 * POST /centers/{centerId}/forms/templates/{templateId}/send
 */
export const createFormSend = () => ({
	key: ['createFormSend'],
	request: async (params: {
		centerId: string
		templateId: string
		payload: CreateFormSendPayload
	}): Promise<FormSendResponse> => {
		const response = await post<FormSendResponse>(
			`/centers/${params.centerId}/forms/templates/${params.templateId}/send`,
			params.payload
		)
		return response as unknown as FormSendResponse
	}
})

/**
 * 문서 양식 전송 목록 조회
 * GET /centers/{centerId}/forms/templates/{templateId}/sends
 */
export const listFormSends = () => ({
	key: ['listFormSends'],
	request: async (params: {
		centerId: string
		templateId: string
	}): Promise<FormSendSummary[]> => {
		if (!params.centerId || !params.templateId) return []
		return await get<FormSendSummary[]>(
			`/centers/${params.centerId}/forms/templates/${params.templateId}/sends`
		)
	}
})

/**
 * 문서 양식 전송 재전송
 * POST /centers/{centerId}/forms/sends/{sendId}/resend
 */
export const resendFormSend = () => ({
	key: ['resendFormSend'],
	request: async (params: {
		centerId: string
		sendId: string
		payload?: { failed_only: boolean }
	}): Promise<FormSendResponse> => {
		const response = await post<FormSendResponse>(
			`/centers/${params.centerId}/forms/sends/${params.sendId}/resend`,
			params.payload ?? { failed_only: false }
		)
		return response as unknown as FormSendResponse
	}
})
