<script lang="ts">
  import { fade } from 'svelte/transition'
  import CalendarIcon from '../assets/CalendarIcon.svelte'
  import { portal } from '../utils/positionPortal'
  import Calendar from './Calendar.svelte'
  import { dateToString } from '../utils/date'

  interface Props {
    value: string
    placeholder?: string
    disabled?: boolean
    class?: string
  }

  let {
    value = $bindable(),
    placeholder = 'YYYY-MM-DD',
    disabled = false,
    class: className = ''
  }: Props = $props()

  let triggerEl = $state<HTMLElement | null>(null)
  let isOpen = $state(false)

  // string -> Date 변환 (Calendar용)
  const parseDate = (dateStr: string): Date | null => {
    if (!dateStr) return null
    const parsed = new Date(dateStr)
    return isNaN(parsed.getTime()) ? null : parsed
  }

  let selectedDate = $derived<Date | null>(parseDate(value))

  const toggleOpen = () => {
    if (!disabled) {
      isOpen = !isOpen
    }
  }

  const handleDateSelect = (date: Date) => {
    value = dateToString(date, 'YYYY-MM-DD')
    isOpen = false
  }
</script>

<div class="relative {className}">
  <button
    type="button"
    bind:this={triggerEl}
    onclick={toggleOpen}
    {disabled}
    class="flex h-12 w-full items-center justify-between rounded-lg border bg-white px-3 transition-colors text-body-02-normal-regular
      {isOpen
      ? 'border-border-active'
      : 'border-gray-200 hover:border-gray-300'}
      {disabled
      ? 'bg-gray-100 cursor-not-allowed text-gray-400'
      : 'cursor-pointer'}"
  >
    <span class={value ? 'text-gray-900' : 'text-gray-400'}>
      {value || placeholder}
    </span>
    <CalendarIcon />
  </button>

  {#if isOpen}
    <div
      transition:fade={{ duration: 100 }}
      use:portal={{
        anchor: triggerEl,
        isFitWidth: false,
        callback: () => {
          isOpen = false
        }
      }}
      class="z-20001"
    >
      <Calendar {selectedDate} onDateSelect={handleDateSelect} />
    </div>
  {/if}
</div>
