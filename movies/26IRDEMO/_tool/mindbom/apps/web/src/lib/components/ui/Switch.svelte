<script lang="ts">
  import { twMerge } from 'tailwind-merge'

  interface Props {
    className?: string
    checked?: boolean
    onclick?: () => void
    ariaLabel?: string
    disabled?: boolean
  }

  let {
    className = '',
    checked = $bindable(false),
    onclick = () => {},
    ariaLabel = '',
    disabled = false
  }: Props = $props()

  function handleClick() {
    if (!disabled) {
      checked = !checked
      onclick()
    }
  }
</script>

<button
  onclick={handleClick}
  aria-label={ariaLabel}
  {disabled}
  class={twMerge(
    'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
    checked ? 'bg-blue-500' : 'bg-gray-300',
    disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
    className
  )}
>
  <span
    class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform {checked
      ? className
        ? 'translate-x-5'
        : 'translate-x-6'
      : 'translate-x-1'}"
  ></span>
</button>
