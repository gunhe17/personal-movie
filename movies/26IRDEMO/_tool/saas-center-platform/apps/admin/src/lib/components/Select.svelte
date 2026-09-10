<script lang="ts">
  import { twMerge } from 'tailwind-merge'
  import { fade } from 'svelte/transition'
  import { onMount, createEventDispatcher } from 'svelte'

  import type { SelectOptionType } from '$lib/types/common'
  import { portal } from '$lib/utils/positionPortal'

  import CheckIcon from '$lib/assets/CheckIcon.svelte'
  import ChevronIcon from '$lib/assets/ChevronIcon.svelte'
  import Typography from '$components/Typography.svelte'

  export let showCheck: boolean = false
  export let extraValue: string[] = ['', '']
  export let hoverBoxClass: string = 'right-0'
  export let placeholder: string | undefined = undefined
  export let options: (string | SelectOptionType)[] = []
  export let selected: string | number | SelectOptionType | undefined =
    undefined
  export let disabled: boolean = false
  export let iconType: 'chevron' | 'fill' = 'chevron'
  // 필터 활성 상태 하이라이트 기능
  export let showActiveHighlight: boolean = false
  export let defaultValue: string | undefined = undefined
  /** 드롭다운 옵션 리스트 포탈 z-index (고정 레이어 위에 띄울 때 사용, 미지정 시 10001) */
  export let dropdownZIndex: number | undefined = undefined
  /** 드롭다운 열릴 때 스크롤할 옵션 value ('center' | 'start', 기본 'center') */
  export let initialScrollValue: string | undefined = undefined
  export let initialScrollAlign: 'center' | 'start' = 'center'

  const dispatch = createEventDispatcher()

  let isOpen = false
  let extraFinished: boolean = false
  let buttonRef: HTMLButtonElement | null = null

  // 타입 가드 함수
  const isSelectOptionType = (option: any): option is SelectOptionType => {
    return (
      typeof option === 'object' &&
      option !== null &&
      'value' in option &&
      'title' in option
    )
  }

  const toggleDropdown = () => {
    if (disabled) return
    isOpen = !isOpen
  }

  const selectOption = (option: string | SelectOptionType) => {
    selected = option
    isOpen = false
    dispatch('change', option)
  }

  $: if (extraFinished) {
    isOpen = false
    extraFinished = false
    dispatch('change', extraValue)
  }

  let hasAutoSelected = false

  onMount(() => {
    if (
      !placeholder &&
      (selected === undefined || selected === null) &&
      !disabled &&
      options.length > 0
    ) {
      selected =
        typeof options[0] === 'string'
          ? options[0]
          : typeof options[0] === 'object'
            ? options[0]
            : undefined
      hasAutoSelected = true
    }
  })

  const scrollToInitialValue = (node: HTMLElement) => {
    if (!initialScrollValue) return
    requestAnimationFrame(() => {
      const items = node.querySelectorAll<HTMLLIElement>('li[data-value]')
      for (const item of items) {
        if (item.dataset.value === initialScrollValue) {
          const containerHeight = node.clientHeight
          const itemTop = item.offsetTop
          const itemHeight = item.offsetHeight
          if (initialScrollAlign === 'center') {
            node.scrollTop = itemTop - containerHeight / 2 + itemHeight / 2
          } else {
            node.scrollTop = itemTop
          }
          break
        }
      }
    })
  }

  const clickOutside = (node: HTMLElement, callback: () => void) => {
    const handleClick = (event: MouseEvent) => {
      if (!node.contains(event.target as Node)) {
        callback()
      }
    }

    document.addEventListener('click', handleClick, true)

    return {
      destroy() {
        document.removeEventListener('click', handleClick, true)
      }
    }
  }

  $: if (
    options.length > 0 &&
    !hasAutoSelected &&
    selected === '' &&
    placeholder
  ) {
    selected = ''
  }

  // 필터 활성 상태 계산 (기본값과 다른 값이 선택되었을 때)
  $: isFilterActive = (() => {
    if (!showActiveHighlight) return false
    if (defaultValue === undefined) return false

    // selected가 문자열인 경우
    if (typeof selected === 'string') {
      return selected !== defaultValue
    }
    // selected가 SelectOptionType 객체인 경우
    if (isSelectOptionType(selected)) {
      return selected.value !== defaultValue
    }
    return false
  })()
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<!-- svelte-ignore a11y-click-events-have-key-events -->
<div
  on:click
  use:clickOutside={() => (isOpen = false)}
  class={twMerge(
    'text-body-02-regular custom-select relative rounded-xl bg-transparent ring-1 ring-inset',
    disabled
      ? 'ring-gray-200 bg-gray-50 overflow-hidden'
      : isOpen
        ? 'ring-primary-400'
        : isFilterActive
          ? 'ring-primary-500'
          : 'ring-gray-200',
    $$props['class']
  )}
