<script lang="ts">
  /**
   * TimelineList — 하루 일정의 시간순 세로 목록.
   *
   * 가로 타임라인(TimelineCanvas)이 "하루 중 언제 몰려 있나"를 보여준다면,
   * 이쪽은 "몇 시에 무엇이 있나"를 순서대로 읽게 한다. 가로 축은 카드가
   * 시간 위치에 흩어지고 2트랙을 넘으면 칩으로 접혀서, 일정을 차례로
   * 훑기에는 불리하다.
   *
   * 🔴 같은 items·day를 타임라인과 공유한다. 목록이 자기 데이터를 따로
   *    불러오면 두 화면이 어긋나도 아무도 모른다(날짜 이동·필터가 갈린다).
   *    거르는 규칙도 여기서 다시 적지 않고 isSameDay 하나를 같이 쓴다.
   */
  import type { TimelineItem } from '../types'
  import { isSameDay } from '../day-view'
  import { EXAM_TYPE_VISUAL } from '$features/examination/common/exam-visual'
  import ExamStatusPill from '$features/examination/common/components/ExamStatusPill.svelte'

  interface Props {
    items: TimelineItem[]
    day: Date
    onItemClick?: (id: string) => void
    /** 목록↔타임라인 상호 강조 */
    hoveredId?: string | null
    onHover?: (id: string | null) => void
    /** 목록 영역 높이(px) — 타임라인 본문과 같은 예산을 쓴다 */
    height?: number
  }

  let {
    items,
    day,
    onItemClick,
    hoveredId = null,
    onHover,
    height = 200
  }: Props = $props()

  let dayItems = $derived(
    items
      .filter((i) => isSameDay(i.when.anchorAt, day))
      .sort((a, b) => a.when.anchorAt.getTime() - b.when.anchorAt.getTime())
  )

  const pad2 = (n: number) => String(n).padStart(2, '0')
  const fmtTime = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
</script>

<!--
  진짜 <ul>/<li>를 쓴다 — div에 role="list"를 얹고 버튼에 role="listitem"을
  주면 안 된다(button은 interactive라 listitem 역할을 가질 수 없다).
  구분선은 li가 갖고, 버튼은 그 안을 채우며 클릭·호버를 받는다.
-->
<ul class="flex flex-col overflow-y-auto" style="height: {height}px" aria-label="검사 일정 목록">
  {#if dayItems.length === 0}
    <!--
      빈 상태 문구를 두지 않는다 — 옆 타임라인이 이미 "여유로운 하루입니다"를
      크게 띄운다. 같은 말을 두 번 하면 빈 화면이 더 비어 보인다.
    -->
    <li class="flex h-full items-center justify-center px-4">
      <p class="text-body-03-normal-regular text-gray-400">일정 없음</p>
    </li>
  {:else}
    {#each dayItems as item (item.id)}
      {@const typeVisual = EXAM_TYPE_VISUAL[item.what.type]}
      <li class="border-b border-gray-100 last:border-b-0">
      <button
        type="button"
        onclick={() => onItemClick?.(item.id)}
        onmouseenter={() => onHover?.(item.id)}
        onmouseleave={() => onHover?.(null)}
        onfocus={() => onHover?.(item.id)}
        onblur={() => onHover?.(null)}
        class="flex w-full items-start gap-2.5 px-4 py-2.5 text-left transition-colors {hoveredId ===
        item.id
          ? 'bg-primary-50'
          : 'hover:bg-gray-50'}"
      >
        <span
          class="w-10 shrink-0 pt-0.5 text-label-01-normal-medium tabular-nums text-gray-500"
        >
          {fmtTime(item.when.anchorAt)}
        </span>

        <span class="flex min-w-0 flex-col gap-1">
          <span class="flex min-w-0 items-baseline gap-1.5">
            <span class="truncate text-body-03-normal-semibold text-gray-900">
              {item.who.name}
            </span>
            <span class="shrink-0 text-caption-01-normal-regular text-gray-400">
              {typeVisual.label}
            </span>
          </span>
          <ExamStatusPill status={item.state.status} size="xs" />
        </span>
      </button>
      </li>
    {/each}
  {/if}
</ul>
