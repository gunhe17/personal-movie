/**
 * Admin 기능 테스트 상수 — Agent 제외, 4개 기능만
 */

export type FeatureTestId = 'stt' | 'summary' | 'note' | 'case'

export interface FeatureCard {
  id: string
  name: string
  description: string
  icon: { bg: string; text: string }
  estimatedCredits: string
  color: string
}

export const FEATURES: FeatureCard[] = [
  {
    id: 'stt',
    name: '음성 분석',
    description: '필드노트 녹음을 텍스트로 변환(STT)하고 정제합니다. 크레딧 차감 없음.',
    icon: { bg: 'bg-emerald-100', text: 'text-emerald-600' },
    estimatedCredits: '무료 (STT·정제)',
    color: 'bg-emerald-500 hover:bg-emerald-600',
  },
  {
    id: 'summary',
    name: '요약 생성',
    description: '정제된 텍스트를 기반으로 상담 세션의 핵심 요약을 생성합니다.',
    icon: { bg: 'bg-sky-100', text: 'text-sky-600' },
    estimatedCredits: '~7',
    color: 'bg-sky-500 hover:bg-sky-600',
  },
  {
    id: 'note',
    name: '상담일지 생성',
    description: '필드노트를 기반으로 구조화된 상담일지(SOAP, DAP, BIRP 등)를 자동 생성합니다.',
    icon: { bg: 'bg-indigo-100', text: 'text-indigo-600' },
    estimatedCredits: '~8',
    color: 'bg-indigo-500 hover:bg-indigo-600',
  },
  {
    id: 'case',
    name: '사례 분석',
    description: '상담 케이스의 다수 세션을 종단 분석하여 반복 주제, 감정 변화, 개입 효과를 파악합니다.',
    icon: { bg: 'bg-pink-100', text: 'text-pink-600' },
    estimatedCredits: '~11',
    color: 'bg-pink-500 hover:bg-pink-600',
  },
]

// ── 플로우 단계 ──

export interface FlowStepDef {
  key: string
  label: string
  description: string
}

export const STT_FLOW_STEPS: FlowStepDef[] = [
  { key: 'audio', label: '오디오', description: '녹음 원본' },
  { key: 'transcribe', label: '전사 (STT)', description: '음성→텍스트' },
  { key: 'refine', label: '정제', description: '텍스트 정리' },
]

export const SUMMARY_FLOW_STEPS: FlowStepDef[] = [
  { key: 'input', label: '정제 텍스트', description: '필드노트 정제본' },
  { key: 'summary', label: 'AI 요약', description: '핵심 내용 추출' },
]

export const NOTE_FLOW_STEPS: FlowStepDef[] = [
  { key: 'input', label: '정제 텍스트', description: '필드노트 정제본' },
  { key: 'note', label: 'AI 상담일지', description: '구조화된 일지 생성' },
]

export const CASE_FLOW_STEPS: FlowStepDef[] = [
  { key: 'input', label: '케이스 데이터', description: '세션/일지 수집' },
  { key: 'analysis', label: 'AI 분석', description: '종단 분석 실행' },
  { key: 'report', label: '분석 보고서', description: '구조화된 결과' },
]

// ── 실행 상태 스타일 ──

export const EXECUTION_STATUS_STYLES = {
  success: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700' },
  error: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-100 text-red-700' },
  running: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-700' },
} as const

export const DEFAULT_TOKENS_PER_CREDIT = 2000
