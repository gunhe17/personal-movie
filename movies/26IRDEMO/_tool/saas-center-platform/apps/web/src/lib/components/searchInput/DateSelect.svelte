<script lang="ts">
  import { fade } from 'svelte/transition'
  // 돋보기가 겹친 '일정 조회' 아이콘(CalendarIcon) 대신 Icon_20 세트의 순수 calendar
  import CalendarIcon20 from '$lib/assets/CalendarIcon20.svelte'
  import { portal } from '../../utils/positionPortal'
  import Calendar from '../Calendar.svelte'
  import { dateToString } from '../../utils/date'
  import { twMerge } from 'tailwind-merge'

  interface Props {
    selectedDate: Date | null
    className?: string
    onChangeDate?: (date: Date) => void
  }

  let {
    selectedDate = $bindable(),
    className = '',
    onChangeDate
  }: Props = $props()

  let triggerEl = $state<HTMLElement | null>(null)
  let isDateFilterOpen: boolean = $state(false)

  const toggleDateFilter = () => {
    isDateFilterOpen = !isDateFilterOpen
  }

  const handleDateSelect = (date: Date) => {
    selectedDate = date
    isDateFilterOpen = false
    onChangeDate && onChangeDate(date)
  }
</script>

<div>
  <button
    bind:this={triggerEl}
    onclick={toggleDateFilter}
    class={twMerge(
      'flex h-11 gap-x-11 items-center justify-between rounded-lg w-full border bg-white px-4 transition-colors',
      isDateFilterOpen
        ? 'border-primary-400'
        : selectedDate
          ? 'border-primary-500'
          : 'border-border-default hover:border-border-strong',
      className
    )}
  >
    <span
      class={twMerge(
        'text-body-02-normal-regular max-w-40 truncate-safe',
        selectedDate ? '' : 'text-gray-300'
      )}
    >
      {selectedDate ? dateToString(selectedDate, 'YYYY-MM-DD') : 'YYYY-MM-DD'}
    </span>
    <CalendarIcon20 />
  </button>
  <!-- 날짜 선택 드롭다운 -->
  {#if isDateFilterOpen}
    <div
      transition:fade={{ duration: 100 }}
      use:portal={{
        anchor: triggerEl,
        isFitWidth: false,
        callback: () => {
          isDateFilterOpen = false
        }
      }}
      class="z-20001"
    >
      <Calendar bind:selectedDate onDateSelect={handleDateSelect} />
    </div>
  {/if}
</div>
