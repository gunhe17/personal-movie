<style>
  /* 스크롤바 스타일링 */
  ::-webkit-scrollbar {
    width: 6px;
  }

  ::-webkit-scrollbar-track {
    background: transparent;
  }

  ::-webkit-scrollbar-thumb {
    background: #d1d5db;
    border-radius: 3px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: #9ca3af;
  }
</style>

<script lang="ts">
  import ArrowDownIcon20 from '$lib/assets/ArrowDownIcon20.svelte'
  import { twMerge } from 'tailwind-merge'

  import { queryBuilder } from '../../hooks/queries/builder'
  import { getMemberList } from '../../hooks/actions/member.action'

  import { portal } from '../../utils/positionPortal'

  import Typography from '@common/components/Typography.svelte'
  import { slide } from 'svelte/transition'
  import { quintOut } from 'svelte/easing'

  interface Props {
    specialist_name: string
    onManagerSelect: (manager: any) => void
  }

  let { specialist_name, onManagerSelect }: Props = $props()

  let triggerEl = $state<HTMLElement | null>(null)
  let dropdownEl = $state<HTMLElement | null>(null)
  let members = $state<any[]>([])
  let isDropdownOpen = $state<boolean>(false)

  const memberList = $derived(
    queryBuilder(getMemberList, () => ({
      center_id: '46d1573e-dfca-4fb1-adff-ba1f4cecc947'
    }))
  )

  const toggle = () => {
    isDropdownOpen = !isDropdownOpen
  }

  const onSelect = (manager: any) => {
    onManagerSelect(manager)
    isDropdownOpen = false
  }

  const handleBlur = (e: FocusEvent) => {
    const next = e.relatedTarget as HTMLElement | null
    if (dropdownEl && next && dropdownEl.contains(next)) return
    isDropdownOpen = false
  }

  $effect(() => {
    if (memberList && memberList.isSuccess) {
      members = memberList.data?.items ?? []
    }
  })
</script>

<div class="relative" transition:slide={{ duration: 200, easing: quintOut }}>
  <button
    type="button"
    bind:this={triggerEl}
    onclick={toggle}
    onblur={handleBlur}
    class={twMerge(
      'dropdown-trigger w-full',
      isDropdownOpen && 'is-open',
      !specialist_name && 'is-placeholder'
    )}
  >
    <span class="dropdown-trigger-label">
      {#if specialist_name}
        {specialist_name} 선생님
      {:else}
        담당 선생님을 선택해주세요
      {/if}
    </span>
    <ArrowDownIcon20
      class={twMerge(
        'pointer-events-none shrink-0 duration-300',
        isDropdownOpen && 'rotate-180'
      )}
    />
  </button>
  {#if isDropdownOpen}
    <div
      bind:this={dropdownEl}
      tabindex="-1"
      transition:slide={{ duration: 200, easing: quintOut }}
      use:portal={{
        anchor: triggerEl,
        offset: 8,
        callback: () => {
          isDropdownOpen = false
        }
      }}
      class="dropdown-panel max-h-none overflow-hidden fixed z-20000 min-w-(--trigger-width)"
    >
      {#if members.length > 0}
        <div class="dropdown-list max-h-70 overflow-y-auto">
          {#each members as member}
            <button
              type="button"
              onmousedown={() => onSelect(member)}
              class={`dropdown-item ${specialist_name === member.name ? 'is-selected' : ''}`}
            >
              <span>{member.name}</span>
            </button>
          {/each}
        </div>
      {:else}
        <div class="p-6 text-center">
          <Typography variant="body-02-medium" color="text-gray-400">
            선택할 항목이 없습니다
          </Typography>
        </div>
      {/if}
    </div>
  {/if}
</div>
