<script lang="ts">
  /**
   * Select — 공용 드롭다운.
   *
   * 옵션 패널은 portal로 body에 내보낸다. absolute로 두면 조상의
   * overflow-hidden에 잘리기 때문이다(보고서 편집기 툴바가 실제로 그랬다).
   * 자세한 이유는 positionPortal.ts와 app.css §2-6 주석 참고.
   */
  import { twMerge } from 'tailwind-merge'
  import { fade } from 'svelte/transition'
  import ChevronToggle from '$lib/assets/icons/ChevronToggle.svelte'
  import Check from '$lib/assets/icons/Check.svelte'
  import Close from '$lib/assets/icons/Close.svelte'
  import { portal, Z_LAYER } from '$lib/utils/positionPortal'

  interface Option {
    value: string | number
    label: string
    /**
     * 라벨 아래 설명 줄. 있으면 옵션이 2줄로 렌더된다.
     * 권한/역할처럼 "고르면 뭐가 달라지는지"가 선택에 직접 쓰이는 곳에만 준다.
     */
    desc?: string
  }

  interface Props {
    /** `as const` 상수 배열을 그대로 넘길 수 있도록 readonly를 받는다 */
    options: readonly Option[]
    /** 선택된 값 (bindable) */
    value?: string | number
    /** 선택 변경 콜백. clearable로 해제하면 undefined가 온다. */
    onChange?: (value: string | number | undefined) => void
    /** 트리거 버튼 폭 클래스 (예: 'w-32'). 기본은 내용에 맞춤. */
    className?: string
    /** 폼 필드처럼 가로를 꽉 채울 때. 래퍼까지 block/w-full로 바꾼다. */
    fullWidth?: boolean
    /** 드롭다운 패널 폭 클래스. 미지정 시 트리거 폭 추종(min-w). */
    menuClassName?: string
    ariaLabel?: string
    disabled?: boolean
    /** 값이 없을 때 회색으로 보여줄 문구 */
    placeholder?: string
    /**
     * 선택 해제 허용. 값이 있으면 chevron 자리에 X가 뜨고, 누르면 undefined가 된다.
     * 필수 항목(항상 값이 있어야 하는 필터·역할 등)에는 켜지 않는다.
     */
    clearable?: boolean
    /**
     * 트리거 크기.
     * - 'md'(기본): 정본 field 규격(44px). 폼 필드는 전부 이것.
     * - 'sm': 34px. 툴바처럼 아이콘 버튼(34px)과 나란히 서는 촘촘한 줄에서만.
     *   폼 안에서 쓰면 옆 입력창과 높이가 어긋나므로 쓰지 않는다.
     */
    size?: 'sm' | 'md'
  }

  let {
    options,
    value = $bindable(),
    onChange = () => {},
    className = '',
    menuClassName = '',
    ariaLabel = '',
    disabled = false,
    placeholder = '',
    clearable = false,
    fullWidth = false,
    size = 'md'
  }: Props = $props()

  let open = $state(false)
  let triggerEl = $state<HTMLElement | null>(null)

  let selected = $derived(options.find((o) => o.value === value))
  let selectedLabel = $derived(selected?.label ?? '')

  /** X는 지울 게 실제로 있을 때만 — 빈 상태에서 X가 떠 있으면 죽은 버튼이 된다. */
  let showClear = $derived(clearable && !disabled && selected !== undefined)

  /**
   * X는 트리거 버튼 *안*에 있다. 이벤트를 막지 않으면 트리거까지 올라가
   * "지웠는데 패널이 열리는" 동작이 된다. click·keydown 둘 다 막아야 한다.
   */
  function clear(e: Event) {
    e.stopPropagation()
    e.preventDefault()
    value = undefined
    open = false
    onChange(undefined)
  }

  /**
   * 패널 폭 — 기본은 트리거 폭 추종(기존 min-w-full과 같은 결과).
   * menuClassName으로 폭을 직접 주는 경우엔 portal이 인라인 width를 박으면
   * 그 클래스가 무시되므로 폭 고정을 끄고 컴포넌트 자체 폭을 쓰게 한다.
   */
  let fitWidth = $derived(!menuClassName)

  function pick(v: string | number) {
    value = v
    open = false
    onChange(v)
  }
</script>

