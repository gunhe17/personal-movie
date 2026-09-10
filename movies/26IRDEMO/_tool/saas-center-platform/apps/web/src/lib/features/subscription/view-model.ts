/**
 * Subscription ViewModel — API 응답 → UI 표현 변환
 */

import type { SubscriptionResponse, PlanInfo, PaymentSummary } from '$lib/hooks/actions/subscription.action'
import {
  PLAN_LABELS,
  STATUS_LABELS,
  PLAN_BADGE_COLORS,
  DEFAULT_BADGE_COLOR,
  FEATURE_LABELS,
  FEATURE_DESCRIPTIONS,
  PLAN_FIT_THRESHOLD_TIGHT,
  PLAN_FIT_THRESHOLD_MODERATE,
  PLAN_FIT_THRESHOLD_COMFORTABLE,
  PLAN_FIT_MESSAGES,
} from './constants'

// ── 구독 VM (사이드바/설정 페이지 공통) ──

export interface SubscriptionVM {
  plan: string
  planLabel: string
  status: string
  statusLabel: string
  badgeBg: string
  badgeText: string
  isFree: boolean
  isPaid: boolean
  features: string[]
  featureLabels: string[]
  creditLimit: number
  periodLabel: string
  /** 다운그레이드 예약 정보 */
  hasReservedDowngrade: boolean
  reservedPlanLabel: string | null
  reservedAt: string | null
  /** 결제가 예정된 상태인가 (active, pending_payment) */
  willRenew: boolean
  /** 플랜 변경 승인 대기 중인가 */
  isPending: boolean
  pendingPlanLabel: string | null
}

/** plans 배열에서 plan 코드로 PlanInfo를 빠르게 찾기 위한 룩업 맵 생성 */
function buildPlanLookup(plans?: PlanInfo[] | null): Map<string, PlanInfo> {
  if (!plans) return new Map()
  return new Map(plans.map(p => [p.plan, p]))
}

export function mapToSubscriptionVM(data: SubscriptionResponse, plans?: PlanInfo[] | null): SubscriptionVM {
  const lookup = buildPlanLookup(plans)
  const planInfo = lookup.get(data.plan)
  const reservedPlanInfo = data.reserved_plan ? lookup.get(data.reserved_plan) : null

  // API meta 우선, 하드코딩 폴백
  const badge = planInfo?.meta?.badge_bg
    ? { bg: planInfo.meta.badge_bg, text: planInfo.meta.badge_text }
    : (PLAN_BADGE_COLORS[data.plan] ?? DEFAULT_BADGE_COLOR)
  const features = data.limits.features ?? []
  const fLabels = planInfo?.meta?.feature_labels ?? {}

  const start = new Date(data.current_period_start)
  const end = new Date(data.current_period_end)
  const fmt = (d: Date) => `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`

  return {
    plan: data.plan,
    planLabel: planInfo?.label ?? PLAN_LABELS[data.plan] ?? data.plan,
    status: data.status,
    statusLabel: STATUS_LABELS[data.status] ?? data.status,
    badgeBg: badge.bg,
    badgeText: badge.text,
    isFree: data.plan === 'free',
    isPaid: data.plan !== 'free',
    features,
    featureLabels: features.map(f => fLabels[f] ?? FEATURE_LABELS[f] ?? f),
    creditLimit: data.limits.credit_limit,
    periodLabel: `${fmt(start)} ~ ${fmt(end)}`,
    hasReservedDowngrade: data.status !== 'pending' && !!data.reserved_plan,
    reservedPlanLabel: data.reserved_plan
      ? (reservedPlanInfo?.label ?? PLAN_LABELS[data.reserved_plan] ?? data.reserved_plan)
      : null,
    reservedAt: data.reserved_at ?? null,
    willRenew: ['active', 'pending_payment'].includes(data.status),
    isPending: data.status === 'pending',
    pendingPlanLabel: data.status === 'pending' && data.reserved_plan
      ? (reservedPlanInfo?.label ?? PLAN_LABELS[data.reserved_plan] ?? data.reserved_plan)
      : null,
  }
}

/**
 * 플랜에 특정 기능이 포함되는지 확인.
 * Backend의 is_feature_allowed()와 동일한 클라이언트 사이드 체크.
 */
export function hasFeature(sub: SubscriptionVM | null, feature: string): boolean {
  if (!sub) return false
  return sub.features.includes(feature)
}

// ── 플랜 비교 카드용 VM ──

export interface PlanFeatureItem {
  key: string
  label: string
  description: string
  included: boolean
}

