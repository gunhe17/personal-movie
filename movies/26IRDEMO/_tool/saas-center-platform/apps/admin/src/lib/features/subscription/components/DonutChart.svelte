<script lang="ts">
  import { browser } from '$app/environment'

  interface Segment {
    key: string
    value: number
    color: string
    label: string
  }

  interface Props {
    segments: Segment[]
    size?: number
    strokeWidth?: number
    centerText?: string
    centerSubText?: string
    hoveredKey?: string | null
    onHover?: (key: string | null) => void
    onClick?: (key: string) => void
  }

  let {
    segments,
    size = 120,
    strokeWidth = 16,
    centerText = '',
    centerSubText = '',
    hoveredKey = null,
    onHover,
    onClick,
  }: Props = $props()

  const cx = 60
  const cy = 60
  const radius = 44

  const circumference = 2 * Math.PI * radius

  const total = $derived(segments.reduce((sum, s) => sum + s.value, 0))

  const arcs = $derived.by(() => {
    if (total === 0) return []
    let offset = 0
    return segments
      .filter(s => s.value > 0)
      .map(s => {
        const pct = s.value / total
        const len = circumference * pct
        const rotation = (offset / total) * 360 - 90
        offset += s.value
        return { ...s, len, gap: circumference - len, rotation }
      })
  })

  let mounted = $state(false)

  $effect(() => {
    if (browser) {
      requestAnimationFrame(() => { mounted = true })
    }
  })
</script>

<svg
  viewBox="0 0 120 120"
  width={size}
  height={size}
  class="donut-chart"
>
  <!-- 배경 링 -->
  <circle
    cx={cx} cy={cy} r={radius}
    fill="none"
    stroke="#f3f4f6"
    stroke-width={strokeWidth}
  />

  <!-- 세그먼트 -->
  {#each arcs as arc}
    {@const isHovered = hoveredKey === arc.key}
    <circle
      cx={cx} cy={cy} r={radius}
      fill="none"
      stroke={arc.color}
      stroke-width={isHovered ? strokeWidth + 4 : strokeWidth}
      stroke-dasharray="{arc.len} {arc.gap}"
      stroke-dashoffset={mounted ? 0 : arc.len}
      stroke-linecap="butt"
      transform="rotate({arc.rotation} {cx} {cy})"
      class="donut-segment"
      role="button"
      tabindex="0"
      onmouseenter={() => onHover?.(arc.key)}
      onmouseleave={() => onHover?.(null)}
      onclick={() => onClick?.(arc.key)}
      onkeydown={(e) => e.key === 'Enter' && onClick?.(arc.key)}
    />
  {/each}

  <!-- 중앙 텍스트 -->
  {#if centerText}
    <text x={cx} y={centerSubText ? cy - 4 : cy} text-anchor="middle" dominant-baseline="central"
      class="fill-gray-800 text-xl font-bold" style="font-size: 22px; font-weight: 700;"
    >{centerText}</text>
  {/if}
  {#if centerSubText}
    <text x={cx} y={cy + 14} text-anchor="middle" dominant-baseline="central"
      class="fill-gray-400" style="font-size: 10px;"
    >{centerSubText}</text>
  {/if}
</svg>

<style>
  .donut-segment {
    transition: stroke-dashoffset 800ms ease-out, stroke-width 150ms ease;
    cursor: pointer;
  }
</style>
