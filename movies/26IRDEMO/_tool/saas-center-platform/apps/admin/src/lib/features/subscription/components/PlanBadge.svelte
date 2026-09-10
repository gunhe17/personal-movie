<script lang="ts">
  import { PLAN_LABELS, PLAN_BADGE_COLORS } from '../constants'
  import type { PlanConfigItem } from '$hooks/actions/platform-settings.action'

  interface Props {
    plan: string
    size?: 'sm' | 'md'
    /** API에서 가져온 플랜 설정 (있으면 우선 사용) */
    planConfig?: PlanConfigItem | null
  }

  let { plan, size = 'md', planConfig = null }: Props = $props()

  const label = $derived(planConfig?.label ?? PLAN_LABELS[plan] ?? plan)
  const colors = $derived(
    planConfig?.badge_bg
      ? { bg: planConfig.badge_bg, text: planConfig.badge_text ?? '' }
      : (PLAN_BADGE_COLORS[plan] ?? PLAN_BADGE_COLORS.free)
  )
</script>

<span
  class="inline-flex items-center rounded-full font-medium
    {colors.bg} {colors.text}
    {size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'}"
>
  {label}
</span>
