<style>
  /* 스크롤바 숨김 */
  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }
  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }

  /* 마감 상태 빗금 패턴 */
  .bg-striped {
    background: repeating-linear-gradient(
      45deg,
      #000,
      #000 2px,
      transparent 2px,
      transparent 8px
    );
  }
</style>

<script lang="ts">
  import { snackbarStore } from '../stores/snackbar'

  export interface TimeSlot {
    time: string
    status: 'available' | 'closed'
  }

  interface Props {
    selectedTimes?: string[]
  }

  let { selectedTimes = $bindable([]) }: Props = $props()

  const timeSlots: TimeSlot[] = [
    { time: '09:00', status: 'closed' },
    { time: '10:00', status: 'closed' },
    { time: '11:00', status: 'available' },
    { time: '12:00', status: 'available' },
    { time: '13:00', status: 'available' },
    { time: '14:00', status: 'available' },
    { time: '15:00', status: 'available' },
    { time: '16:00', status: 'available' },
    { time: '17:00', status: 'available' },
    { time: '18:00', status: 'available' },
    { time: '19:00', status: 'available' }
  ]

  // 마지막으로 선택한 시간의 인덱스 추적
  let lastSelectedIndex: number | null = $state(null)

  const handleTimeSelect = (slot: TimeSlot) => {
    if (slot.status === 'closed') return
    const currentIndex = timeSlots.findIndex((s) => s.time === slot.time)
    const currentTime = timeSlots[currentIndex].time
    const prevFirst = selectedTimes[0]
    const prevLast = selectedTimes[selectedTimes.length - 1]
    let newTimeRange: string[] = []
    if (!selectedTimes.length || selectedTimes.length > 1) {
      newTimeRange.push(currentTime)
    } else if (prevFirst > currentTime) {
      timeSlots.forEach((t) => {
        if (t.time < currentTime) {
          return
        } else if (t.time >= currentTime && t.time <= prevLast) {
          if (t.status === 'closed') {
            snackbarStore.error('범위 내에 선택 불가능한 시간이 있습니다')
            return (newTimeRange = [])
          }
          return newTimeRange.push(t.time)
        } else if (t.time >= prevLast) {
          return
        }
      })
    } else {
      timeSlots.forEach((t) => {
        if (t.time < prevFirst) {
          return
        } else if (t.time >= prevFirst && t.time <= currentTime) {
          if (t.status === 'closed') {
            snackbarStore.error('범위 내에 선택 불가능한 시간이 있습니다')
            return (newTimeRange = [])
          }
          return newTimeRange.push(t.time)
        } else if (t.time >= currentTime) {
          return
        }
      })
    }
    selectedTimes = newTimeRange
    lastSelectedIndex = currentIndex
  }
</script>

<div class=" bg-white">
  <!-- 시간 슬롯 가로 스크롤 영역 -->
  <div
    class="scrollbar-hide mb-3 snap-x snap-mandatory overflow-x-scroll"
    onwheel={(e) => {
      e.preventDefault()
      e.currentTarget.scrollLeft += e.deltaY
    }}
  >
    <div class="relative min-w-max snap-start pl-6">
      <!-- 시간 텍스트 (상단) - 경계선 위에 배치 -->
      <div class="relative mb-1 flex pl-8" style="height: 20px;">
        {#each timeSlots as slot, index}
          <div
            class="absolute text-sm font-medium text-gray-700"
            style="left: {index * 64}px; transform: translateX(-50%);"
          >
            {slot.time}
          </div>
        {/each}
      </div>

      <!-- 상태 블록 (하단) -->
      <div class="flex">
        {#each timeSlots as slot}
          <button
            onclick={() => handleTimeSelect(slot)}
            disabled={slot.status === 'closed'}
            class="relative h-th w-16 shrink-0 overflow-hidden border border-r-0 transition-all last:border-r hover:border-r
							{selectedTimes.includes(slot.time)
              ? 'border-y-transparent border-x-white bg-primary-500'
              : slot.status === 'closed'
                ? 'cursor-not-allowed border-gray-200 bg-gray-50'
                : 'border-gray-200 hover:border-blue-300'}"
          >
            {#if slot.status === 'closed'}
              <div class="bg-striped absolute inset-0 opacity-20"></div>
            {/if}
          </button>
        {/each}
      </div>
    </div>
  </div>

  <!-- 범례 -->
  <div class="mt-3 flex items-center justify-end gap-4">
    <div class="flex items-center gap-2">
      <div class="h-4 w-4 rounded bg-primary-500"></div>
      <span class="text-xs text-gray-600">선택</span>
    </div>
    <div class="flex items-center gap-2">
      <div class="h-4 w-4 rounded border-2 border-gray-200"></div>
      <span class="text-xs text-gray-600">미선택</span>
    </div>
    <div class="flex items-center gap-2">
      <div
        class="relative h-4 w-4 overflow-hidden rounded border-2 border-gray-200 bg-gray-50"
      >
        <div class="bg-striped absolute inset-0 opacity-20"></div>
      </div>
      <span class="text-xs text-gray-600">마감</span>
    </div>
  </div>
</div>
