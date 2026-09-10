// ─── 셀렉트 옵션 ───

export const TYPE_OPTIONS = [
  { value: 'objective', title: '객관 검사' },
  { value: 'projective', title: '투사 검사' },
  { value: 'intelligence', title: '지능 검사' },
  { value: 'developmental', title: '발달 검사' }
]

export const STATUS_OPTIONS = [
  { value: 'private', title: '비공개' },
  { value: 'public', title: '공개' },
  { value: 'draft', title: '초안' }
]

export const WORKFLOW_OPTIONS = [
  { value: 'self_report', title: '자가응답 + 자동채점' },
  { value: 'external_service', title: '외부 서비스' }
]

// ─── definition.type 옵션 ───

export const DEFINITION_TYPE_OPTIONS = [
  { value: 'choice', title: '선택지형 (객관검사)' },
  { value: 'sentence_completion', title: '문장완성형 (SCT)' }
]

export const DEFINITION_TYPE_LABELS: Record<string, string> = {
  choice: '선택지형 (객관검사)',
  sentence_completion: '문장완성형 (SCT)'
}

// ─── 라벨 매핑 ───

export const TYPE_LABELS: Record<string, string> = {
  objective: '객관 검사',
  projective: '투사 검사',
  intelligence: '지능 검사',
  developmental: '발달 검사'
}

export const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  public: { label: '공개', bg: 'bg-green-50', text: 'text-green-700' },
  private: { label: '비공개', bg: 'bg-gray-100', text: 'text-gray-600' },
  draft: { label: '초안', bg: 'bg-yellow-50', text: 'text-yellow-700' }
}

export const WORKFLOW_LABELS: Record<string, string> = {
  self_report: '자가응답 + 자동채점',
  external_service: '외부 서비스'
}
