<script lang="ts" module>
  import type { Snippet } from 'svelte'

  export interface DescriptionItem {
    label: string
    /** 문자열 값. render를 주면 무시된다. */
    value?: string | null
    /** 값 자리에 커스텀 마크업 (상태 점, 배지 등) */
    render?: Snippet<[]>
  }
</script>

<script lang="ts">
  /**
   * DescriptionList — 레이블+데이터(가로형, 텍스트 레이블) 정본 구현.
   *
   * Web_Design.md §반복 패턴:
   *   - 레이블 열 폭은 가장 넓은 레이블에 맞춰 auto → `grid-cols-[auto_1fr]`
   *   - 레이블↔값 gap 28 · 행 높이 20 고정 · 행↔행 gap 12
   *   - 레이블 body-01 Regular gray-600 / 값 body-01 Regular gray-900
   *   - 빈값은 gray-400으로 `-`
   *
   * 🔴 행 사이에 구분선을 넣지 않는다. 이전 구현의 `divide-dotted`는
   *    정본에 없는 장식이었다 — 구분은 gap 12만으로 한다.
   */

  interface Props {
    items: DescriptionItem[]
    class?: string
  }

  let { items, class: className = '' }: Props = $props()
</script>

<dl class="grid grid-cols-[auto_1fr] gap-x-7 gap-y-3 {className}">
  {#each items as item (item.label)}
    <dt class="flex h-5 items-center text-body-01-normal-regular text-gray-600">
      {item.label}
    </dt>
    <dd class="flex min-h-5 min-w-0 items-center text-body-01-normal-regular">
      {#if item.render}
        {@render item.render()}
      {:else if item.value}
        <span class="min-w-0 break-words text-gray-900">{item.value}</span>
      {:else}
        <span class="text-gray-400">-</span>
      {/if}
    </dd>
  {/each}
</dl>
