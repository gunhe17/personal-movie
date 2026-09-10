import { appInstance, get, postRaw } from '$lib/services/api/instances'
import type { Action } from '$lib/types/apiResponse'
import type {
  ExaminationSummary,
  SCTResponseItem,
  SCTResultsResponse,
  SCTStemListResponse
} from './types'

function basePath(institutionId: string, examId: string) {
  return `/institutions/${institutionId}/examinations/${examId}/sct`
}

export function getSCTStems(): Action<SCTStemListResponse, SCTStemListResponse> {
  return {
    key: ['sctStems'],
    request: async (params?: { institutionId: string; examId: string }) => {
      if (!params?.institutionId || !params?.examId) {
        throw new Error('institutionId and examId are required')
      }
      return await get<SCTStemListResponse>(`${basePath(params.institutionId, params.examId)}/stems`)
    }
  }
}

export function getSCTResults(): Action<SCTResultsResponse, SCTResultsResponse> {
  return {
    key: ['sctResults'],
    request: async (params?: { institutionId: string; examId: string }) => {
      if (!params?.institutionId || !params?.examId) {
        throw new Error('institutionId and examId are required')
      }
      return await get<SCTResultsResponse>(`${basePath(params.institutionId, params.examId)}/results`)
    }
  }
}

export function saveSCTResponses(): Action<ExaminationSummary, ExaminationSummary> {
  return {
    key: ['sctResults'],
    request: async (params?: {
      institutionId: string
      examId: string
      responses: SCTResponseItem[]
    }) => {
      if (!params?.institutionId || !params?.examId) {
        throw new Error('institutionId and examId are required')
      }
      const res = await appInstance.put<ExaminationSummary>(
        `${basePath(params.institutionId, params.examId)}/responses`,
        { responses: params.responses }
      )
      return res.data
    }
  }
}

export function triggerSCTScore(): Action<ExaminationSummary, ExaminationSummary> {
  return {
    key: ['sctResults'],
    request: async (params?: { institutionId: string; examId: string }) => {
      if (!params?.institutionId || !params?.examId) {
        throw new Error('institutionId and examId are required')
      }
      return await postRaw<ExaminationSummary>(
        `${basePath(params.institutionId, params.examId)}/score`
      )
    }
  }
}

export function updateSCTScore(): Action<ExaminationSummary, ExaminationSummary> {
  return {
    key: ['sctResults'],
    request: async (params?: {
      institutionId: string
      examId: string
      stemId: number
      score: number
    }) => {
      if (!params?.institutionId || !params?.examId) {
        throw new Error('institutionId and examId are required')
      }
      const res = await appInstance.patch<ExaminationSummary>(
        `${basePath(params.institutionId, params.examId)}/scores`,
        { stemId: params.stemId, score: params.score }
      )
      return res.data
    }
  }
}

export function confirmSCT(): Action<ExaminationSummary, ExaminationSummary> {
  return {
    key: ['sctResults'],
    request: async (params?: { institutionId: string; examId: string }) => {
      if (!params?.institutionId || !params?.examId) {
        throw new Error('institutionId and examId are required')
      }
      return await postRaw<ExaminationSummary>(
        `${basePath(params.institutionId, params.examId)}/confirm`
      )
    }
  }
}