>
  <button
    bind:this={buttonRef}
    on:click|preventDefault={toggleDropdown}
    {disabled}
    class={twMerge(
      'flex h-full w-full items-center justify-between px-4 py-3 text-left leading-none',
      disabled ? 'cursor-not-allowed!' : '',
      $$props['btnClass']
    )}
  >
    <Typography
      variant={$$props['textClass'] ? $$props['textClass'] : 'body-02-regular!'}
      color={disabled
        ? 'text-gray-400'
        : !selected || (placeholder && !selected)
          ? 'text-gray-400'
          : isFilterActive
            ? 'text-primary-600'
            : 'text-gray-600'}
      className={twMerge('truncate', $$props['textClass'])}
    >
      {#if typeof selected === 'string' && selected !== ''}
        {@const matchedOption = options.find(
          (opt) => isSelectOptionType(opt) && opt.value === selected
        )}
        {matchedOption && isSelectOptionType(matchedOption)
          ? matchedOption.title
          : selected}
      {:else if typeof selected === 'object' && selected !== null}
        {selected.title}
      {:else}
        {placeholder || '선택해주세요'}
      {/if}
    </Typography>
    {#if iconType === 'chevron'}
      <ChevronIcon
        class={twMerge(
          'pointer-events-none h-3 w-1.5 duration-300',
          !isOpen ? '-rotate-90' : 'rotate-90'
        )}
        strokeColor={isFilterActive ? '#7C3AED' : '#A3A3A3'}
      />
    {:else}
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M5.20711 6.33337C4.76165 6.33337 4.53857 6.87195 4.85355 7.18693L7.64645 9.97982C7.84171 10.1751 8.15829 10.1751 8.35355 9.97982L11.1464 7.18693C11.4614 6.87194 11.2383 6.33337 10.7929 6.33337L5.20711 6.33337Z"
          fill="#6D7882"
        />
      </svg>
    {/if}
  </button>

  {#if isOpen && buttonRef}
    <div
      transition:fade={{ duration: 150 }}
      use:portal={{
        anchor: buttonRef,
        offset: 4,
        isFitWidth: true,
        zIndex: dropdownZIndex ?? 10001,
        callback: () => (isOpen = false)
      }}
      use:scrollToInitialValue
      class={twMerge(
        'max-h-60 overflow-y-auto rounded-xl bg-white p-2 shadow-md drop-shadow',
        hoverBoxClass
      )}
      role="listbox"
    >
      <ul class="space-y-1">
        {#each options as option}
          {@const isStringOption = typeof option === 'string'}
          {@const isObjectOption = typeof option === 'object'}
          <!-- svelte-ignore a11y-click-events-have-key-events -->
          <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
          <li
            data-value={isStringOption
              ? option
              : isObjectOption
                ? option.value
                : ''}
            on:click={() =>
              isStringOption
                ? selectOption(option)
                : isObjectOption && selectOption(option)}
            class={twMerge(
              $$props['optionBoxClass'],
              'my-1 flex cursor-pointer items-center justify-between gap-3 rounded-md p-2 text-left text-gray-600 hover:bg-gray-50',
              isStringOption || isObjectOption ? '' : 'pt-2',
              (selected === option ||
                (typeof selected === 'string' &&
                  isSelectOptionType(option) &&
                  option.value === selected) ||
                (isSelectOptionType(selected) &&
                  isStringOption &&
                  selected.value === option)) &&
                'bg-primary-50 text-primary'
            )}
          >
            {#if isStringOption}
              <Typography
                variant={$$props['textClass']
                  ? $$props['textClass']
                  : 'body-02-regular'}
                color="text-gray-600"
                className={$$props['textClass']}
              >
                {option}
              </Typography>
            {:else if isObjectOption}
              <Typography
                variant={$$props['textClass']
                  ? $$props['textClass']
                  : 'body-02-regular'}
                color="text-gray-600"
                className={$$props['textClass']}
              >
                {option.title}
              </Typography>
            {/if}
            {#if showCheck && selected === option}
              <CheckIcon />
            {/if}
          </li>
        {/each}
      </ul>
    </div>
  {/if}
</div>
