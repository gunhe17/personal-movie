<script lang="ts">
  import { twMerge } from 'tailwind-merge'
  import { fade, slide } from 'svelte/transition'

  import { portal } from '$root/src/lib/utils/positionPortal'
  import SearchIcon from '$root/src/lib/assets/SearchIcon.svelte'
  import ArrowDownIcon20 from '$lib/assets/ArrowDownIcon20.svelte'
  import Checkbox from '$lib/components/Checkbox.svelte'
  import { getColorFromString } from '$root/src/lib/utils/colorConverter'
  import type { MemberListItem } from '$root/src/lib/hooks/actions/member.action'
  import PermissionGuard from '@common/components/PermissionGuard.svelte'
  import { MEMBER_PERMISSIONS } from '$root/src/lib/features/members'

  interface GroupedMember {
    id: string
    title: string
    count: number
    members: {
      id: string
      name: string
      status: MemberListItem['is_active']
      role: MemberListItem['role_name']
      color: string
    }[]
  }

  interface Props {
    containerClass?: string
    options: MemberListItem[]
    selectedManagerNames: string[] | null
  }

  let {
    containerClass = '',
    options = [],
    selectedManagerNames = $bindable()
  }: Props = $props()

  const isFilterActive = $derived(
    selectedManagerNames != null && selectedManagerNames.length > 0
  )
  let isOpen = $state<boolean>(false)
  let buttonRef = $state<HTMLButtonElement | null>(null)
  let openGroupId = $state<string | null>('언어치료')
  let search = $state('') // input에 직접 바인딩
  let debouncedSearch = $state('') // 실제 필터에 사용

  const toggleGroup = (id: string) => {
    openGroupId = openGroupId === id ? null : id
  }

  /** 트리거 라벨 — 첫 이름만 말줄임하고 "외 N명"은 잘리지 않게 분리한다 */
  const triggerLabel = $derived.by(() => {
    if (!selectedManagerNames || selectedManagerNames.length === 0)
      return '전체 담당자'
    return (
      options.find((o) => o.id === selectedManagerNames![0])?.person.name ??
      selectedManagerNames![0]
    )
  })
  const triggerExtraCount = $derived(
    Math.max(0, (selectedManagerNames?.length ?? 0) - 1)
  )

  /** 다중선택은 체크 즉시 반영하지 않고 draft에 모았다가 '적용'에서 커밋한다 */
  let draft = $state<string[]>([])

  const openDropdown = () => {
    draft = [...(selectedManagerNames ?? [])]
    search = ''
    isOpen = true
  }

  const toggleCheck = (id: string) => {
    draft = draft.includes(id) ? draft.filter((n) => n !== id) : [...draft, id]
  }

  const apply = () => {
    selectedManagerNames = [...draft]
    isOpen = false
  }

  const checkedNames = $derived.by<Set<string>>(() => new Set(draft))

  const isDirty = $derived.by(() => {
    const current = selectedManagerNames ?? []
    if (current.length !== draft.length) return true
    const set = new Set(current)
    return draft.some((id) => !set.has(id))
  })

  const groupedBySpecial = $derived.by<GroupedMember[]>(() => {
    const map = new Map<string, GroupedMember>()
    const keyword = debouncedSearch.toLowerCase()
    for (const member of options) {
      if (keyword && !member.person.name.toLowerCase().includes(keyword)) {
        continue
      }
      const key = member.role_name as string
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          title: key,
          count: 0,
          members: []
        })
      }
      const group = map.get(key)!
      group.count += 1
      group.members.push({
        id: member.id,
        name: member.person.name,
        status: member.is_active,
        role: member.role_name,
        color: member.color || getColorFromString(member.id)
      })
    }
    return Array.from(map.values())
  })

  $effect(() => {
    const value = search.trim()
    const timer = setTimeout(() => {
      debouncedSearch = value
    }, 300) // ← 디바운스 ms
    return () => clearTimeout(timer)
  })
</script>

<PermissionGuard permission={MEMBER_PERMISSIONS.modify}>
  <div class={twMerge('relative', containerClass)}>
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
      <ul
        transition:fade={{ duration: 150 }}
        use:portal={{
          anchor: buttonRef,
          offset: 4,
          isFitWidth: false,
          callback: () => {
            isOpen = !isOpen
          }
        }}
        class="dropdown-panel z-50 w-62 gap-0 overflow-hidden"
      >
        <!-- 검색 (Figma 3437:237148) — h44 · bg gray-50 · 1px gray-100 · radius 8 -->
        <div class="dropdown-search">
          <SearchIcon class="shrink-0" />
          <input type="text" bind:value={search} placeholder="담당자 검색" />
        </div>
        <!-- 그룹 리스트 — 그룹당 상하 8, 그룹 사이 1px gray-200 (마지막 제외) -->
        <div class="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {#each groupedBySpecial as group}
            <div class="border-b border-gray-200 py-2 last:border-b-0">
              <!-- 그룹 헤더: 높이 36 (py 8 포함 52) -->
              <button
                type="button"
                onclick={() => toggleGroup(group.id)}
                class="flex h-9 w-full items-center justify-between px-1 text-left"
              >
                <span
                  class="text-body-02-normal-semibold flex items-center gap-2 text-gray-800"
                >
                  <span>{group.title}</span>
                  <span>{group.count}</span>
                </span>
                <span
                  class={twMerge(
                    'flex shrink-0 transition-transform duration-200',
                    openGroupId === group.id ? 'rotate-180' : ''
                  )}
                >
                  <ArrowDownIcon20 />
                </span>
              </button>
              <!-- 멤버 -->
              {#if openGroupId === group.id && group.members.length > 0}
                <div
                  class="mt-2 flex flex-col"
                  transition:slide={{ duration: 150 }}
                >
                  {#each group.members as member}
                    <button
                      type="button"
                      onclick={() => toggleCheck(member.id)}
                      class="dropdown-item"
                    >
                      <span class="flex min-w-0 items-center gap-2">
                        <span
                          class="dropdown-item-dot"
                          style:background={member.color}
                        ></span>
                        {member.name}
                      </span>
                      <Checkbox
                        id={`manager-filter-${member.id}`}
                        checked={checkedNames.has(member.id)}
                        readonly
                      />
                    </button>
                  {/each}
                </div>
              {/if}
            </div>
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
      </ul>
    {/if}
  </div>
</PermissionGuard>
