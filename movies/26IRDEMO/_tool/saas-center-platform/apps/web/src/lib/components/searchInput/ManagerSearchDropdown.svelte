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
  import { quintOut } from 'svelte/easing'
  import { slide } from 'svelte/transition'

  import { queryBuilder } from '../../hooks/queries/builder'
  import { getMemberList } from '../../hooks/actions/member.action'
  import { centerId } from '$lib/stores/center.store'

  import { portal } from '../../utils/positionPortal'

  import Typography from '@common/components/Typography.svelte'
  import SpecialistChip from '../chip/SpecialistChip.svelte'
  import Checkbox from '../Checkbox.svelte'

  type ManagerItem = { id: string; name: string }

  interface Props {
    searchQuery: string
    checkedSpecialists: ManagerItem[]
  }

  let { searchQuery, checkedSpecialists = $bindable() }: Props = $props()

  let allManagers = $state<ManagerItem[]>([])
  let isDropdownOpen = $state<boolean>(false)
  let inputEl = $state<HTMLInputElement | null>(null)

  let displayManagers = $derived.by(() => {
    const q = searchQuery.toLowerCase()
    return allManagers.filter((m) => m.name.toLowerCase().includes(q))
  })

  const managerList = $derived(
    queryBuilder(getMemberList, () => ({
      centerId: $centerId!
    }))
  )

  const toggleManager = (manager: ManagerItem) => {
    const exists = checkedSpecialists.some((m) => m.id === manager.id)
    checkedSpecialists = exists
      ? checkedSpecialists.filter((m) => m.id !== manager.id)
      : [...checkedSpecialists, manager]
  }

  const isSelected = (id: string) => checkedSpecialists.some((m) => m.id === id)

  const handleManagerSearchFocus = () => {
    isDropdownOpen = true
  }

  $effect(() => {
    if (managerList && managerList.isSuccess) {
      allManagers = (managerList.data?.items ?? []).map((member: any) => ({
        id: member.id,
        name: member.person?.name ?? '이름 없음'
      }))
    }
  })
</script>

<div class="relative z-60">
  <input
    id="client-search"
    type="text"
    bind:this={inputEl}
    bind:value={searchQuery}
    onfocus={handleManagerSearchFocus}
    placeholder="담당자 이름을 검색해주세요"
    class="field-input w-full"
  />
  {#if isDropdownOpen}
    <div
      use:portal={{
        anchor: inputEl,
        offset: 8,
        callback: () => {
          searchQuery = ''
          isDropdownOpen = false
        }
      }}
      class="dropdown-panel max-h-none overflow-hidden fixed z-20000"
      transition:slide={{ duration: 300, easing: quintOut }}
    >
      {#if displayManagers.length > 0}
        <div class="flex flex-col">
          <div class="dropdown-list max-h-50 grow overflow-y-auto">
            {#each displayManagers as manager}
              <button
                type="button"
                onclick={(e) => {
                  e.preventDefault()
                  toggleManager(manager)
                }}
                class="dropdown-item"
              >
                <span>{manager.name}</span>
                <Checkbox
                  id={`manager-${manager.id}`}
                  checked={isSelected(manager.id)}
                  readonly
                />
              </button>
            {/each}
          </div>
          <div
            class="mt-1 flex min-h-15 shrink-0 items-end justify-between border-t border-gray-100 pt-3"
          >
            <div class="flex gap-1.5 items-center flex-wrap">
              {#each checkedSpecialists as manager}
                <SpecialistChip {manager} {toggleManager} />
              {/each}
            </div>
            <button
              class="dropdown-footer-apply"
              onclick={() => {
                searchQuery = ''
                isDropdownOpen = false
              }}
            >
              적용
            </button>
          </div>
        </div>
      {:else}
        <div class="flex flex-col items-center justify-center gap-1 p-8">
          <Typography variant="body-02-medium" color="text-gray-400">
            검색 결과가 없습니다
          </Typography>
          <Typography variant="body-03-normal-medium" color="text-gray-400">
            구성원 메뉴에서 초대를 마치면 담당자로 지정할 수 있어요
          </Typography>
        </div>
      {/if}
    </div>
  {/if}
</div>
