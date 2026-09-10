<script lang="ts">
  import type { SelectOptionType } from '../../types/common'

  import Select from '../Select.svelte'
  import Typography from '@common/components/Typography.svelte'
  import ClientSearchDropdown from './ClientSearchDropdown.svelte'
  import ManagerSelectDropdown from './ManagerSelectDropdown.svelte'

  type GroupType = '그룹' | '짝'
  type ProgramType = 'individual' | 'multiple'

  interface Props {
    selectedTab: string
    selectedClients: any[]
    selectedSpecialists: any[]
  }

  let {
    selectedTab = $bindable(),
    selectedClients = $bindable(),
    selectedSpecialists = $bindable()
  }: Props = $props()

  const programTypes: SelectOptionType[] = [
    { title: '개별', value: 'individual' },
    { title: '집단', value: 'multiple' }
  ]
  let selectedGroupType = $state<GroupType>('그룹')

  const reservationRoleMap = {
    counsel: [
      { role: 'client', count: 1 },
      { role: 'specialist', count: 1 }
    ],
    assessment: [
      { role: 'client', count: 1 },
      { role: 'specialist', count: 1 }
    ],
    program: {
      individual: [
        { role: 'client', count: 1 },
        { role: 'specialist', count: 1 }
      ],
      multiple: {
        그룹: [
          { role: 'client', count: 'n' },
          { role: 'specialist', count: 1 }
        ],
        짝: [
          { role: 'client', count: 2 },
          { role: 'specialist', count: 2 }
        ]
      }
    }
  } as const

  let selectedProgramType = $state<ProgramType>('individual')

  const roles = $derived.by(() => {
    if (selectedTab === 'program') {
      if (selectedProgramType === 'individual') {
        return reservationRoleMap.program.individual
      }
      return reservationRoleMap.program.multiple[selectedGroupType]
    } else if (selectedTab === 'counsel') {
      return reservationRoleMap.counsel
    }
    return reservationRoleMap.assessment
  })

  const getRenderCount = (role: any, selected: any[]) => {
    if (role.count === 'n') {
      return Math.max(selected.length, 1)
    }
    return role.count
  }

  const resetSelections = () => {
    selectedClients = [null]
    selectedSpecialists = [null]
  }

  $effect(() => {
    if (selectedTab) {
      resetSelections()
    }
  })

  $effect(() => {
    if (selectedGroupType) {
      resetSelections()
    }
  })
</script>

{#if selectedTab === 'program'}
  <div class="space-y-3">
    <Typography variant="body-02-medium">프로그램 유형</Typography>
    <Select
      class="px-1"
      textClass="text-body-01-normal-regular! text-[16px]!"
      hoverBoxClass="w-full"
      bind:selected={selectedProgramType}
      on:change={(e) => (selectedProgramType = e.detail.value)}
      options={programTypes}
    />
    {#if selectedProgramType === 'multiple'}
      <div
        class="flex items-center gap-6 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3"
      >
        <label class="flex cursor-pointer items-center gap-2">
          <input
            type="radio"
            name="selectedGroupType"
            value="그룹"
            bind:group={selectedGroupType}
            class="h-4 w-4 text-primary-500"
          />
          <span class="text-body-01-normal-medium text-body-default">
            그룹 <span class="ml-1 text-xs text-gray-400">
              (선생님 1명 : 내담자 2명 이상)
            </span>
          </span>
        </label>
        <label class="flex cursor-pointer items-center gap-2">
          <input
            type="radio"
            name="selectedGroupType"
            value="짝"
            bind:group={selectedGroupType}
            class="h-4 w-4 text-primary-500"
          />
          <span class="text-body-01-normal-medium text-body-default">
            짝 <span class="ml-1 text-xs text-gray-400">
              (선생님 2명 : 내담자 2명)
            </span>
          </span>
        </label>
      </div>
    {/if}
  </div>
{/if}
{#each roles as role}
  {#if role.role === 'client'}
    <div class="space-y-2">
      <Typography variant="body-02-medium" color="text-gray-700">
        내담자
      </Typography>
      {#each Array(getRenderCount(role, selectedClients)) as _, i}
        <ClientSearchDropdown
          searchQuery={selectedClients[i]?.name ?? ''}
          selected={selectedClients[i]}
          onClientSelect={(v) => {
            selectedClients[i] = v
            selectedClients = [...selectedClients]
          }}
          onClientDelete={(v) => {
            if (!v) return
            const idx = selectedClients.findIndex((c) => c.id === v.id)
            selectedClients.splice(idx, 1)
          }}
        />
      {/each}
      {#if role.count === 'n'}
        <button
          class="text-[15px] mx-auto flex hover:scale-105 duration-200 items-center gap-2 text-gray-600"
          onclick={() => {
            selectedClients = [...selectedClients, null]
          }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle cx="12" cy="12" r="10" fill="#D7E5FD" />
            <path
              d="M7 12L17 12"
              stroke="#4C87F6"
              stroke-width="2"
              stroke-linecap="round"
            />
            <path
              d="M12 7L12 17"
              stroke="#4C87F6"
              stroke-width="2"
              stroke-linecap="round"
            />
          </svg>
          추가
        </button>
      {/if}
    </div>
  {/if}
  {#if role.role === 'specialist'}
    <div class="space-y-2">
      <Typography variant="body-02-medium" color="text-gray-700">
        담당자
      </Typography>
      {#each Array(getRenderCount(role, selectedSpecialists)) as _, i}
        <ManagerSelectDropdown
          specialist_name={selectedSpecialists[i]?.name ?? ''}
          onManagerSelect={(v) => {
            selectedSpecialists[i] = v
            selectedSpecialists = [...selectedSpecialists]
          }}
        />
      {/each}
    </div>
  {/if}
{/each}
