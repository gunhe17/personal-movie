<script lang="ts">
  import { fade } from 'svelte/transition'
  import CalendarIcon from '$lib/assets/CalendarIcon.svelte'
  import { portal } from '$lib/utils/positionPortal'
  import Calendar from '$lib/components/Calendar.svelte'
  import { dateToString } from '$lib/utils/date'
  import { twMerge } from 'tailwind-merge'

  // 날짜+시간 결합 피커 — 클릭 시 팝오버에 [캘린더 | 시 드롭다운 : 분 드롭다운].
  // value = "YYYY-MM-DD HH:MM".
  interface Props {
    value: string
    placeholder?: string
    className?: string
    onChange?: (v: string) => void
  }

  let {
    value = $bindable(),
    placeholder = 'YYYY-MM-DD 00:00',
    className = '',
    onChange
  }: Props = $props()

  const hourOptions = Array.from({ length: 24 }, (_, i) =>
    String(i).padStart(2, '0')
  )
  const minuteOptions = ['00', '15', '30', '45'] // 드롭다운 프리셋 (직접 입력은 1분 단위)

  let triggerEl = $state<HTMLElement | null>(null)
  let open = $state(false)

  const parseDate = (v: string): Date | null => {
    const part = (v ?? '').split(' ')[0]
    if (!part) return null
    const d = new Date(part)
    return isNaN(d.getTime()) ? null : d
  }
  const timePart = (value ?? '').split(' ')[1] ?? ''

  let selectedDate = $state<Date | null>(parseDate(value))
  let hour = $state<string>(timePart.split(':')[0] ?? '')
  let minute = $state<string>(timePart.split(':')[1] ?? '')
  let hourOpen = $state(false)
  let minuteOpen = $state(false)

  function commit() {
    const dateStr = selectedDate ? dateToString(selectedDate, 'YYYY-MM-DD') : ''
    const timeStr =
      hour || minute
        ? `${(hour || '00').padStart(2, '0')}:${(minute || '00').padStart(2, '0')}`
        : ''
    value = [dateStr, timeStr].filter(Boolean).join(' ')
    onChange?.(value)
  }
  const onDate = (d: Date) => {
    selectedDate = d
    commit()
  } // 날짜 골라도 팝오버 유지
  // 시 = 콤보박스 — 드롭다운 프리셋 or 직접 입력(숫자만·2자리·0~23 클램프)
  const pickHour = (h: string) => {
    hour = h
    hourOpen = false
    commit()
  }
  function onHourInput(e: Event & { currentTarget: HTMLInputElement }) {
    hour = e.currentTarget.value.replace(/\D/g, '').slice(0, 2)
    commit()
  }
  function onHourBlur() {
    if (hour !== '')
      hour = String(Math.min(23, parseInt(hour, 10) || 0)).padStart(2, '0')
    commit()
  }
  // 분 = 콤보박스 — 드롭다운 프리셋 or 직접 입력(1분 단위·숫자만·2자리·0~59 클램프)
  const pickMinute = (m: string) => {
    minute = m
    minuteOpen = false
    commit()
  }
  function onMinuteInput(e: Event & { currentTarget: HTMLInputElement }) {
    minute = e.currentTarget.value.replace(/\D/g, '').slice(0, 2)
    commit()
  }
  function onMinuteBlur() {
    if (minute !== '')
      minute = String(Math.min(59, parseInt(minute, 10) || 0)).padStart(2, '0')
    commit()
  }
</script>

<svelte:window
  onclick={() => {
    hourOpen = false
    minuteOpen = false
  }}
/>

