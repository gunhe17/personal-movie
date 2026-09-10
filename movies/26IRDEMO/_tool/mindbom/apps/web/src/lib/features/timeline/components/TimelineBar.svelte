<script lang="ts">
  import type { TimelineItem } from '../types'
  import {
    EXAM_TYPE_VISUAL,
    EXAM_STATUS_VISUAL
  } from '$features/examination/common/exam-visual'
  import ExamStatusPill from '$features/examination/common/components/ExamStatusPill.svelte'

  interface Props {
    item: TimelineItem
    left: number
    top: number
    width: number
    height: number
    onClick?: (id: string) => void
    /** 목록에서 같은 항목을 가리키고 있을 때 강조 */
    highlighted?: boolean
    onHover?: (id: string | null) => void
  }

  let {
    item,
    left,
    top,
    width,
    height,
    onClick,
    highlighted = false,
    onHover
  }: Props = $props()

  let typeVisual = $derived(EXAM_TYPE_VISUAL[item.what.type])
  let statusVisual = $derived(EXAM_STATUS_VISUAL[item.state.status])

  /**
   * 강조(목록에서 같은 항목 호버)는 ring으로만 준다.
   * border 색으로 강조하면 좌측 상태색 인디케이터(border-l-*)를 덮어써
   * 강조된 카드만 상태를 못 읽게 된다. ring은 테두리 밖에 그려져 충돌이 없다.
   */

  // 상태별 좌측 인디케이터 색 (dot 톤과 정렬)
  const STATUS_BORDER: Record<string, string> = {
    created: 'border-l-gray-400',
    in_progress: 'border-l-blue-500',
    ai_draft_ready: 'border-l-purple-400',
    under_review: 'border-l-orange-500',
    confirmed: 'border-l-green-500',
    report_generated: 'border-l-indigo-500',
    completed: 'border-l-green-600'
  }
  let borderClass = $derived(STATUS_BORDER[item.state.status] ?? 'border-l-gray-400')

  const pad2 = (n: number) => String(n).padStart(2, '0')
  const fmtTime = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`

  let title = $derived(
    `${item.who.name} · ${typeVisual.label} · ${statusVisual.label}\n` +
      `${item.when.anchorLabel}: ${fmtTime(item.when.anchorAt)}`
  )
</script>

<button
  type="button"
  onclick={() => onClick?.(item.id)}
  onmouseenter={() => onHover?.(item.id)}
  onmouseleave={() => onHover?.(null)}
  onfocus={() => onHover?.(item.id)}
  onblur={() => onHover?.(null)}
  class="group absolute flex flex-col justify-center gap-1 overflow-hidden rounded-md border border-gray-200 border-l-[5px] bg-white px-3 py-2 text-left transition-shadow {borderClass} {highlighted
    ? 'shadow-md ring-2 ring-primary-300'
    : 'shadow-sm hover:shadow-md'}"
  style="left: {left}px; width: {width}px; top: {top}px; height: {height}px"
  {title}
>
  <!-- 1행: 상태 (좌) — 시간 (우) -->
  <div class="flex items-center justify-between gap-2 leading-tight">
    <ExamStatusPill status={item.state.status} size="xs" />
    <span class="shrink-0 text-caption-01-normal-regular tabular-nums text-gray-500">
      {fmtTime(item.when.anchorAt)}
    </span>
  </div>

  <!-- 2행: 이름 + 나이 -->
  <div class="flex min-w-0 items-baseline gap-1 leading-tight">
    <span class="truncate text-[13px] font-semibold text-gray-900">
      {item.who.name}
    </span>
    {#if item.who.age != null}
      <span class="shrink-0 text-caption-01-normal-regular text-gray-400">{item.who.age}세</span>
    {/if}
  </div>
</button>
