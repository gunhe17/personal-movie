import {
  getClientDetail,
  getClientDocuments,
  getClientRelations
} from '$lib/hooks/actions/client.action'
import {
  getFormTemplates,
  getFormTemplate,
  getFormInstance,
  getClientFormInstances
} from '$lib/hooks/actions/form.action'

export function buildClientDetailInput(centerId: string, clientId: string) {
  return { centerId, clientId }
}

export function buildClientDocsInput(centerId: string, clientId: string) {
  return { centerId, clientId }
}

export function buildRelationsInput(centerId: string, clientId: string) {
  return { centerId, clientId, relationCategory: 'guardian' as const }
}

export function buildTemplatesInput(centerId: string) {
  return { centerId, includeSystem: true }
}

export function buildInstancesInput(
  centerId: string,
  clientId: string,
  templateId: string
) {
  return { centerId, clientId, templateId }
}

export function buildFormInstanceInput(centerId: string, instanceId: string) {
  return { centerId, instanceId }
}

export function buildFormTemplateInput(centerId: string, templateId: string) {
  return { centerId, templateId }
}

export {
  getClientDetail,
  getClientDocuments,
  getClientRelations,
  getFormTemplates,
  getFormTemplate,
  getFormInstance,
  getClientFormInstances
}
