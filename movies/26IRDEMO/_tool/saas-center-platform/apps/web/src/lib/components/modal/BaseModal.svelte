<script lang="ts">
  import { twMerge } from 'tailwind-merge'
  import type { Snippet } from 'svelte'
  import Typography from '@common/components/Typography.svelte'
  import CloseIcon32 from '../../assets/CloseIcon32.svelte'

  interface Props {
    modalId?: string
    title?: string
    bodyClass?: string
    headerClass?: string
    closeModal?: () => void
    showCloseButton?: boolean
    showHeaderBorder?: boolean
    showFooterBorder?: boolean
    bodyScrollable?: boolean
    size?:
      | 'sm'
      | 'md'
      | 'lg'
      | 'xl'
      | 'wide'
      | 'wideXl'
      | 'custom500'
      | 'tall'
      | 'narrow'
      | 'fit'
      | 'full'
    containerClass?: string
    footerClass?: string
    header?: Snippet
    body?: Snippet
    footer?: Snippet
  }

  let {
    modalId = '',
    title = '',
    bodyClass = '',
    headerClass = '',
    closeModal = () => {},
    showCloseButton = true,
    showHeaderBorder = true,
    showFooterBorder = true,
    bodyScrollable = true,
    size = 'md',
    containerClass = '',
    footerClass = 'px-5 pt-4 pb-5',
    header,
    body,
    footer
  }: Props = $props()

  // tall 또는 narrow 사이즈일 때 다른 높이 제한 적용
  const maxHeight = $derived(
    size === 'tall' || size === 'narrow' ? 'max-h-full' : 'max-h-[90vh]'
  )
</script>

<div class="flex h-full min-h-0 flex-1 flex-col bg-white {containerClass}">
  <!-- Header -->
  <div
    class={twMerge(
      // 좌우 20은 header·body·footer 공통 기준선. 헤더 상하만 16 —
      // 닫기 아이콘(32)이 타이틀(20)보다 커서 헤더 높이를 결정하므로
      // 상하를 키우면 헤더만 부푼다(상하 16 → 65).
      // body는 p-5(사방 20), footer는 px-5 pt-4 pb-5(상단만 16).
      title && !header ? 'px-5 py-4' : '',
      // 기본 = 타이틀·닫기버튼 세로 가운데 정렬. 부제 있는 2줄 헤더만 headerClass로 items-start 지정
      'flex shrink-0 items-center justify-between',
      showHeaderBorder ? 'border-b border-gray-100' : '',
      headerClass
    )}
  >
    {#if header}
      {@render header()}
    {:else if title}
      <Typography variant="headline-02-normal-semibold" color="text-body-strong"
        >{title}</Typography
      >
    {/if}

    {#if showCloseButton}
      <!-- svelte-ignore a11y_consider_explicit_label -->
      <button
        type="button"
        class="text-gray-400 transition-colors hover:text-gray-600"
        onclick={closeModal}
      >
        <CloseIcon32 />
      </button>
    {/if}
  </div>

  <!-- Body: GPU 레이어 + paint 격리로 스크롤 부드럽게, min-h-0으로 flex 자식이 스크롤 영역까지 축소 -->
  <div
    class={twMerge(
      'flex-1 min-h-0 overscroll-y-contain',
      bodyScrollable
        ? 'overflow-y-auto contain-[layout_paint] transform-[translateZ(0)]'
        : '',
      bodyClass
    )}
  >
    {#if body}
      {@render body()}
    {/if}
  </div>

  <!-- Footer -->
  {#if footer}
    <div
      class={`flex shrink-0 items-center border-t border-gray-100 justify-end gap-3 ${footerClass} ${
        showFooterBorder ? '' : 'border-none'
      }`}
    >
      {@render footer()}
    </div>
  {/if}
</div>
