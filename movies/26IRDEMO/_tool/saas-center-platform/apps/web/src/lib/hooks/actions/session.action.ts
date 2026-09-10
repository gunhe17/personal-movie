import { externalGet, post } from '$lib/services/api/instances'
import type { AssessmentSessionType } from '../../types/session'

export interface CancelAssessmentSessionRequest {
  centerId: string
  sessionId: string
  cancelReason?: string
}

export const getSessionDetail = () => ({
  key: ['getSessionDetail'],
  request: async (request: { centerId: string; sessionId: string }) => {
    const { centerId, sessionId } = request
    const response = await externalGet<AssessmentSessionType>(
      `/centers/${centerId}/assessment_sessions/${sessionId}`
    )
    return response
  }
})

export const cancelAssessmentSession = () => ({
  key: ['cancelAssessmentSession'],
  request: async (request: CancelAssessmentSessionRequest) => {
    const { centerId, sessionId, cancelReason } = request
    const response = await post(
      `/centers/${centerId}/assessment-sessions/${sessionId}/cancel`,
      { cancel_reason: cancelReason ?? null }
    )
    return response
  }
})

export const revertCancelAssessmentSession = () => ({
  key: ['revertCancelAssessmentSession'],
  request: async (request: { centerId: string; sessionId: string }) => {
    const { centerId, sessionId } = request
    return await post(
      `/centers/${centerId}/assessment-sessions/${sessionId}/revert-cancel`
    )
  }
})
