/**
 * 검사 통계 페이지 타입 정의
 */

// 통계 요약 카드 데이터
export interface StatsSummary {
  label: string
  value: number
  // 증감 표시 (어제보다 N건)
  trendValue?: number
  trendLabel?: string
  // 비율 표시 (전체 대비 N%)
  percentageValue?: number
  percentageLabel?: string
}

// 바 차트 데이터 아이템
export interface BarChartItem {
  label: string
  value: number
}

// 도넛 차트 데이터 아이템
export interface DonutChartItem {
  label: string
  value: number
  color?: string
}

// 차트 툴팁 데이터
export interface TooltipData {
  label: string
  value: number
  x: number
  y: number
}

// 통계 필터 상태
export interface StatisticsFilters {
  period: 'daily' | 'weekly' | 'monthly'
  startDate: string
  endDate: string
}