<div class="relative {fullWidth ? 'block w-full' : 'inline-block'}">
  <button
    type="button"
    bind:this={triggerEl}
    {disabled}
    aria-label={ariaLabel}
    aria-haspopup="listbox"
    aria-expanded={open}
    onclick={() => {
      if (!disabled) open = !open
    }}
    class={twMerge(
      // 정본 §text-input/field: 높이 44 · radius 8 · 좌우 12 · 텍스트 15
      // 열렸을 때 보더를 primary로 — focus 상태와 같은 신호를 준다.
      // 글자색은 안쪽 span이 정한다(선택=gray-900 / 빈 상태=gray-400) —
      // 입력창(FIELD_INPUT_CLASS)과 같은 대비를 갖게 하려는 것.
      'flex items-center justify-between gap-2 rounded-lg border bg-white transition-colors',
      size === 'sm'
        ? 'h-8.5 px-2 text-body-03-normal-regular'
        : 'h-11 px-3 text-body-02-normal-regular',
      open ? 'border-primary-500' : 'border-gray-200 hover:border-gray-300',
      disabled
        ? 'cursor-not-allowed bg-gray-100 text-gray-400'
        : 'cursor-pointer',
      className
    )}
  >
    <!--
      빈 상태는 native ::placeholder와 같아 보여야 한다. 같은 15px이라도
      <span>은 브라우저가 그리는 placeholder보다 또렷해 커 보이므로,
      색(gray-400)뿐 아니라 font-weight도 400으로 맞춘다.
    -->
    <span
      class="truncate {disabled
        ? 'text-gray-400'
        : selected
          ? 'text-gray-900'
          : 'font-normal text-gray-400'}"
    >
      {selectedLabel || placeholder}
    </span>
    {#if showClear}
      <!--
        트리거가 이미 <button>이라 중첩 버튼은 못 쓴다(무효 HTML).
        role="button" + keydown으로 같은 동작을 만든다.
      -->
      <span
        role="button"
        tabindex="0"
        aria-label="선택 해제"
        onclick={clear}
        onkeydown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') clear(e)
        }}
        class="-mr-1 rounded p-0.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
      >
        <Close size={16} />
      </span>
    {:else}
      <!-- 열림/닫힘은 ChevronToggle이 표현한다 — 통짜 chevron을 180도 돌리면
           뒤집혀 보여서, 평평한 `-`를 지나 반대로 꺾이는 쪽을 쓴다. -->
      <ChevronToggle {open} size={18} class="shrink-0 text-icon-secondary" />
    {/if}
  </button>

  {#if open}
    <!--
      바깥 클릭 닫기는 portal의 callback이 처리한다(capture 단계 리스너).
      예전엔 투명 백드롭 버튼을 깔았지만 portal에서는 불필요하다.
    -->
    <div
      role="listbox"
      transition:fade={{ duration: 100 }}
      use:portal={{
        anchor: triggerEl!,
        isFitWidth: fitWidth,
        zIndex: Z_LAYER.portalDropdown,
        callback: () => (open = false)
      }}
      class={twMerge(
        // 떠 있는 표면이라 shadow-popup(정본 §Elevation).
        // 위치·폭·z는 portal이 인라인으로 준다 — 여기서 주면 덮어써진다.
        'rounded-lg border border-gray-200 bg-white py-1 shadow-popup',
        menuClassName
      )}
    >
      {#each options as option (option.value)}
        <button
          type="button"
          role="option"
          aria-selected={value === option.value}
          onclick={() => pick(option.value)}
          class="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-body-02-normal-regular transition-colors
            {value === option.value
            ? 'bg-gray-50 text-gray-900'
            : 'text-gray-600 hover:bg-gray-50'}"
        >
          {#if option.desc}
            <!-- 2줄 옵션: 라벨은 선택 여부로 강조, 설명은 항상 보조색 -->
            <span class="min-w-0">
              <span
                class="block text-body-02-normal-medium {value === option.value
                  ? 'text-gray-900'
                  : 'text-gray-700'}"
              >
                {option.label}
              </span>
              <span class="block text-label-02-normal-regular text-gray-400">
                {option.desc}
              </span>
            </span>
          {:else}
            {option.label}
          {/if}
          {#if value === option.value}
            <Check size={16} class="shrink-0 text-primary-500" />
          {/if}
        </button>
      {/each}
    </div>
  {/if}
</div>
