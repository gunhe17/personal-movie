<script lang="ts">
  /**
   * Tooltip — 요소 hover/focus 시 설명 말풍선을 노출.
   *
   * 사용:
   *   <Tooltip text="수정">
   *     <button><EditIcon /></button>
   *   </Tooltip>
   *
   *   <Tooltip placement="bottom">
   *     {#snippet content()}<b>복잡한</b> 내용{/snippet}
   *     <span>트리거</span>
   *   </Tooltip>
   */
  import { browser } from '$app/environment'
  import { onDestroy, type Snippet } from 'svelte'

  type Placement = 'top' | 'bottom' | 'left' | 'right'

  interface Props {
    /** 간단한 텍스트 (content 와 배타적) */
    text?: string
    /** 커스텀 콘텐츠 스니펫 */
    content?: Snippet
    /** 말풍선 위치. 기본: top */
    placement?: Placement
    /** 트리거와 말풍선 사이 거리(px) */
    offset?: number
    /** hover 후 노출 지연(ms) */
    delay?: number
    /** true 면 노출 안 함 */
    disabled?: boolean
    /** 외부에서 강제로 노출 (hover 없이) */
    forceVisible?: boolean
    /** 트리거 요소 */
    children: Snippet
  }

  let {
    text,
    content,
    placement = 'top',
    offset = 8,
    delay = 100,
    disabled = false,
    forceVisible = false,
    children
  }: Props = $props()

  let triggerEl: HTMLSpanElement | null = $state(null)
  let tooltipEl: HTMLDivElement | null = $state(null)
  let hoverVisible = $state(false)
  const visible = $derived(hoverVisible || (forceVisible && !disabled))
  /** 실제 DOM 마운트 여부 (fade-out 동안 true 유지) */
  let mounted = $state(false)
  /** opacity 전환 트리거 */
  let shown = $state(false)
  let positioned = $state(false)
  let bubbleStyle = $state('')
  let arrowStyle = $state('')
  let showTimer: ReturnType<typeof setTimeout> | null = null
  let unmountTimer: ReturnType<typeof setTimeout> | null = null

  const VIEWPORT_PAD = 8
  const FADE_MS = 300

  /**
   * 말풍선을 body 직속으로 내보낸다.
   * 말풍선은 fixed + 뷰포트 좌표로 위치를 잡는데, 조상에 filter·backdrop-filter·
   * transform이 걸려 있으면 그 요소가 fixed의 기준 박스가 되어(CSS Filter Effects)
   * 좌표가 조상의 좌상단만큼 통째로 밀린다 — 필드노트 시트(backdrop-blur)가 그 사례.
   * body로 옮기면 어떤 조상 아래에서 써도 기준이 항상 뷰포트다.
   */
  function portal(node: HTMLElement) {
    document.body.appendChild(node)
    return {
      destroy() {
        node.remove()
      }
    }
  }

  function show() {
    if (disabled) return
    if (showTimer) clearTimeout(showTimer)
    showTimer = setTimeout(() => {
      hoverVisible = true
    }, delay)
  }

  function hide() {
    if (showTimer) {
      clearTimeout(showTimer)
      showTimer = null
    }
    hoverVisible = false
    if (!forceVisible) positioned = false
  }

  function updatePosition() {
    if (!triggerEl || !tooltipEl) return
    const t = triggerEl.getBoundingClientRect()
    const b = tooltipEl.getBoundingClientRect()

    let top = 0
    let left = 0

    if (placement === 'top') {
      top = t.top - b.height - offset
      left = t.left + t.width / 2 - b.width / 2
    } else if (placement === 'bottom') {
      top = t.bottom + offset
      left = t.left + t.width / 2 - b.width / 2
    } else if (placement === 'left') {
      top = t.top + t.height / 2 - b.height / 2
      left = t.left - b.width - offset
    } else {
      top = t.top + t.height / 2 - b.height / 2
      left = t.right + offset
    }

    // viewport clamp
    const clampedLeft = Math.max(
      VIEWPORT_PAD,
      Math.min(left, window.innerWidth - b.width - VIEWPORT_PAD)
    )
    const clampedTop = Math.max(
      VIEWPORT_PAD,
      Math.min(top, window.innerHeight - b.height - VIEWPORT_PAD)
    )

    bubbleStyle = `top: ${clampedTop}px; left: ${clampedLeft}px;`

    // 화살표는 트리거 중심을 가리키도록 보정 (clamp 후 어긋남 방지)
    if (placement === 'top' || placement === 'bottom') {
      const arrowLeft = t.left + t.width / 2 - clampedLeft
      arrowStyle = `left: ${arrowLeft}px;`
    } else {
      const arrowTop = t.top + t.height / 2 - clampedTop
      arrowStyle = `top: ${arrowTop}px;`
    }
  }

  $effect(() => {
    if (!browser) return
    if (visible) {
      if (unmountTimer) {
        clearTimeout(unmountTimer)
        unmountTimer = null
      }
      mounted = true
      requestAnimationFrame(() => {
        updatePosition()
        positioned = true
        // 다음 프레임에 opacity 전환 시작 (초기 opacity:0 → 1)
        requestAnimationFrame(() => {
          shown = true
        })
      })
      const handler = () => updatePosition()
      window.addEventListener('scroll', handler, true)
      window.addEventListener('resize', handler)
      return () => {
        window.removeEventListener('scroll', handler, true)
        window.removeEventListener('resize', handler)
      }
    } else if (mounted) {
      shown = false
      if (unmountTimer) clearTimeout(unmountTimer)
      unmountTimer = setTimeout(() => {
        mounted = false
        positioned = false
        unmountTimer = null
      }, FADE_MS)
    }
  })

  onDestroy(() => {
    if (showTimer) clearTimeout(showTimer)
    if (unmountTimer) clearTimeout(unmountTimer)
  })
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<span
  bind:this={triggerEl}
  class="inline-flex"
  onmouseenter={show}
  onmouseleave={hide}
  onfocusin={show}
  onfocusout={hide}
>
  {@render children()}
</span>

{#if mounted}
  <div
    bind:this={tooltipEl}
    use:portal
    role="tooltip"
    class="pointer-events-none fixed z-10001 whitespace-nowrap rounded-lg bg-gray-800 px-3 py-1.5 text-body-03-normal-regular text-white shadow-lg transition-opacity duration-150 ease-out"
    style="{bubbleStyle} opacity: {positioned && shown ? 1 : 0};"
  >
    {#if content}
      {@render content()}
    {:else if text}
      {text}
    {/if}

    {#if placement === 'top'}
      <span
        class="absolute top-full -translate-x-1/2 border-[5px] border-transparent border-t-gray-800"
        style={arrowStyle}
      ></span>
    {:else if placement === 'bottom'}
      <span
        class="absolute bottom-full -translate-x-1/2 border-[5px] border-transparent border-b-gray-800"
        style={arrowStyle}
      ></span>
    {:else if placement === 'left'}
      <span
        class="absolute left-full -translate-y-1/2 border-[5px] border-transparent border-l-gray-800"
        style={arrowStyle}
      ></span>
    {:else}
      <span
        class="absolute right-full -translate-y-1/2 border-[5px] border-transparent border-r-gray-800"
        style={arrowStyle}
      ></span>
    {/if}
  </div>
{/if}
