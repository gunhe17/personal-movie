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
  import { quintOut } from 'svelte/easing'
  import { slide } from 'svelte/transition'

  import { queryBuilder } from '../../hooks/queries/builder'
  import { getProgramList } from '../../hooks/actions/program.action'

  import { portal } from '../../utils/positionPortal'
  import Typography from '@common/components/Typography.svelte'

  interface Props {
    selectedProgram: string
    onProgramSelect: (program: any) => void
  }

  let { selectedProgram = $bindable(), onProgramSelect }: Props = $props()

  let triggerEl = $state<HTMLElement | null>(null)
  let dropdownEl = $state<HTMLElement | null>(null)
  let programs = $state<any[]>([])
  let isDropdownOpen = $state<boolean>(false)

  const programList = $derived(
    queryBuilder(getProgramList, () => ({
      center_id: '46d1573e-dfca-4fb1-adff-ba1f4cecc947'
    }))
  )

  const toggle = () => {
    isDropdownOpen = !isDropdownOpen
  }

  const onSelect = (program: any) => {
    onProgramSelect(program)
    isDropdownOpen = false
  }

  const handleBlur = (e: FocusEvent) => {
    const next = e.relatedTarget as HTMLElement | null
    if (dropdownEl && next && dropdownEl.contains(next)) return
    isDropdownOpen = false
  }

  $effect(() => {
    if (programList && programList.isSuccess) {
      programs = programList.data?.items ?? []
    }
  })
</script>

<div class="relative">
  <button
    type="button"
    bind:this={triggerEl}
    onclick={toggle}
    onblur={handleBlur}
    class={twMerge(
      'dropdown-trigger w-full',
      isDropdownOpen && 'is-open',
      !selectedProgram && 'is-placeholder'
    )}
  >
    <span class="dropdown-trigger-label">
      {selectedProgram ? selectedProgram : '진행할 프로그램을 선택해주세요'}
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
      {#if programs.length > 0}
        <div class="dropdown-list max-h-70 overflow-y-auto">
          {#each programs as program}
            <button
              type="button"
              onmousedown={() => onSelect(program)}
              class={`dropdown-item ${selectedProgram === program.name ? 'is-selected' : ''}`}
            >
              <span>{program.name}</span>
            </button>
          {/each}
        </div>
      {:else}
        <div class="p-6 text-center select-none">
          <Typography variant="body-02-medium" color="text-gray-400">
            선택할 항목이 없습니다
          </Typography>
        </div>
      {/if}
    </div>
  {/if}
</div>
