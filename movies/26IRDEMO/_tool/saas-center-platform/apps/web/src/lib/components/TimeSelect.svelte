<script lang="ts">
  import ArrowDownIcon20 from '$lib/assets/ArrowDownIcon20.svelte'
  import { tick } from 'svelte'
  import { fade } from 'svelte/transition'
  import { portal } from '../utils/positionPortal'
  import { twMerge } from 'tailwind-merge'

  type Props = {
    value?: string
    minTime?: string
    defaultHour?: number
    onChange?: (v: string) => void
  }

  let {
    value = $bindable(),
    minTime,
    defaultHour,
    onChange = () => {}
  }: Props = $props()

  let open = $state<boolean>(false)
  let triggerEl = $state<HTMLElement | null>(null)
  let hourListEl = $state<HTMLDivElement | null>(null)
  let directInputEl = $state<HTMLInputElement | null>(null)

  const allHours = Array.from({ length: 24 }, (_, i) =>
    String(i).padStart(2, '0')
  )

  // 5분 단위 분 목록
  const allMinutes5 = Array.from({ length: 12 }, (_, i) =>
    String(i * 5).padStart(2, '0')
  )

  /** string → 내부 state */
  const parse = (val: string) => {
    const [hStr = '0', mStr = '0'] = val.split(':')
    return {
      hour: String(Number(hStr)).padStart(2, '0'),
      minute: String(Number(mStr)).padStart(2, '0')
    }
  }

  const parsed = value ? parse(value) : { hour: '00', minute: '00' }

  let { hour, minute } = $state(parsed)

  // 직접 입력 모드
  let directInputValue = $state('')
  let directInputError = $state('')

  const minH = $derived(minTime ? Number(minTime.split(':')[0]) : 0)
  const minM = $derived(minTime ? Number(minTime.split(':')[1]) : 0)

  const hours = $derived(allHours.filter((h) => Number(h) >= minH))
  const minutes = $derived(
    Number(hour) === minH
      ? allMinutes5.filter((m) => Number(m) > minM)
      : allMinutes5
  )

  /** 내부 → string */
  const build = () => `${hour}:${minute}`

  const update = () => {
    value = build()
    onChange(value)
  }

  const select = (type: 'hour' | 'minute', val: string) => {
    if (type === 'hour') hour = val
    if (type === 'minute') minute = val
    update()
  }

  /** 표시 텍스트 (오전/오후 포함) */
  const display = $derived.by(() => {
    const h = Number(hour)
    const period = h < 12 ? '오전' : '오후'
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
    return `${period} ${h12}:${minute}`
  })

  /** 외부 value 변경 sync */
  $effect(() => {
    if (!value) return
    const p = parse(value)
    hour = p.hour
    minute = p.minute
  })

  /** 드롭다운 열릴 때 defaultHour 또는 현재 선택 시간 위치로 스크롤 */
  $effect(() => {
    if (!open || !hourListEl) return
    const targetHour =
      defaultHour !== undefined ? String(defaultHour).padStart(2, '0') : hour
    const targetEl = hourListEl.querySelector(
      `[data-hour="${targetHour}"]`
    ) as HTMLElement | null
    if (targetEl) {
      targetEl.scrollIntoView({ block: 'center' })
    }
  })

  /** 드롭다운 열릴 때 직접 입력 필드 초기화 */
  $effect(() => {
    if (open) {
      directInputValue = ''
      directInputError = ''
    }
  })

  /** minTime 변경 시 현재값 보정 */
  $effect(() => {
    if (!minTime) return
    const curTotal = Number(hour) * 60 + Number(minute)
    const minTotal = minH * 60 + minM + 1
    if (curTotal < minTotal) {
      hour = String(Math.floor(minTotal / 60)).padStart(2, '0')
      minute = String(minTotal % 60).padStart(2, '0')
      update()
    }
  })

  /** 직접 입력 처리 */
  function handleDirectInput() {
    directInputError = ''
    const raw = directInputValue.trim()
    if (!raw) return

    // HH:MM 또는 HHMM 형식
    const match = raw.match(/^(\d{1,2}):?(\d{2})$/)
    if (!match) {
      directInputError = 'HH:MM 형식으로 입력해주세요'
      return
    }

    const h = Number(match[1])
    const m = Number(match[2])

    if (h < 0 || h > 23 || m < 0 || m > 59) {
      directInputError = '올바른 시간을 입력해주세요'
      return
    }

    // minTime 검증
    if (minTime) {
      const inputTotal = h * 60 + m
      const minTotal = minH * 60 + minM + 1
      if (inputTotal < minTotal) {
        directInputError = `${minTime} 이후 시간을 입력해주세요`
        return
      }
    }

    hour = String(h).padStart(2, '0')
    minute = String(m).padStart(2, '0')
    update()
    open = false
  }

  function handleDirectInputKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleDirectInput()
    }
  }

  async function focusDirectInput() {
    await tick()
    directInputEl?.focus()
  }
