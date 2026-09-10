<script lang="ts">
  import { onMount } from 'svelte'
  import { dateToString } from '../../utils/date'
  import Typography from '@common/components/Typography.svelte'

  interface Props {
    /** 타임라인 시작 시(hour). 기본 7. */
    startHour?: number
    /** 표시되는 총 시간 칸 수(행 수). timeSlots 렌더 수와 맞춰야 마커 위치가 정확함. 기본 18(7~24) */
    totalRows?: number
  }

  let { startHour = 7, totalRows = 17 }: Props = $props()

  let now = $state(new Date())
  let topPercent = $state(0)

  const updateTop = () => {
    now = new Date()
    const hours = now.getHours()
    const minutes = now.getMinutes()
    const elapsed = hours + minutes / 60 - startHour
    const percent = (elapsed / totalRows) * 100
    topPercent = Math.max(0, percent)
  }

  onMount(() => {
    updateTop()
    const intervalId = setInterval(updateTop, 60 * 1000)
    return () => clearInterval(intervalId)
  })
</script>

<div
  class="absolute w-full flex items-center"
  style="top: {topPercent}%; transform: translateY(-50%);"
>
  <div class="w-[80px] shrink-0 flex-center">
    <span class="flex-center h-7.5 px-2 rounded-full bg-[#FDECEF]">
      <Typography variant="body-02-normal-regular" color="text-[#EF4967]">
        {dateToString(now, 'HH:mm')}
      </Typography>
    </span>
  </div>
  <!-- svelte-ignore element_invalid_self_closing_tag -->
  <div class="h-0.5 flex-1 bg-[#EF4967]" />
</div>