export interface PlanCardVM {
  plan: string
  label: string
  tagline: string
  audience: string
  isRecommended: boolean
  priceLabel: string
  priceSuffix: string
  creditLimit: number
  creditLabel: string
  creditHint: string
  hasCredit: boolean
  features: string[]
  featureLabels: string[]
  /** AI 기능 포함/미포함 목록 (주요 비교 항목) */
  aiFeatures: PlanFeatureItem[]
  /** 운영/부가 기능 포함/미포함 목록 */
  extraFeatures: PlanFeatureItem[]
  /** 기본 포함 기능 설명 (feature flag 아닌 것) */
  baseFeatures: string[]
  /** 이전 플랜 대비 새로 추가되는 혜택 */
  additions: string[]
  /** 포함하는 하위 플랜 라벨 (null이면 기본 플랜) */
  basePlanLabel: string | null
  isCurrent: boolean
  isUpgrade: boolean
  isDowngrade: boolean
  badgeBg: string
  badgeText: string
}

/** 크레딧 양에 대한 직관적 힌트 (1건당 약 10크레딧 기준) */
function getCreditHint(credit: number): string {
  if (credit <= 0) return ''
  const approx = Math.floor(credit / 10)
  return `약 ${approx}건 상담 분석 가능`
}

// ── 사용량 기반 플랜 적합도 ──

export interface PlanFitInsight {
  /** 현재 사용량 대비 플랜 여유도 (%) — 높을수록 여유 */
  headroom: number
  /** 일평균 사용 크레딧 */
  dailyAvgUsage: number
  /** 예상 소진일 (현재 속도 기준, 0이면 소진 안 됨) */
  estimatedDepletionDays: number
  /** 플랜 적합도 메시지 */
  fitMessage: string
  /** 현재 플랜 대비 크레딧 차이 */
  creditDiffFromCurrent: number
}

export function calcPlanFitInsight(
  planCreditLimit: number,
  creditUsed: number,
  creditLimit: number,
  daysElapsed: number,
  daysTotal: number,
): PlanFitInsight {
  const dailyAvg = daysElapsed > 0 ? creditUsed / daysElapsed : 0
  const daysRemaining = daysTotal - daysElapsed

  // 이 플랜에서의 예상 소진일
  let estimatedDepletionDays = 0
  if (dailyAvg > 0 && planCreditLimit > 0) {
    estimatedDepletionDays = Math.floor(planCreditLimit / dailyAvg)
  }

  // 여유도: 이 플랜이면 기간 내 얼마나 여유가 있는지
  const projectedMonthlyUsage = dailyAvg * daysTotal
  const headroom = planCreditLimit > 0 && projectedMonthlyUsage > 0
    ? Math.round(((planCreditLimit - projectedMonthlyUsage) / planCreditLimit) * 100)
    : 100

  // 적합도 메시지
  let fitMessage = ''
  if (dailyAvg === 0) {
    fitMessage = ''
  } else if (headroom < PLAN_FIT_THRESHOLD_TIGHT) {
    fitMessage = PLAN_FIT_MESSAGES.insufficient
  } else if (headroom < PLAN_FIT_THRESHOLD_MODERATE) {
    fitMessage = PLAN_FIT_MESSAGES.tight
  } else if (headroom < PLAN_FIT_THRESHOLD_COMFORTABLE) {
    fitMessage = PLAN_FIT_MESSAGES.comfortable
  } else {
    fitMessage = PLAN_FIT_MESSAGES.plenty
  }

  return {
    headroom,
    dailyAvgUsage: Math.round(dailyAvg),
    estimatedDepletionDays,
    fitMessage,
    creditDiffFromCurrent: planCreditLimit - creditLimit,
  }
}

// ── 결제 이력 VM ──

export interface PaymentVM {
  id: string
  planLabel: string
  amount: string
  statusLabel: string
  statusColor: string
  method: string
  date: string
}

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: '대기',
  confirmed: '완료',
  failed: '실패',
  cancelled: '취소',
}

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  pending: 'text-amber-600',
  confirmed: 'text-green-600',
  failed: 'text-red-600',
  cancelled: 'text-gray-500',
}

