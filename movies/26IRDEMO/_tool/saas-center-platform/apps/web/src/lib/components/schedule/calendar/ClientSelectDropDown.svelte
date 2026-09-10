<script lang="ts">
  import { twMerge } from 'tailwind-merge'
  import { fade } from 'svelte/transition'

  import ArrowDownIcon20 from '$lib/assets/ArrowDownIcon20.svelte'
  import { portal } from '$root/src/lib/utils/positionPortal'
  import Checkbox from '$lib/components/Checkbox.svelte'
  import SearchIcon from '$root/src/lib/assets/SearchIcon.svelte'
  import type { ClientListItem } from '$root/src/lib/hooks/actions/client.action'
  import { isSecretMode } from '$lib/stores/secret-mode.store'
  import { maskName } from '$lib/utils/maskingHandler'

  interface Props {
    options: ClientListItem[]
    selectedClientNames: string[] | null
  }

  let { options = [], selectedClientNames = $bindable() }: Props = $props()

  /** 트리거 라벨 — 첫 이름만 말줄임하고 "외 N명"은 잘리지 않게 분리한다 */
  const triggerLabel = $derived.by(() => {
    if (!selectedClientNames || selectedClientNames.length === 0)
      return '전체 내담자'
    const raw =
      options.find((o) => o.id === selectedClientNames![0])?.name ??
      selectedClientNames![0]
    return $isSecretMode ? maskName(raw) : raw
  })
  const triggerExtraCount = $derived(
    Math.max(0, (selectedClientNames?.length ?? 0) - 1)
  )

  const isFilterActive = $derived(
    selectedClientNames != null && selectedClientNames.length > 0
  )
  let isOpen = $state<boolean>(false)
  let buttonRef = $state<HTMLButtonElement | null>(null)
  let search = $state('') // input에 직접 바인딩
  let debouncedSearch = $state('') // 실제 필터에 사용

  /** 다중선택은 체크 즉시 반영하지 않고 draft에 모았다가 '적용'에서 커밋한다 */
  let draft = $state<string[]>([])

  const openDropdown = () => {
    draft = [...(selectedClientNames ?? [])]
    search = ''
    isOpen = true
  }

  const toggleCheck = (id: string) => {
    draft = draft.includes(id) ? draft.filter((n) => n !== id) : [...draft, id]
  }

  const apply = () => {
    selectedClientNames = [...draft]
    isOpen = false
  }

  const checkedNames = $derived.by<Set<string>>(() => new Set(draft))

  const isDirty = $derived.by(() => {
    const current = selectedClientNames ?? []
    if (current.length !== draft.length) return true
    const set = new Set(current)
    return draft.some((id) => !set.has(id))
  })

  const filteredClients = $derived.by<ClientListItem[]>(() => {
    const keyword = debouncedSearch.toLowerCase()
    return options.filter((client) =>
      client.name.toLowerCase().includes(keyword)
    )
  })

  $effect(() => {
    const value = search.trim()
    const timer = setTimeout(() => {
      debouncedSearch = value
    }, 300) // ← 디바운스 ms
    return () => clearTimeout(timer)
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
        <span class="dropdown-trigger-suffix">외 {triggerExtraCount}명</span>
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
      class="dropdown-panel z-50 w-62 gap-0 overflow-hidden"
    >
      <!-- 검색 — 담당자 드롭다운과 동일 규격 -->
      <div class="dropdown-search">
        <SearchIcon class="shrink-0" />
        <input type="text" bind:value={search} placeholder="내담자 검색" />
      </div>
      <div class="dropdown-list mt-2 min-h-0 flex-1 overflow-y-auto">
        {#each filteredClients as client}
          <button
            type="button"
            onclick={() => toggleCheck(client.id)}
            class="dropdown-item"
          >
            <span>{$isSecretMode ? maskName(client.name) : client.name}</span>
            <Checkbox
              id={`client-filter-${client.id}`}
              checked={checkedNames.has(client.id)}
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
