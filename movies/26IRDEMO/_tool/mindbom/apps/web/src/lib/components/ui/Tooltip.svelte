<script lang="ts">
  import type { Snippet } from 'svelte'
  import { Z_LAYER } from '$lib/utils/positionPortal'

  /**
   * 툴팁 — **body로 portal된다.**
   *
   * 예전에는 `absolute z-50`이라 부모의 `overflow: hidden`에 잘렸다. 카드
   * 무대처럼 overflow를 막아둔 컨테이너 안에서는 툴팁이 통째로 안 보였다
   * (z-index를 아무리 올려도 소용없다 — 자르는 건 stacking이 아니라 clipping이다).
   *
   * `positionPortal`의 `portal` 액션을 쓰지 않는 이유: 그건 드롭다운용이라
   * anchor 너비에 맞추고(`isFitWidth`) 중앙 정렬이 없다. 툴팁은 내용 너비에
   * 4방향 중앙 정렬이 필요하다. **z 사다리(`Z_LAYER`)는 공유한다** — 두 곳이
   * 각자 숫자를 들고 있으면 어긋나도 아무도 모른다.
   *
   * 위치는 **hover할 때만** 계산한다. 상시 추적하면 화면의 툴팁 수만큼
   * rAF가 돌아간다.
   */
  interface Props {
    /** 툴팁 본문 텍스트. 비어있으면 툴팁 자체를 렌더링하지 않음. */
    text?: string
    /** 툴팁 위치 — 자식 요소 기준 */
    placement?: 'top' | 'bottom' | 'left' | 'right'
    /** 비활성화 (조건부로 툴팁 끄고 싶을 때 — text 비우는 것과 동일 효과) */
    disabled?: boolean
    /** wrapper 의 추가 클래스 (예: inline-block / block 제어) */
    class?: string
    children: Snippet
  }

  let {
    text = '',
    placement = 'top',
    disabled = false,
    class: extraClass = '',
    children
  }: Props = $props()

  let enabled = $derived(!!text && !disabled)
  let hovered = $state(false)
  let anchorEl = $state<HTMLElement | null>(null)
  let tipEl = $state<HTMLElement | null>(null)
  let pos = $state<{ left: number; top: number } | null>(null)

  let show = $derived(enabled && hovered)

  const GAP = 8

  /**
   * 노드를 body로 옮긴다.
   *
   * **`position: fixed`만으로는 부족하다.** 조상에 `transform`이 걸려 있으면
   * (채점 화면의 줌이 그렇다) fixed의 기준이 viewport가 아니라 그 조상이
   * 되어, 다시 잘리고 좌표도 어긋난다. 실제로 DOM에서 꺼내야 한다.
   */
  function toBody(node: HTMLElement) {
    document.body.appendChild(node)
    return { destroy: () => node.remove() }
  }

  /** 화살표는 툴팁 기준 반대편에 붙는다 (툴팁이 fixed라 그 안에서는 absolute) */
  let arrowCls = $derived.by(() => {
    switch (placement) {
      case 'bottom':
        return 'bottom-full left-1/2 -translate-x-1/2 border-b-sidebar border-x-transparent border-t-transparent'
      case 'left':
        return 'left-full top-1/2 -translate-y-1/2 border-l-sidebar border-y-transparent border-r-transparent'
      case 'right':
        return 'right-full top-1/2 -translate-y-1/2 border-r-sidebar border-y-transparent border-l-transparent'
      default:
        return 'top-full left-1/2 -translate-x-1/2 border-t-sidebar border-x-transparent border-b-transparent'
    }
  })

  /**
   * anchor 기준으로 자리를 잡고 viewport 안으로 밀어 넣는다.
   *
   * 툴팁 크기는 렌더된 뒤에야 알 수 있으므로 `tipEl`이 붙은 다음 실행된다
   * (그 전엔 `pos`가 null이라 화면 밖에 숨어 있다).
   */
  function place() {
    if (!anchorEl || !tipEl) return
    const a = anchorEl.getBoundingClientRect()
    const t = tipEl.getBoundingClientRect()

    let left: number
    let top: number
    switch (placement) {
      case 'bottom':
        left = a.left + a.width / 2 - t.width / 2
        top = a.bottom + GAP
        break
      case 'left':
        left = a.left - t.width - GAP
        top = a.top + a.height / 2 - t.height / 2
        break
      case 'right':
        left = a.right + GAP
        top = a.top + a.height / 2 - t.height / 2
        break
      default:
        left = a.left + a.width / 2 - t.width / 2
        top = a.top - t.height - GAP
    }

    // viewport 클램프 — 화면 밖으로 나가면 안 보이는 것과 같다.
    left = Math.max(4, Math.min(window.innerWidth - t.width - 4, left))
    top = Math.max(4, Math.min(window.innerHeight - t.height - 4, top))
    pos = { left, top }
  }

  // hover 중에만 위치를 잡는다. 스크롤·리사이즈로 anchor가 움직이면 따라간다.
  $effect(() => {
    if (!show) {
      pos = null
      return
    }
    place()
    const onMove = () => place()
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    return () => {
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
    }
  })
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<span
  bind:this={anchorEl}
  class="inline-flex {extraClass}"
  onmouseenter={() => (hovered = true)}
  onmouseleave={() => (hovered = false)}
  onfocusin={() => (hovered = true)}
  onfocusout={() => (hovered = false)}
>
  {@render children()}
</span>

{#if show}
  <!--
    body로 옮긴다 — 부모의 overflow가 무엇이든 잘리지 않는다.
    위치가 잡히기 전(pos=null)에는 화면 밖에 둬서 좌상단에 한 프레임
    번쩍이는 것을 막는다.
  -->
  <span
    bind:this={tipEl}
    use:toBody
    role="tooltip"
    class="pointer-events-none fixed whitespace-nowrap rounded-md bg-sidebar px-2.5 py-1.5 text-label-02-normal-medium text-white shadow-lg transition-opacity duration-150 {pos
      ? 'opacity-100'
      : 'opacity-0'}"
    style="left: {pos?.left ?? -9999}px; top: {pos?.top ?? -9999}px; z-index: {Z_LAYER.portalDropdown};"
  >
    {text}
    <span aria-hidden="true" class="absolute h-0 w-0 border-4 {arrowCls}"></span>
  </span>
{/if}