</script>

<div class="relative">
  <!-- input -->
  <button
    bind:this={triggerEl}
    class={twMerge('dropdown-trigger w-full', open && 'is-open')}
    onclick={() => (open = !open)}
  >
    <span class="dropdown-trigger-label">{display}</span>
    <ArrowDownIcon20
      class={twMerge(
        'pointer-events-none shrink-0 duration-300',
        open && 'rotate-180'
      )}
    />
  </button>

  <!-- dropdown -->
  {#if open}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
      transition:fade={{ duration: 100 }}
      use:portal={{
        anchor: triggerEl,
        isFitWidth: false,
        callback: () => {
          open = false
        }
      }}
      class="dropdown-panel max-h-none overflow-hidden z-20001 w-60"
    >
      <!-- 직접 입력 -->
      <div class="shrink-0 border-b border-gray-100 pb-2">
        <div class="flex items-center gap-2">
          <input
            bind:this={directInputEl}
            bind:value={directInputValue}
            onkeydown={handleDirectInputKeydown}
            type="text"
            inputmode="numeric"
            placeholder="직접 입력 (예: 09:43)"
            class="h-8 flex-1 rounded-lg border border-gray-200 px-2.5 text-sm text-gray-800 placeholder:text-placeholder focus:border-border-active focus:outline-none"
          />
          <button
            onclick={handleDirectInput}
            class="h-8 shrink-0 rounded-lg bg-gray-100 px-2.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-200"
          >
            확인
          </button>
        </div>
        {#if directInputError}
          <div class="mt-1 field-help is-error">{directInputError}</div>
        {/if}
      </div>

      <!-- 빠른 선택 -->
      <div class="shrink-0 border-b border-gray-100 pb-2">
        <div class="flex flex-wrap gap-1">
          {#each [{ label: '09:00', h: '09', m: '00' }, { label: '10:00', h: '10', m: '00' }, { label: '13:00', h: '13', m: '00' }, { label: '14:00', h: '14', m: '00' }, { label: '15:00', h: '15', m: '00' }] as preset}
            <button
              type="button"
              class="rounded-md px-2 py-0.5 text-xs transition-colors {hour ===
                preset.h && minute === preset.m
                ? 'bg-blue-500 text-white'
                : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}"
              onclick={() => {
                hour = preset.h
                minute = preset.m
                update()
                open = false
              }}
            >
              {preset.label}
            </button>
          {/each}
        </div>
      </div>

      <!-- hour / minute 선택 -->
      <div class="grid grid-cols-2 gap-2">
        <!-- hour -->
        <div
          bind:this={hourListEl}
          class="dropdown-list h-52 overflow-y-auto pr-1"
        >
          {#each hours as h}
            {@const hNum = Number(h)}
            {#if hNum === 0}
              <div
                class="px-2 pt-1 pb-0.5 text-body-03-normal-medium text-gray-400 select-none"
              >
                오전
              </div>
            {/if}
            {#if hNum === 12}
              <div
                class="px-2 pt-2 pb-0.5 text-body-03-normal-medium text-gray-400 select-none border-t border-gray-100"
              >
                오후
              </div>
            {/if}
            <div
              data-hour={h}
              class="dropdown-item justify-center {h === hour
                ? 'is-selected'
                : ''}"
              onclick={() => select('hour', h)}
            >
              {h}
              <span
                class="ml-1 text-body-03-normal-regular {h === hour
                  ? 'text-primary-400'
                  : 'text-gray-300'}"
              >
                {hNum < 12 ? '오전' : hNum === 12 ? '정오' : '오후'}
              </span>
            </div>
          {/each}
        </div>
        <!-- minute (5분 단위) -->
        <div class="dropdown-list h-52 overflow-y-auto pr-1">
          <div
            class="px-2 pt-1 pb-0.5 text-body-03-normal-medium text-gray-400 select-none"
          >
            분
          </div>
          {#each minutes as m}
            <div
              class="dropdown-item justify-center {m === minute
                ? 'is-selected'
                : ''}"
              onclick={() => select('minute', m)}
            >
              {m}
            </div>
          {/each}
        </div>
      </div>
    </div>
  {/if}
</div>
