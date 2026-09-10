import { get, postRaw } from '$lib/services/api/instances'
import type { Action } from '$lib/types/apiResponse'

// ============ 내담자 앱(마인드스코프) 연결 ============
// 초대 코드는 보호자(role=guardian|both) 단위로 발급 — 아이(client)에게는 발급하지 않는다.
// 예외: 보호자 없는 본인 내담은 selfLink 발급으로 both 승격 후 본인이 연결 대상이 된다.

export type AppLinkStatusValue = 'none' | 'invited' | 'linked'

/** 발급된 초대 코드 (6자리, 48시간 유효) */
export interface AppLinkInvitation {
  id: string
  code: string
  expires_at: string
  created_at: string
}

/** 이 보호자의 초대 코드로 앱에 연결된 자녀 */
export interface AppLinkedChild {
  client_id: string
  name: string | null
  linked_at: string | null
}

export interface AppLinkStatusResponse {
  status: AppLinkStatusValue
  invitation: AppLinkInvitation | null
  linked_children: AppLinkedChild[]
}

const EMPTY_APP_LINK_STATUS: AppLinkStatusResponse = {
  status: 'none',
  invitation: null,
  linked_children: []
}

export const getAppLinkStatus = (): Action<
  AppLinkStatusResponse,
  AppLinkStatusResponse
> => ({
  key: ['getAppLinkStatus'],
  request: async (params: {
    centerId: string
    clientId: string
  }): Promise<AppLinkStatusResponse> => {
    if (!params?.centerId || !params?.clientId) {
      return { ...EMPTY_APP_LINK_STATUS }
    }
    return get<AppLinkStatusResponse>(
      `/centers/${params.centerId}/clients/${params.clientId}/app-link/status`
    )
  }
})

// 현재 유효한 초대 코드를 보호자 등록 번호로 문자 발송. 코드·번호 없으면 400 {detail}.
export const postAppLinkInvitationSms = () => ({
  key: ['postAppLinkInvitationSms'],
  request: async (params: { centerId: string; clientId: string }) => {
    const { centerId, clientId } = params
    return postRaw<{ sent_to: string }>(
      `/centers/${centerId}/clients/${clientId}/app-link/invitations/send-sms`
    )
  }
})

// 재발급 시 기존 유효 코드는 서버가 자동 무효화. 보호자가 아니면 400 {detail}.
// selfLink: 보호자 없는 본인 내담(청소년·성인) — 서버가 role을 both로 승격 후 본인에게 발급.
// 만 14세 미만·생년월일 미등록은 서버가 400으로 거절.
export const postAppLinkInvitation = () => ({
  key: ['postAppLinkInvitation'],
  request: async (params: {
    centerId: string
    clientId: string
    selfLink?: boolean
  }) => {
    const { centerId, clientId, selfLink } = params
    return postRaw<AppLinkInvitation>(
      `/centers/${centerId}/clients/${clientId}/app-link/invitations`,
      selfLink ? { self_link: true } : undefined
    )
  }
})
