/**
 * 플랫폼 설정 API Actions
 */
import { get, patch } from '$services/api/instances'

// ── 타입 ──

export interface PlatformSettingsResponse {
  trial_duration_days: number
  trial_plan: string
  credit_cycle_days: number
  quota_grace_days: number
}

export interface PlanConfigItem {
  id: string
  plan_type: string
  label: string
  price_monthly: number
  credit_limit: number
  features: string[]
  plan_order: number
  is_active: boolean
  // UI 메타데이터
  tagline: string | null
  audience: string | null
  is_recommended: boolean
  base_features: string[]
  additions: string[]
  base_plan: string | null
  badge_bg: string | null
  badge_text: string | null
  feature_labels: Record<string, string>
  feature_descriptions: Record<string, string>
}

export interface PlanConfigListResponse {
  items: PlanConfigItem[]
}

// ── 시스템 설정 ──

export const getPlatformSettings = () => ({
  key: ['getPlatformSettings'],
  request: async () => {
    return get<PlatformSettingsResponse>('/admin/platform-settings')
  },
})

export const patchPlatformSettings = () => ({
  key: ['patchPlatformSettings', 'getPlatformSettings'],
  request: async (params: Partial<PlatformSettingsResponse>) => {
    return patch<PlatformSettingsResponse>('/admin/platform-settings', params)
  },
})

// ── 플랜 설정 ──

export const getPlanConfigs = () => ({
  key: ['getPlanConfigs'],
  request: async () => {
    return get<PlanConfigListResponse>('/admin/platform-settings/plans')
  },
})

export const patchPlanConfig = () => ({
  key: ['patchPlanConfig', 'getPlanConfigs'],
  request: async (params: {
    planType: string
    label?: string
    price_monthly?: number
    credit_limit?: number
    features?: string[]
    plan_order?: number
    is_active?: boolean
    tagline?: string
    audience?: string
    is_recommended?: boolean
    base_features?: string[]
    additions?: string[]
    base_plan?: string | null
    badge_bg?: string
    badge_text?: string
    feature_labels?: Record<string, string>
    feature_descriptions?: Record<string, string>
  }) => {
    const { planType, ...body } = params
    return patch<PlanConfigItem>(`/admin/platform-settings/plans/${planType}`, body)
  },
})
