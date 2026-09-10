<script lang="ts">
  /**
   * DatePickerInput — 날짜 선택 인풋 (native <input type="date"> 대체).
   *
   * native date 인풋은 브라우저·OS마다 생김새가 달라 톤앤매너가 깨진다.
   * 참조 프로젝트와 같은 구조(트리거 버튼 + 포털 캘린더)로 맞춘 것.
   *
   * 트리거는 정본 §text-input/field 규격 — 높이 44 · radius 8 · 보더 gray-200,
   * 열렸을 때 primary 보더.
   *
   * value는 'YYYY-MM-DD' 문자열(bindable)이라 기존 native 인풋과 바꿔 끼우기 쉽다.
   */
  import { fade } from 'svelte/transition'
  import CalendarIcon from '$lib/assets/icons/Calendar.svelte'
  import { portal, Z_LAYER } from '$lib/utils/positionPortal'
  import CalendarPanel from './CalendarPanel.svelte'

  interface Props {
    /** 'YYYY-MM-DD' */
    value: string
    placeholder?: string
    disabled?: boolean
    /** 폼 제출·라벨 연결용 */
    id?: string
    class?: string
  }

  let {
    value = $bindable(),
    placeholder = 'YYYY-MM-DD',
    disabled = false,
    id,
    class: className = ''
  }: Props = $props()

  let triggerEl = $state<HTMLElement | null>(null)
  let isOpen = $state(false)

  /**
   * 'YYYY-MM-DD' → Date (로컬 자정).
   * new Date('2026-08-11')은 UTC로 해석돼 KST에서 하루 밀리므로 직접 쪼갠다.
   */
  function parse(s: string): Date | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s?.trim() ?? '')
    if (!m) return null
    const y = Number(m[1])
    const mo = Number(m[2])
    const d = Number(m[3])
    const date = new Date(y, mo - 1, d)
    // Date 생성자는 넘친 값을 조용히 이월한다('2026-13-01' → 2027-01-01,
    // '2026-02-31' → 3월 3일). 되읽어 같은 날인지 확인해 걸러낸다.
    if (
      date.getFullYear() !== y ||
      date.getMonth() !== mo - 1 ||
      date.getDate() !== d
    ) {
      return null
    }
    return date
  }

  /** Date → 'YYYY-MM-DD' (로컬 기준. toISOString은 UTC라 쓰지 않는다) */
  function format(d: Date): string {
    const p = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
  }

  let selected = $derived(parse(value))

  function handleSelect(date: Date) {
    value = format(date)
    isOpen = false
  }
</script>

<div class="relative {className}">
  <button
    {id}
    type="button"
    bind:this={triggerEl}
    {disabled}
    onclick={() => {
      if (!disabled) isOpen = !isOpen
    }}
    class="flex h-11 w-full items-center justify-between gap-2 rounded-lg border px-3 text-body-02-normal-regular transition-colors
      {isOpen ? 'border-primary-500' : 'border-gray-200 hover:border-gray-300'}
      {disabled
      ? 'cursor-not-allowed bg-gray-100 text-gray-400'
      : 'cursor-pointer bg-white'}"
  >
    <!-- 빈 상태를 native ::placeholder처럼 — Select와 같은 규칙(§4-3) -->
    <span class={value ? 'text-gray-900' : 'font-normal text-gray-400'}>
      {value || placeholder}
    </span>
    <CalendarIcon size={20} class="shrink-0 text-icon-secondary" />
  </button>

  {#if isOpen}
    <div
      transition:fade={{ duration: 100 }}
      use:portal={{
        anchor: triggerEl!,
        isFitWidth: false,
        zIndex: Z_LAYER.portalDropdown,
        callback: () => {
          isOpen = false
        }
      }}
    >
      <CalendarPanel {selected} onSelect={handleSelect} />
    </div>
  {/if}
</div>
