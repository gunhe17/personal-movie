<script lang="ts">
  import Typography from '@common/components/Typography.svelte'

  export let normal = 70
  export let absent = 18
  export let onGoing = 12
  export let cancelled = 30

  const size = 180
  const strokeWidth = 20
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius

  const calcPercentile = (value: number) => {
    const total = normal + absent + cancelled + onGoing
    return (value / total) * 100
  }

  const segments = [
    { label: '진행예정', value: calcPercentile(normal), color: '#14b8a6' },
    { label: '진행중', value: calcPercentile(onGoing), color: '#4c87f6' },
    { label: '노쇼', value: calcPercentile(absent), color: '#f97316' },
    { label: '취소', value: calcPercentile(cancelled), color: '#ef4444' }
  ]

  const totalOffset = segments.reduce(
    (acc, cur) => {
      const currentOffset = acc.offset
      acc.items.push({ ...cur, offset: currentOffset })
      acc.offset += (cur.value / 100) * circumference
      return acc
    },
    { offset: 0, items: [] as any[] }
  ).items
</script>

<div
  class="w-full h-full flex flex-col rounded-lg shadow-sm border border-gray-200 p-6 bg-white"
>
  <Typography variant="title-01-semibold">실시간 예약 차트</Typography>
  <div class="flex-center flex-col gap-4 grow">
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      class="mx-auto block"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="transparent"
        stroke="#e5e7eb"
        stroke-width={strokeWidth}
      />
      {#each totalOffset as segment}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke={segment.color}
          stroke-width={strokeWidth}
          stroke-dasharray={`${(segment.value / 100) * circumference} ${circumference}`}
          stroke-dashoffset={-segment.offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      {/each}
      <text x="50%" y="45%" text-anchor="middle" font-size="14" fill="#6b7280">
        정상
      </text>
      <text
        x="50%"
        y="60%"
        text-anchor="middle"
        font-size="24"
        font-weight="bold"
        fill="#111827"
      >
        {normal}%
      </text>
    </svg>
    <div class="flex justify-center gap-4 text-sm">
      {#each segments as s}
        <div class="flex items-center gap-1">
          <!-- svelte-ignore element_invalid_self_closing_tag -->
          <span
            class="inline-block w-3 h-3 rounded-full"
            style={`background:${s.color}`}
          />
          <span>{s.label} {s.value.toFixed(0)}%</span>
        </div>
      {/each}
    </div>
  </div>
</div>
