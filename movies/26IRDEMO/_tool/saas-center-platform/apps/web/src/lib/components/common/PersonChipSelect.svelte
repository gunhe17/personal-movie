<script lang="ts">
  import { slide } from 'svelte/transition'
  import { quintOut } from 'svelte/easing'
  import { portal } from '../../utils/positionPortal'
  import {
    PERSON_STATUS_OPTIONS,
    PERSON_STATUS_STYLES
  } from '../../features/clients/constants'

  interface Props {
    value: string
    onChange?: (value: string) => void
    disabled?: boolean
  }

  let { value, onChange, disabled = false }: Props = $props()

  let isOpen = $state(false)
  let containerRef: HTMLButtonElement | undefined = $state()

  const selectedOption = $derived(
    PERSON_STATUS_OPTIONS.find((opt) => opt.value === value)
  )
  const style = $derived(
    PERSON_STATUS_STYLES[value] ?? PERSON_STATUS_STYLES.inactive
  )

  function handleToggle() {
    if (disabled) return
    isOpen = !isOpen
  }

  function handleSelect(optionValue: string) {
    if (optionValue === value) {
      isOpen = false
      return
    }
    onChange?.(optionValue)
    isOpen = false
  }
</script>

<button
  type="button"
  bind:this={containerRef}
  onclick={handleToggle}
  {disabled}
  class="h-8 justify-between min-w-21.75 flex items-center gap-1.5 rounded-[100px] border-0 pl-2.5 pr-2 whitespace-nowrap {style.bg} {disabled
    ? 'cursor-not-allowed opacity-60'
    : 'cursor-pointer'}"
>
  <div class="flex items-center gap-1.5">
    <span class="h-1.5 w-1.5 shrink-0 rounded-full {style.dotColor}"></span>
    <span class="text-body-02-normal-medium {style.textColor}">
      {selectedOption?.label ?? ''}
    </span>
  </div>
  {#if !disabled}
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 6L8 10L4 6"
        stroke="#9CA3AF"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  {/if}
</button>
{#if isOpen}
  <div
    transition:slide={{ duration: 150, easing: quintOut }}
    use:portal={{
      anchor: containerRef,
      isFitWidth: true,
      callback: () => {
        isOpen = false
      }
    }}
    class="dropdown-panel z-50"
  >
    {#each PERSON_STATUS_OPTIONS as option (option.value)}
      {@const optStyle =
        PERSON_STATUS_STYLES[option.value] ?? PERSON_STATUS_STYLES.inactive}
      <button
        type="button"
        onclick={() => handleSelect(option.value)}
        class="dropdown-item justify-start {option.value === value
          ? 'is-selected cursor-default'
          : ''}"
      >
        <span class="dropdown-item-dot {optStyle.dotColor}"></span>
        <span>{option.label}</span>
      </button>
    {/each}
  </div>
{/if}
