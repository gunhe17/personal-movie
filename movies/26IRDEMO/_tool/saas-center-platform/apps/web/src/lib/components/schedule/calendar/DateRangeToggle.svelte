<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import {
    DATE_RANGE_MODES,
    type DateRangeMode
  } from '$lib/features/schedule/calendar/constants'

  interface Props {
    selected: DateRangeMode
    onchange: (mode: DateRangeMode) => void
  }

  let { selected, onchange }: Props = $props()

  const selectedIdx = $derived(DATE_RANGE_MODES.indexOf(selected))
</script>

<div class="relative flex items-center bg-gray-100 rounded-[12px] p-[5px]">
  <!-- 슬라이딩 활성 배경 -->
  <div
    class="absolute top-[5px] left-[5px] h-[35px] bg-white rounded-md shadow-sm transition-all duration-200 ease-out"
    style="width: calc((100% - 10px) / {DATE_RANGE_MODES.length}); transform: translateX({selectedIdx *
      100}%);"
  ></div>
  {#each DATE_RANGE_MODES as mode}
    <button
      onclick={() => onchange(mode)}
      class="relative z-10 flex-1 xl:flex-none xl:w-[80px] h-[35px] flex items-center justify-center"
    >
      <Typography
        variant="body-02-normal-regular"
        color={selected === mode ? 'text-gray-700' : 'text-gray-500'}
      >
        {mode}
      </Typography>
    </button>
  {/each}
</div>
