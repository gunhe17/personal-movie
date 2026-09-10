<script lang="ts">
  import { fade, scale } from 'svelte/transition'
  import { cubicOut, cubicIn } from 'svelte/easing'
  import { modalStore, type ModalConfig } from '$lib/stores/modal'
  import { Z_LAYER } from '$lib/utils/positionPortal'

  let modals: ModalConfig[] = $state([])

  modalStore.subscribe((state) => {
    modals = state.modals
  })

  function handleBackdropClick(modal: ModalConfig) {
    if (modal.options?.closeOnBackdropClick !== false && !modal.options?.persistent) {
      modalStore.close(modal.id)
    }
  }

  // 최상위 모달에 대해 전역 Escape 처리 (포커스 위치 무관)
  $effect(() => {
    if (modals.length === 0) return
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      const top = modals[modals.length - 1]
      if (top.options?.closeOnEscape !== false && !top.options?.persistent) {
        e.preventDefault()
        modalStore.close(top.id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  /**
   * 폭 규격 (정본 §4-9). ModalOptions.size의 모든 값이 여기 매핑돼 있어야
   * 한다 — 빠진 값은 조용히 md로 떨어져서 "왜 좁지?"로만 드러난다.
   */
  const sizeClasses: Record<string, string> = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    wide: 'max-w-4xl',
    fit: 'max-w-fit mx-4',
    full: 'max-w-full mx-4'
  }

  /**
   * 등장/퇴장 전환.
   *
   * 들어올 때가 나갈 때보다 길다 — 열림은 눈이 따라갈 대상이라 여유를 주고,
   * 닫힘은 이미 끝난 동작이라 끌면 답답하다. easing도 그에 맞춰 갈린다
   * (cubicOut: 빠르게 시작해 부드럽게 멈춤 / cubicIn: 천천히 시작해 빠르게 사라짐).
   *
   * 카드는 0.96에서 커진다 — 1에 가깝게 두어 "튀어나오는" 느낌 없이
   * 백드롭과 같은 리듬으로 자리를 잡게 한다.
   */
  const BACKDROP_IN = { duration: 220, easing: cubicOut }
  const BACKDROP_OUT = { duration: 180, easing: cubicIn }
  const CARD_IN = { duration: 220, easing: cubicOut, start: 0.96, opacity: 0 }
  const CARD_OUT = { duration: 160, easing: cubicIn, start: 0.98, opacity: 0 }

  /**
   * 접근성 — 동작 최소화를 켠 사용자에겐 전환을 걸지 않는다.
   * duration 0으로 떨어뜨려 전환 자체는 유지하되 즉시 끝나게 한다
   * (분기로 요소를 갈라놓으면 스택·포커스 처리가 두 벌이 된다).
   */
  const reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  const t = <T extends { duration: number }>(cfg: T): T =>
    reduceMotion ? { ...cfg, duration: 0 } : cfg
</script>

{#each modals as modal, i (modal.id)}
  <!-- z는 §2-6 사다리의 modal(10000). 스택된 모달은 i만큼 올린다. -->
  <div class="fixed inset-0" style="z-index: {Z_LAYER.modal + i}">
    <!-- Backdrop (전체 뷰포트, 클릭 시 닫기) -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="absolute inset-0 bg-black/50"
      in:fade={t(BACKDROP_IN)}
      out:fade={t(BACKDROP_OUT)}
      onclick={() => handleBackdropClick(modal)}
    ></div>

    <!-- Modal content (뷰포트 정중앙) -->
    <!-- pointer-events-none으로 빈 영역 클릭이 백드롭으로 통과하도록 -->
    <div class="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
      <!--
        스크롤은 여기가 아니라 BaseModal의 바디가 잡는다. 여기에 overflow-y-auto를
        두면 헤더/푸터까지 같이 스크롤돼서 고정이 구조적으로 불가능해진다.
        대신 flex flex-col + overflow-hidden으로 카드 모양만 유지하고,
        높이 배분은 안쪽 BaseModal에 맡긴다.
      -->
      <div
        class="pointer-events-auto relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-popup {sizeClasses[modal.options?.size || 'md']}"
        style="{modal.options?.customWidth ? `max-width: ${modal.options.customWidth}px;` : ''}{modal.options?.customHeight ? `height: min(${modal.options.customHeight}px, 90vh);` : ''}"
        in:scale={t(CARD_IN)}
        out:scale={t(CARD_OUT)}
      >
        <modal.component {...modal.props} />
      </div>
    </div>
  </div>
{/each}
