<script lang="ts">
  import type { DayRange } from '../day-view'
  import { dayTicks, timeToX } from '../day-view'

  interface Props {
    range: DayRange
    viewportWidth: number
    /** 오늘을 보고 있을 때만 '지금' 표시가 뜬다 */
    now: Date | null
  }

  let { range, viewportWidth, now }: Props = $props()

  let ticks = $derived(dayTicks(range, viewportWidth))

  const pad2 = (n: number) => String(n).padStart(2, '0')
  const fmtTick = (d: Date) => `${pad2(d.getHours())}시`

  /**
   * 라벨을 눈금 중앙에 두되, 뷰포트 밖으로 새어 나가지 않게 안쪽으로 당긴다.
   *
   * 축은 overflow-hidden이라 -translate-x-1/2로 중앙 정렬만 하면 양 끝
   * (예: 09시, 18시) 라벨의 절반이 잘려 나간다. 눈금선 자체는 정확한 시각에
   * 그대로 두고, 글자만 컨테이너 안으로 민다.
   */
  function labelStyle(x: number): string {
    // "09시" 기준 대략적 반폭 — 라벨이 두세 글자로 고정이라 상수로 충분하다
    const half = 14
    if (x - half < 0) return `left: 0px`
    if (x + half > viewportWidth) return `left: ${viewportWidth}px; transform: translateX(-100%)`
    return `left: ${x}px; transform: translateX(-50%)`
  }

  let nowX = $derived(now ? timeToX(now, range, viewportWidth) : 0)
  let nowVisible = $derived(
    now != null &&
      now.getTime() >= range.start.getTime() &&
      now.getTime() <= range.end.getTime()
  )
</script>

<div class="relative h-12 select-none overflow-hidden border-b border-gray-200 bg-gray-50/50">
  {#each ticks as tick (tick.getTime())}
    {@const x = timeToX(tick, range, viewportWidth)}
    <div class="absolute bottom-0 h-3 w-px bg-gray-400" style="left: {x}px"></div>
    <div
      class="absolute bottom-3.5 whitespace-nowrap text-label-02-normal-medium text-gray-600"
      style={labelStyle(x)}
    >
      {fmtTick(tick)}
    </div>
  {/each}

  {#if nowVisible}
    <div
      class="pointer-events-none absolute bottom-0 top-0 w-px bg-red-500"
      style="left: {nowX}px"
    ></div>
    <div
      class="absolute -top-px -translate-x-1/2 rounded-b-md bg-red-500 px-1.5 py-0.5 text-caption-01-normal-bold text-white"
      style="left: {nowX}px"
    >
      지금
    </div>
  {/if}
</div>
