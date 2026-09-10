/**
 * 로르샤흐 검사 관련 타입 정의
 */

export interface RorschachResponse {
  id: string
  cardNumber: number
  response: string
  inquiry: string
  location: string
  determinant: string
  content: string
  popular: boolean
  special_score?: string
}

export interface RorschachResult {
  id: string
  clientId: string
  responses: RorschachResponse[]
  createdAt: string
  updatedAt: string
}

export type RorschachStep = 'response' | 'inquiry' | 'scoring' | 'result'
