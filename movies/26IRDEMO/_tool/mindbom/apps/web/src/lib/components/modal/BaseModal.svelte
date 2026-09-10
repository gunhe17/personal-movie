<script lang="ts">
  /**
   * BaseModal — 모달 내용물의 헤더/바디/푸터 3단 구조. (정본 §4-9)
   *
   * 바깥(위치·폭·백드롭·스택·z)은 ModalContainer가 잡는다. 여기는 그 안을
   * 세로로 3분할하는 일만 한다.
   *
   * 헤더·푸터는 shrink-0으로 고정하고 바디만 스크롤한다. 이때 바디의
   * `min-h-0`이 핵심이다 — flex 자식의 기본값 min-height:auto는 내용만큼
   * 부풀어서 스크롤이 생기지 않고, 대신 모달 전체가 늘어나 푸터가 화면
   * 밖으로 밀려난다. 없애지 말 것.
   *
   * 안에서 드롭다운을 열 때는 반드시 portal(§positionPortal)을 쓴다.
   * ModalContainer의 카드가 overflow-hidden이라 absolute 패널은 잘린다.
   */
  import { twMerge } from 'tailwind-merge'
  import type { Snippet } from 'svelte'
  import Close from '$lib/assets/icons/Close.svelte'

  interface Props {
    modalId?: string
    /** 기본 헤더의 제목. header 스니펫을 주면 무시된다. */
    title?: string
    /** 제목 아래 보조 설명 (기본 헤더 전용) */
    description?: string
    closeModal?: () => void
    showCloseButton?: boolean
    showHeaderBorder?: boolean
    showFooterBorder?: boolean
    /** 바디 자체 스크롤. 지면 미리보기처럼 내부에서 직접 스크롤을 잡는 경우 false. */
    bodyScrollable?: boolean
    containerClass?: string
    headerClass?: string
    bodyClass?: string
    footerClass?: string
    header?: Snippet
    body?: Snippet
    footer?: Snippet
  }

  let {
    modalId = '',
    title = '',
    description = '',
    closeModal = () => {},
    showCloseButton = true,
    showHeaderBorder = true,
    showFooterBorder = true,
    bodyScrollable = true,
    containerClass = '',
    // 정본 §2-3: 모달 기본 padding은 header/body/footer 공통 px-6 py-5
    headerClass = 'px-6 py-5',
    bodyClass = 'px-6 py-5',
    footerClass = 'px-6 py-5',
    header,
    body,
    footer
  }: Props = $props()

  const hasHeader = $derived(Boolean(header || title || showCloseButton))
</script>

<div
  class={twMerge('flex h-full min-h-0 flex-col bg-white', containerClass)}
  data-modal-id={modalId}
>
  {#if hasHeader}
    <div
      class={twMerge(
        // description이 있는 2줄 헤더는 items-start가 자연스럽다.
        // 닫기 버튼이 제목 줄에 붙게 하려는 의도.
        'flex shrink-0 justify-between gap-4',
        description ? 'items-start' : 'items-center',
        showHeaderBorder ? 'border-b border-gray-100' : '',
        headerClass
      )}
    >
      {#if header}
        {@render header()}
      {:else if title}
        <div class="min-w-0">
          <h2 class="text-title-01-semibold text-gray-900">{title}</h2>
          {#if description}
            <p class="mt-1 text-body-02-normal-regular text-gray-500">
              {description}
            </p>
          {/if}
        </div>
      {:else}
        <!-- 제목 없이 닫기 버튼만 있는 경우 오른쪽 정렬 유지용 -->
        <span></span>
      {/if}

      {#if showCloseButton}
        <button
          type="button"
          aria-label="닫기"
          onclick={closeModal}
          class="-mr-1 shrink-0 rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-600"
        >
          <Close size={20} />
        </button>
      {/if}
    </div>
  {/if}

  <!-- min-h-0이 있어야 이 영역이 줄어들며 스크롤을 만든다 (위 주석 참고) -->
  <div
    class={twMerge(
      'min-h-0 flex-1',
      bodyScrollable ? 'overflow-y-auto overscroll-y-contain' : '',
      bodyClass
    )}
  >
    {#if body}
      {@render body()}
    {/if}
  </div>

  {#if footer}
    <div
      class={twMerge(
        'flex shrink-0 items-center justify-end gap-2',
        showFooterBorder ? 'border-t border-gray-100' : '',
        footerClass
      )}
    >
      {@render footer()}
    </div>
  {/if}
</div>
