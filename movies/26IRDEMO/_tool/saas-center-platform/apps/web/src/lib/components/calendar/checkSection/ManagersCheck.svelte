<script lang="ts">
  import { onMount } from 'svelte'
  import { twMerge } from 'tailwind-merge'
  import { slide } from 'svelte/transition'

  import ColoredCheckbox from '../ColoredCheckbox.svelte'
  import Typography from '@common/components/Typography.svelte'
  import ChevronIcon from '$root/src/lib/assets/ChevronIcon.svelte'

  export let managerList: any[] = []
  export let managersChecked: boolean[] = []
  export let selectedManagerNames: (string | undefined)[] = []

  const colors: string[] = [
    '#E20808',
    '#F47500',
    '#FECB01',
    '#00A600',
    '#00B8D9',
    '#0478ED',
    '#C77DFF'
  ]

  let showExperts: boolean = true

  const toggleAllManagers = () => {
    const next = !allExpertsChecked
    managersChecked = managersChecked.map(() => next)
  }

  $: allExpertsChecked =
    managersChecked.length > 0 && managersChecked.every(Boolean)
  $: someExpertsChecked = managersChecked.some(Boolean) && !allExpertsChecked

  $: if (managersChecked) {
    let checkedManagersArr: string[] = []
    managersChecked.forEach((e, i) => {
      if (e && managerList[i]) {
        checkedManagersArr.push(managerList[i].name)
      }
    })
    selectedManagerNames = [...checkedManagersArr]
  }

  onMount(() => {
    managersChecked = Array(managerList.length).fill(true)
  })
</script>

<div class="truncate-safe">
  <div class="flex items-center justify-between">
    <Typography variant="title-02-semibold" color="text-gray-700">
      담당자
    </Typography>
    <div class="flex gap-2">
      <button
        on:click={() => (showExperts = !showExperts)}
        class="flex-center w-6 h-6"
      >
        <ChevronIcon
          class={twMerge(
            'w-1.5 h-3 stroke-gray-500 transition',
            showExperts ? 'rotate-90' : ' -rotate-90'
          )}
        />
      </button>
    </div>
  </div>
  {#if showExperts}
    <div
      transition:slide={{ duration: 75 }}
      class="mt-2 flex flex-col gap-3 min-h-30"
    >
      <ColoredCheckbox
        checked={allExpertsChecked}
        isIndeterminate={someExpertsChecked}
        on:change={toggleAllManagers}
      >
        <Typography variant="body-01-regular" color="text-gray-600">
          전체 선택
        </Typography>
      </ColoredCheckbox>
      {#each managerList as manager, index}
        <ColoredCheckbox
          bind:checked={managersChecked[index]}
          checkedBackgroundClass={'E208081A'}
          checkedClass={colors[index % colors.length]}
        >
          <Typography variant="body-01-regular" color="text-gray-600">
            {manager.name} 상담사
          </Typography>
        </ColoredCheckbox>
      {/each}
    </div>
  {/if}
</div>