<div>
  <button
    bind:this={triggerEl}
    type="button"
    onclick={() => (open = !open)}
    class={twMerge(
      'flex h-11 items-center justify-between gap-2 rounded-lg w-full border bg-white px-4 transition-colors',
      open ? 'border-border-active' : 'border-gray-200 hover:bg-gray-50',
      className
    )}
  >
    <span
      class={twMerge(
        'text-body-02-normal-regular truncate-safe',
        value ? 'text-gray-800' : 'text-gray-300'
      )}
    >
      {value || placeholder}
    </span>
    <CalendarIcon />
  </button>

  {#if open}
    <div
      transition:fade={{ duration: 100 }}
      use:portal={{
        anchor: triggerEl,
        isFitWidth: false,
        callback: () => (open = false)
      }}
      class="z-20001"
    >
      <div
        class="flex items-stretch rounded-lg border border-gray-200 bg-white shadow-lg"
      >
        <Calendar
          bind:selectedDate
          onDateSelect={onDate}
          class="border-0! rounded-none! shadow-none!"
        />
        <div
          class="flex flex-col gap-2 border-l border-gray-200 p-4 min-w-[210px]"
        >
          <p class="text-label-02-normal-medium text-gray-500">시간</p>
          <!-- 시 : 분 각 드롭다운 (팝오버 DOM 내부 — portal X) -->
          <div class="flex items-center gap-2">
            <!-- 시 = 콤보박스: 직접 입력 + 프리셋 드롭다운 -->
            <div class="relative flex-1 min-w-0">
              <div
                class="flex items-center rounded-lg border bg-white transition-colors {hourOpen
                  ? 'border-border-active'
                  : 'border-gray-200'}"
              >
                <input
                  type="text"
                  inputmode="numeric"
                  placeholder="시"
                  value={hour}
                  oninput={onHourInput}
                  onblur={onHourBlur}
                  onfocus={() => {
                    hourOpen = true
                    minuteOpen = false
                  }}
                  onclick={(e) => {
                    e.stopPropagation()
                    hourOpen = true
                    minuteOpen = false
                  }}
                  class="w-full min-w-0 bg-transparent py-2.5 pl-3 text-left text-body-02-normal-regular text-gray-800 outline-none placeholder:text-placeholder"
                />
                <button
                  type="button"
                  tabindex="-1"
                  aria-label="시 선택"
                  onclick={(e) => {
                    e.stopPropagation()
                    hourOpen = !hourOpen
                    minuteOpen = false
                  }}
                  class="shrink-0 px-2 text-gray-400 hover:text-gray-600"
                >
                  <svg
                    class="h-4 w-4 duration-200 {hourOpen ? 'rotate-180' : ''}"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    ><path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M19 9l-7 7-7-7"
                    /></svg
                  >
                </button>
              </div>
              {#if hourOpen}
                <div
                  class="dropdown-panel scrollbar-none absolute top-full right-0 left-0 z-30 mt-1 max-h-52 overflow-y-auto"
                >
                  {#each hourOptions as h (h)}
                    <button
                      type="button"
                      onmousedown={(e) => {
                        e.preventDefault()
                        pickHour(h)
                      }}
                      class="dropdown-item {h === hour ? 'is-selected' : ''}"
                      >{h}</button
                    >
                  {/each}
                </div>
              {/if}
            </div>
            <span class="text-gray-400 shrink-0">:</span>
            <!-- 분 = 콤보박스: 직접 입력 + 프리셋 드롭다운 -->
            <div class="relative flex-1 min-w-0">
              <div
                class="flex items-center rounded-lg border bg-white transition-colors {minuteOpen
                  ? 'border-border-active'
                  : 'border-gray-200'}"
              >
                <input
                  type="text"
                  inputmode="numeric"
                  placeholder="분"
                  value={minute}
                  oninput={onMinuteInput}
                  onblur={onMinuteBlur}
                  onfocus={() => {
                    minuteOpen = true
                    hourOpen = false
                  }}
                  onclick={(e) => {
                    e.stopPropagation()
                    minuteOpen = true
                    hourOpen = false
                  }}
                  class="w-full min-w-0 bg-transparent py-2.5 pl-3 text-left text-body-02-normal-regular text-gray-800 outline-none placeholder:text-placeholder"
                />
                <button
                  type="button"
                  tabindex="-1"
                  aria-label="분 선택"
                  onclick={(e) => {
                    e.stopPropagation()
                    minuteOpen = !minuteOpen
                    hourOpen = false
                  }}
                  class="shrink-0 px-2 text-gray-400 hover:text-gray-600"
                >
                  <svg
                    class="h-4 w-4 duration-200 {minuteOpen
                      ? 'rotate-180'
                      : ''}"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    ><path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M19 9l-7 7-7-7"
                    /></svg
                  >
                </button>
              </div>
              {#if minuteOpen}
                <div
                  class="dropdown-panel scrollbar-none absolute top-full right-0 left-0 z-30 mt-1 max-h-52 overflow-y-auto"
                >
                  {#each minuteOptions as m (m)}
                    <button
                      type="button"
                      onmousedown={(e) => {
                        e.preventDefault()
                        pickMinute(m)
                      }}
                      class="dropdown-item {m === minute ? 'is-selected' : ''}"
                      >{m}</button
                    >
                  {/each}
                </div>
              {/if}
            </div>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>
