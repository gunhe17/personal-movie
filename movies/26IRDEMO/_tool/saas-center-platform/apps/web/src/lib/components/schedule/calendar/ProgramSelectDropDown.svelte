<script lang="ts">
  import { fade } from 'svelte/transition'
  import { twMerge } from 'tailwind-merge'

  import ArrowDownIcon20 from '$lib/assets/ArrowDownIcon20.svelte'
  import { portal } from '$root/src/lib/utils/positionPortal'
  import Checkbox from '$lib/components/Checkbox.svelte'

  interface Props {
    options: { label: string; value: string }[]
    selectedProgramOptions: string[] | null
  }

  let { options = [], selectedProgramOptions = $bindable() }: Props = $props()

  const isFilterActive = $derived(
    selectedProgramOptions != null &&
      selectedProgramOptions.length > 0 &&
      selectedProgramOptions.length < options.length
  )
  let isOpen = $state<boolean>(false)
  let buttonRef = $state<HTMLButtonElement | null>(null)

  const OPTION_MAP: Record<string, string> = {
    assessment: '검사',
    counseling: '상담',
    meeting: '운영'
  }

  /** 트리거 라벨 — 첫 항목만 말줄임하고 "외 N개"는 잘리지 않게 분리한다 */
  const triggerLabel = $derived(
    !selectedProgramOptions || selectedProgramOptions.length === 0
      ? '전체 유형'
      : (OPTION_MAP[selectedProgramOptions[0]] ?? selectedProgramOptions[0])
  )
  const triggerExtraCount = $derived(
    Math.max(0, (selectedProgramOptions?.length ?? 0) - 1)
  )

  /** 다중선택은 체크 즉시 반영하지 않고 draft에 모았다가 '적용'에서 커밋한다 */
  let draft = $state<string[]>([])

  const openDropdown = () => {
    draft = [...(selectedProgramOptions ?? [])]
    isOpen = true
  }

  const toggleProgramOption = (value: string) => {
    draft = draft.includes(value)
      ? draft.filter((o) => o !== value)
      : [...draft, value]
  }

  const apply = () => {
    selectedProgramOptions = [...draft]
    isOpen = false
  }

  const isDirty = $derived.by(() => {
    const current = selectedProgramOptions ?? []
    if (current.length !== draft.length) return true
    const set = new Set(current)
    return draft.some((v) => !set.has(v))
  })
</script>

<div class="relative">
  <button
    bind:this={buttonRef}
    onclick={(e) => {
      e.preventDefault()
      if (isOpen) isOpen = false
      else openDropdown()
    }}
    class={twMerge(
      'dropdown-trigger',
      isOpen && 'is-open',
      isFilterActive && 'is-active'
    )}
  >
    <span class="flex min-w-0 flex-1 items-center gap-1">
      <span class="dropdown-trigger-label">{triggerLabel}</span>
      {#if triggerExtraCount > 0}
        <span class="dropdown-trigger-suffix">외 {triggerExtraCount}개</span>
      {/if}
    </span>
    <ArrowDownIcon20
      class={twMerge(
        'pointer-events-none shrink-0 duration-300',
        isOpen && 'rotate-180'
      )}
      color={isFilterActive
        ? 'var(--color-primary-600)'
        : 'var(--color-icon-primary)'}
    />
  </button>
  {#if isOpen}
    <div
      transition:fade={{ duration: 150 }}
      use:portal={{
        anchor: buttonRef,
        offset: 4,
        isFitWidth: false,
        callback: () => {
          isOpen = false
        }
      }}
      class="dropdown-panel z-50"
    >
      <div class="dropdown-list">
        {#each options as option}
          <button
            type="button"
            onclick={() => toggleProgramOption(option.value)}
            class="dropdown-item"
          >
            <span>{option.label}</span>
            <Checkbox
              id={`program-filter-${option.value}`}
              checked={draft.includes(option.value)}
              readonly
            />
          </button>
        {/each}
      </div>
      <!-- 다중선택 액션 바 — 접수일 필터와 동일 규격 -->
      <div class="dropdown-footer">
        <button
          type="button"
          class="dropdown-footer-reset"
          onclick={() => (draft = [])}
        >
          초기화
        </button>
        <button
          type="button"
          class="dropdown-footer-apply"
          disabled={!isDirty}
          onclick={apply}
        >
          적용
        </button>
      </div>
    </div>
  {/if}
</div>
