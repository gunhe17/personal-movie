/**
 * 문자 양식 쿼리 빌더
 */

import type { GetMessageTemplatesParams, GetDefaultTemplateParams } from '$lib/hooks/actions/messageTemplate.action'

export const buildTemplateListInput = (
  centerId: string,
  templateType?: string
): GetMessageTemplatesParams => ({
  centerId,
  template_type: templateType || undefined
})

export const buildDefaultTemplateInput = (
  centerId: string,
  templateType: string
): GetDefaultTemplateParams => ({
  centerId,
  template_type: templateType
})
