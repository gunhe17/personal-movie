// 실험 결과 카드용 공유 타입 (lab 페이지 ↔ ResultCard 공유)
export interface TestResult {
  index: number
  content: string
  model: string
  latencyMs: number
  costUsd: number
  experimentId: string
  inputText: string
  systemPrompt: string
  stepKey?: string
  versionName?: string
  isStt?: boolean
  outputJson?: string // STT 화자분리 세그먼트(JSON)
  sampleId?: string // 정답/정확도 측정용
}
