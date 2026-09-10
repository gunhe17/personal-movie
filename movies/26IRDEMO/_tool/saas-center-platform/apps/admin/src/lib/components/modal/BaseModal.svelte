<script lang="ts">
  import { twMerge } from 'tailwind-merge'
  import type { Snippet } from 'svelte'

  interface Props {
    modalId?: string
    bodyClass?: string
    headerClass?: string
    closeModal?: () => void
    showCloseButton?: boolean
    showHeaderBorder?: boolean
    showFooterBorder?: boolean
    bodyScrollable?: boolean
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'wide' | 'full' | 'fit'
    containerClass?: string
    footerClass?: string
    header?: Snippet
    body?: Snippet
    footer?: Snippet
  }

  let {
    modalId = '',
    bodyClass = '',
    headerClass = '',
    closeModal = () => {},
    showCloseButton = true,
    showHeaderBorder = true,
    showFooterBorder = true,
    bodyScrollable = true,
    size = 'md',
    containerClass = '',
    footerClass = 'py-5 px-6',
    header,
    body,
    footer
  }: Props = $props()
</script>

<div class="flex h-full min-h-0 flex-1 flex-col bg-white {containerClass}">
  <!-- Header -->
  <div
    class={twMerge(
      headerClass,
      'flex shrink-0 items-center justify-between',
      showHeaderBorder ? 'border-b border-gray-100' : ''
    )}
  >
    {#if header}
      {@render header()}
    {/if}

    {#if showCloseButton}
      <!-- svelte-ignore a11y_consider_explicit_label -->
      <button
        type="button"
        class="text-gray-400 transition-colors hover:text-gray-600"
        onclick={closeModal}
      >
        <svg
          class="h-6 w-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    {/if}
  </div>

  <!-- Body -->
  <div
    class={twMerge(
      'flex-1 min-h-0 overscroll-y-contain',
      bodyScrollable ? 'overflow-y-auto contain-[layout_paint] transform-[translateZ(0)]' : '',
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
