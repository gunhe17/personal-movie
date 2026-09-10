<style>
  .staff-inline-scroll::-webkit-scrollbar {
    width: 6px;
  }
  .staff-inline-scroll::-webkit-scrollbar-track {
    background: transparent;
  }
  .staff-inline-scroll::-webkit-scrollbar-thumb {
    background: #d1d5db;
    border-radius: 3px;
  }
  .staff-inline-scroll::-webkit-scrollbar-thumb:hover {
    background: #9ca3af;
  }
</style>

<script lang="ts">
  import { onMount, tick } from 'svelte'
  import { slide } from 'svelte/transition'
  import Typography from '@common/components/Typography.svelte'
  import AvatarImage from '$lib/assets/memberAvatar.png'
  import Checkbox from '$lib/components/Checkbox.svelte'
  import type { MemberListItem } from '$lib/hooks/actions/member.action'

  /** 모달 등 제한된 영역 내에서 사용. 드롭다운이 document flow를 차지하여 스크롤과 함께 보임 */
  interface Props {
    options: MemberListItem[]
    selected?: MemberListItem[]
    label?: string
    required?: boolean
    placeholder?: string
  }

  let {
    options,
    selected = $bindable([]),
    label = '담당자',
    required = false,
    placeholder = '담당자 이름을 검색해주세요'
  }: Props = $props()

  let searchQuery = $state('')
  let isDropdownOpen = $state(false)
  let containerRef: HTMLDivElement | null = $state(null)
  let dropdownRef: HTMLDivElement | null = $state(null)

  const memberName = (m: MemberListItem) => m.person?.name ?? m.id

  const displayOptions = $derived(
    searchQuery.trim() === ''
      ? options
      : options.filter((m) =>
          memberName(m).toLowerCase().includes(searchQuery.toLowerCase())
        )
  )

  const isSelected = (id: string) => selected.some((m) => m.id === id)

  function toggleSelected(member: MemberListItem) {
    const exists = selected.some((m) => m.id === member.id)
    selected = exists
      ? selected.filter((m) => m.id !== member.id)
      : [...selected, member]
  }

  function findScrollParent(el: HTMLElement | null): HTMLElement | null {
    let parent = el?.parentElement
    while (parent) {
      const style = getComputedStyle(parent)
      const overflowY = style.overflowY
      if (
        overflowY === 'auto' ||
        overflowY === 'scroll' ||
        overflowY === 'overlay'
      ) {
        return parent
      }
      parent = parent.parentElement
    }
    return null
  }

  async function handleFocus() {
    isDropdownOpen = true
    await tick()
    await new Promise((r) => requestAnimationFrame(r))
    await new Promise((r) => setTimeout(r, 250))

    const scrollParent = findScrollParent(dropdownRef)
    if (scrollParent && dropdownRef) {
      const spRect = scrollParent.getBoundingClientRect()
      const ddRect = dropdownRef.getBoundingClientRect()
      const visibleBottom = spRect.top + scrollParent.clientHeight
      if (ddRect.bottom > visibleBottom) {
        const scrollAmount = ddRect.bottom - visibleBottom
        scrollParent.scrollTo({
          top: scrollParent.scrollTop + scrollAmount,
          behavior: 'smooth'
        })
      }
    }
  }

  function handleClose() {
    searchQuery = ''
    isDropdownOpen = false
  }

  onMount(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        isDropdownOpen &&
        containerRef &&
        !containerRef.contains(event.target as Node)
      ) {
        handleClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  })
</script>

<div class="w-full" bind:this={containerRef}>
  {#if label}
    <Typography
      variant="body-02-normal-medium"
      color="text-title-subtitle"
      className="mb-3"
    >
      {label}
      {#if required}<span class="field-required">*</span>{/if}
    </Typography>
  {/if}

  <div class="relative">
    <input
      type="text"
      bind:value={searchQuery}
      onfocus={handleFocus}
      {placeholder}
      class="text-body-02-normal-regular h-[44px] w-full rounded-lg border border-gray-200 bg-white px-3 outline-none transition-colors placeholder:text-placeholder focus:border-border-active"
    />
  </div>

  <!-- 인라인 드롭다운: document flow를 차지하여 모달 body 스크롤과 함께 동작 -->
  {#if isDropdownOpen}
    <div
      bind:this={dropdownRef}
      transition:slide={{ duration: 200 }}
      class="dropdown-panel max-h-none overflow-hidden mt-2"
    >
      <div class="flex flex-col">
        {#if displayOptions.length > 0}
          <div
            class="staff-inline-scroll dropdown-list max-h-[200px] overflow-y-auto"
          >
            {#each displayOptions as member}
              <button
                type="button"
                onclick={(e) => {
                  e.preventDefault()
                  toggleSelected(member)
                }}
                class="dropdown-item"
              >
                <span class="flex min-w-0 items-center gap-3">
                  <img
                    src={AvatarImage}
                    alt=""
                    class="h-6 w-6 shrink-0 rounded-full"
                  />
                  {memberName(member)}
                </span>
                <Checkbox
                  id={`staff-inline-${member.id}`}
                  checked={isSelected(member.id)}
                  readonly
                />
              </button>
            {/each}
          </div>
        {:else}
          <div class="flex items-center justify-center p-8">
            <Typography variant="body-02-medium" color="text-gray-400">
              검색 결과가 없습니다
            </Typography>
          </div>
        {/if}

        {#if selected.length > 0}
          <div
            class="mt-1 flex min-h-15 shrink-0 items-end border-t border-gray-100 pt-3"
          >
            <div class="flex flex-1 flex-wrap items-center gap-1.5">
              {#each selected as member}
                <span
                  class="inline-flex items-center gap-1.5 rounded-lg border border-primary-200 bg-primary-50 px-2.5 py-1.5 text-body-03-normal-medium text-gray-900"
                >
                  {memberName(member)}
                  <button
                    type="button"
                    onclick={() => toggleSelected(member)}
                    class="flex h-5 w-5 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-primary-100 hover:text-gray-600"
                    aria-label="제거"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path
                        d="M9 3L3 9M3 3l6 6"
                        stroke="currentColor"
                        stroke-width="1.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                    </svg>
                  </button>
                </span>
              {/each}
            </div>
          </div>
        {/if}
        <!-- 다중선택 액션 바 — 접수일 필터와 동일 규격 -->
        <div class="dropdown-footer">
          <button
            type="button"
            class="dropdown-footer-apply"
            onclick={() => (isDropdownOpen = false)}
          >
            적용
          </button>
        </div>
      </div>
    </div>
  {/if}

  {#if !isDropdownOpen && selected.length > 0}
    <div class="mt-3 flex flex-wrap gap-2">
      {#each selected as member}
        <span
          class="inline-flex items-center gap-1.5 rounded-lg border border-primary-300 bg-primary-50 px-4 py-2 text-body-02-normal-medium text-gray-900"
        >
          {memberName(member)}
          <button
            type="button"
            onclick={() => toggleSelected(member)}
            class="flex h-5 w-5 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-primary-100 hover:text-gray-600"
            aria-label="선택 해제"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M9 3L3 9M3 3l6 6"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>
        </span>
      {/each}
    </div>
  {/if}
</div>
