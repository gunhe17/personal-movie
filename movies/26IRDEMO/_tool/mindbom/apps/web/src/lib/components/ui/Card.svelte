<script lang="ts">
  /**
   * Card — Web_Design.md §card · §콘텐츠 컨테이너 표준 정본.
   *
   * 🔴 radius 16(rounded-2xl) 고정. rounded-lg(8)를 카드에 쓰면 안 된다 —
   *    "페이지별 radius 제각각"의 주원인이었다.
   * 카드는 최소 그림자(shadow-card)만. 떠 있는 표면(모달·팝업)만 강한 그림자.
   *
   * 두 종류로 나뉘고 패딩 적용 방식이 다르다:
   *   - container : 폼·텍스트를 직접 담음 → p-6(24 사방)
   *   - list      : 리스트 아이템 카드   → p-5(20), 보더 gray-300
   *   - frame     : 테이블·리스트·탭 등 콘텐츠가 스스로 가장자리를 관리
   *                 → 바깥 패딩 없음. 24 인셋은 내부 셀이 담당
   */
  import type { Snippet } from 'svelte'

  type Variant = 'container' | 'list' | 'frame'

  let {
    variant = 'container',
    interactive = false,
    class: className = '',
    header,
    footer,
    children
  }: {
    variant?: Variant
    /** hover 시 살짝 떠오르게. 클릭 가능한 카드에만 */
    interactive?: boolean
    class?: string
    header?: Snippet
    footer?: Snippet
    children: Snippet
  } = $props()

  const variants: Record<Variant, string> = {
    container: 'rounded-2xl border border-gray-200 bg-white shadow-card',
    list: 'rounded-2xl border border-gray-300 bg-white',
    frame: 'rounded-2xl border border-gray-200 bg-white overflow-hidden'
  }

  /** frame은 콘텐츠가 가장자리를 관리하므로 바깥 패딩을 주지 않는다. */
  const bodyPad: Record<Variant, string> = {
    container: 'p-6',
    list: 'p-5',
    frame: ''
  }
</script>

<div
  class="{variants[variant]} {interactive
    ? 'cursor-pointer transition-shadow hover:shadow-raised'
    : ''} {className}"
>
  {#if header}
    <div class="border-b border-gray-100 px-6 py-4">
      {@render header()}
    </div>
  {/if}

  <div class={bodyPad[variant]}>
    {@render children()}
  </div>

  {#if footer}
    <div
      class="flex items-center justify-between border-t border-gray-200 px-6 py-4"
    >
      {@render footer()}
    </div>
  {/if}
</div>
