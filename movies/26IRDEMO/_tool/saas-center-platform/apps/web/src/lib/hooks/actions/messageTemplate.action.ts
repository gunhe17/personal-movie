/**
 * Message Template Actions
 * 문자 양식 관련 API action 함수들
 */

import {
  get,
  post,
  patch,
  deleteResource
} from '$lib/services/api/instances'
import type { Action } from '$lib/types/apiResponse'

// ============ Types ============

export interface VariableSchema {
  key: string
  label: string
  required: boolean
}

export interface MessageTemplateSummary {
  id: string
  center_id: string | null
  template_type: string
  name: string
  is_default: boolean
  created_at: string
}

export interface MessageTemplateResponse {
  id: string
  center_id: string | null
  template_type: string
  name: string
  content: string
  variables: VariableSchema[]
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface MessageTemplateListResponse {
  items: MessageTemplateSummary[]
  total: number
}

export interface DefaultTemplateResponse {
  template: MessageTemplateResponse | null
  fallback_content: string
  builtin_content?: string
  source: 'template' | 'system' | 'hardcoded'
}

export interface PreviewResponse {
  rendered_content: string
}

// ============ Params ============

export interface GetMessageTemplatesParams {
  centerId: string
  template_type?: string
}

export interface GetMessageTemplateParams {
  centerId: string
  templateId: string
}

export interface CreateMessageTemplateParams {
  centerId: string
  template_type: string
  name: string
  content: string
  is_default?: boolean
}

export interface UpdateMessageTemplateParams {
  centerId: string
  templateId: string
  name?: string
  content?: string
}

export interface DeleteMessageTemplateParams {
  centerId: string
  templateId: string
}

export interface SetDefaultParams {
  centerId: string
  templateId: string
}

export interface GetDefaultTemplateParams {
  centerId: string
  template_type: string
}

export interface PreviewTemplateParams {
  centerId: string
  content: string
  variables?: Record<string, string>
}

// ============ Actions ============

export const getMessageTemplates = (): Action<
  MessageTemplateListResponse,
  MessageTemplateListResponse
> => ({
  key: ['getMessageTemplates'],
  request: async (
    params: GetMessageTemplatesParams
  ): Promise<MessageTemplateListResponse> => {
    if (!params.centerId) {
      return { items: [], total: 0 }
    }
    const query: Record<string, string> = {}
    if (params.template_type) query.template_type = params.template_type
    return get<MessageTemplateListResponse>(
      `/centers/${params.centerId}/message-templates`,
      query
    )
  }
})

export const getMessageTemplate = (): Action<
  MessageTemplateResponse,
  MessageTemplateResponse
> => ({
  key: ['getMessageTemplate'],
  request: async (
    params: GetMessageTemplateParams
  ): Promise<MessageTemplateResponse> => {
    return get<MessageTemplateResponse>(
      `/centers/${params.centerId}/message-templates/${params.templateId}`
    )
  }
})

export const postMessageTemplate = () => ({
  key: ['postMessageTemplate', 'getMessageTemplates'],
  request: async (
    params: CreateMessageTemplateParams
  ): Promise<MessageTemplateResponse> => {
    const { centerId, ...body } = params
    const res = await post<MessageTemplateResponse>(
      `/centers/${centerId}/message-templates`,
      body
    )
    return (
      (res as { data?: MessageTemplateResponse }).data ??
      (res as unknown as MessageTemplateResponse)
    )
  }
})

export const patchMessageTemplate = () => ({
  key: ['patchMessageTemplate', 'getMessageTemplates', 'getMessageTemplate'],
  request: async (
    params: UpdateMessageTemplateParams
  ): Promise<MessageTemplateResponse> => {
    const { centerId, templateId, ...body } = params
    const res = await patch<MessageTemplateResponse>(
      `/centers/${centerId}/message-templates/${templateId}`,
      body
    )
    return (
      (res as { data?: MessageTemplateResponse }).data ??
      (res as unknown as MessageTemplateResponse)
    )
  }
})

export const deleteMessageTemplate = () => ({
  key: ['deleteMessageTemplate', 'getMessageTemplates'],
  request: async (params: DeleteMessageTemplateParams): Promise<void> => {
    await deleteResource(
      `/centers/${params.centerId}/message-templates/${params.templateId}`
    )
  }
})

export const postSetDefault = () => ({
  key: ['postSetDefault', 'getMessageTemplates', 'getMessageTemplate'],
  request: async (
    params: SetDefaultParams
  ): Promise<MessageTemplateResponse> => {
    const res = await post<MessageTemplateResponse>(
      `/centers/${params.centerId}/message-templates/${params.templateId}/set-default`
    )
    return (
      (res as { data?: MessageTemplateResponse }).data ??
      (res as unknown as MessageTemplateResponse)
    )
  }
})

export const getDefaultTemplate = (): Action<
  DefaultTemplateResponse,
  DefaultTemplateResponse
> => ({
  key: ['getDefaultTemplate'],
  request: async (
    params: GetDefaultTemplateParams
  ): Promise<DefaultTemplateResponse> => {
    if (!params.centerId) {
      return { template: null, fallback_content: '', source: 'hardcoded' }
    }
    return get<DefaultTemplateResponse>(
      `/centers/${params.centerId}/message-templates/default`,
      { template_type: params.template_type }
    )
  }
})

export const postPreviewTemplate = () => ({
  key: ['postPreviewTemplate'],
  request: async (params: PreviewTemplateParams): Promise<PreviewResponse> => {
    const { centerId, ...body } = params
    const res = await post<PreviewResponse>(
      `/centers/${centerId}/message-templates/preview`,
      body
    )
    return (
      (res as { data?: PreviewResponse }).data ??
      (res as unknown as PreviewResponse)
    )
  }
})
