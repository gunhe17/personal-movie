import type {
  AiUsageSummary,
  MonthlyUsageItem,
  FeatureUsageItem,
  CenterUsageItem,
} from '$hooks/actions/ai-usage.action'

// ─── 기본 목업 ────────────────────────────────────────

export const MOCK_SUMMARY: AiUsageSummary = {
  total_tokens: 18_420_000,
  total_cost: 2_340_000,
  total_calls: 8_714,
  active_models: 5,
  total_audio_minutes: 312,
  prev_total_tokens: 14_100_000,
  prev_total_cost: 1_560_000,
  prev_total_calls: 6_230,
  prev_audio_minutes: 244,
  token_change_pct: 30.6,
  cost_change_pct: 50.0,
  call_change_pct: 39.9,
  audio_change_pct: 27.9,
}

export const MOCK_MONTHLY: MonthlyUsageItem[] = [
  { month: '2026-06', input_tokens: 11_200_000, output_tokens: 7_220_000, total_tokens: 18_420_000, estimated_cost: 2_340_000, call_count: 8_714, audio_minutes: 312 },
  { month: '2026-05', input_tokens:  8_600_000, output_tokens: 5_500_000, total_tokens: 14_100_000, estimated_cost: 1_560_000, call_count: 6_230, audio_minutes: 244 },
  { month: '2026-04', input_tokens:  7_200_000, output_tokens: 4_800_000, total_tokens: 12_000_000, estimated_cost: 1_320_000, call_count: 5_410, audio_minutes: 198 },
  { month: '2026-03', input_tokens:  6_100_000, output_tokens: 3_900_000, total_tokens: 10_000_000, estimated_cost: 1_100_000, call_count: 4_870, audio_minutes: 166 },
  { month: '2026-02', input_tokens:  4_300_000, output_tokens: 2_700_000, total_tokens:  7_000_000, estimated_cost:   770_000, call_count: 3_120, audio_minutes: 101 },
  { month: '2026-01', input_tokens:  3_800_000, output_tokens: 2_200_000, total_tokens:  6_000_000, estimated_cost:   660_000, call_count: 2_740, audio_minutes:  88 },
]

export const MOCK_FEATURES: FeatureUsageItem[] = [
  { purpose: 'field_note',       feature: '필드노트',  model: 'claude-sonnet-4', provider: 'anthropic', status: 'active',   monthly_tokens: 6_200_000, total_tokens: 31_000_000, monthly_cost: 890_000, call_count: 3_210, avg_latency_ms: 1_840, monthly_audio_minutes: 312, total_audio_minutes: 1_520, monthly_credits: 6200, total_credits: 31000 },
  { purpose: 'case_analysis',    feature: '사례분석',  model: 'claude-sonnet-4', provider: 'anthropic', status: 'active',   monthly_tokens: 4_800_000, total_tokens: 24_000_000, monthly_cost: 680_000, call_count: 2_480, avg_latency_ms: 2_100, monthly_audio_minutes:   0, total_audio_minutes:     0, monthly_credits: 4800, total_credits: 24000 },
  { purpose: 'agent-counseling', feature: 'AI Agent', model: 'gpt-4o',          provider: 'openai',    status: 'active',   monthly_tokens: 2_900_000, total_tokens: 14_500_000, monthly_cost: 420_000, call_count: 1_820, avg_latency_ms: 3_200, monthly_audio_minutes:   0, total_audio_minutes:     0, monthly_credits: 2900, total_credits: 14500 },
  { purpose: 'stt',              feature: 'STT 변환',  model: 'whisper-large',   provider: 'openai',    status: 'active',   monthly_tokens:        0, total_tokens:         0, monthly_cost: 170_000, call_count:   264, avg_latency_ms: 4_500, monthly_audio_minutes: 312, total_audio_minutes: 1_520, monthly_credits:    0, total_credits:     0 },
  { purpose: 'summary',          feature: '요약',      model: 'claude-haiku-4',  provider: 'anthropic', status: 'inactive', monthly_tokens: 1_200_000, total_tokens:  6_000_000, monthly_cost:  90_000, call_count:   480, avg_latency_ms:   620, monthly_audio_minutes:   0, total_audio_minutes:     0, monthly_credits: 1200, total_credits:  6000 },
]

