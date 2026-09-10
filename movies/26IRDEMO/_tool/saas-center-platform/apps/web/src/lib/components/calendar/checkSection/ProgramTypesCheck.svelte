<script lang="ts">
  import { onMount } from 'svelte'
  import { twMerge } from 'tailwind-merge'
  import { slide } from 'svelte/transition'

  import ColoredCheckbox from '../ColoredCheckbox.svelte'
  import Typography from '@common/components/Typography.svelte'
  import ChevronIcon from '$root/src/lib/assets/ChevronIcon.svelte'

  export let programList: any[] = []
  export let programsChecked: boolean[] = []
  export let selectedProgramNames: (string | undefined)[] = []

  let showPrograms: boolean = true

  const toggleAllPrograms = () => {
    const newChecked = !allProgramsCheck
    programsChecked = programsChecked.map(() => newChecked)
  }

  $: [allProgramsCheck, someProgramsChecked] = [
    programsChecked.every(Boolean),
    programsChecked.some(Boolean) && !programsChecked.every(Boolean)
  ]

  $: if (programsChecked) {
    let checkedRoomArr: string[] = []
    programsChecked.forEach((r, i) => {
      if (r && programList[i]) {
        checkedRoomArr.push(programList[i].title)
      }
    })
    selectedProgramNames = [...checkedRoomArr]
  }

  onMount(() => {
    programsChecked = Array(programList.length).fill(true)
  })
</script>

<div class="mt-4 truncate-safe">
  <div class="flex items-center justify-between">
    <Typography variant="title-02-semibold" color="text-gray-700">
      유형
    </Typography>
    <button
      on:click={() => (showPrograms = !showPrograms)}
      class="flex-center w-6 h-6"
    >
      <ChevronIcon
        class={twMerge(
          'w-1.5 h-3 stroke-gray-500 transition',
          showPrograms ? ' rotate-90' : ' -rotate-90'
        )}
      />
    </button>
  </div>
  {#if showPrograms}
    <div
      transition:slide={{ duration: 75 }}
      class="mt-2 flex flex-col gap-3 min-h-30"
    >
      <ColoredCheckbox
        checked={allProgramsCheck}
        isIndeterminate={someProgramsChecked}
        on:change={toggleAllPrograms}
      >
        <Typography variant="body-01-regular" color="text-gray-600">
          전체 선택
        </Typography>
      </ColoredCheckbox>
      {#each programList as program, index}
        <ColoredCheckbox bind:checked={programsChecked[index]}>
          <Typography variant="title-02-reading" color="text-gray-700">
            {program.title}
          </Typography>
        </ColoredCheckbox>
      {/each}
    </div>
  {/if}
</div>
