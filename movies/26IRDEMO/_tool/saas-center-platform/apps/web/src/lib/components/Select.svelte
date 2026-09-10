<script lang="ts">
  import { twMerge } from 'tailwind-merge'
  import { fade } from 'svelte/transition'
  import { onMount, createEventDispatcher } from 'svelte'

  import type { SelectOptionType } from '$lib/types/common'
  import { portal } from '$lib/utils/positionPortal'

  import CheckIcon from '$lib/assets/CheckIcon.svelte'
  import ArrowDownIcon20 from '$lib/assets/ArrowDownIcon20.svelte'

  export let showCheck: boolean = false
  export let extraValue: string[] = ['', '']
  export let hoverBoxClass: string = 'right-0'
  /** 드롭다운 폭을 트리거 폭에 정확히 고정 (긴 옵션 라벨로 넓어지는 것 방지) */
  export let dropdownExactWidth: boolean = false
  export let placeholder: string | undefined = undefined
  export let options: (string | SelectOptionType)[] = []
  export let selected: string | number | SelectOptionType | undefined =
    undefined
  export let disabled: boolean = false
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
  class="custom-select relative"
>
  <!-- 트리거 규격은 .dropdown-trigger가 소유한다(Web_Design.md §Components>dropdown).
       consumer의 class/btnClass는 뒤에 병합돼 폭·높이만 덮어쓴다. -->
  <button
    bind:this={buttonRef}
    on:click|preventDefault={toggleDropdown}
    {disabled}
    class={twMerge(
      'dropdown-trigger',
      isOpen && 'is-open',
      isFilterActive && 'is-active',
      disabled && 'is-disabled',
      (!selected || (placeholder && !selected)) && 'is-placeholder',
      $$props['class'],
      $$props['btnClass'],
      $$props['textClass']
    )}
  >
    <span class="dropdown-trigger-label">
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
    </span>
    <ArrowDownIcon20
      class={twMerge(
        'pointer-events-none shrink-0 duration-300',
        isOpen && 'rotate-180'
      )}
      color={isFilterActive
        ? 'var(--color-primary-600)'
        : 'var(--color-icon-primary)'}
    />
  </button>

  {#if isOpen && buttonRef}
    <div
      transition:fade={{ duration: 150 }}
      use:portal={{
        anchor: buttonRef,
        offset: 4,
        isFitWidth: true,
        exactWidth: dropdownExactWidth,
        zIndex: dropdownZIndex ?? 10001,
        callback: () => (isOpen = false)
      }}
      use:scrollToInitialValue
      class={twMerge('dropdown-panel max-h-60 overflow-y-auto', hoverBoxClass)}
      role="listbox"
    >
      <ul class="dropdown-list">
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
              'dropdown-item',
              (selected === option ||
                (typeof selected === 'string' &&
                  isSelectOptionType(option) &&
                  option.value === selected) ||
                (isSelectOptionType(selected) &&
                  isStringOption &&
                  selected.value === option)) &&
                'is-selected',
              $$props['optionBoxClass']
            )}
          >
            <span class="truncate-safe">
              {isStringOption ? option : isObjectOption ? option.title : ''}
            </span>
            {#if showCheck && selected === option}
              <CheckIcon />
            {/if}
          </li>
        {/each}
      </ul>
    </div>
  {/if}
</div>
