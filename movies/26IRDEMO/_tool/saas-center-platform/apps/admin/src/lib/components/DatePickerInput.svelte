<script lang="ts">
  import { fade } from 'svelte/transition'
  import CalendarIcon from '$lib/assets/CalendarIcon.svelte'
  import { portal } from '$lib/utils/positionPortal'
  import Calendar from './Calendar.svelte'

  interface Props {
    value: string
    placeholder?: string
    disabled?: boolean
    showActiveHighlight?: boolean
    class?: string
  }

  let {
    value = $bindable(),
    placeholder = 'YYYY-MM-DD',
    disabled = false,
    showActiveHighlight = false,
    class: className = ''
  }: Props = $props()

  const isActive = $derived(showActiveHighlight && !!value)

  let triggerEl = $state<HTMLElement | null>(null)
  let isOpen = $state(false)

  const parseDate = (dateStr: string): Date | null => {
    if (!dateStr) return null
    const parsed = new Date(dateStr)
    return isNaN(parsed.getTime()) ? null : parsed
  }

  let selectedDate = $derived<Date | null>(parseDate(value))

  const toggleOpen = () => {
    if (!disabled) isOpen = !isOpen
  }

  const handleDateSelect = (date: Date) => {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    value = `${y}-${m}-${d}`
    isOpen = false
  }
</script>

<div class="relative {className}">
  <button
    type="button"
    bind:this={triggerEl}
    onclick={toggleOpen}
    {disabled}
    class="flex h-11 w-full items-center justify-between rounded-lg border bg-white px-3 text-sm transition-colors
      {isOpen ? 'border-primary-500 ring-1 ring-primary-500' : isActive ? 'border-primary-400 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}
      {disabled ? 'cursor-not-allowed bg-gray-100 text-gray-400' : 'cursor-pointer'}"
  >
    <span class={value ? 'text-gray-700' : 'text-gray-400'}>
      {value || placeholder}
    </span>
    <CalendarIcon class={isOpen || isActive ? 'text-primary-500' : 'text-gray-400'} />
  </button>

  {#if isOpen}
    <div
      transition:fade={{ duration: 100 }}
      use:portal={{
        anchor: triggerEl!,
        isFitWidth: false,
        callback: () => { isOpen = false }
      }}
      class="z-20001"
    >
      <Calendar {selectedDate} onDateSelect={handleDateSelect} />
    </div>
  {/if}
</div>
