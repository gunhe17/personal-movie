<script lang="ts">
  import { browser } from '$app/environment'
  import { CREDIT_USAGE_THRESHOLDS } from '../constants'

  interface Props {
    value: number
    size?: number
    label?: string
    animated?: boolean
  }

  let { value, size = 120, label, animated = true }: Props = $props()

  // 반원: M 10 60 A 50 50 0 0 1 110 60
  const arcLength = Math.PI * 50 // ~157.08

  const dashoffset = $derived(arcLength * (1 - Math.min(value, 100) / 100))

  const strokeColor = $derived(
    value >= CREDIT_USAGE_THRESHOLDS.DANGER
      ? '#ef4444'
      : value >= CREDIT_USAGE_THRESHOLDS.WARNING
        ? '#fbbf24'
        : '#3b82f6'
  )

  const textColor = $derived(
    value >= CREDIT_USAGE_THRESHOLDS.DANGER
      ? 'fill-red-600'
      : value >= CREDIT_USAGE_THRESHOLDS.WARNING
        ? 'fill-amber-600'
        : 'fill-gray-800'
  )

  let mounted = $state(false)

  $effect(() => {
    if (browser && animated) {
      requestAnimationFrame(() => { mounted = true })
    }
  })
</script>

<svg viewBox="0 0 120 70" width={size} height={size * 70 / 120} class="arc-gauge">
  <!-- 배경 트랙 -->
  <path
    d="M 10 60 A 50 50 0 0 1 110 60"
    fill="none"
    stroke="#e5e7eb"
    stroke-width="12"
    stroke-linecap="round"
  />

  <!-- 게이지 -->
  <path
    d="M 10 60 A 50 50 0 0 1 110 60"
    fill="none"
    stroke={strokeColor}
    stroke-width="12"
    stroke-linecap="round"
    stroke-dasharray={arcLength}
    stroke-dashoffset={animated && !mounted ? arcLength : dashoffset}
    class="gauge-fill"
  />

  <!-- 퍼센트 텍스트 -->
  <text x="60" y="52" text-anchor="middle" dominant-baseline="central"
    class="{textColor}" style="font-size: 24px; font-weight: 700;"
  >{value}%</text>

  <!-- 라벨 -->
  {#if label}
    <text x="60" y="67" text-anchor="middle" dominant-baseline="central"
      class="fill-gray-400" style="font-size: 10px;"
    >{label}</text>
  {/if}
</svg>

<style>
  .gauge-fill {
    transition: stroke-dashoffset 1s ease-out;
  }
</style>
