<script lang="ts">
  type ButtonVariant = 'send' | 'cancel'

  interface Props {
    variant: ButtonVariant
    ariaLabel: string
    onclick?: () => void
    disabled?: boolean
  }

  let { variant, ariaLabel, onclick, disabled = false }: Props = $props()

  const hoverClasses: Record<ButtonVariant, string> = {
    send: 'hover:text-primary-500',
    cancel: 'hover:text-status-danger'
  }
</script>

<button
  {disabled}
  aria-label={ariaLabel}
  class="text-gray-400 transition-colors {hoverClasses[
    variant
  ]} disabled:opacity-50 disabled:cursor-not-allowed"
  {onclick}
>
  {#if variant === 'send'}
    <!-- 전송 아이콘 -->
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path
        d="M18 2L9 11M18 2L12 18L9 11M18 2L2 8L9 11"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  {:else if variant === 'cancel'}
    <!-- 취소 아이콘 -->
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path
        d="M5 5L15 15M15 5L5 15"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
      />
    </svg>
  {/if}
</button>