export function mapToPaymentVM(item: PaymentSummary, plans?: PlanInfo[] | null): PaymentVM {
  const lookup = buildPlanLookup(plans)
  const d = item.paid_at ? new Date(item.paid_at) : new Date(item.created_at)
  const fmt = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`

  return {
    id: item.id,
    planLabel: lookup.get(item.plan)?.label ?? PLAN_LABELS[item.plan] ?? item.plan,
    amount: `₩${item.amount.toLocaleString()}`,
    statusLabel: PAYMENT_STATUS_LABELS[item.status] ?? item.status,
    statusColor: PAYMENT_STATUS_COLORS[item.status] ?? 'text-gray-500',
    method: item.method ?? '-',
    date: fmt,
  }
}

/**
 * 전체 플랜에서 기능 키를 수집하여 AI 기능과 운영 기능으로 분류.
 * ai_* 접두사 → AI 기능 (모든 플랜에서 포함/미포함 비교 표시)
 * 그 외 → 운영/부가 기능 (포함된 플랜에서만 표시)
 */
function deriveFeatureKeys(plans: PlanInfo[]): { aiKeys: string[]; extraKeys: string[] } {
  const allKeys = new Set<string>()
  for (const p of plans) {
    for (const f of (p.limits.features ?? [])) allKeys.add(f)
  }
  const aiKeys: string[] = []
  const extraKeys: string[] = []
  for (const key of allKeys) {
    if (key.startsWith('ai_')) aiKeys.push(key)
    else extraKeys.push(key)
  }
  aiKeys.sort()
  extraKeys.sort()
  return { aiKeys, extraKeys }
}

/**
 * 플랜 전체에서 통합된 feature_labels / feature_descriptions 맵을 생성.
 * 여러 플랜의 meta를 합산하여 가장 완전한 라벨셋을 확보.
 */
function mergeFeatureMeta(plans: PlanInfo[]): {
  labels: Record<string, string>
  descriptions: Record<string, string>
} {
  const labels: Record<string, string> = {}
  const descriptions: Record<string, string> = {}
  for (const p of plans) {
    const meta = p.meta
    if (meta?.feature_labels) Object.assign(labels, meta.feature_labels)
    if (meta?.feature_descriptions) Object.assign(descriptions, meta.feature_descriptions)
  }
  return { labels, descriptions }
}

export function mapToPlanCards(plans: PlanInfo[], currentPlan: string): PlanCardVM[] {
  // API 반환 순서(plan_order ASC)를 활용하여 upgrade/downgrade 판단
  const orderMap = Object.fromEntries(plans.map((p, i) => [p.plan, i]))
  const currentOrder = orderMap[currentPlan] ?? 0

  // 전체 플랜에서 기능 키 동적 분류
  const { aiKeys, extraKeys } = deriveFeatureKeys(plans)
  const merged = mergeFeatureMeta(plans)

  return plans.map((p, idx) => {
    // API meta가 있으면 사용, 없으면 하드코딩 폴백
    const meta = p.meta
    const fLabels = meta?.feature_labels ?? {}
    const fDescs = meta?.feature_descriptions ?? {}
    const badge = meta?.badge_bg
      ? { bg: meta.badge_bg, text: meta.badge_text }
      : (PLAN_BADGE_COLORS[p.plan] ?? DEFAULT_BADGE_COLOR)
    const order = idx
    const features = p.limits.features ?? []
    const featureSet = new Set(features)
    const hasCredit = p.limits.credit_limit > 0

    // AI 기능과 운영 기능을 분리 (라벨: 플랜 meta → 전체 통합 meta → 하드코딩 폴백)
    const aiFeatures: PlanFeatureItem[] = aiKeys.map(key => ({
      key,
      label: fLabels[key] ?? merged.labels[key] ?? FEATURE_LABELS[key] ?? key,
      description: fDescs[key] ?? merged.descriptions[key] ?? FEATURE_DESCRIPTIONS[key] ?? '',
      included: featureSet.has(key),
    }))

    const extraFeatures: PlanFeatureItem[] = extraKeys
      .filter(key => featureSet.has(key))
      .map(key => ({
        key,
        label: fLabels[key] ?? merged.labels[key] ?? FEATURE_LABELS[key] ?? key,
        description: fDescs[key] ?? merged.descriptions[key] ?? FEATURE_DESCRIPTIONS[key] ?? '',
        included: true,
      }))

    return {
      plan: p.plan,
      label: p.label,
      tagline: meta?.tagline ?? '',
      audience: meta?.audience ?? '',
      isRecommended: meta?.is_recommended ?? false,
      priceLabel: p.price_monthly === 0
        ? '무료'
        : `₩${p.price_monthly.toLocaleString()}`,
      priceSuffix: (p.price_monthly === 0) ? '' : '/월',
      creditLimit: p.limits.credit_limit,
      creditLabel: hasCredit ? `${p.limits.credit_limit.toLocaleString()}` : '미포함',
      creditHint: getCreditHint(p.limits.credit_limit),
      hasCredit,
      features,
      featureLabels: features.map(f => fLabels[f] ?? merged.labels[f] ?? FEATURE_LABELS[f] ?? f),
      aiFeatures,
      extraFeatures,
      baseFeatures: meta?.base_features ?? [],
      additions: meta?.additions ?? [],
      basePlanLabel: meta?.base_plan ? (plans.find(pl => pl.plan === meta.base_plan)?.label ?? meta.base_plan) : null,
      isCurrent: p.plan === currentPlan,
      isUpgrade: order > currentOrder,
      isDowngrade: order < currentOrder,
      badgeBg: badge.bg,
      badgeText: badge.text,
    }
  })
}
