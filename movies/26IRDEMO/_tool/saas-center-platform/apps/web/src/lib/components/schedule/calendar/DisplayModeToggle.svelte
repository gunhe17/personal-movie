<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import {
    DISPLAY_MODES,
    type DisplayMode
  } from '$lib/features/schedule/calendar/constants'

  interface Props {
    selected: DisplayMode
    onchange: (mode: DisplayMode) => void
  }

  let { selected, onchange }: Props = $props()
</script>

<div
  class="flex items-center h-[40px] rounded-lg overflow-hidden border border-gray-200 bg-gray-50"
>
  {#each DISPLAY_MODES as mode}
    <button
      onclick={() => onchange(mode)}
      class="w-[90px] h-full flex items-center justify-center transition-colors duration-150 {selected ===
      mode
        ? 'bg-gray-600'
        : ''}"
    >
      <Typography
        variant="body-01-reading-regular"
        color={selected === mode ? 'text-white' : 'text-gray-500'}
      >
        {mode}
      </Typography>
    </button>
  {/each}
</div>
