export type SignalTone = 'red' | 'amber' | 'green'

/** 처리 직후 그 자리에 남는 다음 행동 — 완료한 회기를 이어서 청구하는 식 */
export interface SignalRowFollowUp {
  note: string
  actions: SignalRowAction[]
}

export interface SignalRowAction {
  label: string
  tone: 'primary' | 'neutral' | 'mint'
  /**
   * true = 처리 완료(행이 빠진다) · false = 그대로(모달 취소 등)
   * FollowUp = 처리했지만 이어질 행동이 있다(행이 후속 액션으로 바뀐다)
   */
  run: () => Promise<boolean | SignalRowFollowUp>
}

/** 펼친 목록의 한 줄 = 처리 대상 하나 */
export interface SignalRow {
  id: string
  title: string
  meta: string
  actions: SignalRowAction[]
}

export interface DashboardSignal {
  id: string
  tone: SignalTone
  count: number
  unit: string
  noun: string
  /** 이게 왜 떴는지 — 판정 근거 */
  why: string
  href: string
  rows: SignalRow[]
}

// 건수 배지 — 색이 심각도를 나르고 숫자를 강조한다
export const COUNT_TONE: Record<SignalTone, string> = {
  red: 'bg-red-50 text-red-600',
  amber: 'bg-amber-50 text-amber-700',
  green: 'bg-green-50 text-green-700'
}

export const ROW_ACTION_TONE: Record<SignalRowAction['tone'], string> = {
  primary:
    'text-primary-500 ring-1 ring-inset ring-primary-200 hover:bg-primary-50',
  neutral: 'text-gray-600 ring-1 ring-inset ring-gray-200 hover:bg-gray-50',
  mint: 'text-mint-500 ring-1 ring-inset ring-mint-200 hover:bg-mint-50'
}

/** 펼침 목록에 한 번에 담는 행 수 — 나머지는 전체 목록으로 */
export const SIGNAL_ROW_LIMIT = 5
