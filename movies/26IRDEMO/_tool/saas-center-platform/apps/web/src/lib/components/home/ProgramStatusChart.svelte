<script lang="ts">
  import Typography from '@common/components/Typography.svelte'

  type Item = {
    label: string
    value: number
    color: string
  }

  export let data: Item[] = [
    { label: '상담', value: 45, color: '#4F7DF3' },
    { label: '프로그램', value: 35, color: '#6BD3C8' },
    { label: '검사', value: 20, color: '#F6B26B' }
  ]

  const size = 160
  const cx = size / 2
  const cy = size / 2
  const r = 80

  $: total = data.reduce((sum, d) => sum + d.value, 0)

  const polarToCartesian = (
    cx: number,
    cy: number,
    r: number,
    angle: number
  ) => ({
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle)
  })

  const describeArc = (startAngle: number, endAngle: number) => {
    const start = polarToCartesian(cx, cy, r, startAngle)
    const end = polarToCartesian(cx, cy, r, endAngle)
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0

    return `
      M ${cx} ${cy}
      L ${start.x} ${start.y}
      A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}
      Z
    `
  }

  $: arcs = (() => {
    let currentAngle = -Math.PI / 2

    return data.map((item) => {
      const angle = (item.value / total) * Math.PI * 2
      const midAngle = currentAngle + angle / 2

      const labelPos = polarToCartesian(cx, cy, r * 0.6, midAngle)

      const arc = {
        ...item,
        d: describeArc(currentAngle, currentAngle + angle),
        labelX: labelPos.x,
        labelY: labelPos.y
      }

      currentAngle += angle
      return arc
    })
  })()
</script>

<div
  class="w-full h-full flex flex-col rounded-lg shadow-sm border border-gray-200 p-6 bg-white"
>
  <Typography variant="title-01-semibold">예약 유형별 차트</Typography>
  <div class="flex-center flex-col gap-4 grow">
    <!-- 차트 -->
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs>
        <!-- 살짝 입체 그림자 -->
        <filter id="shadow">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.18" />
        </filter>
        <!-- 상단 하이라이트 -->
        <radialGradient id="shine" cx="0.3" cy="0.3" r="0.7">
          <stop offset="0%" stop-color="#fff" stop-opacity="0.45" />
          <stop offset="100%" stop-color="#fff" stop-opacity="0" />
        </radialGradient>
      </defs>
      {#each arcs as arc}
        <g>
          <path d={arc.d} fill={arc.color} filter="url(#shadow)" />
          <!-- 퍼센트 텍스트 -->
          <text
            x={arc.labelX}
            y={arc.labelY}
            fill="#ffffff"
            font-size="14"
            font-weight="600"
            text-anchor="middle"
            dominant-baseline="middle"
            pointer-events="none"
          >
            {arc.value}%
          </text>
        </g>
      {/each}
      <!-- 공통 하이라이트 -->
      <circle {cx} {cy} {r} fill="url(#shine)" pointer-events="none" />
    </svg>
    <!-- 레전드 -->
    <div class="flex gap-4 text-sm">
      {#each data as item}
        <div class="flex items-center gap-1.5">
          <!-- svelte-ignore element_invalid_self_closing_tag -->
          <span
            class="w-2.5 h-2.5 rounded-full"
            style="background-color: {item.color}"
          />
          <span class="text-gray-600">
            {item.label}
            {item.value}%
          </span>
        </div>
      {/each}
    </div>
  </div>
</div>
