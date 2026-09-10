<script lang="ts">
  import { twMerge } from 'tailwind-merge'

  import Typography from '@common/components/Typography.svelte'

  type Option<T = string> = {
    label: string
    value: T
  }

  export let options: Option[] = []
  export let value: string

  let buttons: HTMLElement[] = []

  const registerButton = (node: HTMLElement, index: number) => {
    buttons[index] = node
    // 배열 재할당으로 반응성 트리거
    buttons = [...buttons]
  }

  $: activeIndex = options.findIndex((o) => o.value === value)
</script>

<div
  class={twMerge(
    'relative grid bg-gray-100 h-11 p-1 rounded-lg',
    $$props['class']
  )}
  style="grid-template-columns: repeat({options.length}, minmax(0, 1fr));"
>
  {#each options as option, i}
    <button
      use:registerButton={i}
      on:click={() => (value = option.value)}
      class="py-2 rounded-lg relative z-10"
    >
      <Typography
        variant="body-01-semibold"
        className="duration-500"
        color={value === option.value ? 'text-white' : 'text-gray-400'}
      >
        {option.label}
      </Typography>
    </button>
  {/each}
  {#if buttons.length === options.length && buttons[activeIndex]}
    <!-- svelte-ignore element_invalid_self_closing_tag -->
    <div
      class="
      absolute inset-1 rounded-lg
      bg-primary-400 shadow-sm
      transition-all duration-300
    "
      style="
      width: {buttons[activeIndex]?.offsetWidth || 0}px;
      transform: translateX({buttons[activeIndex]?.offsetLeft || 0}px);
    "
    />
  {/if}
</div>
