<script lang="ts">
  import ArrowDownIcon20 from '$lib/assets/ArrowDownIcon20.svelte'
  import { twMerge } from 'tailwind-merge'
  import { quintOut } from 'svelte/easing'
  import { fade, slide } from 'svelte/transition'

  import { portal } from '../utils/positionPortal'
  import Typography from '@common/components/Typography.svelte'

  interface Props {
    value: number | null
    option: number[]
  }

  let { value = $bindable(), option = [] }: Props = $props()

  let isOpen = $state<boolean>(false)
  let customValue = $state<string>('')
  let inputEl = $state<HTMLElement | null>(null)

  const formatDuration = (customValue: string) => {
    const m = Number(customValue.replace(/[^0-9]/g, ''))
    return m >= 60
      ? `${Math.floor(m / 60)}시간 ${m % 60 ? `${m % 60}분` : ''}`
      : `${m}분`
  }
</script>

<!-- Select -->
<div class="relative w-full">
  <button
    bind:this={inputEl}
    type="button"
    class={twMerge(
      'dropdown-trigger w-full',
      isOpen && 'is-open',
      !value && 'is-placeholder'
    )}
    onclick={() => (isOpen = !isOpen)}
  >
    <span class="dropdown-trigger-label">
      {value ? `${value} 분` : '시간을 선택해주세요'}
    </span>
    <ArrowDownIcon20
      class={twMerge(
        'pointer-events-none shrink-0 duration-300',
        isOpen && 'rotate-180'
      )}
    />
  </button>
  {#if isOpen}
    <div
      use:portal={{
        anchor: inputEl,
        offset: 4,
        callback: () => (isOpen = false)
      }}
      class="dropdown-panel max-h-none overflow-hidden fixed z-20000"
      transition:slide={{ duration: 250, easing: quintOut }}
    >
      <div class="dropdown-list max-h-60 overflow-y-auto">
        {#each option as t}
          <button
            type="button"
            onclick={() => {
              value = t
              isOpen = false
            }}
            class={`dropdown-item ${value === t ? 'is-selected' : ''}`}
          >
            {t} 분
          </button>
        {/each}
      </div>
      <!-- 직접 입력 -->
      <div class="mt-1 border-t border-gray-100 pt-2">
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <div class="flex items-center gap-2">
          <div
            class="relative rounded-lg border border-gray-200 grow focus-within:border-border-active"
          >
            <input
              type="text"
              inputmode="numeric"
              placeholder="소요시간을 직접 입력하세요"
              bind:value={customValue}
              onkeydown={(e) => {
                if (e.key === 'Enter') {
                  const num = Number(customValue.replace(/[^0-9]/g, ''))
                  if (num > 0) {
                    value = num
                    isOpen = false
                    customValue = ''
                  }
                }
              }}
              class="h-10 w-full text-body-02-normal-medium px-2.5 outline-none"
            />
            {#if customValue}
              <span
                transition:fade
                class="absolute text-sm top-1/2 -translate-y-1/2 right-4 text-gray-500"
              >
                {formatDuration(customValue)}
              </span>
            {/if}
          </div>
          <button
            disabled={!customValue}
            onclick={() => {
              const num = Number(customValue.replace(/[^0-9]/g, ''))
              if (num > 0) {
                value = num
                isOpen = false
                customValue = ''
              }
            }}
            class="rounded-lg w-14 h-10 bg-primary-500 disabled:bg-action-primary-disabled duration-200"
          >
            <Typography variant="body-03-medium" color="text-white">
              확인
            </Typography>
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>
