import { get, post } from '$lib/services/api/instances'
import type { CreateSendLinkResponse, SendLinkRecipient } from './quickLinks'

export interface LinkDelivery {
  id: string
  recipient: string
  message_type: string
  status: string
  error_message: string | null
  created_at: string
}

export interface SendLinkSummary {
  id: string
  recipients: SendLinkRecipient[]
  created_at: string
  expires_at: string | null
  revoked_at: string | null
  channel: 'sms' | 'alarmtalk' | null
}

const base = (centerId: string, caseId: string) =>
  `/centers/${centerId}/assessment-cases/${caseId}/send-links`

export async function listLinkHistory(centerId: string, caseId: string) {
  return get<SendLinkSummary[]>(base(centerId, caseId))
}

export async function getLinkDeliveries(
  centerId: string,
  caseId: string,
  linkId: string
) {
  return get<LinkDelivery[]>(
    `${base(centerId, caseId)}/${linkId}/delivery-history`
  )
}

export async function resendLinkMessage(
  centerId: string,
  caseId: string,
  linkId: string,
  templateId?: string
) {
  const response = await post<CreateSendLinkResponse>(
    `${base(centerId, caseId)}/${linkId}/resend`,
    {
      failed_only: false,
      template_id: templateId
    }
  )
  return (
    (response as { data?: CreateSendLinkResponse }).data ??
    (response as unknown as CreateSendLinkResponse)
  )
}
