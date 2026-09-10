/**
 * Message Template Actions (Admin)
 * 어드민 문자 양식 관련 API action 함수들
 */

import { get, post, put, deleteResource } from '$lib/services/api/instances'
import type { Action } from '$types/apiResponse'

// ============ Types ============

export interface VariableSchema {
  key: string
  label: string
  required: boolean
}

export interface MessageTemplateSummary {
  id: string
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

export interface PreviewResponse {
  rendered_content: string
}

// ============ Params ============

export interface GetSystemTemplatesParams {
  template_type?: string
}

export interface CreateSystemTemplateParams {
  template_type: string
  name: string
  content: string
  is_default?: boolean
}

export interface UpdateSystemTemplateParams {
  templateId: string
  name?: string
  content?: string
}

export interface GetCenterTemplatesParams {
  centerId: string
  template_type?: string
}

// ============ Actions ============

export const getSystemTemplates = (): Action<
  MessageTemplateListResponse,
  MessageTemplateListResponse
> => ({
  key: ['getSystemTemplates'],
  request: async (
    params: GetSystemTemplatesParams
  ): Promise<MessageTemplateListResponse> => {
    const query: Record<string, string> = {}
    if (params?.template_type) query.template_type = params.template_type
    return get<MessageTemplateListResponse>('/admin/message-templates/system', query)
  }
})

export const getSystemTemplate = (): Action<
  MessageTemplateResponse,
  MessageTemplateResponse
> => ({
  key: ['getSystemTemplate'],
  request: async (params: { templateId: string }): Promise<MessageTemplateResponse> => {
    return get<MessageTemplateResponse>(
      `/admin/message-templates/system/${params.templateId}`
    )
  }
})

export const postSystemTemplate = () => ({
  key: ['postSystemTemplate', 'getSystemTemplates'],
  request: async (
    params: CreateSystemTemplateParams
  ): Promise<MessageTemplateResponse> => {
    const res = await post<MessageTemplateResponse>(
      '/admin/message-templates/system',
      params
    )
    return (
      (res as { data?: MessageTemplateResponse }).data ??
      (res as unknown as MessageTemplateResponse)
    )
  }
})

export const putSystemTemplate = () => ({
  key: ['putSystemTemplate', 'getSystemTemplates'],
  request: async (
    params: UpdateSystemTemplateParams
  ): Promise<MessageTemplateResponse> => {
    const { templateId, ...body } = params
    const res = await put<MessageTemplateResponse>(
      `/admin/message-templates/system/${templateId}`,
      body
    )
    return (
      (res as { data?: MessageTemplateResponse }).data ??
      (res as unknown as MessageTemplateResponse)
    )
  }
})

export const deleteSystemTemplate = () => ({
  key: ['deleteSystemTemplate', 'getSystemTemplates'],
  request: async (params: { templateId: string }): Promise<void> => {
    await deleteResource(`/admin/message-templates/system/${params.templateId}`)
  }
})

export const getCenterTemplate = (): Action<
  MessageTemplateResponse,
  MessageTemplateResponse
> => ({
  key: ['getCenterTemplate'],
  request: async (params: {
    centerId: string
    templateId: string
  }): Promise<MessageTemplateResponse> => {
    return get<MessageTemplateResponse>(
      `/admin/message-templates/centers/${params.centerId}/${params.templateId}`
    )
  }
})

export const getCenterTemplates = (): Action<
  MessageTemplateListResponse,
  MessageTemplateListResponse
> => ({
  key: ['getCenterTemplates'],
  request: async (
    params: GetCenterTemplatesParams
  ): Promise<MessageTemplateListResponse> => {
    if (!params.centerId) return { items: [], total: 0 }
    const query: Record<string, string> = {}
    if (params.template_type) query.template_type = params.template_type
    return get<MessageTemplateListResponse>(
      `/admin/message-templates/centers/${params.centerId}`,
      query
    )
  }
})