export const MOCK_CENTERS: CenterUsageItem[] = [
  { center_id: 'c1', center_name: '마음건강 심리상담센터',  total_tokens: 4_200_000, estimated_cost: 580_000, call_count: 2_140, audio_minutes: 88 },
  { center_id: 'c2', center_name: '서울 가족상담연구소',    total_tokens: 3_100_000, estimated_cost: 430_000, call_count: 1_620, audio_minutes: 62 },
  { center_id: 'c3', center_name: '강남 심리치료센터',      total_tokens: 2_800_000, estimated_cost: 390_000, call_count: 1_480, audio_minutes: 55 },
  { center_id: 'c4', center_name: '행복심리상담클리닉',     total_tokens: 2_200_000, estimated_cost: 310_000, call_count: 1_100, audio_minutes: 42 },
  { center_id: 'c5', center_name: '트라우마 치유 연구소',   total_tokens: 1_900_000, estimated_cost: 270_000, call_count:   930, audio_minutes: 36 },
  { center_id: 'c6', center_name: '청소년 마음 케어센터',   total_tokens: 1_600_000, estimated_cost: 230_000, call_count:   790, audio_minutes: 29 },
  { center_id: 'c7', center_name: '부산 온마음 상담소',     total_tokens: 1_200_000, estimated_cost: 190_000, call_count:   620, audio_minutes:  0 },
  { center_id: 'c8', center_name: '한마음 심리발달센터',    total_tokens:   980_000, estimated_cost: 140_000, call_count:   530, audio_minutes:  0 },
]

// ─── 포맷 유틸 ─────────────────────────────────────────

export function fmtKRW(n: number): string {
  if (n >= 10_000) return `${Math.round(n / 10_000).toLocaleString('ko-KR')}만원`
  return `${n.toLocaleString('ko-KR')}원`
}

export function fmtNum(n: number): string {
  return n.toLocaleString('ko-KR')
}

