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

  import { portal } from '../../utils/positionPortal'

  import Typography from '@common/components/Typography.svelte'
  import { twMerge } from 'tailwind-merge'
  import SpecialistChip from '../chip/SpecialistChip.svelte'
  import Checkbox from '../Checkbox.svelte'
  import { getAllGuardiansWithRelations } from '../../mocks/clientMockStore'

  interface Props {
    searchQuery: string
    className?: string
    checkedGuardians: any[]
    onChange?: (next: any[]) => void
  }

  let {
    searchQuery,
    className = '',
    checkedGuardians = $bindable(),
    onChange
  }: Props = $props()

  let allGuardians = $state<any[]>(getAllGuardiansWithRelations())
  let isDropdownOpen = $state<boolean>(false)
  let inputEl = $state<HTMLInputElement | null>(null)
  let selectedGuardians = $derived.by(() => {
    return [...checkedGuardians]
  })
  const mappedGuardianInfo = $derived(
    allGuardians.map((m) => {
      return {
        ...m.guardian,
        relation: m.relations[0].relation
      }
    })
  )

  let displayGuardians = $derived.by(() => {
    const q = searchQuery.toLowerCase()
    return mappedGuardianInfo.filter((m) => m.name.toLowerCase().includes(q))
  })

  const toggleGuardian = (guardian: any) => {
    const exists = selectedGuardians.some((m) => m.id === guardian.id)
    selectedGuardians = exists
      ? selectedGuardians.filter((m) => m.id !== guardian.id)
      : [...selectedGuardians, guardian]
  }

  const isSelected = (id: string) => selectedGuardians.some((m) => m.id === id)

  const handleGuardianSearchFocus = () => {
    isDropdownOpen = true
  }
</script>

<div class="relative z-60">
  <input
    id="client-search"
    type="text"
    bind:this={inputEl}
    bind:value={searchQuery}
    onfocus={handleGuardianSearchFocus}
    placeholder="보호자의 이름을 검색해주세요"
    class={twMerge(
      className,
      'field-input',
      'px-3 focus:border-border-active focus:outline-none'
    )}
  />
  {#if isDropdownOpen}
    <div
      use:portal={{
        anchor: inputEl,
        offset: 8,
        callback: () => {
          isDropdownOpen = false
        }
      }}
      class="dropdown-panel max-h-none overflow-hidden fixed z-20000"
      transition:slide={{ duration: 300, easing: quintOut }}
    >
      {#if displayGuardians.length > 0}
        <div class="flex flex-col">
          <div class="dropdown-list max-h-50 grow overflow-y-auto">
            {#each displayGuardians as guardian}
              <button
                type="button"
                onclick={(e) => {
                  e.preventDefault()
                  toggleGuardian(guardian)
                }}
                class="dropdown-item"
              >
                <span>{guardian.name}</span>
                <Checkbox
                  id={`guardian-${guardian.id}`}
                  checked={isSelected(guardian.id)}
                  readonly
                />
              </button>
            {/each}
          </div>
          <div
            class="mt-1 flex min-h-15 shrink-0 items-end justify-between border-t border-gray-100 pt-3"
          >
            <div class="flex gap-1.5 items-center flex-wrap">
              {#each selectedGuardians as guardian}
                <SpecialistChip
                  manager={guardian}
                  toggleManager={toggleGuardian}
                />
              {/each}
            </div>
            <button
              type="button"
              class="dropdown-footer-apply"
              disabled={selectedGuardians.length === 0}
              onclick={() => {
                searchQuery = ''
                checkedGuardians = [...selectedGuardians]
                onChange?.([...selectedGuardians])
                isDropdownOpen = false
              }}
            >
              적용
            </button>
          </div>
        </div>
      {:else}
        <div class="flex items-center justify-center p-8">
          <Typography variant="body-02-medium" color="text-gray-400">
            검색 결과가 없습니다
          </Typography>
        </div>
      {/if}
    </div>
  {/if}
</div>
