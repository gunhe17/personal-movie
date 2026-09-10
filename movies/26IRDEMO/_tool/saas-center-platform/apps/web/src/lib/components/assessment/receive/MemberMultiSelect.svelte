<style>
  .member-multiselect-scroll::-webkit-scrollbar {
    width: 6px;
  }
  .member-multiselect-scroll::-webkit-scrollbar-track {
    background: transparent;
  }
  .member-multiselect-scroll::-webkit-scrollbar-thumb {
    background: #d1d5db;
    border-radius: 3px;
  }
  .member-multiselect-scroll::-webkit-scrollbar-thumb:hover {
    background: #9ca3af;
  }
</style>

<script lang="ts">
  import type { Snippet } from 'svelte'
  import { quintOut } from 'svelte/easing'
  import { slide } from 'svelte/transition'
  import Typography from '@common/components/Typography.svelte'
  import { portal } from '$lib/utils/positionPortal'
  import Checkbox from '$lib/components/Checkbox.svelte'
  import AvatarImage from '$lib/assets/memberAvatar.png'
  import CircleClose16 from '$root/src/lib/assets/CircleClose16.svelte'
  import type { MemberListItem } from '$lib/hooks/actions/member.action'

  type ChipSlotProps = { member: MemberListItem; onRemove: () => void }

  interface Props {
    options: MemberListItem[]
    selected?: MemberListItem[]
    label?: string
    required?: boolean
    placeholder?: string
    chip?: Snippet<[ChipSlotProps]>
  }

  let {
    options,
    selected = $bindable([]),
    label = '담당자',
    required = false,
    placeholder = '담당자 이름을 검색해주세요',
    chip: chipSlot
  }: Props = $props()

  let searchQuery = $state('')
  let isDropdownOpen = $state(false)
  let inputEl = $state<HTMLInputElement | null>(null)
  let pendingSelection = $state<MemberListItem[]>([])

  const memberName = (m: MemberListItem) => m.person?.name ?? m.id

  const displayOptions = $derived(
    searchQuery.trim() === ''
      ? options
      : options.filter((m) =>
          memberName(m).toLowerCase().includes(searchQuery.toLowerCase())
        )
  )

  const isPendingSelected = (id: string) =>
    pendingSelection.some((m) => m.id === id)

  function togglePending(member: MemberListItem) {
    const exists = pendingSelection.some((m) => m.id === member.id)
    pendingSelection = exists
      ? pendingSelection.filter((m) => m.id !== member.id)
      : [...pendingSelection, member]
  }

  function handleFocus() {
    pendingSelection = [...selected]
    isDropdownOpen = true
  }

  function handleConfirm() {
    selected = [...pendingSelection]
    searchQuery = ''
    isDropdownOpen = false
  }

  function removeFromSelected(member: MemberListItem) {
    selected = selected.filter((m) => m.id !== member.id)
  }
</script>

<div class="mb-8">
  {#if label}
    <Typography
      variant="body-02-normal-medium"
      color="text-title-subtitle"
      className="mb-2"
    >
      {label}
      {#if required}<span class="field-required">*</span>{/if}
    </Typography>
  {/if}
  <div class="relative z-[60]">
    <input
      type="text"
      bind:this={inputEl}
      bind:value={searchQuery}
      onfocus={handleFocus}
      {placeholder}
      class="field-input w-full"
    />
  </div>
  {#if isDropdownOpen}
    <div
      use:portal={{
        anchor: inputEl,
        offset: 8,
        callback: () => {
          handleConfirm()
        }
      }}
      class="dropdown-panel max-h-none overflow-hidden fixed z-[20000]"
      transition:slide={{ duration: 300, easing: quintOut }}
    >
      {#if displayOptions.length > 0}
        <div class="flex flex-col">
          <div
            class="member-multiselect-scroll dropdown-list max-h-50 grow overflow-y-auto"
          >
            {#each displayOptions as member}
              <button
                type="button"
                onclick={(e) => {
                  e.preventDefault()
                  togglePending(member)
                }}
                class="dropdown-item"
              >
                <span class="flex min-w-0 items-center gap-3">
                  <img src={AvatarImage} alt="" class="h-6 w-6 rounded-full" />
                  {memberName(member)}
                </span>
                <Checkbox
                  id={`member-multiselect-${member.id}`}
                  checked={isPendingSelected(member.id)}
                  readonly
                />
              </button>
            {/each}
          </div>
          <div
            class="mt-1 flex min-h-15 shrink-0 items-end justify-between border-t border-gray-100 pt-3"
          >
            <div class="flex flex-1 flex-wrap items-center gap-1.5">
              {#each pendingSelection as member}
                {#if chipSlot}
                  {@render chipSlot({
                    member,
                    onRemove: () => togglePending(member)
                  })}
                {:else}
                  <span
                    class="inline-flex h-9 min-w-20 items-center justify-center gap-1 rounded-lg border border-primary-400 bg-primary-50 px-2"
                  >
                    <Typography
                      variant="body-03-normal-medium"
                      color="text-primary-500"
                    >
                      {memberName(member)}
                    </Typography>
                    <button
                      type="button"
                      onclick={() => togglePending(member)}
                      class="flex items-center justify-center"
                      aria-label="제거"
                    >
                      <CircleClose16 />
                    </button>
                  </span>
                {/if}
              {/each}
            </div>
            <button
              type="button"
              class="dropdown-footer-apply"
              disabled={pendingSelection.length === 0}
              onclick={handleConfirm}
            >
              적용
            </button>
          </div>
        </div>
      {:else}
        <div class="flex items-center justify-center p-8">
          <Typography variant="body-02-medium" color="text-gray-400"
            >검색 결과가 없습니다</Typography
          >
        </div>
      {/if}
    </div>
  {/if}
  {#if selected.length > 0}
    <div class="mt-2 flex flex-wrap items-center gap-2">
      {#each selected as member}
        {#if chipSlot}
          {@render chipSlot({
            member,
            onRemove: () => removeFromSelected(member)
          })}
        {:else}
          <span
            class="inline-flex h-9 min-w-20 items-center justify-center gap-1 rounded-lg border border-primary-400 bg-primary-50 px-2"
          >
            <Typography
              variant="body-03-normal-medium"
              color="text-primary-500"
            >
              {memberName(member)}
            </Typography>
            <button
              type="button"
              onclick={() => removeFromSelected(member)}
              class="flex items-center justify-center"
              aria-label="선택 해제"
            >
              <CircleClose16 />
            </button>
          </span>
        {/if}
      {/each}
    </div>
  {/if}
</div>