export function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${Math.round(n / 1_000)}K`
  return fmtNum(n)
}

// ─── 전월 대비 변동 Config ─────────────────────────────

export interface ChangeBadge {
  label: string
  bg: string
  text: string
  dot: string
}

export function costChangeBadge(pct: number | null): ChangeBadge | null {
  if (pct == null) return null
  if (Math.abs(pct) < 1) return { label: '유지', bg: 'bg-gray-100', text: 'text-gray-500', dot: 'bg-gray-400' }
  if (pct > 0) return { label: `↑ +${Math.round(pct)}%`, bg: 'bg-red-50', text: 'text-red-600', dot: 'bg-red-500' }
  return { label: `↓ ${Math.round(pct)}%`, bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500' }
}

// 기능별 상태 Config
export const FEATURE_STATUS_CONFIG = {
  active:   { label: '활성',   bg: 'bg-green-50',  text: 'text-green-700', dot: 'bg-green-500' },
  inactive: { label: '비활성', bg: 'bg-gray-100',  text: 'text-gray-500', dot: 'bg-gray-400'  },
} as const

export function featureStatusConfig(status: string) {
  return FEATURE_STATUS_CONFIG[status as keyof typeof FEATURE_STATUS_CONFIG] ?? FEATURE_STATUS_CONFIG.inactive
}

// 월 선택 옵션
export const MONTH_OPTIONS = MOCK_MONTHLY.map((m) => ({
  value: m.month,
  title: `${m.month.slice(0, 4)}년 ${Number(m.month.slice(5))}월`,
}))

// ─── 원가 대비 수익 (마진 분석) ───────────────────────

// 1 크레딧 = 150원으로 책정 (centers가 구독/크레딧으로 지불하는 단위 가격)
// STT는 분당 500원으로 별도 과금
export const CREDIT_PRICE_KRW = 150
export const STT_PRICE_PER_MIN = 500

export interface FeatureMockExt {
  purpose: string
  error_count: number       // 이번달 실패 건수
  error_rate_pct: number    // 실패율 (%)
  revenue_krw: number       // 크레딧 × 단가 (센터 청구액)
  margin_pct: number        // (revenue - cost) / revenue × 100
}

// field_note:       6200 credits × 150 = 930,000원 매출 vs 890,000원 비용 → +4.3%
// case_analysis:    4800 credits × 150 = 720,000원 매출 vs 680,000원 비용 → +5.6%
// agent-counseling: 2900 credits × 150 = 435,000원 매출 vs 420,000원 비용 → +3.4%
// stt:               312 min × 500     = 156,000원 매출 vs 170,000원 비용 → -8.2%
// summary:          1200 credits × 150 = 180,000원 매출 vs  90,000원 비용 → +50%
export const MOCK_FEATURE_EXT: FeatureMockExt[] = [
  { purpose: 'field_note',       error_count: 12, error_rate_pct: 0.4, revenue_krw: 930_000, margin_pct:  4.3 },
  { purpose: 'case_analysis',    error_count:  8, error_rate_pct: 0.3, revenue_krw: 720_000, margin_pct:  5.6 },
  { purpose: 'agent-counseling', error_count: 43, error_rate_pct: 2.4, revenue_krw: 435_000, margin_pct:  3.4 },
  { purpose: 'stt',              error_count:  7, error_rate_pct: 2.6, revenue_krw: 156_000, margin_pct: -8.2 },
  { purpose: 'summary',          error_count:  2, error_rate_pct: 0.4, revenue_krw: 180_000, margin_pct: 50.0 },
]

// 전체 요약 수치
// 총 매출: 930K+720K+435K+156K+180K = 2,421,000원
// 총 비용: 2,340,000원
// 순이익: +81,000원 (+3.3%)
// 총 실패: 12+8+43+7+2 = 72건 (전체 호출의 0.83%)
export const MOCK_SUMMARY_EXT = {
  total_revenue_krw: 2_421_000,
  net_profit_krw: 81_000,
  margin_pct: 3.3,
  total_error_count: 72,
  total_error_rate_pct: 0.8,
}

// ─── 이상 탐지 (Anomaly Detection) ────────────────────

export interface CenterMockExt {
  center_id: string
  prev_call_count: number   // 전월 호출 수
  call_spike_pct: number    // 전월 대비 증가율 (%)
  is_anomaly: boolean       // 100% 이상 증가 → 이상 탐지
}

// 강남 심리치료센터: 620 → 1480 = +139% → 이상 탐지
export const MOCK_CENTER_EXT: CenterMockExt[] = [
  { center_id: 'c1', prev_call_count: 1_200, call_spike_pct:  78.3, is_anomaly: false },
  { center_id: 'c2', prev_call_count: 1_580, call_spike_pct:   2.5, is_anomaly: false },
  { center_id: 'c3', prev_call_count:   620, call_spike_pct: 138.7, is_anomaly: true  },
  { center_id: 'c4', prev_call_count: 1_050, call_spike_pct:   4.8, is_anomaly: false },
  { center_id: 'c5', prev_call_count:   890, call_spike_pct:   4.5, is_anomaly: false },
  { center_id: 'c6', prev_call_count:   760, call_spike_pct:   3.9, is_anomaly: false },
  { center_id: 'c7', prev_call_count:   580, call_spike_pct:   6.9, is_anomaly: false },
  { center_id: 'c8', prev_call_count:   510, call_spike_pct:   3.9, is_anomaly: false },
]

// ─── 확장 데이터 조회 헬퍼 ─────────────────────────────

export function featureExt(purpose: string): FeatureMockExt | undefined {
  return MOCK_FEATURE_EXT.find((e) => e.purpose === purpose)
}

export function centerExt(centerId: string): CenterMockExt | undefined {
  return MOCK_CENTER_EXT.find((e) => e.center_id === centerId)
}

// ─── 뱃지 Config 헬퍼 ─────────────────────────────────

// 마진: ≥20% 초록 | 0~20% 노랑 | <0% 빨강
export function marginConfig(pct: number): ChangeBadge {
  if (pct >= 20) return { label: `마진 +${Math.round(pct)}%`, bg: 'bg-green-50',  text: 'text-green-700',  dot: 'bg-green-500'  }
  if (pct >=  0) return { label: `마진 +${Math.round(pct)}%`, bg: 'bg-yellow-50', text: 'text-yellow-700', dot: 'bg-yellow-500' }
  return               { label: `마진 ${Math.round(pct)}%`,   bg: 'bg-red-50',    text: 'text-red-600',    dot: 'bg-red-500'    }
}

// 에러율: ≥2% 빨강 | 0.5~2% 노랑 | <0.5% 정상(회색)
export function errorRateConfig(count: number, pct: number): ChangeBadge {
  if (pct >= 2)   return { label: `실패 ${fmtNum(count)}건 (${pct.toFixed(1)}%)`, bg: 'bg-red-50',    text: 'text-red-600',    dot: 'bg-red-500'    }
  if (pct >= 0.5) return { label: `실패 ${fmtNum(count)}건 (${pct.toFixed(1)}%)`, bg: 'bg-yellow-50', text: 'text-yellow-700', dot: 'bg-yellow-500' }
  return               { label: `실패 ${fmtNum(count)}건 (${pct.toFixed(1)}%)`,  bg: 'bg-gray-100',  text: 'text-gray-400',   dot: 'bg-gray-300'   }
}

// 급증 탐지: ≥100% 빨강 | ≥50% 노랑 | 나머지 null
export function spikeConfig(pct: number): ChangeBadge | null {
  if (pct >= 100) return { label: `급증 +${Math.round(pct)}%`, bg: 'bg-red-50',    text: 'text-red-600',    dot: 'bg-red-500'    }
  if (pct >=  50) return { label: `급증 +${Math.round(pct)}%`, bg: 'bg-yellow-50', text: 'text-yellow-700', dot: 'bg-yellow-500' }
  return null
}
