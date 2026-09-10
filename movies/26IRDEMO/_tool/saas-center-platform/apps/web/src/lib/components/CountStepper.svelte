<script lang="ts">
  import { twMerge } from 'tailwind-merge'

  export let value = 1
  export let min = 0
  export let max = Infinity
  export let step = 1

  const clamp = (v: number) => Math.min(max, Math.max(min, v))

  const handleInput = (e: Event) => {
    const target = e.target as HTMLInputElement
    const next = Number(target.value)

    if (Number.isNaN(next)) return

    value = clamp(next)
  }

  const decrease = () => {
    value = Math.max(min, value - step)
  }

  const increase = () => {
    value = Math.min(max, value + step)
  }
</script>

<div
  class={twMerge(
    'border border-gray-200 h-12 w-44 rounded-norm grid grid-cols-[48px_80px_48px] overflow-hidden',
    $$props['class']
  )}
>
  <!-- 감소 버튼 -->
  <button
    class="flex-center border-r border-gray-200 disabled:opacity-40"
    on:click={decrease}
    disabled={value <= min}
    aria-label="감소"
  >
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path
        d="M18 12L6 12"
        stroke="#256EF4"
        stroke-width="2"
        stroke-linecap="round"
      />
    </svg>
  </button>

  <!-- 값 표시 -->
  <div class="flex-center px-2">
    <input
      type="number"
      class={twMerge(
        'w-full text-right text-base font-semibold',
        'outline-none',
        'appearance-none',
        '[&::-webkit-outer-spin-button]:appearance-none',
        '[&::-webkit-inner-spin-button]:appearance-none',
        '[&::-webkit-inner-spin-button]:m-0',
        '[appearance:textfield]'
      )}
      bind:value
      {min}
      {max}
      on:input={handleInput}
    />
    <div class="text-lg flex-center w-8!">회</div>
  </div>

  <!-- 증가 버튼 -->
  <button
    class="flex-center border-l border-gray-200 disabled:opacity-40"
    on:click={increase}
    disabled={value >= max}
    aria-label="증가"
  >
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 6L12 18"
        stroke="#256EF4"
        stroke-width="2"
        stroke-linecap="round"
      />
      <path
        d="M18 12L6 12"
        stroke="#256EF4"
        stroke-width="2"
        stroke-linecap="round"
      />
    </svg>
  </button>
</div>
